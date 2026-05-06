/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 101-04 + 101-05 + 88.2-04 -- single integration point for Shape F/G/H rendering.
 *
 * Phase 101-05 (Mode A/B/Tier 0 graceful degradation per Canon Part 3):
 *
 *   Tier helper:
 *     - Resolved at: lib/hmi/tier-check.cjs (v1 stub; Phase 90 follow-on
 *       will replace with full Brain-ping + cache + BRAIN.md presence audit).
 *     - Expected return from getTier(): integer in {0, 1, 2, 3}.
 *     - Mode mapping (Canon Part 3 "Option generation tier-awareness"):
 *         tier >= 2 -> Mode A (Full Loop): Brain reachable, RECOMMENDED >= 0.7 marker rendered.
 *         tier 1    -> Mode B (Local Only): Navigation Engine; no RECOMMENDED marker; Zone 1 carries
 *                      "Brain unreachable; running on local graph only." prefix line.
 *         tier 0    -> degraded; dispatcher refuses expensive shapes per Canon Part 3 Rule 2,
 *                      returns { shape: 'error', rendered: { error: 'tier-0-refused', ... } }.
 *
 *   Defense-in-depth: dispatcher computes mode from tier and propagates `mode` to every renderer.
 *   Renderers (F.6 + G + H) ALSO suppress RECOMMENDED markers internally when mode === 'B' so a
 *   buggy caller who forgets to pass mode still cannot leak a `▶` marker in Mode B.
 *
 * Phase 88.2-04 (Operator-aware F.1..F.5 sub-shape dispatch + telemetry + AskUserQuestion trailer):
 *
 *   F.1..F.5 sub-shape dispatch:
 *     requestedShape ∈ {'F.1','F.2','F.3','F.4','F.5'} routes directly to the matching
 *     Phase 88.2 wave-1 renderer (lib/hmi/shape-fN-renderer.cjs). The umbrella 'F'
 *     branch is preserved byte-stable -- it still routes via JTBD state to F.6 (or
 *     F.1 fallback). Existing 9-test selector-dispatcher contract is preserved.
 *
 *   JUST_TALK refuse (Canon Part 3 + render-v2 compaction gate):
 *     When `operator === 'JUST_TALK'` and ANY Shape F.* (umbrella or sub-shape) is
 *     requested, the dispatcher returns:
 *       { shape: 'error', rendered: { error: 'render_v2_compaction_violation', ... } }
 *     mirroring lib/render/render-v2.cjs#244 ("JUST_TALK suppresses ALL output").
 *     A Shape F selector cannot be presented while the conversation is in JUST_TALK
 *     prose-only mode without violating the compaction contract.
 *
 *   Telemetry emission (Canon Part 8 LOCAL ONLY):
 *     Every successful Shape F.* presentation calls
 *     selector-telemetry.recordPresentation(roomDir, {sub_shape, mode, options_count,
 *     recommended_present, operator}). Wrapped in try/catch -- telemetry NEVER fails
 *     Larry's turn. The companion recordResponse() is exposed as a re-export for
 *     consumers that wire the AskUserQuestion answer back to the ledger.
 *
 *   AskUserQuestion structural-marker trailer:
 *     Every successful Shape F.* return carries an
 *     `rendered.askuserquestion_marker = '[AskUserQuestion contract: shape=F.X verbs=N]'`
 *     scalar AND the marker is appended (preceded by a blank line) to
 *     `rendered.zones.footer`. Consumers that compose zones see the trailer
 *     in the rendered surface; consumers that introspect the contract can
 *     read the scalar directly.
 *
 * API:
 *   pickShape({ requestedShape, roomDir, operator, tier, payload })
 *     -> { shape, rendered } | { shape, passthrough: true }
 *
 *   - requestedShape:    'F' | 'F.1' | 'F.2' | 'F.3' | 'F.4' | 'F.5' | 'G' | 'H' | 'A' | 'B' | 'C' | 'D' | 'E'
 *   - roomDir:           absolute path; used to read JTBD state for F-shape dispatch.
 *   - operator:          one of OPERATORS or null. JUST_TALK refuses Shape F.*.
 *   - tier:              optional override; if omitted, dispatcher calls getTier().
 *   - payload:           shape-specific input forwarded to the corresponding renderer.
 *
 *   recordSelectorResponse(roomDir, record)
 *     Re-export of selector-telemetry.recordResponse for consumers wiring
 *     AskUserQuestion answers back to the local ledger.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant).
 */

