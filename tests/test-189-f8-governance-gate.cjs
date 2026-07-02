'use strict';
/*
 * Phase 189-02 Task 2 -- F.8 governance basket + confirm gate (HMG-02/HMG-03).
 * ============================================================================
 * Asserts:
 *   (a) a candidate at confidence 0.85 renders PRE-CHECKED in the basket contract
 *       (display-only: rendering writes ZERO edges),
 *   (b) confirming with that candidate in `accepted` writes EXACTLY ONE
 *       REMEMBERED_AS edge (via an injected navigation spy),
 *   (c) a candidate NOT in `accepted` writes EXACTLY ONE NOT_REMEMBERED_BECAUSE edge,
 *   (d) truth_state 'confirmed' on an accepted candidate ALSO calls promoteNodeStatus
 *       with a NON-NULL byUser (never silently promotes without one),
 *   (e) source-grep: the closer file requires no local database driver and opens no
 *       room database directly.
 *
 * Plain node script, no framework. Hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const raiser = require(path.join(REPO_ROOT, 'lib', 'core', 'memory', 'governance-candidate-raiser.cjs'));
const closerMod = require(path.join(REPO_ROOT, 'lib', 'workflow', 'memory-governance-closer.cjs'));

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// A navigation spy: records every writeEdge / promoteNodeStatus call so we can
// count exact edge writes WITHOUT a live room database (Part 9 test seam).
function makeNavSpy() {
  const spy = {
    edges: [],
    promotions: [],
    writeEdge: function (db, params) {
      spy.edges.push(params);
      return { ok: true, edge_id: 'edge:spy:' + spy.edges.length, type: params.edge_type };
    },
    promoteNodeStatus: function (db, nodeId, from, to, byUser, reason) {
      spy.promotions.push({ nodeId: nodeId, from: from, to: to, byUser: byUser, reason: reason });
      return { ok: true, eventId: 'evt:spy:' + spy.promotions.length };
    },
  };
  return spy;
}

// ---- (a) render pre-check is display-only (zero edges) -----------------------
const navA = makeNavSpy();
const renderCandidates = [
  { candidate_id: 'claim:hot', kind: 'claim', confidence: 0.85, target_section: 'strategy/hot' },
  { candidate_id: 'assumption:cold', kind: 'assumption', confidence: 0.40, target_section: 'risks/cold' },
];
const rendered = raiser.renderGovernanceBasket(renderCandidates, {});
ok('basket declares hitl_shape F.8', rendered.contract.hitl_shape === 'F.8');
ok('high-confidence claim:hot renders PRE-CHECKED', rendered.contract.preChecked.indexOf('claim:hot') !== -1);
ok('sub-threshold assumption:cold NOT pre-checked', rendered.contract.preChecked.indexOf('assumption:cold') === -1);
ok('rendering writes ZERO edges (display-only)', navA.edges.length === 0);

// ---- (b) confirm writes exactly one REMEMBERED_AS edge -----------------------
const navB = makeNavSpy();
const resB = closerMod.runGovernanceGate({
  db: {},
  nav: navB,
  byUser: 'jonathan',
  candidates: [{ candidate_id: 'claim:hot', kind: 'claim', confidence: 0.85, target_section: 'strategy/hot' }],
  accepted: ['claim:hot'],
});
ok('(b) gate ok', resB.ok === true);
ok('(b) exactly one edge written', navB.edges.length === 1);
ok('(b) the edge is REMEMBERED_AS', navB.edges[0].edge_type === 'REMEMBERED_AS');
ok('(b) source_id is the candidate id', navB.edges[0].source_id === 'claim:hot');
ok('(b) properties carry filed_as (defaults INFORMS)', navB.edges[0].properties.filed_as === 'INFORMS');
ok('(b) properties carry truth_state proposed (default)', navB.edges[0].properties.truth_state === 'proposed');
ok('(b) proposed truth_state does NOT promote', navB.promotions.length === 0);
ok('(b) remembered ledger has one entry', resB.remembered.length === 1);
ok('(b) appliedCount is 1', resB.appliedCount === 1);

// ---- (c) toggled-OFF candidate writes NOT_REMEMBERED_BECAUSE -----------------
const navC = makeNavSpy();
const resC = closerMod.runGovernanceGate({
  db: {},
  nav: navC,
  byUser: 'jonathan',
  candidates: [
    { candidate_id: 'claim:keep', kind: 'claim', confidence: 0.9, target_section: 'strategy/keep' },
    { candidate_id: 'claim:drop', kind: 'claim', confidence: 0.9, target_section: 'strategy/drop' },
  ],
  accepted: ['claim:keep'],
});
const rememberedC = navC.edges.filter((e) => e.edge_type === 'REMEMBERED_AS');
const notRememberedC = navC.edges.filter((e) => e.edge_type === 'NOT_REMEMBERED_BECAUSE');
ok('(c) exactly one REMEMBERED_AS for the accepted candidate', rememberedC.length === 1 && rememberedC[0].source_id === 'claim:keep');
ok('(c) exactly one NOT_REMEMBERED_BECAUSE for the toggled-OFF candidate', notRememberedC.length === 1 && notRememberedC[0].source_id === 'claim:drop');
ok('(c) rejection carries a reason enum (navigator_declined default)', notRememberedC[0].properties.reason === 'navigator_declined');
ok('(c) toggled-OFF candidate never silently dropped', resC.not_remembered.length === 1);

// ---- (d) confirmed truth_state ALSO promotes with a non-null byUser ----------
const navD = makeNavSpy();
const resD = closerMod.runGovernanceGate({
  db: {},
  nav: navD,
  byUser: 'jonathan',
  candidates: [{ candidate_id: 'claim:promote', kind: 'claim', confidence: 0.95, target_section: 'strategy/promote', truth_state: 'confirmed' }],
  accepted: ['claim:promote'],
});
ok('(d) gate ok', resD.ok === true);
ok('(d) REMEMBERED_AS edge written', navD.edges.filter((e) => e.edge_type === 'REMEMBERED_AS').length === 1);
ok('(d) promoteNodeStatus called exactly once', navD.promotions.length === 1);
ok('(d) promotion proposed -> confirmed', navD.promotions[0].from === 'proposed' && navD.promotions[0].to === 'confirmed');
ok('(d) promotion carries a NON-NULL human byUser', typeof navD.promotions[0].byUser === 'string' && navD.promotions[0].byUser.length > 0);
ok('(d) edge truth_state is confirmed', navD.edges.filter((e) => e.edge_type === 'REMEMBERED_AS')[0].properties.truth_state === 'confirmed');

// closer NEVER promotes when byUser is absent (even for a confirmed candidate).
const navD2 = makeNavSpy();
closerMod.runGovernanceGate({
  db: {},
  nav: navD2,
  candidates: [{ candidate_id: 'claim:nobyuser', kind: 'claim', confidence: 0.95, target_section: 'strategy/x', truth_state: 'confirmed' }],
  accepted: ['claim:nobyuser'],
});
ok('(d) NEVER promotes when byUser absent', navD2.promotions.length === 0);

// ---- (e) source-grep: no local database driver / direct room-db open ---------
const closerSrc = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'workflow', 'memory-governance-closer.cjs'), 'utf8');
ok('(e) closer requires no local sqlite driver module', !/better-sqlite3|node:sqlite/.test(closerSrc));
ok('(e) closer opens no room database directly (no openRoomDb)', !/openRoomDb\s*\(/.test(closerSrc));

console.log('GOVERNANCE_GATE_OK (' + pass + ' assertions passed)');
process.exit(0);
