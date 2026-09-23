'use strict';
// Phase 361-06 Task 1 -- dominant-design-research CLI router tests.
//
// Covers the four non-filing subcommands: compose-queries, audit-query,
// theo-structure, validate-lane, plus the router's own usage-error legs.
// file-pack is covered separately by tests/test-361-filing.cjs (Task 2).
//
// Test hygiene (identical to sibling test-361-* files, 361-01 context):
// plain node assert, no deps; this process's own fetch is replaced with a
// thrower (defense in depth, even though this suite only spawns children);
// every spawned child gets NODE_OPTIONS pointing at a fetch-thrower preload
// written into a mkdtemp dir, plus HOME repointed at that same mkdtemp dir so
// no real Brain key is ever read; everything is written only inside mkdtemp
// dirs. Exit 0 PASS, 1 FAIL, 77 ENV GAP.
//
// No em-dashes anywhere in this file (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// This test process itself must never reach the network.
globalThis.fetch = function () {
  try { process.stderr.write('NETWORK_ATTEMPT_361\n'); } catch (_e) { /* ignore */ }
  throw new Error('network attempted in test-361-cli.cjs');
};

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'dominant-design-research.cjs');

let failures = 0;
function check(cond, label) {
  if (cond) {
    console.log('PASS: ' + label);
  } else {
    failures += 1;
    console.log('FAIL: ' + label);
  }
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-361-cli-'));

const PRELOAD = path.join(TMP, 'fetch-thrower-preload.cjs');
fs.writeFileSync(PRELOAD, [
  "'use strict';",
  'globalThis.fetch = function () {',
  "  try { process.stderr.write('NETWORK_ATTEMPT_361\\n'); } catch (_e) { /* ignore */ }",
  "  throw new Error('network attempted (361 fetch-thrower, child)');",
  '};',
  '',
].join('\n'), 'utf8');

const OFFLINE_HOME = path.join(TMP, 'offline-home');
fs.mkdirSync(OFFLINE_HOME, { recursive: true });

function writeJson(name, obj) {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, JSON.stringify(obj), 'utf8');
  return p;
}

function run(args, envOverrides) {
  const env = Object.assign({}, process.env, {
    NODE_OPTIONS: '--require ' + PRELOAD,
  }, envOverrides || {});
  return spawnSync(process.execPath, [SCRIPT].concat(args), {
    cwd: REPO_ROOT,
    env: env,
    encoding: 'utf8',
  });
}

function parseJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// compose-queries
// ---------------------------------------------------------------------------

(function testComposeHappyPath() {
  const file = writeJson('domain-happy.json', { domain: 'lithium-ion battery cells' });
  const res = run(['compose-queries', file]);
  check(res.status === 0, 'compose-queries happy path exits 0');
  const out = parseJson(res.stdout);
  check(!!out && out.ok === true, 'compose-queries happy path: ok true');
  check(!!out && Array.isArray(out.lanes) && out.lanes.length === 4, 'compose-queries happy path: 4 lanes');
  check(!!out && out.domain_slug === 'lithium-ion-battery-cells', 'compose-queries happy path: domain_slug');
})();

(function testComposeDegrade() {
  const file = writeJson('domain-degrade.json', { domain: 'Acme Robotics arms' });
  const res = run(['compose-queries', file]);
  check(res.status === 0, 'compose-queries degrade exits 0');
  const out = parseJson(res.stdout);
  check(!!out && out.ok === false && out.degrade === 'local-only', 'compose-queries degrade: local-only');
  check(res.stdout.indexOf('Acme') === -1, 'compose-queries degrade: stdout does not echo Acme');
})();

(function testComposeMissingFile() {
  const res = run(['compose-queries', path.join(TMP, 'does-not-exist.json')]);
  check(res.status === 2, 'compose-queries missing file exits 2');
  check(typeof res.stderr === 'string' && res.stderr.trim().length > 0, 'compose-queries missing file: stderr usage message');
})();

(function testComposeInvalidJson() {
  const p = path.join(TMP, 'bad.json');
  fs.writeFileSync(p, '{not json', 'utf8');
  const res = run(['compose-queries', p]);
  check(res.status === 2, 'compose-queries invalid JSON exits 2');
})();

// ---------------------------------------------------------------------------
// audit-query
// ---------------------------------------------------------------------------

(function testAuditQueryOk() {
  const file = writeJson('audit-ok.json', { lane: 'variant_census', q: 'solid-state battery standards IEC' });
  const res = run(['audit-query', file]);
  check(res.status === 0, 'audit-query ok leg exits 0');
  const out = parseJson(res.stdout);
  check(!!out && out.ok === true, 'audit-query ok leg: ok true');
})();

(function testAuditQueryEgressViolation() {
  const file = writeJson('audit-egress.json', { lane: 'variant_census', q: 'jane@example.com battery' });
  const res = run(['audit-query', file]);
  check(res.status === 0, 'audit-query egress-violation leg exits 0');
  const out = parseJson(res.stdout);
  check(!!out && out.ok === false && out.reason === 'egress_violation', 'audit-query egress-violation leg: reason egress_violation');
  check(res.stdout.indexOf('jane') === -1, 'audit-query egress-violation leg: stdout does not echo jane');
})();

(function testAuditQueryUnknownLane() {
  const file = writeJson('audit-unknown-lane.json', { lane: 'not_a_real_lane', q: 'anything' });
  const res = run(['audit-query', file]);
  check(res.status === 0, 'audit-query unknown-lane leg exits 0');
  const out = parseJson(res.stdout);
  check(!!out && out.ok === false && out.reason === 'unknown_lane', 'audit-query unknown-lane leg: reason unknown_lane');
})();

// ---------------------------------------------------------------------------
// validate-lane
// ---------------------------------------------------------------------------

