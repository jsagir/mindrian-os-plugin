#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * check-first-touch-drift.cjs
 * ---------------------------
 * SEED-007 scanner family (Phase 95.6 D-07).
 *
 * Scans a fixed set of "first-touch surfaces" for three drift patterns:
 *
 *   Pattern 1  em-dash (U+2014) anywhere in a first-touch surface
 *              -- violates the no-em-dash hard rule (CLAUDE.md / memory
 *              feedback_no_emdashes.md). Source finding: 2026-05-07 stale
 *              v1.12.0 greeting with em-dashes on a Windows install (SEED-007).
 *
 *   Pattern 2  a hardcoded version literal (v?1.\d+.\d+) in greeting copy
 *              that is not the current plugin.json version (allowing the
 *              X.Y.Z core of a pre-release version, e.g. 1.13.0 inside
 *              1.13.0-beta.8). Source finding: 2026-05-07 stale greeting
 *              still claiming an old version (SEED-007). Scoped to the
 *              greeting-copy surfaces only -- README / install.sh carry
 *              legitimate version histories and are out of scope for this
 *              pattern.
 *
 *   Pattern 3  the license token (BSL[- ]?1\.1) within ~80 chars of the
 *              two-word phrase open + source on the same line -- the
 *              mislabel. Trigger: Phase 95.6 D-06 (the license-language
 *              mislabel that institutional IT review + cautious AI tooling
 *              would flag). BSL-1.1 is a source-available license; calling
 *              it OSS is the drift this pattern catches.
 *
 * On any hit: prints "DRIFT: <file>:<line> pattern <N> -- <description>"
 * and exits 1. On no hits: prints "first-touch surfaces clean" and exits 0.
 *
 * Test override: if MOS_TEST_SCAN_DIR is set, the scanner ignores the fixed
 * surface lists and instead runs ALL THREE patterns against every .md /
 * .cjs / .sh / .json / .txt file directly under that directory. Used by
 * tests/test-first-touch-drift-scanner.cjs to point the scanner at a tiny
 * fixture dir.
 *
 * Pure CJS, node built-ins only, zero npm deps. No emoji, no em-dashes in
 * this file.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// --- Surface lists --------------------------------------------------------

// Pattern 1 (em-dash) + Pattern 3 (license-language mislabel) scan this set.
const DOC_SURFACES = [
  'README.md',
  'install.sh',
  '.claude-plugin/plugin.json',
  'commands/splash.md',
  'commands/onboard.md',
  'commands/help.md',
  'skills/larry-personality/SKILL.md',
  'lib/copy/115-spec-strings.cjs',
  'agents/larry-extended.md',
];

// Pattern 2 (stale version literal) scans ONLY the pure greeting-copy
// surfaces. README.md / install.sh legitimately carry version histories
// (milestone tables, CHANGELOG-style headings, shields badges) and
// agents/larry-extended.md carries version literals in persona-aliasing prose
// and forward-references (e.g. "extends in Phase 100 / v1.14.0") -- all of
// which would false-positive. They are deliberately excluded from pattern 2;
// SEED-007's full pattern-2 rollout across all five first-touch copy surfaces
// is Phase 115's job. D-07 establishes the scanner with pattern 3 and the
// load-bearing greeting-copy surfaces below.
const GREETING_COPY_SURFACES = [
  'lib/copy/115-spec-strings.cjs',
  'commands/splash.md',
];

// A line in a greeting-copy surface that legitimately references a historical
// or future version (CHANGELOG-style, milestone, phase pointer) is exempt
// from pattern 2. Kept intentionally small.
const VERSION_CONTEXT_ALLOWLIST_RE = /CHANGELOG|## \[\d|shipped|Milestone|Converts to|release:|Phase \d|aliased to|future/i;

// --- Helpers --------------------------------------------------------------

function readPluginVersion() {
  try {
    const raw = fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8');
    const v = JSON.parse(raw).version;
    return typeof v === 'string' ? v : null;
  } catch (_e) {
    return null;
  }
}

