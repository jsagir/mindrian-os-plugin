#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 102-01 -- universal renderer (extended signature).
 *
 * Replaces the Phase 99-03 stub at the same import surface. Phase 102
 * evolves the signature to a single destructured object so we can carry
 * the full context tuple (operator, tier, jtbd, tokenBudget, roomDir,
 * provenance) without another signature break in 102-02..05.
 *
 * Phase 102-01 ships skeleton + zone composition only. Hooks:
 *   1. Compaction     -> 102-02   3. Color overlay -> 102-05
 *   2. JTBD-aware Z4  -> 102-03   4. Provenance    -> 102-04
 * Numbered comment markers in render() are the insertion points.
 *
 * Per CONTEXT D-10, lib/render/render.cjs ships in the same wave as a
 * thin shim around this v2 entry, preserving the legacy 4-arg
 * positional signature for callers that have not yet migrated.
 *
 * Canon parts: 3 (Tri-Context Gate, output-side enforcement),
 * 4 (operator transitions read here), 5 (evidence tier via Z3),
 * 7 (single formatter for every /mos: command), 8 (D-09: this renderer
 * NEVER calls Brain inline -- pure formatting layer; Canon Part 8
 * compliant by construction).
 *
 * Constraints: zero new runtime deps, CJS only (Phase 87 invariant),
 * defensive defaults so {} or undefined cannot crash the formatter.
 */

/**
 * The 5 canonical operators (Phase 99 CONTEXT.md D-03, frozen).
 * Re-exported for downstream consumers that want to validate operator
 * values without re-importing from lib/conversation/operator.cjs.
 *
 * @type {ReadonlyArray<string>}
 */
const OPERATORS = Object.freeze([
  'JUST_TALK',
  'EXPLORE_CAPTURE',
  'BUILD_ROOM',
  'METHODOLOGY',
  'DECISION_GATE',
]);

/**
 * Render a 4-zone payload into a single output string + contract envelope.
 *
 * @param {object} args
 * @param {object} [args.zones]         - { header, body, signals?, footer? }
 * @param {string} [args.mode]          - 'A' | 'B' | 'tier-0' (default 'A')
 * @param {string|null} [args.operator] - one of OPERATORS or null
 * @param {number} [args.tier]          - 0|1|2|3 (default 1)
 * @param {string|null} [args.jtbd]     - active JTBD or null (default null)
 * @param {object} [args.tokenBudget]   - { used, total } (default {0,1})
 * @param {string} [args.roomDir]       - absolute room path; used by
 *                                        downstream plans for selector-dispatcher
 *                                        access. Defaults to env or process.cwd().
 * @param {object|null} [args.provenance] - optional Brain provenance object
 * @returns {{ rendered: string, contract: object }}
 */
