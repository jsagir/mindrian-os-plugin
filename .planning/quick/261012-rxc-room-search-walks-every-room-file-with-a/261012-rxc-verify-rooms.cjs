'use strict';
// Quick 261012-rxc, Task 3: read-only verification of room_search on the three real rooms.
// Reuses cluster A's helpers. It loads room.cjs from the repo, so it runs the new code.
// No network, no Brain call (Canon Part 8). No room write.
//
// Writes only:
//   261012-rxc-verify-results.json            public: slugs, counts, booleans, walk indices, timings
//   private/261012-rxc-verify-private.json    private: room file paths, probe terms, queries (never committed)
// stdout is masked: slugs, counts, walk indices and timings only.
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const CA = path.join(REPO, '.planning/debug/search-surface-qa-sweep-20261012/cluster-a');
const C = require(path.join(CA, 'common.cjs'));
const { ROOMS, CAP, walkAll, searchText, rng, med, sha8, I, roomMod } = C;

const PRIV_DIR = path.join(__dirname, 'private');
fs.mkdirSync(PRIV_DIR, { recursive: true });

const gates = [];
function gate(label, ok) {
  gates.push({ label, ok: !!ok });
  console.log((ok ? 'GATE ok   ' : 'GATE FAIL ') + label);
}
const r1 = (x) => +x.toFixed(1);

// ---- public cluster A baselines (item2-results.json and item3-results.json hold no paths or terms) ----
const baseItem2 = JSON.parse(fs.readFileSync(path.join(CA, 'item2-results.json'), 'utf8'));
const baseItem3 = JSON.parse(fs.readFileSync(path.join(CA, 'item3-results.json'), 'utf8'));

// ---- helpers copied from cluster A ----
function realHandlerFor(room) {
  process.env.CLAUDE_ACTIVE_ROOM = room;
  let handler = null;
  const stub = { registerTool: (name, _def, fn) => { if (name === 'room_search') handler = fn; } };
  roomMod.register(stub, { fallbackRoomDir: room });
  return handler;
}

const ms = (t0) => Number(process.hrtime.bigint() - t0) / 1e6;
function time(fn, n) {
  const xs = [];
  let out;
  for (let i = 0; i < n; i++) { const t0 = process.hrtime.bigint(); out = fn(); xs.push(ms(t0)); }
  return { out, xs, med: med(xs), min: Math.min(...xs), max: Math.max(...xs) };
}
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

const pub = { ran: new Date().toISOString(), head: require('node:child_process').execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim(), rooms: {}, envelope: {} };
const priv = { rooms: {}, queries: {} };

