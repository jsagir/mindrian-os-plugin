'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { load } = require('./harness.cjs');

const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ec-'));
function mkRoomDb(room, nodes, edges) {
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  const db = new DatabaseSync(path.join(room, '.mindrian', 'room.db'));
  db.exec('CREATE TABLE nodes (id TEXT, type TEXT, properties TEXT, source_path TEXT, created_at INTEGER); CREATE TABLE edges (source TEXT, target TEXT, type TEXT, properties TEXT)');
  const ni = db.prepare('INSERT INTO nodes VALUES (?,?,?,?,?)');
  for (const n of nodes) ni.run(n.id, n.type, JSON.stringify(n.props || {}), n.source_path || null, n.created_at || 1700000000000);
  const ei = db.prepare('INSERT INTO edges VALUES (?,?,?,?)');
  for (const e of edges) ei.run(e[0], e[1], e[2], JSON.stringify(e[3] || {}));
  db.close();
}

// ---------------- opportunity-harvest ----------------
test('harvest: bridge lane, hub exclusion, Q2 gate, deterministic ranking, side-channel written atomically', () => {
  const { mod } = load('new', 'opportunity-harvest');
  const room = tmpdir();
  const nodes = [
    { id: 'a', type: 'technology', props: { section: 'market-analysis' } },
    { id: 'b', type: 'technology', props: { section: 'solution-design' } },
    { id: 'c', type: 'technology', props: { section: 'solution-design' } },
    { id: 'd', type: 'technology', props: { section: 'solution-design' } },
    { id: 'lonely', type: 'whitespace_dummy' },
    { id: 'ws1', type: 'WhitespaceZone', props: {} },
  ];
  // hub: node h with degree > 6 should not bridge
  nodes.push({ id: 'h', type: 'technology', props: { section: 'x' } });
  const edges = [['a', 'b', 'RELATED_TO'], ['c', 'd', 'COMPETES_WITH'], ['b', 'c', 'CONTRADICTS']];
  for (let i = 0; i < 8; i += 1) { nodes.push({ id: 'sp' + i, type: 'technology' }); edges.push(['h', 'sp' + i, 'RELATED_TO']); }
  edges.push(['ws1', 'a', 'RELATED_TO']);
  mkRoomDb(room, nodes, edges);
  const r1 = mod.harvestCandidates(room, {});
  assert.strictEqual(r1.ok, true);
  const lanes = r1.candidates.map((c) => c.source_event);
  assert.ok(lanes.includes('bridge') && lanes.includes('contradiction') && lanes.includes('whitespace'));
  assert.ok(!r1.candidates.some((c) => c.evidence_handles.includes('h')), 'hub endpoint excluded');
  assert.ok(!r1.candidates.some((c) => c.evidence_handles.includes('lonely')), 'degree-0 node never surfaces (Q2)');
  const cross = r1.candidates.find((c) => c.evidence_handles.join() === 'a,b');
  const within = r1.candidates.find((c) => c.evidence_handles.join() === 'c,d');
  assert.ok(cross.score > within.score, 'cross-section pair outranks within-cluster pair');
  for (let i = 1; i < r1.candidates.length; i += 1) assert.ok(r1.candidates[i - 1].score >= r1.candidates[i].score);
  assert.deepStrictEqual(r1.warnings, []);
  const side = JSON.parse(fs.readFileSync(r1.side_channel, 'utf8'));
  assert.strictEqual(side.schema_version, 1);
  assert.deepStrictEqual(fs.readdirSync(path.join(room, '.mindrian')).filter((f) => f.includes('.tmp.')), []);
  const r2 = mod.harvestCandidates(room, {});
  assert.deepStrictEqual(r2.candidates, r1.candidates, 'two runs are byte-identical');
});
test('harvest: REJECTED_BECAUSE and banked-name dedup; unicode names dedupe (orig could not)', () => {
  const room = tmpdir();
  const nodes = [
    { id: 'o1', type: 'opportunity', props: { lifecycle: 'candidate', name: 'הזדמנות ראשונה', critic: 'transferable', owner: 'x' } },
    { id: 'o2', type: 'opportunity', props: { lifecycle: 'candidate', name: 'Plain Name' } },
    { id: 'o3', type: 'opportunity', props: { lifecycle: 'candidate', name: 'Rejected One' } },
    { id: 'z', type: 'technology' },
  ];
  const edges = [['o1', 'z', 'DERIVED_FROM'], ['o2', 'z', 'DERIVED_FROM'], ['o3', 'z', 'DERIVED_FROM'], ['o3', 'z', 'REJECTED_BECAUSE', { reason: 'q1_no_friction' }]];
  mkRoomDb(room, nodes, edges);
  const bank = { opportunities: [{ filename: 'הזדמנות-ראשונה.md' }, { filename: 'plain-name.md' }] };
  for (const variant of ['orig', 'new']) {
    const { mod } = load(variant, 'opportunity-harvest');
    global.__bank = bank.opportunities;
    const r = mod.harvestCandidates(room, {});
    const handles = r.candidates.filter((c) => c.source_event === 'eureka_proposal').map((c) => c.node_handle);
    assert.ok(!handles.includes('o2'), variant + ': latin banked name deduped');
    assert.ok(!handles.includes('o3'), variant + ': rejection edge deduped');
    if (variant === 'orig') assert.ok(handles.includes('o1'), 'orig: Hebrew banked name NOT deduped (bug)');
    else assert.ok(!handles.includes('o1'), 'new: Hebrew banked name deduped');
  }
  global.__bank = [];
});
test('harvest: harvest index math, critic gate, junk portfolio rows, collision-free ids, failure posture', () => {
  const { mod } = load('new', 'opportunity-harvest');
  const room = tmpdir();
  mkRoomDb(room, [
    { id: 'o1', type: 'opportunity', props: { lifecycle: 'candidate', name: 'N1', critic: 'transferable', compression_score: 0.5, owner: 'me', next_experiment: 'x', decision_question: 'y' } },
    { id: 'o2', type: 'opportunity', props: { lifecycle: 'candidate', name: 'N2', critic: 'pseudoscience' } },
    { id: 'o3', type: 'opportunity', props: { lifecycle: 'candidate', name: 'N3' } },
    { id: 'e1', type: 'technology' }, { id: 'e2', type: 'technology' }, { id: 'e3', type: 'technology' },
  ], [['o1', 'e1', 'DERIVED_FROM'], ['o1', 'e2', 'DERIVED_FROM'], ['o2', 'e1', 'DERIVED_FROM'], ['o3', 'e3', 'DERIVED_FROM']]);
  fs.mkdirSync(path.join(room, 'evals', 'eureka'), { recursive: true });
  fs.writeFileSync(path.join(room, 'evals', 'eureka', '215-portfolio-report.json'), JSON.stringify({ ranked: [null, 5, { a: 'e1', b: 'e2', dims: { strategic_fit: NaN, validated_demand: 1, tech_econ_feasibility: 1 } }] }));
  const r = mod.harvestCandidates(room, {});
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  const by = (h) => r.candidates.find((c) => c.node_handle === h);
  // o1: critic pass -> weighted sum over compression(.5,w.3), evidence(2 edges/4=.5,w.2 ... connection_count=degree(o1)=2), follow_through(1,w.2)
  const hi = by('o1').harvest_index;
  assert.strictEqual(by('o1').components.critic_gate, 'pass');
  assert.strictEqual(by('o1').components.evidence_readiness, 0.5);
  assert.strictEqual(by('o1').components.follow_through_readiness, 1);
  const expect = Math.round(((0.3 * 0.5 + 0.2 * 0.5 + 0.2 * 1) / 0.7) * 100) / 100;
  assert.strictEqual(hi.value, expect);
  assert.strictEqual(by('o2').harvest_index.value, 0, 'measured critic fail -> 0');
  assert.strictEqual(by('o3').harvest_index.value, 'unknown', 'unknown critic -> unknown, never fabricated');
  assert.strictEqual(by('o1').components.portfolio_score, 'unknown', 'NaN dims row is not turned into a score');
  const ids = r.candidates.map((c) => c.candidate_id);
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.strictEqual(mod.harvestCandidates('', {}).reason, 'invalid_room_dir');
  assert.strictEqual(mod.harvestCandidates(path.join(room, 'nope', 'x'), {}).ok, false);
});

