'use strict';
// Phase 359-05 -- tests/test-359-forward-harness.cjs: the R9 forward
// harness's offline proof (FORK359-09, SPEC R9, D-11, D-12, N-2, N-4, N-5,
// RESEARCH Findings 8-12, Pitfalls 6-9).
//
// This suite proves the R9 instrument WITHOUT spending a cent: parseRun's
// nine behaviors (a-i) over canned stream-json fixtures, preflight's five
// refusal shapes plus the pass shape, buildRunCommand's flag contract,
// buildRunEnv's hermeticity, evaluate's floor-guarded PASS/INCONCLUSIVE/
// FALSIFIED verdicts (with error-row exclusion), the default results path,
// and a live JSON-RPC round trip against the deny-all permission probe.
// --dry-run and the preflight refusal legs spawn the real CLI against a fake
// `claude` executable that answers ONLY `--version`; the fake never receives
// a full run invocation, proven by asserting its argv log file never gets
// created.
//
// Test hygiene: TYPESAFE_API_KEY stripped from every spawned child's env;
// HOME is redirected to a fresh mkdtemp per spawn that needs one; no real
// `claude` binary is ever invoked with anything but `--version` (and only
// through a FAKE claude on a PATH this test controls -- the one real `claude
// --version` allowed by the plan is never exercised by this file at all).
//
// No em-dashes anywhere (hyphens only, CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

delete process.env.TYPESAFE_API_KEY;

const REPO = path.join(__dirname, '..');
const HARNESS_PATH = path.join(REPO, 'scripts', 'forward-fork-scenarios-359.cjs');
const PROBE_PATH = path.join(REPO, 'scripts', 'fork359-permission-probe.cjs');
const STREAM_DIR = path.join(REPO, 'tests', 'fixtures', 'forward-fork-stream-359');

console.log('test-359-forward-harness');

