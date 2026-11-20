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
} from 'lucide-react';
import type { PreviewDevice, ProjectFiles } from '../types/builder';
import { buildPreviewSrcDoc } from '../utils/previewBuilder';

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
}) => {
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const isFullscreen =
    controlledFullscreen !== undefined ? controlledFullscreen : internalFullscreen;
  const toggleFullscreen = onToggleFullscreen || (() => setInternalFullscreen((v) => !v));
  const [debouncedFiles, setDebouncedFiles] = useState<ProjectFiles>(files);

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
          : 'h-full border-r border-[#1F1F2E]'
      }`}
    >
      {/* Barra de Ferramentas do Preview */}
      <div className="px-3 py-2.5 bg-[#12121A] border-b border-[#1F1F2E] flex items-center justify-between gap-2 overflow-x-auto sara-scroll shrink-0">
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
            onClick={onDownloadZip}
            className="px-2.5 py-1.5 rounded-lg bg-[#0A0A0F] border border-[#1F1F2E] text-white hover:border-[#3B82F6]/50 text-xs font-medium flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
            title="Baixar projeto em ZIP"
          >
            <Download className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span className="hidden sm:inline">Baixar ZIP</span>
          </button>

          <button
            type="button"
            onClick={onPushGitHub}
            className="px-2.5 py-1.5 rounded-lg bg-[#0A0A0F] border border-[#1F1F2E] text-white hover:border-[#8B5CF6]/50 text-xs font-medium flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
            title="Enviar código para o GitHub"
          >
            <Github className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Push GitHub</span>
          </button>

          <button
            type="button"
            onClick={onPublish}
            className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
            title="Publicar na Web / Cloudflare"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Publicar</span>
          </button>
        </div>
      </div>

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

        {/* Overlay ao vivo durante construção */}
        {isBuilding && (
          <div className="absolute inset-0 bg-[#07070B]/80 backdrop-blur-sm flex items-center justify-center p-4 z-20">
            <div className="max-w-sm w-full rounded-2xl bg-[#090D16] border border-cyan-500/40 p-5 shadow-[0_0_30px_rgba(6,182,212,0.18)] space-y-3 text-center">
              <div className="w-11 h-11 mx-auto rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-cyan-300 font-bold">
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
