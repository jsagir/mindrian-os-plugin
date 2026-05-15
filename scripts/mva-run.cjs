#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-03 Plan 03 Task 2 -- scripts/mva-run.cjs.
 *
 * Thin CLI wrapper around lib/core/mva-orchestrator.cjs::runPipeline.
 *
 * Invoked by Larry via Bash (NOT a Claude Code hook). Therefore stdout
 * writes are REQUIRED and ALLOWED -- the user sees the rendered output via
 * the Bash tool's output channel and Larry relays it (per OQ11 lean +
 * skill instructions in skills/mva-pipeline/SKILL.md).
 *
 * Exit codes:
 *   0 -- success (whether brief rendered, Hebrew refusal, or no-pending)
 *   1 -- hard failure (uncaught exception)
 *
 * Note: this script does NOT write to stdin or read CLI args in v1.13.0.
 * The orchestrator reads its state from the Plan 118-00 state file.
 */
'use strict';

(async () => {
  try {
    const { runPipeline } = require('../lib/core/mva-orchestrator.cjs');
    const outcome = await runPipeline({});
    if (outcome && typeof outcome.rendered === 'string' && outcome.rendered.length > 0) {
      process.stdout.write(outcome.rendered);
    }
    process.exit(0);
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    process.stderr.write('[mva-run] ' + msg + '\n');
    process.exit(1);
  }
})();
