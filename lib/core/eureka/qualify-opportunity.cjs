'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 219-04 -- the REQ-3 qualification Decision Gate: verb handlers + the
 * F.1 card render for harvested opportunity candidates.
 *
 * The human gate that makes qualification a MATERIAL navigator decision
 * (Canon Part 3): nothing files into opportunity-bank/ without an explicit
 * [Qualify+file]; [Skip] writes rejection AS DATA (Decision 13, SEED-009).
 *
 * Consumes the Plan 03 side-channel candidate shape
 * (<roomDir>/.mindrian/last-opportunity-harvest.json, schema_version 1 --
 * restated verbatim in 219-03-PLAN.md interfaces). The side-channel is
 * enum/handle-only; the card HOST dereferences node handles against room.db
 * LOCALLY for display prose (`candidate.name` / the deref callback).
 *
 * The verb set (D-09, the Brain answer):
 *   [Qualify+file] [Ask Brain] [Rephrase] [Suggest next] [Skip]
 * plus, ONLY when the engine legs are unavailable (D-20; test seam
 * MINDRIAN_FORCE_ENGINE_ABSENT=1), the OFFER verb
 *   [LLM manual scan (high effort)]
 * presented at the gate -- NEVER the default, NEVER a silent substitution
 * (the corepower lesson: manual mode masquerading as the engine is the
 * anti-goal). A manual-mode result carries engine_mode 'llm_manual_baseline'
 * in provenance, node props, and the bank entry frontmatter, NEVER flips
 * calibration/baseline status, and is EXCLUDED from calibration sets (the
 * marker is the exclusion contract downstream consumers key on).
 *
 * Planner decision (logged in 219-04-PLAN.md): BOTH Qualify and Skip mint the
 * proposed opportunity node idempotently first (writeOpportunityNode UPSERT,
 * or the eureka-lane node_handle when it already exists) -- Qualify then
 * confirms (confirmNode, the human promote, Part 9 role 5) and advances
 * lifecycle to 'qualified'; Skip leaves the node PROPOSED and hangs the
 * REJECTED_BECAUSE edge on it. Rejection edges need a stable anchor node, and
 * the dedup policy suppresses resurfacing via exactly these edges.
 *
 * D-17: every qualify/skip transition APPENDS an immutable stage_history entry
 * {actor, reason, evidence_ids, formula_version} via advanceOpportunityStage
 * -- the bare new-value props overwrite is the exact forbidden pattern.
 *
 * SEED-021 / D-09: the card renders through the EXISTING F.1 door --
 * lib/hmi/shape-f1-renderer.cjs renderShapeF1 + the dispatcher's
 * appendAskUserQuestionTrailer (the SEED-020 single construction door) --
 * never an ASCII-box fallback on card-capable surfaces. The D-20 offer verb
 * rides the renderer's EXISTING secondary-row convention (the Phase 148-03
 * standing-trio idiom: appended AFTER the capped chooser set and BEFORE the
 * trailing Free-Text, outside USER_VERB_CAP) rather than forking the renderer.
 *
 * REQ-4 handoff (Plan 05): qualifyCandidate NEVER invokes the analysis chain
 * (navigator cost control). That verb is a SEPARATE material surface Plan 05
 * mints; there is deliberately zero chain wiring in this module (test-pinned
 * by a comment-filtered source scan).
 *
 * Part 8: LOCAL only. Zero network. askBrain composes GENERIC framework
 * handles/enums ONLY (never candidate prose -- T-219-14) and degrades to a
 * recommend-never-trigger note; the actual Brain wire belongs to the host
 * surface, never this module.
 *
 * All handlers return { ok, ... } and NEVER throw.
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');

const navigation = require('../navigation.cjs');

// The born-wired command surface this module renders for. recordReachedGate
// requires the BARE registry surface path (card-fire-sidechannel SCHEMA NOTE:
// composite / non-registry strings never intersect gateReachingEntries and
// leave PRIMARY detection inert), so the reached-gate record carries the
// commands/*.md registry key, with the dispatch slug kept in the header docs.
const SURFACE = 'commands/qualify-opportunity.md';

