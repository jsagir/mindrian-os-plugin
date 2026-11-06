'use strict';
/*
 * Phase 386 plan 14 (B13): the "new/modified since last session" count in
 * .context/last-session.md must be measured from the previous session, not
 * from the previous turn. Fixture room only (Canon Part 8): HOME and the
 * rooms home are temp directories, and scripts/on-stop runs from a temp
 * workspace.
 *
 *   L1 two Stops with the same session_id report the same count.
 *   L2 a new session_id moves the baseline (the earlier file is not counted).
 *   L3 no session_id keeps the old behavior (baseline moves each Stop).
 *   L4 last-session.md keeps its sections.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ON_STOP = path.join(ROOT, 'scripts', 'on-stop');

let failures = 0;
function check(label, cond, detail) {
  if (cond) process.stdout.write('ok - ' + label + '\n');
  else { failures++; process.stdout.write('FAIL - ' + label + (detail ? ' :: ' + detail : '') + '\n'); }
}

const tmpRoots = [];
process.on('exit', () => { for (const r of tmpRoots) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_) {} } });

function buildFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'b13-386-14-'));
  tmpRoots.push(tmp);
  const home = path.join(tmp, 'home');
  fs.mkdirSync(home);
  const work = path.join(tmp, 'work');
  const room = path.join(work, 'room');
  fs.mkdirSync(path.join(room, '.context'), { recursive: true });
  fs.mkdirSync(path.join(room, 'sec'), { recursive: true });
  fs.writeFileSync(path.join(room, 'STATE.md'), '# State\nStage: Discovery\n', 'utf8');
  fs.writeFileSync(path.join(room, 'ROOM.md'), '# Room\n', 'utf8');
  const ls = path.join(room, '.context', 'last-session.md');
  fs.writeFileSync(ls, '# Last Session Log\n', 'utf8');
  const nowS = Date.now() / 1000;
  const at = (p, t) => fs.utimesSync(p, t, t);
  // The previous session ended 1000 s ago.
  at(ls, nowS - 1000);
  const f1 = path.join(room, 'sec', 'a.md');
  const f2 = path.join(room, 'sec', 'b.md');
  fs.writeFileSync(f1, '# a\n', 'utf8');
  fs.writeFileSync(f2, '# b\n', 'utf8');
  at(f1, nowS - 900);   // changed after the previous session
  at(f2, nowS - 2000);  // old
  return { tmp, home, work, room, ls, f1, f2, at, nowS };
}

function stop(fx, sessionId) {
  const payload = sessionId ? { session_id: sessionId } : {};
  const r = spawnSync('bash', [ON_STOP], {
    cwd: fx.work,
    input: JSON.stringify(payload),
    env: Object.assign({}, process.env, {
      HOME: fx.home,
      MINDRIAN_ROOMS_HOME: path.join(fx.tmp, 'rooms'),
      MINDRIAN_MCP_FIRST: '',
    }),
    encoding: 'utf8',
    timeout: 60000,
  });
  const text = fs.existsSync(fx.ls) ? fs.readFileSync(fx.ls, 'utf8') : '';
  const m = text.match(/\*\*Count:\*\* (\d+) new\/modified since last session/);
  return { status: r.status, count: m ? Number(m[1]) : null, text };
}

// L1: same session, 2 Stops, no change between them.
{
  const fx = buildFixture();
  const a = stop(fx, 'sess-one');
  const b = stop(fx, 'sess-one');
  check('L1 first Stop counts the file changed after the previous session', a.count === 1, 'count=' + a.count);
  check('L1 second Stop of the same session reports the same count', b.count === a.count,
    'first=' + a.count + ' second=' + b.count);
}

// L2: a new session id moves the baseline.
{
  const fx = buildFixture();
  stop(fx, 'sess-one');
  stop(fx, 'sess-one');
  // The first session ended 100 s ago. One file changed 50 s ago, in the gap
  // before the new session. The earlier file (a.md) predates the first session's end.
  const nowS = Date.now() / 1000;
  fx.at(fx.ls, nowS - 100);
  fx.at(fx.f2, nowS - 50);
  const a = stop(fx, 'sess-two');
  const b = stop(fx, 'sess-two');
  check('L2 the new session counts only the file changed since the previous session ended', a.count === 1,
    'count=' + a.count);
  check('L2 a second Stop in the new session keeps that count', b.count === a.count,
    'first=' + a.count + ' second=' + b.count);
}

// L3: no session_id keeps the old behavior and does not throw.
{
  const fx = buildFixture();
  const a = stop(fx, '');
  const b = stop(fx, '');
  check('L3 no session_id: the hook exits 0 and still writes the log',
    a.status === 0 && b.status === 0 && a.count !== null && b.count !== null,
    'status=' + a.status + '/' + b.status + ' counts=' + a.count + '/' + b.count);
  check('L3 no session_id: the baseline still moves each Stop (old behavior)', a.count === 1 && b.count === 0,
    'first=' + a.count + ' second=' + b.count);
}

// L4: sections stay.
{
  const fx = buildFixture();
  const a = stop(fx, 'sess-one');
  check('L4 last-session.md keeps its sections',
    /## Session Metadata/.test(a.text) && /## Artifacts Filed/.test(a.text) && /## Signals Detected/.test(a.text));
}

process.exit(failures === 0 ? 0 : 1);
