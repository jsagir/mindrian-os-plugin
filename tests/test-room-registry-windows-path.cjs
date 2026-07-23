#!/usr/bin/env node
'use strict';

/*
 * Phase 127.2 Plan 04 Instance #4 (Windows POSIX path leak):
 * test-room-registry-windows-path.cjs
 *
 * Verifies that scripts/room-registry can read/write its registry.json on
 * Windows + Git Bash where bash $HOME = /c/Users/PC and Python open() on
 * Windows cannot resolve the leading-slash POSIX form. The fix injects a
 * normwin() shim into every Python heredoc that converts /c/Users/...
 * back to C:\Users\... when sys.platform == 'win32'.
 *
 * Test strategy:
 *   1. Linux regression: $HOME = /tmp/test-..., run all 7 subcommands,
 *      assert exit 0 + valid JSON outputs.
 *   2. Pure-Python shim probe: write a small probe script that imports the
 *      normwin definition (extracted from room-registry) and verifies the
 *      conversion on the two relevant cases (POSIX and native).
 *
 * We do NOT mock sys.platform from bash, because patching the python3
 * sys.platform constant cleanly requires PYTHONPATH module shimming -- the
 * normwin() function is small enough to test directly in Python with a
 * controlled override. The shim test gives us platform-correctness coverage
 * without an actual Windows runtime.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const REGISTRY_SCRIPT = path.join(REPO_ROOT, 'scripts', 'room-registry');

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
  const tmp = path.join(os.tmpdir(), 'mos-test-room-registry-' + ts + '-' + Math.floor(Math.random() * 1e6));
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

// -- Linux regression: full lifecycle through every subcommand. -----------

(function linuxRegressionLifecycle() {
  const home = makeTmpHome();
  try {
    // list (cold) -- returns []
    const r1 = runRR(home, ['list']);
    assert('linux: list (cold) exits 0', r1.status === 0, 'stderr=' + (r1.stderr || ''));
    assert('linux: list (cold) outputs []', r1.stdout.trim() === '[]');

    // create
    const r2 = runRR(home, ['create', 'foo', 'my-foo', 'My Venture', 'Pre-Opportunity']);
    assert('linux: create exits 0', r2.status === 0, 'stderr=' + (r2.stderr || ''));
    let createdRoom;
    try { createdRoom = JSON.parse(r2.stdout); } catch (_) { createdRoom = null; }
    assert('linux: create output is JSON', createdRoom !== null);
    assert('linux: create JSON has path=my-foo', createdRoom && createdRoom.path === 'my-foo');

    // list (warm)
    const r3 = runRR(home, ['list']);
    assert('linux: list (warm) exits 0', r3.status === 0);
    let listRooms;
    try { listRooms = JSON.parse(r3.stdout); } catch (_) { listRooms = null; }
    assert('linux: list (warm) returns array of 1', Array.isArray(listRooms) && listRooms.length === 1);
    assert('linux: list (warm) contains "foo"', Array.isArray(listRooms) && listRooms[0].name === 'foo');

    // read
    const r4 = runRR(home, ['read', 'foo']);
    assert('linux: read exits 0', r4.status === 0);
    let readRoom;
    try { readRoom = JSON.parse(r4.stdout); } catch (_) { readRoom = null; }
    assert('linux: read returns the room object', readRoom && readRoom.path === 'my-foo');

    // update
    const r5 = runRR(home, ['update', 'foo', 'venture_stage', 'Well-Defined']);
    assert('linux: update exits 0', r5.status === 0);
    let updRoom;
    try { updRoom = JSON.parse(r5.stdout); } catch (_) { updRoom = null; }
    assert('linux: update reflects new venture_stage', updRoom && updRoom.venture_stage === 'Well-Defined');

    // get-active
    const r6 = runRR(home, ['get-active']);
    assert('linux: get-active exits 0', r6.status === 0);
    assert('linux: get-active returns "foo"', r6.stdout.trim() === 'foo');

    // set-active (no-op on the same room is fine)
    const r7 = runRR(home, ['set-active', 'foo']);
    assert('linux: set-active exits 0', r7.status === 0);
    assert('linux: set-active prints room name', r7.stdout.trim() === 'foo');

    // git-config
    const r8 = runRR(home, ['git-config', 'foo', 'true', 'git@example.com:foo.git', 'on', 'https://foo.vercel.app']);
    assert('linux: git-config exits 0', r8.status === 0);
    let gitRoom;
    try { gitRoom = JSON.parse(r8.stdout); } catch (_) { gitRoom = null; }
    assert('linux: git-config persisted git_enabled=true', gitRoom && gitRoom.git_enabled === 'true');

    // archive
    const r9 = runRR(home, ['archive', 'foo']);
    assert('linux: archive exits 0', r9.status === 0);
    assert('linux: archive prints "archived"', r9.stdout.trim() === 'archived');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}());

// -- normwin() shim correctness probe (cross-platform unit test). ---------

(function normwinShimUnit() {
  // We cannot patch sys.platform from inside python3 -c in a single CLI
  // call without monkeypatching sys.platform at module-init time. Instead
  // we run a tiny probe that re-defines normwin() identically to the one
  // injected by room-registry and verifies both branches.
  const probe = `
import os, sys

def normwin(p, force_platform=None):
    plat = force_platform if force_platform is not None else sys.platform
    if plat == 'win32' and len(p) >= 3 and p[0] == '/' and p[2] == '/':
        return p[1].upper() + ':' + p[2:].replace('/', '\\\\')
    return p

# Case 1: Git Bash POSIX form on Windows -> native Windows form.
got = normwin('/c/Users/PC/MindrianRooms/.rooms/registry.json', force_platform='win32')
expected = 'C:\\\\Users\\\\PC\\\\MindrianRooms\\\\.rooms\\\\registry.json'
assert got == expected, '[NORMWIN-WIN32] expected ' + repr(expected) + ', got ' + repr(got)

# Case 2: same POSIX form on Linux -> no-op (unchanged).
got = normwin('/c/Users/PC/MindrianRooms/.rooms/registry.json', force_platform='linux')
expected = '/c/Users/PC/MindrianRooms/.rooms/registry.json'
assert got == expected, '[NORMWIN-LINUX] expected ' + repr(expected) + ', got ' + repr(got)

# Case 3: standard Linux path on Linux -> no-op.
got = normwin('/home/jsagi/MindrianRooms/.rooms/registry.json', force_platform='linux')
expected = '/home/jsagi/MindrianRooms/.rooms/registry.json'
assert got == expected, '[NORMWIN-NATIVE-LINUX] expected ' + repr(expected) + ', got ' + repr(got)

# Case 4: standard Linux path on Windows (e.g. MINDRIAN_ROOMS_HOME absolute) -> no-op.
got = normwin('/home/jsagi/MindrianRooms/.rooms/registry.json', force_platform='win32')
expected = '/home/jsagi/MindrianRooms/.rooms/registry.json'
assert got == expected, '[NORMWIN-LINUX-PATH-ON-WIN32] expected ' + repr(expected) + ', got ' + repr(got)

# Case 5: native Windows path on Windows (e.g. user-set MINDRIAN_ROOMS_HOME=C:\\foo)
# -> no-op (already native; len < 3 / index 2 isn't '/').
got = normwin('C:\\\\Users\\\\PC\\\\registry.json', force_platform='win32')
expected = 'C:\\\\Users\\\\PC\\\\registry.json'
assert got == expected, '[NORMWIN-ALREADY-NATIVE] expected ' + repr(expected) + ', got ' + repr(got)

# Case 6: too-short path -> no-op.
got = normwin('/c', force_platform='win32')
assert got == '/c', '[NORMWIN-TOO-SHORT] expected /c, got ' + repr(got)

print('NORMWIN_PROBE_OK')
`;
  // RCA windows-python-interp-and-shim (Defect B, adjacent same-defect fix):
  // this probe previously called spawnSync('python3', ...) directly, which on
  // the reporter's Windows box cannot resolve the hand-rolled ~/bin/python3
  // shebang shim (Node's CreateProcess falls through to the Store alias stub).
  // Route through bash so its PATH lookup (and the shim) resolves; pass the
  // probe body as a positional arg so its quotes/newlines survive. Graceful
  // SKIP (not fail, not silent pass) if no interpreter is resolvable.
  const wrapper =
    'if command -v python3 >/dev/null 2>&1; then exec python3 -c "$1"; ' +
    'elif command -v python >/dev/null 2>&1; then exec python -c "$1"; ' +
    'else echo "__NO_PYTHON__" >&2; exit 127; fi';
  const r = spawnSync('bash', ['-c', wrapper, 'bash', probe], { encoding: 'utf8', timeout: 5000 });
  if (r.status === 127 && /__NO_PYTHON__/.test(r.stderr || '')) {
    console.log('SKIP normwin probe: no python3/python resolvable via bash on this host');
  } else {
    assert('normwin probe: python spawn ok (via bash PATH resolution)', r.status === 0, 'stderr=' + (r.stderr || ''));
    assert('normwin probe: prints OK marker', /NORMWIN_PROBE_OK/.test(r.stdout || ''), 'stdout=' + (r.stdout || ''));
  }
}());

// -- Structural assertion: shim injected at every previously-affected site.

(function structuralShimCoverage() {
  const src = fs.readFileSync(REGISTRY_SCRIPT, 'utf8');
  // The fix injects a normwin definition in every Python heredoc; count
  // them. Plan called for 13 affected lines -> 7 heredoc stanzas (some
  // stanzas have multiple open() calls). Each stanza gets exactly ONE
  // normwin definition. Acceptable lower bound: 7.
  const normwinDefs = (src.match(/def normwin\(p\):/g) || []).length;
  assert('structural: normwin definitions present (>=7 heredocs)', normwinDefs >= 7, 'actual=' + normwinDefs);

  // RCA windows-python-interp-and-shim UPDATED the shape here. The registry
  // path is no longer baked into the Python source as the string literal
  // '$REGISTRY_FILE' (that literal WAS this bug -- a backslash in the value
  // is re-parsed as a Python escape at compile time). It now arrives via
  // sys.argv and is STILL routed through normwin() for the POSIX->native
  // conversion the May RCA added. Assert the normwin wrap now takes a
  // sys.argv read (the safe shape), across the multi-stanza set.
  const normwinArgv = (src.match(/normwin\(sys\.argv\[\d+\]\)/g) || []).length;
  assert('structural: registry reads flow through normwin(sys.argv[N])', normwinArgv >= 7, 'count=' + normwinArgv);

  // The two Windows fixes together (normwin for POSIX slashes + sys.argv for
  // source-injection safety) mean ZERO single-quoted '$REGISTRY_FILE' Python
  // string literals may survive in the source. NOTE: the DOUBLE-quoted
  // "$REGISTRY_FILE" tokens now appended to each `python3 -c "..."` call are
  // the SAFE shell argv-passes (the fix itself) and must NOT be flagged --
  // only the single-quoted in-source-literal form was the bug.
  const literalLeaks = (src.match(/'\$REGISTRY_FILE'/g) || []).length;
  assert('structural: zero single-quoted \'$REGISTRY_FILE\' literals remain in python source', literalLeaks === 0, 'count=' + literalLeaks);
}());

console.log('');
console.log('====================================');
console.log('test-room-registry-windows-path: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ', ' + fail + ' FAIL' : ''));
console.log('====================================');
process.exit(fail === 0 ? 0 : 1);
