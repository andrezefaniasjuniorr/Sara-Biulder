import { computeRouteMozambique } from '../_openMapMz.js';

export async function onRequestPost(context) {
  const body = await context.request.json().catch(() => ({}));
  const { status, payload } = await computeRouteMozambique(body?.origin, body?.destination);
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
