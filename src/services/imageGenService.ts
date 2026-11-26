import { getInMemoryAdminVaultToken, setInMemoryAdminVaultToken } from './authService';
import { getCurrentFirebaseIdToken } from './firebaseService';

export const IMAGE_GENERIC_ERROR_MESSAGE =
  'Não consegui gerar agora, tenta de novo em alguns segundos.';
export const IMAGE_CREATING_MESSAGE = 'A criar a tua imagem...';
export const IMAGE_CREATING_TOP_MESSAGE =
  'A criar em Qualidade Top... pode demorar 20 segundos';
export const IMAGE_ASK_STYLE_MESSAGE = 'Escolhe o estilo da tua imagem:';
export const PROFILE_PHOTO_EVENT = 'sara-profile-photo-updated';
export const IMAGE_QUALITY_SUFFIX =
  'ultra detailed, sharp focus, high quality, 8k, professional lighting, no blur, no distortion';

export type SaraImageStyle = 'realistic' | 'drawing' | 'pixar3d';

export const IMAGE_STYLE_OPTIONS: Array<{
  id: SaraImageStyle;
  label: string;
  promptSuffix: string;
}> = [
  {
    id: 'realistic',
    label: 'Realista',
    promptSuffix:
      'ultra realistic, professional photography, detailed skin, cinematic lighting, 4k',
  },
  {
    id: 'drawing',
    label: 'Desenho',
    promptSuffix:
      'beautiful digital illustration, vibrant colors, detailed art, clean lines',
  },
  {
    id: 'pixar3d',
    label: '3D Pixar',
    promptSuffix:
      '3D pixar style, cute character, big expressive eyes, soft lighting, high quality 3D render',
  },
];

const LEGACY_IMAGE_KEY_STORAGE = 'sara_image_core_key_v1';
const PROFILE_PHOTO_PREFIX = 'sara_profile_photo_v1_';

// Limpa imediatamente qualquer chave antiga guardada localmente no navegador
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LEGACY_IMAGE_KEY_STORAGE);
  }
} catch {
  // ignore
}

export function maskImageKeyPreview(rawKey: string): string {
  const clean = String(rawKey || '').trim();
  if (!clean) return '';
  const suffix = clean.length >= 4 ? clean.slice(-4) : '••••';
  return `hf_****${suffix}`;
}

export function generateNewImageSeed(previousSeed?: number): number {
  let candidate = Math.floor(Math.random() * 2000000000) + 1;
  if (previousSeed && candidate === previousSeed) {
    candidate = (candidate % 1999999999) + 1;
  }
  return candidate;
}

export function parseImageStyleReply(rawText: string): {
  matched: boolean;
  style: SaraImageStyle;
} {
  const norm = String(rawText || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[!?.]+$/g, '')
    .trim();

  if (!norm) return { matched: false, style: 'realistic' };
  if (/^(?:1|realista|estilo realista|real|foto|fotografia|realismo)$/i.test(norm)) {
    return { matched: true, style: 'realistic' };
  }
  if (/^(?:2|desenho|estilo desenho|ilustracao|arte|desenha|cartoon)$/i.test(norm)) {
    return { matched: true, style: 'drawing' };
  }
  if (/^(?:3|3d pixar|pixar 3d|pixar|3d|estilo 3d|estilo pixar)$/i.test(norm)) {
    return { matched: true, style: 'pixar3d' };
  }
  if (
    /^(?:ok|sim|gera|gerar|pode ser|avanca|continua|tanto faz|qualquer um|qualquer|padrao|normal)$/i.test(
      norm
    )
  ) {
    return { matched: true, style: 'realistic' };
  }
  return { matched: false, style: 'realistic' };
}

export interface ExtractedImageGenRequest {
  prompt: string;
  qualityTop: boolean;
  style?: SaraImageStyle;
}

export type ImageVoiceAction =
  | { type: 'regenerate' }
  | { type: 'ask_style' }
  | { type: 'set_style'; style: SaraImageStyle }
  | { type: 'top_quality' }
  | { type: 'download' }
  | { type: 'use_profile_photo' }
  | { type: 'show_last_image' };

