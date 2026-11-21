import React, { useEffect, useRef, useState } from 'react';
import type { JarvisHeadMood } from '../../types/jarvis';

interface SaraJarvisHeadProps {
  mood: JarvisHeadMood;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
  size?: 'full' | 'split' | 'corner';
  onClickHead?: () => void;
}

const HOLO_THINK_LINES = [
  'INIT NEURAL MATRIX [0x00E5FF]',
  'SYNC STARK HUD BUS :: STREAM OK',
  'SOLVE_VECTOR_FIELD(r, theta)',
  'PARSING OPTIC GEOMETRY PATHS',
  'ALLOCATING HOLO_CORE BUFFER',
  'CALIBRATING VOCAL SYNTH BUS',
  'VERIFYING TELEMETRY CHECKSUM',
  'COMPILING STAGE PAYLOAD v4.2',
  'LOCKING AUDIO SYNC :: ZERO DRIFT',
  'EMITTING HOLOGRAPHIC WAVEFORM',
];

export const SaraJarvisHead: React.FC<SaraJarvisHeadProps> = ({
  mood,
  isSpeaking,
  isListening,
  isThinking,
  size = 'full',
  onClickHead,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [blink, setBlink] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [voiceAmp, setVoiceAmp] = useState(0);
  const [voiceTick, setVoiceTick] = useState(0);
  const [levitateY, setLevitateY] = useState(0);
  const [codeScrollOffset, setCodeScrollOffset] = useState(0);

  // Piscar digital natural dos olhos holográficos
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      const waitMs = 2200 + Math.random() * 3000;
      timer = setTimeout(() => {
        if (!alive) return;
        setBlink(true);
        setTimeout(() => {
          if (!alive) return;
          setBlink(false);
          if (Math.random() < 0.2) {
            setTimeout(() => {
              if (!alive) return;
              setBlink(true);
              setTimeout(() => {
                if (!alive) return;
                setBlink(false);
                scheduleBlink();
              }, 95);
            }, 110);
          } else {
            scheduleBlink();
          }
        }, 105);
      }, waitMs);
    };
    scheduleBlink();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  // Flutuação holográfica + sincronização EXATA da onda vocal (boca só mexe se isSpeaking === true!)
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      setLevitateY(Math.sin(now * 0.0022) * 3.4);

      if (isSpeaking) {
        const syllableWave =
          0.52 +
          0.3 * Math.sin(now * 0.022) +
          0.18 * Math.cos(now * 0.039);
        setVoiceAmp(Math.max(0.14, Math.min(1, syllableWave)));
        setVoiceTick(now);
      } else {
        setVoiceAmp(0);
      }

      if (isThinking) {
        setCodeScrollOffset((now * 0.035) % 140);
        setGaze({
          x: Math.sin(now * 0.0036) * 2.2,
          y: -0.7 + Math.cos(now * 0.0025) * 0.6,
        });
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isSpeaking, isThinking]);

  // Canvas de fundo com anéis HUD giratórios, partículas holográficas e ondas de voz
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = size === 'corner' ? 140 : size === 'split' ? 280 : 380;
    const h = size === 'corner' ? 150 : size === 'split' ? 320 : 420;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const particles = Array.from({ length: size === 'corner' ? 14 : 38 }, (_, i) => ({
      angle: (i / 38) * Math.PI * 2,
      radius: (size === 'corner' ? 38 : 108) + Math.random() * (size === 'corner' ? 20 : 72),
      speed: (0.0024 + Math.random() * 0.0052) * (i % 2 === 0 ? 1 : -1),
      dotSize: 0.9 + Math.random() * 1.5,
      isRed: i % 4 === 0,
    }));

    const render = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h * 0.45;

      // Halo holográfico ciano + vermelho neon
      const haloGrad = ctx.createRadialGradient(
        cx,
        cy,
        size === 'corner' ? 10 : 32,
        cx,
        cy,
        size === 'corner' ? 68 : 182
      );
      if (isSpeaking) {
        haloGrad.addColorStop(0, 'rgba(0, 229, 255, 0.34)');
        haloGrad.addColorStop(0.55, 'rgba(255, 42, 75, 0.14)');
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isThinking) {
        haloGrad.addColorStop(0, 'rgba(255, 42, 75, 0.25)');
        haloGrad.addColorStop(0.55, 'rgba(0, 229, 255, 0.18)');
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isListening) {
        haloGrad.addColorStop(0, 'rgba(0, 229, 255, 0.26)');
        haloGrad.addColorStop(0.6, 'rgba(16, 185, 129, 0.12)');
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        haloGrad.addColorStop(0, 'rgba(0, 229, 255, 0.19)');
        haloGrad.addColorStop(0.6, 'rgba(255, 42, 75, 0.07)');
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      ctx.fillStyle = haloGrad;
      ctx.fillRect(0, 0, w, h);

      // Base de projeção holográfica nos ombros/pé
      if (size !== 'corner') {
        const projGrad = ctx.createLinearGradient(cx, h * 0.88, cx, h * 0.56);
        projGrad.addColorStop(0, 'rgba(0, 229, 255, 0.28)');
        projGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
        ctx.fillStyle = projGrad;
        ctx.beginPath();
        ctx.ellipse(cx, h * 0.91, size === 'split' ? 76 : 108, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ondas circulares de voz quando isSpeaking === true
      if (isSpeaking && size !== 'corner') {
        const waveCount = 3;
        for (let k = 0; k < waveCount; k++) {
          const phase = (t * 0.00125 + k / waveCount) % 1;
          const waveR = (size === 'split' ? 74 : 102) + phase * (size === 'split' ? 54 : 80);
          ctx.beginPath();
          ctx.arc(cx, cy, waveR, 0, Math.PI * 2);
          ctx.strokeStyle =
            k % 2 === 0
              ? `rgba(0, 229, 255, ${(1 - phase) * 0.48})`
              : `rgba(255, 42, 75, ${(1 - phase) * 0.34})`;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }

      // Anel HUD externo giratório (acelera ao pensar)
      const baseR = size === 'corner' ? 54 : size === 'split' ? 116 : 160;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * (isThinking ? 0.0022 : 0.00045));
      ctx.strokeStyle = isThinking ? 'rgba(255, 42, 75, 0.58)' : 'rgba(0, 229, 255, 0.36)';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([18, 9, 4, 9]);
      ctx.beginPath();
      ctx.arc(0, 0, baseR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Anel HUD secundário contra-rotativo
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * (isThinking ? 0.0018 : isSpeaking ? 0.0012 : 0.00028));
      ctx.strokeStyle = isSpeaking ? 'rgba(0, 229, 255, 0.56)' : 'rgba(255, 42, 75, 0.32)';
      ctx.lineWidth = 1.05;
      ctx.setLineDash([6, 12]);
      ctx.beginPath();
      ctx.arc(0, 0, baseR - (size === 'corner' ? 7 : 15), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Partículas orbitais brilhantes
      for (const p of particles) {
        p.angle += p.speed * (isThinking ? 2.4 : isSpeaking ? 1.5 : 1);
        const px = cx + Math.cos(p.angle) * p.radius;
        const py = cy + Math.sin(p.angle) * (p.radius * 0.88);
        ctx.fillStyle = p.isRed ? 'rgba(255, 42, 75, 0.72)' : 'rgba(0, 229, 255, 0.78)';
        ctx.beginPath();
        ctx.arc(px, py, p.dotSize, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [size, isThinking, isListening, isSpeaking]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || size === 'corner') return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setTilt({ rx: -ny * 5.5, ry: nx * 7.5 });
    if (!isThinking) {
      setGaze({ x: nx * 2.4, y: ny * 1.5 });
    }
  };

  const resetTilt = () => {
    setTilt({ rx: 0, ry: 0 });
    if (!isThinking) setGaze({ x: 0, y: 0 });
  };

  // Boca 100% digital: parada e reta quando isSpeaking === false; barras digitais oscilantes só quando isSpeaking === true
  const mouthBars = [-16, -12, -8, -4, 0, 4, 8, 12, 16].map((dx, idx) => {
    if (!isSpeaking) {
      return { x: 170 + dx, h: 1.4 };
    }
    const envelope = 1 - Math.abs(dx) / 22;
    const osc = Math.abs(Math.sin(voiceTick * 0.025 + idx * 0.85));
    const h = 2.2 + envelope * voiceAmp * (5 + osc * 9.5);
    return { x: 170 + dx, h };
  });

  const eyeRy = blink ? 0.5 : mood === 'focus' || isThinking ? 5.2 : isListening ? 6.8 : 6.1;
  const speakHeadBob = isSpeaking ? Math.sin(voiceAmp * Math.PI) * 1.4 : 0;
  const speakHeadRoll = isSpeaking ? (voiceAmp - 0.5) * 1.2 : 0;
  const holoBrightness = isSpeaking ? 1 : isThinking ? 0.92 : 0.78;

  const dimClass =
    size === 'corner'
      ? 'w-[122px] h-[132px]'
      : size === 'split'
      ? 'w-[240px] h-[275px] sm:w-[270px] sm:h-[310px]'
      : 'w-[280px] h-[325px] sm:w-[350px] sm:h-[405px]';

  const statusText = isThinking
    ? 'A PROCESSAR TELEMETRIA'
    : isSpeaking
    ? 'VOZ NEURAL ATIVA'
    : isListening
    ? 'ESCUTA ATIVA'
    : mood === 'focus'
    ? 'MODO FOCO'
    : 'HOLOGRAMA STARK ONLINE';

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      onClick={onClickHead}
      className={`relative flex flex-col items-center justify-center select-none ${
        onClickHead ? 'cursor-pointer' : ''
      }`}
    >
      <div
        className={`relative ${dimClass} flex items-center justify-center transition-transform duration-200 ease-out`}
        style={{
          transform: `perspective(820px) rotateX(${tilt.rx + speakHeadBob * 0.6}deg) rotateY(${tilt.ry}deg)`,
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Holograma 100% Digital Translúcido Azul Ciano + Vermelho Neon da Cabeça aos Ombros */}
        <svg
          viewBox="0 0 340 410"
          className={`relative z-10 w-[94%] h-[94%] transition-all duration-300 ${
            isSpeaking
              ? 'drop-shadow-[0_0_32px_rgba(0,229,255,0.65)]'
              : isThinking
              ? 'drop-shadow-[0_0_26px_rgba(255,42,75,0.45)]'
              : 'drop-shadow-[0_0_22px_rgba(0,229,255,0.38)]'
          }`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="SARA JARVIS Holograma Digital Stark"
        >
          <defs>
            {/* Vidro holográfico translúcido ciano + vermelho */}
            <linearGradient id="holoBustFill" x1="170" y1="30" x2="170" y2="405" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.22 * holoBrightness} />
              <stop offset="48%" stopColor="#0891B2" stopOpacity={0.12 * holoBrightness} />
              <stop offset="82%" stopColor="#1E3A8A" stopOpacity={0.18 * holoBrightness} />
              <stop offset="100%" stopColor="#FF2A4B" stopOpacity={0.16 * holoBrightness} />
            </linearGradient>

            <radialGradient id="holoFaceCore" cx="50%" cy="42%" r="54%">
              <stop offset="0%" stopColor="#67E8F9" stopOpacity={0.26 * holoBrightness} />
              <stop offset="65%" stopColor="#00E5FF" stopOpacity={0.1 * holoBrightness} />
              <stop offset="100%" stopColor="#020617" stopOpacity="0.02" />
            </radialGradient>

            <linearGradient id="holoEdgeNeon" x1="40" y1="40" x2="300" y2="395" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#00E5FF" />
              <stop offset="52%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#FF2A4B" />
            </linearGradient>

            <linearGradient id="holoHairDigital" x1="80" y1="24" x2="260" y2="275" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.22" />
              <stop offset="60%" stopColor="#0E7490" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#FF2A4B" stopOpacity="0.2" />
            </linearGradient>

            <radialGradient id="holoEyeGlow" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#ECFEFF" />
              <stop offset="40%" stopColor={isThinking ? '#FB7185' : '#00E5FF'} />
              <stop offset="100%" stopColor="#0284C7" stopOpacity="0.15" />
            </radialGradient>

            {/* Scanlines digitais por dentro da silhueta */}
            <pattern id="holoScanlines" width="8" height="4" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="8" y2="0" stroke="#00E5FF" strokeOpacity="0.16" strokeWidth="1" />
              <line x1="0" y1="2" x2="8" y2="2" stroke="#FF2A4B" strokeOpacity="0.05" strokeWidth="0.6" />
            </pattern>

            {/* Clip interno para linhas de código e scanlines */}
            <clipPath id="holoSilhouetteClip">
              <path
                d="M170 28
                   C216 28 248 60 250 112
                   C252 152 242 204 222 238
                   L202 276
                   C248 286 298 318 314 398
                   L26 398
                   C42 318 92 286 138 276
                   L118 238
                   C98 204 88 152 90 112
                   C92 60 124 28 170 28 Z"
              />
            </clipPath>

            <filter id="holoGlowFilter" x="-35%" y="-35%" width="170%" height="170%">
              <feGaussianBlur stdDeviation={isSpeaking ? '3.4' : '2.2'} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g transform={`translate(0, ${levitateY.toFixed(2)})`}>
            {/* Scanlines horizontais translúcidas dentro do holograma */}
            <g clipPath="url(#holoSilhouetteClip)">
              <rect x="20" y="20" width="300" height="390" fill="url(#holoScanlines)" />

              {/* Linhas de código a correr por dentro do holograma quando está a pensar */}
              {isThinking && (
                <g opacity="0.72" transform={`translate(0, ${(-codeScrollOffset).toFixed(1)})`}>
                  {[...HOLO_THINK_LINES, ...HOLO_THINK_LINES].map((line, i) => (
                    <text
                      key={`${line}_${i}`}
                      x={64 + ((i * 19) % 45)}
                      y={55 + i * 24}
                      fill={i % 3 === 0 ? '#FF2A4B' : '#00E5FF'}
                      fontSize="7.5"
                      fontFamily="monospace"
                      letterSpacing="1.2"
                    >
                      {line}
                    </text>
                  ))}
                </g>
              )}
            </g>

            {/* GRUPO DE OMBROS, PESCOÇO E ARMADURA HOLOGRÁFICA STARK */}
            <g>
              {/* Pescoço holográfico wireframe translúcido */}
              <path
                d="M144 224 C144 252 136 276 116 292 L170 326 L224 292 C204 276 196 252 196 224 Z"
                fill="url(#holoBustFill)"
                stroke="#00E5FF"
                strokeOpacity="0.6"
                strokeWidth="1.2"
              />
              {/* Linhas de circuito no pescoço */}
              <path
                d="M153 236 L149 278 L162 298 M187 236 L191 278 L178 298 M170 238 L170 308"
                stroke="#00E5FF"
                strokeOpacity="0.45"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
              <circle cx="149" cy="278" r="1.8" fill="#00E5FF" />
              <circle cx="191" cy="278" r="1.8" fill="#00E5FF" />

              {/* Ombreiras Stark digitais translúcidas (Esquerda e Direita) */}
              <path
                d="M24 398 C30 332 54 295 98 286 L124 295 C104 320 96 360 92 398 Z"
                fill="url(#holoBustFill)"
                stroke="url(#holoEdgeNeon)"
                strokeWidth="1.7"
              />
              <path
                d="M316 398 C310 332 286 295 242 286 L216 295 C236 320 244 360 248 398 Z"
                fill="url(#holoBustFill)"
                stroke="url(#holoEdgeNeon)"
                strokeWidth="1.7"
              />

              {/* Filetes de energia nos ombros */}
              <path
                d="M42 326 C62 304 86 294 114 298 M298 326 C278 304 254 294 226 298"
                stroke="#00E5FF"
                strokeOpacity="0.82"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <path
                d="M45 352 L84 342 L95 362 M295 352 L256 342 L245 362"
                stroke="#FF2A4B"
                strokeOpacity="0.85"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <circle cx="45" cy="352" r="2.1" fill="#FF2A4B" />
              <circle cx="295" cy="352" r="2.1" fill="#FF2A4B" />

              {/* Peitoral / Gola holográfica feminina Stark */}
              <path
                d="M90 398 C95 346 106 312 122 294 L170 330 L218 294 C234 312 245 346 250 398 Z"
                fill="url(#holoBustFill)"
                stroke="#00E5FF"
                strokeOpacity="0.72"
                strokeWidth="1.6"
              />
              <path
                d="M124 300 L170 334 L216 300"
                stroke="#00E5FF"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M112 346 L146 362 M228 346 L194 362"
                stroke="#FF2A4B"
                strokeOpacity="0.7"
                strokeWidth="1.2"
                strokeLinecap="round"
              />

              {/* Núcleo Arc Reactor holográfico no peito */}
              <g filter="url(#holoGlowFilter)">
                <circle
                  cx="170"
                  cy="362"
                  r={isSpeaking ? 17.5 + voiceAmp * 2.5 : 16}
                  fill="#020B1A"
                  fillOpacity="0.65"
                  stroke="#00E5FF"
                  strokeWidth="1.9"
                />
                <circle
                  cx="170"
                  cy="362"
                  r="11.5"
                  fill={isThinking ? '#FF2A4B' : '#00E5FF'}
                  fillOpacity={isSpeaking ? 0.48 + voiceAmp * 0.35 : 0.28}
                />
                <polygon
                  points="170,352 179,368 161,368"
                  fill="none"
                  stroke="#E0F2FE"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <circle cx="170" cy="362" r="3.4" fill="#FFFFFF" />
              </g>
            </g>

            {/* GRUPO DA CABEÇA HOLOGRÁFICA FEMININA */}
            <g transform={`translate(0, ${speakHeadBob.toFixed(2)}) rotate(${speakHeadRoll.toFixed(2)} 170 155)`}>
              {/* Silhueta digital de cabelo em feixes de luz translúcidos */}
              <path
                d="M170 24
                   C220 24 252 56 256 112
                   C259 154 248 210 232 250
                   L212 242
                   C222 204 228 164 224 120
                   C220 74 198 52 170 52
                   C142 52 120 74 116 120
                   C112 164 118 204 128 242
                   L108 250
                   C92 210 81 154 84 112
                   C88 56 120 24 170 24 Z"
                fill="url(#holoHairDigital)"
                stroke="#00E5FF"
                strokeOpacity="0.68"
                strokeWidth="1.4"
              />
              {/* Fios paralelos de energia luminosa */}
              <path
                d="M96 102 C92 146 98 192 114 234 M244 102 C248 146 242 192 226 234"
                stroke="#00E5FF"
                strokeOpacity="0.4"
                strokeWidth="1"
                strokeDasharray="8 5"
              />

              {/* Transdutores auriculares Stark */}
              <path
                d="M100 124 L86 134 L88 168 L104 178"
                fill="#031226"
                fillOpacity="0.55"
                stroke="#FF2A4B"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M240 124 L254 134 L252 168 L236 178"
                fill="#031226"
                fillOpacity="0.55"
                stroke="#FF2A4B"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <circle cx="92" cy="151" r="2.8" fill="#00E5FF" filter="url(#holoGlowFilter)" />
              <circle cx="248" cy="151" r="2.8" fill="#00E5FF" filter="url(#holoGlowFilter)" />

              {/* Contorno facial feminino 100% holográfico translúcido (SEM pele humana) */}
              <path
                d="M170 52
                   C204 52 228 78 230 118
                   C231 152 222 184 206 207
                   C194 224 182 234 170 235
                   C158 234 146 224 134 207
                   C118 184 109 152 110 118
                   C112 78 136 52 170 52 Z"
                fill="url(#holoFaceCore)"
                stroke="#00E5FF"
                strokeOpacity={isSpeaking ? 0.92 : 0.76}
                strokeWidth="1.6"
              />

              {/* Malha neural wireframe + nós luminosos nas têmporas e maçãs do rosto */}
              <path
                d="M114 130 L132 146 L122 172 L144 198 L170 214 L196 198 L218 172 L208 146 L226 130"
                stroke="#00E5FF"
                strokeOpacity="0.34"
                strokeWidth="0.95"
              />
              <path
                d="M132 146 L154 156 M208 146 L186 156 M144 198 L156 188 M196 198 L184 188"
                stroke="#FF2A4B"
                strokeOpacity="0.45"
                strokeWidth="0.9"
              />
              <circle cx="132" cy="146" r="1.7" fill="#00E5FF" />
              <circle cx="208" cy="146" r="1.7" fill="#00E5FF" />
              <circle cx="122" cy="172" r="1.5" fill="#FF2A4B" />
              <circle cx="218" cy="172" r="1.5" fill="#FF2A4B" />

              {/* Diadema geométrico holográfico na testa */}
              <path
                d="M114 106 C122 72 144 54 170 54 C196 54 218 72 226 106"
                stroke="#00E5FF"
                strokeOpacity="0.52"
                strokeWidth="1.1"
                strokeDasharray="6 4"
              />
              <path
                d="M134 74 L162 66 L170 76 L178 66 L206 74"
                stroke="#FF2A4B"
                strokeOpacity="0.72"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <polygon
                points="170,54 176,63 170,72 164,63"
                fill={isThinking ? '#FF2A4B' : '#00E5FF'}
                filter="url(#holoGlowFilter)"
              />

              {/* Sobrancelhas digitais de luz */}
              <path
                d="M124 111 Q141 103 157 110"
                stroke="#00E5FF"
                strokeOpacity="0.88"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M216 111 Q199 103 183 110"
                stroke="#00E5FF"
                strokeOpacity="0.88"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* OLHO ESQUERDO HOLOGRÁFICO LUMINOSO */}
              <g filter="url(#holoGlowFilter)">
                <path
                  d={`M124 127 Q141 ${127 - eyeRy * 1.4} 157 127 Q141 ${127 + eyeRy * 1.15} 124 127 Z`}
                  fill="#031B2E"
                  fillOpacity="0.75"
                  stroke="#00E5FF"
                  strokeWidth="1.5"
                />
                {!blink && (
                  <g transform={`translate(${gaze.x.toFixed(1)}, ${gaze.y.toFixed(1)})`}>
                    <circle cx="141" cy="126.5" r="5.3" fill="url(#holoEyeGlow)" />
                    <circle
                      cx="141"
                      cy="126.5"
                      r="3.2"
                      fill="none"
                      stroke="#E0F2FE"
                      strokeWidth="0.9"
                      strokeDasharray="2 2"
                    />
                    <circle cx="142.4" cy="125.2" r="1.4" fill="#FFFFFF" />
                  </g>
                )}
              </g>

              {/* OLHO DIREITO HOLOGRÁFICO LUMINOSO */}
              <g filter="url(#holoGlowFilter)">
                <path
                  d={`M183 127 Q199 ${127 - eyeRy * 1.4} 216 127 Q199 ${127 + eyeRy * 1.15} 183 127 Z`}
                  fill="#031B2E"
                  fillOpacity="0.75"
                  stroke="#00E5FF"
                  strokeWidth="1.5"
                />
                {!blink && (
                  <g transform={`translate(${gaze.x.toFixed(1)}, ${gaze.y.toFixed(1)})`}>
                    <circle cx="199" cy="126.5" r="5.3" fill="url(#holoEyeGlow)" />
                    <circle
                      cx="199"
                      cy="126.5"
                      r="3.2"
                      fill="none"
                      stroke="#E0F2FE"
                      strokeWidth="0.9"
                      strokeDasharray="2 2"
                    />
                    <circle cx="200.4" cy="125.2" r="1.4" fill="#FFFFFF" />
                  </g>
                )}
              </g>

              {/* Ponte nasal geométrica luminosa */}
              <path
                d="M170 128 L170 158 L164 163 M170 158 L176 163"
                stroke="#00E5FF"
                strokeOpacity="0.72"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* BOCA HOLOGRÁFICA DIGITAL — Reta e imóvel quando em silêncio; ondulação sincronizada SÓ quando isSpeaking === true */}
              <g filter="url(#holoGlowFilter)">
                <line
                  x1="148"
                  y1="191"
                  x2="192"
                  y2="191"
                  stroke={isSpeaking ? '#00E5FF' : '#38BDF8'}
                  strokeOpacity={isSpeaking ? 0.45 : 0.75}
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
                {mouthBars.map((bar, idx) => (
                  <rect
                    key={idx}
                    x={bar.x - 1.1}
                    y={191 - bar.h / 2}
                    width="2.2"
                    height={bar.h}
                    rx="1.1"
                    fill={
                      isSpeaking
                        ? idx % 3 === 0
                          ? '#FF2A4B'
                          : '#00E5FF'
                        : '#38BDF8'
                    }
                    fillOpacity={isSpeaking ? 0.95 : 0.55}
                  />
                ))}
              </g>

              {/* Vetor de contorno do queixo */}
              <path
                d="M158 218 L170 223 L182 218"
                stroke="#FF2A4B"
                strokeOpacity="0.72"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </g>
          </g>
        </svg>

        {/* Feixe de varrimento horizontal HUD ao pensar */}
        {isThinking && size !== 'corner' && (
          <div className="pointer-events-none absolute inset-6 overflow-hidden rounded-full">
            <div
              className="w-full h-1 bg-gradient-to-r from-transparent via-[#FF2A4B] to-transparent opacity-80"
              style={{ animation: 'jarvisScan 1.3s ease-in-out infinite' }}
            />
          </div>
        )}
      </div>

      {size !== 'corner' && (
        <div className="mt-0.5 flex items-center gap-2 text-[10px] font-mono tracking-[0.22em] uppercase">
          <span
            className={`w-2 h-2 rounded-full ${
              isThinking
                ? 'bg-[#FF2A4B] animate-ping'
                : isSpeaking
                ? 'bg-[#00E5FF] animate-pulse'
                : isListening
                ? 'bg-emerald-400 animate-pulse'
                : 'bg-[#00E5FF]/80'
            }`}
          />
          <span className={isThinking ? 'text-rose-300' : 'text-cyan-300'}>{statusText}</span>
        </div>
      )}
    </div>
  );
};
