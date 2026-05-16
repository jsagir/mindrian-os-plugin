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
 * Canon Part 4 (every choice is graph data): coordinator decisions mirror to
 *   Phase 121 telemetry via sessionstart_coordinator_run memory_event.
 * Canon Part 7 (Reuse Before Build): consolidation, not net-new surface.
 * Canon Part 8 (Graph Boundary): zero network surface; LOCAL scalars + enums only.
 * Canon Part 10 (Conversation as Product): coherent turn-1 IS the product moment.
 *
 * Pure CJS, node built-ins only. Zero new runtime dependencies.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { PRECEDENCE_LADDER } = require('../lib/sessionstart/precedence-ladder.cjs');
const { compressUntilUnderBudget } = require('../lib/sessionstart/budget-compressor.cjs');
const { runContributor } = require('../lib/sessionstart/contributor-isolator.cjs');

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

  const { body, dropped, compressed } = compressUntilUnderBudget(live, budget);

  // Phase 121 trajectory mirror -- LOCAL scalars + enums only (Canon Part 8).
  if (db) {
    try {
      const navigation = require('../lib/core/navigation.cjs');
      if (navigation && typeof navigation.logMemoryEvent === 'function') {
        navigation.logMemoryEvent(db, 'sessionstart_coordinator_run', {
          fragments_total: live.length,
          fragments_compressed: Array.isArray(compressed) ? compressed.length : 0,
          fragments_dropped: Array.isArray(dropped) ? dropped.length : 0,
          bytes_emitted: Buffer.byteLength(body || '', 'utf8'),
        });
      }
    } catch (_) {
      // Coordinator must not crash on telemetry write failures.
    }
  }

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

async function main() {
  try {
    const envelope = await runAll();
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
  BUDGET_CHARS,
  PER_CONTRIBUTOR_TIMEOUT_MS,
  DEFAULT_CONTRIBUTOR_MAP,
};
