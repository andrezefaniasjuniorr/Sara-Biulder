import React, { useEffect, useMemo, useRef, useState } from 'react';
import 'katex/dist/katex.min.css';
import Chart from 'chart.js/auto';
import gsap from 'gsap';
import html2canvas from 'html2canvas';
import { motion } from 'framer-motion';
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
  Box,
  Camera,
  FolderOpen,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation,
  Lightbulb,
} from 'lucide-react';
import type { Jarvis3DShape, JarvisMathStep, JarvisStageContent, JarvisTrack, LocalDeviceFile } from '../../types/jarvis';
import { formatDocumentTypeLabel, formatFileSize } from '../../services/localMediaService';
import { speakPronunciation, startVoiceReading } from '../../utils/voiceService';
import {
  ensureRichMathSteps,
  renderMathLatexToHtml,
  renderRichMarkdownHtml,
} from '../../utils/richContentRenderer';
import { Sara3DDrawingStudio } from './Sara3DDrawingStudio';
import {
  LocalJarvisMediaPlayer,
  LocalLibraryBrowserView,
  LocalPhotoGalleryView,
  type LocalFullscreenSignal,
  type LocalSeekSignal,
} from './LocalMediaStageView';

function sanitizeAndFixSvgMarkup(raw: string): { html: string; isRenderable: boolean } {
  const cleaned = String(raw || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .trim();

  const match = cleaned.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i);
  if (!match) return { html: '', isRenderable: false };

  let attrs = match[1] || '';
  const inner = match[2] || '';
  const hasVisiblePrimitives = /<(path|rect|circle|ellipse|polygon|polyline|line)\b/i.test(inner);
  if (!hasVisiblePrimitives || inner.trim().length < 18) {
    return { html: '', isRenderable: false };
  }

  if (!/\bviewBox\s*=/i.test(attrs)) {
    attrs += ' viewBox="0 0 800 500"';
  }
  attrs = attrs
    .replace(/\bwidth\s*=\s*(['"])[^'"]*\1/gi, '')
    .replace(/\bheight\s*=\s*(['"])[^'"]*\1/gi, '')
    .replace(/\bpreserveAspectRatio\s*=\s*(['"])[^'"]*\1/gi, '');

  const normalizedSvg = `<svg ${attrs.trim()} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:100%;min-height:260px;">${inner}</svg>`;
  return { html: normalizedSvg, isRenderable: true };
}

function detect3DShapeFromTitle(title: string): Jarvis3DShape | null {
  const t = String(title || '').toLowerCase();
  if (/\b(carro|autom[oó]vel|viatura|ve[ií]culo|suv|sedan|desportivo)\b/.test(t)) return 'car';
  if (/\b(mol[eé]cula|h2o|[aá]gua|co2|metano|ch4|etanol|ligac[aã]o qu[ií]mica)\b/.test(t)) return 'molecule';
  if (/\b(vetores?|vetor|resultante|for[cç]a 3d)\b/.test(t)) return 'vectors';
  if (/\b(gr[aá]fico 3d|superf[ií]cie 3d|z\s*=|paraboloide)\b/.test(t)) return 'chart3d';
  if (/\b(cartesiano|eixos xyz|coordenadas 3d)\b/.test(t)) return 'cartesian';
  if (/\b(cubo|hexaedro)\b/.test(t)) return 'cube';
  if (/\b(paralelep[ií]pedo|bloco retangular)\b/.test(t)) return 'cuboid';
  if (/\b(esfera|globo)\b/.test(t)) return 'sphere';
  if (/\b(cilindro)\b/.test(t)) return 'cylinder';
  if (/\b(cone)\b/.test(t)) return 'cone';
  if (/\b(pir[aâ]mide)\b/.test(t)) return 'pyramid';
  if (/\b(prisma)\b/.test(t)) return 'prism';
  if (/\b(octaedro)\b/.test(t)) return 'octahedron';
  if (/\b(toro|rosquinha)\b/.test(t)) return 'torus';
  if (/\b([aá]tomo|n[uú]cleo|el[eé]trons)\b/.test(t)) return 'atom';
  return null;
}

function extractDimensionsFromText(text: string): { dimensions?: Record<string, number>; unit?: string } {
  const match = String(text || '').match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|dm|m|km|unid)?/i);
  if (!match) return {};
  const val = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(val) || val <= 0) return {};
  return {
    dimensions: { lado: val },
    unit: match[2] || 'cm',
  };
}

function cleanLatexInput(raw: string): string {
  let s = String(raw || '').trim();
  if (s.startsWith('$$') && s.endsWith('$$')) {
    s = s.slice(2, -2).trim();
  } else if (s.startsWith('$') && s.endsWith('$')) {
    s = s.slice(1, -1).trim();
  } else if (s.startsWith('\\[') && s.endsWith('\\]')) {
    s = s.slice(2, -2).trim();
  } else if (s.startsWith('\\(') && s.endsWith('\\)')) {
    s = s.slice(2, -2).trim();
  }
  return s;
}

const RichMarkdownBlock: React.FC<{
  text: string;
  className?: string;
}> = ({ text, className = '' }) => {
  const html = useMemo(() => renderRichMarkdownHtml(text), [text]);
  if (!html) return null;
  return (
    <div
      className={`text-[14px] leading-[1.6] text-slate-100 whitespace-normal break-words not-italic [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:text-cyan-200 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_code]:bg-[#030815] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-cyan-200 [&_img]:max-w-full [&_img]:rounded-[12px] ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

const KatexBlock: React.FC<{
  math: string;
  displayMode?: boolean;
  className?: string;
}> = ({ math, displayMode = false, className = '' }) => {
  const html = useMemo(() => {
    const cleaned = cleanLatexInput(math);
    if (!cleaned) return '';
    return renderMathLatexToHtml(cleaned, displayMode);
  }, [math, displayMode]);

  if (!html) {
    return <span className={`font-mono text-cyan-200 not-italic break-words ${className}`}>{math}</span>;
  }

  return (
    <div
      className={`overflow-x-auto sara-scroll text-cyan-100 not-italic leading-[1.6] [&_.katex]:text-inherit [&_.katex-display]:my-1 ${
        displayMode ? 'py-1' : 'inline-block align-middle'
      } ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

const StageCalculationsPanel: React.FC<{
  title?: string;
  simpleExplanation?: string;
  formulas?: string[];
  steps?: JarvisMathStep[];
  finalAnswer?: string;
  studyTip?: string;
}> = ({ title, simpleExplanation, formulas, steps, finalAnswer, studyTip }) => {
  const hasAny =
    Boolean(simpleExplanation) ||
    (formulas && formulas.length > 0) ||
    (steps && steps.length > 0) ||
    Boolean(finalAnswer) ||
    Boolean(studyTip);
  if (!hasAny) return null;

  const normalizedSteps = ensureRichMathSteps({
    title,
    formulas,
    steps,
    finalAnswer,
  });

  return (
    <div className="space-y-3.5 pt-1 not-italic">
      {simpleExplanation && (
        <div className="p-3.5 rounded-xl bg-[#071124] border border-cyan-500/25 space-y-1">
          <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-cyan-300">
            Explicação Simples
          </div>
          <RichMarkdownBlock text={simpleExplanation} />
        </div>
      )}

      {formulas && formulas.length > 0 && (
        <div className="p-3.5 rounded-xl bg-[#071124] border border-cyan-400/35 space-y-2">
          <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-cyan-300">
            Fórmula Principal em Destaque
          </div>
          <div className="grid grid-cols-1 gap-2">
            {formulas.map((f, i) => (
              <div
                key={i}
                className="px-3.5 py-2.5 rounded-lg bg-[#030815] border border-cyan-500/30 text-base sm:text-lg"
              >
                <KatexBlock math={f} displayMode />
              </div>
            ))}
          </div>
        </div>
      )}

      {normalizedSteps.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-rose-300 px-0.5">
            Passo a Passo Numerado
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {normalizedSteps.map((st, idx) => (
              <div
                key={`${st.step}_${idx}`}
                className="p-3.5 rounded-xl bg-[#060F20] border border-cyan-500/25 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="text-xs font-bold text-rose-200 tracking-wide">
                    {st.step || `Passo ${idx + 1}`}
                  </div>
                </div>
                <RichMarkdownBlock text={st.explanation} className="text-[13px] text-slate-200" />
                <div className="px-3 py-2 rounded-lg bg-[#030711] border border-cyan-500/30 text-sm sm:text-base">
                  <KatexBlock math={st.expression} displayMode />
                </div>
                {st.partialResult && (
                  <div className="px-3 py-1.5 rounded-lg bg-[#081A2E] border border-emerald-500/35 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-bold uppercase text-emerald-300">
                      Resultado parcial:
                    </span>
                    <KatexBlock math={st.partialResult} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {finalAnswer && (
        <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-400/60 space-y-1.5">
          <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-300">
            Resultado Final
          </div>
          <div className="text-base sm:text-lg font-extrabold text-emerald-100 leading-[1.6] whitespace-normal break-words not-italic">
            <KatexBlock math={finalAnswer} displayMode className="text-emerald-100" />
          </div>
        </div>
      )}

      {studyTip && (
        <div className="p-3.5 rounded-xl bg-[#0A1428] border border-amber-400/35 space-y-1">
          <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Dica de Estudo</span>
          </div>
          <RichMarkdownBlock text={studyTip} className="text-xs text-slate-200" />
        </div>
      )}
    </div>
  );
};

const ChartCanvasView: React.FC<{
  content: Extract<JarvisStageContent, { kind: 'chart' }>;
}> = ({ content }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const normalizedChart = useMemo(() => {
    const rawLabels = Array.isArray(content.labels)
      ? content.labels.filter((l) => String(l || '').trim().length > 0)
      : [];
    const rawDatasets = Array.isArray(content.datasets)
      ? content.datasets.filter((ds) => Array.isArray(ds?.data) && ds.data.length > 0)
      : [];

    const hasValid = rawLabels.length > 0 && rawDatasets.length > 0;
    if (hasValid) {
      return {
        labels: rawLabels,
        datasets: rawDatasets,
        usedFallback: false,
      };
    }

    const fallbackLabels = rawLabels.length > 0 ? rawLabels : ['Referência Base', 'Valor Atual', 'Projeção'];
    const fallbackValues = fallbackLabels.map((_, idx) => (idx + 1) * 25);
    return {
      labels: fallbackLabels,
      datasets: [
        {
          label: content.title || 'Série Analítica',
          data: fallbackValues,
          color: '#00E5FF',
        },
      ],
      usedFallback: true,
    };
  }, [content]);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartInstanceRef.current?.destroy();

    const palette = ['#00E5FF', '#FF2A4B', '#3B82F6', '#10B981', '#F59E0B', '#A855F7'];
    chartInstanceRef.current = new Chart(canvasRef.current, {
      type: content.chartType || 'bar',
      data: {
        labels: normalizedChart.labels,
        datasets: normalizedChart.datasets.map((ds, idx) => ({
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
        animation: { duration: 650, easing: 'easeOutQuart' },
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

    return () => {
      chartInstanceRef.current?.destroy();
    };
  }, [content.chartType, normalizedChart]);

  return (
    <div className="flex flex-col h-full gap-3">
      {content.subtitle && <p className="text-xs text-cyan-200/80">{content.subtitle}</p>}
      <div className="relative flex-1 min-h-[260px] rounded-xl bg-[#040812]/90 border border-cyan-500/25 p-3">
        <canvas ref={canvasRef} />
      </div>
      {(content.summary || normalizedChart.usedFallback) && (
        <p className="text-xs text-slate-300 bg-cyan-950/30 border border-cyan-500/20 rounded-xl p-3">
          {content.summary || 'Visualização estruturada automaticamente para evitar gráfico vazio.'}
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

interface JarvisStageRendererProps {
  content: JarvisStageContent;
  layoutMode: 'split' | 'focus';
  onChangeLayoutMode: (mode: 'split' | 'focus') => void;
  onClose: () => void;
  onNextTrack?: () => void;
  onPrevTrack?: () => void;
  onAskAboutDocument?: (docTitle: string) => void;
  playlist?: JarvisTrack[];
  mediaPaused?: boolean;
  mediaVolume?: number;
  mediaMuted?: boolean;
  mediaShuffled?: boolean;
  mediaLooped?: boolean;
  mediaLiked?: boolean;
  onToggleMediaPause?: () => void;
  onChangeMediaVolume?: (volume: number) => void;
  onToggleMediaMute?: () => void;
  onToggleMediaShuffle?: () => void;
  onToggleMediaLoop?: () => void;
  onToggleMediaLike?: () => void;
  localFiles?: LocalDeviceFile[];
  localHasPermission?: boolean;
  localNeedsReconnect?: boolean;
  localIsMobile?: boolean;
  localFavoritesSet?: Set<string>;
  localSeekSignal?: LocalSeekSignal | null;
  localFullscreenSignal?: LocalFullscreenSignal | null;
  onGrantLocalPermission?: (category?: 'all' | 'music' | 'video' | 'document' | 'image') => void;
  onReconnectLocalPermission?: () => void;
  onOpenLocalFile?: (file: LocalDeviceFile) => void;
  onToggleLocalFavorite?: (fileOrPath: LocalDeviceFile | string) => void;
  onFilterLocalBrowser?: (
    filter: 'all' | 'music' | 'video' | 'image' | 'document' | 'pdfs' | 'recents' | 'favorites'
  ) => void;
  onOpenInOfficeApp?: (localFileId?: string, previewUrl?: string, title?: string) => void;
  onNotify?: (msg: string) => void;
}

export const JarvisStageRenderer: React.FC<JarvisStageRendererProps> = ({
  content,
  layoutMode,
  onChangeLayoutMode,
  onClose,
  onNextTrack,
  onPrevTrack,
  onAskAboutDocument,
  mediaPaused = false,
  mediaVolume = 80,
  mediaMuted = false,
  mediaShuffled = false,
  mediaLooped = false,
  mediaLiked = false,
  onToggleMediaPause,
  onChangeMediaVolume,
  onToggleMediaMute,
  onToggleMediaShuffle,
  onToggleMediaLoop,
  onToggleMediaLike,
  localFiles = [],
  localHasPermission = false,
  localNeedsReconnect = false,
  localIsMobile = false,
  localFavoritesSet = new Set<string>(),
  localSeekSignal = null,
  localFullscreenSignal = null,
  onGrantLocalPermission,
  onReconnectLocalPermission,
  onOpenLocalFile,
  onToggleLocalFavorite,
  onFilterLocalBrowser,
  onOpenInOfficeApp,
  onNotify,
}) => {
  const [svgZoom, setSvgZoom] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const htmlIframeRef = useRef<HTMLIFrameElement | null>(null);
  const exportRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSvgZoom(false);
    setActiveSheetIdx(0);
    setActiveSlideIdx(0);
    if (exportRootRef.current) {
      gsap.fromTo(
        exportRootRef.current,
        { opacity: 0.65, y: 10 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
      );
    }
  }, [content.id]);

  const handleExportPng = async () => {
    if (!exportRootRef.current || isExportingPng) return;
    setIsExportingPng(true);
    try {
      const canvas = await html2canvas(exportRootRef.current, {
        backgroundColor: '#040914',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(content.title || 'preview-sara').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.png`;
      a.click();
    } catch {
      // ignore export errors gracefully
    } finally {
      setIsExportingPng(false);
    }
  };

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
      case '3d':
        return <Box className="w-4 h-4 text-cyan-300" />;
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
      case 'local_gallery':
        return <ImageIcon className="w-4 h-4 text-emerald-300" />;
      case 'local_browser':
        return <FolderOpen className="w-4 h-4 text-cyan-300" />;
      default:
        return <Sparkles className="w-4 h-4 text-cyan-300" />;
    }
  };

  const svgValidation = useMemo(
    () => (content.kind === 'svg' ? sanitizeAndFixSvgMarkup(content.svgCode) : null),
    [content]
  );
  const mathSvgValidation = useMemo(
    () => (content.kind === 'math' && content.svgCode ? sanitizeAndFixSvgMarkup(content.svgCode) : null),
    [content]
  );
  const explanationSvgValidation = useMemo(
    () =>
      content.kind === 'explanation' && content.visualSvg
        ? sanitizeAndFixSvgMarkup(content.visualSvg)
        : null,
    [content]
  );

  const svgFallback3DShape = useMemo(() => {
    if (content.kind !== 'svg') return null;
    if (svgValidation?.isRenderable) return null;
    return detect3DShapeFromTitle(`${content.title} ${content.description || ''}`) || 'cube';
  }, [content, svgValidation]);

  const canExportPng =
    content.kind === '3d' ||
    content.kind === 'svg' ||
    content.kind === 'math' ||
    content.kind === 'chart' ||
    content.kind === 'explanation';

  return (
    <motion.div
      initial={{ opacity: 0.75, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col h-full min-h-0 rounded-2xl bg-[#050B18]/92 border border-cyan-400/40 shadow-[0_0_32px_rgba(0,229,255,0.16)] overflow-hidden"
    >
      {/* Barra do Palco - TODOS OS BOTÕES TÊM TEXTO VISÍVEL CLARO E FUNÇÃO REAL */}
      <div className="px-3.5 py-2.5 border-b border-cyan-500/25 bg-[#071124]/95 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {renderIcon()}
          <h3 className="text-xs sm:text-sm font-bold text-white truncate">{content.title}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {(content.kind === 'explanation' || content.kind === 'document') && (
            <button
              type="button"
              onClick={() => startVoiceReading(content.title, buildReadableStageText())}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/45 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/25 transition flex items-center gap-1 cursor-pointer"
              title="Ler em voz alta em segundo plano"
            >
              <Volume2 className="w-3 h-3" />
              <span>Ler</span>
            </button>
          )}

          {canExportPng && (
            <button
              type="button"
              onClick={() => void handleExportPng()}
              disabled={isExportingPng}
              className="px-2.5 py-1 rounded-lg bg-[#0A162C] border border-cyan-500/35 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Exportar preview para imagem PNG"
            >
              <Camera className="w-3 h-3" />
              <span>{isExportingPng ? 'A guardar...' : 'Exportar PNG'}</span>
            </button>
          )}

          {content.kind === 'svg' && svgValidation?.isRenderable && (
            <>
              <button
                type="button"
                onClick={() => setSvgZoom((z) => !z)}
                className="px-2.5 py-1 rounded-lg bg-[#0A162C] border border-cyan-500/35 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20 transition flex items-center gap-1 cursor-pointer"
                title={svgZoom ? 'Reduzir zoom do desenho' : 'Ampliar desenho'}
              >
                <ZoomIn className="w-3 h-3" />
                <span>{svgZoom ? 'Normal' : 'Ampliar'}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadTextFile(`${content.title || 'arte-sara'}.svg`, svgValidation.html, 'image/svg+xml')
                }
                className="px-2.5 py-1 rounded-lg bg-[#0A162C] border border-cyan-500/35 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20 transition flex items-center gap-1 cursor-pointer"
                title="Descarregar ficheiro vetorial SVG"
              >
                <Download className="w-3 h-3" />
                <span>Baixar SVG</span>
              </button>
            </>
          )}

          {content.kind === 'html' && (
            <>
              <button
                type="button"
                onClick={() => htmlIframeRef.current?.contentWindow?.print()}
                className="px-2.5 py-1 rounded-lg bg-[#0A162C] border border-cyan-500/35 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20 transition flex items-center gap-1 cursor-pointer"
                title="Imprimir ou guardar como PDF"
              >
                <Printer className="w-3 h-3" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => downloadTextFile(`${content.title || 'visual-sara'}.html`, content.html, 'text/html')}
                className="px-2.5 py-1 rounded-lg bg-[#0A162C] border border-cyan-500/35 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20 transition flex items-center gap-1 cursor-pointer"
                title="Descarregar HTML"
              >
                <Download className="w-3 h-3" />
                <span>Baixar HTML</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => onChangeLayoutMode(layoutMode === 'split' ? 'focus' : 'split')}
            className="px-2.5 py-1 rounded-lg bg-[#0A162C] border border-cyan-500/35 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20 transition flex items-center gap-1 cursor-pointer"
            title={layoutMode === 'split' ? 'Expandir palco ao máximo' : 'Dividir ecrã com a Sara'}
          >
            {layoutMode === 'split' ? <Maximize2 className="w-3 h-3" /> : <Columns2 className="w-3 h-3" />}
            <span>{layoutMode === 'split' ? 'Expandir' : 'Dividir'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/45 text-rose-200 hover:bg-rose-500/35 transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
            title="Fechar visualização e voltar à Sara"
          >
            <X className="w-3.5 h-3.5" />
            <span>Fechar</span>
          </button>
        </div>
      </div>

      {/* Corpo dinâmico */}
      <div ref={exportRootRef} className="flex-1 min-h-0 overflow-y-auto sara-scroll p-3.5">
        {content.kind === '3d' && (
          <div className="flex flex-col gap-3.5">
            <Sara3DDrawingStudio
              shape={content.shape}
              title={content.title}
              subtitle={content.subtitle}
              dimensions={content.dimensions}
              unit={content.unit || 'cm'}
            />

            {content.description && <RichMarkdownBlock text={content.description} />}

            <StageCalculationsPanel
              title={content.title}
              simpleExplanation={content.simpleExplanation}
              formulas={content.formulas}
              steps={content.steps}
              finalAnswer={content.finalAnswer}
              studyTip={content.studyTip}
            />
          </div>
        )}

        {content.kind === 'svg' && (
          <div className="flex flex-col gap-3.5">
            {content.subtitle && <p className="text-xs text-cyan-200/80">{content.subtitle}</p>}

            {svgValidation?.isRenderable ? (
              <div
                className={`w-full min-h-[290px] max-h-[390px] rounded-xl bg-[#040914] border border-cyan-500/30 flex items-center justify-center p-4 overflow-hidden transition-transform duration-200 ${
                  svgZoom ? 'scale-[1.06]' : ''
                }`}
                dangerouslySetInnerHTML={{ __html: svgValidation.html }}
              />
            ) : (
              <Sara3DDrawingStudio
                shape={svgFallback3DShape || 'cube'}
                title={content.title}
                {...extractDimensionsFromText(`${content.title} ${content.description || ''}`)}
              />
            )}

            {content.description && <RichMarkdownBlock text={content.description} />}

            <StageCalculationsPanel
              title={content.title}
              simpleExplanation={content.simpleExplanation}
              formulas={content.formulas}
              steps={content.steps}
              finalAnswer={content.finalAnswer}
              studyTip={content.studyTip}
            />
          </div>
        )}

        {content.kind === 'math' && (() => {
          const mathSteps = ensureRichMathSteps({
            title: content.title,
            problem: content.problem,
            formulas: content.formulas,
            steps: content.steps,
            finalAnswer: content.finalAnswer,
          });
          const mainFormulas =
            content.formulas && content.formulas.length > 0
              ? content.formulas
              : content.problem
              ? [content.problem]
              : [];

          return (
            <div className="space-y-3.5 not-italic">
              {/* 1. Título e Explicação Simples */}
              <div className="p-3.5 rounded-xl bg-[#091428] border border-cyan-400/35 space-y-1.5">
                <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-cyan-300">
                  1. Explicação Simples
                </div>
                <RichMarkdownBlock
                  text={
                    content.simpleExplanation ||
                    content.problem ||
                    `Resolução didática passo a passo de ${content.title}.`
                  }
                />
                {content.problem && content.simpleExplanation && (
                  <div className="pt-1 text-xs text-slate-300 leading-[1.6]">
                    <span className="font-semibold text-cyan-200">Enunciado: </span>
                    <KatexBlock math={content.problem} />
                  </div>
                )}
              </div>

              {mathSvgValidation?.isRenderable && (
                <div
                  className="w-full min-h-[220px] max-h-[300px] rounded-xl bg-[#040914] border border-cyan-500/25 flex items-center justify-center p-3 overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: mathSvgValidation.html }}
                />
              )}

              {/* 2. Fórmula Principal em Destaque */}
              {mainFormulas.length > 0 && (
                <div className="p-3.5 rounded-xl bg-[#071124] border border-cyan-400/35 space-y-2">
                  <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-cyan-300">
                    2. Fórmula Principal em Destaque
                  </div>
                  {mainFormulas.map((f, i) => (
                    <div
                      key={i}
                      className="px-3.5 py-2 rounded-lg bg-[#030815] border border-cyan-500/25 text-base sm:text-lg"
                    >
                      <KatexBlock math={f} displayMode />
                    </div>
                  ))}
                </div>
              )}

              {/* 3. Passo a Passo Numerado (nunca vazio) */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-rose-300 px-0.5">
                  3. Passo a Passo Numerado
                </div>
                {mathSteps.map((st, idx) => (
                  <div
                    key={`${st.step}_${idx}`}
                    className="p-3.5 rounded-xl bg-[#060F20] border border-cyan-500/25 flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-rose-200 tracking-wide">
                        {st.step || `Passo ${idx + 1}`}
                      </span>
                    </div>
                    <RichMarkdownBlock text={st.explanation} className="text-[13px] text-slate-200" />
                    <div className="px-3 py-2 rounded-lg bg-[#030711] border border-cyan-500/30">
                      <KatexBlock math={st.expression} displayMode />
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-[#081A2E] border border-emerald-500/35 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold uppercase text-emerald-300">
                        Resultado parcial:
                      </span>
                      <KatexBlock math={st.partialResult} />
                    </div>
                  </div>
                ))}
              </div>

              {/* 4. Resultado Final em Card Verde */}
              <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-400/60 space-y-1.5">
                <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-300">
                  4. Resultado Final
                </div>
                <div className="text-base sm:text-lg font-extrabold text-emerald-100 leading-[1.6] whitespace-normal break-words not-italic">
                  <KatexBlock math={content.finalAnswer || mainFormulas[0] || ''} displayMode className="text-emerald-100" />
                </div>
              </div>

              {/* 5. Dica de Estudo */}
              {(content.studyTip || content.notes) && (
                <div className="p-3.5 rounded-xl bg-[#0A1428] border border-amber-400/35 space-y-1">
                  <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>5. Dica de Estudo</span>
                  </div>
                  <RichMarkdownBlock
                    text={content.studyTip || content.notes || ''}
                    className="text-xs text-slate-200"
                  />
                </div>
              )}
            </div>
          );
        })()}

        {content.kind === 'explanation' && (
          <div className="space-y-3.5 not-italic">
            {(content.summary || (content.sections.length === 0 && !explanationSvgValidation?.isRenderable)) && (
              <div className="p-3.5 rounded-xl bg-[#08152C] border border-cyan-400/35">
                <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-cyan-300 mb-1.5">
                  Explicação Simples
                </div>
                <RichMarkdownBlock
                  text={
                    content.summary ||
                    `Explicação estruturada sobre ${content.title}. Usa o botão Ler para ouvir em voz alta ou faz uma pergunta de seguimento.`
                  }
                />
              </div>
            )}

            {explanationSvgValidation?.isRenderable && (
              <div
                className="w-full min-h-[220px] max-h-[300px] rounded-xl bg-[#040914] border border-cyan-500/25 flex items-center justify-center p-4 overflow-hidden"
                dangerouslySetInnerHTML={{ __html: explanationSvgValidation.html }}
              />
            )}

            {content.formula && (
              <div className="p-3.5 rounded-xl bg-[#061124] border border-cyan-400/35">
                <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-cyan-300 mb-1">
                  Fórmula Principal em Destaque
                </div>
                <KatexBlock math={content.formula} displayMode />
              </div>
            )}

            {content.sections.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {content.sections.map((sec, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#071124] border border-cyan-500/25 space-y-1.5"
                  >
                    <div className="text-xs font-bold text-cyan-300">{sec.heading}</div>
                    <RichMarkdownBlock text={sec.body} className="text-[13px] text-slate-200" />
                  </div>
                ))}
              </div>
            )}

            {content.exampleBody && (
              <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-400/60 space-y-1.5">
                <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-300">
                  {content.exampleTitle || 'Resultado / Exemplo Prático'}
                </div>
                <RichMarkdownBlock
                  text={content.exampleBody}
                  className="text-sm text-emerald-100 leading-[1.6] whitespace-normal break-words not-italic"
                />
              </div>
            )}

            {content.studyTip && (
              <div className="p-3.5 rounded-xl bg-[#0A1428] border border-amber-400/35 space-y-1">
                <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Dica de Estudo</span>
                </div>
                <RichMarkdownBlock text={content.studyTip} className="text-xs text-slate-200" />
              </div>
            )}
          </div>
        )}

        {content.kind === 'chart' && <ChartCanvasView content={content} />}

        {content.kind === 'document' && (
          <div className="space-y-3">
            {/* Card lateral/superior de metadados locais: Tipo, Nome, Última abertura, Tamanho */}
            {(content.isLocalDeviceFile || content.fileExtension) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-[#071327] border border-cyan-400/35">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase text-cyan-300">Tipo</div>
                  <div className="text-xs font-bold text-white truncate">
                    {formatDocumentTypeLabel(content.fileExtension || '')}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase text-cyan-300">Nome</div>
                  <div className="text-xs font-bold text-white truncate">{content.title}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase text-cyan-300">Última abertura</div>
                  <div className="text-xs font-semibold text-slate-200 truncate">
                    {content.lastOpenedAt
                      ? new Date(content.lastOpenedAt).toLocaleString('pt-PT', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Agora'}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase text-cyan-300">Tamanho</div>
                  <div className="text-xs font-bold text-emerald-300 truncate">
                    {typeof content.fileSizeBytes === 'number'
                      ? formatFileSize(content.fileSizeBytes)
                      : '--'}
                  </div>
                </div>
              </div>
            )}

            {/* Botão para abrir no Microsoft Word / PowerPoint / Excel do dispositivo quando aplicável */}
            {content.fileExtension &&
              /^(doc|docx|ppt|pptx|xls|xlsx)$/i.test(content.fileExtension) &&
              onOpenInOfficeApp && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#061124] border border-cyan-500/30">
                  <span className="text-xs text-slate-300 flex items-center gap-1.5">
                    {/^(xls|xlsx)$/i.test(content.fileExtension) ? (
                      <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                    ) : /^(ppt|pptx)$/i.test(content.fileExtension) ? (
                      <Presentation className="w-4 h-4 text-amber-300" />
                    ) : (
                      <FileText className="w-4 h-4 text-cyan-300" />
                    )}
                    <span>Aberto no leitor próprio da SARA</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenInOfficeApp(content.localFileId, content.previewUrl, content.title)
                    }
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/55 text-cyan-100 text-xs font-bold flex items-center gap-1.5 hover:bg-cyan-500/30 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>
                      {/^(xls|xlsx)$/i.test(content.fileExtension)
                        ? 'Abrir no Microsoft Excel'
                        : /^(ppt|pptx)$/i.test(content.fileExtension)
                        ? 'Abrir no PowerPoint'
                        : 'Abrir no Microsoft Word'}
                    </span>
                  </button>
                </div>
              )}

            {content.previewUrl && content.mimeType.startsWith('image/') && (
              <figure className="rounded-xl border border-cyan-500/30 bg-[#040914] p-2.5 space-y-2 flex flex-col items-center">
                <img
                  src={content.previewUrl}
                  alt={content.title}
                  className="max-w-full max-h-[300px] rounded-[12px] object-contain"
                />
                <figcaption className="text-[11px] text-slate-300 text-center">
                  {content.title}
                </figcaption>
              </figure>
            )}
            {content.previewUrl && content.mimeType === 'application/pdf' && (
              <div className="rounded-xl overflow-hidden border border-cyan-500/30 bg-[#040914] h-[360px]">
                <iframe src={content.previewUrl} title={content.title} className="w-full h-full" />
              </div>
            )}

            {/* Leitor próprio Word (.docx) */}
            {content.formattedHtml && (
              <div
                className="p-4 rounded-xl bg-white text-slate-900 text-xs sm:text-sm leading-relaxed max-h-[380px] overflow-y-auto sara-scroll prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: content.formattedHtml }}
              />
            )}

            {/* Leitor próprio Excel (.xlsx / .xls / .csv) */}
            {content.sheets && content.sheets.length > 0 && (
              <div className="space-y-2">
                {content.sheets.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {content.sheets.map((sh, sIdx) => (
                      <button
                        key={sh.name}
                        type="button"
                        onClick={() => setActiveSheetIdx(sIdx)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                          sIdx === activeSheetIdx
                            ? 'bg-cyan-500/25 border-cyan-400 text-white'
                            : 'bg-[#071124] border-cyan-500/20 text-slate-300'
                        }`}
                      >
                        {sh.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="rounded-xl overflow-auto max-h-[340px] border border-cyan-500/30 bg-[#040915] sara-scroll">
                  <table className="w-full text-xs text-left border-collapse">
                    <tbody>
                      {(content.sheets[activeSheetIdx]?.rows || []).map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={
                            rIdx === 0
                              ? 'bg-[#0B1933] text-cyan-200 font-bold sticky top-0'
                              : 'border-t border-cyan-500/15 text-slate-200'
                          }
                        >
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-2.5 py-1.5 border-r border-cyan-500/10 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Leitor próprio PowerPoint (.pptx / .ppt) */}
            {content.slides && content.slides.length > 0 && (
              <div className="p-4 rounded-xl bg-[#071124] border border-cyan-400/35 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono uppercase text-cyan-300">
                    Diapositivo {activeSlideIdx + 1} de {content.slides.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={activeSlideIdx <= 0}
                      onClick={() => setActiveSlideIdx((i) => Math.max(0, i - 1))}
                      className="px-2.5 py-1 rounded-lg bg-[#040915] border border-cyan-500/30 text-xs text-cyan-200 disabled:opacity-40 cursor-pointer"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      disabled={activeSlideIdx >= content.slides.length - 1}
                      onClick={() =>
                        setActiveSlideIdx((i) => Math.min((content.slides?.length || 1) - 1, i + 1))
                      }
                      className="px-2.5 py-1 rounded-lg bg-[#040915] border border-cyan-500/30 text-xs text-cyan-200 disabled:opacity-40 cursor-pointer"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#040915] border border-cyan-500/25 min-h-[160px] space-y-2">
                  <h4 className="text-sm sm:text-base font-bold text-white">
                    {content.slides[activeSlideIdx]?.title}
                  </h4>
                  <ul className="space-y-1.5">
                    {(content.slides[activeSlideIdx]?.bullets || []).map((b, bIdx) => (
                      <li key={bIdx} className="text-xs text-slate-200 flex items-start gap-2">
                        <span className="text-cyan-400 font-bold">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Leitor próprio Texto simples (.txt / .md / .json / fallback) */}
            {!content.formattedHtml &&
              !content.sheets?.length &&
              !content.slides?.length &&
              content.mimeType !== 'application/pdf' &&
              !content.mimeType.startsWith('image/') &&
              content.rawText && (
                <pre className="p-3.5 rounded-xl bg-[#040915] border border-cyan-500/25 text-xs text-slate-100 whitespace-pre-wrap font-mono max-h-[340px] overflow-y-auto sara-scroll">
                  {content.rawText}
                </pre>
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
          <div className="h-full min-h-[340px] rounded-xl overflow-hidden border border-cyan-500/30 bg-[#071124]">
            <iframe
              ref={htmlIframeRef}
              srcDoc={
                /<(html|body)\b/i.test(content.html || '')
                  ? content.html
                  : `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8" /><style>html,body{margin:0;min-height:100vh;background:#071124;color:#f8fafc;font-family:Inter,system-ui,sans-serif;padding:16px;box-sizing:border-box;}</style></head><body>${content.html || '<p>Visualização interativa pronta.</p>'}</body></html>`
              }
              title={content.title}
              sandbox="allow-scripts allow-same-origin allow-modals"
              className="w-full h-full min-h-[340px]"
            />
          </div>
        )}

        {(content.kind === 'music' || content.kind === 'video') &&
          (content.track.source === 'local' ? (
            <LocalJarvisMediaPlayer
              track={content.track}
              kind={content.kind}
              isPaused={mediaPaused}
              volume={mediaVolume}
              isMuted={mediaMuted}
              isShuffled={mediaShuffled}
              isLooped={mediaLooped}
              isLiked={mediaLiked}
              localQueue={localFiles.filter((f) =>
                content.kind === 'video'
                  ? f.kind === 'video'
                  : f.kind === 'music' || f.kind === 'audio'
              )}
              seekSignal={localSeekSignal}
              fullscreenSignal={localFullscreenSignal}
              onTogglePause={() => onToggleMediaPause?.()}
              onChangeVolume={(v) => onChangeMediaVolume?.(v)}
              onToggleMute={onToggleMediaMute}
              onNextTrack={onNextTrack}
              onPrevTrack={onPrevTrack}
              onToggleShuffle={onToggleMediaShuffle}
              onToggleLoop={onToggleMediaLoop}
              onToggleLike={onToggleMediaLike}
              onSelectLocalFile={onOpenLocalFile}
              onNotifyError={onNotify}
            />
          ) : (
            <YouTubeMediaPlayer
              track={content.track}
              kind={content.kind}
              isPaused={mediaPaused}
              volume={mediaVolume}
              onTogglePause={() => onToggleMediaPause?.()}
              onChangeVolume={(v) => onChangeMediaVolume?.(v)}
              onNextTrack={onNextTrack}
            />
          ))}

        {content.kind === 'local_gallery' && (
          <LocalPhotoGalleryView
            content={content}
            fullscreenSignal={localFullscreenSignal}
            favoritesSet={localFavoritesSet}
            onToggleFavorite={(idOrPath) => onToggleLocalFavorite?.(idOrPath)}
          />
        )}

        {content.kind === 'local_browser' && (
          <LocalLibraryBrowserView
            content={content}
            hasPermission={localHasPermission}
            needsReconnect={localNeedsReconnect}
            isMobile={localIsMobile}
            favoritesSet={localFavoritesSet}
            onGrantPermission={(cat) => onGrantLocalPermission?.(cat)}
            onReconnect={() => onReconnectLocalPermission?.()}
            onOpenFile={(f) => onOpenLocalFile?.(f)}
            onToggleFavorite={(f) => onToggleLocalFavorite?.(f)}
            onFilterChange={(filter) => onFilterLocalBrowser?.(filter)}
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
    </motion.div>
  );
};
