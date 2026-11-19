import { ThinkingLevel } from '@google/genai';
import {
  MODEL_PRIORITY_CHAIN,
  SARA_STREAM_PROTOCOL,
  buildStreamParts,
  formatFriendlyAiError,
  getGeminiClient,
  isRetryableModelError,
  readJsonBody,
  setCorsHeaders,
  withTimeout,
} from './_saraCore.js';

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
    const parts = buildStreamParts(body);

    let streamed = false;
    let lastError = null;

    for (const model of MODEL_PRIORITY_CHAIN) {
      const streamStart = Date.now();
      try {
        sendEvent({ type: 'status', model });
        const streamResp = await withTimeout(
          ai.models.generateContentStream({
            model,
            contents: { parts },
            config: {
              systemInstruction: SARA_STREAM_PROTOCOL,
              ...(model.startsWith('gemini-4')
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          }),
          18000,
          model
        );

        let chunkCount = 0;
        for await (const chunk of streamResp) {
          const text = chunk?.text || '';
          if (text) {
            chunkCount++;
            sendEvent({ type: 'chunk', text, model });
          }
        }

        if (chunkCount > 0) {
          streamed = true;
          console.log(`[Vercel Stream OK] ${model} enviou ${chunkCount} chunks em ${Date.now() - streamStart}ms`);
          sendEvent({ type: 'done', model });
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Vercel Stream Failover] ${model} falhou:`, err?.message?.slice(0, 140));
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