'use strict';

const FREE_TEXT = 'Free-Text';
const MODE_B_ZONE1_PREFIX = '⚠ Brain unreachable; running on local graph only.';

// Phase 88.2-04: F.* sub-shape registry and JUST_TALK refuse vocabulary.
// Phase 88.2-05: 'F.0' Mini Decision Gate prepended (closed-vocab; freeTextOffered:false carve-out).
// Phase 88.2-06: 'F.6' Plan Review Round appended (closed-vocab; routes to the
//   collision-safe lib/hmi/shape-f6-plan-review-renderer.cjs path; the umbrella 'F'
//   branch continues to route to Phase 101-01's lib/hmi/shape-f6-renderer.cjs via
//   JTBD logic preserved byte-stable per R1 invariant).
const F_SUBSHAPES = ['F.0', 'F.1', 'F.2', 'F.3', 'F.4', 'F.5', 'F.6'];
const F_UMBRELLA = 'F';
const JUST_TALK = 'JUST_TALK';
const COMPACTION_VIOLATION_CODE = 'render_v2_compaction_violation';

function safeRequire(modPath) {
  try {
    return require(modPath);
  } catch (e) {
    if (e && e.code === 'MODULE_NOT_FOUND') return null;
    throw e;
  }
}

function resolveTier(explicitTier) {
  if (typeof explicitTier === 'number' && Number.isFinite(explicitTier)) {
    return explicitTier;
  }
  try {
    const helper = require('./tier-check.cjs');
    const t = helper.getTier();
    return (typeof t === 'number' && Number.isFinite(t)) ? t : 1;
  } catch (e) {
    // tier-check absent or broken -> assume Local Only (Mode B), the safer default.
    return 1;
  }
}

function modeFromTier(tier) {
  if (tier >= 2) return 'A';
  if (tier === 1) return 'B';
  return '0';
}

/**
 * Defense-in-depth: ensure Free-Text is the last verb in any F-shape contract.
 * Per Canon Part 3 Layer 2 + D-10. Mutates the rendered structure in place.
 *
 * Phase 88.2-04 carve-out: closed-vocabulary sub-shapes (F.3 Rabbit-Hole Depth,
 * F.4 Insight Extraction) DO NOT offer Free-Text per skills/ui-system/SKILL.md
 * Section 2 (depth/extraction are closed axes). Renderers signal this by
 * setting `contract.freeTextOffered === false`. Respecting that flag preserves
 * the closed-vocab invariant; injecting Free-Text would silently break the
 * Wave-1 contract and the renderer's own 7-assertion test suite.
 */
function ensureFreeTextLast(rendered) {
  if (!rendered || !rendered.contract || !Array.isArray(rendered.contract.verbs)) return rendered;
  // Closed-vocab carve-out: F.3, F.4 explicitly opt out of Free-Text.
  if (rendered.contract.freeTextOffered === false) return rendered;
  const verbs = rendered.contract.verbs;
  if (verbs.length === 0 || verbs[verbs.length - 1] !== FREE_TEXT) {
    const filtered = verbs.filter(v => v !== FREE_TEXT);
    filtered.push(FREE_TEXT);
    rendered.contract.verbs = filtered;
  }
  return rendered;
}

/**
 * Prepend the Mode B Zone 1 prefix to a renderer's zones.header. The prefix is
 * a separate line BEFORE the renderer's own header (Task 2.3 contract).
 */
function applyModeBPrefix(rendered) {
  if (!rendered || !rendered.zones) return rendered;
  const existing = typeof rendered.zones.header === 'string' ? rendered.zones.header : '';
  rendered.zones.header = MODE_B_ZONE1_PREFIX + '\n' + existing;
  return rendered;
}

function tier0Refuse() {
  return {
    shape: 'error',
    rendered: {
      error: 'tier-0-refused',
      detail: '/mos:setup brain or graph required for selectors',
    },
  };
}

/**
 * Phase 88.2-04: refuse Shape F.* presentation while the conversation operator
 * is JUST_TALK. JUST_TALK is the prose-only operator (Canon Part 3 + render-v2
 * step 6); a selector block would violate the compaction contract.
 */
