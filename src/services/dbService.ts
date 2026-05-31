import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  writeBatch
} from 'firebase/firestore';
import { db, isFirebaseEnabled } from './firebase';
import { UserProfile, UserMemory, Quest, ProgressLog, Achievement, ChatMessage } from '../types';
import { getDefaultQuests, getDefaultAchievements, getXpNeededForLevel, getTitleForLevel } from '../utils/xpCalc';
import { getLocalDateString, getMondayISO } from '../utils/dateUtils';

// Helper to check LocalStorage key-value storage
const getLocal = <T>(key: string): T | null => {
  const d = localStorage.getItem(key);
  return d ? JSON.parse(d) : null;
};
const setLocal = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Timeout helper to ensure Firestore calls never hang indefinitely
const TIMEOUT_MS = 3500; // 3.5 seconds

const withTimeout = <T>(promise: Promise<T>, fallbackValue: T): Promise<T> => {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`Firestore operation timed out after ${TIMEOUT_MS}ms. Falling back to local cache.`);
      resolve(fallbackValue);
    }, TIMEOUT_MS);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        console.warn(`Firestore operation failed. Falling back to cache. Error:`, err);
        resolve(fallbackValue);
      });
  });
};

// ----------------------------------------------------
// 1. User Profile Services
// ----------------------------------------------------
export const getUserProfile = async (uid: string, defaultName?: string, defaultEmail?: string): Promise<UserProfile> => {
  const cached = getLocal<UserProfile>(`questfit_profile_${uid}`);

  if (cached) {
    // Revalidate in background
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, 'users', uid);
      getDoc(docRef).then((snap) => {
        if (snap.exists()) {
          setLocal(`questfit_profile_${uid}`, snap.data() as UserProfile);
        }
      }).catch(() => {});
    }
    return cached;
  }

  if (isFirebaseEnabled && db) {
    const docRef = doc(db, 'users', uid);
    const snap = await withTimeout(getDoc(docRef), null);
    if (snap && snap.exists()) {
      const profile = snap.data() as UserProfile;
      setLocal(`questfit_profile_${uid}`, profile);
      return profile;
    }
  }

  // Create default profile if not exists
  const defaultProfile: UserProfile = {
    uid,
    displayName: defaultName || (uid.startsWith('mock_') ? uid.replace('mock_', '') : 'Guerreiro'),
    email: defaultEmail || '',
    createdAt: new Date().toISOString(),
    level: 1,
    xp: 0,
    xpNeededForNextLevel: getXpNeededForLevel(1),
    title: getTitleForLevel(1),
    streak: 0,
    lastActive: ''
  };
  await saveUserProfile(uid, defaultProfile);
  return defaultProfile;
};

export const saveUserProfile = async (uid: string, profile: UserProfile): Promise<void> => {
  setLocal(`questfit_profile_${uid}`, profile);
  if (isFirebaseEnabled && db) {
    setDoc(doc(db, 'users', uid), profile).catch(err => {
      console.warn('Failed to save profile to cloud:', err);
    });
  }
};

// ----------------------------------------------------
// 2. User Memory Services (AI structured data)
// ----------------------------------------------------
export const getUserMemory = async (uid: string): Promise<UserMemory> => {
  const cached = getLocal<UserMemory>(`questfit_memory_${uid}`);

  if (cached) {
    // Revalidate in background
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, 'memory', uid);
      getDoc(docRef).then((snap) => {
        if (snap.exists()) {
          setLocal(`questfit_memory_${uid}`, snap.data() as UserMemory);
        }
      }).catch(() => {});
    }
    return cached;
  }

  if (isFirebaseEnabled && db) {
    const docRef = doc(db, 'memory', uid);
    const snap = await withTimeout(getDoc(docRef), null);
    if (snap && snap.exists()) {
      const memory = snap.data() as UserMemory;
      setLocal(`questfit_memory_${uid}`, memory);
      return memory;
    }
  }

  // Create empty default memory structure
  const defaultMemory: UserMemory = {
    goals: {},
    preferences: {},
    healthConstraints: {},
    schedule: {},
    lastUpdated: new Date().toISOString()
  };
  await saveUserMemory(uid, defaultMemory);
  return defaultMemory;
};

