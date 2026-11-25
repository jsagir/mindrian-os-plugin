#!/usr/bin/env node
'use strict';
// Phase 400.2-03: persona lifetime. Room fingerprint, per-hat freshness, fixed hat disciplines,
// the two notices and the writer of a reasoned persona file.
// Legs F1 to F5, F11 and F12 (task 1) and F6 to F10 (task 2).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OPS_PATH = path.join(ROOT, 'lib', 'core', 'persona-ops.cjs');
const ops = require(OPS_PATH);

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const HATS = ['white', 'red', 'black', 'yellow', 'green', 'blue'];
const tmpRoots = [];

function put(room, rel, text) {
  const abs = path.join(room, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, 'utf8');
}

function makeRoom() {
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-4002-fresh-'));
  tmpRoots.push(room);
  put(room, 'STATE.md', '# Room\nventure: Harbor Light Studio\nstage: discovery\n');
  put(room, 'ROOM.md', '# Room identity\n');
  put(room, 'problem-definition/ROOM.md', '# Problem definition\n');
  put(room, 'problem-definition/core-problem.md', '# Core problem\nSmall studios lose clients at the hand-off.\n');
  put(room, 'market-analysis/ROOM.md', '# Market analysis\n');
  put(room, 'market-analysis/size.md', '# Size\nAbout 4000 studios in the region.\n');
  put(room, 'only-identity/ROOM.md', '# Only identity\n');
  put(room, 'meetings/ROOM.md', '# Meetings\n');
  put(room, 'meetings/kickoff.md', '# Kickoff\nWe met.\n');
  put(room, 'team/ROOM.md', '# Team\n');
  put(room, 'team/founder.md', '# Founder\nA designer.\n');
  put(room, 'personas/ROOM.md', '# Personas\n');
  put(room, 'references/ROOM.md', '# References\n');
  put(room, 'references/recipe.md', '# Recipe\n');
  return room;
}

function writeHatFile(room, name, fm, body) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) lines.push(k + ': ' + v);
  lines.push('---', '', body || '# Persona', '');
  put(room, path.join('personas', name), lines.join('\n'));
}

// F1
check('F1. roomFingerprint is 64 hex and changes on edit, add, remove, nested add, docx add, meetings add', () => {
  const room = makeRoom();
  const base = ops.roomFingerprint(room);
  assert.match(base, /^[0-9a-f]{64}$/);
  assert.equal(ops.roomFingerprint(room), base, 'stable on a second call');

  put(room, 'problem-definition/core-problem.md', '# Core problem\nChanged body.\n');
  const edited = ops.roomFingerprint(room);
  assert.notEqual(edited, base, 'body edit');

  put(room, 'market-analysis/extra.md', '# Extra\n');
  const added = ops.roomFingerprint(room);
  assert.notEqual(added, edited, 'new artifact');

  fs.rmSync(path.join(room, 'market-analysis', 'extra.md'));
  assert.equal(ops.roomFingerprint(room), edited, 'removing the added file returns to the earlier value');
  put(room, 'market-analysis/extra.md', '# Extra\n');
  fs.rmSync(path.join(room, 'market-analysis', 'size.md'));
  assert.notEqual(ops.roomFingerprint(room), added, 'removed artifact');
  put(room, 'market-analysis/size.md', '# Size\nAbout 4000 studios in the region.\n');

  const before = ops.roomFingerprint(room);
  put(room, 'problem-definition/nested/nested.md', '# Nested\n');
  const nested = ops.roomFingerprint(room);
  assert.notEqual(nested, before, 'nested artifact');

  put(room, 'market-analysis/deck.docx', 'binary-ish');
  const docx = ops.roomFingerprint(room);
  assert.notEqual(docx, nested, 'docx file');

  put(room, 'meetings/second.md', '# Second\n');
  assert.notEqual(ops.roomFingerprint(room), docx, 'meetings file');

  put(room, 'team/advisor.md', '# Advisor\n');
  const team = ops.roomFingerprint(room);
  put(room, 'team/advisor.md', '# Advisor\nmore\n');
  assert.notEqual(ops.roomFingerprint(room), team, 'team edit');
});

// F2
check('F2. roomFingerprint ignores STATE, ROOM, personas, references, dot dirs, root files', () => {
  const room = makeRoom();
  const base = ops.roomFingerprint(room);
  put(room, 'STATE.md', '# Room\nventure: Harbor Light Studio\nstage: pitch\n');
  put(room, 'ROOM.md', '# Room identity changed\n');
  put(room, 'problem-definition/ROOM.md', '# Problem definition changed\n');
  put(room, 'problem-definition/CONTEXT.md', '# Context file\n');
  put(room, 'personas/white-harbor.md', '---\nhat: white\n---\nbody\n');
  put(room, 'personas/hat-reviews/white.md', '# Review\n');
  put(room, 'references/recipe.md', '# Recipe changed\n');
  put(room, 'references/new-reference.md', '# New\n');
  put(room, '.mindrian/ledger.md', '# Ledger\n');
  put(room, 'notes-at-root.md', '# Root note\n');
  put(room, 'room.db', 'sqlite bytes');
  put(room, 'problem-definition/.hidden/secret.md', '# Hidden\n');
  assert.equal(ops.roomFingerprint(room), base);
});

