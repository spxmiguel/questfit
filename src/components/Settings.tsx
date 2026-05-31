import React, { useState, useEffect } from 'react';
import { getStoredGeminiKey, setStoredGeminiKey, getStoredGroqKey, setStoredGroqKey } from '../services/aiService';
import { isFirebaseEnabled } from '../services/firebase';
import { saveUserMemory, saveProgressLog, getProgressLogForDate, deleteAllUserData } from '../services/dbService';
import { awardXp } from '../services/rpgService';
import { calculateBMR, calculateTDEE, calculateBMI } from '../utils/healthMath';
import { getLocalDateString } from '../utils/dateUtils';
import { UserProfile, UserMemory } from '../types';
import { Key, ShieldCheck, Database, RefreshCw, AlertTriangle, Cpu, User, Scale, Activity, Heart, Info, Dumbbell, Apple } from 'lucide-react';

interface SettingsProps {
  userProfile: UserProfile;
  userMemory: UserMemory;
  onMemoryUpdate: (newMemory: UserMemory, updatedProfile?: UserProfile, newlyUnlockedAchs?: any[]) => void;
}

export default function Settings({ userProfile, userMemory, onMemoryUpdate }: SettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Physical states
  const [age, setAge] = useState(userMemory.physicalProfile?.age || '');
  const [height, setHeight] = useState(userMemory.physicalProfile?.heightCm || '');
  const [weight, setWeight] = useState(userMemory.physicalProfile?.weightKg || userMemory.goals?.currentWeightKg || '');
  const [gender, setGender] = useState<'male' | 'female'>(userMemory.physicalProfile?.gender || 'male');
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive'>(userMemory.physicalProfile?.activityLevel || 'moderate');
  const [physicalSaveSuccess, setPhysicalSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Equipment states
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(userMemory.preferences?.equipment || []);
  const [equipmentSaveSuccess, setEquipmentSaveSuccess] = useState(false);

  // Dietary states
  const [dietType, setDietType] = useState<'omnivore' | 'vegetarian' | 'vegan' | 'carnivore' | 'keto' | 'lowcarb'>(userMemory.preferences?.dietType || 'omnivore');
  const [allergiesText, setAllergiesText] = useState(userMemory.preferences?.allergies?.join(', ') || '');
  const [dietSaveSuccess, setDietSaveSuccess] = useState(false);

  useEffect(() => {
    setApiKey(getStoredGeminiKey());
    setGroqKey(getStoredGroqKey());
    if (userMemory.preferences?.equipment) {
      setSelectedEquipment(userMemory.preferences.equipment);
    }
    if (userMemory.preferences?.dietType) {
      setDietType(userMemory.preferences.dietType);
    }
    if (userMemory.preferences?.allergies) {
      setAllergiesText(userMemory.preferences.allergies.join(', '));
    }
  }, [userMemory]);

  const handleSaveDietary = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const allergiesList = allergiesText
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);

      const updatedMemory: UserMemory = {
        ...userMemory,
        preferences: {
          ...userMemory.preferences,
          dietType,
          allergies: allergiesList
        },
        lastUpdated: new Date().toISOString()
      };

      await saveUserMemory(userProfile.uid, updatedMemory);
      onMemoryUpdate(updatedMemory);
      setDietSaveSuccess(true);
      setTimeout(() => setDietSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEquipment = (eq: string) => {
    if (selectedEquipment.includes(eq)) {
      setSelectedEquipment(prev => prev.filter(e => e !== eq));
    } else {
      setSelectedEquipment(prev => [...prev, eq]);
    }
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updatedMemory: UserMemory = {
        ...userMemory,
        preferences: {
          ...userMemory.preferences,
          equipment: selectedEquipment
        },
        lastUpdated: new Date().toISOString()
      };

      await saveUserMemory(userProfile.uid, updatedMemory);
      onMemoryUpdate(updatedMemory);
      setEquipmentSaveSuccess(true);
      setTimeout(() => setEquipmentSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredGeminiKey(apiKey.trim());
    setStoredGroqKey(groqKey.trim());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSavePhysical = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const weightVal = weight ? parseFloat(weight.toString()) : undefined;
      const heightVal = height ? parseInt(height.toString()) : undefined;
      const ageVal = age ? parseInt(age.toString()) : undefined;

      const updatedMemory: UserMemory = {
        ...userMemory,
        goals: {
          ...userMemory.goals,
          currentWeightKg: weightVal !== undefined ? weightVal : userMemory.goals?.currentWeightKg
        },
        physicalProfile: {
          age: ageVal,
          heightCm: heightVal,
          weightKg: weightVal,
          gender,
          activityLevel
        },
        lastUpdated: new Date().toISOString()
      };

      await saveUserMemory(userProfile.uid, updatedMemory);

      const todayStr = getLocalDateString();
      const log = await getProgressLogForDate(userProfile.uid, todayStr);
      await saveProgressLog(userProfile.uid, {
        ...log,
        weight: weightVal
      });

      // Award small XP (+10 XP) for profile save
      const r = await awardXp(userProfile.uid, userProfile, 10, 'quest');

      onMemoryUpdate(updatedMemory, r.profile, r.unlockedAchievements);
      setPhysicalSaveSuccess(true);
      setTimeout(() => setPhysicalSaveSuccess(false), 3000);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    const confirmed = window.confirm(
      'Tem certeza de que deseja redefinir TODOS os seus dados?\n\n' +
      'Isso apagará permanentemente seu nível, XP, histórico de treinos, peso, conquistas e metas — ' +
      'inclusive os dados salvos na nuvem (Firebase).\n\n' +
      'Esta ação NÃO pode ser desfeita.'
    );
    if (!confirmed) return;
    try {
      await deleteAllUserData(userProfile.uid);
    } catch (err) {
      console.error('Erro ao apagar dados na nuvem:', err);
    }
    window.location.reload();
  };

  const physicalProfile = {
    age: age ? parseInt(age.toString()) : undefined,
    heightCm: height ? parseInt(height.toString()) : undefined,
    weightKg: weight ? parseFloat(weight.toString()) : undefined,
    gender,
    activityLevel
  };

  const bmr = calculateBMR(physicalProfile);
  const tdee = calculateTDEE(physicalProfile);
  const bmiInfo = calculateBMI(physicalProfile.weightKg, physicalProfile.heightCm);

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Painel de Ajustes</h1>
        <p className="text-zinc-400">Gerencie sua ficha física, chaves das IAs e dados locais de sua conta.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Network status and danger zone */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Net Connection Status */}
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Database className="w-5 h-5 text-violet-400" />
              Sincronização Cloud
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <span className="text-xs font-semibold text-zinc-300">Firestore Cloud</span>
                {isFirebaseEnabled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                    <ShieldCheck className="w-3.5 h-3.5" /> Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wide">
                    <AlertTriangle className="w-3.5 h-3.5" /> Local
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isFirebaseEnabled 
                  ? 'Os dados estão sendo salvos em nuvem de forma segura vinculados à sua conta.'
                  : 'Modo simulado ativo. Seus dados estão salvos apenas no cache local deste navegador.'}
              </p>
            </div>
          </div>

          {/* Reset cache panel */}
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2 text-rose-400">
              <RefreshCw className="w-5 h-5 animate-spin-hover" />
              Zona de Perigo
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Deseja redefinir localmente sua ficha de personagem? Isso apagará seu progresso no cache do navegador.
            </p>
            <button
              type="button"
              onClick={handleResetData}
              className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 hover:border-transparent font-bold rounded-2xl transition duration-150 cursor-pointer text-xs"
            >
              Redefinir Dados de Cache
            </button>
          </div>
        </div>

        {/* Right Column: Physical profile and AI Keys */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Physical Metrics Form */}
          <div className="glass-panel p-6 rounded-[32px] space-y-6">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                <User className="w-5 h-5 text-violet-400" />
                Ficha Física
              </h2>
              <p className="text-xs text-zinc-400 mt-1">Configure seus dados corporais para a IA calcular seu gasto metabólico e personalizar treinos.</p>
            </div>

            <form onSubmit={handleSavePhysical} className="space-y-6">
              
              {/* Form Inputs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Idade (anos)</label>
                  <input
                    type="number"
                    placeholder="Ex: 28"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    required
                    min="1"
                    max="120"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Altura (cm)</label>
                  <input
                    type="number"
                    placeholder="Ex: 175"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    required
                    min="50"
                    max="250"
                  />
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Peso Atual (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ex: 78.4"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    required
                    min="20"
                    max="300"
                  />
                </div>
              </div>

              {/* Gender and Activity Level Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block">Gênero Biológico</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition cursor-pointer ${
                        gender === 'male'
                          ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      Masculino
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition cursor-pointer ${
                        gender === 'female'
                          ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      Feminino
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block">Nível de Atividade Geral</label>
                  <select
                    value={activityLevel}
                    onChange={(e) => setActivityLevel(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs"
                  >
                    <option value="sedentary">Sedentário (Sem exercícios)</option>
                    <option value="light">Levemente Ativo (Exercício 1-3x/semana)</option>
                    <option value="moderate">Moderadamente Ativo (Exercício 3-5x/semana)</option>
                    <option value="active">Muito Ativo (Exercício 6-7x/semana)</option>
                    <option value="veryActive">Super Ativo (Atleta/Exercício pesado diário)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Health Calculations Results Display Card */}
              <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* BMI Info */}
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">IMC (Massa Corporal)</span>
                  <div className="flex flex-col sm:flex-row items-center gap-1.5">
                    <span className="text-sm font-extrabold text-white">{bmiInfo.value || '--'}</span>
                    {bmiInfo.value > 0 && (
                      <span className={`text-[10px] font-bold ${bmiInfo.color}`}>
                        ({bmiInfo.category})
                      </span>
                    )}
                  </div>
                </div>

                {/* BMR Info */}
                <div className="space-y-1 text-center sm:text-left border-y sm:border-y-0 sm:border-x border-zinc-900 py-3 sm:py-0 sm:px-4">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Gasto Basal (BMR)</span>
                  <span className="text-sm font-extrabold text-violet-400 block">{bmr ? `${bmr} kcal` : '--'}</span>
                </div>

                {/* TDEE Info */}
                <div className="space-y-1 text-center sm:text-left sm:pl-4">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Gasto Diário (TDEE)</span>
                  <span className="text-sm font-extrabold text-orange-400 block">{tdee ? `${tdee} kcal` : '--'}</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition duration-150 cursor-pointer text-xs shadow-lg shadow-violet-650/20"
                >
                  {loading ? 'Sincronizando...' : 'Salvar Perfil Físico'}
                </button>
              </div>

              {physicalSaveSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-semibold">
                  Perfil físico atualizado e sincronizado na nuvem! (+10 XP)
                </div>
              )}
            </form>
          </div>

          {/* Card: Home Equipment selection */}
          <div className="glass-panel p-6 rounded-[32px] space-y-6">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                <Dumbbell className="w-5 h-5 text-violet-400" />
                Equipamentos em Casa
              </h2>
              <p className="text-xs text-zinc-400 mt-1">Marque quais equipamentos você possui em casa para adaptar seus treinos automáticos de calistenia.</p>
            </div>

            <form onSubmit={handleSaveEquipment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'dumbbells', label: 'Halteres / Pesos' },
                  { id: 'esteira', label: 'Esteira' },
                  { id: 'handgrip', label: 'Handgrip' },
                  { id: 'resistance-bands', label: 'Elásticos / Bands' },
                  { id: 'pullup-bar', label: 'Barra de Porta' }
                ].map(eq => {
                  const isChecked = selectedEquipment.includes(eq.id);
                  return (
                    <button
                      key={eq.id}
                      type="button"
                      onClick={() => handleToggleEquipment(eq.id)}
                      className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition cursor-pointer ${
                        isChecked 
                          ? 'border-violet-500/30 bg-violet-600/10 text-violet-300' 
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-850'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isChecked ? 'bg-violet-500 border-violet-500 text-white' : 'border-zinc-700'
                      }`}>
                        {isChecked && <span className="text-[10px] font-bold">✓</span>}
                      </div>
                      <span className="text-xs font-semibold">{eq.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition duration-150 cursor-pointer text-xs shadow-lg shadow-violet-650/20"
                >
                  {loading ? 'Salvando...' : 'Salvar Equipamentos'}
                </button>
              </div>

              {equipmentSaveSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-semibold">
                  Lista de equipamentos atualizada com sucesso!
                </div>
              )}
            </form>
          </div>

          {/* Card: Dietary Preferences */}
          <div className="glass-panel p-6 rounded-[32px] space-y-6">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                <Apple className="w-5 h-5 text-violet-400" />
                Preferências e Restrições Alimentares
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Defina seu tipo de dieta e os alimentos que você não come para que o Coach crie refeições ideais.
              </p>
            </div>

            <form onSubmit={handleSaveDietary} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block">Tipo de Dieta</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'omnivore', label: 'Onívora (Tudo)' },
                    { id: 'vegetarian', label: 'Vegetariana' },
                    { id: 'vegan', label: 'Vegana' },
                    { id: 'carnivore', label: 'Carnívora' },
                    { id: 'keto', label: 'Cetogênica (Keto)' },
                    { id: 'lowcarb', label: 'Low Carb' }
                  ].map(diet => {
                    const isSelected = dietType === diet.id;
                    return (
                      <button
                        key={diet.id}
                        type="button"
                        onClick={() => setDietType(diet.id as any)}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition cursor-pointer ${
                          isSelected
                            ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850'
                        }`}
                      >
                        {diet.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="allergies-input" className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block">
                  Alimentos que você NÃO come (separados por vírgula)
                </label>
                <textarea
                  id="allergies-input"
                  rows={2}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs placeholder-zinc-650"
                  placeholder="Ex: lactose, amendoim, coentro, banana, soja"
                  value={allergiesText}
                  onChange={(e) => setAllergiesText(e.target.value)}
                />
                <p className="text-[10px] text-zinc-500 leading-normal">
                  Insira alergias ou alimentos indesejados. O Coach usará isso para evitar sugerir estes alimentos.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition duration-150 cursor-pointer text-xs shadow-lg shadow-violet-650/20"
                >
                  {loading ? 'Salvando...' : 'Salvar Preferências Alimentares'}
                </button>
              </div>

              {dietSaveSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-semibold">
                  Preferências alimentares atualizadas com sucesso!
                </div>
              )}
            </form>
          </div>

          {/* Card 2: AI Config keys */}
          <div className="glass-panel p-6 rounded-[32px] space-y-6">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Key className="w-5 h-5 text-pink-400" />
                Configurações de Inteligência Artificial
              </h2>
              <p className="text-xs text-zinc-400 mt-1">Conecte suas chaves para habilitar respostas reais, scanner de alimentos e diário de treino inteligentes.</p>
            </div>

            <form onSubmit={handleSaveKeys} className="space-y-5">
              
              {/* Groq Key input with direct retrieval link right underneath */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="groq-key" className="text-xs font-bold text-zinc-350 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-violet-400" /> Groq API Key (Recomendado - Llama 3.3)
                  </label>
                  <a 
                    href="https://console.groq.com/keys" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] text-violet-400 hover:underline flex items-center gap-0.5"
                  >
                    👉 Pegar chave aqui (Grátis)
                  </a>
                </div>
                <input
                  type="password"
                  id="groq-key"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder-zinc-700 font-mono text-xs"
                  placeholder="Cole sua API Key do Groq aqui (gsk_...)"
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                />
                <p className="text-[10px] text-zinc-500 leading-normal">
                  Chave utilizada para rodar o modelo de alto desempenho **Llama 3.3 70B**. O Groq é priorizado se ambas as chaves estiverem presentes.{' '}
                  <a 
                    href="https://console.groq.com/keys" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-violet-400 hover:underline font-bold"
                  >
                    Clique aqui para pegar sua Key do Groq.
                  </a>
                </p>
              </div>

              {/* Gemini Key input with direct retrieval link right underneath */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="api-key" className="text-xs font-bold text-zinc-355 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-pink-400" /> Gemini API Key (Analise de Pratos)
                  </label>
                  <a 
                    href="https://aistudio.google.com/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] text-pink-400 hover:underline flex items-center gap-0.5"
                  >
                    👉 Pegar chave aqui (Grátis)
                  </a>
                </div>
                <input
                  type="password"
                  id="api-key"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder-zinc-700 font-mono text-xs"
                  placeholder="Cole sua API Key do Gemini aqui (AIzaSy...)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-[10px] text-zinc-500 leading-normal">
                  Chave utilizada para rodar o modelo **Gemini 2.5 Flash** para scanner de fotos e chat secundário.{' '}
                  <a 
                    href="https://aistudio.google.com/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-pink-400 hover:underline font-bold"
                  >
                    Clique aqui para pegar sua Key do Gemini.
                  </a>
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-pink-600 hover:bg-pink-500 font-bold text-white rounded-xl transition duration-150 cursor-pointer text-xs shadow-lg shadow-pink-600/20"
                >
                  Salvar Configurações de IA
                </button>
              </div>

              {saveSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-semibold">
                  Chaves de Inteligência Artificial salvas localmente com sucesso!
                </div>
              )}
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