// ---------------- room-native-substrate ----------------
test('room-native: epochSeconds units, sectionFor chain, degree, DESCRIBES inheritance, pairs dedupe', () => {
  const { mod } = load('new', 'room-native-substrate');
  const t = mod._test;
  assert.strictEqual(t.epochSeconds(1700000000000), 1700000000);
  assert.strictEqual(t.epochSeconds(1700000000), 1700000000);
  assert.strictEqual(t.epochSeconds('1700000000000'), 1700000000);
  assert.strictEqual(t.epochSeconds('2024-01-01T00:00:00Z'), 1704067200);
  for (const bad of [0, -5, 'junk', null, undefined, NaN, {}]) assert.strictEqual(t.epochSeconds(bad), 0);
  assert.strictEqual(t.sectionFor({ source_path: 'problem-definition\\brief.md' }, {}), 'problem-definition');
  assert.strictEqual(t.sectionFor({ source_path: 'system:section-anchor' }, {}), 'unknown');
  assert.strictEqual(t.sectionFor({ source_path: 'notes.md' }, {}), 'unsectioned');
  assert.strictEqual(t.sectionFor({}, { section: '  legal-ip  ' }), 'legal-ip');
  assert.deepStrictEqual(t.parseProps({ properties: '[1,2]' }), {});
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE nodes (id TEXT, type TEXT, properties TEXT, source_path TEXT, created_at INTEGER); CREATE TABLE edges (source TEXT, target TEXT, type TEXT, properties TEXT)');
  const ni = db.prepare('INSERT INTO nodes VALUES (?,?,?,?,?)');
  ni.run('art', 'memory_artifact', JSON.stringify({ section: 'market-analysis', primary_problem: 'P' }), null, 1700000000000);
  ni.run('ent', 'company', JSON.stringify({ name: 'Sabra', entityType: 'company' }), null, 1700000005000);
  ni.run('t2', 'technology', JSON.stringify({ title: 'T2', section: 's2' }), null, 1700000009000);
  const ei = db.prepare('INSERT INTO edges VALUES (?,?,?,?)');
  ei.run('ent', 'art', 'DESCRIBES', '{}');
  ei.run('ent', 't2', 'COMPETES_WITH', JSON.stringify({ shared_problems: ['x', '', 5] }));
  ei.run('t2', 'ent', 'COMPETES_WITH', '{}');   // duplicate unordered pair
  ei.run('t2', 't2', 'RELATED_TO', '{}');       // self edge
  ei.run('t2', 'ghost', 'RELATED_TO', '{}');    // dangling endpoint
  const s = mod.buildRoomNativeSubstrate(db, {});
  assert.strictEqual(s.techMap.get('ent').title, 'Sabra');
  assert.strictEqual(s.techMap.get('ent').section, 'market-analysis', 'entity inherits section via DESCRIBES');
  assert.strictEqual(s.techMap.get('ent').primary_problem, 'P');
  assert.strictEqual(s.techMap.get('ent').cnumber, '1700000005');
  assert.strictEqual(s.techMap.get('ent').degree, 3);
  assert.strictEqual(s.convergesPairs.length, 2, 'dup pair, self edge and dangling endpoint dropped');
  const cp = s.convergesPairs.find((p) => p.edge_type === 'COMPETES_WITH');
  assert.deepStrictEqual(cp.shared_problems, ['x']);
  assert.strictEqual(s.meta.nodes_read, 3);
  assert.strictEqual(s.meta.edges_read, 5);
  // older room without edges table: zero edges. Any other db error must surface (orig swallowed it).
  const old = new DatabaseSync(':memory:');
  old.exec('CREATE TABLE nodes (id TEXT, type TEXT, properties TEXT, source_path TEXT, created_at INTEGER)');
  assert.strictEqual(mod.buildRoomNativeSubstrate(old, {}).meta.edges_read, 0);
  const fake = { prepare: (sql) => { if (/FROM edges/.test(sql)) throw new Error('database disk image is malformed'); return { all: () => [] }; } };
  assert.throws(() => mod.buildRoomNativeSubstrate(fake, {}), /malformed/);
  const o = load('orig', 'room-native-substrate').mod;
  assert.strictEqual(o.buildRoomNativeSubstrate(fake, {}).meta.edges_read, 0, 'orig swallowed the corruption error');
});

