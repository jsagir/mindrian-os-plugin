#!/usr/bin/env node
'use strict';

/*
 * Phase 126 Plan-01 Task 1 -- /mos:doctor --fix renderer contract test.
 *
 * Closes the dogfood finding (3a) from 126-FEEDBACK-2026-05-13-windows-dogfood.md:
 *   `doctor --fix` printed `-- doctor -- recovered --` header but OMITTED the
 *   `✓ recovered to <version>` line AND the `backup <path>` line documented in
 *   commands/doctor.md Step 3. The summary also said `1 drift / 0 warnings`
 *   even though the header said `recovered`.
 *
 * Renderer contract is loaded from commands/doctor.md (the SINGLE source of
 * truth) -- not duplicated in this test file. The "Example output (recovered)"
 * block is the contract; this test extracts it and asserts the live renderer
 * matches.
 *
 * Seven sub-tests:
 *
 *   Test 1  contract-extract   loads commands/doctor.md, finds the "Example
 *                              output (recovered)" block, asserts both required
 *                              line patterns are present in the source-of-truth
 *                              (`✓ recovered to .+` and `backup .+`). FAILS LOUD
 *                              if the contract source has drifted away from
 *                              those patterns.
 *
 *   Test 2  scaffold           scaffold a missing-install state in a hermetic
 *                              HOME -- marketplace cache at
 *                              ~/.claude/plugins/cache/mindrian-marketplace/mos/
 *                              1.13.0-beta.99/.claude-plugin/plugin.json exists;
 *                              ~/.claude/plugins/mindrian-os/ DOES NOT (the
 *                              missing-install case from Phase 95.2 D-05).
 *
 *   Test 3  exit-code-2        `doctor --fix` exits with code 2 (drift
 *                              detected and recovered, per
 *                              commands/doctor.md "Exit codes" table).
 *
 *   Test 4  recovered-line     stdout contains `✓ recovered to 1.13.0-beta.99`.
 *                              (RED until Task 2 lands the renderer fix; the
 *                              current renderer routes through the
 *                              `cannot read state` branch when installResult
 *                              .status === 'missing' and never emits this
 *                              line.)
 *
 *   Test 5  backup-line        stdout contains `backup ` followed by an
 *                              absolute path containing `mindrian-os.stale-`
 *                              + a timestamp. Note: in the missing-install
 *                              case `performRecoveryAtomic` returns
 *                              backup=null (nothing was renamed) -- but per
 *                              the renderer contract the line is emitted
 *                              WHEN a backup exists. This test asserts the
 *                              contract for the recovery-with-backup case
 *                              by ALSO covering the drift-detected (existing
 *                              live install with stale version) scenario.
 *
 *   Test 6  summary-semantics  Summary line is semantically consistent with
 *                              the recovered header. Specifically: the line
 *                              MUST NOT contain `1 drift / 0 warnings`. The
 *                              test accepts EITHER (a) `0 drift / 0 warnings`
 *                              (Option A: drift count decremented after
 *                              recovery, per commands/doctor.md example), OR
 *                              (b) `1 recovered` alongside `0 drift`
 *                              (Option B: explicit recovered tally).
 *
 *   Test 7  idempotency        Re-run `doctor --fix` against the now-recovered
 *                              state. Exit 0 (healthy); no `recovered to` line
 *                              emitted (idempotency).
 *
 * Hermetic envelope: per-test mkdtempSync HOME + USERPROFILE +
 * MINDRIAN_PLUGIN_HOME override so the detector reads scratch
 * ~/.claude/plugins. Mirrors tests/test-doctor-class-i.cjs makeTmpHome and
 * tests/test-doctor-acceptance.cjs MINDRIAN_PLUGIN_HOME pattern.
 *
 * Registered in tests/run-all-126.sh as a CJS suite entry.
 *
 * RED until Phase 126 Plan-01 Task 2 fixes the renderer in scripts/doctor.cjs.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');
const CONTRACT_DOC = path.join(REPO_ROOT, 'commands', 'doctor.md');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) {
  failed += 1;
  console.log('FAIL: ' + name + '\n    ' + (err && err.message || err));
}

// -- Hermetic envelope helpers (mirrors test-doctor-class-i.cjs) ----------

function makeTmpHome(suffix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-render-' + suffix + '-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'plugins'), { recursive: true });
  return tmp;
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

// Lay down a synthetic marketplace-cache install at
// <home>/.claude/plugins/cache/mindrian-marketplace/mos/<version>/.
function makeMarketplaceCache(home, version) {
  const cacheDir = path.join(home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', version);
  fs.mkdirSync(path.join(cacheDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos', version }, null, 2)
  );
  // Mirror file (so subsequent doctor reads see a "valid" cache).
  fs.mkdirSync(path.join(cacheDir, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'bin', 'cli.js'), '#!/usr/bin/env node\n');
  return cacheDir;
}

// Lay down a synthetic live install at ~/.claude/plugins/mindrian-os/ (used by
// Test 5's backup-line scenario where an OLDER version sits in install and a
// NEWER version sits in the marketplace cache -- the recovery path that
// actually produces a backup).
function makeLiveInstall(home, version) {
  const installDir = path.join(home, '.claude', 'plugins', 'mindrian-os');
  fs.mkdirSync(path.join(installDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(installDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos', version }, null, 2)
  );
  return installDir;
}

// Strip ANSI escape codes so regex matches survive color output.
// Covers both `[NNm` (ESC bracket) and the literal `[NNm` fallback some
// terminals emit; doctor.cjs uses ESC bracket.
function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return (s || '').replace(/\[[0-9;]*m/g, '');
}

function runDoctor(home, extraArgs) {
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_PLUGIN_HOME: path.join(home, '.claude', 'plugins'),
  });
  // Force CLI surface so non-TTY child spawn does not fall back to DESKTOP.
  if (!env.MINDRIAN_STATUSLINE_SURFACE) env.MINDRIAN_STATUSLINE_SURFACE = 'CLI';
  // Debug session doctor-class-a-drift-topology-blind-false-positive (2026-05-31):
  // class A drift + the --fix recovery gate are now topology-guarded -- they fire
  // ONLY when resolveActivePluginRoot().topology !== 'marketplace-cache'. This
  // renderer-contract suite exercises the LEGACY-dir recovery path (--fix recreating
  // ~/.claude/plugins/mindrian-os from the cache). Pin MINDRIAN_OS_ROOT at the legacy
  // path so the resolver classifies a non-marketplace-cache (dev-clone) topology --
  // the class where legacy recovery legitimately stays active -- instead of seeing the
  // scratch cache-only tree as marketplace-cache (which would correctly suppress the
  // legacy recreation under the fix). The renderer contract is unchanged; only the
  // topology context that triggers it is pinned, keeping the test hermetic.
  env.MINDRIAN_OS_ROOT = path.join(home, '.claude', 'plugins', 'mindrian-os');
  delete env.CLAUDE_DESKTOP;
  const args = [DOCTOR].concat(extraArgs || []);
  const r = spawnSync('node', args, { env, encoding: 'utf8', timeout: 30000 });
  return { r, stdoutClean: stripAnsi(r.stdout || '') };
}

// -- Test 1: contract-extract --------------------------------------------
// Load commands/doctor.md, find the "Example output (recovered)" code block,
// assert both required line patterns are present.
let CONTRACT = null;   // { recoveredLineRegex, backupLineRegex, sourceBlock }
try {
  assert.ok(fs.existsSync(CONTRACT_DOC), 'commands/doctor.md exists at ' + CONTRACT_DOC);
  const docSrc = fs.readFileSync(CONTRACT_DOC, 'utf8');

  // The contract block in commands/doctor.md is fenced as:
  //   ## Example output (recovery successful)
  //   ```
  //   ...example body with `✓ recovered to <version>` and `backup <path>`...
  //   ```
  // Find this section, then extract the FIRST code block within it.
  // Match the section body up to the NEXT `## ` heading or end-of-file.
  // Note: JS regex has no `\Z` for end-of-string; use `$` with the multi-flag
  // alternation `\n## ` OR document end-of-string `$(?![\s\S])`.
  const sectionMatch = docSrc.match(/##\s+Example output \(recovery successful\)([\s\S]*?)(?=\n##\s|$(?![\s\S]))/);
  assert.ok(
    sectionMatch,
    'commands/doctor.md must contain a "## Example output (recovery successful)" section'
  );
  const sectionBody = sectionMatch[1];
  const codeBlockMatch = sectionBody.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  assert.ok(
    codeBlockMatch,
    'commands/doctor.md "Example output (recovery successful)" section must contain a fenced code block'
  );
  const block = codeBlockMatch[1];

  // Both required line patterns. RegExp.exec MUST succeed against the
  // contract source -- if either fails, the contract source has drifted
  // and this test FAILS LOUD (which is the intended cross-drift guard
  // per Plan 01 must_haves.truths[3]: "commands/doctor.md Step 3 is the
  // SINGLE source-of-truth for the renderer contract").
  const recoveredLineRegex = /✓\s+recovered to\s+(\S+)/;
  const backupLineRegex = /backup\s+(\S+)/;
  assert.ok(
    recoveredLineRegex.test(block),
    'contract block in commands/doctor.md must contain a `✓ recovered to <version>` line; got block:\n' + block
  );
  assert.ok(
    backupLineRegex.test(block),
    'contract block in commands/doctor.md must contain a `backup <path>` line; got block:\n' + block
  );

  // Surface the regexes for the live-renderer assertions below.
  CONTRACT = {
    recoveredLineRegex: recoveredLineRegex,
    backupLineRegex: backupLineRegex,
    sourceBlock: block,
  };
  pass('Test 1 (contract-extract: both line patterns present in commands/doctor.md source)');
} catch (err) {
  failTest('Test 1 (contract-extract)', err);
}

// Guard: if Test 1 failed, the downstream live tests still run -- they assert
// the live renderer output independently. CONTRACT is still useful: fall back
// to inline regexes so the live tests continue to assert SOMETHING.
const RECOVERED_RE = (CONTRACT && CONTRACT.recoveredLineRegex) || /✓\s+recovered to\s+(\S+)/;
const BACKUP_RE = (CONTRACT && CONTRACT.backupLineRegex) || /backup\s+(\S+)/;

// -- Test 2: scaffold missing-install state ------------------------------
// Materialize the directory tree and assert the missing-install precondition
// holds. (No doctor invocation here; this is the fixture-setup assertion.)
let SCAFFOLD_HOME = null;
try {
  const home = makeTmpHome('scaffold');
  const cacheDir = makeMarketplaceCache(home, '1.13.0-beta.99');
  const installDir = path.join(home, '.claude', 'plugins', 'mindrian-os');
  assert.strictEqual(
    fs.existsSync(installDir), false,
    'missing-install precondition: ~/.claude/plugins/mindrian-os/ must not exist; got: it does'
  );
  assert.ok(
    fs.existsSync(path.join(cacheDir, '.claude-plugin', 'plugin.json')),
    'cache plugin.json must exist for the scaffolded version'
  );
  SCAFFOLD_HOME = home;
  pass('Test 2 (scaffold missing-install state with cache 1.13.0-beta.99)');
} catch (err) {
  failTest('Test 2 (scaffold missing-install state)', err);
}

// -- Tests 3 + 4 + 6: run --fix on the missing-install scaffold ----------
// (Test 5 uses a DIFFERENT scenario -- live install + newer cache -- because
//  the missing-install case produces no backup. See Test 5 below.)
let MISSING_INSTALL_OUTPUT = null;
try {
  if (!SCAFFOLD_HOME) throw new Error('scaffold home not available -- Test 2 prerequisite failed');
  const { r, stdoutClean } = runDoctor(SCAFFOLD_HOME, ['--fix']);
  MISSING_INSTALL_OUTPUT = { r, stdoutClean };

  // Test 3: exit code 2 per commands/doctor.md "Exit codes" -- drift detected
  // and recovered via --fix.
  assert.strictEqual(
    r.status, 2,
    'exit code must be 2 (drift detected + recovered via --fix); got ' + r.status +
    '\nstdout:\n' + stdoutClean +
    '\nstderr:\n' + (r.stderr || '')
  );
  pass('Test 3 (exit code 2 after --fix on missing-install)');
} catch (err) {
  failTest('Test 3 (exit code 2 after --fix on missing-install)', err);
}

// Test 4: recovered-to-version line
try {
  if (!MISSING_INSTALL_OUTPUT) throw new Error('missing-install output not available');
  const out = MISSING_INSTALL_OUTPUT.stdoutClean;
  // We expect `✓ recovered to 1.13.0-beta.99` somewhere in the output.
  const m = out.match(RECOVERED_RE);
  assert.ok(
    m,
    'renderer must emit `✓ recovered to <version>` line after --fix on missing-install;\nstdout was:\n' + out
  );
  assert.strictEqual(
    m[1], '1.13.0-beta.99',
    'recovered-to version must match the scaffolded cache version (1.13.0-beta.99); got ' + m[1]
  );
  pass('Test 4 (recovered-to-version line emitted with correct version)');
} catch (err) {
  failTest('Test 4 (recovered-to-version line)', err);
}

// Test 6: summary-semantics -- the Summary line MUST be consistent with the
// recovered header (no `1 drift / 0 warnings` after a successful recovery).
try {
  if (!MISSING_INSTALL_OUTPUT) throw new Error('missing-install output not available');
  const out = MISSING_INSTALL_OUTPUT.stdoutClean;
  // Find the Summary line.
  const sumLine = (out.match(/Summary:.+$/m) || [null])[0];
  assert.ok(sumLine, 'renderer must emit a Summary line; stdout:\n' + out);

  // Hard reject: `1 drift / 0 warnings` post-recovery is the dogfood-bug
  // signature. The header says recovered; the summary must not contradict it.
  assert.ok(
    !/\b1\s+drift\b/.test(sumLine),
    'Summary line after recovery must NOT contain `1 drift`; got: ' + sumLine
  );

  // Soft accept: either Option A (`0 drift`) or Option B (`recovered` tally).
  const acceptA = /\b0\s+drift\b/.test(sumLine);
  const acceptB = /\brecovered\b/i.test(sumLine);
  assert.ok(
    acceptA || acceptB,
    'Summary line must surface a healthy-state shape: either `0 drift` (Option A: ' +
    'drift count decremented after recovery, per commands/doctor.md example) or ' +
    '`recovered` (Option B: explicit recovered tally). Got: ' + sumLine
  );
  pass('Test 6 (summary-semantics: not `1 drift`, surfaces healthy-state shape)');
} catch (err) {
  failTest('Test 6 (summary-semantics)', err);
}

// -- Test 5: backup-line (DIFFERENT scenario: live install + newer cache) -
// In the missing-install case `performRecoveryAtomic` returns backup=null
// because nothing existed to back up. The contract specifies the backup line
// is emitted WHEN a backup exists. To assert the line IS emitted when a
// backup exists, scaffold a live install with a stale version PLUS a newer
// version in the marketplace cache. Recovery then renames the live install
// to a backup dir and emits the `backup <path>` line.
try {
  const home = makeTmpHome('backup-line');
  makeMarketplaceCache(home, '1.13.0-beta.99');
  makeLiveInstall(home, '1.12.0');
  const { r, stdoutClean } = runDoctor(home, ['--fix']);
  // Drift detected and recovered -> exit 2 per commands/doctor.md "Exit codes".
  assert.strictEqual(
    r.status, 2,
    'expected exit 2 on stale-live + newer-cache --fix; got ' + r.status +
    '\nstdout:\n' + stdoutClean
  );

  // recovered-to line MUST be present (per Test 4 contract).
  const recMatch = stdoutClean.match(RECOVERED_RE);
  assert.ok(recMatch, '`recovered to` line must be present in stale-live recovery; stdout:\n' + stdoutClean);
  assert.strictEqual(recMatch[1], '1.13.0-beta.99', 'recovered-to version must match cache latest');

  // backup line MUST be present.
  const bkMatch = stdoutClean.match(BACKUP_RE);
  assert.ok(
    bkMatch,
    'renderer must emit `backup <path>` line when a backup exists;\nstdout:\n' + stdoutClean
  );
  // The path must look like a real mindrian-os.stale-* path.
  assert.ok(
    /mindrian-os\.stale-/.test(bkMatch[1]),
    'backup path must contain `mindrian-os.stale-`; got: ' + bkMatch[1]
  );
  // It must contain a timestamp. doctor.cjs (line 292) builds the timestamp
  // from `new Date().toISOString()` with `:` and `.` stripped and `T` replaced
  // by `-` -- which produces strings like `20260514-103556` (8-digit YYYYMMDD,
  // dash, 6-digit HHMMSS). Assert at least one 6+ digit run somewhere AND a
  // dash-segment shape.
  assert.ok(
    /-\d{4,}/.test(bkMatch[1]) || /\d{8}-\d{6}/.test(bkMatch[1]),
    'backup path must contain a timestamp shape (e.g. YYYYMMDD-HHMMSS); got: ' + bkMatch[1]
  );

  rmTmp(home);
  pass('Test 5 (backup-line emitted with mindrian-os.stale-<ver>-<ts> path)');
} catch (err) {
  failTest('Test 5 (backup-line)', err);
}

// -- Test 7: idempotency on now-recovered missing-install state ----------
// Re-run --fix on the SCAFFOLD_HOME. After Task 2 lands, the first run
// recovered the install; this run should exit 0 (healthy) and emit no
// `recovered to` line.
try {
  if (!SCAFFOLD_HOME) throw new Error('scaffold home not available');
  const installDir = path.join(SCAFFOLD_HOME, '.claude', 'plugins', 'mindrian-os');
  // Only proceed if the first --fix actually materialized the install.
  // If it didn't (RED state pre-Task-2), surface that as a diagnostic.
  if (!fs.existsSync(installDir)) {
    // Pre-Task-2 the recovery may exit 2 but still materialize the install on
    // disk via performRecoveryAtomic; if it doesn't, skip idempotency with a
    // clear note rather than spuriously failing.
    throw new Error(
      'idempotency precondition unmet: install dir was not materialized by the first --fix. ' +
      'This indicates Task 2 has not yet landed OR performRecoveryAtomic failed silently. ' +
      'install dir expected at: ' + installDir
    );
  }
  const { r, stdoutClean } = runDoctor(SCAFFOLD_HOME, ['--fix']);
  assert.strictEqual(
    r.status, 0,
    'second --fix on now-healthy install must exit 0; got ' + r.status +
    '\nstdout:\n' + stdoutClean
  );
  assert.ok(
    !RECOVERED_RE.test(stdoutClean),
    'second --fix on healthy install must NOT emit a `recovered to` line; stdout:\n' + stdoutClean
  );
  pass('Test 7 (idempotency: second --fix is exit-0 + no recovered-to line)');
} catch (err) {
  failTest('Test 7 (idempotency)', err);
}

// -- Cleanup -------------------------------------------------------------
if (SCAFFOLD_HOME) rmTmp(SCAFFOLD_HOME);

// -- Tally ---------------------------------------------------------------
if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
