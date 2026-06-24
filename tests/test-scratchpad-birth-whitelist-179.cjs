'use strict';
// Phase 179-02 (Wave 2, SPEC Req 9) -- scratchpad birth-answer whitelist round-trip.
//
// Proves writeScratchpadBirthAnswer persists three NEW optional fields additively,
// and drainBirthGateAnswers (read side) recovers them across a session boundary:
//   - role_blend       (plain object, e.g. {founder:1.0})
//   - blueprint_family (string, e.g. 'venture')
//   - hypothesis_text  (string, e.g. 'I believe X drives Y')
//
// Asserts:
//   (1) Session-boundary round-trip: write the three new fields, then re-read the
//       scratchpad FRESH (new module instance, simulating a new session) -- all
//       three recover intact (role_blend deep-equal, the two strings ===).
//   (2) Additive shape: an entry written with NONE of the three new fields is
//       byte-identical to the pre-change shape -- the three keys are ABSENT, not
//       present-as-null (existing free_text + arrival_asset persistence unchanged).
//   (3) Type discipline: role_blend persists only when a plain non-null non-array
//       object; blueprint_family + hypothesis_text persist only when strings;
//       malformed types are dropped (T-179-05 tampering guard).
//   (4) Drain side rides the additive keys for free: drainBirthGateAnswers reads
//       the whole entry object, so the additive keys survive the read path -- we
//       assert the recovered entry (the same object the drain replays) carries them.
//
// Self-contained: fs.mkdtempSync for HOME isolation (no real HOME pollution).
// No node:sqlite. No LLM invocation. NO em-dashes anywhere (CLAUDE.md HARD RULE).

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');

let checks = 0;
let passed = 0;

function check(label, condition, detail) {
  checks++;
  if (condition) {
    passed++;
    process.stdout.write('  PASS: ' + label + '\n');
  } else {
    process.stdout.write('  FAIL: ' + label + (detail ? ' -- ' + detail : '') + '\n');
  }
}

process.stdout.write('=== test-scratchpad-birth-whitelist-179.cjs ===\n\n');

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-179-'));
const origHome = process.env.HOME;
process.env.HOME = tmpHome;

const MINDRIAN_DIR = path.join(tmpHome, '.mindrian');
const SCRATCHPAD_PATH = path.join(MINDRIAN_DIR, 'scratchpad.json');

process.on('exit', () => {
  process.env.HOME = origHome;
  try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) {}
});

// Require the module fresh each time -- this is how we simulate a new session:
// the prior write landed on disk, a fresh module instance re-reads it.
function freshLoad() {
  const modPath = require.resolve(path.join(REPO_ROOT, 'lib/core/scratchpad-ops.cjs'));
  delete require.cache[modPath];
  return require(modPath);
}

function resetScratchpad() {
  fs.mkdirSync(MINDRIAN_DIR, { recursive: true });
  if (fs.existsSync(SCRATCHPAD_PATH)) fs.rmSync(SCRATCHPAD_PATH);
}

let ops;
try {
  ops = freshLoad();
} catch (err) {
  process.stdout.write('FATAL: could not load lib/core/scratchpad-ops.cjs: ' + err.message + '\n');
  process.exit(1);
}

// ---- Group 1: session-boundary round-trip of the three NEW fields ----
process.stdout.write('--- Group 1: role_blend + blueprint_family + hypothesis_text round-trip ---\n');
{
  resetScratchpad();
  const writeOps = freshLoad();

  const roleBlend = { founder: 1.0 };
  writeOps.writeScratchpadBirthAnswer({
    gate_id: 'B1',
    option_key: 'persona',
    canonical_verb: 'RunMethodology',
    alias_label: 'Persona',
    role_blend: roleBlend,
    blueprint_family: 'venture',
    hypothesis_text: 'I believe X drives Y',
    ts: 1750000000001
  });

  // New session: a fresh module re-reads the on-disk scratchpad.
  const readOps = freshLoad();
  const result = readOps.readScratchpad();
  const e = Array.isArray(result.birth_gate_answers) ? result.birth_gate_answers[0] : null;

  check('round-trip: one entry recovered after session boundary',
    Array.isArray(result.birth_gate_answers) && result.birth_gate_answers.length === 1,
    'got: ' + JSON.stringify(result.birth_gate_answers));
  check('round-trip: role_blend recovered deep-equal {founder:1.0}',
    e && e.role_blend && typeof e.role_blend === 'object' &&
    !Array.isArray(e.role_blend) && e.role_blend.founder === 1.0 &&
    Object.keys(e.role_blend).length === 1,
    'got: ' + JSON.stringify(e && e.role_blend));
  check('round-trip: blueprint_family === venture',
    e && e.blueprint_family === 'venture',
    'got: ' + JSON.stringify(e && e.blueprint_family));
  check('round-trip: hypothesis_text intact',
    e && e.hypothesis_text === 'I believe X drives Y',
    'got: ' + JSON.stringify(e && e.hypothesis_text));
  // The drain reads the whole entry object; the additive keys ride for free.
  check('drain-side: recovered entry (what the drain replays) carries all three',
    e && e.role_blend && e.blueprint_family === 'venture' &&
    e.hypothesis_text === 'I believe X drives Y',
    'got: ' + JSON.stringify(e));
}

