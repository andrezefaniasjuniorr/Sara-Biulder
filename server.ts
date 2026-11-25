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

  // Google Maps Platform endpoints (servidor evita CORS e mantém chave segura em proxies)
  const getMapsApiKey = () =>
    (process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();

  app.get('/api/maps/client-config', (_req, res) => {
    res.json({ mapsApiKey: getMapsApiKey() });
  });

  app.post('/api/maps/reverse-geocode', async (req, res) => {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Coordenadas inválidas.' });
    }
    const mapsKey = getMapsApiKey();
    if (!mapsKey) {
      return res.status(503).json({ error: 'Serviço de mapas indisponível no servidor.' });
    }

    try {
      const url = new URL('https://geocode.googleapis.com/v4/geocode/location');
      url.searchParams.set('location.latitude', String(lat));
      url.searchParams.set('location.longitude', String(lng));
      url.searchParams.set('languageCode', 'pt');
      url.searchParams.set('regionCode', 'MZ');

      const geoRes = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': mapsKey,
          'X-Goog-FieldMask':
            'results.placeId,results.formattedAddress,results.addressComponents,results.types',
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        },
      });

      const bodyText = await geoRes.text();
      if (!geoRes.ok) {
        const isQuota =
          geoRes.status === 429 ||
          /RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|Quota/i.test(bodyText);
        return res.status(isQuota ? 429 : geoRes.status).json({
          quotaExceeded: isQuota,
          error: isQuota ? 'QUOTA_EXCEEDED' : 'Falha ao obter endereço real.',
        });
      }

      const data = JSON.parse(bodyText) as {
        results?: Array<{
          placeId?: string;
          formattedAddress?: string;
          addressComponents?: Array<{
            longText?: string;
            shortText?: string;
            types?: string[];
          }>;
        }>;
      };

      const results = Array.isArray(data.results) ? data.results : [];
      const first = results[0];
      if (!first) {
        return res.json({
          formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          street: '',
          neighborhood: '',
          city: '',
          country: '',
        });
      }

      const pickComp = (acceptedTypes: string[]) => {
        for (const r of results) {
          for (const c of r.addressComponents || []) {
            const types = c.types || [];
            if (acceptedTypes.some((t) => types.includes(t))) {
              return c.longText || c.shortText || '';
            }
          }
        }
        return '';
      };

      const route = pickComp(['route']);
      const streetNum = pickComp(['street_number']);
      const street = [route, streetNum].filter(Boolean).join(', ');
      const neighborhood = pickComp([
        'sublocality_level_1',
        'sublocality',
        'neighborhood',
        'administrative_area_level_3',
      ]);
      const city = pickComp([
        'locality',
        'administrative_area_level_2',
        'administrative_area_level_1',
      ]);
      const country = pickComp(['country']);

      return res.json({
        formattedAddress: first.formattedAddress || [street, neighborhood, city].filter(Boolean).join(', '),
        street,
        neighborhood,
        city,
        country,
        placeId: first.placeId || undefined,
      });
    } catch {
      return res.status(502).json({ error: 'Sem resposta do serviço de endereços.' });
    }
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
