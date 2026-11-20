import type { ProjectFiles } from '../types/builder';

function sortScriptFilesForExecution(paths: string[]): string[] {
  const rank = (p: string) => {
    const lower = p.toLowerCase();
    if (lower.includes('config') || lower.includes('firebase')) return 1;
    if (lower.includes('data') || lower.includes('store') || lower.includes('state')) return 2;
    if (lower.includes('util') || lower.includes('format') || lower.includes('helper')) return 3;
    if (lower.includes('service') || lower.includes('auth') || lower.includes('pagamento')) return 4;
    if (lower.includes('engine')) return 5;
    if (lower.includes('render')) return 6;
    if (lower.includes('component')) return 7;
    if (lower.includes('scene')) return 8;
    if (lower.includes('page')) return 9;
    if (
      lower.endsWith('app.js') ||
      lower.endsWith('main.js') ||
      lower.endsWith('index.js') ||
      lower.endsWith('app.jsx') ||
      lower.endsWith('app.tsx') ||
      lower.endsWith('main.ts') ||
      lower.endsWith('main.tsx') ||
      lower.includes('/app/')
    )
      return 11;
    return 7;
  };
  return [...paths].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function processScriptsForPreview(files: ProjectFiles, scriptPaths: string[]): {
  externalImports: string[];
  bodyJs: string;
  usesBabel: boolean;
} {
  const externalImports: string[] = [];
  const seenImports = new Set<string>();
  const chunks: string[] = [];
  const usesBabel = scriptPaths.some((p) => /\.(jsx|tsx|ts)$/i.test(p));

  for (const filePath of scriptPaths) {
    let code = files[filePath] || '';
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

    // Remove importações locais relativas ou absolutas entre pastas e declarações export
    code = code
      .replace(/^\s*import\s+(?:type\s+)?[\s\S]*?\sfrom\s+['"](?:\.\.?\/|\/|@\/)[^'"]+['"];?[ \t]*/gm, '')
      .replace(/^\s*import\s+['"](?:\.\.?\/|\/|@\/)[^'"]+['"];?[ \t]*/gm, '')
      .replace(/^\s*export\s+\{[^}]*\};?[ \t]*/gm, '')
      .replace(/^\s*export\s+default\s+/gm, '')
      .replace(/^\s*export\s+(?=(async\s+)?function|const|let|var|class|interface|type|enum)/gm, '');

    code = code.replace(/<\/script>/gi, '<\\/script>');
    if (code.trim()) {
      chunks.push(`// === ${filePath} ===\n${code}`);
    }
  }

  return {
    externalImports,
    bodyJs: chunks.join('\n\n'),
    usesBabel,
  };
}

