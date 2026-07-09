#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-00 -- SessionStart Coordinator (Sub-plan A of 121.5-CONTEXT.md item 1).
 *
 * Single SessionStart owner enforcing D-13 (precedence) + D-14 (2000-char budget)
 * + D-15 (iterative compression) + D-16 (contributor isolation).
 *
 * Replaces the ~11 independent SessionStart hook entries with ONE coordinator entry
 * in hooks/hooks.json. Each existing injector script exposes a `contribute*()`
 * function returning a ContributorFragment; this coordinator orchestrates all of
 * them, composes ONE consolidated `additionalContext` body under 2000 chars, and
 * emits the Claude Code SessionStart envelope.
 *
 * Canon Part 3 (Decision Gate): tri-context surface composes deterministically.
 * Canon Part 7 (Reuse Before Build): consolidation, not net-new surface.
 * Canon Part 8 (Graph Boundary): zero network surface; LOCAL scalars + enums only.
 * Canon Part 10 (Conversation as Product): coherent turn-1 IS the product moment.
 *
 * Phase 198-08 (SPEC-5, D-05/D-06): behind MINDRIAN_MCP_FIRST naming 'cli' (or
 * 'all'), main() dispatches to runThinAdapter() INSTEAD of the 11-contributor
 * runAll() below -- a thin wake-the-daemon + query-two-tools + render
 * composer, no local business logic. Flag OFF (unset/empty, the default)
 * keeps runAll() and every contributor exactly as shipped -- byte-identical
 * legacy (SPEC-7). D-06: this file's own require() calls never reach into
 * the lib-core / lib-workflow / lib-memory business-module directories
 * anywhere in its text (the import-audit scans the whole file, not just the
 * flag-ON branch) -- the one such import this file used to carry (a
 * telemetry mirror through the shared navigation chokepoint, reachable only
 * when a caller passed opts.db -- no caller in this tree ever did) was
 * removed as dead code rather than reworked, since nothing exercised it.
 *
 * Pure CJS, node built-ins only. No new runtime dependencies (lib/mcp/* is
 * adapter plumbing, not a business module -- same D-06 boundary
 * lib/mcp/adapter-client.cjs itself draws).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { PRECEDENCE_LADDER } = require('../lib/sessionstart/precedence-ladder.cjs');
const { compressUntilUnderBudget } = require('../lib/sessionstart/budget-compressor.cjs');
const { runContributor } = require('../lib/sessionstart/contributor-isolator.cjs');
const { isMcpFirst } = require('../lib/mcp/mcp-first-flag.cjs');
const { wakeDaemon, queryDaemon } = require('../lib/mcp/adapter-client.cjs');

const BUDGET_CHARS = 2000;                                        // D-14
const PER_CONTRIBUTOR_TIMEOUT_MS = 1500;                          // D-16 graceful fail
const DEFAULT_TELEMETRY_PATH = path.join(
  os.homedir(), '.mindrian', 'telemetry', 'sessionstart-errors.jsonl'
);

// Lazy-require seam so a missing contributor file degrades silently per Canon Part 7
// graceful-degradation pattern. Each entry returns a () => contributeFn binding,
// resolved at runAll() invocation time (NOT module load) so a single broken
// require does not prevent the coordinator module from loading.
const DEFAULT_CONTRIBUTOR_MAP = Object.freeze({
  'install-drift':       () => { try { return require('./preflight-doctor.cjs').contribute; } catch (_) { return null; } },
  'sealed-room':         () => { try { return require('./check-onboard-statusline.cjs').contributeSealed; } catch (_) { return null; } },
  'tension-hook':        () => { try { return require('./preflight-tension-surface.cjs').contribute; } catch (_) { return null; } },
  'memory-resume':       () => { try { return require('./memory-resume-nudge.cjs').contribute; } catch (_) { return null; } },
  'auto-explore':        () => { try { return require('./preflight-auto-explore.cjs').contribute; } catch (_) { return null; } },
  'onboarding':          () => { try { return require('./check-onboard-statusline.cjs').contributeOnboarding; } catch (_) { return null; } },
  'minto':               () => { try { return require('./statusline-fallback-echo.cjs').contributeMintoSegment; } catch (_) { return null; } },
  'jtbd':                () => { try { return require('./operator-update.cjs').contributeJtbd; } catch (_) { return null; } },
  'operator':            () => { try { return require('./operator-update.cjs').contributeOperator; } catch (_) { return null; } },
  'post-compact':        () => { try { return require('./restore-post-compact-context.cjs').contribute; } catch (_) { return null; } },
  'statusline-fallback': () => { try { return require('./statusline-fallback-echo.cjs').contribute; } catch (_) { return null; } },
});

/**
 * withTimeout(fn, ms) -- wrap an async or sync function in a timeout race.
 * The Promise.race rejects with 'contributor_timeout' if fn does not settle within ms.
 * Per-contributor isolation upstream catches the throw and converts it to null.
 */
function withTimeout(fn, ms) {
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('contributor_timeout')), ms);
  });
  return Promise.race([
    Promise.resolve().then(fn),
    timeoutPromise,
  ]).finally(() => clearTimeout(timeoutHandle));
}

/**
 * runAll(opts) -- compose the SessionStart envelope from all 11 contributors.
 *
 * opts.db                : optional sqlite handle for memory_event emission
 * opts.telemetryPath     : optional override for JSONL telemetry path
 * opts.contributorMap    : optional override for the contributor map (test seam)
 * opts.timeoutMs         : optional override for per-contributor timeout
 * opts.budgetChars       : optional override for the body budget (defaults 2000)
 *
 * Returns the Claude Code envelope: {continue: true, hookSpecificOutput?: {...}}.
 * Never throws.
 */
