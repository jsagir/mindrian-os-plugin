#!/usr/bin/env node
'use strict';
// Phase 400.2.1 (S3): the persona domain comes from the room identity, not from the generated STATE.md heading.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const ops = require(path.join(ROOT, 'lib', 'core', 'persona-ops.cjs'));

let failed = 0;
let passed = 0;
function check(label, fn) {
  try { fn(); passed += 1; console.log('ok: ' + label); } catch (e) { failed += 1; console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e))); }
}
const tmpRoots = [];
function put(room, rel, text) {
  const abs = path.join(room, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, 'utf8');
}
// A born room: computed STATE.md (generated heading, venture_stage only) and an auto-scaffolded ROOM.md.
function bornRoom(dirName, roomMd) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-40021-dom-'));
  tmpRoots.push(parent);
  const room = path.join(parent, dirName);
  fs.mkdirSync(room);
  put(room, 'STATE.md', '---\nventure_stage: Pre-Opportunity\ncurrent_room: ' + dirName + '\n---\n# Data Room State\n\n## Room Map\n');
  put(room, 'ROOM.md', roomMd !== undefined ? roomMd : '---\ndirectory_type: root\nauto_scaffolded: true\npurpose: "Auto-created ICM Layer 0 identity file for the room root."\nicm_self:\n  room: "' + dirName + '"\n  path: "."\n---\n');
  put(room, 'problem-definition/core-problem.md', '# Core problem\nA real note.\n');
  put(room, 'market-analysis/size.md', '# Size\nA real note.\n');
  return room;
}
function spec(hat) {
  return {
    schema: 'mos.persona-spec/1',
    hat,
    focus: 'Read the claim and the proof path.',
    hat_questions: ['What does the room say?', 'Which claim has no source yet?', 'What would change the answer?'],
    must_not_judge: ['The author as a person.'],
    room_sources: ['problem-definition/core-problem.md', 'market-analysis/size.md'],
  };
}
const FP = 'a'.repeat(64);

check('D1. a born room with the generated heading gives the room name, never data-room-state', () => {
  const room = bornRoom('riemann-claim-hats');
  assert.equal(ops.extractDomainSignals(room).primaryDomain, 'riemann-claim-hats');
  const w = ops.writeReasonedPersona(room, 'white', spec('white'), { fingerprint: FP });
  assert.equal(w.ok, true, JSON.stringify(w));
  assert.equal(w.file, 'personas/white-riemann-claim-hats.md');
  assert.ok(fs.readFileSync(path.join(room, w.file), 'utf8').includes('domain: "riemann-claim-hats"'));
});

check('D2. a venture: line in STATE.md still wins', () => {
  const room = bornRoom('some-dir');
  put(room, 'STATE.md', '# Data Room State\nventure: Harbor Light Studio\n');
  assert.equal(ops.extractDomainSignals(room).primaryDomain, 'harbor-light-studio');
});

check('D3. a ROOM.md purpose that is not auto-scaffolded wins over the room name (first 6 words)', () => {
  const room = bornRoom('dir-name', '---\ndirectory_type: root\npurpose: "Prove that a mixed-signal sensor works in cold water for a year"\nicm_self:\n  room: "dir-name"\n---\n');
  assert.equal(ops.extractDomainSignals(room).primaryDomain, 'prove-that-a-mixed-signal-sensor-works');
});

check('D4. no ROOM.md: the directory name is the domain', () => {
  const room = bornRoom('cold-water-sensor', '');
  fs.rmSync(path.join(room, 'ROOM.md'));
  assert.equal(ops.extractDomainSignals(room).primaryDomain, 'cold-water-sensor');
});

check('D5. a real first heading (not the generated one) is still read as the venture name', () => {
  const room = bornRoom('x-room');
  put(room, 'STATE.md', '# Tidepool Robotics\n');
  assert.equal(ops.extractDomainSignals(room).primaryDomain, 'tidepool-robotics');
});

check('D6. compatibility: an old <hat>-data-room-state.md file is replaced by the next build of the hat', () => {
  const room = bornRoom('riemann-claim-hats');
  put(room, 'personas/black-data-room-state.md', '---\nhat: black\ndomain: "data-room-state"\nbuilt_by: persona-analyst\npersona_status: accepted\nroom_fingerprint: "' + FP + '"\n---\n# old\n');
  const fr = ops.personaFreshness(room);
  assert.equal(fr.hats.black.file, 'black-data-room-state.md', 'the old file stays readable');
  const w = ops.writeReasonedPersona(room, 'black', spec('black'), { fingerprint: FP });
  assert.equal(w.ok, true, JSON.stringify(w));
  assert.deepEqual(w.removed, ['black-data-room-state.md']);
  assert.deepEqual(fs.readdirSync(path.join(room, 'personas')).filter(f => f.startsWith('black-')), ['black-riemann-claim-hats.md']);
});

for (const r of tmpRoots) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_) { /* ignore */ } }
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
