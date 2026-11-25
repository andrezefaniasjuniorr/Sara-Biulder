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

  // Endpoints de Mapa Aberto Gratuito do Núcleo SARA (zero chaves, zero verificação)
  app.post('/api/maps/reverse-geocode', async (req, res) => {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Coordenadas inválidas.' });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lng));
      url.searchParams.set('zoom', '18');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('accept-language', 'pt');

      const geoRes = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'SARA-OS-Radar/2.0 (Nucleo SARA Open Map)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!geoRes.ok) {
        return res.json({
          formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          street: '',
          neighborhood: '',
          city: '',
          country: '',
        });
      }

      const data = (await geoRes.json()) as {
        display_name?: string;
        address?: Record<string, string | undefined>;
      };
      const addr = data?.address || {};
      const street = [addr.road || addr.pedestrian || addr.footway || addr.path || '', addr.house_number || '']
        .filter(Boolean)
        .join(', ');
      const neighborhood =
        addr.suburb ||
        addr.neighbourhood ||
        addr.quarter ||
        addr.city_district ||
        addr.residential ||
        '';
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.county ||
        addr.state ||
        '';
      const country = addr.country || '';
      const compactParts = [street, neighborhood, city, country].filter(Boolean);

      return res.json({
        formattedAddress:
          compactParts.length > 0
            ? compactParts.join(', ')
            : data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        street,
        neighborhood,
        city,
        country,
      });
    } catch {
      clearTimeout(timer);
      return res.json({
        formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        street: '',
        neighborhood: '',
        city: '',
        country: '',
      });
    }
  });

  app.post('/api/maps/search-places', async (req, res) => {
    const query = String(req.body?.query || '').trim();
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (query.length < 2 || query.length > 160) {
      return res.json({ results: [] });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('q', query);
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('accept-language', 'pt');
      url.searchParams.set('limit', '6');

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        url.searchParams.set(
          'viewbox',
          `${(lng - 0.3).toFixed(4)},${(lat + 0.3).toFixed(4)},${(lng + 0.3).toFixed(4)},${(lat - 0.3).toFixed(4)}`
        );
        url.searchParams.set('bounded', '0');
      }

      const searchRes = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'SARA-OS-Radar/2.0 (Nucleo SARA Open Map)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!searchRes.ok) {
        return res.json({ results: [] });
      }

      const list = (await searchRes.json()) as Array<{
        place_id?: number | string;
        display_name?: string;
        name?: string;
        lat?: string;
        lon?: string;
        type?: string;
        category?: string;
        address?: Record<string, string | undefined>;
      }>;

      const results = (Array.isArray(list) ? list : [])
        .map((item, idx) => {
          const rLat = Number(item.lat);
          const rLng = Number(item.lon);
          if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) return null;
          const addr = item.address || {};
          const shortName =
            item.name ||
            addr.road ||
            addr.suburb ||
            addr.neighbourhood ||
            (item.display_name ? item.display_name.split(',')[0] : query);
          return {
            id: String(item.place_id || `osm_${idx}_${Date.now()}`),
            name: String(shortName || query).trim(),
            address: item.display_name || undefined,
            lat: rLat,
            lng: rLng,
            categoryLabel: item.type || item.category || undefined,
          };
        })
        .filter(Boolean);

      return res.json({ results });
    } catch {
      clearTimeout(timer);
      return res.json({ results: [] });
    }
  });

  app.post('/api/maps/route', async (req, res) => {
    const oLat = Number(req.body?.origin?.lat);
    const oLng = Number(req.body?.origin?.lng);
    const dLat = Number(req.body?.destination?.lat);
    const dLng = Number(req.body?.destination?.lng);

    if (
      !Number.isFinite(oLat) ||
      !Number.isFinite(oLng) ||
      !Number.isFinite(dLat) ||
      !Number.isFinite(dLng)
    ) {
      return res.status(400).json({ ok: false, error: 'Coordenadas de rota inválidas.' });
    }

    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dPhi = toRad(dLat - oLat);
    const dLambda = toRad(dLng - oLng);
    const a =
      Math.sin(dPhi / 2) ** 2 +
      Math.cos(toRad(oLat)) * Math.cos(toRad(dLat)) * Math.sin(dLambda / 2) ** 2;
    const straightMeters = Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson`;
      const routeRes = await fetch(osrmUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (routeRes.ok) {
        const data = (await routeRes.json()) as {
          routes?: Array<{
            distance?: number;
            duration?: number;
            geometry?: { coordinates?: Array<[number, number]> };
          }>;
        };
        const first = data?.routes?.[0];
        const coords = first?.geometry?.coordinates;
        if (first && Array.isArray(coords) && coords.length >= 2) {
          const path = coords.map(([lngVal, latVal]) => [latVal, lngVal] as [number, number]);
          return res.json({
            ok: true,
            distanceMeters: Math.round(Number(first.distance ?? straightMeters)),
            durationSeconds: Math.max(60, Math.round(Number(first.duration ?? straightMeters / 8))),
            path,
          });
        }
      }
    } catch {
      clearTimeout(timer);
    }

    return res.json({
      ok: true,
      fallback: true,
      distanceMeters: straightMeters,
      durationSeconds: Math.max(60, Math.round(straightMeters / 8.5)),
      path: [
        [oLat, oLng],
        [dLat, dLng],
      ],
    });
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

  app.post('/api/image/generate', async (req, res) => {
    const rawKey = String(req.headers['x-sara-image-key'] || '').trim();
    const prompt = String(req.body?.prompt || '').trim();

    if (!rawKey || !rawKey.startsWith('hf_') || rawKey.length < 10) {
      return res.status(401).json({
        ok: false,
        code: 'INVALID_KEY',
        error: 'Coloca a tua chave de imagem nas Definições para gerar imagens.',
      });
    }

    if (!prompt || prompt.length > 1000) {
      return res.status(400).json({
        ok: false,
        error: 'Descrição inválida para gerar a imagem.',
      });
    }

    const models = [
      'black-forest-labs/FLUX.1-schnell',
      'stabilityai/stable-diffusion-xl-base-1.0',
    ];

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
              Authorization: `Bearer ${rawKey}`,
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
          return res.status(401).json({
            ok: false,
            code: 'INVALID_KEY',
            error: 'Coloca a tua chave de imagem nas Definições para gerar imagens.',
          });
        }

        const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
        if (upstream.ok && contentType.startsWith('image/')) {
          const buf = Buffer.from(await upstream.arrayBuffer());
          if (buf.length > 0) {
            const mime = contentType.split(';')[0] || 'image/png';
            return res.json({
              ok: true,
              dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
            });
          }
        }

        // Em caso de falha transitória ou modelo indisponível, tenta o próximo modelo
        if (i < models.length - 1 && [404, 410, 429, 500, 502, 503, 504].includes(upstream.status)) {
          continue;
        }

        if (upstream.status === 402) {
          return res.status(402).json({
            ok: false,
            error: 'Núcleo SARA atingiu o limite temporário de criação de imagens.',
          });
        }

        return res.status(503).json({
          ok: false,
          error: 'Núcleo SARA ocupado ao criar a imagem. Tenta novamente dentro de instantes.',
        });
      } catch {
        clearTimeout(timer);
        if (i < models.length - 1) continue;
        return res.status(504).json({
          ok: false,
          error: 'Núcleo SARA demorou a responder. Tenta novamente.',
        });
      }
    }

    return res.status(503).json({
      ok: false,
      error: 'Núcleo SARA ocupado ao criar a imagem. Tenta novamente.',
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
