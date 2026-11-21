import {
  formatFriendlyEdgeError,
  handleOptions,
  jsonResponse,
  resolveEdgeApiKey,
  runJarvisAssistantEdge,
  searchYouTubeTrackEdge,
} from './_saraEdge.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    if (body?.action === 'youtube_search') {
      const track = await searchYouTubeTrackEdge(body?.query || '', body?.kind || 'music');
      return jsonResponse({ track }, 200);
    }

    const apiKey = resolveEdgeApiKey(context.request, context.env);
    if (!apiKey) {
      return jsonResponse({ error: 'Chave Gemini não configurada.' }, 500);
    }

    const result = await runJarvisAssistantEdge(apiKey, body);
    return jsonResponse(result, 200);
  } catch (err) {
    console.error('Erro Cloudflare /api/jarvis:', err);
    return jsonResponse({ error: formatFriendlyEdgeError(err) }, err?.status === 403 ? 403 : 500);
  }
}
