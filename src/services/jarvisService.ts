import type {
  JarvisActionPayload,
  JarvisAgendaItem,
  JarvisAlarmItem,
  JarvisAssistantResponse,
  JarvisConversationEntry,
  JarvisDocumentItem,
  JarvisHeadMood,
  JarvisMediaStateContext,
  JarvisMemoryState,
  JarvisModuleTab,
  JarvisSystemTelemetry,
  JarvisTaskItem,
  JarvisTrack,
  JarvisWeatherInfo,
} from '../types/jarvis';
import { getSavedGeminiKey } from './saraAiService';

const JARVIS_STORAGE_KEYS = {
  agenda: 'sara_jarvis_agenda_v1',
  alarms: 'sara_jarvis_alarms_v1',
  tasks: 'sara_jarvis_tasks_v1',
  memory: 'sara_jarvis_memory_v1',
  docs: 'sara_jarvis_docs_v1',
  chat: 'sara_jarvis_chat_v1',
  playlist: 'sara_jarvis_playlist_v1',
  weather: 'sara_jarvis_weather_v1',
};

const INHAMBANE_DEFAULT = {
  lat: -23.865,
  lon: 35.3833,
  city: 'Inhambane Cidade, Inhambane, Moçambique',
};

const LEGACY_MOCK_AGENDA_IDS = new Set(['ag_welcome']);
const LEGACY_MOCK_TASK_IDS = new Set(['tsk_1']);
const LEGACY_MOCK_TRACK_IDS = new Set(['synth_stark_pulse', 'yt_lofi_study', 'synth_neon_drive']);

export const DEFAULT_JARVIS_MEMORY: JarvisMemoryState = {
  userName: 'Eletro-Jr',
  preferences: ['Inhambane Cidade, Inhambane, Moçambique'],
  facts: ['Reside em Inhambane Cidade, Inhambane, Moçambique'],
};

export const DEFAULT_JARVIS_TRACKS: JarvisTrack[] = [];

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export function loadJarvisLocalBundle() {
  const rawAgenda = safeReadJson<JarvisAgendaItem[]>(JARVIS_STORAGE_KEYS.agenda, []);
  const agenda = Array.isArray(rawAgenda)
    ? rawAgenda.filter((item) => item && !LEGACY_MOCK_AGENDA_IDS.has(item.id))
    : [];

  const rawTasks = safeReadJson<JarvisTaskItem[]>(JARVIS_STORAGE_KEYS.tasks, []);
  const tasks = Array.isArray(rawTasks)
    ? rawTasks.filter((item) => item && !LEGACY_MOCK_TASK_IDS.has(item.id))
    : [];

  const rawPlaylist = safeReadJson<JarvisTrack[]>(JARVIS_STORAGE_KEYS.playlist, []);
  const playlist = Array.isArray(rawPlaylist)
    ? rawPlaylist.filter(
        (tr) =>
          tr &&
          tr.source === 'youtube' &&
          Boolean(tr.videoId) &&
          !LEGACY_MOCK_TRACK_IDS.has(tr.id) &&
          !tr.id.startsWith('synth_')
      )
    : [];

  const rawMem = safeReadJson<JarvisMemoryState>(JARVIS_STORAGE_KEYS.memory, DEFAULT_JARVIS_MEMORY);
  const cleanedFacts = (rawMem?.facts || []).filter(
    (f) => !/\b(luanda|angola|matola)\b/i.test(f)
  );
  const memory: JarvisMemoryState = {
    userName: rawMem?.userName || DEFAULT_JARVIS_MEMORY.userName,
    preferences: rawMem?.preferences || DEFAULT_JARVIS_MEMORY.preferences,
    facts: cleanedFacts.length > 0 ? cleanedFacts : DEFAULT_JARVIS_MEMORY.facts,
    lastRoutineGreetingDate: rawMem?.lastRoutineGreetingDate,
    lastVisitDate: rawMem?.lastVisitDate,
    lastActiveProjectName: rawMem?.lastActiveProjectName,
    lastTopic: rawMem?.lastTopic,
  };

  // Remove eventual cache antigo de Luanda/Angola/Matola
  try {
    const cachedW = safeReadJson<{ ts: number; data: JarvisWeatherInfo } | null>(
      JARVIS_STORAGE_KEYS.weather,
      null
    );
    if (cachedW?.data?.city && /\b(luanda|angola|matola)\b/i.test(cachedW.data.city)) {
      localStorage.removeItem(JARVIS_STORAGE_KEYS.weather);
    }
  } catch {
    // ignore
  }

  return {
    agenda,
    alarms: safeReadJson<JarvisAlarmItem[]>(JARVIS_STORAGE_KEYS.alarms, []),
    tasks,
    memory,
    documents: safeReadJson<JarvisDocumentItem[]>(JARVIS_STORAGE_KEYS.docs, []),
    conversation: safeReadJson<JarvisConversationEntry[]>(JARVIS_STORAGE_KEYS.chat, []),
    playlist,
  };
}