// ---------------- opportunity-statement ----------------
const OS = load('new', 'opportunity-statement').mod;
const OSO = load('orig', 'opportunity-statement').mod;
const cand = () => ({
  a: { title: 'Alpha', primary_problem: 'pa', section: 'sa', weak_dimensions: ['validated_demand'] },
  b: { title: 'Beta', primary_problem: 'pb', section: 'sb', weak_dimensions: ['validated_demand', 'strategic_fit'] },
  shared_problems: ['cold chain'], score: 0.8, rank: 3, tail: true,
});
test('statement: canonical text byte-parity with orig for clean input', () => {
  OS._test.setCriticForTest(null); OSO._test.setCriticForTest(null);
  const n = OS.buildOpportunityStatement(cand());
  const o = OSO.buildOpportunityStatement(cand());
  assert.strictEqual(n.text, o.text);
  assert.ok(n.text.endsWith('. Rank: 3'));
  assert.ok(n.text.includes('tier-1 (portfolio-lead) - WEAK-SIGNAL TAIL'));
  assert.strictEqual(n.critic, 'pending'); assert.strictEqual(n.banked, false);
  assert.ok(n.text.includes('both sides unvalidated on demand'));
});
test('statement: BUG(orig) newline/em-dash in titles leak into prose; new cleans', () => {
  OS._test.setCriticForTest(null); OSO._test.setCriticForTest(null);
  const c = cand(); c.a.title = 'Alpha\nSecond \u2014 line';
  assert.ok(/\n/.test(OSO.buildOpportunityStatement(c).text));
  const t = OS.buildOpportunityStatement(c).text;
  assert.ok(!/[\n\u2014]/.test(t) && t.includes('Alpha Second - line'));
});
test('statement: critic gate never fabricates a pass', async () => {
  const c = cand();
  OS._test.setCriticForTest(() => ({ pass: true }));
  assert.strictEqual(OS.buildOpportunityStatement(c).banked, true);
  OS._test.setCriticForTest(() => undefined);
  const r = OS.buildOpportunityStatement(c);
  assert.strictEqual(r.critic, 'pending'); assert.strictEqual(r.banked, false);
  OSO._test.setCriticForTest(() => undefined);
  assert.strictEqual(OSO.buildOpportunityStatement(c).critic, undefined, 'orig: critic undefined');
  OS._test.setCriticForTest({ stageA: () => ({ degraded: true, pass: true }) });
  const d = OS.buildOpportunityStatement(c);
  assert.strictEqual(d.critic, 'pending'); assert.strictEqual(d.banked, false);
  OS._test.setCriticForTest({ stageA: () => new Promise(() => {}) });
  assert.strictEqual(OS.buildOpportunityStatement(c).critic, 'pending');
  // async pass: timeout leaves pending, a real transferable verdict banks
  OS._test.setCriticForTest({ stageA: () => new Promise(() => {}) });
  const st1 = { critic: 'pending', banked: false, text: 't', fields: {} };
  const res = await OS.resolveCriticVerdicts([st1], { timeoutMs: 20, batchMs: 200 });
  assert.deepStrictEqual([res.attempted, res.resolved, res.pending], [1, 0, 1]);
  assert.strictEqual(st1.banked, false);
  OS._test.setCriticForTest({ stageA: async () => ({ verdict: 'transferable' }) });
  const st2 = { critic: 'pending', banked: false, text: 't', fields: {} };
  assert.strictEqual((await OS.resolveCriticVerdicts([st2])).banked, 1);
  assert.strictEqual(st2.banked, true);
  OS._test.setCriticForTest({ stageA: async () => ({ degraded: true }) });
  const st3 = { critic: 'pending', banked: false, text: 't', fields: {} };
  assert.strictEqual((await OS.resolveCriticVerdicts([st3])).resolved, 0);
  const st4 = { critic: 'pending', banked: false, text: 't', fields: {} };
  assert.strictEqual((await OS.resolveCriticVerdicts([st4], { batchMs: 0 })).deadline_hit, true);
  OS._test.setCriticForTest();
});
test('statement: input validation', () => {
  assert.throws(() => OS.buildOpportunityStatement(null), /OPP_STATEMENT_INPUT/);
  const c = cand(); c.rank = NaN;
  assert.throws(() => OS.buildOpportunityStatement(c), /rank/);
  const d = cand(); d.shared_problems = [' '];
  assert.throws(() => OS.buildOpportunityStatement(d), /shared_problems/);
});

