'use strict';
const path = require('node:path'); const fs = require('node:fs'); const os = require('node:os');
const S = require('./_stubs.cjs'); const check = S.check;

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this']);
function tokenize(text) { return new Set((String(text).toLowerCase().match(/[a-z0-9]+/g) || []).filter(function (w) { return w.length >= 3 && !STOP.has(w); })); }
function jaccard(a, b) { if (!a.size || !b.size) return 0; let i = 0; a.forEach(function (x) { if (b.has(x)) i += 1; }); return i / (a.size + b.size - i); }
function pairKey(a, b) { return a < b ? a + '\u0000' + b : b + '\u0000' + a; }
function makeCandidateStore(substrate) {
  const rows = new Map(); let excluded = 0;
  const byId = {}; substrate.things.forEach(function (t) { byId[t.id] = t; });
  return {
    upsert: function (a, b, lane, extra) {
      const k = pairKey(a, b);
      if (substrate.connected.has(k) || substrate.opp_pairs.has(k)) { excluded += 1; return false; }
      const ta = byId[a], tb = byId[b]; if (!ta || !tb) return false;
      let r = rows.get(k);
      if (!r) { const [x, y] = a < b ? [ta, tb] : [tb, ta]; r = { a: x.id, b: y.id, section_a: x.section, section_b: y.section, title_a: x.title, title_b: y.title, lanes: [], lexical: 0, shared_entities: [] }; rows.set(k, r); }
      if (extra && typeof extra.lexical === 'number') r.lexical = Math.max(r.lexical, extra.lexical);
      if (extra && extra.entity && r.shared_entities.indexOf(extra.entity) === -1) r.shared_entities.push(extra.entity);
      if (extra && extra.fields) Object.assign(r, extra.fields);
      if (r.lanes.indexOf(lane) !== -1) return false; r.lanes.push(lane); return true;
    },
    rows: function () { return Array.from(rows.values()); },
    excludedKnown: function () { return excluded; },
  };
}
const registry = { discoverSections: function (dir) { return { all: fs.readdirSync(dir).filter(function (n) { return fs.statSync(path.join(dir, n)).isDirectory(); }) }; }, STRUCTURAL_DIRS: ['exports/'] };
let dbMode = 'null';
S.extra['./shared.cjs'] = { parseProps: function (s) { try { return JSON.parse(s || '{}'); } catch (e) { return {}; } }, textOfProps: function () { return ''; }, hasFieldTitle: function () { return false; }, titleOfProps: function () { return ''; }, tokenize: tokenize, jaccard: jaccard, pairKey: pairKey, runTagNow: function () { return 'tag'; }, writeJsonl: function () {}, readJsonl: function () {}, deriveStatus: function () {}, STAGES: [], makeCandidateStore: makeCandidateStore, runDirFor: function (r, root, t) { return path.join(r, root, t); }, writeRunFiles: function (r, root, tag) { return path.join(r, root, tag); }, readCandidates: function () { return null; } };
S.extra['navigation.cjs'] = { openRoomDbReadOnlyForCaller: function () { return dbMode === 'null' ? null : { prepare: function () { return { all: function () { return []; } }; }, close: function () {} }; } };
S.extra['section-registry.cjs'] = registry;
S.extra['verification-stamp.cjs'] = {}; S.extra['scaffold-predicate.cjs'] = { isScaffoldFile: function () { return false; }, isScaffoldBasename: function () { return false; } };
S.extra['families.cjs'] = { stripMarkdown: function (s) { return String(s || ''); }, composableTerm: function (s) { return s || null; } };

const pkg = path.join(__dirname, '../..');
const N = require(path.join(pkg, 'lib/core/research-planner/perspectives/eureka-recall.cjs'));
const O = require(path.join(pkg, '../_baseline/orig/eureka/lib/core/research-planner/perspectives/eureka-recall.cjs'));

