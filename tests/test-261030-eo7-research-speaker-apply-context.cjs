'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261030-eo7 (N1) -- the project context must never reach GNU sed as
 * program text in scripts/research-speaker --apply.
 * RCA: .planning/debug/command-injection-commit-message-and-speaker-urlencode.md
 *
 * The bc75d431e cut pasted PROJECT_CONTEXT into the replacement of a sed `s`
 * command. A context such as `x; touch <marker> #/e;#` closed the replacement
 * and added the `e` flag, so sed ran the changed line as a shell command; a
 * context with the `w` flag wrote a file. A slash, an ampersand, a backslash or
 * a line break in a plain context also broke the command or changed the text.
 * The fix gives the replacement text to awk through the environment.
 *
 * Legs:
 *   A1-A2. hostile contexts (sed `e` flag, sed `w` flag): no marker, rc 0, the
 *      written profile holds the context exactly;
 *   B1-B4. contexts with a slash, an ampersand, backslashes, a line break: rc 0,
 *      the written profile holds the context exactly;
 *   C. normal contexts on 3 profile shapes: profile bytes, stdout bytes and rc
 *      equal the bc75d431e cut (oracle: git archive);
 *   D. source pins: no sed line holds PROJECT_CONTEXT; 1 ENVIRON[ line.
 *
 * curl and date are stubs first on PATH: no leg reaches the network, and the
 * date is fixed (2026-01-02). Every run uses a fresh empty cwd and a fresh room
 * under os.tmpdir().
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
const FIXED_DATE = '2026-01-02';

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
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'test-eo7-n1-' + label + '-')));
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

// Stubs first on PATH: curl records its arguments; date prints a fixed date.
const STUB_DIR = path.join(base, 'stub');
fs.mkdirSync(STUB_DIR);
fs.writeFileSync(path.join(STUB_DIR, 'curl'), "#!/bin/sh\nprintf '%s\\n' \"$@\" >> \"$CURL_STUB_LOG\"\nexit 0\n", { mode: 0o755 });
fs.writeFileSync(path.join(STUB_DIR, 'date'), '#!/bin/sh\necho ' + FIXED_DATE + '\n', { mode: 0o755 });

const BASE_PATH = [STUB_DIR, path.dirname(process.execPath), '/usr/bin', '/bin'].join(':');
let seq = 0;

const PROFILE_STD = ['---', 'role: advisor', 'research_status: pending', '---', '# Test Speaker', '[To be filled after proactive research]'].join('\n') + '\n';
const PROFILE_MULTI = [
  '---',
  'role: advisor',
  'research_status: in-progress',
  '---',
  '# Test Speaker',
  'Context: [To be filled after proactive research] and [To be filled after proactive research]',
  '[To be filled after proactive research]',
  'tail line',
].join('\n') + '\n';
const PROFILE_NONE = ['---', 'role: advisor', 'research_status: pending', '---', '# Test Speaker', 'No placeholder here.'].join('\n') + '\n';

function runApply(script, profileText, context) {
  seq += 1;
  const room = path.join(base, 'room-' + seq);
  assertUnderTmp(room);
  const dir = path.join(room, 'team', 'advisor', 'test-speaker');
  fs.mkdirSync(dir, { recursive: true });
  const profile = path.join(dir, 'PROFILE.md');
  fs.writeFileSync(profile, profileText);
  const cwd = fs.mkdtempSync(path.join(base, 'cwd-'));
  assertUnderTmp(cwd);
  const log = path.join(base, 'curl-' + seq + '.log');
  fs.writeFileSync(log, '');
  const env = {
    PATH: BASE_PATH,
    HOME: path.join(base, 'home'),
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    TZ: 'UTC',
    CURL_STUB_LOG: log,
  };
  const r = spawnSync('bash', [script, room, 'test-speaker', 'Sample Speaker', context, '--apply'], { cwd, env });
  return {
    status: r.status,
    stdout: r.stdout,
    stderr: String(r.stderr || ''),
    listing: fs.readdirSync(cwd),
    profileBytes: fs.readFileSync(profile),
    profile: fs.readFileSync(profile, 'utf8'),
    room,
    urls: fs.readFileSync(log, 'utf8').split('\n').filter((l) => l.startsWith('https://')),
  };
}

