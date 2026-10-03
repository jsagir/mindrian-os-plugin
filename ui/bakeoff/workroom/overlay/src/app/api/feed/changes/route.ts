import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, guardRequest } from '../../../../server/session';
import { shared } from '../../../../server/pool';

export const dynamic = 'force-dynamic';

// The browser replica's pull: one room_changes page per request, through the
// feed relay and the session pool. The room is the one this browser session
// opened; the daemon scopes the read to that binding.
export async function POST(request: NextRequest) {
  const guard = guardRequest(request.headers, request.cookies.get(SESSION_COOKIE)?.value);
  if (!guard.ok) return NextResponse.json({ ok: false, reason: guard.reason }, { status: guard.status });
  let q: Record<string, unknown> = {};
  try {
    q = (await request.json()) as Record<string, unknown>;
  } catch {
    q = {};
  }
  const page = await shared().relay.pageChanges(guard.sessionKey, {
    collection: typeof q.collection === 'string' ? q.collection : undefined,
    after: typeof q.after === 'number' || typeof q.after === 'string' ? q.after : undefined,
    epoch: typeof q.epoch === 'string' ? q.epoch : undefined,
    limit: typeof q.limit === 'number' ? q.limit : undefined,
    mode: typeof q.mode === 'string' ? q.mode : undefined,
    snapshot_cursor: typeof q.snapshot_cursor === 'string' ? q.snapshot_cursor : undefined,
  });
  return NextResponse.json(page);
}
