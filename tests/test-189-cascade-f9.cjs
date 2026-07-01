'use strict';
/*
 * Phase 189-03 (HITL Memory Governance; HMG-04) -- test the memory-cascade F.9
 * adapter: the ordered multi-section soft-edit path that composes the SHIPPED
 * Phase 188 F.9 renderer + f9-ordered-consumer (no new selector). Plain node
 * script, no test framework (matches the codebase's `node tests/test-*.cjs`
 * convention). Exit 0 on pass, exit 1 with a clear message on the first failure.
 *
 * Assertions:
 *   (0) buildMemoryCascadeGate renders a 3-section candidate as an F.9 gate with 3
 *       ordered items, item 0 = the FIRST affected section (order preserved).
 *   (a) a 3-section candidate {s1:APPROVE, s2:REJECT, s3:DEFER (s3 has a rival)}
 *       writes exactly one REMEMBERED_AS (s1), one NOT_REMEMBERED_BECAUSE (s2), and
 *       one CONTRADICTS (s3) edge -- via an injected db spy.
 *   (b) a missing decision for a section defaults to DEFER (never silently dropped).
 *   (c) one malformed decision does not abort the other two (degrade-never-block,
 *       inherited from consumeF9Ordered).
 *   (d) source-grep: the adapter requires no better-sqlite3 / node:sqlite and opens
 *       no room.db of its own (Part 9).
 *
 * No em-dashes. No emoji.
 */

const path = require('node:path');
const fs = require('node:fs');

const REPO = path.resolve(__dirname, '..');
const adapter = require(path.join(REPO, 'lib', 'workflow', 'memory-cascade-f9-adapter.cjs'));

let failures = 0;
function check(cond, msg) {
  if (cond) {
    console.log('  ok: ' + msg);
  } else {
    console.error('  FAIL: ' + msg);
    failures++;
  }
}

// A db spy that captures every edge write the navigation chokepoint performs.
// edges.writeEdge does db.prepare('INSERT INTO edges ...').run(source, target, type, propsJson).
function makeDbSpy() {
  const writes = [];
  return {
    writes: writes,
    prepare: function (_sql) {
      return {
        run: function (source, target, type, propsJson) {
          let props = {};
          try { props = JSON.parse(propsJson); } catch (_e) { props = { _unparsed: propsJson }; }
          writes.push({ source: source, target: target, type: type, props: props });
        },
      };
    },
  };
}

function countType(writes, type) {
  return writes.filter(function (w) { return w.type === type; }).length;
}
function firstOfType(writes, type) {
  return writes.filter(function (w) { return w.type === type; })[0] || null;
}

// ---------------------------------------------------------------------------
console.log('(0) buildMemoryCascadeGate: 3-section candidate -> ordered F.9 gate');
// ---------------------------------------------------------------------------
(function () {
  const gate = adapter.buildMemoryCascadeGate({
    candidate_id: 'c1',
    affected_sections: ['s1', 's2', 's3'],
  });
  check(gate && gate.shape === 'F.9', 'gate.shape is F.9');
  check(gate && Array.isArray(gate.items) && gate.items.length === 3, 'gate has 3 ordered items');
  check(gate.items[0].item_id === 's1', 'item 0 maps to the FIRST affected section (s1)');
  check(gate.items[2].item_id === 's3', 'item 2 maps to the LAST affected section (s3)');
  // Part 8: the claim is a structural descriptor, never section body content.
  check(typeof gate.items[0].claim === 'string' && gate.items[0].claim.indexOf('c1') !== -1
    && gate.items[0].claim.indexOf('s1') !== -1,
    'item claim is a structural descriptor (candidate_id + section id)');
  check(gate.contract && gate.contract.shape === 'F.9' && gate.contract.ordered === true,
    'renderer contract is the shipped F.9 (ordered:true), not a new shape');
})();

// ---------------------------------------------------------------------------
console.log('(a) memoryCascadeViaF9: APPROVE/REJECT/DEFER writes exactly one edge each');
// ---------------------------------------------------------------------------
(function () {
  const db = makeDbSpy();
  const candidate = {
    candidate_id: 'cand:multi',
    kind: 'claim',
    chosen_verb: 'INFORMS',
    truth_state: 'proposed',
    affected_sections: ['s1', 's2', 's3'],
    section_rivals: { s3: 'node:rival-3' },
    section_reasons: { s2: 'low_relevance' },
  };
  const res = adapter.memoryCascadeViaF9({
    candidate: candidate,
    decisions: { s1: 'APPROVE', s2: 'REJECT', s3: 'DEFER' },
    roomState: { db: db },
  });

  check(res && res.ok === true, 'result ok:true (ordered walk ran)');
  check(res.applied === 3, 'applied === 3 (all three sections resolved), got ' + res.applied);

  check(countType(db.writes, 'REMEMBERED_AS') === 1, 'exactly one REMEMBERED_AS edge');
  check(countType(db.writes, 'NOT_REMEMBERED_BECAUSE') === 1, 'exactly one NOT_REMEMBERED_BECAUSE edge');
  check(countType(db.writes, 'CONTRADICTS') === 1, 'exactly one CONTRADICTS edge');
  check(db.writes.length === 3, 'exactly three edges total, got ' + db.writes.length);

  const approved = firstOfType(db.writes, 'REMEMBERED_AS');
  check(approved && approved.source === 'cand:multi' && approved.target === 's1',
    'REMEMBERED_AS is candidate -> s1 (scoped to the APPROVE section)');
  check(approved && approved.props && approved.props.cascade === true,
    'REMEMBERED_AS carries cascade:true (enum/scalar props only)');

  const rejected = firstOfType(db.writes, 'NOT_REMEMBERED_BECAUSE');
  check(rejected && rejected.source === 'cand:multi' && rejected.target === 's2',
    'NOT_REMEMBERED_BECAUSE is candidate -> s2 only (scoped to that section, not the whole candidate)');
  check(rejected && rejected.props && rejected.props.reason === 'low_relevance',
    'NOT_REMEMBERED_BECAUSE carries the per-section reason (rejection is data)');

  const contra = firstOfType(db.writes, 'CONTRADICTS');
  check(contra && contra.source === 'cand:multi' && contra.target === 'node:rival-3',
    'CONTRADICTS is candidate -> rival for the DEFER section with a rival');
  check(contra && contra.props && contra.props.reconcile === false && contra.props.cascade === true,
    'CONTRADICTS props are {reconcile:false, cascade:true, review_status}');
})();

