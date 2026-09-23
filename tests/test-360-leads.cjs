#!/usr/bin/env node
'use strict';
/*
 * Phase 360 Plan 03 -- lead unit legs against the shared turn-text export (R5, R6, D-02).
 *
 * Pins the lead contract of the ONE classifier this phase reuses from 357-07:
 *   - classifyUserPromptText(text) returns 'harness' for each of the five UserPromptSubmit
 *     harness leads (SPEC R5), including a CRLF framing and a whitespace-prefixed lead.
 *   - It returns 'typed' for a human prompt that merely quotes a tag mid-text (D-12), a
 *     Skill body, an image lead, and a slash-command lead (the R-A carve-out shapes).
 *   - It returns 'none' for non-string / empty input, and never throws (SPEC R6).
 *   - classifyUserPromptText(t) === classifyPrecedingUserContentSource(t, LEAD_ONLY_REC) for
 *     every string case, proving one shared rule body serves both the Stop hook and the
 *     UserPromptSubmit hook (D-02, SPEC R4).
 *   - HARNESS_LEADS is frozen, has exactly 5 entries (R5, D-10).
 *   - The Stop-path invariants (a human-origin meta record, and the 1-arg contract) are
 *     unchanged by this phase.
 *   - A 1000x call budget check (no file read on the human path, Pattern 2).
 *
 * RED until 360-06 lands turn-text.cjs's classifyUserPromptText export: this file exits 1
 * with a single "classifyUserPromptText missing (RED until 360-06)" line before running any
 * check below (the checks are still defined statically in this file so 360-06 can flip them
 * green with no test-file edit).
 *
 * Every prompt below is built from placeholders: from="sample-peer" (357/360's shared
 * placeholder peer name), no real session id, no real peer name, no socket path.
 *
 * Run: node tests/test-360-leads.cjs
 */

const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert');

const REPO_ROOT = path.resolve(__dirname, '..');
const TURN_TEXT_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'turn-text.cjs');
const PRE_PHASE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'ups-harness-360', 'pre-phase.json');

const tt = require(TURN_TEXT_PATH);

// ---------------------------------------------------------------------------
// D-19: adapt to whatever 357-07 actually shipped -- read the rec field names
// and any recorded lead_only_rec from 360-01's pre-phase.json rather than
// hard-coding a shape this test invents on its own.
// ---------------------------------------------------------------------------
let PRE_PHASE = {};
try {
  PRE_PHASE = JSON.parse(fs.readFileSync(PRE_PHASE_PATH, 'utf8'));
} catch (_e) {
  PRE_PHASE = {};
}

// pre-phase.json records lead_only_rec: null (the plan's own suggested rec shape
// reduces correctly with no fallback needed -- 360-01-SUMMARY.md, "Lead-only
// reduction probe"). Fall back to the plan's suggested shape when absent.
const LEAD_ONLY_REC = (PRE_PHASE && PRE_PHASE.lead_only_rec && typeof PRE_PHASE.lead_only_rec === 'object')
  ? PRE_PHASE.lead_only_rec
  : { isMeta: false, originKind: undefined, prevHumanUpstream: true };

