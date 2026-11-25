function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function onRequestPost(context) {
  const { request } = context;
  const rawKey = String(request.headers.get('x-sara-image-key') || '').trim();
  const body = await request.json().catch(() => ({}));
  const prompt = String(body?.prompt || '').trim();

  const json = (payload, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  if (!rawKey || !rawKey.startsWith('hf_') || rawKey.length < 10) {
    return json(
      {
        ok: false,
        code: 'INVALID_KEY',
        error: 'Coloca a tua chave de imagem nas Definições para gerar imagens.',
      },
      401
    );
  }

  if (!prompt || prompt.length > 1000) {
    return json({ ok: false, error: 'Descrição inválida para gerar a imagem.' }, 400);
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
            Authorization: `Bearer ${rawKey}`,
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
        return json(
          {
            ok: false,
            code: 'INVALID_KEY',
            error: 'Coloca a tua chave de imagem nas Definições para gerar imagens.',
          },
          401
        );
      }

      const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
      if (upstream.ok && contentType.startsWith('image/')) {
        const buf = await upstream.arrayBuffer();
        if (buf.byteLength > 0) {
          const mime = contentType.split(';')[0] || 'image/png';
          return json({
            ok: true,
            dataUrl: `data:${mime};base64,${arrayBufferToBase64(buf)}`,
          });
        }
      }

      if (i < models.length - 1 && [404, 410, 429, 500, 502, 503, 504].includes(upstream.status)) {
        continue;
      }

      return json(
        {
          ok: false,
          error: 'Núcleo SARA ocupado ao criar a imagem. Tenta novamente dentro de instantes.',
        },
        503
      );
    } catch {
      clearTimeout(timer);
      if (i < models.length - 1) continue;
      return json({ ok: false, error: 'Núcleo SARA demorou a responder. Tenta novamente.' }, 504);
    }
  }

  return json(
    { ok: false, error: 'Núcleo SARA ocupado ao criar a imagem. Tenta novamente.' },
    503
  );
}