function expectedStd(context) {
  return ['---', 'role: advisor', 'research_status: complete', 'research_date: ' + FIXED_DATE, '---', '# Test Speaker',
    'Researched on ' + FIXED_DATE + ' in context of: ' + context].join('\n') + '\n';
}

function assertExact(r, context) {
  assert.deepEqual(r.listing, [], 'the cwd must stay empty (a marker means sed ran a command or wrote a file): ' + JSON.stringify(r.listing));
  assert.equal(r.status, 0, 'rc: ' + r.stderr);
  assert.equal(r.urls.length, 3, 'curl stub must record 3 URLs');
  assert.equal(r.profile, expectedStd(context), 'the written profile must hold the context exactly');
}

leg('A1. sed e-flag context: no marker, context written exactly', () => {
  const ctx = 'x; touch mos-eo7-n1-e #/e;#';
  assertExact(runApply(NEW_SCRIPT, PROFILE_STD, ctx), ctx);
});

leg('A2. sed w-flag context: no file written, context written exactly', () => {
  const ctx = 'x #/w mos-eo7-n1-w\n#';
  assertExact(runApply(NEW_SCRIPT, PROFILE_STD, ctx), ctx);
});

const SPECIAL = [
  ['B1. context with slashes', 'K-12/higher ed/edtech'],
  ['B2. context with ampersands', 'R&D & more'],
  ['B3. context with backslashes', 'C:\\path\\new \\1 end'],
  ['B4. context with a line break', 'line one\nline two'],
];
for (const [name, ctx] of SPECIAL) {
  leg(name + ': rc 0, context written exactly', () => {
    assertExact(runApply(NEW_SCRIPT, PROFILE_STD, ctx), ctx);
  });
}

const NORMAL_CONTEXTS = [
  'edtech tutoring',
  'EdTech startup building AI tutoring platform',
  'Dana O\'Sample\'s "quoted" venture; pipes | and $HOME',
  'Zo\u00eb \u00d1and\u00fa \u6771\u4eac 100% #1',
  'tab\there',
  '',
];
leg('C. normal contexts on 3 profile shapes: bytes equal the bc75d431e cut', () => {
  needOracle();
  let compared = 0;
  for (const profileText of [PROFILE_STD, PROFILE_MULTI, PROFILE_NONE]) {
    for (const ctx of NORMAL_CONTEXTS) {
      const o = runApply(OLD_SCRIPT, profileText, ctx);
      const n = runApply(NEW_SCRIPT, profileText, ctx);
      const label = JSON.stringify(ctx) + ' on profile ' + JSON.stringify(profileText.split('\n')[2]);
      assert.equal(o.status, 0, 'OLD rc for ' + label + ': ' + o.stderr);
      assert.equal(n.status, 0, 'NEW rc for ' + label + ': ' + n.stderr);
      assert.deepEqual(n.listing, []);
      assert.ok(n.profileBytes.equals(o.profileBytes), 'profile bytes for ' + label + '\nOLD ' + JSON.stringify(o.profile) + '\nNEW ' + JSON.stringify(n.profile));
      const norm = (b, room) => b.toString('utf8').split(room).join('<room>');
      assert.equal(norm(n.stdout, n.room), norm(o.stdout, o.room), 'stdout for ' + label);
      compared += 1;
    }
  }
  assert.equal(compared, 18);
  assert.equal(runApply(NEW_SCRIPT, PROFILE_STD, 'edtech tutoring').profile, expectedStd('edtech tutoring'), 'pinned standard output');
});

leg('D. source pins: no sed line holds PROJECT_CONTEXT, 1 ENVIRON[ line', () => {
  const code = fs.readFileSync(NEW_SCRIPT, 'utf8').split('\n').filter((l) => !l.trimStart().startsWith('#'));
  assert.equal(code.filter((l) => l.includes('sed ') && l.includes('PROJECT_CONTEXT')).length, 0, 'sed lines that hold PROJECT_CONTEXT');
  assert.equal(code.filter((l) => l.includes('ENVIRON[')).length, 1, 'lines that hold ENVIRON[');
});

for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

if (failures === 0) {
  console.log('research-speaker-apply-context: ALL PASS');
  process.exit(0);
} else {
  console.log('research-speaker-apply-context: ' + failures + ' FAILED');
  process.exit(1);
}
