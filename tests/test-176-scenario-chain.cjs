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

// ---------------------------------------------------------------------------
// (c) quick 261001-tta, navigator ruling: domain extraction (/mos:explore-domains,
// framework "Domain Selection") is the PRE-STEP to /mos:trending-to-absurd and to
// scenario analysis (/mos:scenario-plan and /mos:explore-futures, both framework
// "Scenario Planning"). Encoded ONLY through the governed mechanism
// (data/command-registry.json curated_chains: a `prerequisite` edge for the
// ordering, a `feeds_into` edge for the F.1 next-step), read back through the
// resolver and the recommender. No hand-merged second resolver (Canon Part 11).
// ---------------------------------------------------------------------------
const resolver = require(path.join(ROOT, 'lib/workflow/command-resolver.cjs'));
const TTA = 'Trending to the Absurd';
function hasKind(kind, from, to) {
  return cc.some(e => e && e.kind === kind && e.from === from && e.to === to && typeof e.confidence === 'number');
}
ok(hasKind('prerequisite', 'Domain Selection', TTA), 'curated: Domain Selection is a PREREQUISITE of Trending to the Absurd');
ok(hasKind('prerequisite', 'Domain Selection', 'Scenario Planning'), 'curated: Domain Selection is a PREREQUISITE of Scenario Planning');
ok(hasKind('feeds_into', 'Domain Selection', TTA), 'curated: Domain Selection FEEDS_INTO Trending to the Absurd (the F.1 next-step after explore-domains)');
ok(!cc.some(e => e && e.kind === 'prerequisite' && e.from === TTA && e.to === 'Domain Selection'), 'ordering is one way: Trending to the Absurd is not a prerequisite of Domain Selection');

const allCands = R.recommendChainCandidates({});
ok(allCands.some(c => c.kind === 'prerequisite' && c.from === 'Domain Selection' && c.to === TTA), 'recommender: prerequisite Domain Selection -> Trending to the Absurd is a candidate');
ok(allCands.some(c => c.kind === 'prerequisite' && c.from === 'Domain Selection' && c.to === 'Scenario Planning'), 'recommender: prerequisite Domain Selection -> Scenario Planning is a candidate');
ok(allCands.some(c => c.kind === 'feeds_into' && c.from === 'Domain Selection' && c.to === TTA), 'recommender: feeds_into Domain Selection -> Trending to the Absurd is a candidate');

const hops = R.recommendMultiHopChains({ from: 'Domain Selection', maxHops: 1 });
ok(hops.some(h => h.path.join('>') === 'Domain Selection>' + TTA), 'multi-hop from Domain Selection reaches Trending to the Absurd in one hop');

// The composed workflow: explore-domains is step 1, the dependent command step 2.
const wfTta = resolver.composeWorkflow(['Domain Selection', TTA]);
ok(wfTta[0].command === '/mos:explore-domains' && wfTta[1].command === '/mos:trending-to-absurd', 'composeWorkflow: /mos:explore-domains then /mos:trending-to-absurd');
const wfSp = resolver.composeWorkflow(['Domain Selection', 'Scenario Planning']);
ok(wfSp[0].command === '/mos:explore-domains' && ['/mos:scenario-plan', '/mos:explore-futures'].indexOf(wfSp[1].command) >= 0, 'composeWorkflow: /mos:explore-domains then a scenario analysis command');
const scenarioCmds = resolver.commandsForFramework('Scenario Planning');
ok(scenarioCmds.indexOf('/mos:scenario-plan') >= 0 && scenarioCmds.indexOf('/mos:explore-futures') >= 0, 'both /mos:scenario-plan and /mos:explore-futures sit under Scenario Planning, so the one framework-level edge pre-steps both');
ok(resolver.commandsForFramework(TTA).indexOf('/mos:trending-to-absurd') === 0, 'Trending to the Absurd resolves to /mos:trending-to-absurd first');

if (failed) {
  console.log('\nPhase 176 chain test: ' + failed + ' FAILED');
  process.exit(1);
}
console.log('\nPhase 176 chain test: all assertions passed');
