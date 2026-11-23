import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Heart,
  Maximize2,
  Minimize2,
  Music2,
  Video,
  Image as ImageIcon,
  FileText,
  FolderOpen,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
  Clock,
  Star,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { JarvisStageContent, JarvisTrack, LocalDeviceFile } from '../../types/jarvis';
import { formatFileSize } from '../../services/localMediaService';

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export interface LocalSeekSignal {
  id: number;
  deltaSeconds: number;
}

export interface LocalFullscreenSignal {
  id: number;
  enabled: boolean;
}

interface LocalPlayerProps {
  track: JarvisTrack;
  kind: 'music' | 'video';
  isPaused: boolean;
  volume: number;
  isMuted?: boolean;
  isShuffled?: boolean;
  isLooped?: boolean;
  isLiked?: boolean;
  localQueue: LocalDeviceFile[];
  seekSignal?: LocalSeekSignal | null;
  fullscreenSignal?: LocalFullscreenSignal | null;
  onTogglePause: () => void;
  onChangeVolume: (vol: number) => void;
  onToggleMute?: () => void;
  onNextTrack?: () => void;
  onPrevTrack?: () => void;
  onToggleShuffle?: () => void;
  onToggleLoop?: () => void;
  onToggleLike?: () => void;
  onSelectLocalFile?: (file: LocalDeviceFile) => void;
  onNotifyError?: (msg: string) => void;
}

