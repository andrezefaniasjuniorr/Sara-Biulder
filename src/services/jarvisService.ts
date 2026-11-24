import type {
  JarvisActionPayload,
  JarvisAgendaItem,
  JarvisAlarmItem,
  JarvisAssistantResponse,
  JarvisBuilderContext,
  JarvisConversationEntry,
  JarvisDocumentItem,
  JarvisHeadMood,
  JarvisHudLiveFeed,
  JarvisMediaStateContext,
  JarvisMemoryState,
  JarvisModuleTab,
  JarvisSystemTelemetry,
  JarvisTaskItem,
  JarvisTrack,
  JarvisWeatherInfo,
} from '../types/jarvis';
import { getSavedGeminiKey } from './saraAiService';
import type { SaraUserIdentityPayload } from '../types/auth';
import { sanitizeNonOwnerAiReply } from './authService';
import { normalizePhoneticVoiceTranscript } from '../utils/voiceService';
import { getMaputoNowParts, resolvePortugueseDate } from '../utils/timeAgendaService';

const JARVIS_STORAGE_KEYS = {
  agenda: 'sara_jarvis_agenda_v1',
  alarms: 'sara_jarvis_alarms_v1',
  tasks: 'sara_jarvis_tasks_v1',
  memory: 'sara_jarvis_memory_v1',
  docs: 'sara_jarvis_docs_v1',
  chat: 'sara_jarvis_chat_v1',
  playlist: 'sara_jarvis_playlist_v1',
  weather: 'sara_jarvis_weather_v1',
  hudFeed: 'sara_jarvis_hud_feed_v1',
};

function scopedJarvisKey(baseKey: string, userId?: string): string {
  return userId ? `${baseKey}_${userId}` : baseKey;
}

const INHAMBANE_DEFAULT = {
  lat: -23.865,
  lon: 35.3833,
  city: 'Inhambane Cidade, Inhambane, Moçambique',
};

const LEGACY_MOCK_AGENDA_IDS = new Set(['ag_welcome']);
const LEGACY_MOCK_TASK_IDS = new Set(['tsk_1']);
const LEGACY_MOCK_TRACK_IDS = new Set(['synth_stark_pulse', 'yt_lofi_study', 'synth_neon_drive']);

export const DEFAULT_JARVIS_MEMORY: JarvisMemoryState = {
  userName: 'Utilizador',
  preferences: ['Inhambane Cidade, Inhambane, Moçambique'],
  facts: ['Localização base: Inhambane Cidade, Inhambane, Moçambique'],
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

function safeWriteJson(key: string, value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    const readBack = localStorage.getItem(key);
    return readBack === serialized;
  } catch {
    return false;
  }
}

const OWNER_DEFAULT_PREFS = [
  'Amapiano, Afro House, Marrabenta, Kizomba',
  'Inhambane Cidade, Inhambane, Moçambique',
  'Estúdio SARA em 2.º plano automático para pedidos de site/app',
];

const OWNER_DEFAULT_FACTS = [
  'Criador e Dono: Eletro-Jr (Eletro-Júnior), 24 anos',
  'Área técnica: estudante de Eletricidade Industrial no IICEM',
  'Localização: Inhambane Cidade / Matola, Moçambique',
  'Estilo de comunicação: português moçambicano com gírias locais (Inhambane)',
  'Preferência de música (quando não especifica): Amapiano / Afro House / Marrabenta / Kizomba',
  'Preferências de fluxo: "faz um site" -> Estúdio 2.º plano | "explica" -> voz completa + preview | "calcula" -> passo a passo',
];

