'use strict';
/*
 * Tests for the whitespace/HSI .cjs scripts (plugin modules that are not in this slice are stubbed in _tests/stubs).
 * Run: node --test package-2026/hsi/_tests/test_whitespace_js.cjs     (from the research directory)
 */
require('./_stub_loader.cjs');
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const S = path.resolve(__dirname, '..', 'scripts');
const PERSP = path.resolve(__dirname, '..', 'lib', 'core', 'research-planner', 'perspectives');
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const writeJson = (p, o) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o)); };
function captureStderr(fn) {
  const orig = process.stderr.write.bind(process.stderr); let buf = '';
  process.stderr.write = (s) => { buf += s; return true; };
  return Promise.resolve().then(fn).then((r) => { process.stderr.write = orig; return { r, err: buf }; },
    (e) => { process.stderr.write = orig; throw e; });
}
function resetGraph(nodes) {
  globalThis.__GRAPH = { nodes: nodes || {}, sections: {}, edges: [], deleted: [], zones: [], links: [], near: [], begun: 0, committed: 0 };
  return globalThis.__GRAPH;
}

// ---------------------------------------------------------------- hsi-to-graph
test('hsi-to-graph pairQualifies: percentile files kept as ranked, legacy floor is >= 0.30, --min-score forces', () => {
  const { pairQualifies } = require(path.join(S, 'hsi-to-graph.cjs'));
  assert.equal(pairQualifies({ hsi_score: 0.2, hsi_percentile: 0.9 }, { ranking: { method: 'percentile' } }, NaN), true);
  assert.equal(pairQualifies({ hsi_score: 0.2 }, {}, NaN), false);
  assert.equal(pairQualifies({ hsi_score: 0.30 }, {}, NaN), true, 'exactly 0.30 was dropped by the original <=');
  assert.equal(pairQualifies({ hsi_score: 0.29 }, {}, NaN), false);
  assert.equal(pairQualifies({ hsi_score: 0.2, hsi_percentile: 0.9 }, { ranking: { method: 'percentile' } }, 0.5), false);
  assert.equal(pairQualifies({ hsi_score: 'x' }, {}, NaN), false);
});

test('hsi-to-graph main writes percentile pairs with the new properties and warns on skipped nodes', async () => {
  const { main } = require(path.join(S, 'hsi-to-graph.cjs'));
  const room = tmp('h2g-');
  writeJson(path.join(room, '.hsi-results.json'), {
    metadata: { tier: 1, schema_version: '2.0', ranking: { method: 'percentile' } },
    hsi_pairs: [
      { left_id: 'a/x', right_id: 'b/y', hsi_score: 0.2, lsa_sim: 0.6, semantic_sim: 0.3, hsi_percentile: 0.97, hsi_z: 1.8, rank: 1, lexical_sim: 0.5, bm25_sim: 0.4, second_signal: { confirmed: true } },
      { left_id: 'a/x', right_id: 'zz/missing', hsi_score: 0.25, lsa_sim: 0.6, semantic_sim: 0.3, hsi_percentile: 0.9 },
    ],
    reverse_salients: [{ source_section: 'a', target_section: 'b', differential_score: 0.4 }],
  });
  const g = resetGraph({ 'a/x': {}, 'b/y': {} });
  const { err } = await captureStderr(() => main([room]));
  const conn = g.edges.filter((e) => e.type === 'HSI_CONNECTION');
  assert.equal(conn.length, 1);
  assert.equal(conn[0].props.hsi_percentile, 0.97);
  assert.equal(conn[0].props.second_signal_confirmed, true);
  assert.equal(conn[0].props.results_schema_version, '2.0');
  assert.equal(g.edges.filter((e) => e.type === 'REVERSE_SALIENT').length, 1);
  assert.match(err, /1 pairs skipped/);
  assert.equal(g.begun, 1); assert.equal(g.committed, 1);
});

test('hsi-to-graph main warns when pairs exist but no edge is written', async () => {
  const { main } = require(path.join(S, 'hsi-to-graph.cjs'));
  const room = tmp('h2g0-');
  writeJson(path.join(room, '.hsi-results.json'), { metadata: {}, hsi_pairs: [{ left_id: 'q', right_id: 'r', hsi_score: 0.9 }] });
  resetGraph({});
  const { err } = await captureStderr(() => main([room]));
  assert.match(err, /warning: 1 pairs in results but 0 connection edges/);
});

