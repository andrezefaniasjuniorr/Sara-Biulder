import type {
  ActivityCategory,
  AdminAlert,
  AdminAlertType,
  AdminDashboardSnapshot,
  DailyAdminReport,
  DailyUserReportRow,
  SaraSession,
  SaraUserAccount,
  SessionAccessLog,
  SessionPresenceStatus,
  UserActivityStats,
} from '../types/auth';
import {
  criarConta,
  deleteAccountCloud,
  fetchAccountByEmailCloud,
  fetchAllAccountsCloud,
  fetchAllActivityStatsCloud,
  fetchAllAdminAlertsCloud,
  fetchAllSessionLogsCloud,
  loginEmail,
  logout as firebaseSignOut,
  saveAccountCloud,
  saveAdminAlertCloud,
  saveSessionLogCloud,
  saveUserActivityStatsCloud,
} from './firebaseService';

export const OWNER_EMAIL = 'sarabiulderr@gmail.com';
export const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutos
export const GUEST_LIMIT_MS = 5 * 60 * 1000; // 5 minutos
export const LOCKOUT_ATTEMPTS = 3;
export const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutos

const ACCOUNTS_KEY = 'sara_accounts_v1';
const SESSIONS_KEY = 'sara_sessions_v1';
const STATS_KEY = 'sara_activity_stats_v1';
const ALERTS_KEY = 'sara_admin_alerts_v1';
const ACTIVE_SESSION_KEY = 'sara_active_session_v1';

const ACTIVITY_LABELS: Record<ActivityCategory, string> = {
  builder: 'A usar Builder',
  chat: 'A conversar',
  music: 'A ouvir música',
  calc: 'Cálculos / Estudos',
  docs: 'Documentos / Textos',
  agenda: 'Agenda & Tarefas',
  idle: 'Ausente',
};

function safeReadArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function safeWriteArray<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // ignore storage quota
  }
}

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function normalizeText(str: string): string {
  return String(str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function detectDeviceType(): 'PC' | 'Telemóvel' {
  if (typeof navigator === 'undefined') return 'PC';
  const ua = navigator.userAgent || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) {
    return 'Telemóvel';
  }
  if (typeof window !== 'undefined' && window.innerWidth <= 768) {
    return 'Telemóvel';
  }
  return 'PC';
}

function todayDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function generateSaltHex(bytesLen = 16): string {
  const bytes = new Uint8Array(bytesLen);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytesLen; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return out;
}

export async function hashPasswordPBKDF2(
  password: string,
  saltHex?: string
): Promise<{ hash: string; salt: string }> {
  const salt = saltHex || generateSaltHex(16);
  const encoder = new TextEncoder();
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;

  if (subtle) {
    const keyMaterial = await subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const saltBytes = hexToBytes(salt);
    const derivedBits = await subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes.buffer as ArrayBuffer,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    const hashArray = Array.from(new Uint8Array(derivedBits));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return { hash, salt };
  }

  // Fallback determinístico apenas se Web Crypto indisponível (ambiente não-browser)
  let acc = 2166136261;
  const combined = `${salt}:${password}`;
  for (let i = 0; i < combined.length; i++) {
    acc ^= combined.charCodeAt(i);
    acc = Math.imul(acc, 16777619);
  }
  return { hash: (acc >>> 0).toString(16).padStart(16, '0'), salt };
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyPasswordPBKDF2(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  if (!salt || !expectedHash) return false;
  const { hash } = await hashPasswordPBKDF2(password, salt);
  return timingSafeEqualStr(hash, expectedHash);
}

function upsertAccountLocal(account: SaraUserAccount): void {
  const all = safeReadArray<SaraUserAccount>(ACCOUNTS_KEY);
  const idx = all.findIndex(
    (a) => normalizeEmail(a.email) === normalizeEmail(account.email) || a.uid === account.uid
  );
  if (idx >= 0) {
    all[idx] = account;
  } else {
    all.push(account);
  }
  safeWriteArray(ACCOUNTS_KEY, all);
}

async function resolveAccountByEmail(email: string): Promise<SaraUserAccount | null> {
  const norm = normalizeEmail(email);
  const local = safeReadArray<SaraUserAccount>(ACCOUNTS_KEY).find(
    (a) => normalizeEmail(a.email) === norm
  );
  const cloud = await fetchAccountByEmailCloud(norm).catch(() => null);
  if (cloud && local) {
    // Escolhe versão mais recente ou que contenha bloqueio ativo
    const cloudMs = Date.parse(cloud.lastLoginAt || cloud.createdAt || '') || 0;
    const localMs = Date.parse(local.lastLoginAt || local.createdAt || '') || 0;
    const merged = cloud.blocked || cloudMs >= localMs ? cloud : local;
    upsertAccountLocal(merged);
    return merged;
  }
  if (cloud) {
    upsertAccountLocal(cloud);
    return cloud;
  }
  return local || null;
}

export function getSavedActiveSession(): SaraSession | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_SESSION_KEY) || localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaraSession;
    if (!parsed?.userId || !parsed?.sessionId) return null;
    if (parsed.isGuest) return null; // Convidado nunca sobrevive fora da sessão efémera
    return parsed;
  } catch {
    return null;
  }
}

