import type {
  JarvisActionPayload,
  JarvisAgendaItem,
  JarvisAlarmItem,
  JarvisAssistantResponse,
  JarvisConversationEntry,
  JarvisDocumentItem,
  JarvisMemoryState,
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

export const DEFAULT_JARVIS_MEMORY: JarvisMemoryState = {
  userName: 'Eletro-Jr',
  preferences: ['Interface HUD Stark Azul Elétrico e Vermelho Neon', 'Comunicação rápida e natural por voz'],
  facts: ['Fundador e arquiteto principal na plataforma SARA BIULDER'],
};

export const DEFAULT_JARVIS_TRACKS: JarvisTrack[] = [
  {
    id: 'synth_stark_pulse',
    title: 'Stark Core Ambient Focus',
    artist: 'SARA Audio Engine',
    source: 'synth',
    durationSec: 240,
  },
  {
    id: 'yt_lofi_study',
    title: 'Lofi Hip Hop Radio — Beats to Code / Study',
    artist: 'Lofi Girl',
    videoId: 'jfKfPfyJRdk',
    thumbnailUrl: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    source: 'youtube',
  },
  {
    id: 'synth_neon_drive',
    title: 'Electric Horizon Synthwave',
    artist: 'SARA Audio Engine',
    source: 'synth',
    durationSec: 210,
  },
];

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
  const today = new Date().toISOString().slice(0, 10);
  const defaultAgenda: JarvisAgendaItem[] = [
    {
      id: 'ag_welcome',
      title: 'Revisão diária de arquitetura & ideias',
      date: today,
      time: '15:00',
      notes: 'Sessão estratégica com a SARA JARVIS',
      completed: false,
      createdAt: new Date().toISOString(),
    },
  ];
  const defaultTasks: JarvisTaskItem[] = [
    {
      id: 'tsk_1',
      title: 'Explorar módulos de Voz, Agenda e Documentos da SARA JARVIS',
      priority: 'media',
      done: false,
      createdAt: new Date().toISOString(),
    },
  ];

  return {
    agenda: safeReadJson<JarvisAgendaItem[]>(JARVIS_STORAGE_KEYS.agenda, defaultAgenda),
    alarms: safeReadJson<JarvisAlarmItem[]>(JARVIS_STORAGE_KEYS.alarms, []),
    tasks: safeReadJson<JarvisTaskItem[]>(JARVIS_STORAGE_KEYS.tasks, defaultTasks),
    memory: safeReadJson<JarvisMemoryState>(JARVIS_STORAGE_KEYS.memory, DEFAULT_JARVIS_MEMORY),
    documents: safeReadJson<JarvisDocumentItem[]>(JARVIS_STORAGE_KEYS.docs, []),
    conversation: safeReadJson<JarvisConversationEntry[]>(JARVIS_STORAGE_KEYS.chat, []),
    playlist: safeReadJson<JarvisTrack[]>(JARVIS_STORAGE_KEYS.playlist, DEFAULT_JARVIS_TRACKS),
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

function buildLocalJarvisFallback(prompt: string): JarvisAssistantResponse {
  const clean = prompt.trim();
  const lower = clean
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const actions: JarvisActionPayload[] = [];

  if (/\b(modo foco|ativa foco|silencio total|foco total)\b/i.test(lower)) {
    actions.push({ type: 'toggle_focus', enabled: true });
    return {
      reply: 'Modo Foco ativado, Eletro-Jr. Limpei as distrações laterais e mantive apenas o palco principal.',
      voiceSummary: 'Modo foco ligado, Eletro-Júnior. Tudo limpo para te concentrares.',
      mood: 'focus',
      actions,
    };
  }

  if (/\b(sai do foco|desativa foco|modo normal)\b/i.test(lower)) {
    actions.push({ type: 'toggle_focus', enabled: false });
    return {
      reply: 'Saí do Modo Foco e restaurei todos os módulos HUD no painel, Eletro-Jr.',
      voiceSummary: 'Módulos principais restaurados, Eletro-Júnior.',
      mood: 'idle',
      actions,
    };
  }

  const alarmMatch = lower.match(/\b(acorda|alarme|despertador|lembra).*?(\d{1,2})\s*(?:h|:)\s*(\d{0,2})/i);
  if (alarmMatch) {
    const hh = alarmMatch[2].padStart(2, '0');
    const mm = (alarmMatch[3] || '00').padStart(2, '0');
    const time = `${hh}:${mm}`;
    actions.push({ type: 'add_alarm', time, label: clean });
    return {
      reply: `Alarme definido para as **${time}**, Eletro-Jr. Vou tocar o sinal e avisar-te por voz na hora certa.`,
      voiceSummary: `Alarme marcado para as ${hh} horas e ${mm} minutos, Eletro-Júnior.`,
      mood: 'happy',
      actions,
    };
  }

  const musicMatch = clean.match(/\b(?:coloca|toca|mete|ouvir|play)\s+(?:a\s+m[uú]sica\s+)?(.+)/i);
  if (musicMatch && musicMatch[1]) {
    const query = musicMatch[1].trim();
    actions.push({ type: 'play_music', query, title: query });
    return {
      reply: `A preparar e reproduzir **${query}** no palco principal, Eletro-Jr.`,
      voiceSummary: `A colocar ${query} agora no palco, Eletro-Júnior.`,
      mood: 'happy',
      actions,
    };
  }

  if (/\b(horas|que horas|data|hoje)\b/i.test(lower)) {
    const now = new Date();
    const hStr = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const dStr = now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
    return {
      reply: `Agora são **${hStr}** (${dStr}), Eletro-Jr.`,
      voiceSummary: `Agora são ${hStr}, ${dStr}, Eletro-Júnior.`,
      mood: 'speaking',
      actions: [],
    };
  }

  return {
    reply: `Recebi o teu pedido ("${clean}"), Eletro-Jr. Estou a operar em modo local rápido enquanto restabeleço a ligação ao motor neural — queres agendar uma tarefa, tocar música ou criar algo no Builder?`,
    voiceSummary: 'Estou contigo em modo local rápido, Eletro-Júnior. Em que posso avançar agora?',
    mood: 'speaking',
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
  documentAttachment?: JarvisDocumentItem | null;
  activeDocument?: JarvisDocumentItem | null;
}): Promise<JarvisAssistantResponse> {
  const apiKey = getSavedGeminiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-gemini-api-key'] = apiKey;

  try {
    const resp = await fetch('/api/jarvis', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: params.prompt,
        history: params.history.slice(-10),
        memory: params.memory,
        agenda: params.agenda,
        tasks: params.tasks,
        alarms: params.alarms,
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
      }),
    });

    if (!resp.ok) {
      return buildLocalJarvisFallback(params.prompt);
    }
    const data = (await resp.json()) as JarvisAssistantResponse;
    if (!data || typeof data.reply !== 'string') {
      return buildLocalJarvisFallback(params.prompt);
    }
    return data;
  } catch {
    return buildLocalJarvisFallback(params.prompt);
  }
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

