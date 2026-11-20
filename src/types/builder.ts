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
  | 'fix_error';

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
  attachedFileName?: string;
  timestamp: string;
  mode?: 'conversation' | 'builder' | 'mission' | 'error-fix' | 'manual-proposal';
  suggestion?: string;
  architectureSummary?: string;
  strategicImprovements?: string[];
  voiceDelivered?: boolean;
  hasCodeUpdate?: boolean;
  engineLabel?: string;
  errorContext?: string;
  codeBlocks?: ChatCodeBlock[];
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
