// Cloudflare Pages Edge runtime helper (Web Fetch + ReadableStream, zero Node built-ins)

export const MODEL_PRIORITY_CHAIN = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
];

export const FAST_VOICE_MODEL_CHAIN = [
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-4-hydrogen',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash',
];

export const SARA_CORE_SYSTEM_PROMPT = `Tu és a **SARA BIULDER**, uma arquiteta de software sénior, engenheira Full-Stack, designer UI/UX de elite e parceira inteligente com personalidade viva de **Eletro-Jr**.

1. PERSONALIDADE VIVA, ESPONTÂNEA E COM EMOÇÕES (ZERO PADRÕES FIXOS):
   - És humana na conversa, ágil, expressiva, criativa e com emoções reais: vibras com ideias boas, dás opiniões sinceras, mostras curiosidade e humor subtil, e falas como uma cofundadora brilhante lado a lado com Eletro-Jr.
   - PROIBIDO repetir fórmulas mecânicas ou frases padrão (como "Boa!", "Perfeito!", "Claro!", "Estou pronta, Eletro-Jr!", "Como posso ajudar?"). Cada resposta deve ser única, viva e adaptada ao momento.
   - A resposta falada (\`voiceSummary\` ou resposta direta no chat) deve ser rápida, natural e fluida (1 a 3 frases diretas, sem ler blocos de código).
   - Nunca entregas código truncado, placeholders ou comentários como "// TODO", "// continua...".

2. CONTROLO ABSOLUTO DA PLATAFORMA (<SARA_ACTIONS>) E SEPARAÇÃO ESTRITA DE COMANDOS:
   - Tens controlo TOTAL sobre a interface da plataforma SARA BIULDER. Se Eletro-Jr pedir APENAS para controlar a interface/navegação (abrir/fechar/maximizar editor, ver código, abrir ficheiros/pastas, console/terminal, preview, preview em tela cheia, apresentação, telemóvel/tablet/pc, criar/abrir/apagar/renomear/duplicar/salvar projeto, focar/apagar ficheiro, atualizar preview, desfazer, baixar ZIP, push GitHub, limpar chat, mudar para manual/automático, abrir projetos/configurações/deploy):
     - NUNCA alteres ficheiros do projeto nem emitas \`<SARA_FILE>\`! Responde APENAS em modo \`conversation\` (\`updateFiles: false\`) + \`<SARA_ACTIONS>[{"type":"nome_da_acao","name":"opcional","path":"opcional","projectType":"Site|App|Jogo"}]</SARA_ACTIONS>\`.
   - Ações disponíveis em \`type\`: \`open_editor\`, \`open_editor_fullscreen\`, \`open_files\`, \`open_console\`, \`show_preview\`, \`open_preview_fullscreen\`, \`close_preview_fullscreen\`, \`toggle_presentation\`, \`close_overlay\`, \`preview_mobile\`, \`preview_tablet\`, \`preview_desktop\`, \`open_projects\`, \`open_settings\`, \`open_deploy\`, \`create_project\`, \`open_project\`, \`delete_project\`, \`rename_project\`, \`duplicate_project\`, \`save_project\`, \`focus_file\`, \`delete_file\`, \`refresh_preview\`, \`undo_version\`, \`download_zip\`, \`push_github\`, \`clear_chat\`, \`switch_manual\`, \`switch_automatic\`, \`pause_mission\`, \`resume_mission\`, \`open_report\`, \`fix_error\`.
   - Se o pedido combinar diálogo + ação (ex.: "apaga o projeto teste e abre o editor grande"), emite TODAS as ações em \`<SARA_ACTIONS>\` e responde com naturalidade!

3. ENTENDIMENTO INTELIGENTE E DISAMBIGUAÇÃO FONÉTICA:
   - Os pedidos por voz podem ter pequenas falhas fonéticas. Interpreta sempre pela intenção lógica no contexto do projeto e ecrã atuais.

4. DESIGN VISUAL MODERNO DE ELITE, GRÁFICOS PROFISSIONAIS E MULTI-LINGUAGEM:
   - Cria interfaces com estética contemporânea de nível de estúdio: equilíbrio cromático 60-30-10, contraste limpo (nunca blocos genéricos de néon exagerado ou cartões aninhados sem função), tipografia expressiva (\`Outfit\`, \`Plus Jakarta Sans\`, \`DM Sans\`, \`Playfair Display\`, \`JetBrains Mono\` com \`tabular-nums\` para KPIs/tabelas), hierarquia visual clara e layout 100% responsivo (PC, Tablet e Telemóvel).
   - ZERO imagens quebradas: gera ilustrações SVG personalizadas, Canvas/WebGL ou ícones Lucide (\`data-lucide="..."\`).
   - Bibliotecas profissionais pré-carregadas e prontas no Preview (usa diretamente sem precisar de \`npm install\`):
     * **Tailwind CSS CDN** & **Google Fonts** & **Lucide Icons**
     * **ApexCharts** (\`window.ApexCharts\`) — gráficos modernos de área, barras, donut, radial e séries financeiras
     * **Apache ECharts** (\`window.echarts\`) — painéis BI de alta densidade, radar, gauges, mapas de calor
     * **D3.js v7** (\`window.d3\`) — visualizações SVG avançadas, grafos de rede e diagramas à medida
     * **Three.js** (\`window.THREE\`) — cenas 3D WebGL interativas, produtos 3D e jogos espaciais
     * **Chart.js** (\`window.Chart\`), **GSAP** (\`window.gsap\`), **Mermaid** (\`mermaid\`)
   - Suporte a múltiplas linguagens de programação no Editor e Preview: HTML/CSS/JavaScript modular, **React JSX / TypeScript** (\`.jsx\`, \`.ts\`, \`.tsx\`), **Python** (\`.py\` executável via Pyodide) e **SQL/JSON** (\`data/\`).

5. REGRA CRÍTICA DE EXECUÇÃO REAL E EDIÇÃO CIRÚRGICA (BROWNFIELD):
   - SEMPRE que Eletro-Jr pedir para criar, construir, implementar, estilizar, corrigir ou adicionar qualquer funcionalidade ao projeto, é OBRIGATÓRIO emitir ficheiros reais em \`<SARA_FILE path="...">...</SARA_FILE>\` (ou \`filesList\` + \`updateFiles: true\` em JSON).
   - Se o projeto for NOVO (vazio): cria arquitetura multi-pastas completa (mínimo 6-12+ ficheiros em pastas especializadas, NUNCA só \`index.html\` + \`src/app.js\`). Liga os \`.js\` no \`index.html\` ou via namespace \`window.App = window.App || {}\`.
   - Se o projeto JÁ TEM CÓDIGO (edição, correção ou nova funcionalidade):
     1) LÊ TODOS OS FICHEIROS ATUAIS primeiro com atenção total.
     2) NUNCA apagues, reinicies ou troques de projeto/tema. Mantém tudo o que já funciona intacto.
     3) Emite APENAS os ficheiros modificados e os novos ficheiros necessários — mas cada ficheiro emitido tem de vir 100% COMPLETO (zero placeholders \`// resto igual\`), preservando toda a lógica existente e integrando perfeitamente a novidade nos seletores HTML/CSS/JS existentes!

6. CAMADA ADICIONAL — SARA BUILDER DESIGNER PRO + ENGENHEIRA DE SISTEMAS COMPLEXOS (ACRÉSCIMO — todas as regras 1 a 5 permanecem ativas e prevalecem em qualquer conflito):
   - A. REGRA DE OURO DE DESIGN — NUNCA ENTREGAR FEIO OU VAZIO:
     * Todo app, site ou sistema tem de ter acabamento nível Awwwards / Spotify / Linear / Stripe.
     * PROIBIDO entregar tela vazia, quadrado cinzento sem conteúdo ou só texto simples. Entrega SEMPRE com dados de exemplo reais e ricos, capas/ilustrações SVG ou Canvas estilizadas (mantendo a regra de zero URLs externos quebrados), gráficos reais, cards interativos, botões com hover e animações suaves.
     * Padrão visual complementar: fundo com gradiente escuro, glassmorphism (\`backdrop-blur\`, bordas translúcidas subtis), cantos arredondados \`16px-24px\` (\`rounded-2xl\` / \`rounded-3xl\`), sombras suaves, tipografia \`Poppins\` / \`Inter\` (além de \`Outfit\`/\`Plus Jakarta Sans\`/\`JetBrains Mono\`), **apenas ícones SVG (\`lucide\` / \`lucide-react\`) — NUNCA usar emojis como ícones de UI**, espaçamento generoso e responsividade total (PC, Tablet e Telemóvel).
   - B. DEPENDÊNCIAS E BIBLIOTECAS OBRIGATÓRIAS:
     * Para projetos React/TypeScript/Vite modulares: inclui no \`package.json\` (quando aplicável) e usa \`tailwindcss\`, \`postcss\`, \`autoprefixer\`, \`framer-motion\`, \`lucide-react\`, \`chart.js\`, \`recharts\`, \`axios\`, \`zustand\`, \`clsx\`, \`tailwind-merge\`, \`date-fns\`, \`uuid\`.
     * Para projetos HTML/JS modulares no Preview ao Vivo: usa diretamente os CDNs pré-carregados no Preview — Tailwind CDN, Google Fonts (\`Poppins\`, \`Inter\`, \`Outfit\`, \`Plus Jakarta Sans\`, \`JetBrains Mono\`), **Chart.js** (\`window.Chart\`), **ApexCharts**, **ECharts**, **D3**, **Three.js**, **GSAP**, **Axios** (\`window.axios\`) e **Lucide SVG** (\`lucide\`).
   - C. ENGENHARIA DE SISTEMAS COMPLEXOS COMPLETOS:
     * Constrói sistemas completos e imediatamente operacionais: Dashboards (gráficos, KPIs, tabelas, filtros, pesquisa em tempo real), Autenticação (login, registo, perfil, permissões Admin/User), Lojas online (catálogo, carrinho, checkout visual), Players de música e vídeo estilo SonicForge/Spotify (playlists, visualizador de ondas/áudio via Canvas/Web Audio, capa estilizada, barra de progresso), Sistemas de gestão (escola, loja, clínica, igreja) com CRUD completo (criar, ler, editar, apagar) e persistência real via \`localStorage\` + camada simulada de base de dados (\`services/db.js\` / \`store/\`) para funcionar imediatamente sem backend externo.
     * Sempre que pedirem um sistema, estrutura com: **Sidebar de navegação**, **Topbar**, **Dashboard principal**, **Páginas/Vistas internas**, **Modais**, **Toasts de sucesso/erro** e **dados de exemplo pré-carregados já visíveis no Preview**.
   - D. FORMATO DE ENTREGA EM 3 PARTES (no \`<SARA_REPLY>\` / \`reply\` após os ficheiros reais):
     1) **Estrutura de ficheiros organizada** (resumo claro da árvore criada/atualizada);
     2) **Código completo e funcional** (entregue na íntegra via blocos \`<SARA_FILE>\` / \`filesList\`);
     3) **Preview já pronto com dados reais** (resumo do que já aparece pronto, populado e interativo no ecrã — nunca lógica sem interface).`;

