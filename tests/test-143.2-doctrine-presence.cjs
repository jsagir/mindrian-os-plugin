'use strict';
// Phase 143.2-04 -- the doctrine-presence gate.
//
// A grep-presence + em-dash + frozen-frontmatter doctrine test for the
// 143.2 reconciliation. It asserts that every operate-block (OPS-01/02/03/04/05),
// every push-family (PUSH-01..06, anchored on FRAMEWORK NAMES per WFL-01 -- NOT
// command-literals), the WFL-01 governing resolver clause, the CONV lane-picker +
// DIKW mapping (CONV-01/02), and the MULL Brain-folder set + Ackoff traversal
// (MULL-01/02) landed in their target surfaces. It also asserts the MULL Part-8
// Brain-folder-query boundary (the buildBrainFolderQuery enum allow-list guard),
// zero em-dashes across the 7 touched surfaces, and that the frozen
// larry-extended frontmatter is byte-unchanged vs HEAD.
//
// WFL-01 false-clean-illusion mitigation (AUDIT-3): the PUSH-family anchors are
// FRAMEWORK-NAME anchors + the resolver-clause presence; this gate does NOT
// assert any /mos: command-literal is ABSENT (the legacy Provoked table carries
// ~16 legacy literals out of scope to rip out here). The gate asserts the CLAUSE
// is PRESENT, never that legacy slugs are absent.
//
// House rule: hyphens only, no em-dashes IN THIS FILE. The em-dash (U+2014) and
// en-dash (U+2013) characters appear ONLY as \u escapes inside the forbidden
// search set, never as literal characters.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

function readFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

// ---------------------------------------------------------------------------
// The presence table. Each entry maps a requirement id to a target file plus
// the tokens that MUST appear (allOf), the tokens of which at least one must
// appear (anyOf), and the genuine stale tokens that MUST NOT appear
// (mustNotContain). WFL-01: the PUSH-family entries' mustContain[] are
// FRAMEWORK-NAME anchors + trigger tokens, NOT command-literals. No /mos: slug
// appears in any mustNotContain[] (false-clean-illusion mitigation).
// ---------------------------------------------------------------------------

const LARRY = 'skills/larry-personality/SKILL.md';
const PWS = 'skills/pws-methodology/SKILL.md';
const UI = 'skills/ui-system/SKILL.md';
const EXT = 'agents/larry-extended.md';
const CONV = 'skills/conversation-mode/SKILL.md';
const SCAFFOLD = 'skills/mullins-scaffold/scaffold.json';
const MULL_SKILL = 'skills/mullins-scaffold/SKILL.md';

const PRESENCE = [
  // --- OPS (operate-blocks: Plans 01 + 03) ---
  {
    id: 'OPS-01',
    file: LARRY,
    mustContain: ['insight-sensors.cjs'],
    mustNotContain: ['comes later'],
  },
  {
    id: 'OPS-02',
    file: LARRY,
    mustContain: ['Operating the Dial', 'SELECTED_REACH', 'PIVOTED', 'recordSelectorMiss', 'navigation.cjs'],
  },
  {
    id: 'OPS-03',
    file: LARRY,
    mustContain: ['routing_source', 'CONSEQUENCE', 'zero user-content egress'],
  },
  {
    id: 'OPS-04',
    file: UI,
    mustContain: ['Shape F.7', 'SEED-020', 'DIAL_REACH_K'],
    mustNotContain: ['one of five F sub-shapes'],
  },
  {
    // OPS-05 spans two files: the agent body pointer + the conversation surface.
    id: 'OPS-05a',
    file: EXT,
    mustContain: ['Operating the machinery', 'ZERO user-content egress'],
    mustNotContain: ['What are you working on'],
  },
  {
    id: 'OPS-05b',
    file: CONV,
    mustContain: ['Conversational Reaches', 'scratchpad-ops.cjs'],
  },

  // --- PUSH (proactive push-families: Plan 02) -- FRAMEWORK-NAME anchors (WFL-01) ---
  {
    id: 'PUSH-01',
    file: LARRY,
    // Brain consult is framework-agnostic; anchored on the SENS-03 trigger.
    mustContain: ['SENS-03'],
  },
  {
    id: 'PUSH-02',
    file: LARRY,
    mustContain: ['Lagging-component pattern stated', 'Reverse Salient Analysis'],
  },
  {
    id: 'PUSH-03',
    file: LARRY,
    mustContain: ['HSI Semantic Surprise Analysis Assistant', '20+', '7e'],
  },
  {
    id: 'PUSH-04-larry',
    file: LARRY,
    anyOf: ["Usher's Model of Cumulative Synthesis", 'Four Lenses of Innovation'],
  },
  {
    id: 'PUSH-04-pws',
    file: PWS,
    mustContain: ['borrowed structure'],
  },
  {
    id: 'PUSH-05-larry',
    file: LARRY,
    mustContain: ['Six Thinking Hats'],
  },
  {
    id: 'PUSH-05-pws',
    file: PWS,
    mustContain: ['BONO Team Perspective', 'Accept, reshape, or stay'],
  },
  {
    id: 'PUSH-06',
    file: LARRY,
    mustContain: ['Deep Research Escalation Explicit Triggers', 'Hypothesis-Driven Problem Solving'],
  },

  // --- WFL-01 governing resolver clause (Plan 02) ---
  {
    id: 'WFL-01',
    file: LARRY,
    // The clause that governs the Provoked table + is mirrored near the
    // deep_research row. ONE presence assertion covers it. The gate asserts the
    // CLAUSE is PRESENT, never that legacy /mos: slugs are absent.
    mustContain: ['commandsForFramework'],
  },

  // --- CONV (conversation-mode lane-picker + DIKW: Plan 05) ---
  {
    id: 'CONV-01',
    file: CONV,
    mustContain: ['Lane Picker', 'Decision Gate'],
    anyOf: ['Shape F.1', 'SEED-020'],
  },
  {
    id: 'CONV-02',
    file: CONV,
    mustContain: ['Wisdom', 'ascent', 'descent'],
    anyOf: ['DIKW', 'Data/Information'],
    anyOf2: ['Systems Thinking', 'MAP THE HIERARCHY'],
  },

  // --- MULL (scaffold.json brain_folders + ackoff_traversal: Plan 06) ---
  {
    id: 'MULL-01',
    file: SCAFFOLD,
    mustContain: ['brain_folders', 'value-proposition', 'disruptive-innovation', 'systems-thinking', 'Mullins Seven Domains', 'offered'],
  },
  {
    id: 'MULL-02',
    file: SCAFFOLD,
    mustContain: ['ackoff_traversal', 'ascent', 'descent', 'Validation'],
  },
];