export function loadJarvisLocalBundle(
  userId?: string,
  callName?: string,
  isGuest = false,
  isOwner = false
) {
  const defaultMemory: JarvisMemoryState = isOwner && !isGuest
    ? {
        userName: callName || 'Eletro-Júnior',
        preferences: OWNER_DEFAULT_PREFS,
        facts: OWNER_DEFAULT_FACTS,
        likedTracks: [],
        smartDevices: {
          luz: false,
          ventoinha: false,
          ac: false,
          porta: 'trancada',
          tomada: true,
        },
        lastDomain: 'general',
      }
    : {
        userName: callName || DEFAULT_JARVIS_MEMORY.userName,
        preferences: ['Inhambane Cidade, Inhambane, Moçambique'],
        facts: ['Localização base: Inhambane Cidade, Inhambane, Moçambique'],
        likedTracks: [],
        smartDevices: {
          luz: false,
          ventoinha: false,
          ac: false,
          porta: 'trancada',
          tomada: true,
        },
        lastDomain: 'general',
      };

  if (isGuest || (userId && userId.startsWith('guest_'))) {
    return {
      agenda: [] as JarvisAgendaItem[],
      alarms: [] as JarvisAlarmItem[],
      tasks: [] as JarvisTaskItem[],
      memory: defaultMemory,
      documents: [] as JarvisDocumentItem[],
      conversation: [] as JarvisConversationEntry[],
      playlist: [] as JarvisTrack[],
    };
  }

  const rawAgenda = safeReadJson<JarvisAgendaItem[]>(scopedJarvisKey(JARVIS_STORAGE_KEYS.agenda, userId), []);
  const agenda = Array.isArray(rawAgenda)
    ? rawAgenda.filter((item) => item && !LEGACY_MOCK_AGENDA_IDS.has(item.id))
    : [];

  const rawTasks = safeReadJson<JarvisTaskItem[]>(scopedJarvisKey(JARVIS_STORAGE_KEYS.tasks, userId), []);
  const tasks = Array.isArray(rawTasks)
    ? rawTasks.filter((item) => item && !LEGACY_MOCK_TASK_IDS.has(item.id))
    : [];

  const rawPlaylist = safeReadJson<JarvisTrack[]>(scopedJarvisKey(JARVIS_STORAGE_KEYS.playlist, userId), []);
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

  const rawMem = safeReadJson<JarvisMemoryState>(
    scopedJarvisKey(JARVIS_STORAGE_KEYS.memory, userId),
    defaultMemory
  );
  const cleanedFacts = (rawMem?.facts || []).filter((f) =>
    isOwner ? !/\b(luanda|angola)\b/i.test(f) : !/\b(luanda|angola|matola|iicem|24 anos)\b/i.test(f)
  );
  const mergedOwnerFacts =
    isOwner && !isGuest
      ? Array.from(new Set([...OWNER_DEFAULT_FACTS, ...cleanedFacts])).slice(-25)
      : cleanedFacts.length > 0
      ? cleanedFacts
      : defaultMemory.facts;

  const memory: JarvisMemoryState = {
    userName: callName || rawMem?.userName || defaultMemory.userName,
    preferences:
      rawMem?.preferences && rawMem.preferences.length > 0
        ? rawMem.preferences
        : defaultMemory.preferences,
    facts: mergedOwnerFacts,
    lastRoutineGreetingDate: rawMem?.lastRoutineGreetingDate,
    lastVisitDate: rawMem?.lastVisitDate,
    lastActiveProjectName: rawMem?.lastActiveProjectName,
    lastTopic: rawMem?.lastTopic,
    likedTracks: Array.isArray(rawMem?.likedTracks) ? rawMem.likedTracks : [],
    smartDevices: rawMem?.smartDevices || defaultMemory.smartDevices,
    lastDomain: rawMem?.lastDomain || 'general',
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
    alarms: safeReadJson<JarvisAlarmItem[]>(scopedJarvisKey(JARVIS_STORAGE_KEYS.alarms, userId), []),
    tasks,
    memory,
    documents: safeReadJson<JarvisDocumentItem[]>(scopedJarvisKey(JARVIS_STORAGE_KEYS.docs, userId), []),
    conversation: safeReadJson<JarvisConversationEntry[]>(scopedJarvisKey(JARVIS_STORAGE_KEYS.chat, userId), []),
    playlist,
  };
}

export function saveJarvisAgenda(items: JarvisAgendaItem[], userId?: string, isGuest = false): boolean {
  if (isGuest || userId?.startsWith('guest_')) return true;
  return safeWriteJson(scopedJarvisKey(JARVIS_STORAGE_KEYS.agenda, userId), items);
}

export function saveJarvisAlarms(items: JarvisAlarmItem[], userId?: string, isGuest = false) {
  if (isGuest || userId?.startsWith('guest_')) return;
  safeWriteJson(scopedJarvisKey(JARVIS_STORAGE_KEYS.alarms, userId), items);
}

export function saveJarvisTasks(items: JarvisTaskItem[], userId?: string, isGuest = false) {
  if (isGuest || userId?.startsWith('guest_')) return;
  safeWriteJson(scopedJarvisKey(JARVIS_STORAGE_KEYS.tasks, userId), items);
}

export function saveJarvisMemory(memory: JarvisMemoryState, userId?: string, isGuest = false) {
  if (isGuest || userId?.startsWith('guest_')) return;
  safeWriteJson(scopedJarvisKey(JARVIS_STORAGE_KEYS.memory, userId), memory);
}

export function saveJarvisDocuments(docs: JarvisDocumentItem[], userId?: string, isGuest = false) {
  if (isGuest || userId?.startsWith('guest_')) return;
  const compact = docs.slice(0, 20).map((d) => ({
    ...d,
    base64Data: undefined,
    previewBlobUrl: undefined,
    textContent: d.textContent ? d.textContent.slice(0, 6000) : undefined,
  }));
  safeWriteJson(scopedJarvisKey(JARVIS_STORAGE_KEYS.docs, userId), compact);
}

export function saveJarvisConversation(entries: JarvisConversationEntry[], userId?: string, isGuest = false) {
  if (isGuest || userId?.startsWith('guest_')) return;
  safeWriteJson(scopedJarvisKey(JARVIS_STORAGE_KEYS.chat, userId), entries.slice(-40));
}

export function saveJarvisPlaylist(tracks: JarvisTrack[], userId?: string, isGuest = false) {
  if (isGuest || userId?.startsWith('guest_')) return;
  safeWriteJson(scopedJarvisKey(JARVIS_STORAGE_KEYS.playlist, userId), tracks.slice(0, 25));
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
    .replace(/<\/?JARVIS_[A-Z_]+>/gi, ' ')
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
  if (normalized.type === 'add_agenda') {
    const rawDate = String(act?.date || '').trim();
    const resolved = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? { dateIso: rawDate }
      : resolvePortugueseDate(`${rawDate} ${act?.title || ''} ${act?.notes || ''}`);
    normalized.date = resolved.dateIso || getMaputoNowParts().isoDate;
    normalized.time = String(act?.time || '09:00').trim();
    normalized.title = String(act?.title || 'Compromisso').trim();
  }
  if (normalized.type === 'show_3d') {
    normalized.shape = (act?.shape || 'cube') as JarvisActionPayload['shape'];
    normalized.unit = act?.unit || 'cm';
    if (act?.dimensions && typeof act.dimensions === 'object') {
      const cleanDims: Record<string, number> = {};
      for (const [k, v] of Object.entries(act.dimensions)) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) cleanDims[k] = n;
      }
      normalized.dimensions = cleanDims;
    }
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
  if (normalized.type === 'build_in_builder') {
    normalized.goal = String(act?.goal || act?.title || '').trim();
  }
  return normalized;
}