// The 5-verb chooser set (D-09, the Brain answer). Exactly USER_VERB_CAP wide,
// so renderShapeF1 renders all five + the hardcoded trailing Free-Text.
const CARD_VERBS = Object.freeze([
  'Qualify+file',
  'Ask Brain',
  'Rephrase',
  'Suggest next',
  'Skip',
]);

// The D-20 OFFER verb: engine-unavailable gates ONLY (never default).
const OFFER_VERB = 'LLM manual scan (high effort)';

// The closed Skip reason enum (219-04-PLAN.md interfaces): the failed-check
// enum written into REJECTED_BECAUSE properties.reason -- a single enum
// scalar only (Part 8). Mirrors the rubric's classic false positives.
const SKIP_REASONS = Object.freeze([
  'q1_no_friction',
  'q3_within_cluster',
  'q4_stale_window',
  'q5_no_actor',
  'q7_already_filed',
  'q8_disqualified',
  'off_topic',
]);

// The Q1..Q8 rubric check names (219-RESEARCH Brain-sourced qualification
// doctrine) for the compressed WHY lines (pedagogy over verdict, Part 12).
const RUBRIC_CHECKS = Object.freeze([
  ['q1', 'friction/creation'],
  ['q2', 'connection (hard gate)'],
  ['q3', 'surprise'],
  ['q4', 'timing'],
  ['q5', 'actor fit'],
  ['q6', 'definability'],
  ['q7', 'newness'],
  ['q8', 'desirability'],
]);

const FORMULA_VERSION = 'HarvestIndex_v1';

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// D-20 engine-availability seam. The producer-side engine probes live in Plan
// 03's harvest producer; at THIS surface the honest signals are the forced
// test seam and an explicit host flag (the host knows the side-channel was
// absent because the engine legs failed beyond the graceful rungs).
function engineAbsent(opts) {
  if (process.env.MINDRIAN_FORCE_ENGINE_ABSENT === '1') return true;
  return isPlainObject(opts) && opts.engineAbsent === true;
}

// Resolve the candidate's stable anchor node (the logged planner decision):
// an existing eureka-lane node_handle wins (the mint is a no-op for it);
// otherwise mint idempotently via writeOpportunityNode (keyed on
// sessionId + name, the 31-multiplier hash UPSERT).
function resolveAnchorNode(db, candidate, byUser, reason) {
  const handle = (typeof candidate.node_handle === 'string' && candidate.node_handle.length > 0)
    ? candidate.node_handle : null;
  if (handle) {
    let row = null;
    try {
      row = db.prepare('SELECT id FROM nodes WHERE id = ?').get(handle);
    } catch (_e) {
      row = null;
    }
    if (row) return { ok: true, node_id: handle, minted: false };
  }
  const name = (typeof candidate.name === 'string' && candidate.name.length > 0)
    ? candidate.name
    : 'candidate:' + String(candidate.candidate_id || 'unknown');
  const sessionId = (typeof candidate.session_id === 'string' && candidate.session_id.length > 0)
    ? candidate.session_id : 'opportunity-harvest';
  const engineMode = (typeof candidate.engine_mode === 'string' && candidate.engine_mode.length > 0)
    ? candidate.engine_mode : 'engine';
  const minted = navigation.writeOpportunityNode(db, {
    name: name,
    sessionId: sessionId,
    lifecycle: 'candidate',
    lens: typeof candidate.lens === 'string' ? candidate.lens : undefined,
    score: typeof candidate.score === 'number' ? candidate.score : undefined,
    actor: byUser,
    reason: reason,
    evidence_ids: Array.isArray(candidate.evidence_handles) ? candidate.evidence_handles : [],
    formula_version: FORMULA_VERSION,
    // D-20: engine_mode stays visible end-to-end (node props here; bank
    // frontmatter below; calibration consumers exclude on this marker).
    extraProps: {
      engine_mode: engineMode,
      candidate_id: typeof candidate.candidate_id === 'string' ? candidate.candidate_id : undefined,
      source_event: typeof candidate.source_event === 'string' ? candidate.source_event : undefined,
    },
  });
  if (!minted || minted.ok !== true) {
    return { ok: false, reason: 'mint_failed', detail: minted && minted.reason };
  }
  return { ok: true, node_id: minted.node_id, minted: true };
}

