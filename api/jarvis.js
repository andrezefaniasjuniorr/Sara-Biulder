import {
  fetchHudLiveFeedNode,
  formatFriendlyAiError,
  getGeminiClient,
  runJarvisAssistant,
  searchYouTubeTrackNode,
} from './_saraCore.js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    if (req.body?.action === 'youtube_search') {
      const track = await searchYouTubeTrackNode(req.body?.query || '', req.body?.kind || 'music');
      return res.status(200).json({ track });
    }
    if (req.body?.action === 'hud_live_feed') {
      const feed = await fetchHudLiveFeedNode();
      return res.status(200).json(feed);
    }

    const headerKey = req.headers['x-gemini-api-key'];
    const customKey = typeof headerKey === 'string' ? headerKey : undefined;
    const ai = getGeminiClient(customKey);
    const result = await runJarvisAssistant(ai, req.body);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Erro /api/jarvis:', err);
    return res.status(err?.status === 403 ? 403 : 500).json({
      error: formatFriendlyAiError(err),
    });
  }
}
