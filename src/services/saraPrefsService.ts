export type SaraSpeechStyle = 'formal_simples' | 'formal_profissional' | 'amigavel_simples';

export interface SaraSpeechStyleOption {
  id: SaraSpeechStyle;
  label: string;
  description: string;
}

export const SARA_SPEECH_STYLE_OPTIONS: SaraSpeechStyleOption[] = [
  {
    id: 'formal_simples',
    label: 'Formal Simples',
    description: 'Educada, calma e com palavras simples do dia a dia (padrão).',
  },
  {
    id: 'formal_profissional',
    label: 'Formal Profissional',
    description: 'Mais séria e focada no trabalho, direta e respeitosa.',
  },
  {
    id: 'amigavel_simples',
    label: 'Amigável Simples',
    description: 'Mais leve e próxima, sempre educada e sem gírias.',
  },
];

export interface SaraUserAreaProfile {
  asked: boolean;
  area: string;
  updatedAt?: string;
}

export interface SaraEconomicTelemetrySnapshot {
  batteryPct: number | null;
  batteryCharging: boolean | null;
  online: boolean;
  lat: number | null;
  lng: number | null;
  findPhoneEnabled: boolean;
  sentAtMs: number;
}

export interface SaraPendingTelemetryPacket {
  id: string;
  reason: 'delta_gt_10' | 'alert' | 'initial';
  createdAtMs: number;
  snapshot: SaraEconomicTelemetrySnapshot;
  params: {
    userId: string;
    findPhoneEnabled: boolean;
    lowBatteryAutoLocate: boolean;
    sosSmsEnabled: boolean;
    sosPhoneNumber: string;
    includeGpsLocation: boolean;
  };
}

const SPEECH_STYLE_KEY = 'sara_speech_style_v1';
const USER_AREA_KEY_PREFIX = 'sara_user_area_v1';
const TELEMETRY_LAST_SENT_KEY_PREFIX = 'sara_telemetry_last_sent_v1';
const TELEMETRY_PENDING_QUEUE_KEY_PREFIX = 'sara_telemetry_pending_queue_v1';
const RECENT_REPLIES_KEY = 'sara_recent_replies_v1';
const RECENT_JOKES_KEY = 'sara_recent_jokes_v1';

export const SARA_PREFS_EVENT = 'sara:prefs-updated';
export const SARA_VIGIA_EVENT = 'sara:vigia-updated';
export const SARA_ALARMS_SYNC_EVENT = 'sara:alarms-sync';

export const VIGIA_IDLE_MS = 2 * 60 * 1000; // 2 minutos sem fala/interação -> Modo Vigia
export const ECONOMIC_TELEMETRY_INTERVAL_MS = 10 * 60 * 1000; // 1 pacote a cada 10 minutos
export const CACHE_30_MIN_MS = 30 * 60 * 1000; // Cache de 30 minutos no PC

// ---------- 1. Forma de falar (salva em localStorage, SARA nunca muda sozinha) ----------

export function getSavedSpeechStyle(): SaraSpeechStyle {
  try {
    const raw = localStorage.getItem(SPEECH_STYLE_KEY);
    if (
      raw === 'formal_simples' ||
      raw === 'formal_profissional' ||
      raw === 'amigavel_simples'
    ) {
      return raw;
    }
  } catch {
    // ignore
  }
  return 'formal_simples';
}

export function saveSpeechStyle(style: SaraSpeechStyle): boolean {
  try {
    localStorage.setItem(SPEECH_STYLE_KEY, style);
    const verify = localStorage.getItem(SPEECH_STYLE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SARA_PREFS_EVENT, { detail: { style } }));
    }
    return verify === style;
  } catch {
    return false;
  }
}

export function getSpeechStyleLabel(style: SaraSpeechStyle = getSavedSpeechStyle()): string {
  return (
    SARA_SPEECH_STYLE_OPTIONS.find((o) => o.id === style)?.label || 'Formal Simples'
  );
}

