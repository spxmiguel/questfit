import React, { useState } from 'react';
import { Quest, UserProfile, ProgressLog } from '../types';
import { saveQuest, saveProgressLog, getProgressLogForDate } from '../services/dbService';
import { awardXp } from '../services/rpgService';
import { checkLevelUp, getTitleForLevel } from '../utils/xpCalc';
import { CheckCircle, Dumbbell, Compass, Flame, Droplet, Plus, Minus, Footprints, Carrot, HelpCircle, Trophy } from 'lucide-react';

interface QuestProps {
  userProfile: UserProfile;
  quests: Quest[];
  onQuestUpdate: (quests: Quest[], updatedProfile: UserProfile, unlockedAchs: any[]) => void;
}

export default function QuestSystem({ userProfile, quests, onQuestUpdate }: QuestProps) {
  const [waterInput, setWaterInput] = useState(250);
  const [stepsInput, setStepsInput] = useState('');
  const [workoutType, setWorkoutType] = useState('strength');
  const [workoutDuration, setWorkoutDuration] = useState('30');
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const handleQuestCompletion = (quest: Quest, updatedProgress: number) => {
    try {
      const isNowCompleted = updatedProgress >= quest.target;
      const wasCompleted = quest.completed;
      
      const updatedQuest: Quest = {
        ...quest,
        progress: Math.max(0, Math.min(updatedProgress, quest.target)),
        completed: isNowCompleted,
        completedDate: isNowCompleted ? new Date().toISOString() : undefined
      };

      // Calculate XP reward
      let xpToAward = 0;
      if (isNowCompleted && !wasCompleted) {
        xpToAward = quest.xpReward;
      }

      // Calculate local profile updates immediately
      let finalProfile = { ...userProfile };
      if (xpToAward > 0) {
        const updatedXp = finalProfile.xp + xpToAward;
        const levelCheck = checkLevelUp(finalProfile.level, updatedXp);
        finalProfile = {
          ...finalProfile,
          level: levelCheck.newLevel,
          xp: levelCheck.remainingXp,
          xpNeededForNextLevel: levelCheck.xpNeeded,
          title: getTitleForLevel(levelCheck.newLevel)
        };
      }

      // Compute updated quests array immediately
      let updatedQuests = quests.map(q => q.id === quest.id ? updatedQuest : q);
      
      // Update weekly quests progress based on completed daily workouts
      let weeklyWorkouts = updatedQuests.find(q => q.id === 'weekly-workouts');
      let weeklyCompletedNow = false;
      if (quest.type === 'workout' && quest.category === 'daily' && isNowCompleted && !wasCompleted) {
        if (weeklyWorkouts && !weeklyWorkouts.completed) {
          const newWeeklyProgress = weeklyWorkouts.progress + 1;
          const weeklyCompleted = newWeeklyProgress >= weeklyWorkouts.target;
          weeklyCompletedNow = weeklyCompleted;
          
          const updatedWeekly: Quest = {
            ...weeklyWorkouts,
            progress: newWeeklyProgress,
            completed: weeklyCompleted,
            completedDate: weeklyCompleted ? new Date().toISOString() : undefined
          };
          
          updatedQuests = updatedQuests.map(q => q.id === 'weekly-workouts' ? updatedWeekly : q);
          weeklyWorkouts = updatedWeekly;

          if (weeklyCompleted) {
            const updatedXp = finalProfile.xp + weeklyWorkouts.xpReward;
            const levelCheck = checkLevelUp(finalProfile.level, updatedXp);
            finalProfile = {
              ...finalProfile,
              level: levelCheck.newLevel,
              xp: levelCheck.remainingXp,
              xpNeededForNextLevel: levelCheck.xpNeeded,
              title: getTitleForLevel(levelCheck.newLevel)
            };
          }
        }
      }

      // Trigger UI callback IMMEDIATELY for responsive feeling
      onQuestUpdate(updatedQuests, finalProfile, []);

      // Fire off background save operations (async, non-blocking)
      (async () => {
        try {
          // 1. Save quest
          await saveQuest(userProfile.uid, updatedQuest);

          // 2. Save action to today's progress log
          const log = await getProgressLogForDate(userProfile.uid, todayStr);
          let updatedLog: ProgressLog = { ...log };

          if (quest.type === 'water') {
            updatedLog.waterIntakeMl = updatedQuest.progress;
          } else if (quest.type === 'steps') {
            updatedLog.stepsCompleted = updatedQuest.progress;
          } else if (quest.type === 'workout' && quest.category === 'daily') {
            updatedLog.workoutCompleted = isNowCompleted;
          }

          if (xpToAward > 0) {
            updatedLog.xpEarned += xpToAward;
          }
          await saveProgressLog(userProfile.uid, updatedLog);

          // 3. Handle XP award & achievements on the DB
          let currentProfile = finalProfile;
          let allUnlockedAchs: any[] = [];

          if (xpToAward > 0) {
            const res = await awardXp(userProfile.uid, userProfile, xpToAward, quest.category === 'daily' && quest.type === 'workout' ? 'workout' : 'quest');
            currentProfile = res.profile;
            allUnlockedAchs = [...allUnlockedAchs, ...res.unlockedAchievements];
          }

          // 4. Handle weekly quest save
          if (quest.type === 'workout' && quest.category === 'daily' && isNowCompleted && !wasCompleted && weeklyWorkouts) {
            await saveQuest(userProfile.uid, weeklyWorkouts);
            if (weeklyCompletedNow) {
              const resWeekly = await awardXp(userProfile.uid, currentProfile, weeklyWorkouts.xpReward, 'quest');
              currentProfile = resWeekly.profile;
              allUnlockedAchs = [...allUnlockedAchs, ...resWeekly.unlockedAchievements];
            }
          }

          // If background check unlocked any achievements or updated profile further, refresh UI
          if (allUnlockedAchs.length > 0 || currentProfile.level > finalProfile.level) {
            onQuestUpdate(updatedQuests, currentProfile, allUnlockedAchs);
          }
        } catch (backgroundErr) {
          console.error('Background quest sync failed:', backgroundErr);
        }
      })();
    } catch (err) {
      console.error('Failed to update quest (optimistic):', err);
    }
  };

  const handleAddWater = (amount: number) => {
    const waterQuest = quests.find(q => q.type === 'water' && q.category === 'daily');
    if (waterQuest) {
      handleQuestCompletion(waterQuest, Math.max(0, waterQuest.progress + amount));
    }
  };

  const handleUpdateSteps = (e: React.FormEvent) => {
    e.preventDefault();
    const stepsVal = parseInt(stepsInput);
    if (isNaN(stepsVal) || stepsVal < 0) return;

    const stepsQuest = quests.find(q => q.type === 'steps' && q.category === 'daily');
    if (stepsQuest) {
      handleQuestCompletion(stepsQuest, stepsVal);
      setStepsInput('');
    }
  };

  const handleCompleteVeggie = () => {
    const veggieQuest = quests.find(q => q.type === 'nutrition' && q.category === 'daily');
    if (veggieQuest) {
      handleQuestCompletion(veggieQuest, veggieQuest.progress >= veggieQuest.target ? 0 : veggieQuest.target);
    }
  };

  const handleLogWorkout = () => {
    const dailyWorkoutQuest = quests.find(q => q.type === 'workout' && q.category === 'daily');
    if (dailyWorkoutQuest) {
      handleQuestCompletion(dailyWorkoutQuest, 1);
      setShowWorkoutModal(false);
    }
  };

  const dailies = quests.filter(q => q.category === 'daily');
  const weeklies = quests.filter(q => q.category === 'weekly');
  const specials = quests.filter(q => q.category === 'special');

  const renderIcon = (type: string, completed: boolean) => {
    const activeColor = completed ? 'text-emerald-400' : 'text-violet-400';
    switch (type) {
      case 'water': return <Droplet className={`w-5 h-5 ${activeColor}`} />;
      case 'workout': return <Dumbbell className={`w-5 h-5 ${activeColor}`} />;
      case 'steps': return <Footprints className={`w-5 h-5 ${activeColor}`} />;
      case 'nutrition': return <Carrot className={`w-5 h-5 ${activeColor}`} />;
      default: return <Compass className={`w-5 h-5 ${activeColor}`} />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Mural de Quests</h1>
        <p className="text-zinc-400">Complete seus hábitos diários e registre exercícios para ganhar XP e subir de nível.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Side: Logger Panels */}
        <div className="space-y-6">
          {/* Water card */}
          <div className="glass-panel p-6 rounded-[32px] space-y-4">
            <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Droplet className="w-4 h-4 text-sky-400" />
              Hidratação Diária
            </h3>
            <p className="text-xs text-zinc-400">
              Registrado hoje: <span className="font-bold text-sky-400">{(quests.find(q => q.type === 'water' && q.category === 'daily')?.progress || 0)}ml</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleAddWater(250)}
                disabled={loading}
                className="py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-1 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5 text-sky-400" /> +250ml
              </button>
              <button
                type="button"
                onClick={() => handleAddWater(500)}
                disabled={loading}
                className="py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-1 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5 text-sky-400" /> +500ml
              </button>
              <button
                type="button"
                onClick={() => handleAddWater(-250)}
                disabled={loading}
                className="py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-red-400/80 font-bold rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-1 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Minus className="w-3.5 h-3.5 text-red-400" /> -250ml
              </button>
              <button
                type="button"
                onClick={() => handleAddWater(-500)}
                disabled={loading}
                className="py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-red-400/80 font-bold rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-1 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Minus className="w-3.5 h-3.5 text-red-400" /> -500ml
              </button>
            </div>
          </div>

          {/* Steps card */}
          <div className="glass-panel p-6 rounded-[32px] space-y-4">
            <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Footprints className="w-4 h-4 text-emerald-400" />
              Contador de Passos
            </h3>
            <p className="text-xs text-zinc-400">
              Registrado hoje: <span className="font-bold text-emerald-400">{(quests.find(q => q.type === 'steps' && q.category === 'daily')?.progress || 0)} passos</span>
            </p>
            <form onSubmit={handleUpdateSteps} className="space-y-3">
              <input
                type="number"
                placeholder="Ex: 8000 passos"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={stepsInput}
                onChange={(e) => setStepsInput(e.target.value)}
                min="0"
                disabled={loading}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="submit"
                  disabled={loading || !stepsInput}
                  className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition text-xs cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  Definir Passos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const stepsQuest = quests.find(q => q.type === 'steps' && q.category === 'daily');
                    if (stepsQuest) {
                      handleQuestCompletion(stepsQuest, 0);
                    }
                  }}
                  disabled={loading}
                  className="py-2 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white font-bold rounded-xl transition text-xs cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  Zerar Passos
                </button>
              </div>
            </form>
          </div>

          {/* Nutrition card */}
          <div className="glass-panel p-6 rounded-[32px] space-y-4">
            <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Carrot className="w-4 h-4 text-amber-500" />
              Nutrição Saudável
            </h3>
            <button
              type="button"
              onClick={handleCompleteVeggie}
              disabled={loading}
              className={`w-full py-3 border font-bold rounded-2xl transition duration-200 cursor-pointer text-xs flex items-center justify-center gap-2 ${
                quests.find(q => q.type === 'nutrition' && q.category === 'daily')?.completed
                  ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-600/10 border-amber-500/20 text-amber-400 hover:bg-amber-600/20'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              {quests.find(q => q.type === 'nutrition' && q.category === 'daily')?.completed
                ? 'Legumes ingeridos! (+50 XP)'
                : 'Ingeri vegetais hoje'}
            </button>
          </div>

          {/* Log Workout Button */}
          <button
            type="button"
            onClick={() => setShowWorkoutModal(true)}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-violet-600 to-pink-600 hover:scale-[1.02] active:scale-98 text-white font-bold rounded-3xl transition duration-150 cursor-pointer shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2"
          >
            <Dumbbell className="w-5 h-5" /> Registrar Treino Completo
          </button>
        </div>

        {/* Right Side: Quest boards */}
        <div className="md:col-span-2 space-y-6">
          {/* Daily Quests Board */}
          <div className="glass-panel p-6 rounded-[32px] space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-violet-400" />
                Quests Diárias
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full">
                Reseta Diariamente
              </span>
            </div>

            <div className="space-y-4">
              {dailies.map(quest => {
                const progressPct = Math.round((quest.progress / quest.target) * 100);
                return (
                  <div key={quest.id} className={`p-4 rounded-2xl bg-zinc-900/40 border transition duration-200 ${
                    quest.completed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800'
                  }`}>
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${quest.completed ? 'bg-emerald-500/10' : 'bg-zinc-800/80'}`}>
                          {renderIcon(quest.type, quest.completed)}
                        </div>
                        <div>
                          <h4 className={`font-bold text-sm ${quest.completed ? 'text-zinc-300 line-through' : 'text-white'}`}>
                            {quest.title}
                          </h4>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Recompensa: <span className="text-violet-400 font-semibold">+{quest.xpReward} XP</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-bold ${quest.completed ? 'text-emerald-400' : 'text-zinc-400'}`}>
                          {quest.progress} / {quest.target} {quest.unit}
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-zinc-800 h-2 rounded-full mt-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          quest.completed ? 'bg-emerald-500' : 'bg-violet-600'
                        }`}
                        style={{ width: `${Math.min(progressPct, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekly Quests Board */}
          <div className="glass-panel p-6 rounded-[32px] space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Quests Semanais
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                Reseta Domingo
              </span>
            </div>

            <div className="space-y-4">
              {weeklies.map(quest => {
                const progressPct = Math.round((quest.progress / quest.target) * 100);
                return (
                  <div key={quest.id} className={`p-4 rounded-2xl bg-zinc-900/40 border transition duration-200 ${
                    quest.completed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800'
                  }`}>
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${quest.completed ? 'bg-emerald-500/10' : 'bg-zinc-800/80'}`}>
                          {renderIcon(quest.type, quest.completed)}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-white">{quest.title}</h4>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Recompensa: <span className="text-amber-400 font-semibold">+{quest.xpReward} XP</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-bold ${quest.completed ? 'text-emerald-400' : 'text-zinc-400'}`}>
                          {quest.progress} / {quest.target} {quest.unit}
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-zinc-800 h-2 rounded-full mt-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          quest.completed ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(progressPct, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Workout Logging Modal */}
      {showWorkoutModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md p-8 rounded-[32px] space-y-6 relative border border-zinc-700 animate-scale-up">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Dumbbell className="text-violet-400 w-6 h-6" />
              Registrar Treino
            </h3>
            <p className="text-xs text-zinc-400">Insira os detalhes do treino completo para ganhar 100 XP e completar sua missão diária.</p>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tipo de Treino</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'strength', label: 'Força/Musculação' },
                    { id: 'cardio', label: 'Cardio' },
                    { id: 'flexibility', label: 'Alongamento' }
                  ].map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setWorkoutType(type.id)}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition cursor-pointer ${
                        workoutType === type.id
                          ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Duração (Minutos)</label>
                <select
                  value={workoutDuration}
                  onChange={(e) => setWorkoutDuration(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 text-sm"
                >
                  <option value="15">15 Minutos</option>
                  <option value="30">30 Minutos</option>
                  <option value="45">45 Minutos</option>
                  <option value="60">60 Minutos ou mais</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={() => setShowWorkoutModal(false)}
                className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition text-sm cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleLogWorkout}
                className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition text-sm cursor-pointer shadow-lg shadow-violet-600/25"
              >
                Registrar (+100 XP)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