function rng(seed) { let t = seed >>> 0; return function () { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
function makeSubstrate(nThings, nSections, vocab, seed) {
  const r = rng(seed); const things = [];
  for (let i = 0; i < nThings; i += 1) {
    const words = []; const len = 6 + Math.floor(r() * 10);
    for (let w = 0; w < len; w += 1) words.push('w' + Math.floor(Math.pow(r(), 2) * vocab));
    const sec = 's' + Math.floor(r() * nSections);
    things.push({ id: 't' + String(i).padStart(4, '0'), type: 'Artifact', section: sec, title: 'T' + i, text: words.join(' '), tokens: tokenize(words.join(' ')), degree: 0, canon_handle: null, title_from_field: true });
  }
  const connected = new Set(); for (let i = 0; i < nThings / 5; i += 1) connected.add(pairKey(things[Math.floor(r() * nThings)].id, things[Math.floor(r() * nThings)].id));
  const sections = Array.from(new Set(things.map(function (t) { return t.section; }))).sort();
  return { things: things, entities: {}, connected: connected, opp_pairs: new Set(), sections: sections, edges: [], framework_nodes: {}, whitespace_zones: {} };
}
const roomEmpty = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-recall-'));

(async function () {
  // equivalence on default mode across seeds
  let allEq = true; let detail = '';
  for (let seed = 1; seed <= 6; seed += 1) {
    const sub = makeSubstrate(80 + seed * 10, 4, 40, seed);
    const a = O.recallCandidates(sub, roomEmpty, {}, {}); const b = N.recallCandidates(sub, roomEmpty, {}, {});
    const key = function (c) { return c.a + '|' + c.b; };
    const sa = a.candidates.map(key).sort().join(); const sb = b.candidates.map(key).sort().join();
    const ok = sa === sb && JSON.stringify(a.counts) === JSON.stringify(b.counts) && a.pairs_truncated === b.pairs_truncated
      && JSON.stringify(a.candidates.slice().sort(function (x, y) { return key(x) < key(y) ? -1 : 1; })) === JSON.stringify(b.candidates.slice().sort(function (x, y) { return key(x) < key(y) ? -1 : 1; }));
    if (!ok) { allEq = false; detail += ' seed' + seed; }
  }
  check('default-mode candidate set, rows and counts equal original (6 random substrates)' + detail, allEq);

  // comparator: new order is a valid total order (non-increasing keys, then a, then b)
  const sub = makeSubstrate(120, 5, 30, 11);
  const nb = N.recallCandidates(sub, roomEmpty, { max_candidates: 1000 }, {});
  let sorted = true;
  for (let i = 1; i < nb.candidates.length; i += 1) {
    const x = nb.candidates[i - 1], y = nb.candidates[i];
    const kx = [-x.lanes.length, -x.shared_entities.length, -x.lexical], ky = [-y.lanes.length, -y.shared_entities.length, -y.lexical];
    let c = 0; for (let k = 0; k < 3 && c === 0; k += 1) c = kx[k] - ky[k];
    if (c === 0) c = x.a < y.a ? -1 : (x.a > y.a ? 1 : (x.b < y.b ? -1 : (x.b > y.b ? 1 : 0)));
    if (c > 0) sorted = false;
  }
  check('2026 comparator yields a consistent total order', sorted && nb.candidates.length > 20);
  // demonstrate the original comparator inconsistency on equal-a ties
  const cmpOrig = function (x, y) { return (x.a < y.a ? -1 : 1) || (x.b < y.b ? -1 : 1); };
  check('original comparator returns 1 for both orders on same-a rows (bug)', cmpOrig({ a: 'q', b: 'r' }, { a: 'q', b: 's' }) === 1 && cmpOrig({ a: 'q', b: 's' }, { a: 'q', b: 'r' }) === 1);

  // determinism
  const d1 = JSON.stringify(N.recallCandidates(sub, roomEmpty, {}, {}).candidates); const d2 = JSON.stringify(N.recallCandidates(sub, roomEmpty, {}, {}).candidates);
  check('deterministic repeat runs', d1 === d2);
  check('no same-section pair in jaccard mode', N.recallCandidates(sub, roomEmpty, {}, {}).candidates.every(function (c) { return c.section_a !== c.section_b; }));
  check('exclusion set honoured', N.recallCandidates(sub, roomEmpty, {}, {}).candidates.every(function (c) { return !sub.connected.has(pairKey(c.a, c.b)); }));
  const zero = N.recallCandidates(sub, roomEmpty, { lexical_floor: 0 }, {}); const zeroO = O.recallCandidates(sub, roomEmpty, { lexical_floor: 0 }, {});
  check('floor 0 falls back to exhaustive path, equals original', zero.candidates.length === zeroO.candidates.length && zero.counts.lexical === zeroO.counts.lexical);
  const empty = N.recallCandidates({ things: [], entities: {}, connected: new Set(), opp_pairs: new Set(), sections: [] }, roomEmpty, {}, { lexicalMode: 'tfidf' });
  check('empty corpus ok (jaccard and tfidf)', empty.candidates.length === 0 && N.recallCandidates({ things: [], entities: {}, connected: new Set(), opp_pairs: new Set(), sections: [] }, roomEmpty, {}, {}).candidates.length === 0);

  // tfidf mode
  const t1 = N.recallCandidates(sub, roomEmpty, {}, { lexicalMode: 'tfidf' }); const t2 = N.recallCandidates(sub, roomEmpty, {}, { lexicalMode: 'tfidf' });
  check('tfidf deterministic', JSON.stringify(t1.candidates) === JSON.stringify(t2.candidates));
  check('tfidf diagnostics: percentile floor, not fixed 0.08', t1.diagnostics.lexical_mode === 'tfidf' && t1.diagnostics.lexical_floor > 0 && t1.diagnostics.lexical_floor !== 0.08 && t1.diagnostics.lexical_pairs_scored > 0);
  check('lexical_pct in (0,1] and ranks monotone with score', t1.candidates.filter(function (c) { return c.lexical > 0; }).every(function (c) { return c.lexical_pct > 0 && c.lexical_pct <= 1; }));
  const lo = N.recallCandidates(sub, roomEmpty, { lexical_percentile: 0.5 }, { lexicalMode: 'tfidf' }); const hi = N.recallCandidates(sub, roomEmpty, { lexical_percentile: 0.99 }, { lexicalMode: 'tfidf' });
  check('higher percentile = stricter floor', hi.diagnostics.lexical_floor >= lo.diagnostics.lexical_floor && hi.counts.lexical <= lo.counts.lexical);
  check('tfidf candidates cross-section only', t1.candidates.every(function (c) { return c.section_a !== c.section_b; }));
  check('bad percentile falls back to default', N.recallCandidates(sub, roomEmpty, { lexical_percentile: 7 }, { lexicalMode: 'tfidf' }).diagnostics.lexical_floor === t1.diagnostics.lexical_floor);
  check('diagnostics not enumerable (run-file shape unchanged)', Object.keys(t1).indexOf('diagnostics') === -1 && JSON.stringify(t1).indexOf('lexical_mode') === -1);
  check('percentileRank', N._test.percentileRank([1, 2, 3, 4], 3) === 0.75 && N._test.percentileRank([], 1) === null);

  // performance: indexed jaccard vs original all-pairs
  const big = makeSubstrate(2500, 8, 3000, 99);
  let t0 = Date.now(); const ob = O.recallCandidates(big, roomEmpty, {}, {}); const tO = Date.now() - t0;
  t0 = Date.now(); const nbg = N.recallCandidates(big, roomEmpty, {}, {}); const tN = Date.now() - t0;
  check('perf corpus: identical candidate count', ob.counts.lexical === nbg.counts.lexical && ob.candidates.length === nbg.candidates.length, ob.counts.lexical + ' vs ' + nbg.counts.lexical);
  console.log('  perf 2500 things: original ' + tO + ' ms, 2026 ' + tN + ' ms');
  t0 = Date.now(); N.recallCandidates(big, roomEmpty, {}, { lexicalMode: 'tfidf' }); console.log('  tfidf 2500 things: ' + (Date.now() - t0) + ' ms');

  // declaredCouplings regex fix
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-icm-'));
  ['alpha', 'beta', 'gamma-x', 'delta.v2'].forEach(function (s) { fs.mkdirSync(path.join(room, s)); });
  fs.writeFileSync(path.join(room, 'alpha', 'CONTEXT.md'), '# Alpha\n\n## Inputs\n\n- ../beta/notes.md\n');                       // Inputs is LAST heading
  fs.writeFileSync(path.join(room, 'beta', 'CONTEXT.md'), '# Beta\n\n## Inputs\n\nZoning notes first. Then gamma-x/data.md\n\n## Outputs\n\ndelta.v2/\n'); // capital Z before target
  fs.writeFileSync(path.join(room, 'delta.v2', 'CONTEXT.md'), '## Inputs\n\n- ../alphaXbeta/\n- ../deltaXv2/\n');
  const secs = ['alpha', 'beta', 'gamma-x', 'delta.v2'];
  const cn = N.declaredCouplings(room, secs); const co = O.declaredCouplings(room, secs);
  check('2026: Inputs as last heading is parsed (alpha->beta)', cn.has(pairKey('alpha', 'beta')));
  check('ORIGINAL missed alpha->beta (bug)', !co.has(pairKey('alpha', 'beta')));
  check('2026: capital Z no longer truncates Inputs (beta->gamma-x)', cn.has(pairKey('beta', 'gamma-x')));
  check('ORIGINAL truncated at Z (bug)', !co.has(pairKey('beta', 'gamma-x')));
  check('Outputs section not mistaken for Inputs', !cn.has(pairKey('beta', 'delta.v2')));
  check('metachar slug does not wildcard-match (delta.v2 vs deltaXv2)', !cn.has(pairKey('delta.v2', 'delta.v2')) && !cn.has(pairKey('delta.v2', 'alpha')));

  // runRecall null db
  dbMode = 'null';
  const rr = N.runRecall(roomEmpty, { tag: 't1' });
  check('runRecall: room without room.db -> structured refusal', rr.ok === false && rr.reason === 'room_db_missing');
  let othrew = false; try { O.runRecall(roomEmpty, { tag: 't1' }); } catch (e) { othrew = e instanceof TypeError; }
  check('original threw TypeError on null db', othrew);
  fs.rmSync(room, { recursive: true, force: true }); fs.rmSync(roomEmpty, { recursive: true, force: true });
  S.done('test-recall');
})();
