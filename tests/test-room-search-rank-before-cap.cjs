#!/usr/bin/env node
// Regression test for graph-query-results-unranked (room_search leg).
//
// Root cause (see .planning/debug/graph-query-results-unranked.md): the old
// searchRoom pushed matches in raw filesystem directory-entry order and
// hard-`return`ed the instant results hit SEARCH_MAX_RESULTS (50). The cap
// landed BEFORE any relevance ordering, so a genuinely relevant match in a
// late-traversed folder was silently dropped once 50 incidental early-folder
// hits filled the payload, and one entity-heavy file could monopolize the
// whole budget with near-duplicate same-entity lines.
//
// This fixture reproduces exactly that shape: an EARLY directory (sorts first,
// walked first) packed with >50 incidental single-line hits -- enough to have
// blown the old 50-slot cap on its own -- plus a genuinely relevant file in a
// LATE directory (sorts last, walked last) that the old walk would never have
// reached. The test asserts the late relevant match now survives, that no
// single file monopolizes the budget, and that the cap still bounds the output.
//
// Node built-in assert only. No runner dep. No em-dashes.

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let room;
try {
  room = require('../lib/mcp/tools/room.cjs');
} catch (e) {
  console.log('SKIP: test-room-search-rank-before-cap -- lib/mcp/tools/room.cjs not present. ' + (e.code || e.message));
  process.exit(0);
}

const { searchRoom } = room._internal || {};
if (typeof searchRoom !== 'function') {
  console.log('SKIP: test-room-search-rank-before-cap -- searchRoom not exported.');
  process.exit(0);
}

let passed = 0;
function check(label, cond) {
  assert.ok(cond, label);
  passed += 1;
  console.log('  ok - ' + label);
}

// ---------------------------------------------------------------------------
// Build the fixture room.
// ---------------------------------------------------------------------------
const QUERY = 'acmecorp';
const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-search-'));
const EARLY_DIR = path.join(roomDir, '01_intake');    // sorts first -> walked first
const LATE_DIR = path.join(roomDir, '99_synthesis');  // sorts last  -> walked last
fs.mkdirSync(EARLY_DIR, { recursive: true });
fs.mkdirSync(LATE_DIR, { recursive: true });

// 60 early files, each with ONE incidental passing mention of the query term.
// 60 > SEARCH_MAX_RESULTS (50), so under the OLD arrival-order cap the walk
// filled all 50 slots from 01_intake and returned before ever reaching
// 99_synthesis -- the late relevant file's matches were 0 in the payload.
const EARLY_FILES = 60;
for (let i = 0; i < EARLY_FILES; i++) {
  const name = 'note-' + String(i).padStart(3, '0') + '.md';
  const body = [
    '# Meeting note ' + i,
    'A vendor called AcmeCorp was mentioned in passing here.',
    'The rest of this note is about something unrelated.',
  ].join('\n');
  fs.writeFileSync(path.join(EARLY_DIR, name), body, 'utf8');
}

// One genuinely relevant file in the LATE directory: the query term is the
// actual topic and appears many times (higher match count -> higher rank).
const RELEVANT_REL = path.join('99_synthesis', 'acmecorp-analysis.md');
const relevantBody = [
  '# AcmeCorp deep-dive',
  'AcmeCorp is the central entity of this analysis.',
  'AcmeCorp revenue grew while AcmeCorp margins compressed.',
  'The AcmeCorp board approved the AcmeCorp restructuring.',
  'Every open question about AcmeCorp is tracked below.',
  'AcmeCorp again, to make this unambiguously the relevant file.',
].join('\n');
fs.writeFileSync(path.join(roomDir, RELEVANT_REL), relevantBody, 'utf8');

// Make the relevant file the most recently modified too, so the recency term
// reinforces (rather than fights) the term-frequency signal.
const now = Date.now();
for (let i = 0; i < EARLY_FILES; i++) {
  const name = 'note-' + String(i).padStart(3, '0') + '.md';
  const old = new Date(now - 30 * 24 * 3600 * 1000);
  fs.utimesSync(path.join(EARLY_DIR, name), old, old);
}
const fresh = new Date(now);
fs.utimesSync(path.join(roomDir, RELEVANT_REL), fresh, fresh);

// ---------------------------------------------------------------------------
// Run and assert.
// ---------------------------------------------------------------------------
const results = searchRoom(roomDir, QUERY, null);

check('search returns a non-empty result array', Array.isArray(results) && results.length > 0);

// THE regression assertion: the late relevant match survives the cap.
const relevantHits = results.filter((r) => r.file === RELEVANT_REL);
check(
  'late-directory relevant match survives ranking (would have been dropped by the old arrival-order cap)',
  relevantHits.length > 0
);

// The relevant file, being genuinely about the query, ranks at the very top.
check('relevant file ranks first (highest relevance, not last-walked)', results[0].file === RELEVANT_REL);

// Per-file cap: no single file monopolizes the budget with near-duplicate hits.
const perFileCounts = results.reduce((acc, r) => {
  acc[r.file] = (acc[r.file] || 0) + 1;
  return acc;
}, {});
const maxPerFile = Math.max(...Object.values(perFileCounts));
check('no single file monopolizes the payload (per-file slice cap holds)', maxPerFile <= 5);

// The walk-bound cost control still holds: output never exceeds the cap.
check('result count still bounded by SEARCH_MAX_RESULTS', results.length <= 50);

// Relevance signal is now surfaced to the caller (aligns with the "note the
// ranking signal" expectation in the debug file's Symptoms section).
check('each result carries a match_count relevance signal', results.every((r) => typeof r.match_count === 'number'));

// The relevant file's match_count reflects its true tally, not the per-file
// display cap (rank is driven by the full tally, the slice only bounds output).
check('relevant file match_count reflects full tally (> display slice)', relevantHits[0].match_count > 5);

// ---------------------------------------------------------------------------
// Cleanup.
// ---------------------------------------------------------------------------
try {
  fs.rmSync(roomDir, { recursive: true, force: true });
} catch (_e) { /* best effort */ }

console.log('PASS: test-room-search-rank-before-cap -- ' + passed + ' checks');
process.exit(0);