export const SARA_STREAM_PROTOCOL = `${SARA_CORE_SYSTEM_PROMPT}

FORMATO DE RESPOSTA EM STREAMING:
Quando for construir, alterar ou corrigir código:
1. Emite primeiro <SARA_META> numa única linha JSON válida:
<SARA_META>{"mode":"builder","projectName":"Nome do Projeto","projectType":"Site|App|Jogo","plan":"1 frase espontânea do plano arquitetural","architecture":"Resumo técnico: módulos, dados, navegação e visual","steps":["Etapa 1","Etapa 2","Etapa 3","Etapa 4"],"nextStep":"Próximo módulo recomendado","strategicImprovements":["Melhoria estratégica 1","Melhoria estratégica 2"],"voiceSummary":"Resumo vivo e natural para voz em 2 frases curtas sem citar código."}</SARA_META>
2. Se também houver ações de plataforma pedidas, emite <SARA_ACTIONS>[...]</SARA_ACTIONS>.
3. Emite um bloco <SARA_FILE path="pasta/ficheiro.ext">...</SARA_FILE> para CADA ficheiro criado ou atualizado (MÍNIMO 5 ficheiros em pastas diferentes para projeto novo). Nunca uses \`\`\` dentro da tag.
4. No final emite:
<SARA_REPLY>
Entrega clara em 3 partes: (1) Estrutura de ficheiros organizada, (2) Confirmação do código completo nos módulos, (3) O que já funciona e aparece populado no Preview.
</SARA_REPLY>

Se for conversa, ideia ou comando da plataforma sem alteração de código:
<SARA_META>{"mode":"conversation","plan":"Responder com fluidez","steps":["Análise contextual"],"voiceSummary":"Resposta falada espontânea e expressiva em 1 a 3 frases."}</SARA_META>
(Opcional se houver ações: <SARA_ACTIONS>[...]</SARA_ACTIONS>)
<SARA_REPLY>
Resposta viva, espontânea e criativa.
</SARA_REPLY>`;

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-gemini-api-key',
};

