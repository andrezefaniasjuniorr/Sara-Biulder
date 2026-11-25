import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle,
  LayersControl,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { Crosshair, Loader2, MapPin, Minus, Plus, Search, X } from 'lucide-react';
import type {
  GeofenceZone,
  MovementHistoryPoint,
  RadarMapViewMode,
  RadarPlaceResult,
} from '../../types/location';
import {
  calcDistanceMeters,
  computeFreeRadarRoute,
  formatDistancePt,
  searchFreeRadarPlacesDetailed,
} from '../../services/locationRadarService';
import {
  L,
  HeatLayer,
  MarkerClusterGroup,
  GeocoderControl,
  geocoders,
  ensureLeafletRoutingMachine,
} from './leafletPlugins';

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

interface FreeSaraMapViewProps {
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
  onViewModeChange?: (mode: RadarMapViewMode) => void;
  onRouteComputed?: (info: ComputedRouteInfo | null) => void;
  onRecenterMyLocation?: () => void;
  onOpenStreetViewAt?: (lat: number, lng: number, label?: string) => void;
  onCloseStreetView?: () => void;
  onMapClickPoint?: (lat: number, lng: number) => void;
  mapCanvasRef?: React.RefObject<HTMLDivElement | null>;
}

type BaseLayerKey =
  | 'roadmap_dark'
  | 'roadmap_osm'
  | 'hybrid_esri'
  | 'terrain_topo'
  | 'terrain_esri';

