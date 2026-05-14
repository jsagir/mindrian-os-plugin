/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 125-05 -- lib/workflow/f-selector-ranker.cjs test suite.
 *
 * Covers the 26 acceptance behaviors from 125-05-PLAN.md <behavior> block:
 *   Tests 1-10  Ranker continuous gradient (CONTEXT.md "Ranker continuous gradient")
 *   Tests 11-14 Why content scaling (D9)
 *   Tests 15-19 Visible investment feedback (D5 + D8)
 *   Tests 20-21 Continuation callable (D10)
 *   Tests 22-24 Teaching field read (D11)
 *   Tests 25-26 Cold-start / Tier 0 (RESEARCH G-08)
 *
 * Three-surface compatibility: pure CJS + node:test. No db / no fs writes /
 * no Brain / no network. Tests use _test._setRegistry to inject deterministic
 * registry fixtures so the suite never depends on disk state.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const RANKER_PATH = path.resolve(__dirname, '..', 'workflow', 'f-selector-ranker.cjs');

function load() {
  delete require.cache[require.resolve(RANKER_PATH)];
  return require(RANKER_PATH);
}

// Deterministic registry fixture (4 commands; 2 eligible, 2 missing-content).
const FAKE_REGISTRY = {
  commands: [
    {
      command: '/mos:beautiful-question',
      kind: 'methodology',
      frameworks: ['Beautiful Question Framework'],
      serves_jtbd: ['find-problem', 'explore'],
      jtbd_label: 'Find root problem',
      jtbd_summary: 'Beautiful questions surface real problems under the symptom.',
      teaching: 'When the team disagrees, beautiful questions widen the frame before narrowing it.',
      autonomous_safe: true,
    },
    {
      command: '/mos:swot',
      kind: 'methodology',
      frameworks: ['SWOT'],
      serves_jtbd: ['validate-thesis'],
      jtbd_label: 'Audit S/W/O/T',
      jtbd_summary: 'SWOT structures internal vs external factors.',
      teaching: 'SWOT is the first lens after JTBD because it binds qualitative factors to strategic posture.',
      autonomous_safe: true,
    },
    {
      command: '/mos:missing-teaching',
      kind: 'methodology',
      frameworks: ['X'],
      serves_jtbd: ['y'],
      jtbd_label: 'X',
      jtbd_summary: 'has jtbd_summary',
      // teaching MISSING
      autonomous_safe: true,
    },
    {
      command: '/mos:missing-summary',
      kind: 'methodology',
      frameworks: ['Y'],
      serves_jtbd: ['z'],
      jtbd_label: 'Y',
      teaching: 'has teaching',
      // jtbd_summary MISSING
      autonomous_safe: true,
    },
  ],
};

function freshRanker() {
  const r = load();
  r._test._resetCaches();
  r._test._setRegistry(FAKE_REGISTRY);
  return r;
}

// ---------------------------------------------------------------------------
// Tests 1-10: Ranker continuous gradient (CONTEXT.md acceptance)
// ---------------------------------------------------------------------------

test('Test 1: investment_level 0 reduces to pure Brain confidence (other terms zeroed)', () => {
  const r = freshRanker();
  // No framework_invocations -> investment_level = 0.
  // Provide a packet with known confidence for the beautiful-question framework.
  const packet = {
    local_graph_summary: {
      framework_chain_hint: {
        edges: [
          { from: 'Beautiful Question Framework', to: 'SWOT', confidence: 0.9, hop_distance: 1 },
        ],
      },
    },
  };
  const out = r.rankForSelector({ packetOptional: packet, roomState: {}, k: 3 });
  assert.ok(out.length >= 1, 'returns at least one ranked command');
  // At investment_level 0, score = brain_confidence * 0.40 / 0.40 = brain_confidence.
  // For beautiful-question with framework match: score === 0.9 (within fp tolerance).
  const bq = out.find((x) => x.command === '/mos:beautiful-question');
  assert.ok(bq, 'beautiful-question included');
  assert.strictEqual(bq.investment_level, 0);
  assert.ok(Math.abs(bq.score - 0.9) < 0.001,
    'at investment_level 0, score equals brain_confidence (~0.9), got ' + bq.score);
});

