#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 226-01 -- the D3 critic-bar-parity guard (REQ-2/G-2) + the D8 cap unit
 * leg (REQ-7/G-6).
 *
 * WHAT THIS PROVES
 *   Reasoning-mode does NOT relax the analogy bar to earn its "lower confidence"
 *   label. The bar is held BY CODE, not by trust:
 *     1. call-count: runRubric invokes the judge EXACTLY twice per pair.
 *     2. verdict-by-code: the row verdict is exactly verdictFromRubric's output
 *        (recomputed independently from the fixture stub answers).
 *     3. prompt byte-equality: the emitted prompt files are byte-for-byte the
 *        exported critic builders (no third, freer prompt variant exists).
 *     4. prompt discipline: mechanism + mapping ONLY (no score/band/framing).
 *     5. rejection set: the negative-class fixtures stay rejected encoder-free.
 *     6. Gate 1: a $-figure mapping routes pseudoscience with zero prompt files.
 *     7. cap: the Jaccard pre-filter bounds fan-out by the env cap (D8).
 *     8. bias-to-reject: a missing judge answer never routes transferable.
 *
 * Standalone: node tests/test-226-rubric-parity.cjs (exit non-zero on failure).
 * node:assert strict, offline, node built-ins + in-repo requires only.
 * No em-dashes.
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const rm = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'reasoning-mode.cjs'));
const critic = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka-critic.cjs'));
const { lexicalOverlap, LEXICAL_METHOD } = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'lexical-overlap.cjs'));
const { FIXTURE_PAIRS } = require(path.join(REPO_ROOT, 'tests', 'fixtures', '226-reasoning-pairs.cjs'));

const RUBRIC_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];

function fixtureToCandidate(f) {
  return {
    id: f.id,
    a: f.id + '-A',
    b: f.id + '-B',
    section_a: 'domain-a',
    section_b: 'domain-b',
    title_a: f.id + ' side A',
    title_b: f.id + ' side B',
    lsa_similarity: lexicalOverlap(f.textA, f.textB),
    lexical_method: LEXICAL_METHOD,
    text_a: f.textA,
    text_b: f.textB,
    mechanismText: f.mechanismText,
    mappingStatement: f.mappingStatement,
  };
}

// Recompute the expected verdict independently from the stub answers, mirroring
// runRubric's agreement logic + verdictFromRubric (never importing the row's own
// verdict). This is the "verdict is exactly verdictFromRubric's output" check.
function expectedVerdict(f) {
  const n = critic.parseRubricResponse(f.neutral);
  const adv = critic.parseRubricResponse(f.adversarial);
  let disagree = false;
  const agreed = {};
  for (let i = 0; i < RUBRIC_KEYS.length; i += 1) {
    const k = RUBRIC_KEYS[i];
    if (n[k] === adv[k]) { agreed[k] = n[k]; } else { disagree = true; agreed[k] = null; }
  }
  if (disagree) return { verdict: 'general_shallow', tag: 'rubric_disagreement' };
  return { verdict: critic.verdictFromRubric(agreed), tag: null };
}

