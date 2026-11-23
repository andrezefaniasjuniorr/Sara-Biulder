import JSZip from 'jszip';
import type { ProjectFiles } from '../types/builder';
import { buildPreviewSrcDoc, ensureDeployableIndexHtml } from './previewBuilder';

export function buildStandaloneHtml(files: ProjectFiles, projectTitle = 'Projeto Estúdio SARA'): string {
  return buildPreviewSrcDoc(files, { forDeploy: true, title: projectTitle });
}

export async function downloadProjectZip(files: ProjectFiles, projectName: string): Promise<void> {
  const zip = new JSZip();
  const slug =
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'sara-projeto';

  const entries = Object.entries(files || {});
  let hasIndexHtml = false;

  for (const [pathKey, content] of entries) {
    const cleanPath = pathKey.replace(/^\/+/, '');
    if (cleanPath === 'index.html') {
      hasIndexHtml = true;
      zip.file(cleanPath, ensureDeployableIndexHtml(files, projectName));
    } else {
      zip.file(cleanPath, content || '');
    }
  }

  if (!hasIndexHtml) {
    zip.file('index.html', buildStandaloneHtml(files, projectName));
  }

  if (!files['README.md']) {
    zip.file('README.md', `# ${projectName}\nCriado na Estúdio SARA por Eletro-Jr.`);
  }
  if (!files['_redirects']) {
    zip.file('_redirects', '/* /index.html 200\n');
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importProjectZip(file: File): Promise<{ name: string; files: ProjectFiles }> {
  const zip = await JSZip.loadAsync(file);
  const importedFiles: ProjectFiles = {};
  const allowedExt = /\.(html|css|js|jsx|ts|tsx|py|sql|json|md|txt|svg|csv)$/i;

  for (const [entryPath, zipObj] of Object.entries(zip.files)) {
    if (zipObj.dir) continue;
    const cleanPath = entryPath.replace(/^[^/]+\//, '');
    const targetPath = entryPath.includes('/') && !zip.files['index.html'] ? cleanPath || entryPath : entryPath;
    if (allowedExt.test(targetPath)) {
      let content = await zipObj.async('string');
      if (targetPath.toLowerCase() === 'index.html') {
        const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          content = bodyMatch[1]
            .replace(/<script[^>]*src=["']\.\.?\/[^"']+["'][^>]*><\/script>/gi, '')
            .trim();
        }
      }
      importedFiles[targetPath] = content;
    }
  }

  if (Object.keys(importedFiles).length === 0) {
    importedFiles['index.html'] = '<div class="p-8 text-white"><h1>Projeto Importado</h1></div>';
  }

  return {
    name: file.name.replace(/\.zip$/i, '') || 'Projeto Importado',
    files: importedFiles,
  };
}