// ------------------------------------------------------------ whitespace-to-graph
test('whitespace-to-graph writes edges for dict-form nearest artifacts (original wrote none)', async () => {
  const w2g = require(path.join(S, 'whitespace-to-graph.cjs'));
  const room = tmp('w2g-');
  writeJson(path.join(room, '.mindrian', 'whitespace-results.json'), {
    gaps: [{ brain_framework: 'Jobs To Be Done', density_score: -3, strategic_rank: 1, nearest_room_artifacts: [
      { artifact_id: 'market/a', title: 'A' }, 'market/b', 7, { artifact_id: 'gone/c' }] }],
    novelty_scores: [{ artifact_id: 'market/a', novelty_score: 0.5 }],
  });
  const g = resetGraph({ 'market/a': { section: 'market' }, 'market/b': { section: 'market' } });
  const { err } = await captureStderr(() => w2g.main([room]));
  assert.equal(g.zones.length, 2); // zone + novelty carrier
  assert.equal(g.links.filter((l) => l.zoneId.startsWith('ws-')).length, 2);
  assert.equal(g.near.length, 1);
  assert.match(err, /1 nearest-artifact entries had no usable artifact id/);
  assert.match(err, /link gone\/c/);
});

test('zoneIdFor in JS equals gap_id_for in Python', () => {
  const w2g = require(path.join(S, 'whitespace-to-graph.cjs'));
  const cmd = require(path.join(S, 'whitespace-command.cjs'));
  const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'zone_ids.json'), 'utf8'));
  for (const [name, id] of Object.entries(expected)) {
    assert.equal(w2g.zoneIdFor(name), id);
    assert.equal(cmd.zoneIdFor(name), id);
  }
});

// -------------------------------------------------------------- whitespace-to-brain
test('whitespace-to-brain: finite numbers, float rank kept, CR/TAB escaped, brackets scrubbed', () => {
  const b = require(path.join(S, 'whitespace-to-brain.cjs'));
  const cy = b.buildZoneNodeCypher({ problem_type: 'Wicked', density_score: NaN, strategic_rank: 0.5, hypothesis: 'link [Secret Title] with\r\nx\ty' });
  assert.match(cy, /wz\.strategic_rank = 0\.5,/);
  assert.match(cy, /wz\.density_score = 0,/);
  assert.ok(!/NaN/.test(cy));
  assert.ok(!/Secret Title/.test(cy));
  assert.ok(cy.includes('\\r\\n') && cy.includes('\\t'));
  assert.ok(!/\r/.test(cy.split('hypothesis')[1].split('updated_at')[0]));
  assert.match(b.buildZoneNodeCypher({ hypothesis: 'abc' }, { omitHypothesis: true }), /wz\.hypothesis = ''/);
  assert.equal(b.num('x', 7), 7); assert.equal(b.num('2.5', 7), 2.5);
});

test('whitespace-to-brain main: skipped_reason and error_samples', async () => {
  const b = require(path.join(S, 'whitespace-to-brain.cjs'));
  const room = tmp('w2b-');
  const log = console.log; console.log = () => {};
  try {
    let r = await b.main(room, {});
    assert.equal(r.skipped_reason, 'no_results_file');
    writeJson(path.join(room, '.mindrian', 'interpretation-results.json'), { gaps: [{ validated: true, problem_type: 'Wicked', density_score: -1, strategic_rank: 0.5, framework_chain: ['JTBD', 'MECE'] }, { validated: false }] });
    globalThis.__BRAIN = { available: false };
    r = await b.main(room, {});
    assert.equal(r.skipped_reason, 'brain_unavailable');
    globalThis.__BRAIN = { available: true, write: async () => { throw new Error('boom 503'); } };
    r = await b.main(room, {});
    assert.equal(r.zones_written, 0); assert.ok(r.errors >= 3);
    assert.match(r.error_samples[0], /boom 503/);
    globalThis.__BRAIN = { available: true, write: async () => ({ ok: true }) };
    r = await b.main(room, {});
    assert.equal(r.zones_written, 1); assert.equal(r.edges_created, 2); assert.equal(r.aggregation_ran, true); assert.equal(r.skipped_reason, null);
  } finally { console.log = log; delete globalThis.__BRAIN; }
});