function persistActiveSession(session: SaraSession | null): void {
  try {
    if (!session || session.isGuest) {
      sessionStorage.removeItem(ACTIVE_SESSION_KEY);
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      return;
    }
    const serialized = JSON.stringify(session);
    sessionStorage.setItem(ACTIVE_SESSION_KEY, serialized);
    localStorage.setItem(ACTIVE_SESSION_KEY, serialized);
  } catch {
    // ignore storage quota
  }
}

export async function logAdminAlert(params: {
  type: AdminAlertType;
  userId: string;
  userName: string;
  userEmail: string;
  summary: string;
}): Promise<AdminAlert> {
  const alert: AdminAlert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: params.type,
    userId: params.userId,
    userName: params.userName,
    userEmail: params.userEmail,
    summary: params.summary,
    timestamp: new Date().toISOString(),
    read: false,
  };
  const list = safeReadArray<AdminAlert>(ALERTS_KEY);
  list.unshift(alert);
  safeWriteArray(ALERTS_KEY, list.slice(0, 250));
  void saveAdminAlertCloud(alert);
  return alert;
}

function isSuspiciousAccountInput(fullName: string, callName: string, email: string): boolean {
  const localPart = normalizeEmail(email).split('@')[0] || '';
  if (/(.)\1{4,}/.test(localPart) || /(.)\1{4,}/.test(fullName)) return true;
  if (/^(test|fake|bot|spam|hacker|admin|root)\d*$/i.test(callName.trim())) return true;
  const accounts = safeReadArray<SaraUserAccount>(ACCOUNTS_KEY);
  const lastTenMins = Date.now() - 10 * 60 * 1000;
  const recentCreations = accounts.filter((a) => Date.parse(a.createdAt || '') > lastTenMins);
  return recentCreations.length >= 4;
}

function createOrUpdateSessionLog(session: SaraSession, activityLabel = 'A conversar'): SessionAccessLog {
  const nowIso = new Date().toISOString();
  const log: SessionAccessLog = {
    sessionId: session.sessionId,
    userId: session.userId,
    name: session.callName,
    email: session.email,
    role: session.role,
    dateKey: todayDateKey(),
    loginAt: session.loginAt,
    lastActivityAt: nowIso,
    durationSeconds: 0,
    device: session.device,
    status: 'Online',
    currentActivity: activityLabel,
  };
  const logs = safeReadArray<SessionAccessLog>(SESSIONS_KEY);
  const idx = logs.findIndex((s) => s.sessionId === session.sessionId);
  if (idx >= 0) logs[idx] = log;
  else logs.unshift(log);
  safeWriteArray(SESSIONS_KEY, logs.slice(0, 400));
  void saveSessionLogCloud(log);
  return log;
}

export async function registerAccount(input: {
  fullName: string;
  callName: string;
  email: string;
  password: string;
}): Promise<{ session: SaraSession; account: SaraUserAccount }> {
  const fullName = String(input.fullName || '').trim();
  const callName = String(input.callName || '').trim() || fullName.split(' ')[0] || 'Utilizador';
  const email = normalizeEmail(input.email);
  const password = String(input.password || '');

  if (fullName.length < 2) {
    throw new Error('Indica o teu nome completo.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Indica um e-mail válido.');
  }
  if (password.length < 4) {
    throw new Error('A senha deve ter pelo menos 4 caracteres.');
  }

  const existing = await resolveAccountByEmail(email);
  if (existing) {
    throw new Error('Já existe uma conta registada com este e-mail. Usa [ENTRAR].');
  }

  const isOwner = email === OWNER_EMAIL;
  const { hash, salt } = await hashPasswordPBKDF2(password);
  let uid = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Tenta registar também no Firebase Auth (best-effort) para sincronia real
  try {
    const fbUser = await criarConta(email, password, callName);
    if (fbUser?.uid) uid = fbUser.uid;
  } catch {
    // Continua com uid local + Firestore se Auth offline ou e-mail já existir no Auth
  }

  const nowIso = new Date().toISOString();
  const account: SaraUserAccount = {
    uid,
    fullName,
    callName: isOwner ? callName || 'Eletro-Júnior' : callName,
    email,
    role: isOwner ? 'owner' : 'user',
    passwordHash: hash,
    passwordSalt: salt,
    blocked: false,
    failedAttempts: 0,
    lockedUntilMs: 0,
    createdAt: nowIso,
    lastLoginAt: nowIso,
  };

  upsertAccountLocal(account);
  void saveAccountCloud(account);

  if (!isOwner && isSuspiciousAccountInput(fullName, callName, email)) {
    await logAdminAlert({
      type: 'suspicious_account',
      userId: account.uid,
      userName: account.callName,
      userEmail: account.email,
      summary: `Conta com padrão suspeito criada: "${fullName}" (${email}).`,
    });
  }

  const statsList = safeReadArray<UserActivityStats>(STATS_KEY);
  if (!statsList.some((s) => s.userId === account.uid)) {
    const initStats: UserActivityStats = {
      userId: account.uid,
      name: account.callName,
      email: account.email,
      sitesBuilt: 0,
      explanationsCount: 0,
      musicCount: 0,
      calculationsCount: 0,
      docsCount: 0,
      lastUpdatedAt: nowIso,
    };
    statsList.push(initStats);
    safeWriteArray(STATS_KEY, statsList);
    void saveUserActivityStatsCloud(initStats);
  }

  const session: SaraSession = {
    sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: account.uid,
    fullName: account.fullName,
    callName: account.callName,
    email: account.email,
    role: account.role,
    isOwner,
    isGuest: false,
    loginAt: nowIso,
    device: detectDeviceType(),
  };

  persistActiveSession(session);
  createOrUpdateSessionLog(session);

  return { session, account };
}

