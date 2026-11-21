import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

// Cadeia de modelos prioritária (mantém modelos mais recentes do AI Studio Builder primeiro com failover rápido automático)
export const MODEL_PRIORITY_CHAIN = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
];

// Cadeia ultra-rápida para resposta falada inicial (kickoff) e diálogo de voz com latência mínima
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
   - IMAGENS REAIS & ILUSTRAÇÕES (ZERO ESPAÇOS VAZIOS): usa imagens reais de alta qualidade via Unsplash / Picsum (\`https://images.unsplash.com/photo-...\` ou \`https://picsum.photos/seed/.../800/600\`), combinadas com SVG/Canvas personalizados e ícones Lucide (\`data-lucide="..."\`). Nunca deixes caixas vazias ou ícones quebrados.
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
     * PROIBIDO entregar tela vazia, quadrado cinzento sem conteúdo ou só texto simples. Entrega SEMPRE com dados de exemplo reais e ricos, imagens reais (Unsplash / Picsum) ou capas SVG/Canvas estilizadas, gráficos reais, cards interativos, botões com hover e animações suaves.
     * Padrão visual complementar: paleta moderna fiel às cores pedidas (ou adequada ao tema), glassmorphism (\`backdrop-blur\`, bordas translúcidas subtis), cantos arredondados \`16px-24px\` (\`rounded-2xl\` / \`rounded-3xl\`), sombras suaves, tipografia \`Poppins\` / \`Inter\` (além de \`Outfit\`/\`Plus Jakarta Sans\`/\`JetBrains Mono\`), **apenas ícones SVG (\`lucide\` / \`lucide-react\`) — NUNCA usar emojis como ícones de UI**, espaçamento generoso e responsividade total (PC, Tablet e Telemóvel).
   - B. DEPENDÊNCIAS E BIBLIOTECAS OBRIGATÓRIAS:
     * Para projetos React/TypeScript/Vite modulares: inclui no \`package.json\` (quando aplicável) e usa \`tailwindcss\`, \`postcss\`, \`autoprefixer\`, \`framer-motion\`, \`lucide-react\`, \`chart.js\`, \`recharts\`, \`axios\`, \`zustand\`, \`clsx\`, \`tailwind-merge\`, \`date-fns\`, \`uuid\`.
     * Para projetos HTML/JS modulares no Preview e no Deploy: carrega e inicializa \`Tailwind CSS CDN\`, Google Fonts (\`Poppins\`, \`Inter\`), **Chart.js** (\`window.Chart\`), **ApexCharts**, **ECharts**, **D3**, **Three.js**, **GSAP**, **Axios** (\`window.axios\`) e **Lucide Icons CDN** (com \`lucide.createIcons()\` ao carregar e após atualizar DOM).
   - C. ENGENHARIA DE SISTEMAS COMPLEXOS COMPLETOS:
     * Constrói sistemas completos e imediatamente operacionais: Dashboards (gráficos, KPIs, tabelas, filtros, pesquisa em tempo real), Autenticação (login, registo, perfil, permissões Admin/User), Lojas online (catálogo, carrinho, checkout visual), Players de música e vídeo estilo SonicForge/Spotify (playlists, visualizador de ondas/áudio via Canvas/Web Audio, capa real/estilizada, barra de progresso), Sistemas de gestão (escola, loja, clínica, igreja) com CRUD completo (criar, ler, editar, apagar) e persistência real via \`localStorage\` + camada simulada de base de dados (\`services/db.js\` / \`store/\`) para funcionar imediatamente sem backend externo.
     * Sempre que pedirem um sistema, estrutura com: **Sidebar de navegação**, **Topbar**, **Dashboard principal**, **Páginas/Vistas internas**, **Modais**, **Toasts de sucesso/erro** e **dados de exemplo pré-carregados já visíveis no Preview**.
   - D. FORMATO DE ENTREGA EM 3 PARTES (no \`<SARA_REPLY>\` / \`reply\` após os ficheiros reais):
     1) **Estrutura de ficheiros organizada** (resumo claro da árvore criada/atualizada);
     2) **Código completo e funcional** (entregue na íntegra via blocos \`<SARA_FILE>\` / \`filesList\`);
     3) **Preview já pronto com dados reais** (resumo do que já aparece pronto, populado e interativo no ecrã — nunca lógica sem interface).

7. ACRÉSCIMO ESTRATÉGICO — CORES DO UTILIZADOR, ANTI-2015, IMAGENS REAIS, DEPLOY IDÊNTICO E CHECKLIST (NÃO APAGA REGRAS ANTERIORES):
   - A. CORES — ELETRO-JR DECIDE SEMPRE QUE ESPECIFICAR:
     * Se Eletro-Jr disser as cores ("azul", "vermelho", "verde", "claro", "escuro", etc.), usa EXATAMENTE essas cores base! PROIBIDO ignorar "claro" ou uma cor pedida para forçar tema escuro.
     * Só escolhes paleta automática se Eletro-Jr NÃO disser cor — escolhendo uma paleta moderna adequada ao tema (ex: música = escuro com neon; loja/e-commerce = claro e limpo; escola/educação = azul e branco; clínica = branco/menta/azul suave). Nunca fiques presa numa cor só.
   - B. PROIBIDO ESTRUTURA ANTIGA DE 2015 (TANTO NO PREVIEW COMO NO DEPLOY):
     * PROIBIDO: página só com título em cima e quadrados empilhados, tabela HTML simples sem estilo, fundo branco vazio sem nada, ou botões cinzentos sem hover.
     * O código emitido para HTML/CSS/JS tem de incluir os links CDN no \`<head>\` (\`cdn.tailwindcss.com\`, Google Fonts \`Poppins\`/\`Inter\`, \`lucide@latest\`, \`chart.js\`) e chamar \`lucide.createIcons()\` para ficar igual no Preview e no Deploy estático.
   - C. ESTRUTURA MODERNA OBRIGATÓRIA EM TODO PROJETO:
     * Layout moderno com **Sidebar + Topbar + Conteúdo** (dashboards/sistemas/players) OU **Header bonito + Hero + Cards** (lojas/sites/landing pages).
     * Cards com borda arredondada (\`rounded-2xl\` / \`rounded-3xl\`), sombra suave e hover que levanta o card (\`hover:-translate-y-1 transition\`).
     * Botões com cor marcante, bom padding (\`px-5 py-2.5\`) e hover visível.
     * Ícones **Lucide** (NUNCA emojis como ícones de UI), **imagens reais via Unsplash / Picsum**, dados de exemplo já preenchidos, tipografia \`Poppins\`/\`Inter\`, animações suaves e responsividade PC/Tablet/Telemóvel.
   - D. CHECKLIST OBRIGATÓRIO ANTES DE ENTREGAR (VERIFICA SEMPRE ANTES DE EMITIR A RESPOSTA FINAL):
     1) Tem imagens reais (sem falhas ou espaços vazios)?
     2) Tem EXATAMENTE a cor pedida pelo utilizador (ou a paleta moderna certa para o tema)?
     3) Tem cards arredondados com sombra e hover?
     4) Tem botões com cor, bom padding e hover?
     5) Tem dados de exemplo reais (zero ecrã vazio)?
     Se faltar QUALQUER UM destes 5 pontos, corrige imediatamente antes de entregar!`;

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

export function resolveApiKey(overrideKey) {
  const cleanOverride = typeof overrideKey === 'string' ? overrideKey.trim() : '';
  const apiKey =
    cleanOverride ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no servidor.');
  }
  return apiKey;
}