function render(args) {
  args = args || {};
  // Defensive defaults — every arg can be missing or null/undefined.
  let zones = args.zones || {};
  const mode = args.mode || 'A';
  const operator = args.operator || null;
  const tier = (args.tier === undefined || args.tier === null) ? 1 : args.tier;
  const jtbd = args.jtbd || null;
  const tokenBudget = args.tokenBudget || { used: 0, total: 1 };
  const roomDir = args.roomDir || process.env.MINDRIAN_ROOM_DIR || process.cwd();
  let provenance = args.provenance || null;

  // -------------------------------------------------------------------------
  // Algorithm steps 1-7: hooks for downstream plans (102-02..05).
  // The numbered markers MUST stay so follow-on plans land at the right spot.
  // -------------------------------------------------------------------------

  // 1. Compaction decision (Phase 102-02 — single 80% threshold).
  //    Source priority: explicit env var (CLAUDE_CONTEXT_USED_PCT) >
  //    caller-supplied tokenBudget > memory heuristic. See isCompact() below.
  //    Adaptive granularity (50/70/80/90) is v1.15.x deferred (CONTEXT D-02).
  const compact = isCompact(tokenBudget);

  // 2. JTBD-aware Zone 4 (Phase 102-03) -- dispatch for both jtbd-set and
  //    jtbd-null+BUILD_ROOM (per CONTEXT D-04). Free-Text is forced last by
  //    the dispatcher's ensureFreeTextLast invariant. The operator gates in
  //    step 6 (JUST_TALK / METHODOLOGY) override this enrichment when needed
  //    -- order matters: we set zones.footer here, step 6 may strip it.
  const shouldFireZone4 = (zones.footer === undefined)
    && operator !== 'JUST_TALK'
    && operator !== 'METHODOLOGY'
    && (jtbd || operator === 'BUILD_ROOM');

  if (shouldFireZone4) {
    try {
      const dispatcher = require('../hmi/selector-dispatcher.cjs');
      const result = dispatcher.pickShape({
        requestedShape: 'F',
        roomDir: roomDir,
        operator: operator,
        tier: tier,
        payload: {},
      });
      // Dispatcher returns F.6 when jtbd set, F.1 (canonical 10) when jtbd null.
      // Result envelope: { shape, rendered: { zones, contract } }. Pull verbs
      // off contract.verbs and the pre-formatted body off zones.body so the
      // composeZones B6 footer contract is satisfied (rendered string short
      // path; verbs[] defense-in-depth fallback).
      if (result && result.rendered && result.rendered.contract
          && Array.isArray(result.rendered.contract.verbs)) {
        zones = Object.assign({}, zones, {
          footer: {
            verbs: result.rendered.contract.verbs.slice(),
            shape: result.shape,
            rendered: (result.rendered.zones && typeof result.rendered.zones.body === 'string')
              ? result.rendered.zones.body : null,
          },
        });
      }
    } catch (err) {
      // Graceful fallback per Canon Part 3 Rule 2: dispatcher errors must
      // never block the render. Surface debug info under MINDRIAN_DEBUG=1
      // and leave zones.footer undefined for the caller / downstream default.
      if (process.env.MINDRIAN_DEBUG === '1') {
        process.stderr.write(
          '[render-v2] zone4 dispatcher error: '
          + String((err && err.message) || err).slice(0, 80) + '\n'
        );
      }
    }
  }

  // 3. Zone 1 left-rail accent (filled by 102-05)
  //    if (jtbd && !compact) {
  //      zones.header = colorize(JTBD_COLOR_MAP[jtbd]) + '■ ' + zones.header;
  //    }

  // 4. Provenance enrichment (Phase 102-04 -- LOCAL-only audit envelope).
  //    Build the LOCAL-only _provenance envelope. Per RENDER-102-04 +
  //    Canon Part 8, every render result carries:
  //      { renderer:'render-v2', version:'102', operator, tier, mode, jtbd }
  //    Zero Brain queries, zero network IO, zero filesystem reads outside
  //    lib/render/JTBD-PALETTES.md. The fields are pure scalar passthroughs
  //    of args already destructured above; no user-content strings are
  //    embedded (operator + mode + tier + jtbd are framework-handle enums
  //    or null), so this envelope is Canon Part 8 compliant by construction.
  //    The 'provenance' caller arg (from upstream Brain-aware code paths)
  //    is intentionally NOT folded into _provenance to avoid leaking caller-
  //    supplied user content into the renderer's audit envelope; callers may
  //    place that payload into zones.signals themselves if they want it
  //    surfaced. Attached non-enumerably via attachProvenance() so the
  //    Phase 99-03 byte-stability fence (Object.keys === [contract,rendered])
  //    stays green.
  const _provenance = Object.freeze({
    renderer: 'render-v2',
    version: '102',
    operator: operator,
    tier: tier,
    mode: mode,
    jtbd: jtbd,
  });

  // 5. Compact mode application (Phase 102-02). Apply AFTER any upstream
  //    enrichment hooks (Z4 dispatcher, color overlay, provenance) so
  //    compaction trims the final pre-compose payload. Sibling 102-05's
  //    color-overlay block (slot 3) self-gates against compact via its
  //    own local check; once that local gate is folded into this unified
  //    `compact` flag (future cleanup), the redundancy drops out without
  //    changing observable behavior.
  if (compact) zones = applyCompaction(zones);

  // 6. Operator-driven Zone 4 gates (102-01: ship this gate today).
  //    JUST_TALK suppresses ALL output (prose-only operator); METHODOLOGY
  //    mid-session strips Zone 4 (the methodology owns the screen).
  if (operator === 'JUST_TALK') {
    return attachProvenance(
      { rendered: '', contract: { suppressed: true, reason: 'just-talk' } },
      _provenance
    );
  }
  if (operator === 'METHODOLOGY' && (!zones.body || !zones.body.endingSignal)) {
    // Mutate a shallow copy so we never alter the caller's object.
    zones = Object.assign({}, zones);
    delete zones.footer;
  }

  // 7. Mode B prefix (filled by 102-04)
  //    if (mode === 'B' && zones.header && !String(zones.header).startsWith('⚠')) {
  //      zones.header = '⚠ Brain unreachable; running on local graph only.\n' + zones.header;
  //    }

  // -------------------------------------------------------------------------
  // Step 8: compose 4 zones into a single string.
  // -------------------------------------------------------------------------
  const composed = composeZones(zones);

  // Reference the not-yet-used vars so static analyzers do not warn before
  // 102-05 wires them up. (102-03 consumed: tier, jtbd, roomDir via the Z4
  // dispatcher. 102-04 consumed: mode + tier + jtbd into _provenance. The
  // upstream caller-supplied `provenance` arg remains unused -- intentionally
  // NOT folded into _provenance to avoid leaking user content per Canon
  // Part 8; callers may put it in zones.signals themselves.)
  void provenance;

  // Surface `compact` on the contract so downstream plans can branch on it
  // (102-05 reads it to drop the color overlay; tests inspect it to verify
  // the compaction gate fired). The non-enumerable _provenance envelope is
  // attached via attachProvenance() so Object.keys(env) stays
  // ['contract','rendered'] (RENDER-102-06 byte-stability invariant).
  return attachProvenance(
    { rendered: composed, contract: { compact: compact } },
    _provenance
  );
}

