#!/usr/bin/env node
// Quick 261012-rxc: room_search walks every room file up to a 5,000-file safety
// bound, reads each file once, and reports scanned, walkable and truncated.
//
// Proves, on a fixture room only (no real room is read):
//   - the walk bound is 5,000 and can be injected per call (options.maxFiles);
//   - a term that lives only in the last file is found when the bound allows it;
//   - when the bound stops the walk, the result and the tool envelope say so
//     (scanned, walkable, truncated) and an empty reason states where it stopped;
//   - when the walk is not truncated, the three empty-reply reasons are
//     byte-identical to the texts before this change;
//   - dot folders, non-room extensions and symlinks never count as walkable;
//   - one call reads each file once, also for a sentence query.
//
// RED state: before the bound is lifted and the single scan exists, the exports
// are missing and this test exits 1 with "walk bound not exported".
//
// Node built-ins only. No em-dash and no en-dash in this file.

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Hermetic environment, set before any repo code loads.
const HOME_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-walk-home-'));
process.env.HOME = HOME_DIR;
process.env.USERPROFILE = HOME_DIR;
process.env.MINDRIAN_ROOMS_HOME = path.join(HOME_DIR, 'rooms');
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.CLAUDE_ACTIVE_ROOM;

let room;
try {
  room = require('../lib/mcp/tools/room.cjs');
} catch (e) {
  console.log('SKIP: test-room-search-walk-bound -- room.cjs not present. ' + (e.code || e.message));
  process.exit(0);
}

