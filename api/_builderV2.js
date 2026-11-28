import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  MODEL_PRIORITY_CHAIN,
  isModelOnlyError,
  isRetryableModelError,
  parseCoreKeyList,
  safeParseJson,
  withTimeout,
} from './_saraCore.js';

export const BUILDER_V2_ROLES = [
  { id: 'ARQUITETA', index: 0, label: 'Arquiteta', focus: 'Estrutura, briefing, pastas e plano sem código' },
  { id: 'CONSTRUTORA', index: 1, label: 'Construtora', focus: 'Escrita modular de código completo' },
  { id: 'DESIGNER', index: 2, label: 'Designer', focus: 'Cores, estética, tipografia e responsivo' },
  { id: 'TESTADORA', index: 3, label: 'Testadora', focus: 'Auditoria, erros, botões e responsividade' },
  { id: 'GESTORA', index: 4, label: 'Memória / Gestora', focus: 'Contrato fixo, escopo e entrega' },
];

// Regista cooldown temporário (45s) em chaves que atingiram quota/429 para failover instantâneo
const keyCooldownUntil = new Map();

export function resolveBuilderV2Keys(overrideHeader) {
  const headerKeys = parseCoreKeyList(overrideHeader);
  const viteDashRaw = process.env['VITE-GEMINI-API-KEY'] || '';
  const fallbackRaw =
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEYS ||
    process.env.GOOGLE_API_KEY ||
    '';

  const primaryPool = parseCoreKeyList(viteDashRaw);
  const secondaryPool = parseCoreKeyList(fallbackRaw);

  const merged = [];
  const seen = new Set();
  for (const k of [...primaryPool, ...headerKeys, ...secondaryPool]) {
    if (!seen.has(k)) {
      seen.add(k);
      merged.push(k);
    }
  }
  if (merged.length === 0) {
    throw new Error('CHAVE_NUCLEO_MISSING');
  }
  return merged;
}

function getOrderedKeysForRole(keys, roleIndex) {
  const total = keys.length;
  if (total === 0) return [];
  const start = roleIndex % total;
  const now = Date.now();

  const rotated = [];
  for (let i = 0; i < total; i++) {
    rotated.push(keys[(start + i) % total]);
  }

  const healthy = rotated.filter((k) => (keyCooldownUntil.get(k) || 0) <= now);
  const cooling = rotated.filter((k) => (keyCooldownUntil.get(k) || 0) > now);
  return [...healthy, ...cooling];
}

