'use strict';
/*
 * Phase 194-06 (PSB-08 / PSB-09 / D-05) -- the optimistic lost-update reconcile
 * guard. ONE tiny CAS helper called from every guarded UPDATE site, so there is
 * exactly one comparison rule (never three divergent copies).
 *
 * The CAS token is nodes.last_modified_at (repaired to move on every content
 * mutation by 194-06 Task 1). A caller that read a node at version V0 and now
 * wants to write it passes V0 as readVersion. If another session bumped the token
 * since (current > V0), this is a lost update: the guard returns conflict so the
 * caller raises a RECONCILE (F.9) instead of silently clobbering.
 *
 * Two doors, one rule:
 *   checkReconcile({ readVersion, current }) -> { status }   (pure comparator)
 *   checkLostUpdate(db, nodeId, readVersion) -> { conflict, currentVersion, status }
 *     (reads current last_modified_at over the caller-owned db, then delegates)
 *
 * Pitfall 1 (NULL token): a pre-migration row leaves last_modified_at NULL. Treat
 * readVersion == null OR current == null as no-claim -> fall through to the normal
 * write (which SETS a non-null stamp and repairs the row). NEVER reconcile
 * NULL-vs-NULL.
 *
 * Append-safe: a caller that passes no readVersion skips the check entirely
 * (byte-identical to today). Appends carry no snapshot, so the guard is a no-op.
 *
 * Fail OPEN: any read/compare error degrades to no-claim (the normal write),
 * never a lockout. A false allow is always safer than a false block.
 *
 * Canon Part 8: LOCAL only, pure CJS over a caller-owned db handle, zero Brain
 * egress and zero network token. NO em-dashes. Hyphens only.
 */

// Pure comparator. status is one of:
//   'no-claim' -> no reliable token on one side -> do not reconcile, write normally
//   'pass'     -> readVersion still current (no drift since the read)
//   'conflict' -> current token advanced past readVersion (a lost update)
function checkReconcile(input) {
  const a = (input && typeof input === 'object') ? input : {};
  const readVersion = a.readVersion;
  const current = a.current;

  // NULL/absent on EITHER side -> no reliable CAS token -> no claim (Pitfall 1).
  if (readVersion === null || readVersion === undefined
      || current === null || current === undefined) {
    return { status: 'no-claim' };
  }

  const rv = Number(readVersion);
  const cur = Number(current);
  // Unusable (non-finite) stamps degrade to no-claim (fail open, never reconcile).
  if (!Number.isFinite(rv) || !Number.isFinite(cur)) {
    return { status: 'no-claim' };
  }

  // Conflict iff the token moved FORWARD since the caller's read. A current stamp
  // that is equal (no drift) or somehow older than readVersion is not a lost
  // update -> pass and let the normal write proceed.
  if (cur > rv) {
    return { status: 'conflict' };
  }
  return { status: 'pass' };
}

// DB-aware wrapper. Reads the node's current last_modified_at over the
// caller-owned handle (this module NEVER opens room.db -- Part 9 chokepoint) and
// classifies the write. Returns { conflict, currentVersion, status }.
function checkLostUpdate(db, nodeId, readVersion) {
  // Append-safe: no readVersion supplied -> skip the check (byte-identical to today).
  if (readVersion === null || readVersion === undefined) {
    return { conflict: false, currentVersion: null, status: 'no-claim' };
  }

  let current = null;
  try {
    if (db && typeof db.prepare === 'function'
        && typeof nodeId === 'string' && nodeId.length > 0) {
      const row = db.prepare('SELECT last_modified_at FROM nodes WHERE id = ?').get(nodeId);
      current = (row && row.last_modified_at !== null && row.last_modified_at !== undefined)
        ? row.last_modified_at
        : null;
    }
  } catch (_e) {
    // Fail OPEN: a guard read error degrades to the normal write, never a lockout.
    return { conflict: false, currentVersion: null, status: 'no-claim' };
  }

  const verdict = checkReconcile({ readVersion: readVersion, current: current });
  return {
    conflict: verdict.status === 'conflict',
    currentVersion: current,
    status: verdict.status,
  };
}

module.exports = {
  checkReconcile: checkReconcile,
  checkLostUpdate: checkLostUpdate,
};
