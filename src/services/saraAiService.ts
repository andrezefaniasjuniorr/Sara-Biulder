import type {
  AgentMode,
  AttachedFile,
  BuildStep,
  ChatCodeBlock,
  ChatMessage,
  ConsoleEntry,
  ProjectFiles,
  ProjectType,
  SaraPlatformAction,
  ScreenContextInfo,
} from '../types/builder';
import type { SaraProjectState } from '../utils/projectMemory';
import type { SaraUserIdentityPayload } from '../types/auth';
import { getBuildAcceptanceSpeech, getContinuationSpeech } from '../utils/voiceService';
import { sanitizeNonOwnerAiReply } from './authService';

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

export function isPlatformCommandIntent(prompt: string): boolean {
  const p = prompt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (!p) return false;

  // Pedido explícito de criar/alterar funcionalidade no app nunca é tratado como mero comando de navegação
  const appBuildOrEditCue =
    /\b(adiciona|acrescenta|implementa|corrige|conserta|estiliza|melhora|refatora|programa)\b/i.test(
      p
    ) ||
    /\b(cria|criar|crie|faz|fazer|gera|gerar|constroi|construir|monta|montar|desenvolve|desenvolver)\b.*\b(site|sistema|app|aplicativo|aplicacao|jogo|game|loja|ecommerce|e-commerce|dashboard|painel|portal|landing|portfolio|blog|pagina|formulario|grafico|tabela|chat|login|carrinho|checkout|escola|clinica|restaurante)\b/i.test(
      p
    );

  if (appBuildOrEditCue) return false;

  const platformControlCue =
    /\b(apaga|apagar|elimina|eliminar|remove|remover)\s+(o\s+|a\s+|este\s+|aquele\s+)?(projeto|ficheiro|arquivo)\b|\b(abre|abrir|fecha|fechar|maximiza|maximizar|minimiza|minimizar|mostra|mostrar|vai\s+para|vai\s+ao|entra\s+n[ao]s?|muda\s+para|passa\s+para|duplica|duplicar|renomeia|renomear|salva|salvar|guarda|guardar|sincroniza|sincronizar|baixa|baixar|descarrega|limpa|limpar)\s+(?:la\s+)?(?:o\s+|a\s+|os\s+|as\s+|no\s+|para\s+|com\s+o\s+)?(editor|codigo|ficheiro|ficheiros|arquivo|arquivos|pasta|pastas|console|consola|terminal|preview|resultado|projeto|projetos|telemovel|celular|mobile|tablet|pc|computador|desktop|configuracoes|definicoes|settings|deploy|apresentacao|firebase|zip|chat|relatorio|tela\s+cheia|ecra\s+inteiro)\b/i.test(
      p
    );

  return platformControlCue;
}

