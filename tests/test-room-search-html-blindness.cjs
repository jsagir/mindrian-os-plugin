#!/usr/bin/env node
// Regression test for room_search's HTML blindness (quick task 260904-ng7).
//
// Root cause: lib/mcp/tools/room.cjs's collectMatches walk dropped every
// non-.md directory entry (`if (!e.name.endsWith('.md')) continue;`) before
// the file was ever opened. Rooms legitimately contain .html briefs,
// rubrics, and decks (the repo's own ARTIFACT_EXT, lib/core/graph-
// backfill.cjs), and every one of them was invisible to room_search: the
// tool reported a clean empty result, so the miss was silent rather than an
// error.
//
// This fixture proves: a term living only in an .html file's rendered body
// text IS found, at its true source line, as readable de-tagged text; a
// term living only in markup (tag name, attribute name, attribute value,
// class token, script/style interior) is NOT found; .txt and .docx stay
// excluded on purpose (D-02, D-03); .md search behavior is byte-identical
// (no new key on the result object); rank-then-cap still holds with .html
// in the walk; and a malformed .html file degrades safely instead of
// throwing.
//
// Node built-in assert only. No runner dep. SKIP-safe if run against a tree
// where the ng7 fix (or Task 1's htmlLinesToText export) has not landed.
// No em-dashes.

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let room;
try {
  room = require('../lib/mcp/tools/room.cjs');
} catch (e) {
  console.log('SKIP: test-room-search-html-blindness -- lib/mcp/tools/room.cjs not present. ' + (e.code || e.message));
  process.exit(0);
}

const { searchRoom, htmlLinesToText } = room._internal || {};
if (typeof searchRoom !== 'function' || typeof htmlLinesToText !== 'function') {
  console.log('SKIP: test-room-search-html-blindness -- searchRoom/htmlLinesToText not exported.');
  process.exit(0);
}

let passed = 0;
function check(label, cond) {
  assert.ok(cond, label);
  passed += 1;
  console.log('  ok - ' + label);
}

// ---------------------------------------------------------------------------
// Fixture 1: the load-bearing .html-only-term room, plus markup-only tokens,
// script/style regions, an entity, adjacent block cells, and D-02/D-03 pins.
// ---------------------------------------------------------------------------
const QUERY = 'acmecorp';
const room1 = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-html-'));

const ATTR_TOKEN = 'zzqqxattrval';
const CLASS_TOKEN = 'zzqqxclasstoken';
const SCRIPT_TOKEN = 'zzqqxscriptident';
const STYLE_TOKEN = 'zzqqxstyleselector';

const bodyLines = [
  '<html>',
  '<head>',
  '<style>',
  '.' + STYLE_TOKEN + ' { color: red; }',
  '</style>',
  '<script>',
  'var ' + SCRIPT_TOKEN + ' = 1;',
  '</script>',
  '</head>',
  '<body>',
  '<h1 data-vendor="' + ATTR_TOKEN + '" class="' + CLASS_TOKEN + '">Client brief</h1>',
  '<p>AcmeCorp is the client. Contact is AT&amp;T.</p>',
  '<table><tr><td>Foo</td><td>Bar</td></tr></table>',
  '</body>',
  '</html>',
];
// Computed, not hardcoded: the line the query term actually lives on.
const EXPECTED_LINE = bodyLines.findIndex((l) => l.toLowerCase().includes(QUERY)) + 1;
fs.writeFileSync(path.join(room1, 'brief.html'), bodyLines.join('\n'), 'utf8');

// An .md file in the SAME room that does NOT contain the term, so a passing
// result cannot be explained by an .md hit.
fs.writeFileSync(path.join(room1, 'unrelated.md'), '# Notes\nNothing about that vendor here.\n', 'utf8');

// D-02 / D-03 pins: still excluded even though they sit in the same room.
fs.writeFileSync(path.join(room1, 'notes.docx'), 'acmecorp inside a docx should not be found');
fs.writeFileSync(path.join(room1, 'scratch.txt'), 'acmecorp inside a txt should not be found');

const htmlHits = searchRoom(room1, QUERY, null);
check('room_search finds a term that appears only inside an .html file body', htmlHits.length >= 1);

const theHit = htmlHits.find((r) => r.file === 'brief.html');
check('the hit is attributed to the .html file', !!theHit);
check('the hit reports the TRUE 1-based source line (computed, not guessed)', theHit && theHit.line === EXPECTED_LINE);
check('the hit snippet is de-tagged (no < or >)', theHit && !/[<>]/.test(theHit.snippet));
check('the hit carries the extracted:true provenance marker', theHit && theHit.extracted === true);

check('a tag/attribute markup-only token produces zero hits', searchRoom(room1, ATTR_TOKEN, null).length === 0);
check('a class-token markup-only value produces zero hits', searchRoom(room1, CLASS_TOKEN, null).length === 0);
check('a <script> interior identifier produces zero hits', searchRoom(room1, SCRIPT_TOKEN, null).length === 0);
check('a <style> interior selector produces zero hits', searchRoom(room1, STYLE_TOKEN, null).length === 0);

const entityHits = searchRoom(room1, 'at&t', null);
check('entity decoding lets a search for at&t match AT&amp;T in source', entityHits.length >= 1);

