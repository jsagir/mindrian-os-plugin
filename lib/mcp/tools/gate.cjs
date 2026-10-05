'use strict';
// Phase 198-05 (SPEC-4, Task 2) -- gate_render + gate_answer MCP tools.
//
// gate_render composes the Mindrian gate superset card via the renderer
// ladder (lib/mcp/gate-render.cjs) for the CALLING client. Ruling 2026-10-02
// (navigator, Phase 289): a gate is the AskUserQuestion card on every Claude
// host surface (cli, desktop, cowork) on both protocol eras, and never also an
// MCP elicitation for the same decision. Claude Code declares `elicitation: {}`
// at initialize from build 2.1.280 (live wire tee, 2026-09-23; re-confirmed at
// 2.1.281, 267-TRIPOLAR-PROBES.md) and opens stdio with server/discover from
// 2.1.287, so the declaration alone no longer picks rung (a); the 2026-09-23
// "let elicitation take over on CLI" ruling is superseded. A recognized
// non-Claude host that declares elicitation keeps rung (a), the inline
// dialog (D-02); everything else gets the headless structured-text rung. The
// ruling lives in lib/mcp/gate-render.cjs detectGateCapabilities.
//
// Phase 369 plan 26 (D-16, deliverable 11): a gate answer is RECOVERABLE. gate_answer
// peeks the in-memory ledger, runs every refusal, writes the whole ratification
// inside ONE withRoomTx, and releases the ledger entry only after that COMMIT; a
// persistence failure rolls back and leaves the gate answerable. A ledger miss
// looks for the durable trace of an earlier answer (the node decision:gate:<id>
// or the gate_answer memory_event keyed by dedupe_key) and answers replayed:true
// instead of a refusal, so a response lost after persistence is recoverable by
// gate id, across a daemon restart too. The room bound and the subject's
// change_seq at mint ride on the ledger entry, so an answer after a room switch
// (room_switched) or after the subject changed (stale_subject) is refused without
// consuming; gate_expired and unknown_gate are distinct states.
//
// gate_answer accepts the canonical { gate_id, chosen, verdict } payload and,
// on an approve verdict, RATIFIES the decision by routing the write through
// lib/core/navigation.cjs (Part 9, T-198-04) -- this file never opens the
// graph store directly.
//
// T-198-10 (spoofing): gate_answer only ratifies a gate_id THIS server
// process actually minted via gate_render -- a small in-memory, single-use
// live-gate ledger (mint on gate_render, consume on gate_answer) rejects a
// forged or replayed gate_id before any write happens.
//
// Canon Part 7: reuses lib/mcp/gate-render.cjs (Task 1) for all rendering /
// answer normalization; this file is the tool surface + ratification only.
// Canon Part 8: zero Brain/network tokens.
// Canon Part 11 (born-wired): register(server, ctx) + connectors export,
// same disjoint-file module contract as lib/mcp/tools/room.cjs and
// lib/mcp/tools/graph.cjs (198-04) -- never requires those modules or
// lib/mcp/tool-router.cjs at module-load time.

const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');

