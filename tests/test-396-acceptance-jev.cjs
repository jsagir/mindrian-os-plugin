#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 392 Plan 13 Task 3: the acceptance script as a Jev leg, pinned
 * offline (the pattern of tests/test-355-jev-ceilings.cjs: the script's
 * structure, its egress profile and its exit gates are proven without a key
 * and without the live Brain).
 *
 * The script under test is scripts/part8-shape-acceptance.cjs. Offline it
 * runs as a subprocess against the shared capture server
 * (tests/helpers/brain-capture-server.cjs) whose brain_ask and
 * recommend_chain replies are FUNCTIONS of the call arguments (a bare
 * {question} gets the lexical reply, a shaped {question, shape} the boosted
 * one) and against a fake Jev endpoint in this process (MINDRIAN_JEV_ENDPOINT,
 * a synthetic key). No real key is read: HOME is a temp folder, so the
 * secrets file lookup finds nothing unless the arm sets the variable.
 *
 * Arms:
 *   J1  the pure comparison: wins, loses (each criterion), same, no-lead.
 *   J2  --out inside the repository exits 2 and sends nothing.
 *   J3  schema A (shape not advertised) exits 77 with a SKIP line and sends
 *       no brain_ask.
 *   J4  an unreachable Brain exits 77 with a SKIP line.
 *   J5  schema B, key present (fake Jev): exit 0; the output file holds the
 *       four comparisons, bare wire [question], shaped wire [question, shape],
 *       the Jev answer; the Jev request carried only the profile's state keys
 *       and no snippet text; the output holds no snippet text.
 *   J6  schema B, no key: exit 77 with a SKIP line after the comparison is
 *       written.
 *   J7  schema B, Theo does not boost on the shaped call: exit 1 naming
 *       grounding_order.
 *   J8  schema B, no lead for the type (rank1_leads_total 0): coverage
 *       no_lead, exit 0, the note names it.
 *   J9  the script is never required from lib/ or hooks/.
 *   J0  no em dash or en dash in the script and in this file.
 *
 * --live: run the script against the configured Brain (MINDRIAN_BRAIN_URL or
 * the default) with the real key lookup; this test exits 77 itself with a
 * SKIP line when the script skips (no key or no shape-advertising Brain).
 *
 * No em dash or en dash anywhere (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'part8-shape-acceptance.cjs');
const FIXTURE_ROOM_A = path.join(REPO_ROOT, 'tests', 'fixtures', '392-shape-rooms', 'room-a');
const LIVE = process.argv.indexOf('--live') !== -1;

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos392-13-acc-'));
const HOME = path.join(TMP, 'home');
fs.mkdirSync(HOME);
const OUT_DIR = path.join(TMP, 'out');
fs.mkdirSync(OUT_DIR);

const GENERIC = 'what is jobs to be done';
const SNIPPET_LEX = 'a lexical row about canvases';
const SNIPPET_BOOST = 'a boosted row about jobs';

// ---- harness ----------------------------------------------------------------
let passed = 0;
let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('ok   - ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL - ' + name + '\n  ' + (e && e.message ? e.message : String(e)).split('\n').join('\n  '));
  }
}

// ---- summaries for the pure comparison (J1) --------------------------------
function summary(over) {
  return Object.assign({
    problem_type_source: 'signal',
    grounding_order: 'shape_boosted',
    rows_shape_match_count: 2,
    chain_coverage: { steps_returned: 3, steps_requested: 4, rank1_leads_total: 3, rank1_leads_returned: 3, full: true },
    coverage_label: 'full',
    option_order: 'theo_rank',
    options: [{ framework: 'Alpha', theo_rank: 1 }, { framework: 'Beta', theo_rank: 2 }, { framework: 'Gamma', theo_rank: 3 }],
  }, over || {});
}
const BARE = summary({
  problem_type_source: 'heuristic', grounding_order: 'lexical', rows_shape_match_count: 0,
  chain_coverage: { steps_returned: 2, steps_requested: 4, rank1_leads_total: 3, rank1_leads_returned: 1, full: false },
  coverage_label: 'partial',
});

