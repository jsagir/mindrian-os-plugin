'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 254 Plan 04 (COMP-01) -- the single enumeration of every
 * mindrian-os-named tool handler that reaches the Brain.
 *
 * (a) RATIFICATION RECORD, NOT AN APPROVAL QUEUE. Both reaching sites named
 *     below SHIPPED before this phase existed and are released, tested
 *     production behaviour: the `orchestration` tool's act / act-chain /
 *     act-dry-run / act-swarm dispatch into brain-router.cjs's Tier 3 live
 *     brainClient.ask() call, and `suggest_next`'s chain offer via
 *     chain-recommender.cjs's chainOfferForReach() -> brainClient
 *     .recommendChain() (Quick 260819-c8j, commit 5278e9cb, 2026-08-19).
 *     The navigator's D-01 ruling (254-CONTEXT.md, 2026-09-02) is RATIFY,
 *     not approve-to-start: this file names what already runs and governs
 *     it, it does not green-light something new.
 *
 * (b) PART 8 IS HONORED BY PAYLOAD, NOT BY SEAM. A local MCP handler calling
 *     the Brain sits in the SAME trust position as a local CLI script
 *     calling brain-client.cjs -- always sanctioned. SEED-053's
 *     load-bearing clarification, carried verbatim: "the MindrianOS MCP
 *     server is LOCAL (stdio, runs on the user's machine, reads the local
 *     room). Exposing a chain-runner tool there is Part-8-CLEAN -- the wall
 *     only bites on the eventual REMOTE Brain lift, where only generic
 *     framework handles cross. There is no Part 8 obstacle to this seed on
 *     the local server." The seam is not the violation; the payload is --
 *     and every entry below with reaches_brain: true carries only a
 *     generic problem-type / complexity enum, never room content.
 *
 * (c) THE THREE SEAMS, AND WHICH ENFORCEMENT SEES EACH (254-RESEARCH.md
 *     Section 3.1):
 *       Seam A, model-issued (the mindrian-brain MCP server's own tools,
 *         called by name) -- the host PreToolUse hook sees this; the
 *         callTool belt below does NOT (that traffic never touches
 *         brain-client.cjs at all). This is H3, and H3 IS STILL OPEN -- it
 *         belongs to Phase 257, not this file. A summary claiming Part 8
 *         coverage without naming H3 as open is 254-RESEARCH.md's named
 *         Pitfall 4; do not reproduce it here or in any summary that cites
 *         this file.
 *       Seam B, CLI-script -> brain-client.cjs -- no hook, belt-visible.
 *         Always sanctioned, not this file's concern.
 *       Seam C, mindrian-os handler -> brain-client.cjs -- no hook (the
 *         tool name is suggest_next / orchestration, not the Brain
 *         server's own tool names), belt-visible. This is H1, and this
 *         file IS its enumeration.
 *
 * (d) THE BUILD FAILS CLOSED. tests/test-254-composition-census.cjs
 *     reconciles COMPOSITION_SITES against a live recursive scan of
 *     lib/mcp/ in BOTH directions: an undeclared reach site fails the
 *     build, and a stale declaration (an entry claiming reaches_brain:
 *     true for a file that no longer contains a reach) also fails. Adding
 *     a fourth composed call anywhere under lib/mcp/ requires an entry
 *     here, and that entry MUST state a numeric bound_ms (254-RESEARCH.md
 *     Section 3.5's explicit APPROVE condition) or validateSites() throws
 *     at module load.
 *
 * This module is a DECLARATION only: it requires nothing, executes
 * nothing, opens no wire. The scanner that reconciles it against source
 * lives in the test, not here -- that split is what lets this file hold
 * plain quoted path strings as DATA without ever matching its own
 * require-expression scan pattern.
 *
 * No em-dashes. CJS only.
 */

const COMPOSITION_SITES = Object.freeze([
  Object.freeze({
    file: 'lib/mcp/brain-router.cjs',
    handler: 'brainRoute (recommend, Tier 3)',
    tool: 'orchestration (act, act-chain, act-dry-run, act-swarm)',
    via: "brainClient.ask(question) -- a generic problem-type/complexity enum question, never room content",
    reaches_brain: true,
    belt: 'callTool',
    bound_ms: 2000,
    frequency: 'one call per act* invocation, Tier 3 only (Tier 1 cache and Tier 2 local heuristic run first and can short-circuit before this call is made)',
    reason: "D-01 ratifies this as the orchestration tool's live Brain-grounded recommendation leg, shipped before this phase existed. Desktop and Cowork have no MCP hook surface, so this is their only Brain-grounded enrichment path for act*.",
    ratified_by: 'D-01',
  }),
  Object.freeze({
    file: 'lib/mcp/brain-router.cjs',
    handler: 'recommend (SWEEP-01 disclosure leg)',
    tool: 'orchestration (act, act-chain, act-dry-run, act-swarm)',
    via: 'availability disclosure only -- gated on whether a Brain key resolved; no tools/call is made on this leg',
    reaches_brain: false,
    belt: null,
    bound_ms: null,
    frequency: 'best-effort, on the Tier-3-miss fallback path only (never blocks the return)',
    reason: 'Enumerated precisely BECAUSE it is a brain-client.cjs require that does NOT reach the Brain, so a future reader does not have to re-derive whether this is a third wire. It is the disclosure leg of site 1 above, not a second wire.',
    ratified_by: 'n/a (no Brain call on this leg)',
  }),
  Object.freeze({
    file: 'lib/mcp/tools/sensors.cjs',
    handler: 'suggest_next (chainOfferForReach)',
    tool: 'suggest_next',
    via: 'chainRecommender.chainOfferForReach(reach, {}) -> brainClient.recommendChain(problemType) -- a generic problem-type enum, never room content',
    reaches_brain: true,
    belt: 'callTool',
    bound_ms: 20000,
    frequency: 'one call per pull, on the top pick only -- reach_candidates is deliberately NOT wired (fanning the call across the whole candidate set would multiply wire cost by reach breadth for no additional first-offer value)',
    reason: "D-01 ratifies this as suggest_next's live Brain-grounded chain offer (Quick 260819-c8j, commit 5278e9cb, 2026-08-19). Desktop and Cowork have no MCP hook surface, so this is their only Brain-grounded enrichment path for suggest_next.",
    ratified_by: 'D-01',
  }),
  Object.freeze({
    file: 'lib/mcp/tool-router.cjs',
    handler: 'orchestration dispatch (act, act-chain, act-dry-run, act-swarm)',
    tool: 'orchestration (act, act-chain, act-dry-run, act-swarm)',
    via: 'dispatch into brain-router.cjs::recommend(), indirect -- this file makes no Brain call itself',
    reaches_brain: false,
    belt: null,
    bound_ms: null,
    frequency: 'every act* invocation dispatches here first',
    reason: 'Enumerated because this is the seam that makes site 1 (brain-router.cjs Tier 3) reachable at all -- a reader standing here needs to know the reach exists one hop downstream, not rediscover it by re-reading brain-router.cjs cold.',
    ratified_by: 'n/a (dispatch only, no direct Brain call)',
  }),
]);

/**
 * validateSites(list) -- throw-at-load discipline, copied in spirit from
 * scripts/check-plugin-path-anchoring.cjs's validateAllowlist(). THROWS on:
 *   - a non-array argument
 *   - any entry missing a non-empty `file` or `tool`
 *   - any entry with a missing or empty `reason`
 *   - any entry with `reaches_brain === true` lacking a numeric
 *     `bound_ms > 0`, or lacking `belt: 'callTool'`
 * Called at module load below so a malformed declaration fails immediately
 * rather than at test time.
 *
 * @param {Array<object>} list
 * @returns {void}
 */
function validateSites(list) {
  if (!Array.isArray(list)) {
    throw new Error('brain-composition-census: validateSites() requires an array');
  }
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('brain-composition-census: every entry must be an object');
    }
    if (typeof entry.file !== 'string' || entry.file.length === 0) {
      throw new Error('brain-composition-census: entry missing a non-empty file');
    }
    if (typeof entry.tool !== 'string' || entry.tool.length === 0) {
      throw new Error('brain-composition-census: entry ' + entry.file + ' missing a non-empty tool');
    }
    if (typeof entry.reason !== 'string' || entry.reason.trim().length === 0) {
      throw new Error('brain-composition-census: entry ' + entry.file + ' (' + (entry.handler || '?') + ') missing a non-empty reason');
    }
    if (entry.reaches_brain === true) {
      if (typeof entry.bound_ms !== 'number' || !(entry.bound_ms > 0)) {
        throw new Error('brain-composition-census: reaching entry ' + entry.file + ' (' + (entry.handler || '?') + ') missing a numeric bound_ms > 0');
      }
      if (entry.belt !== 'callTool') {
        throw new Error("brain-composition-census: reaching entry " + entry.file + ' (' + (entry.handler || '?') + ") must declare belt: 'callTool'");
      }
    }
  }
}

validateSites(COMPOSITION_SITES);

module.exports = { COMPOSITION_SITES, validateSites };
