import { reverseGeocodeMozambique } from '../_openMapMz.js';

export async function onRequestPost(context) {
  const body = await context.request.json().catch(() => ({}));
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return new Response(JSON.stringify({ error: 'Coordenadas inválidas.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const result = await reverseGeocodeMozambique(lat, lng);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
