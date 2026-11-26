import {
  clearBackendImageError,
  getBackendImageKey,
  recordBackendImageError,
} from '../_coreImageVault.js';

const USER_GENERIC_ERROR = 'Não consegui gerar agora, tenta de novo em alguns segundos.';
const QUALITY_PROMPT_SUFFIX =
  'ultra detailed, sharp focus, high quality, 8k, professional lighting, no blur, no distortion';
const HF_TOP_MODEL_URL = 'https://router.huggingface.co/fal-ai/black-forest-labs/FLUX.1-dev';
const HF_TOP_MODEL_LABEL = 'fal-ai/black-forest-labs/FLUX.1-dev';

const IMAGE_STYLE_SUFFIXES = {
  realistic: 'ultra realistic, professional photography, detailed skin, cinematic lighting, 4k',
  drawing: 'beautiful digital illustration, vibrant colors, detailed art, clean lines',
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

function resolveGenerationMode(rawMode) {
  const clean = String(rawMode || '').trim().toLowerCase();
  if (clean === 'top' || clean === 'hf') return 'top';
  if (clean === 'fast' || clean === 'pollinations') return 'fast';
  return 'auto';
}

function isSafeRemoteImageUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || '').trim());
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local')) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
      return false;
    }
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
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

function detectImageMimeFromBytes(buf, headerContentType) {
  if (!buf || buf.length === 0) return null;
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  const headStr = buf.subarray(0, 32).toString('latin1');
  if (headStr.includes('JFIF') || headStr.includes('Exif')) {
    return 'image/jpeg';
  }
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
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

async function tryGeneratePollinations(fullPrompt, seed, styleKey) {
  const modelLabel = `pollinations.ai/flux (${styleKey})`;
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1280&height=1280&seed=${seed}&model=flux&enhance=true&nologo=true&safe=false`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const upstream = await fetch(pollinationsUrl, {
      method: 'GET',
      headers: { Accept: 'image/*' },
      signal: controller.signal,
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    clearTimeout(timer);

    const detectedMime = detectImageMimeFromBytes(buf, upstream.headers.get('content-type'));
    if (detectedMime) {
      return { ok: true, buffer: buf, mime: detectedMime, modelLabel };
    }
    const detail = buf.toString('utf8', 0, 220).trim();
    const status = upstream.status || 503;
    return {
      ok: false,
      status,
      detail: `HTTP ${status}${detail ? ` — ${detail}` : ' — Resposta inválida sem imagem.'}`,
      modelLabel,
    };
  } catch (err) {
    clearTimeout(timer);
    const status = err?.name === 'AbortError' ? 504 : 503;
    const errMsg = err?.name === 'AbortError' ? 'Timeout após 45s' : err?.message || 'Erro de rede';
    return { ok: false, status, detail: errMsg, modelLabel };
  }
}

async function tryGenerateHuggingFaceTop(fullPrompt, seed) {
  const vault = await getBackendImageKey();
  const imageKey = String(vault?.imageKey || '').trim();
  if (!imageKey) {
    return {
      ok: false,
      status: 401,
      detail: 'Chave de Imagem SARA não configurada no painel de Admin.',
      modelLabel: HF_TOP_MODEL_LABEL,
    };
  }

  const payloads = [
    {
      prompt: fullPrompt,
      image_size: { width: 1280, height: 1280 },
      seed,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      output_format: 'jpeg',
    },
    {
      inputs: fullPrompt,
      parameters: {
        width: 1280,
        height: 1280,
        seed,
        num_inference_steps: 28,
        guidance_scale: 3.5,
      },
    },
  ];

  let lastStatus = 503;
  let lastDetail = 'Erro desconhecido ao gerar em Qualidade Top.';

  for (let i = 0; i < payloads.length; i += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const upstream = await fetch(HF_TOP_MODEL_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${imageKey}`,
          'Content-Type': 'application/json',
          Accept: 'image/*, application/json',
        },
        body: JSON.stringify(payloads[i]),
        signal: controller.signal,
      });

      const buf = Buffer.from(await upstream.arrayBuffer());
      clearTimeout(timer);

      const detectedMime = detectImageMimeFromBytes(buf, upstream.headers.get('content-type'));
      if (detectedMime) {
        return { ok: true, buffer: buf, mime: detectedMime, modelLabel: HF_TOP_MODEL_LABEL };
      }

      const rawText = buf.toString('utf8');
      let parsed = null;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }

      if (parsed && typeof parsed === 'object') {
        const b64 =
          parsed?.data?.[0]?.b64_json ||
          parsed?.images?.[0]?.b64_json ||
          parsed?.b64_json ||
          null;
        if (typeof b64 === 'string' && b64.length > 50) {
          const decoded = Buffer.from(b64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
          const b64Mime = detectImageMimeFromBytes(decoded, 'image/jpeg') || 'image/jpeg';
          return { ok: true, buffer: decoded, mime: b64Mime, modelLabel: HF_TOP_MODEL_LABEL };
        }

        const remoteUrl =
          parsed?.images?.[0]?.url ||
          parsed?.image?.url ||
          parsed?.data?.[0]?.url ||
          parsed?.url ||
          null;
        if (typeof remoteUrl === 'string' && isSafeRemoteImageUrl(remoteUrl)) {
          const imgController = new AbortController();
          const imgTimer = setTimeout(() => imgController.abort(), 30000);
          try {
            const imgRes = await fetch(remoteUrl, {
              method: 'GET',
              headers: { Accept: 'image/*' },
              signal: imgController.signal,
            });
            const imgBuf = Buffer.from(await imgRes.arrayBuffer());
            clearTimeout(imgTimer);
            const imgMime = detectImageMimeFromBytes(imgBuf, imgRes.headers.get('content-type'));
            if (imgMime) {
              return { ok: true, buffer: imgBuf, mime: imgMime, modelLabel: HF_TOP_MODEL_LABEL };
            }
          } catch {
            clearTimeout(imgTimer);
          }
        }
      }

      lastStatus = upstream.status || 503;
      const snippet = rawText.trim().slice(0, 220);
      lastDetail = `HTTP ${lastStatus}${snippet ? ` — ${snippet}` : ''}`;

      // Só tenta o segundo formato de payload se o endpoint rejeitou o esquema (400/422)
      if (lastStatus !== 400 && lastStatus !== 422) {
        break;
      }
    } catch (err) {
      clearTimeout(timer);
      lastStatus = err?.name === 'AbortError' ? 504 : 503;
      lastDetail = err?.name === 'AbortError' ? 'Timeout após 60s' : err?.message || 'Erro de rede';
      break;
    }
  }

  return {
    ok: false,
    status: lastStatus,
    detail: lastDetail,
    modelLabel: HF_TOP_MODEL_LABEL,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).type('text/plain').send(USER_GENERIC_ERROR);
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
  const mode = resolveGenerationMode(body?.mode);

  if (!prompt || prompt.length > 1000) {
    return res.status(400).type('text/plain').send(USER_GENERIC_ERROR);
  }

  const englishPrompt = await translatePromptToEnglish(prompt);
  const styleSuffix = IMAGE_STYLE_SUFFIXES[styleKey] || IMAGE_STYLE_SUFFIXES.realistic;
  const fullPrompt = `${englishPrompt}, ${styleSuffix}, ${QUALITY_PROMPT_SUFFIX}`;

  if (mode === 'top') {
    const topResult = await tryGenerateHuggingFaceTop(fullPrompt, seed);
    if (topResult.ok) {
      await clearBackendImageError(topResult.modelLabel);
      res.setHeader('Content-Type', topResult.mime);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(topResult.buffer);
    }
    await recordBackendImageError(topResult.detail, topResult.status, topResult.modelLabel);
    return res.status(503).type('text/plain').send(USER_GENERIC_ERROR);
  }

  const fastResult = await tryGeneratePollinations(fullPrompt, seed, styleKey);
  if (fastResult.ok) {
    await clearBackendImageError(fastResult.modelLabel);
    res.setHeader('Content-Type', fastResult.mime);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(fastResult.buffer);
  }

  if (mode === 'auto') {
    const topFallback = await tryGenerateHuggingFaceTop(fullPrompt, seed);
    if (topFallback.ok) {
      await clearBackendImageError(topFallback.modelLabel);
      res.setHeader('Content-Type', topFallback.mime);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(topFallback.buffer);
    }
    await recordBackendImageError(
      `Pollinations: ${fastResult.detail} | Qualidade Top: ${topFallback.detail}`,
      topFallback.status || fastResult.status,
      `${fastResult.modelLabel} -> ${topFallback.modelLabel}`
    );
    return res.status(503).type('text/plain').send(USER_GENERIC_ERROR);
  }

  await recordBackendImageError(fastResult.detail, fastResult.status, fastResult.modelLabel);
  return res.status(503).type('text/plain').send(USER_GENERIC_ERROR);
}
