import { ThinkingLevel } from '@google/genai';
import {
  MODEL_PRIORITY_CHAIN,
  SARA_JARVIS_STREAM_PROTOCOL,
  buildJarvisEnvelopeParts,
  enrichJarvisActionsNode,
  formatFriendlyAiError,
  getGeminiClient,
  isRetryableModelError,
  prepareJarvisContextNode,
  readJsonBody,
  setCorsHeaders,
  withTimeout,
} from './_saraCore.js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido. Usa POST.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendEvent = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const body = await readJsonBody(req);
    const headerKey = req.headers?.['x-gemini-api-key'];
    const customKey = typeof headerKey === 'string' ? headerKey : undefined;
    const ai = getGeminiClient(customKey);
    const preparedBody = await prepareJarvisContextNode(body);
    const contents = buildJarvisEnvelopeParts(preparedBody);

    let streamed = false;
    let lastError = null;

    for (const model of MODEL_PRIORITY_CHAIN) {
      let chunkWatchdog;
      try {
        sendEvent({ type: 'status', model });
        const streamResp = await withTimeout(
          ai.models.generateContentStream({
            model,
            contents,
            config: {
              systemInstruction: SARA_JARVIS_STREAM_PROTOCOL,
              ...(model.startsWith('gemini-4')
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : model.startsWith('gemini-3.1')
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
                : { temperature: 0.9 }),
            },
          }),
          9000,
          model
        );

        let chunkCount = 0;
        let fullText = '';
        const iterator = streamResp[Symbol.asyncIterator]();
        while (true) {
          const nextStep = await Promise.race([
            iterator.next(),
            new Promise((_, reject) => {
              chunkWatchdog = setTimeout(() => reject(new Error(`Timeout stream chunk em ${model}`)), 12000);
            }),
          ]);
          clearTimeout(chunkWatchdog);
          if (nextStep.done) break;
          const text = nextStep.value?.text || '';
          if (text) {
            chunkCount++;
            fullText += text;
            sendEvent({ type: 'chunk', text, model });
          }
        }

        if (chunkCount > 0) {
          streamed = true;
          const actMatch = fullText.match(/<JARVIS_ACTIONS>([\s\S]*?)<\/JARVIS_ACTIONS>/i);
          if (actMatch?.[1]) {
            try {
              const rawActions = JSON.parse(actMatch[1].trim());
              if (Array.isArray(rawActions) && rawActions.some((a) => a?.type === 'play_music' || a?.type === 'play_video')) {
                const enriched = await enrichJarvisActionsNode(rawActions);
                sendEvent({ type: 'enriched_actions', actions: enriched });
              }
            } catch {
              // client parser handles fallback
            }
          }
          sendEvent({ type: 'done', model });
          break;
        }
      } catch (err) {
        clearTimeout(chunkWatchdog);
        lastError = err;
        console.warn(`[Jarvis Stream Failover] ${model} falhou:`, err?.message?.slice(0, 140));
        if (!isRetryableModelError(err)) break;
      }
    }

    if (!streamed) {
      sendEvent({
        type: 'error',
        error: formatFriendlyAiError(lastError),
      });
    }
  } catch (err) {
    sendEvent({
      type: 'error',
      error: formatFriendlyAiError(err),
    });
  } finally {
    res.end();
  }
}
