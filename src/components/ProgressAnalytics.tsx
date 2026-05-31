import React, { useState, useEffect } from 'react';
import { UserProfile, UserMemory, ProgressLog } from '../types';
import { getProgressLogs, saveProgressLog, getProgressLogForDate, saveUserMemory, getQuests, saveQuest } from '../services/dbService';
import { awardXp } from '../services/rpgService';
import { checkLevelUp, getTitleForLevel } from '../utils/xpCalc';
import { getLocalDateString } from '../utils/dateUtils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import { Scale, Calendar, ChevronRight, Activity, TrendingDown, Target, HelpCircle } from 'lucide-react';

interface AnalyticsProps {
  userProfile: UserProfile;
  userMemory: UserMemory;
  onWeightLogged: (updatedProfile: UserProfile, updatedMemory: UserMemory, unlockedAchs: any[]) => void;
}

export default function ProgressAnalytics({ userProfile, userMemory, onWeightLogged }: AnalyticsProps) {
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [loading, setLoading] = useState(false);

  const todayStr = getLocalDateString();

  useEffect(() => {
    getProgressLogs(userProfile.uid).then(setLogs);
  }, [userProfile.uid]);

  const handleLogWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const weightVal = parseFloat(weightInput);
    if (isNaN(weightVal) || weightVal <= 0) return;

    try {
      // 1. Calculate local progress log update immediately
      const existingLog = logs.find(l => l.date === todayStr) || {
        id: `${todayStr}_log`,
        date: todayStr,
        waterIntakeMl: 0,
        workoutCompleted: false,
        stepsCompleted: 0,
        xpEarned: 0
      };
      
      const updatedLog: ProgressLog = {
        ...existingLog,
        weight: weightVal
      };

      // 2. Compute updated logs list
      const logIdx = logs.findIndex(l => l.date === todayStr);
      let updatedLogs = [...logs];
      if (logIdx !== -1) {
        updatedLogs[logIdx] = updatedLog;
      } else {
        updatedLogs.push(updatedLog);
      }
      updatedLogs.sort((a, b) => a.date.localeCompare(b.date));

      // 3. Update memory locally
      const updatedMemory: UserMemory = {
        ...userMemory,
        goals: {
          ...userMemory.goals,
          currentWeightKg: weightVal
        },
        lastUpdated: new Date().toISOString()
      };

      // 4. Calculate local profile updates immediately (+50 XP)
      const updatedXp = userProfile.xp + 50;
      const levelCheck = checkLevelUp(userProfile.level, updatedXp);
      const localUpdatedProfile: UserProfile = {
        ...userProfile,
        level: levelCheck.newLevel,
        xp: levelCheck.remainingXp,
        xpNeededForNextLevel: levelCheck.xpNeeded,
        title: getTitleForLevel(levelCheck.newLevel)
      };

      // 5. Update local component state immediately
      setLogs(updatedLogs);
      setWeightInput('');

      // 6. Propagate to parent state immediately
      onWeightLogged(localUpdatedProfile, updatedMemory, []);

      // 7. Fire off background saves (async, non-blocking)
      (async () => {
        try {
          await saveProgressLog(userProfile.uid, updatedLog);
          await saveUserMemory(userProfile.uid, updatedMemory);

          // Recalculate water target (35ml/kg) and save quest in background
          const newWaterTarget = Math.max(1500, Math.min(Math.round(weightVal * 35), 4500));
          const activeQuests = await getQuests(userProfile.uid);
          const waterQuestIdx = activeQuests.findIndex(q => q.type === 'water' && q.category === 'daily');
          if (waterQuestIdx !== -1) {
            const waterQuest = activeQuests[waterQuestIdx];
            if (!waterQuest.completed) {
              waterQuest.target = newWaterTarget;
              waterQuest.title = `Beber ${(newWaterTarget / 1000).toFixed(1).replace('.0', '')}L de Água`;
              await saveQuest(userProfile.uid, waterQuest);
            }
          }

          // Award XP on database
          const res = await awardXp(userProfile.uid, userProfile, 50, 'weight');
          onWeightLogged(res.profile, updatedMemory, res.unlockedAchievements);
        } catch (err) {
          console.error('Background log weight failed:', err);
        }
      })();
    } catch (err) {
      console.error('Failed to log weight (optimistic):', err);
    }
  };

  const handleRemoveTodayWeight = () => {
    try {
      // 1. Remove weight locally from logs
      const logIdx = logs.findIndex(l => l.date === todayStr);
      let updatedLogs = [...logs];
      let todayLogCopy = logs.find(l => l.date === todayStr);
      
      if (todayLogCopy) {
        const updatedToday = { ...todayLogCopy };
        delete updatedToday.weight;
        if (logIdx !== -1) {
          updatedLogs[logIdx] = updatedToday;
        }
      }

      // 2. Find previous weight to restore
      const previousLogsWithWeight = updatedLogs
        .filter(l => l.date !== todayStr && l.weight !== undefined)
        .sort((a, b) => b.date.localeCompare(a.date));
      const prevWeight = previousLogsWithWeight.length > 0 ? previousLogsWithWeight[0].weight : undefined;

      // 3. Update memory locally
      const updatedMemory: UserMemory = {
        ...userMemory,
        goals: {
          ...userMemory.goals,
          currentWeightKg: prevWeight
        },
        lastUpdated: new Date().toISOString()
      };

      // 4. Update local state immediately
      setLogs(updatedLogs);

      // 5. Notify parent immediately
      onWeightLogged(userProfile, updatedMemory, []);

      // 6. Run saves in background (async, non-blocking)
      (async () => {
        try {
          const log = await getProgressLogForDate(userProfile.uid, todayStr);
          const updatedLog = { ...log };
          delete updatedLog.weight;
          await saveProgressLog(userProfile.uid, updatedLog);
          await saveUserMemory(userProfile.uid, updatedMemory);
        } catch (err) {
          console.error('Background remove weight failed:', err);
        }
      })();
    } catch (err) {
      console.error('Failed to remove weight (optimistic):', err);
    }
  };

  // Timeline Projections calculations
  const calculateTimeline = () => {
    const current = userMemory.goals.currentWeightKg;
    const target = userMemory.goals.targetWeightKg || 70;
    const weeklyRate = userMemory.goals.weeklyWeightLossTargetKg || 0.5;

    if (!current) {
      return {
        completedPct: 0,
        weeksNeeded: null,
        targetDate: 'Defina seu peso atual',
        projections: [],
        notLogged: true,
        weeklyRateUsed: weeklyRate,
        isActualRate: false
      };
    }

    const isWeightLoss = target < current;
    const reached = isWeightLoss ? current <= target : current >= target;

    if (reached) {
      return {
        completedPct: 100,
        weeksNeeded: 0,
        targetDate: 'Atingido!',
        projections: [],
        weeklyRateUsed: weeklyRate,
        isActualRate: false
      };
    }

    // Calculate actual weekly rate from logs if we have at least 2 logs with different dates and weights
    let actualWeeklyRate = weeklyRate;
    let isActualRate = false;
    
    const logsWithWeightSorted = logs
      .filter(l => l.weight !== undefined)
      .sort((a, b) => a.date.localeCompare(b.date)); // sorted ascending (oldest first)

    if (logsWithWeightSorted.length >= 2) {
      const oldestLog = logsWithWeightSorted[0];
      const newestLog = logsWithWeightSorted[logsWithWeightSorted.length - 1];
      
      const oldestWeight = oldestLog.weight!;
      const newestWeight = newestLog.weight!;
      
      const timeDiffMs = new Date(newestLog.date).getTime() - new Date(oldestLog.date).getTime();
      const daysDiff = timeDiffMs / (1000 * 60 * 60 * 24);
      
      if (daysDiff >= 3) { // Must be at least 3 days apart to show a real rate
        const totalWeightChange = Math.abs(oldestWeight - newestWeight);
        const dailyRate = totalWeightChange / daysDiff;
        const computedWeeklyRate = dailyRate * 7;
        
        if (computedWeeklyRate > 0.05) { // Only use if there is a noticeable change rate
          actualWeeklyRate = Math.round(computedWeeklyRate * 100) / 100;
          isActualRate = true;
        }
      }
    }

    const diff = Math.abs(current - target);
    const weeksNeeded = Math.ceil(diff / actualWeeklyRate);
    
    // Estimate target date
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + weeksNeeded * 7);
    const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const dateFormatted = targetDate.toLocaleDateString('pt-BR', dateOptions);

    // Initial weight reference
    const initialWeightLog = logs.find(l => l.weight !== undefined);
    const initialWeight = initialWeightLog && initialWeightLog.weight ? initialWeightLog.weight : current;
    const totalChangeNeeded = Math.abs(initialWeight - target);
    const changeAchieved = Math.abs(initialWeight - current);
    const completedPct = totalChangeNeeded > 0 ? Math.round((changeAchieved / totalChangeNeeded) * 100) : 0;

    // Generate weekly projections list
    const projections = [];
    let tempWeight = current;
    for (let i = 1; i <= Math.min(weeksNeeded, 8); i++) {
      if (isWeightLoss) {
        tempWeight = Math.max(tempWeight - actualWeeklyRate, target);
      } else {
        tempWeight = Math.min(tempWeight + actualWeeklyRate, target);
      }
      const projDate = new Date();
      projDate.setDate(projDate.getDate() + i * 7);
      projections.push({
        week: `Semana ${i}`,
        weight: tempWeight.toFixed(1),
        date: projDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
      });
    }

    return {
      completedPct: Math.min(Math.max(completedPct, 0), 100),
      weeksNeeded,
      targetDate: dateFormatted,
      projections,
      weeklyRateUsed: actualWeeklyRate,
      isActualRate
    };
  };

  const timeline = calculateTimeline();

  // Prepare chart data (Filter logs that have weight or water value)
  const weightChartData = logs
    .filter(l => l.weight !== undefined)
    .map(l => ({
      name: new Date(l.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }),
      peso: l.weight
    }));

  const waterChartData = logs.map(l => ({
    name: new Date(l.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }),
    água: l.waterIntakeMl
  }));

  const stepsChartData = logs.map(l => ({
    name: new Date(l.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }),
    passos: l.stepsCompleted
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Análise de Progresso</h1>
        <p className="text-zinc-400">Monitore sua evolução corporal, hábitos de hidratação e metas de saúde.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Logging and weight timeline */}
        <div className="lg:col-span-1 space-y-6">
          {/* Log weight card */}
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-4 h-4 text-violet-400" />
              Balança do Herói
            </h3>
            <p className="text-xs text-zinc-400">Registre seu peso corporal hoje para atualizar a linha do tempo de evolução.</p>
            <form onSubmit={handleLogWeight} className="space-y-3">
              <input
                type="number"
                step="0.1"
                placeholder="Ex: 78.4 kg"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                required
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !weightInput}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition duration-150 cursor-pointer text-xs shadow-lg shadow-violet-600/10"
              >
                Registrar Peso (+50 XP)
              </button>
            </form>
            {(() => {
              const todayLog = logs.find(l => l.date === todayStr);
              const hasTodayWeight = todayLog && todayLog.weight !== undefined;
              if (hasTodayWeight) {
                return (
                  <button
                    type="button"
                    onClick={handleRemoveTodayWeight}
                    disabled={loading}
                    className="w-full py-2.5 bg-red-600/15 border border-red-500/20 text-red-400 hover:text-white font-bold rounded-xl transition duration-150 hover:bg-red-600/25 cursor-pointer text-xs"
                  >
                    Remover Peso de Hoje
                  </button>
                );
              }
              return null;
            })()}
          </div>

          {/* Timeline & projections card */}
          <div className="glass-panel p-6 rounded-3xl space-y-5">
            <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-pink-400" />
              Projeção da Jornada
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <div>
                  <span className="text-xs font-bold text-zinc-500 uppercase">Previsão de Conclusão</span>
                  <p className="text-sm font-extrabold text-white mt-0.5">{timeline.targetDate}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-zinc-500 uppercase">Semanas Faltantes</span>
                  <p className="text-sm font-extrabold text-pink-400 mt-0.5">
                    {timeline.weeksNeeded !== null ? `${timeline.weeksNeeded} semanas` : '--'}
                  </p>
                </div>
              </div>

              {timeline.weeksNeeded !== null && timeline.weeksNeeded > 0 && (
                <div className="text-[10px] text-zinc-500 text-center font-medium leading-relaxed bg-zinc-900/30 p-2 rounded-xl border border-zinc-850">
                  Projeção a um ritmo de{' '}
                  <strong className="text-pink-400">{timeline.weeklyRateUsed.toFixed(2)} kg/semana</strong>
                  {timeline.isActualRate ? ' (calculado dos seus registros reais)' : ' (meta padrão)'}
                </div>
              )}

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-500">Progresso Geral</span>
                  <span className="font-bold text-pink-400">{timeline.completedPct}%</span>
                </div>
                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-600 to-pink-500 rounded-full transition-all duration-300"
                    style={{ width: `${timeline.completedPct}%` }}
                  ></div>
                </div>
              </div>

              {/* Projections List */}
              <div className="space-y-2 pt-2 border-t border-zinc-900">
                <span className="text-xs font-bold text-zinc-500 uppercase block">Próximos Marcos Projetados</span>
                {timeline.projections.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">
                    {timeline.notLogged 
                      ? 'Registre seu peso ao lado para calcular as projeções.'
                      : 'Meta já atingida! Mantenha a consistência.'}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {timeline.projections.map((proj, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs py-1.5 border-b border-zinc-900 last:border-b-0">
                        <span className="font-medium text-zinc-400">{proj.week} ({proj.date})</span>
                        <span className="font-bold text-zinc-200">{proj.weight} kg</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Graphs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Weight log chart */}
          <div className="glass-panel p-6 rounded-[32px] space-y-4">
            <h3 className="font-bold text-sm text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-violet-400" />
              Evolução de Peso (kg)
            </h3>
            <div className="h-[200px] w-full">
              {weightChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-600 text-xs italic">
                  Nenhum registro de peso encontrado. Insira seu peso ao lado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                    <YAxis stroke="#71717a" fontSize={11} domain={['dataMin - 2', 'dataMax + 2']} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', fontSize: '12px' }} />
                    <Line type="monotone" dataKey="peso" stroke="#8b5cf6" strokeWidth={3} dot={{ fill: '#8b5cf6', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Water log chart */}
          <div className="glass-panel p-6 rounded-[32px] space-y-4">
            <h3 className="font-bold text-sm text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              Consumo de Água (ml)
            </h3>
            <div className="h-[180px] w-full">
              {waterChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-600 text-xs italic">
                  Nenhum registro de hidratação encontrado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                    <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="água" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
