#!/usr/bin/env node
'use strict';
// Phase 400.2-15: the overlap spike of the four researching hats (PS-06, risk K-11). Legs O1 to O6.
// O1-O4 test the offline overlap tool. O5 tests the preparation tool offline: it never fetches. O6 reads the spike
// record when it exists and prints a pending line when it does not.
// No leg sends a network request: a blocked network and a recording seam prove it in O5.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const OVERLAP_PATH = path.join(__dirname, 'lib-4002-hat-overlap.cjs');
const PREPARE_PATH = path.join(__dirname, 'lib-4002-spike-prepare.cjs');
const RECORD_PATH = path.join(__dirname, 'fixtures', '4002', 'spike-overlap-record.json');
const PENDING_LINE = 'spike record pending: owner run of 400.2-SPIKE-RUN.md';

let failed = 0;
let passed = 0;
const queue = [];
function check(label, fn) {
  queue.push({ label, fn });
}

const tmpRoots = [];
function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-4002-spike-' + label + '-'));
  tmpRoots.push(d);
  return d;
}
async function withEnvAsync(patch, fn) {
  const saved = {};
  for (const k of Object.keys(patch)) saved[k] = process.env[k];
  for (const k of Object.keys(patch)) { if (patch[k] === null) delete process.env[k]; else process.env[k] = patch[k]; }
  try { return await fn(); } finally {
    for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}
const NO_KEYS = { TAVILY_API_KEY: null, PATENTSVIEW_API_KEY: null };

let overlap;
let prepare;
let ops;
let door;
try {
  overlap = require(OVERLAP_PATH);
  prepare = require(PREPARE_PATH);
  ops = require(path.join(ROOT, 'lib', 'core', 'persona-ops.cjs'));
  door = require(path.join(ROOT, 'scripts', 'persona-hats.cjs'));
} catch (e) {
  console.log('FAIL: a module is missing: ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}

const PAIR_ORDER = [['white', 'black'], ['white', 'yellow'], ['white', 'green'], ['black', 'yellow'], ['black', 'green'], ['yellow', 'green']];
function urls(prefix, n) {
  const out = [];
  for (let i = 1; i <= n; i += 1) out.push('https://' + prefix + '.example.org/page/' + i);
  return out;
}
function packOf(hat, list) {
  return {
    schema: 'mos.persona-evidence/1',
    run_id: '20261125-102030-abcd',
    hat,
    research_state: list.length ? 'ran_with_results' : 'ran_empty',
    strings: [{ text: 'battery recycling x', q_hash: 'sha256:' + hat, state: 'ran_with_results', partial: false, providers: [{ provider: 'openalex', lens: 'scholarly', operation_state: 'executed_with_results', reason: null, items: list.length, cache_hit: false }] }],
    items: list.map((u, i) => ({ id: 'EvidenceClaim:persona-' + hat + '-' + i, title: 'A title about ' + hat + ' ' + i, url: u, tier: 'None', provider: 'openalex', summary: 'A summary.', retrieved_at: '', q_hash: 'sha256:' + hat })),
  };
}
function packsOf(map) {
  const out = {};
  for (const hat of Object.keys(map)) out[hat] = packOf(hat, map[hat]);
  return out;
}
function walk(value, visit, key) {
  visit(value, key);
  if (Array.isArray(value)) value.forEach((v) => walk(v, visit, null));
  else if (value && typeof value === 'object') for (const k of Object.keys(value)) walk(value[k], visit, k);
}

check('O1. pairShares: 6 pairs; 3 of 5 shared gives 0.6; no shared gives 0; an empty pack gives null and no_result', () => {
  const common = urls('common', 3);
  const packs = packsOf({
    white: common.concat(urls('w', 2)),
    black: common.concat(urls('b', 2)),
    yellow: urls('y', 5),
    green: [],
  });
  const pairs = overlap.pairShares(packs);
  assert.equal(pairs.length, 6);
  assert.deepEqual(pairs.map(p => [p.a, p.b]), PAIR_ORDER);
  const wb = pairs.find(p => p.a === 'white' && p.b === 'black');
  assert.equal(wb.shared, 3);
  assert.equal(wb.share, 0.6);
  assert.equal(wb.state, 'ok');
  const wy = pairs.find(p => p.a === 'white' && p.b === 'yellow');
  assert.equal(wy.share, 0);
  assert.equal(wy.state, 'ok');
  const wg = pairs.find(p => p.a === 'white' && p.b === 'green');
  assert.equal(wg.share, null);
  assert.equal(wg.state, 'no_result');
  // the smaller set is the divisor
  const small = overlap.pairShares(packsOf({ white: urls('c', 2), black: urls('c', 2).concat(urls('z', 3)), yellow: urls('q', 1), green: urls('r', 1) }));
  assert.equal(small.find(p => p.a === 'white' && p.b === 'black').share, 1);
  // a duplicate URL inside one pack counts once
  const dup = overlap.pairShares(packsOf({ white: urls('c', 2).concat(urls('c', 2)), black: urls('c', 2), yellow: urls('q', 1), green: urls('r', 1) }));
  assert.equal(dup.find(p => p.a === 'white' && p.b === 'black').share, 1);
});

check('O2. normaliseUrl: final slash, scheme case and host case are equal; path and query are kept', () => {
  const n = overlap.normaliseUrl;
  assert.equal(n('https://Example.ORG/a/b/'), n('HTTPS://example.org/a/b'));
  assert.equal(n('https://example.org/a/b?x=1'), n('https://EXAMPLE.org/a/b/?x=1'));
  assert.notEqual(n('https://example.org/a/b'), n('https://example.org/a/c'));
  assert.notEqual(n('https://example.org/a?x=1'), n('https://example.org/a?x=2'));
  assert.notEqual(n('https://example.org/A'), n('https://example.org/a'));
  assert.equal(n('https://example.org/'), n('https://example.org'));
});

check('O3. decision: change_needed for a 0.6 pair, pass for 0.5 or less, inconclusive for 3 no_result pairs', () => {
  const common = urls('common', 3);
  const hi = overlap.pairShares(packsOf({ white: common.concat(urls('w', 2)), black: common.concat(urls('b', 2)), yellow: urls('y', 5), green: urls('g', 5) }));
  assert.equal(overlap.decision(hi), 'change_needed');
  const edge = urls('e', 1);
  const half = overlap.pairShares(packsOf({ white: edge.concat(urls('w', 1)), black: edge.concat(urls('b', 1)), yellow: urls('y', 5), green: urls('g', 5) }));
  assert.equal(half.find(p => p.a === 'white' && p.b === 'black').share, 0.5);
  assert.equal(overlap.decision(half), 'pass');
  const none = overlap.pairShares(packsOf({ white: urls('w', 5), black: urls('b', 5), yellow: urls('y', 5), green: urls('g', 5) }));
  assert.equal(overlap.decision(none), 'pass');
  // one empty hat gives 3 no_result pairs
  const oneEmpty = overlap.pairShares(packsOf({ white: urls('w', 5), black: urls('b', 5), yellow: urls('y', 5), green: [] }));
  assert.equal(oneEmpty.filter(p => p.state === 'no_result').length, 3);
  assert.equal(overlap.decision(oneEmpty), 'inconclusive');
  // two no_result pairs are not enough for inconclusive
  const fewer = [{ state: 'no_result', share: null }, { state: 'no_result', share: null }, { state: 'ok', share: 0.1 }, { state: 'ok', share: 0.2 }, { state: 'ok', share: 0 }, { state: 'ok', share: 0 }];
  assert.equal(overlap.decision(fewer), 'pass');
  // a measured pair above 0.5 outranks missing pairs
  const mixed = [{ state: 'no_result', share: null }, { state: 'no_result', share: null }, { state: 'no_result', share: null }, { state: 'ok', share: 0.8 }, { state: 'ok', share: 0 }, { state: 'ok', share: 0 }];
  assert.equal(overlap.decision(mixed), 'change_needed');
});

check('O4. the record holds no url key, no title key and no string that starts with http', () => {
  const packs = packsOf({ white: urls('a', 5), black: urls('a', 3).concat(urls('b', 2)), yellow: urls('y', 5), green: urls('g', 5) });
  const rec = overlap.buildRecord({ date: '2026-11-25', handle: 'battery recycling', packs });
  assert.equal(rec.schema, 'mos.persona-spike-overlap/1');
  assert.equal(rec.date, '2026-11-25');
  assert.equal(rec.handle, 'battery recycling');
  assert.equal(rec.shares.length, 6);
  assert.equal(typeof rec.decision, 'string');
  assert.deepEqual(Object.keys(rec.item_counts).sort(), ['black', 'green', 'white', 'yellow']);
  assert.equal(rec.item_counts.white, 5);
  assert.deepEqual(rec.strings, { white: 'battery recycling x', black: 'battery recycling x', yellow: 'battery recycling x', green: 'battery recycling x' });
  assert.deepEqual(rec.providers.white, ['openalex']);
  assert.ok(/5/.test(rec.limit_note));
  walk(rec, (v, k) => {
    assert.ok(k !== 'url' && k !== 'title' && k !== 'urls' && k !== 'titles', 'forbidden key ' + k);
    if (typeof v === 'string') assert.ok(!/^https?:/i.test(v) && !/https?:\/\//i.test(v), 'url text in record: ' + v);
  });
});

check('O5. NEGATIVE: the preparation tool makes zero requests, stops after plan-research and writes a defer-only approved file', async () => {
  const src = fs.readFileSync(PREPARE_PATH, 'utf8');
  assert.equal((src.match(/cmdRunResearch/g) || []).length, 0, 'the preparation tool names the fetch function');
  const https = require('node:https');
  const http = require('node:http');
  const savedFetch = globalThis.fetch;
  const savedHttps = https.request;
  const savedHttp = http.request;
  let blocked = 0;
  globalThis.fetch = () => { blocked += 1; throw new Error('network blocked'); };
  https.request = () => { blocked += 1; throw new Error('network blocked'); };
  http.request = () => { blocked += 1; throw new Error('network blocked'); };
  const seamCalls = [];
  const dir = path.join(mkTmp('o5'), 'spike');
  let out;
  try {
    out = await withEnvAsync(NO_KEYS, async () => prepare.prepare({ dir }, {
      now: new Date('2026-11-25T10:20:30.000Z'),
      _fetchCorpusEnvelope: async (a) => { seamCalls.push(a); throw new Error('the seam must not be called'); },
    }));
  } finally {
    globalThis.fetch = savedFetch;
    https.request = savedHttps;
    http.request = savedHttp;
  }
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(seamCalls.length, 0);
  assert.equal(blocked, 0);
  assert.deepEqual(out.strings.map(s => s.hat), ['white', 'black', 'yellow', 'green']);
  for (const s of out.strings) {
    assert.equal(s.text, 'battery recycling ' + ops.HAT_RESEARCH_QUALIFIER[s.hat]);
    assert.ok(Array.isArray(s.providers) && s.providers.includes('openalex'), JSON.stringify(s));
  }
  // the ledger: plan_research is done, run_research is not
  const ledger = JSON.parse(fs.readFileSync(path.join(out.review_dir, 'run.json'), 'utf8'));
  assert.equal(ledger.steps.plan_research.state, 'done');
  assert.equal(ledger.steps.run_research, undefined);
  for (const hat of ['white', 'black', 'yellow', 'green']) {
    assert.equal(fs.existsSync(path.join(out.hat_dirs[hat], 'evidence.json')), false, hat + ' has an evidence pack');
  }
  // the approved template
  const approved = JSON.parse(fs.readFileSync(out.approved_path, 'utf8'));
  assert.equal(approved.schema, 'mos.persona-approved/1');
  assert.equal(approved.run_id, out.run_id);
  assert.deepEqual(Object.keys(approved.hats).sort(), ['black', 'green', 'white', 'yellow']);
  for (const hat of Object.keys(approved.hats)) assert.equal(approved.hats[hat].decision, 'defer');
  const planPath = path.join(out.scratch_root, 'plan.json');
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  assert.equal(door.validateApproved(plan, approved).ok, true);
  const flipped = JSON.parse(JSON.stringify(approved));
  for (const hat of Object.keys(flipped.hats)) flipped.hats[hat].decision = 'approve';
  assert.equal(door.validateApproved(plan, flipped).ok, true, 'a defer file turned into approve must fit the plan');
  // the printed lines
  assert.ok(out.commands.run_research.includes('run-research'));
  assert.ok(out.commands.run_research.includes('MINDRIAN_HOME='));
  assert.ok(out.commands.run_research.includes('--approved ' + out.approved_path));
  assert.equal(out.commands.collect.length, 4);
  assert.ok(out.commands.overlap.includes('lib-4002-hat-overlap.cjs'));
  assert.ok(out.commands.overlap.includes('--out tests/fixtures/4002/spike-overlap-record.json'));
  for (const s of out.strings) assert.ok(out.text.includes(s.text), 'the printed text lacks ' + s.text);
  assert.ok(out.text.includes('defer'));
  // the room fixture was copied, not changed
  assert.ok(fs.existsSync(path.join(ROOT, 'tests', 'fixtures', '4002', 'spike-room', 'STATE.md')));
  assert.equal(fs.existsSync(path.join(ROOT, 'tests', 'fixtures', '4002', 'spike-room', 'personas')), false);
  // a second call into the same directory is refused
  const again = await withEnvAsync(NO_KEYS, async () => prepare.prepare({ dir }, {}));
  assert.deepEqual(again, { ok: false, reason: 'dir_not_empty' });
});

check('O6. the spike record: a pending line without it; with a pass record the tables are spike_checked', () => {
  if (!fs.existsSync(RECORD_PATH)) {
    console.log(PENDING_LINE);
    assert.equal(ops.HAT_RESEARCH_TABLES_STATUS, 'provisional');
    return;
  }
  const rec = JSON.parse(fs.readFileSync(RECORD_PATH, 'utf8'));
  assert.equal(rec.schema, 'mos.persona-spike-overlap/1');
  assert.ok(Array.isArray(rec.shares) && rec.shares.length === 6);
  assert.ok(['pass', 'change_needed', 'inconclusive'].includes(rec.decision), 'decision ' + rec.decision);
  walk(rec, (v, k) => {
    assert.ok(k !== 'url' && k !== 'title', 'forbidden key ' + k);
    if (typeof v === 'string') assert.ok(!/https?:\/\//i.test(v), 'url text in record');
  });
  if (rec.decision === 'pass') {
    assert.equal(ops.HAT_RESEARCH_TABLES_STATUS, 'spike_checked');
  } else {
    console.log(PENDING_LINE);
    assert.equal(ops.HAT_RESEARCH_TABLES_STATUS, 'provisional');
  }
});

(async () => {
  for (const t of queue) {
    try {
      await t.fn();
      passed += 1;
      console.log('ok: ' + t.label);
    } catch (e) {
      failed += 1;
      console.log('FAIL: ' + t.label + ' -- ' + (e && e.message ? e.message : String(e)));
    }
  }
  for (const d of tmpRoots) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