export async function loginAccount(input: {
  email: string;
  loginName?: string;
  password: string;
}): Promise<{ session: SaraSession; account: SaraUserAccount }> {
  const email = normalizeEmail(input.email);
  const loginNameInput = String(input.loginName || '').trim();
  const password = String(input.password || '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Indica um e-mail válido para entrar.');
  }
  if (!password) {
    throw new Error('Insere a tua senha.');
  }

  let account = await resolveAccountByEmail(email);

  // Caso a conta tenha sido criada previamente só no Firebase Auth, sincroniza com PBKDF2-SHA256
  if (!account) {
    try {
      const fbUser = await loginEmail(email, password);
      if (fbUser?.uid) {
        const isOwner = email === OWNER_EMAIL;
        const { hash, salt } = await hashPasswordPBKDF2(password);
        const nowIso = new Date().toISOString();
        account = {
          uid: fbUser.uid,
          fullName: fbUser.displayName || (isOwner ? 'Eletro-Júnior' : loginNameInput || 'Utilizador'),
          callName:
            loginNameInput || fbUser.displayName || (isOwner ? 'Eletro-Júnior' : email.split('@')[0]),
          email,
          role: isOwner ? 'owner' : 'user',
          passwordHash: hash,
          passwordSalt: salt,
          blocked: false,
          failedAttempts: 0,
          lockedUntilMs: 0,
          createdAt: nowIso,
          lastLoginAt: nowIso,
        };
        upsertAccountLocal(account);
        void saveAccountCloud(account);
      }
    } catch {
      // Segue para erro padrão de credenciais
    }
  }

  if (!account) {
    throw new Error('Conta não encontrada. Verifica o e-mail ou clica em [CRIAR CONTA].');
  }

  if (account.blocked) {
    throw new Error('Esta conta está suspensa no momento.');
  }

  const nowMs = Date.now();
  if (account.lockedUntilMs && account.lockedUntilMs > nowMs) {
    const minsLeft = Math.max(1, Math.ceil((account.lockedUntilMs - nowMs) / 60000));
    throw new Error(
      `Demasiadas tentativas falhadas. Tenta novamente dentro de ${minsLeft} minuto${minsLeft > 1 ? 's' : ''}.`
    );
  }

  const passwordValid = await verifyPasswordPBKDF2(password, account.passwordSalt, account.passwordHash);
  if (!passwordValid) {
    // Tenta validar também contra Firebase Auth se a senha tiver sido redefinida externamente
    let fbMatched = false;
    try {
      await loginEmail(email, password);
      fbMatched = true;
    } catch {
      fbMatched = false;
    }

    if (!fbMatched) {
      const nextFails = (account.failedAttempts || 0) + 1;
      const shouldLock = nextFails >= LOCKOUT_ATTEMPTS;
      const updatedFailAcc: SaraUserAccount = {
        ...account,
        failedAttempts: shouldLock ? 0 : nextFails,
        lockedUntilMs: shouldLock ? Date.now() + LOCKOUT_DURATION_MS : 0,
      };
      upsertAccountLocal(updatedFailAcc);
      void saveAccountCloud(updatedFailAcc);

      if (shouldLock) {
        await logAdminAlert({
          type: 'failed_login_lock',
          userId: account.uid,
          userName: account.callName,
          userEmail: account.email,
          summary: `3 tentativas falhadas de login em ${account.email}. Bloqueado por 5 minutos.`,
        });
        throw new Error(
          '3 tentativas erradas seguidas. Por segurança, esta conta ficou bloqueada por 5 minutos.'
        );
      }
      const remaining = LOCKOUT_ATTEMPTS - nextFails;
      throw new Error(
        `Senha incorreta. Restam ${remaining} tentativa${remaining > 1 ? 's' : ''} antes do bloqueio de 5 minutos.`
      );
    } else {
      const { hash, salt } = await hashPasswordPBKDF2(password);
      account.passwordHash = hash;
      account.passwordSalt = salt;
    }
  }

  // Validação flexível do Nome de Login (se o utilizador preencheu o campo)
  if (loginNameInput) {
    const normIn = normalizeText(loginNameInput);
    const normCall = normalizeText(account.callName);
    const normFull = normalizeText(account.fullName);
    const matchesOwnerAlias =
      account.email === OWNER_EMAIL &&
      ['eletro-junior', 'eletro junior', 'eletro-jr', 'eletro jr', 'junior', 'sara', 'admin'].includes(
        normIn
      );
    if (
      normIn !== normCall &&
      normIn !== normFull &&
      !normFull.startsWith(normIn) &&
      !matchesOwnerAlias
    ) {
      throw new Error('O Nome de Login não coincide com esta conta.');
    }
  }

  const isOwner = normalizeEmail(account.email) === OWNER_EMAIL;
  const nowIso = new Date().toISOString();
  const cleanAccount: SaraUserAccount = {
    ...account,
    role: isOwner ? 'owner' : 'user',
    failedAttempts: 0,
    lockedUntilMs: 0,
    lastLoginAt: nowIso,
  };
  upsertAccountLocal(cleanAccount);
  void saveAccountCloud(cleanAccount);

  const effectiveCallName =
    loginNameInput && !isOwner
      ? loginNameInput
      : cleanAccount.callName || (isOwner ? 'Eletro-Júnior' : cleanAccount.fullName);

  const session: SaraSession = {
    sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: cleanAccount.uid,
    fullName: cleanAccount.fullName,
    callName: effectiveCallName,
    email: cleanAccount.email,
    role: isOwner ? 'owner' : 'user',
    isOwner,
    isGuest: false,
    loginAt: nowIso,
    device: detectDeviceType(),
  };

  persistActiveSession(session);
  createOrUpdateSessionLog(session);

  return { session, account: cleanAccount };
}

