/*
 * connection-state.ts -- what the Status surface shows about a browser session's MCP link
 * (plan 369-32, SHELL369-05, review rule).
 *
 * One record per browser session (keyed by its MCP pool key): connection, the time of the
 * last acknowledged MCP round trip, the first 8 characters of the MCP session id, the bound
 * room slug and the daemon's contract version. The one rule: "connected" is set only by an
 * acknowledged MCP round trip (recordAck), never by a socket being open, a cookie being
 * valid or a hint arriving. A failed round trip after a connected state reads
 * "reconnecting" (the pool is retrying on the next call); three failures in a row, or a
 * failure before any acknowledgement, read "disconnected".
 *
 * Framework-free erasable TypeScript. The state lives in this server process only.
 */
import { contractVersion } from 'mos-ui-shared/generated/mcp-adapter';

export type Connection = 'connected' | 'reconnecting' | 'disconnected';

export type ConnectionState = {
  connection: Connection;
  lastAckAt: number | null;
  mcpSessionPrefix: string | null;
  roomSlug: string | null;
  version: string | null;
};

export type AckInfo = { mcpSessionId?: string | null; roomSlug?: string | null; version?: string | null };

// Contract default: after this many failed round trips in a row the link reads "disconnected"
// rather than "reconnecting". Three covers a daemon restart (each status poll retries once)
// without leaving a dead daemon on "reconnecting" forever.
export const RECONNECTING_FAILURES = 3;

type Slot = ConnectionState & { failures: number };

function blank(): Slot {
  return { connection: 'disconnected', lastAckAt: null, mcpSessionPrefix: null, roomSlug: null, version: null, failures: 0 };
}

export function createConnectionStates(opts: { now?: () => number } = {}) {
  const now = opts.now ?? (() => Date.now());
  const slots = new Map<string, Slot>();

  function slot(key: string): Slot {
    let s = slots.get(key);
    if (!s) {
      s = blank();
      slots.set(key, s);
    }
    return s;
  }

  return {
    get(key: string): ConnectionState {
      const s = slots.get(key) ?? blank();
      return {
        connection: s.connection,
        lastAckAt: s.lastAckAt,
        mcpSessionPrefix: s.mcpSessionPrefix,
        roomSlug: s.roomSlug,
        version: s.version,
      };
    },
    // An acknowledged MCP round trip: the only way to "connected".
    recordAck(key: string, info: AckInfo = {}): void {
      const s = slot(key);
      s.connection = 'connected';
      s.lastAckAt = now();
      s.failures = 0;
      if (info.mcpSessionId !== undefined) s.mcpSessionPrefix = info.mcpSessionId ? String(info.mcpSessionId).slice(0, 8) : null;
      if (info.roomSlug !== undefined) s.roomSlug = info.roomSlug;
      if (info.version !== undefined && info.version !== null) s.version = info.version;
    },
    recordFailure(key: string): void {
      const s = slot(key);
      s.failures += 1;
      const wasLive = s.lastAckAt !== null;
      s.connection = wasLive && s.failures < RECONNECTING_FAILURES ? 'reconnecting' : 'disconnected';
    },
    forget(key: string): void {
      slots.delete(key);
    },
    size(): number {
      return slots.size;
    },
  };
}

export type ConnectionStates = ReturnType<typeof createConnectionStates>;

const SLOT = Symbol.for('mos.shell.connection');

export function getConnectionStates(): ConnectionStates {
  const g = globalThis as Record<symbol, unknown>;
  if (!g[SLOT]) g[SLOT] = createConnectionStates();
  return g[SLOT] as ConnectionStates;
}

// The shape of the pool this module needs: one call, and a look at the live entry.
export type ProbePool = {
  call: (key: string, tool: string, args?: Record<string, unknown>) => Promise<{ isError: boolean; data: unknown }>;
  get: (key: string) => Promise<{ mcpSessionId: string | undefined; boundRoom: string | null }>;
};

// The honest round trip behind GET /api/status: ask the daemon for its contract version through
// this browser session's own MCP session. An answer (even one the daemon marks as an error) is an
// acknowledged round trip; a throw (refused connection, dead daemon after a failed reconnect) is not.
export async function probeConnection(pool: ProbePool, states: ConnectionStates, key: string): Promise<ConnectionState> {
  try {
    const res = await contractVersion((tool, args) => pool.call(key, tool, args), {});
    const answer = res as { isError: boolean; data: unknown };
    if (answer.isError) {
      states.recordFailure(key);
    } else {
      const entry = await pool.get(key);
      const data = answer.data as { version?: unknown } | null;
      states.recordAck(key, {
        mcpSessionId: entry.mcpSessionId ?? null,
        roomSlug: entry.boundRoom,
        version: data && typeof data.version === 'string' ? data.version : null,
      });
    }
  } catch {
    states.recordFailure(key);
  }
  return states.get(key);
}
