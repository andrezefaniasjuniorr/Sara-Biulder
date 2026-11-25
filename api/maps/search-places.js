import { searchPlacesMozambique } from '../_openMapMz.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ results: [] });
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const result = await searchPlacesMozambique(body?.query, Number(body?.lat), Number(body?.lng));
  return res.status(200).json(result);
}
