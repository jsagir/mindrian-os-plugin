/*
 * feed-routes.ts -- the feed relay endpoints and the status endpoint (plan 369-32, SHELL369-05, D-18).
 *
 *   GET /api/feed/changes   room_changes pages for the session's bound room (through feedChanges)
 *   GET /api/feed/hint      SSE: room.changed hints for the session's bound room, heartbeat every 15 s
 *   GET /api/feed/room      the room document as a one-document page with checkpoint { epoch, seq }
 *   GET /api/status         the connection state, set only by an acknowledged MCP round trip
 *
 * Plan 369-19's guards run first in the route glue (authorizeApi: origin guard, then the session
 * cookie). Everything here reads the bound room of THAT browser session through ITS OWN MCP
 * session, so a request can never see another room or another session's room (T-369-32-05).
 * The feed relay (ui/shared createFeedRelay) is the one place a daemon hint or poll becomes a
 * shell hint; the hint carries only roomId and latestSeq, never room content.
 *
 * Framework-free erasable TypeScript: the route glue hands in plain values and turns the answers
 * into Responses.
 */
import { createFeedRelay } from 'mos-ui-shared/feed-relay';
import type { ShellActions } from './actions.ts';
import { getConfig } from './config.ts';
import { getConnectionStates, probeConnection } from './connection-state.ts';
import type { ConnectionStates } from './connection-state.ts';
import { ensureBound, getPool, sessionFor } from './sessions.ts';
import type { Pool } from './sessions.ts';

export type Relay = ReturnType<typeof createFeedRelay>;
export type FeedAnswer = { status: number; body: Record<string, unknown> };

const RELAY_SLOT = Symbol.for('mos.shell.relay');

export function makeRelay(pool: Pool, daemonUrl: string | (() => string)): Relay {
  return createFeedRelay({ pool, daemonUrl });
}

export function getRelay(): Relay {
  const g = globalThis as Record<symbol, unknown>;
  if (!g[RELAY_SLOT]) g[RELAY_SLOT] = makeRelay(getPool(), () => getConfig().daemonUrl);
  return g[RELAY_SLOT] as Relay;
}

// Contract default: a comment line every 15 s keeps an idle loopback connection from being reaped
// by the runtime or a proxy while costing one short line per interval.
export const HEARTBEAT_MS = 15000;

type Human = { principal: 'human'; browserSession: { mcpKey: string } };

function human(browserSession: { mcpKey: string }): Human {
  return { principal: 'human', browserSession };
}

function statusFor(answer: Record<string, unknown>): number {
  if (answer.ok !== false) return 200;
  switch (answer.reason) {
    case 'room_unbound':
      return 409;
    case 'bad_input':
      return 400;
    case 'feed_unavailable':
      return 503;
    case 'mcp_unavailable':
      return 502;
    default:
      // Resets (epoch_changed, checkpoint_expired) and other answers are data the replica reads, not HTTP errors.
      return 200;
  }
}

// ?collection&after&epoch&limit&mode&cursor -> the feedChanges input. Unknown parameters are ignored.
export function parseChangesQuery(params: URLSearchParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const collection = params.get('collection');
  if (collection !== null) out.collection = collection;
  const after = params.get('after');
  if (after !== null && after !== '') out.after = after === 'null' ? null : /^\d+$/.test(after) ? Number(after) : after;
  const epoch = params.get('epoch');
  if (epoch !== null && epoch !== '') out.epoch = epoch === 'null' ? null : epoch;
  const limit = params.get('limit');
  if (limit !== null && limit !== '') out.limit = /^\d+$/.test(limit) ? Number(limit) : limit;
  const mode = params.get('mode');
  if (mode !== null && mode !== '') out.mode = mode;
  const cursor = params.get('cursor');
  if (cursor !== null && cursor !== '') out.snapshot_cursor = cursor;
  return out;
}

export async function handleFeedChanges(
  params: URLSearchParams,
  deps: { actions: ShellActions; browserSession: { mcpKey: string } },
): Promise<FeedAnswer> {
  const answer = await deps.actions.invoke('feedChanges', parseChangesQuery(params), human(deps.browserSession));
  return { status: statusFor(answer), body: answer };
}