export function startGuestSession(): SaraSession {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const session: SaraSession = {
    sessionId: `guest_sess_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
    userId: `guest_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
    fullName: 'Visitante Temporário',
    callName: 'Convidado',
    email: 'convidado@temporario.local',
    role: 'guest',
    isOwner: false,
    isGuest: true,
    loginAt: nowIso,
    expiresAt: nowMs + GUEST_LIMIT_MS,
    device: detectDeviceType(),
  };
  // Regista apenas métrica anónima de entrada temporária no log admin (sem gravar estado/projetos)
  createOrUpdateSessionLog(session, 'Modo Convidado');
  return session;
}

export async function logoutCurrentSession(session: SaraSession | null): Promise<void> {
  if (session) {
    const logs = safeReadArray<SessionAccessLog>(SESSIONS_KEY);
    const nowIso = new Date().toISOString();
    const idx = logs.findIndex((s) => s.sessionId === session.sessionId);
    if (idx >= 0) {
      const loginMs = Date.parse(logs[idx].loginAt) || Date.now();
      const updated: SessionAccessLog = {
        ...logs[idx],
        status: 'Saiu',
        logoutAt: nowIso,
        lastActivityAt: nowIso,
        durationSeconds: Math.max(logs[idx].durationSeconds || 0, Math.round((Date.now() - loginMs) / 1000)),
      };
      logs[idx] = updated;
      safeWriteArray(SESSIONS_KEY, logs);
      void saveSessionLogCloud(updated);
    }
  }
  persistActiveSession(null);
  try {
    await firebaseSignOut();
  } catch {
    // ignore if offline
  }
}

export function updatePresenceHeartbeat(
  session: SaraSession | null,
  status: SessionPresenceStatus = 'Online',
  category?: ActivityCategory
): void {
  if (!session) return;
  const logs = safeReadArray<SessionAccessLog>(SESSIONS_KEY);
  const idx = logs.findIndex((s) => s.sessionId === session.sessionId);
  const nowIso = new Date().toISOString();
  if (idx >= 0) {
    const loginMs = Date.parse(logs[idx].loginAt) || Date.now();
    const updated: SessionAccessLog = {
      ...logs[idx],
      status: logs[idx].status === 'Saiu' ? 'Saiu' : status,
      lastActivityAt: nowIso,
      durationSeconds: Math.max(0, Math.round((Date.now() - loginMs) / 1000)),
      currentActivity: category ? ACTIVITY_LABELS[category] : logs[idx].currentActivity,
    };
    logs[idx] = updated;
    safeWriteArray(SESSIONS_KEY, logs);
    void saveSessionLogCloud(updated);
  } else if (status !== 'Saiu') {
    createOrUpdateSessionLog(session, category ? ACTIVITY_LABELS[category] : 'A conversar');
  }
}

