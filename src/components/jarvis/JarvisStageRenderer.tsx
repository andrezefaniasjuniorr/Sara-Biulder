import React, { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  X,
  Download,
  Columns2,
  Maximize2,
  ZoomIn,
  Play,
  Pause,
  SkipForward,
  Music2,
  Video,
  FileText,
  Sparkles,
  Calculator,
  BarChart3,
  Globe,
  MessageSquarePlus,
  ExternalLink,
  AlertCircle,
  Volume2,
  VolumeX,
  BookOpen,
  Copy,
  Check,
  Printer,
  RotateCcw,
  HelpCircle,
  Layers,
} from 'lucide-react';
import type { JarvisStageContent, JarvisTrack } from '../../types/jarvis';
import { speakPronunciation, startVoiceReading } from '../../utils/voiceService';

interface JarvisStageRendererProps {
  content: JarvisStageContent;
  layoutMode: 'split' | 'focus';
  onChangeLayoutMode: (mode: 'split' | 'focus') => void;
  onClose: () => void;
  onNextTrack?: () => void;
  onAskAboutDocument?: (docTitle: string) => void;
  playlist?: JarvisTrack[];
  mediaPaused?: boolean;
  mediaVolume?: number;
  onToggleMediaPause?: () => void;
  onChangeMediaVolume?: (volume: number) => void;
}

function sanitizeSvgMarkup(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '');
}

