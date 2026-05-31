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

// Helper to check LocalStorage key-value storage
const getLocal = <T>(key: string): T | null => {
  const d = localStorage.getItem(key);
  return d ? JSON.parse(d) : null;
};
const setLocal = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

// ----------------------------------------------------
// 1. User Profile Services
// ----------------------------------------------------
export const getUserProfile = async (uid: string, defaultName?: string, defaultEmail?: string): Promise<UserProfile> => {
  if (isFirebaseEnabled && db) {
    const docRef = doc(db, 'users', uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
  } else {
    const profile = getLocal<UserProfile>(`questfit_profile_${uid}`);
    if (profile) return profile;
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
  if (isFirebaseEnabled && db) {
    await setDoc(doc(db, 'users', uid), profile);
  } else {
    setLocal(`questfit_profile_${uid}`, profile);
  }
};

// ----------------------------------------------------
// 2. User Memory Services (AI structured data)
// ----------------------------------------------------
export const getUserMemory = async (uid: string): Promise<UserMemory> => {
  if (isFirebaseEnabled && db) {
    const docRef = doc(db, 'memory', uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserMemory;
    }
  } else {
    const memory = getLocal<UserMemory>(`questfit_memory_${uid}`);
    if (memory) return memory;
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
  if (isFirebaseEnabled && db) {
    await setDoc(doc(db, 'memory', uid), memory);
  } else {
    setLocal(`questfit_memory_${uid}`, memory);
  }
};

// ----------------------------------------------------
// 3. Quest Engine Services
// ----------------------------------------------------
export const getQuests = async (uid: string): Promise<Quest[]> => {
  const todayStr = new Date().toISOString().split('T')[0];
  const memory = await getUserMemory(uid);
  const weight = memory.goals?.currentWeightKg || memory.goals?.targetWeightKg || 70;
  
  if (isFirebaseEnabled && db) {
    const colRef = collection(db, 'users', uid, 'quests');
    const snap = await getDocs(colRef);
    const quests: Quest[] = [];
    snap.forEach(doc => {
      quests.push(doc.data() as Quest);
    });
    if (quests.length > 0) {
      return checkAndRefreshDailyQuests(uid, quests, todayStr, weight);
    }
  } else {
    const quests = getLocal<Quest[]>(`questfit_quests_${uid}`);
    if (quests && quests.length > 0) {
      return checkAndRefreshDailyQuests(uid, quests, todayStr, weight);
    }
  }

  // Default quests setup if empty
  const defaultQuests = getDefaultQuests(weight);
  await saveAllQuests(uid, defaultQuests);
  return defaultQuests;
};

const checkAndRefreshDailyQuests = async (uid: string, quests: Quest[], todayStr: string, weightKg?: number): Promise<Quest[]> => {
  // Check if daily quests are from a previous date
  const hasOldDailies = quests.some(q => q.category === 'daily' && !q.id.endsWith(todayStr));
  
  if (hasOldDailies) {
    // Keep weekly and special quests, regenerate daily quests for today
    const preservedQuests = quests.filter(q => q.category !== 'daily');
    const freshDailies = getDefaultQuests(weightKg).filter(q => q.category === 'daily');
    const newQuestList = [...freshDailies, ...preservedQuests];
    await saveAllQuests(uid, newQuestList);
    return newQuestList;
  }
  return quests;
};

export const saveQuest = async (uid: string, quest: Quest): Promise<void> => {
  if (isFirebaseEnabled && db) {
    await setDoc(doc(db, 'users', uid, 'quests', quest.id), quest);
  } else {
    const quests = await getQuests(uid);
    const index = quests.findIndex(q => q.id === quest.id);
    if (index !== -1) {
      quests[index] = quest;
    } else {
      quests.push(quest);
    }
    setLocal(`questfit_quests_${uid}`, quests);
  }
};

export const saveAllQuests = async (uid: string, quests: Quest[]): Promise<void> => {
  if (isFirebaseEnabled && db) {
    const batch = writeBatch(db);
    quests.forEach(q => {
      const docRef = doc(db, 'users', uid, 'quests', q.id);
      batch.set(docRef, q);
    });
    await batch.commit();
  } else {
    setLocal(`questfit_quests_${uid}`, quests);
  }
};

// ----------------------------------------------------
// 4. Progress Logs Services (Weights, Habits tracker)
// ----------------------------------------------------
export const getProgressLogs = async (uid: string): Promise<ProgressLog[]> => {
  if (isFirebaseEnabled && db) {
    const colRef = collection(db, 'users', uid, 'progress_logs');
    const q = query(colRef, orderBy('date', 'asc'));
    const snap = await getDocs(q);
    const logs: ProgressLog[] = [];
    snap.forEach(doc => {
      logs.push(doc.data() as ProgressLog);
    });
    return logs;
  } else {
    const logs = getLocal<ProgressLog[]>(`questfit_progress_${uid}`) || [];
    // Sort ascending by date string
    return logs.sort((a, b) => a.date.localeCompare(b.date));
  }
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
  if (isFirebaseEnabled && db) {
    await setDoc(doc(db, 'users', uid, 'progress_logs', log.id), log);
  } else {
    const logs = await getProgressLogs(uid);
    const index = logs.findIndex(l => l.id === log.id);
    if (index !== -1) {
      logs[index] = log;
    } else {
      logs.push(log);
    }
    setLocal(`questfit_progress_${uid}`, logs);
  }
};

// ----------------------------------------------------
// 5. Achievements Board
// ----------------------------------------------------
export const getAchievements = async (uid: string): Promise<Achievement[]> => {
  if (isFirebaseEnabled && db) {
    const colRef = collection(db, 'users', uid, 'achievements');
    const snap = await getDocs(colRef);
    const achs: Achievement[] = [];
    snap.forEach(doc => {
      achs.push(doc.data() as Achievement);
    });
    if (achs.length > 0) return achs;
  } else {
    const achs = getLocal<Achievement[]>(`questfit_achievements_${uid}`);
    if (achs) return achs;
  }

  const defaults = getDefaultAchievements();
  await saveAllAchievements(uid, defaults);
  return defaults;
};

export const saveAchievement = async (uid: string, ach: Achievement): Promise<void> => {
  if (isFirebaseEnabled && db) {
    await setDoc(doc(db, 'users', uid, 'achievements', ach.id), ach);
  } else {
    const achs = await getAchievements(uid);
    const index = achs.findIndex(a => a.id === ach.id);
    if (index !== -1) {
      achs[index] = ach;
    } else {
      achs.push(ach);
    }
    setLocal(`questfit_achievements_${uid}`, achs);
  }
};

export const saveAllAchievements = async (uid: string, achs: Achievement[]): Promise<void> => {
  if (isFirebaseEnabled && db) {
    const batch = writeBatch(db);
    achs.forEach(a => {
      const docRef = doc(db, 'users', uid, 'achievements', a.id);
      batch.set(docRef, a);
    });
    await batch.commit();
  } else {
    setLocal(`questfit_achievements_${uid}`, achs);
  }
};

// ----------------------------------------------------
// 6. Chat History (AICoach chat)
// ----------------------------------------------------
export const getChatHistory = async (uid: string): Promise<ChatMessage[]> => {
  if (isFirebaseEnabled && db) {
    const colRef = collection(db, 'users', uid, 'chat_history');
    const q = query(colRef, orderBy('timestamp', 'asc'));
    const snap = await getDocs(q);
    const msgs: ChatMessage[] = [];
    snap.forEach(doc => {
      msgs.push(doc.data() as ChatMessage);
    });
    return msgs;
  } else {
    return getLocal<ChatMessage[]>(`questfit_chat_${uid}`) || [];
  }
};

export const addChatMessage = async (uid: string, msg: ChatMessage): Promise<void> => {
  if (isFirebaseEnabled && db) {
    await setDoc(doc(db, 'users', uid, 'chat_history', msg.id), msg);
  } else {
    const history = await getChatHistory(uid);
    history.push(msg);
    setLocal(`questfit_chat_${uid}`, history);
  }
};

export const clearChatHistory = async (uid: string): Promise<void> => {
  if (isFirebaseEnabled && db) {
    const colRef = collection(db, 'users', uid, 'chat_history');
    const snap = await getDocs(colRef);
    const batch = writeBatch(db);
    snap.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  } else {
    localStorage.removeItem(`questfit_chat_${uid}`);
  }
};
