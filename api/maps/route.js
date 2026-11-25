import { computeRouteMozambique } from '../_openMapMz.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false });
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { status, payload } = await computeRouteMozambique(body?.origin, body?.destination);
  return res.status(status).json(payload);
}
