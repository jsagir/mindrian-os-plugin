'use strict';
// Phase 395-03: the per-turn hook reaches the selector.
// Plain Node script. Exit 0 when all checks pass, 1 when one fails. One line per check: "ok:" or "FAIL:".
//
// Method: each check runs the real hook (scripts/intent-classifier.cjs) as a child process on a fixture room
// under an isolated home. A small preload file (written by this test into the isolated home, loaded with
// NODE_OPTIONS --require) wraps decide() of lib/core/navigation-engine.cjs and writes to a file what the
// context held after the call. The context is thus built by the hook's own code, not by a copy in this test.
// No network. Nothing is written outside the isolated home.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');
const HOOK = path.join(ROOT, 'scripts', 'intent-classifier.cjs');
const ENGINE = path.join(ROOT, 'lib', 'core', 'navigation-engine.cjs');
const SEC = 'problem-definition';
const UNSET = '__unset__';

const PRELOAD_SOURCE = [
  "'use strict';",
  "const fs = require('node:fs');",
  'const enginePath = process.env.T395_ENGINE_PATH;',
  'const outFile = process.env.T395_CAPTURE_FILE;',
  'if (enginePath && outFile) {',
  '  const eng = require(enginePath);',
  '  const real = eng.decide;',
  "  const pick = (o, k) => (o && o[k] !== undefined ? o[k] : '" + UNSET + "');",
  '  eng.decide = function (turn, ctx) {',
  '    const t0 = process.hrtime.bigint();',
  '    const d = real(turn, ctx);',
  '    const ms = Number(process.hrtime.bigint() - t0) / 1e6;',
  '    try {',
  '      fs.writeFileSync(outFile, JSON.stringify({',
  "        section: pick(ctx, 'section'),",
  "        surface: pick(ctx, 'surface'),",
  "        sectionPath: pick(ctx, 'sectionPath'),",
  "        roomDir: pick(ctx, 'roomDir'),",
  "        tierCandidates: pick(ctx, 'tierCandidates'),",
  "        tierCandidatesSource: pick(ctx, 'tierCandidatesSource'),",
  "        tierCandidatesFallbackReason: pick(ctx, 'tierCandidatesFallbackReason'),",
  "        offerCommand: d && d.offer_next_step && typeof d.offer_next_step.command === 'string' ? d.offer_next_step.command : null,",
  '        decideMs: ms,',
  '      }));',
  '    } catch (_e) { /* the capture is best effort */ }',
  '    return d;',
  '  };',
  '}',
  '',
].join('\n');

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('ok: ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + name + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

// A born fixture room (11 core sections, each with its files) under its own isolated home.
function born(tag) {
  const iso = H.mkIsolatedHome('395h-' + tag);
  const b = H.birthFixtureRoom({ iso, slug: 'hook-' + tag, vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!b || b.ok !== true) throw new Error('fixture birth failed: ' + JSON.stringify(b));
  const roomDir = fs.realpathSync(b.roomDir);
  const preload = path.join(iso.home, 'capture-preload.cjs');
  fs.writeFileSync(preload, PRELOAD_SOURCE, 'utf8');
  return { iso, roomDir, preload, captureFile: path.join(iso.home, 'capture.json') };
}

function setActiveSection(room, value) {
  fs.mkdirSync(path.join(room.roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(room.roomDir, '.mindrian', 'active-section.json'), JSON.stringify({ section: value }), 'utf8');
}

// Runs the hook once on the room. Returns { status, stdout, wallMs, capture }.
function runHook(room, sessionId) {
  const env = Object.assign({}, room.iso.env, {
    MINDRIAN_ROOMS_ROOT: room.iso.roomsHome,
    MOS_NAV_TEST_DISABLE_DRAIN: '1',
    MINDRIAN_COPILOT_INJECT_FINDINGS: '0',
    MINDRIAN_VOICE_REMINDER: '0',
    MINDRIAN_NAV_NO_SUPPRESS: '1',
    NODE_OPTIONS: '--require "' + room.preload + '"',
    T395_ENGINE_PATH: ENGINE,
    T395_CAPTURE_FILE: room.captureFile,
  });
  try { fs.unlinkSync(room.captureFile); } catch (_e) { /* no earlier capture */ }
  const t0 = Date.now();
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ user_message: 'what should I do next here', session_id: sessionId }),
    env,
    encoding: 'utf8',
    cwd: room.roomDir,
    timeout: 20000,
  });
  let capture = null;
  try { capture = JSON.parse(fs.readFileSync(room.captureFile, 'utf8')); } catch (_e) { capture = null; }
  return { status: res.status, stdout: res.stdout || '', wallMs: Date.now() - t0, capture };
}

// What the selector returns for the section on the cli surface, in the id form decide() writes.
function selectorIds(room, section) {
  const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
  const nm = NM.nextMoveForSection({ roomDir: room.roomDir, sectionDir: path.join(room.roomDir, section), surface: 'cli' });
  const tier = nm && nm.primary ? NM.toTierCandidates(nm) : null;
  return {
    primary: nm && nm.primary ? '/mos:' + nm.primary.command : null,
    ids: tier ? tier[0].items.map((i) => '/mos:' + String(i.id).replace(/^\/mos:/, '')) : [],
  };
}