// ------------------------------------------------------- write-whitespace-sections
test('write-whitespace-sections: exports, pipe safe tables, all gate underscores, atomic, unclassified note', async () => {
  const w = require(path.join(S, 'write-whitespace-sections.cjs'));
  assert.equal(w.gateLabel('brain_consensus_gate'), 'Brain Consensus Gate');
  assert.equal(w.cell('a|b\nc'), 'a\\|b c');
  assert.equal(w.r3(NaN), 0);
  const room = tmp('wws-');
  fs.mkdirSync(path.join(room, 'market')); fs.mkdirSync(path.join(room, 'empty'));
  writeJson(path.join(room, '.mindrian', 'whitespace-results.json'), {
    metadata: { timestamp: 'T', schema_version: '2.0', gap_selection: { method: 'hybrid' } },
    gaps: [
      { brain_framework: 'JTBD', density_score: -2, strategic_rank: 1, gap_percentile: 0.9, second_signal: { confirmed: true, method: 'm' }, source_trail: [{}], novelty_check: { external_literature: 'not_run' }, nearest_room_artifacts: [{ artifact_id: 'market/a', title: 'A' }] },
      { brain_framework: 'Orphan', density_score: -1, nearest_room_artifacts: [{ artifact_id: 'rootfile' }] },
    ],
    novelty_scores: [{ artifact_id: 'market/a', section: 'market', title: 'Evil | title', novelty_score: 0.5, novelty_percentile: 0.7, nearest_brain_framework: 'JTBD' }],
  });
  const out = []; const ow = process.stdout.write.bind(process.stdout); process.stdout.write = (s) => { out.push(s); return true; };
  let err;
  try { err = (await captureStderr(() => w.main([room]))).err; } finally { process.stdout.write = ow; }
  const md = fs.readFileSync(path.join(room, 'market', 'WHITESPACE.md'), 'utf8');
  assert.match(md, /schema_version: 2\.0/);
  assert.match(md, /gap_method: hybrid/);
  assert.match(md, /Sparsity percentile among Brain frameworks:\*\* 0\.9/);
  assert.match(md, /\| Evil \\\| title \| 0\.5 \| JTBD \| 0\.7 \|/);
  assert.match(md, /external literature not checked/);
  assert.match(err, /1 gap\(s\) had no nearest artifact in a section folder/);
  assert.ok(fs.existsSync(path.join(room, 'empty', 'WHITESPACE.md')));
  assert.deepEqual(fs.readdirSync(path.join(room, 'market')).filter((f) => f.includes('.tmp-')), []);
});

// ------------------------------------------------------------- interpret-whitespace
test('interpret anchorGate: old room+labels_room form, cluster id 0, percentile threshold', () => {
  const i = require(path.join(S, 'interpret-whitespace.cjs'));
  const gap = { nearest_room_artifacts: [{ artifact_id: 'a', title: 'Alpha' }, { artifact_id: 'b', title: 'Beta' }] };
  // old form: matched by title; the points are 0.5 apart, the room spread is much larger
  const room = [[0, 0], [0.5, 0], [10, 0], [0, 10], [10, 10]];
  const labels = ['Alpha', 'Beta', 'C', 'D', 'E'];
  const old = i.anchorGate(gap, 0, { room, labels_room: labels });
  assert.equal(old.passed, false);
  assert.match(old.reason, /p50 of room pairwise distances/);
  // fixed legacy threshold 1.0 would also fail (0.5 < 1.0); widen the pair to show a relative pass
  const gap2 = { nearest_room_artifacts: [{ artifact_id: 'a', title: 'Alpha' }, { artifact_id: 'c', title: 'C' }] };
  assert.equal(i.anchorGate(gap2, 0, { room, labels_room: labels }).passed, true);
  // tiny-scale projection: fixed 1.0 can never pass, relative threshold can
  const tiny = { room_artifacts: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 0.09, y: 0 }, { id: 'c', x: 0.01, y: 0.01 }, { id: 'd', x: 0.02, y: 0 }] };
  const g3 = { nearest_room_artifacts: ['a', 'b'] };
  assert.equal(i.anchorGate(g3, 0, tiny, { spreadMode: 'fixed' }).passed, false);
  assert.equal(i.anchorGate(g3, 0, tiny).passed, true);
  // cluster 0 is a label
  const cl = { room_artifacts: [{ id: 'a', x: 0, y: 0, cluster: 0 }, { id: 'b', x: 0, y: 0, cluster: 1 }] };
  assert.match(i.anchorGate(g3, 0, cl).reason, /span 2 clusters/);
});

