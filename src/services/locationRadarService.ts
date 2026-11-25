import type { SaraSession, SaraUserAccount } from '../types/auth';
import type {
  DeviceLockState,
  GeocodedAddressInfo,
  GeofenceZone,
  GpsCoordinateResult,
  LiveShareRecord,
  LocationRequestItem,
  MovementHistoryPoint,
  RadarPlaceResult,
  RadarPresence,
  RemoteDeviceCommand,
  SaraDeviceRecord,
  SharedPeerLocation,
} from '../types/location';
import {
  clearLocalDeviceRegistryCache,
  getOrCreateDeviceCode,
  verifySessionAccountPassword,
} from './authService';
import {
  fetchLiveShareCloud,
  fetchRadarPresenceCloud,
  fetchUserDevicesCloud,
  issueDeviceCommandCloud,
  lookupUserBySaraIdCloud,
  saveLiveShareCloud,
  saveLocationRequestCloud,
  saveRadarPresenceCloud,
  saveUserDeviceCloud,
  subscribeLiveShareCloud,
  subscribeLocationRequestsForUserCloud,
  subscribeRadarPresenceByIdsCloud,
  subscribeUserDevicesCloud,
} from './firebaseService';

const RADAR_PRESENCE_LOCAL_KEY = 'sara_radar_presence_map_v1';
const RADAR_VISIBILITY_PREF_KEY = 'sara_radar_visible_pref_v1';
const LOCATION_REQUESTS_LOCAL_KEY = 'sara_location_requests_v1';
const USER_DEVICES_LOCAL_KEY = 'sara_user_devices_local_v1';
const DEVICE_LOCK_KEY = 'sara_device_lock_state_v1';
const OFFLINE_SINCE_KEY = 'sara_device_offline_since_v1';
const SOS_SENT_MARKER_KEY = 'sara_sos_last_sent_at_v1';
const ACCOUNTS_KEY = 'sara_accounts_v1';
const LAST_KNOWN_REAL_COORDS_KEY = 'sara_last_real_coords_v2';
const MOVEMENT_HISTORY_2H_KEY = 'sara_movement_history_2h_v2';
const LIVE_SHARES_LOCAL_KEY = 'sara_live_shares_local_v2';

const RADAR_CHANNEL_NAME = 'sara_location_radar_channel_v1';
export const FIVE_MINUTES_MS = 5 * 60 * 1000;
export const ONE_HOUR_MS = 60 * 60 * 1000;
export const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function readJsonRecord<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonRecord<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota
  }
}

function postRadarBroadcast(payload: Record<string, unknown>): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(RADAR_CHANNEL_NAME);
      ch.postMessage(payload);
      ch.close();
    }
  } catch {
    // ignore
  }
}

export function subscribeRadarBroadcast(
  handler: (payload: Record<string, unknown>) => void
): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  try {
    const ch = new BroadcastChannel(RADAR_CHANNEL_NAME);
    ch.onmessage = (ev) => {
      if (ev?.data && typeof ev.data === 'object') {
        handler(ev.data as Record<string, unknown>);
      }
    };
    return () => ch.close();
  } catch {
    return () => {};
  }
}

export function normalizeSaraId(raw: string): string {
  const cleaned = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('SARA-')) return cleaned;
  if (/^[A-Z0-9]{4}$/.test(cleaned)) return `SARA-${cleaned}`;
  return cleaned;
}

export function calcDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function formatDistancePt(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || Number.isNaN(meters)) return '--';
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} m`;
  return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`;
}

export function formatTimeAgoPt(isoOrMs: string | number | null | undefined): string {
  if (!isoOrMs) return 'sem registo';
  const ts = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
  if (!ts || Number.isNaN(ts)) return 'sem registo';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'agora mesmo';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  const diffDays = Math.floor(diffHours / 24);
  return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
}

export function formatRemainingTimePt(expiresAt?: number): string {
  if (!expiresAt) return '';
  const diffSec = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  if (diffSec <= 0) return 'expirado';
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const remM = mins % 60;
    return `${h}h ${String(remM).padStart(2, '0')}m`;
  }
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export function formatSpeedKmh(speedMps: number | null | undefined): string {
  if (speedMps === null || speedMps === undefined || Number.isNaN(speedMps) || speedMps < 0) {
    return '0 km/h';
  }
  const kmh = Math.round(speedMps * 3.6);
  return `${kmh} km/h`;
}

export function computeSpeedMps(
  prev: { lat: number; lng: number; timestamp: number } | null,
  next: { lat: number; lng: number; timestamp: number },
  reportedSpeedMps: number | null | undefined
): number | null {
  if (typeof reportedSpeedMps === 'number' && Number.isFinite(reportedSpeedMps) && reportedSpeedMps >= 0) {
    return Number(reportedSpeedMps.toFixed(2));
  }
  if (!prev) return null;
  const dtSec = (next.timestamp - prev.timestamp) / 1000;
  if (dtSec <= 1 || dtSec > 300) return null;
  const distM = calcDistanceMeters(prev.lat, prev.lng, next.lat, next.lng);
  if (distM < 4) return 0;
  return Number((distM / dtSec).toFixed(2));
}

export function evaluateStationedSince(
  prevCoords: { lat: number; lng: number } | null,
  prevSinceIso: string | null | undefined,
  nextLat: number,
  nextLng: number
): string {
  if (prevCoords && prevSinceIso) {
    const moved = calcDistanceMeters(prevCoords.lat, prevCoords.lng, nextLat, nextLng);
    if (moved <= 45) return prevSinceIso;
  }
  return new Date().toISOString();
}