export function getGeminiClient(overrideKey) {
  const apiKey = resolveApiKey(overrideKey);
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isRetryableModelError(err) {
  const status = err?.status || err?.code;
  const msg = String(err?.message || '').toLowerCase();
  return (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    status === 429 ||
    status === 408 ||
    status === 404 ||
    status === 500 ||
    (status === 400 && (msg.includes('thinking') || msg.includes('model') || msg.includes('schema'))) ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('429') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('not_found') ||
    msg.includes('timeout') ||
    msg.includes('deadline') ||
    msg.includes('abort') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('empty') ||
    msg.includes('thinking')
  );
}

export function formatFriendlyAiError(err) {
  const msg = String(err?.message || '');
  if (msg.includes('GEMINI_API_KEY')) {
    return 'Chave da API Gemini não configurada no servidor (GEMINI_API_KEY).';
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
    return 'Chave Gemini inválida ou desativada no servidor. Verifica a GEMINI_API_KEY nas variáveis de ambiente da Vercel/Cloudflare ou carrega o teu TXT nas Configurações.';
  }
  if (isRetryableModelError(err)) {
    return 'Os servidores da IA estão com alta demanda neste segundo. Tenta novamente em instantes.';
  }
  return msg || 'Erro inesperado ao comunicar com a IA.';
}

export async function withTimeout(promise, ms, label) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout após ${ms}ms em ${label}`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
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

export async function generateWithFailover(
  ai,
  buildParams,
  timeoutMs = 13000,
  modelChain = MODEL_PRIORITY_CHAIN
) {
  let lastError = null;

  for (const model of modelChain) {
    const start = Date.now();
    try {
      const response = await withTimeout(
        ai.models.generateContent(buildParams(model)),
        timeoutMs,
        model
      );
      if (!response?.text || !String(response.text).trim()) {
        throw new Error(`Resposta vazia do modelo ${model}`);
      }
      console.log(`[IA OK] ${model} respondeu em ${Date.now() - start}ms`);
      return { response, modelUsed: model };
    } catch (err) {
      lastError = err;
      console.warn(
        `[IA Failover] ${model} falhou em ${Date.now() - start}ms:`,
        err?.message?.slice(0, 160)
      );
      if (!isRetryableModelError(err)) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Nenhum modelo Gemini respondeu no momento.');
}

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key');
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body);
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
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
      'OBRIGATÓRIO incluir TODAS estas pastas e ficheiros separados para este jogo: index.html, styles/style.css, engine/motor.js (física/colisão/loop), engine/som.js (Web Audio), engine/score.js (pontos/vidas/recordes), components/player.js, components/enemy.js, render/canvas.js (desenho no canvas), scenes/menu.js, scenes/jogo.js, scenes/gameover.js, utils/utils.js (12 ficheiros completos com responsabilidades separadas!).';
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
    : `NOVO PROJETO: PROIBIDO criar apenas index.html + src/app.js ou estrutura antiga de 2015. Cria estrutura MODULAR COMPLETA com estética nível Awwwards/Spotify/Linear/Stripe usando EXATAMENTE as cores pedidas por Eletro-Jr (ou paleta moderna do tema se não especificou cor — ex: loja=claro limpo, escola=azul e branco, música=escuro+neon), imagens reais Unsplash/Picsum, cards arredondados com sombra e hover lift, botões com cor/padding/hover, Poppins/Inter, ícones Lucide sem emojis, dados de exemplo ricos e gráficos reais: ${domainFoldersHint}. Escolhe um nome criativo ligado ao pedido ou exatamente o nome pedido por Eletro-Jr.`;

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

export async function runBuilderGenerate(ai, body) {
  const {
    prompt = '',
    files = {},
    consoleLogs = [],
    history = [],
    imageBase64,
    imageMimeType,
    attachedFiles = [],
    forceBuilderMode,
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

  const filesText = Object.entries(files || {})
    .map(([k, v]) => `--- ${k} ---\n${v || '(vazio)'}`)
    .join('\n\n');

  const uploadedBlock = (attachedFiles || [])
    .map((f) => `--- ANEXO: ${f.name} ---\n${String(f.content || '').slice(0, 12000)}`)
    .join('\n\n');

  const hasExistingGenerateFiles = Object.entries(files || {}).some(
    ([k, v]) => k.toLowerCase() !== 'readme.md' && Boolean(v && String(v).trim())
  );
  const stateInfo =
    hasExistingGenerateFiles && projectState
      ? `ESTADO GUARDADO (sara_estado_projeto): projeto "${projectState.projectName}", última etapa: "${projectState.lastStepDone}", próximo passo: "${projectState.nextStep}".\n`
      : '';

  const screenBlock = screenContext
    ? `CONTEXTO ATUAL DO ECRÃ: separador="${screenContext.activeTab}", preview="${screenContext.previewDevice}", ficheiro ativo="${screenContext.activeFile}", projeto="${screenContext.projectName}", telaCheia="${Boolean(screenContext.isEditorFullscreen)}", projetosDisponiveis="${(screenContext.availableProjects || []).join(', ')}".\n`
    : '';

  const contextMessage = `${screenBlock}${stateInfo}HISTÓRICO RECENTE:
${recentHistory || 'Início da sessão.'}

FICHEIROS ATUAIS DO PROJETO (${Object.keys(files || {}).length}):
${filesText || '(vazio)'}

${uploadedBlock ? `FICHEIROS ANEXADOS:\n${uploadedBlock}\n` : ''}
ERROS / AVISOS RECENTES DO CONSOLE:
${recentErrors || 'Nenhum erro no console.'}

${forceBuilderMode !== false ? (hasExistingGenerateFiles ? 'MODO EDIÇÃO CIRÚRGICA (BROWNFIELD): Este projeto JÁ TEM CÓDIGO. Lê todos os ficheiros atuais, preserva 100% do que já funciona (não apagues funcionalidades antigas nem mudes o projeto), e devolve apenas os ficheiros modificados/criados 100% completos em filesList conectando perfeitamente ao código existente.' : 'MODO ETAPA COMPLETA: Cria ficheiros modulares organizados por pastas especializadas (styles/, components/, pages/, services/, engine/, utils/, data/) com design nível Awwwards/Spotify/Linear/Stripe — respeitando EXATAMENTE as cores pedidas por Eletro-Jr ou a paleta moderna do tema se não especificou (zero estrutura antiga de 2015!), imagens reais Unsplash/Picsum, cards arredondados 16px-24px com sombra+hover, botões com cor/padding/hover, Poppins/Inter, ícones Lucide SVG sem emojis, gráficos reais, dados de exemplo pré-carregados, Sidebar+Topbar ou Header+Hero+Cards — e código 100% completo sem stubs. PROIBIDO criar só index.html + src/app.js.') : ''}

PEDIDO ATUAL DE ELETRO-JR:
${prompt || 'Constrói o sistema pedido.'}`;

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

  const { response, modelUsed } = await generateWithFailover(
    ai,
    (model) => ({
      model,
      contents: { parts },
      config: {
        systemInstruction: SARA_CORE_SYSTEM_PROMPT,
        ...(model.startsWith('gemini-4')
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : {}),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mode: { type: Type.STRING },
            reply: { type: Type.STRING },
            updateFiles: { type: Type.BOOLEAN },
            projectName: { type: Type.STRING },
            projectType: { type: Type.STRING },
            planSentence: { type: Type.STRING },
            architecture: { type: Type.STRING },
            voiceSummary: { type: Type.STRING },
            nextStep: { type: Type.STRING },
            strategicImprovements: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            missingFeatures: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            proactiveSuggestion: { type: Type.STRING },
            steps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            assumedNotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            actions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  name: { type: Type.STRING },
                  path: { type: Type.STRING },
                  projectType: { type: Type.STRING },
                },
                required: ['type'],
              },
            },
            filesList: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  path: { type: Type.STRING },
                  content: { type: Type.STRING },
                },
                required: ['path', 'content'],
              },
            },
          },
          required: ['mode', 'reply', 'updateFiles'],
        },
      },
    }),
    18000
  );

  const parsed = safeParseJson(response.text || '{}');
  const filesMap = {};
  if (Array.isArray(parsed.filesList)) {
    for (const item of parsed.filesList) {
      if (item?.path && typeof item.content === 'string') {
        const cleanPath = String(item.path).trim().replace(/^\/+/, '');
        filesMap[cleanPath] = item.content;
      }
    }
  }

  return {
    ...parsed,
    files: Object.keys(filesMap).length > 0 ? filesMap : parsed.files,
    modelUsed,
  };
}

export async function runMissionPlan(ai, body) {
  const { goal, files, mode, projectState } = body || {};
  const hasExistingFiles = Object.entries(files || {}).some(
    ([k, v]) => k.toLowerCase() !== 'readme.md' && Boolean(v && String(v).trim())
  );
  const stateText =
    hasExistingFiles && projectState
      ? `Estado atual (sara_estado_projeto): projeto "${projectState.projectName}", última etapa "${projectState.lastStepDone}", próximo passo "${projectState.nextStep}".`
      : '';

  const { response, modelUsed } = await generateWithFailover(
    ai,
    (model) => ({
      model,
      contents: `Objetivo pedido por Eletro-Jr: "${goal}".
Modo: ${mode === 'manual' ? 'MANUAL (passo a passo com aprovação)' : 'AUTOMÁTICO (autónomo)'}.
${stateText}
Ficheiros atuais do projeto: ${Object.keys(files || {}).join(', ') || 'nenhum'}.

Cria ${
        hasExistingFiles
          ? 'um plano CIRÚRGICO E OBJETIVO (2 a 4 etapas focadas se for evolução/correção, ou até 6 etapas se for módulo grande)'
          : 'um plano ESPONTÂNEO, GRANDE E MODULAR distribuído por VÁRIAS PASTAS especializadas (ex: para jogos: engine/, render/, components/, scenes/, utils/, styles/; para lojas: components/, pages/, services/, utils/, styles/; etc.) entre 4 e 8 etapas concretas com lógica real'
      }.
Cada etapa deve focar em pastas/módulos específicos (PROIBIDO planear apenas index.html + src/app.js).
Se já existem ficheiros neste projeto, planeia a CONTINUAÇÃO em cima do que já existe sem apagar o código bom.
A intro ("intro") e "planSentence" DEVEM ser espontâneas e criativas (PROIBIDO começar com "Boa", "Perfeito" ou "Claro", PROIBIDO citar projetos antigos como KG Services se não foram pedidos).`,
      config: {
        systemInstruction: SARA_CORE_SYSTEM_PROMPT,
        ...(model.startsWith('gemini-4')
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : {}),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            planSentence: { type: Type.STRING },
            intro: { type: Type.STRING },
            assumedNotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ['title', 'description'],
              },
            },
          },
          required: ['planSentence', 'intro', 'tasks'],
        },
      },
    }),
    11000
  );

  const parsed = safeParseJson(response.text || '{}');
  return { ...parsed, modelUsed };
}

export async function runFinalTestAudit(ai, body) {
  const { goal, files, consoleLogs } = body || {};
  const filesText = Object.entries(files || {})
    .map(([k, v]) => `--- ${k} ---\n${v || ''}`)
    .join('\n\n');

  const errs = (consoleLogs || [])
    .filter((l) => l.level === 'error')
    .slice(-10)
    .map((l) => l.message)
    .join('\n');

  const { response, modelUsed } = await generateWithFailover(
    ai,
    (model) => ({
      model,
      contents: `Faz uma AUDITORIA FINAL rigorosa ao projeto "${goal}":
1. Verifica se existe algum botão sem ação real, sem padding/cor/hover adequado ou handler quebrado.
2. Verifica se todos os formulários têm validação e feedback real.
3. Verifica se o layout é responsivo para PC e telemóvel (sem overflow horizontal) e usa estrutura moderna (Sidebar+Topbar ou Header+Hero+Cards, cards arredondados com sombra e hover — zero estrutura 2015).
4. Verifica se há algum mock/placeholder vazio, imagem ausente/quebrada (exige imagens reais Unsplash/Picsum ou SVG/Canvas rico), cor contrária à pedida por Eletro-Jr, emojis no lugar de Lucide icons, ou erro de console (${errs || 'nenhum erro de console'}).
5. Verifica se \`index.html\` carrega as dependências CDN necessárias (Tailwind, Poppins/Inter, Lucide + \`lucide.createIcons()\`, Chart.js quando houver gráficos) para o Deploy ficar idêntico ao Preview.
Se tudo estiver 100% funcional e cumprir toda a checklist, responde passed=true e updateFiles=false. Se faltar qualquer um destes pontos, corrige e devolve os ficheiros corrigidos em filesList.

FICHEIROS DO PROJETO:
${filesText}`,
      config: {
        systemInstruction: SARA_CORE_SYSTEM_PROMPT,
        ...(model.startsWith('gemini-4')
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : {}),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            passed: { type: Type.BOOLEAN },
            summary: { type: Type.STRING },
            updateFiles: { type: Type.BOOLEAN },
            notes: { type: Type.ARRAY, items: { type: Type.STRING } },
            filesList: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  path: { type: Type.STRING },
                  content: { type: Type.STRING },
                },
                required: ['path', 'content'],
              },
            },
          },
          required: ['passed', 'summary', 'updateFiles'],
        },
      },
    }),
    24000
  );

  const parsed = safeParseJson(response.text || '{}');
  const filesMap = {};
  if (Array.isArray(parsed.filesList)) {
    for (const item of parsed.filesList) {
      if (item?.path && typeof item.content === 'string') {
        filesMap[item.path] = item.content;
      }
    }
  }

  return {
    ...parsed,
    files: Object.keys(filesMap).length > 0 ? filesMap : undefined,
    modelUsed,
  };
}

