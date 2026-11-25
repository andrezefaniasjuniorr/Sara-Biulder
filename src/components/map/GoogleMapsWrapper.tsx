import React, { useEffect, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { Loader2, WifiOff } from 'lucide-react';

interface GoogleMapsWrapperProps {
  children: React.ReactNode;
}

let cachedResolvedKey: string | null = null;
let inflightKeyPromise: Promise<string> | null = null;

async function resolveMapsKey(): Promise<string> {
  const envKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  if (envKey) {
    cachedResolvedKey = envKey;
    return envKey;
  }
  if (cachedResolvedKey !== null) return cachedResolvedKey;
  if (!inflightKeyPromise) {
    inflightKeyPromise = fetch('/api/maps/client-config')
      .then((res) => (res.ok ? res.json() : { mapsApiKey: '' }))
      .then((data: { mapsApiKey?: string }) => {
        const key = String(data?.mapsApiKey || '').trim();
        cachedResolvedKey = key;
        return key;
      })
      .catch(() => '');
  }
  return inflightKeyPromise;
}

export const GoogleMapsWrapper: React.FC<GoogleMapsWrapperProps> = ({ children }) => {
  const [apiKey, setApiKey] = useState<string>(() => {
    const envKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
    return envKey || cachedResolvedKey || '';
  });
  const [loading, setLoading] = useState<boolean>(() => !apiKey);

  useEffect(() => {
    if (apiKey) {
      setLoading(false);
      return;
    }
    let mounted = true;
    resolveMapsKey().then((k) => {
      if (!mounted) return;
      setApiKey(k);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [apiKey]);

  if (loading) {
    return (
      <div className="w-full h-full min-h-[320px] rounded-2xl bg-[#030815] border border-cyan-500/35 flex flex-col items-center justify-center gap-2 text-cyan-200 text-xs">
        <Loader2 className="w-6 h-6 animate-spin text-[#00E5FF]" />
        <span>A ligar satélite e mapa em tempo real...</span>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="w-full h-full min-h-[320px] rounded-2xl bg-[#030815] border border-amber-500/40 flex flex-col items-center justify-center gap-2 text-amber-200 text-xs p-4 text-center">
        <WifiOff className="w-6 h-6 text-amber-300" />
        <span>Serviço de mapas em espera no Núcleo SARA. Tenta novamente em instantes.</span>
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={apiKey}
      language="pt"
      region="MZ"
      onError={() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      }}
    >
      {children}
    </APIProvider>
  );
};
