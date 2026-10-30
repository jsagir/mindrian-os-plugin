'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261030-eo7 (H2) -- a meeting speaker name must never reach python3 as
 * program text in scripts/research-speaker urlencode.
 * RCA: .planning/debug/command-injection-commit-message-and-speaker-urlencode.md
 *
 * The bc75d431e cut pasted the query text (it holds the speaker display name)
 * into python3 -c program text inside single quotes, so a name written to
 * break out of that string literal ran its own code. The fix gives the text to
 * python3 as sys.argv[1]; the sed fallback line stays unchanged.
 *
 * Legs:
 *   A1-A3. extraction pins: the OLD function, the NEW function, and a 1-line
 *      diff at line 120;
 *   B. plain inputs: NEW bytes equal OLD bytes (oracle: git archive of the
 *      bc75d431e cut), plus pinned literals;
 *   C. the sed fallback (python3 that exits 1): OLD equals NEW;
 *   D1-D2. hostile names at function level: no marker, pinned encoding;
 *   E. the pinned divergence (apostrophe, backslash, line break);
 *   F. whole script, plain name, curl stubbed through PATH: 3 pinned URLs,
 *      OLD stdout and curl log equal NEW, PROFILE.md unchanged;
 *   G1-G2. whole script, hostile names: no marker, pinned first URL;
 *   H. source pins: 1 curl line, 0 lines that hold quote('.
 *
 * No leg reaches the network: curl is a stub first on PATH. The --apply flag
 * is never used here.
 *
 * Plain node:assert/strict, zero deps, mkdtemp only. Exit 0 pass, 1 fail.
 * Hyphens only (no em-dash or en-dash).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const NEW_SCRIPT = path.join(ROOT, 'scripts', 'research-speaker');
const BASE_SHA = process.env.EO7_ORACLE_SHA || 'bc75d431ea8bc5e4218c01a51f5c0a37b74d2295';

let failures = 0;
function leg(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    failures += 1;
    console.log('not ok - ' + name);
    console.log('    ' + String(err && err.message ? err.message : err).split('\n').join('\n    '));
  }
}

const tmpRoots = [];
function mkTmp(label) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'test-eo7-h2-' + label + '-')));
  tmpRoots.push(d);
  return d;
}
function assertUnderTmp(p) {
  const t = fs.realpathSync(os.tmpdir());
  assert.ok(p.startsWith(t + path.sep), 'path must live under os.tmpdir(): ' + p);
}

const base = mkTmp('base');
assertUnderTmp(base);
fs.mkdirSync(path.join(base, 'home'));

// OLD oracle: read-only git archive of BASE_SHA.
let OLD_SCRIPT = null;
let oracleError = null;
{
  const tar = path.join(base, 'old.tar');
  const oldDir = path.join(base, 'old');
  fs.mkdirSync(oldDir);
  const a = spawnSync('git', ['archive', '-o', tar, BASE_SHA, 'scripts/research-speaker'], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'],
  });
  if (a.status !== 0) {
    oracleError = 'git archive of ' + BASE_SHA + ' failed (set EO7_ORACLE_SHA to a reachable sha): ' + String(a.stderr || '').trim();
  } else {
    const x = spawnSync('tar', ['-xf', tar, '-C', oldDir], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
    if (x.status !== 0) oracleError = 'tar extract failed: ' + String(x.stderr || '').trim();
    else OLD_SCRIPT = path.join(oldDir, 'scripts', 'research-speaker');
  }
}
function needOracle() {
  if (!OLD_SCRIPT) throw new Error(oracleError || 'OLD oracle missing (EO7_ORACLE_SHA)');
}

// curl stub: records its arguments, prints nothing, exits 0.
const STUB_DIR = path.join(base, 'stub');
fs.mkdirSync(STUB_DIR);
fs.writeFileSync(path.join(STUB_DIR, 'curl'), "#!/bin/sh\nprintf '%s\\n' \"$@\" >> \"$CURL_STUB_LOG\"\nexit 0\n", { mode: 0o755 });

// python3 that always fails, for the sed fallback leg.
const NOPY_DIR = path.join(base, 'nopy');
fs.mkdirSync(NOPY_DIR);
fs.writeFileSync(path.join(NOPY_DIR, 'python3'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });

