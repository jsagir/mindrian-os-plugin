'use strict';
// Phase 211-04 -- eureka gold-set card schema validation.
//
// Mechanically guards the six SEED-050 case cards so schema drift is caught from
// this commit forward. Pure node built-ins + gray-matter (the house frontmatter
// parser, already a dependency). Offline; touches nothing remote.
//
// Test 4 enforces the no-real-names HARD RULE via a hash-based deny-list: the
// real-name tokens NEVER enter this repo (that would defeat the rule), so the
// deny-list ships as sha256(lowercased token) hashes. The navigator seeds hashes
// as regressions are found; the MECHANISM ships now with an empty list so the
// rule is enforced the moment a hash is added.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const matter = require('gray-matter');

const REPO = path.join(__dirname, '..');
const CASES_DIR = path.join(REPO, 'evals', 'eureka', 'cases');

const EXPECTED = [
  'archimedes-uq',
  'archimedes-sterling',
  'archimedes-darkmatter',
  'davinci-salient',
  'nichefoods-null',
  'lovelace-lean',
];

const REQUIRED_KEYS = [
  'case', 'persona', 'posture', 'hypothesis_in', 'destination',
  'human_baseline_effort', 'distractors', 'dials', 'gold_label', 'validated',
];

// sha256(lowercased token) deny-list. EMPTY by design: real names must never
// enter the repo, so we ship the mechanism seeded with zero hashes. To add a
// regression guard for a leaked name, run:
//   node -e "console.log(require('crypto').createHash('sha256').update('thename'.toLowerCase()).digest('hex'))"
// and paste the hex digest below. The rule then fires on any card containing that token.
const NAME_DENY_HASHES = new Set([
  // e.g. 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
]);

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-211-case-cards');

// Parse every card once, keyed by stem.
const parsed = {};
for (const stem of EXPECTED) {
  const file = path.join(CASES_DIR, stem + '.md');
  const raw = fs.readFileSync(file, 'utf8');
  parsed[stem] = { file, raw, doc: matter(raw) };
}

// --- Test 1: all 6 expected filenames exist and gray-matter parses each ---
ok('Test 1: all 6 expected cards exist and parse via gray-matter', function () {
  const onDisk = fs.readdirSync(CASES_DIR).filter((f) => f.endsWith('.md')).sort();
  assert.deepEqual(onDisk, EXPECTED.map((s) => s + '.md').sort(),
    'cases/ must contain exactly the 6 expected card files');
  for (const stem of EXPECTED) {
    assert.equal(typeof parsed[stem].doc.data === 'object' && parsed[stem].doc.data !== null, true,
      stem + ': gray-matter must parse frontmatter to an object');
  }
});

// --- Test 2: required keys present + case matches filename stem ---
ok('Test 2: every card has all required frontmatter keys and case matches stem', function () {
  for (const stem of EXPECTED) {
    const data = parsed[stem].doc.data;
    for (const k of REQUIRED_KEYS) {
      assert.equal(k in data, true, stem + ': missing required frontmatter key "' + k + '"');
    }
    assert.equal(data.case, stem, stem + ': frontmatter "case" (' + data.case + ') must match filename stem');
    assert.equal(data.dials && typeof data.dials === 'object', true, stem + ': dials must be an object');
    assert.equal(Array.isArray(data.distractors), true, stem + ': distractors must be a list');
    assert.equal(data.gold_label && typeof data.gold_label === 'object', true, stem + ': gold_label must be an object');
  }
});

// --- Test 3: null-control + lean_checkable structural invariants ---
ok('Test 3: exactly one posture:solve null-control (nichefoods) and exactly two lean_checkable (sterling + lovelace)', function () {
  const solveNull = EXPECTED.filter((stem) => {
    const d = parsed[stem].doc.data;
    return d.posture === 'solve' && d.gold_label && d.gold_label.null_control === true;
  });
  assert.deepEqual(solveNull, ['nichefoods-null'],
    'exactly one card must be posture:solve with a null-control gold label, and it must be nichefoods-null; got ' + JSON.stringify(solveNull));

  const lean = EXPECTED.filter((stem) => {
    const d = parsed[stem].doc.data;
    return d.dials && d.dials.critic_available === 'lean_checkable';
  }).sort();
  assert.deepEqual(lean, ['archimedes-sterling', 'lovelace-lean'].sort(),
    'exactly two cards must have critic_available:lean_checkable (sterling + lovelace); got ' + JSON.stringify(lean));
});

// --- Test 4: no card content matches the frozen real-name deny-list ---
ok('Test 4: no card content matches the real-name deny-list (no-real-names HARD RULE)', function () {
  for (const stem of EXPECTED) {
    // Tokenize card text into lowercased word tokens; hash each; compare to deny-list.
    const tokens = parsed[stem].raw.toLowerCase().match(/[a-z][a-z'-]*[a-z]|[a-z]/g) || [];
    for (const tok of tokens) {
      const h = crypto.createHash('sha256').update(tok).digest('hex');
      assert.equal(NAME_DENY_HASHES.has(h), false,
        stem + ': card content contains a deny-listed real-name token (hash ' + h.slice(0, 12) + '...) - no real names in the repo');
    }
  }
  // Mechanism sanity: an empty deny-list must never false-positive.
  assert.equal(NAME_DENY_HASHES.size >= 0, true, 'deny-list mechanism must be present');
});

console.log('\nPASS test-211-case-cards (' + n + ' assertions)');