export async function searchYouTubeTrack(query: string): Promise<JarvisTrack> {
  const clean = query.trim() || 'Stark Tech Ambient';
  try {
    const resp = await fetch('/api/jarvis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'youtube_search', query: clean }),
    });
    if (resp.ok) {
      const json = await resp.json();
      if (json?.track?.videoId) {
        return json.track as JarvisTrack;
      }
    }
  } catch {
    // fallback silencioso
  }

  return {
    id: `synth_${Date.now()}`,
    title: clean,
    artist: 'SARA Audio Engine',
    source: 'synth',
    durationSec: 210,
  };
}

function mapWeatherCodeToCondition(code: number): string {
  if (code === 0) return 'Céu limpo';
  if (code <= 3) return 'Parcialmente nublado';
  if (code <= 48) return 'Neblina';
  if (code <= 67) return 'Chuva ligeira';
  if (code <= 77) return 'Neve / Granizo';
  if (code <= 82) return 'Aguaceiros';
  return 'Trovoada';
}

export async function fetchLiveWeather(): Promise<JarvisWeatherInfo> {
  const cached = safeReadJson<{ ts: number; data: JarvisWeatherInfo } | null>(
    JARVIS_STORAGE_KEYS.weather,
    null
  );
  if (cached && Date.now() - cached.ts < 15 * 60 * 1000) {
    return cached.data;
  }

  let lat = -8.8383;
  let lon = 13.2344;
  let city = 'Luanda';

  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 2200 });
      });
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
      city = 'Local Atual';
    } catch {
      // Usa Luanda como fallback limpo
    }
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(
      3
    )}&current=temperature_2m,weather_code,wind_speed_10m`;
    const resp = await fetch(url);
    if (resp.ok) {
      const json = await resp.json();
      const info: JarvisWeatherInfo = {
        tempC: Math.round(Number(json?.current?.temperature_2m ?? 26)),
        condition: mapWeatherCodeToCondition(Number(json?.current?.weather_code ?? 1)),
        city,
        windKmh: Math.round(Number(json?.current?.wind_speed_10m ?? 12)),
      };
      safeWriteJson(JARVIS_STORAGE_KEYS.weather, { ts: Date.now(), data: info });
      return info;
    }
  } catch {
    // offline fallback
  }

  return (
    cached?.data || {
      tempC: 26,
      condition: 'Estável',
      city,
      windKmh: 12,
    }
  );
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