export const LocalJarvisMediaPlayer: React.FC<LocalPlayerProps> = ({
  track,
  kind,
  isPaused,
  volume,
  isMuted = false,
  isShuffled = false,
  isLooped = false,
  isLiked = false,
  localQueue,
  seekSignal,
  fullscreenSignal,
  onTogglePause,
  onChangeVolume,
  onToggleMute,
  onNextTrack,
  onPrevTrack,
  onToggleShuffle,
  onToggleLoop,
  onToggleLike,
  onSelectLocalFile,
  onNotifyError,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mediaError, setMediaError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isVideo = kind === 'video' || track.kind === 'video';

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setMediaError(false);
  }, [track.id, track.localUrl]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (isPaused) {
      el.pause();
    } else {
      el.play().catch(() => {
        // Autoplay policy if triggered without gesture
      });
    }
  }, [isPaused, track.localUrl]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    el.muted = Boolean(isMuted) || volume === 0;
    el.volume = Math.max(0, Math.min(1, volume / 100));
  }, [volume, isMuted]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    el.loop = Boolean(isLooped);
  }, [isLooped]);

  useEffect(() => {
    if (!seekSignal || !mediaRef.current) return;
    const el = mediaRef.current;
    const nextTime = Math.max(0, Math.min(el.duration || Infinity, el.currentTime + seekSignal.deltaSeconds));
    el.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, [seekSignal]);

  const applyFullscreenState = async (enable: boolean) => {
    setIsFullscreen(enable);
    try {
      if (enable) {
        if (containerRef.current && !document.fullscreenElement) {
          await containerRef.current.requestFullscreen?.();
        }
      } else if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      }
    } catch {
      // Fallback CSS fullscreen overlay still applies cleanly via isFullscreen
    }
  };

  useEffect(() => {
    if (!fullscreenSignal) return;
    void applyFullscreenState(fullscreenSignal.enabled);
  }, [fullscreenSignal]);

  const seekBy = (delta: number) => {
    const el = mediaRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(el.duration || Infinity, el.currentTime + delta));
    el.currentTime = next;
    setCurrentTime(next);
  };

  const progressPct = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;

  return (
    <div
      ref={containerRef}
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-[120] bg-[#030815] p-4 sm:p-6 flex flex-col justify-between'
          : 'flex flex-col gap-3 h-full'
      }`}
    >
      <div
        className={`flex-1 min-h-0 grid gap-3 ${
          localQueue.length > 0 && !isFullscreen
            ? 'grid-cols-1 lg:grid-cols-[1fr_240px]'
            : 'grid-cols-1'
        }`}
      >
        {/* Leitor Principal */}
        <div className="rounded-2xl bg-[#040915]/95 border border-cyan-500/35 p-3.5 sm:p-4 flex flex-col justify-between gap-3 min-h-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {isVideo ? 'Leitor Local Vídeo' : 'Leitor Local Áudio'}
                  {track.extension ? ` • .${track.extension.toUpperCase()}` : ''}
                  {track.sizeBytes ? ` • ${formatFileSize(track.sizeBytes)}` : ''}
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                {track.title}
              </h4>
              <p className="text-xs text-cyan-300/80 truncate">{track.artist}</p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onToggleLike && (
                <button
                  type="button"
                  onClick={onToggleLike}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    isLiked
                      ? 'bg-rose-500/25 border-rose-400 text-rose-300'
                      : 'bg-[#091529] border-cyan-500/30 text-slate-300 hover:text-rose-300'
                  }`}
                  title="Guardar nos favoritos"
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                </button>
              )}
              <button
                type="button"
                onClick={() => void applyFullscreenState(!isFullscreen)}
                className="p-2 rounded-xl bg-[#091529] border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/20 transition cursor-pointer"
                title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Palco Áudio ou Vídeo */}
          {mediaError ? (
            <div className="p-4 rounded-xl bg-rose-950/35 border border-rose-500/45 flex flex-col gap-2 text-xs text-rose-200">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Não foi possível abrir este ficheiro.</span>
              </div>
              {track.localUrl && (
                <a
                  href={track.localUrl}
                  download={track.title}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-100 w-fit"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir com leitor do dispositivo</span>
                </a>
              )}
            </div>
          ) : isVideo ? (
            <div className="relative flex-1 min-h-[210px] rounded-xl overflow-hidden bg-black border border-cyan-500/30 flex items-center justify-center">
              <video
                ref={(el) => {
                  mediaRef.current = el;
                }}
                key={track.localUrl}
                src={track.localUrl}
                autoPlay={!isPaused}
                playsInline
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                  setDuration(e.currentTarget.duration || 0);
                  e.currentTarget.volume = Math.max(0, Math.min(1, volume / 100));
                  e.currentTarget.muted = Boolean(isMuted) || volume === 0;
                }}
                onEnded={() => {
                  if (!isLooped) onNextTrack?.();
                }}
                onError={() => {
                  setMediaError(true);
                  onNotifyError?.('Não foi possível abrir este ficheiro.');
                }}
                className="w-full h-full max-h-[380px] object-contain"
              >
                {track.subtitleUrl && (
                  <track
                    kind="subtitles"
                    src={track.subtitleUrl}
                    srcLang="pt"
                    label="Legenda Local"
                    default
                  />
                )}
              </video>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4 py-3 px-4 rounded-xl bg-[#071124] border border-cyan-500/25">
              <div
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-cyan-400/60 bg-gradient-to-br from-[#0B1C38] via-[#061022] to-[#260917] flex items-center justify-center shadow-[0_0_28px_rgba(0,229,255,0.22)] shrink-0 ${
                  isPaused ? '' : 'animate-[spin_8s_linear_infinite]'
                }`}
              >
                <Music2 className="w-9 h-9 text-cyan-300" />
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <div className="text-xs text-cyan-200/90 font-mono">
                  {isPaused ? 'PAUSADO' : 'REPRODUÇÃO OFFLINE LOCAL ATIVA'}
                </div>
                <div className="text-sm font-bold text-white truncate mt-0.5">{track.title}</div>
                <div className="text-[11px] text-slate-400 truncate">
                  {track.folderPath || 'Armazenamento do dispositivo'}
                </div>
              </div>
              <audio
                ref={(el) => {
                  mediaRef.current = el;
                }}
                key={track.localUrl}
                src={track.localUrl}
                autoPlay={!isPaused}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                  setDuration(e.currentTarget.duration || 0);
                  e.currentTarget.volume = Math.max(0, Math.min(1, volume / 100));
                  e.currentTarget.muted = Boolean(isMuted) || volume === 0;
                }}
                onEnded={() => {
                  if (!isLooped) onNextTrack?.();
                }}
                onError={() => {
                  setMediaError(true);
                  onNotifyError?.('Não foi possível abrir este ficheiro.');
                }}
                className="hidden"
              />
            </div>
          )}

          {/* Barra de Progresso Interativa */}
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              step={1}
              value={duration > 0 ? currentTime : 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (mediaRef.current) mediaRef.current.currentTime = v;
                setCurrentTime(v);
              }}
              className="w-full accent-[#00E5FF] cursor-pointer"
              aria-label="Progresso da reprodução local"
            />
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
              <span>{formatTime(currentTime)}</span>
              <span>{progressPct}%</span>
              <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
            </div>
          </div>

          {/* Controlos Grandes Otimizados para Toque (Celular) & Desktop */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {onPrevTrack && (
                <button
                  type="button"
                  onClick={onPrevTrack}
                  className="px-2.5 py-2 sm:py-1.5 rounded-xl bg-[#09162D] border border-cyan-500/35 text-cyan-200 text-xs font-semibold flex items-center gap-1 hover:bg-cyan-500/20 cursor-pointer"
                  title="Anterior"
                >
                  <SkipBack className="w-4 h-4" />
                  <span className="hidden sm:inline">Anterior</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => seekBy(-10)}
                className="px-2.5 py-2 sm:py-1.5 rounded-xl bg-[#09162D] border border-cyan-500/35 text-cyan-200 text-xs font-semibold flex items-center gap-1 hover:bg-cyan-500/20 cursor-pointer"
                title="Voltar 10 segundos"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>-10s</span>
              </button>

              <button
                type="button"
                onClick={onTogglePause}
                className="px-4 py-2 sm:py-1.5 rounded-xl bg-cyan-500/25 border border-cyan-400 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-cyan-500/35 cursor-pointer"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                <span>{isPaused ? 'Tocar' : 'Pausar'}</span>
              </button>

              <button
                type="button"
                onClick={() => seekBy(isVideo ? 60 : 10)}
                className="px-2.5 py-2 sm:py-1.5 rounded-xl bg-[#09162D] border border-cyan-500/35 text-cyan-200 text-xs font-semibold flex items-center gap-1 hover:bg-cyan-500/20 cursor-pointer"
                title={isVideo ? 'Adiantar 1 minuto' : 'Adiantar 10 segundos'}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{isVideo ? '+1m' : '+10s'}</span>
              </button>

              {onNextTrack && (
                <button
                  type="button"
                  onClick={onNextTrack}
                  className="px-2.5 py-2 sm:py-1.5 rounded-xl bg-rose-500/15 border border-rose-400/50 text-rose-200 text-xs font-semibold flex items-center gap-1 hover:bg-rose-500/25 cursor-pointer"
                  title="Próxima"
                >
                  <span className="hidden sm:inline">Próxima</span>
                  <SkipForward className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {onToggleShuffle && (
                <button
                  type="button"
                  onClick={onToggleShuffle}
                  className={`p-2 rounded-xl border text-xs cursor-pointer ${
                    isShuffled
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                      : 'bg-[#09162D] border-cyan-500/25 text-slate-400'
                  }`}
                  title="Aleatório"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>
              )}
              {onToggleLoop && (
                <button
                  type="button"
                  onClick={onToggleLoop}
                  className={`p-2 rounded-xl border text-xs cursor-pointer ${
                    isLooped
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                      : 'bg-[#09162D] border-cyan-500/25 text-slate-400'
                  }`}
                  title="Repetir"
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>
              )}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#09162D] border border-cyan-500/30 text-xs text-cyan-200">
                <button
                  type="button"
                  onClick={() => (onToggleMute ? onToggleMute() : onChangeVolume(volume === 0 ? 80 : 0))}
                  className="hover:text-white cursor-pointer"
                  title="Silenciar / Reativar"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-300" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => onChangeVolume(Number(e.target.value))}
                  className="w-16 accent-[#00E5FF] cursor-pointer"
                  aria-label="Volume local"
                />
                <span className="font-mono text-[10px] w-7 text-right">{isMuted ? 0 : volume}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lista Lado-a-Lado no PC */}
        {localQueue.length > 0 && !isFullscreen && (
          <div className="rounded-2xl bg-[#040915]/90 border border-cyan-500/25 p-3 flex flex-col min-h-0 max-h-[340px] lg:max-h-full">
            <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-2">
              {isVideo ? 'Vídeos Locais' : 'Músicas Locais'} ({localQueue.length})
            </div>
            <div className="flex-1 overflow-y-auto sara-scroll space-y-1.5 pr-1">
              {localQueue.slice(0, 80).map((f) => {
                const active = f.id === track.localFileId;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onSelectLocalFile?.(f)}
                    className={`w-full text-left px-2.5 py-2 rounded-xl border text-xs transition cursor-pointer flex items-center gap-2 ${
                      active
                        ? 'bg-cyan-500/20 border-cyan-400 text-white'
                        : 'bg-[#071124] border-cyan-500/15 text-slate-300 hover:border-cyan-400/50'
                    }`}
                  >
                    {f.kind === 'video' ? (
                      <Video className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                    ) : (
                      <Music2 className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{f.name.replace(/\.[^.]+$/, '')}</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        .{f.extension} • {formatFileSize(f.size)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface LocalGalleryProps {
  content: Extract<JarvisStageContent, { kind: 'local_gallery' }>;
  fullscreenSignal?: LocalFullscreenSignal | null;
  favoritesSet: Set<string>;
  onToggleFavorite: (fileIdOrPath: string) => void;
}

export const LocalPhotoGalleryView: React.FC<LocalGalleryProps> = ({
  content,
  fullscreenSignal,
  favoritesSet,
  onToggleFavorite,
}) => {
  const [index, setIndex] = useState(content.activeIndex || 0);
  const [zoomed, setZoomed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIndex(content.activeIndex || 0);
    setZoomed(false);
  }, [content.id, content.activeIndex]);

  useEffect(() => {
    if (!fullscreenSignal) return;
    setIsFullscreen(fullscreenSignal.enabled);
  }, [fullscreenSignal]);

  const items = content.items || [];
  const activeItem = items[index] || items[0];

  if (!activeItem) {
    return (
      <div className="p-6 text-center text-xs text-slate-300">
        Nenhuma imagem encontrada nesta seleção.
      </div>
    );
  }

  const isFav = favoritesSet.has(activeItem.id) || favoritesSet.has(activeItem.relativePath);

  return (
    <div
      ref={rootRef}
      className={
        isFullscreen
          ? 'fixed inset-0 z-[120] bg-[#030815] p-4 flex flex-col gap-3'
          : 'flex flex-col gap-3 h-full'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#071124] border border-cyan-500/25">
        <div className="min-w-0">
          <div className="text-xs font-bold text-white truncate">{activeItem.name}</div>
          <div className="text-[10px] text-cyan-300/80 font-mono truncate">
            {index + 1}/{items.length} • {activeItem.folderPath} • {formatFileSize(activeItem.size)}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
            className="px-2.5 py-1.5 rounded-lg bg-[#0A1830] border border-cyan-500/35 text-cyan-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <SkipBack className="w-3.5 h-3.5" />
            <span>Anterior</span>
          </button>
          <button
            type="button"
            onClick={() => setZoomed((z) => !z)}
            className="px-2.5 py-1.5 rounded-lg bg-[#0A1830] border border-cyan-500/35 text-cyan-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            {zoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
            <span>{zoomed ? 'Normal' : 'Ampliar'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % items.length)}
            className="px-2.5 py-1.5 rounded-lg bg-[#0A1830] border border-cyan-500/35 text-cyan-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>Próxima</span>
            <SkipForward className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onToggleFavorite(activeItem.relativePath)}
            className={`p-1.5 rounded-lg border cursor-pointer ${
              isFav
                ? 'bg-rose-500/25 border-rose-400 text-rose-300'
                : 'bg-[#0A1830] border-cyan-500/30 text-slate-300'
            }`}
            title="Favorito"
          >
            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className="p-1.5 rounded-lg bg-[#0A1830] border border-cyan-500/35 text-cyan-200 cursor-pointer"
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-[240px] rounded-2xl bg-[#040914] border border-cyan-500/30 overflow-auto flex items-center justify-center p-2">
        <img
          src={activeItem.url}
          alt={activeItem.name}
          className={`rounded-xl object-contain transition-transform duration-200 ${
            zoomed ? 'scale-150 cursor-zoom-out' : 'max-h-[380px] w-auto cursor-zoom-in'
          }`}
          onClick={() => setZoomed((z) => !z)}
        />
      </div>

      {items.length > 1 && (
        <div className="flex gap-2 overflow-x-auto sara-scroll pb-1">
          {items.slice(0, 60).map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => {
                setIndex(i);
                setZoomed(false);
              }}
              className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer transition ${
                i === index ? 'border-cyan-400 scale-105' : 'border-cyan-500/20 opacity-75 hover:opacity-100'
              }`}
            >
              <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface LocalBrowserProps {
  content: Extract<JarvisStageContent, { kind: 'local_browser' }>;
  hasPermission: boolean;
  needsReconnect: boolean;
  isMobile: boolean;
  favoritesSet: Set<string>;
  onGrantPermission: (category?: 'all' | 'music' | 'video' | 'document' | 'image') => void;
  onReconnect: () => void;
  onOpenFile: (file: LocalDeviceFile) => void;
  onToggleFavorite: (file: LocalDeviceFile) => void;
  onFilterChange: (
    filter: 'all' | 'music' | 'video' | 'image' | 'document' | 'pdfs' | 'recents' | 'favorites'
  ) => void;
}

