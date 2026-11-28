// Cloudflare Pages Edge runtime helper para SARA BUILDER V2 (5 chaves em paralelo e failover)
import {
  MODEL_PRIORITY_CHAIN,
  isModelOnlyError,
  isRetryableHttpStatus,
  parseEdgeKeyList,
  safeParseJson,
} from './_saraEdge.js';

export const BUILDER_V2_ROLES = [
  { id: 'ARQUITETA', index: 0, label: 'Arquiteta', focus: 'Estrutura, briefing, pastas e plano sem código' },
  { id: 'CONSTRUTORA', index: 1, label: 'Construtora', focus: 'Escrita modular de código completo' },
  { id: 'DESIGNER', index: 2, label: 'Designer', focus: 'Cores, estética, tipografia e responsivo' },
  { id: 'TESTADORA', index: 3, label: 'Testadora', focus: 'Auditoria, erros, botões e responsividade' },
  { id: 'GESTORA', index: 4, label: 'Memória / Gestora', focus: 'Contrato fixo, escopo e entrega' },
];

const edgeCooldownUntil = new Map();

export function resolveBuilderV2EdgeKeys(request, env) {
  const headerKeys = parseEdgeKeyList(request?.headers?.get('x-gemini-api-key') || '');
  const viteDashRaw = env?.['VITE-GEMINI-API-KEY'] || '';
  const fallbackRaw =
    env?.GEMINI_API_KEY ||
    env?.VITE_GEMINI_API_KEY ||
    env?.GEMINI_API_KEYS ||
    env?.GOOGLE_API_KEY ||
    '';

  const primaryPool = parseEdgeKeyList(viteDashRaw);
  const secondaryPool = parseEdgeKeyList(fallbackRaw);

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
  const healthy = rotated.filter((k) => (edgeCooldownUntil.get(k) || 0) <= now);
  const cooling = rotated.filter((k) => (edgeCooldownUntil.get(k) || 0) > now);
  return [...healthy, ...cooling];
}

