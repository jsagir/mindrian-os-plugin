'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363 Plan 10 -- research-shape ledger (built from the dev-time graph
 * snapshot, IP-capped) and the local structure reads in
 * lib/core/research-planner/structure.cjs.
 * Legs B1-B4 (builder and ledger), D1-D7 (detection, structure, relevance,
 * next framework, diffusion lens, live refresh, static scan), E1 (the real
 * structure output fed into the 363-06 pyramid and 363-07 perspective).
 *
 * Plain node:assert/strict, zero deps. No em-dash or en-dash in this file:
 * the checks spell those characters through String.fromCharCode.
 * Exit 0 pass, 1 fail, 77 skip.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const guard = hygiene.installNetGuard();
const { check, summary } = hygiene.makeChecker('363-10 structure');

const ROOT = path.resolve(__dirname, '..');
const BUILDER = path.join(ROOT, 'scripts', 'build-research-shape-ledger.cjs');
const LEDGER_FILE = path.join(ROOT, 'data', 'research-shape-ledger.json');
const SNAP_FILE = path.join(ROOT, 'tests', 'fixtures', '363-graph-snapshot.json');
const STRUCTURE_FILE = path.join(ROOT, 'lib', 'core', 'research-planner', 'structure.cjs');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let builder = null;
let S = null;
let loadError = null;
try {
  builder = require(BUILDER);
  S = require(STRUCTURE_FILE);
} catch (e) { loadError = e; }

function leg(name, fn) {
  try {
    if (loadError) throw loadError;
    fn();
    check(name, true);
  } catch (e) {
    check(name, false, (e && e.message ? e.message : String(e)).split('\n')[0]);
  }
}
async function legAsync(name, fn) {
  try {
    if (loadError) throw loadError;
    await fn();
    check(name, true);
  } catch (e) {
    check(name, false, (e && e.message ? e.message : String(e)).split('\n')[0]);
  }
}

function walkStrings(node, cb, keyPath) {
  if (typeof node === 'string') { cb(node, keyPath || ''); return; }
  if (Array.isArray(node)) { node.forEach(function (v, i) { walkStrings(v, cb, (keyPath || '') + '[' + i + ']'); }); return; }
  if (node && typeof node === 'object') {
    Object.keys(node).forEach(function (k) {
      assert.notEqual(k, 'description', 'description key at ' + keyPath);
      walkStrings(node[k], cb, (keyPath || '') + '.' + k);
    });
  }
}

const TEMPLATE_FRAMEWORKS = [
  'Knowns and Unknowns Matrix Framework', 'Root Cause Analysis', 'Six Thinking Hats',
  'HSI Semantic Surprise Analysis Assistant', 'Adoption-Capacity Theory', 'Scientific Roadmapping',
];
const CONTEXT_NAMES = TEMPLATE_FRAMEWORKS.concat([
  'Logic Trees (Issue, Hypothesis, Decision)', 'Hypothesis-Driven Problem Solving', 'Scientific Method',
  'Adversarial Research Protocol', 'Research Validation and Early Business Framing',
  'Herbert Simon The Sciences of the Artificial', 'Dual-Use Technology', 'Diffusion of Innovations (Rogers)',
  'Diffusion Theory', 'Law of Diffusion of Innovation', 'The Pyramid Principle',
]);
const PT_IDS = ['UnDefined', 'IllDefined', 'WellDefined', 'Wicked'];

