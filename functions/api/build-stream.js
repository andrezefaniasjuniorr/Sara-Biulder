import {
  CORS_HEADERS,
  MODEL_PRIORITY_CHAIN,
  SARA_STREAM_PROTOCOL,
  buildStreamParts,
  formatFriendlyEdgeError,
  getSaraStreamPrompt,
  handleOptions,
  isModelOnlyError,
  isRetryableHttpStatus,
  resolveEdgeApiKeys,
} from './_saraEdge.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  let apiKeys;
  try {
    apiKeys = resolveEdgeApiKeys(request, env);
    body = await request.json();
  } catch (err) {
    const encoder = new TextEncoder();
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', retryable: true, error: formatFriendlyEdgeError(err) })}\n\n`)
        );
        controller.close();
      },
    });
    return new Response(errorStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        ...CORS_HEADERS,
      },
    });
  }

  const parts = buildStreamParts(body);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8');

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (payload) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      let streamed = false;
      let lastError = null;
      const maxKeys = Math.min(apiKeys.length, 6);

      for (const model of MODEL_PRIORITY_CHAIN) {
        let modelUnavailableGlobally = false;

        for (let kIdx = 0; kIdx < maxKeys; kIdx++) {
          const activeKey = apiKeys[kIdx];
          const abortCtrl = new AbortController();
          const connectTimeoutId = setTimeout(() => abortCtrl.abort(), 9500);

          try {
            sendEvent({ type: 'status', model });

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
            const generationConfig = model.startsWith('gemini-4')
              ? { thinkingConfig: { thinkingLevel: 'LOW' } }
              : {};

            const resp = await fetch(url, {
              method: 'POST',
              signal: abortCtrl.signal,
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': activeKey,
                'User-Agent': 'aistudio-build',
              },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: getSaraStreamPrompt(body?.userIdentity) || SARA_STREAM_PROTOCOL }] },
                contents: [{ role: 'user', parts }],
                ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
              }),
            });

            clearTimeout(connectTimeoutId);

            if (!resp.ok || !resp.body) {
              const err = new Error(`Motor HTTP ${resp.status}`);
              err.status = resp.status;
              throw err;
            }

            const reader = resp.body.getReader();
            let sseBuffer = '';
            let chunkCount = 0;

            while (true) {
              let chunkTimer;
              const readResult = await Promise.race([
                reader.read(),
                new Promise((_, reject) => {
                  chunkTimer = setTimeout(() => {
                    abortCtrl.abort();
                    reject(new Error(`Timeout de chunk no streaming do modelo ${model}`));
                  }, 12000);
                }),
              ]).finally(() => clearTimeout(chunkTimer));

              const { done, value } = readResult;
              if (done) break;
              sseBuffer += decoder.decode(value, { stream: true });
              const lines = sseBuffer.split('\n');
              sseBuffer = lines.pop() || '';

              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6).trim();
                if (!raw || raw === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(raw);
                  const text =
                    parsed?.candidates?.[0]?.content?.parts
                      ?.map((p) => p?.text || '')
                      .join('') || '';
                  if (text) {
                    chunkCount++;
                    sendEvent({ type: 'chunk', text, model });
                  }
                } catch {
                  // ignore partial SSE JSON frame
                }
              }
            }

            if (chunkCount > 0) {
              streamed = true;
              sendEvent({ type: 'done', model });
              break;
            }
            lastError = new Error(`Streaming vazio no modelo ${model}`);
          } catch (err) {
            clearTimeout(connectTimeoutId);
            lastError = err;
            if (isModelOnlyError(err?.status, err?.message)) {
              modelUnavailableGlobally = true;
              break;
            }
            if (!isRetryableHttpStatus(err?.status, err?.message)) {
              break;
            }
          }
        }

        if (streamed) break;
        if (modelUnavailableGlobally) continue;
      }

      if (!streamed) {
        sendEvent({
          type: 'error',
          retryable: true,
          error: formatFriendlyEdgeError(lastError, Boolean(body?.userIdentity?.isOwner)),
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      ...CORS_HEADERS,
    },
  });
}
