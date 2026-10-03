import { getConfig } from '../../../server/config.ts';
import { handleStatus } from '../../../server/feed-routes.ts';
import { apiJson, authorizeApi, getPool } from '../../../server/sessions.ts';

export const dynamic = 'force-dynamic';

// GET /api/status: the connection state; "connected" only after an acknowledged MCP round trip.
export async function GET(request: Request): Promise<Response> {
  const auth = authorizeApi({ headers: request.headers, port: getConfig().port }, { csrf: false });
  if (!auth.ok) return apiJson(auth.status, { ok: false, reason: auth.reason });
  const out = await handleStatus({ pool: getPool(), browserSession: auth.session });
  return apiJson(out.status, out.body);
}
