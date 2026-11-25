import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import {
  Activity,
  Battery,
  Camera,
  Check,
  Clock,
  Copy,
  Crosshair,
  Eye,
  Gauge,
  Ghost,
  History,
  Loader2,
  Map as MapIcon,
  MapPin,
  Mic,
  MicOff,
  Mountain,
  Navigation,
  Radio,
  Radar,
  Route as RouteIcon,
  Satellite,
  Search,
  Share2,
  ShieldAlert,
  ShieldOff,
  Square,
  UserPlus,
  WifiOff,
  X,
} from 'lucide-react';
import type { SaraSession } from '../../types/auth';
import type {
  GeocodedAddressInfo,
  GeofenceZone,
  LocationRequestItem,
  LocationSignalSource,
  MovementHistoryPoint,
  RadarMapViewMode,
  RadarPlaceResult,
  SaraDeviceRecord,
  SharedPeerLocation,
} from '../../types/location';
import {
  appendMovementPoint,
  calcDistanceMeters,
  computeSpeedMps,
  createOrUpdateLiveShare,
  evaluateGeofenceTransition,
  formatDistancePt,
  formatRemainingTimePt,
  formatSpeedKmh,
  formatTimeAgoPt,
  getLastSavedRealCoords,
  getMovementHistory2h,
  lookupUserCardBySaraId,
  playGeofenceAlertBeep,
  readDeviceBatteryStatus,
  requestRealCoordinatesWithFallback,
  respondToLocationRequest,
  reverseGeocodeCoords,
  sendLocationRequest,
  startRadarSonarPing,
  stopLiveShareSession,
  stopRadarSonarPing,
  stopSingleShare,
} from '../../services/locationRadarService';
import {
  FreeSaraMapView,
  type ComputedRouteInfo,
  type SaraMapMarker,
} from './FreeSaraMapView';

export interface RadarExternalControlHandle {
  setViewMode: (mode: RadarMapViewMode) => void;
  trackTargetByQuery: (query: string) => Promise<{
    found: boolean;
    message: string;
  }>;
  getTrackedTargetStreetSpeech: () => Promise<string>;
  triggerRouteToTrackedTarget: () => Promise<string>;
  stopAllTracking: () => string;
}

interface RadarMapPanelProps {
  session: SaraSession;
  appearOnMap: boolean;
  ghostMode: boolean;
  myCoords: {
    lat: number;
    lng: number;
    accuracyM?: number | null;
    speedMps?: number | null;
    source?: LocationSignalSource;
    timestamp?: number;
  } | null;
  devices?: SaraDeviceRecord[];
  incomingPending: LocationRequestItem[];
  outgoingGrants: LocationRequestItem[];
  sharedPeers: SharedPeerLocation[];
  isListening?: boolean;
  isSaraSpeaking?: boolean;
  onToggleMic?: () => void;
  onToggleAppearOnMap: () => void;
  onActivateGhostMode: () => void;
  onStopSharingAll: () => void;
  onUpdateMyCoords: (coords: {
    lat: number;
    lng: number;
    accuracyM?: number | null;
    speedMps?: number | null;
    source?: LocationSignalSource;
    timestamp?: number;
  }) => void;
  onNotify: (msg: string) => void;
  onClose?: () => void;
  radarControlRef?: React.RefObject<RadarExternalControlHandle | null>;
}

