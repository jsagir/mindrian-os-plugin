/*
 * mcp-session-pool.ts -- the shell's only door to room data (Phase 369 D-19).
 *
 * One MCP client per browser session key, over Streamable HTTP, on the LEGACY
 * sessionful leg. The mode is set explicitly: the daemon keys room binding and
 * gate ownership on the transport-minted session id, and a client that
 * negotiates the 2026-era leg lands on the stateless handler where that id does
 * not exist. An SDK default change must never move the shell there silently.
 *
 *   get(sessionKey)               lazily connect, return the pool entry
 *   bind(sessionKey, roomSlug)    room_bind; boundRoom is recorded only when
 *                                 the daemon says the binding is effective
 *   call(sessionKey, tool, args)  call a tool; on a dead session (daemon
 *                                 restart, idle expiry) close, reconnect,
 *                                 re-bind boundRoom and retry once, reporting
 *                                 reconnected: true (gate ids minted on the old
 *                                 session are gone and the caller must know)
 *   adapterSession()              the Claude adapter's OWN session, under a
 *                                 reserved key get() refuses: the adapter never
 *                                 rides the human's session (D-14, D-15)
 *   sweepIdle()                   close entries idle past idleMs
 *   closeAll()
 *
 * Erasable TypeScript only: no enum, no namespace, no parameter properties.
 * The core is a client of the daemon: it never opens room.db and never
 * requires anything under lib/ (Canon Part 8, MCP-only access).
 */
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

export const ADAPTER_SESSION_KEY = '__claude_adapter_session__';

// Contract default: the idle window the spike 007 bridge used, matching plan
// 19's browser-session idle expiry so an MCP session never outlives the
// browser session it serves (RESEARCH Security Domain V3).
const DEFAULT_IDLE_MS = 30 * 60 * 1000;

export type PoolEntry = {
  client: Client;
  transport: StreamableHTTPClientTransport;
  mcpSessionId: string | undefined;
  boundRoom: string | null;
  lastUsed: number;
};

export type CallResult = {
  ok: boolean;
  isError: boolean;
  data: unknown;
  text: string;
  reconnected: boolean;
};

export type SessionPoolOptions = {
  daemonUrl: string | (() => string);
  clientName?: string;
  clientVersion?: string;
  idleMs?: number;
};

// A dead session shows up as an HTTP 400 "No valid session ID", a closed
// transport, or a refused connection while the daemon restarts.
const DEAD_SESSION_RE =
  /no valid session id|session not found|bad request|transport (is )?closed|not connected|connection closed|fetch failed|econnrefused|econnreset|socket hang up|terminated/i;

export function isDeadSessionError(err: unknown): boolean {
  const msg = err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : String(err);
  const status = err && typeof err === 'object' && 'code' in err ? Number((err as { code?: unknown }).code) : NaN;
  return status === 400 || DEAD_SESSION_RE.test(msg);
}

// Tool results are text blocks; room_bind appends a "## Suggested Next" block
// after the JSON payload, so parse the leading JSON.
export function parseToolText(result: unknown): { text: string; data: unknown } {
  const r = result as { content?: Array<{ type?: string; text?: string }> } | null;
  const first = r && Array.isArray(r.content) ? r.content[0] : undefined;
  const text = first && typeof first.text === 'string' ? first.text : '';
  const marker = text.indexOf('\n\n## Suggested Next');
  const head = marker === -1 ? text : text.slice(0, marker);
  try {
    return { text, data: JSON.parse(head) };
  } catch (_e) {
    return { text, data: null };
  }
}