/**
 * Deteta pedidos de construção completa (site, aplicativo, sistema, jogo, loja, portfólio)
 * que devem correr em segundo plano no Builder sem sair do Modo Assistente.
 */
export function isFullBuilderAppRequest(prompt: string): boolean {
  const normalized = normalizePhoneticVoiceTranscript(String(prompt || ''));
  const lower = normalized
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!lower) return false;

  // Pedidos rápidos próprios do palco Assistente ficam no Assistente (HTML planilha/CV, gráficos, 3D, explicações, quizzes)
  if (
    /\b(planilha|orcamento|curriculo|cv|fatura|recibo|carta|apresentacao|slides|teste|quiz|flashcards|grafico|cubo|esfera|cone|cilindro|piramide|prisma|octaedro|equacao|explica|resumo)\b/i.test(
      lower
    ) &&
    !/\b(sistema\s+de|plataforma\s+de|site\s+completo|aplicativo|ecommerce|loja\s+online)\b/i.test(lower)
  ) {
    return false;
  }

  // Se pede explicação/pergunta, não é build
  if (/^(sara[,\s]+)?(o\s+que\s+e|como\s+funciona|explica|me\s+explica|qual\s+e)\b/i.test(lower)) {
    return false;
  }

  return /\b(faz|fazer|cria|criar|constroi|construir|desenvolve|desenvolver|monta|montar|gera|gerar)\s+(um|uma)?\s*(novo\s+|nova\s+)?(site|website|web\s*site|pagina\s+web|landing\s*page|loja(\s+online|\s+virtual|\s+de\s+vendas)?|e-?commerce|site\s+de\s+vendas|aplicativo|app(\s+web|\s+mobile)?|aplicacao|sistema(\s+web|\s+de\s+\w+)?|plataforma|portal|portfolio|jogo|game|dashboard\s+completo)\b/i.test(
    lower
  );
}

