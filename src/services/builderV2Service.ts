import type {
  BuilderAgentTelemetry,
  BuilderProjectContract,
  ChatMessage,
  ProjectFiles,
} from '../types/builder';
import { getSavedGeminiKey } from './saraAiService';
import { ensureCompleteProjectScaffoldAndDeps } from '../utils/builderScaffolder';

export interface BuilderV2BriefingResponse {
  stage: 'briefing';
  reply: string;
  missingQuestions: string[];
  detectedType?: string;
  detectedColors?: string;
  detectedAudience?: string;
  voiceSummary: string;
  scopeDrift: boolean;
  agentTelemetry: BuilderAgentTelemetry[];
}

export interface BuilderV2StructureResponse {
  stage: 'structure' | 'refine_structure';
  reply: string;
  voiceSummary: string;
  contract: BuilderProjectContract;
  agentTelemetry: BuilderAgentTelemetry[];
}

export interface BuilderV2BuildPartResponse {
  stage: 'build_part';
  partIndex: number;
  partTitle: string;
  files: ProjectFiles;
  summaryDone: string;
  simplifiedNotice?: string;
  autoRepaired: boolean;
  nextPartHint?: string;
  testReport: {
    passed: boolean;
    issues: string[];
    checksPassed: string[];
    summary: string;
  };
  designNotes: string[];
  addedDependencies: string[];
  agentTelemetry: BuilderAgentTelemetry[];
}

export interface BuilderV2ScopeCheckResponse {
  stage: 'scope_check';
  sameProject: boolean;
  detectedIntentSummary: string;
  agentTelemetry: BuilderAgentTelemetry[];
}

async function postBuilderV2<T>(payload: Record<string, unknown>): Promise<T> {
  const customKey = getSavedGeminiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (customKey) headers['x-gemini-api-key'] = customKey;

  const response = await fetch('/api/builder-v2', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Falha no motor Builder V2 (HTTP ${response.status})`);
  }
  return data as T;
}

export async function runBuilderV2Briefing(params: {
  prompt: string;
  history: ChatMessage[];
  activeContract?: BuilderProjectContract | null;
  hasExistingCode: boolean;
}): Promise<BuilderV2BriefingResponse> {
  return postBuilderV2<BuilderV2BriefingResponse>({
    stage: 'briefing',
    prompt: params.prompt,
    history: params.history.slice(-8).map((m) => ({ sender: m.sender, text: m.text })),
    activeContract: params.activeContract || null,
    hasExistingCode: params.hasExistingCode,
  });
}

export async function runBuilderV2Structure(params: {
  prompt: string;
  briefingPrompt?: string;
  existingContract?: BuilderProjectContract | null;
  isRefinement?: boolean;
}): Promise<BuilderV2StructureResponse> {
  return postBuilderV2<BuilderV2StructureResponse>({
    stage: params.isRefinement ? 'refine_structure' : 'structure',
    prompt: params.prompt,
    briefingPrompt: params.briefingPrompt || '',
    existingContract: params.existingContract || null,
  });
}

export async function runBuilderV2BuildPart(params: {
  contract: BuilderProjectContract;
  partIndex: number;
  existingFiles: ProjectFiles;
  attemptNumber?: number;
  userAdjustment?: string;
}): Promise<BuilderV2BuildPartResponse> {
  const raw = await postBuilderV2<Omit<BuilderV2BuildPartResponse, 'addedDependencies'>>({
    stage: 'build_part',
    contract: params.contract,
    partIndex: params.partIndex,
    existingFiles: params.existingFiles,
    attemptNumber: params.attemptNumber || 1,
    userAdjustment: params.userAdjustment || '',
  });

  const merged = { ...params.existingFiles, ...(raw.files || {}) };
  const { files: completeFiles, addedDeps } = ensureCompleteProjectScaffoldAndDeps(
    merged,
    params.contract
  );

  return {
    ...raw,
    files: completeFiles,
    addedDependencies: addedDeps,
  };
}

export async function runBuilderV2ScopeCheck(params: {
  prompt: string;
  contract: BuilderProjectContract;
}): Promise<BuilderV2ScopeCheckResponse> {
  return postBuilderV2<BuilderV2ScopeCheckResponse>({
    stage: 'scope_check',
    prompt: params.prompt,
    contract: params.contract,
  });
}
