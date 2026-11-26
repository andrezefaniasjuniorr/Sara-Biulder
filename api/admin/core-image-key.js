import {
  getBackendImageKey,
  isValidImageCoreKey,
  maskImageKey,
  setBackendImageKey,
  verifyAdminRequestAuth,
} from '../_coreImageVault.js';

export default async function handler(req, res) {
  const auth = await verifyAdminRequestAuth(req.headers.authorization);
  if (!auth) {
    return res.status(401).json({ ok: false, code: 'ADMIN_AUTH_REQUIRED', error: 'Acesso restrito ao administrador.' });
  }

  if (req.method === 'GET') {
    const current = await getBackendImageKey();
    return res.status(200).json({
      ok: true,
      configured: isValidImageCoreKey(current.imageKey),
      maskedKey: maskImageKey(current.imageKey),
      updatedAt: current.updatedAt || null,
      lastError: current.lastError || null,
      lastErrorStatus: current.lastErrorStatus ?? null,
      lastErrorAt: current.lastErrorAt || null,
    });
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const key = String(body?.key || '').trim();
    if (!isValidImageCoreKey(key)) {
      return res.status(400).json({
        ok: false,
        error: 'Formato inválido. Insere uma Chave de Imagem SARA válida (começa por hf_).',
      });
    }
    const saved = await setBackendImageKey(key, auth.firebaseToken || undefined);
    return res.status(200).json({ ok: true, ...saved });
  }

  if (req.method === 'DELETE') {
    const cleared = await setBackendImageKey('', auth.firebaseToken || undefined);
    return res.status(200).json({ ok: true, ...cleared });
  }

  return res.status(405).json({ ok: false, error: 'Método não permitido.' });
}
