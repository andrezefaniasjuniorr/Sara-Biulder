export type WorkspaceMode = 'jarvis' | 'builder';

export type JarvisModuleTab = 'voz' | 'sistema' | 'agenda' | 'musica' | 'documentos' | 'tarefas';

export type JarvisHeadMood = 'idle' | 'listening' | 'thinking' | 'speaking' | 'happy' | 'focus';

export interface JarvisAgendaItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  notes?: string;
  completed?: boolean;
  createdAt: string;
}

export interface JarvisAlarmItem {
  id: string;
  time: string; // HH:mm
  label: string;
  enabled: boolean;
  triggeredTodayDate?: string;
}

export interface JarvisTaskItem {
  id: string;
  title: string;
  priority: 'alta' | 'media' | 'baixa';
  done: boolean;
  createdAt: string;
}

export interface JarvisTrack {
  id: string;
  title: string;
  artist: string;
  videoId?: string;
  thumbnailUrl?: string;
  watchUrl?: string;
  durationText?: string;
  source: 'youtube';
}

export interface JarvisDocumentItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  textContent?: string;
  base64Data?: string;
  previewBlobUrl?: string;
  summary?: string;
  keyPoints?: string[];
  extractedData?: Array<{ label: string; value: string }>;
}

export interface JarvisMathStep {
  step: string;
  expression: string;
  explanation: string;
}

export type JarvisStageContent =
  | {
      id: string;
      kind: 'svg';
      title: string;
      subtitle?: string;
      svgCode: string;
      description?: string;
    }
  | {
      id: string;
      kind: 'math';
      title: string;
      problem?: string;
      steps: JarvisMathStep[];
      finalAnswer: string;
      notes?: string;
    }
  | {
      id: string;
      kind: 'chart';
      title: string;
      subtitle?: string;
      chartType: 'bar' | 'line' | 'doughnut' | 'radar';
      labels: string[];
      datasets: Array<{
        label: string;
        data: number[];
        color?: string;
      }>;
      summary?: string;
    }
  | {
      id: string;
      kind: 'document';
      title: string;
      docId?: string;
      mimeType: string;
      summary: string;
      keyPoints: string[];
      extractedData: Array<{ label: string; value: string }>;
      previewUrl?: string;
      rawText?: string;
    }
  | {
      id: string;
      kind: 'html';
      title: string;
      subkind: 'site' | 'planilha' | 'apresentacao' | 'visual';
      html: string;
    }
  | {
      id: string;
      kind: 'music' | 'video';
      title: string;
      track: JarvisTrack;
    }
  | {
      id: string;
      kind: 'ideation';
      title: string;
      subtitle?: string;
      cards: Array<{ title: string; tag: string; detail: string }>;
    };

export interface JarvisConversationEntry {
  id: string;
  sender: 'user' | 'sara';
  text: string;
  timestamp: string;
  stageAttachedTitle?: string;
}

export interface JarvisMemoryState {
  userName: string;
  preferences: string[];
  facts: string[];
  lastRoutineGreetingDate?: string;
}

export interface JarvisActionPayload {
  type:
    | 'add_agenda'
    | 'add_alarm'
    | 'add_task'
    | 'complete_task'
    | 'play_music'
    | 'play_video'
    | 'open_module'
    | 'show_svg'
    | 'show_math'
    | 'show_chart'
    | 'show_document'
    | 'show_html'
    | 'show_ideation'
    | 'remember_fact'
    | 'toggle_focus'
    | 'switch_mode';
  title?: string;
  date?: string;
  time?: string;
  notes?: string;
  label?: string;
  priority?: 'alta' | 'media' | 'baixa';
  query?: string;
  artist?: string;
  videoId?: string;
  thumbnailUrl?: string;
  watchUrl?: string;
  durationText?: string;
  moduleTab?: JarvisModuleTab;
  svgCode?: string;
  description?: string;
  problem?: string;
  steps?: JarvisMathStep[];
  finalAnswer?: string;
  chartType?: 'bar' | 'line' | 'doughnut' | 'radar';
  labels?: string[];
  datasets?: Array<{ label: string; data: number[]; color?: string }>;
  summary?: string;
  keyPoints?: string[];
  extractedData?: Array<{ label: string; value: string }>;
  subkind?: 'site' | 'planilha' | 'apresentacao' | 'visual';
  html?: string;
  cards?: Array<{ title: string; tag: string; detail: string }>;
  fact?: string;
  enabled?: boolean;
  target?: WorkspaceMode;
}

export interface JarvisAssistantResponse {
  reply: string;
  voiceSummary: string;
  mood?: JarvisHeadMood;
  actions?: JarvisActionPayload[];
  modelUsed?: string;
}

export interface JarvisWeatherInfo {
  tempC: number | null;
  feelsLikeC: number | null;
  humidityPct: number | null;
  windKmh: number | null;
  condition: string;
  city: string;
  isDay?: boolean;
  loadedFromApi: boolean;
  updatedAt?: string;
  errorMsg?: string;
}

export interface JarvisSystemTelemetry {
  cpuCores: number | null;
  deviceMemoryGb: number | null;
  jsHeapUsedMb: number | null;
  jsHeapLimitMb: number | null;
  batteryPct: number | null;
  batteryCharging: boolean | null;
  online: boolean;
  networkType: string | null;
  downlinkMbps: number | null;
  rttMs: number | null;
  timezone: string;
}
