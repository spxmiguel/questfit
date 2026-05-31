import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, UserMemory, UserProfile, ProgressLog } from '../types';
import { saveUserMemory, getProgressLogForDate, saveProgressLog } from '../services/dbService';
import { sendNutritionistMessage, getStoredGeminiKey, getStoredGroqKey } from '../services/aiService';
import { getLocalDateString } from '../utils/dateUtils';
import {
  Send, Apple, Sparkles, Trash2, ShoppingCart, CheckCircle,
  ChevronDown, ChevronUp, Copy, Check
} from 'lucide-react';

interface NutritionistChatProps {
  userProfile: UserProfile;
  userMemory: UserMemory;
  onMemoryUpdate: (newMemory: UserMemory, updatedProfile?: UserProfile, achs?: any[]) => void;
}

const HISTORY_KEY = (uid: string) => `questfit_nutritionist_chat_${uid}`;

const WELCOME_MSG: ChatMessage = {
  id: 'nutri_welcome',
  sender: 'ai',
  text: `Olá! Sou sua Nutricionista IA 🥗\n\nVou montar um cardápio personalizado pra você através da nossa conversa.\n\nMe conta: como são seus hábitos alimentares hoje? O que você costuma comer no café da manhã?`,
  timestamp: new Date().toISOString()
};

