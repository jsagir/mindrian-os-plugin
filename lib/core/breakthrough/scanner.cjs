'use strict';
/*
 * Phase 120-02 Wave 2 Task 3 -- The breakthrough scanner orchestrator. Wires:
 *   - Plan 120-00 detectors.cjs (the 4 pattern types)
 *   - Plan 120-00 schema.writeBreakthrough (the D-20 HARD FLOOR atomic writer)
 *   - Plan 120-01 scoring.pickTopWithAffordance (the D-11 + D-12 ranker)
 *   - Plan 120-02 resurfacing.isEligibleForSurfacing (D-13..D-15)
 *   - Plan 120-02 canary.computeDismissalRate (D-19)
 *   - Plan 120-01 selector-dispatcher.pickShape (F.7 surfacing)
 *
 * Per CONTEXT.md D-16 empty-state lock: if no eligible candidates, return
 *   top=null. The hook script then emits continue:true with NO additionalContext
 *   (silence; no placeholder; trust users to notice presence vs absence).
 *
 * Per CONTEXT.md D-20 third structural enforcement point: surfaceBreakthrough
 *   verifies the Breakthrough node has at least one DERIVED_FROM edge BEFORE
 *   dispatching F.7. The other two enforcement points are schema.cjs::
 *   validateProvenance + writeBreakthrough transaction (Plan 120-00) and
 *   shape-f7-breakthrough-renderer.cjs::renderShapeF7Breakthrough's artifact_ids
 *   check (Plan 120-01). Defense in depth.
 *
 * Canon Part 8 + Part 9 + Part 10 sub-claim 5: pure LOCAL; chokepoint-routed;
 *   the math IS the surface; variable reward fires automatically at session
 *   start. Zero Brain coupling; zero cross-room aggregation.
 *
 * Em-dash HARD RULE (CLAUDE.md feedback_no_emdashes): use "--" not U+2014.
 */

const path = require('node:path');
const detectors = require('./detectors.cjs');
const schema = require('./schema.cjs');
const scoring = require('./scoring.cjs');
const resurfacing = require('./resurfacing.cjs');
const canary = require('./canary.cjs');
// Plan 120-03 wires: voice-scaffold (D-17 4-rule auditor) + ethics-fence (D-18
// 4-tier hybrid fence). These are pure modules with zero Brain coupling.
const voiceScaffold = require('./voice-scaffold.cjs');
const ethicsFence = require('./ethics-fence.cjs');
const navigation = require('../navigation.cjs');
const roomDb = require('../room-db.cjs');
const crypto = require('node:crypto');
let selectorDispatcher = null;
try {
  selectorDispatcher = require('../../hmi/selector-dispatcher.cjs');
} catch (_e) {
  selectorDispatcher = null;
}

// Phase 121-02 D-07: lazy-require the unified telemetry writer at first emit.
// A missing writer module (stripped-down install) must not crash the scanner,
// so failures of require() degrade to a soft skip (no emit).
function _sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s || '')).digest('hex');
}

// applyThrottleFilter -- D-19 per-detector dismissal-rate canary filter. For
// every detector kind whose dismissal rate exceeds the D-19 threshold over the
// rolling 100-fire window, drops all candidates of that kind from the hard-fire
// ranking AND emits a breakthrough_throttled memory_event so /mos:doctor can
// surface the throttled detector. Returns { kept, throttled_kinds }.
function applyThrottleFilter(candidates, db) {
  const throttledKinds = [];
  if (!Array.isArray(candidates) || !db) {
    return { kept: Array.isArray(candidates) ? candidates : [], throttled_kinds: throttledKinds };
  }
  for (const kind of detectors.DETECTOR_TYPES) {
    const rateResult = canary.computeDismissalRate(kind, db);
    if (rateResult.throttled) {
      throttledKinds.push(kind);
      // Emit breakthrough_throttled event so /mos:doctor can surface throttled
      // detectors at session-start. Best-effort: never throws on infra hiccup.
      try { canary.emitThrottleEvent(kind, db, rateResult); } catch (_e) { /* swallow */ }
    }
  }
  const kept = throttledKinds.length === 0
    ? candidates
    : candidates.filter(function (c) {
        return c && typeof c.kind === 'string' && throttledKinds.indexOf(c.kind) === -1;
      });
  return { kept: kept, throttled_kinds: throttledKinds };
}

