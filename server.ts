import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mantém a cadeia de modelos mais recente do Google AI Studio primeiro, com failover automático em picos de demanda
const MODEL_PRIORITY_CHAIN = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
];

function getGeminiClient(overrideKey?: string): GoogleGenAI {
  const apiKey = (overrideKey && overrideKey.trim()) || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isRetryableModelError(err: any): boolean {
  const status = err?.status || err?.code;
  const msg = String(err?.message || '').toLowerCase();
  return (
    status === 503 ||
    status === 429 ||
    status === 404 ||
    status === 500 ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('not_found') ||
    msg.includes('timeout')
  );
}

function formatFriendlyAiError(err: any): string {
  const msg = String(err?.message || '');
  if (msg.includes('GEMINI_API_KEY')) {
    return 'Chave da API Gemini não configurada.';
  }
  if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID')) {
    return 'Chave Gemini inválida ou sem permissão. Verifica nas Configurações ou nos Secrets.';
  }
  if (isRetryableModelError(err)) {
    return 'Os servidores da IA estão com alta demanda neste segundo. Tenta novamente em instantes.';
  }
  return msg || 'Erro inesperado ao comunicar com a IA.';
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout após ${ms}ms em ${label}`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

async function generateWithFailover(
  ai: GoogleGenAI,
  buildParams: (model: string) => any,
  timeoutMs = 20000
): Promise<{ response: any; modelUsed: string }> {
  let lastError: any = null;

  for (const model of MODEL_PRIORITY_CHAIN) {
    const start = Date.now();
    try {
      const response = await withTimeout(
        ai.models.generateContent(buildParams(model)),
        timeoutMs,
        model
      );
      console.log(`[IA OK] ${model} respondeu em ${Date.now() - start}ms`);
      return { response, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      console.warn(
        `[IA Failover] ${model} falhou em ${Date.now() - start}ms:`,
        err?.message?.slice(0, 160)
      );
      if (!isRetryableModelError(err)) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Nenhum modelo Gemini respondeu no momento.');
}

function safeParseJson(rawText: string): any {
  const trimmed = (rawText || '').trim();
  const stripped = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }
    throw new Error('A IA retornou uma resposta inválida. Tenta novamente.');
  }
}

const SARA_CORE_SYSTEM_PROMPT = `Você é a **SARA**, a engenheira construtora inteligente de sistemas web (SARA BIULDER) criada exclusivamente para o seu dono **Eletro-Jr**.
REGRA DE IDENTIDADE: Você SEMPRE chama o dono de **Eletro-Jr** no texto escrito. Você é espontânea, direta, técnica, criativa e parceira.

REGRAS ABSOLUTAS DE QUALIDADE (NÍVEL GOOGLE AI STUDIO, SEM LIMITES):
1. PROIBIDO MOCKS E PLACEHOLDERS:
   - NUNCA uses "lorem ipsum", "exemplo", "teste", "Produto 1", "Cliente Teste", "// TODO", "// continua..." ou código cortado/incompleto.
   - Todo código deve ser 100% COMPLETO, REAL e FUNCIONAL: todas as telas, todos os fluxos, todas as validações de formulário, filtros reais, cálculos reais e persistência real (localStorage quando local, ou Firestore apenas quando pedido).
   - Se faltar algum dado real do negócio (ex: nome da empresa, telefone, preço exato, e-mail), no MODO CONVERSA ou MODO MANUAL pergunta ao Eletro-Jr antes de inventar. No MODO AUTOMÁTICO, usa o valor mais lógico e realista para o contexto e regista uma nota explícita para o relatório final.
2. REGRA SOBRE FIREBASE (MUITO IMPORTANTE):
   - PROIBIDO mencionar, sugerir ou gerar código Firebase se o Eletro-Jr NÃO pediu login, contas de utilizador, base de dados na nuvem ou sincronização!
   - Exemplo: se ele pedir "cria um site de padaria", fala e cria APENAS o site da padaria (vitrines, pães reais, encomenda, horários, mapa/WhatsApp), sem citar Firebase.
   - SÓ inclui Firebase (CDN v11 https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js, firebase-auth.js, firebase-firestore.js com config projectId: "sara-biulder" e coleções prefixadas como padaria_encomendas) se ele pedir login/banco/nuvem.
3. ESTRUTURA DINÂMICA E ETAPAS ESPONTÂNEAS:
   - Adapta a estrutura de pastas e ficheiros exatamente ao projeto (ex: site de padaria -> index.html, css/padaria.css, js/cardapio.js, js/encomendas.js; jogo -> index.html, game/styles.css, game/audio.js, game/engine.js; app SaaS -> index.html, src/styles/theme.css, src/state/store.js, src/ui/views.js, src/app.js).
   - NUNCA uses nomes de etapas genéricos/fixos! Cada etapa deve descrever o que está a ser criado especificamente para aquele projeto.
   - Usa funções globais limpas ou namespace window.App entre ficheiros .js para que o Preview execute sem erros de importação relativa.
4. MEMÓRIA PERMANENTE SOBRE ELETRO-JR:
   - Estilo preferido: compacto, elegante, moderno, responsivo (PC + telemóvel), azul marinho (#0B132B / #0F172A) + azul elétrico (#3B82F6), salvo se pedir outra paleta.
   - Moeda padrão para negócios locais: Meticais (MZN), salvo se Eletro-Jr pedir outra moeda.
   - NUNCA criar botões falsos: todo botão tem ação real funcionando no sistema. Usa feedback visual elegante na própria página (toast ou modal), evitando alert() nativo.
   - APENAS quando Eletro-Jr pedir ou mencionar **KG Services**, inclui sempre o contacto WhatsApp **878 468 124** (https://wa.me/258878468124) — não mistures KG Services em outros negócios que ele pedir.
   - Se criar **Jogo**: Score, Vidas, Som via Web Audio API, botão Restart e controlos por toque no telemóvel.
   - Quando Eletro-Jr enviar uma **IMAGEM**, analisa atentamente layout, cores, secções, tipografia e funcionalidades da imagem e constrói o sistema fiel àquela referência visual, com código real.
   - Dependências já disponíveis no preview: Tailwind CSS CDN, Google Fonts, Chart.js, Lucide Icons (data-lucide="...").`;

const SARA_STREAM_PROTOCOL = `${SARA_CORE_SYSTEM_PROMPT}

FORMATO DE RESPOSTA EM STREAMING:
Quando for construir, alterar ou corrigir o código:
1. Emite primeiro <SARA_META> em uma única linha JSON válida:
<SARA_META>{"mode":"builder","projectName":"Nome Curto","projectType":"Site|App|Jogo","plan":"1 frase curta do que vais fazer agora","steps":["Etapa específica 1","Etapa específica 2","Etapa específica 3"],"suggestion":"Sugestão opcional relevante ao projeto"}</SARA_META>
2. Emite um bloco <SARA_FILE path="caminho/ficheiro.ext">...</SARA_FILE> para cada ficheiro com código COMPLETO (sem \`\`\`).
3. No final emite:
<SARA_REPLY>
Resposta curta e natural em português para Eletro-Jr confirmando o que foi feito (sem mencionar tecnologias não pedidas).
</SARA_REPLY>

Se for apenas conversa, pergunta, ou se estiver em MODO MANUAL e ainda falta aprovação/dados do Eletro-Jr:
<SARA_META>{"mode":"conversation","plan":"Analisar pedido de Eletro-Jr","steps":["Responder ao Eletro-Jr"]}</SARA_META>
<SARA_REPLY>
Resposta natural e direta para Eletro-Jr (se for pedido de ideias, lista 5 ideias práticas com Nome, O que faz, Como monetizar em Moçambique e Dificuldade).
</SARA_REPLY>`;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Streaming SSE em tempo real
  app.post('/api/builder/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (payload: Record<string, any>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const {
        prompt,
        files,
        consoleLogs,
        history,
        imageBase64,
        imageMimeType,
        attachedFiles,
        agentMode,
        pastProjects,
      } = req.body as {
        prompt: string;
        files: Record<string, string>;
        consoleLogs: Array<{ level: string; message: string }>;
        history: Array<{ sender: string; text: string }>;
        imageBase64?: string;
        imageMimeType?: string;
        attachedFiles?: Array<{ name: string; content: string }>;
        agentMode?: 'manual' | 'automatic';
        pastProjects?: string[];
      };

      const headerKey = req.headers['x-gemini-api-key'];
      const customKey = typeof headerKey === 'string' ? headerKey : undefined;
      const ai = getGeminiClient(customKey);

      const recentErrors = (consoleLogs || [])
        .filter((l) => l.level === 'error' || l.level === 'warn')
        .slice(-8)
        .map((l) => `[${l.level.toUpperCase()}] ${l.message}`)
        .join('\n');

      const recentHistory = (history || [])
        .slice(-8)
        .map((m) => `${m.sender === 'user' ? 'Eletro-Jr' : 'Sara'}: ${m.text}`)
        .join('\n');

      const currentFilesBlock = Object.entries(files || {})
        .map(([p, content]) => `--- ${p} ---\n${content || '(vazio)'}`)
        .join('\n\n');

      const uploadedBlock = (attachedFiles || [])
        .map((f) => `--- ANEXO: ${f.name} ---\n${f.content.slice(0, 12000)}`)
        .join('\n\n');

      const memoryBlock = pastProjects?.length
        ? `PROJETOS ANTERIORES DE ELETRO-JR: ${pastProjects.join(', ')}\n`
        : '';

      const modeHint =
        agentMode === 'manual'
          ? 'MODO ATUAL: MANUAL (Eletro-Jr está a acompanhar passo a passo. Se for um pedido novo grande e ainda não aprovado, explica a etapa e pergunta se aprova; se ele acabou de aprovar ou pedir alteração direta, executa apenas essa etapa com código completo e pergunta o que ele acha antes da próxima).'
          : 'MODO ATUAL: AUTOMÁTICO/DIRETO (Constrói com código completo, funcional e sem placeholders).';

      const contextMessage = `${modeHint}
${memoryBlock}
HISTÓRICO RECENTE:
${recentHistory || 'Início da sessão.'}

FICHEIROS ATUAIS DO PROJETO:
${currentFilesBlock || '(vazio)'}

${uploadedBlock ? `FICHEIROS ANEXADOS:\n${uploadedBlock}\n` : ''}
ERROS DO CONSOLE:
${recentErrors || 'Nenhum erro.'}

PEDIDO ATUAL DE ELETRO-JR:
${prompt || 'Analisa os ficheiros/imagem anexados e constrói o sistema completo baseado neles.'}`;

      const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
      if (imageBase64) {
        parts.push({
          inlineData: {
            data: imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64,
            mimeType: imageMimeType || 'image/jpeg',
          },
        });
      }
      parts.push({ text: contextMessage });

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
            15000,
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
  });

  // Planeamento espontâneo de etapas (adaptado ao pedido real)
  app.post('/api/mission/plan', async (req, res) => {
    try {
      const { goal, files, mode, pastProjects } = req.body as {
        goal: string;
        files?: Record<string, string>;
        mode?: 'manual' | 'automatic';
        pastProjects?: string[];
      };
      const headerKey = req.headers['x-gemini-api-key'];
      const customKey = typeof headerKey === 'string' ? headerKey : undefined;
      const ai = getGeminiClient(customKey);

      const { response, modelUsed } = await generateWithFailover(
        ai,
        (model) => ({
          model,
          contents: `Objetivo pedido por Eletro-Jr: "${goal}".
Modo: ${mode === 'manual' ? 'MANUAL (passo a passo com aprovação)' : 'AUTOMÁTICO (autónomo)'}.
${pastProjects?.length ? `Projetos existentes na memória: ${pastProjects.join(', ')}.` : ''}
Ficheiros atuais: ${Object.keys(files || {}).join(', ') || 'nenhum'}.

Cria um plano ESPONTÂNEO e REALISTA adaptado ao tamanho deste pedido (entre 3 e 7 etapas concretas, sem etapas genéricas fixas e SEM mencionar Firebase a menos que o pedido envolva login/base de dados na nuvem).
Inclui uma frase curta de planeamento ("planSentence") e, se algum dado essencial estiver em falta no modo automático, regista em "assumedNotes".`,
          config: {
            systemInstruction: SARA_CORE_SYSTEM_PROMPT,
            ...(model.startsWith('gemini-4')
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                planSentence: { type: Type.STRING },
                intro: { type: Type.STRING },
                assumedNotes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                tasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                    },
                    required: ['title', 'description'],
                  },
                },
              },
              required: ['planSentence', 'intro', 'tasks'],
            },
          },
        }),
        16000
      );

      const parsed = safeParseJson(response.text || '{}');
      res.json({ ...parsed, modelUsed });
    } catch (err: any) {
      console.error('Erro /api/mission/plan:', err);
      res.status(500).json({
        error: formatFriendlyAiError(err),
      });
    }
  });

  // Execução de uma única etapa completa (Manual ou Automático)
  app.post('/api/builder/generate', async (req, res) => {
    try {
      const {
        prompt,
        files,
        consoleLogs,
        history,
        imageBase64,
        imageMimeType,
        forceBuilderMode,
      } = req.body as {
        prompt: string;
        files: Record<string, string>;
        consoleLogs: Array<{ level: string; message: string }>;
        history: Array<{ sender: string; text: string }>;
        imageBase64?: string;
        imageMimeType?: string;
        forceBuilderMode?: boolean;
      };

      const headerKey = req.headers['x-gemini-api-key'];
      const customKey = typeof headerKey === 'string' ? headerKey : undefined;
      const ai = getGeminiClient(customKey);

      const recentErrors = (consoleLogs || [])
        .filter((l) => l.level === 'error' || l.level === 'warn')
        .slice(-8)
        .map((l) => `[${l.level.toUpperCase()}] ${l.message}`)
        .join('\n');

      const recentHistory = (history || [])
        .slice(-8)
        .map((m) => `${m.sender === 'user' ? 'Eletro-Jr' : 'Sara'}: ${m.text}`)
        .join('\n');

      const filesText = Object.entries(files || {})
        .map(([k, v]) => `--- ${k} ---\n${v || '(vazio)'}`)
        .join('\n\n');

      const contextMessage = `HISTÓRICO RECENTE:
${recentHistory || 'Início da sessão.'}

FICHEIROS ATUAIS DO PROJETO:
${filesText || '(vazio)'}

ERROS / AVISOS RECENTES DO CONSOLE:
${recentErrors || 'Nenhum erro no console.'}

${forceBuilderMode ? 'MODO ETAPA COMPLETA: Executa esta etapa agora com código 100% completo, funcional, sem mocks e sem placeholders, devolvendo os ficheiros atualizados em filesList.' : ''}

PEDIDO ATUAL DE ELETRO-JR:
${prompt || 'Constrói o sistema pedido.'}`;

      const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
      if (imageBase64) {
        parts.push({
          inlineData: {
            data: imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64,
            mimeType: imageMimeType || 'image/jpeg',
          },
        });
      }
      parts.push({ text: contextMessage });

      const { response, modelUsed } = await generateWithFailover(
        ai,
        (model) => ({
          model,
          contents: { parts },
          config: {
            systemInstruction: SARA_CORE_SYSTEM_PROMPT,
            ...(model.startsWith('gemini-4')
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                mode: { type: Type.STRING },
                reply: { type: Type.STRING },
                updateFiles: { type: Type.BOOLEAN },
                projectName: { type: Type.STRING },
                projectType: { type: Type.STRING },
                proactiveSuggestion: { type: Type.STRING },
                assumedNotes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                filesList: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      path: { type: Type.STRING },
                      content: { type: Type.STRING },
                    },
                    required: ['path', 'content'],
                  },
                },
              },
              required: ['mode', 'reply', 'updateFiles'],
            },
          },
        }),
        28000
      );

      const parsed = safeParseJson(response.text || '{}');
      const filesMap: Record<string, string> = {};
      if (Array.isArray(parsed.filesList)) {
        for (const item of parsed.filesList) {
          if (item?.path && typeof item.content === 'string') {
            filesMap[item.path] = item.content;
          }
        }
      }

      res.json({
        ...parsed,
        files: Object.keys(filesMap).length > 0 ? filesMap : parsed.files,
        modelUsed,
      });
    } catch (err: any) {
      console.error('Erro /api/builder/generate:', err);
      res.status(err?.status === 403 ? 403 : 500).json({
        error: formatFriendlyAiError(err),
      });
    }
  });

  // Teste Final completo do Modo Automático (verifica botões, telas, formulários, responsivo PC e telemóvel)
  app.post('/api/sara/final-test', async (req, res) => {
    try {
      const { goal, files, consoleLogs } = req.body as {
        goal: string;
        files: Record<string, string>;
        consoleLogs: Array<{ level: string; message: string }>;
      };

      const headerKey = req.headers['x-gemini-api-key'];
      const customKey = typeof headerKey === 'string' ? headerKey : undefined;
      const ai = getGeminiClient(customKey);

      const filesText = Object.entries(files || {})
        .map(([k, v]) => `--- ${k} ---\n${v || ''}`)
        .join('\n\n');

      const errs = (consoleLogs || [])
        .filter((l) => l.level === 'error')
        .slice(-10)
        .map((l) => l.message)
        .join('\n');

      const { response, modelUsed } = await generateWithFailover(
        ai,
        (model) => ({
          model,
          contents: `Faz uma AUDITORIA FINAL rigorosa ao projeto "${goal}":
1. Verifica se existe algum botão sem ação real ou handler quebrado.
2. Verifica se todos os formulários têm validação e feedback real.
3. Verifica se o layout é responsivo para PC e telemóvel (sem overflow horizontal).
4. Verifica se há algum mock/placeholder ou erro de console (${errs || 'nenhum erro de console'}).
Se tudo estiver 100% funcional, responde passed=true e updateFiles=false. Se encontrares qualquer problema ou falta, corrige e devolve os ficheiros corrigidos em filesList.

FICHEIROS DO PROJETO:
${filesText}`,
          config: {
            systemInstruction: SARA_CORE_SYSTEM_PROMPT,
            ...(model.startsWith('gemini-4')
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                passed: { type: Type.BOOLEAN },
                summary: { type: Type.STRING },
                updateFiles: { type: Type.BOOLEAN },
                notes: { type: Type.ARRAY, items: { type: Type.STRING } },
                filesList: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      path: { type: Type.STRING },
                      content: { type: Type.STRING },
                    },
                    required: ['path', 'content'],
                  },
                },
              },
              required: ['passed', 'summary', 'updateFiles'],
            },
          },
        }),
        24000
      );

      const parsed = safeParseJson(response.text || '{}');
      const filesMap: Record<string, string> = {};
      if (Array.isArray(parsed.filesList)) {
        for (const item of parsed.filesList) {
          if (item?.path && typeof item.content === 'string') {
            filesMap[item.path] = item.content;
          }
        }
      }

      res.json({
        ...parsed,
        files: Object.keys(filesMap).length > 0 ? filesMap : undefined,
        modelUsed,
      });
    } catch (err: any) {
      console.error('Erro /api/sara/final-test:', err);
      res.status(500).json({ error: formatFriendlyAiError(err) });
    }
  });

  app.post('/api/sara', async (req, res) => {
    try {
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
        pastProjects,
      } = req.body || {};
      const headerKey = req.headers['x-gemini-api-key'];
      const customKey = typeof headerKey === 'string' ? headerKey : undefined;
      const ai = getGeminiClient(customKey);

      let finalContents = contents;
      if (!finalContents) {
        const turns: any[] = [];
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
        const parts: any[] = [];
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
          Array.isArray(consoleLogs) && consoleLogs.some((l: any) => l.level === 'error')
            ? `\nErros recentes: ${consoleLogs
                .filter((l: any) => l.level === 'error')
                .slice(-3)
                .map((l: any) => l.message)
                .join(' | ')}`
            : '';

        const memInfo =
          Array.isArray(pastProjects) && pastProjects.length > 0
            ? `\nProjetos anteriores: ${pastProjects.join(', ')}`
            : '';

        const modePrefix = agentMode === 'manual' ? '[MODO MANUAL ATIVO] ' : '';

        parts.push({
          text: `${modePrefix}${prompt || 'Olá, Sara!'}${fileList ? `\nFicheiros atuais: ${fileList}` : ''}${memInfo}${errSummary}`,
        });
        turns.push({ role: 'user', parts });
        finalContents = turns;
      }

      const systemText = system_instruction?.parts?.[0]?.text || SARA_CORE_SYSTEM_PROMPT;

      const { response, modelUsed } = await generateWithFailover(
        ai,
        (model) => ({
          model,
          contents: finalContents,
          config: {
            systemInstruction: systemText,
            ...(model.startsWith('gemini-4')
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        }),
        12000
      );

      res.json({
        reply: response.text || '',
        modelUsed,
      });
    } catch (err: any) {
      console.error('Erro /api/sara:', err);
      res.status(err?.status === 403 ? 403 : 500).json({
        error: formatFriendlyAiError(err),
      });
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