const gateRender = require('../gate-render.cjs');
const gateLedger = require('../gate-ledger.cjs');
const gateRaised = require('../gate-raised.cjs');
const navigation = require('../../core/navigation.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveSessionRoomDir, resolveMcpWriteRoom, resolveMcpSessionRoom } = require('../session-room.cjs');
const goalGate = require('../../core/strategy/goal-gate.cjs');
const answerRoute = require('../answer-route.cjs');

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

// -----------------------------------------------------------------------
// Phase 365 (B2) -- the approval floor for a CLAIM subject. Called only from
// _promoteCardSubject. Reads the room floor (ROOM.md verification_floor, else
// the default) and the claim's own standing (claimStanding reads only the
// claim's outbound provenance edges and records, never the card's evidence ids,
// T-365-01). Met: the unchanged navigation.confirmNode (proposed or, after
// 365-05, needs_evidence -> confirmed, human only). Not met and proposed:
// navigation.holdForEvidence (no confirm-anyway, D-04). Not met and already
// needs_evidence: nothing is written but the audit event. These calls run
// OUTSIDE any transaction because promoteNodeStatus opens its own. A thrown
// floor read degrades to NOT confirming (floor_check_failed), never to
// confirming. Every approve that reaches the check writes exactly one
// approval_floor_checked memory_event through navigation.logMemoryEvent with
// ids, enums and scalars only (D-07, Canon Part 8): a later hand edit that
// lowers the floor leaves this trace.
// -----------------------------------------------------------------------
function _floorPromoteClaim(db, roomDir, subjectId, fromStatus, answeredVia) {
  let floor;
  let st;
  let verdict;
  try {
    floor = navigation.readVerificationFloor(roomDir);
    st = navigation.claimStanding(db, subjectId);
    verdict = navigation.standingMeetsFloor(st.standing, floor.id);
  } catch (_e) {
    return {
      subject_node_id: subjectId, subject_confirmed: false, subject_skip_reason: 'floor_check_failed',
      subject_held: false, landed_status: fromStatus,
    };
  }
  const met = !!(verdict && verdict.met === true);
  // confirmed_by stays the navigator identity on both routes (quick 261004-av2): Canon Part 9's
  // guard (promoteNodeStatus agent_attribution_forbidden) needs a human principal for a truth
  // claim, and a client-supplied name is not authenticated. The honest wording goes in the reason.
  const byUser = navigation.resolveByUser(roomDir);
  let confirmed = false;
  let skipReason = null;
  try {
    if (met) {
      const confirmResult = navigation.confirmNode(db, subjectId, byUser, answerRoute.confirmReason('gate_answer approve (card subject)', answeredVia));
      confirmed = !!(confirmResult && confirmResult.ok === true);
      if (!confirmed) {
        skipReason = (confirmResult && typeof confirmResult.reason === 'string' && confirmResult.reason.length > 0)
          ? confirmResult.reason
          : 'promotion_failed';
      }
    } else if (fromStatus === 'proposed') {
      const holdResult = navigation.holdForEvidence(db, subjectId, byUser, 'below room verification floor');
      skipReason = (holdResult && holdResult.ok === true)
        ? 'below_floor'
        : ((holdResult && typeof holdResult.reason === 'string' && holdResult.reason.length > 0) ? holdResult.reason : 'hold_failed');
    } else {
      skipReason = 'below_floor_still_held';
    }
  } catch (_e) {
    confirmed = false;
    skipReason = 'floor_check_failed';
  }
  let landed = fromStatus;
  try {
    const after = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(subjectId);
    if (after && typeof after.review_status === 'string') landed = after.review_status;
  } catch (_e) {
    landed = fromStatus;
  }
  try {
    navigation.logMemoryEvent(db, 'approval_floor_checked', {
      target_node_id: subjectId,
      floor_id: floor.id,
      floor_source: floor.source,
      standing: st.standing,
      floor_met: met,
      from_status: fromStatus,
      landed_status: landed,
      declared_max_rung: Number.isInteger(st.declared_max_rung) ? st.declared_max_rung : null,
      created_by: 'system',
    });
  } catch (_e) {
    // the audit event must never break ratification
  }
  return {
    subject_node_id: subjectId,
    subject_confirmed: confirmed,
    subject_skip_reason: skipReason,
    subject_held: landed === 'needs_evidence',
    landed_status: landed,
    floor_id: floor.id,
    floor_source: floor.source,
    standing: st.standing,
  };
}

// -----------------------------------------------------------------------
// SYS-08 (Phase 354-02) -- the seam this function closes: the meeting tool's
// public contract (lib/mcp/tool-router.cjs:1563, :1653, "approve ...
// promotes it to confirmed") says approval promotes the CARD'S SUBJECT
// CLAIM. Until now, gate_answer's approve branch only ever confirmed the
// newly-minted decision:gate:* node (writeResult.node_id below), leaving the
// original claim at review_status proposed forever -- the exact claim id a
// meeting file-meeting write hands back never got promoted, silently
// breaking the contract the response text itself makes.
//
// _promoteCardSubject(db, roomDir, live) -> { subject_node_id,
//   subject_confirmed, subject_skip_reason }. Never throws (db.prepare
// failures degrade to subject_not_found rather than propagating). Eligible
// ONLY when ALL of: live.card.subjectNodeId is a non-empty string; the card
// is not a strategy card (goalGate.ratifyGoalProposal owns strategy-card
// subjects, T-354-02); live.kind (falling back to live.card.kind) is
// 'general' (material_step and binding approvals authorize an ACTION, not a
// truth claim); the subject row exists, is type 'claim', and is
// review_status 'proposed'. evidenceNodeIds are never read or promoted here
// (T-354-01/T-354-02) -- SOURCED_FROM provenance targets only. The one
// promotion door stays navigation.confirmNode (Canon Part 9 single
// chokepoint, Phase 273); this function writes no raw INSERT/UPDATE.
// -----------------------------------------------------------------------
function _promoteCardSubject(db, roomDir, live, answeredVia) {
  const card = (live && live.card && typeof live.card === 'object') ? live.card : {};
  const subjectId = (typeof card.subjectNodeId === 'string' && card.subjectNodeId.length > 0)
    ? card.subjectNodeId
    : null;
  if (!subjectId) {
    return { subject_node_id: null, subject_confirmed: false, subject_skip_reason: 'no_subject' };
  }
  if (goalGate.isStrategyCard(card)) {
    return { subject_node_id: subjectId, subject_confirmed: false, subject_skip_reason: 'strategy_card_owned_by_goal_gate' };
  }
  const kind = (live && typeof live.kind === 'string' && live.kind.length > 0)
    ? live.kind
    : ((typeof card.kind === 'string' && card.kind.length > 0) ? card.kind : null);
  if (kind !== 'general') {
    return { subject_node_id: subjectId, subject_confirmed: false, subject_skip_reason: 'kind_not_general' };
  }
  // Plan 369-36: a mirror of a material_step or binding source is drawn as a general
  // card, but the source authorized an ACTION, not a truth claim, so the mirror's
  // approve promotes no subject either.
  if (live && typeof live.mirrorSourceKind === 'string' && live.mirrorSourceKind !== 'general') {
    return { subject_node_id: subjectId, subject_confirmed: false, subject_skip_reason: 'kind_not_general' };
  }
  let row = null;
  try {
    row = db.prepare('SELECT id, type, review_status FROM nodes WHERE id = ?').get(subjectId);
  } catch (_e) {
    row = null;
  }
  if (!row) {
    return { subject_node_id: subjectId, subject_confirmed: false, subject_skip_reason: 'subject_not_found' };
  }
  // Phase 355 Plan 22 (HIPS-06, D-39): 'opportunity' is already a
  // TRUTH_CLAIM_TYPES member (transitions.cjs), so the Phase 348
  // human-attribution guard still applies unchanged to it -- this widens
  // ONLY the type check; every other eligibility rule above (subject
  // present, not a strategy card, kind 'general', row found, proposed) and
  // navigation.confirmNode below are byte-identical for both types.
  if (row.type !== 'claim' && row.type !== 'opportunity') {
    return { subject_node_id: subjectId, subject_confirmed: false, subject_skip_reason: 'subject_not_claim' };
  }
  // Phase 365 (D-01, D-04, D-06, D-07, D-20, D-21, D-22): the approval floor.
  // A CLAIM subject (never an opportunity, D-21) in proposed or needs_evidence
  // goes through _floorPromoteClaim, which checks the room's verification floor
  // against the claim's OWN standing. The check lives here and NOT inside
  // navigation.confirmNode, which four other callers use (selector-decisions,
  // lens-engine, qualify-opportunity, room-birth) and whose body is pinned
  // byte-unchanged (Canon Part 9, tests/test-365-baseline.cjs). Every other
  // status keeps the subject_not_proposed return below; every opportunity path
  // is byte-identical to Phase 355.
  if (row.type === 'claim' && (row.review_status === 'proposed' || row.review_status === 'needs_evidence')) {
    return _floorPromoteClaim(db, roomDir, subjectId, row.review_status, answeredVia);
  }
  if (row.review_status !== 'proposed') {
    return { subject_node_id: subjectId, subject_confirmed: false, subject_skip_reason: 'subject_not_proposed' };
  }
  const confirmResult = navigation.confirmNode(
    db, subjectId, navigation.resolveByUser(roomDir), answerRoute.confirmReason('gate_answer approve (card subject)', answeredVia)
  );
  if (confirmResult && confirmResult.ok === true) {
    return { subject_node_id: subjectId, subject_confirmed: true, subject_skip_reason: null };
  }
  const failReason = (confirmResult && typeof confirmResult.reason === 'string' && confirmResult.reason.length > 0)
    ? confirmResult.reason
    : 'promotion_failed';
  return { subject_node_id: subjectId, subject_confirmed: false, subject_skip_reason: failReason };
}

// -----------------------------------------------------------------------
// Phase 355 Plan 22 (HIPS-06, 355-AI-SPEC.md Section 7) -- the gate
// acceptance-rate telemetry. Fires on an approve OR reject verdict whose
// card subject is an 'opportunity' node carrying a `verification` stamp
// prop (D-37); writes nothing for a plain claim or any other subject type,
// and nothing for defer (neither promoted nor rejected). This is telemetry
// ONLY -- a SEPARATE door from _promoteCardSubject's own promotion above,
// so a fault here can never affect ratification. Honors
// MINDRIAN_DISABLE_MEMORY_EVENT (the scripts/eureka-portfolio-report.cjs
// bankStatements precedent, 355-20); never throws.
// -----------------------------------------------------------------------
function _maybeLogGateOutcome(db, live, verdict) {
  if (verdict !== 'approve' && verdict !== 'reject') return;
  const card = (live && live.card && typeof live.card === 'object') ? live.card : {};
  const subjectId = (typeof card.subjectNodeId === 'string' && card.subjectNodeId.length > 0)
    ? card.subjectNodeId
    : null;
  if (!subjectId) return;
  let subjectRow = null;
  try {
    subjectRow = db.prepare('SELECT id, type, properties FROM nodes WHERE id = ?').get(subjectId);
  } catch (_e) {
    subjectRow = null;
  }
  if (!subjectRow || subjectRow.type !== 'opportunity') return;
  let props = {};
  try {
    props = JSON.parse(subjectRow.properties || '{}') || {};
  } catch (_e) {
    props = {};
  }
  if (typeof props.verification !== 'string' || props.verification.length === 0) return;
  if (process.env.MINDRIAN_DISABLE_MEMORY_EVENT === '1') return;
  try {
    navigation.logMemoryEvent(db, 'cross_connection_gate_outcome', {
      finding_id: subjectId,
      tier: props.verification,
      direction: (typeof props.direction === 'string' && props.direction.length > 0) ? props.direction : 'none',
      response: verdict,
    });
  } catch (_e) {
    // soft-fail: telemetry must never break gate ratification
  }
}

// -----------------------------------------------------------------------
// Phase 369 plan 26 (GREC369-01..04) -- recovery helpers.
//
// _mintContext: what a minted gate remembers about WHERE and WHAT it was drawn
// for. mintedRoomDir/mintedRoomSlug is the room the session had chosen at mint
// (a write-authority source only: session.primary, a cwd inside a room root, or
// the boot fallback; an unbound session records null and is never refused as
// room_switched, because it had no room to switch from). subjectRevision is the
// card subject's latest change_seq at mint (navigation.readEntityRevision over
// the read-only door), null when the card has no subject or the room has no feed.
// Never throws: any failure degrades to null fields, which only turns the
// matching refusal off, never on.
// -----------------------------------------------------------------------
const WRITE_AUTHORITY_SOURCES = new Set(['session.primary', 'room-root', 'boot-fallback']);

// Plan 369-38 (WR-04): at most this many evidence nodes get a recorded revision (the
// strategy card itself caps its evidence at 64, so no real card is cut short).
const EVIDENCE_REVISION_CAP = 64;

function _mintContext(sessionId, ctx, subjectNodeId, evidenceNodeIds) {
  const out = { mintedRoomDir: null, mintedRoomSlug: null, subjectRevision: null, evidenceRevisions: {} };
  let hit = null;
  try {
    hit = resolveMcpSessionRoom({ sessionId: sessionId, ctx: ctx, forWrite: true, quiet: true, noFloor: true });
  } catch (_e) {
    hit = null;
  }
  if (!hit || typeof hit.dir !== 'string' || !WRITE_AUTHORITY_SOURCES.has(hit.source)) return out;
  out.mintedRoomDir = hit.dir;
  out.mintedRoomSlug = (typeof hit.slug === 'string' && hit.slug.length > 0) ? hit.slug : null;
  const subject = (typeof subjectNodeId === 'string' && subjectNodeId.length > 0) ? subjectNodeId : null;
  const evidence = Array.isArray(evidenceNodeIds)
    ? evidenceNodeIds.filter((id) => typeof id === 'string' && id.length > 0).slice(0, EVIDENCE_REVISION_CAP)
    : [];
  const wanted = subject ? [subject].concat(evidence) : evidence;
  if (wanted.length > 0) {
    const revisions = _readRevisions(hit.dir, wanted);
    if (subject) out.subjectRevision = revisions[subject] === undefined ? null : revisions[subject];
    for (const id of evidence) {
      out.evidenceRevisions[id] = revisions[id] === undefined ? null : revisions[id];
    }
  }
  return out;
}

// Plan 369-38 (WR-04): a node's latest change_seq on this handle, or null when the
// room has no change feed yet. readEntityRevision answers 0 for BOTH "no feed" and
// "no row for this node"; recording 0 for a feedless room made the first later feed
// row read as a change (a false stale_subject). Null is "unknown", which never counts
// as changed. Pure read.
function _revisionOrNull(handle, nodeId) {
  const meta = navigation.readChangeLogMeta(handle);
  if (!meta || meta.present !== true) return null;
  return navigation.readEntityRevision(handle, 'node', nodeId);
}

// One read-only open for all the ids; any failure leaves the id out (read as unknown).
function _readRevisions(roomDir, ids) {
  const out = {};
  let ro = null;
  try {
    ro = navigation.openRoomDbReadOnlyForCaller(roomDir);
    if (!ro) return out;
    for (const id of ids) {
      try { out[id] = _revisionOrNull(ro, id); } catch (_e) { /* this id stays unknown */ }
    }
  } catch (_e) {
    return out;
  } finally {
    if (ro) {
      try { navigation.closeRoomDbForCaller(ro); } catch (_e) { /* best effort */ }
    }
  }
  return out;
}

function _sameDir(a, b) {
  try {
    return path.resolve(String(a)) === path.resolve(String(b));
  } catch (_e) {
    return false;
  }
}

// The room a gate was drawn for. Prefer what gate_render recorded; a chain halt
// gate (minted by chain.cjs) carries the room its steps run in as `roomDir`.
function _mintedRoomOf(live) {
  if (typeof live.mintedRoomDir === 'string' && live.mintedRoomDir.length > 0) return live.mintedRoomDir;
  if (live.kind === 'material_step' && typeof live.roomDir === 'string' && live.roomDir.length > 0) return live.roomDir;
  return null;
}

// Did the card's subject, or any evidence node it cites, change after the card was
// drawn? (gate_answer asks this only for an approve verdict.) Returns the id of the
// first node whose feed now holds a HIGHER change_seq than the one recorded at mint,
// else null. A node whose revision was unknown at mint (a room with no feed then) is
// never changed, and a smaller number than the recorded one means compaction removed
// the old row, not a change. Runs on any handle: the read-only one before the
// transaction (the fast path) and the write transaction's own handle inside it (the
// authoritative check, plan 369-38 WR-04).
function _changedSinceMint(handle, live) {
  const card = (live && live.card) || {};
  const recorded = [];
  if (typeof card.subjectNodeId === 'string' && card.subjectNodeId.length > 0 && typeof live.subjectRevision === 'number') {
    recorded.push([card.subjectNodeId, live.subjectRevision]);
  }
  const evidence = (live && live.evidenceRevisions && typeof live.evidenceRevisions === 'object') ? live.evidenceRevisions : {};
  for (const id of Object.keys(evidence)) {
    if (typeof evidence[id] === 'number') recorded.push([id, evidence[id]]);
  }
  for (const pair of recorded) {
    const now = _revisionOrNull(handle, pair[0]);
    if (typeof now === 'number' && now > pair[1]) return pair[0];
  }
  return null;
}

function _changedSinceMintAt(roomDir, live) {
  let ro = null;
  try {
    ro = navigation.openRoomDbReadOnlyForCaller(roomDir);
    return ro ? _changedSinceMint(ro, live) : null;
  } catch (_e) {
    return null;
  } finally {
    if (ro) {
      try { navigation.closeRoomDbForCaller(ro); } catch (_e) { /* best effort */ }
    }
  }
}

// The stale_subject answer, one place for the pre-transaction and the in-transaction
// check. It never consumes: the gate stays answerable (a defer or reject still lets
// the person dismiss the stale card).
function _staleResponse(gateId, live, changedId) {
  return textResponse({
    ok: false,
    reason: 'stale_subject',
    gate_id: gateId,
    subject_node_id: live.card.subjectNodeId,
    changed_node_id: changedId,
    message: 'The thing this card asks about changed after the card was drawn, so nothing was written. Ask for a fresh card and decide on the current version.',
  }, true);
}

// -----------------------------------------------------------------------
// Phase 369 plan 33 (SHELL369-12 visibility half, GREC369-05) -- the ledger
// observers. A gate minted for a session bound to a room, by ANY caller in this
// process (gate_render here, a chain_run halt, the research planner, the
// never-do gate, the tool router), leaves exactly one durable gate_raised record
// in that room (lib/mcp/gate-raised.cjs), and a take that leaves without a
// recorded answer leaves one gate_closed record. The observer sits on the ledger
// (gate-ledger.cjs setGateObservers), so none of the seven minting callers is
// edited and a gate raised in Claude Code's own stdio process becomes visible to
// the daemon the shell talks to, through the room (the one medium both share).
//
// Which room: the one the mint already knows (mintedRoomDir, set by gate_render's
// _mintContext; roomDir, set by chain halts and never-do mints), else the room the
// entry's session is bound to, accepted only from a write-authority source (the
// rule _mintContext applies). A mint with no room records nothing; a binding
// card and a mirror (plan 369-36) are skipped by gate-raised.cjs itself. ctx: the
// per-process ctx register(server, ctx) receives is boot configuration
// (fallbackRoomDir, surface); with noFloor:true the resolver never reads it, so
// the observer resolves with an empty one and works for every minter, including
// those that never see a ctx. A written record sets raisedRoomDir on the stored
// entry so the take can close the same room. Neither observer ever throws.
// -----------------------------------------------------------------------
function _roomForMintedGate(entry) {
  if (typeof entry.mintedRoomDir === 'string' && entry.mintedRoomDir.length > 0) return entry.mintedRoomDir;
  if (typeof entry.roomDir === 'string' && entry.roomDir.length > 0) return entry.roomDir;
  let hit = null;
  try {
    hit = resolveMcpSessionRoom({ sessionId: entry.sessionId, ctx: {}, forWrite: true, quiet: true, noFloor: true });
  } catch (_e) {
    hit = null;
  }
  if (!hit || typeof hit.dir !== 'string' || !WRITE_AUTHORITY_SOURCES.has(hit.source)) return null;
  return hit.dir;
}

function _onGateMinted(gateId, entry) {
  if (!entry || typeof entry !== 'object' || entry.kind === 'binding' || entry.mirrorOf) return;
  const roomDir = _roomForMintedGate(entry);
  if (!roomDir) return;
  const recorded = gateRaised.recordRaised(roomDir, gateId, entry);
  if (recorded && recorded.ok === true) entry.raisedRoomDir = roomDir;
}

function _onGateTaken(gateId, entry) {
  if (!entry || typeof entry.raisedRoomDir !== 'string' || entry.raisedRoomDir.length === 0) return;
  gateRaised.recordClosedIfUnanswered(entry.raisedRoomDir, gateId);
}

gateLedger.setGateObservers({ onMint: _onGateMinted, onTake: _onGateTaken });

// Test-only fault markers (MINDRIAN_TEST_MODE=1, never set by the plugin): a
// file inside the BOUND room's .mindrian directory, deleted when used. They let
// the live-daemon recovery test force the two hard states (a persistence failure
// after the first write, an expired gate) without chmod, which is unreliable as
// root and on WSL drvfs. Without MINDRIAN_TEST_MODE=1 the files are never read.
function _takeTestFault(roomDir, name) {
  if (process.env.MINDRIAN_TEST_MODE === '1') {
    try {
      const file = path.join(roomDir, '.mindrian', '.test-fault-' + name);
      if (!fs.existsSync(file)) return null;
      const body = fs.readFileSync(file, 'utf8').trim();
      fs.unlinkSync(file);
      return { body: body };
    } catch (_e) {
      return null;
    }
  }
  return null;
}

// A soft ratification step (the card-subject promotion, the strategy goal
// ratification): its own fault never flips the answer, and a fault part-way
// through must not leave half a write inside the open ratification transaction,
// so the step runs under a SAVEPOINT that is rolled back on a throw.
function _softStep(db, name, run, onFault) {
  db.exec('SAVEPOINT ' + name);
  try {
    const result = run();
    db.exec('RELEASE ' + name);
    return result;
  } catch (e) {
    try {
      db.exec('ROLLBACK TO ' + name);
      db.exec('RELEASE ' + name);
    } catch (_e) { /* the outer transaction decides */ }
    return onFault(e);
  }
}

// -----------------------------------------------------------------------
// T-198-10 spoofing mitigation, now on the SHARED ledger: gate_answer only
// ratifies a gate_id THIS process minted via gate_render, single-use, TTL-
// bounded. Phase 238-02 built lib/mcp/gate-ledger.cjs as the ONE ledger both
// this file and chain.cjs mint into and consume from -- until 238-03, this
// file kept its own private _liveGates Map, minted separately from chain.
// cjs's own _resumeLedger under the SAME T-198-10 doctrine, and the two were
// never joined: a gate_id minted by a chain halt could not be consumed by a
// gate answer (238-RESEARCH.md Finding 1). This block is the gate-side half
// of joining them; 238-04 re-points chain.cjs onto the same module.
//
// gateLedger.cjs is NOT a lib/mcp/tools/*.cjs module (it lives one directory
// up), so requiring it here mirrors this file's own pre-existing require of
// ../gate-render.cjs -- not a tools/tools collision under the disjoint-file
// contract (lib/mcp/register-core-tools.cjs).
//
// _mintLiveGate / _consumeLiveGate stay as real named functions so the
// existing tests/test-198-*.cjs files (which reach through _internal) keep
// resolving; they are now thin wrappers over gateLedger.mintGate/consumeGate.
// Phase 365 (D-05, D-24): an optional fourth argument is merged into the ledger
// entry BEFORE the three fixed fields, so it can carry the composer's predicted
// landing (`floor_prediction`) but can never override card, sessionId or kind.
function _mintLiveGate(gateId, card, sessionId, extra) {
  const more = (extra && typeof extra === 'object') ? extra : {};
  // Quick 261005-mux: a caller that rendered the card names its renderer in `extra`; a caller that did not
  // (a direct mint) stores 'none', so every ledger entry says which rung showed its card.
  return gateLedger.mintGate(gateId, Object.assign({ renderer: 'none' }, more, {
    card: card,
    sessionId: sessionId,
    kind: (card && typeof card.kind === 'string' && card.kind.length > 0) ? card.kind : 'general',
  }));
}

function _consumeLiveGate(gateId, sessionId) {
  return gateLedger.consumeGate(gateId, sessionId);
}

// Phase 369 plan 26 (GREC369-01): durable consumption. The ratification path
// releases the entry only AFTER its transaction commits.
function _releaseLiveGate(gateId, sessionId) {
  return gateLedger.releaseGate(gateId, sessionId);
}

// Phase 289 (D-04, LEDGER289-02): the non-consuming read gate_answer uses to
// run every refusal before it takes the gate. Same return contract as
// _consumeLiveGate (null / { ok:false, reason:'session_mismatch' } / the entry).
function _peekLiveGate(gateId, sessionId) {
  return gateLedger.peekGate(gateId, sessionId);
}

/**
 * detectClientCapabilities -- a one-line delegate to the one shared ruling,
 * gateRender.detectGateCapabilities (lib/mcp/gate-render.cjs). Ruling
 * 2026-10-02 (navigator, Phase 289): a gate is the AskUserQuestion card on
 * every Claude host surface on both protocol eras, never also an MCP
 * elicitation for the same decision, even when the client declares
 * elicitation (Claude Code does from build 2.1.280, live wire tee 2026-09-23;
 * stdio opens with server/discover from 2.1.287, 267-TRIPOLAR-PROBES.md). A
 * recognized non-Claude host that declares elicitation keeps rung (a), the
 * inline dialog (D-02). The 2026-09-23 "let elicitation take over on CLI"
 * ruling is superseded. gate-render.cjs is not a tools/*.cjs module, so the
 * disjoint-file seam holds.
 */
function detectClientCapabilities(server, ctx) {
  return gateRender.detectGateCapabilities(server, ctx);
}

const gateOptionSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().min(1),
  description: z.string().optional(),
  rank: z.number().optional(),
  preview: z.string().optional(),
  // Phase 289 review WR-05: zod strips unknown keys, so without this field an
  // explicit recommended flag sent through the tool was dropped before
  // normalizeCard saw it, and a multi-select basket could never carry one.
  recommended: z.boolean().optional()
    .describe('Mark this option as recommended. A single-select card shows one recommended option (the first flagged, else the best rank); a multi-select basket pre-selects every flagged option.'),
});