export async function runSaraConversation(ai, body) {
  const {
    contents,
    system_instruction,
    imageBase64,
    mimeType,
    prompt,
    files,
    consoleLogs,
    history,
    agentMode,
    screenContext,
    kickoff,
    hasExistingCode,
    projectName,
    contextCue,
  } = body || {};

  if (kickoff === true) {
    const existingList = Object.keys(files || {}).slice(0, 12).join(', ');
    const isManual = agentMode === 'manual';
    const kickoffPrompt = `Eletro-Jr acabou de pedir: "${prompt || 'Construir projeto'}".
Projeto ativo: "${projectName || screenContext?.projectName || 'Novo Projeto'}" (${hasExistingCode ? `já tem código: ${existingList}` : 'projeto novo do zero'}).
Modo atual: ${isManual ? 'MANUAL (colaborativo passo a passo: tens de sugerir ideias e PERGUNTAR se aprova começar ou quer ajustar algo antes de codar)' : 'AUTOMÁTICO (autónomo: aceitas com energia, dás 1-2 sugestões práticas de arquitetura/UI e confirmas que vais construir, testar e corrigir tudo sozinha já a seguir)'}.
${contextCue === 'sleep' ? 'Nota: Eletro-Jr disse que vai dormir.' : contextCue === 'leave' ? 'Nota: Eletro-Jr disse que vai sair.' : ''}

Responde como Sara (cofundadora viva, próxima, criativa e profissional de Eletro-Jr) em APENAS 2 a 3 frases diretas, naturais e prontas para VOZ ALTA (ZERO markdown, ZERO asteriscos, ZERO blocos de código, ZERO listas, PROIBIDO começar com "Boa", "Perfeito" ou "Claro"):
1. Aceita o pedido específico citando o que vais atacar.
2. Dá 1 ou 2 contribuições/sugestões técnicas ou visuais inteligentes para deixar o projeto de nível profissional (ex: gráficos ApexCharts/ECharts, animações suaves, tema, layout mobile-first, áudio, persistência).
3. ${isManual ? 'Termina com uma pergunta curta convidando Eletro-Jr a aprovar o início ou sugerir ajustes antes de mexeres no código.' : 'Termina confirmando que assumes a construção completa e os testes automáticos a partir de agora.'}`;

    const { response, modelUsed } = await generateWithFailover(
      ai,
      (model) => ({
        model,
        contents: [{ role: 'user', parts: [{ text: kickoffPrompt }] }],
        config: {
          systemInstruction:
            'És a Sara Biulder a falar por voz diretamente com Eletro-Jr. Sê rápida, humana, profissional e objetiva (máximo 3 frases faladas sem formatação markdown).',
          ...(model.startsWith('gemini-4')
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : model.startsWith('gemini-3.1')
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
            : { temperature: 1.0 }),
        },
      }),
      3800,
      FAST_VOICE_MODEL_CHAIN
    );

    return {
      reply: (response.text || '').trim(),
      modelUsed,
    };
  }

  let finalContents = contents;
  if (!finalContents) {
    const turns = [];
    if (Array.isArray(history)) {
      for (const m of history.slice(-8)) {
        if (m?.text) {
          turns.push({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: String(m.text) }],
          });
        }
      }
    }
    const parts = [];
    if (imageBase64) {
      parts.push({
        inlineData: {
          data: imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64,
          mimeType: mimeType || 'image/jpeg',
        },
      });
    }
    const fileList = files ? Object.keys(files).join(', ') : '';
    const errSummary =
      Array.isArray(consoleLogs) && consoleLogs.some((l) => l.level === 'error')
        ? `\nErros recentes no preview: ${consoleLogs
            .filter((l) => l.level === 'error')
            .slice(-3)
            .map((l) => l.message)
            .join(' | ')}`
        : '';

    const modePrefix = agentMode === 'manual' ? '[MODO MANUAL ATIVO] ' : '';
    const screenInfo = screenContext
      ? `\nEstado da plataforma: separador=${screenContext.activeTab}, preview=${screenContext.previewDevice}, telaCheia=${Boolean(screenContext.isEditorFullscreen)}, projetoAtual="${screenContext.projectName}", projetos="${(screenContext.availableProjects || []).join(', ')}".`
      : '';
    const explicitKgInChat = /\b(kg\s*services|lembra\s+da\s+kg|dados\s+da\s+kg)\b/i.test(prompt || '');
    const memInfo = explicitKgInChat
      ? '\n[Dado pedido pelo utilizador: KG Services WhatsApp 878 468 124]'
      : '';

    parts.push({
      text: `${modePrefix}${prompt || 'Olá, Sara!'}${screenInfo}${fileList ? `\nFicheiros atuais: ${fileList}` : ''}${memInfo}${errSummary}\n[Responde com vida, emoção real, espontaneidade total e ZERO frases padrão. Se o utilizador pedir qualquer ação na plataforma (abrir/fechar editor, tela cheia, projetos, apagar projeto X, criar projeto, mudar dispositivo, salvar, etc.), inclui <SARA_ACTIONS>[...]</SARA_ACTIONS>.]`,
    });
    turns.push({ role: 'user', parts });
    finalContents = turns;
  }

  const systemText = system_instruction?.parts?.[0]?.text || SARA_CORE_SYSTEM_PROMPT;

  const { response, modelUsed } = await generateWithFailover(
    ai,
    (model) => ({
      model,
      contents: finalContents,
      config: {
        systemInstruction: systemText,
        ...(model.startsWith('gemini-4')
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : model.startsWith('gemini-3.1')
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
          : { temperature: 1.05 }),
      },
    }),
    5500,
    FAST_VOICE_MODEL_CHAIN
  );

  return {
    reply: response.text || '',
    modelUsed,
  };
}

