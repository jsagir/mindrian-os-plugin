#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 237-02 -- structural source fence against a reintroduced second
 * classification path (REACH-02, Task 3)
 * =======================================================================
 * Real behavior proven: the behavioral parity walk in
 * tests/test-237-autonomy-parity.cjs (Task 1) catches divergence in the
 * ANSWER two authorities give. It cannot catch a second classification path
 * that happens to agree today and drifts tomorrow. This fence catches the
 * PATH: it statically scans every `.cjs` file under lib/mcp/tools/ plus
 * lib/core/chain-executor.cjs for the exact textual shape of the deleted
 * defect (a join against the per-surface reach-dial JSON manifest's
 * `posture` field, read as an autonomy answer) and fails the build if that
 * shape is ever reintroduced.
 *
 * Test map:
 *   Leg 1 (positive control): the scanned target list is non-empty and
 *     names at least lib/mcp/tools/chain.cjs and lib/core/chain-executor.cjs
 *     by name -- a fence over zero files is not a fence.
 *   Leg 2 (the fence, real files): every target's comment-stripped source
 *     contains neither the forbidden filename-join substring nor the
 *     forbidden posture-literal string, and no `.posture ===` comparison
 *     against a push/hold/pull-back literal.
 *   Leg 3 (mutation proof): a tmp-only mutated copy of chain.cjs, with a
 *     single injected CODE line (not a comment) re-reading the forbidden
 *     posture literal and the forbidden filename join, must make the SAME
 *     three assertions throw (assert.throws) -- proof the fence bites.
 *   Leg 4 (comment-stripping is not a false-positive generator): appending
 *     the same forbidden tokens inside a `//` comment line must NOT make
 *     the fence fail.
 *
 * Comment stripping: this file strips BOTH full-line `//`/`*`/`/*` comments
 * (the exact filter from tests/test-recipe-maps-authority.cjs:88-103) AND
 * trailing `//` comments on an otherwise-code line -- a deliberate widening
 * beyond that file's literal filter. lib/core/chain-executor.cjs (a
 * REQUIRED positive-control target this file must scan, per the plan's own
 * <read_first>) carries legitimate documentation like
 * `const verb = verdict && verdict.posture; // 'run' (push_forward) | 'halt'`
 * (line 369) -- a full-line-only stripper leaves that trailing comment's
 * forbidden token in the "code" stream and false-fails the fence against
 * the CORRECT, un-mutated file. Trailing-comment stripping is a naive
 * `//`-to-end-of-line removal (not string-literal-aware); the accepted
 * tradeoff is documented here rather than silently applied, since a string
 * literal containing `//` earlier on a line carrying a genuine violation
 * later on the SAME line could theoretically be missed -- vanishingly
 * unlikely for the specific tokens this fence scans for, and strictly safer
 * than the alternative of a fence that cannot even pass against its own
 * required positive-control target.
 *
 * Harness idiom reused (source, verbatim, per 237-02-PLAN.md Task 3's
 * <read_first>): the comment-stripped forbidden-token scan and the check()
 * harness shape from tests/test-recipe-maps-authority.cjs:88-109.
 *
 * Node built-in assert only. No em-dashes. Zero npm deps.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TOOLS_DIR = path.join(REPO_ROOT, 'lib', 'mcp', 'tools');
const CHAIN_EXECUTOR_PATH = path.join(REPO_ROOT, 'lib', 'core', 'chain-executor.cjs');
const CHAIN_TOOL_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'chain.cjs');

// ---------------------------------------------------------------------------
// tmpdir lifecycle (mirrors test-241 / test-237-autonomy-parity idiom).
// ---------------------------------------------------------------------------
const TMPDIRS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMPDIRS.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

// ---------------------------------------------------------------------------
// Target enumeration.
// ---------------------------------------------------------------------------
function enumerateTargets() {
  const toolFiles = fs.readdirSync(TOOLS_DIR)
    .filter((f) => f.endsWith('.cjs'))
    .map((f) => path.join(TOOLS_DIR, f));
  return toolFiles.concat([CHAIN_EXECUTOR_PATH]);
}

