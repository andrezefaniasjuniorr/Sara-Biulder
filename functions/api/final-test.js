import {
  SARA_CORE_SYSTEM_PROMPT,
  callGeminiRestWithFailover,
  formatFriendlyEdgeError,
  handleOptions,
  jsonResponse,
  resolveEdgeApiKeys,
  safeParseJson,
} from './_saraEdge.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const apiKeys = resolveEdgeApiKeys(request, env);
    const { goal, files, consoleLogs } = await request.json();

    const filesText = Object.entries(files || {})
      .map(([k, v]) => `--- ${k} ---\n${v || ''}`)
      .join('\n\n');

    const errs = (consoleLogs || [])
      .filter((l) => l.level === 'error')
      .slice(-10)
      .map((l) => l.message)
      .join('\n');

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        passed: { type: 'BOOLEAN' },
        summary: { type: 'STRING' },
        updateFiles: { type: 'BOOLEAN' },
        notes: { type: 'ARRAY', items: { type: 'STRING' } },
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
      },
      required: ['passed', 'summary', 'updateFiles'],
    };

    const { text, modelUsed } = await callGeminiRestWithFailover(
      apiKeys,
      (model) => ({
        system_instruction: { parts: [{ text: SARA_CORE_SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Faz uma AUDITORIA FINAL rigorosa ao projeto "${goal}":
1. Verifica se existe algum botão sem ação real ou handler quebrado.
2. Verifica se todos os formulários têm validação e feedback real.
3. Verifica se o layout é responsivo para PC e telemóvel (sem overflow horizontal).
4. Verifica se há algum mock/placeholder ou erro de console (${errs || 'nenhum erro de console'}).
Se tudo estiver 100% funcional, responde passed=true e updateFiles=false. Se encontrares qualquer problema ou falta, corrige e devolve os ficheiros corrigidos em filesList.

FICHEIROS DO PROJETO:
${filesText}`,
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
      24000
    );

    const parsed = safeParseJson(text);
    const filesMap = {};
    if (Array.isArray(parsed.filesList)) {
      for (const item of parsed.filesList) {
        if (item?.path && typeof item.content === 'string') {
          filesMap[item.path] = item.content;
        }
      }
    }

    return jsonResponse({
      ...parsed,
      files: Object.keys(filesMap).length > 0 ? filesMap : undefined,
      modelUsed,
    });
  } catch (err) {
    return jsonResponse({ error: formatFriendlyEdgeError(err) }, 500);
  }
}