// X.Y.Z core of a (possibly pre-release) version string. "1.13.0-beta.8" -> "1.13.0".
function coreVersion(v) {
  if (!v) return null;
  const m = String(v).replace(/^v/, '').match(/^(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}

function safeReadLines(absPath) {
  try {
    return fs.readFileSync(absPath, 'utf8').split('\n');
  } catch (_e) {
    return null;
  }
}

// U+2014 EM DASH, written as an escape so this source file stays ASCII-clean
// (the no-em-dash hard rule applies to the scanner itself too).
const EM_DASH = '\u2014';
const VERSION_LITERAL_RE = /v?\d+\.\d+\.\d+/g;
const BSL_TOKEN_RE = /BSL[- ]?1\.1/;
const OPEN_SOURCE_RE = /open[- ]?source/;

function checkPattern1(file, lines, hits) {
  lines.forEach((line, idx) => {
    if (line.indexOf(EM_DASH) !== -1) {
      hits.push({ file, line: idx + 1, pattern: 1, desc: 'em-dash (U+2014) in a first-touch surface; use a hyphen' });
    }
  });
}

function checkPattern2(file, lines, hits, currentCore) {
  lines.forEach((line, idx) => {
    if (VERSION_CONTEXT_ALLOWLIST_RE.test(line)) return; // historical / future-version context
    const matches = line.match(VERSION_LITERAL_RE);
    if (!matches) return;
    for (const lit of matches) {
      const core = lit.replace(/^v/, '');
      if (currentCore && core === currentCore) continue; // current version is fine
      hits.push({
        file,
        line: idx + 1,
        pattern: 2,
        desc: `hardcoded version literal "${lit}" in greeting copy (current is ${currentCore || 'unknown'}); greeting copy must not pin a version`,
      });
    }
  });
}

function checkPattern3(file, lines, hits) {
  lines.forEach((line, idx) => {
    const bslMatch = BSL_TOKEN_RE.exec(line);
    const osMatch = OPEN_SOURCE_RE.exec(line);
    if (bslMatch && osMatch) {
      const distance = Math.abs(bslMatch.index - osMatch.index);
      if (distance <= 80) {
        hits.push({
          file,
          line: idx + 1,
          pattern: 3,
          desc: 'license token labelled as OSS on the same line (source-available license described as the wrong category)',
        });
      }
    }
  });
}

// --- Main -----------------------------------------------------------------

function main() {
  const hits = [];
  const currentCore = coreVersion(readPluginVersion());

  const testDir = process.env.MOS_TEST_SCAN_DIR;
  if (testDir) {
    let entries = [];
    try {
      entries = fs.readdirSync(testDir, { withFileTypes: true });
    } catch (_e) {
      console.error(`check-first-touch-drift: MOS_TEST_SCAN_DIR not readable: ${testDir}`);
      process.exit(2);
    }
    const SCAN_EXT = new Set(['.md', '.cjs', '.sh', '.json', '.txt']);
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      if (!SCAN_EXT.has(path.extname(ent.name))) continue;
      const abs = path.join(testDir, ent.name);
      const lines = safeReadLines(abs);
      if (lines === null) continue;
      checkPattern1(ent.name, lines, hits);
      checkPattern2(ent.name, lines, hits, currentCore);
      checkPattern3(ent.name, lines, hits);
    }
  } else {
    // Pattern 1 + Pattern 3 over the broad doc-surface set.
    for (const rel of DOC_SURFACES) {
      const abs = path.join(REPO_ROOT, rel);
      const lines = safeReadLines(abs);
      if (lines === null) continue; // missing surface is not a hard fail; warn only
      checkPattern1(rel, lines, hits);
      checkPattern3(rel, lines, hits);
    }
    // Pattern 2 over the narrow greeting-copy set.
    for (const rel of GREETING_COPY_SURFACES) {
      const abs = path.join(REPO_ROOT, rel);
      const lines = safeReadLines(abs);
      if (lines === null) continue;
      checkPattern2(rel, lines, hits, currentCore);
    }
  }

  if (hits.length > 0) {
    for (const h of hits) {
      console.log(`DRIFT: ${h.file}:${h.line} pattern ${h.pattern} -- ${h.desc}`);
    }
    console.log(`first-touch drift: ${hits.length} hit(s)`);
    process.exit(1);
  }

  console.log('first-touch surfaces clean');
  process.exit(0);
}

main();
