#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 254 Plan 02 Task 1 -- WIRE-03 one-source RED suite.
 *
 * Proves the two command surfaces (scripts/suggest-next-command.cjs,
 * scripts/act-command.cjs) cannot disagree because they call the SAME chain-
 * selection seam (lib/workflow/chain-source.cjs::resolveChainSource) and
 * print the SAME disclosure string (describeSource). Arm 1 is the
 * load-bearing structural proof: it scans comment-stripped source across the
 * whole tree and asserts the IDENTITY of the single remaining non-owner
 * caller of recommendFrameworkChain(, never a bare count.
 *
 * Before Task 2/3 land, both scripts still call recommendFrameworkChain(
 * directly and print no "Chain source:" line -- Arms 1-4 fail RED here,
 * which is the honest baseline this suite is supposed to prove. Every
 * assertion runs through the test() wrapper (mirrors
 * tests/test-254-projection-chain-source.cjs) so one failing arm does not
 * kill the process -- the suite always runs to completion and reports every
 * arm, exiting non-zero only if at least one test() failed.
 *
 * Deviation note (Rule 1): the plan's Arm 1 text names an "exactly ONE
 * non-owner caller" repo-wide premise. Live scan found a THIRD non-owner
 * caller the plan did not name: scripts/pipeline-command.cjs (/mos:pipeline,
 * line 241) -- outside this plan's file scope and outside WIRE-03 (which
 * names only suggest-next and act). Arm 1 below asserts against a named
 * ALLOWED set instead of a bare count, so the structural guarantee still
 * fails on any UNEXPECTED new caller while staying truthful about the
 * pre-existing, out-of-scope one.
 *
 * Only node:assert, node:fs, node:path, node:child_process. Zero Brain,
 * zero network, zero room fixtures. Hyphens only, no em-dashes.
 *
 * Run: node tests/test-254-one-chain-source.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SUGGEST_NEXT = path.join(REPO_ROOT, 'scripts', 'suggest-next-command.cjs');
const ACT_COMMAND = path.join(REPO_ROOT, 'scripts', 'act-command.cjs');
const CHAIN_SOURCE = path.join(REPO_ROOT, 'lib', 'workflow', 'chain-source.cjs');
const CHAIN_RECOMMENDER = path.join(REPO_ROOT, 'lib', 'brain', 'chain-recommender.cjs');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'scripts');
const WORKFLOW_DIR = path.join(REPO_ROOT, 'lib', 'workflow');

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    process.stdout.write('  ok    ' + name + '\n');
    pass += 1;
  } catch (e) {
    process.stdout.write('  FAIL  ' + name + ' -- ' + (e && e.message ? e.message : String(e)) + '\n');
    fail += 1;
  }
}

// Strip full-line comments so a header naming recommendFrameworkChain in
// prose cannot self-trip the structural sweep (tests/test-reader-r4-structural-184.cjs
// convention, reused verbatim).
function codeOf(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); })
    .join('\n');
}

function walkFiles(dir, exts) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { out.push(...walkFiles(full, exts)); continue; }
    if (exts.some(function (ext) { return e.name.endsWith(ext); })) out.push(full);
  }
  return out;
}

// Guarded spawn: never let a hung or erroring child throw past this helper.
// A failed spawn is reported by the caller's own assertion, not by an
// uncaught throw that would kill the whole suite (the same honest-RED
// discipline Plan 01 Task 1 used).
function spawnScript(scriptPath, args) {
  try {
    const stdout = execFileSync(process.execPath, [scriptPath, ...args], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      timeout: 15000,
    });
    return { ok: true, stdout, stderr: '' };
  } catch (err) {
    return {
      ok: false,
      stdout: (err && typeof err.stdout === 'string') ? err.stdout : '',
      stderr: (err && typeof err.stderr === 'string') ? err.stderr : '',
      error: err,
    };
  }
}

