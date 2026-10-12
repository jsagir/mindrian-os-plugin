'use strict';
// Cluster A shared helpers. Read-only on the rooms. Zero npm deps. No network, no Brain call (Canon Part 8).
// Reproduces the walk order of walkSearchFiles in lib/mcp/tools/room.cjs without the cap, so the
// 500 boundary can be marked, and checks the reproduction against the real walker.
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../../..');
const HOME = process.env.HOME;
const ROOMS = {
  mindrianOS: path.join(HOME, 'MindrianRooms/mindrianOS'),
  'motj-ecosystem': path.join(HOME, 'MindrianRooms/motj-ecosystem'),
  'rethinking-mindrianos': path.join(HOME, 'MindrianRooms/rethinking-mindrianos'),
};
const SEARCH_EXT = ['.md', '.html', '.htm'];
const CAP = 500;

const { isRealpathContained } = require(path.join(REPO, 'lib/core/room-path-containment.cjs'));
const roomMod = require(path.join(REPO, 'lib/mcp/tools/room.cjs'));
const I = roomMod._internal;

// Same traversal as walkSearchFiles: readdir withFileTypes, sort by raw code-unit compare on name
// (directories and files interleaved, not directories first), skip dot entries, skip symlinks,
// recurse into directories, extension filter, realpath containment. No cap, no file reads.
function walkAll(roomDir) {
  const out = [];
  const stats = { dotSkipped: 0, symlinkSkipped: 0, extSkipped: 0, containSkipped: 0, maxDepth: 0 };
  (function walk(dir, depth) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      if (e.name.startsWith('.')) { stats.dotSkipped++; continue; }
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) { stats.symlinkSkipped++; continue; }
      if (e.isDirectory()) { stats.maxDepth = Math.max(stats.maxDepth, depth + 1); walk(full, depth + 1); continue; }
      const ext = path.extname(e.name).toLowerCase();
      if (!SEARCH_EXT.includes(ext)) { stats.extSkipped++; continue; }
      if (!isRealpathContained(roomDir, full)) { stats.containSkipped++; continue; }
      out.push(path.relative(roomDir, full));
    }
  })(roomDir, 0);
  return { files: out, stats };
}

// The real walker, bounded at 500 by the product. Returns the rel paths it handed to onFile.
function realWalkerFirst(roomDir) {
  const got = [];
  I.walkSearchFiles(roomDir, roomDir, ({ rel }) => got.push(rel));
  return got;
}

// The text the product searches for one file: lines, de-tagged for html. Lower-cased.
function searchText(roomDir, rel) {
  const content = fs.readFileSync(path.join(roomDir, rel), 'utf8');
  let lines = content.split(/\r?\n/);
  const ext = path.extname(rel).toLowerCase();
  if (ext === '.html' || ext === '.htm') lines = I.htmlLinesToText(lines);
  return lines.join('\n').toLowerCase();
}

// Seeded PRNG (mulberry32) so every pick is repeatable.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tok = (s) => Math.ceil(String(s).length / 4); // chars/4, a proxy, not a tokenizer
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const sha8 = (s) => require('node:crypto').createHash('sha1').update(String(s)).digest('hex').slice(0, 8);

module.exports = { REPO, ROOMS, CAP, walkAll, realWalkerFirst, searchText, rng, tok, med, sha8, I, roomMod };