// ---------------- qualify-opportunity ----------------
const Q = load('new', 'qualify-opportunity').mod;
test('qualify: rubric lines bounded and honest about unknown; NaN is unknown not fail', () => {
  const lines = Q.formatRubricLines({ q1: 1, q2: 0, q3: 'unknown', q4: 0.5, q5: 0.49, q6: NaN, q7: 1, q8: 1 });
  assert.ok(lines.length <= 8);
  assert.ok(lines.includes('* fail: Q2 connection (hard gate)') && lines.includes('* fail: Q5 actor fit'));
  assert.ok(lines.some((l) => l.startsWith('* unknown:') && l.includes('Q3') && l.includes('Q6')));
  assert.ok(!lines.includes('* fail: Q6 definability'));
  assert.deepStrictEqual(Q.formatRubricLines(null), []);
});
test('qualify: component lines never print a decimal and name unknown verbatim', () => {
  const l = Q.formatComponentLines({ critic_gate: 'pass', compression_score: 0.37, portfolio_score: { strategic_fit: 0.2, validated_demand: 'unknown', feasibility: 1 }, tail_flag: true, evidence_readiness: 0.5, follow_through_readiness: 'unknown' }, { value: 0.44 });
  assert.ok(l.every((x) => !/\d\.\d/.test(x)), l.join('\n'));
  assert.ok(l.includes('* tail flag: yes') && l.some((x) => x.includes('demand unknown')));
  assert.ok(l.some((x) => x.includes('HarvestIndex_v1 (EXPERIMENTAL): measured')));
});
test('qualify: suggestNext deterministic ties; verbs; skip reason enum enforced', () => {
  const cs = [{ candidate_id: 'b', score: 0.5 }, { candidate_id: 'a', score: 0.5 }, { candidate_id: 'c', score: 0.9 }];
  assert.strictEqual(Q.suggestNext(cs, 'c').next_candidate_id, 'a');
  assert.strictEqual(Q.suggestNext(cs.slice().reverse(), 'c').next_candidate_id, 'a');
  assert.strictEqual(Q.suggestNext(cs, 'b').next_candidate_id, null);
  assert.strictEqual(Q.suggestNext('x').ok, false);
  assert.strictEqual(Q.skipCandidate({}, { candidate_id: 'x' }, 'not_in_enum', 't').reason, 'invalid_skip_reason');
  assert.strictEqual(Q.askBrain({ lens: 'l' }).brain_available, false);
  assert.strictEqual(Q.CARD_VERBS.length, 5);
});

