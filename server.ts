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
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'microphone=(self), camera=(self)');
    next();
  });
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
      lastModel: current.lastModel || null,
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
    return res.json({
      ok: true,
      available: true,
    });
  });

  app.post('/api/image/generate', async (req, res) => {
    const prompt = String(req.body?.prompt || '').trim();
    const userGenericError = 'Não consegui gerar agora, tenta de novo em alguns segundos.';
    const qualityPromptSuffix =
      'ultra detailed, sharp focus, high quality, 8k, professional lighting, no blur, no distortion';
    const hfTopProviders = [
      {
        url: 'https://router.huggingface.co/together/black-forest-labs/FLUX.1-dev',
        label: 'together/black-forest-labs/FLUX.1-dev',
        buildPayloads: (fullPromptText: string) => [
          {
            inputs: fullPromptText,
            parameters: {
              width: 1280,
              height: 1280,
              seed,
              num_inference_steps: 28,
              guidance_scale: 3.5,
            },
          },
          {
            prompt: fullPromptText,
            width: 1280,
            height: 1280,
            steps: 28,
            seed,
            response_format: 'b64_json',
          },
        ],
      },
      {
        url: 'https://router.huggingface.co/fal-ai/black-forest-labs/FLUX.1-schnell',
        label: 'fal-ai/black-forest-labs/FLUX.1-schnell',
        buildPayloads: (fullPromptText: string) => [
          {
            prompt: fullPromptText,
            image_size: { width: 1280, height: 1280 },
            seed,
            num_inference_steps: 4,
            output_format: 'jpeg',
          },
          {
            inputs: fullPromptText,
            parameters: {
              width: 1280,
              height: 1280,
              seed,
              num_inference_steps: 4,
            },
          },
        ],
      },
    ];

    const styleSuffixes: Record<string, string> = {
      realistic: 'ultra realistic, professional photography, detailed skin, cinematic lighting, 4k',
      drawing: 'beautiful digital illustration, vibrant colors, detailed art, clean lines',
      pixar3d:
        '3D pixar style, cute character, big expressive eyes, soft lighting, high quality 3D render',
    };

    const rawStyle = String(req.body?.style || '').trim().toLowerCase();
    const styleKey =
      rawStyle === 'drawing' || rawStyle === 'desenho'
        ? 'drawing'
        : rawStyle === 'pixar3d' || rawStyle === '3d_pixar' || rawStyle === 'pixar'
        ? 'pixar3d'
        : 'realistic';

    const rawSeed = Number(req.body?.seed);
    const seed =
      Number.isFinite(rawSeed) && rawSeed > 0
        ? Math.trunc(rawSeed)
        : Math.floor(Math.random() * 2000000000) + 1;

    const rawMode = String(req.body?.mode || '').trim().toLowerCase();
    const mode: 'top' | 'fast' | 'auto' =
      rawMode === 'top' || rawMode === 'hf'
        ? 'top'
        : rawMode === 'fast' || rawMode === 'pollinations'
        ? 'fast'
        : 'auto';

    if (!prompt || prompt.length > 1000) {
      return res.status(400).type('text/plain').send(userGenericError);
    }

    const isSafeRemoteImageUrl = (rawUrl: string): boolean => {
      try {
        const parsed = new URL(rawUrl.trim());
        if (parsed.protocol !== 'https:') return false;
        const host = parsed.hostname.toLowerCase();
        if (!host || host === 'localhost' || host.endsWith('.local')) return false;
        if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
          return false;
        }
        if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    };

    const detectImageMimeFromBuffer = (
      buf: Buffer,
      headerContentType?: string | null
    ): string | null => {
      if (!buf || buf.length === 0) return null;
      if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return 'image/jpeg';
      }
      const headStr = buf.subarray(0, 32).toString('latin1');
      if (headStr.includes('JFIF') || headStr.includes('Exif')) {
        return 'image/jpeg';
      }
      if (
        buf.length >= 4 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47
      ) {
        return 'image/png';
      }
      if (headStr.startsWith('GIF8')) {
        return 'image/gif';
      }
      if (headStr.startsWith('RIFF') && headStr.slice(8, 12) === 'WEBP') {
        return 'image/webp';
      }
      const normalizedType = String(headerContentType || '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (normalizedType.startsWith('image/')) {
        return normalizedType;
      }
      return null;
    };

    const translatePromptToEnglish = async (rawPrompt: string): Promise<string> => {
      const clean = rawPrompt.trim();
      if (!clean) return '';
      const tController = new AbortController();
      const tTimer = setTimeout(() => tController.abort(), 4500);
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(clean)}`;
        const tRes = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: tController.signal,
        });
        if (tRes.ok) {
          const data = (await tRes.json()) as any;
          if (Array.isArray(data?.[0])) {
            const translated = data[0]
              .map((part: any) => (Array.isArray(part) && typeof part[0] === 'string' ? part[0] : ''))
              .join('')
              .trim();
            if (translated) return translated;
          }
        }
      } catch {
        // fallback below
      } finally {
        clearTimeout(tTimer);
      }
      return clean;
    };

    const tryGeneratePollinations = async (fullPromptText: string) => {
      const modelLabel = `pollinations.ai/flux (${styleKey})`;
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPromptText)}?width=1280&height=1280&seed=${seed}&model=flux&enhance=true&nologo=true&safe=false`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      try {
        const upstream = await fetch(pollinationsUrl, {
          method: 'GET',
          headers: { Accept: 'image/*' },
          signal: controller.signal,
        });
        const buf = Buffer.from(await upstream.arrayBuffer());
        clearTimeout(timer);
        const detectedMime = detectImageMimeFromBuffer(buf, upstream.headers.get('content-type'));
        if (detectedMime) {
          return { ok: true as const, buffer: buf, mime: detectedMime, modelLabel };
        }
        const detail = buf.toString('utf8', 0, 220).trim();
        const status = upstream.status || 503;
        return {
          ok: false as const,
          status,
          detail: `HTTP ${status}${detail ? ` — ${detail}` : ' — Resposta inválida sem imagem.'}`,
          modelLabel,
        };
      } catch (err: any) {
        clearTimeout(timer);
        const status = err?.name === 'AbortError' ? 504 : 503;
        const errMsg =
          err?.name === 'AbortError' ? 'Timeout após 45s' : err?.message || 'Erro de rede';
        return { ok: false as const, status, detail: errMsg, modelLabel };
      }
    };

    const tryGenerateHuggingFaceTop = async (fullPromptText: string) => {
      const vault = await getBackendImageKey();
      const imageKey = String(vault?.imageKey || '').trim();
      if (!imageKey) {
        return {
          ok: false as const,
          status: 401,
          detail: 'Chave de Imagem SARA não configurada no painel de Admin.',
          modelLabel: hfTopProviders[0].label,
        };
      }

      let lastStatus = 503;
      let lastDetail = 'Erro desconhecido ao gerar em Qualidade Top.';
      let lastModelLabel = hfTopProviders[0].label;

      for (const provider of hfTopProviders) {
        lastModelLabel = provider.label;
        const payloads = provider.buildPayloads(fullPromptText);

        for (let i = 0; i < payloads.length; i += 1) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 60000);
          try {
            const upstream = await fetch(provider.url, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${imageKey}`,
                'Content-Type': 'application/json',
                Accept: 'image/*, application/json',
              },
              body: JSON.stringify(payloads[i]),
              signal: controller.signal,
            });
            const buf = Buffer.from(await upstream.arrayBuffer());
            clearTimeout(timer);

            const detectedMime = detectImageMimeFromBuffer(buf, upstream.headers.get('content-type'));
            if (detectedMime) {
              return { ok: true as const, buffer: buf, mime: detectedMime, modelLabel: provider.label };
            }

            const rawText = buf.toString('utf8');
            let parsed: any = null;
            try {
              parsed = JSON.parse(rawText);
            } catch {
              parsed = null;
            }

            if (parsed && typeof parsed === 'object') {
              const b64 =
                parsed?.data?.[0]?.b64_json ||
                parsed?.images?.[0]?.b64_json ||
                parsed?.b64_json ||
                null;
              if (typeof b64 === 'string' && b64.length > 50) {
                const decoded = Buffer.from(b64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
                const b64Mime = detectImageMimeFromBuffer(decoded, 'image/jpeg') || 'image/jpeg';
                return { ok: true as const, buffer: decoded, mime: b64Mime, modelLabel: provider.label };
              }

              const remoteUrl =
                parsed?.images?.[0]?.url ||
                parsed?.image?.url ||
                parsed?.data?.[0]?.url ||
                parsed?.url ||
                null;
              if (typeof remoteUrl === 'string' && isSafeRemoteImageUrl(remoteUrl)) {
                const imgController = new AbortController();
                const imgTimer = setTimeout(() => imgController.abort(), 30000);
                try {
                  const imgRes = await fetch(remoteUrl, {
                    method: 'GET',
                    headers: { Accept: 'image/*' },
                    signal: imgController.signal,
                  });
                  const imgBuf = Buffer.from(await imgRes.arrayBuffer());
                  clearTimeout(imgTimer);
                  const imgMime = detectImageMimeFromBuffer(imgBuf, imgRes.headers.get('content-type'));
                  if (imgMime) {
                    return { ok: true as const, buffer: imgBuf, mime: imgMime, modelLabel: provider.label };
                  }
                } catch {
                  clearTimeout(imgTimer);
                }
              }
            }

            lastStatus = upstream.status || 503;
            const snippet = rawText.trim().slice(0, 220);
            lastDetail = `HTTP ${lastStatus}${snippet ? ` — ${snippet}` : ''}`;

            if (/model\s+not\s+supported/i.test(rawText)) {
              break;
            }
            if (lastStatus !== 400 && lastStatus !== 422) {
              break;
            }
          } catch (err: any) {
            clearTimeout(timer);
            lastStatus = err?.name === 'AbortError' ? 504 : 503;
            lastDetail =
              err?.name === 'AbortError' ? 'Timeout após 60s' : err?.message || 'Erro de rede';
            break;
          }
        }
      }

      return {
        ok: false as const,
        status: lastStatus,
        detail: lastDetail,
        modelLabel: lastModelLabel,
      };
    };

    const englishPrompt = await translatePromptToEnglish(prompt);
    const styleSuffix = styleSuffixes[styleKey] || styleSuffixes.realistic;
    const fullPrompt = `${englishPrompt}, ${styleSuffix}, ${qualityPromptSuffix}`;

    if (mode === 'top') {
      const topResult = await tryGenerateHuggingFaceTop(fullPrompt);
      if (topResult.ok) {
        await clearBackendImageError(topResult.modelLabel);
        res.setHeader('Content-Type', topResult.mime);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send(topResult.buffer);
      }
      await recordBackendImageError(topResult.detail, topResult.status, topResult.modelLabel);
      return res.status(503).type('text/plain').send(userGenericError);
    }

    const fastResult = await tryGeneratePollinations(fullPrompt);
    if (fastResult.ok) {
      await clearBackendImageError(fastResult.modelLabel);
      res.setHeader('Content-Type', fastResult.mime);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(fastResult.buffer);
    }

    if (mode === 'auto') {
      const topFallback = await tryGenerateHuggingFaceTop(fullPrompt);
      if (topFallback.ok) {
        await clearBackendImageError(topFallback.modelLabel);
        res.setHeader('Content-Type', topFallback.mime);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send(topFallback.buffer);
      }
      await recordBackendImageError(
        `Pollinations: ${fastResult.detail} | Qualidade Top: ${topFallback.detail}`,
        topFallback.status || fastResult.status,
        `${fastResult.modelLabel} -> ${topFallback.modelLabel}`
      );
      return res.status(503).type('text/plain').send(userGenericError);
    }

    await recordBackendImageError(fastResult.detail, fastResult.status, fastResult.modelLabel);
    return res.status(503).type('text/plain').send(userGenericError);
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