export function saveJarvisAgenda(items: JarvisAgendaItem[]) {
  safeWriteJson(JARVIS_STORAGE_KEYS.agenda, items);
}

export function saveJarvisAlarms(items: JarvisAlarmItem[]) {
  safeWriteJson(JARVIS_STORAGE_KEYS.alarms, items);
}

export function saveJarvisTasks(items: JarvisTaskItem[]) {
  safeWriteJson(JARVIS_STORAGE_KEYS.tasks, items);
}

export function saveJarvisMemory(memory: JarvisMemoryState) {
  safeWriteJson(JARVIS_STORAGE_KEYS.memory, memory);
}

export function saveJarvisDocuments(docs: JarvisDocumentItem[]) {
  const compact = docs.slice(0, 20).map((d) => ({
    ...d,
    base64Data: undefined,
    previewBlobUrl: undefined,
    textContent: d.textContent ? d.textContent.slice(0, 6000) : undefined,
  }));
  safeWriteJson(JARVIS_STORAGE_KEYS.docs, compact);
}

export function saveJarvisConversation(entries: JarvisConversationEntry[]) {
  safeWriteJson(JARVIS_STORAGE_KEYS.chat, entries.slice(-40));
}

export function saveJarvisPlaylist(tracks: JarvisTrack[]) {
  safeWriteJson(JARVIS_STORAGE_KEYS.playlist, tracks.slice(0, 25));
}

function documentAttachmentMime(doc: JarvisDocumentItem): string {
  if (doc.mimeType) return doc.mimeType;
  const lower = doc.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'text/plain';
}

