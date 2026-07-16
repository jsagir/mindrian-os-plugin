#!/usr/bin/env node
'use strict';

/**
 * Phase 229-10 -- D14 async/sync exit-code PARITY gate (CASCADE-06)
 * ==================================================================
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * The CI-blocking regression gate for 229-AI-SPEC.md dimension D14: runOneAsync
 * (scripts/huji-run-one-async.cjs) and runOne (scripts/huji-run-one.cjs) MUST
 * return a STRUCTURALLY IDENTICAL { ok, reason, detail } failure envelope for the
 * same injected child-process failure, at BOTH Stage A and Stage B. This is the
 * concrete state-machine proof the async twin never surprises an external caller
 * (the separate mindrian-pitch-feedback-mcp repo) that wrote its error handling
 * against runOne's contract. The one real translation point - execFile REJECTS on
 * a non-zero exit where the sync spawn primitive RETURNS a .status field - is
 * exactly where a silent divergence would hide, so this gate stubs the child
 * process to exit non-zero and asserts the two returned objects match.
 *
 * Four checks, in order:
 *   1. File existence + AsyncFunction assertion.
 *   2. Caller-side audit: scripts/huji-batch.cjs still requires ONLY the sync
 *      runOne, never the async twin; and (future-proofing) no lib/mcp/ file
 *      requires the sync engine directly, bypassing the async contract.
 *   3. D14 parity fixture, FIXTURE-A: an injected Stage A non-zero exit yields
 *      an identical { ok:false, reason:'stageA_nonzero', detail:<marker> } from
 *      both functions.
 *   4. D14 parity fixture, FIXTURE-B: Stage A succeeds, an injected Stage B
 *      non-zero exit yields an identical { ok:false, reason:'stageB_nonzero',
 *      detail:<marker> } from both functions.
 *
 * Exit codes: 0 -- parity holds; 1 -- at least one check failed (stack printed).
 *
 * Phase-local wiring: this test is invoked EXCLUSIVELY through
 * tests/run-all-229.sh's run_if legs (the phase-local convention), NOT registered
 * in the general lib/memory Feynman-MINTO cross-phase registry.
 *
 * No em-dashes (CLAUDE.md HARD RULE). CJS only.
 *
 * License: BSL 1.1 -- see LICENSE.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '../..');

/**
 * grepCount - count matching lines under a directory, guarded on existence.
 * grep exits 1 when there are no matches, which is not a failure here. Mirrors
 * the defensive helper in lib/memory/sync-async-entry-points.test.cjs.
 */
function grepCount(pattern, dir) {
  if (!fs.existsSync(dir)) return 0;
  try {
    const out = execSync(`grep -RInE "${pattern}" "${dir}" --include='*.cjs' --include='*.js'`, { encoding: 'utf8' });
    return out.split('\n').filter((l) => l.trim()).length;
  } catch (_e) {
    return 0;
  }
}

// --------------------------------------------------------------------------
// Fixture fake `claude`: a tiny executable that stands in for the real CLI. It
// branches on whether its argv carries the Stage B signal ('/mos:pipeline
// PWS_grading') vs Stage A, and on two env vars, to inject a non-zero exit with a
// fixed stderr marker OR print a minimal `--output-format json` envelope whose
// structured_output satisfies the two schemas' minimum required fields. Both the
// sync spawn primitive and execFile resolve a bare command name via PATH, so
// prepending the temp dir to process.env.PATH routes both twins to this stub.
// --------------------------------------------------------------------------
const MIN_EVIDENCE = {
  submission_id: 'parity',
  problem_claim: { stated: true, quote: 'a stated problem span', timestamp: null },
  value_proposition: { stated: true, quote: 'a stated value span' },
  evidence_claims: [],
  self_identified_gaps: [],
  speaker_count: 1,
  language_notes: '',
};

const MIN_FEEDBACK = {
  submission_id: 'parity',
  governing_thought: 'A governing thought long enough to satisfy the minimum bound.',
  branches: [
    { point: 'first point', support: ['first support'], teachable_next_step: 'first step' },
    { point: 'second point', support: ['second support'], teachable_next_step: 'second step' },
  ],
  scores: { grounding: 80 },
  model_id: 'claude-opus-4-8',
  calibration_source: 'local-anchors',
};

const STAGE_A_MARKER = 'FAKE_CLAUDE_STAGEA_MARKER_injected_stageA_failure';
const STAGE_B_MARKER = 'FAKE_CLAUDE_STAGEB_MARKER_injected_stageB_failure';

