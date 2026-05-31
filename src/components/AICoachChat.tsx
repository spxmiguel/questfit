import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, UserMemory, UserProfile, Quest, ProgressLog } from '../types';
import { getChatHistory, addChatMessage, clearChatHistory, saveUserMemory, getProgressLogForDate, saveProgressLog, saveQuest } from '../services/dbService';
import { sendChatMessageToCoach } from '../services/aiService';
import { awardXp } from '../services/rpgService';
import { MessageSquare, Send, BrainCircuit, RefreshCw, Sparkles, User, UserCheck, ShieldAlert, Heart, Scale, Dumbbell, Calendar } from 'lucide-react';

interface AICoachChatProps {
  userProfile: UserProfile;
  userMemory: UserMemory;
  quests: Quest[];
  onMemoryUpdate: (newMemory: UserMemory, updatedProfile?: UserProfile, unlockedAchs?: any[]) => void;
  onQuestUpdate: (updatedQuests: Quest[], updatedProfile: UserProfile, unlockedAchs: any[]) => void;
}

export default function AICoachChat({ userProfile, userMemory, quests, onMemoryUpdate, onQuestUpdate }: AICoachChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [memoryNotification, setMemoryNotification] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load chat history
    getChatHistory(userProfile.uid).then(setMessages);
  }, [userProfile.uid]);

  useEffect(() => {
    // Scroll to bottom when messages load/change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || loading) return;

    setInputText('');
    setLoading(true);

    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString()
    };

    // Render immediately in state and save
    setMessages(prev => [...prev, userMsg]);
    await addChatMessage(userProfile.uid, userMsg);

    try {
      // 1. Fetch latest today's log to supply to the prompt
      const todayStr = new Date().toISOString().split('T')[0];
      const todayLog = await getProgressLogForDate(userProfile.uid, todayStr);

      // 2. Send chat context to Gemini / Mock Coach
      const response = await sendChatMessageToCoach(text, messages, userMemory, todayLog);

      // Create AI ChatMessage
      const aiMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: 'ai',
        text: response.text,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMsg]);
      await addChatMessage(userProfile.uid, aiMsg);

      let finalProfile = userProfile;
      let finalMemory = userMemory;
      let finalQuests = [...quests];
      let newlyUnlockedAchs: any[] = [];
      let updateMade = false;
      let notifTextStr = '';

      // 3. Handle memory updates if extracted by Gemini
      if (response.memoryUpdate) {
        // Deep merge logic
        finalMemory = {
          ...userMemory,
          goals: { ...userMemory.goals, ...response.memoryUpdate.goals },
          preferences: { ...userMemory.preferences, ...response.memoryUpdate.preferences },
          healthConstraints: { ...userMemory.healthConstraints, ...response.memoryUpdate.healthConstraints },
          schedule: { ...userMemory.schedule, ...response.memoryUpdate.schedule },
          lastUpdated: new Date().toISOString()
        };

        await saveUserMemory(userProfile.uid, finalMemory);
        updateMade = true;

        // Notify user of profile extraction
        notifTextStr = 'Ficha de personagem atualizada pelo Coach!';
        if (response.memoryUpdate.healthConstraints?.injuries) {
          notifTextStr = `Lesão registrada: ${response.memoryUpdate.healthConstraints.injuries.join(', ')}`;
        } else if (response.memoryUpdate.preferences?.location) {
          notifTextStr = `Preferência de treino salva: ${response.memoryUpdate.preferences.location === 'home' ? 'Em Casa' : 'Na Academia'}`;
        } else if (response.memoryUpdate.preferences?.equipment) {
          notifTextStr = 'Lista de equipamentos domésticos atualizada!';
        } else if (response.memoryUpdate.goals?.focusArea) {
          notifTextStr = 'Foco de treinamento atualizado!';
        }
      }

      // 4. Handle daily progress log updates from AI Coach
      if (response.logUpdate) {
        const mergedLog: ProgressLog = {
          ...todayLog,
          ...response.logUpdate
        };

        // Ensure values are bounded
        if (mergedLog.waterIntakeMl !== undefined) mergedLog.waterIntakeMl = Math.max(0, mergedLog.waterIntakeMl);
        if (mergedLog.caloriesConsumed !== undefined) mergedLog.caloriesConsumed = Math.max(0, mergedLog.caloriesConsumed);
        if (mergedLog.proteinConsumedG !== undefined) mergedLog.proteinConsumedG = Math.max(0, mergedLog.proteinConsumedG);
        if (mergedLog.stepsCompleted !== undefined) mergedLog.stepsCompleted = Math.max(0, mergedLog.stepsCompleted);

        await saveProgressLog(userProfile.uid, mergedLog);
        updateMade = true;

        if (!notifTextStr) {
          notifTextStr = 'Diário do dia atualizado pelo Coach!';
          if (response.logUpdate.waterIntakeMl !== undefined && response.logUpdate.waterIntakeMl !== todayLog.waterIntakeMl) {
            notifTextStr = `Hidratação registrada: ${response.logUpdate.waterIntakeMl} ml!`;
          } else if (response.logUpdate.caloriesConsumed !== undefined && response.logUpdate.caloriesConsumed !== todayLog.caloriesConsumed) {
            notifTextStr = `Nutrição diária registrada: ${response.logUpdate.caloriesConsumed} kcal!`;
          } else if (response.logUpdate.stepsCompleted !== undefined && response.logUpdate.stepsCompleted !== todayLog.stepsCompleted) {
            notifTextStr = `Passos salvos hoje: ${response.logUpdate.stepsCompleted}!`;
          }
        }

        // Update corresponding daily quests
        if (response.logUpdate.waterIntakeMl !== undefined) {
          const waterQuestIdx = finalQuests.findIndex(q => q.type === 'water' && q.category === 'daily');
          if (waterQuestIdx !== -1) {
            const waterQuest = finalQuests[waterQuestIdx];
            const isNowCompleted = response.logUpdate.waterIntakeMl >= waterQuest.target;
            const wasCompleted = waterQuest.completed;
            const updatedQuest = {
              ...waterQuest,
              progress: Math.min(response.logUpdate.waterIntakeMl, waterQuest.target),
              completed: isNowCompleted,
              completedDate: isNowCompleted ? new Date().toISOString() : undefined
            };
            await saveQuest(userProfile.uid, updatedQuest);
            finalQuests[waterQuestIdx] = updatedQuest;

            if (isNowCompleted && !wasCompleted) {
              const res = await awardXp(userProfile.uid, finalProfile, waterQuest.xpReward, 'quest');
              finalProfile = res.profile;
              newlyUnlockedAchs = [...newlyUnlockedAchs, ...res.unlockedAchievements];
            }
          }
        }

        if (response.logUpdate.stepsCompleted !== undefined) {
          const stepsQuestIdx = finalQuests.findIndex(q => q.type === 'steps' && q.category === 'daily');
          if (stepsQuestIdx !== -1) {
            const stepsQuest = finalQuests[stepsQuestIdx];
            const isNowCompleted = response.logUpdate.stepsCompleted >= stepsQuest.target;
            const wasCompleted = stepsQuest.completed;
            const updatedQuest = {
              ...stepsQuest,
              progress: Math.min(response.logUpdate.stepsCompleted, stepsQuest.target),
              completed: isNowCompleted,
              completedDate: isNowCompleted ? new Date().toISOString() : undefined
            };
            await saveQuest(userProfile.uid, updatedQuest);
            finalQuests[stepsQuestIdx] = updatedQuest;

            if (isNowCompleted && !wasCompleted) {
              const res = await awardXp(userProfile.uid, finalProfile, stepsQuest.xpReward, 'quest');
              finalProfile = res.profile;
              newlyUnlockedAchs = [...newlyUnlockedAchs, ...res.unlockedAchievements];
            }
          }
        }
      }

      if (updateMade) {
        setMemoryNotification(notifTextStr);
        setTimeout(() => setMemoryNotification(null), 5000);

        // Talk to coach awards 0 XP (as requested to prevent level exploits)
        const rpgRes = await awardXp(userProfile.uid, finalProfile, 0, 'quest');
        
        onMemoryUpdate(finalMemory, rpgRes.profile, [...newlyUnlockedAchs, ...rpgRes.unlockedAchievements]);
        onQuestUpdate(finalQuests, rpgRes.profile, [...newlyUnlockedAchs, ...rpgRes.unlockedAchievements]);
      }
    } catch (err: any) {
      const errSystemMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        sender: 'ai',
        text: `⚠️ Ops! Ocorreu um erro ao falar com o Coach: ${err.message}. Por favor, verifique sua chave de API nas configurações ou tente novamente.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errSystemMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (window.confirm('Deseja limpar todo o histórico de conversas com o Coach?')) {
      await clearChatHistory(userProfile.uid);
      setMessages([]);
    }
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6 p-4 h-[calc(100vh-130px)]">
      {/* Sidebar: AI Memory Inspector */}
      <div className="lg:col-span-1 glass-panel p-6 rounded-3xl flex flex-col gap-6 overflow-y-auto h-full max-h-[250px] lg:max-h-none">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-violet-400" />
          <h2 className="font-bold text-sm text-zinc-300 uppercase tracking-wider">Memória do Coach</h2>
        </div>
 
        <div className="space-y-4 text-sm">
          {/* Goals */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-pink-400" /> Objetivo
            </h4>
            <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-1">
              {userMemory.goals.focusArea ? (
                <>
                  <p className="text-zinc-200 font-semibold text-xs">
                    {userMemory.goals.focusArea === 'weightLoss' && 'Perda de Peso'}
                    {userMemory.goals.focusArea === 'muscleGain' && 'Ganho Muscular'}
                    {userMemory.goals.focusArea === 'endurance' && 'Resistência Física'}
                    {userMemory.goals.focusArea === 'health' && 'Saúde Geral'}
                  </p>
                  {userMemory.goals.targetWeightKg && (
                    <p className="text-zinc-400 text-xs">Meta: {userMemory.goals.targetWeightKg} kg</p>
                  )}
                </>
              ) : (
                <p className="text-zinc-500 text-xs italic">Nenhum foco definido. Diga ao Coach!</p>
              )}
            </div>
          </div>

          {/* Preferences */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1">
              <Dumbbell className="w-3.5 h-3.5 text-violet-400" /> Preferências
            </h4>
            <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-1.5 flex flex-col gap-1">
              {userMemory.preferences.location || userMemory.preferences.dietType || (userMemory.preferences.equipment && userMemory.preferences.equipment.length > 0) ? (
                <>
                  {userMemory.preferences.location && (
                    <p className="text-zinc-200 font-semibold text-xs">
                      Local: {userMemory.preferences.location === 'home' ? 'Em Casa' : 'Na Academia'}
                    </p>
                  )}
                  {userMemory.preferences.dietType && (
                    <p className="text-zinc-400 text-xs">
                      Dieta: {
                        userMemory.preferences.dietType === 'omnivore' ? 'Onívora' :
                        userMemory.preferences.dietType === 'vegetarian' ? 'Vegetariana' :
                        userMemory.preferences.dietType === 'vegan' ? 'Vegana' :
                        userMemory.preferences.dietType === 'carnivore' ? 'Carnívora' :
                        userMemory.preferences.dietType === 'keto' ? 'Cetogênica' :
                        userMemory.preferences.dietType === 'lowcarb' ? 'Low Carb' :
                        userMemory.preferences.dietType
                      }
                    </p>
                  )}
                  {userMemory.preferences.equipment && userMemory.preferences.equipment.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">Equipamentos:</span>
                      <div className="flex flex-wrap gap-1">
                        {userMemory.preferences.equipment.map((eq, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 text-[10px] rounded border border-zinc-700 font-medium capitalize">
                            {eq === 'bodyweight' ? 'calistenia' : eq}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-zinc-500 text-xs italic">Nenhuma preferência salva.</p>
              )}
            </div>
          </div>

          {/* Constraints */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-rose-500" /> Restrições Médicas
            </h4>
            <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
              {userMemory.healthConstraints.injuries && userMemory.healthConstraints.injuries.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {userMemory.healthConstraints.injuries.map((inj, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold rounded-lg uppercase tracking-wide">
                      {inj === 'kneePain' && 'Dor no Joelho'}
                      {inj === 'backPain' && 'Dor Lombar'}
                      {inj !== 'kneePain' && inj !== 'backPain' && inj}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 text-xs italic">Sem limitações registradas.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="lg:col-span-3 glass-panel rounded-[32px] overflow-hidden flex flex-col h-full border border-zinc-800 relative">
        {/* Chat Header */}
        <div className="px-6 py-4 bg-zinc-900/80 border-b border-zinc-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-pink-600 flex items-center justify-center text-white font-bold relative shadow-lg shadow-violet-600/10">
              <BrainCircuit className="w-5 h-5" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-zinc-900 rounded-full"></div>
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                QuestFit AI Coach
              </h3>
              <p className="text-xs text-zinc-400">Personal Trainer & Nutricionista</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearChat}
            disabled={messages.length === 0}
            className="p-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition duration-150 cursor-pointer disabled:opacity-40"
            title="Limpar histórico de chat"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Memory updates notifications banner */}
        {memoryNotification && (
          <div className="absolute top-[72px] inset-x-0 mx-4 p-3 bg-violet-600 text-white text-xs font-semibold rounded-2xl shadow-xl flex items-center gap-2 z-20 animate-slide-down">
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>{memoryNotification}</span>
          </div>
        )}

        {/* Messages list */}
        <div className="flex-grow p-6 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 max-w-sm mx-auto">
              <div className="p-4 rounded-3xl bg-zinc-900/50 border border-zinc-800 text-zinc-500">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-zinc-300 text-sm">Inicie a conversa!</h4>
              <p className="text-zinc-500 text-xs leading-normal">
                Diga um "Olá" ao Coach para iniciar seu planejamento de treinos e dieta. Compartilhe suas metas e restrições!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isAi = msg.sender === 'ai';
              return (
                <div key={msg.id} className={`flex gap-3 max-w-[85%] ${isAi ? 'self-start' : 'ml-auto flex-row-reverse'}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    isAi ? 'bg-gradient-to-tr from-violet-600 to-pink-600 text-white' : 'bg-zinc-800 text-zinc-300'
                  }`}>
                    {isAi ? <BrainCircuit className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    isAi 
                      ? 'bg-zinc-900 border border-zinc-800/80 text-zinc-200' 
                      : 'bg-violet-600 text-white'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}

          {loading && (
            <div className="flex gap-3 max-w-[80%] self-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-pink-600 text-white flex items-center justify-center text-xs font-bold animate-pulse">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-2xl flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2.5 h-2.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2.5 h-2.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef}></div>
        </div>

        {/* Input box form */}
        <form onSubmit={handleSendMessage} className="p-4 bg-zinc-900/60 border-t border-zinc-800 flex gap-3 items-center">
          <input
            type="text"
            className="flex-grow bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder-zinc-500 text-sm"
            placeholder="Fale com seu Coach sobre treinos, dores ou dieta..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !inputText.trim()}
            className="p-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-2xl transition duration-150 cursor-pointer shadow-lg shadow-violet-600/10 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Safety caution text */}
        <div className="px-6 py-2.5 bg-zinc-950 border-t border-zinc-900 text-center text-[10px] text-zinc-500 flex items-center justify-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-zinc-500" />
          <span>Isenção de responsabilidade: A IA fornece sugestões e diretrizes baseadas em RPG. Sempre consulte um profissional de saúde.</span>
        </div>
      </div>
    </div>
  );
}
