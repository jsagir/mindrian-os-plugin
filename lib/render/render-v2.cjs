#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 99-03 -- renderer integration contract.
 *
 * Contract surface that Phase 102 will own. Today this is a no-op
 * pass-through stub so Phase 99-04 (hooks) and Phase 99-05
 * (/mos:operator command) can call into the contract without waiting
 * for Phase 102 to ship the actual rendering logic.
 *
 * Per Phase 99 CONTEXT.md D-16, the contract surface is:
 *   render(zones, mode, operator, tier) -> envelope
 *
 * Phase 102 logic (NOT shipped here):
 *   operator == JUST_TALK        -> emit prose only
 *   operator == EXPLORE_CAPTURE  -> prose; Shape E only on crystallization
 *   operator == BUILD_ROOM       -> full 4-zone anatomy
 *   operator == METHODOLOGY      -> no shape mid-session; Shape E at gate
 *   operator == DECISION_GATE    -> Shape F.x; keyboard only
 *
 * Phase 102 will replace the internals of `render` without changing the
 * import surface. Any caller that imports `{ render }` today continues
 * to work after Phase 102 lands.
 *
 * Canon parts:
 *   3 (Tri-Context Decision Gate) -- DECISION_GATE locks Shape F.x at
 *     render time; Phase 102 enforces this output-side.
 *   4 (Every Choice Is Graph Data) -- operator transitions written by
 *     Phase 99-01 are read by this renderer to pick shape (Phase 102).
 *   7 (Reuse Before Build) -- ship the seam, not the muscle. Phase 99-03
 *     ships the import surface; Phase 102 owns the rendering muscle.
 *
 * Phase 99-03 stub envelope:
 *   { zones, mode, operator, tier, rendered: false, _stub: 'phase-99-03' }
 *
 *   `rendered: false` is the Phase 102 sentinel (Phase 102 will return
 *   `rendered: true`). `_stub: 'phase-99-03'` is the provenance tag so a
 *   caller can detect pre-renderer state.
 *
 * Constraints:
 *   - Zero new runtime dependencies (Phase 87 invariant).
 *   - CJS only (Phase 87 invariant).
 *   - Import surface byte-stable across Phase 102 swap.
 */

/**
 * The 5 canonical operators (Phase 99 CONTEXT.md D-03, frozen).
 * Any 6th operator requires a Gate 1 review per D-03.
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
 * Render the 4-zone payload through the conversation operator state machine.
 *
 * Phase 99-03 (this stub): pass-through; Phase 102 owns rendering.
 *
 * @param {object|null|undefined} zones    - 4-zone payload (Phase 102 owns shape).
 * @param {string|null|undefined} mode     - 'cli' | 'desktop' | 'cowork'. Phase 102 validates.
 * @param {string|null|undefined} operator - one of OPERATORS; defaults to 'JUST_TALK' when null/undefined.
 * @param {string|null|undefined} tier     - 'tier-0' | 'mode-a' | 'mode-b'. Phase 102 validates.
 * @returns {{ zones: any, mode: any, operator: string, tier: any, rendered: false, _stub: 'phase-99-03' }}
 * @throws {Error} when operator is a non-null value outside OPERATORS.
 */
function render(zones, mode, operator, tier) {
  const op = operator == null ? 'JUST_TALK' : operator;
  if (!OPERATORS.includes(op)) {
    throw new Error(
      'Phase 99-03 render: invalid operator "' + op + '". ' +
        'Canonical values: ' + OPERATORS.join(', ') + '.'
    );
  }
  return {
    zones: zones,
    mode: mode,
    operator: op,
    tier: tier,
    rendered: false,
    _stub: 'phase-99-03',
  };
}

module.exports = { render, OPERATORS };
