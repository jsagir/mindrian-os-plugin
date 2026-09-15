#!/usr/bin/env node
'use strict';

/*
 * tests/test-347-meeting-fanout-records.cjs -- Phase 347 Plan 11 Task 2.
 *
 * Proves the migration this plan lands: commands/file-meeting.md Step 3a
 * persists each of the five perspectives' returned rows as a chain_state
 * record BEFORE Step 3b's consolidation reads them, and the consolidation
 * reads them back through navigation.readChainState rather than from the
 * orchestrator's own context window (docs/2026-09-14-CHAIN-SHARED-STATE-
 * CONTRACT.md, SHARED-11).
 *
 * Two halves, deliberately kept apart:
 *
 *   THE SOURCE-CONTRACT HALF (tests 1-3) reads commands/file-meeting.md with
 *   fs.readFileSync and runs named regexes against it, copying the
 *   source-scan idiom of tests/test-chain-executor-part8-leak.cjs (name a
 *   surface, name the forbidden or required token, fail with a labeled
 *   message). This is the honest proof for the PROMPT half of the migration:
 *   the command file is a markdown prompt whose executor is the host, not a
 *   program this test can run.
 *
 *   THE GRAPH HALF (tests 4-7) uses tests/helpers/fixture-room-347.cjs and
 *   lib/core/navigation/chain-state.cjs directly, writing five SYNTHETIC
 *   perspective row arrays (the same 14-field shape extraction-
 *   perspectives.md's return schema promises, stubbed here since a real
 *   perspective payload requires an LLM call this test cannot make) and
 *   asserting the mechanism -- ordering, anchoring, recoverability, and edge
 *   discipline -- actually holds. Run across all three schema variants,
 *   matching the discipline in tests/test-347-chain-state-writer.cjs.
 *
 * ONE THING THIS TEST DELIBERATELY DOES NOT DO: it does not dispatch real subagents
 * and does not run the command. commands/file-meeting.md is a
 * markdown prompt whose executor is the host (Claude Code, Desktop, or
 * Cowork); a test that claimed to run it would be the fabricated-success
 * shape chain-step-dispatcher.cjs:10-19 warns about (a test reporting a
 * capability that was never actually exercised). The source-contract half is
 * the honest proof for the prompt half; the graph half is the honest proof
 * for the mechanism half. Together they prove the seam the plan actually
 * changed -- the record-per-perspective write before the merge -- without
 * pretending to prove the LLM judgment on either side of it.
 *
 * Plain node:assert CJS script, one file per behavior cluster (the repo's
 * own convention). Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const COMMAND_PATH = path.join(REPO, 'commands', 'file-meeting.md');

const { buildChainFixtureRoom, closeChainFixtureRoom, SCHEMA_VARIANTS } =
  require(path.join(REPO, 'tests', 'helpers', 'fixture-room-347.cjs'));
const chainState = require(path.join(REPO, 'lib', 'core', 'navigation', 'chain-state.cjs'));

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

// ---------------------------------------------------------------------------
// The source-contract half (tests 1-3). Named helpers so the same checks run
// against both the real file and, for the red-proof, a hand-mutated temp copy.
// ---------------------------------------------------------------------------

const WORKER_PROMPT_START = "**Each worker's prompt MUST carry:**";
const WORKER_PROMPT_END = '**Returns:**';

/*
 * extractWorkerPromptContractBlock(text) -> the text between the worker-
 * prompt contract's own two headings. By heading, never by line number, so
 * the check does not break the next time the file grows (plan's own
 * instruction). Throws if either heading cannot be found, since a missing
 * heading means the contract itself moved or was deleted, which is exactly
 * the kind of drift this test exists to catch.
 */
function extractWorkerPromptContractBlock(text) {
  const startIdx = text.indexOf(WORKER_PROMPT_START);
  if (startIdx === -1) {
    throw new Error('test-347-meeting-fanout-records: could not find the worker-prompt '
      + 'contract start heading "' + WORKER_PROMPT_START + '"');
  }
  const endIdx = text.indexOf(WORKER_PROMPT_END, startIdx);
  if (endIdx === -1 || endIdx <= startIdx) {
    throw new Error('test-347-meeting-fanout-records: could not find the worker-prompt '
      + 'contract end heading "' + WORKER_PROMPT_END + '" after its start');
  }
  return text.slice(startIdx, endIdx);
}

