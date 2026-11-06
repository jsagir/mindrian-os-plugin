'use strict';
/*
 * Phase 386 plan 12 (B8): a dial-memory refresh must not mark an unchanged
 * section stale. Fixture room only (Canon Part 8). Node built-ins plus the
 * repo modules.
 *
 *   D1 after a refresh on an unchanged section, whose MINTO is newer than its
 *      artifacts, the stale check (sync and async) still returns fresh.
 *   D2 a real artifact edit after MINTO still returns stale (pin).
 *   D3 the refresh still updates the dial watermark (pin).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

try { require('node:sqlite'); } catch (_) {
  process.stdout.write('SKIP test-386-dial-memory-stale.cjs (node:sqlite unavailable)\n');
  process.exit(0);
}

const ROOT = path.resolve(__dirname, '..');
const folderMemory = require(path.join(ROOT, 'lib', 'core', 'folder-memory.cjs'));
const folderMemoryAsync = require(path.join(ROOT, 'lib', 'core', 'folder-memory-async.cjs'));
const runner = require(path.join(ROOT, 'lib', 'core', 'feynman', 'dial-memory-runner.cjs'));
const { openRoomDb } = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));

const SECTION = 'problem-definition';
let failures = 0;
function check(label, cond, detail) {
  if (cond) process.stdout.write('ok - ' + label + '\n');
  else { failures++; process.stdout.write('FAIL - ' + label + (detail ? ' :: ' + detail : '') + '\n'); }
}

const roots = [];
process.on('exit', () => { for (const r of roots) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_) {} } });

const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');

// A section where MINTO.md is newer than the artifact and FEYNMAN.md.
function buildRoom() {
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'b8-386-12-'));
  roots.push(room);
  const dir = path.join(room, SECTION);
  fs.mkdirSync(dir, { recursive: true });
  const old = Date.now() - 3600e3;
  const mintoMs = old + 1800e3;
  fs.writeFileSync(path.join(dir, 'artifact.md'), '# fixture artifact\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'FEYNMAN.md'), '# fixture memory\n\nbody\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'MINTO.md'),
    '---\nschema_version: "v88"\ngoverning_thought: "fixture thought"\n' +
    'last_generated_at: "' + iso(mintoMs) + '"\nlast_artifact_write_seen_at: "' + iso(old) + '"\n' +
    'decision_log: []\n---\nbody\n', 'utf8');
  const touch = (name, ms) => fs.utimesSync(path.join(dir, name), ms / 1000, ms / 1000);
  touch('artifact.md', old);
  touch('FEYNMAN.md', old);
  touch('MINTO.md', mintoMs);
  return { room, dir, touch };
}

async function main() {
  // Baseline: fresh before any refresh (sanity for the fixture).
  {
    const { dir } = buildRoom();
    const r = folderMemory.readTriple(dir).reasoning;
    check('fixture is fresh before the refresh', r.is_stale === false, 'stale_reason=' + r.stale_reason);
  }

  // D1 sync and async.
  {
    const { room, dir } = buildRoom();
    const db = openRoomDb(room);
    const res = runner.refreshSection(room, SECTION, { db, now_ms: Date.now() });
    check('D1 setup: refresh status is refreshed', res.status === 'refreshed', JSON.stringify(res));
    const s = folderMemory.readTriple(dir).reasoning;
    check('D1 sync readTriple stays fresh after a dial-memory refresh',
      s.is_stale === false, 'is_stale=' + s.is_stale + ' stale_reason=' + s.stale_reason);
    const a = (await folderMemoryAsync.readTriple(dir)).reasoning;
    check('D1 async readTriple stays fresh after a dial-memory refresh',
      a.is_stale === false, 'is_stale=' + a.is_stale + ' stale_reason=' + a.stale_reason);
    db.close();
  }

  // D2: a real artifact edit after MINTO is still stale.
  {
    const { room, dir } = buildRoom();
    const db = openRoomDb(room);
    runner.refreshSection(room, SECTION, { db, now_ms: Date.now() });
    const later = Date.now() + 60e3;
    fs.writeFileSync(path.join(dir, 'artifact.md'), '# fixture artifact edited\n', 'utf8');
    fs.utimesSync(path.join(dir, 'artifact.md'), later / 1000, later / 1000);
    const s = folderMemory.readTriple(dir).reasoning;
    check('D2 a real artifact edit after MINTO is stale',
      s.is_stale === true && s.stale_reason === 'artifacts_newer_than_minto',
      'is_stale=' + s.is_stale + ' stale_reason=' + s.stale_reason);
    db.close();
  }

  // D3: the refresh still writes the dial watermark.
  {
    const { room, dir } = buildRoom();
    const db = openRoomDb(room);
    const res = runner.refreshSection(room, SECTION, { db, now_ms: Date.now() });
    const text = fs.readFileSync(path.join(dir, 'FEYNMAN.md'), 'utf8');
    check('D3 the dial watermark is written',
      res.status === 'refreshed' && text.indexOf(runner.WATERMARK_KEY + ': ') !== -1);
    db.close();
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { process.stdout.write('FAIL - unexpected error :: ' + (e && e.message) + '\n'); process.exit(1); });
