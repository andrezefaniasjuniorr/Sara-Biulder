export type DeviceCommandType = 'ring' | 'lock' | 'wipe';

export type RadarMapViewMode = 'roadmap' | 'hybrid' | 'terrain';

export type LocationSignalSource = 'gps' | 'network' | 'ip_approx' | 'last_known' | 'none';

export interface GpsCoordinateResult {
  lat: number;
  lng: number;
  accuracyM: number | null;
  speedMps: number | null;
  timestamp: number;
  source: 'gps' | 'network' | 'ip_approx';
}

export interface GeocodedAddressInfo {
  formattedAddress: string;
  street: string;
  neighborhood: string;
  city: string;
  country: string;
  placeId?: string;
  updatedAt: string;
}

export interface RemoteDeviceCommand {
  id: string;
  type: DeviceCommandType;
  issuedAt: string;
  issuedBySessionId: string;
  message?: string;
  contactPhone?: string;
  executed?: boolean;
}

export interface SaraDeviceRecord {
  ownerUid: string;
  deviceCode: string; // Formato CEL-XXXX
  deviceName: string;
  model: string;
  platform: 'PC' | 'Telemóvel';
  batteryPct: number | null;
  batteryCharging: boolean;
  online: boolean;
  lastUpdatedAt: string;
  findPhoneEnabled: boolean;
  lowBatteryAutoLocate: boolean;
  sosSmsEnabled: boolean;
  sosPhoneNumber: string;
  // Apenas a posição atual / mais recente
  lastLat: number | null;
  lastLng: number | null;
  lastAccuracyM: number | null;
  speedMps?: number | null;
  pendingCommand?: RemoteDeviceCommand | null;
}

export interface RadarPresence {
  saraId: string;
  uid: string;
  callName: string;
  visible: boolean;
  ghostMode: boolean;
  // Localização ao vivo no momento
  lat: number | null;
  lng: number | null;
  accuracyM?: number | null;
  speedMps?: number | null;
  batteryPct?: number | null;
  stationedSince?: string | null;
  updatedAt: string;
}

export type LocationRequestStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'stopped'
  | 'expired';

export interface LocationRequestItem {
  id: string;
  fromSaraId: string;
  fromUid: string;
  fromCallName: string;
  toSaraId: string;
  toUid: string;
  toCallName: string;
  status: LocationRequestStatus;
  durationMinutes: 30 | 60;
  createdAt: string;
  acceptedAt?: string;
  expiresAt?: number;
}

export interface SharedPeerLocation {
  requestId: string;
  saraId: string;
  callName: string;
  lat: number;
  lng: number;
  accuracyM?: number | null;
  speedMps?: number | null;
  batteryPct?: number | null;
  stationedSince?: string | null;
  updatedAt: string;
  expiresAt: number;
  distanceMeters: number | null;
  direction: 'incoming_grant' | 'outgoing_grant';
}

export interface RadarPlaceResult {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  distanceMeters: number | null;
  categoryLabel?: string;
}

export interface MovementHistoryPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speedMps?: number | null;
  addressLabel?: string;
}

export interface GeofenceZone {
  id: string;
  label: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  active: boolean;
  lastStatus?: 'inside' | 'outside';
}

export interface LiveShareRecord {
  shareId: string;
  ownerUid: string;
  saraId: string;
  callName: string;
  deviceCode: string;
  lat: number;
  lng: number;
  speedMps: number | null;
  batteryPct: number | null;
  addressLabel: string;
  active: boolean;
  createdAt: string;
  expiresAt: number;
  updatedAt: string;
}

export interface BackgroundSettings {
  backgroundAllowed: boolean;
  eiSaraEnabled: boolean;
  continuousVoiceBg: boolean;
  persistentNotification: boolean;
  floatingBubbleEnabled: boolean;
  pcMiniWindowEnabled: boolean;
  findPhoneEnabled: boolean;
  lowBatteryAutoLocate: boolean;
  sosSmsEnabled: boolean;
  sosPhoneNumber: string;
}

export interface BackgroundReminder {
  id: string;
  title: string;
  dateIso: string;
  timeHHmm: string;
  targetMs: number;
  fired?: boolean;
  createdAt: string;
}

export interface DeviceLockState {
  locked: boolean;
  message: string;
  contactPhone: string;
  lockedAt: string;
}
