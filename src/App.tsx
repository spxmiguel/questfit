import { useState, useEffect } from 'react';
import { subscribeToAuth, logoutUser, UserSession } from './services/authService';
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

  // Subscribe to Auth status changes
  useEffect(() => {
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
      return;
    }

    const loadUserData = async () => {
      setDataLoading(true);
      try {
        // Fetch raw profile
        let profile = await getUserProfile(session.uid);
        
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
      } catch (err) {
        console.error('Error fetching user data:', err);
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

  const handleWeightLogged = (updatedProfile: UserProfile, updatedMemory: UserMemory, newlyUnlockedAchs: Achievement[]) => {
    setUserMemory(updatedMemory);
    
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
