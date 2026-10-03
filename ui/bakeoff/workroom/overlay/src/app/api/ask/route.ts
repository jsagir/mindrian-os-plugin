import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, guardRequest } from '../../../server/session';
import { invoke } from '../../../server/slice-actions';

export const dynamic = 'force-dynamic';

// "Ask Claude: does this claim have enough evidence?" The browser click is the
// TRIGGER; the PROPOSAL is made by the agent-exposed proposeDecision action,
// called in-process with the agent principal, and the gate it mints belongs to
// the person's own browser session. No HTTP route maps to proposeDecision
// itself, and the answer to the gate is a separate human call (approveDecision).
export async function POST(request: NextRequest) {
  const guard = guardRequest(request.headers, request.cookies.get(SESSION_COOKIE)?.value);
  if (!guard.ok) return NextResponse.json({ ok: false, reason: guard.reason }, { status: guard.status });
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const result = await invoke('proposeDecision', body, { principal: 'agent', sessionKey: guard.sessionKey });
  return NextResponse.json(result.body, { status: result.status });
}