/**
 * Deteta pedidos espontâneos para gerar imagem no chat ou por voz.
 * Exemplo: "SARA, gera / cria / faz / mostra uma imagem de..."
 */
export function extractImageGenRequest(rawText: string): ExtractedImageGenRequest | null {
  const clean = String(rawText || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;

  const normalized = clean
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Nunca rouba comandos de galeria local do dispositivo nem edição de ficheiros de código
  if (
    /\b(?:minhas?\s+(?:fotos|imagens)|do\s+meu\s+pc|no\s+meu\s+pc|do\s+telemovel|do\s+celular|da\s+pasta)\b/i.test(
      normalized
    ) ||
    /^(?:sara[,\s]+)?(?:edita|apaga|apagar|elimina|remove)\b/i.test(normalized)
  ) {
    return null;
  }

  // Comandos sobre a última imagem ("mostra/mostre a imagem", "outra imagem", "baixa a imagem") não criam assunto novo
  if (
    /^(?:(?:ei|ol[aá]|oi|hey)\s+)?(?:sara[,\s.:;-]+)?(?:por\s+favor[,\s]+)?(?:mostra|mostre|mostrar|abre|abra|ver|baixa|baixe|baixar|guarda|guarde|guardar|descarrega|descarregue|usa|use|usar|define|defina|mete|meta|coloca|coloque|gera|gere|cria|crie|faz|faca)?(?:-me|\s+me)?\s*(?:a\s+|essa\s+|esta\s+|uma\s+)?(?:ultima\s+|outra\s+)?(?:imagem|foto)(?:\s+como\s+foto\s+de\s+perfil)?[.!?]*$/i.test(
      normalized
    )
  ) {
    return null;
  }

  const patterns: RegExp[] = [
    /^(?:(?:ei|ol[aá]|oi|hey)\s+)?(?:sara[,\s.:;-]+)?(?:por\s+favor[,\s]+)?(?:podes\s+|pode\s+|quero\s+que\s+)?(?:gerar|gera|cria|criar|faz|fazer|mostra|mostrar|desenha|desenhar|produz|produzir|inventa|imagina)(?:-me|\s+me|\s+para\s+mim)?\s+(?:uma?\s+)?(?:nova\s+)?(?:imagem|foto|ilustra[cç][aã]o|figura|arte|desenho|retrato)(?:\s+(?:em|com)\s+qualidade\s+top)?(?:\s+(?:estilo|no\s+estilo)\s+(?:realista|desenho|3d\s*pixar|pixar))?(?:\s+(?:de|da|do|das|dos|com|sobre|em))?\s+(.+)$/i,
    /^(?:(?:ei|ol[aá]|oi|hey)\s+)?(?:sara[,\s.:;-]+)?(?:quero|preciso\s+de|manda(?:-me|\s+me)?)\s+(?:uma?\s+)?(?:nova\s+)?(?:imagem|foto|ilustra[cç][aã]o|arte|desenho|retrato)(?:\s+(?:em|com)\s+qualidade\s+top)?(?:\s+(?:de|da|do|das|dos|com|sobre|em))?\s+(.+)$/i,
    /^(?:(?:ei|ol[aá]|oi|hey)\s+)?(?:sara[,\s.:;-]+)?(?:por\s+favor[,\s]+)?(?:podes\s+|pode\s+)?(?:desenha|desenhar)(?:-me|\s+me|\s+para\s+mim)?\s+(.+)$/i,
  ];

  for (let idx = 0; idx < patterns.length; idx += 1) {
    const rx = patterns[idx];
    const m = clean.match(rx);
    if (m && m[1]) {
      let subject = m[1].replace(/[.!?]+$/g, '').trim();
      // Para "desenha ...", ignora se estiver a pedir desenho de app/site/sistema
      if (
        idx === 2 &&
        /\b(?:site|sistema|app|aplicativo|aplicacao|jogo|interface|layout|pagina|formulario|painel)\b/i.test(
          subject
        )
      ) {
        return null;
      }

      const fullNorm = normalized;
      let qualityTop = /\b(?:em|com)?\s*qualidade\s+top\b/i.test(fullNorm);
      let style: SaraImageStyle | undefined;

      if (/\b(?:no\s+)?estilo\s+(?:3d\s*pixar|pixar)\b/i.test(fullNorm)) {
        style = 'pixar3d';
      } else if (/\b(?:no\s+)?estilo\s+desenho\b/i.test(fullNorm)) {
        style = 'drawing';
      } else if (/\b(?:no\s+)?estilo\s+realista\b/i.test(fullNorm)) {
        style = 'realistic';
      }

      if (/\b(?:em|com)?\s*qualidade\s+top\b/i.test(subject)) {
        qualityTop = true;
        subject = subject.replace(/\b(?:em|com)?\s*qualidade\s+top\b/gi, '').trim();
      }
      subject = subject
        .replace(/\b(?:no\s+)?estilo\s+(?:3d\s*pixar|pixar|desenho|realista)\b/gi, '')
        .replace(/^(?:de|da|do|das|dos)\s+/i, '')
        .replace(/[,;:\s]+$/g, '')
        .trim();

      if (subject.length >= 2) {
        return { prompt: subject, qualityTop, style };
      }
    }
  }

  return null;
}

export function extractImageGenPrompt(rawText: string): string | null {
  return extractImageGenRequest(rawText)?.prompt || null;
}

export function parseImageVoiceCommand(rawText: string): ImageVoiceAction | null {
  const norm = String(rawText || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[!?.]+$/g, '')
    .trim();

  if (!norm) return null;

  // Remove prefixo conversacional opcional "sara, ..."
  const body = norm
    .replace(/^(?:(?:ei|oi|ola|hey)\s+)?sara[,\s.:;-]+/i, '')
    .replace(/^por\s+favor[,\s]+/i, '')
    .trim();
  if (!body) return null;

  if (
    /^(?:(?:gera|gere|gerar|cria|crie|criar|faz|faca|fazer|manda|mande|tenta|tente)(?:-me|\s+me)?\s+)?(?:uma?\s+)?outra(?:\s+(?:imagem|foto))?$|^gera\s+mais\s+uma(?:\s+(?:imagem|foto))?$/i.test(
      body
    )
  ) {
    return { type: 'regenerate' };
  }

  if (
    /^(?:muda|mude|mudar|altera|altere|alterar|troca|troque|trocar)\s+(?:o\s+|de\s+)?estilo(?:\s+(?:da\s+)?imagem)?$/i.test(
      body
    )
  ) {
    return { type: 'ask_style' };
  }

  const styleCmd = body.match(
    /^(?:(?:muda|mude|mudar|altera|altere|alterar|troca|troque|trocar|faz|faca|gera|gere)\s+(?:o\s+estilo\s+)?(?:para\s+|em\s+)?)?(?:o\s+)?(?:estilo\s+)?(realista|desenho|3d\s*pixar|pixar\s*3d|pixar)$/i
  );
  if (styleCmd && styleCmd[1]) {
    const val = styleCmd[1].toLowerCase();
    // Só dispara comando explícito de mudança de estilo se contiver "estilo" ou verbo de troca
    if (/\b(?:estilo|muda|mude|mudar|altera|altere|alterar|troca|troque|trocar)\b/i.test(body)) {
      if (val.includes('desenho')) return { type: 'set_style', style: 'drawing' };
      if (val.includes('pixar') || val.includes('3d')) return { type: 'set_style', style: 'pixar3d' };
      return { type: 'set_style', style: 'realistic' };
    }
  }

  if (
    /^(?:(?:gera|gere|gerar|cria|crie|criar|faz|faca|fazer|usa|use|usar|ativa|ative|ativar)\s+(?:em\s+|com\s+)?)?qualidade\s+top(?:\s+(?:na\s+|nessa\s+|nesta\s+)?imagem)?$/i.test(
      body
    )
  ) {
    return { type: 'top_quality' };
  }

  if (
    /^(?:baixa|baixe|baixar|guarda|guarde|guardar|descarrega|descarregue|descarregar|salva|salve|salvar|faz\s+download\s+d[ao])\s+(?:a\s+|essa\s+|esta\s+|ultima\s+)?(?:imagem|foto)$/i.test(
      body
    ) ||
    /^baixar\s+imagem$|^guardar\s+imagem$/i.test(body)
  ) {
    return { type: 'download' };
  }

  if (
    /^(?:usa|use|usar|define|defina|definir|mete|meta|meter|coloca|coloque|colocar|poe|por|aplica|aplique|aplicar)\s+(?:esta\s+|essa\s+|a\s+)?(?:imagem\s+)?como\s+(?:a\s+|minha\s+)?foto\s+de\s+perfil$/i.test(
      body
    )
  ) {
    return { type: 'use_profile_photo' };
  }

  if (
    /^(?:mostra|mostre|mostrar|abre|abra|abrir|ver|exibe|exiba|exibir)(?:-me|\s+me)?\s+(?:a\s+|essa\s+|esta\s+)?(?:ultima\s+)?(?:imagem|foto)$/i.test(
      body
    )
  ) {
    return { type: 'show_last_image' };
  }

  return null;
}

export type GenerateSaraImageResult =
  | { ok: true; dataUrl: string; seed: number; style: SaraImageStyle; isTopQuality: boolean }
  | { ok: false; error: string };

async function translatePromptToEnglishClient(rawPrompt: string): Promise<string> {
  const clean = String(rawPrompt || '').trim();
  if (!clean) return '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(clean)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.ok) {
      const text = await res.text();
      const data = JSON.parse(text) as unknown;
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = (data[0] as unknown[])
          .map((part) => (Array.isArray(part) && typeof part[0] === 'string' ? part[0] : ''))
          .join('')
          .trim();
        if (translated) return translated;
      }
    }
  } catch {
    // fallback para o prompt original
  } finally {
    clearTimeout(timer);
  }

  return clean;
}