export function isPureConversationIntent(
  prompt: string,
  hasImage: boolean,
  hasAttachments: boolean,
  hasExistingCode = false
): boolean {
  if (hasImage || hasAttachments) return false;
  const p = prompt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  // Comandos puros de controlo da plataforma NUNCA devem disparar geração/edição de código!
  if (isPlatformCommandIntent(p)) {
    return true;
  }

  // Qualquer verbo/substantivo de construção, edição, UI, estilo ou funcionalidade vai para o Builder
  const buildOrEditPattern =
    /\b(cria|criar|crie|gera|gerar|gere|faz|fazer|faze|fazem|constroi|construir|construa|monta|montar|desenvolve|desenvolver|desenvolva|programa|programar|implementa|implementar|adiciona|adicionar|acrescenta|acrescentar|altera|alterar|troca|trocar|corrige|corrigir|conserta|consertar|fix|atualiza|atualizar|melhora|melhorar|edita|editar|refatora|refatorar|coloca|colocar|mete|meter|inclui|incluir|transforma|sistema|site|web|website|app|aplicativo|aplicacao|jogo|game|loja|ecommerce|e-commerce|dashboard|painel|portal|landing|portfolio|blog|pagina|ecra|tela|botao|menu|navbar|header|footer|rodape|formulario|cadastro|login|autenticacao|tabela|grafico|chart|card|modal|pesquisa|busca|filtro|carrinho|checkout|pagamento|escola|clinica|restaurante|hotel|banco|agenda|calendario|calculadora|delivery|entregas|cor|cores|tema|dark|light|fonte|layout|design|responsivo|animacao|imagem|css|html|js|javascript|typescript|python|sql|3d|threejs|echarts|apexcharts|funcionalidade|funcao|api|crud|perfil|admin|stock|estoque|fatura|recibo)\b/i;

  if (buildOrEditPattern.test(p)) {
    return false;
  }

  // Saudações e conversa espontânea pura (apenas quando NÃO há intenção de construir/editar)
  const pureChatCue =
    /^(sara[,\s]+)?(ola|oi|hey|ei|bom dia|boa tarde|boa noite|tudo bem|como estas|como vai|obrigado|obrigada|valeu|tchau|ate logo|ate ja|ate amanha|adeus|quem es|estas ai|tas ai|ouves me)([!?,.\s]+(sara|tudo bem|como estas|como vai))*[!?,.\s]*$/i.test(
      p
    ) ||
    /\b(ideia|ideias|sugere|sugest|como ganhar dinheiro|o que achas|pensar|conversa|explica|por que|porque|qual melhor|quem es)\b/i.test(
      p
    );

  if (pureChatCue) return true;

  // Se já existe projeto com código, instruções curtas de ajuste (ex: "azul escuro", "com 3 colunas") vão para o Builder
  if (hasExistingCode && p.length >= 4) {
    return false;
  }

  return p.split(/\s+/).length <= 2;
}

export interface StreamMeta {
  mode: 'builder' | 'conversation';
  projectName?: string;
  projectType?: ProjectType;
  plan?: string;
  architecture?: string;
  voiceSummary?: string;
  steps?: string[];
  nextStep?: string;
  missingFeatures?: string[];
  strategicImprovements?: string[];
  suggestion?: string;
}

export interface SaraBuilderResult {
  mode: 'conversation' | 'builder';
  reply: string;
  updateFiles: boolean;
  files?: ProjectFiles;
  actions?: SaraPlatformAction[];
  projectName?: string;
  projectType?: ProjectType;
  planSentence?: string;
  architectureSummary?: string;
  voiceSummary?: string;
  nextStep?: string;
  missingFeatures?: string[];
  strategicImprovements?: string[];
  proactiveSuggestion?: string;
  assumedNotes?: string[];
  engineLabel: string;
  steps?: BuildStep[];
  codeBlocks?: ChatCodeBlock[];
  modelUsed?: string;
  apiDegraded?: boolean;
  needsApiKey?: boolean;
}

export function extractSaraActionsFromText(rawText: string): {
  actions: SaraPlatformAction[];
  cleanedText: string;
} {
  const actions: SaraPlatformAction[] = [];
  if (!rawText) return { actions, cleanedText: '' };

  const cleanedText = rawText
    .replace(/<SARA_ACTIONS>([\s\S]*?)<\/SARA_ACTIONS>/gi, (_, inner) => {
      try {
        const stripped = String(inner || '')
          .trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        const parsed = JSON.parse(stripped);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of list) {
          if (item && typeof item.type === 'string' && item.type.trim()) {
            actions.push({
              type: item.type.trim(),
              name: typeof item.name === 'string' ? item.name.trim() : undefined,
              path: typeof item.path === 'string' ? item.path.trim() : undefined,
              projectType: item.projectType,
            });
          }
        }
      } catch {
        // ignore partial/malformed action tag
      }
      return '';
    })
    .replace(/<SARA_ACTIONS>[\s\S]*$/gi, '')
    .trim();

  return { actions, cleanedText };
}

