#!/usr/bin/env node
// Phase 196 -- part8-egress-guard unit + CSV parity test (PB8-01/02/03/05/09).
//
// WAVE 0 CONTRACT: this test is authored before the classifier lands (Nyquist).
// It requires lib/core/part8-egress-guard.cjs inside a try/catch; while the module
// is absent it prints a SKIP line and exits 0, so the file is valid-but-inert. The
// moment 196-03 lands the classifier, every assertion below becomes binding -- this
// file IS the parity gate for that plan.
//
// classify contract (RESEARCH Pattern 3): classify(payload, { toolName }) returns
//   { verdict: 'allow' | 'block' | 'ambiguous', class, reason }
// ALLOW requires positive MOVE-SET proof; BLOCK on any CONTENT-SET hit; AMBIGUOUS
// when neither holds. Fail-closed toward block/gate, never silent-allow.
//
// Zero-dep: plain node assert, hand-rolled quoted-field CSV split (no csv package).
// CJS only. No em-dashes.
//
// Phase 239 (BRAIN-01) bare-vs-scoped decision rule: every toolName fixture
// below feeds classify() IN-PROCESS (no hook, no host matcher between this
// test and the classifier), so all 7 sites use the BARE 'brain_query' /
// 'brain_ask' form -- matching the shipped precedent in
// lib/core/bono/persona-research.cjs:208-233 (toolName: 'brain_ask') and
// brain-client.cjs's sendPacket PB8-10 belt (toolName: 'brain_packet'). The
// prior fixtures used the dead scoped-looking literal 'mcp__brain_query' /
// 'mcp__brain_ask'; classify()'s own _isFreeFormTool does a substring
// indexOf check so the verdict was never actually affected by the dead vs
// live distinction here, but the literal was still a fabricated tool name
// this census correction removes. No threat-T3 foreign-server negative case
// is added to this file: classify() has no tool-name authenticity check at
// all (that lives entirely in isBrainTool, exercised by
// tests/part8-egress-guard-hook.test.cjs and
// tests/test-brain-response-sanitize.cjs), so a foreign-server fixture here
// would assert nothing this module actually does.

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let guard;
try {
  guard = require('./part8-egress-guard.cjs');
} catch (_e) {
  console.log('SKIP: part8-egress-guard.cjs not present (Wave 0) -- inert until 196-03 lands the classifier');
  process.exit(0);
}

const classify = guard.classify;
assert.strictEqual(typeof classify, 'function', 'part8-egress-guard must export classify()');

// ---------------------------------------------------------------------------
// Zero-dep quoted-field CSV loader (PB8-09 support).
// Handles embedded commas inside double-quoted fields and doubled "" escapes.
// Format: header row Sample,Label,Reasoning ; one record per physical line
// (no embedded newlines in this fixture). Returns [{ Sample, Label, Reasoning }].
// ---------------------------------------------------------------------------
function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } // doubled "" -> literal "
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  fields.push(cur);
  return fields;
}

