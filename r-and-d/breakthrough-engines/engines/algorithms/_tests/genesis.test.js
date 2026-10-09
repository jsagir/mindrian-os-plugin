// Tests for algorithms/genesis (new versions vs originals). No network.
// Run: node --test genesis.test.js   (from this folder)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const NEW = path.join(__dirname, '..', 'genesis');
const ORIG = path.join(__dirname, '..', '..', '_baseline', 'orig', 'algorithms', 'genesis');
const load = (root, rel) => require(path.join(root, rel));

const D = load(NEW, 'agents-mindrian/GenesisContextDecomposer.js');
const DI = load(NEW, 'agents-mindrian/GenesisDomainIdentifier.js');
const PG = load(NEW, 'agents-mindrian/GenesisPersonaGenerator.js');
const RO = load(NEW, 'agents-mindrian/GenesisResearchOrchestrator.js');
const HP = load(NEW, 'agents-mindrian/GenesisHandoffProtocol.js');
const V3 = load(NEW, 'ip-finance-files/GenesisDomainIdentifier_v3_IPFinance.js');
const EP = load(NEW, 'ip-finance-files/GenesisExpertPanel_IPFinance.js');

const D0 = load(ORIG, 'agents-mindrian/GenesisContextDecomposer.js');
const DI0 = load(ORIG, 'agents-mindrian/GenesisDomainIdentifier.js');
const PG0 = load(ORIG, 'agents-mindrian/GenesisPersonaGenerator.js');
const RO0 = load(ORIG, 'agents-mindrian/GenesisResearchOrchestrator.js');
const HP0 = load(ORIG, 'agents-mindrian/GenesisHandoffProtocol.js');   // {} : the file has no export
const HP0src = new Function(require('node:fs').readFileSync(path.join(ORIG, 'agents-mindrian/GenesisHandoffProtocol.js'), 'utf8') + '; return HandoffProtocol;')();
const V30 = load(ORIG, 'ip-finance-files/GenesisDomainIdentifier_v3_IPFinance.js');

[D, DI, PG, RO, HP, V3, EP].forEach(m => { m.silent = true; });
// originals log with console.log; silence it only inside these tests
const quietly = async (fn) => { const l = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = l; } };

const CTX = 'Our startup builds a machine learning platform for patent analytics. ' +
  'The neural network model is trained on a dataset of patent claims. The main challenge is the lack of labelled data and a bottleneck in annotation.\n\n' +
  'We plan an approach based on transfer learning and a design process with analysis of citations. Quantum computing is not in scope. ' +
  'Blockchain based licensing is an opportunity, with potential benefit for IP owners and a clear advantage for banks that finance intangible assets.';

// ---------------------------------------------------------------- baseline facts about the originals
test('original HandoffProtocol exports nothing (bug), new one exports the object', () => {
  assert.deepStrictEqual(HP0, {});
  assert.strictEqual(typeof HP.generateHandoff, 'function');
});

// ---------------------------------------------------------------- ContextDecomposer
test('decomposer: single long sentence no longer yields an empty segment', async () => {
  const longSentence = 'word '.repeat(80).trim() + '.';
  const old = await quietly(() => D0.analyzeContext(longSentence));
  const cur = await D.analyzeContext(longSentence);
  assert.ok(old.segments.some(s => s.text === ''), 'original produced an empty segment');
  assert.ok(cur.segments.every(s => s.text.length > 0));
  assert.ok(cur.segments.every(s => s.wordCount > 0));
});

test('decomposer: decimals and CRLF paragraphs', async () => {
  const text = 'Accuracy rose to 3.5 percent in the first trial of the platform.\r\n\r\nA second paragraph about the new model design is long enough to keep as an atomic segment.';
  const r = await D.analyzeContext(text);
  assert.strictEqual(r.segments.length, 2);           // CRLF blank line splits paragraphs
  const r0 = await quietly(() => D0.analyzeContext(text));
  assert.strictEqual(r0.segments.length, 1);          // original did not
});

test('decomposer: short fragments are reported, not silently lost; types validated', async () => {
  const r = await D.analyzeContext(CTX + '\n\nSummary\n\n');
  assert.ok(r.diagnostics.droppedShort >= 1);
  assert.ok(r.diagnostics.droppedShortExamples.includes('Summary'));
  await assert.rejects(() => D.analyzeContext(42), TypeError);
  await assert.rejects(() => D.analyzeContext('too short'), /too short/);
});

