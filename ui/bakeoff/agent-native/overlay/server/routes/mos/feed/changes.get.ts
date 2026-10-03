// Candidate B: feed relay, the changes page (D-18). Relays one room_changes
// page through the pool on the caller's browser session. The only room door is
// the shared pool; this route holds no file-system access and no outside host.
import { defineEventHandler, getQuery, setResponseStatus } from "h3";
import { createFeedRelay } from "mos-ui-shared/feed-relay";
import { getDaemonUrl, getPool } from "../../../lib/pool";
import { sessionFromHeaders } from "../../../lib/session";

const COLLECTIONS = ["room", "nodes", "relations", "artifacts", "decisions", "activity"];

export default defineEventHandler(async (event) => {
  const sid = sessionFromHeaders(event.headers);
  if (!sid) {
    setResponseStatus(event, 403);
    return { ok: false, reason: "no_browser_session" };
  }
  const q = getQuery(event) as Record<string, string | undefined>;
  const collection = q.collection || "";
  if (!COLLECTIONS.includes(collection)) {
    setResponseStatus(event, 400);
    return { ok: false, reason: "bad_collection" };
  }
  // The shell composes the `room` collection itself (plan 13): nothing in the
  // feed serves it, so it answers an empty page.
  if (collection === "room") return { ok: true, changes: [] };
  const relay = createFeedRelay({ pool: getPool(), daemonUrl: getDaemonUrl });
  const query: Record<string, unknown> = { collection };
  if (q.after !== undefined && q.after !== "") query.after = Number(q.after);
  if (q.epoch) query.epoch = q.epoch;
  if (q.limit) query.limit = Math.min(500, Math.max(1, Number(q.limit) || 200));
  if (q.mode === "snapshot" || q.mode === "delta") query.mode = q.mode;
  if (q.snapshot_cursor) query.snapshot_cursor = q.snapshot_cursor;
  return relay.pageChanges(sid, query);
});
