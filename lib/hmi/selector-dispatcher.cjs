/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 101-04 + 101-05 -- single integration point for Shape F/G/H rendering.
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
 * API:
 *   pickShape({ requestedShape, roomDir, operator, tier, payload })
 *     -> { shape, rendered } | { shape, passthrough: true }
 *
 *   - requestedShape:    'F' | 'G' | 'H' | 'A' | 'B' | 'C' | 'D' | 'E'
 *   - roomDir:           absolute path; used to read JTBD state for F-shape dispatch.
 *   - operator:          (reserved for Phase 99 operator-aware routing; currently unused.)
 *   - tier:              optional override; if omitted, dispatcher calls getTier().
 *   - payload:           shape-specific input forwarded to the corresponding renderer.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant).
 */

'use strict';

const FREE_TEXT = 'Free-Text';
const MODE_B_ZONE1_PREFIX = '⚠ Brain unreachable; running on local graph only.';

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
 */
function ensureFreeTextLast(rendered) {
  if (!rendered || !rendered.contract || !Array.isArray(rendered.contract.verbs)) return rendered;
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
    return { shape: 'E', rendered: result };
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
    const tier = resolveTier(opts.tier);
    const mode = modeFromTier(tier);

    // Tier 0 refuse path (Canon Part 3 Rule 2).
    if (tier === 0) {
      return tier0Refuse();
    }

    let result;
    if (requestedShape === 'F') {
      result = dispatchShapeF({ roomDir: opts.roomDir, tier, mode, payload: opts.payload });
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

module.exports = {
  pickShape: pickShape,
  _internal: {
    resolveTier: resolveTier,
    modeFromTier: modeFromTier,
    ensureFreeTextLast: ensureFreeTextLast,
    applyModeBPrefix: applyModeBPrefix,
    MODE_B_ZONE1_PREFIX: MODE_B_ZONE1_PREFIX,
  },
};
