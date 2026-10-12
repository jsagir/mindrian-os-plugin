#!/usr/bin/env node
// Quick 261012-kfn: room_search natural-language word tier.
//
// Proves, on a fixture room only (no real room is read):
//   - a sentence query finds the right file through the word tier (BM25);
//   - an exact phrase hit still wins and keeps its old result rows;
//   - a question with no usable words, or no matching words, or too few
//     matching words, returns an empty result with a reason code;
//   - the word tier never follows a symlink, never reads outside the room,
//     reads every file of a 501-file room (5,000-file bound, quick 261012-rxc),
//     and reads html as text;
//   - the tool envelope carries tier, words and reason fields.
//
// RED state: before the word tier exists, the exports are missing and this
// test exits 1 with "word tier not exported".
//
// Node built-ins only. No em-dash and no en-dash in this file.

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Hermetic environment, set before any repo code loads.
const HOME_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-nl-home-'));
process.env.HOME = HOME_DIR;
process.env.USERPROFILE = HOME_DIR;
process.env.MINDRIAN_ROOMS_HOME = path.join(HOME_DIR, 'rooms');
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.CLAUDE_ACTIVE_ROOM;

let room;
try {
  room = require('../lib/mcp/tools/room.cjs');
} catch (e) {
  console.log('SKIP: test-room-search-natural-language -- room.cjs not present. ' + (e.code || e.message));
  process.exit(0);
}

