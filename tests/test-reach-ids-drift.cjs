'use strict';
// LARRY-03 (Phase 141) -- adversarial exact-set drift test over the committed
// capability-dial reach ids.
//
// Asserts the reach-id machine-token set in HEAD:skills/larry-personality/SKILL.md
// is EXACTLY {context_block, contradiction, cross_room, brain_consult,
// deep_research, hats} -- no more, no fewer (Phase 148 D-09 raised 5 -> 6). A 7th
// id (drift) fails; a missing id (RED) fails.
//
// Hygiene: the dial carries prose words like "contradiction" in sentences, which
// would self-invalidate a bare word count. So the reach ids are required to live
// as backtick-wrapped code-span tokens (`context_block`, ...). The scan extracts
// ONLY backtick code spans whose body is a snake_case identifier, then compares
// the matched set against the canonical set. This is the comment-stripping /
// code-span hygiene the plan mandates (no bare == 0 on unfiltered prose).
//
// RED now: HEAD SKILL.md carries no machine tokens (the dial is prose-only and
// uncommitted). House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

const CANONICAL_REACH_IDS = ['brain_consult', 'context_block', 'contradiction', 'cross_room', 'deep_research', 'hats'];

function gitShowHead(relPath) {
  try {
    return execFileSync('git', ['show', 'HEAD:' + relPath], { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch (e) {
    return '';
  }
}

const src = gitShowHead('skills/larry-personality/SKILL.md');

// Restrict the search to the Capability Dial section so posture ids (a different
// snake_case family in the Hierarchical Navigator section) do not pollute the set.
const dialStart = src.indexOf('Capability Dial');
const navStart = src.indexOf('Hierarchical Navigator');
const dialSection = dialStart === -1
  ? ''
  : src.slice(dialStart, navStart === -1 ? src.length : navStart);

// Extract backtick code-span identifiers from the dial section only. Most reach
// ids are snake_case (context_block, cross_room, brain_consult, deep_research),
// but `contradiction` is a single lowercase word with no underscore. Match both
// shapes (mirrors the posture-id test), then keep a token only if it is in the
// canonical family OR is a snake_case drift candidate. A plain prose word in a
// backtick span (e.g. a command) without an underscore that is NOT canonical is
// ignored so it cannot self-invalidate the count.
const found = new Set();
const codeSpanRx = /`([a-z][a-z0-9_]*)`/g;
let m;
while ((m = codeSpanRx.exec(dialSection)) !== null) {
  const tok = m[1];
  if (CANONICAL_REACH_IDS.indexOf(tok) !== -1 || tok.indexOf('_') !== -1) {
    found.add(tok);
  }
}

const foundSorted = Array.from(found).sort();
const expectedSorted = CANONICAL_REACH_IDS.slice().sort();

assert.deepEqual(
  foundSorted,
  expectedSorted,
  'LARRY-03: capability-dial reach-id set must be EXACTLY ' +
    JSON.stringify(expectedSorted) + ' (found ' + JSON.stringify(foundSorted) +
    '); RED until the 6 machine tokens are committed as code spans'
);

process.stdout.write('PASS test-reach-ids-drift.cjs (LARRY-03 exactly-6 reach-id set)\n');
process.exit(0);