test('decomposer: sentence-start words are not concepts; acronyms are', async () => {
  const r = await D.analyzeContext('The platform uses GPT-4 and OpenAI services. However, Columbus State University runs the pilot program for students.');
  assert.ok(!r.elements.concepts.some(c => /^(The|However)$/.test(c)));
  assert.ok(r.elements.concepts.includes('GPT-4'));
  assert.ok(r.elements.concepts.includes('Columbus State University'));
});

test('decomposer: output keys preserved', async () => {
  const r = await D.analyzeContext(CTX);
  for (const k of ['originalContext', 'segments', 'elements', 'complexity', 'timestamp']) assert.ok(k in r, k);
  for (const k of ['concepts', 'technologies', 'methodologies', 'challenges', 'opportunities']) assert.ok(Array.isArray(r.elements[k]), k);
  for (const k of ['level', 'techComplexity', 'methodComplexity', 'challengeComplexity', 'conceptComplexity', 'totalComplexity', 'depthRequired']) assert.ok(k in r.complexity, k);
});

// ---------------------------------------------------------------- DomainIdentifier v2
test('domain identifier v2: AR-VR no longer fires on the plain word "ar"; VR acronym still does', () => {
  assert.notStrictEqual(DI0.analyzeDomainIndicators('ar ar ar ar').domain, 'General-Systems');   // original false positive
  assert.strictEqual(DI.analyzeDomainIndicators('ar ar ar ar').domain, 'General-Systems');
  assert.strictEqual(DI.analyzeDomainIndicators('We tested the VR headset and AR glasses').domain, 'AR-VR');
});

test('domain identifier v2: default result carries indicators[]; dedupe keeps both subdomain lists', () => {
  assert.deepStrictEqual(DI.analyzeDomainIndicators('nothing relevant here at all').indicators, []);
  const a = { domain: 'X', confidence: 0.5, subdomains: [{ name: 'S1', confidence: 0.5, indicators: 1, indicatorTerms: ['a'] }] };
  const b = { domain: 'X', confidence: 0.9, subdomains: [{ name: 'S2', confidence: 0.4, indicators: 1, indicatorTerms: ['b'] }] };
  const names = (arr) => arr.map(s => s.name).sort();
  const a0 = JSON.parse(JSON.stringify(a)), b0 = JSON.parse(JSON.stringify(b));   // clone first: merge mutates its inputs
  assert.deepStrictEqual(names(DI.deduplicateDomains([a, b])[0].subdomains), ['S1', 'S2']);
  assert.deepStrictEqual(names(DI0.deduplicateDomains([a0, b0])[0].subdomains), ['S2']);          // original lost S1
});

test('domain identifier v2: rejects bad input', async () => {
  await assert.rejects(() => DI.identifyDomains({}), TypeError);
});

// ---------------------------------------------------------------- DomainIdentifier v3
test('v3: ordinary words no longer trigger finance acronyms; real acronyms still do', () => {
  const txt = 'The car pe sep alpha beta priority provision leverage vc pd were mentioned in lower case only.';
  assert.notStrictEqual(V30.analyzeDomainIndicators(txt).domain, 'General-Systems');       // original false positive
  assert.strictEqual(V3.analyzeDomainIndicators(txt).domain, 'General-Systems');
  const real = V3.analyzeDomainIndicators('The PD and LGD and EAD estimates feed the credit risk model and credit score');
  assert.strictEqual(real.domain, 'Credit-Risk-Analysis');
  assert.ok(real.indicators.includes('pd'));
});

const ipfin = 'IP-backed finance: ip financing, ip lending, ip collateral, ip-secured loans, patent-backed loans and ip securitization. ' +
              'Credit risk teams review default probability, probability of default and credit scoring. ' +
              'Industrial policy and national competitiveness frame the programme.';
test('v3: cross-domain synthesis uses secondary domains from a single mixed segment', async () => {
  const dec = { segments: [{ text: ipfin }], elements: { methodologies: [] } };
  V3.options.useSecondaryDomains = false;
  const off = await V3.identifyDomains(dec);
  V3.options.useSecondaryDomains = true;
  const on = await V3.identifyDomains(dec);
  const hasX = (d) => [...d.primary, ...d.strategic].some(x => x.domain === 'Cross-Domain-Integration');
  assert.strictEqual(on.primary[0].domain === 'IP-Backed-Finance' || on.primary.some(x => x.domain === 'IP-Backed-Finance'), true);
  assert.strictEqual(hasX(off), false, 'primary domain alone gives one bridge, not two');
  assert.strictEqual(hasX(on), true, 'secondary domains add the finance/policy bridges');
  const base = await quietly(() => V30.identifyDomains(dec));
  assert.strictEqual(hasX(base), false);                                   // original never read secondaryDomains
});

