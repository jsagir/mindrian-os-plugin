'use strict';

/*
 * Phase 125-04 -- Schema superset extension validator tests.
 *
 * Adds $defs.FrameworkChainHint and the optional framework_chain_hint property
 * to $defs.LocalGraphSummary.properties. Canon Part 8 invariants preserved:
 *   - additionalProperties: false on every object node (leak-prevention teeth)
 *   - 12-job D-02 closed-vocabulary UNTOUCHED
 *   - LocalGraphSummary.required[] still has its original 6 entries
 *     (framework_chain_hint is OPTIONAL -- NOT added to required[])
 *
 * The ajv2020 validator (the same path lib/core/brain-client.cjs uses via
 * _validatorFor + _ensureSchema) picks up the new optional field automatically
 * once the schema file is updated. These tests pin the contract.
 *
 * Test 1  -- hint-absent packet validates (existing Phase 110 packet path)
 * Test 2  -- hint-present packet validates (Plan 03's enriched packet path)
 * Test 3  -- existing required[] preserved (packet missing nearest_claims rejected)
 * Test 4  -- additionalProperties:false on LocalGraphSummary (extra field rejected)
 * Test 5  -- additionalProperties:false on FrameworkChainHint (extra field rejected)
 * Test 6  -- slice_scope enum enforced (4 rejected)
 * Test 7  -- slice_scope enum accepts 1, 2, 3
 * Test 8  -- edges array maxItems 50 enforced (51 rejected)
 * Test 9  -- 12 jobs closed-vocab UNTOUCHED (count match)
 * Test 10 -- each edge requires from + to + hop_distance (missing 'to' rejected)
 * Test 11 -- null tolerance in edges (confidence:null accepted)
 */

const { test } = require('node:test');
const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Ajv2020 = require('ajv/dist/2020').default || require('ajv/dist/2020');

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'data', 'brain-packet-schema.json');
const SCHEMA = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));

// The 12 D-02 closed-vocab jobs (Canon Part 8 invariant -- Plan 04 MUST NOT
// touch this list). Mirrors scripts/build-brain-packet-schema.cjs SHIPPED_JOBS
// and lib/core/brain-client.cjs SHIPPED_JOBS.
const SHIPPED_JOBS = Object.freeze([
  'select_methodology',
  'suggest_next_move',
  'detect_contradiction',
  'summarize_neighborhood',
  'classify_room_budding',
  'rank_assumptions',
  'generate_feynman_explanation',
  'strengthen_minto',
  'prepare_investor_brief',
  'opportunity_react',
  'opportunity_reflect',
  'opportunity_rank',
]);

// Compile a validator for one (job, half). Mirrors brain-client.cjs::_validatorFor
// -- the same wrapper-with-inline-$defs pattern (ajv@8 cannot resolve a deep
// JSON pointer into a schema indexed only by its $id; the wrapper carries
// $defs inline).
function validatorFor(job, half) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  return ajv.compile({
    $id: 'urn:mindrian:test:' + job + ':' + half,
    $ref: '#/$defs/' + job + '/' + half,
    $defs: SCHEMA.$defs,
  });
}

// A minimal, valid Phase 110 packet under the suggest_next_move job. Every
// field that LocalGraphSummary.required[] requires is present with an empty
// array (per Plan 02 -- empty is valid). The Plan 03 hint is NOT included
// here; tests that want the hint add it explicitly.
function basePacket() {
  return {
    packet_version: '1.0',
    job: 'suggest_next_move',
    room_stage: 'unknown',
    origin: 'navigation_api',
    privacy_mode: 'local_summary_only',
    active_context: {
      jtbd: null,
      operator: 'OPERATOR_X',
      focus_node: { id: 'n1', type: 'claim', summary: 'sample focus node' },
    },
    local_graph_summary: {
      nearest_claims: [],
      nearest_assumptions: [],
      contradictions: [],
      unsupported_claims: [],
      recent_changes: [],
      banked_opportunities: { count: 0, items: [] },
    },
    constraints: { privacy: 'no_raw_artifact_text', max_tokens: 1200 },
  };
}