export function buildQuickElectricalCalcStageAction(params: {
  voltage?: number;
  current?: number;
  resistance?: number;
  power?: number;
  reconstructed?: string;
}): {
  action: JarvisActionPayload;
  voiceReply: string;
  chatSummary: string;
} {
  let V = params.voltage;
  let I = params.current;
  let R = params.resistance;
  let P = params.power;

  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : Number(n.toFixed(2)).toString().replace('.', ','));

  if (V !== undefined && I !== undefined) {
    P = V * I;
    R = I > 0 ? V / I : undefined;
    const kw = P / 1000;
    const suggestedBreaker = I <= 10 ? 10 : I <= 16 ? 16 : I <= 20 ? 20 : I <= 25 ? 25 : I <= 32 ? 32 : I <= 40 ? 40 : 63;
    const suggestedCable = I <= 15 ? '1,5 mm²' : I <= 21 ? '2,5 mm²' : I <= 28 ? '4 mm²' : I <= 36 ? '6 mm²' : '10 mm²';

    return {
      action: {
        type: 'show_math',
        title: `Cálculo Elétrico: ${fmt(V)} V × ${fmt(I)} A`,
        problem: `Dados: Tensão V = ${fmt(V)} V e Corrente I = ${fmt(I)} A`,
        formulas: ['P = V \\cdot I', 'R = \\frac{V}{I}'],
        steps: [
          {
            step: '1. Potência Ativa (P)',
            expression: `P = ${V} \\cdot ${I} = ${Number(P.toFixed(2))}\\text{ W} = ${Number(kw.toFixed(2))}\\text{ kW}`,
            explanation: `Multiplicamos ${fmt(V)} volts por ${fmt(I)} amperes para obter ${fmt(P)} watts (${fmt(kw)} kW).`,
          },
          ...(R !== undefined
            ? [
                {
                  step: '2. Resistência Equivalente (Lei de Ohm)',
                  expression: `R = \\frac{${V}}{${I}} = ${Number(R.toFixed(2))}\\,\\Omega`,
                  explanation: `Pela Lei de Ohm, a resistência da carga é ${fmt(R)} ohms.`,
                },
              ]
            : []),
          {
            step: '3. Dimensionamento de Proteção Sugerido',
            expression: `\\text{Disjuntor } \\ge ${suggestedBreaker}\\text{ A} \\quad | \\quad \\text{Cabo } \\ge \\text{${suggestedCable}}`,
            explanation: `Referência prática para circuito monofásico em cobre (verificar distância e queda de tensão).`,
          },
        ],
        finalAnswer: `P = ${fmt(P)}\\text{ W} (${fmt(kw)}\\text{ kW}) \\quad | \\quad R = ${R !== undefined ? fmt(R) : '--'}\\,\\Omega`,
        notes: `Calculado com base na Lei de Ohm e Potência Elétrica. ${params.reconstructed || ''}`.trim(),
      },
      voiceReply: `${fmt(V)} volts vezes ${fmt(I)} amperes dá ${fmt(P)} watts, ou ${fmt(kw)} quilowatts, com resistência de ${R !== undefined ? fmt(R) : 'zero'} ohms. Já deixei os passos no preview.`,
      chatSummary: `Cálculo elétrico: ${fmt(V)}V × ${fmt(I)}A = ${fmt(P)}W (${fmt(kw)}kW).`,
    };
  }

  if (V !== undefined && R !== undefined && R > 0) {
    I = V / R;
    P = V * I;
    return {
      action: {
        type: 'show_math',
        title: `Lei de Ohm: ${fmt(V)} V / ${fmt(R)} Ω`,
        problem: `Dados: Tensão V = ${fmt(V)} V e Resistência R = ${fmt(R)} Ω`,
        formulas: ['I = \\frac{V}{R}', 'P = V \\cdot I'],
        steps: [
          {
            step: '1. Corrente Elétrica (I)',
            expression: `I = \\frac{${V}}{${R}} = ${Number(I.toFixed(2))}\\text{ A}`,
            explanation: `Dividimos a tensão pela resistência para achar ${fmt(I)} amperes.`,
          },
          {
            step: '2. Potência Dissipada (P)',
            expression: `P = ${V} \\cdot ${Number(I.toFixed(2))} = ${Number(P.toFixed(2))}\\text{ W}`,
            explanation: `A carga consome ${fmt(P)} watts.`,
          },
        ],
        finalAnswer: `I = ${fmt(I)}\\text{ A} \\quad | \\quad P = ${fmt(P)}\\text{ W}`,
      },
      voiceReply: `Com ${fmt(V)} volts e ${fmt(R)} ohms, a corrente é ${fmt(I)} amperes e a potência dá ${fmt(P)} watts.`,
      chatSummary: `Lei de Ohm: ${fmt(V)}V / ${fmt(R)}Ω = ${fmt(I)}A (${fmt(P)}W).`,
    };
  }

  if (P !== undefined && V !== undefined && V > 0) {
    I = P / V;
    R = I > 0 ? V / I : undefined;
    return {
      action: {
        type: 'show_math',
        title: `Corrente Elétrica: ${fmt(P)} W em ${fmt(V)} V`,
        problem: `Dados: Potência P = ${fmt(P)} W e Tensão V = ${fmt(V)} V`,
        formulas: ['I = \\frac{P}{V}', 'R = \\frac{V}{I}'],
        steps: [
          {
            step: '1. Corrente (I)',
            expression: `I = \\frac{${P}}{${V}} = ${Number(I.toFixed(2))}\\text{ A}`,
            explanation: `Dividindo a potência pela tensão obtemos ${fmt(I)} amperes.`,
          },
          ...(R !== undefined
            ? [
                {
                  step: '2. Resistência (R)',
                  expression: `R = \\frac{${V}}{${Number(I.toFixed(2))}} = ${Number(R.toFixed(2))}\\,\\Omega`,
                  explanation: `Impedância equivalente aproximada.`,
                },
              ]
            : []),
        ],
        finalAnswer: `I = ${fmt(I)}\\text{ A}`,
      },
      voiceReply: `${fmt(P)} watts a ${fmt(V)} volts puxa ${fmt(I)} amperes.`,
      chatSummary: `Corrente: ${fmt(P)}W / ${fmt(V)}V = ${fmt(I)}A.`,
    };
  }

  return {
    action: {
      type: 'show_math',
      title: 'Lei de Ohm e Potência Elétrica',
      formulas: ['V = R \\cdot I', 'P = V \\cdot I'],
      steps: [],
      finalAnswer: 'P = V \\cdot I',
    },
    voiceReply: 'Qual é a tensão e a corrente para eu calcular?',
    chatSummary: 'Fórmulas elétricas no preview.',
  };
}

function detect3DShapeIntent(text: string): JarvisActionPayload['shape'] | null {
  const s = String(text || '').toLowerCase();
  if (/\b(carro|viatura|autom[oó]vel|ve[ií]culo|desportivo|carrinha)\b/.test(s)) return 'car';
  if (/\b(mol[eé]cula|h2o|co2|ch4|[aá]gua qu[ií]mica)\b/.test(s)) return 'molecule';
  if (/\b(vetores?|for[çc]as? 3d|resultante 3d)\b/.test(s)) return 'vectors';
  if (/\b(gr[aá]fico 3d|barras 3d|colunas 3d)\b/.test(s)) return 'chart3d';
  if (/\b(plano cartesiano|eixos 3d|coordenadas 3d|cartesiano 3d)\b/.test(s)) return 'cartesian';
  if (/\b(cubo|hexaedro)\b/.test(s)) return 'cube';
  if (/\b(paralelep[ií]pedo|bloco retangular)\b/.test(s)) return 'cuboid';
  if (/\b(esfera|globo)\b/.test(s)) return 'sphere';
  if (/\b(cilindro)\b/.test(s)) return 'cylinder';
  if (/\b(cone)\b/.test(s)) return 'cone';
  if (/\b(pir[aâ]mide)\b/.test(s)) return 'pyramid';
  if (/\b(prisma)\b/.test(s)) return 'prism';
  if (/\b(octaedro)\b/.test(s)) return 'octahedron';
  if (/\b(toro)\b/.test(s)) return 'torus';
  if (/\b([aá]tomo)\b/.test(s)) return 'atom';
  return null;
}