// ---------------------------------------------------------------------------
console.log('(a2) DEFER with NO rival -> pending_contradicts no-op (no edge, no data lost)');
// ---------------------------------------------------------------------------
(function () {
  const db = makeDbSpy();
  const res = adapter.memoryCascadeViaF9({
    candidate: { candidate_id: 'cand:norival', affected_sections: ['s1'] },
    decisions: { s1: 'DEFER' },
    roomState: { db: db },
  });
  check(res.ok === true && res.applied === 1, 'DEFER-no-rival still applies (pending), applied=' + res.applied);
  check(db.writes.length === 0, 'no edge written when the DEFER section has no distinct rival');
  const item = res.items[0];
  check(item && item.kind === 'contradicts' && item.ok === true,
    'the item resolves as a contradicts outcome (both claims survive as pending)');
})();

// ---------------------------------------------------------------------------
console.log('(b) missing decision for a section defaults to DEFER (never silently dropped)');
// ---------------------------------------------------------------------------
(function () {
  const db = makeDbSpy();
  const res = adapter.memoryCascadeViaF9({
    candidate: {
      candidate_id: 'cand:missing',
      affected_sections: ['s1', 's2'],
      section_rivals: { s2: 'node:rival-2' },
    },
    // s2 has NO decision supplied -> must default to DEFER, not vanish.
    decisions: { s1: 'APPROVE' },
    roomState: { db: db },
  });
  check(res.applied === 2, 'both sections resolved even though s2 had no decision, applied=' + res.applied);
  check(countType(db.writes, 'REMEMBERED_AS') === 1, 's1 APPROVE -> one REMEMBERED_AS');
  check(countType(db.writes, 'CONTRADICTS') === 1, 's2 (defaulted DEFER, has rival) -> one CONTRADICTS');
  check(res.items.length === 2, 'the section was NOT dropped (2 items returned)');
})();

// ---------------------------------------------------------------------------
console.log('(c) one malformed decision does not abort the other two (degrade-never-block)');
// ---------------------------------------------------------------------------
(function () {
  const db = makeDbSpy();
  const res = adapter.memoryCascadeViaF9({
    candidate: {
      candidate_id: 'cand:malformed',
      affected_sections: ['s1', 's2', 's3'],
    },
    // s2 is a malformed (non-string) value: must not abort s1 (APPROVE) or s3 (REJECT).
    decisions: { s1: 'APPROVE', s2: 42, s3: 'REJECT' },
    roomState: { db: db },
  });
  check(res.ok === true, 'ordered walk still ok:true despite a malformed decision');
  check(countType(db.writes, 'REMEMBERED_AS') === 1, 's1 APPROVE still wrote its REMEMBERED_AS');
  check(countType(db.writes, 'NOT_REMEMBERED_BECAUSE') === 1, 's3 REJECT still wrote its NOT_REMEMBERED_BECAUSE');
  // s2 -> DEFER (safe normalize), no rival -> pending_contradicts no-op (no edge).
  check(res.items.length === 3, 'all three sections produced a result (none aborted)');
})();

// ---------------------------------------------------------------------------
console.log('(d) source-grep: no better-sqlite3 / node:sqlite require, opens no room.db');
// ---------------------------------------------------------------------------
(function () {
  const src = fs.readFileSync(
    path.join(REPO, 'lib', 'workflow', 'memory-cascade-f9-adapter.cjs'), 'utf8');
  check(src.indexOf('better-sqlite3') === -1, 'no better-sqlite3 require');
  check(src.indexOf('node:sqlite') === -1, 'no node:sqlite require');
  check(!/openRoomDb|room-db\.cjs/.test(src), 'no room.db open path of its own (caller-owned db, Part 9)');
  // Every write must route through navigation.writeEdge (the single SQL chokepoint).
  check(src.indexOf('nav.writeEdge') !== -1, 'writes route through navigation.writeEdge (the chokepoint)');
})();

// ---------------------------------------------------------------------------
if (failures > 0) {
  console.error('\nCASCADE_F9 FAILED: ' + failures + ' assertion(s) failed');
  process.exit(1);
}
console.log('\nCASCADE_F9_OK');
process.exit(0);
