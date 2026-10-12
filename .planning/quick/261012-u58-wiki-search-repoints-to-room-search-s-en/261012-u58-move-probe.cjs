'use strict';
// Quick 261012-u58 planning probe: the mechanical engine move.
//
// Usage: node 261012-u58-move-probe.cjs <tree-root>
//
// Moves the room_search engine block (from the "Bounded search over the room's
// markdown" comment to the closing brace of searchRoom) out of
// <tree-root>/lib/mcp/tools/room.cjs into <tree-root>/lib/core/room-search.cjs,
// adds the scope resolver (SECTION_RE, one segment) and the two additive walk
// options (includeFile, maxPerFile), and rewrites room.cjs to require the core
// module and re-export the same _internal names.
//
// The planner ran it against a scratch copy of HEAD 3677f2a9e (git archive of
// lib, data, references and the named tests, node_modules symlinked). After it:
// test-room-search-natural-language 50 checks, walk-bound 50, rank-before-cap 7,
// html-blindness 22 (all PASS, the same counts as before the move) and
// test-270-no-second-walker 4 rules, 6 files, PASS.
//
// The executor may run it against the repo root to do the byte-exact move, then
// MUST replace the one-line probe header of lib/core/room-search.cjs with the
// real header the plan names and remove the now-unused requires from room.cjs.
// It refuses to run when lib/core/room-search.cjs already exists or when a
// marker line is missing. No em-dash, no en-dash.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.argv[2];
if (!ROOT) { console.error('usage: node 261012-u58-move-probe.cjs <tree-root>'); process.exit(2); }
const roomPath = path.join(ROOT, 'lib/mcp/tools/room.cjs');
const corePath = path.join(ROOT, 'lib/core/room-search.cjs');
if (fs.existsSync(corePath)) { console.error('refuse: ' + corePath + ' already exists'); process.exit(2); }

const src = fs.readFileSync(roomPath, 'utf8');
const lines = src.split('\n');
const start = lines.findIndex((l) => l.startsWith("// Bounded search over the room's markdown"));
const endFn = lines.findIndex((l, i) => i > start && l.startsWith('function searchRoom(roomDir, query, section)'));
if (start === -1 || endFn === -1) { console.error('refuse: engine markers not found'); process.exit(2); }
let end = endFn;
while (end < lines.length && lines[end] !== '}') end += 1;
if (end >= lines.length) { console.error('refuse: end of searchRoom not found'); process.exit(2); }
let engine = lines.slice(start, end + 1).join('\n');

function mustReplace(from, to) {
  if (engine.indexOf(from) === -1) { console.error('refuse: anchor not found: ' + from.slice(0, 60)); process.exit(2); }
  engine = engine.replace(from, to);
}

// Scope resolver: the core module never requires lib/mcp/tool-router.cjs.
mustReplace(
  'const scopeDir = safeResolveSection(roomDir, section || null);',
  'const scopeDir = resolveSearchScope(roomDir, section || null);'
);
// includeFile: a caller-supplied filter, applied after the extension check and
// before the containment check and the walkable count.
mustReplace(
  '  const maxFiles = resolveMaxFiles(options);\n',
  "  const maxFiles = resolveMaxFiles(options);\n  const include = options && typeof options.includeFile === 'function' ? options.includeFile : null;\n"
);
mustReplace(
  "      if (!SEARCH_EXT.includes(ext)) continue;\n",
  "      if (!SEARCH_EXT.includes(ext)) continue;\n      if (include !== null && !include(path.relative(roomDir, full))) continue;\n"
);
// maxPerFile: the phrase-tier slice per file (default SEARCH_MAX_PER_FILE).
mustReplace(
  'function rankMatches(perFile) {',
  'function rankMatches(perFile, perFileCap) {\n  const cap = Number.isInteger(perFileCap) && perFileCap >= 1 ? perFileCap : SEARCH_MAX_PER_FILE;'
);
mustReplace(
  'const slice = f.matches.slice(0, SEARCH_MAX_PER_FILE);',
  'const slice = f.matches.slice(0, cap);'
);
mustReplace(
  'const phrase = rankMatches(scan.phrasePerFile);',
  'const phrase = rankMatches(scan.phrasePerFile, options && options.maxPerFile);'
);