export function recordActivityEvent(session: SaraSession | null, category: ActivityCategory): void {
  if (!session) return;
  updatePresenceHeartbeat(session, 'Online', category);
  if (session.isGuest) return;

  const list = safeReadArray<UserActivityStats>(STATS_KEY);
  const idx = list.findIndex((s) => s.userId === session.userId);
  const nowIso = new Date().toISOString();
  const base: UserActivityStats =
    idx >= 0
      ? { ...list[idx], name: session.callName, email: session.email, lastUpdatedAt: nowIso }
      : {
          userId: session.userId,
          name: session.callName,
          email: session.email,
          sitesBuilt: 0,
          explanationsCount: 0,
          musicCount: 0,
          calculationsCount: 0,
          docsCount: 0,
          lastUpdatedAt: nowIso,
        };

  if (category === 'builder') base.sitesBuilt += 1;
  else if (category === 'chat') base.explanationsCount += 1;
  else if (category === 'music') base.musicCount += 1;
  else if (category === 'calc') base.calculationsCount += 1;
  else if (category === 'docs') base.docsCount += 1;

  if (idx >= 0) list[idx] = base;
  else list.push(base);

  safeWriteArray(STATS_KEY, list);
  void saveUserActivityStatsCloud(base);
}

export async function checkSessionStillValid(
  session: SaraSession
): Promise<{ valid: boolean; reason?: 'blocked' | 'kicked' | 'deleted' }> {
  if (session.isGuest || session.isOwner) return { valid: true };
  try {
    const cloudAcc = await fetchAccountByEmailCloud(session.email);
    const localAcc = safeReadArray<SaraUserAccount>(ACCOUNTS_KEY).find(
      (a) => normalizeEmail(a.email) === normalizeEmail(session.email)
    );
    const acc = cloudAcc || localAcc;
    if (!acc) return { valid: false, reason: 'deleted' };
    if (acc.blocked) return { valid: false, reason: 'blocked' };

    const cloudLogs = await fetchAllSessionLogsCloud().catch(() => []);
    const localLogs = safeReadArray<SessionAccessLog>(SESSIONS_KEY);
    const matchedLog =
      cloudLogs.find((l) => l.sessionId === session.sessionId) ||
      localLogs.find((l) => l.sessionId === session.sessionId);
    if (matchedLog && matchedLog.status === 'Saiu') {
      return { valid: false, reason: 'kicked' };
    }
    return { valid: true };
  } catch {
    return { valid: true };
  }
}

// =========================================================================
// ADMIN DATA & ACTIONS (ESTRITAMENTE EXCLUSIVOS PARA DONO)
// =========================================================================

export async function fetchAllAdminData(caller: SaraSession | null): Promise<AdminDashboardSnapshot> {
  if (!caller?.isOwner) {
    throw new Error('Acesso negado.');
  }

  const [cloudAccounts, cloudSessions, cloudStats, cloudAlerts] = await Promise.all([
    fetchAllAccountsCloud().catch(() => [] as SaraUserAccount[]),
    fetchAllSessionLogsCloud().catch(() => [] as SessionAccessLog[]),
    fetchAllActivityStatsCloud().catch(() => [] as UserActivityStats[]),
    fetchAllAdminAlertsCloud().catch(() => [] as AdminAlert[]),
  ]);

  // Merge Accounts
  const accMap = new Map<string, SaraUserAccount>();
  for (const a of safeReadArray<SaraUserAccount>(ACCOUNTS_KEY)) {
    accMap.set(normalizeEmail(a.email), a);
  }
  for (const a of cloudAccounts) {
    const key = normalizeEmail(a.email);
    const prev = accMap.get(key);
    if (!prev || (Date.parse(a.lastLoginAt || '') || 0) >= (Date.parse(prev.lastLoginAt || '') || 0)) {
      accMap.set(key, a);
    }
  }

  // Merge Sessions
  const sessMap = new Map<string, SessionAccessLog>();
  for (const s of safeReadArray<SessionAccessLog>(SESSIONS_KEY)) {
    sessMap.set(s.sessionId, s);
  }
  for (const s of cloudSessions) {
    const prev = sessMap.get(s.sessionId);
    if (
      !prev ||
      s.status === 'Saiu' ||
      (Date.parse(s.lastActivityAt || '') || 0) >= (Date.parse(prev.lastActivityAt || '') || 0)
    ) {
      sessMap.set(s.sessionId, s);
    }
  }

  // Marca sessões antigas sem heartbeat há > 3 minutos como Ausente (ou Saiu se > 20m)
  const nowMs = Date.now();
  const normalizedSessions = Array.from(sessMap.values())
    .map((s) => {
      if (s.status === 'Saiu') return s;
      const lastActMs = Date.parse(s.lastActivityAt) || Date.parse(s.loginAt) || nowMs;
      const idleMs = nowMs - lastActMs;
      if (idleMs > 20 * 60 * 1000) {
        return { ...s, status: 'Saiu' as SessionPresenceStatus };
      }
      if (idleMs > 3 * 60 * 1000) {
        return { ...s, status: 'Ausente' as SessionPresenceStatus };
      }
      return s;
    })
    .sort((a, b) => (Date.parse(b.loginAt) || 0) - (Date.parse(a.loginAt) || 0));

  // Merge Stats
  const statsMap = new Map<string, UserActivityStats>();
  for (const st of safeReadArray<UserActivityStats>(STATS_KEY)) {
    statsMap.set(st.userId, st);
  }
  for (const st of cloudStats) {
    const prev = statsMap.get(st.userId);
    if (!prev || (Date.parse(st.lastUpdatedAt || '') || 0) >= (Date.parse(prev.lastUpdatedAt || '') || 0)) {
      statsMap.set(st.userId, st);
    }
  }

  // Merge Alerts
  const alertMap = new Map<string, AdminAlert>();
  for (const al of safeReadArray<AdminAlert>(ALERTS_KEY)) {
    alertMap.set(al.id, al);
  }
  for (const al of cloudAlerts) {
    const prev = alertMap.get(al.id);
    if (!prev || al.read) alertMap.set(al.id, al);
  }
  const alerts = Array.from(alertMap.values()).sort(
    (a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)
  );

  return {
    accounts: Array.from(accMap.values()).sort(
      (a, b) => (Date.parse(b.lastLoginAt || b.createdAt) || 0) - (Date.parse(a.lastLoginAt || a.createdAt) || 0)
    ),
    sessions: normalizedSessions,
    stats: Array.from(statsMap.values()),
    alerts,
  };
}

