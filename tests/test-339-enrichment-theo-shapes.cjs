#!/usr/bin/env node
'use strict';

/**
 * Phase 339 Plan 02 (FLIP-03a/b/c) -- enrichment capture seam, Theo's TWO
 * payload shapes, written before either additive arm exists.
 * ==========================================================================
 * 1. A Theo RESOLVED readiness payload ({framework, score, inputs, evidence,
 *    unsynced_inputs, coverage, diagnostics}) with score:1 captures, with
 *    readiness_score 1, dimensions_inferred false, and missing_dimensions
 *    the exact vector of dimensions whose Theo input is false -- EXCLUDING
 *    any dimension whose Theo input name appears in unsynced_inputs.
 * 2. The same RESOLVED shape with score:3 (Theo's practical ceiling) returns
 *    {captured:false, reason:'not_a_miss'}; the existing > 2 threshold is
 *    already correct and is not rescaled.
 * 3. A Theo REFUSAL shape ({coverage:{matched:0,total:149,status:'empty'},
 *    refusal:{code,detail}, diagnostics}), with score/inputs/evidence/
 *    framework ABSENT, captures -- probe_provenance carries the refusal
 *    CODE, never the refusal detail.
 * 4. The identical REFUSAL shape with coverage {matched:0,total:0} does NOT
 *    capture and returns reason:'layer_empty'. This is the two-zeros
 *    distinction: {matched:0,total:N>0} is a real signal (the layer has
 *    data, this name just is not in it); {matched:0,total:0} is an empty
 *    layer, and capturing it would be noise, not signal.
 * 5. The incumbent's {grounded:false, anchor:null, note} shape still
 *    captures unchanged, probe_provenance still starts discover_structure@.
 * 6. The incumbent's {readiness_score:1} shape still captures unchanged,
 *    probe_provenance still starts orchestration_readiness@.
 * 7. Canon Part 8: no fixture's refusal.detail string is ever written
 *    anywhere in the queue file on disk, for any fixture, at any point.
 *
 * The seam under test: lib/core/enrichment-queue.cjs's exported
 * captureReadinessMiss (:519), driven directly against a temp roomDir
 * created with fs.mkdtempSync under os.tmpdir(). No module internals are
 * reached into and no new export is added to make this test easier -- the
 * entry point already exists.
 *
 * WAVE 1 (this run): fixtures 1-4 drive a Theo-shaped payload through a
 * function that only recognizes the incumbent's two shapes (typeof
 * pr.grounded === 'boolean', typeof pr.readiness_score === 'number'), so
 * neither of Theo's shapes match either guard and both fall through to the
 * final else: {captured:false, reason:'invalid_probe_result'}. Fixtures 1-4
 * therefore FAIL against the assertions below, on purpose. Fixtures 5 and 6
 * (the incumbent's own shapes) PASS today, unchanged. This mixed result is
 * the correct wave-1 state -- do not weaken any assertion to make fixtures
 * 1-4 pass early; they are the target 339-05 must reach with the two
 * additive arms (D-03 corrected, 339-CONTEXT.md).
 *
 * What this file keys on: PAYLOAD SHAPE, never key presence alone --
 * typeof pr.score === 'number' && pr.inputs (Theo RESOLVED) vs. a coverage
 * object plus a refusal object with no score/inputs/evidence/framework
 * (Theo REFUSAL), mirroring the already-shipped brain_query dual-shape
 * branch (brain-client.cjs:927-945, commit 21fdd7bc) per D-04. What it
 * deliberately does NOT key on: it never asserts on the note/detail TEXT of
 * any refusal or discover_structure payload, only on typed shape and closed
 * enum values (Canon Part 8).
 *
 * node:test, CJS, node:assert/strict + node:fs/node:os/node:path only. No
 * new deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, after } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const ENRICHMENT_QUEUE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'enrichment-queue.cjs');

function freshEnrichmentQueue() {
  delete require.cache[ENRICHMENT_QUEUE_PATH];
  return require(ENRICHMENT_QUEUE_PATH);
}

// A fresh temp roomDir per test file run, removed in an after() teardown.
// fs.mkdtempSync guarantees a unique directory; each fixture gets its own
// framework name (never its own roomDir) so the Part 8 arm at the bottom can
// read the ONE queue file and scan every fixture's bytes in one pass.
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'test-339-enrichment-'));
after(() => {
  try { fs.rmSync(TMP_ROOT, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
});

function readQueueRaw(roomDir, mod) {
  const qp = mod._test.queuePath(roomDir);
  if (!fs.existsSync(qp)) return null;
  return fs.readFileSync(qp, 'utf8');
}

function findEntry(roomDir, mod, frameworkName) {
  const raw = readQueueRaw(roomDir, mod);
  if (raw === null) return null;
  const parsed = JSON.parse(raw);
  return parsed.entries.find(function (e) { return e.framework === frameworkName; }) || null;
}

// ---------------------------------------------------------------------------
// Theo input name -> ALLOWED_DIMENSIONS member, verbatim from 339-RESEARCH.md
// Design 2 and orchestration-readiness.ts:279-284. Only used to CONSTRUCT
// fixture payloads and to state the expected mapping in an assertion
// message; the seam under test owns its own copy once 339-05 lands.
// ---------------------------------------------------------------------------
// has_structure -> structure, has_ordering -> flow, has_technique ->
// techniques, pattern_known -> pattern_type.

// ---------------------------------------------------------------------------
// Fixture 1: Theo RESOLVED shape, score:1, pattern_known false AND listed in
// unsynced_inputs -- the honesty subtlety this whole file exists to pin.
// ---------------------------------------------------------------------------
const FIXTURE_1_FRAMEWORK = 'Test339 Fixture1 Six Thinking Hats';
const fixture1Probe = Object.freeze({
  framework: FIXTURE_1_FRAMEWORK,
  score: 1,
  inputs: Object.freeze({
    has_structure: true,
    has_ordering: false,
    has_technique: false,
    pattern_known: false,
  }),
  evidence: Object.freeze({
    structure_components: 3,
    ordering_edges: 0,
    technique_links: 0,
    orchestration_status: 'draft',
  }),
  unsynced_inputs: Object.freeze(['pattern_known']),
  coverage: Object.freeze({ matched: 1, total: 149, status: 'partial' }),
  diagnostics: Object.freeze({ tool: 'orchestration_readiness' }),
});

test('Fixture 1: Theo RESOLVED shape (score:1, pattern_known unsynced) captures with the honesty filter excluding pattern_type', () => {
  const mod = freshEnrichmentQueue();
  const roomDir = path.join(TMP_ROOT, 'shared-room');
  const result = mod.captureReadinessMiss(roomDir, FIXTURE_1_FRAMEWORK, fixture1Probe, {});
  // A genuine capture forwards enqueue()'s own return shape ({queued, queue_size}),
  // never {captured:true} -- only the early not-a-miss/error returns use `captured`
  // (the existing incumbent arms already follow this exact convention, see
  // tests/test-249-enrichment-queue.cjs Test 10, r1.queued/r2.queued/r3.queued).
  assert.strictEqual(
    result.queued,
    true,
    'a Theo RESOLVED score:1 payload must capture once the two additive arms land ' +
      '(wave 1: currently falls through to invalid_probe_result, see 339-05)'
  );
  const entry = findEntry(roomDir, mod, FIXTURE_1_FRAMEWORK);
  assert.ok(entry, 'the captured entry must be readable back from the written queue file');
  assert.strictEqual(entry.readiness_score, 1, 'readiness_score must equal the Theo score verbatim');
  assert.notStrictEqual(
    entry.dimensions_inferred,
    true,
    'dimensions_inferred must be false: Theo gave a precise inputs vector, this is not an inference'
  );
  // has_ordering:false -> flow missing; has_technique:false -> techniques
  // missing; pattern_known:false is EXCLUDED because it is listed in
  // unsynced_inputs -- reporting it as missing would queue enrichment for a
  // gap the Theo input itself flags as unreliable, not confirmed absent.
  assert.deepStrictEqual(
    entry.missing_dimensions,
    ['techniques', 'flow'],
    'missing_dimensions must be exactly the dimensions whose Theo input is false, ' +
      'EXCLUDING pattern_type (its Theo input, pattern_known, is listed in unsynced_inputs)'
  );
  assert.ok(!entry.missing_dimensions.includes('pattern_type'), 'pattern_type must never appear: its input is unsynced, not confirmed missing');
});

// ---------------------------------------------------------------------------
// Fixture 2: Theo RESOLVED shape, score:3 (Theo's practical ceiling). The
// existing > 2 threshold is correct as written; this proves it is not
// rescaled for Theo's payload.
// ---------------------------------------------------------------------------
const FIXTURE_2_FRAMEWORK = 'Test339 Fixture2 JTBD';
const fixture2Probe = Object.freeze({
  framework: FIXTURE_2_FRAMEWORK,
  score: 3,
  inputs: Object.freeze({
    has_structure: true,
    has_ordering: true,
    has_technique: true,
    pattern_known: false,
  }),
  evidence: Object.freeze({
    structure_components: 5,
    ordering_edges: 4,
    technique_links: 1,
    orchestration_status: 'draft',
  }),
  unsynced_inputs: Object.freeze(['pattern_known']),
  coverage: Object.freeze({ matched: 1, total: 149, status: 'partial' }),
  diagnostics: Object.freeze({ tool: 'orchestration_readiness' }),
});

test('Fixture 2: Theo RESOLVED shape (score:3, the practical ceiling) is not a miss, the existing > 2 threshold is not rescaled', () => {
  const mod = freshEnrichmentQueue();
  const roomDir = path.join(TMP_ROOT, 'shared-room');
  const result = mod.captureReadinessMiss(roomDir, FIXTURE_2_FRAMEWORK, fixture2Probe, {});
  assert.deepStrictEqual(
    result,
    { captured: false, reason: 'not_a_miss' },
    'score:3 must never be captured, using the SAME > 2 threshold the incumbent readiness_score arm already uses'
  );
});

// ---------------------------------------------------------------------------
// Fixture 3: Theo REFUSAL shape, coverage.total:149 (the layer has data;
// this name is just not in it). score/inputs/evidence/framework are ABSENT
// per orchestration-readiness.ts:437-450 -- an omitted key, never a zeroed
// one, because score:0 would be a CLAIM about a Framework that does not
// exist.
// ---------------------------------------------------------------------------
const FIXTURE_3_FRAMEWORK = 'Test339 Fixture3 Nonexistent Framework';
const FIXTURE_3_DETAIL = 'TEST339-SECRET-DETAIL-fixture3-nothing-carries-this-spelling-try-another';
const fixture3Probe = Object.freeze({
  coverage: Object.freeze({ matched: 0, total: 149, status: 'empty' }),
  refusal: Object.freeze({ code: 'FRAMEWORK_NOT_FOUND', detail: FIXTURE_3_DETAIL }),
  diagnostics: Object.freeze({ tool: 'orchestration_readiness' }),
});

test('Fixture 3: Theo REFUSAL shape with total:149 (real layer, unknown name) captures, provenance carries the CODE never the detail', () => {
  const mod = freshEnrichmentQueue();
  const roomDir = path.join(TMP_ROOT, 'shared-room');
  // Observation, not a private-helper requirement (339-CONTEXT.md action
  // spec): Theo's honest-empty payloads carry `refusal`, never `error`, so a
  // capture gate keyed on "is this an error-shaped result" must not reject
  // them. Confirmed at the fixture level: this payload never carries an
  // `error` key at all.
  assert.ok(!('error' in fixture3Probe), 'fixture 3 must carry refusal, never error, matching Theo\'s honest-empty contract');
  const result = mod.captureReadinessMiss(roomDir, FIXTURE_3_FRAMEWORK, fixture3Probe, {});
  assert.strictEqual(
    result.queued,
    true,
    'total:149 (matched:0, total>0) is a real signal from a non-empty layer and must capture once 339-05 lands'
  );
  const entry = findEntry(roomDir, mod, FIXTURE_3_FRAMEWORK);
  assert.ok(entry, 'the captured entry must be readable back from the written queue file');
  assert.ok(
    typeof entry.probe_provenance === 'string' && entry.probe_provenance.indexOf('FRAMEWORK_NOT_FOUND') !== -1,
    'probe_provenance must carry the closed-vocabulary refusal CODE'
  );
  assert.ok(
    entry.probe_provenance.indexOf(FIXTURE_3_DETAIL) === -1,
    'probe_provenance must never carry the refusal DETAIL string (Canon Part 8)'
  );
});

// ---------------------------------------------------------------------------
// Fixture 4: Theo REFUSAL shape, coverage.total:0 -- the layer itself is
// empty. This is the two-zeros distinction and the single most important
// assertion in this file: {matched:0,total:0} must NOT be treated the same
// as fixture 3's {matched:0,total:149}.
// ---------------------------------------------------------------------------
const FIXTURE_4_FRAMEWORK = 'Test339 Fixture4 Empty Layer Framework';
const FIXTURE_4_DETAIL = 'TEST339-SECRET-DETAIL-fixture4-the-layer-itself-carries-nothing';
const fixture4Probe = Object.freeze({
  coverage: Object.freeze({ matched: 0, total: 0, status: 'empty' }),
  refusal: Object.freeze({ code: 'FRAMEWORK_NOT_FOUND', detail: FIXTURE_4_DETAIL }),
  diagnostics: Object.freeze({ tool: 'orchestration_readiness' }),
});

test('Fixture 4: Theo REFUSAL shape with total:0 (the layer is empty) does NOT capture, reason is exactly layer_empty', () => {
  const mod = freshEnrichmentQueue();
  const roomDir = path.join(TMP_ROOT, 'shared-room');
  assert.ok(!('error' in fixture4Probe), 'fixture 4 must carry refusal, never error, matching Theo\'s honest-empty contract');
  const result = mod.captureReadinessMiss(roomDir, FIXTURE_4_FRAMEWORK, fixture4Probe, {});
  assert.strictEqual(result.captured, false, 'total:0 means the layer itself is empty; capturing it would be noise, not signal');
  assert.strictEqual(
    result.reason,
    'layer_empty',
    'the reason must be exactly layer_empty, distinct from fixture 3\'s captured:true on total:149 -- ' +
      'proving the two zeros are different answers rather than one collapsed reading'
  );
});

// ---------------------------------------------------------------------------
// Fixture 5: incumbent discover_structure-shaped refusal. Must still capture
// unchanged -- this seam is ADDITIVE, never a rewrite of the incumbent path.
// ---------------------------------------------------------------------------
const FIXTURE_5_FRAMEWORK = 'Test339 Fixture5 Incumbent Discover Structure';
const fixture5Probe = Object.freeze({
  grounded: false,
  anchor: null,
  note: 'could not ground this framework',
});

test('Fixture 5: incumbent {grounded:false} shape still captures unchanged, provenance still starts discover_structure@', () => {
  const mod = freshEnrichmentQueue();
  const roomDir = path.join(TMP_ROOT, 'shared-room');
  const result = mod.captureReadinessMiss(roomDir, FIXTURE_5_FRAMEWORK, fixture5Probe, {});
  assert.strictEqual(result.queued, true, 'the incumbent grounded:false shape must still capture, unchanged by this phase');
  const entry = findEntry(roomDir, mod, FIXTURE_5_FRAMEWORK);
  assert.ok(entry, 'the captured entry must be readable back from the written queue file');
  assert.ok(
    typeof entry.probe_provenance === 'string' && entry.probe_provenance.indexOf('discover_structure@') === 0,
    'probe_provenance must still start with discover_structure@, unchanged by this phase'
  );
});

// ---------------------------------------------------------------------------
// Fixture 6: incumbent orchestration_readiness-shaped score. Must still
// capture unchanged.
// ---------------------------------------------------------------------------
const FIXTURE_6_FRAMEWORK = 'Test339 Fixture6 Incumbent Orchestration Readiness';
const fixture6Probe = Object.freeze({ readiness_score: 1 });

test('Fixture 6: incumbent {readiness_score:1} shape still captures unchanged, provenance still starts orchestration_readiness@', () => {
  const mod = freshEnrichmentQueue();
  const roomDir = path.join(TMP_ROOT, 'shared-room');
  const result = mod.captureReadinessMiss(roomDir, FIXTURE_6_FRAMEWORK, fixture6Probe, {});
  assert.strictEqual(result.queued, true, 'the incumbent readiness_score shape must still capture, unchanged by this phase');
  const entry = findEntry(roomDir, mod, FIXTURE_6_FRAMEWORK);
  assert.ok(entry, 'the captured entry must be readable back from the written queue file');
  assert.ok(
    typeof entry.probe_provenance === 'string' && entry.probe_provenance.indexOf('orchestration_readiness@') === 0,
    'probe_provenance must still start with orchestration_readiness@, unchanged by this phase'
  );
});

// ---------------------------------------------------------------------------
// Canon Part 8 assertion: read back the ENTIRE written queue file (every
// fixture's entry, in one file, one roomDir) and assert neither refusal
// DETAIL string appears anywhere in its bytes. This holds regardless of
// which fixtures actually captured -- a string that was never written can
// never appear, and once 339-05 lands and fixture 3 genuinely captures,
// this arm is what proves the detail string still never reaches disk.
// ---------------------------------------------------------------------------
test('Part 8: no fixture refusal.detail string is ever present anywhere in the written queue file', () => {
  const mod = freshEnrichmentQueue();
  const roomDir = path.join(TMP_ROOT, 'shared-room');
  const raw = readQueueRaw(roomDir, mod);
  assert.ok(typeof raw === 'string' && raw.length > 0, 'the shared queue file must exist by this point (fixtures 5/6 write to it unconditionally)');
  assert.ok(raw.indexOf(FIXTURE_3_DETAIL) === -1, 'fixture 3\'s refusal.detail string must never appear in the queue file bytes');
  assert.ok(raw.indexOf(FIXTURE_4_DETAIL) === -1, 'fixture 4\'s refusal.detail string must never appear in the queue file bytes (it never captures at all)');
});

// No em-dashes.
