'use strict';
// Phase 357-01 Task 2 -- the loader test for the Phase 357 replay corpus
// (GATE357-01), plus the --dogfood-strict mode (GATE357-09).
//
// Runs against scripts/card-fire-replay-corpus.cjs, the loader Task 1 wrote.
// The module's exports are this test's only interface (no second reader).
//
// EXPECTED RED WINDOW (this is the 238-07 tests-first precedent, not a
// defect -- see tests/test-238-card-fire-corpus.cjs's own header for the
// same pattern): L3 (sources and floor) and L4 (mode rule) are RED until
// plan 357-06 lands dogfood entries and plans 357-04/05 land debug and live
// entries. The empty-entries fixture files this plan ships have 0 entries
// in debug/live/dogfood, so L3's "all four sources have >=1 entry" and
// ">=45 total entries" checks fail by construction; L4 currently passes
// vacuously (nothing to violate its rule yet), which is why the acceptance
// criteria names "L3 or L4" as the failing legs, not both unconditionally.
// --dogfood-strict is RED until the plan 357-08 human checkpoint ratifies
// labels (dogfood entries need label_origin:'human' and >=20 count).
//
// No em-dashes anywhere (hyphens only, CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const corpusMod = require(path.join(REPO, 'scripts', 'card-fire-replay-corpus.cjs'));
const { loadCorpus, validateEntry, SOURCES, SOURCE_FILES, CORPUS_238_PATH, CORPUS_DIR } = corpusMod;

const EM_DASH = String.fromCharCode(0x2014);

console.log('test-357-corpus-loader');

let n = 0;
function ok(desc) { n += 1; console.log('  ok   ' + desc); }

function sha256(buf) {
  return require('node:crypto').createHash('sha256').update(buf).digest('hex');
}

// ---------------------------------------------------------------------
// L1: structure -- loadCorpus({}) returns zero errors; every entry passes
// validateEntry with its file meta; ids are unique.
// ---------------------------------------------------------------------
function runL1() {
  const failures = [];
  const r = loadCorpus({});
  if (r.errors.length !== 0) {
    failures.push('loadCorpus returned errors: ' + JSON.stringify(r.errors));
  }
  const seen = new Set();
  for (const e of r.entries) {
    if (seen.has(e.id)) failures.push('duplicate entry id: ' + e.id);
    seen.add(e.id);
    const fileMeta = r.files[e.source] && r.files[e.source].meta;
    const entryErrors = validateEntry(e, fileMeta);
    if (entryErrors.length) failures.push(e.id + ': ' + entryErrors.join('; '));
  }
  return failures;
}

// ---------------------------------------------------------------------
// L2: the 238 adapter -- exactly 18 entries with source 238; 10 :s1
// expected pass; 4 :s2 and 4 :s3, all expected block; the 238 file's own
// sha256 is unchanged by loading (read before and after).
// ---------------------------------------------------------------------
function runL2() {
  const failures = [];
  const before = sha256(fs.readFileSync(CORPUS_238_PATH));
  const r = loadCorpus({});
  const after = sha256(fs.readFileSync(CORPUS_238_PATH));
  if (before !== after) failures.push('the 238 file sha256 changed after loading (D-01 violation)');

  const e238 = r.entries.filter((e) => e.source === '238');
  if (e238.length !== 18) failures.push('expected 18 source-238 entries, got ' + e238.length);

  const s1 = e238.filter((e) => e.id.endsWith(':s1'));
  const s2 = e238.filter((e) => e.id.endsWith(':s2'));
  const s3 = e238.filter((e) => e.id.endsWith(':s3'));
  if (s1.length !== 10) failures.push('expected 10 :s1 entries, got ' + s1.length);
  if (s2.length !== 4) failures.push('expected 4 :s2 entries, got ' + s2.length);
  if (s3.length !== 4) failures.push('expected 4 :s3 entries, got ' + s3.length);
  if (!s1.every((e) => e.expected_verdict_class === 'pass')) {
    failures.push(':s1 entries must all be expected_verdict_class "pass"');
  }
  if (![...s2, ...s3].every((e) => e.expected_verdict_class === 'block')) {
    failures.push(':s2/:s3 entries must all be expected_verdict_class "block"');
  }
  return failures;
}

// ---------------------------------------------------------------------
// L3: sources and floor (SPEC R1 acceptance) -- all four sources have at
// least one entry; total entries >= 45; every non-238 file has a
// non-empty meta.sanitization_statement.
// ---------------------------------------------------------------------
function runL3() {
  const failures = [];
  const r = loadCorpus({});
  for (const src of SOURCES) {
    const count = r.entries.filter((e) => e.source === src).length;
    if (count < 1) failures.push('source "' + src + '" has 0 entries (SPEC R1 floor: >=1)');
  }
  if (r.entries.length < 45) {
    failures.push('total entries ' + r.entries.length + ' is below the SPEC R1 floor of 45');
  }
  for (const src of Object.keys(SOURCE_FILES)) {
    const f = r.files[src];
    if (f && (!f.meta || !f.meta.sanitization_statement)) {
      failures.push('source "' + src + '" file is missing meta.sanitization_statement');
    }
  }
  return failures;
}

// ---------------------------------------------------------------------
// L4: mode rule -- every live and dogfood entry has envelope.mode
// containing "transcript" (R-I); no direct-mode entry carries
// gate_is_fresh.
// ---------------------------------------------------------------------
function runL4() {
  const failures = [];
  const r = loadCorpus({});
  for (const e of r.entries) {
    if (!e.envelope || typeof e.envelope.mode !== 'string') continue;
    if ((e.source === 'live' || e.source === 'dogfood') && e.envelope.mode.indexOf('transcript') === -1) {
      failures.push(e.id + ': live/dogfood entry must carry an envelope.mode containing "transcript"');
    }
    if (e.envelope.mode === 'direct' && Object.prototype.hasOwnProperty.call(e.envelope, 'gate_is_fresh')) {
      failures.push(e.id + ': direct-mode entry must not carry gate_is_fresh');
    }
  }
  return failures;
}

