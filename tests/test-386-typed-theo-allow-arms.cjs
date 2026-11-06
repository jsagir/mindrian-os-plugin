'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 386-25 (E-TYPED): allow arms for the typed Theo read tools.
 * Debug session: part8-egress-guard-blocks-pws-brain-mcp-unconditionally.
 *
 * Calls classify() directly with roomDir null. Synthetic strings and canonical
 * framework handles only. The fake credential is built at run time. No network.
 */

const g = require('../lib/core/part8-egress-guard.cjs');

const PREFIXES = [
  'mcp__plugin_mos_mindrian-brain__',
  'mcp__pws-brain-mcp__',
  'mcp__theo__',
];

let failed = 0;
function ok(label, cond, detail) {
  if (cond) {
    console.log('ok - ' + label);
  } else {
    failed += 1;
    console.log('FAIL - ' + label + (detail ? ' (' + detail + ')' : ''));
  }
}
function v(payload, tool, prefix) {
  return g.classify(payload, { toolName: (prefix || PREFIXES[0]) + tool, roomDir: null });
}
function allowAll(label, payload, tool) {
  const bad = [];
  PREFIXES.forEach(function (p) {
    const r = v(payload, tool, p);
    if (r.verdict !== 'allow') bad.push(p + ':' + r.verdict + '/' + r.class);
  });
  ok(label, bad.length === 0, bad.join(' '));
}

const H1 = 'Six Thinking Hats';
const H2 = 'Ansoff Matrix';
ok('setup: canonical phrases loaded', g.CANONICAL_PHRASES.indexOf(H1.toLowerCase()) !== -1
  && g.CANONICAL_PHRASES.indexOf(H2.toLowerCase()) !== -1);

// Allow arms (RED today: each is ambiguous).
allowAll('TA1 normalize_framework_name {raw}', { raw: H1 }, 'normalize_framework_name');
allowAll('TA2 discover_structure {framework_name}', { framework_name: H1 }, 'discover_structure');
allowAll('TA3 orchestration_readiness {framework_name}', { framework_name: H1 }, 'orchestration_readiness');
allowAll('TA4 feeds_into_chains {seeds, max_hops}', { seeds: [H1, H2], max_hops: 2 }, 'feeds_into_chains');
allowAll('TA5 framework_concepts {framework}', { framework: H1 }, 'framework_concepts');
allowAll('TA6 search {query, topK}', { query: 'swot analysis', topK: 5 }, 'search');
allowAll('TA7 classify_problem_type {statement}', { statement: 'swot analysis' }, 'classify_problem_type');
allowAll('TA8 brain_ask {op, params}',
  { op: 'framework_chain_slice', params: { seeds: [H1, H2], max_hops: 2, limit: 10 } }, 'brain_ask');

// Pin that passes today.
allowAll('TA9 theo_health {}', {}, 'theo_health');

// TA10 parity: a typed free-text tool is decided exactly as brain_ask decides the same string.
const sprout = 'Ilvane Trosk disruption Acme Robotics March runway benchmarks';
const edge = 'my startup lost its first customers last quarter';
const body = 'Ilvane Trosk wrote the first draft of the plan. The second paragraph covers the market size. The third paragraph covers the pricing tiers.';
const parityBad = [];
[['sprout', sprout], ['edge', edge], ['body', body]].forEach(function (pair) {
  const a = v({ question: pair[1] }, 'brain_ask');
  const b = v({ query: pair[1], topK: 5 }, 'search');
  if (a.verdict !== b.verdict || a.class !== b.class) {
    parityBad.push(pair[0] + ': brain_ask=' + a.verdict + '/' + a.class + ' search=' + b.verdict + '/' + b.class);
  }
});
ok('TA10 search decides a sprout, an edge and a body as brain_ask does', parityBad.length === 0, parityBad.join('; '));

// Negative pins.
(function () {
  const r = v({ framework_name: 'Ilvane Trosk disruption plan for my startup' }, 'discover_structure');
  ok('TB1 a handle tool with a sentence and a name is not allow', r.verdict !== 'allow', r.verdict + '/' + r.class);
})();
(function () {
  const r = v({ raw: H1, note: 'extra' }, 'normalize_framework_name');
  ok('TB2 an extra key stays ambiguous', r.verdict === 'ambiguous', r.verdict + '/' + r.class);
})();
(function () {
  const r = v({ framework_name: 'someone' + '@' + 'example.test' }, 'discover_structure');
  ok('TB3 an email address is block content_set', r.verdict === 'block' && r.class === 'content_set', r.verdict + '/' + r.class);
})();
(function () {
  const r = v({ query: body, topK: 5 }, 'search');
  ok('TB4 search with a clear body is block room_content', r.verdict === 'block' && r.class === 'room_content', r.verdict + '/' + r.class);
})();
(function () {
  const r = v({ query: edge, topK: 5 }, 'search');
  ok('TB5 search with a first-person edge is block room_content', r.verdict === 'block' && r.class === 'room_content', r.verdict + '/' + r.class);
})();
(function () {
  const r = v({ from: 'Disruption', to: 'Innovation' }, 'find_connections');
  ok('TB6 find_connections arm unchanged', r.verdict === 'allow' && r.class === 'known_tool_shape', r.verdict + '/' + r.class);
})();
(function () {
  // Fake credential built at run time: prefix plus 40 upper-case letters.
  const fake = 's' + 'k' + '-' + 'QWERTYUIOPASDFGHJKLZXCVBNMQWERTYUIOPASD'.slice(0, 40);
  const a = v({ query: fake, topK: 5 }, 'search');
  const b = v({ statement: fake }, 'classify_problem_type');
  ok('TB7 a credential-shaped token on search and classify_problem_type is block',
    a.verdict === 'block' && b.verdict === 'block', 'search=' + a.verdict + ' classify=' + b.verdict);
})();

if (failed) {
  console.log('FAILED: ' + failed);
  process.exit(1);
}
console.log('ALL PASS');
