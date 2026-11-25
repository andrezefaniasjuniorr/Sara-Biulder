import { getBackendImageKey, isValidImageCoreKey } from '../_coreImageVault.js';

const UNAVAILABLE_MSG = 'Geração de imagens indisponível no momento.';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const prompt = String(body?.prompt || '').trim();

  if (!prompt || prompt.length > 1000) {
    return res.status(400).json({
      ok: false,
      error: 'Descrição inválida para gerar a imagem.',
    });
  }

  const { imageKey } = await getBackendImageKey();
  if (!isValidImageCoreKey(imageKey)) {
    return res.status(503).json({
      ok: false,
      notConfigured: true,
      error: UNAVAILABLE_MSG,
    });
  }

  const models = [
    'black-forest-labs/FLUX.1-schnell',
    'stabilityai/stable-diffusion-xl-base-1.0',
  ];

  for (let i = 0; i < models.length; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const upstream = await fetch(
        `https://router.huggingface.co/hf-inference/models/${models[i]}`,
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
        return res.status(503).json({
          ok: false,
          notConfigured: true,
          error: UNAVAILABLE_MSG,
        });
      }

      const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
      if (upstream.ok && contentType.startsWith('image/')) {
        const buf = Buffer.from(await upstream.arrayBuffer());
        if (buf.length > 0) {
          const mime = contentType.split(';')[0] || 'image/png';
          return res.status(200).json({
            ok: true,
            dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
          });
        }
      }

      if (i < models.length - 1 && [404, 410, 429, 500, 502, 503, 504].includes(upstream.status)) {
        continue;
      }

      return res.status(503).json({
        ok: false,
        error: 'Núcleo SARA ocupado ao criar a imagem. Tenta novamente dentro de instantes.',
      });
    } catch {
      clearTimeout(timer);
      if (i < models.length - 1) continue;
      return res.status(504).json({
        ok: false,
        error: 'Núcleo SARA demorou a responder. Tenta novamente.',
      });
    }
  }

  return res.status(503).json({
    ok: false,
    error: 'Núcleo SARA ocupado ao criar a imagem. Tenta novamente.',
  });
}
