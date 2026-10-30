'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261029-u8x -- a room date must never reach python3 as program text.
 * RCA: .planning/debug/compute-team-analyze-room-python-date-fallback-injection.md
 *
 * scripts/compute-team and scripts/analyze-room each carried the function
 * portable_date_to_epoch. When GNU date -d and BSD date -j both failed, the old
 * last link pasted the frontmatter date into python3 -c program text. A crafted
 * last_active (team profile) or last_updated (funding STATUS.md) ran code.
 *
 * Phase 381 plan 381-09 removed the bash bodies (and with them the function
 * and every python3 link) after the recorded zero-diff run; both scripts now
 * exec lib/core/room-render.cjs. The function-level legs A, B and C of quick
 * 261029-u8x read the function from the script and are retired with it. The
 * OLD oracle (git archive of BASE_SHA, tests/helpers/oracle-381.cjs) still
 * carries the guarded function, and the hostile room of tests/test-381-parity.cjs
 * proves NEW equal to it byte for byte.
 *
 * Legs:
 *   D. compute-team whole script: crafted last_active, no marker, output equal
 *      to the not-a-date run; trend legs for 4 date shapes;
 *   E. analyze-room whole script: crafted last_updated, no marker, stdout
 *      equal to the not-a-date run; a valid date gives FUND_STALE;
 *   F. source pins (re-pinned by 381-09): no portable_date_to_epoch, no
 *      python3, no strptime and no date -d in either entry point; each one
 *      execs the node renderer.
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

function localDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

const NAMES = Object.keys(SCRIPTS);

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
// F. source pins (re-pinned by plan 381-09; includes(), not a regex)
// ---------------------------------------------------------------------------
const MODES = { 'compute-team': 'team', 'analyze-room': 'analyze' };
for (const name of NAMES) {
  leg('F. ' + name + ': no date helper and no python3 link remain; the entry point execs the node renderer', () => {
    const src = fs.readFileSync(SCRIPTS[name], 'utf8');
    assert.equal(src.includes('portable_date_to_epoch'), false, 'portable_date_to_epoch must be gone');
    assert.equal(src.includes('python3'), false, 'python3 must be gone');
    assert.equal(src.includes('strptime'), false, 'strptime must be gone');
    assert.equal(src.includes('date -d'), false, 'date -d must be gone');
    assert.equal(src.includes('node -e'), false, 'node -e must be gone');
    const exec = 'NODE_NO_WARNINGS=1 exec node "${SCRIPT_DIR}/../lib/core/room-render.cjs" ' + MODES[name] + ' "$@"';
    assert.equal(src.split('\n').filter((l) => l === exec).length, 1, 'exactly one exec line for ' + name);
  });
}

for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* best effort */ }
}
console.log(failures ? 'compute-team-date-guard: ' + failures + ' FAILED' : 'compute-team-date-guard: ALL PASS');
process.exit(failures ? 1 : 0);
