import { getInMemoryAdminVaultToken, setInMemoryAdminVaultToken } from './authService';
import { getCurrentFirebaseIdToken } from './firebaseService';

export const IMAGE_GENERIC_ERROR_MESSAGE =
  'Não consegui gerar agora, tenta de novo em alguns segundos.';
export const IMAGE_CREATING_MESSAGE = 'A criar a tua imagem...';
export const IMAGE_ASK_STYLE_MESSAGE = 'Escolhe o estilo da tua imagem:';
export const PROFILE_PHOTO_EVENT = 'sara-profile-photo-updated';

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
      'ultra realistic, professional photography, detailed skin, cinematic lighting, 4k, high resolution',
  },
  {
    id: 'drawing',
    label: 'Desenho',
    promptSuffix:
      'beautiful digital illustration, vibrant colors, detailed art, clean lines, high quality artwork',
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

/**
 * Deteta pedidos espontâneos para gerar imagem no chat ou por voz.
 * Exemplo: "SARA, cria uma imagem de um leão dourado", "SARA, gera uma imagem de..."
 */
export function extractImageGenPrompt(rawText: string): string | null {
  const clean = String(rawText || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;

  const normalized = clean
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Evita confundir edição ou abertura de ficheiros locais
  if (
    /^(?:sara[,\s]+)?(?:abre|abrir|mostra|mostrar|ver|edita|apaga|apagar)\b/i.test(normalized)
  ) {
    return null;
  }

  const patterns: RegExp[] = [
    /^(?:(?:ei|ol[aá]|oi|hey)\s+)?(?:sara[,\s.:;-]+)?(?:por\s+favor[,\s]+)?(?:podes\s+|pode\s+|quero\s+que\s+)?(?:gerar|gera|cria|criar|faz|fazer|desenha|desenhar|produz|produzir|inventa|imagina)(?:-me|\s+me|\s+para\s+mim)?\s+(?:uma?\s+)?(?:nova\s+)?(?:imagem|foto|ilustra[cç][aã]o|figura|arte|desenho|retrato)(?:\s+(?:de|da|do|das|dos|com|sobre|em))?\s+(.+)$/i,
    /^(?:(?:ei|ol[aá]|oi|hey)\s+)?(?:sara[,\s.:;-]+)?(?:quero|preciso\s+de|manda)\s+(?:uma?\s+)?(?:imagem|foto|ilustra[cç][aã]o|arte)(?:\s+(?:de|da|do|das|dos|com|sobre))?\s+(.+)$/i,
  ];

  for (const rx of patterns) {
    const m = clean.match(rx);
    if (m && m[1]) {
      const subject = m[1].replace(/[.!?]+$/g, '').trim();
      if (subject.length >= 2) {
        return subject;
      }
    }
  }

  return null;
}

export type GenerateSaraImageResult =
  | { ok: true; dataUrl: string; seed: number; style: SaraImageStyle }
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
  options?: { style?: SaraImageStyle; seed?: number; previousSeed?: number }
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
  const styleOption =
    IMAGE_STYLE_OPTIONS.find((opt) => opt.id === style) || IMAGE_STYLE_OPTIONS[0];

  const englishPrompt = await translatePromptToEnglishClient(cleanPrompt);
  const fullPrompt = `${englishPrompt}, ${styleOption.promptSuffix}`;
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`;

  // 1) Pedido direto com .blob() e URL.createObjectURL(blob), aceitando JFIF/JPEG mesmo se HTTP 402
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
      };
    }
  } catch {
    clearTimeout(directTimer);
  }

  // 2) Fallback silencioso via servidor usando também .blob() e URL.createObjectURL(blob)
  const fallbackController = new AbortController();
  const fallbackTimer = setTimeout(() => fallbackController.abort(), 45000);
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
      }),
      signal: fallbackController.signal,
    });
    const fallbackBlob = await fallbackRes.blob();
    clearTimeout(fallbackTimer);

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
      };
    }

    return {
      ok: false,
      error: IMAGE_GENERIC_ERROR_MESSAGE,
    };
  } catch {
    clearTimeout(fallbackTimer);
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

function isSupportedGeneratedImageUrl(url?: string | null): boolean {
  return Boolean(url && (url.startsWith('data:image/') || url.startsWith('blob:')));
}

export function downloadImageDataUrl(dataUrl: string, promptLabel?: string): void {
  if (!isSupportedGeneratedImageUrl(dataUrl)) return;
  const slug = (promptLabel || 'imagem-sara')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  const mimeMatch = dataUrl.match(/^data:image\/([a-z0-9+.-]+);/i);
  const ext = mimeMatch?.[1] === 'jpeg' ? 'jpg' : mimeMatch?.[1] || 'jpg';
  const a = document.createElement('a');
  a.href = dataUrl;
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
    if (typeof document === 'undefined' || !isSupportedGeneratedImageUrl(dataUrl)) {
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
    img.src = dataUrl;
  });
}

export async function saveUserProfilePhoto(userId: string, rawDataUrl: string): Promise<string | null> {
  if (!userId || !isSupportedGeneratedImageUrl(rawDataUrl)) return null;
  const compact = await compressImageForStorage(rawDataUrl, 256, 0.85);
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