test('v3: dedupe merge keeps subdomains of the replaced entry', () => {
  const a = { domain: 'X', confidence: 0.5, subdomains: [{ name: 'S1', confidence: 0.5, indicators: 1, indicatorTerms: ['a'] }] };
  const b = { domain: 'X', confidence: 0.9, subdomains: [] };
  assert.strictEqual(V3.deduplicateDomains([a, b])[0].subdomains.length, 1);
});

// ---------------------------------------------------------------- PersonaGenerator
const mkDomains = () => ({
  primary: [{ domain: 'Machine-Learning', confidence: 0.9, indicators: ['neural'] }, { domain: 'Blockchain', confidence: 0.8, indicators: ['smart contract'] }],
  technical: [{ domain: 'Cybersecurity', confidence: 0.5, technical: true, subdomains: [] }],
  methodological: [{ domain: 'Research-Methodology', indicators: ['approach', 'method', 'design'], confidence: 0.6 }],
  adjacent: []
});
const cx = { depthRequired: 'EXPERT' };

test('persona: integration queries keep hyphenated domain names intact for 3+ domains', async () => {
  PG.options.year = 2026;
  const d = mkDomains(); d.primary.push({ domain: 'Natural-Language-Processing', confidence: 0.8, indicators: [] });
  const ps = await PG.generatePersonas(d, cx);
  const integ = ps.find(p => p.domainCategory === 'INTEGRATION');
  assert.ok(integ.queryStrategies.every(q => !/"Machine"|"Learning"/.test(q)), integ.queryStrategies.join(' | '));
  assert.ok(integ.queryStrategies[0].includes('"Machine-Learning" AND "Blockchain" AND "Natural-Language-Processing"'));
  const ps0 = await quietly(() => PG0.generatePersonas(d, cx));
  assert.ok(ps0.find(p => p.domainCategory === 'INTEGRATION').queryStrategies.some(q => /"Machine"/.test(q)));   // original bug
});

test('persona: no stale 2024 in methodology queries, year override works', async () => {
  PG.options.year = 2031;
  const ps = await PG.generatePersonas(mkDomains(), cx);
  const m = ps.find(p => p.domainCategory === 'METHODOLOGY');
  assert.ok(m.queryStrategies.join(' ').includes('2031'));
  assert.ok(!m.queryStrategies.join(' ').includes('2024'));
  PG.options.year = null;
});

test('persona: invalid depth throws instead of producing "undefined" names', async () => {
  assert.throws(() => PG.createPersona({ domain: 'X' }, 'PRIMARY', 'GURU'), RangeError);
  const bad = PG0.createPersona({ domain: 'X' }, 'PRIMARY', 'GURU');
  assert.ok(bad.name.endsWith('undefined'));
  await assert.rejects(() => PG.generatePersonas(mkDomains(), { depthRequired: 'GURU' }), RangeError);
});

test('persona: technical domain without qualifying subdomain is reported; option includes it', async () => {
  PG.options.includeTechnicalDomains = false;
  const ps = await PG.generatePersonas(mkDomains(), cx);
  assert.deepStrictEqual(ps.diagnostics.droppedTechnical, ['Cybersecurity']);
  assert.ok(!ps.some(p => p.name.startsWith('Cybersecurity')));
  PG.options.includeTechnicalDomains = true;
  const ps2 = await PG.generatePersonas(mkDomains(), cx);
  assert.ok(ps2.some(p => p.name.startsWith('Cybersecurity')));
  PG.options.includeTechnicalDomains = false;
});

test('persona: default output keeps original persona names', async () => {
  const a = (await PG.generatePersonas(mkDomains(), cx)).map(p => p.name);
  const b = (await quietly(() => PG0.generatePersonas(mkDomains(), cx))).map(p => p.name);
  assert.deepStrictEqual(a, b);
});