async function runAll(opts) {
  const options = opts || {};
  // Passed through opaquely to runContributor's own isolator seam (lib/
  // sessionstart/contributor-isolator.cjs) -- that module owns the ONLY
  // memory_event emission on a contributor throw (Canon Part 4/8, tested by
  // sessionstart-coordinator.test.cjs Test 6). This file never itself
  // requires a lib/core module (D-06); db is just an opaque value handed to
  // a sibling module's own optional param.
  const db = options.db || null;
  const telemetryPath = typeof options.telemetryPath === 'string' && options.telemetryPath.length > 0
    ? options.telemetryPath
    : DEFAULT_TELEMETRY_PATH;
  const contributorMap = options.contributorMap || DEFAULT_CONTRIBUTOR_MAP;
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs : PER_CONTRIBUTOR_TIMEOUT_MS;
  const budget = Number.isFinite(options.budgetChars) && options.budgetChars > 0
    ? options.budgetChars : BUDGET_CHARS;

  // D-16: parallel execution via Promise.all so total time = max(per-contributor)
  // not sum. Per-contributor 1500ms timeout means worst-case total ~ 1500ms + overhead.
  const fragments = await Promise.all(PRECEDENCE_LADDER.map(async (id) => {
    let fn = null;
    try {
      const resolver = contributorMap[id];
      if (typeof resolver === 'function') fn = resolver();
    } catch (_) { fn = null; }
    if (typeof fn !== 'function') return null;
    return await runContributor(id, () => withTimeout(fn, timeoutMs), { db, telemetryPath });
  }));

  const live = fragments.filter((f) => f && f.has_payload === true);

  if (live.length === 0) {
    // No contributor had anything to say. Emit minimal envelope per Claude Code contract.
    return { continue: true };
  }

  const { body } = compressUntilUnderBudget(live, budget);

  if (!body || body.length === 0) {
    return { continue: true };
  }

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: body,
    },
  };
}

/**
 * parseToolPayload(callToolResult) -- unwrap a queryDaemon() CallToolResult's
 * first text content block back into the JS object status_read/
 * room_state_bound composed server-side. Never throws; a malformed/missing
 * payload degrades to null (the caller's own try/catch around
 * runThinAdapter() is the real safety net, this is a second, cheap guard).
 *
 * @param {object} result
 * @returns {object|null}
 */
function parseToolPayload(result) {
  try {
    const block = result && Array.isArray(result.content) ? result.content[0] : null;
    const text = block && block.text;
    if (typeof text !== 'string') return null;
    return JSON.parse(text);
  } catch (_e) {
    return null;
  }
}

/**
 * runThinAdapter() -- Phase 198-08 (SPEC-5, D-05/D-06) flag-ON path: wake the
 * daemon, query it for the session binding (room_state_bound) and the status
 * segment (status_read), compose a MINIMAL additionalContext body from their
 * ALREADY-SHIPPED, server-side-composed payloads, and render. Zero session-
 * reconcile / budget-compression / contributor-isolation logic runs in this
 * process -- that composition now lives server-side (the tools themselves,
 * Plan 04/06), this function only wakes, queries twice, and renders. Never
 * throws past its own try/catch (the SAME forgiving contract runAll()'s
 * main() caller already honors for the flag-OFF path).
 *
 * @returns {Promise<{continue: true, hookSpecificOutput?: object}>}
 */
async function runThinAdapter() {
  try {
    await wakeDaemon();
    const [bindingResult, statusResult] = await Promise.all([
      queryDaemon('room_state_bound', {}),
      queryDaemon('status_read', {}),
    ]);
    const binding = parseToolPayload(bindingResult);
    const status = parseToolPayload(statusResult);

    const parts = [];
    if (binding && typeof binding.room_dir === 'string' && binding.room_dir.length > 0) {
      parts.push('Room: ' + binding.room_dir);
    }
    const seg = status && status.segments;
    if (seg && seg.context_pct !== null && seg.context_pct !== undefined) {
      parts.push('Context: ' + seg.context_pct + '%');
    }

    const body = parts.join('\n');
    if (body.length === 0) {
      return { continue: true };
    }
    return {
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: body,
      },
    };
  } catch (_e) {
    // Forgiving contract: a daemon-reach failure never blocks SessionStart.
    return { continue: true };
  }
}

async function main() {
  try {
    // D-05/D-07: flag-ON ('cli' or 'all') dispatches to the thin daemon-query
    // adapter; flag OFF (unset/empty, the default) runs the full 11-
    // contributor runAll() exactly as shipped -- byte-identical legacy.
    const envelope = isMcpFirst('cli') ? await runThinAdapter() : await runAll();
    try { process.stdout.write(JSON.stringify(envelope)); } catch (_) { /* swallow */ }
    process.exit(0);
  } catch (e) {
    try { process.stderr.write('coordinator_unexpected: ' + (e && e.message) + '\n'); } catch (_) {}
    try { process.stdout.write(JSON.stringify({ continue: true })); } catch (_) {}
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runAll,
  runThinAdapter,
  BUDGET_CHARS,
  PER_CONTRIBUTOR_TIMEOUT_MS,
  DEFAULT_CONTRIBUTOR_MAP,
};