/*
 * Test 1 (source contract): the file names the pre-merge write, names
 * readChainState at the merge, and names the meeting run-id prefix, so a
 * future edit that removes the migration turns this red.
 */
function assertTest1PreMergeWriteAndReadback(text, label) {
  assert.ok(/writeChainStateRecord/.test(text),
    label + ': must name writeChainStateRecord (the pre-merge write)');
  assert.ok(/Persist each perspective before the merge/.test(text),
    label + ': must name the pre-merge sub-step ("Persist each perspective before the merge")');
  assert.ok(/readChainState/.test(text),
    label + ': must name readChainState (the merge readback)');
  assert.ok(/'meeting:'\s*\+\s*sessionId/.test(text),
    label + ": must name the meeting run-id prefix ('meeting:' + sessionId)");
  // WR-01 (347 code review): a run_id scoped ONLY to the session collides
  // across two meetings filed in the same session (an ordinary workflow) --
  // the second filing's five upsert-semantics rows silently overwrite the
  // first filing's persisted records under the identical five node ids.
  // These three checks pin the per-filing fix in place: a future edit that
  // reverts to the bare session-only `run_id: 'meeting:' + sessionId,` (no
  // per-filing component) turns this red, even though the weaker prefix
  // check above would still pass (the fixed expression still CONTAINS that
  // prefix as its own leading substring).
  assert.ok(/const meetingRunId\s*=\s*'meeting:'\s*\+\s*sessionId\s*\+\s*':'\s*\+\s*Date\.now\(\)/.test(text),
    label + ": must mint a per-filing meetingRunId ('meeting:' + sessionId + ':' + Date.now()), "
    + 'not a session-only run_id (WR-01, 347 code review)');
  assert.ok(/run_id:\s*meetingRunId/.test(text),
    label + ': the per-perspective write must key on the per-filing meetingRunId, not a session-only run_id');
  assert.ok(/readChainState\(db,\s*meetingRunId\)/.test(text),
    label + ': the merge readback must read back the SAME per-filing meetingRunId the write used');
}

/*
 * Test 2 (recall guard): the FULL-transcript sentence and its reason are
 * still present, and no sentence in the worker-prompt contract instructs
 * budgeting or truncating the extractor's input. Scanned ONLY inside the
 * worker-prompt contract block (extracted by heading), never over the whole
 * file, since "over budget" legitimately appears elsewhere (the Transcript
 * size probe's own failure-mode prose) and is not a truncation instruction.
 *
 * NEGATION-AWARE (measured fact, matching the same class of narrowing
 * tests/test-347-layer-graph-declaration.cjs's own header documents for its
 * Test 3): the block legitimately contains the forbidden vocabulary TWICE
 * today, both times to FORBID it, never to instruct it -- "Not a partial
 * excerpt, not a segment range" (the FULL-transcript bullet's own protective
 * sentence) and "A plan that budgeted the extractors' input would destroy
 * the reason the fan-out exists" (the per-node-scoping note this same plan
 * adds). A bare unconditional word scan would trip on both, which would
 * punish the very sentences that protect the recall guarantee. This test
 * scans sentence-by-sentence and only fails on a forbidden word found in a
 * sentence that carries NO negation cue (not/never/forbidden/does not/
 * cannot/would destroy/no); a forbidden word inside a sentence that already
 * negates it is the protection working as intended, not a violation of it.
 * An AFFIRMATIVE instruction (e.g. "send each worker a 2000-word excerpt")
 * carries the forbidden word with no negation cue in the same sentence and
 * still trips this test.
 */
const FORBIDDEN_BUDGETING_PATTERN = /\b(truncat\w*|excerpt\w*|budget\w*|char(?:acter)?\s*cap)\b/i;
const NEGATION_CUE_PATTERN = /\b(not\b|never\b|forbidden|would destroy|does not|cannot|no\s)/i;