function extractChainSourceLine(stdout) {
  const m = /^\s*Chain source: .*$/m.exec(stdout || '');
  return m ? m[0].trim() : null;
}

// ---------------------------------------------------------------------------
// Arm 1: structural single-caller proof (the load-bearing WIRE-03 arm).
// ---------------------------------------------------------------------------
const suggestCode = codeOf(SUGGEST_NEXT);
const actCode = codeOf(ACT_COMMAND);

test('Arm1: suggest-next-command.cjs has zero recommendFrameworkChain( occurrences', function () {
  assert.equal(/recommendFrameworkChain\(/.test(suggestCode), false);
});
test('Arm1: suggest-next-command.cjs has at least one resolveChainSource( occurrence', function () {
  assert.equal(/resolveChainSource\(/.test(suggestCode), true);
});
test('Arm1: act-command.cjs has zero recommendFrameworkChain( occurrences', function () {
  assert.equal(/recommendFrameworkChain\(/.test(actCode), false);
});
test('Arm1: act-command.cjs has at least one resolveChainSource( occurrence', function () {
  assert.equal(/resolveChainSource\(/.test(actCode), true);
});

// Repo-wide comment-stripped scan of scripts/ and lib/workflow/ for an
// executable recommendFrameworkChain( call. The owner module
// (lib/brain/chain-recommender.cjs) is excluded from this scan entirely --
// it is outside scripts/ and lib/workflow/.
//
// Deviation note (Rule 1, stale plan premise, live-measured this task):
// scripts/pipeline-command.cjs (the /mos:pipeline helper, line 241) is a
// THIRD non-owner caller of recommendFrameworkChain( that the plan's Arm 1
// text did not name -- its "exactly ONE file" premise predates this scan.
// pipeline-command.cjs is outside this plan's <files> scope (only
// scripts/suggest-next-command.cjs and scripts/act-command.cjs are wired
// here; WIRE-03 names only suggest-next and act, never /mos:pipeline) and
// stays untouched. The structural proof is therefore scoped to an explicit,
// named ALLOWED set rather than a bare repo-wide count: after Task 2/3,
// the ONLY non-owner callers anywhere under scripts/ + lib/workflow/ must be
// EXACTLY {lib/workflow/chain-source.cjs, scripts/pipeline-command.cjs} --
// asserted by identity (a Set-equality check), not a count literal, so any
// UNEXPECTED fourth caller (a regression) still fails this arm.
const ALLOWED_NON_OWNER_CALLERS = new Set([
  path.resolve(CHAIN_SOURCE),
  path.resolve(SCRIPTS_DIR, 'pipeline-command.cjs'),
]);
const candidateFiles = [
  ...walkFiles(SCRIPTS_DIR, ['.cjs', '.js']),
  ...walkFiles(WORKFLOW_DIR, ['.cjs', '.js']),
];
const callers = [];
for (const f of candidateFiles) {
  if (path.resolve(f) === path.resolve(CHAIN_RECOMMENDER)) continue; // owner, excluded by design
  let code;
  try { code = codeOf(f); } catch (_e) { continue; }
  if (/recommendFrameworkChain\(/.test(code)) callers.push(path.resolve(f));
}
test('Arm1: every non-owner caller of recommendFrameworkChain( under scripts/ + lib/workflow/ is in the named allowed set', function () {
  const unexpected = callers.filter(function (c) { return !ALLOWED_NON_OWNER_CALLERS.has(c); });
  assert.deepEqual(unexpected, [], 'unexpected callers: ' + JSON.stringify(unexpected.map((f) => path.relative(REPO_ROOT, f))));
});
test('Arm1: scripts/suggest-next-command.cjs and scripts/act-command.cjs are NOT in the caller set (identity, not count)', function () {
  const relCallers = callers.map(function (c) { return path.relative(REPO_ROOT, c); });
  assert.equal(relCallers.includes('scripts/suggest-next-command.cjs'), false);
  assert.equal(relCallers.includes('scripts/act-command.cjs'), false);
});
test('Arm1: lib/workflow/chain-source.cjs IS in the caller set (the ONE seam suggest-next and act both route through)', function () {
  assert.equal(callers.includes(path.resolve(CHAIN_SOURCE)), true);
});

// ---------------------------------------------------------------------------
// Arm 2: behavioural agreement, projection case.
// ---------------------------------------------------------------------------
(function arm2() {
  const suggestRun = spawnScript(SUGGEST_NEXT, ['--from-framework', 'S-Curve Analysis']);
  const actRun = spawnScript(ACT_COMMAND, ['--chain', '--from-framework', 'S-Curve Analysis']);

  test('Arm2: suggest-next spawn succeeded', function () { assert.equal(suggestRun.ok, true); });
  test('Arm2: act spawn succeeded', function () { assert.equal(actRun.ok, true); });

  const expectedLine = 'Chain source: projection (1-hop path, composed confidence 0.82)';
  const suggestLine = extractChainSourceLine(suggestRun.stdout);
  const actLine = extractChainSourceLine(actRun.stdout);

  test('Arm2: suggest-next stdout carries the expected projection Chain source line', function () {
    assert.equal(suggestLine, expectedLine);
  });
  test('Arm2: act stdout carries the expected projection Chain source line', function () {
    assert.equal(actLine, expectedLine);
  });
  test('Arm2: the two trimmed Chain source lines are byte-identical', function () {
    assert.notEqual(suggestLine, null);
    assert.equal(suggestLine, actLine);
  });

  test('Arm2: suggest-next stdout names Adoption-Capacity Theory', function () {
    assert.match(suggestRun.stdout || '', /Adoption-Capacity Theory/);
  });
  test('Arm2: act stdout names Adoption-Capacity Theory', function () {
    assert.match(actRun.stdout || '', /Adoption-Capacity Theory/);
  });
})();

// ---------------------------------------------------------------------------
// Arm 3: behavioural agreement, floor case.
// ---------------------------------------------------------------------------
(function arm3() {
  const suggestRun = spawnScript(SUGGEST_NEXT, ['--problem-type', 'ill-defined']);
  const actRun = spawnScript(ACT_COMMAND, ['--chain', '--problem-type', 'ill-defined']);

  test('Arm3: suggest-next spawn succeeded', function () { assert.equal(suggestRun.ok, true); });
  test('Arm3: act spawn succeeded', function () { assert.equal(actRun.ok, true); });

  const expectedLine = 'Chain source: registry floor (the projection carries no chain edge for "Beautiful Question Framework")';
  const suggestLine = extractChainSourceLine(suggestRun.stdout);
  const actLine = extractChainSourceLine(actRun.stdout);

  test('Arm3: suggest-next stdout carries the expected registry-floor Chain source line', function () {
    assert.equal(suggestLine, expectedLine);
  });
  test('Arm3: act stdout carries the expected registry-floor Chain source line', function () {
    assert.equal(actLine, expectedLine);
  });
  test('Arm3: the two trimmed Chain source lines are byte-identical', function () {
    assert.notEqual(suggestLine, null);
    assert.equal(suggestLine, actLine);
  });

  test('Arm3: suggest-next stdout is non-empty', function () {
    assert.equal((suggestRun.stdout || '').length > 0, true);
  });
  test('Arm3: act stdout is non-empty', function () {
    assert.equal((actRun.stdout || '').length > 0, true);
  });
  test('Arm3: suggest-next stdout does not contain "could not be"', function () {
    assert.equal(/could not be/.test(suggestRun.stdout || ''), false);
  });
  test('Arm3: act stdout does not contain "could not be"', function () {
    assert.equal(/could not be/.test(actRun.stdout || ''), false);
  });
})();

// ---------------------------------------------------------------------------
// Arm 4: the promise finally holds -- a second numbered step exists.
// ---------------------------------------------------------------------------
(function arm4() {
  const suggestRun = spawnScript(SUGGEST_NEXT, ['--from-framework', 'S-Curve Analysis']);
  test('Arm4: suggest-next spawn succeeded', function () { assert.equal(suggestRun.ok, true); });
  test('Arm4: suggest-next stdout matches a second numbered step (/^\\s+2\\. /m)', function () {
    assert.match(suggestRun.stdout || '', /^\s+2\. /m);
  });
})();

// ---------------------------------------------------------------------------
// Arm 5: never empty, all four paths (suggest-next only).
// ---------------------------------------------------------------------------
(function arm5() {
  const cases = [
    ['--problem-type', 'ill-defined'],
    ['--problem-type', 'undefined'],
    ['--problem-type', 'well-defined'],
    [],
  ];
  for (const args of cases) {
    const label = args.length > 0 ? args.join(' ') : '(no flags)';
    const run = spawnScript(SUGGEST_NEXT, args);
    test('Arm5: suggest-next ' + label + ' spawn exits 0', function () {
      assert.equal(run.ok, true);
    });
    test('Arm5: suggest-next ' + label + ' stdout carries "Recommended framework chain:"', function () {
      assert.match(run.stdout || '', /Recommended framework chain:/);
    });
    const lines = (run.stdout || '').split(/\r?\n/);
    const chainHeaderIdx = lines.findIndex(function (l) { return /Recommended framework chain:/.test(l); });
    const chainLine = chainHeaderIdx >= 0 ? (lines[chainHeaderIdx + 1] || '') : '';
    test('Arm5: suggest-next ' + label + ' chain line is non-empty', function () {
      assert.equal(chainLine.trim().length > 0, true);
    });
    const chainSourceMatches = (run.stdout || '').match(/^\s*Chain source: .*$/mg) || [];
    test('Arm5: suggest-next ' + label + ' has exactly one Chain source: line', function () {
      assert.equal(chainSourceMatches.length, 1);
    });
  }
})();

// ---------------------------------------------------------------------------
// Arm 6: exit-code contract preserved -- every spawn above exits 0.
// ---------------------------------------------------------------------------
(function arm6() {
  const runs = [
    ['suggest-next --from-framework S-Curve Analysis', spawnScript(SUGGEST_NEXT, ['--from-framework', 'S-Curve Analysis'])],
    ['suggest-next --problem-type ill-defined', spawnScript(SUGGEST_NEXT, ['--problem-type', 'ill-defined'])],
    ['act --chain --from-framework S-Curve Analysis', spawnScript(ACT_COMMAND, ['--chain', '--from-framework', 'S-Curve Analysis'])],
    ['act --chain --problem-type ill-defined', spawnScript(ACT_COMMAND, ['--chain', '--problem-type', 'ill-defined'])],
  ];
  for (const [label, run] of runs) {
    test('Arm6: spawn (' + label + ') exits 0 (never throws to the user)', function () {
      assert.equal(run.ok, true);
    });
  }
})();

// ---------------------------------------------------------------------------
// Arm 7: R4 one door intact -- the wiring swapped an INPUT, not an
// architecture.
// ---------------------------------------------------------------------------
test('Arm7: suggest-next-command.cjs still contains composeWorkflow(', function () {
  assert.match(suggestCode, /composeWorkflow\(/);
});
test('Arm7: act-command.cjs still contains composeWorkflow(', function () {
  assert.match(actCode, /composeWorkflow\(/);
});
test('Arm7: act-command.cjs still contains postureForCommand', function () {
  assert.match(actCode, /postureForCommand/);
});
test('Arm7: act-command.cjs still contains runChain(', function () {
  assert.match(actCode, /runChain\(/);
});

process.stdout.write('\n' + pass + ' passed, ' + fail + ' failed.\n');
process.exit(fail === 0 ? 0 : 1);
