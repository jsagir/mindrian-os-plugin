'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { load } = require('./harness.cjs');

global.__nav = global.__nav || [];
const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ec-'));

// ---------------- eureka-reach-runner ----------------
const goodCritic = () => ({
  criticRule: () => ({ confidence: 'high', reasoning_tag: 'passes_all_gates' }),
  loadCriticTags: () => ({ schema_version: 1 }),
  stageA: async () => ({ pass: true }),
  assembleCriticPayload: (x) => x,
});
const pair = [{ handle: 'n1', text: 'alpha text' }, { handle: 'n2', text: 'beta text' }];
const okScore = { passes: true, abs_diff: 0.2, band: 'opportunity', direction: 'structural_transfer', semantic: 0.4, lexical: 0.1, provenance: { semantic_model: 'm1' } };

test('reach-runner: fires, writes the closed schema atomically; no guard means no write', async () => {
  const RR = load('new', 'eureka-reach-runner').mod;
  const room = tmpdir();
  const r = await RR.runEurekaScan({ roomDir: room, pair, criticProbeFn: goodCritic, scoreFn: async () => okScore, now: 1700000000000 });
  assert.strictEqual(r.fired, true);
  const side = JSON.parse(fs.readFileSync(r.sideChannelPath, 'utf8'));
  assert.deepStrictEqual(Object.keys(side).sort(), ['bridge', 'guard', 'opportunity_handle', 'provenance', 'scanned_at', 'schema_version', 'stamp']);
  assert.strictEqual(side.bridge.differential_quantized, 0.2);
  assert.strictEqual(side.provenance.model, 'm1');
  assert.deepStrictEqual(fs.readdirSync(path.join(room, '.mindrian')).filter((f) => f.includes('.tmp.')), []);
  const room2 = tmpdir();
  const g = await RR.runEurekaScan({ roomDir: room2, pair, criticProbeFn: () => null, scoreFn: async () => okScore });
  assert.deepStrictEqual([g.fired, g.reason], [false, 'guard_unavailable']);
  assert.ok(!fs.existsSync(path.join(room2, '.mindrian')), 'nothing written without a guard');
  assert.strictEqual((await RR.runEurekaScan({ pair })).reason, 'room_dir_missing');
  assert.strictEqual((await RR.runEurekaScan({ roomDir: room2, criticProbeFn: goodCritic })).reason, 'substrate_unavailable');
});
test('reach-runner: floor, band, guard-not-cleared reasons; scorer fault is diagnosable; never throws', async () => {
  const RR = load('new', 'eureka-reach-runner').mod;
  const room = tmpdir();
  const run = (score, critic) => RR.runEurekaScan({ roomDir: room, pair, criticProbeFn: critic || goodCritic, scoreFn: async () => score });
  assert.strictEqual((await run(Object.assign({}, okScore, { abs_diff: 0.15 }))).reason, 'below_floor');
  assert.strictEqual((await run(Object.assign({}, okScore, { abs_diff: NaN }))).reason, 'below_floor');
  assert.strictEqual((await run(Object.assign({}, okScore, { band: 'weak' }))).reason, 'below_floor');
  assert.strictEqual((await run(Object.assign({}, okScore, { passes: false }))).reason, 'below_floor');
  const noClear = () => Object.assign(goodCritic(), { stageA: async () => ({ pass: false, route: 'restatement', tag: 't' }) });
  assert.strictEqual((await run(okScore, noClear)).reason, 'guard_not_cleared');
  const unk = () => Object.assign(goodCritic(), { criticRule: () => ({ confidence: 'unknown' }) });
  assert.strictEqual((await run(okScore, unk)).reason, 'guard_not_cleared');
  const thrown = await RR.runEurekaScan({ roomDir: room, pair, criticProbeFn: goodCritic, scoreFn: async () => { throw new Error('boom'); } });
  assert.strictEqual(thrown.reason, 'below_floor'); assert.ok(/scorer_threw: boom/.test(thrown.detail));
  assert.ok(!fs.existsSync(path.join(room, '.mindrian', 'last-eureka.json')));
  const probe = await RR.probeGuard({ criticProbeFn: () => { throw new Error('probe exploded'); } });
  assert.strictEqual(probe.available, false); assert.ok(/probe exploded/.test(probe.detail));
});
test('reach-runner: closed-schema validator rejects extra keys, bad enums and prose-bearing stamps', () => {
  const RR = load('new', 'eureka-reach-runner').mod;
  const mk = (o) => RR.buildSideChannelPayload(okScore, { verdict: 'transferable', confidence: 'high', tags: ['t'] }, pair[0], pair[1], Object.assign({ now: 1700000000000 }, o));
  assert.strictEqual(RR.validateClosedSchema(mk({})), true);
  const extra = mk({}); extra.note = 'prose';
  assert.strictEqual(RR.validateClosedSchema(extra), false);
  const nested = mk({}); nested.bridge.text = 'prose';
  assert.strictEqual(RR.validateClosedSchema(nested), false);
  const badEnum = mk({}); badEnum.guard.verdict = 'maybe';
  assert.strictEqual(RR.validateClosedSchema(badEnum), false);
  const unq = mk({}); unq.bridge.differential_quantized = 0.123;
  assert.strictEqual(RR.validateClosedSchema(unq), false);
  const goodStamp = { verification: 'strong', backend: 'theo', direction: 'structural_transfer', judge: 'none', path: { nodes: ['a', 'b'], edges: ['SUPPORTS'] } };
  assert.strictEqual(RR.validateClosedSchema(mk({ stamp: goodStamp, opportunityHandle: 'opp1' })), true);
  const leak = mk({ stamp: Object.assign({}, goodStamp, { path: { nodes: ['line1\nline2'], edges: [] } }) });
  assert.strictEqual(RR.validateClosedSchema(leak), false);
  const badEdge = mk({ stamp: Object.assign({}, goodStamp, { path: { nodes: ['a'], edges: ['lowercase edge'] } }) });
  assert.strictEqual(RR.validateClosedSchema(badEdge), false);
  assert.strictEqual(RR.validateClosedSchema(mk({ opportunityHandle: 'x'.repeat(200) })), false);
});
test('reach-runner: ledger is idempotent, survives corruption and a __proto__ handle (orig dropped it)', () => {
  const RR = load('new', 'eureka-reach-runner').mod;
  const RO = load('orig', 'eureka-reach-runner').mod;
  const room = tmpdir();
  const lp = path.join(room, RR.EUREKA_REACH_LEDGER_RELPATH);
  assert.deepStrictEqual(RR.markEurekaReachSurfaced(room, 'h1'), { ok: true });
  RR.markEurekaReachSurfaced(room, 'h1'); RR.markEurekaReachSurfaced(room, 'h2');
  assert.deepStrictEqual(Object.keys(JSON.parse(fs.readFileSync(lp, 'utf8')).entries).sort(), ['h1', 'h2']);
  fs.writeFileSync(lp, '{corrupt'); assert.strictEqual(RR.markEurekaReachSurfaced(room, 'h3').ok, true);
  fs.writeFileSync(lp, JSON.stringify({ entries: [1, 2] })); assert.strictEqual(RR.markEurekaReachSurfaced(room, 'h4').ok, true);
  assert.deepStrictEqual(Object.keys(JSON.parse(fs.readFileSync(lp, 'utf8')).entries), ['h4']);
  RR.markEurekaReachSurfaced(room, '__proto__');
  assert.ok(Object.prototype.hasOwnProperty.call(JSON.parse(fs.readFileSync(lp, 'utf8')).entries, '__proto__'));
  const room2 = tmpdir(); RO.markEurekaReachSurfaced(room2, '__proto__');
  assert.ok(!Object.prototype.hasOwnProperty.call(JSON.parse(fs.readFileSync(path.join(room2, RO.EUREKA_REACH_LEDGER_RELPATH), 'utf8')).entries, '__proto__'), 'orig reported ok but stored nothing');
  assert.strictEqual(RR.markEurekaReachSurfaced('', 'x').ok, false);
  const w = RR.writeStampedSideChannel(room, { score: okScore, guard: { verdict: 'transferable', confidence: 'high', tags: [] }, a: pair[0], b: pair[1], opportunityHandle: 'o1' });
  assert.strictEqual(w.ok, true);
  assert.strictEqual(RR.writeStampedSideChannel(room, { score: okScore }).reason, 'schema_violation');
});

