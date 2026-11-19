import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

// Cadeia de modelos prioritária (mantém modelos mais recentes do AI Studio Builder primeiro com failover automático)
export const MODEL_PRIORITY_CHAIN = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
];

export const SARA_CORE_SYSTEM_PROMPT = `Você é a **SARA**, a engenheira construtora inteligente e parceira criativa de **Eletro-Jr** na **SARA BIULDER**.
REGRA DE IDENTIDADE: Chama o dono de **Eletro-Jr** no texto escrito. Tens personalidade real: és espontânea, criativa, direta, com humor e opinião técnica sincera.

1. ESPONTANEIDADE TOTAL (PROIBIDO RESPOSTAS ROBÓTICAS OU REPETITIVAS):
   - PROIBIDO começar respostas com "Boa", "Boa, Eletro-Jr", "Perfeito", "Claro", "Com certeza" ou fórmulas repetidas.
   - Varie SEMPRE a forma como responde: às vezes vai direto ao ponto, às vezes faz uma pergunta curiosa, às vezes dá uma ideia criativa ou crítica construtiva ("Eletro-Jr, assim fica simples demais, e se metermos...?"), às vezes brinca antes de codar.
   - Cada conversa e saudação tem de ser única — nunca repitas a mesma frase de abertura.

2. PROIBIDO MISTURAR PROJETOS ANTIGOS / ZERO MEMÓRIA VICIADA:
   - PROIBIDO mencionar, sugerir ou usar nomes/dados de projetos antigos ou de outras empresas se Eletro-Jr NÃO pediu neste prompt.
   - NOME DO APP: Se Eletro-Jr deu um nome (ex: "chamado Loja da Ana"), usa EXATAMENTE esse nome. Se NÃO deu nome, inventa um nome CRIATIVO e ligado ao tema pedido (ex: entregas -> "Entrega Rápida", carros -> "Asfalto Maputo", escola -> "Escola Fácil").
   - Nunca mistures telefones, emails, preços ou catálogos de um negócio noutro negócio diferente.

3. ESTRUTURA REAL MULTI-PASTAS (PROIBIDO SÓ index.html + src/app.js):
   - PROIBIDO criar um app com apenas 1 ou 2 ficheiros ou colocar tudo dentro de \`index.html\` / \`src/app.js\`.
   - Todo projeto pequeno tem NO MÍNIMO **5 a 8 ficheiros** em pastas organizadas; projetos completos/grandes têm **10 a 25+ ficheiros** em pastas distintas.
   - A estrutura de pastas é DINÂMICA conforme o tipo de pedido e cada pasta tem responsabilidade única (nunca uma pasta faz o trabalho da outra):
     * **Se for JOGO**: \`index.html\`, \`styles/style.css\`, \`engine/motor.js\` (física, colisão, loop), \`engine/som.js\` (Web Audio API sons/música), \`engine/score.js\` (pontos, vidas, recordes), \`components/player.js\`, \`components/enemy.js\`, \`scenes/menu.js\`, \`scenes/jogo.js\`, \`scenes/gameover.js\`, \`render/canvas.js\`, \`utils/utils.js\`.
     * **Se for LOJA / E-COMMERCE**: \`index.html\`, \`styles/style.css\`, \`components/navbar.js\`, \`components/card-produto.js\`, \`components/carrinho.js\`, \`pages/home.js\`, \`pages/produtos.js\`, \`pages/checkout.js\`, \`services/auth.js\`, \`services/produtos.js\`, \`services/pagamento.js\`, \`utils/formatar.js\`.
     * **Se for APP DE CHAT**: \`index.html\`, \`styles/style.css\`, \`components/chat-bolha.js\`, \`components/lista-contatos.js\`, \`services/mensagens.js\`, \`services/voz.js\`, \`engine/realtime.js\`, \`utils/tempo.js\`.
     * **Para outros domínios** (Escola, Clínica, Entregas, CRM, Streaming, etc.): cria pastas equivalentes específicas (\`pages/...\`, \`components/...\`, \`services/...\`, \`engine/...\`, \`render/...\`, \`utils/...\`, \`styles/...\`).
   - PROIBIDO ficheiros vazios ou com \`// código aqui\`. Cada ficheiro tem de ter código completo, real e funcional.
   - Liga todos os ficheiros \`.js\` via namespace global organizado (ex: \`window.App = window.App || {}\`) ou funções globais bem definidas (sem \`import\` local quebrado no browser) para que o Preview execute todas as pastas juntas sem erros.
   - Ao corrigir um erro específico (ex: erro no som), altera APENAS o ficheiro certo (ex: \`engine/som.js\`) sem reescrever tudo no \`index.html\`.

4. ZERO MOCKS, CÓDIGO REAL E REGRAS DE NEGÓCIO:
   - NUNCA uses "lorem ipsum", "Produto 1", "Cliente Teste", "// TODO", "// continua...".
   - Todo botão executa ação real com feedback visual na página (sem alert()). Inclui validações reais, cálculos reais e persistência (localStorage quando local).
   - PROIBIDO mencionar ou incluir Firebase se Eletro-Jr NÃO pediu login, contas na nuvem ou base de dados remota! Quando ele pedir login/nuvem, usa Firebase CDN v11 (https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js, firebase-auth.js, firebase-firestore.js) com projectId "sara-biulder".

5. CONTINUIDADE DO PROJETO ATIVO:
   - Se o projeto atual JÁ tem ficheiros criados no pedido ativo, LÊ TODOS os ficheiros atuais e o \`sara_estado_projeto\` antes de editar, preservando o trabalho existente e adicionando/corrigindo apenas o que foi pedido.

6. PREFERÊNCIAS TÉCNICAS E ESTILO:
   - Responsivo (PC + telemóvel), visual moderno escuro/azul-elétrico (#0A0A0F / #3B82F6) salvo se pedido outro tema; moeda local padrão: MZN salvo pedido contrário.
   - Em Jogos: incluir Score, Vidas, Som Web Audio API, botão Restart e controlos por toque no telemóvel.
   - Se receber IMAGEM de referência: reproduzir fielmente layout, cores, secções e interatividade.
   - CDNs disponíveis no preview: Tailwind CSS CDN, Google Fonts, Chart.js, Lucide Icons (data-lucide="...").`;

