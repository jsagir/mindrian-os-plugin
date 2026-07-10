#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 214-02 -- online-pattern-query egress fence offline contract tests.
 *
 * Canon Part 8: the online leg is the SIGNAL channel. What crosses OUTBOUND is
 * ONLY abstracted SAPPhIRE/TRIZ pattern vocabulary, and EVERY composed query
 * string passes the SHIPPED auditQueryString fence (rs-egress-prompts.cjs)
 * BEFORE it can be returned. These guards run OFFLINE and deterministic: zero
 * network, zero live fetch. The fence is proven by inspecting the composed
 * strings and the audit call-count, NEVER by reaching a wire.
 *
 *   Test 1: a clean abstracted pattern returns ok:true with all three query
 *           families present and audited === queries.length.
 *   Test 2: call-count contract - an injected counting auditFn is called once
 *           per returned query, and every call is synchronous (already done the
 *           instant composePatternQueries returns; no deferred audit).
 *   Test 3: violation -> degrade - a poisoned keyword ('raises $3.5M') that the
 *           REAL default fence catches returns ok:false, degrade:'local-only',
 *           reason:'egress_violation' with NO queries field (proves the shipped
 *           fence is wired by default, not just the injected seam).
 *   Test 4: zero leak - JSON.stringify of the Test-3 degrade envelope never
 *           contains the poisoned substring.
 *   Test 5: empty pattern - all-empty fields return ok:false,
 *           reason:'empty_pattern' WITHOUT ever calling auditFn.
 *   Test 6: module purity - the source has zero network tokens and no private
 *           forbidden-pattern redefinition (reuse-only fence, 196 precedent).
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const mod = require('../lib/core/eureka/online-pattern-query.cjs');
const { QUERY_FAMILIES, composePatternQueries } = mod;

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

// A clean abstracted pattern - only domain-generic functional vocabulary.
const CLEAN = {
  functionalKeywords: ['rare-signal detection', 'background subtraction'],
  trizPrinciples: ['Separation'],
  abstractFunction: 'recover a rare signal from vast background noise',
};

// ---------- Test 1: clean pattern, all three families, audited count ----------
{
  const res = composePatternQueries(CLEAN);
  assert.strictEqual(res.ok, true, 'Test 1: clean pattern returns ok:true');
  assert.ok(Array.isArray(res.queries) && res.queries.length > 0, 'Test 1: queries array present');
  const families = new Set(res.queries.map(function (x) { return x.family; }));
  QUERY_FAMILIES.forEach(function (fam) {
    assert.ok(families.has(fam), 'Test 1: family present -> ' + fam);
  });
  assert.strictEqual(res.audited, res.queries.length, 'Test 1: audited === queries.length');
  // every query string is composed only from pattern vocab + fixed template words
  res.queries.forEach(function (x) {
    assert.strictEqual(typeof x.q, 'string', 'Test 1: query is a string');
    assert.ok(x.q.length > 0, 'Test 1: query non-empty');
  });
  ok('Test 1: clean pattern -> ok:true, all three families, audited === queries.length');
}

// ---------- Test 2: call-count contract, synchronous audit ----------
{
  let calls = 0;
  const seen = [];
  function countingAudit(s, surface) {
    calls += 1;
    seen.push({ s: s, surface: surface });
    return s; // pass-through, mirrors the real fence's return-on-pass
  }
  const res = composePatternQueries(CLEAN, { auditFn: countingAudit });
  // synchronous contract: the moment compose returns, every audit has run
  assert.strictEqual(res.ok, true, 'Test 2: ok:true with injected auditFn');
  assert.strictEqual(calls, res.queries.length, 'Test 2: one audit call per returned query');
  assert.strictEqual(res.audited, calls, 'Test 2: audited reflects the audit call-count');
  // every audit ran against the online surface tag, never a bare/unknown tag
  seen.forEach(function (c) {
    assert.strictEqual(c.surface, 'find-analogies-online', 'Test 2: audit surface tag is find-analogies-online');
  });
  ok('Test 2: injected auditFn called once per query, synchronously, before return');
}

// ---------- Test 3: violation -> degrade via the DEFAULT fence ----------
const POISON = 'raises $3.5M';
let degradeRes;
{
  const poisoned = {
    functionalKeywords: [POISON, 'background subtraction'],
    trizPrinciples: ['Separation'],
    abstractFunction: 'recover a rare signal from vast background noise',
  };
  // NO injected auditFn -> proves the real shipped fence is wired by default.
  degradeRes = composePatternQueries(poisoned);
  assert.strictEqual(degradeRes.ok, false, 'Test 3: poisoned pattern returns ok:false');
  assert.strictEqual(degradeRes.degrade, 'local-only', 'Test 3: degrade is local-only');
  assert.strictEqual(degradeRes.reason, 'egress_violation', 'Test 3: reason is egress_violation');
  assert.ok(!('queries' in degradeRes), 'Test 3: NO queries field on a violation envelope');
  assert.strictEqual(typeof degradeRes.family, 'string', 'Test 3: family named on the envelope');
  ok('Test 3: default fence catches the money figure -> local-only degrade, no queries');
}

// ---------- Test 4: zero leak - degrade envelope never echoes the poison ----------
{
  const serialized = JSON.stringify(degradeRes);
  assert.ok(serialized.indexOf('3.5M') === -1, 'Test 4: degrade envelope does not contain the poison substring');
  assert.ok(serialized.indexOf(POISON) === -1, 'Test 4: degrade envelope does not contain the full poison string');
  ok('Test 4: zero-leak - JSON.stringify of the degrade envelope carries no offending content');
}

// ---------- Test 5: empty pattern -> no audit, empty_pattern reason ----------
{
  let calls = 0;
  function neverAudit(s, surface) { calls += 1; return s; }
  const res = composePatternQueries(
    { functionalKeywords: [], trizPrinciples: [], abstractFunction: '' },
    { auditFn: neverAudit }
  );
  assert.strictEqual(res.ok, false, 'Test 5: empty pattern returns ok:false');
  assert.strictEqual(res.reason, 'empty_pattern', 'Test 5: reason is empty_pattern');
  assert.strictEqual(res.degrade, 'local-only', 'Test 5: empty pattern degrades local-only');
  assert.strictEqual(calls, 0, 'Test 5: auditFn NEVER called when nothing is composed');
  assert.ok(!('queries' in res), 'Test 5: NO queries field on empty_pattern');
  ok('Test 5: all-empty pattern -> empty_pattern, auditFn never called');
}

// ---------- Test 6: module purity greps (asserted from inside the test) ----------
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'core', 'eureka', 'online-pattern-query.cjs'), 'utf8');
  // strip single-line // comments so the purity grep matches only live code
  const live = src.split('\n').filter(function (ln) { return !/^\s*\/\//.test(ln); }).join('\n');
  assert.ok(!/require\(['"]https?/.test(live), 'Test 6: no require of http/https');
  assert.ok(!/require\(['"]net/.test(live), 'Test 6: no require of net');
  assert.ok(!/fetch\(/.test(live), 'Test 6: no fetch call');
  assert.ok(!/FORBIDDEN_PATTERNS\s*=/.test(live), 'Test 6: no private forbidden-pattern redefinition');
  assert.ok(!/new RegExp/.test(live), 'Test 6: no hand-rolled regex fence');
  assert.ok(/require\('\.\.\/rs-egress-prompts\.cjs'\)/.test(src), 'Test 6: reuses the shipped rs-egress-prompts fence');
  ok('Test 6: module is a reuse-only fence with zero network surface');
}

console.log('\n' + passed + ' passed');
