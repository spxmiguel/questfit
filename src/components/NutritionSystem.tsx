import React, { useState, useEffect } from 'react';
import { UserProfile, UserMemory, ProgressLog } from '../types';
import { Carrot, Award, ShoppingBag, Plus, Sparkles, Scale, Heart, ShieldAlert, CheckSquare } from 'lucide-react';
import { awardXp } from '../services/rpgService';
import { saveProgressLog, getProgressLogForDate, saveQuest, getQuests } from '../services/dbService';

interface NutritionSystemProps {
  userProfile: UserProfile;
  userMemory: UserMemory;
  onNutritionLogged: (updatedProfile: UserProfile, unlockedAchs: any[]) => void;
}

export default function NutritionSystem({ userProfile, userMemory, onNutritionLogged }: NutritionSystemProps) {
  const [calorieInput, setCalorieInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [todayLog, setTodayLog] = useState<ProgressLog | null>(null);
  const [groceryItems, setGroceryItems] = useState<{ id: string; name: string; checked: boolean }[]>([]);
  const [loading, setLoading] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const weight = userMemory.goals.currentWeightKg || userMemory.goals.targetWeightKg || 75;
  const focus = userMemory.goals.focusArea || 'health';
  const diet = userMemory.preferences.dietType || 'omnivore';

  // Calculate dynamic targets
  const calculateTargets = () => {
    // Basic BMR estimate: 22kcal per kg
    const bmr = weight * 22;
    // Light activity TDEE
    const tdee = Math.round(bmr * 1.35);

    let calorieTarget = tdee;
    let proteinTarget = Math.round(weight * 1.6); // 1.6g/kg default

    if (focus === 'weightLoss') {
      calorieTarget = tdee - 500;
      proteinTarget = Math.round(weight * 2.0); // 2.0g/kg to preserve muscle in deficit
    } else if (focus === 'muscleGain') {
      calorieTarget = tdee + 300;
      proteinTarget = Math.round(weight * 2.2); // 2.2g/kg for muscle growth
    }

    return { calories: calorieTarget, protein: proteinTarget };
  };

  const targets = calculateTargets();

  useEffect(() => {
    // Fetch today's progress log
    getProgressLogForDate(userProfile.uid, todayStr).then(setTodayLog);
    
    // Set default grocery items based on diet type
    const defaultGroceries = getGroceryListForDiet(diet);
    setGroceryItems(defaultGroceries);
  }, [userProfile.uid, diet, todayStr]);

  const getGroceryListForDiet = (dietType: string) => {
    const list = [];
    if (dietType === 'vegetarian') {
      list.push(
        { id: '1', name: 'Ovos caipiras', checked: false },
        { id: '2', name: 'Queijo Cottage / Tofu firme', checked: false },
        { id: '3', name: 'Iogurte Grego natural', checked: false },
        { id: '4', name: 'Grão-de-bico & Lentilhas', checked: false },
        { id: '5', name: 'Aveia em flocos finos', checked: false },
        { id: '6', name: 'Brócolis e Espinafre fresco', checked: false },
        { id: '7', name: 'Castanhas de caju / Amêndoas', checked: false }
      );
    } else if (dietType === 'vegan') {
      list.push(
        { id: '1', name: 'Tofu biológico & Tempeh', checked: false },
        { id: '2', name: 'Levedura nutricional', checked: false },
        { id: '3', name: 'Feijão preto & Ervilhas secas', checked: false },
        { id: '4', name: 'Proteína de Ervilha / Arroz em pó', checked: false },
        { id: '5', name: 'Quinoa & Arroz Integral', checked: false },
        { id: '6', name: 'Sementes de Chia & Linhaça', checked: false },
        { id: '7', name: 'Brócolis, Couve & Espinafre', checked: false }
      );
    } else if (dietType === 'carnivore') {
      list.push(
        { id: '1', name: 'Filé mignon / Contra filé', checked: false },
        { id: '2', name: 'Peito de frango / Sobrecoxa', checked: false },
        { id: '3', name: 'Ovos caipiras inteiros', checked: false },
        { id: '4', name: 'Postas de salmão / Atum fresco', checked: false },
        { id: '5', name: 'Bacon artesanal magro', checked: false },
        { id: '6', name: 'Manteiga ghee / Banha purificada', checked: false },
        { id: '7', name: 'Caldo de ossos concentrado', checked: false }
      );
    } else if (dietType === 'keto' || dietType === 'lowcarb') {
      list.push(
        { id: '1', name: 'Carnes gordas e Peixes gordos', checked: false },
        { id: '2', name: 'Ovos e Queijos curados', checked: false },
        { id: '3', name: 'Abacate e Coco fresco', checked: false },
        { id: '4', name: 'Azeite de oliva e Manteiga', checked: false },
        { id: '5', name: 'Nozes, Amêndoas e Macadâmias', checked: false },
        { id: '6', name: 'Vegetais de baixo amido (Brócolis, Couve-flor)', checked: false },
        { id: '7', name: 'Creme de leite fresco / Nata', checked: false }
      );
    } else {
      // Omnivore
      list.push(
        { id: '1', name: 'Filé de peito de frango', checked: false },
        { id: '2', name: 'Ovos caipiras frescos', checked: false },
        { id: '3', name: 'Patinho moído magro / Atum em lata', checked: false },
        { id: '4', name: 'Queijo minas frescal light', checked: false },
        { id: '5', name: 'Batata doce / Quinoa', checked: false },
        { id: '6', name: 'Brócolis e Mix de folhas verdes', checked: false },
        { id: '7', name: 'Azeite de oliva extra virgem', checked: false }
      );
    }
    return list;
  };

  const handleLogIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    const cals = parseInt(calorieInput);
    const prot = parseInt(proteinInput);
    if (isNaN(cals) || cals <= 0 || isNaN(prot) || prot <= 0) return;

    setLoading(true);
    try {
      const log = await getProgressLogForDate(userProfile.uid, todayStr);
      
      const newCals = (log.caloriesConsumed || 0) + cals;
      const newProt = (log.proteinConsumedG || 0) + prot;

      const updatedLog: ProgressLog = {
        ...log,
        caloriesConsumed: newCals,
        proteinConsumedG: newProt
      };

      await saveProgressLog(userProfile.uid, updatedLog);
      setTodayLog(updatedLog);

      // Award XP for logging nutrition details (+25 XP)
      const res = await awardXp(userProfile.uid, userProfile, 25, 'quest');

      // Check if calorie target and protein targets are met to update daily quests
      const activeQuests = await getQuests(userProfile.uid);
      const calorieQuest = activeQuests.find(q => q.type === 'nutrition' && q.id.includes('calorie'));
      
      // If there are calorie adherence check tasks, complete them.
      // For now, let's keep it simple: just update the UI state
      setCalorieInput('');
      setProteinInput('');
      onNutritionLogged(res.profile, res.unlockedAchievements);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGrocery = (id: string) => {
    setGroceryItems(prev =>
      prev.map(item => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  // Dynamic meal suggestions based on diet preferences
  const getMealSuggestions = () => {
    if (diet === 'vegetarian') {
      return [
        { name: 'Café da Manhã', desc: 'Omelete de 3 ovos com espinafre e queijo cottage + 1 fatia de pão integral.' },
        { name: 'Almoço', desc: 'Grão-de-bico ensopado com quinoa cozida, abóbora assada e brócolis cozido no vapor.' },
        { name: 'Lanche da Tarde', desc: 'Shake proteico vegetal (ou whey) batido com aveia, leite de amêndoas e 1 banana.' },
        { name: 'Jantar', desc: 'Tofu grelhado temperado com cúrcuma, purê de batata doce e salada de folhas verdes à vontade.' }
      ];
    } else if (diet === 'vegan') {
      return [
        { name: 'Café da Manhã', desc: 'Tofu mexido temperado com levedura nutricional e tomate + 1 copo de suco verde.' },
        { name: 'Almoço', desc: 'Lentilha cozida com arroz integral, sementes de girassol torradas e espinafre refogado.' },
        { name: 'Lanche da Tarde', desc: 'Pasta de amendoim com maçã picada + shake de proteína de ervilha com chia.' },
        { name: 'Jantar', desc: 'Almôndegas de feijão preto com molho de tomate natural e macarrão de abobrinha.' }
      ];
    } else if (diet === 'carnivore') {
      return [
        { name: 'Café da Manhã', desc: '4 ovos fritos na manteiga com fatias de bacon artesanal.' },
        { name: 'Almoço', desc: '300g de contra-filé grelhado ao ponto + copo de caldo de ossos concentrado.' },
        { name: 'Lanche da Tarde', desc: 'Iogurte natural integral sem açúcar + 2 ovos cozidos com sal marinho.' },
        { name: 'Jantar', desc: '250g de sobrecoxa de frango assada na banha de porco com a pele crocante.' }
      ];
    } else if (diet === 'keto' || diet === 'lowcarb') {
      return [
        { name: 'Café da Manhã', desc: 'Omelete de 3 ovos com bastante queijo ralado e espinafre frito na manteiga.' },
        { name: 'Almoço', desc: 'Posta de salmão grelhada com azeite de oliva + purê de couve-flor gratinado.' },
        { name: 'Lanche da Tarde', desc: '1 abacate médio picado com limão e um punhado de nozes macadâmias.' },
        { name: 'Jantar', desc: 'Carne moída refogada com bacon, cebola e pimentão, servida com salada verde regada a azeite.' }
      ];
    } else {
      // Omnivore
      return [
        { name: 'Café da Manhã', desc: '3 ovos mexidos + 100g de mamão formosa com 1 colher de chia.' },
        { name: 'Almoço', desc: '150g de peito de frango grelhado + 120g de arroz integral + mix de salada (alface, tomate e rúcula).' },
        { name: 'Lanche da Tarde', desc: 'Iogurte natural desnatado + 30g de Whey Protein + 15g de castanha de caju.' },
        { name: 'Jantar', desc: '120g de filé de tilápia assada + 100g de batata doce cozida + brócolis refogado no azeite.' }
      ];
    }
  };

  const meals = getMealSuggestions();
  const calPercent = todayLog ? Math.round(((todayLog.caloriesConsumed || 0) / targets.calories) * 100) : 0;
  const protPercent = todayLog ? Math.round(((todayLog.proteinConsumedG || 0) / targets.protein) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Dieta & Nutrição RPG</h1>
        <p className="text-zinc-400">Gerencie seus macro-nutrientes e calorias de forma guiada por inteligência artificial.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Logging & Macros */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Calorie & Protein Tracker */}
          <div className="glass-panel p-6 rounded-3xl space-y-5">
            <h3 className="font-bold text-sm text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Carrot className="w-4 h-4 text-orange-400" />
              Alquimia de Nutrientes
            </h3>

            {/* Calories Progress */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-zinc-500 uppercase">Calorias Consumidas</span>
                <span className="font-bold text-zinc-200">
                  {todayLog?.caloriesConsumed || 0} / {targets.calories} kcal
                </span>
              </div>
              <div className="w-full bg-zinc-900 border border-zinc-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(calPercent, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Protein Progress */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-zinc-500 uppercase">Proteínas Consumidas</span>
                <span className="font-bold text-violet-400 font-semibold">
                  {todayLog?.proteinConsumedG || 0} / {targets.protein} g
                </span>
              </div>
              <div className="w-full bg-zinc-900 border border-zinc-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-600 to-pink-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(protPercent, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Logging Form */}
            <form onSubmit={handleLogIntake} className="space-y-3 pt-3 border-t border-zinc-900">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Calorias (kcal)</label>
                  <input
                    type="number"
                    placeholder="Ex: 350"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                    value={calorieInput}
                    onChange={(e) => setCalorieInput(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Proteínas (g)</label>
                  <input
                    type="number"
                    placeholder="Ex: 25"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                    value={proteinInput}
                    onChange={(e) => setProteinInput(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !calorieInput || !proteinInput}
                className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition duration-150 cursor-pointer text-xs shadow-lg shadow-orange-600/15"
              >
                Logar Refeição (+25 XP)
              </button>
            </form>
          </div>

          {/* Guidelines warning */}
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-3xl flex gap-3 text-zinc-500 text-[10px] leading-normal items-start">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-zinc-650" />
            <span>
              Aviso: O QuestFit fornece alvos alimentares e sugestões baseadas em objetivos gerais de fitness. Nós não prescrevemos dietas médicas nem substituímos nutricionistas.
            </span>
          </div>

        </div>

        {/* Center & Right Column: Meal suggestions & grocery list */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
          
          {/* Meal Suggestions Board */}
          <div className="glass-panel p-6 rounded-[32px] space-y-4">
            <h3 className="font-bold text-sm text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              Cardápio IA do Dia
            </h3>
            
            <div className="space-y-3">
              {meals.map((meal, idx) => (
                <div key={idx} className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wide">{meal.name}</span>
                  <p className="text-xs text-zinc-300 leading-normal">{meal.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Grocery List Board */}
          <div className="glass-panel p-6 rounded-[32px] space-y-4">
            <h3 className="font-bold text-sm text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-violet-400" />
              Lista de Compras da Guilda
            </h3>
            <p className="text-xs text-zinc-400">Garanta os ingredientes básicos para a semana de acordo com o seu perfil.</p>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {groceryItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleToggleGrocery(item.id)}
                  className={`w-full p-3 rounded-2xl border text-left flex items-center gap-3 transition cursor-pointer ${
                    item.checked 
                      ? 'border-emerald-500/25 bg-emerald-550/5 text-zinc-500 line-through' 
                      : 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-850'
                  }`}
                >
                  <CheckSquare className={`w-4 h-4 flex-shrink-0 ${item.checked ? 'text-emerald-500' : 'text-zinc-600'}`} />
                  <span className="text-xs font-semibold">{item.name}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
