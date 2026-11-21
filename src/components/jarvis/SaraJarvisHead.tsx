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
  const [voiceAmp, setVoiceAmp] = useState(0);

  // Piscar de olhos natural aleatório
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      const waitMs = 2200 + Math.random() * 2900;
      timer = setTimeout(() => {
        if (!alive) return;
        setBlink(true);
        setTimeout(() => {
          if (!alive) return;
          setBlink(false);
          scheduleBlink();
        }, 145);
      }, waitMs);
    };
    scheduleBlink();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  // Oscilação viva da boca/vocalizador e movimento subtil quando fala ou pensa
  useEffect(() => {
    if (!isSpeaking && !isListening && !isThinking) {
      setVoiceAmp(0);
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      if (isSpeaking) {
        const wave =
          0.45 +
          0.35 * Math.sin(now * 0.018) +
          0.2 * Math.cos(now * 0.031);
        setVoiceAmp(Math.max(0.1, Math.min(1, wave)));
      } else if (isListening) {
        setVoiceAmp(0.25 + 0.18 * Math.sin(now * 0.008));
      } else {
        setVoiceAmp(0.18 + 0.1 * Math.sin(now * 0.006));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isSpeaking, isListening, isThinking]);

  // Partículas espaciais + anéis de energia no Canvas por trás da armadura feminina
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = size === 'corner' ? 140 : size === 'split' ? 280 : 380;
    const h = size === 'corner' ? 140 : size === 'split' ? 300 : 390;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const particles = Array.from({ length: size === 'corner' ? 18 : 42 }, (_, i) => ({
      angle: (i / 42) * Math.PI * 2,
      radius: (size === 'corner' ? 36 : 95) + Math.random() * (size === 'corner' ? 25 : 75),
      speed: (0.003 + Math.random() * 0.007) * (i % 2 === 0 ? 1 : -1),
      dotSize: 1 + Math.random() * 1.8,
      isRed: i % 5 === 0,
    }));

    const render = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;

      // Halo radial de energia Stark
      const haloGrad = ctx.createRadialGradient(
        cx,
        cy,
        size === 'corner' ? 10 : 30,
        cx,
        cy,
        size === 'corner' ? 66 : 165
      );
      if (isThinking) {
        haloGrad.addColorStop(0, 'rgba(255, 42, 75, 0.24)');
        haloGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.14)');
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isListening) {
        haloGrad.addColorStop(0, 'rgba(0, 229, 255, 0.28)');
        haloGrad.addColorStop(0.6, 'rgba(16, 185, 129, 0.1)');
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        haloGrad.addColorStop(0, 'rgba(0, 229, 255, 0.2)');
        haloGrad.addColorStop(0.6, 'rgba(255, 42, 75, 0.06)');
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      ctx.fillStyle = haloGrad;
      ctx.fillRect(0, 0, w, h);

      // Anel HUD externo segmentado
      const baseR = size === 'corner' ? 52 : size === 'split' ? 112 : 148;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * (isThinking ? 0.0018 : 0.00045));
      ctx.strokeStyle = isThinking ? 'rgba(255, 42, 75, 0.55)' : 'rgba(0, 229, 255, 0.35)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([14, 9, 4, 9]);
      ctx.beginPath();
      ctx.arc(0, 0, baseR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Anel secundário contra-rotativo
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * (isSpeaking ? 0.0013 : 0.0003));
      ctx.strokeStyle = isSpeaking ? 'rgba(0, 229, 255, 0.6)' : 'rgba(255, 42, 75, 0.32)';
      ctx.lineWidth = 1.1;
      ctx.setLineDash([6, 12]);
      ctx.beginPath();
      ctx.arc(0, 0, baseR - (size === 'corner' ? 8 : 16), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Partículas orbitais
      for (const p of particles) {
        p.angle += p.speed * (isThinking ? 2.4 : isSpeaking ? 1.6 : 1);
        const px = cx + Math.cos(p.angle) * p.radius;
        const py = cy + Math.sin(p.angle) * (p.radius * 0.92);
        ctx.fillStyle = p.isRed ? 'rgba(255, 42, 75, 0.72)' : 'rgba(0, 229, 255, 0.75)';
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
    setTilt({ rx: -ny * 7, ry: nx * 9 });
  };

  const resetTilt = () => setTilt({ rx: 0, ry: 0 });

  const eyeHeight = blink ? 1.2 : mood === 'focus' ? 5.2 : isListening ? 8.2 : 6.8;
  const mouthCurve =
    mood === 'happy'
      ? 6
      : isSpeaking
      ? 1.5 + voiceAmp * 4.5
      : isThinking
      ? -1.2
      : 2.5;

  const autoNodDeg = isSpeaking ? Math.sin(voiceAmp * Math.PI) * 2.5 : 0;
  const dimClass =
    size === 'corner'
      ? 'w-[126px] h-[126px]'
      : size === 'split'
      ? 'w-[240px] h-[255px] sm:w-[270px] sm:h-[285px]'
      : 'w-[260px] h-[270px] sm:w-[340px] sm:h-[355px]';

  const statusText = isThinking
    ? 'A PROCESSAR TELEMETRIA'
    : isSpeaking
    ? 'RESPOSTA VOCAL ATIVA'
    : isListening
    ? 'ESCUTA NEURAL CONTÍNUA'
    : mood === 'focus'
    ? 'MODO FOCO ATIVO'
    : 'SARA JARVIS ONLINE';

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
          transform: `perspective(750px) rotateX(${tilt.rx + autoNodDeg}deg) rotateY(${tilt.ry}deg)`,
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Armadura Stark Versão Feminina Holográfica 3D em SVG */}
        <svg
          viewBox="0 0 260 280"
          className="relative z-10 w-[86%] h-[86%] drop-shadow-[0_0_24px_rgba(0,229,255,0.42)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="SARA JARVIS Holographic Interface"
        >
          <defs>
            <linearGradient id="saraShellMetal" x1="40" y1="20" x2="220" y2="250" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0E223D" stopOpacity="0.96" />
              <stop offset="50%" stopColor="#081529" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#1A0E1B" stopOpacity="0.96" />
            </linearGradient>
            <linearGradient id="saraArmorAccent" x1="70" y1="30" x2="190" y2="230" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#00E5FF" />
              <stop offset="65%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#FF2A4B" />
            </linearGradient>
            <linearGradient id="saraFaceplate" x1="130" y1="44" x2="130" y2="234" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#122C4E" stopOpacity="0.92" />
              <stop offset="55%" stopColor="#0B1930" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#071122" stopOpacity="0.98" />
            </linearGradient>
            <filter id="saraGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Pescoço biomecânico elegante */}
          <path
            d="M104 222 L95 256 L165 256 L156 222"
            fill="url(#saraShellMetal)"
            stroke="#00E5FF"
            strokeOpacity="0.45"
            strokeWidth="1.5"
          />
          <path
            d="M110 236 H150 M106 246 H154"
            stroke="#FF2A4B"
            strokeOpacity="0.6"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* Silhueta externa do capacete feminino Stark (contorno curvilíneo e elegante) */}
          <path
            d="M130 24
               C168 24 196 48 202 88
               L209 128
               L198 168
               C189 200 166 225 144 235
               C135 239 125 239 116 235
               C94 225 71 200 62 168
               L51 128
               L58 88
               C64 48 92 24 130 24 Z"
            fill="url(#saraShellMetal)"
            stroke="url(#saraArmorAccent)"
            strokeWidth="2.2"
          />

          {/* Cristas laterais/auriculares Stark com luz vermelho neon */}
          <path
            d="M52 106 L41 118 L43 152 L57 166"
            fill="#140D1B"
            stroke="#FF2A4B"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M208 106 L219 118 L217 152 L203 166"
            fill="#140D1B"
            stroke="#FF2A4B"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="46" cy="134" r="3" fill="#00E5FF" filter="url(#saraGlow)" />
          <circle cx="214" cy="134" r="3" fill="#00E5FF" filter="url(#saraGlow)" />

          {/* Placa frontal feminina esculpida (maçãs do rosto e queixo fino) */}
          <path
            d="M130 42
               L164 56
               L182 88
               L186 130
               L174 172
               C165 198 148 216 130 223
               C112 216 95 198 86 172
               L74 130
               L78 88
               L96 56 Z"
            fill="url(#saraFaceplate)"
            stroke="#00E5FF"
            strokeOpacity="0.65"
            strokeWidth="1.6"
          />

          {/* Diadema / Núcleo Frontal na testa */}
          <path
            d="M112 50 L130 68 L148 50"
            stroke="#FF2A4B"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polygon
            points="130,36 138,48 130,60 122,48"
            fill={isThinking ? '#FF2A4B' : '#00E5FF'}
            fillOpacity="0.88"
            filter="url(#saraGlow)"
          />

          {/* Linhas de contorno das sobrancelhas/viseira femininas */}
          <path
            d="M84 106 C96 95 112 97 122 108"
            stroke="#00E5FF"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M176 106 C164 95 148 97 138 108"
            stroke="#00E5FF"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Olhos óticos Stark femininos com pestanas angulares e piscar real */}
          <g filter="url(#saraGlow)">
            {/* Olho esquerdo */}
            <path
              d="M87 118 L119 121 L114 127 L91 125 Z"
              fill="#020814"
              stroke="#00E5FF"
              strokeWidth="1.2"
            />
            <ellipse
              cx="104"
              cy="121.5"
              rx="11"
              ry={eyeHeight * 0.48}
              fill={isThinking ? '#FF2A4B' : '#00E5FF'}
            />
            {!blink && <circle cx="105" cy="121" r="2.2" fill="#FFFFFF" />}

            {/* Olho direito */}
            <path
              d="M173 118 L141 121 L146 127 L169 125 Z"
              fill="#020814"
              stroke="#00E5FF"
              strokeWidth="1.2"
            />
            <ellipse
              cx="156"
              cy="121.5"
              rx="11"
              ry={eyeHeight * 0.48}
              fill={isThinking ? '#FF2A4B' : '#00E5FF'}
            />
            {!blink && <circle cx="155" cy="121" r="2.2" fill="#FFFFFF" />}
          </g>

          {/* Ponte nasal esculpida e linhas de bochecha */}
          <path
            d="M130 108 V152 L123 160 M130 152 L137 160"
            stroke="#00E5FF"
            strokeOpacity="0.45"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M84 148 L103 165 L100 189 M176 148 L157 165 L160 189"
            stroke="#FF2A4B"
            strokeOpacity="0.48"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Lábios / Vocalizador holográfico vivo */}
          <g filter="url(#saraGlow)">
            <path
              d={`M113 184 Q130 ${184 + mouthCurve} 147 184`}
              stroke={isSpeaking ? '#00E5FF' : '#93C5FD'}
              strokeWidth={isSpeaking ? 2.6 : 1.9}
              strokeLinecap="round"
              fill="none"
            />
            {isSpeaking && (
              <path
                d={`M117 185 Q130 ${185 - voiceAmp * 4} 143 185`}
                stroke="#FF2A4B"
                strokeWidth="1.4"
                strokeLinecap="round"
                fill="none"
              />
            )}
          </g>

          {/* Placa do queixo + micro luz Stark */}
          <path
            d="M116 206 L130 214 L144 206"
            stroke="#00E5FF"
            strokeOpacity="0.65"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle
            cx="130"
            cy="245"
            r="6"
            fill={isThinking ? '#FF2A4B' : '#00E5FF'}
            fillOpacity="0.28"
            stroke="#00E5FF"
            strokeWidth="1.5"
          />
          <circle cx="130" cy="245" r="2.6" fill="#FFFFFF" />
        </svg>

        {/* Feixe de varrimento HUD ao pensar */}
        {isThinking && size !== 'corner' && (
          <div className="pointer-events-none absolute inset-6 overflow-hidden rounded-full">
            <div
              className="w-full h-1 bg-gradient-to-r from-transparent via-[#FF2A4B] to-transparent opacity-80"
              style={{ animation: 'jarvisScan 1.6s ease-in-out infinite' }}
            />
          </div>
        )}
      </div>

      {size !== 'corner' && (
        <div className="mt-1 flex items-center gap-2 text-[10px] font-mono tracking-[0.22em] uppercase">
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
