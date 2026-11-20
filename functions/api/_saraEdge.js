// Cloudflare Pages Edge runtime helper (Web Fetch + ReadableStream, zero Node built-ins)

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
    status === 429 ||
    status === 404 ||
    status === 500 ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('unavailable') ||
    lower.includes('resource_exhausted') ||
    lower.includes('timeout')
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
  }

  const continuityRule = hasExistingCode
    ? 'CONTINUIDADE OBRIGATÓRIA: O projeto acima JÁ TEM CÓDIGO. LÊ TODOS OS FICHEIROS ANTES. Acrescenta ou corrige EM CIMA deste projeto (no ficheiro certo) sem apagar o que já funciona e sem trocar de projeto.'
    : `NOVO PROJETO: PROIBIDO criar apenas index.html + src/app.js. Cria estrutura COMPLETA e funcional com todos os ficheiros não vazios: ${domainFoldersHint} Escolhe um nome criativo ligado ao pedido ou exatamente o nome pedido por Eletro-Jr.`;

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

export async function callGeminiRestWithFailover(apiKey, buildRequestBody, timeoutMs = 26000) {
  let lastError = null;

  for (const model of MODEL_PRIORITY_CHAIN) {
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
