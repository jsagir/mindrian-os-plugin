import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, guardRequest } from '../../../../server/session';
import { shared } from '../../../../server/pool';

export const dynamic = 'force-dynamic';

// room.changed hints for the room this session opened, relayed as SSE. A hint
// only says "pull now": the replica reads the durable feed itself. The relay
// also polls room_changes as a safety net, so a missed daemon event still wakes
// the page.
export async function GET(request: NextRequest) {
  const guard = guardRequest(request.headers, request.cookies.get(SESSION_COOKIE)?.value);
  if (!guard.ok) return NextResponse.json({ ok: false, reason: guard.reason }, { status: guard.status });
  const open = shared().openRooms.get(guard.sessionKey);
  const room = request.nextUrl.searchParams.get('room') || '';
  if (!open || !room) return NextResponse.json({ ok: false, reason: 'no_open_room' }, { status: 409 });

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let keepalive: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('retry: 1000\n\n'));
      unsubscribe = shared().relay.subscribeHints(guard.sessionKey, room, (hint) => {
        try {
          controller.enqueue(encoder.encode('event: hint\ndata: ' + JSON.stringify({ latestSeq: hint.latestSeq, source: hint.source }) + '\n\n'));
        } catch {
          /* the browser went away */
        }
      });
      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          /* closed */
        }
      }, 15000);
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        if (keepalive) clearInterval(keepalive);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      unsubscribe();
      if (keepalive) clearInterval(keepalive);
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store, no-transform', connection: 'keep-alive' },
  });
}
