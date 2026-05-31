import React from 'react';
import { UserProfile, UserMemory, Quest } from '../types';
import { Dumbbell, Flame, Droplet, Footprints, Award, ShieldAlert, Sparkles, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';

interface DashboardProps {
  userProfile: UserProfile;
  userMemory: UserMemory;
  quests: Quest[];
  onNavigateToTab: (tab: string) => void;
}

export default function Dashboard({ userProfile, userMemory, quests, onNavigateToTab }: DashboardProps) {
  
  // Calculate quest completion progress
  const dailyQuests = quests.filter(q => q.category === 'daily');
  const completedDailies = dailyQuests.filter(q => q.completed).length;
  
  const xpProgressPct = Math.round((userProfile.xp / userProfile.xpNeededForNextLevel) * 100);

  // Dynamic advice cards based on AI Coach Memory
  const getDailyRecommendations = () => {
    const list = [];
    const focus = userMemory.goals.focusArea;
    const location = userMemory.preferences.location;
    const isVeg = userMemory.preferences.dietType === 'vegetarian' || userMemory.preferences.dietType === 'vegan';
    const injuries = userMemory.healthConstraints.injuries || [];

    // 1. Workout recommendation
    if (injuries.includes('kneePain')) {
      list.push({
        title: '🛡️ Treino Protetor (Dor no Joelho)',
        desc: 'Para proteger seus joelhos, seu treino recomendado de hoje é de baixo impacto: Caminhada Rápida (30 min) + Fortalecimento de Glúteos/Isquiotibiais.',
        type: 'workout'
      });
    } else if (location === 'home') {
      list.push({
        title: '🏠 Quest Corporal (Treino Calistênico)',
        desc: 'Seu treino de hoje foca em calistenia: 3x10 Flexões + 3x15 Agachamentos + 3x20s Prancha Abdominal.',
        type: 'workout'
      });
    } else if (location === 'gym') {
      list.push({
        title: '🏋️‍♂️ Arena de Ferro (Treino de Academia)',
        desc: 'Foco em força: Supino Reto (4x8) + Puxada Alta (4x10) + Leg Press (4x10). Lembre-se de aquecer antes!',
        type: 'workout'
      });
    } else {
      list.push({
        title: '💬 Escolha seu Campo de Batalha',
        desc: 'Fale com o Coach no chat se prefere treinar em casa ou na academia para receber missões de treino personalizadas.',
        type: 'workout',
        action: 'chat'
      });
    }

    // 2. Nutrition suggestion
    if (isVeg) {
      list.push({
        title: '🥗 Poção de Proteína Vegetal',
        desc: 'Garanta sua recuperação muscular com fontes de proteína limpa: Tofu grelhado com quinoa e brócolis ou omelete de claras com espinafre.',
        type: 'nutrition'
      });
    } else if (focus === 'weightLoss') {
      list.push({
        title: '🍎 Quest de Deficit Calórico',
        desc: 'Para queimar gordura, prefira alimentos de alta saciedade: Filé de frango grelhado, mix de saladas verdes e batata doce assada (porções controladas).',
        type: 'nutrition'
      });
    } else {
      list.push({
        title: '🍳 Alimento do Herói',
        desc: 'Consuma fontes limpas de carboidratos e proteínas em cada refeição. Hidratação abundante é fundamental!',
        type: 'nutrition'
      });
    }

    return list;
  };

  const recs = getDailyRecommendations();

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 animate-fade-in">
      
      {/* Hero: Level, Title, XP bar */}
      <div className="glass-panel p-8 rounded-[36px] relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6 border border-zinc-800">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full filter blur-[50px] pointer-events-none"></div>
        
        <div className="flex items-center gap-5 text-center md:text-left flex-col md:flex-row">
          {/* Circular level badge */}
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-violet-600 to-pink-500 flex items-center justify-center text-white font-extrabold text-3xl shadow-lg shadow-violet-600/25 glow-active-purple">
            {userProfile.level}
          </div>
          
          <div className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">Personagem Ativo</span>
            <h2 className="text-2xl font-extrabold text-white leading-tight">{userProfile.displayName}</h2>
            <p className="text-xs text-violet-400 font-semibold uppercase tracking-wider flex items-center gap-1.5 justify-center md:justify-start">
              <Award className="w-4 h-4" /> {userProfile.title}
            </p>
          </div>
        </div>

        {/* XP progress bar */}
        <div className="w-full md:max-w-md space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-zinc-500 uppercase">Experiência (XP)</span>
            <span className="font-bold text-violet-400">{userProfile.xp} / {userProfile.xpNeededForNextLevel} XP ({xpProgressPct}%)</span>
          </div>
          <div className="w-full bg-zinc-900 border border-zinc-800 h-3.5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-violet-600 to-pink-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(xpProgressPct, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Grid: stats and quests */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Side: Stats and overview */}
        <div className="md:col-span-1 space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Streak card */}
            <div className="glass-panel p-5 rounded-3xl flex flex-col justify-between h-36">
              <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 self-start">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Ofensiva</span>
                <span className="text-2xl font-extrabold text-white mt-1 block">{userProfile.streak} dias</span>
              </div>
            </div>

            {/* Quests progress card */}
            <div className="glass-panel p-5 rounded-3xl flex flex-col justify-between h-36">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 self-start">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Diárias</span>
                <span className="text-2xl font-extrabold text-white mt-1 block">
                  {completedDailies} / {dailyQuests.length}
                </span>
              </div>
            </div>
          </div>

          {/* Active goals card */}
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-pink-400" />
              Metas do Personagem
            </h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex justify-between items-center">
                <span className="text-xs text-zinc-400">Peso Atual</span>
                <span className="font-bold text-zinc-200">
                  {userMemory.goals.currentWeightKg ? `${userMemory.goals.currentWeightKg} kg` : 'Sem registro'}
                </span>
              </div>
              <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex justify-between items-center">
                <span className="text-xs text-zinc-400">Peso Alvo</span>
                <span className="font-bold text-pink-400">
                  {userMemory.goals.targetWeightKg ? `${userMemory.goals.targetWeightKg} kg` : 'Sem registro'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab('analytics')}
                className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-bold rounded-2xl transition duration-150 cursor-pointer text-xs flex items-center justify-center gap-1"
              >
                Atualizar Ficha <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: AI Recommendations and quick quests overview */}
        <div className="md:col-span-2 space-y-6">
          {/* AI Daily Coach advice panel */}
          <div className="glass-panel p-6 rounded-[32px] space-y-6 border border-violet-500/10 bg-gradient-to-tr from-zinc-900/50 to-violet-950/10">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400 animate-pulse" />
                Conselhos do Coach de Hoje
              </h2>
              <button
                type="button"
                onClick={() => onNavigateToTab('chat')}
                className="text-xs font-semibold text-violet-400 hover:underline flex items-center gap-0.5"
              >
                Falar no Chat <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4">
              {recs.map((rec, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                  <h4 className="font-bold text-sm text-zinc-100 flex items-center gap-2">{rec.title}</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">{rec.desc}</p>
                  
                  {rec.action === 'chat' && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('chat')}
                      className="px-4 py-1.5 bg-violet-600/10 border border-violet-500/20 text-violet-400 text-xs font-bold rounded-xl hover:bg-violet-600/20 transition cursor-pointer mt-1"
                    >
                      Bater papo com Coach
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Active Quests overview */}
          <div className="glass-panel p-6 rounded-[32px] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Objetivos Pendentes de Hoje
              </h3>
              <button
                type="button"
                onClick={() => onNavigateToTab('quests')}
                className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-0.5"
              >
                Ir para Mural <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {dailyQuests.filter(q => !q.completed).length === 0 ? (
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-xs font-bold text-center">
                  🎉 Todas as quests diárias concluídas! Bom trabalho!
                </div>
              ) : (
                dailyQuests.filter(q => !q.completed).map(quest => (
                  <div key={quest.id} className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-2xl flex justify-between items-center text-xs">
                    <span className="font-semibold text-zinc-300">{quest.title}</span>
                    <span className="font-bold text-violet-400">+{quest.xpReward} XP</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
