#!/usr/bin/env node
'use strict';

/**
 * Phase 392 Plan 10 -- the composed envelope per D-03, D-04 and D-05.
 *
 * Drives lib/core/brain-client.cjs `_composeTheoAsk` through its injectable
 * `deps` seam ({recommendChain, query}) with scripted replies. Zero network:
 * no fetch, no key, no socket. Every fixture here is INVENTED and carries
 * framework names and closed enum values only; no real Theo text is copied
 * (Canon Part 8, fixtures invented only).
 *
 * The live-shaped fixture (brief F3, numbers only): Four Lenses rank 1
 * degree 159, Jobs to Be Done (JTBD) rank 2 degree 631, a third step
 * rank 3 degree 40 with no command. On beta.81 the plugin showed JTBD at
 * 0.90 above Four Lenses at 0.60 because confidence was
 * 0.5 + 0.4 * degree/top and the only reorder was the command-bearing-first
 * partition (the identity when every option carries a command).
 *
 * THE RULES THIS FILE PINS (D-05, D-03, D-04):
 *
 *  Order: options sorted by Theo's pedagogical rank ascending (`rank`,
 *  else `step`, else no rank); a step with no rank sorts last, by degree
 *  descending. grounding.option_order === 'theo_rank'.
 *
 *  Blend (confidence_source 'theo_rank_blend'), exported as
 *  _blendConfidence(rank, degree, top, tied):
 *    primary   = clamp(0.9 - 0.1 * (rank - 1), 0.5, 0.9); no rank -> 0.5
 *    tie-break = tied ? 0.04 * (1 - degree / top) : 0   (only between
 *                options that share one rank; degree not finite -> 0.04)
 *    confidence = round2(clamp(primary - tie-break, 0.5, 0.9))
 *  The series is monotonic non-increasing along theo_rank by construction:
 *  one rank step is 0.1, the tie-break is at most 0.04.
 *
 *  problem_type_source: 'signal' when opts.rung is a THEO_RUNG_SET member
 *  (rung_source 'structured') or opts.shape validates
 *  (rung_source 'signal'); 'heuristic' otherwise (rung_source 'inferred').
 *  Same labels on the success path and on the catch path.
 *
 *  Theo's additive fields are copied when present: grounding.evidence (the
 *  whole object), grounding.chain_coverage (the whole object),
 *  grounding.grounding_order (string, else 'lexical'). The frozen coverage
 *  unit moves to grounding.coverage, untouched.
 *
 *  coverage_label, derived from chain_coverage by one rule:
 *    no chain_coverage object            -> 'unknown'
 *    rank1_leads_total === 0             -> 'no_lead_for_type'
 *    rank1_leads_total > 0, full true    -> 'full'
 *    rank1_leads_total > 0, full false   -> 'partial'
 *    rank1_leads_total not a number      -> 'unknown'
 *
 * node:test, CJS, node:assert/strict, node built-ins only. No new deps.
 * Hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const BRAIN_CLIENT_PATH = path.resolve(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');

function freshBrainClient(key) {
  process.env.MINDRIAN_BRAIN_KEY = key;
  delete require.cache[BRAIN_CLIENT_PATH];
  return require(BRAIN_CLIENT_PATH);
}

// ---------------------------------------------------------------------------
// Fixtures (invented; framework names and enum values only)
// ---------------------------------------------------------------------------
function shapedAskPayload() {
  return {
    answer_mode: 'structured_rows',
    rows: [
      { chapterId: 'ch03', section: 'FRAMEWORK', score: 2.1, snippet: 'row one', shape_match: true },
      { chapterId: 'ch05', section: 'CONCEPT', score: 1.7, snippet: 'row two', shape_match: true },
      { chapterId: 'ch01', section: 'HOOK', score: 1.2, snippet: 'row three', shape_match: false },
    ],
    search_mode: 'lexical',
    grounding_order: 'shape_boosted',
    problem_type_source: 'signal',
    rung_source: 'signal',
    query_terms: ['which', 'framework', 'sequence'],
    effective_top_k: 3,
    diagnostics: { tool: 'brain_ask' },
  };
}

const FROZEN_COVERAGE = Object.freeze({ matched: 1, total: 4, status: 'partial' });

function fullChainCoverage() {
  return {
    steps_returned: 3,
    steps_requested: 4,
    rank1_leads_total: 1,
    rank1_leads_returned: 1,
    linked_frameworks_for_type: 46,
    full: true,
  };
}

function zeroLeadChainCoverage() {
  return {
    steps_returned: 3,
    steps_requested: 4,
    rank1_leads_total: 0,
    rank1_leads_returned: 0,
    linked_frameworks_for_type: 46,
    full: false,
  };
}

function partialChainCoverage() {
  return {
    steps_returned: 3,
    steps_requested: 4,
    rank1_leads_total: 2,
    rank1_leads_returned: 1,
    linked_frameworks_for_type: 46,
    full: false,
  };
}

function shapedChainReply(chainCoverage) {
  return {
    problem_type: 'IllDefined',
    chain: [
      { step: 1, rank: 1, framework: 'Four Lenses', degree: 159 },
      { step: 2, rank: 2, framework: 'Jobs to Be Done (JTBD)', degree: 631 },
      { step: 3, rank: 3, framework: 'Red Teaming', degree: 40 },
    ],
    ranking: 'pedagogical',
    problem_type_source: 'signal',
    rung_source: 'signal',
    evidence: { linked_frameworks_for_type: 46 },
    coverage: Object.assign({}, FROZEN_COVERAGE),
    chain_coverage: chainCoverage,
    diagnostics: { tool: 'recommend_chain' },
  };
}

const COMMAND_RECORDS = {
  records: [
    { framework: 'Four Lenses', commands: ['/mos:four-lenses'] },
    { framework: 'Jobs to Be Done (JTBD)', commands: ['/mos:jtbd'] },
  ],
};

function validShape(problemType) {
  return {
    schema_version: 1,
    problem_type: problemType,
    stage: 'Phase1',
    role: 'founder',
    domain_tag: 'engineering',
    constraint_categories: ['capital'],
  };
}

function round2(x) { return Math.round(x * 100) / 100; }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function expectedBlend(rank, degree, top, tied) {
  const primary = Number.isFinite(rank) ? clamp(0.9 - 0.1 * (rank - 1), 0.5, 0.9) : 0.5;
  let tie = 0;
  if (tied) {
    const ratio = (Number.isFinite(degree) && Number.isFinite(top) && top > 0) ? degree / top : 0;
    tie = 0.04 * (1 - ratio);
  }
  return round2(clamp(primary - tie, 0.5, 0.9));
}

// ---------------------------------------------------------------------------
// Arm 1: the live-shaped fixture, structured rung, full coverage
// ---------------------------------------------------------------------------
test('Arm 1 (D-05, D-03, D-04): shaped fixture with a structured rung -> Theo rank order, blend, signal, evidence, chain_coverage full, grounding_order', async () => {
  const brainClient = freshBrainClient('test-key-392-10-arm1');
  let queryCalls = 0;
  const composed = await brainClient._test._composeTheoAsk(
    shapedAskPayload(),
    'which framework sequence',
    {
      recommendChain: async () => shapedChainReply(fullChainCoverage()),
      query: async () => { queryCalls += 1; return COMMAND_RECORDS; },
    },
    { rung: 'IllDefined' }
  );

  const options = composed.next_gate.options;
  // Order by Theo's pedagogical rank, not by degree, not by command-bearing.
  assert.deepEqual(options.map((o) => o.framework), ['Four Lenses', 'Jobs to Be Done (JTBD)', 'Red Teaming']);
  assert.deepEqual(options.map((o) => o.theo_rank), [1, 2, 3]);
  assert.equal(composed.directive.guided.framework, 'Four Lenses');
  assert.equal(composed.grounding.option_order, 'theo_rank');

  // The blend: rank 1 reads the top value; the series is non-increasing.
  const confidences = options.map((o) => o.confidence);
  assert.equal(confidences[0], Math.max.apply(null, confidences), 'options[0].confidence must be the highest value');
  assert.equal(confidences[0], expectedBlend(1, 159, 631, false));
  assert.equal(confidences[1], expectedBlend(2, 631, 631, false));
  assert.equal(confidences[2], expectedBlend(3, 40, 631, false));
  for (let i = 1; i < confidences.length; i++) {
    assert.ok(confidences[i] <= confidences[i - 1], 'confidence must be monotonic non-increasing along theo_rank');
  }
  for (const c of confidences) assert.ok(c >= 0.5 && c <= 0.9);
  assert.equal(composed.grounding.confidence_source, 'theo_rank_blend');

  // Command information survives the order change on each option.
  assert.deepEqual(options.map((o) => o.has_command), [true, true, false]);
  assert.deepEqual(options[0].commands, ['four-lenses']);
  assert.deepEqual(options[1].commands, ['jtbd']);
  assert.deepEqual(options[2].commands, []);
  assert.equal(queryCalls, 1);

  // The signal label, decided locally by the structured rung (F2).
  assert.equal(composed.grounding.problem_type, 'IllDefined');
  assert.equal(composed.grounding.problem_type_source, 'signal');
  assert.equal(composed.grounding.rung_source, 'structured');

  // Theo's additive fields are kept (F4, D-03, D-04).
  assert.deepEqual(composed.grounding.evidence, { linked_frameworks_for_type: 46 });
  assert.equal(composed.grounding.evidence.linked_frameworks_for_type, 46);
  assert.deepEqual(composed.grounding.chain_coverage, fullChainCoverage());
  assert.equal(composed.grounding.coverage_label, 'full');
  assert.equal(composed.grounding.grounding_order, 'shape_boosted');

  // The frozen coverage unit is untouched and still present.
  assert.deepEqual(composed.grounding.coverage, FROZEN_COVERAGE);
  assert.equal(composed.grounding.chain_status, 'ok');
  assert.equal(composed.grounding.rows.length, 3);
  assert.equal('query_terms' in composed, false);
});

// ---------------------------------------------------------------------------
// Arm 2: coverage_label variants
// ---------------------------------------------------------------------------
test('Arm 2 (D-03): coverage_label reads no_lead_for_type on rank1_leads_total 0, partial when leads are missing, unknown without the block', async () => {
  const brainClient = freshBrainClient('test-key-392-10-arm2');
  const deps = (reply) => ({ recommendChain: async () => reply, query: async () => COMMAND_RECORDS });

  const zero = await brainClient._test._composeTheoAsk(shapedAskPayload(), 'q', deps(shapedChainReply(zeroLeadChainCoverage())), { rung: 'IllDefined' });
  assert.deepEqual(zero.grounding.chain_coverage, zeroLeadChainCoverage());
  assert.equal(zero.grounding.coverage_label, 'no_lead_for_type', 'full false with total 0 means canon records no lead, never a partial chain');

  const partial = await brainClient._test._composeTheoAsk(shapedAskPayload(), 'q', deps(shapedChainReply(partialChainCoverage())), { rung: 'IllDefined' });
  assert.equal(partial.grounding.coverage_label, 'partial');

  const withoutBlock = shapedChainReply(fullChainCoverage());
  delete withoutBlock.chain_coverage;
  delete withoutBlock.evidence;
  const bare = await brainClient._test._composeTheoAsk(shapedAskPayload(), 'q', deps(withoutBlock), { rung: 'IllDefined' });
  assert.equal(bare.grounding.chain_coverage, null);
  assert.equal(bare.grounding.coverage_label, 'unknown');
  assert.equal(bare.grounding.evidence, null);
  assert.deepEqual(bare.grounding.coverage, FROZEN_COVERAGE, 'the frozen unit is independent of the additive block');
});

// ---------------------------------------------------------------------------
// Arm 3: the heuristic path and the lexical default
// ---------------------------------------------------------------------------
test('Arm 3 (F2): no rung and no shape -> heuristic and inferred; no grounding_order on the payload -> lexical', async () => {
  const brainClient = freshBrainClient('test-key-392-10-arm3');
  const payload = shapedAskPayload();
  delete payload.grounding_order;
  delete payload.problem_type_source;
  delete payload.rung_source;
  const composed = await brainClient._test._composeTheoAsk(payload, 'which framework sequence', {
    recommendChain: async () => shapedChainReply(fullChainCoverage()),
    query: async () => COMMAND_RECORDS,
  });
  assert.equal(composed.grounding.problem_type_source, 'heuristic');
  assert.equal(composed.grounding.rung_source, 'inferred');
  assert.equal(composed.grounding.grounding_order, 'lexical');
  assert.equal(composed.grounding.option_order, 'theo_rank');
  assert.equal(composed.grounding.confidence_source, 'theo_rank_blend');
});

// ---------------------------------------------------------------------------
// Arm 4: the shape path (plan 392-12 passes opts.shape)
// ---------------------------------------------------------------------------
test('Arm 4 (D-05, T-392-28): a validated shape decides the rung -> signal with rung_source signal; an invalid shape falls back to heuristic', async () => {
  const brainClient = freshBrainClient('test-key-392-10-arm4');
  const deps = { recommendChain: async () => shapedChainReply(fullChainCoverage()), query: async () => COMMAND_RECORDS };

  const shaped = await brainClient._test._composeTheoAsk(shapedAskPayload(), 'which framework sequence', deps, { shape: validShape('Wicked') });
  assert.equal(shaped.grounding.problem_type, 'Wicked');
  assert.equal(shaped.grounding.problem_type_source, 'signal');
  assert.equal(shaped.grounding.rung_source, 'signal');
  assert.equal(shaped.directive.guided.stage, 'Wicked');

  // A structured rung wins over the shape (the caller classified the room).
  const both = await brainClient._test._composeTheoAsk(shapedAskPayload(), 'q', deps, { rung: 'WellDefined', shape: validShape('Wicked') });
  assert.equal(both.grounding.problem_type, 'WellDefined');
  assert.equal(both.grounding.problem_type_source, 'signal');
  assert.equal(both.grounding.rung_source, 'structured');

  // An invalid shape (unknown problem type) never earns the signal label.
  const invalid = await brainClient._test._composeTheoAsk(shapedAskPayload(), 'which framework sequence', deps, { shape: validShape('NotARung') });
  assert.equal(invalid.grounding.problem_type_source, 'heuristic');
  assert.equal(invalid.grounding.rung_source, 'inferred');

  // A shape with a sibling key is refused by the validator and treated as absent.
  const extra = Object.assign(validShape('Wicked'), { question: 'x' });
  const refused = await brainClient._test._composeTheoAsk(shapedAskPayload(), 'q', deps, { shape: extra });
  assert.equal(refused.grounding.problem_type_source, 'heuristic');
});

// ---------------------------------------------------------------------------
// Arm 5: catch paths
// ---------------------------------------------------------------------------
test('Arm 5: recommend_chain failure keeps the labels; chain_status unchanged; chain_coverage null; coverage_label unknown', async () => {
  const brainClient = freshBrainClient('test-key-392-10-arm5');
  const throwing = { recommendChain: async () => { throw new Error('simulated recommend_chain wire failure'); }, query: async () => COMMAND_RECORDS };

  const structured = await brainClient._test._composeTheoAsk(shapedAskPayload(), 'q', throwing, { rung: 'Wicked' });
  assert.equal(structured.grounding.chain_status, 'unreachable');
  assert.deepEqual(structured.next_gate.options, []);
  assert.equal(structured.grounding.problem_type_source, 'signal');
  assert.equal(structured.grounding.rung_source, 'structured');
  assert.equal(structured.grounding.confidence_source, 'theo_rank_blend');
  assert.equal(structured.grounding.option_order, 'theo_rank');
  assert.equal(structured.grounding.chain_coverage, null);
  assert.equal(structured.grounding.coverage_label, 'unknown');
  assert.equal(structured.grounding.grounding_order, 'shape_boosted');

  const heuristic = await brainClient._test._composeTheoAsk(shapedAskPayload(), 'which framework sequence', throwing);
  assert.equal(heuristic.grounding.chain_status, 'unreachable');
  assert.equal(heuristic.grounding.problem_type_source, 'heuristic');
  assert.equal(heuristic.grounding.rung_source, 'inferred');

  // The empty chain keeps chain_status 'empty' as on beta.81.
  const empty = await brainClient._test._composeTheoAsk(shapedAskPayload(), 'q', {
    recommendChain: async () => ({ problem_type: 'IllDefined', chain: [], coverage: { matched: 0, total: 4, status: 'empty' } }),
    query: async () => { throw new Error('query() must never be called with zero steps'); },
  }, { rung: 'IllDefined' });
  assert.equal(empty.grounding.chain_status, 'empty');
  assert.equal(empty.grounding.problem_type_source, 'signal');
  assert.equal(empty.grounding.coverage_label, 'unknown');

  // The outer catch (a step whose degree getter throws after chainStatus is ok).
  const explodingStep = new Proxy({ step: 1, rank: 1, framework: 'Boom' }, {
    get(target, prop) {
      if (prop === 'degree') throw new Error('simulated degree-accessor failure');
      return target[prop];
    },
  });
  const outer = await brainClient._test._composeTheoAsk(shapedAskPayload(), 'q', {
    recommendChain: async () => ({ chain: [explodingStep] }),
    query: async () => ({ records: [] }),
  }, { rung: 'UnDefined' });
  assert.deepEqual(outer.next_gate.options, []);
  assert.equal(outer.grounding.chain_status, 'unreachable');
  assert.equal(outer.grounding.problem_type_source, 'signal');
  assert.equal(outer.grounding.rung_source, 'structured');
  assert.equal(outer.grounding.confidence_source, 'theo_rank_blend');
  assert.equal(outer.grounding.option_order, 'theo_rank');
  assert.equal(outer.grounding.chain_coverage, null);
  assert.equal(outer.grounding.coverage_label, 'unknown');
});

// ---------------------------------------------------------------------------
// Arm 6: ties and a missing rank
// ---------------------------------------------------------------------------
test('Arm 6 (D-05): equal ranks break by degree within 0.04; a step without rank or step sorts last; the series stays non-increasing', async () => {
  const brainClient = freshBrainClient('test-key-392-10-arm6');
  const reply = {
    chain: [
      { rank: 2, framework: 'Beta Low', degree: 100 },
      { framework: 'No Rank', degree: 900 },
      { rank: 2, framework: 'Beta High', degree: 400 },
      { rank: 1, framework: 'Alpha', degree: 50 },
    ],
    coverage: Object.assign({}, FROZEN_COVERAGE),
  };
  const composed = await brainClient._test._composeTheoAsk(shapedAskPayload(), 'q', {
    recommendChain: async () => reply,
    query: async () => ({ records: [] }),
  }, { rung: 'IllDefined' });
  const options = composed.next_gate.options;
  assert.deepEqual(options.map((o) => o.framework), ['Alpha', 'Beta High', 'Beta Low', 'No Rank']);
  // theo_rank keeps Theo's rank; the unranked step keeps its 1-based chain index (2) as before.
  assert.deepEqual(options.map((o) => o.theo_rank), [1, 2, 2, 2]);
  const c = options.map((o) => o.confidence);
  assert.equal(c[0], 0.9);
  assert.equal(c[1], expectedBlend(2, 400, 900, true));
  assert.equal(c[2], expectedBlend(2, 100, 900, true));
  assert.ok(c[1] > c[2], 'the higher degree wins the tie');
  assert.ok(c[1] - c[2] <= 0.04 + 1e-9, 'the tie-break is at most 0.04');
  assert.equal(c[3], 0.5, 'a step without a rank reads the floor');
  for (let i = 1; i < c.length; i++) assert.ok(c[i] <= c[i - 1], 'non-increasing');
});

// ---------------------------------------------------------------------------
// Arm 7: the exported blend
// ---------------------------------------------------------------------------
test('Arm 7: _blendConfidence is exported and follows the documented formula with its clamp', () => {
  const brainClient = freshBrainClient('test-key-392-10-arm7');
  const blend = brainClient._test._blendConfidence;
  assert.equal(typeof blend, 'function');
  assert.equal(blend(1, 159, 631), 0.9);
  assert.equal(blend(2, 631, 631), 0.8);
  assert.equal(blend(3, 40, 631), 0.7);
  assert.equal(blend(5, 10, 631), 0.5);
  assert.equal(blend(9, 10, 631), 0.5, 'clamped at the floor');
  assert.equal(blend(0, 10, 631), 0.9, 'clamped at the ceiling');
  assert.equal(blend(null, 900, 900), 0.5, 'no rank reads the floor');
  assert.equal(blend(1, 631, 631, true), 0.9, 'a tied top-degree option keeps the primary');
  assert.equal(blend(1, 159, 631, true), expectedBlend(1, 159, 631, true));
  assert.equal(blend(1, 159, 631, true), 0.87);
  assert.equal(blend(1, 0, 631, true), 0.86, 'the full tie-break is 0.04');
  assert.equal(blend(1, NaN, 631, true), 0.86, 'a non-finite degree takes the full tie-break');
  assert.equal(blend(5, 0, 631, true), 0.5, 'the floor holds under the tie-break');
});

// ---------------------------------------------------------------------------
// Arm 8: Canon Part 8 tripwire on the new copied fields
// ---------------------------------------------------------------------------
test('Arm 8 (Part 8): only the named Theo fields are copied into grounding; a canary in an unnamed reply key never reaches grounding', async () => {
  const brainClient = freshBrainClient('test-key-392-10-arm8');
  const CANARY = 'CANARY39210UNNAMEDKEY';
  const reply = shapedChainReply(fullChainCoverage());
  reply.unexpected_echo = CANARY;
  reply.diagnostics = { note: CANARY };
  const composed = await brainClient._test._composeTheoAsk(shapedAskPayload(), 'q', {
    recommendChain: async () => reply,
    query: async () => ({ diagnostics: { note: CANARY }, records: [] }),
  }, { rung: 'IllDefined' });
  assert.equal(JSON.stringify(composed.grounding).includes(CANARY), false, 'grounding copies only the named fields');
  assert.deepEqual(Object.keys(composed.grounding).sort(), [
    'answer_mode', 'chain_coverage', 'chain_status', 'confidence_source', 'coverage', 'coverage_label',
    'evidence', 'grounding_order', 'option_order', 'problem_type', 'problem_type_source', 'rows', 'rung_source', 'source',
  ]);
});
