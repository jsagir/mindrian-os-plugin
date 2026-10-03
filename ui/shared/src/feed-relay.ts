/*
 * feed-relay.ts -- how the shell learns that a room changed (Phase 369 D-18).
 *
 * The room's durable feed is the room_changes MCP read surface; the daemon's
 * room.changed SSE event is only a HINT. Two wake-up paths feed the same
 * subscriber:
 *   (a) the SSE hint (fast path): GET <daemon>/event, read with fetch and a
 *       body stream (Node 22 has no global EventSource unflagged), emit when a
 *       room.changed frame names this room;
 *   (b) a cursor poll (safety net): every pollMs call room_changes with
 *       limit 1 and emit when latest_seq advanced. CLI hooks and scripts write
 *       room.db outside the daemon, hints can be missed, and the daemon can
 *       restart, so the in-process bus alone is never the net.
 *
 * Erasable TypeScript only. URL literals: loopback forms only (Canon Part 8).
 */
import type { createSessionPool } from './mcp-session-pool.ts';

type Pool = ReturnType<typeof createSessionPool>;

export type SseFrame = { event: string; data: string };

// Pure: split a chunk of an SSE stream into complete frames. A trailing partial
// frame comes back as `carry` to be prefixed onto the next chunk.
export function parseSseFrames(chunkText: string, carry?: string): { frames: SseFrame[]; carry: string } {
  const text = (carry || '') + chunkText.replace(/\r\n/g, '\n');
  const parts = text.split('\n\n');
  const rest = parts.pop() as string;
  const frames: SseFrame[] = [];
  for (const block of parts) {
    if (block.trim().length === 0) continue;
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    frames.push({ event, data: data.join('\n') });
  }
  return { frames, carry: rest };
}

export type Hint = { roomId: string; latestSeq: number | null; source: 'sse' | 'poll' };

export type ChangesQuery = {
  after?: number | string;
  epoch?: string;
  limit?: number;
  mode?: string;
  snapshot_cursor?: string;
};

export type FeedRelayOptions = {
  pool: Pool;
  daemonUrl: string | (() => string);
  pollMs?: number;
  // Test seams; default to the real thing.
  fetchImpl?: typeof fetch;
  backoffStartMs?: number;
  backoffMaxMs?: number;
};

const FEED_TOOL_MISSING_RE = /unknown tool|tool .*not found|not found|method not found|-32601|-32602|no such tool/i;

export function createFeedRelay(options: FeedRelayOptions) {
  const pool = options.pool;
  // Contract default: a safety-net poll only. The SSE hint is the fast path
  // and the daemon watcher behind it polls every 500 ms with fs.watch firing
  // first in 632 of 633 scans (spike 006), so this exists for missed hints and
  // daemon restarts; plan 23 measures the resulting catch-up times.
  const pollMs = typeof options.pollMs === 'number' ? options.pollMs : 2000;
  // Contract default: 1 s start matches the EventSource retry that dominated
  // spike 006 P5's 1.0-1.4 s convergence; the 15 s cap bounds a long daemon
  // outage to one reconnect attempt per 15 s while the poll keeps the copy
  // current.
  const backoffStart = typeof options.backoffStartMs === 'number' ? options.backoffStartMs : 1000;
  const backoffMax = typeof options.backoffMaxMs === 'number' ? options.backoffMaxMs : 15000;
  const doFetch = options.fetchImpl || fetch;

  function baseUrl(): string {
    return typeof options.daemonUrl === 'function' ? options.daemonUrl() : options.daemonUrl;
  }

  async function pageChanges(sessionKey: string, query: ChangesQuery): Promise<Record<string, unknown>> {
    const args: Record<string, unknown> = {};
    for (const k of ['after', 'epoch', 'limit', 'mode', 'snapshot_cursor'] as const) {
      if (query && query[k] !== undefined) args[k] = query[k];
    }
    try {
      const res = await pool.call(sessionKey, 'room_changes', args);
      if (res.isError && FEED_TOOL_MISSING_RE.test(res.text)) return { ok: false, reason: 'feed_unavailable' };
      if (res.isError) return { ok: false, reason: 'feed_error', detail: res.text };
      const d = res.data;
      if (d && typeof d === 'object') return d as Record<string, unknown>;
      return { ok: false, reason: 'feed_error', detail: res.text };
    } catch (err) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : String(err);
      if (FEED_TOOL_MISSING_RE.test(msg)) return { ok: false, reason: 'feed_unavailable' };
      return { ok: false, reason: 'feed_error', detail: msg };
    }
  }

  function subscribeHints(sessionKey: string, roomId: string, onHint: (hint: Hint) => void): () => void {
    let stopped = false;
    let lastSeq: number | null = null;
    let abort: AbortController | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let backoff = backoffStart;

    function emit(hint: Hint): void {
      if (stopped) return;
      try { onHint(hint); } catch (_e) { /* a subscriber error never kills the relay */ }
    }

    async function readStream(): Promise<void> {
      abort = new AbortController();
      const res = await doFetch(baseUrl() + '/event', { signal: abort.signal, headers: { accept: 'text/event-stream' } });
      if (!res.ok || !res.body) throw new Error('event stream refused: ' + res.status);
      backoff = backoffStart;
      const decoder = new TextDecoder();
      let carry = '';
      const reader = res.body.getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        const parsed = parseSseFrames(decoder.decode(value, { stream: true }), carry);
        carry = parsed.carry;
        for (const f of parsed.frames) {
          if (f.event !== 'room.changed') continue;
          let payload: { roomId?: string; latestSeq?: number } | null = null;
          try { payload = JSON.parse(f.data); } catch (_e) { payload = null; }
          if (!payload || payload.roomId !== roomId) continue;
          const seq = typeof payload.latestSeq === 'number' ? payload.latestSeq : null;
          if (seq !== null) lastSeq = seq;
          emit({ roomId, latestSeq: seq, source: 'sse' });
        }
      }
    }

    function scheduleReconnect(): void {
      if (stopped) return;
      const wait = backoff;
      backoff = Math.min(backoff * 2, backoffMax);
      reconnectTimer = setTimeout(loop, wait);
    }

    function loop(): void {
      if (stopped) return;
      readStream().then(scheduleReconnect, (err) => {
        if (stopped || (err && (err as Error).name === 'AbortError')) return;
        scheduleReconnect();
      });
    }

    async function pollOnce(): Promise<void> {
      if (stopped) return;
      const r = await pageChanges(sessionKey, { limit: 1 });
      const latest = r && typeof r.latest_seq === 'number' ? (r.latest_seq as number) : null;
      if (latest === null) return;
      if (lastSeq !== null && latest > lastSeq) {
        lastSeq = latest;
        emit({ roomId, latestSeq: latest, source: 'poll' });
      } else if (lastSeq === null) {
        lastSeq = latest;
      }
    }

    loop();
    pollTimer = setInterval(() => {
      pollOnce().catch(() => { /* the next tick tries again */ });
    }, pollMs);

    return function unsubscribe(): void {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (abort) abort.abort();
    };
  }

  return { pageChanges, subscribeHints };
}