// -----------------------------------------------------------------------
// Phase 369 plan 26 (GREC369-01, GREC369-02) -- the two halves of a recoverable
// gate answer.
//
// _answerWithoutLiveGate: the ledger holds nothing for this gate id for this
// caller. Three honest states, never a bare refusal for something that was in
// fact saved: gate_expired (this process cleared or aged out the entry),
// replayed (the durable trace of an earlier answer is in the room: the gate was
// answered and the response was lost, or the daemon restarted since), and
// unknown_gate (neither). A replay writes nothing and runs nothing: a chain step
// is never re-run by it. It reads the room the session resolves for reads, over
// the read-only door; the gate id is an unguessable minted token and the answer
// carries only the recorded verdict, chosen ids and decision node id.
// -----------------------------------------------------------------------
// Plan 369-38 (WR-02, WR-06): the durable answer is read FIRST and wins over the TTL, so
// an answer committed as the 30 minutes ran out replays as recorded instead of reading
// gate_expired. A lookup that could not read the room (no usable room for the session, a
// room.db that will not open, a query that throws) is its own retryable state,
// replay_lookup_failed, never unknown_gate: unknown_gate says "no saved answer", and a
// room that could not be read cannot say that. The same holds for a session with no room
// bound of its own (the machine-wide registry room is only a read fallback): finding
// nothing there proves nothing about the room the gate was answered in.
function _lookupAnswerAnchor(sessionId, ctx, gateId) {
  const hasIdentity = typeof sessionId === 'string' && sessionId.length > 0;
  let hit = null;
  let ro = null;
  // 'cwd' is the resolver's floor: no room resolved at all, so there is no room whose
  // silence could be wrong and a read that fails there is plain absence. A session with
  // no identity at all (a session-less caller) could never have been bound, so the
  // registry fallback is its room and nothing was lost by not being bound.
  let noRoom = false;
  let unbound = false;
  try {
    hit = resolveMcpSessionRoom({ sessionId: sessionId, ctx: ctx });
    if (!hit || typeof hit.dir !== 'string' || hit.dir.length === 0) return { state: 'failed', unbound: false };
    noRoom = hit.source === 'cwd';
    unbound = hasIdentity && hit.source === 'reg.active';
    ro = navigation.openRoomDbReadOnlyForCaller(hit.dir);
    if (!ro) return noRoom ? { state: 'absent', unbound: false } : { state: 'failed', unbound: unbound };
    const anchor = navigation.readGateAnswerAnchor(ro, gateId);
    if (anchor && anchor.found === true) return { state: 'found', anchor: anchor };
    return { state: 'absent', unbound: unbound };
  } catch (_e) {
    return noRoom ? { state: 'absent', unbound: false } : { state: 'failed', unbound: unbound };
  } finally {
    if (ro) {
      try { navigation.closeRoomDbForCaller(ro); } catch (_e) { /* best effort */ }
    }
  }
}

