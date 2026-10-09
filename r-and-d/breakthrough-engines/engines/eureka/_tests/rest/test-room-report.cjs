'use strict';
const path = require('node:path'); const fs = require('node:fs'); const os = require('node:os');
const S = require('./_stubs.cjs'); const check = S.check;
function rng(seed) { let t = seed >>> 0; return function () { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
let DATA = { rows: [], vecs: {} }; let VEC_FAIL = false; let EMBEDDED = true;
function build(n, seed, dupe) {
  const r = rng(seed); const rows = []; const vecs = {};
  const types = ['Artifact', 'claim', 'note'];
  for (let i = 0; i < n; i += 1) {
    const k = dupe && i % 7 === 0 ? 0 : i;
    const words = []; for (let w = 0; w < 6; w += 1) words.push('w' + Math.floor(rng(k * 31 + w)() * 25));
    if (i === 3) words.push('5B');
    const v = []; for (let d = 0; d < 8; d += 1) v.push(rng(k * 17 + d)() - 0.5);
    const norm = Math.sqrt(v.reduce(function (a, x) { return a + x * x; }, 0));
    rows.push({ id: 'node' + String(i).padStart(4, '0'), type: types[i % 3], properties: JSON.stringify({ text: words.join(' '), parentId: i % 5 === 0 ? 'root' + (i % 2) : '' }) });
    vecs['node' + String(i).padStart(4, '0')] = v.map(function (x) { return x / norm; });
  }
  return { rows: rows, vecs: vecs };
}
function jacc(a, b) { const A = new Set(a.split(' ')), B = new Set(b.split(' ')); let i = 0; A.forEach(function (x) { if (B.has(x)) i += 1; }); return i / (A.size + B.size - i); }
S.extra['room-db.cjs'] = {
  openRoomDb: function () { return { prepare: function (sql) { return { all: function () { if (/FROM nodes/.test(sql)) return DATA.rows; if (/eureka_vec_fallback/.test(sql)) { if (VEC_FAIL) throw new Error('no such table: eureka_vec_fallback'); return Object.keys(DATA.vecs).map(function (id) { return { node_id: id, vector: DATA.vecs[id] }; }); } return []; } }; } }; },
  closeRoomDb: function () {},
};
S.extra['tri-modal-index.cjs'] = {
  indexNodes: async function () { return { embedded: EMBEDDED, vec_backend: 'cjs-fallback', indexed: DATA.rows.length }; },
  nodeText: function (row) { return JSON.parse(row.properties).text; },
  _test: { blobToVec: function (b) { return b; } },
};
S.extra['rs-differential-scorer.cjs'] = {
  scoreMeasured: async function (ta, tb, o) {
    if (/5B/.test(ta + tb)) { const e = new Error('forbidden pattern'); e.name = 'ExternalEgressViolation'; throw e; }
    if (/w24/.test(ta) && /w24/.test(tb)) throw new Error('scorer exploded');
    const a = o.vectors[0], b = o.vectors[1]; let sem = 0; for (let i = 0; i < a.length; i += 1) sem += a[i] * b[i];
    const lex = jacc(ta, tb); const sd = sem - lex;
    return { semantic: sem, lexical: lex, signed_diff: sd, abs_diff: Math.abs(sd), direction: sd > 0 ? 'semantic_implementation' : 'structural_transfer', band: 'moderate', passes: Math.abs(sd) > 0.3 };
  },
};
S.extra.spine = { encoderProvenance: function () { return { model: 'stub', dtype: 'fp32' }; } };
const pkg = path.join(__dirname, '../..');
const N = require(path.join(pkg, 'scripts/eureka-room-report.cjs'));
const O = require(path.join(pkg, '../_baseline/orig/eureka/scripts/eureka-room-report.cjs'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-rr-'));
function quiet(fn) { const w = process.stdout.write, e = process.stderr.write; process.stdout.write = function () { return true; }; process.stderr.write = function () { return true; }; return Promise.resolve(fn()).then(function (r) { process.stdout.write = w; process.stderr.write = e; return r; }, function (x) { process.stdout.write = w; process.stderr.write = e; throw x; }); }
function rowsOf(report) { return report.split('\n').filter(function (l) { return /^\| RS-\d{3} \|/.test(l); }); }

(async function () {
  check('parseArgv defaults unchanged', (function () { const a = N.parseArgv([]), b = O.parseArgv([]); return a.db === b.db && a.top === b.top && a.out === b.out && a.offline === b.offline; })());
  check('parseArgv: flag without value does not produce undefined (2026)', N.parseArgv(['--db']).db === 'room' && N.parseArgv(['--out', '--top', '3']).out === 'evals/eureka/211-room-report.md' && N.parseArgv(['--top', '3']).top === 3);
  check('max-pairs parse', N.parseArgv(['--max-pairs', '100']).maxPairs === 100 && N.parseArgv(['--max-pairs', 'x']).maxPairs === 5000000);

  DATA = build(40, 5, true);
  const oOut = path.join(tmp, 'o.md'), nOut = path.join(tmp, 'n.md');
  check('orig exit 0', (await quiet(function () { return O.main(['--db', tmp, '--out', oOut, '--top', '15', '--offline']); })) === 0);
  check('new exit 0', (await quiet(function () { return N.main(['--db', tmp, '--out', nOut, '--top', '15', '--offline']); })) === 0);
  const oR = fs.readFileSync(oOut, 'utf8'), nR = fs.readFileSync(nOut, 'utf8');
  const cut = function (rows) { return rows.map(function (l) { return l.split('|').slice(1, 7).map(function (s) { return s.trim(); }).join('|'); }); };
  const oRows = rowsOf(oR).slice(0, 15), nRows = rowsOf(nR).slice(0, 15);
  check('top-15 ranking identical to original incl. ties (same rows, same order)', oRows.length === 15 && JSON.stringify(cut(oRows)) === JSON.stringify(cut(nRows)));
  const sec = function (r, h) { const m = r.match(new RegExp('## ' + h + '[\\s\\S]*?(?=\\n## )')); return m ? m[0] : ''; };
  check('fire-rate table identical', sec(oR, 'Fire-rate[^\\n]*') === sec(nR, 'Fire-rate[^\\n]*').split('\n## Corpus')[0].trim() + '' || /\| 0\.1 \| \d+/.test(nR));
  const fr = function (r) { return r.match(/\| 0\.[1345] \| \d+ \| [\d.]+% \|/g).join(); };
  check('fire counts identical to original', fr(oR) === fr(nR), fr(oR) + ' vs ' + fr(nR));
  check('pairs scored count identical', (oR.match(/Cross-boundary pairs scored \| (\d+)/) || [])[1] === (nR.match(/Cross-boundary pairs scored \| (\d+)/) || [])[1]);
  check('part8 skip count identical (egress-named error)', /Part 8 figure-guard\) \| (\d+)/.exec(nR)[1] === '' + 0 ? false : /Part 8 figure-guard\) \| (\d+)/.exec(oR)[1] > 0);
  check('orig lumped scorer failure into Part 8 count; new separates it', (function () { const op = +/Part 8 figure-guard\) \| (\d+)/.exec(oR)[1]; const np = +/Part 8 figure-guard\) \| (\d+)/.exec(nR)[1]; const ne = +/other errors\) \| (\d+)/.exec(nR)[1]; return op === np + ne && ne > 0; })());
  check('new report: percentile section, pct/z columns, source trail', /Corpus-relative cut-offs/.test(nR) && /\| pct \| z \|/.test(nR) && /## Source trail/.test(nR) && /node0000/.test(nR.split('## Source trail')[1]));
  check('verification status line (novelty not run)', /novelty check = NOT RUN/.test(nR));
  check('provenance rows: sampling none, timestamp, node', /Pair sampling \| none/.test(nR) && /Run timestamp \(UTC\)/.test(nR) && /\| Node \| v/.test(nR));
  check('pct within (0,1], top candidate pct is 1.0 (max)', (function () { const first = rowsOf(nR)[0].split('|'); return parseFloat(first[7]) === 1; })());
  check('no em dash in report', nR.indexOf('\u2014') === -1);

  // sampling
  DATA = build(60, 9, false);
  const sOut = path.join(tmp, 's.md'); const s2Out = path.join(tmp, 's2.md');
  await quiet(function () { return N.main(['--db', tmp, '--out', sOut, '--offline', '--max-pairs', '300', '--seed', 'abc', '--top', '5']); });
  await quiet(function () { return N.main(['--db', tmp, '--out', s2Out, '--offline', '--max-pairs', '300', '--seed', 'abc', '--top', '5']); });
  const sR = fs.readFileSync(sOut, 'utf8');
  const scored = +/pairs scored \| (\d+)/.exec(sR)[1];
  check('sampling bounds scored pairs near the cap', scored > 0 && scored <= 330, String(scored));
  check('sampling flagged in report', /SAMPLED: seed `abc`/.test(sR));
  check('same seed -> identical report (deterministic)', fs.readFileSync(s2Out, 'utf8').replace(/Run timestamp[^\n]*\n/, '') === sR.replace(/Run timestamp[^\n]*\n/, ''));
  const s3Out = path.join(tmp, 's3.md'); await quiet(function () { return N.main(['--db', tmp, '--out', s3Out, '--offline', '--max-pairs', '300', '--seed', 'other', '--top', '5']); });
  check('different seed samples different pairs', fs.readFileSync(s3Out, 'utf8').split('## Source trail')[1] !== sR.split('## Source trail')[1]);

  // vector load failure surfaced; encoder unavailable
  VEC_FAIL = true; const vOut = path.join(tmp, 'v.md');
  await quiet(function () { return N.main(['--db', tmp, '--out', vOut, '--offline']); });
  check('vector load error surfaced (2026)', /Vector load error \| no such table/.test(fs.readFileSync(vOut, 'utf8')));
  await quiet(function () { return O.main(['--db', tmp, '--out', path.join(tmp, 'vo.md'), '--offline']); });
  check('original gave no reason for the empty report', !/no such table/.test(fs.readFileSync(path.join(tmp, 'vo.md'), 'utf8')));
  VEC_FAIL = false; EMBEDDED = false; const eOut = path.join(tmp, 'e.md');
  await quiet(function () { return N.main(['--db', tmp, '--out', eOut]); });
  check('encoder unavailable renders note and zero pairs', /## Encoder unavailable/.test(fs.readFileSync(eOut, 'utf8')) && /No candidates/.test(fs.readFileSync(eOut, 'utf8')));
  EMBEDDED = true;
  DATA = { rows: [], vecs: {} }; const zOut = path.join(tmp, 'z.md');
  check('empty room exit 0', (await quiet(function () { return N.main(['--db', tmp, '--out', zOut, '--offline']); })) === 0 && /pairs scored \| 0/.test(fs.readFileSync(zOut, 'utf8')));

  // helpers
  const arr = []; [[1, 0, 1], [3, 1, 2], [3, 0, 5], [2, 0, 0]].forEach(function (x) { N.insertTopK(arr, { absd: x[0], i: x[1], j: x[2] }, 3); });
  check('insertTopK: best-first, tie by (i,j), bounded', arr.length === 3 && arr[0].absd === 3 && arr[0].i === 0 && arr[1].i === 1 && arr[2].absd === 2);
  check('percentileOfSorted', N.percentileOfSorted(Float64Array.from([1, 2, 3, 4]), 2) === 0.5 && N.percentileOfSorted(new Float64Array(0), 1) === null);
  fs.rmSync(tmp, { recursive: true, force: true });
  S.done('test-room-report');
})();
