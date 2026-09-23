#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 361-03 -- dominant-design lane-query composer offline contract tests.
 *
 * Canon Part 8: composeLaneQueries is the ONLY source of outbound web strings
 * for the /mos:dominant-designs research path (D-03/D-04/D-05). Every composed
 * or navigator-edited string passes the SHIPPED auditQueryString fence
 * (lib/core/rs-egress-prompts.cjs) BEFORE it can be returned; a violation
 * degrades to an honest local-only envelope naming only the lane, never the
 * offending string. These legs run OFFLINE and deterministic: zero network.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// --- Test hygiene: no network egress from this test file --------------------
globalThis.fetch = function _blockedFetch() {
  process.stderr.write('NETWORK_ATTEMPT_361_LANE_QUERIES\n');
  throw new Error('NETWORK_ATTEMPT_361_LANE_QUERIES: fetch is blocked');
};

const MOD_PATH = path.join(__dirname, '..', 'lib', 'core', 'dominant-design', 'lane-queries.cjs');
const mod = require(MOD_PATH);
const {
  LANES,
  LANE_IDS,
  TAVILY_PARAMS,
  MAX_QUERIES_PER_LANE,
  composeLaneQueries,
  auditEditedQuery,
  domainSlug,
} = mod;

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

const EXPECTED_ORDER = ['variant_census', 'convergence_signals', 's_curve_limits', 'discontinuity_signals'];

// ---------- Test 1: composeLaneQueries happy path ----------
{
  const res = composeLaneQueries({ domain: 'lithium-ion battery cells' });
  assert.strictEqual(res.ok, true, 'Test 1: ok true');
  assert.strictEqual(res.lanes.length, 4, 'Test 1: exactly 4 lanes');
  assert.deepStrictEqual(res.lanes.map(function (l) { return l.id; }), EXPECTED_ORDER, 'Test 1: fixed D-05 order');
  res.lanes.forEach(function (lane) {
    assert.strictEqual(typeof lane.label, 'string', 'Test 1: lane has label -> ' + lane.id);
    assert.strictEqual(typeof lane.question, 'string', 'Test 1: lane has question -> ' + lane.id);
    assert.ok(Array.isArray(lane.queries) && lane.queries.length === 1, 'Test 1: lane.queries length 1 -> ' + lane.id);
    assert.strictEqual(lane.queries[0].indexOf('\n'), -1, 'Test 1: query has no newline -> ' + lane.id);
  });
  assert.strictEqual(res.audited, 4, 'Test 1: audited === 4');
  assert.strictEqual(res.domain_slug, 'lithium-ion-battery-cells', 'Test 1: domain_slug computed correctly');
  ok('Test 1: composeLaneQueries happy path -> 4 lanes in fixed order, audited 4');
}

// ---------- Test 2: query text is domain + fixed template, single spaces ----------
{
  const res = composeLaneQueries({ domain: 'solid-state batteries' });
  const vc = res.lanes.find(function (l) { return l.id === 'variant_census'; });
  assert.strictEqual(vc.queries[0], 'solid-state batteries competing designs history first introduced', 'Test 2: variant_census query text');
  assert.ok(!/  /.test(vc.queries[0]), 'Test 2: no double spaces');
  ok('Test 2: query text is domain followed by the fixed template words, single spaces');
}

// ---------- Test 3: empty / missing domain -> empty_domain ----------
{
  const res1 = composeLaneQueries({ domain: '   ' });
  assert.strictEqual(res1.ok, false, 'Test 3: whitespace-only domain ok false');
  assert.strictEqual(res1.degrade, 'local-only', 'Test 3: degrade local-only');
  assert.strictEqual(res1.reason, 'empty_domain', 'Test 3: reason empty_domain');
  assert.ok(!('lane' in res1), 'Test 3: no lane field on empty_domain');

  const res2 = composeLaneQueries({});
  assert.strictEqual(res2.reason, 'empty_domain', 'Test 3: missing domain -> empty_domain');

  const res3 = composeLaneQueries(undefined);
  assert.strictEqual(res3.reason, 'empty_domain', 'Test 3: undefined input -> empty_domain');
  ok('Test 3: empty or missing domain -> local-only degrade, reason empty_domain');
}

