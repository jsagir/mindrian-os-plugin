'use strict';
// CLI tests for rs-fetch, rs-experts, rs-explain, rs-thesis command scripts.
// The scripts are run as child processes inside a temp tree with HAND-MADE
// stubs for the engine, translator, graph and Brain modules. No network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { stage } = require('./_harness.cjs');

const root = stage([
  'rs-fetch/scripts/rs-fetch-command.cjs', 'rs-experts/scripts/rs-experts-command.cjs',
  'rs-explain/scripts/rs-explain-command.cjs', 'rs-thesis/scripts/rs-thesis-command.cjs',
]);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-cmd-fixtures-'));
function writeJson(name, obj) { const p = path.join(tmp, name); fs.writeFileSync(p, JSON.stringify(obj)); return p; }
function run(script, args, env) {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', script)].concat(args), {
    env: Object.assign({}, process.env, { MINDRIAN_ROOM: tmp }, env || {}), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

// ---------------------------------------------------------------- rs-fetch
const fetchMod = require(path.join(root, 'scripts/rs-fetch-command.cjs'));
const BUNDLE = {
  state: 'ready', domain_analysis: { primary_domain: 'energy' },
  fetched_results: {
    academic: { papers: [{}, {}], telemetry: [{ source: 'openalex', status: 'ok' }, { source: 'scopus', status: 'api_key_missing' }, { source: 'arxiv', status: 'rate_limited' }, { source: 'arxiv', status: 'ok' }] },
    patents: { patents: [], telemetry: [{ source: 'uspto', status: 'api_error' }] },
    industry: { signals: [{}], telemetry: [{ source: 'tavily', status: 'ok' }] }, experts: [{}],
  },
  preprocessed: [1], classified: [1, 2], breakthroughs: [1], theses: [1], chain_metadata: [], output: { written: { tier: 'tier0', id: 'x' } },
};

test('rs-fetch parseArgs: flags, missing values, unknown options, multi-word topic', () => {
  assert.equal(fetchMod.parseArgs(['n', 's', 'quantum', 'brain', 'imaging']).topic, 'quantum brain imaging');
  const bad = fetchMod.parseArgs(['n', 's', 't', '--stage']);
  assert.deepEqual(bad.errors, ['--stage needs a value']);
  assert.equal(bad.topic, 't');
  assert.deepEqual(fetchMod.parseArgs(['n', 's', '--bogus', 't']).errors, ['unknown option --bogus']);
  const ok = fetchMod.parseArgs(['n', 's', 't', '--problem-type', 'IDP', '--stage', 'x', '--json']);
  assert.deepEqual([ok.problemType, ok.stage, ok.json, ok.errors.length], ['IDP', 'x', true, 0]);
  assert.deepEqual(fetchMod.parseArgs(['n', 's', '--problem-type', '--json']).errors, ['--problem-type needs a value']);
});

test('rs-fetch: summarizeFetcherHealth ignores sources that answered on another query', () => {
  const h = fetchMod.summarizeFetcherHealth(BUNDLE.fetched_results);
  assert.deepEqual(h.map((x) => x.source + ':' + x.status).sort(), ['academic/scopus:api_key_missing', 'patents/uspto:api_error']);
  assert.deepEqual(fetchMod.summarizeFetcherHealth(undefined), []);
});

test('rs-fetch CLI: transcript shows DEGRADED and failing sources; healthy shows OK', () => {
  const r = run('rs-fetch-command.cjs', ['energy storage'], { RS_TEST_BUNDLE: writeJson('b1.json', BUNDLE) });
  assert.equal(r.code, 0);
  assert.match(r.out, /Phase 1\.5 Fetchers\s+DEGRADED\s+academic=2 patents=0 industry=1 experts=1/);
  assert.match(r.out, /academic\/scopus\s+api_key_missing/);
  assert.match(r.out, /treat gaps as unknown/);
  const healthy = JSON.parse(JSON.stringify(BUNDLE)); healthy.fetched_results.academic.telemetry = [{ source: 'openalex', status: 'ok' }]; healthy.fetched_results.patents.telemetry = [];
  const r2 = run('rs-fetch-command.cjs', ['x'], { RS_TEST_BUNDLE: writeJson('b2.json', healthy) });
  assert.match(r2.out, /Phase 1\.5 Fetchers\s+OK\s/);
  assert.ok(!/Sources without data/.test(r2.out));
});

test('rs-fetch CLI: pause state, --json large payload not truncated, errors and exit codes', () => {
  const pause = run('rs-fetch-command.cjs', ['t'], { RS_TEST_BUNDLE: writeJson('p.json', { state: 'pause', missing_upstream: ['jtbd'], suggested_action: 'Run jtbd' }) });
  assert.equal(pause.code, 0); assert.match(pause.out, /PAUSED/); assert.match(pause.out, /jtbd/);
  const big = JSON.parse(JSON.stringify(BUNDLE)); big.blob = 'x'.repeat(3 * 1024 * 1024);
  const j = run('rs-fetch-command.cjs', ['t', '--json'], { RS_TEST_BUNDLE: writeJson('big.json', big) });
  assert.equal(j.code, 0);
  assert.equal(JSON.parse(j.out).blob.length, 3 * 1024 * 1024, 'piped JSON must arrive complete');
  assert.equal(JSON.parse(j.out)._opts.room_dir, tmp);
  assert.equal(run('rs-fetch-command.cjs', []).code, 1);
  assert.equal(run('rs-fetch-command.cjs', ['t', '--nope']).code, 1);
  assert.match(run('rs-fetch-command.cjs', ['t', '--nope']).err, /unknown option --nope/);
  const eg = run('rs-fetch-command.cjs', ['t'], { RS_TEST_THROW: 'egress' });
  assert.equal(eg.code, 1); assert.match(eg.err, /Canon Part 8 audit failed/);
  assert.equal(run('rs-fetch-command.cjs', ['t'], { RS_TEST_THROW: 'boom' }).code, 1);
  assert.equal(run('rs-fetch-command.cjs', ['--help']).code, 0);
});

// -------------------------------------------------------------- rs-experts
const expMod = require(path.join(root, 'scripts/rs-experts-command.cjs'));

test('rs-experts CLI: always the honest AURA_TRANSPORT_ABSENT path; --limit validated', () => {
  const r = run('rs-experts-command.cjs', ['fintech KYC', '--json', '--limit', '7']);
  assert.equal(r.code, 0);
  const j = JSON.parse(r.out);
  assert.equal(j.refusal_code, 'AURA_TRANSPORT_ABSENT'); assert.equal(j.limit, 7); assert.equal(j.topic, 'fintech KYC'); assert.ok(j.generated_at);
  assert.equal('authors' in j, false, 'omit-never-null: no authors key on a refusal');
  const t = run('rs-experts-command.cjs', ['fintech KYC']);
  assert.equal(t.code, 0); assert.match(t.err, /Expert transport not available/);
  for (const bad of [['t', '--limit', '0'], ['t', '--limit', 'abc'], ['t', '--limit', '5000'], ['t', '--limit'], ['t', '--zzz'], []]) {
    assert.equal(run('rs-experts-command.cjs', bad).code, 1, JSON.stringify(bad));
  }
  assert.equal(expMod.parseArgs(['n', 's', 'quantum', 'brain', '--limit', '3']).topic, 'quantum brain');
  assert.equal(run('rs-experts-command.cjs', ['meeting_transcript stuff']).code, 1);
});

test('rs-experts resolveExpertTier: limit passed and enforced; empty is success; outage vs query bug', async () => {
  let seen;
  const rows = Array.from({ length: 40 }, (_, i) => ({ name: 'A' + i }));
  const r = await expMod.resolveExpertTier('t', { limit: 10, _transport: async (topic, o) => { seen = o; return rows; } });
  assert.deepEqual(seen, { limit: 10 }); assert.equal(r.authors.length, 10); assert.equal(r.matched, 10); assert.equal(r.tier, 'tier1');
  const e = await expMod.resolveExpertTier('t', { _transport: async () => [] });
  assert.deepEqual(e, { tier: 'tier1', authors: [], matched: 0 });
  const u = await expMod.resolveExpertTier('t', { _transport: async () => { throw new Error('ECONNREFUSED'); } });
  assert.equal(u.refusal_code, 'BRAIN_UNREACHABLE'); assert.equal('authors' in u, false);
  const q = await expMod.resolveExpertTier('t', { _transport: async () => { throw new Error('Invalid input near MATCH'); } });
  assert.equal(q.refusal_code, 'AURA_QUERY_FAILED');
});

test('rs-experts renderTranscript: Conf column only when confidence present', () => {
  const cap = (fn) => { const w = process.stdout.write; let s = ''; process.stdout.write = (x) => { s += x; return true; }; try { fn(); } finally { process.stdout.write = w; } return s; };
  const withConf = cap(() => expMod.renderTranscript('t', [{ name: 'Ann', institutions: ['MIT'], paper_count: 3, score: 1.5, confidence: 0.93 }]));
  assert.match(withConf, /Score {2}Conf/); assert.match(withConf, /0\.93/); assert.match(withConf, /identity confidence/);
  const without = cap(() => expMod.renderTranscript('t', [{ name: 'Ann', institutions: [], paper_count: 3, score: 1.5 }]));
  assert.ok(!/Conf/.test(without));
});

// -------------------------------------------------------------- rs-explain
const expl = require(path.join(root, 'scripts/rs-explain-command.cjs'));
const NLB = (o) => writeJson('nl' + Math.random().toString(16).slice(2) + '.json', Object.assign({ sql: 'SELECT * FROM rs_discoveries', sql_params: [], cypher: 'MATCH (n) RETURN n', cypher_params: { q: 'x' }, brain_query: null }, o));
const rowsFx = (n, extra) => writeJson('fx' + Math.random().toString(16).slice(2) + '.json', { rows: Array.from({ length: n }, (_, i) => Object.assign({ id: 'r' + i, thesis: 't' + i, breakthrough_score: 0, rs_type: 'x' }, extra || {})) });

test('rs-explain isReadOnlySql', () => {
  const ok = ['SELECT 1', 'select * from t where a = ?', 'WITH x AS (SELECT 1) SELECT * FROM x', 'SELECT 1;', 'SELECT created_at, updated_at FROM t -- trailing comment'];
  const no = ['DROP TABLE t', 'SELECT 1; DROP TABLE t', 'INSERT INTO t VALUES (1)', 'UPDATE t SET a=1', '', null, 'PRAGMA table_info(t)', 'SELECT 1 /* x */; DELETE FROM t', 'WITH x AS (SELECT 1) DELETE FROM t'];
  for (const s of ok) assert.equal(expl.isReadOnlySql(s), true, s);
  for (const s of no) assert.equal(expl.isReadOnlySql(s), false, String(s));
});

test('rs-explain CLI: sources provenance, tiers, --no-cypher, zero score preserved', () => {
  const env = { RS_TEST_NL_BUNDLE: NLB(), RS_TEST_FIXTURE: rowsFx(2), RS_TEST_BRAIN: '1' };
  const r = run('rs-explain-command.cjs', ['what is up', '--json'], env);
  assert.equal(r.code, 0);
  const j = JSON.parse(r.out);
  const byGraph = Object.fromEntries(j.query_results.sources.map((s) => [s.graph, s]));
  assert.equal(byGraph.room_db.status, 'ok'); assert.equal(byGraph.room_db.rows, 2);
  assert.equal(byGraph.aura_cypher.status, 'ok'); assert.equal(byGraph.aura_cypher.rows, 1);
  assert.equal(j.query_results.n, 3);
  assert.equal(j.query_results.top_score, 0, 'a score of 0 must not become null');
  const t0 = JSON.parse(run('rs-explain-command.cjs', ['q', '--json', '--tier', 'tier0'], env).out);
  assert.equal(t0.query_results.sources.find((s) => s.graph === 'aura_cypher').status, 'skipped_by_option');
  const nc = JSON.parse(run('rs-explain-command.cjs', ['q', '--json', '--no-cypher'], env).out);
  assert.equal(nc.query_results.sources.find((s) => s.graph === 'aura_cypher').status, 'skipped_by_option');
  assert.equal(nc.query_results.n, 2);
  const nb = JSON.parse(run('rs-explain-command.cjs', ['q', '--json'], Object.assign({}, env, { RS_TEST_BRAIN: '0' })).out);
  assert.equal(nb.query_results.sources.find((s) => s.graph === 'aura_cypher').status, 'unavailable');
  const tr = run('rs-explain-command.cjs', ['q'], env);
  assert.match(tr.out, /Graphs: room_db=ok\(2\)  aura_cypher=ok\(1\)/);
});

test('rs-explain CLI: unsafe SQL refused, row cap, joined question, bad args', () => {
  const evil = JSON.parse(run('rs-explain-command.cjs', ['q', '--json'], { RS_TEST_NL_BUNDLE: NLB({ sql: 'SELECT 1; DROP TABLE nodes', cypher: null }), RS_TEST_FIXTURE: rowsFx(3) }).out);
  assert.match(evil.query_results._sql_error, /refused/); assert.equal(evil.query_results.n, 0);
  assert.equal(evil.query_results.sources[0].status, 'refused');
  const cap = JSON.parse(run('rs-explain-command.cjs', ['q', '--json'], { RS_TEST_NL_BUNDLE: NLB({ cypher: null }), RS_TEST_FIXTURE: rowsFx(700) }).out);
  assert.equal(cap.query_results.rows.length, 500); assert.equal(cap.query_results._truncated, true);
  const multi = JSON.parse(run('rs-explain-command.cjs', ['show', 'me', 'gaps', '--json'], { RS_TEST_NL_BUNDLE: NLB({ cypher: null }), RS_TEST_FIXTURE: rowsFx(1) }).out);
  assert.equal(multi.nl_query, 'show me gaps'); assert.equal(multi.query_bundle._nl_seen, 'show me gaps');
  for (const bad of [['q', '--tier', 'tier9'], ['q', '--tier'], ['q', '--wat'], []]) assert.equal(run('rs-explain-command.cjs', bad).code, 1, JSON.stringify(bad));
  const eg = run('rs-explain-command.cjs', ['has meeting_transcript'], { RS_TEST_NL_BUNDLE: NLB() });
  assert.equal(eg.code, 1); assert.match(eg.err, /Canon Part 8/);
  assert.deepEqual(expl.parseArgs(['n', 's', 'q', '--tier', 'TIER0']).tier, 'tier0');
});

test('rs-explain: SQL error is reported in sources, not thrown', () => {
  const r = JSON.parse(run('rs-explain-command.cjs', ['q', '--json'], { RS_TEST_NL_BUNDLE: NLB({ cypher: null }), RS_TEST_FIXTURE: writeJson('thr.json', { throw: 'disk I/O error' }) }).out);
  assert.equal(r.query_results.sources[0].status, 'error'); assert.match(r.query_results._sql_error, /disk I\/O/);
});

// --------------------------------------------------------------- rs-thesis
const thMod = require(path.join(root, 'scripts/rs-thesis-command.cjs'));
const ROW = { id: 'rs_disc_1', thesis: 'By applying A to B, achieve C.', rs_type: 'structural', breakthrough_score: 8, room_slug: 'fintech', created_at: '2026-03-01' };

test('rs-thesis CLI: lookup, optional evidence columns, tier1 note, not found, bad args', () => {
  const plain = JSON.parse(run('rs-thesis-command.cjs', ['rs_disc_1', '--json'], { RS_TEST_FIXTURE: writeJson('t1.json', { rows: [ROW] }) }).out);
  assert.equal(plain.thesis, ROW.thesis); assert.equal(plain.tier, 'tier0'); assert.equal('confidence' in plain.meta, false);
  assert.equal(plain.provenance.source, 'room.db:rs_discoveries'); assert.equal(plain.tier_note, null);
  const rich = Object.assign({}, ROW, { confidence: '0.62', evidence: JSON.stringify([{ source_id: 'W1' }]), confidence_basis: 'not json', novelty_check_status: 'passed' });
  const fx = writeJson('t2.json', { rows: [rich] });
  const j = JSON.parse(run('rs-thesis-command.cjs', ['rs_disc_1', '--json', '--tier', 'tier1'], { RS_TEST_FIXTURE: fx }).out);
  assert.equal(j.meta.confidence, 0.62); assert.deepEqual(j.meta.evidence, [{ source_id: 'W1' }]); assert.equal(j.meta.confidence_basis, null);
  assert.match(j.tier_note, /tier1 was requested/);
  const txt = run('rs-thesis-command.cjs', ['rs_disc_1'], { RS_TEST_FIXTURE: fx });
  assert.match(txt.out, /confidence\s+0\.62/); assert.match(txt.out, /evidence\s+1 source/); assert.ok(!/no recorded evidence/.test(txt.out));
  const noEv = run('rs-thesis-command.cjs', ['rs_disc_1'], { RS_TEST_FIXTURE: writeJson('t3.json', { rows: [Object.assign({}, ROW, { confidence: 0.3, evidence: null })] }) });
  assert.match(noEv.out, /no recorded evidence trail/);
  const nf = run('rs-thesis-command.cjs', ['missing'], { RS_TEST_FIXTURE: fx });
  assert.equal(nf.code, 1); assert.match(nf.err, /local room\.db/); assert.ok(!/either backend/.test(nf.err));
  const down = run('rs-thesis-command.cjs', ['rs_disc_1'], { RS_TEST_FIXTURE: writeJson('t4.json', { throw: 'no such table' }) });
  assert.equal(down.code, 2); assert.match(down.err, /Local read failed/);
  for (const bad of [['a', 'b'], ['a', '--tier', 'x'], ['a', '--zip'], []]) assert.equal(run('rs-thesis-command.cjs', bad, { RS_TEST_FIXTURE: fx }).code, 1, JSON.stringify(bad));
  assert.match(run('rs-thesis-command.cjs', ['--help']).out, /never sent to the remote Brain/);
  assert.equal(thMod.parseOptionalColumn('evidence', '[1]').length, 1);
});
