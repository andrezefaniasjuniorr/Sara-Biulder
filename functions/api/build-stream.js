import {
  CORS_HEADERS,
  MODEL_PRIORITY_CHAIN,
  SARA_STREAM_PROTOCOL,
  buildStreamParts,
  formatFriendlyEdgeError,
  handleOptions,
  isRetryableHttpStatus,
  resolveEdgeApiKey,
} from './_saraEdge.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  let apiKey;
  try {
    apiKey = resolveEdgeApiKey(request, env);
    body = await request.json();
  } catch (err) {
    const encoder = new TextEncoder();
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', error: formatFriendlyEdgeError(err) })}\n\n`)
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

      for (const model of MODEL_PRIORITY_CHAIN) {
        const abortCtrl = new AbortController();
        const timeoutId = setTimeout(() => abortCtrl.abort(), 20000);

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
              'x-goog-api-key': apiKey,
              'User-Agent': 'aistudio-build',
            },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: SARA_STREAM_PROTOCOL }] },
              contents: [{ role: 'user', parts }],
              ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
            }),
          });

          clearTimeout(timeoutId);

          if (!resp.ok || !resp.body) {
            const errText = await resp.text().catch(() => '');
            const err = new Error(`Gemini HTTP ${resp.status}: ${errText.slice(0, 180)}`);
            err.status = resp.status;
            throw err;
          }

          const reader = resp.body.getReader();
          let sseBuffer = '';
          let chunkCount = 0;

          while (true) {
            const { done, value } = await reader.read();
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
        } catch (err) {
          clearTimeout(timeoutId);
          lastError = err;
          if (!isRetryableHttpStatus(err?.status, err?.message)) {
            break;
          }
        }
      }

      if (!streamed) {
        sendEvent({
          type: 'error',
          error: formatFriendlyEdgeError(lastError),
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