function findAffirmativeBudgetingSentence(block) {
  // Naive sentence split (good enough for a prose guard, not a parser): each
  // run of non-terminator characters ending in . ! or ?.
  const sentences = block.match(/[^.!?]*[.!?]/g) || [block];
  for (const sentence of sentences) {
    if (FORBIDDEN_BUDGETING_PATTERN.test(sentence) && !NEGATION_CUE_PATTERN.test(sentence)) {
      return sentence.trim();
    }
  }
  return null;
}

function assertTest2RecallGuard(text, label) {
  const block = extractWorkerPromptContractBlock(text);
  assert.ok(/FULL transcript/.test(block),
    label + ': the worker-prompt contract block must still carry the FULL transcript bullet');
  assert.ok(/bought for recall/.test(block),
    label + ': the worker-prompt contract block must still state the recall reason');
  const offending = findAffirmativeBudgetingSentence(block);
  assert.ok(!offending,
    label + ': the worker-prompt contract block must not instruct budgeting or truncating '
    + 'the extractor input, found an affirmative sentence: ' + JSON.stringify(offending));
}

/*
 * Test 3 (single-writer guard): the writeClaimNode call is still described
 * as exactly once per consolidated claim from the single main-thread handle,
 * and no second write call was added anywhere in the file. Pinned against
 * the measured pre-migration baseline (5 occurrences total, exactly 1 literal
 * call-with-params site) rather than an arbitrary threshold, so a second
 * writer silently added anywhere in the file trips this.
 */
const WRITE_CLAIM_NODE_BASELINE_COUNT = 5;
const WRITE_CLAIM_NODE_CALL_SITE = /navigation\.writeClaimNode\(db, params\)/g;

function countOccurrences(text, pattern) {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  const m = text.match(re);
  return m ? m.length : 0;
}

function assertTest3SingleWriterGuard(text, label) {
  const totalMentions = countOccurrences(text, /writeClaimNode/g);
  assert.strictEqual(totalMentions, WRITE_CLAIM_NODE_BASELINE_COUNT,
    label + ': writeClaimNode must appear exactly ' + WRITE_CLAIM_NODE_BASELINE_COUNT
    + ' times (measured pre-migration baseline); a different count means a second writer '
    + 'was added or the existing contract prose was weakened');
  const callSites = countOccurrences(text, WRITE_CLAIM_NODE_CALL_SITE);
  assert.strictEqual(callSites, 1,
    label + ': exactly one literal navigation.writeClaimNode(db, params) call site must exist');
  assert.ok(/ONCE PER CONSOLIDATED CLAIM/.test(text),
    label + ': must still state ONCE PER CONSOLIDATED CLAIM');
  assert.ok(/SINGLE MAIN-THREAD DB HANDLE/.test(text),
    label + ': must still state the single main-thread db handle rule');
}

console.log('test-347-meeting-fanout-records:');
console.log(' source-contract half:');

const commandText = fs.readFileSync(COMMAND_PATH, 'utf8');

assertTest1PreMergeWriteAndReadback(commandText, 'commands/file-meeting.md');
ok('Test 1: names the pre-merge write, the readback, and the meeting run-id prefix');

assertTest2RecallGuard(commandText, 'commands/file-meeting.md');
ok('Test 2: the FULL-transcript recall guard holds, no budgeting/truncation language in the worker-prompt block');

assertTest3SingleWriterGuard(commandText, 'commands/file-meeting.md');
ok('Test 3: writeClaimNode is still the single writer, exactly once per consolidated claim');

// ---------------------------------------------------------------------------
// Red-proof: a hand-mutation that deletes every occurrence of the literal
// token "readChainState" from a temp (in-memory) copy of the command text
// makes Test 1 throw. Proves Test 1 is not vacuously true (it is not just
// checking that the file exists) -- a global token replace is used rather
// than matching the exact wrapped sentence verbatim, since the sentence
// itself line-wraps mid-call (`navigation.readChainState(db, 'meeting:' +\n
// sessionId)`) and a brittle whitespace-sensitive pattern would be the wrong
// thing to pin in a red-proof.
// ---------------------------------------------------------------------------
{
  const mutatedNoReadback = commandText.split('readChainState').join('REMOVED_READBACK_TOKEN');
  assert.notStrictEqual(mutatedNoReadback, commandText,
    'red-proof setup: the mutation must actually change the text (the readChainState token must exist verbatim)');
  assert.throws(
    () => assertTest1PreMergeWriteAndReadback(mutatedNoReadback, 'mutated temp copy (readChainState token removed)'),
    /readChainState/,
    'red-proof: deleting every readChainState token must make Test 1 throw'
  );
  ok('red-proof: a hand-mutation removing every readChainState token makes Test 1 throw');
}