try {
  // ---- 1 to 5: the active section is a core section, named in active-section.json --------------------------------
  const r1 = born('a');
  setActiveSection(r1, SEC);
  const want1 = selectorIds(r1, SEC);
  const out1 = runHook(r1, 't395-a');
  const cap1 = out1.capture || {};

  check('1. the hook exits 0, prints the per-turn block, and decide() ran', () => {
    assert.strictEqual(out1.status, 0, 'hook exit code');
    assert.ok(out1.stdout.indexOf('NAVIGATION DECISION (engine v1)') !== -1, 'the block header is in stdout');
    assert.ok(out1.capture, 'decide() was called by the hook (a capture file exists)');
  });

  check('2. the hook gives decide() the section slug and the surface cli', () => {
    assert.strictEqual(cap1.section, SEC, 'ctx.section');
    assert.strictEqual(cap1.surface, 'cli', 'ctx.surface');
    assert.strictEqual(cap1.sectionPath, path.join(r1.roomDir, SEC), 'ctx.sectionPath stays the absolute path');
    assert.strictEqual(cap1.roomDir, r1.roomDir, 'ctx.roomDir');
  });

  check('3. the selector ran: tierCandidates set, source feyminto_face, no fallback reason', () => {
    assert.ok(typeof want1.primary === 'string', 'precondition: the selector has a primary on ' + SEC);
    assert.strictEqual(cap1.tierCandidatesSource, 'feyminto_face', 'ctx.tierCandidatesSource');
    assert.strictEqual(cap1.tierCandidatesFallbackReason, UNSET, 'ctx.tierCandidatesFallbackReason');
    assert.ok(Array.isArray(cap1.tierCandidates) && cap1.tierCandidates.length === 1, 'ctx.tierCandidates has one entry');
  });

  check('4. the ids are the ids of the selector on the cli surface, the primary first', () => {
    assert.ok(Array.isArray(cap1.tierCandidates), 'ctx.tierCandidates is an array');
    const got = cap1.tierCandidates[0].items.map((i) => i.id);
    assert.deepStrictEqual(got, want1.ids, 'the same ordered ids as nextMoveForSection on cli');
    assert.strictEqual(got[0], want1.primary, 'the primary is first');
  });

  check('5. decide() with the selector stays under the 1,200 ms budget and the hook under its 5 s limit', () => {
    assert.strictEqual(cap1.tierCandidatesSource, 'feyminto_face', 'the time is measured with the selector reached');
    assert.ok(cap1.decideMs < 1200, 'decide() took ' + cap1.decideMs + ' ms');
    assert.ok(out1.wallMs < 5000, 'the hook took ' + out1.wallMs + ' ms');
    console.log('    decide() ms: ' + cap1.decideMs.toFixed(1) + '; hook wall ms: ' + out1.wallMs);
  });

  // ---- 6: no active-section.json; the hook falls back to the section whose MINTO.md changed last -----------------
  // A born section has no MINTO.md. Two sections get one here; market-analysis gets the newer time.
  const r2 = born('b');
  const mintoText = ['---', 'governing_thought: "A fixture thought"', '---', ''].join('\n');
  const older = new Date(Date.now() - 60000);
  const newer = new Date(Date.now() + 60000);
  fs.writeFileSync(path.join(r2.roomDir, 'team', 'MINTO.md'), mintoText, 'utf8');
  fs.utimesSync(path.join(r2.roomDir, 'team', 'MINTO.md'), older, older);
  fs.writeFileSync(path.join(r2.roomDir, 'market-analysis', 'MINTO.md'), mintoText, 'utf8');
  fs.utimesSync(path.join(r2.roomDir, 'market-analysis', 'MINTO.md'), newer, newer);
  const want2 = selectorIds(r2, 'market-analysis');
  const out2 = runHook(r2, 't395-b');
  const cap2 = out2.capture || {};

  check('6. with no active-section.json the section with the newest MINTO.md reaches the selector', () => {
    assert.ok(!fs.existsSync(path.join(r2.roomDir, '.mindrian', 'active-section.json')), 'precondition: no active-section.json');
    assert.ok(out2.capture, 'decide() was called');
    assert.strictEqual(cap2.section, 'market-analysis', 'ctx.section');
    assert.strictEqual(cap2.surface, 'cli', 'ctx.surface');
    assert.ok(typeof want2.primary === 'string', 'precondition: the selector has a primary on market-analysis');
    assert.strictEqual(cap2.tierCandidatesSource, 'feyminto_face', 'ctx.tierCandidatesSource');
    assert.strictEqual(cap2.tierCandidates[0].items[0].id, want2.primary, 'the primary is first');
  });

  // ---- 7: no active-section.json and no MINTO.md in any section: the hook has no section in focus ----------------
  const r2b = born('f');
  const out2b = runHook(r2b, 't395-f');
  const cap2b = out2b.capture || {};

  check('7. a room with no section in focus gives no section and no selector call', () => {
    assert.strictEqual(out2b.status, 0, 'hook exit code');
    assert.ok(out2b.capture, 'decide() was called');
    assert.strictEqual(cap2b.sectionPath, null, 'the hook found no active section');
    assert.strictEqual(cap2b.section, UNSET, 'ctx.section is not set');
    assert.strictEqual(cap2b.surface, 'cli', 'ctx.surface');
    assert.strictEqual(cap2b.tierCandidates, UNSET, 'ctx.tierCandidates is not set');
    assert.strictEqual(cap2b.tierCandidatesFallbackReason, UNSET, 'no fallback reason');
  });

  // ---- 8: a section folder whose name is not a slug: no section value, decide() runs as before -------------------
  const r3 = born('c');
  fs.mkdirSync(path.join(r3.roomDir, 'Custom_Notes'), { recursive: true });
  setActiveSection(r3, 'Custom_Notes');
  const out3 = runHook(r3, 't395-c');
  const cap3 = out3.capture || {};

  check('8. a section name that is not a slug gives no section, no selector call and no bad_section reason', () => {
    assert.strictEqual(out3.status, 0, 'hook exit code');
    assert.ok(out3.capture, 'decide() was called');
    assert.strictEqual(cap3.sectionPath, path.join(r3.roomDir, 'Custom_Notes'), 'the hook did resolve the folder');
    assert.strictEqual(cap3.section, UNSET, 'ctx.section is not set');
    assert.strictEqual(cap3.surface, 'cli', 'ctx.surface');
    assert.strictEqual(cap3.tierCandidates, UNSET, 'ctx.tierCandidates is not set');
    assert.strictEqual(cap3.tierCandidatesFallbackReason, UNSET, 'no fallback reason');
  });

  // ---- 9: a nested active section (not a direct child of the room): no section ----------------------------------
  const r4 = born('d');
  fs.mkdirSync(path.join(r4.roomDir, SEC, 'deep'), { recursive: true });
  setActiveSection(r4, SEC + '/deep');
  const out4 = runHook(r4, 't395-d');
  const cap4 = out4.capture || {};

  check('9. a nested active section gives no section and no selector call', () => {
    assert.ok(out4.capture, 'decide() was called');
    assert.strictEqual(cap4.sectionPath, path.join(r4.roomDir, SEC, 'deep'), 'the hook did resolve the folder');
    assert.strictEqual(cap4.section, UNSET, 'ctx.section is not set');
    assert.strictEqual(cap4.surface, 'cli', 'ctx.surface');
    assert.strictEqual(cap4.tierCandidates, UNSET, 'ctx.tierCandidates is not set');
  });

  // ---- 10: the offer the user's model reads. Decision gate operator, a job cue, a fresh governing thought ---------
  const r5 = born('e');
  setActiveSection(r5, SEC);
  const nowIso = new Date().toISOString();
  fs.writeFileSync(path.join(r5.roomDir, SEC, 'MINTO.md'), [
    '---',
    'governing_thought: "New hires wait too long to be useful"',
    'reasoning_health_score: 0.85',
    'last_generated_at: "' + nowIso + '"',
    'last_artifact_write_seen_at: "' + nowIso + '"',
    '---',
    '',
  ].join('\n'), 'utf8');
  require(path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs')).setCurrent(r5.roomDir, { jtbd: 'find-problem', confidence: 0.9, trigger: 'test-395-03' });
  const operator = require(path.join(ROOT, 'lib', 'conversation', 'operator.cjs'));
  const opState = operator.getCurrent(r5.roomDir);
  opState.current = 'DECISION_GATE';
  opState.previous = 'JUST_TALK';
  fs.writeFileSync(path.join(r5.roomDir, '.mindrian', 'conversation-operator.json'), JSON.stringify(opState, null, 2), 'utf8');
  const want5 = selectorIds(r5, SEC);
  const out5 = runHook(r5, 't395-e');
  const cap5 = out5.capture || {};

  check('10. on a decision gate turn the offer in the block is one of the selector ids', () => {
    assert.ok(out5.capture, 'decide() was called');
    assert.strictEqual(cap5.tierCandidatesSource, 'feyminto_face', 'the selector ran');
    assert.ok(typeof cap5.offerCommand === 'string', 'decide() made an offer, got ' + JSON.stringify(cap5.offerCommand));
    assert.ok(want5.ids.indexOf(cap5.offerCommand) !== -1, 'the offer ' + cap5.offerCommand + ' is one of ' + want5.ids.join(', '));
    assert.ok(out5.stdout.indexOf('offer_next_step: {command: ' + cap5.offerCommand + ',') !== -1, 'the block prints that offer');
  });

  // ---- 11: dash guard on this file --------------------------------------------------------------------------------
  check('11. no em dash and no en dash in this test file', () => {
    assert.deepStrictEqual(H.dashGuard([__filename]), [], 'dash guard');
  });
} catch (e) {
  failed += 1;
  console.log('FAIL: setup -- ' + (e && e.stack ? e.stack : String(e)));
}

process.exit(failed === 0 ? 0 : 1);
