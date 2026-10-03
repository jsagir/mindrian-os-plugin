import { getConfig } from '../../../../server/config.ts';
import { getRelay, openHintStream } from '../../../../server/feed-routes.ts';
import { apiJson, authorizeApi, getPool } from '../../../../server/sessions.ts';

export const dynamic = 'force-dynamic';

// GET /api/feed/hint: an SSE stream of room.changed hints (roomId and latestSeq only) for the session's bound room.
export async function GET(request: Request): Promise<Response> {
  const auth = authorizeApi({ headers: request.headers, port: getConfig().port }, { csrf: false });
  if (!auth.ok) return apiJson(auth.status, { ok: false, reason: auth.reason });
  const opened = await openHintStream({ pool: getPool(), relay: getRelay(), browserSession: auth.session, signal: request.signal });
  if (!opened.ok) return apiJson(opened.status, opened.body);
  // no-transform keeps the runtime's compression from buffering the stream.
  return new Response(opened.stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Content-Type-Options': 'nosniff',
      Connection: 'keep-alive',
    },
  });
}