function _replayLookupFailed(gateId) {
  return textResponse({
    ok: false,
    reason: 'replay_lookup_failed',
    gate_id: gateId,
    message: 'The room could not be read to check for a saved answer, so nothing was written and nothing is known about this gate yet. Try again in a moment, or bind the room this gate was drawn in.',
  }, true);
}

function _answerWithoutLiveGate(gateId, chosen, verdict, sessionId, ctx) {
  const found = _lookupAnswerAnchor(sessionId, ctx, gateId);
  if (found.state === 'failed') return _replayLookupFailed(gateId);
  if (found.state === 'found') {
    const anchor = found.anchor;
    const replay = {
      ok: true,
      replayed: true,
      already_answered: true,
      gate_id: gateId,
      verdict: anchor.verdict,
      ratified: anchor.verdict === 'approve',
    };
    if (Array.isArray(anchor.chosen)) replay.chosen = anchor.chosen;
    if (anchor.decision_node_id) replay.decision_node_id = anchor.decision_node_id;
    // The RECORDED route, never the route of this repeating call (quick 261004-av2).
    replay.answered_via = typeof anchor.answered_via === 'string' ? anchor.answered_via : 'unrecorded';
    if (typeof anchor.via_gate_id === 'string' && anchor.via_gate_id.length > 0) replay.via_gate_id = anchor.via_gate_id;
    if (typeof verdict === 'string' && anchor.verdict && verdict !== anchor.verdict) {
      replay.requested_verdict = verdict;
      replay.note = 'This gate was already answered with a different verdict. The recorded answer stands and nothing was changed.';
    }
    return textResponse(replay);
  }
  // No saved answer in the room that was read. A session with no room of its own cannot
  // tell "never answered" from "answered in the room it should have been bound to".
  if (found.unbound) return _replayLookupFailed(gateId);
  if (gateLedger.isGateExpired(gateId)) {
    return textResponse({
      ok: false,
      reason: 'gate_expired',
      gate_id: gateId,
      message: 'This gate ran out of time (it lives for 30 minutes), so nothing was written. Ask for the card again.',
    }, true);
  }
  return textResponse({
    ok: false,
    reason: 'unknown_gate',
    gate_id: gateId,
    message: 'No gate with this id is open in this server, and no saved answer for it was found in the room.',
  }, true);
}

// -----------------------------------------------------------------------
// _applyRatification: every write one gate answer makes, in the order
// gate_answer always made them. Called ONLY inside navigation.withRoomTx, so a
// throw rolls the whole answer back. Two failures are fatal (they throw): the
// bookkeeping memory_event not being written, and, on an approve, the decision
// node not being written, because the durable trace a replay looks for would be
// missing. The rest keep their old doctrine (a promotion or goal ratification
// fault is recorded on the response and never flips ok) but now run under a
// SAVEPOINT so a fault never leaves half a write inside the transaction.
// Returns { logResult, reasoningNode, strategyRatification }.
// -----------------------------------------------------------------------
function _applyRatification(db, roomDir, live, answer) {
  const applied = { logResult: null, reasoningNode: null, strategyRatification: null, pendingGoal: null };
  applied.logResult = navigation.logMemoryEvent(db, 'mcp_client_event_logged', {
    label: 'gate_answer',
    gate_id: answer.gate_id,
    chosen: answer.chosen,
    verdict: answer.verdict,
    // How the answer reached the room (quick 261004-av2): browser_nonce or mcp_relayed,
    // derived once from the proof, never from an argument.
    answered_via: answer.answered_via,
    // The replay anchor for a reject or defer (an approve also has its decision
    // node): readGateAnswerAnchor finds the row by this key with no time window.
    dedupe_key: 'gate_answer:' + answer.gate_id,
  });
  if (!applied.logResult || applied.logResult.ok !== true) {
    throw new Error('the answer record was not written: ' + String((applied.logResult && applied.logResult.reason) || 'unknown'));
  }
  // Test-only (MINDRIAN_TEST_MODE=1): fail after the first write so the rollback is real.
  if (_takeTestFault(roomDir, 'gate-persist')) {
    throw new Error('test fault: persistence failure injected after the first ratification write');
  }

  // Quick task 260903-i2x (T2 node-writing half) -- ADDITIVE ONLY. The
  // logMemoryEvent bookkeeping row above is unchanged; this is new
  // code alongside it, never a replacement. Only an approve verdict
  // mints a typed decision node; reject/defer write nothing extra.
  if (answer.verdict === 'approve') {
    const nodeId = navigation.REASONING_NODE_ID('decision:gate', answer.gate_id);
    if (nodeId) {
      // Derive text, bounded and local-only, never fabricated: prefer
      // the minted card's header, else the labels of the resolved
      // chosen options looked up by id, else the raw chosen ids.
      let text = '';
      if (live.card && typeof live.card.header === 'string' && live.card.header.length > 0) {
        text = live.card.header;
      } else if (live.card && Array.isArray(live.card.options)) {
        const labels = answer.chosen
          .map((id) => {
            const opt = live.card.options.find((o) => o && (o.id === id || o.label === id));
            return opt ? opt.label : null;
          })
          .filter((l) => typeof l === 'string' && l.length > 0);
        text = labels.length > 0 ? labels.join('; ') : answer.chosen.join('; ');
      } else {
        text = answer.chosen.join('; ');
      }

      // DC-2: `live` IS the ledger entry chain.cjs minted
      // with `haltedStep` (chain.cjs:350-375), so `live.haltedStep.
      // framework` is readable here with NO chain.cjs change needed.
      // DC-3: sensors.cjs's framework_run halt path mints NO ledger
      // entry (it never requires gate-ledger.cjs), so its gate can
      // never reach gate_answer and its USES_FRAMEWORK edge is
      // structurally unreachable -- a named, deliberate gap, not an
      // oversight (see CLAUDE.md handoff row).
      // Plan 369-36: a mirror carries the source record's framework handle, so its
      // decision node gets the same USES_FRAMEWORK edge the source would have written.
      const framework = (live.haltedStep && typeof live.haltedStep.framework === 'string')
        ? live.haltedStep.framework
        : ((typeof live.mirrorFramework === 'string' && live.mirrorFramework.length > 0) ? live.mirrorFramework : null);

      // live.card.subjectNodeId / evidenceNodeIds are the NORMALIZED
      // camelCase fields gate-render.cjs::normalizeCard guarantees on
      // EVERY card (quick 260903-h27), always present and always
      // defaulted -- no shape check is needed here.
      const writeResult = navigation.writeReasoningNode(db, {
        nodeId: nodeId,
        nodeType: 'decision',
        epistemicType: 'decision',
        text: text,
        sourcePath: 'gate:' + answer.gate_id,
        subjectNodeId: live.card && live.card.subjectNodeId,
        evidenceNodeIds: live.card && live.card.evidenceNodeIds,
        framework: framework,
        origin: 'gate_answer',
        answeredVia: answer.answered_via,
      });
      if (!writeResult || writeResult.ok !== true) {
        throw new Error('the decision node was not written: ' + String((writeResult && writeResult.reason) || 'unknown'));
      }

      // DC-4 / Canon Part 9 role 5: the APPROVE at a Decision
      // Gate is exactly what confirmNode exists to record (the route it came by is
      // recorded in the reason and on the node, quick 261004-av2); minting
      // 'confirmed' directly in the writer would be a
      // constitutional breach (memory-artifacts.cjs:333-339). A
      // promotion failure leaves the node at 'proposed' and is
      // recorded on the response, never thrown.
      const confirmed = _softStep(db, 'gate_confirm_decision', () => {
        const confirmResult = navigation.confirmNode(
          db, writeResult.node_id, navigation.resolveByUser(roomDir),
          answerRoute.confirmReason('gate_answer approve', answer.answered_via)
        );
        return !!(confirmResult && confirmResult.ok === true);
      }, () => false);
      let reasoningNode = Object.assign({}, writeResult, { confirmed: confirmed });

      // SYS-08 (Phase 354-02) -- ADDITIVE ONLY, own soft step so a
      // subject-promotion fault can never clobber the reasoningNode
      // the decision-node write above already assigned, and never
      // flips response.ok. The decision-node confirm above stays
      // exactly as-is: it records the human decision itself. This is
      // the SEPARATE promotion the card's own contract
      // (tool-router.cjs:1563, :1653) names: the subject CLAIM, not
      // the decision node.
      const subjectPromotion = _softStep(db, 'gate_promote_subject',
        () => _promoteCardSubject(db, roomDir, live, answer.answered_via),
        () => ({
          subject_node_id: (live.card && live.card.subjectNodeId) || null,
          subject_confirmed: false,
          subject_skip_reason: 'promotion_threw',
        }));
      reasoningNode = Object.assign({}, reasoningNode, {
        subject_node_id: subjectPromotion.subject_node_id,
        subject_confirmed: subjectPromotion.subject_confirmed,
        subject_skip_reason: subjectPromotion.subject_skip_reason,
      });
      // Phase 365: the claim floor path adds its own fields; every
      // other path (opportunity, non-claim, skips) leaves them off.
      if (subjectPromotion.landed_status !== undefined) {
        reasoningNode.subject_held = subjectPromotion.subject_held === true;
        reasoningNode.landed_status = subjectPromotion.landed_status;
      }
      if (subjectPromotion.floor_id !== undefined) {
        reasoningNode.floor_id = subjectPromotion.floor_id;
        reasoningNode.floor_source = subjectPromotion.floor_source;
        reasoningNode.standing = subjectPromotion.standing;
        // Phase 365 (D-05) TOCTOU: the card predicted a landing at render
        // time; if the claim's standing moved before the click and the
        // outcome differs, say so (a claim subject only).
        reasoningNode.floor_changed_since_render =
          typeof live.floor_prediction === 'string'
          && live.floor_prediction !== subjectPromotion.landed_status;
      }
      applied.reasoningNode = reasoningNode;

      // Phase 345-07 (STRAT-13) -- ADDITIVE ONLY, same idiom as the
      // 260903-i2x block just above (own soft step so a fault here can never
      // clobber the reasoningNode this block already assigned, and never
      // flips response.ok). Guarded on isStrategyCard: every other card kind
      // is byte-unchanged. ratifyGoalProposal writes NO decision node and NO
      // provenance edges of its own (writeReasoningNode above already did
      // both, fed by the SAME live.card.subjectNodeId/evidenceNodeIds) -- it
      // only promotes the goal anchor and, on a rewrite/change-rung approve,
      // calls the one ratified-goal writer.
      if (goalGate.isStrategyCard(live.card)) {
        applied.strategyRatification = _softStep(db, 'gate_ratify_goal',
          () => goalGate.ratifyGoalProposal(db, roomDir, {
            card: live.card,
            chosen: answer.chosen,
            verdict: answer.verdict,
            decisionNodeId: nodeId,
            confirmReason: answerRoute.confirmReason('strategy gate approve', answer.answered_via),
            // Plan 369-38 (WR-01): the goal lives in a JSON file a rollback cannot
            // undo, so the transaction only PLANS the file write; gate_answer runs it
            // after COMMIT and release.
            deferGoalFile: true,
          }),
          (e) => ({ ok: false, reason: 'goal_ratification_threw', detail: String((e && e.message) || e).slice(0, 80) }));
        if (applied.strategyRatification && applied.strategyRatification.pending_goal) {
          applied.pendingGoal = applied.strategyRatification.pending_goal;
          delete applied.strategyRatification.pending_goal;
        }
      }
    }
  }

  // Phase 355 Plan 22: telemetry only, runs for approve AND reject
  // (see _maybeLogGateOutcome's own no-op guard for defer / non-
  // opportunity subjects). Placed after the approve branch so an
  // opportunity's `verification` prop is already on the row either way.
  _maybeLogGateOutcome(db, live, answer.verdict);
  return applied;
}