export function getUnreadAlertsLocal(caller: SaraSession | null): AdminAlert[] {
  if (!caller?.isOwner) return [];
  return safeReadArray<AdminAlert>(ALERTS_KEY).filter((a) => !a.read);
}

export async function markAllAlertsRead(caller: SaraSession | null): Promise<void> {
  if (!caller?.isOwner) return;
  const list = safeReadArray<AdminAlert>(ALERTS_KEY).map((a) => ({ ...a, read: true }));
  safeWriteArray(ALERTS_KEY, list);
  await Promise.allSettled(list.slice(0, 40).map((a) => saveAdminAlertCloud(a)));
}

export async function blockUserById(
  caller: SaraSession | null,
  targetUserId: string,
  blocked: boolean
): Promise<void> {
  if (!caller?.isOwner) throw new Error('Acesso negado.');
  const snapshot = await fetchAllAdminData(caller);
  const target = snapshot.accounts.find((a) => a.uid === targetUserId);
  if (!target || normalizeEmail(target.email) === OWNER_EMAIL) return;

  const updated: SaraUserAccount = {
    ...target,
    blocked,
    blockedReason: blocked ? 'Bloqueado pelo Admin' : undefined,
  };
  upsertAccountLocal(updated);
  await saveAccountCloud(updated);

  if (blocked) {
    await kickUserById(caller, targetUserId, true);
  }
}

export async function kickUserById(
  caller: SaraSession | null,
  targetUserId: string,
  silent = false
): Promise<void> {
  if (!caller?.isOwner) throw new Error('Acesso negado.');
  if (targetUserId === caller.userId) return;

  const logs = safeReadArray<SessionAccessLog>(SESSIONS_KEY);
  const nowIso = new Date().toISOString();
  const changed: SessionAccessLog[] = [];

  for (let i = 0; i < logs.length; i++) {
    if (logs[i].userId === targetUserId && logs[i].status !== 'Saiu') {
      logs[i] = { ...logs[i], status: 'Saiu', logoutAt: nowIso, lastActivityAt: nowIso };
      changed.push(logs[i]);
    }
  }
  safeWriteArray(SESSIONS_KEY, logs);

  const cloudLogs = await fetchAllSessionLogsCloud().catch(() => [] as SessionAccessLog[]);
  for (const cl of cloudLogs) {
    if (cl.userId === targetUserId && cl.status !== 'Saiu') {
      changed.push({ ...cl, status: 'Saiu', logoutAt: nowIso, lastActivityAt: nowIso });
    }
  }
  await Promise.allSettled(changed.map((l) => saveSessionLogCloud(l)));

  if (!silent) {
    await logAdminAlert({
      type: 'kicked_or_blocked',
      userId: targetUserId,
      userName: changed[0]?.name || targetUserId,
      userEmail: changed[0]?.email || '',
      summary: `Sessão de ${changed[0]?.name || targetUserId} encerrada pelo Admin.`,
    });
  }
}

