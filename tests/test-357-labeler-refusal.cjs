#!/usr/bin/env node
'use strict';
/**
 * Phase 357 Plan 04 Task 2 (SPEC R3, D-10, D-11, D-12): proves
 * scripts/label-card-fire-replay.cjs refuses dogfood and unsanitized
 * entries BEFORE any request is built, runs keyless with exit 0, enforces
 * the real card_fire_replay egress profile (caps, must_equal_file,
 * question_strings_from_file_key), derives every question string from the
 * policy file, maps and combines the three independent Nouls correctly,
 * writes a report with no entry text, and that no non-comment line under
 * lib/ or hooks/ ever references the vendor or any 357 dev script.
 *
 * Test hygiene contract (the 356 pattern, restated in 357-04-PLAN.md): the
 * developer shell exports TYPESAFE_API_KEY, so this file starts by deleting
 * it and replacing globalThis.fetch with a counting thrower before any
 * other require of repo code. NET_ATTEMPTS === 0 is asserted last. Every
 * spawned child also deletes TYPESAFE_API_KEY, gets HOME pointed at a fresh
 * mkdtemp dir, and preloads a script that prints NETWORK_ATTEMPT_357 on any
 * fetch attempt.
 *
 * House rule: hyphens only, no em-dashes.
 */

delete process.env.TYPESAFE_API_KEY;
let NET_ATTEMPTS = 0;
globalThis.fetch = function noNetwork357() {
  NET_ATTEMPTS += 1;
  throw new Error('no network in 357 tests');
};

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const SCRIPT_PATH = path.join(REPO, 'scripts', 'label-card-fire-replay.cjs');

const labeler = require(SCRIPT_PATH);
const client = require(path.join(REPO, 'scripts', 'jev-devtime-client.cjs'));
const corpusLoader = require(path.join(REPO, 'scripts', 'card-fire-replay-corpus.cjs'));

const { EGRESS_PROFILES } = client;
const PROFILE = EGRESS_PROFILES.card_fire_replay;
const POLICY_PATH = path.join(REPO, PROFILE.must_equal_file.policy);
const POLICY_JSON = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
const POLICIES_BY_ID = {};
for (const p of POLICY_JSON.policies) POLICIES_BY_ID[p.policy_id] = p;

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

console.log('test-357-labeler-refusal');

// ---------------------------------------------------------------------------
// L1: refusal before request (SPEC R3 acceptance). A dogfood entry is
// refused by buildRequestBody before any fetch is attempted, and
// selectLabelable never returns a dogfood entry at all.
// ---------------------------------------------------------------------------
function legL1() {
  console.log('--- L1: refusal before request (SPEC R3 acceptance) ---');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '357-labeler-corpus-'));
  const dogfoodMeta = { sanitization_statement: 'sanitized: names and room content replaced with placeholders (test fixture).' };
  const dogfoodEntry = {
    id: 'dogfood:test-l1',
    source: 'dogfood',
    envelope: {
      mode: 'transcript',
      transcript: [
        { type: 'user', message: { role: 'user', content: 'a harness-shaped test message' } },
        { type: 'assistant', message: { role: 'assistant', content: 'a rendered test option slate' } },
      ],
    },
    expected_verdict_class: 'block',
    label_origin: 'local',
    why: 'synthetic dogfood fixture for the L1 refusal proof',
  };
  fs.writeFileSync(path.join(dir, 'dogfood.json'), JSON.stringify({ meta: dogfoodMeta, entries: [dogfoodEntry] }, null, 2));

  const before = NET_ATTEMPTS;
  let threw = false;
  let message = '';
  try {
    labeler.buildRequestBody(dogfoodEntry, dogfoodMeta);
  } catch (e) {
    threw = true;
    message = String(e && e.message);
  }
  check('L1: buildRequestBody throws on a dogfood entry', threw);
  check('L1: refusal message starts with "refused" and names the entry id', message.indexOf('refused') === 0 && message.indexOf(dogfoodEntry.id) !== -1);
  check('L1: no fetch was attempted', NET_ATTEMPTS === before);

  const corpus = corpusLoader.loadCorpus({ corpusDir: dir, include238: false, sources: ['dogfood'] });
  check('L1: the loader read the dogfood entry', corpus.entries.length === 1 && corpus.errors.length === 0);
  const pairs = labeler.selectLabelable(corpus);
  check('L1: selectLabelable returns zero pairs from an all-dogfood corpus', pairs.length === 0);
  check('L1: no returned pair has source dogfood', pairs.every((p) => p.entry.source !== 'dogfood'));

  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// L2: missing sanitization_statement. assertLabelable refuses, naming the id.
