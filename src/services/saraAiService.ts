import type {
  AgentMode,
  AttachedFile,
  BuildStep,
  ChatCodeBlock,
  ChatMessage,
  ConsoleEntry,
  ProjectFiles,
  ProjectType,
} from '../types/builder';
import type { SaraProjectState } from '../utils/projectMemory';

export interface ConvertedImage {
  data: string;
  mimeType: string;
  previewUrl: string;
}

export async function convertFileToMultimodalImage(file: File): Promise<ConvertedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler ficheiro de imagem.'));
    reader.onload = () => {
      const fullDataUrl = (reader.result as string) || '';
      const pureBase64 = fullDataUrl.includes(',') ? fullDataUrl.split(',')[1] : fullDataUrl;

      let mimeType = file.type || '';
      if (!mimeType || mimeType === 'application/octet-stream') {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'webp') mimeType = 'image/webp';
        else if (ext === 'heic' || ext === 'heif') mimeType = 'image/heic';
        else mimeType = 'image/jpeg';
      }

      if (typeof window !== 'undefined' && typeof Image !== 'undefined' && mimeType !== 'image/heic') {
        const img = new Image();
        img.onload = () => {
          try {
            const maxDim = 1600;
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const targetMime = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
              const optimizedDataUrl = canvas.toDataURL(targetMime, 0.88);
              const optBase64 = optimizedDataUrl.split(',')[1];
              resolve({
                data: optBase64,
                mimeType: targetMime,
                previewUrl: optimizedDataUrl,
              });
              return;
            }
          } catch {
            // fallback
          }
          resolve({
            data: pureBase64,
            mimeType: mimeType || 'image/jpeg',
            previewUrl: fullDataUrl,
          });
        };
        img.onerror = () => {
          resolve({
            data: pureBase64,
            mimeType: mimeType || 'image/jpeg',
            previewUrl: fullDataUrl,
          });
        };
        img.src = fullDataUrl;
        return;
      }

      resolve({
        data: pureBase64,
        mimeType: mimeType || 'image/jpeg',
        previewUrl: fullDataUrl,
      });
    };
    reader.readAsDataURL(file);
  });
}

export function getSavedGeminiKey(): string {
  try {
    return localStorage.getItem('GEMINI_API_KEY') || '';
  } catch {
    return '';
  }
}

export function saveGeminiKey(key: string): void {
  try {
    const clean = key.trim();
    if (clean) {
      localStorage.setItem('GEMINI_API_KEY', clean);
    } else {
      localStorage.removeItem('GEMINI_API_KEY');
    }
  } catch {
    // ignore storage errors
  }
}

export function extractApiKeyFromTxtContent(txt: string): string | null {
  const match = txt.match(/AIza[0-9A-Za-z\-_]{20,}/);
  return match ? match[0] : null;
}

function isPureConversationIntent(prompt: string, hasImage: boolean, hasAttachments: boolean): boolean {
  if (hasImage || hasAttachments) return false;
  const p = prompt.toLowerCase().trim();
  const buildKeywords = [
    'cria',
    'criar',
    'gera',
    'gerar',
    'faz',
    'fazer',
    'constrói',
    'constroi',
    'construir',
    'sistema',
    'site',
    'app',
    'aplicativo',
    'jogo',
    'loja',
    'dashboard',
    'painel',
    'portal',
    'página',
    'pagina',
    'botão',
    'botao',
    'adiciona',
    'adicionar',
    'muda',
    'mudar',
    'altera',
    'alterar',
    'corrige',
    'corrigir',
    'fix',
    'atualiza',
    'atualizar',
    'melhora',
    'melhorar',
    'edita',
    'editar',
    'remove',
    'remover',
    'coloca',
    'colocar',
    'inclui',
    'incluir',
  ];
  if (buildKeywords.some((k) => p.includes(k))) return false;

  const chatCues = [
    'ideia',
    'ideias',
    'sugere',
    'sugest',
    'como ganhar dinheiro',
    'o que achas',
    'pensar',
    'conversa',
    'olá',
    'ola',
    'oi',
    'tudo bem',
    'bom dia',
    'boa tarde',
    'boa noite',
    'explica',
    'por que',
    'porque',
    'qual melhor',
    'quem és',
    'quem es',
  ];
  return chatCues.some((c) => p.includes(c)) || p.split(/\s+/).length <= 3;
}

