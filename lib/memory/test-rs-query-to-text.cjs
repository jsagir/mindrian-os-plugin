#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.5 Plan 03 -- rs-query-to-text Larry-voiced explainer suite.
 *
 * 11 scenarios covering raw graph results -> Larry-voiced NL explanation:
 *
 * Positive-path (4 result types each get >=1 test):
 *   T1  rs_discovery kind: explain renders evidence + insight + warning structure
 *   T2  expert_network kind: explain mentions experts + institutions
 *   T3  methodology_chain kind: explain mentions JTBD chaining
 *   T4  discovery_history kind: explain mentions count + reflection prompt
 *
 * Venture context enrichment (Mode A; quadruple complete):
 *   T5  opts._test_quadruple_override carries room+state+minto+brain;
 *       rendered string surfaces brain.sections.pattern_matches signal
 *       (Mode A enrichment proof)
 *
 * Mode B fallback (BRAIN.md absent):
 *   T6  opts._test_quadruple_override with brain:null still renders coherent
 *       string and does NOT contain Mode A "Brain says" enrichment marker
 *
 * No-LLM invariant:
 *   T7  fetch shim never called; brain-client require throws if attempted;
 *       explain() returns normally
 *
 * Canon Part 8 adversarial (post-render audit):
 *   T8  forbidden pattern in input query_results -> input audit OR output
 *       audit throws ExternalEgressViolation
 *   T9  forbidden meeting fragment in row text -> output redacts OR throws
 *
 * Voice pattern adherence:
 *   T10 rs_discovery output matches Evidence -> Insight -> Warning pedagogy
 *
 * A1 sweep (defense-in-depth across positive outputs):
 *   T11 every positive-path rendered string scanned against
 *       FORBIDDEN_PATTERNS -> zero matches
 *
 * Pure CJS, zero npm deps, node built-ins only (assert + fs + path).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ---------- Suite bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];

function record(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write('PASS ' + name + '\n');
  } catch (err) {
    failed++;
    failures.push({ name, message: err && err.message ? err.message : String(err) });
    process.stdout.write('FAIL ' + name + ': ' + (err && err.message ? err.message : String(err)) + '\n');
  }
}

// ---------- Module under test ----------

const mod = require('../core/rs-query-to-text.cjs');
const { explain, VOICE_TEMPLATES, _test } = mod;

const egressPrompts = require('../core/rs-egress-prompts.cjs');
const { FORBIDDEN_PATTERNS } = egressPrompts;

// Collect positive-test outputs for the A1 sweep (T11).
const positiveOutputs = [];

// ---------- T1: rs_discovery positive path ----------

record('T1 rs_discovery: explain renders Larry-voiced evidence + insight', function () {
  const query_results = {
    kind: 'rs_discovery',
    rows: [
      {
        id: 'rs-1',
        thesis: 'Apply quantum sensing to adjacent imaging modalities',
        breakthrough_score: 8,
        classification: 'structural_transfer',
        domains: ['physics', 'medicine'],
      },
      {
        id: 'rs-2',
        thesis: 'Photonic compute',
        breakthrough_score: 5,
      },
    ],
  };
  const out = explain(query_results, {});
  positiveOutputs.push(out);

  assert.equal(typeof out, 'string', 'explain must return a string');
  assert.ok(out.length > 0, 'rendered string must be non-empty');
  // Evidence: numeric "Found N" or "discoveries" leading.
  assert.ok(/\b2\b/.test(out),
    'rendered string must reference the row count (2) somewhere');
  assert.ok(/(Found|discoveries|surfaced|candidates|pairs)/i.test(out),
    'rendered string must lead with an evidence verb (Found / discoveries / surfaced / candidates / pairs)');
  // Insight: top thesis surfaces in narrative.
  assert.ok(out.indexOf('Apply quantum sensing') !== -1,
    'top thesis text must surface in rendered string');
  // Warning / forward-looking: a Canon Part 3 verb OR a /mos: command OR
  // pedagogical "next" prompt appears in the rendering.
  const hasNextPrompt =
    /(Bank Opportunity|Run Methodology|Devils Advocate|Synthesize|Reformulate|Defer|Reflect|Reading the Room)/i.test(out)
    || /\/mos:/.test(out)
    || /(file|next|worth|merits)/i.test(out);
  assert.ok(hasNextPrompt,
    'rendered string must include a forward-looking next-step (Canon Part 3 verb or /mos: command or pedagogical prompt)');
});

