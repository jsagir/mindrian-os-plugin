import { getBootstrapStore } from '../../../server/bootstrap.ts';
import { getConfig } from '../../../server/config.ts';
import { getControl, handleControlBootstrap } from '../../../server/control.ts';

export const dynamic = 'force-dynamic';

// Thin adapter for POST /control/bootstrap: the launcher arms a fresh sha256 for a running server.
export async function POST(request: Request): Promise<Response> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  const bodyText = declared > 1024 ? 'x'.repeat(1025) : await request.text();
  const out = handleControlBootstrap(
    { headers: request.headers, port: getConfig().port, bodyText },
    { token: getControl()?.token ?? null, bootstrap: getBootstrapStore() },
  );
  return Response.json(out.body, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
}