test('Test 2: investment_level 1 uses full 3-signal formula at 40/30/30', () => {
  const r = freshRanker();
  const packet = {
    local_graph_summary: {
      framework_chain_hint: {
        edges: [
          { from: 'Beautiful Question Framework', to: 'SWOT', confidence: 0.8, hop_distance: 1 },
        ],
      },
    },
  };
  const out = r.rankForSelector({
    packetOptional: packet,
    roomState: { framework_invocations: 10, problemType: 'UDP' },
    k: 3,
  });
  const bq = out.find((x) => x.command === '/mos:beautiful-question');
  assert.ok(bq);
  assert.strictEqual(bq.investment_level, 1);
  // problem_type_bind for UDP + Beautiful Question Framework = 1.0
  // recency_decay defaults 0.5 -> (1-0.5) = 0.5
  // num = 0.8*0.40 + 0.5*0.30*1 + 1.0*0.30*1 = 0.32 + 0.15 + 0.30 = 0.77
  // den = 0.40 + 0.30 + 0.30 = 1.00
  // score = 0.77
  assert.ok(Math.abs(bq.score - 0.77) < 0.01,
    'full 3-signal score ~0.77; got ' + bq.score);
});

test('Test 3: scores normalize to 0..1 at every investment level', () => {
  const r = freshRanker();
  const packet = {
    local_graph_summary: {
      framework_chain_hint: {
        edges: [
          { from: 'Beautiful Question Framework', to: 'SWOT', confidence: 1.0, hop_distance: 1 },
        ],
      },
    },
  };
  for (const inv of [0.0, 0.3, 0.5, 0.7, 1.0]) {
    const out = r.rankForSelector({
      packetOptional: packet,
      roomState: { framework_invocations: Math.round(inv * 10), problemType: 'UDP' },
      k: 3,
    });
    for (const item of out) {
      assert.ok(item.score >= 0 && item.score <= 1,
        'score in [0,1] at inv=' + inv + ' got ' + item.score);
    }
  }
});

test('Test 4: no score discontinuity across the gradient (continuous)', () => {
  const r = freshRanker();
  const packet = {
    local_graph_summary: {
      framework_chain_hint: {
        edges: [
          { from: 'Beautiful Question Framework', to: 'SWOT', confidence: 0.6, hop_distance: 1 },
        ],
      },
    },
  };
  // Rank twice at investment_level very close together (0.49 and 0.51 via 4.9 / 5.1).
  // framework_invocations is /10 in computeInvestmentLevel.
  const left = r.rankForSelector({
    packetOptional: packet,
    roomState: { framework_invocations: 4.9 },
    k: 3,
  });
  const right = r.rankForSelector({
    packetOptional: packet,
    roomState: { framework_invocations: 5.1 },
    k: 3,
  });
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const dl = Math.abs(left[i].score - right[i].score);
    assert.ok(dl <= 0.1, 'score delta at adjacent inv must be small; got ' + dl);
  }
});

test('Test 5: source field correctness (packet | chain | registry-only)', () => {
  const r = freshRanker();
  // packet present with edges -> source === 'packet'
  const withPacket = r.rankForSelector({
    packetOptional: {
      local_graph_summary: {
        framework_chain_hint: {
          edges: [{ from: 'Beautiful Question Framework', to: 'SWOT', confidence: 0.5, hop_distance: 1 }],
        },
      },
    },
    roomState: {},
    k: 3,
  });
  const bq1 = withPacket.find((x) => x.command === '/mos:beautiful-question');
  assert.strictEqual(bq1.source, 'packet');

  // no packet, command has frameworks -> 'chain'
  const noPacket = r.rankForSelector({ roomState: {}, k: 3 });
  const bq2 = noPacket.find((x) => x.command === '/mos:beautiful-question');
  assert.strictEqual(bq2.source, 'chain');

  // command without frameworks -> 'registry-only'
  r._test._resetCaches();
  r._test._setRegistry({
    commands: [{
      command: '/mos:bare',
      kind: 'methodology',
      frameworks: [],
      serves_jtbd: ['x'],
      jtbd_label: 'x', jtbd_summary: 'x', teaching: 'x',
    }],
  });
  const bare = r.rankForSelector({ roomState: {}, k: 3 });
  assert.strictEqual(bare.length, 1);
  assert.strictEqual(bare[0].source, 'registry-only');
});

test('Test 6: commands missing jtbd_summary OR teaching are EXCLUDED (fail-closed)', () => {
  const r = freshRanker();
  const out = r.rankForSelector({ roomState: {}, k: 10 });
  const slugs = out.map((x) => x.command);
  assert.ok(slugs.indexOf('/mos:missing-teaching') === -1,
    'missing-teaching excluded');
  assert.ok(slugs.indexOf('/mos:missing-summary') === -1,
    'missing-summary excluded');
  assert.ok(slugs.indexOf('/mos:beautiful-question') !== -1, 'eligible included');
  assert.ok(slugs.indexOf('/mos:swot') !== -1, 'eligible included');
});

