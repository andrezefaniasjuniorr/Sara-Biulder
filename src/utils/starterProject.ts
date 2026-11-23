import type { ProjectFiles, ProjectRecord } from '../types/builder';

export const EMPTY_PROJECT_FILES: ProjectFiles = {
  'index.html': '',
  'README.md': '# Novo Projeto\n\nCriado no **Estúdio SARA** por **Eletro-Jr**.',
};

export function createStarterProject(
  name = 'Novo Projeto',
  type: ProjectRecord['type'] = 'Site'
): ProjectRecord {
  const now = new Date().toISOString();
  return {
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    type,
    files: { ...EMPTY_PROJECT_FILES },
    createdAt: now,
    updatedAt: now,
    syncedToFirebase: false,
  };
}