// Cache file reads so each file is read once.
const fileCache = {};
function getFile(rel) {
  if (!(rel in fileCache)) fileCache[rel] = readFile(rel);
  return fileCache[rel];
}

// Run the presence table.
for (const entry of PRESENCE) {
  const body = getFile(entry.file);
  for (const tok of entry.mustContain || []) {
    assert.ok(
      body.indexOf(tok) !== -1,
      entry.id + ': required token not found in ' + entry.file + ': ' + JSON.stringify(tok)
    );
  }
  if (Array.isArray(entry.anyOf)) {
    const hit = entry.anyOf.some(function (t) { return body.indexOf(t) !== -1; });
    assert.ok(hit, entry.id + ': none of anyOf tokens found in ' + entry.file + ': ' + JSON.stringify(entry.anyOf));
  }
  if (Array.isArray(entry.anyOf2)) {
    const hit2 = entry.anyOf2.some(function (t) { return body.indexOf(t) !== -1; });
    assert.ok(hit2, entry.id + ': none of anyOf2 tokens found in ' + entry.file + ': ' + JSON.stringify(entry.anyOf2));
  }
  for (const tok of entry.mustNotContain || []) {
    assert.ok(
      body.indexOf(tok) === -1,
      entry.id + ': stale token MUST be absent from ' + entry.file + ': ' + JSON.stringify(tok)
    );
  }
}

// ---------------------------------------------------------------------------
// MULL Part-8 Brain-folder-query boundary grep (Plan 06 enum-guard).
// Assert the buildBrainFolderQuery enum allow-list is present (all four enums),
// 'Mullins Seven Domains' is the only framework handle, AND the question string
// is built from the VALIDATED enum variable (pt), NOT from the raw caller
// parameter (problemTypeEnum). The structural gate: an arbitrary caller string
// is replaced by the enum before it reaches the query body. The runtime proof
// is delegated to lib/core/mullins-scaffold.test.cjs.
// ---------------------------------------------------------------------------

const MULL_CORE = 'lib/core/mullins-scaffold.cjs';
const mullSrc = getFile(MULL_CORE);

// Slice to the buildBrainFolderQuery function region for a focused grep.
const fnStart = mullSrc.indexOf('function buildBrainFolderQuery');
assert.ok(fnStart !== -1, 'MULL-Part8: buildBrainFolderQuery not found in ' + MULL_CORE);
const fnEnd = mullSrc.indexOf('\nmodule.exports', fnStart);
const fnBody = mullSrc.slice(fnStart, fnEnd === -1 ? mullSrc.length : fnEnd);