export function createSessionPool(options: SessionPoolOptions) {
  const clientName = options.clientName || 'mindrian-shell';
  const clientVersion = options.clientVersion || '1.0.0';
  const idleMs = typeof options.idleMs === 'number' ? options.idleMs : DEFAULT_IDLE_MS;
  const entries = new Map<string, PoolEntry>();
  const connecting = new Map<string, Promise<PoolEntry>>();

  function baseUrl(): string {
    return typeof options.daemonUrl === 'function' ? options.daemonUrl() : options.daemonUrl;
  }

  async function connect(): Promise<PoolEntry> {
    const transport = new StreamableHTTPClientTransport(new URL(baseUrl() + '/mcp'));
    const client = new Client(
      { name: clientName, version: clientVersion },
      { capabilities: {}, versionNegotiation: { mode: 'legacy' } },
    );
    await client.connect(transport);
    return { client, transport, mcpSessionId: transport.sessionId, boundRoom: null, lastUsed: Date.now() };
  }

  async function open(key: string): Promise<PoolEntry> {
    const existing = entries.get(key);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing;
    }
    const pending = connecting.get(key);
    if (pending) return pending;
    const p = connect().then(
      (entry) => {
        entries.set(key, entry);
        connecting.delete(key);
        return entry;
      },
      (err) => {
        connecting.delete(key);
        throw err;
      },
    );
    connecting.set(key, p);
    return p;
  }

  async function closeEntry(entry: PoolEntry): Promise<void> {
    try { await entry.transport.terminateSession(); } catch (_e) { /* best effort */ }
    try { await entry.client.close(); } catch (_e) { /* best effort */ }
  }

  async function drop(key: string): Promise<string | null> {
    const entry = entries.get(key);
    entries.delete(key);
    if (!entry) return null;
    await closeEntry(entry);
    return entry.boundRoom;
  }

  async function rawCall(entry: PoolEntry, tool: string, args: Record<string, unknown>) {
    entry.lastUsed = Date.now();
    return entry.client.callTool({ name: tool, arguments: args });
  }

  function shape(result: unknown, reconnected: boolean): CallResult {
    const parsed = parseToolText(result);
    const isError = !!(result && typeof result === 'object' && (result as { isError?: boolean }).isError);
    return { ok: !isError, isError, data: parsed.data, text: parsed.text, reconnected };
  }

  async function bindEntry(entry: PoolEntry, roomSlug: string): Promise<CallResult> {
    const raw = await rawCall(entry, 'room_bind', { room: roomSlug });
    const res = shape(raw, false);
    const d = res.data as { effective?: boolean } | null;
    if (!res.isError && d && d.effective === true) entry.boundRoom = roomSlug;
    return res;
  }

  async function callOn(key: string, tool: string, args: Record<string, unknown>): Promise<CallResult> {
    let entry = await open(key);
    try {
      return shape(await rawCall(entry, tool, args), false);
    } catch (err) {
      if (!isDeadSessionError(err)) throw err;
      // Dead session: close it, connect afresh, re-bind, retry once.
      const room = await drop(key);
      entry = await open(key);
      if (room) await bindEntry(entry, room);
      return shape(await rawCall(entry, tool, args), true);
    }
  }

  async function getEntry(sessionKey: string): Promise<PoolEntry> {
    if (sessionKey === ADAPTER_SESSION_KEY) throw new Error('reserved session key: use adapterSession()');
    if (typeof sessionKey !== 'string' || sessionKey.length === 0) throw new Error('sessionKey is required');
    return open(sessionKey);
  }

  return {
    get: getEntry,
    async bind(sessionKey: string, roomSlug: string): Promise<CallResult> {
      const entry = await getEntry(sessionKey);
      try {
        return await bindEntry(entry, roomSlug);
      } catch (err) {
        if (!isDeadSessionError(err)) throw err;
        await drop(sessionKey);
        const fresh = await open(sessionKey);
        const res = await bindEntry(fresh, roomSlug);
        res.reconnected = true;
        return res;
      }
    },
    async call(sessionKey: string, tool: string, args?: Record<string, unknown>): Promise<CallResult> {
      if (sessionKey === ADAPTER_SESSION_KEY) throw new Error('reserved session key: use adapterSession()');
      return callOn(sessionKey, tool, args || {});
    },
    async adapterSession(): Promise<PoolEntry> {
      return open(ADAPTER_SESSION_KEY);
    },
    async adapterCall(tool: string, args?: Record<string, unknown>): Promise<CallResult> {
      return callOn(ADAPTER_SESSION_KEY, tool, args || {});
    },
    async sweepIdle(now?: number): Promise<number> {
      const t = typeof now === 'number' ? now : Date.now();
      let closed = 0;
      for (const [key, entry] of Array.from(entries.entries())) {
        if (t - entry.lastUsed > idleMs) {
          await drop(key);
          closed += 1;
        }
      }
      return closed;
    },
    size(): number {
      return entries.size;
    },
    async closeAll(): Promise<void> {
      const keys = Array.from(entries.keys());
      for (const key of keys) await drop(key);
    },
  };
}
