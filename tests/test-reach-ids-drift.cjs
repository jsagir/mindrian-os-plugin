'use strict';
// LARRY-03 (Phase 141) -- adversarial exact-set drift test over the committed
// capability-dial reach ids.
//
// Asserts the reach-id machine-token set in HEAD:skills/larry-personality/SKILL.md
// is EXACTLY {context_block, contradiction, cross_room, brain_consult,
// deep_research} -- no more, no fewer. A 6th id (drift) fails; a missing id (RED)
// fails.
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

const CANONICAL_REACH_IDS = ['brain_consult', 'context_block', 'contradiction', 'cross_room', 'deep_research'];

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

// Extract backtick code-span snake_case identifiers from the dial section only.
const found = new Set();
const codeSpanRx = /`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/g;
let m;
while ((m = codeSpanRx.exec(dialSection)) !== null) {
  // Only collect ids that are in the canonical family OR look like a reach id
  // candidate (any snake_case token inside the dial section is a drift candidate).
  found.add(m[1]);
}

const foundSorted = Array.from(found).sort();
const expectedSorted = CANONICAL_REACH_IDS.slice().sort();

assert.deepEqual(
  foundSorted,
  expectedSorted,
  'LARRY-03: capability-dial reach-id set must be EXACTLY ' +
    JSON.stringify(expectedSorted) + ' (found ' + JSON.stringify(foundSorted) +
    '); RED until the 5 machine tokens are committed as code spans'
);

process.stdout.write('PASS test-reach-ids-drift.cjs (LARRY-03 exactly-5 reach-id set)\n');
process.exit(0);
