import React, { useState } from 'react';
import { UserProfile, UserMemory } from '../types';
import { Dumbbell, Calendar, Play, CheckCircle2, ChevronRight, AlertTriangle, ShieldCheck, Clock, Award, RotateCcw } from 'lucide-react';
import { awardXp } from '../services/rpgService';
import { saveProgressLog, getProgressLogForDate, saveQuest, getQuests } from '../services/dbService';

interface FitnessPlansProps {
  userProfile: UserProfile;
  userMemory: UserMemory;
  onWorkoutCompleted: (updatedProfile: UserProfile, unlockedAchs: any[]) => void;
}

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  description: string;
}

interface WorkoutDay {
  dayName: string;
  focus: string;
  exercises: Exercise[];
}

export default function FitnessPlans({ userProfile, userMemory, onWorkoutCompleted }: FitnessPlansProps) {
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [completedExercises, setCompletedExercises] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const focus = userMemory.goals.focusArea || 'health';
  const location = userMemory.preferences.location || 'home';
  const injuries = userMemory.healthConstraints.injuries || [];

  // Dynamic Routine Generator based on User Memory
  const generateWorkoutSplit = (): WorkoutDay[] => {
    const routine: WorkoutDay[] = [];

    // Setup helper variables
    const isWeightLoss = focus === 'weightLoss';
    const isMuscleGain = focus === 'muscleGain';
    const isGym = location === 'gym';
    const hasKneePain = injuries.includes('kneePain');
    const hasBackPain = injuries.includes('backPain');

    // Day 1
    const day1Exercises: Exercise[] = [];
    if (isGym) {
      day1Exercises.push({ name: 'Supino Reto com Barra', sets: 4, reps: '8-10 reps', rest: '90s', description: 'Deitado no banco reto, empurre a barra controladamente.' });
      day1Exercises.push({ name: 'Puxada Alta (Lat Pulldown)', sets: 4, reps: '10-12 reps', rest: '90s', description: 'Puxe a barra em direção ao peito inclinado levemente para trás.' });
      day1Exercises.push({ name: 'Desenvolvimento com Halteres', sets: 3, reps: '10 reps', rest: '60s', description: hasBackPain ? 'Apoiado em banco inclinado a 85 graus para proteger a lombar.' : 'Sentado, empurre os halteres para cima.' });
      day1Exercises.push({ name: 'Rosca Direta + Tríceps Pulley', sets: 3, reps: '12 reps cada', rest: '60s', description: 'Super-série para braços usando polia e halteres.' });
    } else {
      // Home Bodyweight
      day1Exercises.push({ name: 'Flexão de Braço (Push-ups)', sets: 3, reps: 'Max (ou de joelhos)', rest: '60s', description: 'Mantenha o abdômen contraído e cotovelos a 45 graus.' });
      day1Exercises.push({ name: 'Barra Fixa / Remada na Mesa', sets: 3, reps: '8-10 reps', rest: '60s', description: 'Use uma mesa firme por baixo ou barra portátil para puxar.' });
      day1Exercises.push({ name: 'Flexão de Braço Inclinada', sets: 3, reps: '10-12 reps', rest: '60s', description: 'Mãos apoiadas em um sofá ou cadeira estável.' });
      day1Exercises.push({ name: 'Tríceps no Banco (Dips)', sets: 3, reps: '12 reps', rest: '60s', description: 'Apoie as mãos em uma cadeira e flexione os cotovelos.' });
    }
    routine.push({
      dayName: 'Treino A',
      focus: 'Membros Superiores & Força',
      exercises: day1Exercises
    });

    // Day 2
    const day2Exercises: Exercise[] = [];
    if (hasKneePain) {
      // Avoid squats/lunges
      day2Exercises.push({ name: 'Elevação de Quadril (Glute Bridge)', sets: 4, reps: '15-20 reps', rest: '60s', description: 'Deitado de costas, empurre o quadril para o alto contraindo os glúteos.' });
      day2Exercises.push({ name: 'Extensão de Quadril em Pé com Elástico', sets: 3, reps: '15 reps cada lado', rest: '45s', description: 'Foco nos glúteos e posterior sem forçar a articulação do joelho.' });
      if (isGym) {
        day2Exercises.push({ name: 'Mesa Flexora (Leg Curl)', sets: 4, reps: '12-15 reps', rest: '60s', description: 'Fortalecimento posterior da coxa de forma isolada e segura.' });
      } else {
        day2Exercises.push({ name: 'Abdução de Quadril Deitado (Clamshell)', sets: 3, reps: '20 reps cada lado', rest: '45s', description: 'Deitado de lado, afaste os joelhos mantendo os pés juntos.' });
      }
      day2Exercises.push({ name: 'Elevação de Panturrilha em Pé', sets: 4, reps: '20 reps', rest: '45s', description: 'Suba na ponta dos pés de forma lenta e controlada.' });
    } else {
      // Normal legs
      if (isGym) {
        day2Exercises.push({ name: 'Agachamento com Barra (Back Squat)', sets: 4, reps: '8-10 reps', rest: '90s', description: hasBackPain ? 'Substitua por Leg Press 45 para proteger a lombar.' : 'Agache controladamente mantendo a postura firme.' });
        day2Exercises.push({ name: 'Leg Press 45', sets: 3, reps: '12 reps', rest: '60s', description: 'Posicione os pés na largura dos ombros.' });
        day2Exercises.push({ name: 'Cadeira Extensora', sets: 3, reps: '12 reps', rest: '60s', description: 'Segure firme nas laterais e estenda as pernas.' });
      } else {
        day2Exercises.push({ name: 'Agachamento Livre (Air Squats)', sets: 4, reps: '15-20 reps', rest: '60s', description: 'Agache empurrando o quadril para trás como se fosse sentar.' });
        day2Exercises.push({ name: 'Passada / Avanço Recuado', sets: 3, reps: '12 reps cada perna', rest: '60s', description: 'Dê um passo para trás flexionando os joelhos em 90 graus.' });
        day2Exercises.push({ name: 'Agachamento Sumô', sets: 3, reps: '15 reps', rest: '60s', description: 'Afaste mais os pés e aponte as pontas para fora.' });
      }
      day2Exercises.push({ name: 'Elevação Pélvica', sets: 3, reps: '15 reps', rest: '60s', description: 'Pressione os calcanhares no chão para subir o quadril.' });
    }
    routine.push({
      dayName: 'Treino B',
      focus: 'Membros Inferiores',
      exercises: day2Exercises
    });

    // Day 3
    const day3Exercises: Exercise[] = [];
    day3Exercises.push({ name: 'Prancha Abdominal (Plank)', sets: 3, reps: '30 a 45 seg', rest: '60s', description: 'Mantenha o corpo alinhado e o abdômen totalmente contraído.' });
    day3Exercises.push({ name: 'Super-Homem (Bird-Dog)', sets: 3, reps: '12 reps alternadas', rest: '45s', description: 'Excelente para estabilizar a coluna e fortalecer a lombar.' });
    
    if (isWeightLoss) {
      // Cardio heavy
      if (hasKneePain) {
        day3Exercises.push({ name: 'Boxe Sombra (Shadow Boxing)', sets: 4, reps: '2 min ativo', rest: '60s', description: 'Dê socos no ar mantendo movimentação ágil e sem impacto nos joelhos.' });
        day3Exercises.push({ name: 'Pedalada deitada (Bicycle crunch)', sets: 3, reps: '20 reps', rest: '45s', description: 'Abdominal trazendo cotovelo oposto ao joelho alternadamente.' });
      } else {
        day3Exercises.push({ name: 'Polichinelos (Jumping Jacks)', sets: 4, reps: '45 seg ativos', rest: '45s', description: 'Abra e feche braços e pernas de forma coordenada.' });
        day3Exercises.push({ name: 'Escalador (Mountain Climbers)', sets: 3, reps: '30 seg ativos', rest: '45s', description: 'Em posição de flexão, traga os joelhos em direção ao peito.' });
      }
    } else {
      // Core stability & hypertrophy focus
      day3Exercises.push({ name: 'Abdominal Infra na Barra/Chão', sets: 3, reps: '15 reps', rest: '60s', description: 'Eleve as pernas retas ou dobradas focando na região inferior do abdômen.' });
      day3Exercises.push({ name: 'Prancha Lateral', sets: 3, reps: '20s cada lado', rest: '45s', description: 'Apoie o cotovelo e eleve o quadril mantendo a linha reta.' });
    }
    
    routine.push({
      dayName: 'Treino C',
      focus: 'Core & Condicionamento Metabólico',
      exercises: day3Exercises
    });

    return routine;
  };

  const split = generateWorkoutSplit();
  const currentDay = split[activeDayIndex] || split[0];

  const handleStartWorkout = () => {
    setIsPlaying(true);
    setCurrentExerciseIndex(0);
    setCurrentSet(1);
    setCompletedExercises([]);
    setShowSummary(false);
  };

  const handleNextSet = () => {
    const exercise = currentDay.exercises[currentExerciseIndex];
    if (currentSet < exercise.sets) {
      setCurrentSet(prev => prev + 1);
    } else {
      // Completed all sets for this exercise
      setCompletedExercises(prev => [...prev, currentExerciseIndex]);
      if (currentExerciseIndex < currentDay.exercises.length - 1) {
        setCurrentExerciseIndex(prev => prev + 1);
        setCurrentSet(1);
      } else {
        // Workout finished!
        handleFinishWorkout();
      }
    }
  };

  const handleFinishWorkout = async () => {
    setLoading(true);
    try {
      // Award XP (+100 XP)
      const res = await awardXp(userProfile.uid, userProfile, 100, 'workout');

      // Update today's progress log
      const log = await getProgressLogForDate(userProfile.uid, todayStr);
      await saveProgressLog(userProfile.uid, {
        ...log,
        workoutCompleted: true,
        xpEarned: log.xpEarned + 100
      });

      // Update quests - complete daily workout quest
      const activeQuests = await getQuests(userProfile.uid);
      const dailyWorkout = activeQuests.find(q => q.type === 'workout' && q.category === 'daily');
      
      if (dailyWorkout && !dailyWorkout.completed) {
        const updatedQuest = {
          ...dailyWorkout,
          progress: 1,
          completed: true,
          completedDate: new Date().toISOString()
        };
        await saveQuest(userProfile.uid, updatedQuest);

        // Update weekly workout progress
        const weeklyWorkouts = activeQuests.find(q => q.id === 'weekly-workouts');
        if (weeklyWorkouts && !weeklyWorkouts.completed) {
          const newWeeklyProgress = weeklyWorkouts.progress + 1;
          const weeklyCompleted = newWeeklyProgress >= weeklyWorkouts.target;
          
          await saveQuest(userProfile.uid, {
            ...weeklyWorkouts,
            progress: newWeeklyProgress,
            completed: weeklyCompleted,
            completedDate: weeklyCompleted ? new Date().toISOString() : undefined
          });
        }
      }

      setIsPlaying(false);
      setShowSummary(true);
      onWorkoutCompleted(res.profile, res.unlockedAchievements);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Ficha de Treino RPG</h1>
        <p className="text-zinc-400">Suas planilhas de exercícios geradas pela IA adaptam-se dinamicamente com base nas suas metas e dores corporais.</p>
      </div>

      {/* Constraints Banner */}
      {injuries.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3 text-amber-400 text-xs items-center">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <span className="font-bold uppercase tracking-wider block">Filtro de Lesão Ativo</span>
            Seu treino está sendo filtrado para proteger seu joelho/lombar. Exercícios de alto impacto foram adaptados para baixo impacto.
          </div>
        </div>
      )}

      {!isPlaying && !showSummary && (
        <div className="space-y-6">
          {/* Day selection tabs */}
          <div className="flex bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800">
            {split.map((day, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveDayIndex(idx)}
                className={`flex-grow py-3 text-xs font-bold rounded-xl transition cursor-pointer text-center ${
                  activeDayIndex === idx
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {day.dayName}
              </button>
            ))}
          </div>

          {/* Active Workout Card details */}
          <div className="glass-panel p-6 rounded-[32px] border border-zinc-850 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">{currentDay.focus}</span>
                <h2 className="text-2xl font-black text-white mt-0.5">{currentDay.dayName}</h2>
              </div>
              <button
                type="button"
                onClick={handleStartWorkout}
                className="px-6 py-3 bg-gradient-to-r from-violet-600 to-pink-600 hover:scale-[1.02] active:scale-98 text-white font-bold rounded-2xl transition duration-150 cursor-pointer shadow-lg shadow-violet-600/20 text-xs flex items-center justify-center gap-1.5 self-start sm:self-center"
              >
                <Play className="w-4 h-4" /> Iniciar Treino (+100 XP)
              </button>
            </div>

            {/* Exercises List */}
            <div className="space-y-3.5 pt-2">
              {currentDay.exercises.map((ex, idx) => (
                <div key={idx} className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 font-extrabold">{idx + 1}</span>
                      {ex.name}
                    </h4>
                    <p className="text-xs text-zinc-400 leading-normal pl-7">{ex.description}</p>
                  </div>
                  <div className="flex gap-4 pl-7 sm:pl-0">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase block">Séries</span>
                      <span className="text-xs font-bold text-zinc-200">{ex.sets}x</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase block">Reps</span>
                      <span className="text-xs font-bold text-violet-400">{ex.reps}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase block">Descanso</span>
                      <span className="text-xs font-bold text-zinc-400">{ex.rest}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Workout Player */}
      {isPlaying && (
        <div className="glass-panel p-8 rounded-[36px] border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-violet-950/10 space-y-8 animate-scale-up relative">
          <div className="absolute top-0 right-0 w-48 h-48 bg-violet-600/5 rounded-full filter blur-[50px] pointer-events-none"></div>

          {/* Player Header */}
          <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
            <div>
              <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">{currentDay.dayName} · Jogador Ativo</span>
              <h2 className="text-xl font-bold text-white mt-0.5">Executando Exercício</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsPlaying(false)}
              className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition text-xs font-bold cursor-pointer"
            >
              Desistir do Calabouço
            </button>
          </div>

          {/* Current Exercise Detail */}
          {currentDay.exercises[currentExerciseIndex] && (
            <div className="space-y-6 text-center max-w-lg mx-auto">
              <div className="space-y-2">
                <span className="text-xs font-extrabold uppercase px-3 py-1 bg-violet-600/10 border border-violet-500/20 text-violet-400 rounded-full">
                  Exercício {currentExerciseIndex + 1} de {currentDay.exercises.length}
                </span>
                <h3 className="text-2xl font-black text-white pt-2">{currentDay.exercises[currentExerciseIndex].name}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{currentDay.exercises[currentExerciseIndex].description}</p>
              </div>

              {/* Set indicator circles */}
              <div className="flex justify-center gap-2 pt-2">
                {Array.from({ length: currentDay.exercises[currentExerciseIndex].sets }).map((_, sIdx) => {
                  const setNum = sIdx + 1;
                  const isDone = setNum < currentSet;
                  const isActive = setNum === currentSet;
                  return (
                    <div
                      key={sIdx}
                      className={`w-10 h-10 rounded-xl font-bold text-xs flex items-center justify-center transition border ${
                        isDone
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                          : isActive
                          ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20 glow-active-purple'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                      }`}
                    >
                      {setNum}
                    </div>
                  );
                })}
              </div>

              {/* Target info card */}
              <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto pt-4">
                <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-2xl">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Meta da Série</span>
                  <span className="text-base font-extrabold text-violet-400 mt-0.5">{currentDay.exercises[currentExerciseIndex].reps}</span>
                </div>
                <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-2xl">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Tempo de Descanso</span>
                  <span className="text-base font-extrabold text-zinc-200 mt-0.5">{currentDay.exercises[currentExerciseIndex].rest}</span>
                </div>
              </div>

              {/* Active controls button */}
              <button
                type="button"
                onClick={handleNextSet}
                disabled={loading}
                className="w-full max-w-sm py-4 bg-gradient-to-r from-violet-600 to-pink-600 hover:scale-[1.02] active:scale-98 text-white font-bold rounded-2xl transition duration-150 cursor-pointer shadow-lg shadow-violet-600/20 text-sm"
              >
                {currentSet < currentDay.exercises[currentExerciseIndex].sets
                  ? `Completar Série ${currentSet} (+ Descanso)`
                  : currentExerciseIndex < currentDay.exercises.length - 1
                  ? 'Próximo Exercício'
                  : 'Finalizar Treino & Coletar Recompensas'}
              </button>
            </div>
          )}

          {/* Global Progress Bar */}
          <div className="space-y-1.5 pt-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-zinc-500">Progresso do Treino</span>
              <span className="font-bold text-violet-400">
                {Math.round((completedExercises.length / currentDay.exercises.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-zinc-900 border border-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-pink-500 rounded-full transition-all duration-300"
                style={{ width: `${(completedExercises.length / currentDay.exercises.length) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Workout Success Summary Splash Screen */}
      {showSummary && (
        <div className="glass-panel p-8 rounded-[36px] border border-amber-500/20 bg-gradient-to-br from-zinc-900 to-amber-950/10 text-center space-y-6 animate-scale-up flex flex-col items-center">
          <div className="inline-flex p-4 rounded-3xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Award className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Desafio Concluído!</span>
            <h2 className="text-3xl font-black text-white">Treino Registrado com Sucesso</h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-normal">
              Você derrotou o calabouço do treino de hoje! A consistência de ferro foi registrada no diário.
            </p>
          </div>

          {/* Rewards Grid */}
          <div className="grid grid-cols-2 gap-4 w-full max-w-xs p-4 bg-zinc-900/60 border border-zinc-800 rounded-3xl">
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">XP Adquirido</span>
              <span className="text-lg font-bold text-violet-400">+100 XP</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Status da Quest</span>
              <span className="text-lg font-bold text-emerald-400">Concluído</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSummary(false)}
            className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black rounded-2xl transition duration-150 cursor-pointer text-xs"
          >
            Fechar Relatório
          </button>
        </div>
      )}
    </div>
  );
}
