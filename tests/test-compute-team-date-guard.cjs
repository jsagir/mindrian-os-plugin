'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261029-u8x -- a room date must never reach python3 as program text.
 * RCA: .planning/debug/compute-team-analyze-room-python-date-fallback-injection.md
 *
 * scripts/compute-team and scripts/analyze-room each carry the function
 * portable_date_to_epoch. When GNU date -d and BSD date -j both fail, the old
 * last link pasted the frontmatter date into python3 -c program text. A crafted
 * last_active (team profile) or last_updated (funding STATUS.md) ran code.
 *
 * Legs:
 *   A. function level, crafted value: stdout 0, no marker (both scripts);
 *   B. function level, shapes that GNU date accepts (plain date, ISO
 *      timestamp, trailing space, CR): the epoch equals date -d (no change);
 *   C. forced python3 fallback (a stub date that exits 1 first on PATH):
 *      2026-01-15 and 2026-1-5 keep their epochs, the ISO timestamp gives 0,
 *      the crafted value gives 0 and no marker;
 *   D. compute-team whole script: crafted last_active, no marker, output equal
 *      to the not-a-date run; trend legs for 4 date shapes;
 *   E. analyze-room whole script: crafted last_updated, no marker, stdout
 *      equal to the not-a-date run; a valid date gives FUND_STALE;
 *   F. source pins: the guarded argv python3 link, the two date links
 *      unchanged, no program text interpolation.
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
const SCRIPTS = {
  'compute-team': path.join(ROOT, 'scripts', 'compute-team'),
  'analyze-room': path.join(ROOT, 'scripts', 'analyze-room'),
};

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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'test-u8x-date-' + label + '-'));
  tmpRoots.push(d);
  return d;
}
function assertUnderTmp(p) {
  assert.ok(p.startsWith(os.tmpdir()), 'room path must live under os.tmpdir(): ' + p);
}

// Payload: one python expression that creates a marker file in the cwd.
const TEAM_MARKER = 'mos-team-proof';
const FUND_MARKER = 'mos-fund-proof';
const TEAM_PAYLOAD = "'+str(__import__('os').system('touch " + TEAM_MARKER + "'))+'";
// analyze-room reads last_updated through xargs, which strips quotes and
// backslashes. Backslash-escaped quotes survive xargs as plain quotes.
const FUND_PAYLOAD_RAW = "\\'+str(__import__(\\'os\\').system(\\'touch " + FUND_MARKER + "\\'))+\\'";

function extractFunction(scriptPath) {
  const lines = fs.readFileSync(scriptPath, 'utf8').split('\n');
  const start = lines.findIndex((l) => l === 'portable_date_to_epoch() {');
  assert.ok(start >= 0, 'portable_date_to_epoch not found in ' + scriptPath);
  let end = -1;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i] === '}') { end = i; break; }
  }
  assert.ok(end > start, 'function end not found in ' + scriptPath);
  return lines.slice(start, end + 1).join('\n');
}

function callFn(scriptName, value, opts) {
  const o = opts || {};
  const cwd = mkTmp('fn');
  const fn = extractFunction(SCRIPTS[scriptName]);
  const env = Object.assign({}, process.env);
  if (o.stubDir) env.PATH = o.stubDir + path.delimiter + process.env.PATH;
  const r = spawnSync('bash', ['-c', fn + '\nportable_date_to_epoch "$1"', 'bash', value], {
    cwd, env, encoding: 'utf8', timeout: 60000,
  });
  return { stdout: r.stdout, stderr: r.stderr, status: r.status, cwd };
}

function dateEpoch(str) {
  const r = spawnSync('date', ['-d', str, '+%s'], { encoding: 'utf8' });
  assert.equal(r.status, 0, 'date -d failed for ' + JSON.stringify(str));
  return r.stdout;
}

function hasPython() {
  const r = spawnSync('python3', ['--version'], { encoding: 'utf8' });
  return r.status === 0;
}

function localDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

const NAMES = Object.keys(SCRIPTS);

// ---------------------------------------------------------------------------
// A. function level, crafted value
// ---------------------------------------------------------------------------
for (const name of NAMES) {
  leg('A. ' + name + ': crafted value gives 0 and creates no marker (function level)', () => {
    const r = callFn(name, TEAM_PAYLOAD);
    assert.equal(fs.existsSync(path.join(r.cwd, TEAM_MARKER)), false, 'marker file exists: python3 ran room text');
    assert.equal(r.stdout, '0\n');
  });
}

