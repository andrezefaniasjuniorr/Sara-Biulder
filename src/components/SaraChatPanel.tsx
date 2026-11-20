import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import {
  Send,
  Copy,
  Check,
  Trash2,
  Image as ImageIcon,
  Paperclip,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileCode2,
  Clock,
  Mic,
  MicOff,
  Play,
  Pause,
  RotateCcw,
  FileText,
  Wand2,
  Eye,
  Code2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  AgentMode,
  AttachedFile,
  ChatCodeBlock,
  ChatMessage,
  LiveBuildInfo,
  ManualProposalState,
  MissionState,
  PendingVoiceConfirmation,
} from '../types/builder';
import { convertFileToMultimodalImage, type ConvertedImage } from '../services/saraAiService';

interface SaraChatPanelProps {
  messages: ChatMessage[];
  agentMode: AgentMode;
  isThinking: boolean;
  isSaraSpeaking: boolean;
  isListening: boolean;
  isVoiceProcessing?: boolean;
  pendingConfirmation?: PendingVoiceConfirmation | null;
  liveBuild: LiveBuildInfo;
  mission: MissionState;
  manualProposal: ManualProposalState;
  hasResumableMission: boolean;
  resumableGoal?: string;
  onResumeSavedMission: () => void;
  onDiscardSavedMission: () => void;
  onConfirmPending?: () => void;
  onCancelPending?: () => void;
  onToggleMic: () => void;
  onSendMessage: (
    text: string,
    image?: ConvertedImage | null,
    attachments?: AttachedFile[]
  ) => void;
  onImportZipAttachment: (file: File) => void;
  onSelectProjectFile: (filePath: string) => void;
  onApplyCodeBlockToPreview: (block: ChatCodeBlock) => void;
  onOpenCodeBlockInEditor: (block: ChatCodeBlock) => void;
  onAutoFixErrorMessage: (errorText: string) => void;
  onPauseOrResumeMission: () => void;
  onSwitchBackToManual: () => void;
  onShowMissionReport: () => void;
  onCopyAllCode: () => void;
  onClearChat: () => void;
  onApplySuggestion: (suggestion: string) => void;
  onListenMessageDetail: (text: string) => void;
  onSilenceSara: () => void;
}

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getSmartTypingSuggestions(text: string): string[] {
  const lower = text.toLowerCase();
  if (!lower.trim()) {
    return ['Criar site profissional', 'Criar App web', 'Criar Jogo', 'Dá-me ideias'];
  }
  const suggestions: string[] = [];
  if (/(loja|padaria|restaurante|venda|produto|roupa|mercado|encomenda)/i.test(lower)) {
    if (!lower.includes('m-pesa')) suggestions.push('Queres pagamento M-Pesa?');
    if (!lower.includes('whatsapp')) suggestions.push('Queres encomenda por WhatsApp?');
    if (!lower.includes('login')) suggestions.push('Queres login de clientes?');
  } else if (/(site|empresa|portf|servi|cl[ií]nica|escola)/i.test(lower)) {
    if (!lower.includes('whatsapp')) suggestions.push('Queres botão WhatsApp?');
    if (!lower.includes('contacto') && !lower.includes('formul'))
      suggestions.push('Queres formulário de contacto?');
  } else if (/(app|sistema|painel|dashboard|gest[aã]o|controlo)/i.test(lower)) {
    if (!lower.includes('login')) suggestions.push('Queres login?');
    if (!lower.includes('gr[aá]fico')) suggestions.push('Queres gráficos reais?');
    if (!lower.includes('export')) suggestions.push('Queres exportar relatórios?');
  }
  return suggestions.slice(0, 3);
}

