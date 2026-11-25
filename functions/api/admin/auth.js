import {
  OWNER_EMAIL,
  mintHmacAdminToken,
  verifyFirebaseOwnerIdToken,
  verifyOwnerPasswordCredentials,
} from '../_coreImageVault.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const json = (payload, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const body = await request.json().catch(() => ({}));
  const firebaseIdToken = String(body?.firebaseIdToken || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (firebaseIdToken) {
    const fbOk = await verifyFirebaseOwnerIdToken(firebaseIdToken);
    if (fbOk) {
      const token = await mintHmacAdminToken(OWNER_EMAIL, env);
      return json({ ok: true, token }, 200);
    }
  }

  const passwordOk = await verifyOwnerPasswordCredentials(email, password, env);
  if (!passwordOk) {
    return json({ ok: false, error: 'Credenciais de administrador inválidas.' }, 401);
  }

  const token = await mintHmacAdminToken(OWNER_EMAIL, env);
  return json({ ok: true, token }, 200);
}