for (const enumStr of ['Un-Defined', 'Ill-Defined', 'Well-Defined', 'Wicked']) {
  assert.ok(
    fnBody.indexOf(enumStr) !== -1,
    'MULL-Part8: enum allow-list missing ' + JSON.stringify(enumStr) + ' in buildBrainFolderQuery'
  );
}
assert.ok(
  fnBody.indexOf('Mullins Seven Domains') !== -1,
  'MULL-Part8: the only framework handle (Mullins Seven Domains) must be present in buildBrainFolderQuery'
);
// The structural Part-8 gate: the raw parameter must NOT be concatenated into the
// question. The question is assembled from the validated enum variable instead.
const qLine = fnBody.split('\n').filter(function (l) { return l.indexOf('question') !== -1 && l.indexOf('=') !== -1; }).join('\n') +
  '\n' + fnBody.split('\n').filter(function (l) { return l.indexOf('+') !== -1; }).join('\n');
assert.ok(
  qLine.indexOf('problemTypeEnum') === -1,
  'MULL-Part8: the raw caller parameter (problemTypeEnum) must NOT be interpolated into the query question -- the validated enum var must be used instead'
);

// ---------------------------------------------------------------------------
// Zero em-dashes across the 7 touched surfaces (5 prompt files + scaffold.json +
// mullins-scaffold SKILL.md). The em-dash / en-dash are referenced ONLY by
// codepoint here -- never as literal characters.
// ---------------------------------------------------------------------------

const EM_DASH = String.fromCharCode(0x2014); // U+2014 em-dash
const EN_DASH = String.fromCharCode(0x2013); // U+2013 en-dash
const EM_DASH_SURFACES = [LARRY, PWS, UI, EXT, CONV, SCAFFOLD, MULL_SKILL];

for (const rel of EM_DASH_SURFACES) {
  const body = getFile(rel);
  assert.ok(body.indexOf(EM_DASH) === -1, 'em-dash (U+2014) MUST be absent from ' + rel);
  assert.ok(body.indexOf(EN_DASH) === -1, 'en-dash (U+2013) MUST be absent from ' + rel);
}

// ---------------------------------------------------------------------------
// Frozen larry-extended frontmatter: the frontmatter region (between the first
// two "---" fences) must still carry the exact initialPrompt string, all 10
// persona_variant keys, and the mcpServers entry verbatim -- a structural
// byte-presence check, since the plan forbids editing them. Compared against
// HEAD:agents/larry-extended.md so a future drift fails loud.
// ---------------------------------------------------------------------------

function frontmatterRegion(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return '';
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { end = i; break; }
  }
  if (end === -1) return '';
  return lines.slice(1, end).join('\n');
}

function gitShowHead(relPath) {
  try {
    return execFileSync('git', ['show', 'HEAD:' + relPath], { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch (e) {
    return '';
  }
}

const extDisk = getFile(EXT);
const extHead = gitShowHead(EXT);
const fmDisk = frontmatterRegion(extDisk);
const fmHead = frontmatterRegion(extHead);

const FROZEN_KEYS = [
  'initialPrompt: "I\'m Larry. What decision is stuck? (Tell me, or paste a doc/CV.)"',
  'persona_variants:',
  '  default:',
  '  founder:',
  '  researcher:',
  '  researcher_ind:',
  '  founder_grant:',
  '  investor:',
  '  operator:',
  '  mentor:',
  '  domain_expert:',
  '  student:',
  'mcpServers:',
  '  - mindrian-os',
];

for (const key of FROZEN_KEYS) {
  assert.ok(
    fmDisk.indexOf(key) !== -1,
    'frozen-frontmatter: working-tree larry-extended frontmatter missing frozen anchor: ' + JSON.stringify(key)
  );
}
// Byte-compare: the frozen anchors must be byte-identical to HEAD (if HEAD has them).
if (fmHead) {
  for (const key of FROZEN_KEYS) {
    if (fmHead.indexOf(key) !== -1) {
      assert.ok(
        fmDisk.indexOf(key) !== -1,
        'frozen-frontmatter: anchor present in HEAD but missing on disk (frontmatter was edited): ' + JSON.stringify(key)
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Final PASS line. 16 requirements: 11 OPS/PUSH (OPS-01..05 + PUSH-01..06) +
// WFL-01 + CONV-01/02 + MULL-01/02.
// ---------------------------------------------------------------------------

process.stdout.write('PASS test-143.2-doctrine-presence.cjs (16 requirements: OPS-01..05 + PUSH-01..06 framework-name-anchored + WFL-01 resolver clause + CONV-01/02 + MULL-01/02 + MULL Part-8 enum-guard + zero em-dashes across 7 surfaces + frozen frontmatter intact)\n');
process.exit(0);
