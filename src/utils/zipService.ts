import JSZip from 'jszip';
import type { ProjectFiles } from '../types/builder';

export function buildStandaloneHtml(files: ProjectFiles, projectTitle = 'Projeto SARA BIULDER'): string {
  const entries = Object.entries(files || {});
  const rawHtml =
    files['index.html'] !== undefined
      ? files['index.html']
      : entries.find(([p]) => p.toLowerCase().endsWith('.html'))?.[1] || '';

  let bodyContent = rawHtml;
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    bodyContent = bodyMatch[1];
  } else {
    bodyContent = rawHtml
      .replace(/<!doctype[^>]*>/gi, '')
      .replace(/<\/?html[^>]*>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
  }

  bodyContent = bodyContent
    .replace(/<link[^>]+href=["'](?!https?:\/\/)[^"']+\.css["'][^>]*>/gi, '')
    .replace(/<script[^>]+src=["'](?!https?:\/\/)[^"']+\.js["'][^>]*>\s*<\/script>/gi, '');

  const allCss = entries
    .filter(([p]) => p.toLowerCase().endsWith('.css'))
    .map(([p, c]) => `/* ${p} */\n${c}`)
    .join('\n\n');

  const allJs = entries
    .filter(([p]) => p.toLowerCase().endsWith('.js'))
    .map(([p, c]) => `// ${p}\n${c.replace(/^\s*import\s+[\s\S]*?from\s+['"]\.\.?\/[^'"]+['"];?\s*$/gm, '').replace(/^\s*export\s+(default\s+)?/gm, '')}`)
    .join('\n\n');

  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectTitle}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
${allCss}
  </style>
</head>
<body>
${bodyContent}
  <script type="module">
${allJs}
  </script>
</body>
</html>`;
}

export async function downloadProjectZip(files: ProjectFiles, projectName: string): Promise<void> {
  const zip = new JSZip();
  const slug =
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'sara-projeto';

  const entries = Object.entries(files || {});
  const cssLinks = entries
    .filter(([p]) => p.toLowerCase().endsWith('.css'))
    .map(([p]) => `  <link rel="stylesheet" href="./${p.replace(/^\/+/, '')}" />`)
    .join('\n');
  const jsScripts = entries
    .filter(([p]) => p.toLowerCase().endsWith('.js'))
    .map(([p]) => `  <script type="module" src="./${p.replace(/^\/+/, '')}"></script>`)
    .join('\n');

  for (const [pathKey, content] of entries) {
    const cleanPath = pathKey.replace(/^\/+/, '');
    if (cleanPath === 'index.html') {
      const hasDoctype = /<!doctype/i.test(content);
      if (hasDoctype) {
        zip.file(cleanPath, content);
      } else {
        const runnableHtml = `<!doctype html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
${cssLinks}
</head>
<body>
${content}
${jsScripts}
</body>
</html>`;
        zip.file(cleanPath, runnableHtml);
      }
    } else {
      zip.file(cleanPath, content || '');
    }
  }

  if (!files['README.md']) {
    zip.file('README.md', `# ${projectName}\nCriado na SARA BIULDER por Eletro-Jr.`);
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
  const allowedExt = /\.(html|css|js|jsx|ts|tsx|json|md|txt|svg|csv)$/i;

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
