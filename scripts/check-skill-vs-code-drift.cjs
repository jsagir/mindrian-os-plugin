#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-02 Task 2 -- skill-vs-code-drift CI tripwire
 * =========================================================
 * Scans skills/ui-system/SKILL.md against the shipped renderer / glyph /
 * shape code in lib/render/render-v2.cjs and reports drift. Exits 0 on a
 * clean repo (no drift); exits 1 when SKILL.md disagrees with shipped code
 * or is missing required cross-references / sidecar rules files.
 *
 * The asymmetric severity contract:
 *   - missing_in_skill (code has it, doc doesn't) is FATAL. This is the
 *     drift class Phase 121.5 Plan 02 was created to fix: docs lag code
 *     means the canon misleads.
 *   - missing_in_code (doc has it, code doesn't) is NON-FATAL. SKILL.md
 *     may legitimately document a forthcoming shape ahead of a code
 *     refactor; flag it but do not fail the build.
 *   - missing_crossrefs / missing_rules_files are FATAL: the reconciliation
 *     contract requires Canon Part 3 + Part 10 cross-refs + the dual
 *     palette source + the ODD 4 paragraph + the three sidecar rules files.
 *
 * Modes:
 *   --json   emit structured drift report on stdout
 *   default  human-readable summary; non-zero exit on FATAL drift
 *
 * Canon Part 7 invariant: this script REPLACES nothing -- it codifies the
 * doc-vs-code contract Plan 02 Task 1 just landed. Plan 02 Task 1
 * reconciles; this checker enforces.
 *
 * No em-dashes, no emoji (per skills/ui-system/SKILL.md §3).
 */

const fs = require('fs');
const path = require('path');

const SKILL_PATH = path.join(__dirname, '..', 'skills', 'ui-system', 'SKILL.md');
const RENDER_V2_PATH = path.join(__dirname, '..', 'lib', 'render', 'render-v2.cjs');
const RULES_DIR = path.join(__dirname, '..', 'skills', 'ui-system', 'rules');

const REQUIRED_RULES = [
  'shape-f-zero-and-six.md',
  'dual-palette.md',
  'glyph-disambiguation.md',
];

const REQUIRED_CROSSREFS = [
  'Canon Part 3',
  'Canon Part 10',
  'JTBD-PALETTES',
  'ODD 4 resolution',
];

function shapesFromSkill(text) {
  // Match "Shape F.0", "Shape F.1" ... "Shape F.6" headings/inline.
  // The leading "Shape" prefix is what disambiguates a Shape reference from
  // an arbitrary F.<digit> appearing in code samples or filenames.
  const re = /Shape F\.(\d)\b/g;
  const out = new Set();
  let m;
  while ((m = re.exec(text)) !== null) out.add('F.' + m[1]);
  return out;
}

function shapesFromCode(text) {
  // Match F.<digit> references in lib/render/render-v2.cjs (e.g. "F.0", "F.1")
  // -- case-sensitive, word-boundary-prefixed.
  const re = /\bF\.(\d)\b/g;
  const out = new Set();
  let m;
  while ((m = re.exec(text)) !== null) out.add('F.' + m[1]);
  return out;
}

function check(opts) {
  const o = opts || {};
  const skillPath = o.skillPath || SKILL_PATH;
  const codePath = o.codePath || RENDER_V2_PATH;
  const rulesDir = o.rulesDir || RULES_DIR;

  const skill = fs.readFileSync(skillPath, 'utf8');
  let code = '';
  try {
    code = fs.readFileSync(codePath, 'utf8');
  } catch (_) {
    // render-v2 may legitimately not exist on some checkouts; treat as
    // empty code surface (no shapes implemented).
  }

  const inSkill = shapesFromSkill(skill);
  const inCode = code ? shapesFromCode(code) : new Set();

  // missing_in_skill: code has it, SKILL doesn't.
  const missing_in_skill = Array.from(inCode).filter(function (s) {
    return !inSkill.has(s);
  });

  // missing_in_code: SKILL has it, code doesn't (acceptable -- doc may lead
  // code; flagged but not fatal).
  const missing_in_code = Array.from(inSkill).filter(function (s) {
    return !inCode.has(s);
  });

  const missing_crossrefs = REQUIRED_CROSSREFS.filter(function (s) {
    return skill.indexOf(s) === -1;
  });

  const missing_rules_files = REQUIRED_RULES.filter(function (f) {
    return !fs.existsSync(path.join(rulesDir, f));
  });

  // FATAL drift classes: missing_in_skill, missing_crossrefs, missing_rules_files.
  // missing_in_code is non-fatal by design (docs ahead of code is the OK case).
  const valid =
    missing_in_skill.length === 0 &&
    missing_crossrefs.length === 0 &&
    missing_rules_files.length === 0;

  return {
    valid: valid,
    missing_in_skill: missing_in_skill,
    missing_in_code: missing_in_code,
    missing_crossrefs: missing_crossrefs,
    missing_rules_files: missing_rules_files,
  };
}

function main() {
  const wantJson = process.argv.indexOf('--json') !== -1;
  let result;
  try {
    result = check();
  } catch (e) {
    if (wantJson) {
      console.log(JSON.stringify({
        valid: false,
        missing_in_skill: [],
        missing_in_code: [],
        missing_crossrefs: [],
        missing_rules_files: [],
        error: String(e.message || e),
      }, null, 2));
    } else {
      console.error('check-skill-vs-code-drift failed: ' + String(e.message || e));
    }
    process.exit(1);
  }

  if (wantJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('valid: ' + result.valid);
    if (result.missing_in_skill.length) {
      console.error('  SKILL.md missing shapes shipped in code (FATAL): ' +
        result.missing_in_skill.join(', '));
    }
    if (result.missing_in_code.length) {
      console.error('  Code missing shapes documented in SKILL.md (non-fatal): ' +
        result.missing_in_code.join(', '));
    }
    if (result.missing_crossrefs.length) {
      console.error('  SKILL.md missing cross-refs (FATAL): ' +
        result.missing_crossrefs.join(', '));
    }
    if (result.missing_rules_files.length) {
      console.error('  Missing sidecar rules files (FATAL): ' +
        result.missing_rules_files.join(', '));
    }
  }

  process.exit(result.valid ? 0 : 1);
}

if (require.main === module) main();

module.exports = { check, shapesFromSkill, shapesFromCode };
