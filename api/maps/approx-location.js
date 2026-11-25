export default async function handler(req, res) {
  try {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const isPublicIp =
      forwarded &&
      !/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|localhost)/i.test(forwarded);
    const endpoint = isPublicIp
      ? `https://ipwho.is/${encodeURIComponent(forwarded)}?lang=pt`
      : 'https://ipwho.is/?lang=pt';
    const ipRes = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!ipRes.ok) {
      return res.status(503).json({ error: 'Localização aproximada indisponível.' });
    }
    const json = await ipRes.json();
    if (
      json?.success !== false &&
      typeof json.latitude === 'number' &&
      typeof json.longitude === 'number' &&
      Number.isFinite(json.latitude) &&
      Number.isFinite(json.longitude)
    ) {
      return res.status(200).json({
        lat: Number(json.latitude.toFixed(6)),
        lng: Number(json.longitude.toFixed(6)),
        city: json.city || '',
        country: json.country || '',
        approximate: true,
      });
    }
    return res.status(503).json({ error: 'Sem localização aproximada disponível.' });
  } catch {
    return res.status(503).json({ error: 'Sem ligação de rede para localização aproximada.' });
  }
}
