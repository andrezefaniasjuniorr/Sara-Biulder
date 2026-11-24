import {
  fetchHudLiveFeedEdge,
  formatFriendlyEdgeError,
  handleOptions,
  jsonResponse,
  resolveEdgeApiKeys,
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

    const apiKeys = resolveEdgeApiKeys(context.request, context.env);
    const isOwner = Boolean(body?.userIdentity?.isOwner);
    const result = await runJarvisAssistantEdge(apiKeys, body);
    return jsonResponse(result, 200);
  } catch (err) {
    return jsonResponse({ error: formatFriendlyEdgeError(err, false) }, err?.status === 503 ? 503 : 500);
  }
}
