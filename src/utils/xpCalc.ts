import { Quest, Achievement } from '../types';
import { getLocalDateString, getMondayISO } from './dateUtils';

export const getXpNeededForLevel = (level: number): number => {
  return Math.round(level * 100 * 1.5);
};

export const getTitleForLevel = (level: number): string => {
  if (level >= 60) return 'Lenda do QuestFit';
  if (level >= 40) return 'Mestre da Disciplina';
  if (level >= 25) return 'Campeão Elite';
  if (level >= 15) return 'Guerreiro';
  if (level >= 10) return 'Aventureiro';
  if (level >= 5) return 'Escudeiro';
  return 'Iniciante';
};

export const checkLevelUp = (level: number, xp: number): { leveledUp: boolean; newLevel: number; remainingXp: number; xpNeeded: number } => {
  let newLevel = level;
  let remainingXp = xp;
  let xpNeeded = getXpNeededForLevel(newLevel);
  let leveledUp = false;

  while (remainingXp >= xpNeeded) {
    leveledUp = true;
    remainingXp -= xpNeeded;
    newLevel += 1;
    xpNeeded = getXpNeededForLevel(newLevel);
  }

  return { leveledUp, newLevel, remainingXp, xpNeeded };
};

export const getDefaultQuests = (weightKg?: number): Quest[] => {
  const todayStr = getLocalDateString();
  const waterTarget = weightKg ? Math.round(weightKg * 35) : 2000;
  const finalWaterTarget = Math.max(1500, Math.min(waterTarget, 4500));
  
  return [
    // Daily Quests
    {
      id: `daily-water-${todayStr}`,
      title: `Beber ${(finalWaterTarget / 1000).toFixed(1).replace('.0', '')}L de Água`,
      category: 'daily',
      type: 'water',
      xpReward: 50,
      completed: false,
      progress: 0,
      target: finalWaterTarget,
      unit: 'ml'
    },
    {
      id: `daily-workout-${todayStr}`,
      title: 'Completar Treino Diário',
      category: 'daily',
      type: 'workout',
      xpReward: 100,
      completed: false,
      progress: 0,
      target: 1,
      unit: 'treino'
    },
    {
      id: `daily-steps-${todayStr}`,
      title: 'Caminhar 5.000 Passos',
      category: 'daily',
      type: 'steps',
      xpReward: 50,
      completed: false,
      progress: 0,
      target: 5000,
      unit: 'passos'
    },
    {
      id: `daily-veggies-${todayStr}`,
      title: 'Comer Porção de Legumes/Verduras',
      category: 'daily',
      type: 'nutrition',
      xpReward: 50,
      completed: false,
      progress: 0,
      target: 1,
      unit: 'porção'
    },
    // Weekly Quests
    {
      id: 'weekly-workouts',
      title: 'Completar 4 Treinos na Semana',
      category: 'weekly',
      type: 'workout',
      xpReward: 250,
      completed: false,
      progress: 0,
      target: 4,
      unit: 'treinos',
      weekStart: getMondayISO()
    },
    {
      id: 'weekly-adherence',
      title: 'Manter Consistência de Água (5 dias)',
      category: 'weekly',
      type: 'water',
      xpReward: 200,
      completed: false,
      progress: 0,
      target: 5,
      unit: 'dias',
      weekStart: getMondayISO()
    }
  ];
};

export const getDefaultAchievements = (): Achievement[] => {
  return [
    {
      id: 'ach-first-quest',
      title: 'Primeira Jornada',
      description: 'Complete sua primeira missão diária.',
      unlocked: false,
      icon: 'CheckCircle'
    },
    {
      id: 'ach-first-workout',
      title: 'Guerreiro de Ferro',
      description: 'Registre seu primeiro treino completo.',
      unlocked: false,
      icon: 'Dumbbell'
    },
    {
      id: 'ach-streak-7',
      title: 'Foco Semanal',
      description: 'Alcance uma ofensiva de 7 dias consecutivos.',
      unlocked: false,
      icon: 'Flame'
    },
    {
      id: 'ach-level-10',
      title: 'Evolução Constante',
      description: 'Alcance o Nível 10 no QuestFit.',
      unlocked: false,
      icon: 'Award'
    },
    {
      id: 'ach-weight-5kg',
      title: 'Peso Pena',
      description: 'Elimine os primeiros 5kg de peso corporal (conforme registro).',
      unlocked: false,
      icon: 'Scale'
    },
    {
      id: 'ach-legendary-consistency',
      title: 'Disciplina Lendária',
      description: 'Complete 30 treinos registrados.',
      unlocked: false,
      icon: 'ShieldAlert'
    }
  ];
};
