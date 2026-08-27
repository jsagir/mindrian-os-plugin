#!/usr/bin/env node
/**
 * Phase 265 Plan 19 tripwire -- whole-transcript scope, no-agent-writes,
 * consolidation-before-gate ordering, and the preserved F.8 approval gate,
 * for the 5-perspective parallel dispatch this plan added to
 * commands/file-meeting.md and references/meeting/extraction-perspectives.md.
 *
 * Five arms. Arm 5 DELIBERATELY OVERLAPS plan 265-10's arm 4
 * (tests/test-265-file-meeting-gates.cjs, "approval gate not bypassed"): the
 * fan-out this plan ships is the most likely FUTURE edit to weaken that gate
 * (a consolidation step that "helpfully" auto-files a high-confidence claim
 * is exactly the kind of change that would slip past a reviewer focused on
 * the dispatch mechanics), so the check lives next to the fan-out too. This
 * is intentional redundancy, not duplication -- stated here so a future
 * reader does not "simplify" it away.
 *
 * ARM 3 DESIGN NOTE (read before touching this file): a naive
 * `raw.indexOf('writeClaimNode')` finds the WORKER-SIDE negative mention
 * first ("An explicit no-write... contract: ... No `writeClaimNode`, no
 * `writeEdge`...", inside Step 3a's dispatch prompt) -- that is the command
 * correctly STATING the contract a worker must honor, not the write itself.
 * The plan's own wording ("the consolidation region contains writeClaimNode")
 * means the ACTUAL call site, which lives in Step 3b. So arm 3 scopes its
 * search for `writeClaimNode` to text AT OR AFTER the `### Step 3b` heading,
 * mirroring how plan 265-10's own gate test learned (via its own header
 * comment) that a naive substring match on a bypass phrase can false-positive
 * on the sentence that PROVES the invariant holds.
 *
 * Reads commands/file-meeting.md and references/meeting/extraction-perspectives.md
 * as TEXT ONLY. Does not execute the command. Pure Node.js built-ins, zero npm
 * deps. NO em-dashes (CLAUDE.md HARD RULE).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CMD = path.join(REPO_ROOT, 'commands', 'file-meeting.md');
const PERSPECTIVES = path.join(REPO_ROOT, 'references', 'meeting', 'extraction-perspectives.md');

let failures = 0;
let passes = 0;

function report(armName, ok, detail) {
  if (ok) {
    passes += 1;
    console.log('PASS arm ' + armName);
  } else {
    failures += 1;
    console.log('FAIL arm ' + armName + (detail ? ': ' + detail : ''));
  }
}

for (const p of [CMD, PERSPECTIVES]) {
  if (!fs.existsSync(p)) {
    console.error('FATAL: ' + p + ' not found');
    process.exit(1);
  }
}

const cmdRaw = fs.readFileSync(CMD, 'utf8');
const perspRaw = fs.readFileSync(PERSPECTIVES, 'utf8');

// ---------------------------------------------------------------------------
// ARM 1: PERSPECTIVE SET INTEGRITY.
// Parse the five perspective headings out of the reference file (## N. Name),
// assert exactly five, that every knowledge_type enum value and every segment
// type appears at least once across the file, and that the command file
// names the reference file.
// ---------------------------------------------------------------------------
(function armPerspectiveSetIntegrity() {
  const headingRe = /^## \d+\. .+$/gm;
  const headings = perspRaw.match(headingRe) || [];
  const problems = [];

  if (headings.length !== 5) {
    problems.push('expected exactly 5 numbered perspective headings, found ' + headings.length +
      ' (' + JSON.stringify(headings) + ')');
  }

  const KNOWLEDGE_TYPES = ['fact', 'causal', 'heuristic', 'anomaly_cue', 'mental_model', 'assumption'];
  const missingKT = KNOWLEDGE_TYPES.filter((kt) => perspRaw.indexOf(kt) === -1);
  if (missingKT.length > 0) {
    problems.push('missing knowledge_type value(s) in extraction-perspectives.md: ' + JSON.stringify(missingKT));
  }

  const SEGMENT_TYPES = ['decision', 'action-item', 'insight', 'advice', 'question', 'noise'];
  const missingST = SEGMENT_TYPES.filter((st) => perspRaw.indexOf(st) === -1);
  if (missingST.length > 0) {
    problems.push('missing segment type value(s) in extraction-perspectives.md: ' + JSON.stringify(missingST));
  }

  if (cmdRaw.indexOf('extraction-perspectives') === -1) {
    problems.push('commands/file-meeting.md never names extraction-perspectives.md');
  }

  report('1-perspective-set-integrity', problems.length === 0, problems.join('; '));
})();

// ---------------------------------------------------------------------------
// ARM 2: WHOLE-TRANSCRIPT SCOPE.
// The dispatch region must instruct a whole-transcript pass, and the file
// must contain ZERO occurrences of "chunk" (case-insensitive) anywhere --
// a chunked worker cannot notice what only its lens would notice, and the
// fan-out is bought for recall, not for splitting the work into pieces.
// ---------------------------------------------------------------------------
(function armWholeTranscriptScope() {
  const step3aIdx = cmdRaw.indexOf('### Step 3a');
  const step3bIdx = cmdRaw.indexOf('### Step 3b');
  if (step3aIdx === -1 || step3bIdx === -1 || step3aIdx >= step3bIdx) {
    report('2-whole-transcript-scope', false,
      'could not locate a Step 3a...Step 3b dispatch region (3a=' + step3aIdx + ', 3b=' + step3bIdx + ')');
    return;
  }
  const dispatchRegion = cmdRaw.slice(step3aIdx, step3bIdx);
  const hasFullTranscript = /full transcript/i.test(dispatchRegion);
  const chunkCount = (cmdRaw.match(/chunk/gi) || []).length;

  const problems = [];
  if (!hasFullTranscript) {
    problems.push('dispatch region (Step 3a) does not contain a whole-transcript instruction ' +
      '("full transcript", case-insensitive)');
  }
  if (chunkCount > 0) {
    problems.push(chunkCount + ' occurrence(s) of "chunk" found -- the fan-out is bought for ' +
      'recall, and a chunked worker cannot notice what only its lens would notice');
  }
  report('2-whole-transcript-scope', problems.length === 0, problems.join('; '));
})();

// ---------------------------------------------------------------------------
// ARM 3: NO-AGENT-WRITES CONTRACT.
// The dispatch region (Step 3a) must contain a read-only or no-write phrase.
// The consolidation region (at or after "### Step 3b") must contain the
// ACTUAL writeClaimNode call site. The read-only contract must precede it.
// See the header comment above for why this is scoped past Step 3b, not a
// naive global indexOf.
// ---------------------------------------------------------------------------
(function armNoAgentWritesContract() {
  const step3aIdx = cmdRaw.indexOf('### Step 3a');
  const step3bIdx = cmdRaw.indexOf('### Step 3b');
  if (step3aIdx === -1 || step3bIdx === -1) {
    report('3-no-agent-writes', false, 'could not locate Step 3a / Step 3b headings');
    return;
  }
  const dispatchRegion = cmdRaw.slice(step3aIdx, step3bIdx);
  const hasReadOnlyOrNoWrite = /read-only|no-write|does not write/i.test(dispatchRegion);

  const consolidationRegion = cmdRaw.slice(step3bIdx);
  const writeCallOffsetInRegion = consolidationRegion.indexOf('writeClaimNode');

  const problems = [];
  if (!hasReadOnlyOrNoWrite) {
    problems.push('dispatch region (Step 3a) contains no read-only/no-write phrase');
  }
  if (writeCallOffsetInRegion === -1) {
    problems.push('consolidation region (Step 3b onward) never calls writeClaimNode');
  }
  if (problems.length === 0) {
    // Both present: the read-only phrase (anywhere in Step 3a, i.e. before
    // step3bIdx) is, by construction of the region split, BEFORE the
    // writeClaimNode call site (which lives at or after step3bIdx). This
    // proves the write lives downstream of the workers, per the WAL
    // contention reason: lib/core/room-db.cjs folds a 5-second busy timeout
    // into DatabaseSync precisely because a background worker and a live
    // conversation can both hold write intent on the same WAL file.
    report('3-no-agent-writes', true);
  } else {
    report('3-no-agent-writes', false, problems.join('; '));
  }
})();

// ---------------------------------------------------------------------------
// ARM 4: CONSOLIDATION BEFORE GATE.
// Edge minting (REFINES) and the claim write (writeClaimNode) must both
// complete before the F.8 routing table is rendered (renderShapeF8), because
// the table is built from the consolidated set.
// ---------------------------------------------------------------------------
(function armConsolidationBeforeGate() {
  const refinesIdx = cmdRaw.indexOf('REFINES');
  const renderIdx = cmdRaw.indexOf('renderShapeF8');
  const step3bIdx = cmdRaw.indexOf('### Step 3b');
  const writeIdxInConsolidation = step3bIdx === -1 ? -1 : cmdRaw.indexOf('writeClaimNode', step3bIdx);

  const problems = [];
  if (refinesIdx === -1) problems.push('REFINES not found');
  if (renderIdx === -1) problems.push('renderShapeF8 not found');
  if (writeIdxInConsolidation === -1) problems.push('writeClaimNode not found at or after Step 3b');

  if (problems.length === 0) {
    if (!(refinesIdx < renderIdx)) {
      problems.push('REFINES (offset ' + refinesIdx + ') is not before renderShapeF8 (offset ' + renderIdx + ')');
    }
    if (!(writeIdxInConsolidation < renderIdx)) {
      problems.push('writeClaimNode (offset ' + writeIdxInConsolidation + ') is not before renderShapeF8 (offset ' + renderIdx + ')');
    }
  }
  report('4-consolidation-before-gate', problems.length === 0, problems.join('; '));
})();

// ---------------------------------------------------------------------------
// ARM 5: GATE NOT WEAKENED.
// Deliberately overlaps plan 265-10's arm 4 (see header comment). Asserts
// review_status and agent_attribution_forbidden survive, the F.8 nugget
// table header survives, and none of the bypass phrases appear un-negated.
// ---------------------------------------------------------------------------
function findUnnegatedBypass(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(never|not)?\\s*' + escaped, 'gi');
  const hits = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!m[1]) hits.push(m.index);
  }
  return hits;
}

(function armGateNotWeakened() {
  const hasReviewStatus = cmdRaw.indexOf('review_status') !== -1;
  const hasAgentAttribution = cmdRaw.indexOf('agent_attribution_forbidden') !== -1;
  const hasNuggetTableHeader = cmdRaw.indexOf('| nugget | target section | why |') !== -1;
  const BYPASS_PHRASES = ['auto-confirm', 'auto-file', 'files automatically', 'without approval'];
  const foundBypass = BYPASS_PHRASES.filter((p) => findUnnegatedBypass(cmdRaw, p).length > 0);

  const problems = [];
  if (!hasReviewStatus) problems.push('missing literal "review_status"');
  if (!hasAgentAttribution) problems.push('missing literal "agent_attribution_forbidden"');
  if (!hasNuggetTableHeader) problems.push('missing the "| nugget | target section | why |" table header');
  if (foundBypass.length > 0) problems.push('found forbidden bypass phrase(s): ' + JSON.stringify(foundBypass));

  report('5-gate-not-weakened', problems.length === 0, problems.join('; '));
})();

console.log('');
console.log('Phase 265 Plan 19 file-meeting perspectives tripwire: ' + passes + ' passed, ' + failures + ' failed');

if (failures > 0) {
  process.exit(1);
}