// A fully populated FrameworkChainHint (per Plan 04 CONTEXT.md Scope IN B item 5).
function fullHint() {
  return {
    edges: [
      {
        from: 'JTBD',
        to: 'Mullins 7 Domains',
        confidence: 0.82,
        transform_description: 'JTBD anchors customer pull; Mullins stress-tests market attractiveness',
        hop_distance: 1,
      },
      {
        from: 'Mullins 7 Domains',
        to: 'Porter Five Forces',
        confidence: 0.71,
        transform_description: 'Market attractiveness flows into industry structure',
        hop_distance: 2,
      },
    ],
    slice_scope: 2,
    slice_rationale: 'ill-defined state with active JTBD; 2-hop slice',
    brain_snapshot_id: 'sha256:b4a1f2c3',
    fetched_at: '2026-05-13T17:00:00Z',
  };
}

// =============================================================================
// Test 1 -- hint-absent packet validates (Phase 110 existing path stays GREEN)
// =============================================================================
test('packet-schema-validation: hint-absent packet validates', () => {
  const v = validatorFor('suggest_next_move', 'in');
  const valid = v(basePacket());
  ok(valid, 'expected valid; got errors: ' + JSON.stringify(v.errors));
});

// =============================================================================
// Test 2 -- hint-present packet validates (Plan 03 enriched path)
// =============================================================================
test('packet-schema-validation: hint-present packet validates', () => {
  const v = validatorFor('suggest_next_move', 'in');
  const p = basePacket();
  p.local_graph_summary.framework_chain_hint = fullHint();
  const valid = v(p);
  ok(valid, 'expected valid; got errors: ' + JSON.stringify(v.errors));
});

// =============================================================================
// Test 3 -- existing required[] preserved (Canon Part 8 leak-prevention teeth)
// =============================================================================
test('packet-schema-validation: missing nearest_claims is rejected', () => {
  const v = validatorFor('suggest_next_move', 'in');
  const p = basePacket();
  delete p.local_graph_summary.nearest_claims;
  const valid = v(p);
  ok(!valid, 'expected rejection');
  const msg = JSON.stringify(v.errors || []);
  ok(/nearest_claims|required/i.test(msg),
    'expected error mentioning nearest_claims or required; got: ' + msg);
});

// =============================================================================
// Test 4 -- additionalProperties:false on LocalGraphSummary
// =============================================================================
test('packet-schema-validation: extra field in local_graph_summary is rejected', () => {
  const v = validatorFor('suggest_next_move', 'in');
  const p = basePacket();
  p.local_graph_summary.forbidden_field = 'should not be allowed';
  const valid = v(p);
  ok(!valid, 'expected rejection of unknown field in local_graph_summary');
});

// =============================================================================
// Test 5 -- additionalProperties:false on FrameworkChainHint
// =============================================================================
test('packet-schema-validation: extra field in framework_chain_hint is rejected', () => {
  const v = validatorFor('suggest_next_move', 'in');
  const p = basePacket();
  p.local_graph_summary.framework_chain_hint = fullHint();
  p.local_graph_summary.framework_chain_hint.forbidden_field = 'should not be allowed';
  const valid = v(p);
  ok(!valid, 'expected rejection of unknown field in framework_chain_hint');
});

// =============================================================================
// Test 6 -- slice_scope enum enforced (only 1, 2, 3 valid; 4 rejected)
// =============================================================================
test('packet-schema-validation: slice_scope=4 is rejected', () => {
  const v = validatorFor('suggest_next_move', 'in');
  const p = basePacket();
  p.local_graph_summary.framework_chain_hint = fullHint();
  p.local_graph_summary.framework_chain_hint.slice_scope = 4;
  const valid = v(p);
  ok(!valid, 'expected rejection of slice_scope=4');
});

// =============================================================================
// Test 7 -- slice_scope enum accepts 1, 2, 3
// =============================================================================
test('packet-schema-validation: slice_scope=1, 2, 3 all accepted', () => {
  const v = validatorFor('suggest_next_move', 'in');
  for (const scope of [1, 2, 3]) {
    const p = basePacket();
    p.local_graph_summary.framework_chain_hint = fullHint();
    p.local_graph_summary.framework_chain_hint.slice_scope = scope;
    const valid = v(p);
    ok(valid, 'expected slice_scope=' + scope + ' to validate; errors: ' + JSON.stringify(v.errors));
  }
});