const BASE_PATH = [STUB_DIR, path.dirname(process.execPath), '/usr/bin', '/bin'].join(':');
let logSeq = 0;
function makeEnv(extraPathFirst) {
  logSeq += 1;
  const log = path.join(base, 'curl-' + logSeq + '.log');
  fs.writeFileSync(log, '');
  return {
    log,
    env: {
      PATH: extraPathFirst ? extraPathFirst + ':' + BASE_PATH : BASE_PATH,
      HOME: path.join(base, 'home'),
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8',
      TZ: 'UTC',
      CURL_STUB_LOG: log,
    },
  };
}
function freshCwd() {
  const d = fs.mkdtempSync(path.join(base, 'cwd-'));
  assertUnderTmp(d);
  return d;
}

const HAVE_PY = spawnSync('python3', ['--version']).status === 0;
function pyLeg(name, fn) {
  if (!HAVE_PY) { console.log('ok - ' + name + ' # SKIP python3 absent'); return; }
  leg(name, fn);
}

function extractUrlencode(text) {
  const lines = text.split('\n');
  const starts = [];
  lines.forEach((l, i) => { if (l === 'urlencode() {') starts.push(i); });
  assert.equal(starts.length, 1, 'exactly 1 line must equal "urlencode() {"');
  let end = starts[0] + 1;
  while (end < lines.length && lines[end] !== '}') end += 1;
  assert.ok(end < lines.length, 'urlencode must end with a line that equals "}"');
  return lines.slice(starts[0], end + 1).join('\n');
}
function callFn(fnText, input, cwd, extraPathFirst) {
  const { env } = makeEnv(extraPathFirst);
  const r = spawnSync('bash', ['-c', fnText + '\n' + 'urlencode "$1"', 'urlencode', input], { cwd, env });
  return r.stdout;
}

const OLD_FN_LITERAL = [
  'urlencode() {',
  '  local string="$1"',
  '  python3 -c "import urllib.parse; print(urllib.parse.quote(\'$string\'))" 2>/dev/null \\',
  '    || echo "$string" | sed \'s/ /+/g; s/"/%22/g\'',
  '}',
].join('\n');
const NEW_FN_LITERAL = [
  'urlencode() {',
  '  local string="$1"',
  '  python3 -c \'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1]))\' "$string" 2>/dev/null \\',
  '    || echo "$string" | sed \'s/ /+/g; s/"/%22/g\'',
  '}',
].join('\n');

const BT = '`';
const PROOF_NAME = "x'+str(open('mos-eo7-h2-proof','w').write('1'))+'";
const PROOF_QUERY1 = '"' + PROOF_NAME + '" edtech tutoring';
const PROOF_QUERY1_ENC = '%22x%27%2Bstr%28open%28%27mos-eo7-h2-proof%27%2C%27w%27%29.write%28%271%27%29%29%2B%27%22%20edtech%20tutoring';
const SUBST_NAME = '$(touch mos-eo7-h2-subst)';

const oldText = () => fs.readFileSync(OLD_SCRIPT, 'utf8');
const newText = () => fs.readFileSync(NEW_SCRIPT, 'utf8');

leg('A1. OLD urlencode equals the pinned bc75d431e literal', () => {
  needOracle();
  assert.equal(extractUrlencode(oldText()), OLD_FN_LITERAL);
});

leg('A2. repo urlencode equals the pinned argv literal', () => {
  assert.equal(extractUrlencode(newText()), NEW_FN_LITERAL);
});

// Re-pinned by the N1 fix (same quick): the --apply block changed too and is
// covered by tests/test-261030-eo7-research-speaker-apply-context.cjs, so the
// compare stops at the --apply marker line.
const APPLY_MARKER = '# --apply mode: update PROFILE.md';
function headUntilApply(text) {
  const lines = text.split('\n');
  const i = lines.indexOf(APPLY_MARKER);
  assert.ok(i > 0, 'the --apply marker line must exist once');
  assert.equal(lines.lastIndexOf(APPLY_MARKER), i, 'the --apply marker line must exist once');
  return lines.slice(0, i);
}
leg('A3. before the --apply block, the repo script differs from the OLD script only at line 120', () => {
  needOracle();
  const o = headUntilApply(oldText());
  const n = headUntilApply(newText());
  assert.equal(n.length, o.length, 'line count before the --apply block');
  const diff = [];
  for (let i = 0; i < o.length; i += 1) if (o[i] !== n[i]) diff.push(i + 1);
  assert.deepEqual(diff, [120]);
});