function justTalkRefuse(requestedShape) {
  return {
    shape: 'error',
    rendered: {
      error: COMPACTION_VIOLATION_CODE,
      detail: 'Shape F selector refused: operator JUST_TALK suppresses all selector output (render-v2 step 6 / Canon Part 3).',
      operator: JUST_TALK,
      requested: requestedShape,
    },
  };
}

/**
 * Phase 88.2-04: emit selector presentation telemetry. Wrapped in try/catch --
 * telemetry NEVER fails Larry's turn. Canon Part 8: LOCAL ledger only, room
 * slug sha256-hashed, never crosses any network boundary.
 */
function emitPresentationTelemetry(roomDir, subShape, rendered, operator) {
  try {
    const tel = safeRequire('./selector-telemetry.cjs');
    if (!tel || typeof tel.recordPresentation !== 'function') return;
    const contract = (rendered && rendered.contract) ? rendered.contract : {};
    const verbs = Array.isArray(contract.verbs) ? contract.verbs : [];
    const mode = (typeof contract.mode === 'string') ? contract.mode : null;
    const recommendedPresent = (contract.recommended !== null && contract.recommended !== undefined);
    const record = {
      sub_shape: subShape,
      mode: mode,
      options_count: verbs.length,
      recommended_present: recommendedPresent,
    };
    if (typeof operator === 'string' && operator.length > 0) {
      record.operator = operator;
    }
    tel.recordPresentation(roomDir, record);
  } catch (_e) {
    // Graceful: never fail Larry's turn on a telemetry I/O hiccup.
  }
}

/**
 * Phase 88.2-04: append the AskUserQuestion structural-marker trailer to a
 * Shape F.* rendered envelope. Two surfaces:
 *   1. rendered.askuserquestion_marker -- scalar string for introspection.
 *   2. rendered.zones.footer -- the trailer is appended (preceded by a
 *      blank line if the footer is non-empty) so any composeZones() consumer
 *      sees it in the rendered surface.
 *
 * Trailer format (per 88.2-04 success criteria):
 *   [AskUserQuestion contract: shape=F.X verbs=N]
 */
function appendAskUserQuestionTrailer(rendered, subShape) {
  if (!rendered) return rendered;
  const contract = rendered.contract || {};
  const verbs = Array.isArray(contract.verbs) ? contract.verbs : [];
  const shapeStr = (typeof contract.shape === 'string' && contract.shape.length > 0)
    ? contract.shape : subShape;
  const trailer = '[AskUserQuestion contract: shape=' + shapeStr + ' verbs=' + verbs.length + ']';

  // Scalar surface (testable by introspection without parsing zones).
  rendered.askuserquestion_marker = trailer;

  // Zones surface: append to footer with a separating blank line.
  if (!rendered.zones || typeof rendered.zones !== 'object') return rendered;
  const existing = rendered.zones.footer;
  if (existing === null || existing === undefined || existing === '') {
    rendered.zones.footer = trailer;
  } else {
    rendered.zones.footer = String(existing) + '\n\n' + trailer;
  }
  return rendered;
}

function dispatchShapeF(args) {
  const { roomDir, tier, mode, payload } = args;
  const payloadObj = (payload && typeof payload === 'object') ? payload : {};
  const recommendedVerb = (mode === 'A' && typeof payloadObj.recommendedVerb === 'string')
    ? payloadObj.recommendedVerb : null;

  // Read JTBD state -- F.6 path requires non-null jtbd.
  const jtbdState = safeRequire('./jtbd-state.cjs');
  let jtbdId = null;
  if (jtbdState && typeof jtbdState.getCurrent === 'function' && typeof roomDir === 'string') {
    try {
      const current = jtbdState.getCurrent(roomDir);
      jtbdId = (current && typeof current.jtbd === 'string') ? current.jtbd : null;
    } catch (e) {
      jtbdId = null;
    }
  }

  if (jtbdId !== null) {
    const f6 = safeRequire('./shape-f6-renderer.cjs');
    if (f6 && typeof f6.renderShapeF6 === 'function') {
      const result = f6.renderShapeF6({ jtbd: jtbdId, tier, recommendedVerb });
      if (result && !result.error && !result.fallthrough) {
        return { shape: 'F.6', rendered: ensureFreeTextLast(result) };
      }
      // fall through to F.1 path on degenerate / unknown JTBD
    }
  }

  // F.1 path -- prefer Phase 88.2 module if shipped, else fall back to Phase 101's inline canonical-10.
  const f1 = safeRequire('./shape-f1-renderer.cjs') || safeRequire('./shape-f1-fallback.cjs');
  if (f1 && typeof f1.renderShapeF1 === 'function') {
    const result = f1.renderShapeF1({ tier, recommendedVerb });
    return { shape: 'F.1', rendered: ensureFreeTextLast(result) };
  }

  // Neither F.1 nor F.6 module available -- return error.
  return {
    shape: 'error',
    rendered: { error: 'no-f-renderer', detail: 'shape-f1 and shape-f6 modules both missing' },
  };
}

