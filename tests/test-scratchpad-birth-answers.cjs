'use strict';
// Phase 155-01 Task 2 -- scratchpad birth_gate_answers round-trip driver.
//
// Asserts:
//   - readScratchpad() returns birth_gate_answers: [] when absent
//   - readScratchpad() preserves birth_gate_answers when present (closes RESEARCH Pitfall 2)
//   - writeScratchpadBirthAnswer() appends entries; second call appends (not overwrite)
//   - writeScratchpadBirthAnswer() round-trips all fields (gate_id, option_key,
//     canonical_verb, alias_label, free_text, arrival_asset, ts)
//   - read-modify-write cycle does NOT drop opportunities or highlights (the original keys)
//   - drainBirthGateAnswers is exported (function or stub)
//
// Self-contained: uses fs.mkdtempSync for HOME isolation (no real HOME pollution).
// No node:sqlite. No LLM invocation.
// NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).

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

process.stdout.write('=== test-scratchpad-birth-answers.cjs ===\n\n');

// Set up isolated HOME in a temp dir
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-test-'));
const origHome = process.env.HOME;
process.env.HOME = tmpHome;

const MINDRIAN_DIR = path.join(tmpHome, '.mindrian');
const SCRATCHPAD_PATH = path.join(MINDRIAN_DIR, 'scratchpad.json');

// Clean up on exit
process.on('exit', () => {
  process.env.HOME = origHome;
  try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) {}
});

// Load the module AFTER setting process.env.HOME so SCRATCHPAD_DIR resolves
// to our temp dir. We require the module fresh each time by clearing the cache.
function freshLoad() {
  const modPath = require.resolve(path.join(REPO_ROOT, 'lib/core/scratchpad-ops.cjs'));
  delete require.cache[modPath];
  return require(modPath);
}

// Helper: reset scratchpad to empty
function resetScratchpad() {
  fs.mkdirSync(MINDRIAN_DIR, { recursive: true });
  if (fs.existsSync(SCRATCHPAD_PATH)) fs.rmSync(SCRATCHPAD_PATH);
}

// Helper: write fixture scratchpad
function writeFixture(obj) {
  fs.mkdirSync(MINDRIAN_DIR, { recursive: true });
  fs.writeFileSync(SCRATCHPAD_PATH, JSON.stringify(obj, null, 2), 'utf-8');
}

let ops;
try {
  ops = freshLoad();
} catch (err) {
  process.stdout.write('FATAL: could not load lib/core/scratchpad-ops.cjs: ' + err.message + '\n');
  process.exit(1);
}

// ---- Test Group 1: readScratchpad() on missing file ----
process.stdout.write('--- Group 1: readScratchpad() defaults ---\n');
{
  resetScratchpad();
  ops = freshLoad();
  const result = ops.readScratchpad();
  check(
    'readScratchpad() on missing file returns birth_gate_answers: []',
    Array.isArray(result.birth_gate_answers) && result.birth_gate_answers.length === 0,
    'got: ' + JSON.stringify(result.birth_gate_answers)
  );
  check(
    'readScratchpad() on missing file returns opportunities: []',
    Array.isArray(result.opportunities),
    'got: ' + JSON.stringify(result.opportunities)
  );
  check(
    'readScratchpad() on missing file returns highlights: []',
    Array.isArray(result.highlights),
    'got: ' + JSON.stringify(result.highlights)
  );
}

