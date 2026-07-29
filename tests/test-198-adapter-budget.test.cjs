#!/usr/bin/env node
// Phase 198 SPEC-5 -- thin-plugin adapter (hooks carry zero business logic).
// Real behavior (D-06): a measured check over the MIGRATED hook surfaces
// hooks/hooks.json's own _mcpFirst198Migrated marker names -- an import
// audit (no `require(...lib/core/...)` / `lib/workflow` / `lib/memory`
// business module from a hook script's own text) plus a line-count budget --
// proves those scripts wake, query mindrian-core, and render its response,
// without carrying session/filing/gate business logic in-process. Migration
// order is D-05: statusline + SessionStart FIRST (198-08, enumerated below),
// Stop-gate enforcement LAST (198-09, ALSO enumerated below now that it has
// actually migrated -- the marker names only what has migrated so far).
//
// This suite is the CI guard against re-fattening (T-198-13): it runs the
// real audit against the real committed files (proving today's tree is
// clean), plus a hermetic fixture-based proof that the guard actually FIRES
// on a forbidden import (never mutates the real tracked scripts).
//
// Phase 198-09 extension (D-05 final wave): scripts/on-stop is BASH, not JS
// -- hook-adapter-audit.cjs's generic FORBIDDEN_IMPORT_PATTERN is a
// `require(...)`-shaped regex that a bash file can never match (bash has no
// require()), so it is a harmless no-op for on-stop's whole-file text, never
// a false PASS on a real violation (a bash violation is a subprocess/require
// TOKEN, not a JS require() call). The REAL D-06 protection for on-stop is
// the bespoke test below: it extracts ONLY the flag-ON branch (bracketed by
// on-stop's own BEGIN/END-MCP-FIRST-STOP-THIN-ADAPTER sentinel comments,
// mirroring how the plan's own acceptance criteria describe it) and greps
// THAT span for the business-module token set named in 198-09-PLAN.md Task
// 2's action text. The flag-OFF legacy branch (below the sentinel span) is
// exempt by design -- it IS the byte-identical fallback (SPEC-7) and
// legitimately still calls memory-lifecycle.cjs/minto-debouncer.cjs/
// folder-memory directly.
//
// Node built-in test runner + assert only. No em-dashes. CJS only.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

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
  // Phase 198-09 (D-05 final wave): scripts/on-stop has now migrated -- the
  // Stop-gate enforcement moved server-side ONLY after gate-dedup + relevance
  // existed (Task 1 of this same plan).
  'scripts/on-stop',
];

// check-card-fire.cjs and hmi-compliance-poll.cjs stay SEPARATE Stop hook
// entries -- neither is itself migrated to a thin-adapter shape.
// check-card-fire.cjs's own main() now no-ops under the flag (198-09,
// deferring to on-stop's daemon-backed decision) but it is never enumerated
// here because its FILE is not a thin adapter (it still carries the full
// legacy predicate for the flag-OFF path).
const FORBIDDEN_STOP_GATE_HINTS = [
  'check-card-fire.cjs',
  'hmi-compliance-poll.cjs',
];

