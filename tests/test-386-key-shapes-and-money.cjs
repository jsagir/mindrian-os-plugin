'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 386-31 (E-KEY): credential shapes always block; money, percent and
 * k-suffix words are ordinary keywords and are not blocked by this plan.
 * Debug session: part8-egress-guard-under-blocks-key-shape-and-spelled-money.
 *
 * Every fake secret is built at run time from fragments, so no secret-shaped
 * literal sits in this file. Synthetic strings only. No network.
 */

const g = require('../lib/core/part8-egress-guard.cjs');
const rs = require('../lib/core/rs-egress-prompts.cjs');

const ASK = 'mcp__plugin_mos_mindrian-brain__brain_ask';
const QUERY = 'mcp__plugin_mos_mindrian-brain__brain_query';

let failed = 0;
function ok(label, cond, detail) {
  if (cond) {
    console.log('ok - ' + label);
  } else {
    failed += 1;
    console.log('FAIL - ' + label + (detail ? ' (' + detail + ')' : ''));
  }
}

function fill(n, alphabet) {
  let s = '';
  for (let i = 0; i < n; i += 1) s += alphabet[(i * 7 + 3) % alphabet.length];
  return s;
}
const LOW = 'abcdefghijklmnopqrstuvwxyz0123456789';
const UP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MIX = 'aB3dE5gH7jK9mN1pQ3sT5vW7yZ';
function j() { return Array.prototype.join.call(arguments, ''); }

function buildShapes() {
  return {
    sk_lower: j('s', 'k-', fill(40, LOW)),
    sk_upper: j('S', 'K-', fill(40, UP)),
    sk_proj: j('s', 'k-proj-', fill(40, MIX)),
    ghp: j('gh', 'p_', fill(36, MIX)),
    github_pat: j('github', '_pat_', fill(40, MIX)),
    xoxb: j('xo', 'xb-', fill(12, '0123456789'), '-', fill(24, MIX)),
    akia: j('AK', 'IA', fill(16, UP)),
    aiza: j('AI', 'za', fill(35, MIX)),
    pk_live: j('p', 'k_live_', fill(24, MIX)),
    rk_live: j('r', 'k_live_', fill(24, MIX)),
    npm: j('np', 'm_', fill(36, MIX)),
    glpat: j('gl', 'pat-', fill(20, MIX)),
    jwt: j('ey', 'Jhbgc', fill(10, MIX), '.', 'eyJ', fill(20, MIX), '.', fill(30, MIX)),
    bearer: j('Bea', 'rer ', fill(30, MIX)),
    api_key: j('api', '_key=', fill(20, MIX)),
  };
}

const shapes = buildShapes();
const names = Object.keys(shapes);

// K1: each shape on brain_ask is block, class content_set, no room bound.
(function () {
  const bad = [];
  names.forEach(function (n) {
    const r = g.classify({ question: 'explain ' + shapes[n] + ' in swot analysis' }, { toolName: ASK, roomDir: null });
    if (r.verdict !== 'block' || r.class !== 'content_set') bad.push(n + ':' + r.verdict + '/' + r.class);
  });
  ok('K1 each credential shape on brain_ask is block content_set', bad.length === 0, bad.length + ' of ' + names.length + ' wrong: ' + bad.join(' '));
})();

// K2: the same shapes in a brain_query cypher.
(function () {
  const bad = [];
  names.forEach(function (n) {
    const r = g.classify({ cypher: 'MATCH (n) WHERE n.k = "' + shapes[n] + '" RETURN n // framework' }, { toolName: QUERY, roomDir: null });
    if (r.verdict !== 'block' || r.class !== 'content_set') bad.push(n + ':' + r.verdict + '/' + r.class);
  });
  ok('K2 each credential shape in a brain_query cypher is block content_set', bad.length === 0, bad.length + ' of ' + names.length + ' wrong: ' + bad.join(' '));
})();

// K6: auditWebCredential refuses each shape.
(function () {
  const bad = [];
  names.forEach(function (n) {
    let refused = false;
    try { rs.auditWebCredential('query ' + shapes[n], 'test-386-31'); } catch (_e) { refused = true; }
    if (!refused) bad.push(n);
  });
  ok('K6 auditWebCredential refuses each credential shape', bad.length === 0, bad.length + ' of ' + names.length + ' passed: ' + bad.join(' '));
})();

// K7: pins that pass today.
(function () {
  const a = g.classify({ question: 'swot analysis' }, { toolName: ASK, roomDir: null });
  ok('K7a swot analysis is allow', a.verdict === 'allow', a.verdict + '/' + a.class);
  const b = g.classify({ question: 'explain ' + shapes.akia + ' in swot analysis' }, { toolName: ASK, roomDir: null });
  ok('K7b the upper-case key id is block', b.verdict === 'block', b.verdict + '/' + b.class);
  const c = g.classify({ question: 'benchmarks for $750K saas' }, { toolName: ASK, roomDir: null });
  ok('K7c a currency magnitude is block', c.verdict === 'block', c.verdict + '/' + c.class);
})();

// K9: pin that passes today (owner principle): a short keyword query that holds
// a money, k-suffix or percent word is allowed. This plan adds no pattern for them.
(function () {
  const queries = [
    'saas benchmarks 40% churn',
    'two million dollars funding benchmarks',
    '750k revenue benchmarks',
    'pricing benchmarks 750000 dollars',
  ];
  const bad = [];
  queries.forEach(function (q) {
    const r = g.classify({ question: q }, { toolName: ASK, roomDir: null });
    if (r.verdict !== 'allow') bad.push(JSON.stringify(q) + ':' + r.verdict + '/' + r.class);
  });
  ok('K9 short keyword queries with money words stay allow', bad.length === 0, bad.join(' '));
})();

// K8: pin that passes today (no content scan on the web lines).
(function () {
  const strings = [
    'research by Maren Holtveit on disruption',
    'startup ecosystem in Lisbon and Porto',
    'Acme Robotics competitor analysis',
    'two million dollars seed benchmarks',
    '750k revenue benchmarks',
    'churn of 40% in subscription products',
    'the bearer of bad news in organisations',
    'the key to a good pricing model is a plain word key in a sentence',
  ];
  const bad = [];
  strings.forEach(function (s) {
    try { rs.auditWebCredential(s, 'test-386-31'); } catch (_e) { bad.push(JSON.stringify(s)); }
  });
  ok('K8 the web credential check accepts ordinary strings', bad.length === 0, bad.join(' '));
})();

if (failed) {
  console.log('FAILED: ' + failed);
  process.exit(1);
}
console.log('ALL PASS');
