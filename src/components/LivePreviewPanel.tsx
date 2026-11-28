import React, { useEffect, useMemo, useState } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  Maximize2,
  Minimize2,
  Download,
  Github,
  Globe,
  Loader2,
  FileCode2,
  X,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import type { BuilderProjectContract, PreviewDevice, ProjectFiles } from '../types/builder';
import { buildPreviewSrcDoc } from '../utils/previewBuilder';
import { buildAiStudioExportPrompt } from '../utils/builderScaffolder';
import { GeneratedChatImageCard } from './GeneratedChatImageCard';
import { downloadImageDataUrl, type SaraImageStyle } from '../services/imageGenService';

export interface GeneratedPreviewImageState {
  messageId: string;
  prompt: string;
  imageUrl?: string;
  isGenerating?: boolean;
  isTopQuality?: boolean;
  awaitingStyle?: boolean;
  style?: SaraImageStyle;
  seed?: number;
  errorMessage?: string;
}

interface LivePreviewPanelProps {
  files: ProjectFiles;
  projectName: string;
  device: PreviewDevice;
  refreshSeed: number;
  isBuilding?: boolean;
  activeBuildingFile?: string;
  elapsedSeconds?: number;
  builtFilesCount?: number;
  isPresentationMode?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onTogglePresentation?: () => void;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onChangeDevice: (device: PreviewDevice) => void;
  onRefresh: () => void;
  onDownloadZip: () => void;
  onPushGitHub: () => void;
  onPublish: () => void;
  activeContract?: BuilderProjectContract | null;
  generatedImage?: GeneratedPreviewImageState | null;
  onCloseGeneratedImage?: () => void;
  onSelectGeneratedImageStyle?: (messageId: string, prompt: string, style: SaraImageStyle) => void;
  onRegenerateGeneratedImage?: (
    messageId: string,
    prompt: string,
    style?: SaraImageStyle,
    seed?: number
  ) => void;
  onTopQualityGeneratedImage?: (
    messageId: string,
    prompt: string,
    style?: SaraImageStyle,
    seed?: number
  ) => void;
  onUseGeneratedImageAsProfile?: (imageUrl: string) => Promise<void> | void;
}

