#!/usr/bin/env node
'use strict';

/*
 * Quick task 260906-fda -- the classify() step 3b known-tool-shape recognizer.
 *
 * WHY TWO LEGS (same reason test-245-egress-contentless.cjs gives). A
 * unit-only test on classify() is mutation-blind: the classifier can return
 * the right verdict while the production hook still blocks, because the hook
 * is what translates a verdict into an exit code. So this file drives:
 *
 *   LEG 1 (unit): lib/core/part8-egress-guard.cjs::classify() and its exported
 *                 seams directly.
 *   LEG 2 (hook): scripts/part8-egress-guard-hook.cjs as a child process with
 *                 a synthetic PreToolUse envelope on stdin.
 *
 * THREE CLAIMS THIS FILE SETTLES, one line each:
 *   - A genuinely safe call of each shape (find_connections {from,to,maxHops?},
 *     taxonomy_ladder {rung,question_label?}) is allowed.
 *   - The identical payload shape under the wrong tool name is NOT allowed by
 *     this new path.
 *   - A call that step 1's default-deny scan would catch never reaches the new
 *     allow path, proven BOTH through classify()'s own ordering AND by calling
 *     _proveKnownToolShape directly, out of order.
 *
 * Zero-dep: node assert + fs + path + child_process. CJS only. NO em-dashes.
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

const FIND = 'mcp__plugin_mos_mindrian-brain__find_connections';
const TAX = 'mcp__plugin_mos_mindrian-brain__taxonomy_ladder';

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

function expectNotAllow(payload, toolName, label) {
  const r = verdictOf(payload, toolName);
  ok(
    r.verdict !== 'allow',
    label + ': must NOT be allow, got ' + JSON.stringify(r)
  );
  ok(
    r.class !== 'known_tool_shape',
    label + ': must NOT carry class known_tool_shape, got ' + JSON.stringify(r)
  );
  return r;
}

// ---------------------------------------------------------------------------
// LEG 1, Arm A: happy path.
// ---------------------------------------------------------------------------
function armA() {
  console.log('--- Arm A: happy path ---');

  const a1 = expectVerdict({ from: 'Design Thinking', to: 'SWOT' }, FIND, 'allow', 'known_tool_shape', 'find_connections minimal');
  ok(a1.reason === 'find_connections from/to label pair', 'find_connections reason literal must be stable, got ' + a1.reason);

  expectVerdict({ from: 'Design Thinking', to: 'SWOT', maxHops: 3 }, FIND, 'allow', 'known_tool_shape', 'find_connections with maxHops');

  const t1 = expectVerdict({ rung: 'wicked' }, TAX, 'allow', 'known_tool_shape', 'taxonomy_ladder minimal');
  ok(t1.reason === 'taxonomy_ladder rung enum', 'taxonomy_ladder reason literal must be stable, got ' + t1.reason);

  expectVerdict({ rung: 'undefined' }, TAX, 'allow', 'known_tool_shape', 'taxonomy_ladder rung undefined');
  expectVerdict({ rung: 'ill-defined', question_label: 'framework sequencing' }, TAX, 'allow', 'known_tool_shape', 'taxonomy_ladder with question_label');
  expectVerdict({ rung: 'well-defined' }, TAX, 'allow', 'known_tool_shape', 'taxonomy_ladder rung well-defined');

  console.log('Arm A ok (' + checks + ' assertions cumulative)');
}

// ---------------------------------------------------------------------------
// LEG 1, Arm B: wrong tool name negative.
// ---------------------------------------------------------------------------
function armB() {
  console.log('--- Arm B: wrong tool name ---');

  const wrongNames = [
    'mcp__plugin_mos_mindrian-brain__brain_query',
    'mcp__plugin_mos_mindrian-brain__brain_ask',
    'mcp__plugin_mos_mindrian-brain__find_bottlenecks',
    'mcp__plugin_mos_mindrian-brain__brain_search',
    'Write',
    '',
  ];

  wrongNames.forEach(function (name) {
    expectNotAllow({ from: 'Design Thinking', to: 'SWOT' }, name, 'find_connections shape under wrong name "' + name + '"');
  });

  expectNotAllow({ rung: 'wicked' }, FIND, 'taxonomy_ladder shape under find_connections tool name');
  expectNotAllow({ from: 'Design Thinking', to: 'SWOT' }, TAX, 'find_connections shape under taxonomy_ladder tool name');

  ok(guard._proveKnownToolShape({ from: 'a', to: 'b' }, 'Write') === null, '_proveKnownToolShape must decline for tool name "Write"');
  ok(guard._proveKnownToolShape({ from: 'a', to: 'b' }, null) === null, '_proveKnownToolShape must decline for a null tool name');

  console.log('Arm B ok (' + checks + ' assertions cumulative)');
}

// ---------------------------------------------------------------------------
// LEG 1, Arm C: the smuggling negative, load-bearing.
// ---------------------------------------------------------------------------
function armC() {
  console.log('--- Arm C: smuggling negative (load-bearing) ---');

  const p1 = { from: 'jane@startup.com', to: 'SWOT' };
  expectVerdict(p1, FIND, 'block', 'content_set', 'find_connections with an email in from');
  ok(guard._proveKnownToolShape(p1, FIND) === null, '_proveKnownToolShape must independently refuse the email payload, out of classify() ordering');

  const p2 = { rung: 'wicked', question_label: 'board meeting notes re 2.3M ARR' };
  expectVerdict(p2, TAX, 'block', 'content_set', 'taxonomy_ladder with a financial idiom in question_label');
  ok(guard._proveKnownToolShape(p2, TAX) === null, '_proveKnownToolShape must independently refuse the ARR payload, out of classify() ordering');

  // A from value clean by forbidden-pattern but carrying a newline: not proof.
  expectVerdict({ from: 'Design Thinking\nsecond line', to: 'SWOT' }, FIND, 'ambiguous', 'unknown', 'find_connections with a multi-line from');

  console.log('Arm C ok (' + checks + ' assertions cumulative)');
}

// ---------------------------------------------------------------------------
// LEG 1, Arm D: drift and shape negatives.
// ---------------------------------------------------------------------------
function armD() {
  console.log('--- Arm D: drift and shape negatives ---');

  expectVerdict({ from: 'a', to: 'b', depth: 2 }, FIND, 'ambiguous', 'unknown', 'find_connections with an unrecognized extra key');
  expectVerdict({ from: 'a' }, FIND, 'ambiguous', 'unknown', 'find_connections missing to');
  expectVerdict({ to: 'b' }, FIND, 'ambiguous', 'unknown', 'find_connections missing from');
  expectVerdict({ from: 'a', to: 5 }, FIND, 'ambiguous', 'unknown', 'find_connections with a non-string to');
  expectVerdict({ from: 'a', to: 'b', maxHops: '3' }, FIND, 'ambiguous', 'unknown', 'find_connections with a string maxHops');
  expectVerdict({ from: 'a', to: 'b', maxHops: 2.5 }, FIND, 'ambiguous', 'unknown', 'find_connections with a non-integer maxHops');
  expectVerdict({ from: 'a', to: 'b', maxHops: 0 }, FIND, 'ambiguous', 'unknown', 'find_connections with maxHops of 0');
  expectVerdict({ from: '', to: 'b' }, FIND, 'ambiguous', 'unknown', 'find_connections with an empty-string from');
  expectVerdict({ from: 'x'.repeat(121), to: 'b' }, FIND, 'ambiguous', 'unknown', 'find_connections with a 121-char from');

  expectVerdict({ rung: 'sort-of-wicked' }, TAX, 'ambiguous', 'unknown', 'taxonomy_ladder with an off-enum rung');
  expectVerdict({ rung: 'wicked', label: 'x' }, TAX, 'ambiguous', 'unknown', 'taxonomy_ladder with an unrecognized extra key');
  expectVerdict({ rung: 5 }, TAX, 'ambiguous', 'unknown', 'taxonomy_ladder with a numeric rung');
  expectVerdict({ question_label: 'framework' }, TAX, 'ambiguous', 'unknown', 'taxonomy_ladder missing rung');
  expectVerdict({ rung: 'wicked', question_label: '' }, TAX, 'ambiguous', 'unknown', 'taxonomy_ladder with an empty-string question_label');

  expectVerdict([], FIND, 'ambiguous', 'unknown', 'array payload under find_connections');

  console.log('Arm D ok (' + checks + ' assertions cumulative)');
}

// ---------------------------------------------------------------------------
// LEG 1, Arm E: no-regression re-assertions.
// ---------------------------------------------------------------------------
function armE() {
  console.log('--- Arm E: no-regression ---');

  expectVerdict({}, FIND, 'allow', 'empty_payload', 'empty payload under find_connections tool name');
  expectVerdict({ a: 1 }, FIND, 'ambiguous', 'unknown', 'generic {a:1} under find_connections tool name');
  expectVerdict(
    { question: 'lean startup methodology' },
    'mcp__plugin_mos_mindrian-brain__brain_ask',
    'allow',
    'move_set',
    'shipped brain_ask methodology question'
  );
  expectVerdict(
    { cypher: 'note from jane@startup.com re: 2.3M ARR model' },
    'mcp__plugin_mos_mindrian-brain__brain_query',
    'block',
    'content_set',
    'shipped brain_query content hit'
  );
  ok(
    verdictOf(undefined, FIND).reason === 'non-object payload',
    'undefined payload must keep the "non-object payload" reason'
  );

  console.log('Arm E ok (' + checks + ' assertions cumulative)');
}

// ---------------------------------------------------------------------------
// LEG 1, Arm F: exported seams.
// ---------------------------------------------------------------------------
function armF() {
  console.log('--- Arm F: exported seams ---');

  ok(typeof guard._proveKnownToolShape === 'function', '_proveKnownToolShape must be exported');
  ok(typeof guard._isSafeShortLabel === 'function', '_isSafeShortLabel must be exported');
  ok(typeof guard._hasExactKeys === 'function', '_hasExactKeys must be exported');
  ok(guard.TAXONOMY_RUNGS && guard.TAXONOMY_RUNGS.size === 4, 'TAXONOMY_RUNGS must have exactly 4 members');
  ['undefined', 'ill-defined', 'well-defined', 'wicked'].forEach(function (r) {
    ok(guard.TAXONOMY_RUNGS.has(r), 'TAXONOMY_RUNGS must contain "' + r + '"');
  });

  console.log('Arm F ok (' + checks + ' assertions cumulative)');
}

function unitLeg() {
  armA();
  armB();
  armC();
  armD();
  armE();
  armF();
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

  const liveness = require('../scripts/check-brain-tool-liveness.cjs');
  const enumeration = await liveness.enumerateLiveBrainTools();
  if (!enumeration.names || enumeration.names.length === 0) {
    console.log('SKIP: enumerateLiveBrainTools returned no live bare tool names');
    return;
  }
  const allScoped = liveness.composeScopedNames(
    enumeration.names,
    liveness.resolvePluginName(),
    liveness.resolveServerName()
  );

  const findScoped = allScoped.find(function (n) {
    return n.indexOf('mcp__plugin_') === 0 && n.indexOf('find_connections') !== -1;
  });
  if (!findScoped) {
    console.log('SKIP: no live plugin-scoped name found containing "find_connections"');
    return;
  }
  const queryScoped = allScoped.find(function (n) {
    return n.indexOf('mcp__plugin_') === 0 && n.indexOf('brain_query') !== -1;
  });
  ok(!!queryScoped, 'setup: no live plugin-scoped name found containing "brain_query"');

  // Case A: the fix itself. Before this change this exited 2.
  const clean = JSON.stringify({
    tool_name: findScoped,
    tool_input: { from: 'Design Thinking', to: 'SWOT' },
    session_id: 'p260906-fda-a',
  });
  const a = runHook(clean, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
  ok(a.status === 0, 'HOOK A: a clean find_connections call must exit 0, got ' + a.status + ' stderr=' + JSON.stringify(a.stderr));
  ok(!/part 8/i.test(a.stderr), 'HOOK A: a clean call must render no Part 8 gate text, got stderr=' + JSON.stringify(a.stderr));

  // Case B: content-carrying, same shape, must still block.
  const dirty = JSON.stringify({
    tool_name: findScoped,
    tool_input: { from: 'jane@startup.com', to: 'SWOT' },
    session_id: 'p260906-fda-b',
  });
  const b = runHook(dirty, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
  ok(b.status === 2, 'HOOK B: a content-carrying find_connections call must still exit 2, got ' + b.status);
  ok(b.stderr && b.stderr.trim().length > 0, 'HOOK B: a block must carry gate text on stderr');
  const firstLine = (b.stderr.split('\n')[0] || '').trim();
  console.log('A1 EVIDENCE (CONTENT-SET block, stderr line 1): ' + firstLine);

  // Case C: same shape, wrong tool name, must not travel across.
  if (queryScoped) {
    const wrongTool = JSON.stringify({
      tool_name: queryScoped,
      tool_input: { from: 'Design Thinking', to: 'SWOT' },
      session_id: 'p260906-fda-c',
    });
    const c = runHook(wrongTool, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
    ok(c.status === 2, 'HOOK C: the shape must not travel across tool names at the hook either, got ' + c.status);
  }

  // Case D: Brain-less, the clean call must stay exit 0 too.
  const d = runHook(clean, { PART8_FORCE_BRAIN_AVAILABLE: '0' });
  ok(d.status === 0, 'HOOK D: the clean call must exit 0 Brain-less too, got ' + d.status);

  console.log('LEG 2 ok (' + checks + ' assertions cumulative)');
}

async function main() {
  unitLeg();
  await hookLeg();
  console.log('PASS: test-260906-fda-known-tool-shapes (' + checks + ' assertions)');
  process.exit(0);
}

main().catch(function (e) {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
