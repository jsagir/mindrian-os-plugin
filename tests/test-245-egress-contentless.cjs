#!/usr/bin/env node
'use strict';

/*
 * Phase 245-03 (R5 / F-4, F-5) -- the Part 8 contentless-payload fix, pinned at
 * BOTH levels.
 *
 * WHY TWO LEGS. A unit-only test on classify() is the mutation-blind shape the
 * Phase 244 verifier flagged: the classifier can return the right verdict while
 * the production hook still blocks, because the hook is what translates
 * 'ambiguous' + brainAvailable() into exit 2. So this file drives:
 *
 *   LEG 1 (unit): lib/core/part8-egress-guard.cjs::classify() directly.
 *   LEG 2 (hook): scripts/part8-egress-guard-hook.cjs as a child process with a
 *                 synthetic PreToolUse envelope on stdin and
 *                 PART8_FORCE_BRAIN_AVAILABLE=1, so the BLOCK branch is
 *                 deterministically reachable with no live Brain wire.
 *
 * WHAT IS BEING PROVEN, in one line each:
 *   - A zero-key payload ({}) classifies as allow / empty_payload and passes
 *     the hook with exit 0. This unblocks brain-client.cjs:575
 *     callTool('brain_stats', {}) and :488 callTool('brain_schema', {}).
 *   - Anything carrying a byte still falls to the UNCHANGED fail-closed
 *     catch-all: {a:1}, {question:''}, [], null, undefined all stay ambiguous.
 *   - A CONTENT-SET payload still blocks, at both the classifier and the hook.
 *
 * The hook leg's scoped tool names are DERIVED at run time from
 * scripts/check-brain-tool-liveness.cjs (the same authority
 * tests/part8-egress-guard-hook.test.cjs uses), never hand-typed: the hook
 * calls sanitizer.isBrainTool(toolName) BEFORE classify(), so a bare name would
 * allow() before the classifier ever runs and the test would pass vacuously.
 *
 * Zero-dep: node assert + child_process. CJS only. NO em-dashes.
 *
 * License: BSL 1.1.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GUARD = path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const HOOK = path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs');

const guard = require(GUARD);

const STATS_TOOL = 'mcp__plugin_mos_mindrian-brain__brain_stats';
const SCHEMA_TOOL = 'mcp__plugin_mos_mindrian-brain__brain_schema';

let checks = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  checks++;
}

function verdictOf(payload, toolName) {
  return guard.classify(payload, { toolName: toolName });
}

function expectVerdict(payload, toolName, wantVerdict, wantClass, label) {
  const r = verdictOf(payload, toolName);
  ok(
    r && r.verdict === wantVerdict,
    label + ': expected verdict "' + wantVerdict + '", got ' + JSON.stringify(r)
  );
  if (wantClass) {
    ok(
      r.class === wantClass,
      label + ': expected class "' + wantClass + '", got ' + JSON.stringify(r)
    );
  }
  return r;
}

// ---------------------------------------------------------------------------
// LEG 1: the unit verdicts.
// ---------------------------------------------------------------------------
function unitLeg() {
  console.log('--- LEG 1: classify() unit verdicts ---');

  // The fix itself: the two shipped contentless callers.
  expectVerdict({}, STATS_TOOL, 'allow', 'empty_payload', 'brain_stats {}');
  expectVerdict({}, SCHEMA_TOOL, 'allow', 'empty_payload', 'brain_schema {}');

  // The recognizer is PAYLOAD-shaped, not tool-scoped, and that is deliberate.
  // Asserted so the behavior is a decision on record, not an accident.
  expectVerdict({}, 'Write', 'allow', 'empty_payload', 'non-Brain tool {}');
  expectVerdict({}, '', 'allow', 'empty_payload', 'empty tool name {}');

  // Fail-closed: a missing envelope field is NOT an explicitly empty object.
  expectVerdict(undefined, STATS_TOOL, 'ambiguous', 'unknown', 'undefined payload');
  ok(
    verdictOf(undefined, STATS_TOOL).reason === 'non-object payload',
    'undefined payload must keep the "non-object payload" reason'
  );
  expectVerdict(null, STATS_TOOL, 'ambiguous', 'unknown', 'null payload');

  // Spoofing guard (T-245-12): an empty ARRAY is not a plain object.
  expectVerdict([], STATS_TOOL, 'ambiguous', 'unknown', 'empty array payload');

  // Any key at all falls through to the UNCHANGED catch-all.
  expectVerdict({ a: 1 }, STATS_TOOL, 'ambiguous', 'unknown', '{a:1}');
  expectVerdict({ question: '' }, STATS_TOOL, 'ambiguous', 'unknown', "{question:''}");
  expectVerdict({ topK: 5 }, SCHEMA_TOOL, 'ambiguous', 'unknown', '{topK:5}');

  // The default-deny scan still runs FIRST and still blocks (T-245-11).
  expectVerdict(
    { cypher: 'note from jane@startup.com re: 2.3M ARR model' },
    'mcp__plugin_mos_mindrian-brain__brain_query',
    'block',
    'content_set',
    'CONTENT-SET payload'
  );

  // The pre-existing free-form allow path is untouched.
  expectVerdict(
    { question: 'lean startup methodology' },
    'mcp__plugin_mos_mindrian-brain__brain_ask',
    'allow',
    'move_set',
    'brain_ask methodology question'
  );

  // Quick task 260807-h5s is the reversal authority: the Phase 245 D-28 FLAGGED
  // disposition (brain_search deliberately left out of _isFreeFormTool) was
  // REVERSED with navigator approval, so the inverse assertion that used to sit
  // here is replaced by its positive twin.
  ok(
    guard._isFreeFormTool('mcp__plugin_mos_mindrian-brain__brain_search') === true,
    'quick 260807-h5s: _isFreeFormTool must now recognize a scoped brain_search name'
  );

  // The recognizer is exported as a test seam.
  ok(
    typeof guard._isProvablyEmptyPayload === 'function',
    '_isProvablyEmptyPayload must be exported alongside the other test seams'
  );
  ok(guard._isProvablyEmptyPayload({}) === true, '_isProvablyEmptyPayload({}) must be true');
  ok(guard._isProvablyEmptyPayload([]) === false, '_isProvablyEmptyPayload([]) must be false');
  ok(guard._isProvablyEmptyPayload(null) === false, '_isProvablyEmptyPayload(null) must be false');
  ok(
    guard._isProvablyEmptyPayload(undefined) === false,
    '_isProvablyEmptyPayload(undefined) must be false'
  );
  ok(
    guard._isProvablyEmptyPayload({ a: 1 }) === false,
    '_isProvablyEmptyPayload({a:1}) must be false'
  );

  console.log('LEG 1 ok (' + checks + ' assertions)');
}

// ---------------------------------------------------------------------------
// LEG 2: the production hook chain.
// ---------------------------------------------------------------------------
function runHook(stdin, extraEnv) {
  const env = Object.assign({}, process.env, extraEnv || {});
  const res = spawnSync(process.execPath, [HOOK], { input: stdin, env: env, encoding: 'utf8' });
  return { status: res.status, stderr: res.stderr || '' };
}

async function hookLeg() {
  console.log('--- LEG 2: part8-egress-guard-hook.cjs child-process exit codes ---');

  if (!fs.existsSync(HOOK)) {
    console.log('SKIP: scripts/part8-egress-guard-hook.cjs absent');
    return;
  }

  // Derive live SCOPED names from the shipped liveness authority. The hook
  // calls isBrainTool() before classify(), so a bare name allows vacuously.
  const liveness = require('../scripts/check-brain-tool-liveness.cjs');
  const enumeration = await liveness.enumerateLiveBrainTools();
  ok(
    enumeration.names && enumeration.names.length > 0,
    'setup: enumerateLiveBrainTools must return at least one live bare tool name'
  );
  const allScoped = liveness.composeScopedNames(
    enumeration.names,
    liveness.resolvePluginName(),
    liveness.resolveServerName()
  );
  function scopedContaining(bare) {
    const hit = allScoped.find(function (n) {
      return n.indexOf('mcp__plugin_') === 0 && n.indexOf(bare) !== -1;
    });
    ok(!!hit, 'setup: no live plugin-scoped name found containing "' + bare + '"');
    return hit;
  }
  const statsScoped = scopedContaining('brain_stats');
  const queryScoped = scopedContaining('brain_query');

  // Case A: the contentless call the fix exists to unblock -> exit 0, no gate.
  const contentless = JSON.stringify({
    tool_name: statsScoped,
    tool_input: {},
    session_id: 'p245-03-a',
  });
  const a = runHook(contentless, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
  ok(
    a.status === 0,
    'HOOK A: contentless brain_stats must exit 0 even with Brain available, got ' + a.status +
      ' stderr=' + JSON.stringify(a.stderr)
  );
  ok(
    !/part 8/i.test(a.stderr),
    'HOOK A: contentless call must render NO leak-prevention gate, got stderr=' +
      JSON.stringify(a.stderr)
  );

  // Case B: a content-carrying payload must still block -> exit 2 + gate text.
  const contentful = JSON.stringify({
    tool_name: queryScoped,
    tool_input: { cypher: 'note from jane@startup.com re: 2.3M ARR model' },
    session_id: 'p245-03-b',
  });
  const b = runHook(contentful, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
  ok(
    b.status === 2,
    'HOOK B: content-carrying Brain payload must still exit 2 (block), got ' + b.status
  );
  ok(
    b.stderr && b.stderr.trim().length > 0,
    'HOOK B: a block must carry gate text on stderr'
  );

  // Research Assumption A1: record which branch actually fired by printing the
  // verbatim first stderr line of the blocking case.
  const firstLine = (b.stderr.split('\n')[0] || '').trim();
  console.log('A1 EVIDENCE (CONTENT-SET block, stderr line 1): ' + firstLine);

  // Case C: the AMBIGUOUS branch, which is the one a pre-fix contentless
  // brain_stats fell into. Driving it with a payload that carries a key (so
  // the new recognizer cannot claim it) reproduces the exact card the live
  // session saw, and its verbatim text settles A1: gate render vs the minimal
  // Part 8 notice vs a hook timeout (a timeout emits neither).
  const ambiguous = JSON.stringify({
    tool_name: statsScoped,
    tool_input: { a: 1 },
    session_id: 'p245-03-c',
  });
  const c = runHook(ambiguous, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
  ok(
    c.status === 2,
    'HOOK C: an ambiguous payload with Brain available must still exit 2 (catch-all untouched), got ' +
      c.status
  );
  const ambigLine = (c.stderr.split('\n')[0] || '').trim();
  console.log('A1 EVIDENCE (ambiguous block, stderr line 1): ' + ambigLine);

  // Case D: the same contentless call with Brain UNAVAILABLE stays exit 0.
  const d = runHook(contentless, { PART8_FORCE_BRAIN_AVAILABLE: '0' });
  ok(d.status === 0, 'HOOK D: contentless call must exit 0 Brain-less too, got ' + d.status);

  console.log('LEG 2 ok (' + checks + ' assertions cumulative)');
}

async function main() {
  unitLeg();
  await hookLeg();
  console.log('PASS: test-245-egress-contentless (unit leg + hook leg, ' + checks + ' assertions)');
  process.exit(0);
}

main().catch(function (e) {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