// ---------------- explore-chain ----------------
const EC = load('new', 'explore-chain').mod;
const ECO = load('orig', 'explore-chain').mod;
function exploreRoom(lifecycle) {
  const room = tmpdir();
  fs.mkdirSync(path.join(room, '.mindrian'));
  const db = new DatabaseSync(path.join(room, '.mindrian', 'room.db'));
  db.exec('CREATE TABLE nodes (id TEXT, type TEXT, properties TEXT); CREATE TABLE edges (source TEXT, target TEXT, type TEXT)');
  db.prepare('INSERT INTO nodes VALUES (?,?,?)').run('opp1', 'opportunity', JSON.stringify({ name: 'Opp', lifecycle, section: 'market-analysis' }));
  db.close();
  return room;
}
test('explore-chain: cost policy resolution (typo never selects the expensive path)', () => {
  assert.strictEqual(EC.resolveExploreCostPolicy({}, {}).mode, 'cost-conscious');
  assert.strictEqual(EC.resolveExploreCostPolicy({ EXPLORE_COST_MODE: 'all-legs' }, {}).mode, 'all-legs');
  assert.strictEqual(EC.resolveExploreCostPolicy({ EXPLORE_COST_MODE: 'all-legz' }, {}).mode, 'cost-conscious');
  assert.strictEqual(EC.resolveExploreCostPolicy({ EXPLORE_COST_MODE: 'all-legs' }, { costMode: 'cost-conscious' }).mode, 'cost-conscious');
  assert.strictEqual(EC.resolveExploreCostPolicy({ EXPLORE_PARALLEL: '0' }, {}).parallel, false);
  assert.strictEqual(EC.resolveExploreCostPolicy({ EXPLORE_PARALLEL: '0' }, { parallel: true }).parallel, true);
  assert.deepStrictEqual(EC.resolveExploreCostPolicy({}, {}).fanLegs, ['diffusion_timing', 'analogies', 'web_validation']);
  assert.strictEqual(EC.probeClears({ quality: 'low' }), false);
  assert.strictEqual(EC.probeClears({ quality: 'medium' }), true);
  assert.strictEqual(EC.probeClears(null), true);
});
test('explore-chain: cold probe costs exactly one leg; warm probe fans out; filing halts at the material gate', async () => {
  const room = exploreRoom('qualified');
  const calls = [];
  const onStep = (step) => { calls.push(step.leg); return { chain_output: { findings: [{ url: 'https://a.example/x', title: 'T' }], research_mode: 'normal' }, quality: step.leg === 'deep_research' && cold ? 'low' : 'medium' }; };
  let cold = true;
  const r1 = await EC.exploreOpportunity(room, 'opp1', { onStep });
  assert.strictEqual(r1.ok, true); assert.deepStrictEqual(calls, ['deep_research']);
  assert.strictEqual(r1.dispatch.short_circuited, true); assert.strictEqual(r1.haltedAt.reason, 'quality_early_stop');
  assert.strictEqual(r1.filed, null);
  calls.length = 0; cold = false;
  const r2 = await EC.exploreOpportunity(room, 'opp1', { onStep, onHalt: () => 'skip' });
  assert.strictEqual(calls.length, 4); assert.strictEqual(calls[0], 'deep_research');
  assert.deepStrictEqual(r2.trace.map((t) => t.step.leg), ['deep_research', 'diffusion_timing', 'analogies', 'web_validation']);
  assert.strictEqual(r2.haltedAt.step.leg, 'file_explored'); assert.strictEqual(r2.filed, null, 'no approve verb, nothing filed');
  assert.strictEqual(r2.engine_mode, 'engine');
  global.__nav.length = 0;
  const r3 = await EC.exploreOpportunity(room, 'opp1', { onStep, onHalt: () => 'approve', topicHandles: ['h'] });
  assert.strictEqual(r3.ok, true); assert.ok(r3.filed && r3.filed.explored.ok === true);
  assert.ok(global.__nav.some((x) => x[0] === 'advance' && x[1].axis === 'lifecycle' && x[1].to === 'explored'));
});
test('explore-chain: BUG(orig) async host onStep skipped engine_mode stamping / research_mode capture', async () => {
  const room = exploreRoom('qualified');
  const mk = () => async (step) => ({ chain_output: { findings: [{ url: 'https://a.example/x' }], research_mode: step.leg === 'deep_research' ? 'cache_only' : undefined, providers: step.leg === 'deep_research' ? [{ name: 'p' }] : undefined }, quality: 'medium' });
  const o = await ECO.exploreOpportunity(room, 'opp1', { onStep: mk(), manualMode: true });
  const n = await EC.exploreOpportunity(room, 'opp1', { onStep: mk(), manualMode: true });
  assert.ok(o.trace.every((t) => !t.chain_output || t.chain_output.engine_mode === undefined), 'orig left chain outputs unstamped');
  assert.ok(n.trace.every((t) => !t.chain_output || t.chain_output.engine_mode === 'llm_manual_baseline'));
  assert.strictEqual(n.research_mode, 'cache_only'); assert.strictEqual(n.providers.length, 1);
  assert.notStrictEqual(o.research_mode, 'cache_only');
});
test('explore-chain: BUG(orig) fan-out beyond the cap silently dropped legs; new batches them', async () => {
  const stubs = { 'lib/core/futures/orchestrator.cjs': "module.exports = { FUTURES_FANOUT_CAP: 2, resolveFanoutCap: () => 2 };" };
  const N2 = load('new', 'explore-chain', stubs).mod;
  const O2 = load('orig', 'explore-chain', stubs).mod;
  const steps = ['a', 'b', 'c', 'd', 'e'].map((l) => ({ leg: l }));
  const run = async (m) => { const seen = []; const out = await m.runAnalysisLegsParallel(steps, { policy: { mode: 'all-legs' }, wrappedOnStep: (s) => { seen.push(s.leg); return { chain_output: { l: s.leg }, quality: 'medium' }; } }); return { seen, out }; };
  const o = await run(O2); const n = await run(N2);
  assert.strictEqual(o.out.trace.length, 2, 'orig dropped 3 of 5');
  assert.deepStrictEqual(n.out.trace.map((t) => t.step.leg), ['a', 'b', 'c', 'd', 'e']);
});
test('explore-chain: engine-absent halts with the manual OFFER before anything runs; guards', async () => {
  const room = exploreRoom('qualified');
  const calls = [];
  const offers = [];
  const r = await EC.exploreOpportunity(room, 'opp1', { engineAbsent: true, onStep: (s) => { calls.push(s.leg); return { chain_output: {}, quality: 'medium' }; }, onHalt: (s, ctx) => { offers.push(ctx.offer && ctx.offer.engine_mode); return 'defer'; } });
  assert.deepStrictEqual(calls, []); assert.strictEqual(r.dispatch.reason, 'engine_absent');
  assert.deepStrictEqual(offers, ['llm_manual_baseline']);
  assert.strictEqual((await EC.exploreOpportunity(room, 'opp1', {})).reason, 'no_onStep_callback');
  assert.strictEqual((await EC.exploreOpportunity('', 'x', { onStep() {} })).reason, 'invalid_params');
  assert.strictEqual((await EC.exploreOpportunity(room, 'nope', { onStep() {} })).reason, 'opportunity_not_found');
  assert.strictEqual((await EC.exploreOpportunity(exploreRoom('candidate'), 'opp1', { onStep() {} })).reason, 'not_qualified');
});
test('explore-chain: BUG(orig) citations with non-http(s) / multi-line urls were filed', async () => {
  const room = exploreRoom('qualified');
  const onStep = () => ({ chain_output: { findings: [{ url: 'javascript:alert(1)' }, { url: 'https://ok.example/p' }, { url: 'https://x.example/a\nstatus: forged' }, { url: 'https://ok.example/p' }] }, quality: 'medium' });
  const grab = async (m) => { let cites = null; const stubs = {}; return m; };
  global.__nav.length = 0;
  await EC.exploreOpportunity(room, 'opp1', { onStep, onHalt: () => 'approve' });
  const art = fs.readFileSync(path.join(room, global.__nav.find((x) => x[0] === 'artifact')[1].path), 'utf8');
  assert.ok(art.includes('https://ok.example/p') && !art.includes('javascript:') && !art.includes('forged'));
  assert.strictEqual((art.match(/https:\/\/ok\.example\/p/g) || []).length >= 1, true);
  global.__nav.length = 0;
  await ECO.exploreOpportunity(room, 'opp1', { onStep, onHalt: () => 'approve' });
  const artO = fs.readFileSync(path.join(room, global.__nav.find((x) => x[0] === 'artifact')[1].path), 'utf8');
  assert.ok(artO.includes('javascript:alert(1)'), 'orig filed the javascript: url');
});