export function detectDeviceNameAndModel(): {
  deviceName: string;
  model: string;
  platform: 'PC' | 'Telemóvel';
} {
  if (typeof navigator === 'undefined') {
    return { deviceName: 'Computador SARA', model: 'Desktop Browser', platform: 'PC' };
  }
  const ua = navigator.userAgent || '';
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua) ||
    (typeof window !== 'undefined' && window.innerWidth <= 768);
  const platform: 'PC' | 'Telemóvel' = isMobile ? 'Telemóvel' : 'PC';

  let os = 'Sistema';
  if (/Android/i.test(ua)) {
    const m = ua.match(/Android\s+([\d.]+)/i);
    os = m ? `Android ${m[1]}` : 'Android';
  } else if (/iPhone/i.test(ua)) {
    os = 'iPhone iOS';
  } else if (/iPad/i.test(ua)) {
    os = 'iPad iPadOS';
  } else if (/Windows NT/i.test(ua)) {
    os = 'Windows';
  } else if (/Mac OS X/i.test(ua)) {
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  let browser = 'Navegador';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  const androidModel = ua.match(/Android[^;)]*;\s*([^;)]+?)(?:\s+Build\/|\))/i);
  const rawModel = androidModel?.[1]?.trim();
  const model =
    rawModel && !/wv|linux|u;/i.test(rawModel)
      ? `${rawModel} (${os})`
      : `${os} • ${browser}`;

  const deviceName = isMobile
    ? /iPhone/i.test(ua)
      ? 'Meu iPhone'
      : 'Meu Telemóvel'
    : `Meu ${os}`;

  return { deviceName, model, platform };
}

export async function readDeviceBatteryStatus(): Promise<{
  batteryPct: number | null;
  batteryCharging: boolean;
}> {
  try {
    const navAny = navigator as unknown as {
      getBattery?: () => Promise<{ level: number; charging: boolean }>;
    };
    if (typeof navAny?.getBattery === 'function') {
      const bat = await navAny.getBattery();
      return {
        batteryPct: Math.round((bat.level ?? 1) * 100),
        batteryCharging: Boolean(bat.charging),
      };
    }
  } catch {
    // ignore
  }
  return { batteryPct: null, batteryCharging: false };
}

export function getLastSavedRealCoords(): GpsCoordinateResult | null {
  const saved = readJsonRecord<GpsCoordinateResult | null>(LAST_KNOWN_REAL_COORDS_KEY, null);
  if (
    saved &&
    typeof saved.lat === 'number' &&
    typeof saved.lng === 'number' &&
    Number.isFinite(saved.lat) &&
    Number.isFinite(saved.lng)
  ) {
    return saved;
  }
  return null;
}

function saveLastRealCoords(res: GpsCoordinateResult): void {
  writeJsonRecord(LAST_KNOWN_REAL_COORDS_KEY, res);
}

function getBrowserGeoPosition(
  highAccuracy: boolean,
  timeoutMs: number
): Promise<GpsCoordinateResult | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const result: GpsCoordinateResult = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracyM:
            typeof pos.coords.accuracy === 'number' ? Math.round(pos.coords.accuracy) : null,
          speedMps:
            typeof pos.coords.speed === 'number' && Number.isFinite(pos.coords.speed)
              ? Number(pos.coords.speed.toFixed(2))
              : null,
          timestamp: Date.now(),
          source: highAccuracy ? 'gps' : 'network',
        };
        saveLastRealCoords(result);
        resolve(result);
      },
      () => resolve(null),
      {
        enableHighAccuracy: highAccuracy,
        timeout: timeoutMs,
        maximumAge: highAccuracy ? 15000 : 45000,
      }
    );
  });
}

export async function requestRealCoordinatesWithFallback(
  timeoutMs = 11000
): Promise<GpsCoordinateResult | null> {
  // 1. GPS real de alta precisão
  const gps = await getBrowserGeoPosition(true, timeoutMs);
  if (gps) return gps;

  // 2. Localização de rede do navegador (aproximada caso GPS desligado)
  const network = await getBrowserGeoPosition(false, 6500);
  if (network) return network;

  // 3. Fallback aproximado pela ligação de internet (nunca inventa cidade fixa!)
  try {
    const res = await fetch('/api/maps/approx-location', { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = (await res.json()) as { lat?: number; lng?: number };
      if (
        typeof data.lat === 'number' &&
        typeof data.lng === 'number' &&
        Number.isFinite(data.lat) &&
        Number.isFinite(data.lng)
      ) {
        const approx: GpsCoordinateResult = {
          lat: Number(data.lat.toFixed(6)),
          lng: Number(data.lng.toFixed(6)),
          accuracyM: 3500,
          speedMps: null,
          timestamp: Date.now(),
          source: 'ip_approx',
        };
        saveLastRealCoords(approx);
        return approx;
      }
    }
  } catch {
    // offline
  }

  return null;
}

export async function requestCurrentCoordinates(
  highAccuracy = true,
  timeoutMs = 12000
): Promise<GpsCoordinateResult | null> {
  if (highAccuracy) {
    return requestRealCoordinatesWithFallback(timeoutMs);
  }
  const network = await getBrowserGeoPosition(false, timeoutMs);
  if (network) return network;
  return requestRealCoordinatesWithFallback(timeoutMs);
}

// =========================================================================
// ENDEREÇO REAL (REVERSE GEOCODING VIA PROXY SERVIDOR - MOÇAMBIQUE PT)
// =========================================================================

const reverseGeocodeMemoryCache = new Map<string, GeocodedAddressInfo>();

export async function reverseGeocodeCoords(
  lat: number,
  lng: number
): Promise<GeocodedAddressInfo | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
  const cached = reverseGeocodeMemoryCache.get(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch('/api/maps/reverse-geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<GeocodedAddressInfo>;
    const info: GeocodedAddressInfo = {
      formattedAddress: data.formattedAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      street: data.street || '',
      neighborhood: data.neighborhood || '',
      city: data.city || '',
      country: data.country || '',
      placeId: data.placeId,
      updatedAt: new Date().toISOString(),
    };
    reverseGeocodeMemoryCache.set(cacheKey, info);
    return info;
  } catch {
    return null;
  }
}

export async function searchFreeRadarPlaces(
  query: string,
  biasCoords?: { lat: number; lng: number } | null
): Promise<RadarPlaceResult[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];
  try {
    const res = await fetch('/api/maps/search-places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: clean,
        lat: biasCoords?.lat,
        lng: biasCoords?.lng,
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        id: string;
        name: string;
        address?: string;
        lat: number;
        lng: number;
        categoryLabel?: string;
      }>;
    };
    return (data?.results || []).map((item) => ({
      ...item,
      distanceMeters: biasCoords
        ? calcDistanceMeters(biasCoords.lat, biasCoords.lng, item.lat, item.lng)
        : null,
    }));
  } catch {
    return [];
  }
}

