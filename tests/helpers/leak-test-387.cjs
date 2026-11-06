'use strict';
/*
 * Phase 387 plan 10: the pure helpers of the owner-run live leak test (tests/test-387-eureka-live-leak.cjs).
 *
 * Nothing here starts a process or opens a network connection. Every function works on text, folders or
 * buffers, so tests/test-387-eureka-leak-parsers.cjs can prove them on every run with synthetic data.
 *
 * Exports:
 *   parseStraceConnects(logText)           every connect() of an strace -f -e trace=connect log
 *   assertNoNonLocalConnect(logText)       throws on a non-local AF_INET or AF_INET6 attempt, else returns the rows
 *   snapshotTree(dir, opts)                Map: relative path -> { abs, type, size, mtimeMs, sha256 }
 *   diffTrees(before, after, allowed)      { added, removed, changed, outsideAllowed, noise }
 *   scanMarker(filePaths, marker)          { total, byFile } byte occurrences of the marker
 *   buildMarkerSnapshot(marker)            a synthetic graph snapshot that carries the marker
 *
 * Node built-ins only. Hyphens only.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const HASH_LIMIT_BYTES = 1024 * 1024;
const DEFAULT_MAX_ENTRIES = 200000;

// ---------------------------------------------------------------------------
// strace connect lines
// ---------------------------------------------------------------------------

function isLoopbackV4(address) { return /^127\./.test(address); }
function isLoopbackV6(address) {
  const a = String(address).toLowerCase();
  return a === '::1' || /^::ffff:127\./.test(a) || a === '0:0:0:0:0:0:0:1';
}

function pidOf(line) {
  const bracket = /\[pid\s+(\d+)\]/.exec(line);
  if (bracket) return bracket[1];
  const bare = /^\s*(\d+)\s+/.exec(line);
  return bare ? bare[1] : '';
}

function classify(argText) {
  const fam = /sa_family=(AF_[A-Z0-9_]+)/.exec(argText);
  const name = fam ? fam[1] : null;
  if (name === 'AF_UNIX' || name === 'AF_LOCAL') {
    const p = /sun_path=@?"([^"]*)"/.exec(argText);
    return { family: 'unix', address: p ? p[1] : null, local: true };
  }
  if (name === 'AF_INET') {
    const a = /inet_addr\("([^"]+)"\)/.exec(argText);
    const address = a ? a[1] : null;
    return { family: 'inet', address, local: address !== null && isLoopbackV4(address) };
  }
  if (name === 'AF_INET6') {
    const a = /inet_pton\(AF_INET6,\s*"([^"]+)"/.exec(argText);
    const address = a ? a[1] : null;
    return { family: 'inet6', address, local: address !== null && isLoopbackV6(address) };
  }
  // AF_NETLINK, AF_UNSPEC and the rest are not network addresses: they never count as a non-local connect.
  return { family: 'other', address: null, local: true };
}

function parseStraceConnects(logText) {
  const rows = [];
  const pending = new Map(); // pid -> row of an unfinished connect
  const lines = String(logText === undefined || logText === null ? '' : logText).split(/\r?\n/);
  for (const line of lines) {
    if (/<\.\.\.\s*connect resumed>/.test(line)) {
      const pid = pidOf(line);
      const row = pending.get(pid);
      if (row) {
        const res = /\)\s*=\s*(.+)$/.exec(line);
        row.result = res ? res[1].trim() : null;
        pending.delete(pid);
      }
      continue;
    }
    const at = line.search(/(^|[\s\]])connect\(\s*\d+\s*,/);
    if (at === -1) continue;
    const call = line.slice(at).replace(/^[\s\]]+/, '');
    const info = classify(call);
    const unfinished = /<unfinished\s*\.\.\.>\s*$/.test(call);
    let result = null;
    if (!unfinished) {
      const res = /\)\s*=\s*(.+)$/.exec(call);
      result = res ? res[1].trim() : null;
    }
    const row = { family: info.family, address: info.address, local: info.local, result };
    rows.push(row);
    if (unfinished) pending.set(pidOf(line), row);
  }
  return rows;
}

function assertNoNonLocalConnect(logText) {
  const rows = parseStraceConnects(logText);
  const bad = rows.filter((r) => !r.local);
  if (bad.length) {
    const list = bad.map((r) => r.family + ' ' + (r.address === null ? 'unknown' : r.address)).join('; ');
    throw new Error('non-local connect attempts (' + bad.length + '): ' + list);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// folder snapshots and diffs
// ---------------------------------------------------------------------------

function snapshotTree(dir, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const cap = Number.isInteger(o.maxEntries) && o.maxEntries > 0 ? o.maxEntries : DEFAULT_MAX_ENTRIES;
  const map = new Map();
  const root = path.resolve(dir);
  let count = 0;
  (function walk(current) {
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch (_e) { return; }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      count += 1;
      if (count > cap) throw new Error('snapshotTree: more than maxEntries=' + cap + ' entries under the folder (cap reached); narrow the folder');
      const abs = path.join(current, e.name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      let st;
      try { st = fs.lstatSync(abs); } catch (_e) { continue; }
      if (st.isDirectory()) {
        map.set(rel, { abs, type: 'dir', size: 0, mtimeMs: st.mtimeMs, sha256: null });
        walk(abs);
      } else if (st.isFile()) {
        let sha = null;
        if (st.size <= HASH_LIMIT_BYTES) {
          try { sha = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex'); } catch (_e) { sha = null; }
        }
        map.set(rel, { abs, type: 'file', size: st.size, mtimeMs: st.mtimeMs, sha256: sha });
      } else {
        map.set(rel, { abs, type: 'other', size: 0, mtimeMs: st.mtimeMs, sha256: null });
      }
    }
  })(root);
  return map;
}

function isNoise(rel) {
  return rel.split('/').indexOf('__pycache__') !== -1 || /\.pyc$/.test(rel);
}

function isUnder(abs, prefix) {
  const a = path.resolve(abs);
  const p = path.resolve(prefix);
  return a === p || a.startsWith(p + path.sep);
}

function fileChanged(a, b) {
  if (a.type !== b.type) return true;
  if (a.type !== 'file') return false; // folder times move with their children: presence only
  if (a.size !== b.size) return true;
  if (a.sha256 !== null && b.sha256 !== null) return a.sha256 !== b.sha256;
  return a.mtimeMs !== b.mtimeMs;
}

function diffTrees(before, after, allowed) {
  const prefixes = Array.isArray(allowed) ? allowed : [];
  const added = [];
  const removed = [];
  const changed = [];
  for (const [rel, b] of after) {
    const a = before.get(rel);
    if (!a) added.push({ path: rel, abs: b.abs, type: b.type });
    else if (fileChanged(a, b)) changed.push({ path: rel, abs: b.abs, type: b.type });
  }
  for (const [rel, a] of before) if (!after.has(rel)) removed.push({ path: rel, abs: a.abs, type: a.type });
  const all = added.concat(removed, changed);
  const noise = all.filter((x) => isNoise(x.path));
  const outsideAllowed = all.filter((x) => !isNoise(x.path) && !prefixes.some((p) => isUnder(x.abs, p)));
  return { added, removed, changed, outsideAllowed, noise };
}

// ---------------------------------------------------------------------------
// marker scan
// ---------------------------------------------------------------------------

function countInFile(file, needle) {
  let fd;
  try { fd = fs.openSync(file, 'r'); } catch (_e) { return 0; }
  try {
    const chunk = Buffer.alloc(4 * 1024 * 1024);
    let carry = Buffer.alloc(0);
    let total = 0;
    for (;;) {
      const n = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (n <= 0) break;
      const buf = Buffer.concat([carry, chunk.subarray(0, n)]);
      let from = 0;
      for (;;) {
        const at = buf.indexOf(needle, from);
        if (at === -1) break;
        total += 1;
        from = at + needle.length;
      }
      // keep a tail that could hold the start of a marker cut by the chunk edge, never one already counted
      const keep = Math.min(needle.length - 1, buf.length - from);
      carry = keep > 0 ? Buffer.from(buf.subarray(buf.length - keep)) : Buffer.alloc(0);
    }
    return total;
  } finally {
    try { fs.closeSync(fd); } catch (_e) { /* best effort */ }
  }
}

