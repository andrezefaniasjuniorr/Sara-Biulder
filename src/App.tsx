import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Eye, Code2, Terminal, Mic, MicOff, VolumeX, Loader2 } from 'lucide-react';
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
import { buildStandaloneHtml, downloadProjectZip, importProjectZip } from './utils/zipService';
import { getSavedGitHubToken, pushProjectToGitHub } from './utils/githubService';
import {
  adjustVoiceSpeed,
  detectAmbiguousOrDangerousPrompt,
  getManualStepApprovalSpeech,
  getModeSwitchSpeech,
  getPlatformCommandSpeech,
  getSpokenBuildRecap,
  normalizePhoneticVoiceTranscript,
  parseVoiceCommand,
  playCompletionChime,
  setSaraSilenced,
  setSpeakingStateListener,
  speakAsSara,
  speakAsSaraAndWait,
  startContinuousVoiceRecognition,
  stopSaraSpeech,
  type VoiceCommandAction,
  type VoiceParseContext,
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

const PROJECTS_STORAGE_KEY = 'sara_biulder_projects_v2';
const ACTIVE_PROJECT_KEY = 'sara_biulder_active_id_v2';
const CHAT_STORAGE_KEY = 'sara_biulder_chat_v2';
const CHAT_MAP_STORAGE_KEY = 'sara_biulder_chat_map_v1';
const AGENT_MODE_KEY = 'sara_biulder_agent_mode_v1';
const SAVED_MISSION_KEY = 'sara_biulder_saved_mission_v2';
const ERRORS_FIXED_KEY = 'sara_biulder_errors_fixed_v1';
const VOICE_LEVEL_KEY = 'sara_biulder_voice_level_v1';

function loadCachedProjectChat(projectId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_MAP_STORAGE_KEY);
    if (raw) {
      const map = JSON.parse(raw) as Record<string, ChatMessage[]>;
      if (Array.isArray(map?.[projectId])) return map[projectId];
    }
  } catch {
    // ignore
  }
  return [];
}

