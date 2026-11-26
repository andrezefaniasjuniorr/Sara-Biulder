import {
  clearBackendImageError,
  getBackendImageKey,
  isValidImageCoreKey,
  recordBackendImageError,
} from '../_coreImageVault.js';

const USER_GENERIC_ERROR = 'Não consegui gerar agora, tenta de novo em alguns segundos.';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: USER_GENERIC_ERROR });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const prompt = String(body?.prompt || '').trim();

  if (!prompt || prompt.length > 1000) {
    return res.status(400).json({
      ok: false,
      error: USER_GENERIC_ERROR,
    });
  }

  const { imageKey } = await getBackendImageKey();
  if (!isValidImageCoreKey(imageKey)) {
    await recordBackendImageError(
      'Chave de Imagem SARA não configurada no painel de admin.',
      503,
      'Nenhum (chave não configurada)'
    );
    return res.status(503).json({
      ok: false,
      error: USER_GENERIC_ERROR,
    });
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
        return res.status(503).json({
          ok: false,
          error: USER_GENERIC_ERROR,
        });
      }

      const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
      if (upstream.ok && contentType.startsWith('image/')) {
        const buf = Buffer.from(await upstream.arrayBuffer());
        if (buf.length > 0) {
          await clearBackendImageError(modelId);
          const mime = contentType.split(';')[0] || 'image/png';
          return res.status(200).json({
            ok: true,
            dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
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

  return res.status(503).json({
    ok: false,
    error: USER_GENERIC_ERROR,
  });
}