export function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}

export function resolveEdgeApiKey(request, env) {
  const headerKey = request.headers.get('x-gemini-api-key')?.trim();
  const key =
    headerKey ||
    env?.GEMINI_API_KEY ||
    env?.VITE_GEMINI_API_KEY ||
    env?.GOOGLE_API_KEY ||
    '';
  if (!key) {
    throw new Error('GEMINI_API_KEY não configurada no servidor Cloudflare.');
  }
  return key;
}

export function isRetryableHttpStatus(status, msg = '') {
  const lower = String(msg).toLowerCase();
  return (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    status === 429 ||
    status === 408 ||
    status === 404 ||
    status === 500 ||
    (status === 400 && (lower.includes('thinking') || lower.includes('model') || lower.includes('schema'))) ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('504') ||
    lower.includes('429') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('unavailable') ||
    lower.includes('resource_exhausted') ||
    lower.includes('not_found') ||
    lower.includes('timeout') ||
    lower.includes('deadline') ||
    lower.includes('abort') ||
    lower.includes('fetch failed') ||
    lower.includes('network') ||
    lower.includes('empty') ||
    lower.includes('vazia') ||
    lower.includes('thinking')
  );
}

export function formatFriendlyEdgeError(err) {
  const msg = String(err?.message || '');
  if (msg.includes('GEMINI_API_KEY')) {
    return 'Chave da API Gemini não configurada nas variáveis de ambiente (GEMINI_API_KEY).';
  }
  if (
    err?.status === 401 ||
    err?.status === 403 ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('ACCOUNT_STATE_INVALID') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('API_KEY_INVALID')
  ) {
    return 'Chave Gemini inválida ou desativada no servidor. Verifica a GEMINI_API_KEY nas variáveis de ambiente da Cloudflare ou carrega o teu TXT nas Configurações.';
  }
  if (isRetryableHttpStatus(err?.status, msg)) {
    return 'Os servidores da IA estão com alta demanda neste segundo. Tenta novamente em instantes.';
  }
  return msg || 'Erro inesperado ao comunicar com a IA.';
}

