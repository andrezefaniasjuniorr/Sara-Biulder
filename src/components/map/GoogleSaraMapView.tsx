import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APILoadingStatus,
  AdvancedMarker,
  ColorScheme,
  Map as GoogleMap,
  useApiIsLoaded,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Crosshair,
  Eye,
  Loader2,
  MapPin,
  Minus,
  Plus,
  Search,
  X,
} from 'lucide-react';
import type {
  GeofenceZone,
  MovementHistoryPoint,
  RadarMapViewMode,
  RadarPlaceResult,
} from '../../types/location';
import { calcDistanceMeters, formatDistancePt } from '../../services/locationRadarService';

export interface SaraMapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  badge?: string;
  tone: 'self' | 'target_locked' | 'peer' | 'place' | 'device_online' | 'device_offline';
  avatarText?: string;
}

export interface ComputedRouteInfo {
  distanceMeters: number;
  durationSeconds: number;
  chapaDurationSeconds: number;
}

interface GoogleSaraMapViewProps {
  centerLat: number | null;
  centerLng: number | null;
  zoom?: number;
  viewMode?: RadarMapViewMode;
  markers: SaraMapMarker[];
  sonarActive?: boolean;
  showPlacesSearch?: boolean;
  movementHistory?: MovementHistoryPoint[];
  showMovementHistory?: boolean;
  geofence?: GeofenceZone | null;
  routeOrigin?: { lat: number; lng: number } | null;
  routeDestination?: { lat: number; lng: number } | null;
  navigationActive?: boolean;
  streetViewTarget?: { lat: number; lng: number; label?: string } | null;
  heightClassName?: string;
  emptyNotice?: string;
  onSelectMarker?: (markerId: string) => void;
  onSelectPlace?: (place: RadarPlaceResult) => void;
  onRouteComputed?: (info: ComputedRouteInfo | null) => void;
  onRecenterMyLocation?: () => void;
  onOpenStreetViewAt?: (lat: number, lng: number, label?: string) => void;
  onCloseStreetView?: () => void;
  onMapClickPoint?: (lat: number, lng: number) => void;
  mapCanvasRef?: React.RefObject<HTMLDivElement | null>;
}

const ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];

function isQuotaError(err: unknown): boolean {
  const txt = String((err as { message?: string })?.message || err || '');
  return /RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|Quota|429/i.test(txt);
}

// =========================================================================
// SUBCOMPONENTE INTERNO DE CAMADAS VETORIAIS (ROTA, HISTÓRICO 2H, ZONA)
// =========================================================================