// The room document as the replica's `room` collection reads it: one change row, id "room", at the
// room's latest seq, with the checkpoint named explicitly as { epoch, seq }.
export async function handleFeedRoom(deps: { actions: ShellActions; browserSession: { mcpKey: string } }): Promise<FeedAnswer> {
  const ctx = human(deps.browserSession);
  const doc = await deps.actions.invoke('roomDoc', {}, ctx);
  if (doc.ok === false) return { status: statusFor(doc), body: doc };
  // The head (epoch and latest seq) comes from a one-row SNAPSHOT page, not a delta page: a delta read from
  // seq 0 answers checkpoint_expired once the change log has been compacted (floor above 0), which would make
  // the room document itself unreadable exactly when a browser copy has to rebuild. A snapshot page never
  // consults the floor and carries the epoch and as_of_seq (the log's latest seq) in every case.
  const head = await deps.actions.invoke('feedChanges', { collection: 'nodes', mode: 'snapshot', limit: 1 }, ctx);
  if (head.ok === false) return { status: statusFor(head), body: head };
  const room = doc.room as Record<string, unknown>;
  const epoch = typeof head.epoch === 'string' ? head.epoch : null;
  const seq = typeof head.as_of_seq === 'number' ? head.as_of_seq : 0;
  const row = {
    seq,
    entity_type: 'room',
    entity_id: 'room',
    op: 'upsert',
    revision: seq,
    doc: { id: 'room', question: room.question, purpose: room.purpose, counts: room.counts },
  };
  return {
    status: 200,
    body: {
      ok: true,
      room: room.slug,
      epoch,
      through: seq,
      latest_seq: seq,
      checkpoint: { epoch, seq },
      changes: [row],
      documents: [row.doc],
    },
  };
}

export async function handleStatus(deps: {
  pool: Pool;
  states?: ConnectionStates;
  browserSession: { mcpKey: string };
}): Promise<FeedAnswer> {
  const key = sessionFor(deps.browserSession);
  const states = deps.states ?? getConnectionStates();
  try {
    await ensureBound(deps.pool, key);
  } catch {
    /* an unreachable daemon is reported by the probe below */
  }
  const state = await probeConnection(deps.pool, states, key);
  return { status: 200, body: { ok: true, ...state } };
}

function frame(event: string, data: unknown): string {
  return 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
}

// The SSE body for GET /api/feed/hint. Returns a refusal when the browser session has no bound room.
export async function openHintStream(deps: {
  pool: Pool;
  relay: Relay;
  browserSession: { mcpKey: string };
  signal?: AbortSignal;
  heartbeatMs?: number;
}): Promise<{ ok: true; stream: ReadableStream<Uint8Array> } | { ok: false; status: number; body: Record<string, unknown> }> {
  const key = sessionFor(deps.browserSession);
  let room: string | null;
  try {
    await ensureBound(deps.pool, key);
    room = (await deps.pool.get(key)).boundRoom;
  } catch {
    return { ok: false, status: 502, body: { ok: false, reason: 'mcp_unavailable' } };
  }
  if (!room) return { ok: false, status: 409, body: { ok: false, reason: 'room_unbound' } };
  const roomSlug: string = room;

  const encoder = new TextEncoder();
  const heartbeatMs = deps.heartbeatMs ?? HEARTBEAT_MS;
  let unsubscribe: (() => void) | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  function cleanup(): void {
    if (closed) return;
    closed = true;
    if (unsubscribe) unsubscribe();
    if (timer) clearInterval(timer);
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup();
        }
      };
      // An opening comment flushes the response headers to the browser at once.
      send(': connected\n\n');
      unsubscribe = deps.relay.subscribeHints(key, roomSlug, (hint) => {
        send(frame('room.changed', { roomId: hint.roomId, latestSeq: hint.latestSeq }));
      });
      timer = setInterval(() => send(': heartbeat\n\n'), heartbeatMs);
      if (typeof timer === 'object' && timer && 'unref' in timer) (timer as { unref: () => void }).unref();
      if (deps.signal) {
        if (deps.signal.aborted) {
          cleanup();
          controller.close();
        } else {
          deps.signal.addEventListener(
            'abort',
            () => {
              cleanup();
              try {
                controller.close();
              } catch {
                /* already closed */
              }
            },
            { once: true },
          );
        }
      }
    },
    cancel() {
      cleanup();
    },
  });
  return { ok: true, stream };
}