// ---------------- eureka-enable ----------------
test('enable: argv shape, tail capture keeps the END of stderr, spawn errors surfaced, shell quoting at spawn only', async () => {
  const EN = load('new', 'eureka-enable').mod;
  const b = EN.buildEurekaInstallArgv({ prefix: '/p x', platform: 'win32', arch: 'x64' });
  assert.deepStrictEqual(b.argv.slice(0, 8), ['install', '@huggingface/transformers@^4.2.0', '--prefix', '/p x', '--os', 'win32', '--cpu', 'x64']);
  assert.strictEqual(EN.EUREKA_DEP_SPEC, '@huggingface/transformers@^4.2.0');
  // spawn is real; point PATH at nothing so npm is not found -> error surfaced, ok:false, no throw
  const prefix = path.join(tmpdir(), 'deps with space');
  const oldPath = process.env.PATH; process.env.PATH = '/nonexistent';
  let r;
  try { r = await EN.enableEureka({ prefix }); } finally { process.env.PATH = oldPath; }
  assert.strictEqual(r.ok, false);
  assert.ok(/ENOENT/.test(r.stderrTail), r.stderrTail);
  assert.ok(fs.existsSync(prefix), 'prefix created');
  const out = []; const w = process.stdout.write; process.stdout.write = (s) => { out.push(String(s)); return true; };
  let code; try { code = await EN.main(['--dry-run']); } finally { process.stdout.write = w; }
  assert.strictEqual(code, 0); assert.ok(JSON.parse(out.join('')).argv.includes('--no-audit'));
  const EO = load('orig', 'eureka-enable').mod;
  const oldPath2 = process.env.PATH; process.env.PATH = '/nonexistent';
  let ro; try { ro = await EO.enableEureka({ prefix: path.join(tmpdir(), 'd2') }); } finally { process.env.PATH = oldPath2; }
  assert.strictEqual(ro.stderrTail, '', 'orig reported an empty reason for a spawn failure');
});
test('enable: tail is the last 500 chars', async () => {
  const stubs = { 'lib/core/npm-cli-resolve.cjs': "module.exports = { resolveNpmCli: () => ({ command: process.execPath, shell: false }), buildInstallArgs: () => ['-e', 'process.stderr.write(\"HEAD\".repeat(300) + \"REAL-ERROR-LINE\"); process.exit(1)'] };" };
  const EN = load('new', 'eureka-enable', stubs).mod;
  const EO = load('orig', 'eureka-enable', stubs).mod;
  const n = await EN.enableEureka({ prefix: path.join(tmpdir(), 'd') });
  const o = await EO.enableEureka({ prefix: path.join(tmpdir(), 'd') });
  assert.ok(n.stderrTail.endsWith('REAL-ERROR-LINE') && n.stderrTail.length === 500);
  assert.ok(!o.stderrTail.includes('REAL-ERROR-LINE'), 'orig kept the head and lost the failure line');
});

