'use strict';
// quick 261012-u58 -- read-only measurement of the wiki search through the
// room_search engine on a real room.
// Usage: node 261012-u58-measure.cjs [roomPath]
//
// Runs AFTER Task 3 of the plan (it requires lib/core/room-search.cjs and the
// new /api/search object shape). The script never opens a room file for write.
// The engine leg reads the real room. The server leg runs on a temp copy of the
// room (dot entries left out, .room-root kept) because the wiki server opens
// room.db for its graph panels, and deletes the copy at the end. It prints
// counts, ids, tiers, reason codes and timings only: no room text, and not the
// marker word (only its length). Exit 1 when a leg fails.
// No em-dash, no en-dash.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '../../..');
const room = path.resolve(process.argv[2] || path.join(os.homedir(), 'MindrianRooms', 'rethinking-mindrianos'));

const roomSearch = require(path.join(REPO, 'lib', 'core', 'room-search.cjs'));
const pageRenderer = require(path.join(REPO, 'lib', 'wiki', 'page-renderer.cjs'));
const wikiServer = require(path.join(REPO, 'lib', 'wiki', 'wiki-server.cjs'));

// The 3 spike-010 negative controls (quick 261012-kfn measure script).
const NEGATIVES = [
  'quarterly revenue forecast for the bakery franchise',
  'how do I configure Kubernetes autoscaling',
  'what is the capital of Mongolia',
];
// The flexsearch index cost this change removes (quick 261012-ri7 measurement).
const FLEX_REBUILD_MS = '414 to 551 ms at 418 pages, paid at server start and after each page-set change';
const ALLOWED_KEYS = new Set(['tier', 'results', 'scanned', 'walkable', 'truncated', 'reason_code', 'reason']);

let failed = false;
const line = (label, text) => console.log(`${label}: ${text}`);
const fail = (label, text) => { failed = true; line(label, `FAIL ${text}`); };

function fingerprint(root) {
  const rows = [];
  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const abs = path.join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { walk(abs); continue; }
      if (!e.isFile()) continue;
      const st = fs.statSync(abs);
      rows.push([path.relative(root, abs).split(path.sep).join('/'), st.size, st.mtimeMs]);
    }
  })(root);
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return { hash: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'), files: rows.length };
}

function httpGet(port, p) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: p }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
  });
}

const toId = (rel) => rel.split(path.sep).join('/').replace(/\.md$/, '');
const median = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const ms = (t0) => Number(process.hrtime.bigint() - t0) / 1e6;

// Candidate markers: words of 9 or more letters that occur in exactly 1 nested
// page (3 or more id segments). The server leg keeps the first candidate whose
// /api/search answer is the phrase tier with that nested page ranked first.
function markerCandidates(pages) {
  const owners = new Map();
  for (const [id, page] of pages) {
    const words = new Set((String(page.title) + ' ' + page.content).toLowerCase().match(/[a-z]{9,}/g) || []);
    for (const w of words) {
      if (!owners.has(w)) owners.set(w, new Set());
      owners.get(w).add(id);
    }
  }
  const out = [];
  for (const [w, ids] of owners) {
    if (ids.size !== 1) continue;
    const id = Array.from(ids)[0];
    if (id.split('/').length >= 3) out.push({ w, id });
  }
  out.sort((a, b) => (a.w < b.w ? -1 : a.w > b.w ? 1 : 0));
  return out.slice(0, 60);
}