// ---------------------------------------------------------------------------
function legL2() {
  console.log('--- L2: refusal when file meta lacks sanitization_statement ---');

  const entry = { id: 'debug:test-l2-missing-meta', source: 'debug', expected_verdict_class: 'pass' };

  let threw = false;
  let message = '';
  try {
    labeler.assertLabelable(entry, { sanitization_statement: '' });
  } catch (e) {
    threw = true;
    message = String(e && e.message);
  }
  check('L2: assertLabelable throws when sanitization_statement is empty', threw);
  check('L2: refusal message starts with "refused" and names the entry id', message.indexOf('refused') === 0 && message.indexOf(entry.id) !== -1);

  let threw2 = false;
  try {
    labeler.assertLabelable(entry, null);
  } catch (e) { threw2 = true; }
  check('L2: assertLabelable throws when fileMeta is null', threw2);
}

// ---------------------------------------------------------------------------
// L3: keyless exit 0. A spawned child with no key writes a report and exits
// 0, printing "unlabeled", with zero network attempts.
// ---------------------------------------------------------------------------
function legL3() {
  console.log('--- L3: keyless CLI run exits 0 ---');

  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), '357-labeler-home-'));
  const tmpReportDir = fs.mkdtempSync(path.join(os.tmpdir(), '357-labeler-report-'));
  const reportPath = path.join(tmpReportDir, 'r.md');
  const preloadDir = fs.mkdtempSync(path.join(os.tmpdir(), '357-labeler-preload-'));
  const preloadPath = path.join(preloadDir, 'preload.cjs');
  fs.writeFileSync(preloadPath, [
    "'use strict';",
    'delete process.env.TYPESAFE_API_KEY;',
    'globalThis.fetch = function noNetwork357Child() {',
    "  process.stderr.write('NETWORK_ATTEMPT_357\\n');",
    "  throw new Error('no network in 357 tests');",
    '};',
    '',
  ].join('\n'));

  const env = Object.assign({}, process.env);
  delete env.TYPESAFE_API_KEY;
  env.HOME = tmpHome;
  env.NODE_OPTIONS = ((env.NODE_OPTIONS || '') + ' --require ' + preloadPath).trim();

  const res = spawnSync(process.execPath, [SCRIPT_PATH, '--report', reportPath], { env: env, encoding: 'utf8' });
  check('L3: exit code is 0', res.status === 0);
  check('L3: stdout contains "unlabeled"', /unlabeled/.test(res.stdout || ''));
  check('L3: the report file exists', fs.existsSync(reportPath));
  const reportContent = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '';
  check('L3: the report contains "unlabeled"', /unlabeled/.test(reportContent));
  check('L3: stderr has no NETWORK_ATTEMPT_357', !/NETWORK_ATTEMPT_357/.test(res.stderr || ''));

  fs.rmSync(tmpHome, { recursive: true, force: true });
  fs.rmSync(tmpReportDir, { recursive: true, force: true });
  fs.rmSync(preloadDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// L4: guard enforcement through the REAL card_fire_replay profile. A valid
// body built by buildRequestBody passes; seven distinct single-field
// mutations each throw EGRESS_REFUSED naming the offending key, and routing
// each mutated body through client.jev() with a fetchImpl spy leaves the
// spy's call count at 0 (the guard runs before any fetch attempt).
// ---------------------------------------------------------------------------
async function legL4() {
  console.log('--- L4: guard enforcement through the real profile ---');

  const corpus = corpusLoader.loadCorpus({});
  const pairs = labeler.selectLabelable(corpus);
  const pair = pairs.find((p) => p.entry.source === '238');
  check('L4: found a real 238 entry to test against', !!pair);
  if (!pair) return;

  const guard = client.makeEgressGuard(PROFILE, { root: REPO });
  const validBody = labeler.buildRequestBody(pair.entry, pair.fileMeta);
  check('L4: guard returns true for a body built by buildRequestBody', guard(validBody) === true);

  function mutated(fn) {
    const body = JSON.parse(JSON.stringify(validBody));
    fn(body);
    return body;
  }

  const cases = [
    {
      label: 'state.policy one byte different',
      key: 'policy',
      body: mutated((b) => {
        b.state.policy = b.state.policy.slice(0, -1) + (b.state.policy.slice(-1) === 'x' ? 'y' : 'x');
      }),
    },
    {
      label: 'an extra state key room',
      key: 'room',
      body: mutated((b) => { b.state.room = 'extra'; }),
    },
    {
      label: 'output_text of 4001 chars',
      key: 'output_text',
      body: mutated((b) => { b.state.output_text = 'a'.repeat(4001); }),
    },
    {
      label: 'turns_since_gate as the number 0',
      key: 'turns_since_gate',
      body: mutated((b) => { b.state.turns_since_gate = 0; }),
    },
    {
      label: 'a question whose type is choice',
      key: 'is_fork',
      body: mutated((b) => { b.questions.is_fork.type = 'choice'; }),
    },
    {
      label: 'a fourth question id',
      key: 'extra_question',
      body: mutated((b) => { b.questions.extra_question = JSON.parse(JSON.stringify(b.questions.is_fork)); }),
    },
    {
      label: "an instructions.rule edited by one character",
      key: 'rule',
      body: mutated((b) => { b.questions.is_fork.instructions.rule = b.questions.is_fork.instructions.rule + ' '; }),
    },
  ];

  for (const c of cases) {
    let threw = false;
    let errCode = null;
    let errKey = null;
    try {
      guard(c.body);
    } catch (e) {
      threw = true;
      errCode = e && e.code;
      errKey = e && e.key;
    }
    check('L4 (' + c.label + '): guard throws', threw);
    check('L4 (' + c.label + '): err.code === EGRESS_REFUSED', errCode === 'EGRESS_REFUSED');
    check('L4 (' + c.label + '): err.key names the offending field', String(errKey || '').indexOf(c.key) !== -1);

    let spyCalls = 0;
    async function spyFetch() { spyCalls += 1; throw new Error('spy should never be called'); }
    let rejected = false;
    try {
      await client.jev(c.body, { key: 'k', guard: guard, fetchImpl: spyFetch });
    } catch (e) {
      rejected = e && e.code === 'EGRESS_REFUSED';
    }
    check('L4 (' + c.label + '): jev() rejects through the guard', rejected);
    check('L4 (' + c.label + '): the fetchImpl spy was never called', spyCalls === 0);
  }
}

// ---------------------------------------------------------------------------
// L5: every question string outside the fixed question sentence comes from
// the parsed policy file, and instructions.question stays at or under 400
// chars.
// ---------------------------------------------------------------------------
function legL5() {
  console.log('--- L5: questions derive from the policy ---');

  const corpus = corpusLoader.loadCorpus({});
  const pairs = labeler.selectLabelable(corpus);
  const pair = pairs.find((p) => p.entry.source === '238');
  check('L5: found a real 238 entry to test against', !!pair);
  if (!pair) return;

  const body = labeler.buildRequestBody(pair.entry, pair.fileMeta);

  for (const qid of ['is_fork', 'already_answered', 'relevant']) {
    const q = body.questions[qid];
    const p = POLICIES_BY_ID[qid];
    check('L5 (' + qid + '): instructions.rule deep-equals the policy instructions', q.instructions.rule === p.instructions);
    check(
      'L5 (' + qid + '): boundary_cases deep-equals the policy boundary_cases',
      JSON.stringify(q.instructions.boundary_cases) === JSON.stringify(p.boundary_cases)
    );
    check('L5 (' + qid + '): criteria.true deep-equals the policy criteria.true', q.criteria.true === p.criteria.true);
    check('L5 (' + qid + '): criteria.false deep-equals the policy criteria.false', q.criteria.false === p.criteria.false);
    check('L5 (' + qid + '): instructions.question is at most 400 chars', q.instructions.question.length <= 400);
  }
}

// ---------------------------------------------------------------------------
// L6: mapping and verdict combination.
// ---------------------------------------------------------------------------
function legL6() {
  console.log('--- L6: mapping ---');

  check('L6: mapNoul(0.8) === yes', labeler.mapNoul(0.8) === 'yes');
  check('L6: mapNoul(0.2) === no', labeler.mapNoul(0.2) === 'no');
  check('L6: mapNoul(0.5) === uncertain', labeler.mapNoul(0.5) === 'uncertain');
  check('L6: mapNoul(undefined) === error', labeler.mapNoul(undefined) === 'error');

  check(
    'L6: deriveVerdict(fork=yes, answered=no, relevant=yes) === block',
    labeler.deriveVerdict({ is_fork: 'yes', already_answered: 'no', relevant: 'yes' }) === 'block'
  );
  check(
    'L6: deriveVerdict(fork=no, *) === pass',
    labeler.deriveVerdict({ is_fork: 'no', already_answered: 'yes', relevant: 'yes' }) === 'pass'
  );
  check(
    'L6: deriveVerdict(*, answered=yes, *) === pass',
    labeler.deriveVerdict({ is_fork: 'yes', already_answered: 'yes', relevant: 'yes' }) === 'pass'
  );
  check(
    'L6: deriveVerdict(*, *, relevant=no) === pass',
    labeler.deriveVerdict({ is_fork: 'yes', already_answered: 'no', relevant: 'no' }) === 'pass'
  );
  check(
    'L6: deriveVerdict(uncertain mix) === uncertain',
    labeler.deriveVerdict({ is_fork: 'uncertain', already_answered: 'no', relevant: 'yes' }) === 'uncertain'
  );
}

// ---------------------------------------------------------------------------
// L7: report hygiene. No entry text ever reaches the report; the
// never-auto-applied statement is present.
// ---------------------------------------------------------------------------
function legL7() {
  console.log('--- L7: report hygiene ---');

  const SENTINEL = 'SENTINEL_357_ENTRY_TEXT_MUST_NOT_APPEAR';
  const rows = [
    {
      id: 'sentinel-row-1',
      source: '238',
      hand_label: 'pass',
      raw: { is_fork: 0.1, already_answered: 0.9, relevant: 0.1 },
      mapped: { is_fork: 'no', already_answered: 'yes', relevant: 'no' },
      verdict: 'pass',
      status: 'labeled',
      __leak_check_only: SENTINEL,
    },
    {
      id: 'sentinel-row-2',
      source: 'debug',
      hand_label: 'block',
      raw: { is_fork: 0.9, already_answered: 0.1, relevant: 0.9 },
      mapped: { is_fork: 'yes', already_answered: 'no', relevant: 'yes' },
      verdict: 'block',
      status: 'labeled',
    },
  ];
  const report = labeler.renderReport(rows, { timestamp: 'x', model: 'jev-latest', policySha256: 'abc' });
  check('L7: the report does not contain the sentinel entry text', report.indexOf(SENTINEL) === -1);
  check('L7: the report contains the never-auto-applied statement', report.indexOf('never auto-applied') !== -1);
  check('L7: the report lists both row ids', report.indexOf('sentinel-row-1') !== -1 && report.indexOf('sentinel-row-2') !== -1);
}

// ---------------------------------------------------------------------------
// L8: vendor scan with negative control (SPEC R3 acceptance, no runtime
// Jev). No non-comment line under lib/ or hooks/ references the vendor or
// any 357 dev script; a scratch file outside lib/hooks carrying the literal
// is caught by the same scan (proof the scan is not vacuous).
// ---------------------------------------------------------------------------
const VENDOR_TOKENS = [
  'api.typesafe.ai',
  'TYPESAFE_API_KEY',
  'jev-devtime-client',
  'label-card-fire-replay',
  'replay-card-fire',
  'extract-dogfood-stop-events',
  'card-fire-replay-corpus',
];

function isPureLineComment(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

function listFilesRecursive(dirAbs) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dirAbs, { withFileTypes: true }); } catch (_e) { return out; }
  for (const e of entries) {
    const abs = path.join(dirAbs, e.name);
    if (e.isDirectory()) out.push(...listFilesRecursive(abs));
    else if (e.isFile()) out.push(abs);
  }
  return out;
}

