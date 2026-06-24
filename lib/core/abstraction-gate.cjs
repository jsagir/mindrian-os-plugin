'use strict';
/*
 * Phase 179-05 -- the instances-vs-structures abstraction gate (SPEC Req 6;
 * CONTEXT decision 2). The riskiest net-new surface of the phase, built to be
 * the LEAST risky shape it can be: a 3-option Shape F single-select selector
 * that fires ALWAYS for every Door 3 hypothesis -- never conditional, never
 * behind an ambiguity classifier.
 *
 * Why always-fire (CONTEXT decision 2, Brain-grounded via brain_ask 2026-06-25):
 *   the instances-vs-structures distinction is a Systems-Thinking iceberg move
 *   (events -> patterns -> structure). The lift to STRUCTURE must be DELIBERATELY
 *   surfaced because navigators default to instances and are blind to structure.
 *   An ambiguity-detector would trust a heuristic to catch the exact blindspot
 *   the navigator already has. Always-fire ALSO designs out the net-new
 *   classifier risk on the phase's riskiest surface. The 3rd option ('unsure')
 *   absorbs the genuinely-undecided navigator.
 *
 * Two exports:
 *   buildAbstractionSelector(opts?) -- a PURE function returning the 3-option
 *     Shape F single-select spec (INSTANCES / STRUCTURE / unsure) + header +
 *     question + the arrow-key keyboard contract. The helper is UNCONDITIONAL:
 *     it carries no skip predicate and no classifier branch, so no input can
 *     suppress the gate. The selector routes through the SEED-020
 *     selector-dispatcher (Shape F.1 single-select, multiSelect:false) -- this
 *     module builds the option SPEC, it does NOT construct a bespoke selector
 *     payload.
 *
 *   persistAbstractionLevel(db, params) -- the persistence helper, re-exported
 *     here from the navigation chokepoint (lib/core/navigation.cjs, backed by
 *     the allow-listed lib/core/navigation/abstraction-claim.cjs submodule). The
 *     raw nodes-table write lives behind the navigation substrate guard (Part 9);
 *     this module surfaces it alongside the selector so a Door 3 caller has one
 *     import. It writes the chosen abstraction_level (instances|structure|unsure)
 *     as an ADDITIVE property on the EXISTING hypothesis claim node (the Wave-4
 *     truth-claim minted by writeClaimNode), riding the properties TEXT blob,
 *     NEVER a DDL column; the node type stays 'claim'. It mints NO new node type
 *     and NO edge type (SPEC boundary + Part 11); review_status is UNTOUCHED
 *     (Part 9 role 5).
 *
 * Canon Part 8 (The Graph Boundary): LOCAL only. The abstraction pick +
 *   hypothesis_text NEVER egress to Brain. node built-ins only, zero new deps.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Hyphens only.
 */

// The persistence helper lives behind the navigation substrate chokepoint (the
// raw nodes-table UPDATE is allow-listed only inside lib/core/navigation/*). We
// re-export it here so Door 3 has a single import surface (the selector + the
// persist helper) without this non-allow-listed file hand-rolling a graph write.
const navigation = require('./navigation.cjs');

// The closed 3-option abstraction-level enum. INSTANCES / STRUCTURE / unsure.
// FROZEN here as the gate's option set; the persistence helper validates a pick
// against the key form (lowercase). 'unsure' is the deliberate third option that
// absorbs the undecided navigator (CONTEXT decision 2).
const ABSTRACTION_KEYS = Object.freeze(['instances', 'structure', 'unsure']);

// The canonical Shape F single-select sub-shape this gate renders as (the
// arrow-key single-pick path). The dispatcher (lib/hmi/selector-dispatcher.cjs)
// constructs the AskUserQuestion mode from this; this module never builds a
// bespoke dialog (SEED-020 single construction door).
const ABSTRACTION_SHAPE = 'F.1';

// The default header + question. The question is generic and domain-neutral: it
// names the abstraction distinction, never a venture or domain. Callers MAY pass
// a role-aware header (per-role framing rides on Door 3 itself, Req 7); the
// OPTION SET is invariant.
const DEFAULT_HEADER = 'Abstraction level';
const DEFAULT_QUESTION = 'Are you testing specific INSTANCES, the general STRUCTURE, or unsure?';

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * buildAbstractionSelector(opts?) -- the PURE 3-option selector spec.
 *
 * ALWAYS-FIRE: this function is unconditional. It takes no signal that could
 * skip the gate; it carries no skip predicate and no ambiguity-detection branch.
 * Every Door 3 hypothesis calls it and gets the same 3-option single-select.
 *
 * Returns:
 *   {
 *     shape: 'F.1',              // Shape F single-select (arrow-key, keyboard)
 *     multiSelect: false,        // single-pick (not a checkbox)
 *     keyboard: 'arrow-key',     // the F.1 keyboard contract (Req 12)
 *     header, question,
 *     options: [ { key, label, description }, ... ]   // exactly 3
 *   }
 *
 * opts.header / opts.question override the defaults (role-aware framing); the
 * option SET is invariant regardless of opts.
 */
function buildAbstractionSelector(opts) {
  const o = isPlainObject(opts) ? opts : {};
  const header = (typeof o.header === 'string' && o.header.length > 0) ? o.header : DEFAULT_HEADER;
  const question = (typeof o.question === 'string' && o.question.length > 0) ? o.question : DEFAULT_QUESTION;
  return {
    shape: ABSTRACTION_SHAPE,
    multiSelect: false,
    keyboard: 'arrow-key',
    header: header,
    question: question,
    options: [
      {
        key: 'instances',
        label: 'INSTANCES',
        description: 'You are testing specific instances (concrete cases).',
      },
      {
        key: 'structure',
        label: 'STRUCTURE',
        description: 'You are testing the general structure (the rule that relates them).',
      },
      {
        key: 'unsure',
        label: 'unsure',
        description: 'You are not yet sure which level you are testing.',
      },
    ],
  };
}

module.exports = {
  buildAbstractionSelector,
  // Re-exported from the navigation chokepoint (the raw nodes-table write is
  // allow-listed only inside lib/core/navigation/abstraction-claim.cjs). Door 3
  // imports both the selector and the persist helper from this one surface.
  persistAbstractionLevel: navigation.persistAbstractionLevel,
  normalizeAbstractionLevel: navigation.normalizeAbstractionLevel,
  ABSTRACTION_KEYS,
  ABSTRACTION_SHAPE,
};