const MapVectorLayers: React.FC<{
  movementHistory?: MovementHistoryPoint[];
  showMovementHistory?: boolean;
  geofence?: GeofenceZone | null;
  routeOrigin?: { lat: number; lng: number } | null;
  routeDestination?: { lat: number; lng: number } | null;
  navigationActive?: boolean;
  onRouteComputed?: (info: ComputedRouteInfo | null) => void;
}> = ({
  movementHistory,
  showMovementHistory,
  geofence,
  routeOrigin,
  routeDestination,
  navigationActive,
  onRouteComputed,
}) => {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const routesLib = useMapsLibrary('routes');
  const routePolylinesRef = useRef<Array<{ setMap: (m: unknown) => void; setOptions?: (o: Record<string, unknown>) => void }>>([]);
  const historyPolylineRef = useRef<{ setMap: (m: unknown) => void } | null>(null);
  const geofenceCircleRef = useRef<{ setMap: (m: unknown) => void } | null>(null);

  // 1. Rota real via Routes SDK wrapper (sem CORS!)
  useEffect(() => {
    routePolylinesRef.current.forEach((p) => p.setMap(null));
    routePolylinesRef.current = [];

    if (!map || !routesLib || !routeOrigin || !routeDestination) {
      onRouteComputed?.(null);
      return;
    }

    let cancelled = false;
    const request = {
      origin: { lat: routeOrigin.lat, lng: routeOrigin.lng },
      destination: { lat: routeDestination.lat, lng: routeDestination.lng },
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    };

    (routesLib.Route as any)
      .computeRoutes(request)
      .then(({ routes }: { routes: any[] }) => {
        if (cancelled || !routes || routes.length === 0) {
          if (!cancelled) onRouteComputed?.(null);
          return;
        }
        const primaryRoute = routes[0];
        const created = (primaryRoute.createPolylines() || []) as Array<{
          setMap: (m: unknown) => void;
          setOptions: (o: Record<string, unknown>) => void;
        }>;
        created.forEach((pl) => {
          pl.setOptions({
            strokeColor: navigationActive ? '#00E5FF' : '#3B82F6',
            strokeOpacity: 0.94,
            strokeWeight: navigationActive ? 7 : 5,
            zIndex: 40,
          });
          pl.setMap(map);
        });
        routePolylinesRef.current = created;

        if (primaryRoute.viewport && !navigationActive) {
          map.fitBounds(primaryRoute.viewport);
        }

        const distanceMeters = Number(primaryRoute.distanceMeters ?? 0);
        const durationSeconds = Math.max(
          60,
          Math.round(Number(primaryRoute.durationMillis ?? 0) / 1000)
        );
        // Estimativa realista de chapa (paragens + velocidade urbana ~1.55x carro + 3 min espera)
        const chapaDurationSeconds = Math.round(durationSeconds * 1.55 + 180);
        onRouteComputed?.({
          distanceMeters,
          durationSeconds,
          chapaDurationSeconds,
        });
      })
      .catch((err: unknown) => {
        if (isQuotaError(err) && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        if (!cancelled) onRouteComputed?.(null);
      });

    return () => {
      cancelled = true;
      routePolylinesRef.current.forEach((p) => p.setMap(null));
      routePolylinesRef.current = [];
    };
  }, [map, routesLib, routeOrigin, routeDestination, navigationActive, onRouteComputed]);

  // 2. Histórico de Movimento (linha vermelha exclusiva das últimas 2 horas)
  useEffect(() => {
    if (historyPolylineRef.current) {
      historyPolylineRef.current.setMap(null);
      historyPolylineRef.current = null;
    }
    if (!map || !mapsLib || !showMovementHistory || !movementHistory || movementHistory.length < 2) {
      return;
    }

    const line = new (mapsLib as any).Polyline({
      path: movementHistory.map((p) => ({ lat: p.lat, lng: p.lng })),
      geodesic: true,
      strokeColor: '#FF2A4B',
      strokeOpacity: 0.9,
      strokeWeight: 4,
      zIndex: 35,
      map,
    });
    historyPolylineRef.current = line;

    return () => {
      line.setMap(null);
      if (historyPolylineRef.current === line) {
        historyPolylineRef.current = null;
      }
    };
  }, [map, mapsLib, showMovementHistory, movementHistory]);

  // 3. Zona de Alerta (Geofence circular)
  useEffect(() => {
    if (geofenceCircleRef.current) {
      geofenceCircleRef.current.setMap(null);
      geofenceCircleRef.current = null;
    }
    if (!map || !mapsLib || !geofence || !geofence.active) return;

    const isOutside = geofence.lastStatus === 'outside';
    const circle = new (mapsLib as any).Circle({
      map,
      center: { lat: geofence.centerLat, lng: geofence.centerLng },
      radius: geofence.radiusMeters,
      strokeColor: isOutside ? '#FF2A4B' : '#00E5FF',
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillColor: isOutside ? '#FF2A4B' : '#00E5FF',
      fillOpacity: 0.14,
      zIndex: 20,
    });
    geofenceCircleRef.current = circle;

    return () => {
      circle.setMap(null);
      if (geofenceCircleRef.current === circle) {
        geofenceCircleRef.current = null;
      }
    };
  }, [map, mapsLib, geofence]);

  return null;
};

// =========================================================================
// PESQUISA DE LUGARES COM PLACES LIBRARY (NEW AUTOCOMPLETE + TEXT SEARCH)
// =========================================================================

const PlacesSearchHud: React.FC<{
  referenceCoords: { lat: number; lng: number } | null;
  onSelectPlace: (place: RadarPlaceResult) => void;
}> = ({ referenceCoords, onSelectPlace }) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const sessionTokenRef = useRef<any>(null);

  useEffect(() => {
    if (!placesLib) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const handle = window.setTimeout(() => {
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
      }
      setSearching(true);
      (placesLib.AutocompleteSuggestion as any).fetchAutocompleteSuggestions({
        input: trimmed,
        sessionToken: sessionTokenRef.current,
        includedRegionCodes: ['mz'],
        language: 'pt',
        ...(referenceCoords ? { origin: referenceCoords } : {}),
      })
        .then((res: { suggestions?: any[] }) => {
          setSuggestions(res?.suggestions || []);
        })
        .catch((err: unknown) => {
          if (isQuotaError(err) && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
          setSuggestions([]);
        })
        .finally(() => setSearching(false));
    }, 240);

    return () => window.clearTimeout(handle);
  }, [placesLib, query, referenceCoords]);

  const handlePickSuggestion = async (s: any) => {
    if (!placesLib || !s?.placePrediction) return;
    try {
      const place = s.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'viewport', 'primaryTypeDisplayName'],
      });
      sessionTokenRef.current = null;
      setSuggestions([]);
      setQuery(place.displayName || s.placePrediction.text.text || '');

      const loc = place.location;
      if (loc) {
        const lat = loc.lat();
        const lng = loc.lng();
        if (map) {
          if (place.viewport) map.fitBounds(place.viewport);
          else {
            map.panTo({ lat, lng });
            map.setZoom(16);
          }
        }
        onSelectPlace({
          id: place.id || `place_${Date.now()}`,
          name: place.displayName || s.placePrediction.text.text || 'Local',
          address: place.formattedAddress || undefined,
          lat,
          lng,
          distanceMeters: referenceCoords
            ? calcDistanceMeters(referenceCoords.lat, referenceCoords.lng, lat, lng)
            : null,
          categoryLabel: place.primaryTypeDisplayName || undefined,
        });
      }
    } catch (err) {
      if (isQuotaError(err) && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placesLib || !query.trim()) return;
    if (suggestions.length > 0) {
      await handlePickSuggestion(suggestions[0]);
      return;
    }
    setSearching(true);
    try {
      const { places } = await placesLib.Place.searchByText({
        textQuery: query.trim(),
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'viewport', 'primaryTypeDisplayName'],
        region: 'MZ',
        language: 'pt',
        maxResultCount: 5,
        ...(referenceCoords
          ? {
              locationBias: {
                center: referenceCoords,
                radius: 15000,
              },
            }
          : {}),
      });
      if (places && places.length > 0) {
        const first = places[0];
        const loc = first.location;
        if (loc) {
          const lat = loc.lat();
          const lng = loc.lng();
          if (map) {
            map.panTo({ lat, lng });
            map.setZoom(16);
          }
          onSelectPlace({
            id: first.id || `place_${Date.now()}`,
            name: first.displayName || query.trim(),
            address: first.formattedAddress || undefined,
            lat,
            lng,
            distanceMeters: referenceCoords
              ? calcDistanceMeters(referenceCoords.lat, referenceCoords.lng, lat, lng)
              : null,
            categoryLabel: first.primaryTypeDisplayName || undefined,
          });
        }
      }
    } catch (err) {
      if (isQuotaError(err) && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="relative z-20 w-full">
      <form onSubmit={(e) => void handleSearchSubmit(e)} className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-[#00E5FF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar rua, bairro, farmácia..."
            className="w-full pl-8 pr-8 py-2 rounded-xl bg-[#040B1B]/95 border border-cyan-500/45 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#00E5FF] backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.45)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSuggestions([]);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={searching}
          className="px-3 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/60 text-cyan-100 text-xs font-bold hover:bg-cyan-500/30 cursor-pointer flex items-center gap-1"
        >
          {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Ir</span>
        </button>
      </form>

      {suggestions.length > 0 && (
        <ul className="mt-1.5 rounded-xl bg-[#040B1B]/98 border border-cyan-500/45 shadow-2xl overflow-hidden divide-y divide-cyan-500/15 max-h-56 overflow-y-auto sara-scroll">
          {suggestions.map((s, idx) => (
            <li key={`${s.placePrediction?.placeId || idx}`}>
              <button
                type="button"
                onClick={() => void handlePickSuggestion(s)}
                className="w-full px-3 py-2 text-left text-xs hover:bg-cyan-500/15 flex items-center gap-2 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                <span className="text-slate-100 truncate">
                  {s.placePrediction?.text.text || 'Local'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// =========================================================================
// VISTA DE RUA (STREET VIEW PANORAMA REAL)
// =========================================================================

const StreetViewModal: React.FC<{
  target: { lat: number; lng: number; label?: string };
  onClose: () => void;
}> = ({ target, onClose }) => {
  const streetViewLib = useMapsLibrary('streetView');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    if (!streetViewLib || !containerRef.current) return;
    let cancelled = false;
    let pano: { setVisible?: (v: boolean) => void } | null = null;
    setStatus('loading');

    const svc = new streetViewLib.StreetViewService();
    (svc as any)
      .getPanorama({
        location: { lat: target.lat, lng: target.lng },
        radius: 200,
      })
      .then((res: any) => {
        if (cancelled || !containerRef.current) return;
        const loc = res.data?.location?.latLng;
        pano = new streetViewLib.StreetViewPanorama(containerRef.current, {
          position: loc || { lat: target.lat, lng: target.lng },
          pov: { heading: 0, pitch: 5 },
          zoom: 1,
          addressControl: true,
          linksControl: true,
          panControl: true,
          enableCloseButton: false,
          fullscreenControl: false,
        });
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable');
      });

    return () => {
      cancelled = true;
      if (pano) {
        pano.setVisible?.(false);
      }
    };
  }, [streetViewLib, target.lat, target.lng]);

  return (
    <div className="absolute inset-0 z-30 bg-[#020612]/95 flex flex-col">
      <div className="px-3 py-2 bg-[#060E22] border-b border-cyan-500/35 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="w-4 h-4 text-[#00E5FF] shrink-0" />
          <div className="truncate text-xs font-bold text-white">
            Vista de Rua {target.label ? `• ${target.label}` : ''}
          </div>
          <span className="text-[10px] font-mono text-cyan-300 hidden sm:inline">
            ({target.lat.toFixed(5)}, {target.lng.toFixed(5)})
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-rose-500/30"
        >
          <X className="w-3.5 h-3.5" />
          <span>Fechar Vista</span>
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="w-full h-full" />
        {status === 'loading' && (
          <div className="absolute inset-0 bg-[#020612]/80 flex flex-col items-center justify-center gap-2 text-xs text-cyan-200">
            <Loader2 className="w-6 h-6 animate-spin text-[#00E5FF]" />
            <span>A carregar imagem real da rua...</span>
          </div>
        )}
        {status === 'unavailable' && (
          <div className="absolute inset-0 bg-[#020612]/90 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <Eye className="w-7 h-7 text-amber-300" />
            <div className="text-sm font-bold text-white">
              Sem captura panorâmica nesta rua exata
            </div>
            <p className="text-xs text-slate-300 max-w-sm">
              Este ponto não possui registo fotográfico de rua disponível. Muda para a vista &ldquo;Satélite&rdquo; para ver casas, telhados e caminhos reais.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-1 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-100 text-xs font-bold cursor-pointer"
            >
              Voltar ao Mapa
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// CONTROLADOR IMPERATIVO DE CÂMARA & ZOOM (+ / - / MINHA LOCALIZAÇÃO)
// =========================================================================

const CameraAndZoomControls: React.FC<{
  targetCenter: { lat: number; lng: number } | null;
  markers: SaraMapMarker[];
  desiredZoom: number;
  hasActiveTargetPoint: { lat: number; lng: number; label?: string } | null;
  onRecenterMyLocation?: () => void;
  onOpenStreetViewAt?: (lat: number, lng: number, label?: string) => void;
}> = ({
  targetCenter,
  markers,
  desiredZoom,
  hasActiveTargetPoint,
  onRecenterMyLocation,
  onOpenStreetViewAt,
}) => {
  const map = useMap();
  const coreLib = useMapsLibrary('core');
  const lastFocusSignatureRef = useRef<string>('');

  useEffect(() => {
    if (!map) return;
    const valid = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
    const sig = valid.map((m) => `${m.id}:${m.lat.toFixed(4)},${m.lng.toFixed(4)}`).join('|');
    if (sig === lastFocusSignatureRef.current) return;

    if (valid.length > 1) {
      if (!coreLib) return;
      lastFocusSignatureRef.current = sig;
      const bounds = new (coreLib as any).LatLngBounds();
      valid.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
      map.fitBounds(bounds, 64);
    } else if (valid.length === 1) {
      lastFocusSignatureRef.current = sig;
      map.panTo({ lat: valid[0].lat, lng: valid[0].lng });
      if ((map.getZoom() || 0) < desiredZoom) {
        map.setZoom(desiredZoom);
      }
    } else if (targetCenter) {
      lastFocusSignatureRef.current = sig;
      map.panTo(targetCenter);
    }
  }, [map, coreLib, markers, targetCenter, desiredZoom]);

  const handleZoomIn = () => {
    if (!map) return;
    const z = map.getZoom() ?? desiredZoom;
    map.setZoom(Math.min(21, z + 1));
  };

  const handleZoomOut = () => {
    if (!map) return;
    const z = map.getZoom() ?? desiredZoom;
    map.setZoom(Math.max(3, z - 1));
  };

  const handleCenterSelf = () => {
    if (onRecenterMyLocation) onRecenterMyLocation();
    if (map && targetCenter) {
      map.panTo(targetCenter);
      map.setZoom(Math.max(16, map.getZoom() ?? 16));
    }
  };

  return (
    <div className="absolute right-2.5 bottom-3 z-20 flex flex-col gap-1.5">
      {hasActiveTargetPoint && onOpenStreetViewAt && (
        <button
          type="button"
          onClick={() =>
            onOpenStreetViewAt(
              hasActiveTargetPoint.lat,
              hasActiveTargetPoint.lng,
              hasActiveTargetPoint.label
            )
          }
          className="px-2.5 py-2 rounded-xl bg-[#040B1B]/95 border border-[#00E5FF]/60 text-[#00E5FF] text-[11px] font-extrabold shadow-lg hover:bg-cyan-500/20 flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
          title="Abrir Vista de Rua neste ponto"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Ver Rua</span>
        </button>
      )}

      {onRecenterMyLocation && (
        <button
          type="button"
          onClick={handleCenterSelf}
          className="px-2.5 py-2 rounded-xl bg-[#040B1B]/95 border border-cyan-400/60 text-white text-[11px] font-bold shadow-lg hover:bg-cyan-500/20 flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
          title="Centrar na Minha Localização real"
        >
          <Crosshair className="w-3.5 h-3.5 text-[#00E5FF]" />
          <span className="hidden sm:inline">Minha Localização</span>
        </button>
      )}

      <div className="flex flex-col rounded-xl overflow-hidden border border-cyan-500/45 bg-[#040B1B]/95 shadow-lg backdrop-blur-md self-end">
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-2 text-cyan-200 hover:bg-cyan-500/20 border-b border-cyan-500/25 cursor-pointer"
          title="Zoom +"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="p-2 text-cyan-200 hover:bg-cyan-500/20 cursor-pointer"
          title="Zoom -"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// =========================================================================
// COMPONENTE PRINCIPAL GOOGLE MAPS RADAR V2
// =========================================================================

export const GoogleSaraMapView: React.FC<GoogleSaraMapViewProps> = ({
  centerLat,
  centerLng,
  zoom = 15,
  viewMode = 'roadmap',
  markers,
  sonarActive = false,
  showPlacesSearch = true,
  movementHistory,
  showMovementHistory = false,
  geofence,
  routeOrigin,
  routeDestination,
  navigationActive = false,
  streetViewTarget,
  heightClassName = 'h-[360px] sm:h-[420px] lg:h-[480px]',
  emptyNotice,
  onSelectMarker,
  onSelectPlace,
  onRouteComputed,
  onRecenterMyLocation,
  onOpenStreetViewAt,
  onCloseStreetView,
  onMapClickPoint,
  mapCanvasRef,
}) => {
  const isLoaded = useApiIsLoaded();
  const loadingStatus = useApiLoadingStatus();
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number; label?: string } | null>(null);

  useEffect(() => {
    if (
      loadingStatus === APILoadingStatus.AUTH_FAILURE ||
      loadingStatus === APILoadingStatus.FAILED
    ) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    }
  }, [loadingStatus]);

  const validCenter = useMemo(() => {
    if (
      typeof centerLat === 'number' &&
      typeof centerLng === 'number' &&
      Number.isFinite(centerLat) &&
      Number.isFinite(centerLng)
    ) {
      return { lat: centerLat, lng: centerLng };
    }
    const firstValid = markers.find((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
    if (firstValid) return { lat: firstValid.lat, lng: firstValid.lng };
    return null;
  }, [centerLat, centerLng, markers]);

  const selfMarker = useMemo(() => markers.find((m) => m.tone === 'self') || null, [markers]);
  const lockedTarget = useMemo(
    () => markers.find((m) => m.tone === 'target_locked') || markers.find((m) => m.tone === 'peer') || null,
    [markers]
  );

  const activeStreetViewCandidate = useMemo(() => {
    if (selectedPoint) return selectedPoint;
    if (lockedTarget) return { lat: lockedTarget.lat, lng: lockedTarget.lng, label: lockedTarget.title };
    if (selfMarker) return { lat: selfMarker.lat, lng: selfMarker.lng, label: selfMarker.title };
    if (validCenter) return { lat: validCenter.lat, lng: validCenter.lng, label: 'Ponto no Mapa' };
    return null;
  }, [selectedPoint, lockedTarget, selfMarker, validCenter]);

  const handlePlacePick = useCallback(
    (place: RadarPlaceResult) => {
      setSelectedPoint({ lat: place.lat, lng: place.lng, label: place.name });
      onSelectPlace?.(place);
    },
    [onSelectPlace]
  );

  if (!validCenter) {
    return (
      <div
        className={`relative w-full ${heightClassName} rounded-2xl overflow-hidden border border-cyan-500/35 bg-[#030815] flex flex-col items-center justify-center gap-3 p-6 text-center`}
      >
        <div className="w-14 h-14 rounded-full border border-[#00E5FF]/50 bg-cyan-500/10 flex items-center justify-center relative">
          <Crosshair className="w-6 h-6 text-[#00E5FF] animate-pulse" />
        </div>
        <div className="text-xs sm:text-sm font-bold text-white">
          A aguardar localização real do dispositivo
        </div>
        <p className="text-[11px] text-slate-400 max-w-md">
          {emptyNotice ||
            'O Radar SARA não inventa cidades nem coordenadas fixas. Ativa o GPS do teu aparelho para centrar na tua posição real.'}
        </p>
        {onRecenterMyLocation && (
          <button
            type="button"
            onClick={onRecenterMyLocation}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00E5FF] to-emerald-400 text-[#020612] text-xs font-extrabold cursor-pointer"
          >
            Obter Localização Real
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={mapCanvasRef}
      className={`relative w-full ${heightClassName} rounded-2xl overflow-hidden border border-[#00E5FF]/40 bg-[#020612] shadow-[0_0_30px_rgba(0,229,255,0.12)]`}
    >
      {/* Barra de pesquisa de lugares sobre o mapa */}
      {showPlacesSearch && isLoaded && (
        <div className="absolute top-2.5 left-2.5 right-2.5 z-20 max-w-md">
          <PlacesSearchHud
            referenceCoords={selfMarker ? { lat: selfMarker.lat, lng: selfMarker.lng } : validCenter}
            onSelectPlace={handlePlacePick}
          />
        </div>
      )}

      {/* Cantos futuristas do HUD */}
      <div className="pointer-events-none absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#00E5FF] z-10" />
      <div className="pointer-events-none absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#00E5FF] z-10" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#8B5CF6] z-10" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#8B5CF6] z-10" />

      {!isLoaded && (
        <div className="absolute inset-0 z-10 bg-[#020612]/90 flex flex-col items-center justify-center gap-2 text-xs text-cyan-200">
          <Loader2 className="w-6 h-6 animate-spin text-[#00E5FF]" />
          <span>A inicializar Radar SARA V2...</span>
        </div>
      )}

      <GoogleMap
        mapId="DEMO_MAP_ID"
        colorScheme={ColorScheme.DARK}
        mapTypeId={viewMode}
        defaultCenter={validCenter}
        defaultZoom={zoom}
        gestureHandling="greedy"
        disableDefaultUI={true}
        internalUsageAttributionIds={ATTRIBUTION_IDS}
        className="w-full h-full"
        onClick={(ev) => {
          const ll = ev.detail?.latLng;
          if (ll) {
            setSelectedPoint({ lat: ll.lat, lng: ll.lng, label: 'Ponto selecionado' });
            onMapClickPoint?.(ll.lat, ll.lng);
          }
        }}
      >
        <MapVectorLayers
          movementHistory={movementHistory}
          showMovementHistory={showMovementHistory}
          geofence={geofence}
          routeOrigin={routeOrigin}
          routeDestination={routeDestination}
          navigationActive={navigationActive}
          onRouteComputed={onRouteComputed}
        />

        <CameraAndZoomControls
          targetCenter={selfMarker ? { lat: selfMarker.lat, lng: selfMarker.lng } : validCenter}
          markers={markers}
          desiredZoom={zoom}
          hasActiveTargetPoint={activeStreetViewCandidate}
          onRecenterMyLocation={onRecenterMyLocation}
          onOpenStreetViewAt={onOpenStreetViewAt}
        />

        {/* Marcadores principais */}
        {markers
          .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
          .map((m) => {
            if (m.tone === 'self') {
              return (
                <AdvancedMarker
                  key={m.id}
                  position={{ lat: m.lat, lng: m.lng }}
                  zIndex={60}
                  onClick={() => {
                    setSelectedPoint({ lat: m.lat, lng: m.lng, label: m.title });
                    onSelectMarker?.(m.id);
                  }}
                >
                  <div className="relative flex items-center justify-center">
                    {sonarActive && (
                      <>
                        <span className="sara-sonar-ring absolute left-1/2 top-1/2 w-12 h-12 rounded-full border-2 border-[#00E5FF]/80 pointer-events-none" />
                        <span className="sara-sonar-ring-delay absolute left-1/2 top-1/2 w-12 h-12 rounded-full border border-[#8B5CF6]/70 pointer-events-none" />
                        <span className="sara-sonar-ring-delay-2 absolute left-1/2 top-1/2 w-12 h-12 rounded-full border border-[#00E5FF]/50 pointer-events-none" />
                      </>
                    )}
                    <div className="flex flex-col items-center -translate-y-1">
                      <div className="px-2 py-0.5 rounded-md bg-[#040B1B]/95 border border-[#00E5FF] text-[10px] font-mono font-extrabold text-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.6)] whitespace-nowrap mb-1">
                        {m.badge || 'TU'}
                      </div>
                      <div className="relative w-4 h-4 rounded-full bg-[#00E5FF] border-2 border-white shadow-[0_0_16px_#00E5FF] sara-pulse-dot" />
                    </div>
                  </div>
                </AdvancedMarker>
              );
            }

            if (m.tone === 'target_locked') {
              return (
                <AdvancedMarker
                  key={m.id}
                  position={{ lat: m.lat, lng: m.lng }}
                  zIndex={70}
                  onClick={() => {
                    setSelectedPoint({ lat: m.lat, lng: m.lng, label: m.title });
                    onSelectMarker?.(m.id);
                  }}
                >
                  <div className="relative flex flex-col items-center">
                    <span className="sara-sonar-ring absolute left-1/2 top-1/2 w-14 h-14 rounded-full border-2 border-[#FF2A4B]/90 pointer-events-none" />
                    <div className="px-2.5 py-1 rounded-lg bg-[#1A050B]/95 border border-[#FF2A4B] text-[10px] font-mono font-extrabold text-white shadow-[0_0_18px_rgba(255,42,75,0.75)] whitespace-nowrap mb-1 flex items-center gap-1.5">
                      {m.avatarText && (
                        <span className="w-4 h-4 rounded-full bg-[#FF2A4B] text-white text-[9px] flex items-center justify-center font-black">
                          {m.avatarText}
                        </span>
                      )}
                      <span>{m.badge || m.title}</span>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-[#FF2A4B] border-2 border-white shadow-[0_0_20px_#FF2A4B] animate-pulse" />
                  </div>
                </AdvancedMarker>
              );
            }

            const palette: Record<
              Exclude<SaraMapMarker['tone'], 'self' | 'target_locked'>,
              { bg: string; border: string; text: string }
            > = {
              peer: { bg: '#10B981', border: '#A7F3D0', text: '#020612' },
              place: { bg: '#8B5CF6', border: '#DDD6FE', text: '#FFFFFF' },
              device_online: { bg: '#00E5FF', border: '#FFFFFF', text: '#020612' },
              device_offline: { bg: '#FF2A4B', border: '#FECDD3', text: '#FFFFFF' },
            };
            const pal = palette[m.tone];

            return (
              <AdvancedMarker
                key={m.id}
                position={{ lat: m.lat, lng: m.lng }}
                zIndex={50}
                onClick={() => {
                  setSelectedPoint({ lat: m.lat, lng: m.lng, label: m.title });
                  onSelectMarker?.(m.id);
                }}
              >
                <div className="flex flex-col items-center">
                  <div
                    style={{
                      backgroundColor: pal.bg,
                      borderColor: pal.border,
                      color: pal.text,
                    }}
                    className="px-2 py-0.5 rounded-md border text-[10px] font-extrabold shadow-lg whitespace-nowrap mb-1"
                  >
                    {m.badge || m.title}
                  </div>
                  <div
                    style={{ backgroundColor: pal.bg }}
                    className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-md"
                  />
                </div>
              </AdvancedMarker>
            );
          })}

        {/* Pontos de horário do histórico de movimento (últimas 2h) */}
        {showMovementHistory &&
          movementHistory &&
          movementHistory
            .filter((_, idx) => idx === 0 || idx === movementHistory.length - 1 || idx % 4 === 0)
            .map((pt, idx) => {
              const hhmm = new Date(pt.timestamp).toLocaleTimeString('pt-PT', {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <AdvancedMarker
                  key={`hist_${pt.timestamp}_${idx}`}
                  position={{ lat: pt.lat, lng: pt.lng }}
                  zIndex={45}
                >
                  <div className="px-1.5 py-0.5 rounded bg-[#1F060D]/95 border border-[#FF2A4B]/80 text-[9px] font-mono text-rose-200 shadow">
                    {hhmm}
                  </div>
                </AdvancedMarker>
              );
            })}

        {/* Marcador temporário de ponto clicado para Ver Rua / Zona */}
        {selectedPoint &&
          !markers.some(
            (m) => calcDistanceMeters(m.lat, m.lng, selectedPoint.lat, selectedPoint.lng) < 8
          ) && (
            <AdvancedMarker position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }} zIndex={55}>
              <div className="flex flex-col items-center">
                <div className="px-2 py-0.5 rounded bg-[#071125]/95 border border-[#8B5CF6] text-[10px] font-bold text-purple-200 whitespace-nowrap mb-1">
                  {selectedPoint.label || 'Ponto Selecionado'}
                </div>
                <div className="w-3.5 h-3.5 rounded-full bg-[#8B5CF6] border-2 border-white shadow-[0_0_12px_#8B5CF6]" />
              </div>
            </AdvancedMarker>
          )}
      </GoogleMap>

      {/* Overlay de Vista de Rua (Street View Real) */}
      {streetViewTarget && onCloseStreetView && (
        <StreetViewModal target={streetViewTarget} onClose={onCloseStreetView} />
      )}

      {/* Aviso discreto quando mapa está privado e vazio */}
      {emptyNotice && markers.length === 0 && !selectedPoint && (
        <div className="pointer-events-none absolute bottom-3 left-3 right-28 px-3 py-2 rounded-xl bg-[#030815]/92 border border-cyan-500/35 text-[11px] text-cyan-100 backdrop-blur-md">
          {emptyNotice}
        </div>
      )}

      {/* Ponto selecionado: barra rápida com distância até ti */}
      {selectedPoint && selfMarker && (
        <div className="absolute bottom-3 left-3 z-20 px-2.5 py-1.5 rounded-xl bg-[#040B1B]/95 border border-[#8B5CF6]/60 text-[10px] font-mono text-purple-100 flex items-center gap-2 backdrop-blur-md">
          <span className="truncate max-w-[160px]">{selectedPoint.label || 'Ponto'}</span>
          <span className="text-[#00E5FF]">
            {formatDistancePt(
              calcDistanceMeters(selfMarker.lat, selfMarker.lng, selectedPoint.lat, selectedPoint.lng)
            )}
          </span>
          {onOpenStreetViewAt && (
            <button
              type="button"
              onClick={() =>
                onOpenStreetViewAt(selectedPoint.lat, selectedPoint.lng, selectedPoint.label)
              }
              className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-100 font-bold cursor-pointer"
            >
              Ver Rua
            </button>
          )}
        </div>
      )}
    </div>
  );
};
