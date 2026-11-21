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
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [voiceAmp, setVoiceAmp] = useState(0);
  const [breathPhase, setBreathPhase] = useState(0);

  // Piscar de olhos natural orgânico (incluindo piscada dupla ocasional)
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      const waitMs = 2100 + Math.random() * 3200;
      timer = setTimeout(() => {
        if (!alive) return;
        setBlink(true);
        setTimeout(() => {
          if (!alive) return;
          setBlink(false);
          if (Math.random() < 0.22) {
            setTimeout(() => {
              if (!alive) return;
              setBlink(true);
              setTimeout(() => {
                if (!alive) return;
                setBlink(false);
                scheduleBlink();
              }, 115);
            }, 130);
          } else {
            scheduleBlink();
          }
        }, 130);
      }, waitMs);
    };
    scheduleBlink();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  // Respiração contínua + movimento natural da boca ao falar + olhar ao pensar
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      setBreathPhase(Math.sin(now * 0.0021));

      if (isSpeaking) {
        const wave =
          0.48 +
          0.32 * Math.sin(now * 0.019) +
          0.2 * Math.cos(now * 0.034);
        setVoiceAmp(Math.max(0.08, Math.min(1, wave)));
      } else if (isListening) {
        setVoiceAmp(0.18 + 0.12 * Math.sin(now * 0.007));
      } else if (isThinking) {
        setVoiceAmp(0.12);
        setGaze({
          x: Math.sin(now * 0.0032) * 2.2,
          y: -0.9 + Math.cos(now * 0.0024) * 0.6,
        });
      } else {
        setVoiceAmp(0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isSpeaking, isListening, isThinking]);

  // Canvas de fundo com anéis HUD, partículas espaciais e ondas de voz ao falar
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

    const particles = Array.from({ length: size === 'corner' ? 14 : 36 }, (_, i) => ({
      angle: (i / 36) * Math.PI * 2,
      radius: (size === 'corner' ? 40 : 112) + Math.random() * (size === 'corner' ? 20 : 68),
      speed: (0.0025 + Math.random() * 0.0055) * (i % 2 === 0 ? 1 : -1),
      dotSize: 0.9 + Math.random() * 1.6,
      isRed: i % 5 === 0,
    }));

    const render = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h * 0.45;

      // Halo atmosférico Stark atrás da silhueta
      const haloGrad = ctx.createRadialGradient(
        cx,
        cy,
        size === 'corner' ? 12 : 34,
        cx,
        cy,
        size === 'corner' ? 68 : 175
      );
      if (isThinking) {
        haloGrad.addColorStop(0, 'rgba(255, 42, 75, 0.22)');
        haloGrad.addColorStop(0.55, 'rgba(0, 229, 255, 0.14)');
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isSpeaking) {
        haloGrad.addColorStop(0, 'rgba(0, 229, 255, 0.28)');
        haloGrad.addColorStop(0.55, 'rgba(59, 130, 246, 0.12)');
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isListening) {
        haloGrad.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
        haloGrad.addColorStop(0.55, 'rgba(0, 229, 255, 0.12)');
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        haloGrad.addColorStop(0, 'rgba(0, 229, 255, 0.16)');
        haloGrad.addColorStop(0.65, 'rgba(255, 42, 75, 0.05)');
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      ctx.fillStyle = haloGrad;
      ctx.fillRect(0, 0, w, h);

      // Ondas circulares de voz quando a Sara fala
      if (isSpeaking && size !== 'corner') {
        const waveCount = 3;
        for (let k = 0; k < waveCount; k++) {
          const phase = ((t * 0.0011 + k / waveCount) % 1);
          const waveR = (size === 'split' ? 76 : 104) + phase * (size === 'split' ? 52 : 78);
          ctx.beginPath();
          ctx.arc(cx, cy, waveR, 0, Math.PI * 2);
          ctx.strokeStyle =
            k % 2 === 0
              ? `rgba(0, 229, 255, ${(1 - phase) * 0.42})`
              : `rgba(255, 42, 75, ${(1 - phase) * 0.3})`;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }

      // Anel HUD externo segmentado
      const baseR = size === 'corner' ? 54 : size === 'split' ? 116 : 158;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * (isThinking ? 0.0017 : 0.00038));
      ctx.strokeStyle = isThinking ? 'rgba(255, 42, 75, 0.48)' : 'rgba(0, 229, 255, 0.28)';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([16, 10, 4, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, baseR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Anel secundário contra-rotativo
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * (isSpeaking ? 0.0012 : 0.00025));
      ctx.strokeStyle = isSpeaking ? 'rgba(0, 229, 255, 0.5)' : 'rgba(255, 42, 75, 0.26)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 13]);
      ctx.beginPath();
      ctx.arc(0, 0, baseR - (size === 'corner' ? 7 : 15), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Partículas orbitais
      for (const p of particles) {
        p.angle += p.speed * (isThinking ? 2.2 : isSpeaking ? 1.45 : 1);
        const px = cx + Math.cos(p.angle) * p.radius;
        const py = cy + Math.sin(p.angle) * (p.radius * 0.88);
        ctx.fillStyle = p.isRed ? 'rgba(255, 42, 75, 0.65)' : 'rgba(0, 229, 255, 0.72)';
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
      setGaze({ x: nx * 2.5, y: ny * 1.6 });
    }
  };

  const resetTilt = () => {
    setTilt({ rx: 0, ry: 0 });
    if (!isThinking) setGaze({ x: 0, y: 0 });
  };

  const breathOffsetY = breathPhase * 2.3;
  const speakHeadBob = isSpeaking ? Math.sin(voiceAmp * Math.PI) * 1.8 : 0;
  const speakHeadRoll = isSpeaking ? (voiceAmp - 0.5) * 1.4 : 0;
  const eyeRy = blink ? 0.5 : mood === 'focus' || isThinking ? 5.6 : isListening ? 7.4 : 6.7;
  const browLift = mood === 'happy' ? -2.2 : isListening ? -1.4 : isThinking ? 1.8 : 0;
  const smileLift = mood === 'happy' ? 4.2 : isSpeaking ? 1.5 : isThinking ? -0.6 : 1.8;
  const mouthGap = isSpeaking ? 1.5 + voiceAmp * 6.8 : mood === 'happy' ? 1.2 : 0;

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
          transform: `perspective(820px) rotateX(${tilt.rx + speakHeadBob * 0.6}deg) rotateY(${tilt.ry}deg)`,
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Retrato Realista Feminino Stark da Cabeça até os Ombros */}
        <svg
          viewBox="0 0 340 410"
          className="relative z-10 w-[94%] h-[94%] drop-shadow-[0_0_26px_rgba(0,229,255,0.34)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="SARA JARVIS Feminine Stark Interface"
        >
          <defs>
            {/* Pele humana realista com brilho acetinado quente */}
            <radialGradient id="saraSkinBase" cx="50%" cy="38%" r="60%">
              <stop offset="0%" stopColor="#F5D3BE" />
              <stop offset="52%" stopColor="#E6B89C" />
              <stop offset="88%" stopColor="#C98F72" />
              <stop offset="100%" stopColor="#A66D53" />
            </radialGradient>
            <linearGradient id="saraNeckSkin" x1="170" y1="225" x2="170" y2="325" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BA7F64" />
              <stop offset="35%" stopColor="#DFAD90" />
              <stop offset="100%" stopColor="#CE9779" />
            </linearGradient>
            <radialGradient id="saraCheekBlush" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E87A7A" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#E87A7A" stopOpacity="0" />
            </radialGradient>

            {/* Cabelo-armadura escuro metálico feminino */}
            <linearGradient id="saraHairMetal" x1="80" y1="25" x2="260" y2="290" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1B2E4E" />
              <stop offset="45%" stopColor="#0D192E" />
              <stop offset="100%" stopColor="#050A14" />
            </linearGradient>

            {/* Armadura Stark feminina nos ombros e peito */}
            <linearGradient id="saraArmorPlate" x1="50" y1="270" x2="290" y2="405" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#173052" />
              <stop offset="50%" stopColor="#0B1930" />
              <stop offset="100%" stopColor="#1B0E1D" />
            </linearGradient>
            <linearGradient id="saraShoulderTrim" x1="30" y1="280" x2="310" y2="395" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#00E5FF" />
              <stop offset="55%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#FF2A4B" />
            </linearGradient>

            {/* Íris luminosa safira-ciano */}
            <radialGradient id="saraIrisGrad" cx="45%" cy="42%" r="55%">
              <stop offset="0%" stopColor="#A5F3FC" />
              <stop offset="45%" stopColor={isThinking ? '#FB7185' : '#00E5FF'} />
              <stop offset="85%" stopColor={isThinking ? '#9F1239' : '#0369A1'} />
              <stop offset="100%" stopColor="#041527" />
            </radialGradient>

            {/* Lábios naturais rosados */}
            <linearGradient id="saraLipUpper" x1="170" y1="184" x2="170" y2="193" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#B85360" />
              <stop offset="100%" stopColor="#9C3F4D" />
            </linearGradient>
            <linearGradient id="saraLipLower" x1="170" y1="191" x2="170" y2="203" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#CE6B77" />
              <stop offset="100%" stopColor="#A64855" />
            </linearGradient>

            <filter id="saraSoftGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* GRUPO DOS OMBROS + BUSTO + PESCOÇO (com respiração natural suave) */}
          <g transform={`translate(0, ${breathOffsetY.toFixed(2)})`}>
            {/* Sombra por trás dos ombros */}
            <path
              d="M26 398 C34 328 66 296 118 286 L222 286 C274 296 306 328 314 398 Z"
              fill="#030814"
              fillOpacity="0.7"
            />

            {/* Pescoço feminino elegante e clavículas */}
            <path
              d="M142 222 C142 252 135 276 114 292 L170 326 L226 292 C205 276 198 252 198 222 Z"
              fill="url(#saraNeckSkin)"
            />
            {/* Sombra do queixo no pescoço */}
            <path
              d="M142 222 C152 246 188 246 198 222 C186 234 154 234 142 222 Z"
              fill="#8B563F"
              fillOpacity="0.45"
            />
            {/* Clavículas delicadas */}
            <path
              d="M118 293 Q146 301 164 312 M222 293 Q194 301 176 312"
              stroke="#B5795E"
              strokeOpacity="0.65"
              strokeWidth="1.6"
              strokeLinecap="round"
            />

            {/* Ombreiras Stark femininas esculpidas (Esquerda & Direita) */}
            <path
              d="M22 402 C28 334 52 296 96 286 L124 295 C104 320 96 360 92 402 Z"
              fill="url(#saraArmorPlate)"
              stroke="url(#saraShoulderTrim)"
              strokeWidth="2"
            />
            <path
              d="M318 402 C312 334 288 296 244 286 L216 295 C236 320 244 360 248 402 Z"
              fill="url(#saraArmorPlate)"
              stroke="url(#saraShoulderTrim)"
              strokeWidth="2"
            />

            {/* Placas superiores dos ombros com filetes neon */}
            <path
              d="M42 326 C62 304 86 294 114 298"
              stroke="#00E5FF"
              strokeOpacity="0.7"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M298 326 C278 304 254 294 226 298"
              stroke="#00E5FF"
              strokeOpacity="0.7"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M46 352 L84 342 M294 352 L256 342"
              stroke="#FF2A4B"
              strokeOpacity="0.72"
              strokeWidth="1.8"
              strokeLinecap="round"
            />

            {/* Peitoral / Gola Stark feminina em V elegante */}
            <path
              d="M90 402 C95 348 106 312 122 294 L170 330 L218 294 C234 312 245 348 250 402 Z"
              fill="url(#saraArmorPlate)"
              stroke="#00E5FF"
              strokeOpacity="0.7"
              strokeWidth="1.8"
            />
            <path
              d="M124 300 L170 334 L216 300"
              stroke="#00E5FF"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M112 346 L146 364 M228 346 L194 364"
              stroke="#FF2A4B"
              strokeOpacity="0.55"
              strokeWidth="1.3"
              strokeLinecap="round"
            />

            {/* Núcleo Arc Reactor no peito */}
            <g filter="url(#saraSoftGlow)">
              <circle
                cx="170"
                cy="362"
                r={isSpeaking ? 16.5 + voiceAmp * 2.2 : 16}
                fill="#061224"
                stroke="#00E5FF"
                strokeWidth="2"
              />
              <circle
                cx="170"
                cy="362"
                r="11"
                fill={isThinking ? '#FF2A4B' : '#00E5FF'}
                fillOpacity={isSpeaking ? 0.42 + voiceAmp * 0.4 : 0.3}
              />
              <polygon
                points="170,352 179,368 161,368"
                fill="none"
                stroke="#E0F2FE"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="170" cy="362" r="3.6" fill="#FFFFFF" />
            </g>
          </g>

          {/* GRUPO DA CABEÇA FEMININA (com leve balanço natural ao falar) */}
          <g transform={`translate(0, ${speakHeadBob.toFixed(2)}) rotate(${speakHeadRoll.toFixed(2)} 170 155)`}>
            {/* Cabelo-armadura traseiro em camadas fluídas */}
            <path
              d="M170 22
                 C220 22 254 56 258 112
                 C261 154 252 214 236 256
                 L214 246
                 C224 206 230 164 226 120
                 C222 72 198 50 170 50
                 C142 50 118 72 114 120
                 C110 164 116 206 126 246
                 L104 256
                 C88 214 79 154 82 112
                 C86 56 120 22 170 22 Z"
              fill="url(#saraHairMetal)"
              stroke="#00E5FF"
              strokeOpacity="0.48"
              strokeWidth="1.6"
            />

            {/* Transdutores auriculares Stark (esquerda e direita) */}
            <path
              d="M99 124 L86 134 L88 168 L103 178"
              fill="#0E172A"
              stroke="#FF2A4B"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M241 124 L254 134 L252 168 L237 178"
              fill="#0E172A"
              stroke="#FF2A4B"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="92" cy="151" r="2.8" fill="#00E5FF" filter="url(#saraSoftGlow)" />
            <circle cx="248" cy="151" r="2.8" fill="#00E5FF" filter="url(#saraSoftGlow)" />

            {/* Formato oval delicado do rosto humano feminino */}
            <path
              d="M170 52
                 C204 52 228 78 230 118
                 C231 152 222 184 206 207
                 C194 224 182 234 170 235
                 C158 234 146 224 134 207
                 C118 184 109 152 110 118
                 C112 78 136 52 170 52 Z"
              fill="url(#saraSkinBase)"
            />

            {/* Rubor natural nas maçãs do rosto */}
            <ellipse cx="132" cy="156" rx="18" ry="11" fill="url(#saraCheekBlush)" />
            <ellipse cx="208" cy="156" rx="18" ry="11" fill="url(#saraCheekBlush)" />

            {/* Linhas subtis de contorno Stark nas têmporas e maxilar */}
            <path
              d="M112 132 L120 174 L138 206"
              stroke="#00E5FF"
              strokeOpacity="0.24"
              strokeWidth="1"
              strokeLinecap="round"
            />
            <path
              d="M228 132 L220 174 L202 206"
              stroke="#00E5FF"
              strokeOpacity="0.24"
              strokeWidth="1"
              strokeLinecap="round"
            />

            {/* Franja elegante esculpida + micro diadema Stark na testa */}
            <path
              d="M110 114
                 C114 70 138 44 170 44
                 C202 44 226 70 230 114
                 C220 84 200 68 178 65
                 L170 76
                 L162 65
                 C140 68 120 84 110 114 Z"
              fill="url(#saraHairMetal)"
              stroke="#00E5FF"
              strokeOpacity="0.55"
              strokeWidth="1.3"
            />
            {/* Fios neurais luminosos subtis no cabelo */}
            <path
              d="M126 62 Q148 48 166 56 M214 62 Q192 48 174 56"
              stroke="#00E5FF"
              strokeOpacity="0.5"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
            {/* Cristal neural na testa */}
            <polygon
              points="170,54 175,63 170,71 165,63"
              fill={isThinking ? '#FF2A4B' : '#00E5FF'}
              filter="url(#saraSoftGlow)"
            />

            {/* Sobrancelhas femininas naturais com expressão */}
            <path
              d={`M125 ${111 + browLift} Q141 ${102 + browLift} 157 ${110 + browLift * 0.4}`}
              stroke="#1E293B"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <path
              d={`M215 ${111 + browLift} Q199 ${102 + browLift} 183 ${110 + browLift * 0.4}`}
              stroke="#1E293B"
              strokeWidth="2.8"
              strokeLinecap="round"
            />

            {/* OLHO ESQUERDO REALISTA COM ÍRIS SAFIRA-CIANO & PESTANAS */}
            <g>
              <path
                d={`M125 127 Q141 ${127 - eyeRy * 1.4} 156 127 Q141 ${127 + eyeRy * 1.1} 125 127 Z`}
                fill="#F8FAFC"
              />
              {!blink && (
                <g transform={`translate(${gaze.x.toFixed(1)}, ${gaze.y.toFixed(1)})`}>
                  <circle cx="141" cy="126.5" r="5.6" fill="url(#saraIrisGrad)" />
                  <circle cx="141" cy="126.5" r="2.5" fill="#030712" />
                  <circle cx="143" cy="124.5" r="1.3" fill="#FFFFFF" />
                  <circle cx="139" cy="128.2" r="0.6" fill="#E0F2FE" fillOpacity="0.85" />
                </g>
              )}
              {/* Pálpebra e pestanas superiores */}
              <path
                d={
                  blink
                    ? 'M124 127 Q141 130 157 127'
                    : `M123 127 Q141 ${126 - eyeRy * 1.5} 158 127`
                }
                stroke="#0F172A"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              {!blink && (
                <path
                  d="M123 126 L120 123 M127 123 L125 120"
                  stroke="#0F172A"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              )}
            </g>

            {/* OLHO DIREITO REALISTA COM ÍRIS SAFIRA-CIANO & PESTANAS */}
            <g>
              <path
                d={`M184 127 Q199 ${127 - eyeRy * 1.4} 215 127 Q199 ${127 + eyeRy * 1.1} 184 127 Z`}
                fill="#F8FAFC"
              />
              {!blink && (
                <g transform={`translate(${gaze.x.toFixed(1)}, ${gaze.y.toFixed(1)})`}>
                  <circle cx="199" cy="126.5" r="5.6" fill="url(#saraIrisGrad)" />
                  <circle cx="199" cy="126.5" r="2.5" fill="#030712" />
                  <circle cx="201" cy="124.5" r="1.3" fill="#FFFFFF" />
                  <circle cx="197" cy="128.2" r="0.6" fill="#E0F2FE" fillOpacity="0.85" />
                </g>
              )}
              {/* Pálpebra e pestanas superiores */}
              <path
                d={
                  blink
                    ? 'M183 127 Q199 130 216 127'
                    : `M182 127 Q199 ${126 - eyeRy * 1.5} 217 127`
                }
                stroke="#0F172A"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              {!blink && (
                <path
                  d="M217 126 L220 123 M213 123 L215 120"
                  stroke="#0F172A"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              )}
            </g>

            {/* Nariz fino e natural com ponte iluminada */}
            <path
              d="M170 129 L170 159"
              stroke="#FFE4D6"
              strokeOpacity="0.55"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M163 163 Q170 168 177 163"
              stroke="#B57559"
              strokeOpacity="0.82"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="164" cy="162" r="1.1" fill="#8C523B" fillOpacity="0.55" />
            <circle cx="176" cy="162" r="1.1" fill="#8C523B" fillOpacity="0.55" />

            {/* Boca & Lábios com sincronização labial viva ao falar e sorriso acolhedor */}
            <g>
              {/* Cavidade oral ao falar */}
              {mouthGap > 0.5 && (
                <path
                  d={`M155 ${191 - smileLift * 0.25} Q170 ${190 - smileLift * 0.1} 185 ${191 - smileLift * 0.25} Q170 ${192 + mouthGap * 1.15} 155 ${191 - smileLift * 0.25} Z`}
                  fill="#3B0D16"
                />
              )}
              {/* Lábio superior com arco de cupido */}
              <path
                d={`M151 ${191 - smileLift * 0.45} Q162 183 170 186 Q178 183 189 ${191 - smileLift * 0.45} Q178 190 170 190 Q162 190 151 ${191 - smileLift * 0.45} Z`}
                fill="url(#saraLipUpper)"
              />
              {/* Lábio inferior cheio */}
              <path
                d={`M153 ${191 - smileLift * 0.35 + mouthGap * 0.25} Q170 ${192 + mouthGap * 0.85} 187 ${191 - smileLift * 0.35 + mouthGap * 0.25} Q178 ${202 + mouthGap * 0.85 + smileLift * 0.35} 170 ${202 + mouthGap * 0.85 + smileLift * 0.35} Q162 ${202 + mouthGap * 0.85 + smileLift * 0.35} 153 ${191 - smileLift * 0.35 + mouthGap * 0.25} Z`}
                fill="url(#saraLipLower)"
              />
              {/* Brilho sutil no lábio inferior */}
              <path
                d={`M164 ${197 + mouthGap * 0.65} Q170 ${199 + mouthGap * 0.65} 176 ${197 + mouthGap * 0.65}`}
                stroke="#FFE4E6"
                strokeOpacity="0.45"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </g>

            {/* Contorno subtil do queixo */}
            <path
              d="M161 218 Q170 222 179 218"
              stroke="#B57559"
              strokeOpacity="0.4"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </g>
        </svg>

        {/* Feixe de varrimento HUD ao pensar */}
        {isThinking && size !== 'corner' && (
          <div className="pointer-events-none absolute inset-6 overflow-hidden rounded-full">
            <div
              className="w-full h-1 bg-gradient-to-r from-transparent via-[#FF2A4B] to-transparent opacity-75"
              style={{ animation: 'jarvisScan 1.5s ease-in-out infinite' }}
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
