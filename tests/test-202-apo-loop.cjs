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

// ================= Task 2: the scoring function (reward blend) =================

// Build a high-signal selector_pick event set where each verb carries a known
// mean ranker_confidence, so buildRewardTable(events)[verb].rewardMean is exact.
function selectorEvents(verb, confidence, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      event: 'selector_pick',
      schema_version: 1,
      timestamp: '2026-06-30T10:00:0' + (i % 10) + '.000Z',
      session_id: 'sess-score',
      verb_chosen: verb,
      ranker_confidence: confidence,
    });
  }
  return out;
}

test('5. telemetry NOT activated -> score === quality term only', () => {
  assert.ok(apoLoop, 'lab/apo/apo-loop.cjs must be requireable');
  assert.equal(typeof apoLoop.scoreCandidate, 'function', 'scoreCandidate must be exported');
  const candidate = { id: 'c1', body: 'x', reachKey: 'explore' };
  const ctx = {
    qualityScoreFn: () => 0.7,
    telemetry: { activated: false, events: selectorEvents('explore', 0.9, 4) },
  };
  const score = apoLoop.scoreCandidate(candidate, ctx);
  assert.equal(score, 0.7, 'with telemetry inactive the score is exactly the quality term (no telemetry bonus)');
});

test('6. telemetry activated -> score === quality + weighted telemetry term', () => {
  assert.equal(typeof apoLoop.TELEMETRY_WEIGHT, 'number', 'TELEMETRY_WEIGHT must be exported');
  const w = apoLoop.TELEMETRY_WEIGHT;
  const candidate = { id: 'c1', body: 'x', reachKey: 'explore' };
  const events = selectorEvents('explore', 0.8, 4); // rewardMean('explore') === 0.8
  const active = { qualityScoreFn: () => 0.5, telemetry: { activated: true, events } };
  const inactive = { qualityScoreFn: () => 0.5, telemetry: { activated: false, events } };

  const scoreActive = apoLoop.scoreCandidate(candidate, active);
  const scoreInactive = apoLoop.scoreCandidate(candidate, inactive);

  // The telemetry term is the reach's mean reward (0.8), weighted and ADDED.
  assert.ok(Math.abs(scoreActive - (0.5 + w * 0.8)) < 1e-9,
    'activated score must equal quality + TELEMETRY_WEIGHT * reachRewardMean');
  assert.equal(scoreInactive, 0.5, 'the same candidate scores quality-only when telemetry is inactive');
  assert.ok(scoreActive > scoreInactive, 'activation ADDS a secondary telemetry term, never subtracts');
});

test('7. quality-primary: telemetry-high/quality-low candidate does NOT auto-win', () => {
  const events = selectorEvents('explore', 0.9, 4) // high-telemetry reach
    .concat(selectorEvents('hold', 0.1, 4));        // low-telemetry reach
  const ctx = { qualityScoreFn: (c) => c.quality, telemetry: { activated: true, events } };

  const highQuality = { id: 'hq', quality: 0.8, reachKey: 'hold' };    // quality lead, weak telemetry
  const highTelemetry = { id: 'ht', quality: 0.5, reachKey: 'explore' }; // strong telemetry, weak quality

  const sHQ = apoLoop.scoreCandidate(highQuality, ctx);
  const sHT = apoLoop.scoreCandidate(highTelemetry, ctx);

  // Even though highTelemetry's reach reward (0.9) dwarfs highQuality's (0.1),
  // the quality lead (0.3) exceeds the max telemetry swing (TELEMETRY_WEIGHT), so
  // the higher-QUALITY candidate still scores higher. Quality is the primary term.
  assert.ok(sHQ > sHT,
    'a candidate that scores higher on telemetry but lower on quality must NOT auto-win (D-202-2)');
  assert.ok(apoLoop.TELEMETRY_WEIGHT <= 0.3,
    'TELEMETRY_WEIGHT must be bounded below a meaningful quality gap to keep quality primary');
});

