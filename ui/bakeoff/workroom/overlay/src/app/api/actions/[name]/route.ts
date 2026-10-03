import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, guardRequest } from '../../../../server/session';
import { invoke } from '../../../../server/slice-actions';

export const dynamic = 'force-dynamic';

// POST only: a GET, PUT or DELETE gets the framework's 405. A request here is
// a browser interaction, so the principal is `human`; an agent-only action
// one is refused 403 no matter what the body says.
export async function POST(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const guard = guardRequest(request.headers, request.cookies.get(SESSION_COOKIE)?.value);
  if (!guard.ok) return NextResponse.json({ ok: false, reason: guard.reason }, { status: guard.status });
  const { name } = await params;
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const result = await invoke(name, body, { principal: 'human', sessionKey: guard.sessionKey });
  return NextResponse.json(result.body, { status: result.status });
}
