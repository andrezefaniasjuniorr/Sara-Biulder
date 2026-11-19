import type { ProjectFiles } from '../types/builder';

function sortJsFilesForExecution(paths: string[]): string[] {
  const rank = (p: string) => {
    const lower = p.toLowerCase();
    if (lower.includes('config') || lower.includes('firebase')) return 1;
    if (lower.includes('data') || lower.includes('store') || lower.includes('state')) return 2;
    if (lower.includes('service') || lower.includes('util') || lower.includes('audio')) return 3;
    if (lower.includes('component')) return 4;
    if (lower.endsWith('app.js') || lower.endsWith('main.js') || lower.endsWith('index.js')) return 9;
    return 5;
  };
  return [...paths].sort((a, b) => rank(a) - rank(b));
}

function processJsForPreview(files: ProjectFiles, jsPaths: string[]): {
  externalImports: string[];
  bodyJs: string;
} {
  const externalImports: string[] = [];
  const seenImports = new Set<string>();
  const chunks: string[] = [];

  for (const filePath of jsPaths) {
    let code = files[filePath] || '';
    // Remove importações locais relativas (ex: import ... from './utils.js')
    code = code
      .replace(/^\s*import\s+[\s\S]*?from\s+['"]\.\.?\/[^'"]+['"];?\s*$/gm, '')
      .replace(/^\s*import\s+['"]\.\.?\/[^'"]+['"];?\s*$/gm, '')
      .replace(/^\s*export\s+(default\s+)?/gm, '');

    // Extrai importações remotas CDN (ex: Firebase CDN) para o topo do <script type="module">
    code = code.replace(
      /^\s*import\s+(?:[\s\S]*?from\s+)?['"](https?:\/\/[^'"]+)['"];?\s*$/gm,
      (fullLine) => {
        const cleanLine = fullLine.trim();
        if (!seenImports.has(cleanLine)) {
          seenImports.add(cleanLine);
          externalImports.push(cleanLine);
        }
        return '';
      }
    );

    code = code.replace(/<\/script>/gi, '<\\/script>');
    if (code.trim()) {
      chunks.push(`// === ${filePath} ===\n${code}`);
    }
  }

  return {
    externalImports,
    bodyJs: chunks.join('\n\n'),
  };
}

/**
 * Gera o documento HTML isolado (srcdoc) para o iframe de Preview ao Vivo,
 * suportando estrutura dinâmica com múltiplas pastas e ficheiros (.html, .css, .js, .json).
 */