// ---- capture server replies --------------------------------------------------
function sse(payload) {
  return 'data: ' + JSON.stringify({
    jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: JSON.stringify(payload) }] },
  }) + '\n';
}
const SHAPE_SCHEMA = { type: 'object', properties: { schema_version: { type: 'number', const: 1 } } };
const SCHEMA_A = [
  { name: 'brain_ask', inputSchema: { type: 'object', properties: { question: { type: 'string' } } } },
  { name: 'recommend_chain', inputSchema: { type: 'object', properties: { problem_type: { type: 'string' }, max_steps: { type: 'integer' } } } },
];
const SCHEMA_B = [
  { name: 'brain_ask', inputSchema: { type: 'object', properties: { question: { type: 'string' }, shape: SHAPE_SCHEMA } } },
  { name: 'recommend_chain', inputSchema: { type: 'object', properties: { problem_type: { type: 'string' }, max_steps: { type: 'integer' }, shape: SHAPE_SCHEMA } } },
];
const ASK_LEXICAL = {
  answer_mode: 'structured_rows',
  rows: [{ chapterId: 'ch02', section: 'OVERVIEW', score: 1.2, snippet: SNIPPET_LEX }, { chapterId: 'ch03', section: 'FRAMEWORK', score: 1.1, snippet: SNIPPET_LEX }],
  grounding_order: 'lexical',
};
const ASK_BOOSTED = {
  answer_mode: 'structured_rows',
  rows: [{ chapterId: 'ch03', section: 'FRAMEWORK', score: 2.4, snippet: SNIPPET_BOOST, shape_match: true }, { chapterId: 'ch05', section: 'METHOD', score: 2.0, snippet: SNIPPET_BOOST, shape_match: true }, { chapterId: 'ch02', section: 'OVERVIEW', score: 1.2, snippet: SNIPPET_LEX, shape_match: false }],
  grounding_order: 'shape_boosted',
};
const CHAIN_PARTIAL = {
  tool: 'recommend_chain', grounded: true,
  chain: [{ step: 1, framework: 'Alpha', rank: 1, degree: 10 }, { step: 2, framework: 'Beta', rank: 2, degree: 6 }],
  chain_coverage: { steps_returned: 2, steps_requested: 4, rank1_leads_total: 3, rank1_leads_returned: 1, full: false },
  evidence: { linked_frameworks_for_type: 46 },
};
const CHAIN_FULL = {
  tool: 'recommend_chain', grounded: true,
  chain: [{ step: 1, framework: 'Alpha', rank: 1, degree: 10 }, { step: 2, framework: 'Beta', rank: 2, degree: 6 }, { step: 3, framework: 'Gamma', rank: 3, degree: 3 }],
  chain_coverage: { steps_returned: 3, steps_requested: 4, rank1_leads_total: 3, rank1_leads_returned: 3, full: true },
  evidence: { linked_frameworks_for_type: 46 },
};
const CHAIN_NO_LEAD = Object.assign({}, CHAIN_FULL, {
  chain_coverage: { steps_returned: 3, steps_requested: 4, rank1_leads_total: 0, rank1_leads_returned: 0, full: false },
});
const QUERY_REPLY = { records: [] };

const capture = require(path.join(REPO_ROOT, 'tests', 'helpers', 'brain-capture-server.cjs'));
function scenario(schema, shapedAsk, shapedChain) {
  capture.resetCaptured();
  capture.resetToolList();
  capture.setToolList(schema);
  capture.resetToolScript();
  capture.setToolReplies({
    brain_ask: function (args) { return { body: sse(args && args.shape ? shapedAsk : ASK_LEXICAL) }; },
    recommend_chain: function (args) { return { body: sse(args && args.shape ? shapedChain : CHAIN_PARTIAL) }; },
    brain_query: { body: sse(QUERY_REPLY) },
  });
}
function askBodies() {
  return capture.captured.filter(function (c) { return c.name === 'brain_ask'; }).map(function (c) { return c.arguments; });
}

// ---- fake Jev endpoint -----------------------------------------------------------
const jevRequests = [];
function startFakeJev() {
  const server = http.createServer(function (req, res) {
    let body = '';
    req.on('data', function (d) { body += d; });
    req.on('end', function () {
      jevRequests.push({ auth: req.headers.authorization || '', body: body });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        model: 'jev-1.13.0',
        answers: { better: { type: 'choice', choice: 'b', probabilities: { a: 0.1, b: 0.8, same: 0.1 }, confidence: 0.8 } },
        usage: { input_tokens: 120, output_tokens: 6 },
      }));
    });
  });
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () { resolve({ server: server, url: 'http://127.0.0.1:' + server.address().port }); });
  });
}
function closedPort() {
  return new Promise(function (resolve) {
    const s = http.createServer();
    s.listen(0, '127.0.0.1', function () {
      const port = s.address().port;
      s.close(function () { resolve('http://127.0.0.1:' + port); });
    });
  });
}

