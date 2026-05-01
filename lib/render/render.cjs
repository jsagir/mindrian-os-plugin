#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 102-01 -- v1 renderer shim (legacy 4-arg positional signature).
 *
 * Per Phase 102 CONTEXT.md D-10, this module ships in the same wave as
 * lib/render/render-v2.cjs and exposes the legacy 4-arg signature so
 * any caller that has not yet migrated to the v2 destructured API keeps
 * working unchanged. Phase 104 migrates each call site explicitly;
 * Phase 105 polling flags any unmigrated call site as a compliance gap.
 *
 *   render(zones, mode, operator, tier) -> string
 *
 * The shim:
 *   - Forwards to render-v2's destructured API.
 *   - Fills jtbd=null, tokenBudget={used:0,total:1}, roomDir from env or
 *     process.cwd(), provenance=null per CONTEXT D-10.
 *   - Returns just the `rendered` string (legacy callers expect a string,
 *     not the {rendered, contract} envelope).
 *
 * Constraints (Phase 87 invariant):
 *   - Zero new runtime dependencies.
 *   - CJS only.
 *   - The shim has zero rendering logic of its own; all muscle lives in
 *     render-v2. If render-v2's behavior changes, the shim adapts for
 *     free.
 *
 * Canon parts:
 *   7 (Reuse Before Build) -- one renderer module, two entry points;
 *     no parallel formatter implementations.
 *   8 (Graph Boundary)     -- inherits Canon Part 8 compliance from
 *     render-v2 by construction (no Brain calls anywhere in the chain).
 */

const v2 = require('./render-v2.cjs');

/**
 * Legacy 4-arg renderer entry point.
 *
 * @param {object|null|undefined} zones    - 4-zone payload
 *                                           ({ header, body, signals?, footer? }).
 * @param {string|null|undefined} mode     - 'A' | 'B' | 'tier-0'.
 * @param {string|null|undefined} operator - one of OPERATORS or null.
 * @param {number|string|null|undefined} tier - 0|1|2|3.
 * @returns {string} Composed 4-zone string ('' when operator suppresses).
 */
function render(zones, mode, operator, tier) {
  const result = v2.render({
    zones: zones,
    mode: mode,
    operator: operator,
    tier: tier,
    jtbd: null,
    tokenBudget: { used: 0, total: 1 },
    roomDir: process.env.MINDRIAN_ROOM_DIR || process.cwd(),
    provenance: null,
  });
  // v1 callers expect a string, not the {rendered, contract} envelope.
  return result.rendered;
}

module.exports = { render, OPERATORS: v2.OPERATORS };