/**
 * qualifyCandidate(db, roomDir, candidate, byUser) -- the [Qualify+file] verb.
 *
 * Idempotent mint -> confirmNode (the HUMAN promote, proposed -> confirmed,
 * Part 9 role 5) -> advanceOpportunityStage lifecycle 'qualified' (D-17
 * append-only history with actor/reason/evidence_ids/formula_version) ->
 * bankOpportunity filing (the +file half, problem_hash dedup), all through
 * navigation.cjs / opportunity-ops chokepoints.
 *
 * This is the ONLY path that files into opportunity-bank/. It NEVER invokes
 * the analysis chain (REQ-4 handoff: that trigger is Plan 05's separate
 * material surface). Returns { ok, node_id, banked } -- never throws.
 */
function qualifyCandidate(db, roomDir, candidate, byUser) {
  try {
    if (!db || !isPlainObject(candidate)) {
      return { ok: false, reason: 'invalid_params' };
    }
    const actor = (typeof byUser === 'string' && byUser.length > 0) ? byUser : 'navigator';
    const anchor = resolveAnchorNode(db, candidate, actor, 'minted at qualification card');
    if (!anchor.ok) return anchor;
    const nodeId = anchor.node_id;

    // The human promote. A re-qualify of an already-confirmed node surfaces
    // promoteNodeStatus's state_mismatch honestly; treat currentStatus
    // 'confirmed' as already-done (idempotent re-qualify), anything else as
    // a real failure.
    const confirmed = navigation.confirmNode(db, nodeId, actor, 'qualified via card');
    if (!confirmed || confirmed.ok !== true) {
      const already = confirmed && confirmed.reason === 'state_mismatch'
        && confirmed.currentStatus === 'confirmed';
      if (!already) {
        return { ok: false, reason: 'confirm_failed', detail: confirmed && confirmed.reason, node_id: nodeId };
      }
    }

    // D-17: the append-only lifecycle transition (never a props overwrite).
    const advanced = navigation.advanceOpportunityStage(db, {
      node_id: nodeId,
      axis: 'lifecycle',
      to: 'qualified',
      actor: actor,
      reason: 'qualified via card',
      evidence_ids: Array.isArray(candidate.evidence_handles) ? candidate.evidence_handles : [],
      formula_version: FORMULA_VERSION,
    });
    if (!advanced || advanced.ok !== true) {
      return { ok: false, reason: 'advance_failed', detail: advanced && advanced.reason, node_id: nodeId };
    }

    // The +file half: bank via opportunity-ops (problem_hash dedup). Lazy
    // require keeps this module light for render-only callers.
    let banked = { banked: false, updated: false, path: '' };
    if (typeof roomDir === 'string' && roomDir.length > 0) {
      const oppOps = require('../opportunity-ops.cjs');
      const name = (typeof candidate.name === 'string' && candidate.name.length > 0)
        ? candidate.name
        : 'candidate:' + String(candidate.candidate_id || 'unknown');
      banked = oppOps.bankOpportunity(roomDir, {
        problem: name,
        domain: typeof candidate.lens === 'string' ? candidate.lens : 'unknown',
        evidence: Array.isArray(candidate.evidence_handles) ? candidate.evidence_handles.join(', ') : '',
        source_framework: 'opportunity-harvest',
        knight_position: 'uncertainty',
        confidence: typeof candidate.score === 'number' ? candidate.score : 0,
        status: 'qualified',
        provenance: nodeId,
        // D-20: llm_manual_baseline stays visible in the bank frontmatter and
        // is excluded from calibration sets by this marker.
        engine_mode: (typeof candidate.engine_mode === 'string' && candidate.engine_mode.length > 0)
          ? candidate.engine_mode : 'engine',
      });
      if (!banked || (banked.banked !== true && banked.updated !== true)) {
        return { ok: false, reason: 'bank_failed', detail: banked && banked.error, node_id: nodeId };
      }
    }

    return { ok: true, node_id: nodeId, minted: anchor.minted, banked: banked.banked === true || banked.updated === true };
  } catch (e) {
    return { ok: false, reason: 'qualify_threw', detail: String(e && e.message || '').slice(0, 80) };
  }
}

