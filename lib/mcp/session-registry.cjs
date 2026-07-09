'use strict';
// Phase 198-02 (SPEC-1, D-02) -- MCP connection <-> sessionId <-> Phase-194
// binding key. This is a WIRE-AND-CONSUME module: it keys into
// lib/core/session-binding.cjs (the shipped Phase 194 store) and
// lib/core/session-presence.cjs (the shipped per-room presence ledger). It
// stores NO room state itself -- binding reads/writes stay in session-binding.cjs.
//
// D-02 design pin (the one-namespace rule): the MCP connection's sessionId IS
// the Phase-194 binding key. There is no second session namespace. A caller
// (the daemon's onsessioninitialized callback, or a future stdio shim passing
// a hook-derived sessionId through as the connection key) calls open(sid) with
// that SAME string; readSessionBinding(sid)/writeSessionBinding(sid, ...)
// then resolve against the identical key.
//
// isSafeSlug is IMPORTED from session-binding.cjs (the predicate that guards
// the store), never re-implemented here (Canon Part 7).
//
// Canon Part 8: zero Brain/network token. CJS only. No em-dashes.

const path = require('node:path');
const os = require('node:os');
const { isSafeSlug, readSessionBinding } = require('../core/session-binding.cjs');
const sessionPresence = require('../core/session-presence.cjs');

// In-memory only -- a durable daemon process holds this for its lifetime.
// openSessions: the set of sessionIds this registry currently considers open.
// connectionMap: connectionKey -> sessionId. A stdio-shim-supplied hook
// sessionId is accepted verbatim (connectionKey === sessionId when the caller
// does not supply a distinct connectionKey), so sessionIdFor(hookSid) resolves
// to itself with no second lookup table entry required.
const openSessions = new Set();
const connectionMap = new Map();

function resolveRoomsHome() {
  return process.env.MINDRIAN_ROOMS_HOME
    || path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), 'MindrianRooms');
}

/**
 * open(sid, opts) -- register a connection under sessionId `sid`. When
 * opts.connectionKey differs from `sid` (e.g. a transport-minted id distinct
 * from a hook-supplied session string), the registry keys BOTH: the
 * connectionKey resolves to `sid`, and `sid` resolves to itself directly.
 * Rejects an unsafe slug (path-traversal guard, shared with the binding
 * store) and returns null without registering anything.
 *
 * @param {string} sid
 * @param {{connectionKey?: string}} [opts]
 * @returns {string|null} the registered sessionId, or null on rejection
 */
function open(sid, opts) {
  if (!isSafeSlug(sid)) return null;
  openSessions.add(sid);
  const o = opts || {};
  const connectionKey = (typeof o.connectionKey === 'string' && isSafeSlug(o.connectionKey))
    ? o.connectionKey
    : sid;
  connectionMap.set(connectionKey, sid);
  return sid;
}

/**
 * has(sid) -- is this sessionId currently open?
 * @param {string} sid
 * @returns {boolean}
 */
function has(sid) {
  return openSessions.has(sid);
}

/**
 * sessionIdFor(connectionKey) -- resolve a connection key (transport-minted
 * id or hook-supplied sessionId string) to its registered sessionId. Returns
 * null when the connection is not (or no longer) registered.
 *
 * @param {string} connectionKey
 * @returns {string|null}
 */
function sessionIdFor(connectionKey) {
  if (typeof connectionKey !== 'string') return null;
  if (connectionMap.has(connectionKey)) return connectionMap.get(connectionKey);
  return openSessions.has(connectionKey) ? connectionKey : null;
}

/**
 * close(sid) -- deregister a connection's sessionId. Idempotent (closing a
 * sid that was never open, or twice, is a no-op). Where this session's global
 * binding names a `primary` room, its per-room presence ledger entry is
 * deregistered too (deregisterPresence is fire-and-forget and never throws --
 * session-presence.cjs's own contract). Never throws.
 *
 * @param {string} sid
 */
function close(sid) {
  if (!isSafeSlug(sid)) return;
  openSessions.delete(sid);
  for (const key of connectionMap.keys()) {
    if (connectionMap.get(key) === sid) connectionMap.delete(key);
  }
  try {
    const home = resolveRoomsHome();
    const binding = readSessionBinding(sid, { home: home });
    const primary = binding && typeof binding.primary === 'string' ? binding.primary : null;
    if (primary) {
      const roomDir = path.join(home, primary);
      sessionPresence.deregisterPresence({ sessionId: sid, roomDir: roomDir, home: home });
    }
  } catch (_e) {
    // Fire-and-forget: presence deregistration failure never blocks connection close.
  }
}

module.exports = { open, close, has, sessionIdFor };
