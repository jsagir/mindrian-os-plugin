'use strict';
/*
 * Phase 386 plan 10, defect B5.
 * One compaction opens exactly 1 session row, and scripts/post-compact prints
 * only the keys that the PostCompact event allows.
 *
 * Canon Part 8: fixture room and temporary HOME only. Assert on counts, key
 * names and booleans. Never print file content.
 *
 * Arms:
 *   C1 one compaction adds 1 row, in both hook orders
 *   C2 post-compact with no saved state, and with a stale state, prints allowed keys only
 *   C3 post-compact with a saved state keeps its valid envelope (pin)
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const ML = path.join(REPO, 'scripts', 'memory-lifecycle.cjs');
const POST_COMPACT = path.join(REPO, 'scripts', 'post-compact');
const ALLOWED = new Set(['continue', 'stopReason', 'suppressOutput', 'systemMessage']);

const TMPS = [];
process.on('exit', () => { for (const d of TMPS) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} } });

function mkFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't386-10a-'));
  TMPS.push(tmp);
  const home = path.join(tmp, 'home');
  const rh = path.join(tmp, 'rooms-home');
  const room = path.join(rh, 'venture');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(room, '.room-root'), '');
  fs.mkdirSync(path.join(room, 'market'), { recursive: true });
  fs.writeFileSync(path.join(room, 'market', 'ROOM.md'), '# market\n');
  const env = Object.assign({}, process.env, {
    HOME: home,
    MINDRIAN_ROOMS_HOME: rh,
    MINDRIAN_ROOMS_ROOT: rh,
    CLAUDE_PLUGIN_ROOT: REPO,
    SESSION_START_NODE_PREFLIGHT_SKIP: '1',
  });
  delete env.CLAUDE_ACTIVE_ROOM;
  delete env.CURSOR_PLUGIN_ROOT;
  return { tmp, home, room, env };
}

function countRows(room) {
  const rdb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
  const db = rdb.openRoomDb(room);
  try { return db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n; }
  finally { rdb.closeRoomDb({ db }); }
}

function ml(fx, sub) {
  return spawnSync(process.execPath, [ML, sub, fx.room], { env: fx.env, encoding: 'utf8', timeout: 20000 });
}

function runPostCompact(fx) {
  return spawnSync('bash', [POST_COMPACT], { cwd: fx.room, env: fx.env, encoding: 'utf8', timeout: 60000 });
}

function writeState(fx, ageSeconds) {
  const dir = path.join(fx.home, '.mindrian', 'bridge');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'pre-compact-state.json');
  fs.writeFileSync(f, [
    'TIMESTAMP=' + new Date().toISOString(),
    'ROOM_DIR=' + fx.room,
    'VENTURE_STAGE=validated',
    'TOTAL_ENTRIES=3',
    '---STATE_MD_START---', '# State', '---STATE_MD_END---',
    '---LAST_ARTIFACTS_START---', '---LAST_ARTIFACTS_END---',
    '---MINTO_CONFIDENCE_START---', '---MINTO_CONFIDENCE_END---',
    '---PIPELINE_STATE_START---', '---PIPELINE_STATE_END---',
    '---USER_CONTEXT_START---', '---USER_CONTEXT_END---', '',
  ].join('\n'));
  if (ageSeconds) {
    const t = new Date(Date.now() - ageSeconds * 1000);
    fs.utimesSync(f, t, t);
  }
  return f;
}

function keysOf(stdout) {
  try {
    const j = JSON.parse(stdout);
    return j && typeof j === 'object' ? j : null;
  } catch (_) { return null; }
}

function onlyAllowed(j) {
  if (!j) return false;
  const ks = Object.keys(j);
  return ks.every((k) => ALLOWED.has(k)) && !('hookSpecificOutput' in j);
}

let failed = 0;
function check(label, cond, detail) {
  if (cond) { console.log('ok - ' + label); return; }
  failed += 1;
  console.log('FAIL - ' + label + (detail ? ' :: ' + detail : ''));
}

// C1: SessionStart(compact) then PostCompact, and the reverse order.
{
  const fx = mkFixture();
  const before = countRows(fx.room);
  ml(fx, 'session-start');
  ml(fx, 'post-compact');
  const added = countRows(fx.room) - before;
  check('C1 one compaction adds 1 row (SessionStart then PostCompact)', added === 1, 'added=' + added);

  const fx2 = mkFixture();
  const before2 = countRows(fx2.room);
  ml(fx2, 'post-compact');
  ml(fx2, 'session-start');
  const added2 = countRows(fx2.room) - before2;
  check('C1 one compaction adds 1 row (PostCompact then SessionStart)', added2 === 1, 'added=' + added2);
}

// C2: no saved state, and a stale saved state.
{
  const fx = mkFixture();
  const r = runPostCompact(fx);
  const j = keysOf(r.stdout);
  check('C2 no saved state prints allowed keys only',
    r.status === 0 && onlyAllowed(j),
    'status=' + r.status + ' keys=' + (j ? Object.keys(j).join(',') : 'unparsed'));

  const fx2 = mkFixture();
  writeState(fx2, 3600);
  const r2 = runPostCompact(fx2);
  const j2 = keysOf(r2.stdout);
  check('C2 stale saved state prints allowed keys only',
    r2.status === 0 && onlyAllowed(j2),
    'status=' + r2.status + ' keys=' + (j2 ? Object.keys(j2).join(',') : 'unparsed'));
}

// C3: fresh saved state keeps the valid envelope with a systemMessage.
{
  const fx = mkFixture();
  writeState(fx, 0);
  const r = runPostCompact(fx);
  const j = keysOf(r.stdout);
  check('C3 saved state keeps a valid envelope with systemMessage',
    r.status === 0 && onlyAllowed(j) && typeof j.systemMessage === 'string' && j.systemMessage.length > 0,
    'status=' + r.status + ' keys=' + (j ? Object.keys(j).join(',') : 'unparsed'));
  const side = path.join(fx.room, '.mindrian', 'last-post-compact.md');
  check('C3 saved state still writes the side channel', fs.existsSync(side));
}

process.exit(failed ? 1 : 0);