/**
 * Phase 88.2-04: direct sub-shape dispatch for F.1..F.5. Each renderer is the
 * Wave-1 module shipped in 88.2-01..03 (open-vocab F.1/F.2/F.5 + closed-vocab
 * F.3/F.4). Mode B Zone-1 prefix and AskUserQuestion trailer are applied at
 * the dispatcher entry point (pickShape) so this helper returns a canonical
 * { shape, rendered } envelope without those concerns.
 */
function dispatchShapeFSubShape(requestedShape, args) {
  const { tier, mode, payload } = args;
  const payloadObj = (payload && typeof payload === 'object') ? payload : {};
  const recommendedVerb = (mode === 'A' && typeof payloadObj.recommendedVerb === 'string')
    ? payloadObj.recommendedVerb : null;
  const callerVerbs = Array.isArray(payloadObj.verbs) ? payloadObj.verbs : undefined;
  const callerHeader = (typeof payloadObj.header === 'string' && payloadObj.header.length > 0)
    ? payloadObj.header : undefined;

  let mod = null;
  let fnName = null;
  let inputArgs = null;
  if (requestedShape === 'F.0') {
    // Phase 88.2-05: F.0 Mini Decision Gate. Closed-vocab (freeTextOffered:false);
    // dispatcher passes only header + body + parent_decision_id pass-through. The
    // renderer ignores any caller-supplied verbs[] or recommendedVerb (closed-vocab
    // is non-negotiable per CONTEXT.md spec body 2026-04-29).
    mod = safeRequire('./shape-f0-renderer.cjs');
    fnName = 'renderShapeF0';
    inputArgs = {
      tier: tier,
      header: callerHeader,
      body: (typeof payloadObj.body === 'string' && payloadObj.body.length > 0) ? payloadObj.body : undefined,
      parent_decision_id: (typeof payloadObj.parent_decision_id === 'string' && payloadObj.parent_decision_id.length > 0)
        ? payloadObj.parent_decision_id : undefined,
    };
  } else if (requestedShape === 'F.1') {
    mod = safeRequire('./shape-f1-renderer.cjs') || safeRequire('./shape-f1-fallback.cjs');
    fnName = 'renderShapeF1';
    inputArgs = { tier: tier, recommendedVerb: recommendedVerb, verbs: callerVerbs, header: callerHeader };
  } else if (requestedShape === 'F.2') {
    mod = safeRequire('./shape-f2-renderer.cjs');
    fnName = 'renderShapeF2';
    inputArgs = { tier: tier, recommendedVerb: recommendedVerb, verbs: callerVerbs, header: callerHeader };
  } else if (requestedShape === 'F.3') {
    mod = safeRequire('./shape-f3-renderer.cjs');
    fnName = 'renderShapeF3';
    inputArgs = { header: callerHeader };
  } else if (requestedShape === 'F.4') {
    mod = safeRequire('./shape-f4-renderer.cjs');
    fnName = 'renderShapeF4';
    inputArgs = { header: callerHeader };
  } else if (requestedShape === 'F.5') {
    mod = safeRequire('./shape-f5-renderer.cjs');
    fnName = 'renderShapeF5';
    inputArgs = { tier: tier, recommendedVerb: recommendedVerb, verbs: callerVerbs, header: callerHeader };
  } else if (requestedShape === 'F.6') {
    // Phase 88.2-06: F.6 Plan Review Round. Closed-vocab parent shape (3 verbs
    // Confirm / Reject / Discuss, freeTextOffered:false; reject reason is captured
    // via a downstream prompt and lands as a property on the REVIEWED edge).
    // Routes to the collision-safe path lib/hmi/shape-f6-plan-review-renderer.cjs;
    // the umbrella 'F' branch above continues to route to Phase 101-01's
    // lib/hmi/shape-f6-renderer.cjs via JTBD logic (R1 invariant preserved).
    mod = safeRequire('./shape-f6-plan-review-renderer.cjs');
    fnName = 'renderShapeF6PlanReview';
    inputArgs = {
      tier: tier,
      header: callerHeader,
      position: (Number.isInteger(payloadObj.position) ? payloadObj.position : undefined),
      totalQuestions: (Number.isInteger(payloadObj.totalQuestions) ? payloadObj.totalQuestions : undefined),
      claim: (typeof payloadObj.claim === 'string' && payloadObj.claim.length > 0)
        ? payloadObj.claim : undefined,
      counts: (payloadObj.counts && typeof payloadObj.counts === 'object') ? payloadObj.counts : undefined,
      round_id: (typeof payloadObj.round_id === 'string' && payloadObj.round_id.length > 0)
        ? payloadObj.round_id : undefined,
      personaContext: (typeof payloadObj.personaContext === 'string' && payloadObj.personaContext.length > 0)
        ? payloadObj.personaContext : undefined,
    };
  }

  if (!mod || typeof mod[fnName] !== 'function') {
    return {
      shape: 'error',
      rendered: {
        error: 'no-subshape-renderer',
        detail: requestedShape + ' renderer module missing',
      },
    };
  }

  let result;
  try {
    result = mod[fnName](inputArgs);
  } catch (e) {
    return {
      shape: 'error',
      rendered: {
        error: 'subshape-render-failed',
        detail: requestedShape + ': ' + (e && e.message ? String(e.message).slice(0, 80) : 'unknown'),
      },
    };
  }

  if (!result || result.error) {
    return {
      shape: 'error',
      rendered: result || { error: 'subshape-empty', detail: requestedShape },
    };
  }

  return { shape: requestedShape, rendered: ensureFreeTextLast(result) };
}

