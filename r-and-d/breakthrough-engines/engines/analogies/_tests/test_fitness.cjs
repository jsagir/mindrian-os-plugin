'use strict';
// Run: node analogies/_tests/test_fitness.cjs   (from package-2026; builds a temp sandbox, never touches research/)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const PKG = path.resolve(__dirname, '..');            // package-2026/analogies
const ORIG = path.resolve(PKG, '..', '_baseline', 'orig', 'analogies');

let pass = 0; let fail = 0;
function ok(cond, name) { if (cond) { pass += 1; console.log('PASS ' + name); } else { fail += 1; console.log('FAIL ' + name); } }
function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), name + (JSON.stringify(a) === JSON.stringify(b) ? '' : ' got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b))); }

// ---- sandbox: stub spine + stub online composer, real shipped files copied in ----
function build(srcRoot, tag) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ana-' + tag + '-'));
  const lib = path.join(root, 'lib/core/semantic-index'); fs.mkdirSync(lib, { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(srcRoot, 'lib/core/semantic-index/analogy-fitness.cjs'), path.join(lib, 'analogy-fitness.cjs'));
  fs.copyFileSync(path.join(srcRoot, 'scripts/analogy-fitness-report.cjs'), path.join(root, 'scripts/analogy-fitness-report.cjs'));
  fs.writeFileSync(path.join(lib, 'embedding-spine.cjs'), `
'use strict';
const DIM = 64;
function tok(t){ return String(t).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); }
function h(w){ let x=0; for (let i=0;i<w.length;i++) x=(x*131+w.charCodeAt(i))%DIM; return x; }
function bow(t){ const v=new Array(DIM).fill(0); tok(t).forEach(w=>{v[h(w)]+=1;}); return v; }
async function embedTexts(texts, opts){
  if (process.env.ANA_TEST_NO_ENCODER === '1') return { success:false, reason:'encoder_unavailable' };
  const enc = (opts && opts.encodeFn) || (ts => ts.map(bow));
  return { success:true, vectors: enc(texts), provenance:{ model:'test-bow', dim: DIM } };
}
function cosineSimilarity(a,b){ let d=0,na=0,nb=0; for(let i=0;i<a.length;i++){d+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];} return na&&nb ? d/Math.sqrt(na*nb) : NaN; }
module.exports = { embedTexts, cosineSimilarity };
`);
  fs.writeFileSync(path.join(lib, 'online-pattern-query.cjs'), `'use strict'; module.exports = { composePatternQueries: p => ({ ok: true, audited: 1, echo: p }) };`);
  return root;
}
const NEW = build(PKG, 'new');
const OLD = build(ORIG, 'old');
const F = require(path.join(NEW, 'lib/core/semantic-index/analogy-fitness.cjs'));
const FO = require(path.join(OLD, 'lib/core/semantic-index/analogy-fitness.cjs'));
const L = F.SAPPHIRE_LAYERS;

function enc(prefix, n, shared) {
  const o = {};
  L.forEach((l, i) => { o[l] = i < n ? shared + ' ' + l + ' alpha' : prefix + ' ' + l + ' zzz' + i; });
  return o;
}

(async () => {
  // 1 bandFromLayers
  const all = {}; L.forEach(l => { all[l] = 0.9; });
  eq(F.bandFromLayers(all, 0.5).band, 'deep', 'bandFromLayers all layers -> deep');
  eq(F.bandFromLayers(Object.assign({}, all, { parts: 0.1 }), 0.5).band, 'structural', 'bandFromLayers no parts -> structural');
  eq(F.bandFromLayers({ state_change: 0.9, action: 0.9, phenomenon: 0.9 }, 0.5).band, 'behavioral', 'bandFromLayers behavioral');
  eq(F.bandFromLayers({ state_change: 0.9 }, 0.5).band, 'surface', 'bandFromLayers surface');
  eq(F.bandFromLayers({ action: 0.9 }, 0.5).band, 'none', 'bandFromLayers anchor missing -> none');
  eq(F.bandFromLayers(null, 0.5).band, 'none', 'bandFromLayers null layers safe');
  eq(F.bandFromLayers({ state_change: 0.4 }, { state_change: 0.3 }).band, 'surface', 'bandFromLayers per-layer map');

  // 2 stats
  eq(F.empiricalPercentile([1, 2, 3, 4], 3), 0.625, 'percentile mid-rank');
  eq(F.empiricalPercentile([], 3), 0, 'percentile empty corpus = 0');
  eq(F.zScore([5, 5, 5], 5), 0, 'z zero variance = 0 (no NaN)');
  eq(F.zScore([1], 1), 0, 'z single value = 0');
  ok(Math.abs(F.zScore([1, 2, 3], 3) - 1.224744871) < 1e-6, 'z population std');
  eq(F.quantile([1, 2, 3, 4, 5], 0.75), 4, 'quantile 0.75');
  ok(Number.isNaN(F.quantile([], 0.5)), 'quantile empty = NaN (caller guards)');

  // 3 regression vs original: single pair identical
  const src = { text: 'regulate timing of re-exposure to counter decay', sapphire: enc('a', 7, 'shared') };
  const cand = { text: 'regulate timing of drug dosing to counter decay', sapphire: enc('b', 5, 'shared') };
  const r1 = await F.scoreAnalogyFitness(src, cand);
  const r0 = await FO.scoreAnalogyFitness(src, cand);
  eq([r1.fused, r1.structural.band, r1.restatementFlag], [r0.fused, r0.structural.band, r0.restatementFlag], 'scoreAnalogyFitness unchanged vs original');

  // 4 batch
  const cands = [];
  for (let i = 0; i < 8; i += 1) cands.push({ id: 'c' + i, domain: 'd' + i, text: 'text number ' + i + (i < 4 ? ' regulate timing decay' : ''), sapphire: enc('c' + i, i, 'shared') });
  const fixed = await F.scoreCandidates(src, cands, { thresholdMode: 'fixed' });
  ok(fixed.success && fixed.mode === 'fixed', 'scoreCandidates fixed mode flagged as fixed');
  const legacyRows = [];
  for (const c of cands) legacyRows.push(await FO.scoreAnalogyFitness(src, c));
  eq(fixed.results.map(r => [r.structural.band, r.fused]), legacyRows.map(r => [r.structural.band, r.fused]), 'fixed mode equals legacy per candidate');
  const pa = await F.scoreCandidates(src, cands, {});
  const pb = await F.scoreCandidates(src, cands, {});
  ok(pa.mode === 'percentile' && pa.n === 8, 'scoreCandidates percentile mode with n=8');
  const strip = x => JSON.stringify(x.results.map(r => [r.structural.band, r.fused, r.percentile, r.z]));
  eq(strip(pa), strip(pb), 'percentile scoring deterministic across runs');
  ok(Object.values(pa.scoring.layer_thresholds).every(t => t >= 0.3 && t <= 0.9), 'derived thresholds within [abs floor, 0.9]');
  ok(pa.results.every(r => r.percentile.fused >= 0 && r.percentile.fused <= 1), 'percentiles in [0,1]');
  const small = await F.scoreCandidates(src, cands.slice(0, 3), {});
  ok(small.mode === 'fixed' && /minCorpus/.test(small.scoring.note), 'small corpus falls back to fixed with note');
  const empty = await F.scoreCandidates(src, [], {});
  ok(empty.success && empty.n === 0 && empty.results.length === 0, 'empty corpus safe');
  const mixed = await F.scoreCandidates(src, [null, cands[0], 'x'], {});
  ok(mixed.success && mixed.results.length === 3, 'null/garbage candidates do not throw');

  // 5 restatement + rank
  const para = { id: 'para', domain: 'x', text: src.text, sapphire: { state_change: 'zq1', action: 'zq2' } };
  const thin1 = { id: 'thin1', domain: 'x', text: 'unrelated words entirely', sapphire: { state_change: 'zq3' } };
  const lone = [para, thin1];
  const rs = await F.scoreCandidates(src, lone, { thresholdMode: 'fixed' });
  ok(rs.results[0].restatementFlag === true, 'paraphrase with disjoint structure is flagged (fixed)');
  const legacyOrder = F.rankCandidates(rs.results, { legacy: true });
  const newOrder = F.rankCandidates(rs.results);
  ok(legacyOrder[0]._id === 'para', 'legacy order lets the restatement lead (documents the 2025 bug)');
  ok(newOrder[0].restatementFlag !== true, 'restatement never Rank 1 when a non-restatement exists');
  const onlyFlag = F.rankCandidates([rs.results[0]]);
  eq(onlyFlag.length, 1, 'single flagged candidate kept');
  eq(F.rankCandidates(null), [], 'rankCandidates(null) = []');

  // 6 degrade
  process.env.ANA_TEST_NO_ENCODER = '1';
  const d1 = await F.scoreAnalogyFitness(src, cand);
  eq([d1.success, d1.degrade], [false, 'qualitative-only'], 'encoder down degrades, no numbers');
  const d2 = await F.scoreCandidates(src, cands, {});
  eq([d2.success, d2.degrade, 'fused' in d2], [false, 'qualitative-only', false], 'batch degrade has no numeric fields');
  delete process.env.ANA_TEST_NO_ENCODER;

  // 7 empty text guard
  const t0 = await F.textFitness('', '');
  ok(t0.success && t0.score === 0, 'empty texts score 0, not NaN');

  // 8 CLI
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ana-cli-'));
  const inp = path.join(tmp, 'in.json');
  fs.writeFileSync(inp, JSON.stringify({ source: src, candidates: cands }));
  function run(root, args) { return cp.spawnSync('node', [path.join(root, 'scripts/analogy-fitness-report.cjs')].concat(args), { encoding: 'utf8' }); }
  const c1 = run(NEW, ['score', inp, '--stub-encoder']);
  ok(c1.status === 0 && /"rows"/.test(c1.stdout), 'CLI score --stub-encoder exit 0 with rows');
  const rep = JSON.parse(c1.stdout.slice(0, c1.stdout.indexOf('\n\n| Rank')));
  ok(rep.rows.length === 8 && rep.scoring && rep.generated_at && rep.rows[0].source_trail, 'report has rows, scoring, generated_at, source_trail');
  ok(/Pctile/.test(c1.stdout), 'matrix shows percentile column');
  const c2 = run(NEW, ['score', inp, '--stub-encoder', '--rank-mode', 'fixed']);
  ok(c2.status === 0 && /threshold mode: fixed/.test(c2.stdout), 'CLI --rank-mode fixed');
  const c3 = run(NEW, ['score', path.join(tmp, 'missing.json')]);
  ok(c3.status === 1 && /bad_input/.test(c3.stdout), 'CLI missing file -> bad_input exit 1');
  const c4 = run(NEW, ['score', inp, '--out']);
  ok(c4.status === 1 && /out_requires_path/.test(c4.stdout), 'CLI --out without path rejected');
  const outf = path.join(tmp, 'sub', 'rep.json');
  const c5 = run(NEW, ['score', inp, '--stub-encoder', '--out', outf]);
  ok(c5.status === 0 && fs.existsSync(outf), 'CLI --out writes report');
  const c6 = run(NEW, ['score', inp, '--stub-encoder', '--max-candidates', '3']);
  ok(c6.status === 0 && /"candidates_truncated": 5/.test(c6.stdout), 'CLI --max-candidates truncation reported');
  const pat = path.join(tmp, 'pat.json'); fs.writeFileSync(pat, JSON.stringify({ functionalKeywords: ['a'] }));
  const c7 = run(NEW, ['compose-queries', pat]);
  ok(c7.status === 0 && /"ok":true/.test(c7.stdout), 'CLI compose-queries passes through');
  const c8 = run(NEW, ['nonsense']);
  ok(c8.status === 1, 'CLI unknown mode exit 1');
  const o1 = run(OLD, ['score', inp, '--stub-encoder']);
  ok(o1.status === 0, 'original CLI also runs in sandbox (baseline)');
  const oldRep = JSON.parse(o1.stdout.slice(0, o1.stdout.indexOf('\n\n| Rank')));
  const keysOld = Object.keys(oldRep.rows[0]); const keysNew = Object.keys(rep.rows[0]);
  ok(keysOld.every(k => keysNew.includes(k)) && Object.keys(oldRep).every(k => k in rep), 'new report keeps every original key');

  // 9 style
  for (const f of [path.join(PKG, 'lib/core/semantic-index/analogy-fitness.cjs'), path.join(PKG, 'scripts/analogy-fitness-report.cjs')]) {
    ok(!/—|–/.test(fs.readFileSync(f, 'utf8')), 'no em/en-dash in ' + path.basename(f));
  }
  console.log('RESULT pass=' + pass + ' fail=' + fail);
  process.exitCode = fail ? 1 : 0;
})();