const CHAT_MARKDOWN_COMPONENTS = {
  h1: ({ children }: any) => (
    <h1 className="text-sm font-bold text-[#60A5FA] mt-3 mb-1.5">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-xs sm:text-sm font-bold text-[#93C5FD] mt-2.5 mb-1">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-xs font-semibold text-[#C4B5FD] mt-2 mb-1">{children}</h3>
  ),
  p: ({ children }: any) => (
    <p className="mb-2 last:mb-0 leading-relaxed text-white/95">{children}</p>
  ),
  strong: ({ children }: any) => <strong className="font-bold text-white">{children}</strong>,
  ul: ({ children }: any) => (
    <ul className="list-disc pl-4 my-2 space-y-1 text-white/90">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal pl-4 my-2 space-y-1 text-white/90">{children}</ol>
  ),
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  code: ({ className, children, ...props }: any) => {
    const isBlock = Boolean(className) || (typeof children === 'string' && children.includes('\n'));
    if (!isBlock) {
      return (
        <code
          className="bg-[#0F172A] text-[#38BDF8] font-mono text-[11px] px-1.5 py-0.5 rounded border border-[#38BDF8]/30 select-text"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <pre className="my-2 p-2.5 rounded-lg bg-[#050508] border border-[#1F1F2E] overflow-x-auto sara-scroll select-text">
        <code className="text-[11px] font-mono text-emerald-300 leading-relaxed select-text" {...props}>
          {children}
        </code>
      </pre>
    );
  },
  blockquote: ({ children }: any) => (
    <blockquote className="pl-3 my-2 border-l-2 border-[#38BDF8] text-[#A1A1AA] italic">
      {children}
    </blockquote>
  ),
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#38BDF8] underline hover:text-white"
    >
      {children}
    </a>
  ),
};

export const SaraChatPanel: React.FC<SaraChatPanelProps> = ({
  messages,
  agentMode,
  isThinking,
  isSaraSpeaking,
  isListening,
  isVoiceProcessing = false,
  pendingConfirmation = null,
  liveBuild,
  mission,
  manualProposal,
  hasResumableMission,
  resumableGoal,
  onResumeSavedMission,
  onDiscardSavedMission,
  onConfirmPending,
  onCancelPending,
  onToggleMic,
  onSendMessage,
  onImportZipAttachment,
  onSelectProjectFile,
  onApplyCodeBlockToPreview,
  onOpenCodeBlockInEditor,
  onAutoFixErrorMessage,
  onPauseOrResumeMission,
  onSwitchBackToManual,
  onShowMissionReport,
  onCopyAllCode,
  onClearChat,
  onApplySuggestion,
  onListenMessageDetail,
  onSilenceSara,
}) => {
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<ConvertedImage | null>(null);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedBlockKey, setCopiedBlockKey] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const storageFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [
    messages,
    isThinking,
    liveBuild.currentStepLabel,
    liveBuild.activeFile,
    liveBuild.phase,
    mission.currentIndex,
  ]);

  // Auto-expande a caixa de texto estilo WhatsApp até 5 linhas (~120px)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 120; // ~5 linhas confortáveis
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [input]);

  const handleFilesDropOrSelect = async (fileList: File[]) => {
    for (const file of fileList) {
      if (file.name.toLowerCase().endsWith('.zip')) {
        onImportZipAttachment(file);
        continue;
      }
      if (file.type.startsWith('image/')) {
        try {
          const converted = await convertFileToMultimodalImage(file);
          setSelectedImage(converted);
        } catch {
          // ignore
        }
        continue;
      }
      try {
        const textContent = await file.text();
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            type: file.type || 'text/plain',
            content: textContent,
          },
        ]);
      } catch {
        // ignore binary
      }
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const converted = await convertFileToMultimodalImage(file);
      setSelectedImage(converted);
    } catch {
      // ignore
    } finally {
      e.target.value = '';
    }
  };

  const handleStorageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length > 0) {
      await handleFilesDropOrSelect(fileList);
    }
    e.target.value = '';
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const converted = await convertFileToMultimodalImage(file).catch(() => null);
          if (converted) setSelectedImage(converted);
        }
        return;
      }
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const dropped = Array.from(e.dataTransfer?.files || []);
    if (dropped.length > 0) {
      await handleFilesDropOrSelect(dropped);
    }
  };

  const triggerSend = () => {
    if (
      (!input.trim() && !selectedImage && attachments.length === 0) ||
      isThinking ||
      liveBuild.isBuilding ||
      (mission.active && !mission.paused)
    ) {
      return;
    }
    const text = input.trim();
    const img = selectedImage;
    const filesToSend = attachments;
    setInput('');
    setSelectedImage(null);
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(
      text ||
        (filesToSend.length > 0
          ? `Analisa e integra os ficheiros anexados (${filesToSend.map((f) => f.name).join(', ')}) neste projeto.`
          : 'Analisa atentamente esta imagem e constrói o site/app completo baseado exatamente neste visual e funcionalidades.'),
      img,
      filesToSend
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerSend();
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      triggerSend();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      triggerSend();
    }
  };

  const handleSmartSuggestionClick = (sug: string) => {
    if (sug === 'Dá-me ideias') {
      onSendMessage('Sara, dá-me ideias');
      return;
    }
    if (!input.trim()) {
      setInput(`${sug} `);
    } else {
      const cleanAdd = sug.replace(/^Queres\s+/i, 'com ').replace(/\?$/, '');
      setInput((prev) => `${prev.trim()} ${cleanAdd}`);
    }
    textareaRef.current?.focus();
  };

  const handleCopyCodeBlock = (blockKey: string, code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedBlockKey(blockKey);
    setTimeout(() => setCopiedBlockKey(null), 1500);
  };

  const smartChips = useMemo(() => getSmartTypingSuggestions(input), [input]);
  const doneCount = mission.tasks.filter((t) => t.status === 'done').length;
  const totalTasks = mission.tasks.length || 1;
  const progressPct = Math.round((doneCount / totalTasks) * 100);
  const nextPendingTask = mission.tasks.find((t) => t.status === 'pending' || t.status === 'running');

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
      className={`relative flex flex-col h-full bg-[#0D1017] border-r border-[#1F1F2E] overflow-hidden ${
        isDraggingOver ? 'ring-2 ring-cyan-400/70' : ''
      }`}
    >
      {/* Overlay de Drag & Drop */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-40 bg-[#090D16]/90 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-none">
          <div className="p-6 rounded-2xl border-2 border-dashed border-cyan-400 text-center space-y-2">
            <ImageIcon className="w-8 h-8 text-cyan-400 mx-auto" />
            <div className="text-sm font-bold text-white">Solta a imagem ou ficheiro aqui</div>
            <p className="text-xs text-[#A1A1AA]">A Sara analisa a imagem ou código para construir</p>
          </div>
        </div>
      )}

      {/* Cabeçalho HUD */}
      <div className="px-4 py-2.5 bg-[#0D1117] border-b border-[#1E2433] flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex items-center gap-2.5">
          <div
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              isListening
                ? 'bg-emerald-400 shadow-[0_0_8px_#34D399] animate-pulse'
                : isSaraSpeaking
                ? 'bg-purple-400 shadow-[0_0_8px_#A855F7] animate-pulse'
                : 'bg-cyan-400 shadow-[0_0_8px_#22D3EE]'
            }`}
          />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold tracking-wide text-white truncate">
              Sara Biulder · {agentMode === 'automatic' ? 'Automático' : 'Manual'}
            </h2>
            <p className="text-[11px] font-mono tabular-nums text-cyan-300/80 truncate">
              {isSaraSpeaking
                ? 'Sara a falar...'
                : isListening
                ? 'A ouvir em modo contínuo...'
                : isThinking || liveBuild.isBuilding
                ? `${
                    liveBuild.activeFile
                      ? `A criar ${liveBuild.activeFile}`
                      : liveBuild.phase === 'thinking'
                      ? 'A analisar arquitetura'
                      : liveBuild.phase === 'testing'
                      ? 'A testar no console'
                      : liveBuild.phase === 'fixing'
                      ? 'A corrigir erro'
                      : 'A construir módulos'
                  } · ${formatTimer(liveBuild.elapsedSeconds)}`
                : agentMode === 'manual'
                ? 'Contigo passo a passo · Eletro-Jr'
                : 'Autónomo sem limites · Eletro-Jr'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isSaraSpeaking && (
            <button
              type="button"
              onClick={onSilenceSara}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 border border-rose-500/50 text-rose-200 hover:bg-rose-500/30 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap animate-pulse"
              title="Calar Sara imediatamente"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Calar Sara</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onCopyAllCode();
              setCopiedCode(true);
              setTimeout(() => setCopiedCode(false), 1800);
            }}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#0A0A0F] border border-[#1F1F2E] text-[#A1A1AA] hover:text-white transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="Copiar todo o código atual"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedCode ? 'Copiado' : 'Copiar'}</span>
          </button>

          <button
            type="button"
            onClick={onClearChat}
            className="p-1.5 rounded-lg bg-[#0A0A0F] border border-[#1F1F2E] text-[#A1A1AA] hover:text-rose-400 transition cursor-pointer"
            title="Limpar chat"
            aria-label="Limpar chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canal de Voz J.A.R.V.I.S. em 2.º Plano (sem transcrição de texto no chat) */}
      {(isListening || isSaraSpeaking || isVoiceProcessing) && (
        <div className="px-4 py-2 bg-[#070B13] border-b border-cyan-500/25 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-end gap-[2.5px] h-3.5 shrink-0" aria-hidden="true">
              <span
                className={`w-[2.5px] h-2 rounded-full animate-pulse ${
                  isSaraSpeaking ? 'bg-purple-400' : isVoiceProcessing ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
              <span
                className={`w-[2.5px] h-3.5 rounded-full animate-bounce ${
                  isSaraSpeaking ? 'bg-purple-400' : isVoiceProcessing ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
              <span
                className={`w-[2.5px] h-1.5 rounded-full animate-pulse ${
                  isSaraSpeaking ? 'bg-purple-400' : isVoiceProcessing ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
              <span
                className={`w-[2.5px] h-3 rounded-full animate-bounce ${
                  isSaraSpeaking ? 'bg-purple-400' : isVoiceProcessing ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
            </span>
            <span className="text-[11px] font-mono text-cyan-200/90 truncate">
              {isSaraSpeaking
                ? 'Voz em 2.º plano · Sara a responder em áudio'
                : isVoiceProcessing
                ? 'Voz em 2.º plano · A processar comando...'
                : 'Voz em 2.º plano · Escuta ativa'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isSaraSpeaking && (
              <button
                type="button"
                onClick={onSilenceSara}
                className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-[10px] font-mono text-rose-200 hover:bg-rose-500/30 cursor-pointer"
              >
                Calar
              </button>
            )}
            {isListening && (
              <button
                type="button"
                onClick={onToggleMic}
                className="px-2 py-0.5 rounded bg-[#12121A] border border-[#1F1F2E] text-[10px] font-mono text-[#A1A1AA] hover:text-white cursor-pointer"
              >
                Pausar Mic
              </button>
            )}
          </div>
        </div>
      )}

      {/* Banner: Continuar Missão Anterior */}
      {hasResumableMission && !mission.active && (
        <div className="px-4 py-2.5 bg-[#0D1526] border-b border-blue-500/30 flex items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-blue-100 min-w-0">
            <span className="font-semibold">Continuar de onde parei?</span>{' '}
            <span className="text-blue-300 truncate">{resumableGoal}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onResumeSavedMission}
              className="px-2.5 py-1 rounded bg-[#3B82F6] text-white text-[11px] font-semibold cursor-pointer"
            >
              Continuar
            </button>
            <button
              type="button"
              onClick={onDiscardSavedMission}
              className="px-2 py-1 rounded bg-[#12121A] border border-[#1F1F2E] text-[11px] text-[#A1A1AA] cursor-pointer"
            >
              Ignorar
            </button>
          </div>
        </div>
      )}

      {/* Painel de Missão do Modo Automático */}
      {(mission.active || mission.finished) && mission.tasks.length > 0 && (
        <div className="px-4 py-3 bg-[#090C12] border-b border-cyan-500/20 shrink-0 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-white truncate">
              {mission.active
                ? `Etapa ${Math.min(mission.currentIndex + 1, totalTasks)} de ${totalTasks} — ${
                    mission.tasks[mission.currentIndex]?.title || 'A preparar módulo seguinte...'
                  }`
                : `Missão concluída: ${doneCount}/${totalTasks} etapas`}
            </span>
            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
              <span className="text-[#A1A1AA]">{formatTimer(mission.elapsedSeconds)}</span>
              <span className="text-cyan-400 font-bold">{progressPct}%</span>
            </div>
          </div>

          <div className="h-1.5 w-full rounded-full bg-[#1F1F2E] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#3B82F6] via-cyan-400 to-[#8B5CF6] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {nextPendingTask && mission.active && (
            <div className="text-[11px] text-[#A1A1AA] truncate">
              Próxima: <span className="text-white/90">{nextPendingTask.title}</span>
            </div>
          )}

          <div className="space-y-1 max-h-24 overflow-y-auto sara-scroll">
            {mission.tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2 text-[11px]">
                {task.status === 'done' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : task.status === 'running' ? (
                  <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                ) : task.status === 'error' ? (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-[#1F1F2E] inline-block shrink-0" />
                )}
                <span
                  className={
                    task.status === 'done'
                      ? 'text-emerald-300 line-through opacity-80'
                      : task.status === 'running'
                      ? 'text-white font-medium'
                      : 'text-[#A1A1AA]'
                  }
                >
                  {task.id}. {task.title}
                </span>
              </div>
            ))}
          </div>

          {/* Controlos da Missão: Pausar / Voltar para Manual / Ver Relatório */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {mission.active && (
              <>
                <button
                  type="button"
                  onClick={onPauseOrResumeMission}
                  className="px-2.5 py-1 rounded-lg bg-[#12121A] border border-[#1F1F2E] hover:border-amber-400/50 text-[11px] text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  {mission.paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                  <span>{mission.paused ? 'Retomar Automático' : 'Pausar Automático'}</span>
                </button>
                <button
                  type="button"
                  onClick={onSwitchBackToManual}
                  className="px-2.5 py-1 rounded-lg bg-[#12121A] border border-[#1F1F2E] hover:border-emerald-400/50 text-[11px] text-emerald-300 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Voltar para Manual</span>
                </button>
              </>
            )}
            {(mission.report || mission.finished) && (
              <button
                type="button"
                onClick={onShowMissionReport}
                className="px-2.5 py-1 rounded-lg bg-[#3B82F6]/20 border border-[#3B82F6]/40 text-[11px] text-blue-200 flex items-center gap-1 cursor-pointer"
              >
                <FileText className="w-3 h-3" />
                <span>Ver Relatório</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Feed Técnico de Criação (Voz roda em 2.º plano, chat exibe apenas engenharia e entregas) */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 sara-scroll bg-[#0A0D14]">
        {messages.length === 0 && !isThinking && !liveBuild.isBuilding && (
          <div className="rounded-xl bg-[#0D1117] border border-[#1E2433] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-[#1E2433] pb-2">
              <span className="text-xs font-semibold tracking-wide text-cyan-300">
                Consola de Engenharia
              </span>
              <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                VOZ EM 2.º PLANO
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Pede por voz ou escreve o sistema que queres construir. Os diálogos por voz rodam em segundo plano — aqui ficam apenas arquitetura, código modular, auditorias e melhorias estratégicas.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {[
                'Cria um dashboard financeiro com gráficos Chart.js, Dark/Light mode e CRUD',
                'Cria uma loja e-commerce completa com carrinho, checkout e filtros',
                'Cria um sistema escolar com alunos, notas, presenças e relatórios',
                'Cria um jogo arcade espacial com áudio Web Audio e recordes',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onSendMessage(preset)}
                  className="text-left px-3 py-2 rounded-lg bg-[#05080F] hover:bg-cyan-500/10 border border-[#1F1F2E] hover:border-cyan-500/40 text-[11px] text-white/90 transition cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isErrorMsg = Boolean(msg.errorContext);

          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className={`relative max-w-[95%] rounded-xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-gradient-to-br from-[#1D4ED8]/90 to-[#6D28D9]/90 border border-blue-400/30 text-white rounded-br-none'
                    : isErrorMsg
                    ? 'w-full bg-rose-950/35 border border-rose-500/45 text-rose-100 rounded-tl-none'
                    : 'w-full bg-[#0D1117] border border-[#1E2433] text-white rounded-tl-none'
                }`}
              >
                <div
                  className={`flex items-center justify-between gap-3 pb-1.5 mb-2 border-b text-[10px] font-mono ${
                    isUser
                      ? 'border-white/15 text-blue-100'
                      : isErrorMsg
                      ? 'border-rose-500/30 text-rose-300'
                      : 'border-cyan-500/20 text-cyan-300'
                  }`}
                >
                  <span className="font-bold tracking-wider uppercase">
                    {isUser ? 'ELETRO-JR' : isErrorMsg ? 'ALERTA DO SISTEMA' : 'SARA'}
                  </span>
                  <div className="flex items-center gap-2">
                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => onListenMessageDetail(msg.text)}
                        className="px-1.5 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-500/30 text-[10px] text-cyan-200 flex items-center gap-1 cursor-pointer transition"
                        title="Ouvir esta mensagem completa em voz"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>Ouvir</span>
                      </button>
                    )}
                    <span className="opacity-80">{msg.timestamp}</span>
                  </div>
                </div>

                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="Anexo visual"
                    className="max-h-44 rounded-lg border border-cyan-500/30 mb-2 object-contain"
                    referrerPolicy="no-referrer"
                  />
                )}

                {msg.attachedFileName && (
                  <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-[#0A0A0F] border border-cyan-500/30 text-[11px] font-mono text-cyan-300 flex items-center gap-1.5">
                    <Paperclip className="w-3 h-3" />
                    <span className="truncate">{msg.attachedFileName}</span>
                  </div>
                )}

                {/* Diagnóstico & Arquitetura */}
                {msg.architectureSummary && !isUser && (
                  <div className="mb-3 p-3 rounded-lg bg-[#070B14] border border-blue-500/30 space-y-1">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-blue-300 font-bold">
                      Arquitetura do Sistema
                    </div>
                    <p className="text-xs text-white/90 leading-relaxed">{msg.architectureSummary}</p>
                  </div>
                )}

                {/* Checklist de Etapas */}
                {msg.buildSummary && !isUser && (
                  <div className="mb-3 p-3 rounded-lg bg-[#05080F] border border-cyan-500/25 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Módulos construídos ({msg.buildSummary.filesCreated.length})</span>
                      </span>
                      <span className="text-cyan-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimer(msg.buildSummary.elapsedSeconds)}</span>
                      </span>
                    </div>

                    {msg.buildSummary.steps.length > 0 && (
                      <div className="space-y-1">
                        {msg.buildSummary.steps.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 text-[11px] text-[#A1A1AA]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>{s.label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.buildSummary.filesCreated.length > 0 && (
                      <div className="pt-2 border-t border-[#1F1F2E] flex flex-wrap gap-1.5">
                        {msg.buildSummary.filesCreated.map((filePath) => (
                          <button
                            key={filePath}
                            type="button"
                            onClick={() => onSelectProjectFile(filePath)}
                            className="px-2 py-1 rounded bg-[#0D1322] hover:bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-mono text-cyan-200 flex items-center gap-1 cursor-pointer transition"
                          >
                            <FileCode2 className="w-3 h-3 text-cyan-400" />
                            <span>{filePath}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {isUser ? (
                  <p className="whitespace-pre-wrap select-text">{msg.text}</p>
                ) : (
                  <div className="text-xs sm:text-sm select-text">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={CHAT_MARKDOWN_COMPONENTS}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Blocos de Código Separados com Copiar / Aplicar no Preview / Abrir no Editor */}
                {msg.codeBlocks && msg.codeBlocks.length > 0 && !isUser && (
                  <div className="mt-3 space-y-2.5">
                    {msg.codeBlocks.map((blk) => {
                      const blkKey = `${msg.id}_${blk.path}`;
                      return (
                        <div
                          key={blk.path}
                          className="rounded-lg bg-[#050508] border border-[#1F1F2E] overflow-hidden"
                        >
                          <div className="px-2.5 py-1.5 bg-[#0A0D14] border-b border-[#1F1F2E] flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-mono text-cyan-300 truncate">
                              {blk.path}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCopyCodeBlock(blkKey, blk.code)}
                                className="px-2 py-0.5 rounded bg-[#12121A] border border-[#1F1F2E] hover:border-cyan-400/50 text-[10px] text-[#A1A1AA] hover:text-white flex items-center gap-1 cursor-pointer"
                              >
                                {copiedBlockKey === blkKey ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                <span>{copiedBlockKey === blkKey ? 'Copiado' : 'Copiar'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onApplyCodeBlockToPreview(blk)}
                                className="px-2 py-0.5 rounded bg-[#3B82F6]/20 border border-[#3B82F6]/40 hover:bg-[#3B82F6]/30 text-[10px] text-blue-200 flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Aplicar no Preview</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenCodeBlockInEditor(blk)}
                                className="px-2 py-0.5 rounded bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 hover:bg-[#8B5CF6]/30 text-[10px] text-purple-200 flex items-center gap-1 cursor-pointer"
                              >
                                <Code2 className="w-3 h-3" />
                                <span>Abrir no Editor</span>
                              </button>
                            </div>
                          </div>
                          <pre className="p-2.5 max-h-40 overflow-auto sara-scroll text-[11px] font-mono text-emerald-300 select-text whitespace-pre">
                            {blk.code}
                          </pre>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Botão de Aprovação no Modo Manual */}
                {msg.mode === 'manual-proposal' && manualProposal.active && !isUser && (
                  <div className="mt-2.5 pt-2 border-t border-emerald-500/25 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSendMessage('Sim, pode continuar!')}
                      className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-xs font-semibold cursor-pointer"
                    >
                      Sim, aprovar e avançar
                    </button>
                  </div>
                )}

                {/* Botão Corrigir Automaticamente para Mensagens de Erro */}
                {isErrorMsg && (
                  <div className="mt-2.5 pt-2 border-t border-rose-500/30">
                    <button
                      type="button"
                      onClick={() => onAutoFixErrorMessage(msg.errorContext!)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Corrigir automaticamente</span>
                    </button>
                  </div>
                )}

                {msg.strategicImprovements && msg.strategicImprovements.length > 0 && !isUser ? (
                  <div className="mt-3 pt-2.5 border-t border-cyan-500/20 space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-300 font-semibold">
                      Próximas Melhorias Estratégicas (1 Clique)
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {msg.strategicImprovements.slice(0, 2).map((imp, idx) => (
                        <button
                          key={`${msg.id}_imp_${idx}`}
                          type="button"
                          onClick={() => onApplySuggestion(imp)}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg bg-[#05080F] hover:bg-cyan-500/15 border border-cyan-500/30 text-[11px] text-cyan-100 flex items-center justify-between gap-2 cursor-pointer transition"
                        >
                          <span className="truncate">{idx + 1}. {imp}</span>
                          <span className="text-[10px] font-mono text-cyan-300 shrink-0">Implementar</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  msg.suggestion &&
                  !isUser && (
                    <div className="mt-2.5 pt-2 border-t border-cyan-500/20 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[#A1A1AA]">{msg.suggestion}</span>
                      <button
                        type="button"
                        onClick={() => onApplySuggestion(msg.suggestion!)}
                        className="px-2.5 py-1 rounded bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-[10px] font-semibold shrink-0 cursor-pointer"
                      >
                        Aplicar
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}

        {/* Cartão de Confirmação Direta (Segurança & Autorizações) */}
        {pendingConfirmation && (
          <div className="w-full rounded-xl bg-amber-950/35 border border-amber-400/50 p-3.5 space-y-2.5 shadow-[0_0_24px_rgba(245,158,11,0.12)]">
            <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold">
              <span>{pendingConfirmation.title}</span>
              <span>Aguardar confirmação</span>
            </div>
            <p className="text-xs text-amber-50 leading-relaxed">{pendingConfirmation.question}</p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={onConfirmPending}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-100 text-xs font-semibold cursor-pointer transition"
              >
                Confirmar (ou diz &quot;Sim&quot;)
              </button>
              <button
                type="button"
                onClick={onCancelPending}
                className="px-3 py-1.5 rounded-lg bg-[#0A0A0F] hover:bg-rose-500/20 border border-[#1F1F2E] hover:border-rose-400/40 text-xs text-[#A1A1AA] hover:text-rose-200 cursor-pointer transition"
              >
                Cancelar (ou diz &quot;Não&quot;)
              </button>
            </div>
          </div>
        )}

        {/* Indicador Transparente em Tempo Real (Etapas + Ficheiros um por um) */}
        {(isThinking || liveBuild.isBuilding) && (
          <div className="w-full rounded-xl bg-[#090D16] border border-cyan-400/40 p-3.5 space-y-2.5 shadow-[0_0_24px_rgba(6,182,212,0.12)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-300 min-w-0">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                <span className="truncate">
                  {liveBuild.phase === 'thinking'
                    ? 'A analisar contexto, estrutura e dependências...'
                    : liveBuild.phase === 'planning'
                    ? liveBuild.planSentence || 'A definir arquitetura modular por pastas...'
                    : liveBuild.phase === 'testing'
                    ? liveBuild.currentStepLabel || 'A validar interface, botões e console...'
                    : liveBuild.phase === 'fixing'
                    ? liveBuild.currentStepLabel || 'A corrigir falha detetada...'
                    : liveBuild.activeFile
                    ? `A criar/editar ${liveBuild.activeFile}`
                    : liveBuild.currentStepLabel || 'A construir módulos do sistema...'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono tabular-nums text-xs text-cyan-300 bg-[#05080F] px-2 py-0.5 rounded border border-[#1E2433] shrink-0">
                <Clock className="w-3 h-3" />
                <span>{formatTimer(liveBuild.elapsedSeconds)}</span>
              </div>
            </div>

            {liveBuild.planSentence && liveBuild.phase !== 'thinking' && (
              <p className="text-[11px] text-[#A1A1AA] leading-relaxed border-l-2 border-cyan-500/40 pl-2.5">
                {liveBuild.planSentence}
              </p>
            )}

            {/* Etapas reais da construção */}
            {liveBuild.steps.length > 0 && (
              <div className="rounded-lg bg-[#05080F] border border-[#1F1F2E] p-2.5 space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-300/80 font-semibold">
                  Etapas em execução
                </div>
                {liveBuild.steps.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-[11px]">
                    {s.status === 'done' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : s.status === 'running' ? (
                      <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-[#2A2A3C] inline-block shrink-0" />
                    )}
                    <span
                      className={
                        s.status === 'done'
                          ? 'text-emerald-300/90'
                          : s.status === 'running'
                          ? 'text-white font-medium'
                          : 'text-[#A1A1AA]'
                      }
                    >
                      {s.id}. {s.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Ficheiros a ser criados/editados um por um */}
            {(liveBuild.createdFiles.length > 0 || liveBuild.activeFile) && (
              <div className="rounded-lg bg-[#05080F] border border-cyan-500/20 p-2.5 space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-300/90 font-semibold">
                  Ficheiros ({liveBuild.createdFiles.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(
                    new Set([
                      ...liveBuild.createdFiles,
                      ...(liveBuild.activeFile ? [liveBuild.activeFile] : []),
                    ])
                  ).map((filePath) => {
                    const isWriting = liveBuild.activeFile === filePath;
                    const isCompleted = liveBuild.completedFiles?.includes(filePath) && !isWriting;
                    return (
                      <button
                        key={filePath}
                        type="button"
                        onClick={() => onSelectProjectFile(filePath)}
                        className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1.5 border cursor-pointer transition ${
                          isWriting
                            ? 'bg-cyan-500/20 border-cyan-400 text-white animate-pulse'
                            : isCompleted
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                            : 'bg-[#0D1322] border-cyan-500/30 text-cyan-200'
                        }`}
                      >
                        {isWriting ? (
                          <Loader2 className="w-3 h-3 animate-spin text-cyan-300" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        )}
                        <span>{filePath}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Sugestões Inteligentes enquanto escrevo */}
      <div className="px-3 py-1.5 border-t border-[#1F1F2E] bg-[#090C12] flex items-center gap-1.5 overflow-x-auto sara-scroll shrink-0">
        {smartChips.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => handleSmartSuggestionClick(item)}
            className="px-2.5 py-1 rounded-lg bg-[#0A0A0F] hover:bg-[#1F1F2E] border border-[#1F1F2E] text-[11px] font-medium text-[#A1A1AA] hover:text-white transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            {item}
          </button>
        ))}
      </div>

      {/* Prévias de Imagem & Ficheiros Anexados */}
      {(selectedImage || attachments.length > 0) && (
        <div className="px-3 py-2 bg-[#090C12] border-t border-[#1F1F2E] flex flex-wrap items-center gap-2 shrink-0">
          {selectedImage && (
            <div className="flex items-center gap-2 bg-[#12121A] border border-cyan-500/40 rounded-lg px-2 py-1">
              <img
                src={selectedImage.previewUrl}
                alt="Prévia"
                className="w-8 h-8 rounded object-cover"
              />
              <span className="text-[11px] text-cyan-200">Imagem pronta p/ análise</span>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="text-[#A1A1AA] hover:text-rose-400 cursor-pointer"
                aria-label="Remover imagem"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {attachments.map((att, idx) => (
            <div
              key={`${att.name}_${idx}`}
              className="flex items-center gap-1.5 bg-[#12121A] border border-cyan-500/40 rounded-lg px-2.5 py-1 text-[11px] font-mono text-cyan-200"
            >
              <Paperclip className="w-3 h-3 text-cyan-400" />
              <span className="max-w-[140px] truncate">{att.name}</span>
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                className="text-[#A1A1AA] hover:text-rose-400 cursor-pointer"
                aria-label={`Remover ${att.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Barra de Escrever Estilo WhatsApp (Arredondada, cresce até 5 linhas, botões dentro) */}
      <form
        onSubmit={handleFormSubmit}
        className="p-2.5 sm:p-3 border-t border-cyan-500/20 bg-[#090C12] shrink-0"
      >
        <input
          type="file"
          ref={imageInputRef}
          onChange={handleImageChange}
          accept="image/*"
          className="hidden"
        />
        <input
          type="file"
          ref={storageFileInputRef}
          onChange={handleStorageFileChange}
          multiple
          accept=".html,.css,.js,.jsx,.ts,.tsx,.py,.sql,.json,.txt,.md,.csv,.svg,.zip,image/*"
          className="hidden"
        />

        <div className="flex items-end gap-1.5 bg-[#0A0A0F] border border-[#1F1F2E] focus-within:border-cyan-400 rounded-2xl px-2.5 py-1.5 transition">
          <button
            type="button"
            onClick={() => storageFileInputRef.current?.click()}
            className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-cyan-300 transition shrink-0 cursor-pointer mb-0.5"
            title="Anexar ficheiro do dispositivo, Drive ou ZIP"
            aria-label="Anexar ficheiro"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-cyan-300 transition shrink-0 cursor-pointer mb-0.5"
            title="Anexar imagem (ou cola com Ctrl+V / arrasta)"
            aria-label="Imagem"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleComposerKeyDown}
            onPaste={handlePaste}
            placeholder="Escreve ou fala com a Sara, Eletro-Jr... (Enter envia, Shift+Enter quebra linha)"
            className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-white placeholder-[#A1A1AA]/60 outline-none resize-none overflow-y-auto overflow-x-auto sara-scroll py-1.5 leading-5 max-h-[120px]"
          />

          <button
            type="button"
            onClick={onToggleMic}
            className={`p-1.5 rounded-lg transition shrink-0 cursor-pointer mb-0.5 ${
              isListening
                ? 'bg-emerald-500/20 text-emerald-300 animate-pulse'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
            title={isListening ? 'Desligar microfone contínuo' : 'Ligar microfone mãos-livres'}
            aria-label="Microfone"
          >
            {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          <button
            type="submit"
            disabled={
              (!input.trim() && !selectedImage && attachments.length === 0) ||
              isThinking ||
              liveBuild.isBuilding ||
              (mission.active && !mission.paused)
            }
            className="p-2 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:opacity-95 disabled:opacity-35 text-white transition shrink-0 cursor-pointer mb-0.5"
            title="Enviar (Enter ou Ctrl+Enter)"
            aria-label="Enviar"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </section>
  );
};