// applyResurfacingFilter -- D-13..D-15 resurfacing rules filter. Drops any
// candidate whose breakthrough_id has been confirmed (D-14 once-only),
// filed-as-decision (D-15 never-resurfaces), or dismissed-and-still-in-cooldown
// (D-13 BOTH-condition: 7-day cooldown AND new-artifacts-accumulated).
function applyResurfacingFilter(candidates, db) {
  if (!Array.isArray(candidates) || !db) {
    return Array.isArray(candidates) ? candidates : [];
  }
  return candidates.filter(function (c) {
    if (!c || typeof c.id !== 'string') return false;
    const elig = resurfacing.isEligibleForSurfacing(c.id, db, {
      current_artifact_count: Array.isArray(c.artifact_ids) ? c.artifact_ids.length : 0,
    });
    return elig && elig.eligible === true;
  });
}

// scanForBreakthroughs -- the session-start orchestrator. Runs the 4 detectors,
// applies the D-19 throttle filter + D-13..D-15 resurfacing filter, ranks
// surviving candidates via the Plan 120-01 scoring formula, persists the top
// via writeBreakthrough (D-20 HARD FLOOR), and returns
//   { top, more_count, throttled_kinds, queued, reason? }.
//
// D-16 empty-state silence: returns top=null whenever no eligible hard-fire
// candidate survives the filters. The caller hook then emits continue:true with
// NO additionalContext.
function scanForBreakthroughs(roomDir, opts) {
  const options = opts || {};
  const nowMs = (typeof options.now === 'number' && Number.isFinite(options.now)) ? options.now : Date.now();

  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    return { top: null, more_count: 0, throttled_kinds: [], reason: 'invalid_room_dir' };
  }

  // Open db via the canonical room-db chokepoint. openRoomDb returns the bare
  // DatabaseSync handle per the Phase 109-02 contract. If room.db cannot be
  // opened (e.g., missing or corrupt), degrade to D-16 silence.
  let db;
  try {
    db = roomDb.openRoomDb(roomDir);
  } catch (_e) {
    return { top: null, more_count: 0, throttled_kinds: [], reason: 'no_room_db' };
  }

  const roomState = { roomDir: roomDir, db: db, now: nowMs };

  // Run all 4 detectors. Each returns { hits, soft_fires }. Failures degrade
  // gracefully -- a broken Phase 117 math output file should not block the
  // surface; the failing detector returns empty and the others still surface.
  let allHits = [];
  const allSoftFires = [];
  try {
    const c1 = detectors.detectConvergence(roomState, options);
    const c2 = detectors.detectContradictionResolved(roomState, options);
    const c3 = detectors.detectCrossDomainAnalogy(roomState, options);
    const c4 = detectors.detectReverseSalientClosed(roomState, options);
    allHits = [].concat(c1.hits || [], c2.hits || [], c3.hits || [], c4.hits || []);
    allSoftFires.push(
      ...(c1.soft_fires || []),
      ...(c2.soft_fires || []),
      ...(c3.soft_fires || []),
      ...(c4.soft_fires || [])
    );
  } catch (_e) {
    return { top: null, more_count: 0, throttled_kinds: [], reason: 'detector_error' };
  }

  // D-19: apply the canary throttle filter. Drops any kind whose dismissal rate
  // exceeds 30% over the rolling 100-fire window. Reports throttled_kinds for
  // /mos:doctor traceability.
  const throttleResult = applyThrottleFilter(allHits, db);
  let candidates = throttleResult.kept;

  // D-13..D-15: apply the resurfacing filter. Drops confirmed / filed-as-decision /
  // in-cooldown dismissed candidates.
  candidates = applyResurfacingFilter(candidates, db);

  // Plan 120-03: D-18 4-tier ethics fence. Partition candidates into the 4 bands.
  //   HARD_CEILING -> proceeds to ranking (auto-surface)
  //   SOFT_BAND    -> routed to .rooms/breakthrough-review-queue.db + memory_event
  //                    breakthrough_in_review_queue (no surface, no ranking)
  //   HARD_FLOOR   -> structurally impossible at this point (writeBreakthrough
  //                    upstream refuses provenance-less inputs) BUT we apply
  //                    defense in depth and silently drop the candidate.
  //   BELOW_FLOOR  -> soft-fire territory already handled by detectors.classifyFireTier;
  //                    silently drop here (no double-buffer).
  // The HARD_CEILING partition is the only set that proceeds to scoring + surface.
  const hardCeilingHits = [];
  if (Array.isArray(candidates) && candidates.length > 0) {
    // Resolve a rooms-home for SOFT_BAND queue persistence. Prefer the explicit
    // option, then MINDRIAN_ROOMS_HOME env, then ~/MindrianRooms default.
    const roomsHome = options.roomsHome
      || (typeof process.env.MINDRIAN_ROOMS_HOME === 'string' && process.env.MINDRIAN_ROOMS_HOME.length > 0
            ? process.env.MINDRIAN_ROOMS_HOME
            : path.join(process.env.HOME || '', 'MindrianRooms'));
    for (const c of candidates) {
      const band = ethicsFence.classifyEthicsBand(c);
      if (band === 'HARD_CEILING') {
        hardCeilingHits.push(c);
      } else if (band === 'SOFT_BAND') {
        // Best-effort queue insert + memory_event mirror. Failure does NOT block
        // the scanner -- the SOFT_BAND candidate is silently dropped if persistence
        // fails (per the Plan 120-03 graceful-failure invariant).
        try {
          ethicsFence.queueForReview(c, roomsHome, { db: db, roomSlug: options.roomSlug });
        } catch (_e) { /* swallow */ }
      }
      // HARD_FLOOR + BELOW_FLOOR: silent drop. Defense in depth at the ethics layer.
    }
    candidates = hardCeilingHits;
  }

  // Soft-fire telemetry per CONTEXT.md D-01..D-02. Emit a breakthrough_detected_soft
  // event for every soft-tier candidate -- this populates the retraining signal
  // mentioned in the discuss-phase D-01 verbatim. Best-effort writes.
  for (const sf of allSoftFires) {
    if (!sf || typeof sf.id !== 'string') continue;
    try {
      navigation.logMemoryEvent(db, 'breakthrough_detected_soft', {
        breakthrough_id: sf.id,
        kind: typeof sf.kind === 'string' ? sf.kind : 'unknown',
        confidence: typeof sf.confidence === 'number' ? sf.confidence : 0,
        artifact_count: Array.isArray(sf.artifact_ids) ? sf.artifact_ids.length : 0,
        source_path: 'system:breakthrough-scanner',
        created_by: 'system',
      });
    } catch (_e) { /* swallow */ }
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    // D-16 empty-state silence: no eligible candidates survived the filters.
    return {
      top: null,
      more_count: 0,
      throttled_kinds: throttleResult.throttled_kinds,
    };
  }

  // D-11 + D-12: rank by the 5-component scoring formula; pick top-1; expose
  // the rest via the "More breakthroughs (N)" affordance.
  const pick = scoring.pickTopWithAffordance(candidates, roomState, nowMs);
  if (!pick || !pick.top) {
    return {
      top: null,
      more_count: 0,
      throttled_kinds: throttleResult.throttled_kinds,
    };
  }

  // D-20 HARD FLOOR: persist the top breakthrough via writeBreakthrough. The
  // atomic transaction inserts the Breakthrough node AND its DERIVED_FROM edges.
  // If the write is refused (provenance-less), do not surface; degrade silently.
  const writeResult = schema.writeBreakthrough(db, pick.top);
  if (!writeResult || !writeResult.ok) {
    return {
      top: null,
      more_count: 0,
      throttled_kinds: throttleResult.throttled_kinds,
      reason: 'writeBreakthrough_refused:' + (writeResult ? writeResult.reason : 'unknown'),
    };
  }

  return {
    top: pick.top,
    more_count: pick.more_count,
    throttled_kinds: throttleResult.throttled_kinds,
    queued: pick.queued,
  };
}