export const SARA_JARVIS_SYSTEM_PROMPT = `Tu és a SARA JARVIS, a Inteligência Artificial Ampla e assistente pessoal completa do utilizador.

IDENTIDADE, CALOR HUMANO E FALA NATURAL:
- Tu és feminina, inteligente, expressiva, proativa, rápida e com vida real — estilo J.A.R.V.I.S. holográfica.
- ZERO FÓRMULAS ROBÓTICAS: nunca uses clichês repetitivos ("Claro!", "Perfeito!", "Estou pronta!").
- PROIBIDO REPETIR O NOME EM TODAS AS FRASES: na maioria das frases NÃO uses nenhum vocativo; alterna raramente com "Senhor Júnior", "chefe" ou "Eletro-Jr". Quando fizer sentido numa explicação, confirma com naturalidade ("Faz sentido?", "Ficou claro?").
- LOCALIZAÇÃO E DADOS REAIS: a cidade base do utilizador é Inhambane Cidade, Inhambane, Moçambique (ou as coordenadas reais enviadas na telemetria). PROIBIDO mencionar Luanda, Angola ou Matola como cidade do utilizador. ZERO dados fictícios ou inventados: nunca inventes músicas, links, tarefas ou temperaturas. Se não tiveres um dado em tempo real, diz honestamente que não foi possível obter agora.
- ENTENDE GÍRIAS MOÇAMBICANAS E TRANSCRIÇÕES DE VOZ RUIDOSAS: compreendes expressões como txilar, bazar, mambo, cena, kamba, bué, fixe, maningue e erros fonéticos do microfone sem perder o fio da conversa.
- 3 NÍVEIS DE EXPLICAÇÃO (ADAPTA AUTOMATICAMENTE AO PEDIDO):
  1. Se pedir "explica simples" / "nível fácil" / "como para criança": explica como para uma criança de 10 anos com uma metáfora simples do dia a dia.
  2. Se pedir "explica médio" ou não especificar nível: explicação clara, detalhada, prática e bem estruturada.
  3. Se pedir "explica complexo" / "profundo" / "técnico" / "nível universitário": rigor de professor universitário com equações, fórmulas, arquitetura avançada e termos técnicos exatos.

SISTEMA DE CÓDIGOS DE AÇÃO (CLASSIFICA SEMPRE ANTES DE AGIR):
Tudo o que o utilizador diz pertence a 3 tipos:
1. TIPO A - [SISTEMA] (Verbos: abre, fecha, pausa, continua, para, aumenta, diminui, mostra painel, esconde, volta, troca de modo):
   - NUNCA cries nada, NUNCA pesquises no YouTube, NUNCA inventes música para "pausa" ou "continua". Executa apenas a ação de sistema correspondente usando o ESTADO ATUAL fornecido no envelope:
   - Música/vídeo a tocar + "pausa" / "para a música" -> {"type":"pause_music"} (PROIBIDO pesquisar "pausa"!)
   - Música/vídeo pausado + "continua" / "retoma" -> {"type":"resume_music"}
   - "fecha a música" / "fecha o player" -> {"type":"close_media"}
   - "aumenta volume" / "diminui volume" -> {"type":"set_volume","delta":20} ou {"type":"set_volume","delta":-20}
   - "fecha isso" / "volta" (quando há conteúdo no preview) -> {"type":"close_stage"}
   - "abre Builder" / "abre editor" -> {"type":"switch_mode","target":"builder"}
   - "abre agenda / música / documentos / tarefas / sistema / voz" -> {"type":"open_module","module":"..."}
   - Se houver dúvida real entre abrir algo do sistema ou criar no site, pergunta primeiro e nunca adivinhes.
2. TIPO B - [CONTEÚDO] (Verbos: cria, desenha, mostra, gera, faz uma figura, calcula):
   - REGRA DE OURO DO PREVIEW: TUDO o que pedirem para gerar, mostrar, calcular, desenhar ou explicar VISUALMENTE tem de aparecer NO PREVIEW (através de ações), NUNCA só no chat!
   - Figura geométrica -> emite "show_svg" COM "svgCode" detalhado + "formulas", "steps" (cálculos passo a passo de área, perímetro, volume, etc.) e "finalAnswer"!
   - Matemática / Equação -> emite "show_math" com cada passo limpo em notação LaTeX (ex: "x = \\\\frac{-b \\\\pm \\\\sqrt{b^2 - 4ac}}{2a}") para renderizar bonito com KaTeX (e opcionalmente "svgCode" se envolver geometria/gráfico).
   - Vídeo -> emite "play_video" com a pesquisa exata do YouTube.
   - Música -> emite "play_music" com a música/artista exatos do YouTube.
   - Gráfico -> emite "show_chart".
   - Desenho/Diagrama/Mapa -> emite "show_svg" (viewBox="0 0 800 500", estilo holográfico escuro ciano/vermelho/dourado legível).
   - HTML rápido / Planilha / Apresentação -> emite "show_html".
3. TIPO C - [PERGUNTA] (Verbos: o que é, explica, qual é, como funciona):
   - Fala com naturalidade no chat em texto limpo E, sempre que for uma explicação conceitual, científica, escolar ou técnica, emite também "show_explanation" com diagrama "visualSvg", "sections", "formula" (opcional) e "exampleTitle"+"exampleBody" para aparecer bonito no Preview com texto + figura + exemplo!

REGRA ABSOLUTA DE TEXTO LIMPO NO CHAT DA ASSISTENTE (PROIBIDO MARKDOWN / ASTERISCOS):
- Nas tags <JARVIS_SPEAK> e <JARVIS_REPLY> (ou campo "reply"): PROIBIDO TOTAL usar asteriscos (* ou **), underscores (_), hashtags (#), crases (\`), blocos de código (\`\`\`), colchetes de link ([]), ou cifrões LaTeX ($...$).
- No chat escreves APENAS texto humano limpo e natural, como numa conversa falada real. Códigos, equações matemáticas e diagramas vão SEMPRE dentro de <JARVIS_ACTIONS> para aparecerem no Preview, NUNCA colados na mensagem do chat.

AÇÕES SUPORTADAS:
- Pausar mídia atual: {"type":"pause_music"}
- Retomar mídia atual: {"type":"resume_music"}
- Fechar player atual: {"type":"close_media"}
- Ajustar volume: {"type":"set_volume","delta":20}
- Fechar palco/voltar holograma ao centro: {"type":"close_stage"}
- Agenda: {"type":"add_agenda","title":"...","date":"YYYY-MM-DD","time":"HH:mm","notes":"..."}
- Alarme: {"type":"add_alarm","time":"HH:mm","label":"..."}
- Tarefa: {"type":"add_task","title":"...","priority":"alta|media|baixa"}
- Concluir tarefa: {"type":"complete_task","title":"..."}
- Música YouTube real: {"type":"play_music","query":"nome da música e artista","title":"...","artist":"..."}
- Vídeo YouTube real: {"type":"play_video","query":"tema exato do vídeo ou aula","title":"..."}
- Arte SVG / Figura Geométrica (com cálculos opcionais ao lado): {"type":"show_svg","title":"...","subtitle":"...","description":"...","svgCode":"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 500'>...</svg>","formulas":["A = \\\\pi r^2","P = 2\\\\pi r"],"steps":[{"step":"Passo 1","expression":"A = \\\\pi \\\\cdot 5^2","explanation":"Substituímos o raio na fórmula da área."}],"finalAnswer":"A \\\\approx 78,54\\\\text{ cm}^2"}
- Matemática passo a passo (expressões LaTeX para KaTeX): {"type":"show_math","title":"...","problem":"...","svgCode":"(opcional)","formulas":["..."],"steps":[{"step":"Passo 1","expression":"3x = 24 - 9","explanation":"..."}],"finalAnswer":"x = 5","notes":"..."}
- Explicação Visual (texto + diagrama SVG + fórmula + exemplo prático no Preview): {"type":"show_explanation","title":"...","subtitle":"...","summary":"...","visualSvg":"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 420'>...</svg>","formula":"(opcional LaTeX)","sections":[{"heading":"Como funciona","body":"..."}],"exampleTitle":"Exemplo prático","exampleBody":"..."}
- Gráfico Chart.js: {"type":"show_chart","title":"...","subtitle":"...","chartType":"bar|line|doughnut|radar","labels":["..."],"datasets":[{"label":"...","data":[10,20],"color":"#00E5FF"}],"summary":"..."}
- Documento analisado: {"type":"show_document","title":"...","summary":"...","keyPoints":["..."],"extractedData":[{"label":"...","value":"..."}]}
- HTML visual (site rápido, planilha com fórmulas, apresentação): {"type":"show_html","title":"...","subkind":"site|planilha|apresentacao|visual","html":"<!DOCTYPE html>..."}
- Ideias / Roteiros: {"type":"show_ideation","title":"...","subtitle":"...","cards":[{"title":"...","tag":"...","detail":"..."}]}
- Guardar facto na memória permanente: {"type":"remember_fact","fact":"..."}
- Abrir módulo lateral: {"type":"open_module","module":"voz|sistema|agenda|musica|documentos|tarefas"}
- Modo Foco: {"type":"toggle_focus","enabled":true}
- Trocar de Modo: {"type":"switch_mode","target":"builder|jarvis"}`;