const internal = room._internal || {};
if (internal.SEARCH_MAX_FILES !== 5000 || typeof internal.scanSearchScope !== 'function') {
  console.log('FAIL: test-room-search-walk-bound -- walk bound not exported');
  try { fs.rmSync(HOME_DIR, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(1);
}
const { searchRoomDetailed, walkSearchFiles } = internal;

let passed = 0;
function check(label, cond) {
  assert.ok(cond, label);
  passed += 1;
  console.log('  ok - ' + label);
}

function write(base, rel, text) {
  const full = path.join(base, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text, 'utf8');
}

// ---------------------------------------------------------------------------
// Fixture room T (13 walkable files) and outside dir O.
// ---------------------------------------------------------------------------
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-walk-'));
const O = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-walk-out-'));

write(T, 'ROOM.md', '# Walk bound fixture\nA room for the walk bound test.\n');
write(T, 'research/r-00.md', '# Budget note\nThe forecast for next year is flat.\n');
for (let i = 1; i <= 10; i++) {
  write(T, 'research/r-' + String(i).padStart(2, '0') + '.md', '# Filler ' + i + '\nplain filler text\n');
}
write(T, 'research/r-11.md', '# Last file\nThis file holds the zzlastterm marker.\n');
write(T, 'research/notes.txt', 'zzlastterm in a text file\n');
write(T, '.mindrian/hidden.md', 'zzlastterm in a dot folder\n');
write(O, 'outside.md', 'zzlastterm outside the room\n');
fs.symlinkSync(path.join(O, 'outside.md'), path.join(T, 'research', 'zz-link.md'));

const LAST = path.join('research', 'r-11.md');

// Reason texts before this change (copied from SEARCH_REASONS at HEAD).
const HEAD_REASONS = {
  no_search_words: 'No file contains this exact text, and the question has no words left to search for once common words and very short words are set aside.',
  no_match: 'No file contains this exact text or any of its search words.',
  below_relevance_floor: 'Some files share a few words with the question, but none matches enough of it to be an answer.',
};
// Reason texts after a truncated walk (S 10, W 13).
const TRUNC_10_13 = 'The search stopped at 10 of 13 files, so 3 files were not read. ';
const TRUNC_REASONS = {
  no_search_words: 'None of the files it read contains this exact text, and the question has no words left to search for once common words and very short words are set aside.',
  no_match: 'None of the files it read contains this exact text or any of its search words.',
  below_relevance_floor: 'Some files it read share a few words with the question, but none matches enough of it to be an answer.',
};

function cleanup() {
  for (const d of [T, O, HOME_DIR]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

// Record each readFileSync call that touches the fixture or the outside dir.
function countReads(fn) {
  const orig = fs.readFileSync;
  const seen = [];
  const keys = [path.basename(T), path.basename(O)];
  fs.readFileSync = function wrapped(p, ...rest) {
    if (typeof p === 'string' && keys.some((k) => p.includes(k))) seen.push(p);
    return orig.call(fs, p, ...rest);
  };
  try {
    fn();
  } finally {
    fs.readFileSync = orig;
  }
  return seen;
}

async function main() {
  // --- Bound in place -------------------------------------------------------
  const cut = searchRoomDetailed(T, 'zzlastterm', null, { maxFiles: 10 });
  check('bound 10: tier none', cut.tier === 'none' && cut.results.length === 0);
  check('bound 10: reason_code no_match', cut.reason_code === 'no_match');
  check('bound 10: scanned 10, walkable 13, truncated true', cut.scanned === 10 && cut.walkable === 13 && cut.truncated === true);
  check('bound 10: reason says where the search stopped', cut.reason === TRUNC_10_13 + TRUNC_REASONS.no_match);

  // --- Bound lifted ---------------------------------------------------------
  const full = searchRoomDetailed(T, 'zzlastterm', null);
  check('default bound: tier phrase', full.tier === 'phrase');
  check('default bound: the last file is found', full.results.some((r) => r.file === LAST));
  check('default bound: scanned 13, walkable 13, truncated false', full.scanned === 13 && full.walkable === 13 && full.truncated === false);
  check('default bound: no reason_code key', !('reason_code' in full) && !('reason' in full));

  // --- Bound equal to the room ----------------------------------------------
  const eq = searchRoomDetailed(T, 'zzlastterm', null, { maxFiles: 13 });
  check('bound 13: not truncated', eq.truncated === false && eq.scanned === 13 && eq.walkable === 13);
  const one = searchRoomDetailed(T, 'zzlastterm', null, { maxFiles: 12 });
  check('bound 12: reason uses the 1 file wording',
    typeof one.reason === 'string' && one.reason.startsWith('The search stopped at 12 of 13 files, so 1 file was not read. '));

  // --- Invalid bound values fall back to the default ------------------------
  for (const bad of [0, -1, 2.5, '10', NaN, null]) {
    const r = searchRoomDetailed(T, 'zzlastterm', null, { maxFiles: bad });
    check('invalid bound ' + String(bad) + ' falls back to the default',
      r.truncated === false && r.results.some((x) => x.file === LAST));
  }

  // --- Reasons: byte-identical when not truncated, new text when truncated --
  const bakeryQ = 'What is the quarterly revenue forecast for the bakery franchise?';
  const bak = searchRoomDetailed(T, bakeryQ, null);
  check('floor, no bound: code below_relevance_floor', bak.reason_code === 'below_relevance_floor');
  check('floor, no bound: reason equals the old text', bak.reason === HEAD_REASONS.below_relevance_floor);
  const bakCut = searchRoomDetailed(T, bakeryQ, null, { maxFiles: 10 });
  check('floor, bound 10: reason equals the truncated text',
    bakCut.reason_code === 'below_relevance_floor' && bakCut.reason === TRUNC_10_13 + TRUNC_REASONS.below_relevance_floor);

  const unk = searchRoomDetailed(T, 'zzunknownword qqmissingterm', null);
  check('no match, no bound: reason equals the old text', unk.reason_code === 'no_match' && unk.reason === HEAD_REASONS.no_match);

  const nsw = searchRoomDetailed(T, 'What is it about, and why?', null);
  check('no search words, no bound: reason equals the old text',
    nsw.reason_code === 'no_search_words' && nsw.reason === HEAD_REASONS.no_search_words);
  const nswCut = searchRoomDetailed(T, 'What is it about, and why?', null, { maxFiles: 10 });
  check('no search words, bound 10: reason equals the truncated text',
    nswCut.reason_code === 'no_search_words' && nswCut.reason === TRUNC_10_13 + TRUNC_REASONS.no_search_words);
  check('no search words, bound 10: walk fields present', nswCut.scanned === 10 && nswCut.walkable === 13 && nswCut.truncated === true);

  // --- Truncated with results -----------------------------------------------
  const part = searchRoomDetailed(T, 'plain filler text', null, { maxFiles: 10 });
  check('truncated with results: tier phrase and rows', part.tier === 'phrase' && part.results.length > 0);
  check('truncated with results: walk fields', part.truncated === true && part.scanned === 10 && part.walkable === 13);
  check('truncated with results: no reason keys', !('reason_code' in part) && !('reason' in part));

  // --- Section scope --------------------------------------------------------
  const secCut = searchRoomDetailed(T, 'zzlastterm', 'research', { maxFiles: 10 });
  check('section, bound 10: scanned 10, walkable 12, truncated true', secCut.scanned === 10 && secCut.walkable === 12 && secCut.truncated === true);
  check('section, bound 10: reason names 10 of 12',
    secCut.reason === 'The search stopped at 10 of 12 files, so 2 files were not read. ' + TRUNC_REASONS.no_match);
  const secFull = searchRoomDetailed(T, 'zzlastterm', 'research');
  check('section, default bound: the last file is found', secFull.results.some((r) => r.file === LAST));
  check('section, default bound: scanned 12, walkable 12, truncated false', secFull.scanned === 12 && secFull.walkable === 12 && secFull.truncated === false);

  // --- Walker ---------------------------------------------------------------
  let calls = 0;
  const wCut = walkSearchFiles(T, T, () => { calls += 1; }, { maxFiles: 10 });
  check('walker, bound 10: 10 callbacks', calls === 10);
  check('walker, bound 10: returns scanned 10, walkable 13, truncated true',
    wCut.scanned === 10 && wCut.walkable === 13 && wCut.truncated === true);
  calls = 0;
  const wAll = walkSearchFiles(T, T, () => { calls += 1; });
  check('walker, default bound: 13 callbacks', calls === 13);
  check('walker, default bound: returns scanned 13, walkable 13, truncated false',
    wAll.scanned === 13 && wAll.walkable === 13 && wAll.truncated === false);

  // --- One read per file ----------------------------------------------------
  const sentence = 'Which file holds the zzlastterm marker?';
  let sres;
  const reads = countReads(() => { sres = searchRoomDetailed(T, sentence, null); });
  check('sentence query: tier words, last file first', sres.tier === 'words' && sres.results[0].file === LAST);
  check('sentence query: 13 reads', reads.length === 13);
  check('sentence query: 13 distinct files, each read once', new Set(reads).size === 13);
  check('sentence query: no read path under the outside dir', reads.every((p) => !p.includes(path.basename(O))));

  let sresCut;
  const readsCut = countReads(() => { sresCut = searchRoomDetailed(T, sentence, null, { maxFiles: 10 }); });
  check('sentence query, bound 10: truncated true', sresCut.truncated === true && sresCut.scanned === 10);
  check('sentence query, bound 10: 10 distinct files, each read once', readsCut.length === 10 && new Set(readsCut).size === 10);
  check('sentence query, bound 10: files 09, 10 and 11 are never read',
    readsCut.every((p) => !/r-(09|10|11)\.md$/.test(p)));

  // --- Tool envelope --------------------------------------------------------
  process.env.CLAUDE_ACTIVE_ROOM = T;
  const handlers = new Map();
  room.register({ registerTool(name, _cfg, handler) { handlers.set(name, handler); } }, {});
  const handler = handlers.get('room_search');
  check('room_search handler is registered', typeof handler === 'function');
  function parse(res) { return JSON.parse(res.content[0].text); }

  const e1 = parse(await handler({ query: 'zzlastterm' }, {}));
  check('envelope room_dir is the fixture room (got ' + e1.room_dir + ')', e1.room_dir === T);
  check('envelope phrase query: tier phrase', e1.tier === 'phrase');
  check('envelope phrase query: scanned 13, walkable 13, truncated false', e1.scanned === 13 && e1.walkable === 13 && e1.truncated === false);

  const e2 = parse(await handler({ query: bakeryQ }, {}));
  check('envelope bakery question: tier none and walk fields',
    e2.tier === 'none' && e2.scanned === 13 && e2.walkable === 13 && e2.truncated === false);
  check('envelope bakery question: old reason text',
    e2.reason_code === 'below_relevance_floor' && e2.reason === HEAD_REASONS.below_relevance_floor);

  const e3 = parse(await handler({ query: sentence }, {}));
  check('envelope sentence query: tier words and walk fields',
    e3.tier === 'words' && e3.scanned === 13 && e3.walkable === 13 && e3.truncated === false);

  // --- Static: no em-dash or en-dash in this file ---------------------------
  const own = fs.readFileSync(__filename, 'utf8');
  check('test file has no em-dash', own.indexOf(String.fromCharCode(0x2014)) === -1);
  check('test file has no en-dash', own.indexOf(String.fromCharCode(0x2013)) === -1);

  cleanup();
  console.log('PASS: test-room-search-walk-bound -- ' + passed + ' checks');
  process.exit(0);
}

main().catch((e) => {
  console.log('FAIL: test-room-search-walk-bound -- ' + (e && e.message ? e.message : String(e)));
  cleanup();
  process.exit(1);
});
