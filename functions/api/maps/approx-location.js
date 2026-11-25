export async function onRequestGet(context) {
  try {
    const forwarded = String(context.request.headers.get('cf-connecting-ip') || context.request.headers.get('x-forwarded-for') || '')
      .split(',')[0]
      .trim();
    const isPublicIp =
      forwarded &&
      !/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|localhost)/i.test(forwarded);
    const endpoint = isPublicIp
      ? `https://ipwho.is/${encodeURIComponent(forwarded)}?lang=pt`
      : 'https://ipwho.is/?lang=pt';
    const ipRes = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!ipRes.ok) {
      return new Response(JSON.stringify({ error: 'Localização aproximada indisponível.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const json = await ipRes.json();
    if (
      json?.success !== false &&
      typeof json.latitude === 'number' &&
      typeof json.longitude === 'number' &&
      Number.isFinite(json.latitude) &&
      Number.isFinite(json.longitude)
    ) {
      return new Response(
        JSON.stringify({
          lat: Number(json.latitude.toFixed(6)),
          lng: Number(json.longitude.toFixed(6)),
          city: json.city || '',
          country: json.country || '',
          approximate: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ error: 'Sem localização aproximada disponível.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Sem ligação de rede para localização aproximada.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
