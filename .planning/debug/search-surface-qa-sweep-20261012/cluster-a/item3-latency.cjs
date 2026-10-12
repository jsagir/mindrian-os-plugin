'use strict';
// Item 3: latency of room_search (the double walk). Read-only on the rooms. No network, no Brain call.
// Times _internal.searchRoomDetailed (the call the tool handler makes) with process.hrtime.bigint.
// Usage: node item3-latency.cjs   -> item3-results.json, masked summary on stdout, queries in private/item3-queries.json
const fs = require('node:fs');
const path = require('node:path');
const C = require('./common.cjs');
const { I, ROOMS, CAP } = C;

const RUNS = 5;
const ms = (t0) => Number(process.hrtime.bigint() - t0) / 1e6;
function time(fn, n) {
  const xs = [];
  let out;
  for (let i = 0; i < n; i++) { const t0 = process.hrtime.bigint(); out = fn(); xs.push(ms(t0)); }
  return { out, xs, med: C.med(xs), min: Math.min(...xs), max: Math.max(...xs) };
}
const r1 = (x) => +x.toFixed(1);

// Count file system calls under a room during one call. Proves how many times each file is read.
function countIO(room, fn) {
  const origRead = fs.readFileSync; const origStat = fs.statSync; const origDir = fs.readdirSync;
  const perPath = new Map(); let stats = 0; let dirs = 0;
  fs.readFileSync = function (p, ...a) { if (typeof p === 'string' && p.startsWith(room)) perPath.set(p, (perPath.get(p) || 0) + 1); return origRead.call(this, p, ...a); };
  fs.statSync = function (p, ...a) { if (typeof p === 'string' && p.startsWith(room)) stats++; return origStat.call(this, p, ...a); };
  fs.readdirSync = function (p, ...a) { if (typeof p === 'string' && p.startsWith(room)) dirs++; return origDir.call(this, p, ...a); };
  let out;
  try { out = fn(); } finally { fs.readFileSync = origRead; fs.statSync = origStat; fs.readdirSync = origDir; }
  const counts = [...perPath.values()];
  return { out, distinct_files_read: counts.length, total_reads: counts.reduce((a, b) => a + b, 0), files_read_twice: counts.filter((c) => c === 2).length, files_read_once: counts.filter((c) => c === 1).length, statSync_calls: stats, readdirSync_calls: dirs };
}

const NEG_CANDIDATES = ['how do I configure Kubernetes autoscaling', 'quarterly revenue forecast for the bakery franchise', 'what is the capital of Mongolia'];

const out = { ran: new Date().toISOString(), head: require('node:child_process').execSync('git rev-parse --short HEAD', { cwd: C.REPO }).toString().trim(), runs_per_query: RUNS, rooms: {}, scaling_points: [] };
const priv = {};

for (const [name, room] of Object.entries(ROOMS)) {
  const { files } = C.walkAll(room);
  const walked = files.slice(0, CAP);
  const size = (rels) => rels.reduce((s, f) => { try { return s + fs.statSync(path.join(room, f)).size; } catch (_e) { return s; } }, 0);
  const walkedBytes = size(walked); const allBytes = size(files);

  // token df over the walked files (product tokenizer), to build realistic queries
  const df = new Map(); const perFileToks = [];
  for (const f of walked) {
    const set = new Set((C.searchText(room, f).match(/[\p{L}\p{N}]+/gu) || []).filter((w) => /^[a-z]{6,12}$/.test(w) && I.queryWords(w).length));
    perFileToks.push(set); for (const w of set) df.set(w, (df.get(w) || 0) + 1);
  }
  const rand = C.rng(7);
  // keyword with a phrase hit: df 3..20 inside the walked set
  const kwPool = [...df.entries()].filter(([, n]) => n >= 3 && n <= 20).map(([w]) => w).sort();
  const kw = kwPool[Math.floor(rand() * kwPool.length)];
  // sentence for the word tier: 3 rare words (df <= 4) from one file, wrapped in plain words so no phrase hit
  let sentence = null; let tries = 0;
  while (!sentence && tries++ < 200) {
    const toks = [...perFileToks[Math.floor(rand() * perFileToks.length)]].filter((w) => df.get(w) <= 4).sort();
    if (toks.length < 3) continue;
    const pickW = [toks[0], toks[Math.floor(toks.length / 2)], toks[toks.length - 1]];
    const cand = 'what does this room say about ' + pickW.join(' and ');
    const d = I.searchRoomDetailed(room, cand, null);
    if (d.tier === 'words' && d.results.length > 0) sentence = cand;
  }
  let below = null; let belowCode = null;
  for (const q of NEG_CANDIDATES) { const d = I.searchRoomDetailed(room, q, null); belowCode = d.reason_code || d.tier; if (d.reason_code === 'below_relevance_floor') { below = q; break; } }
  priv[name] = { kw, sentence, below, below_fallback_code: below ? null : belowCode };

  const queries = { 'keyword-phrase-hit': kw, 'sentence-word-tier': sentence, 'sentence-below-floor': below || NEG_CANDIDATES[0] };
  const res = { walkable: files.length, walked: walked.length, walked_bytes: walkedBytes, all_walkable_bytes: allBytes, queries: {} };
  for (const [label, q] of Object.entries(queries)) {
    const warm = time(() => I.searchRoomDetailed(room, q, null), 1);
    const t = time(() => I.searchRoomDetailed(room, q, null), RUNS);
    const io = countIO(room, () => I.searchRoomDetailed(room, q, null));
    res.queries[label] = {
      tier: t.out.tier, reason_code: t.out.reason_code || null, results: t.out.results.length, query_word_count: I.queryWords(q).length,
      warmup_ms: r1(warm.xs[0]), runs_ms: t.xs.map(r1), median_ms: r1(t.med), min_ms: r1(t.min), max_ms: r1(t.max),
      io: { distinct_files_read: io.distinct_files_read, total_reads: io.total_reads, files_read_twice: io.files_read_twice, statSync_calls: io.statSync_calls, readdirSync_calls: io.readdirSync_calls },
    };
  }
  // attribute the two walks for the sentence query
  const phraseOnly = time(() => I.rankMatches(I.collectMatches(room, room, queries['sentence-word-tier'].toLowerCase())), RUNS);
  const wordOnly = time(() => I.scoreWordTier(room, room, I.queryWords(queries['sentence-word-tier'])), RUNS);
  res.walk_split_sentence = { walk1_phrase_ms_median: r1(phraseOnly.med), walk2_word_ms_median: r1(wordOnly.med), sum: r1(phraseOnly.med + wordOnly.med) };
  out.rooms[name] = res;

  // scaling points: top-level sections as scopes (the section param is a legal way to vary the file count, cap untouched)
  const secs = new Map();
  files.forEach((f) => { const top = f.includes(path.sep) ? f.split(path.sep)[0] : null; if (top && /^[a-z0-9-]+$/.test(top)) { if (!secs.has(top)) secs.set(top, []); secs.get(top).push(f); } });
  for (const [sec, list] of secs) {
    if (list.length < 5) continue;
    const seen = list.slice(0, CAP); const bytes = size(seen);
    const missQ = 'zzqxjw'; // a token that is in no file: phrase tier misses, word tier walks and finds nothing
    const full = time(() => I.searchRoomDetailed(room, missQ, sec), 3);
    const oneWalk = time(() => I.rankMatches(I.collectMatches(path.join(room, sec), room, missQ)), 3);
    out.scaling_points.push({ room: name, scope: 'section', files: seen.length, bytes, one_walk_ms: r1(oneWalk.med), miss_query_total_ms: r1(full.med) });
  }
  // the whole room scope (capped at 500 by the product)
  {
    const full = time(() => I.searchRoomDetailed(room, 'zzqxjw', null), 3);
    const oneWalk = time(() => I.rankMatches(I.collectMatches(room, room, 'zzqxjw')), 3);
    out.scaling_points.push({ room: name, scope: 'whole-room', files: walked.length, bytes: walkedBytes, one_walk_ms: r1(oneWalk.med), miss_query_total_ms: r1(full.med) });
  }
}