function stripCodeFence(content: string): string {
  return content
    .replace(/^\s*```[a-zA-Z0-9_-]*\n?/, '')
    .replace(/\n?```\s*$/, '');
}

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (ext === 'html' || ext === 'htm' || ext === 'svg') return 'html';
  if (ext === 'css' || ext === 'scss') return 'css';
  if (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx' || ext === 'mjs') return 'javascript';
  if (ext === 'py') return 'python';
  if (ext === 'sql') return 'sql';
  if (ext === 'json') return 'json';
  if (ext === 'md') return 'markdown';
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

function extractMarkdownFilesFallback(rawText: string): ProjectFiles {
  const fallbackFiles: ProjectFiles = {};
  if (!rawText) return fallbackFiles;

  // Procura blocos ```lang ... ``` precedidos por título/caminho de ficheiro
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let blockMatch: RegExpExecArray | null;
  let unlabeledJsIndex = 0;

  while ((blockMatch = codeBlockRegex.exec(rawText)) !== null) {
    const lang = (blockMatch[1] || '').toLowerCase();
    const code = (blockMatch[2] || '').trim();
    if (!code || lang === 'json') continue;

    const preceding = rawText.slice(Math.max(0, blockMatch.index - 220), blockMatch.index).trimEnd();
    const lastLine = (preceding.split('\n').pop() || '').trim();
    const pathMatch = lastLine.match(
      /^(?:[-*•]\s*)?(?:#{1,6}\s*|\*\*|`|\/\/\s*|<!--\s*|\/\*\s*|ficheiro:\s*|arquivo:\s*|file:\s*)*([a-zA-Z0-9_.\-/]+\.(?:html|htm|css|js|jsx|ts|tsx|json|svg|py|sql|md))(?:\*\*|`|-->|\*\/|:|\s)*$/i
    );

    let targetPath = pathMatch?.[1]?.trim().replace(/^\/+/, '');
    if (!targetPath) {
      if (lang === 'html' || lang === 'htm' || /<!doctype html/i.test(code)) {
        targetPath = 'index.html';
      } else if (lang === 'css') {
        targetPath = 'styles/style.css';
      } else if (lang === 'py' || lang === 'python') {
        targetPath = 'src/main.py';
      } else if (lang === 'sql') {
        targetPath = 'data/schema.sql';
      } else if (lang === 'js' || lang === 'javascript' || lang === 'ts' || lang === 'tsx' || lang === 'jsx') {
        const ext = lang === 'tsx' ? 'tsx' : lang === 'jsx' ? 'jsx' : lang === 'ts' ? 'ts' : 'js';
        targetPath = unlabeledJsIndex === 0 ? `src/app.${ext}` : `src/module_${unlabeledJsIndex}.${ext}`;
        unlabeledJsIndex += 1;
      }
    }

    if (targetPath && !fallbackFiles[targetPath]) {
      fallbackFiles[targetPath] = code;
    }
  }

  return fallbackFiles;
}

export function parseStreamBuffer(fullBuffer: string): {
  meta: StreamMeta | null;
  files: ProjectFiles;
  activeFilePath: string | undefined;
  completedFiles: string[];
  actions: SaraPlatformAction[];
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

  const { actions } = extractSaraActionsFromText(fullBuffer);

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

  // Fallback se a IA respondeu com blocos markdown ```html/css/js em vez de <SARA_FILE>
  if (Object.keys(files).length === 0 && /```[a-zA-Z0-9_-]*\n[\s\S]*?```/.test(fullBuffer)) {
    const mdFiles = extractMarkdownFilesFallback(fullBuffer);
    for (const [k, v] of Object.entries(mdFiles)) {
      files[k] = v;
      completedFiles.push(k);
    }
  }

  let reply = '';
  const replyClosed = fullBuffer.match(/<SARA_REPLY>([\s\S]*?)<\/SARA_REPLY>/);
  if (replyClosed) {
    reply = extractSaraActionsFromText(replyClosed[1]).cleanedText;
  } else {
    const replyOpen = fullBuffer.match(/<SARA_REPLY>([\s\S]*)$/);
    if (replyOpen) {
      reply = extractSaraActionsFromText(replyOpen[1]).cleanedText;
    }
  }

  return { meta, files, activeFilePath, completedFiles, actions, reply };
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
  callbacks?: StreamBuildCallbacks,
  userIdentity?: SaraUserIdentityPayload
): SaraBuilderResult {
  const isOwner = Boolean(userIdentity?.isOwner);
  const voc = isOwner ? ', Eletro-Jr' : userIdentity?.callName ? `, ${userIdentity.callName}` : '';
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
    plan: data?.planSentence || data?.plan || 'Construção concluída.',
    architecture: data?.architecture,
    voiceSummary: data?.voiceSummary
      ? sanitizeNonOwnerAiReply(data.voiceSummary, isOwner)
      : undefined,
    steps: Array.isArray(data?.steps) ? data.steps : undefined,
    nextStep: data?.nextStep,
    missingFeatures: Array.isArray(data?.missingFeatures) ? data.missingFeatures : undefined,
    strategicImprovements: Array.isArray(data?.strategicImprovements) ? data.strategicImprovements : undefined,
    suggestion: data?.proactiveSuggestion,
  };

  callbacks?.onMeta?.(meta, modelUsed);

  if (files) {
    callbacks?.onFileProgress?.(files, undefined, Object.keys(files));
  }

  const rawReply =
    data?.reply ||
    (hasFiles
      ? `Pronto${voc}! Construí ${Object.keys(files!).length} ficheiro(s) completo(s) para o teu projeto.`
      : `Aqui estou${voc} — diz-me o que queres ajustar!`);
  const extractedFromReply = extractSaraActionsFromText(rawReply);
  const structuredActions: SaraPlatformAction[] = Array.isArray(data?.actions)
    ? data.actions.filter((a: any) => a && typeof a.type === 'string')
    : [];
  const combinedActions = [...structuredActions, ...extractedFromReply.actions];
  const reply = sanitizeNonOwnerAiReply(extractedFromReply.cleanedText || rawReply, isOwner);
  callbacks?.onReplyProgress?.(reply);

  return {
    mode: hasFiles ? 'builder' : data?.mode === 'conversation' ? 'conversation' : 'builder',
    reply,
    updateFiles: Boolean(hasFiles || (data?.updateFiles && data?.files)),
    files,
    actions: combinedActions.length > 0 ? combinedActions : undefined,
    projectName: data?.projectName,
    projectType: data?.projectType,
    planSentence: meta.plan,
    architectureSummary: data?.architecture,
    voiceSummary: meta.voiceSummary,
    nextStep: data?.nextStep,
    missingFeatures: meta.missingFeatures,
    strategicImprovements: meta.strategicImprovements,
    proactiveSuggestion: data?.proactiveSuggestion,
    assumedNotes: Array.isArray(data?.assumedNotes) ? data.assumedNotes : [],
    engineLabel: isOwner ? `${modelUsed}${customKey ? ' + TXT' : ''}` : 'SARA OS',
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
  screenContext?: ScreenContextInfo;
  userIdentity?: SaraUserIdentityPayload;
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
    screenContext,
    userIdentity,
    callbacks,
  } = params;
  const isOwner = Boolean(userIdentity?.isOwner);
  const voc = isOwner ? ', Eletro-Jr' : userIdentity?.callName ? `, ${userIdentity.callName}` : '';
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
    screenContext,
    userIdentity,
  };

  const hasExistingCode = Object.entries(files || {}).some(
    ([k, v]) => k.toLowerCase() !== 'readme.md' && Boolean(v && String(v).trim())
  );
  const pureChat = isPureConversationIntent(
    prompt,
    Boolean(image),
    textAttachments.length > 0,
    hasExistingCode
  );

  const isKeyAuthErrorMsg = (msg: string) =>
    /gemini_api_key|inv[aá]lida|desativada|unauthenticated|api_key_invalid|401|403/i.test(msg);

  if (pureChat) {
    try {
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
          screenContext,
          userIdentity,
          forceBuilderMode: false,
        },
        headers,
        'Falha silenciosa no canal de conversa'
      );

      const { actions: parsedActions, cleanedText } = extractSaraActionsFromText(
        saraData?.reply || ''
      );
      const structuredActions: SaraPlatformAction[] = Array.isArray(saraData?.actions)
        ? saraData.actions.filter((a: any) => a && typeof a.type === 'string')
        : [];
      const mergedActions = [...structuredActions, ...parsedActions];
      const finalReply = sanitizeNonOwnerAiReply(
        cleanedText || `Estou aqui contigo${voc} — o que queres explorar agora?`,
        isOwner
      );

      return {
        mode: 'conversation',
        reply: finalReply,
        updateFiles: false,
        actions: mergedActions.length > 0 ? mergedActions : undefined,
        engineLabel: isOwner ? `Builder (${saraData.modelUsed || 'gemini-4-hydrogen'})` : 'SARA OS',
        modelUsed: saraData.modelUsed,
      };
    } catch (bgErr: any) {
      const errText = String(bgErr?.message || '');
      const needsKey = isKeyAuthErrorMsg(errText);
      console.warn('[Sara Failover Silencioso - Conversa]:', bgErr);
      const activeProj = screenContext?.projectName || 'este projeto';
      return {
        mode: 'conversation',
        reply:
          needsKey && isOwner
            ? `Falta configurar uma chave Gemini válida nas Configurações para conversar e gerar em **${activeProj}**, Eletro-Jr.`
            : `Estou ligada em ${activeProj}${voc}! Diz-me exatamente o que queres testar, mudar no código ou controlar aqui na plataforma.`,
        updateFiles: false,
        apiDegraded: true,
        needsApiKey: isOwner ? needsKey : false,
        engineLabel: 'Sara Continuity Engine',
      };
    }
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
    try {
      const fallbackData = await postJsonWithFallback(
        ['/api/build', '/api/builder/generate'],
        { ...requestPayload, forceBuilderMode: true },
        headers,
        'Falha silenciosa de failover'
      );
      return buildResultFromJsonFallback(fallbackData, customKey, callbacks, userIdentity);
    } catch (bgErr: any) {
      const errText = String(bgErr?.message || '');
      const needsKey = isKeyAuthErrorMsg(errText);
      console.warn('[Sara Failover Silencioso - Fallback direto]:', bgErr);
      return {
        mode: 'conversation',
        reply:
          needsKey && isOwner
            ? 'Para a Sara criar e editar ficheiros neste servidor, cola a tua chave Gemini (AIza...) nas Configurações.'
            : `Estou a reorganizar os motores de geração para continuar ${screenContext?.projectName || 'o teu projeto'}${voc} — envia novamente o detalhe ou testa um comando rápido enquanto estabiliza em segundo plano.`,
        updateFiles: false,
        apiDegraded: true,
        needsApiKey: isOwner ? needsKey : false,
        engineLabel: 'Sara Continuity Engine',
      };
    }
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
    actions: [],
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

  const streamHadFiles = Object.keys(lastParsed.files).length > 0;
  const streamOnlyHasActions = !streamHadFiles && lastParsed.actions.length > 0;

  // Se o stream terminou vazio OU era um pedido de construção/edição e a IA só respondeu texto sem criar ficheiros nem ações, força /api/build com JSON Schema estrito!
  if ((!rawModelText.trim() || (!streamHadFiles && !streamOnlyHasActions)) && !isKeyAuthErrorMsg(streamErroredMessage)) {
    try {
      const fallbackData = await postJsonWithFallback(
        ['/api/build', '/api/builder/generate'],
        { ...requestPayload, forceBuilderMode: true },
        headers,
        streamErroredMessage || 'Failover silencioso na construção'
      );
      const jsonResult = buildResultFromJsonFallback(fallbackData, customKey, callbacks, userIdentity);
      if (jsonResult.updateFiles && jsonResult.files) {
        return jsonResult;
      }
      if (!rawModelText.trim()) {
        return jsonResult;
      }
    } catch (fallbackErr: any) {
      const errText = `${streamErroredMessage} ${String(fallbackErr?.message || '')}`;
      const needsKey = isKeyAuthErrorMsg(errText);
      if (!rawModelText.trim()) {
        console.warn('[Sara Failover Silencioso - Stream vazio]:', streamErroredMessage, fallbackErr);
        return {
          mode: 'conversation',
          reply:
            needsKey && isOwner
              ? 'Para a Sara criar e editar os ficheiros do projeto aqui, carrega ou cola uma chave Gemini válida nas Configurações.'
              : `Estou a reajustar a rota dos motores para executar "${prompt.slice(0, 60)}" em ${screenContext?.projectName || 'teu projeto'}${voc}. Podes tentar novamente já a seguir que eu assumo daqui!`,
          updateFiles: false,
          apiDegraded: true,
          needsApiKey: isOwner ? needsKey : false,
          engineLabel: 'Sara Continuity Engine',
        };
      }
    }
  }

  if (!rawModelText.trim() && isKeyAuthErrorMsg(streamErroredMessage)) {
    return {
      mode: 'conversation',
      reply: isOwner
        ? 'Para a Sara construir e editar os ficheiros, verifica ou carrega uma chave Gemini válida nas Configurações.'
        : 'Sistema temporariamente ocupado. Tenta novamente em instantes.',
      updateFiles: false,
      apiDegraded: true,
      needsApiKey: isOwner,
      engineLabel: 'Sara Continuity Engine',
    };
  }

  const hasFiles = Object.keys(lastParsed.files).length > 0;
  const fallbackRawClean = extractSaraActionsFromText(
    rawModelText.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim()
  ).cleanedText;
  const finalReply = sanitizeNonOwnerAiReply(
    lastParsed.reply ||
      (!hasFiles && fallbackRawClean) ||
      (hasFiles
        ? `Pronto${voc}! Construí ${Object.keys(lastParsed.files).length} ficheiro(s) completo(s) para o teu projeto.`
        : `Tudo tratado por aqui${voc}!`),
    isOwner
  );

  const stepLabels = lastParsed.meta?.steps || [];

  return {
    mode: hasFiles ? 'builder' : lastParsed.meta?.mode || 'conversation',
    reply: finalReply,
    updateFiles: hasFiles,
    files: hasFiles ? lastParsed.files : undefined,
    actions: lastParsed.actions.length > 0 ? lastParsed.actions : undefined,
    projectName: lastParsed.meta?.projectName,
    projectType: lastParsed.meta?.projectType,
    planSentence: lastParsed.meta?.plan,
    architectureSummary: lastParsed.meta?.architecture,
    voiceSummary: lastParsed.meta?.voiceSummary
      ? sanitizeNonOwnerAiReply(lastParsed.meta.voiceSummary, isOwner)
      : undefined,
    nextStep: lastParsed.meta?.nextStep,
    missingFeatures: lastParsed.meta?.missingFeatures,
    strategicImprovements: lastParsed.meta?.strategicImprovements,
    proactiveSuggestion: lastParsed.meta?.suggestion,
    engineLabel: isOwner ? `${modelUsed}${customKey ? ' + TXT' : ''}` : 'SARA OS',
    modelUsed,
    codeBlocks: hasFiles ? filesToCodeBlocks(lastParsed.files) : undefined,
    steps: stepLabels.map((label, idx) => ({
      id: idx + 1,
      label,
      status: 'done',
    })),
  };
}

