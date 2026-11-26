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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: USER_GENERIC_ERROR });
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch {
    body = {};
  }
  const prompt = String(body?.prompt || '').trim();
  const styleKey = resolveImageStyle(body?.style);
  const seed = resolveSeed(body?.seed);
  const modelLabel = `pollinations.ai (${styleKey})`;

  if (!prompt || prompt.length > 1000) {
    return res.status(400).json({
      ok: false,
      error: USER_GENERIC_ERROR,
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

    const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
    if (upstream.ok && contentType.startsWith('image/')) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      clearTimeout(timer);
      if (buf.length > 0) {
        await clearBackendImageError(modelLabel);
        const mime = contentType.split(';')[0] || 'image/jpeg';
        return res.status(200).json({
          ok: true,
          dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
          seed,
          style: styleKey,
        });
      }
    }

    const detail = (await upstream.text().catch(() => '')).trim().slice(0, 220);
    clearTimeout(timer);
    const status = upstream.status || 503;
    await recordBackendImageError(
      `HTTP ${status}${detail ? ` — ${detail}` : ' — Resposta inválida sem imagem.'}`,
      status,
      modelLabel
    );
    return res.status(503).json({
      ok: false,
      error: USER_GENERIC_ERROR,
    });
  } catch (err) {
    clearTimeout(timer);
    const status = err?.name === 'AbortError' ? 504 : 503;
    const errMsg = err?.name === 'AbortError' ? 'Timeout após 45s' : err?.message || 'Erro de rede';
    await recordBackendImageError(errMsg, status, modelLabel);
    return res.status(503).json({
      ok: false,
      error: USER_GENERIC_ERROR,
    });
  }
}
