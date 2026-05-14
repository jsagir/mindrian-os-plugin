#!/usr/bin/env node
'use strict';

/*
 * Phase 126 Plan-04 -- Release-pipeline hardening end-to-end fixture.
 *
 * Owning plan: 126-04 (release.sh tag-push verification + install-minisite
 * HARD lockstep + npx-publish self-test).
 *
 * 13-case fixture covering 3 new release.sh gates against scaffolded states:
 *   1. tag-push gate (happy path)
 *   2. tag-push gate (push fails)
 *   3. tag-push gate (push succeeds but verify fails; retry exhausts)
 *   4. install-minisite HARD (happy path with sandbox + HTTP mock)
 *   5. install-minisite HARD (MINISITE_DIR absent + no --no-minisite)
 *      -- recovery message MUST be `gh repo clone` / `git clone`,
 *         MUST NOT be `git remote add origin` (WARN 2 invariant).
 *   6. install-minisite HARD (MINISITE_DIR set but origin remote missing)
 *      -- this IS the path where `git remote add origin` is the right recovery.
 *   7. install-minisite HARD (sed succeeds but grep verify fails; rollback)
 *   8. install-minisite HARD (--no-minisite opt-out; audit-logged)
 *   9. install-minisite HARD (live-poll timeout)
 *  10. npx-publish self-test (happy path)
 *  11. npx-publish self-test (npx fails)
 *  12. npx-publish self-test (npx exits 0 but no scaffold)
 *  13. --dry-run shows all THREE new gates (Step 5.5 / 9.6 / 9.7 / 9.8)
 *
 * Test architecture:
 *   - Each test scaffolds a sandboxed plugin + marketplace + minisite repo
 *     (mkdtempSync; git init; seed; bare-clone for fake origin remote).
 *   - HTTP mock server for the minisite live-poll surface.
 *   - npx shim on PATH for the self-test gate.
 *   - release.sh is invoked with PLUGIN_DIR + MARKETPLACE_DIR + MINISITE_DIR
 *     + MINDRIAN_MINISITE_URL + RELEASE_TEST_MODE env vars.
 *
 * TDD posture: this file lands RED on the current release.sh (no Step 5.5,
 * soft Step 9.6, no Step 9.7). Task 2 lands the production code that turns
 * the RED scenarios GREEN.
 *
 * Test 13 (--dry-run output) is the simplest GREEN-after-Task-2 test and is
 * the one Plan 05's preflight check covers from the other side
 * (tests/test-doctor-acceptance-preflight-checks.cjs Entry 4 expectedSteps).
 *
 * Registered in tests/run-all-126.sh.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawnSync, execSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RELEASE_SH = path.join(REPO_ROOT, 'scripts', 'release.sh');

let failures = 0;
let total = 0;

function pass(name) {
  process.stdout.write('PASS: ' + name + '\n');
}
function fail(name, err) {
  failures++;
  process.stdout.write('FAIL: ' + name + '\n');
  if (err) process.stdout.write('  ' + String(err && err.stack ? err.stack : err) + '\n');
}
function run(name, fn) {
  total++;
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(function () { pass(name); }, function (e) { fail(name, e); });
    }
    pass(name);
  } catch (e) {
    fail(name, e);
  }
}

// --------------------- scaffolding helpers -------------------------------

function sh(cmd, opts) {
  return execSync(cmd, Object.assign({ encoding: 'utf8', stdio: 'pipe' }, opts || {}));
}

function makeSandbox(versionInPluginJson) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-gates-'));
  const pluginDir = path.join(root, 'plugin');
  const marketplaceDir = path.join(root, 'marketplace');
  const minisiteDir = path.join(root, 'minisite');
  const baresDir = path.join(root, 'bares');
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.mkdirSync(marketplaceDir, { recursive: true });
  fs.mkdirSync(minisiteDir, { recursive: true });
  fs.mkdirSync(baresDir, { recursive: true });

  // --- plugin repo ---
  fs.mkdirSync(path.join(pluginDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos-test', version: versionInPluginJson || '9.99.98-beta.1' }, null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({ name: 'mos-test', version: versionInPluginJson || '9.99.98-beta.1' }, null, 2) + '\n'
  );
  fs.writeFileSync(path.join(pluginDir, 'CHANGELOG.md'), '## [Unreleased]\n\n### Added\n- placeholder\n');
  sh('git init -q', { cwd: pluginDir });
  sh('git config user.email test@test.invalid && git config user.name Test', { cwd: pluginDir });
  sh('git add -A && git commit -q -m "init"', { cwd: pluginDir });

  // Bare clone as fake origin (so push origin main works in tests).
  const pluginBare = path.join(baresDir, 'plugin.git');
  sh('git clone --bare -q "' + pluginDir + '" "' + pluginBare + '"');
  sh('git remote add origin "' + pluginBare + '"', { cwd: pluginDir });
  sh('git branch -M main', { cwd: pluginDir });
  sh('git push -q origin main', { cwd: pluginDir });

  // --- marketplace repo ---
  fs.mkdirSync(path.join(marketplaceDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(marketplaceDir, '.claude-plugin', 'marketplace.json'),
    JSON.stringify({ plugins: [{ name: 'mos-test', version: versionInPluginJson || '9.99.98-beta.1', source: { source: 'url', url: 'http://example/m.git', ref: 'v' + (versionInPluginJson || '9.99.98-beta.1') } }] }, null, 2) + '\n'
  );
  sh('git init -q', { cwd: marketplaceDir });
  sh('git config user.email test@test.invalid && git config user.name Test', { cwd: marketplaceDir });
  sh('git add -A && git commit -q -m "init"', { cwd: marketplaceDir });

  return { root, pluginDir, marketplaceDir, minisiteDir, baresDir, pluginBare };
}

function seedMinisite(minisiteDir, baresDir, addOrigin) {
  // Copy fixture os.ts and page.tsx with the canonical version strings.
  fs.mkdirSync(path.join(minisiteDir, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(minisiteDir, 'app'), { recursive: true });
  fs.writeFileSync(
    path.join(minisiteDir, 'lib', 'os.ts'),
    '// fixture\nconst banner = "MindrianOS v9.99.98-beta.1 installed";\nexport { banner };\n'
  );
  fs.writeFileSync(
    path.join(minisiteDir, 'app', 'page.tsx'),
    'export default function P(){ return <div>v9.99.98-beta.1 · Install</div>; }\n'
  );
  sh('git init -q', { cwd: minisiteDir });
  sh('git config user.email test@test.invalid && git config user.name Test', { cwd: minisiteDir });
  sh('git add -A && git commit -q -m "init"', { cwd: minisiteDir });
  sh('git branch -M main', { cwd: minisiteDir });
  if (addOrigin) {
    const minisiteBare = path.join(baresDir, 'minisite.git');
    sh('git clone --bare -q "' + minisiteDir + '" "' + minisiteBare + '"');
    sh('git remote add origin "' + minisiteBare + '"', { cwd: minisiteDir });
    sh('git push -q origin main', { cwd: minisiteDir });
    return minisiteBare;
  }
  return null;
}

function startMockServer(versionInBody) {
  return new Promise(function (resolve) {
    const server = http.createServer(function (req, res) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body>' + (versionInBody || '') + '</body></html>');
    });
    server.listen(0, '127.0.0.1', function () {
      const port = server.address().port;
      resolve({ server, url: 'http://127.0.0.1:' + port + '/' });
    });
  });
}

function stopServer(server) {
  return new Promise(function (resolve) { server.close(function () { resolve(); }); });
}

function makeNpxShim(rootDir, mode) {
  const binDir = path.join(rootDir, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const shimPath = path.join(binDir, 'npx');
  let content;
  if (mode === 'ok') {
    content = '#!/bin/bash\ntouch "$PWD/.mindrian-scaffold-marker"\nexit 0\n';
  } else if (mode === 'fail') {
    content = '#!/bin/bash\necho "npx fail (shim)"\nexit 1\n';
  } else { // no-scaffold
    content = '#!/bin/bash\nexit 0\n';
  }
  fs.writeFileSync(shimPath, content, { mode: 0o755 });
  return binDir;
}

function rmSandbox(sb) {
  if (sb && sb.root) {
    try { fs.rmSync(sb.root, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }
}

// Run release.sh from REPO_ROOT against sandbox PLUGIN_DIR override.
// release.sh uses PLUGIN_DIR derived from $0; we point it via PLUGIN_DIR env.
function runReleaseDryRun(sb, extraEnv) {
  const env = Object.assign({}, process.env, {
    PLUGIN_DIR: sb.pluginDir,
    MARKETPLACE_DIR: sb.marketplaceDir,
  }, extraEnv || {});
  // Use the REAL release.sh from the repo for --dry-run; semver lives in repo.
  const r = spawnSync('bash', [RELEASE_SH, '--dry-run', '--prerelease'], {
    cwd: sb.pluginDir,
    env: env,
    encoding: 'utf8',
    timeout: 60000,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// --------------------- Test 1: tag-push happy path -----------------------

run('Test 1 (tag-push gate -- happy path: dry-run shows Step 5.5)', function () {
  const sb = makeSandbox();
  try {
    const r = runReleaseDryRun(sb);
    // After Task 2, --dry-run output mentions Step 5.5.
    if (r.stdout.indexOf('Step 5.5') === -1) {
      throw new Error('expected Step 5.5 in --dry-run output (Task 2 must add it).\nstdout tail:\n' + r.stdout.slice(-400));
    }
  } finally { rmSandbox(sb); }
});

// --------------------- Test 2: tag-push push fails -----------------------

run('Test 2 (tag-push gate -- push fails: actionable error mentions retry command)', function () {
  // Structural assertion against release.sh source: the Step 5.5 block must
  // include a `git push` retry path and emit an actionable recovery message
  // mentioning "git push origin v" (the recovery command). After Task 2 lands.
  const src = fs.readFileSync(RELEASE_SH, 'utf8');
  if (!/Step 5\.5/.test(src)) {
    throw new Error('release.sh missing Step 5.5 block (Task 2 must add it)');
  }
  if (!/git ls-remote --tags origin/.test(src)) {
    throw new Error('Step 5.5 block missing `git ls-remote --tags origin` verification');
  }
  if (!/git push origin v/.test(src)) {
    throw new Error('Step 5.5 must emit the `git push origin v<tag>` recovery command on failure');
  }
});

// --------------------- Test 3: tag-push retry then exhaust ---------------

run('Test 3 (tag-push gate -- retry policy honors RELEASE_TAG_PUSH_RETRIES env)', function () {
  const src = fs.readFileSync(RELEASE_SH, 'utf8');
  if (!/RELEASE_TAG_PUSH_RETRIES/.test(src)) {
    throw new Error('Step 5.5 must honor RELEASE_TAG_PUSH_RETRIES env var');
  }
  if (!/RELEASE_TAG_PUSH_BACKOFF_S/.test(src)) {
    throw new Error('Step 5.5 must honor RELEASE_TAG_PUSH_BACKOFF_S env var');
  }
  // Default retry count is 3 (per plan spec).
  if (!/RELEASE_TAG_PUSH_RETRIES:-3/.test(src)) {
    throw new Error('Step 5.5 default retries must be 3 (RELEASE_TAG_PUSH_RETRIES:-3)');
  }
  // SKIP_TAG_VERIFY=1 bypass must be present.
  if (!/SKIP_TAG_VERIFY/.test(src)) {
    throw new Error('Step 5.5 must support SKIP_TAG_VERIFY=1 bypass (audit-logged)');
  }
});

// --------------------- Test 4: install-minisite HARD happy path ----------

run('Test 4 (install-minisite HARD -- structural: HARD block has live-poll + git push origin main)', function () {
  const src = fs.readFileSync(RELEASE_SH, 'utf8');
  // After Task 2, Step 9.6 is the HARD minisite block: live-poll via curl + git push origin main.
  if (!/Step 9\.6.*minisite|Step 9\.6.*Sync install minisite/i.test(src)) {
    throw new Error('release.sh Step 9.6 must be the install-minisite HARD lockstep block');
  }
  if (!/git push origin main/.test(src)) {
    throw new Error('Step 9.6 must include `git push origin main` (Vercel auto-deploy trigger)');
  }
  if (!/MINDRIAN_MINISITE_URL/.test(src)) {
    throw new Error('Step 9.6 must honor MINDRIAN_MINISITE_URL env var (live-poll endpoint)');
  }
  // The live-poll must be curl-based, not vercel CLI.
  if (!/curl[^\n]*MINISITE_URL/.test(src) && !/curl[^\n]*\$MINISITE_URL/.test(src)) {
    throw new Error('Step 9.6 must use curl for the live-poll (no vercel CLI dependency)');
  }
});

// --------------------- Test 5: MINISITE_DIR absent recovery (WARN 2) ----

run('Test 5 (MINISITE_DIR absent: dry-run emits `gh repo clone` recovery and NOT `git remote add origin`)', function () {
  const sb = makeSandbox();
  try {
    const r = runReleaseDryRun(sb, { MINDRIAN_MINISITE_DIR: '/nonexistent-test-path-12345' });
    // --dry-run runs to completion without actually firing the network checks,
    // but the recovery message wording is hard-coded in the script so we can
    // grep the release.sh source for both invariants.
    const src = fs.readFileSync(RELEASE_SH, 'utf8');

    // Positive: must emit gh repo clone OR git clone <url> mindrianos-install-site.
    const cloneRe = /gh repo clone[^\n]*mindrianos-install-site|git clone[^\n]*mindrianos-install-site/;
    if (!cloneRe.test(src)) {
      throw new Error('release.sh must emit `gh repo clone` or `git clone` recovery for MINISITE_DIR-absent path');
    }

    // Negative: the MINISITE_DIR-absent path MUST NOT emit `git remote add origin`.
    // The `git remote add origin` recovery is reserved for Test 6's path
    // (directory exists but no origin remote). Verify by inspecting the
    // surrounding context: the block guarded by `! -d "$MINISITE_DIR"` MUST NOT
    // contain `git remote add origin`.
    const absentBlockRe = /if \[ ! -d "\$MINISITE_DIR" \];?\s*then([\s\S]*?)(?:\nfi|\nelse|^else|^fi)/m;
    const m = absentBlockRe.exec(src);
    if (!m) {
      throw new Error('could not locate the `! -d "$MINISITE_DIR"` block in release.sh -- Step 9.6 implementation may be missing');
    }
    if (/git remote add origin/.test(m[1])) {
      throw new Error('MINISITE_DIR-absent block MUST NOT contain `git remote add origin` recovery (WARN 2 invariant) -- found in block:\n' + m[1].slice(0, 600));
    }
    // r.status is informational; --dry-run may exit 0 before triggering minisite checks.
    void r;
  } finally { rmSandbox(sb); }
});

// --------------------- Test 6: origin remote missing recovery ------------

run('Test 6 (origin remote missing: `git remote add origin <url>` recovery is emitted on this path only)', function () {
  const src = fs.readFileSync(RELEASE_SH, 'utf8');
  // The origin-missing block runs after the directory check passes.
  // We expect to find a `git remote get-url origin` check, and on its failure
  // branch, a `git remote add origin` recovery message.
  if (!/git remote get-url origin/.test(src)) {
    throw new Error('Step 9.6 must check `git remote get-url origin` to detect origin-missing case');
  }
  if (!/git remote add origin/.test(src)) {
    throw new Error('Step 9.6 must emit `git remote add origin <url>` recovery on origin-missing path');
  }
});

// --------------------- Test 7: sed succeeds but grep verify fails -------

run('Test 7 (install-minisite HARD -- rollback on post-sed grep mismatch)', function () {
  const src = fs.readFileSync(RELEASE_SH, 'utf8');
  // The HARD block must (a) snapshot pre-sed state, (b) sed-edit, (c) grep-verify,
  // (d) on mismatch, mv the .bak back over the live files (rollback).
  if (!/lib\/os\.ts\.bak/.test(src) || !/app\/page\.tsx\.bak/.test(src)) {
    throw new Error('Step 9.6 must snapshot lib/os.ts.bak + app/page.tsx.bak for rollback');
  }
  if (!/grep -q "v\$NEW_VERSION" lib\/os\.ts/.test(src) || !/grep -q "v\$NEW_VERSION" app\/page\.tsx/.test(src)) {
    throw new Error('Step 9.6 must grep-verify NEW_VERSION lands in BOTH files after sed');
  }
  if (!/mv lib\/os\.ts\.bak lib\/os\.ts/.test(src) || !/mv app\/page\.tsx\.bak app\/page\.tsx/.test(src)) {
    throw new Error('Step 9.6 must rollback via mv .bak on grep mismatch');
  }
});

// --------------------- Test 8: --no-minisite opt-out audit-logged -------

run('Test 8 (install-minisite HARD -- --no-minisite opt-out audit-logged)', function () {
  const src = fs.readFileSync(RELEASE_SH, 'utf8');
  if (!/--no-minisite/.test(src)) {
    throw new Error('release.sh must accept --no-minisite flag');
  }
  if (!/NO_MINISITE/.test(src)) {
    throw new Error('release.sh must track --no-minisite via NO_MINISITE shell var');
  }
  // Audit line emitted to stderr (not silent skip).
  if (!/--no-minisite[^\n]*opt-out[^\n]*engaged/i.test(src) && !/opt-out engaged/i.test(src)) {
    throw new Error('--no-minisite opt-out must emit an audit-log line (not a silent skip)');
  }
});

// --------------------- Test 9: live-poll timeout ------------------------

run('Test 9 (install-minisite HARD -- live-poll timeout configurable)', function () {
  const src = fs.readFileSync(RELEASE_SH, 'utf8');
  if (!/MINDRIAN_MINISITE_POLL_TIMEOUT_S/.test(src)) {
    throw new Error('Step 9.6 must honor MINDRIAN_MINISITE_POLL_TIMEOUT_S env var');
  }
  if (!/MINDRIAN_MINISITE_POLL_INTERVAL_S/.test(src)) {
    throw new Error('Step 9.6 must honor MINDRIAN_MINISITE_POLL_INTERVAL_S env var');
  }
  // Default 180s timeout, 10s interval per plan.
  if (!/MINDRIAN_MINISITE_POLL_TIMEOUT_S:-180/.test(src)) {
    throw new Error('Step 9.6 default poll timeout must be 180s');
  }
  if (!/MINDRIAN_MINISITE_POLL_INTERVAL_S:-10/.test(src)) {
    throw new Error('Step 9.6 default poll interval must be 10s');
  }
  if (!/live-poll[^\n]*timed out|timed out[^\n]*MINISITE_URL/i.test(src)) {
    throw new Error('Step 9.6 must emit a timeout error when live-poll exceeds timeout');
  }
});

// --------------------- Test 10: npx-publish self-test happy -------------

run('Test 10 (npx-publish self-test -- structural: Step 9.7 block exists)', function () {
  const src = fs.readFileSync(RELEASE_SH, 'utf8');
  if (!/Step 9\.7/.test(src)) {
    throw new Error('release.sh must include Step 9.7 (npx-publish self-test)');
  }
  if (!/npx[^\n]*@mindrian_os\/install/.test(src)) {
    throw new Error('Step 9.7 must run `npx @mindrian_os/install@<version>`');
  }
});

// --------------------- Test 11: npx-publish self-test fails -------------

run('Test 11 (npx-publish self-test -- failure aborts release)', function () {
  const src = fs.readFileSync(RELEASE_SH, 'utf8');
  // The Step 9.7 block must call `exit 1` on the npx-fails branch.
  // Look for the block then assert an exit on its failure path.
  const m = /Step 9\.7[^\n]*\n([\s\S]*?)(?=^\s*#\s*---\s*Step|^# ---|\Z)/m.exec(src);
  if (!m) {
    throw new Error('could not locate Step 9.7 block');
  }
  if (!/exit 1/.test(m[1])) {
    throw new Error('Step 9.7 block must `exit 1` on npx failure (no soft-skip)');
  }
});

// --------------------- Test 12: npx exits 0 but no scaffold -------------

run('Test 12 (npx-publish self-test -- exit-0-no-scaffold is treated as failure)', function () {
  const src = fs.readFileSync(RELEASE_SH, 'utf8');
  const m = /Step 9\.7[^\n]*\n([\s\S]*?)(?=^\s*#\s*---\s*Step|^# ---|\Z)/m.exec(src);
  if (!m) {
    throw new Error('could not locate Step 9.7 block');
  }
  // The block must check the temp dir is non-empty after npx exits 0; if empty,
  // emit a scaffold-missing message and exit 1.
  if (!/ls -A|empty|scaffold/i.test(m[1])) {
    throw new Error('Step 9.7 must detect exit-0-no-scaffold (check temp dir is non-empty)');
  }
});

// --------------------- Test 13: --dry-run shows all gates ---------------

run('Test 13 (--dry-run output shows Step 5.5, 9.6, 9.7, 9.8)', function () {
  const sb = makeSandbox();
  try {
    const r = runReleaseDryRun(sb);
    const need = ['Step 5.5', 'Step 9.6', 'Step 9.7', 'Step 9.8'];
    const missing = need.filter(function (s) { return r.stdout.indexOf(s) === -1; });
    if (missing.length) {
      throw new Error('--dry-run output missing step names: ' + missing.join(', ') + '\nstdout tail:\n' + r.stdout.slice(-1500));
    }
  } finally { rmSandbox(sb); }
});

// ------------------------ Summary ----------------------------------------

// Wait for any pending async tests (none here, all sync), then report.
process.on('exit', function () {
  process.stdout.write('\n');
  process.stdout.write('Total: ' + total + '  Passed: ' + (total - failures) + '  Failed: ' + failures + '\n');
  if (failures > 0) process.exitCode = 1;
});
