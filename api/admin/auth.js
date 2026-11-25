import {
  OWNER_EMAIL,
  mintHmacAdminToken,
  verifyFirebaseOwnerIdToken,
  verifyOwnerPasswordCredentials,
} from '../_coreImageVault.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const firebaseIdToken = String(body?.firebaseIdToken || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (firebaseIdToken) {
    const fbOk = await verifyFirebaseOwnerIdToken(firebaseIdToken);
    if (fbOk) {
      return res.status(200).json({ ok: true, token: mintHmacAdminToken(OWNER_EMAIL) });
    }
  }

  const passwordOk = await verifyOwnerPasswordCredentials(email, password);
  if (!passwordOk) {
    return res.status(401).json({ ok: false, error: 'Credenciais de administrador inválidas.' });
  }

  return res.status(200).json({ ok: true, token: mintHmacAdminToken(OWNER_EMAIL) });
}
