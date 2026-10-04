/*
 * sessions.ts -- one legacy-mode MCP session per browser session (plan 369-32, D-19).
 *
 * The shell reaches room data through MCP only and never opens the room database (Canon Part 9). The
 * browser session plan 369-19 issues carries an `mcpKey`; this module owns the one ui/shared
 * session pool (client name mindrian-shell, legacy sessionful mode set inside the pool) and maps
 * a browser session to its pool key. It also holds:
 *
 *   - the remembered room per browser session. The pool forgets a bound room when a reconnect
 *     attempt fails while the daemon is down; the browser session chose that room, so
 *     ensureBound re-binds it through the pool's bind() (bake-off transplant 1: the room is
 *     restored after a daemon restart, no reload);
 *   - authorizeApi, the one guard every /api route runs: Host/Origin/fetch-metadata allow-list
 *     first, then the session cookie, then (for a state-changing request) the CSRF token;
 *   - the idle sweep that closes the MCP sessions of expired browser sessions.
 *
 * State lives in globalThis slots because the chassis bundles proxy, routes and pages separately
 * inside one Node process. Framework-free erasable TypeScript.
 */
import { createSessionPool } from 'mos-ui-shared/mcp-session-pool';
import { getSessionStore, onSessionExpired, readSession, requireCsrf, runExpiryHooks, SESSION_IDLE_MS } from './auth.ts';
import type { Session, SessionStore } from './auth.ts';
import { getConfig } from './config.ts';
import { checkRequest } from './origin-guard.ts';
import type { HeaderBag } from './origin-guard.ts';

export type Pool = ReturnType<typeof createSessionPool>;

export const MCP_CLIENT_NAME = 'mindrian-shell';

// How often expired sessions are swept. Contract default: far shorter than the 30-minute idle
// window so a closed browser's MCP session is gone within a minute of expiring, long enough that
// the sweep costs nothing.
const SWEEP_EVERY_MS = 60 * 1000;

const POOL_SLOT = Symbol.for('mos.shell.pool');
const ROOMS_SLOT = Symbol.for('mos.shell.rememberedRooms');
const TIMER_SLOT = Symbol.for('mos.shell.sweepTimer');

export function makePool(daemonUrl: string | (() => string)): Pool {
  // idleMs matches the browser session's idle expiry so an MCP session never outlives the
  // browser session it serves.
  return createSessionPool({ daemonUrl, clientName: MCP_CLIENT_NAME, idleMs: SESSION_IDLE_MS });
}

export function getPool(): Pool {
  const g = globalThis as Record<symbol, unknown>;
  if (!g[POOL_SLOT]) {
    g[POOL_SLOT] = makePool(() => getConfig().daemonUrl);
    startSweepTimer();
  }
  return g[POOL_SLOT] as Pool;
}

// The pool key for a browser session: its mcpKey, never the cookie value.
export function sessionFor(browserSession: { mcpKey: string }): string {
  if (!browserSession || typeof browserSession.mcpKey !== 'string' || browserSession.mcpKey.length === 0) {
    throw new Error('sessionFor: a browser session with an mcpKey is required');
  }
  return browserSession.mcpKey;
}

function roomsMap(): Map<string, string> {
  const g = globalThis as Record<symbol, unknown>;
  if (!g[ROOMS_SLOT]) g[ROOMS_SLOT] = new Map<string, string>();
  return g[ROOMS_SLOT] as Map<string, string>;
}

export function rememberRoom(key: string, slug: string): void {
  roomsMap().set(key, slug);
}

export function rememberedRoom(key: string): string | null {
  return roomsMap().get(key) ?? null;
}

export function forgetRoom(key: string): void {
  roomsMap().delete(key);
}

// If this browser session chose a room and its MCP session came back unbound (a reconnect while
// the daemon was down drops the pool's record), bind it again. A no-op on a live bound session.
export async function ensureBound(pool: Pick<Pool, 'get' | 'bind'>, key: string): Promise<void> {
  const room = rememberedRoom(key);
  if (!room) return;
  const entry = await pool.get(key);
  if (entry.boundRoom === null) await pool.bind(key, room);
}

export type ApiAuthorization =
  | { ok: true; session: Session }
  | { ok: false; status: 401 | 403; reason: string };

// The one guard for every /api route. Order is fixed: origin guard, session read, then CSRF for a
// state-changing request. A GET passes csrf: false (it still needs the cookie and the origin guard).
export function authorizeApi(
  req: { headers: HeaderBag; port: number },
  opts: { csrf: boolean },
  store: SessionStore = getSessionStore(),
): ApiAuthorization {
  const guard = checkRequest(req.headers, req.port);
  if (!guard.ok) return { ok: false, status: 403, reason: guard.reason };
  const session = readSession(req.headers.get('cookie'), store);
  if (!session) return { ok: false, status: 401, reason: 'not_signed_in' };
  if (opts.csrf) {
    const csrf = requireCsrf({ headers: req.headers }, session);
    if (!csrf.ok) return { ok: false, status: csrf.status, reason: csrf.reason };
  }
  return { ok: true, session };
}

// A JSON answer from an /api route: never cached, never sniffed.
export function apiJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export type SweepDeps = {
  store: SessionStore;
  pool: Pick<Pool, 'sweepIdle'>;
  // Called with each expired browser session's mcpKey (gate records, connection state, room).
  onExpired?: (mcpKey: string) => void;
};

// Close the MCP sessions of expired browser sessions. The store drops a browser session after 30
// idle minutes; the pool, built with the same idle window, closes any MCP session idle as long.
export async function sweepSessions(deps: SweepDeps): Promise<{ expired: number; closed: number }> {
  const gone = deps.store.sweep();
  for (const key of gone) {
    forgetRoom(key);
    if (deps.onExpired) deps.onExpired(key);
  }
  const closed = await deps.pool.sweepIdle();
  return { expired: gone.length, closed };
}

// Other modules (gate records, connection state) register what to forget when a browser session expires;
// the registry lives in auth.ts so a read that finds a session expired runs the same hooks as the sweep.
export { onSessionExpired };

// The remembered room goes with the session on EVERY expiry path.
const ROOM_HOOK_SLOT = Symbol.for('mos.shell.roomExpiryHook');
{
  const g = globalThis as Record<symbol, unknown>;
  if (!g[ROOM_HOOK_SLOT]) {
    g[ROOM_HOOK_SLOT] = true;
    onSessionExpired((key) => forgetRoom(key));
  }
}

function startSweepTimer(): void {
  const g = globalThis as Record<symbol, unknown>;
  if (g[TIMER_SLOT]) return;
  const timer = setInterval(() => {
    sweepSessions({
      store: getSessionStore(),
      pool: getPool(),
      onExpired: runExpiryHooks,
    }).catch(() => {
      /* the next tick tries again */
    });
  }, SWEEP_EVERY_MS);
  // Never keep the process alive for the sweep.
  if (typeof timer === 'object' && timer && 'unref' in timer) (timer as { unref: () => void }).unref();
  g[TIMER_SLOT] = timer;
}