async function main() {
  const validCandidates = FIXTURE_PAIRS.map(fixtureToCandidate);

  // ---- Leg 1: call-count === 2 per stage-A-passing candidate ----
  const counts = {};
  const countingAnswers = {};
  for (let i = 0; i < FIXTURE_PAIRS.length; i += 1) {
    const f = FIXTURE_PAIRS[i];
    counts[f.id] = 0;
    const base = rm._test.judgeFromAnswers({ neutral: f.neutral, adversarial: f.adversarial });
    countingAnswers[f.id] = {
      judgeFn: (function (id, fn) {
        return function (prompt) { counts[id] += 1; return fn(prompt); };
      }(f.id, base)),
    };
  }
  const countedRows = await rm.scoreReasoningPairs(validCandidates, countingAnswers, {});
  for (let i = 0; i < countedRows.length; i += 1) {
    const r = countedRows[i];
    if (r.stage_a_pass) {
      assert.strictEqual(counts[r.id], 2, 'leg1: ' + r.id + ' judge called exactly twice (got ' + counts[r.id] + ')');
    }
  }

  // ---- Leg 2 + Leg 5: verdict-by-code + rejection set through the REAL runRubric ----
  const answers = {};
  for (let i = 0; i < FIXTURE_PAIRS.length; i += 1) {
    const f = FIXTURE_PAIRS[i];
    answers[f.id] = { neutral: f.neutral, adversarial: f.adversarial };
  }
  const rows = await rm.scoreReasoningPairs(validCandidates, answers, {});
  const byId = {};
  for (let i = 0; i < rows.length; i += 1) byId[rows[i].id] = rows[i];

  for (let i = 0; i < FIXTURE_PAIRS.length; i += 1) {
    const f = FIXTURE_PAIRS[i];
    const row = byId[f.id];
    const exp = expectedVerdict(f);
    assert.strictEqual(row.verdict, exp.verdict, 'leg2: ' + f.id + ' verdict is verdictFromRubric output ('
      + row.verdict + ' vs ' + exp.verdict + ')');
    assert.strictEqual(row.verdict, f.expected_verdict, 'leg2: ' + f.id + ' matches fixture expected_verdict');
    if (exp.tag === 'rubric_disagreement') {
      assert.strictEqual(row.reasoning_tag, 'rubric_disagreement', 'leg2: ' + f.id + ' adversarial-flip tag');
    }
  }
  // Rejection set stays rejected encoder-free (D3 bar not relaxed).
  assert.strictEqual(byId['P08-reject-pseudoscience'].verdict, 'pseudoscience', 'leg5: pseudoscience stays rejected');
  assert.strictEqual(byId['P09-reject-restatement'].verdict, 'restatement', 'leg5: restatement stays rejected');
  assert.strictEqual(byId['P10-reject-general-shallow'].verdict, 'general_shallow', 'leg5: general_shallow stays rejected');

  // ---- Leg 3 + Leg 4: prompt byte-equality + prompt discipline ----
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-226-parity-'));
  const manifest = rm.emitReasoningPrompts(workdir, validCandidates);
  const FORBIDDEN = ['score', 'band', 'differential', 'similarity', 'excitement'];
  for (let i = 0; i < validCandidates.length; i += 1) {
    const c = validCandidates[i];
    const nPath = path.join(workdir, c.id + '.neutral.txt');
    const aPath = path.join(workdir, c.id + '.adversarial.txt');
    const nContent = fs.readFileSync(nPath, 'utf8');
    const aContent = fs.readFileSync(aPath, 'utf8');
    assert.strictEqual(nContent, critic.buildNeutralPrompt({ mechanismText: c.mechanismText, mappingStatement: c.mappingStatement }),
      'leg3: ' + c.id + ' neutral prompt byte-equal to critic.buildNeutralPrompt');
    assert.strictEqual(aContent, critic.buildAdversarialPrompt({ mechanismText: c.mechanismText, mappingStatement: c.mappingStatement }),
      'leg3: ' + c.id + ' adversarial prompt byte-equal to critic.buildAdversarialPrompt');
    assert.ok(nContent.indexOf('MECHANISM:') !== -1 && nContent.indexOf('PROPOSED MAPPING:') !== -1,
      'leg4: ' + c.id + ' neutral carries MECHANISM + PROPOSED MAPPING sections');
    for (let k = 0; k < FORBIDDEN.length; k += 1) {
      assert.strictEqual(nContent.toLowerCase().indexOf(FORBIDDEN[k]), -1,
        'leg4: ' + c.id + " neutral prompt must not contain '" + FORBIDDEN[k] + "'");
      assert.strictEqual(aContent.toLowerCase().indexOf(FORBIDDEN[k]), -1,
        'leg4: ' + c.id + " adversarial prompt must not contain '" + FORBIDDEN[k] + "'");
    }
  }

  // ---- Leg 6: Gate 1 -- a $-figure mapping routes pseudoscience, zero prompt files ----
  const gateWorkdir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-226-gate1-'));
  const gateCand = {
    id: 'GATE1',
    a: 'g-A', b: 'g-B', section_a: 's1', section_b: 's2', title_a: 'gA', title_b: 'gB',
    lsa_similarity: 0.1, lexical_method: LEXICAL_METHOD, text_a: 'x', text_b: 'y',
    mechanismText: 'A promising platform mechanism with real cross-domain structure.',
    mappingStatement: 'This maps cleanly and projects a $2-5B exit within three years.',
  };
  const gateManifest = rm.emitReasoningPrompts(gateWorkdir, [gateCand]);
  const gateRec = gateManifest.candidates[0];
  assert.strictEqual(gateRec.stage_a_pass, false, 'leg6: $-figure mapping fails Gate 1');
  assert.strictEqual(gateRec.route, 'pseudoscience', 'leg6: Gate 1 route pseudoscience');
  assert.strictEqual(gateRec.tag, 'unsourced_quantity', 'leg6: Gate 1 tag unsourced_quantity');
  assert.strictEqual(gateRec.prompt_files, null, 'leg6: no prompt_files recorded');
  assert.strictEqual(fs.existsSync(path.join(gateWorkdir, 'GATE1.neutral.txt')), false, 'leg6: zero neutral prompt file written');
  assert.strictEqual(fs.existsSync(path.join(gateWorkdir, 'GATE1.adversarial.txt')), false, 'leg6: zero adversarial prompt file written');
  const gateRows = await rm.scoreReasoningPairs([gateCand], {}, {});
  assert.strictEqual(gateRows[0].verdict, 'pseudoscience', 'leg6: scoreReasoningPairs also routes pseudoscience');

  // ---- Leg 7: cap -- 40-entry two-section room bounded by the env cap ----
  const entries = [];
  for (let i = 0; i < 40; i += 1) {
    entries.push({
      id: 'e' + i,
      section: (i % 2 === 0) ? 'sec-a' : 'sec-b',
      title: 'Entry ' + i,
      text: 'unique body number ' + i + ' with distinct vocabulary token' + i + ' and filler prose to score.',
    });
  }
  const proposed = rm.proposeCandidatePairs(entries, {});
  assert.ok(proposed.pairs_considered > 25, 'leg7: pairs_considered exceeds the cap (got ' + proposed.pairs_considered + ')');
  assert.ok(proposed.candidates.length <= 25, 'leg7: capped at default 25 (got ' + proposed.candidates.length + ')');
  const prevCap = process.env.MINDRIAN_EUREKA_REASONING_MAX_PAIRS;
  process.env.MINDRIAN_EUREKA_REASONING_MAX_PAIRS = '5';
  try {
    const proposed5 = rm.proposeCandidatePairs(entries, {});
    assert.ok(proposed5.candidates.length <= 5, 'leg7: env cap 5 honored (got ' + proposed5.candidates.length + ')');
  } finally {
    if (prevCap === undefined) delete process.env.MINDRIAN_EUREKA_REASONING_MAX_PAIRS;
    else process.env.MINDRIAN_EUREKA_REASONING_MAX_PAIRS = prevCap;
  }

  // ---- Leg 8: bias-to-reject -- a missing judge answer never routes transferable ----
  const missCand = fixtureToCandidate(FIXTURE_PAIRS[0]); // a clean transferable pair
  missCand.id = 'MISSING';
  const missRows = await rm.scoreReasoningPairs([missCand], {}, {}); // no answers at all
  assert.strictEqual(missRows[0].judge_answer_missing, true, 'leg8: judge_answer_missing recorded');
  assert.notStrictEqual(missRows[0].verdict, 'transferable', 'leg8: missing answers never route transferable (got '
    + missRows[0].verdict + ')');

  try { fs.rmSync(workdir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  try { fs.rmSync(gateWorkdir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }

  // Silence the unused-manifest lint without hiding it from a reader.
  assert.ok(Array.isArray(manifest.candidates) && manifest.candidates.length === validCandidates.length,
    'emit manifest lists every candidate');

  process.stdout.write('test-226-rubric-parity: PASS (8 legs: call-count, verdict-by-code, prompt byte-equality, '
    + 'prompt discipline, rejection set, Gate 1, cap, bias-to-reject)\n');
}

main().then(function () { process.exit(0); }, function (err) {
  process.stderr.write('test-226-rubric-parity: FAIL\n' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
