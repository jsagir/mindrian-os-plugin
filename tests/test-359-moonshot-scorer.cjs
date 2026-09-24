#!/usr/bin/env node
'use strict';
/**
 * Phase 359 Plan 04 Task 2 (N-3, FORK359-09): proves
 * scripts/score-moonshots-359.cjs refuses every non-synthetic,
 * non-authored input BEFORE any request is built, runs keyless with exit 0,
 * enforces the real fork359_moonshot egress profile (caps, must_equal_file,
 * question type, question ids, question sentence cap), derives every rule,
 * level and boundary string from the policy file, degrades gracefully on a
 * malformed answer, writes a report with no context text, and that the
 * additive fork359_moonshot profile changed nothing else in
 * EGRESS_PROFILES.
 *
 * Test hygiene contract (the 356/357 pattern): the developer shell exports
 * TYPESAFE_API_KEY, so this file starts by deleting it and replacing
 * globalThis.fetch with a counting thrower before any other require of
 * repo code. NET_ATTEMPTS === 0 is asserted last. Every spawned child also
 * deletes TYPESAFE_API_KEY, gets HOME pointed at a fresh mkdtemp dir, and
 * preloads a script that prints NETWORK_ATTEMPT_359 on any fetch attempt.
 *
 * House rule: hyphens only, no em-dashes.
 */

delete process.env.TYPESAFE_API_KEY;
let NET_ATTEMPTS = 0;
globalThis.fetch = function noNetwork359() {
  NET_ATTEMPTS += 1;
  throw new Error('no network in 359 moonshot scorer tests');
};

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const SCRIPT_PATH = path.join(REPO, 'scripts', 'score-moonshots-359.cjs');

const scorer = require(SCRIPT_PATH);
const client = require(path.join(REPO, 'scripts', 'jev-devtime-client.cjs'));

const { EGRESS_PROFILES } = client;
const PROFILE = EGRESS_PROFILES.fork359_moonshot;
const POLICY_PATH = path.join(REPO, PROFILE.must_equal_file.policy);
const POLICY_RAW = fs.readFileSync(POLICY_PATH, 'utf8');
const POLICY_JSON = JSON.parse(POLICY_RAW);
const POLICIES_BY_ID = {};
for (const p of POLICY_JSON.policies) POLICIES_BY_ID[p.policy_id] = p;

// PLAN_BASE: HEAD before this plan's Task 1 edited jev-devtime-client.cjs
// (the additive fork359_moonshot profile). Every other EGRESS_PROFILES
// entry must be JSON-identical to what it was at this commit.
const PLAN_BASE = 'a44615a06085ea9f478523339a1cfa1320e45333';

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

console.log('test-359-moonshot-scorer');

