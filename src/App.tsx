import { useState, useEffect } from 'react';
import { 
  subscribeToAuth, 
  logoutUser, 
  UserSession,
  isEmailSignInLink,
  handleIncomingEmailLink,
  getCurrentUser
} from './services/authService';
import { 
  getUserProfile, 
  getUserMemory, 
  getQuests, 
  getAchievements,
  syncLocalDataToCloud
} from './services/dbService';
import { checkAndUpdateStreak } from './services/rpgService';
import { UserProfile, UserMemory, Quest, Achievement } from './types';
import { motion, AnimatePresence } from 'framer-motion';
import { getLocalDateString } from './utils/dateUtils';

// UI Components
import Auth from './components/Auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import QuestSystem from './components/QuestSystem';
import AICoachChat from './components/AICoachChat';
import ProgressAnalytics from './components/ProgressAnalytics';
import RPGProgression from './components/RPGProgression';
import Settings from './components/Settings';
import FitnessPlans from './components/FitnessPlans';
import NutritionSystem from './components/NutritionSystem';

import { Dumbbell } from 'lucide-react';

function App() {
  const [session, setSession] = useState<UserSession | null>(() => getCurrentUser());
  const [authLoading, setAuthLoading] = useState(() => !getCurrentUser());
  const [dataLoading, setDataLoading] = useState(false);
  const [emailLinkLoggingIn, setEmailLinkLoggingIn] = useState(false);
  const [emailLinkError, setEmailLinkError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  // App States
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userMemory, setUserMemory] = useState<UserMemory | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [currentDate, setCurrentDate] = useState(() => getLocalDateString());
  
  // Level Up State
  const [levelUpData, setLevelUpData] = useState<{
    show: boolean;
    level: number;
    title: string;
    achievements: Achievement[];
  } | null>(null);

  // Subscribe to Auth status changes & handle email links
  useEffect(() => {
    const handleAuth = async () => {
      if (isEmailSignInLink()) {
        setEmailLinkLoggingIn(true);
        try {
          const user = await handleIncomingEmailLink();
          if (user) {
            console.log('Logged in successfully via email link:', user);
          }
        } catch (err: any) {
          console.error('Email link authentication failed:', err);
          setEmailLinkError(err.message || 'Falha ao autenticar com o link de e-mail.');
        } finally {
          setEmailLinkLoggingIn(false);
        }
      }
    };

    handleAuth();

    const unsub = subscribeToAuth((user) => {
      setSession(user);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Automatic daily reset check (at midnight, tab focus, or periodic interval)
  useEffect(() => {
    const checkDateChange = async () => {
      const today = getLocalDateString();
      if (today !== currentDate) {
        console.log("Detectada mudança de dia! Atualizando metas de:", currentDate, "para:", today);
        setCurrentDate(today);
        
        if (session) {
          try {
            setDataLoading(true);
            const profile = await getUserProfile(session.uid, session.displayName, session.email);
            const [updatedProfile, memory, activeQuests, unlockedAchievements] = await Promise.all([
              checkAndUpdateStreak(session.uid, profile),
              getUserMemory(session.uid),
              getQuests(session.uid),
              getAchievements(session.uid)
            ]);

            // Save fresh data to local cache
            localStorage.setItem(`questfit_profile_${session.uid}`, JSON.stringify(updatedProfile));
            localStorage.setItem(`questfit_memory_${session.uid}`, JSON.stringify(memory));
            localStorage.setItem(`questfit_quests_${session.uid}`, JSON.stringify(activeQuests));
            localStorage.setItem(`questfit_achievements_${session.uid}`, JSON.stringify(unlockedAchievements));

            setUserProfile(updatedProfile);
            setUserMemory(memory);
            setQuests(activeQuests);
            setAchievements(unlockedAchievements);
          } catch (err) {
            console.error("Erro ao atualizar dados na mudança de dia:", err);
          } finally {
            setDataLoading(false);
          }
        }
      }
    };

    // Check every 10 seconds
    const interval = setInterval(checkDateChange, 10000);

    // Check when window gains focus or tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDateChange();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkDateChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkDateChange);
    };
  }, [currentDate, session]);

  // Fetch all user specific data when session changes
  useEffect(() => {
    if (!session) {
      setUserProfile(null);
      setUserMemory(null);
      setQuests([]);
      setAchievements([]);
      setDataError(null);
      return;
    }

    const loadUserData = async () => {
      setDataLoading(true);
      setDataError(null);

      // 1. Try to load from LocalStorage cache immediately to avoid loading screen freeze
      const cachedProfile = localStorage.getItem(`questfit_profile_${session.uid}`);
      const cachedMemory = localStorage.getItem(`questfit_memory_${session.uid}`);
      const cachedQuests = localStorage.getItem(`questfit_quests_${session.uid}`);
      const cachedAchievements = localStorage.getItem(`questfit_achievements_${session.uid}`);
      
      let hasCache = false;
      if (cachedProfile && cachedMemory) {
        try {
          setUserProfile(JSON.parse(cachedProfile));
          setUserMemory(JSON.parse(cachedMemory));
          if (cachedQuests) setQuests(JSON.parse(cachedQuests));
          if (cachedAchievements) setAchievements(JSON.parse(cachedAchievements));
          hasCache = true;
          // Turn off loading screen early so UI is responsive
          setDataLoading(false);
        } catch (e) {
          console.warn('Error parsing cached data:', e);
        }
      }

      try {
        const previousGuestUid = localStorage.getItem('questfit_previous_guest_uid');
        const cachedMockUser = localStorage.getItem('questfit_mock_user');
        
        let guestUidToSync = previousGuestUid;
        if (!guestUidToSync && cachedMockUser) {
          try {
            const mockSession = JSON.parse(cachedMockUser);
            if (mockSession && mockSession.uid) {
              guestUidToSync = mockSession.uid;
            }
          } catch (e) {}
        }

        if (guestUidToSync && guestUidToSync !== session.uid && !session.uid.startsWith('mock_') && session.email !== 'convidado@questfit.com') {
          try {
            await syncLocalDataToCloud(session.uid, guestUidToSync);
            localStorage.removeItem('questfit_previous_guest_uid');
            localStorage.removeItem('questfit_mock_user');
          } catch (e) {
            console.error('Failed to sync guest data:', e);
          }
        }

        // Cache the guest UID if current session is a guest session
        if (session.email === 'convidado@questfit.com' || session.uid.startsWith('mock_')) {
          localStorage.setItem('questfit_previous_guest_uid', session.uid);
        }

        const profile = await getUserProfile(session.uid, session.displayName, session.email);
        const [updatedProfile, memory, activeQuests, unlockedAchievements] = await Promise.all([
          checkAndUpdateStreak(session.uid, profile),
          getUserMemory(session.uid),
          getQuests(session.uid),
          getAchievements(session.uid)
        ]);

        // Save fresh data to local cache
        localStorage.setItem(`questfit_profile_${session.uid}`, JSON.stringify(updatedProfile));
        localStorage.setItem(`questfit_memory_${session.uid}`, JSON.stringify(memory));
        localStorage.setItem(`questfit_quests_${session.uid}`, JSON.stringify(activeQuests));
        localStorage.setItem(`questfit_achievements_${session.uid}`, JSON.stringify(unlockedAchievements));

        setUserProfile(updatedProfile);
        setUserMemory(memory);
        setQuests(activeQuests);
        setAchievements(unlockedAchievements);
      } catch (err: any) {
        console.error('Error fetching user data from server:', err);
        // Only block with an error screen if we have zero cached data to show
        if (!hasCache) {
          setDataError(err.message || 'Erro de comunicação com o banco de dados.');
        }
      } finally {
        setDataLoading(false);
      }
    };

    loadUserData();
  }, [session]);

  const handleQuestUpdate = (updatedQuests: Quest[], updatedProfile: UserProfile, newlyUnlockedAchs: Achievement[]) => {
    setQuests(updatedQuests);
    
    // Check if level-up occurred
    const levelChanged = userProfile && updatedProfile.level > userProfile.level;
    
    setUserProfile(updatedProfile);
    
    // Update local cache
    localStorage.setItem(`questfit_quests_${session!.uid}`, JSON.stringify(updatedQuests));
    localStorage.setItem(`questfit_profile_${session!.uid}`, JSON.stringify(updatedProfile));

    if (newlyUnlockedAchs.length > 0) {
      // Sync achievements list
      getAchievements(session!.uid).then(achs => {
        setAchievements(achs);
        localStorage.setItem(`questfit_achievements_${session!.uid}`, JSON.stringify(achs));
      });
    }

    if (levelChanged || newlyUnlockedAchs.length > 0) {
      setLevelUpData({
        show: true,
        level: updatedProfile.level,
        title: updatedProfile.title,
        achievements: newlyUnlockedAchs
      });
    }
  };

  const handleMemoryUpdate = (updatedMemory: UserMemory, updatedProfile?: UserProfile, newlyUnlockedAchs?: Achievement[]) => {
    setUserMemory(updatedMemory);
    localStorage.setItem(`questfit_memory_${session!.uid}`, JSON.stringify(updatedMemory));

    if (updatedProfile) {
      const levelChanged = userProfile && updatedProfile.level > userProfile.level;
      setUserProfile(updatedProfile);
      localStorage.setItem(`questfit_profile_${session!.uid}`, JSON.stringify(updatedProfile));

      if (newlyUnlockedAchs && newlyUnlockedAchs.length > 0) {
        getAchievements(session!.uid).then(achs => {
          setAchievements(achs);
          localStorage.setItem(`questfit_achievements_${session!.uid}`, JSON.stringify(achs));
        });
      }

      if (levelChanged || (newlyUnlockedAchs && newlyUnlockedAchs.length > 0)) {
        setLevelUpData({
          show: true,
          level: updatedProfile.level,
          title: updatedProfile.title,
          achievements: newlyUnlockedAchs || []
        });
      }
    }
  };

  const handleWeightLogged = async (updatedProfile: UserProfile, updatedMemory: UserMemory, newlyUnlockedAchs: Achievement[]) => {
    setUserMemory(updatedMemory);
    localStorage.setItem(`questfit_memory_${session!.uid}`, JSON.stringify(updatedMemory));
    
    // Refresh quests list because water target updates dynamically with weight
    const activeQuests = await getQuests(session!.uid);
    setQuests(activeQuests);
    localStorage.setItem(`questfit_quests_${session!.uid}`, JSON.stringify(activeQuests));
    
    const levelChanged = userProfile && updatedProfile.level > userProfile.level;
    setUserProfile(updatedProfile);
    localStorage.setItem(`questfit_profile_${session!.uid}`, JSON.stringify(updatedProfile));

    if (newlyUnlockedAchs.length > 0) {
      getAchievements(session!.uid).then(achs => {
        setAchievements(achs);
        localStorage.setItem(`questfit_achievements_${session!.uid}`, JSON.stringify(achs));
      });
    }

    if (levelChanged || newlyUnlockedAchs.length > 0) {
      setLevelUpData({
        show: true,
        level: updatedProfile.level,
        title: updatedProfile.title,
        achievements: newlyUnlockedAchs
      });
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Deseja sair do aplicativo?')) {
      await logoutUser();
      setActiveTab('dashboard');
    }
  };

  // Email Link Loading and Error states
  if (emailLinkLoggingIn) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="animate-spin p-4 rounded-3xl bg-gradient-to-tr from-violet-600 to-pink-500 text-white shadow-lg shadow-violet-600/20">
            <Dumbbell className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold bg-gradient-to-r from-white to-violet-400 bg-clip-text text-transparent">
            Confirmando Acesso
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Confirmando seu login e preparando seus treinos. Por favor, aguarde um instante...
          </p>
        </div>
      </div>
    );
  }

  if (emailLinkError) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white p-4">
        <div className="glass-panel p-8 rounded-[32px] max-w-md w-full text-center space-y-6">
          <div className="inline-flex p-4 rounded-3xl bg-rose-500/20 text-rose-400 border border-rose-500/20">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Falha no Portal de Login</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Não conseguimos validar seu link de login sem senha. Ele pode ter expirado ou já ter sido utilizado.
          </p>
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-2xl font-mono text-left break-all">
            {emailLinkError}
          </div>
          <button
            onClick={() => {
              setEmailLinkError(null);
              window.location.href = window.location.origin + window.location.pathname;
            }}
            className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-2xl transition duration-200 cursor-pointer shadow-lg shadow-violet-600/20 text-sm"
          >
            Voltar para o Início
          </button>
        </div>
      </div>
    );
  }

  // Auth loading screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin p-3 rounded-2xl bg-gradient-to-tr from-violet-600 to-pink-500 text-white">
            <Dumbbell className="w-8 h-8" />
          </div>
          <p className="text-sm font-semibold tracking-wider uppercase text-zinc-500">Conectando ao QuestFit...</p>
        </div>
      </div>
    );
  }

  // Auth screen if not logged in
  if (!session) {
    return <Auth onSuccess={() => {}} />;
  }

  // Data fetching loading screen or error
  if (dataError) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white p-4">
        <div className="glass-panel p-8 rounded-[32px] max-w-md w-full text-center space-y-6">
          <div className="inline-flex p-4 rounded-3xl bg-rose-500/20 text-rose-400 border border-rose-500/20">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Falha ao Carregar Ficha</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Houve um erro de comunicação com o banco de dados do Firestore.
          </p>
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-2xl font-mono text-left break-all">
            {dataError}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setDataError(null);
                window.location.reload();
              }}
              className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-2xl transition duration-200 cursor-pointer shadow-lg shadow-violet-600/20 text-sm"
            >
              Recarregar
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white font-bold rounded-2xl transition duration-200 cursor-pointer text-sm"
            >
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Data fetching loading screen
  if (dataLoading || !userProfile || !userMemory) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-pulse p-3 rounded-2xl bg-gradient-to-tr from-violet-600 to-pink-500 text-white">
            <Dumbbell className="w-8 h-8" />
          </div>
          <p className="text-sm font-semibold tracking-wider uppercase text-zinc-500">Carregando Personagem...</p>
        </div>
      </div>
    );
  }

  // Render the current selected tab component
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            userProfile={userProfile} 
            userMemory={userMemory} 
            quests={quests} 
            onNavigateToTab={setActiveTab} 
          />
        );
      case 'quests':
        return (
          <QuestSystem 
            userProfile={userProfile} 
            quests={quests} 
            onQuestUpdate={handleQuestUpdate} 
          />
        );
      case 'workouts':
        return (
          <FitnessPlans
            userProfile={userProfile}
            userMemory={userMemory}
            onWorkoutCompleted={(profile, achs) => handleQuestUpdate(quests, profile, achs)}
            onMemoryUpdate={handleMemoryUpdate}
          />
        );
      case 'nutrition':
        return (
          <NutritionSystem
            userProfile={userProfile}
            userMemory={userMemory}
            onNutritionLogged={(profile, achs) => handleQuestUpdate(quests, profile, achs)}
          />
        );
      case 'chat':
        return (
          <AICoachChat 
            userProfile={userProfile} 
            userMemory={userMemory} 
            quests={quests}
            onMemoryUpdate={handleMemoryUpdate} 
            onQuestUpdate={handleQuestUpdate}
          />
        );
      case 'analytics':
        return (
          <ProgressAnalytics 
            userProfile={userProfile} 
            userMemory={userMemory} 
            onWeightLogged={handleWeightLogged} 
          />
        );
      case 'rpg':
        return (
          <RPGProgression 
            userProfile={userProfile} 
            achievements={achievements} 
          />
        );
      case 'settings':
        return (
          <Settings 
            userProfile={userProfile} 
            userMemory={userMemory} 
            onMemoryUpdate={handleMemoryUpdate} 
          />
        );
      default:
        return (
          <Dashboard 
            userProfile={userProfile} 
            userMemory={userMemory} 
            quests={quests} 
            onNavigateToTab={setActiveTab} 
          />
        );
    }
  };

  return (
    <Layout
      user={session}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onLogout={handleLogout}
      levelUpData={levelUpData}
      onCloseLevelUp={() => setLevelUpData(null)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {renderTabContent()}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

export default App;
