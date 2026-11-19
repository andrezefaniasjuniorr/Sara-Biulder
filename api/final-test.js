import {
  formatFriendlyAiError,
  getGeminiClient,
  readJsonBody,
  runFinalTestAudit,
  setCorsHeaders,
} from './_saraCore.js';

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
    const ai = getGeminiClient(customKey);

    const result = await runFinalTestAudit(ai, body);
    res.status(200).json(result);
  } catch (err) {
    console.error('Erro /api/final-test:', err);
    res.status(err?.status === 403 ? 403 : 500).json({
      error: formatFriendlyAiError(err),
    });
  }
}