// F3
check('F3. roomArtifactIndex returns sections with sorted relative paths and the fingerprint', () => {
  const room = makeRoom();
  put(room, 'problem-definition/nested/nested.md', '# Nested\n');
  const idx = ops.roomArtifactIndex(room);
  assert.equal(idx.fingerprint, ops.roomFingerprint(room));
  assert.ok(idx.sections && typeof idx.sections === 'object');
  assert.deepEqual(idx.sections['problem-definition'], [
    'problem-definition/core-problem.md',
    'problem-definition/nested/nested.md',
  ]);
  assert.deepEqual(idx.sections['market-analysis'], ['market-analysis/size.md']);
  assert.deepEqual(idx.sections['only-identity'], [], 'a section with only ROOM.md has an empty list');
  assert.deepEqual(idx.sections.meetings, ['meetings/kickoff.md']);
  assert.deepEqual(idx.sections.team, ['team/founder.md']);
  assert.equal(idx.sections.personas, undefined);
  assert.equal(idx.sections.references, undefined);
  const list = idx.sections['problem-definition'];
  assert.deepEqual(list, list.slice().sort());
});

// F4
check('F4. personaFreshness gives one state for each hat (five states)', () => {
  const room = makeRoom();
  const fp = ops.roomFingerprint(room);
  const old = 'a'.repeat(64);
  // white: no file -> missing
  // red: preview file, no built_by -> preview_only
  writeHatFile(room, 'red-harbor-light-studio.md', { hat: 'red', domain: 'harbor-light-studio', preview_notice: '"QUICK PREVIEW"' });
  // black: built, accepted, old fingerprint -> stale
  writeHatFile(room, 'black-harbor-light-studio.md', { hat: 'black', built_by: 'persona-analyst', persona_status: 'accepted', room_fingerprint: '"' + old + '"' });
  // yellow: built, proposed, current -> unaccepted
  writeHatFile(room, 'yellow-harbor-light-studio.md', { hat: 'yellow', built_by: 'persona-analyst', persona_status: 'proposed', room_fingerprint: '"' + fp + '"' });
  // green: built, accepted, current -> fresh
  writeHatFile(room, 'green-harbor-light-studio.md', { hat: 'green', built_by: 'persona-analyst', persona_status: 'accepted', room_fingerprint: '"' + fp + '"' });
  // blue: two files; the built one wins over the preview one
  writeHatFile(room, 'blue-aaa-preview.md', { hat: 'blue', domain: 'aaa-preview' });
  writeHatFile(room, 'blue-zzz-built.md', { hat: 'blue', built_by: 'persona-analyst', persona_status: 'accepted', room_fingerprint: '"' + fp + '"' });
  const out = ops.personaFreshness(room);
  assert.equal(out.fingerprint, fp);
  assert.deepEqual(Object.keys(out.hats).sort(), HATS.slice().sort());
  assert.equal(out.hats.white.state, 'missing');
  assert.equal(out.hats.white.file, null);
  assert.equal(out.hats.red.state, 'preview_only');
  assert.equal(out.hats.red.file, 'red-harbor-light-studio.md');
  assert.equal(out.hats.black.state, 'stale');
  assert.equal(out.hats.yellow.state, 'unaccepted');
  assert.equal(out.hats.green.state, 'fresh');
  assert.equal(out.hats.blue.state, 'fresh');
  assert.equal(out.hats.blue.file, 'blue-zzz-built.md');
  // a room with no personas directory at all: every hat is missing
  const bare = makeRoom();
  fs.rmSync(path.join(bare, 'personas'), { recursive: true });
  const none = ops.personaFreshness(bare);
  for (const h of HATS) assert.equal(none.hats[h].state, 'missing');
});

// F5
check('F5. proposed with the current fingerprint is unaccepted, accepted with an old one is stale; a room edit turns fresh into stale', () => {
  const room = makeRoom();
  const fp = ops.roomFingerprint(room);
  writeHatFile(room, 'white-x.md', { hat: 'white', built_by: 'persona-analyst', persona_status: 'proposed', room_fingerprint: '"' + fp + '"' });
  writeHatFile(room, 'red-x.md', { hat: 'red', built_by: 'persona-analyst', persona_status: 'accepted', room_fingerprint: '"' + 'b'.repeat(64) + '"' });
  writeHatFile(room, 'black-x.md', { hat: 'black', built_by: 'persona-analyst', persona_status: 'accepted', room_fingerprint: '"' + fp + '"' });
  let out = ops.personaFreshness(room);
  assert.equal(out.hats.white.state, 'unaccepted');
  assert.notEqual(out.hats.white.state, 'fresh');
  assert.equal(out.hats.red.state, 'stale');
  assert.equal(out.hats.black.state, 'fresh');
  put(room, 'problem-definition/core-problem.md', '# Core problem\nEdited after the persona was accepted.\n');
  out = ops.personaFreshness(room);
  assert.equal(out.hats.black.state, 'stale');
});

// F11
check('F11. line 550 of lib/core/persona-ops.cjs starts with "function invokePersona("', () => {
  const lines = fs.readFileSync(OPS_PATH, 'utf8').split('\n');
  assert.ok(lines[549].startsWith('function invokePersona('), 'line 550 is: ' + lines[549]);
});

// F12
check('F12. no new top-level require in lib/core/persona-ops.cjs', () => {
  const re = /^const .* = require\(/;
  const count = (text) => text.split('\n').filter((l) => re.test(l)).length;
  let baseCount = 8;
  const r = spawnSync('git', ['show', 'bb0bfbab3:lib/core/persona-ops.cjs'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.status === 0 && r.stdout) baseCount = count(r.stdout);
  assert.equal(count(fs.readFileSync(OPS_PATH, 'utf8')), baseCount);
});

for (const r of tmpRoots) {
  try { fs.rmSync(r, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