test('interpret validateZone: brain consensus skipped, offline-validate is explicit and recorded', () => {
  const i = require(path.join(S, 'interpret-whitespace.cjs'));
  const um = { room_artifacts: [{ id: 'a', x: 0, y: 0, cluster: 0 }, { id: 'b', x: 5, y: 5, cluster: 1 }] };
  const gap = { brain_framework: 'JTBD', nearest_room_artifacts: ['a', 'b'] };
  let v = i.validateZone(gap, 0, um, []);
  assert.equal(v.valid, false); assert.deepEqual(v.gates_skipped, ['brain_consensus']);
  v = i.validateZone(gap, 0, um, [], { offlineValidate: true });
  assert.equal(v.valid, true); assert.equal(v.basis, 'anchor_only');
  v = i.validateZone(gap, 0, um, ['JTBD']);
  assert.equal(v.valid, true); assert.equal(v.basis, 'anchor_and_brain_consensus');
});

test('interpretWhitespace end to end with Brain unavailable writes atomically and explains why', async () => {
  const i = require(path.join(S, 'interpret-whitespace.cjs'));
  const room = tmp('iw-');
  writeJson(path.join(room, '.mindrian', 'whitespace-results.json'), {
    metadata: { schema_version: '2.0' },
    gaps: [{ brain_framework: 'JTBD', nearest_room_artifacts: [{ artifact_id: 'a' }, { artifact_id: 'b' }] }],
    umap_2d: { room_artifacts: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 3, y: 0 }] },
  });
  globalThis.__BRAIN = { available: false };
  const { r } = await captureStderr(() => i.interpretWhitespace(room, { offlineValidate: true }));
  delete globalThis.__BRAIN;
  assert.equal(r.gaps[0].validated, true);
  assert.equal(r.gaps[0].validation.basis, 'anchor_only');
  assert.equal(r.metadata.brain_data_loaded, false);
  assert.match(r.metadata.brain_unavailable_reason, /unavailable/);
  assert.deepEqual(fs.readdirSync(path.join(room, '.mindrian')).filter((f) => f.includes('.tmp-')), []);
});

// -------------------------------------------------------------- whitespace-command
test('whitespace-command normalisers accept both producer spellings', () => {
  const c = require(path.join(S, 'whitespace-command.cjs'));
  const g = c.normalizeGap({ brain_framework: 'Jobs To Be Done' });
  assert.match(g.zone_id, /^ws-jobs-to-be-done-[0-9a-f]{8}$/);
  assert.deepEqual(g.nearest_frameworks, ['Jobs To Be Done']);
  const n = c.normalizeNovelty({ artifact_id: 'a', nearest_brain_framework: 'X', novelty_score: 0.9 });
  assert.equal(n.artifact, 'a'); assert.equal(n.nearest_concept, 'X');
  assert.equal(c.noveltyBand({ novelty_band: 'covered', novelty_score: 0.99 }), 'covered');
  assert.equal(c.noveltyBand({ novelty_score: 0.99 }), 'novel');
  process.env.MINDRIAN_WHITESPACE_BANDS = 'legacy';
  assert.equal(c.noveltyBand({ novelty_band: 'covered', novelty_score: 0.99 }), 'novel');
  delete process.env.MINDRIAN_WHITESPACE_BANDS;
  const sorted = c.sortGaps([{ gap_percentile: 0.2, density_score: -9 }, { gap_percentile: 0.95, density_score: -1 }]);
  assert.equal(sorted[0].gap_percentile, 0.95);
  const legacy = c.sortGaps([{ density_score: -1 }, { density_score: -9 }]);
  assert.equal(legacy[0].density_score, -9);
});

