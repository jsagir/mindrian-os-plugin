#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 103-03 Tripwire #1 + #2 — source-level Canon Part 8 audit
 * ===============================================================
 * Reads lib/hmi/cross-room-memory.cjs AS SOURCE TEXT and scans for
 * forbidden patterns. Structural test: asserts what the source file
 * CAN'T contain, regardless of runtime behavior.
 *
 * 6 assertion classes:
 *   1. source file lib/hmi/cross-room-memory.cjs exists
 *   2. zero matches for forbidden substring 'room_name' OUTSIDE
 *      allow-list / forbid-list declaration comment regions
 *   3. zero matches for forbidden substring 'artifact_body'
 *   4. zero matches for forbidden substring 'meeting_text'
 *   5. zero raw ISO-timestamp assignments (heuristic: lines that look
 *      like `<key> = '<iso>'` outside allow-list regions)
 *   6. exactly ONE call site for any function matching
 *      /brainClient\.query|brain\.query|sendToBrain/ (Tripwire #2:
 *      single Brain chokepoint enforcement)
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'cross-room-memory.cjs');

let passed = 0;
let failed = 0;
function assert(c, l) {
  if (c) { passed++; console.log('  PASS  ' + l); }
  else { failed++; console.error('  FAIL  ' + l); }
}

(function main() {
  console.log('[test-cross-room-memory-schema-leak] running 6 assertion classes (Canon Part 8 source audit)');

  assert(fs.existsSync(SRC_PATH), 'source file lib/hmi/cross-room-memory.cjs exists');
  if (!fs.existsSync(SRC_PATH)) {
    console.log('\n[' + passed + '/' + (passed + failed) + ' passed]');
    process.exit(1);
    return;
  }

  const src = fs.readFileSync(SRC_PATH, 'utf8');
  const lines = src.split('\n');

  // Helper: line matches forbidden pattern AND is NOT inside a comment
  // OR an allow-list / forbid-list declaration region.
  //
  // Region detection: a line is "in a declaration region" if a comment
  // marker (PERMITTED, ALLOW_LIST, FORBIDDEN, forbid-list) was seen on a
  // recent line and a closing brace/bracket has not yet been seen.
  // We approximate with a sliding window: a region opens on a comment
  // line and closes when we hit a `};` `]);` `]` line.
  function findRealLeaks(pattern) {
    const re = (pattern instanceof RegExp) ? pattern : new RegExp(pattern);
    const leaks = [];
    let inDeclRegion = false;
    let regionStartLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip pure comment lines
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        // Detect declaration region open within a comment block
        if (/PERMITTED|ALLOW_LIST|allow-list|FORBIDDEN|forbid-list|FORBID_LIST/i.test(trimmed)) {
          inDeclRegion = true;
          regionStartLine = i;
        }
        continue;
      }

      // Detect open via inline annotation on a code line
      if (/PERMITTED|ALLOW_LIST|FORBIDDEN|FORBID_LIST/.test(line)) {
        inDeclRegion = true;
        regionStartLine = i;
      }

      if (inDeclRegion) {
        // End regions on close-of-array / close-of-object pattern. Be
        // lenient: any line that ENDs with `]);` `]`  `};` `)` and is
        // NOT a function body opener closes the region.
        if (/^[\s]*[}\]\)]/.test(line) || /[\]\)];?\s*$/.test(trimmed)) {
          // close after this line
          inDeclRegion = false;
          regionStartLine = -1;
        }
        continue;
      }

      if (re.test(line)) {
        leaks.push({ line: i + 1, text: line });
      }
    }
    return leaks;
  }

  // Tripwire #1a: 'room_name'
  const leaksRoomName = findRealLeaks(/\broom_name\b/);
  if (leaksRoomName.length > 0) {
    for (const lk of leaksRoomName) console.error('    leak ' + lk.line + ': ' + lk.text.trim());
  }
  assert(leaksRoomName.length === 0, 'no \'room_name\' leaks (found ' + leaksRoomName.length + ')');

  // Tripwire #1b: 'artifact_body'
  const leaksArtifactBody = findRealLeaks(/\bartifact_body\b/);
  if (leaksArtifactBody.length > 0) {
    for (const lk of leaksArtifactBody) console.error('    leak ' + lk.line + ': ' + lk.text.trim());
  }
  assert(leaksArtifactBody.length === 0, 'no \'artifact_body\' leaks (found ' + leaksArtifactBody.length + ')');

  // Tripwire #1c: 'meeting_text'
  const leaksMeetingText = findRealLeaks(/\bmeeting_text\b/);
  if (leaksMeetingText.length > 0) {
    for (const lk of leaksMeetingText) console.error('    leak ' + lk.line + ': ' + lk.text.trim());
  }
  assert(leaksMeetingText.length === 0, 'no \'meeting_text\' leaks (found ' + leaksMeetingText.length + ')');

  // Tripwire #1d: raw ISO-timestamp assignment heuristic.
  // Match lines that look like an assignment to a payload field where
  // the right-hand side is a string literal containing a raw ISO date.
  // e.g., `out.foo = '2026-04-30T...'` is a leak;
  //       `// example: '2026-04-30T...'` is NOT (skipped as comment).
  const leaksIso = findRealLeaks(/=\s*['"]\d{4}-\d{2}-\d{2}T/);
  if (leaksIso.length > 0) {
    for (const lk of leaksIso) console.error('    leak ' + lk.line + ': ' + lk.text.trim());
  }
  assert(leaksIso.length === 0,
    'no raw ISO-timestamp assignments to Brain payload fields (found ' + leaksIso.length + ')');

  // Tripwire #2: single Brain call chokepoint.
  // Count outbound Brain query call sites; allow at most 1.
  // Excludes function definitions / type declarations — only `.query(`
  // invocation patterns count.
  const callSites = (src.match(/(?:brainClient|brain|client)\.query\(|sendToBrain\(/g) || []).length;
  assert(callSites <= 1,
    'at most one Brain call site (found ' + callSites + '; chokepoint Tripwire #2)');

  console.log('\n[' + passed + '/' + (passed + failed) + ' passed]');
  process.exit(failed === 0 ? 0 : 1);
})();