export function sanitizeAssistantPlainText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/```[\s\S]*$/g, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$([^$\n]+)\$/g, '$1')
    .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
    .replace(/__([\s\S]*?)__/g, '$1')
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?;:])/g, '$1$2')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[*•]\s+/gm, '- ')
    .replace(/\*/g, '')
    .replace(/\|/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeJarvisAction(act: any): JarvisActionPayload {
  const normalized: JarvisActionPayload = { ...act };
  if (normalized.type === 'open_module' && !normalized.moduleTab && act?.module) {
    normalized.moduleTab = act.module as JarvisModuleTab;
  }
  if (normalized.type === 'show_explanation') {
    normalized.sections = Array.isArray(act?.sections) ? act.sections : [];
  }
  if (normalized.type === 'show_quiz') {
    normalized.questions = Array.isArray(act?.questions)
      ? act.questions.map((q: any) => ({
          question: String(q?.question || ''),
          options: Array.isArray(q?.options) ? q.options.map(String) : [],
          correctIndex: typeof q?.correctIndex === 'number' ? q.correctIndex : 0,
          explanation: String(q?.explanation || ''),
        }))
      : [];
  }
  if (normalized.type === 'show_flashcards') {
    normalized.cards = Array.isArray(act?.cards)
      ? act.cards.map((c: any) => ({
          front: String(c?.front || ''),
          back: String(c?.back || ''),
          hint: c?.hint ? String(c.hint) : undefined,
          lang: c?.lang || undefined,
        }))
      : [];
  }
  if (normalized.type === 'show_ideation') {
    normalized.cards = Array.isArray(act?.cards) ? act.cards : [];
  }
  if (normalized.type === 'read_aloud') {
    normalized.text = String(act?.text || act?.summary || '');
    normalized.title = String(act?.title || 'Leitura SARA');
  }
  if (normalized.type === 'set_volume') {
    if (typeof act?.volume === 'number') normalized.volume = act.volume;
    if (typeof act?.delta === 'number') normalized.delta = act.delta;
  }
  return normalized;
}

function maybeExtractSvgAction(
  prompt: string,
  reply: string,
  actions: JarvisActionPayload[]
): JarvisActionPayload[] {
  const hasSvgAction = actions.some((a) => a.type === 'show_svg' && a.svgCode);
  if (hasSvgAction) return actions;

  const svgMatch = reply.match(/<svg\b[\s\S]*?<\/svg>/i);
  if (svgMatch?.[0]) {
    return [
      ...actions,
      {
        type: 'show_svg',
        title: prompt.slice(0, 52) || 'Ilustração Vetorial SARA',
        svgCode: svgMatch[0],
      },
    ];
  }
  return actions;
}

function parseStreamingJarvisTags(buffer: string): {
  speak: string;
  speakComplete: boolean;
  reply: string;
  actions: JarvisActionPayload[];
  mood?: JarvisHeadMood;
} {
  const speakOpen = buffer.indexOf('<JARVIS_SPEAK>');
  const speakClose = buffer.indexOf('</JARVIS_SPEAK>');
  let speak = '';
  let speakComplete = false;
  if (speakOpen !== -1) {
    if (speakClose !== -1) {
      speak = buffer.slice(speakOpen + 14, speakClose).trim();
      speakComplete = true;
    } else {
      speak = buffer.slice(speakOpen + 14).trim();
    }
  }

  let reply = '';
  const replyOpen = buffer.indexOf('<JARVIS_REPLY>');
  const replyClose = buffer.indexOf('</JARVIS_REPLY>');
  if (replyOpen !== -1) {
    reply =
      replyClose !== -1
        ? buffer.slice(replyOpen + 14, replyClose).trim()
        : buffer.slice(replyOpen + 14).trim();
  }

  let actions: JarvisActionPayload[] = [];
  const actMatch = buffer.match(/<JARVIS_ACTIONS>([\s\S]*?)<\/JARVIS_ACTIONS>/i);
  if (actMatch?.[1]) {
    try {
      const parsed = JSON.parse(actMatch[1].trim());
      if (Array.isArray(parsed)) {
        actions = parsed.map(normalizeJarvisAction);
      }
    } catch {
      // ignore invalid partial JSON
    }
  }

  const moodMatch = buffer.match(/<JARVIS_MOOD>\s*(idle|listening|thinking|speaking|happy|focus)\s*<\/JARVIS_MOOD>/i);
  const mood = moodMatch?.[1] as JarvisHeadMood | undefined;

  return { speak, speakComplete, reply, actions, mood };
}

export interface JarvisStreamCallbacks {
  onSpeakReady?: (speakText: string) => void;
  onReplyPartial?: (partialReply: string) => void;
  onModelStatus?: (model: string) => void;
}

export async function askJarvisAssistantStream(
  params: {
    prompt: string;
    history: JarvisConversationEntry[];
    memory: JarvisMemoryState;
    agenda: JarvisAgendaItem[];
    tasks: JarvisTaskItem[];
    alarms: JarvisAlarmItem[];
    weather?: JarvisWeatherInfo | null;
    telemetry?: JarvisSystemTelemetry | null;
    mediaState?: JarvisMediaStateContext | null;
    documentAttachment?: JarvisDocumentItem | null;
    activeDocument?: JarvisDocumentItem | null;
    builderContext?: { activeProjectName?: string; activeProjectFiles?: string[] } | null;
  },
  callbacks?: JarvisStreamCallbacks
): Promise<JarvisAssistantResponse> {
  const apiKey = getSavedGeminiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-gemini-api-key'] = apiKey;

  const requestBody = JSON.stringify({
    prompt: params.prompt,
    history: params.history.slice(-10),
    memory: params.memory,
    agenda: params.agenda,
    tasks: params.tasks,
    alarms: params.alarms,
    weather: params.weather || null,
    telemetry: params.telemetry || null,
    mediaState: params.mediaState || null,
    builderContext: params.builderContext || null,
    documentAttachment: params.documentAttachment
      ? {
          name: params.documentAttachment.name,
          mimeType: documentAttachmentMime(params.documentAttachment),
          textContent: params.documentAttachment.textContent,
          base64Data: params.documentAttachment.base64Data,
        }
      : null,
    activeDocument: params.activeDocument
      ? {
          name: params.activeDocument.name,
          summary: params.activeDocument.summary,
          textContent: params.activeDocument.textContent,
        }
      : null,
    nowIso: new Date().toISOString(),
  });

  try {
    const resp = await fetch('/api/jarvis-stream', {
      method: 'POST',
      headers,
      body: requestBody,
    });

    if (resp.ok && resp.body) {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let sseBuffer = '';
      let rawAccum = '';
      let modelUsed = '';
      let speakEmitted = false;
      let lastPartialReply = '';
      let enrichedActionsFromServer: JarvisActionPayload[] | null = null;
      let streamError = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const rawJson = line.slice(6).trim();
          if (!rawJson) continue;
          try {
            const evt = JSON.parse(rawJson);
            if (evt.type === 'status' && evt.model) {
              modelUsed = evt.model;
              callbacks?.onModelStatus?.(evt.model);
            } else if (evt.type === 'chunk' && evt.text) {
              rawAccum += evt.text;
              const parsed = parseStreamingJarvisTags(rawAccum);
              if (!speakEmitted && parsed.speakComplete && parsed.speak) {
                const cleanSpeak = sanitizeAssistantPlainText(parsed.speak);
                if (cleanSpeak) {
                  speakEmitted = true;
                  callbacks?.onSpeakReady?.(cleanSpeak);
                }
              }
              if (parsed.reply) {
                const cleanPartial = sanitizeAssistantPlainText(parsed.reply);
                if (cleanPartial && cleanPartial !== lastPartialReply) {
                  lastPartialReply = cleanPartial;
                  callbacks?.onReplyPartial?.(cleanPartial);
                }
              }
            } else if (evt.type === 'enriched_actions' && Array.isArray(evt.actions)) {
              enrichedActionsFromServer = evt.actions.map(normalizeJarvisAction);
            } else if (evt.type === 'error' && evt.error) {
              streamError = evt.error;
            }
          } catch {
            // ignore incomplete SSE line
          }
        }
      }

      if (rawAccum.trim()) {
        const finalParsed = parseStreamingJarvisTags(rawAccum);
        const strippedFallback = rawAccum
          .replace(/<JARVIS_SPEAK>[\s\S]*?<\/JARVIS_SPEAK>/gi, '')
          .replace(/<JARVIS_ACTIONS>[\s\S]*?<\/JARVIS_ACTIONS>/gi, '')
          .replace(/<JARVIS_MOOD>[\s\S]*?<\/JARVIS_MOOD>/gi, '')
          .replace(/<\/?JARVIS_REPLY>/gi, '')
          .trim();

        const rawActions = enrichedActionsFromServer || finalParsed.actions;
        const finalActions = maybeExtractSvgAction(
          params.prompt,
          finalParsed.reply || strippedFallback,
          rawActions
        );
        const cleanReply =
          sanitizeAssistantPlainText(
            finalParsed.reply || strippedFallback || finalParsed.speak
          ) || 'Mostrei tudo no palco.';
        const cleanSpeak = sanitizeAssistantPlainText(finalParsed.speak || cleanReply) || cleanReply;

        if (!speakEmitted && cleanSpeak) {
          callbacks?.onSpeakReady?.(cleanSpeak);
        }

        return {
          reply: cleanReply,
          voiceSummary: cleanSpeak,
          mood: finalParsed.mood || 'speaking',
          actions: finalActions,
          modelUsed,
        };
      }

      if (streamError) {
        // Fallback para endpoint JSON padrão antes de desistir
      }
    }
  } catch {
    // fallback para /api/jarvis padrão abaixo
  }

  return askJarvisAssistantFallbackJson(requestBody, headers, params.prompt, callbacks);
}

async function askJarvisAssistantFallbackJson(
  requestBody: string,
  headers: Record<string, string>,
  prompt: string,
  callbacks?: JarvisStreamCallbacks
): Promise<JarvisAssistantResponse> {
  try {
    const resp = await fetch('/api/jarvis', {
      method: 'POST',
      headers,
      body: requestBody,
    });
    if (resp.ok) {
      const data = (await resp.json()) as JarvisAssistantResponse;
      if (data && typeof data.reply === 'string') {
        const extractedActions = maybeExtractSvgAction(
          prompt,
          data.reply,
          (data.actions || []).map(normalizeJarvisAction)
        );
        const cleanReply = sanitizeAssistantPlainText(data.reply) || 'Feito.';
        const spoken =
          sanitizeAssistantPlainText(data.voiceSummary || cleanReply) || cleanReply;
        callbacks?.onSpeakReady?.(spoken);
        return {
          ...data,
          reply: cleanReply,
          voiceSummary: spoken,
          actions: extractedActions,
        };
      }
    }
  } catch {
    // offline or API unreachable
  }

  const honestUnavailable =
    'Não consegui ligar-me ao motor neural neste momento. Verifica a tua ligação à internet ou a chave API e tenta novamente.';
  callbacks?.onSpeakReady?.('Não consegui responder agora porque falhou a ligação ao motor.');
  return {
    reply: honestUnavailable,
    voiceSummary: 'Não consegui responder agora porque falhou a ligação.',
    mood: 'idle',
    actions: [],
  };
}

export async function askJarvisAssistant(params: {
  prompt: string;
  history: JarvisConversationEntry[];
  memory: JarvisMemoryState;
  agenda: JarvisAgendaItem[];
  tasks: JarvisTaskItem[];
  alarms: JarvisAlarmItem[];
  weather?: JarvisWeatherInfo | null;
  telemetry?: JarvisSystemTelemetry | null;
  mediaState?: JarvisMediaStateContext | null;
  documentAttachment?: JarvisDocumentItem | null;
  activeDocument?: JarvisDocumentItem | null;
  builderContext?: { activeProjectName?: string; activeProjectFiles?: string[] } | null;
}): Promise<JarvisAssistantResponse> {
  return askJarvisAssistantStream(params);
}

export async function searchYouTubeTrack(
  query: string,
  kind: 'music' | 'video' = 'music'
): Promise<JarvisTrack | null> {
  const clean = query.trim();
  if (!clean) return null;
  try {
    const resp = await fetch('/api/jarvis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'youtube_search', query: clean, kind }),
    });
    if (resp.ok) {
      const json = await resp.json();
      if (json?.track?.videoId) {
        return {
          ...(json.track as JarvisTrack),
          watchUrl:
            json.track.watchUrl || `https://www.youtube.com/watch?v=${json.track.videoId}`,
          source: 'youtube',
        };
      }
    }
  } catch {
    // sem fallback fictício
  }
  return null;
}

