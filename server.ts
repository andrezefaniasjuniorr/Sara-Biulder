import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { ThinkingLevel } from '@google/genai';
import {
  MODEL_PRIORITY_CHAIN,
  SARA_STREAM_PROTOCOL,
  buildStreamParts,
  formatFriendlyAiError,
  getGeminiClient,
  isRetryableModelError,
  runBuilderGenerate,
  runFinalTestAudit,
  runMissionPlan,
  runSaraConversation,
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
            console.log(`[Stream OK] ${model} enviou ${chunkCount} chunks em ${Date.now() - streamStart}ms`);
            sendEvent({ type: 'done', model });
            break;
          }
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

  app.post('/api/sara', handleSaraChat);

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
