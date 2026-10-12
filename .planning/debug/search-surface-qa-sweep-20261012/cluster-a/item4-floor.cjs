'use strict';
// Item 4: does the word-tier floor (min(2, words) distinct words AND idf_share >= 0.55) separate
// positives from negatives on a second room (motj-ecosystem)? Read-only on the room. No network, no Brain call.
// Usage: node item4-floor.cjs 1 | node item4-floor.cjs 2 | node item4-floor.cjs compare
// Cases live in private/cases-motj.json (room paths and question text, not for commit).
const fs = require('node:fs');
const path = require('node:path');
const C = require('./common.cjs');
const { I } = C;

const mode = process.argv[2] || '1';
const ROOM = C.ROOMS['motj-ecosystem'];
const casesFile = path.join(__dirname, 'private/cases-motj.json');
const spec = JSON.parse(fs.readFileSync(casesFile, 'utf8'));
const FLOOR_W = I.SEARCH_FLOOR_MIN_WORDS; const FLOOR_S = I.SEARCH_FLOOR_MIN_IDF_SHARE;

const uniq = (a) => [...new Set(a)];
function envelope(q, o) {
  const e = { room_dir: ROOM, query: q, tier: o.tier, results: o.results };
  if (o.tier !== 'phrase') e.words = o.words;
  if (o.reason_code) { e.reason_code = o.reason_code; e.reason = o.reason; }
  return e;
}
const passes = (e, n) => e.words_matched >= Math.min(FLOOR_W, n) && e.idf_share >= FLOOR_S;

function evalQuery(q, target) {
  const o = I.searchRoomDetailed(ROOM, q, null);
  const files = uniq(o.results.map((r) => r.file));
  const rank = target ? (files.slice(0, 5).indexOf(target) + 1 || null) : null;
  const words = I.queryWords(q);
  const scored = I.scoreWordTier(ROOM, ROOM, words); // unfloored, for the analysis (the product runs it only after a phrase miss)
  const tgt = target ? scored.find((s) => s.file === target) : null;
  const best = scored[0] || null;
  const bestPassing = scored.filter((s) => passes(s, words.length))[0] || null;
  return {
    tier: o.tier, reason_code: o.reason_code || null, n_results: o.results.length, n_files: files.length, rank_top5: rank,
    payload_tokens_proxy: C.tok(JSON.stringify(o.results.slice(0, 50), null, 2)),
    envelope_tokens_proxy: C.tok(JSON.stringify(envelope(q, o), null, 2)),
    query_words: words.length,
    unfloored_files_with_any_word: scored.length,
    target_words_matched: tgt ? tgt.words_matched : null, target_idf_share: tgt ? +tgt.idf_share.toFixed(3) : null,
    target_passes_floor: tgt ? passes(tgt, words.length) : null,
    target_unfloored_rank: tgt ? scored.indexOf(tgt) + 1 : null,
    best_words_matched: best ? best.words_matched : null, best_idf_share: best ? +best.idf_share.toFixed(3) : null,
    best_is_target: best && target ? best.file === target : null,
    best_passes_floor: best ? passes(best, words.length) : null,
    top5_files: files.slice(0, 5),
    any_file_passes_floor: !!bestPassing,
  };
}

if (mode === 'compare') {
  const a = JSON.parse(fs.readFileSync(path.join(__dirname, 'private/item4-run1.json'), 'utf8'));
  const b = JSON.parse(fs.readFileSync(path.join(__dirname, 'private/item4-run2.json'), 'utf8'));
  let moved = 0; let cmp = 0;
  const strip = (r) => JSON.stringify({ ...r });
  for (const k of ['positives', 'negatives']) {
    a[k].forEach((r, i) => {
      for (const f of ['nl', 'kw']) {
        if (!r[f]) continue; cmp++;
        const x = r[f]; const y = b[k][i][f];
        const same = x.rank_top5 === y.rank_top5 && x.tier === y.tier && x.n_results === y.n_results && JSON.stringify(x.top5_files) === JSON.stringify(y.top5_files) && x.target_idf_share === y.target_idf_share && x.best_idf_share === y.best_idf_share;
        if (!same) { moved++; console.log('DIFF', r.id || r.q_sha, f); }
      }
    });
  }
  console.log('compare: ' + cmp + ' query results compared (rank, tier, count, top5 files, idf shares), ' + moved + ' differ');
  void strip;
  process.exit(0);
}

