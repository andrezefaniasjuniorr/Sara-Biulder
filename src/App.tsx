import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare,
  Eye,
  Code2,
  Terminal,
  Mic,
  MicOff,
  VolumeX,
  PhoneOff,
  Loader2,
  Play,
  Pause,
  Square,
  BookOpen,
  MapPin,
  Radio,
  Volume2,
  Lock,
  Unlock,
  MessageSquareWarning,
  Check,
  X,
  Phone,
} from 'lucide-react';
import type {
  AgentMode,
  AttachedFile,
  BuildStep,
  ChatCodeBlock,
  ChatMessage,
  ConsoleEntry,
  FileKey,
  FirebaseUserProfile,
  LiveBuildInfo,
  ManualProposalState,
  MissionReport,
  MissionState,
  MobilePanelTab,
  PendingVoiceConfirmation,
  PreviewDevice,
  ProjectFiles,
  ProjectRecord,
  ProjectType,
  RightPanelTab,
  SaraPlatformAction,
  ScreenContextInfo,
  VersionSnapshot,
  VoiceLevel,
} from './types/builder';
import type {
  JarvisMediaStateContext,
  JarvisModuleTab,
  WorkspaceMode,
} from './types/jarvis';
import type {
  ActivityCategory,
  SaraSession,
  SaraUserIdentityPayload,
} from './types/auth';
import type {
  BackgroundReminder,
  BackgroundSettings,
  DeviceLockState,
  LiveShareRecord,
  LocationRequestItem,
  LocationSignalSource,
  SaraDeviceRecord,
  SharedPeerLocation,
} from './types/location';
import { createStarterProject } from './utils/starterProject';
import {
  askSaraBuilderStep,
  fetchSaraFastKickoff,
  filesToCodeBlocks,
  isPlatformCommandIntent,
  isPureConversationIntent,
  planAutonomousMission,
  runSaraFinalTest,
  runSaraStream,
  type ConvertedImage,
} from './services/saraAiService';
import {
  apagarProjetoNoFirebase,
  buscarEstadosProjetosFirebase,
  buscarMensagensChatFirebase,
  buscarPreferenciasUsuarioFirebase,
  buscarProjetosNoFirebase,
  salvarEstadoProjetoFirebase,
  salvarMensagemChatFirebase,
  salvarPreferenciasUsuarioFirebase,
  salvarProjetoNoFirebase,
  verificarUsuario,
} from './services/firebaseService';
import {
  INACTIVITY_LIMIT_MS,
  checkSessionStillValid,
  evaluateNonOwnerGuard,
  getSavedActiveSession,
  getUnreadAlertsLocal,
  logAdminAlert,
  logoutCurrentSession,
  recordActivityEvent,
  updatePresenceHeartbeat,
  verifySessionAccountPassword,
} from './services/authService';
import {
  extractImageGenPrompt,
  generateSaraImage,
  IMAGE_CREATING_MESSAGE,
  saveUserProfilePhoto,
} from './services/imageGenService';
import {
  acknowledgeAndClearPendingCommand,
  buildEmergencySmsUri,
  evaluateOfflineSosCondition,
  executeRemoteDeviceWipeLocal,
  formatSpeedKmh,
  formatTimeAgoPt,
  getSavedDeviceLockState,
  hideFromRadarImmediately,
  markCurrentDeviceOfflineOnLogout,
  publishCurrentRadarPresence,
  requestCurrentCoordinates,
  requestRealCoordinatesWithFallback,
  respondToLocationRequest,
  reverseGeocodeCoords,
  setSavedDeviceLockState,
  setSavedRadarVisibilityPref,
  stopAllOutgoingShares,
  subscribeAccountDevices,
  subscribeLiveShareSession,
  subscribeRadarRequestsAndPeers,
  syncCurrentDeviceTelemetry,
} from './services/locationRadarService';
import {
  consumeBrowserClosedBackgroundNotice,
  isEiSaraWakePhrase,
  loadBackgroundReminders,
  loadBackgroundSettings,
  markBrowserClosingWhileBackgroundActive,
  parseBackgroundReminderInput,
  playReminderBellChime,
  postMessageToServiceWorker,
  releaseScreenWakeLock,
  requestNotificationPermissionIfNeeded,
  requestScreenWakeLock,
  saveBackgroundReminders,
  saveBackgroundSettings,
  setBackgroundActiveLifecycleFlag,
  showSaraSystemNotification,
  startBackgroundWorkerLoop,
  startLoudDeviceAlarmLoop,
  startSilentAudioKeepAlive,
  stopBackgroundWorkerLoop,
  stopLoudDeviceAlarmLoop,
  stopSilentAudioKeepAlive,
  syncPersistentBackgroundNotification,
  syncReminderToServiceWorker,
} from './services/backgroundService';
import { buildStandaloneHtml, downloadProjectZip, importProjectZip } from './utils/zipService';
import { getSavedGitHubToken, pushProjectToGitHub } from './utils/githubService';
import {
  adjustVoiceSpeed,
  detectAmbiguousOrDangerousPrompt,
  detectBargeInCommand,
  getBackgroundBuildDoneSpeech,
  getGuestExpirySpeech,
  getHumanChoice,
  getInactivityLogoutSpeech,
  getLoginGreetingSpeech,
  getManualStepApprovalSpeech,
  getModeSwitchSpeech,
  getPlatformCommandSpeech,
  getSpokenBuildRecap,
  getVoiceReadingStatus,
  getWorkspaceSwitchSpeech,
  inferDomainFromText,
  interruptSaraAndListen,
  isAssistantExplanationIntent,
  isProbableSaraEcho,
  isSaraActivelySpeaking,
  isSaraCallMode as isSaraCallModeFlag,
  isSaraSilenced as isSaraSilencedFlag,
  parseVoiceCommand,
  pauseVoiceReading,
  playCompletionChime,
  reconstructDistortedVoiceInput,
  resumeVoiceReading,
  setSaraCallMode,
  setSaraSilenced,
  setSpeakingStateListener,
  speakAsSara,
  speakAsSaraAndWait,
  startContinuousVoiceRecognition,
  stopSaraSpeech,
  stopVoiceReading,
  subscribeVoiceReadingStatus,
  type VoiceCommandAction,
  type VoiceDomainTopic,
  type VoiceParseContext,
  type VoiceReadingStatus,
} from './utils/voiceService';
import {
  isProjectBlank,
  loadActiveProjectState,
  mergeProjectStatesMap,
  updateProjectStateFromRecord,
} from './utils/projectMemory';
import { TopBar } from './components/TopBar';
import { SaraChatPanel } from './components/SaraChatPanel';
import { LivePreviewPanel } from './components/LivePreviewPanel';
import { EditorConsolePanel } from './components/EditorConsolePanel';
import { ProjectsModal } from './components/ProjectsModal';
import { SettingsModal } from './components/SettingsModal';
import { DeployModal } from './components/DeployModal';
import { PwaInstallBar } from './components/PwaInstallBar';
import { JarvisWorkspace } from './components/jarvis/JarvisWorkspace';
import { LoginGateScreen } from './components/auth/LoginGateScreen';
import { AdminPanelModal } from './components/admin/AdminPanelModal';
import { type ProfileSubTab } from './components/profile/ProfileAndFindPhonePanel';
import { FloatingSaraBubble } from './components/background/FloatingSaraBubble';
import { type RadarExternalControlHandle } from './components/map/RadarMapPanel';
import { FreeSaraMapView } from './components/map/FreeSaraMapView';

const WORKSPACE_MODE_KEY = 'sara_workspace_mode_v1';
const PROJECTS_STORAGE_KEY = 'sara_biulder_projects_v2';
const ACTIVE_PROJECT_KEY = 'sara_biulder_active_id_v2';
const CHAT_STORAGE_KEY = 'sara_biulder_chat_v2';
const CHAT_MAP_STORAGE_KEY = 'sara_biulder_chat_map_v1';
const AGENT_MODE_KEY = 'sara_biulder_agent_mode_v1';
const SAVED_MISSION_KEY = 'sara_biulder_saved_mission_v2';
const ERRORS_FIXED_KEY = 'sara_biulder_errors_fixed_v1';
const VOICE_LEVEL_KEY = 'sara_biulder_voice_level_v1';

function scopedStorageKey(base: string, userId?: string): string {
  return userId ? `${base}_${userId}` : base;
}

function loadInitialWorkspaceMode(session: SaraSession | null): WorkspaceMode {
  if (!session || session.isGuest) return 'jarvis';
  try {
    const saved =
      localStorage.getItem(scopedStorageKey(WORKSPACE_MODE_KEY, session.userId)) ||
      (session.isOwner ? localStorage.getItem(WORKSPACE_MODE_KEY) : null);
    if (saved === 'builder' || saved === 'jarvis') return saved;
  } catch {
    // ignore
  }
  return 'jarvis';
}

function loadCachedProjectChat(projectId: string, session: SaraSession | null): ChatMessage[] {
  if (!session || session.isGuest) return [];
  try {
    const raw =
      localStorage.getItem(scopedStorageKey(CHAT_MAP_STORAGE_KEY, session.userId)) ||
      (session.isOwner ? localStorage.getItem(CHAT_MAP_STORAGE_KEY) : null);
    if (raw) {
      const map = JSON.parse(raw) as Record<string, ChatMessage[]>;
      if (Array.isArray(map?.[projectId])) return map[projectId];
    }
  } catch {
    // ignore
  }
  return [];
}

function loadInitialVoiceLevel(session: SaraSession | null): VoiceLevel {
  if (!session || session.isGuest) return 'short';
  try {
    const saved =
      localStorage.getItem(scopedStorageKey(VOICE_LEVEL_KEY, session.userId)) ||
      (session.isOwner ? localStorage.getItem(VOICE_LEVEL_KEY) : null);
    if (saved === 'short' || saved === 'medium' || saved === 'full') return saved;
  } catch {
    // ignore
  }
  return 'short';
}

const EMPTY_MISSION: MissionState = {
  active: false,
  paused: false,
  goal: '',
  tasks: [],
  currentIndex: 0,
  errorCount: 0,
  errorsFixed: 0,
  elapsedSeconds: 0,
  notes: [],
  finished: false,
};

const EMPTY_MANUAL_PROPOSAL: ManualProposalState = {
  active: false,
  goal: '',
  currentStepIndex: 0,
  totalEstimatedSteps: 0,
  stepsQueue: [],
  pendingPromptForSara: '',
};

function loadInitialProjects(session: SaraSession | null): ProjectRecord[] {
  if (!session || session.isGuest) return [createStarterProject()];
  try {
    const raw =
      localStorage.getItem(scopedStorageKey(PROJECTS_STORAGE_KEY, session.userId)) ||
      (session.isOwner ? localStorage.getItem(PROJECTS_STORAGE_KEY) : null);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return [createStarterProject()];
}

function loadInitialActiveProjectId(
  session: SaraSession | null,
  projectsList: ProjectRecord[]
): string {
  if (!session || session.isGuest) return projectsList[0].id;
  try {
    const savedId =
      localStorage.getItem(scopedStorageKey(ACTIVE_PROJECT_KEY, session.userId)) ||
      (session.isOwner ? localStorage.getItem(ACTIVE_PROJECT_KEY) : null);
    if (savedId && projectsList.some((p) => p.id === savedId)) return savedId;
  } catch {
    // fallback
  }
  return projectsList[0].id;
}

function loadInitialChat(session: SaraSession | null): ChatMessage[] {
  if (!session || session.isGuest) return [];
  try {
    const raw =
      localStorage.getItem(scopedStorageKey(CHAT_STORAGE_KEY, session.userId)) ||
      (session.isOwner ? localStorage.getItem(CHAT_STORAGE_KEY) : null);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((m: ChatMessage) => m?.id !== 'sara_welcome');
      }
    }
  } catch {
    // fallback
  }
  return [];
}

function loadInitialAgentMode(session: SaraSession | null): AgentMode {
  if (!session || session.isGuest) return 'manual';
  try {
    const saved =
      localStorage.getItem(scopedStorageKey(AGENT_MODE_KEY, session.userId)) ||
      (session.isOwner ? localStorage.getItem(AGENT_MODE_KEY) : null);
    if (saved === 'automatic' || saved === 'manual') return saved;
  } catch {
    // fallback
  }
  return 'manual';
}

