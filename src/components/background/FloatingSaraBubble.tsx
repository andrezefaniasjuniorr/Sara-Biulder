import React, { useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Send,
  X,
  Power,
  Maximize2,
  MessageSquare,
  VolumeX,
  Sparkles,
} from 'lucide-react';

interface FloatingSaraBubbleProps {
  visible: boolean;
  isPc: boolean;
  isListening: boolean;
  isSaraSpeaking: boolean;
  backgroundActive: boolean;
  latestReply: string;
  onToggleMic: () => void;
  onSilenceSara: () => void;
  onSendPrompt: (text: string) => void;
  onStopBackground: () => void;
  onDismissBubble: () => void;
  onRestoreFullWindow: () => void;
}

export const FloatingSaraBubble: React.FC<FloatingSaraBubbleProps> = ({
  visible,
  isPc,
  isListening,
  isSaraSpeaking,
  backgroundActive,
  latestReply,
  onToggleMic,
  onSilenceSara,
  onSendPrompt,
  onStopBackground,
  onDismissBubble,
  onRestoreFullWindow,
}) => {
  const [expanded, setExpanded] = useState(isPc && backgroundActive);
  const [miniInput, setMiniInput] = useState('');
  const [dragging, setDragging] = useState(false);
  const [corner, setCorner] = useState<'br' | 'bl' | 'tr' | 'tl'>('br');
  const [nearCloseZone, setNearCloseZone] = useState(false);

  const orbRef = useRef<HTMLButtonElement | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    moved: boolean;
  }>({ active: false, startX: 0, startY: 0, moved: false });

  if (!visible) return null;

  const cornerClass =
    corner === 'br'
      ? 'bottom-16 right-4'
      : corner === 'bl'
      ? 'bottom-16 left-4'
      : corner === 'tr'
      ? 'top-20 right-4'
      : 'top-20 left-4';

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const st = dragStateRef.current;
    if (!st.active) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      st.moved = true;
      setDragging(true);
    }
    if (st.moved && orbRef.current) {
      orbRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      const vh = window.innerHeight || 800;
      const vw = window.innerWidth || 400;
      const closeX = Math.abs(e.clientX - vw / 2) < 90;
      const closeY = e.clientY > vh - 110;
      setNearCloseZone(closeX && closeY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const st = dragStateRef.current;
    if (!st.active) return;
    st.active = false;
    if (orbRef.current) {
      orbRef.current.style.transform = '';
    }
    if (!st.moved) {
      setDragging(false);
      setNearCloseZone(false);
      setExpanded((v) => !v);
      return;
    }

    const vw = window.innerWidth || 400;
    const vh = window.innerHeight || 800;
    const closeX = Math.abs(e.clientX - vw / 2) < 90;
    const closeY = e.clientY > vh - 110;
    setDragging(false);
    setNearCloseZone(false);

    if (closeX && closeY) {
      onDismissBubble();
      return;
    }

    const horiz = e.clientX < vw / 2 ? 'l' : 'r';
    const vert = e.clientY < vh / 2 ? 't' : 'b';
    setCorner(`${vert}${horiz}` as 'br' | 'bl' | 'tr' | 'tl');
  };

  const handleSendMini = (e: React.FormEvent) => {
    e.preventDefault();
    const txt = miniInput.trim();
    if (!txt) return;
    onSendPrompt(txt);
    setMiniInput('');
  };

  return (
    <>
      {/* Zona de fecho ao arrastar a bolha no celular / PC */}
      {dragging && (
        <div
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[88] px-4 py-2 rounded-full border text-xs font-bold flex items-center gap-1.5 transition ${
            nearCloseZone
              ? 'bg-rose-600 border-rose-300 text-white scale-105 shadow-[0_0_24px_rgba(255,42,75,0.65)]'
              : 'bg-[#071126]/95 border-rose-500/50 text-rose-200'
          }`}
        >
          <X className="w-4 h-4" />
          <span>Arrasta aqui para fechar</span>
        </div>
      )}

      {/* Mini-janela compacta no canto inferior direito (PC) ou expansível ao tocar na bolha (Celular) */}
      {expanded ? (
        <div className="fixed bottom-14 right-4 z-[85] w-[310px] sm:w-[335px] rounded-2xl bg-[#040B1A]/98 border border-[#00E5FF]/55 shadow-[0_12px_40px_rgba(0,229,255,0.28)] overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-[#030814] border-b border-cyan-500/25 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isSaraSpeaking
                    ? 'bg-rose-400 animate-ping'
                    : isListening
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-cyan-400'
                }`}
              />
              <span className="text-xs font-extrabold text-cyan-100 truncate">
                SARA {backgroundActive ? '• 2.º Plano' : '• Mini'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onRestoreFullWindow}
                className="p-1 rounded-lg text-cyan-300 hover:bg-cyan-500/20 cursor-pointer"
                title="Voltar à conversa completa"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                title="Recolher para bolha flutuante"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-3 space-y-2.5">
            <div className="p-2.5 rounded-xl bg-[#071125] border border-cyan-500/25 text-xs text-slate-200 max-h-24 overflow-y-auto sara-scroll">
              {latestReply || 'Estou pronta! Diz "Ei SARA", usa CTRL + ESPAÇO ou escreve aqui.'}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleMic}
                className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                  isListening
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-cyan-500/15 border-cyan-400/50 text-cyan-100'
                }`}
              >
                {isListening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                <span>{isListening ? 'A Ouvir' : 'Falar'}</span>
              </button>

              {isSaraSpeaking && (
                <button
                  type="button"
                  onClick={onSilenceSara}
                  className="px-2.5 py-2 rounded-xl bg-rose-500/20 border border-rose-400/60 text-rose-200 text-xs font-bold cursor-pointer"
                  title="Calar SARA"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                </button>
              )}

              {backgroundActive && (
                <button
                  type="button"
                  onClick={onStopBackground}
                  className="px-2.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/45 text-rose-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-rose-500/25"
                  title="Parar Segundo Plano"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Parar</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSendMini} className="flex items-center gap-1.5">
              <input
                type="text"
                value={miniInput}
                onChange={(e) => setMiniInput(e.target.value)}
                placeholder="Escreve à SARA..."
                className="flex-1 min-w-0 px-2.5 py-2 rounded-xl bg-[#030815] border border-cyan-500/35 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#00E5FF]"
              />
              <button
                type="submit"
                className="p-2 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#FF2A4B] text-[#020612] font-bold cursor-pointer"
                title="Enviar"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            {isPc && (
              <div className="text-[10px] font-mono text-slate-400 text-center">
                Atalho PC: CTRL + ESPAÇO para acordar a SARA
              </div>
            )}
          </div>
        </div>
      ) : (
        <button
          ref={orbRef}
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          title='Bolha Flutuante da SARA — clica para chat rápido ou arrasta (arrasta ao centro em baixo para fechar)'
          className={`fixed ${cornerClass} z-[85] w-13 h-13 rounded-full bg-gradient-to-br from-[#00E5FF] via-[#081A38] to-[#FF2A4B] p-[2px] shadow-[0_0_24px_rgba(0,229,255,0.45)] cursor-grab active:cursor-grabbing touch-none select-none`}
        >
          <div className="w-full h-full rounded-full bg-[#030814] flex flex-col items-center justify-center relative">
            <Sparkles className="w-5 h-5 text-[#00E5FF]" />
            <span className="text-[8px] font-mono font-extrabold text-cyan-200 tracking-tighter">
              SARA
            </span>
            <span
              className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border border-[#030814] ${
                isListening ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'
              }`}
            />
            <MessageSquare className="hidden" />
          </div>
        </button>
      )}
    </>
  );
};
