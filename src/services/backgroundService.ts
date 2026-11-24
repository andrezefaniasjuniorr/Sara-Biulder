import type { BackgroundReminder, BackgroundSettings } from '../types/location';
import {
  extractTimeHHmm,
  getMaputoNowParts,
  normalizeTextForSchedule,
  resolvePortugueseDate,
} from '../utils/timeAgendaService';

const BG_SETTINGS_KEY = 'sara_bg_settings_v1';
const BG_REMINDERS_KEY = 'sara_bg_reminders_v1';
const BG_RUNNING_MARKER_KEY = 'sara_bg_was_running_v1';
const BG_CLOSED_BY_EXIT_KEY = 'sara_bg_stopped_by_browser_close_v1';

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  backgroundAllowed: false,
  eiSaraEnabled: true,
  continuousVoiceBg: true,
  persistentNotification: true,
  floatingBubbleEnabled: true,
  pcMiniWindowEnabled: true,
  findPhoneEnabled: true,
  lowBatteryAutoLocate: true,
  sosSmsEnabled: false,
  sosPhoneNumber: '',
};

function scopedKey(base: string, uid?: string): string {
  return uid ? `${base}_${uid}` : base;
}

export function loadBackgroundSettings(uid?: string): BackgroundSettings {
  try {
    const raw = localStorage.getItem(scopedKey(BG_SETTINGS_KEY, uid));
    if (!raw) return { ...DEFAULT_BACKGROUND_SETTINGS };
    return { ...DEFAULT_BACKGROUND_SETTINGS, ...(JSON.parse(raw) as Partial<BackgroundSettings>) };
  } catch {
    return { ...DEFAULT_BACKGROUND_SETTINGS };
  }
}