(function testValidateLaneOk() {
  const approvedQueries = ['solar cells competing designs history first introduced'];
  const gate = writeJson('gate-ok.json', {
    domain_slug: 'solar-cells',
    lanes: [{ id: 'variant_census', queries: approvedQueries }],
  });
  const raw = writeJson('raw-ok.json', {
    lane: 'variant_census',
    queries: approvedQueries,
    claims: [{
      claim: 'PERC dominates c-Si module shipments as of 2024.',
      source_url: 'https://example.org/solar-report',
      source_title: 'Solar Industry Report',
      retrieved_at: '2026-01-01',
      quote_or_locator: 'p. 4',
      source_type: 'market_data',
    }],
  });
  const outPath = path.join(TMP, 'raw-ok.valid.json');
  const res = run(['validate-lane', raw, '--approved', gate, '--out', outPath]);
  check(res.status === 0, 'validate-lane ok leg exits 0');
  const out = parseJson(res.stdout);
  check(!!out && out.ok === true, 'validate-lane ok leg: ok true');
  check(fs.existsSync(outPath), 'validate-lane ok leg: --out file exists');
})();

(function testValidateLaneQueryMismatch() {
  const gate = writeJson('gate-mismatch.json', {
    domain_slug: 'solar-cells',
    lanes: [{ id: 'variant_census', queries: ['approved query text'] }],
  });
  const raw = writeJson('raw-mismatch.json', {
    lane: 'variant_census',
    queries: ['a different, edited query text'],
    claims: [],
  });
  const res = run(['validate-lane', raw, '--approved', gate]);
  check(res.status === 0, 'validate-lane mismatch leg exits 0');
  const out = parseJson(res.stdout);
  check(!!out && out.ok === false && out.reason === 'query_mismatch', 'validate-lane mismatch leg: reason query_mismatch');
})();

(function testValidateLaneNotApproved() {
  const gate = writeJson('gate-not-approved.json', {
    domain_slug: 'solar-cells',
    lanes: [{ id: 'convergence_signals', queries: ['x'] }],
  });
  const raw = writeJson('raw-not-approved.json', {
    lane: 'variant_census',
    queries: ['x'],
    claims: [],
  });
  const res = run(['validate-lane', raw, '--approved', gate]);
  check(res.status === 0, 'validate-lane lane-not-approved leg exits 0');
  const out = parseJson(res.stdout);
  check(!!out && out.ok === false && out.reason === 'lane_not_approved', 'validate-lane lane-not-approved leg: reason lane_not_approved');
})();

(function testValidateLaneBadOutSuffix() {
  const gate = writeJson('gate-badout.json', { domain_slug: 'solar-cells', lanes: [{ id: 'variant_census', queries: ['x'] }] });
  const raw = writeJson('raw-badout.json', { lane: 'variant_census', queries: ['x'], claims: [] });
  const res = run(['validate-lane', raw, '--approved', gate, '--out', path.join(TMP, 'not-suffixed.json')]);
  check(res.status === 2, 'validate-lane bad --out suffix exits 2');
})();

// ---------------------------------------------------------------------------
// theo-structure (offline: HOME points at an empty mkdtemp dir, no Brain key;
// the NODE_OPTIONS fetch-thrower preload is already installed above for every
// spawned child). brain-client.cjs should return null (brain_unavailable),
// so the reference fallback is exercised. This leg asserts the fallback and
// does not fail on the blocked fetch attempt itself.
// ---------------------------------------------------------------------------

(function testTheoStructureOffline() {
  const res = run(['theo-structure'], { HOME: OFFLINE_HOME });
  check(res.status === 0, 'theo-structure offline leg exits 0');
  const out = parseJson(res.stdout);
  check(!!out && out.source === 'reference', 'theo-structure offline leg: source reference');
  check(!!out && Array.isArray(out.steps) && out.steps.length === 6, 'theo-structure offline leg: six reference steps');
  check(!!out && Array.isArray(out.calls) && out.calls.length === 3, 'theo-structure offline leg: three calls recorded');
  const argsOk = !!out && out.calls.every(function (c) {
    return c && c.args && Object.keys(c.args).length === 1 && c.args.framework === 'Dominant Design';
  });
  check(argsOk, 'theo-structure offline leg: every call arg is exactly {framework: "Dominant Design"}');
})();

// ---------------------------------------------------------------------------
// router usage errors
// ---------------------------------------------------------------------------

(function testNoArgs() {
  const res = run([]);
  check(res.status === 2, 'no args exits 2');
  const listsAll = ['compose-queries', 'audit-query', 'theo-structure', 'validate-lane', 'file-pack'].every(function (name) {
    return res.stderr.indexOf(name) !== -1;
  });
  check(listsAll, 'no args: stderr lists all five subcommands');
})();

(function testUnknownSubcommand() {
  const res = run(['not-a-real-subcommand']);
  check(res.status === 2, 'unknown subcommand exits 2');
})();

// ---------------------------------------------------------------------------
// source-purity acceptance criterion (also enforced by the plan's own grep,
// asserted here so the suite is self-contained)
// ---------------------------------------------------------------------------

(function testNoChildProcess() {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  check(src.indexOf('child_process') === -1, 'script source contains no child_process require');
  check(src.indexOf('execSync') === -1, 'script source contains no execSync');
  check(src.indexOf('spawn(') === -1 && src.indexOf('spawnSync(') === -1, 'script source contains no spawn/spawnSync call');
})();

// ---------------------------------------------------------------------------

fs.rmSync(TMP, { recursive: true, force: true });

if (failures > 0) {
  console.log(failures + ' failure(s)');
  process.exit(1);
}
console.log('All test-361-cli.cjs legs passed.');
process.exit(0);
