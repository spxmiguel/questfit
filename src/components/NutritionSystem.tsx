import React, { useState, useEffect } from 'react';
import { UserProfile, UserMemory, ProgressLog } from '../types';
import { Carrot, Award, ShoppingBag, Plus, Sparkles, Scale, Heart, ShieldAlert, CheckSquare, Camera, Upload, Image, Share2, Trash2, Wand2, Edit3, RefreshCw } from 'lucide-react';
import { awardXp } from '../services/rpgService';
import { saveProgressLog, getProgressLogForDate, saveQuest, getQuests } from '../services/dbService';
import { analyzeMealPhoto, MealAnalysisResult, getStoredGeminiKey, regenerateMealSuggestion } from '../services/aiService';
import { checkLevelUp, getTitleForLevel } from '../utils/xpCalc';
import { getLocalDateString } from '../utils/dateUtils';
import { calculateBMR, calculateTDEE } from '../utils/healthMath';

interface NutritionSystemProps {
  userProfile: UserProfile;
  userMemory: UserMemory;
  onNutritionLogged: (updatedProfile: UserProfile, unlockedAchs: any[]) => void;
}

const getDefaultMealSuggestions = (diet: string) => {
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
    return [
      { name: 'Café da Manhã', desc: '3 ovos mexidos + 100g de mamão formosa com 1 colher de chia.' },
      { name: 'Almoço', desc: '150g de peito de frango grelhado + 120g de arroz integral + mix de salada (alface, tomate e rúcula).' },
      { name: 'Lanche da Tarde', desc: 'Iogurte natural desnatado + 30g de Whey Protein + 15g de castanha de caju.' },
      { name: 'Jantar', desc: '120g de filé de tilápia assada + 100g de batata doce cozida + brócolis refogado no azeite.' }
    ];
  }
};