// ---------------------------------------------------------------------
// L5: known lists -- every known_miss entry has expected block and a
// reason containing "text" (text-dependence, SPEC acceptance); every
// known_false_block entry has expected pass and a non-empty reason.
// Prints both id lists.
// ---------------------------------------------------------------------
function runL5() {
  const failures = [];
  const r = loadCorpus({});
  const knownMissIds = [];
  const knownFalseBlockIds = [];
  for (const e of r.entries) {
    if (e.known_miss) {
      knownMissIds.push(e.id);
      if (e.expected_verdict_class !== 'block') {
        failures.push(e.id + ': known_miss requires expected_verdict_class "block"');
      }
      if (!/text/i.test(e.known_miss.reason || '')) {
        failures.push(e.id + ': known_miss.reason must contain the word "text" (text-dependence)');
      }
    }
    if (e.known_false_block) {
      knownFalseBlockIds.push(e.id);
      if (e.expected_verdict_class !== 'pass') {
        failures.push(e.id + ': known_false_block requires expected_verdict_class "pass"');
      }
      if (!e.known_false_block.reason) {
        failures.push(e.id + ': known_false_block.reason must be non-empty');
      }
    }
  }
  console.log('       known_miss ids: ' + JSON.stringify(knownMissIds));
  console.log('       known_false_block ids: ' + JSON.stringify(knownFalseBlockIds));
  return failures;
}

// ---------------------------------------------------------------------
// L6: no em-dash in any fixture file.
// ---------------------------------------------------------------------
function runL6() {
  const failures = [];
  const files = [CORPUS_238_PATH]
    .concat(Object.values(SOURCE_FILES).map((f) => path.join(CORPUS_DIR, f)))
    .concat([path.join(CORPUS_DIR, 'pre-phase.json')]);
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    if (text.indexOf(EM_DASH) !== -1) failures.push(f + ' contains an em-dash (U+2014)');
  }
  return failures;
}

// ---------------------------------------------------------------------
// --dogfood-strict (GATE357-09): dogfood has >= 20 entries; every dogfood
// entry has label_origin === 'human'; every dogfood entry either lacks
// envelope_partial or has it false; the dogfood file meta carries
// verdict_preservation: 'checked' (written by the plan-06 extractor after
// its raw-vs-sanitized check).
// ---------------------------------------------------------------------
function runDogfoodStrict() {
  const failures = [];
  const r = loadCorpus({});
  const dogfoodEntries = r.entries.filter((e) => e.source === 'dogfood');
  if (dogfoodEntries.length < 20) {
    failures.push('dogfood-strict: expected >=20 dogfood entries, got ' + dogfoodEntries.length);
  }
  for (const e of dogfoodEntries) {
    if (e.label_origin !== 'human') {
      failures.push(e.id + ': dogfood-strict requires label_origin "human"');
    }
    if (e.envelope_partial === true) {
      failures.push(e.id + ': dogfood-strict forbids envelope_partial === true');
    }
  }
  const dogfoodMeta = r.files.dogfood && r.files.dogfood.meta;
  if (!dogfoodMeta || dogfoodMeta.verdict_preservation !== 'checked') {
    failures.push('dogfood-strict: dogfood file meta.verdict_preservation must be "checked"');
  }
  return failures;
}

// ---------------------------------------------------------------------
// Driver: runs L1-L6 always; runs --dogfood-strict only when the flag is
// passed. Every leg runs regardless of prior failures (non-throwing
// recorder), so the SUMMARY can capture the full red-leg list in one run,
// mirroring test-238-card-fire-corpus.cjs's state1Failures pattern.
// ---------------------------------------------------------------------
const argv = process.argv.slice(2);
const dogfoodStrict = argv.indexOf('--dogfood-strict') !== -1;

const legs = [
  ['L1 structure', runL1],
  ['L2 238 adapter', runL2],
  ['L3 sources and floor (SPEC R1)', runL3],
  ['L4 mode rule (R-I)', runL4],
  ['L5 known lists', runL5],
  ['L6 no em-dash', runL6],
];

const redNames = [];
for (const [name, fn] of legs) {
  n += 1;
  let failures;
  try {
    failures = fn();
  } catch (e) {
    failures = ['threw: ' + e.message];
  }
  if (failures.length === 0) {
    ok(name);
  } else {
    redNames.push(name);
    console.log('  FAIL ' + name);
    failures.forEach((f) => console.log('       - ' + f));
  }
}

if (dogfoodStrict) {
  n += 1;
  let failures;
  try {
    failures = runDogfoodStrict();
  } catch (e) {
    failures = ['threw: ' + e.message];
  }
  if (failures.length === 0) {
    ok('dogfood-strict (GATE357-09)');
  } else {
    redNames.push('dogfood-strict (GATE357-09)');
    console.log('  FAIL dogfood-strict (GATE357-09)');
    failures.forEach((f) => console.log('       - ' + f));
  }
}

console.log('');
if (redNames.length === 0) {
  console.log('PASS test-357-corpus-loader (' + n + ' legs)');
  process.exit(0);
} else {
  console.log('RED legs: ' + redNames.join(', '));
  console.log('FAIL test-357-corpus-loader (' + redNames.length + '/' + n + ' legs red)');
  process.exit(1);
}
