import { handleBootstrapRequest, getSessionStore } from '../../../server/auth.ts';
import { getBootstrapStore } from '../../../server/bootstrap.ts';
import { getConfig } from '../../../server/config.ts';

export const dynamic = 'force-dynamic';

// Thin adapter: the chassis's request object in, server/auth.ts handleBootstrapRequest, a Response out.
export function GET(request: Request): Response {
  const url = new URL(request.url);
  const out = handleBootstrapRequest(
    { url: url.pathname + url.search, headers: request.headers, port: getConfig().port },
    { bootstrap: getBootstrapStore(), sessions: getSessionStore() },
  );
  return new Response(out.status === 303 ? null : out.body, { status: out.status, headers: out.headers });
}
