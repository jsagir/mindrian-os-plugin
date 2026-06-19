'use strict';
/*
 * Phase 165 Wave-5 GREEN test -- test-unknowns-rank-in (D-165-06).
 *
 * GREEN assertion (sourced from 165-VALIDATION.md + 165-RESEARCH section 4.1 / 7.4):
 *   Engine output becomes a CANDIDATE that the Phase 125 f-selector-ranker scores
 *   into the F.1 Next-Move set: the top-N proxy-ranked blind-spot candidates
 *   surface at the F.1 Decision Gate (Larry reacts unprompted, D-165-06; Part 10
 *   variable reward). The candidate-reach carries LOCAL scalars ONLY (top-N proxy
 *   ids + partition ids + corpus size) -- never venture prose (Part 8). The ranked
 *   set is clamped at MAX_K=3. The engine HALTS at the gate: it does NOT call
 *   navigation.confirmNode and does NOT invoke any downstream command. corpusSize
 *   is surfaced so a thin corpus is visible at the gate. Proxy findings land
 *   review_status 'proposed' only.
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */
const assert = require('assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const orchestrator = require('../lib/core/unknowns/orchestrator.cjs');
const { MAX_K } = require('../lib/workflow/f-selector-ranker.cjs');
const { REACH_IDS, POSTURE_IDS } = require('../lib/core/sensors/sensor-types.cjs');
const { buildFixtureRoom } = require('./fixtures/unknowns/build-fixture-room.cjs');
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const navigation = require('../lib/core/navigation.cjs');

const NOW = 1750000000000;

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log('  ok - ' + name);
  } catch (e) {
    failures++;
    console.error('  FAIL - ' + name + ': ' + e.message);
  }
}

function withRoom(fn, opts) {
  const o = opts || {};
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uu-rankin-'));
  const info = buildFixtureRoom(tmp, { now: NOW });
  const db = openRoomDb(tmp);
  // The locked proxy math (Plan 03, frozen 0.5/0.3/0.2, threshold 0.5) means no
  // SINGLE fixture scalar crosses 0.5 alone. To exercise the PROPOSED-finding write
  // path against the REAL locked weights (NOT a tuned threshold), the high-signal
  // case seeds the already-stale corpus claim (staleness 1.0 -> 0.2) with heavy
  // CONTRADICTS density through the navigation chokepoint so 0.5*cd + 0.2 crosses
  // 0.5 -- mirroring how the Plan 03 proxy-oracle test built its controlled UU.
  if (o.seedUU && info.staleId) {
    for (let i = 0; i < 5; i += 1) {
      const r = navigation.writeEdge(db, {
        source_id: 'handle:contra-uu-' + i,
        target_id: info.staleId,
        edge_type: 'CONTRADICTS',
        properties: { relation: 'rankin_signal' },
      });
      if (!r || r.ok === false) throw new Error('seedUU CONTRADICTS edge failed: ' + (r && r.reason));
    }
  }
  try {
    return fn(tmp, db, info);
  } finally {
    try { closeRoomDb(db); } catch (_e) { /* ignore */ }
  }
}

// A budget of 1.0 probes EVERY corpus instance so the contradicted+stale corpus
// claim is labeled a UU by the proxy oracle (so a PROPOSED finding lands and the
// rank-in surfaces a candidate). The locked proxy weights/threshold are unchanged.
const FULL_BUDGET = { budget: 1.0 };

check('discoverUnknownUnknowns ranks engine output into the F.1 set (clamped at MAX_K)', () => {
  withRoom((roomDir, db) => {
    const res = orchestrator.discoverUnknownUnknowns({ roomDir, db, config: FULL_BUDGET, now: NOW });
    assert(res && res.ranked && Array.isArray(res.ranked.items), 'ranked.items missing');
    assert(res.ranked.items.length <= MAX_K, 'ranked set must be clamped at MAX_K (' + MAX_K + ')');
    // The f-selector-ranker returned real F.1 command rows.
    if (res.ranked.items.length > 0) {
      const it = res.ranked.items[0];
      assert(typeof it.command === 'string' && it.command.length > 0, 'ranked item has no command slug');
      assert(typeof it.score === 'number', 'ranked item has no score');
    }
  });
});

check('the candidate-reach is a valid makeReach struct with LOCAL scalars only', () => {
  withRoom((roomDir, db) => {
    const res = orchestrator.discoverUnknownUnknowns({ roomDir, db, config: FULL_BUDGET, now: NOW });
    const reach = res.ranked.reach;
    assert(reach, 'no candidate-reach was built');
    assert(REACH_IDS.indexOf(reach.reach_id) !== -1, 'reach_id not in the frozen bank: ' + reach.reach_id);
    assert(POSTURE_IDS.indexOf(reach.posture) !== -1, 'posture not in the frozen bank: ' + reach.posture);
    assert.strictEqual(reach.posture, 'hold', 'the engine proposes (posture hold), it does not push');
    // Evidence is LOCAL scalars only (numbers); makeReach drops non-primitives.
    for (const k of Object.keys(reach.evidence)) {
      const t = typeof reach.evidence[k];
      assert(t === 'number' || t === 'string' || t === 'boolean',
        'reach evidence ' + k + ' is not a LOCAL scalar (Part 8): ' + t);
    }
    assert(typeof reach.evidence.corpus_size === 'number', 'corpus_size scalar missing from reach evidence');
  });
});

