#!/usr/bin/env node
'use strict';

/**
 * Phase 85-04 (WIN-FIX-F-02): Regression test for hooks/run-hook.cmd exit-code
 * propagation on Windows.
 *
 * Background: In v1.10.7 and v1.10.8, run-hook.cmd used `exit /b %ERRORLEVEL%`
 * inside an `if ( ... )` block. cmd.exe parse-time expansion meant the variable
 * was read BEFORE bash.exe ran, so every hook returned the errorlevel from the
 * step before the bash invocation. PreToolUse hooks like write-scope-check
 * silently returned 0, which Claude Code treats as "allow", leaving the
 * sealed-room write guard security-inactive on Windows.
 *
 * Finding F-01 fix (already landed in commit 3bcf83d on main): use
 * `setlocal enabledelayedexpansion`, capture `set "RC=!ERRORLEVEL!"` after
 * every bash invocation, and exit with `endlocal & exit /b %RC%`.
 *
 * This test is the regression fence. It has three branches:
 *
 *   1. Linux/macOS CI: invoke tests/fixtures/cmd-shim.sh which does a
 *      structural check of the three required patterns and then behaviorally
 *      executes scripts/write-scope-check with the same exit-propagation
 *      contract. Asserts exit code 2 and a block message on stderr for a
 *      cross-room Write payload.
 *
 *   2. Windows (win32): spawn cmd.exe /c hooks\run-hook.cmd write-scope-check
 *      with the same payload. Asserts exit code 2 and the block message.
 *
 *   3. Exotic CI with neither cmd.exe nor bash: SKIP with an explicit reason.
 *
 * Constraints: CJS only, no new runtime deps, no em-dashes, skip-gated so
 * non-Windows CI stays green. Registered in lib/memory/run-feynman-tests.cjs.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CMD_FILE = path.join(REPO_ROOT, 'hooks', 'run-hook.cmd');
const SHIM = path.join(REPO_ROOT, 'tests', 'fixtures', 'cmd-shim.sh');

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, detail) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (detail) process.stdout.write('    ' + detail + '\n');
}

function skip(reason) {
  process.stdout.write('SKIP test-run-hook-cmd.cjs: ' + reason + '\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Pre-flight: verify the Finding F-01 diff is still intact in run-hook.cmd.
// This is a cheap structural fence that runs on every platform.
// ---------------------------------------------------------------------------

function verifyCmdFileIntact() {
  if (!fs.existsSync(CMD_FILE)) {
    fail('run-hook.cmd exists', CMD_FILE + ' not found');
    return false;
  }
  const content = fs.readFileSync(CMD_FILE, 'utf8');
  const checks = [
    ['setlocal enabledelayedexpansion', /setlocal enabledelayedexpansion/],
    ['RC=!ERRORLEVEL! capture', /set "RC=!ERRORLEVEL!"/],
    ['endlocal & exit /b %RC%', /endlocal & exit \/b %RC%/]
  ];
  let allOk = true;
  for (const [name, re] of checks) {
    if (re.test(content)) {
      ok('run-hook.cmd contains ' + name);
    } else {
      fail('run-hook.cmd contains ' + name, 'pattern missing, F-01 has regressed');
      allOk = false;
    }
  }
  // Three RC captures + three endlocal exits expected (two Git-for-Windows
  // paths + one PATH fallback). Loosen to >=3 to allow future extra bash
  // locations without breaking the test.
  const rcCount = (content.match(/set "RC=!ERRORLEVEL!"/g) || []).length;
  if (rcCount >= 3) {
    ok('run-hook.cmd has ' + rcCount + ' RC captures (>=3)');
  } else {
    fail('run-hook.cmd has >=3 RC captures', 'found ' + rcCount);
    allOk = false;
  }
  const exitCount = (content.match(/endlocal & exit \/b %RC%/g) || []).length;
  if (exitCount >= 3) {
    ok('run-hook.cmd has ' + exitCount + ' endlocal-exit lines (>=3)');
  } else {
    fail('run-hook.cmd has >=3 endlocal-exit lines', 'found ' + exitCount);
    allOk = false;
  }
  return allOk;
}

// ---------------------------------------------------------------------------
// Build an isolated MindrianRooms fixture so the test does not depend on the
// developer's real registry.
// ---------------------------------------------------------------------------

function buildRoomsFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-85-04-'));
  const roomsRoot = path.join(tmp, 'MindrianRooms');
  fs.mkdirSync(path.join(roomsRoot, 'room-a'), { recursive: true });
  fs.mkdirSync(path.join(roomsRoot, 'room-b'), { recursive: true });
  fs.mkdirSync(path.join(roomsRoot, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(roomsRoot, '.rooms', 'registry.json'),
    JSON.stringify({ active: 'room-a' })
  );
  return { tmp, roomsRoot };
}

function crossRoomPayload(roomsRoot) {
  return JSON.stringify({
    tool_name: 'Write',
    tool_input: {
      file_path: path.join(roomsRoot, 'room-b', 'leak.md')
    }
  });
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Runners: one for Windows (real cmd.exe), one for everything else (bash shim).
// ---------------------------------------------------------------------------

function runViaShim(roomsRoot, payload) {
  return spawnSync('bash', [SHIM, CMD_FILE, 'write-scope-check'], {
    input: payload,
    env: Object.assign({}, process.env, { MINDRIAN_ROOMS_ROOT: roomsRoot }),
    encoding: 'utf8'
  });
}

function runViaCmdExe(roomsRoot, payload) {
  const relCmd = path.relative(REPO_ROOT, CMD_FILE);
  return spawnSync('cmd.exe', ['/c', relCmd, 'write-scope-check'], {
    cwd: REPO_ROOT,
    input: payload,
    env: Object.assign({}, process.env, { MINDRIAN_ROOMS_ROOT: roomsRoot }),
    encoding: 'utf8'
  });
}

function hasBash() {
  const r = spawnSync('bash', ['-c', 'exit 0'], { encoding: 'utf8' });
  return r.status === 0;
}

function hasCmdExe() {
  if (process.platform !== 'win32') return false;
  const r = spawnSync('cmd.exe', ['/c', 'exit 0'], { encoding: 'utf8' });
  return r.status === 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

process.stdout.write('test-run-hook-cmd.cjs\n');

const intact = verifyCmdFileIntact();
if (!intact) {
  process.stdout.write('\nRESULT: ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(1);
}

if (!fs.existsSync(SHIM)) {
  skip('tests/fixtures/cmd-shim.sh missing');
}

const onWindows = process.platform === 'win32';
const canUseCmd = hasCmdExe();
const canUseBash = hasBash();

if (onWindows && !canUseCmd && !canUseBash) {
  skip('neither cmd.exe nor bash found, cannot verify run-hook.cmd exit propagation');
}
if (!onWindows && !canUseBash) {
  skip('bash not available on this non-Windows host');
}

const fixture = buildRoomsFixture();
try {
  const payload = crossRoomPayload(fixture.roomsRoot);
  const result = onWindows && canUseCmd
    ? runViaCmdExe(fixture.roomsRoot, payload)
    : runViaShim(fixture.roomsRoot, payload);

  if (result.error) {
    fail('cross-room Write invocation succeeded', String(result.error));
  } else {
    if (result.status === 2) {
      ok('cross-room Write payload exits with code 2 (blocked)');
    } else {
      fail(
        'cross-room Write payload exits with code 2 (blocked)',
        'got exit ' + result.status + ', stdout=' + JSON.stringify(result.stdout) +
        ', stderr=' + JSON.stringify(result.stderr)
      );
    }
    // write-scope-check.cjs emits the block message on stderr; accept either
    // stream so the test is resilient to future stream reshuffles.
    const combined = (result.stdout || '') + (result.stderr || '');
    if (combined.indexOf('Blocked: write to') !== -1) {
      ok('block message present in hook output');
    } else {
      fail(
        'block message present in hook output',
        'neither stdout nor stderr contained "Blocked: write to", combined=' +
        JSON.stringify(combined)
      );
    }
  }

  // Negative control: a same-room write should be allowed (exit 0), proving
  // the exit code propagation is wired for the happy path too, not just the
  // block path.
  const sameRoomPayload = JSON.stringify({
    tool_name: 'Write',
    tool_input: {
      file_path: path.join(fixture.roomsRoot, 'room-a', 'allowed.md')
    }
  });
  const allowResult = onWindows && canUseCmd
    ? runViaCmdExe(fixture.roomsRoot, sameRoomPayload)
    : runViaShim(fixture.roomsRoot, sameRoomPayload);
  if (allowResult.status === 0) {
    ok('same-room Write payload exits with code 0 (allowed)');
  } else {
    fail(
      'same-room Write payload exits with code 0 (allowed)',
      'got exit ' + allowResult.status +
      ', stderr=' + JSON.stringify(allowResult.stderr)
    );
  }
} finally {
  rmrf(fixture.tmp);
}

process.stdout.write('\nRESULT: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
