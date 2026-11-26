import {
  getBackendImageKey,
  isValidImageCoreKey,
  maskImageKey,
  setBackendImageKey,
  verifyAdminRequestAuth,
} from '../_coreImageVault.js';

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequestAuth(request.headers.get('authorization'), env);
  if (!auth) {
    return json({ ok: false, code: 'ADMIN_AUTH_REQUIRED', error: 'Acesso restrito ao administrador.' }, 401);
  }
  const current = await getBackendImageKey(env);
  return json({
    ok: true,
    configured: isValidImageCoreKey(current.imageKey),
    maskedKey: maskImageKey(current.imageKey),
    updatedAt: current.updatedAt || null,
    lastError: current.lastError || null,
    lastErrorStatus: current.lastErrorStatus ?? null,
    lastErrorAt: current.lastErrorAt || null,
    lastModel: current.lastModel || null,
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequestAuth(request.headers.get('authorization'), env);
  if (!auth) {
    return json({ ok: false, code: 'ADMIN_AUTH_REQUIRED', error: 'Acesso restrito ao administrador.' }, 401);
  }
  const body = await request.json().catch(() => ({}));
  const key = String(body?.key || '').trim();
  if (!isValidImageCoreKey(key)) {
    return json(
      { ok: false, error: 'Formato inválido. Insere uma Chave de Imagem SARA válida (começa por hf_).' },
      400
    );
  }
  const saved = await setBackendImageKey(key, auth.firebaseToken || undefined);
  return json({ ok: true, ...saved });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequestAuth(request.headers.get('authorization'), env);
  if (!auth) {
    return json({ ok: false, code: 'ADMIN_AUTH_REQUIRED', error: 'Acesso restrito ao administrador.' }, 401);
  }
  const cleared = await setBackendImageKey('', auth.firebaseToken || undefined);
  return json({ ok: true, ...cleared });
}