// least squares through the pooled points: miss_query_total_ms ~ a + b * x
function fit(pts, key) {
  const n = pts.length; const sx = pts.reduce((s, p) => s + p[key], 0); const sy = pts.reduce((s, p) => s + p.miss_query_total_ms, 0);
  const sxx = pts.reduce((s, p) => s + p[key] * p[key], 0); const sxy = pts.reduce((s, p) => s + p[key] * p.miss_query_total_ms, 0);
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx); const a = (sy - b * sx) / n;
  const my = sy / n; const ssTot = pts.reduce((s, p) => s + (p.miss_query_total_ms - my) ** 2, 0); const ssRes = pts.reduce((s, p) => s + (p.miss_query_total_ms - (a + b * p[key])) ** 2, 0);
  return { a: +a.toFixed(2), b: +b.toFixed(5), r2: +(1 - ssRes / ssTot).toFixed(3), n };
}
const pts = out.scaling_points;
out.fit_by_files = fit(pts.map((p) => ({ ...p, f: p.files })), 'f');
out.fit_by_mb = fit(pts.map((p) => ({ ...p, mb: p.bytes / 1048576 })), 'mb');
out.extrapolation_UNVERIFIED = {};
for (const [name, r] of Object.entries(out.rooms)) {
  out.extrapolation_UNVERIFIED[name] = {
    walkable: r.walkable, walked_now: r.walked,
    predicted_total_ms_if_all_walked_by_files: +(out.fit_by_files.a + out.fit_by_files.b * r.walkable).toFixed(0),
    predicted_total_ms_if_all_walked_by_mb: +(out.fit_by_mb.a + out.fit_by_mb.b * (r.all_walkable_bytes / 1048576)).toFixed(0),
    walked_mb_now: +(r.walked_bytes / 1048576).toFixed(1), all_walkable_mb: +(r.all_walkable_bytes / 1048576).toFixed(1),
  };
}
fs.mkdirSync(path.join(__dirname, 'private'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'private/item3-queries.json'), JSON.stringify(priv, null, 1));
fs.writeFileSync(path.join(__dirname, 'item3-results.json'), JSON.stringify(out, null, 1));
for (const [n, r] of Object.entries(out.rooms)) {
  console.log('== ' + n + ' walkable ' + r.walkable + ' walked ' + r.walked + ' walked_MB ' + (r.walked_bytes / 1048576).toFixed(1) + ' all_MB ' + (r.all_walkable_bytes / 1048576).toFixed(1));
  for (const [l, q] of Object.entries(r.queries)) console.log('   ' + l + ': tier ' + q.tier + ' reason ' + q.reason_code + ' results ' + q.results + ' median ' + q.median_ms + ' min ' + q.min_ms + ' max ' + q.max_ms + ' warmup ' + q.warmup_ms + ' | reads ' + JSON.stringify(q.io));
  console.log('   walk split (sentence): ' + JSON.stringify(r.walk_split_sentence));
}
console.log('fit by files ' + JSON.stringify(out.fit_by_files) + ' by MB ' + JSON.stringify(out.fit_by_mb));
console.log('extrapolation (UNVERIFIED) ' + JSON.stringify(out.extrapolation_UNVERIFIED));