// ---- Test Group 2: readScratchpad() preserves birth_gate_answers from fixture ----
process.stdout.write('--- Group 2: readScratchpad() preserves birth_gate_answers (Pitfall 2 closed) ---\n');
{
  writeFixture({
    opportunities: [{ problem: 'test opp', domain: 'tech' }],
    highlights: [{ text: 'a highlight', timestamp: '2026-01-01T00:00:00Z' }],
    persona: null,
    framework_chain_progress: null,
    last_updated: '2026-01-01T00:00:00Z',
    birth_gate_answers: [
      { gate_id: 'B1', option_key: 'a', canonical_verb: 'RunMethodology',
        alias_label: 'A solution looking for its problem',
        arrival_asset: 'solution-seeking', ts: 1700000000000 }
    ]
  });
  ops = freshLoad();
  const result = ops.readScratchpad();

  check(
    'readScratchpad() preserves birth_gate_answers array (length 1)',
    Array.isArray(result.birth_gate_answers) && result.birth_gate_answers.length === 1,
    'got length: ' + (Array.isArray(result.birth_gate_answers) ? result.birth_gate_answers.length : 'undefined')
  );

  const bga0 = Array.isArray(result.birth_gate_answers) ? result.birth_gate_answers[0] : null;
  check(
    'readScratchpad() preserved gate_id B1',
    bga0 && bga0.gate_id === 'B1',
    'got: ' + JSON.stringify(bga0)
  );
  check(
    'readScratchpad() preserved arrival_asset field',
    bga0 && bga0.arrival_asset === 'solution-seeking',
    'got: ' + JSON.stringify(bga0)
  );
  check(
    'readScratchpad() still returns opportunities alongside birth_gate_answers',
    Array.isArray(result.opportunities) && result.opportunities.length === 1,
    'got: ' + JSON.stringify(result.opportunities)
  );
  check(
    'readScratchpad() still returns highlights alongside birth_gate_answers',
    Array.isArray(result.highlights) && result.highlights.length === 1,
    'got: ' + JSON.stringify(result.highlights)
  );
}

// ---- Test Group 3: writeScratchpadBirthAnswer() function presence ----
process.stdout.write('--- Group 3: writeScratchpadBirthAnswer() exported and appends ---\n');
{
  ops = freshLoad();
  const hasWriteFn = typeof ops.writeScratchpadBirthAnswer === 'function';
  check(
    'writeScratchpadBirthAnswer is exported as a function',
    hasWriteFn,
    'got: ' + typeof ops.writeScratchpadBirthAnswer
  );

  if (hasWriteFn) {
    resetScratchpad();
    ops = freshLoad();

    ops.writeScratchpadBirthAnswer({
      gate_id: 'B2', option_key: 'approve',
      canonical_verb: 'Approve', alias_label: 'Approve', ts: Date.now()
    });
    const after1 = ops.readScratchpad();
    check(
      'writeScratchpadBirthAnswer() appends first entry (length 1)',
      Array.isArray(after1.birth_gate_answers) && after1.birth_gate_answers.length === 1,
      'got: ' + JSON.stringify(after1.birth_gate_answers)
    );
    const e1 = Array.isArray(after1.birth_gate_answers) ? after1.birth_gate_answers[0] : null;
    check(
      'first entry gate_id is B2',
      e1 && e1.gate_id === 'B2',
      'got: ' + JSON.stringify(e1)
    );
    check(
      'first entry canonical_verb is Approve',
      e1 && e1.canonical_verb === 'Approve',
      'got: ' + JSON.stringify(e1)
    );

    ops.writeScratchpadBirthAnswer({
      gate_id: 'B2', option_key: 'defer',
      canonical_verb: 'Defer', alias_label: 'Defer', ts: Date.now()
    });
    const after2 = ops.readScratchpad();
    check(
      'writeScratchpadBirthAnswer() second call appends (not overwrites) -- length 2',
      Array.isArray(after2.birth_gate_answers) && after2.birth_gate_answers.length === 2,
      'got: ' + JSON.stringify(after2.birth_gate_answers)
    );
  } else {
    // Mark remaining checks in this group as skipped-fail
    check('writeScratchpadBirthAnswer() appends first entry (length 1)', false, 'fn not exported');
    check('first entry gate_id is B2', false, 'fn not exported');
    check('first entry canonical_verb is Approve', false, 'fn not exported');
    check('writeScratchpadBirthAnswer() second call appends -- length 2', false, 'fn not exported');
  }
}

