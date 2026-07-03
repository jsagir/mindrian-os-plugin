#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 202-03 -- APO voice-contract gate acceptance tests (SEED-002-eval-gate).
 *
 * The APO loop maximizes a reward signal. An optimizer will happily produce a
 * prompt whose OUTPUT scores higher but dumps a framework, runs thirty
 * sentences, drops the De Stijl voice mark, or slips in an em-dash -- exactly
 * the Larry anti-patterns (Canon Part 12). This suite proves:
 *   Task 2 -- a LOCAL deterministic gate (checkVoiceContract) reproduces the
 *             Plurai judge offline for the mechanical checks, reusing
 *             lab/eval/voice-mark-hybrid.cjs::scoreVoiceMark for the mark.
 *   Task 3 -- (re-pointed by Phase 210-C) the loop treats a voice-contract
 *             violation as a SIGNAL, not a gate: the violating candidate stays
 *             selectable, its blended score is dented, and the violation is
 *             flagged visibly (voiceFlagged + voiceViolations) for the human
 *             who ratifies the recommendation.
 *   Task 4 -- an offline baseline artifact exists and the local gate meets it.
 *
 * Hermetic + offline: zero network, zero Brain, zero MCP. The subjective
 * reframe-plus-question beat is the ONLY LLM leg; offline it is skipped and
 * treated as pass unless a mechanical check already fails. No em-dashes.
 *
 * Test map:
 *   Task 2 (local gate parity):
 *     1.  Exports: checkVoiceContract is a function.
 *     2.  CSV parity: local pass matches compliant/violation for every row.
 *     3.  An em-dash output is ALWAYS a violation (isolated).
 *     4.  A missing De Stijl mark is caught via the reused hybrid (isolated).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const os = require('node:os');

const REPO = path.resolve(__dirname, '..');
const GATE_PATH = path.join(REPO, 'lab/apo/voice-contract-gate.cjs');
const LOOP_PATH = path.join(REPO, 'lab/apo/apo-loop.cjs');
const ACT_MD = path.join(REPO, 'commands/act.md');
const CSV_PATH = path.join(REPO, 'evals/plurai/09-apo-output-voice.csv');
const BASELINE_PATH = path.join(REPO, 'evals/plurai/202-baseline.json');

// ---------- Tiny test runner (mirrors test-202-apo-loop.cjs) ----------

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

function freshRequire(p) {
  try { delete require.cache[require.resolve(p)]; } catch (_e) { /* not cached */ }
  try { return require(p); } catch (_e) { return null; }
}

function rmRf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

// ---------- Minimal RFC4180 CSV parser (quoted fields, embedded commas,
// doubled-quote escaping) -- the 02/09 dialect. ----------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (ch === '\r') {
      /* skip CR */
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// Load the CSV into { agentResponse, label, reasoning } records (skip header).
function loadCsvRows() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(raw).filter((r) => r.length >= 2 && r[0].length > 0);
  const header = rows.shift();
  assert.equal(header[0], 'Sample', 'CSV header col 0 must be Sample');
  assert.equal(header[1], 'Label', 'CSV header col 1 must be Label');
  return rows.map((r) => {
    const sample = JSON.parse(r[0]);
    return { agentResponse: sample.agent_response, label: r[1], reasoning: r[2] || '' };
  });
}

const gate = freshRequire(GATE_PATH);

// ================= Task 2: local gate parity =================

test('1. exports: checkVoiceContract is a function', () => {
  assert.ok(gate, 'lab/apo/voice-contract-gate.cjs must be requireable');
  assert.equal(typeof gate.checkVoiceContract, 'function', 'checkVoiceContract must be exported');
});

test('2. CSV parity: local pass matches compliant/violation for every row', () => {
  const rows = loadCsvRows();
  assert.ok(rows.length >= 20, 'expected the full synthetic CSV (~24 rows)');
  const compliant = rows.filter((r) => r.label === 'compliant').length;
  const violation = rows.filter((r) => r.label === 'violation').length;
  assert.ok(compliant >= 10 && violation >= 10, 'expected a roughly half/half split');
  for (const r of rows) {
    const res = gate.checkVoiceContract(r.agentResponse);
    const expectPass = r.label === 'compliant';
    assert.equal(res.pass, expectPass,
      `row labelled ${r.label} but gate.pass=${res.pass} (violations: ${JSON.stringify(res.violations)}) for: ${r.agentResponse}`);
  }
});

test('3. an em-dash output is ALWAYS a violation (isolated)', () => {
  // Mark present, short, ends with a question -- ONLY the em-dash breaks it.
  const withDash = '[RED] Your idea is strong — the market is weak — so what changes your mind?';
  const res = gate.checkVoiceContract(withDash);
  assert.equal(res.pass, false, 'an em-dash must disqualify');
  assert.ok(res.violations.includes('em_dash_present'), 'em_dash_present must be flagged');
});

test('4. a missing De Stijl mark is caught via the reused hybrid (isolated)', () => {
  // Reframe plus question, short, no em-dash -- ONLY the missing mark breaks it.
  const noMark = 'You are treating this as a pricing problem. What if it is positioning? What is the cheapest test?';
  const res = gate.checkVoiceContract(noMark);
  assert.equal(res.pass, false, 'a missing voice mark must disqualify');
  assert.ok(res.violations.includes('missing_voice_mark'), 'missing_voice_mark must be flagged');
});