const core = [
  "'use strict';",
  '// PROBE HEADER: replace with the real header (quick 261012-u58 plan, Task 2).',
  '',
  "const fs = require('node:fs');",
  "const path = require('node:path');",
  "const { isRealpathContained, assertRealpathContained } = require('./room-path-containment.cjs');",
  '',
  '// One path segment of lower-case letters, digits and hyphens. The same literal',
  '// as SECTION_RE in lib/mcp/tool-router.cjs (a test pins the equality).',
  'const SECTION_RE = /^[a-z0-9-]+$/;',
  '',
  'function resolveSearchScope(roomDir, section) {',
  '  const base = path.resolve(roomDir);',
  "  if (section === null || section === undefined || section === '') return base;",
  "  if (typeof section !== 'string' || !SECTION_RE.test(section)) {",
  "    throw new Error('section must match [a-z0-9-]+');",
  '  }',
  '  const resolved = path.resolve(base, section);',
  '  if (resolved !== base && !resolved.startsWith(base + path.sep)) {',
  "    throw new Error('section path traversal rejected: ' + section);",
  '  }',
  "  assertRealpathContained(base, resolved, 'section ' + section);",
  '  return resolved;',
  '}',
  '',
  engine,
  '',
  'module.exports = {',
  '  searchRoomDetailed,',
  '  searchRoom,',
  '  resolveSearchScope,',
  '  SECTION_RE,',
  '  _internal: {',
  '    collectMatches, rankMatches, htmlLinesToText, queryWords, scoreWordTier, walkSearchFiles,',
  '    collectWordStats, scanSearchScope, scoreWordStats, SEARCH_MAX_FILES, SEARCH_MAX_PER_FILE,',
  '    SEARCH_FLOOR_MIN_WORDS, SEARCH_FLOOR_MIN_IDF_SHARE,',
  '  },',
  '};',
  '',
].join('\n');

const shim = [
  '// The search engine lives in lib/core/room-search.cjs (quick 261012-u58) so the',
  '// wiki /api/search and this tool share one engine. This module keeps the MCP',
  '// tool, its envelope and the _internal names the room_search tests read.',
  "const roomSearch = require('../../core/room-search.cjs');",
  'const { searchRoomDetailed, searchRoom } = roomSearch;',
  'const {',
  '  collectMatches, rankMatches, htmlLinesToText, queryWords, scoreWordTier, walkSearchFiles,',
  '  collectWordStats, scanSearchScope, scoreWordStats, SEARCH_MAX_FILES,',
  '  SEARCH_FLOOR_MIN_WORDS, SEARCH_FLOOR_MIN_IDF_SHARE,',
  '} = roomSearch._internal;',
].join('\n');

let room = lines.slice(0, start).join('\n') + '\n' + shim + '\n' + lines.slice(end + 1).join('\n');
function roomReplace(from, to) {
  if (room.indexOf(from) === -1) { console.error('refuse: room.cjs anchor not found: ' + from.slice(0, 60)); process.exit(2); }
  room = room.replace(from, to);
}
roomReplace(
  "const { SECTION_RE, safeResolveSection } = require('../tool-router.cjs')._test;",
  "const { SECTION_RE } = require('../tool-router.cjs')._test;"
);
roomReplace("const { isRealpathContained } = require('../../core/room-path-containment.cjs');\n", '');

fs.writeFileSync(corePath, core);
fs.writeFileSync(roomPath, room);
console.log('moved: engine ' + engine.split('\n').length + ' lines; room.cjs now ' + room.split('\n').length + ' lines; core ' + core.split('\n').length + ' lines');