export async function computeFreeRadarRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{
  distanceMeters: number;
  durationSeconds: number;
  chapaDurationSeconds: number;
  path: Array<[number, number]>;
} | null> {
  try {
    const res = await fetch('/api/maps/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      distanceMeters?: number;
      durationSeconds?: number;
      path?: Array<[number, number]>;
    };
    if (!data?.ok || !Array.isArray(data.path) || data.path.length < 2) return null;
    const distanceMeters = Math.round(Number(data.distanceMeters ?? 0));
    const durationSeconds = Math.max(60, Math.round(Number(data.durationSeconds ?? 60)));
    const chapaDurationSeconds = Math.round(durationSeconds * 1.55 + 180);
    return {
      distanceMeters,
      durationSeconds,
      chapaDurationSeconds,
      path: data.path,
    };
  } catch {
    return null;
  }
}

// =========================================================================
// HISTÓRICO DE MOVIMENTO (EXCLUSIVO ÚLTIMAS 2 HORAS)
// =========================================================================

export function getMovementHistory2h(targetKey: string): MovementHistoryPoint[] {
  if (!targetKey) return [];
  const all = readJsonRecord<Record<string, MovementHistoryPoint[]>>(MOVEMENT_HISTORY_2H_KEY, {});
  const cutoff = Date.now() - TWO_HOURS_MS;
  const rawList = Array.isArray(all[targetKey]) ? all[targetKey] : [];
  const pruned = rawList.filter(
    (p) =>
      p &&
      typeof p.lat === 'number' &&
      typeof p.lng === 'number' &&
      typeof p.timestamp === 'number' &&
      p.timestamp >= cutoff
  );
  if (pruned.length !== rawList.length) {
    all[targetKey] = pruned;
    writeJsonRecord(MOVEMENT_HISTORY_2H_KEY, all);
  }
  return pruned;
}

export function appendMovementPoint(
  targetKey: string,
  point: MovementHistoryPoint
): MovementHistoryPoint[] {
  if (!targetKey || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    return [];
  }
  const all = readJsonRecord<Record<string, MovementHistoryPoint[]>>(MOVEMENT_HISTORY_2H_KEY, {});
  const cutoff = Date.now() - TWO_HOURS_MS;
  const existing = (Array.isArray(all[targetKey]) ? all[targetKey] : []).filter(
    (p) => p && typeof p.timestamp === 'number' && p.timestamp >= cutoff
  );

  const last = existing[existing.length - 1];
  if (last) {
    const distM = calcDistanceMeters(last.lat, last.lng, point.lat, point.lng);
    const dtMs = point.timestamp - last.timestamp;
    if (distM < 8 && dtMs < 25000) {
      return existing;
    }
  }

  const next = [...existing, point].slice(-240);
  all[targetKey] = next;
  writeJsonRecord(MOVEMENT_HISTORY_2H_KEY, all);
  return next;
}

export function clearMovementHistory2h(targetKey: string): void {
  if (!targetKey) return;
  const all = readJsonRecord<Record<string, MovementHistoryPoint[]>>(MOVEMENT_HISTORY_2H_KEY, {});
  delete all[targetKey];
  writeJsonRecord(MOVEMENT_HISTORY_2H_KEY, all);
}

// =========================================================================
// ZONA DE ALERTA (GEOFENCE)
// =========================================================================

export function evaluateGeofenceTransition(
  zone: GeofenceZone | null,
  targetLat: number | null | undefined,
  targetLng: number | null | undefined
): {
  status: 'inside' | 'outside';
  transitioned: boolean;
  eventText?: string;
} | null {
  if (
    !zone ||
    !zone.active ||
    typeof targetLat !== 'number' ||
    typeof targetLng !== 'number'
  ) {
    return null;
  }
  const dist = calcDistanceMeters(zone.centerLat, zone.centerLng, targetLat, targetLng);
  const status: 'inside' | 'outside' = dist <= zone.radiusMeters ? 'inside' : 'outside';
  const transitioned = Boolean(zone.lastStatus && zone.lastStatus !== status);
  return {
    status,
    transitioned,
    eventText: transitioned
      ? status === 'outside'
        ? 'Alerta: Alvo saiu da zona'
        : 'Alerta: Alvo entrou na zona'
      : undefined,
  };
}

// =========================================================================
// SONAR ACÚSTICO RADAR ("BIP... BIP... BIP") & ALERTA ZONA
// =========================================================================

let sonarIntervalHandle: number | null = null;
let sharedAudioCtx: AudioContext | null = null;

function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playSingleSonarPing(): void {
  try {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.exponentialRampToValueAtTime(940, now + 0.14);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  } catch {
    // ignore audio policy block
  }
}

export function startRadarSonarPing(): void {
  stopRadarSonarPing();
  playSingleSonarPing();
  if (typeof window !== 'undefined') {
    sonarIntervalHandle = window.setInterval(() => {
      playSingleSonarPing();
    }, 1250);
  }
}

export function stopRadarSonarPing(): void {
  if (sonarIntervalHandle !== null && typeof window !== 'undefined') {
    window.clearInterval(sonarIntervalHandle);
    sonarIntervalHandle = null;
  }
}

export function playGeofenceAlertBeep(): void {
  try {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.22, 0.44].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now + offset);
      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.14, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.18);
    });
  } catch {
    // ignore
  }
}

