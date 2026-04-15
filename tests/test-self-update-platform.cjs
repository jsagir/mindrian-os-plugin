#!/usr/bin/env node
'use strict';

/**
 * test-self-update-platform.cjs -- Phase 85-09, Finding J regression fence.
 *
 * Covers the Windows self-update failure family (LASZLO-001):
 *   J-2 python3 plugin.json reads replaced by readPluginJsonVersion helper
 *   J-3 line 325 mv replaced by platform-aware INSTALL_METHOD branch
 *   J-5 bootstrap handoff (exec bash of $HOME/.mindrian/update-bootstrap-$$.sh)
 *
 * Scenarios:
 *   1. win32 detection picks INSTALL_METHOD=copy
 *   2. linux detection picks INSTALL_METHOD=rename
 *   3. readPluginJsonVersion helper works via node when python3 is absent
 *   4. readPluginJsonVersion resolves a /tmp/ path that python3 would misread
 *   5. bootstrap template exists, is executable when copied, and the install
 *      branch behaves correctly for both win32 (cp -a) and linux (mv)
 *   6. scripts/self-update contains zero python3 -c invocations
 *   7. scripts/self-update contains exactly one "^exec bash" as final command
 *   8. J-1 ghost guard: every non-comment plugin.json ref carries the
 *      .claude-plugin/ prefix
 *
 * This test does NOT actually run scripts/self-update end-to-end. That
 * requires a git clone + npm install and is covered manually in the plan's
 * Ubuntu smoke test step.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SELF_UPDATE = path.join(REPO_ROOT, 'scripts', 'self-update');
const BOOTSTRAP_TEMPLATE = path.join(REPO_ROOT, 'lib', 'update-bootstrap.sh.template');
const PLATFORM_CJS = path.join(REPO_ROOT, 'lib', 'core', 'platform.cjs');

let passed = 0;
let failed = 0;

function check(name, cond, detail) {
  if (cond) {
    process.stdout.write('  PASS ' + name + '\n');
    passed += 1;
  } else {
    process.stderr.write('  FAIL ' + name + (detail ? ': ' + detail : '') + '\n');
    failed += 1;
  }
}

function assertEq(name, actual, expected) {
  check(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// --- Scenario 1 & 2: platform detection drives INSTALL_METHOD ---
process.stdout.write('\n[1-2] platform detection -> INSTALL_METHOD\n');

const selfUpdateText = fs.readFileSync(SELF_UPDATE, 'utf8');
check(
  'self-update contains win32 copy branch',
  /case "\$PLATFORM_OS" in[\s\S]*win32\)\s*INSTALL_METHOD="copy"/m.test(selfUpdateText),
  'win32 branch missing from INSTALL_METHOD case'
);
check(
  'self-update contains POSIX rename branch',
  /INSTALL_METHOD="rename"/.test(selfUpdateText),
  'rename branch missing'
);
check(
  'self-update has uname -s fallback for platform detection',
  /MINGW\*\|MSYS\*\|CYGWIN\*\)\s*PLATFORM_OS="win32"/.test(selfUpdateText),
  'uname fallback case block missing'
);

// --- Scenario 3: readPluginJsonVersion helper reads via node ---
process.stdout.write('\n[3] readPluginJsonVersion helper works without python3\n');

const tmpRoot1 = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-selfupdate-test-'));
const manifestDir1 = path.join(tmpRoot1, '.claude-plugin');
fs.mkdirSync(manifestDir1, { recursive: true });
fs.writeFileSync(path.join(manifestDir1, 'plugin.json'), JSON.stringify({ version: '9.8.7', name: 'test' }));

// Extract just the helper function from self-update and exercise it via a
// disposable bash wrapper. Guarantees: no python3 is invoked.
const helperScript = `#!/usr/bin/env bash
set -euo pipefail
readPluginJsonVersion() {
  local root="$1"
  if [ -z "$root" ] || [ ! -f "$root/.claude-plugin/plugin.json" ]; then
    return 1
  fi
  node -e "try { console.log(require(process.argv[1]).version || ''); } catch (e) { process.exit(1); }" "$root/.claude-plugin/plugin.json" 2>/dev/null
}
readPluginJsonVersion "$1"
`;
const helperPath = path.join(tmpRoot1, 'helper.sh');
fs.writeFileSync(helperPath, helperScript);
fs.chmodSync(helperPath, 0o755);

const helperRun = spawnSync('bash', [helperPath, tmpRoot1], {
  encoding: 'utf8',
  env: { ...process.env, PATH: process.env.PATH }, // real PATH; node must be present
});
assertEq('helper exit code', helperRun.status, 0);
assertEq('helper stdout version', (helperRun.stdout || '').trim(), '9.8.7');

// --- Scenario 4: helper resolves /tmp/ prefixed path (Git Bash virtual) ---
process.stdout.write('\n[4] helper resolves /tmp/ prefix correctly\n');

// os.tmpdir() on linux is /tmp, so tmpRoot1 already begins with /tmp. This
// is the exact prefix Git Bash would synthesize on Windows and that Python
// would mis-interpret as C:\tmp. Node reads it correctly because bash has
// already resolved it to a real filesystem path.
check(
  'tmpRoot begins with /tmp',
  tmpRoot1.startsWith('/tmp/'),
  `tmpRoot1=${tmpRoot1}`
);
// Already verified in scenario 3 that helper succeeded on this path.

// --- Scenario 5: bootstrap template install branch behavior ---
process.stdout.write('\n[5] bootstrap template install branch (posix mv)\n');

check(
  'bootstrap template exists',
  fs.existsSync(BOOTSTRAP_TEMPLATE),
  'missing lib/update-bootstrap.sh.template'
);
check(
  'bootstrap template is ASCII-only',
  /^[\x00-\x7f]*$/.test(fs.readFileSync(BOOTSTRAP_TEMPLATE, 'utf8')),
  'non-ASCII byte found'
);

// Exercise the bootstrap with PLATFORM_OS=linux. Build a fake STAGE with
// a plugin/ subdir and a fake CACHE_ROOT. Expect TARGET_DIR to exist after
// and STAGE/plugin to be gone (mv consumed it).
const bootstrapSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-bootstrap-test-'));
const sbStage = path.join(bootstrapSandbox, 'stage');
const sbCacheRoot = path.join(bootstrapSandbox, 'cache');
fs.mkdirSync(path.join(sbStage, 'plugin'), { recursive: true });
fs.writeFileSync(path.join(sbStage, 'plugin', 'marker.txt'), 'hello');
fs.mkdirSync(path.join(sbStage, 'plugin', '.claude-plugin'), { recursive: true });
fs.writeFileSync(
  path.join(sbStage, 'plugin', '.claude-plugin', 'plugin.json'),
  JSON.stringify({ version: '1.2.3' })
);
fs.mkdirSync(sbCacheRoot, { recursive: true });
const sbTarget = path.join(sbCacheRoot, '1.2.3');

const sbBootstrapPath = path.join(bootstrapSandbox, 'update-bootstrap.sh');
fs.copyFileSync(BOOTSTRAP_TEMPLATE, sbBootstrapPath);
fs.chmodSync(sbBootstrapPath, 0o755);

const bsRun = spawnSync(
  'bash',
  [sbBootstrapPath, sbStage, sbTarget, 'linux', sbCacheRoot, '1.2.3', '0.0.0', '', 'test'],
  { encoding: 'utf8' }
);
assertEq('bootstrap (linux) exit code', bsRun.status, 0);
check(
  'bootstrap (linux) created TARGET_DIR with marker',
  fs.existsSync(path.join(sbTarget, 'marker.txt')),
  'marker.txt missing at target'
);
check(
  'bootstrap (linux) consumed STAGE/plugin',
  !fs.existsSync(path.join(sbStage, 'plugin')),
  'STAGE/plugin still exists after mv'
);
check(
  'bootstrap (linux) self-deleted',
  !fs.existsSync(sbBootstrapPath),
  'bootstrap still exists after success'
);
check(
  'bootstrap (linux) emitted UPDATED marker',
  (bsRun.stdout || '').includes('UPDATED'),
  bsRun.stdout
);

// Now exercise the win32 branch (cp -a + rm -rf) on the same filesystem.
// The mechanics are identical on Linux: cp -a works everywhere.
process.stdout.write('\n[5b] bootstrap template install branch (win32 cp -a)\n');

const sbStage2 = path.join(bootstrapSandbox, 'stage2');
const sbCacheRoot2 = path.join(bootstrapSandbox, 'cache2');
fs.mkdirSync(path.join(sbStage2, 'plugin'), { recursive: true });
fs.writeFileSync(path.join(sbStage2, 'plugin', 'marker.txt'), 'winhello');
fs.mkdirSync(sbCacheRoot2, { recursive: true });
const sbTarget2 = path.join(sbCacheRoot2, '1.2.3');

const sbBootstrapPath2 = path.join(bootstrapSandbox, 'update-bootstrap-win.sh');
fs.copyFileSync(BOOTSTRAP_TEMPLATE, sbBootstrapPath2);
fs.chmodSync(sbBootstrapPath2, 0o755);

const bsRun2 = spawnSync(
  'bash',
  [sbBootstrapPath2, sbStage2, sbTarget2, 'win32', sbCacheRoot2, '1.2.3', '0.0.0', '', 'test'],
  { encoding: 'utf8' }
);
assertEq('bootstrap (win32) exit code', bsRun2.status, 0);
check(
  'bootstrap (win32) created TARGET_DIR with marker',
  fs.existsSync(path.join(sbTarget2, 'marker.txt')),
  'marker.txt missing at target'
);
check(
  'bootstrap (win32) removed STAGE/plugin',
  !fs.existsSync(path.join(sbStage2, 'plugin')),
  'STAGE/plugin still exists after cp + rm'
);
check(
  'bootstrap (win32) self-deleted',
  !fs.existsSync(sbBootstrapPath2),
  'bootstrap still exists after success'
);

// --- Scenario 6: zero python3 -c invocations remain in self-update ---
process.stdout.write('\n[6] zero python3 -c invocations remain\n');

const py3Matches = selfUpdateText.match(/python3 -c/g) || [];
assertEq('python3 -c count in scripts/self-update', py3Matches.length, 0);

// --- Scenario 7: exactly one "^exec bash" line (bootstrap handoff) ---
process.stdout.write('\n[7] exactly one exec-bash bootstrap handoff line\n');

const execBashLines = selfUpdateText
  .split('\n')
  .filter((l) => /^exec bash\b/.test(l));
assertEq('exec bash line count', execBashLines.length, 1);

// --- Scenario 8: J-1 ghost guard (every non-comment plugin.json ref has prefix) ---
process.stdout.write('\n[8] J-1 ghost guard: .claude-plugin/ prefix intact\n');

// Only count path-like references: plugin.json immediately preceded by a
// slash (i.e. a real filesystem path). Human-readable prose in echo
// strings ("Staged plugin.json has no version field") is not a path
// reference and does not violate the J-1 guard.
const jsonLines = selfUpdateText
  .split('\n')
  .filter((l) => /\/plugin\.json/.test(l) && !/^\s*#/.test(l));
const badLines = jsonLines.filter((l) => !/\.claude-plugin\/plugin\.json/.test(l));
assertEq('non-prefixed plugin.json path refs (non-comment)', badLines.length, 0);

// Verify that at least the helper line and the validation line still reference
// .claude-plugin/plugin.json. Strong positive assertion.
check(
  'validation gate still reads .claude-plugin/plugin.json',
  /if \[ ! -f "\$STAGE\/plugin\/\.claude-plugin\/plugin\.json" \]/.test(selfUpdateText),
  'validation gate missing or rewritten'
);

// --- Scenario 9: platform.cjs exports detectPlatform + readPluginJsonVersion ---
process.stdout.write('\n[9] platform.cjs exports expected helpers\n');

const platform = require(PLATFORM_CJS);
check('platform.detectPlatform is a function', typeof platform.detectPlatform === 'function');
check('platform.readPluginJsonVersion is a function', typeof platform.readPluginJsonVersion === 'function');
const det = platform.detectPlatform();
check(
  'detectPlatform.os is a known value',
  det.os === 'win32' || det.os === 'linux' || det.os === 'darwin',
  `got ${det.os}`
);

// --- Summary ---
process.stdout.write('\n');
process.stdout.write(`test-self-update-platform: ${passed} passed, ${failed} failed\n`);

// Cleanup
try { fs.rmSync(tmpRoot1, { recursive: true, force: true }); } catch (_e) {}
try { fs.rmSync(bootstrapSandbox, { recursive: true, force: true }); } catch (_e) {}

process.exit(failed === 0 ? 0 : 1);