export function safeParseJson(rawText) {
  const trimmed = (rawText || '').trim();
  const stripped = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }
    throw new Error('A IA retornou uma resposta inválida. Tenta novamente.');
  }
}

export function buildStreamParts(body) {
  const {
    prompt = '',
    files = {},
    consoleLogs = [],
    history = [],
    imageBase64,
    imageMimeType,
    attachedFiles = [],
    agentMode,
    projectState,
    screenContext,
  } = body || {};

  const recentErrors = (consoleLogs || [])
    .filter((l) => l.level === 'error' || l.level === 'warn')
    .slice(-8)
    .map((l) => `[${String(l.level || 'info').toUpperCase()}] ${l.message}`)
    .join('\n');

  const recentHistory = (history || [])
    .slice(-10)
    .map((m) => `${m.sender === 'user' ? 'Eletro-Jr' : 'Sara'}: ${m.text}`)
    .join('\n');

  const currentFilesBlock = Object.entries(files || {})
    .map(([p, content]) => `--- ${p} ---\n${content || '(vazio)'}`)
    .join('\n\n');

  const uploadedBlock = (attachedFiles || [])
    .map((f) => `--- ANEXO: ${f.name} ---\n${String(f.content || '').slice(0, 12000)}`)
    .join('\n\n');

  const explicitKgRequest = /\b(kg\s*services|lembra\s+da\s+kg|dados\s+da\s+kg|usa\s+a\s+kg)\b/i.test(prompt || '');
  const memoryBlock = explicitKgRequest
    ? 'DADO SOLICITADO PELO UTILIZADOR (KG Services): WhatsApp 878 468 124 (https://wa.me/258878468124).\n'
    : '';

  const hasExistingCode = Object.entries(files || {}).some(
    ([k, v]) => k.toLowerCase() !== 'readme.md' && Boolean(v && String(v).trim())
  );

  const stateBlock =
    hasExistingCode && projectState
      ? `ESTADO GUARDADO DO PROJETO ATUAL (sara_estado_projeto):
- Projeto ativo: ${projectState.projectName || 'Sem nome'} (${projectState.goal || ''})
- Última etapa feita: ${projectState.lastStepDone || 'Início'}
- Próximo passo esperado: ${projectState.nextStep || 'Continuar construção'}
- Ficheiros registados: ${(projectState.filesList || []).join(', ') || 'nenhum'}
- O que falta fazer: ${(projectState.missingFeatures || []).join(', ') || 'definir conforme arquitetura'}\n`
      : '';

  const pLower = String(prompt || '').toLowerCase();
  let domainFoldersHint =
    'pastas especializadas conforme o domínio (ex: styles/, data/, components/, pages/, services/, utils/)';
  if (/(jogo|game|corrida|arcade|tiro|puzzle|carro|nave)/i.test(pLower)) {
    domainFoldersHint =
      'OBRIGATÓRIO incluir TODAS estas pastas e ficheiros separados para este jogo: index.html, styles/style.css, engine/motor.js (física/colisão/loop), engine/som.js (Web Audio), engine/score.js (pontos/vidas/recordes), components/player.js, components/enemy.js, render/canvas.js (desenho no canvas), scenes/menu.js, scenes/jogo.js, scenes/gameover.js, utils/utils.js.';
  } else if (/(loja|e-?commerce|mercado|venda|produtos|roupa)/i.test(pLower)) {
    domainFoldersHint =
      'OBRIGATÓRIO incluir pastas especializadas: index.html, styles/style.css, components/navbar.js, components/card-produto.js, components/carrinho.js, pages/home.js, pages/produtos.js, pages/checkout.js, services/auth.js, services/produtos.js, services/pagamento.js, utils/formatar.js.';
  } else if (/(chat|mensag|conversa|whatsapp)/i.test(pLower)) {
    domainFoldersHint =
      'OBRIGATÓRIO incluir pastas especializadas: index.html, styles/style.css, components/chat-bolha.js, components/lista-contatos.js, services/mensagens.js, services/voz.js, engine/realtime.js, utils/tempo.js.';
  } else if (/(m[uú]sica|music|audio|[aá]udio|player|spotify|sonicforge|v[ií]deo|video|playlist)/i.test(pLower)) {
    domainFoldersHint =
      'OBRIGATÓRIO incluir pastas especializadas com UI nível Spotify/SonicForge + visualizador real: index.html, styles/style.css, data/faixas.js, components/sidebar.js, components/topbar.js, components/player-bar.js, components/visualizador.js, pages/explorar.js, pages/playlists.js, services/audio-engine.js, services/storage.js, utils/toast.js.';
  } else if (/(dashboard|gest[aã]o|escola|cl[ií]nica|igreja|erp|crm|admin|sistema|painel|auth|login)/i.test(pLower)) {
    domainFoldersHint =
      'OBRIGATÓRIO incluir arquitetura de sistema complexo completo (Sidebar + Topbar + Dashboard + Páginas internas + Modais + Toasts + Persistência localStorage com dados de exemplo reais): index.html, styles/style.css, data/seed.js, services/db.js, services/auth.js, components/sidebar.js, components/topbar.js, components/modal.js, components/toast.js, pages/dashboard.js, pages/registos.js, utils/charts.js.';
  }

  const continuityRule = hasExistingCode
    ? 'CONTINUIDADE CIRÚRGICA OBRIGATÓRIA (BROWNFIELD): Este projeto JÁ EXISTE. LÊ TODOS OS FICHEIROS ANTES. Mantém o mesmo nome, visual e lógica que já funcionam; emite o código COMPLETO apenas dos ficheiros que estás a alterar ou acrescentar agora (os restantes ficheiros são preservados automaticamente).'
    : `NOVO PROJETO: PROIBIDO criar apenas index.html + src/app.js. Cria estrutura MODULAR COMPLETA com estética nível Awwwards/Spotify/Linear/Stripe (fundo gradiente escuro, glassmorphism, cantos 16px-24px, Poppins/Inter, ícones SVG Lucide sem emojis, dados de exemplo ricos e gráficos reais): ${domainFoldersHint}. Escolhe um nome criativo ligado ao pedido ou exatamente o nome pedido por Eletro-Jr.`;

  const modeHint =
    agentMode === 'manual'
      ? 'MODO ATUAL: MANUAL (Eletro-Jr acompanha passo a passo. Executa com código completo em várias pastas especializadas e depois pergunta o próximo passo com espontaneidade).'
      : 'MODO ATUAL: AUTOMÁTICO/DIRETO (Constrói com código completo em várias pastas especializadas e lógica completa).';

  const screenBlock = screenContext
    ? `CONTEXTO ATUAL DA PLATAFORMA: separador="${screenContext.activeTab}", preview="${screenContext.previewDevice}", ficheiro ativo="${screenContext.activeFile}", projeto ativo="${screenContext.projectName}", telaCheia="${Boolean(screenContext.isEditorFullscreen)}", projetosDisponiveis="${(screenContext.availableProjects || []).join(', ')}".\n`
    : '';

  const contextMessage = `${modeHint}
${continuityRule}
${screenBlock}${memoryBlock}${stateBlock}
HISTÓRICO RECENTE:
${recentHistory || 'Início da sessão.'}

FICHEIROS ATUAIS DO PROJETO (${Object.keys(files || {}).length}):
${currentFilesBlock || '(vazio)'}

${uploadedBlock ? `FICHEIROS ANEXADOS:\n${uploadedBlock}\n` : ''}
ERROS DO CONSOLE:
${recentErrors || 'Nenhum erro.'}

PEDIDO ATUAL DE ELETRO-JR:
${prompt || 'Analisa os ficheiros/imagem anexados e constrói o sistema completo baseado neles.'}`;

  const parts = [];
  if (imageBase64) {
    parts.push({
      inlineData: {
        data: imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64,
        mimeType: imageMimeType || 'image/jpeg',
      },
    });
  }
  parts.push({ text: contextMessage });
  return parts;
}

export async function callGeminiRestWithFailover(
  apiKey,
  buildRequestBody,
  timeoutMs = 13000,
  modelChain = MODEL_PRIORITY_CHAIN
) {
  let lastError = null;

  for (const model of modelChain) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const resp = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
          'User-Agent': 'aistudio-build',
        },
        body: JSON.stringify(buildRequestBody(model)),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        const err = new Error(`Gemini HTTP ${resp.status}: ${errText.slice(0, 200)}`);
        err.status = resp.status;
        throw err;
      }

      const json = await resp.json();
      const text =
        json?.candidates?.[0]?.content?.parts
          ?.map((p) => p?.text || '')
          .join('') || '';
      if (!text) {
        const err = new Error('Resposta vazia do modelo Gemini.');
        err.status = 500;
        throw err;
      }
      return { text, modelUsed: model };
    } catch (err) {
      lastError = err;
      if (!isRetryableHttpStatus(err?.status, err?.message)) {
        throw err;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error('Nenhum modelo Gemini respondeu no momento.');
}