// =========================================================================
// PARTILHA AO VIVO COM LINK & WHATSAPP
// =========================================================================

export async function createOrUpdateLiveShare(params: {
  session: SaraSession;
  lat: number;
  lng: number;
  speedMps: number | null;
  batteryPct: number | null;
  addressLabel: string;
  existingShareId?: string;
  durationMinutes?: 30 | 60;
}): Promise<{ share: LiveShareRecord; url: string; whatsappUrl: string }> {
  const nowMs = Date.now();
  const shareId =
    params.existingShareId ||
    `live_${(params.session.saraId || 'SARA').replace(/[^A-Z0-9]/gi, '')}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  const existingAll = readJsonRecord<Record<string, LiveShareRecord>>(LIVE_SHARES_LOCAL_KEY, {});
  const prev = existingAll[shareId];

  const share: LiveShareRecord = {
    shareId,
    ownerUid: params.session.userId,
    saraId: params.session.saraId || 'SARA-0000',
    callName: params.session.callName,
    deviceCode: params.session.deviceCode || getOrCreateDeviceCode(),
    lat: params.lat,
    lng: params.lng,
    speedMps: params.speedMps,
    batteryPct: params.batteryPct,
    addressLabel: params.addressLabel || `${params.lat.toFixed(5)}, ${params.lng.toFixed(5)}`,
    active: true,
    createdAt: prev?.createdAt || new Date(nowMs).toISOString(),
    expiresAt: prev?.expiresAt || nowMs + (params.durationMinutes || 60) * 60 * 1000,
    updatedAt: new Date(nowMs).toISOString(),
  };

  existingAll[shareId] = share;
  writeJsonRecord(LIVE_SHARES_LOCAL_KEY, existingAll);
  postRadarBroadcast({ type: 'live_share_updated', shareId });
  await saveLiveShareCloud(share);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}/?live=${encodeURIComponent(shareId)}`;
  const text = `Acompanha a minha localização ao vivo no Radar SARA (${params.session.callName}): ${url}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

  return { share, url, whatsappUrl };
}

export async function stopLiveShareSession(shareId: string): Promise<void> {
  if (!shareId) return;
  const existingAll = readJsonRecord<Record<string, LiveShareRecord>>(LIVE_SHARES_LOCAL_KEY, {});
  const target = existingAll[shareId];
  if (target) {
    const stopped: LiveShareRecord = {
      ...target,
      active: false,
      expiresAt: Date.now(),
      updatedAt: new Date().toISOString(),
    };
    existingAll[shareId] = stopped;
    writeJsonRecord(LIVE_SHARES_LOCAL_KEY, existingAll);
    postRadarBroadcast({ type: 'live_share_updated', shareId });
    await saveLiveShareCloud(stopped);
  }
}

export function subscribeLiveShareSession(
  shareId: string,
  onUpdate: (record: LiveShareRecord | null) => void
): () => void {
  if (!shareId) {
    onUpdate(null);
    return () => {};
  }

  const readLocal = () => {
    const all = readJsonRecord<Record<string, LiveShareRecord>>(LIVE_SHARES_LOCAL_KEY, {});
    return all[shareId] || null;
  };

  const initial = readLocal();
  if (initial) onUpdate(initial);

  void fetchLiveShareCloud(shareId).then((cloud) => {
    if (cloud) {
      const all = readJsonRecord<Record<string, LiveShareRecord>>(LIVE_SHARES_LOCAL_KEY, {});
      all[shareId] = cloud;
      writeJsonRecord(LIVE_SHARES_LOCAL_KEY, all);
      onUpdate(cloud);
    }
  });

  const unsubCloud = subscribeLiveShareCloud(shareId, (cloud) => {
    if (cloud) {
      const all = readJsonRecord<Record<string, LiveShareRecord>>(LIVE_SHARES_LOCAL_KEY, {});
      all[shareId] = cloud;
      writeJsonRecord(LIVE_SHARES_LOCAL_KEY, all);
      onUpdate(cloud);
    } else {
      onUpdate(readLocal());
    }
  });

  const unsubBc = subscribeRadarBroadcast((ev) => {
    if (ev.type === 'live_share_updated' && ev.shareId === shareId) {
      onUpdate(readLocal());
    }
  });

  return () => {
    unsubCloud();
    unsubBc();
  };
}

// =========================================================================
// PARTE 2 — RADAR & PRIVACIDADE (COMEÇA DESLIGADO)
// =========================================================================

export function getSavedRadarVisibilityPref(uid?: string): boolean {
  if (!uid || uid.startsWith('guest_')) return false;
  const prefs = readJsonRecord<Record<string, boolean>>(RADAR_VISIBILITY_PREF_KEY, {});
  return Boolean(prefs[uid] === true);
}

export function setSavedRadarVisibilityPref(uid: string | undefined, enabled: boolean): void {
  if (!uid || uid.startsWith('guest_')) return;
  const prefs = readJsonRecord<Record<string, boolean>>(RADAR_VISIBILITY_PREF_KEY, {});
  prefs[uid] = Boolean(enabled);
  writeJsonRecord(RADAR_VISIBILITY_PREF_KEY, prefs);
}

export async function publishCurrentRadarPresence(params: {
  session: SaraSession | null;
  visible: boolean;
  ghostMode: boolean;
  coords?: { lat: number; lng: number; accuracyM?: number | null; speedMps?: number | null } | null;
  batteryPct?: number | null;
}): Promise<RadarPresence | null> {
  const { session, visible, ghostMode, coords } = params;
  if (!session || session.isGuest || !session.saraId) return null;

  const map = readJsonRecord<Record<string, RadarPresence>>(RADAR_PRESENCE_LOCAL_KEY, {});
  const prev = map[session.saraId];
  const effectivelyVisible = Boolean(visible && !ghostMode && coords);

  let nextBattery = params.batteryPct ?? prev?.batteryPct ?? null;
  if (nextBattery === null) {
    const bat = await readDeviceBatteryStatus();
    nextBattery = bat.batteryPct;
  }

  const stationedSince =
    effectivelyVisible && coords
      ? evaluateStationedSince(
          prev?.lat !== null && prev?.lat !== undefined && prev?.lng !== null && prev?.lng !== undefined
            ? { lat: prev.lat, lng: prev.lng }
            : null,
          prev?.stationedSince,
          coords.lat,
          coords.lng
        )
      : null;

  const presence: RadarPresence = {
    saraId: session.saraId,
    uid: session.userId,
    callName: session.callName,
    visible: effectivelyVisible,
    ghostMode: Boolean(ghostMode),
    lat: effectivelyVisible && coords ? coords.lat : null,
    lng: effectivelyVisible && coords ? coords.lng : null,
    accuracyM: effectivelyVisible && coords ? coords.accuracyM ?? null : null,
    speedMps: effectivelyVisible && coords ? coords.speedMps ?? null : null,
    batteryPct: effectivelyVisible ? nextBattery : null,
    stationedSince,
    updatedAt: new Date().toISOString(),
  };

  map[session.saraId] = presence;
  writeJsonRecord(RADAR_PRESENCE_LOCAL_KEY, map);
  postRadarBroadcast({ type: 'presence_updated', saraId: session.saraId });
  await saveRadarPresenceCloud(presence);
  return presence;
}

export async function hideFromRadarImmediately(session: SaraSession | null): Promise<void> {
  if (!session || session.isGuest || !session.saraId) return;
  setSavedRadarVisibilityPref(session.userId, false);
  await publishCurrentRadarPresence({
    session,
    visible: false,
    ghostMode: true,
    coords: null,
  });
}

export async function lookupUserCardBySaraId(
  rawSaraId: string,
  callerSession: SaraSession | null
): Promise<{ saraId: string; uid: string; callName: string } | null> {
  const normalized = normalizeSaraId(rawSaraId);
  if (!/^SARA-[A-Z0-9]{4}$/.test(normalized)) return null;
  if (callerSession?.saraId === normalized) {
    return {
      saraId: normalized,
      uid: callerSession.userId,
      callName: callerSession.callName,
    };
  }

  const cloudFound = await lookupUserBySaraIdCloud(normalized);
  if (cloudFound) return cloudFound;

  try {
    const accountsRaw = localStorage.getItem(ACCOUNTS_KEY);
    if (accountsRaw) {
      const accounts = JSON.parse(accountsRaw) as SaraUserAccount[];
      const matched = accounts.find(
        (a) => String(a.saraId || '').toUpperCase() === normalized
      );
      if (matched) {
        return {
          saraId: normalized,
          uid: matched.uid,
          callName: matched.callName || matched.fullName || 'Utilizador SARA',
        };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function readLocalLocationRequests(): LocationRequestItem[] {
  return readJsonRecord<LocationRequestItem[]>(LOCATION_REQUESTS_LOCAL_KEY, []);
}

export function upsertLocalLocationRequest(req: LocationRequestItem): void {
  const list = readLocalLocationRequests();
  const idx = list.findIndex((r) => r.id === req.id);
  if (idx >= 0) list[idx] = req;
  else list.unshift(req);
  writeJsonRecord(LOCATION_REQUESTS_LOCAL_KEY, list.slice(0, 100));
  postRadarBroadcast({ type: 'requests_updated' });
}

export async function sendLocationRequest(
  session: SaraSession,
  target: { saraId: string; uid: string; callName: string }
): Promise<LocationRequestItem> {
  if (!session || session.isGuest || !session.saraId) {
    throw new Error('Inicia sessão numa conta para pedir localização.');
  }
  if (target.saraId === session.saraId) {
    throw new Error('Este é o teu próprio Identificador SARA.');
  }

  const req: LocationRequestItem = {
    id: `locreq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    fromSaraId: session.saraId,
    fromUid: session.userId,
    fromCallName: session.callName,
    toSaraId: target.saraId,
    toUid: target.uid,
    toCallName: target.callName,
    status: 'pending',
    durationMinutes: 30,
    createdAt: new Date().toISOString(),
  };

  upsertLocalLocationRequest(req);
  await saveLocationRequestCloud(req);
  return req;
}