// ---- subprocess driver ---------------------------------------------------------
// Asynchronous on purpose: the capture server and the fake Jev live in THIS
// process, so a blocking spawnSync would starve them and every child request
// would time out (the child would then report the Brain as unreachable).
function runScript(args, env) {
  const childEnv = Object.assign({}, process.env, {
    HOME: HOME, USERPROFILE: HOME,
    MINDRIAN_BRAIN_KEY: 'synthetic-392-13-acceptance-key',
  });
  // The real key never reaches a child; an arm that wants a key sets a
  // synthetic one in `env` after this scrub.
  delete childEnv.TYPESAFE_API_KEY;
  delete childEnv.CLAUDE_CODE_SESSION_ID;
  delete childEnv.CLAUDE_ACTIVE_ROOM;
  delete childEnv.MINDRIAN_BRAIN_SHAPE;
  Object.assign(childEnv, env || {});
  Object.keys(env || {}).forEach(function (k) { if (env[k] === null) delete childEnv[k]; });
  return new Promise(function (resolve) {
    const child = spawn(process.execPath, [SCRIPT].concat(args), { cwd: REPO_ROOT, env: childEnv });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', function (d) { stdout += d; });
    child.stderr.on('data', function (d) { stderr += d; });
    const timer = setTimeout(function () { try { child.kill('SIGKILL'); } catch (_e) { /* gone */ } }, 120000);
    child.on('close', function (code) { clearTimeout(timer); resolve({ code: code, stdout: stdout, stderr: stderr }); });
  });
}
function outFile(name) { return path.join(OUT_DIR, name + '.json'); }
function readOut(name) { return JSON.parse(fs.readFileSync(outFile(name), 'utf8')); }
function hasSkipLine(text) { return text.split('\n').some(function (l) { return l.startsWith('SKIP'); }); }

