'use strict';
// LARRY-04 / D-12 (Phase 141) -- adversarial exact-set drift test over the
// committed Hierarchical Navigator posture ids + the Aronhime doctrine quotes.
//
// Asserts, against HEAD:skills/larry-personality/SKILL.md:
//   - the Hierarchical Navigator section exists
//   - it quotes "Mindrian may propose the leap. The navigator decides whether"
//     and "restraint is the product working correctly"
//   - the posture-id machine-token set is EXACTLY {push_forward, hold, pull_back}
//     -- exactly 3, no more, no fewer
//
// Hygiene: posture ids must live as backtick-wrapped code-span tokens so prose
// words like "hold" in a sentence do not self-invalidate the count. The scan
// extracts ONLY backtick snake_case code spans from the Hierarchical Navigator
// section. `hold` is single-word so it is matched explicitly (not via the
// snake_case-with-underscore rule).
//
// RED now: the Hierarchical Navigator section is absent from the committed tree.
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

const CANONICAL_POSTURE_IDS = ['hold', 'pull_back', 'push_forward'];

const QUOTES = [
  'Mindrian may propose the leap. The navigator decides whether the leap is real',
  'restraint is the product working correctly',
];

function gitShowHead(relPath) {
  try {
    return execFileSync('git', ['show', 'HEAD:' + relPath], { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch (e) {
    return '';
  }
}

const src = gitShowHead('skills/larry-personality/SKILL.md');

// Anchor on the SECTION HEADING (a "## " line that names the Hierarchical
// Navigator), not the first bare phrase occurrence -- the phrase also appears as
// a legitimate cross-reference earlier (Reach rule 7), and anchoring on that
// would slice the wrong region.
const navHeadingMatch = src.match(/^##[^\n]*Hierarchical Navigator[^\n]*$/m);
const navStart = navHeadingMatch ? navHeadingMatch.index : -1;
assert.ok(
  navStart !== -1,
  'LARRY-04: committed SKILL.md must contain a "## ... Hierarchical Navigator" section heading (RED until it lands)'
);
// Bound the section to its heading through the next "## " top-level heading,
// mirroring the reach-id test's dial-to-nav slice. Without the end bound,
// backtick snake_case tokens from later sections (e.g. the Breakthrough Voice
// Scaffold auditor failure-mode ids) would pollute the posture-id set.
const afterHeading = src.indexOf('\n## ', navStart + 2);
const navSection = src.slice(
  navStart,
  afterHeading === -1 ? src.length : afterHeading
);

for (const q of QUOTES) {
  assert.ok(
    navSection.indexOf(q) !== -1,
    'LARRY-04: Hierarchical Navigator section must quote: "' + q + '"'
  );
}

// Extract backtick code spans that are posture-id candidates. Match both the
// two-token snake_case ids (push_forward, pull_back) and the single-word id (hold).
const found = new Set();
const codeSpanRx = /`([a-z][a-z0-9_]*)`/g;
let m;
while ((m = codeSpanRx.exec(navSection)) !== null) {
  const tok = m[1];
  // Posture ids are exactly the canonical family; collect any candidate that is
  // one of them OR a snake_case drift token so an extra id trips the deepEqual.
  if (CANONICAL_POSTURE_IDS.indexOf(tok) !== -1 || tok.indexOf('_') !== -1) {
    found.add(tok);
  }
}

const foundSorted = Array.from(found).sort();
const expectedSorted = CANONICAL_POSTURE_IDS.slice().sort();

assert.deepEqual(
  foundSorted,
  expectedSorted,
  'LARRY-04: posture-id set must be EXACTLY ' + JSON.stringify(expectedSorted) +
    ' (found ' + JSON.stringify(foundSorted) + '); RED until the 3 posture tokens are committed'
);

process.stdout.write('PASS test-posture-ids-drift.cjs (LARRY-04 exactly-3 posture-id set + quotes)\n');
process.exit(0);