export default function NutritionSystem({ userProfile, userMemory, onNutritionLogged }: NutritionSystemProps) {
  const [calorieInput, setCalorieInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [foodNameInput, setFoodNameInput] = useState('');
  const [todayLog, setTodayLog] = useState<ProgressLog | null>(null);
  const [groceryItems, setGroceryItems] = useState<{ id: string; name: string; checked: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Photo Scanner states
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<MealAnalysisResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const hasGeminiKey = !!getStoredGeminiKey();

  const todayStr = getLocalDateString();
  const weight = userMemory.goals.currentWeightKg || userMemory.goals.targetWeightKg || 75;
  const focus = userMemory.goals.focusArea || 'health';
  const diet = userMemory.preferences.dietType || 'omnivore';

  // Calculate dynamic targets using Mifflin-St Jeor TDEE if physical profile is set
  const calculateTargets = () => {
    const hasPhysical = userMemory.physicalProfile && userMemory.physicalProfile.weightKg;
    const bmr = hasPhysical ? calculateBMR(userMemory.physicalProfile!) : (weight * 22);
    const tdee = hasPhysical ? calculateTDEE(userMemory.physicalProfile!) : Math.round(bmr * 1.35);

    let calorieTarget = tdee;
    let proteinTarget = Math.round(weight * 1.6); // 1.6g/kg default

    if (focus === 'weightLoss') {
      calorieTarget = tdee - 500;
      proteinTarget = Math.round(weight * 2.0); // 2.0g/kg to preserve muscle in deficit
    } else if (focus === 'muscleGain') {
      calorieTarget = tdee + 300;
      proteinTarget = Math.round(weight * 2.2); // 2.2g/kg for muscle growth
    }

    return { calories: calorieTarget, protein: proteinTarget, tdee };
  };

  const targets = calculateTargets();

  const cacheKey = `questfit_custom_meals_${userProfile.uid}_${diet}`;
  const hasCustomMeals = !!localStorage.getItem(cacheKey);

  // Meal customization states
  const [meals, setMeals] = useState<{ name: string; desc: string }[]>(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Failed to parse cached meals:', e);
      }
    }
    return getDefaultMealSuggestions(diet);
  });
  const [editingMealIndex, setEditingMealIndex] = useState<number | null>(null);
  const [customInstruction, setCustomInstruction] = useState<string>('');
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setMeals(JSON.parse(cached));
      } catch (e) {
        console.error('Failed to parse cached meals:', e);
        setMeals(getDefaultMealSuggestions(diet));
      }
    } else {
      setMeals(getDefaultMealSuggestions(diet));
    }
    setEditingMealIndex(null);
    setCustomInstruction('');
    setRegenerateError(null);
  }, [userProfile.uid, diet, cacheKey]);

  const handleResetMeals = () => {
    if (window.confirm('Deseja restaurar as sugestões de refeições padrão para esta dieta? Suas personalizações atuais serão apagadas.')) {
      const defaults = getDefaultMealSuggestions(diet);
      setMeals(defaults);
      localStorage.removeItem(cacheKey);
      setEditingMealIndex(null);
      setCustomInstruction('');
      setRegenerateError(null);
    }
  };

  const handleRegenerateMeal = async (index: number) => {
    if (!customInstruction.trim() || regeneratingIndex !== null) return;
    
    setRegeneratingIndex(index);
    setRegenerateError(null);
    
    try {
      const meal = meals[index];
      const newDesc = await regenerateMealSuggestion(
        meal.name,
        meal.desc,
        customInstruction.trim(),
        diet,
        focus
      );
      
      const updatedMeals = meals.map((m, i) => i === index ? { ...m, desc: newDesc } : m);
      setMeals(updatedMeals);
      localStorage.setItem(cacheKey, JSON.stringify(updatedMeals));
      
      setEditingMealIndex(null);
      setCustomInstruction('');
    } catch (err: any) {
      console.error(err);
      setRegenerateError(err.message || 'Falha ao gerar nova recomendação de refeição via IA.');
    } finally {
      setRegeneratingIndex(null);
    }
  };

  useEffect(() => {
    getProgressLogForDate(userProfile.uid, todayStr).then(setTodayLog);
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

  const handleLogIntake = (e: React.FormEvent) => {
    e.preventDefault();
    const cals = parseInt(calorieInput);
    const prot = parseInt(proteinInput);
    if (isNaN(cals) || cals <= 0 || isNaN(prot) || prot <= 0) return;

    try {
      const currentLog = todayLog || {
        id: `${todayStr}_log`,
        date: todayStr,
        waterIntakeMl: 0,
        workoutCompleted: false,
        stepsCompleted: 0,
        xpEarned: 0
      };

      const newFood = {
        id: `food_${Date.now()}`,
        name: foodNameInput.trim() || 'Refeição Manual',
        calories: cals,
        protein: prot,
        timestamp: new Date().toISOString()
      };

      const updatedLog: ProgressLog = {
        ...currentLog,
        caloriesConsumed: (currentLog.caloriesConsumed || 0) + cals,
        proteinConsumedG: (currentLog.proteinConsumedG || 0) + prot,
        loggedFoods: [...(currentLog.loggedFoods || []), newFood]
      };

      // Update UI state immediately
      setTodayLog(updatedLog);

      // Award XP locally (+25 XP)
      const updatedXp = userProfile.xp + 25;
      const levelCheck = checkLevelUp(userProfile.level, updatedXp);
      const localUpdatedProfile: UserProfile = {
        ...userProfile,
        level: levelCheck.newLevel,
        xp: levelCheck.remainingXp,
        xpNeededForNextLevel: levelCheck.xpNeeded,
        title: getTitleForLevel(levelCheck.newLevel)
      };

      setCalorieInput('');
      setProteinInput('');
      setFoodNameInput('');
      onNutritionLogged(localUpdatedProfile, []);

      // Save in background (async, non-blocking)
      (async () => {
        try {
          const log = await getProgressLogForDate(userProfile.uid, todayStr);
          const finalLog: ProgressLog = {
            ...log,
            caloriesConsumed: (log.caloriesConsumed || 0) + cals,
            proteinConsumedG: (log.proteinConsumedG || 0) + prot,
            loggedFoods: [...(log.loggedFoods || []), newFood]
          };
          await saveProgressLog(userProfile.uid, finalLog);
          const res = await awardXp(userProfile.uid, userProfile, 25, 'quest');
          
          // Re-update if anything changed on server (e.g. achievements)
          onNutritionLogged(res.profile, res.unlockedAchievements);
        } catch (err) {
          console.error('Background log intake failed:', err);
        }
      })();
    } catch (err) {
      console.error('Failed to log intake (optimistic):', err);
    }
  };

  const handleClearTodayNutrition = () => {
    if (window.confirm('Tem certeza de que deseja zerar seu consumo de calorias e proteínas de hoje? Isso apagará seus registros para o dia atual.')) {
      try {
        const currentLog = todayLog || {
          id: `${todayStr}_log`,
          date: todayStr,
          waterIntakeMl: 0,
          workoutCompleted: false,
          stepsCompleted: 0,
          xpEarned: 0
        };

        const updatedLog: ProgressLog = {
          ...currentLog,
          caloriesConsumed: 0,
          proteinConsumedG: 0,
          loggedFoods: []
        };

        setTodayLog(updatedLog);
        onNutritionLogged(userProfile, []);

        // Save in background (async, non-blocking)
        (async () => {
          try {
            const log = await getProgressLogForDate(userProfile.uid, todayStr);
            const finalLog: ProgressLog = {
              ...log,
              caloriesConsumed: 0,
              proteinConsumedG: 0,
              loggedFoods: []
            };
            await saveProgressLog(userProfile.uid, finalLog);
          } catch (err) {
            console.error('Background clear nutrition failed:', err);
          }
        })();
      } catch (err) {
        console.error('Failed to clear nutrition (optimistic):', err);
      }
    }
  };

  const handleToggleGrocery = (id: string) => {
    setGroceryItems(prev =>
      prev.map(item => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setScanResult(null);
      setScanError(null);
    }
  };

  const handleAnalyzePhoto = async () => {
    if (!photoFile) return;
    setScanLoading(true);
    setScanError(null);
    setScanResult(null);

    try {
      const result = await analyzeMealPhoto(photoFile);
      setScanResult(result);
    } catch (err: any) {
      console.error(err);
      setScanError(err.message || 'Erro ao processar imagem.');
    } finally {
      setScanLoading(false);
    }
  };

  const handleLogScanResult = () => {
    if (!scanResult) return;
    try {
      const currentLog = todayLog || {
        id: `${todayStr}_log`,
        date: todayStr,
        waterIntakeMl: 0,
        workoutCompleted: false,
        stepsCompleted: 0,
        xpEarned: 0
      };

      const newFood = {
        id: `food_${Date.now()}`,
        name: scanResult.mealName || 'Scanner de Prato (IA)',
        calories: scanResult.calories,
        protein: scanResult.protein,
        timestamp: new Date().toISOString()
      };

      const updatedLog: ProgressLog = {
        ...currentLog,
        caloriesConsumed: (currentLog.caloriesConsumed || 0) + scanResult.calories,
        proteinConsumedG: (currentLog.proteinConsumedG || 0) + scanResult.protein,
        loggedFoods: [...(currentLog.loggedFoods || []), newFood]
      };

      setTodayLog(updatedLog);

      // Award XP locally (+25 XP)
      const updatedXp = userProfile.xp + 25;
      const levelCheck = checkLevelUp(userProfile.level, updatedXp);
      const localUpdatedProfile: UserProfile = {
        ...userProfile,
        level: levelCheck.newLevel,
        xp: levelCheck.remainingXp,
        xpNeededForNextLevel: levelCheck.xpNeeded,
        title: getTitleForLevel(levelCheck.newLevel)
      };

      setPhotoFile(null);
      setPhotoPreview(null);
      setScanResult(null);
      onNutritionLogged(localUpdatedProfile, []);

      // Save in background (async, non-blocking)
      (async () => {
        try {
          const log = await getProgressLogForDate(userProfile.uid, todayStr);
          const finalLog: ProgressLog = {
            ...log,
            caloriesConsumed: (log.caloriesConsumed || 0) + scanResult.calories,
            proteinConsumedG: (log.proteinConsumedG || 0) + scanResult.protein,
            loggedFoods: [...(log.loggedFoods || []), newFood]
          };
          await saveProgressLog(userProfile.uid, finalLog);
          const res = await awardXp(userProfile.uid, userProfile, 25, 'quest');
          onNutritionLogged(res.profile, res.unlockedAchievements);
        } catch (err) {
          console.error('Background confirm scan failed:', err);
        }
      })();
    } catch (err) {
      console.error('Failed to confirm scan (optimistic):', err);
    }
  };

  // EXPORT DIET option formatted for copy paste to clipboard
  const handleExportDiet = () => {
    const dietNames: Record<string, string> = {
      omnivore: 'Onívora',
      vegetarian: 'Vegetariana',
      vegan: 'Vegana',
      carnivore: 'Carnívora',
      keto: 'Cetogênica (Keto)',
      lowcarb: 'Low Carb'
    };

    const dietName = dietNames[diet] || diet;
    let exportText = `📋 CARDÁPIO E METAS ALIMENTARES - QUESTFIT\n`;
    exportText += `Objetivo: ${focus === 'weightLoss' ? 'Déficit/Perda de Peso' : focus === 'muscleGain' ? 'Hipertrofia/Ganho Muscular' : 'Saúde Geral'}\n`;
    exportText += `Dieta de Preferência: Dieta ${dietName}\n`;
    exportText += `Gasto Calórico Estimado (TDEE): ${targets.tdee} kcal\n`;
    exportText += `Meta Diária: ${targets.calories} kcal | ${targets.protein}g Proteína\n`;
    exportText += `--------------------------------------------------\n\n`;

    exportText += `🍳 REFEIÇÕES SUGERIDAS PARA O DIA:\n`;
    meals.forEach(m => {
      exportText += `* ${m.name}: ${m.desc}\n`;
    });

    exportText += `\n🛒 INGREDIENTES PARA COMPRA:\n`;
    groceryItems.forEach(item => {
      exportText += `[${item.checked ? 'X' : ' '}] ${item.name}\n`;
    });

    exportText += `\n--------------------------------------------------\n`;
    exportText += `Gerado pelo QuestFit. Mantenha a consistência! 🏋️‍♂️`;

    navigator.clipboard.writeText(exportText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 4000);
  };

  const calPercent = todayLog ? Math.round(((todayLog.caloriesConsumed || 0) / targets.calories) * 100) : 0;
  const protPercent = todayLog ? Math.round(((todayLog.proteinConsumedG || 0) / targets.protein) * 100) : 0;

  // Surplus / Deficit calculations compared to TDEE (how much body spends per day)
  const caloriesConsumed = todayLog?.caloriesConsumed || 0;
  const netDeficit = caloriesConsumed - targets.tdee;

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4">
      
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Dieta & Nutrição</h1>
        <p className="text-zinc-400">Gerencie seus macro-nutrientes e calorias de forma guiada por inteligência artificial.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Logging & Macros */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Calorie & Protein Tracker */}
          <div className="glass-panel p-6 rounded-3xl space-y-5">
            <h3 className="font-bold text-sm text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Carrot className="w-4 h-4 text-orange-400" />
              Metas de Nutrientes
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
                <span className="font-bold text-violet-400">
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

            {/* Calorie Deficit / Surplus feedback indicator */}
            <div className="p-3.5 bg-zinc-950 border border-zinc-900 rounded-2xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide block">Balanço Calórico</span>
                <span className="text-zinc-400">Gasto Diário (TDEE): {targets.tdee} kcal</span>
              </div>
              <div className="text-right">
                {netDeficit <= 0 ? (
                  <>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide block">Déficit</span>
                    <span className="font-extrabold text-emerald-400 text-sm">{netDeficit} kcal</span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide block">Superávit</span>
                    <span className="font-extrabold text-amber-500 text-sm">+{netDeficit} kcal</span>
                  </>
                )}
              </div>
            </div>

            {/* Logging Form */}
            <form onSubmit={handleLogIntake} className="space-y-3 pt-3 border-t border-zinc-900">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">O que você comeu?</label>
                <input
                  type="text"
                  placeholder="Ex: Arroz, feijão e frango, whey com aveia..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                  value={foodNameInput}
                  onChange={(e) => setFoodNameInput(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
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
              
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="submit"
                  disabled={loading || !calorieInput || !proteinInput || !foodNameInput.trim()}
                  className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition duration-150 cursor-pointer text-xs shadow-lg shadow-orange-600/15"
                >
                  Logar Refeição (+25 XP)
                </button>

                {/* Subtraction option to reset today's logs */}
                {(todayLog?.caloriesConsumed || todayLog?.proteinConsumedG) ? (
                  <button
                    type="button"
                    onClick={handleClearTodayNutrition}
                    disabled={loading}
                    className="w-full py-2 bg-zinc-900/60 hover:bg-rose-500/15 border border-zinc-850 hover:border-rose-550/20 text-zinc-500 hover:text-rose-400 rounded-xl transition text-[10px] font-bold cursor-pointer text-center flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Limpar Registro de Hoje (Erro de Digitação)
                  </button>
                ) : null}
              </div>
            </form>
          </div>

          {/* Today's Eaten Meals List */}
          {todayLog?.loggedFoods && todayLog.loggedFoods.length > 0 && (
            <div className="glass-panel p-6 rounded-[32px] space-y-4 animate-scale-up">
              <h3 className="font-bold text-sm text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <Carrot className="w-4 h-4 text-orange-400" />
                Refeições de Hoje
              </h3>
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {todayLog.loggedFoods.map((food, idx) => (
                  <div key={food.id || idx} className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-2xl flex justify-between items-center text-xs">
                    <div className="min-w-0 flex-1 pr-2">
                      <h4 className="font-bold text-zinc-200 truncate leading-snug">{food.name}</h4>
                      <span className="text-[9px] text-zinc-500">
                        {new Date(food.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="font-extrabold text-orange-400 block">{food.calories} kcal</span>
                      <span className="text-[9px] font-bold text-violet-400">+{food.protein}g prot</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Photo Scanner */}
          <div className="glass-panel p-6 rounded-[32px] space-y-5">
            <h3 className="font-bold text-sm text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Camera className="w-4 h-4 text-violet-400" />
              Scanner de Prato (IA)
            </h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Tire uma foto ou envie uma imagem da sua refeição. A inteligência artificial identificará os alimentos e calculará as calorias e proteínas automaticamente.
            </p>

            {!hasGeminiKey && (
              <div className="p-3 bg-amber-550/10 border border-amber-500/15 text-amber-400 text-[10px] rounded-2xl flex gap-2 leading-relaxed">
                <Sparkles className="w-4 h-4 flex-shrink-0 text-amber-500 animate-pulse" />
                <div>
                  <span className="font-bold block">Modo Simulação Ativo</span>
                  Chave Gemini não configurada. Inserindo uma imagem, o app simulará a análise para demonstração. Defina a chave nas Configurações para usar IA real.
                </div>
              </div>
            )}

            {/* Photo Dropzone/Selector */}
            <div className="space-y-4">
              {!photoPreview ? (
                <label className="border-2 border-dashed border-zinc-800 hover:border-violet-550/50 bg-zinc-900/30 hover:bg-zinc-900/60 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition group">
                  <Upload className="w-6 h-6 text-zinc-500 group-hover:text-violet-400 transition transform group-hover:-translate-y-0.5" />
                  <span className="text-xs font-bold text-zinc-300 group-hover:text-white transition">Selecionar Foto do Prato</span>
                  <span className="text-[10px] text-zinc-500">PNG, JPG ou tirar foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 max-h-48 flex items-center justify-center">
                    <img
                      src={photoPreview}
                      alt="Refeição"
                      className="w-full h-full object-cover max-h-48"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoPreview(null);
                        setScanResult(null);
                        setScanError(null);
                      }}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition text-xs cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>

                  {scanError && (
                    <div className="p-3 bg-rose-550/10 border border-rose-500/20 text-rose-450 text-xs rounded-xl font-medium">
                      {scanError}
                    </div>
                  )}

                  {scanResult && (
                    <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl space-y-3 animate-scale-up">
                      <div className="border-b border-zinc-850 pb-2">
                        <span className="text-[9px] font-bold text-violet-400 uppercase tracking-wide block mb-0.5">Alimento Identificado</span>
                        <h4 className="text-xs font-bold text-white leading-snug">{scanResult.mealName}</h4>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Porções Estimadas:</span>
                        <ul className="list-disc list-inside text-[11px] text-zinc-400 space-y-0.5">
                          {scanResult.items.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-850">
                        <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-900 text-center">
                          <span className="text-[9px] font-bold text-zinc-500 uppercase block mb-0.5">Calorias</span>
                          <span className="text-xs font-extrabold text-orange-400">{scanResult.calories} kcal</span>
                        </div>
                        <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-900 text-center">
                          <span className="text-[9px] font-bold text-zinc-500 uppercase block mb-0.5">Proteínas</span>
                          <span className="text-xs font-extrabold text-violet-400">{scanResult.protein} g</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {!scanResult && (
                    <button
                      type="button"
                      onClick={handleAnalyzePhoto}
                      disabled={scanLoading}
                      className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold rounded-xl transition duration-150 cursor-pointer text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-650/20"
                    >
                      {scanLoading ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Analisando com Visão IA...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Analisar Refeição
                        </>
                      )}
                    </button>
                  )}

                  {scanResult && (
                    <button
                      type="button"
                      onClick={handleLogScanResult}
                      disabled={loading}
                      className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition duration-150 cursor-pointer text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20"
                    >
                      Logar Refeição Analisada (+25 XP)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-3xl flex gap-3 text-zinc-500 text-[10px] leading-normal items-start">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-zinc-650" />
            <span>
              Aviso: O QuestFit fornece alvos alimentares baseados em TDEE. Nós não prescrevemos dietas médicas nem substituímos nutricionistas.
            </span>
          </div>
        </div>

        {/* Center & Right Column: Meal suggestions & grocery list */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          
          {/* Meal Suggestions Board */}
          <div className="glass-panel p-6 rounded-[32px] space-y-4 relative">
            
            <div className="flex justify-between items-center pb-2 border-b border-zinc-850">
              <h3 className="font-bold text-sm text-zinc-350 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                Cardápio IA do Dia
              </h3>

              <div className="flex gap-2">
                {hasCustomMeals && (
                  <button
                    type="button"
                    onClick={handleResetMeals}
                    className="py-1.5 px-3 bg-zinc-955 hover:bg-rose-950/20 border border-zinc-800 hover:border-rose-900/35 text-zinc-400 hover:text-rose-400 font-bold rounded-xl transition duration-150 cursor-pointer text-[10px] flex items-center gap-1.5 animate-scale-up"
                    title="Restaurar cardápio original da dieta"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Resetar Padrão
                  </button>
                )}

                {/* Export diet sharing button */}
                <button
                  type="button"
                  onClick={handleExportDiet}
                  className="py-1.5 px-3 bg-zinc-955 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white font-bold rounded-xl transition duration-150 cursor-pointer text-[10px] flex items-center gap-1.5"
                  title="Copiar dieta formatada para compartilhar"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Exportar Dieta
                </button>
              </div>
            </div>

            {copySuccess && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 text-[10px] rounded-xl font-bold animate-slide-down">
                Cardápio e lista de compras copiados para a área de transferência!
              </div>
            )}
            
            <div className="space-y-3">
              {meals.map((meal, idx) => {
                const isEditing = editingMealIndex === idx;
                const isRegenerating = regeneratingIndex === idx;

                return (
                  <div key={idx} className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-2 relative transition group">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wide">{meal.name}</span>
                      
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMealIndex(idx);
                            setCustomInstruction('');
                            setRegenerateError(null);
                          }}
                          className="py-1 px-2 bg-zinc-900/60 md:bg-zinc-950/20 hover:bg-zinc-850 text-zinc-400 hover:text-yellow-400 border border-zinc-800/60 hover:border-zinc-700/85 rounded-xl transition duration-155 cursor-pointer text-[10px] flex items-center gap-1"
                        >
                          <Wand2 className="w-3 h-3 text-yellow-500" />
                          Ajustar
                        </button>
                      )}
                    </div>
                    
                    {!isEditing ? (
                      <p className="text-xs text-zinc-300 leading-relaxed">{meal.desc}</p>
                    ) : (
                      <div className="space-y-3 pt-1">
                        <p className="text-[11px] text-zinc-400 italic">Atual: "{meal.desc}"</p>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-zinc-500 uppercase">O que melhorar ou substituir?</label>
                          <textarea
                            className="w-full bg-zinc-950 border border-zinc-800 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 text-white placeholder-zinc-600 resize-none"
                            rows={2}
                            placeholder="Ex: Não gosto de ovo, sugira outra coisa; Não tenho esse ingrediente; Quero algo mais leve..."
                            value={customInstruction}
                            onChange={(e) => setCustomInstruction(e.target.value)}
                            disabled={isRegenerating}
                          />
                        </div>
                        
                        {regenerateError && (
                          <div className="text-[10px] text-rose-455 font-medium">
                            {regenerateError}
                          </div>
                        )}

                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMealIndex(null);
                              setCustomInstruction('');
                              setRegenerateError(null);
                            }}
                            className="py-1.5 px-3 bg-zinc-955 hover:bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-white font-bold rounded-xl transition duration-150 cursor-pointer text-[10px]"
                            disabled={isRegenerating}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRegenerateMeal(idx)}
                            disabled={isRegenerating || !customInstruction.trim()}
                            className="py-1.5 px-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold rounded-xl transition duration-150 cursor-pointer text-[10px] flex items-center gap-1.5"
                          >
                            {isRegenerating ? (
                              <>
                                <div className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin"></div>
                                Customizando...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3 text-yellow-300" />
                                Recomendar Novo
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grocery List Board */}
          <div className="glass-panel p-6 rounded-[32px] space-y-4">
            <h3 className="font-bold text-sm text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-violet-400" />
              Lista de Compras
            </h3>
            <p className="text-xs text-zinc-400">Garanta os ingredientes básicos para a semana de acordo com o seu perfil.</p>

            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
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
