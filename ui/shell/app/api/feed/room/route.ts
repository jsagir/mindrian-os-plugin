import { getShellActions } from '../../../../server/actions.ts';
import { getConfig } from '../../../../server/config.ts';
import { handleFeedRoom } from '../../../../server/feed-routes.ts';
import { apiJson, authorizeApi } from '../../../../server/sessions.ts';

export const dynamic = 'force-dynamic';

// GET /api/feed/room: the room document as a one-document page with checkpoint { epoch, seq }.
export async function GET(request: Request): Promise<Response> {
  const auth = authorizeApi({ headers: request.headers, port: getConfig().port }, { csrf: false });
  if (!auth.ok) return apiJson(auth.status, { ok: false, reason: auth.reason });
  const out = await handleFeedRoom({ actions: getShellActions(), browserSession: auth.session });
  return apiJson(out.status, out.body);
}