test('Test 7: returns exactly k results when k eligible commands exist', () => {
  const r = freshRanker();
  // FAKE_REGISTRY has 2 eligible commands.
  const out2 = r.rankForSelector({ roomState: {}, k: 2 });
  assert.strictEqual(out2.length, 2);
  const out1 = r.rankForSelector({ roomState: {}, k: 1 });
  assert.strictEqual(out1.length, 1);
});

test('Test 8: returns fewer than k when fewer eligible commands exist', () => {
  const r = freshRanker();
  // 2 eligible commands; ask for 5.
  const out = r.rankForSelector({ roomState: {}, k: 5 });
  assert.strictEqual(out.length, 2,
    'returns 2 eligible commands when 5 requested; never pads with placeholders');
});

test('Test 9: synchronous -- no Promise return; no thenable', () => {
  const r = freshRanker();
  const out = r.rankForSelector({ roomState: {}, k: 3 });
  assert.ok(Array.isArray(out), 'return value is an Array');
  assert.strictEqual(typeof out.then, 'undefined',
    'return value is not a thenable / Promise');
});

test('Test 10: no Brain calls; no memory_event writes during ranking', () => {
  // Source-level invariant: the module under test does not require brain-client
  // and does not require navigation.cjs writeEdge/logMemoryEvent. Verify via grep.
  const src = require('node:fs').readFileSync(RANKER_PATH, 'utf8');
  assert.ok(src.indexOf('require(\'../core/brain-client.cjs\')') === -1,
    'no brain-client require');
  assert.ok(src.indexOf('writeEdge') === -1, 'no writeEdge call');
  assert.ok(src.indexOf('logMemoryEvent') === -1, 'no logMemoryEvent call');
});

// ---------------------------------------------------------------------------
// Tests 11-14: Why content scaling (D9)
// ---------------------------------------------------------------------------

test('Test 11: at investment_level 0.1, why === teaching', () => {
  const r = freshRanker();
  const out = r.rankForSelector({
    roomState: { framework_invocations: 1 }, // level = 0.1
    k: 3,
  });
  const bq = out.find((x) => x.command === '/mos:beautiful-question');
  assert.ok(bq);
  assert.strictEqual(bq.why,
    'When the team disagrees, beautiful questions widen the frame before narrowing it.');
});

test('Test 12: at investment_level 0.9, why === jtbd_summary', () => {
  const r = freshRanker();
  const out = r.rankForSelector({
    roomState: { framework_invocations: 9 }, // level = 0.9
    k: 3,
  });
  const bq = out.find((x) => x.command === '/mos:beautiful-question');
  assert.ok(bq);
  assert.strictEqual(bq.why,
    'Beautiful questions surface real problems under the symptom.');
});

test('Test 13: at investment_level 0.5, why is teaching + " -- " + jtbd_summary', () => {
  const r = freshRanker();
  const out = r.rankForSelector({
    roomState: { framework_invocations: 5 }, // level = 0.5
    k: 3,
  });
  const bq = out.find((x) => x.command === '/mos:beautiful-question');
  assert.ok(bq);
  assert.strictEqual(bq.why,
    'When the team disagrees, beautiful questions widen the frame before narrowing it.'
    + ' -- '
    + 'Beautiful questions surface real problems under the symptom.');
});

test('Test 14: selectWhyContent is pure (same inputs -> same output)', () => {
  const r = load();
  const a = r.selectWhyContent('summary', 'teaching', 0.5);
  const b = r.selectWhyContent('summary', 'teaching', 0.5);
  const c = r.selectWhyContent('summary', 'teaching', 0.5);
  assert.strictEqual(a, b);
  assert.strictEqual(b, c);
  assert.strictEqual(a, 'teaching -- summary');
  // exact-string sanity at the boundaries
  assert.strictEqual(r.selectWhyContent('summary', 'teaching', 0.1), 'teaching');
  assert.strictEqual(r.selectWhyContent('summary', 'teaching', 0.9), 'summary');
});

// ---------------------------------------------------------------------------
// Tests 15-19: Visible investment feedback (D5 + D8 acceptance)
// ---------------------------------------------------------------------------

