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
 *   Task 3 -- the loop REJECTS any candidate that scores higher on reward but
 *             breaks the voice contract; reward can never buy a violation.
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

const REPO = path.resolve(__dirname, '..');
const GATE_PATH = path.join(REPO, 'lab/apo/voice-contract-gate.cjs');
const LOOP_PATH = path.join(REPO, 'lab/apo/apo-loop.cjs');
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

// ---------- Summary ----------

const failed = RESULTS.filter((r) => !r.ok);
console.log('');
console.log(`${RESULTS.length - failed.length}/${RESULTS.length} passed`);
if (failed.length > 0) {
  process.exit(1);
}
console.log('ALL PASS');