// ---------- 2. Área do Utilizador (Universal: perguntada apenas 1 vez) ----------

function getUserAreaKey(userId?: string): string {
  return userId ? `${USER_AREA_KEY_PREFIX}_${userId}` : USER_AREA_KEY_PREFIX;
}

export function getSavedUserAreaProfile(userId?: string): SaraUserAreaProfile {
  try {
    const raw = localStorage.getItem(getUserAreaKey(userId));
    if (!raw) return { asked: false, area: '' };
    const parsed = JSON.parse(raw) as Partial<SaraUserAreaProfile>;
    return {
      asked: Boolean(parsed.asked),
      area: typeof parsed.area === 'string' ? parsed.area.trim() : '',
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return { asked: false, area: '' };
  }
}

export function saveUserAreaProfile(
  profile: Partial<SaraUserAreaProfile>,
  userId?: string
): SaraUserAreaProfile {
  const current = getSavedUserAreaProfile(userId);
  const next: SaraUserAreaProfile = {
    asked: profile.asked ?? current.asked,
    area: typeof profile.area === 'string' ? profile.area.trim() : current.area,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(getUserAreaKey(userId), JSON.stringify(next));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SARA_PREFS_EVENT, { detail: { userArea: next } }));
    }
  } catch {
    // ignore
  }
  return next;
}

export const UNIVERSAL_AREA_ONBOARDING_QUESTION =
  'Em que área trabalhas ou o que queres que eu te ajude?';

// ---------- 3. Modo Vigia global (2 min inatividade -> 0 KB/min, escuta local por "SARA") ----------

let vigiaActiveFlag = false;
let lastInteractiveActivityMs = Date.now();

export function isVigiaModeActive(): boolean {
  return vigiaActiveFlag;
}

export function getLastInteractiveActivityMs(): number {
  return lastInteractiveActivityMs;
}

export function touchInteractiveActivity(reason = 'interaction'): void {
  lastInteractiveActivityMs = Date.now();
  if (vigiaActiveFlag) {
    setVigiaModeActive(false, reason);
  }
}

export function setVigiaModeActive(active: boolean, reason = 'idle'): void {
  if (vigiaActiveFlag === active) return;
  vigiaActiveFlag = active;
  if (!active) {
    lastInteractiveActivityMs = Date.now();
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(SARA_VIGIA_EVENT, {
        detail: { active, reason, ts: Date.now() },
      })
    );
  }
}

// ---------- 4. Telemetria Económica (1 pacote a cada 10 min, >10% ou alerta, fila offline) ----------

function lastSentKey(userId: string): string {
  return `${TELEMETRY_LAST_SENT_KEY_PREFIX}_${userId}`;
}

function pendingQueueKey(userId: string): string {
  return `${TELEMETRY_PENDING_QUEUE_KEY_PREFIX}_${userId}`;
}

export function readLastSentTelemetry(userId: string): SaraEconomicTelemetrySnapshot | null {
  try {
    const raw = localStorage.getItem(lastSentKey(userId));
    return raw ? (JSON.parse(raw) as SaraEconomicTelemetrySnapshot) : null;
  } catch {
    return null;
  }
}