export const LocalLibraryBrowserView: React.FC<LocalBrowserProps> = ({
  content,
  hasPermission,
  needsReconnect,
  isMobile,
  favoritesSet,
  onGrantPermission,
  onReconnect,
  onOpenFile,
  onToggleFavorite,
  onFilterChange,
}) => {
  const [search, setSearch] = useState(content.query || '');

  useEffect(() => {
    setSearch(content.query || '');
  }, [content.id, content.query]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return content.items;
    return content.items.filter(
      (f) => f.name.toLowerCase().includes(q) || f.folderPath.toLowerCase().includes(q)
    );
  }, [content.items, search]);

  const filterChips: Array<{
    id: Extract<JarvisStageContent, { kind: 'local_browser' }>['filter'];
    label: string;
  }> = [
    { id: 'all', label: 'Todos' },
    { id: 'music', label: 'Músicas' },
    { id: 'video', label: 'Vídeos' },
    { id: 'image', label: 'Fotos' },
    { id: 'document', label: 'Docs' },
    { id: 'pdfs', label: 'PDFs' },
    { id: 'recents', label: 'Recentes' },
    { id: 'favorites', label: 'Favoritos' },
  ];

  const renderKindIcon = (f: LocalDeviceFile) => {
    if (f.kind === 'music' || f.kind === 'audio') return <Music2 className="w-4 h-4 text-cyan-300" />;
    if (f.kind === 'video') return <Video className="w-4 h-4 text-rose-300" />;
    if (f.kind === 'image') return <ImageIcon className="w-4 h-4 text-emerald-300" />;
    return <FileText className="w-4 h-4 text-amber-300" />;
  };

  return (
    <div className="space-y-3">
      {(!hasPermission || content.needsPermission) && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-[#061022] border border-cyan-400/50 space-y-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-cyan-300 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-white">
                {needsReconnect
                  ? 'Reativar acesso à pasta local autorizada'
                  : 'Permitir Acesso ao Armazenamento Local'}
              </h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Tudo fica 100% no teu dispositivo e funciona offline. Nunca enviamos os teus
                ficheiros para a nuvem.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {needsReconnect && (
              <button
                type="button"
                onClick={onReconnect}
                className="px-3.5 py-2 rounded-xl bg-emerald-500/25 border border-emerald-400 text-emerald-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-emerald-500/35"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Permitir Acesso ao Armazenamento</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onGrantPermission('all')}
              className="px-3.5 py-2 rounded-xl bg-cyan-500/25 border border-cyan-400 text-cyan-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-cyan-500/35"
            >
              <FolderOpen className="w-4 h-4" />
              <span>{isMobile ? 'Escolher Pastas / Ficheiros' : 'Escolher Pasta'}</span>
            </button>
            {isMobile && (
              <>
                <button
                  type="button"
                  onClick={() => onGrantPermission('music')}
                  className="px-3 py-2 rounded-xl bg-[#09162D] border border-cyan-500/35 text-cyan-200 text-xs font-semibold cursor-pointer"
                >
                  + Música
                </button>
                <button
                  type="button"
                  onClick={() => onGrantPermission('video')}
                  className="px-3 py-2 rounded-xl bg-[#09162D] border border-cyan-500/35 text-cyan-200 text-xs font-semibold cursor-pointer"
                >
                  + Vídeos
                </button>
                <button
                  type="button"
                  onClick={() => onGrantPermission('document')}
                  className="px-3 py-2 rounded-xl bg-[#09162D] border border-cyan-500/35 text-cyan-200 text-xs font-semibold cursor-pointer"
                >
                  + Documentos
                </button>
                <button
                  type="button"
                  onClick={() => onGrantPermission('image')}
                  className="px-3 py-2 rounded-xl bg-[#09162D] border border-cyan-500/35 text-cyan-200 text-xs font-semibold cursor-pointer"
                >
                  + Imagens
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {hasPermission && (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {filterChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => onFilterChange(chip.id)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition ${
                  content.filter === chip.id
                    ? 'bg-cyan-500/25 border-cyan-400 text-white'
                    : 'bg-[#071124] border-cyan-500/20 text-slate-300 hover:border-cyan-400/50'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar ficheiros locais por nome ou pasta..."
            className="w-full px-3 py-2 rounded-xl bg-[#030815] border border-cyan-500/30 text-xs text-white focus:outline-none focus:border-cyan-400"
          />

          {visibleItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 rounded-xl bg-[#071124] border border-cyan-500/20">
              Nenhum ficheiro local corresponde a este filtro.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {visibleItems.slice(0, 120).map((f) => {
                const isFav = favoritesSet.has(f.id) || favoritesSet.has(f.relativePath);
                return (
                  <div
                    key={f.id}
                    className="p-2.5 rounded-xl bg-[#071124] border border-cyan-500/25 hover:border-cyan-400/60 transition flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenFile(f)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#040915] border border-cyan-500/25 flex items-center justify-center shrink-0">
                        {renderKindIcon(f)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{f.name}</div>
                        <div className="text-[10px] text-slate-400 truncate flex items-center gap-1.5">
                          <span>.{f.extension}</span>
                          <span>•</span>
                          <span>{formatFileSize(f.size)}</span>
                          {f.lastOpenedAt && (
                            <>
                              <span>•</span>
                              <Clock className="w-2.5 h-2.5 inline text-cyan-300" />
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(f)}
                      className={`p-1.5 rounded-lg border cursor-pointer shrink-0 ${
                        isFav
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-[#040915] border-cyan-500/20 text-slate-500 hover:text-amber-300'
                      }`}
                      title="Favorito"
                    >
                      <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