// ---------- Test 4: forbidden-pattern domains -> egress_violation, no echo ----------
{
  ['Acme Robotics arms', 'jane@example.com battery', 'lithium $2M battery'].forEach(function (poison) {
    const res = composeLaneQueries({ domain: poison });
    assert.strictEqual(res.ok, false, 'Test 4: poisoned domain ok false -> ' + poison);
    assert.strictEqual(res.degrade, 'local-only', 'Test 4: degrade local-only -> ' + poison);
    assert.strictEqual(res.reason, 'egress_violation', 'Test 4: reason egress_violation -> ' + poison);
    assert.strictEqual(res.lane, 'variant_census', 'Test 4: lane is first lane (variant_census) -> ' + poison);
    const serialized = JSON.stringify(res);
    // check a distinctive fragment of each poison string, not just the whole string
    assert.ok(serialized.indexOf('Acme') === -1, 'Test 4: no Acme echo -> ' + poison);
    assert.ok(serialized.indexOf('example.com') === -1, 'Test 4: no email echo -> ' + poison);
    assert.ok(serialized.indexOf('$2M') === -1, 'Test 4: no money echo -> ' + poison);
  });
  ok('Test 4: a venture proper noun, email or money figure -> egress_violation, zero echo');
}

// ---------- Test 5: CR/LF or over-length domain -> bad_domain ----------
{
  const res1 = composeLaneQueries({ domain: 'battery\ndomain' });
  assert.strictEqual(res1.ok, false, 'Test 5: CR/LF domain ok false');
  assert.strictEqual(res1.reason, 'bad_domain', 'Test 5: LF -> bad_domain');
  assert.ok(!('lane' in res1), 'Test 5: no lane field on bad_domain (LF)');

  const res2 = composeLaneQueries({ domain: 'battery\rdomain' });
  assert.strictEqual(res2.reason, 'bad_domain', 'Test 5: CR -> bad_domain');

  const longDomain = 'x'.repeat(85);
  const res3 = composeLaneQueries({ domain: longDomain });
  assert.strictEqual(res3.reason, 'bad_domain', 'Test 5: over 80 chars after collapse -> bad_domain');
  ok('Test 5: CR/LF (raw, pre-collapse) or over-80-char domain -> bad_domain');
}

// ---------- Test 6: injected auditFn call-count contract (third call throws) ----------
{
  let calls = 0;
  function throwOnThird(s, surface) {
    calls += 1;
    assert.strictEqual(surface, 'dominant-design', 'Test 6: audit surface tag is dominant-design');
    if (calls === 3) {
      throw new Error('injected failure');
    }
    return s;
  }
  const res = composeLaneQueries({ domain: 'battery domain' }, { auditFn: throwOnThird });
  assert.strictEqual(res.ok, false, 'Test 6: ok false on third-call throw');
  assert.strictEqual(res.reason, 'egress_violation', 'Test 6: reason egress_violation');
  assert.strictEqual(res.lane, 's_curve_limits', 'Test 6: lane is the third lane (s_curve_limits)');
  assert.strictEqual(calls, 3, 'Test 6: auditFn called exactly 3 times before the throw stopped composition');
  ok('Test 6: injected auditFn throwing on the third call -> egress_violation, lane s_curve_limits');
}