function buildAuto3DAction(
  shape: NonNullable<JarvisActionPayload['shape']>,
  prompt: string,
  baseAct?: Partial<JarvisActionPayload>
): JarvisActionPayload {
  const numMatch = prompt.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|dm|m|km)?/i);
  const sideVal =
    baseAct?.dimensions?.lado ??
    baseAct?.dimensions?.a ??
    baseAct?.dimensions?.raio ??
    (numMatch ? Number(numMatch[1].replace(',', '.')) : 5);
  const safeVal = Number.isFinite(sideVal) && sideVal > 0 ? sideVal : 5;
  const unit = baseAct?.unit || numMatch?.[2] || 'cm';

  let formulas = baseAct?.formulas;
  let steps = baseAct?.steps;
  let finalAnswer = baseAct?.finalAnswer;
  let dimensions = baseAct?.dimensions;
  let simpleExplanation = baseAct?.simpleExplanation;
  let studyTip = baseAct?.studyTip;

  if (shape === 'cube' && (!formulas || !formulas.length)) {
    const a = safeVal;
    const areaTotal = Number((6 * a * a).toFixed(2));
    const volume = Number((a * a * a).toFixed(2));
    const perimetroArestas = Number((12 * a).toFixed(2));
    dimensions = dimensions || { lado: a };
    formulas = [
      'A_{total} = 6 \\cdot a^2',
      'V = a^3',
    ];
    steps = [
      {
        step: 'Passo 1 — Área Total das 6 faces',
        expression: `A_{total} = 6 \\cdot ${a}^2 = 6 \\cdot ${Number((a * a).toFixed(2))}`,
        partialResult: `${areaTotal}\\text{ ${unit}}^2`,
        explanation: `Cada face quadrada mede ${a} × ${a} ${unit}, logo 6 faces somam ${areaTotal} ${unit}².`,
      },
      {
        step: 'Passo 2 — Volume do Cubo',
        expression: `V = ${a}^3 = ${a} \\cdot ${a} \\cdot ${a}`,
        partialResult: `${volume}\\text{ ${unit}}^3`,
        explanation: `Soma das 12 arestas: 12 × ${a} = ${perimetroArestas} ${unit}.`,
      },
    ];
    finalAnswer = `V = ${volume}\\text{ ${unit}}^3 \\quad | \\quad A_{total} = ${areaTotal}\\text{ ${unit}}^2`;
    simpleExplanation = `Um cubo tem 6 faces quadradas iguais de aresta ${a} ${unit}.`;
    studyTip = 'O volume cresce ao cubo: duplicar a aresta multiplica o volume por 8.';
  } else if (shape === 'sphere' && (!formulas || !formulas.length)) {
    const r = safeVal;
    const area = Number((4 * Math.PI * r * r).toFixed(2));
    const vol = Number(((4 / 3) * Math.PI * r * r * r).toFixed(2));
    dimensions = dimensions || { raio: r };
    formulas = ['A = 4\\pi r^2', 'V = \\frac{4}{3}\\pi r^3'];
    steps = [
      {
        step: 'Passo 1 — Área da Superfície',
        expression: `A = 4\\pi \\cdot ${r}^2`,
        partialResult: `${area}\\text{ ${unit}}^2`,
        explanation: `Substituímos o raio r = ${r} ${unit}.`,
      },
      {
        step: 'Passo 2 — Volume da Esfera',
        expression: `V = \\frac{4}{3}\\pi \\cdot ${r}^3`,
        partialResult: `${vol}\\text{ ${unit}}^3`,
        explanation: `Cálculo exato do volume tridimensional.`,
      },
    ];
    finalAnswer = `V \\approx ${vol}\\text{ ${unit}}^3 \\quad | \\quad A \\approx ${area}\\text{ ${unit}}^2`;
  } else if (shape === 'car') {
    dimensions = dimensions || { comprimento: 4.5, largura: 1.9, altura: 1.4 };
    simpleExplanation =
      simpleExplanation ||
      'Modelo 3D de veículo aerodinâmico composto por chassi metálico, cabine envidraçada, quatro rodas com jantes e iluminação LED.';
    studyTip = studyTip || 'Podes girar 360°, aproximar ou ativar as etiquetas das peças na barra inferior.';
  } else if (shape === 'molecule') {
    dimensions = dimensions || { angulo: 104.5 };
    simpleExplanation =
      simpleExplanation ||
      'Representação tridimensional da estrutura molecular mostrando os átomos ligados e os ângulos de ligação.';
  } else if (shape === 'vectors') {
    dimensions = dimensions || { vx: 3, vy: 2, vz: 2 };
    formulas = formulas || ['|\\vec{R}| = \\sqrt{V_x^2 + V_y^2 + V_z^2}'];
    finalAnswer =
      finalAnswer ||
      `|\\vec{R}| = \\sqrt{${dimensions.vx ?? 3}^2 + ${dimensions.vy ?? 2}^2 + ${dimensions.vz ?? 2}^2} \\approx ${Math.sqrt((dimensions.vx ?? 3) ** 2 + (dimensions.vy ?? 2) ** 2 + (dimensions.vz ?? 2) ** 2).toFixed(2)}`;
  } else if (!dimensions) {
    dimensions = shape === 'cylinder' || shape === 'cone' ? { raio: safeVal, altura: safeVal * 2 } : { lado: safeVal };
  }

  const shapeTitleMap: Record<string, string> = {
    car: 'Carro Desportivo 3D',
    molecule: 'Estrutura Molecular 3D',
    vectors: 'Vetores de Força no Espaço 3D',
    chart3d: 'Gráfico de Colunas 3D',
    cartesian: 'Plano Cartesiano 3D',
    cube: `Cubo 3D (${safeVal} ${unit})`,
    sphere: `Esfera 3D (${safeVal} ${unit})`,
  };

  return {
    type: 'show_3d',
    shape,
    title: baseAct?.title || shapeTitleMap[shape] || `Modelo 3D: ${prompt.slice(0, 42)}`,
    subtitle: baseAct?.subtitle || 'Arrasta para girar em 3D, aproxima e explora os eixos XYZ.',
    dimensions,
    unit: shape === 'car' ? 'm' : unit,
    simpleExplanation,
    studyTip,
    formulas,
    steps,
    finalAnswer,
    description: baseAct?.description,
    autoRotate: true,
  };
}