export async function fetchSaraFastKickoff(params: {
  prompt: string;
  files: ProjectFiles;
  agentMode: AgentMode;
  hasExistingCode: boolean;
  projectName?: string;
  contextCue?: 'sleep' | 'leave';
  screenContext?: ScreenContextInfo;
  userIdentity?: SaraUserIdentityPayload;
}): Promise<{ reply: string; fromApi: boolean }> {
  const {
    prompt,
    files,
    agentMode,
    hasExistingCode,
    projectName,
    contextCue,
    screenContext,
    userIdentity,
  } = params;
  const isOwner = Boolean(userIdentity?.isOwner);
  const fallback = hasExistingCode
    ? getContinuationSpeech(projectName || 'este projeto', agentMode, isOwner)
    : getBuildAcceptanceSpeech(prompt, agentMode, isOwner);

  const customKey = getSavedGeminiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (customKey) headers['x-gemini-api-key'] = customKey;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2200);

  try {
    const response = await fetch('/api/sara', {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        kickoff: true,
        prompt,
        files: Object.fromEntries(Object.keys(files || {}).slice(0, 15).map((k) => [k, ''])),
        agentMode,
        hasExistingCode,
        projectName,
        contextCue,
        screenContext,
        userIdentity,
      }),
    });

    if (!response.ok) {
      return { reply: fallback, fromApi: false };
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      return { reply: fallback, fromApi: false };
    }

    const data = await response.json().catch(() => ({}));
    const raw = sanitizeNonOwnerAiReply(
      String(data?.reply || '')
        .replace(/<SARA_ACTIONS>[\s\S]*?<\/SARA_ACTIONS>/gi, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/[*_#`]/g, '')
        .trim(),
      isOwner
    );

    if (raw.length >= 12) {
      return { reply: raw, fromApi: true };
    }
    return { reply: fallback, fromApi: false };
  } catch {
    return { reply: fallback, fromApi: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function askSaraBuilderStep(params: {
  prompt: string;
  files: ProjectFiles;
  consoleLogs: ConsoleEntry[];
  history: ChatMessage[];
  image?: ConvertedImage | null;
  agentMode?: AgentMode;
  projectState?: SaraProjectState | null;
  screenContext?: ScreenContextInfo;
  userIdentity?: SaraUserIdentityPayload;
}): Promise<SaraBuilderResult> {
  const {
    prompt,
    files,
    consoleLogs,
    history,
    image,
    agentMode,
    projectState,
    screenContext,
    userIdentity,
  } = params;
  const isOwner = Boolean(userIdentity?.isOwner);
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
      agentMode,
      forceBuilderMode: true,
      projectState,
      screenContext,
      userIdentity,
    },
    headers,
    'Erro ao executar etapa'
  );

  return {
    mode: 'builder',
    reply: sanitizeNonOwnerAiReply(data.reply || 'Etapa concluída.', isOwner),
    updateFiles: Boolean(data.updateFiles && data.files),
    files: data.files,
    projectName: data.projectName,
    projectType: data.projectType,
    architectureSummary: data.architecture,
    voiceSummary: data.voiceSummary
      ? sanitizeNonOwnerAiReply(data.voiceSummary, isOwner)
      : undefined,
    strategicImprovements: Array.isArray(data.strategicImprovements) ? data.strategicImprovements : undefined,
    assumedNotes: Array.isArray(data.assumedNotes) ? data.assumedNotes : [],
    engineLabel: isOwner ? data.modelUsed || 'gemini-4-hydrogen' : 'SARA OS',
    modelUsed: data.modelUsed,
    codeBlocks: data.files ? filesToCodeBlocks(data.files) : undefined,
  };
}

export async function planAutonomousMission(
  goal: string,
  files: ProjectFiles,
  mode: AgentMode = 'automatic',
  pastProjects: string[] = [],
  projectState?: SaraProjectState | null,
  userIdentity?: SaraUserIdentityPayload
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
    { goal, files, mode, pastProjects, projectState, userIdentity },
    headers,
    'Erro ao planear etapas do projeto.'
  );
}

export async function runSaraFinalTest(params: {
  goal: string;
  files: ProjectFiles;
  consoleLogs: ConsoleEntry[];
  userIdentity?: SaraUserIdentityPayload;
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
      userIdentity: params.userIdentity,
    },
    headers,
    'Erro no teste final.'
  );
}
