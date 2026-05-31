import React, { useState, useEffect } from 'react';
import { UserProfile, UserMemory, ProgressLog } from '../types';
import { getProgressLogs, saveProgressLog, getProgressLogForDate, saveUserMemory, getQuests, saveQuest } from '../services/dbService';
import { awardXp } from '../services/rpgService';
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

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    getProgressLogs(userProfile.uid).then(setLogs);
  }, [userProfile.uid]);

  const handleLogWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightVal = parseFloat(weightInput);
    if (isNaN(weightVal) || weightVal <= 0) return;

    setLoading(true);
    try {
      // Save weight in today's log
      const log = await getProgressLogForDate(userProfile.uid, todayStr);
      const updatedLog: ProgressLog = {
        ...log,
        weight: weightVal
      };
      await saveProgressLog(userProfile.uid, updatedLog);

      // Save current weight in user memory goals
      const updatedMemory: UserMemory = {
        ...userMemory,
        goals: {
          ...userMemory.goals,
          currentWeightKg: weightVal
        },
        lastUpdated: new Date().toISOString()
      };
      await saveUserMemory(userProfile.uid, updatedMemory);

      // Recalculate water target (35ml/kg)
      const newWaterTarget = Math.max(1500, Math.min(Math.round(weightVal * 35), 4500));
      
      // Update active water quest target if it exists and is not completed
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

      // Award XP for logging weight (+50 XP)
      const res = await awardXp(userProfile.uid, userProfile, 50, 'weight');

      // Check weight achievement (if target reached)
      // E.g., if target exists and weight is <= target
      const target = userMemory.goals.targetWeightKg;
      
      // Update local logs list
      const updatedLogs = await getProgressLogs(userProfile.uid);
      setLogs(updatedLogs);
      setWeightInput('');

      onWeightLogged(res.profile, updatedMemory, res.unlockedAchievements);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Timeline Projections calculations
  const calculateTimeline = () => {
    const current = userMemory.goals.currentWeightKg || userMemory.goals.targetWeightKg || 80;
    const target = userMemory.goals.targetWeightKg || 70;
    const weeklyRate = userMemory.goals.weeklyWeightLossTargetKg || 0.5;

    if (current <= target) {
      return {
        completedPct: 100,
        weeksNeeded: 0,
        targetDate: 'Atingido!',
        projections: []
      };
    }

    const diff = current - target;
    const weeksNeeded = Math.ceil(diff / weeklyRate);
    
    // Estimate target date
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + weeksNeeded * 7);
    const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const dateFormatted = targetDate.toLocaleDateString('pt-BR', dateOptions);

    // Initial weight loss reference (max 100kg delta)
    const initialWeight = logs.length > 0 && logs[0].weight ? logs[0].weight : current + 5;
    const totalToLose = Math.max(initialWeight - target, 1);
    const totalLost = Math.max(initialWeight - current, 0);
    const completedPct = Math.round((totalLost / totalToLose) * 100);

    // Generate weekly projections list
    const projections = [];
    let tempWeight = current;
    for (let i = 1; i <= Math.min(weeksNeeded, 8); i++) {
      tempWeight = Math.max(tempWeight - weeklyRate, target);
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
      projections
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
                  <p className="text-sm font-extrabold text-pink-400 mt-0.5">{timeline.weeksNeeded} semanas</p>
                </div>
              </div>

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
                  <p className="text-xs text-zinc-500 italic">Meta já atingida! Mantenha a consistência.</p>
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