function fakeClaudeSource() {
  return [
    '#!/usr/bin/env node',
    "'use strict';",
    'const args = process.argv.slice(2);',
    "// Exact-match the Stage B -p value. The Stage A intake prompt CONTAINS the",
    "// substring 'PWS_grading' (methodology text), so a substring test would",
    "// misclassify Stage A; only Stage B carries an arg equal to this literal.",
    "const isStageB = args.some((a) => a === '/mos:pipeline PWS_grading');",
    'if (isStageB) {',
    "  const exit = parseInt(process.env.HUJI_FAKE_CLAUDE_STAGEB_EXIT || '0', 10);",
    '  if (exit !== 0) {',
    '    process.stderr.write(' + JSON.stringify(STAGE_B_MARKER + '\n') + ');',
    '    process.exit(exit);',
    '  }',
    '  process.stdout.write(JSON.stringify({ structured_output: ' + JSON.stringify(MIN_FEEDBACK) + ', total_cost_usd: 0.5, session_id: "fake-b" }));',
    '  process.exit(0);',
    '}',
    "const exitA = parseInt(process.env.HUJI_FAKE_CLAUDE_STAGEA_EXIT || '0', 10);",
    'if (exitA !== 0) {',
    '  process.stderr.write(' + JSON.stringify(STAGE_A_MARKER + '\n') + ');',
    '  process.exit(exitA);',
    '}',
    'process.stdout.write(JSON.stringify({ structured_output: ' + JSON.stringify(MIN_EVIDENCE) + ', total_cost_usd: 0.1, session_id: "fake-a" }));',
    'process.exit(0);',
    '',
  ].join('\n');
}

/**
 * Assert two failure envelopes are structurally identical on the load-bearing
 * fields, and that the detail carries the injected marker.
 */
function assertEnvelopeParity(syncRes, asyncRes, expectedReason, marker, label) {
  assert.strictEqual(syncRes.ok, false, `${label}: sync runOne must fail (ok===false)`);
  assert.strictEqual(asyncRes.ok, false, `${label}: async runOneAsync must fail (ok===false)`);
  assert.strictEqual(syncRes.reason, expectedReason, `${label}: sync reason must be ${expectedReason}, got ${syncRes.reason}`);
  assert.strictEqual(asyncRes.reason, expectedReason, `${label}: async reason must be ${expectedReason}, got ${asyncRes.reason}`);
  assert.strictEqual(asyncRes.reason, syncRes.reason, `${label}: reason codes must match`);
  assert.strictEqual(typeof asyncRes.detail, typeof syncRes.detail, `${label}: detail type must match`);
  assert.ok(String(syncRes.detail).indexOf(marker) !== -1, `${label}: sync detail must contain the injected marker`);
  assert.ok(String(asyncRes.detail).indexOf(marker) !== -1, `${label}: async detail must contain the injected marker`);
  assert.strictEqual(String(asyncRes.detail), String(syncRes.detail), `${label}: detail content must be identical`);
}

