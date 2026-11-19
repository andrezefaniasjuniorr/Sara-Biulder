import React, { useRef, useState } from 'react';
import {
  X,
  Database,
  KeyRound,
  Github,
  Check,
  Loader2,
  LogOut,
  FileText,
} from 'lucide-react';
import type { FirebaseUserProfile } from '../types/builder';
import {
  criarConta,
  firebaseConfig,
  loginEmail,
  loginGoogle,
  logout,
  testarConexaoFirebase,
} from '../services/firebaseService';
import {
  extractApiKeyFromTxtContent,
  getSavedGeminiKey,
  saveGeminiKey,
} from '../services/saraAiService';

interface SettingsModalProps {
  isOpen: boolean;
  firebaseUser: FirebaseUserProfile | null;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  firebaseUser,
  onClose,
  onNotify,
}) => {
  const [geminiKey, setGeminiKey] = useState(() => getSavedGeminiKey());
  const [githubToken, setGithubToken] = useState(() => {
    try {
      return localStorage.getItem('GITHUB_TOKEN') || '';
    } catch {
      return '';
    }
  });
  const [savedNotice, setSavedNotice] = useState('');

  // Firebase test & auth state
  const [fbTesting, setFbTesting] = useState(false);
  const [fbStatus, setFbStatus] = useState<{ ok: boolean; label: string; detail: string } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const txtFileRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    saveGeminiKey(geminiKey);
    try {
      if (githubToken.trim()) {
        localStorage.setItem('GITHUB_TOKEN', githubToken.trim());
      } else {
        localStorage.removeItem('GITHUB_TOKEN');
      }
    } catch {
      // ignore
    }
    setSavedNotice('Configurações guardadas no navegador.');
    onNotify('Configurações guardadas com sucesso.');
    setTimeout(() => setSavedNotice(''), 2500);
  };

  const handleImportTxt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const extracted = extractApiKeyFromTxtContent(content);
      if (extracted) {
        setGeminiKey(extracted);
        saveGeminiKey(extracted);
        setSavedNotice('Chave Gemini extraída do TXT e guardada em localStorage.');
      } else {
        setSavedNotice('TXT acoplado! Nenhuma chave explícita encontrada no TXT — a usar a IA integrada do Builder.');
      }
    } finally {
      e.target.value = '';
    }
  };

  const handleTestFirebase = async () => {
    setFbTesting(true);
    const res = await testarConexaoFirebase();
    setFbStatus(res);
    setFbTesting(false);
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    setAuthBusy(true);
    try {
      const u = await loginGoogle();
      onNotify(`Bem-vindo, ${u.displayName || 'Eletro-Jr'}! Ligado ao Firebase.`);
    } catch (err: any) {
      setAuthError(err?.message || 'Não foi possível entrar com Google.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setAuthError('');
    setAuthBusy(true);
    try {
      if (authMode === 'login') {
        await loginEmail(email.trim(), password);
        onNotify('Sessão iniciada no Firebase sara-biulder.');
      } else {
        await criarConta(email.trim(), password, 'Eletro-Jr');
        onNotify('Conta criada em sara_usuarios.');
      }
      setPassword('');
    } catch (err: any) {
      setAuthError(err?.message || 'Erro de autenticação Firebase.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onNotify('Sessão Firebase terminada.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[88vh] bg-[#12121A] border border-[#1F1F2E] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1F1F2E] flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">Configurações do Sistema</h2>
            <p className="text-xs text-[#A1A1AA]">Firebase sara-biulder, Motor IA Duplo e GitHub Token</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-[#0A0A0F] border border-[#1F1F2E] text-[#A1A1AA] hover:text-white cursor-pointer"
            aria-label="Fechar configurações"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 sara-scroll">
          {/* 1. Firebase Real sara-biulder */}
          <div className="p-4 rounded-xl bg-[#0A0A0F] border border-[#1F1F2E] space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#3B82F6]" />
                <span className="text-sm font-bold text-white">Firebase Real: {firebaseConfig.projectId}</span>
              </div>
              <button
                type="button"
                onClick={handleTestFirebase}
                disabled={fbTesting}
                className="px-3 py-1.5 rounded-lg bg-[#12121A] border border-[#1F1F2E] hover:border-[#3B82F6] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
              >
                {fbTesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Testar Conexão Firebase</span>
              </button>
            </div>

            {fbStatus && (
              <div
                className={`px-3 py-2 rounded-lg border text-xs ${
                  fbStatus.ok
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="font-bold">{fbStatus.label}</div>
                <div className="opacity-85 mt-0.5">{fbStatus.detail}</div>
              </div>
            )}

            {/* Auth Firebase */}
            <div className="pt-2 border-t border-[#1F1F2E]">
              {firebaseUser ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <div className="font-semibold text-white">
                      Sessão ativa: {firebaseUser.displayName || 'Eletro-Jr'}
                    </div>
                    <div className="text-[#A1A1AA]">{firebaseUser.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-3 py-1.5 rounded-lg bg-[#12121A] border border-[#1F1F2E] hover:border-rose-500/40 text-xs text-rose-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#A1A1AA]">Autenticação Firebase (Email ou Google)</span>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={authBusy}
                      className="px-3 py-1.5 rounded-lg bg-white text-[#0A0A0F] font-semibold text-xs hover:bg-slate-200 transition cursor-pointer"
                    >
                      Entrar com Google
                    </button>
                  </div>
                  <form onSubmit={handleEmailAuth} className="grid sm:grid-cols-3 gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className="bg-[#12121A] border border-[#1F1F2E] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Senha"
                      className="bg-[#12121A] border border-[#1F1F2E] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="submit"
                        disabled={authBusy}
                        className="flex-1 py-1.5 rounded-lg bg-[#3B82F6] text-white text-xs font-semibold cursor-pointer"
                      >
                        {authMode === 'login' ? 'Entrar' : 'Criar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode((m) => (m === 'login' ? 'signup' : 'login'))}
                        className="px-2 py-1.5 rounded-lg bg-[#12121A] border border-[#1F1F2E] text-[11px] text-[#A1A1AA] hover:text-white cursor-pointer"
                      >
                        {authMode === 'login' ? 'Registar' : 'Login'}
                      </button>
                    </div>
                  </form>
                  {authError && <p className="text-[11px] text-rose-400">{authError}</p>}
                </div>
              )}
            </div>
          </div>

          {/* 2. IA do Builder + Chave Gemini do TXT + GitHub Token */}
          <form onSubmit={handleSaveKeys} className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0A0A0F] border border-[#1F1F2E] space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#8B5CF6]" />
                  <span className="text-sm font-bold text-white">IA do Builder + Chave TXT</span>
                </div>
                <input
                  ref={txtFileRef}
                  type="file"
                  accept=".txt"
                  onChange={handleImportTxt}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => txtFileRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg bg-[#12121A] border border-[#1F1F2E] hover:border-[#3B82F6]/40 text-xs text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>Ler chave de um .TXT</span>
                </button>
              </div>
              <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                O motor padrão do Builder (<strong>gemini-4-hydrogen</strong>) já está ativo automaticamente no servidor. Se quiseres acoplar também uma chave Gemini do teu ficheiro TXT (guardada em <code className="text-white">localStorage["GEMINI_API_KEY"]</code>), cola abaixo:
              </p>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Opcional: AIza... (chave do teu TXT)"
                className="w-full bg-[#12121A] border border-[#1F1F2E] focus:border-[#8B5CF6] rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
              />
            </div>

            <div className="p-4 rounded-xl bg-[#0A0A0F] border border-[#1F1F2E] space-y-2.5">
              <div className="flex items-center gap-2">
                <Github className="w-4 h-4 text-white" />
                <span className="text-sm font-bold text-white">GitHub Personal Access Token</span>
              </div>
              <p className="text-[11px] text-[#A1A1AA]">
                Fica guardado apenas no teu navegador (localStorage) e nunca é exibido em texto claro. Necessário para criar repositórios e fazer Push direto.
              </p>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_... ou github_pat_..."
                className="w-full bg-[#12121A] border border-[#1F1F2E] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
              />
            </div>

            {savedNotice && (
              <div className="px-3 py-2 rounded-lg bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{savedNotice}</span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#0A0A0F] border border-[#1F1F2E] text-xs font-medium text-[#A1A1AA] hover:text-white cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white text-xs font-semibold cursor-pointer"
              >
                Guardar Configurações
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