// ---------------------------------------------------------------------------
// RED-until-360-06 guard (Action step 1). Every check() below is still defined
// so the file needs no edit once 360-06 lands classifyUserPromptText.
// ---------------------------------------------------------------------------
if (!tt || typeof tt.classifyUserPromptText !== 'function') {
  console.log('classifyUserPromptText missing (RED until 360-06)');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Leg harness: check(name, fn) prints "  ok - <name>" or "  FAIL - <name>: ..."
// with the stack, and the file exits 1 if any check failed.
// ---------------------------------------------------------------------------
let checks = 0;
let failed = 0;

function check(name, fn) {
  checks += 1;
  try {
    fn();
    console.log('  ok - ' + name);
  } catch (e) {
    failed += 1;
    console.log('  FAIL - ' + name + ': ' + (e && e.message ? e.message : String(e)));
    if (e && e.stack) console.log(e.stack);
  }
}

// assertHarness / assertTyped: assert the classification AND the one-rule-body
// equivalence (D-02) in the same leg, so every case pins both facts at once.
function assertHarness(text, label) {
  const v = tt.classifyUserPromptText(text);
  assert.strictEqual(v, 'harness', label + ': expected harness, got ' + v);
  const eq = tt.classifyPrecedingUserContentSource(text, LEAD_ONLY_REC);
  assert.strictEqual(v, eq, label + ': classifyUserPromptText/classifyPrecedingUserContentSource mismatch');
}

function assertTyped(text, label) {
  const v = tt.classifyUserPromptText(text);
  assert.strictEqual(v, 'typed', label + ': expected typed, got ' + v);
  const eq = tt.classifyPrecedingUserContentSource(text, LEAD_ONLY_REC);
  assert.strictEqual(v, eq, label + ': classifyUserPromptText/classifyPrecedingUserContentSource mismatch');
}

console.log('test-360-leads.cjs (360-03): lead unit legs against the shared turn-text export');

// ----- R5: the five harness lead shapes (placeholders only, from="sample-peer") ----------

const TASK_NOTIFICATION_LEAD =
  '<task-notification>\n<task-id>sample-task-1</task-id>\n<status>completed</status>\n'
  + '<summary>Sample agent finished</summary>\n</task-notification>';

const CROSS_SESSION_MESSAGE_LEAD =
  '<cross-session-message from="sample-peer">\nSample cross-session body text.\n</cross-session-message>';

const AGENT_MESSAGE_LEAD =
  '<agent-message from="sample-peer">\nSample agent hand-back body text.\n</agent-message>';

const PEER_FRAMED_LF =
  'Another Claude session sent a message:\n<agent-message from="sample-peer">\nSample body.\n</agent-message>';

const PEER_FRAMED_WORKING_LF =
  'Another Claude session sent a message while you were working:\n'
  + '<cross-session-message from="sample-peer">\nSample body.\n</cross-session-message>';

const PEER_FRAMED_CRLF =
  'Another Claude session sent a message:\r\n<agent-message from="sample-peer">\r\nSample body.\r\n</agent-message>';

const IDLE_NOTICE =
  '[Cross-session idle notice] Session sample-peer has been idle.';

check('harness: task-notification tag lead', function () {
  assertHarness(TASK_NOTIFICATION_LEAD, 'task-notification tag lead');
});

check('harness: cross-session-message tag lead (from=sample-peer)', function () {
  assertHarness(CROSS_SESSION_MESSAGE_LEAD, 'cross-session-message tag lead');
});

check('harness: agent-message tag lead (from=sample-peer)', function () {
  assertHarness(AGENT_MESSAGE_LEAD, 'agent-message tag lead');
});

check('harness: peer framing (LF) then a tag', function () {
  assertHarness(PEER_FRAMED_LF, 'peer framing (LF) then a tag');
});

check('harness: peer framing while-you-were-working (LF) then a tag (Pitfall 6)', function () {
  assertHarness(PEER_FRAMED_WORKING_LF, 'peer framing while-you-were-working (LF) then a tag');
});

check('harness: peer framing (CRLF) then a tag', function () {
  assertHarness(PEER_FRAMED_CRLF, 'peer framing (CRLF) then a tag');
});

check('harness: bracketed cross-session idle notice', function () {
  assertHarness(IDLE_NOTICE, 'bracketed cross-session idle notice');
});

// "any of these preceded by spaces or newlines" -- a representative sample across
// different lead shapes, not every combination.
check('harness: task-notification tag lead preceded by spaces', function () {
  assertHarness('   ' + TASK_NOTIFICATION_LEAD, 'task-notification tag lead + leading spaces');
});

check('harness: cross-session-message tag lead preceded by newlines', function () {
  assertHarness('\n\n' + CROSS_SESSION_MESSAGE_LEAD, 'cross-session-message tag lead + leading newlines');
});

check('harness: peer framing (CRLF) preceded by spaces', function () {
  assertHarness('  ' + PEER_FRAMED_CRLF, 'peer framing (CRLF) + leading spaces');
});

check('harness: bracketed idle notice preceded by newlines', function () {
  assertHarness('\n' + IDLE_NOTICE, 'bracketed idle notice + leading newlines');
});

// ----- Typed (non-harness) shapes, including the D-12 mid-text carve-out -----------------

check('typed: a human sentence quoting a task-notification tag mid-text (D-12)', function () {
  assertTyped(
    'I saw a weird message today that started with <task-notification> in the log, '
    + 'which confused me. Any idea what it means?',
    'human sentence quoting a task-notification tag mid-text'
  );
});

check('typed: a Skill body leading "Base directory for this skill:"', function () {
  assertTyped(
    'Base directory for this skill: /home/sample/skills/example-skill\n'
    + 'Rest of the Skill body text follows here.',
    'Skill body lead'
  );
});

check('typed: "[Image #1]" then text', function () {
  assertTyped('[Image #1]\nHere is a screenshot of the issue I am seeing.', 'image lead');
});

check('typed: a slash-command lead "<command-message>"', function () {
  assertTyped(
    '<command-message>sample-command</command-message>\n<command-name>sample-command</command-name>',
    'slash-command lead'
  );
});

check('typed: a plain human sentence', function () {
  assertTyped('Can you help me refactor this function to avoid the race condition?', 'plain human sentence');
});

// ----- 'none', never throws --------------------------------------------------------------

check('none: empty string', function () {
  assert.strictEqual(tt.classifyUserPromptText(''), 'none');
});

check('none: undefined', function () {
  assert.strictEqual(tt.classifyUserPromptText(undefined), 'none');
});

check('none: null', function () {
  assert.strictEqual(tt.classifyUserPromptText(null), 'none');
});

check('none: a number (42)', function () {
  assert.strictEqual(tt.classifyUserPromptText(42), 'none');
});

check('none: a plain object', function () {
  assert.strictEqual(tt.classifyUserPromptText({}), 'none');
});

check('none: an empty array', function () {
  assert.strictEqual(tt.classifyUserPromptText([]), 'none');
});

// ----- HARNESS_LEADS shape (R5, D-10) ----------------------------------------------------

check('HARNESS_LEADS is frozen with exactly 5 entries matching R5/D-10 as a set', function () {
  assert.strictEqual(Object.isFrozen(tt.HARNESS_LEADS), true, 'HARNESS_LEADS must be frozen');
  assert.strictEqual(tt.HARNESS_LEADS.length, 5, 'HARNESS_LEADS must have exactly 5 entries');
  // The 37-char peer stem (Pitfall 6), not the brittler 40-char LCP with the embedded
  // newline and tag-start.
  const peerStem = 'Another Claude session sent a message';
  assert.strictEqual(peerStem.length, 37, 'peer stem must be exactly 37 chars');
  const expected = [
    '<task-notification',
    '[Cross-session idle notice]',
    peerStem,
    '<cross-session-message',
    '<agent-message',
  ].slice().sort();
  const got = tt.HARNESS_LEADS.slice().sort();
  assert.deepStrictEqual(got, expected, 'HARNESS_LEADS set mismatch, got: ' + JSON.stringify(got));
});

// ----- Stop-path invariants (unchanged by this phase) ------------------------------------

check('Stop-path: a human-origin record with a tag lead stays typed', function () {
  const rec = { isMeta: false, originKind: 'human', prevHumanUpstream: true };
  const v = tt.classifyPrecedingUserContentSource(AGENT_MESSAGE_LEAD, rec);
  assert.strictEqual(v, 'typed', 'a human-origin record leading with a tag must stay typed');
});

check('Stop-path: the 1-arg contract is unchanged (typed, tool_result, none, none)', function () {
  assert.strictEqual(tt.classifyPrecedingUserContentSource('hello world'), 'typed');
  assert.strictEqual(
    tt.classifyPrecedingUserContentSource([{ type: 'tool_result', tool_use_id: 'sample-tool-use' }]),
    'tool_result'
  );
  assert.strictEqual(tt.classifyPrecedingUserContentSource(''), 'none');
  assert.strictEqual(tt.classifyPrecedingUserContentSource(null), 'none');
});

// ----- Hook budget: 1000 calls on a 4 KB human prompt under 200 ms -----------------------

check('1000 calls on a 4 KB human prompt take under 200 ms (hook budget, no file read)', function () {
  let big = 'Can you help me refactor this function to avoid the race condition? ';
  while (big.length < 4096) big += big;
  big = big.slice(0, 4096);
  const start = Date.now();
  for (let i = 0; i < 1000; i += 1) {
    tt.classifyUserPromptText(big);
  }
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 200, '1000 calls took ' + elapsed + 'ms, expected under 200ms');
});

console.log('PASS test-360-leads.cjs (' + checks + ' checks)');
if (failed > 0) process.exit(1);