// -----------------------------------------------------------------------
// Phase 369 plan 36 (SHELL369-12 answerability half, GREC369-02): the body of the
// gate_answer transaction. Before it writes anything it asks the room, on the
// transaction's OWN handle (BEGIN IMMEDIATE, so nothing can commit between the
// read and the first write), whether this gate, or the source this gate mirrors,
// already has a recorded answer, and whether a mirror's source is closed or out of
// time. The first committed answer wins: the other replays answered_elsewhere and
// writes nothing (it throws a GateStopped marker, which rolls the empty
// transaction back and is mapped to its answer after the rollback). For a mirror
// that nothing stopped, the source's answer anchor is written in the SAME
// transaction as the mirror's own answer record and decision node, so either both
// exist or neither does (D-16): a failed anchor write is fatal and rolls the whole
// answer back (persistence_failed, the mirror stays answerable).
// -----------------------------------------------------------------------
class GateStopped extends Error {
  constructor(code, recorded, sourceGateId) {
    super('gate_answer stopped: ' + code);
    this.name = 'GateStopped';
    this.code = code;
    this.recorded = recorded || null;
    this.sourceGateId = sourceGateId || null;
  }
}

// Plan 369-38 (WR-04): thrown inside the transaction, before the first write, when the
// card's subject or one of its evidence nodes changed since the card was drawn. It rolls
// the empty transaction back and is mapped to stale_subject after the rollback; the gate
// is NOT released.
class StaleSubject extends Error {
  constructor(changedId) {
    super('gate_answer stopped: stale_subject');
    this.name = 'StaleSubject';
    this.changedId = changedId;
  }
}

function _answerInTx(db, roomDir, live, answer) {
  const own = navigation.readGateAnswerAnchor(db, answer.gate_id);
  if (own && own.found === true) throw new GateStopped('answered_elsewhere', own, null);
  const sourceId = (typeof live.mirrorOf === 'string' && live.mirrorOf.length > 0) ? live.mirrorOf : null;
  if (sourceId) {
    const source = navigation.readGateState(db, sourceId, Date.now());
    if (source.state === 'answered') {
      throw new GateStopped('answered_elsewhere', Object.assign({ found: true }, source.answered), sourceId);
    }
    if (source.state === 'closed') throw new GateStopped('source_closed', null, sourceId);
    if (source.state === 'expired') throw new GateStopped('source_expired', null, sourceId);
    if (typeof live.mirrorExpiresAt === 'number' && live.mirrorExpiresAt <= Date.now()) {
      throw new GateStopped('source_expired', null, sourceId);
    }
  }
  // Plan 369-38 (WR-04): the authoritative stale check, on this transaction's own
  // handle (BEGIN IMMEDIATE, so no writer can commit between this read and the first
  // write below). An answer already recorded above wins over a stale reading.
  if (answer.verdict === 'approve') {
    const changedId = _changedSinceMint(db, live);
    if (changedId) throw new StaleSubject(changedId);
  }
  const applied = _applyRatification(db, roomDir, live, answer);
  if (sourceId) {
    const anchor = navigation.logMemoryEvent(db, 'mcp_client_event_logged', {
      label: 'gate_answer',
      gate_id: sourceId,
      chosen: answer.chosen,
      verdict: answer.verdict,
      // The mirror's own route (quick 261004-av2), and the mirror's id under via_gate_id
      // (plan 369-36 wrote the mirror id as answered_via; that meaning moved here).
      answered_via: answer.answered_via,
      via_gate_id: answer.gate_id,
      dedupe_key: 'gate_answer:' + sourceId,
    });
    if (!anchor || anchor.ok !== true) {
      throw new Error('the source answer record was not written: ' + String((anchor && anchor.reason) || 'unknown'));
    }
  }
  return applied;
}

// A read-only look at whether the room already holds an answer for this gate or the
// source it mirrors. Used only to keep stale_subject from masking answered_elsewhere
// (an approve on a mirror changes the subject, so the owner's later approve would
// otherwise read as stale); the authoritative check is the one inside the transaction.
function _answeredInRoom(roomDir, gateId, live) {
  let ro = null;
  try {
    ro = navigation.openRoomDbReadOnlyForCaller(roomDir);
    if (!ro) return false;
    if (navigation.readGateAnswerAnchor(ro, gateId).found === true) return true;
    if (live && typeof live.mirrorOf === 'string' && live.mirrorOf.length > 0) {
      return navigation.readGateAnswerAnchor(ro, live.mirrorOf).found === true;
    }
    return false;
  } catch (_e) {
    return false;
  } finally {
    if (ro) {
      try { navigation.closeRoomDbForCaller(ro); } catch (_e) { /* best effort */ }
    }
  }
}

// The answer for a transaction that stopped before writing (GateStopped). The live
// entry is released first (synchronously, before any await), so a repeat answer
// finds no ledger entry and reads the durable trace; a halted step therefore
// resumes at most once.
async function _stoppedAnswer(stop, live, answer, sessionId) {
  _releaseLiveGate(answer.gate_id, sessionId);
  if (stop.code === 'source_closed') {
    return textResponse({
      ok: false,
      reason: 'unknown_gate',
      detail: 'source_closed',
      gate_id: answer.gate_id,
      message: 'The gate this card mirrors was closed without an answer, so nothing was written.',
    }, true);
  }
  if (stop.code === 'source_expired') {
    return textResponse({
      ok: false,
      reason: 'gate_expired',
      gate_id: answer.gate_id,
      message: 'The gate this card mirrors ran out of time (it lives for 30 minutes), so nothing was written. Ask for the card again.',
    }, true);
  }
  const rec = stop.recorded || {};
  const verdict = (typeof rec.verdict === 'string' && rec.verdict.length > 0) ? rec.verdict : answer.verdict;
  const chosen = Array.isArray(rec.chosen) && rec.chosen.length > 0 ? rec.chosen : answer.chosen;
  const response = {
    ok: true,
    replayed: true,
    already_answered: true,
    answered_elsewhere: true,
    gate_id: answer.gate_id,
    verdict: verdict,
    chosen: chosen,
    ratified: verdict === 'approve',
  };
  if (stop.sourceGateId) response.source_gate_id = stop.sourceGateId;
  if (typeof rec.decision_node_id === 'string' && rec.decision_node_id.length > 0) response.decision_node_id = rec.decision_node_id;
  response.answered_via = (typeof rec.answered_via === 'string' && rec.answered_via.length > 0) ? rec.answered_via : 'unrecorded';
  if (typeof rec.via_gate_id === 'string' && rec.via_gate_id.length > 0) response.via_gate_id = rec.via_gate_id;
  if (verdict !== answer.verdict) {
    response.requested_verdict = answer.verdict;
    response.note = 'This gate was already answered with a different verdict, on another session. The recorded answer stands and nothing was changed.';
  }
  if (live.kind === 'material_step' && typeof live.resumeFn === 'function') {
    let chainResult;
    try {
      chainResult = await live.resumeFn({ gate_id: answer.gate_id, chosen: chosen, verdict: verdict, decision_node_id: response.decision_node_id || null });
    } catch (e) {
      chainResult = { ok: false, reason: 'resume_fault', detail: String((e && e.message) || e) };
    }
    response.resumed = true;
    response.chain_result = chainResult;
    if (chainResult && chainResult.ok === false) response.ok = false;
    return textResponse(response, response.ok === false);
  }
  return textResponse(response);
}

// Plan 369-36: a MIRROR of a gate recorded in this session's bound room. Returns
// { refusal } or { input, extra }: the gate_render input drawn from the room's record
// and the ledger fields the mirror carries. Reads the room over the read-only door.
function _prepareMirror(mirrorOf, gateId, options, sessionId, ctx) {
  if (gateId !== undefined) {
    return { refusal: { ok: false, reason: 'mirror_with_gate_id', message: 'A mirror gets its own id. Give mirror_of or gate_id, not both.' } };
  }
  const writeRoom = resolveMcpWriteRoom({ sessionId: sessionId, ctx: ctx });
  if (!writeRoom.ok) return { refusal: writeRoom.refusal };
  let state = null;
  let ro = null;
  try {
    ro = navigation.openRoomDbReadOnlyForCaller(writeRoom.dir);
    if (!ro) return { refusal: { ok: false, reason: 'lookup_failed', message: 'The room could not be opened, so the gate to mirror could not be read.' } };
    state = navigation.readGateState(ro, mirrorOf, Date.now());
  } catch (e) {
    return { refusal: { ok: false, reason: 'lookup_failed', message: 'The room\'s gate records could not be read. ' + String((e && e.message) || e).slice(0, 120) } };
  } finally {
    if (ro) {
      try { navigation.closeRoomDbForCaller(ro); } catch (_e) { /* best effort */ }
    }
  }
  if (state.state === 'answered') {
    return { refusal: {
      ok: false,
      reason: 'mirror_source_answered',
      gate_id: mirrorOf,
      verdict: state.answered.verdict,
      chosen: state.answered.chosen,
      message: 'That gate was already answered, so there is nothing to mirror.',
    } };
  }
  if (state.state === 'expired') {
    return { refusal: { ok: false, reason: 'gate_expired', gate_id: mirrorOf, message: 'That gate ran out of time (it lives for 30 minutes), so it cannot be mirrored.' } };
  }
  if (state.state !== 'open' || !state.contract) {
    return { refusal: { ok: false, reason: 'unknown_gate', gate_id: mirrorOf, message: 'No open gate with this id is recorded in the room this session is bound to.' } };
  }
  const record = state.contract;
  if (!gateRaised.mirrorOptionIdsMatch(record, options)) {
    return { refusal: {
      ok: false,
      reason: 'mirror_mismatch',
      gate_id: mirrorOf,
      valid_option_ids: Array.isArray(record.options) ? record.options.map((o) => o.id) : [],
      message: 'The options given do not repeat the recorded option ids in order, so no card was drawn. Read the gate with gate_list and repeat its option ids.',
    } };
  }
  const input = gateRaised.mirrorCardFrom(record);
  if (!input) {
    return { refusal: { ok: false, reason: 'unknown_gate', gate_id: mirrorOf, message: 'The recorded gate has no usable options to mirror.' } };
  }
  const extra = { mirrorOf: mirrorOf, mirrorSourceKind: input.source_kind };
  if (Array.isArray(input.approving)) extra.approving = input.approving;
  if (input.framework) extra.mirrorFramework = input.framework;
  if (typeof input.expires_at === 'number') extra.mirrorExpiresAt = input.expires_at;
  return { input: input, extra: extra };
}