// ---------------------------------------------------------------------------
// B. function level, shapes GNU date accepts: epoch equals date -d
// ---------------------------------------------------------------------------
const SHAPES = [
  ['plain date', '2026-01-15'],
  ['ISO timestamp', '2026-10-01T12:00:00Z'],
  ['trailing space', '2026-10-01 '],
  ['CR line ending', '2026-10-01\r'],
];
for (const name of NAMES) {
  for (const [label, value] of SHAPES) {
    leg('B. ' + name + ': ' + label + ' keeps its date -d epoch (one line)', () => {
      const want = dateEpoch(value);
      const r = callFn(name, value);
      assert.equal(r.stdout, want);
    });
  }
}

// ---------------------------------------------------------------------------
// C. forced python3 fallback (stub date exits 1)
// ---------------------------------------------------------------------------
const stubDir = mkTmp('stub');
fs.writeFileSync(path.join(stubDir, 'date'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
const WANT_0115 = dateEpoch('2026-01-15');
const WANT_0105 = dateEpoch('2026-01-05');
for (const name of NAMES) {
  leg('C. ' + name + ': forced python3: 2026-01-15 keeps its epoch', () => {
    if (!hasPython()) { console.log('    skip - python3 absent'); return; }
    assert.equal(callFn(name, '2026-01-15', { stubDir }).stdout, WANT_0115);
  });
  leg('C. ' + name + ': forced python3: 2026-1-5 keeps its epoch', () => {
    if (!hasPython()) { console.log('    skip - python3 absent'); return; }
    assert.equal(callFn(name, '2026-1-5', { stubDir }).stdout, WANT_0105);
  });
  leg('C. ' + name + ': forced python3: ISO timestamp gives 0', () => {
    if (!hasPython()) { console.log('    skip - python3 absent'); return; }
    assert.equal(callFn(name, '2026-10-01T12:00:00Z', { stubDir }).stdout, '0\n');
  });
  leg('C. ' + name + ': forced python3: crafted value gives 0 and creates no marker', () => {
    if (!hasPython()) { console.log('    skip - python3 absent'); return; }
    const r = callFn(name, TEAM_PAYLOAD, { stubDir });
    assert.equal(fs.existsSync(path.join(r.cwd, TEAM_MARKER)), false, 'marker file exists: python3 ran room text');
    assert.equal(r.stdout, '0\n');
  });
}

// ---------------------------------------------------------------------------
// D. compute-team whole script
// ---------------------------------------------------------------------------
function buildTeamRoom(base, profiles) {
  const room = path.join(base, 'room');
  assertUnderTmp(room);
  fs.rmSync(room, { recursive: true, force: true });
  for (const p of profiles) {
    const dir = path.join(room, 'team', p.dir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'PROFILE.md'),
      '---\nname: ' + p.dir + '\nrole: researcher\nstatus: ' + (p.status || 'active') +
        '\nlast_active: ' + p.lastActive + '\n---\n# Profile\n'
    );
  }
  return room;
}
function runScript(scriptName, room, cwd) {
  return spawnSync('bash', [SCRIPTS[scriptName], room], { cwd, encoding: 'utf8', timeout: 60000 });
}
function normalizeTeamState(text, crafted) {
  let t = text.split('\n').filter((l) => !l.startsWith('computed:')).join('\n');
  if (crafted) t = t.split(crafted).join('not-a-date');
  return t;
}

leg('D. compute-team: crafted last_active creates no marker and the output equals the not-a-date run', () => {
  const base = mkTmp('team');
  const room = buildTeamRoom(base, [{ dir: 'x', lastActive: TEAM_PAYLOAD }]);
  const r1 = runScript('compute-team', room, base);
  assert.equal(fs.existsSync(path.join(base, TEAM_MARKER)), false, 'marker file exists: python3 ran room text');
  assert.equal(r1.status, 0, 'compute-team rc: ' + r1.stderr);
  const s1 = normalizeTeamState(fs.readFileSync(path.join(room, 'team', 'TEAM-STATE.md'), 'utf8'), TEAM_PAYLOAD);
  const room2 = buildTeamRoom(base, [{ dir: 'x', lastActive: 'not-a-date' }]);
  const r2 = runScript('compute-team', room2, base);
  assert.equal(r2.status, 0);
  const s2 = normalizeTeamState(fs.readFileSync(path.join(room2, 'team', 'TEAM-STATE.md'), 'utf8'), null);
  assert.equal(r1.stdout, r2.stdout);
  assert.equal(s1, s2);
  assert.ok(s2.includes('| x | active | 0 | not-a-date | unknown |'), 'trend must be unknown for the not-a-date run');
});

leg('D. compute-team: trend for 4 date shapes', () => {
  const base = mkTmp('trend');
  const today = localDate(0);
  const room = buildTeamRoom(base, [
    { dir: 't1', lastActive: today },
    { dir: 't2', lastActive: today + 'T12:00:00Z' },
    { dir: 't3', lastActive: localDate(-20) },
    { dir: 't4', lastActive: localDate(-60), status: 'active' },
  ]);
  const r = runScript('compute-team', room, base);
  assert.equal(r.status, 0, 'compute-team rc: ' + r.stderr);
  const text = fs.readFileSync(path.join(room, 'team', 'TEAM-STATE.md'), 'utf8');
  const trend = (n) => {
    const line = text.split('\n').find((l) => l.startsWith('| ' + n + ' | active | 0 |'));
    assert.ok(line, 'activity row for ' + n);
    return line.split('|')[5].trim();
  };
  assert.equal(trend('t1'), 'consistent');
  assert.equal(trend('t2'), 'consistent');
  assert.equal(trend('t3'), 'occasional');
  assert.equal(trend('t4'), 'declining');
});

// ---------------------------------------------------------------------------
// E. analyze-room whole script
// ---------------------------------------------------------------------------
function buildFundRoom(base, lastUpdated) {
  const room = path.join(base, 'room');
  assertUnderTmp(room);
  fs.rmSync(room, { recursive: true, force: true });
  fs.mkdirSync(path.join(room, 'opportunity-bank'), { recursive: true });
  fs.mkdirSync(path.join(room, 'funding', 'f1'), { recursive: true });
  fs.writeFileSync(
    path.join(room, 'funding', 'f1', 'STATUS.md'),
    '---\nstage: discovered\nlast_updated: ' + lastUpdated + '\n---\n'
  );
  return room;
}

leg('E. analyze-room: crafted last_updated creates no marker and stdout equals the not-a-date run', () => {
  const base = mkTmp('fund');
  const room = buildFundRoom(base, FUND_PAYLOAD_RAW);
  const r1 = runScript('analyze-room', room, base);
  assert.equal(fs.existsSync(path.join(base, FUND_MARKER)), false, 'marker file exists: python3 ran room text');
  assert.equal(r1.status, 0, 'analyze-room rc: ' + r1.stderr);
  assert.ok(r1.stdout.includes('FUND_STAGE:discovered:1'), 'funding block must have run');
  const room2 = buildFundRoom(base, 'not-a-date');
  const r2 = runScript('analyze-room', room2, base);
  assert.equal(r2.status, 0);
  assert.equal(r1.stdout, r2.stdout);
});

leg('E. analyze-room: a valid last_updated 30 days ago gives FUND_STALE', () => {
  const base = mkTmp('stale');
  const room = buildFundRoom(base, localDate(-30));
  const r = runScript('analyze-room', room, base);
  assert.equal(r.status, 0, 'analyze-room rc: ' + r.stderr);
  const line = r.stdout.split('\n').find((l) => l.startsWith('FUND_STALE:f1:'));
  assert.ok(line, 'FUND_STALE line missing');
  assert.match(line, /^FUND_STALE:f1:(29|30|31)$/);
});

// ---------------------------------------------------------------------------
// F. source pins (includes(), not a regex)
// ---------------------------------------------------------------------------
const C2_LINE =
  '    || { [[ "$datestr" =~ ^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$ ]] && python3 -c \'import sys; from datetime import datetime; print(int(datetime.strptime(sys.argv[1], "%Y-%m-%d").timestamp()))\' "$datestr" 2>/dev/null; } \\';
const DATE_D_LINK = '  date -d "$datestr" +%s 2>/dev/null \\';
const DATE_J_LINK = '    || date -j -f "%Y-%m-%d" "$datestr" +%s 2>/dev/null \\';
function countOf(hay, needle) {
  return hay.split(needle).length - 1;
}
for (const name of NAMES) {
  leg('F. ' + name + ': source pins for the guarded argv python3 link', () => {
    const src = fs.readFileSync(SCRIPTS[name], 'utf8');
    assert.equal(countOf(src, C2_LINE), 1, 'C-2 python3 link line must appear once');
    assert.equal(countOf(src, 'strptime(sys.argv[1]'), 1, 'strptime(sys.argv[1] must appear once');
    assert.equal(countOf(src, DATE_D_LINK), 1, 'date -d link must be unchanged');
    assert.equal(countOf(src, DATE_J_LINK), 1, 'date -j -f link must be unchanged');
    assert.equal(src.includes("strptime('$datestr'"), false, 'no datestr in python program text');
    const fn = extractFunction(SCRIPTS[name]);
    const lines = fn.split('\n');
    assert.equal(lines[1], '  local datestr="$1"');
    assert.equal(lines[2], DATE_D_LINK, 'the line after local datestr must be the date -d link');
    assert.ok(fn.indexOf(C2_LINE) > fn.indexOf(DATE_J_LINK), 'guard must sit after the date -j -f link');
    assert.ok(fn.includes('    || echo "0"'), 'echo 0 tail must stay');
  });
}

for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* best effort */ }
}
console.log(failures ? 'compute-team-date-guard: ' + failures + ' FAILED' : 'compute-team-date-guard: ALL PASS');
process.exit(failures ? 1 : 0);
