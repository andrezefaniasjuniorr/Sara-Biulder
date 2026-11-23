import React from 'react';
import {
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  FolderKanban,
  Settings,
  Rocket,
  Save,
  Presentation,
  Bot,
  UserCheck,
  Menu,
  X,
  Sparkles,
  Hammer,
  Shield,
  LogOut,
  Clock,
} from 'lucide-react';
import type { AgentMode, FirebaseUserProfile, VoiceLevel } from '../types/builder';
import type { WorkspaceMode } from '../types/jarvis';
import type { SaraSession } from '../types/auth';

interface TopBarProps {
  session: SaraSession;
  guestSecondsLeft?: number | null;
  unreadAlertsCount?: number;
  workspaceMode: WorkspaceMode;
  projectName: string;
  agentMode: AgentMode;
  voiceEnabled: boolean;
  voiceLevel: VoiceLevel;
  isListening: boolean;
  isSaraSpeaking: boolean;
  isSaraSilenced: boolean;
  isCallMode?: boolean;
  isThinking: boolean;
  firebaseUser: FirebaseUserProfile | null;
  isSyncingFirebase?: boolean;
  isJarvisPanelOpen?: boolean;
  onToggleJarvisPanel?: () => void;
  onChangeWorkspaceMode: (mode: WorkspaceMode) => void;
  onChangeAgentMode: (mode: AgentMode) => void;
  onToggleVoice: () => void;
  onCycleVoiceLevel: () => void;
  onSilenceSara: () => void;
  onToggleMic: () => void;
  onTogglePresentation: () => void;
  onSaveProject: () => void;
  onOpenProjects: () => void;
  onOpenSettings: () => void;
  onOpenDeploy: () => void;
  onOpenAdmin?: () => void;
  onLogout: () => void;
}

