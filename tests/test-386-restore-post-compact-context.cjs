'use strict';
/*
 * Phase 386 plan 10, defect B9.
 * restore-post-compact-context contribute() returns the side-channel fragment
 * for the active room.
 *
 * Canon Part 8: fixture room and temporary HOME only. Assert on booleans and
 * counts. Never print file content.
 *
 * Arms:
 *   C4 a fresh stamped file in the active room gives a non-empty fragment
 *   C5 no file, and no active room, give an empty fragment and never throw
 *   C6 a file stamped for another room is not returned (the cross-room check stays)
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const CONSUMER = path.join(REPO, 'scripts', 'restore-post-compact-context.cjs');

const TMPS = [];
process.on('exit', () => { for (const d of TMPS) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} } });

function mkFixture(opts) {
  const o = opts || {};
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't386-10b-'));
  TMPS.push(tmp);
  const home = path.join(tmp, 'home');
  const rh = path.join(home, 'MindrianRooms');
  const room = path.join(rh, 'venture');
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(room, '.room-root'), '');
  fs.mkdirSync(path.join(room, 'market'), { recursive: true });
  fs.writeFileSync(path.join(room, 'market', 'ROOM.md'), '# market\n\nSynthetic identity text.\n');
  if (!o.noRegistry) {
    fs.mkdirSync(path.join(rh, '.rooms'), { recursive: true });
    fs.writeFileSync(path.join(rh, '.rooms', 'registry.json'), JSON.stringify({
      active: 'venture',
      rooms: { venture: { path: 'venture' } },
    }));
  }
  const env = Object.assign({}, process.env, {
    HOME: home,
    MINDRIAN_ROOMS_HOME: rh,
    MINDRIAN_ROOMS_ROOT: rh,
  });
  delete env.CLAUDE_ACTIVE_ROOM;
  return { tmp, home, rh, room, env };
}

function writeSide(fx, stamp) {
  const p = path.join(fx.room, '.mindrian', 'last-post-compact.md');
  const s = Object.assign({
    source_room_path: fx.room,
    source_room_slug: 'venture',
    written_at: new Date().toISOString(),
    schema_version: '1',
  }, stamp || {});
  fs.writeFileSync(p, [
    '---',
    'source_room_path: ' + s.source_room_path,
    'source_room_slug: ' + s.source_room_slug,
    'written_at: ' + s.written_at,
    'schema_version: ' + s.schema_version,
    '---', '', 'synthetic body', '',
  ].join('\n'));
  return p;
}

// Run contribute() in a child so env and cwd are the fixture's.
function runContribute(fx) {
  const code = [
    "const c = require(" + JSON.stringify(CONSUMER) + ");",
    "let out; try { out = c.contribute(); } catch (e) { process.stdout.write(JSON.stringify({ threw: true })); process.exit(0); }",
    "process.stdout.write(JSON.stringify({ threw: false, has_payload: !!(out && out.has_payload), payload_len: out && typeof out.full_payload === 'string' ? out.full_payload.length : 0 }));",
  ].join('\n');
  const r = spawnSync(process.execPath, ['-e', code], { cwd: fx.room, env: fx.env, encoding: 'utf8', timeout: 20000 });
  try { return JSON.parse(r.stdout); } catch (_) { return { threw: true, parse_error: true }; }
}

function listForensic(fx, kind) {
  const dir = path.join(fx.room, '.mindrian');
  return fs.readdirSync(dir).filter((n) => n.startsWith('.last-post-compact-' + kind + '-'));
}

let failed = 0;
function check(label, cond, detail) {
  if (cond) { console.log('ok - ' + label); return; }
  failed += 1;
  console.log('FAIL - ' + label + (detail ? ' :: ' + detail : ''));
}

// C4
{
  const fx = mkFixture();
  writeSide(fx);
  const r = runContribute(fx);
  check('C4 contribute returns a non-empty fragment for the active room',
    r.threw === false && r.has_payload === true && r.payload_len > 0,
    JSON.stringify(r));
  check('C4 the file is consumed after the fragment is built', listForensic(fx, 'consumed').length === 1);
}

// C5
{
  const fx = mkFixture();
  const r = runContribute(fx);
  check('C5 no file gives an empty fragment and no throw', r.threw === false && r.has_payload === false, JSON.stringify(r));

  const fx2 = mkFixture({ noRegistry: true });
  writeSide(fx2);
  const r2 = runContribute(fx2);
  check('C5 no active room gives an empty fragment and no throw', r2.threw === false && r2.has_payload === false, JSON.stringify(r2));
}

// C6
{
  const fx = mkFixture();
  writeSide(fx, { source_room_slug: 'other-room', source_room_path: path.join(fx.rh, 'other-room') });
  const r = runContribute(fx);
  check('C6 a file stamped for another room is not returned', r.threw === false && r.has_payload === false, JSON.stringify(r));
  check('C6 the foreign file is never marked consumed', listForensic(fx, 'consumed').length === 0);
}

process.exit(failed ? 1 : 0);