// ---------- T2: expert_network positive path ----------

record('T2 expert_network: explain mentions experts + institutions', function () {
  const query_results = {
    kind: 'expert_network',
    rows: [
      { name: 'Dr. X', institution: 'MIT' },
      { name: 'Dr. Y', institution: 'Stanford' },
    ],
  };
  const out = explain(query_results, {});
  positiveOutputs.push(out);

  assert.equal(typeof out, 'string', 'explain must return a string');
  assert.ok(/\b2\b/.test(out), 'rendered string must reference row count 2');
  // At least one of "Mapped" or "experts" or "authors" leads.
  assert.ok(/(Mapped|experts|authors|domain experts|Found)/i.test(out),
    'rendered string must lead with an expert-network evidence verb');
  // Both institutions surface.
  assert.ok(out.indexOf('MIT') !== -1, 'rendered string must include MIT');
  assert.ok(out.indexOf('Stanford') !== -1, 'rendered string must include Stanford');
});

// ---------- T3: methodology_chain positive path ----------

record('T3 methodology_chain: explain mentions JTBD chain pattern', function () {
  const query_results = {
    kind: 'methodology_chain',
    rows: [
      { from: 'jtbd', to: 'persona' },
      { from: 'jtbd', to: 'lean-canvas' },
    ],
  };
  const out = explain(query_results, {});
  positiveOutputs.push(out);

  assert.equal(typeof out, 'string', 'explain must return a string');
  // Source framework name surfaces.
  assert.ok(/jtbd/i.test(out), 'rendered string must reference jtbd source');
  // Downstream targets surface.
  const hasPersona = out.indexOf('persona') !== -1;
  const hasLean = out.indexOf('lean-canvas') !== -1;
  assert.ok(hasPersona || hasLean,
    'rendered string must mention at least one downstream target (persona OR lean-canvas)');
  // Numeric chain count surfaces.
  assert.ok(/\b2\b/.test(out),
    'rendered string must reference downstream count 2');
});

// ---------- T4: discovery_history positive path ----------

record('T4 discovery_history: explain renders count + reflection prompt', function () {
  const query_results = {
    kind: 'discovery_history',
    rows: [
      { thesis: 'Old discovery', created_at: '2026-04-20' },
      { thesis: 'Newer discovery insight', created_at: '2026-04-26' },
    ],
  };
  const out = explain(query_results, {});
  positiveOutputs.push(out);

  assert.equal(typeof out, 'string', 'explain must return a string');
  assert.ok(/\b2\b/.test(out),
    'rendered string must reference history count 2');
  assert.ok(/(discoveries|logged|looking back|recent)/i.test(out),
    'rendered string must lead with a discovery-history evidence verb');
  // Most-recent thesis surfaces.
  assert.ok(out.indexOf('Newer discovery insight') !== -1
    || out.indexOf('Old discovery') !== -1,
    'rendered string must mention at least one historical thesis');
  // Reflection prompt: Synthesize OR /mos:reflect OR convergence cue.
  assert.ok(/(Synthesize|Reflect|reflecting|convergence|pattern)/i.test(out),
    'rendered string must include a reflection prompt (Synthesize / Reflect / convergence / pattern)');
});

// ---------- T5: venture context enrichment (Mode A; quadruple complete) ----------