const PLAIN_INPUTS = [
  'Sample Speaker',
  '"Sample Speaker" edtech tutoring',
  '"Sample Speaker" advisor linkedin OR crunchbase OR twitter',
  'Zoë Ñandú 東京',
  'a+b c/d',
  'path/with/slashes',
  '100% & more?=#',
  'semi;colon|pipe<>',
  'dollar $HOME and $(not run) ' + BT + 'x' + BT,
  'tab\there',
  '"Sample Speaker" edtech tutoring ',
];
const PLAIN_PINS = [
  ['"Sample Speaker" edtech tutoring', '%22Sample%20Speaker%22%20edtech%20tutoring\n'],
  ['a+b c/d', 'a%2Bb%20c/d\n'],
  ['Zoë Ñandú 東京', 'Zo%C3%AB%20%C3%91and%C3%BA%20%E6%9D%B1%E4%BA%AC\n'],
  ['100% & more?=#', '100%25%20%26%20more%3F%3D%23\n'],
  ['path/with/slashes', 'path/with/slashes\n'],
  ['tab\there', 'tab%09here\n'],
];

pyLeg('B. plain inputs: NEW bytes equal OLD bytes, pinned literals hold', () => {
  needOracle();
  const oldFn = extractUrlencode(oldText());
  const newFn = extractUrlencode(newText());
  for (const input of PLAIN_INPUTS) {
    const cwd = freshCwd();
    const o = callFn(oldFn, input, cwd);
    const n = callFn(newFn, input, cwd);
    assert.ok(n.equals(o), 'byte identity for ' + JSON.stringify(input) + ': OLD ' + JSON.stringify(o.toString()) + ' NEW ' + JSON.stringify(n.toString()));
    assert.deepEqual(fs.readdirSync(cwd), []);
  }
  for (const [input, want] of PLAIN_PINS) {
    assert.equal(callFn(newFn, input, freshCwd()).toString('utf8'), want, 'pinned literal for ' + JSON.stringify(input));
  }
});

leg('C. sed fallback (python3 fails): OLD equals NEW', () => {
  needOracle();
  const input = '"Sample Speaker" edtech';
  const o = callFn(extractUrlencode(oldText()), input, freshCwd(), NOPY_DIR);
  const n = callFn(extractUrlencode(newText()), input, freshCwd(), NOPY_DIR);
  assert.ok(n.equals(o), 'OLD ' + JSON.stringify(o.toString()) + ' NEW ' + JSON.stringify(n.toString()));
  assert.equal(n.toString('utf8'), '%22Sample+Speaker%22+edtech\n');
});

pyLeg('D1. break-out speaker name at function level: no marker, pinned encoding', () => {
  const cwd = freshCwd();
  const out = callFn(extractUrlencode(newText()), PROOF_QUERY1, cwd);
  assert.deepEqual(fs.readdirSync(cwd), [], 'the cwd must stay empty (a marker means code ran)');
  assert.equal(out.toString('utf8'), PROOF_QUERY1_ENC + '\n');
});

pyLeg('D2. $( ) speaker name at function level: no marker, pinned encoding', () => {
  const cwd = freshCwd();
  const out = callFn(extractUrlencode(newText()), SUBST_NAME, cwd);
  assert.deepEqual(fs.readdirSync(cwd), [], 'the cwd must stay empty');
  assert.equal(out.toString('utf8'), '%24%28touch%20mos-eo7-h2-subst%29\n');
});

const DIVERGENCE = [
  ['"Dana O\'Sample" edtech', '%22Dana+O\'Sample%22+edtech\n', '%22Dana%20O%27Sample%22%20edtech\n'],
  ['a\\tb', 'a%09b\n', 'a%5Ctb\n'],
  ['a\\', 'a\\\n', 'a%5C\n'],
  ['line1\nline2', 'line1\nline2\n', 'line1%0Aline2\n'],
];
pyLeg('E. pinned divergence: apostrophe, backslash, line break', () => {
  needOracle();
  const oldFn = extractUrlencode(oldText());
  const newFn = extractUrlencode(newText());
  for (const [input, oldWant, newWant] of DIVERGENCE) {
    const o = callFn(oldFn, input, freshCwd()).toString('utf8');
    const n = callFn(newFn, input, freshCwd()).toString('utf8');
    assert.equal(o, oldWant, 'OLD output for ' + JSON.stringify(input));
    assert.equal(n, newWant, 'NEW output for ' + JSON.stringify(input));
    assert.notEqual(o, n);
  }
});