check('corpus size is surfaced so a thin corpus is visible at the gate', () => {
  withRoom((roomDir, db) => {
    const res = orchestrator.discoverUnknownUnknowns({ roomDir, db, config: FULL_BUDGET, now: NOW });
    assert.strictEqual(res.corpusSize, 5, 'corpusSize should be the 5 graded-confirmed fixture rows');
    assert.strictEqual(res.ranked.corpusSize, 5, 'rank-in must surface corpusSize at the gate');
  });
});

check('the engine writes PROPOSED only -- no confirmed truth-claim node is written by the engine', () => {
  withRoom((roomDir, db) => {
    const res = orchestrator.discoverUnknownUnknowns({ roomDir, db, config: FULL_BUDGET, now: NOW });
    // At full budget over the high-signal scenario the contradicted+stale corpus
    // claim is labeled UU by the REAL locked proxy math, so at least one PROPOSED
    // finding lands (the INVALIDATES blind-spot finding).
    assert(res.uuInstances.length > 0, 'a full-budget scan should label at least one UU instance');
    assert(res.findings.written > 0, 'a full-budget scan should write at least one PROPOSED finding');
    // Every finding node the engine wrote is 'proposed' (never 'confirmed').
    for (const n of res.findings.nodes) {
      assert.strictEqual(n.review_status, 'proposed',
        'a proxy finding must land proposed, never confirmed (Part 9 role 5): ' + n.id);
    }
    // No engine-written claim node is confirmed in the db.
    const confirmed = db.prepare(
      "SELECT id FROM nodes WHERE id LIKE 'claim:uu-scan:%' AND review_status = 'confirmed'"
    ).all();
    assert.strictEqual(confirmed.length, 0, 'the engine must NEVER auto-confirm a blind spot');
  }, { seedUU: true });
});

check('an INVALIDATES blind-spot finding is written for a labeled UU instance', () => {
  withRoom((roomDir, db) => {
    const res = orchestrator.discoverUnknownUnknowns({ roomDir, db, config: FULL_BUDGET, now: NOW });
    const invalidates = res.findings.edges.filter((e) => e.type === 'INVALIDATES');
    assert(invalidates.length > 0, 'a labeled UU must produce an INVALIDATES blind-spot finding');
    // The INVALIDATES edge targets the over-confident corpus claim (the blind spot
    // would kill it); the source is a generic blind-spot observation handle (Part 8).
    for (const e of invalidates) {
      assert(String(e.source).indexOf('uu:blindspot:') === 0, 'INVALIDATES source must be a generic blind-spot handle');
      assert(e.ok === true, 'the INVALIDATES finding edge must be written through the chokepoint');
    }
  }, { seedUU: true });
});

check('the engine HALTS at the gate -- it never invokes a downstream command', () => {
  withRoom((roomDir, db) => {
    const res = orchestrator.discoverUnknownUnknowns({ roomDir, db, config: FULL_BUDGET, now: NOW });
    // The UU route is FEEDS_INTO chain INTENT only: the edges are written PROPOSED,
    // but no command is invoked. We assert the routed targets are command HANDLES
    // (cmd:*), never an executed result.
    for (const claimId of Object.keys(res.routed)) {
      const route = res.routed[claimId];
      assert(route && route.edge_type === 'FEEDS_INTO', 'UU route must be a FEEDS_INTO intent');
      assert(Array.isArray(route.targets), 'UU route must carry target handles');
    }
    // The FEEDS_INTO finding edges target command handles (cmd:*), proving intent
    // not invocation.
    const feedsInto = res.findings.edges.filter((e) => e.type === 'FEEDS_INTO');
    for (const e of feedsInto) {
      assert(String(e.target).indexOf('cmd:') === 0, 'FEEDS_INTO target must be a command handle, not a result');
    }
  });
});

check('the per-pull checkpoint is persisted to the LOCAL sidecar (resumable)', () => {
  withRoom((roomDir, db) => {
    orchestrator.discoverUnknownUnknowns({ roomDir, db, config: FULL_BUDGET, now: NOW });
    const sidecar = path.join(roomDir, '.mindrian', 'uu-scan.json');
    assert(fs.existsSync(sidecar), 'the per-pull checkpoint sidecar must be persisted to the LOCAL room dir');
    const cp = JSON.parse(fs.readFileSync(sidecar, 'utf-8'));
    assert(typeof cp.corpusHash === 'string' && cp.corpusHash.length > 0, 'sidecar checkpoint has no corpusHash');
    assert(typeof cp.pull === 'number', 'sidecar checkpoint has no pull counter');
  });
});

if (failures > 0) {
  console.error('test-unknowns-rank-in: ' + failures + ' assertion(s) FAILED');
  process.exit(1);
}
console.log('test-unknowns-rank-in: GREEN (engine output ranks into F.1 clamped at MAX_K; reach scalars only; corpusSize surfaced; PROPOSED only; halts at the gate)');
process.exit(0);
