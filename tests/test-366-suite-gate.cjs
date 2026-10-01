'use strict';
/*
 * tests/test-366-suite-gate.cjs -- Phase 366 Plan 06 (EPV366-01, D-17).
 *
 * Proves scripts/release-lib/suite-gate.sh's mos_suite_gate hermetically and
 * pins its wiring into scripts/release.sh. The suite list is replaced through
 * MINDRIAN_RELEASE_SUITES (colon-separated) with stub scripts in a temp dir,
 * so this test NEVER runs the real tests/run-all-366.sh (which names this
 * file: running it here would recurse, T-366-24).
 *
 * Arms:
 *   G1. every suite exits 0 -> 0, one PASS line per suite
 *   G2. one suite exits 1 -> non-zero, a FAIL line naming that suite; a
 *       missing suite file also fails closed
 *   G3. dry-run + a failing suite -> 0, DRY RUN + FAIL still printed
 *   G4. no_check=1 -> 0, exactly one audited line naming --no-suite-check,
 *       and no suite is executed
 * Static legs over scripts/release.sh and the two libs: the default list is
 * tests/run-all-366.sh; both libs are sourced with a missing-file refusal;
 * both gates are called after the theo stamp gate; both flags appear in the
 * usage block and the case statement; dry-run never executes the suites
 * (doctor's release-dry-run-output budget is 30s, the aggregator is longer).
 *
 * House rule: hyphens only, no em-dashes.
 */

for (const k of ['CLAUDE_ACTIVE_ROOM', 'CLAUDE_CODE_SESSION_ID']) delete process.env[k];

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-suitegate-'));
process.env.HOME = TMP;
process.env.USERPROFILE = TMP;
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'rooms');

const REPO = path.resolve(__dirname, '..');
const GATE_LIB = path.join(REPO, 'scripts', 'release-lib', 'suite-gate.sh');
const SNAP_LIB = path.join(REPO, 'scripts', 'release-lib', 'canon-snapshot-gate.sh');
const RELEASE_SH = path.join(REPO, 'scripts', 'release.sh');

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

function stub(name, body) {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, '#!/usr/bin/env bash\n' + body + '\n');
  return p;
}

