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
 * Phase 298-04 (D-01) extension: renderGovernanceBasket's toggle LABEL is now the
 * truncated claim text, not the candidate_id, so the (a) pre-check assertions below
 * look up each option by contract.superset_options[i].id instead of comparing a
 * label directly to a candidate id. New assertions pin the readable-row fold
 * (contract.superset_options carrying id/label/description/rank), the Part 8
 * no-egress property of the serialized card, and that the frozen MAX_TOGGLE_N
 * paging / 0.70 pre-check behavior from this call site is unchanged.
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
  {
    candidate_id: 'claim:hot', kind: 'claim', confidence: 0.85, target_section: 'strategy/hot',
    claim_text: 'Cold start kills early activation before day 3', knowledge_type: 'causal',
    source_path: 'strategy/CONTEXT.md',
  },
  {
    candidate_id: 'assumption:cold', kind: 'assumption', confidence: 0.40, target_section: 'risks/cold',
    claim_text: 'Users will tolerate a slower onboarding flow', knowledge_type: 'assumption',
    source_path: 'risks/CONTEXT.md',
  },
];
const rendered = raiser.renderGovernanceBasket(renderCandidates, {});
ok('basket declares hitl_shape F.8', rendered.contract.hitl_shape === 'F.8');
// Phase 298-04 (D-01): the label is now the truncated claim text, not the
// candidate_id, so look each option up by contract.superset_options[i].id
// rather than comparing a label directly to a candidate id.
const hotOption = rendered.contract.superset_options.find((o) => o.id === 'claim:hot');
const coldOption = rendered.contract.superset_options.find((o) => o.id === 'assumption:cold');
ok('high-confidence claim:hot renders PRE-CHECKED', !!hotOption && rendered.contract.preChecked.indexOf(hotOption.label) !== -1);
ok('sub-threshold assumption:cold NOT pre-checked', !!coldOption && rendered.contract.preChecked.indexOf(coldOption.label) === -1);
ok('rendering writes ZERO edges (display-only)', navA.edges.length === 0);

// ---- Phase 298-04 (D-01): readable-row superset_options fold -----------------
ok(
  'superset_options has one entry per rendered candidate',
  Array.isArray(rendered.contract.superset_options) && rendered.contract.superset_options.length === renderCandidates.length
);
ok(
  'every superset_options entry carries id/label/description/rank',
  rendered.contract.superset_options.every((o) => typeof o.id === 'string'
    && typeof o.label === 'string' && typeof o.description === 'string' && typeof o.rank === 'number')
);
ok(
  'superset_options[0].description matches "<kind> -> <section>, conf 0.xx, from <path>"',
  /^\w+ -> .+, conf 0\.\d+, from /.test(rendered.contract.superset_options[0].description)
);
ok(
  'superset_options[0].label is NOT the candidate id and equals the truncated claim text',
  rendered.contract.superset_options[0].label !== rendered.contract.superset_options[0].id
    && rendered.contract.superset_options[0].label === renderCandidates[0].claim_text
);

// ---- Phase 298-04: Part 8 no-egress assertion ---------------------------------
const renderedSerialized = JSON.stringify(rendered);
ok('Part 8: serialized rendered card contains no brain_ substring', renderedSerialized.indexOf('brain_') === -1);
const raiserSrc = fs.readFileSync(
  path.join(REPO_ROOT, 'lib', 'core', 'memory', 'governance-candidate-raiser.cjs'), 'utf8'
);
ok('Part 8: raiser module requires no brain-client.cjs (no network egress)', !/require\(['"][^'"]*brain-client\.cjs['"]\)/.test(raiserSrc));

// ---- Phase 298-04: frozen scalars unchanged from this call site --------------
// Five candidates -> paging behavior (D-05), never truncation to four; the 0.70
// pre-check threshold (D-06) still holds. No claim_text supplied here, so labels
// fall back to candidate_id -- exactly the pre-298-04 fallback path.
const fiveCandidates = [
  { candidate_id: 'claim:one', kind: 'claim', confidence: 0.82, target_section: 'sec/one' },
  { candidate_id: 'claim:two', kind: 'claim', confidence: 0.55, target_section: 'sec/two' },
  { candidate_id: 'claim:three', kind: 'claim', confidence: 0.30, target_section: 'sec/three' },
  { candidate_id: 'claim:four', kind: 'claim', confidence: 0.20, target_section: 'sec/four' },
  { candidate_id: 'claim:five', kind: 'claim', confidence: 0.10, target_section: 'sec/five' },
];
const renderedFive = raiser.renderGovernanceBasket(fiveCandidates, {});
ok(
  'five candidates: full option count reflects MAX_TOGGLE_N paging, not a 4-item truncation',
  renderedFive.contract.options.length === 5 && renderedFive.contract.paged === true && renderedFive.contract.pages === 2
);
ok('five candidates: confidence 0.82 is pre-checked', renderedFive.contract.preChecked.indexOf('claim:one') !== -1);
ok('five candidates: confidence 0.55 is NOT pre-checked', renderedFive.contract.preChecked.indexOf('claim:two') === -1);

// ---- (b) confirm writes exactly one REMEMBERED_AS edge -----------------------
const navB = makeNavSpy();
const resB = closerMod.runGovernanceGate({
  db: {},
  nav: navB,
  byUser: 'jonathan',
  candidates: [{ candidate_id: 'claim:hot', kind: 'claim', confidence: 0.85, target_section: 'strategy/hot', layer: 'within-session' }],
  accepted: ['claim:hot'],
});
ok('(b) gate ok', resB.ok === true);
// 189-04 WHO: an accepted candidate now writes REMEMBERED_AS + ATTRIBUTED_TO (two
// edges), so count by type instead of a bare total.
ok('(b) exactly one REMEMBERED_AS edge written', navB.edges.filter((e) => e.edge_type === 'REMEMBERED_AS').length === 1);
ok('(b) exactly one ATTRIBUTED_TO edge written (WHO)', navB.edges.filter((e) => e.edge_type === 'ATTRIBUTED_TO').length === 1);
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
    { candidate_id: 'claim:keep', kind: 'claim', confidence: 0.9, target_section: 'strategy/keep', layer: 'within-session' },
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
  candidates: [{ candidate_id: 'claim:promote', kind: 'claim', confidence: 0.95, target_section: 'strategy/promote', truth_state: 'confirmed', layer: 'within-session' }],
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
  candidates: [{ candidate_id: 'claim:nobyuser', kind: 'claim', confidence: 0.95, target_section: 'strategy/x', truth_state: 'confirmed', layer: 'within-session' }],
  accepted: ['claim:nobyuser'],
});
ok('(d) NEVER promotes when byUser absent', navD2.promotions.length === 0);

// ---- (e) source-grep: no local database driver / direct room-db open ---------
const closerSrc = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'workflow', 'memory-governance-closer.cjs'), 'utf8');
ok('(e) closer requires no local sqlite driver module', !/better-sqlite3|node:sqlite/.test(closerSrc));
ok('(e) closer opens no room database directly (no openRoomDb)', !/openRoomDb\s*\(/.test(closerSrc));

console.log('GOVERNANCE_GATE_OK (' + pass + ' assertions passed)');
process.exit(0);
