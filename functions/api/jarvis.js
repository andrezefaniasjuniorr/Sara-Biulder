import {
  fetchHudLiveFeedEdge,
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
    if (body?.action === 'hud_live_feed') {
      const feed = await fetchHudLiveFeedEdge();
      return jsonResponse(feed, 200);
    }

    const apiKey = resolveEdgeApiKey(context.request, context.env);
    const isOwner = Boolean(body?.userIdentity?.isOwner);
    if (!apiKey) {
      return jsonResponse(
        {
          error: isOwner
            ? 'Chave Gemini não configurada.'
            : 'Estou a ajustar o sistema em segundo plano. Tenta novamente em instantes.',
        },
        500
      );
    }

    const result = await runJarvisAssistantEdge(apiKey, body);
    return jsonResponse(result, 200);
  } catch (err) {
    console.error('Erro Cloudflare /api/jarvis:', err);
    return jsonResponse({ error: formatFriendlyEdgeError(err, false) }, err?.status === 403 ? 403 : 500);
  }
}