async function detectImageMimeFromBlob(
  blob: Blob,
  headerContentType?: string | null
): Promise<string | null> {
  if (!blob || blob.size === 0) return null;

  try {
    const headBuf = await blob.slice(0, 32).arrayBuffer();
    const bytes = new Uint8Array(headBuf);

    // JPEG / JFIF (FF D8 FF ...)
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg';
    }
    let ascii = '';
    for (let i = 0; i < bytes.length; i += 1) {
      ascii += String.fromCharCode(bytes[i]);
    }
    if (ascii.includes('JFIF') || ascii.includes('Exif')) {
      return 'image/jpeg';
    }

    // PNG (89 50 4E 47)
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return 'image/png';
    }

    // GIF (GIF8)
    if (ascii.startsWith('GIF8')) {
      return 'image/gif';
    }

    // WEBP (RIFF....WEBP)
    if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') {
      return 'image/webp';
    }
  } catch {
    // fallback para cabeçalho/tipo
  }

  const normalizedType = String(headerContentType || blob.type || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (normalizedType.startsWith('image/')) {
    return normalizedType;
  }

  return null;
}

export async function generateSaraImage(
  prompt: string,
  options?: {
    style?: SaraImageStyle;
    seed?: number;
    previousSeed?: number;
    qualityMode?: 'fast' | 'top' | 'auto';
  }
): Promise<GenerateSaraImageResult> {
  const cleanPrompt = String(prompt || '').trim();
  if (!cleanPrompt) {
    return {
      ok: false,
      error: IMAGE_GENERIC_ERROR_MESSAGE,
    };
  }

  const style: SaraImageStyle = options?.style || 'realistic';
  const seed = options?.seed || generateNewImageSeed(options?.previousSeed);
  const qualityMode = options?.qualityMode || 'auto';
  const styleOption =
    IMAGE_STYLE_OPTIONS.find((opt) => opt.id === style) || IMAGE_STYLE_OPTIONS[0];

  if (qualityMode !== 'top') {
    const englishPrompt = await translatePromptToEnglishClient(cleanPrompt);
    const fullPrompt = `${englishPrompt}, ${styleOption.promptSuffix}, ${IMAGE_QUALITY_SUFFIX}`;
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1280&height=1280&seed=${seed}&model=flux&enhance=true&nologo=true&safe=false`;

    // 1) GERADOR 1 - Pollinations (Rápido) com .blob() e URL.createObjectURL(blob)
    const directController = new AbortController();
    const directTimer = setTimeout(() => directController.abort(), 45000);
    try {
      const response = await fetch(pollinationsUrl, {
        method: 'GET',
        signal: directController.signal,
      });
      const rawBlob = await response.blob();
      clearTimeout(directTimer);

      const detectedMime = await detectImageMimeFromBlob(
        rawBlob,
        response.headers.get('content-type')
      );
      if (detectedMime) {
        const typedBlob = rawBlob.type?.startsWith('image/')
          ? rawBlob
          : new Blob([rawBlob], { type: detectedMime });
        const objectUrl = URL.createObjectURL(typedBlob);
        return {
          ok: true,
          dataUrl: objectUrl,
          seed,
          style,
          isTopQuality: false,
        };
      }
    } catch {
      clearTimeout(directTimer);
    }
  }

  // 2) GERADOR 2 - Qualidade Top (ou fallback automático se o Pollinations falhar)
  const backendController = new AbortController();
  const backendTimer = setTimeout(() => backendController.abort(), 65000);
  try {
    const fallbackRes = await fetch('/api/image/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: cleanPrompt,
        style,
        seed,
        mode: qualityMode,
      }),
      signal: backendController.signal,
    });
    const fallbackBlob = await fallbackRes.blob();
    clearTimeout(backendTimer);

    const detectedMime = await detectImageMimeFromBlob(
      fallbackBlob,
      fallbackRes.headers.get('content-type')
    );
    if (detectedMime) {
      const typedBlob = fallbackBlob.type?.startsWith('image/')
        ? fallbackBlob
        : new Blob([fallbackBlob], { type: detectedMime });
      const objectUrl = URL.createObjectURL(typedBlob);
      return {
        ok: true,
        dataUrl: objectUrl,
        seed,
        style,
        isTopQuality: qualityMode === 'top',
      };
    }

    // Fallback caso alguma rota devolva JSON com base64/dataUrl
    try {
      const textPayload = await fallbackBlob.text();
      if (textPayload && textPayload.trim().startsWith('{')) {
        const parsed = JSON.parse(textPayload) as {
          dataUrl?: string;
          image?: string;
          b64_json?: string;
          data?: Array<{ b64_json?: string }>;
          images?: Array<{ b64_json?: string; url?: string }>;
        };
        const candidate =
          parsed.dataUrl ||
          parsed.image ||
          parsed.b64_json ||
          parsed.data?.[0]?.b64_json ||
          parsed.images?.[0]?.b64_json ||
          parsed.images?.[0]?.url;
        const normalized = normalizeImageDisplaySrc(candidate);
        if (normalized) {
          return {
            ok: true,
            dataUrl: normalized,
            seed,
            style,
            isTopQuality: qualityMode === 'top',
          };
        }
      }
    } catch {
      // ignore
    }

    return {
      ok: false,
      error: IMAGE_GENERIC_ERROR_MESSAGE,
    };
  } catch {
    clearTimeout(backendTimer);
    return {
      ok: false,
      error: IMAGE_GENERIC_ERROR_MESSAGE,
    };
  }
}

// =========================================================================
// FUNÇÕES PRIVADAS EXCLUSIVAS DO PAINEL DO ADMIN
// =========================================================================

async function resolveAdminBearerToken(): Promise<string | null> {
  const fbToken = await getCurrentFirebaseIdToken();
  if (fbToken) return fbToken;
  return getInMemoryAdminVaultToken();
}

export interface AdminImageCoreStatus {
  ok: boolean;
  needsUnlock?: boolean;
  configured: boolean;
  maskedKey: string | null;
  updatedAt: string | null;
  lastError?: string | null;
  lastErrorStatus?: number | null;
  lastErrorAt?: string | null;
  lastModel?: string | null;
  error?: string;
}

export async function unlockAdminImageCoreWithPassword(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      token?: string;
      error?: string;
    } | null;
    if (!res.ok || !data?.ok || !data.token) {
      return { ok: false, error: data?.error || 'Senha de administrador incorreta.' };
    }
    setInMemoryAdminVaultToken(data.token);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Serviço indisponível neste momento.' };
  }
}

export async function fetchAdminImageCoreStatus(): Promise<AdminImageCoreStatus> {
  const token = await resolveAdminBearerToken();
  if (!token) {
    return { ok: false, needsUnlock: true, configured: false, maskedKey: null, updatedAt: null };
  }
  try {
    const res = await fetch('/api/admin/core-image-key', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
      configured?: boolean;
      maskedKey?: string | null;
      updatedAt?: string | null;
      lastError?: string | null;
      lastErrorStatus?: number | null;
      lastErrorAt?: string | null;
      lastModel?: string | null;
      error?: string;
    } | null;

    if (res.status === 401 || data?.code === 'ADMIN_AUTH_REQUIRED') {
      return { ok: false, needsUnlock: true, configured: false, maskedKey: null, updatedAt: null };
    }
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        configured: false,
        maskedKey: null,
        updatedAt: null,
        error: data?.error || 'Erro ao consultar a configuração de imagem.',
      };
    }
    return {
      ok: true,
      configured: Boolean(data.configured),
      maskedKey: data.maskedKey || null,
      updatedAt: data.updatedAt || null,
      lastError: data.lastError || null,
      lastErrorStatus: typeof data.lastErrorStatus === 'number' ? data.lastErrorStatus : null,
      lastErrorAt: data.lastErrorAt || null,
      lastModel: data.lastModel || null,
    };
  } catch {
    return {
      ok: false,
      configured: false,
      maskedKey: null,
      updatedAt: null,
      error: 'Sem ligação ao servidor.',
    };
  }
}

export async function saveAdminImageCoreKey(rawKey: string): Promise<AdminImageCoreStatus> {
  const token = await resolveAdminBearerToken();
  if (!token) {
    return { ok: false, needsUnlock: true, configured: false, maskedKey: null, updatedAt: null };
  }
  try {
    const res = await fetch('/api/admin/core-image-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ key: rawKey.trim() }),
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
      configured?: boolean;
      maskedKey?: string | null;
      updatedAt?: string | null;
      lastError?: string | null;
      lastErrorStatus?: number | null;
      lastErrorAt?: string | null;
      lastModel?: string | null;
      error?: string;
    } | null;

    if (res.status === 401 || data?.code === 'ADMIN_AUTH_REQUIRED') {
      return { ok: false, needsUnlock: true, configured: false, maskedKey: null, updatedAt: null };
    }
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        configured: false,
        maskedKey: null,
        updatedAt: null,
        error: data?.error || 'Não foi possível guardar a Chave de Imagem SARA.',
      };
    }
    return {
      ok: true,
      configured: Boolean(data.configured),
      maskedKey: data.maskedKey || null,
      updatedAt: data.updatedAt || null,
      lastError: data.lastError || null,
      lastErrorStatus: typeof data.lastErrorStatus === 'number' ? data.lastErrorStatus : null,
      lastErrorAt: data.lastErrorAt || null,
      lastModel: data.lastModel || null,
    };
  } catch {
    return {
      ok: false,
      configured: false,
      maskedKey: null,
      updatedAt: null,
      error: 'Sem ligação ao servidor.',
    };
  }
}

export async function clearAdminImageCoreKey(): Promise<AdminImageCoreStatus> {
  const token = await resolveAdminBearerToken();
  if (!token) {
    return { ok: false, needsUnlock: true, configured: false, maskedKey: null, updatedAt: null };
  }
  try {
    const res = await fetch('/api/admin/core-image-key', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      configured?: boolean;
      maskedKey?: string | null;
      updatedAt?: string | null;
      lastError?: string | null;
      lastErrorStatus?: number | null;
      lastErrorAt?: string | null;
      lastModel?: string | null;
      error?: string;
    } | null;
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        configured: false,
        maskedKey: null,
        updatedAt: null,
        error: data?.error || 'Não foi possível remover a Chave de Imagem SARA.',
      };
    }
    return {
      ok: true,
      configured: Boolean(data.configured),
      maskedKey: data.maskedKey || null,
      updatedAt: data.updatedAt || null,
      lastError: data.lastError || null,
      lastErrorStatus: typeof data.lastErrorStatus === 'number' ? data.lastErrorStatus : null,
      lastErrorAt: data.lastErrorAt || null,
      lastModel: data.lastModel || null,
    };
  } catch {
    return {
      ok: false,
      configured: false,
      maskedKey: null,
      updatedAt: null,
      error: 'Sem ligação ao servidor.',
    };
  }
}

export function normalizeImageDisplaySrc(input?: string | Blob | null): string | undefined {
  if (!input) return undefined;
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return input.size > 0 ? URL.createObjectURL(input) : undefined;
  }
  const raw = String(input).trim();
  if (!raw) return undefined;
  if (raw.startsWith('blob:') || raw.startsWith('data:image/')) {
    return raw;
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const compactB64 = raw.replace(/\s+/g, '');
  if (compactB64.length >= 64 && /^[A-Za-z0-9+/=]+$/.test(compactB64)) {
    const mime = compactB64.startsWith('iVBOR')
      ? 'image/png'
      : compactB64.startsWith('UklGR')
      ? 'image/webp'
      : compactB64.startsWith('R0lGOD')
      ? 'image/gif'
      : 'image/jpeg';
    return `data:${mime};base64,${compactB64}`;
  }
  return undefined;
}

function isSupportedGeneratedImageUrl(url?: string | null): boolean {
  const normalized = normalizeImageDisplaySrc(url);
  return Boolean(
    normalized && (normalized.startsWith('data:image/') || normalized.startsWith('blob:'))
  );
}

export function downloadImageDataUrl(dataUrl: string, promptLabel?: string): void {
  const safeSrc = normalizeImageDisplaySrc(dataUrl);
  if (!safeSrc || !isSupportedGeneratedImageUrl(safeSrc)) return;
  const slug = (promptLabel || 'imagem-sara')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  const mimeMatch = safeSrc.match(/^data:image\/([a-z0-9+.-]+);/i);
  const ext = mimeMatch?.[1] === 'jpeg' ? 'jpg' : mimeMatch?.[1] || 'jpg';
  const a = document.createElement('a');
  a.href = safeSrc;
  a.download = `${slug || 'imagem-sara'}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function compressImageForStorage(
  dataUrl: string,
  maxSide = 320,
  quality = 0.84
): Promise<string> {
  return new Promise((resolve) => {
    const safeSrc = normalizeImageDisplaySrc(dataUrl);
    if (typeof document === 'undefined' || !safeSrc || !isSupportedGeneratedImageUrl(safeSrc)) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(img.width || maxSide, img.height || maxSide));
        const w = Math.max(1, Math.round((img.width || maxSide) * scale));
        const h = Math.max(1, Math.round((img.height || maxSide) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = safeSrc;
  });
}

export async function saveUserProfilePhoto(userId: string, rawDataUrl: string): Promise<string | null> {
  const safeSrc = normalizeImageDisplaySrc(rawDataUrl);
  if (!userId || !safeSrc || !isSupportedGeneratedImageUrl(safeSrc)) return null;
  const compact = await compressImageForStorage(safeSrc, 256, 0.85);
  if (!compact.startsWith('data:image/')) return null;
  try {
    localStorage.setItem(`${PROFILE_PHOTO_PREFIX}${userId}`, compact);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PROFILE_PHOTO_EVENT, { detail: { userId } }));
    }
    return compact;
  } catch {
    return null;
  }
}

export function getUserProfilePhoto(userId?: string | null): string | null {
  if (!userId) return null;
  try {
    const val = localStorage.getItem(`${PROFILE_PHOTO_PREFIX}${userId}`);
    return val && val.startsWith('data:image/') ? val : null;
  } catch {
    return null;
  }
}
