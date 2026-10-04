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

const { z } = require('zod');

const gateRender = require('../gate-render.cjs');
const gateLedger = require('../gate-ledger.cjs');
const navigation = require('../../core/navigation.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveSessionRoomDir, resolveMcpWriteRoom } = require('../session-room.cjs');
const goalGate = require('../../core/strategy/goal-gate.cjs');

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
function _floorPromoteClaim(db, roomDir, subjectId, fromStatus) {
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
  const byUser = navigation.resolveByUser(roomDir);
  let confirmed = false;
  let skipReason = null;
  try {
    if (met) {
      const confirmResult = navigation.confirmNode(db, subjectId, byUser, 'gate_answer approve (card subject)');
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
function _promoteCardSubject(db, roomDir, live) {
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
    return _floorPromoteClaim(db, roomDir, subjectId, row.review_status);
  }
  if (row.review_status !== 'proposed') {
    return { subject_node_id: subjectId, subject_confirmed: false, subject_skip_reason: 'subject_not_proposed' };
  }
  const confirmResult = navigation.confirmNode(
    db, subjectId, navigation.resolveByUser(roomDir), 'gate_answer approve (card subject)'
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
  gateLedger.mintGate(gateId, Object.assign({}, more, {
    card: card,
    sessionId: sessionId,
    kind: (card && typeof card.kind === 'string' && card.kind.length > 0) ? card.kind : 'general',
  }));
}

function _consumeLiveGate(gateId, sessionId) {
  return gateLedger.consumeGate(gateId, sessionId);
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
});

function register(server, ctx) {
  server.registerTool(
    'gate_render',
    {
      title: 'Gate Render',
      description: 'Render the Mindrian gate superset card (options + per-option descriptions + ranks + previews + single/multi-select) via the capability-detected 3-rung renderer ladder: MCP elicitation, Claude Code AskUserQuestion thin adapter, or headless structured text. Returns a gate_id minted into this server process\'s in-memory ledger, which gate_answer must reference to ratify; nothing is persisted and the id does not survive a restart.',
      inputSchema: z.object({
        gate_id: z.string().min(1).optional(),
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
      }),
    },
    async ({ gate_id, header, kind, ambiguous, select_mode, options, subject_node_id, evidence_node_ids }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const capabilities = detectClientCapabilities(server, ctx);
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

      _mintLiveGate(result.card.gate_id, result.card, sessionId,
        floorLanding !== null ? { floor_prediction: floorLanding } : undefined);
      const response = {
        ok: true,
        gate_id: result.card.gate_id,
        renderer: result.renderer,
        rendered: result.rendered,
      };
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
      description: 'Ratify a gate decision. Accepts the canonical { gate_id, chosen, verdict } payload; only ratifies a gate_id THIS server process minted through the shared ledger (lib/mcp/gate-ledger.cjs), including a gate id minted by a chain_run halt (T-198-10 spoofing guard, session-scoped). chosen must be an option id or an option label from the card that was actually minted; a chosen value outside that set is rejected with chosen_not_in_card_options before any write happens. On an approve verdict, routes the material write through lib/core/navigation.cjs (Part 9) -- never a direct DB write. An approve verdict ALSO writes a typed decision node with SOURCED_FROM provenance edges to the card\'s subject/evidence node ids, plus a USES_FRAMEWORK edge when the gate came from a chain halt with an active framework; the node is promoted to confirmed via navigation.confirmNode, recording the human APPROVE. When the gate_id was minted by a chain_run halt at a material step, gate_answer is ALSO the verb that resumes that chain: an approve verdict runs the halted step and continues the chain in this SAME call, returning the result nested under chain_result; if the continued chain halts again at a later material step, chain_result carries the next gate_id to answer the same way. The gate is single-use, so a second gate_answer for the same gate_id, or a chain_run call threaded with the same answer afterward, is refused with unknown_or_expired_gate and nothing re-runs.',
      inputSchema: z.object({
        gate_id: z.string().min(1),
        chosen: z.array(z.string().min(1)).min(1),
        verdict: z.enum(['approve', 'reject', 'defer']),
      }),
    },
    async ({ gate_id, chosen, verdict }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      // Phase 289 (D-04): peek first; every refusal below leaves the entry so
      // the rightful owner can still answer. The consume is further down.
      const live = _peekLiveGate(gate_id, sessionId);
      if (!live) {
        return textResponse({ ok: false, reason: 'unknown_or_expired_gate', gate_id: gate_id }, true);
      }
      if (live.ok === false) {
        return textResponse({ ok: false, reason: live.reason, gate_id: gate_id }, true);
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
      // here, before the consume, so nothing is run, written or confirmed and
      // the gate survives for its owner.
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
      const answer = gateRender.normalizeGateAnswer(gate_id, validChosen, verdict);

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
            return textResponse({ ok: false, reason: 'unknown_or_expired_gate', gate_id: gate_id }, true);
          }
          return textResponse({
            ok: true,
            gate_id: answer.gate_id,
            chosen: answer.chosen,
            verdict: answer.verdict,
            ratified: answer.verdict === 'approve',
            memory_event: null,
            room_write: 'skipped_no_bound_room',
            next: 'Call room_bind with the room that was chosen.',
          });
        }
        return textResponse(Object.assign({ gate_id: gate_id }, writeRoom.refusal), true);
      }
      const roomDir = writeRoom.dir;
      const db = navigation.openRoomDbForCaller(roomDir);
      if (!db) {
        return textResponse({ ok: false, reason: 'no_room_db', room_dir: roomDir }, true);
      }
      // Phase 289 (D-04, LEDGER289-03): peek, refuse, then take. Every refusal
      // above leaves the entry so the rightful owner can still answer.
      // Everything from the peek to this line is synchronous (resolveMcpWriteRoom
      // and openRoomDbForCaller are plain functions; the first await in this
      // handler is live.resumeFn below); adding any await between the peek and
      // this consume reopens a double-ratify race.
      //
      // Phase 289 review WR-02, what is and is not knowable before this line.
      // Moved ahead of the consume (all on the peeked entry): chosen outside the
      // card, resume_owner_missing, the verdict/chosen coherence check (so the
      // resumeFn's chosen_not_approving refusal can no longer be reached by an
      // answer the entry could have judged), session and bound-room refusals.
      // Residual, deliberately left after the consume because it can only be
      // known by running it: a fault inside live.resumeFn (the chain step
      // throwing, a research resolve failing as approval_failed, a release or
      // never-do write refusing, never-do decision_node_missing which needs the
      // decision node written just below), and a write that throws after this
      // line. In those cases the gate is spent and the ratification row exists
      // for a step that did not complete; the failure is returned honestly under
      // chain_result with ok:false (never reported as success). Durable
      // consumption after commit, which would let a failed resume release the
      // gate again, is Phase 369 plan 26.
      const taken = _consumeLiveGate(gate_id, sessionId);
      if (!taken || taken.ok === false) {
        try { navigation.closeRoomDbForCaller(db); } catch (_e) { /* best effort */ }
        return textResponse({ ok: false, reason: 'unknown_or_expired_gate', gate_id: gate_id }, true);
      }
      let logResult;
      let reasoningNode = null;
      let strategyRatification = null;
      try {
        logResult = navigation.logMemoryEvent(db, 'mcp_client_event_logged', {
          label: 'gate_answer',
          gate_id: answer.gate_id,
          chosen: answer.chosen,
          verdict: answer.verdict,
        });

        // Quick task 260903-i2x (T2 node-writing half) -- ADDITIVE ONLY. The
        // logMemoryEvent bookkeeping row above is unchanged; this is new
        // code alongside it, never a replacement. Only an approve verdict
        // mints a typed decision node; reject/defer write nothing extra.
        // Wrapped in try/catch so no reasoning-write fault can ever break
        // gate ratification (mirrors the writeEdge ok-stability doctrine at
        // edges.cjs:1088-1100 -- response.ok never flips on this path).
        if (answer.verdict === 'approve') {
          try {
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

              // DC-2: `live` IS the consumed ledger entry chain.cjs minted
              // with `haltedStep` (chain.cjs:350-375), so `live.haltedStep.
              // framework` is readable here with NO chain.cjs change needed.
              // DC-3: sensors.cjs's framework_run halt path mints NO ledger
              // entry (it never requires gate-ledger.cjs), so its gate can
              // never reach gate_answer and its USES_FRAMEWORK edge is
              // structurally unreachable -- a named, deliberate gap, not an
              // oversight (see CLAUDE.md handoff row).
              const framework = (live.haltedStep && typeof live.haltedStep.framework === 'string')
                ? live.haltedStep.framework
                : null;

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
              });

              let confirmed = false;
              if (writeResult && writeResult.ok === true) {
                // DC-4 / Canon Part 9 role 5: the human APPROVE at a Decision
                // Gate is exactly what confirmNode exists to record; minting
                // 'confirmed' directly in the writer would be a
                // constitutional breach (memory-artifacts.cjs:333-339). A
                // promotion failure leaves the node at 'proposed' and is
                // recorded on the response, never thrown.
                try {
                  const confirmResult = navigation.confirmNode(
                    db, writeResult.node_id, navigation.resolveByUser(roomDir), 'gate_answer approve'
                  );
                  confirmed = !!(confirmResult && confirmResult.ok === true);
                } catch (_e) {
                  confirmed = false;
                }
              }
              reasoningNode = Object.assign({}, writeResult, { confirmed: confirmed });

              // SYS-08 (Phase 354-02) -- ADDITIVE ONLY, own nested try/catch
              // so a subject-promotion fault can never clobber the
              // reasoningNode the decision-node write above already
              // assigned, and never flips response.ok (same additive idiom
              // as the 260903-i2x block this sits inside). The decision-node
              // confirm above stays exactly as-is: it records the human
              // decision itself. This is the SEPARATE promotion the card's
              // own contract (tool-router.cjs:1563, :1653) names: the
              // subject CLAIM, not the decision node.
              try {
                const subjectPromotion = _promoteCardSubject(db, roomDir, live);
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
              } catch (_e) {
                reasoningNode = Object.assign({}, reasoningNode, {
                  subject_node_id: (live.card && live.card.subjectNodeId) || null,
                  subject_confirmed: false,
                  subject_skip_reason: 'promotion_threw',
                });
              }

              // Phase 345-07 (STRAT-13) -- ADDITIVE ONLY, same idiom as the
              // 260903-i2x block just above (own nested try/catch so a fault
              // here can never clobber the reasoningNode this block already
              // assigned, and never flips response.ok). Guarded on
              // isStrategyCard: every other card kind is byte-unchanged.
              // ratifyGoalProposal writes NO decision node and NO provenance
              // edges of its own (writeReasoningNode above already did both,
              // fed by the SAME live.card.subjectNodeId/evidenceNodeIds) --
              // it only promotes the goal anchor and, on a rewrite/change-
              // rung approve, calls the one ratified-goal writer.
              if (goalGate.isStrategyCard(live.card)) {
                try {
                  strategyRatification = goalGate.ratifyGoalProposal(db, roomDir, {
                    card: live.card,
                    chosen: answer.chosen,
                    verdict: answer.verdict,
                    decisionNodeId: nodeId,
                  });
                } catch (e) {
                  strategyRatification = { ok: false, reason: 'goal_ratification_threw', detail: String((e && e.message) || e).slice(0, 80) };
                }
              }
            }
          } catch (e) {
            reasoningNode = { ok: false, reason: 'reasoning_write_threw', detail: String((e && e.message) || e).slice(0, 80) };
          }
        }

        // Phase 355 Plan 22: telemetry only, runs for approve AND reject
        // (see _maybeLogGateOutcome's own no-op guard for defer / non-
        // opportunity subjects). Placed after the approve branch so an
        // opportunity's `verification` prop is already on the row either way.
        _maybeLogGateOutcome(db, live, answer.verdict);
      } finally {
        navigation.closeRoomDbForCaller(db);
      }

      const response = {
        ok: true,
        gate_id: answer.gate_id,
        chosen: answer.chosen,
        verdict: answer.verdict,
        ratified: answer.verdict === 'approve',
        memory_event: logResult,
      };
      if (answer.verdict === 'approve') {
        response.reasoning_node = reasoningNode;
      }
      if (strategyRatification !== null) {
        response.strategy_ratification = strategyRatification;
      }

      // Ordering doctrine (quick task 260819-c55, Task 2): the ratification
      // memory_event above is written BEFORE the step executes, deliberately.
      // The halted step may be irreversible, so a step that runs must never
      // be unrecorded; the inverse case -- a ratification recorded for a
      // step that then faulted -- stays visible through chain_result.ok:false
      // below and is the recoverable direction.
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
  },
};