export async function callRoleEdgeWithFailover(
  keys,
  roleId,
  buildRequestBody,
  timeoutMs = 22000,
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
      const controller = new AbortController();
      const perTryMs = i === 0 && model === modelChain[0] ? timeoutMs : Math.min(timeoutMs, 14000);
      const timer = setTimeout(() => controller.abort(), perTryMs);

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
          const err = new Error(`Motor HTTP ${resp.status}`);
          err.status = resp.status;
          throw err;
        }

        const json = await resp.json();
        const text =
          json?.candidates?.[0]?.content?.parts
            ?.map((p) => p?.text || '')
            .join('') || '';
        if (!text.trim()) {
          const err = new Error(`Resposta vazia de ${roleId}`);
          err.status = 500;
          throw err;
        }
        usedKeySlot = slotIdx;
        return { text, modelUsed: model, keySlotUsed: usedKeySlot, roleId };
      } catch (err) {
        lastError = err;
        if (err?.status === 429 || String(err?.message || '').toLowerCase().includes('quota')) {
          edgeCooldownUntil.set(apiKey, Date.now() + 45000);
        }
        if (isModelOnlyError(err?.status, err?.message)) {
          modelUnavailableGlobally = true;
          break;
        }
        if (!isRetryableHttpStatus(err?.status, err?.message)) {
          break;
        }
      } finally {
        clearTimeout(timer);
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
/android-app/app/src/main/kotlin/com/projeto/ui/
/android-app/app/src/main/kotlin/com/projeto/viewmodel/
/android-app/app/src/main/kotlin/com/projeto/data/
/android-app/app/src/main/kotlin/com/projeto/navigation/
/android-app/app/src/main/res/layout/
/README.md`;
  }
  if (stack === 'hybrid-web-android') {
    return `ESTRUTURA HÍBRIDA OBRIGATÓRIA (Pastas separadas, ZERO mistura):
/web/src/{components,pages,hooks,services,utils,styles,assets,types}, /web/public, /web/package.json, /web/vite.config.ts, /web/tsconfig.json, /web/tailwind.config.js, /web/postcss.config.js, /web/.env.example, /web/index.html
/android-app/build.gradle.kts, /android-app/app/build.gradle.kts, /android-app/app/src/main/AndroidManifest.xml, /android-app/app/src/main/kotlin/com/projeto/{ui,viewmodel,data,navigation}, /android-app/app/src/main/res/layout/
/README.md`;
  }
  return `ESTRUTURA WEB OBRIGATÓRIA (Next.js + Vite + React + TypeScript + Tailwind):
/src/components/, /src/pages/, /src/hooks/, /src/services/, /src/utils/, /src/styles/, /src/assets/, /src/types/, /public/, index.html, package.json, vite.config.ts, tsconfig.json, tailwind.config.js, postcss.config.js, .env.example, README.md`;
}

export async function runBuilderV2EdgeStage(body, keys) {
  const stage = String(body?.stage || 'briefing');

  if (stage === 'briefing') {
    const { prompt = '', history = [], activeContract = null, hasExistingCode = false } = body || {};
    const recentHist = (history || [])
      .slice(-6)
      .map((m) => `${m.sender === 'user' ? 'Utilizador' : 'SARA'}: ${m.text}`)
      .join('\n');

    const archPromise = callRoleEdgeWithFailover(
      keys,
      'ARQUITETA',
      (model) => ({
        system_instruction: { parts: [{ text: `${PT_BASE_RULE}\nÉs a ARQUITETA (Chave 1). Só pensas e planeias. NUNCA geres código.` }] },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Pedido do utilizador: "${prompt}".
Histórico recente:
${recentHist || '(início)'}

Faz o PASSO 1 — BRIEFING claro em português simples, SEM código:
1. Para quem é?
2. O que faz?
3. Web, App Android (Kotlin) ou Híbrido?
4. Que cores?
5. Que funções?`,
              },
            ],
          },
        ],
        generationConfig: {
          ...(model.startsWith('gemini-4') ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {}),
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              reply: { type: 'STRING' },
              detectedType: { type: 'STRING' },
              detectedColors: { type: 'STRING' },
              detectedAudience: { type: 'STRING' },
              missingQuestions: { type: 'ARRAY', items: { type: 'STRING' } },
              voiceSummary: { type: 'STRING' },
            },
            required: ['reply', 'missingQuestions', 'voiceSummary'],
          },
        },
      }),
      15000
    );

    const gestoraPromise =
      activeContract?.locked && hasExistingCode
        ? callRoleEdgeWithFailover(
            keys,
            'GESTORA',
            () => ({
              system_instruction: { parts: [{ text: `${PT_BASE_RULE}\nÉs a MEMÓRIA / GESTORA (Chave 5).` }] },
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `Contrato ativo: ${activeContract.projectName} (${activeContract.stack}). Novo pedido: "${prompt}". É outro projeto?`,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: 'OBJECT',
                  properties: {
                    isDifferentProject: { type: 'BOOLEAN' },
                    reason: { type: 'STRING' },
                  },
                  required: ['isDifferentProject', 'reason'],
                },
              },
            }),
            10000
          ).catch(() => null)
        : Promise.resolve(null);

    const [archRes, gestRes] = await Promise.all([archPromise, gestoraPromise]);
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

  if (stage === 'structure' || stage === 'refine_structure') {
    const isRefinement = stage === 'refine_structure';
    const { prompt = '', briefingPrompt = '', existingContract = null } = body || {};
    const combinedBrief = briefingPrompt
      ? `Pedido inicial: ${briefingPrompt}\nRespostas / Ajustes do utilizador: ${prompt}`
      : prompt;
    const inferredStack = normalizeStack(`${combinedBrief} ${existingContract?.stack || ''}`);

    const archPromise = callRoleEdgeWithFailover(
      keys,
      'ARQUITETA',
      (model) => ({
        system_instruction: { parts: [{ text: `${PT_BASE_RULE}\nÉs a ARQUITETA (Chave 1). NUNCA escrevas código.` }] },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${isRefinement ? 'ATUALIZA A ESTRUTURA:' : 'PASSO 2 — ESTRUTURA E CONTRATO:'}
${combinedBrief}
${existingContract ? `Contrato atual: ${JSON.stringify(existingContract)}` : ''}
Stack: ${inferredStack}.
${defaultFolderGuidelines(inferredStack)}
Divide em 3 a 5 partes ordenadas (partsQueue) com targetFiles em português e pergunta ao utilizador se concorda.`,
              },
            ],
          },
        ],
        generationConfig: {
          ...(model.startsWith('gemini-4') ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {}),
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              projectName: { type: 'STRING' },
              stack: { type: 'STRING' },
              audience: { type: 'STRING' },
              purpose: { type: 'STRING' },
              colors: { type: 'STRING' },
              pages: { type: 'ARRAY', items: { type: 'STRING' } },
              functions: { type: 'ARRAY', items: { type: 'STRING' } },
              userFlow: { type: 'ARRAY', items: { type: 'STRING' } },
              folderTree: { type: 'ARRAY', items: { type: 'STRING' } },
              partsQueue: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    id: { type: 'INTEGER' },
                    title: { type: 'STRING' },
                    description: { type: 'STRING' },
                    targetFiles: { type: 'ARRAY', items: { type: 'STRING' } },
                  },
                  required: ['id', 'title', 'description', 'targetFiles'],
                },
              },
              summaryText: { type: 'STRING' },
              voiceSummary: { type: 'STRING' },
            },
            required: ['projectName', 'stack', 'audience', 'purpose', 'colors', 'pages', 'functions', 'folderTree', 'partsQueue', 'summaryText'],
          },
        },
      }),
      20000
    );

    const designerPromise = callRoleEdgeWithFailover(
      keys,
      'DESIGNER',
      () => ({
        system_instruction: { parts: [{ text: `${PT_BASE_RULE}\nÉs a DESIGNER (Chave 3).` }] },
        contents: [{ role: 'user', parts: [{ text: `Define tokens visuais (paleta 60-30-10, fontes, responsivo) para:\n${combinedBrief}` }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              primaryHex: { type: 'STRING' },
              secondaryHex: { type: 'STRING' },
              accentHex: { type: 'STRING' },
              backgroundHex: { type: 'STRING' },
              surfaceHex: { type: 'STRING' },
              themeMode: { type: 'STRING' },
              typography: { type: 'STRING' },
              designRulesSummary: { type: 'STRING' },
            },
            required: ['primaryHex', 'accentHex', 'backgroundHex', 'themeMode', 'designRulesSummary'],
          },
        },
      }),
      13000
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
      stage,
      reply: parsed.summaryText,
      voiceSummary: parsed.voiceSummary || 'Desenhei a estrutura completa com pastas. Concordas?',
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

  if (stage === 'build_part') {
    const {
      contract,
      partIndex = 0,
      existingFiles = {},
      attemptNumber = 1,
      userAdjustment = '',
    } = body || {};

    const part = contract?.partsQueue?.[partIndex];
    if (!part) throw new Error('Parte do contrato não encontrada.');

    const telemetry = [];
    let simplifiedNotice = '';
    let activePartSpec = `${part.title} — ${part.description}`;
    let activeTargetFiles = Array.isArray(part.targetFiles) ? part.targetFiles : [];

    if (attemptNumber >= 3) {
      const simpRes = await callRoleEdgeWithFailover(
        keys,
        'ARQUITETA',
        () => ({
          system_instruction: { parts: [{ text: `${PT_BASE_RULE}\nÉs a ARQUITETA (Chave 1). Simplificas partes complexas após 2 falhas.` }] },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Simplifica a parte "${part.title}" para funcionar de forma simples e sólida nos ficheiros ${activeTargetFiles.join(', ')}.`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                simplifiedSpec: { type: 'STRING' },
                targetFiles: { type: 'ARRAY', items: { type: 'STRING' } },
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
      .slice(0, 16)
      .map(([p, c]) => `--- ${p} ---\n${String(c || '').slice(0, 3200)}`)
      .join('\n\n');

    const buildRes = await callRoleEdgeWithFailover(
      keys,
      'CONSTRUTORA',
      (model) => ({
        system_instruction: { parts: [{ text: `${PT_BASE_RULE}\nÉs a CONSTRUTORA (Chave 2).` }] },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `CONTRATO FIXO: ${contract.projectName} (${contract.stack}), cores: ${contract.colors}, páginas: ${(contract.pages || []).join(', ')}.
PARTE ${partIndex + 1}/${contract.partsQueue.length}: ${part.title}
Especificação: ${activePartSpec}
Ficheiros alvo: ${activeTargetFiles.join(', ')}
${userAdjustment ? `Ajuste: ${userAdjustment}` : ''}
FICHEIROS EXISTENTES:\n${existingSummary || '(início)'}
Gera código completo em português, zero TODOs, nomes claros.`,
              },
            ],
          },
        ],
        generationConfig: {
          ...(model.startsWith('gemini-4') ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {}),
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              filesList: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    path: { type: 'STRING' },
                    content: { type: 'STRING' },
                  },
                  required: ['path', 'content'],
                },
              },
              summaryDone: { type: 'STRING' },
            },
            required: ['filesList', 'summaryDone'],
          },
        },
      }),
      26000
    );
    telemetry.push({ role: 'CONSTRUTORA', keySlot: buildRes.keySlotUsed, modelUsed: buildRes.modelUsed, status: 'done' });

    const builtParsed = safeParseJson(buildRes.text);
    const partFiles = {};
    for (const item of builtParsed.filesList || []) {
      if (item?.path && typeof item.content === 'string') {
        partFiles[String(item.path).trim().replace(/^\/+/, '')] = item.content;
      }
    }

    const nextPart = contract.partsQueue[partIndex + 1];
    const auditSnapshot = Object.entries({ ...existingFiles, ...partFiles })
      .slice(0, 18)
      .map(([p, c]) => `--- ${p} ---\n${String(c || '').slice(0, 3000)}`)
      .join('\n\n');

    const [testRes, designRes, nextPrepRes] = await Promise.all([
      callRoleEdgeWithFailover(
        keys,
        'TESTADORA',
        () => ({
          system_instruction: { parts: [{ text: `${PT_BASE_RULE}\nÉs a TESTADORA (Chave 4).` }] },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Audita esta parte "${part.title}": procura TODOs, sintaxe partida, botões sem ação e falta de responsividade.\n${auditSnapshot}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                passed: { type: 'BOOLEAN' },
                issues: { type: 'ARRAY', items: { type: 'STRING' } },
                checksPassed: { type: 'ARRAY', items: { type: 'STRING' } },
                summary: { type: 'STRING' },
              },
              required: ['passed', 'issues', 'summary'],
            },
          },
        }),
        14000
      ),
      callRoleEdgeWithFailover(
        keys,
        'DESIGNER',
        () => ({
          system_instruction: { parts: [{ text: `${PT_BASE_RULE}\nÉs a DESIGNER (Chave 3).` }] },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Revê cores (${contract.colors}) e responsividade dos ficheiros: ${Object.keys(partFiles).join(', ')}.`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                visualOk: { type: 'BOOLEAN' },
                polishNotes: { type: 'ARRAY', items: { type: 'STRING' } },
              },
              required: ['visualOk', 'polishNotes'],
            },
          },
        }),
        11000
      ).catch(() => null),
      nextPart && attemptNumber === 1
        ? callRoleEdgeWithFailover(
            keys,
            'ARQUITETA',
            () => ({
              system_instruction: { parts: [{ text: `${PT_BASE_RULE}\nÉs a ARQUITETA (Chave 1).` }] },
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `Prepara resumo técnico da próxima parte "${nextPart.title}" (${nextPart.description}).`,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: 'OBJECT',
                  properties: { nextPartHint: { type: 'STRING' } },
                  required: ['nextPartHint'],
                },
              },
            }),
            10000
          ).catch(() => null)
        : Promise.resolve(null),
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

    let autoRepaired = false;
    if (!testAudit.passed && Array.isArray(testAudit.issues) && testAudit.issues.length > 0) {
      const fixRes = await callRoleEdgeWithFailover(
        keys,
        'CONSTRUTORA',
        () => ({
          system_instruction: { parts: [{ text: `${PT_BASE_RULE}\nÉs a CONSTRUTORA (Chave 2). Corrige antes da entrega.` }] },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Corrige estes erros detetados pela Testadora:\n${testAudit.issues.join('\n')}\n\nFicheiros:\n${Object.entries(partFiles)
                    .map(([p, c]) => `--- ${p} ---\n${c}`)
                    .join('\n\n')}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                filesList: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: { path: { type: 'STRING' }, content: { type: 'STRING' } },
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
      testAudit = { ...testAudit, passed: true };
    }

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
        summary: testAudit.summary || 'Validado pela Testadora.',
      },
      designNotes: designReview?.polishNotes || [],
      agentTelemetry: telemetry,
    };
  }

  if (stage === 'scope_check') {
    const { prompt = '', contract } = body || {};
    const res = await callRoleEdgeWithFailover(
      keys,
      'GESTORA',
      () => ({
        system_instruction: { parts: [{ text: `${PT_BASE_RULE}\nÉs a MEMÓRIA / GESTORA (Chave 5).` }] },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Projeto ativo: ${contract?.projectName} (${contract?.stack}). Pedido: "${prompt}". É do mesmo projeto?`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              sameProject: { type: 'BOOLEAN' },
              detectedIntentSummary: { type: 'STRING' },
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

  throw new Error(`Etapa desconhecida no Builder V2: ${stage}`);
}
