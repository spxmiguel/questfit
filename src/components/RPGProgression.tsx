import React from 'react';
import { UserProfile, Achievement } from '../types';
import { getTitleForLevel, getXpNeededForLevel } from '../utils/xpCalc';
import { Award, CheckCircle, Dumbbell, Flame, Scale, ShieldAlert, Sparkles, Lock, Trophy } from 'lucide-react';

interface ProgressionProps {
  userProfile: UserProfile;
  achievements: Achievement[];
}

export default function RPGProgression({ userProfile, achievements }: ProgressionProps) {
  
  const renderIcon = (iconName: string, unlocked: boolean) => {
    const size = 24;
    const color = unlocked ? 'text-amber-400' : 'text-zinc-600';
    
    switch (iconName) {
      case 'CheckCircle': return <CheckCircle size={size} className={color} />;
      case 'Dumbbell': return <Dumbbell size={size} className={color} />;
      case 'Flame': return <Flame size={size} className={color} />;
      case 'Award': return <Award size={size} className={color} />;
      case 'Scale': return <Scale size={size} className={color} />;
      case 'ShieldAlert': return <ShieldAlert size={size} className={color} />;
      default: return <Trophy size={size} className={color} />;
    }
  };

  // Define RPG tiers
  const tiers = [
    { title: 'Iniciante', levelRange: 'Lv. 1 - 4', desc: 'Começando a jornada RPG fitness, descobrindo novos hábitos.' },
    { title: 'Escudeiro', levelRange: 'Lv. 5 - 9', desc: 'Mantendo consistência básica, preparando sua força.' },
    { title: 'Aventureiro', levelRange: 'Lv. 10 - 14', desc: 'Explorando novas rotinas de treinos e alimentação saudável.' },
    { title: 'Guerreiro', levelRange: 'Lv. 15 - 24', desc: 'Alta disciplina. O ferro se tornou seu aliado diário.' },
    { title: 'Campeão Elite', levelRange: 'Lv. 25 - 39', desc: 'Foco impecável. Inspirando outros personagens na guilda.' },
    { title: 'Mestre da Disciplina', levelRange: 'Lv. 40 - 59', desc: 'Dedicação mental e física lendária. O hábito é sua armadura.' },
    { title: 'Lenda do QuestFit', levelRange: 'Lv. 60+', desc: 'Ascensão suprema do herói. Status físico e mental incomparável.' }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Caminho da Ascensão</h1>
        <p className="text-zinc-400">Acompanhe suas conquistas desbloqueadas e os títulos da sua jornada de herói.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Current title & tier rules */}
        <div className="lg:col-span-1 space-y-6">
          {/* Current Tier status */}
          <div className="glass-panel p-6 rounded-[32px] text-center space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full filter blur-xl pointer-events-none"></div>
            
            <div className="inline-flex p-4 rounded-3xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-2">
              <Trophy className="w-8 h-8" />
            </div>
            
            <div>
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Título Atual</span>
              <h2 className="text-2xl font-extrabold text-white mt-1">{userProfile.title}</h2>
              <p className="text-xs text-amber-400 font-semibold mt-1">Nível {userProfile.level}</p>
            </div>
            
            <div className="pt-4 border-t border-zinc-900 text-xs text-zinc-400 leading-relaxed">
              Suba de nível completando treinos e missões diárias para desbloquear novos títulos lendários.
            </div>
          </div>

          {/* Titles List */}
          <div className="glass-panel p-6 rounded-[32px] space-y-4">
            <h3 className="font-bold text-sm text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-violet-400" />
              Hierarquia de Títulos
            </h3>

            <div className="space-y-3">
              {tiers.map((tier, idx) => {
                const isCurrent = userProfile.title === tier.title;
                return (
                  <div key={idx} className={`p-3 rounded-2xl border transition ${
                    isCurrent 
                      ? 'bg-amber-500/5 border-amber-500/30' 
                      : 'bg-zinc-900/40 border-zinc-800/80 opacity-60'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`text-xs font-extrabold uppercase ${isCurrent ? 'text-amber-400' : 'text-zinc-300'}`}>
                        {tier.title}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded-lg">
                        {tier.levelRange}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-normal">{tier.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column: Achievements list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-[32px] space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Conquistas Desbloqueadas
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {achievements.map(ach => (
                <div key={ach.id} className={`p-4 rounded-2xl border flex items-center gap-4 transition duration-300 ${
                  ach.unlocked 
                    ? 'border-amber-500/30 bg-amber-500/5 glow-active-amber' 
                    : 'border-zinc-800 bg-zinc-900/20'
                }`}>
                  <div className={`p-3.5 rounded-xl ${ach.unlocked ? 'bg-amber-500/10' : 'bg-zinc-800'}`}>
                    {ach.unlocked ? renderIcon(ach.icon, true) : <Lock className="w-6 h-6 text-zinc-600" />}
                  </div>
                  <div>
                    <h4 className={`font-bold text-sm ${ach.unlocked ? 'text-white' : 'text-zinc-500'}`}>
                      {ach.title}
                    </h4>
                    <p className={`text-xs mt-0.5 leading-normal ${ach.unlocked ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {ach.description}
                    </p>
                    {ach.unlocked && ach.unlockedAt && (
                      <span className="text-[9px] font-bold text-amber-500/80 uppercase tracking-wider block mt-1.5">
                        Conquistado em: {new Date(ach.unlockedAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