// ---------------------------------------------------------------------------
// The graph half (tests 4-7). Synthetic perspective payloads: the 14-field
// uniform return-schema shape extraction-perspectives.md promises, stubbed
// since no LLM call runs in this test. SCHEMA_VARIANTS from fixture-room-347
// (wide, mid, legacy), matching tests/test-347-chain-state-writer.cjs.
// ---------------------------------------------------------------------------

const PERSPECTIVE_NAMES = Object.freeze([
  'Decisions and Commitments',
  'Technical Claims and Causal Mechanisms',
  'Open Questions and Unknowns',
  'Risks, Blockers and Anomaly Cues',
  'Stakeholder Dynamics and Working Models',
]);

function makeSyntheticPerspectiveRows(perspectiveName, idx) {
  // A stub 14-field row array, one row, matching the uniform return schema's
  // field names (extraction-perspectives.md). Deliberately not exhaustive
  // (one row is enough to prove the record-per-perspective write and
  // readback; the schema's own shape is not this test's subject).
  return [{
    segment_id: 'seg-' + idx,
    speaker_id: 'speaker-' + idx,
    segment_type: 'decision',
    priority: 'HIGH',
    claim_text: 'synthetic claim from ' + perspectiveName,
    knowledge_type: 'fact',
    conditions: '',
    counter_conditions: '',
    valid_from: '',
    valid_until: '',
    disambiguation: '',
    confidence: 0.8,
    reasoning_line: 'synthetic reasoning line',
    perspective: perspectiveName,
  }];
}

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-347-meeting-fanout-' + suffix + '-'));
}

function edgeRows(db, edgeType) {
  return db.prepare('SELECT source, target, properties FROM edges WHERE type = ?').all(edgeType);
}

console.log(' graph half (' + SCHEMA_VARIANTS.join(', ') + '):');

