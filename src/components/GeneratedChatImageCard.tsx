import React, { useState } from 'react';
import { Download, RefreshCw, UserCheck, Sparkles, Check } from 'lucide-react';
import { IMAGE_CREATING_MESSAGE } from '../services/imageGenService';

interface GeneratedChatImageCardProps {
  imageUrl?: string;
  isGenerating?: boolean;
  prompt: string;
  compact?: boolean;
  onDownload: () => void;
  onRegenerate: () => void;
  onUseAsProfilePhoto: () => Promise<void> | void;
}

export const GeneratedChatImageCard: React.FC<GeneratedChatImageCardProps> = ({
  imageUrl,
  isGenerating = false,
  prompt,
  compact = false,
  onDownload,
  onRegenerate,
  onUseAsProfilePhoto,
}) => {
  const [appliedProfile, setAppliedProfile] = useState(false);

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
          alt={prompt || 'Imagem gerada pelo Núcleo SARA'}
          className={`w-full ${
            compact ? 'max-h-[340px]' : 'max-h-[440px]'
          } object-contain mx-auto block`}
        />
      </div>

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
      </div>
    </div>
  );
};