// ---------- Test 7: auditEditedQuery legs ----------
{
  const good = auditEditedQuery('solid-state battery standards IEC');
  assert.strictEqual(good.ok, true, 'Test 7: clean edited query -> ok true');
  assert.strictEqual(typeof good.q, 'string', 'Test 7: q is a string');

  const empty = auditEditedQuery('');
  assert.strictEqual(empty.ok, false, 'Test 7: empty query ok false');
  assert.strictEqual(empty.reason, 'empty_query', 'Test 7: empty -> empty_query');

  const newline = auditEditedQuery('battery\nstandards');
  assert.strictEqual(newline.reason, 'bad_query', 'Test 7: CR/LF -> bad_query');

  const tooLong = auditEditedQuery('x'.repeat(201));
  assert.strictEqual(tooLong.reason, 'too_long', 'Test 7: over 200 chars -> too_long');

  const poisoned = auditEditedQuery('Acme Robotics battery');
  assert.strictEqual(poisoned.ok, false, 'Test 7: poisoned edit ok false');
  assert.strictEqual(poisoned.reason, 'egress_violation', 'Test 7: poisoned edit -> egress_violation');
  assert.ok(!('q' in poisoned), 'Test 7: no q echo on egress_violation');
  const serialized = JSON.stringify(poisoned);
  assert.ok(serialized.indexOf('Acme') === -1, 'Test 7: zero-leak on poisoned edit');
  ok('Test 7: auditEditedQuery legs -> ok, empty_query, bad_query, too_long, egress_violation (no echo)');
}

// ---------- Test 8: constants frozen and shaped ----------
{
  assert.deepStrictEqual(TAVILY_PARAMS, { search_depth: 'basic', topic: 'general', max_results: 10 }, 'Test 8: TAVILY_PARAMS shape');
  assert.ok(Object.isFrozen(TAVILY_PARAMS), 'Test 8: TAVILY_PARAMS frozen');
  assert.strictEqual(MAX_QUERIES_PER_LANE, 2, 'Test 8: MAX_QUERIES_PER_LANE === 2');
  assert.ok(Object.isFrozen(LANES), 'Test 8: LANES frozen');
  LANES.forEach(function (lane) {
    assert.ok(Object.isFrozen(lane), 'Test 8: lane object frozen -> ' + lane.id);
  });
  assert.deepStrictEqual(LANE_IDS.slice(), EXPECTED_ORDER, 'Test 8: LANE_IDS matches fixed order');
  assert.ok(Object.isFrozen(LANE_IDS), 'Test 8: LANE_IDS frozen');
  ok('Test 8: TAVILY_PARAMS, MAX_QUERIES_PER_LANE, LANES, LANE_IDS are frozen and correctly shaped');
}

// ---------- Test 9: domainSlug ----------
{
  assert.strictEqual(domainSlug('lithium-ion battery cells'), 'lithium-ion-battery-cells', 'Test 9: domainSlug basic');
  assert.strictEqual(domainSlug('  Solid State!! Batteries  '), 'solid-state-batteries', 'Test 9: domainSlug strips punctuation/case/edges');
  const long = domainSlug('a'.repeat(90));
  assert.ok(long.length <= 60, 'Test 9: domainSlug capped at 60 chars');
  ok('Test 9: domainSlug normalizes, hyphenates, trims and caps at 60 chars');
}

// ---------- Test 10: module purity greps ----------
{
  const src = fs.readFileSync(MOD_PATH, 'utf8');
  const live = src.split('\n').filter(function (ln) { return !/^\s*\*/.test(ln.trim()) && !/^\s*\/\//.test(ln); }).join('\n');
  assert.ok(!/require\(['"](node:)?fs['"]\)/.test(live), 'Test 10: no require of fs');
  assert.ok(!/require\(['"](node:)?https?['"]\)/.test(live), 'Test 10: no require of http/https');
  assert.ok(!/require\(['"](node:)?net['"]\)/.test(live), 'Test 10: no require of net');
  assert.ok(!/fetch\(/.test(live), 'Test 10: no fetch call');
  assert.ok(!/\u2014/.test(src), 'Test 10: no em-dash in source');
  ok('Test 10: module source has zero fs/network require and no em-dash');
}

console.log('\n' + passed + ' passed');
