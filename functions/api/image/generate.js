import {
  clearBackendImageError,
  getBackendImageKey,
  isValidImageCoreKey,
  recordBackendImageError,
} from '../_coreImageVault.js';

const USER_GENERIC_ERROR = 'Não consegui gerar agora, tenta de novo em alguns segundos.';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function extractUpstreamErrorDetail(upstream) {
  try {
    const txt = (await upstream.text()).trim();
    if (!txt) return '';
    try {
      const parsed = JSON.parse(txt);
      if (typeof parsed?.error === 'string') return parsed.error;
      if (typeof parsed?.message === 'string') return parsed.message;
    } catch {
      // plain text fallback
    }
    return txt.slice(0, 180);
  } catch {
    return '';
  }
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
    'stabilityai/stable-diffusion-2-1',
    'runwayml/stable-diffusion-v1-5',
  ];

  const attemptErrors = [];
  const attemptedModels = [];
  let lastStatus = 503;

  for (let i = 0; i < models.length; i++) {
    const modelId = models[i];
    attemptedModels.push(modelId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const upstream = await fetch(
        `https://router.huggingface.co/hf-inference/models/${modelId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${imageKey}`,
            'Content-Type': 'application/json',
            Accept: 'image/png',
          },
          body: JSON.stringify({
            inputs: prompt,
            options: { wait_for_model: true },
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timer);

      if (upstream.status === 401 || upstream.status === 403) {
        const detail = await extractUpstreamErrorDetail(upstream);
        await recordBackendImageError(
          `HTTP ${upstream.status} — ${detail || 'Chave rejeitada ou sem permissão.'}`,
          upstream.status,
          attemptedModels.join(' -> ')
        );
        return json({ ok: false, error: USER_GENERIC_ERROR }, 503);
      }

      const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
      if (upstream.ok && contentType.startsWith('image/')) {
        const buf = await upstream.arrayBuffer();
        if (buf.byteLength > 0) {
          await clearBackendImageError(modelId);
          const mime = contentType.split(';')[0] || 'image/png';
          return json({
            ok: true,
            dataUrl: `data:${mime};base64,${arrayBufferToBase64(buf)}`,
          });
        }
      }

      lastStatus = upstream.status || 503;
      const detail = await extractUpstreamErrorDetail(upstream);
      attemptErrors.push(
        `[${modelId}] HTTP ${lastStatus}${detail ? `: ${detail}` : ''}`
      );
    } catch (err) {
      clearTimeout(timer);
      lastStatus = err?.name === 'AbortError' ? 504 : 503;
      const errMsg = err?.name === 'AbortError' ? 'Timeout após 45s' : err?.message || 'Erro de rede';
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