function dispatchShapeG(args) {
  const { tier, mode, payload } = args;
  const g = safeRequire('./shape-g-renderer.cjs');
  if (!g || typeof g.renderShapeG !== 'function') {
    return { shape: 'error', rendered: { error: 'no-g-renderer' } };
  }
  const inputPayload = Object.assign({}, (payload && typeof payload === 'object') ? payload : {}, {
    tier: tier,
    mode: mode,
  });
  const result = g.renderShapeG(inputPayload);
  if (result && result.fallthrough === true) {
    return { shape: 'E', passthrough: true, fallthroughFrom: 'G', rendered: result };
  }
  return { shape: 'G', rendered: result };
}

function dispatchShapeH(args) {
  const { tier, mode, payload } = args;
  const h = safeRequire('./shape-h-renderer.cjs');
  if (!h || typeof h.renderShapeH !== 'function') {
    return { shape: 'error', rendered: { error: 'no-h-renderer' } };
  }
  const inputPayload = Object.assign({}, (payload && typeof payload === 'object') ? payload : {}, {
    tier: tier,
    mode: mode,
  });
  const result = h.renderShapeH(inputPayload);
  if (result && result.error) {
    return { shape: 'error', rendered: result };
  }
  return { shape: 'H', rendered: result };
}

/**
 * Single entry point.
 */
