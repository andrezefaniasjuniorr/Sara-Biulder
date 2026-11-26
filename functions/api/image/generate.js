import {
  clearBackendImageError,
  recordBackendImageError,
} from '../_coreImageVault.js';

const USER_GENERIC_ERROR = 'Não consegui gerar agora, tenta de novo em alguns segundos.';

const IMAGE_STYLE_SUFFIXES = {
  realistic:
    'ultra realistic, professional photography, detailed skin, cinematic lighting, 4k, high resolution',
  drawing:
    'beautiful digital illustration, vibrant colors, detailed art, clean lines, high quality artwork',
  pixar3d:
    '3D pixar style, cute character, big expressive eyes, soft lighting, high quality 3D render',
};

function resolveImageStyle(rawStyle) {
  const clean = String(rawStyle || '').trim().toLowerCase();
  if (clean === 'drawing' || clean === 'desenho') return 'drawing';
  if (clean === 'pixar3d' || clean === '3d_pixar' || clean === 'pixar') return 'pixar3d';
  return 'realistic';
}

function resolveSeed(rawSeed) {
  const num = Number(rawSeed);
  if (Number.isFinite(num) && num > 0) {
    return Math.trunc(num);
  }
  return Math.floor(Math.random() * 2000000000) + 1;
}

function detectImageMimeFromBuffer(arrayBuffer, headerContentType) {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) return null;
  const bytes = new Uint8Array(arrayBuffer, 0, Math.min(32, arrayBuffer.byteLength));
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  let headStr = '';
  for (let i = 0; i < bytes.length; i += 1) {
    headStr += String.fromCharCode(bytes[i]);
  }
  if (headStr.includes('JFIF') || headStr.includes('Exif')) {
    return 'image/jpeg';
  }
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
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
}

async function translatePromptToEnglish(rawPrompt) {
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
      const data = await res.json();
      if (Array.isArray(data?.[0])) {
        const translated = data[0]
          .map((part) => (Array.isArray(part) && typeof part[0] === 'string' ? part[0] : ''))
          .join('')
          .trim();
        if (translated) return translated;
      }
    }
  } catch {
    // fallback below
  } finally {
    clearTimeout(timer);
  }

  return clean;
}

export async function onRequestPost(context) {
  const { request } = context;
  const body = await request.json().catch(() => ({}));
  const prompt = String(body?.prompt || '').trim();
  const styleKey = resolveImageStyle(body?.style);
  const seed = resolveSeed(body?.seed);
  const modelLabel = `pollinations.ai (${styleKey})`;

  if (!prompt || prompt.length > 1000) {
    return new Response(USER_GENERIC_ERROR, {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const englishPrompt = await translatePromptToEnglish(prompt);
  const styleSuffix = IMAGE_STYLE_SUFFIXES[styleKey] || IMAGE_STYLE_SUFFIXES.realistic;
  const fullPrompt = `${englishPrompt}, ${styleSuffix}`;
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const upstream = await fetch(pollinationsUrl, {
      method: 'GET',
      headers: {
        Accept: 'image/*',
      },
      signal: controller.signal,
    });

    const buf = await upstream.arrayBuffer();
    clearTimeout(timer);

    const detectedMime = detectImageMimeFromBuffer(buf, upstream.headers.get('content-type'));
    if (detectedMime) {
      await clearBackendImageError(modelLabel);
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': detectedMime,
          'Cache-Control': 'no-store',
        },
      });
    }

    const detail = new TextDecoder().decode(buf).trim().slice(0, 220);
    const status = upstream.status || 503;
    await recordBackendImageError(
      `HTTP ${status}${detail ? ` — ${detail}` : ' — Resposta inválida sem imagem.'}`,
      status,
      modelLabel
    );
    return new Response(USER_GENERIC_ERROR, {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) {
    clearTimeout(timer);
    const status = err?.name === 'AbortError' ? 504 : 503;
    const errMsg = err?.name === 'AbortError' ? 'Timeout após 45s' : err?.message || 'Erro de rede';
    await recordBackendImageError(errMsg, status, modelLabel);
    return new Response(USER_GENERIC_ERROR, {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