const internal = room._internal || {};
if (
  typeof internal.searchRoomDetailed !== 'function'
  || typeof internal.scoreWordTier !== 'function'
  || typeof internal.queryWords !== 'function'
) {
  console.log('FAIL: test-room-search-natural-language -- word tier not exported');
  try { fs.rmSync(HOME_DIR, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(1);
}
const { searchRoom, searchRoomDetailed, scoreWordTier } = internal;

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
// Fixture room R, outside dir O, bound room B.
// ---------------------------------------------------------------------------
const R = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-nl-'));
const O = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-nl-out-'));
const B = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-nl-bound-'));

write(R, 'ROOM.md', '# Fixture room\nA small room for the room search word tier test.\n');
write(R, 'research/pelican-ledger.md',
  '# Pelican migration ledger\nThe ledger records every heron and pelican sighting along the estuary.\nEach migration window is logged with the observer name.\n');
write(R, 'research/otter-notes.md', '# Otter notes\nThe otter dam survey ran in spring.\n');
write(R, 'research/otter-scatter.md',
  '# Field log\nOtter tracks near the dam.\nA survey of the otter population.\nThe dam held. Another otter survey later.\nDam, otter, survey, dam, otter, survey.\n');
write(R, 'research/walrus-real.md', '# Walrus\nThe walrus ledger is kept in the south archive.\n');
write(R, 'meetings/budget.md', '# Budget review\nThe forecast for next year is flat.\n');

const htmlLines = [
  '<html><head><style>.zzstyletok { color: red; }</style><script>var zzscripttok = 1;</script></head><body>',
  '<h1 data-x="zzattrtok">Field brief</h1>',
  '<p>The census counted forty kestrel nests near the quarry.</p>',
  '</body></html>',
];
write(R, 'meetings/brief.html', htmlLines.join('\n'));
const kestrelLine = htmlLines.findIndex((l) => l.includes('kestrel')) + 1;

write(O, 'walrus-ledger.md', 'The walrus ledger is kept in the north vault.\n');
fs.symlinkSync(path.join(O, 'walrus-ledger.md'), path.join(R, 'research', 'walrus-link.md'));
write(O, 'dir/deep.md', 'The quokka census sheet lists every burrow.\n');
fs.symlinkSync(path.join(O, 'dir'), path.join(R, 'linked-dir'));

for (let i = 0; i <= 500; i++) {
  const name = 'f-' + String(i).padStart(3, '0') + '.md';
  let body = '# Filler ' + i + '\nplain filler text\n';
  if (i === 499) body += 'zzinbound zzinother here\n';
  if (i === 500) body += 'zzpastbound zzpastother here\n';
  write(B, name, body);
}

function cleanup() {
  for (const d of [R, O, B, HOME_DIR]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

async function main() {
  // --- Word tier finds the right file for a sentence ------------------------
  const pel = searchRoomDetailed(R, 'Which ledger records the heron and pelican migration?', null);
  check('sentence query uses the words tier', pel.tier === 'words');
  check('sentence query puts the pelican ledger first', pel.results.length > 0 && pel.results[0].file === path.join('research', 'pelican-ledger.md'));
  check('each word-tier row has numeric line, match_count and words_matched',
    pel.results.every((r) => typeof r.line === 'number' && typeof r.match_count === 'number' && typeof r.words_matched === 'number'));
  check('words list is returned', Array.isArray(pel.words) && pel.words.includes('pelican'));

  // --- Phrase hit wins over a stronger word-only file -----------------------
  const ott = searchRoomDetailed(R, 'otter dam survey', null);
  check('phrase query uses the phrase tier', ott.tier === 'phrase');
  check('phrase hit file comes first', ott.results[0].file === path.join('research', 'otter-notes.md'));
  check('no row from the word-only file', ott.results.every((r) => r.file !== path.join('research', 'otter-scatter.md')));
  const ctrl = scoreWordTier(R, R, ['otter', 'dam', 'survey']);
  check('control: the word tier alone ranks the scatter file first', ctrl.length > 0 && ctrl[0].file === path.join('research', 'otter-scatter.md'));

  // --- Phrase rows are unchanged ---------------------------------------------
  let same = true;
  try {
    assert.deepStrictEqual(ott.results, searchRoom(R, 'otter dam survey', null));
  } catch (_e) { same = false; }
  check('phrase-tier rows are deep-equal to searchRoom', same);
  check('searchRoom still returns an array', Array.isArray(searchRoom(R, 'otter dam survey', null)));
  check('md phrase row key set is exactly file, line, match_count, snippet',
    JSON.stringify(Object.keys(ott.results[0]).sort()) === JSON.stringify(['file', 'line', 'match_count', 'snippet']));

  // --- Reasons ---------------------------------------------------------------
  for (const q of ['What is it about, and why?', 'a b c d']) {
    const r = searchRoomDetailed(R, q, null);
    check('no search words: tier none for "' + q + '"', r.tier === 'none' && r.results.length === 0);
    check('no search words: reason_code for "' + q + '"', r.reason_code === 'no_search_words');
    check('no search words: reason text for "' + q + '"', typeof r.reason === 'string' && r.reason.length > 0);
  }
  const bak = searchRoomDetailed(R, 'What is the quarterly revenue forecast for the bakery franchise?', null);
  check('unanswerable question returns no results', bak.results.length === 0);
  check('unanswerable question: below_relevance_floor', bak.reason_code === 'below_relevance_floor');
  const unk = searchRoomDetailed(R, 'zzunknownword qqmissingterm', null);
  check('unknown words return no results', unk.results.length === 0);
  check('unknown words: no_match', unk.reason_code === 'no_match');

  // --- Symlinks and containment ---------------------------------------------
  const wal = searchRoomDetailed(R, 'Where is the walrus ledger kept?', null);
  check('walrus question finds the real file', wal.results.some((r) => r.file === path.join('research', 'walrus-real.md')));
  check('walrus question never returns the symlinked file', wal.results.every((r) => r.file !== path.join('research', 'walrus-link.md')));
  check('outside text never appears in the output', !JSON.stringify(wal).includes('north vault'));
  const quo = searchRoomDetailed(R, 'Which sheet lists the quokka burrow census?', null);
  check('symlinked directory is never read (result)', quo.results.every((r) => !r.file.startsWith('linked-dir')));
  const quoScores = scoreWordTier(R, R, internal.queryWords('Which sheet lists the quokka burrow census?'));
  check('symlinked directory is never read (before the floor)', quoScores.every((s) => !s.file.startsWith('linked-dir')));
  check('scope outside the room reads nothing', scoreWordTier(O, R, ['walrus', 'ledger', 'kept']).length === 0);

  // --- Walk bound ------------------------------------------------------------
  const inb = searchRoomDetailed(B, 'Where is zzinbound with zzinother?', null);
  check('word in file 500 is found', inb.results.some((r) => r.file === 'f-499.md'));
  const pastb = searchRoomDetailed(B, 'Where is zzpastbound with zzpastother?', null);
  check('word in file 501 is found (quick 261012-rxc reads every file up to 5,000)', pastb.results.some((r) => r.file === 'f-500.md'));
  check('501-file room: scanned 501, walkable 501, truncated false', pastb.scanned === 501 && pastb.walkable === 501 && pastb.truncated === false);

  // --- HTML ------------------------------------------------------------------
  const htm = searchRoomDetailed(R, 'Which census counted kestrel nests near the quarry?', null);
  const htmRow = htm.results.find((r) => r.file === path.join('meetings', 'brief.html'));
  check('html file is found by the word tier', !!htmRow);
  check('html row is marked extracted', htmRow && htmRow.extracted === true);
  check('html row carries the true 1-based line', htmRow && htmRow.line === kestrelLine);
  check('html snippet has no angle brackets', htmRow && !/[<>]/.test(htmRow.snippet));
  const mk = searchRoomDetailed(R, 'zzattrtok zzscripttok zzstyletok?', null);
  check('markup-only tokens are not found', mk.results.length === 0);
  check('markup-only tokens: no_match', mk.reason_code === 'no_match');

  // --- Section scope ---------------------------------------------------------
  const scoped = searchRoomDetailed(R, 'Which ledger records the heron and pelican migration?', 'meetings');
  check('section scope excludes files outside the section', scoped.results.length === 0);

  // --- Tool envelope ---------------------------------------------------------
  process.env.CLAUDE_ACTIVE_ROOM = R;
  const handlers = new Map();
  room.register({ registerTool(name, _cfg, handler) { handlers.set(name, handler); } }, {});
  const handler = handlers.get('room_search');
  check('room_search handler is registered', typeof handler === 'function');
  function parse(res) { return JSON.parse(res.content[0].text); }

  const e1 = parse(await handler({ query: 'Which ledger records the heron and pelican migration?' }, {}));
  check('envelope room_dir is the fixture room (got ' + e1.room_dir + ')', e1.room_dir === R);
  check('envelope sentence query: tier words', e1.tier === 'words');
  check('envelope sentence query: words array', Array.isArray(e1.words) && e1.words.length > 0);
  check('envelope sentence query: results', Array.isArray(e1.results) && e1.results.length > 0);
  check('envelope sentence query: no reason fields', !('reason_code' in e1) && !('reason' in e1));

  const e2 = parse(await handler({ query: 'What is the quarterly revenue forecast for the bakery franchise?' }, {}));
  check('envelope bakery question: tier none', e2.tier === 'none');
  check('envelope bakery question: empty results', Array.isArray(e2.results) && e2.results.length === 0);
  check('envelope bakery question: reason_code and reason', e2.reason_code === 'below_relevance_floor' && typeof e2.reason === 'string' && e2.reason.length > 0);

  const e3 = parse(await handler({ query: 'otter dam survey' }, {}));
  check('envelope phrase query: tier phrase', e3.tier === 'phrase');
  check('envelope phrase query: no words key', !('words' in e3));

  // --- Static: no em-dash or en-dash in this file ----------------------------
  const own = fs.readFileSync(__filename, 'utf8');
  check('test file has no em-dash', own.indexOf(String.fromCharCode(0x2014)) === -1);
  check('test file has no en-dash', own.indexOf(String.fromCharCode(0x2013)) === -1);

  cleanup();
  console.log('PASS: test-room-search-natural-language -- ' + passed + ' checks');
  process.exit(0);
}

main().catch((e) => {
  console.log('FAIL: test-room-search-natural-language -- ' + (e && e.message ? e.message : String(e)));
  cleanup();
  process.exit(1);
});
