'use strict';
// Phase 359-01 -- test-359-inertness.cjs: the R5 inertness gate over the
// Phase 357 corpus (FORK359-05, SPEC R5, D-06 step 5).
//
// This is the standing before-and-after gating check every later 359 code
// change runs: it replays the full 357 corpus through the REAL Stop-hook
// predicate on both Tri-Polar surfaces (scripts/replay-card-fire.cjs, no
// mocks) and fails on any class or reason change versus the pre-359.json
// snapshot (tests/fixtures/card-fire-replay/pre-359.json), or on any false
// block, new miss, parity mismatch or error. A change that adds the
// declared-fork arm must leave every UNDECLARED historic output exactly
// where it was (D-06 step 5: the declared arm cannot fire without a
// declaration line, and no historic output carries one).
//
// Test hygiene (D-13-style network ban, matching test-357-replay.cjs's own
// pattern): TYPESAFE_API_KEY is stripped from the spawned child's env; a
// NODE_OPTIONS preload replaces globalThis.fetch with a function that
// writes NETWORK_ATTEMPT_359 to stderr and throws, installed before the
// replay harness's own require chain ever runs; HOME is redirected to a
// fresh mkdtemp per spawn. Nothing this test writes lands outside a mkdtemp
// dir or this file itself.
//
// No em-dashes anywhere (hyphens only, CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

delete process.env.TYPESAFE_API_KEY;

const REPO = path.join(__dirname, '..');
const REPLAY_SCRIPT = path.join(REPO, 'scripts', 'replay-card-fire.cjs');
const PRE_359_PATH = path.join(REPO, 'tests', 'fixtures', 'card-fire-replay', 'pre-359.json');

console.log('test-359-inertness');

let failures = 0;
let total = 0;
function ok(desc, fn) {
  total += 1;
  try {
    fn();
    console.log('  ok   ' + desc);
  } catch (e) {
    failures += 1;
    console.log('  FAIL ' + desc + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

// ---------------------------------------------------------------------
// The network-attempt-detector preload (D-13-style backstop, this test's
// own NETWORK_ATTEMPT_359 sentinel). Written once, reused by every spawn.
// ---------------------------------------------------------------------
const preloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inertness359-preload-'));
const preloadPath = path.join(preloadDir, 'network-attempt-detector.cjs');
fs.writeFileSync(
  preloadPath,
  "'use strict';\n" +
  'globalThis.fetch = function () {\n' +
  "  process.stderr.write('NETWORK_ATTEMPT_359\\n');\n" +
  "  throw new Error('NETWORK_ATTEMPT_359');\n" +
  '};\n'
);

/**
 * replay(args) -- spawn `node scripts/replay-card-fire.cjs ...args --json`,
 * hygienic child env (fresh HOME, no TYPESAFE_API_KEY, the fetch-thrower
 * preload). Returns {status, json, stdout, stderr}.
 */
function replay(args) {
  const childHome = fs.mkdtempSync(path.join(os.tmpdir(), 'inertness359-test-home-'));
  const env = Object.assign({}, process.env);
  delete env.TYPESAFE_API_KEY;
  env.HOME = childHome;
  env.NODE_OPTIONS = ((env.NODE_OPTIONS || '') + ' --require ' + preloadPath).trim();

  const fullArgs = (args || []).concat(['--json']);
  const res = spawnSync(process.execPath, [REPLAY_SCRIPT].concat(fullArgs), {
    cwd: REPO,
    env: env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  let json = null;
  try {
    json = JSON.parse(res.stdout);
  } catch (_e) {
    json = null;
  }
  return { status: res.status, json: json, stdout: res.stdout, stderr: res.stderr };
}

let runResult = null;
let preSnapshot = null;

ok('I1: full corpus, both surfaces, --baseline compare exits 0 with all gating counts at 0', function () {
  runResult = replay(['--surface', 'both', '--baseline', 'compare']);
  assert.equal(runResult.status, 0, 'replay-card-fire must exit 0; stderr: ' + runResult.stderr);
  assert.ok(runResult.json, 'replay-card-fire must print parseable JSON on stdout');
  const counts = runResult.json.counts;
  assert.equal(counts.false_blocks, 0, 'false_blocks must be 0, got ' + counts.false_blocks);
  assert.equal(counts.new_misses, 0, 'new_misses must be 0, got ' + counts.new_misses);
  assert.equal(counts.parity_mismatches, 0, 'parity_mismatches must be 0, got ' + counts.parity_mismatches);
  assert.equal(counts.errors, 0, 'errors must be 0, got ' + counts.errors);
});

ok('I2: every id in pre-359.json verdicts has an identical cli class, cli reason and mcp class', function () {
  assert.ok(runResult && runResult.json, 'I1 must have produced a run to compare against');
  preSnapshot = JSON.parse(fs.readFileSync(PRE_359_PATH, 'utf8'));

  const byId = new Map();
  for (const r of runResult.json.entries) byId.set(r.id, r);

  const diffs = [];
  for (const id of Object.keys(preSnapshot.verdicts)) {
    const before = preSnapshot.verdicts[id];
    const after = byId.get(id);
    if (!after) {
      diffs.push({ id: id, before: JSON.stringify(before), after: '(missing from run)' });
      continue;
    }
    const afterCliClass = after.cli ? after.cli.class : undefined;
    const afterCliReason = after.cli ? after.cli.reason : undefined;
    const afterMcpClass = after.mcp ? after.mcp.class : undefined;

    // MCP-only dedup-already-fired-this-session difference is ignored, as
    // in 357 R5: a session-scoped MCP suppression is not a real disagreement.
    const mcpDedupIgnorable = after.mcp && after.mcp.dedup === true;

    const cliClassDiff = afterCliClass !== before.cli_class;
    const cliReasonDiff = afterCliReason !== before.cli_reason;
    const mcpClassDiff = !mcpDedupIgnorable && afterMcpClass !== before.mcp_class;

    if (cliClassDiff || cliReasonDiff || mcpClassDiff) {
      diffs.push({
        id: id,
        before: JSON.stringify(before),
        after: JSON.stringify({ cli_class: afterCliClass, cli_reason: afterCliReason, mcp_class: afterMcpClass }),
      });
    }
  }

  if (diffs.length > 0) {
    console.log('  id | before | after');
    for (const d of diffs) console.log('  ' + d.id + ' | ' + d.before + ' | ' + d.after);
  }
  assert.equal(diffs.length, 0, diffs.length + ' verdict diff(s) found against pre-359.json (printed above)');
});

ok('I3: ids present in the run but absent from the snapshot are reported, not failed', function () {
  assert.ok(runResult && runResult.json, 'I1 must have produced a run to compare against');
  const newIds = runResult.json.entries
    .map(function (r) { return r.id; })
    .filter(function (id) { return !(id in preSnapshot.verdicts); });
  if (newIds.length > 0) {
    console.log('  new corpus ids (not compared): ' + newIds.join(', '));
  }
  // This leg never fails on new ids; it only reports them.
  assert.ok(true);
});

ok('I4: stderr carries no NETWORK_ATTEMPT_359', function () {
  assert.ok(runResult, 'I1 must have produced a run');
  assert.ok(
    runResult.stderr.indexOf('NETWORK_ATTEMPT_359') === -1,
    'stderr must never contain NETWORK_ATTEMPT_359; got: ' + runResult.stderr
  );
});

console.log('');
console.log('Passed: ' + (total - failures) + ' / ' + total);
if (failures > 0) {
  console.log('Failed: ' + failures);
  process.exit(1);
}
process.exit(0);
