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
} from 'lucide-react';
import type { AgentMode, FirebaseUserProfile, VoiceLevel } from '../types/builder';

interface TopBarProps {
  projectName: string;
  agentMode: AgentMode;
  voiceEnabled: boolean;
  voiceLevel: VoiceLevel;
  isListening: boolean;
  isSaraSpeaking: boolean;
  isSaraSilenced: boolean;
  isThinking: boolean;
  firebaseUser: FirebaseUserProfile | null;
  isSyncingFirebase?: boolean;
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
}

export const TopBar: React.FC<TopBarProps> = ({
  projectName,
  agentMode,
  voiceEnabled,
  voiceLevel,
  isListening,
  isSaraSpeaking,
  isSaraSilenced,
  isThinking,
  firebaseUser,
  isSyncingFirebase = false,
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
}) => {
  const voiceLevelLabel =
    voiceLevel === 'full' ? 'Completo' : voiceLevel === 'medium' ? 'Médio' : 'Curto';

  return (
    <header className="h-14 shrink-0 bg-[#0D1117] border-b border-[#1E2433] px-2.5 sm:px-4 flex items-center justify-between gap-2 overflow-x-auto sara-scroll">
      {/* Esquerda: Avatar + Logo + Indicador de Estado de Voz/Pensamento */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        <div
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] p-[1.5px] shrink-0 shadow-[0_0_16px_rgba(59,130,246,0.35)]"
          title="Sara — Construtora Inteligente"
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
                  <stop stopColor="#3B82F6" />
                  <stop offset="1" stopColor="#8B5CF6" />
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
                stroke="#8B5CF6"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle cx="13" cy="14.5" r="1.6" fill="#3B82F6" />
              <circle cx="19" cy="14.5" r="1.6" fill="#8B5CF6" />
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
          <span className="font-extrabold text-sm sm:text-base tracking-tight bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent whitespace-nowrap">
            SARA BIULDER
          </span>
          <span className="hidden xl:inline text-[#1E2433]">|</span>
          <span className="hidden xl:inline text-xs font-medium text-[#A1A1AA] truncate max-w-[140px]">
            {projectName}
          </span>
          {isSyncingFirebase && (
            <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-mono text-cyan-300/90 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/25">
              Firebase
            </span>
          )}
        </div>

        {/* Indicadores ao vivo: A falar / A ouvir com onda / A pensar */}
        {isSaraSpeaking ? (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 text-[11px] font-medium text-[#C4B5FD] whitespace-nowrap">
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            <span>Sara a falar...</span>
          </div>
        ) : isListening ? (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-[11px] font-medium text-emerald-300 whitespace-nowrap">
            <span className="flex items-end gap-[2px] h-3" aria-hidden="true">
              <span className="w-[2px] h-2 bg-emerald-400 animate-pulse" />
              <span className="w-[2px] h-3 bg-emerald-400 animate-bounce" />
              <span className="w-[2px] h-1.5 bg-emerald-400 animate-pulse" />
              <span className="w-[2px] h-2.5 bg-emerald-400 animate-bounce" />
            </span>
            <span>A ouvir...</span>
          </div>
        ) : isThinking ? (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/40 text-[11px] font-medium text-blue-300 whitespace-nowrap">
            <span>A pensar...</span>
          </div>
        ) : null}
      </div>

      {/* Centro: Interruptor [🟢 MANUAL | 🤖 AUTOMÁTICO] */}
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

      {/* Direita: Controlos de Voz, Calar Sara e Ações */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="hidden 2xl:inline text-xs font-semibold text-white/90 mr-1 whitespace-nowrap">
          {firebaseUser?.displayName || 'Eletro-Jr'}
        </span>

        <button
          type="button"
          onClick={onSilenceSara}
          className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
            isSaraSilenced
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
              : isSaraSpeaking
              ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 animate-pulse'
              : 'bg-[#0A0A0F] border-[#1F1F2E] text-[#A1A1AA] hover:text-rose-300'
          }`}
          title={
            isSaraSilenced
              ? 'Sara calada até chamares (clica para reativar)'
              : 'Calar Sara imediatamente'
          }
        >
          <VolumeX className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">{isSaraSilenced ? 'Calada' : 'Calar Sara'}</span>
        </button>

        <button
          type="button"
          onClick={onCycleVoiceLevel}
          className="px-2 py-1.5 rounded-lg text-[11px] font-medium bg-[#0A0A0F] border border-[#1F1F2E] text-[#A1A1AA] hover:text-white transition whitespace-nowrap shrink-0 cursor-pointer"
          title="Nível de voz da Sara (Curto = só resumo essencial, Médio, Completo)"
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
          title={voiceEnabled ? 'Desligar voz da Sara' : 'Ligar voz da Sara'}
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
          {isListening ? <Mic className="w-3.5 h-3.5 animate-pulse" /> : <MicOff className="w-3.5 h-3.5" />}
          <span className="hidden lg:inline">{isListening ? 'Mãos Livres' : 'Mic'}</span>
        </button>

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

        <button
          type="button"
          onClick={onOpenSettings}
          className="px-2 py-1.5 rounded-lg text-xs font-medium bg-[#0A0A0F] border border-[#1F1F2E] text-white hover:border-[#8B5CF6]/50 transition flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          title="Configurações"
        >
          <Settings className="w-3.5 h-3.5 text-[#8B5CF6]" />
        </button>

        <button
          type="button"
          onClick={onOpenDeploy}
          className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:opacity-95 text-white transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-[0_0_14px_rgba(59,130,246,0.3)]"
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>Deploy</span>
        </button>
      </div>
    </header>
  );
};