record('T5 Mode A: quadruple override surfaces brain enrichment in render', function () {
  const query_results = {
    kind: 'rs_discovery',
    rows: [
      {
        id: 'rs-1',
        thesis: 'Adjacent domain transfer hypothesis',
        breakthrough_score: 7,
        classification: 'structural_transfer',
      },
    ],
  };
  const opts = {
    room_dir: '/tmp/test-room-with-quadruple',
    _test_quadruple_override: {
      room: {
        exists: true,
        identity_text: 'fintech-venture',
        references: [],
        last_updated_at: null,
      },
      state: {
        exists: true,
        artifact_count: 5,
        gap_status: 'active',
        completeness_score: 0.6,
        minto_health: 'fresh',
        last_activity_at: null,
      },
      reasoning: {
        exists: true,
        governing_thought: 'expand to APAC',
        arguments_count: 3,
        evidence_density: 0.5,
        mece_status: 'pass',
        reasoning_health_score: 0.7,
        flagged_weaknesses: [],
        decision_log: [],
        last_generated_at: null,
        last_artifact_write_seen_at: null,
        is_stale: false,
        stale_reason: null,
      },
      brain: {
        exists: true,
        section: 'opportunity-bank',
        brain_generated_at: '2026-04-26T12:00:00Z',
        brain_graph_version: 1,
        governing_thought_hash: 'abc123',
        staleness: 'fresh',
        stale_reason: null,
        author: 'derive',
        confidence_baseline: 0.8,
        parse_failed: false,
        sections: {
          pattern_matches: { body: 'adjacent-domain-X structural pattern hit', tokens_estimate: 9 },
          cross_domain_analogies: null,
          wicked_indicators: null,
          unfilled_opportunity_matches: null,
          framework_chain_predictions: null,
          assessment_thinking_chain_position: null,
          problemtype_classification: null,
          flagged_contradictions_xroom: null,
          hsi_signals: null,
        },
        flagged_weaknesses: [],
      },
    },
  };
  const out = explain(query_results, opts);
  positiveOutputs.push(out);

  assert.equal(typeof out, 'string', 'explain must return a string');
  assert.ok(out.length > 0, 'rendered string must be non-empty');
  // Mode A enrichment marker surfaces somewhere.
  const hasBrainMarker = /Brain says|Brain:|brain enrichment|Brain context/i.test(out);
  const hasPatternMatch = out.indexOf('adjacent-domain-X') !== -1
    || out.indexOf('structural pattern') !== -1;
  assert.ok(hasBrainMarker || hasPatternMatch,
    'Mode A render must surface brain pattern_matches signal (either explicit Brain marker OR pattern_matches body text)');
});

// ---------- T6: Mode B fallback (BRAIN.md absent) ----------

record('T6 Mode B: brain:null does NOT surface Brain enrichment marker', function () {
  const query_results = {
    kind: 'rs_discovery',
    rows: [
      {
        id: 'rs-1',
        thesis: 'Local-only Mode B test thesis',
        breakthrough_score: 6,
      },
    ],
  };
  const opts = {
    room_dir: '/tmp/test-room-without-brain',
    _test_quadruple_override: {
      room: {
        exists: true,
        identity_text: 'mode-b-room',
        references: [],
        last_updated_at: null,
      },
      state: {
        exists: true,
        artifact_count: 2,
        gap_status: 'seeded',
        completeness_score: 0.3,
        minto_health: '--',
        last_activity_at: null,
      },
      reasoning: {
        exists: false,
        governing_thought: null,
        arguments_count: 0,
        evidence_density: 0,
        mece_status: 'fail',
        reasoning_health_score: 0,
        flagged_weaknesses: [],
        decision_log: [],
        last_generated_at: null,
        last_artifact_write_seen_at: null,
        is_stale: true,
        stale_reason: 'never_generated',
      },
      brain: null,
    },
  };
  const out = explain(query_results, opts);
  positiveOutputs.push(out);

  assert.equal(typeof out, 'string', 'explain must return a string');
  assert.ok(out.length > 0, 'rendered string must be non-empty');
  // Crucial Mode B invariant: NO Brain enrichment marker.
  assert.ok(!/Brain says/i.test(out),
    'Mode B render must NOT contain "Brain says" enrichment marker');
});

// ---------- T7: no-LLM invariant proof ----------

