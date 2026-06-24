#!/usr/bin/env node
'use strict';
/*
 * Phase 179-05 -- the DOMAIN-NEUTRALITY grep gate for the abstraction-gate
 * fixture (SPEC Req 6; threat T-179-12, the load-bearing risk).
 *
 * The committed fixture (tests/fixtures/abstraction-gate-neutral.json) is
 * tracked and public-leaning. It MUST carry zero venture/AION-specific content
 * (no-real-names HARD RULE + Canon Part 8). This gate FAILS CLOSED (non-zero
 * exit) if any banned domain-specific token appears in the fixture or in the
 * abstraction-gate source body. It is an ADVERSARIAL gate: it exists to PROVE
 * that venture content is REJECTED, not merely that the neutral fixture passes.
 *
 * The gate is a PURE filesystem read (no network, no agent, no Brain) mirroring
 * the scripts/check-room-blueprints.cjs --check exit-code idiom:
 *   exit 0 -> the scanned files are domain-neutral.
 *   exit 1 -> a banned token was found (or a scanned file is unreadable).
 *
 * Usage:
 *   node scripts/check-abstraction-fixture-neutral.cjs           (human run)
 *   node scripts/check-abstraction-fixture-neutral.cjs --check   (CI gate)
 *
 * The OPTIONAL --file <path> arg lets the proof suite point the gate at a
 * SYNTHESIZED adversarial fixture (a temp file carrying a banned token) to PROVE
 * the gate actually rejects venture content (acceptance criterion). When --file
 * is supplied the gate scans ONLY that file.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// The explicit denylist of banned domain/venture tokens. These are matched
// case-insensitively as whole-ish substrings. The list carries the AION/pharma/
// oncology venture vocabulary named in 174-RESEARCH plus the generic
// venture-noise terms. A banned token appearing ANYWHERE in a scanned fixture
// (or in the abstraction-gate source body) is a Part 8 / no-real-names breach.
//
// IMPORTANT: this array is the gate's OWN denylist; the gate carves its own
// source file OUT of the scan (see SCAN_TARGETS) so these tokens do not
// self-trip. No scanned target may reference these tokens.
const DENYLIST = Object.freeze([
  'aion',
  'oncology',
  'eureka',
  'target-pair',
  'drug',
  'pharma',
  'synergy',
  'biotech',
  'car-t',
  'immunotherapy',
  'clinical-trial',
  'molecule',
  'compound',
  'patient',
  'tumor',
]);

// Heuristic for a proper-noun venture name: a CamelCase or ALLCAPS multi-letter
// token that is NOT one of our known-neutral allowed tokens. This is a SECOND
// adversarial layer on top of the explicit denylist (catches an unanticipated
// venture name). The neutral fixture deliberately uses single-letter
// placeholders (X, Y) and the abstraction option labels INSTANCES / STRUCTURE,
// which are whitelisted below.
const ALLOWED_PROPER_NOUNS = Object.freeze(new Set([
  'INSTANCES', 'STRUCTURE', // the abstraction option labels (domain-neutral)
  'AskUserQuestion',        // a Claude Code render primitive, not a venture name
  'DatabaseSync',           // a node:sqlite primitive referenced in the gate source
]));
// A CamelCase venture-name heuristic: an uppercase letter followed by lowercase,
// then another uppercase letter (e.g. "AcmeCorp", "BioNTech"). Single capitals
// and ALLCAPS-whitelisted labels are exempt.
const CAMELCASE_VENTURE_RE = /\b[A-Z][a-z]+[A-Z][A-Za-z]+\b/g;

// The files the gate scans by default: the committed neutral fixture + the
// abstraction-gate sources (the gate's OWN file is carved out so its denylist
// does not self-trip).
const DEFAULT_SCAN_TARGETS = Object.freeze([
  'tests/fixtures/abstraction-gate-neutral.json',
  'lib/core/abstraction-gate.cjs',
]);

function isCheck(argv) {
  return argv.includes('--check');
}

function explicitFile(argv) {
  const i = argv.indexOf('--file');
  if (i !== -1 && typeof argv[i + 1] === 'string' && argv[i + 1].length > 0) {
    return argv[i + 1];
  }
  return null;
}

// scanText -- return an array of violation strings for one file's text.
function scanText(relPath, text) {
  const violations = [];
  const lower = text.toLowerCase();
  for (const token of DENYLIST) {
    if (lower.indexOf(token) !== -1) {
      violations.push(relPath + ': banned domain token "' + token + '"');
    }
  }
  let m;
  CAMELCASE_VENTURE_RE.lastIndex = 0;
  while ((m = CAMELCASE_VENTURE_RE.exec(text)) !== null) {
    const tok = m[0];
    if (!ALLOWED_PROPER_NOUNS.has(tok)) {
      violations.push(relPath + ': suspected proper-noun venture name "' + tok + '"');
    }
  }
  return violations;
}

// validate -- read + scan every target. Returns { ok, errors[] }.
function validate(targets) {
  const errors = [];
  for (const rel of targets) {
    const abs = path.isAbsolute(rel) ? rel : path.join(REPO_ROOT, rel);
    let text;
    try {
      text = fs.readFileSync(abs, 'utf8');
    } catch (e) {
      errors.push(rel + ': unreadable (' + String(e.message || '').slice(0, 60) + ')');
      continue;
    }
    const v = scanText(rel, text);
    for (const violation of v) errors.push(violation);
  }
  return { ok: errors.length === 0, errors: errors };
}

function main() {
  const argv = process.argv.slice(2);
  const label = isCheck(argv) ? 'check-abstraction-fixture-neutral --check' : 'check-abstraction-fixture-neutral';
  const one = explicitFile(argv);
  const targets = one ? [one] : DEFAULT_SCAN_TARGETS.slice();

  console.log('[' + label + '] Scanning ' + targets.length + ' file(s) for venture/domain content ...');
  const result = validate(targets);
  if (!result.ok) {
    console.error('[' + label + '] FAIL: domain-specific content found (Part 8 / no-real-names breach):');
    for (const e of result.errors) console.error('  - ' + e);
    console.error('[' + label + '] Recovery: remove the venture/AION-specific strings; the abstraction fixture must be domain-neutral.');
    process.exit(1);
  }
  console.log('[' + label + '] PASS: scanned files are domain-neutral (zero banned tokens, zero suspected venture names).');
  process.exit(0);
}

// Export the pure pieces for the proof suite; run main() when invoked directly.
module.exports = { validate, scanText, DENYLIST, DEFAULT_SCAN_TARGETS };

if (require.main === module) {
  main();
}