async function run() {
  // -------------------------------------------------------------------------
  // 1. File existence + AsyncFunction assertion.
  // -------------------------------------------------------------------------
  const syncPath = path.join(REPO, 'scripts/huji-run-one.cjs');
  const asyncPath = path.join(REPO, 'scripts/huji-run-one-async.cjs');
  assert.ok(fs.existsSync(syncPath), 'scripts/huji-run-one.cjs missing');
  assert.ok(fs.existsSync(asyncPath), 'scripts/huji-run-one-async.cjs missing');

  const asyncMod = require(asyncPath);
  assert.strictEqual(
    asyncMod.runOneAsync.constructor.name, 'AsyncFunction',
    `runOneAsync must be an AsyncFunction (got ${asyncMod.runOneAsync.constructor.name})`
  );
  assert.strictEqual(typeof asyncMod.runClaudeAsync, 'function', 'runClaudeAsync must be exported');

  // -------------------------------------------------------------------------
  // 2. Caller-side audit.
  // -------------------------------------------------------------------------
  // scripts/huji-batch.cjs must still require ONLY the sync runOne.
  const batchPath = path.join(REPO, 'scripts/huji-batch.cjs');
  const batchSrc = fs.readFileSync(batchPath, 'utf8');
  assert.ok(/require\(['"]\.\/huji-run-one\.cjs['"]\)/.test(batchSrc),
    'scripts/huji-batch.cjs must require the sync huji-run-one.cjs at least once');
  assert.ok(!/huji-run-one-async/.test(batchSrc),
    'scripts/huji-batch.cjs must NOT require huji-run-one-async.cjs (isolation: batch stays on the sync twin)');

  // Future-proofing: if lib/mcp/ exists, no file there may require the sync engine
  // directly (a same-repo MCP consumer must go through the async contract).
  const mcpSyncCallers = grepCount("require\\(.*huji-run-one\\.cjs", path.join(REPO, 'lib/mcp'));
  assert.strictEqual(mcpSyncCallers, 0,
    `no lib/mcp/ file may require the sync scripts/huji-run-one.cjs directly (got ${mcpSyncCallers})`);

  // -------------------------------------------------------------------------
  // 3 + 4. D14 parity fixtures.
  // -------------------------------------------------------------------------
  const { runOne } = require(syncPath);
  const { runOneAsync } = asyncMod;

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'huji-parity-'));
  const binDir = path.join(tmpRoot, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const fakeClaudePath = path.join(binDir, 'claude');
  fs.writeFileSync(fakeClaudePath, fakeClaudeSource(), 'utf8');
  fs.chmodSync(fakeClaudePath, 0o755);

  const transcriptPath = path.join(tmpRoot, 'transcript.md');
  fs.writeFileSync(transcriptPath, 'a stated problem span and a stated value span from the pitch.\n', 'utf8');

  const originalPath = process.env.PATH;
  const originalStageAExit = process.env.HUJI_FAKE_CLAUDE_STAGEA_EXIT;
  const originalStageBExit = process.env.HUJI_FAKE_CLAUDE_STAGEB_EXIT;

  // Speed the fixtures: short timeouts, minimal config. The stub exits instantly,
  // so a stalled child (a real bug) trips the timeout rather than hanging CI.
  const fixtureConfig = { stageATimeoutMs: 30000, stageBTimeoutMs: 30000 };

  try {
    process.env.PATH = binDir + path.delimiter + originalPath;

    // ---- FIXTURE-A: injected Stage A non-zero exit (code 7). ----
    process.env.HUJI_FAKE_CLAUDE_STAGEA_EXIT = '7';
    delete process.env.HUJI_FAKE_CLAUDE_STAGEB_EXIT;

    const outA = path.join(tmpRoot, 'outA');
    const syncA = runOne({ subId: 'fixa-sync', transcriptPath, outDir: outA, config: fixtureConfig });
    const asyncA = await runOneAsync({ subId: 'fixa-async', transcriptPath, outDir: outA, config: fixtureConfig });
    assertEnvelopeParity(syncA, asyncA, 'stageA_nonzero', STAGE_A_MARKER, 'FIXTURE-A (Stage A non-zero)');

    // ---- FIXTURE-B: Stage A succeeds, injected Stage B non-zero exit (code 9). ----
    delete process.env.HUJI_FAKE_CLAUDE_STAGEA_EXIT;
    process.env.HUJI_FAKE_CLAUDE_STAGEB_EXIT = '9';

    const outB = path.join(tmpRoot, 'outB');
    const syncB = runOne({ subId: 'fixb-sync', transcriptPath, outDir: outB, config: fixtureConfig });
    const asyncB = await runOneAsync({ subId: 'fixb-async', transcriptPath, outDir: outB, config: fixtureConfig });
    assertEnvelopeParity(syncB, asyncB, 'stageB_nonzero', STAGE_B_MARKER, 'FIXTURE-B (Stage B non-zero)');
  } finally {
    // Restore env exactly (no leak).
    process.env.PATH = originalPath;
    if (originalStageAExit === undefined) delete process.env.HUJI_FAKE_CLAUDE_STAGEA_EXIT;
    else process.env.HUJI_FAKE_CLAUDE_STAGEA_EXIT = originalStageAExit;
    if (originalStageBExit === undefined) delete process.env.HUJI_FAKE_CLAUDE_STAGEB_EXIT;
    else process.env.HUJI_FAKE_CLAUDE_STAGEB_EXIT = originalStageBExit;
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_e) { /* graceful */ }
  }

  process.stdout.write('huji-run-one-async-parity: all checks passed ' +
    '(D14: stageA_nonzero + stageB_nonzero envelopes structurally identical across runOne/runOneAsync)\n');
  process.exit(0);
}

run().catch((e) => {
  process.stderr.write((e && e.stack || String(e)) + '\n');
  process.exit(1);
});
