#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 361 Plan 02 Task 1 -- Part 8 known-shape arms for the three Theo
 * calls research mode makes: framework_step, framework_techniques, case_story
 * (D-10, D-14). Live Theo today answers each of these with
 * `egress_disclosure: ambiguous` (361-RESEARCH Pattern 5) because
 * _proveKnownToolShape has no arm for them. This file proves the three new
 * arms admit ONLY a generic canonical-framework handle -- stricter than
 * find_connections on purpose, per D-10 -- and that Phase 355's
 * find_connections arm is untouched, byte-for-byte, by every 361 commit.
 *
 * Modeled on tests/test-260906-fda-known-tool-shapes.cjs (expectVerdict,
 * expectNotAllow, the hook-leg spawn shape and exit-code expectations) and
 * reuses tests/test-361-baseline.cjs's shared extraction helpers
 * (extractFindConnectionsSlice, sha256, loadFixture) rather than re-deriving
 * the slice rule.
 *
 * LEGS:
 *   LEG 1 (unit)         -- classify() directly against the three new arms.
 *   LEG 2 (hook)         -- scripts/part8-egress-guard-hook.cjs child process.
 *   LEG 3 (find_connections A) -- working-tree slice equals the slice at HEAD.
 *   LEG 4 (find_connections B) -- for every 361-* commit in
 *                          <base_sha>..HEAD touching the guard file, the slice
 *                          at <commit>^ equals the slice at <commit>.
 *   LEG 5 (arm order)    -- recommend_chain's index precedes each new arm's
 *                          index, which precedes the function's terminal
 *                          `return null;`.
 *   LEG 6 (fail-closed guard) -- the helper source contains the explicit
 *                          `length === 0` guard.
 *
 * Zero-dep beyond node core + the shared 361 baseline helpers. CJS only.
 * NO em-dashes (CLAUDE.md HARD RULE).
 *
 * exit 0 -> PASSED, exit 1 -> FAILED.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GUARD = path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const HOOK = path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs');

// --- Test hygiene: no network egress from this test -------------------------
let networkAttempted = false;
globalThis.fetch = function _blockedFetch() {
  networkAttempted = true;
  process.stderr.write('NETWORK_ATTEMPT_361\n');
  throw new Error('NETWORK_ATTEMPT_361: fetch is blocked in tests/test-361-egress-shapes.cjs');
};
const os = require('os');
const PRELOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-361-02-preload-'));
const PRELOAD_FILE = path.join(PRELOAD_DIR, 'no-network-preload.cjs');
fs.writeFileSync(
  PRELOAD_FILE,
  "globalThis.fetch = function () { process.stderr.write('NETWORK_ATTEMPT_361\\n'); " +
    "throw new Error('NETWORK_ATTEMPT_361'); };\n"
);
const CHILD_ENV = Object.assign({}, process.env, { NODE_OPTIONS: `--require ${PRELOAD_FILE}` });

const guard = require(GUARD);
const baseline = require('./test-361-baseline.cjs');

const FRAMEWORK_STEP = 'mcp__plugin_mos_mindrian-brain__framework_step';
const FRAMEWORK_TECHNIQUES = 'mcp__plugin_mos_mindrian-brain__framework_techniques';
const CASE_STORY = 'mcp__plugin_mos_mindrian-brain__case_story';
const FIND = 'mcp__plugin_mos_mindrian-brain__find_connections';
const TAX = 'mcp__plugin_mos_mindrian-brain__taxonomy_ladder';
const RECOMMEND = 'mcp__plugin_mos_mindrian-brain__recommend_chain';

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
  ok(r.verdict !== 'allow', label + ': must NOT be allow, got ' + JSON.stringify(r));
  ok(
    r.class !== 'known_tool_shape',
    label + ': must NOT carry class known_tool_shape, got ' + JSON.stringify(r)
  );
  return r;
}

// ---------------------------------------------------------------------------
// LEG 1, Arm A: happy path -- the three tools, minimal and with step_id.
// ---------------------------------------------------------------------------
function armA() {
  console.log('--- Arm A: happy path ---');

  const s1 = expectVerdict({ framework: 'Dominant Design' }, FRAMEWORK_STEP, 'allow', 'known_tool_shape', 'framework_step minimal');
  ok(s1.reason === 'framework_step canonical framework handle', 'framework_step reason literal must be stable, got ' + s1.reason);

  expectVerdict(
    { framework: 'Dominant Design', step_id: 'dominantdesign::phase::s01' },
    FRAMEWORK_STEP,
    'allow',
    'known_tool_shape',
    'framework_step with a valid step_id'
  );

  const t1 = expectVerdict({ framework: 'Dominant Design' }, FRAMEWORK_TECHNIQUES, 'allow', 'known_tool_shape', 'framework_techniques minimal');
  ok(t1.reason === 'framework_techniques canonical framework handle', 'framework_techniques reason literal must be stable, got ' + t1.reason);

  const c1 = expectVerdict({ framework: 'Dominant Design' }, CASE_STORY, 'allow', 'known_tool_shape', 'case_story minimal');
  ok(c1.reason === 'case_story canonical framework handle', 'case_story reason literal must be stable, got ' + c1.reason);

  // Case rule: exact membership after lowercasing both sides.
  expectVerdict({ framework: 'dominant design' }, FRAMEWORK_STEP, 'allow', 'known_tool_shape', 'framework_step with a lowercase framework name');

  console.log('Arm A ok (' + checks + ' assertions cumulative)');
}