export interface StreamMeta {
  mode: 'builder' | 'conversation';
  projectName?: string;
  projectType?: ProjectType;
  plan?: string;
  steps?: string[];
  nextStep?: string;
  missingFeatures?: string[];
  suggestion?: string;
}

export interface SaraBuilderResult {
  mode: 'conversation' | 'builder';
  reply: string;
  updateFiles: boolean;
  files?: ProjectFiles;
  projectName?: string;
  projectType?: ProjectType;
  planSentence?: string;
  nextStep?: string;
  missingFeatures?: string[];
  proactiveSuggestion?: string;
  assumedNotes?: string[];
  engineLabel: string;
  steps?: BuildStep[];
  codeBlocks?: ChatCodeBlock[];
  modelUsed?: string;
}

function stripCodeFence(content: string): string {
  return content
    .replace(/^\s*```[a-zA-Z0-9_-]*\n?/, '')
    .replace(/\n?```\s*$/, '');
}

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'css') return 'css';
  if (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx') return 'javascript';
  if (ext === 'json') return 'json';
  return 'text';
}

export function filesToCodeBlocks(files?: ProjectFiles): ChatCodeBlock[] {
  if (!files) return [];
  return Object.entries(files)
    .filter(([, content]) => Boolean(content?.trim()))
    .map(([path, code]) => ({
      path,
      code,
      language: detectLanguage(path),
    }));
}

function parseStreamBuffer(fullBuffer: string): {
  meta: StreamMeta | null;
  files: ProjectFiles;
  activeFilePath: string | undefined;
  completedFiles: string[];
  reply: string;
} {
  let meta: StreamMeta | null = null;
  const metaMatch = fullBuffer.match(/<SARA_META>([\s\S]*?)<\/SARA_META>/);
  if (metaMatch) {
    try {
      meta = JSON.parse(metaMatch[1].trim());
    } catch {
      // ignore partial
    }
  }

  const files: ProjectFiles = {};
  const completedFiles: string[] = [];
  const closedRegex = /<SARA_FILE\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/SARA_FILE>/g;
  let match: RegExpExecArray | null;
  let lastClosedEnd = 0;

  while ((match = closedRegex.exec(fullBuffer)) !== null) {
    const filePath = match[1].trim().replace(/^\/+/, '');
    files[filePath] = stripCodeFence(match[2].trim());
    completedFiles.push(filePath);
    lastClosedEnd = closedRegex.lastIndex;
  }

  let activeFilePath: string | undefined;
  const tail = fullBuffer.slice(lastClosedEnd);
  const openMatch = tail.match(/<SARA_FILE\s+path=["']([^"']+)["']\s*>([\s\S]*)$/);
  if (openMatch) {
    activeFilePath = openMatch[1].trim().replace(/^\/+/, '');
    files[activeFilePath] = stripCodeFence(openMatch[2].trimStart());
  }

  let reply = '';
  const replyClosed = fullBuffer.match(/<SARA_REPLY>([\s\S]*?)<\/SARA_REPLY>/);
  if (replyClosed) {
    reply = replyClosed[1].trim();
  } else {
    const replyOpen = fullBuffer.match(/<SARA_REPLY>([\s\S]*)$/);
    if (replyOpen) {
      reply = replyOpen[1].trim();
    }
  }

  return { meta, files, activeFilePath, completedFiles, reply };
}

export interface StreamBuildCallbacks {
  onMeta?: (meta: StreamMeta, modelUsed?: string) => void;
  onFileProgress?: (files: ProjectFiles, activeFile: string | undefined, completedFiles: string[]) => void;
  onReplyProgress?: (reply: string) => void;
}