test('whitespace-command runFile does not interpret shell metacharacters in arguments', () => {
  const c = require(path.join(S, 'whitespace-command.cjs'));
  const dir = tmp('inj-');
  const evil = path.join(dir, 'a"; touch PWNED; echo "$(touch PWNED2)`touch PWNED3`');
  const out = c.runNode(path.join(__dirname, 'echo_argv.cjs'), [evil]);
  assert.equal(String(out).trim(), evil);
  assert.deepEqual(fs.readdirSync(dir), []);
  const miss = c.runFile('definitely-not-a-binary-xyz', []);
  assert.equal(miss.error, true); assert.equal(miss.notFound, true);
  const to = c.runNode('-e', []); // -e as script path is invalid: exits non-zero, reported, not thrown
  assert.equal(to.error, true);
});

test('whitespace-command render functions stay free of raw decimals and use normalised novelty rows', () => {
  const c = require(path.join(S, 'whitespace-command.cjs'));
  const rows = [{ artifact_id: 'a', section: 's', novelty_score: 0.91, novelty_band: 'covered', nearest_brain_framework: 'JTBD' }].map(c.normalizeNovelty);
  const lines = c.renderNoveltyLines(rows, [{}]);
  assert.ok(lines.some((l) => /covered/.test(l) && /JTBD/.test(l)));
  assert.ok(!lines.some((l) => /0\.91/.test(l)));
  const az = c.renderAnalyzeLines({ zone_id: 'z', validated: false, validation: { gates_passed: ['anchor'], gates_failed: ['brain_consensus'], gates_skipped: ['brain_consensus'] } }, {}, 1, 3);
  assert.ok(az.some((l) => /brain consensus not evaluated/.test(l)));
});

// ------------------------------------------------------------ measure-hsi-thinking-mode
test('measure-hsi-thinking-mode parseArgv rejects unknown flags and bad --repeats', () => {
  const m = require(path.join(S, 'measure-hsi-thinking-mode.cjs'));
  assert.deepEqual(m.parseArgv(['--check']).errors, []);
  assert.equal(m.parseArgv(['--repeats', '5']).repeats, 5);
  assert.match(m.parseArgv(['--repeat', '5']).errors.join(), /unknown argument "--repeat"/);
  assert.match(m.parseArgv(['--repeats', 'five']).errors.join(), /positive integer/);
  assert.match(m.parseArgv(['--repeats']).errors.join(), /needs a number/);
  assert.match(m.parseArgv(['--jev-fixture']).errors.join(), /needs a path/);
});

test('measure-hsi-thinking-mode main exits 2 on a bad flag without running anything', async () => {
  const m = require(path.join(S, 'measure-hsi-thinking-mode.cjs'));
  let msg = '';
  const code = await m.main(['--bogus'], { writeErr: (s) => { msg += s; }, write: () => {} });
  assert.equal(code, 2); assert.match(msg, /unknown argument "--bogus"/);
});

// ---------------------------------------------------------------------- hsi-recall
test('hsi-recall: max_things bound and divergence_percentile', () => {
  const r = require(path.join(PERSP, 'hsi-recall.cjs'));
  assert.deepEqual(r._test.percentileRanks([5]), [1]);
  assert.deepEqual(r._test.percentileRanks([1, 2, 3]), [0, 0.5, 1]);
  assert.deepEqual(r._test.percentileRanks([1, 1, 3]), [0.25, 0.25, 1]);
  const mk = (id, section, toks) => ({ id, section, tokens: toks, title: id });
  const things = [mk('a1', 'A', ['x', 'y']), mk('b1', 'B', ['x', 'z']), mk('c1', 'C', ['q', 'x']), mk('d1', 'D', ['y'])];
  const substrate = { things, sections: ['A', 'B', 'C', 'D'], edges: [], entities: {}, framework_nodes: {}, connected: new Set(), opp_pairs: new Set() };
  const out = r._test.recallCandidates(substrate, '/nowhere', { per_thing_top_k: 3 });
  assert.ok(out.candidates.length > 0);
  for (const c of out.candidates) assert.ok(c.divergence_percentile >= 0 && c.divergence_percentile <= 1);
  assert.equal(out.counts.truncated_things, 0);
  const cut = r._test.recallCandidates(substrate, '/nowhere', { max_things: 2 });
  assert.equal(cut.counts.truncated_things, 2);
  assert.equal(cut.counts.things, 2);
});