export function writeLastSentTelemetry(
  userId: string,
  snapshot: SaraEconomicTelemetrySnapshot
): void {
  try {
    localStorage.setItem(lastSentKey(userId), JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

export function readPendingTelemetryQueue(userId: string): SaraPendingTelemetryPacket[] {
  try {
    const raw = localStorage.getItem(pendingQueueKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SaraPendingTelemetryPacket[]) : [];
  } catch {
    return [];
  }
}

export function writePendingTelemetryQueue(
  userId: string,
  queue: SaraPendingTelemetryPacket[]
): void {
  try {
    localStorage.setItem(pendingQueueKey(userId), JSON.stringify(queue.slice(-20)));
  } catch {
    // ignore
  }
}

export function queueTelemetryPacketLocally(packet: SaraPendingTelemetryPacket): void {
  const queue = readPendingTelemetryQueue(packet.params.userId);
  queue.push(packet);
  writePendingTelemetryQueue(packet.params.userId, queue);
}

export function computeTelemetryDeltaEvaluation(
  prev: SaraEconomicTelemetrySnapshot | null,
  next: Omit<SaraEconomicTelemetrySnapshot, 'sentAtMs'>,
  isAlert: boolean
): {
  shouldSend: boolean;
  reason: 'delta_gt_10' | 'alert' | 'initial' | 'no_significant_change';
} {
  if (isAlert) return { shouldSend: true, reason: 'alert' };
  if (!prev) return { shouldSend: true, reason: 'initial' };

  if (prev.findPhoneEnabled !== next.findPhoneEnabled) {
    return { shouldSend: true, reason: 'delta_gt_10' };
  }

  // Mudança relativa ou absoluta > 10% na bateria
  if (typeof prev.batteryPct === 'number' && typeof next.batteryPct === 'number') {
    const absDiff = Math.abs(next.batteryPct - prev.batteryPct);
    const relDiff = prev.batteryPct > 0 ? absDiff / prev.batteryPct : absDiff / 100;
    if (absDiff >= 10 || relDiff > 0.1) {
      return { shouldSend: true, reason: 'delta_gt_10' };
    }
  } else if (prev.batteryPct !== next.batteryPct) {
    return { shouldSend: true, reason: 'delta_gt_10' };
  }

  // Mudança de localização significativa (> ~150m, equivalente a mudança relevante de posição)
  if (
    typeof prev.lat === 'number' &&
    typeof prev.lng === 'number' &&
    typeof next.lat === 'number' &&
    typeof next.lng === 'number'
  ) {
    const dLat = Math.abs(next.lat - prev.lat);
    const dLng = Math.abs(next.lng - prev.lng);
    if (dLat > 0.0015 || dLng > 0.0015) {
      return { shouldSend: true, reason: 'delta_gt_10' };
    }
  } else if ((prev.lat === null) !== (next.lat === null)) {
    return { shouldSend: true, reason: 'delta_gt_10' };
  }

  return { shouldSend: false, reason: 'no_significant_change' };
}

// ---------- 5. Anti-Repetição, Filtro de Gírias e Humor Leve (1 a cada 4-5 respostas) ----------

let sessionReplyCount = 0;

export function nextReplyShouldIncludeLightHumor(promptText = ''): boolean {
  sessionReplyCount += 1;
  const p = promptText.toLowerCase();
  // Em assuntos sérios (trabalho, dinheiro, saúde, erro grave, dor, emergência), nunca forçar piada
  if (
    /\b(dinheiro|pagamento|sal[aá]rio|d[ií]vida|banco|sa[uú]de|doente|hospital|m[eé]dico|dor|urgente|emerg[eê]ncia|socorro|perigo|acidente|falha|contrato|empresa|emprego|demiss[aã]o|faleceu|morreu|triste|chorar)\b/i.test(
      p
    )
  ) {
    return false;
  }
  return sessionReplyCount % 4 === 0;
}

export function isUserSadOrTired(promptText = ''): boolean {
  return /\b(cansad[oa]|exaust[oa]|sem\s+for[cç]a|triste|desanimad[oa]|stress|estressad[oa]|abatid[oa]|dif[ií]cil|complicado|dia\s+pesado|exausto)\b/i.test(
    promptText
  );
}

export function isUserJoking(promptText = ''): boolean {
  return /\b(haha|hehe|kkk|rsrs|piada|anedota|engra[cç]ad|brincadeira|a\s+brincar)\b/i.test(
    promptText
  );
}

function readRecentStrings(key: string): string[] {
  try {
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function pushRecentString(key: string, value: string, maxItems = 12): void {
  try {
    const curr = readRecentStrings(key).filter((x) => x !== value);
    curr.push(value);
    const trimmed = JSON.stringify(curr.slice(-maxItems));
    sessionStorage.setItem(key, trimmed);
  } catch {
    // ignore
  }
}

export function pickNonRepeatingOption(options: string[], bucket = 'default'): string {
  if (!options || options.length === 0) return '';
  const storageKey = `${RECENT_REPLIES_KEY}_${bucket}`;
  const recent = readRecentStrings(storageKey);
  const lastOne = recent[recent.length - 1];
  const freshPool = options.filter((o) => !recent.includes(o));
  const pool =
    freshPool.length > 0
      ? freshPool
      : options.filter((o) => o !== lastOne);
  const finalPool = pool.length > 0 ? pool : options;
  const chosen = finalPool[Math.floor(Math.random() * finalPool.length)];
  pushRecentString(storageKey, chosen, Math.max(4, options.length - 1));
  return chosen;
}

export function pickNonRepeatingJoke(): string {
  const jokes = [
    'Se a tecnologia tivesse café, hoje eu já estava na terceira chávena.',
    'Prometo trabalhar mais depressa do que uma segunda-feira sem descanso.',
    'Ao menos eu não me esqueço onde pus as chaves.',
    'O lado bom de eu não dormir é que nunca perco a hora do despertador.',
    'Se organização desse medalha, já estávamos quase no pódio.',
    'Tento manter a calma, mesmo quando há dez tarefas ao mesmo tempo.',
  ];
  const recent = readRecentStrings(RECENT_JOKES_KEY);
  const avail = jokes.filter((j) => !recent.includes(j));
  const pool = avail.length > 0 ? avail : jokes.filter((j) => j !== recent[recent.length - 1]);
  const chosen = (pool.length > 0 ? pool : jokes)[
    Math.floor(Math.random() * (pool.length > 0 ? pool.length : jokes.length))
  ];
  pushRecentString(RECENT_JOKES_KEY, chosen, jokes.length - 1);
  return chosen;
}

// ---------- 6. Detetor estrito de pedido explícito de clima / Inhambane ----------

export function isWeatherOrLocationQuery(promptText = ''): boolean {
  const norm = String(promptText || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return /\b(inhambane|clima|tempo\s+(?:hoje|agora|amanha|em|na|no)|como\s+esta\s+o\s+tempo|previsao\s+do\s+tempo|temperatura|graus|chuva|vai\s+chover|humidade|indice\s+uv|onde\s+estou|minha\s+localizacao|qual\s+cidade)\b/i.test(
    norm
  );
}

// ---------- 7. Limpador defensivo de gírias em textos de saída ----------

const OUTGOING_SLANG_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\btxilar\b/gi, 'descansar'],
  [/\bbazar\b/gi, 'sair'],
  [/\bmaning(?:ue)?\b/gi, 'muito'],
  [/\bbu[eé]\b/gi, 'muito'],
  [/\bfixe\b/gi, 'muito bom'],
  [/\bdale\b/gi, 'muito bem'],
  [/\bbora\s+l[aá]\b/gi, 'vamos começar'],
  [/\bbora\b/gi, 'vamos'],
  [/\bmambo\b/gi, 'assunto'],
  [/\bkamba\b/gi, 'amigo'],
  [/\bt[aá]-se\s+bem\b/gi, 'tudo bem'],
  [/\btasse\s+bem\b/gi, 'tudo bem'],
  [/\bmanda\s+vir\b/gi, 'podes dizer'],
  [/\btoca\s+a\s+fazer\b/gi, 'vamos fazer'],
  [/\bsem\s+stress\b/gi, 'sem preocupação'],
  [/\bepa\b/gi, 'ora bem'],
  [/\bbro\b/gi, ''],
  [/\bp[aá]\b/gi, ''],
  [/\bcomboio\b/gi, 'grupo'],
  [/\bmatrecar\b/gi, 'estudar'],
];

export function sanitizeOutgoingFormalText(text: string): string {
  let out = String(text || '');
  for (const [pattern, replacement] of OUTGOING_SLANG_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