export const saveUserMemory = async (uid: string, memory: UserMemory): Promise<void> => {
  setLocal(`questfit_memory_${uid}`, memory);
  if (isFirebaseEnabled && db) {
    setDoc(doc(db, 'memory', uid), memory).catch(err => {
      console.warn('Failed to save memory to cloud:', err);
    });
  }
};

// ----------------------------------------------------
// 3. Quest Engine Services
// ----------------------------------------------------
let lastQuestsFetchTime = 0;

export const getQuests = async (uid: string): Promise<Quest[]> => {
  const todayStr = getLocalDateString();
  const cached = getLocal<Quest[]>(`questfit_quests_${uid}`);
  
  const cachedMemory = getLocal<UserMemory>(`questfit_memory_${uid}`);
  const weight = cachedMemory?.goals?.currentWeightKg || cachedMemory?.goals?.targetWeightKg || 70;
  
  const now = Date.now();
  if (cached && cached.length > 0) {
    // Revalidate in background at most once every 30 seconds to avoid race conditions
    if (now - lastQuestsFetchTime > 30000) {
      lastQuestsFetchTime = now;
      if (isFirebaseEnabled && db) {
        const colRef = collection(db, 'users', uid, 'quests');
        getDocs(colRef).then((snap) => {
          if (!snap.empty) {
            const cloudQuests: Quest[] = [];
            snap.forEach(doc => cloudQuests.push(doc.data() as Quest));
            // Only accept cloud data when it already has today's daily quests.
            // If Firestore still holds yesterday's quests (another device hasn't synced yet),
            // blindly overwriting would wipe today's local progress.
            const hasCloudTodayDailies = cloudQuests.some(
              q => q.category === 'daily' && q.id.endsWith(todayStr)
            );
            if (hasCloudTodayDailies) {
              setLocal(`questfit_quests_${uid}`, cloudQuests);
            }
          }
        }).catch(() => {});
      }
    }
    return checkAndRefreshDailyQuests(uid, cached, todayStr, weight);
  }

  if (isFirebaseEnabled && db) {
    const colRef = collection(db, 'users', uid, 'quests');
    const snap = await withTimeout(getDocs(colRef), null);
    if (snap && !snap.empty) {
      const quests: Quest[] = [];
      snap.forEach(doc => {
        quests.push(doc.data() as Quest);
      });
      setLocal(`questfit_quests_${uid}`, quests);
      return checkAndRefreshDailyQuests(uid, quests, todayStr, weight);
    }
  }

  // Default quests setup if empty
  const defaultQuests = getDefaultQuests(weight);
  await saveAllQuests(uid, defaultQuests);
  return defaultQuests;
};

/**
 * Synchronous (no DB save) version of checkAndRefreshDailyQuests.
 * Used in App.tsx to immediately show correct quests from cache before the async DB load,
 * preventing "yesterday's completed quests" from flashing on a new day.
 */
export const refreshQuestsLocally = (quests: Quest[], weightKg?: number): Quest[] => {
  const todayStr = getLocalDateString();
  const mondayStr = getMondayISO();

  const hasDailies = quests.some(q => q.category === 'daily');
  const hasOldDailies = quests.some(q => q.category === 'daily' && !q.id.endsWith(todayStr));
  const dailyTypes = quests.filter(q => q.category === 'daily').map(q => q.type);
  const requiredTypes: Quest['type'][] = ['water', 'workout', 'steps', 'nutrition'];
  const missingDailies = requiredTypes.some(type => !dailyTypes.includes(type));
  const needsDailyReset = !hasDailies || hasOldDailies || missingDailies;

  const weeklyQuests = quests.filter(q => q.category === 'weekly');
  const needsWeeklyReset = weeklyQuests.some(q => !q.weekStart || q.weekStart !== mondayStr);

  if (!needsDailyReset && !needsWeeklyReset) return quests;

  let result = [...quests];

  if (needsDailyReset) {
    const freshDailies = getDefaultQuests(weightKg).filter(q => q.category === 'daily');
    const todayDailies = quests.filter(q => q.category === 'daily' && q.id.endsWith(todayStr));
    const mergedDailies = freshDailies.map(fresh => {
      const existing = todayDailies.find(ext => ext.type === fresh.type);
      return existing || fresh;
    });
    result = [...mergedDailies, ...result.filter(q => q.category !== 'daily')];
  }

  if (needsWeeklyReset) {
    const freshWeekly = getDefaultQuests(weightKg).filter(q => q.category === 'weekly');
    const thisWeekWeekly = weeklyQuests.filter(q => q.weekStart === mondayStr);
    const mergedWeekly = freshWeekly.map(fresh => {
      const existing = thisWeekWeekly.find(ext => ext.id === fresh.id);
      return existing || fresh;
    });
    result = [...result.filter(q => q.category !== 'weekly'), ...mergedWeekly];
  }

  return result;
};