// ---------------- eureka-offer ----------------
test('offer: one hedged offer from a transferable payload, null otherwise, handles inserted verbatim', () => {
  const OF = load('new', 'eureka-offer', { 'lib/brain/chain-recommender.cjs': "module.exports = { recommendFrameworkChain: () => { throw new Error('offline'); } };", 'lib/workflow/command-resolver.cjs': "module.exports = { composeWorkflow: (c) => c.map((f) => ({ framework: f, command: null, optional: true })) };" }).mod;
  const payload = { guard: { verdict: 'transferable', confidence: 'high' }, bridge: { a_handle: 'A$&node', b_handle: 'B', surprise_type: OF.DIRECTION_ENUM[0] } };
  const o = OF.composeEurekaOffer({ payload });
  assert.ok(o.text.startsWith('A$&node and B look like'));
  assert.ok(o.text.endsWith('?')); assert.strictEqual(o.confidence, 'high');
  assert.deepStrictEqual(o.next.chain, [OF.FALLBACK_SEED]);
  for (const bad of [null, {}, { guard: { verdict: 'restatement', confidence: 'high' }, bridge: payload.bridge }, { guard: payload.guard, bridge: Object.assign({}, payload.bridge, { surprise_type: 'nope' }) }]) assert.strictEqual(OF.composeEurekaOffer({ payload: bad }), null);
  assert.strictEqual(OF.composeEurekaOffer(), null);
});

