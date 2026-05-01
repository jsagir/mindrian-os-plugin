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
 * @returns {{ rendered: string, contract: object }} The envelope also
 *   carries a non-enumerable `_provenance` field per RENDER-102-04
 *   (LOCAL-only audit envelope, Canon Part 8 compliant by construction).
 *   Read via `env._provenance` -- not visible to `Object.keys`,
 *   `JSON.stringify`, or `for..in` so the Phase 99-03 byte-stability
 *   fence in render-v2.test.cjs scenario 5 stays green (RENDER-102-06).
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

  // 1. Compaction decision (filled by 102-02)
  //    const compact = (tokenBudget.used / tokenBudget.total) > 0.80;

  // 2. JTBD-aware Zone 4 (filled by 102-03)
  //    if (zones.footer === undefined && jtbd) {
  //      zones.footer = require('../hmi/selector-dispatcher').pickShape({
  //        requestedShape: 'F',
  //        roomDir, operator, tier,
  //        payload: {}
  //      });
  //    }

  // 3. Zone 1 left-rail accent (filled by 102-05)
  //    if (jtbd && !compact) {
  //      zones.header = colorize(JTBD_COLOR_MAP[jtbd]) + '■ ' + zones.header;
  //    }

  // 4. Provenance enrichment (filled by 102-04)
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
  //    surfaced.
  const _provenance = Object.freeze({
    renderer: 'render-v2',
    version: '102',
    operator: operator,
    tier: tier,
    mode: mode,
    jtbd: jtbd,
  });

  // 5. Compact mode application (filled by 102-02)
  //    if (compact) zones = applyCompaction(zones);

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
  // 102-02..05 wire them up. They are already pulled out above so callers
  // can rely on the destructuring contract. (102-04 consumed: mode, tier,
  // jtbd via _provenance; 102-02/03/05 still own tokenBudget, roomDir, and
  // the upstream provenance arg.)
  void tokenBudget; void roomDir; void provenance;

  return attachProvenance({ rendered: composed, contract: {} }, _provenance);
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

module.exports = { render, OPERATORS, composeZones };
