#!/usr/bin/env node
'use strict';

/**
 * Phase 369-13 (FEED369-02, D-13) -- the room_artifact MCP read tool.
 *
 *   1. reads evidence/interview-03/interview-03.md with ok true and the right bytes
 *   2. `../outside.md` and `/etc/hosts` are refused (path_outside_room)
 *   3. a symlink inside the room that points outside it is refused
 *   4. `notes.txt` is refused as not_markdown
 *   5. a missing file answers not_found
 *   6. a 3 KB file with max_bytes 1024 answers truncated true with 1024 bytes
 *   7. an unbound session answers room_unbound
 *   8. static: no node:sqlite, no room-db, no Brain host or network token, no long
 *      dash; the description is under 400 bytes; isRealpathContained is used
 *
 * Also prints the largest .md file in the fixture room (the measurement that
 * checks the 512 KiB default; the real rooms are measured by hand, see the SUMMARY).
 *
 * Hermetic: temp HOME, USERPROFILE, MINDRIAN_ROOMS_HOME; CLAUDE_ACTIVE_ROOM and
 * CLAUDE_CODE_SESSION_ID unset. No literal em-dash or en-dash here. CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HERMETIC = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-room-artifact-'));
process.env.HOME = HERMETIC;
process.env.USERPROFILE = HERMETIC;
process.env.MINDRIAN_ROOMS_HOME = path.join(HERMETIC, 'rooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const REPO = path.resolve(__dirname, '..');
const ROOMS_HOME = process.env.MINDRIAN_ROOMS_HOME;
const { writeSessionBinding } = require(path.join(REPO, 'lib', 'core', 'session-binding.cjs'));
const artifactRead = require(path.join(REPO, 'lib', 'mcp', 'tools', 'artifact-read.cjs'));
const { buildRoom369, writeRegistry } = require('./helpers/fixture-room-369.cjs');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
async function arm(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  PASS ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('    ' + (err && err.message ? err.message : String(err)));
  }
}

const handlers = new Map();
const configs = new Map();
artifactRead.register(
  { registerTool(name, config, handler) { handlers.set(name, handler); configs.set(name, config); } },
  {}
);
const roomArtifact = handlers.get('room_artifact');

function call(sessionId, args) {
  return roomArtifact(args, { sessionId: sessionId }).then((res) => JSON.parse(res.content[0].text));
}

function largestMd(dir) {
  let best = { bytes: 0, file: null };
  const stack = [dir];
  while (stack.length > 0) {
    const d = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_e) { continue; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory() && e.name !== 'node_modules' && e.name !== '.git') stack.push(p);
      else if (e.isFile() && e.name.endsWith('.md')) {
        const size = fs.statSync(p).size;
        if (size > best.bytes) best = { bytes: size, file: p };
      }
    }
  }
  return best;
}

async function main() {
  const built = buildRoom369({ tmpDir: path.join(ROOMS_HOME, 'art-room'), slug: 'art-room', variant: 'wide', migrate: true });
  const roomDir = built.roomDir;
  writeRegistry(ROOMS_HOME, [{ slug: 'art-room', roomDir: roomDir }], 'art-room');
  const session = 'sess-art';
  writeSessionBinding(session, { primary: 'art-room', bound: ['art-room'] }, { home: ROOMS_HOME });

  const body = '# Interview 03\n\nThe buyer said the pilot budget is already approved.\n';
  fs.mkdirSync(path.join(roomDir, 'evidence', 'interview-03'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'evidence', 'interview-03', 'interview-03.md'), body);
  fs.writeFileSync(path.join(roomDir, 'notes.txt'), 'plain text');
  fs.writeFileSync(path.join(roomDir, 'big.md'), 'x'.repeat(3 * 1024));
  // A file OUTSIDE the room, and a symlink to it from inside the room.
  const outside = path.join(HERMETIC, 'outside-secret.md');
  fs.writeFileSync(outside, '# secret\n');
  fs.symlinkSync(outside, path.join(roomDir, 'leak.md'));
  // A directory symlink that escapes, to cover the intermediate-segment case.
  const outsideDir = path.join(HERMETIC, 'outside-dir');
  fs.mkdirSync(outsideDir);
  fs.writeFileSync(path.join(outsideDir, 'inside.md'), '# also secret\n');
  fs.symlinkSync(outsideDir, path.join(roomDir, 'leakdir'));

  await arm('1 reads evidence/interview-03/interview-03.md with ok true and the right bytes', async () => {
    const out = await call(session, { path: 'evidence/interview-03/interview-03.md' });
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.markdown, body);
    assert.equal(out.bytes, Buffer.byteLength(body, 'utf8'));
    assert.equal(out.truncated, false);
    assert.ok(typeof out.modified_at === 'string' && out.modified_at.length > 0, 'modified_at present');
  });

  await arm('2 ../outside.md and /etc/hosts are refused', async () => {
    for (const p of ['../outside.md', 'evidence/../../outside.md', '/etc/hosts', '/etc/hosts.md']) {
      const out = await call(session, { path: p });
      assert.equal(out.ok, false, p + ' must be refused');
      assert.equal(out.reason, 'path_outside_room', p + ' reason: ' + out.reason);
    }
  });

  await arm('3 a symlink inside the room pointing outside is refused', async () => {
    const file = await call(session, { path: 'leak.md' });
    assert.equal(file.ok, false);
    assert.equal(file.reason, 'path_outside_room');
    const dir = await call(session, { path: 'leakdir/inside.md' });
    assert.equal(dir.ok, false);
    assert.equal(dir.reason, 'path_outside_room');
  });

  await arm('4 notes.txt is refused as not_markdown', async () => {
    const out = await call(session, { path: 'notes.txt' });
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'not_markdown');
  });

  await arm('5 a missing file answers not_found', async () => {
    const out = await call(session, { path: 'evidence/nope/nope.md' });
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'not_found');
    const dir = await call(session, { path: 'evidence/interview-03.md' });
    assert.equal(dir.reason, 'not_found', 'a missing file under an existing dir is not_found too');
  });

  await arm('6 a 3 KB file with max_bytes 1024 answers truncated true with 1024 bytes', async () => {
    const out = await call(session, { path: 'big.md', max_bytes: 1024 });
    assert.equal(out.ok, true, JSON.stringify(out).slice(0, 200));
    assert.equal(out.truncated, true);
    assert.equal(out.bytes, 1024);
    assert.equal(out.markdown.length, 1024);
    const whole = await call(session, { path: 'big.md' });
    assert.equal(whole.truncated, false, 'default cap holds a 3 KB file whole');
    assert.equal(whole.bytes, 3 * 1024);
  });

  await arm('7 an unbound session answers room_unbound', async () => {
    const out = await call('sess-art-unbound', { path: 'evidence/interview-03/interview-03.md' });
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'room_unbound');
  });

  await arm('8 static: no sqlite or room-db, no Brain host or network token, description under 400 bytes', async () => {
    const src = fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'tools', 'artifact-read.cjs'), 'utf8');
    assert.equal(/require\(['"](node:sqlite|[^'"]*room-db)/.test(src), false, 'no room-db or node:sqlite require');
    for (const token of ['brain-client', 'brain-router', 'mindrian-brain', 'theo-mcp', 'onrender', "require('http", "require('node:http", "require('https", 'fetch(']) {
      assert.equal(src.includes(token), false, 'forbidden token: ' + token);
    }
    assert.equal(src.includes(EM) || src.includes(EN), false, 'no em-dash or en-dash');
    assert.ok(src.includes('isRealpathContained'), 'uses the realpath containment guard');
    const description = configs.get('room_artifact').description;
    const bytes = Buffer.byteLength(description, 'utf8');
    console.log('  room_artifact description bytes=' + bytes);
    assert.ok(bytes < 400, 'description under 400 bytes, got ' + bytes);
    assert.equal(description.includes(EM) || description.includes(EN), false, 'description has no long dash');
    assert.equal(artifactRead.connectors.length, 1);
    assert.equal(artifactRead.connectors[0].hitl_shape, 'none');
  });

  // Measurement for the 512 KiB default (informational, never a failure). The
  // dog-food room and the real rooms are measured by hand and recorded in the
  // plan SUMMARY; a hermetic test never reads outside its temp home.
  const fixtureBest = largestMd(roomDir);
  console.log('  measure: largest .md in the fixture room = ' + fixtureBest.bytes + ' bytes');

  console.log('PASS=' + passed + ' FAIL=' + failed);
  try { fs.rmSync(HERMETIC, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.log('FATAL ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