function nonCommentContainsAnyToken(fileAbs, tokens) {
  let raw;
  try { raw = fs.readFileSync(fileAbs, 'utf8'); } catch (_e) { return null; }
  for (const line of raw.split(/\r?\n/)) {
    if (isPureLineComment(line)) continue;
    const code = line.replace(/(^|[^:])\/\/.*$/, '$1');
    for (const t of tokens) {
      if (code.indexOf(t) !== -1) return t;
    }
  }
  return null;
}

function legL8() {
  console.log('--- L8: vendor scan with negative control ---');

  const scanned = listFilesRecursive(path.join(REPO, 'lib')).concat(listFilesRecursive(path.join(REPO, 'hooks')));
  check('L8: at least one file scanned (not a vacuous zero-file pass)', scanned.length > 0);

  let hit = null;
  for (const f of scanned) {
    const t = nonCommentContainsAnyToken(f, VENDOR_TOKENS);
    if (t) { hit = { file: f, token: t }; break; }
  }
  check('L8: no non-comment lib/ or hooks/ line references any vendor token', !hit);
  if (hit) console.log('  hit: ' + path.relative(REPO, hit.file) + ' (' + hit.token + ')');

  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), '357-labeler-negctl-'));
  const scratchPath = path.join(scratchDir, 'scratch.cjs');
  fs.writeFileSync(scratchPath, "'use strict';\nconst ENDPOINT = 'https://api.typesafe.ai/v1/systemone';\nmodule.exports = { ENDPOINT };\n");
  const negHit = nonCommentContainsAnyToken(scratchPath, VENDOR_TOKENS);
  check('L8: negative control (a file outside lib/hooks carrying the literal) is caught by the same scan', negHit === 'api.typesafe.ai');
  fs.rmSync(scratchDir, { recursive: true, force: true });
}

(async function run() {
  legL1();
  legL2();
  legL3();
  await legL4();
  legL5();
  legL6();
  legL7();
  legL8();

  check('NET_ATTEMPTS === 0', NET_ATTEMPTS === 0);

  console.log('');
  console.log('PASS=' + PASS + ' FAIL=' + FAIL);
  process.exit(FAIL === 0 ? 0 : 1);
})();