// ---------------------------------------------------------------- ResearchOrchestrator
test('orchestrator: methodology expert gets the QUALITY_VALIDATOR role (original made it the synthesizer)', async () => {
  const ps = await PG.generatePersonas(mkDomains(), cx);
  const plan = await RO.orchestrateResearch(ps, CTX);
  const plan0 = await quietly(() => RO0.orchestrateResearch(ps, CTX));
  assert.strictEqual(plan.collaborationMatrix.synthesisRoles['Research-Methodology-Integration-Expert'].role, 'QUALITY_VALIDATOR');
  assert.strictEqual(plan0.collaborationMatrix.synthesisRoles['Research-Methodology-Integration-Expert'].role, 'PRIMARY_SYNTHESIZER');
  const integName = ps.find(p => p.domainCategory === 'INTEGRATION').name;
  assert.strictEqual(plan.collaborationMatrix.synthesisRoles[integName].role, 'PRIMARY_SYNTHESIZER');
});

test('orchestrator: plan ids are unique within a millisecond; input validated; timeline flagged as estimate', async () => {
  const ps = await PG.generatePersonas(mkDomains(), cx);
  const ids = new Set();
  for (let i = 0; i < 20; i++) ids.add((await RO.orchestrateResearch(ps, CTX)).planId);
  assert.strictEqual(ids.size, 20);
  await assert.rejects(() => RO.orchestrateResearch([], CTX), TypeError);
  await assert.rejects(() => RO.orchestrateResearch(ps, null), TypeError);
  assert.strictEqual((await RO.orchestrateResearch(ps, CTX)).timeline.estimated, true);
});

test('orchestrator: nameHasSegment is segment based', () => {
  assert.ok(RO.nameHasSegment('Computer-Vision-Machine-Learning-Expert', 'Machine-Learning'));
  assert.ok(!RO.nameHasSegment('Computer-Vision-Machine-Learning-Expert', 'Machine-Learn'));
});

// ---------------------------------------------------------------- Handoff
async function makeHandoff(n) {
  const base = mkDomains();
  while (base.primary.length < n) base.primary.push({ domain: 'Domain' + base.primary.length, confidence: 0.8, indicators: [] });
  const ps = await PG.generatePersonas(base, cx);
  const plan = await RO.orchestrateResearch(ps, CTX);
  const analysis = await D.analyzeContext(CTX);
  return { ps, plan, handoff: await HP.generateHandoff(analysis, base, ps, plan) };
}

test('handoff: include_domains now populated for hyphenated domains (original always empty for them)', async () => {
  const { ps, handoff } = await makeHandoff(2);
  const ml = handoff.personaInstructions.find(p => p.persona === 'Machine-Learning-Expert');
  assert.ok(ml.tavilyQueries[0].filters.include_domains.includes('arxiv.org'));
  assert.deepStrictEqual(ml.tavilyQueries[0].request.include_domains, ml.tavilyQueries[0].filters.include_domains);
  assert.strictEqual(ml.tavilyQueries[0].request.search_depth, 'basic');
  assert.deepStrictEqual(HP0src.generateDomainFilters({ primaryExpertise: 'Machine-Learning' }), []);   // original always empty here
  HP.options.restrictToDomainSites = false;
  const h2 = await HP.generateHandoff(await D.analyzeContext(CTX), mkDomains(), ps, await RO.orchestrateResearch(ps, CTX));
  assert.deepStrictEqual(h2.personaInstructions[0].tavilyQueries[0].filters.include_domains, []);
  HP.options.restrictToDomainSites = true;
});

test('handoff: subdomain personas inherit the parent domain site list', () => {
  const sites = HP.generateDomainFilters({ primaryExpertise: 'Computer-Vision', name: 'Reinforcement-Learning-Machine-Learning-Expert' });
  assert.ok(sites.includes('arxiv.org'));
  assert.deepStrictEqual(HP.generateDomainFilters({ primaryExpertise: 'Unknown-Thing', name: 'Unknown-Thing-Expert' }), []);
});

test('handoff: totalThoughts always covers the sum of phase thoughts', async () => {
  for (const n of [2, 3, 6, 9]) {
    const { ps, handoff } = await makeHandoff(n);
    const stp = handoff.sequentialThinkingProtocol;
    const sum = stp.phases.reduce((a, p) => a + p.thoughts, 0);
    assert.ok(stp.totalThoughts >= sum, `n=${ps.length}: total ${stp.totalThoughts} < ${sum}`);
  }
  // demonstrate original defect: 6 personas -> 28 total vs 29 in phases
  const fake = Array.from({ length: 6 }, (_, i) => ({ name: 'P' + i, expertiseDepth: 'EXPERT', primaryExpertise: 'X', researchApproach: {}, queryStrategies: ['q'] }));
  const h0 = await quietly(() => HP0src.generateHandoff({ originalContext: 'x', complexity: {} }, { primary: [], technical: [] }, fake, { collaborationMatrix: {} }));
  assert.ok(h0.sequentialThinkingProtocol.totalThoughts < h0.sequentialThinkingProtocol.phases.reduce((a, p) => a + p.thoughts, 0));
});