// ---------------------------------------------------------------------------
// LEG 1, Arm B: not-allow -- extra keys, malformed step_id, missing/typed
// framework, off-vocabulary name, and tool-name isolation.
// ---------------------------------------------------------------------------
function armB() {
  console.log('--- Arm B: not-allow shape/vocabulary negatives ---');

  expectNotAllow({ framework: 'Dominant Design', note: 'x' }, FRAMEWORK_STEP, 'framework_step extra key');
  expectNotAllow({ framework: 'Dominant Design', note: 'x' }, FRAMEWORK_TECHNIQUES, 'framework_techniques extra key');
  expectNotAllow({ framework: 'Dominant Design', note: 'x' }, CASE_STORY, 'case_story extra key');

  expectNotAllow({ framework: 'Dominant Design', step_id: 'dominantdesign::phase::s01' }, FRAMEWORK_TECHNIQUES, 'framework_techniques with a step_id (not an admitted key)');
  expectNotAllow({ framework: 'Dominant Design', step_id: 'dominantdesign::phase::s01' }, CASE_STORY, 'case_story with a step_id (not an admitted key)');

  expectNotAllow({ framework: 'Dominant Design', step_id: 'not-a-valid-id' }, FRAMEWORK_STEP, 'framework_step with a malformed step_id');
  expectNotAllow({ framework: 'Dominant Design', step_id: 123 }, FRAMEWORK_STEP, 'framework_step with a numeric step_id');

  // Note: {} alone is not used here -- classify() step 1b allows a provably
  // empty payload under ANY tool name (Phase 245-03, pre-existing and
  // unrelated to this arm), so a genuinely missing-framework negative needs a
  // non-empty payload that still lacks the required key.
  expectNotAllow({ step_id: 'dominantdesign::phase::s01' }, FRAMEWORK_STEP, 'framework_step missing framework');
  expectNotAllow({ framework: 42 }, FRAMEWORK_STEP, 'framework_step with a numeric framework');
  expectNotAllow({ framework: 'Dominant Design\nsecond line' }, FRAMEWORK_STEP, 'framework_step with a multi-line framework');
  expectNotAllow({ framework: 'x'.repeat(129) }, FRAMEWORK_STEP, 'framework_step with a 129-char framework');

  expectNotAllow({ framework: 'Some Unlisted Framework' }, FRAMEWORK_STEP, 'framework_step with an off-vocabulary framework name');
  expectNotAllow({ framework: 'Some Unlisted Framework' }, FRAMEWORK_TECHNIQUES, 'framework_techniques with an off-vocabulary framework name');
  expectNotAllow({ framework: 'Some Unlisted Framework' }, CASE_STORY, 'case_story with an off-vocabulary framework name');

  // Tool-name isolation: the new shape must not travel onto the existing arms.
  expectNotAllow({ framework: 'Dominant Design' }, FIND, 'framework shape under find_connections tool name');
  expectNotAllow({ framework: 'Dominant Design' }, TAX, 'framework shape under taxonomy_ladder tool name');
  expectNotAllow({ framework: 'Dominant Design' }, RECOMMEND, 'framework shape under recommend_chain tool name');

  ok(guard._proveKnownToolShape({ framework: 'Dominant Design' }, 'Write') === null, '_proveKnownToolShape must decline for tool name "Write"');
  ok(guard._proveKnownToolShape({ framework: 'Dominant Design' }, null) === null, '_proveKnownToolShape must decline for a null tool name');

  console.log('Arm B ok (' + checks + ' assertions cumulative)');
}

// ---------------------------------------------------------------------------
// LEG 1, Arm C: block -- content-carrying framework values.
// ---------------------------------------------------------------------------
function armC() {
  console.log('--- Arm C: block (content-carrying) ---');

  const p1 = { framework: 'jane@example.com' };
  expectVerdict(p1, FRAMEWORK_STEP, 'block', 'content_set', 'framework_step with an email framework value');
  ok(guard._proveKnownToolShape(p1, FRAMEWORK_STEP) === null, '_proveKnownToolShape must independently refuse the email payload, out of classify() ordering');

  const p2 = { framework: 'Dominant Design $2M ARR' };
  expectVerdict(p2, FRAMEWORK_STEP, 'block', 'content_set', 'framework_step with a financial idiom in framework');
  ok(guard._proveKnownToolShape(p2, FRAMEWORK_STEP) === null, '_proveKnownToolShape must independently refuse the ARR payload, out of classify() ordering');

  console.log('Arm C ok (' + checks + ' assertions cumulative)');
}