export function buildPreviewSrcDoc(files: ProjectFiles): string {
  const entries = Object.entries(files || {});
  const htmlEntry =
    files['index.html'] !== undefined
      ? files['index.html']
      : entries.find(([p]) => p.toLowerCase().endsWith('.html'))?.[1] || '';

  const cssEntries = entries
    .filter(([p]) => p.toLowerCase().endsWith('.css'))
    .map(([, content]) => content)
    .filter(Boolean);

  const jsPaths = sortJsFilesForExecution(
    entries
      .filter(([p, content]) => p.toLowerCase().endsWith('.js') && Boolean(content?.trim()))
      .map(([p]) => p)
  );

  const rawHtml = (htmlEntry || '').trim();
  const isBlank = !rawHtml && cssEntries.every((c) => !c.trim()) && jsPaths.length === 0;

  let extraHeadTags = '';
  let bodyContent = rawHtml;

  if (isBlank) {
    bodyContent = `
      <div class="min-h-screen bg-[#0A0A0F] text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3B82F6]/20 to-[#8B5CF6]/20 border border-[#3B82F6]/30 flex items-center justify-center mb-4">
          <i data-lucide="sparkles" class="w-5 h-5 text-[#3B82F6]"></i>
        </div>
        <h1 class="text-base font-bold text-white mb-1.5">Projeto pronto do zero</h1>
        <p class="text-xs text-[#A1A1AA] max-w-xs leading-relaxed">
          Pede à Sara no chat ou envia ficheiros do teu dispositivo. A estrutura de pastas adapta-se ao que criares.
        </p>
      </div>
    `;
  } else {
    // Preserva links CDN externos, scripts CDN e <style> declarados no <head> do index.html gerado (sem duplicar CDNs base)
    const headMatch = rawHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    if (headMatch) {
      const headInner = headMatch[1];
      const isAlreadyIncluded = (tag: string) =>
        /cdn\.tailwindcss\.com|unpkg\.com\/lucide|cdn\.jsdelivr\.net\/npm\/chart\.js|fonts\.googleapis\.com/i.test(
          tag
        );
      const externalLinks = (
        headInner.match(/<link[^>]+href=["']https?:\/\/[^"']+["'][^>]*>/gi) || []
      ).filter((t) => !isAlreadyIncluded(t));
      const externalScripts = (
        headInner.match(/<script[^>]+src=["']https?:\/\/[^"']+["'][^>]*>\s*<\/script>/gi) || []
      ).filter((t) => !isAlreadyIncluded(t));
      const inlineStyles = headInner.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
      extraHeadTags = [...externalLinks, ...externalScripts, ...inlineStyles].join('\n  ');
    }

    const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      bodyContent = bodyMatch[1];
    } else {
      bodyContent = rawHtml
        .replace(/<!doctype[^>]*>/gi, '')
        .replace(/<\/?html[^>]*>/gi, '')
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    }

    // Remove links CSS locais e scripts JS locais para não gerar erro 404 dentro do srcdoc
    bodyContent = bodyContent
      .replace(/<link[^>]+href=["'](?!https?:\/\/)[^"']+\.css["'][^>]*>/gi, '')
      .replace(/<script[^>]+src=["'](?!https?:\/\/)[^"']+\.js["'][^>]*>\s*<\/script>/gi, '');
  }

  const combinedCss = cssEntries.join('\n\n');

  // Disponibiliza ficheiros .json do projeto em window.__SARA_PROJECT_FILES__
  const jsonMap: Record<string, string> = {};
  for (const [p, content] of entries) {
    if (p.toLowerCase().endsWith('.json')) {
      jsonMap[p] = content;
    }
  }

  const { externalImports, bodyJs } = processJsForPreview(files, jsPaths);
  const useModuleScript = externalImports.length > 0;

  const userScriptBlock = bodyJs.trim()
    ? useModuleScript
      ? `<script type="module">\n${externalImports.join('\n')}\n\n${bodyJs}\n</script>`
      : `<script>\ntry {\n${bodyJs}\n} catch (err) {\n  console.error('Erro de execução:', err && err.message ? err.message : err);\n}\n</script>`
    : '';

  const bridgeScript = `
    (function() {
      window.__SARA_PROJECT_FILES__ = ${JSON.stringify(jsonMap).replace(/<\/script>/gi, '<\\/script>')};
      const send = (level, args) => {
        try {
          const message = args.map((arg) => {
            if (arg instanceof Error) return arg.stack || arg.message;
            if (typeof arg === 'object' && arg !== null) {
              try { return JSON.stringify(arg, null, 2); } catch { return String(arg); }
            }
            return String(arg);
          }).join(' ');
          window.parent.postMessage({ source: 'sara-preview-console', level, message }, '*');
        } catch (e) {}
      };

      const origLog = console.log;
      const origInfo = console.info;
      const origWarn = console.warn;
      const origError = console.error;

      console.log = function(...args) { send('log', args); origLog.apply(console, args); };
      console.info = function(...args) { send('info', args); origInfo.apply(console, args); };
      console.warn = function(...args) { send('warn', args); origWarn.apply(console, args); };
      console.error = function(...args) { send('error', args); origError.apply(console, args); };

      window.addEventListener('error', function(event) {
        const loc = event.lineno ? ' (linha ' + event.lineno + ')' : '';
        send('error', [(event.message || 'Erro de execução') + loc]);
      });

      window.addEventListener('unhandledrejection', function(event) {
        const reason = event.reason ? (event.reason.message || String(event.reason)) : 'Promise rejeitada';
        send('error', ['Promise Error: ' + reason]);
      });

      window.addEventListener('message', function(event) {
        if (!event.data || event.data.target !== 'sara-preview-eval') return;
        try {
          const result = (0, eval)(event.data.code);
          if (result !== undefined) {
            send('success', [typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)]);
          } else {
            send('success', ['Executado.']);
          }
        } catch (err) {
          send('error', [err && err.message ? err.message : String(err)]);
        }
      });

      function renderIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          try { window.lucide.createIcons(); } catch (e) {}
        }
      }

      window.addEventListener('DOMContentLoaded', function() {
        renderIcons();
        if (typeof MutationObserver !== 'undefined' && document.body) {
          let timer = null;
          const obs = new MutationObserver(function() {
            clearTimeout(timer);
            timer = setTimeout(renderIcons, 60);
          });
          obs.observe(document.body, { childList: true, subtree: true });
        }
      });
    })();
  `;

  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  ${extraHeadTags}
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
    ${combinedCss}
  </style>
  <script>${bridgeScript}</script>
</head>
<body>
  ${bodyContent}
  ${userScriptBlock}
</body>
</html>`;
}
