import { getInMemoryAdminVaultToken, setInMemoryAdminVaultToken } from './authService';
import { getCurrentFirebaseIdToken } from './firebaseService';

export const IMAGE_MISSING_KEY_MESSAGE = 'Geração de imagens indisponível no momento.';
export const IMAGE_CREATING_MESSAGE = 'A criar a tua imagem...';
export const PROFILE_PHOTO_EVENT = 'sara-profile-photo-updated';

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
    /^(?:(?:ei|ola|oi|hey)\s+)?(?:sara[,\s.:;-]+)?(?:por\s+favor[,\s]+)?(?:podes\s+|pode\s+|quero\s+que\s+)?(?:gerar|gera|cria|criar|faz|fazer|desenha|desenhar|produz|produzir|inventa|imagina)(?:-me|\s+me|\s+para\s+mim)?\s+(?:uma?\s+)?(?:nova\s+)?(?:imagem|foto|ilustracao|figura|arte|desenho|retrato)(?:\s+(?:de|da|do|das|dos|com|sobre|em))?\s+(.+)$/i,
    /^(?:(?:ei|ola|oi|hey)\s+)?(?:sara[,\s.:;-]+)?(?:quero|preciso\s+de|manda)\s+(?:uma?\s+)?(?:imagem|foto|ilustracao|arte)(?:\s+(?:de|da|do|das|dos|com|sobre))?\s+(.+)$/i,
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
  | { ok: true; dataUrl: string }
  | { ok: false; missingOrInvalidKey: boolean; error: string };

export async function generateSaraImage(
  prompt: string,
  options?: { variationSeed?: number }
): Promise<GenerateSaraImageResult> {
  const cleanPrompt = String(prompt || '').trim();
  if (!cleanPrompt) {
    return {
      ok: false,
      missingOrInvalidKey: false,
      error: 'Descreve o que queres ver na imagem para o Núcleo SARA criar.',
    };
  }

  const effectivePrompt = options?.variationSeed
    ? `${cleanPrompt} (variação visual ${options.variationSeed})`
    : cleanPrompt;

  try {
    const response = await fetch('/api/image/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: effectivePrompt }),
    });

    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      dataUrl?: string;
      notConfigured?: boolean;
      error?: string;
    } | null;

    if (
      data?.notConfigured ||
      response.status === 401 ||
      response.status === 403
    ) {
      return {
        ok: false,
        missingOrInvalidKey: true,
        error: IMAGE_MISSING_KEY_MESSAGE,
      };
    }

    if (
      !response.ok ||
      !data?.ok ||
      typeof data.dataUrl !== 'string' ||
      !data.dataUrl.startsWith('data:image/')
    ) {
      return {
        ok: false,
        missingOrInvalidKey: false,
        error: data?.error || 'Núcleo SARA ocupado ao criar a imagem. Tenta novamente.',
      };
    }

    return { ok: true, dataUrl: data.dataUrl };
  } catch {
    return {
      ok: false,
      missingOrInvalidKey: false,
      error: 'Núcleo SARA indisponível no momento. Verifica a tua ligação e tenta novamente.',
    };
  }
}

// =========================================================================
// FUNÇÕES PRIVADAS EXCLUSIVAS DO PAINEL DO ADMIN (NÚCLEO SARA)
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
    return { ok: false, error: 'Núcleo SARA indisponível neste momento.' };
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
        error: data?.error || 'Erro ao consultar o Núcleo SARA.',
      };
    }
    return {
      ok: true,
      configured: Boolean(data.configured),
      maskedKey: data.maskedKey || null,
      updatedAt: data.updatedAt || null,
    };
  } catch {
    return {
      ok: false,
      configured: false,
      maskedKey: null,
      updatedAt: null,
      error: 'Sem ligação ao Núcleo SARA.',
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
        error: data?.error || 'Não foi possível guardar no Núcleo SARA.',
      };
    }
    return {
      ok: true,
      configured: Boolean(data.configured),
      maskedKey: data.maskedKey || null,
      updatedAt: data.updatedAt || null,
    };
  } catch {
    return {
      ok: false,
      configured: false,
      maskedKey: null,
      updatedAt: null,
      error: 'Sem ligação ao Núcleo SARA.',
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
      error?: string;
    } | null;
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        configured: false,
        maskedKey: null,
        updatedAt: null,
        error: data?.error || 'Não foi possível remover do Núcleo SARA.',
      };
    }
    return {
      ok: true,
      configured: Boolean(data.configured),
      maskedKey: data.maskedKey || null,
      updatedAt: data.updatedAt || null,
    };
  } catch {
    return {
      ok: false,
      configured: false,
      maskedKey: null,
      updatedAt: null,
      error: 'Sem ligação ao Núcleo SARA.',
    };
  }
}

export function downloadImageDataUrl(dataUrl: string, promptLabel?: string): void {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return;
  const slug = (promptLabel || 'imagem-sara')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  const mimeMatch = dataUrl.match(/^data:image\/([a-z0-9+.-]+);/i);
  const ext = mimeMatch?.[1] === 'jpeg' ? 'jpg' : mimeMatch?.[1] || 'png';
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
    if (typeof document === 'undefined' || !dataUrl.startsWith('data:image/')) {
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
  if (!userId || !rawDataUrl.startsWith('data:image/')) return null;
  const compact = await compressImageForStorage(rawDataUrl, 256, 0.85);
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
