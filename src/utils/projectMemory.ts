import type {
  BuilderProjectContract,
  ProjectFiles,
  ProjectRecord,
  ProjectType,
} from '../types/builder';

export const SARA_PROJECT_STATE_KEY = 'sara_estado_projeto';
export const SARA_PROJECT_STATES_MAP_KEY = 'sara_estado_projetos_map';

function scopedStateKey(userId?: string): string {
  return userId ? `${SARA_PROJECT_STATE_KEY}_${userId}` : SARA_PROJECT_STATE_KEY;
}

function scopedMapKey(userId?: string): string {
  return userId ? `${SARA_PROJECT_STATES_MAP_KEY}_${userId}` : SARA_PROJECT_STATES_MAP_KEY;
}

function isGuestUser(userId?: string): boolean {
  return Boolean(userId && userId.startsWith('guest_'));
}

export interface SaraProjectState {
  projectId: string;
  projectName: string;
  projectType: ProjectType;
  goal: string;
  lastStepDone: string;
  nextStep: string;
  filesList: string[];
  missingFeatures: string[];
  contract?: BuilderProjectContract | null;
  updatedAt: string;
}

export function isProjectBlank(files?: ProjectFiles): boolean {
  if (!files) return true;
  const entries = Object.entries(files).filter(([path]) => path.toLowerCase() !== 'readme.md');
  if (entries.length === 0) return true;
  return entries.every(([, content]) => !content || !content.trim());
}

export function loadActiveProjectState(projectId?: string, userId?: string): SaraProjectState | null {
  if (isGuestUser(userId)) return null;
  try {
    if (projectId) {
      const mapRaw = localStorage.getItem(scopedMapKey(userId));
      if (mapRaw) {
        const map = JSON.parse(mapRaw) as Record<string, SaraProjectState>;
        if (map && map[projectId]) return map[projectId];
      }
    }
    const raw = localStorage.getItem(scopedStateKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaraProjectState;
    if (projectId && parsed.projectId && parsed.projectId !== projectId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveProjectState(state: SaraProjectState, userId?: string): void {
  if (isGuestUser(userId)) return;
  try {
    localStorage.setItem(scopedStateKey(userId), JSON.stringify(state));
    const mapRaw = localStorage.getItem(scopedMapKey(userId));
    const map: Record<string, SaraProjectState> = mapRaw ? JSON.parse(mapRaw) : {};
    map[state.projectId] = state;
    localStorage.setItem(scopedMapKey(userId), JSON.stringify(map));
  } catch {
    // ignore storage quota
  }
}

export function updateProjectStateFromRecord(
  project: ProjectRecord,
  overrides?: Partial<Omit<SaraProjectState, 'projectId' | 'filesList' | 'updatedAt'>>,
  userId?: string
): SaraProjectState {
  const existing = loadActiveProjectState(project.id, userId);
  const filesList = Object.keys(project.files || {}).sort();
  const resolvedContract =
    overrides && 'contract' in overrides ? overrides.contract : existing?.contract;
  const next: SaraProjectState = {
    projectId: project.id,
    projectName: overrides?.projectName || project.name,
    projectType: overrides?.projectType || project.type,
    goal: overrides?.goal || existing?.goal || project.name,
    lastStepDone:
      overrides?.lastStepDone ||
      existing?.lastStepDone ||
      (filesList.length > 2 ? `Estrutura com ${filesList.length} ficheiro(s)` : 'Projeto iniciado'),
    nextStep: overrides?.nextStep || existing?.nextStep || 'Expandir funcionalidades e testar fluxos',
    filesList,
    missingFeatures: overrides?.missingFeatures ?? existing?.missingFeatures ?? [],
    contract: resolvedContract,
    updatedAt: new Date().toISOString(),
  };
  saveProjectState(next, userId);
  return next;
}

export function mergeProjectStatesMap(
  remoteStates: Record<string, SaraProjectState>,
  activeProjectId?: string,
  userId?: string
): void {
  if (isGuestUser(userId)) return;
  if (!remoteStates || Object.keys(remoteStates).length === 0) return;
  try {
    const mapRaw = localStorage.getItem(scopedMapKey(userId));
    const localMap: Record<string, SaraProjectState> = mapRaw ? JSON.parse(mapRaw) : {};
    const merged: Record<string, SaraProjectState> = { ...localMap };

    for (const [id, remote] of Object.entries(remoteStates)) {
      const local = merged[id];
      const remoteMs = Date.parse(remote?.updatedAt || '') || 0;
      const localMs = Date.parse(local?.updatedAt || '') || 0;
      if (!local || remoteMs >= localMs) {
        merged[id] = remote;
      }
    }

    localStorage.setItem(scopedMapKey(userId), JSON.stringify(merged));
    if (activeProjectId && merged[activeProjectId]) {
      localStorage.setItem(scopedStateKey(userId), JSON.stringify(merged[activeProjectId]));
    }
  } catch {
    // ignore storage quota
  }
}