export default function NutritionistChat({ userProfile, userMemory, onMemoryUpdate }: NutritionistChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [pendingMealPlan, setPendingMealPlan] = useState<{ name: string; desc: string }[] | null>(null);
  const [pendingGroceryList, setPendingGroceryList] = useState<string[] | null>(null);
  const [mealPlanApplied, setMealPlanApplied] = useState(false);
  const [groceryCopied, setGroceryCopied] = useState(false);
  const [showGroceryList, setShowGroceryList] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const todayStr = getLocalDateString();
  const hasApiKey = !!(getStoredGeminiKey() || getStoredGroqKey());

  // Load chat history
  useEffect(() => {
    const saved = localStorage.getItem(HISTORY_KEY(userProfile.uid));
    if (saved) {
      try {
        const parsed: ChatMessage[] = JSON.parse(saved);
        setMessages(parsed.length > 0 ? parsed : [WELCOME_MSG]);
      } catch {
        setMessages([WELCOME_MSG]);
      }
    } else {
      setMessages([WELCOME_MSG]);
    }

    // Restore pending meal plan / grocery list from last session
    const savedPlan = localStorage.getItem(`questfit_nutri_pending_plan_${userProfile.uid}`);
    if (savedPlan) {
      try { setPendingMealPlan(JSON.parse(savedPlan)); } catch {}
    }
    const savedGrocery = localStorage.getItem(`questfit_nutri_pending_grocery_${userProfile.uid}`);
    if (savedGrocery) {
      try { setPendingGroceryList(JSON.parse(savedGrocery)); } catch {}
    }
  }, [userProfile.uid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const saveHistory = (msgs: ChatMessage[]) => {
    localStorage.setItem(HISTORY_KEY(userProfile.uid), JSON.stringify(msgs.slice(-80)));
  };

  const showNotif = (text: string, durationMs = 5000) => {
    setNotification(text);
    setTimeout(() => setNotification(null), durationMs);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || loading) return;

    setInputText('');

    const userMsg: ChatMessage = {
      id: `nutri_user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString()
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await sendNutritionistMessage(text, newMessages, userMemory);

      const aiMsg: ChatMessage = {
        id: `nutri_ai_${Date.now()}`,
        sender: 'ai',
        text: response.text,
        timestamp: new Date().toISOString()
      };

      const finalMessages = [...newMessages, aiMsg];
      setMessages(finalMessages);
      saveHistory(finalMessages);

      // Handle meal plan suggestion
      if (response.mealPlan && response.mealPlan.length >= 4) {
        setPendingMealPlan(response.mealPlan);
        setMealPlanApplied(false);
        localStorage.setItem(`questfit_nutri_pending_plan_${userProfile.uid}`, JSON.stringify(response.mealPlan));
      }

      // Handle grocery list
      if (response.groceryList && response.groceryList.length > 0) {
        setPendingGroceryList(response.groceryList);
        setShowGroceryList(false);
        localStorage.setItem(`questfit_nutri_pending_grocery_${userProfile.uid}`, JSON.stringify(response.groceryList));
      }

      // Handle memory update (food preferences, restrictions)
      if (response.memoryUpdate) {
        const updatedMemory: UserMemory = {
          ...userMemory,
          goals: { ...userMemory.goals, ...response.memoryUpdate.goals },
          preferences: { ...userMemory.preferences, ...response.memoryUpdate.preferences },
          wellbeing: {
            ...userMemory.wellbeing,
            ...(response.memoryUpdate.wellbeing || {}),
            foodComplaints: [
              ...(userMemory.wellbeing?.foodComplaints || []),
              ...(response.memoryUpdate.wellbeing?.foodComplaints || [])
            ].filter((v, i, a) => a.indexOf(v) === i)
          },
          lastUpdated: new Date().toISOString()
        };
        await saveUserMemory(userProfile.uid, updatedMemory);
        onMemoryUpdate(updatedMemory);
      }

      // Handle food log registration (calorie tracking)
      if (response.logUpdate &&
        (response.logUpdate.caloriesConsumed !== undefined || response.logUpdate.proteinConsumedG !== undefined)) {
        const log = await getProgressLogForDate(userProfile.uid, todayStr);
        const updatedLog: ProgressLog = {
          ...log,
          caloriesConsumed: response.logUpdate.caloriesConsumed !== undefined
            ? response.logUpdate.caloriesConsumed
            : log.caloriesConsumed,
          proteinConsumedG: response.logUpdate.proteinConsumedG !== undefined
            ? response.logUpdate.proteinConsumedG
            : log.proteinConsumedG
        };
        await saveProgressLog(userProfile.uid, updatedLog);

        if (response.logUpdate.caloriesConsumed) {
          showNotif(`🍽️ Refeição registrada! ~${response.logUpdate.caloriesConsumed} kcal hoje`);
        }
      }
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `nutri_err_${Date.now()}`,
        sender: 'ai',
        text: `Hmm, tive um problema de conexão. Verifique sua chave de API nas Configurações e tente novamente.`,
        timestamp: new Date().toISOString()
      };
      const erredMessages = [...newMessages, errMsg];
      setMessages(erredMessages);
      saveHistory(erredMessages);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyMealPlan = () => {
    if (!pendingMealPlan) return;

    const diet = userMemory.preferences?.dietType || 'omnivore';

    // Save to AI plan cache (NutritionSystem picks this up)
    const aiPlanKey = `questfit_ai_mealplan_${userProfile.uid}_${diet}_${todayStr}`;
    localStorage.setItem(aiPlanKey, JSON.stringify(pendingMealPlan));

    // Also save as custom meals (persists across days until reset)
    const customKey = `questfit_custom_meals_${userProfile.uid}_${diet}`;
    localStorage.setItem(customKey, JSON.stringify(pendingMealPlan));

    setMealPlanApplied(true);
    showNotif('✅ Cardápio aplicado! Acesse a aba Nutrição para ver o cardápio do dia.', 6000);
  };

  const handleCopyGroceryList = () => {
    if (!pendingGroceryList) return;

    const text = [
      '🛒 Lista de Compras — QuestFit',
      `Gerada em ${new Date().toLocaleDateString('pt-BR')}`,
      '',
      ...pendingGroceryList.map(item => `• ${item}`),
      '',
      '_Criada pela Nutricionista IA_'
    ].join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setGroceryCopied(true);
        setTimeout(() => setGroceryCopied(false), 3000);
      });
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Deseja apagar o histórico desta conversa com a Nutricionista?')) {
      localStorage.removeItem(HISTORY_KEY(userProfile.uid));
      setMessages([WELCOME_MSG]);
      setPendingMealPlan(null);
      setPendingGroceryList(null);
      setMealPlanApplied(false);
      setShowGroceryList(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">

      {/* Header */}
      <div className="glass-panel p-4 rounded-[28px] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-600/20">
            <Apple className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-white text-base">Nutricionista IA</h1>
            <p className="text-[10px] text-emerald-400/80 font-semibold">Monta seu cardápio personalizado conversando</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {pendingMealPlan && !mealPlanApplied && (
            <button
              type="button"
              onClick={handleApplyMealPlan}
              className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition duration-150 cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Aplicar Cardápio ao Dia
            </button>
          )}
          {pendingGroceryList && (
            <button
              type="button"
              onClick={() => setShowGroceryList(v => !v)}
              className="py-1.5 px-3 bg-teal-700/60 hover:bg-teal-600 border border-teal-600/30 text-teal-300 hover:text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition duration-150 cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Lista de Compras
              {showGroceryList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          <button
            type="button"
            onClick={handleClearChat}
            className="p-2 text-zinc-500 hover:text-rose-400 transition cursor-pointer"
            title="Limpar conversa"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-2xl font-semibold">
          {notification}
        </div>
      )}

      {/* Applied badge */}
      {mealPlanApplied && (
        <div className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-2xl font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          Cardápio aplicado! Abra a aba <span className="underline">Nutrição</span> para ver.
        </div>
      )}

      {/* Grocery List panel */}
      {showGroceryList && pendingGroceryList && (
        <div className="glass-panel p-5 rounded-[24px] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-teal-400 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Lista de Compras
            </h3>
            <button
              type="button"
              onClick={handleCopyGroceryList}
              className="py-1.5 px-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              {groceryCopied ? <><Check className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar / WhatsApp</>}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {pendingGroceryList.map((item, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-zinc-900/50 rounded-xl border border-zinc-800 text-xs text-zinc-300">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-zinc-500">
            Clique em "Copiar / WhatsApp" para compartilhar sua lista de compras.
          </p>
        </div>
      )}

      {/* Pending meal plan preview */}
      {pendingMealPlan && !mealPlanApplied && (
        <div className="glass-panel p-4 rounded-[24px] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Cardápio Sugerido
            </span>
            <button
              type="button"
              onClick={handleApplyMealPlan}
              className="py-1 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-[10px] transition cursor-pointer"
            >
              Aplicar ao Dia de Hoje
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {pendingMealPlan.map((meal, i) => (
              <div key={i} className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/80">
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider block mb-0.5">{meal.name}</span>
                <p className="text-[10px] text-zinc-300 leading-relaxed line-clamp-2">{meal.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No API key warning */}
      {!hasApiKey && (
        <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-2xl font-semibold flex items-center gap-2">
          ⚠️ Configure sua chave Gemini ou Groq em <span className="underline">Ajustes → Chaves de IA</span> para conversar com a Nutricionista.
        </div>
      )}

      {/* Chat window */}
      <div className="glass-panel rounded-[28px] overflow-hidden flex flex-col" style={{ minHeight: '420px', maxHeight: '60vh' }}>

        {/* Messages */}
        <div className="flex-grow p-5 overflow-y-auto space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>

              {/* Avatar */}
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                msg.sender === 'ai'
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white'
                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
              }`}>
                {msg.sender === 'ai'
                  ? <Apple className="w-4 h-4" />
                  : (userProfile.displayName?.[0] || 'U').toUpperCase()
                }
              </div>

              {/* Bubble */}
              <div className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.sender === 'user'
                  ? 'bg-emerald-600 text-white rounded-tr-sm'
                  : 'bg-zinc-900 border border-zinc-800/80 text-zinc-100 rounded-tl-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center animate-pulse">
                <Apple className="w-4 h-4" />
              </div>
              <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2.5 h-2.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2.5 h-2.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSendMessage}
          className="p-4 bg-zinc-900/60 border-t border-zinc-800 flex gap-3 items-center"
        >
          <input
            type="text"
            className="flex-grow bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-zinc-500 text-sm"
            placeholder="Me conta o que você comeu, gosta ou não gosta..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !inputText.trim()}
            className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-2xl transition duration-150 cursor-pointer shadow-lg shadow-emerald-600/15 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Safety note */}
        <div className="px-5 py-2 bg-zinc-950 border-t border-zinc-900 text-center text-[10px] text-zinc-500">
          A Nutricionista IA fornece sugestões alimentares. Consulte um nutricionista para orientação clínica.
        </div>
      </div>
    </div>
  );
}