function maybeExtractVisualActions(
  prompt: string,
  reply: string,
  actions: JarvisActionPayload[]
): JarvisActionPayload[] {
  let list = [...actions];

  // 1) Se já existe show_3d, garante dimensões e cálculos preenchidos
  const idx3d = list.findIndex((a) => a.type === 'show_3d');
  if (idx3d !== -1) {
    const act = list[idx3d];
    list[idx3d] = buildAuto3DAction(act.shape || 'cube', prompt, act);
    return list;
  }

  // 2) Se o utilizador pediu desenho/figura 3D (cubo, esfera, cone, cilindro, pirâmide, etc.)
  //    e veio show_svg ou show_math (ou nenhum visual), promove para 3D interativo real mantendo fórmulas/passos!
  const requested3DShape = detect3DShapeIntent(prompt);
  const asksToDrawOrShow = /(desenh|mostr|faz|cria|calcul|volume|[aá]rea|figura|3d|no preview|preview)/i.test(prompt);
  if (requested3DShape && asksToDrawOrShow) {
    const existingSvgIdx = list.findIndex((a) => a.type === 'show_svg');
    const existingMathIdx = list.findIndex((a) => a.type === 'show_math');
    const carrier = existingSvgIdx !== -1 ? list[existingSvgIdx] : existingMathIdx !== -1 ? list[existingMathIdx] : undefined;
    const upgraded = buildAuto3DAction(requested3DShape, prompt, carrier);
    if (existingSvgIdx !== -1) {
      list[existingSvgIdx] = upgraded;
    } else if (existingMathIdx !== -1) {
      list[existingMathIdx] = upgraded;
    } else {
      list.push(upgraded);
    }
    return list;
  }

  // 3) Se houver <svg> no texto sem show_svg, extrai como show_svg
  const hasSvgAction = list.some((a) => a.type === 'show_svg' && a.svgCode);
  if (!hasSvgAction) {
    const svgMatch = reply.match(/<svg\b[\s\S]*?<\/svg>/i);
    if (svgMatch?.[0]) {
      list.push({
        type: 'show_svg',
        title: prompt.slice(0, 52) || 'Ilustração Vetorial SARA',
        svgCode: svgMatch[0],
      });
    }
  }
  return list;
}

