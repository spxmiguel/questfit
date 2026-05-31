import React, { useState } from 'react';
import { loginWithEmail, registerWithEmail, loginWithGoogle } from '../services/authService';
import { isFirebaseEnabled } from '../services/firebase';
import { Dumbbell, Mail, Lock, User, Sparkles } from 'lucide-react';

interface AuthProps {
  onSuccess: () => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, name || 'Guerreiro');
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao entrar com o Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    // Guest access (triggers mock login inside authService)
    loginWithEmail('convidado@questfit.com', '123456')
      .then(() => onSuccess())
      .catch(err => setError(err.message));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
      {/* Background decoration orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full filter blur-[80px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full filter blur-[80px] pointer-events-none"></div>

      <div className="w-full max-w-md space-y-6 z-10">
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 rounded-3xl bg-violet-600/20 text-violet-400 border border-violet-500/20 mb-2">
            <Dumbbell className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-violet-400 bg-clip-text text-transparent">
            QuestFit
          </h1>
          <p className="text-zinc-400 text-sm">AI Fitness RPG progression system</p>
        </div>

        <div className="glass-panel p-8 rounded-[32px] shadow-2xl relative">
          <h2 className="text-xl font-bold mb-6 text-center text-white">
            {isLogin ? 'Entre na sua Guilda' : 'Crie seu Personagem'}
          </h2>

          {!isFirebaseEnabled && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3 text-amber-400 text-xs leading-normal">
              <Sparkles className="w-5 h-5 flex-shrink-0" />
              <div>
                <span className="font-semibold block mb-0.5">Modo de Demonstração Ativo</span>
                O Firebase não foi configurado. Você pode jogar localmente no navegador! Crie uma conta simulada ou clique abaixo para entrar.
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                <label htmlFor="name-input" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Nome do Herói
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    id="name-input"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-zinc-600 text-sm"
                    placeholder="Ex: Conan, Lara Croft"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="email-input" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  id="email-input"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-zinc-600 text-sm"
                  placeholder="heroi@guilda.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="password-input" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  id="password-input"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-zinc-600 text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold rounded-2xl transition duration-200 cursor-pointer shadow-lg shadow-violet-600/20 text-sm flex items-center justify-center gap-2 mt-6"
            >
              {loading ? 'Processando...' : isLogin ? 'Entrar na Jornada' : 'Criar Conta'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-900/60 backdrop-blur px-3 text-zinc-500">Ou continue com</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-2 text-xs font-bold"
            >
              <Sparkles className="w-4 h-4 text-pink-400" /> Google
            </button>
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={loading}
              className="py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-2 text-xs font-bold"
            >
              <Sparkles className="w-4 h-4 text-amber-500" /> Convidado
            </button>
          </div>

          <div className="text-center mt-6">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs text-zinc-400 hover:text-white transition"
            >
              {isLogin ? 'Não tem um herói criado? Crie sua conta' : 'Já tem um personagem? Entre aqui'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
