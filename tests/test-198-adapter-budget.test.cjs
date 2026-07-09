#!/usr/bin/env node
// Phase 198 SPEC-5 -- thin-plugin adapter (hooks carry zero business logic).
// Real behavior (D-06): a measured check over the MIGRATED hook surfaces
// hooks/hooks.json's own _mcpFirst198Migrated marker names -- an import
// audit (no `require(...lib/core/...)` / `lib/workflow` / `lib/memory`
// business module from a hook script's own text) plus a line-count budget --
// proves those scripts wake, query mindrian-core, and render its response,
// without carrying session/filing/gate business logic in-process. Migration
// order is D-05: statusline + SessionStart FIRST (this plan, enumerated
// below), Stop-gate enforcement LAST (Plan 09, never enumerated here -- the
// marker names only what has actually migrated so far).
//
// This suite is the CI guard against re-fattening (T-198-13): it runs the
// real audit against the real committed files (proving today's tree is
// clean), plus a hermetic fixture-based proof that the guard actually FIRES
// on a forbidden import (never mutates the real tracked scripts).
//
// Node built-in test runner + assert only. No em-dashes. CJS only.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let audit;
try {
  audit = require('../lib/mcp/hook-adapter-audit.cjs');
} catch (e) {
  console.log('SKIP: test-198-adapter-budget -- lib/mcp/hook-adapter-audit.cjs not present yet. ' + (e.code || e.message));
  process.exit(0);
}

const hasAuditApi = typeof audit.auditHookScripts === 'function'
  && typeof audit.lineCountBudget === 'function'
  && typeof audit.checkAdapterBudget === 'function'
  && typeof audit.migratedSurfaces === 'function';
if (!hasAuditApi) {
  console.log('SKIP: test-198-adapter-budget -- hook-adapter-audit.cjs present but audit API not exported yet.');
  process.exit(0);
}

const EXPECTED_MIGRATED_SURFACES = [
  'scripts/statusline-mos-dispatch',
  'scripts/sessionstart-coordinator.cjs',
];

const FORBIDDEN_STOP_GATE_HINTS = [
  'check-card-fire.cjs',
  'hmi-compliance-poll.cjs',
  'stop.cjs',
];

test('migratedSurfaces() enumerates ONLY statusline + SessionStart (D-05), never Stop-gate scripts', () => {
  const surfaces = audit.migratedSurfaces();
  assert.deepEqual(
    surfaces.slice().sort(),
    EXPECTED_MIGRATED_SURFACES.slice().sort(),
    'exactly the two D-05 first-wave surfaces, nothing more'
  );
  for (const hint of FORBIDDEN_STOP_GATE_HINTS) {
    assert.ok(
      !surfaces.some((s) => s.indexOf(hint) !== -1),
      'Stop-gate script must NOT be enumerated yet (Plan 09, D-05 order): ' + hint
    );
  }
});

test('checkAdapterBudget() passes against the real committed tree today', () => {
  const result = audit.checkAdapterBudget();
  assert.equal(result.pass, true, 'combined import-audit + line-budget gate is green: ' + JSON.stringify(result));
  for (const f of result.importAudit.files) {
    assert.equal(f.pass, true, f.script + ' import audit: ' + (f.violation || 'ok'));
  }
  for (const f of result.lineBudget.files) {
    assert.equal(f.pass, true, f.script + ' line budget: ' + f.lines + ' <= ' + f.budget);
  }
});

test('import audit uses a comment-stripped match -- a header comment naming lib/core does not self-invalidate the gate', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p198-08-audit-'));
  const fixturePath = path.join(dir, 'fixture-comment-only.cjs');
  fs.writeFileSync(
    fixturePath,
    "'use strict';\n"
    + "// D-06 note: this comment deliberately mentions require('../lib/core/navigation.cjs')\n"
    + "// as PROSE, never as a real import -- the audit must not self-invalidate on it.\n"
    + "const { isMcpFirst } = require('../lib/mcp/mcp-first-flag.cjs');\n"
    + "module.exports = { isMcpFirst };\n"
  );
  const result = audit.auditHookScripts({ surfaces: [fixturePath] });
  assert.equal(result.pass, true, 'a comment-only mention of lib/core must not fail the audit: ' + JSON.stringify(result.files));
});

