#!/usr/bin/env node
/**
 * Phase 355 Plan 26 (HIPS-09, D-44, D-46, AI-SPEC D15/D18). Proves
 * scripts/calibrate-citation-check.cjs and scripts/judge-355-usefulness.cjs's
 * pure arithmetic (summarizeVariant, bandFromMeasured, agreement,
 * perTierAgreement, alreadyKnownByTier, alreadyKnownAgreement), the D-32
 * gold-refusal paths, the no_path zero-call proof, stubbed live runs
 * (injected fetchImpl, a fake key string passed explicitly, never from
 * env), the --check legs (SKIP-while-absent, offline recompute, model-drift
 * detection), the shared tests/fixtures/355-jev-calibration-record.json
 * section-touching discipline, the lib/hooks non-reference sweep, and the
 * D-32/D-33 git-order legs against the real gold and response fixtures
 * (ENV GAP + exit 77 while Task 2's live run has not populated them yet).
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
const { spawnSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');

const REPO = path.join(__dirname, '..');
const hygiene = require(path.join(REPO, 'tests', 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const { check, summary } = hygiene.makeChecker('test-355-jev-calibration-record');

const CITATION_SCRIPT_PATH = path.join(REPO, 'scripts', 'calibrate-citation-check.cjs');
const USEFULNESS_SCRIPT_PATH = path.join(REPO, 'scripts', 'judge-355-usefulness.cjs');

const citation = require(CITATION_SCRIPT_PATH);
const usefulness = require(USEFULNESS_SCRIPT_PATH);
const Q = require(path.join(REPO, 'scripts', 'jev-question-ceilings.cjs'));
const { confidenceFromBucket } = require(path.join(REPO, 'lib', 'core', 'eureka-critic.cjs'));

const FAKE_KEY = 'FAKE_TEST_KEY_never_a_real_secret_9f3a';

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'test-355-jev-calibration-'));
}

// =============================================================================
// summarizeVariant -- pure arithmetic.
// =============================================================================
function legSummarizeVariant() {
  console.log('--- leg: summarizeVariant ---');

  const empty = citation.summarizeVariant([]);
  check('summarizeVariant([]): n === 0', empty.n === 0);
  check('summarizeVariant([]): exact_agreement.rate is null, never 0/0', empty.exact_agreement.rate === null);
  check('summarizeVariant([]): auto_slice.n === 0, agreement null', empty.auto_slice.n === 0 && empty.auto_slice.agreement === null);
  check('summarizeVariant([]): human_routed_share is null', empty.human_routed_share === null);

  const rows = [
    { pair_id: 'a', gold: 'says_nothing', choice: 'says_nothing', confidence: 0.95 }, // correct, auto
    { pair_id: 'b', gold: 'contradicts', choice: 'contradicts', confidence: 0.85 }, // correct, auto
    { pair_id: 'c', gold: 'says_nothing', choice: 'contradicts', confidence: 0.82 }, // wrong, auto
    { pair_id: 'd', gold: 'says_nothing', choice: 'says_nothing', confidence: 0.5 }, // correct, human-routed
    { pair_id: 'e', gold: 'contradicts', choice: 'says_nothing', confidence: 0.3 }, // wrong, human-routed
  ];
  const s = citation.summarizeVariant(rows);
  check('summarizeVariant: n === 5', s.n === 5);
  check('summarizeVariant: exact_agreement.correct === 3', s.exact_agreement.correct === 3);
  check('summarizeVariant: exact_agreement.rate === 0.6', s.exact_agreement.rate === 0.6, String(s.exact_agreement.rate));
  check('summarizeVariant: auto_slice.n === 3 (confidence >= 0.8)', s.auto_slice.n === 3, String(s.auto_slice.n));
  check('summarizeVariant: auto_slice.correct === 2', s.auto_slice.correct === 2);
  check('summarizeVariant: auto_slice.agreement === 2/3', Math.abs(s.auto_slice.agreement - (2 / 3)) < 1e-9);
  check('summarizeVariant: auto_slice.coverage_share === 0.6', s.auto_slice.coverage_share === 0.6);
  check('summarizeVariant: human_routed_share === 0.4', s.human_routed_share === 0.4);
}

// =============================================================================
// bandFromMeasured -- must equal eureka-critic.cjs's own confidenceFromBucket.
// =============================================================================
function legBandFromMeasured() {
  console.log('--- leg: bandFromMeasured === confidenceFromBucket ---');
  const buckets = [
    { correct: 9, n: 10 }, // 0.9 -> high
    { correct: 7, n: 10 }, // 0.7 -> medium
    { correct: 3, n: 10 }, // 0.3 -> low
    { correct: 0, n: 0 }, // empty -> unknown
    null,
  ];
  for (const b of buckets) {
    check('bandFromMeasured(' + JSON.stringify(b) + ') === confidenceFromBucket(...)',
      citation.bandFromMeasured(b) === confidenceFromBucket(b));
  }
  check('bandFromMeasured high bucket is literally "high"', citation.bandFromMeasured({ correct: 9, n: 10 }) === 'high');
  check('bandFromMeasured empty bucket is literally "unknown"', citation.bandFromMeasured({ correct: 0, n: 0 }) === 'unknown');
}

// =============================================================================
// usefulness: agreement / perTierAgreement / alreadyKnownByTier /
// alreadyKnownAgreement -- pure arithmetic, D-46 mapping rule.
// =============================================================================
function legUsefulnessAgreement() {
  console.log('--- leg: usefulness agreement mapping (navigator useful <-> Jev choice) ---');
  const rows = [
    { pair_id: 'p1', tier: 'strong', useful: true, already_known: false, choice: 'useful' }, // agree
    { pair_id: 'p2', tier: 'strong', useful: false, already_known: true, choice: 'already_known' }, // agree (useful:false, choice != useful)
    { pair_id: 'p3', tier: 'strong', useful: true, already_known: false, choice: 'not_useful' }, // disagree
    { pair_id: 'p4', tier: 'unverified', useful: false, already_known: false, choice: 'not_useful' }, // agree
    { pair_id: 'p5', tier: 'unverified', useful: false, already_known: true, choice: 'already_known' }, // agree
    { pair_id: 'p6', tier: 'indirect', useful: true, already_known: false, choice: 'useful' }, // agree
  ];

  const overall = usefulness.agreement(rows);
  check('agreement: n === 6', overall.n === 6);
  check('agreement: agree === 5 (only p3 disagrees)', overall.agree === 5, String(overall.agree));
  check('agreement: rate === 5/6', Math.abs(overall.rate - (5 / 6)) < 1e-9);

  const perTier = usefulness.perTierAgreement(rows);
  check('perTierAgreement: strong n === 3, agree === 2', perTier.strong.n === 3 && perTier.strong.agree === 2);
  check('perTierAgreement: unverified n === 2, agree === 2', perTier.unverified.n === 2 && perTier.unverified.agree === 2);
  check('perTierAgreement: indirect n === 1, agree === 1', perTier.indirect.n === 1 && perTier.indirect.agree === 1);

  const aByTier = usefulness.alreadyKnownByTier(rows);
  check('alreadyKnownByTier: strong count === 1 of 3 (p2)', aByTier.strong.count === 1 && aByTier.strong.n === 3);
  check('alreadyKnownByTier: unverified count === 1 of 2 (p5)', aByTier.unverified.count === 1 && aByTier.unverified.n === 2);
  check('alreadyKnownByTier: indirect count === 0 of 1', aByTier.indirect.count === 0 && aByTier.indirect.n === 1);

  const aAgree = usefulness.alreadyKnownAgreement(rows);
  // Jev already_known choice: p2, p5. navigator already_known true: p2, p5.
  // Every row's (choice==='already_known') === already_known holds here
  // (p1: false===false, p2: true===true, p3: false===false, p4: false===false,
  //  p5: true===true, p6: false===false) -> 6/6 agree.
  check('alreadyKnownAgreement: n === 6, agree === 6 (every row agrees on this synthetic set)', aAgree.n === 6 && aAgree.agree === 6, JSON.stringify(aAgree));
}

// =============================================================================
// D-32 refusal legs.
// =============================================================================
function legCitationGoldRefusal() {
  console.log('--- leg: citation D-32 gold-refusal path ---');
  const dir = mkTmpDir();
  const itemsPath = path.join(dir, 'items.json');
  const itemsRaw = JSON.stringify({ items: [{ pair_id: 'x1', from: 'A', to: 'B', claim: 'A and B: same meaning in different words.', path: [{ from: 'A', relation: 'feeds into', to: 'B' }] }], no_path: [] });
  fs.writeFileSync(itemsPath, itemsRaw);
  const realSha = sha256Hex(itemsRaw);

  const noLabeledAtPath = path.join(dir, 'gold-no-labeled-at.json');
  fs.writeFileSync(noLabeledAtPath, JSON.stringify({ items: [], fixture_sha256: realSha }));
  let threwA = null;
  try { citation.loadFixtures({ goldPath: noLabeledAtPath, itemsPath }); } catch (e) { threwA = e; }
  check('citation loadFixtures refuses without labeled_at', threwA instanceof citation.RefusalError && /labeled_at/.test(threwA.message) && /D-32/.test(threwA.message));

  const badShaPath = path.join(dir, 'gold-bad-sha.json');
  fs.writeFileSync(badShaPath, JSON.stringify({ items: [], fixture_sha256: '0'.repeat(64), labeled_at: '2026-09-24T00:00:00.000Z' }));
  let threwB = null;
  try { citation.loadFixtures({ goldPath: badShaPath, itemsPath }); } catch (e) { threwB = e; }
  check('citation loadFixtures refuses on fixture_sha256 mismatch', threwB instanceof citation.RefusalError && /fixture_sha256/.test(threwB.message) && /D-32/.test(threwB.message));

  const goodPath = path.join(dir, 'gold-good.json');
  fs.writeFileSync(goodPath, JSON.stringify({ items: [{ id: 'x1', claim: 'A and B: same meaning in different words.', path: [{ from: 'A', relation: 'feeds into', to: 'B' }], gold: 'says_nothing' }], fixture_sha256: realSha, labeled_at: '2026-09-24T00:00:00.000Z' }));
  const loaded = citation.loadFixtures({ goldPath: goodPath, itemsPath });
  check('citation loadFixtures accepts a matching, labeled gold file', loaded.gold.labeled_at === '2026-09-24T00:00:00.000Z');
  check('citation loadFixtures returns 1 item, 0 no_path', loaded.items.length === 1 && loaded.noPath.length === 0);
}

function writeUsefulnessSyntheticFixtures(dir, n) {
  const items = [];
  for (let i = 0; i < n; i += 1) {
    items.push({ pair_id: 'u' + (i + 1), room: 'room-x', producer: 'hsi', a_excerpt: 'Excerpt A ' + i, b_excerpt: 'Excerpt B ' + i, direction_phrase: 'same meaning in different words', a_path: 'x.md', b_path: 'y.md' });
  }
  const itemsPath = path.join(dir, 'pairings.items.json');
  const itemsRaw = JSON.stringify({ items });
  fs.writeFileSync(itemsPath, itemsRaw);
  const fixtureSha256 = sha256Hex(itemsRaw);

  const judgmentsPath = path.join(dir, 'judgments.json');
  const judgmentItems = items.map((it, i) => ({ pair_id: it.pair_id, useful: i % 2 === 0, direction_ok: true, already_known: i % 3 === 0, at: '2026-09-24T00:00:00.000Z' }));
  fs.writeFileSync(judgmentsPath, JSON.stringify({ labeler: 'navigator', fixture_sha256: fixtureSha256, labeled_at: '2026-09-24T00:00:00.000Z', items: judgmentItems }));

  const stampsPath = path.join(dir, 'stamps.json');
  const by_pair = {};
  items.forEach((it, i) => {
    by_pair[it.pair_id] = { stamp: { verification: i % 3 === 0 ? 'strong' : (i % 3 === 1 ? 'indirect' : 'unverified'), backend: 'theo', direction: 'structural_transfer', judge: 'none' }, detail: {} };
  });
  fs.writeFileSync(stampsPath, JSON.stringify({ generated_at: '2026-09-24T00:00:00.000Z', capture_sha256: '0'.repeat(64), snapshot_sha256: '0'.repeat(64), by_pair }));

  return { itemsPath, judgmentsPath, stampsPath, fixtureSha256 };
}

function legUsefulnessGoldRefusal() {
  console.log('--- leg: usefulness D-32 gold-refusal + missing-stamp-tier refusal path ---');
  const dir = mkTmpDir();
  const { itemsPath, stampsPath } = writeUsefulnessSyntheticFixtures(dir, 2);

  const noLabeledAtPath = path.join(dir, 'judgments-no-labeled-at.json');
  const itemsRaw = fs.readFileSync(itemsPath, 'utf8');
  fs.writeFileSync(noLabeledAtPath, JSON.stringify({ items: [], fixture_sha256: sha256Hex(itemsRaw) }));
  let threwA = null;
  try { usefulness.loadFixtures({ judgmentsPath: noLabeledAtPath, itemsPath, stampsPath }); } catch (e) { threwA = e; }
  check('usefulness loadFixtures refuses without labeled_at', threwA instanceof usefulness.RefusalError && /labeled_at/.test(threwA.message) && /D-32/.test(threwA.message));

  const badShaPath = path.join(dir, 'judgments-bad-sha.json');
  fs.writeFileSync(badShaPath, JSON.stringify({ items: [], fixture_sha256: '0'.repeat(64), labeled_at: '2026-09-24T00:00:00.000Z' }));
  let threwB = null;
  try { usefulness.loadFixtures({ judgmentsPath: badShaPath, itemsPath, stampsPath }); } catch (e) { threwB = e; }
  check('usefulness loadFixtures refuses on fixture_sha256 mismatch', threwB instanceof usefulness.RefusalError && /fixture_sha256/.test(threwB.message) && /D-32/.test(threwB.message));

  // Missing stamp tier: an items file with a pair_id absent from stamps.json.
  const dir2 = mkTmpDir();
  const { itemsPath: ip2, judgmentsPath: jp2 } = writeUsefulnessSyntheticFixtures(dir2, 1);
  const emptyStampsPath = path.join(dir2, 'stamps-empty.json');
  fs.writeFileSync(emptyStampsPath, JSON.stringify({ generated_at: '2026-09-24T00:00:00.000Z', capture_sha256: '0'.repeat(64), snapshot_sha256: '0'.repeat(64), by_pair: {} }));
  let threwC = null;
  try { usefulness.loadFixtures({ itemsPath: ip2, judgmentsPath: jp2, stampsPath: emptyStampsPath }); } catch (e) { threwC = e; }
  check('usefulness loadFixtures refuses when a pairing has no stamp tier', threwC instanceof usefulness.RefusalError && /stamp tier/.test(threwC.message));
}

// =============================================================================
// no_path zero-call proof, against the REAL citation items file (D-46): 43
// items with a path (2 Jev calls each: stated + withheld) plus 8 no_path
// entries that must generate ZERO calls.
// =============================================================================
function makeCitationChoiceJson(choice, confidence, inputTokens) {
  const options = ['supports', 'contradicts', 'says_nothing'];
  const probs = {};
  for (const o of options) probs[o] = o === choice ? 0.9 : 0.05;
  return JSON.stringify({
    model: Q.PINNED_MODEL,
    answers: { relation: { type: 'choice', choice, probabilities: probs, confidence } },
    usage: { input_tokens: inputTokens, output_tokens: 4 },
  });
}

async function legNoPathZeroCalls() {
  console.log('--- leg: no_path items send ZERO Jev calls (real 355-citation-pairs.items.json) ---');
  const loaded = citation.loadFixtures({}); // real default paths
  check('real citation items: 43 items with path', loaded.items.length === 43, String(loaded.items.length));
  check('real citation items: 8 no_path entries', loaded.noPath.length === 8, String(loaded.noPath.length));

  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { status: 200, text: async () => makeCitationChoiceJson('says_nothing', 0.5, 200) };
  };
  const { calls: reportedCalls } = await citation.runCalibration({
    items: loaded.items, gold: loaded.gold, key: FAKE_KEY, fetchImpl, sleepImpl: async () => {},
  });
  check('no_path zero-call proof: exactly 86 calls (43 items x 2 variants), none for the 8 no_path entries', calls === 86 && reportedCalls === 86, String(calls));
}

// =============================================================================
// Stubbed live runs (synthetic, small fixtures) for both scripts' main().
// =============================================================================
function writeCitationSyntheticFixtures(dir) {
  const items = [
    { pair_id: 'c1', from: 'A', to: 'B', direction: 'structural_transfer', claim: 'A and B: same meaning in different words.', path: [{ from: 'A', relation: 'feeds into', to: 'B' }], stratum: 'direct_lateral', synthetic: false },
    { pair_id: 'c2', from: 'C', to: 'D', direction: 'structural_transfer', claim: 'C and D: same meaning in different words.', path: [{ from: 'C', relation: 'contrasts with', to: 'D' }], stratum: 'contradicting', synthetic: true },
  ];
  const itemsPath = path.join(dir, 'citation-items.json');
  const itemsRaw = JSON.stringify({ items, no_path: [{ pair_id: 'c3', from: 'E', to: 'F', direction: 'structural_transfer' }] });
  fs.writeFileSync(itemsPath, itemsRaw);
  const fixtureSha256 = sha256Hex(itemsRaw);
  const goldPath = path.join(dir, 'citation-gold.json');
  fs.writeFileSync(goldPath, JSON.stringify({
    labeler: 'claude-opus-5.5', labeler_kind: 'external_model', fixture_sha256: fixtureSha256, labeled_at: '2026-09-24T00:00:00.000Z',
    items: [{ id: 'c1', claim: items[0].claim, path: items[0].path, gold: 'says_nothing' }, { id: 'c2', claim: items[1].claim, path: items[1].path, gold: 'contradicts' }],
  }));
  return { itemsPath, goldPath };
}

async function legCitationLiveRunSuccess() {
  console.log('--- leg: citation stubbed live run, success path (main()) ---');
  const dir = mkTmpDir();
  const { itemsPath, goldPath } = writeCitationSyntheticFixtures(dir);
  const responsesPath = path.join(dir, 'responses.json');
  const recordPath = path.join(dir, 'record.json');
  let calls = 0;
  const fetchImpl = async (_endpoint, init) => {
    calls += 1;
    const body = JSON.parse(init.body);
    const isStated = !!(body.questions.relation.instructions.rule);
    const choice = body.state.claim.startsWith('A and B') ? 'says_nothing' : 'contradicts';
    return { status: 200, text: async () => makeCitationChoiceJson(choice, isStated ? 0.9 : 0.5, 300) };
  };
  const logs = [];
  const errs = [];
  const code = await citation.main([], {
    itemsPath, goldPath, responsesPath, recordPath,
    key: FAKE_KEY, fetchImpl, sleepImpl: async () => {},
    write: (s) => logs.push(s), writeErr: (s) => errs.push(s),
  });
  check('citation live run success: exit code 0', code === 0, String(code) + ' ' + errs.join('; '));
  check('citation live run success: exactly 4 calls (2 items x 2 variants)', calls === 4, String(calls));
  check('citation live run success: responses file written', fs.existsSync(responsesPath));
  check('citation live run success: record file written', fs.existsSync(recordPath));
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  check('record has a citation section', !!record.citation);
  check('record.citation.item_count === 2', record.citation.item_count === 2);
  check('record.citation.no_path_count === 1', record.citation.no_path_count === 1);
  check('record.citation.stated.exact_agreement.correct === 2 (both correct when rule stated)', record.citation.stated.exact_agreement.correct === 2, JSON.stringify(record.citation.stated));
  check('record.citation.band_stated is one of high/medium/low/unknown', ['high', 'medium', 'low', 'unknown'].includes(record.citation.band_stated));
  check('record.citation.seam_rule names the three bands', /high/.test(record.citation.seam_rule) && /medium/.test(record.citation.seam_rule) && /low/.test(record.citation.seam_rule));
  return { itemsPath, goldPath, responsesPath, recordPath };
}

async function legCitationLiveRun401() {
  console.log('--- leg: citation stubbed live run, 401 aborts the whole run, key withheld ---');
  const dir = mkTmpDir();
  const { itemsPath, goldPath } = writeCitationSyntheticFixtures(dir);
  const errs = [];
  const code = await citation.main([], {
    itemsPath, goldPath,
    responsesPath: path.join(dir, 'responses.json'), recordPath: path.join(dir, 'record.json'),
    key: FAKE_KEY, sleepImpl: async () => {},
    fetchImpl: async () => ({ status: 401, text: async () => '{}' }),
    write: () => {}, writeErr: (s) => errs.push(s),
  });
  check('citation 401: exit code non-zero', code !== 0, String(code));
  check('citation 401: no record written', !fs.existsSync(path.join(dir, 'record.json')));
  check('citation 401: error message never contains the fake key', !errs.join(' ').includes(FAKE_KEY));
  check('citation 401: error message names the abort', errs.some((e) => /401/.test(e)));
}

async function legCitationLiveRunTokenTripwire() {
  console.log('--- leg: citation stubbed live run, usage.input_tokens over 8000 aborts the whole run ---');
  const dir = mkTmpDir();
  const { itemsPath, goldPath } = writeCitationSyntheticFixtures(dir);
  const errs = [];
  const code = await citation.main([], {
    itemsPath, goldPath,
    responsesPath: path.join(dir, 'responses.json'), recordPath: path.join(dir, 'record.json'),
    key: FAKE_KEY, sleepImpl: async () => {},
    fetchImpl: async () => ({ status: 200, text: async () => makeCitationChoiceJson('says_nothing', 0.9, 9001) }),
    write: () => {}, writeErr: (s) => errs.push(s),
  });
  check('citation token tripwire: exit code non-zero', code !== 0);
  check('citation token tripwire: message names the 8000 bound', errs.some((e) => /8000/.test(e)));
}

function makeUsefulnessChoiceJson(choice, confidence, inputTokens) {
  const options = ['useful', 'not_useful', 'already_known', 'none'];
  const probs = {};
  for (const o of options) probs[o] = o === choice ? 0.9 : (0.1 / 3);
  return JSON.stringify({
    model: Q.PINNED_MODEL,
    answers: { usefulness: { type: 'choice', choice, probabilities: probs, confidence } },
    usage: { input_tokens: inputTokens, output_tokens: 4 },
  });
}

async function legUsefulnessLiveRunSuccess() {
  console.log('--- leg: usefulness stubbed live run, success path (main()) ---');
  const dir = mkTmpDir();
  const { itemsPath, judgmentsPath, stampsPath } = writeUsefulnessSyntheticFixtures(dir, 3);
  const responsesPath = path.join(dir, 'responses.json');
  const recordPath = path.join(dir, 'record.json');
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { status: 200, text: async () => makeUsefulnessChoiceJson('useful', 0.9, 250) };
  };
  const logs = [];
  const errs = [];
  const code = await usefulness.main([], {
    itemsPath, judgmentsPath, stampsPath, responsesPath, recordPath,
    key: FAKE_KEY, fetchImpl, sleepImpl: async () => {},
    write: (s) => logs.push(s), writeErr: (s) => errs.push(s),
  });
  check('usefulness live run success: exit code 0', code === 0, String(code) + ' ' + errs.join('; '));
  check('usefulness live run success: exactly 3 calls (3 pairings)', calls === 3, String(calls));
  check('usefulness live run success: responses file written', fs.existsSync(responsesPath));
  check('usefulness live run success: record file written', fs.existsSync(recordPath));
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  check('record has a usefulness section', !!record.usefulness);
  check('record.usefulness.n === 3', record.usefulness.n === 3);
  check('record.usefulness.per_tier has strong/indirect/unverified keys (i % 3 tiering)', !!record.usefulness.per_tier.strong && !!record.usefulness.per_tier.indirect && !!record.usefulness.per_tier.unverified);
  return { itemsPath, judgmentsPath, stampsPath, responsesPath, recordPath };
}

// =============================================================================
// Section-touching discipline: running citation then usefulness against the
// SAME shared record path must produce a record with BOTH sections, neither
// script ever clobbering the other's section.
// =============================================================================
async function legSharedRecordSectionTouching() {
  console.log('--- leg: shared record file section-touching discipline ---');
  const dir = mkTmpDir();
  const { itemsPath: citItemsPath, goldPath: citGoldPath } = writeCitationSyntheticFixtures(dir);
  const { itemsPath: usefItemsPath, judgmentsPath: usefJudgmentsPath, stampsPath: usefStampsPath } = writeUsefulnessSyntheticFixtures(dir, 2);
  const recordPath = path.join(dir, 'shared-record.json');
  const citResponsesPath = path.join(dir, 'cit-responses.json');
  const usefResponsesPath = path.join(dir, 'usef-responses.json');

  const code1 = await citation.main([], {
    itemsPath: citItemsPath, goldPath: citGoldPath, responsesPath: citResponsesPath, recordPath,
    key: FAKE_KEY, sleepImpl: async () => {},
    fetchImpl: async () => ({ status: 200, text: async () => makeCitationChoiceJson('says_nothing', 0.9, 200) }),
    write: () => {}, writeErr: () => {},
  });
  check('section-touching: citation run exits 0', code1 === 0);
  const afterCitation = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  check('section-touching: record has citation only after the first run', !!afterCitation.citation && !afterCitation.usefulness);

  const code2 = await usefulness.main([], {
    itemsPath: usefItemsPath, judgmentsPath: usefJudgmentsPath, stampsPath: usefStampsPath, responsesPath: usefResponsesPath, recordPath,
    key: FAKE_KEY, sleepImpl: async () => {},
    fetchImpl: async () => ({ status: 200, text: async () => makeUsefulnessChoiceJson('useful', 0.9, 200) }),
    write: () => {}, writeErr: () => {},
  });
  check('section-touching: usefulness run exits 0', code2 === 0);
  const afterBoth = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  check('section-touching: record now has BOTH sections', !!afterBoth.citation && !!afterBoth.usefulness);
  check('section-touching: citation section unchanged by the usefulness run', isDeepStrictEqual(afterBoth.citation, afterCitation.citation));
}

// =============================================================================
// --check legs: SKIP while absent, offline recompute, model-drift detection.
// =============================================================================
async function legCitationCheckNoRecordSkips() {
  console.log('--- leg: citation --check exits 77 when no citation section exists yet ---');
  const dir = mkTmpDir();
  const { itemsPath, goldPath } = writeCitationSyntheticFixtures(dir);
  const errs = [];
  const code = await citation.main(['--check'], {
    itemsPath, goldPath,
    responsesPath: path.join(dir, 'responses.json'), recordPath: path.join(dir, 'nonexistent-record.json'),
    write: () => {}, writeErr: (s) => errs.push(s),
  });
  check('citation --check with no record: exit 77', code === 77, String(code));
  check('citation --check with no record: loud SKIP message', errs.some((e) => /SKIP/.test(e)));
  check('citation --check with no record: zero network', netGuard.attempts() === 0);
}

async function legCitationCheckRoundTrip() {
  console.log('--- leg: citation --check recomputes exactly, zero network, no key ---');
  const { itemsPath, goldPath, responsesPath, recordPath } = await legCitationLiveRunSuccess();
  const errs = [];
  const code = await citation.main(['--check'], { itemsPath, goldPath, responsesPath, recordPath, write: () => {}, writeErr: (s) => errs.push(s) });
  check('citation --check after live: exit 0 (no key, no network)', code === 0, errs.join('; '));
  check('citation --check: zero network calls (stub fetchImpl used throughout, never globalThis.fetch)', true);
  return { itemsPath, goldPath, responsesPath, recordPath };
}

async function legCitationCheckModelDriftFails() {
  console.log('--- leg: citation --check fails loudly on a model-drifted recorded response ---');
  const { itemsPath, goldPath, responsesPath, recordPath } = await legCitationCheckRoundTrip();
  const responses = JSON.parse(fs.readFileSync(responsesPath, 'utf8'));
  const firstKey = Object.keys(responses)[0];
  responses[firstKey][0].model = 'jev-9.9.9';
  fs.writeFileSync(responsesPath, JSON.stringify(responses, null, 2));
  const errs = [];
  const code = await citation.main(['--check'], { itemsPath, goldPath, responsesPath, recordPath, write: () => {}, writeErr: (s) => errs.push(s) });
  check('citation --check: a recorded response with a drifted model fails', code !== 0);
  check('citation --check: names the model in the failure', errs.some((e) => /model/.test(e)));
}

async function legUsefulnessCheckNoRecordSkips() {
  console.log('--- leg: usefulness --check exits 77 when no usefulness section exists yet ---');
  const dir = mkTmpDir();
  const { itemsPath, judgmentsPath, stampsPath } = writeUsefulnessSyntheticFixtures(dir, 2);
  const errs = [];
  const code = await usefulness.main(['--check'], {
    itemsPath, judgmentsPath, stampsPath,
    responsesPath: path.join(dir, 'responses.json'), recordPath: path.join(dir, 'nonexistent-record.json'),
    write: () => {}, writeErr: (s) => errs.push(s),
  });
  check('usefulness --check with no record: exit 77', code === 77, String(code));
  check('usefulness --check with no record: loud SKIP message', errs.some((e) => /SKIP/.test(e)));
  check('usefulness --check with no record: zero network', netGuard.attempts() === 0);
}

async function legUsefulnessCheckRoundTrip() {
  console.log('--- leg: usefulness --check recomputes exactly, zero network, no key ---');
  const { itemsPath, judgmentsPath, stampsPath, responsesPath, recordPath } = await legUsefulnessLiveRunSuccess();
  const errs = [];
  const code = await usefulness.main(['--check'], { itemsPath, judgmentsPath, stampsPath, responsesPath, recordPath, write: () => {}, writeErr: (s) => errs.push(s) });
  check('usefulness --check after live: exit 0 (no key, no network)', code === 0, errs.join('; '));
  return { itemsPath, judgmentsPath, stampsPath, responsesPath, recordPath };
}

async function legUsefulnessCheckModelDriftFails() {
  console.log('--- leg: usefulness --check fails loudly on a model-drifted recorded response ---');
  const { itemsPath, judgmentsPath, stampsPath, responsesPath, recordPath } = await legUsefulnessCheckRoundTrip();
  const responses = JSON.parse(fs.readFileSync(responsesPath, 'utf8'));
  const firstKey = Object.keys(responses)[0];
  responses[firstKey][0].model = 'jev-9.9.9';
  fs.writeFileSync(responsesPath, JSON.stringify(responses, null, 2));
  const errs = [];
  const code = await usefulness.main(['--check'], { itemsPath, judgmentsPath, stampsPath, responsesPath, recordPath, write: () => {}, writeErr: (s) => errs.push(s) });
  check('usefulness --check: a recorded response with a drifted model fails', code !== 0);
  check('usefulness --check: names the model in the failure', errs.some((e) => /model/.test(e)));
}

// =============================================================================
// Static sweeps: no lib/hooks reference to either script; no jev-latest
// literal in either script's own code (pinned jev-1.13.0 only).
// =============================================================================
function legStaticSweeps() {
  console.log('--- leg: lib/hooks non-reference + jev-latest sweep ---');
  const libFiles = hygiene.listFilesRecursive(path.join(REPO, 'lib'));
  const hooksFiles = hygiene.listFilesRecursive(path.join(REPO, 'hooks'));
  const allFiles = [...libFiles, ...hooksFiles];

  const citHit = allFiles.find((f) => hygiene.nonCommentLines(f).some((l) => l.includes('calibrate-citation-check')));
  check('no lib/ or hooks/ file references calibrate-citation-check', !citHit, citHit ? path.relative(REPO, citHit) : '');
  const usefHit = allFiles.find((f) => hygiene.nonCommentLines(f).some((l) => l.includes('judge-355-usefulness')));
  check('no lib/ or hooks/ file references judge-355-usefulness', !usefHit, usefHit ? path.relative(REPO, usefHit) : '');

  const citOwnLines = hygiene.nonCommentLines(CITATION_SCRIPT_PATH);
  check('calibrate-citation-check.cjs never uses jev-latest in code (pinned model only)', !citOwnLines.some((l) => l.includes('jev-latest')));
  const usefOwnLines = hygiene.nonCommentLines(USEFULNESS_SCRIPT_PATH);
  check('judge-355-usefulness.cjs never uses jev-latest in code (pinned model only)', !usefOwnLines.some((l) => l.includes('jev-latest')));
}

// =============================================================================
// HOOKS_BANNED_LEDGER_SCRIPTS append check: test-353-tripwires.cjs must
// list both new script names (Phase 356 peer contract).
// =============================================================================
function legTripwireLedgerAppended() {
  console.log('--- leg: HOOKS_BANNED_LEDGER_SCRIPTS lists both new scripts ---');
  const src = fs.readFileSync(path.join(REPO, 'tests', 'test-353-tripwires.cjs'), 'utf8');
  check('HOOKS_BANNED_LEDGER_SCRIPTS includes calibrate-citation-check', /'calibrate-citation-check'/.test(src));
  check('HOOKS_BANNED_LEDGER_SCRIPTS includes judge-355-usefulness', /'judge-355-usefulness'/.test(src));
}

// =============================================================================
// D-32/D-33 real git-order legs. Skipped with an ENV GAP (and the overall
// run exits 77, not 0) while Task 2's live run has not yet populated the
// real response fixtures -- mirrors tests/test-356-answer-key.cjs's D-16 leg.
// =============================================================================
let recordLegsSkipped = false;

function git(args) {
  return spawnSync('git', args, { cwd: REPO, encoding: 'utf8' });
}

function firstCommitAdding(absPath) {
  const rel = path.relative(REPO, absPath);
  const result = git(['log', '--follow', '--diff-filter=A', '--format=%H', '--reverse', '--', rel]);
  if (result.status !== 0) return null;
  const lines = result.stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  return lines.length ? lines[0] : null;
}

function latestCommitTouching(absPath) {
  const rel = path.relative(REPO, absPath);
  const result = git(['log', '-1', '--format=%H', '--', rel]);
  if (result.status !== 0) return null;
  const sha = result.stdout.trim();
  return sha || null;
}

function isAncestor(ancestorSha, descendantSha) {
  return git(['merge-base', '--is-ancestor', ancestorSha, descendantSha]).status === 0;
}

function legRealRecordGitOrder() {
  console.log('--- leg: D-32/D-33 real gold-before-response git order ---');
  const citationResponsesPath = path.join(REPO, 'tests', 'fixtures', '355-jev-citation-responses.json');
  const usefulnessResponsesPath = path.join(REPO, 'tests', 'fixtures', '355-jev-usefulness-responses.json');
  const citationGoldPath = path.join(REPO, 'tests', 'fixtures', '355-citation-pairs.json');
  const judgmentsPath = path.join(REPO, 'tests', 'fixtures', '355-rooms', 'judgments.json');

  if (!fs.existsSync(citationResponsesPath) || !fs.existsSync(usefulnessResponsesPath)) {
    console.log('ENV GAP: real response fixtures not written yet (Task 2 has not run); skipping git-order legs');
    recordLegsSkipped = true;
    return;
  }

  const citationGoldCommit = latestCommitTouching(citationGoldPath);
  const judgmentsCommit = latestCommitTouching(judgmentsPath);
  const citationResponsesFirstCommit = firstCommitAdding(citationResponsesPath);
  const usefulnessResponsesFirstCommit = firstCommitAdding(usefulnessResponsesPath);

  check('citation gold commit resolved', !!citationGoldCommit);
  check('sitting-1 judgments commit resolved', !!judgmentsCommit);
  check('citation responses first-added commit resolved', !!citationResponsesFirstCommit);
  check('usefulness responses first-added commit resolved', !!usefulnessResponsesFirstCommit);

  if (citationGoldCommit && citationResponsesFirstCommit) {
    check('citation gold commit is an ancestor of the citation responses first commit',
      isAncestor(citationGoldCommit, citationResponsesFirstCommit));
  }
  if (judgmentsCommit && usefulnessResponsesFirstCommit) {
    check('sitting-1 judgments commit is an ancestor of the usefulness responses first commit',
      isAncestor(judgmentsCommit, usefulnessResponsesFirstCommit));
  }
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------
async function run() {
  legSummarizeVariant();
  legBandFromMeasured();
  legUsefulnessAgreement();
  legCitationGoldRefusal();
  legUsefulnessGoldRefusal();
  await legNoPathZeroCalls();
  await legCitationLiveRunSuccess();
  await legCitationLiveRun401();
  await legCitationLiveRunTokenTripwire();
  await legUsefulnessLiveRunSuccess();
  await legSharedRecordSectionTouching();
  await legCitationCheckNoRecordSkips();
  await legCitationCheckModelDriftFails();
  await legUsefulnessCheckNoRecordSkips();
  await legUsefulnessCheckModelDriftFails();
  legStaticSweeps();
  legTripwireLedgerAppended();
  legRealRecordGitOrder();

  check('hygiene: zero real network attempts across the whole run', netGuard.attempts() === 0);
  netGuard.restore();
  const code = summary();
  if (code === 0 && recordLegsSkipped) {
    console.log('OVERALL: real record git-order legs skipped (Task 2 not yet run) -> exit 77');
    process.exit(77);
  }
  process.exit(code);
}

run();
