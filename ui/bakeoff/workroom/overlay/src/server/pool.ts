/*
 * pool.ts -- the one door to room data (D-06, D-19).
 *
 * One createSessionPool, one feed relay and the open-room and gate records for
 * the whole server process. They hang off globalThis because every route and
 * page is its own bundle: a module-level variable would give each route a
 * separate pool, so a room bound in one route would be unbound in the next.
 *
 * MOS_DAEMON_URL is the flag-ON daemon's base URL (http://127.0.0.1:<port>, no
 * /mcp suffix; one is stripped if given). Nothing else in this app opens a
 * room: there is no filesystem or child-process import anywhere in the overlay.
 */
import { createSessionPool } from 'mos-ui-shared/mcp-session-pool';
import { createFeedRelay } from 'mos-ui-shared/feed-relay';

type Pool = ReturnType<typeof createSessionPool>;
type Relay = ReturnType<typeof createFeedRelay>;

export type GateRecord = {
  roomSlug: string;
  optionIds: string[];
  recommendedId: string;
  subjectNodeId: string;
};

type Shared = {
  pool: Pool;
  relay: Relay;
  // browser session key -> the room it opened
  openRooms: Map<string, string>;
  // browser session key -> gate id -> record
  gates: Map<string, Map<string, GateRecord>>;
};

const g = globalThis as unknown as { __mosBakeoffA?: Shared };

export function daemonUrl(): string {
  const raw = process.env.MOS_DAEMON_URL;
  if (!raw) throw new Error('MOS_DAEMON_URL is not set');
  return raw.replace(/\/mcp\/?$/, '').replace(/\/$/, '');
}

export function shared(): Shared {
  if (!g.__mosBakeoffA) {
    const pool = createSessionPool({ daemonUrl: daemonUrl, clientName: 'mindrian-shell' });
    const relay = createFeedRelay({ pool, daemonUrl: daemonUrl });
    g.__mosBakeoffA = { pool, relay, openRooms: new Map(), gates: new Map() };
  }
  return g.__mosBakeoffA;
}

export function recordGate(sessionKey: string, gateId: string, rec: GateRecord): void {
  const s = shared();
  let m = s.gates.get(sessionKey);
  if (!m) {
    m = new Map();
    s.gates.set(sessionKey, m);
  }
  m.set(gateId, rec);
}

export function takeGate(sessionKey: string, gateId: string): GateRecord | undefined {
  return shared().gates.get(sessionKey)?.get(gateId);
}

export function forgetGate(sessionKey: string, gateId: string): void {
  shared().gates.get(sessionKey)?.delete(gateId);
}
