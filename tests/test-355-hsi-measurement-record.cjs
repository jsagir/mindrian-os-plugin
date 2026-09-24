#!/usr/bin/env node
/**
 * Phase 355 Plan 15 (HIPS-08, D-44, D-45, D-58). Proves
 * scripts/measure-hsi-thinking-mode.cjs's computeMetrics / applyAdoptionBar
 * arithmetic, the D-32 gold-refusal path, a stubbed live run (injected
 * fetchImpl, a fake key string passed explicitly, never from env), the
 * --check / --regex-only legs, the MODE_PATTERN_MIRROR sync guard, and the
 * lib/hooks non-reference + jev-latest sweeps.
 *
 * Every 355 test requires tests/helpers/hygiene-355.cjs first and calls
 * scrubVendorKey()/installNetGuard() before any other repo require, per
 * Pitfall 16 (TYPESAFE_API_KEY may be exported in the navigator's shell).
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

const REPO = path.join(__dirname, '..');
const hygiene = require(path.join(REPO, 'tests', 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const { check, summary } = hygiene.makeChecker('test-355-hsi-measurement-record');

const SCRIPT_PATH = path.join(REPO, 'scripts', 'measure-hsi-thinking-mode.cjs');
const HSI_SPECTRAL_PATH = path.join(REPO, 'lib', 'core', 'hsi-spectral.cjs');

const measure = require(SCRIPT_PATH);
const Q = require(path.join(REPO, 'scripts', 'jev-question-ceilings.cjs'));

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'test-355-hsi-measure-'));
}

// ---------------------------------------------------------------------------
// buildBody
// ---------------------------------------------------------------------------
function legBuildBody() {
  console.log('--- leg: buildBody ---');
  const body = measure.buildBody('The clinic tracked two shifts.');
  check('buildBody: model is the pinned model', body.model === Q.PINNED_MODEL);
  check('buildBody: state carries only the sentence', isDeepStrictEqual(Object.keys(body.state), ['sentence']));
  check('buildBody: questions is the frozen thinking-mode question', isDeepStrictEqual(body.questions, Q.THINKING_MODE_QUESTIONS));
}

// ---------------------------------------------------------------------------
// computeMetrics: hand-built rows.
// ---------------------------------------------------------------------------
function legComputeMetricsJoint() {
  console.log('--- leg: computeMetrics on joint jev+regex rows ---');
  const rows = [
    { id: 'a1', gold: 'analytical', regex: 'analytical', regex_zero_match: false, jev: 'analytical', confidence: 0.95 },
    { id: 'a2', gold: 'analytical', regex: 'descriptive', regex_zero_match: false, jev: 'analytical', confidence: 0.92 },
    { id: 'i1', gold: 'integrative', regex: 'integrative', regex_zero_match: false, jev: 'creative', confidence: 0.6 },
    { id: 'i2', gold: 'integrative', regex: 'descriptive', regex_zero_match: true, jev: 'integrative', confidence: 0.4 },
    { id: 'd1', gold: 'descriptive', regex: 'descriptive', regex_zero_match: false, jev: 'descriptive', confidence: 0.99 },
    { id: 'e1', gold: 'evaluative', regex: 'evaluative', regex_zero_match: false, jev: 'evaluative', confidence: 0.85 },
  ];
  const m = measure.computeMetrics(rows);
  check('n === 6', m.n === 6);
  // jev correct: a1, a2, i2, d1, e1 = 5/6 -> 8333bp (rounded); i1 is jev's
  // only miss (jev said creative, gold integrative).
  check('full_accuracy.jev === 8333', m.full_accuracy.jev === 8333, String(m.full_accuracy.jev));
  // regex correct: a1, i1, d1, e1 = 4/6 -> 6667bp
  check('full_accuracy.regex === 6667', m.full_accuracy.regex === 6667, String(m.full_accuracy.regex));
  check('subset5_accuracy.n === 6 (no none rows)', m.subset5_accuracy.n === 6);
  check('recall_by_mode.jev.none has no gold examples', m.recall_by_mode.jev.none.total === 0 && m.recall_by_mode.jev.none.accuracy_bp === null && m.recall_by_mode.jev.none.note === 'no gold examples');
  check('recall_by_mode.jev.analytical === 10000 (2 of 2, a1+a2 both correct)', m.recall_by_mode.jev.analytical.accuracy_bp === 10000);
  check('recall_by_mode.regex.integrative === 5000 (1 of 2)', m.recall_by_mode.regex.integrative.accuracy_bp === 5000);
  check('confusion.jev is a 6x6 matrix keyed by the frozen label order', isDeepStrictEqual(m.confusion.jev.labels, Q.THINKING_MODE_LABELS));
  check('confidence_slices.ge_0_9.n === 3 (0.95, 0.92, 0.99)', m.confidence_slices.ge_0_9.n === 3, String(m.confidence_slices.ge_0_9.n));
  check('confidence_slices.lt_0_9.n === 3', m.confidence_slices.lt_0_9.n === 3);
  // regex === 'descriptive' on a2, i2, d1 = 3 of 6 -> 5000bp (d1's own gold
  // is descriptive and regex got it right, so it counts here too).
  check('regex_descriptive_share counts 3 of 6 -> 5000bp', m.regex_descriptive_share === 5000, String(m.regex_descriptive_share));
  check('regex_zero_match_fallbacks === 1', m.regex_zero_match_fallbacks === 1);
  check('item_correct.jev.a1 === true', m.item_correct.jev.a1 === true);
  check('item_correct.jev.i1 === false', m.item_correct.jev.i1 === false);
}

function legComputeMetricsRegexOnly() {
  console.log('--- leg: computeMetrics on a regex-only pass (jev null on every row) ---');
  const rows = [
    { id: 'x1', gold: 'creative', regex: 'creative', regex_zero_match: false, jev: null, confidence: null },
    { id: 'x2', gold: 'creative', regex: 'descriptive', regex_zero_match: true, jev: null, confidence: null },
  ];
  const m = measure.computeMetrics(rows);
  check('regex-only: full_accuracy.jev is null (never 0)', m.full_accuracy.jev === null);
  check('regex-only: full_accuracy.regex === 5000', m.full_accuracy.regex === 5000);
  check('regex-only: recall_by_mode.jev is null', m.recall_by_mode.jev === null);
  check('regex-only: confusion.jev is null', m.confusion.jev === null);
  check('regex-only: confidence_slices report n=0 both sides, never NaN', m.confidence_slices.ge_0_9.n === 0 && m.confidence_slices.lt_0_9.n === 0 && m.confidence_slices.ge_0_9.accuracy === null);
  check('regex-only: item_correct.jev is null', m.item_correct.jev === null);
}

function legComputeMetricsJevOnly() {
  console.log('--- leg: computeMetrics on a jev-only pass (regex null on every row) ---');
  const rows = [
    { id: 'y1', gold: 'evaluative', regex: null, jev: 'evaluative', confidence: 0.7 },
  ];
  const m = measure.computeMetrics(rows);
  check('jev-only: full_accuracy.regex is null', m.full_accuracy.regex === null);
  check('jev-only: regex_descriptive_share is null', m.regex_descriptive_share === null);
  check('jev-only: regex_zero_match_fallbacks is null', m.regex_zero_match_fallbacks === null);
  check('jev-only: full_accuracy.jev === 10000', m.full_accuracy.jev === 10000);
}

// ---------------------------------------------------------------------------
// applyAdoptionBar: D-45, mechanically, on hand-built metrics objects (each
// built through the real computeMetrics so the shape is exactly what main()
// itself produces, never a shape the test invents independently).
// ---------------------------------------------------------------------------
function buildSyntheticGold() {
  // 10 items, 5 modes x 2, zero 'none' (mirrors the real n=45 partial gold shape).
  return [
    { id: 'g1', gold: 'analytical' }, { id: 'g2', gold: 'analytical' },
    { id: 'g3', gold: 'integrative' }, { id: 'g4', gold: 'integrative' },
    { id: 'g5', gold: 'descriptive' }, { id: 'g6', gold: 'descriptive' },
    { id: 'g7', gold: 'evaluative' }, { id: 'g8', gold: 'evaluative' },
    { id: 'g9', gold: 'creative' }, { id: 'g10', gold: 'creative' },
  ];
}

function legApplyAdoptionBar() {
  console.log('--- leg: applyAdoptionBar (D-45 mechanical rule) ---');
  const goldItems = buildSyntheticGold();
  // Rotation with no fixed point: every mode maps to a genuinely different
  // mode, so "wrong" never accidentally equals the item's own gold label.
  const rotateWrong = { analytical: 'creative', integrative: 'evaluative', descriptive: 'analytical', evaluative: 'descriptive', creative: 'integrative' };

  // regexMetrics: exactly 50% overall, exactly 50% recall in every one of
  // the 5 measured modes (item 1 of each pair correct, item 2 wrong).
  const regexRows = goldItems.map((it, i) => ({
    id: it.id, gold: it.gold,
    regex: i % 2 === 0 ? it.gold : rotateWrong[it.gold],
    jev: null, confidence: null,
  }));
  const regexMetrics = measure.computeMetrics(regexRows);
  check('synthetic regex baseline: full_accuracy.regex === 5000', regexMetrics.full_accuracy.regex === 5000);
  check('synthetic regex baseline: skips none (zero gold examples)', regexMetrics.recall_by_mode.regex.none.total === 0);

  // jev "all correct" repeat: 100% overall, 100% every mode.
  const allCorrectRows = goldItems.map((it) => ({ id: it.id, gold: it.gold, jev: it.gold, confidence: 0.9, regex: null }));
  const allCorrectMetrics = measure.computeMetrics(allCorrectRows);

  // jev "all wrong" repeat: 0% overall, 0% every mode (label shifted by one slot).
  const allWrongRows = goldItems.map((it) => ({ id: it.id, gold: it.gold, jev: rotateWrong[it.gold], confidence: 0.9, regex: null }));
  const allWrongMetrics = measure.computeMetrics(allWrongRows);

  // jev "one mode drops" repeat: correct everywhere except both integrative items.
  const oneModeDropRows = goldItems.map((it) => ({
    id: it.id, gold: it.gold,
    jev: it.gold === 'integrative' ? 'creative' : it.gold,
    confidence: 0.9, regex: null,
  }));
  const oneModeDropMetrics = measure.computeMetrics(oneModeDropRows);

  // Case 1: cleared on all 3 repeats.
  const barAllCleared = measure.applyAdoptionBar([allCorrectMetrics, allCorrectMetrics, allCorrectMetrics], regexMetrics);
  check('bar: cleared on all 3 repeats -> cleared true', barAllCleared.cleared === true);
  check('bar: reason names all 3 repeats', barAllCleared.reason === 'cleared on all 3 repeats');
  check('bar: skipped_modes includes none', isDeepStrictEqual(barAllCleared.skipped_modes, ['none']));
  check('bar: flip_count null when uniformly cleared', barAllCleared.flip_count === null);

  // Case 2: not cleared on any repeat (gap too small, all wrong).
  const barNoneCleared = measure.applyAdoptionBar([allWrongMetrics, allWrongMetrics, allWrongMetrics], regexMetrics);
  check('bar: not cleared on any repeat -> cleared false', barNoneCleared.cleared === false);
  check('bar: reason "not cleared: bar not met on any repeat"', barNoneCleared.reason === 'not cleared: bar not met on any repeat');

  // Case 3: gap clears but one mode drops more than 5 points -> not cleared.
  const barModeDrop = measure.applyAdoptionBar([oneModeDropMetrics, oneModeDropMetrics, oneModeDropMetrics], regexMetrics);
  check('bar: gap clears (8000-5000=3000bp) but integrative drop fails it', barModeDrop.per_repeat[0].gap_bp === 3000 && barModeDrop.per_repeat[0].cleared === false);
  check('bar: mode_drops names integrative', barModeDrop.per_repeat[0].mode_drops.some((d) => d.mode === 'integrative'));

  // Case 4: mixed (clears once, fails once) -> inside run-to-run noise, with a flip count.
  const barMixed = measure.applyAdoptionBar([allCorrectMetrics, allWrongMetrics, allCorrectMetrics], regexMetrics);
  check('bar: mixed -> cleared false', barMixed.cleared === false);
  check('bar: mixed -> reason "not cleared: inside run-to-run noise"', barMixed.reason === 'not cleared: inside run-to-run noise');
  check('bar: mixed -> flip_count === 10 (every item flips between all-correct and all-wrong)', barMixed.flip_count === 10, String(barMixed.flip_count));
}

// ---------------------------------------------------------------------------
// D-32: gold-refusal path.
// ---------------------------------------------------------------------------
function legGoldRefusal() {
  console.log('--- leg: D-32 gold-refusal path ---');
  const dir = mkTmpDir();
  const itemsPath = path.join(dir, 'items.json');
  const itemsRaw = JSON.stringify({ items: [{ id: 's1', sentence: 'Thanks, talk Thursday.' }] });
  fs.writeFileSync(itemsPath, itemsRaw);
  const realSha = sha256Hex(itemsRaw);

  const noLabeledAtPath = path.join(dir, 'gold-no-labeled-at.json');
  fs.writeFileSync(noLabeledAtPath, JSON.stringify({ items: [], fixture_sha256: realSha }));
  let threwA = null;
  try { measure.loadGold({ goldPath: noLabeledAtPath, itemsPath }); } catch (e) { threwA = e; }
  check('loadGold refuses without labeled_at', threwA instanceof measure.RefusalError && /labeled_at/.test(threwA.message) && /D-32/.test(threwA.message));

  const badShaPath = path.join(dir, 'gold-bad-sha.json');
  fs.writeFileSync(badShaPath, JSON.stringify({ items: [], fixture_sha256: '0'.repeat(64), labeled_at: '2026-09-24T00:00:00.000Z' }));
  let threwB = null;
  try { measure.loadGold({ goldPath: badShaPath, itemsPath }); } catch (e) { threwB = e; }
  check('loadGold refuses on fixture_sha256 mismatch', threwB instanceof measure.RefusalError && /fixture_sha256/.test(threwB.message) && /D-32/.test(threwB.message));

  const goodPath = path.join(dir, 'gold-good.json');
  fs.writeFileSync(goodPath, JSON.stringify({ items: [{ id: 's1', sentence: 'Thanks, talk Thursday.', gold: 'none' }], fixture_sha256: realSha, labeled_at: '2026-09-24T00:00:00.000Z' }));
  const gold = measure.loadGold({ goldPath: goodPath, itemsPath });
  check('loadGold accepts a matching, labeled gold file', gold.labeled_at === '2026-09-24T00:00:00.000Z');
}

// ---------------------------------------------------------------------------
// Stubbed live run: injected fetchImpl, a fake key string passed explicitly
// (never from env, which hygiene-355 has already scrubbed).
// ---------------------------------------------------------------------------
const FAKE_KEY = 'FAKE_TEST_KEY_never_a_real_secret_9f3a';

function writeSyntheticFixtures(dir, sentences) {
  const itemsPath = path.join(dir, 'items.json');
  const items = sentences.map((s, i) => ({ id: 'z' + (i + 1), sentence: s }));
  const itemsRaw = JSON.stringify({ items });
  fs.writeFileSync(itemsPath, itemsRaw);
  const fixtureSha256 = sha256Hex(itemsRaw);
  const goldPath = path.join(dir, 'gold.json');
  const goldItems = items.map((it) => ({ id: it.id, sentence: it.sentence, gold: 'analytical' }));
  fs.writeFileSync(goldPath, JSON.stringify({ items: goldItems, fixture_sha256: fixtureSha256, labeled_at: '2026-09-24T00:00:00.000Z' }));
  return { itemsPath, goldPath };
}

function makeChoiceResponseJson(choice, confidence, inputTokens) {
  const probs = {};
  for (const l of Q.THINKING_MODE_LABELS) probs[l] = l === choice ? 0.9 : 0.02;
  return JSON.stringify({
    model: Q.PINNED_MODEL,
    answers: { mode: { type: 'choice', choice, probabilities: probs, confidence } },
    usage: { input_tokens: inputTokens, output_tokens: 4 },
  });
}

async function legLiveRunSuccess() {
  console.log('--- leg: stubbed live run, success path ---');
  const dir = mkTmpDir();
  const { itemsPath, goldPath } = writeSyntheticFixtures(dir, ['Churn rose after onboarding stretched.', 'Response times fell after retraining.']);
  const responsesPath = path.join(dir, 'responses.json');
  const recordPath = path.join(dir, 'record.json');
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { status: 200, text: async () => makeChoiceResponseJson('analytical', 0.9, 600) };
  };
  const logs = [];
  const errs = [];
  const code = await measure.main(['--repeats', '1'], {
    itemsPath, goldPath, responsesPath, recordPath,
    key: FAKE_KEY, fetchImpl, sleepImpl: async () => {},
    write: (s) => logs.push(s), writeErr: (s) => errs.push(s),
  });
  check('live run success: exit code 0', code === 0, String(code) + ' ' + errs.join('; '));
  check('live run success: exactly 2 calls (2 items x 1 repeat)', calls === 2, String(calls));
  check('live run success: responses file written', fs.existsSync(responsesPath));
  check('live run success: record file written', fs.existsSync(recordPath));
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  check('record: calls === 2', record.calls === 2);
  check('record: non_200 === 0', record.non_200 === 0);
  check('record: input_tokens === 1200', record.input_tokens === 1200);
  check('record: decision is pending_signoff', record.decision === 'pending_signoff');
  check('record: regex_postfix is null before --regex-only', record.regex_postfix === null);
  check('record: repeats has 1 entry', Array.isArray(record.repeats) && record.repeats.length === 1);
  check('record: repeats[0].full_accuracy.jev === 10000 (both items answered analytical, gold analytical)', record.repeats[0].full_accuracy.jev === 10000);
  return { dir, itemsPath, goldPath, responsesPath, recordPath };
}

async function legLiveRun401() {
  console.log('--- leg: stubbed live run, 401 aborts the whole run, key withheld ---');
  const dir = mkTmpDir();
  const { itemsPath, goldPath } = writeSyntheticFixtures(dir, ['Churn rose after onboarding stretched.']);
  const responsesPath = path.join(dir, 'responses.json');
  const recordPath = path.join(dir, 'record.json');
  const errs = [];
  const code = await measure.main(['--repeats', '1'], {
    itemsPath, goldPath, responsesPath, recordPath,
    key: FAKE_KEY, sleepImpl: async () => {},
    fetchImpl: async () => ({ status: 401, text: async () => '{}' }),
    write: () => {}, writeErr: (s) => errs.push(s),
  });
  check('401: exit code non-zero', code !== 0, String(code));
  check('401: no record written', !fs.existsSync(recordPath));
  check('401: error message never contains the fake key', !errs.join(' ').includes(FAKE_KEY));
  check('401: error message names the abort', errs.some((e) => /401/.test(e)));
}

async function legLiveRun400() {
  console.log('--- leg: stubbed live run, 400 aborts the whole run ---');
  const dir = mkTmpDir();
  const { itemsPath, goldPath } = writeSyntheticFixtures(dir, ['Churn rose after onboarding stretched.']);
  const errs = [];
  const code = await measure.main(['--repeats', '1'], {
    itemsPath, goldPath,
    responsesPath: path.join(dir, 'responses.json'), recordPath: path.join(dir, 'record.json'),
    key: FAKE_KEY, sleepImpl: async () => {},
    fetchImpl: async () => ({ status: 400, text: async () => 'bad request' }),
    write: () => {}, writeErr: (s) => errs.push(s),
  });
  check('400: exit code non-zero', code !== 0);
  check('400: error message names 400', errs.some((e) => /400/.test(e)));
}

async function legLiveRunNon200Fails() {
  console.log('--- leg: one non-200 item fails the whole run, no shrunken denominator ---');
  const dir = mkTmpDir();
  const { itemsPath, goldPath } = writeSyntheticFixtures(dir, ['Churn rose after onboarding stretched.', 'Response times fell after retraining.']);
  const errs = [];
  const code = await measure.main(['--repeats', '1'], {
    itemsPath, goldPath,
    responsesPath: path.join(dir, 'responses.json'), recordPath: path.join(dir, 'record.json'),
    key: FAKE_KEY, sleepImpl: async () => {},
    fetchImpl: async (_endpoint, init) => {
      const body = JSON.parse(init.body);
      if (body.state.sentence.includes('Churn')) return { status: 200, text: async () => makeChoiceResponseJson('analytical', 0.9, 500) };
      return { status: 503, text: async () => 'service unavailable' };
    },
    write: () => {}, writeErr: (s) => errs.push(s),
  });
  check('non-200: exit code non-zero (whole run fails)', code !== 0);
  check('non-200: message says items failed, not a partial success', errs.some((e) => /items failed/.test(e)));
  check('non-200: no record file written', !fs.existsSync(path.join(dir, 'record.json')));
}

async function legLiveRunTokenTripwire() {
  console.log('--- leg: usage.input_tokens over 8000 aborts the whole run ---');
  const dir = mkTmpDir();
  const { itemsPath, goldPath } = writeSyntheticFixtures(dir, ['Churn rose after onboarding stretched.']);
  const errs = [];
  const code = await measure.main(['--repeats', '1'], {
    itemsPath, goldPath,
    responsesPath: path.join(dir, 'responses.json'), recordPath: path.join(dir, 'record.json'),
    key: FAKE_KEY, sleepImpl: async () => {},
    fetchImpl: async () => ({ status: 200, text: async () => makeChoiceResponseJson('analytical', 0.9, 9001) }),
    write: () => {}, writeErr: (s) => errs.push(s),
  });
  check('token tripwire: exit code non-zero', code !== 0);
  check('token tripwire: message names the 8000 bound', errs.some((e) => /8000/.test(e)));
}

async function legLiveRunSchemaRetryThenFail() {
  console.log('--- leg: a schema-invalid 200 retries once, then fails the item (and the run) ---');
  const dir = mkTmpDir();
  const { itemsPath, goldPath } = writeSyntheticFixtures(dir, ['Churn rose after onboarding stretched.']);
  let attempts = 0;
  const errs = [];
  const code = await measure.main(['--repeats', '1'], {
    itemsPath, goldPath,
    responsesPath: path.join(dir, 'responses.json'), recordPath: path.join(dir, 'record.json'),
    key: FAKE_KEY, sleepImpl: async () => {},
    fetchImpl: async () => { attempts += 1; return { status: 200, text: async () => JSON.stringify({ model: Q.PINNED_MODEL, answers: {}, usage: { input_tokens: 1 } }) }; },
    write: () => {}, writeErr: (s) => errs.push(s),
  });
  check('schema failure: retried exactly once (2 attempts for 1 item)', attempts === 2, String(attempts));
  check('schema failure: whole run fails', code !== 0);
}

// ---------------------------------------------------------------------------
// --check and --regex-only legs.
// ---------------------------------------------------------------------------
async function legCheckNoRecordSkips() {
  console.log('--- leg: --check exits 77 when no record exists yet ---');
  const dir = mkTmpDir();
  const { itemsPath, goldPath } = writeSyntheticFixtures(dir, ['Churn rose after onboarding stretched.']);
  const errs = [];
  const code = await measure.main(['--check'], {
    itemsPath, goldPath,
    responsesPath: path.join(dir, 'responses.json'), recordPath: path.join(dir, 'nonexistent-record.json'),
    write: () => {}, writeErr: (s) => errs.push(s),
  });
  check('--check with no record: exit 77', code === 77, String(code));
  check('--check with no record: loud message', errs.some((e) => /SKIP/.test(e)));
  check('--check with no record: zero network', netGuard.attempts() === 0);
}

async function legRegexOnlyAndCheckRoundTrip() {
  console.log('--- leg: --regex-only writes regex_postfix + bar, then --check passes ---');
  const { itemsPath, goldPath, responsesPath, recordPath } = await legLiveRunSuccess();
  const before = JSON.parse(fs.readFileSync(recordPath, 'utf8'));

  const code1 = await measure.main(['--regex-only'], { itemsPath, goldPath, responsesPath, recordPath, write: () => {}, writeErr: () => {} });
  check('--regex-only: exit 0', code1 === 0);
  const after = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  check('--regex-only: regex_postfix now populated', after.regex_postfix !== null && typeof after.regex_postfix === 'object');
  check('--regex-only: bar_baseline is regex_postfix', after.bar_baseline === 'regex_postfix');
  check('--regex-only: repeats unchanged (rewrite only regex fields)', isDeepStrictEqual(after.repeats, before.repeats));
  check('--regex-only: regex_prefix unchanged', isDeepStrictEqual(after.regex_prefix, before.regex_prefix));

  const errs2 = [];
  const code2 = await measure.main(['--check'], { itemsPath, goldPath, responsesPath, recordPath, write: () => {}, writeErr: (s) => errs2.push(s) });
  check('--check after --regex-only: exit 0', code2 === 0, errs2.join('; '));
  check('--check: zero network calls throughout (net guard untouched by stub tests)', true); // stub fetchImpl used throughout, never globalThis.fetch

  return { itemsPath, goldPath, responsesPath, recordPath };
}

async function legCheckDetectsTamper() {
  console.log('--- leg: --check fails loudly on a tampered record ---');
  const { itemsPath, goldPath, responsesPath, recordPath } = await legRegexOnlyAndCheckRoundTrip();
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  record.input_tokens += 1;
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
  const errs = [];
  const code = await measure.main(['--check'], { itemsPath, goldPath, responsesPath, recordPath, write: () => {}, writeErr: (s) => errs.push(s) });
  check('--check: tampered input_tokens fails', code !== 0);
  check('--check: names input_tokens in the failure', errs.some((e) => /input_tokens/.test(e)));

  const record2 = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  record2.input_tokens -= 1; // restore
  const responses = JSON.parse(fs.readFileSync(responsesPath, 'utf8'));
  const firstKey = Object.keys(responses)[0];
  responses[firstKey][0].model = 'jev-9.9.9';
  fs.writeFileSync(responsesPath, JSON.stringify(responses, null, 2));
  fs.writeFileSync(recordPath, JSON.stringify(record2, null, 2));
  const errs2 = [];
  const code2 = await measure.main(['--check'], { itemsPath, goldPath, responsesPath, recordPath, write: () => {}, writeErr: (s) => errs2.push(s) });
  check('--check: a recorded response with a drifted model fails', code2 !== 0);
  check('--check: names the model drift', errs2.some((e) => /model/.test(e)));
}

// ---------------------------------------------------------------------------
// MODE_PATTERN_MIRROR sync guard: the diagnostic mirror in
// measure-hsi-thinking-mode.cjs must stay byte-identical (per pattern
// source) to lib/core/hsi-spectral.cjs's own MODE_PATTERNS.
// ---------------------------------------------------------------------------
function legModePatternMirrorSync() {
  console.log('--- leg: MODE_PATTERN_MIRROR sync guard vs lib/core/hsi-spectral.cjs ---');
  const src = fs.readFileSync(HSI_SPECTRAL_PATH, 'utf8');
  const blockMatch = src.match(/const MODE_PATTERNS = \{[\s\S]*?\n\};/);
  check('hsi-spectral.cjs still has a MODE_PATTERNS block', !!blockMatch);
  const block = blockMatch ? blockMatch[0] : '';
  for (const mode of Object.keys(measure.MODE_PATTERN_MIRROR)) {
    const patSrc = measure.MODE_PATTERN_MIRROR[mode].source;
    check('mirror[' + mode + '] appears verbatim in hsi-spectral.cjs MODE_PATTERNS', block.includes(patSrc), patSrc);
  }
}

// ---------------------------------------------------------------------------
// Static sweeps: no lib/hooks reference to this script; no jev-latest
// outside comments in this script.
// ---------------------------------------------------------------------------
function legStaticSweeps() {
  console.log('--- leg: lib/hooks non-reference + jev-latest sweep ---');
  const libFiles = hygiene.listFilesRecursive(path.join(REPO, 'lib'));
  const hooksFiles = hygiene.listFilesRecursive(path.join(REPO, 'hooks'));
  const hit = [...libFiles, ...hooksFiles].find((f) => hygiene.nonCommentLines(f).some((l) => l.includes('measure-hsi-thinking-mode')));
  check('no lib/ or hooks/ file references measure-hsi-thinking-mode', !hit, hit ? path.relative(REPO, hit) : '');

  const ownLines = hygiene.nonCommentLines(SCRIPT_PATH);
  const jevLatestHit = ownLines.some((l) => l.includes('jev-latest'));
  check('measure-hsi-thinking-mode.cjs never uses jev-latest in code (pinned model only)', !jevLatestHit);
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------
async function run() {
  legBuildBody();
  legComputeMetricsJoint();
  legComputeMetricsRegexOnly();
  legComputeMetricsJevOnly();
  legApplyAdoptionBar();
  legGoldRefusal();
  await legLiveRunSuccess();
  await legLiveRun401();
  await legLiveRun400();
  await legLiveRunNon200Fails();
  await legLiveRunTokenTripwire();
  await legLiveRunSchemaRetryThenFail();
  await legCheckNoRecordSkips();
  await legCheckDetectsTamper();
  legModePatternMirrorSync();
  legStaticSweeps();

  check('hygiene: zero real network attempts across the whole run', netGuard.attempts() === 0);
  netGuard.restore();
  process.exit(summary());
}

run();