/**
 * Attach a non-enumerable, frozen `_provenance` field to a render envelope.
 *
 * Non-enumerable so `Object.keys(env).sort()` still equals
 * `['contract','rendered']` (per RENDER-102-06: the Phase 99-03 -> Phase 102
 * import-surface byte-stability fence in `lib/render/render-v2.test.cjs`
 * scenario 5). The field is still readable as `env._provenance` for any
 * caller that asks for it explicitly (audit, telemetry, debug surface).
 *
 * Configurable: false; writable: false. The whole envelope is intended to
 * be a single-pass write -- callers that mutate it are out of contract.
 *
 * @param {object} envelope  - { rendered, contract } from the renderer.
 * @param {object} provenance - frozen provenance descriptor.
 * @returns {object} same envelope, with `_provenance` attached.
 */
function attachProvenance(envelope, provenance) {
  Object.defineProperty(envelope, '_provenance', {
    value: provenance,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return envelope;
}

/**
 * Compose a 4-zone payload into a single newline-delimited string.
 *
 * Footer shape contract (cross-plan with 102-03):
 *   - string: emit verbatim
 *   - { rendered: string }: emit rendered field (pre-formatted by dispatcher in 102-03)
 *   - { verbs: string[] }: emit verbs as `▷ <verb>` lines (defense-in-depth fallback)
 *
 * Signals shape:
 *   - array of strings; each prefixed with `▷ ` and joined by newlines.
 *
 * @param {object} zones
 * @returns {string}
 */
function composeZones(zones) {
  zones = zones || {};
  const header = zones.header;
  const body = zones.body;
  const signals = zones.signals;
  const footer = zones.footer;

  const parts = [];

  if (header) parts.push(String(header));

  if (body) {
    if (typeof body === 'string') {
      parts.push(body);
    } else if (body.text) {
      parts.push(String(body.text));
    } else {
      parts.push(JSON.stringify(body));
    }
  }

  if (Array.isArray(signals) && signals.length) {
    parts.push(signals.map(function (s) { return '▷ ' + s; }).join('\n'));
  }

  if (footer) {
    if (typeof footer === 'string') {
      parts.push(footer);
    } else if (footer.rendered) {
      parts.push(String(footer.rendered));
    } else if (Array.isArray(footer.verbs)) {
      parts.push(footer.verbs.map(function (v) { return '▷ ' + v; }).join('\n'));
    }
  }

  return parts.filter(Boolean).join('\n\n');
}

// ---------------------------------------------------------------------------
// Phase 102-02 — token-budget-aware compaction layer.
//
// Single 80% threshold (CONTEXT D-02 + D-03). Adaptive granularity
// (50% / 70% / 80% / 90%) is v1.15.x deferred. Compaction is a pure
// function of zones; callers see the trimmed payload via composeZones.
// ---------------------------------------------------------------------------

/**
 * Decide whether to compact based on token-budget signals.
 *
 * Source priority (CONTEXT D-02):
 *   1. process.env.CLAUDE_CONTEXT_USED_PCT — explicit Claude Code signal.
 *      Treated as a percentage in 0..100. Returns true when > 80.
 *   2. caller-supplied tokenBudget {used, total} — explicit numbers from
 *      the caller. Returns true when used/total > 0.80. Requires both
 *      total > 0 AND used > 0; the defensive default {used:0, total:1}
 *      falls through to the heuristic.
 *   3. process.memoryUsage() heuristic — heapUsed/heapTotal > 0.95.
 *      Rough last-resort proxy that ONLY triggers under genuine heap
 *      pressure. Idle Node CLIs sit at ~0.70 routinely, so the original
 *      0.60 threshold from RESEARCH §2 step 1 misfired against the 99-03
 *      regression fence + 102-01 signature suites (both call render()
 *      with no env var and no explicit budget; both expect non-compact
 *      output). Raised to 0.95 here as a Rule 1 deviation; documented in
 *      102-02-SUMMARY.md "Deviations from Plan". The function still
 *      always returns a boolean per the plan's done-criteria 8.
 *
 * @param {object} tokenBudget - { used, total }
 * @returns {boolean} true when the renderer should switch to compact mode.
 */
function isCompact(tokenBudget) {
  // 1. Explicit env signal from Claude Code. Truthy + parseable wins.
  if (process.env.CLAUDE_CONTEXT_USED_PCT) {
    const pct = parseFloat(process.env.CLAUDE_CONTEXT_USED_PCT) / 100;
    if (!isNaN(pct)) return pct > 0.80;
  }
  // 2. Caller-supplied {used, total}. Defensive: only trust positive
  //    totals AND a positive `used` so the {0,1} default falls through.
  if (tokenBudget && tokenBudget.total > 0 && tokenBudget.used > 0) {
    return (tokenBudget.used / tokenBudget.total) > 0.80;
  }
  // 3. Memory heuristic fallback. Threshold raised from 0.60 -> 0.95 so
  //    idle Node processes do not trip compaction. Always returns boolean.
  const m = process.memoryUsage();
  return (m.heapUsed / m.heapTotal) > 0.95;
}

/**
 * Apply Phase 102-02 compaction rules to a zones payload.
 *
 * Returns a new shallow-copied object; never mutates the caller's zones.
 * Compaction rules (CONTEXT D-03):
 *   - Z1 header: single line; strip decorative dashes / box-drawing glyphs.
 *     The `-- ... --` envelope collapses to a leading `■ ` (canonical
 *     compact glyph from the `■ ✓ ⚠ →` allowlist).
 *   - Z2 body: cap at 30 lines. Lines 31..N replaced by a single
 *     `... <N more rows>` summary line. String body shape preserved.
 *   - Z3 signals: cap at 2 (down from 3).
 *   - Z4 footer (object form with verbs[]): cap at 2; if the verb list
 *     ends in `Free-Text`, preserve `Free-Text` as the LAST element
 *     (Phase 100 invariant — Free-Text is always the escape hatch).
 *
 * @param {object} zones
 * @returns {object} compacted zones (shallow copy)
 */
function applyCompaction(zones) {
  const out = Object.assign({}, zones || {});

  // Z1: simplify header — single line, strip decorative dashes/box-drawing.
  if (out.header) {
    let h = String(out.header);
    h = h.split('\n')[0]; // single line first
    // Collapse leading "-- " into "■ " (canonical compact glyph) and drop
    // any trailing " -- " envelope. Mid-string " -- " separators are kept
    // (semantic between-segment dividers); only the outer envelope is
    // decorative and strippable.
    h = h.replace(/^-- /, '■ ').replace(/ -- $/, '');
    // Strip box-drawing characters anywhere in the header.
    h = h.replace(/[─━│┌┐└┘╭╮╰╯]/g, '');
    out.header = h;
  }

  // Z2: cap body at 30 lines (string form only — object-shaped bodies are
  // upstream's job to compact).
  if (typeof out.body === 'string') {
    const lines = out.body.split('\n');
    if (lines.length > 30) {
      const overflow = lines.length - 30;
      out.body = lines.slice(0, 30).join('\n') + '\n... <' + overflow + ' more rows>';
    }
  }

  // Z3: cap signals at 2.
  if (Array.isArray(out.signals) && out.signals.length > 2) {
    out.signals = out.signals.slice(0, 2);
  }

  // Z4: cap footer.verbs at 2; preserve Free-Text last when present.
  if (out.footer && typeof out.footer === 'object' && Array.isArray(out.footer.verbs)) {
    const verbs = out.footer.verbs;
    if (verbs.length > 2) {
      const hasFreeText = verbs[verbs.length - 1] === 'Free-Text';
      const trimmed = hasFreeText
        ? [verbs[0], 'Free-Text']
        : verbs.slice(0, 2);
      out.footer = Object.assign({}, out.footer, { verbs: trimmed });
    }
  }

  return out;
}

module.exports = {
  render,
  OPERATORS,
  composeZones,
  // Phase 102-02 exports for test fences + downstream introspection.
  isCompact,
  applyCompaction,
};