// ---------------------------------------------------------------------------
// S1: keyless spawn exits 0, prints "unlabeled", writes the report, zero
// network attempts.
// ---------------------------------------------------------------------------
function legS1() {
  console.log('--- S1: keyless CLI run exits 0 ---');

  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), '359-scorer-home-'));
  const tmpReportDir = fs.mkdtempSync(path.join(os.tmpdir(), '359-scorer-report-'));
  const reportPath = path.join(tmpReportDir, 'm.md');
  const preloadDir = fs.mkdtempSync(path.join(os.tmpdir(), '359-scorer-preload-'));
  const preloadPath = path.join(preloadDir, 'preload.cjs');
  fs.writeFileSync(preloadPath, [
    "'use strict';",
    'delete process.env.TYPESAFE_API_KEY;',
    'globalThis.fetch = function noNetwork359Child() {',
    "  process.stderr.write('NETWORK_ATTEMPT_359\\n');",
    "  throw new Error('no network in 359 moonshot scorer tests');",
    '};',
    '',
  ].join('\n'));

  const env = Object.assign({}, process.env);
  delete env.TYPESAFE_API_KEY;
  env.HOME = tmpHome;
  env.NODE_OPTIONS = ((env.NODE_OPTIONS || '') + ' --require ' + preloadPath).trim();

  const res = spawnSync(process.execPath, [SCRIPT_PATH, '--fixtures', '--report', reportPath], { env: env, encoding: 'utf8' });
  check('S1: exit code is 0', res.status === 0);
  check('S1: stdout contains "unlabeled"', /unlabeled/.test(res.stdout || ''));
  check('S1: the report file exists', fs.existsSync(reportPath));
  const reportContent = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '';
  check('S1: the report contains "unlabeled"', /unlabeled/.test(reportContent));
  check('S1: stderr has no NETWORK_ATTEMPT_359', !/NETWORK_ATTEMPT_359/.test(res.stderr || ''));

  fs.rmSync(tmpHome, { recursive: true, force: true });
  fs.rmSync(tmpReportDir, { recursive: true, force: true });
  fs.rmSync(preloadDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// S2: guard enforcement through the REAL fork359_moonshot profile, on a body
// built from an in-test synthetic row (independent of the committed
// prose-forks-359.json fixture, which lands in the same wave). A valid
// body passes; six single-field mutations each throw EGRESS_REFUSED, and
// routing each mutated body through client.jev() with a fetchImpl spy
// leaves the spy's call count at 0.
// ---------------------------------------------------------------------------
async function legS2() {
  console.log('--- S2: guard enforcement through the real profile ---');

  const row = {
    id: 'in-test-row-1',
    context: 'A decision context authored for this test only.',
    labels: ['Option A', 'Option B', 'What if we tried something else entirely'],
  };
  const guard = client.makeEgressGuard(PROFILE, { root: REPO });
  const validBody = scorer.buildScoreBody(row, POLICY_RAW);
  check('S2: guard returns true for a body built by buildScoreBody', guard(validBody) === true);

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
      label: 'context of 2001 chars',
      key: 'context',
      body: mutated((b) => { b.state.context = 'a'.repeat(2001); }),
    },
    {
      label: 'a question whose type is noul',
      key: 'relevant_to_context',
      body: mutated((b) => { b.questions.relevant_to_context.type = 'noul'; }),
    },
    {
      label: 'a third question id',
      key: 'extra_question',
      body: mutated((b) => { b.questions.extra_question = JSON.parse(JSON.stringify(b.questions.relevant_to_context)); }),
    },
    {
      label: 'a question sentence over 400 chars',
      key: 'relevant_to_context',
      body: mutated((b) => { b.questions.relevant_to_context.instructions.question = 'a'.repeat(401); }),
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
    check('S2 (' + c.label + '): guard throws', threw);
    check('S2 (' + c.label + '): err.code === EGRESS_REFUSED', errCode === 'EGRESS_REFUSED');
    check('S2 (' + c.label + '): err.key names the offending field', String(errKey || '').indexOf(c.key) !== -1);

    let spyCalls = 0;
    async function spyFetch() { spyCalls += 1; throw new Error('spy should never be called'); }
    let rejected = false;
    try {
      await client.jev(c.body, { key: 'k', guard: guard, fetchImpl: spyFetch });
    } catch (e) {
      rejected = e && e.code === 'EGRESS_REFUSED';
    }
    check('S2 (' + c.label + '): jev() rejects through the guard', rejected);
    check('S2 (' + c.label + '): the fetchImpl spy was never called', spyCalls === 0);
  }
}

// ---------------------------------------------------------------------------
// S3: every rule, level and boundary string in a built body deep-equals the
// policy file.
// ---------------------------------------------------------------------------
function legS3() {
  console.log('--- S3: questions derive from the policy ---');

  const rows = scorer.selectRows({ fixtures: true });
  check('S3: found at least one synthetic-359 fixture row', rows.length > 0);
  if (rows.length === 0) return;

  const body = scorer.buildScoreBody(rows[0], POLICY_RAW);

  for (const qid of ['relevant_to_context', 'radical_departure']) {
    const q = body.questions[qid];
    const p = POLICIES_BY_ID[qid];
    check('S3 (' + qid + '): instructions.rule deep-equals the policy instructions', q.instructions.rule === p.instructions);
    check(
      'S3 (' + qid + '): boundary_cases deep-equals the policy boundary_cases',
      JSON.stringify(q.instructions.boundary_cases) === JSON.stringify(p.boundary_cases)
    );
    check('S3 (' + qid + '): criteria deep-equals the policy levels', JSON.stringify(q.criteria) === JSON.stringify(p.levels));
    check('S3 (' + qid + '): instructions.question is at most 400 chars', q.instructions.question.length <= 400);
    check('S3 (' + qid + '): criteria has exactly 5 levels', Array.isArray(q.criteria) && q.criteria.length === 5);
  }
}

