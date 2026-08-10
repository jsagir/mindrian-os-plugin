#!/usr/bin/env node
'use strict';

/**
 * Phase 250 Plan 01, Task 3 (HONEST-01) + Phase 252 Plan 03, Task 2 (SWEEP-03)
 * -- the doctrine grep fence. ONE fence, WIDER scope (Part 7 -- no second
 * fence file).
 * ==========================================================================
 * 250-01 proved the silent-fallback doctrine phrases are DEAD in the shipped
 * instruction surfaces: skills/, commands/, agents/, dist/. 252-03 extends
 * this SAME fence to the living-docs set (252-RESEARCH.md "SWEEP-03: The
 * Docs Sweep", re-measured at 252-03 execution time) plus two new doctrine
 * phrases found live at execution time, and adds the canon:193 cold-start
 * rename canary (threat T-252-09).
 *
 * The forbidden-phrase list. 250-01 shipped the first two (research Pitfall
 * 6: "exactly these two, no widening" -- that rule bound the 250-01 fence at
 * its own scope). 252-03's own task text sanctions exactly one further
 * widening ("graceful degradation" as a doctrine phrase); this file adds
 * that ONE plus a second found by manual read of the living-docs set during
 * the sweep (Rule 2: a fence that lets a second live instance of the exact
 * same "never disclose degradation" bug class regress is an incomplete
 * fence). Both new patterns are EXACT live phrases, never a bare single word
 * -- bare "graceful degradation" false-positives on ~10 legitimate
 * API-fallback / robustness headers repo-wide (agents/opportunity-scanner.md,
 * commands/brain-derive.md, skills/context-engine/SKILL.md, etc. -- verified
 * by grep before adding the pattern, per Pitfall 2's raw-grep lesson):
 *   - /silent fallback/i                              (250-01)
 *   - /never mention (failures|this bookkeeping)/i     (250-01)
 *   - /graceful degradation everywhere/i                (252-03: decisions.md
 *     row 8's exact pre-amendment rationale)
 *   - /never tell (the )?user about degradation/i       (252-03: the exact
 *     live phrase found in docs/ARCHITECTURE-DEEP-DIVE.md's Connector
 *     Awareness section -- same bug class as "never mention failures",
 *     reworded)
 *
 * Living-docs scope (252-03): an EXPLICIT file list, not a directory walk.
 * 252-RESEARCH.md's living-vs-historical policy table is per-FILE, not
 * per-directory -- docs/ mixes living contracts with historical records
 * (dated handoffs, CHANGELOG, archived specs) that must stay byte-untouched.
 * A recursive directory walk over docs/ would either flood on historical
 * files or require re-deriving the exclusion list as a second gate; the
 * explicit list IS the gate.
 *
 * The frozen historical-exclusion list (documented for auditability; the
 * living-docs array below already omits every one of these -- a self-check
 * test asserts that structurally so a future edit cannot silently
 * reintroduce a historical path into the living scan):
 *   CHANGELOG.md, docs/2026-*-HANDOFF-*, docs/2026-05-12-*,
 *   docs/UI-UX-CONVERGENCE-2026-05-10/*, docs/superpowers/specs/*,
 *   docs/reviews/*, docs/testers/outbox/*, docs/research/*,
 *   docs/POWERHOUSE-1.6.0-SPEC.md, docs/autopsies/*,
 *   docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md
 *
 * canon:193 canary (T-252-09): docs/MINDRIAN-CANON.md's cold-start Decision
 * Gate paragraph (located by content -- the paragraph immediately following
 * the fixed "Mode B (Local Only)." sentence, unchanged by the rename so the
 * canary anchor survives it) must contain "cold-start minimal option set"
 * and must NOT contain "Tier 0" or "fallback" framing, so a later revert of
 * the rename cannot slip through. RED before the rename lands (the
 * paragraph still reads "Tier 0 fallback"), GREEN after.
 *
 * Run BEFORE 252-03 Task 2's sweep edits, this fence's living-docs leg and
 * canary leg both demonstrably FAIL -- that RED run is filed in the
 * 252-03-SUMMARY.md.
 *
 * node --test, CJS, node:assert/strict + node:fs only. No new deps.
 * No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');

// Closed pattern list. 250-01 shipped the first two; 252-03 adds the next
// two, each citing exact live doctrine text (see file header). Widening
// this list further is out of scope for this fence.
const FORBIDDEN = [
  /silent fallback/i,
  /never mention (failures|this bookkeeping)/i,
  /graceful degradation everywhere/i,
  /never tell (the )?user about degradation/i,
];

// 250-01 scope: shipped instruction/build surfaces, full directory walk.
const SCOPE_DIRS = ['skills', 'commands', 'agents', 'dist'];

// 252-03 scope: the living-docs set, an explicit file list per the
// living-vs-historical policy (252-RESEARCH.md "SWEEP-03: The Docs Sweep").
// Re-measured at 252-03 execution time (2026-08-11) against the plan's own
// files_modified ledger.
const LIVING_DOCS_FILES = [
  'docs/MINDRIAN-CANON.md',
  'docs/install/BRAIN-SETUP.md',
  'docs/install/HEAL.md',
  'docs/THE-BRAIN.md',
  'docs/MWP-SPECIFICATION.md',
  'docs/ENV-TUNING.md',
  'docs/WORKFLOWS.md',
  'docs/ARCHITECTURE-DEEP-DIVE.md',
  'docs/F-SELECTOR-CONSUMER-GUIDE.md',
  'docs/ORCHESTRATION-PROJECTION-CONTRACT.md',
  'docs/TELEMETRY-SCHEMA.md',
  'docs/CANON-PHASE-MAP.md',
  'docs/AGENTIC-SURFACING-PATTERN.md',
  'docs/RCA-TEMPLATE.md',
  'docs/IDEA-DOCUMENT.md',
  'agents/opportunity-scanner.md',
  'README.md',
  '.claude/includes/decisions.md',
];

// The frozen historical-exclusion list (never scanned as "living";
// documented for auditability, matched against LIVING_DOCS_FILES by a
// self-check below).
const HISTORICAL_EXCLUSIONS = [
  /^CHANGELOG\.md$/,
  /^docs\/2026-.*-HANDOFF-.*\.md$/,
  /^docs\/2026-05-12-/,
  /^docs\/UI-UX-CONVERGENCE-2026-05-10\//,
  /^docs\/superpowers\/specs\//,
  /^docs\/reviews\//,
  /^docs\/testers\/outbox\//,
  /^docs\/research\//,
  /^docs\/POWERHOUSE-1\.6\.0-SPEC\.md$/,
  /^docs\/autopsies\//,
  /^docs\/AMENDMENT-2026-08-DECISIONS-1-AND-8\.md$/,
];

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (entry.isFile() && /\.(md|cjs|js|json)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function scanFile(filePath) {
  const hits = [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    for (const pattern of FORBIDDEN) {
      if (pattern.test(line)) {
        hits.push({ file: filePath, line: idx + 1, pattern: pattern.source, text: line.trim() });
      }
    }
  });
  return hits;
}

function scanScope() {
  const allHits = [];
  for (const dir of SCOPE_DIRS) {
    const dirPath = path.join(REPO_ROOT, dir);
    const files = walk(dirPath, []);
    for (const f of files) {
      allHits.push(...scanFile(f));
    }
  }
  return allHits;
}

function scanLivingDocs() {
  const allHits = [];
  for (const rel of LIVING_DOCS_FILES) {
    const full = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(full)) continue; // existence asserted separately below
    allHits.push(...scanFile(full));
  }
  return allHits;
}

test('Doctrine fence: zero silent-fallback / never-mention-failures hits in skills/, commands/, agents/, dist/', () => {
  const hits = scanScope();
  if (hits.length > 0) {
    const report = hits.map((h) => h.file + ':' + h.line + ' -- ' + h.text).join('\n');
    assert.fail('Doctrine phrase(s) still present:\n' + report);
  }
  assert.equal(hits.length, 0);
});

test('Doctrine fence (252-03 extension): zero doctrine-phrase hits in the living-docs set', () => {
  for (const rel of LIVING_DOCS_FILES) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, rel)), 'living-docs file must exist: ' + rel);
  }
  const hits = scanLivingDocs();
  if (hits.length > 0) {
    const report = hits.map((h) => h.file + ':' + h.line + ' -- ' + h.text).join('\n');
    assert.fail('Doctrine phrase(s) still present in the living-docs set:\n' + report);
  }
  assert.equal(hits.length, 0);
});

test('Doctrine fence self-check: living-docs list carries zero historical-exclusion paths', () => {
  for (const rel of LIVING_DOCS_FILES) {
    const isExcluded = HISTORICAL_EXCLUSIONS.some((re) => re.test(rel));
    assert.equal(
      isExcluded,
      false,
      rel + ' matches a frozen historical-exclusion pattern and must never be in LIVING_DOCS_FILES'
    );
  }
});

test('Doctrine fence self-check: the pattern list is exactly the closed four-pattern set (250-01 two + 252-03 two, no further widening)', () => {
  assert.equal(FORBIDDEN.length, 4, 'the fence must carry exactly four patterns after the 252-03 widening');
  assert.equal(FORBIDDEN[0].source, 'silent fallback');
  assert.equal(FORBIDDEN[1].source, 'never mention (failures|this bookkeeping)');
  assert.equal(FORBIDDEN[2].source, 'graceful degradation everywhere');
  assert.equal(FORBIDDEN[3].source, 'never tell (the )?user about degradation');
});

// ---------------------------------------------------------------------------
// T-252-09: the canon:193 cold-start rename canary.
// ---------------------------------------------------------------------------

const CANON_PATH = path.join(REPO_ROOT, 'docs', 'MINDRIAN-CANON.md');

// Locate by content, anchored on the fixed "Mode B (Local Only)." sentence
// (unchanged by the rename) so the canary survives the edit it is guarding.
function extractCanonColdStartParagraph(text) {
  const anchor = 'Mode B (Local Only).';
  const anchorIdx = text.indexOf(anchor);
  if (anchorIdx === -1) return null;
  const afterAnchor = text.slice(anchorIdx);
  const firstBreak = afterAnchor.indexOf('\n\n');
  if (firstBreak === -1) return null;
  const rest = afterAnchor.slice(firstBreak + 2);
  const secondBreak = rest.indexOf('\n\n');
  return secondBreak === -1 ? rest : rest.slice(0, secondBreak);
}

test('T-252-09 canary: MINDRIAN-CANON.md cold-start paragraph is renamed, not amended (positive)', () => {
  const text = fs.readFileSync(CANON_PATH, 'utf8');
  const para = extractCanonColdStartParagraph(text);
  assert.ok(para, 'expected the cold-start paragraph immediately after "Mode B (Local Only)." in MINDRIAN-CANON.md');
  assert.match(
    para,
    /cold-start minimal option set/i,
    'the renamed paragraph must contain "cold-start minimal option set"'
  );
});

test('T-252-09 canary: MINDRIAN-CANON.md cold-start paragraph carries zero Tier-0/fallback framing (negative, reverts red)', () => {
  const text = fs.readFileSync(CANON_PATH, 'utf8');
  const para = extractCanonColdStartParagraph(text);
  assert.ok(para, 'expected the cold-start paragraph immediately after "Mode B (Local Only)." in MINDRIAN-CANON.md');
  assert.doesNotMatch(
    para,
    /tier[ _-]?0/i,
    'a revert to "Tier 0" framing in the cold-start paragraph must red this canary'
  );
  assert.doesNotMatch(
    para,
    /fallback/i,
    'a revert to "fallback" framing in the cold-start paragraph must red this canary'
  );
});