function createGenAiClient(apiKey) {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function callRoleWithFailover(
  keys,
  roleId,
  buildParams,
  timeoutMs = 20000,
  modelChain = MODEL_PRIORITY_CHAIN
) {
  const roleDef = BUILDER_V2_ROLES.find((r) => r.id === roleId) || BUILDER_V2_ROLES[0];
  const orderedKeys = getOrderedKeysForRole(keys, roleDef.index);
  let lastError = null;
  let usedKeySlot = (roleDef.index % keys.length) + 1;

  for (const model of modelChain) {
    let modelUnavailableGlobally = false;
    for (let i = 0; i < orderedKeys.length; i++) {
      const apiKey = orderedKeys[i];
      const slotIdx = keys.indexOf(apiKey) + 1;
      const client = createGenAiClient(apiKey);
      const perTryMs = i === 0 && model === modelChain[0] ? timeoutMs : Math.min(timeoutMs, 14000);
      try {
        const response = await withTimeout(
          client.models.generateContent(buildParams(model)),
          perTryMs,
          `${roleId}:${model}`
        );
        const text = response?.text ? String(response.text) : '';
        if (!text.trim()) {
          throw new Error(`Resposta vazia de ${roleId} (${model})`);
        }
        usedKeySlot = slotIdx;
        return { text, modelUsed: model, keySlotUsed: usedKeySlot, roleId };
      } catch (err) {
        lastError = err;
        const msg = String(err?.message || '').toLowerCase();
        const status = err?.status || err?.code;
        if (status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) {
          keyCooldownUntil.set(apiKey, Date.now() + 45000);
        }
        if (isModelOnlyError(err)) {
          modelUnavailableGlobally = true;
          break;
        }
        if (!isRetryableModelError(err)) {
          break;
        }
      }
    }
    if (modelUnavailableGlobally) continue;
  }

  const exhaustedErr = new Error(`Núcleo ocupado em ${roleId}, a reajustar chave...`);
  exhaustedErr.status = 503;
  exhaustedErr.cause = lastError;
  throw exhaustedErr;
}

const PT_BASE_RULE = `És uma engenheira sénior da equipa SARA BUILDER V2.
Falas em português de Portugal claro, formal simples, educado e direto (ZERO gírias, ZERO TODOs, ZERO "aqui falta").
Comentários no código devem ser em português simples e claro.
Nomes de ficheiros e componentes devem ser claros em português (ex.: BotaoEnviar.tsx, PaginaLoja.tsx, ServicoProdutos.ts, EcraInicio.kt).`;

function normalizeStack(rawStack) {
  const s = String(rawStack || '').toLowerCase();
  if (s.includes('hybrid') || s.includes('hibrid') || (s.includes('web') && s.includes('android'))) {
    return 'hybrid-web-android';
  }
  if (s.includes('android') || s.includes('kotlin') || s.includes('compose') || s.includes('apk')) {
    return 'android-kotlin';
  }
  return 'nextjs-vite-tsx';
}

function defaultFolderGuidelines(stack) {
  if (stack === 'android-kotlin') {
    return `ESTRUTURA ANDROID OBRIGATÓRIA (Kotlin + Jetpack Compose):
/android-app/build.gradle.kts
/android-app/app/build.gradle.kts
/android-app/app/src/main/AndroidManifest.xml
/android-app/app/src/main/kotlin/com/projeto/ui/ (ecrãs e componentes Compose em .kt)
/android-app/app/src/main/kotlin/com/projeto/viewmodel/ (ViewModels em .kt)
/android-app/app/src/main/kotlin/com/projeto/data/ (modelos e repositórios em .kt)
/android-app/app/src/main/kotlin/com/projeto/navigation/ (rotas Navigation Compose em .kt)
/android-app/app/src/main/res/layout/ (recursos XML complementares)
/README.md`;
  }
  if (stack === 'hybrid-web-android') {
    return `ESTRUTURA HÍBRIDA OBRIGATÓRIA (Pastas separadas, ZERO mistura):
/web/src/components/
/web/src/pages/
/web/src/hooks/
/web/src/services/
/web/src/utils/
/web/src/styles/
/web/src/assets/
/web/src/types/
/web/public/
/web/package.json, /web/vite.config.ts, /web/tsconfig.json, /web/tailwind.config.js, /web/postcss.config.js, /web/.env.example, /web/index.html
/android-app/build.gradle.kts
/android-app/app/build.gradle.kts
/android-app/app/src/main/AndroidManifest.xml
/android-app/app/src/main/kotlin/com/projeto/ui/
/android-app/app/src/main/kotlin/com/projeto/viewmodel/
/android-app/app/src/main/kotlin/com/projeto/data/
/android-app/app/src/main/kotlin/com/projeto/navigation/
/android-app/app/src/main/res/layout/
/README.md`;
  }
  return `ESTRUTURA WEB OBRIGATÓRIA (Next.js + Vite + React + TypeScript + Tailwind):
/src/components/
/src/pages/
/src/hooks/
/src/services/
/src/utils/
/src/styles/
/src/assets/
/src/types/
/public/
index.html
package.json
vite.config.ts
tsconfig.json
tailwind.config.js
postcss.config.js
.env.example
README.md`;
}

// PASSO 1: BRIEFING (Chave 1 ARQUITETA + Chave 5 GESTORA em paralelo)
async function executeBriefingStage(keys, body) {
  const { prompt = '', history = [], activeContract = null, hasExistingCode = false } = body;
  const recentHist = (history || [])
    .slice(-6)
    .map((m) => `${m.sender === 'user' ? 'Utilizador' : 'SARA'}: ${m.text}`)
    .join('\n');

  const architectPromise = callRoleWithFailover(
    keys,
    'ARQUITETA',
    (model) => ({
      model,
      contents: `Pedido do utilizador: "${prompt}".
Histórico recente:
${recentHist || '(início)'}

REGRAS DA ARQUITETA (CHAVE 1):
- NUNCA escrevas código nesta fase.
- Faz o PASSO 1 — BRIEFING claro e curto em português simples.
- Resume o que já percebeste do pedido (se houver) e faz as 5 perguntas essenciais de briefing:
  1. Para quem é este projeto (público-alvo)?
  2. O que vai fazer exatamente (objetivo principal)?
  3. Queres Web (Next.js/Vite), App Android (Kotlin) ou Híbrido (Web + Android)?
  4. Que cores preferes (ex.: azul e branco, escuro com verde, etc.)?
  5. Que funções obrigatórias precisa ter?
- Termina convidando o utilizador a responder para avançares para o PASSO 2 (Estrutura).`,
      config: {
        systemInstruction: `${PT_BASE_RULE}\nÉs a ARQUITETA (Chave 1). Só pensas e planeias. NUNCA geres código.`,
        ...(model.startsWith('gemini-4') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            detectedType: { type: Type.STRING },
            detectedColors: { type: Type.STRING },
            detectedAudience: { type: Type.STRING },
            missingQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            voiceSummary: { type: Type.STRING },
          },
          required: ['reply', 'missingQuestions', 'voiceSummary'],
        },
      },
    }),
    15000
  );

  const gestoraPromise =
    activeContract?.locked && hasExistingCode
      ? callRoleWithFailover(
          keys,
          'GESTORA',
          (model) => ({
            model,
            contents: `Contrato ativo: ${JSON.stringify({
              projectName: activeContract.projectName,
              stack: activeContract.stack,
              pages: activeContract.pages,
              functions: activeContract.functions,
            })}.
Novo pedido: "${prompt}".
Avalia se este pedido é dentro do MESMO projeto ou se parece um NOVO projeto diferente.`,
            config: {
              systemInstruction: `${PT_BASE_RULE}\nÉs a MEMÓRIA / GESTORA (Chave 5). Impedes misturar projetos.`,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  isDifferentProject: { type: Type.BOOLEAN },
                  reason: { type: Type.STRING },
                },
                required: ['isDifferentProject', 'reason'],
              },
            },
          }),
          11000
        ).catch(() => null)
      : Promise.resolve(null);

  const [archRes, gestRes] = await Promise.all([architectPromise, gestoraPromise]);
  const parsed = safeParseJson(archRes.text);
  const scopeCheck = gestRes ? safeParseJson(gestRes.text) : { isDifferentProject: false };

  return {
    stage: 'briefing',
    reply: parsed.reply,
    missingQuestions: parsed.missingQuestions || [],
    detectedType: parsed.detectedType,
    detectedColors: parsed.detectedColors,
    detectedAudience: parsed.detectedAudience,
    voiceSummary: parsed.voiceSummary || parsed.reply,
    scopeDrift: Boolean(scopeCheck?.isDifferentProject),
    agentTelemetry: [
      { role: 'ARQUITETA', keySlot: archRes.keySlotUsed, modelUsed: archRes.modelUsed, status: 'done' },
      ...(gestRes
        ? [{ role: 'GESTORA', keySlot: gestRes.keySlotUsed, modelUsed: gestRes.modelUsed, status: 'done' }]
        : []),
    ],
  };
}

