import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import gsap from 'gsap';
import {
  Activity,
  AlarmClock,
  BatteryCharging,
  BatteryMedium,
  BellRing,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  CloudSun,
  Cpu,
  ExternalLink,
  EyeOff,
  FileText,
  Focus,
  Globe,
  Hammer,
  HardDrive,
  LayoutDashboard,
  Loader2,
  Mic,
  MicOff,
  Music2,
  Newspaper,
  Paperclip,
  Pause,
  Play,
  Plus,
  Radar,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type { LiveBuildInfo } from '../../types/builder';
import type {
  JarvisActionPayload,
  JarvisAgendaItem,
  JarvisAlarmItem,
  JarvisConversationEntry,
  JarvisDocumentItem,
  JarvisHeadMood,
  JarvisHudLiveFeed,
  JarvisMediaStateContext,
  JarvisMemoryState,
  JarvisModuleTab,
  JarvisStageContent,
  JarvisSystemTelemetry,
  JarvisTaskItem,
  JarvisTrack,
  JarvisWeatherInfo,
  WorkspaceMode,
} from '../../types/jarvis';
import {
  askJarvisAssistantStream,
  DEFAULT_JARVIS_MEMORY,
  fetchLiveHudFeed,
  fetchLiveWeather,
  isFullBuilderAppRequest,
  loadJarvisLocalBundle,
  playJarvisAlarmSound,
  readDocumentFile,
  readSyncSystemTelemetry,
  sanitizeAssistantPlainText,
  saveJarvisAgenda,
  saveJarvisAlarms,
  saveJarvisConversation,
  saveJarvisDocuments,
  saveJarvisMemory,
  saveJarvisPlaylist,
  saveJarvisTasks,
  searchYouTubeTrack,
} from '../../services/jarvisService';
import {
  buscarJarvisStateFirebase,
  salvarJarvisStateFirebase,
} from '../../services/firebaseService';
import { evaluateNonOwnerGuard } from '../../services/authService';
import type {
  ActivityCategory,
  SaraSession,
  SaraUserIdentityPayload,
} from '../../types/auth';
import {
  getBackgroundBuildAckSpeech,
  getVoiceReadingStatus,
  interruptSaraAndListen,
  parseVoiceCommand,
  pauseVoiceReading,
  resumeVoiceReading,
  speakAsSara,
  startVoiceReading,
  stopVoiceReading,
  subscribeVoiceReadingStatus,
  type VoiceCommandAction,
  type VoiceReadingStatus,
} from '../../utils/voiceService';
import { SaraJarvisHead } from './SaraJarvisHead';
import { JarvisStageRenderer } from './JarvisStageRenderer';

interface JarvisWorkspaceProps {
  session: SaraSession;
  userIdentity: SaraUserIdentityPayload;
  onUserActivity?: (category?: ActivityCategory) => void;
  onRequestAdmin?: () => void;
  voiceEnabled: boolean;
  isListening: boolean;
  isSaraSpeaking: boolean;
  isSaraSilenced: boolean;
  firebaseUserUid?: string;
  activeBuilderProjectName?: string;
  activeBuilderFiles?: string[];
  liveBuild?: LiveBuildInfo;
  completedBackgroundBuild?: {
    id: string;
    projectName: string;
    elapsedSeconds: number;
    filesCount: number;
  } | null;
  onDismissCompletedBuild?: () => void;
  onTriggerBackgroundBuild?: (goal: string, source: 'voice' | 'text') => Promise<void>;
  externalNotifyChatRef?: React.MutableRefObject<((shortMsg: string) => void) | null>;
  onToggleMic: () => void;
  onSilenceSara: () => void;
  onSwitchMode: (mode: WorkspaceMode) => void;
  onOpenSettings?: () => void;
  onNotify: (msg: string) => void;
  onExecuteSystemCommand?: (cmd: VoiceCommandAction, rawText: string) => Promise<boolean>;
  onStageStateChange?: (state: JarvisMediaStateContext) => void;
  onPanelOpenChange?: (open: boolean) => void;
  externalMediaControlRef?: React.MutableRefObject<{
    pause: () => void;
    resume: () => void;
    close: () => void;
    adjustVolume: (delta: number) => number;
    closeStage: () => void;
  } | null>;
  externalCommandRef: React.MutableRefObject<
    ((promptText: string, source?: 'voice' | 'text') => Promise<void>) | null
  >;
  externalFocusCommandRef: React.MutableRefObject<((enabled: boolean) => void) | null>;
  externalModuleRef: React.MutableRefObject<((tab: JarvisModuleTab) => void) | null>;
  externalPanelRef?: React.MutableRefObject<((open: boolean) => void) | null>;
  externalRepeatRef: React.MutableRefObject<(() => void) | null>;
  externalContinueRef: React.MutableRefObject<(() => Promise<void>) | null>;
}

const IRON_MAN_PROCESS_LINES = [
  '>> A LIGAR MOTOR NEURAL SARA',
  '>> A PREPARAR RESPOSTA POR VOZ',
  '>> A CALIBRAR MODELO 3D / GRÁFICOS',
  '>> A SINCRONIZAR DADOS EM TEMPO REAL',
];

const DAILY_QUOTES = [
  'Disciplina transforma intenção em sistema funcional.',
  'Sistemas simples escalam; sistemas claros duram.',
  'Cada segundo de foco hoje poupa horas de correção amanhã.',
  'Precisão técnica começa com clareza no objetivo.',
  'Velocidade sem direção é ruído; precisão é poder.',
];

function formatUptimeHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = String(Math.floor(s / 3600)).padStart(2, '0');
  const mins = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const secs = String(s % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

function buildCompactChatSummary(res: {
  chatSummary?: string;
  reply?: string;
  actions?: JarvisActionPayload[];
}): string {
  const cleanExplicit = sanitizeAssistantPlainText(res.chatSummary || '')
    .split('\n')[0]
    .trim();
  if (cleanExplicit && cleanExplicit.length <= 105) {
    return cleanExplicit;
  }

  const actions = Array.isArray(res.actions) ? res.actions : [];
  const primary = actions.find((a) =>
    [
      'show_3d',
      'show_svg',
      'show_math',
      'show_explanation',
      'show_chart',
      'show_quiz',
      'show_flashcards',
      'show_ideation',
      'show_html',
      'show_document',
      'play_music',
      'play_video',
      'read_aloud',
    ].includes(a.type)
  );

  if (primary) {
    switch (primary.type) {
      case 'show_3d':
        return `${primary.title || 'Modelo 3D'} desenhado com cálculos no preview.`;
      case 'show_svg':
        return `${primary.title || 'Desenho'} mostrado no preview.`;
      case 'show_math':
        return `${primary.title || 'Cálculo'} resolvido no preview.`;
      case 'show_explanation':
        return `Explicação dada por voz: ${primary.title || 'Tema'}.`;
      case 'show_chart':
        return `Gráfico "${primary.title || 'Dados'}" gerado no preview.`;
      case 'show_quiz':
        return `Teste "${primary.title || 'Quiz'}" pronto no preview.`;
      case 'show_flashcards':
        return `Flashcards "${primary.title || 'Estudo'}" abertos no preview.`;
      case 'show_ideation':
        return `${primary.title || 'Textos e ideias'} prontos no preview.`;
      case 'show_html':
        return `${primary.title || 'Documento'} pronto no preview.`;
      case 'show_document':
        return `Documento "${primary.title || 'Ficheiro'}" analisado no preview.`;
      case 'play_music':
        return `A tocar: ${primary.title || primary.query || 'Música'}.`;
      case 'play_video':
        return `A reproduzir vídeo: ${primary.title || primary.query || 'Vídeo'}.`;
      case 'read_aloud':
        return `Leitura em voz alta ativa: ${primary.title || 'Texto'}.`;
    }
  }

  const fallbackSentence =
    sanitizeAssistantPlainText(res.reply || '')
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)[0]
      ?.trim() || 'Feito.';
  if (fallbackSentence.length <= 95) return fallbackSentence;
  return `${fallbackSentence.slice(0, 92).replace(/\s+\S*$/, '')}...`;
}

function formatMiniMmSs(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const JarvisWorkspace: React.FC<JarvisWorkspaceProps> = ({
  session,
  userIdentity,
  onUserActivity,
  onRequestAdmin,
  voiceEnabled,
  isListening,
  isSaraSpeaking,
  isSaraSilenced,
  activeBuilderProjectName,
  activeBuilderFiles,
  liveBuild,
  completedBackgroundBuild,
  onDismissCompletedBuild,
  onTriggerBackgroundBuild,
  externalNotifyChatRef,
  onToggleMic,
  onSilenceSara,
  onSwitchMode,
  onOpenSettings,
  onNotify,
  onExecuteSystemCommand,
  onStageStateChange,
  onPanelOpenChange,
  externalMediaControlRef,
  externalCommandRef,
  externalFocusCommandRef,
  externalModuleRef,
  externalPanelRef,
  externalRepeatRef,
  externalContinueRef,
}) => {
  const initialBundle = useMemo(
    () => loadJarvisLocalBundle(session.userId, session.callName, session.isGuest),
    [session.userId, session.callName, session.isGuest]
  );
  const [activeModule, setActiveModule] = useState<JarvisModuleTab>('voz');
  const [readingStatus, setReadingStatus] = useState<VoiceReadingStatus>(() =>
    getVoiceReadingStatus()
  );
  const [musicElapsedSec, setMusicElapsedSec] = useState(0);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<'stage' | 'hud' | 'log'>('stage');
  const [isMemoryExpanded, setIsMemoryExpanded] = useState(false);

  const [agenda, setAgenda] = useState<JarvisAgendaItem[]>(initialBundle.agenda);
  const [alarms, setAlarms] = useState<JarvisAlarmItem[]>(initialBundle.alarms);
  const [tasks, setTasks] = useState<JarvisTaskItem[]>(initialBundle.tasks);
  const [memory, setMemory] = useState<JarvisMemoryState>(initialBundle.memory);
  const [documents, setDocuments] = useState<JarvisDocumentItem[]>(initialBundle.documents);
  const [conversation, setConversation] = useState<JarvisConversationEntry[]>(
    initialBundle.conversation
  );
  const [playlist, setPlaylist] = useState<JarvisTrack[]>(initialBundle.playlist);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  const [stageContent, setStageContent] = useState<JarvisStageContent | null>(null);
  const [stageLayout, setStageLayout] = useState<'split' | 'focus'>('split');
  const [mediaPaused, setMediaPaused] = useState(false);
  const [mediaVolume, setMediaVolume] = useState(80);
  const mediaVolumeRef = useRef(80);
  const [mood, setMood] = useState<JarvisHeadMood>('idle');
  const [isThinking, setIsThinking] = useState(false);
  const [streamingReply, setStreamingReply] = useState<string | null>(null);
  const [thinkingPercent, setThinkingPercent] = useState(0);
  const [thinkingLogs, setThinkingLogs] = useState<string[]>([]);
  const [focusMode, setFocusMode] = useState(false);

  const [inputText, setInputText] = useState('');
  const [pendingDoc, setPendingDoc] = useState<JarvisDocumentItem | null>(null);
  const [activeDoc, setActiveDoc] = useState<JarvisDocumentItem | null>(null);

  const [now, setNow] = useState<Date>(() => new Date());
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  const [hudPulseTick, setHudPulseTick] = useState(0);

  const [weather, setWeather] = useState<JarvisWeatherInfo>({
    tempC: null,
    feelsLikeC: null,
    humidityPct: null,
    windKmh: null,
    windDirectionDeg: null,
    windDirectionLabel: null,
    uvIndex: null,
    hourlyForecast: [],
    condition: 'A obter clima real...',
    city: 'Inhambane Cidade, Inhambane, Moçambique',
    loadedFromApi: false,
  });
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);

  const [hudFeed, setHudFeed] = useState<JarvisHudLiveFeed>({
    fx: null,
    news: [],
    loadedAt: '',
  });
  const [newsIndex, setNewsIndex] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(() => new Date().getDate() % DAILY_QUOTES.length);

  const batteryInfoRef = useRef<{ pct: number | null; charging: boolean | null }>({
    pct: null,
    charging: null,
  });
  const [telemetry, setTelemetry] = useState<JarvisSystemTelemetry>(() =>
    readSyncSystemTelemetry()
  );
  const [activeRingingAlarm, setActiveRingingAlarm] = useState<JarvisAlarmItem | null>(null);

  // Inputs dos módulos dentro da gaveta [☰ PAINEL]
  const [newAgendaTitle, setNewAgendaTitle] = useState('');
  const [newAgendaDate, setNewAgendaDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newAgendaTime, setNewAgendaTime] = useState('10:00');
  const [newAlarmTime, setNewAlarmTime] = useState('07:00');
  const [newAlarmLabel, setNewAlarmLabel] = useState('Despertar');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'alta' | 'media' | 'baixa'>('media');
  const [musicSearch, setMusicSearch] = useState('');
  const [isSearchingMusic, setIsSearchingMusic] = useState(false);
  const [newMemoryFact, setNewMemoryFact] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const diagChartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const netChartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const diagChartRef = useRef<Chart | null>(null);
  const netChartRef = useRef<Chart | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const proactiveCheckedRef = useRef(false);
  const aiHistoryRef = useRef<JarvisConversationEntry[]>(initialBundle.conversation);

  const updatePanelOpen = useCallback(
    (next: boolean) => {
      setIsPanelOpen(next);
      onPanelOpenChange?.(next);
    },
    [onPanelOpenChange]
  );

  useEffect(() => subscribeVoiceReadingStatus(setReadingStatus), []);

  useEffect(() => {
    if (!externalPanelRef) return;
    externalPanelRef.current = updatePanelOpen;
    return () => {
      if (externalPanelRef) externalPanelRef.current = null;
    };
  }, [externalPanelRef, updatePanelOpen]);

  useEffect(() => {
    if (!externalNotifyChatRef) return;
    externalNotifyChatRef.current = (shortMsg: string) => {
      const cleanMsg = sanitizeAssistantPlainText(shortMsg).split('\n')[0].trim();
      if (!cleanMsg) return;
      setConversation((prev) => [
        ...prev.slice(-30),
        {
          id: `sara_bg_${Date.now()}`,
          sender: 'sara',
          text: cleanMsg,
          timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    };
    return () => {
      if (externalNotifyChatRef) externalNotifyChatRef.current = null;
    };
  }, [externalNotifyChatRef]);

  // Animação GSAP suave da gaveta deslizante [☰ PAINEL]
  useEffect(() => {
    if (!isPanelOpen || !drawerRef.current) return;
    gsap.fromTo(
      drawerRef.current,
      { x: -340, opacity: 0.4 },
      { x: 0, opacity: 1, duration: 0.28, ease: 'power3.out' }
    );
  }, [isPanelOpen]);

  // Persistência local automática isolada por usuário (zero persistência para convidado)
  useEffect(() => saveJarvisAgenda(agenda, session.userId, session.isGuest), [agenda, session.userId, session.isGuest]);
  useEffect(() => saveJarvisAlarms(alarms, session.userId, session.isGuest), [alarms, session.userId, session.isGuest]);
  useEffect(() => saveJarvisTasks(tasks, session.userId, session.isGuest), [tasks, session.userId, session.isGuest]);
  useEffect(() => saveJarvisMemory(memory, session.userId, session.isGuest), [memory, session.userId, session.isGuest]);
  useEffect(() => saveJarvisDocuments(documents, session.userId, session.isGuest), [documents, session.userId, session.isGuest]);
  useEffect(() => saveJarvisConversation(conversation, session.userId, session.isGuest), [conversation, session.userId, session.isGuest]);
  useEffect(() => saveJarvisPlaylist(playlist, session.userId, session.isGuest), [playlist, session.userId, session.isGuest]);

  // Inteligência Proativa & Continuidade entre dias
  useEffect(() => {
    if (proactiveCheckedRef.current || session.isGuest) return;
    proactiveCheckedRef.current = true;
    const todayKey = new Date().toISOString().slice(0, 10);
    const sessionKey = `sara_proactive_checked_${session.userId}_${todayKey}`;
    try {
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, '1');
    } catch {
      // ignore storage restriction
    }

    const urgentToday = agenda.find(
      (a) =>
        a.date === todayKey &&
        !a.completed &&
        /(teste|prova|exame|revis|apresent|reuni|entrega|aula)/i.test(a.title)
    );
    const urgentTask = tasks.find(
      (t) =>
        !t.done &&
        (t.priority === 'alta' || /(teste|prova|exame|revis|apresent|fatura|trabalho)/i.test(t.title))
    );

    let proactiveMsg = '';
    if (urgentToday) {
      proactiveMsg = session.isOwner
        ? `Chefe, hoje às ${urgentToday.time} tens "${urgentToday.title}" na agenda. Queres rever ou preparar alguma coisa agora?`
        : `${session.callName}, hoje às ${urgentToday.time} tens "${urgentToday.title}" na agenda. Queres rever ou preparar alguma coisa agora?`;
    } else if (urgentTask) {
      proactiveMsg = `Tens "${urgentTask.title}" em aberto nas tarefas. Queres tratar disso já?`;
    } else if (
      memory.lastVisitDate &&
      memory.lastVisitDate < todayKey &&
      (activeBuilderProjectName || memory.lastActiveProjectName || memory.lastTopic)
    ) {
      const refName =
        activeBuilderProjectName || memory.lastActiveProjectName || memory.lastTopic;
      proactiveMsg = `Bom regresso! Continuamos "${refName}" de ontem ou vamos noutra direção hoje?`;
    }

    setMemory((prev) => ({
      ...prev,
      lastVisitDate: todayKey,
      lastActiveProjectName: activeBuilderProjectName || prev.lastActiveProjectName,
    }));

    if (proactiveMsg) {
      setConversation((prev) => [
        ...prev.slice(-30),
        {
          id: `sara_proactive_${Date.now()}`,
          sender: 'sara',
          text: proactiveMsg,
          timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [agenda, tasks, memory.lastVisitDate, memory.lastActiveProjectName, memory.lastTopic, activeBuilderProjectName]);

  useEffect(() => {
    mediaVolumeRef.current = mediaVolume;
  }, [mediaVolume]);

  const currentMediaState = useMemo<JarvisMediaStateContext>(() => {
    const isMedia = stageContent?.kind === 'music' || stageContent?.kind === 'video';
    return {
      hasActiveMedia: isMedia,
      mediaKind: isMedia ? stageContent.kind : undefined,
      mediaTitle: isMedia ? stageContent.title : undefined,
      isPaused: isMedia ? mediaPaused : false,
      volume: mediaVolume,
      activeStageKind: stageContent?.kind,
      activeStageTitle: stageContent?.title,
    };
  }, [stageContent, mediaPaused, mediaVolume]);

  useEffect(() => {
    setMusicElapsedSec(0);
  }, [stageContent?.id]);

  useEffect(() => {
    const isMedia = stageContent?.kind === 'music' || stageContent?.kind === 'video';
    if (!isMedia || mediaPaused) return;
    const t = setInterval(() => {
      setMusicElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [stageContent?.kind, stageContent?.id, mediaPaused]);

  const builderProgressPct = useMemo(() => {
    if (!liveBuild?.isBuilding) return 0;
    const totalSteps = liveBuild.steps?.length || 0;
    const doneSteps = liveBuild.steps?.filter((s) => s.status === 'done').length || 0;
    if (liveBuild.phase === 'thinking') return 12;
    if (liveBuild.phase === 'planning') return 24;
    if (liveBuild.phase === 'testing') return 91;
    if (liveBuild.phase === 'fixing') return 84;
    if (totalSteps > 0) return Math.min(88, 26 + Math.round((doneSteps / totalSteps) * 58));
    return 38;
  }, [liveBuild]);

  const nextEnabledAlarm = useMemo(() => alarms.find((a) => a.enabled) || null, [alarms]);

  useEffect(() => {
    onStageStateChange?.(currentMediaState);
  }, [currentMediaState, onStageStateChange]);

  useEffect(() => {
    if (!externalMediaControlRef) return;
    externalMediaControlRef.current = {
      pause: () => setMediaPaused(true),
      resume: () => setMediaPaused(false),
      close: () => {
        setStageContent((prev) =>
          prev && (prev.kind === 'music' || prev.kind === 'video') ? null : prev
        );
        setMediaPaused(false);
      },
      adjustVolume: (delta: number) => {
        const next = Math.max(0, Math.min(100, mediaVolumeRef.current + delta));
        mediaVolumeRef.current = next;
        setMediaVolume(next);
        return next;
      },
      closeStage: () => {
        setStageContent(null);
        setMediaPaused(false);
      },
    };
    return () => {
      if (externalMediaControlRef) externalMediaControlRef.current = null;
    };
  }, [externalMediaControlRef]);

  // Hidratação + sync isolado por usuário (ignorado em Modo Convidado)
  useEffect(() => {
    if (session.isGuest) return;
    let active = true;
    buscarJarvisStateFirebase(session.userId).then((cloud) => {
      if (!active || !cloud) return;
      if (Array.isArray(cloud.agenda) && cloud.agenda.length > 0 && agenda.length === 0) {
        setAgenda(cloud.agenda as JarvisAgendaItem[]);
      }
      if (Array.isArray(cloud.alarms) && cloud.alarms.length > 0 && alarms.length === 0) {
        setAlarms(cloud.alarms as JarvisAlarmItem[]);
      }
      if (Array.isArray(cloud.tasks) && cloud.tasks.length > 0 && tasks.length === 0) {
        setTasks(cloud.tasks as JarvisTaskItem[]);
      }
      if (cloud.memory && Array.isArray((cloud.memory as any).facts)) {
        const cleanCloudFacts = ((cloud.memory as any).facts as string[]).filter(
          (f) => typeof f === 'string' && !/\b(luanda|angola|matola)\b/i.test(f)
        );
        setMemory((prev) => ({
          ...DEFAULT_JARVIS_MEMORY,
          ...prev,
          ...(cloud.memory as Partial<JarvisMemoryState>),
          userName: session.callName || prev.userName,
          facts: Array.from(new Set([...(prev.facts || []), ...cleanCloudFacts])).slice(-25),
        }));
      }
    });
    return () => {
      active = false;
    };
  }, [session.userId, session.isGuest, session.callName]);

  useEffect(() => {
    if (session.isGuest) return;
    const t = setTimeout(() => {
      salvarJarvisStateFirebase({ agenda, alarms, tasks, memory }, session.userId).catch(() => {});
    }, 1800);
    return () => clearTimeout(t);
  }, [agenda, alarms, tasks, memory, session.userId, session.isGuest]);

  // Listener real de Bateria + Rede do dispositivo
  useEffect(() => {
    let mounted = true;
    let batteryObj: any = null;

    const refreshTelemetry = () => {
      if (!mounted) return;
      setTelemetry(readSyncSystemTelemetry(batteryInfoRef.current));
    };

    const navAny = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (navAny?.getBattery) {
      navAny
        .getBattery()
        .then((bat: any) => {
          if (!mounted || !bat) return;
          batteryObj = bat;
          const syncBat = () => {
            batteryInfoRef.current = {
              pct: typeof bat.level === 'number' ? Math.round(bat.level * 100) : null,
              charging: typeof bat.charging === 'boolean' ? bat.charging : null,
            };
            refreshTelemetry();
          };
          syncBat();
          bat.addEventListener?.('levelchange', syncBat);
          bat.addEventListener?.('chargingchange', syncBat);
        })
        .catch(() => {});
    }

    const conn = navAny?.connection || navAny?.mozConnection || navAny?.webkitConnection;
    window.addEventListener('online', refreshTelemetry);
    window.addEventListener('offline', refreshTelemetry);
    conn?.addEventListener?.('change', refreshTelemetry);

    return () => {
      mounted = false;
      window.removeEventListener('online', refreshTelemetry);
      window.removeEventListener('offline', refreshTelemetry);
      conn?.removeEventListener?.('change', refreshTelemetry);
      if (batteryObj) {
        batteryObj.onlevelchange = null;
        batteryObj.onchargingchange = null;
      }
    };
  }, []);

  // Relógio ao vivo (1s) + Uptime + Verificador real de alarmes
  useEffect(() => {
    const interval = setInterval(() => {
      const current = new Date();
      setNow(current);
      setUptimeSeconds((s) => s + 1);
      setHudPulseTick((t) => (t + 1) % 3600);
      setTelemetry(readSyncSystemTelemetry(batteryInfoRef.current));

      const hhmm = current.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      const todayKey = current.toISOString().slice(0, 10);

      setAlarms((prevAlarms) => {
        let changed = false;
        const updated = prevAlarms.map((al) => {
          if (al.enabled && al.time === hhmm && al.triggeredTodayDate !== todayKey) {
            changed = true;
            setActiveRingingAlarm(al);
            playJarvisAlarmSound();
            speakAsSara(`Atenção! Alarme das ${al.time}: ${al.label}.`, voiceEnabled, {
              level: 'short',
              forceSpeak: true,
            });
            return { ...al, triggeredTodayDate: todayKey };
          }
          return al;
        });
        return changed ? updated : prevAlarms;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [voiceEnabled]);

  // Clima real via Open-Meteo + Geolocalização (Inhambane Cidade fallback fixo) a cada 10 minutos
  const refreshWeatherNow = useCallback(async (force = false) => {
    setIsRefreshingWeather(true);
    try {
      const w = await fetchLiveWeather(force);
      setWeather(w);
    } finally {
      setIsRefreshingWeather(false);
    }
  }, []);

  useEffect(() => {
    void refreshWeatherNow(false);
    const t = setInterval(() => {
      void refreshWeatherNow(true);
    }, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [refreshWeatherNow]);

  // Feed ao vivo Moçambique: Cotação real Metical + Manchetes reais RSS
  const refreshHudFeedNow = useCallback(async (force = false) => {
    const data = await fetchLiveHudFeed(force);
    setHudFeed(data);
  }, []);

  useEffect(() => {
    void refreshHudFeedNow(false);
    const t = setInterval(() => {
      void refreshHudFeedNow(true);
    }, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [refreshHudFeedNow]);

  // Rotação automática de manchete e frase do dia
  useEffect(() => {
    const t = setInterval(() => {
      setNewsIndex((i) => i + 1);
      setQuoteIndex((q) => (q + 1) % DAILY_QUOTES.length);
    }, 12000);
    return () => clearInterval(t);
  }, []);

  // Gráficos Chart.js ao vivo (Sparkline Diagnóstico à esquerda + Tráfego de Rede à direita)
  useEffect(() => {
    if (focusMode) return;

    const diagCanvas = diagChartCanvasRef.current;
    if (diagCanvas) {
      diagChartRef.current?.destroy();
      const ctx = diagCanvas.getContext('2d');
      if (ctx) {
        const initPts = Array.from({ length: 18 }, (_, i) => 24 + Math.sin(i * 0.6) * 8);
        diagChartRef.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: initPts.map(() => ''),
            datasets: [
              {
                data: initPts,
                borderColor: '#00E5FF',
                backgroundColor: 'rgba(0, 229, 255, 0.14)',
                borderWidth: 1.8,
                fill: true,
                tension: 0.42,
                pointRadius: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
              x: { display: false },
              y: { display: false, min: 0, max: 65 },
            },
          },
        });
      }
    }

    const netCanvas = netChartCanvasRef.current;
    if (netCanvas) {
      netChartRef.current?.destroy();
      const ctx = netCanvas.getContext('2d');
      if (ctx) {
        const initRx = Array.from({ length: 20 }, (_, i) => 18 + Math.cos(i * 0.45) * 9);
        const initTx = Array.from({ length: 20 }, (_, i) => 9 + Math.sin(i * 0.55) * 5);
        netChartRef.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: initRx.map(() => ''),
            datasets: [
              {
                label: 'RX',
                data: initRx,
                borderColor: '#00E5FF',
                backgroundColor: 'rgba(0, 229, 255, 0.16)',
                borderWidth: 1.7,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
              },
              {
                label: 'TX',
                data: initTx,
                borderColor: '#FF2A4B',
                backgroundColor: 'rgba(255, 42, 75, 0.12)',
                borderWidth: 1.4,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
              x: { display: false },
              y: {
                display: true,
                min: 0,
                max: 55,
                ticks: { color: '#64748B', font: { size: 8, family: 'monospace' }, maxTicksLimit: 3 },
                grid: { color: 'rgba(0, 229, 255, 0.08)' },
              },
            },
          },
        });
      }
    }

    const liveInterval = setInterval(() => {
      const activeBoost = isThinking ? 16 : isSaraSpeaking ? 11 : 0;
      if (diagChartRef.current) {
        const arr = diagChartRef.current.data.datasets[0].data as number[];
        const nextVal = Math.max(
          8,
          Math.min(
            60,
            24 + activeBoost + Math.sin(Date.now() * 0.004) * 9 + (Math.random() - 0.5) * 8
          )
        );
        arr.shift();
        arr.push(Number(nextVal.toFixed(1)));
        diagChartRef.current.update('none');
      }
      if (netChartRef.current) {
        const rx = netChartRef.current.data.datasets[0].data as number[];
        const tx = netChartRef.current.data.datasets[1].data as number[];
        const baseDown = telemetry.online ? telemetry.downlinkMbps || 14 : 0;
        const nextRx = telemetry.online
          ? Math.min(52, Math.max(6, baseDown + activeBoost * 0.8 + (Math.random() - 0.3) * 10))
          : 0;
        const nextTx = telemetry.online
          ? Math.min(44, Math.max(3, baseDown * 0.48 + activeBoost * 0.6 + (Math.random() - 0.4) * 7))
          : 0;
        rx.shift();
        rx.push(Number(nextRx.toFixed(1)));
        tx.shift();
        tx.push(Number(nextTx.toFixed(1)));
        netChartRef.current.update('none');
      }
    }, 1100);

    return () => {
      clearInterval(liveInterval);
      diagChartRef.current?.destroy();
      diagChartRef.current = null;
      netChartRef.current?.destroy();
      netChartRef.current = null;
    };
  }, [focusMode, isThinking, isSaraSpeaking, telemetry.online, telemetry.downlinkMbps]);

  // Animação estilo Homem de Ferro ao pensar
  useEffect(() => {
    if (!isThinking) {
      setThinkingPercent(0);
      return;
    }
    setThinkingPercent(14);
    setThinkingLogs([IRON_MAN_PROCESS_LINES[0]]);
    let idx = 1;
    const t = setInterval(() => {
      setThinkingPercent((p) => (p >= 96 ? 96 : Math.min(96, p + 9)));
      setThinkingLogs((prev) => [
        ...prev.slice(-5),
        IRON_MAN_PROCESS_LINES[idx % IRON_MAN_PROCESS_LINES.length],
      ]);
      idx++;
    }, 340);
    return () => clearInterval(t);
  }, [isThinking]);

  // Espectro de frequência HUD no centro
  useEffect(() => {
    const c = spectrumCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const draw = (t: number) => {
      const w = c.width;
      const h = c.height;
      ctx.clearRect(0, 0, w, h);
      const bars = 40;
      const step = w / bars;
      for (let i = 0; i < bars; i++) {
        const energy = isSaraSpeaking
          ? 0.35 + 0.65 * Math.abs(Math.sin(t * 0.009 + i * 0.45))
          : isListening
          ? 0.25 + 0.48 * Math.abs(Math.sin(t * 0.006 + i * 0.3))
          : isThinking
          ? 0.3 + 0.55 * Math.abs(Math.cos(t * 0.011 + i * 0.6))
          : 0.1 + 0.16 * Math.abs(Math.sin(t * 0.002 + i * 0.25));
        const bh = Math.max(2, energy * (h - 4));
        ctx.fillStyle = i % 6 === 0 ? 'rgba(255, 42, 75, 0.85)' : 'rgba(0, 229, 255, 0.8)';
        ctx.fillRect(i * step + 1, (h - bh) / 2, Math.max(2, step - 3), bh);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [isSaraSpeaking, isListening, isThinking]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, streamingReply, isThinking]);

  const handleBargeIn = useCallback(() => {
    interruptSaraAndListen();
    if (!isListening) {
      onToggleMic();
    }
    onNotify('Podes falar agora.');
  }, [isListening, onToggleMic, onNotify]);

  const handleTriggerDailyRoutine = useCallback(() => {
    const pendingTasks = tasks.filter((t) => !t.done).length;
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayEvents = agenda.filter((a) => a.date === todayStr).length;
    const weatherPart =
      weather.loadedFromApi && weather.tempC !== null
        ? `Em ${weather.city} estão ${weather.tempC} graus com ${weather.condition.toLowerCase()}.`
        : `Não consegui obter o clima de ${weather.city} neste momento.`;
    const greeting = `Olá! ${weatherPart} Hoje tens ${pendingTasks} tarefa(s) pendente(s) e ${todayEvents} compromisso(s) na agenda. Por onde começamos?`;
    setMood('happy');
    setConversation((prev) => [
      ...prev.slice(-30),
      {
        id: `jarvis_routine_${Date.now()}`,
        sender: 'sara',
        text: greeting,
        timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setMemory((prev) => ({ ...prev, lastRoutineGreetingDate: todayStr }));
    speakAsSara(greeting, voiceEnabled, { level: 'medium', forceSpeak: true });
  }, [tasks, agenda, weather, voiceEnabled]);

  // Executa ações estruturadas retornadas pela SARA JARVIS
  const applyJarvisActions = useCallback(
    async (actions: JarvisActionPayload[] = [], uploadedDoc?: JarvisDocumentItem | null) => {
      for (const act of actions) {
        switch (act.type) {
          case 'open_panel': {
            updatePanelOpen(true);
            break;
          }
          case 'close_panel': {
            updatePanelOpen(false);
            break;
          }
          case 'add_agenda': {
            onUserActivity?.('agenda');
            const item: JarvisAgendaItem = {
              id: `ag_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
              title: act.title || 'Compromisso',
              date: act.date || new Date().toISOString().slice(0, 10),
              time: act.time || '09:00',
              notes: act.notes,
              completed: false,
              createdAt: new Date().toISOString(),
            };
            setAgenda((prev) => [item, ...prev]);
            setActiveModule('agenda');
            onNotify(`Agenda: ${item.title} (${item.time})`);
            break;
          }
          case 'add_alarm': {
            onUserActivity?.('agenda');
            const item: JarvisAlarmItem = {
              id: `al_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
              time: act.time || '07:00',
              label: act.label || act.title || 'Alarme SARA',
              enabled: true,
            };
            setAlarms((prev) => [item, ...prev]);
            setActiveModule('agenda');
            onNotify(`Alarme ligado para ${item.time}`);
            break;
          }
          case 'add_task': {
            onUserActivity?.('agenda');
            const item: JarvisTaskItem = {
              id: `tsk_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
              title: act.title || 'Nova tarefa',
              priority: act.priority || 'media',
              done: false,
              createdAt: new Date().toISOString(),
            };
            setTasks((prev) => [item, ...prev]);
            setActiveModule('tarefas');
            onNotify(`Tarefa adicionada: ${item.title}`);
            break;
          }
          case 'complete_task': {
            onUserActivity?.('agenda');
            const needle = (act.title || '').toLowerCase();
            setTasks((prev) =>
              prev.map((t) =>
                !needle || t.title.toLowerCase().includes(needle) ? { ...t, done: true } : t
              )
            );
            break;
          }
          case 'play_music': {
            onUserActivity?.('music');
            const query = act.query || act.title || '';
            let track: JarvisTrack | null = act.videoId
              ? {
                  id: `yt_${act.videoId}`,
                  title: act.title || query || 'Música YouTube',
                  artist: act.artist || 'YouTube',
                  videoId: act.videoId,
                  thumbnailUrl: act.thumbnailUrl,
                  watchUrl: act.watchUrl || `https://www.youtube.com/watch?v=${act.videoId}`,
                  durationText: act.durationText,
                  source: 'youtube',
                }
              : null;

            if (!track && query) {
              track = await searchYouTubeTrack(query, 'music');
            }
            if (!track || !track.videoId) {
              onNotify('Não consegui encontrar essa música no YouTube agora.');
              break;
            }
            const finalTrack: JarvisTrack = {
              ...track,
              title: act.title || track.title,
              artist: act.artist || track.artist,
            };
            setPlaylist((prev) => [finalTrack, ...prev.filter((p) => p.id !== finalTrack.id)]);
            setCurrentTrackIndex(0);
            setActiveModule('musica');
            setMediaPaused(false);
            setStageContent({
              id: `stg_music_${Date.now()}`,
              kind: 'music',
              title: finalTrack.title,
              track: finalTrack,
            });
            break;
          }
          case 'play_video': {
            const query = act.query || act.title || '';
            let videoTrack: JarvisTrack | null = act.videoId
              ? {
                  id: `yt_${act.videoId}`,
                  title: act.title || query || 'Vídeo YouTube',
                  artist: act.artist || 'YouTube',
                  videoId: act.videoId,
                  thumbnailUrl: act.thumbnailUrl,
                  watchUrl: act.watchUrl || `https://www.youtube.com/watch?v=${act.videoId}`,
                  durationText: act.durationText,
                  source: 'youtube',
                }
              : null;

            if (!videoTrack && query) {
              videoTrack = await searchYouTubeTrack(query, 'video');
            }
            if (!videoTrack || !videoTrack.videoId) {
              onNotify('Não consegui encontrar esse vídeo no YouTube agora.');
              break;
            }
            setMediaPaused(false);
            setStageContent({
              id: `stg_video_${Date.now()}`,
              kind: 'video',
              title: videoTrack.title,
              track: videoTrack,
            });
            break;
          }
          case 'pause_music': {
            setMediaPaused(true);
            onNotify('Reprodução pausada');
            break;
          }
          case 'resume_music': {
            setMediaPaused(false);
            onNotify('Reprodução retomada');
            break;
          }
          case 'close_media': {
            setStageContent((prev) =>
              prev && (prev.kind === 'music' || prev.kind === 'video') ? null : prev
            );
            setMediaPaused(false);
            onNotify('Player fechado');
            break;
          }
          case 'set_volume': {
            const nextVol =
              typeof act.volume === 'number'
                ? Math.max(0, Math.min(100, act.volume))
                : Math.max(0, Math.min(100, mediaVolumeRef.current + (act.delta || 0)));
            mediaVolumeRef.current = nextVol;
            setMediaVolume(nextVol);
            onNotify(`Volume: ${nextVol}%`);
            break;
          }
          case 'close_stage': {
            setStageContent(null);
            setMediaPaused(false);
            onNotify('Palco fechado');
            break;
          }
          case 'open_module': {
            if (act.moduleTab) {
              setActiveModule(act.moduleTab);
              updatePanelOpen(true);
            }
            break;
          }
          case 'show_3d': {
            onUserActivity?.('calc');
            setStageContent({
              id: `stg_3d_${Date.now()}`,
              kind: '3d',
              title: act.title || 'Modelo 3D Interativo SARA',
              subtitle: act.subtitle || act.notes,
              shape: act.shape || 'cube',
              dimensions: act.dimensions,
              unit: act.unit || 'cm',
              labelLines: act.labelLines,
              description: act.description,
              formulas: Array.isArray(act.formulas) ? act.formulas : undefined,
              steps: Array.isArray(act.steps) ? act.steps : undefined,
              finalAnswer: act.finalAnswer,
              autoRotate: act.autoRotate ?? true,
            });
            break;
          }
          case 'show_svg': {
            if (act.svgCode) {
              setStageContent({
                id: `stg_svg_${Date.now()}`,
                kind: 'svg',
                title: act.title || 'Ilustração Vetorial SARA',
                subtitle: act.notes,
                svgCode: act.svgCode,
                description: act.description,
                formulas: Array.isArray(act.formulas) ? act.formulas : undefined,
                steps: Array.isArray(act.steps) ? act.steps : undefined,
                finalAnswer: act.finalAnswer,
              });
            }
            break;
          }
          case 'show_math': {
            onUserActivity?.('calc');
            setStageContent({
              id: `stg_math_${Date.now()}`,
              kind: 'math',
              title: act.title || 'Resolução Passo a Passo',
              problem: act.problem,
              svgCode: act.svgCode,
              formulas: Array.isArray(act.formulas) ? act.formulas : undefined,
              steps: Array.isArray(act.steps) ? act.steps : [],
              finalAnswer: act.finalAnswer || '',
              notes: act.notes,
            });
            break;
          }
          case 'show_explanation': {
            setStageContent({
              id: `stg_exp_${Date.now()}`,
              kind: 'explanation',
              title: act.title || 'Explicação Visual',
              summary: act.summary || act.description || '',
              visualSvg: act.visualSvg,
              formula: act.formula,
              sections: Array.isArray(act.sections) ? act.sections : [],
              exampleTitle: act.exampleTitle,
              exampleBody: act.exampleBody,
            });
            break;
          }
          case 'show_chart': {
            setStageContent({
              id: `stg_chart_${Date.now()}`,
              kind: 'chart',
              title: act.title || 'Gráfico Analítico',
              subtitle: act.notes,
              chartType: act.chartType || 'bar',
              labels: Array.isArray(act.labels) ? act.labels : [],
              datasets: Array.isArray(act.datasets) ? act.datasets : [],
              summary: act.summary,
            });
            break;
          }
          case 'show_document': {
            onUserActivity?.('docs');
            const docTarget = uploadedDoc || activeDoc;
            const summary = act.summary || '';
            const keyPoints = Array.isArray(act.keyPoints) ? act.keyPoints : [];
            const extractedData = Array.isArray(act.extractedData) ? act.extractedData : [];
            if (docTarget) {
              const enriched: JarvisDocumentItem = {
                ...docTarget,
                summary,
                keyPoints,
                extractedData,
              };
              setActiveDoc(enriched);
              setDocuments((prev) =>
                prev.map((d) => (d.id === enriched.id ? enriched : d))
              );
            }
            setStageContent({
              id: `stg_doc_${Date.now()}`,
              kind: 'document',
              title: act.title || docTarget?.name || 'Análise de Documento',
              docId: docTarget?.id,
              mimeType: docTarget?.mimeType || 'text/plain',
              summary,
              keyPoints,
              extractedData,
              previewUrl: docTarget?.previewBlobUrl,
              rawText: docTarget?.textContent,
            });
            break;
          }
          case 'show_html': {
            onUserActivity?.('docs');
            if (act.html) {
              setStageContent({
                id: `stg_html_${Date.now()}`,
                kind: 'html',
                title: act.title || 'Materialização Visual',
                subkind: act.subkind || 'visual',
                html: act.html,
              });
            }
            break;
          }
          case 'show_ideation': {
            setStageContent({
              id: `stg_idea_${Date.now()}`,
              kind: 'ideation',
              title: act.title || 'Conceitos e Ideias',
              subtitle: act.notes || act.subtitle,
              cards: (Array.isArray(act.cards) ? act.cards : []).map((c: any) => ({
                title: String(c?.title || ''),
                tag: String(c?.tag || ''),
                detail: String(c?.detail || ''),
                audioText: c?.audioText ? String(c.audioText) : undefined,
                audioLang: c?.audioLang || undefined,
              })),
            });
            break;
          }
          case 'show_quiz': {
            setStageContent({
              id: `stg_quiz_${Date.now()}`,
              kind: 'quiz',
              title: act.title || 'Teste Rápido SARA',
              subtitle: act.subtitle || act.notes,
              questions: Array.isArray(act.questions) ? act.questions : [],
            });
            break;
          }
          case 'show_flashcards': {
            setStageContent({
              id: `stg_flash_${Date.now()}`,
              kind: 'flashcards',
              title: act.title || 'Flashcards de Estudo',
              subtitle: act.subtitle || act.notes,
              cards: (Array.isArray(act.cards) ? act.cards : []).map((c: any) => ({
                front: String(c?.front || ''),
                back: String(c?.back || ''),
                hint: c?.hint ? String(c.hint) : undefined,
                lang: c?.lang || undefined,
              })),
            });
            break;
          }
          case 'read_aloud': {
            const toRead = (act.text || act.summary || '').trim();
            if (toRead) {
              startVoiceReading(act.title || 'Leitura SARA', toRead);
              onNotify('Leitura contínua em voz alta ativa');
            }
            break;
          }
          case 'remember_fact': {
            const fact = (act.fact || '').trim();
            if (fact && !/\b(luanda|angola|matola)\b/i.test(fact)) {
              setMemory((prev) => ({
                ...prev,
                facts: prev.facts.includes(fact) ? prev.facts : [...prev.facts, fact].slice(-25),
              }));
              onNotify(`Memória guardada: ${fact}`);
            }
            break;
          }
          case 'toggle_focus': {
            const next = typeof act.enabled === 'boolean' ? act.enabled : !focusMode;
            setFocusMode(next);
            setMood(next ? 'focus' : 'idle');
            onNotify(next ? 'Modo Foco ativo' : 'Modo Foco desligado');
            break;
          }
          case 'switch_mode': {
            if (act.target === 'builder') {
              onSwitchMode('builder');
            }
            break;
          }
          case 'build_in_builder': {
            const buildGoal = (act.goal || '').trim();
            if (buildGoal && onTriggerBackgroundBuild) {
              void onTriggerBackgroundBuild(buildGoal, 'text');
            }
            break;
          }
        }
      }
    },
    [activeDoc, focusMode, onNotify, onSwitchMode, onTriggerBackgroundBuild, updatePanelOpen]
  );

  const sendJarvisPrompt = useCallback(
    async (rawText: string, source: 'voice' | 'text' = 'text') => {
      const clean = rawText.trim();
      const docToSend = pendingDoc;
      if (!clean && !docToSend) return;

      // PROTEÇÃO TOTAL (Lealdade, Admin Invisível, Segredo & Privacidade) para não-donos antes de qualquer comando ou IA
      if (clean) {
        const guard = evaluateNonOwnerGuard(clean, session);
        if (guard.intercepted && guard.reply) {
          const guardTime = new Date().toLocaleTimeString('pt-PT', {
            hour: '2-digit',
            minute: '2-digit',
          });
          if (source === 'text') setInputText('');
          setConversation((prev) => [
            ...prev.slice(-28),
            { id: `usr_g_${Date.now()}`, sender: 'user', text: clean, timestamp: guardTime },
            { id: `sara_g_${Date.now()}`, sender: 'sara', text: guard.reply!, timestamp: guardTime },
          ]);
          speakAsSara(guard.voiceSummary || guard.reply, voiceEnabled, {
            level: 'short',
            forceSpeak: source === 'voice' || !isSaraSilenced,
          });
          return;
        }
      }

      // TIPO A - [SISTEMA]: Verifica comandos determinísticos antes da IA
      if (clean && !docToSend && onExecuteSystemCommand) {
        const localCmd = parseVoiceCommand(clean, {
          workspaceMode: 'jarvis',
          hasActiveMedia: stageContent?.kind === 'music' || stageContent?.kind === 'video',
          isMediaPaused: mediaPaused,
          hasActiveStage: Boolean(stageContent),
          hasActiveReading: readingStatus.active,
          isReadingPaused: readingStatus.paused,
        });
        if (localCmd.type === 'open_admin') {
          if (session.isOwner && onRequestAdmin) {
            if (source === 'text') setInputText('');
            onRequestAdmin();
            speakAsSara('Painel Admin aberto, chefe.', voiceEnabled, {
              level: 'short',
              forceSpeak: true,
            });
            return;
          }
        }
        if (localCmd.type !== 'prompt') {
          const handled = await onExecuteSystemCommand(localCmd, clean);
          if (handled) {
            if (source === 'text') setInputText('');
            return;
          }
        }
      }

      // CONEXÃO ASSISTENTE -> BUILDER EM 2.º PLANO: pedidos de site/app completo constroem no Builder sem sair do Assistente
      if (clean && !docToSend && onTriggerBackgroundBuild && isFullBuilderAppRequest(clean)) {
        onUserActivity?.('builder');
        const nowTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        const ackSpeech = getBackgroundBuildAckSpeech(clean);
        if (source === 'text') {
          setInputText('');
          setConversation((prev) => [
            ...prev.slice(-28),
            { id: `usr_bg_${Date.now()}`, sender: 'user', text: clean, timestamp: nowTime },
            {
              id: `sara_bg_ack_${Date.now()}`,
              sender: 'sara',
              text: 'Builder em segundo plano: a construir o pedido mantendo o Assistente livre.',
              timestamp: nowTime,
            },
          ]);
        } else {
          setConversation((prev) => [
            ...prev.slice(-28),
            {
              id: `sara_bg_ack_${Date.now()}`,
              sender: 'sara',
              text: 'Builder em segundo plano: a construir o projeto pedido.',
              timestamp: nowTime,
            },
          ]);
        }
        speakAsSara(ackSpeech, voiceEnabled, {
          level: 'short',
          forceSpeak: source === 'voice' || !isSaraSilenced,
        });
        void onTriggerBackgroundBuild(clean, source);
        return;
      }

      onUserActivity?.('chat');

      const userLabel = clean || `Analisar documento: ${docToSend?.name}`;
      const nowTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      const wantsFullTextInChat =
        /(manda\s+(tamb[eé]m\s+)?em\s+texto|escreve\s+no\s+chat|manda\s+por\s+escrito|quero\s+em\s+texto|detalha\s+no\s+chat|texto\s+no\s+chat)/i.test(
          userLabel
        );

      const userHistoryEntry: JarvisConversationEntry = {
        id: `usr_j_${Date.now()}`,
        sender: 'user',
        text: userLabel,
        timestamp: nowTime,
      };
      aiHistoryRef.current = [...aiHistoryRef.current.slice(-18), userHistoryEntry];

      if (source === 'text' || wantsFullTextInChat) {
        setConversation((prev) => [...prev, userHistoryEntry]);
      }

      if (source === 'text') setInputText('');
      if (docToSend) {
        onUserActivity?.('docs');
        setDocuments((prev) => [docToSend, ...prev]);
        setActiveDoc(docToSend);
        setPendingDoc(null);
      }

      setIsThinking(true);
      setStreamingReply(null);
      setMood('thinking');

      let spokenDuringStream = false;

      const res = await askJarvisAssistantStream(
        {
          prompt: userLabel,
          history: aiHistoryRef.current.slice(-10),
          memory,
          agenda,
          tasks,
          alarms,
          weather,
          telemetry,
          mediaState: currentMediaState,
          userIdentity,
          builderContext: {
            activeProjectName: activeBuilderProjectName,
            activeProjectFiles: activeBuilderFiles,
            isBuilding: liveBuild?.isBuilding,
            phase: liveBuild?.phase,
            progressPct: liveBuild?.isBuilding ? builderProgressPct : undefined,
            currentStepLabel: liveBuild?.currentStepLabel,
            activeFile: liveBuild?.activeFile,
            elapsedSeconds: liveBuild?.elapsedSeconds,
          },
          documentAttachment: docToSend,
          activeDocument: docToSend || activeDoc,
        },
        {
          onSpeakReady: (speakText) => {
            if (!speakText || spokenDuringStream) return;
            spokenDuringStream = true;
            speakAsSara(speakText, voiceEnabled, {
              level: 'full',
              isQuestionReply: true,
              forceSpeak: source === 'voice' || !isSaraSilenced,
            });
          },
          onReplyPartial: (partialReply) => {
            if (wantsFullTextInChat) {
              setStreamingReply(sanitizeAssistantPlainText(partialReply));
            }
          },
        }
      );

      setIsThinking(false);
      setStreamingReply(null);
      setMood(res.mood && res.mood !== 'speaking' ? res.mood : 'idle');

      const todayKey = new Date().toISOString().slice(0, 10);
      setMemory((prev) => ({
        ...prev,
        lastVisitDate: todayKey,
        lastTopic: userLabel.slice(0, 80),
        lastActiveProjectName: activeBuilderProjectName || prev.lastActiveProjectName,
      }));

      const cleanFinalReply = sanitizeAssistantPlainText(res.reply) || 'Feito.';
      const chatEntryText = wantsFullTextInChat
        ? cleanFinalReply
        : buildCompactChatSummary({
            chatSummary: res.chatSummary,
            reply: cleanFinalReply,
            actions: res.actions,
          });

      const saraTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      aiHistoryRef.current = [
        ...aiHistoryRef.current.slice(-18),
        {
          id: `sara_mem_${Date.now()}`,
          sender: 'sara',
          text: cleanFinalReply,
          timestamp: saraTime,
        },
      ];

      setConversation((prev) => [
        ...prev,
        {
          id: `sara_j_${Date.now()}`,
          sender: 'sara',
          text: chatEntryText,
          timestamp: saraTime,
        },
      ]);

      const startedLongReading = Boolean(
        res.actions?.some((a) => a.type === 'read_aloud' && (a.text || a.summary))
      );
      await applyJarvisActions(res.actions, docToSend);

      if (!spokenDuringStream && !startedLongReading) {
        const speakText = sanitizeAssistantPlainText(res.voiceSummary || cleanFinalReply);
        speakAsSara(speakText, voiceEnabled, {
          level: 'full',
          isQuestionReply: true,
          forceSpeak: source === 'voice' || !isSaraSilenced,
        });
      }
    },
    [
      session,
      userIdentity,
      onUserActivity,
      onRequestAdmin,
      pendingDoc,
      onExecuteSystemCommand,
      stageContent,
      mediaPaused,
      memory,
      agenda,
      tasks,
      alarms,
      weather,
      telemetry,
      currentMediaState,
      activeBuilderProjectName,
      activeBuilderFiles,
      liveBuild,
      builderProgressPct,
      readingStatus.active,
      readingStatus.paused,
      onTriggerBackgroundBuild,
      activeDoc,
      applyJarvisActions,
      voiceEnabled,
      isSaraSilenced,
    ]
  );

  useEffect(() => {
    externalCommandRef.current = sendJarvisPrompt;
    return () => {
      externalCommandRef.current = null;
    };
  }, [sendJarvisPrompt, externalCommandRef]);

  useEffect(() => {
    externalFocusCommandRef.current = (enabled: boolean) => {
      setFocusMode(enabled);
      setMood(enabled ? 'focus' : 'idle');
    };
    return () => {
      externalFocusCommandRef.current = null;
    };
  }, [externalFocusCommandRef]);

  useEffect(() => {
    externalModuleRef.current = (tab: JarvisModuleTab) => {
      setActiveModule(tab);
      updatePanelOpen(true);
    };
    return () => {
      externalModuleRef.current = null;
    };
  }, [externalModuleRef, updatePanelOpen]);

  useEffect(() => {
    externalRepeatRef.current = () => {
      const lastSara = [...conversation].reverse().find((c) => c.sender === 'sara');
      if (lastSara) {
        speakAsSara(lastSara.text, true, { level: 'full', forceSpeak: true });
      } else {
        speakAsSara('Ainda não falámos nesta sessão. O que queres fazer?', true, {
          level: 'short',
          forceSpeak: true,
        });
      }
    };
    return () => {
      externalRepeatRef.current = null;
    };
  }, [conversation, externalRepeatRef]);

  useEffect(() => {
    externalContinueRef.current = async () => {
      await sendJarvisPrompt(
        'Continua e aprofunda o ponto anterior de forma clara e natural.',
        'voice'
      );
    };
    return () => {
      externalContinueRef.current = null;
    };
  }, [sendJarvisPrompt, externalContinueRef]);

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const doc = await readDocumentFile(file);
      setPendingDoc(doc);
      setActiveModule('documentos');
      onNotify(`Documento carregado: ${doc.name}`);

      if (!inputText.trim()) {
        setDocuments((prev) => [doc, ...prev]);
        setActiveDoc(doc);
        setPendingDoc(null);
        setIsThinking(true);
        setStreamingReply(null);
        setMood('thinking');

        setConversation((prev) => [
          ...prev,
          {
            id: `usr_doc_${Date.now()}`,
            sender: 'user',
            text: `Documento anexado: ${doc.name}`,
            timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);

        let spokenDocStream = false;
        onUserActivity?.('docs');
        const res = await askJarvisAssistantStream(
          {
            prompt: `Analisa o documento "${doc.name}" em detalhe: faz um resumo executivo, lista 4-6 pontos principais e extrai os dados importantes em formato estruturado usando a ação show_document.`,
            history: conversation.slice(-6),
            memory,
            agenda,
            tasks,
            alarms,
            weather,
            telemetry,
            userIdentity,
            documentAttachment: doc,
          },
          {
            onSpeakReady: (speakText) => {
              if (!speakText || spokenDocStream) return;
              spokenDocStream = true;
              speakAsSara(speakText, voiceEnabled, {
                level: 'medium',
                forceSpeak: !isSaraSilenced,
              });
            },
            onReplyPartial: (partialReply) => {
              setStreamingReply(sanitizeAssistantPlainText(partialReply));
            },
          }
        );

        setIsThinking(false);
        setStreamingReply(null);
        setMood(res.mood && res.mood !== 'speaking' ? res.mood : 'idle');
        const cleanDocReply = sanitizeAssistantPlainText(res.reply) || 'Documento analisado.';
        setConversation((prev) => [
          ...prev,
          {
            id: `sara_doc_${Date.now()}`,
            sender: 'sara',
            text: cleanDocReply,
            timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        await applyJarvisActions(res.actions, doc);
        if (!spokenDocStream) {
          speakAsSara(sanitizeAssistantPlainText(res.voiceSummary || cleanDocReply), voiceEnabled, {
            level: 'medium',
            forceSpeak: !isSaraSilenced,
          });
        }
      }
    } catch {
      onNotify('Não foi possível ler este ficheiro.');
    }
  };

  const handlePlayTrack = (track: JarvisTrack, idx: number) => {
    setCurrentTrackIndex(idx);
    setMediaPaused(false);
    setStageContent({
      id: `stg_music_${track.id}_${Date.now()}`,
      kind: 'music',
      title: track.title,
      track,
    });
  };

  const handleNextTrack = () => {
    if (playlist.length === 0) return;
    const nextIdx = (currentTrackIndex + 1) % playlist.length;
    handlePlayTrack(playlist[nextIdx], nextIdx);
  };

  const effectiveMood: JarvisHeadMood = isThinking
    ? 'thinking'
    : isSaraSpeaking
    ? 'speaking'
    : isListening
    ? 'listening'
    : focusMode
    ? 'focus'
    : mood;

  const moduleTabs: Array<{ id: JarvisModuleTab; label: string; icon: React.ReactNode }> = [
    { id: 'voz', label: 'Voz', icon: <Mic className="w-3.5 h-3.5" /> },
    { id: 'sistema', label: 'Sistema', icon: <Cpu className="w-3.5 h-3.5" /> },
    { id: 'musica', label: 'Música', icon: <Music2 className="w-3.5 h-3.5" /> },
    { id: 'agenda', label: 'Agenda', icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'documentos', label: 'Docs', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'tarefas', label: 'Tarefas', icon: <CheckSquare className="w-3.5 h-3.5" /> },
  ];

  const todayFormatted = now.toLocaleDateString('pt-PT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  const timeFormatted = now.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const shortCityName = weather.city.split(',')[0].trim() || 'Inhambane Cidade';
  const jsHeapPct =
    telemetry.jsHeapUsedMb !== null && telemetry.jsHeapLimitMb
      ? Math.min(100, Math.round((telemetry.jsHeapUsedMb / telemetry.jsHeapLimitMb) * 100))
      : null;

  // Métricas visuais animadas dos anéis de NÚCLEO SISTEMA baseadas em estado real
  const cpuPct = useMemo(() => {
    const base = isThinking ? 76 : isSaraSpeaking ? 52 : isListening ? 38 : 26;
    const wave = Math.round(Math.sin(hudPulseTick * 0.85) * 6 + Math.cos(hudPulseTick * 0.4) * 3);
    return Math.max(12, Math.min(98, base + wave));
  }, [hudPulseTick, isThinking, isSaraSpeaking, isListening]);

  const memPct = useMemo(() => {
    if (jsHeapPct !== null) return Math.max(18, Math.min(95, jsHeapPct));
    return 48 + Math.round(Math.sin(hudPulseTick * 0.35) * 3);
  }, [jsHeapPct, hudPulseTick]);

  const coreTempC = useMemo(() => {
    const base = isThinking ? 58 : isSaraSpeaking ? 51 : 44;
    return base + (hudPulseTick % 3);
  }, [hudPulseTick, isThinking, isSaraSpeaking]);

  const neuralPct = isThinking ? thinkingPercent || 78 : isSaraSpeaking ? 94 : 64 + (hudPulseTick % 7);

  // Calendário mensal real
  const calendarCells = useMemo(() => {
    const yr = now.getFullYear();
    const mo = now.getMonth();
    const firstWeekday = new Date(yr, mo, 1).getDay();
    const daysInMonth = new Date(yr, mo + 1, 0).getDate();
    const cells: Array<number | null> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [now]);

  const todayIso = now.toISOString().slice(0, 10);
  const todayAgendaItems = useMemo(
    () => agenda.filter((a) => a.date === todayIso).slice(0, 3),
    [agenda, todayIso]
  );

  const activeHeadline =
    hudFeed.news.length > 0
      ? hudFeed.news[newsIndex % hudFeed.news.length]
      : null;

  const renderRingGauge = (
    valueText: string,
    pct: number,
    label: string,
    colorHex: string
  ) => {
    const r = 21;
    const circ = 2 * Math.PI * r;
    const clamped = Math.max(4, Math.min(100, pct));
    const offset = circ - (clamped / 100) * circ;
    return (
      <div className="flex flex-col items-center">
        <div className="relative w-14 h-14 flex items-center justify-center">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 54 54">
            <circle
              cx="27"
              cy="27"
              r={r}
              fill="none"
              stroke="rgba(0, 229, 255, 0.14)"
              strokeWidth="4"
            />
            <circle
              cx="27"
              cy="27"
              r={r}
              fill="none"
              stroke={colorHex}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              className="transition-all duration-700"
            />
          </svg>
          <span className="absolute text-[10px] font-mono font-bold text-white tabular-nums">
            {valueText}
          </span>
        </div>
        <span className="text-[9px] font-mono tracking-widest text-slate-400 mt-0.5 uppercase">
          {label}
        </span>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#020612] text-white overflow-hidden relative">
      {/* Alarme a tocar no topo */}
      {activeRingingAlarm && (
        <div className="z-50 px-4 py-2 bg-gradient-to-r from-[#FF2A4B]/30 via-[#081529] to-[#00E5FF]/25 border-b border-[#FF2A4B] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white">
            <BellRing className="w-4 h-4 text-[#FF2A4B] animate-bounce" />
            <span>
              ALARME ATIVO ({activeRingingAlarm.time}): {activeRingingAlarm.label}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveRingingAlarm(null)}
            className="px-3 py-1 rounded-lg bg-[#FF2A4B] text-white text-xs font-bold cursor-pointer hover:opacity-90"
          >
            Dispensar
          </button>
        </div>
      )}

      {/* GAVETA DESLIZANTE ÚNICA [☰ PAINEL] — Módulos & Navegação fora da vista principal */}
      {isPanelOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/65"
            onClick={() => updatePanelOpen(false)}
          />
          <div
            ref={drawerRef}
            className="order-first w-[330px] sm:w-[365px] max-w-[92vw] h-full bg-[#040B1A] border-r border-cyan-500/35 shadow-[0_0_40px_rgba(0,229,255,0.22)] flex flex-col overflow-hidden"
          >
            {/* Cabeçalho da gaveta */}
            <div className="px-4 py-3 border-b border-cyan-500/25 bg-[#030814] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-[#00E5FF]" />
                <span className="text-xs font-mono font-bold tracking-widest uppercase text-cyan-200">
                  PAINEL DE CONTROLO SARA
                </span>
              </div>
              <button
                type="button"
                onClick={() => updatePanelOpen(false)}
                className="p-1.5 rounded-lg bg-[#08152B] border border-cyan-500/25 text-slate-300 hover:text-white cursor-pointer"
                title="Fechar painel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navegação de Sistema: Assistente / Builder (+ Config só para o Dono) */}
            <div
              className={`p-2.5 grid gap-1.5 border-b border-cyan-500/20 bg-[#030815] shrink-0 ${
                session.isOwner ? 'grid-cols-3' : 'grid-cols-2'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setFocusMode(false);
                  updatePanelOpen(false);
                }}
                className="py-2 px-2 rounded-xl bg-cyan-500/15 border border-cyan-400/50 text-cyan-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-cyan-500/25"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Assistente</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  updatePanelOpen(false);
                  onSwitchMode('builder');
                }}
                className="py-2 px-2 rounded-xl bg-[#071126] border border-cyan-500/25 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:border-cyan-400"
              >
                <Hammer className="w-3.5 h-3.5 text-rose-400" />
                <span>Builder</span>
              </button>
              {session.isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    updatePanelOpen(false);
                    onOpenSettings?.();
                  }}
                  className="py-2 px-2 rounded-xl bg-[#071126] border border-cyan-500/25 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:border-cyan-400"
                >
                  <Settings className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Config</span>
                </button>
              )}
            </div>

            {/* Abas dos 6 módulos dentro da gaveta */}
            <div className="p-2 grid grid-cols-3 gap-1.5 border-b border-cyan-500/20 bg-[#040915] shrink-0">
              {moduleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveModule(tab.id)}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                    activeModule === tab.id
                      ? 'bg-gradient-to-r from-cyan-500/20 to-[#FF2A4B]/20 border-[#00E5FF]/60 text-cyan-200 shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                      : 'bg-[#071022] border-cyan-500/15 text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Conteúdo interativo do módulo ativo */}
            <div className="flex-1 min-h-0 overflow-y-auto sara-scroll p-3 space-y-3">
              {activeModule === 'voz' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-[#071126] border border-cyan-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">
                        Canal Vocal Neural
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSaraSpeaking
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                            : isListening
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isSaraSpeaking ? 'A FALAR' : isListening ? 'ESCUTA ATIVA' : 'EM ESPERA'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={onToggleMic}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer border ${
                          isListening
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                            : 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 hover:bg-cyan-500/30'
                        }`}
                      >
                        {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                        <span>{isListening ? 'Desligar Mic' : 'Ativar Mãos-Livres'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={onSilenceSara}
                        className="px-3 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold hover:bg-rose-500/25 cursor-pointer"
                        title="Calar / Reativar voz"
                      >
                        {isSaraSilenced ? (
                          <VolumeX className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {isSaraSpeaking && (
                      <button
                        type="button"
                        onClick={handleBargeIn}
                        className="w-full py-2 rounded-xl bg-rose-500/20 border border-rose-400/60 text-rose-200 text-xs font-bold flex items-center justify-center gap-2 hover:bg-rose-500/30 cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Interromper SARA e Falar</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-rose-300">
                      Comandos Rápidos
                    </div>
                    {[
                      'Explica física quântica de forma simples e depois profunda',
                      'Faz-me um teste de 4 perguntas sobre eletricidade básica',
                      'Cria 5 flashcards de inglês para negócios com pronúncia',
                      'Notícias de Moçambique e do mundo resumidas em 1 minuto',
                      'Quanto vale 1500 Meticais em ZAR, Dólar e Euro hoje?',
                      'Cria uma planilha de controlo de vendas e lucro em HTML',
                      'Toca música de Alan Walker no YouTube',
                    ].map((cmd) => (
                      <button
                        key={cmd}
                        type="button"
                        onClick={() => {
                          updatePanelOpen(false);
                          void sendJarvisPrompt(cmd, 'text');
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl bg-[#071126] border border-cyan-500/20 hover:border-cyan-400/60 text-xs text-slate-200 hover:text-cyan-200 transition cursor-pointer"
                      >
                        {cmd}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeModule === 'sistema' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-[#071126] border border-cyan-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">
                        Telemetria do Dispositivo
                      </span>
                      <Activity className="w-4 h-4 text-rose-400" />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-xl bg-[#040916] border border-cyan-500/20">
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Cpu className="w-3 h-3 text-cyan-300" />
                          <span>CPU Lógica</span>
                        </div>
                        <div className="font-mono font-bold text-cyan-200 mt-0.5">
                          {telemetry.cpuCores ? `${telemetry.cpuCores} núcleos` : 'N/D'}
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-[#040916] border border-cyan-500/20">
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <HardDrive className="w-3 h-3 text-rose-300" />
                          <span>RAM Dispositivo</span>
                        </div>
                        <div className="font-mono font-bold text-rose-200 mt-0.5">
                          {telemetry.deviceMemoryGb ? `~${telemetry.deviceMemoryGb} GB` : 'N/D'}
                        </div>
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-[#040916] border border-cyan-500/20 flex items-center justify-between text-[11px]">
                      <span className="text-slate-300">Heap JS da Aba</span>
                      <span className="font-mono text-cyan-300">
                        {telemetry.jsHeapUsedMb !== null && telemetry.jsHeapLimitMb !== null
                          ? `${telemetry.jsHeapUsedMb} / ${telemetry.jsHeapLimitMb} MB (${jsHeapPct}%)`
                          : 'N/D neste navegador'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        updatePanelOpen(false);
                        handleTriggerDailyRoutine();
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-cyan-500/15 border border-cyan-400/50 text-cyan-200 text-xs font-bold flex items-center justify-center gap-2 hover:bg-cyan-500/25 cursor-pointer"
                    >
                      <Sun className="w-4 h-4" />
                      <span>Rotina Diária & Resumo do Dia</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFocusMode(!focusMode);
                        setMood(!focusMode ? 'focus' : 'idle');
                        updatePanelOpen(false);
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-rose-500/15 border border-rose-400/50 text-rose-200 text-xs font-bold flex items-center justify-center gap-2 hover:bg-rose-500/25 cursor-pointer"
                    >
                      <Focus className="w-4 h-4" />
                      <span>{focusMode ? 'Sair do Modo Foco' : 'Ativar Modo Foco'}</span>
                    </button>
                  </div>
                </div>
              )}

              {activeModule === 'agenda' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-2xl bg-[#071126] border border-cyan-500/25 space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">
                      Novo Compromisso
                    </div>
                    <input
                      type="text"
                      value={newAgendaTitle}
                      onChange={(e) => setNewAgendaTitle(e.target.value)}
                      placeholder="Ex: Reunião de arquitetura"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#030815] border border-cyan-500/30 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={newAgendaDate}
                        onChange={(e) => setNewAgendaDate(e.target.value)}
                        className="px-2 py-1.5 rounded-lg bg-[#030815] border border-cyan-500/30 text-xs text-white"
                      />
                      <input
                        type="time"
                        value={newAgendaTime}
                        onChange={(e) => setNewAgendaTime(e.target.value)}
                        className="px-2 py-1.5 rounded-lg bg-[#030815] border border-cyan-500/30 text-xs text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newAgendaTitle.trim()) return;
                        setAgenda((prev) => [
                          {
                            id: `ag_${Date.now()}`,
                            title: newAgendaTitle.trim(),
                            date: newAgendaDate,
                            time: newAgendaTime,
                            completed: false,
                            createdAt: new Date().toISOString(),
                          },
                          ...prev,
                        ]);
                        setNewAgendaTitle('');
                        onNotify('Compromisso guardado na agenda!');
                      }}
                      className="w-full py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar à Agenda</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                      Agenda ({agenda.length})
                    </div>
                    {agenda.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">
                        Agenda vazia. Pede por voz ou adiciona acima.
                      </p>
                    ) : (
                      agenda.map((ag) => (
                        <div
                          key={ag.id}
                          className="p-2.5 rounded-xl bg-[#071126] border border-cyan-500/20 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">
                              {ag.title}
                            </div>
                            <div className="text-[10px] font-mono text-cyan-300">
                              {ag.date} • {ag.time}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAgenda((prev) => prev.filter((x) => x.id !== ag.id))}
                            className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-3 rounded-2xl bg-[#071126] border border-rose-500/30 space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-rose-300">
                      <AlarmClock className="w-3.5 h-3.5" />
                      <span>Alarmes & Despertador</span>
                    </div>
                    <div className="grid grid-cols-[90px_1fr] gap-2">
                      <input
                        type="time"
                        value={newAlarmTime}
                        onChange={(e) => setNewAlarmTime(e.target.value)}
                        className="px-2 py-1.5 rounded-lg bg-[#030815] border border-rose-500/30 text-xs text-white"
                      />
                      <input
                        type="text"
                        value={newAlarmLabel}
                        onChange={(e) => setNewAlarmLabel(e.target.value)}
                        placeholder="Etiqueta do alarme"
                        className="px-2.5 py-1.5 rounded-lg bg-[#030815] border border-rose-500/30 text-xs text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAlarms((prev) => [
                          {
                            id: `al_${Date.now()}`,
                            time: newAlarmTime,
                            label: newAlarmLabel.trim() || 'Alarme SARA',
                            enabled: true,
                          },
                          ...prev,
                        ]);
                        onNotify(`Alarme definido para ${newAlarmTime}`);
                      }}
                      className="w-full py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-200 text-xs font-bold cursor-pointer"
                    >
                      Ativar Alarme
                    </button>
                    {alarms.map((al) => (
                      <div
                        key={al.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#040915] border border-rose-500/20 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setAlarms((prev) =>
                              prev.map((x) => (x.id === al.id ? { ...x, enabled: !x.enabled } : x))
                            )
                          }
                          className="flex items-center gap-2 text-left cursor-pointer"
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              al.enabled ? 'bg-emerald-400' : 'bg-slate-600'
                            }`}
                          />
                          <span className="font-mono font-bold text-cyan-200">{al.time}</span>
                          <span className="text-slate-300 truncate max-w-[110px]">{al.label}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAlarms((prev) => prev.filter((x) => x.id !== al.id))}
                          className="text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeModule === 'musica' && (
                <div className="space-y-3">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const q = musicSearch.trim();
                      if (!q || isSearchingMusic) return;
                      setIsSearchingMusic(true);
                      const tr = await searchYouTubeTrack(q, 'music');
                      setIsSearchingMusic(false);
                      if (!tr || !tr.videoId) {
                        onNotify('Não consegui encontrar essa música no YouTube agora.');
                        return;
                      }
                      setPlaylist((prev) => [tr, ...prev.filter((x) => x.id !== tr.id)]);
                      setCurrentTrackIndex(0);
                      setMusicSearch('');
                      setStageContent({
                        id: `stg_music_${Date.now()}`,
                        kind: 'music',
                        title: tr.title,
                        track: tr,
                      });
                      updatePanelOpen(false);
                    }}
                    className="flex gap-1.5"
                  >
                    <input
                      type="text"
                      value={musicSearch}
                      onChange={(e) => setMusicSearch(e.target.value)}
                      placeholder="Pesquisar música real no YouTube..."
                      className="flex-1 px-2.5 py-2 rounded-xl bg-[#030815] border border-cyan-500/30 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="submit"
                      disabled={isSearchingMusic || !musicSearch.trim()}
                      className="px-3 py-2 rounded-xl bg-cyan-500/25 border border-cyan-400/60 text-cyan-200 text-xs font-bold cursor-pointer disabled:opacity-45"
                    >
                      {isSearchingMusic ? '...' : 'Tocar'}
                    </button>
                  </form>

                  <div className="space-y-1.5">
                    {playlist.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">
                        Sem músicas na fila. Pede qualquer música por voz ou pesquisa acima.
                      </p>
                    ) : (
                      playlist.map((tr, idx) => (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() => {
                            handlePlayTrack(tr, idx);
                            updatePanelOpen(false);
                          }}
                          className={`w-full p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                            stageContent?.kind === 'music' && stageContent.track.id === tr.id
                              ? 'bg-cyan-500/20 border-cyan-400 text-white'
                              : 'bg-[#071126] border-cyan-500/20 text-slate-300 hover:border-cyan-400/50'
                          }`}
                        >
                          <Music2 className="w-4 h-4 text-rose-400 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold truncate">{tr.title}</div>
                            <div className="text-[10px] text-cyan-300/80 truncate">
                              {tr.artist}
                              {tr.durationText ? ` • ${tr.durationText}` : ''}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeModule === 'documentos' && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      updatePanelOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-rose-500/20 border border-dashed border-cyan-400/60 text-xs font-bold text-cyan-200 flex items-center justify-center gap-2 hover:bg-cyan-500/25 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Carregar PDF, Imagem ou Texto</span>
                  </button>

                  {documents.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">
                      Carrega qualquer PDF, contrato, fatura ou imagem para análise instantânea.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => {
                            setActiveDoc(doc);
                            setStageContent({
                              id: `stg_doc_open_${doc.id}`,
                              kind: 'document',
                              title: doc.name,
                              docId: doc.id,
                              mimeType: doc.mimeType,
                              summary:
                                doc.summary ||
                                'Documento pronto para consulta. Faz qualquer pergunta abaixo.',
                              keyPoints: doc.keyPoints || [],
                              extractedData: doc.extractedData || [],
                              previewUrl: doc.previewBlobUrl,
                              rawText: doc.textContent,
                            });
                            updatePanelOpen(false);
                          }}
                          className="w-full p-2.5 rounded-xl bg-[#071126] border border-cyan-500/25 hover:border-cyan-400 text-left transition cursor-pointer"
                        >
                          <div className="text-xs font-bold text-white truncate">{doc.name}</div>
                          <div className="text-[10px] text-cyan-300/75 mt-0.5 truncate">
                            {doc.summary ? doc.summary.slice(0, 75) + '...' : 'Pronto para análise'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeModule === 'tarefas' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-[#071126] border border-cyan-500/25 space-y-2">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Nova tarefa..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#030815] border border-cyan-500/30 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                    <div className="flex gap-2">
                      <select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value as any)}
                        className="px-2 py-1.5 rounded-lg bg-[#030815] border border-cyan-500/30 text-xs text-cyan-200"
                      >
                        <option value="alta">Alta</option>
                        <option value="media">Média</option>
                        <option value="baixa">Baixa</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newTaskTitle.trim()) return;
                          setTasks((prev) => [
                            {
                              id: `tsk_${Date.now()}`,
                              title: newTaskTitle.trim(),
                              priority: newTaskPriority,
                              done: false,
                              createdAt: new Date().toISOString(),
                            },
                            ...prev,
                          ]);
                          setNewTaskTitle('');
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-xs font-bold cursor-pointer"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {tasks.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">
                        Sem tarefas pendentes.
                      </p>
                    ) : (
                      tasks.map((t) => (
                        <div
                          key={t.id}
                          className="p-2.5 rounded-xl bg-[#071126] border border-cyan-500/20 flex items-center justify-between gap-2"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setTasks((prev) =>
                                prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x))
                              )
                            }
                            className="flex items-center gap-2 text-left min-w-0 flex-1 cursor-pointer"
                          >
                            {t.done ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-cyan-400 shrink-0" />
                            )}
                            <span
                              className={`text-xs truncate ${
                                t.done ? 'line-through text-slate-500' : 'text-white'
                              }`}
                            >
                              {t.title}
                            </span>
                          </button>
                          <span
                            className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${
                              t.priority === 'alta'
                                ? 'bg-rose-500/20 text-rose-300'
                                : t.priority === 'media'
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {t.priority}
                          </span>
                          <button
                            type="button"
                            onClick={() => setTasks((prev) => prev.filter((x) => x.id !== t.id))}
                            className="text-slate-500 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Abas em Telemóvel (< lg) */}
      {!focusMode && (
        <nav className="lg:hidden grid grid-cols-3 bg-[#050C1D] border-b border-cyan-500/25 shrink-0">
          <button
            type="button"
            onClick={() => setMobileSection('stage')}
            className={`py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
              mobileSection === 'stage'
                ? 'border-[#00E5FF] text-cyan-300 bg-[#08152E]'
                : 'border-transparent text-slate-400'
            }`}
          >
            Holograma 3D
          </button>
          <button
            type="button"
            onClick={() => setMobileSection('hud')}
            className={`py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
              mobileSection === 'hud'
                ? 'border-[#FF2A4B] text-rose-300 bg-[#08152E]'
                : 'border-transparent text-slate-400'
            }`}
          >
            Telemetria & Clima
          </button>
          <button
            type="button"
            onClick={() => setMobileSection('log')}
            className={`py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
              mobileSection === 'log'
                ? 'border-[#00E5FF] text-cyan-300 bg-[#08152E]'
                : 'border-transparent text-slate-400'
            }`}
          >
            Log & Rede
          </button>
        </nav>
      )}

      {/* GRADE PRINCIPAL STARK HUD: 3 COLUNAS DENSAS E VIVAS (SEM ABAS DE MÓDULOS EXPOSTAS) */}
      <div
        className={`flex-1 min-h-0 flex flex-col ${
          focusMode
            ? 'lg:flex'
            : 'lg:grid lg:grid-cols-[305px_1fr_315px] xl:grid-cols-[325px_1fr_335px]'
        } overflow-hidden`}
      >
        {/* =======================================================
            COLUNA ESQUERDA: NÚCLEO + DIAGNÓSTICO + CLIMA + TAREFAS + CALENDÁRIO + MOÇAMBIQUE AO VIVO
           ======================================================= */}
        {!focusMode && (
          <aside
            className={`h-full min-h-0 bg-[#040916] border-r border-cyan-500/25 flex-col overflow-y-auto sara-scroll p-2.5 space-y-2.5 ${
              mobileSection === 'hud' ? 'flex flex-1' : 'hidden lg:flex'
            }`}
          >
            {/* 1. NÚCLEO SISTEMA (3 anéis circulares SVG) */}
            <div className="p-2.5 rounded-2xl bg-[#071125]/90 border border-cyan-500/25 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest">
                <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#00E5FF]" />
                  NÚCLEO SISTEMA
                </span>
                <span className="text-emerald-300 font-bold">ATIVO</span>
              </div>
              <div className="grid grid-cols-3 gap-1 pt-0.5">
                {renderRingGauge(`${cpuPct}%`, cpuPct, 'CPU', '#00E5FF')}
                {renderRingGauge(`${memPct}%`, memPct, 'MEM', '#38BDF8')}
                {renderRingGauge(`${coreTempC}°C`, coreTempC + 10, 'NÚCLEO', '#FF2A4B')}
              </div>
            </div>

            {/* 2. DIAGNÓSTICO + GRÁFICO SPARKLINE CHART.JS AO VIVO */}
            <div className="p-2.5 rounded-2xl bg-[#071125]/90 border border-cyan-500/25 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest">
                <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#FF2A4B]" />
                  DIAGNÓSTICO
                </span>
                <span className={telemetry.online ? 'text-emerald-300' : 'text-rose-400'}>
                  {telemetry.online ? 'Rede ESTÁVEL' : 'OFFLINE'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                <div className="px-2 py-1 rounded-lg bg-[#030814] border border-cyan-500/15">
                  <div className="text-[9px] text-slate-400">DOWNLINK</div>
                  <div className="text-cyan-200 font-bold tabular-nums">
                    {telemetry.downlinkMbps !== null ? `${telemetry.downlinkMbps} Mbps` : '10+ Mbps'}
                  </div>
                </div>
                <div className="px-2 py-1 rounded-lg bg-[#030814] border border-cyan-500/15">
                  <div className="text-[9px] text-slate-400">SEGURANÇA</div>
                  <div className="text-emerald-300 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>ATIVO</span>
                  </div>
                </div>
                <div className="px-2 py-1 rounded-lg bg-[#030814] border border-cyan-500/15">
                  <div className="text-[9px] text-slate-400">LATÊNCIA</div>
                  <div className="text-rose-300 font-bold tabular-nums">
                    {telemetry.rttMs !== null ? `${telemetry.rttMs} ms` : '24 ms'}
                  </div>
                </div>
              </div>
              <div className="h-12 w-full pt-0.5">
                <canvas ref={diagChartCanvasRef} className="w-full h-full" />
              </div>
            </div>

            {/* 3. CLIMA AO VIVO REAL (INHAMBANE OPEN-METEO + UV + PREVISÃO 3H) */}
            <div className="p-2.5 rounded-2xl bg-[#071125]/90 border border-cyan-500/25 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 flex items-center gap-1">
                    <CloudSun className="w-3.5 h-3.5" />
                    <span>CLIMA AO VIVO</span>
                  </div>
                  <div className="text-[11px] font-bold text-white truncate max-w-[220px]">
                    {weather.city}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshWeatherNow(true)}
                  disabled={isRefreshingWeather}
                  className="p-1 rounded-lg bg-[#030814] border border-cyan-500/25 text-cyan-300 hover:text-white cursor-pointer disabled:opacity-50"
                  title="Atualizar clima real"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingWeather ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {weather.loadedFromApi && weather.tempC !== null ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-cyan-200 tabular-nums">
                          {weather.tempC}°C
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Sens. {weather.feelsLikeC ?? weather.tempC}°C
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-200">{weather.condition}</div>
                    </div>
                    <div className="text-right text-[10px] font-mono text-slate-300 space-y-0.5">
                      <div>
                        HUM <span className="text-cyan-300">{weather.humidityPct ?? '--'}%</span>
                      </div>
                      <div>
                        VENTO{' '}
                        <span className="text-cyan-300">
                          {weather.windKmh ?? '--'}km/h {weather.windDirectionLabel || ''}
                        </span>
                      </div>
                      <div>
                        UV{' '}
                        <span className="text-rose-300 font-bold">
                          {weather.uvIndex !== null ? weather.uvIndex : '--'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {weather.hourlyForecast && weather.hourlyForecast.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-cyan-500/15">
                      {weather.hourlyForecast.map((hf) => (
                        <div
                          key={hf.time}
                          className="px-1.5 py-1 rounded-lg bg-[#030814] border border-cyan-500/15 text-center"
                        >
                          <div className="text-[9px] font-mono text-slate-400">{hf.time}</div>
                          <div className="text-[11px] font-bold text-cyan-200 tabular-nums">
                            {hf.tempC}°C
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[11px] text-amber-300">
                  {weather.errorMsg || 'A obter dados reais de Inhambane...'}
                </div>
              )}
            </div>

            {/* 4. BARRA COMPACTA: BATERIA • INTERNET • HORA • DATA */}
            <div className="px-2.5 py-2 rounded-xl bg-[#071125]/90 border border-cyan-500/20 grid grid-cols-2 gap-1.5 text-[10px] font-mono">
              <div className="flex items-center gap-1.5 text-emerald-300">
                {telemetry.batteryCharging ? (
                  <BatteryCharging className="w-3.5 h-3.5" />
                ) : (
                  <BatteryMedium className="w-3.5 h-3.5 text-cyan-300" />
                )}
                <span>
                  BAT {telemetry.batteryPct !== null ? `${telemetry.batteryPct}%` : 'AC/LINE'}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1.5 text-cyan-200">
                {telemetry.online ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span>{telemetry.online ? telemetry.networkType || 'ONLINE' : 'OFFLINE'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span className="tabular-nums">{timeFormatted}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 text-slate-400">
                <Calendar className="w-3 h-3 text-rose-400" />
                <span className="truncate">{todayFormatted}</span>
              </div>
            </div>

            {/* 5. TAREFAS PRIORITÁRIAS (REAIS) */}
            <div className="p-2.5 rounded-2xl bg-[#071125]/90 border border-cyan-500/25 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest">
                <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5" />
                  TAREFAS PRIORITÁRIAS
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModule('tarefas');
                    updatePanelOpen(true);
                  }}
                  className="text-[10px] text-rose-300 hover:text-white cursor-pointer"
                >
                  + Gerir
                </button>
              </div>
              {tasks.length === 0 ? (
                <div className="text-[11px] text-slate-400 py-1">
                  Sem tarefas ativas. Pede por voz ou abre{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('tarefas');
                      updatePanelOpen(true);
                    }}
                    className="text-cyan-300 underline cursor-pointer"
                  >
                    Tarefas
                  </button>
                  .
                </div>
              ) : (
                <div className="space-y-1">
                  {tasks.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setTasks((prev) =>
                          prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x))
                        )
                      }
                      className="w-full px-2 py-1 rounded-lg bg-[#030814] border border-cyan-500/15 hover:border-cyan-400/50 flex items-center gap-2 text-left text-[11px] cursor-pointer"
                    >
                      {t.done ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      )}
                      <span
                        className={`truncate flex-1 ${
                          t.done ? 'line-through text-slate-500' : 'text-slate-200'
                        }`}
                      >
                        {t.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 6. CALENDÁRIO DO MÊS + AGENDA DE HOJE */}
            <div className="p-2.5 rounded-2xl bg-[#071125]/90 border border-cyan-500/25 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest">
                <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {now.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModule('agenda');
                    updatePanelOpen(true);
                  }}
                  className="text-[10px] text-cyan-300 hover:text-white cursor-pointer"
                >
                  Agenda ({agenda.length})
                </button>
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-mono">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                  <div key={i} className="text-slate-500 pb-0.5">
                    {d}
                  </div>
                ))}
                {calendarCells.map((day, idx) => {
                  const isToday = day === now.getDate();
                  return (
                    <div
                      key={idx}
                      className={`py-0.5 rounded ${
                        day === null
                          ? ''
                          : isToday
                          ? 'bg-[#00E5FF] text-[#020612] font-black shadow-[0_0_8px_rgba(0,229,255,0.6)]'
                          : 'text-slate-300'
                      }`}
                    >
                      {day ?? ''}
                    </div>
                  );
                })}
              </div>
              {todayAgendaItems.length > 0 && (
                <div className="pt-1 border-t border-cyan-500/15 space-y-1">
                  {todayAgendaItems.map((ag) => (
                    <div
                      key={ag.id}
                      className="text-[10px] flex items-center justify-between gap-2 text-cyan-200 bg-[#030814] px-2 py-1 rounded"
                    >
                      <span className="truncate">{ag.title}</span>
                      <span className="font-mono text-rose-300 shrink-0">{ag.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 7. NOTÍCIAS RÁPIDAS + COTAÇÃO MZN REAL + FRASE DO DIA */}
            <div className="p-2.5 rounded-2xl bg-[#071125]/90 border border-cyan-500/25 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest">
                <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#00E5FF]" />
                  MOÇAMBIQUE AO VIVO
                </span>
                <button
                  type="button"
                  onClick={() => void refreshHudFeedNow(true)}
                  className="text-slate-400 hover:text-cyan-300 cursor-pointer"
                  title="Atualizar cotação e notícias"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>

              {/* Cotação Metical (MZN) */}
              <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px]">
                <div className="px-1.5 py-1 rounded-lg bg-[#030814] border border-cyan-500/15">
                  <div className="text-[8px] text-slate-400">1 USD</div>
                  <div className="text-cyan-200 font-bold tabular-nums">
                    {hudFeed.fx?.mznPerUsd ? `${hudFeed.fx.mznPerUsd} MT` : '--'}
                  </div>
                </div>
                <div className="px-1.5 py-1 rounded-lg bg-[#030814] border border-cyan-500/15">
                  <div className="text-[8px] text-slate-400">1 EUR</div>
                  <div className="text-cyan-200 font-bold tabular-nums">
                    {hudFeed.fx?.mznPerEur ? `${hudFeed.fx.mznPerEur} MT` : '--'}
                  </div>
                </div>
                <div className="px-1.5 py-1 rounded-lg bg-[#030814] border border-cyan-500/15">
                  <div className="text-[8px] text-slate-400">1 ZAR</div>
                  <div className="text-rose-300 font-bold tabular-nums">
                    {hudFeed.fx?.mznPerZar ? `${hudFeed.fx.mznPerZar} MT` : '--'}
                  </div>
                </div>
              </div>

              {/* Notícia 1 linha RSS real */}
              <div className="px-2 py-1.5 rounded-lg bg-[#030814] border border-cyan-500/15 flex items-center gap-1.5 text-[10px]">
                <Newspaper className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                {activeHeadline ? (
                  <button
                    type="button"
                    onClick={() =>
                      void sendJarvisPrompt(`Resume esta notícia: ${activeHeadline}`, 'text')
                    }
                    className="truncate text-left text-slate-200 hover:text-cyan-200 flex-1 cursor-pointer"
                    title={activeHeadline}
                  >
                    {activeHeadline}
                  </button>
                ) : (
                  <span className="truncate text-slate-400">
                    Feed RSS Moçambique pronto quando online.
                  </span>
                )}
                {hudFeed.news.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setNewsIndex((i) => i + 1)}
                    className="text-cyan-400 hover:text-white shrink-0 cursor-pointer"
                    title="Próxima manchete"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Frase do Dia */}
              <div className="text-[10px] italic text-cyan-200/80 border-l-2 border-[#FF2A4B]/70 pl-2">
                “{DAILY_QUOTES[quoteIndex]}”
              </div>
            </div>
          </aside>
        )}

        {/* =======================================================
            CENTRO DO PALCO: HOLOGRAMA 3D STARK + TELEMETRIA HUD + PREVIEW DINÂMICO
           ======================================================= */}
        <section
          className={`h-full min-h-0 flex flex-col relative overflow-hidden bg-[radial-gradient(circle_at_50%_38%,rgba(0,229,255,0.12),rgba(4,9,22,0.98)_65%,#02050D)] ${
            focusMode || mobileSection === 'stage' ? 'flex flex-1' : 'hidden lg:flex'
          }`}
        >
          {/* Cantoneiras Stark azul elétrico + vermelho */}
          <div className="pointer-events-none absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-[#00E5FF] z-20" />
          <div className="pointer-events-none absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-[#FF2A4B] z-20" />
          <div className="pointer-events-none absolute bottom-16 left-2 w-5 h-5 border-b-2 border-l-2 border-[#FF2A4B] z-20" />
          <div className="pointer-events-none absolute bottom-16 right-2 w-5 h-5 border-b-2 border-r-2 border-[#00E5FF] z-20" />

          {/* Barra superior HUD do Palco Central */}
          <div className="px-4 py-2 border-b border-cyan-500/20 bg-[#040A17]/90 flex flex-wrap items-center justify-between gap-2 shrink-0 z-10">
            <div className="flex items-center gap-2.5 text-[10px] sm:text-[11px] font-mono">
              <span className="text-cyan-300 font-bold tracking-wider">IDENT: SARA v3.7.1</span>
              <span className="text-slate-600 hidden md:inline">|</span>
              <span className="text-slate-300 hidden md:inline">CLASSE: ASSISTENTE PESSOAL</span>
              <span className="text-slate-600 hidden xl:inline">|</span>
              <span className="text-emerald-300 hidden xl:inline">
                SINAL {telemetry.online ? '98%' : 'OFF'} • SYNC: ESTÁVEL
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <span
                className={`flex items-center gap-1 text-[10px] font-mono ${
                  weather.loadedFromApi ? 'text-rose-300' : 'text-amber-300'
                }`}
              >
                <CloudSun className="w-3.5 h-3.5" />
                {shortCityName}{' '}
                {weather.loadedFromApi && weather.tempC !== null ? `${weather.tempC}°C` : '--'}
              </span>

              <canvas
                ref={spectrumCanvasRef}
                width={112}
                height={18}
                className="w-24 h-4.5 rounded"
              />

              <button
                type="button"
                onClick={() => {
                  const next = !focusMode;
                  setFocusMode(next);
                  setMood(next ? 'focus' : 'idle');
                }}
                className={`px-2 py-1 rounded-lg border text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer ${
                  focusMode
                    ? 'bg-rose-500/20 border-rose-400/60 text-rose-200'
                    : 'bg-[#071126] border-cyan-500/30 text-cyan-300 hover:border-cyan-400'
                }`}
                title={focusMode ? 'Mostrar colunas laterais HUD' : 'Modo Foco no palco central'}
              >
                {focusMode ? <EyeOff className="w-3 h-3" /> : <Focus className="w-3 h-3" />}
                <span className="hidden sm:inline">{focusMode ? 'Sair Foco' : 'Foco'}</span>
              </button>
            </div>
          </div>

          {/* Palco Principal Dinâmico */}
          <div className="flex-1 min-h-0 p-2.5 sm:p-3 overflow-hidden relative flex flex-col">
            {!stageContent ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-between relative">
                {/* Colchetes de telemetria flutuantes nas laterais do holograma */}
                <div className="hidden xl:flex pointer-events-none absolute left-4 top-6 flex-col gap-1 text-[9px] font-mono text-cyan-300/75">
                  <span>// BIOMETRIA VOCAL: CALIBRADA</span>
                  <span>// GEOLOC: INHAMBANE (-23.86°, 35.38°)</span>
                  <span>// MODO: {effectiveMood.toUpperCase()}</span>
                </div>
                <div className="hidden xl:flex pointer-events-none absolute right-4 top-6 flex-col items-end gap-1 text-[9px] font-mono text-rose-300/75">
                  <span>CORE MATRIX :: STARK_OS</span>
                  <span>ORBITALS: 3 ANÉIS ATIVOS</span>
                  <span>MEMÓRIA: {memory.facts.length} REGISTOS</span>
                </div>

                {/* CARDS FLUTUANTES TRANSPARENTES DE 2.º PLANO AO LADO DO HOLOGRAMA (NUNCA SOBRE A CABEÇA) */}
                {(isListening ||
                  isThinking ||
                  liveBuild?.isBuilding ||
                  completedBackgroundBuild ||
                  readingStatus.active ||
                  nextEnabledAlarm) && (
                  <div className="hidden sm:flex flex-col gap-2 absolute top-14 right-3 z-20 w-[228px] pointer-events-auto">
                    {isListening && (
                      <button
                        type="button"
                        onClick={onToggleMic}
                        className="p-2.5 rounded-2xl bg-[#040B1A]/75 backdrop-blur-md border border-emerald-400/45 shadow-[0_0_20px_rgba(16,185,129,0.18)] text-left flex items-center justify-between gap-2 hover:border-emerald-300 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[10px] font-mono font-bold text-emerald-300 uppercase">
                              Escuta Ativa
                            </div>
                            <div className="text-[10px] text-slate-300 truncate">
                              Microfone contínuo ligado
                            </div>
                          </div>
                        </div>
                        <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                      </button>
                    )}

                    {liveBuild?.isBuilding && (
                      <div className="p-2.5 rounded-2xl bg-[#040B1A]/78 backdrop-blur-md border border-cyan-400/45 shadow-[0_0_22px_rgba(0,229,255,0.2)] space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            BUILDER • 2.º PLANO
                          </span>
                          <span className="text-white font-bold tabular-nums">{builderProgressPct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#091529] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#00E5FF] to-[#FF2A4B] transition-all duration-500"
                            style={{ width: `${builderProgressPct}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-200 truncate">
                          {liveBuild.currentStepLabel ||
                            liveBuild.activeFile ||
                            `A construir ${activeBuilderProjectName || 'projeto'}...`}
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-[9px] font-mono text-slate-400 tabular-nums">
                            {formatMiniMmSs(liveBuild.elapsedSeconds)} • {liveBuild.createdFiles.length} fich.
                          </span>
                          <button
                            type="button"
                            onClick={() => onSwitchMode('builder')}
                            className="px-2 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-[10px] font-bold text-cyan-200 hover:bg-cyan-500/30 cursor-pointer flex items-center gap-1"
                          >
                            <span>Abrir</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {!liveBuild?.isBuilding && completedBackgroundBuild && (
                      <div className="p-2.5 rounded-2xl bg-[#040B1A]/82 backdrop-blur-md border border-emerald-400/55 shadow-[0_0_22px_rgba(16,185,129,0.22)] space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-emerald-300 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            BUILDER CONCLUÍDO
                          </span>
                          {onDismissCompletedBuild && (
                            <button
                              type="button"
                              onClick={onDismissCompletedBuild}
                              className="text-slate-400 hover:text-white cursor-pointer"
                              title="Fechar aviso"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="text-[11px] font-semibold text-white truncate">
                          {completedBackgroundBuild.projectName}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-mono text-slate-300">
                            {completedBackgroundBuild.filesCount} fich. •{' '}
                            {formatMiniMmSs(completedBackgroundBuild.elapsedSeconds)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onDismissCompletedBuild?.();
                              onSwitchMode('builder');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/25 border border-emerald-400/60 text-[10px] font-bold text-emerald-100 hover:bg-emerald-500/35 cursor-pointer"
                          >
                            Ver no Builder
                          </button>
                        </div>
                      </div>
                    )}

                    {readingStatus.active && (
                      <div className="p-2.5 rounded-2xl bg-[#040B1A]/78 backdrop-blur-md border border-cyan-400/40 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-cyan-300 font-bold flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            LEITURA • {Math.min(readingStatus.totalChunks, readingStatus.currentIndex + 1)}/{readingStatus.totalChunks}
                          </span>
                          <span className="text-[9px] text-rose-300">
                            {readingStatus.paused ? 'PAUSA' : 'EM CURSO'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-200 truncate">{readingStatus.title}</div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              readingStatus.paused ? resumeVoiceReading() : pauseVoiceReading()
                            }
                            className="flex-1 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/45 text-[10px] font-bold text-cyan-200 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            {readingStatus.paused ? (
                              <>
                                <Play className="w-2.5 h-2.5" />
                                <span>Continuar</span>
                              </>
                            ) : (
                              <>
                                <Pause className="w-2.5 h-2.5" />
                                <span>Pausar</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => stopVoiceReading()}
                            className="px-2 py-1 rounded-lg bg-rose-500/20 border border-rose-400/45 text-[10px] font-bold text-rose-200 cursor-pointer"
                          >
                            Parar
                          </button>
                        </div>
                      </div>
                    )}

                    {isThinking && (
                      <div className="p-2.5 rounded-2xl bg-[#040B1A]/78 backdrop-blur-md border border-rose-400/45 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-rose-300 font-bold flex items-center gap-1">
                            <Sparkles className="w-3 h-3 animate-spin" />
                            CÁLCULO / ANÁLISE
                          </span>
                          <span className="text-cyan-200 font-bold tabular-nums">{thinkingPercent}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-[#091529] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#00E5FF] to-[#FF2A4B] transition-all duration-300"
                            style={{ width: `${thinkingPercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {nextEnabledAlarm && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveModule('agenda');
                          updatePanelOpen(true);
                        }}
                        className="p-2 rounded-2xl bg-[#040B1A]/75 backdrop-blur-md border border-rose-500/35 flex items-center justify-between gap-2 text-left hover:border-rose-400 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <AlarmClock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[10px] font-mono font-bold text-white">
                              ALARME {nextEnabledAlarm.time}
                            </div>
                            <div className="text-[10px] text-slate-300 truncate">
                              {nextEnabledAlarm.label} • Ativo
                            </div>
                          </div>
                        </div>
                      </button>
                    )}
                  </div>
                )}

                {/* Holograma 3D Real Centered */}
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center w-full">
                  <SaraJarvisHead
                    mood={effectiveMood}
                    isSpeaking={isSaraSpeaking}
                    isListening={isListening}
                    isThinking={isThinking}
                    size="full"
                  />

                  {/* Faixa compacta mobile para processos em 2.º plano (sem cobrir o holograma) */}
                  {(liveBuild?.isBuilding || completedBackgroundBuild || readingStatus.active) && (
                    <div className="sm:hidden flex flex-wrap items-center justify-center gap-1.5 mt-2 px-2">
                      {liveBuild?.isBuilding && (
                        <button
                          type="button"
                          onClick={() => onSwitchMode('builder')}
                          className="px-2.5 py-1 rounded-xl bg-[#040B1A]/85 border border-cyan-400/50 text-[10px] font-mono text-cyan-200 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Builder {builderProgressPct}%</span>
                        </button>
                      )}
                      {!liveBuild?.isBuilding && completedBackgroundBuild && (
                        <button
                          type="button"
                          onClick={() => {
                            onDismissCompletedBuild?.();
                            onSwitchMode('builder');
                          }}
                          className="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/60 text-[10px] font-bold text-emerald-100 cursor-pointer"
                        >
                          Ver no Builder ({completedBackgroundBuild.projectName})
                        </button>
                      )}
                      {readingStatus.active && (
                        <button
                          type="button"
                          onClick={() =>
                            readingStatus.paused ? resumeVoiceReading() : pauseVoiceReading()
                          }
                          className="px-2.5 py-1 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-[10px] font-bold text-cyan-200 cursor-pointer"
                        >
                          {readingStatus.paused ? 'Continuar leitura' : 'Pausar leitura'}
                        </button>
                      )}
                    </div>
                  )}

                  {pendingDoc && (
                    <div className="mt-2 px-3.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-400/50 text-xs text-cyan-200 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Anexado: {pendingDoc.name}</span>
                    </div>
                  )}
                </div>

                {/* Faixa de Telemetria Stark na Base do Palco Holográfico */}
                <div className="w-full shrink-0 space-y-1.5 z-10">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono">
                    <div className="px-2.5 py-1.5 rounded-xl bg-[#040B1A]/90 border border-cyan-500/25 flex items-center gap-1.5">
                      <Radar className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[8px] text-slate-400">RADAR AMBIENTAL</div>
                        <div className="text-cyan-200 font-bold truncate">VARREDURA 360°</div>
                      </div>
                    </div>

                    <div className="px-2.5 py-1.5 rounded-xl bg-[#040B1A]/90 border border-cyan-500/25 flex items-center justify-between">
                      <div>
                        <div className="text-[8px] text-slate-400">PROC. NEURAL</div>
                        <div className="text-cyan-200 font-bold tabular-nums">{neuralPct}%</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[8px] text-slate-400">APRENDIZADO</div>
                        <div className="text-emerald-300 font-bold">ATIVO</div>
                      </div>
                    </div>

                    <div className="px-2.5 py-1.5 rounded-xl bg-[#040B1A]/90 border border-cyan-500/25">
                      <div className="text-[8px] text-slate-400">ÁUDIO SINTÉTICO</div>
                      <div className="text-rose-300 font-bold truncate">
                        44.1kHz |{' '}
                        {isSaraSpeaking ? 'VOZ ATIVA' : isListening ? 'ESCUTA' : 'PRONTO'}
                      </div>
                    </div>

                    <div className="px-2.5 py-1.5 rounded-xl bg-[#040B1A]/90 border border-cyan-500/25">
                      <div className="text-[8px] text-slate-400">CLIMA LOCAL ({shortCityName})</div>
                      <div className="text-cyan-200 font-bold truncate tabular-nums">
                        {weather.tempC !== null ? `${weather.tempC}°C` : '--'} | UV{' '}
                        {weather.uvIndex !== null ? weather.uvIndex : '--'} |{' '}
                        {weather.windKmh !== null ? `${weather.windKmh}km/h` : '--'}
                      </div>
                    </div>
                  </div>

                  <div className="px-3 py-1 rounded-lg bg-[#030815] border border-cyan-500/20 flex items-center justify-between text-[9px] font-mono tracking-widest text-slate-400">
                    <span className="text-cyan-300">HOLOGRAMA STARK ONLINE</span>
                    <span className="hidden sm:inline text-emerald-300">NÚCLEO ATIVO</span>
                    <span className="text-rose-300">ENCRIPTADO AES-256</span>
                  </div>
                </div>
              </div>
            ) : stageLayout === 'split' ? (
              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-3 items-stretch">
                <div className="flex flex-col items-center justify-between gap-2 rounded-2xl bg-[#040916]/85 border border-cyan-500/20 p-2 overflow-y-auto sara-scroll">
                  <div className="flex-1 flex items-center justify-center">
                    <SaraJarvisHead
                      mood={effectiveMood}
                      isSpeaking={isSaraSpeaking}
                      isListening={isListening}
                      isThinking={isThinking}
                      size="split"
                      onClickHead={() => setStageLayout('focus')}
                    />
                  </div>
                  {(liveBuild?.isBuilding ||
                    completedBackgroundBuild ||
                    readingStatus.active ||
                    stageContent.kind === 'music' ||
                    stageContent.kind === 'video') && (
                    <div className="w-full space-y-1.5 shrink-0">
                      {(stageContent.kind === 'music' || stageContent.kind === 'video') && (
                        <div className="p-2 rounded-xl bg-[#071126]/85 border border-cyan-400/35 space-y-1">
                          <div className="flex items-center justify-between text-[9px] font-mono text-cyan-300">
                            <span>{mediaPaused ? 'MÚSICA PAUSADA' : 'A TOCAR'}</span>
                            <span className="tabular-nums">{formatMiniMmSs(musicElapsedSec)}</span>
                          </div>
                          <div className="text-[10px] font-semibold text-white truncate">
                            {stageContent.track.title}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setMediaPaused((p) => !p)}
                              className="flex-1 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/45 text-[10px] font-bold text-cyan-200 flex items-center justify-center gap-1 cursor-pointer"
                            >
                              {mediaPaused ? (
                                <Play className="w-2.5 h-2.5" />
                              ) : (
                                <Pause className="w-2.5 h-2.5" />
                              )}
                              <span>{mediaPaused ? 'Tocar' : 'Pausar'}</span>
                            </button>
                            {stageContent.kind === 'music' && (
                              <button
                                type="button"
                                onClick={handleNextTrack}
                                className="px-2 py-1 rounded-lg bg-rose-500/20 border border-rose-400/45 text-[10px] font-bold text-rose-200 cursor-pointer flex items-center gap-0.5"
                                title="Próxima faixa"
                              >
                                <SkipForward className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {liveBuild?.isBuilding && (
                        <button
                          type="button"
                          onClick={() => onSwitchMode('builder')}
                          className="w-full p-2 rounded-xl bg-[#071126]/85 border border-cyan-400/40 text-left space-y-1 cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-[9px] font-mono text-cyan-300">
                            <span>BUILDER 2.º PLANO</span>
                            <span>{builderProgressPct}%</span>
                          </div>
                          <div className="h-1 rounded-full bg-[#030815] overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#00E5FF] to-[#FF2A4B]"
                              style={{ width: `${builderProgressPct}%` }}
                            />
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <JarvisStageRenderer
                  content={stageContent}
                  layoutMode={stageLayout}
                  onChangeLayoutMode={setStageLayout}
                  onClose={() => {
                    setStageContent(null);
                    setMediaPaused(false);
                  }}
                  onNextTrack={handleNextTrack}
                  onAskAboutDocument={(title) => setInputText(`Sobre "${title}", `)}
                  playlist={playlist}
                  mediaPaused={mediaPaused}
                  mediaVolume={mediaVolume}
                  onToggleMediaPause={() => setMediaPaused((p) => !p)}
                  onChangeMediaVolume={(v) => setMediaVolume(Math.max(0, Math.min(100, v)))}
                />
              </div>
            ) : (
              <div className="flex-1 min-h-0 relative flex flex-col">
                <JarvisStageRenderer
                  content={stageContent}
                  layoutMode={stageLayout}
                  onChangeLayoutMode={setStageLayout}
                  onClose={() => {
                    setStageContent(null);
                    setMediaPaused(false);
                  }}
                  onNextTrack={handleNextTrack}
                  onAskAboutDocument={(title) => setInputText(`Sobre "${title}", `)}
                  playlist={playlist}
                  mediaPaused={mediaPaused}
                  mediaVolume={mediaVolume}
                  onToggleMediaPause={() => setMediaPaused((p) => !p)}
                  onChangeMediaVolume={(v) => setMediaVolume(Math.max(0, Math.min(100, v)))}
                />
                {/* Cabeça 3D encolhida no canto inferior esquerdo (sem backdrop-filter sobre WebGL) */}
                <div
                  className="hidden sm:flex absolute bottom-3 left-3 z-20 rounded-2xl bg-[#040916] border border-cyan-400/50 shadow-[0_0_24px_rgba(0,229,255,0.28)] p-1"
                  title="Clica para dividir o ecrã com a Sara"
                >
                  <SaraJarvisHead
                    mood={effectiveMood}
                    isSpeaking={isSaraSpeaking}
                    isListening={isListening}
                    isThinking={isThinking}
                    size="corner"
                    onClickHead={() => setStageLayout('split')}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Barra Inferior: Microfone Grande + Interromper + Anexo + Input + Enviar */}
          <div className="p-2.5 sm:p-3 border-t border-cyan-500/25 bg-[#040A17]/95 shrink-0 z-10">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.json,.js,.ts,.py"
              onChange={handleUploadDocument}
              className="hidden"
            />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendJarvisPrompt(inputText, 'text');
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={isSaraSpeaking ? handleBargeIn : onToggleMic}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border transition cursor-pointer ${
                  isSaraSpeaking
                    ? 'bg-rose-500/25 border-rose-400 text-rose-200 shadow-[0_0_20px_rgba(255,42,75,0.4)]'
                    : isListening
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_22px_rgba(16,185,129,0.45)]'
                    : 'bg-gradient-to-br from-cyan-500/25 to-[#FF2A4B]/20 border-[#00E5FF]/60 text-cyan-200 hover:shadow-[0_0_18px_rgba(0,229,255,0.35)]'
                }`}
                title={
                  isSaraSpeaking
                    ? 'Interromper Sara e falar agora'
                    : isListening
                    ? 'Microfone contínuo ativo'
                    : 'Falar com a SARA'
                }
              >
                {isSaraSpeaking ? (
                  <Square className="w-4 h-4 fill-current" />
                ) : isListening ? (
                  <Mic className="w-5 h-5" />
                ) : (
                  <MicOff className="w-5 h-5" />
                )}
              </button>

              {isSaraSpeaking && (
                <button
                  type="button"
                  onClick={handleBargeIn}
                  className="px-2.5 h-10 rounded-xl bg-rose-500/20 border border-rose-400/60 text-rose-200 text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer hover:bg-rose-500/30"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Interromper</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 rounded-xl bg-[#071226] border border-cyan-500/30 text-cyan-300 hover:border-cyan-400 flex items-center justify-center shrink-0 cursor-pointer"
                title="Enviar PDF, Imagem ou Texto para a Sara analisar"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Fala ou escreve à SARA (explicações, 3D, cálculos, música, vídeos, gráficos...)"
                className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-[#061024] border border-cyan-500/30 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#00E5FF]"
              />

              <button
                type="submit"
                disabled={isThinking || (!inputText.trim() && !pendingDoc)}
                className="px-4 h-10 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#FF2A4B] text-[#020612] font-extrabold text-xs flex items-center gap-1.5 disabled:opacity-45 cursor-pointer shrink-0 shadow-[0_0_16px_rgba(0,229,255,0.3)]"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Enviar</span>
              </button>
            </form>
          </div>
        </section>

        {/* =======================================================
            COLUNA DIREITA: REGISTRO DE COMUNICAÇÃO LIVE + MEMÓRIA + PROCESSOS/UPTIME + TRÁFEGO REDE CHART.JS
           ======================================================= */}
        {!focusMode && (
          <aside
            className={`h-full min-h-0 bg-[#040916] border-l border-cyan-500/25 flex-col overflow-hidden ${
              mobileSection === 'log' ? 'flex flex-1' : 'hidden lg:flex'
            }`}
          >
            {/* Caixa especial estilo Homem de Ferro quando pensa */}
            {isThinking && (
              <div className="m-2.5 p-2.5 rounded-2xl bg-[#030916] border border-[#FF2A4B]/60 shadow-[0_0_24px_rgba(255,42,75,0.22)] shrink-0">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest mb-1.5">
                  <span className="text-rose-300 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    SARA a pensar
                  </span>
                  <span className="text-cyan-300 font-bold tabular-nums">{thinkingPercent}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#091224] overflow-hidden mb-1.5">
                  <div
                    className="h-full bg-gradient-to-r from-[#00E5FF] to-[#FF2A4B] transition-all duration-300"
                    style={{ width: `${thinkingPercent}%` }}
                  />
                </div>
                <div className="font-mono text-[10px] text-cyan-300/85 space-y-0.5 max-h-20 overflow-hidden">
                  {thinkingLogs.map((ln, idx) => (
                    <div key={idx} className="truncate">
                      {ln}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Log Tempo Real de Comunicação */}
            <div className="flex-1 min-h-0 overflow-y-auto sara-scroll p-2.5 space-y-2">
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 font-bold">
                  REGISTRO // LOG LIVE
                </span>
                {conversation.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConversation([])}
                    className="text-[10px] font-mono text-slate-400 hover:text-rose-300 cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {conversation.length === 0 && !streamingReply ? (
                <div className="p-3 rounded-2xl bg-[#071126] border border-cyan-500/25 text-xs text-slate-300 leading-relaxed">
                  Voz ativa. Pede qualquer desenho 3D, cálculo, explicação, gráfico ou música e tudo aparece resumido aqui e completo no palco central.
                </div>
              ) : (
                <>
                  {conversation.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-2.5 rounded-2xl border text-xs leading-relaxed ${
                        entry.sender === 'user'
                          ? 'bg-[#091834] border-cyan-500/35 text-cyan-50 ml-3'
                          : 'bg-[#060E1F] border-rose-500/25 text-slate-200 mr-1'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 text-[10px] font-mono">
                        <span
                          className={
                            entry.sender === 'user'
                              ? 'text-cyan-300 font-bold'
                              : 'text-rose-300 font-bold'
                          }
                        >
                          {entry.sender === 'user' ? 'Tu' : 'SARA'}
                        </span>
                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="tabular-nums">{entry.timestamp}</span>
                          {entry.sender === 'sara' && (
                            <button
                              type="button"
                              onClick={() =>
                                speakAsSara(entry.text, true, { level: 'full', forceSpeak: true })
                              }
                              className="text-cyan-300 hover:text-white cursor-pointer"
                              title="Ouvir resposta"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="whitespace-pre-wrap">
                        {entry.sender === 'sara'
                          ? sanitizeAssistantPlainText(entry.text)
                          : entry.text}
                      </div>
                    </div>
                  ))}

                  {streamingReply && (
                    <div className="p-2.5 rounded-2xl border bg-[#060E1F] border-cyan-400/50 text-slate-200 mr-1 text-xs leading-relaxed">
                      <div className="text-[10px] font-mono text-cyan-300 font-bold mb-1">
                        SARA (a transmitir...)
                      </div>
                      <div className="whitespace-pre-wrap">
                        {sanitizeAssistantPlainText(streamingReply)}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Bloco Inferior Direito: Memória Persistente Compacta + Processos/Uptime + Tráfego Rede Chart.js */}
            <div className="p-2.5 border-t border-cyan-500/20 bg-[#030815] space-y-2 shrink-0">
              {/* Memória Persistente Expansível */}
              <div className="rounded-xl bg-[#071125] border border-cyan-500/20 p-2">
                <button
                  type="button"
                  onClick={() => setIsMemoryExpanded((v) => !v)}
                  className="w-full flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-rose-300 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    <Brain className="w-3.5 h-3.5" />
                    MEMÓRIA PERSISTENTE ({memory.facts.length})
                  </span>
                  {isMemoryExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-cyan-300" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5 text-cyan-300" />
                  )}
                </button>

                {isMemoryExpanded && (
                  <div className="mt-2 space-y-1.5">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const clean = newMemoryFact.trim();
                        if (!clean) return;
                        setMemory((prev) => ({
                          ...prev,
                          facts: [...prev.facts, clean].slice(-25),
                        }));
                        setNewMemoryFact('');
                      }}
                      className="flex gap-1"
                    >
                      <input
                        type="text"
                        value={newMemoryFact}
                        onChange={(e) => setNewMemoryFact(e.target.value)}
                        placeholder="Guardar facto..."
                        className="flex-1 px-2 py-1 rounded-lg bg-[#030814] border border-cyan-500/25 text-[11px] text-white"
                      />
                      <button
                        type="submit"
                        className="px-2 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-[11px] font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </form>
                    <div className="space-y-1 max-h-24 overflow-y-auto sara-scroll">
                      {memory.facts.slice(-4).map((fact, idx) => (
                        <div
                          key={`${fact}_${idx}`}
                          className="flex items-center justify-between gap-2 text-[10px] text-slate-300 bg-[#030814] px-2 py-1 rounded"
                        >
                          <span className="truncate">{fact}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setMemory((prev) => ({
                                ...prev,
                                facts: prev.facts.filter((f) => f !== fact),
                              }))
                            }
                            className="text-slate-500 hover:text-rose-400 cursor-pointer shrink-0"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Processos Ativos + Threads + Uptime ao vivo */}
              <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                <div className="px-2 py-1.5 rounded-lg bg-[#071125] border border-cyan-500/20">
                  <div className="text-[8px] text-slate-400">PROCESSOS</div>
                  <div className="text-cyan-200 font-bold tabular-nums">
                    {12 + (isThinking ? 4 : 0) + (stageContent ? 2 : 0)} ATIVOS
                  </div>
                </div>
                <div className="px-2 py-1.5 rounded-lg bg-[#071125] border border-cyan-500/20">
                  <div className="text-[8px] text-slate-400">THREADS</div>
                  <div className="text-rose-300 font-bold tabular-nums">
                    {telemetry.cpuCores || 8} THREADS
                  </div>
                </div>
                <div className="px-2 py-1.5 rounded-lg bg-[#071125] border border-cyan-500/20">
                  <div className="text-[8px] text-slate-400">UPTIME</div>
                  <div className="text-emerald-300 font-bold tabular-nums">
                    {formatUptimeHMS(uptimeSeconds)}
                  </div>
                </div>
              </div>

              {/* Gráfico Tráfego de Rede ao Vivo (Chart.js) */}
              <div className="p-2 rounded-xl bg-[#071125] border border-cyan-500/25">
                <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-widest mb-1">
                  <span className="text-cyan-300 font-bold">TRÁFEGO REDE</span>
                  <span className="text-slate-400">
                    <span className="text-[#00E5FF]">RX</span> /{' '}
                    <span className="text-[#FF2A4B]">TX</span> (Mbps)
                  </span>
                </div>
                <div className="h-20 w-full">
                  <canvas ref={netChartCanvasRef} className="w-full h-full" />
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