function cleanLatexInput(raw: string): string {
  let s = String(raw || '').trim();
  if (s.startsWith('$$') && s.endsWith('$$')) {
    s = s.slice(2, -2).trim();
  } else if (s.startsWith('$') && s.endsWith('$')) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

const KatexBlock: React.FC<{
  math: string;
  displayMode?: boolean;
  className?: string;
}> = ({ math, displayMode = false, className = '' }) => {
  const html = useMemo(() => {
    const cleaned = cleanLatexInput(math);
    if (!cleaned) return '';
    try {
      return katex.renderToString(cleaned, {
        displayMode,
        throwOnError: false,
        strict: false,
        output: 'html',
      });
    } catch {
      return '';
    }
  }, [math, displayMode]);

  if (!html) {
    return <span className={`font-mono text-cyan-200 ${className}`}>{math}</span>;
  }

  return (
    <div
      className={`overflow-x-auto sara-scroll text-cyan-100 [&_.katex]:text-inherit ${
        displayMode ? 'py-1' : 'inline-block align-middle'
      } ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

const ChartCanvasView: React.FC<{
  content: Extract<JarvisStageContent, { kind: 'chart' }>;
}> = ({ content }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    const ensureChartAndRender = async () => {
      if (typeof window === 'undefined') return;
      if (!(window as any).Chart) {
        await new Promise<void>((resolve) => {
          const existing = document.querySelector('script[data-jarvis-chartjs]');
          if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            return;
          }
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
          s.setAttribute('data-jarvis-chartjs', '1');
          s.onload = () => resolve();
          s.onerror = () => resolve();
          document.head.appendChild(s);
        });
      }
      if (!active || !canvasRef.current || !(window as any).Chart) return;
      chartInstanceRef.current?.destroy?.();

      const ChartCtor = (window as any).Chart;
      const palette = ['#00E5FF', '#FF2A4B', '#3B82F6', '#10B981', '#F59E0B', '#A855F7'];
      chartInstanceRef.current = new ChartCtor(canvasRef.current, {
        type: content.chartType || 'bar',
        data: {
          labels: content.labels || [],
          datasets: (content.datasets || []).map((ds, idx) => ({
            label: ds.label,
            data: ds.data,
            borderColor: ds.color || palette[idx % palette.length],
            backgroundColor:
              content.chartType === 'doughnut'
                ? palette
                : `${ds.color || palette[idx % palette.length]}55`,
            borderWidth: 2,
            tension: 0.35,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#E2E8F0', font: { size: 12 } } },
          },
          scales:
            content.chartType === 'doughnut' || content.chartType === 'radar'
              ? undefined
              : {
                  x: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(148,163,184,0.12)' } },
                  y: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(148,163,184,0.12)' } },
                },
        },
      });
    };

    ensureChartAndRender();
    return () => {
      active = false;
      chartInstanceRef.current?.destroy?.();
    };
  }, [content]);

  return (
    <div className="flex flex-col h-full gap-3">
      {content.subtitle && <p className="text-xs text-cyan-200/80">{content.subtitle}</p>}
      <div className="relative flex-1 min-h-[240px] rounded-xl bg-[#040812]/90 border border-cyan-500/25 p-3">
        <canvas ref={canvasRef} />
      </div>
      {content.summary && (
        <p className="text-xs text-slate-300 bg-cyan-950/30 border border-cyan-500/20 rounded-xl p-3">
          {content.summary}
        </p>
      )}
    </div>
  );
};

const QuizStageView: React.FC<{
  content: Extract<JarvisStageContent, { kind: 'quiz' }>;
}> = ({ content }) => {
  const [answers, setAnswers] = useState<Record<number, number>>({});

  useEffect(() => {
    setAnswers({});
  }, [content.id]);

  const questions = Array.isArray(content.questions) ? content.questions : [];
  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.reduce(
    (acc, q, idx) => (answers[idx] === q.correctIndex ? acc + 1 : acc),
    0
  );

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#071124] border border-cyan-500/25">
        <div>
          {content.subtitle && <p className="text-xs text-cyan-200/85">{content.subtitle}</p>}
          <p className="text-[11px] font-mono text-slate-300 mt-0.5">
            Respondidas: {answeredCount}/{questions.length} • Acertos:{' '}
            <span className="text-emerald-300 font-bold">{correctCount}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAnswers({})}
          className="px-2.5 py-1.5 rounded-lg bg-[#0A1830] border border-cyan-500/35 text-cyan-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-cyan-500/20 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refazer Teste</span>
        </button>
      </div>

      {questions.map((q, qIdx) => {
        const chosen = answers[qIdx];
        const hasAnswered = typeof chosen === 'number';
        const isCorrect = chosen === q.correctIndex;

        return (
          <div
            key={qIdx}
            className="p-3.5 rounded-xl bg-[#061022] border border-cyan-500/25 space-y-2.5"
          >
            <div className="text-xs sm:text-sm font-bold text-white leading-snug">
              <span className="text-cyan-300 mr-1.5">{qIdx + 1}.</span>
              {q.question}
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {(q.options || []).map((opt, optIdx) => {
                const isSelected = chosen === optIdx;
                const isRightOption = optIdx === q.correctIndex;
                let btnStyle =
                  'bg-[#040916] border-cyan-500/20 text-slate-200 hover:border-cyan-400/60';
                if (hasAnswered) {
                  if (isRightOption) {
                    btnStyle = 'bg-emerald-500/20 border-emerald-400 text-emerald-100';
                  } else if (isSelected) {
                    btnStyle = 'bg-rose-500/20 border-rose-400 text-rose-100';
                  } else {
                    btnStyle = 'bg-[#040916]/60 border-slate-800 text-slate-400';
                  }
                }

                return (
                  <button
                    key={optIdx}
                    type="button"
                    disabled={hasAnswered}
                    onClick={() => setAnswers((prev) => ({ ...prev, [qIdx]: optIdx }))}
                    className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition flex items-center gap-2 ${
                      hasAnswered ? 'cursor-default' : 'cursor-pointer'
                    } ${btnStyle}`}
                  >
                    <span className="font-mono font-bold text-[11px] opacity-80">
                      {String.fromCharCode(65 + optIdx)})
                    </span>
                    <span className="flex-1">{opt}</span>
                  </button>
                );
              })}
            </div>

            {hasAnswered && (
              <div
                className={`p-2.5 rounded-xl border text-xs leading-relaxed ${
                  isCorrect
                    ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-100'
                    : 'bg-rose-950/35 border-rose-500/40 text-rose-100'
                }`}
              >
                <div className="font-bold mb-0.5">
                  {isCorrect
                    ? 'Correto!'
                    : `Errado — a opção certa era ${String.fromCharCode(65 + q.correctIndex)}.`}
                </div>
                <p className="text-slate-200">{q.explanation}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const FlashcardsStageView: React.FC<{
  content: Extract<JarvisStageContent, { kind: 'flashcards' }>;
}> = ({ content }) => {
  const cards = Array.isArray(content.cards) ? content.cards : [];
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mastered, setMastered] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
    setMastered({});
  }, [content.id]);

  if (cards.length === 0) {
    return (
      <p className="text-xs text-slate-400 text-center py-6">
        Nenhum flashcard disponível neste conjunto.
      </p>
    );
  }

  const safeIdx = Math.min(index, cards.length - 1);
  const current = cards[safeIdx];
  const masteredCount = Object.values(mastered).filter(Boolean).length;

  return (
    <div className="flex flex-col h-full justify-between gap-3">
      <div className="flex items-center justify-between text-xs text-cyan-200/85">
        <span>{content.subtitle || 'Clica no cartão para virar'}</span>
        <span className="font-mono text-[11px] text-emerald-300">
          Dominados: {masteredCount}/{cards.length}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="flex-1 min-h-[210px] p-6 rounded-2xl bg-gradient-to-br from-[#07152E] via-[#050C1C] to-[#120818] border border-cyan-400/45 shadow-[0_0_28px_rgba(0,229,255,0.14)] flex flex-col items-center justify-center text-center gap-3 cursor-pointer hover:border-cyan-300 transition"
      >
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-rose-300">
          {flipped ? 'Verso / Resposta' : 'Frente / Pergunta'} • Cartão {safeIdx + 1} de {cards.length}
        </span>
        <div className="text-base sm:text-xl font-bold text-white max-w-lg leading-relaxed">
          {flipped ? current.back : current.front}
        </div>
        {!flipped && current.hint && (
          <div className="text-xs text-cyan-300/80 italic">Dica: {current.hint}</div>
        )}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setFlipped(false);
              setIndex((i) => (i - 1 + cards.length) % cards.length);
            }}
            className="px-3 py-1.5 rounded-xl bg-[#071124] border border-cyan-500/30 text-xs text-cyan-200 hover:bg-cyan-500/15 cursor-pointer"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => {
              setFlipped(false);
              setIndex((i) => (i + 1) % cards.length);
            }}
            className="px-3 py-1.5 rounded-xl bg-[#071124] border border-cyan-500/30 text-xs text-cyan-200 hover:bg-cyan-500/15 cursor-pointer"
          >
            Próximo
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              speakPronunciation(
                flipped ? current.back : current.front,
                current.lang || (flipped ? 'en-US' : 'pt-PT')
              )
            }
            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-cyan-500/30 cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Ouvir Pronúncia</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setMastered((prev) => ({ ...prev, [safeIdx]: !prev[safeIdx] }))
            }
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
              mastered[safeIdx]
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
                : 'bg-[#071124] border-cyan-500/30 text-slate-300 hover:text-white'
            }`}
          >
            {mastered[safeIdx] ? 'Dominado' : 'Já domino'}
          </button>
        </div>
      </div>
    </div>
  );
};

function parseDurationToSeconds(text?: string): number {
  if (!text) return 0;
  const parts = text
    .split(':')
    .map((p) => Number(p.trim()))
    .filter((n) => Number.isFinite(n));
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function formatSecondsMmSs(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

const YouTubeMediaPlayer: React.FC<{
  track: JarvisTrack;
  kind: 'music' | 'video';
  isPaused: boolean;
  volume: number;
  onTogglePause: () => void;
  onChangeVolume: (vol: number) => void;
  onNextTrack?: () => void;
}> = ({ track, kind, isPaused, volume, onTogglePause, onChangeVolume, onNextTrack }) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [thumbError, setThumbError] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  const watchUrl =
    track.watchUrl ||
    (track.videoId ? `https://www.youtube.com/watch?v=${track.videoId}` : undefined);

  // Mantém a URL estável por videoId para pausar/retomar sem reiniciar o vídeo do segundo 0
  const ytEmbedUrl = useMemo(() => {
    if (!track.videoId) return null;
    const originParam =
      typeof window !== 'undefined' && window.location?.origin
        ? `&origin=${encodeURIComponent(window.location.origin)}`
        : '';
    return `https://www.youtube.com/embed/${track.videoId}?autoplay=1&enablejsapi=1&playsinline=1&rel=0${originParam}`;
  }, [track.videoId]);

  useEffect(() => {
    setElapsedSec(0);
    setThumbError(false);
  }, [track.videoId]);

  // Contador visual simples enquanto está a tocar
  useEffect(() => {
    if (isPaused || !track.videoId) return;
    const t = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [isPaused, track.videoId]);

  const sendYtCommand = (func: string, args: unknown[] = []) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      );
    } catch {
      // ignore cross-origin postMessage restriction
    }
  };

  useEffect(() => {
    if (!track.videoId) return;
    sendYtCommand(isPaused ? 'pauseVideo' : 'playVideo');
  }, [isPaused, track.videoId]);

  useEffect(() => {
    if (!track.videoId) return;
    sendYtCommand('setVolume', [Math.max(0, Math.min(100, Math.round(volume)))]);
  }, [volume, track.videoId]);

  const totalSec = parseDurationToSeconds(track.durationText);
  const progressPct =
    totalSec > 0 ? Math.min(100, Math.round((elapsedSec / totalSec) * 100)) : isPaused ? 0 : 35;

  return (
    <div className="flex flex-col gap-3.5 h-full justify-between">
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#040915]/90 border border-cyan-500/30 rounded-2xl p-3.5">
        <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-[#FF2A4B]/50 bg-[#0A1326] shrink-0 flex items-center justify-center shadow-[0_0_25px_rgba(255,42,75,0.2)]">
          {track.thumbnailUrl && !thumbError ? (
            <img
              src={track.thumbnailUrl}
              alt={track.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={() => setThumbError(true)}
            />
          ) : kind === 'video' ? (
            <Video className="w-9 h-9 text-cyan-300" />
          ) : (
            <Music2 className="w-9 h-9 text-cyan-300" />
          )}
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left w-full">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-rose-400">
            {kind === 'video' ? 'YouTube Vídeo Real' : 'YouTube Música Real'}
            {track.durationText ? ` • ${track.durationText}` : ''}
            {isPaused ? ' • PAUSADO' : ' • A TOCAR'}
          </div>
          <h4 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">{track.title}</h4>
          <p className="text-xs text-cyan-300/80 truncate">{track.artist}</p>

          {/* Barra de tempo / progresso */}
          <div className="mt-2 space-y-1">
            <div className="h-1.5 rounded-full bg-[#091529] overflow-hidden border border-cyan-500/20">
              <div
                className="h-full bg-gradient-to-r from-[#00E5FF] to-[#FF2A4B] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>{formatSecondsMmSs(elapsedSec)}</span>
              <span>{track.durationText || '--:--'}</span>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-center sm:justify-start gap-2">
            {ytEmbedUrl && (
              <button
                type="button"
                onClick={onTogglePause}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-cyan-500/30 transition cursor-pointer"
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{isPaused ? 'Continuar' : 'Pausar'}</span>
              </button>
            )}
            {onNextTrack && kind === 'music' && (
              <button
                type="button"
                onClick={onNextTrack}
                className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center gap-1 hover:bg-rose-500/25 transition cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Próxima</span>
              </button>
            )}
            {ytEmbedUrl && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#09162D] border border-cyan-500/30 text-xs text-cyan-200">
                <button
                  type="button"
                  onClick={() => onChangeVolume(volume === 0 ? 80 : 0)}
                  className="hover:text-white cursor-pointer"
                  title="Silenciar / Reativar som"
                >
                  {volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-rose-300" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={volume}
                  onChange={(e) => onChangeVolume(Number(e.target.value))}
                  className="w-16 accent-[#00E5FF] cursor-pointer"
                  aria-label="Volume do player"
                />
                <span className="font-mono text-[10px] w-7 text-right">{volume}%</span>
              </div>
            )}
            {watchUrl && (
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-[#09162D] border border-cyan-500/35 text-cyan-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-cyan-500/20 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>YouTube</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {ytEmbedUrl ? (
        <div className="flex-1 min-h-[220px] rounded-2xl overflow-hidden border border-cyan-500/30 bg-black aspect-video">
          <iframe
            ref={iframeRef}
            key={track.videoId}
            src={ytEmbedUrl}
            title={track.title}
            className="w-full h-full"
            onLoad={() => {
              sendYtCommand('setVolume', [Math.max(0, Math.min(100, Math.round(volume)))]);
              if (isPaused) {
                sendYtCommand('pauseVideo');
              }
            }}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-rose-950/25 border border-rose-500/40 flex items-center gap-2.5 text-xs text-rose-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Não consegui obter o vídeo real no YouTube agora. Tenta novamente ou verifica a ligação.</span>
        </div>
      )}
    </div>
  );
};

export const JarvisStageRenderer: React.FC<JarvisStageRendererProps> = ({
  content,
  layoutMode,
  onChangeLayoutMode,
  onClose,
  onNextTrack,
  onAskAboutDocument,
  mediaPaused = false,
  mediaVolume = 80,
  onToggleMediaPause,
  onChangeMediaVolume,
}) => {
  const [svgZoom, setSvgZoom] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const htmlIframeRef = useRef<HTMLIFrameElement | null>(null);

  const copyCardText = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((curr) => (curr === idx ? null : curr)), 1600);
    } catch {
      // ignore clipboard restriction
    }
  };

  const buildReadableStageText = (): string => {
    if (content.kind === 'explanation') {
      const parts = [
        content.title,
        content.summary,
        ...content.sections.map((s) => `${s.heading}. ${s.body}`),
        content.exampleBody ? `${content.exampleTitle || 'Exemplo'}. ${content.exampleBody}` : '',
      ];
      return parts.filter(Boolean).join('. ');
    }
    if (content.kind === 'document') {
      const parts = [
        content.title,
        content.summary,
        ...content.keyPoints,
        content.rawText ? content.rawText.slice(0, 6000) : '',
      ];
      return parts.filter(Boolean).join('. ');
    }
    return '';
  };

  const downloadTextFile = (filename: string, text: string, mime: string) => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const renderIcon = () => {
    switch (content.kind) {
      case 'math':
        return <Calculator className="w-4 h-4 text-cyan-300" />;
      case 'chart':
        return <BarChart3 className="w-4 h-4 text-cyan-300" />;
      case 'document':
        return <FileText className="w-4 h-4 text-rose-300" />;
      case 'music':
        return <Music2 className="w-4 h-4 text-cyan-300" />;
      case 'video':
        return <Video className="w-4 h-4 text-rose-300" />;
      case 'html':
        return <Globe className="w-4 h-4 text-cyan-300" />;
      case 'explanation':
        return <BookOpen className="w-4 h-4 text-cyan-300" />;
      case 'quiz':
        return <HelpCircle className="w-4 h-4 text-emerald-300" />;
      case 'flashcards':
        return <Layers className="w-4 h-4 text-cyan-300" />;
      default:
        return <Sparkles className="w-4 h-4 text-cyan-300" />;
    }
  };

  const hasSvgCalculations =
    content.kind === 'svg' &&
    Boolean(
      (content.formulas && content.formulas.length > 0) ||
        (content.steps && content.steps.length > 0) ||
        content.finalAnswer
    );

  return (
    <div className="flex flex-col h-full min-h-0 rounded-2xl bg-[#050B18]/92 border border-cyan-400/40 shadow-[0_0_32px_rgba(0,229,255,0.16)] backdrop-blur-md overflow-hidden">
      {/* Barra do Palco */}
      <div className="px-3.5 py-2.5 border-b border-cyan-500/25 bg-[#071124]/90 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {renderIcon()}
          <h3 className="text-xs sm:text-sm font-bold text-white truncate">{content.title}</h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {(content.kind === 'explanation' || content.kind === 'document') && (
            <button
              type="button"
              onClick={() => startVoiceReading(content.title, buildReadableStageText())}
              className="px-2 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/45 text-[11px] text-cyan-200 hover:bg-cyan-500/25 transition flex items-center gap-1 cursor-pointer"
              title="Ler em voz alta em segundo plano"
            >
              <Volume2 className="w-3 h-3" />
              <span className="hidden sm:inline">Ler</span>
            </button>
          )}

          {content.kind === 'svg' && (
            <>
              <button
                type="button"
                onClick={() => setSvgZoom((z) => !z)}
                className="px-2 py-1 rounded-lg bg-[#0A162C] border border-cyan-500/30 text-[11px] text-cyan-200 hover:bg-cyan-500/15 transition flex items-center gap-1 cursor-pointer"
                title="Ampliar SVG"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => downloadTextFile(`${content.title || 'arte-sara'}.svg`, content.svgCode, 'image/svg+xml')}
                className="px-2 py-1 rounded-lg bg-[#0A162C] border border-cyan-500/30 text-[11px] text-cyan-200 hover:bg-cyan-500/15 transition flex items-center gap-1 cursor-pointer"
                title="Descarregar SVG"
              >
                <Download className="w-3 h-3" />
              </button>
            </>
          )}

          {content.kind === 'html' && (
            <>
              <button
                type="button"
                onClick={() => htmlIframeRef.current?.contentWindow?.print()}
                className="px-2 py-1 rounded-lg bg-[#0A162C] border border-cyan-500/30 text-[11px] text-cyan-200 hover:bg-cyan-500/15 transition flex items-center gap-1 cursor-pointer"
                title="Imprimir ou guardar como PDF"
              >
                <Printer className="w-3 h-3" />
                <span className="hidden sm:inline">PDF</span>
              </button>
              <button
                type="button"
                onClick={() => downloadTextFile(`${content.title || 'visual-sara'}.html`, content.html, 'text/html')}
                className="px-2 py-1 rounded-lg bg-[#0A162C] border border-cyan-500/30 text-[11px] text-cyan-200 hover:bg-cyan-500/15 transition flex items-center gap-1 cursor-pointer"
                title="Descarregar HTML"
              >
                <Download className="w-3 h-3" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => onChangeLayoutMode(layoutMode === 'split' ? 'focus' : 'split')}
            className="px-2 py-1 rounded-lg bg-[#0A162C] border border-cyan-500/30 text-[11px] text-cyan-200 hover:bg-cyan-500/15 transition flex items-center gap-1 cursor-pointer"
            title={layoutMode === 'split' ? 'Cabeça no canto / Palco máximo' : 'Dividir ecrã com a Sara'}
          >
            {layoutMode === 'split' ? <Maximize2 className="w-3 h-3" /> : <Columns2 className="w-3 h-3" />}
            <span className="hidden sm:inline">{layoutMode === 'split' ? 'Expandir' : 'Dividir'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-200 hover:bg-rose-500/30 transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
            title="Fechar visualização e voltar à Sara em destaque"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
        </div>
      </div>

      {/* Corpo dinâmico */}
      <div className="flex-1 min-h-0 overflow-y-auto sara-scroll p-3.5">
        {content.kind === 'svg' && (
          <div className="flex flex-col gap-3 h-full">
            {content.subtitle && <p className="text-xs text-cyan-200/80">{content.subtitle}</p>}

            <div
              className={
                hasSvgCalculations
                  ? 'grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-3 items-stretch flex-1 min-h-0'
                  : 'flex flex-col gap-3 flex-1 min-h-0'
              }
            >
              <div
                className={`min-h-[240px] rounded-xl bg-[#040914] border border-cyan-500/25 flex items-center justify-center p-4 overflow-auto transition [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:h-auto ${
                  svgZoom ? 'scale-105' : ''
                }`}
                dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(content.svgCode) }}
              />

              {hasSvgCalculations && (
                <div className="space-y-2.5 overflow-y-auto sara-scroll pr-1">
                  {content.formulas && content.formulas.length > 0 && (
                    <div className="p-3 rounded-xl bg-[#071124] border border-cyan-500/25 space-y-2">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">
                        Fórmulas
                      </div>
                      <div className="space-y-1.5">
                        {content.formulas.map((f, i) => (
                          <div
                            key={i}
                            className="px-2.5 py-1.5 rounded-lg bg-[#030815] border border-cyan-500/20"
                          >
                            <KatexBlock math={f} displayMode />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {content.steps && content.steps.length > 0 && (
                    <div className="space-y-2">
                      {content.steps.map((st, idx) => (
                        <div
                          key={`${st.step}_${idx}`}
                          className="p-2.5 rounded-xl bg-[#060F20] border border-cyan-500/20 space-y-1"
                        >
                          <div className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">
                            {st.step || `Passo ${idx + 1}`}
                          </div>
                          {st.expression && (
                            <div className="px-2.5 py-1 rounded-lg bg-[#030711] border border-cyan-500/25">
                              <KatexBlock math={st.expression} displayMode />
                            </div>
                          )}
                          {st.explanation && (
                            <p className="text-xs text-slate-300 leading-relaxed">{st.explanation}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {content.finalAnswer && (
                    <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-rose-500/15 border border-cyan-400/50">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">
                        Resultado Final
                      </div>
                      <div className="mt-1 text-white font-bold">
                        <KatexBlock math={content.finalAnswer} displayMode />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {content.description && (
              <p className="text-xs text-slate-300 leading-relaxed">{content.description}</p>
            )}
          </div>
        )}

        {content.kind === 'math' && (
          <div className="space-y-3">
            {content.problem && (
              <div className="p-3 rounded-xl bg-[#091428] border border-cyan-400/35">
                <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1">
                  Enunciado
                </div>
                <div className="text-sm font-semibold text-white">{content.problem}</div>
              </div>
            )}

            {content.svgCode && (
              <div
                className="min-h-[180px] rounded-xl bg-[#040914] border border-cyan-500/25 flex items-center justify-center p-3 [&>svg]:max-w-full [&>svg]:max-h-[220px]"
                dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(content.svgCode) }}
              />
            )}

            {content.formulas && content.formulas.length > 0 && (
              <div className="p-3 rounded-xl bg-[#071124] border border-cyan-500/25 space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">
                  Fórmulas Aplicadas
                </div>
                {content.formulas.map((f, i) => (
                  <div
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-[#030815] border border-cyan-500/20"
                  >
                    <KatexBlock math={f} displayMode />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {content.steps.map((st, idx) => (
                <div
                  key={`${st.step}_${idx}`}
                  className="p-3 rounded-xl bg-[#060F20] border border-cyan-500/20 flex flex-col gap-1.5"
                >
                  <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider">
                    {st.step || `Passo ${idx + 1}`}
                  </span>
                  {st.expression && (
                    <div className="px-3 py-1.5 rounded-lg bg-[#030711] border border-cyan-500/30">
                      <KatexBlock math={st.expression} displayMode />
                    </div>
                  )}
                  <p className="text-xs text-slate-300 leading-relaxed">{st.explanation}</p>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-rose-500/15 border border-cyan-400/50">
              <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">
                Resultado Final
              </div>
              <div className="mt-1 text-base font-extrabold text-white">
                <KatexBlock math={content.finalAnswer} displayMode />
              </div>
              {content.notes && <p className="text-xs text-slate-300 mt-1.5">{content.notes}</p>}
            </div>
          </div>
        )}

        {content.kind === 'explanation' && (
          <div className="space-y-3.5">
            {content.summary && (
              <div className="p-3.5 rounded-xl bg-[#08152C] border border-cyan-400/35">
                <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1">
                  Síntese Visual
                </div>
                <p className="text-xs sm:text-sm text-slate-100 leading-relaxed">{content.summary}</p>
              </div>
            )}

            {content.visualSvg && (
              <div
                className="min-h-[200px] rounded-xl bg-[#040914] border border-cyan-500/25 flex items-center justify-center p-4 [&>svg]:max-w-full [&>svg]:max-h-[250px]"
                dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(content.visualSvg) }}
              />
            )}

            {content.formula && (
              <div className="p-3 rounded-xl bg-[#061124] border border-cyan-400/30">
                <div className="text-[10px] font-mono uppercase tracking-widest text-rose-300 mb-1">
                  Fórmula Principal
                </div>
                <KatexBlock math={content.formula} displayMode />
              </div>
            )}

            {content.sections.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {content.sections.map((sec, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#071124] border border-cyan-500/25 space-y-1"
                  >
                    <div className="text-xs font-bold text-cyan-300">{sec.heading}</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{sec.body}</p>
                  </div>
                ))}
              </div>
            )}

            {content.exampleBody && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-500/15 to-[#FF2A4B]/15 border border-cyan-400/40 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-widest text-rose-300">
                  {content.exampleTitle || 'Exemplo Prático'}
                </div>
                <p className="text-xs text-slate-100 leading-relaxed">{content.exampleBody}</p>
              </div>
            )}
          </div>
        )}

        {content.kind === 'chart' && <ChartCanvasView content={content} />}

        {content.kind === 'document' && (
          <div className="space-y-3">
            {content.previewUrl && content.mimeType.startsWith('image/') && (
              <div className="rounded-xl overflow-hidden border border-cyan-500/30 bg-[#040914] max-h-[220px] flex items-center justify-center">
                <img
                  src={content.previewUrl}
                  alt={content.title}
                  className="max-h-[220px] object-contain"
                />
              </div>
            )}
            {content.previewUrl && content.mimeType === 'application/pdf' && (
              <div className="rounded-xl overflow-hidden border border-cyan-500/30 bg-[#040914] h-[220px]">
                <iframe src={content.previewUrl} title={content.title} className="w-full h-full" />
              </div>
            )}

            <div className="p-3 rounded-xl bg-[#071124] border border-cyan-500/25">
              <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1">
                Resumo Executivo
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{content.summary}</p>
            </div>

            {content.keyPoints.length > 0 && (
              <div className="p-3 rounded-xl bg-[#071124] border border-cyan-500/20">
                <div className="text-[10px] font-mono uppercase tracking-widest text-rose-300 mb-1.5">
                  Pontos Principais
                </div>
                <ul className="space-y-1">
                  {content.keyPoints.map((pt, i) => (
                    <li key={i} className="text-xs text-slate-200 flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {content.extractedData.length > 0 && (
              <div className="rounded-xl overflow-hidden border border-cyan-500/20">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#09162D] text-cyan-300 font-mono text-[10px] uppercase">
                    <tr>
                      <th className="px-3 py-2">Campo</th>
                      <th className="px-3 py-2">Valor Extraído</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-500/15 bg-[#050C1A]">
                    {content.extractedData.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-slate-400 font-medium">{row.label}</td>
                        <td className="px-3 py-2 text-white font-semibold">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {onAskAboutDocument && (
              <button
                type="button"
                onClick={() => onAskAboutDocument(content.title)}
                className="w-full py-2 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-cyan-500/25 transition cursor-pointer"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span>Perguntar sobre este documento</span>
              </button>
            )}
          </div>
        )}

        {content.kind === 'html' && (
          <div className="h-full min-h-[300px] rounded-xl overflow-hidden border border-cyan-500/30 bg-white">
            <iframe
              ref={htmlIframeRef}
              srcDoc={content.html}
              title={content.title}
              sandbox="allow-scripts allow-same-origin allow-modals"
              className="w-full h-full min-h-[300px]"
            />
          </div>
        )}

        {(content.kind === 'music' || content.kind === 'video') && (
          <YouTubeMediaPlayer
            track={content.track}
            kind={content.kind}
            isPaused={mediaPaused}
            volume={mediaVolume}
            onTogglePause={() => onToggleMediaPause?.()}
            onChangeVolume={(v) => onChangeMediaVolume?.(v)}
            onNextTrack={onNextTrack}
          />
        )}

        {content.kind === 'ideation' && (
          <div className="space-y-3">
            {content.subtitle && <p className="text-xs text-cyan-200/80">{content.subtitle}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {content.cards.map((card, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-[#071124] border border-cyan-500/25 hover:border-rose-400/50 transition flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-rose-300 mb-1">
                      {card.tag}
                    </div>
                    <h4 className="text-sm font-bold text-white mb-1">{card.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {card.detail}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-cyan-500/15">
                    {card.audioText && (
                      <button
                        type="button"
                        onClick={() =>
                          speakPronunciation(card.audioText || card.detail, card.audioLang || 'en-US')
                        }
                        className="px-2 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 text-[11px] font-semibold flex items-center gap-1 hover:bg-cyan-500/25 cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>Ouvir</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void copyCardText(card.detail, i)}
                      className="px-2 py-1 rounded-lg bg-[#0A1830] border border-cyan-500/30 text-cyan-200 text-[11px] font-semibold flex items-center gap-1 hover:bg-cyan-500/20 cursor-pointer"
                    >
                      {copiedIdx === i ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-300">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {content.kind === 'quiz' && <QuizStageView content={content} />}

        {content.kind === 'flashcards' && <FlashcardsStageView content={content} />}
      </div>
    </div>
  );
};
