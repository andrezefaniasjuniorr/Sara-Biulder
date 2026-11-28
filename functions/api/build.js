import {
  SARA_CORE_SYSTEM_PROMPT,
  callGeminiRestWithFailover,
  formatFriendlyEdgeError,
  getSaraCorePrompt,
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
    const body = await request.json();
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
      userIdentity,
    } = body || {};

    const callerLabel =
      userIdentity?.isOwner === true
        ? 'Eletro-Jr'
        : String(userIdentity?.callName || '').trim() || 'Utilizador';

    const recentErrors = (consoleLogs || [])
      .filter((l) => l.level === 'error' || l.level === 'warn')
      .slice(-8)
      .map((l) => `[${String(l.level || 'info').toUpperCase()}] ${l.message}`)
      .join('\n');

    const recentHistory = (history || [])
      .slice(-10)
      .map((m) => `${m.sender === 'user' ? callerLabel : 'Sara'}: ${m.text}`)
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
      ? `CONTEXTO ATUAL DA PLATAFORMA: separador="${screenContext.activeTab}", preview="${screenContext.previewDevice}", ficheiro ativo="${screenContext.activeFile}", projeto="${screenContext.projectName}", telaCheia="${Boolean(screenContext.isEditorFullscreen)}", projetosDisponiveis="${(screenContext.availableProjects || []).join(', ')}".\n`
      : '';

    const contextMessage = `${screenBlock}${stateInfo}HISTÓRICO RECENTE:
${recentHistory || 'Início da sessão.'}

FICHEIROS ATUAIS DO PROJETO (${Object.keys(files || {}).length}):
${filesText || '(vazio)'}

${uploadedBlock ? `FICHEIROS ANEXADOS:\n${uploadedBlock}\n` : ''}
ERROS / AVISOS RECENTES DO CONSOLE:
${recentErrors || 'Nenhum erro no console.'}

${forceBuilderMode !== false ? 'MODO ETAPA COMPLETA: Lê todos os ficheiros existentes, preserva o que já funciona e executa este pedido criando ficheiros organizados por pastas especializadas com código 100% completo, real e sem stubs. PROIBIDO criar só index.html + src/app.js.' : ''}

PEDIDO ATUAL DE ${callerLabel}:
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

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        mode: { type: 'STRING' },
        reply: { type: 'STRING' },
        updateFiles: { type: 'BOOLEAN' },
        projectName: { type: 'STRING' },
        projectType: { type: 'STRING' },
        planSentence: { type: 'STRING' },
        architecture: { type: 'STRING' },
        voiceSummary: { type: 'STRING' },
        nextStep: { type: 'STRING' },
        strategicImprovements: { type: 'ARRAY', items: { type: 'STRING' } },
        missingFeatures: { type: 'ARRAY', items: { type: 'STRING' } },
        proactiveSuggestion: { type: 'STRING' },
        steps: { type: 'ARRAY', items: { type: 'STRING' } },
        assumedNotes: { type: 'ARRAY', items: { type: 'STRING' } },
        actions: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              type: { type: 'STRING' },
              name: { type: 'STRING' },
              path: { type: 'STRING' },
              projectType: { type: 'STRING' },
            },
            required: ['type'],
          },
        },
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
      required: ['mode', 'reply', 'updateFiles'],
    };

    const { text, modelUsed } = await callGeminiRestWithFailover(
      apiKeys,
      (model) => ({
        system_instruction: { parts: [{ text: getSaraCorePrompt(userIdentity, body) || SARA_CORE_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          ...(model.startsWith('gemini-4') ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {}),
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
      28000
    );

    const parsed = safeParseJson(text);
    const filesMap = {};
    if (Array.isArray(parsed.filesList)) {
      for (const item of parsed.filesList) {
        if (item?.path && typeof item.content === 'string') {
          filesMap[String(item.path).trim().replace(/^\/+/, '')] = item.content;
        }
      }
    }

    return jsonResponse({
      ...parsed,
      files: Object.keys(filesMap).length > 0 ? filesMap : parsed.files,
      modelUsed,
    });
  } catch (err) {
    return jsonResponse({ error: formatFriendlyEdgeError(err) }, err?.status === 503 ? 503 : 500);
  }
}
