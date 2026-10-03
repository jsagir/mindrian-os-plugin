import { getShellActions } from '../../../../server/actions.ts';
import { getConfig } from '../../../../server/config.ts';
import { handleFeedChanges } from '../../../../server/feed-routes.ts';
import { apiJson, authorizeApi } from '../../../../server/sessions.ts';

export const dynamic = 'force-dynamic';

// GET /api/feed/changes?collection&after&epoch&limit&mode&cursor: a room_changes page for the session's bound room.
export async function GET(request: Request): Promise<Response> {
  const auth = authorizeApi({ headers: request.headers, port: getConfig().port }, { csrf: false });
  if (!auth.ok) return apiJson(auth.status, { ok: false, reason: auth.reason });
  const out = await handleFeedChanges(new URL(request.url).searchParams, { actions: getShellActions(), browserSession: auth.session });
  return apiJson(out.status, out.body);
}
