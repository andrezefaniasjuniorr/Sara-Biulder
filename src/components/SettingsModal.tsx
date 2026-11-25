import React, { useRef, useState } from 'react';
import {
  X,
  Database,
  KeyRound,
  FolderGit2,
  Check,
  Loader2,
  LogOut,
  FileText,
} from 'lucide-react';
import type { FirebaseUserProfile } from '../types/builder';
import {
  criarConta,
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
import { toSafeCoreOfflineMessage } from '../utils/timeAgendaService';

interface SettingsModalProps {
  isOpen: boolean;
  firebaseUser: FirebaseUserProfile | null;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

const MASKED_SECRET = '••••••••';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  firebaseUser,
  onClose,
  onNotify,
}) => {
  const [hasCoreKey, setHasCoreKey] = useState(() => Boolean(getSavedGeminiKey()));
  const [coreKeyInput, setCoreKeyInput] = useState(() => (getSavedGeminiKey() ? MASKED_SECRET : ''));
  const [coreKeyTouched, setCoreKeyTouched] = useState(false);

  const [hasVaultKey, setHasVaultKey] = useState(() => {
    try {
      return Boolean(localStorage.getItem('GITHUB_TOKEN'));
    } catch {
      return false;
    }
  });
  const [vaultKeyInput, setVaultKeyInput] = useState(() => {
    try {
      return localStorage.getItem('GITHUB_TOKEN') ? MASKED_SECRET : '';
    } catch {
      return '';
    }
  });
  const [vaultKeyTouched, setVaultKeyTouched] = useState(false);

  const [savedNotice, setSavedNotice] = useState('');

  const [coreTesting, setCoreTesting] = useState(false);
  const [coreStatus, setCoreStatus] = useState<{ ok: boolean; label: string; detail: string } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const txtFileRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    if (coreKeyTouched) {
      const cleanCore = coreKeyInput.trim();
      saveGeminiKey(cleanCore);
      setHasCoreKey(Boolean(cleanCore));
      setCoreKeyInput(cleanCore ? MASKED_SECRET : '');
      setCoreKeyTouched(false);
    }

    if (vaultKeyTouched) {
      const cleanVault = vaultKeyInput.trim();
      try {
        if (cleanVault) {
          localStorage.setItem('GITHUB_TOKEN', cleanVault);
        } else {
          localStorage.removeItem('GITHUB_TOKEN');
        }
      } catch {
        // ignore
      }
      setHasVaultKey(Boolean(cleanVault));
      setVaultKeyInput(cleanVault ? MASKED_SECRET : '');
      setVaultKeyTouched(false);
    }

    setSavedNotice('Configurações guardadas na Memória da SARA.');
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
        saveGeminiKey(extracted);
        setHasCoreKey(true);
        setCoreKeyInput(MASKED_SECRET);
        setCoreKeyTouched(false);
        setSavedNotice('Chave do Núcleo carregada e protegida na Memória da SARA.');
      } else {
        setSavedNotice('Ficheiro acoplado. O Motor Inteligente integrado continua ativo.');
      }
    } finally {
      e.target.value = '';
    }
  };

  const handleTestCore = async () => {
    setCoreTesting(true);
    const res = await testarConexaoFirebase();
    setCoreStatus(
      res.ok
        ? res
        : {
            ok: false,
            label: 'Núcleo Offline',
            detail: 'Núcleo offline. A tentar reconectar...',
          }
    );
    setCoreTesting(false);
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    setAuthBusy(true);
    try {
      const u = await loginGoogle();
      onNotify(`Bem-vindo, ${u.displayName || 'Eletro-Jr'}! Ligado ao Núcleo SARA.`);
    } catch (err: any) {
      setAuthError(toSafeCoreOfflineMessage(err?.message));
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
        onNotify('Sessão iniciada no Núcleo SARA.');
      } else {
        await criarConta(email.trim(), password, 'Eletro-Jr');
        onNotify('Conta registada no Núcleo SARA.');
      }
      setPassword('');
    } catch (err: any) {
      setAuthError(toSafeCoreOfflineMessage(err?.message));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onNotify('Sessão do Núcleo terminada.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[88vh] bg-[#12121A] border border-[#1F1F2E] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1F1F2E] flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">Configurações do Sistema</h2>
            <p className="text-xs text-[#A1A1AA]">Núcleo SARA, Motor Inteligente e Cofre de Projetos</p>
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
          {/* 1. Núcleo SARA */}
          <div className="p-4 rounded-xl bg-[#0A0A0F] border border-[#1F1F2E] space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#3B82F6]" />
                <span className="text-sm font-bold text-white">Núcleo SARA</span>
              </div>
              <button
                type="button"
                onClick={handleTestCore}
                disabled={coreTesting}
                className="px-3 py-1.5 rounded-lg bg-[#12121A] border border-[#1F1F2E] hover:border-[#3B82F6] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
              >
                {coreTesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Testar Ligação do Núcleo</span>
              </button>
            </div>

            {coreStatus && (
              <div
                className={`px-3 py-2 rounded-lg border text-xs ${
                  coreStatus.ok
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="font-bold">{coreStatus.label}</div>
                <div className="opacity-85 mt-0.5">{coreStatus.detail}</div>
              </div>
            )}

            {/* Sessão do Núcleo */}
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
                    <span className="text-xs text-[#A1A1AA]">Acesso Sincronizado do Núcleo SARA</span>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={authBusy}
                      className="px-3 py-1.5 rounded-lg bg-white text-[#0A0A0F] font-semibold text-xs hover:bg-slate-200 transition cursor-pointer"
                    >
                      Acesso Rápido
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

          {/* 2. Motor Inteligente + Chave do Núcleo */}
          <form onSubmit={handleSaveKeys} className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0A0A0F] border border-[#1F1F2E] space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#8B5CF6]" />
                  <span className="text-sm font-bold text-white">Motor Inteligente</span>
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
                  <span>Importar Chave (.TXT)</span>
                </button>
              </div>
              <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                O Motor Inteligente do Estúdio SARA está ativo em segundo plano. Podes acoplar uma Chave do Núcleo pessoal abaixo (sempre mascarada na Memória da SARA).
              </p>
              <input
                type="password"
                value={coreKeyInput}
                onFocus={() => {
                  if (!coreKeyTouched && coreKeyInput === MASKED_SECRET) {
                    setCoreKeyInput('');
                    setCoreKeyTouched(true);
                  }
                }}
                onChange={(e) => {
                  setCoreKeyTouched(true);
                  setCoreKeyInput(e.target.value);
                }}
                placeholder={hasCoreKey ? '••••••••' : 'Chave do Núcleo (opcional)'}
                autoComplete="new-password"
                className="w-full bg-[#12121A] border border-[#1F1F2E] focus:border-[#8B5CF6] rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
              />
            </div>

            <div className="p-4 rounded-xl bg-[#0A0A0F] border border-[#1F1F2E] space-y-2.5">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-white" />
                <span className="text-sm font-bold text-white">Cofre de Projetos</span>
              </div>
              <p className="text-[11px] text-[#A1A1AA]">
                Guardada de forma privada na Memória da SARA e sempre mascarada. Necessária para sincronizar e guardar repositórios no Cofre de Projetos.
              </p>
              <input
                type="password"
                value={vaultKeyInput}
                onFocus={() => {
                  if (!vaultKeyTouched && vaultKeyInput === MASKED_SECRET) {
                    setVaultKeyInput('');
                    setVaultKeyTouched(true);
                  }
                }}
                onChange={(e) => {
                  setVaultKeyTouched(true);
                  setVaultKeyInput(e.target.value);
                }}
                placeholder={hasVaultKey ? '••••••••' : 'Chave do Cofre (••••••••)'}
                autoComplete="new-password"
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
