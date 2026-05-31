import React from 'react';
import { UserSession } from '../services/authService';
import { 
  Dumbbell, 
  Trophy, 
  MessageSquare, 
  LineChart, 
  Settings as SettingsIcon, 
  LogOut, 
  Home, 
  ShieldAlert, 
  X,
  Sparkles,
  Compass,
  Carrot
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LayoutProps {
  user: UserSession;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
  levelUpData: {
    show: boolean;
    level: number;
    title: string;
    achievements: any[];
  } | null;
  onCloseLevelUp: () => void;
}

export default function Layout({ 
  user, 
  activeTab, 
  onSelectTab, 
  onLogout, 
  children,
  levelUpData,
  onCloseLevelUp
}: LayoutProps) {
  
  const menuItems = [
    { id: 'dashboard', label: 'Painel', icon: Home },
    { id: 'quests', label: 'Metas', icon: Compass },
    { id: 'workouts', label: 'Treinos', icon: Dumbbell },
    { id: 'nutrition', label: 'Nutrição', icon: Carrot },
    { id: 'chat', label: 'Coach IA', icon: MessageSquare },
    { id: 'analytics', label: 'Evolução', icon: LineChart },
    { id: 'rpg', label: 'Conquistas', icon: Trophy },
    { id: 'settings', label: 'Ajustes', icon: SettingsIcon }
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-950 text-white relative">
      
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:w-64 bg-zinc-900/60 border-r border-zinc-800/80 flex-col justify-between p-6 sticky top-0 h-screen z-30">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-2">
            <div className="p-2 rounded-2xl bg-gradient-to-tr from-violet-600 to-pink-500 text-white shadow-lg shadow-violet-600/10">
              <Dumbbell className="w-6 h-6" />
            </div>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              QuestFit
            </span>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1.5">
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl font-semibold text-sm transition duration-150 cursor-pointer ${
                    isActive 
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-650/15 font-bold' 
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile details at the bottom of sidebar */}
        <div className="space-y-4 pt-6 border-t border-zinc-800/80">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 font-bold flex items-center justify-center text-sm border border-zinc-700">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-white truncate">{user.displayName}</p>
              <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/5 border border-transparent hover:border-rose-500/10 rounded-2xl text-sm font-semibold transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow pb-24 md:pb-6 md:p-6 min-h-screen overflow-y-auto z-10">
        {/* Mobile top bar */}
        <header className="md:hidden px-6 py-4 bg-zinc-900/60 border-b border-zinc-800/80 sticky top-0 flex justify-between items-center z-25 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-gradient-to-tr from-violet-600 to-pink-500 text-white">
              <Dumbbell className="w-4 h-4" />
            </div>
            <span className="text-lg font-black tracking-tight">QuestFit</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="p-2 text-zinc-400 hover:text-rose-400 transition"
            title="Sair"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </header>

        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-zinc-900/90 border-t border-zinc-800/80 py-2.5 px-4 flex gap-5 overflow-x-auto scrollbar-none z-30 backdrop-blur-md justify-start">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center gap-1 flex-shrink-0 min-w-[56px] cursor-pointer transition ${
                isActive ? 'text-violet-400 font-bold' : 'text-zinc-500'
              }`}
            >
              <Icon className="w-5.5 h-5.5" />
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* LEVEL UP MODAL DIALOG OVERLAY */}
      <AnimatePresence>
        {levelUpData && levelUpData.show && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 overflow-hidden">
            
            {/* Animated particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-violet-600/20 rounded-full filter blur-[60px] animate-pulse"></div>
              <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-pink-600/20 rounded-full filter blur-[60px] animate-pulse"></div>
            </div>

            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="glass-panel w-full max-w-md p-8 rounded-[40px] border border-amber-500/30 text-center relative z-55 shadow-[0_0_50px_rgba(245,158,11,0.15)] flex flex-col items-center gap-6"
            >
              <div className="inline-flex p-5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 relative">
                <Sparkles className="w-10 h-10 animate-spin" style={{ animationDuration: '6s' }} />
                <span className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-pink-500 text-white font-black text-[9px]">LEVEL UP</span>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Novo nível alcançado!</span>
                <h2 className="text-4xl font-black text-white leading-tight">Nível {levelUpData.level}</h2>
                <p className="text-sm text-zinc-400">Novo título desbloqueado: <strong className="text-violet-400 font-semibold">{levelUpData.title}</strong></p>
              </div>

              {/* Achievements unlocked block */}
              {levelUpData.achievements.length > 0 && (
                <div className="w-full p-4 bg-zinc-900/80 border border-zinc-800 rounded-3xl space-y-2.5">
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Conquista Desbloqueada!</span>
                  {levelUpData.achievements.map((ach, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-left">
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/10">
                        <Trophy className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{ach.title}</h4>
                        <p className="text-[10px] text-zinc-500 leading-normal">{ach.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={onCloseLevelUp}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:scale-[1.01] active:scale-98 text-zinc-950 font-black rounded-2xl transition duration-150 cursor-pointer shadow-lg shadow-amber-500/20 text-sm flex items-center justify-center gap-1.5"
              >
                Continuar Jornada
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
