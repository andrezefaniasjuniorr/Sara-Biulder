import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlarmClock,
  BatteryCharging,
  BatteryMedium,
  BellRing,
  Brain,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Circle,
  CloudSun,
  Cpu,
  EyeOff,
  FileText,
  Focus,
  Hammer,
  HardDrive,
  Mic,
  MicOff,
  Music2,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type {
  JarvisActionPayload,
  JarvisAgendaItem,
  JarvisAlarmItem,
  JarvisConversationEntry,
  JarvisDocumentItem,
  JarvisHeadMood,
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
  fetchLiveWeather,
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
import {
  interruptSaraAndListen,
  parseVoiceCommand,
  speakAsSara,
  type VoiceCommandAction,
} from '../../utils/voiceService';
import { SaraJarvisHead } from './SaraJarvisHead';
import { JarvisStageRenderer } from './JarvisStageRenderer';

interface JarvisWorkspaceProps {
  voiceEnabled: boolean;
  isListening: boolean;
  isSaraSpeaking: boolean;
  isSaraSilenced: boolean;
  firebaseUserUid?: string;
  onToggleMic: () => void;
  onSilenceSara: () => void;
  onSwitchMode: (mode: WorkspaceMode) => void;
  onNotify: (msg: string) => void;
  onExecuteSystemCommand?: (cmd: VoiceCommandAction, rawText: string) => Promise<boolean>;
  onStageStateChange?: (state: JarvisMediaStateContext) => void;
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
  externalRepeatRef: React.MutableRefObject<(() => void) | null>;
  externalContinueRef: React.MutableRefObject<(() => Promise<void>) | null>;
}

const IRON_MAN_PROCESS_LINES = [
  '>> MOUNTING NEURAL KERNEL [STARK-CORE]',
  '>> STREAMING VOCAL SUMMARY BUS (<JARVIS_SPEAK>)',
  '>> CALIBRATING OPTICAL HUD VECTORS: CYAN/#00E5FF',
  '>> SYNCING REAL-TIME TELEMETRY & GEOLOCATION',
  '>> COMPILING VISUAL MATRIX / SVG / CHART PIPELINE',
  '>> RENDERING HOLOGRAPHIC RESPONSE PAYLOAD',
];

const BRIDGE_SPEECH_PHRASES = [
  'Já vou.',
  'Só um segundo.',
  'A ver isso.',
  'Deixa-me preparar isso.',
];

export const JarvisWorkspace: React.FC<JarvisWorkspaceProps> = ({
  voiceEnabled,
  isListening,
  isSaraSpeaking,
  isSaraSilenced,
  firebaseUserUid,
  onToggleMic,
  onSilenceSara,
  onSwitchMode,
  onNotify,
  onExecuteSystemCommand,
  onStageStateChange,
  externalMediaControlRef,
  externalCommandRef,
  externalFocusCommandRef,
  externalModuleRef,
  externalRepeatRef,
  externalContinueRef,
}) => {
  const initialBundle = useMemo(() => loadJarvisLocalBundle(), []);
  const [activeModule, setActiveModule] = useState<JarvisModuleTab>('voz');
  const [mobileSection, setMobileSection] = useState<'stage' | 'modules' | 'telemetry'>('stage');

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
  const [weather, setWeather] = useState<JarvisWeatherInfo>({
    tempC: null,
    feelsLikeC: null,
    humidityPct: null,
    windKmh: null,
    condition: 'A obter clima real...',
    city: 'Inhambane Cidade, Inhambane, Moçambique',
    loadedFromApi: false,
  });
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);

  const batteryInfoRef = useRef<{ pct: number | null; charging: boolean | null }>({
    pct: null,
    charging: null,
  });
  const [telemetry, setTelemetry] = useState<JarvisSystemTelemetry>(() =>
    readSyncSystemTelemetry()
  );
  const [activeRingingAlarm, setActiveRingingAlarm] = useState<JarvisAlarmItem | null>(null);

  // Inputs dos módulos
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
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Persistência local automática
  useEffect(() => saveJarvisAgenda(agenda), [agenda]);
  useEffect(() => saveJarvisAlarms(alarms), [alarms]);
  useEffect(() => saveJarvisTasks(tasks), [tasks]);
  useEffect(() => saveJarvisMemory(memory), [memory]);
  useEffect(() => saveJarvisDocuments(documents), [documents]);
  useEffect(() => saveJarvisConversation(conversation), [conversation]);
  useEffect(() => saveJarvisPlaylist(playlist), [playlist]);

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

  // Hidratação + sync opcional Firebase (sara_jarvis_memory)
  useEffect(() => {
    let active = true;
    buscarJarvisStateFirebase(firebaseUserUid).then((cloud) => {
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
          facts: Array.from(new Set([...(prev.facts || []), ...cleanCloudFacts])).slice(-25),
        }));
      }
    });
    return () => {
      active = false;
    };
  }, [firebaseUserUid]);

  useEffect(() => {
    const t = setTimeout(() => {
      salvarJarvisStateFirebase({ agenda, alarms, tasks, memory }, firebaseUserUid).catch(() => {});
    }, 1800);
    return () => clearTimeout(t);
  }, [agenda, alarms, tasks, memory, firebaseUserUid]);

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

  // Relógio ao vivo + telemetria real + verificador real de alarmes (every 2s)
  useEffect(() => {
    const interval = setInterval(() => {
      const current = new Date();
      setNow(current);
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
    }, 2000);
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
      const bars = 44;
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
          case 'add_agenda': {
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
            const needle = (act.title || '').toLowerCase();
            setTasks((prev) =>
              prev.map((t) =>
                !needle || t.title.toLowerCase().includes(needle) ? { ...t, done: true } : t
              )
            );
            break;
          }
          case 'play_music': {
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
              setMobileSection('modules');
            }
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
              subtitle: act.notes,
              cards: Array.isArray(act.cards) ? act.cards : [],
            });
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
        }
      }
    },
    [activeDoc, focusMode, onNotify, onSwitchMode]
  );

  const sendJarvisPrompt = useCallback(
    async (rawText: string, source: 'voice' | 'text' = 'text') => {
      const clean = rawText.trim();
      const docToSend = pendingDoc;
      if (!clean && !docToSend) return;

      // TIPO A - [SISTEMA]: Antes de chamar a IA, verifica comandos determinísticos mesmo quando escritos em texto
      if (clean && !docToSend && onExecuteSystemCommand) {
        const localCmd = parseVoiceCommand(clean, {
          workspaceMode: 'jarvis',
          hasActiveMedia: stageContent?.kind === 'music' || stageContent?.kind === 'video',
          isMediaPaused: mediaPaused,
          hasActiveStage: Boolean(stageContent),
        });
        if (localCmd.type !== 'prompt') {
          const handled = await onExecuteSystemCommand(localCmd, clean);
          if (handled) {
            if (source === 'text') setInputText('');
            return;
          }
        }
      }

      const userLabel = clean || `Analisar documento: ${docToSend?.name}`;
      const nowTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

      setConversation((prev) => [
        ...prev,
        {
          id: `usr_j_${Date.now()}`,
          sender: 'user',
          text: userLabel,
          timestamp: nowTime,
        },
      ]);

      if (source === 'text') setInputText('');
      if (docToSend) {
        setDocuments((prev) => [docToSend, ...prev]);
        setActiveDoc(docToSend);
        setPendingDoc(null);
      }

      setIsThinking(true);
      setStreamingReply(null);
      setMood('thinking');

      const shouldSpeakNow = voiceEnabled && (source === 'voice' || !isSaraSilenced);
      let spokenDuringStream = false;
      let bridgeSpoken = false;
      const bridgeTimer = shouldSpeakNow
        ? setTimeout(() => {
            if (spokenDuringStream) return;
            bridgeSpoken = true;
            const ack =
              BRIDGE_SPEECH_PHRASES[
                Math.floor(Math.random() * BRIDGE_SPEECH_PHRASES.length)
              ];
            speakAsSara(ack, voiceEnabled, {
              level: 'short',
              forceSpeak: true,
            });
          }, 420)
        : null;

      const res = await askJarvisAssistantStream(
        {
          prompt: userLabel,
          history: conversation.slice(-8),
          memory,
          agenda,
          tasks,
          alarms,
          weather,
          telemetry,
          mediaState: currentMediaState,
          documentAttachment: docToSend,
          activeDocument: docToSend || activeDoc,
        },
        {
          onSpeakReady: (speakText) => {
            if (bridgeTimer) clearTimeout(bridgeTimer);
            if (!speakText || spokenDuringStream) return;
            spokenDuringStream = true;
            speakAsSara(speakText, voiceEnabled, {
              level: 'medium',
              queueIfSpeaking: bridgeSpoken,
              forceSpeak: source === 'voice' || !isSaraSilenced,
            });
          },
          onReplyPartial: (partialReply) => {
            setStreamingReply(sanitizeAssistantPlainText(partialReply));
          },
        }
      );

      if (bridgeTimer) clearTimeout(bridgeTimer);
      setIsThinking(false);
      setStreamingReply(null);
      setMood(res.mood && res.mood !== 'speaking' ? res.mood : 'idle');

      const cleanFinalReply = sanitizeAssistantPlainText(res.reply) || 'Feito.';
      setConversation((prev) => [
        ...prev,
        {
          id: `sara_j_${Date.now()}`,
          sender: 'sara',
          text: cleanFinalReply,
          timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      await applyJarvisActions(res.actions, docToSend);

      if (!spokenDuringStream) {
        const speakText = sanitizeAssistantPlainText(res.voiceSummary || cleanFinalReply);
        speakAsSara(speakText, voiceEnabled, {
          level: 'medium',
          queueIfSpeaking: bridgeSpoken,
          forceSpeak: source === 'voice' || !isSaraSilenced,
        });
      }
    },
    [
      pendingDoc,
      onExecuteSystemCommand,
      stageContent,
      mediaPaused,
      conversation,
      memory,
      agenda,
      tasks,
      alarms,
      weather,
      telemetry,
      currentMediaState,
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
      setMobileSection('modules');
    };
    return () => {
      externalModuleRef.current = null;
    };
  }, [externalModuleRef]);

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
    { id: 'agenda', label: 'Agenda', icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'musica', label: 'Música', icon: <Music2 className="w-3.5 h-3.5" /> },
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

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#030712] text-white overflow-hidden relative">
      {/* Alarme a tocar no topo */}
      {activeRingingAlarm && (
        <div className="z-40 px-4 py-2.5 bg-gradient-to-r from-[#FF2A4B]/30 via-[#081529] to-[#00E5FF]/25 border-b border-[#FF2A4B] flex items-center justify-between gap-3">
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
            SARA Palco
          </button>
          <button
            type="button"
            onClick={() => setMobileSection('modules')}
            className={`py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
              mobileSection === 'modules'
                ? 'border-[#FF2A4B] text-rose-300 bg-[#08152E]'
                : 'border-transparent text-slate-400'
            }`}
          >
            Módulos ({tasks.filter((t) => !t.done).length})
          </button>
          <button
            type="button"
            onClick={() => setMobileSection('telemetry')}
            className={`py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
              mobileSection === 'telemetry'
                ? 'border-[#00E5FF] text-cyan-300 bg-[#08152E]'
                : 'border-transparent text-slate-400'
            }`}
          >
            Conversa & Memória
          </button>
        </nav>
      )}

      {/* Grade principal HUD: 3 colunas (ou Centro puro no Modo Foco) */}
      <div
        className={`flex-1 min-h-0 flex flex-col ${
          focusMode ? 'lg:flex' : 'lg:grid lg:grid-cols-[26fr_48fr_26fr]'
        } overflow-hidden`}
      >
        {/* PAINEL ESQUERDO: MÓDULOS JARVIS */}
        {!focusMode && (
          <aside
            className={`h-full min-h-0 bg-[#050B18] border-r border-cyan-500/25 flex-col overflow-hidden ${
              mobileSection === 'modules' ? 'flex flex-1' : 'hidden lg:flex'
            }`}
          >
            {/* Navegação dos 6 módulos */}
            <div className="p-2 grid grid-cols-3 gap-1.5 border-b border-cyan-500/20 bg-[#040915]">
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

            {/* Conteúdo do módulo ativo */}
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
                        {isListening ? (
                          <Mic className="w-4 h-4 animate-pulse" />
                        ) : (
                          <MicOff className="w-4 h-4" />
                        )}
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
                        <span>Interromper SARA e Falar (Esc / Espaço)</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-rose-300">
                      Sugestões para Testar
                    </div>
                    {[
                      'Explica física quântica de forma simples e depois profunda',
                      'Resolve passo a passo a equação 3x + 9 = 24',
                      'Desenha em SVG um esquema do sistema solar',
                      'Cria um gráfico comparativo de energias renováveis',
                      'Toca música de Alan Walker no YouTube',
                      'Mostra um vídeo tutorial sobre motores elétricos',
                      'Como está o tempo aqui em Inhambane hoje?',
                    ].map((cmd) => (
                      <button
                        key={cmd}
                        type="button"
                        onClick={() => void sendJarvisPrompt(cmd, 'text')}
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
                  {/* Telemetria REAL do PC / Browser */}
                  <div className="p-3.5 rounded-2xl bg-[#071126] border border-cyan-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">
                        Telemetria Real do Sistema
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
                          {telemetry.deviceMemoryGb ? `~${telemetry.deviceMemoryGb} GB` : 'N/D navegador'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-400">Heap JS da Aba</span>
                        <span className="font-mono text-cyan-300">
                          {telemetry.jsHeapUsedMb !== null && telemetry.jsHeapLimitMb !== null
                            ? `${telemetry.jsHeapUsedMb} / ${telemetry.jsHeapLimitMb} MB (${jsHeapPct}%)`
                            : 'Indisponível neste navegador'}
                        </span>
                      </div>
                      {jsHeapPct !== null && (
                        <div className="h-1.5 rounded-full bg-[#030712] overflow-hidden border border-cyan-500/20">
                          <div
                            className="h-full bg-gradient-to-r from-[#00E5FF] to-[#FF2A4B] transition-all duration-500"
                            style={{ width: `${jsHeapPct}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-400 flex items-center gap-1">
                          {telemetry.batteryCharging ? (
                            <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <BatteryMedium className="w-3.5 h-3.5 text-cyan-300" />
                          )}
                          <span>Bateria</span>
                        </span>
                        <span className="font-mono text-emerald-300">
                          {telemetry.batteryPct !== null
                            ? `${telemetry.batteryPct}% (${
                                telemetry.batteryCharging ? 'A carregar' : 'Em uso'
                              })`
                            : 'Indisponível'}
                        </span>
                      </div>
                      {telemetry.batteryPct !== null && (
                        <div className="h-1.5 rounded-full bg-[#030712] overflow-hidden border border-emerald-500/20">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
                            style={{ width: `${telemetry.batteryPct}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="p-2 rounded-xl bg-[#040916] border border-cyan-500/20 flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        {telemetry.online ? (
                          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span>{telemetry.online ? 'Internet Online' : 'Sem Ligação'}</span>
                      </span>
                      <span className="font-mono text-cyan-300">
                        {[
                          telemetry.networkType,
                          telemetry.downlinkMbps !== null ? `${telemetry.downlinkMbps} Mbps` : null,
                          telemetry.rttMs !== null ? `${telemetry.rttMs} ms` : null,
                        ]
                          .filter(Boolean)
                          .join(' • ') || telemetry.timezone}
                      </span>
                    </div>
                  </div>

                  {/* Clima Real via Open-Meteo */}
                  <div className="p-3.5 rounded-2xl bg-[#071126] border border-cyan-500/25 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-cyan-300">
                          Clima Ao Vivo (Open-Meteo)
                        </div>
                        <div className="text-xs font-bold text-white mt-0.5">{weather.city}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void refreshWeatherNow(true)}
                        disabled={isRefreshingWeather}
                        className="p-1.5 rounded-lg bg-[#040916] border border-cyan-500/30 text-cyan-300 hover:text-white cursor-pointer disabled:opacity-50"
                        title="Atualizar clima real agora"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isRefreshingWeather ? 'animate-spin' : ''}`}
                        />
                      </button>
                    </div>

                    {weather.loadedFromApi && weather.tempC !== null ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xl font-black text-cyan-200">{weather.tempC}°C</div>
                          <div className="text-[11px] text-slate-300">
                            {weather.condition} • Sensação {weather.feelsLikeC ?? weather.tempC}°C
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Humidade {weather.humidityPct ?? '--'}% • Vento {weather.windKmh ?? '--'}{' '}
                            km/h
                          </div>
                        </div>
                        <CloudSun className="w-8 h-8 text-cyan-300 shrink-0" />
                      </div>
                    ) : (
                      <div className="text-xs text-amber-300">
                        {weather.errorMsg || 'Não consegui buscar o clima real agora.'}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={handleTriggerDailyRoutine}
                      className="w-full py-2.5 px-3 rounded-xl bg-cyan-500/15 border border-cyan-400/50 text-cyan-200 text-xs font-bold flex items-center justify-center gap-2 hover:bg-cyan-500/25 cursor-pointer"
                    >
                      <Sun className="w-4 h-4" />
                      <span>Rotina Diária & Resumo do Dia</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFocusMode(true);
                        setMood('focus');
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-rose-500/15 border border-rose-400/50 text-rose-200 text-xs font-bold flex items-center justify-center gap-2 hover:bg-rose-500/25 cursor-pointer"
                    >
                      <Focus className="w-4 h-4" />
                      <span>Ativar Modo Foco</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSwitchMode('builder')}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#00E5FF]/20 to-[#FF2A4B]/20 border border-cyan-400/50 text-white text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
                    >
                      <Hammer className="w-4 h-4 text-cyan-300" />
                      <span>Abrir Modo Builder (Criar Apps/Sites)</span>
                    </button>
                  </div>
                </div>
              )}

              {activeModule === 'agenda' && (
                <div className="space-y-4">
                  {/* Novo Compromisso */}
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

                  {/* Lista Agenda */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                      Agenda ({agenda.length})
                    </div>
                    {agenda.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">
                        Agenda vazia. Pede por voz para marcar algo ou adiciona acima.
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
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Alarmes / Despertador */}
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
                        Sem músicas na fila. Pede qualquer música por voz ou pesquisa acima no YouTube.
                      </p>
                    ) : (
                      playlist.map((tr, idx) => (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() => handlePlayTrack(tr, idx)}
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
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-rose-500/20 border border-dashed border-cyan-400/60 text-xs font-bold text-cyan-200 flex items-center justify-center gap-2 hover:bg-cyan-500/25 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Carregar PDF, Imagem ou Texto</span>
                  </button>

                  {documents.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">
                      Carrega qualquer PDF, contrato, fatura, foto ou apontamento para eu resumir e extrair os dados.
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
          </aside>
        )}

        {/* CENTRO DO PALCO: CABEÇA HOLOGRÁFICA STARK + CONTEÚDO VISUAL DINÂMICO */}
        <section
          className={`h-full min-h-0 flex flex-col relative overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgba(0,229,255,0.12),rgba(5,11,26,0.98)_65%,#02050D)] ${
            focusMode || mobileSection === 'stage' ? 'flex flex-1' : 'hidden lg:flex'
          }`}
        >
          {/* Cantoneiras neon azul elétrico e vermelho estilo Armadura Stark */}
          <div className="pointer-events-none absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-[#00E5FF]" />
          <div className="pointer-events-none absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-[#FF2A4B]" />
          <div className="pointer-events-none absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-[#FF2A4B]" />
          <div className="pointer-events-none absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-[#00E5FF]" />

          {/* Barra superior de telemetria REAL ao vivo do Palco */}
          <div className="px-4 py-2.5 border-b border-cyan-500/20 bg-[#040A17]/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 shrink-0 z-10">
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-cyan-300 font-bold tracking-wider">{timeFormatted}</span>
              <span className="text-slate-400 hidden sm:inline">{todayFormatted}</span>
              <span
                className={`flex items-center gap-1 ${
                  weather.loadedFromApi ? 'text-rose-300' : 'text-amber-300'
                }`}
                title={weather.errorMsg || weather.condition}
              >
                <CloudSun className="w-3.5 h-3.5" />
                {shortCityName}{' '}
                {weather.loadedFromApi && weather.tempC !== null ? `${weather.tempC}°C` : '--'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Estado REAL da Rede e Bateria / CPU */}
              <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono">
                <span
                  className={`px-2 py-0.5 rounded border ${
                    telemetry.online
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-400/40 text-rose-300'
                  }`}
                >
                  {telemetry.online ? telemetry.networkType || 'ONLINE' : 'OFFLINE'}
                </span>
                {telemetry.batteryPct !== null ? (
                  <span className="text-cyan-300">BAT {telemetry.batteryPct}%</span>
                ) : telemetry.cpuCores ? (
                  <span className="text-cyan-300">{telemetry.cpuCores} CORES</span>
                ) : null}
              </div>

              {/* Espectro de Voz Animado */}
              <canvas
                ref={spectrumCanvasRef}
                width={128}
                height={20}
                className="w-28 h-5 rounded"
              />

              {focusMode && (
                <button
                  type="button"
                  onClick={() => {
                    setFocusMode(false);
                    setMood('idle');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-400/60 text-rose-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>Sair Foco</span>
                </button>
              )}
            </div>
          </div>

          {/* Palco Principal Dinâmico */}
          <div className="flex-1 min-h-0 p-3 sm:p-4 overflow-hidden relative flex flex-col">
            {!stageContent ? (
              <div className="flex-1 flex flex-col items-center justify-center relative">
                <SaraJarvisHead
                  mood={effectiveMood}
                  isSpeaking={isSaraSpeaking}
                  isListening={isListening}
                  isThinking={isThinking}
                  size="full"
                />

                {pendingDoc && (
                  <div className="mt-3 px-3.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-400/50 text-xs text-cyan-200 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Anexado: {pendingDoc.name}</span>
                  </div>
                )}
              </div>
            ) : stageLayout === 'split' ? (
              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-3 items-stretch">
                <div className="flex items-center justify-center rounded-2xl bg-[#040916]/75 border border-cyan-500/20 p-2">
                  <SaraJarvisHead
                    mood={effectiveMood}
                    isSpeaking={isSaraSpeaking}
                    isListening={isListening}
                    isThinking={isThinking}
                    size="split"
                    onClickHead={() => setStageLayout('focus')}
                  />
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
                {/* Cabeça encolhida no canto inferior esquerdo */}
                <div
                  className="hidden sm:flex absolute bottom-3 left-3 z-20 rounded-2xl bg-[#040916]/90 border border-cyan-400/50 shadow-[0_0_24px_rgba(0,229,255,0.28)] p-1 backdrop-blur-md"
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

          {/* Barra Inferior: Microfone Grande Animado + Interromper + Anexar Documento + Input */}
          <div className="p-3 border-t border-cyan-500/25 bg-[#040A17]/90 backdrop-blur-md shrink-0 z-10">
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
                    ? 'bg-rose-500/25 border-rose-400 text-rose-200 shadow-[0_0_20px_rgba(255,42,75,0.4)] animate-pulse'
                    : isListening
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_22px_rgba(16,185,129,0.45)] animate-pulse'
                    : 'bg-gradient-to-br from-cyan-500/25 to-[#FF2A4B]/20 border-[#00E5FF]/60 text-cyan-200 hover:shadow-[0_0_18px_rgba(0,229,255,0.35)]'
                }`}
                title={
                  isSaraSpeaking
                    ? 'Interromper Sara e falar agora'
                    : isListening
                    ? 'Microfone contínuo ativo (clica para desligar)'
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
                  title="Interromper voz da Sara imediatamente"
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
                placeholder="Fala ou escreve à SARA (explicações simples ou profundas, música, vídeos, gráficos...)"
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

        {/* PAINEL DIREITO: PROCESSAMENTO STARK + RESPOSTAS EM STREAM + MEMÓRIA PERSISTENTE */}
        {!focusMode && (
          <aside
            className={`h-full min-h-0 bg-[#050B18] border-l border-cyan-500/25 flex-col overflow-hidden ${
              mobileSection === 'telemetry' ? 'flex flex-1' : 'hidden lg:flex'
            }`}
          >
            {/* Caixa especial estilo Homem de Ferro quando pensa */}
            {isThinking && (
              <div className="m-3 p-3 rounded-2xl bg-[#030916] border border-[#FF2A4B]/60 shadow-[0_0_24px_rgba(255,42,75,0.22)] shrink-0">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest mb-1.5">
                  <span className="text-rose-300 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    Kernel Stark Em Execução
                  </span>
                  <span className="text-cyan-300 font-bold">{thinkingPercent}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#091224] overflow-hidden mb-2">
                  <div
                    className="h-full bg-gradient-to-r from-[#00E5FF] to-[#FF2A4B] transition-all duration-300"
                    style={{ width: `${thinkingPercent}%` }}
                  />
                </div>
                <div className="font-mono text-[10px] text-cyan-300/85 space-y-0.5 max-h-24 overflow-hidden">
                  {thinkingLogs.map((ln, idx) => (
                    <div key={idx} className="truncate">
                      {ln}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Respostas detalhadas */}
            <div className="flex-1 min-h-0 overflow-y-auto sara-scroll p-3 space-y-2.5">
              <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">
                Diálogo & Detalhes
              </div>

              {conversation.length === 0 && !streamingReply ? (
                <div className="p-3.5 rounded-2xl bg-[#071126] border border-cyan-500/25 text-xs text-slate-300 leading-relaxed">
                  Olá! Estou ativa no <strong className="text-cyan-300">Modo Assistente SARA</strong>. Podes falar comigo naturalmente para tirar dúvidas (em nível simples, normal ou técnico), procurar músicas ou vídeos no YouTube, ver gráficos, matemática ou analisar documentos.
                </div>
              ) : (
                <>
                  {conversation.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-3 rounded-2xl border text-xs leading-relaxed ${
                        entry.sender === 'user'
                          ? 'bg-[#091834] border-cyan-500/35 text-cyan-50 ml-4'
                          : 'bg-[#060E1F] border-rose-500/25 text-slate-200 mr-2'
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
                          <span>{entry.timestamp}</span>
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
                    <div className="p-3 rounded-2xl border bg-[#060E1F] border-cyan-400/50 text-slate-200 mr-2 text-xs leading-relaxed">
                      <div className="flex items-center justify-between mb-1 text-[10px] font-mono">
                        <span className="text-cyan-300 font-bold">SARA (a escrever...)</span>
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

            {/* Caixa de Memória Persistente */}
            <div className="p-3 border-t border-cyan-500/20 bg-[#040915] space-y-2 shrink-0 max-h-[210px] overflow-y-auto sara-scroll">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-rose-300">
                <span className="flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" />
                  Memória Persistente ({memory.facts.length})
                </span>
              </div>
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
                className="flex gap-1.5"
              >
                <input
                  type="text"
                  value={newMemoryFact}
                  onChange={(e) => setNewMemoryFact(e.target.value)}
                  placeholder="Guardar facto na memória..."
                  className="flex-1 px-2 py-1 rounded-lg bg-[#071126] border border-cyan-500/25 text-[11px] text-white"
                />
                <button
                  type="submit"
                  className="px-2 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-[11px] font-bold cursor-pointer"
                >
                  +
                </button>
              </form>
              <div className="space-y-1">
                {memory.facts.slice(-5).map((fact, idx) => (
                  <div
                    key={`${fact}_${idx}`}
                    className="flex items-center justify-between gap-2 text-[11px] text-slate-300 bg-[#071126]/80 px-2 py-1 rounded-lg border border-cyan-500/15"
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
          </aside>
        )}
      </div>
    </div>
  );
};