// ---- main ---------------------------------------------------------------------
async function main() {
  if (LIVE) return liveLeg();

  const acc = require(SCRIPT);

  await check('J1 compare(): wins on all four; loses on each criterion by itself; same coverage; no-lead coverage', function () {
    const win = acc.compare(BARE, summary());
    assert.deepStrictEqual(win.lost, [], JSON.stringify(win));
    assert.strictEqual(win.exit_code, 0);
    assert.strictEqual(win.criteria.problem_type_source.result, 'win');
    assert.strictEqual(win.criteria.grounding_order.result, 'win');
    assert.strictEqual(win.criteria.coverage.result, 'win');
    assert.strictEqual(win.criteria.ordering.result, 'pass');

    const l1 = acc.compare(BARE, summary({ problem_type_source: 'heuristic' }));
    assert.deepStrictEqual(l1.lost, ['problem_type_source']);
    const l2 = acc.compare(BARE, summary({ grounding_order: 'lexical' }));
    assert.deepStrictEqual(l2.lost, ['grounding_order']);
    const l3 = acc.compare(BARE, summary({ chain_coverage: { rank1_leads_total: 3, rank1_leads_returned: 2, full: false } }));
    assert.deepStrictEqual(l3.lost, ['coverage']);
    const l4 = acc.compare(BARE, summary({ options: [{ framework: 'Beta', theo_rank: 2 }, { framework: 'Alpha', theo_rank: 1 }] }));
    assert.deepStrictEqual(l4.lost, ['ordering']);
    const l5 = acc.compare(summary({ problem_type_source: 'heuristic', grounding_order: 'lexical', option_order: 'command_bearing_first' }), summary());
    assert.deepStrictEqual(l5.lost, ['ordering'], 'the bare run must be consistent too');
    assert.strictEqual(l1.exit_code, 1);

    const same = acc.compare(summary({ problem_type_source: 'heuristic', grounding_order: 'lexical' }), summary());
    assert.strictEqual(same.criteria.coverage.result, 'same');
    assert.deepStrictEqual(same.lost, []);

    const noLead = acc.compare(BARE, summary({ chain_coverage: { steps_returned: 3, steps_requested: 4, rank1_leads_total: 0, rank1_leads_returned: 0, full: false }, coverage_label: 'no_lead_for_type' }));
    assert.strictEqual(noLead.criteria.coverage.result, 'no_lead');
    assert.ok(/no lead for this type/.test(noLead.criteria.coverage.note), noLead.criteria.coverage.note);
    assert.deepStrictEqual(noLead.lost, [], 'no-lead is neither a win nor a loss');
    assert.strictEqual(noLead.exit_code, 0);

    // The returned-equals-total form counts as full when the total is above 0.
    assert.strictEqual(acc.coverageIsFull({ rank1_leads_total: 2, rank1_leads_returned: 2 }), true);
    assert.strictEqual(acc.coverageIsFull({ rank1_leads_total: 0, rank1_leads_returned: 0 }), false);
    assert.strictEqual(acc.EXIT_SKIP, 77);
    assert.strictEqual(acc.isInsideRepo(path.join(REPO_ROOT, 'x.json'), REPO_ROOT), true);
    assert.strictEqual(acc.isInsideRepo(outFile('probe'), REPO_ROOT), false);
  });

  const started = await capture.startCaptureServer();
  const brainUrl = started.url;
  const jev = await startFakeJev();

  await check('J2 --out inside the repository exits 2 and sends nothing', async function () {
    scenario(SCHEMA_B, ASK_BOOSTED, CHAIN_FULL);
    const r = await runScript(['--question', GENERIC, '--room', FIXTURE_ROOM_A, '--out', path.join(REPO_ROOT, 'tests', 'should-not-exist-392.json')], { MINDRIAN_BRAIN_URL: brainUrl });
    assert.strictEqual(r.code, 2, 'exit: ' + r.code + ' ' + r.stdout + r.stderr);
    assert.ok(/inside the repository/.test(r.stderr), r.stderr);
    assert.strictEqual(capture.captured.length, 0, 'nothing sent');
    assert.ok(!fs.existsSync(path.join(REPO_ROOT, 'tests', 'should-not-exist-392.json')));
  });

  await check('J3 schema A (shape not advertised) exits 77 with a SKIP line and sends no brain_ask', async function () {
    scenario(SCHEMA_A, ASK_BOOSTED, CHAIN_FULL);
    const r = await runScript(['--question', GENERIC, '--room', FIXTURE_ROOM_A, '--out', outFile('j3')], { MINDRIAN_BRAIN_URL: brainUrl });
    assert.strictEqual(r.code, 77, 'exit: ' + r.code + ' ' + r.stdout + r.stderr);
    assert.ok(hasSkipLine(r.stdout), 'SKIP line: ' + r.stdout);
    assert.ok(/does not advertise shape/.test(r.stdout), r.stdout);
    assert.strictEqual(askBodies().length, 0, 'no brain_ask sent: ' + JSON.stringify(capture.captured));
    const out = readOut('j3');
    assert.strictEqual(out.probe.brain_ask_shape, false);
    assert.strictEqual(out.probe.reachable, true);
  });

  await check('J4 an unreachable Brain exits 77 with a SKIP line', async function () {
    const dead = await closedPort();
    const r = await runScript(['--question', GENERIC, '--room', FIXTURE_ROOM_A, '--out', outFile('j4')], { MINDRIAN_BRAIN_URL: dead });
    assert.strictEqual(r.code, 77, 'exit: ' + r.code + ' ' + r.stdout + r.stderr);
    assert.ok(hasSkipLine(r.stdout) && /unreachable/.test(r.stdout), r.stdout);
  });

  await check('J5 schema B with a key (fake Jev): exit 0, the four comparisons written, bare wire [question], shaped wire [question, shape], the Jev request carried the profile keys only and no snippet, the output holds no snippet', async function () {
    scenario(SCHEMA_B, ASK_BOOSTED, CHAIN_FULL);
    jevRequests.length = 0;
    const r = await runScript(['--question', GENERIC, '--room', FIXTURE_ROOM_A, '--out', outFile('j5'), '--human-verdict', 'b'],
      { MINDRIAN_BRAIN_URL: brainUrl, TYPESAFE_API_KEY: 'synthetic-jev-key-392-13', MINDRIAN_JEV_ENDPOINT: jev.url });
    assert.strictEqual(r.code, 0, 'exit: ' + r.code + '\n' + r.stdout + r.stderr);
    assert.ok(!hasSkipLine(r.stdout), 'no SKIP line with a key');
    const out = readOut('j5');
    assert.deepStrictEqual(Object.keys(out.comparisons).sort(), ['coverage', 'grounding_order', 'ordering', 'problem_type_source']);
    assert.strictEqual(out.comparisons.problem_type_source.result, 'win');
    assert.strictEqual(out.comparisons.grounding_order.result, 'win');
    assert.strictEqual(out.comparisons.grounding_order.shaped_rows_shape_match, 2);
    assert.strictEqual(out.comparisons.coverage.result, 'win');
    assert.strictEqual(out.comparisons.ordering.result, 'pass');
    assert.deepStrictEqual(out.wire.bare_brain_ask_keys, ['question']);
    assert.deepStrictEqual(out.wire.shaped_brain_ask_keys, ['question', 'shape']);
    assert.deepStrictEqual(out.captured.shaped.find(function (c) { return c.name === 'brain_ask'; }).arguments.shape, out.shape);
    assert.strictEqual(out.runs.bare.problem_type_source, 'heuristic');
    assert.strictEqual(out.runs.shaped.problem_type_source, 'signal');
    assert.strictEqual(out.runs.shaped.shape_source, 'room', 'the caller-built packet is the room packet');
    assert.strictEqual(out.runs.shaped.rows[0].id, 'ch03:FRAMEWORK');
    assert.strictEqual(out.lexicon_check.bare.ok, true);
    assert.strictEqual(out.lexicon_check.shaped.ok, true);
    assert.strictEqual(out.jev.ran, true);
    assert.strictEqual(out.jev.choice, 'b');
    assert.strictEqual(out.jev.model, 'jev-1.13.0');
    assert.deepStrictEqual(out.human_verdict, { verdict: 'b', a_is: 'bare', b_is: 'shaped' });
    assert.strictEqual(out.verdict.exit_code, 0);
    const outText = fs.readFileSync(outFile('j5'), 'utf8');
    assert.strictEqual(outText.indexOf(SNIPPET_LEX), -1, 'no snippet in the output');
    assert.strictEqual(outText.indexOf(SNIPPET_BOOST), -1, 'no snippet in the output');
    assert.strictEqual(outText.indexOf('synthetic-jev-key'), -1, 'the key is never written');

    assert.strictEqual(jevRequests.length, 1, 'one Jev request');
    const body = JSON.parse(jevRequests[0].body);
    assert.deepStrictEqual(Object.keys(body).sort(), ['model', 'questions', 'state']);
    assert.deepStrictEqual(Object.keys(body.state).sort(), ['a_rows', 'b_rows', 'problem_type', 'stage']);
    assert.strictEqual(body.model, 'jev-1.13.0');
    assert.strictEqual(body.state.problem_type, out.shape.problem_type);
    assert.strictEqual(body.state.stage, out.shape.stage);
    assert.strictEqual(body.state.a_rows, 'ch02:OVERVIEW, ch03:FRAMEWORK');
    assert.strictEqual(body.state.b_rows, 'ch03:FRAMEWORK, ch05:METHOD, ch02:OVERVIEW');
    assert.strictEqual(jevRequests[0].body.indexOf(SNIPPET_BOOST), -1, 'no snippet to Jev');
    assert.strictEqual(jevRequests[0].body.indexOf(GENERIC), -1, 'the question never goes to Jev');
    assert.deepStrictEqual(Object.keys(body.questions), ['better']);
    assert.deepStrictEqual(Object.keys(body.questions.better.criteria).sort(), ['a', 'b', 'same']);
    assert.strictEqual(jevRequests[0].auth, 'Bearer synthetic-jev-key-392-13');
  });

  await check('J6 schema B without a key: exit 77 with a SKIP line after the comparison is written', async function () {
    scenario(SCHEMA_B, ASK_BOOSTED, CHAIN_FULL);
    const r = await runScript(['--question', GENERIC, '--room', FIXTURE_ROOM_A, '--out', outFile('j6')], { MINDRIAN_BRAIN_URL: brainUrl });
    assert.strictEqual(r.code, 77, 'exit: ' + r.code + ' ' + r.stdout + r.stderr);
    assert.ok(hasSkipLine(r.stdout) && /TYPESAFE_API_KEY absent/.test(r.stdout), r.stdout);
    const out = readOut('j6');
    assert.strictEqual(out.comparisons.problem_type_source.result, 'win');
    assert.strictEqual(out.jev.ran, false);
    assert.strictEqual(out.verdict.exit_code, 0, 'the plain comparison is recorded');
  });

  await check('J7 schema B, Theo does not boost on the shaped call: exit 1 naming grounding_order', async function () {
    scenario(SCHEMA_B, ASK_LEXICAL, CHAIN_FULL);
    const r = await runScript(['--question', GENERIC, '--room', FIXTURE_ROOM_A, '--out', outFile('j7')],
      { MINDRIAN_BRAIN_URL: brainUrl, TYPESAFE_API_KEY: 'synthetic-jev-key-392-13', MINDRIAN_JEV_ENDPOINT: jev.url });
    assert.strictEqual(r.code, 1, 'exit: ' + r.code + ' ' + r.stdout + r.stderr);
    assert.ok(/lost: grounding_order/.test(r.stdout), r.stdout);
    const out = readOut('j7');
    assert.deepStrictEqual(out.verdict.lost, ['grounding_order']);
  });

  await check('J8 schema B, no lead for the type: coverage no_lead, exit 0, the note names it', async function () {
    scenario(SCHEMA_B, ASK_BOOSTED, CHAIN_NO_LEAD);
    const r = await runScript(['--question', GENERIC, '--room', FIXTURE_ROOM_A, '--out', outFile('j8')],
      { MINDRIAN_BRAIN_URL: brainUrl, TYPESAFE_API_KEY: 'synthetic-jev-key-392-13', MINDRIAN_JEV_ENDPOINT: jev.url });
    assert.strictEqual(r.code, 0, 'exit: ' + r.code + ' ' + r.stdout + r.stderr);
    const out = readOut('j8');
    assert.strictEqual(out.comparisons.coverage.result, 'no_lead');
    assert.ok(/no lead for this type/.test(out.comparisons.coverage.note));
    assert.strictEqual(out.runs.shaped.coverage_label, 'no_lead_for_type');
  });

  await check('J9 the acceptance script is never required from lib/ or hooks/', function () {
    const hits = [];
    function walk(dir) {
      fs.readdirSync(dir, { withFileTypes: true }).forEach(function (d) {
        const p = path.join(dir, d.name);
        if (d.isDirectory()) { if (d.name !== 'node_modules') walk(p); return; }
        if (!/\.(cjs|js|mjs|ts)$/.test(d.name)) return;
        if (fs.readFileSync(p, 'utf8').indexOf('part8-shape-acceptance') !== -1) hits.push(p);
      });
    }
    ['lib', 'hooks'].forEach(function (d) { if (fs.existsSync(path.join(REPO_ROOT, d))) walk(path.join(REPO_ROOT, d)); });
    assert.deepStrictEqual(hits, []);
  });

  await check('J0 no em dash or en dash in the script and in this file', function () {
    [SCRIPT, __filename].forEach(function (f) {
      const src = fs.readFileSync(f, 'utf8');
      assert.strictEqual(src.indexOf(String.fromCharCode(0x2014)), -1, 'em dash in ' + path.basename(f));
      assert.strictEqual(src.indexOf(String.fromCharCode(0x2013)), -1, 'en dash in ' + path.basename(f));
    });
  });

  await capture.stopCaptureServer(started.server);
  await new Promise(function (resolve) { jev.server.close(function () { resolve(); }); });
  console.log('\n' + passed + ' passed, ' + failed + ' failed.');
  if (failed > 0) {
    console.log('FAIL: test-396-acceptance-jev');
    process.exit(1);
  }
  console.log('PASS: test-396-acceptance-jev');
  process.exit(0);
}

// --live: the real script against the configured Brain with the real key
// lookup (HOME untouched). A script SKIP (77) is this test's SKIP.
function liveLeg() {
  const out = path.join(os.homedir(), '.mindrian', 'part8-acceptance', 'live-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  const res = spawnSync(process.execPath, [SCRIPT, '--question', GENERIC, '--room', FIXTURE_ROOM_A, '--out', out], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 180000 });
  process.stdout.write(res.stdout || '');
  process.stderr.write(res.stderr || '');
  if (res.status === 77) {
    console.log('SKIP test-396-acceptance-jev --live: the acceptance script skipped (no key or no shape-advertising Brain)');
    process.exit(77);
  }
  if (res.status === 0) { console.log('PASS: test-396-acceptance-jev --live'); process.exit(0); }
  console.log('FAIL: test-396-acceptance-jev --live (exit ' + res.status + ')');
  process.exit(1);
}

main().catch(function (e) {
  console.error('FATAL:', e && e.stack ? e.stack : e);
  process.exit(1);
});