const checkAndRefreshDailyQuests = async (uid: string, quests: Quest[], todayStr: string, weightKg?: number): Promise<Quest[]> => {
  const mondayStr = getMondayISO();

  // ── Daily quest check ────────────────────────────────────────────────────────
  const hasDailies = quests.some(q => q.category === 'daily');
  const hasOldDailies = quests.some(q => q.category === 'daily' && !q.id.endsWith(todayStr));
  const dailyTypes = quests.filter(q => q.category === 'daily').map(q => q.type);
  const requiredTypes: Quest['type'][] = ['water', 'workout', 'steps', 'nutrition'];
  const missingDailies = requiredTypes.some(type => !dailyTypes.includes(type));
  const needsDailyReset = !hasDailies || hasOldDailies || missingDailies;

  // ── Weekly quest check ───────────────────────────────────────────────────────
  // Weekly quests carry a `weekStart` field (ISO date of the Monday they were created).
  // If that date doesn't match the current week's Monday, the week has rolled over and
  // the quests must be reset. Quests without `weekStart` (old data before this fix) are
  // also treated as stale so they get the field added immediately.
  const weeklyQuests = quests.filter(q => q.category === 'weekly');
  const hasOldWeekly = weeklyQuests.some(q => !q.weekStart || q.weekStart !== mondayStr);
  const needsWeeklyReset = hasOldWeekly;

  if (!needsDailyReset && !needsWeeklyReset) return quests;

  let result = [...quests];

  if (needsDailyReset) {
    const preservedQuests = quests.filter(q => q.category !== 'daily');
    const freshDailies = getDefaultQuests(weightKg).filter(q => q.category === 'daily');
    // Preserve today's progress if today's daily quests already exist
    const todayDailies = quests.filter(q => q.category === 'daily' && q.id.endsWith(todayStr));
    const mergedDailies = freshDailies.map(fresh => {
      const existing = todayDailies.find(ext => ext.type === fresh.type);
      return existing || fresh;
    });
    result = [...mergedDailies, ...preservedQuests];
  }

  if (needsWeeklyReset) {
    const freshWeekly = getDefaultQuests(weightKg).filter(q => q.category === 'weekly');
    // If any weekly quests already belong to this week, preserve their progress
    const thisWeekWeekly = weeklyQuests.filter(q => q.weekStart === mondayStr);
    const mergedWeekly = freshWeekly.map(fresh => {
      const existing = thisWeekWeekly.find(ext => ext.id === fresh.id);
      return existing || fresh;
    });
    result = [...result.filter(q => q.category !== 'weekly'), ...mergedWeekly];
  }

  await saveAllQuests(uid, result);
  return result;
};

export const saveQuest = async (uid: string, quest: Quest): Promise<void> => {
  const quests = getLocal<Quest[]>(`questfit_quests_${uid}`) || [];
  const index = quests.findIndex(q => q.id === quest.id);
  if (index !== -1) {
    quests[index] = quest;
  } else {
    quests.push(quest);
  }
  setLocal(`questfit_quests_${uid}`, quests);

  if (isFirebaseEnabled && db) {
    setDoc(doc(db, 'users', uid, 'quests', quest.id), quest).catch(err => {
      console.warn('Failed to save quest to cloud:', err);
    });
  }
};