record('T7 no-LLM: fetch shim never called; brain-client require not allowed', function () {
  // Install fetch shim that throws if called.
  const originalFetch = global.fetch;
  let fetchCalled = false;
  global.fetch = function () {
    fetchCalled = true;
    throw new Error('fetch must NEVER be called from rs-query-to-text');
  };
  try {
    // Also probe Module._cache: brain-client.cjs MUST NOT be in the require
    // graph of rs-query-to-text.cjs.
    const Module = require('node:module');
    const cacheKeys = Object.keys(Module._cache || {});
    const brainClientLoaded = cacheKeys.some(function (k) {
      return /\/brain-client\.cjs$/.test(k);
    });
    // It's allowed for OTHER suites or test-time imports to have loaded
    // brain-client; the proof we want is that THIS module did not require
    // it. So we check the source of rs-query-to-text.cjs directly.
    const srcPath = path.resolve(__dirname, '../core/rs-query-to-text.cjs');
    const src = fs.readFileSync(srcPath, 'utf8');
    const brainClientHits = (src.match(/require\(['"][^'"]*brain-client[^'"]*['"]\)/g) || []).length;
    assert.equal(brainClientHits, 0,
      'rs-query-to-text.cjs must NOT require brain-client.cjs; got ' + brainClientHits + ' hits');

    // Run explain through full positive path.
    const query_results = {
      kind: 'rs_discovery',
      rows: [{ id: 'rs-1', thesis: 'no-LLM proof', breakthrough_score: 4 }],
    };
    const out = explain(query_results, {});
    assert.equal(typeof out, 'string', 'explain must return string even with fetch shim active');
    assert.equal(fetchCalled, false,
      'fetch must NOT be called during explain()');
    // Suppress unused-var lint by referencing brainClientLoaded.
    void brainClientLoaded;
  } finally {
    global.fetch = originalFetch;
  }
});

// ---------- T8: Canon Part 8 input adversarial ----------

record('T8 adversarial: forbidden pattern in input throws OR is redacted', function () {
  // Email-like forbidden pattern in row text.
  const query_results = {
    kind: 'rs_discovery',
    rows: [
      {
        id: 'rs-evil',
        thesis: 'Reach out to lawrence@example.com about the discovery',
        breakthrough_score: 9,
      },
    ],
  };
  let threw = null;
  let out = null;
  try {
    out = explain(query_results, {});
  } catch (e) {
    threw = e;
  }
  if (threw !== null) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'thrown error must be ExternalEgressViolation');
    assert.ok(threw.meta && typeof threw.meta === 'object',
      'ExternalEgressViolation must carry meta');
  } else {
    // Acceptable alternative: rendered output strips the email.
    assert.equal(typeof out, 'string', 'if not thrown, must return string');
    assert.ok(out.indexOf('lawrence@example.com') === -1,
      'rendered output must NOT contain raw forbidden email pattern');
  }
});

// ---------- T9: meeting-transcript fragment leak ----------

record('T9 adversarial: "meeting with" fragment redacted OR throws', function () {
  const query_results = {
    kind: 'rs_discovery',
    rows: [
      {
        id: 'rs-evil-2',
        thesis: 'Insight surfaced during meeting with the team last week',
        breakthrough_score: 7,
      },
    ],
  };
  let threw = null;
  let out = null;
  try {
    out = explain(query_results, {});
  } catch (e) {
    threw = e;
  }
  if (threw !== null) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'thrown error must be ExternalEgressViolation');
  } else {
    assert.equal(typeof out, 'string', 'if not thrown, must return string');
    assert.ok(!/meeting with/i.test(out),
      'rendered output must NOT contain "meeting with" forbidden fragment');
  }
});

// ---------- T10: voice pattern adherence ----------

