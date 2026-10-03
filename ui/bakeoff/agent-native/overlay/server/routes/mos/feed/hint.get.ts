// Candidate B: feed relay, the wake-up hint (D-18). A Server-Sent Events stream
// of room.changed hints for one room, from the daemon's SSE event plus the
// relay's cursor poll as the safety net. The hint carries no data: the browser
// replica pulls room_changes when it wakes.
import { defineEventHandler, getQuery, setResponseStatus } from "h3";
import { createFeedRelay } from "mos-ui-shared/feed-relay";
import { getDaemonUrl, getPool } from "../../../lib/pool";
import { sessionFromHeaders } from "../../../lib/session";

export default defineEventHandler((event) => {
  const sid = sessionFromHeaders(event.headers);
  if (!sid) {
    setResponseStatus(event, 403);
    return { ok: false, reason: "no_browser_session" };
  }
  const room = String((getQuery(event) as Record<string, unknown>).room || "");
  if (!/^[A-Za-z0-9._-]{1,200}$/.test(room)) {
    setResponseStatus(event, 400);
    return { ok: false, reason: "bad_room" };
  }
  const relay = createFeedRelay({ pool: getPool(), daemonUrl: getDaemonUrl });
  const enc = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let beat: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(": open\n\n"));
      unsubscribe = relay.subscribeHints(sid, room, (hint) => {
        try {
          controller.enqueue(enc.encode("event: hint\ndata: " + JSON.stringify(hint) + "\n\n"));
        } catch (_e) { /* closed */ }
      });
      beat = setInterval(() => {
        try { controller.enqueue(enc.encode(": keep-alive\n\n")); } catch (_e) { /* closed */ }
      }, 15000);
    },
    cancel() {
      unsubscribe();
      if (beat) clearInterval(beat);
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" },
  });
});