// ---------------- grade-grant ----------------
const G = load('new', 'grade-grant').mod;
const GO = load('orig', 'grade-grant').mod;
const rubric = () => ({
  id: 'prog', name_en: 'P', stage: 's', eligibility: 'e', purpose: 'p', funding_pct: '50', funding_cap: '1', duration: '1', status: 'drafted',
  criteria: [
    { id: 'elig', aspect: 'a', details: 'd', common_mistake: 'm', category: 'eligibility', room_section: 'problem-definition' },
    { id: 'mkt', aspect: 'a', details: 'd', common_mistake: 'm', category: 'market', room_section: 'market-analysis' },
    { id: 'bud', aspect: 'a', details: 'd', common_mistake: 'm', category: 'budget', room_section: null },
    { id: 'leg', aspect: 'a', details: 'd', common_mistake: 'm', category: 'legal' },
  ],
});
test('grade-grant: scoring 1.0 / 0.5 / 0.0, silent gaps are absent, same pct as orig', () => {
  const f = [{ criterion_id: 'elig', status: 'evidenced' }, { criterion_id: 'mkt', status: 'asserted' }, { criterion_id: 'bud', status: 'bogus' }];
  const n = G.scoreApplication(rubric(), f);
  const o = GO.scoreApplication(rubric(), f);
  assert.strictEqual(n.score_pct, 38); // (1 + .5) / 4 = 37.5 -> 38
  assert.strictEqual(n.score_pct, o.score_pct);
  assert.deepStrictEqual(n.counts, { total: 4, evidenced: 1, asserted: 1, absent: 2 });
  assert.strictEqual(n.score_raw, 0.375);
  assert.deepStrictEqual(n.gaps.map((g) => g.criterion_id), ['mkt', 'bud', 'leg']);
  assert.strictEqual(G.scoreApplication({ criteria: [] }, []).ok, false);
});
test('grade-grant: prototype-ish criterion ids are ordinary keys; duplicates rejected at load', () => {
  const r = rubric(); r.criteria[0].id = '__proto__';
  const n = G.scoreApplication(r, [{ criterion_id: '__proto__', status: 'evidenced' }]);
  assert.strictEqual(n.counts.evidenced, 1);
  const d = rubric(); d.criteria.push(Object.assign({}, d.criteria[0]));
  assert.strictEqual(G.validateRubric(d).reason, 'fixture_duplicate_criterion');
  assert.strictEqual(GO.validateRubric(d).ok, true, 'orig accepted duplicate ids (double count)');
  const bad = rubric(); bad.criteria[1].room_section = 'not-a-section';
  assert.strictEqual(G.validateRubric(bad).reason, 'fixture_invalid_room_section');
  assert.strictEqual(G.loadRubric('../etc/passwd').reason, 'invalid_program_id');
});
test('grade-grant: ruling verbs, eligibility hard gate, roadmap, strategy handles carry no prose', () => {
  const r = rubric();
  const full = [{ criterion_id: 'elig', status: 'evidenced' }, { criterion_id: 'mkt', status: 'evidenced' }, { criterion_id: 'bud', status: 'evidenced' }, { criterion_id: 'leg', status: 'evidenced' }];
  assert.strictEqual(G.deriveRulingVerb(G.scoreApplication(r, full), r).verb, 'supported');
  const noElig = G.scoreApplication(r, full.slice(1));
  const rv = G.deriveRulingVerb(noElig, r);
  assert.strictEqual(rv.verb, 'rejected'); assert.strictEqual(rv.escalation.room_section, 'problem-definition');
  const half = G.scoreApplication(r, [full[0], { criterion_id: 'mkt', status: 'asserted' }, full[2], { criterion_id: 'leg', status: 'asserted' }]);
  assert.strictEqual(G.deriveRulingVerb(half, r).verb, 'refined');
  assert.strictEqual(G.deriveRulingVerb(null, r).verb, 'undecided');
  const road = G.buildRoadmap(r, G.scoreApplication(r, [full[1]]));
  assert.strictEqual(road.section_plans[0].room_section, 'problem-definition');
  assert.deepStrictEqual(road.process_checklist.map((x) => x.criterion_id).sort(), ['bud', 'leg']);
  const st = G.askBrainForStrategy(G.scoreApplication(r, full.slice(0, 2)), r);
  assert.strictEqual(st.handles.section_profile['market-analysis'], 'covered');
  assert.ok(!JSON.stringify(st.handles).includes('common_mistake'));
});
test('grade-grant: writeGradingResult validates verdict (orig threw into write_threw)', () => {
  const v = G.scoreApplication(rubric(), []);
  const db = {};
  const ok = G.writeGradingResult(db, { verdict: v, sessionId: 's' });
  assert.strictEqual(ok.ok, true);
  const nav = global.__nav[global.__nav.length - 1];
  assert.strictEqual(nav[0], 'claim'); assert.strictEqual(nav[1].knowledge_type, 'heuristic');
  assert.strictEqual(G.writeGradingResult(db, { verdict: { program_id: 'p', score_pct: 5 } }).reason, 'invalid_verdict');
  assert.strictEqual(GO.writeGradingResult(db, { verdict: { program_id: 'p', score_pct: 5 } }).reason, 'write_threw');
});

