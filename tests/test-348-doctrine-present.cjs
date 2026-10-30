'use strict';
// Phase 348-08 -- placement, content-token and citation assertions over the
// "### Superseded is not deleted" doctrine subsection landed in
// skills/larry-personality/SKILL.md, plus a no-live-corpus-claim scan over
// the whole file and a frontmatter byte-unchanged snapshot.
//
// This subsection is Larry's own-voice continuation of the aspirational
// CONTRADICTS worked example under "### When memory is real": it lands
// between that subsection and "### Honest about thin grounding", under
// "## Honesty about memory". Ratified at the 348-08 blocking checkpoint
// (Task 1) before this file or the skill subsection existed.
//
// House rule: hyphens only, no em-dashes. Plain node:assert/strict, zero
// network, zero room.db, zero I/O outside reading the tracked file under
// test.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const SKILL_PATH = path.join(REPO, 'skills', 'larry-personality', 'SKILL.md');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-348-doctrine-present');

assert.ok(fs.existsSync(SKILL_PATH), 'skills/larry-personality/SKILL.md must exist');
const doc = fs.readFileSync(SKILL_PATH, 'utf8');
// 369.6-10 (D-04): the supersession doctrine moved line for line to references/personality/memory-and-findings.md. `doc` stays the
// skill (frontmatter, em-dash and corpus-claim checks, the inline rule); `memDoc` is the new home the doctrine checks read.
const MEM_PATH = path.join(REPO, 'references', 'personality', 'memory-and-findings.md');
assert.ok(fs.existsSync(MEM_PATH), 'references/personality/memory-and-findings.md must exist');
const memDoc = fs.readFileSync(MEM_PATH, 'utf8');

// ---------------------------------------------------------------------------
// The frontmatter snapshot: byte-unchanged. No layer:, no hitl_shape, no new
// key at all. Phase 344 WD-7's connector.excluded:true exemption stays intact.
// ---------------------------------------------------------------------------

const EXPECTED_FRONTMATTER = [
  '---',
  'name: larry-personality',
  'description: >',
  '  Larry\'s dual-mode conversation engine and teaching personality. Relevant for',
  '  all conversations about innovation, methodology, venture exploration, problem',
  '  solving, and structured thinking. Provides the Ask-Tell Dial, mode transitions,',
  '  and framework delivery patterns.',
  'license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).',
  'canon_parts: [Part 2, Part 3, Part 8, Part 9]',
  '# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---',
  'connector:',
  '  excluded: true',
  '  reason: "Ambient always-on infra. The Ask-Tell dial / teaching personality runs on every conversational turn; it is the substrate the reaches render through, not a problem-state-triggered reach itself."',
  'hitl_stages:',
  '  - stage: "contradiction-response"',
  '    shapes: ["F.0"]',
  '    mode: "gate"',
  '  - stage: "deep-research-plan-approval"',
  '    shapes: ["F.1"]',
  '    mode: "gate"',
  '  - stage: "conversation-artifact-filing-offer"',
  '    shapes: ["F.1"]',
  '    mode: "gate"',
  '  - stage: "dial-reach-selection"',
  '    shapes: ["F.7"]',
  '    mode: "gate"',
  'hitl_why: "Four independent Decision-Gate moments: a contradiction mini-gate (F.0), a deep-research plan approval (F.1), a conversation-artifact filing offer (F.1), and the ranked-reach dial (F.7, implemented via lib/hmi/dial-reach-orchestrator.cjs)."',
  '---',
].join('\n');

ok('frontmatter block is byte-unchanged against the pre-plan snapshot', function () {
  const m = doc.match(/^---\n[\s\S]*?\n---/);
  assert.ok(m, 'a YAML frontmatter block must open the file');
  assert.equal(m[0], EXPECTED_FRONTMATTER, 'frontmatter must be byte-identical to the snapshot captured before this plan ran');
});

ok('frontmatter carries no layer: key and no hitl_shape key', function () {
  const m = doc.match(/^---\n[\s\S]*?\n---/)[0];
  assert.ok(!/\blayer\s*:/.test(m), 'frontmatter must not carry a layer: key (Phase 344 WD-7 exemption)');
  assert.ok(!/\bhitl_shape\b/.test(m), 'frontmatter must not carry a hitl_shape key');
});

// ---------------------------------------------------------------------------
// Placement: strictly between its two ratified neighbours, by byte offset,
// under "## Honesty about memory".
// ---------------------------------------------------------------------------

const HEADING = '### Superseded is not deleted';
const PREV = '### When memory is real';
// 369.6-10: in the reference the section that follows Superseded is "## Memory channels and the write policy" (the old neighbour
// "### Honest about thin grounding" stayed in the skill).
const NEXT = '## Memory channels and the write policy';

