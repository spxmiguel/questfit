import React, { useState, useEffect } from 'react';
import { getStoredGeminiKey, setStoredGeminiKey, getStoredGroqKey, setStoredGroqKey } from '../services/aiService';
import { isFirebaseEnabled } from '../services/firebase';
import { Key, ShieldCheck, Database, RefreshCw, AlertTriangle, Cpu } from 'lucide-react';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setApiKey(getStoredGeminiKey());
    setGroqKey(getStoredGroqKey());
  }, []);

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredGeminiKey(apiKey.trim());
    setStoredGroqKey(groqKey.trim());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetData = () => {
    if (window.confirm('Tem certeza de que deseja redefinir toda a sua ficha de personagem? Isso apagará seu nível, histórico de bate-papo, peso e conquistas do navegador.')) {
      const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('questfit_'));
      keysToRemove.forEach(k => localStorage.removeItem(k));
      window.location.reload();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Painel de Configurações</h1>
        <p className="text-zinc-400">Gerencie sua chave de API, conexões de banco de dados e dados locais.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Connection status card */}
        <div className="md:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Database className="w-5 h-5 text-violet-400" />
              Status de Rede
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <span className="text-sm font-medium text-zinc-300">Firebase Firestore</span>
                {isFirebaseEnabled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="w-3.5 h-3.5" /> Conectado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <AlertTriangle className="w-3.5 h-3.5" /> Modo Local
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 leading-normal">
                {isFirebaseEnabled 
                  ? 'Os dados do seu personagem são armazenados na nuvem e sincronizados em qualquer dispositivo.'
                  : 'Os dados estão sendo armazenados exclusivamente no cache (LocalStorage) do seu navegador para fins de teste.'}
              </p>
            </div>
          </div>
        </div>

        {/* API keys card */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-3xl space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Key className="w-5 h-5 text-pink-400" />
              Configuração das IAs (AI Coach)
            </h2>

            <form onSubmit={handleSaveKeys} className="space-y-5">
              {/* Groq Key */}
              <div className="space-y-2">
                <label htmlFor="groq-key" className="text-sm font-bold text-zinc-350 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-violet-400" /> Groq API Key (Recomendado)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    id="groq-key"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-zinc-700 font-mono text-sm"
                    placeholder="Cole sua API Key do Groq aqui (gsk_...)"
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                  />
                </div>
                <p className="text-[11px] text-zinc-500 leading-normal">
                  Chave utilizada para rodar o modelo de alto desempenho **Llama 3.3 70B**. O Groq é priorizado se ambas as chaves estiverem presentes.
                </p>
              </div>

              {/* Gemini Key */}
              <div className="space-y-2">
                <label htmlFor="api-key" className="text-sm font-bold text-zinc-355 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-pink-400" /> Gemini API Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    id="api-key"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-zinc-700 font-mono text-sm"
                    placeholder="Cole sua API Key do Gemini aqui (AIzaSy...)"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <p className="text-[11px] text-zinc-500 leading-normal">
                  Chave utilizada para rodar o modelo **Gemini 2.5 Flash** como alternativa secundária.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
                <div className="flex flex-col gap-1">
                  <a 
                    href="https://console.groq.com/keys" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-violet-400 hover:underline"
                  >
                    Obter chave do Groq Console (Gratuito/Pago)
                  </a>
                  <a 
                    href="https://aistudio.google.com/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-pink-450 hover:underline"
                  >
                    Obter chave do Google AI Studio (Gratuito)
                  </a>
                </div>
                
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-violet-650 hover:bg-violet-600 font-bold rounded-2xl transition duration-200 cursor-pointer text-sm shadow-lg shadow-violet-600/20"
                >
                  Salvar Configurações
                </button>
              </div>

              {saveSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl font-medium">
                  Configurações de IA salvas com sucesso! O treinador correspondente está ativo.
                </div>
              )}
            </form>
          </div>

          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-rose-400">
              <RefreshCw className="w-5 h-5" />
              Zona de Perigo
            </h2>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Redefinir Personagem</p>
                <p className="text-xs text-zinc-400">Apaga toda a memória, chat, nível e conquistas armazenados no cache.</p>
              </div>
              <button
                type="button"
                onClick={handleResetData}
                className="px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 hover:border-transparent font-bold rounded-2xl transition duration-200 cursor-pointer text-sm self-start sm:self-center"
              >
                Limpar cache local
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
