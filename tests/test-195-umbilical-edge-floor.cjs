'use strict';
/*
 * Phase 195-01 Wave 0 -- the UMBILICAL_TO edge-type FLOOR (FCM-11 guard).
 * =========================================================================
 * FLOOR discipline (the edges.cjs SHARES_JOB / ELEVATES_TO block states it verbatim):
 * assert named MEMBERSHIP of every edge type, NEVER an exact `.size` / count, so an
 * additive extension of ALLOWED_EDGE_TYPES cannot regress the baseline. This matters
 * doubly here: a parallel Phase-205 session is concurrently adding SHARES_JOB /
 * ELEVATES_TO to the SAME frozen Set, so a size assertion would race and flap.
 *
 * Two jobs:
 *   1. GREEN NOW: assert the current cross-room-relevant edge types are all present
 *      (NESTED_WITHIN, SHARES_JOB, ELEVATES_TO) plus the foundational decision pair
 *      (DEFERRED, REJECTED). This is the always-on floor.
 *   2. SKIP-SAFE until Wave 3: UMBILICAL_TO is minted later (195-04). Until it lands,
 *      this file self-skips the UMBILICAL_TO assertion (prints a SKIP notice, exits 0).
 *      The instant edges.cjs carries UMBILICAL_TO, the assertion auto-activates - no
 *      edit to this file needed to tighten the gate.
 *
 * Read-only: imports the frozen Set and probes membership; mutates nothing.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { ALLOWED_EDGE_TYPES } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));

// The always-on FLOOR: these MUST be members. NESTED_WITHIN is the vertical room
// lineage edge UMBILICAL_TO contrasts with; SHARES_JOB / ELEVATES_TO are the
// Phase-205 concurrent additions the floor must tolerate (membership, never size).
const FLOOR_MEMBERS = ['DEFERRED', 'REJECTED', 'NESTED_WITHIN', 'SHARES_JOB', 'ELEVATES_TO'];

// The net-new member, minted in Wave 3 (195-04). As of that wave this is a HARD
// membership assertion, no longer SKIP-safe: UMBILICAL_TO is the PEER-to-peer
// cross-room edge type, contrasted with the VERTICAL NESTED_WITHIN lineage edge.
const NEW_EDGE = 'UMBILICAL_TO';

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// It IS a Set, and membership is the contract (never `.size`).
ok('ALLOWED_EDGE_TYPES is a Set instance', ALLOWED_EDGE_TYPES instanceof Set);

for (const t of FLOOR_MEMBERS) {
  ok('ALLOWED_EDGE_TYPES has ' + t + ' (floor member preserved)', ALLOWED_EDGE_TYPES.has(t));
}

// Wave 3 (195-04) Task 1: UMBILICAL_TO is now minted; the assertion is HARD.
// Membership only -- never `.size` (the concurrent Phase-205 additions must not
// make this flap). Tasks 2 + 3 append the cross-room-store round-trip / purge /
// reap assertions below this line as those modules land.
ok('ALLOWED_EDGE_TYPES has ' + NEW_EDGE + ' (minted Wave 3, peer cross-room edge)',
  ALLOWED_EDGE_TYPES.has(NEW_EDGE));

// ---------------------------------------------------------------------------
// Wave 3 (195-04) Task 2: the registry-level cross-room store (FCM-11b). Exercised
// against a throwaway .rooms/ under the OS tmp dir (never the real registry). The
// store is the SINGLE write chokepoint for UMBILICAL_TO at registry level (D-03).
// ---------------------------------------------------------------------------
const fs = require('node:fs');
const os = require('node:os');
const store = require(path.join(REPO_ROOT, 'lib', 'core', 'cross-room-store.cjs'));

function mkRoomsHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'fcm11-xroom-'));
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  return home;
}

// -- Round-trip: write then read back, enum/scalar-only props, bidirectional. --
(function storeRoundTrip() {
  const home = mkRoomsHome();
  try {
    const w = store.writeUmbilicalEdge(home, {
      source_id: 'room:alpha:item-1',
      target_id: 'room:beta:item-9',
      source_room: 'alpha',
      target_room: 'beta',
      properties: { relevance: 0.82, signal: 'convergence', linked_at: 1751000000000, session_id: 'sess-abc' },
    });
    ok('store.writeUmbilicalEdge returns ok for a valid UMBILICAL_TO edge', w && w.ok === true);

    // Bidirectional traversal: the edge is returned querying EITHER room.
    const fromAlpha = store.edgesForRoom(home, 'alpha');
    const fromBeta = store.edgesForRoom(home, 'beta');
    ok('edgesForRoom(alpha) returns the edge (source side)',
      fromAlpha.some(function (e) { return e.target_id === 'room:beta:item-9'; }));
    ok('edgesForRoom(beta) returns the edge (target side, bidirectional)',
      fromBeta.some(function (e) { return e.source_id === 'room:alpha:item-1'; }));

    // Read-back preserves enum/scalar props only.
    const edge = fromAlpha[0];
    ok('read-back edge carries scalar relevance', typeof edge.properties.relevance === 'number');
    ok('read-back edge carries enum signal', edge.properties.signal === 'convergence');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
})();

// -- Rejection: wrong type + prose property rejected WITHOUT throwing (Part 8). --
(function storeRejects() {
  const home = mkRoomsHome();
  try {
    const badType = store.writeUmbilicalEdge(home, {
      source_id: 'room:a:x', target_id: 'room:b:y', source_room: 'a', target_room: 'b',
      edge_type: 'NESTED_WITHIN', properties: { relevance: 0.5 },
    });
    ok('non-UMBILICAL_TO edge_type rejected (no throw)', badType && badType.ok === false);

    const prose = store.writeUmbilicalEdge(home, {
      source_id: 'room:a:x', target_id: 'room:b:y', source_room: 'a', target_room: 'b',
      properties: { relevance: 0.5, note: 'a long freeform prose body that must never cross the fence' },
    });
    ok('prose (unknown-key) property rejected (Part 8 fence, no throw)', prose && prose.ok === false);
    ok('rejected edge did NOT land in the store', store.edgesForRoom(home, 'a').length === 0);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
})();

// ---------------------------------------------------------------------------
// Wave 3 (195-04) Task 3: room-deletion reconcile (FCM-11c). purge (cascade layer
// 1) + periodic reap of edges to unregistered slugs (layer 2), and the discard
// cascade integration that wires the purge into the ordered teardown.
// ---------------------------------------------------------------------------

// -- Purge: purgeRoomEdges removes every edge whose source OR target is the room. --
(function storePurge() {
  const home = mkRoomsHome();
  try {
    store.writeUmbilicalEdge(home, {
      source_id: 'room:alpha:i1', target_id: 'room:beta:i2', source_room: 'alpha', target_room: 'beta',
      properties: { relevance: 0.7, signal: 'informs', linked_at: 1, session_id: 's1' },
    });
    store.writeUmbilicalEdge(home, {
      source_id: 'room:gamma:i3', target_id: 'room:alpha:i4', source_room: 'gamma', target_room: 'alpha',
      properties: { relevance: 0.9, signal: 'informs', linked_at: 2, session_id: 's2' },
    });
    const purged = store.purgeRoomEdges(home, 'alpha');
    ok('purgeRoomEdges(alpha) purges both edges touching alpha (source AND target)', purged >= 2);
    ok('no dangling edge remains for alpha after purge', store.edgesForRoom(home, 'alpha').length === 0);
    ok('gamma edge to alpha is also gone (target-side purge)', store.edgesForRoom(home, 'gamma').length === 0);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
})();

// -- Reap: sweeps edges pointing at slugs no longer in .rooms/registry.json. --
(function storeReap() {
  const home = mkRoomsHome();
  try {
    // Registry knows only 'alpha'. 'ghost' was deleted out-of-band.
    fs.writeFileSync(path.join(home, '.rooms', 'registry.json'),
      JSON.stringify({ active: 'alpha', rooms: { alpha: { slug: 'alpha' } } }, null, 2), 'utf8');
    store.writeUmbilicalEdge(home, {
      source_id: 'room:alpha:i1', target_id: 'room:ghost:i2', source_room: 'alpha', target_room: 'ghost',
      properties: { relevance: 0.6, signal: 'informs', linked_at: 3, session_id: 's3' },
    });
    const reaped = store.reapOrphanEdges(home);
    ok('reapOrphanEdges removes the edge pointing at the unregistered ghost slug', reaped >= 1);
    ok('no edge to ghost remains after reap', store.edgesForRoom(home, 'ghost').length === 0);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
})();

// -- Cascade integration: discardPlaceholderRoom purges the room's cross-room edges. --
(function cascadePurgesCrossRoom() {
  const home = mkRoomsHome();
  try {
    // A discardable PLACEHOLDER slug (matches room-auto-create PLACEHOLDER_SLUG_RE:
    // /^untitled-\d{4}-\d{2}-\d{2}-\d{4}(?:-\d{2})?(?:-[0-9a-f]{8})?$/).
    const slug = 'untitled-1999-01-01-0000';
    const roomDir = path.join(home, slug);
    fs.mkdirSync(roomDir, { recursive: true });
    fs.writeFileSync(path.join(home, '.rooms', 'registry.json'),
      JSON.stringify({ active: '', rooms: { [slug]: { slug: slug }, keeper: { slug: 'keeper' } } }, null, 2), 'utf8');
    store.writeUmbilicalEdge(home, {
      source_id: 'room:' + slug + ':i1', target_id: 'room:keeper:i2', source_room: slug, target_room: 'keeper',
      properties: { relevance: 0.75, signal: 'informs', linked_at: 4, session_id: 's4' },
    });
    const { discardPlaceholderRoom } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-discard-cascade.cjs'));
    const res = discardPlaceholderRoom(home, slug, { decided_by: 'test' });
    ok('discardPlaceholderRoom completes for the placeholder slug', res && res.ok === true);
    ok('cascade purged the discarded room cross-room edge (no dangling)',
      store.edgesForRoom(home, slug).length === 0);
    ok('the surviving keeper room has no dangling edge to the discarded room',
      store.edgesForRoom(home, 'keeper').length === 0);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
})();

console.log('\nPASS test-195-umbilical-edge-floor (' + pass + ' assertions)');
console.log('>>> test-195-umbilical-edge-floor.cjs: PASSED');