// PASSO 2 & 3: ESTRUTURA + DESIGN TOKENS + CONTRATO FIXO (Chave 1 + Chave 3 + Chave 5 em paralelo)
async function executeStructureStage(keys, body) {
  const {
    prompt = '',
    briefingPrompt = '',
    existingContract = null,
    isRefinement = false,
  } = body;

  const combinedBrief = briefingPrompt
    ? `Pedido inicial: ${briefingPrompt}\nRespostas / Ajustes do utilizador: ${prompt}`
    : prompt;

  const inferredStack = normalizeStack(
    `${combinedBrief} ${existingContract?.stack || ''}`
  );

  const archPromise = callRoleWithFailover(
    keys,
    'ARQUITETA',
    (model) => ({
      model,
      contents: `${isRefinement ? 'ATUALIZAÇÃO DE ESTRUTURA (PASSO 3 — sem escrever código):' : 'PASSO 2 — DESENHO DE ESTRUTURA E CONTRATO:'}
Contexto completo do projeto:
${combinedBrief}
${existingContract ? `Contrato atual a atualizar/refinar: ${JSON.stringify(existingContract)}` : ''}

Stack recomendada: ${inferredStack}.
${defaultFolderGuidelines(inferredStack)}

REGRAS ESTRITAS:
1. NUNCA escrevas código nesta fase.
2. Cria um Contrato Fixo com: projectName, stack ("nextjs-vite-tsx" | "android-kotlin" | "hybrid-web-android"), audience, purpose, colors, pages, functions, userFlow, folderTree (lista completa de caminhos de ficheiros em pastas especializadas, mínimo 10-16 ficheiros com nomes claros em português).
3. Divide a construção em 3 a 5 PARTES lógicas e ordenadas (partsQueue) onde cada parte tem: id, title, description, targetFiles (ficheiros exactos dessa parte).
4. Em "summaryText", apresenta de forma clara e simples o resumo das páginas, funções, árvore de pastas e termina perguntando: "O projeto vai ter estas páginas e funções. Concordas? (Responde SIM para aprovar ou diz o que queres mudar.)"`,
      config: {
        systemInstruction: `${PT_BASE_RULE}\nÉs a ARQUITETA (Chave 1). Desenhas estrutura modular com pastas e contrato fixo. NUNCA escreves código.`,
        ...(model.startsWith('gemini-4') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            projectName: { type: Type.STRING },
            stack: { type: Type.STRING },
            audience: { type: Type.STRING },
            purpose: { type: Type.STRING },
            colors: { type: Type.STRING },
            pages: { type: Type.ARRAY, items: { type: Type.STRING } },
            functions: { type: Type.ARRAY, items: { type: Type.STRING } },
            userFlow: { type: Type.ARRAY, items: { type: Type.STRING } },
            folderTree: { type: Type.ARRAY, items: { type: Type.STRING } },
            partsQueue: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  targetFiles: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['id', 'title', 'description', 'targetFiles'],
              },
            },
            summaryText: { type: Type.STRING },
            voiceSummary: { type: Type.STRING },
          },
          required: [
            'projectName',
            'stack',
            'audience',
            'purpose',
            'colors',
            'pages',
            'functions',
            'folderTree',
            'partsQueue',
            'summaryText',
          ],
        },
      },
    }),
    20000
  );

  // Designer (Chave 3) define em paralelo a paleta e tokens visuais exatos
  const designerPromise = callRoleWithFailover(
    keys,
    'DESIGNER',
    (model) => ({
      model,
      contents: `Define os tokens visuais (paleta 60-30-10, cores exatas pedidas, fontes e padrão responsivo) para este pedido:
${combinedBrief}`,
      config: {
        systemInstruction: `${PT_BASE_RULE}\nÉs a DESIGNER (Chave 3). Cuidas apenas da beleza, cores exatas, tipografia e responsividade.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            primaryHex: { type: Type.STRING },
            secondaryHex: { type: Type.STRING },
            accentHex: { type: Type.STRING },
            backgroundHex: { type: Type.STRING },
            surfaceHex: { type: Type.STRING },
            themeMode: { type: Type.STRING },
            typography: { type: Type.STRING },
            designRulesSummary: { type: Type.STRING },
          },
          required: ['primaryHex', 'accentHex', 'backgroundHex', 'themeMode', 'designRulesSummary'],
        },
      },
    }),
    14000
  ).catch(() => null);

  const [archRes, designRes] = await Promise.all([archPromise, designerPromise]);
  const parsed = safeParseJson(archRes.text);
  const designTokens = designRes ? safeParseJson(designRes.text) : null;

  const finalStack = normalizeStack(parsed.stack || inferredStack);
  const contract = {
    projectName: parsed.projectName || existingContract?.projectName || 'Projeto SARA',
    stack: finalStack,
    audience: parsed.audience || 'Utilizadores finais',
    purpose: parsed.purpose || combinedBrief.slice(0, 140),
    colors: parsed.colors || designTokens?.designRulesSummary || 'Moderna com alto contraste',
    designTokens: designTokens || undefined,
    pages: Array.isArray(parsed.pages) ? parsed.pages : ['Início'],
    functions: Array.isArray(parsed.functions) ? parsed.functions : ['Funcionalidades principais'],
    userFlow: Array.isArray(parsed.userFlow) ? parsed.userFlow : [],
    folderTree: Array.isArray(parsed.folderTree) ? parsed.folderTree : [],
    partsQueue: (Array.isArray(parsed.partsQueue) ? parsed.partsQueue : []).map((p, idx) => ({
      id: p.id || idx + 1,
      title: p.title || `Parte ${idx + 1}`,
      description: p.description || '',
      targetFiles: Array.isArray(p.targetFiles) ? p.targetFiles : [],
      status: 'pending',
      attempts: 0,
    })),
    currentPartIndex: 0,
    completedParts: [],
    phase: 'awaiting_approval',
    locked: true,
    updatedAt: new Date().toISOString(),
  };

  return {
    stage: isRefinement ? 'refine_structure' : 'structure',
    reply: parsed.summaryText,
    voiceSummary: parsed.voiceSummary || 'Desenhei a estrutura completa com pastas. Podes confirmar se concordas.',
    contract,
    agentTelemetry: [
      { role: 'ARQUITETA', keySlot: archRes.keySlotUsed, modelUsed: archRes.modelUsed, status: 'done' },
      ...(designRes
        ? [{ role: 'DESIGNER', keySlot: designRes.keySlotUsed, modelUsed: designRes.modelUsed, status: 'done' }]
        : []),
      { role: 'GESTORA', keySlot: (4 % keys.length) + 1, modelUsed: archRes.modelUsed, status: 'done' },
    ],
  };
}

// PASSO 4: CONSTRUIR 1 PARTE COM AS 5 CHAVES (Construtora + Designer + Testadora + Arquiteta + Gestora)
async function executeBuildPartStage(keys, body) {
  const {
    contract,
    partIndex = 0,
    existingFiles = {},
    attemptNumber = 1,
    userAdjustment = '',
  } = body;

  const part = contract?.partsQueue?.[partIndex];
  if (!part) {
    throw new Error('Parte do contrato não encontrada.');
  }

  const telemetry = [];
  let simplifiedNotice = '';
  let activePartSpec = `${part.title} — ${part.description}`;
  let activeTargetFiles = Array.isArray(part.targetFiles) ? part.targetFiles : [];

  // Se falhou 2 vezes antes, a ARQUITETA (Chave 1) simplifica o desenho com aviso obrigatório!
  if (attemptNumber >= 3) {
    const simpRes = await callRoleWithFailover(
      keys,
      'ARQUITETA',
      (model) => ({
        model,
        contents: `A parte "${part.title}" falhou 2 vezes ao construir/validar.
Simplifica a arquitetura desta parte para uma versão mais limpa, direta e 100% funcional usando os mesmos ficheiros essenciais (${activeTargetFiles.join(', ')}).
Contrato do projeto: ${contract.projectName} (${contract.stack}).`,
        config: {
          systemInstruction: `${PT_BASE_RULE}\nÉs a ARQUITETA (Chave 1). Simplificas partes complexas quando falham 2 vezes.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              simplifiedSpec: { type: Type.STRING },
              targetFiles: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['simplifiedSpec', 'targetFiles'],
          },
        },
      }),
      12000
    );
    telemetry.push({ role: 'ARQUITETA', keySlot: simpRes.keySlotUsed, modelUsed: simpRes.modelUsed, status: 'done' });
    const simpJson = safeParseJson(simpRes.text);
    activePartSpec = simpJson.simplifiedSpec || activePartSpec;
    if (Array.isArray(simpJson.targetFiles) && simpJson.targetFiles.length > 0) {
      activeTargetFiles = simpJson.targetFiles;
    }
    simplifiedNotice = 'Esta parte é complexa, vou fazer de forma mais simples para funcionar.';
  }

  const existingSummary = Object.entries(existingFiles || {})
    .filter(([p]) => !/^package-lock\.json$/i.test(p))
    .slice(0, 18)
    .map(([p, c]) => `--- ${p} ---\n${String(c || '').slice(0, 3500)}`)
    .join('\n\n');

  const stackHint =
    contract.stack === 'android-kotlin'
      ? 'Usa Kotlin + Jetpack Compose (.kt) em /android-app/app/src/main/kotlin/com/projeto/{ui,viewmodel,data,navigation} + XML em res/layout/.'
      : contract.stack === 'hybrid-web-android'
      ? 'Separa rigorosamente o código Web em /web/src/... (.tsx/.ts) e o código Android em /android-app/app/src/main/kotlin/com/projeto/... (.kt), ZERO mistura.'
      : 'Usa Next.js + Vite + React + TypeScript (.tsx/.ts) + Tailwind CSS em /src/{components,pages,hooks,services,utils,styles,types} e index.html compatível com Preview.';

  // 1) CONSTRUTORA (Chave 2) escreve o código desta parte seguindo estritamente o contrato
  const buildRes = await callRoleWithFailover(
    keys,
    'CONSTRUTORA',
    (model) => ({
      model,
      contents: `CONTRATO FIXO DO PROJETO (PROIBIDO DESVIAR OU MISTURAR OUTRO PROJETO):
- Nome: ${contract.projectName}
- Stack: ${contract.stack} (${stackHint})
- Público: ${contract.audience}
- Objetivo: ${contract.purpose}
- Cores / Design: ${contract.colors} ${contract.designTokens ? JSON.stringify(contract.designTokens) : ''}
- Páginas: ${(contract.pages || []).join(', ')}
- Funções: ${(contract.functions || []).join(', ')}
- Árvore prevista: ${(contract.folderTree || []).join(', ')}

PARTE ATUAL A CONSTRUIR (${partIndex + 1} de ${contract.partsQueue.length}):
- Título: ${part.title}
- Especificação: ${activePartSpec}
- Ficheiros alvo sugeridos: ${activeTargetFiles.join(', ') || 'definir nas pastas certas'}
${userAdjustment ? `- Ajuste do utilizador: ${userAdjustment}` : ''}

FICHEIROS JÁ EXISTENTES NO PROJETO:
${existingSummary || '(projeto novo — primeira parte)'}

REGRAS DA CONSTRUTORA (CHAVE 2):
1. Escreve código 100% completo e real, comentado em português simples.
2. NUNCA uses "TODO", "FIXME", "aqui falta" ou stubs vazios.
3. Nomes de ficheiros e identificadores claros em português (ex.: BotaoEnviar.tsx, PaginaLoja.tsx, EcraInicio.kt).
4. Se for Web/Híbrido e ainda não existir ponto de entrada visível no Preview, garante ligação limpa em index.html + src/App.tsx / src/pages/ para funcionar imediatamente no Preview.
5. Mantém todos os ficheiros anteriores intactos e compatíveis.`,
      config: {
        systemInstruction: `${PT_BASE_RULE}\nÉs a CONSTRUTORA (Chave 2). Segues rigorosamente o desenho da Arquiteta e nunca inventas outro projeto.`,
        ...(model.startsWith('gemini-4') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
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
            summaryDone: { type: Type.STRING },
            notes: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['filesList', 'summaryDone'],
        },
      },
    }),
    26000
  );
  telemetry.push({ role: 'CONSTRUTORA', keySlot: buildRes.keySlotUsed, modelUsed: buildRes.modelUsed, status: 'done' });

  const builtParsed = safeParseJson(buildRes.text);
  let partFiles = {};
  for (const item of builtParsed.filesList || []) {
    if (item?.path && typeof item.content === 'string') {
      const cleanPath = String(item.path).trim().replace(/^\/+/, '');
      partFiles[cleanPath] = item.content;
    }
  }

  const nextPart = contract.partsQueue[partIndex + 1];
  const mergedForAudit = { ...existingFiles, ...partFiles };
  const auditSnapshot = Object.entries(mergedForAudit)
    .slice(0, 20)
    .map(([p, c]) => `--- ${p} ---\n${String(c || '').slice(0, 3200)}`)
    .join('\n\n');

  // 2) EXECUÇÃO PARALELA REAL DAS OUTRAS CHAVES:
  //    - Chave 4 (TESTADORA) valida código/TODOs/erros/botões/responsivo
  //    - Chave 3 (DESIGNER) verifica harmonia de cores/responsividade e propõe melhorias de estilo se necessário
  //    - Chave 1 (ARQUITETA) pré-prepara a próxima parte em paralelo (se houver próxima parte)
  const testPromise = callRoleWithFailover(
    keys,
    'TESTADORA',
    (model) => ({
      model,
      contents: `Audita RIGOROSAMENTE estes ficheiros da parte "${part.title}" do projeto "${contract.projectName}" (${contract.stack}):
${auditSnapshot}

PROCURA:
1. Qualquer "TODO", "FIXME", "aqui falta" ou código incompleto/truncado.
2. Erros de sintaxe JS/TS/TSX/Kotlin, chaves desbalanceadas ou imports partidos.
3. Botões sem ação/onClick ou formulários sem handler.
4. Falta de responsividade (PC, Tablet, Telemóvel).
Se encontrares algum problema bloqueante, lista em "issues" e marca "passed": false.`,
      config: {
        systemInstruction: `${PT_BASE_RULE}\nÉs a TESTADORA (Chave 4). Nunca aprovas código partido ou com TODO.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            passed: { type: Type.BOOLEAN },
            issues: { type: Type.ARRAY, items: { type: Type.STRING } },
            checksPassed: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING },
          },
          required: ['passed', 'issues', 'summary'],
        },
      },
    }),
    15000
  );

  const designerPromise = callRoleWithFailover(
    keys,
    'DESIGNER',
    (model) => ({
      model,
      contents: `Revê o aspeto visual e responsividade destes ficheiros criados na parte "${part.title}" (cores pedidas: ${contract.colors}):
${Object.entries(partFiles)
  .map(([p, c]) => `--- ${p} ---\n${String(c || '').slice(0, 2200)}`)
  .join('\n\n')}

Dá 1 a 3 notas curtas de acabamento visual e confirma se as cores e responsividade estão certas.`,
      config: {
        systemInstruction: `${PT_BASE_RULE}\nÉs a DESIGNER (Chave 3). Garantes beleza, cores exatas e layout responsivo.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            visualOk: { type: Type.BOOLEAN },
            polishNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['visualOk', 'polishNotes'],
        },
      },
    }),
    12000
  ).catch(() => null);

  const nextPrepPromise =
    nextPart && attemptNumber === 1
      ? callRoleWithFailover(
          keys,
          'ARQUITETA',
          (model) => ({
            model,
            contents: `Prepara brevemente a especificação técnica da próxima parte "${nextPart.title}" (${nextPart.description}) para manter continuidade perfeita com os ficheiros de "${part.title}": ${Object.keys(partFiles).join(', ')}.`,
            config: {
              systemInstruction: `${PT_BASE_RULE}\nÉs a ARQUITETA (Chave 1). Preparas a próxima parte sem escrever código.`,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  nextPartHint: { type: Type.STRING },
                },
                required: ['nextPartHint'],
              },
            },
          }),
          10000
        ).catch(() => null)
      : Promise.resolve(null);

  const [testRes, designRes, nextPrepRes] = await Promise.all([
    testPromise,
    designerPromise,
    nextPrepPromise,
  ]);

  telemetry.push({ role: 'TESTADORA', keySlot: testRes.keySlotUsed, modelUsed: testRes.modelUsed, status: 'done' });
  if (designRes) {
    telemetry.push({ role: 'DESIGNER', keySlot: designRes.keySlotUsed, modelUsed: designRes.modelUsed, status: 'done' });
  }
  if (nextPrepRes) {
    telemetry.push({ role: 'ARQUITETA', keySlot: nextPrepRes.keySlotUsed, modelUsed: nextPrepRes.modelUsed, status: 'done' });
  }

  let testAudit = safeParseJson(testRes.text);
  const designReview = designRes ? safeParseJson(designRes.text) : { visualOk: true, polishNotes: [] };
  const nextPrepData = nextPrepRes ? safeParseJson(nextPrepRes.text) : null;

  // 3) Se a TESTADORA encontrou problemas, a CONSTRUTORA (Chave 2) corrige ANTES de mostrar ao utilizador!
  let autoRepaired = false;
  if (!testAudit.passed && Array.isArray(testAudit.issues) && testAudit.issues.length > 0) {
    const fixRes = await callRoleWithFailover(
      keys,
      'CONSTRUTORA',
      (model) => ({
        model,
        contents: `A TESTADORA detetou estes erros antes da entrega:
${testAudit.issues.map((iss, i) => `${i + 1}. ${iss}`).join('\n')}

Corrige TODOS os erros nos ficheiros abaixo e devolve os ficheiros corrigidos 100% completos (zero TODOs):
${Object.entries(partFiles)
  .map(([p, c]) => `--- ${p} ---\n${c}`)
  .join('\n\n')}`,
        config: {
          systemInstruction: `${PT_BASE_RULE}\nÉs a CONSTRUTORA (Chave 2). Corriges erros da Testadora antes de entregar ao utilizador.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
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
            required: ['filesList'],
          },
        },
      }),
      20000
    );
    const fixParsed = safeParseJson(fixRes.text);
    for (const item of fixParsed.filesList || []) {
      if (item?.path && typeof item.content === 'string') {
        partFiles[String(item.path).trim().replace(/^\/+/, '')] = item.content;
      }
    }
    autoRepaired = true;
    testAudit = {
      ...testAudit,
      passed: true,
      summary: `${testAudit.summary} (Erros corrigidos automaticamente pela Construtora antes da entrega.)`,
    };
  }

  // Chave 5 (MEMÓRIA / GESTORA) fecha o registo de entrega
  telemetry.push({ role: 'GESTORA', keySlot: (4 % keys.length) + 1, modelUsed: buildRes.modelUsed, status: 'done' });

  return {
    stage: 'build_part',
    partIndex,
    partTitle: part.title,
    files: partFiles,
    summaryDone: builtParsed.summaryDone,
    simplifiedNotice: simplifiedNotice || undefined,
    autoRepaired,
    nextPartHint: nextPrepData?.nextPartHint,
    testReport: {
      passed: Boolean(testAudit.passed),
      issues: testAudit.issues || [],
      checksPassed: testAudit.checksPassed || [],
      summary: testAudit.summary || 'Código validado pela Testadora.',
    },
    designNotes: designReview?.polishNotes || [],
    agentTelemetry: telemetry,
  };
}

// Verificação de desvio de projeto (Chave 5 MEMÓRIA / GESTORA)
async function executeScopeCheckStage(keys, body) {
  const { prompt = '', contract } = body;
  const res = await callRoleWithFailover(
    keys,
    'GESTORA',
    (model) => ({
      model,
      contents: `Projeto atualmente em construção (CONTRATO FIXO):
- Nome: ${contract?.projectName}
- Stack: ${contract?.stack}
- Páginas: ${(contract?.pages || []).join(', ')}
- Funções: ${(contract?.functions || []).join(', ')}

Nova mensagem do utilizador: "${prompt}".

Decide:
- "sameProject": true se for continuação, ajuste, nova secção ou correção DENTRO deste mesmo projeto; false se o utilizador pediu claramente outro projeto/app/site diferente.`,
      config: {
        systemInstruction: `${PT_BASE_RULE}\nÉs a MEMÓRIA / GESTORA (Chave 5). Proteges o projeto ativo contra misturas.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sameProject: { type: Type.BOOLEAN },
            detectedIntentSummary: { type: Type.STRING },
          },
          required: ['sameProject', 'detectedIntentSummary'],
        },
      },
    }),
    10000
  );
  const parsed = safeParseJson(res.text);
  return {
    stage: 'scope_check',
    sameProject: Boolean(parsed.sameProject),
    detectedIntentSummary: parsed.detectedIntentSummary,
    agentTelemetry: [{ role: 'GESTORA', keySlot: res.keySlotUsed, modelUsed: res.modelUsed, status: 'done' }],
  };
}

export async function runBuilderV2Stage(body, overrideHeader) {
  const keys = resolveBuilderV2Keys(overrideHeader);
  const stage = String(body?.stage || 'briefing');

  if (stage === 'briefing') {
    return executeBriefingStage(keys, body);
  }
  if (stage === 'structure' || stage === 'refine_structure') {
    return executeStructureStage(keys, { ...body, isRefinement: stage === 'refine_structure' });
  }
  if (stage === 'build_part') {
    return executeBuildPartStage(keys, body);
  }
  if (stage === 'scope_check') {
    return executeScopeCheckStage(keys, body);
  }
  throw new Error(`Etapa desconhecida no Builder V2: ${stage}`);
}
