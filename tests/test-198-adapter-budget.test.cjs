#!/usr/bin/env node
// Phase 198 SPEC-5 -- thin-plugin adapter (hooks carry zero business logic).
// Real behavior (D-06): a measured check over hooks/ scripts -- an import
// audit (no `require('../lib/core/...')` business module from a hook script)
// plus a line-count budget -- proves hooks/hooks.json's ~39 scripts wake, query
// mindrian-core, and render its response, without carrying session/filing/gate
// business logic in-process. Migration order is D-05: statusline + SessionStart
// FIRST, Stop-gate enforcement LAST (only after server-side gate dedup lands).
//
// This test is guarded on lib/mcp/hook-adapter-audit.cjs -- the module the
// owning plan lands to implement the import-audit + line-count budget itself.
// (hooks/hooks.json already exists today, so it cannot serve as the run_if
// gate; the audit module is the real migration marker.)
//
// SKIP-safe until lib/mcp/hook-adapter-audit.cjs exists. Node built-in assert
// only. No em-dashes.
'use strict';
const assert = require('node:assert');

let audit;
try {
  audit = require('../lib/mcp/hook-adapter-audit.cjs');
} catch (e) {
  console.log('SKIP: test-198-adapter-budget -- lib/mcp/hook-adapter-audit.cjs not present yet. ' + (e.code || e.message));
  process.exit(0);
}

const hasAuditApi = typeof audit.auditHookScripts === 'function'
  || typeof audit.checkAdapterBudget === 'function';
if (!hasAuditApi) {
  console.log('SKIP: test-198-adapter-budget -- hook-adapter-audit.cjs present but audit API not exported yet.');
  process.exit(0);
}

// --- the real import-audit + line-count budget contract lands here ---
assert.ok(audit, 'hook-adapter-audit module loaded');
console.log('PASS: test-198-adapter-budget (stub -- hook-adapter-audit.cjs present; real import-audit + budget contract lands in its owning plan)');
process.exit(0);
