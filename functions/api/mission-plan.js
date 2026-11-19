import {
  SARA_CORE_SYSTEM_PROMPT,
  callGeminiRestWithFailover,
  formatFriendlyEdgeError,
  handleOptions,
  jsonResponse,
  resolveEdgeApiKey,
  safeParseJson,
} from './_saraEdge.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const apiKey = resolveEdgeApiKey(request, env);
    const { goal, files, mode, projectState } = await request.json();

    const hasExistingFiles = Object.entries(files || {}).some(
      ([k, v]) => k.toLowerCase() !== 'readme.md' && Boolean(v && String(v).trim())
    );
    const stateText =
      hasExistingFiles && projectState
        ? `Estado atual (sara_estado_projeto): projeto "${projectState.projectName}", última etapa "${projectState.lastStepDone}", próximo passo "${projectState.nextStep}".`
        : '';

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        planSentence: { type: 'STRING' },
        intro: { type: 'STRING' },
        assumedNotes: { type: 'ARRAY', items: { type: 'STRING' } },
        tasks: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              description: { type: 'STRING' },
            },
            required: ['title', 'description'],
          },
        },
      },
      required: ['planSentence', 'intro', 'tasks'],
    };

    const { text, modelUsed } = await callGeminiRestWithFailover(
      apiKey,
      (model) => ({
        system_instruction: { parts: [{ text: SARA_CORE_SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Objetivo pedido por Eletro-Jr: "${goal}".
Modo: ${mode === 'manual' ? 'MANUAL (passo a passo com aprovação)' : 'AUTOMÁTICO (autónomo)'}.
${stateText}
Ficheiros atuais do projeto: ${Object.keys(files || {}).join(', ') || 'nenhum'}.

Cria um plano ESPONTÂNEO, GRANDE E MODULAR distribuído por VÁRIAS PASTAS especializadas entre 4 e 8 etapas concretas com lógica real.`,
              },
            ],
          },
        ],
        generationConfig: {
          ...(model.startsWith('gemini-4') ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {}),
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
      16000
    );

    const parsed = safeParseJson(text);
    return jsonResponse({ ...parsed, modelUsed });
  } catch (err) {
    return jsonResponse({ error: formatFriendlyEdgeError(err) }, 500);
  }
}