function mapWeatherCodeToCondition(code: number, isDay?: boolean): string {
  if (code === 0) return isDay === false ? 'Noite limpa em Inhambane' : 'Sol limpo';
  if (code === 1) return isDay === false ? 'Céu pouco nublado' : 'Predomínio de sol';
  if (code <= 3) return 'Parcialmente nublado';
  if (code <= 48) return 'Neblina costeira';
  if (code <= 57) return 'Chuvisco ligeiro';
  if (code <= 67) return 'Chuva moderada';
  if (code <= 77) return 'Granizo';
  if (code <= 82) return 'Aguaceiros fortes';
  return 'Trovoada';
}

async function reverseGeocodeCityName(lat: number, lon: number): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(
        4
      )}&longitude=${lon.toFixed(4)}&localityLanguage=pt`
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const cityPart = data?.city || data?.locality || '';
    const subPart = data?.principalSubdivision || '';
    const countryPart = data?.countryName || '';
    const joined = [cityPart, subPart, countryPart].filter(Boolean).join(', ');
    if (!joined || /\b(luanda|angola|matola)\b/i.test(joined)) return null;
    return joined;
  } catch {
    return null;
  }
}

export async function fetchLiveWeather(forceRefresh = false): Promise<JarvisWeatherInfo> {
  const cached = safeReadJson<{ ts: number; data: JarvisWeatherInfo } | null>(
    JARVIS_STORAGE_KEYS.weather,
    null
  );
  const cacheIsValidLocation =
    cached?.data?.city && !/\b(luanda|angola|matola)\b/i.test(cached.data.city);

  if (!forceRefresh && cached && cacheIsValidLocation && Date.now() - cached.ts < 10 * 60 * 1000) {
    return cached.data;
  }

  let lat = INHAMBANE_DEFAULT.lat;
  let lon = INHAMBANE_DEFAULT.lon;
  let city = INHAMBANE_DEFAULT.city;

  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 2800,
          maximumAge: 5 * 60 * 1000,
          enableHighAccuracy: false,
        });
      });
      const gLat = pos.coords.latitude;
      const gLon = pos.coords.longitude;
      if (Number.isFinite(gLat) && Number.isFinite(gLon)) {
        lat = gLat;
        lon = gLon;
        const resolvedName = await reverseGeocodeCityName(gLat, gLon);
        if (resolvedName) {
          city = resolvedName;
        }
      }
    } catch {
      // Permissão negada ou indisponível -> fallback fixo: Inhambane Cidade, Inhambane, Moçambique
    }
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(
      4
    )}&longitude=${lon.toFixed(
      4
    )}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day&timezone=auto`;
    const resp = await fetch(url);
    if (resp.ok) {
      const json = await resp.json();
      const curr = json?.current;
      if (curr && typeof curr.temperature_2m === 'number') {
        const isDay = curr.is_day !== 0;
        const info: JarvisWeatherInfo = {
          tempC: Math.round(Number(curr.temperature_2m)),
          feelsLikeC:
            typeof curr.apparent_temperature === 'number'
              ? Math.round(Number(curr.apparent_temperature))
              : Math.round(Number(curr.temperature_2m)),
          humidityPct:
            typeof curr.relative_humidity_2m === 'number'
              ? Math.round(Number(curr.relative_humidity_2m))
              : null,
          windKmh:
            typeof curr.wind_speed_10m === 'number'
              ? Math.round(Number(curr.wind_speed_10m))
              : null,
          condition: mapWeatherCodeToCondition(Number(curr.weather_code ?? 0), isDay),
          city,
          isDay,
          loadedFromApi: true,
          updatedAt: new Date().toISOString(),
        };
        safeWriteJson(JARVIS_STORAGE_KEYS.weather, { ts: Date.now(), data: info });
        return info;
      }
    }
  } catch {
    // Sem rede ou erro na Open-Meteo
  }

  if (cached && cacheIsValidLocation && Date.now() - cached.ts < 30 * 60 * 1000) {
    return cached.data;
  }

  return {
    tempC: null,
    feelsLikeC: null,
    humidityPct: null,
    windKmh: null,
    condition: 'Clima indisponível',
    city,
    loadedFromApi: false,
    errorMsg: 'Não consegui buscar o clima real agora',
  };
}