// ---------------------------------------------------------------------------
// S4: refusals before any body is built. Three legs, each with the spy
// count staying at 0.
// ---------------------------------------------------------------------------
function legS4() {
  console.log('--- S4: refusals before any body is built ---');

  const before = NET_ATTEMPTS;

  // S4a: --fixtures pointed at a different file.
  let threwA = false;
  let msgA = '';
  try {
    scorer.selectRows({ fixtures: 'tests/fixtures/card-fire-replay/dogfood.json' });
  } catch (e) { threwA = true; msgA = String(e && e.message); }
  check('S4a: selectRows throws for a non-synthetic-359 fixture path', threwA);
  check('S4a: refusal message starts with "refused"', msgA.indexOf('refused') === 0);

  // S4b: a results row with an unknown scenario id.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), '359-scorer-results-'));
  const scenariosPath = path.join(tmpDir, 'scenarios.json');
  fs.writeFileSync(scenariosPath, JSON.stringify({ scenarios: [{ id: 'fwd-fork-01', turns: ['turn one', 'turn two'] }] }));
  const resultsPath = path.join(tmpDir, 'results.jsonl');
  fs.writeFileSync(resultsPath, JSON.stringify({
    scenario_id: 'fwd-fork-unknown-99', arm: 'pre', run: 1,
    declared: true, declared_labels: ['A', 'B', 'What if z'],
  }) + '\n');
  let threwB = false;
  let msgB = '';
  try {
    scorer.selectRows({ fromResults: resultsPath, scenariosPath: scenariosPath });
  } catch (e) { threwB = true; msgB = String(e && e.message); }
  check('S4b: selectRows throws for an unknown scenario id', threwB);
  check('S4b: refusal message starts with "refused"', msgB.indexOf('refused') === 0);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // S4c: a fixture entry whose source is not synthetic-359 (injected root,
  // never touches the committed fixture).
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), '359-scorer-root-'));
  const fixDir = path.join(tmpRoot, 'tests', 'fixtures', 'card-fire-replay');
  fs.mkdirSync(fixDir, { recursive: true });
  fs.writeFileSync(path.join(fixDir, 'prose-forks-359.json'), JSON.stringify({
    meta: { source: 'synthetic-359' },
    entries: [{
      id: 'bad-source-1', source: 'dogfood', prose_fork: true,
      fork_labels: ['A', 'B', 'What if z'], envelope: { output_text: 'sentinel context' },
    }],
  }));
  let threwC = false;
  let msgC = '';
  try {
    scorer.selectRows({ fixtures: true, root: tmpRoot });
  } catch (e) { threwC = true; msgC = String(e && e.message); }
  check('S4c: selectRows throws for an entry whose source is not synthetic-359', threwC);
  check('S4c: refusal message starts with "refused"', msgC.indexOf('refused') === 0);
  fs.rmSync(tmpRoot, { recursive: true, force: true });

  check('S4: no fetch was attempted across all three legs', NET_ATTEMPTS === before);
}

// ---------------------------------------------------------------------------
// S5: renderReport hygiene. Context text never reaches the report; the
// never-auto-applied statement is present.
// ---------------------------------------------------------------------------
function legS5() {
  console.log('--- S5: report hygiene ---');

  const SENTINEL = 'SENTINEL_359_CONTEXT_TEXT_MUST_NOT_APPEAR';
  const rows = [
    {
      id: 'sentinel-row-1',
      moonshot: 'What if we did something else',
      relevant: { score: 3.2, confidence: 0.7 },
      radical: { score: 4.1, confidence: 0.6 },
      status: 'labeled',
      __leak_check_only_context: SENTINEL,
    },
    {
      id: 'sentinel-row-2',
      moonshot: 'What if we waited a cycle',
      relevant: null,
      radical: null,
      status: 'unlabeled',
    },
  ];
  const report = scorer.renderReport(rows, { timestamp: 'x', model: 'jev-latest', policySha256: 'abc' });
  check('S5: the report does not contain the sentinel context text', report.indexOf(SENTINEL) === -1);
  check('S5: the report contains the never-auto-applied statement', report.indexOf('never auto-applied') !== -1);
  check('S5: the report lists both row ids', report.indexOf('sentinel-row-1') !== -1 && report.indexOf('sentinel-row-2') !== -1);
  check('S5: the report includes both moonshot labels', report.indexOf('What if we did something else') !== -1 && report.indexOf('What if we waited a cycle') !== -1);

  const appended = scorer.renderReport(rows, { timestamp: 'y' }, { append: true, section: 'Second run' });
  check('S5: an append render starts with the section header', appended.trim().startsWith('## Second run'));
}

