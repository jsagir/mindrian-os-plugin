'use strict';
// Phase 192-03 Task 3 (re-pointed by Phase 210 item B) -- doctrine-presence suite for the
// relevance-conditioned stance-toggle footer offer + the default/recommended voice-glyph
// mapping in skills/larry-personality/SKILL.md.
//
// This is a DOCUMENTATION-presence test (it asserts the doctrine narrates the mapping), NOT a
// re-test of the pure forcedVoiceColorForStance function (Task 1's suite already proves that).
//
// Proves:
//   (a) a new stance-toggle section exists and names all 4 stances (research/tell-act/ask/redteam)
//   (b) it states the redteam -> red / tell-act -> blue mapping verbatim
//   (c) it explicitly distinguishes itself from BOTH the Modality Remote (Part 12) and the
//       Hierarchical Navigator posture prose, by name
//   (d) it states the offered-never-forced rule AND conditions the footer offer on genuine
//       relevance (navigator mid-decision about conversational mode), not every turn
//       (Phase 210 item B re-pointed this from the old every-turn requirement)
//   (e) the pre-existing "The Two Modes" / "The Dial Curve" / "Larry as Hierarchical Navigator"
//       headings are still present byte-for-byte (proving a pure addition, not an edit)
//   (f) the pure function still agrees with the documented mapping (a thin cross-check, imported
//       from Task 1's module -- guards doc/code divergence)
//
// House rule: hyphens only, no em-dashes. CJS, node built-ins only.

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'larry-personality', 'SKILL.md');
const stance = require(path.join(REPO_ROOT, 'lib', 'core', 'stance-state.cjs'));

let failures = 0;
function check(cond, msg) {
  if (cond) {
    process.stdout.write('  ok   ' + msg + '\n');
  } else {
    failures++;
    process.stdout.write('  FAIL ' + msg + '\n');
  }
}

const src = fs.readFileSync(SKILL_PATH, 'utf8');

// Locate the new stance-toggle section by heading. It must sit BETWEEN "When to Reach" and
// "Larry as Hierarchical Navigator" (a pure insertion).
const sectionMatch = src.match(/^##[^\n]*Stance Toggle[^\n]*$/m);
check(!!sectionMatch, 'a "## ... Stance Toggle ..." section heading exists');

// Bound the new section from its heading to the next "## " heading.
let sectionText = '';
if (sectionMatch) {
  const start = sectionMatch.index;
  const after = src.indexOf('\n## ', start + 2);
  sectionText = src.slice(start, after === -1 ? src.length : after);
}

// (a) names all 4 stances.
for (const s of ['research', 'tell-act', 'ask', 'redteam']) {
  check(sectionText.indexOf(s) !== -1, 'stance section names the "' + s + '" stance');
}

// (b) redteam-red / tell-act-blue mapping verbatim.
check(/redteam[^\n]*red/i.test(sectionText) || /red[^\n]*redteam/i.test(sectionText), 'stance section states redteam -> RED');
check(/tell-act[^\n]*blue/i.test(sectionText) || /blue[^\n]*tell-act/i.test(sectionText), 'stance section states tell-act -> BLUE');
// research and ask make no forced color claim.
check(/no forced[- ]?color|Claude'?s discretion|natural voice-mark/i.test(sectionText), 'stance section documents research/ask as no-forced-color (Claude\'s discretion)');

// (c) distinguishes from Modality Remote AND Hierarchical Navigator posture, by name.
check(/Modality Remote/.test(sectionText), 'stance section distinguishes itself from the Modality Remote (Part 12) by name');
check(/Hierarchical Navigator/.test(sectionText), 'stance section distinguishes itself from the Hierarchical Navigator posture by name');
check(/push_forward|pull_back/.test(sectionText), 'stance section cites the frozen posture ids as a DIFFERENT axis');

// (d) relevance-conditioned offered-never-forced footer (Phase 210 item B re-point).
check(/offered[^\n]*never forced|never forced|offered, never forced/i.test(sectionText), 'stance section states the offered-never-forced rule');
check(/genuinely mid-decision|mid-decision about conversational mode|NOT a default every-turn/i.test(sectionText), 'stance section conditions the footer offer on genuine relevance, not every turn (Phase 210 item B)');
check(/\/mos:stance/.test(sectionText), 'stance section names the /mos:stance affordance');

// (e) pre-existing headings still present byte-for-byte (pure addition).
check(src.indexOf('## The Two Modes') !== -1, 'pre-existing "## The Two Modes" heading preserved');
check(src.indexOf('## The Dial Curve') !== -1, 'pre-existing "## The Dial Curve" heading preserved');
check(src.indexOf('## Larry as Hierarchical Navigator -- The Usher Division') !== -1, 'pre-existing Hierarchical Navigator heading preserved byte-for-byte');
check(src.indexOf('## When to Reach -- The Capability Dial') !== -1, 'pre-existing Capability Dial heading preserved byte-for-byte');

// The new section sits BETWEEN Capability Dial and Hierarchical Navigator (pure insertion order).
const capIdx = src.indexOf('## When to Reach -- The Capability Dial');
const navIdx = src.indexOf('## Larry as Hierarchical Navigator -- The Usher Division');
if (sectionMatch) {
  check(sectionMatch.index > capIdx && sectionMatch.index < navIdx, 'stance section is inserted between Capability Dial and Hierarchical Navigator');
}

// (f) doc/code cross-check: the pure function agrees with the documented mapping.
check(stance.forcedVoiceColorForStance('redteam') === 'red', 'code agrees: redteam -> red');
check(stance.forcedVoiceColorForStance('tell-act') === 'blue', 'code agrees: tell-act -> blue');
check(stance.forcedVoiceColorForStance('research') === null && stance.forcedVoiceColorForStance('ask') === null, 'code agrees: research/ask -> no forced color');

if (failures === 0) {
  process.stdout.write('PASS test-stance-voice-glyph-override.cjs (relevance-conditioned stance footer doctrine + default voice-color mapping)\n');
  process.exit(0);
} else {
  process.stdout.write('FAIL test-stance-voice-glyph-override.cjs (' + failures + ' failing assertion(s))\n');
  process.exit(1);
}