export const LivePreviewPanel: React.FC<LivePreviewPanelProps> = ({
  files,
  projectName,
  device,
  refreshSeed,
  isBuilding = false,
  activeBuildingFile,
  elapsedSeconds = 0,
  builtFilesCount = 0,
  isPresentationMode = false,
  isFullscreen: controlledFullscreen,
  onToggleFullscreen,
  onTogglePresentation,
  iframeRef,
  onChangeDevice,
  onRefresh,
  onDownloadZip,
  onPushGitHub,
  onPublish,
  activeContract = null,
  generatedImage = null,
  onCloseGeneratedImage,
  onSelectGeneratedImageStyle,
  onRegenerateGeneratedImage,
  onTopQualityGeneratedImage,
  onUseGeneratedImageAsProfile,
}) => {
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [showAiStudioModal, setShowAiStudioModal] = useState(false);
  const [copiedAiPrompt, setCopiedAiPrompt] = useState(false);
  const isFullscreen =
    controlledFullscreen !== undefined ? controlledFullscreen : internalFullscreen;
  const toggleFullscreen = onToggleFullscreen || (() => setInternalFullscreen((v) => !v));
  const [debouncedFiles, setDebouncedFiles] = useState<ProjectFiles>(files);
  const aiStudioPromptText = useMemo(
    () => buildAiStudioExportPrompt(projectName, activeContract, files),
    [projectName, activeContract, files]
  );

  useEffect(() => {
    if (isBuilding) return;

    const timer = setTimeout(() => {
      setDebouncedFiles(files);
    }, 150);
    return () => clearTimeout(timer);
  }, [files, isBuilding]);

  const srcDoc = useMemo(
    () => buildPreviewSrcDoc(debouncedFiles),
    [debouncedFiles, refreshSeed]
  );

  const frameWidthClass =
    device === 'mobile'
      ? 'w-[375px] max-w-full h-full rounded-2xl border border-[#1F1F2E] shadow-2xl'
      : device === 'tablet'
      ? 'w-[768px] max-w-full h-full rounded-xl border border-[#1F1F2E] shadow-2xl'
      : 'w-full h-full rounded-lg border border-[#1F1F2E]';

  // Modo Apresentação: mostra APENAS o site criado em tela cheia para mostrar ao cliente
  if (isPresentationMode) {
    return (
      <section className="fixed inset-0 z-50 h-screen w-screen bg-[#0A0A0F] overflow-hidden">
        <button
          type="button"
          onClick={onTogglePresentation}
          className="fixed top-3 right-3 z-50 px-3 py-1.5 rounded-lg bg-[#0A0A0F]/85 hover:bg-[#12121A] border border-[#1F1F2E] text-xs font-semibold text-white flex items-center gap-1.5 backdrop-blur-md shadow-xl cursor-pointer"
          title="Sair do Modo Apresentação (Esc)"
        >
          <X className="w-3.5 h-3.5 text-rose-400" />
          <span>Sair da Apresentação</span>
        </button>
        <iframe
          ref={iframeRef}
          title={`Apresentação — ${projectName}`}
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
          className="w-full h-full border-0 bg-[#0A0A0F]"
        />
      </section>
    );
  }

  return (
    <section
      className={`flex flex-col bg-[#0A0A0F] overflow-hidden ${
        isFullscreen
          ? 'fixed inset-0 z-50 h-screen w-screen'
          : 'h-full border-r border-[#1E2433]'
      }`}
    >
      {/* Barra de Ferramentas do Preview */}
      <div className="px-3 py-2.5 bg-[#0D1117] border-b border-[#1E2433] flex items-center justify-between gap-2 overflow-x-auto sara-scroll shrink-0">
        <div className="flex items-center gap-1 bg-[#0A0A0F] p-1 rounded-lg border border-[#1F1F2E] shrink-0">
          <button
            type="button"
            onClick={() => onChangeDevice('desktop')}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
              device === 'desktop' ? 'bg-[#3B82F6] text-white' : 'text-[#A1A1AA] hover:text-white'
            }`}
            title="Preview em PC"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">PC</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeDevice('tablet')}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
              device === 'tablet' ? 'bg-[#3B82F6] text-white' : 'text-[#A1A1AA] hover:text-white'
            }`}
            title="Preview em Tablet"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Tablet</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeDevice('mobile')}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
              device === 'mobile' ? 'bg-[#3B82F6] text-white' : 'text-[#A1A1AA] hover:text-white'
            }`}
            title="Preview em Telemóvel"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Telemóvel</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            className="px-2 py-1.5 rounded-lg bg-[#0A0A0F] border border-[#1F1F2E] text-[#A1A1AA] hover:text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
            title="Atualizar Preview"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-2 py-1.5 rounded-lg bg-[#0A0A0F] border border-[#1F1F2E] text-[#A1A1AA] hover:text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
            title={isFullscreen ? 'Sair de tela cheia' : 'Tela cheia'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setShowAiStudioModal(true)}
            className="px-2.5 py-1.5 rounded-lg bg-[#0A0A0F] border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/15 text-xs font-medium flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
            title="Gerar prompt completo para abrir no Google AI Studio"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            <span className="hidden md:inline">Abrir no Google AI Studio</span>
          </button>

          <button
            type="button"
            onClick={onDownloadZip}
            className="px-2.5 py-1.5 rounded-lg bg-[#0A0A0F] border border-[#1F1F2E] text-white hover:border-[#3B82F6]/50 text-xs font-medium flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
            title="Descarregar projeto completo em ZIP"
          >
            <Download className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span className="hidden sm:inline">Descarregar Projeto</span>
          </button>

          <button
            type="button"
            onClick={onPushGitHub}
            className="px-2.5 py-1.5 rounded-lg bg-[#0A0A0F] border border-[#1F1F2E] text-white hover:border-[#8B5CF6]/50 text-xs font-medium flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
            title="Guardar no Cofre de Projetos"
          >
            <Github className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Cofre de Projetos</span>
          </button>

          <button
            type="button"
            onClick={onPublish}
            className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
            title="Publicar na Web"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Publicar</span>
          </button>
        </div>
      </div>

      {/* Modal Abrir no Google AI Studio */}
      {showAiStudioModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[#0D1117] border border-cyan-500/40 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-4 py-3 border-b border-[#1E2433] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Abrir no Google AI Studio</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAiStudioModal(false)}
                className="p-1 rounded-lg text-[#A1A1AA] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto sara-scroll">
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Copia o prompt estruturado abaixo e cola no Google AI Studio para continuar ou expandir este projeto com toda a arquitetura, stack e pastas preservadas.
              </p>
              <textarea
                readOnly
                value={aiStudioPromptText}
                className="w-full h-64 rounded-xl bg-[#05080F] border border-[#1E2433] p-3 text-xs font-mono text-emerald-300 outline-none resize-none sara-scroll"
              />
            </div>
            <div className="px-4 py-3 border-t border-[#1E2433] flex flex-wrap items-center justify-end gap-2 bg-[#090D16]">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(aiStudioPromptText).catch(() => {});
                  setCopiedAiPrompt(true);
                  setTimeout(() => setCopiedAiPrompt(false), 2000);
                }}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {copiedAiPrompt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAiPrompt ? 'Prompt Copiado!' : 'Copiar Prompt Completo'}</span>
              </button>
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white text-xs font-semibold flex items-center gap-1.5 hover:opacity-95"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Ir para Google AI Studio</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Área do Iframe */}
      <div className="relative flex-1 p-2 sm:p-3 flex items-center justify-center bg-[#07070B] overflow-hidden">
        <div className={`${frameWidthClass} overflow-hidden bg-[#0A0A0F] transition-all duration-200`}>
          <iframe
            ref={iframeRef}
            title={`Preview ao vivo — ${projectName}`}
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
            className="w-full h-full border-0 bg-[#0A0A0F]"
          />
        </div>

        {/* Visualizador de Imagem Gerada SARA no Painel Direito */}
        {generatedImage && !isBuilding && (
          <div className="absolute inset-0 bg-[#050812]/98 z-10 overflow-y-auto sara-scroll p-4 flex flex-col">
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-cyan-500/25 shrink-0">
              <span className="text-xs font-bold text-cyan-200 truncate">
                {generatedImage.prompt || 'Imagem SARA'}
              </span>
              {onCloseGeneratedImage && (
                <button
                  type="button"
                  onClick={onCloseGeneratedImage}
                  className="px-2.5 py-1 rounded-lg bg-[#09162E] hover:bg-rose-500/20 border border-cyan-500/30 text-[11px] font-semibold text-slate-200 flex items-center gap-1 cursor-pointer shrink-0 transition"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Fechar</span>
                </button>
              )}
            </div>
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <GeneratedChatImageCard
                imageUrl={generatedImage.imageUrl}
                isGenerating={generatedImage.isGenerating}
                isTopQuality={generatedImage.isTopQuality}
                awaitingStyle={generatedImage.awaitingStyle}
                activeStyle={generatedImage.style}
                prompt={generatedImage.prompt}
                errorMessage={generatedImage.errorMessage}
                large
                onSelectStyle={(style) =>
                  onSelectGeneratedImageStyle?.(
                    generatedImage.messageId,
                    generatedImage.prompt,
                    style
                  )
                }
                onDownload={() =>
                  generatedImage.imageUrl &&
                  downloadImageDataUrl(generatedImage.imageUrl, generatedImage.prompt)
                }
                onRegenerate={() =>
                  onRegenerateGeneratedImage?.(
                    generatedImage.messageId,
                    generatedImage.prompt,
                    generatedImage.style,
                    generatedImage.seed
                  )
                }
                onTopQuality={
                  onTopQualityGeneratedImage
                    ? () =>
                        onTopQualityGeneratedImage(
                          generatedImage.messageId,
                          generatedImage.prompt,
                          generatedImage.style,
                          generatedImage.seed
                        )
                    : undefined
                }
                onUseAsProfilePhoto={async () => {
                  if (generatedImage.imageUrl && onUseGeneratedImageAsProfile) {
                    await onUseGeneratedImageAsProfile(generatedImage.imageUrl);
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Overlay ao vivo durante construção */}
        {isBuilding && (
          <div className="absolute inset-0 bg-[#07070B]/80 backdrop-blur-sm flex items-center justify-center p-4 z-20">
            <div className="max-w-sm w-full rounded-2xl bg-[#090D16] border border-cyan-500/40 p-5 shadow-[0_0_30px_rgba(6,182,212,0.18)] space-y-3 text-center">
              <div className="w-11 h-11 mx-auto rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              </div>
              <div>
                <div className="text-xs font-mono tabular-nums uppercase tracking-wider text-cyan-300 font-bold">
                  Construção em Curso · {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:
                  {String(elapsedSeconds % 60).padStart(2, '0')}
                </div>
                <p className="text-xs text-[#A1A1AA] mt-1">
                  {activeBuildingFile
                    ? 'A escrever ficheiro em tempo real no Editor...'
                    : 'Sara está a organizar e construir esta etapa...'}
                </p>
              </div>
              {activeBuildingFile && (
                <div className="px-3 py-1.5 rounded-lg bg-[#05080F] border border-cyan-500/30 text-xs font-mono text-cyan-200 flex items-center justify-center gap-2">
                  <FileCode2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{activeBuildingFile}</span>
                </div>
              )}
              {builtFilesCount > 0 && (
                <div className="text-[11px] font-mono text-emerald-400">
                  {builtFilesCount} ficheiro(s) estruturado(s)
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
