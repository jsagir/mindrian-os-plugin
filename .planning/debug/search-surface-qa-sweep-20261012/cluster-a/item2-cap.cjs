'use strict';
// Item 2: the SEARCH_MAX_FILES=500 walk cap. Read-only on the rooms. No network, no Brain call.
// Usage: node item2-cap.cjs            -> masked summary on stdout, full detail in private/item2-probes.json
const fs = require('node:fs');
const path = require('node:path');
const C = require('./common.cjs');
const { I, ROOMS, CAP } = C;

const PRIV = path.join(__dirname, 'private');
fs.mkdirSync(PRIV, { recursive: true });

// Real tool handler, driven with a stub server so the envelope is the true one.
// CLAUDE_ACTIVE_ROOM is the operator pin (resolve-active-room step 1); the handler only reads.
function realHandlerFor(room) {
  process.env.CLAUDE_ACTIVE_ROOM = room;
  let handler = null;
  const stub = { registerTool: (name, _def, fn) => { if (name === 'room_search') handler = fn; } };
  C.roomMod.register(stub, { fallbackRoomDir: room });
  return handler;
}

const report = { ran: new Date().toISOString(), head: require('node:child_process').execSync('git rev-parse --short HEAD', { cwd: C.REPO }).toString().trim(), rooms: {} };
const priv = { rooms: {} };

async function processRoom(name, room) {
  const t0 = Date.now();
  const { files, stats } = C.walkAll(room);
  const real = C.realWalkerFirst(room);
  const expectFirst = files.slice(0, CAP);
  const orderMatches = real.length === expectFirst.length && real.every((r, i) => r === expectFirst[i]);
  const beyond = Math.max(0, files.length - CAP);

  // per top-level section: how many walkable, how many beyond the boundary
  const secAll = new Map(); const secBeyond = new Map();
  files.forEach((f, i) => {
    const top = f.includes(path.sep) ? f.split(path.sep)[0] : '(room root)';
    secAll.set(top, (secAll.get(top) || 0) + 1);
    if (i >= CAP) secBeyond.set(top, (secBeyond.get(top) || 0) + 1);
  });
  const sections = [...secAll.entries()].map(([s, n]) => ({ section: s, walkable: n, beyond: secBeyond.get(s) || 0 }));
  // Reachability by ANY call: a whole-room call sees walk positions 1..500. A call scoped to a
  // top-level section (slug [a-z0-9-]+ only, one segment, so no nested scope) sees the first 500
  // walkable files of that section. A file is unreachable by every call when it is beyond 500 in the
  // room AND beyond 500 inside its own top-level section (or it sits in the room root, which has no scope).
  const secLocal = new Map();
  let unreachableAny = 0; let reachableOnlyByScope = 0;
  const unreachBySec = new Map();
  files.forEach((f, i) => {
    const top = f.includes(path.sep) ? f.split(path.sep)[0] : null;
    const local = top ? (secLocal.get(top) || 0) : 0;
    if (top) secLocal.set(top, local + 1);
    if (i < CAP) return;
    if (top && local < CAP) reachableOnlyByScope++;
    else { unreachableAny++; unreachBySec.set(top || '(room root)', (unreachBySec.get(top || '(room root)') || 0) + 1); }
  });
  const fullyHidden = sections.filter((s) => s.beyond === s.walkable).length;
  const partlyHidden = sections.filter((s) => s.beyond > 0 && s.beyond < s.walkable).length;

  // corpus: search text of every walkable file; token df over all walkable files
  const texts = files.map((f) => C.searchText(room, f));
  const insideConcat = texts.slice(0, CAP).join('\u0000');
  const df = new Map();
  const fileTokens = texts.map((t) => {
    // whole word tokens exactly as the product tokenizer sees them ([\p{L}\p{N}]+), letters only, 7-14 chars, no stopword
    const set = new Set((t.match(/[\p{L}\p{N}]+/gu) || []).filter((w) => /^[a-z]{7,14}$/.test(w) && !I.queryWords(w).length === false));
    for (const w of set) df.set(w, (df.get(w) || 0) + 1);
    return set;
  });
  const isBeyondOnly = (w) => df.get(w) === 1 && !insideConcat.includes(w);
  const isInsideUnique = (w) => df.get(w) === 1;

  const rand = C.rng(42);
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
  const beyondIdx = []; for (let i = CAP; i < files.length; i++) beyondIdx.push(i);
  const insideIdx = []; for (let i = 0; i < Math.min(CAP, files.length); i++) insideIdx.push(i);
  const beyondProbes = beyondIdx.length ? pick(beyondIdx, isBeyondOnly, 5) : [];
  const controlProbes = pick(insideIdx, isInsideUnique, 3);

  const handler = realHandlerFor(room);
  const run = async (kind, p) => {
    const rel = files[p.idx];
    const unboundedHits = texts.reduce((n, t) => n + (t.includes(p.term) ? 1 : 0), 0);
    const insideHits = texts.slice(0, CAP).reduce((n, t) => n + (t.includes(p.term) ? 1 : 0), 0);
    const arr = I.searchRoom(room, p.term);
    const det = I.searchRoomDetailed(room, p.term, null);
    const nlq = p.nlTerms.join(' ');
    const nl = I.searchRoomDetailed(room, nlq, null);
    let env = null; let envKeys = null; let envErr = null; let handlerRoomOk = null; let handlerTier = null; let handlerResults = null;
    try {
      const resp = await handler({ query: p.term }, { sessionId: 'cluster-a-probe-' + name + '-' + p.idx + '-k' });
      env = JSON.parse(resp.content[0].text);
      envKeys = Object.keys(env);
      handlerRoomOk = env.room_dir === room; handlerTier = env.tier; handlerResults = env.results.length;
    } catch (e) { envErr = String(e.message || e).slice(0, 120); }
    let envNl = null;
    try { const e2 = JSON.parse((await handler({ query: nlq }, { sessionId: 'cluster-a-probe-' + name + '-' + p.idx + '-n' })).content[0].text); envNl = Object.keys(e2); if (e2.room_dir !== room) envNl = ['ROOM MISMATCH']; } catch (_e) { envNl = null; }
    // does a section-scoped call reach the file? (workaround probe)
    const top = rel.includes(path.sep) ? rel.split(path.sep)[0] : null;
    let scoped = null;
    if (top) {
      try { scoped = I.searchRoomDetailed(room, p.term, top.toLowerCase()).results.length; } catch (e) { scoped = 'throws:' + String(e.message).slice(0, 60); }
    }
    return {
      kind, walk_index: p.idx + 1, ext: path.extname(rel), section: top,
      term_len: p.term.length, term_sha8: C.sha8(p.term),
      expected_hits_if_unbounded: unboundedHits, hits_inside_first_500: insideHits,
      searchRoom_count: arr.length, detailed_tier: det.tier, detailed_results: det.results.length,
      detailed_keys: Object.keys(det), reason_code: det.reason_code || null, reason: det.reason || null,
      handler_keys_keyword: envKeys, handler_room_ok: handlerRoomOk, handler_tier: handlerTier, handler_results: handlerResults, handler_err: envErr,
      nl_query_word_count: p.nlTerms.length, nl_tier: nl.tier, nl_results: nl.results.length, nl_reason_code: nl.reason_code || null,
      nl_reason: nl.reason || null, handler_keys_nl: envNl,
      section_scoped_results_lowercased_slug: scoped,
      _private: { rel, term: p.term, nlq },
    };
  };

  report.rooms[name] = (async () => {
    const rows = [];
    for (const p of beyondProbes) rows.push(await run('beyond-boundary', p));
    for (const p of controlProbes) rows.push(await run('control-inside', p));
    return rows;
  })();

  report.rooms[name] = report.rooms[name].then((rows) => {
    const pub = rows.map(({ _private, ...r }) => r);
    priv.rooms[name] = rows.map((r) => ({ walk_index: r.walk_index, kind: r.kind, ..._private_of(r) }));
    return {
      walkable_total: files.length, md: files.filter((f) => f.endsWith('.md')).length,
      html: files.filter((f) => /\.html?$/i.test(f)).length,
      walk_stats: stats, reproduction_equals_real_first_500: orderMatches, real_walker_visited: real.length,
      beyond_boundary: beyond, beyond_pct: +(100 * beyond / files.length).toFixed(1),
      file_500_section: files[CAP - 1] ? files[CAP - 1].split(path.sep)[0] : null,
      file_501_section: files[CAP] ? files[CAP].split(path.sep)[0] : null,
      sections_total: sections.length, sections_fully_hidden: fullyHidden, sections_partly_hidden: partlyHidden,
      beyond_reachable_only_by_section_scope: reachableOnlyByScope, unreachable_by_any_call: unreachableAny,
      unreachable_by_any_call_by_section: Object.fromEntries(unreachBySec),
      sections, probes_eligible_beyond: beyondProbes.length, probes: pub, elapsed_ms: Date.now() - t0,
    };
  });
  function _private_of(r) { return r._private; }
  report.rooms[name] = await report.rooms[name];
}

