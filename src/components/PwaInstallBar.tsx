import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PwaInstallBarProps {
  onNotify?: (msg: string) => void;
}

export const PwaInstallBar: React.FC<PwaInstallBarProps> = ({ onNotify }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);

  if (isInstalled || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        onNotify?.('SARA BIULDER instalada como App!');
      }
      return;
    }
    if (isIOS) {
      setShowManualGuide(true);
      return;
    }
    setShowManualGuide(true);
  };

  return (
    <>
      <div
        role="region"
        aria-label="Instalar SARA BIULDER"
        className="shrink-0 bg-[#12121A] border-t border-[#1F1F2E] px-3 py-1.5 flex items-center justify-between gap-2 text-xs z-30"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center shrink-0">
            <Smartphone className="w-3 h-3 text-white" />
          </div>
          <span className="font-semibold text-white truncate">Instalar SARA BIULDER</span>
          <span className="hidden sm:inline text-[11px] text-[#A1A1AA] truncate">
            App nativo para PC e telemóvel (tela cheia + offline)
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:opacity-95 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition"
          >
            <Download className="w-3 h-3" />
            <span>Instalar</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg bg-[#0A0A0F] border border-[#1F1F2E] text-[#A1A1AA] hover:text-white cursor-pointer"
            title="Fechar barra de instalação"
            aria-label="Fechar barra de instalação"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showManualGuide && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#12121A] border border-[#1F1F2E] p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Instalar SARA BIULDER</h3>
              <button
                type="button"
                onClick={() => setShowManualGuide(false)}
                className="p-1 rounded-lg text-[#A1A1AA] hover:text-white cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {isIOS ? (
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                1. Toca no ícone <strong>Partilhar</strong> na barra do Safari.
                <br />
                2. Escolhe <strong>Adicionar ao Ecrã Inicial</strong> para abrir em tela cheia.
              </p>
            ) : (
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Abre o endereço direto do app no Chrome ou Edge e clica no ícone{' '}
                <strong>Instalar aplicação</strong> na barra de endereço (ou no menu do navegador →{' '}
                <strong>Instalar SARA BIULDER</strong>) para abrir como app nativo sem barra do navegador.
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowManualGuide(false)}
              className="w-full py-2 rounded-xl bg-[#3B82F6] text-white text-xs font-semibold cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
