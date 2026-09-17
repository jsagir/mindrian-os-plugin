#!/usr/bin/env node
'use strict';

/*
 * Quick task 260917-dgf -- pin the Part 8 hook's ambiguous-verdict disposition.
 *
 * THE DEFECT. `scripts/part8-egress-guard-hook.cjs` converts every AMBIGUOUS
 * verdict into a hard block (exit 2) on trusted Brain scopes, while
 * `lib/core/brain-client.cjs::callTool` classifies the SAME args and PROCEEDS
 * with an additive `egress_disclosure { ..., disposition: 'proceeded' }`. The
 * two enforcement points diverge, and they diverge backwards: the hook is
 * stricter than the shim's own stated policy, and a PreToolUse hook cannot
 * render the Shape F.1 card anyway, so the card JSON lands on stderr as an
 * unreadable error string. A plain-English `brain_ask` that carries zero user
 * bytes gets refused with a card nobody can read. `lib/core/brain-client.cjs`
 * `callTool` is the second enforcement point this hook is being aligned with.
 *
 * LEG 0 (classifier unchanged, the mutation guard). Calls
 * `lib/core/part8-egress-guard.cjs::classify()` DIRECTLY on the four A-payloads
 * and asserts each still returns ambiguous / freeform_unmatched. This leg must
 * pass BOTH before and after Task 2. Its job is to make it impossible to "fix"
 * this defect by widening METHODOLOGY_VOCAB or otherwise editing the
 * classifier: if someone does, this leg goes red and names the file that must
 * not have changed.
 *
 * LEG 1 (hook exit codes, child process). Drives
 * `scripts/part8-egress-guard-hook.cjs` as a child process with a synthetic
 * PreToolUse envelope on stdin, PART8_FORCE_BRAIN_AVAILABLE seam. `runHook`
 * copied verbatim from tests/test-260906-fda-known-tool-shapes.cjs:239.
 *
 * LEG 2 (predicate self-validation). Pins the shapes of `isBrainTool` /
 * `isBrainShapedTool` so a future change to the matchers cannot silently turn
 * every hand-typed name in this file into a vacuous fixture.
 *
 * WHY THE TOOL NAMES ARE HAND-TYPED LITERALS, NOT DERIVED from
 * scripts/check-brain-tool-liveness.cjs: the contract under test is the
 * hook's TRUST predicate keyed on the tool-name SHAPE, so this test must stay
 * deterministic and runnable with no live Brain handshake; live-name parity
 * is already owned by test-245 / test-260906-fda / test-239-brain-tool-
 * liveness, and LEG 2 above pins the shapes so the literals cannot go
 * vacuous. The same hand-typed-fixture precedent is already set by the
 * FOREIGN_SERVER fixture in tests/part8-egress-guard-hook.test.cjs.
 *
 * FAILURE REPORTING: does NOT throw on the first failure. Accumulates
 * failures and prints one `FAIL: <case-id> <message>` line per failure, then
 * process.exit(1) if any failed. The RED run (before Task 2 lands) must print
 * exactly four FAIL lines (A1, A2, A3, A4) and nothing else -- the evidence
 * that B/C/D/E/F already hold and only the disposition is wrong.
 *
 * Zero-dep: node:assert, node:path, node:child_process only. CJS only.
 * NO em-dashes, NO en-dashes -- hyphens only.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const GUARD = path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const HOOK = path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs');
const SANITIZER = path.join(ROOT, 'lib', 'core', 'brain-response-sanitize.cjs');

const guard = require(GUARD);
const sanitizer = require(SANITIZER);

const failures = [];
function fail(caseId, message) {
  failures.push('FAIL: ' + caseId + ' ' + message);
}
function check(caseId, cond, message) {
  if (!cond) fail(caseId, message);
}

// ---------------------------------------------------------------------------
// Hand-typed tool-name literals (see docblock above for why).
// ---------------------------------------------------------------------------
const TRUSTED_SEARCH = 'mcp__plugin_mos_mindrian-brain__brain_search';
const TRUSTED_QUERY = 'mcp__plugin_mos_mindrian-brain__brain_query';
const TRUSTED_ASK = 'mcp__plugin_mos_mindrian-brain__brain_ask';
const UNTRUSTED_SEARCH = 'mcp__theo__brain_search';

// ---------------------------------------------------------------------------
// LEG 0: classifier unchanged (mutation guard). Runs BOTH before and after
// Task 2's hook edit; if this leg ever goes red, the classifier itself was
// touched, which is out of scope for this plan.
// ---------------------------------------------------------------------------
function leg0ClassifierUnchanged() {
  const cases = [
    ['A1', { query: 'effectuation' }, TRUSTED_SEARCH],
    ['A2', { query: 'dual-use' }, TRUSTED_SEARCH],
    ['A3', { cypher: 'MATCH (c:Chapter) WHERE c.id IN ["ch-12","ch-27"] RETURN c.id, c.title' }, TRUSTED_QUERY],
    ['A4', { question: 'what comes after customer interviews when the market is unproven' }, TRUSTED_ASK],
  ];
  cases.forEach(function (c) {
    const id = 'LEG0-' + c[0];
    const r = guard.classify(c[1], { toolName: c[2] });
    check(id, r && r.verdict === 'ambiguous', id + ': expected verdict ambiguous, got ' + JSON.stringify(r));
    check(id, r && r.class === 'freeform_unmatched', id + ': expected class freeform_unmatched, got ' + JSON.stringify(r));
  });
}

// ---------------------------------------------------------------------------
// LEG 1: hook exit codes over a child process.
// ---------------------------------------------------------------------------
function runHook(stdin, extraEnv) {
  const env = Object.assign({}, process.env, extraEnv || {});
  const res = spawnSync(process.execPath, [HOOK], { input: stdin, env: env, encoding: 'utf8' });
  return { status: res.status, stderr: res.stderr || '' };
}

function envelope(toolName, toolInput, sessionId) {
  return JSON.stringify({ tool_name: toolName, tool_input: toolInput, session_id: sessionId });
}

function leg1HookDisposition() {
  // A1-A4 (exit 0 expected AFTER Task 2; today these are the RED evidence):
  // a trusted plugin scope, an ambiguous freeform_unmatched verdict, Brain
  // available -- the call must reach the shim, not die at the hook.
  const aCases = [
    ['A1', TRUSTED_SEARCH, { query: 'effectuation' }, 'p260917-a1'],
    ['A2', TRUSTED_SEARCH, { query: 'dual-use' }, 'p260917-a2'],
    ['A3', TRUSTED_QUERY, { cypher: 'MATCH (c:Chapter) WHERE c.id IN ["ch-12","ch-27"] RETURN c.id, c.title' }, 'p260917-a3'],
    ['A4', TRUSTED_ASK, { question: 'what comes after customer interviews when the market is unproven' }, 'p260917-a4'],
  ];
  aCases.forEach(function (c) {
    const id = c[0];
    const r = runHook(envelope(c[1], c[2], c[3]), { PART8_FORCE_BRAIN_AVAILABLE: '1' });
    check(id, r.status === 0, id + ': expected exit 0 (trusted scope, ambiguous freeform_unmatched must proceed to the shim), got ' + r.status + ' stderr=' + JSON.stringify(r.stderr));
    check(id, !/part 8/i.test(r.stderr), id + ': expected no Part 8 text on stderr, got ' + JSON.stringify(r.stderr));
  });

  // B (exit 2, passes today and after): step-1 default-deny proof. A
  // CONTENT-SET payload on the same trusted scope must still block.
  (function caseB() {
    const r = runHook(
      envelope(TRUSTED_ASK, { question: 'our Series A closed at $4M ARR with jane.doe@example.com' }, 'p260917-b'),
      { PART8_FORCE_BRAIN_AVAILABLE: '1' }
    );
    check('B', r.status === 2, 'B: a content-carrying payload on a trusted scope must still exit 2, got ' + r.status);
    check('B', r.stderr && r.stderr.trim().length > 0 && /part 8/i.test(r.stderr), 'B: block must carry Part 8 stderr text, got ' + JSON.stringify(r.stderr));
  })();

  // C (exit 2, passes today and after): untrusted Brain-shaped key keeps the
  // block. This is also where the F.1 gate render coverage now lives.
  (function caseC() {
    const r = runHook(
      envelope(UNTRUSTED_SEARCH, { query: 'effectuation' }, 'p260917-c'),
      { PART8_FORCE_BRAIN_AVAILABLE: '1' }
    );
    check('C', r.status === 2, 'C: an ambiguous payload on an untrusted Brain-shaped key must still exit 2, got ' + r.status);
    check('C', r.stderr && r.stderr.trim().length > 0, 'C: block must carry non-empty stderr, got ' + JSON.stringify(r.stderr));
  })();

  // D (exit 2, passes today and after): unproven_packet is a typed structure
  // that failed proof, not a free-form string; deliberately not widened.
  (function caseD() {
    const r = runHook(
      envelope(TRUSTED_ASK, { packet_version: '1.0', job: 'not_a_shipped_job', summary: 'raw prose' }, 'p260917-d'),
      { PART8_FORCE_BRAIN_AVAILABLE: '1' }
    );
    check('D', r.status === 2, 'D: an unproven typed packet on a trusted scope must still exit 2, got ' + r.status);
  })();

  // E (exit 0, passes today and after): Brain-less path unchanged.
  (function caseE() {
    const r = runHook(
      envelope(TRUSTED_SEARCH, { query: 'effectuation' }, 'p260917-e'),
      { PART8_FORCE_BRAIN_AVAILABLE: '0' }
    );
    check('E', r.status === 0, 'E: the Brain-less path must stay exit 0, got ' + r.status);
  })();

  // F (exit 0, passes today and after): proven MOVE-SET unchanged.
  (function caseF() {
    const r = runHook(
      envelope(TRUSTED_SEARCH, { query: 'effectuation framework' }, 'p260917-f'),
      { PART8_FORCE_BRAIN_AVAILABLE: '1' }
    );
    check('F', r.status === 0, 'F: a proven MOVE-SET payload must stay exit 0, got ' + r.status);
  })();
}

// ---------------------------------------------------------------------------
// LEG 2: predicate self-validation (3 assertions). Without this, a future
// change to the matchers could silently turn every hand-typed name in this
// file into a vacuous fixture.
// ---------------------------------------------------------------------------
function leg2PredicateSelfValidation() {
  check('LEG2-1', sanitizer.isBrainTool(TRUSTED_SEARCH) === true, 'LEG2-1: isBrainTool(' + TRUSTED_SEARCH + ') must be true');
  check('LEG2-2', sanitizer.isBrainTool(UNTRUSTED_SEARCH) === false, 'LEG2-2: isBrainTool(' + UNTRUSTED_SEARCH + ') must be false');
  check('LEG2-3', sanitizer.isBrainShapedTool(UNTRUSTED_SEARCH) === true, 'LEG2-3: isBrainShapedTool(' + UNTRUSTED_SEARCH + ') must be true');
}

function main() {
  leg0ClassifierUnchanged();
  leg1HookDisposition();
  leg2PredicateSelfValidation();

  if (failures.length > 0) {
    failures.forEach(function (line) { console.log(line); });
    process.exit(1);
  }
  console.log('PASS: test-260917-dgf-part8-hook-disposition (all legs green)');
  process.exit(0);
}

main();