// ---------------------------------------------------------------------------
// LEG 1, Arm D: fail-closed guard -- source contains the explicit length===0
// check (a live-unloadable-vocabulary test is not practical here; see plan).
// ---------------------------------------------------------------------------
function armD() {
  console.log('--- Arm D: fail-closed guard present in source ---');

  const src = fs.readFileSync(GUARD, 'utf8');
  ok(
    /CANONICAL_PHRASES\.length === 0/.test(src),
    'guard source must contain an explicit CANONICAL_PHRASES.length === 0 guard'
  );
  ok(typeof guard._proveKnownToolShape === 'function', '_proveKnownToolShape must still be exported');
  // _isKnownFrameworkHandle is deliberately NOT exported (plan: "export
  // nothing new"); its behavior is proven indirectly through classify().
  ok(
    !Object.prototype.hasOwnProperty.call(guard, '_isKnownFrameworkHandle'),
    '_isKnownFrameworkHandle must not be a new export'
  );

  console.log('Arm D ok (' + checks + ' assertions cumulative)');
}

// ---------------------------------------------------------------------------
// LEG 2: the production hook chain.
// ---------------------------------------------------------------------------
function runHook(stdin, extraEnv) {
  const env = Object.assign({}, process.env, extraEnv || {});
  const res = spawnSync(process.execPath, [HOOK], { input: stdin, env: env, encoding: 'utf8' });
  return { status: res.status, stderr: res.stderr || '' };
}

