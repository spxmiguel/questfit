import { useState, useEffect } from 'react';
import { 
  subscribeToAuth, 
  logoutUser, 
  UserSession,
  isEmailSignInLink,
  handleIncomingEmailLink
} from './services/authService';
import { 
  getUserProfile, 
  getUserMemory, 
  getQuests, 
  getAchievements 
} from './services/dbService';
import { checkAndUpdateStreak } from './services/rpgService';
import { UserProfile, UserMemory, Quest, Achievement } from './types';

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
  const [session, setSession] = useState<UserSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
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
      try {
        // Fetch raw profile passing Google / Email session info
        let profile = await getUserProfile(session.uid, session.displayName, session.email);
        
        // Check and update login streak
        profile = await checkAndUpdateStreak(session.uid, profile);
        
        // Fetch remaining documents
        const memory = await getUserMemory(session.uid);
        const activeQuests = await getQuests(session.uid);
        const unlockedAchievements = await getAchievements(session.uid);

        setUserProfile(profile);
        setUserMemory(memory);
        setQuests(activeQuests);
        setAchievements(unlockedAchievements);
      } catch (err: any) {
        console.error('Error fetching user data:', err);
        setDataError(err.message || 'Erro desconhecido ao carregar os dados de progresso no banco.');
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
    
    if (newlyUnlockedAchs.length > 0) {
      // Sync achievements list
      getAchievements(session!.uid).then(setAchievements);
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

    if (updatedProfile) {
      const levelChanged = userProfile && updatedProfile.level > userProfile.level;
      setUserProfile(updatedProfile);

      if (newlyUnlockedAchs && newlyUnlockedAchs.length > 0) {
        getAchievements(session!.uid).then(setAchievements);
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
    
    // Refresh quests list because water target updates dynamically with weight
    const activeQuests = await getQuests(session!.uid);
    setQuests(activeQuests);
    
    const levelChanged = userProfile && updatedProfile.level > userProfile.level;
    setUserProfile(updatedProfile);

    if (newlyUnlockedAchs.length > 0) {
      getAchievements(session!.uid).then(setAchievements);
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
            Invocando Acesso Mágico
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Confirmando seu portal de login e preparando sua ficha de RPG. Por favor, aguarde um instante...
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
          <p className="text-sm font-semibold tracking-wider uppercase text-zinc-500">Conectando à Guilda...</p>
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
            onMemoryUpdate={handleMemoryUpdate} 
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
        return <Settings />;
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
      {renderTabContent()}
    </Layout>
  );
}

export default App;
