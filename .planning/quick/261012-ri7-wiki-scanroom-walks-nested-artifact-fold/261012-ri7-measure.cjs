'use strict';
// quick 261012-ri7 -- read-only measurement of the wiki scan on a real room.
// Usage: node 261012-ri7-measure.cjs [roomPath]
// The script never opens a room file for write. The server leg runs on a temp
// copy of the room and deletes it at the end.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

const REPO = '/home/jsagi/dev/MindrianOS-Plugin';
const room = path.resolve(process.argv[2] || path.join(os.homedir(), 'MindrianRooms', 'rethinking-mindrianos'));

const pageRenderer = require(path.join(REPO, 'lib', 'wiki', 'page-renderer.cjs'));
const wikiServer = require(path.join(REPO, 'lib', 'wiki', 'wiki-server.cjs'));

const SKIP_DIRS = new Set(['.lazygraph', '.reasoning', 'meetings', 'node_modules', '.git']);
const STRUCTURAL = new Set(['meetings', 'team', 'references']);
const PRIVATE_ROOT = pageRenderer.PRIVATE_ROOT_FILES;

let failed = false;
const line = (label, text) => console.log(`${label}: ${text}`);

// ── fingerprint: sorted (rel, size, mtimeMs) of every room file with no dot segment ──
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
  const hash = crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  return { hash, files: rows.length, map: new Map(rows.map((r) => [r[0], `${r[1]}:${r[2]}`])) };
}

// ── census: independent plain walk (measurement tooling, outside lib) ──
function census(root) {
  const mdFiles = []; // rel paths of every .md that is not private/STATE
  (function walk(dir, depth) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      if (e.isSymbolicLink()) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (depth >= 1) {
          if (SKIP_DIRS.has(e.name) || e.name === 'export' || e.name === 'exports') continue;
          if (fs.existsSync(path.join(abs, '.room-root'))) continue;
        } else if (SKIP_DIRS.has(e.name) || e.name === 'export' || e.name === 'exports') {
          continue;
        } else if (fs.existsSync(path.join(abs, '.room-root'))) {
          continue;
        }
        walk(abs, depth + 1);
      } else if (e.isFile() && e.name.endsWith('.md')) {
        if (depth === 0 && PRIVATE_ROOT.has(e.name)) continue;
        if (depth > 0 && e.name === 'STATE.md') continue;
        mdFiles.push(path.relative(root, abs).split(path.sep).join('/'));
      }
    }
  })(root, 0);
  // Known limit: a team/references/meetings folder below depth 1 is not walked.
  const limit = mdFiles.filter((rel) => {
    const segs = rel.split('/');
    return segs.slice(1, -1).some((s) => STRUCTURAL.has(s));
  });
  return { mdFiles, limit };
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

function lowerBound(sorted, x) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < x) lo = mid + 1; else hi = mid;
  }
  return lo;
}

// Marker: first word of 9 or more letters (codepoint order) that sits in exactly
// 1 nested page (3 or more id segments) and is not a prefix of any word in a
// 1-segment or 2-segment page.
function pickMarker(pages) {
  const nestedWords = new Map(); // word -> Set(ids)
  const flatWords = new Set();
  for (const [id, page] of pages) {
    const words = (page.title + ' ' + page.content).toLowerCase().match(/[a-z]+/g) || [];
    const nested = id.split('/').length >= 3;
    for (const w of words) {
      if (nested) {
        if (w.length < 9) continue;
        if (!nestedWords.has(w)) nestedWords.set(w, new Set());
        nestedWords.get(w).add(id);
      } else {
        flatWords.add(w);
      }
    }
  }
  const flatSorted = Array.from(flatWords).sort();
  const candidates = Array.from(nestedWords.keys()).filter((w) => nestedWords.get(w).size === 1).sort();
  for (const w of candidates) {
    const i = lowerBound(flatSorted, w);
    const hit = i < flatSorted.length && flatSorted[i].startsWith(w);
    if (!hit) return { marker: w, id: Array.from(nestedWords.get(w))[0] };
  }
  return null;
}