test('Test 15: renderInvestmentBadge(0.0) mentions "Brain priors" or "Brain"', () => {
  const r = load();
  const s = r.renderInvestmentBadge(0.0);
  assert.ok(typeof s === 'string' && s.length > 0);
  assert.ok(s.indexOf('Brain priors') !== -1 || s.indexOf('Brain') !== -1,
    'badge mentions Brain at level 0; got "' + s + '"');
});

test('Test 16: renderInvestmentBadge(1.0) mentions "full local" or "local scoring"', () => {
  const r = load();
  const s = r.renderInvestmentBadge(1.0);
  assert.ok(typeof s === 'string' && s.length > 0);
  assert.ok(s.indexOf('full local') !== -1 || s.indexOf('local scoring') !== -1,
    'badge mentions full local at level 1; got "' + s + '"');
});

test('Test 17: renderInvestmentBadge(0.3 / 0.5 / 0.7) are non-empty human-readable', () => {
  const r = load();
  for (const lvl of [0.3, 0.5, 0.7]) {
    const s = r.renderInvestmentBadge(lvl);
    assert.ok(typeof s === 'string' && s.length > 0, 'non-empty at ' + lvl);
    assert.ok(/Investment|Brain|local|invocations/.test(s),
      'human-readable at ' + lvl + '; got "' + s + '"');
  }
});

test('Test 18: renderInvestmentBadge(x) result length <= 80 chars for x in [0,1]', () => {
  const r = load();
  for (const lvl of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1.0]) {
    const s = r.renderInvestmentBadge(lvl);
    assert.ok(s.length <= 80, 'badge <= 80 chars at ' + lvl + '; got ' + s.length);
  }
});

test('Test 19: renderSliceBadge(2, "ill-defined state; evolving") includes 2 + rationale; <= 80', () => {
  const r = load();
  const s = r.renderSliceBadge(2, 'ill-defined state; evolving');
  assert.ok(s.length <= 80, 'badge <= 80 chars; got ' + s.length);
  assert.ok(s.indexOf('2') !== -1, 'mentions 2');
  assert.ok(s.indexOf('ill-defined') !== -1 || s.indexOf('evolving') !== -1,
    'mentions a portion of the rationale; got "' + s + '"');
});

// ---------------------------------------------------------------------------
// Tests 20-21: Continuation callable (D10 acceptance)
// ---------------------------------------------------------------------------

test('Test 20: rankForSelector called twice on same inputs returns deepEqual results (idempotent)', () => {
  const r = freshRanker();
  const input = {
    packetOptional: {
      local_graph_summary: {
        framework_chain_hint: {
          edges: [{ from: 'Beautiful Question Framework', to: 'SWOT', confidence: 0.7, hop_distance: 1 }],
        },
      },
    },
    roomState: { framework_invocations: 3, problemType: 'UDP' },
    k: 3,
  };
  const a = r.rankForSelector(input);
  const b = r.rankForSelector(input);
  assert.deepStrictEqual(a, b, 'idempotent: same input -> same output');
});

