'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-06 Task 2 -- taxonomy-climb: the local, free rung classifier plus
 * the optional four-rung ladder render that degrades to one line of local
 * prose. layer: graph
 *
 * THE CLIMB IS LOCAL AND FREE (Canon Part 8, PROC-G3 in 345-ICM-CONSULT).
 * Theo's `classify_problem_type` tool takes NO parameters -- the CALLER
 * classifies (brain-client.cjs:1152-1155). `climb()` below is a thin named
 * wrapper over that repo's one local classifier
 * (`brainClient._inferRungFromQuestion`), pure, synchronous, zero network.
 * It exists so the call site reads as an intent ("climb the ladder") and so
 * this header can carry the Part 8 statement in one place: the goal's
 * un-persisted rung-source question is user data and it stays local, full
 * stop. This module does not accept or forward that question field to
 * anything except `climb()` itself; it never reaches the header, the
 * options, the payload, or the wire (345-ICM-CONSULT OBJ-G2 / T-345-28).
 *
 * THE RENDER IS OPTIONAL DECORATION, NEVER A DEPENDENCY. `renderLadder`
 * calls `brainClient.callTool('taxonomy_ladder', args)`, which applies the
 * in-process Part 8 belt at brain-client.cjs:657-676 regardless of
 * PreToolUse hook coverage. `taxonomy_ladder` does not start with `brain_`
 * and the two-member server alternation in the PreToolUse matcher
 * (hooks/hooks.json:225,:327) does not name the raw Theo server either, so a
 * caller that reaches for the RAW tool name directly (bypassing
 * `brainClient.callTool` entirely) would match neither arm of that matcher
 * and would never be scanned. This module therefore has exactly ONE wire
 * door -- `brainClient.callTool` -- and no other function in this file ever
 * issues a network call.
 *
 * THE FALLBACK IS WHAT MAKES THIS DECORATION RATHER THAN A DEPENDENCY.
 * `localLadderLine` is the Tier 0 one-line fallback (matching the shipped
 * Tier 0 sentinel shape, `mode_rationale: 'brain_unreachable'`,
 * directive-envelope.cjs:170-186): a room with no Brain reachable still gets
 * a complete strategy card, with local prose standing in for the render.
 *
 * A NAMED, ONE-TIME PROBE DISCHARGES RESEARCH ASSUMPTION A6 (WD-3): this
 * task ran `node scripts/check-brain-tool-liveness.cjs` once against the
 * deployed origin. That gate enumerates the SIX stdio-shim-registered Brain
 * wrapper tools (brain_ask/query/schema/search/stats/write) via a real
 * tools/list handshake; `taxonomy_ladder` is a raw Theo tool reached only
 * through `brainClient.callTool`'s own HTTP path, so it is NOT one of the
 * six names that gate enumerates and the probe's OK result does not, by
 * itself, prove `taxonomy_ladder` answers live. The probe is recorded
 * verbatim (date, exit code, and this honest scope caveat) in
 * 345-06-SUMMARY.md. This is a one-time discharge, not a runtime dependency:
 * it is not re-run here and it is not part of the test suite. Whatever the
 * live answer turns out to be, the card degrades safely to
 * `localLadderLine` and the phase is unaffected either way.
 *
 * REUSE BEFORE BUILD (Canon Part 7): `climb` does not reimplement the
 * marker table; it requires the named `_inferRungFromQuestion` export.
 * `renderLadder` maps through `lib/core/strategy/rung-vocabulary.cjs`
 * (345-01), the ONE function permitted to convert a Theo rung id into the
 * egress guard's ladder-vocabulary string; this module never hand-rolls
 * that mapping.
 *
 * Pure CJS. No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const brainClient = require('../brain-client.cjs');
const rungVocabulary = require('./rung-vocabulary.cjs');
const jtbdTaxonomy = require('../../hmi/jtbd-taxonomy.json');

// The closed 13-entry jtbd slug set, read once at module load. renderLadder
// validates jtbdSlug against this Set and OMITS the question_label key
// entirely when it is not a member -- the 120-char label cap the egress
// guard enforces (part8-egress-guard.cjs:344-347) is hygiene, not the
// content defense, so this module does not rely on the cap alone.
const JTBD_SLUG_IDS = new Set(
  Array.isArray(jtbdTaxonomy && jtbdTaxonomy.entries)
    ? jtbdTaxonomy.entries.map((e) => e && e.id).filter((id) => typeof id === 'string')
    : []
);