const out = { run: mode, ran: new Date().toISOString(), room: 'motj-ecosystem', floor: { min_words: FLOOR_W, min_idf_share: FLOOR_S }, positives: [], negatives: [] };
for (const c of spec.cases) out.positives.push({ id: c.id, set: c.set, target_sha8: C.sha8(c.target), nl: evalQuery(c.nl, c.target), kw: evalQuery(c.kw, c.target) });
spec.negatives.forEach((q, i) => { out.negatives.push({ id: 'N' + (i + 1), q_sha: C.sha8(q), nl: evalQuery(q, null) }); });

// separation analysis
const nlPos = out.positives.map((p) => ({ id: p.id, set: p.set, ...p.nl }));
const posShares = nlPos.map((p) => p.target_idf_share).filter((x) => x !== null);
const negShares = out.negatives.map((n) => n.nl.best_idf_share).filter((x) => x !== null);
out.separation = {
  nl_positives: nlPos.length, nl_positives_with_target_in_word_scores: posShares.length,
  min_positive_target_idf_share: Math.min(...posShares), max_negative_best_idf_share: Math.max(...negShares),
  min_positive_target_words_matched: Math.min(...nlPos.map((p) => p.target_words_matched).filter((x) => x !== null)),
  max_negative_best_words_matched: Math.max(...out.negatives.map((n) => n.nl.best_words_matched || 0)),
  positives_target_fails_floor: nlPos.filter((p) => p.target_passes_floor === false).map((p) => p.id),
  positives_empty_result: nlPos.filter((p) => p.n_results === 0).map((p) => p.id),
  negatives_with_results: out.negatives.filter((n) => n.nl.n_results > 0).map((n) => n.id),
  negatives_empty_with_floor_reason: out.negatives.filter((n) => n.nl.n_results === 0 && n.nl.reason_code === 'below_relevance_floor').map((n) => n.id),
  rank_top5_nl: nlPos.filter((p) => p.rank_top5 !== null).length, rank1_nl: nlPos.filter((p) => p.rank_top5 === 1).length,
  rank_top5_kw: out.positives.filter((p) => p.kw.rank_top5 !== null).length, rank1_kw: out.positives.filter((p) => p.kw.rank_top5 === 1).length,
};
for (const s of ['A', 'B']) {
  const set = out.positives.filter((p) => p.set === s);
  out.separation['set_' + s] = {
    n: set.length, nl_top5: set.filter((p) => p.nl.rank_top5 !== null).length, nl_top1: set.filter((p) => p.nl.rank_top5 === 1).length,
    kw_top5: set.filter((p) => p.kw.rank_top5 !== null).length, kw_top1: set.filter((p) => p.kw.rank_top5 === 1).length,
    nl_median_payload_tokens_proxy: C.med(set.map((p) => p.nl.payload_tokens_proxy)), kw_median_payload_tokens_proxy: C.med(set.map((p) => p.kw.payload_tokens_proxy)),
    min_target_idf_share: Math.min(...set.map((p) => p.nl.target_idf_share).filter((x) => x !== null)),
  };
}
fs.writeFileSync(path.join(__dirname, 'private/item4-run' + mode + '.json'), JSON.stringify(out, null, 1));
console.log('run ' + mode + ' separation: ' + JSON.stringify(out.separation, null, 1));
console.table(out.positives.map((p) => ({ id: p.id, nl_tier: p.nl.tier, nl_rank: p.nl.rank_top5, nl_n: p.nl.n_results, nl_tok: p.nl.payload_tokens_proxy, nl_words: p.nl.target_words_matched + '/' + p.nl.query_words, nl_tgt_share: p.nl.target_idf_share, nl_best_share: p.nl.best_idf_share, nl_tgt_pass: p.nl.target_passes_floor, kw_tier: p.kw.tier, kw_rank: p.kw.rank_top5, kw_n: p.kw.n_results, kw_tok: p.kw.payload_tokens_proxy, kw_tgt_share: p.kw.target_idf_share })));
console.table(out.negatives.map((n) => ({ id: n.id, words: n.nl.query_words, n_results: n.nl.n_results, reason: n.nl.reason_code, any_word_files: n.nl.unfloored_files_with_any_word, best_words: n.nl.best_words_matched, best_share: n.nl.best_idf_share, best_passes: n.nl.best_passes_floor })));