function parseStreamingJarvisTags(buffer: string): {
  speak: string;
  speakComplete: boolean;
  chatSummary: string;
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

  let chatSummary = '';
  const chatOpen = buffer.indexOf('<JARVIS_CHAT>');
  const chatClose = buffer.indexOf('</JARVIS_CHAT>');
  if (chatOpen !== -1) {
    chatSummary =
      chatClose !== -1
        ? buffer.slice(chatOpen + 13, chatClose).trim()
        : buffer.slice(chatOpen + 13).trim();
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

  return { speak, speakComplete, chatSummary, reply, actions, mood };
}

export interface JarvisStreamCallbacks {
  onSpeakReady?: (speakText: string) => void;
  onReplyPartial?: (partialReply: string) => void;
  onModelStatus?: (model: string) => void;
  onBusyRetry?: (message: string, attempt: number) => void;
}

const BUSY_RETRY_MESSAGE = 'Núcleo ocupado, a tentar de novo...';

function isBusyStatusOrText(status?: number, errText?: string, retryable?: boolean): boolean {
  if (retryable) return true;
  if (status === 429 || status === 502 || status === 503 || status === 504) return true;
  const s = String(errText || '');
  return /ocupado|a tentar de novo|429|503|504|timeout|rate.?limit|quota|overloaded/i.test(s);
}

async function runSingleJarvisAttempt(
  requestBody: string,
  headers: Record<string, string>,
  prompt: string,
  callbacks: JarvisStreamCallbacks | undefined,
  isOwner: boolean
): Promise<
  | { ok: true; response: JarvisAssistantResponse }
  | { ok: false; busy: boolean }
> {
  let streamRetryable = false;
  let streamError = '';

  try {
    const resp = await fetch('/api/jarvis-stream', {
      method: 'POST',
      headers,
      body: requestBody,
    });

    if (!resp.ok) {
      if (isBusyStatusOrText(resp.status)) {
        streamRetryable = true;
      }
    } else if (resp.body) {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let sseBuffer = '';
      let rawAccum = '';
      let modelUsed = '';
      let speakEmitted = false;
      let lastPartialReply = '';
      let enrichedActionsFromServer: JarvisActionPayload[] | null = null;

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
                const cleanSpeak = sanitizeNonOwnerAiReply(
                  sanitizeAssistantPlainText(parsed.speak),
                  isOwner
                );
                if (cleanSpeak) {
                  speakEmitted = true;
                  callbacks?.onSpeakReady?.(cleanSpeak);
                }
              }
              if (parsed.reply) {
                const cleanPartial = sanitizeNonOwnerAiReply(
                  sanitizeAssistantPlainText(parsed.reply),
                  isOwner
                );
                if (cleanPartial && cleanPartial !== lastPartialReply) {
                  lastPartialReply = cleanPartial;
                  callbacks?.onReplyPartial?.(cleanPartial);
                }
              }
            } else if (evt.type === 'enriched_actions' && Array.isArray(evt.actions)) {
              enrichedActionsFromServer = evt.actions.map(normalizeJarvisAction);
            } else if (evt.type === 'error' && evt.error) {
              streamError = String(evt.error);
              if (isBusyStatusOrText(undefined, streamError, Boolean(evt.retryable))) {
                streamRetryable = true;
              }
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
          .replace(/<JARVIS_CHAT>[\s\S]*?<\/JARVIS_CHAT>/gi, '')
          .replace(/<JARVIS_ACTIONS>[\s\S]*?<\/JARVIS_ACTIONS>/gi, '')
          .replace(/<JARVIS_MOOD>[\s\S]*?<\/JARVIS_MOOD>/gi, '')
          .replace(/<\/?JARVIS_REPLY>/gi, '')
          .trim();

        const rawActions = enrichedActionsFromServer || finalParsed.actions;
        const finalActions = maybeExtractVisualActions(
          prompt,
          finalParsed.reply || strippedFallback,
          rawActions
        );
        const cleanReply =
          sanitizeNonOwnerAiReply(
            sanitizeAssistantPlainText(finalParsed.reply || strippedFallback || finalParsed.speak),
            isOwner
          ) || 'Mostrei no preview.';
        const cleanChatSummary = sanitizeNonOwnerAiReply(
          sanitizeAssistantPlainText(finalParsed.chatSummary || ''),
          isOwner
        );
        const cleanSpeak =
          sanitizeNonOwnerAiReply(
            sanitizeAssistantPlainText(finalParsed.speak || cleanReply),
            isOwner
          ) || cleanReply;

        if (!speakEmitted && cleanSpeak) {
          callbacks?.onSpeakReady?.(cleanSpeak);
        }

        return {
          ok: true,
          response: {
            reply: cleanReply,
            chatSummary: cleanChatSummary || undefined,
            voiceSummary: cleanSpeak,
            mood: finalParsed.mood || 'speaking',
            actions: finalActions,
            modelUsed,
          },
        };
      }
    }
  } catch {
    // fallback para /api/jarvis padrão abaixo
  }

  return askJarvisAssistantFallbackJson(requestBody, headers, prompt, callbacks, isOwner, streamRetryable, streamError);
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
    builderContext?: JarvisBuilderContext | null;
    userIdentity?: SaraUserIdentityPayload | null;
    recentUserUtterances?: string[];
    lastDomain?: string;
  },
  callbacks?: JarvisStreamCallbacks
): Promise<JarvisAssistantResponse> {
  const isOwner = Boolean(params.userIdentity?.isOwner);
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
    userIdentity: params.userIdentity || null,
    recentUserUtterances: params.recentUserUtterances?.slice(-5) || [],
    lastDomain: params.lastDomain || params.memory?.lastDomain || 'general',
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

  let lastWasBusy = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const attemptResult = await runSingleJarvisAttempt(
      requestBody,
      headers,
      params.prompt,
      callbacks,
      isOwner
    );
    if (attemptResult.ok) {
      return attemptResult.response;
    }

    lastWasBusy = attemptResult.busy;
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (!attemptResult.busy || attempt >= 2 || isOffline) {
      break;
    }

    callbacks?.onBusyRetry?.(BUSY_RETRY_MESSAGE, attempt + 1);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const finalUnavailable = lastWasBusy
    ? BUSY_RETRY_MESSAGE
    : 'Núcleo offline. A tentar reconectar...';
  callbacks?.onSpeakReady?.(finalUnavailable);
  return {
    reply: finalUnavailable,
    chatSummary: finalUnavailable,
    voiceSummary: finalUnavailable,
    mood: 'idle',
    actions: [],
  };
}