// ---------------------------------------------------------------------------
// S6: every EGRESS_PROFILES entry other than fork359_moonshot is
// JSON-identical to the one at PLAN_BASE.
// ---------------------------------------------------------------------------
function legS6() {
  console.log('--- S6: no other profile changed ---');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), '359-scorer-planbase-'));
  const showResult = spawnSync('git', ['show', PLAN_BASE + ':scripts/jev-devtime-client.cjs'], { cwd: REPO, encoding: 'utf8' });
  check('S6: git show against PLAN_BASE succeeded', showResult.status === 0);
  if (showResult.status !== 0) { fs.rmSync(tmpDir, { recursive: true, force: true }); return; }

  const copyPath = path.join(tmpDir, 'jev-devtime-client-planbase.cjs');
  fs.writeFileSync(copyPath, showResult.stdout);
  delete require.cache[require.resolve(copyPath)];
  const planBaseClient = require(copyPath);

  const planBaseProfileIds = Object.keys(planBaseClient.EGRESS_PROFILES);
  check('S6: fork359_moonshot is not present at PLAN_BASE', planBaseProfileIds.indexOf('fork359_moonshot') === -1);
  check('S6: fork359_moonshot is present on HEAD', Object.keys(EGRESS_PROFILES).indexOf('fork359_moonshot') !== -1);

  let allMatch = true;
  for (const id of planBaseProfileIds) {
    const same = JSON.stringify(EGRESS_PROFILES[id]) === JSON.stringify(planBaseClient.EGRESS_PROFILES[id]);
    check('S6 (' + id + '): JSON-identical to PLAN_BASE', same);
    if (!same) allMatch = false;
  }
  check('S6: every pre-existing profile is unchanged', allMatch);
  check('S6: HEAD carries exactly one more profile than PLAN_BASE', Object.keys(EGRESS_PROFILES).length === planBaseProfileIds.length + 1);

  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// S7: no non-comment lib/ or hooks/ line references the vendor endpoint or
// this script's own name (negative control proves the scan is not vacuous).
// ---------------------------------------------------------------------------
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

const VENDOR_TOKENS = ['api.typesafe.ai', 'TYPESAFE_API_KEY', 'score-moonshots-359', 'jev-devtime-client'];

function legS7() {
  console.log('--- S7: vendor scan with negative control ---');

  const scanned = listFilesRecursive(path.join(REPO, 'lib')).concat(listFilesRecursive(path.join(REPO, 'hooks')));
  check('S7: at least one file scanned (not a vacuous zero-file pass)', scanned.length > 0);

  let hit = null;
  for (const f of scanned) {
    const t = nonCommentContainsAnyToken(f, VENDOR_TOKENS);
    if (t) { hit = { file: f, token: t }; break; }
  }
  check('S7: no non-comment lib/ or hooks/ line references any vendor token', !hit);
  if (hit) console.log('  hit: ' + path.relative(REPO, hit.file) + ' (' + hit.token + ')');

  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), '359-scorer-negctl-'));
  const scratchPath = path.join(scratchDir, 'scratch.cjs');
  fs.writeFileSync(scratchPath, "'use strict';\nconst ENDPOINT = 'https://api.typesafe.ai/v1/systemone';\nmodule.exports = { ENDPOINT };\n");
  const negHit = nonCommentContainsAnyToken(scratchPath, VENDOR_TOKENS);
  check('S7: negative control (a file outside lib/hooks carrying the literal) is caught by the same scan', negHit === 'api.typesafe.ai');
  fs.rmSync(scratchDir, { recursive: true, force: true });
}

(async function run() {
  legS1();
  await legS2();
  legS3();
  legS4();
  legS5();
  legS6();
  legS7();

  check('NET_ATTEMPTS === 0', NET_ATTEMPTS === 0);

  console.log('');
  console.log('PASS=' + PASS + ' FAIL=' + FAIL);
  process.exit(FAIL === 0 ? 0 : 1);
})();