// ---------------- grade-grant-examine ----------------
const E = load('new', 'grade-grant-examine').mod;
const EO = load('orig', 'grade-grant-examine').mod;
test('examine: BUG(orig) evidence item with no status earns FULL credit; new gives half', () => {
  const cells = [{ evidence: [{ criterion_id: 'mkt', note: 'n' }] }];
  assert.strictEqual(EO.reviewerCellsToFindings(cells, rubric())[0].status, 'evidenced');
  assert.strictEqual(E.reviewerCellsToFindings(cells, rubric())[0].status, 'asserted');
});
test('examine: collisions keep the stricter status and are recorded; unknown criteria dropped', () => {
  const sink = [];
  const cells = [{ findings: [{ criterion_id: 'mkt', status: 'evidenced' }, { criterion_id: 'ghost', status: 'evidenced' }] }, { findings: [{ criterion_id: 'mkt', status: 'absent', note: 'later' }] }];
  const f = E.reviewerCellsToFindings(cells, rubric(), sink);
  assert.deepStrictEqual(f, [{ criterion_id: 'mkt', status: 'absent', note: 'later' }]);
  assert.strictEqual(sink[0].kept, 'absent');
});
test('examine: challenges are downward-only; every one is recorded; input not mutated', () => {
  const base = [{ criterion_id: 'a', status: 'asserted', note: '' }, { criterion_id: 'b', status: 'evidenced', note: 'x' }];
  const frozen = JSON.stringify(base);
  const r = E.applyPanelChallenges(base, [
    { criterion_id: 'a', to_status: 'evidenced', challenged_by: 'x' },
    { criterion_id: 'b', to_status: 'absent', challenged_by: 'legal', reason: 'no proof' },
    { criterion_id: 'a', to_status: 'absent', rebutted: true },
    { criterion_id: 'zzz', to_status: 'absent' },
  ]);
  assert.strictEqual(JSON.stringify(base), frozen);
  assert.deepStrictEqual(r.disputes.map((d) => d.resolution), ['ignored_upward', 'sustained', 'stands', 'ignored_unmatched']);
  assert.strictEqual(r.findings[1].status, 'absent');
  assert.ok(r.findings[1].note.includes('challenged by legal: no proof'));
  assert.strictEqual(r.findings[0].status, 'asserted');
});
test('examine: batching never drops categories (7 -> 5 + 2); fanout sums plan and survives odd results', async () => {
  assert.deepStrictEqual(E.batchCategories(E.CATEGORY_LIST, 5).map((b) => b.length), [5, 2]);
  assert.deepStrictEqual(E.batchCategories([], 5), []);
  assert.strictEqual(E.CATEGORY_LIST.length, 7);
  const r = await E.runReviewerFanout(rubric(), {}, {});
  assert.strictEqual(r.ok, true); assert.strictEqual(r.plan.batches, 2);
  assert.strictEqual((await E.runReviewerFanout({}, {}, {})).reason, 'invalid_rubric');
  const cell = E.defaultReviewerDispatchCell({ hat: 'market' }, { rubric: rubric(), findingsByCategory: { market: [{ criterion_id: 'mkt', status: 'evidenced' }] } });
  assert.strictEqual(cell.stance, 'supports'); assert.deepStrictEqual(cell.criteria_examined, ['mkt']);
  assert.strictEqual(E.defaultReviewerDispatchCell({ hat: 'market' }, {}).stance, 'neutral');
});