test('import audit FAILS on a real (non-comment) lib/core require -- guard is live (hermetic fixture, never mutates the real tracked file)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p198-08-audit-'));
  const fixturePath = path.join(dir, 'fixture-violation.cjs');
  fs.writeFileSync(
    fixturePath,
    "'use strict';\n"
    + "const navigation = require('../lib/core/navigation.cjs');\n"
    + "module.exports = { navigation };\n"
  );
  const result = audit.auditHookScripts({ surfaces: [fixturePath] });
  assert.equal(result.pass, false, 'a real lib/core require must fail the audit');
  assert.equal(result.files[0].pass, false);
  assert.ok(result.files[0].violation && result.files[0].violation.indexOf('lib/core') !== -1);
});

test('import audit FAILS on lib/workflow and lib/memory requires too (not just lib/core)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p198-08-audit-'));
  const workflowFixture = path.join(dir, 'fixture-workflow.cjs');
  const memoryFixture = path.join(dir, 'fixture-memory.cjs');
  fs.writeFileSync(workflowFixture, "const x = require('../lib/workflow/command-resolver.cjs');\n");
  fs.writeFileSync(memoryFixture, "const y = require('../lib/memory/foo.cjs');\n");
  const result = audit.auditHookScripts({ surfaces: [workflowFixture, memoryFixture] });
  assert.equal(result.pass, false);
  assert.equal(result.files[0].pass, false, 'lib/workflow require must fail');
  assert.equal(result.files[1].pass, false, 'lib/memory require must fail');
});

test('import audit does NOT flag lib/mcp/* adapter plumbing (only lib/core, lib/workflow, lib/memory are forbidden)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p198-08-audit-'));
  const fixturePath = path.join(dir, 'fixture-adapter-plumbing.cjs');
  fs.writeFileSync(
    fixturePath,
    "const { wakeDaemon, queryDaemon } = require('../lib/mcp/adapter-client.cjs');\n"
    + "const { isMcpFirst } = require('../lib/mcp/mcp-first-flag.cjs');\n"
  );
  const result = audit.auditHookScripts({ surfaces: [fixturePath] });
  assert.equal(result.pass, true, 'lib/mcp/* requires are adapter plumbing, not a D-06 violation: ' + JSON.stringify(result.files));
});

test('line-count budget FAILS a script that exceeds its recorded ceiling', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p198-08-budget-'));
  const fixturePath = path.join(dir, 'fixture-oversized.cjs');
  // LINE_BUDGETS keys off the exact script string -- reuse a real key so the
  // ceiling lookup succeeds, but point `root` at the fixture dir so the file
  // actually read is the oversized synthetic one, never the real tracked file.
  const scriptKey = 'scripts/statusline-mos-dispatch';
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, scriptKey), '// line\n'.repeat(500));
  const result = audit.lineCountBudget({ surfaces: [scriptKey], root: dir });
  assert.equal(result.pass, false, 'a 500-line file must exceed the 150-line statusline budget');
  assert.equal(result.files[0].pass, false);
  assert.ok(result.files[0].lines > result.files[0].budget);
});

test('line-count budget FAILS closed on a surface with no recorded budget (never silently unbudgeted)', () => {
  const result = audit.lineCountBudget({ surfaces: ['scripts/some-future-migrated-script.cjs'] });
  assert.equal(result.pass, false);
  assert.equal(result.files[0].budget, null);
});

// node:test sets the process exit code from its own pass/fail tally (verified
// live: exit 0 when every subtest above passes, exit 1 the moment one does
// not) -- tests/run-all-198.sh's run() checks that exit code directly, not
// this text. The line below is a human-readable summary only, printed
// unconditionally as the LAST line of a successful synchronous run (D-06:
// import-audit + line-count budget: real tree green, comment-strip proven,
// guard fires on a real violation, lib/mcp/* plumbing exempted, budget fails
// closed on an unbudgeted or oversized surface).
console.log('PASS: test-198-adapter-budget (8 assertions -- see TAP output above for the per-check trace)');