export const saveAllQuests = async (uid: string, quests: Quest[]): Promise<void> => {
  setLocal(`questfit_quests_${uid}`, quests);
  if (isFirebaseEnabled && db) {
    const batch = writeBatch(db);
    quests.forEach(q => {
      const docRef = doc(db, 'users', uid, 'quests', q.id);
      batch.set(docRef, q);
    });
    batch.commit().catch(err => {
      console.warn('Failed to save all quests to cloud:', err);
    });
  }
};

// ----------------------------------------------------
// 4. Progress Logs Services (Weights, Habits tracker)
// ----------------------------------------------------
let lastLogsFetchTime = 0;

export const getProgressLogs = async (uid: string): Promise<ProgressLog[]> => {
  const cached = getLocal<ProgressLog[]>(`questfit_progress_${uid}`) || [];
  const now = Date.now();

  if (cached && cached.length > 0) {
    // Revalidate in background at most once every 30 seconds to avoid race conditions
    if (now - lastLogsFetchTime > 30000) {
      lastLogsFetchTime = now;
      if (isFirebaseEnabled && db) {
        const colRef = collection(db, 'users', uid, 'progress_logs');
        const q = query(colRef, orderBy('date', 'asc'));
        getDocs(q).then((snap) => {
          if (!snap.empty) {
            const logs: ProgressLog[] = [];
            snap.forEach(doc => logs.push(doc.data() as ProgressLog));
            setLocal(`questfit_progress_${uid}`, logs.sort((a, b) => a.date.localeCompare(b.date)));
          }
        }).catch(() => {});
      }
    }
    return cached.sort((a, b) => a.date.localeCompare(b.date));
  }

  if (isFirebaseEnabled && db) {
    const colRef = collection(db, 'users', uid, 'progress_logs');
    const q = query(colRef, orderBy('date', 'asc'));
    const snap = await withTimeout(getDocs(q), null);
    if (snap && !snap.empty) {
      const logs: ProgressLog[] = [];
      snap.forEach(doc => {
        logs.push(doc.data() as ProgressLog);
      });
      const sortedLogs = logs.sort((a, b) => a.date.localeCompare(b.date));
      setLocal(`questfit_progress_${uid}`, sortedLogs);
      return sortedLogs;
    }
  }

  return [];
};

export const getProgressLogForDate = async (uid: string, dateStr: string): Promise<ProgressLog> => {
  const logs = await getProgressLogs(uid);
  const existing = logs.find(l => l.date === dateStr);
  if (existing) return existing;

  const defaultLog: ProgressLog = {
    id: `${dateStr}_log`,
    date: dateStr,
    waterIntakeMl: 0,
    workoutCompleted: false,
    stepsCompleted: 0,
    xpEarned: 0
  };
  return defaultLog;
};

export const saveProgressLog = async (uid: string, log: ProgressLog): Promise<void> => {
  const logs = await getProgressLogs(uid);
  const index = logs.findIndex(l => l.id === log.id);
  if (index !== -1) {
    logs[index] = log;
  } else {
    logs.push(log);
  }
  setLocal(`questfit_progress_${uid}`, logs);

  if (isFirebaseEnabled && db) {
    setDoc(doc(db, 'users', uid, 'progress_logs', log.id), log).catch(err => {
      console.warn('Failed to save progress log to cloud:', err);
    });
  }
};

// ----------------------------------------------------
// 5. Achievements Board
// ----------------------------------------------------
export const getAchievements = async (uid: string): Promise<Achievement[]> => {
  const cached = getLocal<Achievement[]>(`questfit_achievements_${uid}`);

  if (cached) {
    // Revalidate in background
    if (isFirebaseEnabled && db) {
      const colRef = collection(db, 'users', uid, 'achievements');
      getDocs(colRef).then((snap) => {
        if (!snap.empty) {
          const achs: Achievement[] = [];
          snap.forEach(doc => achs.push(doc.data() as Achievement));
          setLocal(`questfit_achievements_${uid}`, achs);
        }
      }).catch(() => {});
    }
    return cached;
  }

  if (isFirebaseEnabled && db) {
    const colRef = collection(db, 'users', uid, 'achievements');
    const snap = await withTimeout(getDocs(colRef), null);
    if (snap && !snap.empty) {
      const achs: Achievement[] = [];
      snap.forEach(doc => {
        achs.push(doc.data() as Achievement);
      });
      setLocal(`questfit_achievements_${uid}`, achs);
      return achs;
    }
  }

  const defaults = getDefaultAchievements();
  await saveAllAchievements(uid, defaults);
  return defaults;
};