function runGate({ suites, dryRun, noCheck }) {
  const env = Object.assign({}, process.env, { MINDRIAN_RELEASE_SUITES: suites.join(':') });
  const script = '. "' + GATE_LIB + '"; mos_suite_gate "' + REPO + '" "' + (dryRun ? '1' : '0') + '" "' + (noCheck ? '1' : '0') + '"';
  const r = cp.spawnSync('bash', ['-c', script], { encoding: 'utf8', env: env, timeout: 30000 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function main() {
  console.log('test-366-suite-gate:');
  assert.ok(fs.existsSync(GATE_LIB), 'scripts/release-lib/suite-gate.sh must exist');

  const green = stub('green.sh', 'echo green-ran; exit 0');
  const green2 = stub('green2.sh', 'echo green2-ran; exit 0');
  const red = stub('red.sh', 'echo red-ran; echo "PASSED=1 FAILED=1"; exit 1');
  const marker = path.join(TMP, 'marker-ran');
  const sentinel = stub('sentinel.sh', 'touch "' + marker + '"; exit 1');

  // G1
  {
    const r = runGate({ suites: [green, green2] });
    assert.strictEqual(r.status, 0, 'G1 must exit 0; got ' + r.status + ' ' + r.stdout + r.stderr);
    const passLines = r.stdout.split('\n').filter((l) => /suite-gate: PASS/.test(l));
    assert.strictEqual(passLines.length, 2, 'G1 prints one PASS line per suite');
    assert.ok(r.stdout.indexOf('green.sh') !== -1 && r.stdout.indexOf('green2.sh') !== -1);
    ok('G1: every suite green returns 0 with one PASS line per suite');
  }

  // G2
  {
    const r = runGate({ suites: [green, red] });
    assert.notStrictEqual(r.status, 0, 'G2 must exit non-zero');
    assert.match(r.stdout, /FAIL/);
    assert.ok(/FAIL[^\n]*red\.sh/.test(r.stdout), 'G2 names the failing suite');
    const missing = runGate({ suites: [path.join(TMP, 'does-not-exist.sh')] });
    assert.notStrictEqual(missing.status, 0, 'G2 a missing suite fails closed');
    assert.match(missing.stdout, /missing/);
    ok('G2: a red or missing suite returns non-zero and names it');
  }

  // G3
  {
    const r = runGate({ suites: [red], dryRun: true });
    assert.strictEqual(r.status, 0, 'G3 dry-run must exit 0; got ' + r.status);
    assert.match(r.stdout, /DRY RUN/);
    assert.match(r.stdout, /FAIL/);
    ok('G3: under dry-run a failing suite reports and returns 0');
  }

  // G4
  {
    const r = runGate({ suites: [sentinel], noCheck: true });
    assert.strictEqual(r.status, 0, 'G4 opt-out must exit 0');
    assert.strictEqual(r.stdout.trim().split('\n').length, 1, 'G4 prints exactly one line');
    assert.match(r.stdout, /SKIPPED/);
    assert.match(r.stdout, /--no-suite-check/);
    assert.strictEqual(fs.existsSync(marker), false, 'G4 never executes a suite');
    ok('G4: --no-suite-check prints one audited line, runs nothing, returns 0');
  }

  // Static legs.
  const lib = fs.readFileSync(GATE_LIB, 'utf8');
  assert.match(lib, /RELEASE_GATE_SUITES=\(tests\/run-all-366\.sh\)/, 'the default suite list is tests/run-all-366.sh');
  assert.strictEqual((lib.match(/\bexit /g) || []).length, 0, 'suite-gate.sh never terminates the caller shell');
  const snapLib = fs.readFileSync(SNAP_LIB, 'utf8');
  for (const [label, text] of [['suite-gate.sh', lib], ['canon-snapshot-gate.sh', snapLib]]) {
    assert.ok(!/[–—]/.test(text), label + ' carries no em-dash or en-dash');
  }
  ok('static: default list is tests/run-all-366.sh, no exit in the lib, hyphens only');

  const rel = fs.readFileSync(RELEASE_SH, 'utf8');
  for (const libName of ['canon-snapshot-gate.sh', 'suite-gate.sh']) {
    assert.ok(rel.indexOf('if [ ! -f "$RELEASE_LIB_DIR/' + libName + '" ]; then') !== -1, 'release.sh refuses a missing ' + libName);
    assert.ok(rel.indexOf('. "$RELEASE_LIB_DIR/' + libName + '"') !== -1, 'release.sh sources ' + libName);
  }
  ok('static: release.sh sources both libs with a missing-file refusal');

  const theoIdx = rel.indexOf('if ! mos_theo_stamp_gate "$PLUGIN_DIR" "$DRY_RUN" "$NO_THEO_CHECK"; then');
  const snapIdx = rel.indexOf('if ! mos_canon_snapshot_gate "$PLUGIN_DIR" "$DRY_RUN" "$NO_CANON_SNAPSHOT_CHECK"; then');
  const suiteIdx = rel.indexOf('if ! mos_suite_gate "$PLUGIN_DIR" "$DRY_RUN" "$NO_SUITE_CHECK"; then');
  const step1Idx = rel.indexOf('# --- Step 1:');
  assert.ok(theoIdx !== -1 && snapIdx !== -1 && suiteIdx !== -1, 'release.sh calls all three gates');
  assert.ok(theoIdx < snapIdx && snapIdx < suiteIdx && suiteIdx < step1Idx, 'the two new gates run after the theo stamp gate and before Step 1');
  ok('static: release.sh calls both gates after the theo stamp gate, before Step 1');

  const usage = (rel.match(/^USAGE_BLOCK="[^\n]*"$/m) || [''])[0];
  for (const flag of ['--no-canon-snapshot-check', '--no-suite-check']) {
    assert.ok(usage.indexOf('[' + flag + ']') !== -1, 'usage block lists ' + flag);
    assert.ok(new RegExp('^\\s*' + flag.replace(/-/g, '\\-') + '\\)\\s+NO_[A-Z_]+=1 ;;', 'm').test(rel), 'case statement parses ' + flag);
  }
  assert.match(rel, /^NO_CANON_SNAPSHOT_CHECK=0/m);
  assert.match(rel, /^NO_SUITE_CHECK=0/m);
  ok('static: both flags appear in the usage block, the defaults and the case statement');

  // Under --dry-run release.sh previews the suite gate and never runs it.
  const suiteBlock = rel.slice(rel.lastIndexOf('# --- Step 0.6c', suiteIdx), suiteIdx + 200);
  assert.match(suiteBlock, /if \[ "\$DRY_RUN" = "1" \] && \[ "\$NO_SUITE_CHECK" != "1" \]; then/, 'release.sh has a dry-run preview branch for the suite gate');
  assert.match(suiteBlock, /suite-gate: would run/, 'the dry-run preview names what would run');
  ok('static: under --dry-run release.sh previews the suite gate without executing the aggregator');

  const help = cp.spawnSync('bash', [RELEASE_SH, '--help'], { encoding: 'utf8', timeout: 30000 });
  assert.strictEqual(help.status, 0, 'release.sh --help exits 0');
  assert.ok(help.stdout.indexOf('--no-canon-snapshot-check') !== -1 && help.stdout.indexOf('--no-suite-check') !== -1, '--help lists both flags');
  ok('static: release.sh --help lists both flags');

  console.log('');
  console.log(checks + ' checks passed.');
}

try {
  main();
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
