import React, { useEffect, useRef, useState } from 'react';
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
  FileText,
  Sparkles,
  Calculator,
  BarChart3,
  Globe,
  MessageSquarePlus,
} from 'lucide-react';
import type { JarvisStageContent, JarvisTrack } from '../../types/jarvis';

interface JarvisStageRendererProps {
  content: JarvisStageContent;
  layoutMode: 'split' | 'focus';
  onChangeLayoutMode: (mode: 'split' | 'focus') => void;
  onClose: () => void;
  onNextTrack?: () => void;
  onAskAboutDocument?: (docTitle: string) => void;
  playlist?: JarvisTrack[];
}

function sanitizeSvgMarkup(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '');
}

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

const MusicStagePlayer: React.FC<{
  track: JarvisTrack;
  onNextTrack?: () => void;
}> = ({ track, onNextTrack }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(14);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioNodesRef = useRef<{ ctx: AudioContext; gain: GainNode; oscs: OscillatorNode[] } | null>(null);

  // Sintetizador Web Audio quando faixa for 'synth' ou complemento local
  useEffect(() => {
    if (track.source !== 'synth') return;
    if (!isPlaying) {
      audioNodesRef.current?.oscs.forEach((o) => {
        try {
          o.stop();
        } catch {
          // ignore
        }
      });
      audioNodesRef.current?.ctx.close().catch(() => {});
      audioNodesRef.current = null;
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.value = 0.045;
      master.connect(ctx.destination);
      const freqs = [110, 164.81, 220, 277.18];
      const oscs = freqs.map((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.value = f;
        osc.connect(master);
        osc.start();
        return osc;
      });
      audioNodesRef.current = { ctx, gain: master, oscs };
    } catch {
      // ignore autoplay blocks
    }

    return () => {
      audioNodesRef.current?.oscs.forEach((o) => {
        try {
          o.stop();
        } catch {
          // ignore
        }
      });
      audioNodesRef.current?.ctx.close().catch(() => {});
      audioNodesRef.current = null;
    };
  }, [track.id, track.source, isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : p + 0.6));
    }, 500);
    return () => clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    const c = waveCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const draw = (t: number) => {
      const w = c.width;
      const h = c.height;
      ctx.clearRect(0, 0, w, h);
      const bars = 36;
      const bw = (w - bars * 2) / bars;
      for (let i = 0; i < bars; i++) {
        const amp = isPlaying
          ? 0.25 + 0.72 * Math.abs(Math.sin(t * 0.005 + i * 0.42))
          : 0.14;
        const bh = Math.max(4, amp * (h - 6));
        const x = i * (bw + 2);
        const y = (h - bh) / 2;
        ctx.fillStyle = i % 5 === 0 ? '#FF2A4B' : '#00E5FF';
        ctx.fillRect(x, y, bw, bh);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  const ytEmbedUrl = track.videoId
    ? `https://www.youtube.com/embed/${track.videoId}?autoplay=${isPlaying ? 1 : 0}&rel=0`
    : null;

  return (
    <div className="flex flex-col gap-4 h-full justify-between">
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#040915]/90 border border-cyan-500/30 rounded-2xl p-4">
        <div className="relative w-28 h-28 rounded-2xl overflow-hidden border border-[#FF2A4B]/50 bg-[#0A1326] shrink-0 flex items-center justify-center shadow-[0_0_25px_rgba(255,42,75,0.2)]">
          {track.thumbnailUrl ? (
            <img
              src={track.thumbnailUrl}
              alt={track.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : null}
          <Music2 className="w-10 h-10 text-cyan-300" />
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-rose-400">
            Reprodução Neural Ativa
          </div>
          <h4 className="text-base font-bold text-white truncate mt-0.5">{track.title}</h4>
          <p className="text-xs text-cyan-300/80 truncate">{track.artist}</p>

          <div className="mt-3 flex items-center justify-center sm:justify-start gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying((v) => !v)}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-cyan-500/30 transition cursor-pointer"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pausar' : 'Tocar'}</span>
            </button>
            {onNextTrack && (
              <button
                type="button"
                onClick={onNextTrack}
                className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center gap-1 hover:bg-rose-500/25 transition cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Próxima</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {ytEmbedUrl && (
        <div className="rounded-2xl overflow-hidden border border-cyan-500/30 bg-black aspect-video max-h-[240px]">
          <iframe
            src={ytEmbedUrl}
            title={track.title}
            className="w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      <div className="bg-[#040915]/85 border border-cyan-500/20 rounded-xl p-3 space-y-2">
        <canvas ref={waveCanvasRef} width={480} height={44} className="w-full h-11 rounded" />
        <input
          type="range"
          min={0}
          max={100}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          className="w-full accent-cyan-400 cursor-pointer"
          aria-label="Progresso da música"
        />
      </div>
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
}) => {
  const [svgZoom, setSvgZoom] = useState(false);

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
      case 'html':
        return <Globe className="w-4 h-4 text-cyan-300" />;
      default:
        return <Sparkles className="w-4 h-4 text-cyan-300" />;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 rounded-2xl bg-[#050B18]/92 border border-cyan-400/40 shadow-[0_0_32px_rgba(0,229,255,0.16)] backdrop-blur-md overflow-hidden">
      {/* Barra do Palco */}
      <div className="px-3.5 py-2.5 border-b border-cyan-500/25 bg-[#071124]/90 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {renderIcon()}
          <h3 className="text-xs sm:text-sm font-bold text-white truncate">{content.title}</h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
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
            <button
              type="button"
              onClick={() => downloadTextFile(`${content.title || 'visual-sara'}.html`, content.html, 'text/html')}
              className="px-2 py-1 rounded-lg bg-[#0A162C] border border-cyan-500/30 text-[11px] text-cyan-200 hover:bg-cyan-500/15 transition flex items-center gap-1 cursor-pointer"
              title="Descarregar HTML"
            >
              <Download className="w-3 h-3" />
            </button>
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
            className="p-1.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 transition cursor-pointer"
            title="Fechar visualização e voltar à Sara em destaque"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Corpo dinâmico */}
      <div className="flex-1 min-h-0 overflow-y-auto sara-scroll p-3.5">
        {content.kind === 'svg' && (
          <div className="flex flex-col gap-3 h-full">
            {content.subtitle && <p className="text-xs text-cyan-200/80">{content.subtitle}</p>}
            <div
              className={`flex-1 min-h-[240px] rounded-xl bg-[#040914] border border-cyan-500/25 flex items-center justify-center p-4 overflow-auto transition ${
                svgZoom ? 'scale-105' : ''
              }`}
              dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(content.svgCode) }}
            />
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

            <div className="space-y-2">
              {content.steps.map((st, idx) => (
                <div
                  key={`${st.step}_${idx}`}
                  className="p-3 rounded-xl bg-[#060F20] border border-cyan-500/20 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider">
                      {st.step || `Passo ${idx + 1}`}
                    </span>
                    <code className="px-2 py-0.5 rounded bg-[#030711] border border-cyan-500/30 text-xs font-mono text-cyan-200">
                      {st.expression}
                    </code>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{st.explanation}</p>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-rose-500/15 border border-cyan-400/50">
              <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">
                Resultado Final
              </div>
              <div className="text-base font-extrabold text-white mt-0.5 font-mono">
                {content.finalAnswer}
              </div>
              {content.notes && <p className="text-xs text-slate-300 mt-1.5">{content.notes}</p>}
            </div>
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
              srcDoc={content.html}
              title={content.title}
              sandbox="allow-scripts allow-same-origin"
              className="w-full h-full min-h-[300px]"
            />
          </div>
        )}

        {content.kind === 'music' && (
          <MusicStagePlayer track={content.track} onNextTrack={onNextTrack} />
        )}

        {content.kind === 'ideation' && (
          <div className="space-y-3">
            {content.subtitle && <p className="text-xs text-cyan-200/80">{content.subtitle}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {content.cards.map((card, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-[#071124] border border-cyan-500/25 hover:border-rose-400/50 transition"
                >
                  <div className="text-[10px] font-mono uppercase tracking-wider text-rose-300 mb-1">
                    {card.tag}
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">{card.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{card.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
