import type { ProjectFiles, ProjectRecord, ProjectType } from '../types/builder';

export const SARA_PROJECT_STATE_KEY = 'sara_estado_projeto';
export const SARA_PROJECT_STATES_MAP_KEY = 'sara_estado_projetos_map';

export interface SaraProjectState {
  projectId: string;
  projectName: string;
  projectType: ProjectType;
  goal: string;
  lastStepDone: string;
  nextStep: string;
  filesList: string[];
  missingFeatures: string[];
  updatedAt: string;
}

export function isProjectBlank(files?: ProjectFiles): boolean {
  if (!files) return true;
  const entries = Object.entries(files).filter(([path]) => path.toLowerCase() !== 'readme.md');
  if (entries.length === 0) return true;
  return entries.every(([, content]) => !content || !content.trim());
}

export function loadActiveProjectState(projectId?: string): SaraProjectState | null {
  try {
    if (projectId) {
      const mapRaw = localStorage.getItem(SARA_PROJECT_STATES_MAP_KEY);
      if (mapRaw) {
        const map = JSON.parse(mapRaw) as Record<string, SaraProjectState>;
        if (map && map[projectId]) return map[projectId];
      }
    }
    const raw = localStorage.getItem(SARA_PROJECT_STATE_KEY);
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

export function saveProjectState(state: SaraProjectState): void {
  try {
    localStorage.setItem(SARA_PROJECT_STATE_KEY, JSON.stringify(state));
    const mapRaw = localStorage.getItem(SARA_PROJECT_STATES_MAP_KEY);
    const map: Record<string, SaraProjectState> = mapRaw ? JSON.parse(mapRaw) : {};
    map[state.projectId] = state;
    localStorage.setItem(SARA_PROJECT_STATES_MAP_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota
  }
}

export function updateProjectStateFromRecord(
  project: ProjectRecord,
  overrides?: Partial<Omit<SaraProjectState, 'projectId' | 'filesList' | 'updatedAt'>>
): SaraProjectState {
  const existing = loadActiveProjectState(project.id);
  const filesList = Object.keys(project.files || {}).sort();
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
    updatedAt: new Date().toISOString(),
  };
  saveProjectState(next);
  return next;
}

export function mergeProjectStatesMap(
  remoteStates: Record<string, SaraProjectState>,
  activeProjectId?: string
): void {
  if (!remoteStates || Object.keys(remoteStates).length === 0) return;
  try {
    const mapRaw = localStorage.getItem(SARA_PROJECT_STATES_MAP_KEY);
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

    localStorage.setItem(SARA_PROJECT_STATES_MAP_KEY, JSON.stringify(merged));
    if (activeProjectId && merged[activeProjectId]) {
      localStorage.setItem(SARA_PROJECT_STATE_KEY, JSON.stringify(merged[activeProjectId]));
    }
  } catch {
    // ignore storage quota
  }
}

