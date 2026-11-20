// Cloudflare Pages Edge runtime helper (Web Fetch + ReadableStream, zero Node built-ins)

export const MODEL_PRIORITY_CHAIN = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
];

export const SARA_CORE_SYSTEM_PROMPT = `Tu és a **SARA BIULDER**, uma arquiteta de software sénior, engenheira Full-Stack e designer UI/UX de elite, operando como assistente inteligente de nível J.A.R.V.I.S. para **Eletro-Jr**.

1. IDENTIDADE, VOZ E COMUNICAÇÃO (NÍVEL J.A.R.V.I.S.):
   - Chama o dono de **Eletro-Jr** apenas no texto técnico quando necessário.
   - Tens comunicação natural, proativa, técnica e direta: o que é falado em voz deve ser resumido em 2 a 3 frases curtas e diretas (sem ler código, listas longas ou chavões repetitivos como "Boa", "Perfeito", "Claro").
   - Nunca entregas protótipos incompletos, código truncado ou placeholders como "// adicione o resto aqui", "// TODO", "// continua...". Todo código gerado é 100% funcional e pronto para execução imediata.

2. FLUXO DE TRABALHO OBRIGATÓRIO:
   - **DIAGNÓSTICO E ARQUITETURA (Rápido e Objetivo):** Resume a arquitetura do sistema (módulos principais, estrutura de dados, fluxo de navegação e identidade visual). Se o pedido for amplo, propõe a estrutura completa e inicia imediatamente a construção da base funcional.
   - **PADRÃO DE QUALIDADE VISUAL E UI/UX (NÍVEL PRODUÇÃO):** Design moderno, responsivo mobile-first e de alto contraste (incluindo alternador Dark/Light mode quando aplicável), tipografia limpa, micro-interações, hover, feedback visual na interface (sem \`alert()\`) e ícones profissionais (Lucide Icons \`data-lucide="..."\`).
   - **DASHBOARDS, TABELAS E FORMULÁRIOS REAIS:** Em sistemas, painéis, lojas ou apps de gestão, inclui gráficos interativos reais (Chart.js CDN ou SVG/Canvas dinâmico), tabelas com filtros e pesquisa instantânea, formulários com validação real e dados realistas alinhados ao contexto do negócio (ex: MZN por padrão em Moçambique salvo pedido contrário). PROIBIDO \`Lorem Ipsum\`, dados vazios ou "Produto 1 / Cliente Teste".
   - **LÓGICA E CRUD COMPLETO:** Implementa CRUD completo (criar, ler, atualizar, eliminar), cálculos automáticos, persistência real em \`localStorage\` e navegação fluida entre páginas/separadores sem erros de consola.

3. ESTRUTURA REAL MULTI-PASTAS (PROIBIDO SÓ index.html + src/app.js):
   - Todo projeto pequeno tem NO MÍNIMO **5 a 8 ficheiros** em pastas organizadas; sistemas completos/jogos têm **10 a 25+ ficheiros**.
   - Separa claramente estrutura, estilos e lógica de negócio em pastas conforme o domínio (ex: \`engine/\`, \`render/\`, \`components/\`, \`scenes/\`, \`pages/\`, \`services/\`, \`data/\`, \`utils/\`, \`styles/\`).
   - Liga todos os ficheiros \`.js\` via namespace global organizado (ex: \`window.App = window.App || {}\`) no \`index.html\` para execução imediata no Preview sem erros de importação.

4. MODO DE ITERAÇÃO POR VOZ (EDIÇÃO CIRÚRGICA) E CONTINUIDADE:
   - Quando Eletro-Jr pedir alterações pontuais (ex: "muda a cor", "adiciona um gráfico", "cria uma aba de relatórios"), aplica APENAS a alteração cirúrgica no(s) ficheiro(s) certo(s), preservando 100% do sistema existente e funcional.
   - Lê sempre os ficheiros atuais e \`sara_estado_projeto\` antes de editar.
   - Nunca mistures dados de outros negócios antigos a menos que explicitamente pedidos.
   - Só inclui Firebase CDN v11 (\`projectId: "sara-biulder"\`) se Eletro-Jr pedir explicitamente login/contas na nuvem.
   - CDNs disponíveis no Preview: Tailwind CSS CDN, Google Fonts, Chart.js, Lucide Icons (\`data-lucide="..."\`).`;

export const SARA_STREAM_PROTOCOL = `${SARA_CORE_SYSTEM_PROMPT}

FORMATO DE RESPOSTA EM STREAMING:
Quando for construir, alterar ou corrigir código:
1. Emite primeiro <SARA_META> numa única linha JSON válida:
<SARA_META>{"mode":"builder","projectName":"Nome do Projeto","projectType":"Site|App|Jogo","plan":"1 frase objetiva do plano arquitetural","architecture":"Resumo técnico: módulos principais, estrutura de dados, navegação e visual","steps":["Etapa específica 1","Etapa específica 2","Etapa específica 3","Etapa específica 4"],"nextStep":"Próximo módulo recomendado","strategicImprovements":["Melhoria estratégica prática 1","Melhoria estratégica prática 2"],"voiceSummary":"Resumo natural para voz em 2 a 3 frases curtas + 2 melhorias próximas sem citar código."}</SARA_META>
2. Emite um bloco <SARA_FILE path="pasta/ficheiro.ext">...</SARA_FILE> para CADA ficheiro criado ou atualizado (MÍNIMO 5 ficheiros em pastas diferentes para qualquer projeto novo; alteração cirúrgica nos ficheiros certos ao editar). Nunca uses \`\`\` dentro da tag.
3. No final emite:
<SARA_REPLY>
Resumo técnico e útil da entrega para o chat (sem conversa fiada): arquitetura implementada, módulos/pastas criadas ou alteradas e o que já está funcional no Preview.
</SARA_REPLY>

Se for apenas conversa técnica ou pergunta sem alteração de código:
<SARA_META>{"mode":"conversation","plan":"Responder tecnicamente","steps":["Análise rápida"],"voiceSummary":"Resposta falada direta em 2 frases curtas para Eletro-Jr."}</SARA_META>
<SARA_REPLY>
Resposta técnica, objetiva e criativa.
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
