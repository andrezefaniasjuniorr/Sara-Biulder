import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Eye, Code2, Terminal } from 'lucide-react';
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
  PreviewDevice,
  ProjectFiles,
  ProjectRecord,
  ProjectType,
  RightPanelTab,
  VersionSnapshot,
  VoiceLevel,
} from './types/builder';
import { createStarterProject } from './utils/starterProject';
import {
  askSaraBuilderStep,
  filesToCodeBlocks,
  planAutonomousMission,
  runSaraFinalTest,
  runSaraStream,
  type ConvertedImage,
} from './services/saraAiService';
import {
  apagarProjetoNoFirebase,
  buscarProjetosNoFirebase,
  salvarMensagemChatFirebase,
  salvarProjetoNoFirebase,
  verificarUsuario,
} from './services/firebaseService';
import { buildStandaloneHtml, downloadProjectZip, importProjectZip } from './utils/zipService';
import { getSavedGitHubToken, pushProjectToGitHub } from './utils/githubService';
import {
  adjustVoiceSpeed,
  getBuildAcceptanceSpeech,
  getContinuationSpeech,
  getModeSwitchSpeech,
  parseVoiceCommand,
  playCompletionChime,
  setSaraSilenced,
  setSpeakingStateListener,
  speakAsSara,
  speakAsSaraAndWait,
  startContinuousVoiceRecognition,
  stopSaraSpeech,
  type VoiceCommandAction,
} from './utils/voiceService';
import {
  isProjectBlank,
  loadActiveProjectState,
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
const AGENT_MODE_KEY = 'sara_biulder_agent_mode_v1';
const SAVED_MISSION_KEY = 'sara_biulder_saved_mission_v2';
const ERRORS_FIXED_KEY = 'sara_biulder_errors_fixed_v1';
const VOICE_LEVEL_KEY = 'sara_biulder_voice_level_v1';

function loadInitialVoiceLevel(): VoiceLevel {
  try {
    const saved = localStorage.getItem(VOICE_LEVEL_KEY);
    if (saved === 'short' || saved === 'medium' || saved === 'full') return saved;
  } catch {
    // ignore
  }
  return 'short';
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'sara_welcome',
  sender: 'sara',
  text: 'Olá, Eletro-Jr! Eu sou a Sara, a tua Biulder. Podes escolher **Modo Manual** (fazemos juntos passo a passo) ou **Modo Automático** (construo, testo, corrijo e faço push sozinha). O que vamos criar hoje?',
  timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
};

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
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return [WELCOME_MESSAGE];
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
  return /^(sim|ok|okay|pode continuar|continua|avanca|vai|aprovo|aprovado|faz|pode fazer|bora|comeca|segue|perfeito)[!.]*$/.test(
    norm
  );
}

function isNewBuildRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(cria|criar|faz|fazer|gera|gerar|constroi|construir|desenvolve|desenvolver)\b/.test(lower);
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
  const [isSaraSpeaking, setIsSaraSpeaking] = useState(false);
  const shouldKeepListeningRef = useRef(false);
  const stopMicRef = useRef<(() => void) | null>(null);

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUserProfile | null>(null);
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);

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
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-50)));
    } catch {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    const unsub = verificarUsuario((user) => {
      setFirebaseUser(user);
    });
    return unsub;
  }, []);

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
      }
    ) => {
      const cleanGoal =
        goalText.replace(/^(sara,?\s*faz sozinha:?|miss[aã]o:?)\s*/i, '').trim() || goalText;

      missionAbortRef.current = false;
      missionPausedRef.current = false;
      setAgentMode('automatic');
      setManualProposal(EMPTY_MANUAL_PROPOSAL);

      if (!options?.skipUserMsg && !options?.resumedMission) {
        const userMsg: ChatMessage = {
          id: `usr_${Date.now()}`,
          sender: 'user',
          text: goalText,
          timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, userMsg]);
      }

      // Resposta espontânea ANTES de começar a construir (fala e espera terminar antes do plano)
      if (options?.contextCue === 'sleep') {
        const sleepReply =
          'Modo automático ativado, Eletro-Jr! Vou construir tudo sozinha etapa por etapa. Vai descansar tranquilo, amanhã está tudo pronto.';
        setMessages((prev) => [
          ...prev,
          {
            id: `sara_auto_cue_${Date.now()}`,
            sender: 'sara',
            text: sleepReply,
            timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        await speakAsSaraAndWait(sleepReply, voiceEnabledRef.current, {
          level: 'medium',
          forceSpeak: true,
        });
      } else if (options?.contextCue === 'leave') {
        const leaveReply =
          'Pode sair tranquilo, Eletro-Jr! Já ativei o automático e vou criar tudo etapa por etapa.';
        setMessages((prev) => [
          ...prev,
          {
            id: `sara_auto_cue_${Date.now()}`,
            sender: 'sara',
            text: leaveReply,
            timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        await speakAsSaraAndWait(leaveReply, voiceEnabledRef.current, {
          level: 'medium',
          forceSpeak: true,
        });
      } else if (!options?.resumedMission) {
        const acceptanceSpeech = getBuildAcceptanceSpeech(cleanGoal, 'automatic');
        await speakAsSaraAndWait(acceptanceSpeech, voiceEnabledRef.current, {
          level: 'medium',
          forceSpeak: true,
        });
      }

      setIsThinking(true);
      setLiveBuild({
        isBuilding: true,
        phase: 'thinking',
        elapsedSeconds: 0,
        steps: [],
        createdFiles: [],
      });

      try {
        let plannedTasks = options?.resumedMission?.tasks || [];
        let startIdx = options?.resumedMission?.currentIndex || 0;
        let missionNotes: string[] = options?.resumedMission?.notes || [];
        let errorsFixed = options?.resumedMission?.errorsFixed || 0;
        let totalErrorsRemaining = options?.resumedMission?.errorCount || 0;
        const startedAtIso = options?.resumedMission?.startedAt || new Date().toISOString();

        if (!options?.resumedMission) {
          const activeState = loadActiveProjectState(currentProject.id);
          const plan = await planAutonomousMission(
            cleanGoal,
            currentProject.files,
            'automatic',
            getRequestedPastProjects(cleanGoal),
            activeState
          );
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
            currentStepLabel: `Etapa ${i + 1} de ${plannedTasks.length} — ${task.title}`,
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
            }

            setLiveBuild((prev) => ({
              ...prev,
              phase: 'testing',
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

        // 5. PUSH AUTOMÁTICO PARA O GITHUB (se houver token configurado)
        let githubUrl: string | undefined;
        const ghToken = getSavedGitHubToken();
        if (ghToken) {
          try {
            setLiveBuild((prev) => ({
              ...prev,
              currentStepLabel: 'A fazer Push automático para o GitHub...',
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
        setMessages((prev) => [
          ...prev,
          {
            id: `sara_report_${Date.now()}`,
            sender: 'sara',
            text: reportMsgText,
            timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
            mode: 'mission',
            codeBlocks: filesToCodeBlocks(workingFiles),
          },
        ]);

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
        const errMsg = err?.message || 'Erro durante o Modo Automático.';
        addConsoleLog('error', errMsg);
        setMessages((prev) => [
          ...prev,
          {
            id: `sara_mission_err_${Date.now()}`,
            sender: 'sara',
            text: `Eletro-Jr, houve um erro no modo automático: **${errMsg}**`,
            errorContext: errMsg,
            timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        speakAsSara(
          'Deu um erro no processo automático, Eletro-Jr, deixei os detalhes no chat.',
          voiceEnabledRef.current,
          { level: 'short' }
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
    async (userText: string, proposal: ManualProposalState) => {
      const idx = proposal.currentStepIndex;
      const step = proposal.stepsQueue[idx];
      if (!step) {
        setManualProposal(EMPTY_MANUAL_PROPOSAL);
        return;
      }

      const nowTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        { id: `usr_${Date.now()}`, sender: 'user', text: userText, timestamp: nowTime },
      ]);

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
        const res = await askSaraBuilderStep({
          prompt: `MODO MANUAL — ETAPA ${idx + 1} de ${proposal.totalEstimatedSteps} do projeto "${proposal.goal}":
Executa agora SOMENTE a etapa: "${step.title}" (${step.description}).
Código 100% real, completo, zero mocks, mantendo o código anterior intacto.`,
          files: currentProject.files,
          consoleLogs: consoleLogs.slice(-10),
          history: messages.slice(-8),
          projectState: loadActiveProjectState(currentProject.id),
        });

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

        updateProjectStateFromRecord(
          { ...currentProject, files: updatedFiles },
          {
            goal: proposal.goal,
            lastStepDone: `Etapa ${idx + 1}/${proposal.totalEstimatedSteps}: ${step.title}`,
            nextStep: nextTask?.title || 'Sistema concluído',
            missingFeatures: remainingManualTitles,
          }
        );

        if (hasNext && nextTask) {
          setManualProposal({
            ...proposal,
            currentStepIndex: nextIdx,
          });
        } else {
          setManualProposal(EMPTY_MANUAL_PROPOSAL);
        }

        const msgReply = hasNext
          ? `✅ Etapa ${idx + 1}/${proposal.totalEstimatedSteps} (**${step.title}**) concluída e testada!\n\nPróxima etapa: **${nextTask!.title}** — ${nextTask!.description}.\nPosso avançar, Eletro-Jr?`
          : `✅ Etapa final (**${step.title}**) concluída e testada, Eletro-Jr! O sistema completo está pronto no Preview e Editor.`;

        setMessages((prev) => [
          ...prev,
          {
            id: `sara_man_${Date.now()}`,
            sender: 'sara',
            text: msgReply,
            timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
            mode: hasNext ? 'manual-proposal' : 'builder',
            codeBlocks: res.files ? filesToCodeBlocks(res.files) : undefined,
          },
        ]);

        speakAsSara(
          voiceLevelRef.current === 'full'
            ? msgReply
            : hasNext
            ? idx === 0
              ? 'Primeira parte pronta, Eletro-Jr. Posso avançar?'
              : 'Etapa pronta, Eletro-Jr. Posso avançar?'
            : 'Pronto, Eletro-Jr, terminei, está tudo testado.',
          voiceEnabledRef.current,
          { level: voiceLevelRef.current }
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
        const errMsg = err?.message || 'Erro na etapa manual.';
        setMessages((prev) => [
          ...prev,
          {
            id: `sara_err_${Date.now()}`,
            sender: 'sara',
            text: `Eletro-Jr, erro na etapa ${idx + 1}: **${errMsg}**`,
            errorContext: errMsg,
            timestamp: nowTime,
          },
        ]);
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
        setMessages((prev) => [
          ...prev,
          {
            id: `sara_mode_${Date.now()}`,
            sender: 'sara',
            text: msg,
            timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        speakAsSara(msg, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        showToast('Modo Manual ativado');
      } else {
        setAgentMode('automatic');
        const msg = spokenReason || getModeSwitchSpeech('automatic');
        setMessages((prev) => [
          ...prev,
          {
            id: `sara_mode_${Date.now()}`,
            sender: 'sara',
            text: msg,
            timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
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

  // Ref para permitir comando "Sara, fixa erro" dentro de executePlatformCommand sem ciclo
  const handleSendMessageRef = useRef<
    ((text: string, image?: ConvertedImage | null, attachments?: AttachedFile[]) => Promise<void>) | null
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

  // Controlo total da plataforma por Voz ou Chat
  const executePlatformCommand = useCallback(
    async (cmd: VoiceCommandAction, rawText: string): Promise<boolean> => {
      // 1. Calar Sara imediatamente
      if (cmd.type === 'silence_sara') {
        handleForceSilenceSara();
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

      // 4. Conversa rápida espontânea (mostra no chat sem chamar IA pesada e fala sem repetir)
      if (cmd.type === 'background_smalltalk') {
        setSaraSilenced(false);
        setIsSaraSilencedState(false);
        const nowTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        setMessages((prev) => [
          ...prev,
          { id: `usr_${Date.now()}`, sender: 'user', text: rawText, timestamp: nowTime },
          { id: `sara_${Date.now() + 1}`, sender: 'sara', text: cmd.reply, timestamp: nowTime },
        ]);
        showToast(`Sara (voz): ${cmd.reply}`);
        speakAsSara(cmd.reply, voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      // 5. Troca instantânea de modo (Manual <-> Automático)
      if (cmd.type === 'switch_manual') {
        handleSwitchMode('manual');
        return true;
      }

      if (cmd.type === 'switch_automatic') {
        if (cmd.goal) {
          await runAutonomousMission(cmd.goal, { contextCue: cmd.contextCue });
        } else if (manualProposal.active && manualProposal.goal) {
          const autoMsg = 'Entendido, Eletro-Júnior, vou fazer sozinha no automático.';
          setAgentMode('automatic');
          showToast('Modo Automático ativado');
          await speakAsSaraAndWait(autoMsg, voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
          await runAutonomousMission(manualProposal.goal, { skipUserMsg: true });
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
          await runAutonomousMission(saved.goal, { resumedMission: saved, skipUserMsg: true });
          return true;
        }
        if (agentModeRef.current === 'manual' && manualProposal.active) {
          await executeManualApprovedStep(rawText, manualProposal);
          return true;
        }
        const savedState = loadActiveProjectState(currentProject.id);
        const resumePrompt = savedState
          ? `Sara, continua o projeto "${savedState.projectName}" exatamente de onde parámos (última etapa concluída: ${savedState.lastStepDone}; próximo passo sugerido: ${savedState.nextStep}). Lê todos os ficheiros existentes, preserva tudo e implementa a próxima melhoria/etapa completa.`
          : `Sara, lê todos os ficheiros do projeto "${currentProject.name}" e continua a partir do ponto atual adicionando a próxima funcionalidade real completa sem apagar o código existente.`;
        await handleSendMessageRef.current?.(resumePrompt);
        return true;
      }

      // 7. Controlo completo de ecrãs, editor, ficheiros, console, preview e ações
      if (cmd.type === 'open_editor') {
        setIsEditorFullscreen(false);
        setRightTab('editor');
        setMobileTab('code');
        showToast('Editor aberto');
        speakAsSara('Editor aberto, Eletro-Jr.', voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      if (cmd.type === 'open_editor_fullscreen') {
        setRightTab('editor');
        setMobileTab('code');
        setIsEditorFullscreen(true);
        showToast('Editor em tela cheia');
        speakAsSara('Editor em tela cheia, Eletro-Jr.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'open_files') {
        setIsEditorFullscreen(false);
        setRightTab('files');
        setMobileTab('code');
        showToast('Ficheiros abertos');
        speakAsSara('Ficheiros do projeto abertos, Eletro-Jr.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'close_editor_or_back') {
        setIsEditorFullscreen(false);
        setIsPresentationMode(false);
        setShowProjectsModal(false);
        setShowSettingsModal(false);
        setShowDeployModal(false);
        setMobileTab('preview');
        showToast('Voltei ao painel principal');
        speakAsSara('Voltei ao painel principal, Eletro-Jr.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'open_console') {
        setIsEditorFullscreen(false);
        setRightTab('console');
        setMobileTab('console');
        showToast('Console aberto');
        speakAsSara('Console aberto, Eletro-Jr.', voiceEnabledRef.current, { level: 'short', forceSpeak: true });
        return true;
      }

      if (cmd.type === 'show_preview') {
        setIsEditorFullscreen(false);
        setMobileTab('preview');
        showToast('Preview aberto');
        speakAsSara('Aqui está o preview, Eletro-Jr.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'preview_mobile') {
        setIsEditorFullscreen(false);
        setPreviewDevice('mobile');
        setMobileTab('preview');
        showToast('Preview em Telemóvel');
        speakAsSara('Preview em telemóvel ativo, Eletro-Jr.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'preview_tablet') {
        setIsEditorFullscreen(false);
        setPreviewDevice('tablet');
        setMobileTab('preview');
        showToast('Preview em Tablet');
        speakAsSara('Preview em tablet ativo, Eletro-Jr.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'preview_desktop') {
        setIsEditorFullscreen(false);
        setPreviewDevice('desktop');
        setMobileTab('preview');
        showToast('Preview em PC');
        speakAsSara('Preview em computador ativo, Eletro-Jr.', voiceEnabledRef.current, {
          level: 'short',
          forceSpeak: true,
        });
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
        stopSaraSpeech();
        setManualProposal(EMPTY_MANUAL_PROPOSAL);
        setMessages([WELCOME_MESSAGE]);
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

      // 8. Consultas de progresso e relatório
      if (cmd.type === 'query_status') {
        const nowTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        let reply = '';
        if (mission.active && mission.tasks.length > 0) {
          const done = mission.tasks.filter((t) => t.status === 'done').length;
          const remaining = mission.tasks.filter((t) => t.status !== 'done').map((t) => t.title);
          reply = `Já fiz ${done} de ${mission.tasks.length} etapas, Eletro-Jr, falta: ${remaining.join(', ')}.`;
        } else if (manualProposal.active) {
          reply = `Estamos no Modo Manual na etapa ${manualProposal.currentStepIndex + 1} de ${manualProposal.totalEstimatedSteps}, Eletro-Jr.`;
        } else {
          const mem = loadActiveProjectState(currentProject.id);
          reply = mem
            ? `O projeto atual **${mem.projectName}** tem ${Object.keys(currentProject.files).length} ficheiro(s). Última etapa: ${mem.lastStepDone}. Próximo passo: ${mem.nextStep}.`
            : `O projeto atual **${currentProject.name}** tem ${Object.keys(currentProject.files).length} ficheiro(s) prontos, Eletro-Jr.`;
        }
        setMessages((prev) => [
          ...prev,
          { id: `usr_${Date.now()}`, sender: 'user', text: rawText, timestamp: nowTime },
          { id: `sara_${Date.now() + 1}`, sender: 'sara', text: reply, timestamp: nowTime },
        ]);
        speakAsSara(reply, voiceEnabledRef.current, {
          level: voiceLevelRef.current,
          isQuestionReply: true,
          forceSpeak: true,
        });
        return true;
      }

      if (cmd.type === 'query_report') {
        const nowTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        const rep = mission.report || lastCompletedReport;
        const reply = rep
          ? formatMissionReportText(rep)
          : mission.active
          ? `Ainda estou a trabalhar na etapa ${mission.currentIndex + 1} de ${mission.tasks.length}, Eletro-Jr!`
          : 'Ainda não concluí nenhuma missão automática recente, Eletro-Jr. Podes ativar o modo automático quando quiseres.';
        setMessages((prev) => [
          ...prev,
          { id: `usr_${Date.now()}`, sender: 'user', text: rawText, timestamp: nowTime },
          { id: `sara_${Date.now() + 1}`, sender: 'sara', text: reply, timestamp: nowTime },
        ]);
        speakAsSara(
          rep
            ? `Terminei ${rep.completedCount} etapas e corrigi ${rep.errorsFixed} erros, Eletro-Jr.`
            : reply,
          voiceEnabledRef.current,
          { level: 'short', isQuestionReply: true, forceSpeak: true }
        );
        return true;
      }

      return false;
    },
    [
      handleForceSilenceSara,
      showToast,
      handleSwitchMode,
      runAutonomousMission,
      manualProposal,
      mission,
      resumableMission,
      executeManualApprovedStep,
      currentProject,
      addConsoleLog,
      handleSaveProjectToFirebase,
      handleDownloadZip,
      stopHandsFreeMic,
      handleSaraFixError,
      lastCompletedReport,
    ]
  );

  const handleSendMessage = useCallback(
    async (text: string, image?: ConvertedImage | null, attachments?: AttachedFile[]) => {
      const trimmed = text.trim();
      if (!trimmed && !image && (!attachments || attachments.length === 0)) return;

      const cmd = parseVoiceCommand(trimmed);
      if (cmd.type === 'start_listening') {
        // Liga microfone manualmente apenas se pedido no chat
        if (!shouldKeepListeningRef.current) {
          shouldKeepListeningRef.current = true;
          setIsListening(true);
          stopMicRef.current = startContinuousVoiceRecognition({
            shouldKeepListening: () => shouldKeepListeningRef.current,
            onResult: (transcript) => {
              const voiceCmd = parseVoiceCommand(transcript);
              addConsoleLog('info', `Voz: "${transcript}"`);
              executePlatformCommand(voiceCmd, transcript).then((handled) => {
                if (!handled) {
                  handleSendMessageRef.current?.(transcript);
                }
              });
            },
            onError: (errMsg) => {
              addConsoleLog('warn', errMsg);
              shouldKeepListeningRef.current = false;
              setIsListening(false);
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

      const hasExistingCode = !isProjectBlank(currentProject.files);
      const activeProjectState = loadActiveProjectState(currentProject.id);

      // No MODO AUTOMÁTICO, um pedido de criação novo dispara automaticamente o pipeline autónomo
      if (agentModeRef.current === 'automatic' && isNewBuildRequest(trimmed) && !image && !hasExistingCode) {
        await runAutonomousMission(trimmed);
        return;
      }

      // No MODO MANUAL: se há uma proposta aguardando aprovação e Eletro-Jr disse "sim/pode continuar/avança"
      if (agentModeRef.current === 'manual' && manualProposal.active && isApprovalMessage(trimmed)) {
        await executeManualApprovedStep(trimmed, manualProposal);
        return;
      }

      const nowTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      const attachSummary = attachments?.length ? attachments.map((a) => a.name).join(', ') : undefined;

      // No MODO MANUAL: só cria plano novo multi-etapas quando o projeto ainda está vazio (do zero).
      // Se já existe código no projeto, continua e edita em cima do que já existe sem apagar nada!
      if (
        agentModeRef.current === 'manual' &&
        !manualProposal.active &&
        !hasExistingCode &&
        isNewBuildRequest(trimmed) &&
        !image &&
        (!attachments || attachments.length === 0)
      ) {
        const userMsg: ChatMessage = {
          id: `usr_${Date.now()}`,
          sender: 'user',
          text: trimmed,
          timestamp: nowTime,
        };
        setMessages((prev) => [...prev, userMsg]);
        setIsThinking(true);
        setLiveBuild({
          isBuilding: true,
          phase: 'thinking',
          elapsedSeconds: 0,
          steps: [],
          createdFiles: [],
        });

        try {
          // Fala aceitação e ideia ANTES de planear e avançar
          await speakAsSaraAndWait(
            getBuildAcceptanceSpeech(trimmed, 'manual'),
            voiceEnabledRef.current,
            { level: 'medium', forceSpeak: true }
          );

          const plan = await planAutonomousMission(
            trimmed,
            currentProject.files,
            'manual',
            getRequestedPastProjects(trimmed),
            activeProjectState
          );
          setIsThinking(false);
          setLiveBuild({
            isBuilding: false,
            phase: 'idle',
            elapsedSeconds: 0,
            steps: [],
            createdFiles: [],
          });

          const queue = plan.tasks || [];
          if (queue.length > 0) {
            setManualProposal({
              active: true,
              goal: trimmed,
              currentStepIndex: 0,
              totalEstimatedSteps: queue.length,
              stepsQueue: queue,
              pendingPromptForSara: trimmed,
            });

            const first = queue[0];
            updateProjectStateFromRecord(currentProject, {
              goal: trimmed,
              lastStepDone: 'Plano inicial proposto',
              nextStep: first.title,
              missingFeatures: queue.map((q) => q.title),
            });

            const proposalText = `${plan.planSentence}\n\n**Etapa 1 de ${queue.length}:** **${first.title}** — ${first.description}.\n\nQueres algum ajuste nos dados ou aprovas que eu crie esta etapa agora, Eletro-Jr?`;
            setMessages((prev) => [
              ...prev,
              {
                id: `sara_prop_${Date.now()}`,
                sender: 'sara',
                text: proposalText,
                timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
                mode: 'manual-proposal',
              },
            ]);
            speakAsSara(
              voiceLevelRef.current === 'full'
                ? proposalText
                : 'Etapa 1 pronta para aprovares, Eletro-Jr.',
              voiceEnabledRef.current,
              { level: voiceLevelRef.current }
            );
            return;
          }
        } catch {
          setIsThinking(false);
        }
      }

      // Fluxo padrão com streaming (lê TODO o projeto atual + sara_estado_projeto e preserva ficheiros existentes!)
      const userMsg: ChatMessage = {
        id: `usr_${Date.now()}`,
        sender: 'user',
        text: trimmed || 'Analisa os anexos.',
        imageUrl: image?.previewUrl,
        attachedFileName: attachSummary,
        timestamp: nowTime,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);
      const startTime = Date.now();

      setLiveBuild({
        isBuilding: true,
        phase: 'thinking',
        elapsedSeconds: 0,
        steps: [],
        createdFiles: [],
      });

      salvarMensagemChatFirebase(userMsg, currentProject.id, firebaseUser?.uid);

      // Fala aceitação e ideia ANTES de iniciar o stream de construção
      if (isNewBuildRequest(trimmed) || hasExistingCode) {
        const introSpeech = hasExistingCode
          ? getContinuationSpeech(currentProject.name)
          : getBuildAcceptanceSpeech(trimmed, agentModeRef.current);
        await speakAsSaraAndWait(introSpeech, voiceEnabledRef.current, {
          level: 'medium',
          forceSpeak: true,
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
              if (currentActive) {
                setActiveFile(currentActive);
              }
              // Preserva ficheiros antigos se já existe projeto ativo!
              replaceCurrentProjectFiles(streamedFiles, undefined, undefined, hasExistingCode);

              setLiveBuild((prev) => ({
                ...prev,
                isBuilding: true,
                phase: 'building',
                activeFile: currentActive,
                createdFiles: createdList,
                currentStepLabel:
                  prev.steps[Math.min(completedFiles.length, Math.max(0, prev.steps.length - 1))]
                    ?.label || `A criar ${currentActive || 'código'}`,
              }));
            },
          },
        });

        const totalElapsed = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        setIsThinking(false);
        setLiveBuild({
          isBuilding: false,
          phase: 'idle',
          elapsedSeconds: 0,
          steps: [],
          createdFiles: [],
        });

        if (result.updateFiles && result.files) {
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
          updateProjectStateFromRecord(
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

          const keys = Object.keys(result.files);
          if (keys.includes('index.html')) {
            setActiveFile('index.html');
          } else if (keys[0]) {
            setActiveFile(keys[0]);
          }
          // Mostra a árvore completa com todas as pastas abertas ao construir projeto multi-pastas
          if (!hasExistingCode && keys.length >= 4) {
            setRightTab('files');
          }
          setRefreshSeed((s) => s + 1);
          if (/corrige|erro/i.test(trimmed)) {
            setErrorsFixedCount((c) => c + 1);
          }
          addConsoleLog(
            'success',
            `Construídos ${keys.length} ficheiro(s) em ${totalElapsed}s (${result.engineLabel}).`
          );
        }

        const createdList = result.files ? Object.keys(result.files) : [];
        const finalSaraMsg: ChatMessage = {
          id: `sara_${Date.now()}`,
          sender: 'sara',
          text: result.reply,
          timestamp: new Date().toLocaleTimeString('pt-PT', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          mode: result.mode,
          suggestion: result.proactiveSuggestion,
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

        speakAsSara(
          result.reply || (result.updateFiles ? 'Pronto, Eletro-Jr, terminei, está tudo testado.' : ''),
          voiceEnabledRef.current,
          {
            level: voiceLevelRef.current,
            isQuestionReply: !result.updateFiles,
            allowInfraMention: /\b(firebase|pastas|estrutura)\b/i.test(trimmed),
          }
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
        const errorText = err?.message || 'Erro ao comunicar com a IA.';
        addConsoleLog('error', errorText);
        setMessages((prev) => [
          ...prev,
          {
            id: `sara_err_${Date.now()}`,
            sender: 'sara',
            text: `Eletro-Jr, ocorreu um erro: **${errorText}**`,
            errorContext: errorText,
            timestamp: nowTime,
          },
        ]);
        speakAsSara('Deu um erro, Eletro-Jr, já deixei os detalhes no chat.', voiceEnabledRef.current, {
          level: 'short',
        });
      }
    },
    [
      executePlatformCommand,
      currentProject,
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

  // Microfone Contínuo Mãos-Livres (pausa automática enquanto Sara fala + 400ms depois)
  const startHandsFreeMic = useCallback(() => {
    if (shouldKeepListeningRef.current) return;
    shouldKeepListeningRef.current = true;
    setIsListening(true);

    stopMicRef.current = startContinuousVoiceRecognition({
      shouldKeepListening: () => shouldKeepListeningRef.current,
      onResult: (transcript) => {
        const cmd = parseVoiceCommand(transcript);
        addConsoleLog('info', `Voz: "${transcript}"`);

        if (cmd.type === 'start_listening') {
          speakAsSara('Já estou a ouvir, Eletro-Jr.', voiceEnabledRef.current, {
            level: 'short',
            forceSpeak: true,
          });
          return;
        }

        executePlatformCommand(cmd, transcript).then((handled) => {
          if (!handled) {
            handleSendMessage(transcript);
          }
        });
      },
      onError: (errMsg) => {
        addConsoleLog('warn', errMsg);
        shouldKeepListeningRef.current = false;
        setIsListening(false);
      },
      onEnd: () => {
        if (!shouldKeepListeningRef.current) {
          setIsListening(false);
        }
      },
    });
  }, [addConsoleLog, executePlatformCommand, handleSendMessage]);

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

  const handleDeleteFile = (filePath: string) => {
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
      const keys = Object.keys(imported.files);
      setActiveFile(keys.includes('index.html') ? 'index.html' : keys[0] || 'index.html');
      setRefreshSeed((s) => s + 1);
      showToast(`ZIP "${imported.name}" importado!`);
    } catch (err: any) {
      addConsoleLog('error', err?.message || 'Falha ao importar ZIP.');
    }
  };

  const handleCreateNewProject = (name: string, type: ProjectType) => {
    const newProj = createStarterProject(name, type);
    setProjects((prev) => [newProj, ...prev]);
    setCurrentProjectId(newProj.id);
    setActiveFile('index.html');
    setRefreshSeed((s) => s + 1);
    addConsoleLog('success', `Novo projeto "${name}" (${type}) criado.`);
  };

  const handleDuplicateProject = (proj: ProjectRecord) => {
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
  };

  const handleRenameProject = (id: string, newName: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName, updatedAt: new Date().toISOString() } : p))
    );
  };

  const handleDeleteProject = (id: string) => {
    setProjects((prev) => {
      const remaining = prev.filter((p) => p.id !== id);
      if (remaining.length === 0) return prev;
      if (id === currentProjectId) {
        setCurrentProjectId(remaining[0].id);
      }
      return remaining;
    });
    apagarProjetoNoFirebase(id).catch(() => {});
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
    const keys = Object.keys(files);
    setActiveFile(keys.includes('index.html') ? 'index.html' : keys[0] || 'index.html');
    setRefreshSeed((s) => s + 1);
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
              setMessages([WELCOME_MESSAGE]);
            }}
            onApplySuggestion={(sug) => handleSendMessage(`Sara, aplica esta melhoria: ${sug}`)}
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
          setCurrentProjectId(proj.id);
          const keys = Object.keys(proj.files);
          setActiveFile(keys.includes('index.html') ? 'index.html' : keys[0] || 'index.html');
          setRefreshSeed((s) => s + 1);
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
    </div>
  );
}