// ---- Test Group 4: round-trip all fields ----
process.stdout.write('--- Group 4: writeScratchpadBirthAnswer() round-trips all fields ---\n');
{
  ops = freshLoad();
  if (typeof ops.writeScratchpadBirthAnswer === 'function') {
    resetScratchpad();
    ops = freshLoad();

    const fullEntry = {
      gate_id: 'B1',
      option_key: 'a',
      canonical_verb: 'RunMethodology',
      alias_label: 'A solution looking for its problem',
      arrival_asset: 'solution-seeking',
      free_text: 'some free text note',
      ts: 1750000000000
    };
    ops.writeScratchpadBirthAnswer(fullEntry);

    const result = ops.readScratchpad();
    check(
      'round-trip: birth_gate_answers has one entry',
      Array.isArray(result.birth_gate_answers) && result.birth_gate_answers.length === 1,
      'got: ' + JSON.stringify(result.birth_gate_answers)
    );

    const e = Array.isArray(result.birth_gate_answers) ? result.birth_gate_answers[0] : null;
    check('round-trip: gate_id B1', e && e.gate_id === 'B1', JSON.stringify(e));
    check('round-trip: option_key a', e && e.option_key === 'a', JSON.stringify(e));
    check('round-trip: canonical_verb RunMethodology', e && e.canonical_verb === 'RunMethodology', JSON.stringify(e));
    check('round-trip: alias_label', e && e.alias_label === 'A solution looking for its problem', JSON.stringify(e));
    check('round-trip: arrival_asset solution-seeking', e && e.arrival_asset === 'solution-seeking', JSON.stringify(e));
    check('round-trip: free_text', e && e.free_text === 'some free text note', JSON.stringify(e));
    check('round-trip: ts 1750000000000', e && e.ts === 1750000000000, JSON.stringify(e));
  } else {
    check('round-trip: birth_gate_answers has one entry', false, 'fn not exported');
    check('round-trip: gate_id B1', false, 'fn not exported');
    check('round-trip: option_key a', false, 'fn not exported');
    check('round-trip: canonical_verb RunMethodology', false, 'fn not exported');
    check('round-trip: alias_label', false, 'fn not exported');
    check('round-trip: arrival_asset solution-seeking', false, 'fn not exported');
    check('round-trip: free_text', false, 'fn not exported');
    check('round-trip: ts 1750000000000', false, 'fn not exported');
  }
}

// ---- Test Group 5: read-modify-write does NOT drop existing keys ----
process.stdout.write('--- Group 5: read-modify-write preserves opportunities and highlights ---\n');
{
  ops = freshLoad();
  if (typeof ops.writeScratchpadBirthAnswer === 'function') {
    writeFixture({
      opportunities: [{ problem: 'opp A', domain: 'biotech' }],
      highlights: [{ text: 'highlight X', timestamp: '2026-06-12T00:00:00Z' }],
      persona: null,
      framework_chain_progress: null,
      last_updated: '2026-06-12T00:00:00Z',
      birth_gate_answers: []
    });
    ops = freshLoad();

    ops.writeScratchpadBirthAnswer({
      gate_id: 'B2', option_key: 'approve', canonical_verb: 'Approve',
      alias_label: 'Approve', ts: Date.now()
    });

    const result = ops.readScratchpad();
    check(
      'read-modify-write: opportunities survive writeScratchpadBirthAnswer',
      Array.isArray(result.opportunities) && result.opportunities.length === 1 &&
      result.opportunities[0].problem === 'opp A',
      'got: ' + JSON.stringify(result.opportunities)
    );
    check(
      'read-modify-write: highlights survive writeScratchpadBirthAnswer',
      Array.isArray(result.highlights) && result.highlights.length === 1 &&
      result.highlights[0].text === 'highlight X',
      'got: ' + JSON.stringify(result.highlights)
    );
    check(
      'read-modify-write: birth_gate_answers now has 1 entry alongside existing keys',
      Array.isArray(result.birth_gate_answers) && result.birth_gate_answers.length === 1,
      'got: ' + JSON.stringify(result.birth_gate_answers)
    );
  } else {
    check('read-modify-write: opportunities survive', false, 'fn not exported');
    check('read-modify-write: highlights survive', false, 'fn not exported');
    check('read-modify-write: birth_gate_answers gains entry', false, 'fn not exported');
  }
}

// ---- Test Group 6: drainBirthGateAnswers is exported ----
process.stdout.write('--- Group 6: drainBirthGateAnswers exported ---\n');
{
  ops = freshLoad();
  check(
    'drainBirthGateAnswers is exported from scratchpad-ops.cjs',
    typeof ops.drainBirthGateAnswers === 'function',
    'got: ' + typeof ops.drainBirthGateAnswers
  );
}

process.stdout.write('\n');
process.stdout.write('=== Results: ' + passed + '/' + checks + ' passed ===\n');

if (passed < checks) {
  process.exit(1);
}
process.exit(0);