record('T10 voice pattern: rs_discovery output follows Evidence -> Insight -> Warning', function () {
  const query_results = {
    kind: 'rs_discovery',
    rows: [
      {
        id: 'rs-pedagogy',
        thesis: 'Cross-domain transfer thesis for pedagogy test',
        breakthrough_score: 8,
        classification: 'structural_transfer',
      },
      {
        id: 'rs-pedagogy-2',
        thesis: 'Secondary discovery',
        breakthrough_score: 5,
      },
      {
        id: 'rs-pedagogy-3',
        thesis: 'Tertiary discovery',
        breakthrough_score: 4,
      },
    ],
  };
  const out = explain(query_results, {});
  positiveOutputs.push(out);

  assert.equal(typeof out, 'string', 'explain must return a string');
  // Evidence: leading numeric statement (Found / surfaced / candidates / pairs / discoveries).
  const hasEvidence = /(Found\s+\d+|^\d+\s+discoveries|surfaced|candidates|pairs|discoveries)/i.test(out);
  assert.ok(hasEvidence,
    'voice template must lead with quantitative Evidence statement');
  // Insight: synthesis (top thesis or "strongest" or "Top:" or "Pattern" surfaces).
  const hasInsight = /(strongest|Top:|Pattern|merits|stands\s+out)/i.test(out)
    || out.indexOf('Cross-domain transfer thesis') !== -1;
  assert.ok(hasInsight,
    'voice template must contain Insight synthesis (strongest/Top/Pattern OR top thesis text)');
  // Warning / forward-looking: Canon Part 3 verb OR /mos: command OR
  // "next" / "worth" prompt.
  const hasWarning =
    /(Bank Opportunity|Run Methodology|Devils Advocate|Synthesize|Reformulate|Defer|Reflect)/i.test(out)
    || /\/mos:/.test(out)
    || /(worth|next|merits|file|filed)/i.test(out);
  assert.ok(hasWarning,
    'voice template must end with forward-looking Warning / next-step prompt');
});

// ---------- T11: A1 sweep across positive outputs ----------

record('T11 A1 sweep: zero FORBIDDEN_PATTERNS in positive outputs', function () {
  assert.ok(positiveOutputs.length >= 5,
    'must have collected >= 5 positive outputs for A1 sweep; got '
      + positiveOutputs.length);
  for (let i = 0; i < positiveOutputs.length; i++) {
    const out = positiveOutputs[i];
    assert.equal(typeof out, 'string',
      'positive output ' + i + ' must be a string');
    for (const re of FORBIDDEN_PATTERNS) {
      assert.equal(re.test(out), false,
        'A1 sweep failed: positive output ' + i + ' matched FORBIDDEN_PATTERN '
          + re.source + '; sample: ' + out.slice(0, 120));
    }
  }
});

// ---------- Extra structural assertions on the module surface ----------

record('T_extra VOICE_TEMPLATES surface conformance (frozen + 5 kinds + >=3 each)', function () {
  assert.ok(VOICE_TEMPLATES && typeof VOICE_TEMPLATES === 'object',
    'VOICE_TEMPLATES must be an object');
  assert.ok(Object.isFrozen(VOICE_TEMPLATES),
    'VOICE_TEMPLATES must be Object.freeze\'d');
  const expectedKinds = ['rs_discovery', 'expert_network', 'methodology_chain', 'discovery_history', 'fallback'];
  for (const kind of expectedKinds) {
    assert.ok(Array.isArray(VOICE_TEMPLATES[kind]),
      'VOICE_TEMPLATES.' + kind + ' must be an array');
    assert.ok(Object.isFrozen(VOICE_TEMPLATES[kind]),
      'VOICE_TEMPLATES.' + kind + ' array must be frozen');
    assert.ok(VOICE_TEMPLATES[kind].length >= 3,
      'VOICE_TEMPLATES.' + kind + ' must have >= 3 templates; got '
        + VOICE_TEMPLATES[kind].length);
  }
  // _test export shape.
  assert.ok(_test && typeof _test === 'object', '_test must be an object');
  assert.equal(typeof _test.detectKind, 'function',
    '_test.detectKind must be a function');
  assert.equal(typeof _test.loadVentureContext, 'function',
    '_test.loadVentureContext must be a function');
  assert.equal(typeof _test.pickTemplate, 'function',
    '_test.pickTemplate must be a function');
  assert.equal(typeof _test.fillTemplate, 'function',
    '_test.fillTemplate must be a function');
});

// ---------- Suite report ----------

const total = passed + failed;
process.stdout.write('\n');
if (failed === 0) {
  process.stdout.write('=== 89.5-03 rs-query-to-text suite: ' + passed + '/' + total + ' passed ===\n');
  process.exit(0);
} else {
  process.stdout.write('=== 89.5-03 rs-query-to-text suite: ' + passed + '/' + total + ' passed (' + failed + ' failed) ===\n');
  for (const f of failures) {
    process.stdout.write('  FAIL ' + f.name + ': ' + f.message + '\n');
  }
  process.exit(1);
}