// ---- Group 2: additive shape -- absent fields produce the pre-change shape ----
process.stdout.write('--- Group 2: additive shape (keys ABSENT, not present-as-null) ---\n');
{
  resetScratchpad();
  const writeOps = freshLoad();

  writeOps.writeScratchpadBirthAnswer({
    gate_id: 'B2',
    option_key: 'approve',
    canonical_verb: 'Approve',
    alias_label: 'Approve',
    ts: 1750000000002
  });

  const readOps = freshLoad();
  const e = readOps.readScratchpad().birth_gate_answers[0];

  // The pre-change shape: gate_id/option_key/canonical_verb/alias_label/ts only.
  const expectedKeys = ['gate_id', 'option_key', 'canonical_verb', 'alias_label', 'ts'].sort();
  const actualKeys = e ? Object.keys(e).sort() : [];
  check('additive: entry with no new fields has EXACTLY the pre-change keys',
    JSON.stringify(actualKeys) === JSON.stringify(expectedKeys),
    'got keys: ' + JSON.stringify(actualKeys));
  check('additive: role_blend key is ABSENT (not present-as-null)',
    e && !('role_blend' in e),
    'has role_blend: ' + (e && ('role_blend' in e)));
  check('additive: blueprint_family key is ABSENT (not present-as-null)',
    e && !('blueprint_family' in e),
    'has blueprint_family: ' + (e && ('blueprint_family' in e)));
  check('additive: hypothesis_text key is ABSENT (not present-as-null)',
    e && !('hypothesis_text' in e),
    'has hypothesis_text: ' + (e && ('hypothesis_text' in e)));
}

// ---- Group 3: existing free_text + arrival_asset persistence stays byte-identical ----
process.stdout.write('--- Group 3: existing free_text + arrival_asset unchanged ---\n');
{
  resetScratchpad();
  const writeOps = freshLoad();

  writeOps.writeScratchpadBirthAnswer({
    gate_id: 'B1',
    option_key: 'a',
    canonical_verb: 'RunMethodology',
    alias_label: 'A solution looking for its problem',
    free_text: 'a free text note',
    arrival_asset: 'solution-seeking',
    ts: 1750000000003
  });

  const readOps = freshLoad();
  const e = readOps.readScratchpad().birth_gate_answers[0];

  check('existing: free_text still persists', e && e.free_text === 'a free text note', JSON.stringify(e));
  check('existing: arrival_asset still persists', e && e.arrival_asset === 'solution-seeking', JSON.stringify(e));
  check('existing: the three new keys stay absent when not passed',
    e && !('role_blend' in e) && !('blueprint_family' in e) && !('hypothesis_text' in e),
    JSON.stringify(e));
}

// ---- Group 4: type discipline -- malformed values are dropped ----
process.stdout.write('--- Group 4: type discipline (malformed dropped, T-179-05) ---\n');
{
  resetScratchpad();
  const writeOps = freshLoad();

  writeOps.writeScratchpadBirthAnswer({
    gate_id: 'B1',
    option_key: 'persona',
    canonical_verb: 'RunMethodology',
    alias_label: 'Persona',
    role_blend: ['not', 'an', 'object'],   // array -> dropped (not a plain object)
    blueprint_family: 12345,               // number -> dropped (not a string)
    hypothesis_text: { not: 'a string' },  // object -> dropped (not a string)
    ts: 1750000000004
  });

  const readOps = freshLoad();
  const e = readOps.readScratchpad().birth_gate_answers[0];

  check('type-discipline: array role_blend is DROPPED',
    e && !('role_blend' in e), 'got: ' + JSON.stringify(e && e.role_blend));
  check('type-discipline: non-string blueprint_family is DROPPED',
    e && !('blueprint_family' in e), 'got: ' + JSON.stringify(e && e.blueprint_family));
  check('type-discipline: non-string hypothesis_text is DROPPED',
    e && !('hypothesis_text' in e), 'got: ' + JSON.stringify(e && e.hypothesis_text));

  // null role_blend is also not a plain object -> dropped.
  resetScratchpad();
  const writeOps2 = freshLoad();
  writeOps2.writeScratchpadBirthAnswer({
    gate_id: 'B1', option_key: 'persona', canonical_verb: 'RunMethodology',
    alias_label: 'Persona', role_blend: null, ts: 1750000000005
  });
  const e2 = freshLoad().readScratchpad().birth_gate_answers[0];
  check('type-discipline: null role_blend is DROPPED',
    e2 && !('role_blend' in e2), 'got: ' + JSON.stringify(e2 && e2.role_blend));
}

process.stdout.write('\n');
process.stdout.write('=== Results: ' + passed + '/' + checks + ' passed ===\n');

if (passed < checks) {
  process.exit(1);
}
process.exit(0);
