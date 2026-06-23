#!/usr/bin/env node
'use strict';
// Phase 176 verification: the Scenario Analysis canon chain is wired.
// Asserts (a) the 3 curated_chains edges exist (bare framework names, so they
// join in the recommender), and (b) recommendChainCandidates surfaces the
// inbound F.1 next-step (Domain Selection -> Scenario Planning) and the outbound
// cascade (Scenario Planning -> Futures Wheel). Plain node asserts; no deps.

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const reg = require(path.join(ROOT, 'data/command-registry.json'));
const R = require(path.join(ROOT, 'lib/workflow/local-chain-recommender.cjs'));

let failed = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok   - ' : '  FAIL - ') + msg);
  if (!cond) failed++;
}

const cc = Array.isArray(reg.curated_chains) ? reg.curated_chains : [];
function hasEdge(from, to, transform) {
  return cc.some(e => e && e.from === from && e.to === to && e.transform === transform && e.kind === 'feeds_into');
}

// (a) curated_chains edges present, bare framework names
ok(hasEdge('Domain Selection', 'Scenario Planning', 'domain-to-scenario'), 'curated: Domain Selection -> Scenario Planning (domain-to-scenario)');
ok(hasEdge('PEST Analysis', 'Scenario Planning', 'steep-to-scenario'), 'curated: PEST Analysis -> Scenario Planning (steep-to-scenario)');
ok(hasEdge('Scenario Planning', 'Futures Wheel', 'scenario-to-cascades'), 'curated: Scenario Planning -> Futures Wheel (scenario-to-cascades)');

// no dead command-target scenario edges left behind
const deadCmd = cc.some(e => e && e.from === 'Scenario Planning' && typeof e.to === 'string' && e.to.indexOf('command:') === 0);
ok(!deadCmd, 'no dead command:/mos: scenario outbound edge (those do not join the recommender)');

// (b) recommender surfaces the candidates (earned confidence join)
const all = R.recommendChainCandidates({});
const inbound = all.find(c => c.from === 'Domain Selection' && c.to === 'Scenario Planning');
ok(!!inbound, 'recommender: Domain Selection -> Scenario Planning is a candidate (F.1 next-step after explore-domains)');
ok(inbound && inbound.confidence === 0.68, 'recommender: inbound carries earned confidence 0.68');
const outbound = all.find(c => c.from === 'Scenario Planning' && c.to === 'Futures Wheel');
ok(!!outbound, 'recommender: Scenario Planning -> Futures Wheel is a candidate (cascade successor)');

if (failed) {
  console.log('\nPhase 176 chain test: ' + failed + ' FAILED');
  process.exit(1);
}
console.log('\nPhase 176 chain test: all assertions passed');