// ================= Task 3: voice-contract SIGNAL in the loop (Phase 210-C) =================
// INTENTIONAL RE-POINT (plan 210-04): the original Test 5 asserted that the
// quality-0.95 em-dash candidate LOSES to the quality-0.80 compliant one (the
// veto). Phase 210-C removed the veto: the violating candidate is selectable,
// its blended score is dented by VOICE_SIGNAL_WEIGHT per violation, and the
// flag stays visible on the record for the human who ratifies.

const apoLoop = freshRequire(LOOP_PATH);

test('5. Part 12 as signal (210-C): violating reward-winner stays selectable; score dented; flag visible', () => {
  assert.ok(apoLoop, 'lab/apo/apo-loop.cjs must be requireable');
  assert.equal(typeof apoLoop.runApo, 'function', 'runApo must be exported');
  assert.equal(typeof apoLoop.VOICE_SIGNAL_WEIGHT, 'number', 'VOICE_SIGNAL_WEIGHT must be exported');
  const runsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apo-vc-'));
  try {
    // The highest-reward candidate carries an em-dash output (a Part 12
    // violation); the lower-reward candidate honors the contract.
    const highRewardViolation =
      '[RED] Your idea is strong — the market is weak — so reconsider? Tell me more.';
    const compliant =
      '[RED] You are treating this as a marketing problem. What is the smallest test that would tell you? Start there.';
    const proposeFn = () => ([
      { id: 'high', body: 'x', output: highRewardViolation },
      { id: 'low', body: 'y', output: compliant },
    ]);
    // qualityScoreFn makes 'high' the reward winner -- and it now WINS: the
    // voice contract is a signal, not a gate (210-C).
    const qualityScoreFn = (c) => (c.id === 'high' ? 0.95 : 0.80);
    const result = apoLoop.runApo(ACT_MD, { proposeFn, qualityScoreFn, runsDir });
    assert.ok(result.best, 'runApo must return a best candidate');
    const high = result.candidates.find((c) => c.id === 'high');
    const low = result.candidates.find((c) => c.id === 'low');
    assert.ok(high && low, 'both candidates must be recorded');
    assert.ok(high.quality > low.quality, 'the violating candidate must be the reward winner');
    // 210-C direction 1: no veto -- the higher-quality candidate is selectable and wins.
    assert.equal(result.best.id, 'high',
      'the violating reward-winner must be SELECTABLE (signal, not gate); quality decides');
    // 210-C direction 2: the signal stays fully visible.
    assert.equal(high.voiceFlagged, true, 'the violating candidate is flagged (voiceFlagged)');
    assert.ok(high.voiceViolations.includes('em_dash_present'), 'the violation is named on the record');
    // 210-C direction 3: the score is dented by exactly VOICE_SIGNAL_WEIGHT per violation
    // (quality is untouched -- quality primacy in selectBest stays structural).
    const expectedDent = apoLoop.VOICE_SIGNAL_WEIGHT * high.voiceViolations.length;
    assert.ok(Math.abs((high.quality - high.score) - expectedDent) < 1e-9,
      'the blended score must be dented by VOICE_SIGNAL_WEIGHT per violation, quality untouched');
    assert.equal(low.voiceFlagged, false, 'the compliant candidate is not flagged');
    assert.equal(low.voiceViolations.length, 0, 'the compliant candidate carries zero violations');
    assert.equal(low.score, low.quality, 'a compliant candidate takes no dent');
  } finally {
    rmRf(runsDir);
  }
});

// ================= Task 4: offline baseline parity =================

test('6. baseline artifact exists with precision/recall keys and the local gate meets-or-beats it', () => {
  assert.ok(fs.existsSync(BASELINE_PATH), 'evals/plurai/202-baseline.json must exist');
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  // Baseline shape: precision/recall present (numbers), synthetic + deferred flags set.
  assert.equal(typeof baseline.precision, 'number', 'baseline.precision must be a number');
  assert.equal(typeof baseline.recall, 'number', 'baseline.recall must be a number');
  assert.equal(baseline.baseline_deferred, true, 'Plurai is offline -> baseline_deferred must be true (Part 8)');
  assert.equal(baseline.synthetic_only, true, 'synthetic_only must be true (Part 8)');
  // The local gate is 100% on the mechanically-decidable hand-labeled rows,
  // which meets-or-beats the hand-labeled baseline (precision/recall = 1).
  const rows = loadCsvRows();
  let correct = 0;
  for (const r of rows) {
    const res = gate.checkVoiceContract(r.agentResponse);
    const expectPass = r.label === 'compliant';
    if (res.pass === expectPass) correct++;
  }
  const localAccuracy = correct / rows.length;
  assert.equal(localAccuracy, 1, 'the local gate must reproduce every hand-labeled row');
  assert.ok(localAccuracy >= baseline.precision && localAccuracy >= baseline.recall,
    'the local gate must meet-or-beat the baseline precision/recall');
});

// ---------- Summary ----------

const failed = RESULTS.filter((r) => !r.ok);
console.log('');
console.log(`${RESULTS.length - failed.length}/${RESULTS.length} passed`);
if (failed.length > 0) {
  process.exit(1);
}
console.log('ALL PASS');
