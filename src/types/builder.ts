export type FileKey = string;

export type ProjectFiles = Record<string, string>;

export type ProjectType = 'Site' | 'App' | 'Jogo';

export type AgentMode = 'manual' | 'automatic';

export type VoiceLevel = 'short' | 'medium' | 'full';

export interface VersionSnapshot {
  id: string;
  label: string;
  timestamp: string;
  files: ProjectFiles;
}

export interface ProjectRecord {
  id: string;
  name: string;
  type: ProjectType;
  files: ProjectFiles;
  createdAt: string;
  updatedAt: string;
  syncedToFirebase?: boolean;
  versions?: VersionSnapshot[];
}

export interface AttachedFile {
  name: string;
  size: number;
  type: string;
  content?: string;
  imageData?: {
    data: string;
    mimeType: string;
    previewUrl: string;
  };
}

export interface BuildStep {
  id: number;
  label: string;
  status: 'pending' | 'running' | 'done';
}

export interface LiveBuildInfo {
  isBuilding: boolean;
  phase: 'idle' | 'thinking' | 'planning' | 'building' | 'testing' | 'fixing';
  elapsedSeconds: number;
  planSentence?: string;
  currentStepLabel?: string;
  steps: BuildStep[];
  activeFile?: string;
  createdFiles: string[];
  completedFiles?: string[];
  modelUsed?: string;
}

export type SaraPlatformActionType =
  | 'open_editor'
  | 'open_editor_fullscreen'
  | 'open_files'
  | 'open_console'
  | 'show_preview'
  | 'open_preview_fullscreen'
  | 'close_preview_fullscreen'
  | 'toggle_presentation'
  | 'close_overlay'
  | 'preview_mobile'
  | 'preview_tablet'
  | 'preview_desktop'
  | 'open_projects'
  | 'open_settings'
  | 'open_deploy'
  | 'create_project'
  | 'open_project'
  | 'delete_project'
  | 'rename_project'
  | 'duplicate_project'
  | 'save_project'
  | 'focus_file'
  | 'delete_file'
  | 'refresh_preview'
  | 'undo_version'
  | 'download_zip'
  | 'push_github'
  | 'clear_chat'
  | 'switch_manual'
  | 'switch_automatic'
  | 'pause_mission'
  | 'resume_mission'
  | 'open_report'
  | 'fix_error'
  | 'open_builder_mode'
  | 'open_jarvis_mode';

export interface SaraPlatformAction {
  type: SaraPlatformActionType;
  name?: string;
  path?: string;
  projectType?: ProjectType;
}

export interface ScreenContextInfo {
  activeTab: RightPanelTab;
  previewDevice: PreviewDevice;
  activeFile: string;
  projectName: string;
  isEditorFullscreen: boolean;
  isPreviewFullscreen?: boolean;
  hasExistingCode: boolean;
  availableProjects?: string[];
  openModal?: 'projects' | 'settings' | 'deploy' | 'presentation' | null;
}

export interface PendingVoiceConfirmation {
  id: string;
  title: string;
  question: string;
  action:
    | { type: 'push_github' }
    | { type: 'clear_chat' }
    | { type: 'destructive_prompt'; prompt: string; source: 'text' | 'voice' };
}

export type BuilderStackType = 'nextjs-vite-tsx' | 'android-kotlin' | 'hybrid-web-android';

export type BuilderAgentRole = 'ARQUITETA' | 'CONSTRUTORA' | 'DESIGNER' | 'TESTADORA' | 'GESTORA';

export interface BuilderAgentTelemetry {
  role: BuilderAgentRole;
  keySlot: number;
  modelUsed?: string;
  status: 'idle' | 'working' | 'done' | 'failover';
}

export type BuilderV2Phase =
  | 'idle'
  | 'briefing'
  | 'awaiting_approval'
  | 'building_parts'
  | 'completed';

export interface BuilderProjectPart {
  id: number;
  title: string;
  description: string;
  targetFiles: string[];
  status: 'pending' | 'running' | 'done' | 'error';
  attempts: number;
}

export interface BuilderProjectContract {
  projectName: string;
  stack: BuilderStackType;
  audience: string;
  purpose: string;
  colors: string;
  designTokens?: Record<string, string>;
  pages: string[];
  functions: string[];
  userFlow?: string[];
  folderTree: string[];
  partsQueue: BuilderProjectPart[];
  currentPartIndex: number;
  completedParts: string[];
  phase: BuilderV2Phase;
  locked: boolean;
  initialPrompt?: string;
  updatedAt: string;
  lastAuditSummary?: string;
}

export interface BuilderV2DeliveryReport {
  doneItems: string[];
  missingItems: string[];
  createdFiles: string[];
  testPassed: boolean;
  testSummary: string;
  simplifiedNotice?: string;
  addedDependencies?: string[];
  hasNextPart: boolean;
  nextPartTitle?: string;
}

export interface ChatCodeBlock {
  path: string;
  code: string;
  language: string;
}

export interface ChatMessage {
  id: string;
  sender: 'sara' | 'user';
  text: string;
  imageUrl?: string;
  generatedImagePrompt?: string;
  generatedImageStyle?: 'realistic' | 'drawing' | 'pixar3d';
  generatedImageSeed?: number;
  generatedImageTopQuality?: boolean;
  awaitingImageStyle?: boolean;
  isGeneratingImage?: boolean;
  attachedFileName?: string;
  timestamp: string;
  mode?: 'conversation' | 'builder' | 'mission' | 'error-fix' | 'manual-proposal' | 'contract-proposal' | 'briefing' | 'scope-guard';
  suggestion?: string;
  architectureSummary?: string;
  strategicImprovements?: string[];
  voiceDelivered?: boolean;
  hasCodeUpdate?: boolean;
  engineLabel?: string;
  errorContext?: string;
  codeBlocks?: ChatCodeBlock[];
  contractCard?: BuilderProjectContract;
  deliveryReport?: BuilderV2DeliveryReport;
  agentTelemetry?: BuilderAgentTelemetry[];
  scopeDriftPrompt?: {
    pendingUserRequest: string;
    summary: string;
  };
  buildSummary?: {
    elapsedSeconds: number;
    filesCreated: string[];
    steps: BuildStep[];
    modelUsed?: string;
  };
}

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'success' | 'command';

export interface ConsoleEntry {
  id: string;
  level: ConsoleLevel;
  message: string;
  timestamp: string;
  source?: string;
}

export type PreviewDevice = 'desktop' | 'tablet' | 'mobile';
export type RightPanelTab = 'files' | 'editor' | 'console';
export type MobilePanelTab = 'chat' | 'preview' | 'code' | 'console';

export interface MissionTask {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'error';
  attempts: number;
}

export interface MissionReport {
  goal: string;
  projectName: string;
  startedAt: string;
  finishedAt: string;
  elapsedSeconds: number;
  completedCount: number;
  totalCount: number;
  errorsFixed: number;
  remainingErrors: number;
  githubUrl?: string;
  firebaseSynced: boolean;
  notes: string[];
  sleptOvernight?: boolean;
}

export interface MissionState {
  active: boolean;
  paused: boolean;
  goal: string;
  tasks: MissionTask[];
  currentIndex: number;
  errorCount: number;
  errorsFixed: number;
  elapsedSeconds: number;
  startedAt?: string;
  notes: string[];
  finished: boolean;
  report?: MissionReport;
}

export interface ManualProposalState {
  active: boolean;
  goal: string;
  currentStepIndex: number;
  totalEstimatedSteps: number;
  stepsQueue: Array<{ title: string; description: string }>;
  pendingPromptForSara: string;
}

export interface FirebaseUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