test('handoff: unique execution ids, validation, no forced breakthrough count', async () => {
  const { ps, plan, handoff } = await makeHandoff(2);
  const analysis = await D.analyzeContext(CTX);
  const ids = new Set([handoff.executionId]);
  for (let i = 0; i < 10; i++) ids.add((await HP.generateHandoff(analysis, mkDomains(), ps, plan)).executionId);
  assert.strictEqual(ids.size, 11);
  await assert.rejects(() => HP.generateHandoff(analysis, mkDomains(), [], plan), TypeError);
  assert.ok(!JSON.stringify(handoff).includes('3-5 breakthrough'));
  assert.ok(handoff.outputSpecifications.honestyRules.length >= 4);
  assert.match(handoff.contextSummary.estimatedResearchTime, /minutes/);
});

// ---------------------------------------------------------------- Expert panel
test('panel: scripted texts carry no emoji/em-dash and mark figures unverified', async () => {
  const out = await EP.runDebate('Should we pilot in Israel?', {}, 'innovation');
  const all = out.map(c => c.content).join('\n');
  assert.ok(!/[—\u{1F300}-\u{1FAFF}❤]/u.test(all));
  assert.ok(/C1, UNVERIFIED|\[C1/.test(all));
  assert.ok(!/actionable consensus/i.test(all));
  assert.strictEqual(out.provenance.scripted, true);
  assert.strictEqual(EP.claims.length, 11);
  assert.ok(EP.claims.every(c => c.status === 'unverified'));
});

test('panel: Blue synthesis reflects the contributions it was given', () => {
  const partial = EP.experts.BLUE.synthesize([{ hat: 'WHITE', content: 'x [C2, UNVERIFIED]' }]);
  assert.match(partial, /Perspectives present: WHITE/);
  assert.match(partial, /missing: RED, YELLOW, BLACK, GREEN/);
  assert.match(partial, /cited in the texts: C2/);
  assert.match(EP.experts.BLUE.synthesize([]), /present: none/);
});

test('panel: input validation and error messages', async () => {
  await assert.rejects(() => EP.runDebate('', {}), TypeError);
  await assert.rejects(() => EP.runDebate('q', {}, 'nonsense'), RangeError);
  assert.throws(() => EP.consult('PURPLE', 'q'), /Unknown hat/);
  assert.throws(() => EP.consult('blue', 'q'), /consolidates/);
  assert.match(EP.consult('black', 'topic'), /topic/);
  assert.strictEqual(EP.listExperts().length, 6);
});

test('panel: registry arithmetic note for C4 is right (22.4 -> 75.4 over 8 years)', () => {
  const cagr = Math.pow(75.4 / 22.4, 1 / 8) - 1;
  assert.ok(Math.abs(cagr - 0.1635) < 0.001, String(cagr));
  assert.ok(Math.abs(Math.pow(1.155, 8) * 22.4 - 75.4) > 3);     // 15.5% would give about 71
  assert.match(EP.claims.find(c => c.id === 'C4').note, /16\.4%/);
});

test('panel: module is require-able without side effects (demo only runs as main)', () => {
  const { spawnSync } = require('node:child_process');
  const r = spawnSync(process.execPath, ['-e', `const p=require(${JSON.stringify(path.join(NEW, 'ip-finance-files/GenesisExpertPanel_IPFinance.js'))});console.log(typeof p.runDebate)`], { encoding: 'utf8' });
  assert.strictEqual(r.stdout.trim(), 'function');
});

// ---------------------------------------------------------------- end to end
test('pipeline: decompose -> identify -> personas -> plan -> handoff runs on new modules', async () => {
  const a = await D.analyzeContext(CTX);
  const d = await DI.identifyDomains(a);
  const ps = await PG.generatePersonas(d, a.complexity);
  const plan = await RO.orchestrateResearch(ps, CTX);
  const h = await HP.generateHandoff(a, d, ps, plan);
  assert.ok(ps.length >= 1 && h.personaInstructions.length === ps.length);
  assert.ok(JSON.stringify(h).length > 1000);
});