// ---------------- reasoning-mode ----------------
const RM = load('new', 'reasoning-mode').mod;
const RMO = load('orig', 'reasoning-mode').mod;
test('reasoning: BUG(orig) CRLF frontmatter is not stripped; new strips it', () => {
  const raw = '---\r\ntitle: x\r\nsecret_yaml_key: 1\r\n---\r\n# Heading\r\nBody text that is long enough to count.';
  assert.ok(RMO._test.stripBody(raw).includes('secret_yaml_key'));
  const n = RM._test.stripBody(raw);
  assert.ok(!n.includes('secret_yaml_key') && n.startsWith('# Heading'));
  assert.strictEqual(RM._test.stripBody('---\nk: v\n---\nbody'), 'body');
  assert.strictEqual(RM._test.stripBody('no frontmatter <!-- c --> here'), 'no frontmatter  here');
});
test('reasoning: readRoomMarkdown skips scaffold/dot dirs/short files, sorted ids, forward slashes', () => {
  const room = tmpdir();
  const w = (p, t) => { const f = path.join(room, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
  const long = 'This is a sufficiently long body for the noise floor to pass easily. ';
  w('b-sec/zeta.md', '# Zeta\n' + long); w('a-sec/alpha.md', '# Alpha\n' + long); w('root.md', long);
  w('a-sec/short.md', 'tiny'); w('a-sec/CONTEXT.md', long); w('.hidden/x.md', long); w('node_modules/y.md', long); w('ROOM.md', long);
  const ents = RM.readRoomMarkdown(room);
  assert.deepStrictEqual(ents.map((e) => e.id), ['a-sec/alpha.md', 'b-sec/zeta.md', 'root.md']);
  assert.deepStrictEqual(ents.map((e) => e.section), ['a-sec', 'b-sec', '(root)']);
  assert.strictEqual(ents[0].title, 'Alpha');
  assert.deepStrictEqual(RM.readRoomMarkdown(path.join(room, 'missing')), []);
});
test('reasoning: bounded pair selection equals the full stable sort of the original', () => {
  const words = ['red', 'green', 'blue', 'cat', 'dog', 'sun', 'moon', 'tree', 'rock', 'wave', 'wind', 'fire', 'ice', 'sand'];
  const entries = [];
  for (let i = 0; i < 30; i += 1) {
    const text = [0, 1, 2, 3, 4, 5].map((k) => words[(i * 3 + k * 5 + (i % 4)) % words.length]).join(' ') + ' item' + i;
    entries.push({ id: 'e' + String(i).padStart(2, '0'), section: 's' + (i % 3), title: 't' + i, text });
  }
  for (const cap of [1, 7, 25, 1000]) {
    const n = RM.proposeCandidatePairs(entries, { maxPairs: cap });
    const o = RMO.proposeCandidatePairs(entries, { maxPairs: cap });
    assert.strictEqual(n.pairs_considered, o.pairs_considered);
    assert.deepStrictEqual(n.candidates.map((c) => [c.id, c.a, c.b, c.lsa_similarity]), o.candidates.map((c) => [c.id, c.a, c.b, c.lsa_similarity]), 'cap ' + cap);
  }
  const same = entries.map((e) => Object.assign({}, e, { section: 'only' }));
  assert.strictEqual(RM.proposeCandidatePairs(same, { maxPairs: 3 }).pairs_considered, 30 * 29 / 2, 'one section falls back to all pairs');
  assert.deepStrictEqual(RM.proposeCandidatePairs([], {}).candidates, []);
  process.env.MINDRIAN_EUREKA_REASONING_MAX_PAIRS = '4';
  assert.strictEqual(RM.proposeCandidatePairs(entries).candidates.length, 4);
  delete process.env.MINDRIAN_EUREKA_REASONING_MAX_PAIRS;
});
test('reasoning: mappings fail closed; unsafe candidate id refused; gate1 routes pseudoscience', async () => {
  const cands = [{ id: 'P0001' }, { id: 'P0002' }, null];
  const v = RM.validateMappings(cands, { P0001: { mechanismText: ' m ', mappingStatement: 's' }, P0002: { mechanismText: '', mappingStatement: 's' } });
  assert.deepStrictEqual([v.valid.length, v.excluded_count], [1, 2]);
  assert.throws(() => RMO.validateMappings(cands, {}), TypeError, 'orig crashed on a null candidate');
  const wd = tmpdir();
  assert.throws(() => RM.emitReasoningPrompts(wd, [{ id: '../../evil' }]), /unsafe candidate id/);
  const man = RM.emitReasoningPrompts(wd, [{ id: 'P0001', mechanismText: 'plain', mappingStatement: 'plain' }, { id: 'P0002', mechanismText: 'gets 10x better', mappingStatement: 'x' }]);
  assert.strictEqual(man.candidates[0].stage_a_pass, true); assert.strictEqual(man.candidates[1].route, 'pseudoscience');
  assert.ok(fs.existsSync(path.join(wd, 'P0001.neutral.txt')));
  fs.writeFileSync(path.join(wd, 'manifest.json'), JSON.stringify({ retry_used: true }));
  assert.strictEqual(RM.emitReasoningPrompts(wd, []).retry_used, true, 'retry latch survives re-emit');
  const rows = await RM.scoreReasoningPairs([{ id: 'P1', mechanismText: 'x', mappingStatement: 'y' }, { id: 'P2', mechanismText: '5x faster', mappingStatement: 'y' }], {});
  assert.strictEqual(rows[0].judge_answer_missing, true); assert.strictEqual(rows[1].verdict, 'pseudoscience');
});
test('reasoning: statements carry null encoder legs and banked:false; invariant guard refuses violations', () => {
  const row = { a: 'a.md', b: 'b.md', title_a: 'A', title_b: 'B', section_a: 'x', section_b: 'y', verdict: 'transferable', lsa_similarity: 0.1, reasoning_tag: 't' };
  const st = RM.buildReasoningStatement(row, 1);
  assert.strictEqual(st.banked, false); assert.strictEqual(st.differential_score, null); assert.strictEqual(st.semantic_similarity, null);
  const good = { statements: [st], ranked: [st], provenance: { run_mode: 'reasoning' } };
  assert.strictEqual(RM.assertReasoningInvariants(good), true);
  assert.throws(() => RM.assertReasoningInvariants({ statements: [Object.assign({}, st, { banked: true })], provenance: { run_mode: 'reasoning' } }));
  assert.throws(() => RM.assertReasoningInvariants({ statements: [Object.assign({}, st, { differential_score: 0.3 })], provenance: { run_mode: 'reasoning' } }));
  assert.throws(() => RM.assertReasoningInvariants({ statements: [Object.assign({}, st, { lsa_similarity: 7 })], provenance: { run_mode: 'reasoning' } }), /lsa_similarity/);
  assert.throws(() => RM.assertReasoningInvariants({ statements: [st], provenance: { run_mode: 'embedded' } }), /run_mode/);
});
