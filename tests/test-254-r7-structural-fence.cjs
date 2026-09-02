'use strict';
/*
 * Phase 254 Plan 06 -- the R7 structural fence.
 *
 * Turns 254-RESEARCH.md Section 4.3's planner fence into a test that FAILS the
 * build if it is ever broken, shaped like tests/test-reader-r4-structural-184.cjs:
 * a structural proof, not a behavioural one. Six arms, all operating on
 * comment-stripped source. No module under test is executed.
 *
 *   Arm 1 (engine purity): lib/core/navigation-engine.cjs carries ZERO
 *     executable occurrences of `brain-client` and ZERO of `chain-source`.
 *     decide() gained neither a wire nor this phase's blend seam.
 *   Arm 2 (projection-reader purity): decide-projection-reader.cjs,
 *     orchestration-candidate-lift.cjs and local-chain-recommender.cjs each
 *     carry ZERO executable occurrences of `brain-client`, `fetch(`,
 *     `require('node:http`, `require('node:https`, `require('http')`,
 *     `require('https')`.
 *   Arm 3 (unreachability of this phase's seam): none of the Arm 2 modules,
 *     and not navigation-engine.cjs, requires lib/workflow/chain-source.cjs.
 *   Arm 4 (planner fence honoured): every 254-*-PLAN.md in this phase
 *     directory is scanned; lib/core/navigation-engine.cjs appears in ZERO
 *     `files_modified` blocks. "No PLAN files found" is a FAILURE, not a pass
 *     (tests/run-all-262.sh's found-eq-0 doctrine).
 *   Arm 5 (decideFn seam is not a wire): scripts/act-command.cjs still
 *     requires navigation-engine.cjs lazily and still passes `decide` as
 *     runChain's decideFn -- a future reader must not "fix" the fence by
 *     deleting this legitimate, R7-clean seam (Phase 172-08).
 *   Arm 6 (chain-source is not a firer): lib/workflow/chain-source.cjs
 *     carries zero executable occurrences of the READER-04 firing-token set.
 *     It proposes; it never fires.
 *
 * Canon Part 8: no Brain / network call anywhere in this suite. This is a
 * structural proof over source text and PLAN frontmatter only.
 * Hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ENGINE_FILE = path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs');
const READER_FILE = path.join(REPO_ROOT, 'lib', 'core', 'reader', 'decide-projection-reader.cjs');
const LIFT_FILE = path.join(REPO_ROOT, 'lib', 'core', 'orchestration-candidate-lift.cjs');
const LOCAL_RECOMMENDER_FILE = path.join(REPO_ROOT, 'lib', 'workflow', 'local-chain-recommender.cjs');
const CHAIN_SOURCE_FILE = path.join(REPO_ROOT, 'lib', 'workflow', 'chain-source.cjs');
const ACT_COMMAND_FILE = path.join(REPO_ROOT, 'scripts', 'act-command.cjs');
const PHASE_DIR = process.env.TEST_254_R7_PLANDIR
  || path.join(REPO_ROOT, '.planning', 'phases', '254-orchestration-projection-consumption-wiring-suggest-next-act');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass += 1; }

// Copied verbatim from tests/test-reader-r4-structural-184.cjs: strip full-line
// comments so a header that NAMES a forbidden token in prose cannot self-trip
// the structural sweep (the grep-gate-hygiene rule -- not optional here, this
// file's own header names brain-client and fetch( in prose too).
function codeOf(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Arm 1: engine purity.
// ---------------------------------------------------------------------------
(function () {
  const code = codeOf(ENGINE_FILE);
  ok('R7 Arm1: navigation-engine.cjs carries zero executable occurrences of "brain-client"',
    code.indexOf('brain-client') === -1);
  ok('R7 Arm1: navigation-engine.cjs carries zero executable occurrences of "chain-source"',
    code.indexOf('chain-source') === -1);
})();

// ---------------------------------------------------------------------------
// Arm 2: the three modules decide()'s projection path actually reaches are
// wire-free.
// ---------------------------------------------------------------------------
const PROJECTION_PATH_FILES = [
  { label: 'decide-projection-reader.cjs', file: READER_FILE },
  { label: 'orchestration-candidate-lift.cjs', file: LIFT_FILE },
  { label: 'local-chain-recommender.cjs', file: LOCAL_RECOMMENDER_FILE },
];
const WIRE_TOKENS = [
  'brain-client',
  'fetch(',
  "require('node:http",
  "require('node:https",
  "require('http')",
  "require('https')",
];
(function () {
  for (const entry of PROJECTION_PATH_FILES) {
    const code = codeOf(entry.file);
    for (const tok of WIRE_TOKENS) {
      ok('R7 Arm2: ' + entry.label + ' carries no wire token: ' + tok, code.indexOf(tok) === -1);
    }
  }
})();

// ---------------------------------------------------------------------------
// Arm 3: this phase's new blend seam is unreachable from decide().
// ---------------------------------------------------------------------------
(function () {
  const targets = PROJECTION_PATH_FILES.concat([{ label: 'navigation-engine.cjs', file: ENGINE_FILE }]);
  for (const entry of targets) {
    const code = codeOf(entry.file);
    const re = /require\s*\(\s*[^)]*chain-source\.cjs[^)]*\)/;
    ok('R7 Arm3: ' + entry.label + ' does not require lib/workflow/chain-source.cjs',
      re.test(code) === false);
  }
})();

// ---------------------------------------------------------------------------
// Arm 4: the planner fence is auditable after the fact -- every 254-*-PLAN.md
// in this phase directory is scanned, and navigation-engine.cjs appears in
// ZERO files_modified blocks. "No PLAN files found" is a FAILURE.
// ---------------------------------------------------------------------------
(function () {
  let entries = [];
  try {
    entries = fs.readdirSync(PHASE_DIR);
  } catch (_e) {
    entries = [];
  }
  const planFiles = entries.filter(function (f) { return /^254-\d+-PLAN\.md$/.test(f); });

  ok('R7 Arm4: at least one 254-*-PLAN.md file was discovered under ' + PHASE_DIR
    + ' (found ' + planFiles.length + ')', planFiles.length > 0);

  if (planFiles.length > 0) {
    console.log('  R7 Arm4: scanned ' + planFiles.length + ' 254-*-PLAN.md file(s)');
  }

  let navEngineInFilesModified = false;
  for (const f of planFiles) {
    const raw = fs.readFileSync(path.join(PHASE_DIR, f), 'utf8');
    const m = raw.match(/^files_modified:\n((?:\s+-\s+.*\n)*)/m);
    const block = m ? m[1] : '';
    if (/lib\/core\/navigation-engine\.cjs/.test(block)) {
      navEngineInFilesModified = true;
    }
  }
  ok('R7 Arm4: lib/core/navigation-engine.cjs appears in zero files_modified blocks '
    + 'across this phase\'s own PLAN files', navEngineInFilesModified === false);
})();

// ---------------------------------------------------------------------------
// Arm 5: the decideFn seam (act-command.cjs feeding decide() as runChain's
// decideFn) is not a wire and must not be "fixed away".
// ---------------------------------------------------------------------------
(function () {
  const code = codeOf(ACT_COMMAND_FILE);
  ok('R7 Arm5: act-command.cjs still requires navigation-engine.cjs (lazily, for decideFn)',
    /require\s*\(\s*path\.join\([^)]*navigation-engine\.cjs[^)]*\)\s*\)/.test(code)
    || /require\s*\([^)]*navigation-engine\.cjs[^)]*\)/.test(code));
  ok('R7 Arm5: act-command.cjs still names decideFn as a key in the runChain options object',
    /decideFn\s*:/.test(code));
})();

// ---------------------------------------------------------------------------
// Arm 6: chain-source.cjs proposes; it never fires (READER-04 doctrine).
// ---------------------------------------------------------------------------
(function () {
  const code = codeOf(CHAIN_SOURCE_FILE);
  const FIRING_TOKENS = [
    'runChain',
    'chain-executor',
    'act-command',
    'framework-runner',
    'spawnSync',
    'execSync',
    'child_process',
  ];
  for (const tok of FIRING_TOKENS) {
    ok('R7 Arm6: chain-source.cjs carries no firing token: ' + tok, code.indexOf(tok) === -1);
  }
})();

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-254-r7-structural-fence.cjs: PASSED');
process.exit(0);