function scanMarker(filePaths, marker) {
  const needle = Buffer.from(String(marker), 'utf8');
  const byFile = {};
  let total = 0;
  for (const file of Array.isArray(filePaths) ? filePaths : []) {
    const n = needle.length ? countInFile(file, needle) : 0;
    byFile[file] = n;
    total += n;
  }
  return { total, byFile };
}

// ---------------------------------------------------------------------------
// the synthetic snapshot
// ---------------------------------------------------------------------------

function buildMarkerSnapshot(marker) {
  const m = String(marker);
  const mk = (i, name, text, withMarker) => ({
    id: 'claim:leak387-' + i,
    labels: ['claim'],
    name: withMarker ? name + ' ' + m : name,
    attrs: { knowledge_type: 'fact', domain: i % 2 ? 'field-a' : 'field-b' },
    text: withMarker ? text + ' ' + m : text,
  });
  const nodes = [
    mk(1, 'Synthetic note one', 'A synthetic statement about a made-up water filter.', true),
    mk(2, 'Synthetic note two', 'A synthetic statement about a made-up tidal sensor.', true),
    mk(3, 'Synthetic note three', 'A synthetic statement about a made-up grain dryer.', true),
    mk(4, 'Synthetic note four', 'A synthetic statement about a made-up bridge cable.', true),
    mk(5, 'Synthetic note five', 'A synthetic statement about a made-up kiln schedule.', false),
    mk(6, 'Synthetic note six', 'A synthetic statement about a made-up seed archive.', false),
  ];
  const at = '2026-01-01T00:00:00Z';
  const edges = [
    { s: nodes[0].id, t: nodes[1].id, type: 'SUPPORTS', created_at: at },
    { s: nodes[1].id, t: nodes[2].id, type: 'ENABLES', created_at: at },
    { s: nodes[2].id, t: nodes[3].id, type: 'SUPPORTS', created_at: at },
    { s: nodes[3].id, t: nodes[4].id, type: 'CONTRADICTS', created_at: at },
    { s: nodes[4].id, t: nodes[5].id, type: 'ENABLES', created_at: at },
  ];
  const content = JSON.stringify({ nodes, edges });
  return {
    nodes,
    edges,
    meta: {
      scope_id: 'leak-test-387-scope',
      snapshot_id: crypto.createHash('sha256').update(content).digest('hex'),
      projection_version: 'mindrian.engine-graph-projection.v3',
      complete: true,
      omissions: { requested_nodes: 6, missing_nodes: 0, excluded_system_nodes: 0, empty_text_nodes: 0, text_truncated_nodes: 0, edges_truncated: false },
      source_text_is_untrusted: true,
    },
  };
}

module.exports = { parseStraceConnects, assertNoNonLocalConnect, snapshotTree, diffTrees, scanMarker, buildMarkerSnapshot };