async function main() {
  line('room', room);
  if (!fs.existsSync(room)) { console.log('FAIL: room not found'); process.exit(1); }
  line('load', os.loadavg().map((n) => n.toFixed(2)).join(' '));
  const fpBefore = fingerprint(room);
  line('fingerprint.before', `${fpBefore.hash} (${fpBefore.files} files)`);

  // ── engine leg, real room, read only ──
  let t0 = process.hrtime.bigint();
  const { pages } = pageRenderer.scanRoom(room);
  line('scan', `pages ${pages.size}; ${ms(t0).toFixed(1)} ms`);
  const includeFile = (rel) => pages.has(toId(rel));
  const unfiltered = roomSearch.searchRoomDetailed(room, 'zzqqnomatchzz', null);
  const filtered = roomSearch.searchRoomDetailed(room, 'zzqqnomatchzz', null, { includeFile });
  line('engine.walkable', `room files ${unfiltered.walkable}; wiki pages walked ${filtered.walkable}`);
  if (filtered.walkable !== pages.size) fail('engine.pages', `walkable ${filtered.walkable} vs pages ${pages.size}`);
  else line('engine.pages', `OK walkable equals pages (${pages.size})`);

  // ── server leg on a temp copy ──
  const copyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'u58-measure-'));
  const copy = path.join(copyRoot, 'room');
  let handle = null;
  try {
    fs.cpSync(room, copy, {
      recursive: true,
      filter: (src) => {
        const b = path.basename(src);
        return !b.startsWith('.') || b === '.room-root';
      },
    });
    t0 = process.hrtime.bigint();
    handle = await wikiServer.startWikiServer(copy, 0);
    line('server.start', `${ms(t0).toFixed(1)} ms (no search index build)`);
    const port = handle.port;
    const get = async (q, extra) => {
      const res = await httpGet(port, `/api/search?q=${encodeURIComponent(q)}${extra || ''}`);
      let body = null;
      try { body = JSON.parse(res.body); } catch (_e) { body = null; }
      return { status: res.status, body, raw: res.body };
    };

    // marker: a nested page is found by the phrase tier with its nested id first
    let picked = null;
    for (const c of markerCandidates(pages)) {
      const r = await get(c.w);
      if (r.status === 200 && r.body && r.body.tier === 'phrase' && r.body.results.length > 0 && r.body.results[0].id === c.id) {
        picked = { ...c, r };
        break;
      }
    }
    if (!picked) fail('server.search', 'no nested marker answered with its nested id first');
    else {
      const keys = Object.keys(picked.r.body);
      const extraKeys = keys.filter((k) => !ALLOWED_KEYS.has(k));
      line('server.search', `OK nested id ${picked.id} (marker length ${picked.w.length}, tier ${picked.r.body.tier}, ${picked.r.body.results.length} result(s), status ${picked.r.status})`);
      if (extraKeys.length > 0) fail('server.shape', `unexpected keys ${extraKeys.join(', ')}`);
      else line('server.shape', `OK keys ${keys.join(', ')}`);
      if (picked.r.raw.indexOf(picked.w) !== -1 && !picked.r.body.results.some((x) => String(x.excerpt).toLowerCase().indexOf(picked.w) !== -1)) {
        fail('server.echo', 'the query text is in the body outside an excerpt');
      } else line('server.echo', 'OK the query is not echoed outside the excerpts');
      const r1 = picked.r.body.results[0];
      line('server.row', `keys ${Object.keys(r1).join(', ')}; excerpt has mark ${String(r1.excerpt).indexOf('<mark>') !== -1}`);
    }

    // negatives: empty list with a reason, below the relevance floor
    for (const q of NEGATIVES) {
      const r = await get(q);
      const b = r.body || {};
      const okEmpty = r.status === 200 && Array.isArray(b.results) && b.results.length === 0;
      const okReason = b.reason_code === 'below_relevance_floor' && typeof b.reason === 'string' && b.reason.length > 0;
      line('server.negative', `${okEmpty && okReason ? 'OK' : 'FAIL'} "${q}" tier ${b.tier} results ${Array.isArray(b.results) ? b.results.length : 'n/a'} reason_code ${b.reason_code}`);
      if (!(okEmpty && okReason)) failed = true;
    }

    // walk fields on the copy match the page count
    const miss = await get('zzqqnomatchzz');
    const mb = miss.body || {};
    if (mb.walkable !== pages.size || mb.scanned !== pages.size || mb.truncated !== false) {
      fail('server.walk', `scanned ${mb.scanned} walkable ${mb.walkable} truncated ${mb.truncated} vs pages ${pages.size}`);
    } else line('server.walk', `OK scanned ${mb.scanned} walkable ${mb.walkable} truncated false; reason_code ${mb.reason_code}`);

    // section scope and a bad section
    const sec = await get(picked ? picked.w : 'room', '&section=research');
    const secIds = sec.body && Array.isArray(sec.body.results) ? sec.body.results.map((x) => x.id) : [];
    const secOk = sec.status === 200 && secIds.every((id) => id.startsWith('research/'));
    line('server.section', `${secOk ? 'OK' : 'FAIL'} section=research: ${secIds.length} result(s), all under research/ ${secOk}`);
    if (!secOk) failed = true;
    const bad = await get('room', '&section=..%2Fx');
    line('server.badsection', `${bad.status === 400 ? 'OK' : 'FAIL'} section=../x -> ${bad.status}`);
    if (bad.status !== 400) failed = true;

    // timings, report only
    const runs = { phrase: [], words: [], miss: [] };
    const phraseQ = picked ? picked.w : 'room';
    const wordsQ = `Which page records the ${phraseQ} decision?`;
    for (let i = 0; i < 6; i++) {
      let s = process.hrtime.bigint(); await get(phraseQ); runs.phrase.push(ms(s));
      s = process.hrtime.bigint(); await get(wordsQ); runs.words.push(ms(s));
      s = process.hrtime.bigint(); await get(NEGATIVES[2]); runs.miss.push(ms(s));
    }
    for (const k of Object.keys(runs)) runs[k].shift(); // drop the warm-up run
    line('timing', `median /api/search ms: phrase hit ${median(runs.phrase).toFixed(1)}, sentence ${median(runs.words).toFixed(1)}, below floor ${median(runs.miss).toFixed(1)} (5 runs each, report only)`);
    line('timing.replaced', `flexsearch index rebuild ${FLEX_REBUILD_MS}; lookup about 0.1 ms per query`);
  } catch (err) {
    fail('server', err && err.message ? err.message : String(err));
  } finally {
    if (handle) {
      try { if (handle.watcher && handle.watcher.close) await handle.watcher.close(); } catch (_e) { /* ignore */ }
      try { handle.server.close(); } catch (_e) { /* ignore */ }
    }
    try { fs.rmSync(copyRoot, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }

  const fpAfter = fingerprint(room);
  if (fpAfter.hash === fpBefore.hash) line('fingerprint.after', `unchanged ${fpAfter.hash}`);
  else fail('fingerprint.after', `changed ${fpAfter.hash}`);

  console.log(failed ? 'RESULT: FAIL' : 'RESULT: OK');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.log(`FAIL: fatal ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