function loadResumableMission(session: SaraSession | null): MissionState | null {
  if (!session || session.isGuest) return null;
  try {
    const raw =
      localStorage.getItem(scopedStorageKey(SAVED_MISSION_KEY, session.userId)) ||
      (session.isOwner ? localStorage.getItem(SAVED_MISSION_KEY) : null);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MissionState;
    if (parsed && parsed.goal && Array.isArray(parsed.tasks) && parsed.tasks.length > 0 && !parsed.finished) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function loadInitialErrorsFixed(session: SaraSession | null): number {
  if (!session || session.isGuest) return 0;
  try {
    const raw =
      localStorage.getItem(scopedStorageKey(ERRORS_FIXED_KEY, session.userId)) ||
      (session.isOwner ? localStorage.getItem(ERRORS_FIXED_KEY) : null);
    return Number(raw || '0') || 0;
  } catch {
    return 0;
  }
}

function isApprovalMessage(text: string): boolean {
  const norm = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  return /^(sara[,\s]+)?(sim|ok|okay|pode continuar|continua|avanca|pode avancar|vai|vai la|aprovo|aprovado|faz|pode fazer|podes fazer|manda ver|bora|comeca|pode comecar|inicia|executa|segue|perfeito|concordo|combinado|claro|esta otimo|tudo bem|pode ir|etapa\s+\d+)([,\s]+(sara|sim|pode|por favor))?[!.]*$/.test(
    norm
  );
}

function isRejectionOrCancelMessage(text: string): boolean {
  const norm = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  return /^(sara[,\s]+)?(nao|cancela|cancelar|aborta|abortar|esquece|para|deixa estar|nao quero|espera)([,\s]+(sara|por favor))?[!.]*$/.test(
    norm
  );
}

function computeLiveBuildPct(info: LiveBuildInfo): number {
  if (!info.isBuilding) return 0;
  const total = info.steps?.length || 0;
  const done = info.steps?.filter((s) => s.status === 'done').length || 0;
  if (info.phase === 'thinking') return 12;
  if (info.phase === 'planning') return 24;
  if (info.phase === 'testing') return 91;
  if (info.phase === 'fixing') return 84;
  if (total > 0) return Math.min(88, 26 + Math.round((done / total) * 58));
  return 38;
}

const LiveShareViewerScreen: React.FC<{
  shareId: string;
  onExit: () => void;
}> = ({ shareId, onExit }) => {
  const [liveData, setLiveData] = useState<LiveShareRecord | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    const unsub = subscribeLiveShareSession(shareId, (record) => {
      setLiveData(record);
      setLoadedOnce(true);
    });
    return () => unsub();
  }, [shareId]);

  const isExpired =
    !liveData ||
    !liveData.active ||
    (typeof liveData.expiresAt === 'number' && liveData.expiresAt <= Date.now());

  const markers = useMemo(() => {
    if (!liveData || isExpired) return [];
    return [
      {
        id: `live_${liveData.shareId}`,
        lat: liveData.lat,
        lng: liveData.lng,
        title: liveData.callName,
        subtitle: liveData.addressLabel,
        badge: liveData.batteryPct !== null ? `${liveData.batteryPct}%` : undefined,
        tone: 'target_locked' as const,
        avatarText: (liveData.callName || 'S').slice(0, 2).toUpperCase(),
      },
    ];
  }, [liveData, isExpired]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#020612] text-white overflow-hidden">
      <div className="px-4 py-3 bg-[#070D1D] border-b border-cyan-500/25 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center shrink-0">
            <Radio className="w-4 h-4 text-cyan-300 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-300">
              SARA RADAR · PARTILHA AO VIVO
            </div>
            <div className="text-sm font-bold text-white truncate">
              {liveData ? `${liveData.callName} (${liveData.saraId})` : 'A localizar transmissão ao vivo...'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-600/70 text-xs font-semibold text-slate-200 cursor-pointer shrink-0"
        >
          Abrir SARA
        </button>
      </div>

      {!loadedOnce ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-300">
          <Loader2 className="w-7 h-7 animate-spin text-cyan-300" />
          <span className="text-xs font-mono">A ligar à partilha em tempo real...</span>
        </div>
      ) : isExpired ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <MapPin className="w-10 h-10 text-rose-400" />
          <div className="text-base font-bold text-white">Partilha ao vivo terminada</div>
          <p className="text-xs text-slate-400 max-w-sm">
            Esta ligação de partilha foi encerrada pelo utilizador ou atingiu o tempo limite.
          </p>
          <button
            type="button"
            onClick={onExit}
            className="mt-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#020612] text-xs font-bold cursor-pointer"
          >
            Voltar para a SARA
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="px-4 py-2 bg-[#060C1B] border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-300 shrink-0">
            <span className="truncate max-w-full">
              Rua / Local: <strong className="text-white">{liveData.addressLabel}</strong>
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <span>Velocidade: {formatSpeedKmh(liveData.speedMps)}</span>
              {liveData.batteryPct !== null && <span>Bateria: {liveData.batteryPct}%</span>}
              <span className="text-emerald-300">Atualizado {formatTimeAgoPt(liveData.updatedAt)}</span>
            </div>
          </div>
          <div className="flex-1 min-h-0 relative">
            <FreeSaraMapView
              centerLat={liveData.lat}
              centerLng={liveData.lng}
              zoom={16}
              viewMode="hybrid"
              markers={markers}
              sonarActive
              showPlacesSearch={false}
              heightClassName="h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [session, setSession] = useState<SaraSession | null>(() => getSavedActiveSession());
  const [exitNotice, setExitNotice] = useState<string | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [guestSecondsLeft, setGuestSecondsLeft] = useState<number | null>(null);

  // Estado de Localização, Radar, Achar Meu Celular & Segundo Plano
  const [activeBottomTab, setActiveBottomTab] = useState<'assistente' | 'mapa' | 'perfil'>('assistente');
  const [profileSubTab, setProfileSubTab] = useState<ProfileSubTab>('perfil');
  const [appearOnMap, setAppearOnMap] = useState<boolean>(false);
  const [ghostMode, setGhostMode] = useState<boolean>(false);
  const [myCoords, setMyCoords] = useState<{
    lat: number;
    lng: number;
    accuracyM?: number | null;
    speedMps?: number | null;
    source?: LocationSignalSource;
    timestamp?: number;
  } | null>(null);
  const [liveShareId, setLiveShareId] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('live');
    } catch {
      return null;
    }
  });
  const radarControlRef = useRef<RadarExternalControlHandle | null>(null);
  const [incomingPending, setIncomingPending] = useState<LocationRequestItem[]>([]);
  const [outgoingGrants, setOutgoingGrants] = useState<LocationRequestItem[]>([]);
  const [sharedPeers, setSharedPeers] = useState<SharedPeerLocation[]>([]);
  const [devices, setDevices] = useState<SaraDeviceRecord[]>([]);
  const [bgSettings, setBgSettings] = useState<BackgroundSettings>(() => loadBackgroundSettings(session?.userId));
  const [reminders, setReminders] = useState<BackgroundReminder[]>(() => loadBackgroundReminders(session?.userId));
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  const [deviceLockState, setDeviceLockState] = useState<DeviceLockState | null>(() => getSavedDeviceLockState());
  const [unlockPasswordInput, setUnlockPasswordInput] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [activeAlarmRinging, setActiveAlarmRinging] = useState(false);
  const [sosSmsBanner, setSosSmsBanner] = useState<{ uri: string; phone: string; offlineMinutes: number } | null>(null);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [isPageHidden, setIsPageHidden] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden'
  );
  const seenIncomingReqIdsRef = useRef<Set<string>>(new Set());
  const lastTelemetrySyncAtRef = useRef<number>(0);
  const sessionRef = useRef<SaraSession | null>(session);
  const bgSettingsRef = useRef<BackgroundSettings>(bgSettings);
  const appearOnMapRef = useRef<boolean>(appearOnMap);
  const ghostModeRef = useRef<boolean>(ghostMode);
  const myCoordsRef = useRef(myCoords);
  const devicesRef = useRef<SaraDeviceRecord[]>(devices);
  const remindersRef = useRef<BackgroundReminder[]>(reminders);
  const incomingPendingRef = useRef<LocationRequestItem[]>(incomingPending);
  sessionRef.current = session;
  bgSettingsRef.current = bgSettings;
  appearOnMapRef.current = appearOnMap;
  ghostModeRef.current = ghostMode;
  myCoordsRef.current = myCoords;
  devicesRef.current = devices;
  remindersRef.current = reminders;
  incomingPendingRef.current = incomingPending;

  const isOwner = Boolean(session?.isOwner);
  const effectiveStorageUid = session && !session.isGuest ? session.userId : null;
  const callerVoc = isOwner
    ? ', Eletro-Júnior'
    : session?.callName
    ? `, ${session.callName}`
    : '';
  const callerShortVoc = isOwner
    ? ', Eletro-Jr'
    : session?.callName
    ? `, ${session.callName}`
    : '';
  const callerName = isOwner ? 'Eletro-Júnior' : session?.callName || 'Utilizador';
  const userIdentity = useMemo<SaraUserIdentityPayload>(
    () => ({
      callName: session?.callName || 'Utilizador',
      isOwner: Boolean(session?.isOwner),
      isGuest: Boolean(session?.isGuest),
    }),
    [session]
  );
  const lastInteractionRef = useRef<number>(Date.now());
  const pendingLoginSpeechRef = useRef<string | null>(null);

  const [projects, setProjects] = useState<ProjectRecord[]>(() =>
    loadInitialProjects(getSavedActiveSession())
  );
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    const initSess = getSavedActiveSession();
    const list = loadInitialProjects(initSess);
    return loadInitialActiveProjectId(initSess, list);
  });

  const currentProject = projects.find((p) => p.id === currentProjectId) || projects[0];
  // Não envia projetos antigos por padrão (evita contaminação de KG Services / projetos anteriores)
  const shouldRecallPastProjects = (promptText: string) =>
    /\b(lembra|dados\s+da\s+kg|kg\s*services|usa\s+os\s+dados)\b/i.test(promptText);
  const getRequestedPastProjects = useCallback(
    (promptText: string) =>
      shouldRecallPastProjects(promptText)
        ? projects.map((p) => p.name).filter(Boolean).slice(0, 8)
        : [],
    [projects]
  );

  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() =>
    loadInitialWorkspaceMode(getSavedActiveSession())
  );
  const [agentMode, setAgentMode] = useState<AgentMode>(() =>
    loadInitialAgentMode(getSavedActiveSession())
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadInitialChat(getSavedActiveSession())
  );
  const [isThinking, setIsThinking] = useState(false);

  const [liveBuild, setLiveBuild] = useState<LiveBuildInfo>({
    isBuilding: false,
    phase: 'idle',
    elapsedSeconds: 0,
    steps: [],
    createdFiles: [],
  });
  const [completedBackgroundBuild, setCompletedBackgroundBuild] = useState<{
    id: string;
    projectName: string;
    elapsedSeconds: number;
    filesCount: number;
  } | null>(null);
  const jarvisNotifyChatRef = useRef<((shortMsg: string) => void) | null>(null);

  const [activeFile, setActiveFile] = useState<FileKey>('index.html');
  const [rightTab, setRightTab] = useState<RightPanelTab>('editor');
  const [mobileTab, setMobileTab] = useState<MobilePanelTab>('chat');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
  const [refreshSeed, setRefreshSeed] = useState(1);

  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  const [errorsFixedCount, setErrorsFixedCount] = useState<number>(() =>
    loadInitialErrorsFixed(getSavedActiveSession())
  );

  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([
    {
      id: 'init_log',
      level: 'success',
      message: 'SARA OS pronta. Modo Manual / Automático e voz contínua ativos.',
      timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceLevel, setVoiceLevel] = useState<VoiceLevel>(() =>
    loadInitialVoiceLevel(getSavedActiveSession())
  );
  const [isSaraSilenced, setIsSaraSilencedState] = useState(false);
  const [isCallMode, setIsCallModeState] = useState(false);
  const isSaraSilencedRef = useRef(false);
  const isCallModeRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [isSaraSpeaking, setIsSaraSpeaking] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingVoiceConfirmation | null>(null);
  const shouldKeepListeningRef = useRef(false);
  const stopMicRef = useRef<(() => void) | null>(null);
  const startHandsFreeMicRef = useRef<(() => void) | null>(null);
  const voiceDispatchInFlightRef = useRef(false);
  const lastVoiceDispatchRef = useRef<{ norm: string; ts: number }>({ norm: '', ts: 0 });

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const hydratedUidRef = useRef<string | null>(null);
  const syncedUpdatedAtRef = useRef<Record<string, string>>({});

  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [mission, setMission] = useState<MissionState>(EMPTY_MISSION);
  const [resumableMission, setResumableMission] = useState<MissionState | null>(() =>
    loadResumableMission(getSavedActiveSession())
  );
  const [lastCompletedReport, setLastCompletedReport] = useState<MissionReport | null>(null);
  const [manualProposal, setManualProposal] = useState<ManualProposalState>(EMPTY_MANUAL_PROPOSAL);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const latestErrorsRef = useRef<string[]>([]);
  const workspaceModeRef = useRef<WorkspaceMode>(workspaceMode);
  const voiceEnabledRef = useRef(voiceEnabled);
  const voiceLevelRef = useRef(voiceLevel);
  const agentModeRef = useRef(agentMode);
  const missionAbortRef = useRef(false);
  const missionPausedRef = useRef(false);
  const pendingConfirmationRef = useRef<PendingVoiceConfirmation | null>(null);
  const voiceContextRef = useRef<VoiceParseContext>({});
  const jarvisPromptRef = useRef<
    ((promptText: string, source?: 'voice' | 'text') => Promise<void>) | null
  >(null);
  const jarvisFocusRef = useRef<((enabled: boolean) => void) | null>(null);
  const jarvisModuleRef = useRef<((tab: JarvisModuleTab) => void) | null>(null);
  const jarvisPanelRef = useRef<((open: boolean) => void) | null>(null);
  const [isJarvisPanelOpen, setIsJarvisPanelOpen] = useState(false);
  const jarvisRepeatRef = useRef<(() => void) | null>(null);
  const jarvisContinueRef = useRef<(() => Promise<void>) | null>(null);
  const jarvisMediaControlRef = useRef<{
    pause: () => void;
    resume: () => void;
    close: () => void;
    adjustVolume: (delta: number) => number;
    closeStage: () => void;
    next: () => void;
    prev: () => void;
    toggleMute: () => boolean;
    toggleShuffle: () => boolean;
    toggleLoop: () => boolean;
    likeCurrent: () => { liked: boolean; title?: string };
    identifyCurrent: () => { title?: string; artist?: string } | null;
    playGenreOrQuery: (query: string) => Promise<void>;
    applySmartHome: (payload: {
      device: 'luz' | 'ventoinha' | 'ac' | 'porta' | 'tomada' | 'modo';
      state: 'on' | 'off' | 'scene';
      room?: string;
      sceneName?: string;
    }) => void;
    showElectricCalc: (params: {
      voltage?: number;
      current?: number;
      resistance?: number;
      power?: number;
      reconstructed?: string;
    }) => string;
    seekBy: (seconds: number) => void;
    setFullscreen: (enabled: boolean) => void;
    playLocalMedia: (opts: {
      kind: 'music' | 'video' | 'image' | 'audio' | 'any';
      query?: string;
      folderOrDate?: string;
    }) => Promise<string>;
    openLocalDocument: (opts: {
      docCategory: 'pdf' | 'word' | 'ppt' | 'excel' | 'recent' | 'any';
      query?: string;
    }) => Promise<string>;
    filterLocalLibrary: (opts: {
      filter: 'all' | 'pdfs' | 'videos' | 'music' | 'images' | 'documents' | 'recents' | 'favorites';
      query?: string;
    }) => string;
    switchMediaSource: (source: 'internet' | 'local') => string;
    requestLocalPermission: () => void;
  } | null>(null);
  const pendingSourceAmbiguityRef = useRef<{ query?: string; kind: 'music' | 'video' } | null>(null);
  const recentUtterancesRef = useRef<string[]>([]);
  const lastDomainTopicRef = useRef<VoiceDomainTopic>('general');
  const [jarvisMediaState, setJarvisMediaState] = useState<JarvisMediaStateContext>({
    hasActiveMedia: false,
    mediaKind: undefined,
    isPaused: false,
    volume: 80,
    activeStageKind: undefined,
  });
  const handleJarvisStageStateChange = useCallback((state: JarvisMediaStateContext) => {
    setJarvisMediaState(state);
  }, []);
  const [readingStatus, setReadingStatus] = useState<VoiceReadingStatus>(() => getVoiceReadingStatus());
  useEffect(() => subscribeVoiceReadingStatus(setReadingStatus), []);
  const isSaraSpeakingRef = useRef(false);
  const startupGreetedRef = useRef(false);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    voiceLevelRef.current = voiceLevel;
    if (!session || session.isGuest) return;
    try {
      localStorage.setItem(scopedStorageKey(VOICE_LEVEL_KEY, session.userId), voiceLevel);
    } catch {
      // ignore
    }
  }, [voiceLevel, session]);

  useEffect(() => {
    agentModeRef.current = agentMode;
    if (!session || session.isGuest) return;
    try {
      localStorage.setItem(scopedStorageKey(AGENT_MODE_KEY, session.userId), agentMode);
    } catch {
      // ignore
    }
  }, [agentMode, session]);

  useEffect(() => {
    workspaceModeRef.current = workspaceMode;
    if (!session || session.isGuest) return;
    try {
      localStorage.setItem(scopedStorageKey(WORKSPACE_MODE_KEY, session.userId), workspaceMode);
    } catch {
      // ignore
    }
  }, [workspaceMode, session]);

  useEffect(() => {
    pendingConfirmationRef.current = pendingConfirmation;
    voiceContextRef.current = {
      workspaceMode,
      activeTab: rightTab,
      previewDevice,
      isEditorFullscreen,
      isPreviewFullscreen,
      hasOpenOverlay: Boolean(
        showProjectsModal ||
          showSettingsModal ||
          showDeployModal ||
          isEditorFullscreen ||
          isPreviewFullscreen ||
          isPresentationMode
      ),
      hasPendingConfirm: Boolean(pendingConfirmation),
      projectFiles: Object.keys(currentProject?.files || {}),
      availableProjects: projects.map((p) => p.name),
      isMissionActive: mission.active,
      isMissionPaused: mission.paused,
      hasActiveMedia: jarvisMediaState.hasActiveMedia,
      mediaSource: jarvisMediaState.mediaSource,
      isMediaPaused: jarvisMediaState.isPaused,
      hasActiveStage: Boolean(jarvisMediaState.activeStageKind),
      activeLocalKind:
        jarvisMediaState.activeStageKind === 'local_gallery'
          ? 'image'
          : jarvisMediaState.activeStageKind === 'local_browser'
          ? 'browser'
          : jarvisMediaState.mediaSource === 'local'
          ? jarvisMediaState.mediaKind
          : undefined,
      hasActiveReading: readingStatus.active,
      isReadingPaused: readingStatus.paused,
      isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
      recentUserUtterances: recentUtterancesRef.current,
      lastTopic: lastDomainTopicRef.current,
      lastTrackTitle: jarvisMediaState.mediaTitle,
      lastTrackArtist: jarvisMediaState.mediaArtist,
      isOwner,
      callName: callerName,
      isSilenced: isSaraSilenced,
      isCallMode,
    };
  }, [
    workspaceMode,
    pendingConfirmation,
    rightTab,
    previewDevice,
    isEditorFullscreen,
    isPreviewFullscreen,
    isPresentationMode,
    showProjectsModal,
    showSettingsModal,
    showDeployModal,
    currentProject?.files,
    projects,
    mission.active,
    mission.paused,
    jarvisMediaState,
    readingStatus.active,
    readingStatus.paused,
    isOwner,
    callerName,
  ]);

  const pushRecentUtterance = useCallback((utterance: string) => {
    const clean = String(utterance || '').trim();
    if (!clean) return;
    recentUtterancesRef.current = [...recentUtterancesRef.current, clean].slice(-5);
    const detected = inferDomainFromText(clean);
    if (detected !== 'general') {
      lastDomainTopicRef.current = detected;
    }
    voiceContextRef.current = {
      ...voiceContextRef.current,
      recentUserUtterances: recentUtterancesRef.current,
      lastTopic: lastDomainTopicRef.current,
    };
  }, []);

  useEffect(() => {
    setSpeakingStateListener((speaking) => {
      isSaraSpeakingRef.current = speaking;
      setIsSaraSpeaking(speaking);
    });
    return () => setSpeakingStateListener(null);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  const handleLogout = useCallback(
    async (notice?: string, spokenGoodbye?: string) => {
      shouldKeepListeningRef.current = false;
      stopMicRef.current?.();
      stopMicRef.current = null;
      setIsListening(false);
      stopSaraSpeech();
      stopVoiceReading();

      await hideFromRadarImmediately(session);
      await markCurrentDeviceOfflineOnLogout(session);
      setBackgroundActiveLifecycleFlag(false);
      stopBackgroundWorkerLoop();
      void releaseScreenWakeLock();
      stopSilentAudioKeepAlive();
      void syncPersistentBackgroundNotification(false);
      stopLoudDeviceAlarmLoop();

      await logoutCurrentSession(session);
      hydratedUidRef.current = null;
      syncedUpdatedAtRef.current = {};
      setAppearOnMap(false);
      setGhostMode(false);
      setIncomingPending([]);
      setOutgoingGrants([]);
      setSharedPeers([]);
      setDevices([]);
      setActiveBottomTab('assistente');
      setShowAdminModal(false);
      setShowProjectsModal(false);
      setShowSettingsModal(false);
      setShowDeployModal(false);
      setManualProposal(EMPTY_MANUAL_PROPOSAL);
      setMission(EMPTY_MISSION);
      setSession(null);
      setGuestSecondsLeft(null);
      setUnreadAlertsCount(0);
      setExitNotice(notice || null);
      if (spokenGoodbye) {
        speakAsSara(spokenGoodbye, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
      }
    },
    [session]
  );

  const handleAuthenticated = useCallback(
    (newSession: SaraSession, isNewAccount = false) => {
      setExitNotice(null);
      setShowAdminModal(false);
      setShowProjectsModal(false);
      setShowSettingsModal(false);
      setShowDeployModal(false);
      setManualProposal(EMPTY_MANUAL_PROPOSAL);
      setMission(EMPTY_MISSION);
      hydratedUidRef.current = null;
      syncedUpdatedAtRef.current = {};
      lastInteractionRef.current = Date.now();

      const nextProjects = loadInitialProjects(newSession);
      const nextActiveId = loadInitialActiveProjectId(newSession, nextProjects);
      setProjects(nextProjects);
      setCurrentProjectId(nextActiveId);
      setMessages(loadInitialChat(newSession));
      setWorkspaceMode(loadInitialWorkspaceMode(newSession));
      setAgentMode(loadInitialAgentMode(newSession));
      setVoiceLevel(loadInitialVoiceLevel(newSession));
      setErrorsFixedCount(loadInitialErrorsFixed(newSession));
      setResumableMission(loadResumableMission(newSession));
      setActiveFile('index.html');
      setRefreshSeed((s) => s + 1);

      const alertsCount = newSession.isOwner ? getUnreadAlertsLocal(newSession).length : 0;
      setUnreadAlertsCount(alertsCount);
      setGuestSecondsLeft(
        newSession.isGuest && newSession.expiresAt
          ? Math.max(0, Math.ceil((newSession.expiresAt - Date.now()) / 1000))
          : null
      );

      // O mapa começa SEMPRE vazio/DESLIGADO ao iniciar sessão para máxima privacidade
      setAppearOnMap(false);
      setGhostMode(false);
      setSavedRadarVisibilityPref(newSession.userId, false);
      setBgSettings(loadBackgroundSettings(newSession.userId));
      setReminders(loadBackgroundReminders(newSession.userId));
      setBubbleDismissed(false);
      setActiveBottomTab('assistente');

      setSession(newSession);

      const greeting = getLoginGreetingSpeech(
        newSession.callName,
        newSession.isOwner,
        alertsCount,
        newSession.isGuest,
        isNewAccount
      );
      pendingLoginSpeechRef.current = greeting;
      speakAsSara(greeting, voiceEnabledRef.current, {
        level: 'medium',
        forceSpeak: true,
      });

      if (window.location.pathname === '/admin') {
        if (newSession.isOwner) {
          setShowAdminModal(true);
        } else {
          window.history.replaceState({}, '', '/');
          void logAdminAlert({
            type: 'admin_attempt',
            userId: newSession.userId,
            userName: newSession.callName,
            userEmail: newSession.email,
            summary: `${newSession.callName} tentou aceder diretamente à rota /admin.`,
          });
          showToast('Não tens acesso a isso.');
        }
      }
    },
    [showToast]
  );

  // Handlers de Localização, Radar, Achar Meu Celular e Segundo Plano
  const handleChangeBottomTab = useCallback(
    (tab: 'assistente' | 'mapa' | 'perfil', profileSub?: ProfileSubTab) => {
      if (workspaceModeRef.current !== 'jarvis') {
        setWorkspaceMode('jarvis');
        workspaceModeRef.current = 'jarvis';
      }
      if (profileSub) {
        setProfileSubTab(profileSub);
      }
      setActiveBottomTab(tab);
    },
    []
  );

  const handleUpdateMyCoords = useCallback(
    (coords: {
      lat: number;
      lng: number;
      accuracyM?: number | null;
      speedMps?: number | null;
      source?: LocationSignalSource;
      timestamp?: number;
    }) => {
      setMyCoords(coords);
      myCoordsRef.current = coords;
    },
    []
  );

  const handleToggleAppearOnMap = useCallback(async () => {
    const activeSess = sessionRef.current;
    if (!activeSess || activeSess.isGuest) {
      showToast('Entra na tua conta para aparecer no mapa.');
      return;
    }
    const next = !appearOnMapRef.current;
    setAppearOnMap(next);
    appearOnMapRef.current = next;
    setSavedRadarVisibilityPref(activeSess.userId, next);

    if (!next) {
      setGhostMode(false);
      ghostModeRef.current = false;
      await hideFromRadarImmediately(activeSess);
      showToast('Aparecer no Mapa: DESLIGADO. Já não estás visível.');
      return;
    }

    setGhostMode(false);
    ghostModeRef.current = false;
    const coords = await requestCurrentCoordinates();
    if (coords) {
      handleUpdateMyCoords(coords);
      await publishCurrentRadarPresence({
        session: activeSess,
        visible: true,
        ghostMode: false,
        coords,
      });
      showToast('Aparecer no Mapa: LIGADO (visível apenas mediante pedido aceite).');
    } else {
      await publishCurrentRadarPresence({
        session: activeSess,
        visible: true,
        ghostMode: false,
        coords: myCoordsRef.current,
      });
      showToast('Aparecer no Mapa ligado — ativa a localização do aparelho.');
    }
  }, [handleUpdateMyCoords, showToast]);

  const handleActivateGhostMode = useCallback(async () => {
    const activeSess = sessionRef.current;
    if (!activeSess || activeSess.isGuest) return;
    setGhostMode(true);
    ghostModeRef.current = true;
    setAppearOnMap(false);
    appearOnMapRef.current = false;
    setSavedRadarVisibilityPref(activeSess.userId, false);
    await hideFromRadarImmediately(activeSess);
    showToast('Modo Fantasma ativo — desapareceste imediatamente.');
  }, [showToast]);

  const handleStopSharingAll = useCallback(async () => {
    const activeSess = sessionRef.current;
    if (!activeSess || activeSess.isGuest) return;
    setAppearOnMap(false);
    appearOnMapRef.current = false;
    setSavedRadarVisibilityPref(activeSess.userId, false);
    await stopAllOutgoingShares(activeSess);
    showToast('Todas as partilhas de localização foram paradas.');
  }, [showToast]);

  const handleRefreshDeviceNow = useCallback(async () => {
    const activeSess = sessionRef.current;
    if (!activeSess || activeSess.isGuest) return;
    const coords = await requestCurrentCoordinates();
    if (coords) {
      handleUpdateMyCoords(coords);
    }
    const bg = bgSettingsRef.current;
    await syncCurrentDeviceTelemetry({
      session: activeSess,
      findPhoneEnabled: bg.findPhoneEnabled,
      lowBatteryAutoLocate: bg.lowBatteryAutoLocate,
      sosSmsEnabled: bg.sosSmsEnabled,
      sosPhoneNumber: bg.sosPhoneNumber,
      includeGpsLocation: true,
    });
    lastTelemetrySyncAtRef.current = Date.now();
    showToast('Posição e bateria do aparelho atualizadas.');
  }, [handleUpdateMyCoords, showToast]);

  const handleUpdateBgSettings = useCallback((patch: Partial<BackgroundSettings>) => {
    const activeSess = sessionRef.current;
    setBgSettings((prev) => {
      const next = { ...prev, ...patch };
      bgSettingsRef.current = next;
      saveBackgroundSettings(activeSess?.userId, next);
      if ('findPhoneEnabled' in patch && activeSess && !activeSess.isGuest) {
        void syncCurrentDeviceTelemetry({
          session: activeSess,
          findPhoneEnabled: next.findPhoneEnabled,
          lowBatteryAutoLocate: next.lowBatteryAutoLocate,
          sosSmsEnabled: next.sosSmsEnabled,
          sosPhoneNumber: next.sosPhoneNumber,
          includeGpsLocation: false,
        });
      }
      return next;
    });
  }, []);

  const handlePermitBackground = useCallback(async () => {
    const activeSess = sessionRef.current;
    if (!activeSess || activeSess.isGuest) {
      showToast('Cria ou entra numa conta para usar Segundo Plano.');
      return;
    }
    const perm = await requestNotificationPermissionIfNeeded();
    setNotificationPermission(perm);

    const coords = await requestCurrentCoordinates();
    if (coords) handleUpdateMyCoords(coords);

    handleUpdateBgSettings({
      backgroundAllowed: true,
      persistentNotification: true,
    });
    setBackgroundActiveLifecycleFlag(true);
    setBubbleDismissed(false);

    await requestScreenWakeLock();
    startSilentAudioKeepAlive();
    await syncPersistentBackgroundNotification(true);
    if (bgSettingsRef.current.continuousVoiceBg && !shouldKeepListeningRef.current) {
      startHandsFreeMicRef.current?.();
    }
    showToast('Segundo Plano ativado! A SARA continua ativa.');
  }, [handleUpdateBgSettings, handleUpdateMyCoords, showToast]);

  const handleStopBackground = useCallback(async () => {
    handleUpdateBgSettings({
      backgroundAllowed: false,
    });
    setBackgroundActiveLifecycleFlag(false);
    stopBackgroundWorkerLoop();
    await releaseScreenWakeLock();
    stopSilentAudioKeepAlive();
    await syncPersistentBackgroundNotification(false);
    showToast('Segundo Plano parado imediatamente.');
  }, [handleUpdateBgSettings, showToast]);

  const handleDeleteReminder = useCallback(
    (id: string) => {
      const activeSess = sessionRef.current;
      setReminders((prev) => {
        const next = prev.filter((r) => r.id !== id);
        saveBackgroundReminders(activeSess?.userId, next);
        return next;
      });
      showToast('Lembrete removido.');
    },
    [showToast]
  );

  const handleScheduleBackgroundReminder = useCallback(
    (text: string): { handled: boolean; reply?: string } => {
      const activeSess = sessionRef.current;
      const parsed = parseBackgroundReminderInput(text);
      if (!parsed) return { handled: false };
      if (!activeSess || activeSess.isGuest) {
        return {
          handled: true,
          reply: 'Entra numa conta para guardar lembretes em segundo plano.',
        };
      }
      setReminders((prev) => {
        const next = [...prev, parsed];
        saveBackgroundReminders(activeSess.userId, next);
        return next;
      });
      void requestNotificationPermissionIfNeeded().then(setNotificationPermission);
      void syncReminderToServiceWorker(parsed);
      showToast(`Lembrete agendado para as ${parsed.timeHHmm}`);
      return {
        handled: true,
        reply: `Combinado! Lembrete em segundo plano marcado para as ${parsed.timeHHmm}: "${parsed.title}".`,
      };
    },
    [showToast]
  );

  // Avisar se navegador fechou enquanto Segundo Plano estava ativo
  useEffect(() => {
    const closedMsg = consumeBrowserClosedBackgroundNotice();
    if (closedMsg) {
      showToast(closedMsg);
      void showSaraSystemNotification({
        title: 'SARA Segundo Plano',
        body: closedMsg,
        tag: 'sara-closed-notice',
      });
    }
  }, [showToast]);

  // Marcar encerramento se o navegador fechar com Segundo Plano ligado + visibilidade para mini-janela/bolha
  useEffect(() => {
    const handleVisibility = () => {
      const hidden = document.visibilityState === 'hidden';
      setIsPageHidden(hidden);
      if (!hidden && bgSettingsRef.current.backgroundAllowed) {
        void requestScreenWakeLock();
      }
    };
    const handleBlur = () => setIsPageHidden(true);
    const handleFocus = () => setIsPageHidden(false);
    const handleUnload = () => {
      const sess = sessionRef.current;
      if (sess && !sess.isGuest && bgSettingsRef.current.backgroundAllowed) {
        markBrowserClosingWhileBackgroundActive();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, []);

  // Escutar cliques em botões de Notificação do Service Worker (Aceitar 30min/1h/Recusar ou Voltar ao chat)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onSwMessage = (ev: MessageEvent) => {
      const msg = ev.data;
      if (!msg || msg.type !== 'SARA_NOTIFICATION_CLICK') return;
      const activeSess = sessionRef.current;
      if (msg.action === 'return_to_chat' || msg.tag === 'sara-persistent-bg') {
        setWorkspaceMode('jarvis');
        setActiveBottomTab('assistente');
        return;
      }
      const reqId = msg.data?.requestId as string | undefined;
      const targetReq = reqId ? incomingPendingRef.current.find((r) => r.id === reqId) : undefined;
      if (!targetReq || !activeSess || activeSess.isGuest) return;
      if (msg.action === 'accept_30m') {
        void respondToLocationRequest(targetReq, '30m').then(async () => {
          const coords = await requestCurrentCoordinates();
          await publishCurrentRadarPresence({
            session: activeSess,
            visible: true,
            ghostMode: false,
            coords: coords || myCoordsRef.current,
          });
          showToast('Localização partilhada por 30 minutos.');
        });
      } else if (msg.action === 'accept_1h') {
        void respondToLocationRequest(targetReq, '1h').then(async () => {
          const coords = await requestCurrentCoordinates();
          await publishCurrentRadarPresence({
            session: activeSess,
            visible: true,
            ghostMode: false,
            coords: coords || myCoordsRef.current,
          });
          showToast('Localização partilhada por 1 hora.');
        });
      } else if (msg.action === 'decline') {
        void respondToLocationRequest(targetReq, 'decline').then(() => {
          showToast('Pedido de localização recusado.');
        });
      }
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
  }, [showToast]);

  // Atalho global PC: CTRL + ESPAÇO acorda a SARA e começa a ouvir
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!sessionRef.current) return;
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        isCallModeRef.current = false;
        isSaraSilencedRef.current = false;
        setSaraCallMode(false);
        setSaraSilenced(false);
        setIsCallModeState(false);
        setIsSaraSilencedState(false);
        setBubbleDismissed(false);
        if (!shouldKeepListeningRef.current) {
          startHandsFreeMicRef.current?.();
        }
        showToast('SARA acordada (CTRL + ESPAÇO) — estou a ouvir!');
        speakAsSara('Estou a ouvir.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showToast]);

  // Subscrições em tempo real de Radar (pedidos + localizações aceites) e Aparelhos (Achar Meu Celular)
  useEffect(() => {
    if (!session || session.isGuest) return;
    const unsubRadar = subscribeRadarRequestsAndPeers({
      session,
      myCoords,
      onUpdate: ({ incomingPending: inc, outgoingGrants: out, sharedPeers: peers }) => {
        setIncomingPending(inc);
        setOutgoingGrants(out);
        setSharedPeers(peers);

        // Notificar novos pedidos recebidos
        for (const req of inc) {
          if (!seenIncomingReqIdsRef.current.has(req.id)) {
            seenIncomingReqIdsRef.current.add(req.id);
            showToast(`${req.fromCallName} (${req.fromSaraId}) pediu a tua localização!`);
            void postMessageToServiceWorker({
              type: 'SARA_LOC_REQUEST_NOTIFY',
              requestId: req.id,
              fromName: req.fromCallName,
              fromSaraId: req.fromSaraId,
            });
          }
        }
      },
    });

    const unsubDevices = subscribeAccountDevices(session, (devList) => {
      setDevices(devList);
      devicesRef.current = devList;
      const myDev = devList.find((d) => d.deviceCode === session.deviceCode);
      if (myDev?.pendingCommand && session.deviceCode) {
        const cmd = myDev.pendingCommand;
        if (cmd.type === 'ring') {
          setActiveAlarmRinging(true);
          startLoudDeviceAlarmLoop();
          showToast('Alarme remoto Achar Meu Celular ativado!');
          speakAsSara('Atenção! Alarme de localização Achar Meu Celular ativado.', true, {
            level: 'short',
            forceSpeak: true,
          });
          void acknowledgeAndClearPendingCommand(session.userId, session.deviceCode);
        } else if (cmd.type === 'lock') {
          const nextLock: DeviceLockState = {
            locked: true,
            message: cmd.message || 'Aparelho perdido. Por favor devolva.',
            contactPhone: cmd.contactPhone || '',
            lockedAt: new Date().toISOString(),
          };
          setSavedDeviceLockState(nextLock);
          setDeviceLockState(nextLock);
          void acknowledgeAndClearPendingCommand(session.userId, session.deviceCode);
        } else if (cmd.type === 'wipe') {
          void acknowledgeAndClearPendingCommand(session.userId, session.deviceCode).finally(() => {
            executeRemoteDeviceWipeLocal(session.userId);
            void handleLogout('Os dados locais deste aparelho foram apagados remotamente.');
          });
        }
      }
    });

    return () => {
      unsubRadar();
      unsubDevices();
    };
  }, [session, myCoords, showToast, handleLogout]);

  // Telemetria inicial + Bateria Fraca (< 10%) + Ciclo de 5 minutos + Lembretes em Segundo Plano + SMS 1h offline
  useEffect(() => {
    if (!session || session.isGuest) return;

    const syncOnce = async () => {
      const coords = await requestCurrentCoordinates();
      if (coords) handleUpdateMyCoords(coords);
      const bg = bgSettingsRef.current;
      await syncCurrentDeviceTelemetry({
        session,
        findPhoneEnabled: bg.findPhoneEnabled,
        lowBatteryAutoLocate: bg.lowBatteryAutoLocate,
        sosSmsEnabled: bg.sosSmsEnabled,
        sosPhoneNumber: bg.sosPhoneNumber,
        includeGpsLocation: true,
      });
      if (appearOnMapRef.current && !ghostModeRef.current) {
        await publishCurrentRadarPresence({
          session,
          visible: true,
          ghostMode: false,
          coords: coords || myCoordsRef.current,
        });
      }
      lastTelemetrySyncAtRef.current = Date.now();
    };

    void syncOnce();

    // Bateria abaixo de 10% envia última localização imediatamente
    let batteryObj: any = null;
    const onBatteryChange = () => {
      if (!batteryObj || !bgSettingsRef.current.lowBatteryAutoLocate) return;
      const pct = Math.round((batteryObj.level || 1) * 100);
      if (pct > 0 && pct < 10) {
        void requestCurrentCoordinates().then((coords) => {
          if (coords) handleUpdateMyCoords(coords);
          const bg = bgSettingsRef.current;
          void syncCurrentDeviceTelemetry({
            session,
            findPhoneEnabled: true,
            lowBatteryAutoLocate: bg.lowBatteryAutoLocate,
            sosSmsEnabled: bg.sosSmsEnabled,
            sosPhoneNumber: bg.sosPhoneNumber,
            includeGpsLocation: true,
          });
          showToast(`Bateria a ${pct}% — última localização enviada automaticamente.`);
        });
      }
    };
    const navAny = navigator as any;
    if (typeof navAny.getBattery === 'function') {
      navAny
        .getBattery()
        .then((bat: any) => {
          batteryObj = bat;
          bat?.addEventListener?.('levelchange', onBatteryChange);
        })
        .catch(() => {});
    }

    const runBackgroundOrPeriodicTick = () => {
      const activeSess = sessionRef.current;
      if (!activeSess || activeSess.isGuest) return;

      // 1. Lembretes em Segundo Plano devidos
      const now = Date.now();
      const dueList = remindersRef.current.filter((r) => !r.fired && r.targetMs <= now);
      if (dueList.length > 0) {
        const updated = remindersRef.current.map((r) =>
          !r.fired && r.targetMs <= now ? { ...r, fired: true } : r
        );
        remindersRef.current = updated;
        setReminders(updated);
        saveBackgroundReminders(activeSess.userId, updated);
        for (const rem of dueList) {
          playReminderBellChime();
          showToast(`Lembrete SARA: ${rem.title}`);
          void showSaraSystemNotification({
            title: 'Lembrete SARA',
            body: rem.title,
            tag: `sara-rem-${rem.id}`,
          });
          speakAsSara(`Lembrete: ${rem.title}`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        }
      }

      // 2. Enviar localização de 5 em 5 minutos se GPS e internet ativos
      const elapsed = now - lastTelemetrySyncAtRef.current;
      if (elapsed >= 5 * 60 * 1000 && navigator.onLine) {
        lastTelemetrySyncAtRef.current = now;
        const bg = bgSettingsRef.current;
        void requestCurrentCoordinates().then((coords) => {
          if (coords) handleUpdateMyCoords(coords);
          void syncCurrentDeviceTelemetry({
            session: activeSess,
            findPhoneEnabled: bg.findPhoneEnabled,
            lowBatteryAutoLocate: bg.lowBatteryAutoLocate,
            sosSmsEnabled: bg.sosSmsEnabled,
            sosPhoneNumber: bg.sosPhoneNumber,
            includeGpsLocation: true,
          });
          if (appearOnMapRef.current && !ghostModeRef.current) {
            void publishCurrentRadarPresence({
              session: activeSess,
              visible: true,
              ghostMode: false,
              coords: coords || myCoordsRef.current,
            });
          }
        });
      }

      // 3. Verificar SMS de Socorro se aparelho ficar 1 hora sem internet
      const bg = bgSettingsRef.current;
      const sosEval = evaluateOfflineSosCondition({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        sosSmsEnabled: bg.sosSmsEnabled,
        sosPhoneNumber: bg.sosPhoneNumber,
        nowMs: now,
      });
      if (sosEval.shouldTrigger) {
        const myDev = devicesRef.current.find((d) => d.deviceCode === activeSess.deviceCode);
        const smsUri = buildEmergencySmsUri({
          phoneNumber: bg.sosPhoneNumber,
          callName: activeSess.callName,
          deviceCode: activeSess.deviceCode || 'CEL-0000',
          lat: myDev?.lastLat ?? myCoordsRef.current?.lat ?? null,
          lng: myDev?.lastLng ?? myCoordsRef.current?.lng ?? null,
          lastUpdatedAt: myDev?.lastUpdatedAt || new Date(now).toISOString(),
        });
        setSosSmsBanner({
          uri: smsUri,
          phone: bg.sosPhoneNumber,
          offlineMinutes: Math.max(60, Math.round(sosEval.offlineDurationMs / 60000)),
        });
        void showSaraSystemNotification({
          title: 'SMS de Socorro SARA',
          body: `Sem internet há 1 hora. Toca para enviar SMS com a última localização para ${bg.sosPhoneNumber}.`,
          tag: `sara-sos-${activeSess.deviceCode || 'dev'}`,
        });
      }
    };

    setBackgroundActiveLifecycleFlag(bgSettings.backgroundAllowed);
    if (bgSettings.backgroundAllowed) {
      void syncPersistentBackgroundNotification(bgSettings.persistentNotification);
      void requestScreenWakeLock();
      startSilentAudioKeepAlive();
      startBackgroundWorkerLoop(runBackgroundOrPeriodicTick);
      if (bgSettings.continuousVoiceBg && !shouldKeepListeningRef.current) {
        startHandsFreeMicRef.current?.();
      }
    } else {
      stopBackgroundWorkerLoop();
      void releaseScreenWakeLock();
      stopSilentAudioKeepAlive();
      void syncPersistentBackgroundNotification(false);
    }

    const fallbackInterval = window.setInterval(runBackgroundOrPeriodicTick, 15000);

    return () => {
      window.clearInterval(fallbackInterval);
      stopBackgroundWorkerLoop();
      batteryObj?.removeEventListener?.('levelchange', onBatteryChange);
    };
  }, [
    session,
    bgSettings.backgroundAllowed,
    bgSettings.persistentNotification,
    bgSettings.continuousVoiceBg,
    handleUpdateMyCoords,
    showToast,
  ]);

  // Saudação falada automática ao entrar (também na reabertura de sessão já guardada após 1.º gesto)
  useEffect(() => {
    if (!session) return;
    if (!startupGreetedRef.current && !pendingLoginSpeechRef.current) {
      const alertsCount = session.isOwner ? getUnreadAlertsLocal(session).length : 0;
      setUnreadAlertsCount(alertsCount);
      pendingLoginSpeechRef.current = getLoginGreetingSpeech(
        session.callName,
        session.isOwner,
        alertsCount,
        session.isGuest,
        false
      );
    }

    const flushGreeting = () => {
      if (startupGreetedRef.current || !pendingLoginSpeechRef.current) return;
      startupGreetedRef.current = true;
      const msg = pendingLoginSpeechRef.current;
      pendingLoginSpeechRef.current = null;
      speakAsSara(msg, voiceEnabledRef.current, {
        level: 'medium',
        forceSpeak: true,
      });
    };

    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && (window as any).navigator?.userActivation?.hasBeenActive) {
        flushGreeting();
      }
    }, 450);

    window.addEventListener('pointerdown', flushGreeting, { once: true });
    window.addEventListener('keydown', flushGreeting, { once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', flushGreeting);
      window.removeEventListener('keydown', flushGreeting);
    };
  }, [session?.sessionId]);

  // Proteção da rota /admin (nunca abre nem expõe UI Admin para não-donos)
  useEffect(() => {
    const checkAdminRoute = () => {
      if (window.location.pathname === '/admin') {
        if (session?.isOwner) {
          setShowAdminModal(true);
        } else {
          window.history.replaceState({}, '', '/');
          if (session) {
            void logAdminAlert({
              type: 'admin_attempt',
              userId: session.userId,
              userName: session.callName,
              userEmail: session.email,
              summary: `${session.callName} (${session.email}) tentou abrir a rota /admin.`,
            });
            showToast('Não tens acesso a isso.');
            speakAsSara('Não tens acesso a isso.', voiceEnabledRef.current, {
              level: 'short',
              forceSpeak: true,
            });
          } else {
            setExitNotice('Não tens acesso a isso.');
          }
        }
      }
    };
    checkAdminRoute();
    window.addEventListener('popstate', checkAdminRoute);
    return () => window.removeEventListener('popstate', checkAdminRoute);
  }, [session, showToast]);

  const markUserActivity = useCallback(
    (category?: ActivityCategory) => {
      lastInteractionRef.current = Date.now();
      if (!session) return;
      if (category) {
        recordActivityEvent(session, category);
      }
    },
    [session]
  );

  // Watchdog de 15 minutos de inatividade + Modo Convidado 5m + Heartbeat & Kick/Block check
  useEffect(() => {
    if (!session) return;
    lastInteractionRef.current = Date.now();

    const onActivity = () => {
      lastInteractionRef.current = Date.now();
    };
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('touchstart', onActivity);
    window.addEventListener('wheel', onActivity);

    const idleCheckTimer = setInterval(() => {
      if (Date.now() - lastInteractionRef.current >= INACTIVITY_LIMIT_MS) {
        void handleLogout(
          'Sessão encerrada automaticamente após 15 minutos de inatividade.',
          getInactivityLogoutSpeech()
        );
      }
    }, 10000);

    const heartbeatTimer = setInterval(() => {
      const idleForMs = Date.now() - lastInteractionRef.current;
      updatePresenceHeartbeat(session, idleForMs > 3 * 60 * 1000 ? 'Ausente' : 'Online');
      if (session.isOwner) {
        setUnreadAlertsCount(getUnreadAlertsLocal(session).length);
      }
    }, 25000);

    const validityTimer =
      !session.isOwner && !session.isGuest
        ? setInterval(() => {
            void checkSessionStillValid(session).then((res) => {
              if (!res.valid) {
                void handleLogout('A tua sessão foi encerrada pelo sistema.');
              }
            });
          }, 6000)
        : null;

    const guestTimer =
      session.isGuest && session.expiresAt
        ? setInterval(() => {
            const left = Math.max(0, Math.ceil((session.expiresAt! - Date.now()) / 1000));
            setGuestSecondsLeft(left);
            if (left <= 0) {
              void handleLogout(
                'O modo convidado de 5 minutos terminou. Cria conta ou entra para continuar.',
                getGuestExpirySpeech()
              );
            }
          }, 1000)
        : null;

    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('wheel', onActivity);
      clearInterval(idleCheckTimer);
      clearInterval(heartbeatTimer);
      if (validityTimer) clearInterval(validityTimer);
      if (guestTimer) clearInterval(guestTimer);
    };
  }, [session, handleLogout]);

  // Cronómetro ao vivo durante construção
  useEffect(() => {
    if (!isThinking && !liveBuild.isBuilding) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - start) / 1000);
      setLiveBuild((prev) => ({ ...prev, elapsedSeconds: secs }));
    }, 500);
    return () => clearInterval(interval);
  }, [isThinking, liveBuild.isBuilding]);

  // Cronómetro da Missão Automática
  useEffect(() => {
    if (!mission.active || mission.paused) return;
    const interval = setInterval(() => {
      setMission((prev) => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }));
    }, 1000);
    return () => clearInterval(interval);
  }, [mission.active, mission.paused]);

  useEffect(() => {
    if (!session || session.isGuest) return;
    try {
      localStorage.setItem(
        scopedStorageKey(ERRORS_FIXED_KEY, session.userId),
        String(errorsFixedCount)
      );
    } catch {
      // ignore
    }
  }, [errorsFixedCount, session]);

  // Persiste missão ativa/pausada para "Continuar Depois" isolada por usuário
  useEffect(() => {
    if (!session || session.isGuest) return;
    const key = scopedStorageKey(SAVED_MISSION_KEY, session.userId);
    try {
      if (mission.active && mission.tasks.length > 0 && !mission.finished) {
        localStorage.setItem(key, JSON.stringify(mission));
      } else if (mission.finished) {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  }, [mission, session]);

  useEffect(() => {
    if (!session || session.isGuest) return;
    try {
      localStorage.setItem(
        scopedStorageKey(PROJECTS_STORAGE_KEY, session.userId),
        JSON.stringify(projects)
      );
      localStorage.setItem(
        scopedStorageKey(ACTIVE_PROJECT_KEY, session.userId),
        currentProjectId
      );
    } catch {
      // ignore quota
    }
  }, [projects, currentProjectId, session]);

  // Mantém sara_estado_projeto sempre atualizado com o projeto ativo (isolado por usuário)
  useEffect(() => {
    if (currentProject && effectiveStorageUid) {
      updateProjectStateFromRecord(currentProject, undefined, effectiveStorageUid);
    }
  }, [currentProject, effectiveStorageUid]);

  useEffect(() => {
    if (!session || session.isGuest) return;
    try {
      const trimmedMsgs = messages.slice(-50);
      localStorage.setItem(
        scopedStorageKey(CHAT_STORAGE_KEY, session.userId),
        JSON.stringify(trimmedMsgs)
      );
      const mapKey = scopedStorageKey(CHAT_MAP_STORAGE_KEY, session.userId);
      const mapRaw = localStorage.getItem(mapKey);
      const map: Record<string, ChatMessage[]> = mapRaw ? JSON.parse(mapRaw) : {};
      map[currentProjectId] = trimmedMsgs;
      localStorage.setItem(mapKey, JSON.stringify(map));
    } catch {
      // ignore
    }
  }, [messages, currentProjectId, session]);

  useEffect(() => {
    const unsub = verificarUsuario((user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // Hidratação automática da nuvem isolada por sessão/usuário (nunca em Modo Convidado)
  useEffect(() => {
    if (!authReady || !effectiveStorageUid) return;
    if (hydratedUidRef.current === effectiveStorageUid) return;
    hydratedUidRef.current = effectiveStorageUid;

    let cancelled = false;
    (async () => {
      setIsSyncingFirebase(true);
      try {
        const [projRes, stateRes, prefsRes] = await Promise.allSettled([
          buscarProjetosNoFirebase(effectiveStorageUid),
          buscarEstadosProjetosFirebase(effectiveStorageUid),
          buscarPreferenciasUsuarioFirebase(effectiveStorageUid),
        ]);
        if (cancelled) return;

        const remoteProjects = projRes.status === 'fulfilled' ? projRes.value : [];
        const remoteStates = stateRes.status === 'fulfilled' ? stateRes.value : {};
        const remotePrefs = prefsRes.status === 'fulfilled' ? prefsRes.value : null;

        remoteProjects.forEach((rp) => {
          syncedUpdatedAtRef.current[rp.id] = rp.updatedAt;
        });

        let resolvedTargetId = currentProjectId;
        if (remoteProjects.length > 0) {
          setProjects((prev) => {
            const merged = new Map<string, ProjectRecord>();
            prev.forEach((p) => {
              if (!isProjectBlank(p.files) || remoteProjects.some((rp) => rp.id === p.id)) {
                merged.set(p.id, p);
              }
            });
            remoteProjects.forEach((rp) => {
              const local = merged.get(rp.id);
              const remoteMs = Date.parse(rp.updatedAt || '') || 0;
              const localMs = Date.parse(local?.updatedAt || '') || 0;
              if (!local || remoteMs >= localMs) {
                merged.set(rp.id, rp);
              }
            });
            const arr = Array.from(merged.values()).sort(
              (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
            return arr.length > 0 ? arr : prev;
          });

          if (
            remotePrefs?.activeProjectId &&
            remoteProjects.some((rp) => rp.id === remotePrefs.activeProjectId)
          ) {
            resolvedTargetId = remotePrefs.activeProjectId;
            setCurrentProjectId(resolvedTargetId);
          } else if (
            isProjectBlank(currentProject?.files) &&
            remoteProjects[0]?.id
          ) {
            resolvedTargetId = remoteProjects[0].id;
            setCurrentProjectId(resolvedTargetId);
          }
        }

        if (Object.keys(remoteStates).length > 0) {
          mergeProjectStatesMap(remoteStates, resolvedTargetId, effectiveStorageUid);
        }

        if (remotePrefs) {
          if (remotePrefs.agentMode === 'manual' || remotePrefs.agentMode === 'automatic') {
            setAgentMode(remotePrefs.agentMode);
          }
          if (
            remotePrefs.voiceLevel === 'short' ||
            remotePrefs.voiceLevel === 'medium' ||
            remotePrefs.voiceLevel === 'full'
          ) {
            setVoiceLevel(remotePrefs.voiceLevel);
          }
          if (
            typeof remotePrefs.errorsFixedCount === 'number' &&
            remotePrefs.errorsFixedCount > errorsFixedCount
          ) {
            setErrorsFixedCount(remotePrefs.errorsFixedCount);
          }
        }

        const remoteMsgs = await buscarMensagensChatFirebase(resolvedTargetId, effectiveStorageUid);
        if (!cancelled && remoteMsgs.length > 0) {
          setMessages((prev) => {
            if (prev.length === 0) return remoteMsgs;
            const byId = new Map(prev.map((m) => [m.id, m]));
            remoteMsgs.forEach((rm) => {
              if (!byId.has(rm.id)) byId.set(rm.id, rm);
            });
            return Array.from(byId.values()).slice(-50);
          });
        }
      } catch {
        // fallback silencioso ao localStorage se offline
      } finally {
        if (!cancelled) setIsSyncingFirebase(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, effectiveStorageUid]);

  // Auto-save contínuo e silencioso do projeto ativo + memória isolado por usuário
  useEffect(() => {
    if (!authReady || !effectiveStorageUid || !currentProject || liveBuild.isBuilding) return;
    if (isProjectBlank(currentProject.files) && currentProject.name === 'Novo Projeto') return;
    if (syncedUpdatedAtRef.current[currentProject.id] === currentProject.updatedAt) return;

    const timer = setTimeout(async () => {
      try {
        setIsSyncingFirebase(true);
        syncedUpdatedAtRef.current[currentProject.id] = currentProject.updatedAt;
        await salvarProjetoNoFirebase(currentProject, effectiveStorageUid, callerName);
        const state = updateProjectStateFromRecord(currentProject, undefined, effectiveStorageUid);
        await salvarEstadoProjetoFirebase(state, effectiveStorageUid);
        setProjects((prev) =>
          prev.map((p) =>
            p.id === currentProject.id && p.updatedAt === currentProject.updatedAt
              ? { ...p, syncedToFirebase: true }
              : p
          )
        );
      } catch {
        delete syncedUpdatedAtRef.current[currentProject.id];
      } finally {
        setIsSyncingFirebase(false);
      }
    }, 1600);

    return () => clearTimeout(timer);
  }, [authReady, effectiveStorageUid, callerName, currentProject, liveBuild.isBuilding]);

  // Auto-save das preferências do utilizador isolado
  useEffect(() => {
    if (!authReady || !effectiveStorageUid) return;
    const timer = setTimeout(() => {
      salvarPreferenciasUsuarioFirebase(
        {
          activeProjectId: currentProjectId,
          agentMode,
          voiceLevel,
          errorsFixedCount,
        },
        effectiveStorageUid
      ).catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [authReady, effectiveStorageUid, currentProjectId, agentMode, voiceLevel, errorsFixedCount]);

  const addConsoleLog = useCallback((level: ConsoleEntry['level'], message: string) => {
    const entry: ConsoleEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      level,
      message,
      timestamp: new Date().toLocaleTimeString('pt-PT', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
    if (level === 'error') {
      latestErrorsRef.current = [...latestErrorsRef.current.slice(-6), message];
    }
    setConsoleLogs((prev) => [...prev.slice(-120), entry]);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source !== 'sara-preview-console') return;
      const level = event.data.level || 'log';
      const message = String(event.data.message || '');
      addConsoleLog(level, message);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [addConsoleLog]);

  const replaceCurrentProjectFiles = useCallback(
    (
      newFiles: ProjectFiles,
      newName?: string,
      newType?: ProjectType,
      merge = false,
      snapshotLabel?: string
    ) => {
      setProjects((prev) =>
        prev.map((proj) => {
          if (proj.id !== currentProjectId) return proj;
          const nextFiles = merge ? { ...proj.files, ...newFiles } : { ...newFiles };

          let nextVersions = proj.versions || [];
          if (snapshotLabel && Object.values(proj.files).some((v) => v?.trim())) {
            const snap: VersionSnapshot = {
              id: `ver_${Date.now()}`,
              label: snapshotLabel,
              timestamp: new Date().toLocaleTimeString('pt-PT', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
              files: { ...proj.files },
            };
            nextVersions = [snap, ...nextVersions].slice(0, 15);
          }

          const resolvedProjectName =
            merge && !isProjectBlank(proj.files) && proj.name !== 'Novo Projeto'
              ? proj.name
              : newName || proj.name;
          const resolvedProjectType =
            merge && !isProjectBlank(proj.files) ? proj.type : newType || proj.type;

          return {
            ...proj,
            name: resolvedProjectName,
            type: resolvedProjectType,
            files: nextFiles,
            versions: nextVersions,
            updatedAt: new Date().toISOString(),
          };
        })
      );
    },
    [currentProjectId]
  );

  const handleRestoreVersion = useCallback(
    (versionId: string) => {
      const snap = (currentProject.versions || []).find((v) => v.id === versionId);
      if (!snap) return;
      replaceCurrentProjectFiles(
        snap.files,
        undefined,
        undefined,
        false,
        `Antes de restaurar (${snap.label})`
      );
      setRefreshSeed((s) => s + 1);
      showToast(`Versão restaurada: ${snap.label}`);
      addConsoleLog('info', `Versão anterior restaurada: ${snap.label}`);
    },
    [currentProject.versions, replaceCurrentProjectFiles, showToast, addConsoleLog]
  );

  const handleSaveProjectToFirebase = useCallback(async () => {
    if (!effectiveStorageUid) {
      showToast('Modo Convidado não grava projetos permanentes.');
      return;
    }
    setIsSyncingFirebase(true);
    try {
      await salvarProjetoNoFirebase(currentProject, effectiveStorageUid, callerName);
      setProjects((prev) =>
        prev.map((p) => (p.id === currentProject.id ? { ...p, syncedToFirebase: true } : p))
      );
      addConsoleLog('success', `Projeto "${currentProject.name}" guardado com sucesso.`);
      showToast('Projeto guardado com segurança!');
    } catch {
      addConsoleLog('warn', 'Guardado localmente no navegador.');
      showToast('Projeto guardado localmente!');
    } finally {
      setIsSyncingFirebase(false);
    }
  }, [currentProject, effectiveStorageUid, callerName, addConsoleLog, showToast]);

  const handleLoadFromFirebase = useCallback(async () => {
    if (!effectiveStorageUid) {
      showToast('Modo Convidado não possui projetos guardados.');
      return;
    }
    setIsSyncingFirebase(true);
    try {
      const remoteProjects = await buscarProjetosNoFirebase(effectiveStorageUid);
      if (remoteProjects.length > 0) {
        setProjects((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          remoteProjects.forEach((rp) => map.set(rp.id, rp));
          return Array.from(map.values());
        });
        addConsoleLog('success', `${remoteProjects.length} projeto(s) sincronizado(s).`);
        showToast(`${remoteProjects.length} projeto(s) sincronizado(s)!`);
      } else {
        addConsoleLog('info', 'Nenhum projeto remoto encontrado para esta conta.');
      }
    } catch {
      addConsoleLog('warn', 'Sincronização em espera de rede.');
    } finally {
      setIsSyncingFirebase(false);
    }
  }, [effectiveStorageUid, addConsoleLog, showToast]);

  const handleDownloadZip = useCallback(async () => {
    await downloadProjectZip(currentProject.files, currentProject.name);
    showToast('ZIP descarregado!');
  }, [currentProject.files, currentProject.name, showToast]);

  const normalizeMatchText = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const findProjectByQuery = useCallback(
    (query?: string): ProjectRecord | undefined => {
      if (!query) return currentProject;
      const q = normalizeMatchText(query);
      if (!q) return currentProject;
      return (
        projects.find((p) => normalizeMatchText(p.name) === q) ||
        projects.find((p) => normalizeMatchText(p.name).includes(q)) ||
        projects.find((p) => q.includes(normalizeMatchText(p.name)))
      );
    },
    [projects, currentProject]
  );

  const handleDeleteFile = useCallback(
    (filePath: string) => {
      setProjects((prev) =>
        prev.map((proj) => {
          if (proj.id !== currentProjectId) return proj;
          const copy = { ...proj.files };
          delete copy[filePath];
          return {
            ...proj,
            files: copy,
            updatedAt: new Date().toISOString(),
          };
        })
      );
      if (activeFile === filePath) {
        const remaining = Object.keys(currentProject.files).filter((k) => k !== filePath);
        setActiveFile(remaining[0] || 'index.html');
      }
    },
    [currentProjectId, activeFile, currentProject.files]
  );

  const switchToProject = useCallback(
    async (target: ProjectRecord) => {
      setCurrentProjectId(target.id);
      const keys = Object.keys(target.files || {});
      setActiveFile(keys.includes('index.html') ? 'index.html' : keys[0] || 'index.html');
      setRefreshSeed((s) => s + 1);
      if (effectiveStorageUid) {
        updateProjectStateFromRecord(target, undefined, effectiveStorageUid);
      }

      const localChat = loadCachedProjectChat(target.id, session);
      setMessages(localChat);

      if (!effectiveStorageUid) return;
      const remoteMsgs = await buscarMensagensChatFirebase(target.id, effectiveStorageUid).catch(
        () => []
      );
      if (remoteMsgs.length > 0) {
        setMessages((prev) => {
          const base = prev.length > 0 ? prev : localChat;
          const byId = new Map(base.map((m) => [m.id, m]));
          remoteMsgs.forEach((rm) => {
            if (!byId.has(rm.id)) byId.set(rm.id, rm);
          });
          return Array.from(byId.values()).slice(-50);
        });
      }
    },
    [effectiveStorageUid, session]
  );

  const handleCreateNewProject = useCallback(
    (name: string, type: ProjectType) => {
      const cleanName = name.trim() || 'Novo Projeto';
      const newProj = createStarterProject(cleanName, type);
      setProjects((prev) => [newProj, ...prev]);
      setCurrentProjectId(newProj.id);
      setMessages([]);
      setActiveFile('index.html');
      setRefreshSeed((s) => s + 1);
      addConsoleLog('success', `Novo projeto "${cleanName}" (${type}) criado.`);
      if (effectiveStorageUid) {
        const state = updateProjectStateFromRecord(newProj, undefined, effectiveStorageUid);
        salvarProjetoNoFirebase(newProj, effectiveStorageUid, callerName).catch(() => {});
        salvarEstadoProjetoFirebase(state, effectiveStorageUid).catch(() => {});
      }
    },
    [addConsoleLog, effectiveStorageUid, callerName]
  );

  const handleDuplicateProject = useCallback(
    (proj: ProjectRecord) => {
      const copy: ProjectRecord = {
        ...proj,
        id: `proj_${Date.now()}`,
        name: `${proj.name} (Cópia)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncedToFirebase: false,
      };
      setProjects((prev) => [copy, ...prev]);
      setCurrentProjectId(copy.id);
      if (effectiveStorageUid) {
        const state = updateProjectStateFromRecord(copy, undefined, effectiveStorageUid);
        salvarProjetoNoFirebase(copy, effectiveStorageUid, callerName).catch(() => {});
        salvarEstadoProjetoFirebase(state, effectiveStorageUid).catch(() => {});
      }
    },
    [effectiveStorageUid, callerName]
  );

  const handleRenameProject = useCallback((id: string, newName: string) => {
    const clean = newName.trim();
    if (!clean) return;
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: clean, updatedAt: new Date().toISOString() } : p))
    );
  }, []);

  const handleDeleteProject = useCallback(
    (id: string) => {
      setProjects((prev) => {
        const remaining = prev.filter((p) => p.id !== id);
        if (remaining.length === 0) {
          const fresh = createStarterProject();
          setCurrentProjectId(fresh.id);
          setActiveFile('index.html');
          setRefreshSeed((s) => s + 1);
          return [fresh];
        }
        if (id === currentProjectId) {
          const nextProj = remaining[0];
          setCurrentProjectId(nextProj.id);
          const keys = Object.keys(nextProj.files);
          setActiveFile(keys.includes('index.html') ? 'index.html' : keys[0] || 'index.html');
          setRefreshSeed((s) => s + 1);
        }
        return remaining;
      });
      if (effectiveStorageUid) {
        apagarProjetoNoFirebase(id, effectiveStorageUid).catch(() => {});
      }
    },
    [currentProjectId, effectiveStorageUid]
  );

  // Atalhos globais de teclado: Ctrl+S salvar, Ctrl+P apresentação, Ctrl+E editor fullscreen, Esc sair
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveProjectToFirebase();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsPresentationMode((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setRightTab('editor');
        setIsEditorFullscreen((v) => !v);
      } else if (e.key === 'Escape') {
        setIsPresentationMode(false);
        setIsEditorFullscreen(false);
        setIsPreviewFullscreen(false);
        interruptSaraAndListen();
      } else if (
        e.code === 'Space' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        isSaraSpeakingRef.current
      ) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName || '';
        const isEditable =
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          Boolean(target?.isContentEditable);
        if (!isEditable) {
          e.preventDefault();
          interruptSaraAndListen();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSaveProjectToFirebase]);

  const formatMissionReportText = (rep: MissionReport): string => {
    const mins = Math.floor(rep.elapsedSeconds / 60);
    const secs = rep.elapsedSeconds % 60;
    const targetName = isOwner ? 'Eletro-Jr' : callerName;
    const header = rep.sleptOvernight
      ? `${targetName}, terminei enquanto descansavas! Aqui está o teu sistema **${rep.projectName}** pronto:`
      : `${targetName}, concluí a missão autónoma do projeto **${rep.projectName}**:`;

    return [
      header,
      `- **Etapas concluídas:** ${rep.completedCount} de ${rep.totalCount}`,
      `- **Tempo total:** ${mins}m ${secs}s`,
      `- **Erros corrigidos automaticamente:** ${rep.errorsFixed} (erros finais: ${rep.remainingErrors})`,
      `- **Preview:** Pronto e testado para PC e Telemóvel`,
      ...(isOwner
        ? [
            `- **Cofre de Projetos:** ${rep.githubUrl ? `Guardado em ${rep.githubUrl}` : 'Não enviado (configura a Chave do Cofre nas Configurações do Sistema; o ZIP está pronto para descarregar)'}`,
            `- **Núcleo SARA:** ${rep.firebaseSynced ? 'Guardado na nuvem do Núcleo SARA' : 'Guardado na Memória da SARA'}`,
          ]
        : [
            `- **Exportação:** Pacote ZIP pronto para descarregar`,
            `- **Armazenamento:** ${rep.firebaseSynced ? 'Guardado na tua conta' : 'Guardado na Memória da SARA'}`,
          ]),
      ...(rep.notes.length > 0 ? [`- **Notas da Sara:** ${rep.notes.join(' | ')}`] : []),
    ].join('\n');
  };

  // Executa pipeline do MODO AUTOMÁTICO (1 etapa por vez + teste + autocorreção + teste final + GitHub push + Firebase + Relatório)
  const runAutonomousMission = useCallback(
    async (
      goalText: string,
      options?: {
        resumedMission?: MissionState;
        contextCue?: 'sleep' | 'leave';
        skipUserMsg?: boolean;
        source?: 'text' | 'voice';
        backgroundInJarvis?: boolean;
      }
    ) => {
      const cleanGoal =
        goalText.replace(/^(sara,?\s*faz sozinha:?|miss[aã]o:?)\s*/i, '').trim() || goalText;
      const isRunningInBackground = Boolean(
        options?.backgroundInJarvis || workspaceModeRef.current === 'jarvis'
      );

      markUserActivity('builder');
      missionAbortRef.current = false;
      missionPausedRef.current = false;
      setAgentMode('automatic');
      setManualProposal(EMPTY_MANUAL_PROPOSAL);
      setCompletedBackgroundBuild(null);

      if (!options?.skipUserMsg && !options?.resumedMission && options?.source !== 'voice') {
        const userMsg: ChatMessage = {
          id: `usr_${Date.now()}`,
          sender: 'user',
          text: goalText,
          timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, userMsg]);
      }

      setIsThinking(true);
      setLiveBuild({
        isBuilding: true,
        phase: 'thinking',
        elapsedSeconds: 0,
        steps: [],
        createdFiles: [],
        completedFiles: [],
      });

      const hasExistingAtStart = !isProjectBlank(currentProject.files);

      try {
        let plannedTasks = options?.resumedMission?.tasks || [];
        let startIdx = options?.resumedMission?.currentIndex || 0;
        let missionNotes: string[] = options?.resumedMission?.notes || [];
        let errorsFixed = options?.resumedMission?.errorsFixed || 0;
        let totalErrorsRemaining = options?.resumedMission?.errorCount || 0;
        const startedAtIso = options?.resumedMission?.startedAt || new Date().toISOString();

        if (options?.resumedMission) {
          if (!isRunningInBackground) {
            await speakAsSaraAndWait(
              `Vou retomar agora a construção de ${currentProject.name} exatamente de onde parámos.`,
              voiceEnabledRef.current,
              { level: 'short', forceSpeak: true }
            );
          }
        } else {
          const activeState = loadActiveProjectState(
            currentProject.id,
            effectiveStorageUid || undefined
          );
          const planPromise = planAutonomousMission(
            cleanGoal,
            currentProject.files,
            'automatic',
            getRequestedPastProjects(cleanGoal),
            activeState,
            userIdentity
          );

          let plan;
          if (isRunningInBackground) {
            plan = await planPromise;
          } else {
            const kickoffPromise = fetchSaraFastKickoff({
              prompt: cleanGoal,
              files: currentProject.files,
              agentMode: 'automatic',
              hasExistingCode: hasExistingAtStart,
              projectName: currentProject.name,
              contextCue: options?.contextCue,
              userIdentity,
            });

            // 1. Sara fala PRIMEIRO aceitando o pedido com sugestões práticas enquanto o plano é preparado em paralelo
            const kickoffRes = await kickoffPromise;
            const kickoffChatMsg: ChatMessage = {
              id: `sara_kick_${Date.now()}`,
              sender: 'sara',
              text: kickoffRes.reply,
              timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
              mode: 'conversation',
              voiceDelivered: true,
            };
            setMessages((prev) => [...prev, kickoffChatMsg]);
            if (effectiveStorageUid) {
              salvarMensagemChatFirebase(kickoffChatMsg, currentProject.id, effectiveStorageUid);
            }

            const [resolvedPlan] = await Promise.all([
              planPromise,
              speakAsSaraAndWait(kickoffRes.reply, voiceEnabledRef.current, {
                level: 'medium',
                forceSpeak: true,
              }),
            ]);
            plan = resolvedPlan;
          }

          plannedTasks = (plan.tasks || []).map((t, idx) => ({
            id: idx + 1,
            title: t.title,
            description: t.description,
            status: 'pending' as const,
            attempts: 0,
          }));
          if (Array.isArray(plan.assumedNotes)) {
            missionNotes = [...plan.assumedNotes];
          }

          if (plannedTasks.length === 0) {
            throw new Error('Não foi possível planear as etapas deste projeto.');
          }

          if (effectiveStorageUid) {
            updateProjectStateFromRecord(
              currentProject,
              {
                goal: cleanGoal,
                lastStepDone: 'Planeamento de arquitetura definido',
                nextStep: plannedTasks[0]?.title || 'Executar Etapa 1',
                missingFeatures: plannedTasks.map((t) => t.title),
              },
              effectiveStorageUid
            );
          }

          setLiveBuild((prev) => ({
            ...prev,
            phase: 'planning',
            planSentence: plan.planSentence,
          }));

          setMessages((prev) => [
            ...prev,
            {
              id: `sara_plan_${Date.now()}`,
              sender: 'sara',
              text: `${plan.intro}\n\n${plannedTasks
                .map((t) => `${t.id}. **${t.title}** — ${t.description}`)
                .join('\n')}`,
              timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
              mode: 'mission',
            },
          ]);
        }

        setIsThinking(false);
        setMission({
          active: true,
          paused: false,
          goal: cleanGoal,
          tasks: plannedTasks,
          currentIndex: startIdx,
          errorCount: totalErrorsRemaining,
          errorsFixed,
          elapsedSeconds: options?.resumedMission?.elapsedSeconds || 0,
          startedAt: startedAtIso,
          notes: missionNotes,
          finished: false,
        });

        let workingFiles: ProjectFiles = { ...currentProject.files };
        let resolvedName = currentProject.name;
        let resolvedType = currentProject.type;

        for (let i = startIdx; i < plannedTasks.length; i++) {
          if (missionAbortRef.current) return;
          while (missionPausedRef.current) {
            if (missionAbortRef.current) return;
            await new Promise((r) => setTimeout(r, 400));
          }

          const task = plannedTasks[i];
          setMission((prev) => ({
            ...prev,
            currentIndex: i,
            tasks: prev.tasks.map((t, idx) => (idx === i ? { ...t, status: 'running' } : t)),
          }));

          setLiveBuild((prev) => ({
            ...prev,
            isBuilding: true,
            phase: 'building',
            planSentence: prev.planSentence || `Missão autónoma: ${cleanGoal}`,
            currentStepLabel: `Etapa ${i + 1} de ${plannedTasks.length} — ${task.title}`,
            steps: plannedTasks.map((t, idx) => ({
              id: t.id,
              label: t.title,
              status: idx < i ? 'done' : idx === i ? 'running' : 'pending',
            })),
            createdFiles: Object.keys(workingFiles),
            completedFiles: Object.keys(workingFiles),
          }));

          addConsoleLog('info', `[Automático] Etapa ${i + 1}/${plannedTasks.length}: ${task.title}`);

          let taskSucceeded = false;
          let attempts = 0;

          while (!taskSucceeded && attempts < 3) {
            if (missionAbortRef.current) return;
            attempts += 1;
            latestErrorsRef.current = [];

            const stepPrompt =
              attempts === 1
                ? `PROJETO (${cleanGoal}) — ETAPA ${i + 1} de ${plannedTasks.length}: "${task.title}" (${task.description}).
Executa apenas esta etapa de forma 100% completa, real e funcional, mantendo os ficheiros anteriores intactos.`
                : `AUTO-CORREÇÃO (tentativa ${attempts}/3) da etapa "${task.title}". Erros do console: ${latestErrorsRef.current.join(
                    ' | '
                  )}. Corrige agora mantendo tudo completo.`;

            const res = await askSaraBuilderStep({
              prompt: stepPrompt,
              files: workingFiles,
              consoleLogs: consoleLogs.slice(-8),
              history: messages.slice(-6),
              agentMode: 'automatic',
              projectState: loadActiveProjectState(
                currentProject.id,
                effectiveStorageUid || undefined
              ),
              userIdentity,
            });

            if (res.assumedNotes?.length) {
              missionNotes = Array.from(new Set([...missionNotes, ...res.assumedNotes]));
            }

            if (res.updateFiles && res.files) {
              workingFiles = { ...workingFiles, ...res.files };
              const shouldKeepExistingName =
                !isProjectBlank(currentProject.files) && resolvedName !== 'Novo Projeto';
              if (res.projectName && !shouldKeepExistingName) resolvedName = res.projectName;
              if (res.projectType && !shouldKeepExistingName) resolvedType = res.projectType;
              replaceCurrentProjectFiles(
                workingFiles,
                resolvedName,
                resolvedType,
                true,
                `Etapa ${i + 1}: ${task.title}`
              );
              const firstKey = Object.keys(res.files)[0];
              if (firstKey) setActiveFile(firstKey);
              setRefreshSeed((s) => s + 1);
              const allCreated = Object.keys(workingFiles);
              setLiveBuild((prev) => ({
                ...prev,
                createdFiles: allCreated,
                completedFiles: allCreated,
                activeFile: firstKey,
              }));
            }

            setLiveBuild((prev) => ({
              ...prev,
              phase: 'testing',
              activeFile: undefined,
              currentStepLabel: `A testar etapa ${i + 1} no console...`,
            }));

            // Aguarda iframe executar scripts e reportar eventuais erros no console
            await new Promise((r) => setTimeout(r, 1100));

            if (latestErrorsRef.current.length === 0) {
              if (attempts > 1) {
                errorsFixed += 1;
                setErrorsFixedCount((c) => c + 1);
              }
              taskSucceeded = true;
            } else {
              setLiveBuild((prev) => ({
                ...prev,
                phase: 'fixing',
                currentStepLabel: `A corrigir erro na etapa ${i + 1} (tentativa ${attempts}/3)...`,
              }));
              addConsoleLog(
                'warn',
                `[Automático] Erro detetado na etapa ${i + 1}: ${latestErrorsRef.current[0]}`
              );
              if (attempts === 1 && !isRunningInBackground) {
                speakAsSara(
                  'Encontrei 1 erro e já estou a corrigir.',
                  voiceEnabledRef.current,
                  { level: 'short' }
                );
              }
            }
          }

          if (!taskSucceeded) {
            totalErrorsRemaining += 1;
          } else if (i === 0 && plannedTasks.length > 1 && !isRunningInBackground) {
            speakAsSara('Primeira parte pronta, a avançar para a seguinte.', voiceEnabledRef.current, {
              level: 'short',
            });
          }

          const remainingTitles = plannedTasks.slice(i + 1).map((t) => t.title);
          if (effectiveStorageUid) {
            updateProjectStateFromRecord(
              { ...currentProject, name: resolvedName, type: resolvedType, files: workingFiles },
              {
                goal: cleanGoal,
                lastStepDone: `Etapa ${i + 1}/${plannedTasks.length}: ${task.title}`,
                nextStep: remainingTitles[0] || 'Teste final e publicação',
                missingFeatures: remainingTitles,
              },
              effectiveStorageUid
            );
          }

          setMission((prev) => ({
            ...prev,
            errorCount: totalErrorsRemaining,
            errorsFixed,
            notes: missionNotes,
            tasks: prev.tasks.map((t, idx) =>
              idx === i ? { ...t, status: taskSucceeded ? 'done' : 'error', attempts } : t
            ),
          }));
        }

        if (missionAbortRef.current) return;

        // 4. TESTE FINAL COMPLETO (Desktop + Telemóvel + Auditoria de Botões/Formulários)
        setLiveBuild((prev) => ({
          ...prev,
          phase: 'testing',
          currentStepLabel: 'Teste final completo (botões, telas, formulários, PC e telemóvel)...',
        }));

        setPreviewDevice('mobile');
        setRefreshSeed((s) => s + 1);
        await new Promise((r) => setTimeout(r, 700));
        setPreviewDevice('desktop');
        setRefreshSeed((s) => s + 1);

        try {
          const audit = await runSaraFinalTest({
            goal: cleanGoal,
            files: workingFiles,
            consoleLogs: consoleLogs.slice(-15),
            userIdentity,
          });
          if (audit.notes?.length) {
            missionNotes = Array.from(new Set([...missionNotes, ...audit.notes]));
          }
          if (audit.updateFiles && audit.files) {
            workingFiles = { ...workingFiles, ...audit.files };
            replaceCurrentProjectFiles(workingFiles, resolvedName, resolvedType, false, 'Auditoria final');
            setRefreshSeed((s) => s + 1);
            errorsFixed += 1;
            setErrorsFixedCount((c) => c + 1);
          }
          addConsoleLog('success', `[Teste Final] ${audit.summary}`);
        } catch {
          // não bloqueia conclusão se auditoria der timeout
        }

        // 5. PUSH PARA O GITHUB (exclusivo para o Dono Eletro-Júnior)
        let githubUrl: string | undefined;
        if (isOwner) {
          const ghToken = getSavedGitHubToken();
          const pushAuthorizedInGoal = /\b(push|github|publica|publicar|envia\s+para\s+o\s+git)\b/i.test(cleanGoal);
          if (ghToken && pushAuthorizedInGoal) {
            try {
              setLiveBuild((prev) => ({
                ...prev,
                currentStepLabel: 'A enviar para o Cofre de Projetos...',
              }));
              const ghRes = await pushProjectToGitHub({
                projectName: resolvedName,
                files: workingFiles,
              });
              githubUrl = ghRes.repoUrl;
              addConsoleLog('success', `[Cofre de Projetos] Enviado para ${githubUrl}`);
            } catch {
              missionNotes.push('Envio para o Cofre de Projetos falhou: verifica a Chave do Cofre.');
            }
          } else if (ghToken) {
            missionNotes.push('Envio para o Cofre de Projetos aguardando confirmação de Eletro-Jr.');
            setPendingConfirmation({
              id: `conf_push_${Date.now()}`,
              title: 'Autorizar Envio ao Cofre de Projetos',
              question: `O projeto "${resolvedName}" está pronto e testado. Queres autorizar o envio para o Cofre de Projetos agora?`,
              action: { type: 'push_github' },
            });
          } else {
            missionNotes.push('Chave do Cofre não configurada — o pacote ZIP está pronto para baixar.');
          }
        }

        // 6. SALVA NA NUVEM ISOLADA DO UTILIZADOR (nunca em Modo Convidado)
        let firebaseSynced = false;
        if (effectiveStorageUid) {
          try {
            const updatedProj: ProjectRecord = {
              ...currentProject,
              name: resolvedName,
              type: resolvedType,
              files: workingFiles,
              updatedAt: new Date().toISOString(),
            };
            await salvarProjetoNoFirebase(updatedProj, effectiveStorageUid, callerName);
            firebaseSynced = true;
            addConsoleLog('success', `[Sistema] Projeto "${resolvedName}" guardado com sucesso.`);
          } catch {
            // fica salvo no navegador
          }
        }

        // 7. RELATÓRIO FINAL + SOM + VOZ
        const finalReport: MissionReport = {
          goal: cleanGoal,
          projectName: resolvedName,
          startedAt: startedAtIso,
          finishedAt: new Date().toISOString(),
          elapsedSeconds: Math.max(
            1,
            Math.round((Date.now() - new Date(startedAtIso).getTime()) / 1000)
          ),
          completedCount: plannedTasks.length,
          totalCount: plannedTasks.length,
          errorsFixed,
          remainingErrors: totalErrorsRemaining,
          githubUrl,
          firebaseSynced,
          notes: missionNotes,
          sleptOvernight: options?.contextCue === 'sleep' || /dormir/i.test(goalText),
        };

        setLastCompletedReport(finalReport);
        setResumableMission(null);
        if (session && !session.isGuest) {
          localStorage.removeItem(scopedStorageKey(SAVED_MISSION_KEY, session.userId));
        }

        if (effectiveStorageUid) {
          updateProjectStateFromRecord(
            { ...currentProject, name: resolvedName, type: resolvedType, files: workingFiles },
            {
              goal: cleanGoal,
              lastStepDone: `Missão concluída (${plannedTasks.length} etapas)`,
              nextStep: `Pronto para continuar com novas funcionalidades para ${callerName}`,
              missingFeatures: [],
            },
            effectiveStorageUid
          );
        }

        setLiveBuild({
          isBuilding: false,
          phase: 'idle',
          elapsedSeconds: 0,
          steps: [],
          createdFiles: [],
        });

        setMission((prev) => ({
          ...prev,
          active: false,
          paused: false,
          finished: true,
          errorsFixed,
          errorCount: totalErrorsRemaining,
          notes: missionNotes,
          report: finalReport,
        }));

        const reportMsgText = formatMissionReportText(finalReport);
        const reportChatMsg: ChatMessage = {
          id: `sara_report_${Date.now()}`,
          sender: 'sara',
          text: reportMsgText,
          timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          mode: 'mission',
          codeBlocks: filesToCodeBlocks(workingFiles),
        };
        setMessages((prev) => [...prev, reportChatMsg]);
        if (effectiveStorageUid) {
          salvarMensagemChatFirebase(reportChatMsg, currentProject.id, effectiveStorageUid);
        }

        if (Object.keys(workingFiles).length >= 4 && workspaceModeRef.current === 'builder') {
          setRightTab('files');
        }

        playCompletionChime();
        if (workspaceModeRef.current === 'jarvis' || options?.backgroundInJarvis) {
          setCompletedBackgroundBuild({
            id: `bg_done_${Date.now()}`,
            projectName: resolvedName,
            elapsedSeconds: finalReport.elapsedSeconds,
            filesCount: Object.keys(workingFiles).length,
          });
          jarvisNotifyChatRef.current?.(
            `Projeto "${resolvedName}" pronto no Estúdio SARA. Queres ver?`
          );
          showToast(`${resolvedName} concluído no Estúdio SARA!`);
          speakAsSara(getBackgroundBuildDoneSpeech(resolvedName, isOwner), voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        } else {
          speakAsSara(
            finalReport.sleptOvernight
              ? `Terminei enquanto descansavas! O projeto ${resolvedName} já está pronto.`
              : errorsFixed > 0
              ? `Tudo fechado! Concluí ${plannedTasks.length} etapas e corrigi ${errorsFixed} erros.`
              : `Tudo pronto no ${resolvedName}, e já está testado.`,
            voiceEnabledRef.current,
            { level: 'short' }
          );
        }
      } catch (err: any) {
        setIsThinking(false);
        setLiveBuild({
          isBuilding: false,
          phase: 'idle',
          elapsedSeconds: 0,
          steps: [],
          createdFiles: [],
        });
        setMission((prev) => ({ ...prev, active: false }));
        const errMsg = err?.message || 'Failover automático.';
        console.warn('[Sara Automático - Failover em 2.º plano]:', errMsg);
        showToast('A reajustar execução em segundo plano');
        speakAsSara(
          `Estou a reajustar a rota dos motores para continuar a construção${callerVoc}. Podes continuar comigo aqui.`,
          voiceEnabledRef.current,
          { level: 'short', forceSpeak: true }
        );
      }
    },
    [
      currentProject,
      getRequestedPastProjects,
      consoleLogs,
      messages,
      effectiveStorageUid,
      callerName,
      callerVoc,
      isOwner,
      session,
      userIdentity,
      markUserActivity,
      replaceCurrentProjectFiles,
      addConsoleLog,
      showToast,
    ]
  );

  // Executa a etapa atual aprovada no MODO MANUAL
  const executeManualApprovedStep = useCallback(
    async (
      userText: string,
      proposal: ManualProposalState,
      source: 'text' | 'voice' = 'text',
      skipUserMsg = false
    ) => {
      const idx = proposal.currentStepIndex;
      const step = proposal.stepsQueue[idx];
      if (!step) {
        setManualProposal(EMPTY_MANUAL_PROPOSAL);
        return;
      }

      markUserActivity('builder');
      const nowTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      if (source !== 'voice' && !skipUserMsg) {
        const manUsrMsg: ChatMessage = {
          id: `usr_${Date.now()}`,
          sender: 'user',
          text: userText,
          timestamp: nowTime,
        };
        setMessages((prev) => [...prev, manUsrMsg]);
        if (effectiveStorageUid) {
          salvarMensagemChatFirebase(manUsrMsg, currentProject.id, effectiveStorageUid);
        }
      }

      setIsThinking(true);
      setLiveBuild({
        isBuilding: true,
        phase: 'building',
        elapsedSeconds: 0,
        currentStepLabel: `Etapa ${idx + 1}/${proposal.totalEstimatedSteps}: ${step.title}`,
        steps: [],
        createdFiles: [],
      });

      try {
        // Fala primeiro confirmando a execução da etapa aprovada em paralelo com a geração da IA
        const stepSpeechPromise = speakAsSaraAndWait(
          getManualStepApprovalSpeech(step.title, isOwner),
          voiceEnabledRef.current,
          { level: 'short', forceSpeak: true }
        );

        const [res] = await Promise.all([
          askSaraBuilderStep({
            prompt: `MODO MANUAL — ETAPA ${idx + 1} de ${proposal.totalEstimatedSteps} do projeto "${proposal.goal}":
Executa agora SOMENTE a etapa: "${step.title}" (${step.description}).
Código 100% real, completo, zero mocks, mantendo o código anterior intacto.`,
            files: currentProject.files,
            consoleLogs: consoleLogs.slice(-10),
            history: messages.slice(-8),
            agentMode: 'manual',
            projectState: loadActiveProjectState(
              currentProject.id,
              effectiveStorageUid || undefined
            ),
            userIdentity,
          }),
          stepSpeechPromise,
        ]);

        let updatedFiles = { ...currentProject.files };
        if (res.updateFiles && res.files) {
          updatedFiles = { ...updatedFiles, ...res.files };
          const shouldKeepName =
            !isProjectBlank(currentProject.files) && currentProject.name !== 'Novo Projeto';
          replaceCurrentProjectFiles(
            updatedFiles,
            shouldKeepName ? undefined : res.projectName,
            shouldKeepName ? undefined : res.projectType,
            true,
            `Manual Etapa ${idx + 1}: ${step.title}`
          );
          const firstKey = Object.keys(res.files)[0];
          if (firstKey) setActiveFile(firstKey);
          setRefreshSeed((s) => s + 1);
        }

        // Teste rápido no console após a etapa manual
        setLiveBuild((prev) => ({
          ...prev,
          phase: 'testing',
          currentStepLabel: 'A testar esta etapa no console...',
        }));
        latestErrorsRef.current = [];
        await new Promise((r) => setTimeout(r, 950));

        if (latestErrorsRef.current.length > 0) {
          setLiveBuild((prev) => ({
            ...prev,
            phase: 'fixing',
            currentStepLabel: 'A corrigir erro detetado no console...',
          }));
          const fixRes = await askSaraBuilderStep({
            prompt: `Corrige este erro detetado no console após a etapa "${step.title}": ${latestErrorsRef.current.join(
              ' | '
            )}`,
            files: updatedFiles,
            consoleLogs: consoleLogs.slice(-8),
            history: messages.slice(-6),
            projectState: loadActiveProjectState(
              currentProject.id,
              effectiveStorageUid || undefined
            ),
            userIdentity,
          });
          if (fixRes.updateFiles && fixRes.files) {
            updatedFiles = { ...updatedFiles, ...fixRes.files };
            replaceCurrentProjectFiles(updatedFiles, undefined, undefined, true, 'Autocorreção manual');
            setRefreshSeed((s) => s + 1);
            setErrorsFixedCount((c) => c + 1);
          }
        }

        setIsThinking(false);
        setLiveBuild({
          isBuilding: false,
          phase: 'idle',
          elapsedSeconds: 0,
          steps: [],
          createdFiles: [],
        });

        const nextIdx = idx + 1;
        const hasNext = nextIdx < proposal.stepsQueue.length;
        const nextTask = hasNext ? proposal.stepsQueue[nextIdx] : null;
        const remainingManualTitles = proposal.stepsQueue.slice(nextIdx).map((s) => s.title);

        if (effectiveStorageUid) {
          const nextState = updateProjectStateFromRecord(
            { ...currentProject, files: updatedFiles },
            {
              goal: proposal.goal,
              lastStepDone: `Etapa ${idx + 1}/${proposal.totalEstimatedSteps}: ${step.title}`,
              nextStep: nextTask?.title || 'Sistema concluído',
              missingFeatures: remainingManualTitles,
            },
            effectiveStorageUid
          );
          salvarEstadoProjetoFirebase(nextState, effectiveStorageUid);
        }

        if (hasNext && nextTask) {
          setManualProposal({
            ...proposal,
            currentStepIndex: nextIdx,
          });
        } else {
          setManualProposal(EMPTY_MANUAL_PROPOSAL);
        }

        const msgReply = hasNext
          ? `Etapa ${idx + 1}/${proposal.totalEstimatedSteps} (**${step.title}**) concluída e testada.\n\n**Próxima etapa (${nextIdx + 1}/${proposal.totalEstimatedSteps}):** **${nextTask!.title}** — ${nextTask!.description}.\n\nPosso avançar com esta etapa ou queres ajustar algum detalhe antes?`
          : `Etapa final (**${step.title}**) concluída e testada no Preview e Editor.`;

        const manSaraMsg: ChatMessage = {
          id: `sara_man_${Date.now()}`,
          sender: 'sara',
          text: msgReply,
          timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          mode: hasNext ? 'manual-proposal' : 'builder',
          architectureSummary: res.architectureSummary,
          strategicImprovements: res.strategicImprovements,
          voiceDelivered: true,
          hasCodeUpdate: Boolean(res.updateFiles),
          codeBlocks: res.files ? filesToCodeBlocks(res.files) : undefined,
        };
        setMessages((prev) => [...prev, manSaraMsg]);
        if (effectiveStorageUid) {
          salvarMensagemChatFirebase(manSaraMsg, currentProject.id, effectiveStorageUid);
        }

        const manualSpokenRecap = hasNext
          ? `${idx === 0 ? 'Primeira parte pronta' : 'Etapa concluída'}${callerVoc}. ${res.voiceSummary || ''} Queres ajustar alguma coisa aqui ou posso avançar para ${nextTask!.title}?`
          : getSpokenBuildRecap(
              currentProject.name,
              Object.keys(updatedFiles).length,
              res.voiceSummary,
              res.strategicImprovements
            );
        speakAsSara(manualSpokenRecap, voiceEnabledRef.current, {
          level: voiceLevelRef.current === 'short' ? 'medium' : voiceLevelRef.current,
          forceSpeak: true,
        });
      } catch (err: any) {
        setIsThinking(false);
        setLiveBuild({
          isBuilding: false,
          phase: 'idle',
          elapsedSeconds: 0,
          steps: [],
          createdFiles: [],
        });
        console.warn('[Sara Manual - Failover em 2.º plano]:', err?.message || err);
        showToast('A preparar nova tentativa silenciosa');
        speakAsSara(
          `Tive de trocar de motor agora${callerVoc} — pede para avançar outra vez que já sigo com a etapa.`,
          voiceEnabledRef.current,
          { level: 'short', forceSpeak: true }
        );
      }
    },
    [
      currentProject,
      consoleLogs,
      messages,
      effectiveStorageUid,
      isOwner,
      userIdentity,
      callerVoc,
      markUserActivity,
      replaceCurrentProjectFiles,
      showToast,
    ]
  );

  const handleTriggerBackgroundBuild = useCallback(
    async (goal: string, source: 'voice' | 'text' = 'text') => {
      setCompletedBackgroundBuild(null);
      await runAutonomousMission(goal, {
        source,
        skipUserMsg: true,
        backgroundInJarvis: true,
      });
    },
    [runAutonomousMission]
  );

  const handleChangeWorkspaceMode = useCallback(
    (nextMode: WorkspaceMode, opts?: { silent?: boolean }) => {
      setWorkspaceMode(nextMode);
      workspaceModeRef.current = nextMode;
      if (nextMode === 'builder') {
        setCompletedBackgroundBuild(null);
        showToast('Modo 2: Estúdio SARA ativado');
      } else {
        showToast('Modo 1: SARA Assistente ativado');
      }
      if (!opts?.silent) {
        speakAsSara(
          getWorkspaceSwitchSpeech(nextMode, currentProject.name),
          voiceEnabledRef.current,
          { level: 'short', forceSpeak: true }
        );
      }
    },
    [showToast, currentProject.name]
  );

  const handleSwitchMode = useCallback(
    (newMode: AgentMode, spokenReason?: string) => {
      if (newMode === 'manual') {
        if (mission.active) {
          missionAbortRef.current = true;
          setMission((prev) => ({ ...prev, active: false, paused: true }));
        }
        setAgentMode('manual');
        const msg = spokenReason || getModeSwitchSpeech('manual');
        speakAsSara(msg, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        showToast('Modo Manual ativado');
      } else {
        setAgentMode('automatic');
        const msg = spokenReason || getModeSwitchSpeech('automatic');
        speakAsSara(msg, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        showToast('Modo Automático ativado');
      }
    },
    [mission.active, showToast]
  );

  const handleCycleVoiceLevel = useCallback(() => {
    setVoiceLevel((prev) => {
      const next: VoiceLevel = prev === 'short' ? 'medium' : prev === 'medium' ? 'full' : 'short';
      const label = next === 'full' ? 'Completo' : next === 'medium' ? 'Médio' : 'Curto';
      showToast(`Nível de voz: ${label}`);
      return next;
    });
  }, [showToast]);

  const handleSilenceSara = useCallback(() => {
    const next = !isSaraSilencedRef.current;
    isSaraSilencedRef.current = next;
    setSaraSilenced(next);
    setIsSaraSilencedState(next);
    if (next) {
      stopSaraSpeech();
      if (getVoiceReadingStatus().active && !getVoiceReadingStatus().paused) {
        pauseVoiceReading();
      }
    } else {
      isCallModeRef.current = false;
      setSaraCallMode(false);
      setIsCallModeState(false);
      speakAsSara('Estou aqui.', voiceEnabledRef.current, {
        level: 'short',
        forceSpeak: true,
        bypassSilence: true,
      });
    }
  }, []);

  const handleForceSilenceSara = useCallback(() => {
    isSaraSilencedRef.current = true;
    isCallModeRef.current = false;
    setSaraCallMode(false);
    setIsCallModeState(false);
    setSaraSilenced(true);
    setIsSaraSilencedState(true);
    stopSaraSpeech();
    if (getVoiceReadingStatus().active && !getVoiceReadingStatus().paused) {
      pauseVoiceReading();
    }
  }, []);

  const handleEnterCallMode = useCallback(() => {
    isCallModeRef.current = true;
    isSaraSilencedRef.current = true;
    setSaraCallMode(true);
    setIsCallModeState(true);
    setSaraSilenced(true);
    setIsSaraSilencedState(true);
    stopSaraSpeech();
    if (getVoiceReadingStatus().active && !getVoiceReadingStatus().paused) {
      pauseVoiceReading();
    }
    jarvisMediaControlRef.current?.pause();
  }, []);

  const handleExitSilenceOrCallMode = useCallback(() => {
    isCallModeRef.current = false;
    isSaraSilencedRef.current = false;
    setSaraCallMode(false);
    setIsCallModeState(false);
    setSaraSilenced(false);
    setIsSaraSilencedState(false);
    speakAsSara('Estou aqui.', voiceEnabledRef.current, {
      level: 'short',
      forceSpeak: true,
      bypassSilence: true,
    });
  }, []);

  const handleListenMessageDetail = useCallback((msgText: string) => {
    if (isCallModeRef.current || isSaraSilencedRef.current) return;
    speakAsSara(msgText, true, { level: 'full', forceSpeak: true });
  }, []);

  // Refs estáveis para callbacks de voz nunca capturarem estado antigo
  const handleSendMessageRef = useRef<
    ((
      text: string,
      image?: ConvertedImage | null,
      attachments?: AttachedFile[],
      source?: 'text' | 'voice'
    ) => Promise<void>) | null
  >(null);
  const executePlatformCommandRef = useRef<
    ((cmd: VoiceCommandAction, rawText: string) => Promise<boolean>) | null
  >(null);

  const stopHandsFreeMic = useCallback(() => {
    shouldKeepListeningRef.current = false;
    stopMicRef.current?.();
    stopMicRef.current = null;
    setIsListening(false);
  }, []);

  const handleSaraFixError = useCallback(
    (customError?: string) => {
      const lastError =
        customError ||
        [...consoleLogs].reverse().find((l) => l.level === 'error')?.message ||
        [...consoleLogs].reverse().find((l) => l.level === 'command')?.message ||
        'Verifica o código atual e corrige quaisquer erros ou melhorias pendentes.';

      handleSendMessageRef.current?.(
        `Sara, corrige este erro do console no projeto agora com código completo: "${lastError}"`
      );
    },
    [consoleLogs]
  );

  const executeConfirmedAction = useCallback(async () => {
    const pending = pendingConfirmationRef.current;
    if (!pending) return;
    setPendingConfirmation(null);

    if (pending.action.type === 'push_github') {
      if (!isOwner) return;
      const ghToken = getSavedGitHubToken();
      if (!ghToken) {
        setShowDeployModal(true);
        showToast('Configura a Chave do Cofre primeiro');
        speakAsSara(`Configura a tua Chave do Cofre primeiro${callerShortVoc}.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return;
      }
      try {
        showToast('A enviar para o Cofre de Projetos...');
        const res = await pushProjectToGitHub({
          projectName: currentProject.name,
          files: currentProject.files,
        });
        addConsoleLog('success', `[Cofre de Projetos] Enviado para ${res.repoUrl}`);
        showToast(`Cofre sincronizado: ${res.repoUrl}`);
        speakAsSara(`Envio para o Cofre de Projetos concluído${callerVoc}.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
      } catch (err: any) {
        const msg = 'Núcleo offline. A tentar reconectar...';
        addConsoleLog('error', msg);
        showToast(msg);
        speakAsSara(`Não consegui enviar para o Cofre de Projetos agora${callerVoc}.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
      }
      return;
    }

    if (pending.action.type === 'clear_chat') {
      stopSaraSpeech();
      setManualProposal(EMPTY_MANUAL_PROPOSAL);
      setMessages([]);
      showToast('Chat limpo');
      speakAsSara(`Chat limpo${callerVoc}.`, voiceEnabledRef.current, {
        level: 'short',
        forceSpeak: true,
      });
      return;
    }

    if (pending.action.type === 'destructive_prompt') {
      await handleSendMessageRef.current?.(
        `Confirmo: ${pending.action.prompt}`,
        undefined,
        undefined,
        pending.action.source
      );
    }
  }, [currentProject.name, currentProject.files, isOwner, callerVoc, callerShortVoc, addConsoleLog, showToast]);

  const cancelConfirmedAction = useCallback(() => {
    if (!pendingConfirmationRef.current) return;
    setPendingConfirmation(null);
    showToast('Ação cancelada');
    speakAsSara(`Entendido, cancelei essa ação${callerVoc}.`, voiceEnabledRef.current, {
      level: 'short',
      forceSpeak: true,
    });
  }, [callerVoc, showToast]);

  // Controlo total da plataforma por Voz ou Chat
  const executePlatformCommand = useCallback(
    async (cmd: VoiceCommandAction, rawText: string): Promise<boolean> => {
      markUserActivity();

      if (cmd.type === 'logout_session') {
        void handleLogout('Sessão encerrada.');
        return true;
      }

      if (cmd.type === 'open_radar_map') {
        handleChangeBottomTab('mapa');
        showToast('Mapa / Radar aberto');
        speakAsSara('Abri o mapa radar.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      const waitForRadarControl = async (): Promise<RadarExternalControlHandle | null> => {
        handleChangeBottomTab('mapa');
        for (let i = 0; i < 12; i++) {
          if (radarControlRef.current) return radarControlRef.current;
          await new Promise((r) => setTimeout(r, 85));
        }
        return radarControlRef.current;
      };

      if (cmd.type === 'radar_track_target') {
        const ctrl = await waitForRadarControl();
        if (!ctrl) {
          speakAsSara('Abri o radar, mas ainda está a carregar.', voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
          return true;
        }
        const res = await ctrl.trackTargetByQuery(cmd.query);
        showToast(res.message);
        speakAsSara(res.message, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'radar_view_mode') {
        const ctrl = await waitForRadarControl();
        ctrl?.setViewMode(cmd.mode);
        const label =
          cmd.mode === 'hybrid'
            ? 'Vista de satélite ativada.'
            : cmd.mode === 'terrain'
            ? 'Vista de terreno ativada.'
            : 'Vista de ruas ativada.';
        showToast(label);
        speakAsSara(label, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'radar_ask_target_street') {
        const ctrl = await waitForRadarControl();
        const speech = ctrl
          ? await ctrl.getTrackedTargetStreetSpeech()
          : 'Não há nenhum alvo selecionado no radar neste momento.';
        showToast(speech);
        speakAsSara(speech, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'radar_show_route') {
        const ctrl = await waitForRadarControl();
        const msg = ctrl
          ? await ctrl.triggerRouteToTrackedTarget()
          : 'Abri o radar. Seleciona um alvo ou local primeiro.';
        showToast(msg);
        speakAsSara(msg, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'radar_stop_tracking') {
        const msg = radarControlRef.current
          ? radarControlRef.current.stopAllTracking()
          : 'Rastreamento parado.';
        showToast(msg);
        speakAsSara(msg, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'open_profile_devices') {
        handleChangeBottomTab('perfil', 'perfil');
        showToast('Perfil e Meus Aparelhos aberto');
        speakAsSara('Abri o teu perfil e a lista de aparelhos.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'open_find_phone') {
        handleChangeBottomTab('perfil', 'achar_celular');
        showToast('A localizar o teu celular...');
        const fresh = (await requestRealCoordinatesWithFallback(8000)) || myCoordsRef.current;
        const primaryDevice =
          devicesRef.current.find(
            (d) =>
              d.deviceCode === session?.deviceCode &&
              typeof d.lastLat === 'number' &&
              typeof d.lastLng === 'number'
          ) ||
          devicesRef.current.find(
            (d) => typeof d.lastLat === 'number' && typeof d.lastLng === 'number'
          );

        const lat = fresh?.lat ?? primaryDevice?.lastLat ?? null;
        const lng = fresh?.lng ?? primaryDevice?.lastLng ?? null;
        if (fresh) {
          handleUpdateMyCoords(fresh);
        }

        if (lat !== null && lng !== null) {
          const geo = await reverseGeocodeCoords(lat, lng);
          const placeText = geo?.street
            ? [geo.street, geo.neighborhood, geo.city].filter(Boolean).join(', ')
            : geo?.formattedAddress || '';
          const approxPrefix =
            fresh?.source === 'ip_approx' || fresh?.source === 'network'
              ? 'Com GPS desligado, a localização aproximada do teu celular é: '
              : 'O teu celular foi localizado em ';
          const spoken = placeText
            ? `${approxPrefix}${placeText}.`
            : 'Abri o mapa de Achar Meu Celular com a tua posição atual.';
          speakAsSara(spoken, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        } else {
          speakAsSara(
            'Abri o rastreamento Achar Meu Celular. Ativa o GPS para obter a rua exata.',
            voiceEnabledRef.current,
            {
              level: 'short',
              forceSpeak: true,
            }
          );
        }
        return true;
      }

      if (cmd.type === 'open_background_settings') {
        handleChangeBottomTab('perfil', 'segundo_plano');
        showToast('Definições de Segundo Plano abertas');
        speakAsSara('Abri as definições de segundo plano.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'stop_location_sharing') {
        await handleStopSharingAll();
        speakAsSara('Localização desligada. Já não apareces no mapa.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'activate_ghost_mode') {
        await handleActivateGhostMode();
        speakAsSara('Modo fantasma ligado. Desapareceste do mapa.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'show_on_map_on') {
        if (!appearOnMapRef.current) {
          await handleToggleAppearOnMap();
        }
        handleChangeBottomTab('mapa');
        speakAsSara('Aparecer no mapa ligado.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'enable_background_mode') {
        await handlePermitBackground();
        speakAsSara('Segundo plano ativado.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'stop_background_mode') {
        await handleStopBackground();
        speakAsSara('Segundo plano parado.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'open_admin') {
        if (isOwner) {
          setShowAdminModal(true);
          showToast('Painel Admin aberto');
          speakAsSara('Painel Admin aberto, chefe.', voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        } else {
          if (session) {
            void logAdminAlert({
              type: 'admin_attempt',
              userId: session.userId,
              userName: session.callName,
              userEmail: session.email,
              summary: `${session.callName} tentou abrir o Admin por comando: "${rawText.slice(0, 80)}"`,
            });
          }
          showToast('Não tens acesso a isso.');
          speakAsSara('Não tens acesso a isso.', voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        }
        return true;
      }

      // 1. Controlo imediato de Silêncio, Modo Chamada e Interrupção ("Sara, cala", "Sara, estou numa chamada", "Sara, para tudo", "Sara, pausa", "Sara, podes falar")
      if (cmd.type === 'enter_call_mode') {
        handleEnterCallMode();
        return true;
      }

      if (cmd.type === 'stop_all_and_pause') {
        stopSaraSpeech();
        if (getVoiceReadingStatus().active && !getVoiceReadingStatus().paused) {
          pauseVoiceReading();
        }
        jarvisMediaControlRef.current?.pause();
        return true;
      }

      if (cmd.type === 'pause_current_activity') {
        stopSaraSpeech();
        if (getVoiceReadingStatus().active && !getVoiceReadingStatus().paused) {
          pauseVoiceReading();
        }
        jarvisMediaControlRef.current?.pause();
        return true;
      }

      if (cmd.type === 'silence_sara') {
        handleForceSilenceSara();
        return true;
      }

      if (cmd.type === 'unsilence_sara') {
        handleExitSilenceOrCallMode();
        return true;
      }

      // Em Modo Chamada ou Modo Silêncio, ignora qualquer outro comando ou conversa de fundo até libertação explícita
      if (isCallModeRef.current || isSaraSilencedRef.current) {
        return true;
      }

      // 1b. Confirmação / cancelamento por voz de uma pergunta pendente
      if (cmd.type === 'confirm_pending') {
        await executeConfirmedAction();
        return true;
      }
      if (cmd.type === 'cancel_pending') {
        cancelConfirmedAction();
        return true;
      }

      // 2. Velocidade da voz
      if (cmd.type === 'voice_speed') {
        const newRate = adjustVoiceSpeed(cmd.direction);
        const msg =
          cmd.direction === 'faster'
            ? `Vou falar mais rápido${callerShortVoc} (${newRate}x).`
            : cmd.direction === 'slower'
            ? `Vou falar mais devagar${callerShortVoc} (${newRate}x).`
            : `Voltei à velocidade normal${callerShortVoc}.`;
        showToast(msg);
        speakAsSara(msg, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      // 3. Nível de voz
      if (cmd.type === 'voice_level') {
        setVoiceLevel(cmd.level);
        const confirmMsg =
          cmd.level === 'full'
            ? `Modo completo ativo${callerShortVoc}.`
            : cmd.level === 'medium'
            ? `Modo médio ativo${callerShortVoc}.`
            : `Modo curto ativo${callerShortVoc}.`;
        showToast(confirmMsg);
        speakAsSara(confirmMsg, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      // 4b. Troca instantânea entre MODO 1 (Assistente JARVIS) e MODO 2 (Builder), Módulos e Modo Foco
      if (cmd.type === 'open_builder_mode') {
        handleChangeWorkspaceMode('builder');
        return true;
      }

      if (cmd.type === 'show_builder_progress') {
        handleChangeWorkspaceMode('builder', { silent: true });
        setIsEditorFullscreen(false);
        setIsPreviewFullscreen(false);
        setShowProjectsModal(false);
        setShowSettingsModal(false);
        setShowDeployModal(false);
        setMobileTab('preview');
        const pct = computeLiveBuildPct(liveBuild);
        const spoken = liveBuild.isBuilding
          ? getHumanChoice([
              `Aqui está o Estúdio SARA em ${pct}% — ${liveBuild.currentStepLabel || 'a montar o projeto'}.`,
              `Progresso ao vivo no Estúdio SARA: ${pct}% concluído no ${currentProject.name}.`,
            ])
          : `Aqui está o Estúdio SARA com o ${currentProject.name}.`;
        showToast(liveBuild.isBuilding ? `Estúdio SARA a construir (${pct}%)` : `Estúdio SARA: ${currentProject.name}`);
        speakAsSara(spoken, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      if (cmd.type === 'open_jarvis_mode') {
        handleChangeWorkspaceMode('jarvis');
        return true;
      }

      if (cmd.type === 'open_panel') {
        if (workspaceModeRef.current !== 'jarvis') {
          setWorkspaceMode('jarvis');
          workspaceModeRef.current = 'jarvis';
        }
        setTimeout(() => jarvisPanelRef.current?.(true), 40);
        showToast('Painel JARVIS aberto');
        speakAsSara(
          getHumanChoice(['Painel aberto.', 'Aqui tens o painel de controlo.']),
          voiceEnabledRef.current,
          { level: 'short', forceSpeak: true }
        );
        return true;
      }

      if (cmd.type === 'close_panel') {
        jarvisPanelRef.current?.(false);
        showToast('Painel fechado');
        speakAsSara(
          getHumanChoice(['Fechei o painel.', 'Painel recolhido.']),
          voiceEnabledRef.current,
          { level: 'short', forceSpeak: true }
        );
        return true;
      }

      if (cmd.type === 'open_jarvis_module') {
        if (workspaceModeRef.current !== 'jarvis') {
          setWorkspaceMode('jarvis');
          workspaceModeRef.current = 'jarvis';
        }
        setTimeout(() => {
          jarvisPanelRef.current?.(true);
          jarvisModuleRef.current?.(cmd.moduleTab);
        }, 40);
        const tabLabels: Record<JarvisModuleTab, string> = {
          voz: 'canal de voz',
          sistema: 'diagnóstico do sistema',
          agenda: 'agenda e alarmes',
          musica: 'música',
          documentos: 'documentos',
          tarefas: 'tarefas',
        };
        showToast(`Módulo ${cmd.moduleTab} aberto`);
        speakAsSara(
          getHumanChoice([
            `Abri ${tabLabels[cmd.moduleTab]}.`,
            `Aqui tens ${tabLabels[cmd.moduleTab]}.`,
            `Secção ${tabLabels[cmd.moduleTab]} pronta.`,
          ]),
          voiceEnabledRef.current,
          { level: 'short', forceSpeak: true }
        );
        return true;
      }

      if (cmd.type === 'repeat_sara') {
        if (workspaceModeRef.current === 'jarvis' && jarvisRepeatRef.current) {
          jarvisRepeatRef.current();
        } else {
          const lastSaraMsg = [...messages].reverse().find((m) => m.sender === 'sara');
          if (lastSaraMsg) {
            speakAsSara(lastSaraMsg.text, true, { level: 'full', forceSpeak: true });
          } else {
            speakAsSara('Ainda não respondi a nada por aqui.', true, {
              level: 'short',
              forceSpeak: true,
            });
          }
        }
        return true;
      }

      if (cmd.type === 'continue_sara') {
        if (workspaceModeRef.current === 'jarvis' && jarvisContinueRef.current) {
          await jarvisContinueRef.current();
          return true;
        }
      }

      if (cmd.type === 'focus_mode_on') {
        if (workspaceModeRef.current !== 'jarvis') {
          setWorkspaceMode('jarvis');
          workspaceModeRef.current = 'jarvis';
        }
        setTimeout(() => jarvisFocusRef.current?.(true), 60);
        showToast('Modo Foco ativado');
        speakAsSara('Modo foco ligado.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'focus_mode_off') {
        jarvisFocusRef.current?.(false);
        showToast('Modo Foco desativado');
        speakAsSara('Modo foco desligado.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'pause_music') {
        jarvisMediaControlRef.current?.pause();
        showToast('Reprodução pausada');
        speakAsSara('Pausei a reprodução.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'resume_music') {
        jarvisMediaControlRef.current?.resume();
        showToast('Reprodução retomada');
        speakAsSara('A continuar.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'close_music') {
        jarvisMediaControlRef.current?.close();
        showToast('Player fechado');
        speakAsSara('Fechei o player.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'volume_up' || cmd.type === 'volume_down') {
        const delta = cmd.type === 'volume_up' ? 20 : -20;
        const nextVol = jarvisMediaControlRef.current?.adjustVolume(delta);
        showToast(typeof nextVol === 'number' ? `Volume: ${nextVol}%` : 'Volume ajustado');
        speakAsSara(
          cmd.type === 'volume_up' ? 'Aumentei o volume.' : 'Baixei o volume.',
          voiceEnabledRef.current,
          { level: 'short', forceSpeak: true }
        );
        return true;
      }

      if (cmd.type === 'close_stage') {
        jarvisMediaControlRef.current?.closeStage();
        showToast('Palco fechado');
        speakAsSara(
          getHumanChoice(['De volta ao holograma.', 'Palco fechado. Podes continuar.']),
          voiceEnabledRef.current,
          { level: 'short', forceSpeak: true }
        );
        return true;
      }

      if (cmd.type === 'wake_ack') {
        speakAsSara(cmd.reply, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      if (cmd.type === 'unintelligible_clarify') {
        speakAsSara(cmd.reply, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      if (cmd.type === 'next_music') {
        jarvisMediaControlRef.current?.next();
        showToast('Próxima faixa');
        speakAsSara(
          getHumanChoice(['Boa, passei para a próxima.', 'Próxima faixa a tocar.', 'Mudei de som.']),
          voiceEnabledRef.current,
          { level: 'short', forceSpeak: true }
        );
        return true;
      }

      if (cmd.type === 'prev_music') {
        jarvisMediaControlRef.current?.prev();
        showToast('Faixa anterior');
        speakAsSara(
          getHumanChoice(['Voltei à faixa anterior.', 'A tocar a música de trás.']),
          voiceEnabledRef.current,
          { level: 'short', forceSpeak: true }
        );
        return true;
      }

      if (cmd.type === 'mute_music') {
        const muted = jarvisMediaControlRef.current?.toggleMute();
        showToast(muted ? 'Som silenciado' : 'Som reposto');
        speakAsSara(muted ? 'Tirei o som.' : 'Som ligado de novo.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'shuffle_music') {
        const shuffled = jarvisMediaControlRef.current?.toggleShuffle();
        showToast(shuffled ? 'Modo aleatório ligado' : 'Modo aleatório desligado');
        speakAsSara(
          shuffled ? 'Modo aleatório ligado, bora misturar!' : 'Ordem normal da playlist.',
          voiceEnabledRef.current,
          { level: 'short', forceSpeak: true }
        );
        return true;
      }

      if (cmd.type === 'loop_music') {
        const looped = jarvisMediaControlRef.current?.toggleLoop();
        showToast(looped ? 'Loop ligado' : 'Loop desligado');
        speakAsSara(
          looped ? 'Vou repetir esta faixa em loop.' : 'Loop desligado.',
          voiceEnabledRef.current,
          { level: 'short', forceSpeak: true }
        );
        return true;
      }

      if (cmd.type === 'like_music') {
        const res = jarvisMediaControlRef.current?.likeCurrent();
        showToast(res?.title ? `Favorita: ${res.title}` : 'Guardada nos favoritos');
        speakAsSara(
          res?.title
            ? `Boa escolha, guardei ${res.title} nos teus favoritos.`
            : 'Guardada nos teus favoritos!',
          voiceEnabledRef.current,
          { level: 'short', forceSpeak: true }
        );
        return true;
      }

      if (cmd.type === 'identify_music') {
        const info = jarvisMediaControlRef.current?.identifyCurrent();
        speakAsSara(
          info?.title
            ? `Estás a ouvir ${info.title} de ${info.artist || 'YouTube'}.`
            : 'Não há nenhuma faixa ativa agora.',
          voiceEnabledRef.current,
          { level: 'short', forceSpeak: true }
        );
        return true;
      }

      if (cmd.type === 'smart_home_control') {
        if (workspaceModeRef.current !== 'jarvis') {
          setWorkspaceMode('jarvis');
          workspaceModeRef.current = 'jarvis';
        }
        setTimeout(() => {
          jarvisMediaControlRef.current?.applySmartHome({
            device: cmd.device,
            state: cmd.state,
            room: cmd.room,
            sceneName: cmd.sceneName,
          });
        }, 60);
        showToast(cmd.reply);
        speakAsSara(cmd.reply, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      if (cmd.type === 'electric_calc') {
        if (workspaceModeRef.current !== 'jarvis') {
          setWorkspaceMode('jarvis');
          workspaceModeRef.current = 'jarvis';
        }
        const immediateReply = jarvisMediaControlRef.current?.showElectricCalc({
          voltage: cmd.voltage,
          current: cmd.current,
          resistance: cmd.resistance,
          power: cmd.power,
          reconstructed: cmd.reconstructed,
        });
        showToast('Cálculo elétrico no preview');
        if (immediateReply) {
          speakAsSara(immediateReply, voiceEnabledRef.current, { level: 'medium', forceSpeak: true });
        } else {
          setTimeout(() => {
            const delayedReply = jarvisMediaControlRef.current?.showElectricCalc({
              voltage: cmd.voltage,
              current: cmd.current,
              resistance: cmd.resistance,
              power: cmd.power,
              reconstructed: cmd.reconstructed,
            });
            if (delayedReply) {
              speakAsSara(delayedReply, voiceEnabledRef.current, { level: 'medium', forceSpeak: true });
            }
          }, 90);
        }
        return true;
      }

      if (cmd.type === 'switch_media_source') {
        if (workspaceModeRef.current !== 'jarvis') {
          setWorkspaceMode('jarvis');
          workspaceModeRef.current = 'jarvis';
        }
        const pendingAmb = pendingSourceAmbiguityRef.current;
        pendingSourceAmbiguityRef.current = null;
        setTimeout(async () => {
          const reply =
            jarvisMediaControlRef.current?.switchMediaSource(cmd.source) ||
            (cmd.source === 'local' ? 'Modo local ativo.' : 'De volta ao modo internet.');
          if (pendingAmb && cmd.source === 'local') {
            const playReply = await jarvisMediaControlRef.current?.playLocalMedia({
              kind: pendingAmb.kind,
              query: pendingAmb.query,
            });
            speakAsSara(playReply || reply, voiceEnabledRef.current, {
              level: 'short',
              forceSpeak: true,
            });
            return;
          }
          if (pendingAmb && cmd.source === 'internet') {
            await jarvisMediaControlRef.current?.playGenreOrQuery(pendingAmb.query || '');
            speakAsSara('A tocar da internet.', voiceEnabledRef.current, {
              level: 'short',
              forceSpeak: true,
            });
            return;
          }
          showToast(reply);
          speakAsSara(reply, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        }, 70);
        return true;
      }

      if (cmd.type === 'play_local_media') {
        if (workspaceModeRef.current !== 'jarvis') {
          setWorkspaceMode('jarvis');
          workspaceModeRef.current = 'jarvis';
        }
        setTimeout(async () => {
          const reply =
            (await jarvisMediaControlRef.current?.playLocalMedia({
              kind: cmd.kind,
              query: cmd.query,
              folderOrDate: cmd.folderOrDate,
            })) || 'A abrir ficheiro local.';
          showToast(reply);
          speakAsSara(reply, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        }, 70);
        return true;
      }

      if (cmd.type === 'open_local_document') {
        if (workspaceModeRef.current !== 'jarvis') {
          setWorkspaceMode('jarvis');
          workspaceModeRef.current = 'jarvis';
        }
        setTimeout(async () => {
          const reply =
            (await jarvisMediaControlRef.current?.openLocalDocument({
              docCategory: cmd.docCategory,
              query: cmd.query,
            })) || 'A abrir documento local.';
          showToast(reply);
          speakAsSara(reply, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        }, 70);
        return true;
      }

      if (cmd.type === 'filter_local_library') {
        if (workspaceModeRef.current !== 'jarvis') {
          setWorkspaceMode('jarvis');
          workspaceModeRef.current = 'jarvis';
        }
        setTimeout(() => {
          const reply =
            jarvisMediaControlRef.current?.filterLocalLibrary({
              filter: cmd.filter,
              query: cmd.query,
            }) || 'Biblioteca local filtrada.';
          showToast(reply);
          speakAsSara(reply, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        }, 70);
        return true;
      }

      if (cmd.type === 'media_seek') {
        jarvisMediaControlRef.current?.seekBy(cmd.seconds);
        const dirLabel =
          cmd.seconds > 0
            ? cmd.seconds >= 60
              ? `Adiantei ${Math.round(cmd.seconds / 60)} minuto.`
              : `Adiantei ${cmd.seconds} segundos.`
            : `Voltei ${Math.abs(cmd.seconds)} segundos.`;
        showToast(dirLabel);
        speakAsSara(dirLabel, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      if (cmd.type === 'media_fullscreen') {
        jarvisMediaControlRef.current?.setFullscreen(cmd.enabled);
        const msg = cmd.enabled ? 'Tela cheia ativada.' : 'Saí da tela cheia.';
        showToast(msg);
        speakAsSara(msg, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      if (cmd.type === 'ask_media_source_ambiguity') {
        pendingSourceAmbiguityRef.current = { kind: cmd.kind, query: cmd.query };
        speakAsSara('Local ou da internet?', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'pause_reading') {
        pauseVoiceReading();
        showToast('Leitura pausada — diz "continua" para retomar');
        return true;
      }

      if (cmd.type === 'resume_reading') {
        const ok = resumeVoiceReading();
        if (ok) {
          showToast('A continuar leitura');
        } else {
          speakAsSara('Não há nenhuma leitura pausada no momento.', voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        }
        return true;
      }

      if (cmd.type === 'stop_reading') {
        stopVoiceReading();
        showToast('Leitura terminada');
        return true;
      }

      // 4. Conversa rápida em 2.º plano (apenas voz, ZERO balão de texto no chat)
      if (cmd.type === 'background_smalltalk') {
        speakAsSara(cmd.reply, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      // 5. Troca instantânea de modo (Manual <-> Automático) e controlo da missão
      if (cmd.type === 'pause_mission') {
        if (mission.active && !mission.paused) {
          missionPausedRef.current = true;
          setMission((prev) => ({ ...prev, paused: true }));
          showToast('Modo Automático pausado');
          speakAsSara(`Pausei o modo automático${callerVoc}.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        } else {
          speakAsSara(`Não há nenhuma missão ativa neste momento${callerVoc}.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        }
        return true;
      }

      if (cmd.type === 'resume_mission') {
        if (mission.active && mission.paused) {
          missionPausedRef.current = false;
          setMission((prev) => ({ ...prev, paused: false }));
          showToast('Modo Automático retomado');
          speakAsSara(`Retomei a missão automática${callerVoc}.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        }
        return true;
      }

      if (cmd.type === 'open_report') {
        const rep = mission.report || lastCompletedReport;
        if (rep) {
          setMessages((prev) => [
            ...prev,
            {
              id: `sara_rep_voice_${Date.now()}`,
              sender: 'sara',
              text: formatMissionReportText(rep),
              timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
              mode: 'mission',
            },
          ]);
          speakAsSara(`Mostrei o relatório do ${rep.projectName} no painel${callerVoc}.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        } else {
          speakAsSara(`Ainda não há relatório concluído${callerVoc}.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        }
        return true;
      }

      if (cmd.type === 'switch_manual') {
        handleSwitchMode('manual');
        return true;
      }

      if (cmd.type === 'switch_automatic') {
        if (cmd.goal) {
          await runAutonomousMission(cmd.goal, { contextCue: cmd.contextCue, source: 'voice' });
        } else if (manualProposal.active && manualProposal.goal) {
          setAgentMode('automatic');
          showToast('Modo Automático ativado');
          if (manualProposal.stepsQueue.length > 0 && manualProposal.currentStepIndex > 0) {
            const handoffMission: MissionState = {
              active: true,
              paused: false,
              goal: manualProposal.goal,
              tasks: manualProposal.stepsQueue.map((st, idx) => ({
                id: idx + 1,
                title: st.title,
                description: st.description,
                status: idx < manualProposal.currentStepIndex ? 'done' : 'pending',
                attempts: 0,
              })),
              currentIndex: manualProposal.currentStepIndex,
              errorCount: 0,
              errorsFixed: 0,
              elapsedSeconds: 0,
              startedAt: new Date().toISOString(),
              notes: [],
              finished: false,
            };
            await runAutonomousMission(manualProposal.goal, {
              resumedMission: handoffMission,
              skipUserMsg: true,
              source: 'voice',
            });
          } else {
            await runAutonomousMission(manualProposal.goal, { skipUserMsg: true, source: 'voice' });
          }
        } else {
          handleSwitchMode('automatic');
        }
        return true;
      }

      // 6. Continuar projeto exatamente de onde parou
      if (cmd.type === 'continue_project') {
        if (mission.paused && mission.tasks.length > 0) {
          missionPausedRef.current = false;
          setMission((prev) => ({ ...prev, paused: false }));
          speakAsSara(`Retomei o modo automático de onde parámos${callerShortVoc}.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
          return true;
        }
        if (resumableMission) {
          const saved = resumableMission;
          setResumableMission(null);
          await runAutonomousMission(saved.goal, { resumedMission: saved, skipUserMsg: true, source: 'voice' });
          return true;
        }
        if (agentModeRef.current === 'manual' && manualProposal.active) {
          await executeManualApprovedStep(rawText, manualProposal, 'voice');
          return true;
        }
        const savedState = loadActiveProjectState(
          currentProject.id,
          effectiveStorageUid || undefined
        );
        const resumePrompt = savedState
          ? `Sara, continua o projeto "${savedState.projectName}" exatamente de onde parámos (última etapa concluída: ${savedState.lastStepDone}; próximo passo sugerido: ${savedState.nextStep}). Lê todos os ficheiros existentes, preserva tudo e implementa a próxima melhoria/etapa completa.`
          : `Sara, lê todos os ficheiros do projeto "${currentProject.name}" e continua a partir do ponto atual adicionando a próxima funcionalidade real completa sem apagar o código existente.`;
        await handleSendMessageRef.current?.(resumePrompt, undefined, undefined, 'voice');
        return true;
      }

      // 7. Controlo completo de ecrãs, editor, ficheiros, console, preview e ações (também acessível a partir do Modo 1)
      if (cmd.type === 'focus_file') {
        if (workspaceModeRef.current !== 'builder') {
          setWorkspaceMode('builder');
          workspaceModeRef.current = 'builder';
        }
        speakAsSara(`A abrir o ficheiro ${cmd.filePath} no editor.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        setShowProjectsModal(false);
        setShowSettingsModal(false);
        setShowDeployModal(false);
        setIsPresentationMode(false);
        setIsPreviewFullscreen(false);
        setIsEditorFullscreen(false);
        setActiveFile(cmd.filePath);
        setRightTab('editor');
        setMobileTab('code');
        showToast(`Ficheiro aberto: ${cmd.filePath}`);
        return true;
      }

      if (cmd.type === 'open_editor') {
        if (workspaceModeRef.current !== 'builder') {
          setWorkspaceMode('builder');
          workspaceModeRef.current = 'builder';
        }
        speakAsSara(getPlatformCommandSpeech('open_editor'), voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        setShowProjectsModal(false);
        setShowSettingsModal(false);
        setShowDeployModal(false);
        setIsPresentationMode(false);
        setIsPreviewFullscreen(false);
        setIsEditorFullscreen(false);
        setRightTab('editor');
        setMobileTab('code');
        showToast('Editor aberto');
        return true;
      }

      if (cmd.type === 'open_editor_fullscreen') {
        if (workspaceModeRef.current !== 'builder') {
          setWorkspaceMode('builder');
          workspaceModeRef.current = 'builder';
        }
        speakAsSara(getPlatformCommandSpeech('open_editor_fullscreen'), voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        setShowProjectsModal(false);
        setShowSettingsModal(false);
        setShowDeployModal(false);
        setIsPresentationMode(false);
        setIsPreviewFullscreen(false);
        setRightTab('editor');
        setMobileTab('code');
        setIsEditorFullscreen(true);
        showToast('Editor em tela cheia');
        return true;
      }

      if (cmd.type === 'open_files') {
        if (workspaceModeRef.current !== 'builder') {
          setWorkspaceMode('builder');
          workspaceModeRef.current = 'builder';
        }
        speakAsSara(getPlatformCommandSpeech('open_files'), voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        setShowProjectsModal(false);
        setShowSettingsModal(false);
        setShowDeployModal(false);
        setIsPresentationMode(false);
        setIsPreviewFullscreen(false);
        setIsEditorFullscreen(false);
        setRightTab('files');
        setMobileTab('code');
        showToast('Ficheiros abertos');
        return true;
      }

      if (cmd.type === 'close_editor_or_back') {
        speakAsSara(getPlatformCommandSpeech('close_editor_or_back'), voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        setIsEditorFullscreen(false);
        setIsPreviewFullscreen(false);
        setIsPresentationMode(false);
        setShowProjectsModal(false);
        setShowSettingsModal(false);
        setShowDeployModal(false);
        setMobileTab('preview');
        showToast('Voltei ao painel principal');
        return true;
      }

      if (cmd.type === 'open_console') {
        if (workspaceModeRef.current !== 'builder') {
          setWorkspaceMode('builder');
          workspaceModeRef.current = 'builder';
        }
        speakAsSara(getPlatformCommandSpeech('open_console'), voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        setShowProjectsModal(false);
        setShowSettingsModal(false);
        setShowDeployModal(false);
        setIsPresentationMode(false);
        setIsPreviewFullscreen(false);
        setIsEditorFullscreen(false);
        setRightTab('console');
        setMobileTab('console');
        showToast('Console aberto');
        return true;
      }

      if (cmd.type === 'show_preview') {
        if (workspaceModeRef.current !== 'builder') {
          setWorkspaceMode('builder');
          workspaceModeRef.current = 'builder';
        }
        speakAsSara(getPlatformCommandSpeech('show_preview'), voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        setShowProjectsModal(false);
        setShowSettingsModal(false);
        setShowDeployModal(false);
        setIsPresentationMode(false);
        setIsEditorFullscreen(false);
        setIsPreviewFullscreen(false);
        setMobileTab('preview');
        setRefreshSeed((s) => s + 1);
        showToast('Preview aberto');
        return true;
      }

      if (cmd.type === 'open_preview_fullscreen') {
        if (workspaceModeRef.current !== 'builder') {
          setWorkspaceMode('builder');
          workspaceModeRef.current = 'builder';
        }
        speakAsSara(getPlatformCommandSpeech('open_preview_fullscreen'), voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        setShowProjectsModal(false);
        setShowSettingsModal(false);
        setShowDeployModal(false);
        setIsPresentationMode(false);
        setIsEditorFullscreen(false);
        setMobileTab('preview');
        setIsPreviewFullscreen(true);
        setRefreshSeed((s) => s + 1);
        showToast('Preview em tela cheia');
        return true;
      }

      if (cmd.type === 'preview_mobile') {
        if (workspaceModeRef.current !== 'builder') {
          setWorkspaceMode('builder');
          workspaceModeRef.current = 'builder';
        }
        speakAsSara(getPlatformCommandSpeech('preview_mobile'), voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        setShowProjectsModal(false);
        setShowSettingsModal(false);
        setShowDeployModal(false);
        setIsPresentationMode(false);
        setIsEditorFullscreen(false);
        setPreviewDevice('mobile');
        setMobileTab('preview');
        setRefreshSeed((s) => s + 1);
        showToast('Preview em Telemóvel');
        return true;
      }

      if (cmd.type === 'preview_tablet') {
        if (workspaceModeRef.current !== 'builder') {
          setWorkspaceMode('builder');
          workspaceModeRef.current = 'builder';
        }
        speakAsSara(getPlatformCommandSpeech('preview_tablet'), voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        setShowProjectsModal(false);
        setShowSettingsModal(false);
        setShowDeployModal(false);
        setIsPresentationMode(false);
        setIsEditorFullscreen(false);
        setPreviewDevice('tablet');
        setMobileTab('preview');
        setRefreshSeed((s) => s + 1);
        showToast('Preview em Tablet');
        return true;
      }

      if (cmd.type === 'preview_desktop') {
        if (workspaceModeRef.current !== 'builder') {
          setWorkspaceMode('builder');
          workspaceModeRef.current = 'builder';
        }
        speakAsSara(getPlatformCommandSpeech('preview_desktop'), voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        setShowProjectsModal(false);
        setShowSettingsModal(false);
        setShowDeployModal(false);
        setIsPresentationMode(false);
        setIsEditorFullscreen(false);
        setPreviewDevice('desktop');
        setMobileTab('preview');
        setRefreshSeed((s) => s + 1);
        showToast('Preview em PC');
        return true;
      }

      if (cmd.type === 'open_deploy') {
        setShowDeployModal(true);
        showToast(isOwner ? 'Painel de deploy aberto' : 'Painel de exportação aberto');
        speakAsSara(
          `${isOwner ? 'Painel de deploy' : 'Painel de exportação'} aberto${callerShortVoc}.`,
          voiceEnabledRef.current,
          {
            level: 'short',
            forceSpeak: true,
          }
        );
        return true;
      }

      if (cmd.type === 'push_github') {
        if (!isOwner) {
          showToast('Não tens acesso a isso.');
          speakAsSara('Não tens acesso a isso.', voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
          return true;
        }
        const ghToken = getSavedGitHubToken();
        if (!ghToken) {
          setShowDeployModal(true);
          showToast('Configura a Chave do Cofre primeiro');
          speakAsSara(`Configura a tua Chave do Cofre primeiro${callerShortVoc}.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
          return true;
        }
        if (!cmd.preAuthorized) {
          setPendingConfirmation({
            id: `conf_push_${Date.now()}`,
            title: 'Confirmar Envio ao Cofre',
            question: `Confirmas enviar os ${Object.keys(currentProject.files).length} ficheiros de "${currentProject.name}" para o Cofre de Projetos? Diz "Sim, confirmo" ou "Não".`,
            action: { type: 'push_github' },
          });
          speakAsSara(
            `Confirmas o envio de ${currentProject.name} para o Cofre de Projetos${callerVoc}?`,
            voiceEnabledRef.current,
            { level: 'short', forceSpeak: true }
          );
          return true;
        }
        try {
          showToast('A enviar para o Cofre de Projetos...');
          const res = await pushProjectToGitHub({
            projectName: currentProject.name,
            files: currentProject.files,
          });
          addConsoleLog('success', `[Cofre de Projetos] Enviado para ${res.repoUrl}`);
          showToast(`Cofre sincronizado: ${res.repoUrl}`);
          speakAsSara(`Envio para o Cofre de Projetos concluído${callerShortVoc}.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        } catch {
          const msg = 'Núcleo offline. A tentar reconectar...';
          addConsoleLog('error', msg);
          showToast(msg);
          speakAsSara(`Não consegui enviar para o Cofre de Projetos agora${callerShortVoc}.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        }
        return true;
      }

      if (cmd.type === 'save_project') {
        await handleSaveProjectToFirebase();
        speakAsSara(`Projeto salvo${callerShortVoc}.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'download_zip') {
        await handleDownloadZip();
        speakAsSara(`ZIP descarregado${callerShortVoc}.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'clear_chat') {
        if (!cmd.preAuthorized && messages.length > 0) {
          setPendingConfirmation({
            id: `conf_clear_${Date.now()}`,
            title: 'Confirmar Limpeza do Chat',
            question: 'Queres mesmo limpar todo o histórico técnico deste chat? Diz "Sim" ou "Não".',
            action: { type: 'clear_chat' },
          });
          speakAsSara(`Confirmas limpar o histórico técnico do chat${callerVoc}?`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
          return true;
        }
        stopSaraSpeech();
        setManualProposal(EMPTY_MANUAL_PROPOSAL);
        setMessages([]);
        showToast('Chat limpo');
        speakAsSara(`Chat limpo${callerShortVoc}.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'open_projects') {
        setShowProjectsModal(true);
        showToast('Projetos abertos');
        speakAsSara(`Lista de projetos aberta${callerShortVoc}.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'open_settings') {
        if (!isOwner) {
          showToast('Não tens acesso a isso.');
          speakAsSara('Não tens acesso a isso.', voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
          return true;
        }
        setShowSettingsModal(true);
        showToast('Configurações abertas');
        speakAsSara(`Configurações abertas${callerShortVoc}.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'stop_listening') {
        stopHandsFreeMic();
        showToast('Microfone desligado');
        speakAsSara(`Microfone desligado${callerShortVoc}.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'fix_error') {
        handleSaraFixError();
        return true;
      }

      if (cmd.type === 'undo_version') {
        const latestSnap = (currentProject.versions || [])[0];
        if (latestSnap) {
          handleRestoreVersion(latestSnap.id);
          speakAsSara(`Restaurei a versão anterior no preview${callerVoc}.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        } else {
          speakAsSara(`Ainda não há versão anterior guardada${callerVoc}.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        }
        return true;
      }

      if (cmd.type === 'toggle_presentation') {
        setIsEditorFullscreen(false);
        setIsPresentationMode((prev) => {
          const next = !prev;
          showToast(next ? 'Modo Apresentação ativo' : 'Saí do Modo Apresentação');
          speakAsSara(
            next
              ? `Modo apresentação ligado${callerVoc}.`
              : `Voltei do modo apresentação${callerVoc}.`,
            voiceEnabledRef.current,
            { level: 'short', forceSpeak: true }
          );
          return next;
        });
        return true;
      }

      if (cmd.type === 'delete_file') {
        handleDeleteFile(cmd.filePath);
        setRefreshSeed((s) => s + 1);
        showToast(`Ficheiro apagado: ${cmd.filePath}`);
        speakAsSara(`Apaguei o ficheiro ${cmd.filePath}${callerVoc}.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'create_project') {
        const projName = cmd.name || `Projeto ${projects.length + 1}`;
        handleCreateNewProject(projName, cmd.projectType || 'Site');
        showToast(`Projeto criado: ${projName}`);
        speakAsSara(`Criei e abri o projeto ${projName}${callerVoc}.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'open_named_project') {
        const target = findProjectByQuery(cmd.name);
        if (target) {
          await switchToProject(target);
          setShowProjectsModal(false);
          showToast(`Projeto aberto: ${target.name}`);
          speakAsSara(`Abri o projeto ${target.name}${callerVoc}.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        } else {
          speakAsSara(
            `Não encontrei nenhum projeto chamado ${cmd.name}${callerVoc}. Queres que eu crie?`,
            voiceEnabledRef.current,
            { level: 'short', forceSpeak: true }
          );
        }
        return true;
      }

      if (cmd.type === 'delete_project') {
        const target = cmd.name ? findProjectByQuery(cmd.name) : currentProject;
        if (target) {
          const deletedName = target.name;
          handleDeleteProject(target.id);
          showToast(`Projeto apagado: ${deletedName}`);
          speakAsSara(`Já apaguei o projeto ${deletedName}${callerVoc}.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        } else {
          speakAsSara(
            `Não encontrei nenhum projeto chamado ${cmd.name} para apagar${callerVoc}.`,
            voiceEnabledRef.current,
            { level: 'short', forceSpeak: true }
          );
        }
        return true;
      }

      if (cmd.type === 'duplicate_project') {
        const target = cmd.name ? findProjectByQuery(cmd.name) || currentProject : currentProject;
        handleDuplicateProject(target);
        showToast(`Projeto duplicado: ${target.name}`);
        speakAsSara(`Dupliquei o projeto ${target.name}${callerVoc}.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'rename_project') {
        handleRenameProject(currentProject.id, cmd.name);
        showToast(`Projeto renomeado: ${cmd.name}`);
        speakAsSara(`Mudei o nome do projeto para ${cmd.name}${callerVoc}.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'refresh_preview') {
        setRefreshSeed((s) => s + 1);
        showToast('Preview atualizado');
        speakAsSara(`Preview recarregado${callerVoc}.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      // 8. Consultas de progresso e relatório (respondem em 2.º plano por voz, sem conversa no chat)
      if (cmd.type === 'query_status') {
        const pct = computeLiveBuildPct(liveBuild);
        let reply = '';
        if (liveBuild.isBuilding) {
          const done = mission.tasks.filter((t) => t.status === 'done').length;
          const stepPart =
            mission.tasks.length > 0
              ? `etapa ${Math.min(mission.tasks.length, done + 1)} de ${mission.tasks.length}`
              : liveBuild.currentStepLabel || 'em construção';
          const filePart = liveBuild.activeFile ? ` no ficheiro ${liveBuild.activeFile}` : '';
          reply = `O Estúdio SARA está em ${pct}% (${stepPart}${filePart}), há ${liveBuild.elapsedSeconds} segundos.`;
        } else if (mission.active && mission.tasks.length > 0) {
          const done = mission.tasks.filter((t) => t.status === 'done').length;
          const remaining = mission.tasks.filter((t) => t.status !== 'done').map((t) => t.title);
          reply = `Já fiz ${done} de ${mission.tasks.length} etapas, falta: ${remaining.join(', ')}.`;
        } else if (manualProposal.active) {
          reply = `Estamos no Modo Manual na etapa ${manualProposal.currentStepIndex + 1} de ${manualProposal.totalEstimatedSteps}.`;
        } else {
          const mem = loadActiveProjectState(
            currentProject.id,
            effectiveStorageUid || undefined
          );
          reply = mem
            ? `O projeto ${mem.projectName} está pronto com ${Object.keys(currentProject.files).length} ficheiros.`
            : `O projeto ${currentProject.name} tem ${Object.keys(currentProject.files).length} ficheiros prontos.`;
        }
        speakAsSara(reply, voiceEnabledRef.current, {
          level: 'medium',
          isQuestionReply: true,
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'query_report') {
        const rep = mission.report || lastCompletedReport;
        const spokenSummary = rep
          ? `Terminei ${rep.completedCount} etapas e corrigi ${rep.errorsFixed} erros no ${rep.projectName}${callerVoc}.`
          : mission.active
          ? `Ainda estou a trabalhar na etapa ${mission.currentIndex + 1} de ${mission.tasks.length}${callerVoc}.`
          : `Ainda não concluí nenhuma missão automática recente${callerVoc}.`;
        speakAsSara(spokenSummary, voiceEnabledRef.current, {
          level: 'medium',
          isQuestionReply: true,
          forceSpeak: true,
        });
        return true;
      }

      return false;
    },
    [
      markUserActivity,
      handleLogout,
      isOwner,
      session,
      callerVoc,
      callerShortVoc,
      effectiveStorageUid,
      handleForceSilenceSara,
      handleChangeWorkspaceMode,
      executeConfirmedAction,
      cancelConfirmedAction,
      showToast,
      handleSwitchMode,
      runAutonomousMission,
      manualProposal,
      mission,
      resumableMission,
      executeManualApprovedStep,
      currentProject,
      projects.length,
      addConsoleLog,
      handleSaveProjectToFirebase,
      handleDownloadZip,
      stopHandsFreeMic,
      handleSaraFixError,
      handleRestoreVersion,
      handleDeleteFile,
      handleCreateNewProject,
      findProjectByQuery,
      handleDeleteProject,
      handleDuplicateProject,
      handleRenameProject,
      switchToProject,
      lastCompletedReport,
      messages.length,
      liveBuild,
      handleChangeBottomTab,
      handleStopSharingAll,
      handleActivateGhostMode,
      handleToggleAppearOnMap,
      handlePermitBackground,
      handleStopBackground,
    ]
  );

  // Executor universal de ações estruturadas (<SARA_ACTIONS>) emitidas pela própria IA
  const executeSaraActions = useCallback(
    async (actions?: SaraPlatformAction[]) => {
      if (!actions || actions.length === 0) return;

      for (const act of actions) {
        switch (act.type) {
          case 'open_editor':
            setShowProjectsModal(false);
            setShowSettingsModal(false);
            setShowDeployModal(false);
            setIsPresentationMode(false);
            setIsPreviewFullscreen(false);
            setIsEditorFullscreen(false);
            setRightTab('editor');
            setMobileTab('code');
            break;
          case 'open_editor_fullscreen':
            setShowProjectsModal(false);
            setShowSettingsModal(false);
            setShowDeployModal(false);
            setIsPresentationMode(false);
            setIsPreviewFullscreen(false);
            setRightTab('editor');
            setMobileTab('code');
            setIsEditorFullscreen(true);
            break;
          case 'open_files':
            setShowProjectsModal(false);
            setShowSettingsModal(false);
            setShowDeployModal(false);
            setIsPresentationMode(false);
            setIsPreviewFullscreen(false);
            setIsEditorFullscreen(false);
            setRightTab('files');
            setMobileTab('code');
            break;
          case 'open_console':
            setShowProjectsModal(false);
            setShowSettingsModal(false);
            setShowDeployModal(false);
            setIsPresentationMode(false);
            setIsPreviewFullscreen(false);
            setIsEditorFullscreen(false);
            setRightTab('console');
            setMobileTab('console');
            break;
          case 'show_preview':
            setShowProjectsModal(false);
            setShowSettingsModal(false);
            setShowDeployModal(false);
            setIsPresentationMode(false);
            setIsEditorFullscreen(false);
            setIsPreviewFullscreen(false);
            setMobileTab('preview');
            setRefreshSeed((s) => s + 1);
            break;
          case 'open_preview_fullscreen':
            setShowProjectsModal(false);
            setShowSettingsModal(false);
            setShowDeployModal(false);
            setIsPresentationMode(false);
            setIsEditorFullscreen(false);
            setMobileTab('preview');
            setIsPreviewFullscreen(true);
            setRefreshSeed((s) => s + 1);
            break;
          case 'close_preview_fullscreen':
            setIsPreviewFullscreen(false);
            break;
          case 'toggle_presentation':
            setShowProjectsModal(false);
            setShowSettingsModal(false);
            setShowDeployModal(false);
            setIsEditorFullscreen(false);
            setIsPreviewFullscreen(false);
            setIsPresentationMode((v) => !v);
            break;
          case 'close_overlay':
            setIsEditorFullscreen(false);
            setIsPreviewFullscreen(false);
            setIsPresentationMode(false);
            setShowProjectsModal(false);
            setShowSettingsModal(false);
            setShowDeployModal(false);
            break;
          case 'preview_mobile':
            setShowProjectsModal(false);
            setShowSettingsModal(false);
            setShowDeployModal(false);
            setIsPresentationMode(false);
            setIsEditorFullscreen(false);
            setPreviewDevice('mobile');
            setMobileTab('preview');
            setRefreshSeed((s) => s + 1);
            break;
          case 'preview_tablet':
            setShowProjectsModal(false);
            setShowSettingsModal(false);
            setShowDeployModal(false);
            setIsPresentationMode(false);
            setIsEditorFullscreen(false);
            setPreviewDevice('tablet');
            setMobileTab('preview');
            setRefreshSeed((s) => s + 1);
            break;
          case 'preview_desktop':
            setShowProjectsModal(false);
            setShowSettingsModal(false);
            setShowDeployModal(false);
            setIsPresentationMode(false);
            setIsEditorFullscreen(false);
            setPreviewDevice('desktop');
            setMobileTab('preview');
            setRefreshSeed((s) => s + 1);
            break;
          case 'open_projects':
            setShowProjectsModal(true);
            break;
          case 'open_settings':
            if (isOwner) setShowSettingsModal(true);
            break;
          case 'open_deploy':
            setShowDeployModal(true);
            break;
          case 'create_project':
            handleCreateNewProject(
              act.name || `Projeto ${projects.length + 1}`,
              act.projectType || 'Site'
            );
            break;
          case 'open_project': {
            const target = findProjectByQuery(act.name);
            if (target) {
              await switchToProject(target);
              setShowProjectsModal(false);
              showToast(`Projeto aberto: ${target.name}`);
            }
            break;
          }
          case 'delete_project': {
            const target = act.name ? findProjectByQuery(act.name) : currentProject;
            if (target) {
              handleDeleteProject(target.id);
              showToast(`Projeto apagado: ${target.name}`);
            }
            break;
          }
          case 'rename_project':
            if (act.name) {
              handleRenameProject(currentProject.id, act.name);
              showToast(`Projeto renomeado: ${act.name}`);
            }
            break;
          case 'duplicate_project': {
            const target = act.name ? findProjectByQuery(act.name) || currentProject : currentProject;
            handleDuplicateProject(target);
            showToast(`Projeto duplicado: ${target.name}`);
            break;
          }
          case 'save_project':
            await handleSaveProjectToFirebase();
            break;
          case 'focus_file':
            if (act.path) {
              const found = Object.keys(currentProject.files).find(
                (k) => k.toLowerCase() === act.path!.toLowerCase() || k.toLowerCase().endsWith(act.path!.toLowerCase())
              );
              if (found) {
                setIsEditorFullscreen(false);
                setActiveFile(found);
                setRightTab('editor');
                setMobileTab('code');
              }
            }
            break;
          case 'delete_file':
            if (act.path) {
              const found = Object.keys(currentProject.files).find(
                (k) => k.toLowerCase() === act.path!.toLowerCase() || k.toLowerCase().endsWith(act.path!.toLowerCase())
              );
              if (found) {
                handleDeleteFile(found);
                setRefreshSeed((s) => s + 1);
              }
            }
            break;
          case 'refresh_preview':
            setRefreshSeed((s) => s + 1);
            break;
          case 'undo_version': {
            const latestSnap = (currentProject.versions || [])[0];
            if (latestSnap) handleRestoreVersion(latestSnap.id);
            break;
          }
          case 'download_zip':
            await handleDownloadZip();
            break;
          case 'push_github':
            if (isOwner) setShowDeployModal(true);
            break;
          case 'clear_chat':
            stopSaraSpeech();
            setManualProposal(EMPTY_MANUAL_PROPOSAL);
            setMessages([]);
            break;
          case 'switch_manual':
            setAgentMode('manual');
            showToast('Modo Manual ativado');
            break;
          case 'switch_automatic':
            setAgentMode('automatic');
            showToast('Modo Automático ativado');
            break;
          case 'pause_mission':
            missionPausedRef.current = true;
            setMission((prev) => ({ ...prev, paused: true }));
            break;
          case 'resume_mission':
            missionPausedRef.current = false;
            setMission((prev) => ({ ...prev, paused: false }));
            break;
          case 'open_report': {
            const rep = mission.report || lastCompletedReport;
            if (rep) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `sara_rep_act_${Date.now()}`,
                  sender: 'sara',
                  text: formatMissionReportText(rep),
                  timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
                  mode: 'mission',
                },
              ]);
            }
            break;
          }
          case 'fix_error':
            handleSaraFixError();
            break;
          case 'open_builder_mode':
            handleChangeWorkspaceMode('builder');
            break;
          case 'open_jarvis_mode':
            handleChangeWorkspaceMode('jarvis');
            break;
          default:
            break;
        }
      }
    },
    [
      projects.length,
      currentProject,
      handleCreateNewProject,
      findProjectByQuery,
      handleDeleteProject,
      handleRenameProject,
      handleDuplicateProject,
      handleSaveProjectToFirebase,
      handleDeleteFile,
      handleRestoreVersion,
      handleDownloadZip,
      switchToProject,
      mission.report,
      lastCompletedReport,
      handleSaraFixError,
      handleChangeWorkspaceMode,
      isOwner,
      showToast,
    ]
  );

  const runBuilderImageGeneration = useCallback(
    async (
      imgPrompt: string,
      options?: { targetMessageId?: string; userDisplayText?: string; variationSeed?: number }
    ) => {
      const nowTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      const targetId =
        options?.targetMessageId ||
        `sara_img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      if (options?.targetMessageId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === targetId
              ? {
                  ...m,
                  text: IMAGE_CREATING_MESSAGE,
                  imageUrl: undefined,
                  isGeneratingImage: true,
                  generatedImagePrompt: imgPrompt,
                }
              : m
          )
        );
      } else {
        const nextMsgs: ChatMessage[] = [];
        if (options?.userDisplayText) {
          nextMsgs.push({
            id: `usr_img_${Date.now()}`,
            sender: 'user',
            text: options.userDisplayText,
            timestamp: nowTime,
          });
        }
        nextMsgs.push({
          id: targetId,
          sender: 'sara',
          text: IMAGE_CREATING_MESSAGE,
          timestamp: nowTime,
          mode: 'conversation',
          generatedImagePrompt: imgPrompt,
          isGeneratingImage: true,
        });
        setMessages((prev) => [...prev, ...nextMsgs]);
      }

      const res = await generateSaraImage(imgPrompt, { variationSeed: options?.variationSeed });
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === targetId
              ? {
                  ...m,
                  text: `Imagem criada: ${imgPrompt}`,
                  imageUrl: res.dataUrl,
                  isGeneratingImage: false,
                  generatedImagePrompt: imgPrompt,
                }
              : m
          )
        );
        speakAsSara('Aqui está a tua imagem.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === targetId
              ? {
                  ...m,
                  text: res.error,
                  imageUrl: undefined,
                  isGeneratingImage: false,
                  generatedImagePrompt: imgPrompt,
                }
              : m
          )
        );
        speakAsSara(res.error, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
      }
    },
    []
  );

  const handleSendMessage = useCallback(
    async (
      text: string,
      image?: ConvertedImage | null,
      attachments?: AttachedFile[],
      source: 'text' | 'voice' = 'text'
    ) => {
      const rawTrimmed = text.trim();
      if (!rawTrimmed && !image && (!attachments || attachments.length === 0)) return;

      const isVoice = source === 'voice';
      const preGuardTrimmed = rawTrimmed;
      markUserActivity();

      // PROTEÇÃO TOTAL (Lealdade, Admin Invisível, Segredo & Privacidade) para não-donos antes de qualquer comando ou IA
      if (preGuardTrimmed) {
        const guard = evaluateNonOwnerGuard(preGuardTrimmed, session);
        if (guard.intercepted) {
          const guardReply = guard.reply || 'Não tens acesso a isso.';
          const guardTime = new Date().toLocaleTimeString('pt-PT', {
            hour: '2-digit',
            minute: '2-digit',
          });
          if (!isVoice) {
            const gUsrMsg: ChatMessage = {
              id: `usr_${Date.now()}`,
              sender: 'user',
              text: preGuardTrimmed,
              timestamp: guardTime,
            };
            const gSaraMsg: ChatMessage = {
              id: `sara_guard_${Date.now()}`,
              sender: 'sara',
              text: guardReply,
              timestamp: guardTime,
              mode: 'conversation',
              voiceDelivered: true,
            };
            setMessages((prev) => [...prev, gUsrMsg, gSaraMsg]);
            if (effectiveStorageUid) {
              salvarMensagemChatFirebase(gUsrMsg, currentProject.id, effectiveStorageUid);
              salvarMensagemChatFirebase(gSaraMsg, currentProject.id, effectiveStorageUid);
            }
          }
          speakAsSara(guard.voiceSummary || guardReply, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
          return;
        }
      }

      const reconText = rawTrimmed
        ? reconstructDistortedVoiceInput(rawTrimmed, voiceContextRef.current)
        : null;
      if (reconText?.unintelligible && !image && (!attachments || attachments.length === 0)) {
        const clarifier =
          reconText.clarifierSpeech || 'Epa, essa chegou toda torta, era música, site ou luz?';
        speakAsSara(clarifier, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return;
      }

      const trimmed = reconText
        ? reconText.reconstructed || reconText.cleaned || rawTrimmed
        : rawTrimmed;
      if (trimmed) {
        pushRecentUtterance(trimmed);
      }

      const imgPrompt =
        !image && (!attachments || attachments.length === 0)
          ? extractImageGenPrompt(trimmed)
          : null;
      if (imgPrompt) {
        await runBuilderImageGeneration(imgPrompt, { userDisplayText: trimmed });
        return;
      }

      const cmd = parseVoiceCommand(trimmed, voiceContextRef.current);
      if (cmd.type === 'start_listening') {
        startHandsFreeMicRef.current?.();
        showToast('Microfone contínuo ativado!');
        speakAsSara(`Microfone ligado, estou a ouvir${callerShortVoc}.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return;
      }

      const handled = await executePlatformCommand(cmd, trimmed);
      if (handled) return;

      // Separação estrita: pedidos apenas de controlo de interface nunca acionam criação/edição de código
      const isPlatformOnly =
        isPlatformCommandIntent(trimmed) && !image && (!attachments || attachments.length === 0);

      // CONEXÃO BUILDER -> ASSISTENTE: pedidos de explicação/estudo/dúvida no Builder mudam para o Assistente SEM parar builds ativos
      if (
        workspaceModeRef.current === 'builder' &&
        !isPlatformOnly &&
        !image &&
        (!attachments || attachments.length === 0) &&
        isAssistantExplanationIntent(trimmed)
      ) {
        handleChangeWorkspaceMode('jarvis', { silent: true });
        setTimeout(() => {
          void jarvisPromptRef.current?.(trimmed, source);
        }, 90);
        return;
      }

      const hasExistingCode = !isProjectBlank(currentProject.files);
      const activeProjectState = loadActiveProjectState(
        currentProject.id,
        effectiveStorageUid || undefined
      );
      const screenContext: ScreenContextInfo = {
        activeTab: rightTab,
        previewDevice,
        activeFile,
        projectName: currentProject.name,
        isEditorFullscreen,
        isPreviewFullscreen,
        hasExistingCode,
        availableProjects: projects.map((p) => p.name),
        openModal: showProjectsModal
          ? 'projects'
          : showSettingsModal
          ? 'settings'
          : showDeployModal
          ? 'deploy'
          : isPresentationMode
          ? 'presentation'
          : null,
      };

      // Segurança inteligente: pergunta curto e direto antes de executar pedidos destrutivos/ambíguos
      const dangerCheck = isPlatformOnly ? null : detectAmbiguousOrDangerousPrompt(trimmed, hasExistingCode);
      if (dangerCheck) {
        setPendingConfirmation({
          id: `conf_danger_${Date.now()}`,
          title: dangerCheck.title,
          question: dangerCheck.question,
          action: { type: 'destructive_prompt', prompt: trimmed, source },
        });
        speakAsSara(dangerCheck.question, voiceEnabledRef.current, {
          level: 'medium',
          forceSpeak: true,
        });
        return;
      }

      const nowTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      const attachSummary = attachments?.length ? attachments.map((a) => a.name).join(', ') : undefined;
      const hasMediaOrFiles = Boolean(image) || Boolean(attachments && attachments.length > 0);
      const isPureChatRequest =
        !hasMediaOrFiles &&
        isPureConversationIntent(trimmed, false, false, hasExistingCode);

      markUserActivity(isPureChatRequest ? 'chat' : 'builder');

      // No MODO MANUAL: se já há uma proposta aguardando aprovação/colaboração
      if (!isPlatformOnly && agentModeRef.current === 'manual' && manualProposal.active && !hasMediaOrFiles) {
        if (isRejectionOrCancelMessage(trimmed)) {
          setManualProposal(EMPTY_MANUAL_PROPOSAL);
          const cancelReply =
            `Combinado${callerShortVoc}! Parei essa proposta por aqui. Diz-me o que queres ajustar ou mudar de rumo.`;
          if (!isVoice) {
            setMessages((prev) => [
              ...prev,
              { id: `usr_${Date.now()}`, sender: 'user', text: trimmed, timestamp: nowTime },
              {
                id: `sara_man_cancel_${Date.now()}`,
                sender: 'sara',
                text: cancelReply,
                timestamp: nowTime,
                mode: 'conversation',
                voiceDelivered: true,
              },
            ]);
          }
          speakAsSara(cancelReply, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
          return;
        }

        if (isApprovalMessage(trimmed)) {
          await executeManualApprovedStep(trimmed, manualProposal, source);
          return;
        }

        // Se respondeu com uma pergunta sobre a proposta (ex: "o que sugeres?"), responde em voz sem perder o plano
        const isQuestionOnProposal =
          isPureChatRequest || (/\?$/.test(trimmed) && !/\b(faz|executa|avanca|adiciona|coloca|muda|usa)\b/i.test(trimmed));
        if (!isQuestionOnProposal) {
          const updatedQueue = manualProposal.stepsQueue.map((item, idx) =>
            idx === manualProposal.currentStepIndex
              ? {
                  ...item,
                  description: `${item.description} (Ajuste de ${callerName}: ${trimmed})`,
                }
              : item
          );
          const refinedProposal: ManualProposalState = {
            ...manualProposal,
            stepsQueue: updatedQueue,
          };
          setManualProposal(refinedProposal);
          await speakAsSaraAndWait(
            `Excelente ajuste${callerVoc}! Já incorporei a tua ideia nesta etapa e vou construir agora.`,
            voiceEnabledRef.current,
            { level: 'short', forceSpeak: true }
          );
          await executeManualApprovedStep(trimmed, refinedProposal, source);
          return;
        }
      }

      // No MODO AUTOMÁTICO: qualquer pedido de criação, evolução ou correção dispara pipeline autónomo (fala primeiro + sugestões -> constrói -> testa -> corrige)
      if (
        !isPlatformOnly &&
        !isPureChatRequest &&
        agentModeRef.current === 'automatic' &&
        !hasMediaOrFiles
      ) {
        await runAutonomousMission(trimmed, { source });
        return;
      }

      // No MODO MANUAL: para novo projeto OU evolução/edição de projeto existente -> planeia, FALA PRIMEIRO com sugestões e PERGUNTA antes de mexer no código!
      if (
        !isPlatformOnly &&
        !isPureChatRequest &&
        agentModeRef.current === 'manual' &&
        !manualProposal.active &&
        !hasMediaOrFiles
      ) {
        if (!isVoice) {
          const userMsg: ChatMessage = {
            id: `usr_${Date.now()}`,
            sender: 'user',
            text: trimmed,
            timestamp: nowTime,
          };
          setMessages((prev) => [...prev, userMsg]);
          if (effectiveStorageUid) {
            salvarMensagemChatFirebase(userMsg, currentProject.id, effectiveStorageUid);
          }
        }
        setIsThinking(true);
        setLiveBuild({
          isBuilding: true,
          phase: 'thinking',
          elapsedSeconds: 0,
          steps: [],
          createdFiles: [],
          completedFiles: [],
        });

        try {
          const [kickoffRes, plan] = await Promise.all([
            fetchSaraFastKickoff({
              prompt: trimmed,
              files: currentProject.files,
              agentMode: 'manual',
              hasExistingCode,
              projectName: currentProject.name,
              screenContext,
              userIdentity,
            }),
            planAutonomousMission(
              trimmed,
              currentProject.files,
              'manual',
              getRequestedPastProjects(trimmed),
              activeProjectState,
              userIdentity
            ),
          ]);

          setIsThinking(false);
          setLiveBuild({
            isBuilding: false,
            phase: 'idle',
            elapsedSeconds: 0,
            steps: [],
            createdFiles: [],
            completedFiles: [],
          });

          const queue = plan.tasks || [];
          if (queue.length > 0) {
            const initialProposal: ManualProposalState = {
              active: true,
              goal: trimmed,
              currentStepIndex: 0,
              totalEstimatedSteps: queue.length,
              stepsQueue: queue,
              pendingPromptForSara: trimmed,
            };
            setManualProposal(initialProposal);

            const first = queue[0];
            if (effectiveStorageUid) {
              updateProjectStateFromRecord(
                currentProject,
                {
                  goal: trimmed,
                  lastStepDone: 'Plano colaborativo proposto (a aguardar aprovação)',
                  nextStep: first.title,
                  missingFeatures: queue.map((q) => q.title),
                },
                effectiveStorageUid
              );
            }

            const stepsMarkdown = queue
              .map((t, idx) => `${idx + 1}. **${t.title}** — ${t.description}`)
              .join('\n');
            const proposalText = `${kickoffRes.reply}\n\n**Plano sugerido (${queue.length} etapas):**\n${stepsMarkdown}\n\nPosso avançar já com a **Etapa 1 (${first.title})** ou queres ajustar algum detalhe antes?`;

            const proposalMsg: ChatMessage = {
              id: `sara_prop_${Date.now()}`,
              sender: 'sara',
              text: proposalText,
              timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
              mode: 'manual-proposal',
              voiceDelivered: true,
            };
            setMessages((prev) => [...prev, proposalMsg]);
            if (effectiveStorageUid) {
              salvarMensagemChatFirebase(proposalMsg, currentProject.id, effectiveStorageUid);
            }

            // Fala PRIMEIRO com sugestões e pergunta de aprovação — NÃO executa código antes do utilizador confirmar!
            speakAsSara(kickoffRes.reply, voiceEnabledRef.current, {
              level: 'medium',
              forceSpeak: true,
            });
            return;
          }
        } catch {
          setIsThinking(false);
          setLiveBuild({
            isBuilding: false,
            phase: 'idle',
            elapsedSeconds: 0,
            steps: [],
            createdFiles: [],
          });
        }
      }

      // Fluxo padrão com streaming (conversa pura, imagens, anexos ou fallback):
      // - Se veio por VOZ: não mostra o texto falado pelo utilizador no chat!
      const userMsg: ChatMessage = {
        id: `usr_${Date.now()}`,
        sender: 'user',
        text: trimmed || 'Analisa os anexos.',
        imageUrl: image?.previewUrl,
        attachedFileName: attachSummary,
        timestamp: nowTime,
      };

      if (!isVoice) {
        setMessages((prev) => [...prev, userMsg]);
        if (effectiveStorageUid) {
          salvarMensagemChatFirebase(userMsg, currentProject.id, effectiveStorageUid);
        }
      }

      setIsThinking(true);
      const startTime = Date.now();

      // Garantia absoluta: Sara FALA PRIMEIRO antes de qualquer alteração de ficheiros aparecer no ecrã
      let kickoffSpeechPromise: Promise<void> = Promise.resolve();
      let kickoffSpeechSettled = true;
      let pendingStreamedFiles: {
        files: ProjectFiles;
        activeFile?: string;
        completedFiles: string[];
        modelUsed?: string;
        steps: BuildStep[];
        planSentence?: string;
      } | null = null;

      if (!isPlatformOnly && !isPureChatRequest) {
        setLiveBuild({
          isBuilding: true,
          phase: 'thinking',
          elapsedSeconds: 0,
          steps: [],
          createdFiles: [],
          completedFiles: [],
        });

        kickoffSpeechSettled = false;
        const kickoffRes = await fetchSaraFastKickoff({
          prompt: trimmed || 'Analisar anexos e construir',
          files: currentProject.files,
          agentMode: agentModeRef.current,
          hasExistingCode,
          projectName: currentProject.name,
          screenContext,
          userIdentity,
        });

        kickoffSpeechPromise = speakAsSaraAndWait(kickoffRes.reply, voiceEnabledRef.current, {
          level: 'medium',
          forceSpeak: true,
        }).then(() => {
          kickoffSpeechSettled = true;
          if (pendingStreamedFiles) {
            const buffered = pendingStreamedFiles;
            pendingStreamedFiles = null;
            if (buffered.activeFile) setActiveFile(buffered.activeFile);
            replaceCurrentProjectFiles(buffered.files, undefined, undefined, hasExistingCode);
          }
        });
      }

      try {
        const result = await runSaraStream({
          prompt: trimmed,
          files: currentProject.files,
          consoleLogs,
          history: [...messages, userMsg],
          image,
          attachments,
          agentMode: agentModeRef.current,
          pastProjects: getRequestedPastProjects(trimmed),
          projectState: activeProjectState,
          screenContext,
          userIdentity,
          callbacks: {
            onMeta: (meta, modelUsed) => {
              if (meta.mode === 'conversation') {
                setLiveBuild((prev) => ({
                  ...prev,
                  isBuilding: false,
                  phase: 'idle',
                  steps: [],
                  modelUsed,
                }));
                return;
              }

              setLiveBuild((prev) => ({
                ...prev,
                isBuilding: true,
                phase: 'planning',
                planSentence: meta.plan,
                currentStepLabel: meta.steps?.[0],
                steps: (meta.steps || []).map((label, idx) => ({
                  id: idx + 1,
                  label,
                  status: idx === 0 ? 'running' : 'pending',
                })),
                modelUsed,
              }));
            },
            onFileProgress: (streamedFiles, currentActive, completedFiles) => {
              const createdList = Object.keys(streamedFiles);
              if (!kickoffSpeechSettled) {
                pendingStreamedFiles = {
                  files: streamedFiles,
                  activeFile: currentActive,
                  completedFiles,
                  steps: [],
                };
              } else {
                if (currentActive) {
                  setActiveFile(currentActive);
                }
                replaceCurrentProjectFiles(streamedFiles, undefined, undefined, hasExistingCode);
              }

              setLiveBuild((prev) => {
                const totalSteps = prev.steps.length;
                const activeStepIdx = totalSteps
                  ? Math.min(Math.floor((completedFiles.length / Math.max(1, createdList.length)) * totalSteps), totalSteps - 1)
                  : -1;
                return {
                  ...prev,
                  isBuilding: true,
                  phase: 'building',
                  activeFile: currentActive,
                  createdFiles: createdList,
                  completedFiles,
                  steps: prev.steps.map((s, idx) => ({
                    ...s,
                    status: idx < activeStepIdx ? 'done' : idx === activeStepIdx ? 'running' : 'pending',
                  })),
                  currentStepLabel:
                    (activeStepIdx >= 0 ? prev.steps[activeStepIdx]?.label : undefined) ||
                    `A criar ${currentActive || 'código'}`,
                };
              });
            },
            onBusyRetry: (busyMsg) => {
              showToast(busyMsg);
              setLiveBuild((prev) =>
                prev.isBuilding ? { ...prev, currentStepLabel: busyMsg } : prev
              );
            },
            onReplyProgress: (progressText) => {
              if (progressText.includes('Núcleo ocupado')) {
                showToast(progressText);
              }
            },
          },
        });

        await kickoffSpeechPromise;

        const totalElapsed = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        setIsThinking(false);
        setLiveBuild({
          isBuilding: false,
          phase: 'idle',
          elapsedSeconds: 0,
          steps: [],
          createdFiles: [],
        });

        if (!isPlatformOnly && result.updateFiles && result.files) {
          const keepName = hasExistingCode && currentProject.name !== 'Novo Projeto';
          replaceCurrentProjectFiles(
            result.files,
            keepName ? undefined : result.projectName,
            keepName ? undefined : result.projectType,
            hasExistingCode,
            `Alteração (${new Date().toLocaleTimeString('pt-PT', {
              hour: '2-digit',
              minute: '2-digit',
            })})`
          );

          const mergedFiles = hasExistingCode
            ? { ...currentProject.files, ...result.files }
            : { ...result.files };
          if (effectiveStorageUid) {
            const nextState = updateProjectStateFromRecord(
              {
                ...currentProject,
                name: keepName ? currentProject.name : result.projectName || currentProject.name,
                type: keepName ? currentProject.type : result.projectType || currentProject.type,
                files: mergedFiles,
              },
              {
                goal: activeProjectState?.goal || trimmed,
                lastStepDone: result.planSentence || trimmed.slice(0, 100),
                nextStep: result.nextStep || result.proactiveSuggestion || 'Testar e expandir',
                missingFeatures: result.missingFeatures || [],
              },
              effectiveStorageUid
            );
            salvarEstadoProjetoFirebase(nextState, effectiveStorageUid);
          }

          const keys = Object.keys(result.files);
          if (keys.includes('index.html')) {
            setActiveFile('index.html');
          } else if (keys[0]) {
            setActiveFile(keys[0]);
          }
          if (!hasExistingCode && keys.length >= 3) {
            setRightTab('files');
          }
          setRefreshSeed((s) => s + 1);
          if (isVoice) {
            setMobileTab('preview');
          }
          if (/corrige|erro/i.test(trimmed)) {
            setErrorsFixedCount((c) => c + 1);
          }
          addConsoleLog(
            'success',
            `Construídos ${keys.length} ficheiro(s) em ${totalElapsed}s (${result.engineLabel}).`
          );
          showToast(`${keys.length} ficheiro(s) atualizados no Editor & Preview`);
        }

        if (result.needsApiKey && isOwner) {
          showToast('Configura a Chave do Núcleo nas Configurações do Sistema para gerar código.');
          setShowSettingsModal(true);
        }

        const createdList = result.files ? Object.keys(result.files) : [];

        // REGRA: O que a Sara responde em voz (conversa pura sem código) fala PRIMEIRO e só depois executa ações da plataforma!
        if (isPlatformOnly || (!result.updateFiles && (isVoice || result.mode === 'conversation'))) {
          const spokenOnly = result.voiceSummary || result.reply || `Pronto${callerVoc}.`;
          speakAsSara(spokenOnly, voiceEnabledRef.current, {
            level: 'medium',
            isQuestionReply: true,
            forceSpeak: true,
          });
          if (result.actions && result.actions.length > 0) {
            await executeSaraActions(result.actions);
          }
          // Só mostra no chat se o utilizador escreveu manualmente em texto
          if (!isVoice) {
            const techReplyMsg: ChatMessage = {
              id: `sara_${Date.now()}`,
              sender: 'sara',
              text: result.reply,
              timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
              mode: result.mode,
              engineLabel: result.engineLabel,
              voiceDelivered: true,
            };
            setMessages((prev) => [...prev, techReplyMsg]);
            if (effectiveStorageUid) {
              salvarMensagemChatFirebase(techReplyMsg, currentProject.id, effectiveStorageUid);
            }
          }
          return;
        }

        if (result.actions && result.actions.length > 0) {
          await executeSaraActions(result.actions);
        }

        // Quando há criação/edição de código: o chat mostra APENAS o cartão útil de engenharia (arquitetura, ficheiros, blocos e 2 melhorias estratégicas)
        const finalSaraMsg: ChatMessage = {
          id: `sara_${Date.now()}`,
          sender: 'sara',
          text: result.reply,
          timestamp: new Date().toLocaleTimeString('pt-PT', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          mode: result.mode,
          architectureSummary: result.architectureSummary,
          strategicImprovements: result.strategicImprovements,
          suggestion: result.proactiveSuggestion,
          voiceDelivered: true,
          hasCodeUpdate: result.updateFiles,
          engineLabel: result.engineLabel,
          codeBlocks: result.codeBlocks,
          buildSummary: result.updateFiles
            ? {
                elapsedSeconds: totalElapsed,
                filesCreated: createdList,
                steps: result.steps || [],
                modelUsed: result.modelUsed,
              }
            : undefined,
        };

        setMessages((prev) => [...prev, finalSaraMsg]);
        if (effectiveStorageUid) {
          salvarMensagemChatFirebase(finalSaraMsg, currentProject.id, effectiveStorageUid);
        }

        // Em voz, fala apenas o resumo curto de 2-3 frases + 2 melhorias em 2.º plano (sem ler código nem duplicar texto)
        const projectNameForSpeech =
          hasExistingCode && currentProject.name !== 'Novo Projeto'
            ? currentProject.name
            : result.projectName || currentProject.name;
        const spokenRecap = getSpokenBuildRecap(
          projectNameForSpeech,
          createdList.length,
          result.voiceSummary,
          result.strategicImprovements
        );
        speakAsSara(spokenRecap, voiceEnabledRef.current, {
          level: voiceLevelRef.current === 'short' ? 'medium' : voiceLevelRef.current,
          allowInfraMention: isOwner && /\b(firebase|pastas|estrutura)\b/i.test(trimmed),
        });
      } catch (err: any) {
        setIsThinking(false);
        setLiveBuild({
          isBuilding: false,
          phase: 'idle',
          elapsedSeconds: 0,
          steps: [],
          createdFiles: [],
        });
        // Regra estrita: erros de API NUNCA aparecem no chat como cartões de erro! Tratamento silencioso em 2.º plano.
        console.warn('[Sara Failover Silencioso]:', err?.message || err);
        const gentleSpoken = `Estou a trocar a rota dos motores para continuar ${currentProject.name}${callerVoc}. Podes tentar outra vez ou dar-me um comando de voz agora.`;
        if (!isVoice) {
          setMessages((prev) => [
            ...prev,
            {
              id: `sara_cont_${Date.now()}`,
              sender: 'sara',
              text: `Estou a ajustar o motor de resposta em segundo plano para **${currentProject.name}**${callerShortVoc} — envia novamente o próximo detalhe que eu sigo contigo!`,
              timestamp: nowTime,
              mode: 'conversation',
              voiceDelivered: true,
            },
          ]);
        }
        speakAsSara(gentleSpoken, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
      }
    },
    [
      executePlatformCommand,
      executeSaraActions,
      currentProject,
      projects,
      rightTab,
      previewDevice,
      activeFile,
      isEditorFullscreen,
      isPreviewFullscreen,
      isPresentationMode,
      showProjectsModal,
      showSettingsModal,
      showDeployModal,
      isSaraSilenced,
      runAutonomousMission,
      manualProposal,
      executeManualApprovedStep,
      getRequestedPastProjects,
      effectiveStorageUid,
      session,
      isOwner,
      callerName,
      callerVoc,
      callerShortVoc,
      userIdentity,
      markUserActivity,
      handleChangeWorkspaceMode,
      consoleLogs,
      messages,
      replaceCurrentProjectFiles,
      addConsoleLog,
      showToast,
      runBuilderImageGeneration,
    ]
  );

  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  useEffect(() => {
    executePlatformCommandRef.current = executePlatformCommand;
  }, [executePlatformCommand]);

  const handleRunConsoleJs = useCallback(
    (code: string) => {
      addConsoleLog('command', `> ${code}`);
      iframeRef.current?.contentWindow?.postMessage(
        { target: 'sara-preview-eval', code },
        '*'
      );
    },
    [addConsoleLog]
  );

  // Microfone Contínuo Mãos-Livres em 2.º plano (nunca morre por erros transitórios nem usa closures antigas)
  const startHandsFreeMic = useCallback(() => {
    if (shouldKeepListeningRef.current) return;
    shouldKeepListeningRef.current = true;
    setIsListening(true);

    stopMicRef.current = startContinuousVoiceRecognition({
      shouldKeepListening: () => shouldKeepListeningRef.current,
      onResult: (transcript) => {
        const silencedNow =
          isCallModeRef.current || isSaraSilencedRef.current || isSaraCallModeFlag() || isSaraSilencedFlag();

        // Prioridade máxima: comandos instantâneos de calar/parar/retomar antes de qualquer reconstrução ou fila
        const immediateBarge = detectBargeInCommand(transcript, {
          ...voiceContextRef.current,
          isSilenced: silencedNow,
          isCallMode: isCallModeRef.current || isSaraCallModeFlag(),
        });
        if (immediateBarge) {
          if (immediateBarge.type === 'silence_sara') {
            handleForceSilenceSara();
            return;
          }
          if (immediateBarge.type === 'enter_call_mode') {
            handleEnterCallMode();
            return;
          }
          const runner = executePlatformCommandRef.current || executePlatformCommand;
          void runner(immediateBarge, transcript);
          return;
        }

        // Quando está SILENCIADA ou em MODO CHAMADA, ignora tudo o que ouvir (inclusive conversa com outras pessoas)
        if (silencedNow) {
          const quickCmd = parseVoiceCommand(transcript, {
            ...voiceContextRef.current,
            isSilenced: true,
            isCallMode: isCallModeRef.current || isSaraCallModeFlag(),
          });
          if (
            quickCmd.type === 'unsilence_sara' ||
            quickCmd.type === 'silence_sara' ||
            quickCmd.type === 'enter_call_mode' ||
            quickCmd.type === 'stop_all_and_pause'
          ) {
            const runner = executePlatformCommandRef.current || executePlatformCommand;
            void runner(quickCmd, transcript);
          }
          return;
        }

        // Comando de despertar "Ei SARA" configurável nas definições de Segundo Plano
        if (bgSettingsRef.current.eiSaraEnabled && isEiSaraWakePhrase(transcript)) {
          setBubbleDismissed(false);
          if (isSaraSilencedRef.current && !isCallModeRef.current) {
            isSaraSilencedRef.current = false;
            setSaraSilenced(false);
            setIsSaraSilencedState(false);
          }
          const stripped = transcript.replace(/^(ei|hey|eh|oi)\s+sara[\s,.:!?-]*/i, '').trim();
          if (!stripped) {
            showToast('Ei SARA ativo — estou a ouvir!');
            speakAsSara(`Estou a ouvir${callerShortVoc}.`, voiceEnabledRef.current, {
              level: 'short',
              forceSpeak: true,
            });
            return;
          }
        }

        // Bloqueio extra anti-eco: nunca despacha prompts normais enquanto a Sara fala ou logo após eco dos altifalantes
        if (isSaraSpeakingRef.current || isSaraActivelySpeaking() || isProbableSaraEcho(transcript)) {
          return;
        }

        const voiceGuard = evaluateNonOwnerGuard(transcript, session);
        if (voiceGuard.intercepted) {
          speakAsSara(voiceGuard.voiceSummary || voiceGuard.reply || 'Não tens acesso a isso.', voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
          return;
        }

        const voiceRecon = reconstructDistortedVoiceInput(transcript, voiceContextRef.current);
        const cleanTranscript = voiceRecon.reconstructed || voiceRecon.cleaned || transcript;
        const normVoice = cleanTranscript
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!normVoice) return;

        // Evita disparo duplicado do mesmo áudio final ou empilhamento de turnos simultâneos de voz
        const nowTs = Date.now();
        if (
          (lastVoiceDispatchRef.current.norm === normVoice && nowTs - lastVoiceDispatchRef.current.ts < 2500) ||
          voiceDispatchInFlightRef.current
        ) {
          return;
        }

        if (!voiceRecon.unintelligible) {
          pushRecentUtterance(cleanTranscript);
        }

        const cmd = parseVoiceCommand(cleanTranscript, voiceContextRef.current);
        addConsoleLog('info', '[Canal de Voz] Comando captado em 2.º plano.');

        if (cmd.type === 'start_listening') {
          speakAsSara(`Já estou a ouvir${callerShortVoc}.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
          return;
        }

        lastVoiceDispatchRef.current = { norm: normVoice, ts: nowTs };
        voiceDispatchInFlightRef.current = true;
        setIsVoiceProcessing(true);
        const runner = executePlatformCommandRef.current || executePlatformCommand;
        runner(cmd, cleanTranscript)
          .then((handled) => {
            if (!handled) {
              if (workspaceModeRef.current === 'jarvis' && jarvisPromptRef.current) {
                return jarvisPromptRef.current(cleanTranscript, 'voice');
              }
              if (
                workspaceModeRef.current === 'builder' &&
                isAssistantExplanationIntent(cleanTranscript)
              ) {
                handleChangeWorkspaceMode('jarvis', { silent: true });
                setTimeout(() => {
                  void jarvisPromptRef.current?.(cleanTranscript, 'voice');
                }, 90);
                return;
              }
              return handleSendMessageRef.current?.(cleanTranscript, undefined, undefined, 'voice');
            }
          })
          .finally(() => {
            voiceDispatchInFlightRef.current = false;
            setIsVoiceProcessing(false);
          });
      },
      onError: (errMsg, fatal) => {
        addConsoleLog('warn', errMsg);
        voiceDispatchInFlightRef.current = false;
        setIsVoiceProcessing(false);
        if (fatal) {
          shouldKeepListeningRef.current = false;
          setIsListening(false);
          showToast(errMsg);
        }
      },
      onEnd: () => {
        if (!shouldKeepListeningRef.current) {
          setIsListening(false);
        }
      },
    });
  }, [
    addConsoleLog,
    callerShortVoc,
    executePlatformCommand,
    handleChangeWorkspaceMode,
    handleEnterCallMode,
    handleForceSilenceSara,
    session,
    showToast,
  ]);
  startHandsFreeMicRef.current = startHandsFreeMic;

  const handleToggleMic = useCallback(() => {
    if (isSaraSpeakingRef.current) {
      interruptSaraAndListen();
      if (!isListening && !shouldKeepListeningRef.current) {
        startHandsFreeMic();
      }
      showToast('Sara interrompida — podes falar agora!');
      return;
    }
    if (isListening || shouldKeepListeningRef.current) {
      stopHandsFreeMic();
      showToast('Microfone desligado');
    } else {
      startHandsFreeMic();
      showToast('Microfone contínuo mãos-livres ativado!');
    }
  }, [isListening, startHandsFreeMic, stopHandsFreeMic, showToast]);

  const handleToggleVoice = () => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      if (!next) {
        stopSaraSpeech();
      }
      return next;
    });
  };

  const handleChangeFileContent = (file: FileKey, content: string) => {
    setProjects((prev) =>
      prev.map((proj) => {
        if (proj.id !== currentProjectId) return proj;
        return {
          ...proj,
          files: { ...proj.files, [file]: content },
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const handleCreateFile = (filePath: string) => {
    setProjects((prev) =>
      prev.map((proj) => {
        if (proj.id !== currentProjectId) return proj;
        if (proj.files[filePath] !== undefined) return proj;
        return {
          ...proj,
          files: { ...proj.files, [filePath]: '' },
          updatedAt: new Date().toISOString(),
        };
      })
    );
    setActiveFile(filePath);
    addConsoleLog('info', `Ficheiro criado: ${filePath}`);
  };

  const handleUploadFilesToProject = (uploaded: Array<{ path: string; content: string }>) => {
    const map: ProjectFiles = {};
    for (const item of uploaded) {
      map[item.path] = item.content;
    }
    replaceCurrentProjectFiles(map, undefined, undefined, true, 'Upload de ficheiros');
    if (uploaded[0]) setActiveFile(uploaded[0].path);
    setRefreshSeed((s) => s + 1);
    showToast(`${uploaded.length} ficheiro(s) importado(s)!`);
  };

  const handleImportZipFromChat = async (file: File) => {
    try {
      const imported = await importProjectZip(file);
      const newProj: ProjectRecord = {
        id: `proj_${Date.now()}`,
        name: imported.name,
        type: 'Site',
        files: imported.files,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProjects((prev) => [newProj, ...prev]);
      setCurrentProjectId(newProj.id);
      setMessages([]);
      const keys = Object.keys(imported.files);
      setActiveFile(keys.includes('index.html') ? 'index.html' : keys[0] || 'index.html');
      setRefreshSeed((s) => s + 1);
      const st = effectiveStorageUid
        ? updateProjectStateFromRecord(newProj, undefined, effectiveStorageUid)
        : null;
      if (effectiveStorageUid && st) {
        salvarProjetoNoFirebase(newProj, effectiveStorageUid, callerName).catch(() => {});
        salvarEstadoProjetoFirebase(st, effectiveStorageUid).catch(() => {});
      }
      showToast(`ZIP "${imported.name}" importado!`);
    } catch (err: any) {
      addConsoleLog('error', err?.message || 'Falha ao importar ZIP.');
    }
  };

  const handleImportProject = (name: string, files: ProjectFiles) => {
    const imported: ProjectRecord = {
      id: `proj_${Date.now()}`,
      name,
      type: 'Site',
      files,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProjects((prev) => [imported, ...prev]);
    setCurrentProjectId(imported.id);
    setMessages([]);
    const keys = Object.keys(files);
    setActiveFile(keys.includes('index.html') ? 'index.html' : keys[0] || 'index.html');
    setRefreshSeed((s) => s + 1);
    if (effectiveStorageUid) {
      const st = updateProjectStateFromRecord(imported, undefined, effectiveStorageUid);
      salvarProjetoNoFirebase(imported, effectiveStorageUid, callerName).catch(() => {});
      salvarEstadoProjetoFirebase(st, effectiveStorageUid).catch(() => {});
    }
  };

  const handleCopyAllCode = () => {
    const full = buildStandaloneHtml(currentProject.files, currentProject.name);
    navigator.clipboard?.writeText(full).catch(() => {});
    showToast('Código completo copiado!');
  };

  const handleSelectProjectFileFromChat = (filePath: string) => {
    setActiveFile(filePath);
    setRightTab('editor');
    setMobileTab('code');
  };

  const handleApplyCodeBlockToPreview = (blk: ChatCodeBlock) => {
    replaceCurrentProjectFiles({ [blk.path]: blk.code }, undefined, undefined, true, `Aplicado bloco ${blk.path}`);
    setRefreshSeed((s) => s + 1);
    setMobileTab('preview');
    showToast(`${blk.path} aplicado no Preview!`);
  };

  const handleOpenCodeBlockInEditor = (blk: ChatCodeBlock) => {
    replaceCurrentProjectFiles({ [blk.path]: blk.code }, undefined, undefined, true);
    setActiveFile(blk.path);
    setRightTab('editor');
    setMobileTab('code');
    showToast(`${blk.path} aberto no Editor!`);
  };

  const handlePauseOrResumeMission = () => {
    setMission((prev) => {
      const nextPaused = !prev.paused;
      missionPausedRef.current = nextPaused;
      showToast(nextPaused ? 'Modo Automático pausado.' : 'Modo Automático retomado!');
      return { ...prev, paused: nextPaused };
    });
  };

  if (liveShareId) {
    return (
      <LiveShareViewerScreen
        shareId={liveShareId}
        onExit={() => {
          setLiveShareId(null);
          try {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.delete('live');
            window.history.replaceState({}, '', nextUrl.toString());
          } catch {
            // ignore
          }
        }}
      />
    );
  }

  if (!session) {
    return <LoginGateScreen onAuthenticated={handleAuthenticated} exitNotice={exitNotice} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0A0A0F] text-white overflow-hidden">
      {/* Barra Superior */}
      <TopBar
        session={session}
        guestSecondsLeft={guestSecondsLeft}
        unreadAlertsCount={unreadAlertsCount}
        workspaceMode={workspaceMode}
        projectName={currentProject.name}
        agentMode={agentMode}
        voiceEnabled={voiceEnabled}
        voiceLevel={voiceLevel}
        isListening={isListening}
        isSaraSpeaking={isSaraSpeaking}
        isSaraSilenced={isSaraSilenced}
        isCallMode={isCallMode}
        isThinking={isThinking || liveBuild.isBuilding}
        firebaseUser={firebaseUser}
        isSyncingFirebase={isSyncingFirebase}
        isJarvisPanelOpen={isJarvisPanelOpen}
        onToggleJarvisPanel={() => jarvisPanelRef.current?.(!isJarvisPanelOpen)}
        onChangeWorkspaceMode={handleChangeWorkspaceMode}
        onChangeAgentMode={(m) => handleSwitchMode(m)}
        onToggleVoice={handleToggleVoice}
        onCycleVoiceLevel={handleCycleVoiceLevel}
        onSilenceSara={handleSilenceSara}
        onToggleMic={handleToggleMic}
        onTogglePresentation={() => setIsPresentationMode((v) => !v)}
        onSaveProject={handleSaveProjectToFirebase}
        onOpenProjects={() => setShowProjectsModal(true)}
        onOpenSettings={() => session.isOwner && setShowSettingsModal(true)}
        onOpenDeploy={() => setShowDeployModal(true)}
        onOpenAdmin={() => session.isOwner && setShowAdminModal(true)}
        onLogout={() => void handleLogout('Sessão encerrada.')}
      />

      {/* Indicador discreto e profissional no canto quando silenciada ou em Modo Chamada */}
      {(isSaraSilenced || isCallMode) && (
        <div
          className={`fixed top-16 right-4 z-[74] flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-[0_6px_24px_rgba(0,0,0,0.45)] text-[11px] font-mono font-bold tracking-widest uppercase select-none ${
            isCallMode
              ? 'bg-[#170E04]/92 border-amber-400/50 text-amber-200'
              : 'bg-[#14070D]/92 border-rose-500/50 text-rose-200'
          }`}
          title='Diz "Sara, podes falar" ou "Sara, voltei" para reativar a voz'
        >
          {isCallMode ? (
            <PhoneOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-rose-300 shrink-0" />
          )}
          <span>{isCallMode ? 'MODO CHAMADA · SILENCIADA' : 'SILENCIADA'}</span>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-[#090D16] border border-cyan-400/50 text-xs font-medium text-cyan-200 shadow-2xl">
          {toastMsg}
        </div>
      )}

      {workspaceMode === 'jarvis' ? (
        <JarvisWorkspace
          key={session.sessionId}
          session={session}
          userIdentity={userIdentity}
          onUserActivity={markUserActivity}
          onRequestAdmin={() => session.isOwner && setShowAdminModal(true)}
          voiceEnabled={voiceEnabled}
          isListening={isListening}
          isSaraSpeaking={isSaraSpeaking}
          isSaraSilenced={isSaraSilenced}
          isCallMode={isCallMode}
          firebaseUserUid={effectiveStorageUid || undefined}
          activeBuilderProjectName={currentProject.name}
          activeBuilderFiles={Object.keys(currentProject.files || {})}
          liveBuild={liveBuild}
          completedBackgroundBuild={completedBackgroundBuild}
          onDismissCompletedBuild={() => setCompletedBackgroundBuild(null)}
          onTriggerBackgroundBuild={handleTriggerBackgroundBuild}
          externalNotifyChatRef={jarvisNotifyChatRef}
          onToggleMic={handleToggleMic}
          onSilenceSara={handleSilenceSara}
          onSwitchMode={handleChangeWorkspaceMode}
          onOpenSettings={() => session.isOwner && setShowSettingsModal(true)}
          onNotify={showToast}
          onExecuteSystemCommand={executePlatformCommand}
          onStageStateChange={handleJarvisStageStateChange}
          onPanelOpenChange={setIsJarvisPanelOpen}
          externalMediaControlRef={jarvisMediaControlRef}
          externalCommandRef={jarvisPromptRef}
          externalFocusCommandRef={jarvisFocusRef}
          externalModuleRef={jarvisModuleRef}
          externalPanelRef={jarvisPanelRef}
          externalRepeatRef={jarvisRepeatRef}
          externalContinueRef={jarvisContinueRef}
          activeBottomTab={activeBottomTab}
          profileSubTab={profileSubTab}
          onChangeBottomTab={handleChangeBottomTab}
          appearOnMap={appearOnMap}
          ghostMode={ghostMode}
          myCoords={myCoords}
          incomingPending={incomingPending}
          outgoingGrants={outgoingGrants}
          sharedPeers={sharedPeers}
          devices={devices}
          bgSettings={bgSettings}
          reminders={reminders}
          notificationPermission={notificationPermission}
          onToggleAppearOnMap={handleToggleAppearOnMap}
          onActivateGhostMode={handleActivateGhostMode}
          onStopSharingAll={handleStopSharingAll}
          onUpdateMyCoords={handleUpdateMyCoords}
          onUpdateBgSettings={handleUpdateBgSettings}
          onPermitBackground={handlePermitBackground}
          onStopBackground={handleStopBackground}
          onRefreshDeviceNow={handleRefreshDeviceNow}
          onDeleteReminder={handleDeleteReminder}
          onScheduleBackgroundReminder={handleScheduleBackgroundReminder}
          radarControlRef={radarControlRef}
        />
      ) : (
        <>
          {/* Abas em Telemóvel (< lg) */}
          <nav className="lg:hidden grid grid-cols-4 bg-[#12121A] border-b border-[#1F1F2E] shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab('chat')}
          className={`py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
            mobileTab === 'chat' ? 'border-[#3B82F6] text-white bg-[#0A0A0F]/50' : 'border-transparent text-[#A1A1AA]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
            mobileTab === 'preview' ? 'border-[#3B82F6] text-white bg-[#0A0A0F]/50' : 'border-transparent text-[#A1A1AA]'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Preview</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileTab('code');
            if (rightTab === 'console') setRightTab('editor');
          }}
          className={`py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
            mobileTab === 'code' ? 'border-[#8B5CF6] text-white bg-[#0A0A0F]/50' : 'border-transparent text-[#A1A1AA]'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Código</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileTab('console');
            setRightTab('console');
          }}
          className={`py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
            mobileTab === 'console' ? 'border-emerald-400 text-white bg-[#0A0A0F]/50' : 'border-transparent text-[#A1A1AA]'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Console</span>
        </button>
      </nav>

      {/* Workspace Principal: Desktop 35% / 40% / 25% */}
      <main className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[35fr_40fr_25fr] overflow-hidden">
        <div
          className={`h-full min-h-0 overflow-hidden ${
            mobileTab === 'chat' ? 'flex flex-col flex-1' : 'hidden lg:flex lg:flex-col'
          }`}
        >
          <SaraChatPanel
            messages={messages}
            agentMode={agentMode}
            isThinking={isThinking}
            isSaraSpeaking={isSaraSpeaking}
            isListening={isListening}
            isVoiceProcessing={isVoiceProcessing}
            pendingConfirmation={pendingConfirmation}
            liveBuild={liveBuild}
            mission={mission}
            callName={session.callName}
            isOwner={session.isOwner}
            manualProposal={manualProposal}
            hasResumableMission={Boolean(resumableMission)}
            resumableGoal={resumableMission?.goal}
            onResumeSavedMission={() => {
              if (resumableMission) {
                const saved = resumableMission;
                setResumableMission(null);
                runAutonomousMission(saved.goal, { resumedMission: saved, skipUserMsg: true });
              }
            }}
            onDiscardSavedMission={() => {
              setResumableMission(null);
              if (session && !session.isGuest) {
                localStorage.removeItem(scopedStorageKey(SAVED_MISSION_KEY, session.userId));
              }
            }}
            onConfirmPending={executeConfirmedAction}
            onCancelPending={cancelConfirmedAction}
            onToggleMic={handleToggleMic}
            onSendMessage={handleSendMessage}
            onImportZipAttachment={handleImportZipFromChat}
            onSelectProjectFile={handleSelectProjectFileFromChat}
            onApplyCodeBlockToPreview={handleApplyCodeBlockToPreview}
            onOpenCodeBlockInEditor={handleOpenCodeBlockInEditor}
            onAutoFixErrorMessage={(err) => handleSaraFixError(err)}
            onPauseOrResumeMission={handlePauseOrResumeMission}
            onSwitchBackToManual={() => handleSwitchMode('manual')}
            onShowMissionReport={() => {
              const rep = mission.report || lastCompletedReport;
              if (rep) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `sara_rep_btn_${Date.now()}`,
                    sender: 'sara',
                    text: formatMissionReportText(rep),
                    timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
                    mode: 'mission',
                  },
                ]);
              }
            }}
            onCopyAllCode={handleCopyAllCode}
            onClearChat={() => {
              stopSaraSpeech();
              setManualProposal(EMPTY_MANUAL_PROPOSAL);
              setMessages([]);
            }}
            onApplySuggestion={(sug) => handleSendMessage(`Aplica esta melhoria mantendo tudo funcional: ${sug}`)}
            onListenMessageDetail={handleListenMessageDetail}
            onSilenceSara={handleForceSilenceSara}
            onRegenerateGeneratedImage={(msgId, prompt) => {
              void runBuilderImageGeneration(prompt, {
                targetMessageId: msgId,
                variationSeed: Date.now(),
              });
            }}
            onUseGeneratedImageAsProfile={async (imgUrl) => {
              await saveUserProfilePhoto(session.userId, imgUrl);
              showToast('Foto de perfil atualizada!');
            }}
          />
        </div>

        <div
          className={`h-full min-h-0 overflow-hidden ${
            mobileTab === 'preview' ? 'flex flex-col flex-1' : 'hidden lg:flex lg:flex-col'
          }`}
        >
          <LivePreviewPanel
            files={currentProject.files}
            projectName={currentProject.name}
            device={previewDevice}
            refreshSeed={refreshSeed}
            isBuilding={liveBuild.isBuilding}
            activeBuildingFile={liveBuild.activeFile}
            elapsedSeconds={liveBuild.elapsedSeconds}
            builtFilesCount={liveBuild.createdFiles.length}
            isPresentationMode={isPresentationMode}
            isFullscreen={isPreviewFullscreen}
            onToggleFullscreen={() => setIsPreviewFullscreen((v) => !v)}
            onTogglePresentation={() => setIsPresentationMode((v) => !v)}
            iframeRef={iframeRef}
            onChangeDevice={setPreviewDevice}
            onRefresh={() => setRefreshSeed((s) => s + 1)}
            onDownloadZip={handleDownloadZip}
            onPushGitHub={() => setShowDeployModal(true)}
            onPublish={() => setShowDeployModal(true)}
          />
        </div>

        <div
          className={`h-full min-h-0 overflow-hidden ${
            mobileTab === 'code' || mobileTab === 'console'
              ? 'flex flex-col flex-1'
              : 'hidden lg:flex lg:flex-col'
          }`}
        >
          <EditorConsolePanel
            files={currentProject.files}
            activeFile={activeFile}
            activeTab={
              mobileTab === 'console'
                ? 'console'
                : mobileTab === 'code' && rightTab === 'console'
                ? 'editor'
                : rightTab
            }
            consoleLogs={consoleLogs}
            versions={currentProject.versions || []}
            errorsFixedCount={errorsFixedCount}
            isFullscreen={isEditorFullscreen}
            onToggleFullscreen={() => setIsEditorFullscreen((v) => !v)}
            onRestoreVersion={handleRestoreVersion}
            onSelectFile={setActiveFile}
            onSelectTab={setRightTab}
            onChangeFileContent={handleChangeFileContent}
            onCreateFile={handleCreateFile}
            onDeleteFile={handleDeleteFile}
            onUploadFilesToProject={handleUploadFilesToProject}
            onRunConsoleJs={handleRunConsoleJs}
            onClearConsole={() => setConsoleLogs([])}
            onSaraFixError={handleSaraFixError}
          />
        </div>
      </main>

      {/* Barra Discreta de Instalação PWA / App */}
      <PwaInstallBar onNotify={showToast} />
        </>
      )}

      {/* Modais */}
      <ProjectsModal
        isOpen={showProjectsModal}
        projects={projects}
        currentProjectId={currentProject.id}
        isSyncingFirebase={isSyncingFirebase}
        isOwner={session.isOwner}
        callName={session.callName}
        onClose={() => setShowProjectsModal(false)}
        onCreateNew={handleCreateNewProject}
        onOpenProject={(proj) => {
          void switchToProject(proj);
        }}
        onDuplicateProject={handleDuplicateProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
        onImportProject={handleImportProject}
        onSaveCurrentToFirebase={handleSaveProjectToFirebase}
        onLoadFromFirebase={handleLoadFromFirebase}
      />

      {session.isOwner && (
        <SettingsModal
          isOpen={showSettingsModal}
          firebaseUser={firebaseUser}
          onClose={() => setShowSettingsModal(false)}
          onNotify={(msg) => {
            addConsoleLog('info', msg);
            showToast(msg);
          }}
        />
      )}

      {session.isOwner && showAdminModal && (
        <AdminPanelModal
          session={session}
          onClose={() => setShowAdminModal(false)}
          onAlertsUpdated={() => setUnreadAlertsCount(getUnreadAlertsLocal(session).length)}
        />
      )}

      <DeployModal
        isOpen={showDeployModal}
        projectName={currentProject.name}
        files={currentProject.files}
        isOwner={session.isOwner}
        onClose={() => setShowDeployModal(false)}
        onOpenSettings={() => session.isOwner && setShowSettingsModal(true)}
        onNotify={(msg) => {
          addConsoleLog('success', msg);
          showToast(msg);
        }}
      />

      {/* HUD Global de Voz Contínua (sempre acessível em todas as abas, modais e ecrãs cheios) */}
      {(isListening ||
        isSaraSpeaking ||
        isVoiceProcessing ||
        showProjectsModal ||
        showSettingsModal ||
        showDeployModal ||
        isEditorFullscreen ||
        isPreviewFullscreen ||
        isPresentationMode ||
        mobileTab !== 'chat') && (
        <div className="fixed bottom-4 left-4 z-[75] flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#090D16]/95 border border-cyan-500/40 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.65)]">
          <button
            type="button"
            onClick={handleToggleMic}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              isListening
                ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-200'
                : 'bg-[#12121A] border border-[#1F1F2E] text-[#A1A1AA] hover:text-white'
            }`}
            title={isListening ? 'Desligar escuta contínua' : 'Ligar escuta contínua'}
          >
            {isListening ? (
              <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            ) : (
              <MicOff className="w-3.5 h-3.5" />
            )}
            <span>
              {isSaraSpeaking
                ? 'Sara a falar...'
                : isVoiceProcessing
                ? 'A executar...'
                : isListening
                ? 'Sara a ouvir'
                : 'Ligar voz'}
            </span>
          </button>

          {isVoiceProcessing && <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}

          {isSaraSpeaking && (
            <>
              <button
                type="button"
                onClick={() => {
                  interruptSaraAndListen();
                  if (!shouldKeepListeningRef.current) startHandsFreeMic();
                  showToast('Podes falar agora.');
                }}
                className="px-2 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer hover:bg-cyan-500/30 transition"
                title="Interromper Sara e falar imediatamente"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Interromper</span>
              </button>
              <button
                type="button"
                onClick={handleForceSilenceSara}
                className="px-2 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer hover:bg-rose-500/30 transition"
                title="Calar Sara agora"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>Calar</span>
              </button>
            </>
          )}
        </div>
      )}
      {/* Barra Flutuante Global de Leitura em Voz Alta (funciona em todas as abas e modos) */}
      {readingStatus.active && (
        <div className="fixed bottom-4 right-4 z-[76] flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#071124]/95 border border-cyan-400/55 backdrop-blur-md shadow-[0_8px_32px_rgba(0,229,255,0.28)] max-w-[340px]">
          <BookOpen className="w-4 h-4 text-cyan-300 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-white truncate">{readingStatus.title}</div>
            <div className="text-[10px] font-mono text-cyan-300">
              {readingStatus.paused ? 'Pausado' : 'A ler'} • Frase {Math.min(readingStatus.currentIndex + 1, Math.max(1, readingStatus.totalChunks))}/{Math.max(1, readingStatus.totalChunks)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => (readingStatus.paused ? resumeVoiceReading() : pauseVoiceReading())}
            className="p-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 hover:bg-cyan-500/30 cursor-pointer"
            title={readingStatus.paused ? 'Continuar leitura' : 'Pausar leitura'}
          >
            {readingStatus.paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => stopVoiceReading()}
            className="p-1.5 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-200 hover:bg-rose-500/30 cursor-pointer"
            title="Parar leitura"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        </div>
      )}

      {/* Notificação em tempo real de Pedido de Localização recebido */}
      {session && !session.isGuest && incomingPending.length > 0 && activeBottomTab !== 'mapa' && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[78] w-[94vw] max-w-md p-3 rounded-2xl bg-[#071126]/95 border border-cyan-400/60 shadow-[0_12px_36px_rgba(0,0,0,0.75)] backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-200">
              <MapPin className="w-4 h-4 text-[#00E5FF]" />
              <span>
                {incomingPending[0].fromCallName} ({incomingPending[0].fromSaraId}) pediu a tua localização
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={async () => {
                await respondToLocationRequest(incomingPending[0], '30m');
                const coords = await requestCurrentCoordinates();
                if (coords) handleUpdateMyCoords(coords);
                await publishCurrentRadarPresence({
                  session,
                  visible: true,
                  ghostMode: false,
                  coords: coords || myCoords,
                });
                showToast('Localização partilhada por 30 minutos.');
              }}
              className="py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/60 text-emerald-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Aceitar 30min</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await respondToLocationRequest(incomingPending[0], '1h');
                const coords = await requestCurrentCoordinates();
                if (coords) handleUpdateMyCoords(coords);
                await publishCurrentRadarPresence({
                  session,
                  visible: true,
                  ghostMode: false,
                  coords: coords || myCoords,
                });
                showToast('Localização partilhada por 1 hora.');
              }}
              className="py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Aceitar 1h</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await respondToLocationRequest(incomingPending[0], 'decline');
                showToast('Pedido recusado.');
              }}
              className="py-1.5 rounded-xl bg-rose-500/20 border border-rose-400/60 text-rose-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Recusar</span>
            </button>
          </div>
        </div>
      )}

      {/* Banner de SMS de Socorro (1h offline) */}
      {sosSmsBanner && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[79] w-[94vw] max-w-md p-3.5 rounded-2xl bg-[#1A080E]/95 border border-rose-400 shadow-2xl space-y-2">
          <div className="flex items-start gap-2.5">
            <MessageSquareWarning className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-100">
              <div className="font-bold">SMS de Socorro pronto ({sosSmsBanner.phone})</div>
              <div className="text-[11px] text-rose-200/80 mt-0.5">
                Um aparelho ficou offline há mais de 1 hora. Envia a última posição conhecida agora.
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setSosSmsBanner(null)}
              className="px-3 py-1.5 rounded-lg border border-slate-600 text-xs text-slate-300 cursor-pointer"
            >
              Fechar
            </button>
            <a
              href={sosSmsBanner.uri}
              onClick={() => setSosSmsBanner(null)}
              className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Enviar SMS de Socorro</span>
            </a>
          </div>
        </div>
      )}

      {/* Alarme Remoto Achar Meu Celular Ativo */}
      {activeAlarmRinging && (
        <div className="fixed inset-x-4 top-20 z-[85] max-w-md mx-auto p-4 rounded-2xl bg-rose-600 border-2 border-white text-white shadow-[0_0_50px_rgba(244,63,94,0.85)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Volume2 className="w-6 h-6 animate-bounce shrink-0" />
            <div>
              <div className="text-sm font-black uppercase tracking-wider">Alarme Achar Meu Celular</div>
              <div className="text-xs text-rose-100">Acionado remotamente pela tua conta SARA.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopLoudDeviceAlarmLoop();
              setActiveAlarmRinging(false);
            }}
            className="px-3 py-2 rounded-xl bg-white text-rose-700 font-black text-xs shrink-0 cursor-pointer"
          >
            Silenciar
          </button>
        </div>
      )}

      {/* Ecrã de Bloqueio Perdido ("Bloquear com Mensagem") */}
      {deviceLockState?.locked && (
        <div className="fixed inset-0 z-[95] bg-[#02050D] flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#071124] border border-rose-500/60 shadow-[0_0_50px_rgba(244,63,94,0.3)] space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 border border-rose-400/60 flex items-center justify-center">
              <Lock className="w-7 h-7 text-rose-300" />
            </div>
            <h2 className="text-lg font-extrabold text-white">Aparelho Bloqueado · SARA</h2>
            <p className="text-sm text-rose-100 leading-relaxed bg-[#040916] border border-rose-500/25 rounded-2xl p-4">
              {deviceLockState.message}
            </p>
            {deviceLockState.contactPhone && (
              <div className="text-xs font-mono text-cyan-300">
                Contacto para devolução: <span className="font-bold text-white">{deviceLockState.contactPhone}</span>
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setUnlockError('');
                if (!session) return;
                const ok = await verifySessionAccountPassword(session, unlockPasswordInput);
                if (!ok && !session.isGuest) {
                  setUnlockError('Palavra-passe incorreta.');
                  return;
                }
                setSavedDeviceLockState(null);
                setDeviceLockState(null);
                setUnlockPasswordInput('');
                showToast('Aparelho desbloqueado.');
              }}
              className="space-y-2 pt-2 text-left"
            >
              <label className="text-[11px] font-mono uppercase text-slate-400 block">
                Palavra-passe da conta para desbloquear
              </label>
              <input
                type="password"
                value={unlockPasswordInput}
                onChange={(e) => setUnlockPasswordInput(e.target.value)}
                placeholder="Insere a palavra-passe..."
                className="w-full px-3 py-2.5 rounded-xl bg-[#040916] border border-cyan-500/30 text-sm text-white focus:outline-none focus:border-cyan-400"
              />
              {unlockError && <p className="text-xs text-rose-300">{unlockError}</p>}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-cyan-500/25 border border-cyan-400/60 text-cyan-100 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                <span>Desbloquear Aparelho</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bolha Flutuante Mobile / Mini-Janela Compacta PC (CTRL+ESPAÇO) */}
      <FloatingSaraBubble
        visible={Boolean(
          session &&
            !session.isGuest &&
            bgSettings.backgroundAllowed &&
            !bubbleDismissed &&
            (bgSettings.floatingBubbleEnabled || (bgSettings.pcMiniWindowEnabled && isPageHidden))
        )}
        isPc={typeof window !== 'undefined' && window.innerWidth >= 1024}
        isListening={isListening}
        isSaraSpeaking={isSaraSpeaking}
        backgroundActive={bgSettings.backgroundAllowed}
        latestReply={
          [...messages].reverse().find((m) => m.sender === 'sara')?.text || ''
        }
        onToggleMic={handleToggleMic}
        onSilenceSara={handleForceSilenceSara}
        onSendPrompt={(text) => {
          if (workspaceModeRef.current === 'jarvis' && jarvisPromptRef.current) {
            void jarvisPromptRef.current(text, 'text');
          } else {
            void handleSendMessageRef.current?.(text, undefined, undefined, 'text');
          }
        }}
        onStopBackground={() => void handleStopBackground()}
        onDismissBubble={() => setBubbleDismissed(true)}
        onRestoreFullWindow={() => {
          setWorkspaceMode('jarvis');
          setActiveBottomTab('assistente');
          window.focus?.();
        }}
      />
    </div>
  );
}