// ================= Task 3: the loop + gated recommendation =================

// A stub agent callback: returns 3 body variants with declared quality scores.
function stubProposeFn() {
  return [
    { id: 'v1', quality: 0.40, body: '# /mos:act\n\nvariant one\n' },
    { id: 'v2', quality: 0.85, body: '# /mos:act\n\nvariant two (best)\n' },
    { id: 'v3', quality: 0.60, body: '# /mos:act\n\nvariant three\n' },
  ];
}
const stubQualityScoreFn = (candidate) => candidate.quality;

function isGitIgnored(absPath) {
  try {
    execFileSync('git', ['check-ignore', absPath], { cwd: REPO, stdio: 'pipe' });
    return true; // exit 0 -> the path is ignored
  } catch (_e) {
    return false; // non-zero exit -> not ignored
  }
}

test('8. runApo returns the highest-scoring variant as best', () => {
  assert.ok(apoLoop, 'lab/apo/apo-loop.cjs must be requireable');
  assert.equal(typeof apoLoop.runApo, 'function', 'runApo must be exported');
  const runsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apo-runs-'));
  try {
    const result = apoLoop.runApo(ACT_MD, {
      proposeFn: stubProposeFn,
      qualityScoreFn: stubQualityScoreFn,
      runsDir,
    });
    assert.ok(result && result.best, 'runApo must return a best recommendation');
    assert.equal(result.best.id, 'v2', 'best must be the highest-scoring variant');
    assert.equal(result.candidates.length, 3, 'all proposed candidates are recorded');
    assert.ok(result.rounds >= 1, 'at least one round runs');
    // best is a recommendation OBJECT, not a written file.
    assert.equal(typeof result.best.id, 'string', 'best is a candidate object (a recommendation)');
  } finally { rmRf(runsDir); }
});

test('9. runApo writes NO change to commands/act.md (byte-identical, Path A)', () => {
  const before = fs.readFileSync(ACT_MD);
  const runsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apo-runs-'));
  try {
    apoLoop.runApo(ACT_MD, {
      proposeFn: stubProposeFn,
      qualityScoreFn: stubQualityScoreFn,
      runsDir,
    });
    const after = fs.readFileSync(ACT_MD);
    assert.ok(before.equals(after),
      'runApo must NEVER write commands/act.md -- it recommends, a human ratifies (Path A)');
  } finally { rmRf(runsDir); }
});

test('10. span output lands under the runs dir and that path is gitignored', () => {
  // Use the DEFAULT runs dir (lab/apo/runs/) to prove the shipped .gitignore
  // actually ignores real span output (Part 8: never committed, never shipped).
  const result = apoLoop.runApo(ACT_MD, {
    proposeFn: stubProposeFn,
    qualityScoreFn: stubQualityScoreFn,
  });
  try {
    assert.equal(typeof result.spanPath, 'string', 'runApo must report the span file path');
    assert.ok(fs.existsSync(result.spanPath), 'the span file must be written to disk');
    assert.ok(result.spanPath.includes(path.join('lab', 'apo', 'runs')),
      'span data must land under lab/apo/runs/');
    assert.ok(isGitIgnored(result.spanPath),
      'the span path must be gitignored (git check-ignore succeeds)');
    // Sanity: the span records the recommendation, not an edit to act.md.
    const span = JSON.parse(fs.readFileSync(result.spanPath, 'utf8'));
    assert.ok(span.best && span.best.id === 'v2', 'span records the recommended candidate');
  } finally {
    rmRf(apoLoop.DEFAULT_RUNS_DIR);
  }
});

// ---------- Summary ----------

const failed = RESULTS.filter((r) => !r.ok);
console.log('');
console.log(`${RESULTS.length - failed.length}/${RESULTS.length} passed`);
if (failed.length > 0) {
  process.exit(1);
}
console.log('ALL PASS');
