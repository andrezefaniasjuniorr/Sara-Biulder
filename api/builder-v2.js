import { formatFriendlyAiError, readJsonBody, setCorsHeaders } from './_saraCore.js';
import { runBuilderV2Stage } from './_builderV2.js';

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido. Usa POST.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const headerKey = req.headers?.['x-gemini-api-key'];
    const customKey = typeof headerKey === 'string' ? headerKey : undefined;
    const result = await runBuilderV2Stage(body, customKey);
    res.status(200).json(result);
  } catch (err) {
    console.error('Erro /api/builder-v2:', err);
    res.status(err?.status === 503 ? 503 : 500).json({
      error: formatFriendlyAiError(err),
    });
  }
}