// The LOCAL complexity ladder this module's own one-line fallback climbs,
// bottom (most tactically defined) to top (broadest, orthogonal
// stakeholder-conflict axis). This ordering is a LOCAL, transient-prose
// choice for the Tier 0 fallback line only -- it persists nothing and does
// not resolve 345-ICM-CONSULT R6's open contradiction between the code
// vocabularies and templates/room-skeleton/section-contracts/
// problem-definition.md's three-rung-plus-escalation model. That
// contradiction is Plan 08's to correct.
const LADDER_ORDER = Object.freeze(['WellDefined', 'IllDefined', 'UnDefined', 'Wicked']);

/**
 * climb(question) -> one of the four Theo rung ids.
 *
 * A thin named wrapper over brainClient._inferRungFromQuestion. Pure,
 * synchronous, zero network calls, never throws (mirrors the underlying
 * classifier's own contract: non-string or empty input returns
 * 'IllDefined').
 *
 * @param {*} question
 * @returns {'Wicked'|'UnDefined'|'WellDefined'|'IllDefined'}
 */
function climb(question) {
  return brainClient._inferRungFromQuestion(question);
}

/**
 * localLadderLine(theoRungId) -> a single-line Tier 0 fallback string naming
 * the rung above and the rung below on the LOCAL ladder above. Under 200
 * chars, no newline, no em-dash. Never throws; an unrecognized rung id gets
 * a generic honest line rather than a guess.
 *
 * @param {*} theoRungId
 * @returns {string}
 */
function localLadderLine(theoRungId) {
  const idx = LADDER_ORDER.indexOf(theoRungId);
  if (idx === -1) {
    return 'Local ladder: rung not recognized locally (taxonomy_ladder render unavailable).';
  }
  const below = idx > 0 ? LADDER_ORDER[idx - 1] : null;
  const above = idx < LADDER_ORDER.length - 1 ? LADDER_ORDER[idx + 1] : null;
  const here = LADDER_ORDER[idx];
  if (below && above) {
    return 'Local ladder: ' + below + ' below, ' + here + ' here, ' + above + ' above (taxonomy_ladder render unavailable).';
  }
  if (!below) {
    return 'Local ladder: ' + here + ' here (the floor), ' + above + ' above (taxonomy_ladder render unavailable).';
  }
  return 'Local ladder: ' + below + ' below, ' + here + ' here (the top) (taxonomy_ladder render unavailable).';
}

/**
 * renderLadder(theoRungId, jtbdSlug) -> the Brain result, or null.
 *
 * Async. Maps theoRungId through rungVocabulary.toLadderRung (fail closed,
 * never guess: an unmapped rung returns null WITHOUT calling anything).
 * jtbdSlug is validated against the closed 13-entry jtbd-taxonomy.json id
 * set; a non-member value is OMITTED from the call args entirely rather than
 * sent. Calls brainClient.callTool('taxonomy_ladder', args) -- the ONE wire
 * door in this module, carrying the in-process Part 8 belt regardless of
 * PreToolUse hook coverage. Returns null on an egress-blocked result, on a
 * rejected promise, and on any falsy result (Brain unreachable, no key,
 * etc.).
 *
 * @param {*} theoRungId
 * @param {*} jtbdSlug
 * @returns {Promise<object|null>}
 */
async function renderLadder(theoRungId, jtbdSlug) {
  const ladderRung = rungVocabulary.toLadderRung(theoRungId);
  if (ladderRung === null) return null;

  const args = { rung: ladderRung };
  if (typeof jtbdSlug === 'string' && JTBD_SLUG_IDS.has(jtbdSlug)) {
    args.question_label = jtbdSlug;
  }

  let result;
  try {
    result = await brainClient.callTool('taxonomy_ladder', args);
  } catch (_e) {
    return null;
  }
  if (!result) return null;
  if (typeof result === 'object' && result.error === 'egress_blocked') return null;
  return result;
}

module.exports = { climb, renderLadder, localLadderLine };