export async function respondToLocationRequest(
  request: LocationRequestItem,
  decision: '30m' | '1h' | 'decline'
): Promise<LocationRequestItem> {
  const nowMs = Date.now();
  const durationMinutes: 30 | 60 = decision === '1h' ? 60 : 30;
  const updated: LocationRequestItem =
    decision === 'decline'
      ? { ...request, status: 'declined' }
      : {
          ...request,
          status: 'accepted',
          durationMinutes,
          acceptedAt: new Date(nowMs).toISOString(),
          expiresAt: nowMs + durationMinutes * 60 * 1000,
        };

  upsertLocalLocationRequest(updated);
  await saveLocationRequestCloud(updated);
  return updated;
}

export async function stopAllOutgoingShares(session: SaraSession | null): Promise<void> {
  if (!session?.saraId) return;
  const list = readLocalLocationRequests();
  const changed: LocationRequestItem[] = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (
      (r.toSaraId === session.saraId || r.fromSaraId === session.saraId) &&
      (r.status === 'accepted' || r.status === 'pending')
    ) {
      const next: LocationRequestItem = { ...r, status: 'stopped', expiresAt: Date.now() };
      list[i] = next;
      changed.push(next);
    }
  }
  if (changed.length > 0) {
    writeJsonRecord(LOCATION_REQUESTS_LOCAL_KEY, list);
    postRadarBroadcast({ type: 'requests_updated' });
    await Promise.allSettled(changed.map((item) => saveLocationRequestCloud(item)));
  }
  await hideFromRadarImmediately(session);
}

export async function stopSingleShare(request: LocationRequestItem): Promise<void> {
  const next: LocationRequestItem = { ...request, status: 'stopped', expiresAt: Date.now() };
  upsertLocalLocationRequest(next);
  await saveLocationRequestCloud(next);
}

