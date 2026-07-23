#!/usr/bin/env node
'use strict';

/*
 * RCA windows-os-rename-registry-wedge: test-room-registry-windows-atomic-replace.cjs
 *
 * Windows-only defect (found live on v1.15.3-beta.38): the room-registry family
 * of scripts (room-registry, resolve-room, update-icm-index, on-cwd-changed)
 * write their JSON/markdown state with the textbook atomic-write pattern --
 * write to `<file>.tmp`, then swap it over the real path -- via the Python
 * builtin `os.rename(tmp, dst)` inside bash heredocs.
 *
 * Python's os.rename() is NOT POSIX rename(2) on Windows. Python's own docs:
 * "On Windows, if dst exists a FileExistsError is always raised." So the FIRST
 * write (destination absent) succeeds on every platform, which is exactly why
 * room creation and `/mos:rooms list` looked healthy. Every SUBSEQUENT write to
 * an existing destination (set-active, update, archive, git-config) threw an
 * uncaught FileExistsError [WinError 183] on Windows, left an orphaned `.tmp`
 * on disk, and froze the real file at its last successful state. Presentation:
 * "the tool works, but nothing I do sticks."
 *
 * The fix swaps `os.rename` -> `os.replace` at all 9 callsites. os.replace()
 * maps to MoveFileExW with MOVEFILE_REPLACE_EXISTING and overwrites an existing
 * destination on ALL platforms -- identical to what os.rename ALREADY did on
 * Linux/macOS via POSIX semantics. So the Linux behavior is provably unchanged,
 * and the Windows crash is removed.
 *
 * This test proves the fix on a Linux runner (no Windows box needed) by:
 *   1. Exercising the previously-untested SECOND-write-to-an-existing-registry
 *      path through the real script, asserting the content actually CHANGED
 *      (not merely that the process exited 0) and that no orphaned `.tmp`
 *      remains -- the reporter's on-disk wedge fingerprint.
 *   2. A pure-Python probe of os.replace() overwrite semantics: dst=A, tmp=B,
 *      replace, assert dst==B and tmp is gone. This is the cross-platform
 *      property that makes the fix correct everywhere.
 *   3. A structural anti-regression assertion that zero `os.rename(` callsites
 *      survive in the four scripts, so the Windows-broken primitive cannot
 *      creep back in.
 *
 * The pre-existing correct usage at scripts/track-analytics:155
 * (`os.replace(tmp_file, analytics_file)`) is the proof this primitive was
 * already the house standard -- the registry family simply missed it.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const REGISTRY_SCRIPT = path.join(REPO_ROOT, 'scripts', 'room-registry');
const FIXED_SCRIPTS = ['room-registry', 'resolve-room', 'update-icm-index', 'on-cwd-changed'];

let pass = 0;
let fail = 0;
function assert(label, cond, detail) {
  if (cond) {
    pass++;
    console.log('PASS ' + label);
  } else {
    fail++;
    console.log('FAIL ' + label + (detail ? ' -- ' + detail : ''));
  }
}

function makeTmpHome() {
  const ts = Date.now();
  const tmp = path.join(os.tmpdir(), 'mos-test-atomic-replace-' + ts + '-' + Math.floor(Math.random() * 1e6));
  fs.mkdirSync(tmp, { recursive: true });
  return tmp;
}

function runRR(roomsHome, args) {
  return spawnSync('bash', [REGISTRY_SCRIPT, ...args], {
    encoding: 'utf8',
    timeout: 15000,
    env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: roomsHome }),
  });
}

// -- Part 1: second-write-to-existing-destination regression. --------------
// This is the path the pre-existing suite never asserted on and Windows
// silently wedged. First write is cold (destination absent) -- always worked.
// The bug lived entirely in the second+ write, once registry.json existed.

(function secondWriteOverwritesExistingRegistry() {
  const home = makeTmpHome();
  const registryFile = path.join(home, '.rooms', 'registry.json');
  const registryTmp = registryFile + '.tmp';
  try {
    // First write: cold create. Destination absent -- os.rename AND os.replace
    // both succeed here, which is precisely why the bug hid.
    const r1 = runRR(home, ['create', 'foo', 'my-foo', 'My Venture', 'Pre-Opportunity']);
    assert('create (cold, first write) exits 0', r1.status === 0, 'stderr=' + (r1.stderr || ''));
    assert('registry.json exists after first write', fs.existsSync(registryFile));

    const afterCreate = fs.readFileSync(registryFile, 'utf8');
    assert('after create: venture_stage=Pre-Opportunity', /"venture_stage":\s*"Pre-Opportunity"/.test(afterCreate));

    // SECOND write: destination now EXISTS. On Windows the unfixed os.rename
    // raised FileExistsError [WinError 183] here and exited non-zero, leaving
    // registry.json frozen at the create-time content. With os.replace it
    // overwrites cleanly on every platform.
    const r2 = runRR(home, ['update', 'foo', 'venture_stage', 'Well-Defined']);
    assert('update (warm, second write to existing dst) exits 0', r2.status === 0, 'stderr=' + (r2.stderr || ''));

    const afterUpdate = fs.readFileSync(registryFile, 'utf8');
    // The load-bearing assertion: content actually CHANGED. A false-success
    // regression (exit 0 but frozen file) would pass an exit-code-only check
    // and fail this one.
    assert('second write actually mutated the file (stage now Well-Defined)',
      /"venture_stage":\s*"Well-Defined"/.test(afterUpdate));
    assert('second write cleared the old value (no stale Pre-Opportunity)',
      !/"venture_stage":\s*"Pre-Opportunity"/.test(afterUpdate));
    assert('second write changed the on-disk bytes', afterUpdate !== afterCreate);

    // Third write via a different subcommand (set-active) -- another overwrite
    // of an existing destination, exercising a distinct callsite.
    const r3 = runRR(home, ['set-active', 'foo']);
    assert('set-active (third write to existing dst) exits 0', r3.status === 0, 'stderr=' + (r3.stderr || ''));
    const afterSetActive = fs.readFileSync(registryFile, 'utf8');
    assert('after set-active: active=foo persisted', /"active":\s*"foo"/.test(afterSetActive));

    // The reporter's wedge fingerprint: an orphaned registry.json.tmp left
    // behind by a failed swap. A clean os.replace leaves NO tmp.
    assert('no orphaned registry.json.tmp after repeated writes', !fs.existsSync(registryTmp),
      'orphan tmp present -- swap did not complete atomically');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}());

// -- Part 2: os.replace() overwrite semantics probe (cross-platform). ------
// Proves the property that makes the fix correct on Windows AND unchanged on
// Linux: os.replace always overwrites an existing destination and removes the
// source. os.rename would raise on win32 for the exact same call.

(function osReplaceOverwriteSemanticsProbe() {
  const probe = `
import os, sys, tempfile

d = tempfile.mkdtemp(prefix='mos-osreplace-')
dst = os.path.join(d, 'registry.json')
tmp = dst + '.tmp'

# Seed an EXISTING destination (content A) -- the Windows failure precondition.
with open(dst, 'w') as f:
    f.write('A')

# Stage the new content (content B) in the tmp sidecar, then atomically swap.
with open(tmp, 'w') as f:
    f.write('B')
os.replace(tmp, dst)

with open(dst) as f:
    got = f.read()
assert got == 'B', '[OSREPLACE-OVERWRITE] expected dst==B after replace over existing A, got ' + repr(got)
assert not os.path.exists(tmp), '[OSREPLACE-TMP-GONE] source tmp should be consumed by replace'

# Second overwrite -- replace is idempotently-overwriting, no FileExistsError.
with open(tmp, 'w') as f:
    f.write('C')
os.replace(tmp, dst)
with open(dst) as f:
    got2 = f.read()
assert got2 == 'C', '[OSREPLACE-2ND-OVERWRITE] expected dst==C, got ' + repr(got2)
assert not os.path.exists(tmp), '[OSREPLACE-2ND-TMP-GONE] source tmp should be consumed'

import shutil
shutil.rmtree(d, ignore_errors=True)
print('OSREPLACE_PROBE_OK')
`;
  const r = spawnSync('python3', ['-c', probe], { encoding: 'utf8', timeout: 5000 });
  assert('os.replace probe: python3 spawn ok', r.status === 0, 'stderr=' + (r.stderr || ''));
  assert('os.replace probe: prints OK marker', /OSREPLACE_PROBE_OK/.test(r.stdout || ''), 'stdout=' + (r.stdout || ''));
}());

// -- Part 3: structural anti-regression -- the Windows-broken primitive is gone.

(function structuralNoBareOsRename() {
  let totalReplace = 0;
  for (const name of FIXED_SCRIPTS) {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts', name), 'utf8');
    const renames = (src.match(/os\.rename\(/g) || []).length;
    const replaces = (src.match(/os\.replace\(/g) || []).length;
    totalReplace += replaces;
    assert('structural: zero os.rename( in scripts/' + name, renames === 0, 'found ' + renames);
    assert('structural: os.replace( present in scripts/' + name, replaces >= 1, 'found ' + replaces);
  }
  // 9 confirmed callsites across the four files (room-registry carries 6).
  assert('structural: 9 os.replace( callsites across the fixed scripts', totalReplace === 9, 'total=' + totalReplace);
}());

console.log('');
console.log('====================================');
console.log('test-room-registry-windows-atomic-replace: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ', ' + fail + ' FAIL' : ''));
console.log('====================================');
process.exit(fail === 0 ? 0 : 1);