// =============================================================================
// Test 8 -- edges array maxItems 50 enforced (51 entries rejected)
// =============================================================================
test('packet-schema-validation: edges maxItems 50 enforced (51 rejected)', () => {
  const v = validatorFor('suggest_next_move', 'in');
  const p = basePacket();
  p.local_graph_summary.framework_chain_hint = fullHint();
  const edges = [];
  for (let i = 0; i < 51; i++) {
    edges.push({
      from: 'F' + i,
      to: 'F' + (i + 1),
      confidence: 0.5,
      transform_description: null,
      hop_distance: 1,
    });
  }
  p.local_graph_summary.framework_chain_hint.edges = edges;
  const valid = v(p);
  ok(!valid, 'expected rejection of 51 edges (maxItems=50)');
});

// =============================================================================
// Test 9 -- 12 jobs closed-vocab UNTOUCHED (D-02 invariant)
// =============================================================================
test('packet-schema-validation: 12 jobs closed-vocab D-02 untouched', () => {
  const defs = SCHEMA.$defs || {};
  for (const job of SHIPPED_JOBS) {
    ok(defs[job], 'expected $def for shipped job ' + job + ' to exist');
    ok(defs[job].in, 'expected $def "' + job + '" to have an "in" sub-schema');
    ok(defs[job].out, 'expected $def "' + job + '" to have an "out" sub-schema');
    const jobConst = defs[job].in
      && defs[job].in.properties
      && defs[job].in.properties.job
      && defs[job].in.properties.job.const;
    equal(jobConst, job,
      'expected $def "' + job + '" in.properties.job.const to equal ' + job);
  }
  // Count the jobs by detecting which $defs have an "in" sub-schema (the
  // per-job marker). Must be exactly 12 -- no additions allowed.
  const jobCount = Object.keys(defs).filter((k) => defs[k] && defs[k].in).length;
  equal(jobCount, 12,
    'expected exactly 12 job $defs (D-02 closed vocabulary); got ' + jobCount);
});

// =============================================================================
// Test 10 -- each edge requires from + to + hop_distance
// =============================================================================
test('packet-schema-validation: edge missing "to" is rejected', () => {
  const v = validatorFor('suggest_next_move', 'in');
  const p = basePacket();
  p.local_graph_summary.framework_chain_hint = fullHint();
  // Edge with `to` field omitted entirely (not null -- absent).
  p.local_graph_summary.framework_chain_hint.edges = [
    {
      from: 'JTBD',
      confidence: 0.7,
      transform_description: 'missing to field',
      hop_distance: 1,
    },
  ];
  const valid = v(p);
  ok(!valid, 'expected rejection of edge missing required "to" property');
});

// =============================================================================
// Test 11 -- null tolerance in edges (Plan 02 graceful handling)
// =============================================================================
test('packet-schema-validation: edge with confidence=null accepted', () => {
  const v = validatorFor('suggest_next_move', 'in');
  const p = basePacket();
  p.local_graph_summary.framework_chain_hint = fullHint();
  p.local_graph_summary.framework_chain_hint.edges = [
    {
      from: 'JTBD',
      to: 'Mullins 7 Domains',
      confidence: null,
      transform_description: null,
      hop_distance: 1,
    },
  ];
  const valid = v(p);
  ok(valid, 'expected null confidence to be accepted; errors: ' + JSON.stringify(v.errors));
});

// =============================================================================
// Self-assertion -- preserves the existing 6 LocalGraphSummary.required[]
// entries and framework_chain_hint is NOT one of them. This is the structural
// invariant from CONTEXT.md Scope IN B item 6 + the must_haves contract.
// =============================================================================
test('packet-schema-validation: LocalGraphSummary.required[] has 6 entries and excludes framework_chain_hint', () => {
  const req = SCHEMA.$defs.LocalGraphSummary.required;
  ok(Array.isArray(req), 'expected required[] array');
  equal(req.length, 6,
    'expected exactly 6 required entries on LocalGraphSummary; got ' + req.length);
  ok(!req.includes('framework_chain_hint'),
    'framework_chain_hint MUST be OPTIONAL -- not in required[]');
  // The original 6 (in CONTEXT.md order):
  for (const f of [
    'nearest_claims',
    'nearest_assumptions',
    'contradictions',
    'unsupported_claims',
    'recent_changes',
    'banked_opportunities',
  ]) {
    ok(req.includes(f),
      'expected ' + f + ' to remain in LocalGraphSummary.required[]');
  }
});
