import {
  SARA_CORE_SYSTEM_PROMPT,
  callGeminiRestWithFailover,
  formatFriendlyEdgeError,
  handleOptions,
  jsonResponse,
  resolveEdgeApiKey,
} from './_saraEdge.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const apiKey = resolveEdgeApiKey(request, env);
    const body = await request.json();
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

    const { text, modelUsed } = await callGeminiRestWithFailover(
      apiKey,
      (model) => ({
        system_instruction: { parts: [{ text: systemText }] },
        contents: finalContents,
        generationConfig: model.startsWith('gemini-4')
          ? { thinkingConfig: { thinkingLevel: 'LOW' } }
          : { temperature: 1.05 },
      }),
      8000
    );

    return jsonResponse({ reply: text, modelUsed });
  } catch (err) {
    return jsonResponse({ error: formatFriendlyEdgeError(err) }, err?.status === 403 ? 403 : 500);
  }
}
