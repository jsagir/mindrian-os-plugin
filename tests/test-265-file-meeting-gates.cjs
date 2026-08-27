#!/usr/bin/env node
/**
 * Phase 265 Plan 10 tripwire -- declared-versus-rendered for commands/file-meeting.md,
 * plus the two new date-first-ask and transcript-size-probe guards.
 *
 * WHAT THIS TEST IS FOR (two sentences, per the plan): this is the Canon Part 11 R16
 * "declared-versus-rendered" failure class named in docs/MINDRIAN-CANON.md Appendix D
 * entry 36 (the Phase 190 born-declared-shape mandate) and entry 32 (F.8 defined as an
 * unordered basket of independent toggles where ONE confirm fans out to N typed edges).
 * A hitl_shape declaration with no renderer symbol behind it is a documentation promise,
 * not a build fact -- this file turns that promise into a build-time assertion, and pins
 * the two Plan 10 guards (date-before-extraction ordering, length-probe presence) so a
 * future edit cannot silently regress either one.
 *
 * Reads commands/file-meeting.md as TEXT ONLY. Does not execute the command. Pure
 * Node.js built-ins, zero npm deps. NO em-dashes (CLAUDE.md HARD RULE).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(REPO_ROOT, 'commands', 'file-meeting.md');

let failures = 0;
let passes = 0;

function report(armName, ok, detail) {
  if (ok) {
    passes += 1;
    console.log('PASS arm ' + armName);
  } else {
    failures += 1;
    console.log('FAIL arm ' + armName + (detail ? ': ' + detail : ''));
  }
}

if (!fs.existsSync(TARGET)) {
  console.error('FATAL: ' + TARGET + ' not found');
  process.exit(1);
}

const raw = fs.readFileSync(TARGET, 'utf8');
const lines = raw.split(/\r?\n/);

function lineNumberOf(needle) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indexOf(needle) !== -1) return i + 1;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// ARM 1: DECLARED VERSUS RENDERED (the load-bearing arm).
//
// Data-driven over a small shape-to-renderer map so this is extendable to
// other hitl_shape values later without a rewrite. Parses the frontmatter
// hitl_shape value and, when present in the map, asserts every renderer
// symbol for that shape appears in the body.
// ---------------------------------------------------------------------------
const SHAPE_RENDERER_MAP = {
  'F.1': ['renderShapeF1'],
  'F.8': ['renderShapeF8', 'consumeF8Fanout'],
};

function parseHitlShape(text) {
  const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!fmMatch) return null;
  const m = /^hitl_shape:\s*"?([^"\r\n]+)"?\s*$/m.exec(fmMatch[1]);
  return m ? m[1].trim() : null;
}

(function armDeclaredVsRendered() {
  const declaredShape = parseHitlShape(raw);
  if (!declaredShape) {
    report('1-declared-vs-rendered', false, 'no hitl_shape found in frontmatter');
    return;
  }
  const expectedSymbols = SHAPE_RENDERER_MAP[declaredShape];
  if (!expectedSymbols) {
    // A declared shape outside the map is not this test's concern (data-driven
    // map, extend it when a future shape needs the same guarantee).
    report('1-declared-vs-rendered', true, 'declared shape ' + declaredShape + ' not in map, skipping (informational)');
    return;
  }
  const missing = expectedSymbols.filter((sym) => raw.indexOf(sym) === -1);
  if (missing.length > 0) {
    report(
      '1-declared-vs-rendered',
      false,
      'declared hitl_shape=' + declaredShape + ', expected renderer symbols ' +
        JSON.stringify(expectedSymbols) + ', MISSING: ' + JSON.stringify(missing)
    );
  } else {
    report('1-declared-vs-rendered', true);
  }
})();

// ---------------------------------------------------------------------------
// ARM 2: DATE-BEFORE-EXTRACTION ORDERING.
// Asking for the meeting date after extraction reintroduces a late GATE_BLOCK
// at Step 4's requireValidAt gate -- the exact defect Task 1 fixed.
// ---------------------------------------------------------------------------
(function armDateBeforeExtraction() {
  const step1cIdx = raw.indexOf('Step 1c');
  const claimifyIdx = raw.indexOf('Claimify');
  if (step1cIdx === -1 || claimifyIdx === -1) {
    report(
      '2-date-before-extraction',
      false,
      'both "Step 1c" and "Claimify" must be found (Step 1c at ' + step1cIdx +
        ', Claimify at ' + claimifyIdx + ')'
    );
    return;
  }
  if (step1cIdx < claimifyIdx) {
    report('2-date-before-extraction', true);
  } else {
    report(
      '2-date-before-extraction',
      false,
      'Step 1c (offset ' + step1cIdx + ') is NOT before Claimify (offset ' + claimifyIdx +
        ') -- asking for the date after extraction reintroduces a late GATE_BLOCK ' +
        '(line ' + lineNumberOf('Step 1c') + ' vs line ' + lineNumberOf('Claimify') + ')'
    );
  }
})();

// ---------------------------------------------------------------------------
// ARM 3: LENGTH PROBE PRESENT, before Claimify, with the stated threshold.
// ---------------------------------------------------------------------------
(function armLengthProbe() {
  const probeIdx = raw.indexOf('Transcript size probe');
  const claimifyIdx = raw.indexOf('Claimify');
  const hasThreshold = raw.indexOf('12,000 words') !== -1;
  if (probeIdx === -1) {
    report('3-length-probe', false, '"Transcript size probe" heading not found');
    return;
  }
  if (!hasThreshold) {
    report('3-length-probe', false, 'literal threshold "12,000 words" not found');
    return;
  }
  if (claimifyIdx === -1 || probeIdx >= claimifyIdx) {
    report(
      '3-length-probe',
      false,
      'probe (offset ' + probeIdx + ') must appear before Claimify (offset ' + claimifyIdx + ')'
    );
    return;
  }
  report('3-length-probe', true);
})();

// ---------------------------------------------------------------------------
// ARM 4: APPROVAL GATE NOT BYPASSED. review_status + agent_attribution_forbidden
// must survive, and none of the bypass phrases may appear anywhere in the body.
// ---------------------------------------------------------------------------
// A bypass phrase preceded immediately by a negation ("NEVER auto-confirmed",
// "not auto-file") is the command correctly STATING the invariant it upholds,
// not violating it. Only an un-negated occurrence is a genuine bypass signal.
// (Self-caught during authoring: commands/file-meeting.md's own Pass 4 write
// section says "NEVER auto-confirmed" to describe the writer's guarantee --
// a naive substring match on "auto-confirm" false-positives on exactly the
// sentence that PROVES the gate holds.)
function findUnnegatedBypass(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(never|not)?\\s*' + escaped, 'gi');
  const hits = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!m[1]) hits.push(m.index);
  }
  return hits;
}

(function armApprovalGateNotBypassed() {
  const hasReviewStatus = raw.indexOf('review_status') !== -1;
  const hasAgentAttribution = raw.indexOf('agent_attribution_forbidden') !== -1;
  const BYPASS_PHRASES = ['auto-confirm', 'auto-file', 'files automatically', 'without approval'];
  const foundBypass = BYPASS_PHRASES.filter((p) => findUnnegatedBypass(raw, p).length > 0);

  const problems = [];
  if (!hasReviewStatus) problems.push('missing literal "review_status"');
  if (!hasAgentAttribution) problems.push('missing literal "agent_attribution_forbidden"');
  if (foundBypass.length > 0) problems.push('found forbidden bypass phrase(s): ' + JSON.stringify(foundBypass));

  if (problems.length > 0) {
    report('4-approval-gate-not-bypassed', false, problems.join('; '));
  } else {
    report('4-approval-gate-not-bypassed', true);
  }
})();

console.log('');
console.log('Phase 265 Plan 10 file-meeting gate tripwire: ' + passes + ' passed, ' + failures + ' failed');

if (failures > 0) {
  process.exit(1);
}
