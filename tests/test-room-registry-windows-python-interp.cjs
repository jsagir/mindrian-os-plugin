#!/usr/bin/env node
'use strict';

/*
 * RCA windows-python-interp-and-shim (Defect A):
 * tests/test-room-registry-windows-python-interp.cjs
 *
 * The room-registry family (room-registry, resolve-room, update-icm-index,
 * on-cwd-changed) used to build its embedded Python by interpolating shell
 * variables DIRECTLY into the Python source as quoted string literals, e.g.
 *
 *     reg_file = normwin('$REGISTRY_FILE')          # <-- shell expands $REGISTRY_FILE
 *     reg['rooms']['$NAME']['venture_name'] = '''$VNAME'''
 *
 * On Windows every native path contains backslashes (C:\Users\jsagi\...). When
 * such a value is interpolated into a single-quoted Python string literal, the
 * backslash is consumed by Python's STRING-LITERAL ESCAPE PARSER at COMPILE
 * time -- before a single line of the script's own logic (including the
 * normwin() path-normalizer that was supposed to fix Windows paths) ever runs.
 * A path like C:\Users\... starts a \U... unicode escape that a real path
 * almost never completes, so Python dies with:
 *
 *     SyntaxError: (unicode error) 'unicodeescape' codec can't decode bytes
 *                  in position 2-3: truncated \UXXXXXXXX escape
 *
 * This is the SAME anti-pattern (values interpolated into Python source instead
 * of passed as real arguments) that produced two earlier RCAs on the same four
 * files:
 *   - windows-room-registry-path-normalization-gap (2026-05-23): POSIX /c/...
 *     paths reaching open(); fixed by ADDING normwin() -- but normwin can only
 *     run AFTER the string is a Python value, so it never helped this failure.
 *   - windows-os-rename-registry-wedge (2026-07-23 AM): os.rename overwrite
 *     semantics on Windows; fixed by os.rename -> os.replace.
 * Three chapters, one disease: interpolation-as-code-injection.
 *
 * The fix passes every value via sys.argv (the safe pattern room-registry's own
 * _write_current_room() already used), so the value arrives as a real Python
 * string and is NEVER re-parsed as source text -- no escape interpretation ever
 * happens on its contents.
 *
 * KEY PROPERTY (why this test runs and is meaningful on Linux, not just
 * Windows): the defect is a SOURCE-INJECTION bug, not strictly a Windows bug.
 * A backslash value breaks the Python tokenizer identically on Linux, macOS,
 * and Windows -- Windows was merely the platform that GUARANTEES backslashes in
 * every path. So an adversarial backslash value (e.g. C:\Users\jsagi\Test)
 * pushed through the write path is a fully cross-platform proof: it survives
 * intact after the fix on ANY OS, and would have thrown a SyntaxError before
 * the fix on ANY OS. Part 2 below proves both halves of that directly.
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

// An adversarial value with the exact shape that detonated the old pattern:
// a native Windows path whose \U / \A / \T sequences are (broken) Python
// unicode/other escapes. Used as venture_name, a field value, and a git url.
const WINPATH = 'C:\\Users\\jsagi\\AppData\\Local\\Temp\\mos-x';

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
  const tmp = path.join(os.tmpdir(), 'mos-test-py-interp-' + ts + '-' + Math.floor(Math.random() * 1e6));
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

// Cross-platform-safe python invocation, identical strategy to Defect B's fix
// in test-room-registry-windows-atomic-replace.cjs: route through bash so its
// PATH lookup (and any hand-rolled python3 shim) resolves. Returns the spawn
// result; status 127 + __NO_PYTHON__ means "no interpreter resolvable here".
//
// RCA windows-argv-mangling-bash-spawn (Defect C, addendum): passing the probe
// source as a positional bash argument ($1) survives Defect A/B on Linux/macOS,
// but on Windows Node's spawnSync('bash', [...]) invokes Git-Bash's bash.exe,
// and Windows argv passing goes through CommandLineToArgvW-style re-quoting at
// the OS/CRT boundary before bash ever sees it -- a backslash immediately
// followed by a quote character in the source (a common shape for a Windows
// path or a regex ending a string literal) is silently eaten or reinterpreted
// during that reconstruction, corrupting the source before bash's own $1
// expansion runs. Confirmed and root-caused live on the reporter's Windows box;
// does not reproduce on Linux/macOS. Fix: write the source to a real temp .py
// file and exec THAT PATH (a short string with no embedded quote/backslash
// sequences survives argv marshalling intact); the wrapper's `-c` flag is
// removed together with the invocation change (a file path passed to `-c`
// would try to execute the path STRING as source, not run the file).
function runPython(src) {
  const probeFile = path.join(os.tmpdir(), 'mos-probe-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '.py');
  fs.writeFileSync(probeFile, src, 'utf8');
  try {
    const wrapper =
      'if command -v python3 >/dev/null 2>&1; then exec python3 "$1"; ' +
      'elif command -v python >/dev/null 2>&1; then exec python "$1"; ' +
      'else echo "__NO_PYTHON__" >&2; exit 127; fi';
    return spawnSync('bash', ['-c', wrapper, 'bash', probeFile], { encoding: 'utf8', timeout: 5000 });
  } finally {
    fs.rmSync(probeFile, { force: true });
  }
}

// -- Part 1: backslash values survive the real write path (cross-platform). --
// This is the end-to-end proof of Defect A's fix. Every one of these values
// would have thrown a SyntaxError at Python COMPILE time under the old
// interpolation pattern, on ANY OS.

(function backslashValuesSurviveWritePath() {
  const home = makeTmpHome();
  const registryFile = path.join(home, '.rooms', 'registry.json');
  const registryTmp = registryFile + '.tmp';
  try {
    // create: venture_name AND venture_stage carry backslashes. Under the old
    // '''$VNAME''' interpolation this exact call was a compile-time SyntaxError.
    const r1 = runRR(home, ['create', 'winroom', 'my-winroom', WINPATH, WINPATH + '-stage']);
    assert('create with backslash venture_name/stage exits 0', r1.status === 0, 'stderr=' + (r1.stderr || ''));
    assert('registry.json exists after create', fs.existsSync(registryFile));

    // The registry must be well-formed JSON and hold the value byte-for-byte.
    let reg = null;
    try { reg = JSON.parse(fs.readFileSync(registryFile, 'utf8')); } catch (_e) { reg = null; }
    assert('registry.json is well-formed JSON after create', reg !== null);
    assert('venture_name round-trips the backslash value intact',
      reg && reg.rooms && reg.rooms.winroom && reg.rooms.winroom.venture_name === WINPATH,
      'got=' + (reg && reg.rooms && reg.rooms.winroom ? JSON.stringify(reg.rooms.winroom.venture_name) : 'n/a'));
    assert('venture_stage round-trips the backslash value intact',
      reg && reg.rooms.winroom.venture_stage === WINPATH + '-stage');

    // update: a second write, field value carries a backslash path.
    const r2 = runRR(home, ['update', 'winroom', 'vercel_url', WINPATH]);
    assert('update with backslash field value exits 0', r2.status === 0, 'stderr=' + (r2.stderr || ''));
    let reg2 = null;
    try { reg2 = JSON.parse(fs.readFileSync(registryFile, 'utf8')); } catch (_e) { reg2 = null; }
    assert('registry.json still well-formed JSON after update', reg2 !== null);
    assert('updated field holds the backslash value intact',
      reg2 && reg2.rooms.winroom.vercel_url === WINPATH);

    // git-config: multiple backslash-bearing values in one call (the widest
    // interpolation stanza -- 6 shell vars into Python).
    const r3 = runRR(home, ['git-config', 'winroom', 'true', WINPATH + '\\repo.git', 'on', 'https://x\\y.vercel.app']);
    assert('git-config with backslash values exits 0', r3.status === 0, 'stderr=' + (r3.stderr || ''));
    let reg3 = null;
    try { reg3 = JSON.parse(fs.readFileSync(registryFile, 'utf8')); } catch (_e) { reg3 = null; }
    assert('registry.json still well-formed JSON after git-config', reg3 !== null);
    assert('git_remote holds the backslash value intact',
      reg3 && reg3.rooms.winroom.git_remote === WINPATH + '\\repo.git');

    // read / list / get-active must all survive a registry that CONTAINS
    // backslash values (they parse and re-emit it).
    assert('read exits 0 against a backslash-bearing registry', runRR(home, ['read', 'winroom']).status === 0);
    assert('list exits 0 against a backslash-bearing registry', runRR(home, ['list']).status === 0);
    assert('get-active exits 0 against a backslash-bearing registry', runRR(home, ['get-active']).status === 0);

    // No orphaned tmp from any of the writes above.
    assert('no orphaned registry.json.tmp', !fs.existsSync(registryTmp));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}());

// -- Part 2: the load-bearing control -- old pattern breaks, new pattern works.
// Proves the fix is real and NOT vacuous, on whatever OS this runs (Linux CI
// included). Two python invocations with the SAME backslash value:
//   (a) OLD shape: value baked into the source as a string literal -> the value
//       is re-parsed as Python source -> SyntaxError at compile time.
//   (b) NEW shape: value passed via sys.argv -> arrives as a real string ->
//       succeeds, value intact.

(function oldPatternBreaksNewPatternWorks() {
  // (a) Reproduce the OLD interpolation: embed WINPATH directly in the source,
  //     exactly as `x = '$VNAME'` did after shell expansion. We build the
  //     source string in JS (this is the shell's job in the real scripts).
  const injectedSource = "x = '" + WINPATH + "'\nprint('SHOULD_NOT_REACH', x)\n";
  const bad = runPython(injectedSource);
  if (bad.status === 127 && /__NO_PYTHON__/.test(bad.stderr || '')) {
    console.log('SKIP old-pattern control: no python3/python resolvable via bash on this host');
  } else {
    assert('old interpolation pattern FAILS to compile (source injection)',
      bad.status !== 0, 'unexpectedly succeeded -- injection did not detonate; stdout=' + (bad.stdout || ''));
    assert('old-pattern failure is the unicodeescape SyntaxError we diagnosed',
      /unicodeescape|SyntaxError/.test(bad.stderr || ''), 'stderr=' + (bad.stderr || ''));
    assert('old-pattern control never reached its own print',
      !/SHOULD_NOT_REACH/.test(bad.stdout || ''));
  }

  // (b) The NEW shape: same value, passed as an argument, read via sys.argv.
  const safeSource = 'import sys\nv = sys.argv[1]\nprint("GOT:" + v)\n';
  const good = spawnSync('bash', ['-c',
    'if command -v python3 >/dev/null 2>&1; then exec python3 -c "$1" "$2"; ' +
    'elif command -v python >/dev/null 2>&1; then exec python -c "$1" "$2"; ' +
    'else echo "__NO_PYTHON__" >&2; exit 127; fi',
    'bash', safeSource, WINPATH], { encoding: 'utf8', timeout: 5000 });
  if (good.status === 127 && /__NO_PYTHON__/.test(good.stderr || '')) {
    console.log('SKIP new-pattern control: no python3/python resolvable via bash on this host');
  } else {
    assert('new sys.argv pattern compiles and runs with the backslash value',
      good.status === 0, 'stderr=' + (good.stderr || ''));
    assert('new sys.argv pattern preserves the backslash value byte-for-byte',
      (good.stdout || '').indexOf('GOT:' + WINPATH) !== -1, 'stdout=' + (good.stdout || ''));
  }
}());

// -- Part 3: structural anti-regression -- no shell var is interpolated into
// Python source in any of the four scripts. This is the assertion that holds
// the line on this repo's Linux CI (mirrors the atomic-replace test's Part 3
// reasoning: the behavioral proofs pass on Linux regardless, the static grep
// is what actually catches a reintroduction of the fragile pattern).
//
// A vulnerable site looks like  '$VAR'  or  '''$VAR'''  INSIDE python source.
// We exclude:
//   - `node -e` lines (JavaScript, not Python; e.g. on-cwd-changed reads
//     $PLUGIN_ROOT there -- a separate, out-of-scope surface).

(function structuralNoShellVarInPythonSource() {
  const INTERP = /'\$[A-Za-z_][A-Za-z0-9_]*'/;         // '$VAR'
  const INTERP3 = /'''\$[A-Za-z_][A-Za-z0-9_]*'''/;    // '''$VAR'''
  let totalOffenders = 0;
  for (const name of FIXED_SCRIPTS) {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts', name), 'utf8');
    const offenders = src.split('\n').filter((line) => {
      if (line.includes('node -e')) return false; // JS surface, out of scope
      return INTERP.test(line) || INTERP3.test(line);
    });
    totalOffenders += offenders.length;
    assert('structural: zero shell-var-in-python-source sites in scripts/' + name,
      offenders.length === 0,
      offenders.length ? 'first=' + offenders[0].trim() : '');
  }
  assert('structural: zero shell-var-in-python-source sites across all four scripts',
    totalOffenders === 0, 'total=' + totalOffenders);

  // And the safe pattern is actually present: sys.argv reads in every script.
  for (const name of FIXED_SCRIPTS) {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts', name), 'utf8');
    assert('structural: sys.argv[ present in scripts/' + name,
      /sys\.argv\[/.test(src), 'no sys.argv usage found');
  }
}());

console.log('');
console.log('====================================');
console.log('test-room-registry-windows-python-interp: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ', ' + fail + ' FAIL' : ''));
console.log('====================================');
process.exit(fail === 0 ? 0 : 1);