// Whole-script runs.
const PROFILE_LINES = ['---', 'role: advisor', 'research_status: pending', '---', '# Test Speaker', '[To be filled after proactive research]'];
function makeRoom(name) {
  const room = path.join(base, name);
  assertUnderTmp(room);
  const dir = path.join(room, 'team', 'advisor', 'test-speaker');
  fs.mkdirSync(dir, { recursive: true });
  const profile = path.join(dir, 'PROFILE.md');
  fs.writeFileSync(profile, PROFILE_LINES.join('\n') + '\n');
  return { room, profile };
}
function runScript(script, room, displayName, context) {
  const cwd = freshCwd();
  const { env, log } = makeEnv();
  const r = spawnSync('bash', [script, room, 'test-speaker', displayName, context], { cwd, env, encoding: 'utf8' });
  const logText = fs.readFileSync(log, 'utf8');
  return {
    status: r.status,
    stdout: r.stdout,
    stderr: r.stderr,
    listing: fs.readdirSync(cwd),
    log: logText,
    urls: logText.split('\n').filter((l) => l.startsWith('https://')),
  };
}
const PINNED_URLS = [
  'https://www.google.com/search?q=%22Sample%20Speaker%22%20edtech%20tutoring&num=5',
  'https://www.google.com/search?q=%22Sample%20Speaker%22%20advisor%20linkedin%20OR%20crunchbase%20OR%20twitter&num=5',
  'https://www.google.com/search?q=%22Sample%20Speaker%22%20edtech%20tutoring%20&num=5',
];
function maskDate(s) {
  return s.split('\n').map((l) => (l.startsWith('**Searched:** ') ? '**Searched:** <date>' : l)).join('\n');
}

const plainRoom = makeRoom('room-plain');

pyLeg('F. whole script, plain name: 3 pinned URLs, OLD equals NEW, profile unchanged', () => {
  needOracle();
  const before = fs.readFileSync(plainRoom.profile);
  const n = runScript(NEW_SCRIPT, plainRoom.room, 'Sample Speaker', 'edtech tutoring');
  const o = runScript(OLD_SCRIPT, plainRoom.room, 'Sample Speaker', 'edtech tutoring');
  for (const [label, r] of [['NEW', n], ['OLD', o]]) {
    assert.equal(r.status, 0, label + ' rc: ' + r.stderr);
    assert.deepEqual(r.listing, [], label + ' cwd must stay empty');
    assert.deepEqual(r.urls, PINNED_URLS, label + ' URLs');
    assert.ok(r.stdout.startsWith('## Research: Sample Speaker'), label + ' stdout head');
    assert.ok(r.stdout.includes('Web search not available'), label + ' stdout must say the search is not available');
  }
  assert.equal(maskDate(n.stdout), maskDate(o.stdout), 'stdout OLD vs NEW');
  assert.equal(n.log, o.log, 'curl log OLD vs NEW');
  assert.ok(fs.readFileSync(plainRoom.profile).equals(before), 'PROFILE.md must not change');
});

pyLeg('G1. whole script, break-out speaker name: no marker, pinned first URL', () => {
  const r = runScript(NEW_SCRIPT, plainRoom.room, PROOF_NAME, 'edtech tutoring');
  assert.deepEqual(r.listing, [], 'the cwd must stay empty (a marker means code ran)');
  assert.equal(r.status, 0, 'rc: ' + r.stderr);
  assert.equal(r.urls.length, 3, 'curl stub must record 3 URLs');
  assert.equal(r.urls[0], 'https://www.google.com/search?q=' + PROOF_QUERY1_ENC + '&num=5');
});

pyLeg('G2. whole script, $( ) speaker name: no marker', () => {
  const r = runScript(NEW_SCRIPT, plainRoom.room, SUBST_NAME, 'edtech tutoring');
  assert.deepEqual(r.listing, [], 'the cwd must stay empty');
  assert.equal(r.status, 0, 'rc: ' + r.stderr);
  assert.equal(r.urls.length, 3, 'curl stub must record 3 URLs');
});

leg("H. source pins: 1 curl line, 0 lines that hold quote('", () => {
  const code = newText().split('\n').filter((l) => !l.trimStart().startsWith('#'));
  assert.equal(code.filter((l) => l.includes('curl ')).length, 1, 'lines that hold "curl "');
  assert.equal(code.filter((l) => l.includes("quote('")).length, 0, "lines that hold quote('");
});

for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

if (failures === 0) {
  console.log('research-speaker-urlencode: ALL PASS');
  process.exit(0);
} else {
  console.log('research-speaker-urlencode: ' + failures + ' FAILED');
  process.exit(1);
}