export function subscribeRadarRequestsAndPeers(params: {
  session: SaraSession | null;
  myCoords: { lat: number; lng: number } | null;
  onUpdate: (state: {
    incomingPending: LocationRequestItem[];
    outgoingGrants: LocationRequestItem[];
    activeReceivingGrants: LocationRequestItem[];
    sharedPeers: SharedPeerLocation[];
  }) => void;
}): () => void {
  const { session, onUpdate } = params;
  if (!session || session.isGuest || !session.saraId) {
    onUpdate({
      incomingPending: [],
      outgoingGrants: [],
      activeReceivingGrants: [],
      sharedPeers: [],
    });
    return () => {};
  }

  const currentMyCoords = params.myCoords;
  let latestRequests: LocationRequestItem[] = readLocalLocationRequests();
  let latestPresences: Record<string, RadarPresence> = readJsonRecord(
    RADAR_PRESENCE_LOCAL_KEY,
    {}
  );
  let unsubPresence: (() => void) | null = null;
  let subscribedIdsKey = '';

  const recompute = () => {
    const nowMs = Date.now();
    const mySaraId = session.saraId || '';

    const incomingPending = latestRequests.filter(
      (r) => r.toSaraId === mySaraId && r.status === 'pending'
    );

    const outgoingGrants = latestRequests.filter(
      (r) =>
        r.toSaraId === mySaraId &&
        r.status === 'accepted' &&
        (!r.expiresAt || r.expiresAt > nowMs)
    );

    const activeReceivingGrants = latestRequests.filter(
      (r) =>
        r.fromSaraId === mySaraId &&
        r.status === 'accepted' &&
        (!r.expiresAt || r.expiresAt > nowMs)
    );

    const neededIds = activeReceivingGrants.map((g) => g.toSaraId).sort();
    const nextKey = neededIds.join(',');
    if (nextKey !== subscribedIdsKey) {
      subscribedIdsKey = nextKey;
      if (unsubPresence) unsubPresence();
      unsubPresence = subscribeRadarPresenceByIdsCloud(neededIds, (cloudMap) => {
        latestPresences = { ...latestPresences, ...cloudMap };
        emitSnapshot();
      });
    }

    emitSnapshot();

    function emitSnapshot() {
      const localMap = readJsonRecord<Record<string, RadarPresence>>(RADAR_PRESENCE_LOCAL_KEY, {});
      const peers: SharedPeerLocation[] = [];

      for (const req of activeReceivingGrants) {
        if (req.expiresAt && req.expiresAt <= Date.now()) continue;
        const p = latestPresences[req.toSaraId] || localMap[req.toSaraId];
        if (!p || !p.visible || p.ghostMode || p.lat === null || p.lng === null) {
          continue;
        }
        const dist =
          currentMyCoords && typeof p.lat === 'number' && typeof p.lng === 'number'
            ? calcDistanceMeters(currentMyCoords.lat, currentMyCoords.lng, p.lat, p.lng)
            : null;
        peers.push({
          requestId: req.id,
          saraId: req.toSaraId,
          callName: req.toCallName || p.callName,
          lat: p.lat,
          lng: p.lng,
          accuracyM: p.accuracyM ?? null,
          speedMps: p.speedMps ?? null,
          batteryPct: p.batteryPct ?? null,
          stationedSince: p.stationedSince ?? p.updatedAt ?? null,
          updatedAt: p.updatedAt,
          expiresAt: req.expiresAt || Date.now() + 30 * 60 * 1000,
          distanceMeters: dist,
          direction: 'incoming_grant',
        });
      }

      onUpdate({
        incomingPending,
        outgoingGrants,
        activeReceivingGrants,
        sharedPeers: peers,
      });
    }
  };

  const unsubCloudReq = subscribeLocationRequestsForUserCloud(session.saraId, (cloudReqs) => {
    const localReqs = readLocalLocationRequests();
    const merged = new Map<string, LocationRequestItem>();
    for (const r of localReqs) merged.set(r.id, r);
    for (const r of cloudReqs) merged.set(r.id, r);
    latestRequests = Array.from(merged.values());
    writeJsonRecord(LOCATION_REQUESTS_LOCAL_KEY, latestRequests.slice(0, 100));
    recompute();
  });

  const unsubBc = subscribeRadarBroadcast(() => {
    latestRequests = readLocalLocationRequests();
    latestPresences = readJsonRecord(RADAR_PRESENCE_LOCAL_KEY, {});
    recompute();
  });

  const expiryTimer = setInterval(() => {
    const nowMs = Date.now();
    let changed = false;
    latestRequests = latestRequests.map((r) => {
      if (r.status === 'accepted' && r.expiresAt && r.expiresAt <= nowMs) {
        changed = true;
        const expired: LocationRequestItem = { ...r, status: 'expired' };
        void saveLocationRequestCloud(expired);
        return expired;
      }
      return r;
    });
    if (changed) {
      writeJsonRecord(LOCATION_REQUESTS_LOCAL_KEY, latestRequests);
    }
    recompute();
  }, 4000);

  Promise.allSettled(
    latestRequests
      .filter((r) => r.fromSaraId === session.saraId && r.status === 'accepted')
      .map((r) => fetchRadarPresenceCloud(r.toSaraId))
  ).then((results) => {
    let any = false;
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value) {
        latestPresences[res.value.saraId] = res.value;
        any = true;
      }
    }
    if (any) recompute();
  });

  recompute();

  return () => {
    unsubCloudReq();
    unsubBc();
    if (unsubPresence) unsubPresence();
    clearInterval(expiryTimer);
  };
}

// =========================================================================
// PARTE 3 — ACHAR MEU CELULAR & COMANDOS REMOTOS (MESMA CONTA APENAS)
// =========================================================================