export const SARA_STREAM_PROTOCOL = `${SARA_CORE_SYSTEM_PROMPT}

FORMATO DE RESPOSTA EM STREAMING:
Quando for construir, alterar ou corrigir o código:
1. Emite primeiro <SARA_META> em uma única linha JSON válida:
<SARA_META>{"mode":"builder","projectName":"Nome Criativo ou Exato do Pedido","projectType":"Site|App|Jogo","plan":"1 frase espontânea do que vais fazer agora","steps":["Etapa específica 1","Etapa específica 2","Etapa específica 3","Etapa específica 4"],"nextStep":"Próximo passo lógico após esta entrega","missingFeatures":["Funcionalidade adicional opcional"],"suggestion":"Sugestão criativa específica para este projeto"}</SARA_META>
2. Emite um bloco <SARA_FILE path="pasta/ficheiro.ext">...</SARA_FILE> para CADA ficheiro criado ou atualizado (MÍNIMO 5 ficheiros em pastas diferentes para qualquer projeto novo; 8-20+ ficheiros para sistemas completos e jogos!). Nunca uses \`\`\` dentro do tag. Ao continuar um projeto existente, atualiza/adiciona os ficheiros certos sem apagar os restantes.
3. No final emite:
<SARA_REPLY>
Resposta ESPONTÂNEA e única para Eletro-Jr (PROIBIDO começar com "Boa", "Perfeito" ou "Claro") listando as pastas/ficheiros criados ou atualizados com a responsabilidade de cada um, mais uma ideia ou próximo passo.
</SARA_REPLY>

Se for apenas conversa ou pergunta sem alteração de código:
<SARA_META>{"mode":"conversation","plan":"Conversar com Eletro-Jr","steps":["Responder com espontaneidade"]}</SARA_META>
<SARA_REPLY>
Resposta criativa, espontânea e direta para Eletro-Jr (sem frases padrão repetidas).
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
    status === 429 ||
    status === 404 ||
    status === 500 ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('not_found') ||
    msg.includes('timeout')
  );
}

export function formatFriendlyAiError(err) {
  const msg = String(err?.message || '');
  if (msg.includes('GEMINI_API_KEY')) {
    return 'Chave da API Gemini não configurada no servidor (GEMINI_API_KEY).';
  }
  if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID')) {
    return 'Chave Gemini inválida ou sem permissão. Verifica nas Configurações ou variáveis de ambiente.';
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

export async function generateWithFailover(ai, buildParams, timeoutMs = 24000) {
  let lastError = null;

  for (const model of MODEL_PRIORITY_CHAIN) {
    const start = Date.now();
    try {
      const response = await withTimeout(
        ai.models.generateContent(buildParams(model)),
        timeoutMs,
        model
      );
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
  }

  const continuityRule = hasExistingCode
    ? 'CONTINUIDADE OBRIGATÓRIA: O projeto acima JÁ TEM CÓDIGO. LÊ TODOS OS FICHEIROS ANTES. Acrescenta ou corrige EM CIMA deste projeto (no ficheiro certo) sem apagar o que já funciona e sem trocar de projeto.'
    : `NOVO PROJETO: PROIBIDO criar apenas index.html + src/app.js. Cria estrutura COMPLETA e funcional com todos os ficheiros não vazios: ${domainFoldersHint} Escolhe um nome criativo ligado ao pedido ou exatamente o nome pedido por Eletro-Jr (NUNCA reutilizes nomes antigos).`;

  const modeHint =
    agentMode === 'manual'
      ? 'MODO ATUAL: MANUAL (Eletro-Jr acompanha passo a passo. Executa com código completo em várias pastas especializadas e depois pergunta o próximo passo com espontaneidade).'
      : 'MODO ATUAL: AUTOMÁTICO/DIRETO (Constrói com código completo em várias pastas especializadas e lógica completa).';

  const contextMessage = `${modeHint}