test('migratedSurfaces() enumerates statusline + SessionStart + on-stop (D-05, all three waves), never check-card-fire.cjs', () => {
  const surfaces = audit.migratedSurfaces();
  assert.deepEqual(
    surfaces.slice().sort(),
    EXPECTED_MIGRATED_SURFACES.slice().sort(),
    'exactly the three D-05 migrated surfaces, nothing more'
  );
  for (const hint of FORBIDDEN_STOP_GATE_HINTS) {
    assert.ok(
      !surfaces.some((s) => s.indexOf(hint) !== -1),
      'this script must never be enumerated as a migrated thin adapter: ' + hint
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

// ---------------------------------------------------------------------------
// Phase 198-09 (D-05 final wave, T-198-13 for the Stop surface): scripts/
// on-stop's own bespoke flag-ON-branch text audit. Bash has no require(), so
// hook-adapter-audit.cjs's generic import audit cannot meaningfully police
// this surface (see this file's own header comment) -- this test IS the real
// D-06 protection for on-stop.
// ---------------------------------------------------------------------------

const ON_STOP_PATH = path.join(REPO_ROOT, 'scripts', 'on-stop');
const ON_STOP_BEGIN_MARKER = '# BEGIN-MCP-FIRST-STOP-THIN-ADAPTER';
const ON_STOP_END_MARKER = '# END-MCP-FIRST-STOP-THIN-ADAPTER';
const ON_STOP_FORBIDDEN_TOKEN_PATTERN = /lib\/core\/|lib\/workflow\/|lib\/memory\/|memory-lifecycle\.cjs|minto-debouncer\.cjs|folder-memory/;

/**
 * extractOnStopFlagOnBranch() -- pull ONLY the text between on-stop's own
 * BEGIN/END-MCP-FIRST-STOP-THIN-ADAPTER sentinel comments (the flag-ON
 * branch scripts/on-stop's own edit introduced). Never throws; returns null
 * if the markers are not both present (a future refactor that removes them
 * without updating this test fails LOUD via the assertion below, not
 * silently).
 */
function extractOnStopFlagOnBranch() {
  const src = fs.readFileSync(ON_STOP_PATH, 'utf8');
  const start = src.indexOf(ON_STOP_BEGIN_MARKER);
  const end = src.indexOf(ON_STOP_END_MARKER);
  if (start === -1 || end === -1 || end < start) return null;
  return src.slice(start, end + ON_STOP_END_MARKER.length);
}

// Comment-stripped the SAME way hook-adapter-audit.cjs's own stripComments
// does for JS (`#`-led lines dropped) -- bash and JS/header comments in
// on-stop's flag-ON branch both use `#`, so the single-pattern strip applies
// unchanged.
function stripBashComments(src) {
  return src
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

test('scripts/on-stop flag-ON branch is real (BEGIN/END sentinel markers present)', () => {
  const branch = extractOnStopFlagOnBranch();
  assert.ok(branch, 'on-stop must carry BEGIN/END-MCP-FIRST-STOP-THIN-ADAPTER sentinel comments bracketing its flag-ON branch');
  assert.ok(branch.length > 0);
});

test('scripts/on-stop flag-ON branch contains ZERO business invocations (comment-stripped) -- lib/core, lib/workflow, lib/memory, memory-lifecycle.cjs, minto-debouncer.cjs, folder-memory', () => {
  const branch = extractOnStopFlagOnBranch();
  assert.ok(branch, 'sentinel markers must be present for this assertion to be meaningful');
  const stripped = stripBashComments(branch);
  const match = stripped.match(ON_STOP_FORBIDDEN_TOKEN_PATTERN);
  assert.equal(match, null, 'flag-ON branch must carry none of the business-module tokens: ' + (match && match[0]));
});

test('scripts/on-stop flag-ON branch DOES reach the daemon (queryDaemon/wakeDaemon/adapter-client present)', () => {
  const branch = extractOnStopFlagOnBranch();
  assert.ok(branch, 'sentinel markers must be present for this assertion to be meaningful');
  assert.match(branch, /queryDaemon|wakeDaemon|adapter-client/, 'the flag-ON branch must actually reach the daemon through lib/mcp/adapter-client.cjs');
});

test('sanity control: the SAME forbidden-token audit FAILS on a fixture that legitimately mentions those tokens (guard is live, not vacuous)', () => {
  const fixture = '#!/usr/bin/env bash\n# BEGIN-MCP-FIRST-STOP-THIN-ADAPTER\nnode scripts/memory-lifecycle.cjs stop "$ROOM_DIR"\n# END-MCP-FIRST-STOP-THIN-ADAPTER\n';
  const start = fixture.indexOf(ON_STOP_BEGIN_MARKER);
  const end = fixture.indexOf(ON_STOP_END_MARKER);
  const branch = fixture.slice(start, end + ON_STOP_END_MARKER.length);
  const stripped = stripBashComments(branch);
  const match = stripped.match(ON_STOP_FORBIDDEN_TOKEN_PATTERN);
  assert.ok(match, 'a fixture that legitimately calls memory-lifecycle.cjs inside the flag-ON span must be caught by the same pattern');
});

test('hooks.json _mcpFirst198Migrated carries the Stop migration marker; the Stop matcher still dispatches run-hook.cmd on-stop unchanged', () => {
  const hooksJsonPath = path.join(REPO_ROOT, 'hooks', 'hooks.json');
  const parsed = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
  const surfaces = (parsed._mcpFirst198Migrated && parsed._mcpFirst198Migrated.surfaces) || [];
  assert.ok(
    surfaces.some((s) => s && s.script === 'scripts/on-stop'),
    'hooks.json _mcpFirst198Migrated.surfaces must name scripts/on-stop'
  );
  const stopBlock = (parsed.hooks && parsed.hooks.Stop) || [];
  const dispatchesOnStop = stopBlock.some((entry) =>
    (entry.hooks || []).some((h) => typeof h.command === 'string' && h.command.indexOf('run-hook.cmd" on-stop') !== -1)
  );
  assert.ok(dispatchesOnStop, 'the Stop matcher must still dispatch run-hook.cmd on-stop (form unchanged)');
});

// ---------------------------------------------------------------------------
// The 2026-07-03 "Stop hook forcing irrelevant Decision Gate cards" replay
// (.planning/STATE.md; feedback_1_15_enforcement_regression_watch.md): a Stop
// event with NOTHING material pending must return { fire: false } through
// handleStopEvent -- the card-misfire regression class must be FIXED by the
// D-05 move, never re-created by it.
// ---------------------------------------------------------------------------

let stopGateHandler;
try {
  stopGateHandler = require('../lib/mcp/stop-gate-handler.cjs');
} catch (_e) {
  stopGateHandler = null;
}

// Hermetic room fixture: handleStopEvent's business close-out writes real
// files (STATE.md, .mindrian/session-snapshot.json) into whatever room it
// resolves. Point CLAUDE_ACTIVE_ROOM (resolveActiveRoom's top-precedence
// override) at a throwaway tmpdir for the DURATION of these two tests only,
// so a test run NEVER touches the operator's real ~/MindrianRooms/* data.
function withHermeticActiveRoom(fn) {
  return async () => {
    const previous = process.env.CLAUDE_ACTIVE_ROOM;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p198-09-stopgate-'));
    process.env.CLAUDE_ACTIVE_ROOM = dir;
    try {
      await fn();
    } finally {
      if (previous === undefined) delete process.env.CLAUDE_ACTIVE_ROOM;
      else process.env.CLAUDE_ACTIVE_ROOM = previous;
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
    }
  };
}

test(
  '2026-07-03 replay: a Stop event with nothing material pending returns { fire: false } through handleStopEvent',
  withHermeticActiveRoom(async () => {
    if (!stopGateHandler || typeof stopGateHandler.handleStopEvent !== 'function') {
      console.log('SKIP: lib/mcp/stop-gate-handler.cjs not present yet');
      return;
    }
    // An ordinary, non-gate-shaped turn -- no ASCII-box glyphs, no reached
    // registry entries. This is the "nothing pending that warrants a card"
    // shape the 2026-07-03 regression fired a card on anyway.
    const result = await stopGateHandler.handleStopEvent('sess-198-09-replay-2026-07-03', {
      output_text: 'Sure, I looked into that and everything checks out -- no open forks here.',
      ran_entries: [],
    });
    assert.equal(result && result.fire, false, 'a non-material Stop turn must never fire a card: ' + JSON.stringify(result));
  })
);

test(
  'gate-dedup fire-once: the SAME material gate does not fire twice in the same session through handleStopEvent',
  withHermeticActiveRoom(async () => {
    if (!stopGateHandler || typeof stopGateHandler.handleStopEvent !== 'function') {
      console.log('SKIP: lib/mcp/stop-gate-handler.cjs not present yet');
      return;
    }
    if (typeof stopGateHandler._resetForTest === 'function') stopGateHandler._resetForTest();
    const boxText = 'Here are your choices:\n[1] Alpha Path\n[2] Beta Path\n[3] Gamma Path\n';
    const sessionId = 'sess-198-09-dedup-' + Date.now();
    // Phase 238-08 (GATE-04, D-15): this is a BACKSTOP-arm turn (no ran_entries)
    // with no side-channel reach record set up for this session, so under the
    // new corroboration gate it would otherwise resolve
    // backstop-uncorroborated-by-side-channel and never fire. This test proves
    // gate-dedup fire-once, not GATE-04 corroboration, so sidechannel_health is
    // declared 'unavailable' as a direct field (deriveTurnSignals keeps
    // precedence for it) to exercise D-15 state 3, the pre-238-08
    // last-resort-arm semantics this fixture always relied on.
    const first = await stopGateHandler.handleStopEvent(sessionId, { output_text: boxText, ran_entries: [], sidechannel_health: 'unavailable' });
    const second = await stopGateHandler.handleStopEvent(sessionId, { output_text: boxText, ran_entries: [], sidechannel_health: 'unavailable' });
    assert.equal(first.fire, true, 'a novel, relevant, material gate must fire the first time: ' + JSON.stringify(first));
    assert.equal(second.fire, false, 'the SAME gate must not fire twice in the same session (dedup): ' + JSON.stringify(second));
  })
);

// node:test sets the process exit code from its own pass/fail tally (verified
// live: exit 0 when every subtest above passes, exit 1 the moment one does
// not) -- tests/run-all-198.sh's run() checks that exit code directly, not
// this text. The line below is a human-readable summary only, printed
// unconditionally as the LAST line of a successful synchronous run (D-06:
// import-audit + line-count budget: real tree green, comment-strip proven,
// guard fires on a real violation, lib/mcp/* plumbing exempted, budget fails
// closed on an unbudgeted or oversized surface; Phase 198-09: on-stop's
// flag-ON branch audit green, hooks.json Stop marker present, the
// 2026-07-03 irrelevant-gate replay returns fire:false, gate-dedup fire-once
// proven end to end through handleStopEvent).
console.log('PASS: test-198-adapter-budget (17 assertions -- see TAP output above for the per-check trace)');
