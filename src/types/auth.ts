export type UserRole = 'owner' | 'user' | 'guest';

export type ActivityCategory =
  | 'builder'
  | 'chat'
  | 'music'
  | 'calc'
  | 'docs'
  | 'agenda'
  | 'idle';

export interface SaraUserIdentityPayload {
  userId?: string;
  callName: string;
  isOwner: boolean;
  isGuest: boolean;
}

export interface SaraUserAccount {
  uid: string;
  saraId?: string; // Formato único SARA-XXXX
  fullName: string;
  callName: string;
  email: string;
  role: 'owner' | 'user';
  passwordHash: string;
  passwordSalt: string;
  blocked: boolean;
  blockedReason?: string;
  failedAttempts: number;
  lockedUntilMs: number;
  createdAt: string;
  lastLoginAt: string;
}

export interface SaraSession {
  sessionId: string;
  userId: string;
  saraId?: string; // Formato único SARA-XXXX
  deviceCode?: string; // Formato único CEL-XXXX por aparelho
  fullName: string;
  callName: string;
  email: string;
  role: UserRole;
  isOwner: boolean;
  isGuest: boolean;
  loginAt: string;
  expiresAt?: number; // Para Modo Convidado (5 minutos)
  device: 'PC' | 'Telemóvel';
}

export type SessionPresenceStatus = 'Online' | 'Ausente' | 'Saiu';

export interface SessionAccessLog {
  sessionId: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  dateKey: string; // YYYY-MM-DD
  loginAt: string;
  logoutAt?: string;
  lastActivityAt: string;
  durationSeconds: number;
  device: 'PC' | 'Telemóvel';
  status: SessionPresenceStatus;
  currentActivity: string; // Apenas categoria agregada — nunca conteúdo privado
}

export interface UserActivityStats {
  userId: string;
  name: string;
  email: string;
  sitesBuilt: number;
  explanationsCount: number;
  musicCount: number;
  calculationsCount: number;
  docsCount: number;
  lastUpdatedAt: string;
}

export type AdminAlertType =
  | 'admin_attempt'
  | 'failed_login_lock'
  | 'impersonation_or_disobey'
  | 'suspicious_account'
  | 'kicked_or_blocked';

export interface AdminAlert {
  id: string;
  type: AdminAlertType;
  userId: string;
  userName: string;
  userEmail: string;
  summary: string;
  timestamp: string;
  read: boolean;
}

export interface DailyUserReportRow {
  userId: string;
  name: string;
  email: string;
  sessionsCount: number;
  totalMinutes: number;
  topActivity: string;
  sitesBuilt: number;
  explanationsCount: number;
  musicCount: number;
  calculationsCount: number;
}

export interface DailyAdminReport {
  generatedAt: string;
  dateKey: string;
  totalUsers: number;
  activeSessionsToday: number;
  onlineNow: number;
  totalMinutesToday: number;
  hourlyBuckets: number[]; // 24h
  users: DailyUserReportRow[];
  alertsCount: number;
}

export interface AdminDashboardSnapshot {
  accounts: SaraUserAccount[];
  sessions: SessionAccessLog[];
  stats: UserActivityStats[];
  alerts: AdminAlert[];
}