export function readLocalUserDevices(ownerUid: string): SaraDeviceRecord[] {
  if (!ownerUid || ownerUid.startsWith('guest_')) return [];
  const all = readJsonRecord<Record<string, SaraDeviceRecord>>(USER_DEVICES_LOCAL_KEY, {});
  return Object.values(all)
    .filter((d) => d.ownerUid === ownerUid)
    .sort((a, b) => (Date.parse(b.lastUpdatedAt) || 0) - (Date.parse(a.lastUpdatedAt) || 0));
}

function upsertLocalUserDevice(device: SaraDeviceRecord): void {
  const all = readJsonRecord<Record<string, SaraDeviceRecord>>(USER_DEVICES_LOCAL_KEY, {});
  all[`${device.ownerUid}_${device.deviceCode}`] = device;
  writeJsonRecord(USER_DEVICES_LOCAL_KEY, all);
  postRadarBroadcast({ type: 'devices_updated', ownerUid: device.ownerUid });
}

export async function syncCurrentDeviceTelemetry(params: {
  session: SaraSession | null;
  findPhoneEnabled: boolean;
  lowBatteryAutoLocate: boolean;
  sosSmsEnabled: boolean;
  sosPhoneNumber: string;
  includeGpsLocation: boolean;
  online?: boolean;
}): Promise<SaraDeviceRecord | null> {
  const {
    session,
    findPhoneEnabled,
    lowBatteryAutoLocate,
    sosSmsEnabled,
    sosPhoneNumber,
    includeGpsLocation,
  } = params;
  if (!session || session.isGuest) return null;

  const deviceCode = session.deviceCode || getOrCreateDeviceCode();
  const info = detectDeviceNameAndModel();
  const battery = await readDeviceBatteryStatus();

  const existing = readLocalUserDevices(session.userId).find(
    (d) => d.deviceCode === deviceCode
  );

  let nextLat = existing?.lastLat ?? null;
  let nextLng = existing?.lastLng ?? null;
  let nextAcc = existing?.lastAccuracyM ?? null;
  let nextSpeed = existing?.speedMps ?? null;

  if (includeGpsLocation && findPhoneEnabled) {
    const gps = await requestRealCoordinatesWithFallback(10000);
    if (gps) {
      nextSpeed = computeSpeedMps(
        existing?.lastLat !== null &&
          existing?.lastLat !== undefined &&
          existing?.lastLng !== null &&
          existing?.lastLng !== undefined
          ? {
              lat: existing.lastLat,
              lng: existing.lastLng,
              timestamp: Date.parse(existing.lastUpdatedAt) || gps.timestamp - 30000,
            }
          : null,
        { lat: gps.lat, lng: gps.lng, timestamp: gps.timestamp },
        gps.speedMps
      );
      nextLat = gps.lat;
      nextLng = gps.lng;
      nextAcc = gps.accuracyM;
    }
  }

  const record: SaraDeviceRecord = {
    ownerUid: session.userId,
    deviceCode,
    deviceName: info.deviceName,
    model: info.model,
    platform: info.platform,
    batteryPct: battery.batteryPct,
    batteryCharging: battery.batteryCharging,
    online: params.online ?? (typeof navigator !== 'undefined' ? navigator.onLine : true),
    lastUpdatedAt: new Date().toISOString(),
    findPhoneEnabled,
    lowBatteryAutoLocate,
    sosSmsEnabled,
    sosPhoneNumber: sosPhoneNumber.trim(),
    lastLat: nextLat,
    lastLng: nextLng,
    lastAccuracyM: nextAcc,
    speedMps: nextSpeed,
    pendingCommand: existing?.pendingCommand ?? null,
  };

  upsertLocalUserDevice(record);
  await saveUserDeviceCloud(record);
  return record;
}

export async function markCurrentDeviceOfflineOnLogout(session: SaraSession | null): Promise<void> {
  if (!session || session.isGuest) return;
  const deviceCode = session.deviceCode || getOrCreateDeviceCode();
  const existing = readLocalUserDevices(session.userId).find(
    (d) => d.deviceCode === deviceCode
  );
  if (!existing) return;
  const offlineRec: SaraDeviceRecord = {
    ...existing,
    online: false,
    lastUpdatedAt: new Date().toISOString(),
  };
  upsertLocalUserDevice(offlineRec);
  await saveUserDeviceCloud(offlineRec);
}

export function subscribeAccountDevices(
  session: SaraSession | null,
  onDevices: (devices: SaraDeviceRecord[]) => void
): () => void {
  if (!session || session.isGuest) {
    onDevices([]);
    return () => {};
  }

  const ownerUid = session.userId;
  let cloudList: SaraDeviceRecord[] = [];

  const emitMerged = () => {
    const localList = readLocalUserDevices(ownerUid);
    const map = new Map<string, SaraDeviceRecord>();
    for (const d of localList) {
      if (d.ownerUid === ownerUid) map.set(d.deviceCode, d);
    }
    for (const d of cloudList) {
      if (d.ownerUid !== ownerUid) continue;
      const prev = map.get(d.deviceCode);
      if (
        !prev ||
        (Date.parse(d.lastUpdatedAt) || 0) >= (Date.parse(prev.lastUpdatedAt) || 0) ||
        d.pendingCommand
      ) {
        map.set(d.deviceCode, d);
      }
    }
    onDevices(
      Array.from(map.values()).sort(
        (a, b) => (Date.parse(b.lastUpdatedAt) || 0) - (Date.parse(a.lastUpdatedAt) || 0)
      )
    );
  };

  void fetchUserDevicesCloud(ownerUid).then((items) => {
    cloudList = items;
    emitMerged();
  });

  const unsubCloud = subscribeUserDevicesCloud(ownerUid, (items) => {
    cloudList = items;
    emitMerged();
  });

  const unsubBc = subscribeRadarBroadcast((ev) => {
    if (ev.type === 'devices_updated') {
      emitMerged();
    }
  });

  emitMerged();

  return () => {
    unsubCloud();
    unsubBc();
  };
}