const noFalseJoin = searchRoom(room1, 'foobar', null);
check('adjacent block cells do not mint the false joined token FooBar', noFalseJoin.length === 0);
const spacedCells = searchRoom(room1, 'foo bar', null);
check('adjacent block cells DO produce the space-joined text "foo bar"', spacedCells.length >= 1);

check('a .docx file in the room is still skipped (D-03)', searchRoom(room1, 'acmecorp', null).every((r) => r.file !== 'notes.docx'));
check('a .txt file in the room is still skipped (D-02)', searchRoom(room1, 'acmecorp', null).every((r) => r.file !== 'scratch.txt'));

try { fs.rmSync(room1, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

// ---------------------------------------------------------------------------
// Fixture 2: .md no-regression -- exact key set, no new field.
// ---------------------------------------------------------------------------
const room2 = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-mdonly-'));
fs.writeFileSync(path.join(room2, 'a.md'), '# Title\nThis line mentions plainmdterm here.\n', 'utf8');
const mdResults = searchRoom(room2, 'plainmdterm', null);
check('md-only room still returns a hit', mdResults.length === 1);
check(
  'md result object has exactly file, line, snippet, match_count (no extracted key)',
  mdResults.length === 1 && Object.keys(mdResults[0]).sort().join(',') === 'file,line,match_count,snippet'
);
try { fs.rmSync(room2, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

// ---------------------------------------------------------------------------
// Fixture 3: rank-then-cap still holds with .html in the walk (reuses the
// shape of tests/test-room-search-rank-before-cap.cjs).
// ---------------------------------------------------------------------------
const room3 = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-html-rank-'));
const EARLY_DIR = path.join(room3, '01_intake');   // sorts first -> walked first
const LATE_DIR = path.join(room3, '99_synthesis'); // sorts last -> walked last
fs.mkdirSync(EARLY_DIR, { recursive: true });
fs.mkdirSync(LATE_DIR, { recursive: true });

const RANK_QUERY = 'zzrankcorp';
const EARLY_FILES = 60; // > SEARCH_MAX_RESULTS (50)
for (let i = 0; i < EARLY_FILES; i++) {
  const name = 'note-' + String(i).padStart(3, '0') + '.md';
  fs.writeFileSync(
    path.join(EARLY_DIR, name),
    ['# Meeting note ' + i, 'A vendor called ' + RANK_QUERY + ' was mentioned in passing.', 'Unrelated rest.'].join('\n'),
    'utf8'
  );
}
const RELEVANT_REL = path.join('99_synthesis', 'analysis.html');
const relevantHtmlLines = [
  '<html><body>',
  '<h1>' + RANK_QUERY + ' deep-dive</h1>',
  '<p>' + RANK_QUERY + ' is the central entity of this analysis.</p>',
  '<p>' + RANK_QUERY + ' revenue grew while ' + RANK_QUERY + ' margins compressed.</p>',
  '<p>The ' + RANK_QUERY + ' board approved the restructuring.</p>',
  '<p>Every open question about ' + RANK_QUERY + ' is tracked below.</p>',
  '<p>' + RANK_QUERY + ' again, to make this unambiguously relevant.</p>',
  '</body></html>',
];
fs.writeFileSync(path.join(room3, RELEVANT_REL), relevantHtmlLines.join('\n'), 'utf8');

const now = Date.now();
for (let i = 0; i < EARLY_FILES; i++) {
  const name = 'note-' + String(i).padStart(3, '0') + '.md';
  const old = new Date(now - 30 * 24 * 3600 * 1000);
  fs.utimesSync(path.join(EARLY_DIR, name), old, old);
}
fs.utimesSync(path.join(room3, RELEVANT_REL), new Date(now), new Date(now));

const rankResults = searchRoom(room3, RANK_QUERY, null);
const relevantRankHits = rankResults.filter((r) => r.file === RELEVANT_REL);
check('a late-walked, term-dense .html file survives the 50-slot cap', relevantRankHits.length > 0);
check('the relevant .html file ranks first', rankResults.length > 0 && rankResults[0].file === RELEVANT_REL);
const rankPerFileCounts = rankResults.reduce((acc, r) => {
  acc[r.file] = (acc[r.file] || 0) + 1;
  return acc;
}, {});
check('per-file slice cap (max 5) still holds with .html in the walk', Math.max(...Object.values(rankPerFileCounts)) <= 5);
check('result count stays bounded by the 50-slot cap', rankResults.length <= 50);

try { fs.rmSync(room3, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

// ---------------------------------------------------------------------------
// Fixture 4: malformed .html degrades safely; the walk continues.
// ---------------------------------------------------------------------------
const room4 = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-html-malformed-'));
fs.writeFileSync(
  path.join(room4, 'broken.html'),
  '<html><body><p>zzmalformedterm has an unclosed tag <div and a stray < right here.</p></body></html>',
  'utf8'
);
fs.writeFileSync(path.join(room4, 'sibling.html'), '<html><body><p>zzsiblingterm is fine.</p></body></html>', 'utf8');

let threw = false;
let malformedResults = [];
try {
  malformedResults = searchRoom(room4, 'zzsiblingterm', null);
} catch (_e) {
  threw = true;
}
check('searchRoom does not throw when a malformed .html file is in the room', !threw);
check('a sibling well-formed file in the same room still returns its hit', malformedResults.some((r) => r.file === 'sibling.html'));

try { fs.rmSync(room4, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

console.log('PASS: test-room-search-html-blindness -- ' + passed + ' checks');
process.exit(0);