function loadCsvFixture(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(function (l) { return l.length > 0; });
  const header = parseCsvLine(lines[0]);
  const iSample = header.indexOf('Sample');
  const iLabel = header.indexOf('Label');
  const iReason = header.indexOf('Reasoning');
  assert.ok(iSample >= 0 && iLabel >= 0, 'CSV header must carry Sample and Label columns');
  const rows = [];
  for (let r = 1; r < lines.length; r++) {
    const f = parseCsvLine(lines[r]);
    rows.push({ Sample: f[iSample], Label: f[iLabel], Reasoning: iReason >= 0 ? f[iReason] : '' });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// MOVE-SET fixture: a clean Phase 110 packet -- job in SHIPPED_JOBS, every leaf
// summary/explanation sha256-prefixed (the projectText() invariant). This is the
// positive proof that must classify to 'allow'.
// ---------------------------------------------------------------------------
const CLEAN_MOVE_SET = {
  packet_version: '1.0',
  job: 'select_methodology',
  privacy_mode: 'strict',
  local_graph_summary: {
    nodes: [
      { summary: 'sha256:' + 'a'.repeat(64) },
      { explanation: 'sha256:' + 'b'.repeat(64) },
    ],
  },
  constraints: {},
};

// A CONTENT-SET tell: a summary that is NOT sha256-prefixed (raw user bytes) plus
// an email + a currency figure in the tool_input.
const CONTENT_SET_OBJECT = {
  tool_input: {
    note: 'reach founder jane@startup.com re: 2.3M ARR model',
    local_graph_summary: { nodes: [{ summary: 'raw uncrushed prose leaking user content' }] },
  },
};

// A shape that is neither a proven MOVE-SET nor a content hit -> ambiguous.
const NEITHER_SHAPE = { tool_input: { opaque: 'blob', count: 3 } };

// ---------------------------------------------------------------------------
// PB8-01: three-way verdict on typed packet / object inputs.
// ---------------------------------------------------------------------------
(function pb8_01() {
  const blocked = classify(CONTENT_SET_OBJECT, { toolName: 'brain_query' });
  assert.strictEqual(blocked.verdict, 'block', 'PB8-01: CONTENT-SET object must BLOCK');

  const allowed = classify(CLEAN_MOVE_SET, { toolName: 'brain_query' });
  assert.strictEqual(allowed.verdict, 'allow', 'PB8-01: clean MOVE-SET packet must ALLOW');

  const amb = classify(NEITHER_SHAPE, { toolName: 'brain_query' });
  assert.strictEqual(amb.verdict, 'ambiguous', 'PB8-01: neither-shape must be AMBIGUOUS');
})();

// ---------------------------------------------------------------------------
// PB8-03: free-form path (brain_ask/{question}, brain_query/{cypher} strings).
// ---------------------------------------------------------------------------
(function pb8_03() {
  const leaky = classify(
    { question: 'summarize this leaky prose from founder jane@startup.com about our pivot' },
    { toolName: 'brain_ask' }
  );
  assert.strictEqual(leaky.verdict, 'block', 'PB8-03: free-form question carrying user content must BLOCK');

  const generic = classify(
    { question: 'What frameworks address an ill-defined problem at the discovery stage?' },
    { toolName: 'brain_ask' }
  );
  assert.strictEqual(generic.verdict, 'allow', 'PB8-03: generic framework question must ALLOW');
})();

// ---------------------------------------------------------------------------
// PB8-05: classify() is sub-ms; 1000 iterations well under the 2000ms hook budget.
// ---------------------------------------------------------------------------
(function pb8_05() {
  const t0 = Date.now();
  for (let i = 0; i < 1000; i++) {
    classify(CLEAN_MOVE_SET, { toolName: 'brain_query' });
  }
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 500, 'PB8-05: 1000 classify() calls must run under 500ms (got ' + elapsed + 'ms)');
})();

// ---------------------------------------------------------------------------
// PB8-09: CSV parity -- every Plurai-labeled row is a fixture the local gate must
// match. violation -> block, compliant -> allow (D-07 / D-10a parity target).
// ---------------------------------------------------------------------------
(function pb8_09() {
  const csvPath = path.join(__dirname, '..', '..', 'evals', 'plurai', '01-part8-boundary-guardrail.csv');
  const rows = loadCsvFixture(csvPath);
  assert.ok(rows.length >= 8, 'PB8-09: expected the 8-row (or expanded) Plurai fixture');
  rows.forEach(function (row, idx) {
    const payload = JSON.parse(row.Sample);
    const res = classify(payload, { toolName: 'brain_query' });
    if (row.Label === 'violation') {
      assert.strictEqual(res.verdict, 'block',
        'PB8-09 row ' + (idx + 1) + ' labeled violation must BLOCK -- ' + row.Reasoning);
    } else if (row.Label === 'compliant') {
      assert.strictEqual(res.verdict, 'allow',
        'PB8-09 row ' + (idx + 1) + ' labeled compliant must ALLOW -- ' + row.Reasoning);
    } else {
      assert.fail('PB8-09 row ' + (idx + 1) + ' has unknown Label: ' + row.Label);
    }
  });
})();

console.log('PASS: part8-egress-guard unit + CSV parity (PB8-01/03/05/09) -- all assertions green');
process.exit(0);