// Plan 369-38 (WR-05): the most live (unexpired, unanswered) gates one session may hold
// through gate_render. 200 is far above any real card count (a person answers a handful
// at a time; a chain holds one) and small enough that a model looping gate_render cannot
// grow the daemon's memory without bound (each entry keeps its card). The other minting
// callers draw random server-side ids and are not capped here.
const MAX_OPEN_GATES_PER_SESSION = 200;

// The option ids the renderer will give this card (it assigns ids to options that came
// without one), or null when the card cannot be normalized (renderGate then refuses it
// itself and nothing is checked here).
function _optionIdsOf(renderer, raw) {
  try {
    const norm = renderer.normalizeCard(raw);
    return norm && Array.isArray(norm.options) ? norm.options.map((o) => o.id) : null;
  } catch (_e) {
    return null;
  }
}

// Plan 369-38 (WR-05): has this room already recorded an answer for a caller-chosen id?
// A gate id that was answered must not be minted again (a second live gate under the same
// decision:gate:<id> anchor). A read that fails answers false: the refusal is a guard
// against reuse, and an unreadable room has no answered id to protect.
function _gateIdAnsweredInRoom(sessionId, ctx, gateId) {
  let ro = null;
  try {
    const hit = resolveMcpSessionRoom({ sessionId: sessionId, ctx: ctx });
    if (!hit || typeof hit.dir !== 'string') return false;
    ro = navigation.openRoomDbReadOnlyForCaller(hit.dir);
    return !!ro && navigation.readGateAnswerAnchor(ro, gateId).found === true;
  } catch (_e) {
    return false;
  } finally {
    if (ro) {
      try { navigation.closeRoomDbForCaller(ro); } catch (_e) { /* best effort */ }
    }
  }
}