export async function issueRemoteDeviceCommand(params: {
  session: SaraSession;
  targetDeviceCode: string;
  type: 'ring' | 'lock';
  message?: string;
  contactPhone?: string;
}): Promise<RemoteDeviceCommand> {
  const { session, targetDeviceCode, type, message, contactPhone } = params;
  if (!session || session.isGuest) {
    throw new Error('Inicia sessão para enviar comandos ao teu aparelho.');
  }
  const cmd: RemoteDeviceCommand = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    issuedAt: new Date().toISOString(),
    issuedBySessionId: session.sessionId,
    message: message?.trim(),
    contactPhone: contactPhone?.trim(),
    executed: false,
  };

  const localDevices = readLocalUserDevices(session.userId);
  const target = localDevices.find((d) => d.deviceCode === targetDeviceCode);
  if (target) {
    upsertLocalUserDevice({ ...target, pendingCommand: cmd });
  }
  await issueDeviceCommandCloud(session.userId, targetDeviceCode, cmd);
  return cmd;
}

export async function verifyPasswordAndIssueWipeCommand(params: {
  session: SaraSession;
  targetDeviceCode: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { session, targetDeviceCode, password } = params;
  if (!session || session.isGuest) {
    return { ok: false, error: 'Modo Convidado não permite apagar aparelhos.' };
  }
  const valid = await verifySessionAccountPassword(session, password);
  if (!valid) {
    return { ok: false, error: 'Senha incorreta. Operação de limpeza cancelada.' };
  }

  const cmd: RemoteDeviceCommand = {
    id: `wipe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'wipe',
    issuedAt: new Date().toISOString(),
    issuedBySessionId: session.sessionId,
    executed: false,
  };

  const localDevices = readLocalUserDevices(session.userId);
  const target = localDevices.find((d) => d.deviceCode === targetDeviceCode);
  if (target) {
    upsertLocalUserDevice({ ...target, pendingCommand: cmd });
  }
  await issueDeviceCommandCloud(session.userId, targetDeviceCode, cmd);
  return { ok: true };
}

export async function acknowledgeAndClearPendingCommand(
  ownerUid: string,
  deviceCode: string
): Promise<void> {
  const localDevices = readLocalUserDevices(ownerUid);
  const target = localDevices.find((d) => d.deviceCode === deviceCode);
  if (target) {
    upsertLocalUserDevice({ ...target, pendingCommand: null });
  }
  await issueDeviceCommandCloud(ownerUid, deviceCode, null);
}

export function getSavedDeviceLockState(): DeviceLockState | null {
  const state = readJsonRecord<DeviceLockState | null>(DEVICE_LOCK_KEY, null);
  return state?.locked ? state : null;
}

export function setSavedDeviceLockState(state: DeviceLockState | null): void {
  if (!state || !state.locked) {
    try {
      localStorage.removeItem(DEVICE_LOCK_KEY);
    } catch {
      // ignore
    }
    return;
  }
  writeJsonRecord(DEVICE_LOCK_KEY, state);
}

export function executeRemoteDeviceWipeLocal(ownerUid?: string): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        (ownerUid && k.endsWith(`_${ownerUid}`)) ||
        k.startsWith('sara_') ||
        k === 'GITHUB_TOKEN' ||
        k === 'GEMINI_API_KEY'
      ) {
        if (k !== 'sara_accounts_v1') {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
    clearLocalDeviceRegistryCache();
  } catch {
    // ignore
  }
}

// =========================================================================
// SMS DE SOCORRO (APÓS 1 HORA SEM INTERNET)
// =========================================================================

export function buildEmergencySmsUri(params: {
  phoneNumber: string;
  callName: string;
  deviceCode: string;
  lat: number | null;
  lng: number | null;
  lastUpdatedAt: string;
}): string {
  const cleanPhone = String(params.phoneNumber || '').replace(/[^\d+]/g, '');
  const coordsText =
    params.lat !== null && params.lng !== null
      ? `https://www.openstreetmap.org/?mlat=${params.lat}&mlon=${params.lng}#map=16/${params.lat}/${params.lng}`
      : 'localização indisponível';
  const body = `SOS SARA (${params.callName} - ${params.deviceCode}): Aparelho sem internet há 1h. Última posição (${formatTimeAgoPt(
    params.lastUpdatedAt
  )}): ${coordsText}`;
  return `sms:${cleanPhone}?body=${encodeURIComponent(body)}`;
}

export function evaluateOfflineSosCondition(params: {
  isOnline: boolean;
  sosSmsEnabled: boolean;
  sosPhoneNumber: string;
  nowMs?: number;
}): { shouldTrigger: boolean; offlineDurationMs: number } {
  const nowMs = params.nowMs ?? Date.now();
  try {
    if (params.isOnline) {
      localStorage.removeItem(OFFLINE_SINCE_KEY);
      return { shouldTrigger: false, offlineDurationMs: 0 };
    }
    let offlineSince = Number(localStorage.getItem(OFFLINE_SINCE_KEY) || '0');
    if (!offlineSince) {
      offlineSince = nowMs;
      localStorage.setItem(OFFLINE_SINCE_KEY, String(offlineSince));
    }
    const offlineDurationMs = Math.max(0, nowMs - offlineSince);
    if (!params.sosSmsEnabled || !params.sosPhoneNumber.trim()) {
      return { shouldTrigger: false, offlineDurationMs };
    }
    const lastSentAt = Number(localStorage.getItem(SOS_SENT_MARKER_KEY) || '0');
    const cooldownPassed = !lastSentAt || nowMs - lastSentAt >= ONE_HOUR_MS;
    if (offlineDurationMs >= ONE_HOUR_MS && cooldownPassed) {
      localStorage.setItem(SOS_SENT_MARKER_KEY, String(nowMs));
      return { shouldTrigger: true, offlineDurationMs };
    }
    return { shouldTrigger: false, offlineDurationMs };
  } catch {
    return { shouldTrigger: false, offlineDurationMs: 0 };
  }
}