function formatDurationMinutes(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

export const RadarMapPanel: React.FC<RadarMapPanelProps> = ({
  session,
  appearOnMap,
  ghostMode,
  myCoords,
  devices = [],
  incomingPending,
  outgoingGrants,
  sharedPeers,
  isListening = false,
  isSaraSpeaking = false,
  onToggleMic,
  onToggleAppearOnMap,
  onActivateGhostMode,
  onStopSharingAll,
  onUpdateMyCoords,
  onNotify,
  onClose,
  radarControlRef,
}) => {
  // Busca por ID SARA
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchCard, setSearchCard] = useState<{
    saraId: string;
    uid: string;
    callName: string;
  } | null>(null);
  const [searchFeedback, setSearchFeedback] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);

  // Estado Real GPS & Fallback
  const [signalSource, setSignalSource] = useState<LocationSignalSource>(
    myCoords?.source || (myCoords ? 'gps' : 'none')
  );
  const [lastSignalTimestamp, setLastSignalTimestamp] = useState<number>(
    myCoords?.timestamp || Date.now()
  );
  const [myBatteryPct, setMyBatteryPct] = useState<number | null>(null);
  const [myAddressInfo, setMyAddressInfo] = useState<GeocodedAddressInfo | null>(null);
  const prevSampleRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);

  // Visão do Mapa + Street View + Lugar Pesquisado
  const [viewMode, setViewMode] = useState<RadarMapViewMode>('roadmap');
  const [selectedPlace, setSelectedPlace] = useState<RadarPlaceResult | null>(null);
  const [streetViewTarget, setStreetViewTarget] = useState<{
    lat: number;
    lng: number;
    label?: string;
  } | null>(null);

  // Rastreamento Ativo, Sonar & Alvo Bloqueado
  const [lockedTargetId, setLockedTargetId] = useState<string | null>(null);
  const [sonarActive, setSonarActive] = useState(false);
  const [targetAddress, setTargetAddress] = useState<GeocodedAddressInfo | null>(null);
  const [stationedTracker, setStationedTracker] = useState<{
    id: string;
    lat: number;
    lng: number;
    sinceIso: string;
  } | null>(null);

  // Rota & Navegação
  const [routeEnabled, setRouteEnabled] = useState(false);
  const [navigationActive, setNavigationActive] = useState(false);
  const [computedRoute, setComputedRoute] = useState<ComputedRouteInfo | null>(null);

  // Histórico 2h (linha vermelha)
  const [showMovementHistory, setShowMovementHistory] = useState(false);
  const [movementHistory, setMovementHistory] = useState<MovementHistoryPoint[]>([]);

  // Zona de Alerta (Geofence)
  const [geofence, setGeofence] = useState<GeofenceZone | null>(null);
  const [geofenceAlertMsg, setGeofenceAlertMsg] = useState<string | null>(null);

  // Partilha Ao Vivo (Link + WhatsApp)
  const [activeLiveShare, setActiveLiveShare] = useState<{
    shareId: string;
    url: string;
    whatsappUrl: string;
  } | null>(null);
  const [liveShareBusy, setLiveShareBusy] = useState(false);
  const [capturingPrint, setCapturingPrint] = useState(false);

  const mapWrapperRef = useRef<HTMLDivElement | null>(null);

  // Limpa sonar ao desmontar
  useEffect(() => {
    return () => {
      stopRadarSonarPing();
    };
  }, []);

  // Ler bateria real do dispositivo
  useEffect(() => {
    void readDeviceBatteryStatus().then((b) => setMyBatteryPct(b.batteryPct));
  }, []);

  // Aquisição real de localização ao montar + refresh periódico enquanto o Radar estiver aberto
  const refreshRealGps = useCallback(async () => {
    const fresh = await requestRealCoordinatesWithFallback(10000);
    if (fresh) {
      const speedMps = computeSpeedMps(
        prevSampleRef.current,
        { lat: fresh.lat, lng: fresh.lng, timestamp: fresh.timestamp },
        fresh.speedMps
      );
      prevSampleRef.current = {
        lat: fresh.lat,
        lng: fresh.lng,
        timestamp: fresh.timestamp,
      };
      setSignalSource(fresh.source);
      setLastSignalTimestamp(fresh.timestamp);
      onUpdateMyCoords({
        lat: fresh.lat,
        lng: fresh.lng,
        accuracyM: fresh.accuracyM,
        speedMps,
        source: fresh.source,
        timestamp: fresh.timestamp,
      });
      return fresh;
    }

    // Sem GPS e sem rede -> verifica última localização real guardada
    const saved = getLastSavedRealCoords();
    if (saved) {
      setSignalSource('last_known');
      setLastSignalTimestamp(saved.timestamp);
      onUpdateMyCoords({
        lat: saved.lat,
        lng: saved.lng,
        accuracyM: saved.accuracyM,
        speedMps: null,
        source: 'last_known',
        timestamp: saved.timestamp,
      });
    } else {
      setSignalSource('none');
    }
    return null;
  }, [onUpdateMyCoords]);

  useEffect(() => {
    void refreshRealGps();
    const timer = window.setInterval(() => {
      void refreshRealGps();
    }, navigationActive ? 7000 : 25000);
    return () => window.clearInterval(timer);
  }, [refreshRealGps, navigationActive]);

  // Atualiza endereço real do utilizador via reverse-geocode
  useEffect(() => {
    if (!myCoords) return;
    let active = true;
    void reverseGeocodeCoords(myCoords.lat, myCoords.lng).then((info) => {
      if (active && info) setMyAddressInfo(info);
    });
    return () => {
      active = false;
    };
  }, [myCoords?.lat, myCoords?.lng]);

  // Determina o alvo bloqueado atualmente (Peer com consentimento, Aparelho próprio ou Lugar)
  const resolvedTrackedPeer = useMemo(() => {
    if (lockedTargetId?.startsWith('peer_')) {
      const sId = lockedTargetId.replace(/^peer_/, '');
      return sharedPeers.find((p) => p.saraId === sId) || null;
    }
    if (!lockedTargetId && sharedPeers.length > 0) {
      return sharedPeers[0];
    }
    return null;
  }, [lockedTargetId, sharedPeers]);

  const resolvedTrackedDevice = useMemo(() => {
    if (lockedTargetId?.startsWith('dev_')) {
      const code = lockedTargetId.replace(/^dev_/, '');
      return (
        devices.find(
          (d) =>
            d.deviceCode === code &&
            typeof d.lastLat === 'number' &&
            typeof d.lastLng === 'number'
        ) || null
      );
    }
    return null;
  }, [lockedTargetId, devices]);

  const activeTargetSummary = useMemo(() => {
    if (resolvedTrackedPeer) {
      const dist =
        myCoords
          ? calcDistanceMeters(
              myCoords.lat,
              myCoords.lng,
              resolvedTrackedPeer.lat,
              resolvedTrackedPeer.lng
            )
          : resolvedTrackedPeer.distanceMeters;
      return {
        key: `peer_${resolvedTrackedPeer.saraId}`,
        name: resolvedTrackedPeer.callName,
        subId: resolvedTrackedPeer.saraId,
        lat: resolvedTrackedPeer.lat,
        lng: resolvedTrackedPeer.lng,
        distanceMeters: dist,
        speedMps: resolvedTrackedPeer.speedMps ?? null,
        batteryPct: resolvedTrackedPeer.batteryPct ?? null,
        stationedSince: resolvedTrackedPeer.stationedSince || resolvedTrackedPeer.updatedAt,
        expiresAt: resolvedTrackedPeer.expiresAt,
        kind: 'peer' as const,
      };
    }

    if (resolvedTrackedDevice && resolvedTrackedDevice.lastLat !== null && resolvedTrackedDevice.lastLng !== null) {
      const dist = myCoords
        ? calcDistanceMeters(
            myCoords.lat,
            myCoords.lng,
            resolvedTrackedDevice.lastLat,
            resolvedTrackedDevice.lastLng
          )
        : null;
      return {
        key: `dev_${resolvedTrackedDevice.deviceCode}`,
        name: resolvedTrackedDevice.deviceName,
        subId: resolvedTrackedDevice.deviceCode,
        lat: resolvedTrackedDevice.lastLat,
        lng: resolvedTrackedDevice.lastLng,
        distanceMeters: dist,
        speedMps: resolvedTrackedDevice.speedMps ?? null,
        batteryPct: resolvedTrackedDevice.batteryPct ?? null,
        stationedSince: resolvedTrackedDevice.lastUpdatedAt,
        expiresAt: undefined,
        kind: 'device' as const,
      };
    }

    if (selectedPlace && lockedTargetId === `place_${selectedPlace.id}`) {
      const dist = myCoords
        ? calcDistanceMeters(myCoords.lat, myCoords.lng, selectedPlace.lat, selectedPlace.lng)
        : selectedPlace.distanceMeters;
      return {
        key: `place_${selectedPlace.id}`,
        name: selectedPlace.name,
        subId: selectedPlace.categoryLabel || 'Lugar',
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        distanceMeters: dist,
        speedMps: null,
        batteryPct: null,
        stationedSince: null,
        expiresAt: undefined,
        kind: 'place' as const,
      };
    }

    return null;
  }, [resolvedTrackedPeer, resolvedTrackedDevice, selectedPlace, lockedTargetId, myCoords]);

  // Reverse geocoding real para o alvo selecionado
  useEffect(() => {
    if (!activeTargetSummary) {
      setTargetAddress(null);
      return;
    }
    let active = true;
    void reverseGeocodeCoords(activeTargetSummary.lat, activeTargetSummary.lng).then((info) => {
      if (active && info) setTargetAddress(info);
    });
    return () => {
      active = false;
    };
  }, [activeTargetSummary?.key, activeTargetSummary?.lat, activeTargetSummary?.lng]);

  // Controla tempo estacionado ("Há quanto tempo está lá") + Histórico 2h + Geofence
  useEffect(() => {
    if (!activeTargetSummary) return;

    // Tempo parado no mesmo raio (45m)
    setStationedTracker((prev) => {
      if (
        prev &&
        prev.id === activeTargetSummary.key &&
        calcDistanceMeters(prev.lat, prev.lng, activeTargetSummary.lat, activeTargetSummary.lng) <= 45
      ) {
        return prev;
      }
      return {
        id: activeTargetSummary.key,
        lat: activeTargetSummary.lat,
        lng: activeTargetSummary.lng,
        sinceIso: activeTargetSummary.stationedSince || new Date().toISOString(),
      };
    });

    // Regista no histórico exclusivo das últimas 2 horas
    if (activeTargetSummary.kind === 'peer' || activeTargetSummary.kind === 'device') {
      const updated = appendMovementPoint(activeTargetSummary.key, {
        lat: activeTargetSummary.lat,
        lng: activeTargetSummary.lng,
        timestamp: Date.now(),
        speedMps: activeTargetSummary.speedMps,
      });
      setMovementHistory(updated);
    }

    // Avalia Zona de Alerta (Geofence)
    if (geofence && geofence.active) {
      const evalRes = evaluateGeofenceTransition(
        geofence,
        activeTargetSummary.lat,
        activeTargetSummary.lng
      );
      if (evalRes) {
        if (evalRes.transitioned && evalRes.eventText) {
          playGeofenceAlertBeep();
          setGeofenceAlertMsg(evalRes.eventText);
          onNotify(evalRes.eventText);
        }
        if (geofence.lastStatus !== evalRes.status) {
          setGeofence((prev) => (prev ? { ...prev, lastStatus: evalRes.status } : prev));
        }
      }
    }
  }, [activeTargetSummary, geofence, onNotify]);

  // Atualiza live share se ativo quando myCoords muda
  useEffect(() => {
    if (!activeLiveShare || !myCoords || session.isGuest) return;
    void createOrUpdateLiveShare({
      session,
      lat: myCoords.lat,
      lng: myCoords.lng,
      speedMps: myCoords.speedMps ?? null,
      batteryPct: myBatteryPct,
      addressLabel:
        myAddressInfo?.formattedAddress || `${myCoords.lat.toFixed(5)}, ${myCoords.lng.toFixed(5)}`,
      existingShareId: activeLiveShare.shareId,
    });
  }, [activeLiveShare, myCoords, myBatteryPct, myAddressInfo?.formattedAddress, session]);

  // Carrega histórico 2h quando showMovementHistory ativo no utilizador ou no alvo
  useEffect(() => {
    if (!showMovementHistory) return;
    const key = activeTargetSummary?.key || `self_${session.saraId || session.userId}`;
    if (myCoords && !activeTargetSummary) {
      const next = appendMovementPoint(key, {
        lat: myCoords.lat,
        lng: myCoords.lng,
        timestamp: Date.now(),
        speedMps: myCoords.speedMps ?? null,
      });
      setMovementHistory(next);
    } else {
      setMovementHistory(getMovementHistory2h(key));
    }
  }, [showMovementHistory, activeTargetSummary?.key, myCoords, session.saraId, session.userId]);

  const triggerSonarLockSequence = useCallback((targetKey: string) => {
    setLockedTargetId(targetKey);
    setSonarActive(true);
    startRadarSonarPing();
    window.setTimeout(() => {
      stopRadarSonarPing();
      setSonarActive(false);
    }, 3800);
  }, []);

  // Comandos por Voz da SARA (imperativo via ref)
  useImperativeHandle(
    radarControlRef,
    () => ({
      setViewMode: (mode: RadarMapViewMode) => {
        setViewMode(mode);
      },
      trackTargetByQuery: async (rawQuery: string) => {
        const q = rawQuery.trim().toLowerCase();
        if (!q) {
          return { found: false, message: 'Diz o nome ou Identificador SARA de quem queres rastrear.' };
        }

        // 1. Procura nos peers com consentimento explícito ativo
        const matchedPeer = sharedPeers.find(
          (p) =>
            p.saraId.toLowerCase() === q ||
            p.callName.toLowerCase().includes(q)
        );
        if (matchedPeer) {
          triggerSonarLockSequence(`peer_${matchedPeer.saraId}`);
          const dist = myCoords
            ? calcDistanceMeters(myCoords.lat, myCoords.lng, matchedPeer.lat, matchedPeer.lng)
            : matchedPeer.distanceMeters;
          const distText = dist !== null ? `a ${formatDistancePt(dist)} de ti` : 'em tempo real';
          return {
            found: true,
            message: `A rastrear ${matchedPeer.callName}... Alvo encontrado, ${distText}.`,
          };
        }

        // 2. Procura nos próprios aparelhos da conta (ex: "meu celular", "CEL-XXXX")
        const matchedDevice = devices.find(
          (d) =>
            typeof d.lastLat === 'number' &&
            typeof d.lastLng === 'number' &&
            (d.deviceCode.toLowerCase() === q ||
              d.deviceName.toLowerCase().includes(q) ||
              /celular|telemovel|telefone|pc|computador/.test(q))
        );
        if (matchedDevice && matchedDevice.lastLat !== null && matchedDevice.lastLng !== null) {
          triggerSonarLockSequence(`dev_${matchedDevice.deviceCode}`);
          const dist = myCoords
            ? calcDistanceMeters(
                myCoords.lat,
                myCoords.lng,
                matchedDevice.lastLat,
                matchedDevice.lastLng
              )
            : null;
          return {
            found: true,
            message: `A rastrear ${matchedDevice.deviceName}... Alvo encontrado${
              dist !== null ? `, a ${formatDistancePt(dist)} de ti` : ''
            }.`,
          };
        }

        // 3. Privacidade: verifica se existe o ID SARA mas NÃO tem consentimento ainda
        const card = await lookupUserCardBySaraId(rawQuery, session);
        if (card) {
          setSearchCard(card);
          setSearchFeedback('Localização protegida. Envia um pedido para visualizar no mapa.');
          return {
            found: false,
            message: `${card.callName} ainda não aceitou a partilha de localização. Enviei o cartão para pedires permissão.`,
          };
        }

        return {
          found: false,
          message: `Não encontrei ninguém autorizado com "${rawQuery}". Só posso rastrear quem aceitou o pedido ou os teus aparelhos.`,
        };
      },
      getTrackedTargetStreetSpeech: async () => {
        if (!activeTargetSummary) {
          if (myCoords) {
            const addr = myAddressInfo || (await reverseGeocodeCoords(myCoords.lat, myCoords.lng));
            if (addr) {
              return `Estás agora em ${addr.street || addr.formattedAddress}${
                addr.neighborhood ? `, bairro ${addr.neighborhood}` : ''
              }${addr.city ? `, ${addr.city}` : ''}.`;
            }
          }
          return 'Nenhum alvo selecionado no radar neste momento.';
        }
        const addr =
          targetAddress ||
          (await reverseGeocodeCoords(activeTargetSummary.lat, activeTargetSummary.lng));
        if (!addr) {
          return `${activeTargetSummary.name} está nas coordenadas ${activeTargetSummary.lat.toFixed(
            4
          )}, ${activeTargetSummary.lng.toFixed(4)}.`;
        }
        return `${activeTargetSummary.name} está em ${
          addr.street || addr.formattedAddress
        }${addr.neighborhood ? `, bairro ${addr.neighborhood}` : ''}${
          addr.city ? `, ${addr.city}` : ''
        }.`;
      },
      triggerRouteToTrackedTarget: async () => {
        if (!activeTargetSummary) {
          return 'Seleciona ou rastreia um alvo primeiro para traçar a rota.';
        }
        setRouteEnabled(true);
        return `A calcular rota até ${activeTargetSummary.name}.`;
      },
      stopAllTracking: () => {
        stopRadarSonarPing();
        setSonarActive(false);
        setLockedTargetId(null);
        setRouteEnabled(false);
        setNavigationActive(false);
        setComputedRoute(null);
        setGeofence(null);
        setShowMovementHistory(false);
        return 'Rastreamento do radar parado.';
      },
    }),
    [
      sharedPeers,
      devices,
      myCoords,
      myAddressInfo,
      session,
      activeTargetSummary,
      targetAddress,
      triggerSonarLockSequence,
    ]
  );

  // Marcadores reais para o mapa
  const mapMarkers = useMemo<SaraMapMarker[]>(() => {
    const list: SaraMapMarker[] = [];

    if (myCoords) {
      list.push({
        id: 'self_me',
        lat: myCoords.lat,
        lng: myCoords.lng,
        title: `${session.callName} (Tu)`,
        subtitle: myAddressInfo?.formattedAddress || 'A tua localização real',
        badge: appearOnMap && !ghostMode ? 'TU • VISÍVEL' : 'TU (PRIVADO)',
        tone: 'self',
      });
    }

    for (const peer of sharedPeers) {
      const isLocked = activeTargetSummary?.key === `peer_${peer.saraId}`;
      list.push({
        id: `peer_${peer.saraId}`,
        lat: peer.lat,
        lng: peer.lng,
        title: `${peer.callName} (${peer.saraId})`,
        subtitle:
          peer.distanceMeters !== null
            ? `${formatDistancePt(peer.distanceMeters)} • Expira em ${formatRemainingTimePt(
                peer.expiresAt
              )}`
            : `Expira em ${formatRemainingTimePt(peer.expiresAt)}`,
        badge: `${peer.callName}${
          peer.distanceMeters !== null ? ` • ${formatDistancePt(peer.distanceMeters)}` : ''
        }`,
        tone: isLocked ? 'target_locked' : 'peer',
        avatarText: peer.callName.slice(0, 2).toUpperCase(),
      });
    }

    if (
      resolvedTrackedDevice &&
      resolvedTrackedDevice.lastLat !== null &&
      resolvedTrackedDevice.lastLng !== null
    ) {
      list.push({
        id: `dev_${resolvedTrackedDevice.deviceCode}`,
        lat: resolvedTrackedDevice.lastLat,
        lng: resolvedTrackedDevice.lastLng,
        title: `${resolvedTrackedDevice.deviceName} (${resolvedTrackedDevice.deviceCode})`,
        badge: `${resolvedTrackedDevice.deviceName}`,
        tone: 'target_locked',
        avatarText: 'CL',
      });
    }

    if (selectedPlace) {
      const isLocked = lockedTargetId === `place_${selectedPlace.id}`;
      list.push({
        id: `place_${selectedPlace.id}`,
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        title: selectedPlace.name,
        subtitle: selectedPlace.address,
        badge: selectedPlace.name.slice(0, 18),
        tone: isLocked ? 'target_locked' : 'place',
      });
    }

    return list;
  }, [
    myCoords,
    myAddressInfo,
    session.callName,
    appearOnMap,
    ghostMode,
    sharedPeers,
    activeTargetSummary?.key,
    resolvedTrackedDevice,
    selectedPlace,
    lockedTargetId,
  ]);

  const handleSearchSaraId = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = searchInput.trim();
    if (!raw) return;
    setIsSearching(true);
    setSearchFeedback('');
    setSearchCard(null);
    try {
      const card = await lookupUserCardBySaraId(raw, session);
      if (!card) {
        setSearchFeedback('Nenhuma conta encontrada com esse Identificador SARA.');
      } else {
        setSearchCard(card);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchCard) return;
    if (session.isGuest) {
      onNotify('Modo Convidado não permite pedir localização.');
      return;
    }
    setRequestBusy(true);
    try {
      await sendLocationRequest(session, searchCard);
      onNotify(`Pedido enviado para ${searchCard.callName}. A aguardar aceitação.`);
      setSearchFeedback('Pedido enviado! A localização só aparece se a pessoa aceitar.');
    } catch (err: any) {
      setSearchFeedback(err?.message || 'Não foi possível enviar o pedido.');
    } finally {
      setRequestBusy(false);
    }
  };

  const handleToggleGeofence = () => {
    if (geofence?.active) {
      setGeofence(null);
      setGeofenceAlertMsg(null);
      onNotify('Zona de Alerta desativada.');
      return;
    }
    const target = activeTargetSummary || (myCoords ? { lat: myCoords.lat, lng: myCoords.lng, name: 'Minha Zona' } : null);
    if (!target) {
      onNotify('Obtém localização ou seleciona um alvo para criar Zona de Alerta.');
      return;
    }
    setGeofence({
      id: `geo_${Date.now()}`,
      label: `Zona ${target.name}`,
      centerLat: target.lat,
      centerLng: target.lng,
      radiusMeters: 300,
      active: true,
      lastStatus: 'inside',
    });
    setGeofenceAlertMsg(null);
    onNotify(`Zona de Alerta (300 m) ativada em torno de ${target.name}.`);
  };

  const handleUpdateGeofenceRadius = (radiusMeters: number) => {
    setGeofence((prev) => (prev ? { ...prev, radiusMeters } : prev));
  };

  const handleStartLiveShare = async () => {
    if (session.isGuest) {
      onNotify('Inicia sessão numa conta para partilhar ao vivo.');
      return;
    }
    setLiveShareBusy(true);
    try {
      const coords = myCoords || (await refreshRealGps());
      if (!coords) {
        onNotify('Sem sinal GPS neste momento para gerar link ao vivo.');
        return;
      }
      const res = await createOrUpdateLiveShare({
        session,
        lat: coords.lat,
        lng: coords.lng,
        speedMps: coords.speedMps ?? null,
        batteryPct: myBatteryPct,
        addressLabel:
          myAddressInfo?.formattedAddress || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
        existingShareId: activeLiveShare?.shareId,
        durationMinutes: 60,
      });
      setActiveLiveShare({
        shareId: res.share.shareId,
        url: res.url,
        whatsappUrl: res.whatsappUrl,
      });
      onNotify('Link de localização ao vivo pronto!');
    } finally {
      setLiveShareBusy(false);
    }
  };

  const handleStopLiveShare = async () => {
    if (!activeLiveShare) return;
    await stopLiveShareSession(activeLiveShare.shareId);
    setActiveLiveShare(null);
    onNotify('Partilha ao vivo encerrada.');
  };

  const handleCaptureMapPrint = async () => {
    const el = mapWrapperRef.current;
    if (!el) return;
    setCapturingPrint(true);
    try {
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#020612',
        scale: 1.5,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `sara-radar-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.png`;
      a.click();
      onNotify('Print do Radar guardado!');
    } catch {
      onNotify('Não foi possível gerar a captura do ecrã.');
    } finally {
      setCapturingPrint(false);
    }
  };

  const handleCopyExactAddress = () => {
    const lat = activeTargetSummary?.lat ?? myCoords?.lat;
    const lng = activeTargetSummary?.lng ?? myCoords?.lng;
    const addr = activeTargetSummary ? targetAddress : myAddressInfo;
    if (lat === undefined || lng === undefined) {
      onNotify('Sem endereço disponível para copiar.');
      return;
    }
    const text = addr?.formattedAddress
      ? `${addr.formattedAddress} (${lat.toFixed(6)}, ${lng.toFixed(6)})`
      : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    navigator.clipboard?.writeText(text).catch(() => {});
    onNotify('Endereço exato copiado!');
  };

  const displayDistance = activeTargetSummary?.distanceMeters ?? null;
  const displaySpeed = formatSpeedKmh(
    activeTargetSummary ? activeTargetSummary.speedMps : myCoords?.speedMps
  );
  const displayBattery =
    activeTargetSummary && activeTargetSummary.batteryPct !== null
      ? `${activeTargetSummary.batteryPct}%`
      : myBatteryPct !== null
      ? `${myBatteryPct}%`
      : '--';

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#020612] text-white overflow-y-auto sara-scroll p-3 sm:p-4 space-y-3">
      {/* ================================================================= */}
      {/* CABEÇALHO ULTRA-TECNOLÓGICO: SARA RADAR V2 - ONLINE               */}
      {/* ================================================================= */}
      <div className="p-3 rounded-2xl bg-[#070D1D] border border-[#00E5FF]/40 shadow-[0_0_25px_rgba(0,229,255,0.12)] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-[#00E5FF]/60 flex items-center justify-center relative">
            <Radar className={`w-5 h-5 text-[#00E5FF] ${sonarActive ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black tracking-wider text-white">
                SARA RADAR V2 - ONLINE
              </h2>
              {signalSource === 'gps' && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/50 text-[10px] font-mono font-bold text-emerald-300">
                  GPS REAL
                </span>
              )}
              {(signalSource === 'ip_approx' || signalSource === 'network') && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/60 text-[10px] font-mono font-bold text-amber-200">
                  GPS desligado, localização aproximada
                </span>
              )}
              {signalSource === 'last_known' && (
                <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-400/60 text-[10px] font-mono font-bold text-rose-200">
                  Sem sinal - Última localização {formatTimeAgoPt(lastSignalTimestamp)}
                </span>
              )}
              {signalSource === 'none' && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-600 text-[10px] font-mono font-bold text-slate-300 flex items-center gap-1">
                  <WifiOff className="w-3 h-3" />
                  <span>Sem sinal GPS</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-xl">
              {myAddressInfo?.formattedAddress
                ? `Posição real atual: ${myAddressInfo.formattedAddress}`
                : 'Localização em tempo real • Núcleo SARA'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onToggleMic && (
            <button
              type="button"
              onClick={onToggleMic}
              className={`px-3.5 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition ${
                isListening
                  ? 'bg-[#00E5FF] text-[#020612] border-[#00E5FF] shadow-[0_0_20px_rgba(0,229,255,0.55)]'
                  : 'bg-[#08152E] border-[#00E5FF]/55 text-cyan-100 hover:bg-cyan-500/20'
              }`}
            >
              {isListening ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
              <span>
                {isSaraSpeaking ? 'SARA a responder...' : isListening ? 'Ouvindo Radar...' : 'Falar com SARA'}
              </span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-[#071125] border border-cyan-500/30 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
            >
              Voltar ao Palco
            </button>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* BARRA DE TELEMETRIA AO VIVO (BATERIA, VELOCIDADE, DISTÂNCIA)      */}
      {/* ================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded-xl bg-[#070D1D] border border-cyan-500/25 flex items-center gap-2.5">
          <Battery className="w-4 h-4 text-emerald-300 shrink-0" />
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-400">Bateria</div>
            <div className="text-xs font-mono font-bold text-white">{displayBattery}</div>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-[#070D1D] border border-cyan-500/25 flex items-center gap-2.5">
          <Gauge className="w-4 h-4 text-[#00E5FF] shrink-0" />
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-400">Velocidade</div>
            <div className="text-xs font-mono font-bold text-white">{displaySpeed}</div>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-[#070D1D] border border-cyan-500/25 flex items-center gap-2.5">
          <Navigation className="w-4 h-4 text-[#8B5CF6] shrink-0" />
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-400">Distância Alvo</div>
            <div className="text-xs font-mono font-bold text-white">
              {formatDistancePt(displayDistance)}
            </div>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-[#070D1D] border border-cyan-500/25 flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-[#FF2A4B] shrink-0" />
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-400">Estado Alvo</div>
            <div className="text-xs font-mono font-bold text-white truncate">
              {sonarActive
                ? 'A RASTREAR...'
                : activeTargetSummary
                ? activeTargetSummary.name
                : 'EM ESPERA'}
            </div>
          </div>
        </div>
      </div>

      {/* Alerta Geofence ativo */}
      {geofenceAlertMsg && (
        <div className="p-3 rounded-2xl bg-rose-600/25 border border-[#FF2A4B] text-xs font-extrabold text-rose-100 flex items-center justify-between gap-2 shadow-[0_0_20px_rgba(255,42,75,0.3)]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#FF2A4B] animate-bounce" />
            <span>{geofenceAlertMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setGeofenceAlertMsg(null)}
            className="text-rose-200 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3 BOTÕES DE VISÃO DO MAPA (RUAS / SATÉLITE / TERRENO) + AÇÕES     */}
      {/* ================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl p-1 bg-[#070D1D] border border-cyan-500/30 gap-1">
          <button
            type="button"
            onClick={() => setViewMode('roadmap')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
              viewMode === 'roadmap'
                ? 'bg-[#00E5FF] text-[#020612] shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Ruas</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('hybrid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
              viewMode === 'hybrid'
                ? 'bg-[#00E5FF] text-[#020612] shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>Satélite</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('terrain')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
              viewMode === 'terrain'
                ? 'bg-[#00E5FF] text-[#020612] shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>Terreno</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowMovementHistory((v) => !v)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1 cursor-pointer ${
              showMovementHistory
                ? 'bg-[#FF2A4B]/20 border-[#FF2A4B] text-rose-100'
                : 'bg-[#070D1D] border-cyan-500/30 text-slate-300 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Histórico 2h</span>
          </button>

          <button
            type="button"
            onClick={handleToggleGeofence}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1 cursor-pointer ${
              geofence?.active
                ? 'bg-amber-500/20 border-amber-400 text-amber-100'
                : 'bg-[#070D1D] border-cyan-500/30 text-slate-300 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Zona de Alerta</span>
          </button>

          <button
            type="button"
            disabled={capturingPrint}
            onClick={() => void handleCaptureMapPrint()}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold border bg-[#070D1D] border-cyan-500/30 text-cyan-200 hover:border-[#00E5FF] flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {capturingPrint ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            <span>Tirar Print do Mapa</span>
          </button>
        </div>
      </div>

      {/* Controlo de Raio da Zona de Alerta */}
      {geofence?.active && (
        <div className="p-2.5 rounded-xl bg-[#070D1D] border border-amber-400/45 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-amber-200 font-bold">
            Zona ativa em torno de {geofence.label} • Estado:{' '}
            <strong className={geofence.lastStatus === 'outside' ? 'text-rose-300' : 'text-emerald-300'}>
              {geofence.lastStatus === 'outside' ? 'FORA DA ZONA' : 'DENTRO DA ZONA'}
            </strong>
          </span>
          <div className="flex items-center gap-1">
            {[100, 300, 500, 1000].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleUpdateGeofenceRadius(r)}
                className={`px-2 py-1 rounded-lg font-mono text-[11px] font-bold cursor-pointer ${
                  geofence.radiusMeters === r
                    ? 'bg-amber-400 text-[#020612]'
                    : 'bg-[#030815] text-slate-300 border border-amber-500/30'
                }`}
              >
                {r >= 1000 ? `${r / 1000}km` : `${r}m`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MAPA REAL INTERATIVO + HOLOGRAMA SONAR                            */}
      {/* ================================================================= */}
      <div ref={mapWrapperRef} className="relative rounded-2xl">
        <FreeSaraMapView
          centerLat={activeTargetSummary?.lat ?? myCoords?.lat ?? null}
          centerLng={activeTargetSummary?.lng ?? myCoords?.lng ?? null}
          zoom={15}
          viewMode={viewMode}
          markers={mapMarkers}
          sonarActive={sonarActive}
          showPlacesSearch={true}
          movementHistory={movementHistory}
          showMovementHistory={showMovementHistory}
          geofence={geofence}
          routeOrigin={routeEnabled && myCoords ? { lat: myCoords.lat, lng: myCoords.lng } : null}
          routeDestination={
            routeEnabled && activeTargetSummary
              ? { lat: activeTargetSummary.lat, lng: activeTargetSummary.lng }
              : null
          }
          navigationActive={navigationActive}
          streetViewTarget={streetViewTarget}
          heightClassName="h-[360px] sm:h-[420px] lg:h-[470px]"
          emptyNotice={
            !myCoords
              ? 'Sem sinal GPS neste momento. Ativa o GPS do dispositivo para mostrar a tua posição real.'
              : 'Mapa privado. Liga "Aparecer no Mapa", pesquisa um lugar ou pede um Identificador SARA.'
          }
          onSelectMarker={(id) => {
            if (id.startsWith('peer_') || id.startsWith('dev_') || id.startsWith('place_')) {
              triggerSonarLockSequence(id);
            }
          }}
          onSelectPlace={(place) => {
            setSelectedPlace(place);
            setLockedTargetId(`place_${place.id}`);
            setRouteEnabled(false);
          }}
          onViewModeChange={setViewMode}
          onRouteComputed={setComputedRoute}
          onRecenterMyLocation={() => void refreshRealGps()}
          onOpenStreetViewAt={(lat, lng, label) => setStreetViewTarget({ lat, lng, label })}
          onCloseStreetView={() => setStreetViewTarget(null)}
        />
      </div>

      {/* ================================================================= */}
      {/* CARTÃO DE ALVO BLOQUEADO (RUA REAL, BAIRRO, BATERIA, ROTA, ETC.)  */}
      {/* ================================================================= */}
      {activeTargetSummary && (
        <div className="p-3.5 rounded-2xl bg-[#090E20] border border-[#FF2A4B]/60 shadow-[0_0_24px_rgba(255,42,75,0.18)] space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FF2A4B] to-[#8B5CF6] flex items-center justify-center font-black text-sm text-white shadow-lg">
                {activeTargetSummary.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-extrabold text-white">
                    {activeTargetSummary.name}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-[#FF2A4B]/50 text-[10px] font-mono text-rose-200">
                    {activeTargetSummary.subId}
                  </span>
                </div>
                <div className="text-xs text-cyan-200 mt-0.5">
                  {targetAddress ? (
                    <>
                      {targetAddress.street || targetAddress.formattedAddress}
                      {targetAddress.neighborhood ? ` • Bairro ${targetAddress.neighborhood}` : ''}
                      {targetAddress.city ? ` • ${targetAddress.city}` : ''}
                    </>
                  ) : (
                    `Coordenadas reais: ${activeTargetSummary.lat.toFixed(5)}, ${activeTargetSummary.lng.toFixed(5)}`
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                stopRadarSonarPing();
                setSonarActive(false);
                setLockedTargetId(null);
                setRouteEnabled(false);
                setNavigationActive(false);
                setComputedRoute(null);
              }}
              className="px-2.5 py-1 rounded-lg bg-[#030815] border border-slate-600 text-xs text-slate-300 hover:text-white cursor-pointer"
            >
              Libertar Alvo
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono bg-[#040916] p-2.5 rounded-xl border border-cyan-500/20">
            <div>
              <span className="text-slate-400">Distância:</span>{' '}
              <strong className="text-[#00E5FF]">
                {formatDistancePt(activeTargetSummary.distanceMeters)}
              </strong>
            </div>
            <div>
              <span className="text-slate-400">Velocidade:</span>{' '}
              <strong className="text-white">{formatSpeedKmh(activeTargetSummary.speedMps)}</strong>
            </div>
            <div>
              <span className="text-slate-400">Bateria:</span>{' '}
              <strong className="text-emerald-300">
                {activeTargetSummary.batteryPct !== null ? `${activeTargetSummary.batteryPct}%` : '--'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400">No local:</span>{' '}
              <strong className="text-amber-300">
                {stationedTracker?.sinceIso
                  ? formatTimeAgoPt(stationedTracker.sinceIso)
                  : activeTargetSummary.stationedSince
                  ? formatTimeAgoPt(activeTargetSummary.stationedSince)
                  : 'agora mesmo'}
              </strong>
            </div>
          </div>

          {/* Botões de Ação do Alvo */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!myCoords) {
                  onNotify('Precisas de localização ativa para traçar rota até lá.');
                  return;
                }
                setRouteEnabled((v) => !v);
                if (routeEnabled) setNavigationActive(false);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer border ${
                routeEnabled
                  ? 'bg-[#00E5FF] text-[#020612] border-[#00E5FF]'
                  : 'bg-cyan-500/15 border-cyan-400/50 text-cyan-100 hover:bg-cyan-500/25'
              }`}
            >
              <RouteIcon className="w-3.5 h-3.5" />
              <span>{routeEnabled ? 'Ocultar Rota' : 'Rota até lá'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setStreetViewTarget({
                  lat: activeTargetSummary.lat,
                  lng: activeTargetSummary.lng,
                  label: activeTargetSummary.name,
                })
              }
              className="px-3 py-2 rounded-xl bg-purple-500/20 border border-[#8B5CF6]/60 text-purple-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-purple-500/30"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ver Rua</span>
            </button>

            <button
              type="button"
              onClick={handleCopyExactAddress}
              className="px-3 py-2 rounded-xl bg-[#030815] border border-cyan-500/35 text-cyan-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:border-[#00E5FF]"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar Endereço Exato</span>
            </button>

            {routeEnabled && computedRoute && (
              <button
                type="button"
                onClick={() => setNavigationActive((v) => !v)}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer border ${
                  navigationActive
                    ? 'bg-emerald-500 text-[#020612] border-emerald-400'
                    : 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{navigationActive ? 'Navegação Ativa' : 'Iniciar Navegação'}</span>
              </button>
            )}
          </div>

          {routeEnabled && computedRoute && (
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-[#00E5FF]/45 text-xs text-cyan-100 flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">
                Trajeto: {formatDistancePt(computedRoute.distanceMeters)} •{' '}
                {formatDurationMinutes(computedRoute.durationSeconds)} de carro,{' '}
                {formatDurationMinutes(computedRoute.chapaDurationSeconds)} de chapa
              </span>
              {navigationActive && (
                <span className="text-[11px] font-mono text-emerald-300 animate-pulse">
                  ACOMPANHAMENTO EM TEMPO REAL
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* BARRA DE PRIVACIDADE + PARTILHA AO VIVO (WHATSAPP) + PESQUISA ID  */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-2">
        <button
          type="button"
          onClick={onToggleAppearOnMap}
          className={`py-3 px-3 rounded-2xl border text-xs font-extrabold tracking-wide flex items-center justify-center gap-2 transition cursor-pointer ${
            appearOnMap && !ghostMode
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
              : 'bg-[#070D1D] border-cyan-500/35 text-slate-200 hover:border-cyan-400'
          }`}
        >
          <Radio
            className={`w-4 h-4 ${
              appearOnMap && !ghostMode ? 'text-emerald-400 animate-pulse' : 'text-slate-400'
            }`}
          />
          <span>Aparecer no Mapa - {appearOnMap && !ghostMode ? 'LIGADO' : 'DESLIGADO'}</span>
        </button>

        <button
          type="button"
          onClick={onStopSharingAll}
          className="py-3 px-3 rounded-2xl bg-rose-500/15 border border-rose-500/45 text-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-rose-500/25 cursor-pointer"
        >
          <ShieldOff className="w-4 h-4" />
          <span>Parar de Partilhar</span>
        </button>

        <button
          type="button"
          onClick={onActivateGhostMode}
          className={`py-3 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
            ghostMode
              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
              : 'bg-[#070D1D] border-cyan-500/30 text-cyan-200 hover:border-amber-400/60'
          }`}
        >
          <Ghost className="w-4 h-4" />
          <span>Modo Fantasma</span>
        </button>

        <button
          type="button"
          disabled={liveShareBusy}
          onClick={() => void (activeLiveShare ? handleStopLiveShare() : handleStartLiveShare())}
          className={`py-3 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
            activeLiveShare
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100'
              : 'bg-[#070D1D] border-[#8B5CF6]/45 text-purple-200 hover:border-[#00E5FF]'
          }`}
        >
          {liveShareBusy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : activeLiveShare ? (
            <Square className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
          <span>
            {activeLiveShare ? 'Parar Link ao Vivo' : 'Compartilhar Localização ao Vivo'}
          </span>
        </button>
      </div>

      {/* Cartão Link ao Vivo + Botão WhatsApp */}
      {activeLiveShare && (
        <div className="p-3 rounded-2xl bg-[#071525] border border-emerald-400/50 flex flex-wrap items-center justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-extrabold text-emerald-200">
              Localização ao Vivo Ativa
            </div>
            <div className="text-[11px] font-mono text-slate-300 truncate">
              {activeLiveShare.url}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(activeLiveShare.url).catch(() => {});
                onNotify('Link ao vivo copiado!');
              }}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar Link</span>
            </button>
            <a
              href={activeLiveShare.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-500 text-[#020612] text-xs font-extrabold flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Enviar no WhatsApp</span>
            </a>
          </div>
        </div>
      )}

      {/* Pesquisar por Identificador SARA */}
      <form onSubmit={handleSearchSaraId} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            placeholder="Pesquisar por Identificador SARA (ex: SARA-1234)..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#070D1D] border border-cyan-500/35 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#00E5FF]"
          />
        </div>
        <button
          type="submit"
          disabled={isSearching}
          className="px-4 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 text-xs font-bold hover:bg-cyan-500/30 transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span>Pesquisar</span>
        </button>
      </form>

      {/* Cartão encontrado (NUNCA mostra coordenadas diretamente — apenas Pedir Localização) */}
      {(searchCard || searchFeedback) && (
        <div className="p-3 rounded-2xl bg-[#071126] border border-cyan-500/40 flex flex-wrap items-center justify-between gap-3">
          {searchCard ? (
            <>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>{searchCard.callName}</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/40 text-[10px] font-mono text-cyan-200">
                    {searchCard.saraId}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {searchFeedback || 'Localização protegida. Envia um pedido para visualizar no mapa.'}
                </div>
              </div>
              {searchCard.saraId !== session.saraId && (
                <button
                  type="button"
                  onClick={() => void handleSendRequest()}
                  disabled={requestBusy}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#00E5FF] to-emerald-400 text-[#020612] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer hover:opacity-95 disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{requestBusy ? 'A enviar...' : 'Pedir Localização'}</span>
                </button>
              )}
            </>
          ) : (
            <span className="text-xs text-amber-300">{searchFeedback}</span>
          )}
        </div>
      )}

      {/* Pedidos recebidos */}
      {incomingPending.length > 0 && (
        <div className="space-y-2">
          {incomingPending.map((req) => (
            <div
              key={req.id}
              className="p-3 rounded-2xl bg-[#091834] border border-[#00E5FF]/60 shadow-[0_0_20px_rgba(0,229,255,0.2)] flex flex-wrap items-center justify-between gap-2.5"
            >
              <div>
                <div className="text-xs font-bold text-white">
                  {req.fromCallName} ({req.fromSaraId}) pediu a tua localização
                </div>
                <div className="text-[11px] text-cyan-200/80">
                  Escolhe se queres partilhar em tempo real ou recusar.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    await respondToLocationRequest(req, '30m');
                    onNotify(`Partilha com ${req.fromCallName} aceite por 30min.`);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/60 text-emerald-200 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-emerald-500/30"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Aceitar por 30min</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await respondToLocationRequest(req, '1h');
                    onNotify(`Partilha com ${req.fromCallName} aceite por 1h.`);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-cyan-500/30"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Aceitar por 1h</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await respondToLocationRequest(req, 'decline');
                    onNotify('Pedido recusado.');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/60 text-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-rose-500/30"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Recusar</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Listas de Pessoas Visíveis Agora & Quem Vê a Tua Localização */}
      {(sharedPeers.length > 0 || outgoingGrants.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {sharedPeers.length > 0 && (
            <div className="p-3 rounded-2xl bg-[#070D1D] border border-emerald-500/35 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-widest text-emerald-300 font-bold flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5" />
                <span>Pessoas Visíveis Agora ({sharedPeers.length})</span>
              </div>
              {sharedPeers.map((peer) => {
                const isLocked = activeTargetSummary?.key === `peer_${peer.saraId}`;
                return (
                  <div
                    key={peer.saraId}
                    className={`p-2.5 rounded-xl bg-[#030815] border flex items-center justify-between gap-2 text-xs ${
                      isLocked ? 'border-[#FF2A4B]' : 'border-cyan-500/25'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-white">
                        {peer.callName}{' '}
                        <span className="font-mono text-[10px] text-cyan-300">({peer.saraId})</span>
                      </div>
                      <div className="text-[11px] text-emerald-300">
                        Distância: {formatDistancePt(peer.distanceMeters)} • Expira em{' '}
                        {formatRemainingTimePt(peer.expiresAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerSonarLockSequence(`peer_${peer.saraId}`)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#00E5FF]/20 border border-[#00E5FF]/60 text-[#00E5FF] text-[11px] font-extrabold cursor-pointer"
                    >
                      {isLocked ? 'Rastreado' : 'Rastrear'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {outgoingGrants.length > 0 && (
            <div className="p-3 rounded-2xl bg-[#070D1D] border border-cyan-500/35 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-widest text-cyan-300 font-bold">
                Quem Vê a Tua Localização ({outgoingGrants.length})
              </div>
              {outgoingGrants.map((grant) => (
                <div
                  key={grant.id}
                  className="p-2.5 rounded-xl bg-[#030815] border border-cyan-500/25 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-bold text-white">
                      {grant.fromCallName} ({grant.fromSaraId})
                    </div>
                    <div className="text-[11px] text-cyan-300">
                      Restam {formatRemainingTimePt(grant.expiresAt)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void stopSingleShare(grant)}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-200 text-[11px] font-bold cursor-pointer hover:bg-rose-500/30"
                  >
                    Revogar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