// surfaceBreakthrough -- the third D-20 structural enforcement point. Reads the
// canonical SQL invariant (SELECT COUNT(*) FROM edges WHERE source=? AND
// type='DERIVED_FROM') BEFORE dispatching F.7. If the count is < 1, emits a
// breakthrough_surface_blocked event for /mos:doctor traceability and refuses
// to surface. This catches constitutional bypass attempts (a fake Breakthrough
// node inserted outside the writeBreakthrough chokepoint).
//
// On success: dispatches F.7 via selector-dispatcher.pickShape, emits a
// breakthrough_surfaced memory_event, and flips the Breakthrough node's
// properties.surfaced = true.
function surfaceBreakthrough(breakthrough, options) {
  const opts = options || {};
  const db = opts.db;
  if (!db || !breakthrough || typeof breakthrough.id !== 'string' || breakthrough.id.length === 0) {
    return { ok: false, reason: 'invalid_input' };
  }

  // D-20 third structural enforcement: provenance MUST exist on disk before
  // F.7 dispatch. Defense in depth on top of schema.cjs::validateProvenance
  // and the renderer's artifact_ids check.
  let provenanceCount = 0;
  try {
    const row = db.prepare(
      "SELECT COUNT(*) AS c FROM edges WHERE source = ? AND type = 'DERIVED_FROM'"
    ).get(breakthrough.id);
    provenanceCount = (row && typeof row.c === 'number') ? row.c : 0;
  } catch (_e) {
    provenanceCount = 0;
  }
  if (provenanceCount < 1) {
    // Emit breakthrough_surface_blocked so /mos:doctor can find the refusal.
    // Best-effort: never throws.
    try {
      navigation.logMemoryEvent(db, 'breakthrough_surface_blocked', {
        breakthrough_id: breakthrough.id,
        kind: typeof breakthrough.kind === 'string' ? breakthrough.kind : 'unknown',
        reason: 'provenance_required',
        source_path: 'system:breakthrough-scanner',
        created_by: 'system',
      });
    } catch (_e) { /* swallow */ }
    return { ok: false, reason: 'provenance_required' };
  }

  // Plan 120-03: D-17 voice scaffold composition + audit gate.
  //
  // Compose the conversational opener via the 4-rule scaffold. If the composed
  // line fails the D-17 auditor (rule 1-4 violation), replace it with the
  // structural default (roomState=null variant of composeBreakthroughVoiceLine
  // which is auditor-safe BY CONSTRUCTION -- see voice-scaffold Test 4).
  //
  // This is defense in depth: no D-17-violating voice line EVER reaches the F.7
  // surface, regardless of caller-supplied mechanism_phrase content. The auditor
  // IS the structural enforcement (D-20 meta-principle).
  let voiceLine = '';
  try {
    const composed = voiceScaffold.composeBreakthroughVoiceLine(breakthrough, opts.roomState || null);
    const audit = voiceScaffold.auditVoiceLine(composed);
    voiceLine = audit.ok
      ? composed
      : voiceScaffold.composeBreakthroughVoiceLine(breakthrough, null);
  } catch (_e) {
    voiceLine = '';
  }

  // Dispatch F.7 via the Phase 88.2 selector dispatcher (Plan 120-01 registration).
  // If the dispatcher is unavailable (e.g., during isolated unit testing of the
  // surface gate), degrade gracefully -- we still emit the breakthrough_surfaced
  // event and flip the node property because those are the load-bearing side
  // effects per the test contract.
  let rendered = null;
  if (selectorDispatcher && typeof selectorDispatcher.pickShape === 'function') {
    try {
      rendered = selectorDispatcher.pickShape({
        requestedShape: 'F.7',
        roomDir: opts.roomDir,
        tier: typeof opts.tier === 'number' ? opts.tier : 1,
        payload: {
          breakthrough: breakthrough,
          more_count: typeof opts.more_count === 'number' ? opts.more_count : 0,
          voice_line: voiceLine,
        },
      });
    } catch (_e) {
      rendered = null;
    }
  }

  // Emit breakthrough_surfaced memory_event.
  try {
    navigation.logMemoryEvent(db, 'breakthrough_surfaced', {
      breakthrough_id: breakthrough.id,
      kind: typeof breakthrough.kind === 'string' ? breakthrough.kind : 'unknown',
      confidence: typeof breakthrough.confidence === 'number' ? breakthrough.confidence : 0,
      score: typeof breakthrough.score === 'number' ? breakthrough.score : null,
      more_count: typeof opts.more_count === 'number' ? opts.more_count : 0,
      source_path: 'system:breakthrough-scanner',
      created_by: 'system',
    });
  } catch (_e) { /* swallow */ }

  // Phase 121-02 D-07: capture breakthrough surfacing + F.7 verb + ethics tier
  // + voice audit pass/fail into the unified events-YYYY-WNN.jsonl stream
  // (Plan 121-00 writer chokepoint). The dismissal signal is valuable
  // regardless of whether the voice audit passed (Test 3). Throttled-by-
  // canary and provenance-blocked surfaces NEVER reach this point so they
  // structurally cannot emit (Test 4 + scanForBreakthroughs upstream
  // applyThrottleFilter).
  //
  // verb_chosen is populated from opts.verb_chosen when the caller pre-resolves
  // the F.7 choice (the typical end-to-end path); falls back to '' when the
  // surface is dispatched without a pre-selection. The dismissal vs accept
  // outcome is later captured by selector_pick (D-04) when the F.7 user pick
  // resolves. This event records the surfacing context + the proposed verb at
  // the dispatch boundary.
  //
  // Non-blocking: try/catch swallows writer breaches; the scanner still
  // returns ok:true to its caller.
  try {
    let writer = null;
    try {
      writer = require('../telemetry/writer.cjs');
    } catch (_e) {
      writer = null;
    }
    if (writer && typeof writer.emit === 'function') {
      const detector = (typeof breakthrough.detector_type === 'string' && breakthrough.detector_type.length > 0)
        ? breakthrough.detector_type
        : (typeof breakthrough.kind === 'string' ? breakthrough.kind : 'unknown');
      const ethicsTier = (typeof breakthrough.ethics_tier === 'string' && breakthrough.ethics_tier.length > 0)
        ? breakthrough.ethics_tier
        : 'NEUTRAL';
      const voiceAudit = Boolean(breakthrough.voice_audit_pass);
      const verbChosen = (opts && typeof opts.verb_chosen === 'string') ? opts.verb_chosen : '';
      const slugSrc = (opts && typeof opts.roomDir === 'string' && opts.roomDir.length > 0)
        ? String(opts.roomDir).split('/').filter(Boolean).pop() || opts.roomDir
        : (String(process.cwd()).split('/').filter(Boolean).pop() || 'default-room');
      writer.emit('breakthrough_dismissed', {
        detector_type: String(detector).slice(0, 64),
        verb_chosen: String(verbChosen).slice(0, 64),
        ethics_tier: String(ethicsTier).slice(0, 64),
        voice_audit_pass: voiceAudit,
        room_slug_sha256: _sha256Hex(slugSrc),
      });
    }
  } catch (_e) {
    // Telemetry MUST never crash the surfacing pipeline.
  }

  // Flip Breakthrough node properties.surfaced = true (best-effort update).
  try {
    const row = db.prepare(
      "SELECT properties FROM nodes WHERE id = ? AND type = 'breakthrough'"
    ).get(breakthrough.id);
    if (row) {
      let props = {};
      try { props = JSON.parse(row.properties); } catch (_e) { props = {}; }
      props.surfaced = true;
      props.surfaced_at = Date.now();
      db.prepare(
        "UPDATE nodes SET properties = ?, last_seen_at = ? WHERE id = ?"
      ).run(JSON.stringify(props), Date.now(), breakthrough.id);
    }
  } catch (_e) { /* swallow */ }

  return { ok: true, rendered: rendered, voice_line: voiceLine };
}

module.exports = {
  scanForBreakthroughs: scanForBreakthroughs,
  surfaceBreakthrough: surfaceBreakthrough,
  applyResurfacingFilter: applyResurfacingFilter,
  applyThrottleFilter: applyThrottleFilter,
};
