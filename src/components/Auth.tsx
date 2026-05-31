import React, { useState } from 'react';
import { loginWithEmail, registerWithEmail, loginWithGoogle, sendPasswordlessLink } from '../services/authService';
import { isFirebaseEnabled } from '../services/firebase';
import { Dumbbell, Mail, Lock, User, Sparkles } from 'lucide-react';

interface AuthProps {
  onSuccess: () => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [authMethod, setAuthMethod] = useState<'password' | 'emaillink'>('password');
  const [linkSent, setLinkSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLinkSent(false);
    setLoading(true);

    try {
      if (authMethod === 'emaillink') {
        await sendPasswordlessLink(email);
        setLinkSent(true);
      } else {
        if (isLogin) {
          await loginWithEmail(email, password);
        } else {
          await registerWithEmail(email, password, name || 'Guerreiro');
        }
        onSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setError('');
    setLoading(true);
    loginWithGoogle()
      .then(() => {
        onSuccess();
      })
      .catch((err: any) => {
        console.error(err);
        if (err.code === 'auth/popup-closed-by-user') {
          setError('O login foi cancelado ou a janela travou em branco. Se travou em branco, certifique-se de adicionar "spxmiguel.github.io" em "Domínios Autorizados" no Console do Firebase (Authentication → Configurações → Domínios Autorizados).');
        } else {
          setError(err.message || 'Erro ao entrar com o Google.');
        }
      })
      .finally(() => {
        setLoading(false);
      });
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
          
          {/* Segmented Control for Authentication Method */}
          {!linkSent && (
            <div className="flex p-1 bg-zinc-900 border border-zinc-800 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => { setAuthMethod('password'); setError(''); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition duration-200 cursor-pointer ${
                  authMethod === 'password'
                    ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Com Senha
              </button>
              <button
                type="button"
                onClick={() => { setAuthMethod('emaillink'); setError(''); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition duration-200 cursor-pointer ${
                  authMethod === 'emaillink'
                    ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sem Senha (Link)
              </button>
            </div>
          )}

          <h2 className="text-xl font-bold mb-6 text-center text-white">
            {linkSent 
              ? 'Acesso Enviado' 
              : authMethod === 'emaillink'
              ? 'Entrar sem Senha'
              : isLogin 
              ? 'Entre na sua Guilda' 
              : 'Crie seu Personagem'}
          </h2>

          {!isFirebaseEnabled && !linkSent && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3 text-amber-400 text-xs leading-normal">
              <Sparkles className="w-5 h-5 flex-shrink-0" />
              <div>
                <span className="font-semibold block mb-0.5">Modo de Demonstração Ativo</span>
                O Firebase não foi configurado. Você pode jogar localmente no navegador! Crie uma conta simulada ou use a opção Sem Senha para testar o fluxo de link.
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl font-medium">
              {error}
            </div>
          )}

          {linkSent ? (
            <div className="space-y-6 text-center py-2">
              <div className="inline-flex p-4 rounded-3xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Mail className="w-8 h-8 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-white">Portal de Acesso Enviado!</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Enviamos um link de login mágico para <span className="text-violet-400 font-semibold">{email}</span>.
                </p>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Abra o link enviado na sua caixa de entrada para entrar instantaneamente na guilda.
                </p>
              </div>

              {!isFirebaseEnabled ? (
                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-left space-y-2 mt-4">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide block">Modo Simulação (Mock)</span>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    Como o Firebase está desativado localmente, criamos um atalho simulando o link do e-mail. Clique abaixo para concluir o login:
                  </p>
                  <a
                    href={`${window.location.origin}${window.location.pathname}?mode=signIn&email=${encodeURIComponent(email)}`}
                    className="block text-center py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs font-semibold rounded-xl border border-violet-500/20 transition"
                  >
                    Simular Clique no E-mail
                  </a>
                </div>
              ) : (
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl text-left space-y-2 mt-4 text-[11px] leading-relaxed text-zinc-400">
                  <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wide block">💡 Dica de Configuração</span>
                  <p>
                    Se o e-mail não chegar em alguns minutos, verifique a pasta de <strong>Spam/Lixo Eletrônico</strong>.
                  </p>
                  <p className="mt-1">
                    Para o Firebase enviar e-mails de acesso, o método de login por <strong>Link do E-mail (Sem Senha)</strong> deve estar ativado no Console do Firebase → Authentication → Métodos de Login, e o domínio atual deve constar na lista de domínios autorizados.
                  </p>
                  <p className="mt-1">
                    Caso tenha problemas para configurar, volte e crie um herói com <strong>E-mail/Senha</strong> normal ou use o botão <strong>Convidado</strong> para testar offline instantaneamente!
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setLinkSent(false)}
                className="text-xs text-zinc-400 hover:text-white underline cursor-pointer mt-4 block mx-auto"
              >
                Tentar outro e-mail
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {authMethod === 'password' && !isLogin && (
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
                      required={authMethod === 'password' && !isLogin}
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

              {authMethod === 'password' && (
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
                      required={authMethod === 'password'}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold rounded-2xl transition duration-200 cursor-pointer shadow-lg shadow-violet-600/20 text-sm flex items-center justify-center gap-2 mt-6"
              >
                {loading 
                  ? 'Processando...' 
                  : authMethod === 'emaillink' 
                  ? 'Enviar Link de Acesso'
                  : isLogin 
                  ? 'Entrar na Jornada' 
                  : 'Criar Conta'}
              </button>
            </form>
          )}

          {!linkSent && (
            <>
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

              {authMethod === 'password' && (
                <div className="text-center mt-6">
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-xs text-zinc-400 hover:text-white transition"
                  >
                    {isLogin ? 'Não tem um herói criado? Crie sua conta' : 'Já tem um personagem? Entre aqui'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
