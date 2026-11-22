import React, { useState } from 'react';
import { Eye, EyeOff, Lock, LogIn, ShieldCheck, Sparkles, UserPlus, Users } from 'lucide-react';
import { loginAccount, registerAccount, startGuestSession } from '../../services/authService';
import type { SaraSession } from '../../types/auth';

interface LoginGateScreenProps {
  onAuthenticated: (session: SaraSession, isNewAccount?: boolean) => void;
  exitNotice?: string | null;
}

export const LoginGateScreen: React.FC<LoginGateScreenProps> = ({
  onAuthenticated,
  exitNotice,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [loginName, setLoginName] = useState('');
  const [fullName, setFullName] = useState('');
  const [callName, setCallName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { session } = await loginAccount({
        email,
        loginName,
        password,
      });
      onAuthenticated(session, false);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível entrar. Verifica os dados.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { session } = await registerAccount({
        fullName,
        callName,
        email,
        password,
      });
      onAuthenticated(session, true);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    setError(null);
    const guestSession = startGuestSession();
    onAuthenticated(guestSession, false);
  };

  return (
    <div className="min-h-screen w-full bg-[#020612] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Subtle HUD Grid & Radial Glow */}
      <div
        className="pointer-events-none fixed inset-0 opacity-35"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 30%, rgba(14, 165, 233, 0.16), transparent 60%), linear-gradient(to right, rgba(56, 189, 248, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.04) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 42px 42px, 42px 42px',
        }}
      />

      <div className="relative z-10 w-full max-w-md bg-[#040a18]/95 border border-cyan-500/25 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.75)] backdrop-blur-xl p-6 sm:p-7">
        {/* Corner HUD brackets */}
        <span className="pointer-events-none absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-cyan-400/60 rounded-tl" />
        <span className="pointer-events-none absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-cyan-400/60 rounded-tr" />
        <span className="pointer-events-none absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-cyan-400/60 rounded-bl" />
        <span className="pointer-events-none absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-cyan-400/60 rounded-br" />

        {/* SARA Emblem & Title */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative w-16 h-16 flex items-center justify-center mb-3">
            <svg viewBox="0 0 80 80" className="w-16 h-16">
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="rgba(34,211,238,0.28)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
              <circle
                cx="40"
                cy="40"
                r="25"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2"
                strokeDasharray="24 10"
              />
              <circle cx="40" cy="40" r="13" fill="rgba(6,182,212,0.18)" stroke="#67e8f9" strokeWidth="1.5" />
              <circle cx="40" cy="40" r="5" fill="#22d3ee" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-[0.22em] text-cyan-300">SARA OS</h1>
          <p className="text-xs text-slate-400 mt-1">
            Sistema Inteligente Pessoal • Identificação Obrigatória
          </p>
        </div>

        {/* Exit / Idle / Notice Banner */}
        {exitNotice && (
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-200 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{exitNotice}</span>
          </div>
        )}

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#071024] border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-semibold tracking-wider transition flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            ENTRAR
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-semibold tracking-wider transition flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            CRIAR CONTA
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-rose-500/12 border border-rose-500/35 text-rose-200 text-xs leading-relaxed">
            {error}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teu.email@exemplo.com"
                autoComplete="email"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#071126] border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
                Nome de Login
              </label>
              <input
                type="text"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="Como a Sara te chama (ex: Maria)"
                autoComplete="username"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#071126] border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#071126] border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-cyan-300 transition"
                  aria-label="Mostrar ou ocultar senha"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs tracking-[0.14em] uppercase transition flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(6,182,212,0.28)]"
            >
              <Lock className="w-3.5 h-3.5" />
              {loading ? 'A VERIFICAR...' : 'ENTRAR'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Maria da Silva"
                className="w-full px-3.5 py-2 rounded-xl bg-[#071126] border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
                Nome que queres que a Sara chame
              </label>
              <input
                type="text"
                required
                value={callName}
                onChange={(e) => setCallName(e.target.value)}
                placeholder="Ex: Maria"
                className="w-full px-3.5 py-2 rounded-xl bg-[#071126] border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teu.email@exemplo.com"
                autoComplete="email"
                className="w-full px-3.5 py-2 rounded-xl bg-[#071126] border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2 pr-10 rounded-xl bg-[#071126] border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-cyan-300 transition"
                  aria-label="Mostrar ou ocultar senha"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs tracking-[0.14em] uppercase transition flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(6,182,212,0.28)]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {loading ? 'A CRIAR CONTA...' : 'CRIAR CONTA'}
            </button>
          </form>
        )}

        {/* Guest Mode Separator */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleGuestMode}
            className="w-full py-2 px-3 rounded-xl border border-slate-700/80 bg-[#071022] hover:bg-slate-800/80 hover:border-cyan-500/40 text-slate-200 text-xs font-semibold tracking-wider uppercase transition flex items-center justify-center gap-2"
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            MODO CONVIDADO
          </button>
          <p className="text-[11px] text-slate-500 text-center">
            Sessão temporária de 5 minutos • Sem guardar dados nem histórico
          </p>
        </div>
      </div>
    </div>
  );
};
