import {
  clearBackendImageError,
  getBackendImageKey,
  isValidImageCoreKey,
  recordBackendImageError,
} from '../_coreImageVault.js';

const USER_GENERIC_ERROR = 'Não consegui gerar agora, tenta de novo em alguns segundos.';
const HF_ROUTER_IMAGES_URL = 'https://router.huggingface.co/v1/images/generations';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function detectBase64ImageMime(b64) {
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}

function isSafeHttpsImageUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      !host ||
      host === 'localhost' ||
      host === '::1' ||
      /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function resolveGeneratedDataUrl(upstream, signal) {
  const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
  if (upstream.ok && contentType.startsWith('image/')) {
    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > 0) {
      const mime = contentType.split(';')[0] || 'image/png';
      return { dataUrl: `data:${mime};base64,${arrayBufferToBase64(buf)}`, errorDetail: '' };
    }
    return { dataUrl: '', errorDetail: 'Resposta de imagem vazia.' };
  }

  const rawText = (await upstream.text().catch(() => '')).trim();
  if (!rawText) {
    return { dataUrl: '', errorDetail: 'Resposta vazia do servidor de imagem.' };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { dataUrl: '', errorDetail: rawText.slice(0, 180) };
  }

  if (upstream.ok) {
    const b64Candidate = String(
      parsed?.data?.[0]?.b64_json ||
        parsed?.b64_json ||
        (typeof parsed?.image === 'string' && !parsed.image.startsWith('http') ? parsed.image : '')
    ).trim();

    if (b64Candidate) {
      if (b64Candidate.startsWith('data:image/')) {
        return { dataUrl: b64Candidate, errorDetail: '' };
      }
      const cleanB64 = b64Candidate.replace(/\s+/g, '');
      const mime = detectBase64ImageMime(cleanB64);
      return { dataUrl: `data:${mime};base64,${cleanB64}`, errorDetail: '' };
    }

    const urlCandidate = String(
      parsed?.data?.[0]?.url ||
        parsed?.url ||
        (typeof parsed?.image === 'string' && parsed.image.startsWith('https://')
          ? parsed.image
          : '')
    ).trim();

    if (urlCandidate && isSafeHttpsImageUrl(urlCandidate)) {
      const imgRes = await fetch(urlCandidate, { signal });
      if (imgRes.ok) {
        const imgCt = String(imgRes.headers.get('content-type') || '').toLowerCase();
        const buf = await imgRes.arrayBuffer();
        if (buf.byteLength > 0 && (imgCt.startsWith('image/') || !imgCt)) {
          const mime = imgCt.startsWith('image/') ? imgCt.split(';')[0] : 'image/png';
          return { dataUrl: `data:${mime};base64,${arrayBufferToBase64(buf)}`, errorDetail: '' };
        }
      }
      return {
        dataUrl: '',
        errorDetail: `Falha ao descarregar imagem gerada (HTTP ${imgRes.status}).`,
      };
    }
  }

  const errMsg =
    (typeof parsed?.error === 'string' && parsed.error) ||
    (typeof parsed?.error?.message === 'string' && parsed.error.message) ||
    (typeof parsed?.message === 'string' && parsed.message) ||
    rawText.slice(0, 180);
  return { dataUrl: '', errorDetail: errMsg };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const prompt = String(body?.prompt || '').trim();

  const json = (payload, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  if (!prompt || prompt.length > 1000) {
    return json({ ok: false, error: USER_GENERIC_ERROR }, 400);
  }

  const { imageKey } = await getBackendImageKey(env);
  if (!isValidImageCoreKey(imageKey)) {
    await recordBackendImageError(
      'Chave de Imagem SARA não configurada no painel de admin.',
      503,
      'Nenhum (chave não configurada)'
    );
    return json({ ok: false, error: USER_GENERIC_ERROR }, 503);
  }

  const models = [
    'black-forest-labs/FLUX.1-schnell',
    'black-forest-labs/FLUX.1-dev',
    'Qwen/Qwen-Image',
    'stabilityai/stable-diffusion-3.5-large',
  ];

  const attemptErrors = [];
  const attemptedModels = [];
  let lastStatus = 503;

  for (let i = 0; i < models.length; i++) {
    const modelId = models[i];
    attemptedModels.push(modelId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    try {
      const upstream = await fetch(HF_ROUTER_IMAGES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${imageKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          prompt,
          image_size: 'square_hd',
        }),
        signal: controller.signal,
      });

      if (upstream.status === 401 || upstream.status === 403) {
        const { errorDetail } = await resolveGeneratedDataUrl(upstream, controller.signal).catch(() => ({
          errorDetail: '',
        }));
        clearTimeout(timer);
        await recordBackendImageError(
          `HTTP ${upstream.status} — ${errorDetail || 'Chave rejeitada ou sem permissão.'}`,
          upstream.status,
          attemptedModels.join(' -> ')
        );
        return json({ ok: false, error: USER_GENERIC_ERROR }, 503);
      }

      if (upstream.ok) {
        const { dataUrl, errorDetail } = await resolveGeneratedDataUrl(upstream, controller.signal);
        clearTimeout(timer);
        if (dataUrl) {
          await clearBackendImageError(modelId);
          return json({
            ok: true,
            dataUrl,
          });
        }
        lastStatus = 502;
        attemptErrors.push(`[${modelId}] HTTP 502${errorDetail ? `: ${errorDetail}` : ''}`);
        continue;
      }

      lastStatus = upstream.status || 503;
      const { errorDetail } = await resolveGeneratedDataUrl(upstream, controller.signal).catch(() => ({
        errorDetail: '',
      }));
      clearTimeout(timer);
      attemptErrors.push(
        `[${modelId}] HTTP ${lastStatus}${errorDetail ? `: ${errorDetail}` : ''}`
      );
    } catch (err) {
      clearTimeout(timer);
      lastStatus = err?.name === 'AbortError' ? 504 : 503;
      const errMsg = err?.name === 'AbortError' ? 'Timeout após 35s' : err?.message || 'Erro de rede';
      attemptErrors.push(`[${modelId}] ${errMsg}`);
    }
  }

  await recordBackendImageError(
    attemptErrors.join(' | ') || 'Falha nos motores de geração de imagem.',
    lastStatus,
    attemptedModels.join(' -> ')
  );

  return json({ ok: false, error: USER_GENERIC_ERROR }, 503);
}