async function main() {
  line('room', room);
  if (!fs.existsSync(room)) { console.log('FAIL: room not found'); process.exit(1); }

  const fpBefore = fingerprint(room);
  line('fingerprint.before', `${fpBefore.hash} (${fpBefore.files} files)`);

  const c = census(room);
  const censusCount = c.mdFiles.length;
  const target = censusCount - c.limit.length;
  line('census', `${censusCount} .md after exclusions; ${c.limit.length} under a team/references folder below depth 1 (known limit); target ${target}`);
  if (censusCount !== 418) console.log(`room changed since planning: census ${censusCount}`);

  const t0 = process.hrtime.bigint();
  const result = pageRenderer.scanRoom(room);
  const scanMs = Number(process.hrtime.bigint() - t0) / 1e6;
  const pages = result.pages;
  const perSection = Array.from(result.sections.entries()).map(([n, s]) => `${n} ${s.pages.length}`).join(', ');
  line('scan', `pages ${pages.size}; sections ${result.sections.size} (${perSection}); scanWarnings ${result.scanWarnings.length}; ${scanMs.toFixed(1)} ms`);
  const scanOk = pages.size === target;
  line('scan.target', `${scanOk ? 'OK' : 'FAIL'} pages ${pages.size} vs target ${target}`);
  if (!scanOk) failed = true;

  // preserved: every depth-2 .md and root page id from the census exists in pages.
  const preservedIds = [];
  for (const rel of c.mdFiles) {
    const segs = rel.split('/');
    if (segs.length === 1) preservedIds.push(segs[0].replace(/\.md$/, ''));
    else if (segs.length === 2) preservedIds.push(rel.replace(/\.md$/, ''));
  }
  const missing = preservedIds.filter((id) => !pages.has(id));
  line('preserved', `${missing.length === 0 ? 'OK' : 'FAIL'} ${preservedIds.length - missing.length} of ${preservedIds.length} flat ids present${missing.length ? '; missing ' + missing.slice(0, 5).join(', ') : ''}`);
  if (missing.length > 0) failed = true;

  line('warnings', String(result.scanWarnings.length));
  for (const w of result.scanWarnings) console.log(`  ${w.reason} ${w.path}`);

  // per-depth id counts (segments)
  const seg = {};
  for (const id of pages.keys()) { const n = id.split('/').length; seg[n] = (seg[n] || 0) + 1; }
  line('id.segments', JSON.stringify(seg));

  // ── server leg on a temp copy ──
  const picked = pickMarker(pages);
  if (!picked) { console.log('server: FAIL no marker found'); failed = true; } else {
    const copyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ri7-measure-'));
    const copy = path.join(copyRoot, 'room');
    let handle = null;
    try {
      // Dot entries are left out, except the .room-root sentinel (a sub-room at
      // depth 1 must stay a sub-room in the copy; the sentinel holds no content).
      fs.cpSync(room, copy, {
        recursive: true,
        filter: (src) => {
          const b = path.basename(src);
          return !b.startsWith('.') || b === '.room-root';
        },
      });
      handle = await wikiServer.startWikiServer(copy, 0);
      const port = handle.port;
      const search = await httpGet(port, `/api/search?q=${encodeURIComponent(picked.marker)}`);
      let found = false;
      try { found = JSON.parse(search.body).some((r) => r.id === picked.id); } catch (_e) { found = false; }
      line('server.search', `${found ? 'OK' : 'FAIL'} marker "${picked.marker}" returns nested id ${picked.id} (status ${search.status})`);
      if (!found) failed = true;

      const pageUrl = '/wiki/' + picked.id.split('/').map(encodeURIComponent).join('/');
      const view = await httpGet(port, pageUrl);
      line('server.page', `${view.status === 200 ? 'OK' : 'FAIL'} GET ${pageUrl} -> ${view.status}`);
      if (view.status !== 200) failed = true;

      const api = await httpGet(port, '/api/pages');
      let keys = -1;
      try { keys = Object.keys(JSON.parse(api.body)).length; } catch (_e) { keys = -1; }
      line('server.pages', `${keys === pages.size ? 'OK' : 'FAIL'} /api/pages keys ${keys} vs scan ${pages.size}`);
      if (keys !== pages.size) failed = true;

      await httpGet(port, pageUrl); // warm-up
      const times = [];
      for (let i = 0; i < 5; i++) {
        const s = process.hrtime.bigint();
        await httpGet(port, pageUrl);
        times.push(Number(process.hrtime.bigint() - s) / 1e6);
      }
      times.sort((a, b) => a - b);
      line('server.timing', `median ${times[2].toFixed(1)} ms for a page view (min ${times[0].toFixed(1)}, max ${times[4].toFixed(1)}); report only`);
    } catch (err) {
      console.log(`server: FAIL ${err && err.message ? err.message : err}`);
      failed = true;
    } finally {
      if (handle) {
        try { if (handle.watcher && handle.watcher.close) await handle.watcher.close(); } catch (_e) { /* ignore */ }
        try { handle.server.close(); } catch (_e) { /* ignore */ }
      }
      try { fs.rmSync(copyRoot, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
    }
  }

  const fpAfter = fingerprint(room);
  if (fpAfter.hash === fpBefore.hash) {
    line('fingerprint.after', `unchanged ${fpAfter.hash}`);
  } else {
    const changed = [];
    for (const [k, v] of fpAfter.map) if (fpBefore.map.get(k) !== v) changed.push(k);
    for (const k of fpBefore.map.keys()) if (!fpAfter.map.has(k)) changed.push(k);
    line('fingerprint.after', `WARN changed ${fpAfter.hash}; paths: ${changed.slice(0, 10).join(', ')}`);
  }

  console.log(failed ? 'RESULT: FAIL' : 'RESULT: OK');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.log(`FATAL ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