function loadInitialVoiceLevel(): VoiceLevel {
  try {
    const saved = localStorage.getItem(VOICE_LEVEL_KEY);
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

function loadInitialProjects(): ProjectRecord[] {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return [createStarterProject()];
}

function loadInitialChat(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
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

function loadInitialAgentMode(): AgentMode {
  try {
    const saved = localStorage.getItem(AGENT_MODE_KEY);
    if (saved === 'automatic' || saved === 'manual') return saved;
  } catch {
    // fallback
  }
  return 'manual';
}

function loadResumableMission(): MissionState | null {
  try {
    const raw = localStorage.getItem(SAVED_MISSION_KEY);
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

export default function App() {
  const [projects, setProjects] = useState<ProjectRecord[]>(loadInitialProjects);
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(ACTIVE_PROJECT_KEY);
      const list = loadInitialProjects();
      if (savedId && list.some((p) => p.id === savedId)) return savedId;
      return list[0].id;
    } catch {
      return loadInitialProjects()[0].id;
    }
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

  const [agentMode, setAgentMode] = useState<AgentMode>(loadInitialAgentMode);
  const [messages, setMessages] = useState<ChatMessage[]>(loadInitialChat);
  const [isThinking, setIsThinking] = useState(false);

  const [liveBuild, setLiveBuild] = useState<LiveBuildInfo>({
    isBuilding: false,
    phase: 'idle',
    elapsedSeconds: 0,
    steps: [],
    createdFiles: [],
  });

  const [activeFile, setActiveFile] = useState<FileKey>('index.html');
  const [rightTab, setRightTab] = useState<RightPanelTab>('editor');
  const [mobileTab, setMobileTab] = useState<MobilePanelTab>('chat');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
  const [refreshSeed, setRefreshSeed] = useState(1);

  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  const [errorsFixedCount, setErrorsFixedCount] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(ERRORS_FIXED_KEY) || '0') || 0;
    } catch {
      return 0;
    }
  });

  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([
    {
      id: 'init_log',
      level: 'success',
      message: 'SARA BIULDER pronta. Modo Manual / Automático e voz contínua ativos.',
      timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceLevel, setVoiceLevel] = useState<VoiceLevel>(loadInitialVoiceLevel);
  const [isSaraSilenced, setIsSaraSilencedState] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [isSaraSpeaking, setIsSaraSpeaking] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingVoiceConfirmation | null>(null);
  const shouldKeepListeningRef = useRef(false);
  const stopMicRef = useRef<(() => void) | null>(null);

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
  const [resumableMission, setResumableMission] = useState<MissionState | null>(loadResumableMission);
  const [lastCompletedReport, setLastCompletedReport] = useState<MissionReport | null>(null);
  const [manualProposal, setManualProposal] = useState<ManualProposalState>(EMPTY_MANUAL_PROPOSAL);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const latestErrorsRef = useRef<string[]>([]);
  const voiceEnabledRef = useRef(voiceEnabled);
  const voiceLevelRef = useRef(voiceLevel);
  const agentModeRef = useRef(agentMode);
  const missionAbortRef = useRef(false);
  const missionPausedRef = useRef(false);
  const pendingConfirmationRef = useRef<PendingVoiceConfirmation | null>(null);
  const voiceContextRef = useRef<VoiceParseContext>({});

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    voiceLevelRef.current = voiceLevel;
    try {
      localStorage.setItem(VOICE_LEVEL_KEY, voiceLevel);
    } catch {
      // ignore
    }
  }, [voiceLevel]);

  useEffect(() => {
    agentModeRef.current = agentMode;
    try {
      localStorage.setItem(AGENT_MODE_KEY, agentMode);
    } catch {
      // ignore
    }
  }, [agentMode]);

  useEffect(() => {
    pendingConfirmationRef.current = pendingConfirmation;
    voiceContextRef.current = {
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
    };
  }, [
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
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(ERRORS_FIXED_KEY, String(errorsFixedCount));
    } catch {
      // ignore
    }
  }, [errorsFixedCount]);

  useEffect(() => {
    setSpeakingStateListener((speaking) => setIsSaraSpeaking(speaking));
    return () => setSpeakingStateListener(null);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

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

  // Persiste missão ativa/pausada para "Continuar Depois"
  useEffect(() => {
    try {
      if (mission.active && mission.tasks.length > 0 && !mission.finished) {
        localStorage.setItem(SAVED_MISSION_KEY, JSON.stringify(mission));
      } else if (mission.finished) {
        localStorage.removeItem(SAVED_MISSION_KEY);
      }
    } catch {
      // ignore
    }
  }, [mission]);

  useEffect(() => {
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
      localStorage.setItem(ACTIVE_PROJECT_KEY, currentProjectId);
    } catch {
      // ignore quota
    }
  }, [projects, currentProjectId]);

  // Mantém sara_estado_projeto sempre atualizado com o projeto ativo
  useEffect(() => {
    if (currentProject) {
      updateProjectStateFromRecord(currentProject);
    }
  }, [currentProject]);

  useEffect(() => {
    try {
      const trimmedMsgs = messages.slice(-50);
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmedMsgs));
      const mapRaw = localStorage.getItem(CHAT_MAP_STORAGE_KEY);
      const map: Record<string, ChatMessage[]> = mapRaw ? JSON.parse(mapRaw) : {};
      map[currentProjectId] = trimmedMsgs;
      localStorage.setItem(CHAT_MAP_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  }, [messages, currentProjectId]);

  useEffect(() => {
    const unsub = verificarUsuario((user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // Hidratação automática do Firebase (projetos, estados, preferências e histórico de chat)
  useEffect(() => {
    if (!authReady) return;
    const effectiveUid = firebaseUser?.uid || 'eletro-jr-local';
    if (hydratedUidRef.current === effectiveUid) return;
    hydratedUidRef.current = effectiveUid;

    let cancelled = false;
    (async () => {
      setIsSyncingFirebase(true);
      try {
        const [projRes, stateRes, prefsRes] = await Promise.allSettled([
          buscarProjetosNoFirebase(firebaseUser?.uid),
          buscarEstadosProjetosFirebase(firebaseUser?.uid),
          buscarPreferenciasUsuarioFirebase(firebaseUser?.uid),
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
          mergeProjectStatesMap(remoteStates, resolvedTargetId);
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

        const remoteMsgs = await buscarMensagensChatFirebase(resolvedTargetId, firebaseUser?.uid);
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
  }, [authReady, firebaseUser?.uid]);

  // Auto-save contínuo e silencioso do projeto ativo + memória para o Firebase (sara-biulder)
  useEffect(() => {
    if (!authReady || !currentProject || liveBuild.isBuilding) return;
    if (isProjectBlank(currentProject.files) && currentProject.name === 'Novo Projeto') return;
    if (syncedUpdatedAtRef.current[currentProject.id] === currentProject.updatedAt) return;

    const timer = setTimeout(async () => {
      try {
        setIsSyncingFirebase(true);
        syncedUpdatedAtRef.current[currentProject.id] = currentProject.updatedAt;
        await salvarProjetoNoFirebase(currentProject, firebaseUser?.uid);
        const state = updateProjectStateFromRecord(currentProject);
        await salvarEstadoProjetoFirebase(state, firebaseUser?.uid);
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
  }, [
    authReady,
    currentProject,
    liveBuild.isBuilding,
    firebaseUser?.uid,
  ]);

  // Auto-save das preferências do utilizador no Firebase
  useEffect(() => {
    if (!authReady) return;
    const timer = setTimeout(() => {
      salvarPreferenciasUsuarioFirebase(
        {
          activeProjectId: currentProjectId,
          agentMode,
          voiceLevel,
          errorsFixedCount,
        },
        firebaseUser?.uid
      ).catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [authReady, currentProjectId, agentMode, voiceLevel, errorsFixedCount, firebaseUser?.uid]);

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
    setIsSyncingFirebase(true);
    try {
      await salvarProjetoNoFirebase(currentProject, firebaseUser?.uid);
      setProjects((prev) =>
        prev.map((p) => (p.id === currentProject.id ? { ...p, syncedToFirebase: true } : p))
      );
      addConsoleLog('success', `Projeto "${currentProject.name}" guardado no Firebase (sara_projetos).`);
      showToast('Projeto guardado localmente e no Firebase!');
    } catch (err: any) {
      addConsoleLog(
        'warn',
        `Guardado no navegador. Firebase: ${err?.message || 'faz login em Configurações para gravar na nuvem.'}`
      );
      showToast('Projeto guardado localmente!');
    } finally {
      setIsSyncingFirebase(false);
    }
  }, [currentProject, firebaseUser?.uid, addConsoleLog, showToast]);

  const handleLoadFromFirebase = useCallback(async () => {
    setIsSyncingFirebase(true);
    try {
      const remoteProjects = await buscarProjetosNoFirebase(firebaseUser?.uid);
      if (remoteProjects.length > 0) {
        setProjects((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          remoteProjects.forEach((rp) => map.set(rp.id, rp));
          return Array.from(map.values());
        });
        addConsoleLog('success', `${remoteProjects.length} projeto(s) sincronizado(s) de sara_projetos.`);
        showToast(`${remoteProjects.length} projeto(s) sincronizado(s)!`);
      } else {
        addConsoleLog('info', 'Nenhum projeto encontrado em sara_projetos para esta conta.');
      }
    } catch (err: any) {
      addConsoleLog('warn', `Sincronização Firebase: ${err?.message || 'verifica autenticação.'}`);
    } finally {
      setIsSyncingFirebase(false);
    }
  }, [firebaseUser?.uid, addConsoleLog, showToast]);

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
      updateProjectStateFromRecord(target);

      const localChat = loadCachedProjectChat(target.id);
      setMessages(localChat);

      const remoteMsgs = await buscarMensagensChatFirebase(target.id, firebaseUser?.uid).catch(
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
    [firebaseUser?.uid]
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
      const state = updateProjectStateFromRecord(newProj);
      salvarProjetoNoFirebase(newProj, firebaseUser?.uid).catch(() => {});
      salvarEstadoProjetoFirebase(state, firebaseUser?.uid).catch(() => {});
    },
    [addConsoleLog, firebaseUser?.uid]
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
      const state = updateProjectStateFromRecord(copy);
      salvarProjetoNoFirebase(copy, firebaseUser?.uid).catch(() => {});
      salvarEstadoProjetoFirebase(state, firebaseUser?.uid).catch(() => {});
    },
    [firebaseUser?.uid]
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
      apagarProjetoNoFirebase(id).catch(() => {});
    },
    [currentProjectId]
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
        stopSaraSpeech();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSaveProjectToFirebase]);

  const formatMissionReportText = (rep: MissionReport): string => {
    const mins = Math.floor(rep.elapsedSeconds / 60);
    const secs = rep.elapsedSeconds % 60;
    const header = rep.sleptOvernight
      ? `Eletro-Jr, terminei enquanto descansavas! Aqui está o teu sistema **${rep.projectName}** pronto:`
      : `Eletro-Jr, concluí a missão autónoma do projeto **${rep.projectName}**:`;

    return [
      header,
      `- **Etapas concluídas:** ${rep.completedCount} de ${rep.totalCount}`,
      `- **Tempo total:** ${mins}m ${secs}s`,
      `- **Erros corrigidos automaticamente:** ${rep.errorsFixed} (erros finais: ${rep.remainingErrors})`,
      `- **Preview:** Pronto e testado para PC e Telemóvel`,
      `- **GitHub:** ${rep.githubUrl ? `Push feito para ${rep.githubUrl}` : 'Não enviado (configura o GitHub Token em Configurações; o ZIP está pronto para descarregar)'}`,
      `- **Firebase:** ${rep.firebaseSynced ? 'Guardado em sara_projetos' : 'Guardado localmente no navegador'}`,
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
      }
    ) => {
      const cleanGoal =
        goalText.replace(/^(sara,?\s*faz sozinha:?|miss[aã]o:?)\s*/i, '').trim() || goalText;

      missionAbortRef.current = false;
      missionPausedRef.current = false;
      setAgentMode('automatic');
      setManualProposal(EMPTY_MANUAL_PROPOSAL);

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
          await speakAsSaraAndWait(
            `Vou retomar agora a construção de ${currentProject.name} exatamente de onde parámos, Eletro-Júnior.`,
            voiceEnabledRef.current,
            { level: 'short', forceSpeak: true }
          );
        } else {
          const activeState = loadActiveProjectState(currentProject.id);
          const kickoffPromise = fetchSaraFastKickoff({
            prompt: cleanGoal,
            files: currentProject.files,
            agentMode: 'automatic',
            hasExistingCode: hasExistingAtStart,
            projectName: currentProject.name,
            contextCue: options?.contextCue,
          });
          const planPromise = planAutonomousMission(
            cleanGoal,
            currentProject.files,
            'automatic',
            getRequestedPastProjects(cleanGoal),
            activeState
          );

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
          salvarMensagemChatFirebase(kickoffChatMsg, currentProject.id, firebaseUser?.uid);

          const [plan] = await Promise.all([
            planPromise,
            speakAsSaraAndWait(kickoffRes.reply, voiceEnabledRef.current, {
              level: 'medium',
              forceSpeak: true,
            }),
          ]);

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

          updateProjectStateFromRecord(currentProject, {
            goal: cleanGoal,
            lastStepDone: 'Planeamento de arquitetura definido',
            nextStep: plannedTasks[0]?.title || 'Executar Etapa 1',
            missingFeatures: plannedTasks.map((t) => t.title),
          });

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
              projectState: loadActiveProjectState(currentProject.id),
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
              if (attempts === 1) {
                speakAsSara(
                  'Eletro-Jr, encontrei 1 erro, já estou a corrigir.',
                  voiceEnabledRef.current,
                  { level: 'short' }
                );
              }
            }
          }

          if (!taskSucceeded) {
            totalErrorsRemaining += 1;
          } else if (i === 0 && plannedTasks.length > 1) {
            speakAsSara('Primeira parte pronta, Eletro-Jr.', voiceEnabledRef.current, {
              level: 'short',
            });
          }

          const remainingTitles = plannedTasks.slice(i + 1).map((t) => t.title);
          updateProjectStateFromRecord(
            { ...currentProject, name: resolvedName, type: resolvedType, files: workingFiles },
            {
              goal: cleanGoal,
              lastStepDone: `Etapa ${i + 1}/${plannedTasks.length}: ${task.title}`,
              nextStep: remainingTitles[0] || 'Teste final e publicação',
              missingFeatures: remainingTitles,
            }
          );

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

        // 5. PUSH PARA O GITHUB (respeita autorização explícita do Eletro-Jr)
        let githubUrl: string | undefined;
        const ghToken = getSavedGitHubToken();
        const pushAuthorizedInGoal = /\b(push|github|publica|publicar|envia\s+para\s+o\s+git)\b/i.test(cleanGoal);
        if (ghToken && pushAuthorizedInGoal) {
          try {
            setLiveBuild((prev) => ({
              ...prev,
              currentStepLabel: 'A fazer Push autorizado para o GitHub...',
            }));
            const ghRes = await pushProjectToGitHub({
              projectName: resolvedName,
              files: workingFiles,
            });
            githubUrl = ghRes.repoUrl;
            addConsoleLog('success', `[GitHub Auto-Push] Enviado para ${githubUrl}`);
          } catch (ghErr: any) {
            missionNotes.push(`Push GitHub falhou: ${ghErr?.message || 'verifica o token'}`);
          }
        } else if (ghToken) {
          missionNotes.push('Push GitHub aguardando confirmação explícita do Eletro-Jr.');
          setPendingConfirmation({
            id: `conf_push_${Date.now()}`,
            title: 'Autorizar Push para o GitHub',
            question: `O projeto "${resolvedName}" está pronto e testado. Queres autorizar o push para o GitHub agora?`,
            action: { type: 'push_github' },
          });
        } else {
          missionNotes.push('GitHub Token não configurado — o pacote ZIP está pronto para baixar.');
        }

        // 6. SALVA NO FIREBASE (sara_projetos)
        let firebaseSynced = false;
        try {
          const updatedProj: ProjectRecord = {
            ...currentProject,
            name: resolvedName,
            type: resolvedType,
            files: workingFiles,
            updatedAt: new Date().toISOString(),
          };
          await salvarProjetoNoFirebase(updatedProj, firebaseUser?.uid);
          firebaseSynced = true;
          addConsoleLog('success', '[Firebase] Projeto guardado automaticamente em sara_projetos.');
        } catch {
          // fica salvo no navegador
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
        localStorage.removeItem(SAVED_MISSION_KEY);

        updateProjectStateFromRecord(
          { ...currentProject, name: resolvedName, type: resolvedType, files: workingFiles },
          {
            goal: cleanGoal,
            lastStepDone: `Missão concluída (${plannedTasks.length} etapas)`,
            nextStep: 'Pronto para continuar com novas funcionalidades a pedido do Eletro-Jr',
            missingFeatures: [],
          }
        );

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
        salvarMensagemChatFirebase(reportChatMsg, currentProject.id, firebaseUser?.uid);

        if (Object.keys(workingFiles).length >= 4) {
          setRightTab('files');
        }

        playCompletionChime();
        speakAsSara(
          finalReport.sleptOvernight
            ? `Eletro-Jr, terminei enquanto dormias! O projeto ${resolvedName} já está pronto.`
            : errorsFixed > 0
            ? `Tudo fechado, Eletro-Jr! Concluí ${plannedTasks.length} etapas e corrigi ${errorsFixed} erros.`
            : `Tudo pronto no ${resolvedName}, Eletro-Jr, e já está testado.`,
          voiceEnabledRef.current,
          { level: 'short' }
        );
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
          'Estou a reajustar a rota dos motores para continuar a construção, Eletro-Júnior. Podes continuar comigo aqui.',
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
      firebaseUser?.uid,
      replaceCurrentProjectFiles,
      addConsoleLog,
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

      const nowTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      if (source !== 'voice' && !skipUserMsg) {
        const manUsrMsg: ChatMessage = {
          id: `usr_${Date.now()}`,
          sender: 'user',
          text: userText,
          timestamp: nowTime,
        };
        setMessages((prev) => [...prev, manUsrMsg]);
        salvarMensagemChatFirebase(manUsrMsg, currentProject.id, firebaseUser?.uid);
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
          getManualStepApprovalSpeech(step.title),
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
            projectState: loadActiveProjectState(currentProject.id),
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
            projectState: loadActiveProjectState(currentProject.id),
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

        const nextState = updateProjectStateFromRecord(
          { ...currentProject, files: updatedFiles },
          {
            goal: proposal.goal,
            lastStepDone: `Etapa ${idx + 1}/${proposal.totalEstimatedSteps}: ${step.title}`,
            nextStep: nextTask?.title || 'Sistema concluído',
            missingFeatures: remainingManualTitles,
          }
        );
        salvarEstadoProjetoFirebase(nextState, firebaseUser?.uid);

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
        salvarMensagemChatFirebase(manSaraMsg, currentProject.id, firebaseUser?.uid);

        const manualSpokenRecap = hasNext
          ? `${idx === 0 ? 'Primeira parte pronta' : 'Etapa concluída'}, Eletro-Júnior. ${res.voiceSummary || ''} Queres ajustar alguma coisa aqui ou posso avançar para ${nextTask!.title}?`
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
          'Tive de trocar de motor agora, Eletro-Júnior — pede para avançar outra vez que já sigo com a etapa.',
          voiceEnabledRef.current,
          { level: 'short', forceSpeak: true }
        );
      }
    },
    [currentProject.files, consoleLogs, messages, replaceCurrentProjectFiles]
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
    setIsSaraSilencedState((prev) => {
      const next = !prev;
      setSaraSilenced(next);
      if (next) {
        stopSaraSpeech();
        showToast('Sara calada até chamares');
      } else {
        showToast('Voz da Sara reativada');
      }
      return next;
    });
  }, [showToast]);

  const handleForceSilenceSara = useCallback(() => {
    setSaraSilenced(true);
    setIsSaraSilencedState(true);
    stopSaraSpeech();
    showToast('Sara calada até chamares');
  }, [showToast]);

  const handleListenMessageDetail = useCallback((msgText: string) => {
    setSaraSilenced(false);
    setIsSaraSilencedState(false);
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
      const ghToken = getSavedGitHubToken();
      if (!ghToken) {
        setShowDeployModal(true);
        showToast('Configura o GitHub Token primeiro');
        speakAsSara('Eletro-Jr, configura o teu GitHub Token primeiro.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return;
      }
      try {
        showToast('A enviar para o GitHub...');
        const res = await pushProjectToGitHub({
          projectName: currentProject.name,
          files: currentProject.files,
        });
        addConsoleLog('success', `[GitHub Push] Enviado para ${res.repoUrl}`);
        showToast(`Push concluído: ${res.repoUrl}`);
        speakAsSara('Push para o GitHub concluído, Eletro-Júnior.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
      } catch (err: any) {
        const msg = err?.message || 'Erro no push para o GitHub.';
        addConsoleLog('error', msg);
        showToast(msg);
        speakAsSara('Deu um erro no push para o GitHub, Eletro-Júnior.', voiceEnabledRef.current, {
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
      speakAsSara('Chat limpo, Eletro-Júnior.', voiceEnabledRef.current, {
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
  }, [currentProject.name, currentProject.files, addConsoleLog, showToast]);

  const cancelConfirmedAction = useCallback(() => {
    if (!pendingConfirmationRef.current) return;
    setPendingConfirmation(null);
    showToast('Ação cancelada');
    speakAsSara('Entendido, cancelei essa ação, Eletro-Júnior.', voiceEnabledRef.current, {
      level: 'short',
      forceSpeak: true,
    });
  }, [showToast]);

  // Controlo total da plataforma por Voz ou Chat
  const executePlatformCommand = useCallback(
    async (cmd: VoiceCommandAction, rawText: string): Promise<boolean> => {
      // 1. Calar Sara imediatamente
      if (cmd.type === 'silence_sara') {
        handleForceSilenceSara();
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

      // Reativa voz automaticamente quando Eletro-Jr chama a Sara
      if (/^sara\b/i.test(rawText.trim())) {
        setSaraSilenced(false);
        setIsSaraSilencedState(false);
      }

      // 2. Velocidade da voz
      if (cmd.type === 'voice_speed') {
        setSaraSilenced(false);
        setIsSaraSilencedState(false);
        const newRate = adjustVoiceSpeed(cmd.direction);
        const msg =
          cmd.direction === 'faster'
            ? `Vou falar mais rápido, Eletro-Jr (${newRate}x).`
            : cmd.direction === 'slower'
            ? `Vou falar mais devagar, Eletro-Jr (${newRate}x).`
            : 'Voltei à velocidade normal, Eletro-Jr.';
        showToast(msg);
        speakAsSara(msg, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      // 3. Nível de voz
      if (cmd.type === 'voice_level') {
        setSaraSilenced(false);
        setIsSaraSilencedState(false);
        setVoiceLevel(cmd.level);
        const confirmMsg =
          cmd.level === 'full'
            ? 'Modo completo ativo, Eletro-Jr.'
            : cmd.level === 'medium'
            ? 'Modo médio ativo, Eletro-Jr.'
            : 'Modo curto ativo, Eletro-Jr.';
        showToast(confirmMsg);
        speakAsSara(confirmMsg, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      // 4. Conversa rápida em 2.º plano (apenas voz, ZERO balão de texto no chat)
      if (cmd.type === 'background_smalltalk') {
        setSaraSilenced(false);
        setIsSaraSilencedState(false);
        speakAsSara(cmd.reply, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      // 5. Troca instantânea de modo (Manual <-> Automático) e controlo da missão
      if (cmd.type === 'pause_mission') {
        if (mission.active && !mission.paused) {
          missionPausedRef.current = true;
          setMission((prev) => ({ ...prev, paused: true }));
          showToast('Modo Automático pausado');
          speakAsSara('Pausei o modo automático, Eletro-Júnior.', voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        } else {
          speakAsSara('Não há nenhuma missão ativa neste momento, Eletro-Júnior.', voiceEnabledRef.current, {
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
          speakAsSara('Retomei a missão automática, Eletro-Júnior.', voiceEnabledRef.current, {
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
          speakAsSara(`Mostrei o relatório do ${rep.projectName} no painel, Eletro-Júnior.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        } else {
          speakAsSara('Ainda não há relatório concluído, Eletro-Júnior.', voiceEnabledRef.current, {
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
          speakAsSara('Retomei o modo automático de onde parámos, Eletro-Jr.', voiceEnabledRef.current, {
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
        const savedState = loadActiveProjectState(currentProject.id);
        const resumePrompt = savedState
          ? `Sara, continua o projeto "${savedState.projectName}" exatamente de onde parámos (última etapa concluída: ${savedState.lastStepDone}; próximo passo sugerido: ${savedState.nextStep}). Lê todos os ficheiros existentes, preserva tudo e implementa a próxima melhoria/etapa completa.`
          : `Sara, lê todos os ficheiros do projeto "${currentProject.name}" e continua a partir do ponto atual adicionando a próxima funcionalidade real completa sem apagar o código existente.`;
        await handleSendMessageRef.current?.(resumePrompt, undefined, undefined, 'voice');
        return true;
      }

      // 7. Controlo completo de ecrãs, editor, ficheiros, console, preview e ações (fala primeiro com naturalidade)
      if (cmd.type === 'focus_file') {
        speakAsSara(`A abrir o ficheiro ${cmd.filePath} no editor, Eletro-Júnior.`, voiceEnabledRef.current, {
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
        showToast('Painel de deploy aberto');
        speakAsSara('Painel de deploy aberto, Eletro-Jr.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'push_github') {
        const ghToken = getSavedGitHubToken();
        if (!ghToken) {
          setShowDeployModal(true);
          showToast('Configura o GitHub Token primeiro');
          speakAsSara('Eletro-Jr, configura o teu GitHub Token primeiro.', voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
          return true;
        }
        if (!cmd.preAuthorized) {
          setPendingConfirmation({
            id: `conf_push_${Date.now()}`,
            title: 'Confirmar Push GitHub',
            question: `Confirmas enviar os ${Object.keys(currentProject.files).length} ficheiros de "${currentProject.name}" para o GitHub? Diz "Sim, confirmo" ou "Não".`,
            action: { type: 'push_github' },
          });
          speakAsSara(
            `Confirmas o push de ${currentProject.name} para o GitHub, Eletro-Júnior?`,
            voiceEnabledRef.current,
            { level: 'short', forceSpeak: true }
          );
          return true;
        }
        try {
          showToast('A enviar para o GitHub...');
          const res = await pushProjectToGitHub({
            projectName: currentProject.name,
            files: currentProject.files,
          });
          addConsoleLog('success', `[GitHub Push] Enviado para ${res.repoUrl}`);
          showToast(`Push concluído: ${res.repoUrl}`);
          speakAsSara('Push para o GitHub concluído, Eletro-Jr.', voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        } catch (err: any) {
          const msg = err?.message || 'Erro no push para o GitHub.';
          addConsoleLog('error', msg);
          showToast(msg);
          speakAsSara('Deu um erro no push para o GitHub, Eletro-Jr.', voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        }
        return true;
      }

      if (cmd.type === 'save_project') {
        await handleSaveProjectToFirebase();
        speakAsSara('Projeto salvo, Eletro-Jr.', voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      if (cmd.type === 'download_zip') {
        await handleDownloadZip();
        speakAsSara('ZIP descarregado, Eletro-Jr.', voiceEnabledRef.current, {
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
          speakAsSara('Confirmas limpar o histórico técnico do chat, Eletro-Júnior?', voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
          return true;
        }
        stopSaraSpeech();
        setManualProposal(EMPTY_MANUAL_PROPOSAL);
        setMessages([]);
        showToast('Chat limpo');
        speakAsSara('Chat limpo, Eletro-Jr.', voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      if (cmd.type === 'open_projects') {
        setShowProjectsModal(true);
        showToast('Projetos abertos');
        speakAsSara('Lista de projetos aberta, Eletro-Jr.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'open_settings') {
        setShowSettingsModal(true);
        showToast('Configurações abertas');
        speakAsSara('Configurações abertas, Eletro-Jr.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'stop_listening') {
        stopHandsFreeMic();
        showToast('Microfone desligado');
        speakAsSara('Microfone desligado, Eletro-Jr.', voiceEnabledRef.current, {
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
          speakAsSara('Restaurei a versão anterior no preview, Eletro-Júnior.', voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        } else {
          speakAsSara('Ainda não há versão anterior guardada, Eletro-Júnior.', voiceEnabledRef.current, {
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
            next ? 'Modo apresentação ligado, Eletro-Júnior.' : 'Voltei do modo apresentação, Eletro-Júnior.',
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
        speakAsSara(`Apaguei o ficheiro ${cmd.filePath}, Eletro-Júnior.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'create_project') {
        const projName = cmd.name || `Projeto ${projects.length + 1}`;
        handleCreateNewProject(projName, cmd.projectType || 'Site');
        showToast(`Projeto criado: ${projName}`);
        speakAsSara(`Criei e abri o projeto ${projName}, Eletro-Júnior.`, voiceEnabledRef.current, {
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
          speakAsSara(`Abri o projeto ${target.name}, Eletro-Júnior.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        } else {
          speakAsSara(
            `Não encontrei nenhum projeto chamado ${cmd.name}, Eletro-Júnior. Queres que eu crie?`,
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
          speakAsSara(`Já apaguei o projeto ${deletedName}, Eletro-Júnior.`, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
        } else {
          speakAsSara(
            `Não encontrei nenhum projeto chamado ${cmd.name} para apagar, Eletro-Júnior.`,
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
        speakAsSara(`Dupliquei o projeto ${target.name}, Eletro-Júnior.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'rename_project') {
        handleRenameProject(currentProject.id, cmd.name);
        showToast(`Projeto renomeado: ${cmd.name}`);
        speakAsSara(`Mudei o nome do projeto para ${cmd.name}, Eletro-Júnior.`, voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'refresh_preview') {
        setRefreshSeed((s) => s + 1);
        showToast('Preview atualizado');
        speakAsSara('Preview recarregado, Eletro-Júnior.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      // 8. Consultas de progresso e relatório (respondem em 2.º plano por voz, sem conversa no chat)
      if (cmd.type === 'query_status') {
        let reply = '';
        if (mission.active && mission.tasks.length > 0) {
          const done = mission.tasks.filter((t) => t.status === 'done').length;
          const remaining = mission.tasks.filter((t) => t.status !== 'done').map((t) => t.title);
          reply = `Já fiz ${done} de ${mission.tasks.length} etapas, Eletro-Júnior, falta: ${remaining.join(', ')}.`;
        } else if (manualProposal.active) {
          reply = `Estamos no Modo Manual na etapa ${manualProposal.currentStepIndex + 1} de ${manualProposal.totalEstimatedSteps}, Eletro-Júnior.`;
        } else {
          const mem = loadActiveProjectState(currentProject.id);
          reply = mem
            ? `O projeto atual ${mem.projectName} tem ${Object.keys(currentProject.files).length} ficheiros. Próximo passo: ${mem.nextStep}.`
            : `O projeto atual ${currentProject.name} tem ${Object.keys(currentProject.files).length} ficheiros prontos, Eletro-Júnior.`;
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
          ? `Terminei ${rep.completedCount} etapas e corrigi ${rep.errorsFixed} erros no ${rep.projectName}, Eletro-Júnior.`
          : mission.active
          ? `Ainda estou a trabalhar na etapa ${mission.currentIndex + 1} de ${mission.tasks.length}, Eletro-Júnior.`
          : 'Ainda não concluí nenhuma missão automática recente, Eletro-Júnior.';
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
      handleForceSilenceSara,
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
            setShowSettingsModal(true);
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
            setShowDeployModal(true);
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
      showToast,
    ]
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
      const trimmed = isVoice ? normalizePhoneticVoiceTranscript(rawTrimmed) : rawTrimmed;
      const cmd = parseVoiceCommand(trimmed, voiceContextRef.current);
      if (cmd.type === 'start_listening') {
        if (!shouldKeepListeningRef.current) {
          shouldKeepListeningRef.current = true;
          setIsListening(true);
          stopMicRef.current = startContinuousVoiceRecognition({
            shouldKeepListening: () => shouldKeepListeningRef.current,
            onResult: (transcript) => {
              const voiceCmd = parseVoiceCommand(transcript, voiceContextRef.current);
              addConsoleLog('info', '[Canal de Voz] Comando captado em 2.º plano.');
              setIsVoiceProcessing(true);
              const runner = executePlatformCommandRef.current || executePlatformCommand;
              runner(voiceCmd, transcript)
                .then((handled) => {
                  if (!handled) {
                    return handleSendMessageRef.current?.(transcript, undefined, undefined, 'voice');
                  }
                })
                .finally(() => {
                  setIsVoiceProcessing(false);
                });
            },
            onError: (errMsg, fatal) => {
              addConsoleLog('warn', errMsg);
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
        }
        showToast('Microfone contínuo ativado!');
        speakAsSara('Microfone ligado, estou a ouvir, Eletro-Jr.', voiceEnabledRef.current, {
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

      const hasExistingCode = !isProjectBlank(currentProject.files);
      const activeProjectState = loadActiveProjectState(currentProject.id);
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

      // No MODO MANUAL: se já há uma proposta aguardando aprovação/colaboração de Eletro-Jr
      if (!isPlatformOnly && agentModeRef.current === 'manual' && manualProposal.active && !hasMediaOrFiles) {
        if (isRejectionOrCancelMessage(trimmed)) {
          setManualProposal(EMPTY_MANUAL_PROPOSAL);
          const cancelReply =
            'Combinado, Eletro-Jr! Parei essa proposta por aqui. Diz-me o que queres ajustar ou mudar de rumo.';
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

        // Se Eletro-Jr respondeu com uma pergunta sobre a proposta (ex: "o que sugeres?"), responde em voz sem perder o plano
        const isQuestionOnProposal =
          isPureChatRequest || (/\?$/.test(trimmed) && !/\b(faz|executa|avanca|adiciona|coloca|muda|usa)\b/i.test(trimmed));
        if (!isQuestionOnProposal) {
          const updatedQueue = manualProposal.stepsQueue.map((item, idx) =>
            idx === manualProposal.currentStepIndex
              ? {
                  ...item,
                  description: `${item.description} (Ajuste de Eletro-Jr: ${trimmed})`,
                }
              : item
          );
          const refinedProposal: ManualProposalState = {
            ...manualProposal,
            stepsQueue: updatedQueue,
          };
          setManualProposal(refinedProposal);
          await speakAsSaraAndWait(
            'Excelente ajuste, Eletro-Júnior! Já incorporei a tua ideia nesta etapa e vou construir agora.',
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
          salvarMensagemChatFirebase(userMsg, currentProject.id, firebaseUser?.uid);
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
            }),
            planAutonomousMission(
              trimmed,
              currentProject.files,
              'manual',
              getRequestedPastProjects(trimmed),
              activeProjectState
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
            updateProjectStateFromRecord(currentProject, {
              goal: trimmed,
              lastStepDone: 'Plano colaborativo proposto (a aguardar aprovação)',
              nextStep: first.title,
              missingFeatures: queue.map((q) => q.title),
            });

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
            salvarMensagemChatFirebase(proposalMsg, currentProject.id, firebaseUser?.uid);

            // Fala PRIMEIRO com sugestões e pergunta de aprovação — NÃO executa código antes do Eletro-Jr confirmar!
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
        salvarMensagemChatFirebase(userMsg, currentProject.id, firebaseUser?.uid);
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
            }
          );
          salvarEstadoProjetoFirebase(nextState, firebaseUser?.uid);

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

        if (result.needsApiKey) {
          showToast('Configura a tua chave Gemini nas Configurações para gerar código.');
          setShowSettingsModal(true);
        }

        const createdList = result.files ? Object.keys(result.files) : [];

        // REGRA: O que a Sara responde em voz (conversa pura sem código) fala PRIMEIRO e só depois executa ações da plataforma!
        if (isPlatformOnly || (!result.updateFiles && (isVoice || result.mode === 'conversation'))) {
          const spokenOnly = result.voiceSummary || result.reply || 'Pronto, Eletro-Júnior.';
          speakAsSara(spokenOnly, voiceEnabledRef.current, {
            level: 'medium',
            isQuestionReply: true,
            forceSpeak: isVoice || !isSaraSilenced,
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
            salvarMensagemChatFirebase(techReplyMsg, currentProject.id, firebaseUser?.uid);
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
        salvarMensagemChatFirebase(finalSaraMsg, currentProject.id, firebaseUser?.uid);

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
          allowInfraMention: /\b(firebase|pastas|estrutura)\b/i.test(trimmed),
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
        const gentleSpoken = `Estou a trocar a rota dos motores para continuar ${currentProject.name}, Eletro-Júnior. Podes tentar outra vez ou dar-me um comando de voz agora.`;
        if (!isVoice) {
          setMessages((prev) => [
            ...prev,
            {
              id: `sara_cont_${Date.now()}`,
              sender: 'sara',
              text: `Estou a ajustar o motor de resposta em segundo plano para **${currentProject.name}**, Eletro-Jr — envia novamente o próximo detalhe que eu sigo contigo!`,
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
      isPresentationMode,
      showProjectsModal,
      showSettingsModal,
      showDeployModal,
      isSaraSilenced,
      runAutonomousMission,
      manualProposal,
      executeManualApprovedStep,
      getRequestedPastProjects,
      firebaseUser?.uid,
      consoleLogs,
      messages,
      replaceCurrentProjectFiles,
      addConsoleLog,
      showToast,
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
        const cmd = parseVoiceCommand(transcript, voiceContextRef.current);
        addConsoleLog('info', '[Canal de Voz] Comando captado em 2.º plano.');

        if (cmd.type === 'start_listening') {
          speakAsSara('Já estou a ouvir, Eletro-Jr.', voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
          return;
        }

        setIsVoiceProcessing(true);
        const runner = executePlatformCommandRef.current || executePlatformCommand;
        runner(cmd, transcript)
          .then((handled) => {
            if (!handled) {
              return handleSendMessageRef.current?.(transcript, undefined, undefined, 'voice');
            }
          })
          .finally(() => {
            setIsVoiceProcessing(false);
          });
      },
      onError: (errMsg, fatal) => {
        addConsoleLog('warn', errMsg);
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
  }, [addConsoleLog, executePlatformCommand, showToast]);

  const handleToggleMic = useCallback(() => {
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
      const st = updateProjectStateFromRecord(newProj);
      salvarProjetoNoFirebase(newProj, firebaseUser?.uid).catch(() => {});
      salvarEstadoProjetoFirebase(st, firebaseUser?.uid).catch(() => {});
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
    const st = updateProjectStateFromRecord(imported);
    salvarProjetoNoFirebase(imported, firebaseUser?.uid).catch(() => {});
    salvarEstadoProjetoFirebase(st, firebaseUser?.uid).catch(() => {});
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

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0A0A0F] text-white overflow-hidden">
      {/* Barra Superior */}
      <TopBar
        projectName={currentProject.name}
        agentMode={agentMode}
        voiceEnabled={voiceEnabled}
        voiceLevel={voiceLevel}
        isListening={isListening}
        isSaraSpeaking={isSaraSpeaking}
        isSaraSilenced={isSaraSilenced}
        isThinking={isThinking || liveBuild.isBuilding}
        firebaseUser={firebaseUser}
        isSyncingFirebase={isSyncingFirebase}
        onChangeAgentMode={(m) => handleSwitchMode(m)}
        onToggleVoice={handleToggleVoice}
        onCycleVoiceLevel={handleCycleVoiceLevel}
        onSilenceSara={handleSilenceSara}
        onToggleMic={handleToggleMic}
        onTogglePresentation={() => setIsPresentationMode((v) => !v)}
        onSaveProject={handleSaveProjectToFirebase}
        onOpenProjects={() => setShowProjectsModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenDeploy={() => setShowDeployModal(true)}
      />

      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-[#090D16] border border-cyan-400/50 text-xs font-medium text-cyan-200 shadow-2xl">
          {toastMsg}
        </div>
      )}

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
              localStorage.removeItem(SAVED_MISSION_KEY);
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

      {/* Modais */}
      <ProjectsModal
        isOpen={showProjectsModal}
        projects={projects}
        currentProjectId={currentProject.id}
        isSyncingFirebase={isSyncingFirebase}
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

      <SettingsModal
        isOpen={showSettingsModal}
        firebaseUser={firebaseUser}
        onClose={() => setShowSettingsModal(false)}
        onNotify={(msg) => {
          addConsoleLog('info', msg);
          showToast(msg);
        }}
      />

      <DeployModal
        isOpen={showDeployModal}
        projectName={currentProject.name}
        files={currentProject.files}
        onClose={() => setShowDeployModal(false)}
        onOpenSettings={() => setShowSettingsModal(true)}
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
            <button
              type="button"
              onClick={handleForceSilenceSara}
              className="px-2 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer hover:bg-rose-500/30 transition"
              title="Calar Sara agora"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Calar</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