export const saveAchievement = async (uid: string, ach: Achievement): Promise<void> => {
  const achs = await getAchievements(uid);
  const index = achs.findIndex(a => a.id === ach.id);
  if (index !== -1) {
    achs[index] = ach;
  } else {
    achs.push(ach);
  }
  setLocal(`questfit_achievements_${uid}`, achs);

  if (isFirebaseEnabled && db) {
    setDoc(doc(db, 'users', uid, 'achievements', ach.id), ach).catch(err => {
      console.warn('Failed to save achievement to cloud:', err);
    });
  }
};

export const saveAllAchievements = async (uid: string, achs: Achievement[]): Promise<void> => {
  setLocal(`questfit_achievements_${uid}`, achs);
  if (isFirebaseEnabled && db) {
    const batch = writeBatch(db);
    achs.forEach(a => {
      const docRef = doc(db, 'users', uid, 'achievements', a.id);
      batch.set(docRef, a);
    });
    batch.commit().catch(err => {
      console.warn('Failed to save all achievements to cloud:', err);
    });
  }
};

// ----------------------------------------------------
// 6. Chat History (AICoach chat)
// ----------------------------------------------------
export const getChatHistory = async (uid: string): Promise<ChatMessage[]> => {
  const cached = getLocal<ChatMessage[]>(`questfit_chat_${uid}`) || [];

  if (cached && cached.length > 0) {
    // Revalidate in background
    if (isFirebaseEnabled && db) {
      const colRef = collection(db, 'users', uid, 'chat_history');
      const q = query(colRef, orderBy('timestamp', 'asc'));
      getDocs(q).then((snap) => {
        if (!snap.empty) {
          const msgs: ChatMessage[] = [];
          snap.forEach(doc => msgs.push(doc.data() as ChatMessage));
          setLocal(`questfit_chat_${uid}`, msgs);
        }
      }).catch(() => {});
    }
    return cached;
  }

  if (isFirebaseEnabled && db) {
    const colRef = collection(db, 'users', uid, 'chat_history');
    const q = query(colRef, orderBy('timestamp', 'asc'));
    const snap = await withTimeout(getDocs(q), null);
    if (snap && !snap.empty) {
      const msgs: ChatMessage[] = [];
      snap.forEach(doc => {
        msgs.push(doc.data() as ChatMessage);
      });
      setLocal(`questfit_chat_${uid}`, msgs);
      return msgs;
    }
  }

  return [];
};

export const addChatMessage = async (uid: string, msg: ChatMessage): Promise<void> => {
  const history = await getChatHistory(uid);
  history.push(msg);
  setLocal(`questfit_chat_${uid}`, history);

  if (isFirebaseEnabled && db) {
    setDoc(doc(db, 'users', uid, 'chat_history', msg.id), msg).catch(err => {
      console.warn('Failed to save chat message to cloud:', err);
    });
  }
};

export const clearChatHistory = async (uid: string): Promise<void> => {
  localStorage.removeItem(`questfit_chat_${uid}`);
  if (isFirebaseEnabled && db) {
    const colRef = collection(db, 'users', uid, 'chat_history');
    getDocs(colRef).then((snap) => {
      const batch = writeBatch(db!);
      snap.forEach(doc => {
        batch.delete(doc.ref);
      });
      batch.commit().catch(err => {
        console.warn('Failed to clear chat history from cloud:', err);
      });
    }).catch(err => {
      console.warn('Failed to fetch chat history to clear:', err);
    });
  }
};

/**
 * Deletes ALL user data — localStorage AND Firestore sub-collections.
 * Called from Settings "Redefinir Dados" to guarantee a clean slate even when Firebase is enabled.
 */
