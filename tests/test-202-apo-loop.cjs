#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 202-02 -- APO loop acceptance tests (SEED-002 Path A).
 *
 * Drives the lab-side optimization loop: load + render a target prompt,
 * score candidates against the calibrated reward signal (grading-corpus
 * quality PRIMARY; telemetry reward SECONDARY, gated on activation, D-202-2),
 * and RECOMMEND the best variant for human ratification. Path A: the loop
 * NEVER writes commands/act.md.
 *
 * Hermetic + offline: zero network, zero Brain, zero MCP. qualityScoreFn is an
 * INJECTED stub. Span output is written under a tmp runs dir (or the real
 * gitignored lab/apo/runs/ only in the check-ignore assertion). The real
 * commands/act.md is READ only and asserted byte-unchanged.
 *
 * Test map:
 *   Task 1 (load + render the target prompt):
 *     1.  Exports: loadTarget + renderCandidate are functions.
 *     2.  loadTarget('commands/act.md') -> non-empty frontmatter + body.
 *     3.  renderCandidate round-trips byte-identically with the original body.
 *     4.  renderCandidate swaps the body while preserving frontmatter byte-identical.
 *   Task 2 (reward-blend scoring):
 *     5.  telemetry NOT activated -> score === quality term only.
 *     6.  telemetry activated -> score === quality + weighted telemetry term.
 *     7.  quality-primary: telemetry-high/quality-low candidate does NOT auto-win.
 *   Task 3 (loop + gated recommendation):
 *     8.  runApo returns the highest-scoring variant as best.
 *     9.  runApo writes NO change to commands/act.md (byte-identical).
 *     10. span output lands under the runs dir and that path is gitignored.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const PT_PATH = path.join(REPO, 'lab/apo/prompt-target.cjs');
const LOOP_PATH = path.join(REPO, 'lab/apo/apo-loop.cjs');
const ACT_MD = path.join(REPO, 'commands/act.md');

// ---------- Tiny test runner (mirrors test-202-telemetry-consumer.cjs) ----------

const RESULTS = [];
function test(name, fn) {
  try {
    fn();
    RESULTS.push({ name, ok: true });
    console.log('PASS  ' + name);
  } catch (err) {
    RESULTS.push({ name, ok: false, err });
    console.log('FAIL  ' + name);
    console.log('      ' + (err && err.message ? err.message : String(err)));
  }
}

function rmRf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

// ---------- Load the units under test (guarded so a missing module = clean FAIL) ----------

function freshRequire(p) {
  try { delete require.cache[require.resolve(p)]; } catch (_e) { /* not cached yet */ }
  try { return require(p); } catch (_e) { return null; }
}

const promptTarget = freshRequire(PT_PATH);
const apoLoop = freshRequire(LOOP_PATH);

// ================= Task 1: load + render the target prompt =================

test('1. exports: loadTarget + renderCandidate are functions', () => {
  assert.ok(promptTarget, 'lab/apo/prompt-target.cjs must be requireable');
  assert.equal(typeof promptTarget.loadTarget, 'function', 'loadTarget must be exported');
  assert.equal(typeof promptTarget.renderCandidate, 'function', 'renderCandidate must be exported');
});

test('2. loadTarget(commands/act.md) returns non-empty frontmatter + body', () => {
  const target = promptTarget.loadTarget(ACT_MD);
  assert.equal(typeof target.frontmatter, 'string', 'frontmatter must be a string');
  assert.equal(typeof target.body, 'string', 'body must be a string');
  assert.ok(target.frontmatter.length > 0, 'frontmatter must be non-empty');
  assert.ok(target.body.length > 0, 'body must be non-empty');
  // The frontmatter is the INNER block (no fences); the body is the markdown prompt.
  assert.ok(/name:\s*act/.test(target.frontmatter), 'frontmatter carries the name: act key');
  assert.ok(/# \/mos:act/.test(target.body), 'body carries the /mos:act heading');
  assert.ok(!/^---/.test(target.frontmatter), 'frontmatter must not include the fence line');
});

test('3. renderCandidate round-trips byte-identically with the original body', () => {
  const raw = fs.readFileSync(ACT_MD, 'utf8');
  const target = promptTarget.loadTarget(ACT_MD);
  const rebuilt = promptTarget.renderCandidate(target, target.body);
  assert.equal(rebuilt, raw, 'renderCandidate(target, target.body) must reproduce the file byte-for-byte');
});

test('4. renderCandidate swaps the body while preserving frontmatter byte-identical', () => {
  const raw = fs.readFileSync(ACT_MD, 'utf8');
  const target = promptTarget.loadTarget(ACT_MD);
  const variantBody = '# /mos:act\n\nOPTIMIZED VARIANT BODY -- lab candidate, not shipped.\n';
  const rendered = promptTarget.renderCandidate(target, variantBody);

  // The frontmatter block (between the fences) must be byte-identical to the original.
  const origFm = raw.slice(raw.indexOf('---\n') + 4, raw.indexOf('\n---\n'));
  const newFm = rendered.slice(rendered.indexOf('---\n') + 4, rendered.indexOf('\n---\n'));
  assert.equal(newFm, origFm, 'frontmatter must be preserved byte-identical when the body is swapped');

  // The body must be the variant, and the original body must be gone.
  assert.ok(rendered.endsWith(variantBody), 'rendered output must end with the variant body');
  assert.ok(!rendered.includes('You are Larry. This command autonomously selects'),
    'the original body must be replaced, not appended');
  assert.notEqual(rendered, raw, 'a swapped body must change the file');
});

// ---------- Summary ----------

const failed = RESULTS.filter((r) => !r.ok);
console.log('');
console.log(`${RESULTS.length - failed.length}/${RESULTS.length} passed`);
if (failed.length > 0) {
  process.exit(1);
}
console.log('ALL PASS');
