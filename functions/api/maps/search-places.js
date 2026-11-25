import { searchPlacesMozambique } from '../_openMapMz.js';

export async function onRequestPost(context) {
  const body = await context.request.json().catch(() => ({}));
  const result = await searchPlacesMozambique(body?.query, Number(body?.lat), Number(body?.lng));
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
