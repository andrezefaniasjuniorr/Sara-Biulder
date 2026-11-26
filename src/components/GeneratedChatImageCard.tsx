import React, { useState } from 'react';
import {
  Download,
  RefreshCw,
  UserCheck,
  Sparkles,
  Check,
  Palette,
  Camera,
  Brush,
  Box,
} from 'lucide-react';
import {
  IMAGE_CREATING_MESSAGE,
  IMAGE_STYLE_OPTIONS,
  type SaraImageStyle,
} from '../services/imageGenService';

interface GeneratedChatImageCardProps {
  imageUrl?: string;
  isGenerating?: boolean;
  awaitingStyle?: boolean;
  activeStyle?: SaraImageStyle;
  prompt: string;
  compact?: boolean;
  onSelectStyle: (style: SaraImageStyle) => void;
  onDownload: () => void;
  onRegenerate: () => void;
  onUseAsProfilePhoto: () => Promise<void> | void;
}

const STYLE_ICONS: Record<SaraImageStyle, React.ReactNode> = {
  realistic: <Camera className="w-3.5 h-3.5 text-cyan-300 shrink-0" />,
  drawing: <Brush className="w-3.5 h-3.5 text-purple-300 shrink-0" />,
  pixar3d: <Box className="w-3.5 h-3.5 text-amber-300 shrink-0" />,
};

export const GeneratedChatImageCard: React.FC<GeneratedChatImageCardProps> = ({
  imageUrl,
  isGenerating = false,
  awaitingStyle = false,
  activeStyle = 'realistic',
  prompt,
  compact = false,
  onSelectStyle,
  onDownload,
  onRegenerate,
  onUseAsProfilePhoto,
}) => {
  const [appliedProfile, setAppliedProfile] = useState(false);
  const [pickingNewStyle, setPickingNewStyle] = useState(false);

  if (isGenerating) {
    return (
      <div className="mt-2 rounded-xl border border-cyan-500/40 bg-[#040B1A] p-4 flex flex-col items-center justify-center gap-2.5 text-center shadow-[0_0_24px_rgba(0,229,255,0.12)]">
        <div className="w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-400/50 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-[#00E5FF] animate-spin" />
        </div>
        <div className="text-xs font-bold text-cyan-200 tracking-wide">
          {IMAGE_CREATING_MESSAGE}
        </div>
        {prompt && (
          <div className="text-[11px] text-slate-400 line-clamp-2 max-w-full">{prompt}</div>
        )}
      </div>
    );
  }

  if (awaitingStyle) {
    return (
      <div className="mt-2 rounded-xl border border-cyan-500/35 bg-[#040B1A] p-3 space-y-2.5">
        {prompt && (
          <div className="text-[11px] text-slate-300 line-clamp-2">
            <span className="text-slate-500">Descrição: </span>
            {prompt}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {IMAGE_STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setPickingNewStyle(false);
                onSelectStyle(opt.id);
              }}
              className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition ${
                opt.id === 'realistic'
                  ? 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-400/60 text-cyan-100'
                  : 'bg-[#09162E] hover:bg-purple-500/20 border-purple-500/40 text-slate-100'
              }`}
            >
              {STYLE_ICONS[opt.id]}
              <span>{opt.label}</span>
              {opt.id === 'realistic' && (
                <span className="text-[9px] text-cyan-300/80 font-normal">(Padrão)</span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!imageUrl) return null;

  const handleApplyProfile = async () => {
    await onUseAsProfilePhoto();
    setAppliedProfile(true);
    setTimeout(() => setAppliedProfile(false), 2600);
  };

  return (
    <div className="mt-2 space-y-2.5">
      <div className="rounded-xl overflow-hidden border border-cyan-500/40 bg-[#030814] shadow-[0_8px_28px_rgba(0,229,255,0.14)]">
        <img
          src={imageUrl}
          alt={prompt || 'Imagem gerada pela SARA'}
          className={`w-full ${
            compact ? 'max-h-[340px]' : 'max-h-[440px]'
          } object-contain mx-auto block`}
        />
      </div>

      {pickingNewStyle ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {IMAGE_STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setPickingNewStyle(false);
                onSelectStyle(opt.id);
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition ${
                activeStyle === opt.id
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100'
                  : 'bg-[#09162E] hover:bg-purple-500/20 border-purple-500/40 text-slate-100'
              }`}
            >
              {STYLE_ICONS[opt.id]}
              <span>{opt.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPickingNewStyle(false)}
            className="px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 cursor-pointer transition"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onDownload}
            className="px-2.5 py-1.5 rounded-lg bg-[#09162E] hover:bg-cyan-500/20 border border-cyan-500/40 text-[11px] font-bold text-cyan-100 flex items-center gap-1.5 cursor-pointer transition"
          >
            <Download className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
            <span>Baixar</span>
          </button>

          <button
            type="button"
            onClick={onRegenerate}
            className="px-2.5 py-1.5 rounded-lg bg-[#09162E] hover:bg-purple-500/20 border border-purple-500/40 text-[11px] font-bold text-purple-100 flex items-center gap-1.5 cursor-pointer transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-300 shrink-0" />
            <span>Gerar Outra</span>
          </button>

          <button
            type="button"
            onClick={() => void handleApplyProfile()}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition ${
              appliedProfile
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
                : 'bg-[#09162E] hover:bg-emerald-500/20 border-emerald-500/40 text-emerald-100'
            }`}
          >
            {appliedProfile ? (
              <Check className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            ) : (
              <UserCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            )}
            <span>{appliedProfile ? 'Foto Aplicada' : 'Usar como Foto de Perfil'}</span>
          </button>

          <button
            type="button"
            onClick={() => setPickingNewStyle(true)}
            className="px-2.5 py-1.5 rounded-lg bg-[#09162E] hover:bg-amber-500/20 border border-amber-500/40 text-[11px] font-bold text-amber-100 flex items-center gap-1.5 cursor-pointer transition"
          >
            <Palette className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Mudar Estilo</span>
          </button>
        </div>
      )}
    </div>
  );
};