function pickShape(args) {
  try {
    const opts = (args && typeof args === 'object') ? args : {};
    const requestedShape = typeof opts.requestedShape === 'string' ? opts.requestedShape : '';
    const operator = (typeof opts.operator === 'string' && opts.operator.length > 0) ? opts.operator : null;
    const tier = resolveTier(opts.tier);
    const mode = modeFromTier(tier);

    // Tier 0 refuse path (Canon Part 3 Rule 2). Applies BEFORE operator gates
    // because tier 0 cannot host any selector regardless of operator.
    if (tier === 0) {
      return tier0Refuse();
    }

    // Phase 88.2-04: JUST_TALK operator refuses ALL Shape F.* surfaces. This
    // mirrors render-v2 step 6 (lib/render/render-v2.cjs#244) which suppresses
    // entire output when operator === JUST_TALK. The dispatcher refuses earlier
    // (before invoking renderers) to avoid wasted CPU on a payload that will be
    // dropped downstream.
    const isShapeF = (requestedShape === F_UMBRELLA || F_SUBSHAPES.indexOf(requestedShape) !== -1);
    if (isShapeF && operator === JUST_TALK) {
      return justTalkRefuse(requestedShape);
    }

    let result;
    if (requestedShape === F_UMBRELLA) {
      result = dispatchShapeF({ roomDir: opts.roomDir, tier, mode, payload: opts.payload });
    } else if (F_SUBSHAPES.indexOf(requestedShape) !== -1) {
      result = dispatchShapeFSubShape(requestedShape, { tier, mode, payload: opts.payload });
    } else if (requestedShape === 'G') {
      result = dispatchShapeG({ tier, mode, payload: opts.payload });
    } else if (requestedShape === 'H') {
      result = dispatchShapeH({ tier, mode, payload: opts.payload });
    } else if (
      requestedShape === 'A' || requestedShape === 'B' ||
      requestedShape === 'C' || requestedShape === 'D' ||
      requestedShape === 'E'
    ) {
      return { shape: requestedShape, passthrough: true };
    } else {
      return {
        shape: 'error',
        rendered: { error: 'unknown-shape', detail: 'requestedShape: ' + JSON.stringify(requestedShape) },
      };
    }

    // Mode B Zone 1 prefix (defense-in-depth at dispatcher).
    if (mode === 'B' && result && result.rendered && result.shape !== 'error') {
      applyModeBPrefix(result.rendered);
    }

    // Phase 88.2-04: AskUserQuestion structural-marker trailer + telemetry.
    // Both apply ONLY to successful Shape F.* presentations (umbrella resolves
    // to F.1/F.6; sub-shapes resolve to themselves). Error paths and G/H/A-E
    // are NOT touched -- they preserve the existing 9-test contract byte-for-byte.
    //
    // Telemetry is opt-in via `payload.emitTelemetry === true`. This protects
    // Canon Part 8 fs_scope (lib/render/render-v2.cjs invokes the dispatcher
    // for Zone 4 enrichment -- that call is NOT a presentation event and must
    // produce zero FS side-effects). The actual presentation surface (where a
    // human navigator answers an AskUserQuestion prompt) sets the flag to true.
    // The trailer is unconditionally attached: it is part of the rendered
    // surface, not a side-effect.
    if (result && result.shape !== 'error' && !result.passthrough) {
      const isFShape = (typeof result.shape === 'string' && result.shape.indexOf('F') === 0);
      if (isFShape) {
        appendAskUserQuestionTrailer(result.rendered, result.shape);
        const payloadObj = (opts.payload && typeof opts.payload === 'object') ? opts.payload : {};
        if (payloadObj.emitTelemetry === true) {
          emitPresentationTelemetry(opts.roomDir, result.shape, result.rendered, operator);
        }
      }
    }

    return result;
  } catch (e) {
    return {
      shape: 'error',
      rendered: {
        error: 'dispatch-failed',
        detail: (e && e.message ? String(e.message).slice(0, 80) : 'unknown'),
      },
    };
  }
}

/**
 * Phase 88.2-04: re-export of selector-telemetry.recordResponse so consumers
 * wiring AskUserQuestion answers back to the local ledger have a single
 * dispatcher-level entry point. Wrapped in try/catch -- never fails Larry's turn.
 */
function recordSelectorResponse(roomDir, record) {
  try {
    const tel = safeRequire('./selector-telemetry.cjs');
    if (!tel || typeof tel.recordResponse !== 'function') return;
    tel.recordResponse(roomDir, record);
  } catch (_e) {
    // Graceful.
  }
}

module.exports = {
  pickShape: pickShape,
  recordSelectorResponse: recordSelectorResponse,
  _internal: {
    resolveTier: resolveTier,
    modeFromTier: modeFromTier,
    ensureFreeTextLast: ensureFreeTextLast,
    applyModeBPrefix: applyModeBPrefix,
    appendAskUserQuestionTrailer: appendAskUserQuestionTrailer,
    emitPresentationTelemetry: emitPresentationTelemetry,
    justTalkRefuse: justTalkRefuse,
    MODE_B_ZONE1_PREFIX: MODE_B_ZONE1_PREFIX,
    F_SUBSHAPES: F_SUBSHAPES.slice(),
    JUST_TALK: JUST_TALK,
    COMPACTION_VIOLATION_CODE: COMPACTION_VIOLATION_CODE,
  },
};