/**
 * skipCandidate(db, candidate, reasonEnum, targetId, byUser?) -- the [Skip]
 * verb. Rejection is DATA (Decision 13, SEED-009, D-05): idempotent mint +
 * ONE REJECTED_BECAUSE edge carrying the single failed-check enum scalar (the
 * lens-engine applyReject idiom) + the D-17 outcome transition to 'rejected'.
 * The node stays review_status 'proposed' (Skip never confirms); nothing
 * files. An out-of-enum reason is rejected with { ok:false }. Never throws.
 */
function skipCandidate(db, candidate, reasonEnum, targetId, byUser) {
  try {
    if (!db || !isPlainObject(candidate)) {
      return { ok: false, reason: 'invalid_params' };
    }
    if (typeof reasonEnum !== 'string' || SKIP_REASONS.indexOf(reasonEnum) === -1) {
      return { ok: false, reason: 'invalid_skip_reason', detail: String(reasonEnum).slice(0, 40) };
    }
    const actor = (typeof byUser === 'string' && byUser.length > 0) ? byUser : 'navigator';
    const anchor = resolveAnchorNode(db, candidate, actor, 'minted at qualification card');
    if (!anchor.ok) return anchor;
    const nodeId = anchor.node_id;

    const target = (typeof targetId === 'string' && targetId.length > 0)
      ? targetId
      : (Array.isArray(candidate.evidence_handles) && candidate.evidence_handles.length > 0
        ? candidate.evidence_handles[0] : null);
    if (!target) {
      return { ok: false, reason: 'no_rejection_target', node_id: nodeId };
    }

    // The applyReject idiom: a single enum reason scalar (Part 8).
    const edge = navigation.writeEdge(db, {
      source_id: nodeId,
      target_id: target,
      edge_type: 'REJECTED_BECAUSE',
      properties: { reason: reasonEnum },
    });
    if (!edge || edge.ok !== true) {
      return { ok: false, reason: 'rejection_edge_failed', detail: edge && edge.reason, node_id: nodeId };
    }

    // D-17: outcome axis 'rejected', append-only history.
    const advanced = navigation.advanceOpportunityStage(db, {
      node_id: nodeId,
      axis: 'outcome',
      to: 'rejected',
      actor: actor,
      reason: reasonEnum,
      evidence_ids: Array.isArray(candidate.evidence_handles) ? candidate.evidence_handles : [],
      formula_version: FORMULA_VERSION,
    });
    if (!advanced || advanced.ok !== true) {
      return { ok: false, reason: 'advance_failed', detail: advanced && advanced.reason, node_id: nodeId };
    }

    return { ok: true, node_id: nodeId, target_id: target, skip_reason: reasonEnum };
  } catch (e) {
    return { ok: false, reason: 'skip_threw', detail: String(e && e.message || '').slice(0, 80) };
  }
}

/**
 * formatRubricLines(rubric) -- compress the q1..q8 verdict bag into <= 8
 * short WHY lines naming the passed/failed checks (pedagogy over verdict,
 * Part 12). Failed checks get one named line each; passed checks compress
 * into a single roll-up line, so the bound holds for every mix (worst case:
 * 8 failed lines, or 7 failed + 1 pass roll-up). A fractional verdict >= 0.5
 * counts pass; a typed 'unknown' is named verbatim as its own state, never
 * coerced to a fail or a zero. Garbage in -> [] out; never throws.
 */