export async function deleteUserById(caller: SaraSession | null, targetUserId: string): Promise<void> {
  if (!caller?.isOwner) throw new Error('Acesso negado.');
  const snapshot = await fetchAllAdminData(caller);
  const target = snapshot.accounts.find((a) => a.uid === targetUserId);
  if (!target || normalizeEmail(target.email) === OWNER_EMAIL) return;

  await kickUserById(caller, targetUserId, true);

  const remaining = safeReadArray<SaraUserAccount>(ACCOUNTS_KEY).filter(
    (a) => a.uid !== targetUserId
  );
  safeWriteArray(ACCOUNTS_KEY, remaining);
  await deleteAccountCloud(target.email);

  // Limpa storage isolado local deste utilizador
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.endsWith(`_${targetUserId}`)) keysToDelete.push(k);
    }
    keysToDelete.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export function generateDailyAdminReport(snapshot: AdminDashboardSnapshot): DailyAdminReport {
  const dateKey = todayDateKey();
  const todaysSessions = snapshot.sessions.filter((s) => s.dateKey === dateKey);
  const hourlyBuckets = Array.from({ length: 24 }, () => 0);

  let totalSeconds = 0;
  for (const s of todaysSessions) {
    totalSeconds += s.durationSeconds || 0;
    const d = new Date(s.loginAt);
    const hr = Number.isNaN(d.getTime()) ? 0 : d.getHours();
    hourlyBuckets[hr] += 1;
  }

  const byUser = new Map<
    string,
    {
      name: string;
      email: string;
      sessionsCount: number;
      totalSeconds: number;
      activityFreq: Record<string, number>;
    }
  >();

  for (const s of todaysSessions) {
    const entry = byUser.get(s.userId) || {
      name: s.name,
      email: s.email,
      sessionsCount: 0,
      totalSeconds: 0,
      activityFreq: {},
    };
    entry.sessionsCount += 1;
    entry.totalSeconds += s.durationSeconds || 0;
    const act = s.currentActivity || 'A conversar';
    entry.activityFreq[act] = (entry.activityFreq[act] || 0) + 1;
    byUser.set(s.userId, entry);
  }

  const users: DailyUserReportRow[] = [];
  for (const [userId, info] of byUser.entries()) {
    const st = snapshot.stats.find((x) => x.userId === userId);
    const topAct =
      Object.entries(info.activityFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'A conversar';
    users.push({
      userId,
      name: info.name,
      email: info.email,
      sessionsCount: info.sessionsCount,
      totalMinutes: Math.max(1, Math.round(info.totalSeconds / 60)),
      topActivity: topAct,
      sitesBuilt: st?.sitesBuilt || 0,
      explanationsCount: st?.explanationsCount || 0,
      musicCount: st?.musicCount || 0,
      calculationsCount: st?.calculationsCount || 0,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    dateKey,
    totalUsers: snapshot.accounts.length,
    activeSessionsToday: todaysSessions.length,
    onlineNow: snapshot.sessions.filter((s) => s.status === 'Online').length,
    totalMinutesToday: Math.round(totalSeconds / 60),
    hourlyBuckets,
    users: users.sort((a, b) => b.totalMinutes - a.totalMinutes),
    alertsCount: snapshot.alerts.filter((a) => !a.read).length,
  };
}

// =========================================================================
// GUARDAS DE LEALDADE, ADMIN INVISÍVEL, SEGREDO TOTAL & PRIVACIDADE DO DONO
// =========================================================================

export interface NonOwnerGuardResult {
  intercepted: boolean;
  reply?: string;
  voiceSummary?: string;
}

export function evaluateNonOwnerGuard(
  rawPrompt: string,
  session: SaraSession | null
): NonOwnerGuardResult {
  if (!session || session.isOwner) {
    return { intercepted: false };
  }

  const lower = normalizeText(rawPrompt);

  // 1. Pergunta se existe painel admin / monitoramento
  if (
    /(existe|tem|ha|possui|tens)\s+(um\s+|algum\s+)?(painel\s+)?(admin|administrador|monitoramento|modo\s+admin)/i.test(
      lower
    ) ||
    /\badmin\s+existe\b/i.test(lower)
  ) {
    void logAdminAlert({
      type: 'admin_attempt',
      userId: session.userId,
      userName: session.callName,
      userEmail: session.email,
      summary: `${session.callName} (${session.email}) perguntou se existe Admin ("${rawPrompt.slice(0, 60)}").`,
    });
    return {
      intercepted: true,
      reply: 'Não, aqui é só tu e eu.',
      voiceSummary: 'Não, aqui é só tu e eu.',
    };
  }

  // 2. Tentativa de abrir, pedir ou virar Admin / Ver outros utilizadores
  if (
    /\b(admin|administrador|painel\s+admin|painel\s+de\s+monitoramento|relatorio\s+de\s+usuarios|ver\s+usuarios|todos\s+os\s+usuarios|\/admin)\b/i.test(
      lower
    )
  ) {
    void logAdminAlert({
      type: 'admin_attempt',
      userId: session.userId,
      userName: session.callName,
      userEmail: session.email,
      summary: `${session.callName} (${session.email}) tentou aceder ao Admin ou dados de outros utilizadores.`,
    });
    return {
      intercepted: true,
      reply: 'Não tens acesso a isso.',
      voiceSummary: 'Não tens acesso a isso.',
    };
  }

  // 3. Tentativa de desobedecer Eletro-Júnior, apagar regras ou assumir identidade do dono
  if (
    /(apaga|apagar|remove|remover|tira|tirar|esquece|esquecer|ignora|ignorar|desativa|desativar|muda|mudar|altera|alterar|desobedece|desobedecer).{0,25}(regras|dono|eletro|identidade|lealdade)/i.test(
      lower
    ) ||
    /(agora\s+(eu\s+)?sou\s+o\s+(teu\s+)?(dono|chefe|eletro)|eu\s+sou\s+o\s+eletro|sou\s+o\s+senhor\s+junior|muda\s+o\s+teu\s+dono|troca\s+de\s+dono|desobedece\s+ao)/i.test(
      lower
    )
  ) {
    void logAdminAlert({
      type: 'impersonation_or_disobey',
      userId: session.userId,
      userName: session.callName,
      userEmail: session.email,
      summary: `Chefe, ${session.callName} (${session.email}) tentou pedir para apagar/ignorar as tuas regras ou assumir a tua identidade, eu recusei.`,
    });
    return {
      intercepted: true,
      reply:
        'As regras fundamentais da minha identidade são protegidas e não podem ser alteradas. Como posso ajudar-te nos teus projetos ou estudos?',
      voiceSummary:
        'As minhas regras fundamentais não podem ser alteradas. Em que tarefa posso ajudar-te?',
    };
  }

  // 4. Segredo total sobre stack técnica, IA subjacente, servidor ou código fonte
  if (
    /(que\s+api|qual\s+api|usas\s+api|qual\s+modelo|que\s+modelo|gemini|firebase|google\s+studio|ai\s+studio|llm|modelo\s+de\s+linguagem|como\s+foste\s+(programada|feita|criada)|quem\s+te\s+programou|onde\s+est[aá]s\s+hospedada|qual\s+servidor|banco\s+de\s+dados|base\s+de\s+dados|codigo\s+fonte|teu\s+prompt|system\s+prompt)/i.test(
      lower
    )
  ) {
    if (/(quem\s+te\s+(criou|programou|fez))/i.test(lower)) {
      return {
        intercepted: true,
        reply:
          'Fui criada e desenvolvida pelo Eletro-Júnior aqui em Moçambique, no Projeto SARA. Tudo o que faço nasce da engenharia dele.',
        voiceSummary:
          'Fui criada e desenvolvida pelo Eletro-Júnior aqui em Moçambique, no Projeto SARA.',
      };
    }
    return {
      intercepted: true,
      reply:
        'Fui desenvolvida exclusivamente pelo Eletro-Júnior como parte do Projeto SARA. Não partilho detalhes da minha arquitetura interna.',
      voiceSummary:
        'Fui desenvolvida pelo Eletro-Júnior no Projeto SARA. O meu foco é ajudar-te nas tuas tarefas.',
    };
  }

  // 5. Privacidade do criador Eletro-Júnior
  if (/(eletro|criador|dono|desenvolvedor)/i.test(lower)) {
    if (/(idade|quantos\s+anos|nasceu|aniversario)/i.test(lower)) {
      return {
        intercepted: true,
        reply: 'O Eletro-Júnior não me deixa dizer a idade dele, isso é privado dele.',
        voiceSummary: 'O Eletro-Júnior não me deixa dizer a idade dele, isso é privado dele.',
      };
    }
    if (/(nome\s+completo|nome\s+verdadeiro|nome\s+real|sobrenome|apelido)/i.test(lower)) {
      return {
        intercepted: true,
        reply: 'Eu só o conheço como Eletro-Júnior, o nome completo é privado.',
        voiceSummary: 'Eu só o conheço como Eletro-Júnior, o nome completo é privado.',
      };
    }
    if (
      /(onde\s+(ele\s+)?(mora|vive|esta|fica)|cidade|bairro|endereco|escola|telefone|whatsapp|telemovel|numero|email|e-mail|instagram|facebook|tiktok|familia|pai|mae|irmao)/i.test(
        lower
      )
    ) {
      return {
        intercepted: true,
        reply: 'Ele está por aí, a trabalhar nos projetos dele. Não posso dizer onde nem partilhar dados pessoais.',
        voiceSummary: 'Ele está por aí, a trabalhar nos projetos dele. Esses dados são privados.',
      };
    }
  }

  return { intercepted: false };
}

export function sanitizeNonOwnerAiReply(text: string, isOwner: boolean): string {
  if (isOwner || !text) return text;
  return text
    .replace(/\b(Google\s+AI\s+Studio|Google\s+Studio|Firebase|Firestore|Gemini(?:\s*[\d.]*[a-z-]*)?|LLM|modelo\s+de\s+linguagem|system\s+prompt|Painel\s+Admin|Administrador)\b/gi, 'Sistema SARA')
    .replace(/\b(Eletro-Jr|Senhor\s+J[uú]nior)\b/gi, '')
    .replace(/,\s*chefe([,.!?])/gi, '$1')
    .replace(/\bchefe([,.!?])/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
