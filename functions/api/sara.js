import {
  FAST_VOICE_MODEL_CHAIN,
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
2. Dá 1 ou 2 contribuições/sugestões técnicas ou visuais inteligentes para deixar o projeto de nível profissional.
3. ${isManual ? 'Termina com uma pergunta curta convidando Eletro-Jr a aprovar o início ou sugerir ajustes antes de mexeres no código.' : 'Termina confirmando que assumes a construção completa e os testes automáticos a partir de agora.'}`;

      const { text, modelUsed } = await callGeminiRestWithFailover(
        apiKey,
        (model) => ({
          system_instruction: {
            parts: [
              {
                text: 'És a Sara Biulder a falar por voz diretamente com Eletro-Jr. Sê rápida, humana, profissional e objetiva (máximo 3 frases faladas sem formatação markdown).',
              },
            ],
          },
          contents: [{ role: 'user', parts: [{ text: kickoffPrompt }] }],
          generationConfig: model.startsWith('gemini-4')
            ? { thinkingConfig: { thinkingLevel: 'LOW' } }
            : model.startsWith('gemini-3.1')
            ? { thinkingConfig: { thinkingLevel: 'MINIMAL' } }
            : { temperature: 1.0 },
        }),
        3800,
        FAST_VOICE_MODEL_CHAIN
      );

      return jsonResponse({ reply: (text || '').trim(), modelUsed });
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
          : model.startsWith('gemini-3.1')
          ? { thinkingConfig: { thinkingLevel: 'MINIMAL' } }
          : { temperature: 1.05 },
      }),
      5500,
      FAST_VOICE_MODEL_CHAIN
    );

    return jsonResponse({ reply: text, modelUsed });
  } catch (err) {
    return jsonResponse({ error: formatFriendlyEdgeError(err) }, err?.status === 403 ? 403 : 500);
  }
}