export const deleteAllUserData = async (uid: string): Promise<void> => {
  // 1. Clear all questfit_ localStorage keys
  const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('questfit_'));
  keysToRemove.forEach(k => localStorage.removeItem(k));

  if (!isFirebaseEnabled || !db) return;

  // 2. Delete Firestore sub-collections (quests, progress_logs, achievements, chat_history)
  const subCollections = ['quests', 'progress_logs', 'achievements', 'chat_history'];
  for (const col of subCollections) {
    try {
      const colRef = collection(db, 'users', uid, col);
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      console.warn(`Failed to delete Firestore collection ${col}:`, err);
    }
  }

  // 3. Delete top-level user profile doc and memory doc
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', uid));
    batch.delete(doc(db, 'memory', uid));
    await batch.commit();
  } catch (err) {
    console.warn('Failed to delete Firestore user/memory docs:', err);
  }
};

export const syncLocalDataToCloud = async (cloudUid: string, mockUid: string): Promise<void> => {
  if (!isFirebaseEnabled || !db) return;

  try {
    console.log(`Syncing local data from mock user ${mockUid} to cloud user ${cloudUid}`);

    // 1. Sync Profile
    const localProfile = getLocal<UserProfile>(`questfit_profile_${mockUid}`);
    if (localProfile) {
      const cloudProfileRef = doc(db, 'users', cloudUid);
      const snap = await getDoc(cloudProfileRef);
      if (!snap.exists()) {
        const updatedProfile = { ...localProfile, uid: cloudUid };
        await setDoc(cloudProfileRef, updatedProfile);
        console.log('Synced profile to cloud.');
      }
    }

    // 2. Sync Memory
    const localMemory = getLocal<UserMemory>(`questfit_memory_${mockUid}`);
    if (localMemory) {
      const cloudMemoryRef = doc(db, 'memory', cloudUid);
      const snap = await getDoc(cloudMemoryRef);
      if (!snap.exists()) {
        await setDoc(cloudMemoryRef, localMemory);
        console.log('Synced memory to cloud.');
      }
    }

    // 3. Sync Quests
    const localQuests = getLocal<Quest[]>(`questfit_quests_${mockUid}`);
    if (localQuests && localQuests.length > 0) {
      const questsColRef = collection(db, 'users', cloudUid, 'quests');
      const snap = await getDocs(questsColRef);
      if (snap.empty) {
        const batch = writeBatch(db);
        localQuests.forEach(q => {
          batch.set(doc(db, 'users', cloudUid, 'quests', q.id), q);
        });
        await batch.commit();
        console.log('Synced quests to cloud.');
      }
    }

    // 4. Sync Achievements
    const localAchs = getLocal<Achievement[]>(`questfit_achievements_${mockUid}`);
    if (localAchs && localAchs.length > 0) {
      const achColRef = collection(db, 'users', cloudUid, 'achievements');
      const snap = await getDocs(achColRef);
      if (snap.empty) {
        const batch = writeBatch(db);
        localAchs.forEach(a => {
          batch.set(doc(db, 'users', cloudUid, 'achievements', a.id), a);
        });
        await batch.commit();
        console.log('Synced achievements to cloud.');
      }
    }

    // 5. Sync Progress Logs
    const localProgress = getLocal<ProgressLog[]>(`questfit_progress_${mockUid}`);
    if (localProgress && localProgress.length > 0) {
      const progColRef = collection(db, 'users', cloudUid, 'progress_logs');
      const snap = await getDocs(progColRef);
      if (snap.empty) {
        const batch = writeBatch(db);
        localProgress.forEach(log => {
          batch.set(doc(db, 'users', cloudUid, 'progress_logs', log.id), log);
        });
        await batch.commit();
        console.log('Synced progress logs to cloud.');
      }
    }

    // 6. Sync Chat History
    const localChat = getLocal<ChatMessage[]>(`questfit_chat_${mockUid}`);
    if (localChat && localChat.length > 0) {
      const chatColRef = collection(db, 'users', cloudUid, 'chat_history');
      const snap = await getDocs(chatColRef);
      if (snap.empty) {
        const batch = writeBatch(db);
        localChat.forEach(msg => {
          batch.set(doc(db, 'users', cloudUid, 'chat_history', msg.id), msg);
        });
        await batch.commit();
        console.log('Synced chat history to cloud.');
      }
    }
  } catch (error) {
    console.error('Error syncing local data to cloud:', error);
  }
};