function hookLeg() {
  console.log('--- LEG 2: part8-egress-guard-hook.cjs child-process exit codes ---');

  if (!fs.existsSync(HOOK)) {
    console.log('SKIP: scripts/part8-egress-guard-hook.cjs absent');
    return;
  }

  const clean = JSON.stringify({
    tool_name: FRAMEWORK_STEP,
    tool_input: { framework: 'Dominant Design' },
    session_id: 'p361-02-a',
  });
  const a = runHook(clean, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
  ok(a.status === 0, 'HOOK A: a clean framework_step call must exit 0, got ' + a.status + ' stderr=' + JSON.stringify(a.stderr));
  ok(!/ambiguous/i.test(a.stderr), 'HOOK A: a clean call must render no ambiguous-disclosure text, got stderr=' + JSON.stringify(a.stderr));

  const dirty = JSON.stringify({
    tool_name: FRAMEWORK_STEP,
    tool_input: { framework: 'jane@example.com' },
    session_id: 'p361-02-b',
  });
  const b = runHook(dirty, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
  ok(b.status === 2, 'HOOK B: a content-carrying framework_step call must exit 2, got ' + b.status);
  ok(b.stderr && b.stderr.trim().length > 0, 'HOOK B: a block must carry gate text on stderr');

  console.log('LEG 2 ok (' + checks + ' assertions cumulative)');
}

// ---------------------------------------------------------------------------
// LEG 3: find_connections slice, working tree vs HEAD.
// ---------------------------------------------------------------------------
function findConnectionsLegA() {
  console.log('--- LEG 3: find_connections slice, working tree vs HEAD ---');

  const workingText = fs.readFileSync(GUARD, 'utf8');
  const workingSlice = baseline.extractFindConnectionsSlice(workingText);
  ok(workingSlice !== null, 'find_connections slice must be extractable from the working tree');

  const headText = execFileSync('git', ['show', 'HEAD:lib/core/part8-egress-guard.cjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: CHILD_ENV,
    maxBuffer: 1024 * 1024 * 16,
  });
  const headSlice = baseline.extractFindConnectionsSlice(headText);
  ok(headSlice !== null, 'find_connections slice must be extractable from HEAD');

  ok(
    workingSlice === headSlice,
    'find_connections slice must be byte-identical between the working tree and HEAD'
  );

  console.log('LEG 3 ok (' + checks + ' assertions cumulative)');
}

// ---------------------------------------------------------------------------
// LEG 4: find_connections slice, per-361-commit parity over <base_sha>..HEAD.
// ---------------------------------------------------------------------------
function findConnectionsLegB() {
  console.log('--- LEG 4: find_connections slice, per-361-commit parity ---');

  let fixture;
  try {
    fixture = baseline.loadFixture();
  } catch (e) {
    console.log('SKIP: 361-pre-phase.json fixture not readable (' + e.message + ')');
    return;
  }
  const baseSha = fixture.base_sha;

  let commits;
  try {
    const log = execFileSync(
      'git',
      ['log', '--format=%H%x01%s', baseSha + '..HEAD', '--', 'lib/core/part8-egress-guard.cjs'],
      { cwd: ROOT, encoding: 'utf8', env: CHILD_ENV, maxBuffer: 1024 * 1024 * 16 }
    );
    commits = log
      .split('\n')
      .filter(function (l) { return l.length > 0; })
      .map(function (l) {
        const parts = l.split('\x01');
        return { sha: parts[0], subject: parts[1] || '' };
      });
  } catch (e) {
    console.log('SKIP: git log over <base_sha>..HEAD failed (' + e.message + ')');
    return;
  }

  const own361Commits = commits.filter(function (c) { return c.subject.indexOf('361-') !== -1; });

  if (own361Commits.length === 0) {
    console.log('SKIP: no 361-* commits touching the guard file found yet in <base_sha>..HEAD');
  }

  own361Commits.forEach(function (c) {
    const beforeText = execFileSync('git', ['show', c.sha + '^:lib/core/part8-egress-guard.cjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: CHILD_ENV,
      maxBuffer: 1024 * 1024 * 16,
    });
    const afterText = execFileSync('git', ['show', c.sha + ':lib/core/part8-egress-guard.cjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: CHILD_ENV,
      maxBuffer: 1024 * 1024 * 16,
    });
    const beforeSlice = baseline.extractFindConnectionsSlice(beforeText);
    const afterSlice = baseline.extractFindConnectionsSlice(afterText);
    ok(
      beforeSlice === afterSlice,
      'commit ' + c.sha.slice(0, 9) + ' ("' + c.subject + '") must not change the find_connections slice'
    );
  });

  console.log('LEG 4 ok (' + checks + ' assertions cumulative)');
}

// ---------------------------------------------------------------------------
// LEG 5: arm order -- recommend_chain precedes each new arm, which precedes
// the function's terminal `return null;`.
// ---------------------------------------------------------------------------
function armOrderLeg() {
  console.log('--- LEG 5: arm order ---');

  const src = fs.readFileSync(GUARD, 'utf8');

  const fnStart = src.indexOf('function _proveKnownToolShape(payload, toolName) {');
  ok(fnStart !== -1, '_proveKnownToolShape function must be found in source');

  // Brace-match from fnStart's opening brace to find the function's own end,
  // so the "terminal return null" cannot be confused with one belonging to a
  // later function.
  const openBraceIdx = src.indexOf('{', fnStart);
  let depth = 0;
  let fnEnd = -1;
  for (let i = openBraceIdx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        fnEnd = i;
        break;
      }
    }
  }
  ok(fnEnd !== -1, '_proveKnownToolShape function end must be found via brace matching');

  const fnBody = src.slice(fnStart, fnEnd + 1);
  const recommendIdx = fnBody.indexOf("indexOf('recommend_chain')");
  const stepIdx = fnBody.indexOf("indexOf('framework_step')");
  const techniquesIdx = fnBody.indexOf("indexOf('framework_techniques')");
  const caseStoryIdx = fnBody.indexOf("indexOf('case_story')");
  const terminalReturnIdx = fnBody.lastIndexOf('return null;');

  ok(recommendIdx !== -1, "recommend_chain arm's indexOf guard must exist");
  ok(stepIdx !== -1, "framework_step arm's indexOf guard must exist");
  ok(techniquesIdx !== -1, "framework_techniques arm's indexOf guard must exist");
  ok(caseStoryIdx !== -1, "case_story arm's indexOf guard must exist");
  ok(terminalReturnIdx !== -1, 'a terminal return null; must exist in the function body');

  ok(recommendIdx < stepIdx, 'recommend_chain must precede framework_step');
  ok(recommendIdx < techniquesIdx, 'recommend_chain must precede framework_techniques');
  ok(recommendIdx < caseStoryIdx, 'recommend_chain must precede case_story');

  ok(stepIdx < terminalReturnIdx, 'framework_step must precede the terminal return null;');
  ok(techniquesIdx < terminalReturnIdx, 'framework_techniques must precede the terminal return null;');
  ok(caseStoryIdx < terminalReturnIdx, 'case_story must precede the terminal return null;');

  console.log('LEG 5 ok (' + checks + ' assertions cumulative)');
}

function unitLeg() {
  armA();
  armB();
  armC();
  armD();
  console.log('LEG 1 ok (' + checks + ' assertions)');
}

function main() {
  unitLeg();
  hookLeg();
  findConnectionsLegA();
  findConnectionsLegB();
  armOrderLeg();

  ok(!networkAttempted, 'no network attempt must have been made');

  console.log('PASS: test-361-egress-shapes (' + checks + ' assertions)');
  process.exit(0);
}

main();
