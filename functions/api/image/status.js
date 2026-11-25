import { getBackendImageKey, isValidImageCoreKey } from '../_coreImageVault.js';

export async function onRequestGet(context) {
  const current = await getBackendImageKey(context.env);
  return new Response(
    JSON.stringify({
      ok: true,
      available: isValidImageCoreKey(current.imageKey),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