async function main() {
  const handlerCache = {};

  for (const [name, room] of Object.entries(ROOMS)) {
    const all = walkAll(room);
    const files = all.files;
    const N = files.length;
    const res = { walkable: N };
    pub.rooms[name] = res;

    // ---- Part A: the walker ----
    const got = [];
    const walkRet = I.walkSearchFiles(room, room, ({ rel }) => got.push(rel));
    const sameOrder = got.length === files.length && got.every((r, i) => r === files[i]);
    res.walker = { visited: got.length, returned: walkRet, same_order_as_unbounded_walk: sameOrder };
    gate(name + ' walker visits all ' + N + ' walkable files in order, returns scanned=walkable=' + N + ', truncated false',
      sameOrder && walkRet.scanned === N && walkRet.walkable === N && walkRet.truncated === false);

    // ---- Part B: probes (copy of item2-cap.cjs lines 59-90) ----
    const texts = files.map((f) => searchText(room, f));
    const insideConcat = texts.slice(0, CAP).join('\u0000');
    const df = new Map();
    const fileTokens = texts.map((t) => {
      const set = new Set((t.match(/[\p{L}\p{N}]+/gu) || []).filter((w) => /^[a-z]{7,14}$/.test(w) && !I.queryWords(w).length === false));
      for (const w of set) df.set(w, (df.get(w) || 0) + 1);
      return set;
    });
    const isBeyondOnly = (w) => df.get(w) === 1 && !insideConcat.includes(w);
    const isInsideUnique = (w) => df.get(w) === 1;
    const rand = rng(42);
    const shuffled = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const pick = (idxPool, test, want) => {
      const out = [];
      for (const i of shuffled(idxPool)) {
        const elig = [...fileTokens[i]].filter(test).sort();
        if (elig.length === 0) continue;
        const term = elig[Math.floor(rand() * elig.length)];
        const extra = shuffled(elig.filter((w) => w !== term)).slice(0, 2);
        out.push({ idx: i, term, nlTerms: [term, ...extra] });
        if (out.length >= want) break;
      }
      return out;
    };
    const beyondIdx = []; for (let i = CAP; i < N; i++) beyondIdx.push(i);
    const insideIdx = []; for (let i = 0; i < Math.min(CAP, N); i++) insideIdx.push(i);
    const beyondProbes = beyondIdx.length ? pick(beyondIdx, isBeyondOnly, 5) : [];
    const controlProbes = pick(insideIdx, isInsideUnique, 3);

    // identity with cluster A (public walk_index and term sha8)
    const baseRows = ((baseItem2.rooms[name] || {}).probes || []).filter((p) => p.kind === 'beyond-boundary');
    const identity = beyondProbes.filter((p) => baseRows.some((b) => b.walk_index === p.idx + 1 && b.term_sha8 === sha8(p.term))).length;

    const probeRows = [];
    const privRows = [];
    for (const [kind, list] of [['beyond-boundary', beyondProbes], ['control-inside', controlProbes]]) {
      for (const p of list) {
        const rel = files[p.idx];
        const det = I.searchRoomDetailed(room, p.term, null);
        const found = det.results.some((r) => r.file === rel);
        const nl = I.searchRoomDetailed(room, p.nlTerms.join(' '), null);
        const top = rel.includes(path.sep) ? rel.split(path.sep)[0] : null;
        let scopedFound = null;
        if (top && /^[a-z0-9-]+$/.test(top)) {
          const sc = I.searchRoomDetailed(room, p.term, top);
          scopedFound = sc.results.some((r) => r.file === rel);
        }
        probeRows.push({
          kind, walk_index: p.idx + 1, term_sha8: sha8(p.term), tier: det.tier, found,
          truncated: det.truncated, scanned: det.scanned, walkable: det.walkable,
          section_scoped_found: scopedFound,
          nl_tier: nl.tier, nl_found: nl.results.some((r) => r.file === rel), nl_reason_code: nl.reason_code || null,
        });
        privRows.push({ walk_index: p.idx + 1, kind, rel, term: p.term, nlq: p.nlTerms.join(' ') });
      }
    }
    const bRows = probeRows.filter((r) => r.kind === 'beyond-boundary');
    const cRows = probeRows.filter((r) => r.kind === 'control-inside');
    res.probes = {
      beyond_total: bRows.length, beyond_found: bRows.filter((r) => r.found && r.truncated === false && r.scanned === N).length,
      control_total: cRows.length, control_found: cRows.filter((r) => r.found && r.truncated === false && r.scanned === N).length,
      scoped_total: probeRows.filter((r) => r.section_scoped_found !== null).length,
      scoped_found: probeRows.filter((r) => r.section_scoped_found === true).length,
      nl_found: probeRows.filter((r) => r.nl_found).length, nl_total: probeRows.length,
      identity_with_cluster_a: identity, cluster_a_beyond_rows: baseRows.length,
      rows: probeRows,
    };
    priv.rooms[name] = privRows;
    gate(name + ' beyond-cap probes found ' + res.probes.beyond_found + ' of ' + res.probes.beyond_total + ' (expect all, truncated false, scanned ' + N + ')',
      res.probes.beyond_found === res.probes.beyond_total);
    gate(name + ' in-cap controls found ' + res.probes.control_found + ' of ' + res.probes.control_total,
      res.probes.control_found === res.probes.control_total && res.probes.control_total > 0);
    gate(name + ' section-scoped calls found ' + res.probes.scoped_found + ' of ' + res.probes.scoped_total,
      res.probes.scoped_found === res.probes.scoped_total);
    console.log('INFO ' + name + ' natural-language form found the file ' + res.probes.nl_found + ' of ' + res.probes.nl_total + '; identity with cluster A beyond probes ' + identity + ' of ' + baseRows.length);

    // ---- Part C: the real handler (big rooms only), one call per room ----
    if (beyondProbes.length > 0) {
      const handler = realHandlerFor(room);
      handlerCache[name] = handler;
      const term = beyondProbes[0].term;
      const resp = await handler({ query: term }, { sessionId: 'rxc-verify-' + name + '-' + Date.now() });
      const text = resp.content[0].text;
      const env = JSON.parse(text);
      const keys = Object.keys(env);
      const rest = Object.assign({}, env);
      delete rest.scanned; delete rest.walkable; delete rest.truncated;
      const added = JSON.stringify(env).length - JSON.stringify(rest).length;
      res.handler = {
        room_dir_ok: env.room_dir === room, keys, tier: env.tier, results: env.results.length,
        scanned: env.scanned, walkable: env.walkable, truncated: env.truncated, chars_added_by_new_fields: added,
      };
      gate(name + ' handler envelope: room ok, scanned=walkable=' + N + ', truncated false, keys ' + keys.join(','),
        env.room_dir === room && 'scanned' in env && 'walkable' in env && 'truncated' in env && env.truncated === false && env.scanned === N && env.walkable === N);
      pub.envelope[name] = { chars_added: added, approx_tokens_chars_over_4: Math.ceil(added / 4) };
    }

    // ---- Part D: latency and reads (copy of item3-latency.cjs lines 39-68) ----
    const RUNS = 5;
    const walked = files.slice(0, CAP);
    const df3 = new Map(); const perFileToks = [];
    for (const f of walked) {
      const set = new Set((searchText(room, f).match(/[\p{L}\p{N}]+/gu) || []).filter((w) => /^[a-z]{6,12}$/.test(w) && I.queryWords(w).length));
      perFileToks.push(set); for (const w of set) df3.set(w, (df3.get(w) || 0) + 1);
    }
    const rand3 = rng(7);
    const kwPool = [...df3.entries()].filter(([, n]) => n >= 3 && n <= 20).map(([w]) => w).sort();
    const kw = kwPool[Math.floor(rand3() * kwPool.length)];
    let sentence = null; let tries = 0;
    while (!sentence && tries++ < 200) {
      const toks = [...perFileToks[Math.floor(rand3() * perFileToks.length)]].filter((w) => df3.get(w) <= 4).sort();
      if (toks.length < 3) continue;
      const pickW = [toks[0], toks[Math.floor(toks.length / 2)], toks[toks.length - 1]];
      const cand = 'what does this room say about ' + pickW.join(' and ');
      const d = I.searchRoomDetailed(room, cand, null);
      if (d.tier === 'words' && d.results.length > 0) sentence = cand;
    }
    gate(name + ' a sentence query for the word tier was derived', sentence !== null);
    let below = null;
    for (const q of NEG_CANDIDATES) { const d = I.searchRoomDetailed(room, q, null); if (d.reason_code === 'below_relevance_floor') { below = q; break; } }
    const queries = { 'keyword-phrase-hit': kw, 'sentence-word-tier': sentence, 'sentence-below-floor': below || NEG_CANDIDATES[0] };
    priv.queries[name] = queries;
    res.queries = {};
    for (const [label, q] of Object.entries(queries)) {
      if (q === null || q === undefined) { res.queries[label] = { skipped: true }; continue; }
      time(() => I.searchRoomDetailed(room, q, null), 1); // untimed warm-up
      const t = time(() => I.searchRoomDetailed(room, q, null), RUNS);
      const io = countIO(room, () => I.searchRoomDetailed(room, q, null));
      res.queries[label] = {
        tier: t.out.tier, reason_code: t.out.reason_code || null, results: t.out.results.length,
        scanned: t.out.scanned, walkable: t.out.walkable, truncated: t.out.truncated,
        runs_ms: t.xs.map(r1), median_ms: r1(t.med), min_ms: r1(t.min), max_ms: r1(t.max),
        io: { distinct_files_read: io.distinct_files_read, total_reads: io.total_reads, files_read_twice: io.files_read_twice, statSync_calls: io.statSync_calls, readdirSync_calls: io.readdirSync_calls },
        cluster_a_median_ms_500_files_two_walks: ((((baseItem3.rooms[name] || {}).queries || {})[label]) || {}).median_ms,
      };
    }
    const ex = (baseItem3.extrapolation_UNVERIFIED || {})[name];
    res.cluster_a_extrapolation_ms_all_files_two_walks = ex ? ex.predicted_total_ms_if_all_walked_by_files : null;

    const sq = res.queries['sentence-word-tier'];
    if (sq && !sq.skipped) {
      gate(name + ' sentence query reads each file once (total ' + sq.io.total_reads + ', distinct ' + sq.io.distinct_files_read + ', walkable ' + N + ')',
        sq.io.total_reads === N && sq.io.distinct_files_read === N);
    }
    if (name === 'mindrianOS') {
      gate(name + ' sentence query median ' + (sq && sq.median_ms) + ' ms is under 2000 ms', sq && sq.median_ms < 2000);
    }
    for (const [label, q] of Object.entries(res.queries)) {
      if (q.skipped) continue;
      console.log('INFO ' + name + ' ' + label + ': tier ' + q.tier + ', median ' + q.median_ms + ' ms (min ' + q.min_ms + ', max ' + q.max_ms + '), reads ' + q.io.total_reads + ' over ' + q.io.distinct_files_read + ' files; cluster A median ' + q.cluster_a_median_ms_500_files_two_walks + ' ms at 500 files with two walks');
    }
    console.log('INFO ' + name + ' cluster A extrapolation for all ' + N + ' files with two walks: ' + res.cluster_a_extrapolation_ms_all_files_two_walks + ' ms (UNVERIFIED in cluster A)');
  }

  const failed = gates.filter((g) => !g.ok);
  pub.gates = gates;
  pub.all_gates_passed = failed.length === 0;
  fs.writeFileSync(path.join(__dirname, '261012-rxc-verify-results.json'), JSON.stringify(pub, null, 1));
  fs.writeFileSync(path.join(PRIV_DIR, '261012-rxc-verify-private.json'), JSON.stringify(priv, null, 1));
  if (failed.length) {
    console.log('FAIL: 261012-rxc verify -- ' + failed.length + ' gate(s) failed');
    process.exit(1);
  }
  console.log('PASS: 261012-rxc verify -- ' + gates.length + ' gates');
  process.exit(0);
}

main().catch((e) => {
  console.log('FAIL: 261012-rxc verify -- ' + String((e && e.message) || e).slice(0, 200));
  process.exit(1);
});