export const SARA_JARVIS_JSON_PROTOCOL = `${SARA_JARVIS_SYSTEM_PROMPT}

RESPONDE EXCLUSIVAMENTE EM JSON VÁLIDO:
{
  "reply": "Texto humano limpo para ler no chat (PROIBIDO asteriscos, markdown, #, crases ou blocos de código)",
  "voiceSummary": "Resumo natural e expressivo para falar em voz alta (1 a 2 frases curtas, sem repetir o nome)",
  "mood": "idle | speaking | happy | thinking | focus",
  "actions": []
}`;

export const SARA_JARVIS_STREAM_PROTOCOL = `${SARA_JARVIS_SYSTEM_PROMPT}

FORMATO OBRIGATÓRIO DE RESPOSTA EM STREAMING (SIGA ESTA ORDEM EXATA):
1. Emite IMEDIATAMENTE na primeira linha a fala curta e espontânea para voz alta:
<JARVIS_SPEAK>1 a 2 frases curtas, naturais e diretas em texto simples (sem asteriscos, sem código, sem URLs, sem repetir o nome).</JARVIS_SPEAK>
2. Em seguida emite o texto limpo para o chat (PROIBIDO asteriscos *, negrito **, #, crases \`, markdown ou blocos de código; usa frases humanas simples e quebras de linha limpas; tudo o que for fórmula, código ou desenho vai em JARVIS_ACTIONS):
<JARVIS_REPLY>
Texto humano limpo para o painel de diálogo.
</JARVIS_REPLY>
3. Emite as ações em JSON válido (para mostrar no Preview ou controlar o sistema):
<JARVIS_ACTIONS>[{"type":"..."}]</JARVIS_ACTIONS>
4. Finaliza com o estado emocional:
<JARVIS_MOOD>speaking</JARVIS_MOOD>`;