/**
 * Gera o documento HTML isolado (srcdoc) para o iframe de Preview ao Vivo,
 * suportando estrutura dinâmica com múltiplas pastas e linguagens
 * (.html, .css, .js, .jsx, .ts, .tsx, .py, .json, .svg) + bibliotecas profissionais de gráficos & 3D.
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

  const scriptPaths = sortScriptFilesForExecution(
    entries
      .filter(
        ([p, content]) =>
          /\.(js|jsx|ts|tsx|mjs)$/i.test(p) && Boolean(content?.trim())
      )
      .map(([p]) => p)
  );

  const pythonFiles = entries.filter(
    ([p, content]) => p.toLowerCase().endsWith('.py') && Boolean(content?.trim())
  );

  const rawHtml = (htmlEntry || '').trim();
  const isBlank =
    !rawHtml &&
    cssEntries.every((c) => !c.trim()) &&
    scriptPaths.length === 0 &&
    pythonFiles.length === 0;

  let extraHeadTags = '';
  let bodyContent = rawHtml;

  if (isBlank) {
    bodyContent = `
      <div class="min-h-screen bg-[#0A0A0F] text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3B82F6]/20 to-[#8B5CF6]/20 border border-[#3B82F6]/30 flex items-center justify-center mb-4">
          <i data-lucide="sparkles" class="w-5 h-5 text-[#3B82F6]"></i>
        </div>
        <h1 class="text-base font-bold text-white mb-1.5">Projeto pronto para construir</h1>
        <p class="text-xs text-[#A1A1AA] max-w-xs leading-relaxed">
          Pede à Sara por voz ou chat. Suporte total a Web, Dashboards (ApexCharts, ECharts, Chart.js, D3), 3D (Three.js), React JSX/TS e Python.
        </p>
      </div>
    `;
  } else if (!rawHtml && pythonFiles.length > 0) {
    // Projeto Python puro: consola interativa no Preview via Pyodide WebAssembly
    bodyContent = `
      <div class="min-h-screen bg-[#0B0F17] text-slate-100 p-5 flex flex-col gap-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h1 class="text-sm font-bold text-emerald-400">Python Runtime (Pyodide WebAssembly)</h1>
            <p class="text-xs text-slate-400">${pythonFiles.map(([p]) => p).join(', ')}</p>
          </div>
          <button id="sara-run-py-btn" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer">
            Executar Python
          </button>
        </div>
        <pre id="sara-py-output" class="flex-1 p-4 rounded-xl bg-[#05080F] border border-slate-800 font-mono text-xs text-emerald-300 whitespace-pre-wrap overflow-auto">A carregar interpretador Python...</pre>
      </div>
    `;
  } else {
    // Preserva links CDN externos, scripts CDN e <style> declarados no <head> do index.html gerado (sem duplicar CDNs base)
    const headMatch = rawHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    if (headMatch) {
      const headInner = headMatch[1];
      const isAlreadyIncluded = (tag: string) =>
        /cdn\.tailwindcss\.com|unpkg\.com\/lucide|chart\.js|apexcharts|echarts|d3js\.org|d3@|three(?:\.min)?\.js|gsap|fonts\.googleapis\.com/i.test(
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

    // Remove links CSS locais e scripts JS/TS locais para não gerar erro 404 dentro do srcdoc
    bodyContent = bodyContent
      .replace(/<link[^>]+href=["'](?!https?:\/\/)[^"']+\.css["'][^>]*>/gi, '')
      .replace(/<script[^>]+src=["'](?!https?:\/\/)[^"']+\.(?:js|jsx|ts|tsx|mjs)["'][^>]*>\s*<\/script>/gi, '');
  }

  const combinedCss = cssEntries.join('\n\n');

  // Disponibiliza ficheiros .json, .csv, .sql e .py em window.__SARA_PROJECT_FILES__
  const projectDataMap: Record<string, string> = {};
  for (const [p, content] of entries) {
    if (/\.(json|csv|sql|py|txt|md)$/i.test(p)) {
      projectDataMap[p] = content;
    }
  }

  const { externalImports, bodyJs, usesBabel } = processScriptsForPreview(files, scriptPaths);
  const useModuleScript = externalImports.length > 0 && !usesBabel;
  const usesMermaid =
    /\bmermaid\b/i.test(rawHtml) || entries.some(([p]) => /\.(mmd|mermaid)$/i.test(p));
  const hasPython = pythonFiles.length > 0;

  const userScriptBlock = bodyJs.trim()
    ? usesBabel
      ? `<script type="text/babel" data-presets="react,typescript">\n${bodyJs}\n</script>`
      : useModuleScript
      ? `<script type="module">\n${externalImports.join('\n')}\n\n${bodyJs}\n</script>`
      : `<script>\ntry {\n${bodyJs}\n} catch (err) {\n  console.error('Erro de execução:', err && err.message ? err.message : err);\n}\n</script>`
    : '';

  const optionalBabelScripts = usesBabel
    ? `
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>`
    : '';

  const optionalMermaidScript = usesMermaid
    ? `<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>`
    : '';

  const pythonRuntimeBlock = hasPython
    ? `<script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"></script>
<script>
  (async function() {
    const outEl = document.getElementById('sara-py-output');
    const btnEl = document.getElementById('sara-run-py-btn');
    let pyInstance = null;
    async function execPython() {
      try {
        if (!pyInstance && typeof loadPyodide === 'function') {
          pyInstance = await loadPyodide();
        }
        if (!pyInstance) return;
        const filesMap = window.__SARA_PROJECT_FILES__ || {};
        const pyKeys = Object.keys(filesMap).filter((k) => k.endsWith('.py'));
        let output = '';
        pyInstance.setStdout({ batched: (msg) => { output += msg + '\\n'; } });
        pyInstance.setStderr({ batched: (msg) => { output += '[ERR] ' + msg + '\\n'; console.error(msg); } });
        for (const k of pyKeys) {
          await pyInstance.runPythonAsync(filesMap[k]);
        }
        if (outEl) outEl.textContent = output.trim() || 'Execução Python concluída sem saída no stdout.';
      } catch (err) {
        console.error('Python Error:', err && err.message ? err.message : err);
        if (outEl) outEl.textContent = 'Erro Python: ' + (err && err.message ? err.message : String(err));
      }
    }
    window.runPythonProject = execPython;
    if (btnEl) btnEl.addEventListener('click', execPython);
    if (outEl) execPython();
  })();
</script>`
    : '';

  const bridgeScript = `
    (function() {
      window.__SARA_PROJECT_FILES__ = ${JSON.stringify(projectDataMap).replace(/<\/script>/gi, '<\\/script>')};
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
        if (window.mermaid && typeof window.mermaid.initialize === 'function') {
          try { window.mermaid.initialize({ startOnLoad: true, theme: 'dark' }); } catch (e) {}
        }
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
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&family=Playfair+Display:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  ${optionalMermaidScript}
  ${optionalBabelScripts}
  ${extraHeadTags}
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
    .tabular-nums { font-variant-numeric: tabular-nums; }
    ${combinedCss}
  </style>
  <script>${bridgeScript}</script>
</head>
<body>
  ${bodyContent}
  ${userScriptBlock}
  ${pythonRuntimeBlock}
</body>
</html>`;
}