function register(server, ctx) {
  server.registerTool(
    'gate_list',
    {
      title: 'Gate List',
      description: 'List the decision gates still open in the room this session is bound to, or read the state of one gate. Read only: it never answers, renews or changes a gate. Gates come from the room\'s own records, so a gate raised in another session or another process (for example in Claude Code) shows up here too, with its header, options, ranks, previews, recommended option, subject and evidence ids, and when it expires (30 minutes after it was drawn). Give gate_id to read one gate: open (with its card), answered (with the recorded verdict, chosen ids and decision node, even after a restart), closed, expired, or unknown. If the room cannot be read the answer is lookup_failed, never unknown. At most 50 gates are listed, oldest first. The browser workspace uses this with gate_render to show a gate raised somewhere else. Needs a bound room: otherwise room_unbound, so call room_bind first.',
      inputSchema: z.object({
        gate_id: z.string().min(1).max(200).optional()
          .describe('Read the state of this one gate instead of listing the open ones.'),
      }),
    },
    async ({ gate_id }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      // The caller's BOUND room only. The machine-wide registry pointer is not a
      // binding (it is what another session or a manual `rooms open` moves), so a
      // session that has not bound a room is told so rather than shown that room.
      let hit = null;
      try {
        hit = resolveMcpSessionRoom({ sessionId: sessionId, ctx: ctx, noFloor: true });
      } catch (_e) {
        hit = null;
      }
      if (!hit || typeof hit.dir !== 'string' || hit.source === 'reg.active' || hit.source === 'none') {
        return textResponse({
          ok: false,
          reason: 'room_unbound',
          message: 'No room is bound to this session, so there is no room to list gates for. Call room_list, then room_bind with the room you want, and try again.',
        }, true);
      }
      let ro = null;
      try {
        ro = navigation.openRoomDbReadOnlyForCaller(hit.dir);
        if (!ro) {
          return textResponse({ ok: false, reason: 'lookup_failed', message: 'The room could not be opened, so its gates could not be read.' }, true);
        }
        const room = (typeof hit.slug === 'string' && hit.slug.length > 0) ? hit.slug : null;
        if (typeof gate_id === 'string') {
          const state = navigation.readGateState(ro, gate_id, Date.now());
          const gate = { gate_id: gate_id, state: state.state };
          if (state.state === 'open' && state.contract) gate.contract = state.contract;
          if (state.state === 'answered' && state.answered) gate.answered = state.answered;
          return textResponse({ ok: true, room: room, gate: gate });
        }
        const gates = navigation.readOpenRaisedGates(ro, { now: Date.now(), limit: 50 });
        return textResponse({ ok: true, room: room, gates: gates, count: gates.length });
      } catch (e) {
        return textResponse({
          ok: false,
          reason: 'lookup_failed',
          message: 'The room\'s gate records could not be read. ' + String((e && e.message) || e).slice(0, 120),
        }, true);
      } finally {
        if (ro) {
          try { navigation.closeRoomDbForCaller(ro); } catch (_e) { /* best effort */ }
        }
      }
    }
  );

  server.registerTool(
    'gate_render',
    {
      title: 'Gate Render',
      description: 'Render the Mindrian gate superset card (options + per-option descriptions + ranks + previews + single/multi-select) via the capability-detected 3-rung renderer ladder: MCP elicitation, Claude Code AskUserQuestion thin adapter, or headless structured text. Returns a gate_id minted into this server process\'s in-memory ledger, which gate_answer must reference to ratify; when this session is bound to a room, the card\'s contract (header, options, ranks, previews, recommended id, subject ids, never a session identity) is recorded in that room so other MindrianOS surfaces can show the gate, but the id itself lives in this server process\'s ledger and does not survive a restart. To decide a gate raised in another session of this room (find it with gate_list), give mirror_of with that gate\'s id and repeat its option ids in order: the card is drawn from the room\'s own record, never from the caller, and this session gets its own gate_id for it. Do not also give gate_id (mirror_with_gate_id); different option ids are mirror_mismatch; an unknown or closed gate, or another room\'s, is unknown_gate; an expired one gate_expired; an answered one mirror_source_answered with its verdict. Answering the mirror with gate_answer records the source as answered in the same transaction. A mirror is never an inline elicitation and leaves no record of its own. Give approving (option ids that mean yes) and gate_answer refuses an approve that names none of them; an id that is not an option is bad_approving. A caller-chosen gate_id that is open is gate_id_in_use and one already answered in the room is gate_id_answered; one session may hold 200 open gates, past that too_many_open_gates.',
      inputSchema: z.object({
        gate_id: z.string().min(1).optional(),
        mirror_of: z.string().min(1).max(200).optional()
          .describe('The id of a gate raised in another session of this room. Shows that gate\'s recorded card again on this session, under a new gate_id this session owns.'),
        header: z.string().optional(),
        kind: z.string().optional()
          .describe("e.g. 'binding' for the D-04 once-per-session-on-ambiguity F.8 card; defaults to 'general'."),
        ambiguous: z.boolean().optional()
          .describe("Only relevant to kind:'binding' -- an unambiguous context never fires the card."),
        select_mode: z.enum(['single', 'multi']).optional(),
        options: z.array(gateOptionSchema).min(1),
        subject_node_id: z.string().min(1).optional()
          .describe("Opaque LOCAL room-graph node id, the card's subject. On an approve verdict for a kind 'general' card whose subject is a proposed claim node, gate_answer confirms that claim through navigation.confirmNode when the room's verification floor is met, and otherwise files it as needs_evidence; the card says which before the click. Evidence nodes are never promoted. Canon Part 8: must never be a Brain identifier or room content."),
        evidence_node_ids: z.array(z.string().min(1)).optional()
          .describe('Opaque LOCAL room-graph node ids, provenance only -- SOURCED_FROM targets on the written decision node, never promoted by gate_answer. Canon Part 8: must never be Brain identifiers or room content.'),
        approving: z.array(z.string().min(1)).min(1).max(6).optional()
          .describe('Option ids that mean yes. When given, gate_answer refuses an approve that names none of them (chosen_not_approving) and a reject or defer that names one (verdict_chosen_mismatch). Each must be an option id, else bad_approving.'),
      }),
    },
    async ({ gate_id, mirror_of, header, kind, ambiguous, select_mode, options, subject_node_id, evidence_node_ids, approving }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      // Phase 369 plan 36: a mirror draws its card from the room's record of the
      // source gate, never from the caller (the caller's options only have to repeat
      // the recorded ids).
      let mirrorExtra = null;
      if (mirror_of !== undefined) {
        const prepared = _prepareMirror(mirror_of, gate_id, options, sessionId, ctx);
        if (prepared.refusal) return textResponse(prepared.refusal, true);
        header = prepared.input.header;
        kind = prepared.input.kind;
        ambiguous = false;
        select_mode = prepared.input.select_mode;
        options = prepared.input.options;
        subject_node_id = prepared.input.subject_node_id;
        evidence_node_ids = prepared.input.evidence_node_ids;
        mirrorExtra = prepared.extra;
      }
      // Plan 369-38 (WR-05, WR-03): refusals that need no render. A mirror takes its
      // approving ids from the room's record, never from the caller.
      if (gateLedger.liveCountFor(sessionId) >= MAX_OPEN_GATES_PER_SESSION) {
        return textResponse({
          ok: false,
          reason: 'too_many_open_gates',
          message: 'This session already holds ' + MAX_OPEN_GATES_PER_SESSION + ' open gates, so no new card was drawn. Answer or let the open ones expire first.',
        }, true);
      }
      if (!mirrorExtra && gate_id !== undefined) {
        if (gateLedger.isGateLive(gate_id)) {
          return textResponse({ ok: false, reason: 'gate_id_in_use', gate_id: gate_id, message: 'A gate with this id is already open, so no card was drawn. Leave gate_id out and a fresh id is minted.' }, true);
        }
        if (_gateIdAnsweredInRoom(sessionId, ctx, gate_id)) {
          return textResponse({ ok: false, reason: 'gate_id_answered', gate_id: gate_id, message: 'A gate with this id was already answered in this room, so no card was drawn. Leave gate_id out and a fresh id is minted.' }, true);
        }
      }
      let approvingIds = null;
      if (!mirrorExtra && Array.isArray(approving)) {
        const optionIds = _optionIdsOf(gateRender, { gate_id: gate_id, header: header, kind: kind, options: options });
        const unique = Array.from(new Set(approving));
        if (optionIds && !unique.every((id) => optionIds.indexOf(id) !== -1)) {
          return textResponse({ ok: false, reason: 'bad_approving', valid_option_ids: optionIds, message: 'approving must name option ids of this card, so no card was drawn.' }, true);
        }
        approvingIds = unique;
      }
      let capabilities = detectClientCapabilities(server, ctx);
      // A mirror is answered only through gate_answer (which also records the source),
      // so it is never an inline elicitation.
      if (mirrorExtra) capabilities = Object.assign({}, capabilities, { elicitation: false });
      const card = { gate_id: gate_id, header: header, kind: kind, ambiguous: ambiguous, selectMode: select_mode, options: options, subject_node_id: subject_node_id, evidence_node_ids: evidence_node_ids };
      const renderCtx = { capabilities: capabilities, sessionId: sessionId };
      if (capabilities.elicitation && server && server.server && typeof server.server.elicitInput === 'function') {
        renderCtx.elicitInput = function (params) { return server.server.elicitInput(params); };
      }

      // Phase 365 (D-05, D-24): for a kind 'general' card whose subject is a
      // claim, compose the why-line ONCE through navigation.composeFloorNotice
      // (the one composer both card builders use) and carry it in card DATA
      // (`notice`, plus the relabelled `approve_label` below the floor), so the
      // elicitation, AskUserQuestion and headless-text rungs all show it before
      // the click. gate-render.cjs stays a pure normalizer. Any failure skips
      // the notice silently: a floor lookup must never block the gate.
      let floorLanding = null;
      if (typeof subject_node_id === 'string' && subject_node_id.length > 0
          && (kind === undefined || kind === null || kind === 'general')) {
        let noticeDb = null;
        try {
          const noticeRoomDir = resolveSessionRoomDir(sessionId, ctx);
          noticeDb = noticeRoomDir ? navigation.openRoomDbForCaller(noticeRoomDir) : null;
          if (noticeDb) {
            const composed = navigation.composeFloorNotice(noticeDb, noticeRoomDir, subject_node_id);
            if (composed && typeof composed.notice === 'string' && composed.notice.length > 0) {
              card.notice = composed.notice;
              if (typeof composed.approve_label === 'string' && composed.approve_label.length > 0) {
                card.approve_label = composed.approve_label;
              }
              floorLanding = (typeof composed.landing === 'string') ? composed.landing : null;
            }
          }
        } catch (_e) {
          floorLanding = null;
        } finally {
          if (noticeDb) {
            try { navigation.closeRoomDbForCaller(noticeDb); } catch (_e) { /* best effort */ }
          }
        }
      }

      let result;
      try {
        result = await gateRender.renderGate(card, renderCtx);
      } catch (e) {
        return textResponse({ ok: false, reason: 'render_failed', detail: String((e && e.message) || e) }, true);
      }

      if (result.suppressed) {
        return textResponse({ ok: true, suppressed: true, gate_id: result.card.gate_id });
      }

      // Phase 369 plan 26: the room bound and the subject's revision at mint ride
      // on the entry (extra can never override card, sessionId or kind).
      const mintExtra = _mintContext(sessionId, ctx, result.card.subjectNodeId, result.card.evidenceNodeIds);
      if (floorLanding !== null) mintExtra.floor_prediction = floorLanding;
      if (approvingIds) mintExtra.approving = approvingIds;
      if (mirrorExtra) Object.assign(mintExtra, mirrorExtra);
      // Quick 261005-mux: the rung that showed this card. gate_answer refuses a relayed answer on an open
      // elicitation gate (the navigator dismissed the dialog), so the ledger has to know it was one.
      mintExtra.renderer = gateRender.ledgerRenderer(result, renderCtx);
      // The ledger refuses an id that is live under another session (WR-05); the check
      // above is the fast path, this is the one that holds across the render's await.
      if (_mintLiveGate(result.card.gate_id, result.card, sessionId, mintExtra) === false) {
        return textResponse({ ok: false, reason: 'gate_id_in_use', gate_id: result.card.gate_id, message: 'A gate with this id is already open, so no card was kept. Leave gate_id out and a fresh id is minted.' }, true);
      }
      const response = {
        ok: true,
        gate_id: result.card.gate_id,
        renderer: result.renderer,
        rendered: result.rendered,
      };
      if (mirrorExtra) response.mirror_of = mirror_of;
      // Elicitation completes its round trip INLINE (server.server.elicitInput
      // awaits the live client response within THIS call, unlike the other two
      // rungs whose answer arrives later via a separate gate_answer call). When
      // it produced an answer, surface it now and consume the live-gate entry
      // immediately so the SAME gate_id cannot be replayed through gate_answer.
      if (result.answer) {
        _consumeLiveGate(result.card.gate_id, sessionId);
        response.answer = result.answer;
      }
      return textResponse(response);
    }
  );

  server.registerTool(
    'gate_answer',
    {
      title: 'Gate Answer',
      description: 'Ratify a gate decision. Accepts { gate_id, chosen, verdict }; only ratifies a gate_id THIS server process minted for this session through the shared ledger, including a chain_run halt or a gate_render mirror_of card. chosen must be an option id or label of the minted card, else chosen_not_in_card_options before any write. An approve routes the write through lib/core/navigation.cjs (Part 9) and writes a typed decision node with SOURCED_FROM edges to the card\'s subject/evidence ids (plus USES_FRAMEWORK for a chain halt with a framework), promoted via navigation.confirmNode. For a chain_run halt at a material step, gate_answer is ALSO the verb that resumes the chain: an approve runs the halted step in this SAME call, result under chain_result (with the next gate_id if it halts again). The whole answer is saved in ONE transaction and the gate is released only after it commits: if saving fails the answer is refused with persistence_failed, nothing is saved, and the gate can be answered again. Answering a mirror also records its source gate as answered in that same transaction. A gate already answered returns ok with replayed true plus the recorded verdict, chosen and decision_node_id, even after a restart or after its 30 minutes ran out; if another session answered it first (through a mirror) it also says answered_elsewhere true, writes nothing, and a halted step resumes exactly once with the recorded answer. Refused with the gate left open: room_switched (bound to another room than the card\'s), stale_subject (an approve whose subject or evidence changed since the card was drawn; ask for a fresh card), session_mismatch, chosen_not_approving and verdict_chosen_mismatch. If the room cannot be read to look for a saved answer the reply is replay_lookup_failed (nothing written, try again). Refused with nothing to answer: gate_expired (30 minutes passed, no saved answer) and unknown_gate. A chain_run call threaded with the same answer afterward is refused with unknown_or_expired_gate and nothing re-runs.',
      inputSchema: z.object({
        gate_id: z.string().min(1),
        chosen: z.array(z.string().min(1)).min(1),
        verdict: z.enum(['approve', 'reject', 'defer']),
      }),
    },
    async ({ gate_id, chosen, verdict }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      // Quick 261004-av2 (CR-02 option 2). Canon Part 9: how this answer reached the room is
      // proven by the route, not asserted. Derived ONCE, here, from the request _meta proof the
      // shell's approveDecision mints (an HMAC over this gate id keyed from the 0600 control token)
      // and never from an argument. Any other caller, a model relaying a card included, records
      // mcp_relayed. SEED-114 owns the human-only route that would stop the relay itself.
      const answeredVia = answerRoute.routeOf(extra, gate_id);
      // Phase 289 (D-04): peek first; every refusal below leaves the entry so
      // the rightful owner can still answer. The entry is released only after
      // the ratification commits (Phase 369 plan 26, durable consumption).
      let live = _peekLiveGate(gate_id, sessionId);
      if (live && live.ok !== false) {
        // Test-only (MINDRIAN_TEST_MODE=1): a marker file naming this gate makes
        // its TTL read as run out, so the live-daemon test can reach gate_expired.
        if (process.env.MINDRIAN_TEST_MODE === '1') {
          const expireFault = _takeTestFault(resolveSessionRoomDir(sessionId, ctx), 'gate-expire');
          if (expireFault && expireFault.body === gate_id) {
            gateLedger._internal.backdate(gate_id, gateLedger.LEDGER_TTL_MS + 1000);
            live = _peekLiveGate(gate_id, sessionId);
          }
        }
      }
      if (!live) {
        return _answerWithoutLiveGate(gate_id, chosen, verdict, sessionId, ctx);
      }
      if (live.ok === false) {
        return textResponse({ ok: false, reason: live.reason, gate_id: gate_id }, true);
      }
      // Quick 261005-mux (a yes is a card, never prose; 369.2-INPUT defect 4, SEED-120 P0). A gate whose card
      // was rendered as a dialog (the elicitation rung) is answered in that dialog: an accepted dialog is
      // consumed inline by its minter and never reaches here. An entry that is STILL open therefore means the
      // navigator dismissed the dialog (or a minter ignored the inline answer), and a model relaying a choice
      // for it is answering for the navigator. Refused card_pending, before the room is touched and before
      // anything is consumed, so the gate stays open for a card that is shown again. A proven browser click
      // (answered_via browser_nonce, av2) is the navigator and passes. One exception, kept for a minter that
      // does not consume inline (chain_run): it records the choice the navigator actually accepted in the
      // dialog (elicited_answer), and a relay that names exactly that choice is carrying a real answer.
      if (live.renderer === 'elicitation' && answeredVia !== answerRoute.ANSWERED_VIA.BROWSER_NONCE) {
        const accepted = Array.isArray(live.elicited_answer) ? live.elicited_answer : null;
        const relayed = gateRender.validateChosenAgainstCard(live.card, chosen);
        const sameAsAccepted = !!accepted && !!relayed
          && accepted.length === relayed.length
          && relayed.every((id) => accepted.indexOf(id) !== -1);
        if (!sameAsAccepted) {
          return textResponse({
            ok: false,
            reason: 'card_pending',
            gate_id: gate_id,
            message: 'The navigator dismissed the dialog; show the card again. Nothing was written and the gate is still open.',
          }, true);
        }
      }
      // GATE-01 G-2 (ASVS V5 value-domain check): the minted card is in hand
      // right here, and until now it went unused -- chosen was copied
      // verbatim into a ratified memory_event without ever checking it was
      // among the card's actual options. This check runs strictly BEFORE
      // resolveSessionRoomDir / openRoomDbForCaller / logMemoryEvent below,
      // so a rejected answer opens no DB and writes no row.
      const validChosen = gateRender.validateChosenAgainstCard(live.card, chosen);
      if (!validChosen) {
        const validOptionIds = (live.card && Array.isArray(live.card.options))
          ? live.card.options.map((o) => o.id)
          : [];
        return textResponse({
          ok: false,
          reason: 'chosen_not_in_card_options',
          gate_id: gate_id,
          valid_option_ids: validOptionIds,
        }, true);
      }
      // Phase 289 review CR-01: the verdict must agree with the chosen option.
      // A gate that declares its approving option ids (chain material-step and
      // research gates do) refuses an approve verdict that names a non-approving
      // option, and a reject or defer verdict that names an approving one,
      // here, before anything is written, so nothing is run, written or
      // confirmed and the gate survives for its owner.
      const incoherent = gateRender.checkVerdictAgainstApproving(live, validChosen, verdict);
      if (incoherent) {
        return textResponse({ ok: false, reason: incoherent, gate_id: gate_id }, true);
      }
      // quick task 260819-c55 (Task 2): a material_step entry with no
      // callable resumeFn is refused honestly BEFORE any room db is opened
      // and BEFORE any ratification is written -- a gate whose execution
      // owner is gone must not leave a ratified memory_event for a step
      // that will never run, the same conservative direction the
      // chosen-validation check above already takes.
      if (live.kind === 'material_step' && typeof live.resumeFn !== 'function') {
        return textResponse({ ok: false, reason: 'resume_owner_missing', gate_id: gate_id }, true);
      }

      // Persist the RESOLVED option ids (validChosen), not the raw submitted
      // chosen array -- a label that resolved to an id must not leave a raw
      // label string in the ratified memory_event. Mirrors the
      // AskUserQuestion rung's own _resolveChosenIds -> normalizeGateAnswer
      // call shape in gate-render.cjs.
      const answer = Object.assign({}, gateRender.normalizeGateAnswer(gate_id, validChosen, verdict), { answered_via: answeredVia });

      // RCA desktop-session-binding-fallback (navigator ruling 2026-10-02):
      // ratifying a gate writes a memory_event and a decision node, so it is a
      // room WRITE and an unbound session must not land it in the registry's
      // active room. The one exception is the F.8 binding card itself: answering
      // "which room?" is the ceremony that PRECEDES any room, so it ratifies
      // without a room write (and the model then calls room_bind). Refusing it
      // would deadlock the very flow that fixes the unbound state.
      const writeRoom = resolveMcpWriteRoom({ sessionId: sessionId, ctx: ctx });
      if (!writeRoom.ok) {
        if (live.kind === 'binding') {
          // A valid answer that writes nothing: take the gate now (single use).
          const takenBinding = _consumeLiveGate(gate_id, sessionId);
          if (!takenBinding || takenBinding.ok === false) {
            return textResponse({ ok: false, reason: 'unknown_gate', gate_id: gate_id }, true);
          }
          return textResponse({
            ok: true,
            gate_id: answer.gate_id,
            chosen: answer.chosen,
            verdict: answer.verdict,
            ratified: answer.verdict === 'approve',
            answered_via: answer.answered_via,
            memory_event: null,
            room_write: 'skipped_no_bound_room',
            next: 'Call room_bind with the room that was chosen.',
          });
        }
        return textResponse(Object.assign({ gate_id: gate_id }, writeRoom.refusal), true);
      }
      const roomDir = writeRoom.dir;

      // Phase 369 plan 26 (GREC369-03): the two stale-approval refusals. Neither
      // consumes and neither writes: the gate stays answerable, the person can
      // switch back, or ask for a fresh card.
      const mintedDir = _mintedRoomOf(live);
      if (mintedDir && !_sameDir(mintedDir, roomDir)) {
        return textResponse({
          ok: false,
          reason: 'room_switched',
          gate_id: gate_id,
          minted_room: live.mintedRoomSlug || null,
          current_room: writeRoom.slug || null,
          message: 'This session is bound to a different room than the one this card was drawn for, so nothing was written. Bind the original room and answer again, or ask for a fresh card.',
        }, true);
      }
      // Only an APPROVE can ratify a changed subject (it promotes or holds the
      // claim); a reject or defer records "not this one" and cannot confirm
      // anything, so it stays answerable and lets the person dismiss a stale card.
      if (verdict === 'approve') {
        const changedId = _changedSinceMintAt(roomDir, live);
        if (changedId && !_answeredInRoom(roomDir, gate_id, live)) {
          return _staleResponse(gate_id, live, changedId);
        }
      }

      const db = navigation.openRoomDbForCaller(roomDir);
      if (!db) {
        return textResponse({ ok: false, reason: 'no_room_db', room_dir: roomDir }, true);
      }
      // Phase 369 plan 26 (GREC369-01), durable consumption. Phase 289 consumed
      // the gate here, immediately before the first write, so a write that threw
      // afterwards lost the gate. The entry now stays in the ledger through the
      // whole ratification: every write below runs inside ONE withRoomTx (the
      // memory_event, the decision node, its SOURCED_FROM and USES_FRAMEWORK
      // edges, confirmNode, the floor-check events), and the entry is released
      // only after that COMMIT. A thrown write rolls everything back and answers
      // persistence_failed with the gate still answerable.
      //
      // Everything from the peek to the release is synchronous (the transaction
      // callback holds no await; node:sqlite is synchronous), so two answers
      // cannot interleave inside it. The first await in this handler is
      // live.resumeFn below, after the release; a second answer arriving then
      // finds no ledger entry and reads the durable trace (replayed:true).
      //
      // Phase 289 review WR-02, what is and is not knowable before the write.
      // Refused above, on the peeked entry: chosen outside the card,
      // resume_owner_missing, the verdict/chosen coherence check, session,
      // bound-room, room_switched and stale_subject. Residual, deliberately left
      // after the release because it can only be known by running it: a fault
      // inside live.resumeFn (the chain step throwing, a research resolve
      // failing as approval_failed, a release or never-do write refusing,
      // never-do decision_node_missing). In those cases the gate is released and
      // the ratification is durable for a step that did not complete; the
      // failure is returned honestly under chain_result with ok:false (never
      // reported as success), and a repeat answer replays the recorded
      // ratification rather than re-running the step.
      let applied;
      try {
        applied = navigation.withRoomTx(db, () => _answerInTx(db, roomDir, live, answer));
      } catch (e) {
        try { navigation.closeRoomDbForCaller(db); } catch (_e) { /* best effort */ }
        if (e instanceof GateStopped) {
          return _stoppedAnswer(e, live, answer, sessionId);
        }
        if (e instanceof StaleSubject) {
          return _staleResponse(gate_id, live, e.changedId);
        }
        return textResponse({
          ok: false,
          reason: 'persistence_failed',
          gate_id: gate_id,
          message: 'The answer could not be saved, so nothing was written and the same gate can be answered again. ' + String((e && e.message) || e).slice(0, 160),
        }, true);
      }
      try { navigation.closeRoomDbForCaller(db); } catch (_e) { /* best effort */ }
      // The transaction committed: now, and only now, release the gate. The
      // peek-to-here stretch is synchronous, so the entry is still ours.
      _releaseLiveGate(gate_id, sessionId);

      const response = {
        ok: true,
        gate_id: answer.gate_id,
        chosen: answer.chosen,
        verdict: answer.verdict,
        ratified: answer.verdict === 'approve',
        answered_via: answer.answered_via,
        memory_event: applied.logResult,
      };
      if (answer.verdict === 'approve') {
        response.reasoning_node = applied.reasoningNode;
      }
      if (applied.strategyRatification !== null) {
        // Plan 369-38 (WR-01): the goal file is written only now, after COMMIT and
        // release. Its outcome is recorded on the response and never flips ok.
        if (applied.pendingGoal) {
          const fileOutcome = goalGate.applyGoalFile(roomDir, applied.pendingGoal);
          Object.assign(applied.strategyRatification, fileOutcome);
        }
        response.strategy_ratification = applied.strategyRatification;
      }

      // Ordering doctrine (quick task 260819-c55, Task 2): the ratification
      // memory_event above is written BEFORE the step executes, deliberately.
      // The halted step may be irreversible, so a step that runs must never
      // be unrecorded; the inverse case -- a ratification recorded for a
      // step that then faulted -- stays visible through chain_result.ok:false
      // below and is the recoverable direction. Plan 26: the resume runs after
      // the commit and outside the transaction.
      if (live.kind === 'material_step') {
        let chainResult;
        try {
          chainResult = await live.resumeFn({ gate_id: answer.gate_id, chosen: answer.chosen, verdict: answer.verdict });
        } catch (e) {
          chainResult = { ok: false, reason: 'resume_fault', detail: String((e && e.message) || e) };
        }
        // Nest, do not spread: chain_result carries its own ok / completed /
        // halted / executed / gate_id / chain_output / gate keys, and
        // flattening them would clobber the ratification fields above.
        response.resumed = true;
        response.chain_result = chainResult;
        if (chainResult && chainResult.ok === false) {
          response.ok = false;
        }
        return textResponse(response, response.ok === false);
      }

      return textResponse(response);
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). Both tools reach a genuine
// Decision-Gate fork (they ARE the HITL surface). scripts/build-connector-
// registry.cjs discovers this export and regenerates data/mcp-tool-
// connectors.json + data/connector-registry.json from it; never hand-edit
// either generated file.
const connectors = [
  {
    tool: 'gate_list',
    surface: 'gate_list',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure read: lists the open decision gates and one gate\'s state from the room\'s own records, no fork.',
    layer: 'harness',
    layer_why: 'Reads the gate records a gate-ledger mint left in the room through the read-only door; a gate-ledger tool that answers nothing and changes nothing.',
  },
  {
    tool: 'gate_render',
    surface: 'gate_render',
    connector: 'mcp-tool',
    hitl_shape: 'F.1',
    hitl_why: 'Renders the Mindrian gate superset card via the 3-rung renderer ladder for a genuine Decision-Gate fork; the F.8/F.9 shipped renderers it composes from are the same binding/reconcile HITL shapes.',
    layer: 'harness',
    layer_why: 'Renders a Decision-Gate card through the gate-ledger rendering ladder; a gate-ledger tool, the rubric\'s own step 3 signal.',
  },
  {
    tool: 'gate_answer',
    surface: 'gate_answer',
    connector: 'mcp-tool',
    hitl_shape: 'F.1',
    hitl_why: 'Ratifies a gate decision; an approve verdict routes a material write through navigation.cjs (Part 9) -- the fork the human already resolved via gate_render -- and now also writes a typed decision node with SOURCED_FROM/USES_FRAMEWORK provenance edges, promoted to confirmed via confirmNode.',
    layer: 'harness',
    layer_why: 'Ratifies a gate decision and writes a typed decision node with provenance edges through the gate ledger; a gate-ledger tool.',
  },
];

module.exports = {
  register: register,
  connectors: connectors,
  _internal: {
    resolveSessionRoomDir: resolveSessionRoomDir,
    detectClientCapabilities: detectClientCapabilities,
    _liveGates: gateLedger._internal._ledger,
    _mintLiveGate: _mintLiveGate,
    _consumeLiveGate: _consumeLiveGate,
    _peekLiveGate: _peekLiveGate,
    _releaseLiveGate: _releaseLiveGate,
    _mintContext: _mintContext,
    _onGateMinted: _onGateMinted,
    _onGateTaken: _onGateTaken,
  },
};