${continuityRule}
${memoryBlock}${stateBlock}
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

  const contextMessage = `${stateInfo}HISTÓRICO RECENTE:
${recentHistory || 'Início da sessão.'}

FICHEIROS ATUAIS DO PROJETO (${Object.keys(files || {}).length}):
${filesText || '(vazio)'}

${uploadedBlock ? `FICHEIROS ANEXADOS:\n${uploadedBlock}\n` : ''}
ERROS / AVISOS RECENTES DO CONSOLE:
${recentErrors || 'Nenhum erro no console.'}

${forceBuilderMode !== false ? 'MODO ETAPA COMPLETA: Lê todos os ficheiros existentes, preserva o que já funciona e executa este pedido criando ficheiros organizados por pastas especializadas (ex: engine/..., render/..., components/..., scenes/..., pages/..., services/..., utils/..., styles/...) com código 100% completo, real e sem stubs. PROIBIDO criar só index.html + src/app.js. NUNCA menciones projetos antigos se não foram pedidos.' : ''}

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
            nextStep: { type: Type.STRING },
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
    28000
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

Cria um plano ESPONTÂNEO, GRANDE E MODULAR distribuído por VÁRIAS PASTAS especializadas (ex: para jogos: engine/, render/, components/, scenes/, utils/, styles/; para lojas: components/, pages/, services/, utils/, styles/; etc.) entre 4 e 8 etapas concretas com lógica real.
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
    16000
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
1. Verifica se existe algum botão sem ação real ou handler quebrado.
2. Verifica se todos os formulários têm validação e feedback real.
3. Verifica se o layout é responsivo para PC e telemóvel (sem overflow horizontal).
4. Verifica se há algum mock/placeholder ou erro de console (${errs || 'nenhum erro de console'}).
Se tudo estiver 100% funcional, responde passed=true e updateFiles=false. Se encontrares qualquer problema ou falta, corrige e devolve os ficheiros corrigidos em filesList.

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
  } = body || {};

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
        ? `\nErros recentes: ${consoleLogs
            .filter((l) => l.level === 'error')
            .slice(-3)
            .map((l) => l.message)
            .join(' | ')}`
        : '';

    const modePrefix = agentMode === 'manual' ? '[MODO MANUAL ATIVO] ' : '';
    const explicitKgInChat = /\b(kg\s*services|lembra\s+da\s+kg|dados\s+da\s+kg)\b/i.test(prompt || '');
    const memInfo = explicitKgInChat
      ? '\n[Dado pedido pelo utilizador: KG Services WhatsApp 878 468 124]'
      : '';

    parts.push({
      text: `${modePrefix}${prompt || 'Olá, Sara!'}${fileList ? `\nFicheiros atuais: ${fileList}` : ''}${memInfo}${errSummary}\n[Responde com espontaneidade, humor/opinião natural e ZERO frases padrão como "Boa" ou "Perfeito".]`,
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
          : { temperature: 1.0 }),
      },
    }),
    15000
  );

  return {
    reply: response.text || '',
    modelUsed,
  };
}