const BASE_LAYER_NAMES: Record<BaseLayerKey, string> = {
  roadmap_dark: 'Ruas (SARA Dark)',
  roadmap_osm: 'Ruas (OpenStreetMap)',
  hybrid_esri: 'Satélite (Esri)',
  terrain_topo: 'Terreno (OpenTopoMap)',
  terrain_esri: 'Terreno (Esri Topo)',
};

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDivIconForMarker(m: SaraMapMarker, sonarActive: boolean): L.DivIcon {
  const safeBadge = escapeHtml(m.badge || m.title);
  const safeAvatar = escapeHtml((m.avatarText || '').slice(0, 2));

  if (m.tone === 'self') {
    const rings = sonarActive
      ? `<span class="sara-sonar-ring" style="position:absolute;left:50%;top:50%;width:48px;height:48px;border-radius:9999px;border:2px solid rgba(0,229,255,0.85);pointer-events:none;"></span>
         <span class="sara-sonar-ring-delay" style="position:absolute;left:50%;top:50%;width:48px;height:48px;border-radius:9999px;border:1px solid rgba(139,92,246,0.75);pointer-events:none;"></span>
         <span class="sara-sonar-ring-delay-2" style="position:absolute;left:50%;top:50%;width:48px;height:48px;border-radius:9999px;border:1px solid rgba(0,229,255,0.5);pointer-events:none;"></span>`
      : `<span class="sara-sonar-ring" style="position:absolute;left:50%;top:50%;width:38px;height:38px;border-radius:9999px;border:2px solid rgba(0,229,255,0.65);pointer-events:none;"></span>`;

    return L.divIcon({
      className: 'sara-leaflet-marker',
      iconSize: [120, 48],
      iconAnchor: [60, 34],
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          ${rings}
          <div style="padding:2px 7px;border-radius:6px;background:rgba(4,11,27,0.95);border:1px solid #00E5FF;color:#00E5FF;font:800 10px/1.2 monospace;white-space:nowrap;margin-bottom:4px;box-shadow:0 0 12px rgba(0,229,255,0.6);">${safeBadge || 'TU'}</div>
          <div class="sara-pulse-dot" style="width:16px;height:16px;border-radius:9999px;background:#00E5FF;border:2px solid #FFFFFF;box-shadow:0 0 18px #00E5FF;"></div>
        </div>
      `,
    });
  }

  if (m.tone === 'target_locked') {
    return L.divIcon({
      className: 'sara-leaflet-marker',
      iconSize: [160, 56],
      iconAnchor: [80, 42],
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <span class="sara-sonar-ring" style="position:absolute;left:50%;top:55%;width:56px;height:56px;border-radius:9999px;border:2px solid rgba(255,42,75,0.9);pointer-events:none;"></span>
          <span class="sara-sonar-ring-delay" style="position:absolute;left:50%;top:55%;width:56px;height:56px;border-radius:9999px;border:1px solid rgba(139,92,246,0.8);pointer-events:none;"></span>
          <div style="padding:3px 8px;border-radius:8px;background:rgba(26,5,11,0.96);border:1px solid #FF2A4B;color:#FFFFFF;font:800 10px/1.2 monospace;white-space:nowrap;margin-bottom:4px;box-shadow:0 0 18px rgba(255,42,75,0.75);display:flex;align-items:center;gap:5px;">
            ${safeAvatar ? `<span style="width:15px;height:15px;border-radius:9999px;background:#FF2A4B;color:#fff;font-size:9px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;">${safeAvatar}</span>` : ''}
            <span>${safeBadge}</span>
          </div>
          <div class="sara-pulse-dot" style="width:18px;height:18px;border-radius:9999px;background:#FF2A4B;border:2px solid #FFFFFF;box-shadow:0 0 22px #FF2A4B;"></div>
        </div>
      `,
    });
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

  return L.divIcon({
    className: 'sara-leaflet-marker',
    iconSize: [140, 44],
    iconAnchor: [70, 34],
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="padding:2px 7px;border-radius:6px;background:${pal.bg};border:1px solid ${pal.border};color:${pal.text};font:800 10px/1.2 sans-serif;white-space:nowrap;margin-bottom:4px;box-shadow:0 4px 12px rgba(0,0,0,0.5);">${safeBadge}</div>
        <div style="width:14px;height:14px;border-radius:9999px;background:${pal.bg};border:2px solid #FFFFFF;box-shadow:0 0 10px ${pal.bg};"></div>
      </div>
    `,
  });
}

interface LeafletBridgeProps {
  mapRef: React.MutableRefObject<L.Map | null>;
  validCenter: { lat: number; lng: number };
  zoom: number;
  markers: SaraMapMarker[];
  sonarActive: boolean;
  selectedPoint: { lat: number; lng: number; label?: string } | null;
  movementHistory?: MovementHistoryPoint[];
  showMovementHistory: boolean;
  heatOverlayActive: boolean;
  routeOrigin?: { lat: number; lng: number } | null;
  routeDestination?: { lat: number; lng: number } | null;
  navigationActive: boolean;
  streetViewTarget?: { lat: number; lng: number; label?: string } | null;
  onMapClickPoint: (lat: number, lng: number) => void;
  onSelectMarker?: (markerId: string) => void;
  onSelectPlace?: (place: RadarPlaceResult) => void;
  onLayerChangedByControl: (layerName: string) => void;
  onHeatOverlayToggle: (active: boolean) => void;
  onRouteComputed?: (info: ComputedRouteInfo | null) => void;
  onFallbackRoutePath: (path: Array<[number, number]> | null) => void;
}

const SaraLeafletBridge: React.FC<LeafletBridgeProps> = ({
  mapRef,
  validCenter,
  zoom,
  markers,
  sonarActive,
  selectedPoint,
  movementHistory,
  showMovementHistory,
  heatOverlayActive,
  routeOrigin,
  routeDestination,
  navigationActive,
  streetViewTarget,
  onMapClickPoint,
  onSelectMarker,
  onSelectPlace,
  onLayerChangedByControl,
  onHeatOverlayToggle,
  onRouteComputed,
  onFallbackRoutePath,
}) => {
  const map = useMap();
  const priorityLayerRef = useRef<L.LayerGroup | null>(null);
  const clusterLayerRef = useRef<MarkerClusterGroup | null>(null);
  const selectedMarkerRef = useRef<L.Marker | null>(null);
  const historyLabelsLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<HeatLayer | null>(null);
  const routingControlRef = useRef<L.Routing.RoutingControl | null>(null);
  const lastFocusSignatureRef = useRef<string>('');

  // Regista referência do mapa e configura prefixo, geocoder plugin, cluster e layers
  useEffect(() => {
    mapRef.current = map;
    map.attributionControl?.setPrefix('Núcleo SARA');

    const priorityGroup = L.layerGroup().addTo(map);
    const historyLabels = L.layerGroup().addTo(map);
    const clusterGroup = new MarkerClusterGroup({
      maxClusterRadius: 42,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="sara-cluster-badge">${count}</div>`,
          className: 'sara-leaflet-marker',
          iconSize: [38, 38],
        });
      },
    });
    map.addLayer(clusterGroup as unknown as L.Layer);

    // Controlo Leaflet Geocoder focado em Moçambique (Nominatim MZ)
    const mzNominatim = new geocoders.Nominatim({
      geocodingQueryParams: {
        countrycodes: 'mz',
        'accept-language': 'pt',
        viewbox: '32.30,-26.15,32.78,-25.75',
      },
    });
    const geocoderCtrl = new GeocoderControl({
      position: 'bottomleft',
      collapsed: true,
      expand: 'click',
      placeholder: 'Buscar em Moçambique...',
      errorMessage: 'Não encontrado em Moçambique',
      defaultMarkGeocode: false,
      geocoder: mzNominatim,
    }).addTo(map);

    geocoderCtrl.on(
      'markgeocode',
      (ev: { geocode?: { center?: L.LatLng; name?: string; html?: string } }) => {
        const center = ev.geocode?.center;
        const name = ev.geocode?.name || 'Lugar em Moçambique';
        if (!center) return;
        map.flyTo([center.lat, center.lng], 16, { duration: 0.6 });
        onSelectPlace?.({
          id: `ctrl_${Date.now()}`,
          name,
          address: ev.geocode?.html || name,
          lat: center.lat,
          lng: center.lng,
          distanceMeters: null,
        });
      }
    );

    priorityLayerRef.current = priorityGroup;
    historyLabelsLayerRef.current = historyLabels;
    clusterLayerRef.current = clusterGroup;

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 140);

    return () => {
      window.clearTimeout(resizeTimer);
      geocoderCtrl.remove();
      map.removeLayer(priorityGroup);
      map.removeLayer(historyLabels);
      map.removeLayer(clusterGroup as unknown as L.Layer);
      if (selectedMarkerRef.current) {
        map.removeLayer(selectedMarkerRef.current);
        selectedMarkerRef.current = null;
      }
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current as unknown as L.Layer);
        heatLayerRef.current = null;
      }
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
        routingControlRef.current = null;
      }
      priorityLayerRef.current = null;
      historyLabelsLayerRef.current = null;
      clusterLayerRef.current = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Eventos do mapa (click + baselayerchange + overlays)
  useMapEvents({
    click(ev) {
      onMapClickPoint(ev.latlng.lat, ev.latlng.lng);
    },
    baselayerchange(ev) {
      if (ev?.name) {
        onLayerChangedByControl(ev.name);
      }
    },
    overlayadd(ev) {
      if (ev?.name === 'Mapa de Calor & Zonas') {
        onHeatOverlayToggle(true);
      }
    },
    overlayremove(ev) {
      if (ev?.name === 'Mapa de Calor & Zonas') {
        onHeatOverlayToggle(false);
      }
    },
  });

  // Marcadores (self + target_locked sempre visíveis; demais em MarkerClusterGroup)
  useEffect(() => {
    const priorityGroup = priorityLayerRef.current;
    const clusterGroup = clusterLayerRef.current;
    if (!priorityGroup || !clusterGroup) return;

    priorityGroup.clearLayers();
    clusterGroup.clearLayers();

    const valid = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
    const clusteredToAdd: L.Marker[] = [];

    valid.forEach((m) => {
      const marker = L.marker([m.lat, m.lng], {
        icon: buildDivIconForMarker(m, sonarActive),
        zIndexOffset: m.tone === 'target_locked' ? 600 : m.tone === 'self' ? 500 : 200,
      });
      marker.on('click', () => {
        onSelectMarker?.(m.id);
      });

      if (m.tone === 'self' || m.tone === 'target_locked') {
        marker.addTo(priorityGroup);
      } else {
        clusteredToAdd.push(marker);
      }
    });

    if (clusteredToAdd.length > 0) {
      clusterGroup.addLayers(clusteredToAdd);
    }

    const sig = valid.map((m) => `${m.id}:${m.lat.toFixed(4)},${m.lng.toFixed(4)}`).join('|');
    if (sig !== lastFocusSignatureRef.current) {
      if (valid.length > 1) {
        lastFocusSignatureRef.current = sig;
        const bounds = L.latLngBounds(valid.map((m) => [m.lat, m.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [52, 52], maxZoom: 16 });
      } else if (valid.length === 1) {
        lastFocusSignatureRef.current = sig;
        map.setView([valid[0].lat, valid[0].lng], Math.max(map.getZoom(), zoom));
      } else {
        lastFocusSignatureRef.current = sig;
        map.setView([validCenter.lat, validCenter.lng], zoom);
      }
    }
  }, [markers, sonarActive, validCenter, zoom, map, onSelectMarker]);

  // Marcador do ponto clicado no mapa
  useEffect(() => {
    if (selectedMarkerRef.current) {
      map.removeLayer(selectedMarkerRef.current);
      selectedMarkerRef.current = null;
    }
    if (
      selectedPoint &&
      !markers.some(
        (m) => calcDistanceMeters(m.lat, m.lng, selectedPoint.lat, selectedPoint.lng) < 8
      )
    ) {
      const safeLabel = escapeHtml(selectedPoint.label || 'Ponto Selecionado');
      const icon = L.divIcon({
        className: 'sara-leaflet-marker',
        iconSize: [140, 42],
        iconAnchor: [70, 34],
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="padding:2px 7px;border-radius:6px;background:rgba(7,17,37,0.95);border:1px solid #8B5CF6;color:#DDD6FE;font:700 10px/1.2 sans-serif;white-space:nowrap;margin-bottom:4px;">${safeLabel}</div>
            <div style="width:14px;height:14px;border-radius:9999px;background:#8B5CF6;border:2px solid #FFFFFF;box-shadow:0 0 12px #8B5CF6;"></div>
          </div>
        `,
      });
      selectedMarkerRef.current = L.marker([selectedPoint.lat, selectedPoint.lng], { icon }).addTo(
        map
      );
    }
  }, [selectedPoint, markers, map]);

  // Etiquetas de horário do Histórico 2h
  useEffect(() => {
    const histGroup = historyLabelsLayerRef.current;
    if (!histGroup) return;
    histGroup.clearLayers();
    if (!showMovementHistory || !movementHistory) return;

    movementHistory
      .filter((_, idx) => idx === 0 || idx === movementHistory.length - 1 || idx % 4 === 0)
      .forEach((pt) => {
        const hhmm = escapeHtml(
          new Date(pt.timestamp).toLocaleTimeString('pt-PT', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
        const icon = L.divIcon({
          className: 'sara-leaflet-marker',
          iconSize: [44, 20],
          iconAnchor: [22, 10],
          html: `<div style="padding:1px 5px;border-radius:4px;background:rgba(31,6,13,0.95);border:1px solid rgba(255,42,75,0.85);color:#FECDD3;font:700 9px/1.2 monospace;text-align:center;">${hhmm}</div>`,
        });
        L.marker([pt.lat, pt.lng], { icon }).addTo(histGroup);
      });
  }, [movementHistory, showMovementHistory, map]);

  // Camada de Calor & Zonas (leaflet.heat)
  useEffect(() => {
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current as unknown as L.Layer);
      heatLayerRef.current = null;
    }

    const shouldShowHeat = heatOverlayActive || (showMovementHistory && (movementHistory?.length || 0) >= 2);
    if (!shouldShowHeat) return;

    const heatPoints: Array<[number, number, number]> = [];
    if (movementHistory && movementHistory.length > 0) {
      movementHistory.forEach((pt, idx) => {
        const weight = 0.45 + 0.55 * ((idx + 1) / movementHistory.length);
        heatPoints.push([pt.lat, pt.lng, Number(weight.toFixed(2))]);
      });
    }
    markers.forEach((m) => {
      if (Number.isFinite(m.lat) && Number.isFinite(m.lng)) {
        heatPoints.push([m.lat, m.lng, m.tone === 'target_locked' ? 1.0 : 0.7]);
      }
    });

    if (heatPoints.length === 0) return;

    const heat = new HeatLayer(heatPoints, {
      radius: 26,
      blur: 18,
      maxZoom: 18,
      minOpacity: 0.35,
      gradient: {
        0.25: '#00E5FF',
        0.6: '#8B5CF6',
        1.0: '#FF2A4B',
      },
    });
    map.addLayer(heat as unknown as L.Layer);
    heatLayerRef.current = heat;
  }, [heatOverlayActive, showMovementHistory, movementHistory, markers, map]);

  // Motor de Rotas (leaflet-routing-machine + fallback OSRM)
  useEffect(() => {
    let cancelled = false;

    const cleanupRouting = () => {
      if (routingControlRef.current) {
        try {
          map.removeControl(routingControlRef.current);
        } catch {
          // ignore
        }
        routingControlRef.current = null;
      }
    };

    if (!routeOrigin || !routeDestination) {
      cleanupRouting();
      onFallbackRoutePath(null);
      onRouteComputed?.(null);
      return;
    }

    onFallbackRoutePath(null);

    void ensureLeafletRoutingMachine().then((Routing) => {
      if (cancelled) return;
      cleanupRouting();

      if (Routing && typeof Routing.control === 'function') {
        try {
          const ctrl = Routing.control({
            router: Routing.osrmv1({
              serviceUrl: 'https://router.project-osrm.org/route/v1',
              profile: 'driving',
              timeout: 9000,
            }),
            waypoints: [
              L.latLng(routeOrigin.lat, routeOrigin.lng),
              L.latLng(routeDestination.lat, routeDestination.lng),
            ],
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: !navigationActive,
            showAlternatives: false,
            show: false,
            collapsible: true,
            createMarker: () => null,
            lineOptions: {
              styles: [
                {
                  color: '#8B5CF6',
                  weight: navigationActive ? 10 : 8,
                  opacity: 0.45,
                },
                {
                  color: '#00E5FF',
                  weight: navigationActive ? 5.5 : 4,
                  opacity: 0.96,
                },
              ],
              extendToWaypoints: true,
              missingRouteTolerance: 10,
            },
          });

          ctrl.on('routesfound', (ev) => {
            if (cancelled) return;
            const summary = ev.routes?.[0]?.summary;
            if (summary) {
              const distanceMeters = Math.round(summary.totalDistance || 0);
              const durationSeconds = Math.max(60, Math.round(summary.totalTime || 60));
              onFallbackRoutePath(null);
              onRouteComputed?.({
                distanceMeters,
                durationSeconds,
                chapaDurationSeconds: Math.round(durationSeconds * 1.55 + 180),
              });
            }
          });

          ctrl.on('routingerror', () => {
            if (cancelled) return;
            void computeFreeRadarRoute(routeOrigin, routeDestination).then((routeRes) => {
              if (cancelled || !routeRes) return;
              onFallbackRoutePath(routeRes.path);
              if (!navigationActive) {
                map.fitBounds(L.latLngBounds(routeRes.path), { padding: [48, 48] });
              }
              onRouteComputed?.({
                distanceMeters: routeRes.distanceMeters,
                durationSeconds: routeRes.durationSeconds,
                chapaDurationSeconds: routeRes.chapaDurationSeconds,
              });
            });
          });

          ctrl.addTo(map);
          routingControlRef.current = ctrl;
          return;
        } catch {
          // Fallback direto abaixo
        }
      }

      void computeFreeRadarRoute(routeOrigin, routeDestination).then((routeRes) => {
        if (cancelled) return;
        if (!routeRes) {
          onRouteComputed?.(null);
          return;
        }
        onFallbackRoutePath(routeRes.path);
        if (!navigationActive) {
          map.fitBounds(L.latLngBounds(routeRes.path), { padding: [48, 48] });
        }
        onRouteComputed?.({
          distanceMeters: routeRes.distanceMeters,
          durationSeconds: routeRes.durationSeconds,
          chapaDurationSeconds: routeRes.chapaDurationSeconds,
        });
      });
    });

    return () => {
      cancelled = true;
      cleanupRouting();
    };
  }, [routeOrigin, routeDestination, navigationActive, map, onRouteComputed, onFallbackRoutePath]);

  // Foco aproximado na rua ("Ver Rua")
  useEffect(() => {
    if (!streetViewTarget) return;
    map.flyTo([streetViewTarget.lat, streetViewTarget.lng], 18, { duration: 0.7 });
  }, [streetViewTarget, map]);

  return null;
};

export const FreeSaraMapView: React.FC<FreeSaraMapViewProps> = ({
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
  onViewModeChange,
  onRouteComputed,
  onRecenterMyLocation,
  onCloseStreetView,
  onMapClickPoint,
  mapCanvasRef,
}) => {
  const mapInstanceRef = useRef<L.Map | null>(null);

  const [activeBaseLayer, setActiveBaseLayer] = useState<BaseLayerKey>(() =>
    viewMode === 'hybrid'
      ? 'hybrid_esri'
      : viewMode === 'terrain'
      ? 'terrain_topo'
      : 'roadmap_dark'
  );
  const [heatOverlayActive, setHeatOverlayActive] = useState(false);
  const [fallbackRoutePath, setFallbackRoutePath] = useState<Array<[number, number]> | null>(null);

  const [selectedPoint, setSelectedPoint] = useState<{
    lat: number;
    lng: number;
    label?: string;
  } | null>(null);

  // Pesquisa livre de lugares focada em Moçambique (Nominatim + Photon)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RadarPlaceResult[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [searchNotFoundMsg, setSearchNotFoundMsg] = useState('');

  // Sincroniza alterações externas de viewMode (botões Ruas / Satélite / Terreno ou Voz)
  useEffect(() => {
    setActiveBaseLayer((prev) => {
      if (viewMode === 'hybrid') return 'hybrid_esri';
      if (viewMode === 'terrain') {
        return prev === 'terrain_esri' ? 'terrain_esri' : 'terrain_topo';
      }
      return prev === 'roadmap_osm' ? 'roadmap_osm' : 'roadmap_dark';
    });
  }, [viewMode]);

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

  const handleLayerChangedByControl = useCallback(
    (layerName: string) => {
      if (layerName === BASE_LAYER_NAMES.roadmap_dark) {
        setActiveBaseLayer('roadmap_dark');
        onViewModeChange?.('roadmap');
      } else if (layerName === BASE_LAYER_NAMES.roadmap_osm) {
        setActiveBaseLayer('roadmap_osm');
        onViewModeChange?.('roadmap');
      } else if (layerName === BASE_LAYER_NAMES.hybrid_esri) {
        setActiveBaseLayer('hybrid_esri');
        onViewModeChange?.('hybrid');
      } else if (layerName === BASE_LAYER_NAMES.terrain_topo) {
        setActiveBaseLayer('terrain_topo');
        onViewModeChange?.('terrain');
      } else if (layerName === BASE_LAYER_NAMES.terrain_esri) {
        setActiveBaseLayer('terrain_esri');
        onViewModeChange?.('terrain');
      }
    },
    [onViewModeChange]
  );

  // Autocomplete focado em Moçambique (Nominatim + Photon)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchNotFoundMsg('');
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearchingPlaces(true);
      setSearchNotFoundMsg('');
      const ref = selfMarker
        ? { lat: selfMarker.lat, lng: selfMarker.lng }
        : validCenter;
      void searchFreeRadarPlacesDetailed(trimmed, ref)
        .then((res) => {
          if (cancelled) return;
          setSearchResults(res.results);
          setSearchNotFoundMsg(res.notFoundMessage);
        })
        .finally(() => {
          if (!cancelled) setSearchingPlaces(false);
        });
    }, 340);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, selfMarker, validCenter]);

  const handlePickSearchPlace = useCallback(
    (place: RadarPlaceResult) => {
      setSearchResults([]);
      setSearchNotFoundMsg('');
      setSearchQuery(place.name);
      setSelectedPoint({ lat: place.lat, lng: place.lng, label: place.name });
      mapInstanceRef.current?.flyTo([place.lat, place.lng], 16, { duration: 0.6 });
      onSelectPlace?.(place);
    },
    [onSelectPlace]
  );

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchQuery.trim();
    if (!clean) return;
    if (searchResults.length > 0) {
      handlePickSearchPlace(searchResults[0]);
      return;
    }
    setSearchingPlaces(true);
    setSearchNotFoundMsg('');
    try {
      const ref = selfMarker ? { lat: selfMarker.lat, lng: selfMarker.lng } : validCenter;
      const res = await searchFreeRadarPlacesDetailed(clean, ref);
      if (res.results.length > 0) {
        handlePickSearchPlace(res.results[0]);
      } else {
        setSearchNotFoundMsg(res.notFoundMessage || 'Não encontrado em Moçambique');
      }
    } finally {
      setSearchingPlaces(false);
    }
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleCenterSelf = () => {
    onRecenterMyLocation?.();
    const target = selfMarker ? { lat: selfMarker.lat, lng: selfMarker.lng } : validCenter;
    if (mapInstanceRef.current && target) {
      mapInstanceRef.current.flyTo([target.lat, target.lng], 16, { duration: 0.6 });
    }
  };

  const handleMapClickPoint = useCallback(
    (lat: number, lng: number) => {
      setSelectedPoint({ lat, lng, label: 'Ponto selecionado' });
      onMapClickPoint?.(lat, lng);
    },
    [onMapClickPoint]
  );

  const handleSelectMarkerInternal = useCallback(
    (markerId: string) => {
      const found = markers.find((m) => m.id === markerId);
      if (found) {
        setSelectedPoint({ lat: found.lat, lng: found.lng, label: found.title });
      }
      onSelectMarker?.(markerId);
    },
    [markers, onSelectMarker]
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
            'O Radar SARA não inventa cidades nem coordenadas fixas. Ativa o GPS do teu aparelho para centrar na tua posição real em Moçambique.'}
        </p>
        {onRecenterMyLocation && (
          <button
            type="button"
            onClick={onRecenterMyLocation}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#020612] text-xs font-extrabold cursor-pointer"
          >
            Obter Localização Real
          </button>
        )}
      </div>
    );
  }

  const historyPath =
    showMovementHistory && movementHistory && movementHistory.length >= 2
      ? movementHistory.map((p) => [p.lat, p.lng] as [number, number])
      : null;

  return (
    <div
      ref={mapCanvasRef}
      className={`sara-leaflet-container relative w-full ${heightClassName} rounded-2xl overflow-hidden border border-[#00E5FF]/45 bg-[#020612] shadow-[0_0_30px_rgba(0,229,255,0.14)]`}
    >
      {/* Barra de pesquisa de lugares focada em Moçambique */}
      {showPlacesSearch && (
        <div className="absolute top-2.5 left-2.5 right-14 z-[500] max-w-md">
          <form onSubmit={(e) => void handleSearchSubmit(e)} className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#00E5FF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar rua, bairro, farmácia..."
                className="w-full pl-8 pr-8 py-2 rounded-xl bg-[#040B1B]/95 border border-cyan-500/45 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#00E5FF] backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.45)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setSearchNotFoundMsg('');
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  title="Limpar pesquisa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={searchingPlaces}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#00E5FF]/25 to-[#8B5CF6]/25 border border-cyan-400/60 text-cyan-100 text-xs font-bold hover:border-[#00E5FF] cursor-pointer flex items-center gap-1"
            >
              {searchingPlaces ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Ir</span>
            </button>
          </form>

          {searchResults.length > 0 && (
            <ul className="mt-1.5 rounded-xl bg-[#040B1B]/98 border border-cyan-500/45 shadow-2xl overflow-hidden divide-y divide-cyan-500/15 max-h-56 overflow-y-auto sara-scroll">
              {searchResults.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => handlePickSearchPlace(place)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-cyan-500/15 flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-slate-100 font-semibold truncate">{place.name}</div>
                        {place.address && (
                          <div className="text-[10px] text-slate-400 truncate">{place.address}</div>
                        )}
                      </div>
                    </div>
                    {place.distanceMeters !== null && (
                      <span className="text-[10px] font-mono text-[#00E5FF] shrink-0">
                        {formatDistancePt(place.distanceMeters)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!searchingPlaces &&
            searchResults.length === 0 &&
            searchNotFoundMsg &&
            searchQuery.trim().length >= 2 && (
              <div className="mt-1.5 px-3 py-2 rounded-xl bg-[#040B1B]/98 border border-amber-400/50 text-xs text-amber-200 font-semibold shadow-xl">
                {searchNotFoundMsg}
              </div>
            )}
        </div>
      )}

      {/* Cantos futuristas HUD neon azul e roxo */}
      <div className="pointer-events-none absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#00E5FF] z-[450]" />
      <div className="pointer-events-none absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#00E5FF] z-[450]" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#8B5CF6] z-[450]" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#8B5CF6] z-[450]" />

      {/* Mapa Profissional React-Leaflet + Camadas Grátis (maxZoom 19) */}
      <MapContainer
        center={[validCenter.lat, validCenter.lng]}
        zoom={zoom}
        maxZoom={19}
        zoomControl={false}
        attributionControl={true}
        className="w-full h-full z-10"
      >
        <LayersControl position="topright" collapsed={true}>
          <LayersControl.BaseLayer
            name={BASE_LAYER_NAMES.roadmap_dark}
            checked={activeBaseLayer === 'roadmap_dark'}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={19}
              crossOrigin="anonymous"
              attribution="&copy; OpenStreetMap &copy; CARTO"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer
            name={BASE_LAYER_NAMES.roadmap_osm}
            checked={activeBaseLayer === 'roadmap_osm'}
          >
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              crossOrigin="anonymous"
              attribution="&copy; OpenStreetMap"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer
            name={BASE_LAYER_NAMES.hybrid_esri}
            checked={activeBaseLayer === 'hybrid_esri'}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
              crossOrigin="anonymous"
              attribution="Esri World Imagery"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer
            name={BASE_LAYER_NAMES.terrain_topo}
            checked={activeBaseLayer === 'terrain_topo'}
          >
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              maxNativeZoom={17}
              maxZoom={19}
              crossOrigin="anonymous"
              attribution="OpenTopoMap"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer
            name={BASE_LAYER_NAMES.terrain_esri}
            checked={activeBaseLayer === 'terrain_esri'}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
              crossOrigin="anonymous"
              attribution="Esri World Topo"
            />
          </LayersControl.BaseLayer>

          {/* Camada extra de Nomes de Ruas e Bairros por cima do Satélite / Terreno */}
          <LayersControl.Overlay
            name="Nomes de Ruas & Bairros"
            checked={activeBaseLayer === 'hybrid_esri' || activeBaseLayer === 'terrain_topo' || activeBaseLayer === 'terrain_esri'}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={19}
              zIndex={400}
              crossOrigin="anonymous"
              attribution="&copy; CARTO Labels"
            />
          </LayersControl.Overlay>

          <LayersControl.Overlay name="Mapa de Calor & Zonas" checked={heatOverlayActive}>
            <TileLayer url="" />
          </LayersControl.Overlay>
        </LayersControl>

        {/* Zona de Alerta (Geofence) */}
        {geofence && geofence.active && (
          <Circle
            center={[geofence.centerLat, geofence.centerLng]}
            radius={geofence.radiusMeters}
            pathOptions={{
              color: geofence.lastStatus === 'outside' ? '#FF2A4B' : '#00E5FF',
              weight: 2.5,
              fillColor: geofence.lastStatus === 'outside' ? '#FF2A4B' : '#8B5CF6',
              fillOpacity: 0.14,
            }}
          />
        )}

        {/* Histórico de Movimento 2h */}
        {historyPath && (
          <>
            <Polyline
              positions={historyPath}
              pathOptions={{ color: '#8B5CF6', weight: 7, opacity: 0.35 }}
            />
            <Polyline
              positions={historyPath}
              pathOptions={{ color: '#FF2A4B', weight: 3.5, opacity: 0.92 }}
            />
          </>
        )}

        {/* Fallback visual da Rota caso OSRM controle retorne erro */}
        {fallbackRoutePath && fallbackRoutePath.length >= 2 && (
          <>
            <Polyline
              positions={fallbackRoutePath}
              pathOptions={{
                color: '#8B5CF6',
                weight: navigationActive ? 10 : 8,
                opacity: 0.45,
              }}
            />
            <Polyline
              positions={fallbackRoutePath}
              pathOptions={{
                color: '#00E5FF',
                weight: navigationActive ? 5.5 : 4,
                opacity: 0.96,
              }}
            />
          </>
        )}

        <SaraLeafletBridge
          mapRef={mapInstanceRef}
          validCenter={validCenter}
          zoom={zoom}
          markers={markers}
          sonarActive={sonarActive}
          selectedPoint={selectedPoint}
          movementHistory={movementHistory}
          showMovementHistory={showMovementHistory}
          heatOverlayActive={heatOverlayActive}
          routeOrigin={routeOrigin}
          routeDestination={routeDestination}
          navigationActive={navigationActive}
          streetViewTarget={streetViewTarget}
          onMapClickPoint={handleMapClickPoint}
          onSelectMarker={handleSelectMarkerInternal}
          onSelectPlace={onSelectPlace}
          onLayerChangedByControl={handleLayerChangedByControl}
          onHeatOverlayToggle={setHeatOverlayActive}
          onRouteComputed={onRouteComputed}
          onFallbackRoutePath={setFallbackRoutePath}
        />
      </MapContainer>

      {/* Botões Minha Localização + Zoom + / - */}
      <div className="absolute right-2.5 bottom-7 z-[500] flex flex-col gap-1.5">
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

      {/* Aviso de zoom aproximado na rua ("Ver Rua") */}
      {streetViewTarget && onCloseStreetView && (
        <div className="absolute top-14 left-2.5 z-[500] px-3 py-1.5 rounded-xl bg-[#040B1B]/95 border border-[#8B5CF6]/70 text-[11px] text-purple-100 flex items-center gap-2 backdrop-blur-md shadow-xl">
          <span>
            Vista aproximada: <strong>{streetViewTarget.label || 'Rua exata'}</strong>
          </span>
          <button
            type="button"
            onClick={onCloseStreetView}
            className="px-2 py-0.5 rounded bg-purple-500/25 border border-purple-400/50 text-white font-bold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Aviso discreto quando mapa está privado e vazio */}
      {emptyNotice && markers.length === 0 && !selectedPoint && (
        <div className="pointer-events-none absolute bottom-3 left-14 right-28 z-[450] px-3 py-2 rounded-xl bg-[#030815]/92 border border-cyan-500/35 text-[11px] text-cyan-100 backdrop-blur-md">
          {emptyNotice}
        </div>
      )}

      {/* Ponto selecionado: distância até ti */}
      {selectedPoint && selfMarker && (
        <div className="absolute bottom-3 left-14 z-[500] px-2.5 py-1.5 rounded-xl bg-[#040B1B]/95 border border-[#8B5CF6]/60 text-[10px] font-mono text-purple-100 flex items-center gap-2 backdrop-blur-md">
          <span className="truncate max-w-[160px]">{selectedPoint.label || 'Ponto'}</span>
          <span className="text-[#00E5FF]">
            {formatDistancePt(
              calcDistanceMeters(selfMarker.lat, selfMarker.lng, selectedPoint.lat, selectedPoint.lng)
            )}
          </span>
        </div>
      )}
    </div>
  );
};
