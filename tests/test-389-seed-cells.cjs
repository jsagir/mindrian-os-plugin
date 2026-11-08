#!/usr/bin/env node
'use strict';

/*
 * Phase 389 plan 03 task 1: the four Seed Test cells, the Part 8 phrase check
 * and the budget. Plain counters. No network. No live Brain call. Part 8: the
 * Brain key variables are removed and the Brain URL points at a dead loopback
 * port before any module loads, so a mistake cannot reach a real host.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SCRATCH_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-cells-'));
process.env.HOME = SCRATCH_HOME;
process.env.USERPROFILE = SCRATCH_HOME;
for (const k of ['MINDRIAN_BRAIN_KEY', 'MINDRIAN_API_KEY', 'BRAIN_API_KEY', 'TAVILY_API_KEY']) delete process.env[k];
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:1';

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass += 1; console.log('ok   ' + name); }
  else { fail += 1; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

const MODULE = path.join(REPO, 'lib/core/pyramid-seed-cells.cjs');
let cells = null;
try { cells = require(MODULE); } catch (e) { console.log('FAIL module loads :: ' + String(e && e.message).slice(0, 160)); }

const fixtures = require(path.join(REPO, 'tests/fixtures/389/sprouts.json'));
const sentences = require(path.join(REPO, 'tests/fixtures/389/sentences.json'));
const SET = fixtures['consumer-subscription'];
const SENTENCE = sentences[0].sentence;

function fakeBrain(handler) {
  const calls = [];
  return {
    calls,
    isAvailable: () => true,
    search: async (q, o) => { calls.push({ q, o }); return handler ? handler(q, o) : { text: 'Line one of answer\nline two ' + q }; },
  };
}
function fakeCorpus(envelope) {
  const calls = [];
  return { calls, fetchCorpusEnvelope: async (a) => { calls.push(a); return envelope; } };
}
const OK_ENV = { status: 'ok', payload: { results: [
  { title: 'Seed funding report', abstract: 'Investors fund early subscription brands.', id: 'https://example.test/a', source: 'tavily' },
  { title: 'Grant list', abstract: 'Small grants exist.', id: 'https://example.test/b', source: 'tavily' },
] } };
const EMPTY_ENV = { status: 'empty_valid', payload: { results: [] } };

async function main() {
  if (!cells) { console.log('test-389-seed-cells: ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); }

  // Test 1
  const ids = cells.CELL_TABLE.map((c) => c.id);
  check('Test 1: CELL_TABLE ids', JSON.stringify(ids) === JSON.stringify(['similar_cases', 'known_traps', 'analogies', 'funding']), JSON.stringify(ids));
  check('Test 1: slots', JSON.stringify(cells.CELL_TABLE.map((c) => c.slot)) === JSON.stringify(['situation', 'complication', 'analogy', 'funding']));
  check('Test 1: destinations', JSON.stringify(cells.CELL_TABLE.map((c) => c.destination)) === JSON.stringify(['brain', 'brain', 'brain', 'web']));
  check('Test 1: no dashboard_graph, no classic', !ids.some((i) => i === 'dashboard_graph' || /classic/.test(i)));
  check('Test 1: CELL_TABLE frozen', Object.isFrozen(cells.CELL_TABLE));
  check('Test 1: SLOTS', JSON.stringify(cells.SLOTS) === JSON.stringify(['situation', 'complication', 'analogy', 'funding']));

  // Test 2
  const good = cells.checkSprouts(SET, { sentence: SENTENCE });
  check('Test 2: four good phrases accepted', good.ok === true && good.present.length === 4 && good.missing.length === 0, JSON.stringify(good));
  const para = 'word '.repeat(60).trim();
  const r60 = cells.checkSprouts({ situation: para });
  check('Test 2: 60-word paragraph rejected as not_sprout', r60.ok === false && r60.rejected[0].slot === 'situation' && r60.rejected[0].class === 'not_sprout', JSON.stringify(r60));
  check('Test 2: quoted span rejected', cells.checkSprouts({ situation: 'a market of "please keep every word of this quote"' }).ok === false);
  check('Test 2: we-phrase rejected', cells.checkSprouts({ situation: 'we sell meal boxes' }).ok === false);
  check('Test 2: my-phrase rejected', cells.checkSprouts({ situation: 'my meal box idea' }).ok === false);
  check('Test 2: 13-word phrase rejected', cells.checkSprouts({ situation: 'one two three four five six seven eight nine ten eleven twelve thirteen' }).ok === false);
  check('Test 2: empty phrase rejected', cells.checkSprouts({ situation: '', funding: 'startup funding' }).ok === false);
  check('Test 2: non-string rejected', cells.checkSprouts({ situation: 42 }).ok === false && cells.checkSprouts({ situation: { a: 1 } }).ok === false);
  const shared = cells.checkSprouts({ situation: 'cook one proper dinner a week' }, { sentence: SENTENCE });
  check('Test 2: shared 4-word run rejected', shared.ok === false && shared.rejected[0].class === 'shares_sentence_run', JSON.stringify(shared));
  const partial = cells.checkSprouts({ situation: 'meal kit subscription market' });
  check('Test 2: missing slot is missing, not an error', partial.ok === true && partial.missing.length === 3 && partial.present[0] === 'situation', JSON.stringify(partial));
  check('Test 2: no slot at all rejected', cells.checkSprouts({}).ok === false && cells.checkSprouts(null).ok === false && cells.checkSprouts([]).ok === false);
  check('Test 2: unknown slot rejected', cells.checkSprouts({ situation: 'meal kit market', extra: 'startup funding' }).ok === false);
  const secret = 'ZZUNIQUEBODYTEXT '.repeat(30);
  check('Test 2: result never holds a rejected text', JSON.stringify(cells.checkSprouts({ complication: secret })).indexOf('ZZUNIQUEBODYTEXT') === -1);

  // Test 3
  {
    const brain = fakeBrain();
    const built = cells.buildCells(SET, { brain, corpus: fakeCorpus(OK_ENV) });
    for (const c of built) await c.fn({ sentence_sha256: 'x' }, new AbortController().signal);
    const byQ = {};
    brain.calls.forEach((c) => { byQ[c.q] = c.o; });
    check('Test 3: three Brain calls', brain.calls.length === 3, String(brain.calls.length));
    check('Test 3: situation phrase with topK 3', byQ[SET.situation] && byQ[SET.situation].topK === 3 && Object.keys(byQ[SET.situation]).length === 1);
    check('Test 3: complication phrase with topK 3', byQ[SET.complication] && byQ[SET.complication].topK === 3);
    check('Test 3: analogy phrase with topK 2', byQ[SET.analogy] && byQ[SET.analogy].topK === 2);
    const allQ = brain.calls.map((c) => c.q);
    check('Test 3: no other string in any call', allQ.every((q) => [SET.situation, SET.complication, SET.analogy].indexOf(q) !== -1) && JSON.stringify(brain.calls).indexOf(SENTENCE.slice(0, 20)) === -1);
  }

  // Test 4
  {
    const sig = new AbortController().signal;
    const one = (ans) => {
      const b = fakeBrain(() => ans);
      return cells.buildCells({ situation: SET.situation }, { brain: b, corpus: fakeCorpus(EMPTY_ENV) })[0].fn({ sentence_sha256: 'x' }, sig);
    };
    const blocked = await one({ error: 'egress_blocked', tool: 'brain_search' });
    check('Test 4: egress_blocked is empty with reason', blocked.status === 'empty' && blocked.payload.reason === 'egress_blocked', JSON.stringify(blocked));
    const sprouts = await one({ error: 'sprouts_required' });
    check('Test 4: sprouts_required is empty with reason', sprouts.status === 'empty' && sprouts.payload.reason === 'sprouts_required');
    const withErrAndText = await one({ error: 'tier_denied', text: 'looks like an answer' });
    check('Test 4: error key never ok even with text', withErrAndText.status === 'empty');
    const long = 'First line here\n' + 'x'.repeat(2000);
    const okr = await one({ text: long });
    check('Test 4: text becomes ok', okr.status === 'ok');
    check('Test 4: summary_line one line <=160', okr.payload.summary_line === 'First line here' && okr.payload.summary_line.indexOf('\n') === -1);
    check('Test 4: excerpt <=600', typeof okr.payload.excerpt === 'string' && okr.payload.excerpt.length <= 600 && okr.payload.excerpt.length > 100);
    check('Test 4: source label', typeof okr.payload.source === 'string' && okr.payload.source.length > 0);
    const longLine = await one({ text: 'y'.repeat(500) });
    check('Test 4: summary_line capped at 160', longLine.payload.summary_line.length <= 160);
    const non = await one('a plain string');
    check('Test 4: non-object answer is empty', non.status === 'empty');
    const nul = await one(null);
    check('Test 4: null answer is empty', nul.status === 'empty');
  }

  // Test 5
  {
    const b = { calls: 0, isAvailable: () => false, search: async () => { b.calls += 1; return { text: 'x' }; } };
    const t0 = Date.now();
    const r = await cells.buildCells({ situation: SET.situation }, { brain: b, corpus: fakeCorpus(EMPTY_ENV) })[0].fn({ sentence_sha256: 'x' }, new AbortController().signal);
    check('Test 5: unavailable Brain is empty brain_unavailable fast', r.status === 'empty' && r.payload.reason === 'brain_unavailable' && Date.now() - t0 < 100);
    check('Test 5: search never called', b.calls === 0);
  }

  // Test 6
  {
    const sig = new AbortController().signal;
    const corpus = fakeCorpus(OK_ENV);
    const fund = cells.buildCells({ funding: SET.funding }, { brain: fakeBrain(), corpus })[0];
    const r = await fund.fn({ sentence_sha256: 'x' }, sig);
    check('Test 6: fetchCorpusEnvelope called once with source tavily, phrase, limit 3', corpus.calls.length === 1 && JSON.stringify(corpus.calls[0]) === JSON.stringify({ source: 'tavily', query: SET.funding, limit: 3 }), JSON.stringify(corpus.calls));
    check('Test 6: filled envelope is ok with titles', r.status === 'ok' && r.payload.titles.length === 2 && r.payload.titles[0] === 'Seed funding report', JSON.stringify(r));
    check('Test 6: funding excerpt capped and labeled', r.payload.excerpt.length <= 600 && /tavily/i.test(r.payload.source));
    const e = await cells.buildCells({ funding: SET.funding }, { brain: fakeBrain(), corpus: fakeCorpus(EMPTY_ENV) })[0].fn({ sentence_sha256: 'x' }, sig);
    check('Test 6: empty envelope is empty', e.status === 'empty');
    const blk = await cells.buildCells({ funding: SET.funding }, { brain: fakeBrain(), corpus: fakeCorpus({ status: 'blocked', failure_class: 'missing_credential', payload: {} }) })[0].fn({ sentence_sha256: 'x' }, sig);
    check('Test 6: blocked envelope is empty with its class', blk.status === 'empty' && blk.payload.reason === 'missing_credential', JSON.stringify(blk));
    const thr = await cells.buildCells({ funding: SET.funding }, { brain: fakeBrain(), corpus: { fetchCorpusEnvelope: async () => { throw new Error('boom'); } } })[0].fn({ sentence_sha256: 'x' }, sig);
    check('Test 6: thrown corpus error is empty', thr.status === 'empty');
  }

  // Test 7
  {
    const built = cells.buildCells({ funding: SET.funding, analogy: SET.analogy }, { brain: fakeBrain(), corpus: fakeCorpus(EMPTY_ENV) });
    check('Test 7: only slots with a phrase build a cell', JSON.stringify(built.map((c) => c.id).sort()) === JSON.stringify(['analogies', 'funding']));
    check('Test 7: nothing for an empty set', cells.buildCells({}, { brain: fakeBrain(), corpus: fakeCorpus(EMPTY_ENV) }).length === 0);
  }

  // Test 8
  {
    const { dispatchToArray } = require(path.join(REPO, 'lib/core/mva-dispatcher.cjs'));
    const hang = fakeBrain((q) => (q === SET.situation ? new Promise(() => {}) : { text: 'answer ' + q }));
    const built = cells.buildCells(SET, { brain: hang, corpus: fakeCorpus(OK_ENV) });
    const t0 = Date.now();
    const res = await dispatchToArray(built, 'hash', { globalBudgetMs: 50 });
    const by = {}; res.forEach((r) => { by[r.agent_id] = r.status; });
    check('Test 8: hung cell times out, siblings ok, under 1000 ms', by.similar_cases === 'timeout' && by.known_traps === 'ok' && by.analogies === 'ok' && by.funding === 'ok' && Date.now() - t0 < 1000, JSON.stringify(by) + ' ' + (Date.now() - t0));
    const thrower = fakeBrain((q) => { if (q === SET.situation) throw new Error('x'); return { text: 'a ' + q }; });
    const res2 = await dispatchToArray(cells.buildCells(SET, { brain: thrower, corpus: fakeCorpus(OK_ENV) }), 'hash', { globalBudgetMs: 2000 });
    const by2 = {}; res2.forEach((r) => { by2[r.agent_id] = r.status; });
    check('Test 8: a throwing cell leaves siblings ok', by2.similar_cases === 'error' && by2.known_traps === 'ok' && by2.funding === 'ok', JSON.stringify(by2));
    const allBad = fakeBrain(() => { throw new Error('x'); });
    let threw = false; let res3 = null;
    try { res3 = await dispatchToArray(cells.buildCells(SET, { brain: allBad, corpus: { fetchCorpusEnvelope: async () => { throw new Error('y'); } } }), 'hash', { globalBudgetMs: 2000 }); } catch (_e) { threw = true; }
    check('Test 8: all-fail returns an array and does not throw', !threw && Array.isArray(res3) && res3.length === 4);
  }

  // Test 9
  {
    const src = fs.readFileSync(MODULE, 'utf8');
    check('Test 9: no room-db require', !/require\([^)]*room-db/.test(src));
    check('Test 9: no timer started by the module', !/setTimeout|setInterval/.test(src));
    check('Test 9: no stdout or stderr write', !/process\.std(out|err)|console\./.test(src));
    check('Test 9: no em dash or en dash', !/[\u2013\u2014]/.test(src));
    check('Test 9: no dashboard_graph or brain_classic_traps cell', !/brain_classic_traps/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')) && ids.indexOf('dashboard_graph') === -1);
    const t = fs.readFileSync(__filename, 'utf8');
    check('Test 9: this test holds no em dash or en dash', !/[\u2013\u2014]/.test(t));
  }

  console.log('test-389-seed-cells: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.log('FAIL uncaught :: ' + String(e && e.stack).slice(0, 300)); process.exit(1); });