function formatRubricLines(rubric) {
  if (!isPlainObject(rubric)) return [];
  const passed = [];
  const failed = [];
  const unknown = [];
  for (const [key, label] of RUBRIC_CHECKS) {
    const v = rubric[key];
    if (v === undefined || v === null) continue;
    if (v === 'unknown') {
      unknown.push('Q' + key.slice(1) + ' ' + label);
    } else if (typeof v === 'number' && v >= 0.5) {
      passed.push('Q' + key.slice(1) + ' ' + label);
    } else {
      failed.push('Q' + key.slice(1) + ' ' + label);
    }
  }
  const lines = [];
  for (const f of failed) {
    lines.push('* fail: ' + f);
  }
  if (unknown.length > 0) {
    lines.push('* unknown: ' + unknown.join(', '));
  }
  // Pass roll-up chunked 4 checks/line so lines stay short. The <= 8 bound
  // holds for every mix: failed(f) + grouped-unknown(0|1) + ceil(passed/4)
  // over the 8 checks never exceeds 8 lines.
  for (let i = 0; i < passed.length; i += 4) {
    lines.push('* pass: ' + passed.slice(i, i + 4).join(', '));
  }
  return lines.slice(0, 8);
}

// Render one D-18 component value honestly: a typed 'unknown' (or
// 'insufficient_evidence') renders VERBATIM, never as 0 -- a zero means
// measured-zero (D-18).
function componentValue(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return 'unknown';
}

/**
 * formatComponentLines(components, harvestIndex) -- the D-18 machine-readiness
 * WHY lines (components = existing measured signals; the Q1..Q8 rubric = the
 * human card checks). The index line names its version + EXPERIMENTAL status
 * on every emission (advisory, never a surfacing filter beyond the Q2 hard
 * gate). Missing inputs render the typed 'unknown' verbatim. Never throws.
 */
function formatComponentLines(components, harvestIndex) {
  if (!isPlainObject(components) && !isPlainObject(harvestIndex)) return [];
  const lines = [];
  if (isPlainObject(components)) {
    lines.push('* critic gate: ' + componentValue(components.critic_gate));
    lines.push('* compression: ' + componentValue(components.compression_score));
    const ps = components.portfolio_score;
    if (isPlainObject(ps)) {
      lines.push('* portfolio: fit ' + componentValue(ps.strategic_fit)
        + ' / demand ' + componentValue(ps.validated_demand)
        + ' / feasibility ' + componentValue(ps.feasibility));
    } else {
      lines.push('* portfolio: ' + componentValue(ps));
    }
    lines.push('* tail flag: ' + componentValue(components.tail_flag));
    lines.push('* evidence readiness: ' + componentValue(components.evidence_readiness));
    lines.push('* follow-through readiness: ' + componentValue(components.follow_through_readiness));
  }
  if (isPlainObject(harvestIndex)) {
    const version = typeof harvestIndex.version === 'string' && harvestIndex.version.length > 0
      ? harvestIndex.version : FORMULA_VERSION;
    const status = typeof harvestIndex.status === 'string' && harvestIndex.status.length > 0
      ? harvestIndex.status : 'EXPERIMENTAL';
    lines.push('* ' + version + ' (' + status + '): ' + componentValue(harvestIndex.value));
  }
  return lines;
}

// Dereference the candidate's display title. The deref callback (when
// supplied by the card host) resolves the node handle against room.db
// LOCALLY; the side-channel itself never carries prose.
function derefTitle(candidate, deref) {
  const handle = (typeof candidate.node_handle === 'string' && candidate.node_handle.length > 0)
    ? candidate.node_handle
    : (typeof candidate.candidate_id === 'string' ? candidate.candidate_id : null);
  if (typeof deref === 'function') {
    try {
      const resolved = deref(handle);
      if (typeof resolved === 'string' && resolved.length > 0) return resolved;
    } catch (_e) {
      // fall through to the candidate's own display fields
    }
  }
  if (typeof candidate.name === 'string' && candidate.name.length > 0) return candidate.name;
  return 'Opportunity candidate ' + String(handle || 'unknown');
}

