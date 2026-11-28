#!/usr/bin/env node
'use strict';
// Phase 400.2.1 (S3): the persona domain comes from the room identity, not from the generated STATE.md heading.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const ops = require(path.join(ROOT, 'lib', 'core', 'persona-ops.cjs'));
const door = require(path.join(ROOT, 'scripts', 'persona-hats.cjs'));

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
function bornRoom(dirName, roomMd, roomName) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-40021-dom-'));
  tmpRoots.push(parent);
  const room = path.join(parent, dirName);
  fs.mkdirSync(room);
  put(room, 'STATE.md', '---\nventure_stage: Pre-Opportunity\ncurrent_room: ' + dirName + '\n---\n# Data Room State\n\n## Room Map\n');
  put(room, 'ROOM.md', roomMd !== undefined ? roomMd : '---\ndirectory_type: root\nauto_scaffolded: true\npurpose: "Auto-created ICM Layer 0 identity file for the room root."\nicm_self:\n  room: "' + (roomName || dirName) + '"\n  path: "."\n---\n');
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

check('D1. a born room with the generated heading gives the ROOM.md icm_self.room name (not the directory), never data-room-state', () => {
  const room = bornRoom('dir-of-the-room', undefined, 'riemann-claim-hats');
  assert.equal(ops.extractDomainSignals(room).primaryDomain, 'riemann-claim-hats');
  assert.deepEqual(ops.roomVentureNameOf(room), { name: 'riemann-claim-hats', source: 'room_md' });
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

check('D3. the ROOM.md purpose is not used, even when the file is not auto-scaffolded; a CRLF ROOM.md is read', () => {
  const room = bornRoom('dir-name', '---\r\ndirectory_type: root\r\npurpose: "Prove that a sensor works in cold water"\r\nicm_self:\r\n  room: "cold-water-sensor"\r\n---\r\n');
  assert.equal(ops.extractDomainSignals(room).primaryDomain, 'cold-water-sensor');
});

check('D3b. only the direct icm_self.room key counts; a room: key of another block or a nested block is ignored', () => {
  const room = bornRoom('the-dir', '---\nparent:\n  room: "parent-room"\nicm_self:\n  path: "."\n  child:\n    room: "nested"\n---\n');
  assert.deepEqual(ops.roomVentureNameOf(room), { name: 'the-dir', source: 'directory' });
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

check('D7. the identity screen uses the same room name: in a born room the handle "solid state" is not refused', () => {
  const room = bornRoom('riemann-claim-hats');
  const screen = door.roomIdentityScreen(room, []);
  assert.equal(screen.ran, true, 'the ROOM.md room name lets the screen run');
  assert.deepEqual(door.checkHandle('solid state', screen), { ok: true, handle: 'solid state' });
  assert.equal(door.checkHandle('riemann claim', screen).reason, 'room_identity_word', 'the room name is screened');
});

check('D8. the preview never overwrites or sits next to a built persona, and drops older preview files of the hat', () => {
  const room = bornRoom('riemann-claim-hats');
  // a built white persona with the same file name the preview would write
  put(room, 'personas/white-riemann-claim-hats.md', '---\nhat: white\nbuilt_by: persona-analyst\npersona_status: accepted\n---\n# built\n');
  // an older preview of red under the old domain
  put(room, 'personas/red-data-room-state.md', '---\nhat: red\npreview_notice: "QUICK PREVIEW"\n---\n# old preview\n');
  const out = ops.generatePersonas(room, { mode: 'preview' });
  assert.ok(out.preview, JSON.stringify(out));
  assert.deepEqual(out.skipped_built, ['white']);
  assert.equal(out.generated.includes('white-riemann-claim-hats.md'), false);
  assert.ok(fs.readFileSync(path.join(room, 'personas/white-riemann-claim-hats.md'), 'utf8').includes('# built'), 'the built file is untouched');
  const names = fs.readdirSync(path.join(room, 'personas')).sort();
  assert.ok(names.includes('red-riemann-claim-hats.md'));
  assert.equal(names.includes('red-data-room-state.md'), false, 'the older preview of red is removed');
});

check('D9. invokePersona sorts the files and prefers a built persona over a preview', () => {
  const room = bornRoom('riemann-claim-hats');
  put(room, 'personas/green-aaa-preview.md', '---\nhat: green\npreview_notice: "QUICK PREVIEW"\n---\n# preview\n');
  put(room, 'personas/green-zzz-built.md', '---\nhat: green\nbuilt_by: persona-analyst\npersona_status: accepted\n---\n# built\n');
  const out = ops.invokePersona(room, 'green');
  assert.ok(out.persona.includes('# built'), out.persona);
});

check('D10. N2: only a line that starts with venture: names the venture (venture_stage: and an inline venture: do not)', () => {
  const room = bornRoom('cold-room', undefined, 'cold-room-name');
  put(room, 'STATE.md', '---\nventure_stage: Pre-Opportunity\nnote: the venture: is open\n---\n# Data Room State\n');
  assert.deepEqual(ops.roomVentureNameOf(room), { name: 'cold-room-name', source: 'room_md' });
  put(room, 'STATE.md', 'venture:   \nventure: Tidepool\n');
  assert.deepEqual(ops.roomVentureNameOf(room), { name: 'Tidepool', source: 'venture_line' }, 'an empty venture: line is skipped');
});

check('D11. N1: with no STATE.md the screen still runs on the ROOM.md icm_self.room name; a room that states no name gives no screen', () => {
  const room = bornRoom('dir-x', undefined, 'stated-room');
  fs.rmSync(path.join(room, 'STATE.md'));
  assert.equal(door.roomIdentityScreen(room, []).ran, true);
  const bare = bornRoom('dir-y', '');
  fs.rmSync(path.join(bare, 'STATE.md'));
  fs.rmSync(path.join(bare, 'ROOM.md'));
  assert.equal(door.roomIdentityScreen(bare, []).ran, false, 'a directory name is not a stated name');
});

for (const r of tmpRoots) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_) { /* ignore */ } }
// D12 to D14 (fix after the verification): the skeleton heading that the real room birth leaves on disk.
const { spawnSync } = require('node:child_process');

check('D12. a room made by the real birthRoom, read before any state recompute, gives its room name (never room-state); "solid state" passes', () => {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-40021-birth-'));
  tmpRoots.push(t);
  const slug = 'quokka-born-room';
  const script = [
    "const path = require('node:path');",
    'const ROOT = process.argv[1]; const roomsHome = process.argv[2]; const slug = process.argv[3];',
    "require('node:fs').mkdirSync(roomsHome, { recursive: true });",
    "const { birthRoom } = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs'));",
    "const ops = require(path.join(ROOT, 'lib', 'core', 'persona-ops.cjs'));",
    "const door = require(path.join(ROOT, 'scripts', 'persona-hats.cjs'));",
    'const roomDir = path.join(roomsHome, slug);',
    "const b = birthRoom({ slug, roomDir, sessionId: 'test-40021-d12', ventureText: 'A scratch room.', jtbd: 'Check one question.', approvedBy: 'test-40021' });",
    "const st = require('node:fs').readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');",
    'const screen = door.roomIdentityScreen(roomDir, []);',
    "process.stdout.write('\\nRESULT:' + JSON.stringify({ ok: b.ok, heading: (st.match(/^#\\s+(.+)/m) || [])[1], name: ops.roomVentureNameOf(roomDir), domain: ops.extractDomainSignals(roomDir).primaryDomain, solid: door.checkHandle('solid state', screen), own: door.checkHandle('quokka born', screen) }));",
  ].join('\n');
  const env = Object.assign({}, process.env, { HOME: t, MINDRIAN_HOME: path.join(t, '.mindrian'), MINDRIAN_ROOMS_HOME: path.join(t, 'rooms'), TMPDIR: t, NODE_NO_WARNINGS: '1' });
  const r = spawnSync(process.execPath, ['-e', script, ROOT, path.join(t, 'rooms'), slug], { env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const line = r.stdout.split('\n').filter(l => l.startsWith('RESULT:')).pop();
  assert.ok(line, 'the child printed a result: ' + r.stdout.slice(0, 200));
  const got = JSON.parse(line.slice('RESULT:'.length));
  assert.equal(got.ok, true);
  assert.equal(got.heading, 'Room State', 'the birth leaves the skeleton heading on disk (the case of this test)');
  assert.deepEqual(got.name, { name: slug, source: 'room_md' });
  assert.equal(got.domain, slug);
  assert.deepEqual(got.solid, { ok: true, handle: 'solid state' });
  assert.equal(got.own.reason, 'room_identity_word', 'the room name is screened');
});

check('D13. the vault-import skeleton heading (Project State) is generated too: the ROOM.md room name is used', () => {
  const room = bornRoom('vault-dir', undefined, 'vault-room-name');
  put(room, 'STATE.md', '---\ncreated_by: phase-80-vault-import\n---\n\n# Project State\n\nRoom scaffolded by vault-import (Case A: no existing room).\n');
  assert.deepEqual(ops.roomVentureNameOf(room), { name: 'vault-room-name', source: 'room_md' });
  assert.equal(ops.extractDomainSignals(room).primaryDomain, 'vault-room-name');
});

check('D14. each generated heading matches its generator exactly: the birth template first heading, the computed heading, the vault-import heading', () => {
  const screenMod = require(path.join(ROOT, 'lib', 'core', 'persona-reader-screen.cjs'));
  const tmpl = fs.readFileSync(path.join(ROOT, 'templates', 'room-skeleton', 'STATE.md.tmpl'), 'utf8');
  const tmplHeading = (tmpl.match(/^#\s+(.+)$/m) || [])[1].trim();
  const set = screenMod.generatedStateHeadings();
  assert.ok(set.includes(tmplHeading), 'the birth template heading is in the set: ' + tmplHeading);
  assert.ok(fs.readFileSync(path.join(ROOT, 'lib', 'core', 'room-render-state.cjs'), 'utf8').includes("out.push('# Data Room State')"));
  assert.ok(set.includes('Data Room State'));
  assert.ok(fs.readFileSync(path.join(ROOT, 'scripts', 'vault-import.cjs'), 'utf8').includes("'# Project State',"));
  assert.ok(set.includes('Project State'));
  assert.equal(set.length, 3, 'exactly the three generated headings, no word list');
  assert.equal(screenMod.isGeneratedStateHeading('Room State of Harbor'), false, 'an exact match only');
  assert.equal(screenMod.isGeneratedStateHeading('room state'), true, 'case does not matter');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
