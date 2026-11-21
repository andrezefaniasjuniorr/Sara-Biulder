import type { ProjectFiles } from '../types/builder';
import { ensureDeployableIndexHtml } from './previewBuilder';
import { buildStandaloneHtml } from './zipService';

export function getSavedGitHubToken(): string {
  try {
    return localStorage.getItem('GITHUB_TOKEN') || '';
  } catch {
    return '';
  }
}

export function formatRepoSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'sara-biulder-projeto'
  );
}

export async function pushProjectToGitHub(params: {
  projectName: string;
  files: ProjectFiles;
  repoName?: string;
  isPrivate?: boolean;
  tokenOverride?: string;
}): Promise<{ ok: boolean; repoUrl: string; owner: string; repo: string; fileCount: number }> {
  const token = (params.tokenOverride || getSavedGitHubToken()).trim();
  if (!token) {
    throw new Error('Nenhum GitHub Token configurado.');
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  const userRes = await fetch('https://api.github.com/user', { headers });
  if (!userRes.ok) {
    throw new Error('Token GitHub inválido ou expirado.');
  }
  const ghUser = await userRes.json();
  const owner = ghUser.login;

  const cleanRepo = formatRepoSlug(params.repoName || params.projectName);
  const createRes = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: cleanRepo,
      description: `Criado na SARA BIULDER por Eletro-Jr`,
      private: Boolean(params.isPrivate),
      auto_init: false,
    }),
  });

  if (!createRes.ok && createRes.status !== 422) {
    const errData = await createRes.json().catch(() => ({}));
    throw new Error(errData.message || 'Falha ao criar repositório no GitHub.');
  }

  const uploadMap: Record<string, string> = {};
  let hasIndexHtml = false;
  for (const [key, content] of Object.entries(params.files || {})) {
    const cleanKey = key.replace(/^\/+/, '');
    if (cleanKey === 'index.html') {
      hasIndexHtml = true;
      uploadMap[cleanKey] = ensureDeployableIndexHtml(params.files, params.projectName);
    } else {
      uploadMap[cleanKey] = content || '';
    }
  }
  if (!hasIndexHtml) {
    uploadMap['index.html'] = buildStandaloneHtml(params.files, params.projectName);
  }
  if (!uploadMap['README.md']) {
    uploadMap['README.md'] = `# ${params.projectName}\nCriado na SARA BIULDER por Eletro-Jr.`;
  }
  if (!uploadMap['_redirects']) {
    uploadMap['_redirects'] = '/* /index.html 200\n';
  }

  const fileEntries = Object.entries(uploadMap);
  for (const [filePath, content] of fileEntries) {
    const encoded = btoa(unescape(encodeURIComponent(content || '')));

    let sha: string | undefined;
    const existingRes = await fetch(
      `https://api.github.com/repos/${owner}/${cleanRepo}/contents/${filePath}`,
      { headers }
    );
    if (existingRes.ok) {
      const existingJson = await existingRes.json();
      sha = existingJson.sha;
    }

    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${cleanRepo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `Deploy via SARA BIULDER (${filePath})`,
          content: encoded,
          ...(sha ? { sha } : {}),
        }),
      }
    );

    if (!putRes.ok) {
      const putErr = await putRes.json().catch(() => ({}));
      throw new Error(putErr.message || `Erro ao enviar ${filePath}`);
    }
  }

  return {
    ok: true,
    repoUrl: `https://github.com/${owner}/${cleanRepo}`,
    owner,
    repo: cleanRepo,
    fileCount: fileEntries.length,
  };
}