async function postJsonWithFallback(
  urls: string[],
  payload: Record<string, unknown>,
  headers: Record<string, string>,
  defaultError: string
): Promise<any> {
  let lastError: Error | null = null;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const hasNext = i < urls.length - 1;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        lastError = new Error(`Endpoint ${url} devolveu HTML em vez de JSON.`);
        if (hasNext) continue;
        throw lastError;
      }

      if ((response.status === 404 || response.status === 405) && hasNext) {
        lastError = new Error(`Endpoint ${url} indisponível (HTTP ${response.status}).`);
        continue;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const err = new Error(data.error || `${defaultError} (HTTP ${response.status})`);
        if (hasNext && response.status >= 500) {
          lastError = err;
          continue;
        }
        throw err;
      }

      return data;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(defaultError);
      if (!hasNext) throw lastError;
    }
  }

  throw lastError || new Error(defaultError);
}

function buildResultFromJsonFallback(
  data: any,
  customKey: string,
  callbacks?: StreamBuildCallbacks
): SaraBuilderResult {
  const files: ProjectFiles | undefined =
    data?.files && typeof data.files === 'object' && Object.keys(data.files).length > 0
      ? data.files
      : undefined;
  const hasFiles = Boolean(files);
  const modelUsed = data?.modelUsed || 'gemini-4-hydrogen';

  const meta: StreamMeta = {
    mode: hasFiles ? 'builder' : data?.mode === 'conversation' ? 'conversation' : 'builder',
    projectName: data?.projectName,
    projectType: data?.projectType,
    plan: data?.planSentence || data?.plan || 'Construção concluída via API.',
    steps: Array.isArray(data?.steps) ? data.steps : undefined,
    nextStep: data?.nextStep,
    missingFeatures: Array.isArray(data?.missingFeatures) ? data.missingFeatures : undefined,
    suggestion: data?.proactiveSuggestion,
  };

  callbacks?.onMeta?.(meta, modelUsed);

  if (files) {
    callbacks?.onFileProgress?.(files, undefined, Object.keys(files));
  }

  const reply =
    data?.reply ||
    (hasFiles
      ? `Pronto, Eletro-Jr! Construí ${Object.keys(files!).length} ficheiro(s) completo(s) para o teu projeto.`
      : 'Entendido, Eletro-Jr!');
  callbacks?.onReplyProgress?.(reply);

  return {
    mode: hasFiles ? 'builder' : data?.mode === 'conversation' ? 'conversation' : 'builder',
    reply,
    updateFiles: Boolean(hasFiles || (data?.updateFiles && data?.files)),
    files,
    projectName: data?.projectName,
    projectType: data?.projectType,
    planSentence: meta.plan,
    nextStep: data?.nextStep,
    missingFeatures: meta.missingFeatures,
    proactiveSuggestion: data?.proactiveSuggestion,
    assumedNotes: Array.isArray(data?.assumedNotes) ? data.assumedNotes : [],
    engineLabel: `${modelUsed}${customKey ? ' + TXT' : ''}`,
    modelUsed,
    codeBlocks: files ? filesToCodeBlocks(files) : undefined,
    steps: (meta.steps || []).map((label, idx) => ({
      id: idx + 1,
      label,
      status: 'done',
    })),
  };
}