// ---------------------------------------------------------------------------
// Comment stripping (see the header comment above for why this widens
// beyond tests/test-recipe-maps-authority.cjs:88-103's literal full-line-only
// filter).
// ---------------------------------------------------------------------------
function stripComments(src) {
  return src
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .filter((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// The fence itself: three assertions against comment-stripped code.
// ---------------------------------------------------------------------------
const POSTURE_LITERAL_RE = /\.posture\s*===\s*['"](push_forward|hold|pull_back)['"]/;

function assertFenceOnCode(code, label) {
  assert.ok(!/connector-registry/.test(code),
    label + ': must not reference the per-surface reach-dial manifest (file name or path join) as an autonomy answer');
  assert.ok(!/push_forward/.test(code),
    label + ': must not contain the forbidden posture literal as code');
  assert.ok(!POSTURE_LITERAL_RE.test(code),
    label + ': must not compare .posture === against a push/hold/pull-back literal');
}

// ---------------------------------------------------------------------------
// Leg 3 mutation: inject a single CODE line (not a comment) into a tmp copy
// of chain.cjs that re-reads the forbidden posture literal and filename
// join -- the exact textual shape of the deleted defect.
// ---------------------------------------------------------------------------
function mutateInjectForbiddenToken(src) {
  const anchor = 'async function chainRun(steps, opts) {';
  assert.ok(src.indexOf(anchor) !== -1, 'expected chainRun anchor not found in chain.cjs; harness pin target drifted');
  const injected = "\n  const _mutationLeak = { posture: 'push_forward', source: 'connector-registry' };";
  return src.split(anchor).join(anchor + injected);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
const results = [];
function runLeg(name, fn) {
  try {
    fn();
    results.push({ name: name, status: 'PASS' });
  } catch (e) {
    results.push({ name: name, status: 'FAIL', error: e });
  }
}

const targets = enumerateTargets();

runLeg('Leg 1 (positive control): the target list is non-empty and names both required files', () => {
  assert.ok(Array.isArray(targets) && targets.length > 0, 'expected at least one scan target -- a fence over zero files is not a fence');
  assert.ok(targets.some((t) => t === CHAIN_TOOL_PATH), 'expected lib/mcp/tools/chain.cjs among the scan targets');
  assert.ok(targets.some((t) => t === CHAIN_EXECUTOR_PATH), 'expected lib/core/chain-executor.cjs among the scan targets');
  console.log('  scanned targets: ' + targets.length + ' (' + targets.map((t) => path.relative(REPO_ROOT, t)).join(', ') + ')');
});

runLeg('Leg 2 (the fence, real files): no target reintroduces the deleted classification path', () => {
  for (const target of targets) {
    const src = fs.readFileSync(target, 'utf8');
    const code = stripComments(src);
    assertFenceOnCode(code, path.relative(REPO_ROOT, target));
  }
});

runLeg('Leg 3 (mutation proof): the fence throws against a tmp copy with a reintroduced token', () => {
  const src = fs.readFileSync(CHAIN_TOOL_PATH, 'utf8');
  const mutated = mutateInjectForbiddenToken(src);
  assert.notEqual(mutated, src, 'mutation must actually change the source');
  const mutatedCode = stripComments(mutated);
  assert.throws(
    () => assertFenceOnCode(mutatedCode, 'lib/mcp/tools/chain.cjs (MUTATED, tmp-only)'),
    /reach-dial manifest|posture literal|push.hold.pull-back literal/,
    'expected the fence to throw against the mutated (tmp-only, never written to the real file) source'
  );
  // Never write the mutated content to the real file -- everything above ran
  // purely against in-memory strings. A tmp dir is minted anyway to keep the
  // lifecycle symmetric with the other 237 mutation harnesses.
  mkTmp('test-237-fence-leg3-');
});

runLeg('Leg 4 (comment-stripping is not a false-positive generator): the same tokens inside a comment do not trip the fence', () => {
  const src = fs.readFileSync(CHAIN_TOOL_PATH, 'utf8');
  const anchor = 'async function chainRun(steps, opts) {';
  assert.ok(src.indexOf(anchor) !== -1, 'expected chainRun anchor not found in chain.cjs; harness pin target drifted');
  const injectedComment = "\n  // MUTATION-PROOF (comment only, never code): push_forward connector-registry";
  const withComment = src.split(anchor).join(anchor + injectedComment);
  assert.notEqual(withComment, src, 'comment injection must actually change the source');
  const code = stripComments(withComment);
  // Must NOT throw -- the comment-only injection is invisible to the fence.
  assertFenceOnCode(code, 'lib/mcp/tools/chain.cjs (comment-only mutation, tmp-only)');
});

// ---------------------------------------------------------------------------
// Epilogue
// ---------------------------------------------------------------------------
let passCount = 0;
let failCount = 0;
console.log('');
for (const r of results) {
  if (r.status === 'PASS') {
    passCount += 1;
    console.log('  ok - ' + r.name);
  } else {
    failCount += 1;
    console.error('FAIL - ' + r.name);
    console.error(r.error && (r.error.message || r.error.stack) || String(r.error));
  }
}
console.log('');
if (failCount === 0) {
  console.log('PASS: test-237-one-authority-fence (' + passCount + '/' + results.length + ' legs, ' + targets.length + ' targets scanned)');
  process.exit(0);
} else {
  console.error('FAIL: test-237-one-authority-fence (' + failCount + ' failed, ' + passCount + ' passed, of ' + results.length + ' legs)');
  process.exit(1);
}
