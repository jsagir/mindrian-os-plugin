import { actionStatus, getShellActions, parseActionBody } from '../../../../server/actions.ts';
import { getConfig } from '../../../../server/config.ts';
import { apiJson, authorizeApi } from '../../../../server/sessions.ts';

export const dynamic = 'force-dynamic';

// POST /api/actions/<name>: the only HTTP entry to the shell actions (registered by createShellActions).
// Order is fixed: plan 19's origin guard, the session cookie, the CSRF token, and only then does it look
// up an action. The principal is 'human' here because this route IS the browser; nothing in the body can
// change it, and there is no route for the generated MCP adapter.
export async function POST(request: Request, context: { params: Promise<{ name: string }> }): Promise<Response> {
  const auth = authorizeApi({ headers: request.headers, port: getConfig().port }, { csrf: true });
  if (!auth.ok) return apiJson(auth.status, { ok: false, reason: auth.reason });
  const { name } = await context.params;
  const parsed = parseActionBody(await request.text());
  if (!parsed.ok) return apiJson(parsed.status, parsed.body);
  const answer = await getShellActions().invoke(name, parsed.input, { principal: 'human', browserSession: auth.session });
  return apiJson(actionStatus(answer), answer);
}