export async function runSaraStream(params: {
  prompt: string;
  files: ProjectFiles;
  consoleLogs: ConsoleEntry[];
  history: ChatMessage[];
  image?: ConvertedImage | null;
  attachments?: AttachedFile[];
  agentMode?: AgentMode;
  pastProjects?: string[];
  projectState?: SaraProjectState | null;
  callbacks?: StreamBuildCallbacks;
}): Promise<SaraBuilderResult> {
  const {
    prompt,
    files,
    consoleLogs,
    history,
    image,
    attachments,
    agentMode,
    pastProjects,
    projectState,
    callbacks,
  } = params;
  const customKey = getSavedGeminiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (customKey) headers['x-gemini-api-key'] = customKey;

  const textAttachments = (attachments || [])
    .filter((a) => typeof a.content === 'string')
    .map((a) => ({ name: a.name, content: a.content! }));

  const requestPayload = {
    prompt,
    files,
    consoleLogs: consoleLogs.slice(-15),
    history: history.slice(-10).map((m) => ({ sender: m.sender, text: m.text })),
    imageBase64: image?.data,
    imageMimeType: image?.mimeType,
    attachedFiles: textAttachments,
    agentMode,
    pastProjects,
    projectState,
  };

  if (isPureConversationIntent(prompt, Boolean(image), textAttachments.length > 0)) {
    const saraData = await postJsonWithFallback(
      ['/api/sara', '/api/build'],
      {
        prompt,
        files,
        consoleLogs: consoleLogs.slice(-6),
        history: history.slice(-8).map((m) => ({ sender: m.sender, text: m.text })),
        imageBase64: image?.data,
        mimeType: image?.mimeType,
        agentMode,
        pastProjects,
        forceBuilderMode: false,
      },
      headers,
      'Erro ao contactar a Sara'
    );

    return {
      mode: 'conversation',
      reply: saraData.reply || 'Estou pronta, Eletro-Jr!',
      updateFiles: false,
      engineLabel: `Builder (${saraData.modelUsed || 'gemini-4-hydrogen'})`,
      modelUsed: saraData.modelUsed,
    };
  }

  let response: Response | null = null;
  let shouldFallbackToBuild = false;

  try {
    response = await fetch('/api/build-stream', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestPayload),
    });

    const contentType = response.headers.get('content-type') || '';
    if (
      !response.ok ||
      !response.body ||
      contentType.includes('text/html')
    ) {
      shouldFallbackToBuild = true;
    }
  } catch {
    shouldFallbackToBuild = true;
  }

  if (shouldFallbackToBuild || !response || !response.body) {
    const fallbackData = await postJsonWithFallback(
      ['/api/build', '/api/builder/generate'],
      { ...requestPayload, forceBuilderMode: true },
      headers,
      'Erro ao construir projeto na API'
    );
    return buildResultFromJsonFallback(fallbackData, customKey, callbacks);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let sseBuffer = '';
  let rawModelText = '';
  let modelUsed = 'gemini-4-hydrogen';
  let metaSent = false;
  let streamErroredMessage = '';
  let lastParsed: ReturnType<typeof parseStreamBuffer> = {
    meta: null,
    files: {},
    activeFilePath: undefined,
    completedFiles: [],
    reply: '',
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    sseBuffer += decoder.decode(value, { stream: true });
    const lines = sseBuffer.split('\n');
    sseBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;

      let evt: any;
      try {
        evt = JSON.parse(jsonStr);
      } catch {
        continue;
      }

      if (evt.type === 'status' && evt.model) {
        modelUsed = evt.model;
      } else if (evt.type === 'error') {
        streamErroredMessage = evt.error || 'Erro no streaming da IA.';
      } else if (evt.type === 'chunk' && evt.text) {
        if (evt.model) modelUsed = evt.model;
        rawModelText += evt.text;
        lastParsed = parseStreamBuffer(rawModelText);

        if (lastParsed.meta && !metaSent) {
          metaSent = true;
          callbacks?.onMeta?.(lastParsed.meta, modelUsed);
        }

        if (Object.keys(lastParsed.files).length > 0) {
          callbacks?.onFileProgress?.(
            lastParsed.files,
            lastParsed.activeFilePath,
            lastParsed.completedFiles
          );
        }

        if (lastParsed.reply) {
          callbacks?.onReplyProgress?.(lastParsed.reply);
        }
      }
    }
  }

  // Se o stream terminou sem texto útil (ou falhou antes de entregar código), faz fallback automático para /api/build
  if (!rawModelText.trim()) {
    try {
      const fallbackData = await postJsonWithFallback(
        ['/api/build', '/api/builder/generate'],
        { ...requestPayload, forceBuilderMode: true },
        headers,
        streamErroredMessage || 'Erro ao construir projeto na API'
      );
      return buildResultFromJsonFallback(fallbackData, customKey, callbacks);
    } catch (fallbackErr: any) {
      throw new Error(streamErroredMessage || fallbackErr?.message || 'Erro no streaming da IA.');
    }
  }

  const hasFiles = Object.keys(lastParsed.files).length > 0;
  const finalReply =
    lastParsed.reply ||
    (!hasFiles && rawModelText.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim()) ||
    (hasFiles
      ? `Pronto, Eletro-Jr! Construí ${Object.keys(lastParsed.files).length} ficheiro(s) completo(s) para o teu projeto.`
      : 'Entendido, Eletro-Jr!');

  const stepLabels = lastParsed.meta?.steps || [];

  return {
    mode: hasFiles ? 'builder' : lastParsed.meta?.mode || 'conversation',
    reply: finalReply,
    updateFiles: hasFiles,
    files: hasFiles ? lastParsed.files : undefined,
    projectName: lastParsed.meta?.projectName,
    projectType: lastParsed.meta?.projectType,
    planSentence: lastParsed.meta?.plan,
    nextStep: lastParsed.meta?.nextStep,
    missingFeatures: lastParsed.meta?.missingFeatures,
    proactiveSuggestion: lastParsed.meta?.suggestion,
    engineLabel: `${modelUsed}${customKey ? ' + TXT' : ''}`,
    modelUsed,
    codeBlocks: hasFiles ? filesToCodeBlocks(lastParsed.files) : undefined,
    steps: stepLabels.map((label, idx) => ({
      id: idx + 1,
      label,
      status: 'done',
    })),
  };
}

