export type DeviceCommandType = 'ring' | 'lock' | 'wipe';

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
  // Apenas a posição atual / mais recente — nunca guarda histórico de deslocações
  lastLat: number | null;
  lastLng: number | null;
  lastAccuracyM: number | null;
  pendingCommand?: RemoteDeviceCommand | null;
}

export interface RadarPresence {
  saraId: string;
  uid: string;
  callName: string;
  visible: boolean;
  ghostMode: boolean;
  // Apenas localização ao vivo no momento — nunca histórico
  lat: number | null;
  lng: number | null;
  accuracyM?: number | null;
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
  updatedAt: string;
  expiresAt: number;
  distanceMeters: number | null;
  direction: 'incoming_grant' | 'outgoing_grant';
}

export type OsmPoiCategory =
  | 'perto'
  | 'comida'
  | 'farmacia'
  | 'atm'
  | 'chapa'
  | 'negocios';

export interface OsmPoiItem {
  id: string;
  name: string;
  category: OsmPoiCategory;
  categoryLabel: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  address?: string;
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