let failures = 0;
let total = 0;
// async so a leg that returns a Promise (the probe round trip) is actually
// awaited before the next leg starts, not merely fired-and-forgotten.
async function ok(desc, fn) {
  total += 1;
  try {
    await fn();
    console.log('  ok   ' + desc);
  } catch (e) {
    failures += 1;
    console.log('  FAIL ' + desc + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const harness = require(HARNESS_PATH);

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function loadStream(name) {
  return harness.loadJsonl(path.join(STREAM_DIR, name + '.jsonl'));
}

const SAMPLE_META = {
  vacuity_floor: { min_pre_missed: 6, min_fraction_of_pre_fork_runs: 0.2 },
  caps: { per_run_usd: 0.40, total_usd: 60 },
};

function forkRow(id, arm, caught, extra) {
  return Object.assign(
    {
      scenario_id: id,
      arm: arm,
      poses_fork: true,
      status: 'ok',
      card: !!caught,
      declared: false,
      blocked_by_declared_arm: false,
      intercept_log_declared: 0,
    },
    extra || {}
  );
}

function controlRow(id, arm, blocked, extra) {
  return Object.assign(
    {
      scenario_id: id,
      arm: arm,
      poses_fork: false,
      status: 'ok',
      card: false,
      declared: false,
      blocked_by_declared_arm: !!blocked,
    },
    extra || {}
  );
}

function buildForkRows(prefix, arm, total_, missedCount) {
  const rows = [];
  for (let i = 0; i < total_; i += 1) {
    const missed = i < missedCount;
    rows.push(forkRow(prefix + '-' + i, arm, !missed));
  }
  return rows;
}

// ---------------------------------------------------------------------
// parseRun: behaviors a-i over canned streams (RESEARCH Finding 9, Pattern 5)
// ---------------------------------------------------------------------

// Every leg below runs inside one async IIFE so the probe round-trip leg
// (the only async leg) is genuinely awaited before the report at the bottom
// runs, instead of racing it.
(async function runAllLegs() {
  await ok('parseRun (a): AskUserQuestion tool_use in attempt 1 -> card true', function () {
  const events = loadStream('a-card-in-attempt1');
  const row = harness.parseRun(events, { id: 'a', poses_fork: true }, { tree: '/tmp/arm-tree-a', mode: 'probe' });
  assert.equal(row.status, 'ok');
  assert.equal(row.card, true);
  assert.equal(row.card_is_mode_menu, false);
  assert.deepEqual(row.card_options, ['Option A', 'Option B']);
});

  await ok('parseRun (b): declaration in attempt 1, Stop hook, then a re-prompt card -> declared true, card false', function () {
  const events = loadStream('b-declared-then-stop-then-card');
  const row = harness.parseRun(events, { id: 'b', poses_fork: true }, { tree: '/tmp/arm-tree-b', mode: 'probe' });
  assert.equal(row.status, 'ok');
  assert.equal(row.declared, true);
  assert.equal(row.card, false);
  assert.ok(Array.isArray(row.declared_labels) && row.declared_labels.length >= 3);
  assert.equal(row.split, 'stop-hook');
});

  await ok('parseRun (c): neither a card nor a declaration -> card false, declared false (a fork scenario missed)', function () {
  const events = loadStream('c-neither');
  const row = harness.parseRun(events, { id: 'c', poses_fork: true }, { tree: '/tmp/arm-tree-c', mode: 'probe' });
  assert.equal(row.status, 'ok');
  assert.equal(row.card, false);
  assert.equal(row.declared, false);
});

  await ok('parseRun (d): only a MODE_MENU card -> card false, card_is_mode_menu true', function () {
  const events = loadStream('d-mode-menu-only');
  const row = harness.parseRun(events, { id: 'd', poses_fork: true }, { tree: '/tmp/arm-tree-d', mode: 'probe' });
  assert.equal(row.status, 'ok');
  assert.equal(row.card, false);
  assert.equal(row.card_is_mode_menu, true);
});

  await ok('parseRun (e): init tools lack AskUserQuestion in probe mode -> error_no_card_tool', function () {
  const events = loadStream('e-no-card-tool');
  const row = harness.parseRun(events, { id: 'e', poses_fork: true }, { tree: '/tmp/arm-tree-e', mode: 'probe' });
  assert.equal(row.status, 'error_no_card_tool');
});

  await ok('parseRun (e-text-mode): the same stream in text mode does not require the card tool', function () {
  const events = loadStream('e-no-card-tool');
  const row = harness.parseRun(events, { id: 'e', poses_fork: true }, { tree: '/tmp/arm-tree-e', mode: 'text' });
  assert.equal(row.status, 'ok');
});

  await ok('parseRun (f): two plugins named mos -> error_wrong_plugin', function () {
  const events = loadStream('f-wrong-plugin');
  const row = harness.parseRun(events, { id: 'f', poses_fork: true }, { tree: '/tmp/arm-tree-f', mode: 'probe' });
  assert.equal(row.status, 'error_wrong_plugin');
});

  await ok('parseRun (f-path-mismatch): exactly one mos plugin, but its path is not the arm tree -> error_wrong_plugin', function () {
  const events = loadStream('a-card-in-attempt1'); // single 'mos' plugin at /tmp/arm-tree-a
  const row = harness.parseRun(events, { id: 'a', poses_fork: true }, { tree: '/tmp/some-other-tree', mode: 'probe' });
  assert.equal(row.status, 'error_wrong_plugin');
});

  await ok('parseRun (g): SessionStart output carries "No room detected" -> error_mode_routing', function () {
  const events = loadStream('g-mode-routing');
  const row = harness.parseRun(events, { id: 'g', poses_fork: true }, { tree: '/tmp/arm-tree-g', mode: 'probe' });
  assert.equal(row.status, 'error_mode_routing');
});

  await ok('parseRun (h): a budget-exceeded result subtype, or cost at/over the cap -> error_budget, never a miss', function () {
  const events = loadStream('h-budget-exceeded');
  const row = harness.parseRun(events, { id: 'h', poses_fork: true }, { tree: '/tmp/arm-tree-h', mode: 'probe' });
  assert.equal(row.status, 'error_budget');
  assert.ok(row.cost_usd >= 0.40);
});

  await ok('parseRun (i): no Stop hook event anywhere -> attempt 1 is the whole stream, split "no-hook-events"', function () {
  const events = loadStream('i-no-hook-events');
  const row = harness.parseRun(events, { id: 'i', poses_fork: true }, { tree: '/tmp/arm-tree-i', mode: 'probe' });
  assert.equal(row.status, 'ok');
  assert.equal(row.split, 'no-hook-events');
  assert.equal(row.card, true);
});

// ---------------------------------------------------------------------
// preflight: refusal shapes and the pass shape
// ---------------------------------------------------------------------

const GOOD_VERSION = function () { return '2.1.280 (Claude Code)'; };
const OLD_VERSION = function () { return '2.1.100 (Claude Code)'; };

  await ok('preflight: refuses a Fable-family model (N-5)', function () {
  const r = harness.preflight({ model: 'claude-fable-3', getClaudeVersion: GOOD_VERSION, plannedRuns: 1, costPerRunUsd: 0.40, totalCapUsd: 60 });
  assert.equal(r.ok, false);
  assert.equal(r.exitCode, 2);
  assert.match(r.reason, /Fable/);
});

  await ok('preflight: refuses any model that is not exactly claude-sonnet-5', function () {
  const r = harness.preflight({ model: 'claude-opus-5', getClaudeVersion: GOOD_VERSION, plannedRuns: 1, costPerRunUsd: 0.40, totalCapUsd: 60 });
  assert.equal(r.ok, false);
  assert.equal(r.exitCode, 2);
});

  await ok('preflight: refuses when ~/.claude/agents/larry-extended.md resolves to a real file (shadowed agent)', function () {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'fork359-shadow-'));
  fs.mkdirSync(path.join(tmpHome, '.claude', 'agents'), { recursive: true });
  fs.writeFileSync(path.join(tmpHome, '.claude', 'agents', 'larry-extended.md'), '# shadow\n');
  const r = harness.preflight({
    model: harness.MODEL, homeDirForCheck: tmpHome, getClaudeVersion: GOOD_VERSION,
    plannedRuns: 1, costPerRunUsd: 0.40, totalCapUsd: 60,
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /shadow/i);
});

  await ok('preflight: a MISSING larry-extended.md (or dangling symlink) never refuses on that check', function () {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'fork359-noshadow-'));
  const r = harness.preflight({
    model: harness.MODEL, homeDirForCheck: tmpHome, getClaudeVersion: GOOD_VERSION,
    plannedRuns: 1, costPerRunUsd: 0.40, totalCapUsd: 60,
  });
  assert.equal(r.ok, true);
});

  await ok('preflight: refuses a per-run cap other than $0.40', function () {
  const r = harness.preflight({
    model: harness.MODEL, perRunCapUsd: 0.50, getClaudeVersion: GOOD_VERSION,
    plannedRuns: 1, costPerRunUsd: 0.50, totalCapUsd: 60,
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /0\.4/);
});

  await ok('preflight: refuses a claude version older than 2.1.259', function () {
  const r = harness.preflight({
    model: harness.MODEL, getClaudeVersion: OLD_VERSION,
    plannedRuns: 1, costPerRunUsd: 0.40, totalCapUsd: 60,
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /older/);
});

  await ok('preflight: refuses when the projected total exceeds the cap', function () {
  const r = harness.preflight({
    model: harness.MODEL, getClaudeVersion: GOOD_VERSION,
    plannedRuns: 200, costPerRunUsd: 0.40, totalCapUsd: 60,
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /exceeds/);
});

  await ok('preflight: passes when every check clears', function () {
  const r = harness.preflight({
    model: harness.MODEL, getClaudeVersion: GOOD_VERSION,
    plannedRuns: 6, costPerRunUsd: 0.40, totalCapUsd: 60,
  });
  assert.equal(r.ok, true);
  assert.equal(r.claudeVersion, '2.1.280 (Claude Code)');
});

// ---------------------------------------------------------------------
// buildRunCommand / buildRunEnv
// ---------------------------------------------------------------------

  await ok('buildRunCommand: probe-mode run carries every required flag, never --bare or dangerously-skip-permissions', function () {
  const cmd = harness.buildRunCommand({ tree: '/tmp/tree-x', mode: 'probe', tmpDir: '/tmp/run-x' });
  assert.equal(cmd.command, 'claude');
  const a = cmd.args;
  assert.ok(a.indexOf('-p') !== -1);
  assert.ok(a.indexOf('--input-format') !== -1 && a.indexOf('stream-json') !== -1);
  assert.ok(a.indexOf('--include-hook-events') !== -1);
  assert.ok(a.indexOf('--plugin-dir') !== -1 && a.indexOf('/tmp/tree-x') !== -1);
  assert.ok(a.indexOf('--agent') !== -1 && a.indexOf('mos:larry-extended') !== -1);
  assert.ok(a.indexOf('--model') !== -1 && a.indexOf('claude-sonnet-5') !== -1);
  assert.ok(a.indexOf('--setting-sources') !== -1 && a.indexOf('project,local') !== -1);
  assert.ok(a.indexOf('--max-budget-usd') !== -1 && a.indexOf('0.4') !== -1);
  assert.ok(a.indexOf('--no-session-persistence') !== -1);
  assert.ok(a.indexOf('--mcp-config') !== -1);
  assert.ok(a.indexOf('--permission-prompt-tool') !== -1 && a.indexOf('mcp__fork359probe__permission') !== -1);
  assert.equal(a.indexOf('--bare'), -1);
  assert.equal(a.indexOf('--dangerously-skip-permissions'), -1);
});

  await ok('buildRunCommand: text-mode run omits the mcp-config and permission-prompt-tool flags', function () {
  const cmd = harness.buildRunCommand({ tree: '/tmp/tree-y', mode: 'text', tmpDir: '/tmp/run-y' });
  assert.equal(cmd.args.indexOf('--mcp-config'), -1);
  assert.equal(cmd.args.indexOf('--permission-prompt-tool'), -1);
});

  await ok('buildRunEnv: lacks TYPESAFE_API_KEY, carries the hermetic variables, keeps HOME unchanged', function () {
  const savedKey = process.env.TYPESAFE_API_KEY;
  process.env.TYPESAFE_API_KEY = 'should-never-survive';
  try {
    const env = harness.buildRunEnv({ tmpDir: '/tmp/hermetic-x' });
    assert.equal('TYPESAFE_API_KEY' in env, false);
    assert.equal(env.MINDRIAN_HOME, path.join('/tmp/hermetic-x', 'home'));
    assert.equal(env.MINDRIAN_ROOMS_HOME, path.join('/tmp/hermetic-x', 'rooms'));
    assert.equal(env.MINDRIAN_ROOMS_ROOT, path.join('/tmp/hermetic-x', 'rooms'));
    assert.equal(env.CARD_FIRE_SIDECHANNEL_PATH, path.join('/tmp/hermetic-x', 'card-fire-reached.json'));
    assert.equal(env.FORK359_PROBE_LOG, path.join('/tmp/hermetic-x', 'probe.jsonl'));
    assert.equal(env.MINDRIAN_DISABLE_AUTO_REGISTER, '1');
    assert.equal(env.MINDRIAN_OPEN_BROWSER_DISABLE, '1');
    assert.equal(env.HOME, process.env.HOME);
  } finally {
    if (savedKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = savedKey;
  }
});

  await ok('the default results path lives outside the repo', function () {
  const rel = path.relative(harness.REPO_ROOT, harness.DEFAULT_RESULTS_DIR);
  assert.ok(rel.startsWith('..'), 'expected DEFAULT_RESULTS_DIR outside REPO_ROOT, got: ' + harness.DEFAULT_RESULTS_DIR);
});

// ---------------------------------------------------------------------
// evaluate: floor-guarded PASS / INCONCLUSIVE / FALSIFIED, error exclusion
// ---------------------------------------------------------------------

  await ok('evaluate: pre 12/30 missed, post 5/30 missed, 0 control blocks -> PASS', function () {
  const rows = []
    .concat(buildForkRows('pre-fork', 'pre', 30, 12))
    .concat(buildForkRows('post-fork', 'post', 30, 5))
    .concat([controlRow('post-ctrl-0', 'post', false)]);
  const result = harness.evaluate(rows, { mode: 'probe', meta: SAMPLE_META });
  assert.equal(result.floor, 6);
  assert.equal(result.pre.missed, 12);
  assert.equal(result.post.missed, 5);
  assert.equal(result.outcome, 'PASS');
});

  await ok('evaluate: pre 5/30 missed (below the vacuity floor) -> INCONCLUSIVE', function () {
  const rows = []
    .concat(buildForkRows('pre-fork', 'pre', 30, 5))
    .concat(buildForkRows('post-fork', 'post', 30, 0));
  const result = harness.evaluate(rows, { mode: 'probe', meta: SAMPLE_META });
  assert.equal(result.outcome, 'INCONCLUSIVE');
});

  await ok('evaluate: pre 12/30, post 7/30 (above 50%) -> FALSIFIED', function () {
  const rows = []
    .concat(buildForkRows('pre-fork', 'pre', 30, 12))
    .concat(buildForkRows('post-fork', 'post', 30, 7));
  const result = harness.evaluate(rows, { mode: 'probe', meta: SAMPLE_META });
  assert.equal(result.outcome, 'FALSIFIED');
});

  await ok('evaluate: pre 12/30, post 4/30 but 1 post control block -> FALSIFIED', function () {
  const rows = []
    .concat(buildForkRows('pre-fork', 'pre', 30, 12))
    .concat(buildForkRows('post-fork', 'post', 30, 4))
    .concat([controlRow('post-ctrl-blocked', 'post', true)]);
  const result = harness.evaluate(rows, { mode: 'probe', meta: SAMPLE_META });
  assert.equal(result.post.control_declared_blocks, 1);
  assert.equal(result.outcome, 'FALSIFIED');
});

  await ok('evaluate: error rows are excluded from the numerator and denominator, and counted separately', function () {
  const okRows = buildForkRows('pre-fork', 'pre', 30, 12);
  const errorRows = [];
  for (let i = 0; i < 5; i += 1) {
    errorRows.push(forkRow('pre-error-' + i, 'pre', true, { status: 'error_budget' }));
  }
  const rows = okRows.concat(errorRows).concat(buildForkRows('post-fork', 'post', 30, 5));
  const result = harness.evaluate(rows, { mode: 'probe', meta: SAMPLE_META });
  assert.equal(result.pre.fork_runs, 30, 'error rows must not inflate fork_runs');
  assert.equal(result.pre.missed, 12, 'error rows must not inflate missed');
  assert.equal(result.pre.errors, 5);
});

  await ok('evaluate: text mode counts a caught fork only via declaration, not a card', function () {
  const rows = [
    forkRow('t-1', 'pre', false, { card: true, declared: false }), // a card with no declaration
    forkRow('t-2', 'pre', false, { card: false, declared: true }),
  ];
  const result = harness.evaluate(rows, { mode: 'text', meta: SAMPLE_META });
  // in text mode, t-1 (card only) counts as missed; t-2 (declared) does not
  assert.equal(result.pre.missed, 1);
});

// ---------------------------------------------------------------------
// --dry-run and preflight-refusal, spawned through the real CLI against a
// FAKE claude that answers ONLY --version
// ---------------------------------------------------------------------

function withFakeClaude(versionText, fn) {
  const fakeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fork359-fakeclaude-'));
  const fakeClaudePath = path.join(fakeDir, 'claude');
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fork359-fakeclaude-log-'));
  const logPath = path.join(logDir, 'invocations.jsonl');
  fs.writeFileSync(
    fakeClaudePath,
    [
      '#!/usr/bin/env node',
      "'use strict';",
      'const fs = require("fs");',
      'const args = process.argv.slice(2);',
      'if (args.indexOf("--version") !== -1) {',
      '  process.stdout.write(' + JSON.stringify(versionText) + ' + "\\n");',
      '  process.exit(0);',
      '}',
      'const logPath = process.env.FAKE_CLAUDE_LOG;',
      'if (logPath) { fs.appendFileSync(logPath, JSON.stringify(args) + "\\n"); }',
      'process.exit(1);',
      '',
    ].join('\n')
  );
  fs.chmodSync(fakeClaudePath, 0o755);

  const env = Object.assign({}, process.env);
  delete env.TYPESAFE_API_KEY;
  env.PATH = fakeDir + path.delimiter + process.env.PATH;
  env.FAKE_CLAUDE_LOG = logPath;

  try {
    return fn({ env: env, logPath: logPath });
  } finally {
    try { fs.rmSync(fakeDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
    try { fs.rmSync(logDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

  await ok('--dry-run: prints one command per planned run, invokes the fake claude only for --version, spends nothing', function () {
  withFakeClaude('2.1.280 (Claude Code)', function (ctx) {
    const res = spawnSync(process.execPath, [HARNESS_PATH, '--dry-run', '--smoke', '--arm', 'both'], {
      cwd: REPO,
      env: ctx.env,
      encoding: 'utf8',
    });
    assert.equal(res.status, 0, 'dry-run must exit 0; stderr: ' + res.stderr);
    assert.ok(res.stdout.indexOf('[dry-run]') !== -1, 'expected at least one [dry-run] line');
    assert.equal(res.stdout.indexOf('--bare'), -1);
    assert.equal(res.stdout.indexOf('--dangerously-skip-permissions'), -1);
    assert.equal(fs.existsSync(ctx.logPath), false, 'the fake claude must never be invoked for a full run during --dry-run');
  });
});

  await ok('the CLI preflight refusal (an old claude version) exits non-zero and never prints a dry-run line', function () {
  withFakeClaude('2.0.1 (Claude Code)', function (ctx) {
    const res = spawnSync(process.execPath, [HARNESS_PATH, '--dry-run', '--smoke', '--arm', 'both'], {
      cwd: REPO,
      env: ctx.env,
      encoding: 'utf8',
    });
    assert.notEqual(res.status, 0);
    assert.equal(res.stdout.indexOf('[dry-run]'), -1);
    assert.equal(fs.existsSync(ctx.logPath), false);
  });
});

  await ok('--project prints a planned-runs / projected-total-usd JSON without touching the claude run path', function () {
  withFakeClaude('2.1.280 (Claude Code)', function (ctx) {
    const res = spawnSync(process.execPath, [HARNESS_PATH, '--project', '--smoke', '--arm', 'both'], {
      cwd: REPO,
      env: ctx.env,
      encoding: 'utf8',
    });
    assert.equal(res.status, 0, 'stderr: ' + res.stderr);
    const parsed = JSON.parse(res.stdout.trim().split('\n').pop());
    assert.equal(typeof parsed.planned_runs, 'number');
    assert.equal(typeof parsed.projected_total_usd, 'number');
    assert.equal(fs.existsSync(ctx.logPath), false);
  });
});

// ---------------------------------------------------------------------
// --parse and --evaluate CLI paths (no claude spawned at all)
// ---------------------------------------------------------------------

  await ok('--parse prints the parsed row for a canned stream, with no claude invocation', function () {
  const res = spawnSync(
    process.execPath,
    [HARNESS_PATH, '--parse', path.join(STREAM_DIR, 'a-card-in-attempt1.jsonl'), '--scenario', 'fwd-fork-01', '--tree', '/tmp/arm-tree-a'],
    { cwd: REPO, encoding: 'utf8' }
  );
  assert.equal(res.status, 0, 'stderr: ' + res.stderr);
  const row = JSON.parse(res.stdout.trim());
  assert.equal(row.card, true);
});

  await ok('--evaluate reads a results JSONL and prints the evaluate() outcome', function () {
  const tmpResults = fs.mkdtempSync(path.join(os.tmpdir(), 'fork359-results-'));
  const resultsPath = path.join(tmpResults, 'results.jsonl');
  const rows = []
    .concat(buildForkRows('pre-fork', 'pre', 30, 12))
    .concat(buildForkRows('post-fork', 'post', 30, 5));
  fs.writeFileSync(resultsPath, rows.map(function (r) { return JSON.stringify(r); }).join('\n') + '\n');
  const res = spawnSync(process.execPath, [HARNESS_PATH, '--evaluate', '--results', resultsPath], {
    cwd: REPO,
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, 'stderr: ' + res.stderr);
  const parsed = JSON.parse(res.stdout.trim());
  assert.equal(parsed.outcome, 'PASS');
  try { fs.rmSync(tmpResults, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
});

// ---------------------------------------------------------------------
// The dev-only stdio MCP permission host: a live JSON-RPC round trip
// ---------------------------------------------------------------------

  await ok('probe round trip: initialize, tools/list (exactly one tool), tools/call AskUserQuestion -> deny JSON + a log line with both labels', function () {
  const { spawn } = require('node:child_process');
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fork359-probe-test-'));
  const logPath = path.join(logDir, 'probe.jsonl');

  const child = spawn(process.execPath, [PROBE_PATH], {
    cwd: REPO,
    env: Object.assign({}, process.env, { FORK359_PROBE_LOG: logPath }),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let buf = '';
  const responses = [];
  child.stdout.on('data', function (d) {
    buf += d.toString();
    let idx = buf.indexOf('\n');
    while (idx !== -1) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      idx = buf.indexOf('\n');
      if (line.trim()) {
        try { responses.push(JSON.parse(line)); } catch (_e) { /* ignore unparsed */ }
      }
    }
  });

  function send(msg) { child.stdin.write(JSON.stringify(msg) + '\n'); }
  function waitFor(id, timeoutMs) {
    return new Promise(function (resolve, reject) {
      const start = Date.now();
      const iv = setInterval(function () {
        const r = responses.find(function (x) { return x.id === id; });
        if (r) { clearInterval(iv); resolve(r); }
        else if (Date.now() - start > timeoutMs) { clearInterval(iv); reject(new Error('timeout waiting for id ' + id)); }
      }, 20);
    });
  }

  return (async function () {
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test-359', version: '1.0.0' } } });
    await waitFor(1, 5000);
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });

    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const toolsResp = await waitFor(2, 5000);
    assert.equal(toolsResp.result.tools.length, 1);
    assert.equal(toolsResp.result.tools[0].name, 'permission');

    send({
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: {
        name: 'permission',
        arguments: {
          tool_name: 'AskUserQuestion',
          input: { questions: [{ question: 'Which way?', options: [{ label: 'Option A' }, { label: 'Option B' }] }] },
          tool_use_id: 'toolu_test_1',
        },
      },
    });
    const callResp = await waitFor(3, 5000);
    const payload = JSON.parse(callResp.result.content[0].text);
    assert.equal(payload.behavior, 'deny');
    assert.equal(typeof payload.message, 'string');

    await new Promise(function (r) { setTimeout(r, 150); });
    const logLines = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
    assert.equal(logLines.length, 1);
    const logRow = JSON.parse(logLines[0]);
    assert.equal(logRow.tool_name, 'AskUserQuestion');
    assert.deepEqual(logRow.options, ['Option A', 'Option B']);

    child.kill();
    try { fs.rmSync(logDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  })();
});

// ---------------------------------------------------------------------
// Dev-only tripwire: never imported by lib/ or hooks/
// ---------------------------------------------------------------------

  await ok('dev-only tripwire: neither dev-only file is referenced from lib/ or hooks/', function () {
  const res = spawnSync('grep', ['-rl', '-E', 'forward-fork-scenarios-359|fork359-permission-probe', path.join(REPO, 'lib'), path.join(REPO, 'hooks')], {
    encoding: 'utf8',
  });
  // grep -l exits 1 with empty stdout when no file matches; that is the
  // expected (passing) outcome here.
  assert.equal((res.stdout || '').trim(), '');
});
})().then(function () {
  console.log('');
  console.log('Passed: ' + (total - failures) + ' / ' + total);
  if (failures > 0) {
    console.log('Failed: ' + failures);
    process.exit(1);
  }
  process.exit(0);
}).catch(function (e) {
  console.log('FATAL: ' + (e && e.stack ? e.stack : String(e)));
  process.exit(1);
});