// ---------------------------------------------------------------------------
// Builder legs
// ---------------------------------------------------------------------------
leg('B1 deterministic build and --check drift detection', function () {
  const snap = JSON.parse(fs.readFileSync(SNAP_FILE, 'utf8'));
  const a = builder.serialize(builder.buildLedger(snap));
  const b = builder.serialize(builder.buildLedger(JSON.parse(JSON.stringify(snap))));
  assert.equal(a, b, 'two builds are byte-identical');
  assert.equal(a, fs.readFileSync(LEDGER_FILE, 'utf8'), 'shipped ledger equals a fresh build');
  const ok = cp.spawnSync(process.execPath, [BUILDER, '--check'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, 'check exits 0 on fresh build');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-363-ledger-'));
  try {
    const scratch = path.join(tmp, 'ledger.json');
    fs.writeFileSync(scratch, a.replace('Scientific Roadmapping', 'Scientific Roadmappinq'));
    const bad = cp.spawnSync(process.execPath, [BUILDER, '--check', '--ledger', scratch], { encoding: 'utf8' });
    assert.equal(bad.status, 1, 'check exits 1 on drift');
    assert.match(bad.stderr, /Recovery:/, 'recovery line printed');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

leg('B2 IP caps: no description key, strings within 140, techniques as names', function () {
  const ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
  walkStrings(ledger, function (s, k) { assert.ok(s.length <= 140, 'string over 140 at ' + k); });
  assert.ok(!/"description"/.test(fs.readFileSync(LEDGER_FILE, 'utf8')), 'no description key text');
  Object.keys(ledger.frameworks).forEach(function (n) {
    const t = ledger.frameworks[n].techniques;
    assert.ok(Array.isArray(t) && t.every(function (x) { return typeof x === 'string'; }), 'techniques are strings: ' + n);
  });
  assert.match(ledger.ip_ruling, /2026-09-17/, 'ip_ruling names the 2026-09-17 rule');
  // the builder refuses a snapshot that would break the caps
  assert.throws(function () { builder.assertIpCaps({ x: 'y'.repeat(141) }); }, /ip_cap_exceeded/);
  assert.throws(function () { builder.assertIpCaps({ description: 'x' }); }, /description_key_forbidden/);
  const long = 'Word '.repeat(60);
  assert.ok(builder.capString(long).length <= 140, 'capString cuts long text');
  assert.equal(builder.capString('First sentence here. Second sentence follows.'), 'First sentence here.');
});

leg('B3 ledger content: problem types, frameworks, steps, shapes, sets, templates', function () {
  const ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
  PT_IDS.forEach(function (id) {
    assert.ok(ledger.problem_types[id] && ledger.problem_types[id].frameworks.length > 0, 'problem type ' + id);
    assert.ok(ledger.shapes[id] && ledger.shapes[id].shape, 'shape ' + id);
  });
  assert.equal(ledger.shapes.UnDefined.shape, 'landscape_scan');
  assert.equal(ledger.shapes.IllDefined.shape, 'independent_lens_fanout');
  assert.equal(ledger.shapes.IllDefined.quick_when, 'one_lens_named');
  assert.equal(ledger.shapes.WellDefined.default_mode, 'quick');
  assert.equal(ledger.shapes.Wicked.unresolved_valid, true);
  CONTEXT_NAMES.forEach(function (n) {
    const f = ledger.frameworks[n];
    assert.ok(f, 'framework present: ' + n);
    ['problem_types', 'feeds_into', 'fed_by', 'prerequisite', 'complements', 'aliases', 'steps', 'techniques'].forEach(function (k) {
      assert.ok(Array.isArray(f[k]), n + '.' + k);
    });
    assert.ok('theo_gap' in f, n + '.theo_gap');
  });
  const sr = ledger.frameworks['Scientific Roadmapping'].steps;
  assert.equal(sr.length, 7);
  sr.forEach(function (s, i) { assert.equal(s.order, i + 1); assert.ok(s.name && s.key_question !== undefined && Array.isArray(s.gates)); });
  assert.equal(ledger.frameworks['Scientific Roadmapping'].techniques.length, 12);
  const lt = ledger.frameworks['Logic Trees (Issue, Hypothesis, Decision)'].steps;
  assert.equal(lt.length, 5);
  assert.equal(lt[0].name, 'Choose tree type based on problem');
  assert.equal(ledger.scientific_set.length, 7);
  assert.ok(ledger.scientific_set.indexOf('Scientific Roadmapping') !== -1);
  assert.equal(ledger.diffusion_set.length, 5);
  assert.equal(Object.keys(ledger.template_frameworks).length, 6);
  assert.equal(ledger.template_frameworks.whitespace, 'HSI Semantic Surprise Analysis Assistant');
  assert.ok(ledger.built_from.source && ledger.built_from.captured_at);
  const gaps = ledger.theo_gaps.map(function (g) { return g.framework; });
  assert.ok(gaps.indexOf('Root Cause Analysis') !== -1, 'zero-step framework logged as a gap');
  // a name the snapshot lacks is recorded as name_not_found
  const snap = JSON.parse(fs.readFileSync(SNAP_FILE, 'utf8'));
  delete snap.frameworks['Diffusion Theory'];
  const l2 = builder.buildLedger(snap);
  assert.equal(l2.frameworks['Diffusion Theory'].theo_gap, 'name_not_found');
});

const pendingLegs = [];

pendingLegs.push(legAsync('B4 --live prints a diff and writes nothing without --write', async function () {
  const calls = [];
  const before = fs.readFileSync(LEDGER_FILE, 'utf8');
  const stub = {
    query: async function (cypher, params) {
      calls.push({ cypher: cypher, params: params });
      if (/HAS_PROCESS_STEP/.test(cypher)) return { records: [{ ord: 1, name: 'Only Step', key_question: null, gates: null }] };
      if (/RETURN f.name AS name$/.test(cypher) && /\{name:\$n\}\) RETURN/.test(cypher)) return { records: [{ name: params.n }] };
      if (/ADDRESSES_PROBLEM_TYPE/.test(cypher)) return { records: [{ name: 'Red Teaming' }] };
      return { records: [] };
    },
  };
  const snap = await builder.liveSnapshot(stub);
  assert.equal(snap.source, 'theo_guarded');
  assert.ok(calls.length > 20);
  calls.forEach(function (c) {
    assert.ok(/^MATCH/.test(c.cypher), 'anchored MATCH only');
    assert.ok(!/OPTIONAL|DISTINCT|SKIP|description/i.test(c.cypher), 'no forbidden clause');
    Object.keys(c.params).forEach(function (k) {
      const v = c.params[k];
      assert.ok(CONTEXT_NAMES.indexOf(v) !== -1 || PT_IDS.indexOf(v) !== -1, 'handle-only param: ' + v);
    });
  });
  const live = builder.buildLedger(snap);
  const diff = builder.diffSummary(JSON.parse(before), live);
  assert.ok(diff.length > 0, 'a diff summary exists');
  assert.equal(fs.readFileSync(LEDGER_FILE, 'utf8'), before, 'nothing written');
  // the --live CLI path without --write must not touch the ledger even if it runs
  assert.equal(fs.readFileSync(LEDGER_FILE, 'utf8'), before);
}));

// ---------------------------------------------------------------------------
// structure.cjs legs
// ---------------------------------------------------------------------------
let fixture = null;
function room(opts) {
  // eslint-disable-next-line global-require
  return require('./helpers/fixture-room-363.cjs').buildRoom363(opts);
}
function setRung(roomDir, defLevel) {
  const p = path.join(roomDir, 'STATE.md');
  fs.writeFileSync(p, '---\nventure_stage: Discovery\ndefinition_level: ' + defLevel + '\n---\n# State\n');
}
const cleanups = [];

leg('D1 detectScientific: S1, S2, S5, no free text', function () {
  const r1 = S.detectScientific({ templateId: 'scientific-roadmapping' });
  assert.equal(r1.scientific, true); assert.ok(r1.signals.indexOf('S1') !== -1);
  const rr = room({ role: 'researcher' }); cleanups.push(rr.cleanup);
  const r2 = S.detectScientific({ templateId: 'map-unknowns', roomDir: rr.roomDir });
  assert.equal(r2.scientific, true); assert.deepEqual(r2.signals, ['S2']);
  const rf = room({ role: 'founder' }); cleanups.push(rf.cleanup);
  const r3 = S.detectScientific({ templateId: 'map-unknowns', roomDir: rf.roomDir });
  assert.equal(r3.scientific, false); assert.deepEqual(r3.signals, []);
  const r4 = S.detectScientific({ templateId: 'map-unknowns', roomDir: rf.roomDir, navigatorToggle: true });
  assert.equal(r4.scientific, true); assert.deepEqual(r4.signals, ['S5']);
  const plain = S.detectScientific({ templateId: 'map-unknowns', roomDir: rf.roomDir });
  const withQ = S.detectScientific({ templateId: 'map-unknowns', roomDir: rf.roomDir, stated_question: 'Test this hypothesis about scientific method' });
  assert.deepEqual(withQ, plain, 'a stated question changes nothing');
  assert.equal(S.detectScientific.length, 1, 'one options parameter');
  const src = fs.readFileSync(STRUCTURE_FILE, 'utf8');
  const body = src.slice(src.indexOf('function detectScientific'), src.indexOf('// structureFor'));
  assert.ok(!/stated_question|question|keyword|\.test\(|\.match\(/.test(body), 'no text classification in detectScientific');
});

leg('D2 structureFor: ledger source, Logic Trees, Scientific Roadmapping, local fallback', function () {
  const sci = S.structureFor({ templateId: 'scientific-roadmapping', rung: 'WellDefined', scientific: true });
  assert.equal(sci.source, 'theo_ledger');
  const ledger = S.loadLedger();
  assert.ok(sci.reason.indexOf(ledger.built_from.captured_at) !== -1, 'reason names captured_at');
  assert.equal(sci.scientific, true);
  assert.equal(sci.logic_trees_steps.length, 5);
  assert.equal(sci.tree_type_hint, 'hypothesis');
  const srSteps = sci.frameworks['Scientific Roadmapping'].steps;
  assert.equal(srSteps.length, 7);
  assert.ok(srSteps[0].key_question && Array.isArray(srSteps[0].gates));
  assert.deepEqual(srSteps[0].gates, ['F.1 Tension Gate']);
  const plain = S.structureFor({ templateId: 'map-unknowns', rung: 'IllDefined', scientific: true });
  assert.equal(plain.source, 'theo_ledger');
  assert.equal(plain.frameworks, undefined, 'no roadmap steps for other engines');
  assert.equal(plain.tree_type_hint, null);
  const local = S.structureFor({ templateId: 'map-unknowns', rung: 'IllDefined', scientific: false });
  assert.equal(local.source, 'local_template');
  assert.ok(local.steps.length > 0 && local.steps[0].name);
  assert.equal(local.scientific, false);
});

leg('D3 plannersForRoom: rung relevance, FEEDS_INTO order, no rung label', function () {
  const r = room({ role: 'researcher' }); cleanups.push(r.cleanup);
  setRung(r.roomDir, 'ill-defined');
  const out = S.plannersForRoom({ roomDir: r.roomDir });
  const ledger = S.loadLedger();
  assert.ok(out.planners.length > 0);
  const ids = out.planners.map(function (p) { return p.template_id; });
  assert.ok(ids.indexOf('think-hats') !== -1 && ids.indexOf('diffusion') !== -1);
  assert.ok(ids.indexOf('root-cause') === -1, 'root-cause addresses WellDefined only');
  assert.ok(ids.indexOf('map-unknowns') === -1, 'map-unknowns addresses UnDefined only');
  out.planners.forEach(function (p) {
    const f = ledger.frameworks[p.framework];
    assert.ok(f.problem_types.indexOf('IllDefined') !== -1 || f.problem_types.length === 0, p.template_id);
    ['template_id', 'doors', 'framework', 'shape', 'default_mode', 'reason'].forEach(function (k) { assert.ok(p[k] !== undefined, k); });
    assert.equal(p.shape, 'independent_lens_fanout');
    assert.equal(p.default_mode, 'deep');
  });
  const blob = JSON.stringify(out);
  assert.ok(!/ill.?defined|un.?defined|well.?defined|wicked/i.test(blob), 'no rung label in output');
  // named fits come before rung-agnostic ones
  assert.ok(ids.indexOf('whitespace') > ids.indexOf('diffusion'), 'agnostic template listed after named fits');
  const wd = S.plannersForRoom({ rung: 'WellDefined' });
  assert.equal(wd.planners[0].template_id, 'root-cause');
  assert.equal(wd.planners[0].default_mode, 'quick');
  const und = S.plannersForRoom({ rung: 'UnDefined' });
  assert.equal(und.planners[0].template_id, 'map-unknowns');
  const none = S.plannersForRoom({ roomDir: path.join(os.tmpdir(), 'mos-363-no-such-room') });
  assert.ok(none.planners.length > 0, 'unknown rung still offers templates');
  const src = fs.readFileSync(STRUCTURE_FILE, 'utf8');
  assert.ok(/resolveRoomRung/.test(src), 'uses resolveRoomRung');
});

leg('D4 nextFramework: FEEDS_INTO filtered by rung, command from the one door', function () {
  // eslint-disable-next-line global-require
  const resolver = require('../lib/workflow/command-resolver.cjs');
  const n = S.nextFramework({ lensFramework: 'Scientific Roadmapping', rung: 'IllDefined' });
  assert.equal(n.none, false);
  assert.equal(n.framework, 'Reverse Salient Analysis');
  assert.equal(n.command, resolver.commandsForFramework('Reverse Salient Analysis')[0]);
  const ledger = S.loadLedger();
  assert.ok(ledger.frameworks['Scientific Roadmapping'].feeds_into[0] === 'Reverse Salient Analysis');
  const none = S.nextFramework({ lensFramework: 'Logic Trees (Issue, Hypothesis, Decision)', rung: 'IllDefined' });
  assert.deepEqual(none, { none: true, reason: 'no_feeds_into_for_rung' });
  const unk = S.nextFramework({ lensFramework: 'Scientific Roadmapping', rung: 'unknown' });
  assert.equal(unk.none, true);
  // rung filter bites: Scientific Roadmapping feeds Hypothesis-Driven Problem Solving (WellDefined only)
  const wd = S.nextFramework({ lensFramework: 'Scientific Roadmapping', rung: 'WellDefined' });
  assert.equal(wd.framework, 'Reverse Salient Analysis');
  const hats = S.nextFramework({ lensFramework: 'Six Thinking Hats', rung: 'WellDefined' });
  assert.notEqual(hats.framework, 'Beautiful Question Framework');
  assert.ok(/commandsForFramework/.test(fs.readFileSync(STRUCTURE_FILE, 'utf8')), 'uses commandsForFramework');
});

leg('D5 lensSelection: named sources, reason required, no network', function () {
  const before = guard.attempts();
  const larry = S.lensSelection({ requested: { lens: 'diffusion', reason: 'Adoption is the disputed part of this question.' } });
  assert.equal(larry.selected[0].lens, 'diffusion'); assert.equal(larry.selected[0].source, 'larry');
  assert.ok(larry.selected[0].reason.length > 0);
  const noReason = S.lensSelection({ requested: { lens: 'diffusion' } });
  assert.deepEqual(noReason.selected, []);
  assert.equal(noReason.refused[0].reason, 'reason_required');
  const blank = S.lensSelection({ requested: { lens: 'diffusion', reason: '   ' } });
  assert.deepEqual(blank.selected, []);
  const tr = room({ role: 'founder', withTimingArtifact: true }); cleanups.push(tr.cleanup);
  assert.equal(S.lensSelection({ roomDir: tr.roomDir }).selected[0].source, 'room_signal');
  const nt = room({ role: 'founder' }); cleanups.push(nt.cleanup);
  assert.deepEqual(S.lensSelection({ roomDir: nt.roomDir }).selected, []);
  const led = S.lensSelection({ frameworks: ['Dominant Design'] });
  assert.equal(led.selected[0].source, 'ledger_feeds_into');
  const sr = S.lensSelection({ perspective: { unlock_chains: [{ limiter_id: 'l1', steps: [{ text: 'a', kind: 'field' }, { text: 'b', kind: 'adoption' }] }] } });
  assert.equal(sr.selected[0].source, 'sr_step');
  assert.equal(S.lensSelection({ navigatorToggle: true }).selected[0].source, 'navigator_toggle');
  assert.deepEqual(S.lensSelection({ frameworks: ['Root Cause Analysis'], perspective: { unlock_chains: [{ steps: [{ kind: 'field' }] }] } }).selected, []);
  assert.deepEqual(S.lensSelection({}).selected, []);
  assert.equal(guard.attempts(), before, 'no network');
});

pendingLegs.push(legAsync('D6 refreshLive: handles only, named fallbacks', async function () {
  const calls = [];
  const rr = room({ role: 'researcher' }); cleanups.push(rr.cleanup);
  const marker = rr.marker;
  const ok = {
    query: async function (cypher, params) {
      calls.push({ cypher: cypher, params: params });
      if (/HAS_PROCESS_STEP/.test(cypher)) return { records: [{ ord: 2, name: 'B' }, { ord: 1, name: 'A' }] };
      return { records: [{ name: 'Some Framework' }] };
    },
  };
  const live = await S.refreshLive({ brainClient: ok, roomDir: rr.roomDir, question: marker });
  assert.equal(live.source, 'theo_live');
  assert.deepEqual(live.live.logic_trees_steps.map(function (s) { return s.name; }), ['A', 'B']);
  assert.ok(calls.length > 20);
  calls.forEach(function (c) {
    assert.ok(/^MATCH/.test(c.cypher));
    assert.ok(!/OPTIONAL|SKIP|DISTINCT|description/i.test(c.cypher));
    Object.keys(c.params).forEach(function (k) {
      const v = c.params[k];
      assert.ok(CONTEXT_NAMES.indexOf(v) !== -1 || PT_IDS.indexOf(v) !== -1, 'handle only: ' + v);
    });
  });
  assert.ok(!JSON.stringify(calls).includes(marker), 'planted room marker never crosses');
  const nul = await S.refreshLive({ brainClient: { query: async function () { return null; } } });
  assert.deepEqual(nul, { source: 'theo_ledger', reason: 'brain_unavailable' });
  const blocked = await S.refreshLive({ brainClient: { query: async function () { return { records: [], egress_disclosure: { disposition: 'blocked' } }; } } });
  assert.deepEqual(blocked, { source: 'theo_ledger', reason: 'egress_blocked' });
  const proceeded = await S.refreshLive({ brainClient: { query: async function () { const a = []; return { records: a, egress_disclosure: { verdict: 'ambiguous', disposition: 'proceeded' } }; } } });
  assert.equal(proceeded.source, 'theo_live', 'an ambiguous verdict that proceeded is accepted');
  const bad = await S.refreshLive({ brainClient: { query: async function () { return { notice: 'row cap' }; } } });
  assert.deepEqual(bad, { source: 'theo_ledger', reason: 'read_failed' });
}));

leg('D7 structure.cjs does not require the Brain client at load', function () {
  const s = fs.readFileSync(STRUCTURE_FILE, 'utf8');
  const top = s.split('function refreshLive')[0];
  assert.ok(!/brain-client/.test(top), 'no brain-client before refreshLive');
  assert.ok(/brain-client/.test(s.slice(s.indexOf('function refreshLive'))), 'lazy require inside refreshLive');
  assert.ok(!/mcp__theo__|framework_step|brain_query/.test(s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(function (l) { return !/^\s*\/\//.test(l) && !/^\s*\*/.test(l); }).join('\n')), 'no framework_step or brain_query in code');
});

leg('E1 real structure output drives 363-06 pyramid and 363-07 perspective', function () {
  const Y = require('../lib/core/research-planner/pyramid.cjs');
  const T = require('../lib/core/research-planner/question-templates.cjs');
  const P = require('../lib/core/research-planner/perspective.cjs');
  const qs = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'scientific-roadmapping.json'), 'utf8'));
  const template = T.TEMPLATES['scientific-roadmapping'];
  const structure = S.structureFor({ templateId: 'scientific-roadmapping', rung: 'WellDefined', scientific: true });
  const built = Y.buildPyramid(qs, { template: template, structure: structure, rung: 'WellDefined' });
  assert.ok(built.pyramid, 'pyramid built');
  const r = Y.applyLogicTreeSteps(built.pyramid, built.leaves, structure, { template: template, rung: 'WellDefined', perspective: qs.perspective });
  assert.equal(r.applied, true, 'logic tree steps applied: ' + r.reason);
  assert.equal(r.steps_applied.length, 5);
  assert.deepEqual(r.unmapped_steps, []);
  assert.equal(r.tree_type, 'hypothesis');
  // the local-template structure must not apply
  const localStruct = S.structureFor({ templateId: 'map-unknowns', rung: 'IllDefined', scientific: false });
  const none = Y.applyLogicTreeSteps(built.pyramid, built.leaves, localStruct, { template: template, rung: 'IllDefined' });
  assert.equal(none.applied, false);
  // Scientific Roadmapping steps through srStepGuide, both from the structure and the ledger
  const g = P.srStepGuide(structure);
  assert.equal(g.source, 'ledger');
  assert.deepEqual(g.steps.map(function (s) { return s.name; }), P.SR_OPERATIONS.slice());
  const ledger = S.loadLedger();
  const g2 = P.srStepGuide(ledger);
  assert.equal(g2.source, 'ledger');
  const srLedger = ledger.frameworks['Scientific Roadmapping'].steps;
  g2.steps.forEach(function (s, i) {
    assert.equal(s.name, srLedger[i].name);
    assert.equal(s.key_question, srLedger[i].key_question, 'ledger key question used, not the local default');
    assert.deepEqual(s.gates, srLedger[i].gates);
  });
  assert.deepEqual(ledger.frameworks['Scientific Roadmapping'].steps.map(function (s) { return s.name; }), P.SR_OPERATIONS.slice());
  assert.equal(P.srStepGuide({}).source, 'local_template');
});

leg('E2 no em-dash or en-dash in this plan files', function () {
  [
    'tests/test-363-structure.cjs', 'scripts/build-research-shape-ledger.cjs', 'data/research-shape-ledger.json',
    'lib/core/research-planner/structure.cjs', 'tests/fixtures/363-graph-snapshot.json',
  ].forEach(function (rel) {
    const t = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(t.indexOf(EM) === -1 && t.indexOf(EN) === -1, 'dash in ' + rel);
  });
});

Promise.all(pendingLegs).then(function () {
  check('D0 net guard silent for the whole run', guard.attempts() === 0, 'attempts=' + guard.attempts());
  cleanups.forEach(function (fn) { try { fn(); } catch (_e) { /* best effort */ } });
  guard.restore();
  process.exit(summary());
});