export function saveBackgroundSettings(uid: string | undefined, next: BackgroundSettings): void {
  if (!uid || uid.startsWith('guest_')) return;
  try {
    localStorage.setItem(scopedKey(BG_SETTINGS_KEY, uid), JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function loadBackgroundReminders(uid?: string): BackgroundReminder[] {
  if (!uid || uid.startsWith('guest_')) return [];
  try {
    const raw = localStorage.getItem(scopedKey(BG_REMINDERS_KEY, uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BackgroundReminder[]) : [];
  } catch {
    return [];
  }
}

export function saveBackgroundReminders(
  uid: string | undefined,
  reminders: BackgroundReminder[]
): void {
  if (!uid || uid.startsWith('guest_')) return;
  try {
    localStorage.setItem(scopedKey(BG_REMINDERS_KEY, uid), JSON.stringify(reminders.slice(0, 60)));
  } catch {
    // ignore
  }
}

// =========================================================================
// DETETOR DO COMANDO "EI SARA" & LEMBRETES ("SARA lembra-me às 17h")
// =========================================================================

export function isEiSaraWakePhrase(transcript: string): boolean {
  const norm = normalizeTextForSchedule(transcript).replace(/[!?,.;:]/g, '').trim();
  return /^(?:ei|hey|eh|oi|ola)\s+(?:sara|sarah|sera|zara|sala)(?:\s+(?:acorda|esta\s+aqui|ouve|escuta))?$/i.test(
    norm
  );
}

export function parseBackgroundReminderInput(
  rawText: string,
  now: Date = new Date()
): BackgroundReminder | null {
  const raw = String(rawText || '').trim();
  if (!raw) return null;
  const norm = normalizeTextForSchedule(raw);

  // Tem de conter intenção explícita de lembrar / lembrete
  if (!/\b(lembra(?:-me)?|lembrar(?:-me)?|lembrete|avisa(?:-me)?)\b/.test(norm)) {
    return null;
  }

  // Caso 1: relativo ("daqui a 10 minutos" / "em 1 hora")
  const relMatch = norm.match(/\b(?:daqui\s+a|em|dentro\s+de)\s+(\d+)\s*(min(?:utos?)?|h(?:oras?)?|seg(?:undos?)?)\b/);
  if (relMatch) {
    const qty = Math.max(1, Number(relMatch[1] || 1));
    const unit = relMatch[2] || 'min';
    let offsetMs = qty * 60 * 1000;
    if (unit.startsWith('h')) offsetMs = qty * 60 * 60 * 1000;
    else if (unit.startsWith('s')) offsetMs = qty * 1000;

    const target = new Date(now.getTime() + offsetMs);
    const parts = getMaputoNowParts(target);
    let cleanTitle = raw
      .replace(/^(?:ei|ol[aá]|sara)[,\s]+/gi, '')
      .replace(/\b(?:sara|lembra(?:-me)?|lembrar(?:-me)?|avisa(?:-me)?|de|para|que|daqui\s+a\s+\d+\s*\w+|em\s+\d+\s*\w+)\b/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!cleanTitle) cleanTitle = `Lembrete (${parts.timeHHmm})`;

    return {
      id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
      dateIso: parts.isoDate,
      timeHHmm: parts.timeHHmm,
      targetMs: target.getTime(),
      fired: false,
      createdAt: now.toISOString(),
    };
  }

  // Caso 2: hora específica ("às 17h", "às 17:30", "amanhã às 8h")
  const { timeHHmm, explicitTimeFound } = extractTimeHHmm(raw);
  if (!explicitTimeFound) return null;

  const { dateIso } = resolvePortugueseDate(raw, now);
  const [yStr, mStr, dStr] = dateIso.split('-');
  const [hStr, minStr] = timeHHmm.split(':');

  // Calcula targetMs em Maputo (UTC+2)
  let targetMs = Date.UTC(
    Number(yStr),
    Number(mStr) - 1,
    Number(dStr),
    Number(hStr) - 2,
    Number(minStr),
    0
  );
  if (targetMs <= now.getTime() - 30000 && !/\bamanha\b|\bdepois\b/i.test(norm)) {
    // Se disse "às 17h" sem data e já passou hoje, agenda para amanhã
    targetMs += 24 * 60 * 60 * 1000;
  }

  let title = raw
    .replace(/^(?:ei|ol[aá]|sara)[,\s]+/gi, '')
    .replace(/\b(?:sara|lembra(?:-me)?|lembrar(?:-me)?|avisa(?:-me)?|cria\s+um\s+lembrete)\b/gi, ' ')
    .replace(/\b(?:[aà]s|pelas|para\s+[aà]s)\s+\d{1,2}(?::\d{2}|h\d{0,2}|\s*horas?)?\b/gi, ' ')
    .replace(/\b\d{1,2}(?::\d{2}|h\d{0,2})\b/gi, ' ')
    .replace(/\b(?:hoje|amanh[aã]|depois\s+de\s+amanh[aã]|da\s+tarde|da\s+noite|da\s+manh[aã])\b/gi, ' ')
    .replace(/\b(?:de|para|do|da)\s+/gi, ' ')
    .replace(/[,\-.:;]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!title) {
    title = `Lembrete das ${timeHHmm}`;
  } else {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  return {
    id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title,
    dateIso: getMaputoNowParts(new Date(targetMs)).isoDate,
    timeHHmm,
    targetMs,
    fired: false,
    createdAt: now.toISOString(),
  };
}

// =========================================================================
// SERVICE WORKER + NOTIFICAÇÕES + WORKER KEEPALIVE + WAKE LOCK
// =========================================================================

let wakeLockSentinel: { release?: () => Promise<void> } | null = null;
let bgWorker: Worker | null = null;
let keepAliveAudioCtx: AudioContext | null = null;
let keepAliveOsc: OscillatorNode | null = null;

export async function postMessageToServiceWorker(payload: Record<string, unknown>): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg?.active) {
      reg.active.postMessage(payload);
    } else if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(payload);
    }
  } catch {
    // ignore
  }
}

export async function requestNotificationPermissionIfNeeded(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showSaraSystemNotification(params: {
  title: string;
  body: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
}): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    await postMessageToServiceWorker({
      type: 'SARA_SHOW_NOTIFICATION',
      title: params.title,
      body: params.body,
      tag: params.tag,
      requireInteraction: params.requireInteraction,
      data: params.data,
    });
    return;
  }
  try {
    new Notification(params.title, {
      body: params.body,
      icon: '/pwa-192x192.png',
      tag: params.tag,
    });
  } catch {
    // ignore
  }
}

export async function syncPersistentBackgroundNotification(enabled: boolean): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  await postMessageToServiceWorker({
    type: enabled ? 'SARA_SHOW_PERSISTENT_BG' : 'SARA_CLEAR_PERSISTENT_BG',
  });
}

export async function syncReminderToServiceWorker(reminder: BackgroundReminder): Promise<void> {
  await postMessageToServiceWorker({
    type: 'SARA_SCHEDULE_REMINDER',
    reminder,
  });
}