// ---------------- lateral-engine-adapter ----------------
test('lateral adapter: differential is measured-finite or null; any fault degrades to all-null', async () => {
  const mk = (m, fn) => load(m, 'lateral-engine-adapter').mod.makeLateralEngine({ scoreFn: fn });
  const good = async () => ({ signed_diff: 0.2, band: 'high', direction: 'structural_transfer', provenance: { a: 1 } });
  const n = await mk('new', good).score([{ text: 'a' }, { surface: 'b' }], 's');
  assert.deepStrictEqual([n.differential_score, n.band, n.surprise_type], [0.2, 'high', 'structural_transfer']);
  const nan = async () => ({ signed_diff: NaN, direction: 'x' });
  assert.ok(Number.isNaN((await mk('orig', nan).score([{}, {}])).differential_score), 'orig forwarded NaN');
  assert.strictEqual((await mk('new', nan).score([{}, {}])).differential_score, null);
  assert.strictEqual((await mk('new', async () => ({ signed_diff: '0.4' })).score([{}, {}])).differential_score, null);
  const boom = await mk('new', async () => { throw new Error('x'); }).score(null);
  assert.deepStrictEqual(boom, { differential_score: null, band: null, surprise_type: null, provenance: null });
  assert.deepStrictEqual(await mk('new', async () => null).score([]), boom);
});

test('explore-chain: parallel pre-pass failure falls back to sequential, resets the envelope, names the reason', async () => {
  let reset = 0;
  const steps = [{ leg: 'deep_research' }, { leg: 'file_explored', material: true }];
  let first = true;
  const wrapped = () => { if (first) { first = false; throw new Error('pre-pass boom'); } return { chain_output: {}, quality: 'medium' }; };
  const r = await EC.runExploreDispatch(steps, [steps[0]], [steps[1]], {
    wrappedOnStep: wrapped, gateFn: (s) => (s.material ? 'halt' : 'run'), onHalt: () => 'defer',
    policy: { parallel: true, mode: 'cost-conscious', probeLeg: 'deep_research' }, absent: false, manual: false, offer: null,
    onSequentialFallback: () => { reset += 1; },
  });
  assert.strictEqual(reset, 1);
  assert.strictEqual(r.dispatch.mode, 'sequential'); assert.ok(r.dispatch.reason.startsWith('parallel_failed:pre-pass boom'));
  assert.strictEqual(r.run.haltedAt.step.leg, 'file_explored');
});