export async function askSaraBuilderStep(params: {
  prompt: string;
  files: ProjectFiles;
  consoleLogs: ConsoleEntry[];
  history: ChatMessage[];
  image?: ConvertedImage | null;
  projectState?: SaraProjectState | null;
}): Promise<SaraBuilderResult> {
  const { prompt, files, consoleLogs, history, image, projectState } = params;
  const customKey = getSavedGeminiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (customKey) headers['x-gemini-api-key'] = customKey;

  const data = await postJsonWithFallback(
    ['/api/build', '/api/builder/generate'],
    {
      prompt,
      files,
      consoleLogs: consoleLogs.slice(-12),
      history: history.slice(-8).map((m) => ({ sender: m.sender, text: m.text })),
      imageBase64: image?.data,
      imageMimeType: image?.mimeType,
      forceBuilderMode: true,
      projectState,
    },
    headers,
    'Erro ao executar etapa'
  );

  return {
    mode: 'builder',
    reply: data.reply || 'Etapa concluída.',
    updateFiles: Boolean(data.updateFiles && data.files),
    files: data.files,
    projectName: data.projectName,
    projectType: data.projectType,
    assumedNotes: Array.isArray(data.assumedNotes) ? data.assumedNotes : [],
    engineLabel: data.modelUsed || 'gemini-4-hydrogen',
    modelUsed: data.modelUsed,
    codeBlocks: data.files ? filesToCodeBlocks(data.files) : undefined,
  };
}

export async function planAutonomousMission(
  goal: string,
  files: ProjectFiles,
  mode: AgentMode = 'automatic',
  pastProjects: string[] = [],
  projectState?: SaraProjectState | null
): Promise<{
  planSentence: string;
  intro: string;
  assumedNotes?: string[];
  tasks: Array<{ title: string; description: string }>;
}> {
  const customKey = getSavedGeminiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (customKey) headers['x-gemini-api-key'] = customKey;

  return postJsonWithFallback(
    ['/api/mission-plan', '/api/mission/plan'],
    { goal, files, mode, pastProjects, projectState },
    headers,
    'Erro ao planear etapas do projeto.'
  );
}

export async function runSaraFinalTest(params: {
  goal: string;
  files: ProjectFiles;
  consoleLogs: ConsoleEntry[];
}): Promise<{
  passed: boolean;
  summary: string;
  updateFiles: boolean;
  files?: ProjectFiles;
  notes?: string[];
}> {
  const customKey = getSavedGeminiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (customKey) headers['x-gemini-api-key'] = customKey;

  return postJsonWithFallback(
    ['/api/final-test', '/api/sara/final-test'],
    {
      goal: params.goal,
      files: params.files,
      consoleLogs: params.consoleLogs.slice(-15),
    },
    headers,
    'Erro no teste final.'
  );
}