ok('heading "### Superseded is not deleted" exists exactly once, in memory-and-findings.md and not in the skill', function () {
  const matches = memDoc.match(/^### Superseded is not deleted$/gm) || [];
  assert.equal(matches.length, 1, 'expected exactly one "### Superseded is not deleted" heading');
  assert.equal((doc.match(/^### Superseded is not deleted$/gm) || []).length, 0, 'the skill keeps one inline rule, not the section');
});

ok('placed strictly between "### When memory is real" and "## Memory channels and the write policy", by byte offset', function () {
  const a = memDoc.indexOf(PREV);
  const b = memDoc.indexOf(HEADING);
  const c = memDoc.indexOf(NEXT);
  assert.ok(a !== -1, PREV + ' must exist');
  assert.ok(b !== -1, HEADING + ' must exist');
  assert.ok(c !== -1, NEXT + ' must exist');
  assert.ok(a < b && b < c, 'expected offsets in order: When memory is real < Superseded is not deleted < Memory channels, got ' + a + ' / ' + b + ' / ' + c);
});

ok('the skill keeps "## Honesty about memory" with the inline supersession rule and the pointer to the reference', function () {
  const h = doc.indexOf('## Honesty about memory');
  const rule = doc.indexOf('A superseded claim is closed, not deleted');
  const ptr = doc.indexOf('references/personality/memory-and-findings.md');
  assert.ok(h !== -1 && rule > h && ptr > h, 'expected the inline rule and the pointer under "## Honesty about memory", got ' + h + ' / ' + rule + ' / ' + ptr);
  assert.ok(doc.indexOf('### Honest about thin grounding') > h, 'the skill keeps "### Honest about thin grounding" under the same heading');
});

// ---------------------------------------------------------------------------
// The subsection body: extract it (from its heading to the next heading of
// equal or higher rank) and assert the load-bearing tokens live inside it.
// ---------------------------------------------------------------------------

function extractSubsection(fullText, headingLiteral, nextHeadingLiteral) {
  const start = fullText.indexOf(headingLiteral);
  const end = fullText.indexOf(nextHeadingLiteral, start);
  assert.ok(start !== -1 && end !== -1 && start < end, 'could not slice the doctrine subsection');
  return fullText.slice(start, end);
}

const subsection = extractSubsection(memDoc, HEADING, NEXT);

ok('subsection contains the actionable tokens: superseded, include_superseded, SUPERSEDES, contradiction_check', function () {
  const tokens = ['superseded', 'include_superseded', 'SUPERSEDES', 'contradiction_check'];
  for (const t of tokens) {
    assert.ok(subsection.indexOf(t) !== -1, 'doctrine subsection must contain token: ' + t);
  }
});

ok('subsection contains the honest-state sentence, by a distinctive token', function () {
  assert.ok(
    subsection.indexOf('no live room has ever produced a supersession') !== -1,
    'doctrine subsection must state plainly that no live room has ever produced a supersession'
  );
});

ok('subsection cites the filed research trail path', function () {
  assert.ok(
    subsection.indexOf('2026-09-14-mindrianos-classification-and-zep-graphiti-supersession-gap.md') !== -1,
    'doctrine subsection must cite the filed research trail path'
  );
});

ok('subsection names the human bar and the enforcing chokepoint', function () {
  assert.ok(subsection.indexOf('promoteNodeStatus') !== -1, 'doctrine subsection must name the enforcing chokepoint');
  assert.ok(subsection.indexOf('agent-attributed transition') !== -1, 'doctrine subsection must state the human bar');
});

ok('subsection points to the tracked contract doc', function () {
  assert.ok(subsection.indexOf('docs/SUPERSESSION-CONTRACT.md') !== -1, 'doctrine subsection must point to docs/SUPERSESSION-CONTRACT.md');
});

// ---------------------------------------------------------------------------
// No surface in the whole file may claim a LIVE langtalks corpus entry for
// Zep, Graphiti or bi-temporal. Scan for the co-occurrence of those names
// with an affirmative corpus-claim phrase; a negated mention (the honest
// gap statement) is allowed.
// ---------------------------------------------------------------------------

ok('no line in the file claims a live corpus entry for Zep, Graphiti or bi-temporal', function () {
  const corpusNames = ['Zep', 'Graphiti', 'bi-temporal'];
  const negationPhrases = ['no entry', 'carries no', 'does not carry', 'never', 'not to a live', 'not a corpus', 'zero entries', 'not sourced to'];
  const corpusClaimRe = /corpus (carries|has|contains|includes)/i;

  const lines = (doc + '\n' + memDoc).split('\n'); // 369.6-10: the skill and the reference that holds the moved doctrine
  let offending = null;
  for (const line of lines) {
    const hasName = corpusNames.some(function (name) { return line.indexOf(name) !== -1; });
    if (!hasName) continue;
    if (!corpusClaimRe.test(line)) continue;
    const negated = negationPhrases.some(function (p) { return line.toLowerCase().indexOf(p) !== -1; });
    if (!negated) { offending = line; break; }
  }
  if (offending) console.log('OFFENDING LINE: ' + offending);
  assert.equal(offending, null, 'no surface may claim a live langtalks corpus entry for Zep, Graphiti or bi-temporal');
});

// ---------------------------------------------------------------------------
// Hyphens only
// ---------------------------------------------------------------------------

ok('contains zero em-dashes', function () {
  assert.equal(doc.indexOf(String.fromCharCode(8212)), -1, 'skills/larry-personality/SKILL.md must contain zero em-dashes');
  assert.equal(memDoc.indexOf(String.fromCharCode(8212)), -1, 'references/personality/memory-and-findings.md must contain zero em-dashes');
});

console.log(n + ' assertions passed');
console.log('>>> test-348-doctrine-present.cjs: PASSED');
process.exit(0);
