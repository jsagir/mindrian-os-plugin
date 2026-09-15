#!/usr/bin/env node
'use strict';
/*
 * tests/test-347-projection-precedence.cjs -- Phase 347-04 Task 2.
 *
 * Proves lib/mcp/pipeline-state.cjs, the file that already declares itself
 * the SOLE CHAIN-STATE SOURCE OF TRUTH (B1, D-166-02), now says in its own
 * header that Phase 347's chain_state graph records are a PROJECTION of
 * this store, names the precedence direction (the store wins, the graph
 * row is reported stale -- the same rule commands/pipeline.md:113 already
 * states for the secondary frontmatter index), and that no code path under
 * lib/ actually reads a chain_state node to compute a resume position.
 *
 * Three legs:
 *   1. Source scan: the amended paragraph exists (PROJECTION + chain_state
 *      literals present) and CHAIN_STATE_SOURCE is unmoved.
 *   2. Behavioral disagreement: seed a room whose pipeline-state.json names
 *      a resume position while chain_state graph records run further
 *      ahead; checkPosition's answer is provably unaffected by the graph.
 *   3. Grep tripwire: no file under lib/ reads the graph to compute a
 *      resume position, checked via a comment-stripped co-occurrence scan
 *      of the literals chain_state and chain_position -- with a NAMED
 *      allow-list for the one pre-existing, legitimate, already-audited
 *      co-occurrence (D-166-02's own journal.chain_position resume read),
 *      mirroring tests/test-254-one-chain-source.cjs's own "assert against
 *      a named ALLOWED set, never a bare count" precedent for exactly this
 *      false-positive shape.
 *
 * Plain node:assert CJS script. Hyphens only, no em-dashes (CLAUDE.md HARD
 * RULE).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const PIPELINE_STATE_PATH = path.join(REPO, 'lib', 'mcp', 'pipeline-state.cjs');

const { buildChainFixtureRoom, closeChainFixtureRoom } =
  require(path.join(REPO, 'tests', 'helpers', 'fixture-room-347.cjs'));
const pipelineState = require(PIPELINE_STATE_PATH);
const chainState = require(path.join(REPO, 'lib', 'core', 'navigation', 'chain-state.cjs'));

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-347-04-precedence-' + suffix + '-'));
}

// ---- Leg 1: source scan. ----
function leg1SourceScan() {
  const source = fs.readFileSync(PIPELINE_STATE_PATH, 'utf8');
  assert.ok(source.indexOf('PROJECTION') !== -1, 'pipeline-state.cjs must name the projection paragraph literally as PROJECTION');
  assert.ok(source.indexOf('chain_state') !== -1, 'pipeline-state.cjs must name the chain_state graph records it is amended to describe');
  assert.strictEqual(pipelineState.CHAIN_STATE_SOURCE, 'pipeline-state.json', 'CHAIN_STATE_SOURCE must stay unmoved');
  ok('Leg 1: the amended header names PROJECTION and chain_state, and CHAIN_STATE_SOURCE is unmoved');
}

// ---- Leg 2: behavioral disagreement. ----
function leg2BehavioralDisagreement() {
  const tmpDir = makeScratchDir('leg2');
  const fixture = buildChainFixtureRoom(tmpDir, 'wide');

  // Seed pipeline-state.json: a 4-stage chain, 2 stages completed (position
  // index 1, i.e. steps 0 and 1 done; step 2 is next).
  const chain = ['/mos:a', '/mos:b', '/mos:c', '/mos:d'];
  pipelineState.initChain(fixture.roomDir, chain, 'manual');
  pipelineState.recordStep(fixture.roomDir, '/mos:a', 'artifacts/a.md');
  pipelineState.recordStep(fixture.roomDir, '/mos:b', 'artifacts/b.md');

  // The BEFORE answer, captured before any chain_state graph record exists
  // for this room at all.
  const before = pipelineState.checkPosition(fixture.roomDir, '/mos:c');
  assert.strictEqual(before.isNext, true, 'setup sanity: /mos:c is the next expected step per pipeline-state.json');
  assert.strictEqual(before.gate, 'run', 'setup sanity: the hard gate says run for the true next step');

  // Now seed chain_state graph records that run AHEAD of pipeline-state's
  // own position: steps 0 through 3 (the whole chain), disagreeing with the
  // store's own 2-completed-stages position.
  const runId = 'run-347-04-precedence-disagreement';
  for (let i = 0; i < chain.length; i += 1) {
    const write = chainState.writeChainStateRecord(fixture.db, {
      run_id: runId,
      step_index: i,
      kind: 'draft',
      command: chain[i],
      body: { marker: 'graph-ahead-of-store', idx: i },
      quality: 'high',
      tier: 'executable',
      produced_by: 'worker',
      subject_node_id: fixture.subjectNodeId,
    });
    assert.strictEqual(write.ok, true, 'test setup: seeding the disagreeing chain_state record for step ' + i + ' must succeed');
  }
  const graphRecords = chainState.readChainState(fixture.db, runId);
  assert.strictEqual(graphRecords.length, chain.length, 'test setup: the graph now runs the full chain, ahead of the store');

  // The AFTER answer: pipeline-state.checkPosition must return EXACTLY what
  // it returned before the graph existed. The store wins; the graph is not
  // consulted at all.
  const after = pipelineState.checkPosition(fixture.roomDir, '/mos:c');
  assert.deepStrictEqual(after, before, 'checkPosition must be byte-identical whether or not a disagreeing chain_state graph exists');
  ok('Leg 2: pipeline-state.checkPosition is provably unaffected by a chain_state graph that disagrees and runs ahead of it -- the store wins');

  closeChainFixtureRoom(fixture);
}

// ---- Leg 3: grep tripwire. ----
// The literal-substring co-occurrence of chain_state and chain_position is
// used as a proxy for "a file reads the graph to compute a resume
// position". lib/mcp/pipeline-state.cjs's own PROJECTION paragraph (Leg 1)
// lives in a comment, so it drops out once comments are stripped. The one
// pre-existing, legitimate exception is lib/core/chain-executor.cjs: its
// D-166-02 resume logic reads journal.chain_position from pipeline-state's
// OWN journal (never a chain_state graph node), and Phase 347-04 separately
// added chain_state-record-write comments to the same file for an unrelated
// reason (SHARED-03). Named here exactly as
// tests/test-254-one-chain-source.cjs's own precedent handles an analogous
// pre-existing, out-of-scope, non-violating co-occurrence: assert against a
// named ALLOWED set, never a bare count, so the guarantee still fails on
// any UNEXPECTED new file.
//
// Phase 347-09 adds a second legitimate exception: lib/mcp/tool-router.cjs.
// The visualize-chain sub-case reads chain_state records to RENDER a
// Mermaid diagram of a past run (read-only, display-only, no resume
// decision anywhere near it); the file's unrelated /mos:pipeline handling,
// ~1300 lines away, already read pipeline-state's own
// updatedState.chain_position for a "Pipeline step N of M" progress string
// (pre-existing, unrelated to the chain_state graph). The two literals
// share a file only by coincidence of the file being a large multi-command
// router; neither reads the other's data to compute a resume position.
const ALLOWED_COOCCURRENCE = new Set([
  'lib/core/chain-executor.cjs',
  'lib/mcp/tool-router.cjs',
]);

function stripComments(text) {
  const lines = text.split('\n');
  const kept = [];
  for (const line of lines) {
    const trimmed = line.replace(/^[\s]+/, '');
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    kept.push(line);
  }
  return kept.join('\n');
}

function leg3GrepTripwire() {
  // Narrow the tree scan to candidate files (grep -l is fast and avoids
  // reading 1800+ files in JS); only files matching BOTH literals even
  // loosely (comments included) are worth the comment-stripped re-check.
  let candidates = [];
  try {
    const chainStateHits = execFileSync('grep', ['-rl', '--include=*.cjs', 'chain_state', path.join(REPO, 'lib')], { encoding: 'utf8' })
      .split('\n').filter(Boolean);
    const chainPositionHits = execFileSync('grep', ['-rl', '--include=*.cjs', 'chain_position', path.join(REPO, 'lib')], { encoding: 'utf8' })
      .split('\n').filter(Boolean);
    const positionSet = new Set(chainPositionHits);
    candidates = chainStateHits.filter((f) => positionSet.has(f));
  } catch (_e) {
    // grep exits 1 when a pattern matches nothing -- treat as zero candidates.
    candidates = [];
  }

  const violations = [];
  for (const abs of candidates) {
    const rel = path.relative(REPO, abs).split(path.sep).join('/');
    const stripped = stripComments(fs.readFileSync(abs, 'utf8'));
    const hasChainState = stripped.indexOf('chain_state') !== -1;
    const hasChainPosition = stripped.indexOf('chain_position') !== -1;
    if (hasChainState && hasChainPosition && !ALLOWED_COOCCURRENCE.has(rel)) {
      violations.push(rel);
    }
  }

  assert.deepStrictEqual(violations, [], 'no unallowed file under lib/ may co-occur chain_state and chain_position in code (a proxy for reading the graph to compute a resume position): ' + JSON.stringify(violations));
  ok('Leg 3: no file under lib/ (outside the named, pre-audited allow-list) reads a chain_state node to compute a resume position');
}

function main() {
  leg1SourceScan();
  leg2BehavioralDisagreement();
  leg3GrepTripwire();

  console.log(checks + ' checks passed.');
  process.exit(0);
}

main();
