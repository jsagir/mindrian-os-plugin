'use strict';
/*
 * seam-liveness.cjs -- the generic, repo-wide "is this seam alive at both ends?"
 * assertion helper.
 * =========================================================================
 * Phase 235-02 (CIRS-02). A SEAM is any place one part of the system makes a
 * CLAIM about another part being reachable: a hook matcher naming a tool, an
 * enqueue naming a queue some consumer is supposed to drain, a minted gate type
 * some ratifier is supposed to consume, a registry claiming a module exports
 * something usable. The failure mode is always the same shape: the claim stays
 * on disk, the far end quietly goes away, and NOTHING reports it. The seam is
 * dead and every surface still reads green.
 *
 * This module is deliberately NOT CIRS-specific. CIRS-02 is only its first
 * consumer (scripts/build-connector-registry.cjs's coverageReport() walks MCP
 * tool files through checkClaimedModuleLiveness). Phases 237/238/239 consume
 * the other three wrappers for their own hook-matcher / enqueue-consumer /
 * mint-ratifier liveness proofs without reinventing this logic.
 *
 * Discipline mirrored from lib/core/statusline-liveness-gate.cjs: the verdict is
 * computed from the caller's own facts and can NEVER be overridden. There is no
 * options object, no force flag, no allowlist argument. "A gate that cannot fail
 * is not a gate." A liveness probe that THROWS counts as dead, not as a crash:
 * a broken check is exactly as untrustworthy as a missing far end.
 *
 * Pure + offline: zero network, zero Brain, node built-ins only (Canon Part 8).
 * No em-dashes.
 */

/**
 * Coerce a caller's "live things" argument (Array or Set) into a Set for
 * membership testing. Anything else degrades to an EMPTY set, which makes every
 * claim read dead. That direction is deliberate: an unreadable live-side is a
 * seam we cannot prove alive, and the safe verdict is dead.
 */
function toLiveSet(live) {
  if (live instanceof Set) return live;
  if (Array.isArray(live)) return new Set(live);
  return new Set();
}

/**
 * assertSeamLive(seam) -> { name, ok, claimedCount, liveCount, dead }
 *
 * seam = {
 *   name:   string        a human label for the seam (for the report)
 *   claims: Array         the things one side CLAIMS are reachable
 *   isLive: (claim) => boolean   the probe for whether one claim is real
 * }
 *
 * Zero claims is VACUOUSLY live: a seam that claims nothing cannot be dead. A
 * malformed seam (no claims, no probe) therefore degrades to ok:true with zero
 * counts rather than throwing, mirroring statusline-liveness-gate.cjs's
 * malformed-sample degrade convention.
 *
 * There is deliberately no second parameter. No caller can weaken this verdict.
 */
function assertSeamLive(seam) {
  const s = seam && typeof seam === 'object' && !Array.isArray(seam) ? seam : {};
  const name = typeof s.name === 'string' && s.name ? s.name : 'unnamed-seam';
  const claims = Array.isArray(s.claims) ? s.claims : [];
  const probe = typeof s.isLive === 'function' ? s.isLive : null;

  const dead = [];
  let liveCount = 0;
  for (const claim of claims) {
    let live = false;
    if (probe) {
      try {
        live = probe(claim) === true;
      } catch (_e) {
        // A probe that throws proves nothing. Treat the claim as dead.
        live = false;
      }
    }
    if (live) liveCount += 1;
    else dead.push(claim);
  }

  return {
    name,
    ok: dead.length === 0,
    claimedCount: claims.length,
    liveCount,
    dead,
  };
}

/**
 * Dead-seam shape #1: a Claude Code hook matcher naming a tool that no longer
 * exists. Pass the tool names the matchers claim, plus the tool names actually
 * registered right now.
 *
 * Grounding for the tool-name shape (recorded per the plan's consultation
 * requirement): the correct current form is mcp__<server>__<tool>, double
 * underscore between server and tool, confirmed from direct repo evidence
 * rather than assumed -- this repo's own hooks/hooks.json already matches on
 * "mcp__brain_.*" in its PreToolUse/PostToolUse entries, and the same shape is
 * visible in live registered tool names (mcp__langtalks-graph-expert__query_
 * relationship). The reason this wrapper has to exist at all: Claude Code
 * evaluates a hook matcher per tool-call event and never validates it against a
 * live tool registry at startup, so a matcher pointing at a removed tool does
 * not warn or error, it silently stops firing forever. That silent no-op is a
 * dead seam the product itself gives no signal for.
 *
 * Prior-art consult (also per the plan): mcp__langtalks-graph-expert__ was
 * queried for existing work on liveness or health checking of registered tool
 * surfaces in agent/LLM tool-use systems and returned zero relationship edges.
 * Not in that corpus yet, which is a valid outcome under this repo's grounding
 * rule, so nothing is cited from it here rather than inventing a source.
 */
function checkHookMatcherLiveness(matcherToolNames, liveToolNames) {
  const live = toLiveSet(liveToolNames);
  return assertSeamLive({
    name: 'hook-matcher-names-a-live-tool',
    claims: Array.isArray(matcherToolNames) ? matcherToolNames : [],
    isLive: (toolName) => live.has(toolName),
  });
}

/**
 * Dead-seam shape #2: something enqueues onto a queue no consumer is registered
 * to drain. The writes succeed, the work never happens.
 */
function checkEnqueueConsumerLiveness(enqueuedQueueNames, registeredConsumerQueueNames) {
  const live = toLiveSet(registeredConsumerQueueNames);
  return assertSeamLive({
    name: 'enqueue-has-a-registered-consumer',
    claims: Array.isArray(enqueuedQueueNames) ? enqueuedQueueNames : [],
    isLive: (queueName) => live.has(queueName),
  });
}

/**
 * Dead-seam shape #3: a gate type gets minted but no ratifier can consume it, so
 * the gate is raised and nothing on the other side can ever clear it.
 */
function checkMintRatifierLiveness(mintedGateTypes, ratifierGateTypes) {
  const live = toLiveSet(ratifierGateTypes);
  return assertSeamLive({
    name: 'minted-gate-has-a-reachable-ratifier',
    claims: Array.isArray(mintedGateTypes) ? mintedGateTypes : [],
    isLive: (gateType) => live.has(gateType),
  });
}

/**
 * The fourth, additive wrapper: a set of modules some registry CLAIMS exist and
 * export something usable, where the caller has ALREADY probed each one (for
 * example by attempting require() and reading an expected export).
 *
 * claimedModules = [{ id, live, reason? }]. The claim is the id; the probe is
 * that entry's own .live boolean. A malformed entry, or an id with no matching
 * entry, is dead.
 */
function checkClaimedModuleLiveness(claimedModules) {
  const entries = Array.isArray(claimedModules) ? claimedModules : [];
  const byId = new Map();
  for (const e of entries) {
    if (e && typeof e === 'object' && typeof e.id === 'string') byId.set(e.id, e);
  }
  return assertSeamLive({
    name: 'claimed-module-loads-and-exports',
    claims: entries.map((e) => (e && typeof e === 'object' ? e.id : e)),
    isLive: (id) => {
      const e = byId.get(id);
      return !!e && e.live === true;
    },
  });
}

module.exports = {
  assertSeamLive,
  checkHookMatcherLiveness,
  checkEnqueueConsumerLiveness,
  checkMintRatifierLiveness,
  checkClaimedModuleLiveness,
};