function formatGuestCountdown(seconds?: number | null): string {
  const s = Math.max(0, Math.floor(seconds ?? 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const TopBar: React.FC<TopBarProps> = ({
  session,
  guestSecondsLeft = null,
  unreadAlertsCount = 0,
  workspaceMode,
  projectName,
  agentMode,
  voiceEnabled,
  voiceLevel,
  isListening,
  isSaraSpeaking,
  isSaraSilenced,
  isCallMode = false,
  isThinking,
  isSyncingFirebase = false,
  isJarvisPanelOpen = false,
  onToggleJarvisPanel,
  onChangeWorkspaceMode,
  onChangeAgentMode,
  onToggleVoice,
  onCycleVoiceLevel,
  onSilenceSara,
  onToggleMic,
  onTogglePresentation,
  onSaveProject,
  onOpenProjects,
  onOpenSettings,
  onOpenDeploy,
  onOpenAdmin,
  onLogout,
}) => {
  const voiceLevelLabel =
    voiceLevel === 'full' ? 'Longo' : voiceLevel === 'medium' ? 'Médio' : 'Curto';
  const isJarvis = workspaceMode === 'jarvis';
  const isOwner = Boolean(session?.isOwner);

  return (
    <header
      className={`h-14 shrink-0 px-2.5 sm:px-4 flex items-center justify-between gap-2 overflow-x-auto sara-scroll border-b transition-colors ${
        isJarvis
          ? 'bg-[#030713] border-cyan-500/35 shadow-[0_2px_22px_rgba(0,229,255,0.12)]'
          : 'bg-[#0D1117] border-[#1E2433]'
      }`}
    >
      {/* Esquerda: Em JARVIS -> Botão Único [☰ PAINEL] + Avatar + SARA JARVIS | Em Builder -> Modo Switcher completo */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        {isJarvis && onToggleJarvisPanel && (
          <button
            type="button"
            onClick={onToggleJarvisPanel}
            aria-expanded={isJarvisPanelOpen}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold tracking-wider flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0 border ${
              isJarvisPanelOpen
                ? 'bg-gradient-to-r from-[#00E5FF]/25 to-[#FF2A4B]/20 border-[#00E5FF] text-cyan-100 shadow-[0_0_16px_rgba(0,229,255,0.3)]'
                : 'bg-[#071124] border-cyan-500/45 text-cyan-300 hover:border-[#00E5FF] hover:text-white'
            }`}
            title="Abrir / fechar Painel de Módulos, Builder e Configurações"
          >
            {isJarvisPanelOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            <span>PAINEL</span>
          </button>
        )}

        <div
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl p-[1.5px] shrink-0 ${
            isJarvis
              ? 'bg-gradient-to-br from-[#00E5FF] to-[#FF2A4B] shadow-[0_0_16px_rgba(0,229,255,0.45)]'
              : 'bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] shadow-[0_0_16px_rgba(59,130,246,0.35)]'
          }`}
          title={isJarvis ? 'SARA JARVIS — Assistente IA Completa' : 'Sara — Construtora Inteligente'}
        >
          <div className="w-full h-full rounded-[10px] bg-[#0A0A0F] flex items-center justify-center">
            <svg
              viewBox="0 0 32 32"
              className="w-5 h-5 sm:w-6 sm:h-6"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="saraRobotGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor={isJarvis ? '#00E5FF' : '#3B82F6'} />
                  <stop offset="1" stopColor={isJarvis ? '#FF2A4B' : '#8B5CF6'} />
                </linearGradient>
              </defs>
              <path
                d="M16 4V7M9 11C9 7.8 12 6 16 6C20 6 23 7.8 23 11V19C23 22.5 20 25 16 25C12 25 9 22.5 9 19V11Z"
                stroke="url(#saraRobotGrad)"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M7 13C5.5 14 5.5 18 7 19M25 13C26.5 14 26.5 18 25 19"
                stroke={isJarvis ? '#FF2A4B' : '#8B5CF6'}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle cx="13" cy="14.5" r="1.6" fill={isJarvis ? '#00E5FF' : '#3B82F6'} />
              <circle cx="19" cy="14.5" r="1.6" fill={isJarvis ? '#00E5FF' : '#8B5CF6'} />
              <path
                d="M13.5 19.5C14.3 20.5 17.7 20.5 18.5 19.5"
                stroke="#FFFFFF"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        <div className="min-w-0 flex items-center gap-2">
          <span
            className={`font-extrabold text-sm sm:text-base tracking-tight bg-clip-text text-transparent whitespace-nowrap ${
              isJarvis
                ? 'bg-gradient-to-r from-[#00E5FF] via-cyan-200 to-[#FF2A4B]'
                : 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]'
            }`}
          >
            {isJarvis ? 'SARA JARVIS' : 'SARA BIULDER'}
          </span>
          {!isJarvis && (
            <>
              <span className="hidden xl:inline text-[#1E2433]">|</span>
              <span className="hidden xl:inline text-xs font-medium text-[#A1A1AA] truncate max-w-[120px]">
                {projectName}
              </span>
            </>
          )}
          {isOwner && isSyncingFirebase && (
            <span className="hidden xl:inline-flex items-center gap-1 text-[10px] font-mono text-cyan-300/90 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/25">
              Cloud Sync
            </span>
          )}
        </div>

        {/* Interruptor de modo na barra apenas no Modo Builder (no JARVIS fica limpo dentro de [☰ PAINEL]) */}
        {!isJarvis && (
          <div
            className="flex items-center bg-[#060B16] p-1 rounded-xl border border-cyan-500/40 shadow-[0_0_14px_rgba(0,229,255,0.16)] shrink-0 ml-1"
            role="group"
            aria-label="Alternar entre Assistente JARVIS e Builder"
          >
            <button
              type="button"
              onClick={() => onChangeWorkspaceMode('jarvis')}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap text-slate-400 hover:text-white border border-transparent"
              title="Modo 1 — Assistente Pessoal SARA JARVIS"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>ASSISTENTE</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeWorkspaceMode('builder')}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap bg-gradient-to-r from-[#3B82F6]/30 to-[#8B5CF6]/30 border border-[#3B82F6]/70 text-blue-200 shadow-[0_0_14px_rgba(59,130,246,0.28)]"
              title="Modo 2 — Construtor IDE SARA BIULDER"
            >
              <Hammer className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span>BUILDER</span>
            </button>
          </div>
        )}

        {/* Indicadores ao vivo: A falar / A ouvir com onda / A pensar */}
        {isSaraSpeaking ? (
          <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 text-[11px] font-medium text-[#C4B5FD] whitespace-nowrap">
            <Volume2 className="w-3.5 h-3.5" />
            <span>Sara a falar</span>
          </div>
        ) : isListening ? (
          <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-[11px] font-medium text-emerald-300 whitespace-nowrap">
            <Mic className="w-3.5 h-3.5" />
            <span>A ouvir</span>
          </div>
        ) : isThinking ? (
          <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/40 text-[11px] font-medium text-blue-300 whitespace-nowrap">
            <span>A pensar...</span>
          </div>
        ) : null}
      </div>

      {/* Centro: Interruptor [MANUAL | AUTOMÁTICO] no Builder OR Banner STARK HUD no Assistente */}
      {!isJarvis ? (
        <div
          className="flex items-center bg-[#0A0A0F] p-1 rounded-xl border border-[#1F1F2E] shrink-0"
          role="group"
          aria-label="Modo de construção"
        >
          <button
            type="button"
            onClick={() => onChangeAgentMode('manual')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              agentMode === 'manual'
                ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'text-[#A1A1AA] hover:text-white border border-transparent'
            }`}
            title="Modo Manual: Sara pergunta e espera aprovação em cada etapa"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <UserCheck className="w-3.5 h-3.5 hidden sm:inline" />
            <span>MANUAL</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeAgentMode('automatic')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              agentMode === 'automatic'
                ? 'bg-gradient-to-r from-[#3B82F6]/25 to-[#8B5CF6]/25 border border-[#3B82F6]/60 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.25)]'
                : 'text-[#A1A1AA] hover:text-white border border-transparent'
            }`}
            title="Modo Automático: Sara planeia, cria, testa, corrige e faz push sozinha"
          >
            <Bot className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>AUTOMÁTICO</span>
          </button>
        </div>
      ) : (
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1 rounded-xl bg-[#071124] border border-cyan-500/30 text-[11px] font-mono tracking-wider text-cyan-300 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
          <span>STARK HUD // ASSISTENTE PESSOAL</span>
        </div>
      )}

      {/* Direita: Identidade / Admin (só dono) / Calar Sara / Voz / Mic / Builder / Sair */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isOwner ? (
          <div className="hidden sm:flex items-center gap-1.5 mr-1">
            <span className="px-2 py-1 rounded-lg bg-emerald-500/12 border border-emerald-400/35 text-[10px] font-bold tracking-wider uppercase text-emerald-200 whitespace-nowrap">
              DONO: Eletro-Júnior • ADMIN ATIVO
            </span>
            {onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="relative px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/45 text-cyan-200 text-[11px] font-bold tracking-wider uppercase flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition"
                title="Abrir Painel Admin"
              >
                <Shield className="w-3.5 h-3.5 text-cyan-300" />
                <span>ADMIN</span>
                {unreadAlertsCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-mono font-bold">
                    {unreadAlertsCount}
                  </span>
                )}
              </button>
            )}
          </div>
        ) : session.isGuest ? (
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-400/35 text-[11px] font-semibold text-amber-200 mr-1 whitespace-nowrap font-mono tabular-nums">
            <Clock className="w-3 h-3 text-amber-300" />
            Convidado • {formatGuestCountdown(guestSecondsLeft)}
          </span>
        ) : (
          <span className="hidden sm:inline text-xs font-semibold text-cyan-100 mr-1 whitespace-nowrap">
            {session.callName}
          </span>
        )}

        <button
          type="button"
          onClick={onSilenceSara}
          className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
            isCallMode
              ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
              : isSaraSilenced
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
              : isSaraSpeaking
              ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
              : 'bg-[#0A0A0F] border-[#1F1F2E] text-[#A1A1AA] hover:text-rose-300'
          }`}
          title={
            isCallMode
              ? 'Modo Chamada ativo (clica ou diz "Sara, voltei" para sair)'
              : isSaraSilenced
              ? 'Silenciada até chamares (clica ou diz "Sara, podes falar")'
              : 'Calar Sara imediatamente'
          }
        >
          <VolumeX className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">
            {isCallMode ? 'Chamada' : isSaraSilenced ? 'Silenciada' : 'Calar Sara'}
          </span>
        </button>

        <button
          type="button"
          onClick={onCycleVoiceLevel}
          className="px-2 py-1.5 rounded-lg text-[11px] font-medium bg-[#0A0A0F] border border-[#1F1F2E] text-[#A1A1AA] hover:text-white transition whitespace-nowrap shrink-0 cursor-pointer"
          title="Nível de voz da Sara (Curto, Médio, Longo)"
        >
          Voz: <span className="text-cyan-300">{voiceLevelLabel}</span>
        </button>

        <button
          type="button"
          onClick={onToggleVoice}
          className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
            voiceEnabled
              ? 'bg-[#3B82F6]/15 border-[#3B82F6]/50 text-[#3B82F6]'
              : 'bg-[#0A0A0F] border-[#1F1F2E] text-[#A1A1AA] hover:text-white'
          }`}
          title={voiceEnabled ? 'Desligar áudio de voz' : 'Ligar áudio de voz'}
        >
          {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={onToggleMic}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            isListening
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
              : 'bg-[#0A0A0F] border-[#1F1F2E] text-[#A1A1AA] hover:text-white'
          }`}
          title="Microfone contínuo mãos-livres (com pausa automática enquanto Sara fala)"
        >
          {isListening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          <span className="hidden lg:inline">{isListening ? 'Mãos Livres' : 'Mic'}</span>
        </button>

        {!isJarvis && (
          <>
            <button
              type="button"
              onClick={onTogglePresentation}
              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-[#0A0A0F] border border-[#1F1F2E] text-[#A1A1AA] hover:text-white hover:border-cyan-400/50 transition flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              title="Modo Apresentação (Ctrl+P)"
            >
              <Presentation className="w-3.5 h-3.5 text-cyan-400" />
            </button>

            <button
              type="button"
              onClick={onSaveProject}
              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-[#0A0A0F] border border-[#1F1F2E] text-[#A1A1AA] hover:text-white hover:border-[#3B82F6]/40 transition flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              title="Guardar projeto (Ctrl+S)"
            >
              <Save className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onOpenProjects}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#0A0A0F] border border-[#1F1F2E] text-white hover:border-[#3B82F6]/50 transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              title="Projetos"
            >
              <FolderKanban className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span className="hidden sm:inline">Projetos</span>
            </button>

            {isOwner && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="px-2 py-1.5 rounded-lg text-xs font-medium bg-[#0A0A0F] border border-[#1F1F2E] text-white hover:border-[#8B5CF6]/50 transition flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                title="Configurações"
              >
                <Settings className="w-3.5 h-3.5 text-[#8B5CF6]" />
              </button>
            )}

            <button
              type="button"
              onClick={onOpenDeploy}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:opacity-95 text-white transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-[0_0_14px_rgba(59,130,246,0.3)]"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Deploy</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onLogout}
          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase bg-rose-500/12 hover:bg-rose-500/25 border border-rose-500/35 text-rose-200 transition flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          title="Terminar sessão e voltar ao ecrã de entrada"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>SAIR</span>
        </button>
      </div>
    </header>
  );
};
