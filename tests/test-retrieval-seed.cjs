'use strict';
// RETR-02 (Phase 141) -- per-turn path forwards a conversation seed (not null)
// into LOCAL retrieval ONLY (D-03 + D-03a brain fence).
//
// RED now: scripts/intent-classifier.cjs still hard-codes `userText: null` in the
// per-turn `turn` object (the seam at ~line 1080). This suite asserts:
//   (a) the hot-path turn object no longer hard-codes userText: null
//   (b) the un-nulled value flows to the LOCAL seed lane only -- it must NOT be
//       threaded toward buildBrainPacket / brain-client in the same hot-path block
//       (Canon Part 8: the Brain gets generic handles only)
//
// Source-grep test (the seam is a one-token controller edit, not a callable unit).
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CLASSIFIER = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');

const src = fs.readFileSync(CLASSIFIER, 'utf8');

// Strip line comments so a comment mentioning the old seam does not self-invalidate.
const codeOnly = src
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n');

// (a) The literal hard-coded null seam must be gone from the hot-path turn object.
//     We look for the `userText: null` assignment specifically (whitespace-tolerant).
const hardNull = /userText\s*:\s*null/;
assert.equal(
  hardNull.test(codeOnly), false,
  'RETR-02: hot-path turn object must no longer hard-code userText: null (RED until D-03 lands)'
);

// (a continued) userText must still be present in the turn object, now un-nulled
// (seeded from recent turns) -- assert the key still appears in code.
assert.ok(
  /userText\s*:/.test(codeOnly),
  'RETR-02: the turn object must still carry a userText field (now seeded, not null)'
);

// (b) D-03a HARD FENCE: the seeded userText must not thread toward the Brain.
//     Assert no buildBrainPacket / brain-client call sits on a line that also
//     references userText (the value must reach room-context.cjs, never the Brain).
const lines = codeOnly.split('\n');
for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  if (/userText/.test(line)) {
    assert.equal(
      /buildBrainPacket|brain-client|brainClient/.test(line), false,
      'RETR-02 D-03a: userText must not be passed to buildBrainPacket/brain-client (Canon Part 8 fence), line ' + (i + 1)
    );
  }
}

process.stdout.write('PASS test-retrieval-seed.cjs (RETR-02 seed wiring + LOCAL-only fence)\n');
process.exit(0);