// The D-20 offer append: mirror the renderer's EXISTING secondary-row
// convention (Phase 148-03 standing trio: rows appended AFTER the capped
// chooser set and BEFORE the trailing Free-Text, outside USER_VERB_CAP) --
// never a renderer fork. Splices the offer verb into contract.verbs before
// Free-Text and rebuilds the body rows in the renderer's exact row format
// (marker + index + verb) so numbering stays consistent.
function appendOfferVerb(rendered) {
  if (!rendered || !rendered.contract || !Array.isArray(rendered.contract.verbs)) return rendered;
  const verbs = rendered.contract.verbs.slice();
  const freeIdx = verbs.indexOf('Free-Text');
  if (freeIdx === -1) {
    verbs.push(OFFER_VERB);
  } else {
    verbs.splice(freeIdx, 0, OFFER_VERB);
  }
  rendered.contract.verbs = verbs;
  const recommended = rendered.contract.recommended || null;
  const rows = verbs.map(function (verb, i) {
    const prefix = (recommended && verb === recommended) ? '▶' : '▷';
    return prefix + ' ' + String(i + 1) + '. ' + verb;
  });
  if (rendered.zones && typeof rendered.zones === 'object') {
    rendered.zones.body = rows.join('\n');
  }
  return rendered;
}

/**
 * renderQualificationCard(candidate, deref, opts?) -- the F.1 card render
 * (D-09: the existing dispatcher door; SEED-021: a real AskUserQuestion
 * contract, never an ASCII box).
 *
 * Builds the F.1 input (title from the dereferenced candidate name; WHY
 * lines from formatRubricLines + formatComponentLines prepended to the body
 * the same way the dispatcher's brain-suggestion overlay composes body
 * content), renders via renderShapeF1, appends the D-20 offer verb ONLY
 * under the engine-absent seam (secondary-row convention), appends the
 * AskUserQuestion trailer via the dispatcher's appendAskUserQuestionTrailer
 * (the SEED-020 single construction door), and records the fire via
 * recordReachedGate against the registry surface path (T-219-16 audit).
 *
 * opts: { gateFilePath?, sessionId?, engineAbsent?, tier? }. Render is a
 * PURE presentation: zero node/edge/bank writes (test-pinned). Returns
 * { ok, rendered, offer_present } -- never throws.
 */
function renderQualificationCard(candidate, deref, opts) {
  try {
    if (!isPlainObject(candidate)) {
      return { ok: false, reason: 'invalid_candidate' };
    }
    const options = isPlainObject(opts) ? opts : {};
    const { renderShapeF1 } = require('../../hmi/shape-f1-renderer.cjs');
    const dispatcher = require('../../hmi/selector-dispatcher.cjs');

    const title = derefTitle(candidate, deref);
    const rendered = renderShapeF1({
      tier: typeof options.tier === 'number' ? options.tier : 0,
      recommendedVerb: 'Qualify+file',
      verbs: CARD_VERBS.slice(),
      header: '-- qualify opportunity -- ' + title + ' --',
    });

    const offerPresent = engineAbsent(options);
    if (offerPresent) {
      appendOfferVerb(rendered);
    }

    // The WHY lines (Part 12: pedagogy over verdict): compressed Q1..Q8
    // rubric verdicts + the D-18 machine-readiness components, prepended to
    // the body ahead of the verb rows (the applyBrainSuggestionVariant
    // body-composition precedent).
    const whyLines = formatRubricLines(candidate.rubric)
      .concat(formatComponentLines(candidate.components, candidate.harvest_index));
    if (whyLines.length > 0 && rendered.zones && typeof rendered.zones === 'object') {
      rendered.zones.body = whyLines.join('\n') + '\n\n' + rendered.zones.body;
    }
    if (offerPresent && rendered.zones && typeof rendered.zones === 'object') {
      rendered.zones.body += '\n\n* engine legs unavailable: [' + OFFER_VERB
        + '] is an OFFER (results carry engine_mode llm_manual_baseline, excluded from calibration)';
    }

    // The SEED-020 single construction door: the self-decoding trailer.
    dispatcher.appendAskUserQuestionTrailer(rendered, 'F.1');

    // T-219-16: the render-coverage audit record. Surface is the BARE
    // registry path (card-fire-sidechannel SCHEMA NOTE) so PRIMARY detection
    // intersects gateReachingEntries exactly.
    try {
      const sidechannel = require('../card-fire-sidechannel.cjs');
      const subjectText = [
        rendered.zones && rendered.zones.header,
        rendered.zones && rendered.zones.body,
      ].filter(function (s) { return typeof s === 'string' && s.length > 0; }).join(' ');
      sidechannel.recordReachedGate({
        sessionId: typeof options.sessionId === 'string' ? options.sessionId : undefined,
        surface: SURFACE,
        shape: 'F.1',
        filePath: typeof options.gateFilePath === 'string' ? options.gateFilePath : undefined,
        subjectText: subjectText,
      });
    } catch (_e) {
      // The audit record is best-effort; a side-channel fault never blocks
      // the presentation (the dispatcher's own idiom).
    }

    return { ok: true, rendered: rendered, offer_present: offerPresent };
  } catch (e) {
    return { ok: false, reason: 'render_threw', detail: String(e && e.message || '').slice(0, 80) };
  }
}