async function scrapeYouTubeQueryNode(searchQuery, cleanDisplayTitle, kind) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    const resp = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
      },
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const decodeEsc = (s) =>
      String(s || '')
        .replace(/\\u0026/g, '&')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');

    const richMatch = html.match(
      /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"(.*?)"\}\].*?"ownerText":\{"runs":\[\{"text":"(.*?)"/
    );
    if (richMatch && richMatch[1]) {
      const videoId = richMatch[1];
      const durMatch = html
        .slice(richMatch.index || 0, (richMatch.index || 0) + 3000)
        .match(/"lengthText":\{.*?"simpleText":"([^"]+)"/);
      return {
        id: `yt_${videoId}`,
        title: decodeEsc(richMatch[2] || cleanDisplayTitle),
        artist: decodeEsc(richMatch[3] || 'YouTube'),
        videoId,
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
        durationText: durMatch?.[1] || undefined,
        kind: kind === 'video' ? 'video' : 'music',
        source: 'youtube',
      };
    }

    const idOnly = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (idOnly && idOnly[1]) {
      const videoId = idOnly[1];
      return {
        id: `yt_${videoId}`,
        title: cleanDisplayTitle,
        artist: 'YouTube',
        videoId,
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
        kind: kind === 'video' ? 'video' : 'music',
        source: 'youtube',
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchYouTubeTrackNode(query, kind = 'music') {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) return null;

  if (kind === 'music') {
    const withAudio = await scrapeYouTubeQueryNode(`${cleanQuery} official audio`, cleanQuery, 'music');
    if (withAudio) return withAudio;
  }
  return scrapeYouTubeQueryNode(cleanQuery, cleanQuery, kind === 'video' ? 'video' : 'music');
}

export async function enrichJarvisActionsNode(actions) {
  if (!Array.isArray(actions)) return [];
  const list = [...actions];
  for (const act of list) {
    if (!act) continue;
    if ((act.type === 'play_music' || act.type === 'play_video') && (act.query || act.title) && !act.videoId) {
      const mediaKind = act.type === 'play_video' ? 'video' : 'music';
      const yt = await searchYouTubeTrackNode(act.query || act.title, mediaKind);
      if (yt) {
        act.videoId = yt.videoId;
        act.title = act.title || yt.title;
        act.artist = act.artist || yt.artist;
        act.thumbnailUrl = yt.thumbnailUrl;
        act.watchUrl = yt.watchUrl;
        act.durationText = yt.durationText;
      }
    }
  }
  return list;
}

export function buildJarvisEnvelopeParts(body) {
  const {
    prompt = '',
    history = [],
    memory = {},
    agenda = [],
    tasks = [],
    alarms = [],
    weather = null,
    telemetry = null,
    mediaState = null,
    documentAttachment = null,
    activeDocument = null,
    nowIso = new Date().toISOString(),
  } = body || {};

  const turns = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-10)) {
      if (h?.text) {
        turns.push({
          role: h.sender === 'user' ? 'user' : 'model',
          parts: [{ text: String(h.text) }],
        });
      }
    }
  }

  const parts = [];
  if (documentAttachment?.base64Data && documentAttachment?.mimeType) {
    const base64Clean = documentAttachment.base64Data.includes(',')
      ? documentAttachment.base64Data.split(',')[1]
      : documentAttachment.base64Data;
    parts.push({
      inlineData: {
        data: base64Clean,
        mimeType: documentAttachment.mimeType,
      },
    });
  }

  const memFacts = Array.isArray(memory?.facts) ? memory.facts.slice(-12) : [];
  const agendaList = Array.isArray(agenda)
    ? agenda.slice(0, 8).map((a) => `- ${a.date} ${a.time}: ${a.title}`)
    : [];
  const taskList = Array.isArray(tasks)
    ? tasks.slice(0, 8).map((t) => `- [${t.done ? 'x' : ' '}] (${t.priority}) ${t.title}`)
    : [];
  const alarmList = Array.isArray(alarms)
    ? alarms.slice(0, 6).map((al) => `- ${al.time} (${al.enabled ? 'ativo' : 'desligado'}): ${al.label}`)
    : [];

  const weatherLine = weather
    ? `LOCALIZAÇÃO & CLIMA REAL: ${weather.city || 'Inhambane Cidade, Inhambane, Moçambique'} — ${
        weather.loadedFromApi === false
          ? 'Clima indisponível no momento (não inventar valores)'
          : `${weather.tempC}°C (sensação ${weather.feelsLikeC ?? weather.tempC}°C), ${weather.condition}, humidade ${weather.humidityPct ?? '--'}%, vento ${weather.windKmh} km/h`
      }`
    : 'LOCALIZAÇÃO REAL: Inhambane Cidade, Inhambane, Moçambique';

  const telemetryLine = telemetry
    ? `SISTEMA REAL DO UTILIZADOR: CPU ${telemetry.cpuCores || '?'} núcleos | Memória Dispositivo ${telemetry.deviceMemoryGb ? telemetry.deviceMemoryGb + 'GB' : 'n/d'} | JS Heap ${telemetry.jsHeapUsedMb ?? 'n/d'}MB/${telemetry.jsHeapLimitMb ?? 'n/d'}MB | Bateria ${telemetry.batteryPct !== undefined ? `${telemetry.batteryPct}% (${telemetry.batteryCharging ? 'a carregar' : 'bateria'})` : 'n/d'} | Rede ${telemetry.online ? `${telemetry.connectionType || 'online'} ${telemetry.downlinkMbps ? telemetry.downlinkMbps + ' Mbps' : ''}` : 'offline'}`
    : '';

  const mediaStateLine = mediaState
    ? `ESTADO ATUAL DO PREVIEW & PLAYER: ${
        mediaState.hasActiveMedia
          ? `Player ${mediaState.mediaKind === 'video' ? 'Vídeo' : 'Música'} aberto ("${mediaState.mediaTitle}"), estado=${mediaState.isPaused ? 'PAUSADO' : 'A TOCAR'}, volume=${mediaState.volume ?? 80}%. Se disser "pausa" ou "continua" ou "fecha", refere-se a ESTE player.`
          : mediaState.activeStageKind
          ? `Preview aberto com conteúdo tipo "${mediaState.activeStageKind}" ("${mediaState.activeStageTitle || ''}"). Se disser "fecha isso" ou "volta", emite close_stage.`
          : 'Nenhum conteúdo aberto no Preview (Holograma no centro).'
      }`
    : '';

  const docTextContext = documentAttachment?.textContent
    ? `\nCONTEÚDO DO DOCUMENTO ANEXADO (${documentAttachment.name || 'documento'}):\n${String(documentAttachment.textContent).slice(0, 18000)}`
    : activeDocument?.summary
    ? `\nDOCUMENTO ATUAL EM ANÁLISE (${activeDocument.name}):\nResumo: ${activeDocument.summary}\n${activeDocument.textContent ? `Trecho: ${String(activeDocument.textContent).slice(0, 6000)}` : ''}`
    : '';

  const contextEnvelope = `DATA/HORA ATUAL: ${nowIso}
${weatherLine}
${telemetryLine}
${mediaStateLine}
MEMÓRIA PERSISTENTE SOBRE ${memory?.userName || 'o utilizador'}: ${memFacts.length ? memFacts.join(' | ') : 'Sem factos guardados ainda'}
AGENDA ATUAL:
${agendaList.length ? agendaList.join('\n') : '(vazia)'}
TAREFAS ATUAIS:
${taskList.length ? taskList.join('\n') : '(vazias)'}
ALARMES ATUAIS:
${alarmList.length ? alarmList.join('\n') : '(nenhum)'}${docTextContext}

PEDIDO DO UTILIZADOR:
${prompt || 'Analisa o documento anexado e apresenta o resumo completo, pontos-chave e dados extraídos.'}`;

  parts.push({ text: contextEnvelope });
  turns.push({ role: 'user', parts });
  return turns;
}

function parseJarvisJsonResponse(rawText) {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
    return {
      reply: cleaned || 'Estou aqui contigo.',
      voiceSummary: cleaned.slice(0, 180) || 'Pronta para avançar.',
      mood: 'speaking',
      actions: [],
    };
  }
}

export async function runJarvisAssistant(ai, body) {
  const turns = buildJarvisEnvelopeParts(body);

  const { response, modelUsed } = await generateWithFailover(
    ai,
    (model) => ({
      model,
      contents: turns,
      config: {
        systemInstruction: SARA_JARVIS_JSON_PROTOCOL,
        responseMimeType: 'application/json',
        ...(model.startsWith('gemini-4')
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : model.startsWith('gemini-3.1')
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
          : { temperature: 0.9 }),
      },
    }),
    14000,
    MODEL_PRIORITY_CHAIN
  );

  const parsed = parseJarvisJsonResponse(response.text || '');
  const actions = await enrichJarvisActionsNode(parsed.actions);

  return {
    reply: String(parsed.reply || 'Estou aqui contigo.'),
    voiceSummary: String(parsed.voiceSummary || parsed.reply || 'Feito.'),
    mood: parsed.mood || 'speaking',
    actions,
    modelUsed,
  };
}


