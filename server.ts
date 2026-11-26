import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { ThinkingLevel } from '@google/genai';
import {
  MODEL_PRIORITY_CHAIN,
  SARA_JARVIS_STREAM_PROTOCOL,
  SARA_STREAM_PROTOCOL,
  buildJarvisEnvelopeParts,
  buildStreamParts,
  getSaraJarvisStreamPrompt,
  getSaraStreamPrompt,
  enrichJarvisActionsNode,
  fetchHudLiveFeedNode,
  formatFriendlyAiError,
  getGeminiClient,
  isRetryableModelError,
  prepareJarvisContextNode,
  runBuilderGenerate,
  runFinalTestAudit,
  runJarvisAssistant,
  runMissionPlan,
  runSaraConversation,
  searchYouTubeTrackNode,
  withTimeout,
} from './api/_saraCore.js';
import {
  OWNER_EMAIL,
  clearBackendImageError,
  getBackendImageKey,
  isValidImageCoreKey,
  maskImageKey,
  mintHmacAdminToken,
  recordBackendImageError,
  setBackendImageKey,
  verifyAdminRequestAuth,
  verifyFirebaseOwnerIdToken,
  verifyOwnerPasswordCredentials,
} from './api/_coreImageVault.js';
import {
  computeRouteMozambique,
  reverseGeocodeMozambique,
  searchPlacesMozambique,
} from './api/_openMapMz.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  const handleStreamBuild = async (req: express.Request, res: express.Response) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (payload: Record<string, any>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const headerKey = req.headers['x-gemini-api-key'];
      const customKey = typeof headerKey === 'string' ? headerKey : undefined;
      const ai = getGeminiClient(customKey);
      const parts = buildStreamParts(req.body);

      let streamed = false;
      let lastError: any = null;

      for (const model of MODEL_PRIORITY_CHAIN) {
        const streamStart = Date.now();
        try {
          sendEvent({ type: 'status', model });
          const streamResp = await withTimeout(
            ai.models.generateContentStream({
              model,
              contents: { parts },
              config: {
                systemInstruction: getSaraStreamPrompt(req.body?.userIdentity) || SARA_STREAM_PROTOCOL,
                ...(model.startsWith('gemini-4')
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
              },
            }),
            9500,
            model
          );

          const iterator = streamResp[Symbol.asyncIterator]();
          let chunkCount = 0;

          while (true) {
            const nextStep = await withTimeout(iterator.next(), 12000, `${model}-chunk`);
            if (nextStep.done) break;
            const text = nextStep.value?.text || '';
            if (text) {
              chunkCount++;
              sendEvent({ type: 'chunk', text, model });
            }
          }

          if (chunkCount > 0) {
            streamed = true;
            console.log(`[Stream OK] ${model} enviou ${chunkCount} chunks em ${Date.now() - streamStart}ms`);
            sendEvent({ type: 'done', model });
            break;
          }
          lastError = new Error(`Streaming vazio no modelo ${model}`);
        } catch (err: any) {
          lastError = err;
          console.warn(`[Stream Failover] ${model} falhou:`, err?.message?.slice(0, 140));
          if (!isRetryableModelError(err)) break;
        }
      }

      if (!streamed) {
        sendEvent({
          type: 'error',
          error: formatFriendlyAiError(lastError),
        });
      }
    } catch (err: any) {
      sendEvent({
        type: 'error',
        error: formatFriendlyAiError(err),
      });
    } finally {
      res.end();
    }
  };

  const handleBuildGenerate = async (req: express.Request, res: express.Response) => {
    try {
      const headerKey = req.headers['x-gemini-api-key'];
      const customKey = typeof headerKey === 'string' ? headerKey : undefined;
      const ai = getGeminiClient(customKey);
      const result = await runBuilderGenerate(ai, req.body);
      res.json(result);
    } catch (err: any) {
      console.error('Erro /api/build:', err);
      res.status(err?.status === 403 ? 403 : 500).json({
        error: formatFriendlyAiError(err),
      });
    }
  };

  const handleMissionPlan = async (req: express.Request, res: express.Response) => {
    try {
      const headerKey = req.headers['x-gemini-api-key'];
      const customKey = typeof headerKey === 'string' ? headerKey : undefined;
      const ai = getGeminiClient(customKey);
      const result = await runMissionPlan(ai, req.body);
      res.json(result);
    } catch (err: any) {
      console.error('Erro /api/mission-plan:', err);
      res.status(500).json({
        error: formatFriendlyAiError(err),
      });
    }
  };

  const handleFinalTest = async (req: express.Request, res: express.Response) => {
    try {
      const headerKey = req.headers['x-gemini-api-key'];
      const customKey = typeof headerKey === 'string' ? headerKey : undefined;
      const ai = getGeminiClient(customKey);
      const result = await runFinalTestAudit(ai, req.body);
      res.json(result);
    } catch (err: any) {
      console.error('Erro /api/final-test:', err);
      res.status(500).json({ error: formatFriendlyAiError(err) });
    }
  };

  const handleSaraChat = async (req: express.Request, res: express.Response) => {
    try {
      const headerKey = req.headers['x-gemini-api-key'];
      const customKey = typeof headerKey === 'string' ? headerKey : undefined;
      const ai = getGeminiClient(customKey);
      const result = await runSaraConversation(ai, req.body);
      res.json(result);
    } catch (err: any) {
      console.error('Erro /api/sara:', err);
      res.status(err?.status === 403 ? 403 : 500).json({
        error: formatFriendlyAiError(err),
      });
    }
  };

  // Rotas principais (alinhadas com Vercel /api/*.js e Cloudflare /functions/api/*.js) + aliases legados
  app.post('/api/build-stream', handleStreamBuild);
  app.post('/api/builder/stream', handleStreamBuild);

  app.post('/api/build', handleBuildGenerate);
  app.post('/api/builder/generate', handleBuildGenerate);

  app.post('/api/mission-plan', handleMissionPlan);
  app.post('/api/mission/plan', handleMissionPlan);

  app.post('/api/final-test', handleFinalTest);
  app.post('/api/sara/final-test', handleFinalTest);

  const handleJarvisStream = async (req: express.Request, res: express.Response) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (payload: Record<string, any>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const headerKey = req.headers['x-gemini-api-key'];
      const customKey = typeof headerKey === 'string' ? headerKey : undefined;
      const ai = getGeminiClient(customKey);
      const preparedBody = await prepareJarvisContextNode(req.body);
      const contents = buildJarvisEnvelopeParts(preparedBody);

      let streamed = false;
      let lastError: any = null;

      for (const model of MODEL_PRIORITY_CHAIN) {
        const streamStart = Date.now();
        try {
          sendEvent({ type: 'status', model });
          const streamResp = await withTimeout(
            ai.models.generateContentStream({
              model,
              contents,
              config: {
                systemInstruction: getSaraJarvisStreamPrompt(req.body?.userIdentity) || SARA_JARVIS_STREAM_PROTOCOL,
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

          const iterator = streamResp[Symbol.asyncIterator]();
          let chunkCount = 0;
          let fullText = '';

          while (true) {
            const nextStep = await withTimeout(iterator.next(), 12000, `${model}-chunk`);
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
                if (
                  Array.isArray(rawActions) &&
                  rawActions.some((a) => a?.type === 'play_music' || a?.type === 'play_video')
                ) {
                  const enriched = await enrichJarvisActionsNode(rawActions);
                  sendEvent({ type: 'enriched_actions', actions: enriched });
                }
              } catch {
                // fallback handled on client
              }
            }
            console.log(
              `[Jarvis Stream OK] ${model} enviou ${chunkCount} chunks em ${Date.now() - streamStart}ms`
            );
            sendEvent({ type: 'done', model });
            break;
          }
          lastError = new Error(`Streaming vazio no modelo ${model}`);
        } catch (err: any) {
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
    } catch (err: any) {
      sendEvent({
        type: 'error',
        error: formatFriendlyAiError(err),
      });
    } finally {
      res.end();
    }
  };

  const handleJarvisRequest = async (req: express.Request, res: express.Response) => {
    try {
      if (req.body?.action === 'youtube_search') {
        const track = await searchYouTubeTrackNode(
          req.body?.query || '',
          req.body?.kind || 'music'
        );
        return res.json({ track });
      }
      if (req.body?.action === 'hud_live_feed') {
        const feed = await fetchHudLiveFeedNode();
        return res.json(feed);
      }
      const headerKey = req.headers['x-gemini-api-key'];
      const customKey = typeof headerKey === 'string' ? headerKey : undefined;
      const ai = getGeminiClient(customKey);
      const result = await runJarvisAssistant(ai, req.body);
      res.json(result);
    } catch (err: any) {
      console.error('Erro /api/jarvis:', err);
      res.status(err?.status === 403 ? 403 : 500).json({
        error: formatFriendlyAiError(err),
      });
    }
  };

  app.post('/api/sara', handleSaraChat);
  app.post('/api/jarvis', handleJarvisRequest);
  app.post('/api/jarvis-stream', handleJarvisStream);

  // Endpoints de Mapa Aberto Gratuito do Núcleo SARA (foco Moçambique, zero chaves, zero verificação)
  app.post('/api/maps/reverse-geocode', async (req, res) => {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Coordenadas inválidas.' });
    }
    const result = await reverseGeocodeMozambique(lat, lng);
    return res.json(result);
  });

  app.post('/api/maps/search-places', async (req, res) => {
    const result = await searchPlacesMozambique(
      req.body?.query,
      Number(req.body?.lat),
      Number(req.body?.lng)
    );
    return res.json(result);
  });

  app.post('/api/maps/route', async (req, res) => {
    const { status, payload } = await computeRouteMozambique(
      req.body?.origin,
      req.body?.destination
    );
    return res.status(status).json(payload);
  });

  app.get('/api/maps/approx-location', async (req, res) => {
    try {
      const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      const isPublicIp =
        forwarded &&
        !/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|localhost)/i.test(forwarded);
      const endpoint = isPublicIp
        ? `https://ipwho.is/${encodeURIComponent(forwarded)}?lang=pt`
        : 'https://ipwho.is/?lang=pt';
      const ipRes = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      if (!ipRes.ok) {
        return res.status(503).json({ error: 'Localização aproximada indisponível.' });
      }
      const json = (await ipRes.json()) as {
        success?: boolean;
        latitude?: number;
        longitude?: number;
        city?: string;
        country?: string;
      };
      if (
        json?.success !== false &&
        typeof json.latitude === 'number' &&
        typeof json.longitude === 'number' &&
        Number.isFinite(json.latitude) &&
        Number.isFinite(json.longitude)
      ) {
        return res.json({
          lat: Number(json.latitude.toFixed(6)),
          lng: Number(json.longitude.toFixed(6)),
          city: json.city || '',
          country: json.country || '',
          approximate: true,
        });
      }
      return res.status(503).json({ error: 'Sem localização aproximada disponível.' });
    } catch {
      return res.status(503).json({ error: 'Sem ligação de rede para localização aproximada.' });
    }
  });

  // Endpoints privados do Admin para a Chave do Núcleo SARA (imagens)
  app.post('/api/admin/auth', async (req, res) => {
    const firebaseIdToken = String(req.body?.firebaseIdToken || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (firebaseIdToken) {
      const fbOk = await verifyFirebaseOwnerIdToken(firebaseIdToken);
      if (fbOk) {
        return res.json({ ok: true, token: mintHmacAdminToken(OWNER_EMAIL) });
      }
    }

    const passwordOk = await verifyOwnerPasswordCredentials(email, password);
    if (!passwordOk) {
      return res.status(401).json({ ok: false, error: 'Credenciais de administrador inválidas.' });
    }

    return res.json({ ok: true, token: mintHmacAdminToken(OWNER_EMAIL) });
  });

  app.get('/api/admin/core-image-key', async (req, res) => {
    const auth = await verifyAdminRequestAuth(req.headers.authorization);
    if (!auth) {
      return res.status(401).json({
        ok: false,
        code: 'ADMIN_AUTH_REQUIRED',
        error: 'Acesso restrito ao administrador.',
      });
    }
    const current = await getBackendImageKey();
    return res.json({
      ok: true,
      configured: isValidImageCoreKey(current.imageKey),
      maskedKey: maskImageKey(current.imageKey),
      updatedAt: current.updatedAt || null,
      lastError: current.lastError || null,
      lastErrorStatus: current.lastErrorStatus ?? null,
      lastErrorAt: current.lastErrorAt || null,
    });
  });

  app.post('/api/admin/core-image-key', async (req, res) => {
    const auth = await verifyAdminRequestAuth(req.headers.authorization);
    if (!auth) {
      return res.status(401).json({
        ok: false,
        code: 'ADMIN_AUTH_REQUIRED',
        error: 'Acesso restrito ao administrador.',
      });
    }
    const key = String(req.body?.key || '').trim();
    if (!isValidImageCoreKey(key)) {
      return res.status(400).json({
        ok: false,
        error: 'Formato inválido. Insere uma Chave de Imagem SARA válida (começa por hf_).',
      });
    }
    const saved = await setBackendImageKey(key, auth.firebaseToken || undefined);
    return res.json({ ok: true, ...saved });
  });

  app.delete('/api/admin/core-image-key', async (req, res) => {
    const auth = await verifyAdminRequestAuth(req.headers.authorization);
    if (!auth) {
      return res.status(401).json({
        ok: false,
        code: 'ADMIN_AUTH_REQUIRED',
        error: 'Acesso restrito ao administrador.',
      });
    }
    const cleared = await setBackendImageKey('', auth.firebaseToken || undefined);
    return res.json({ ok: true, ...cleared });
  });

  app.get('/api/image/status', async (_req, res) => {
    const current = await getBackendImageKey();
    return res.json({
      ok: true,
      available: isValidImageCoreKey(current.imageKey),
    });
  });

  app.post('/api/image/generate', async (req, res) => {
    const prompt = String(req.body?.prompt || '').trim();
    const userGenericError = 'Não consegui gerar agora, tenta de novo em alguns segundos.';

    const extractUpstreamErrorDetail = async (upstream: Response): Promise<string> => {
      try {
        const txt = (await upstream.text()).trim();
        if (!txt) return '';
        try {
          const parsed = JSON.parse(txt);
          if (typeof parsed?.error === 'string') return parsed.error;
          if (typeof parsed?.message === 'string') return parsed.message;
        } catch {
          // plain text fallback
        }
        return txt.slice(0, 180);
      } catch {
        return '';
      }
    };

    if (!prompt || prompt.length > 1000) {
      return res.status(400).json({
        ok: false,
        error: userGenericError,
      });
    }

    const { imageKey } = await getBackendImageKey();
    if (!isValidImageCoreKey(imageKey)) {
      await recordBackendImageError('Chave de Imagem SARA não configurada no painel de admin.', 503);
      return res.status(503).json({
        ok: false,
        error: userGenericError,
      });
    }

    const models = [
      'black-forest-labs/FLUX.1-schnell',
      'stabilityai/stable-diffusion-xl-base-1.0',
    ];

    const attemptErrors: string[] = [];
    let lastStatus = 503;

    for (let i = 0; i < models.length; i++) {
      const modelId = models[i];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);

      try {
        const upstream = await fetch(
          `https://router.huggingface.co/hf-inference/models/${modelId}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${imageKey}`,
              'Content-Type': 'application/json',
              Accept: 'image/png',
            },
            body: JSON.stringify({
              inputs: prompt,
              options: { wait_for_model: true },
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timer);

        if (upstream.status === 401 || upstream.status === 403) {
          const detail = await extractUpstreamErrorDetail(upstream);
          await recordBackendImageError(
            `Chave rejeitada (HTTP ${upstream.status})${detail ? `: ${detail}` : ''}`,
            upstream.status
          );
          return res.status(503).json({
            ok: false,
            error: userGenericError,
          });
        }

        const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
        if (upstream.ok && contentType.startsWith('image/')) {
          const buf = Buffer.from(await upstream.arrayBuffer());
          if (buf.length > 0) {
            await clearBackendImageError();
            const mime = contentType.split(';')[0] || 'image/png';
            return res.json({
              ok: true,
              dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
            });
          }
        }

        lastStatus = upstream.status || 503;
        const detail = await extractUpstreamErrorDetail(upstream);
        attemptErrors.push(
          `${modelId.split('/').pop()}: HTTP ${lastStatus}${detail ? ` (${detail})` : ''}`
        );
      } catch (err: any) {
        clearTimeout(timer);
        lastStatus = err?.name === 'AbortError' ? 504 : 503;
        const errMsg =
          err?.name === 'AbortError' ? 'Timeout após 45s' : err?.message || 'Erro de rede';
        attemptErrors.push(`${modelId.split('/').pop()}: ${errMsg}`);
      }
    }

    await recordBackendImageError(
      attemptErrors.join(' | ') || 'Falha nos motores de geração de imagem.',
      lastStatus
    );

    return res.status(503).json({
      ok: false,
      error: userGenericError,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SARA BIULDER ativo em http://0.0.0.0:${PORT}`);
  });
}

startServer();