/**
 * rephraseCandidate(candidate) -- the [Rephrase] verb: hands the candidate
 * back for re-title. ZERO writes (nothing files without Qualify).
 */
function rephraseCandidate(candidate) {
  if (!isPlainObject(candidate)) return { ok: false, reason: 'invalid_candidate' };
  return { ok: true, action: 'rephrase', candidate: candidate };
}

/**
 * suggestNext(candidates, currentCandidateId) -- the [Suggest next] verb:
 * returns the next-ranked candidate HANDLE (by descending score after the
 * current one). No next candidate degrades to null. ZERO writes.
 */
function suggestNext(candidates, currentCandidateId) {
  try {
    if (!Array.isArray(candidates)) return { ok: false, reason: 'invalid_candidates' };
    const ranked = candidates
      .filter(function (c) { return isPlainObject(c); })
      .slice()
      .sort(function (a, b) {
        return (typeof b.score === 'number' ? b.score : 0) - (typeof a.score === 'number' ? a.score : 0);
      });
    const idx = ranked.findIndex(function (c) { return c.candidate_id === currentCandidateId; });
    const next = (idx !== -1 && idx + 1 < ranked.length) ? ranked[idx + 1] : null;
    return { ok: true, next_candidate_id: next ? next.candidate_id : null };
  } catch (e) {
    return { ok: false, reason: 'suggest_threw', detail: String(e && e.message || '').slice(0, 80) };
  }
}

/**
 * askBrain(candidate) -- the [Ask Brain] verb: composes a GENERIC framework
 * handle bag ONLY (Part 8 / T-219-14: enums and closed vocabulary, never
 * candidate prose -- the only network-adjacent verb, and even here the wire
 * itself belongs to the host surface). Degrades gracefully to a
 * recommend-never-trigger note when Brain is absent (the RESEARCH
 * environment-availability contract). ZERO local writes.
 */
function askBrain(candidate) {
  if (!isPlainObject(candidate)) return { ok: false, reason: 'invalid_candidate' };
  const handles = {
    framework: 'opportunity-qualification',
    rubric: 'Q1..Q8',
    lens: typeof candidate.lens === 'string' ? candidate.lens : 'unknown',
    source_event: typeof candidate.source_event === 'string' ? candidate.source_event : 'unknown',
    band: typeof candidate.band === 'string' ? candidate.band : 'unknown',
  };
  return {
    ok: true,
    brain_available: false,
    handles: handles,
    note: 'Brain consult is recommend-never-trigger from this surface: the host fires the '
      + 'generic-handle query when Brain is reachable; absent Brain, decide from the local '
      + 'rubric verdicts on the card.',
  };
}

module.exports = {
  qualifyCandidate,
  skipCandidate,
  formatRubricLines,
  formatComponentLines,
  renderQualificationCard,
  rephraseCandidate,
  suggestNext,
  askBrain,
  SKIP_REASONS,
  CARD_VERBS,
  OFFER_VERB,
  SURFACE,
};