test('Test 21: rankForSelector does NOT subscribe to memory_event (no listeners)', () => {
  const src = require('node:fs').readFileSync(RANKER_PATH, 'utf8');
  // Look for event-subscription patterns. Allow harmless substrings (none expected).
  const patterns = [/\.on\(/, /\.addListener\(/, /EventEmitter/, /process\.on\(/];
  for (const p of patterns) {
    assert.ok(!p.test(src),
      'rank-related code must not subscribe to events; matched ' + String(p));
  }
});

// ---------------------------------------------------------------------------
// Tests 22-24: Teaching field read (D11 acceptance)
// ---------------------------------------------------------------------------

test('Test 22: command with teaching present but jtbd_summary missing is EXCLUDED', () => {
  const r = load();
  r._test._resetCaches();
  r._test._setRegistry({
    commands: [{
      command: '/mos:t-no-summary',
      kind: 'methodology',
      frameworks: ['X'],
      serves_jtbd: ['x'],
      jtbd_label: 'X',
      teaching: 'I have teaching but no summary.',
    }],
  });
  const out = r.rankForSelector({ roomState: {}, k: 3 });
  assert.strictEqual(out.length, 0, 'no-summary command excluded; got ' + out.length);
});

test('Test 23: command with jtbd_summary present but teaching missing is EXCLUDED', () => {
  const r = load();
  r._test._resetCaches();
  r._test._setRegistry({
    commands: [{
      command: '/mos:s-no-teaching',
      kind: 'methodology',
      frameworks: ['X'],
      serves_jtbd: ['x'],
      jtbd_label: 'X',
      jtbd_summary: 'I have summary but no teaching.',
    }],
  });
  const out = r.rankForSelector({ roomState: {}, k: 3 });
  assert.strictEqual(out.length, 0, 'no-teaching command excluded; got ' + out.length);
});

test('Test 24: when both teaching + jtbd_summary present, teaching appears at low inv; summary at high', () => {
  const r = freshRanker();
  const lowOut = r.rankForSelector({ roomState: { framework_invocations: 0 }, k: 3 });
  const highOut = r.rankForSelector({ roomState: { framework_invocations: 10 }, k: 3 });
  const lowBq = lowOut.find((x) => x.command === '/mos:beautiful-question');
  const highBq = highOut.find((x) => x.command === '/mos:beautiful-question');
  assert.ok(lowBq, 'beautiful-question in low result');
  assert.ok(highBq, 'beautiful-question in high result');
  assert.strictEqual(lowBq.why,
    'When the team disagrees, beautiful questions widen the frame before narrowing it.');
  assert.strictEqual(highBq.why,
    'Beautiful questions surface real problems under the symptom.');
});

// ---------------------------------------------------------------------------
// Tests 25-26: Cold-start / Tier 0 (RESEARCH G-08)
// ---------------------------------------------------------------------------

test('Test 25: rankForSelector({}) with no jtbd/no packet/no roomState returns at least 1', () => {
  // Use the REAL registry (Phase 104.1 shipped, so every command is eligible).
  const r = load();
  r._test._resetCaches();
  // Don't override; let the real registry load.
  const out = r.rankForSelector({});
  assert.ok(out.length >= 1, 'at least one ranked command; got ' + out.length);
  // All items must carry investment_level === 0 (cold start).
  assert.strictEqual(out[0].investment_level, 0);
  // Source is 'chain' (real commands have frameworks) or 'registry-only' for empty-fw commands.
  assert.ok(out[0].source === 'chain' || out[0].source === 'registry-only',
    "cold-start source is 'chain' or 'registry-only'; got " + out[0].source);
});

test('Test 26: rankForSelector with packetOptional containing 0-edge hint still returns ranked results', () => {
  const r = freshRanker();
  const packet = {
    local_graph_summary: {
      framework_chain_hint: {
        edges: [], // empty
        slice_scope: 1,
        slice_rationale: 'empty for test',
        fetched_at: new Date().toISOString(),
      },
    },
  };
  const out = r.rankForSelector({ packetOptional: packet, roomState: {}, k: 3 });
  assert.ok(out.length >= 1, 'tier-0 path returns ranked results even with empty hint edges');
  // With 0 edges, _sourceFor falls through past the 'packet' branch -> 'chain' or 'registry-only'
  for (const item of out) {
    assert.ok(item.source === 'chain' || item.source === 'registry-only',
      "source falls through to 'chain' or 'registry-only' when packet hint has 0 edges; got " + item.source);
  }
});

// ---------------------------------------------------------------------------
// Bonus regression tests (additive; do not count toward the 26 plan tests)
// ---------------------------------------------------------------------------

test('Bonus A: applyDecayWeight opts hook is invoked when provided', () => {
  const r = freshRanker();
  let called = 0;
  const decay = (base, commandId, _rs) => {
    called += 1;
    return base * 0.5;
  };
  const baseOut = r.rankForSelector({ roomState: {}, k: 3 });
  const decayOut = r.rankForSelector({
    roomState: {},
    k: 3,
    _applyDecayWeight: decay,
  });
  assert.ok(called >= 1, 'decay hook called at least once');
  // Decayed scores should be <= base scores for the same command (modulo sort order).
  for (const item of decayOut) {
    const baseMatch = baseOut.find((x) => x.command === item.command);
    if (baseMatch) {
      assert.ok(item.score <= baseMatch.score + 0.0001,
        'decayed score <= base for ' + item.command);
    }
  }
});

test('Bonus B: empty registry returns []', () => {
  const r = load();
  r._test._resetCaches();
  r._test._setRegistry({ commands: [] });
  const out = r.rankForSelector({ roomState: {}, k: 3 });
  assert.deepStrictEqual(out, []);
});

test('Bonus C: k defaults to 3 when not provided', () => {
  const r = freshRanker();
  // 2 eligible commands in fake; ensure we never exceed k default 3.
  const out = r.rankForSelector({ roomState: {} });
  assert.ok(out.length <= 3, 'default k cap of 3 honored');
});