for (const variant of SCHEMA_VARIANTS) {
  console.log('  variant: ' + variant);
  const tmpDir = makeScratchDir(variant);
  let fixture = null;
  try {
    fixture = buildChainFixtureRoom(tmpDir, variant);
    const db = fixture.db;
    const sessionId = 'test-session-' + variant;
    const runId = 'meeting:' + sessionId;

    // ---- Write all five perspectives, exactly as Step 3a's new sub-step
    // instructs: kind notes, tier host_dispatch, produced_by worker, body
    // the worker's returned row array verbatim, subject_node_id the anchor
    // (the fixture's seeded subject node stands in for the room root node
    // the real command anchors to; the writer's own anchor discipline is
    // schema-and-target agnostic). ----
    const writes = PERSPECTIVE_NAMES.map((name, idx) => {
      const rows = makeSyntheticPerspectiveRows(name, idx);
      const result = chainState.writeChainStateRecord(db, {
        run_id: runId,
        step_index: idx,
        command: 'file-meeting',
        kind: 'notes',
        body: rows,
        quality: null,
        tier: 'host_dispatch',
        produced_by: 'worker',
        subject_node_id: fixture.subjectNodeId,
      });
      return { idx, name, rows, result };
    });

    writes.forEach((w) => {
      assert.strictEqual(w.result.ok, true, variant + ': perspective ' + w.idx + ' (' + w.name + ') must write successfully');
    });

    // ---- Test 4 (graph readback, unit): five notes records written for one
    // run id with perspective indices 0-4 are returned by readChainState in
    // perspective order, each anchored by SOURCED_FROM to the same session
    // node, and chained by FEEDS_INTO. ----
    const readBack = chainState.readChainState(db, runId);
    assert.strictEqual(readBack.length, 5, variant + ': readChainState must return all five perspective records');
    readBack.forEach((rec, i) => {
      assert.strictEqual(rec.step_index, i, variant + ': record at position ' + i + ' must carry step_index ' + i + ' (perspective order)');
      assert.strictEqual(rec.kind, 'notes', variant + ': every perspective record must carry kind notes');
      assert.strictEqual(rec.produced_by, 'worker', variant + ': every perspective record must carry produced_by worker');
    });

    const sourcedFromForRun = edgeRows(db, 'SOURCED_FROM').filter((e) => writes.some((w) => w.result.node_id === e.source));
    assert.strictEqual(sourcedFromForRun.length, 5, variant + ': all five perspective records must carry a SOURCED_FROM anchor edge');
    sourcedFromForRun.forEach((e) => {
      assert.strictEqual(e.target, fixture.subjectNodeId, variant + ': every SOURCED_FROM anchor must point at the same subject (session) node');
    });

    const feedsIntoForRun = edgeRows(db, 'FEEDS_INTO').filter((e) =>
      writes.some((w) => w.result.node_id === e.source) && writes.some((w) => w.result.node_id === e.target));
    assert.strictEqual(feedsIntoForRun.length, 4, variant + ': four FEEDS_INTO edges must chain five perspective records in order');
    ok(variant + ': Test 4 -- five perspective records, ordered, anchored to the same subject, chained by FEEDS_INTO');

    // ---- Test 5 (reconstructibility of a perspective): given only the run
    // id, the rows perspective 3 returned are recoverable in full. ----
    const perspective3 = readBack.find((r) => r.step_index === 3);
    assert.ok(perspective3, variant + ': perspective 3 record must be recoverable from the run id alone');
    assert.deepStrictEqual(perspective3.body, writes[3].rows,
      variant + ': perspective 3 recovered body must deep-equal exactly what it returned, not a summary');
    ok(variant + ': Test 5 -- perspective 3 rows are recoverable in full from the run id alone');

    // ---- Test 6 (refusal honesty): a record whose subject node does not
    // exist is refused with missing_structural_anchor, and the refusal is
    // reportable per perspective rather than silently dropping a lens. ----
    const brokenRunId = 'meeting:' + sessionId + '-broken';
    const refusalReport = PERSPECTIVE_NAMES.map((name, idx) => {
      const rows = makeSyntheticPerspectiveRows(name, idx);
      const subjectId = idx === 2 ? 'section:does-not-exist-347-meeting-fanout' : fixture.subjectNodeId;
      const result = chainState.writeChainStateRecord(db, {
        run_id: brokenRunId,
        step_index: idx,
        command: 'file-meeting',
        kind: 'notes',
        body: rows,
        quality: null,
        tier: 'host_dispatch',
        produced_by: 'worker',
        subject_node_id: subjectId,
      });
      return { idx, name, ok: result.ok, reason: result.reason };
    });
    const refused = refusalReport.filter((r) => !r.ok);
    assert.strictEqual(refused.length, 1, variant + ': exactly one perspective (the unanchorable one) must be refused');
    assert.strictEqual(refused[0].idx, 2, variant + ': the refusal must be attributable to the specific perspective index that failed (2), not silently dropped');
    assert.strictEqual(refused[0].reason, 'missing_structural_anchor', variant + ': the refusal reason must be missing_structural_anchor');
    const succeeded = refusalReport.filter((r) => r.ok);
    assert.strictEqual(succeeded.length, 4, variant + ': the other four perspectives must still write successfully -- one refusal never blocks the batch');
    ok(variant + ': Test 6 -- an unanchorable perspective is refused and attributable by index, the other four still land');

    // ---- Test 7 (edge discipline): each SOURCED_FROM edge's properties
    // JSON carries only the two scalars, so a 14-field row body never rides
    // an edge. ----
    sourcedFromForRun.forEach((e) => {
      const props = JSON.parse(e.properties || '{}');
      assert.deepStrictEqual(Object.keys(props).sort(), ['run_id', 'step_index'],
        variant + ': SOURCED_FROM edge properties must carry exactly run_id and step_index, never a claim body');
      assert.strictEqual(typeof props.run_id, 'string', variant + ': run_id must be a scalar string');
      assert.strictEqual(typeof props.step_index, 'number', variant + ': step_index must be a scalar number');
    });
    ok(variant + ': Test 7 -- every SOURCED_FROM edge carries only run_id and step_index, scalar-only, never a body');
  } finally {
    if (fixture) closeChainFixtureRoom(fixture);
  }
}

console.log(checks + ' checks passed.');
process.exit(0);