async function askJarvisAssistantFallbackJson(
  requestBody: string,
  headers: Record<string, string>,
  prompt: string,
  callbacks?: JarvisStreamCallbacks,
  isOwner = false,
  priorBusyHint = false,
  priorErrorText = ''
): Promise<{ ok: true; response: JarvisAssistantResponse } | { ok: false; busy: boolean }> {
  try {
    const resp = await fetch('/api/jarvis', {
      method: 'POST',
      headers,
      body: requestBody,
    });
    if (resp.ok) {
      const data = (await resp.json()) as JarvisAssistantResponse;
      if (data && typeof data.reply === 'string') {
        const extractedActions = maybeExtractVisualActions(
          prompt,
          data.reply,
          (data.actions || []).map(normalizeJarvisAction)
        );
        const cleanReply =
          sanitizeNonOwnerAiReply(sanitizeAssistantPlainText(data.reply), isOwner) || 'Feito.';
        const cleanChat = sanitizeNonOwnerAiReply(
          sanitizeAssistantPlainText(data.chatSummary || ''),
          isOwner
        );
        const spoken =
          sanitizeNonOwnerAiReply(
            sanitizeAssistantPlainText(data.voiceSummary || cleanReply),
            isOwner
          ) || cleanReply;
        callbacks?.onSpeakReady?.(spoken);
        return {
          ok: true,
          response: {
            ...data,
            reply: cleanReply,
            chatSummary: cleanChat || undefined,
            voiceSummary: spoken,
            actions: extractedActions,
          },
        };
      }
    } else {
      const errBody = await resp.json().catch(() => ({} as any));
      const busy = isBusyStatusOrText(
        resp.status,
        String(errBody?.error || priorErrorText || ''),
        Boolean(errBody?.retryable) || priorBusyHint
      );
      return { ok: false, busy };
    }
  } catch {
    // offline or timeout/abort failure
  }

  return { ok: false, busy: priorBusyHint };
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
  builderContext?: JarvisBuilderContext | null;
  userIdentity?: SaraUserIdentityPayload | null;
  recentUserUtterances?: string[];
  lastDomain?: string;
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

function degToCompassLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx];
}

export async function fetchLiveWeather(forceRefresh = false): Promise<JarvisWeatherInfo> {
  const cached = safeReadJson<{ ts: number; data: JarvisWeatherInfo } | null>(
    JARVIS_STORAGE_KEYS.weather,
    null
  );
  const cacheIsValidLocation =
    cached?.data?.city &&
    !/\b(luanda|angola|matola)\b/i.test(cached.data.city) &&
    cached.data.uvIndex !== undefined;

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
    )}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,uv_index,is_day&hourly=temperature_2m,weather_code,uv_index&forecast_hours=4&timezone=auto`;
    const resp = await fetch(url);
    if (resp.ok) {
      const json = await resp.json();
      const curr = json?.current;
      if (curr && typeof curr.temperature_2m === 'number') {
        const isDay = curr.is_day !== 0;
        const windDeg =
          typeof curr.wind_direction_10m === 'number' ? Math.round(Number(curr.wind_direction_10m)) : null;
        const uvVal = typeof curr.uv_index === 'number' ? Number(Number(curr.uv_index).toFixed(1)) : null;

        const hourlyTimes: string[] = Array.isArray(json?.hourly?.time) ? json.hourly.time : [];
        const hourlyTemps: number[] = Array.isArray(json?.hourly?.temperature_2m) ? json.hourly.temperature_2m : [];
        const hourlyCodes: number[] = Array.isArray(json?.hourly?.weather_code) ? json.hourly.weather_code : [];
        const hourlyUvs: number[] = Array.isArray(json?.hourly?.uv_index) ? json.hourly.uv_index : [];

        const hourlyForecast = hourlyTimes.slice(1, 4).map((iso, i) => {
          const idx = i + 1;
          const hhmm = typeof iso === 'string' && iso.includes('T') ? iso.split('T')[1].slice(0, 5) : `+${idx}h`;
          return {
            time: hhmm,
            tempC: Math.round(Number(hourlyTemps[idx] ?? curr.temperature_2m)),
            condition: mapWeatherCodeToCondition(Number(hourlyCodes[idx] ?? curr.weather_code ?? 0), isDay),
            uv: typeof hourlyUvs[idx] === 'number' ? Number(Number(hourlyUvs[idx]).toFixed(1)) : null,
          };
        });

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
          windDirectionDeg: windDeg,
          windDirectionLabel: windDeg !== null ? degToCompassLabel(windDeg) : null,
          uvIndex: uvVal,
          hourlyForecast,
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
    windDirectionDeg: null,
    windDirectionLabel: null,
    uvIndex: null,
    hourlyForecast: [],
    condition: 'Clima indisponível',
    city,
    loadedFromApi: false,
    errorMsg: 'Não consegui buscar o clima real agora',
  };
}

export async function fetchLiveHudFeed(forceRefresh = false): Promise<JarvisHudLiveFeed> {
  const cached = safeReadJson<{ ts: number; data: JarvisHudLiveFeed } | null>(
    JARVIS_STORAGE_KEYS.hudFeed,
    null
  );
  if (!forceRefresh && cached && Date.now() - cached.ts < 10 * 60 * 1000) {
    return cached.data;
  }

  try {
    const resp = await fetch('/api/jarvis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hud_live_feed' }),
    });
    if (resp.ok) {
      const json = (await resp.json()) as JarvisHudLiveFeed;
      if (json && (json.fx || Array.isArray(json.news))) {
        safeWriteJson(JARVIS_STORAGE_KEYS.hudFeed, { ts: Date.now(), data: json });
        return json;
      }
    }
  } catch {
    // offline fallback
  }

  if (cached) return cached.data;
  return {
    fx: null,
    news: [],
    loadedAt: new Date().toISOString(),
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