(async () => {
  for (const [n, r] of Object.entries(ROOMS)) await processRoom(n, r);
  fs.writeFileSync(path.join(__dirname, 'item2-results.json'), JSON.stringify(report, null, 1));
  fs.writeFileSync(path.join(PRIV, 'item2-probes.json'), JSON.stringify(priv, null, 1));
  for (const [n, r] of Object.entries(report.rooms)) {
    console.log('== ' + n + ': walkable ' + r.walkable_total + ' (md ' + r.md + ', html ' + r.html + '), beyond ' + r.beyond_boundary + ' (' + r.beyond_pct + '%), repro==real: ' + r.reproduction_equals_real_first_500 + ', real visited ' + r.real_walker_visited);
    console.log('   reachable only by section scope ' + r.beyond_reachable_only_by_section_scope + ', unreachable by any call ' + r.unreachable_by_any_call + ' ' + JSON.stringify(r.unreachable_by_any_call_by_section));
    console.log('   sections ' + r.sections_total + ', fully hidden ' + r.sections_fully_hidden + ', partly hidden ' + r.sections_partly_hidden + ', walk stats ' + JSON.stringify(r.walk_stats));
    for (const p of r.probes) console.log('   ' + p.kind + ' idx ' + p.walk_index + ' ' + p.ext + ' unbounded_hits ' + p.expected_hits_if_unbounded + ' inside500 ' + p.hits_inside_first_500 + ' -> searchRoom ' + p.searchRoom_count + ' tier ' + p.detailed_tier + ' reason ' + p.reason_code + ' | NL ' + p.nl_tier + '/' + p.nl_results + '/' + p.nl_reason_code + ' | handler room_ok ' + p.handler_room_ok + ' tier ' + p.handler_tier + ' n ' + p.handler_results + ' keys ' + (p.handler_keys_keyword || []).join(',') + ' | scoped ' + p.section_scoped_results_lowercased_slug);
  }
})();