export async function requestScreenWakeLock(): Promise<boolean> {
  try {
    const navAny = navigator as unknown as {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    if (!navAny?.wakeLock) return false;
    if (wakeLockSentinel) return true;
    wakeLockSentinel = await navAny.wakeLock.request('screen');
    return true;
  } catch {
    return false;
  }
}

export async function releaseScreenWakeLock(): Promise<void> {
  try {
    if (wakeLockSentinel?.release) {
      await wakeLockSentinel.release();
    }
  } catch {
    // ignore
  } finally {
    wakeLockSentinel = null;
  }
}

export function startSilentAudioKeepAlive(): void {
  if (typeof window === 'undefined') return;
  try {
    if (keepAliveAudioCtx) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    keepAliveAudioCtx = new AudioCtx();
    keepAliveOsc = keepAliveAudioCtx.createOscillator();
    const gain = keepAliveAudioCtx.createGain();
    gain.gain.value = 0.0001; // Praticamente inaudível — mantém o áudio do navegador vivo em segundo plano
    keepAliveOsc.frequency.value = 180;
    keepAliveOsc.connect(gain);
    gain.connect(keepAliveAudioCtx.destination);
    keepAliveOsc.start();
  } catch {
    // ignore
  }
}

export function stopSilentAudioKeepAlive(): void {
  try {
    keepAliveOsc?.stop();
    keepAliveOsc?.disconnect();
    void keepAliveAudioCtx?.close();
  } catch {
    // ignore
  } finally {
    keepAliveOsc = null;
    keepAliveAudioCtx = null;
  }
}

export function startBackgroundWorkerLoop(onTick: () => void): () => void {
  stopBackgroundWorkerLoop();
  if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
    try {
      const workerCode = `
        setInterval(() => {
          self.postMessage({ type: 'tick', ts: Date.now() });
        }, 5000);
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      bgWorker = new Worker(url);
      bgWorker.onmessage = () => onTick();
      return () => {
        stopBackgroundWorkerLoop();
        URL.revokeObjectURL(url);
      };
    } catch {
      // fallback setInterval
    }
  }
  const timer = setInterval(onTick, 5000);
  return () => clearInterval(timer);
}

export function stopBackgroundWorkerLoop(): void {
  if (bgWorker) {
    bgWorker.terminate();
    bgWorker = null;
  }
}

// =========================================================================
// ALARME SONORO ALTO (TOCAR ALARME NO ACHAR MEU CELULAR + LEMBRETES)
// =========================================================================

let activeAlarmTimer: ReturnType<typeof setInterval> | null = null;
let activeAlarmCtx: AudioContext | null = null;

export function startLoudDeviceAlarmLoop(): void {
  stopLoudDeviceAlarmLoop();
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    activeAlarmCtx = new AudioCtx();
    let step = 0;

    const ringBurst = () => {
      if (!activeAlarmCtx) return;
      if (activeAlarmCtx.state === 'suspended') {
        void activeAlarmCtx.resume().catch(() => {});
      }
      const now = activeAlarmCtx.currentTime;
      const osc = activeAlarmCtx.createOscillator();
      const gain = activeAlarmCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(step % 2 === 0 ? 880 : 1180, now);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.02, now + 0.52);
      osc.connect(gain);
      gain.connect(activeAlarmCtx.destination);
      osc.start(now);
      osc.stop(now + 0.55);
      step++;

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([350, 150, 350]);
      }
    };

    ringBurst();
    activeAlarmTimer = setInterval(ringBurst, 700);
  } catch {
    // ignore
  }
}

export function stopLoudDeviceAlarmLoop(): void {
  if (activeAlarmTimer) {
    clearInterval(activeAlarmTimer);
    activeAlarmTimer = null;
  }
  try {
    void activeAlarmCtx?.close();
  } catch {
    // ignore
  } finally {
    activeAlarmCtx = null;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(0);
  }
}

export function playReminderBellChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [660, 880, 1046];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.16;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.28, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.46);
    });
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 1500);
  } catch {
    // ignore
  }
}

// =========================================================================
// CONTROLO DE FECHO DO NAVEGADOR (PAROU PORQUE O NAVEGADOR FOI FECHADO)
// =========================================================================

export function setBackgroundActiveLifecycleFlag(active: boolean): void {
  try {
    if (active) {
      localStorage.setItem(BG_RUNNING_MARKER_KEY, '1');
    } else {
      localStorage.removeItem(BG_RUNNING_MARKER_KEY);
      localStorage.removeItem(BG_CLOSED_BY_EXIT_KEY);
    }
  } catch {
    // ignore
  }
}

export function markBrowserClosingWhileBackgroundActive(): void {
  try {
    if (localStorage.getItem(BG_RUNNING_MARKER_KEY) === '1') {
      localStorage.setItem(BG_CLOSED_BY_EXIT_KEY, String(Date.now()));
    }
  } catch {
    // ignore
  }
}

export function consumeBrowserClosedBackgroundNotice(): string | null {
  try {
    const closedAt = localStorage.getItem(BG_CLOSED_BY_EXIT_KEY);
    if (closedAt) {
      localStorage.removeItem(BG_CLOSED_BY_EXIT_KEY);
      return 'SARA parou porque o navegador foi fechado. Reabre para continuar em segundo plano.';
    }
  } catch {
    // ignore
  }
  return null;
}