export function readSyncSystemTelemetry(batteryInfo?: {
  pct: number | null;
  charging: boolean | null;
}): JarvisSystemTelemetry {
  if (typeof navigator === 'undefined') {
    return {
      cpuCores: null,
      deviceMemoryGb: null,
      jsHeapUsedMb: null,
      jsHeapLimitMb: null,
      batteryPct: null,
      batteryCharging: null,
      online: true,
      networkType: null,
      downlinkMbps: null,
      rttMs: null,
      timezone: 'Africa/Maputo',
    };
  }

  const navAny = navigator as any;
  const perfMem = typeof performance !== 'undefined' ? (performance as any)?.memory : null;
  const conn = navAny?.connection || navAny?.mozConnection || navAny?.webkitConnection;

  return {
    cpuCores: typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null,
    deviceMemoryGb: typeof navAny.deviceMemory === 'number' ? navAny.deviceMemory : null,
    jsHeapUsedMb:
      perfMem?.usedJSHeapSize ? Math.round(perfMem.usedJSHeapSize / (1024 * 1024)) : null,
    jsHeapLimitMb:
      perfMem?.jsHeapSizeLimit ? Math.round(perfMem.jsHeapSizeLimit / (1024 * 1024)) : null,
    batteryPct: batteryInfo?.pct ?? null,
    batteryCharging: batteryInfo?.charging ?? null,
    online: navigator.onLine,
    networkType: conn?.effectiveType ? String(conn.effectiveType).toUpperCase() : null,
    downlinkMbps: typeof conn?.downlink === 'number' ? Number(conn.downlink.toFixed(1)) : null,
    rttMs: typeof conn?.rtt === 'number' ? conn.rtt : null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Maputo',
  };
}

export async function readDocumentFile(file: File): Promise<JarvisDocumentItem> {
  const mime = file.type || '';
  const isBinaryMedia =
    mime === 'application/pdf' ||
    mime.startsWith('image/') ||
    /\.(pdf|png|jpg|jpeg|webp)$/i.test(file.name);

  if (isBinaryMedia) {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Erro ao ler ficheiro.'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
    const previewBlobUrl = typeof URL !== 'undefined' ? URL.createObjectURL(file) : undefined;
    return {
      id: `doc_${Date.now()}`,
      name: file.name,
      mimeType:
        mime ||
        (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      size: file.size,
      uploadedAt: new Date().toISOString(),
      base64Data,
      previewBlobUrl,
    };
  }

  const textContent = await file.text();
  return {
    id: `doc_${Date.now()}`,
    name: file.name,
    mimeType: mime || 'text/plain',
    size: file.size,
    uploadedAt: new Date().toISOString(),
    textContent: textContent.slice(0, 35000),
  };
}

export function playJarvisAlarmSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const pattern = [880, 1174.66, 880, 1318.51];
    pattern.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = ctx.currentTime + idx * 0.16;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.28);
    });
  } catch {
    // ignore audio restrictions
  }
}
