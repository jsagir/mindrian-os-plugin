'use strict';
/*
 * Phase 189-04 Task 1 -- WHO attribution + cross-room second-confirm delegation +
 * raiser routing (HMG-05 / HMG-06 / HMG-07).
 * ============================================================================
 * Asserts:
 *   (a) a confirmed candidate WITHOUT a layer fails CLOSED with reason
 *       'layer_required' and writes ZERO edges beyond the already-written
 *       REMEMBERED_AS -- WHO is never a silent default (T-189-04-02),
 *   (b) a confirmed candidate with layer 'within-session' writes EXACTLY ONE
 *       ATTRIBUTED_TO edge carrying that memory_layer property,
 *   (c) a confirmed candidate with layer 'cross-room' does NOT link across rooms
 *       here -- it returns cross_room_pending with the candidate's target_id and
 *       the closer NEVER calls runUmbilicalGate itself (T-189-04-01),
 *   (d) routeCandidate returns 'F.9' for a 2-section candidate and 'F.8' for a
 *       1-section candidate.
 *
 * Plain node script, no framework. Hyphens only, no em-dashes. No emoji.
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

// ---- (a) missing layer fails CLOSED, never a silent default -------------------
// Assert the exact reason via the per-item closer directly (deterministic), and the
// edge count via the composed gate.

// (a.1) the closer returns reason 'layer_required' and writes ONLY REMEMBERED_AS.
const navA1 = makeNavSpy();
const ctxA1 = {
  db: {},
  byUser: 'jonathan',
  nav: navA1,
  byLabel: { 'claim:nolayer': { candidate_id: 'claim:nolayer', kind: 'claim', confidence: 0.9, target_section: 'strategy/x' } },
  session_id: 'sess-1',
  attributedTo: null,
  source_room: 'room-a',
  remembered: [],
  not_remembered: [],
  cross_room_pending: [],
};
const closerA1 = closerMod.makeGovernanceCloser(ctxA1);
const outA1 = closerA1.closeOffer({ pick: 'accept', offer: { command: 'claim:nolayer' } });
ok('(a) missing-layer accept fails closed', outA1.ok === false);
ok('(a) fail-closed reason is layer_required', outA1.reason === 'layer_required');
ok('(a) REMEMBERED_AS already written before the fail-close', navA1.edges.filter((e) => e.edge_type === 'REMEMBERED_AS').length === 1);
ok('(a) ZERO ATTRIBUTED_TO edges beyond the REMEMBERED_AS', navA1.edges.filter((e) => e.edge_type === 'ATTRIBUTED_TO').length === 0);
ok('(a) never promotes on a fail-closed', navA1.promotions.length === 0);
ok('(a) never pushes to the remembered ledger on a fail-closed', ctxA1.remembered.length === 0);

// (a.2) the composed gate: a layer-less confirm writes ONLY REMEMBERED_AS (no WHO).
const navA2 = makeNavSpy();
const resA2 = closerMod.runGovernanceGate({
  db: {},
  nav: navA2,
  byUser: 'jonathan',
  candidates: [{ candidate_id: 'claim:nolayer', kind: 'claim', confidence: 0.9, target_section: 'strategy/x' }],
  accepted: ['claim:nolayer'],
});
ok('(a) gate writes exactly one REMEMBERED_AS for the layer-less confirm', navA2.edges.filter((e) => e.edge_type === 'REMEMBERED_AS').length === 1);
ok('(a) gate writes ZERO ATTRIBUTED_TO for the layer-less confirm', navA2.edges.filter((e) => e.edge_type === 'ATTRIBUTED_TO').length === 0);
ok('(a) layer-less confirm is not counted as applied', resA2.appliedCount === 0);
ok('(a) layer-less confirm is not in the remembered ledger', resA2.remembered.length === 0);

// ---- (b) layer within-session writes exactly one ATTRIBUTED_TO edge -----------
const navB = makeNavSpy();
const resB = closerMod.runGovernanceGate({
  db: {},
  nav: navB,
  byUser: 'jonathan',
  session_id: 'sess-1',
  candidates: [{ candidate_id: 'claim:hot', kind: 'claim', confidence: 0.85, target_section: 'strategy/hot', layer: 'within-session' }],
  accepted: ['claim:hot'],
});
const attB = navB.edges.filter((e) => e.edge_type === 'ATTRIBUTED_TO');
ok('(b) gate ok', resB.ok === true);
ok('(b) exactly one REMEMBERED_AS edge', navB.edges.filter((e) => e.edge_type === 'REMEMBERED_AS').length === 1);
ok('(b) exactly one ATTRIBUTED_TO edge', attB.length === 1);
ok('(b) ATTRIBUTED_TO source_id is the candidate', attB[0].source_id === 'claim:hot');
ok('(b) ATTRIBUTED_TO carries memory_layer within-session', attB[0].properties.memory_layer === 'within-session');
ok('(b) ATTRIBUTED_TO carries an attributed_at scalar', typeof attB[0].properties.attributed_at === 'number');
ok('(b) attributed target defaults to the session handle', attB[0].target_id === 'session:sess-1');
ok('(b) remembered ledger records the layer', resB.remembered.length === 1 && resB.remembered[0].memory_layer === 'within-session');
ok('(b) NOT cross-room -> no cross_room_pending item', Array.isArray(resB.cross_room_pending) && resB.cross_room_pending.length === 0);
ok('(b) gate signals should_reoffer', resB.should_reoffer === true);

// (b.2) an explicit attributedTo overrides the session default.
const navB2 = makeNavSpy();
const resB2 = closerMod.runGovernanceGate({
  db: {},
  nav: navB2,
  attributedTo: 'persona:larry',
  candidates: [{ candidate_id: 'claim:persona', kind: 'claim', confidence: 0.8, target_section: 'strategy/p', layer: 'across-session' }],
  accepted: ['claim:persona'],
});
const attB2 = navB2.edges.filter((e) => e.edge_type === 'ATTRIBUTED_TO');
ok('(b) explicit attributedTo is honored', attB2.length === 1 && attB2[0].target_id === 'persona:larry');
ok('(b) across-session layer rides the ATTRIBUTED_TO edge', attB2[0].properties.memory_layer === 'across-session');

// ---- (c) layer cross-room defers to a SEPARATE second confirm ----------------
const navC = makeNavSpy();
const resC = closerMod.runGovernanceGate({
  db: {},
  nav: navC,
  byUser: 'jonathan',
  session_id: 'sess-1',
  source_room: 'room-a',
  candidates: [{ candidate_id: 'claim:global', kind: 'claim', confidence: 0.91, target_section: 'strategy/g', layer: 'cross-room' }],
  accepted: ['claim:global'],
});
ok('(c) gate ok', resC.ok === true);
ok('(c) cross-room STILL writes REMEMBERED_AS + ATTRIBUTED_TO locally', navC.edges.filter((e) => e.edge_type === 'REMEMBERED_AS').length === 1 && navC.edges.filter((e) => e.edge_type === 'ATTRIBUTED_TO').length === 1);
ok('(c) ATTRIBUTED_TO memory_layer is cross-room', navC.edges.filter((e) => e.edge_type === 'ATTRIBUTED_TO')[0].properties.memory_layer === 'cross-room');
ok('(c) NO cross-room link edge is written here (never automatic)', navC.edges.filter((e) => e.edge_type === 'UMBILICAL_TO').length === 0);
ok('(c) cross_room_pending has exactly one item', Array.isArray(resC.cross_room_pending) && resC.cross_room_pending.length === 1);
ok('(c) the pending item names the candidate target_id', resC.cross_room_pending[0].target_id === 'claim:global');
ok('(c) the pending item carries the source room', resC.cross_room_pending[0].target_room === 'room-a');
ok('(c) the pending item carries a governance_promotion signal', resC.cross_room_pending[0].signal === 'governance_promotion');

// (c.2) source-text guard: the closer NEVER calls runUmbilicalGate itself. The
// cross-room second confirm is ALWAYS the caller's job (T-189-04-01, by construction).
const closerSrc = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'workflow', 'memory-governance-closer.cjs'), 'utf8');
ok('(c) closer never invokes runUmbilicalGate (second confirm is the caller job)', closerSrc.indexOf('runUmbilicalGate(') === -1);
ok('(c) closer writes no UMBILICAL_TO edge type', closerSrc.indexOf('UMBILICAL_TO') === -1);

// ---- (d) routeCandidate: single-section -> F.8, multi-section -> F.9 ----------
ok('(d) 2-section candidate routes to F.9', raiser.routeCandidate({ candidate_id: 'c:multi', kind: 'claim', affected_sections: ['a', 'b'] }) === 'F.9');
ok('(d) 1-section candidate routes to F.8', raiser.routeCandidate({ candidate_id: 'c:single', kind: 'claim', affected_sections: ['a'] }) === 'F.8');
ok('(d) 3-section candidate routes to F.9', raiser.routeCandidate({ candidate_id: 'c:tri', kind: 'claim', affected_sections: ['a', 'b', 'c'] }) === 'F.9');
ok('(d) missing affected_sections degrades to F.8', raiser.routeCandidate({ candidate_id: 'c:none', kind: 'claim' }) === 'F.8');

console.log('WHO_ATTRIBUTION_OK (' + pass + ' assertions passed)');
process.exit(0);
