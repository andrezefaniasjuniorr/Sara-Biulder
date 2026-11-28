import { formatFriendlyEdgeError, handleOptions, jsonResponse } from './_saraEdge.js';
import { resolveBuilderV2EdgeKeys, runBuilderV2EdgeStage } from './_builderV2Edge.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const keys = resolveBuilderV2EdgeKeys(request, env);
    const body = await request.json();
    const result = await runBuilderV2EdgeStage(body, keys);
    return jsonResponse(result, 200);
  } catch (err) {
    return jsonResponse(
      { error: formatFriendlyEdgeError(err) },
      err?.status === 503 ? 503 : 500
    );
  }
}
