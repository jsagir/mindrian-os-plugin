#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 02 Task 3 -- the RED cross-producer agreement test
 * (HIPS-01; SPEC AC1, AC2). Drives every live direction-classifying
 * producer against tests/fixtures/355/direction-pairs.json's expected
 * labels (computed by lib/core/direction-convention.cjs classify() after
 * the PWS author's phrase ruling, 355-PHRASE-CONFIRMATION.md) and states,
 * per leg, which later 355 plan turns that leg green:
 *
 *   leg A  module classify()                          -- pass now
 *   leg B  rs-math.classifyDirection                   -- pass now
 *   leg C  hsi-lsa.classifyDirectionB                   -- 355-09
 *   leg D  hsi-engine.computeHsiMatrix                  -- 355-09
 *   leg E  rs-differential-scorer.scoreMeasured         -- 355-10
 *   leg F  rs-innovation-classifier.classify            -- 355-09
 *   leg G  Python detect-reverse-salients.py off        -- 355-11
 *   leg H  one rule (comparison-to-label code lives      -- 355-09 + 355-10
 *          only in lib/core/direction-convention.cjs)
 *
 * At the end of THIS plan, legs A and B pass; legs C-H fail. That is the
 * point -- this test states exactly what each producer flip must deliver.
 *
 * Test hygiene contract (every 355 test, per the plan context block):
 * scrub TYPESAFE_API_KEY and install the net guard through
 * tests/helpers/hygiene-355.cjs BEFORE requiring any repo module; assert
 * attempts() === 0 as the last check.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const hygiene = require('./helpers/hygiene-355.cjs');

const hadKey = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const REPO = path.join(__dirname, '..');

const checker = hygiene.makeChecker('test-355-direction-agreement');
const { check } = checker;

const d = require(path.join(REPO, 'lib', 'core', 'direction-convention.cjs'));
const rsMath = require(path.join(REPO, 'lib', 'core', 'rs-math.cjs'));
const hsiLsa = require(path.join(REPO, 'lib', 'core', 'hsi-lsa.cjs'));
const hsiEngine = require(path.join(REPO, 'lib', 'core', 'hsi-engine.cjs'));
const scorer = require(path.join(REPO, 'lib', 'core', 'rs-differential-scorer.cjs'));
const classifier = require(path.join(REPO, 'lib', 'core', 'rs-innovation-classifier.cjs'));

const FIXTURE_PATH = path.join(REPO, 'tests', 'fixtures', '355', 'direction-pairs.json');
let fixture = null;
let fixtureLoadError = null;
try {
  fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
} catch (e) {
  fixtureLoadError = e;
}

check(
  'tests/fixtures/355/direction-pairs.json loads',
  fixture !== null,
  fixtureLoadError ? String(fixtureLoadError.message) : undefined
);

if (fixture === null) {
  netGuard.restore();
  console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + hadKey);
  process.exit(checker.summary());
}

check(
  'fixture.pairs.length >= 30',
  Array.isArray(fixture.pairs) && fixture.pairs.length >= 30,
  'found ' + (fixture.pairs && fixture.pairs.length)
);
check(
  'fixture guard: fixture.phrase_hash === phraseHash()',
  fixture.phrase_hash === d.phraseHash(),
  'fixture=' + fixture.phrase_hash + ' live=' + d.phraseHash()
);

const pairs = Array.isArray(fixture.pairs) ? fixture.pairs : [];

// ---------------------------------------------------------------------------
// Small local helpers
// ---------------------------------------------------------------------------

// Mirrors direction-convention.cjs classify()'s own null-check-first,
// then-Number.isFinite gate -- so "eligible for a finite-only leg" means the
// SAME thing here as it does inside the module under test (null / undefined
// never count as finite, even though Number(null) === 0).
function isEligibleFinite(v) {
  if (v === null || v === undefined) return false;
  return Number.isFinite(Number(v));
}

// ---------------------------------------------------------------------------
// Leg A: the module itself. Must pass for every pair -- the fixture's
// expected labels were generated FROM this function, so any A failure would
// mean the fixture drifted from the module (a fixture bug, not a producer
// bug).
// ---------------------------------------------------------------------------
for (const pair of pairs) {
  const got = d.classify(pair.lsa, pair.semantic);
  check('A module classify pair ' + pair.id, got === pair.expected, 'got ' + got + ' expected ' + pair.expected);
}

// ---------------------------------------------------------------------------
// Leg B: rs-math.classifyDirection(signedDiff), finite pairs only. rs-math
// already implements Convention A directly (D-02's sibling), so this must
// pass now, not RED.
// ---------------------------------------------------------------------------
for (const pair of pairs) {
  if (!isEligibleFinite(pair.lsa) || !isEligibleFinite(pair.semantic)) continue;
  const signedDiff = Number(pair.semantic) - Number(pair.lsa);
  const got = rsMath.classifyDirection(signedDiff);
  check('B rs-math classifyDirection pair ' + pair.id, got === pair.expected, 'got ' + got + ' expected ' + pair.expected);
}

// ---------------------------------------------------------------------------
// Leg C: hsi-lsa.classifyDirectionB (Convention B, opposite bucketing).
// RED until 355-09 unifies this call site onto Convention A.
// ---------------------------------------------------------------------------
for (const pair of pairs) {
  const got = hsiLsa.classifyDirectionB(pair.lsa, pair.semantic);
  check(
    'C hsi-lsa classifyDirectionB pair ' + pair.id + ' (turns green in 355-09)',
    got === pair.expected,
    'got ' + got + ' expected ' + pair.expected
  );
}

// ---------------------------------------------------------------------------
// Leg D: hsi-engine.computeHsiMatrix -- drives the exact function the :272
// call site sits in with a crafted 2-artifact LSA matrix and semantic
// matrix whose single off-diagonal cells equal the pair's (lsa, semantic)
// values. RED until 355-09.
// ---------------------------------------------------------------------------
if (typeof hsiEngine.computeHsiMatrix !== 'function') {
  check('D hsi-engine seam missing: export the pair-label path (355-09)', false);
} else {
  const artifactsD = [
    { id: 'probe-a', text: 'probe artifact one for the direction agreement leg D crafted pair, kept fixed across every pair so only the matrices vary' },
    { id: 'probe-b', text: 'probe artifact two for the direction agreement leg D crafted pair, distinct wording so the LSA/semantic legs never collapse to one artifact' },
  ];
  for (const pair of pairs) {
    const lsaMatrix = [
      [1, pair.lsa],
      [pair.lsa, 1],
    ];
    const semMatrix = [
      [1, pair.semantic],
      [pair.semantic, 1],
    ];
    let got = null;
    let detail;
    try {
      const result = hsiEngine.computeHsiMatrix(artifactsD, lsaMatrix, semMatrix, 0);
      const p = result && Array.isArray(result.pairs) ? result.pairs[0] : null;
      if (p) {
        got = p.surprise_type;
      } else {
        detail = 'no pair returned from computeHsiMatrix';
      }
    } catch (e) {
      detail = 'threw: ' + e.message;
    }
    check(
      'D hsi-engine computeHsiMatrix pair ' + pair.id + ' (turns green in 355-09)',
      got === pair.expected,
      detail || 'got ' + got + ' expected ' + pair.expected
    );
  }
}

// ---------------------------------------------------------------------------
// Leg E: rs-differential-scorer.scoreMeasured, injected lexicalFn -> lsa and
// encodeFn -> vecsFor(semantic) (cosine([1,0],[c,sqrt(1-c^2)]) === c exactly,
// per 355-RESEARCH.md's Code Examples section). Only pairs with a finite
// semantic in [0, 1] are driven. RED until 355-10 (scoreMeasured's own
// direction ternary is the mirror-image of Convention A -- D-47).
// ---------------------------------------------------------------------------
async function runLegE() {
  const vecsFor = (c) => [[1, 0], [c, Math.sqrt(Math.max(0, 1 - c * c))]];
  for (const pair of pairs) {
    const sem = pair.semantic;
    if (typeof sem !== 'number' || !Number.isFinite(sem) || sem < 0 || sem > 1) continue;
    const lsaVal = pair.lsa;
    let got = null;
    let detail;
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await scorer.scoreMeasured('probe a', 'probe b', {
        lexicalFn: () => lsaVal,
        encodeFn: () => vecsFor(sem),
      });
      got = r && r.direction;
    } catch (e) {
      detail = 'threw: ' + e.message;
    }
    check(
      'E scoreMeasured pair ' + pair.id + ' (turns green in 355-10)',
      got === pair.expected,
      detail || 'got ' + got + ' expected ' + pair.expected
    );
  }
}

// ---------------------------------------------------------------------------
// Leg F: rs-innovation-classifier.classify's single-axis branch, only for
// pairs flagged classifier_single_axis (exactly one of lsa/semantic >= 0.3).
// RED until 355-09 (the classifier's lsaHigh/!bertHigh -> structural_transfer
// mapping is the mirror image of Convention A on the same two axes).
// ---------------------------------------------------------------------------
function runLegF() {
  for (const pair of pairs) {
    if (pair.classifier_single_axis !== true) continue;
    const lsaNum = Number(pair.lsa);
    const semNum = Number(pair.semantic);
    const r = classifier.classify({
      query_concept: 'probe-query',
      doc_concept: 'probe-doc',
      diff: semNum - lsaNum,
      lsa: lsaNum,
      bert: semNum,
      passes: true,
    });
    const got = r && r.classification;
    check(
      'F classifier pair ' + pair.id + ' (turns green in 355-09)',
      got === pair.expected,
      'got ' + got + ' expected ' + pair.expected
    );
  }
}

// ---------------------------------------------------------------------------
// Leg G: the Python detector is off all four live callers. RED until 355-11.
// ---------------------------------------------------------------------------
function runLegG() {
  const pyCallRegex = /python3?\s+[^\n]*detect-reverse-salients\.py/;
  const mdCallers = ['commands/scout.md', 'skills/scout/SKILL.md'];
  const cjsCallers = ['scripts/scout-cadence-runner.cjs', 'lib/core/intelligence-cascade.cjs'];

  for (const relPath of mdCallers) {
    const abs = path.join(REPO, relPath);
    let content = '';
    let readError;
    try {
      content = fs.readFileSync(abs, 'utf8');
    } catch (e) {
      readError = e;
    }
    const found = pyCallRegex.test(content);
    check(
      'G python off: ' + relPath + ' (turns green in 355-11)',
      !found,
      readError ? 'read error: ' + readError.message : found ? 'still invokes detect-reverse-salients.py' : undefined
    );
  }

  for (const relPath of cjsCallers) {
    const abs = path.join(REPO, relPath);
    const joined = hygiene.nonCommentLines(abs).join('\n');
    const found = joined.indexOf('detect-reverse-salients') !== -1;
    check(
      'G python off: ' + relPath + ' (turns green in 355-11)',
      !found,
      found ? 'still references detect-reverse-salients on a non-comment line' : undefined
    );
  }
}

// ---------------------------------------------------------------------------
// Leg H: one rule. The comparison-to-label rule (a ternary or return holding
// both wire-id literals, or a numeric comparison next to a wire-id literal)
// must live ONLY in lib/core/direction-convention.cjs. RED until 355-09 AND
// 355-10 (rs-math.cjs, hsi-lsa.cjs and rs-differential-scorer.cjs each still
// carry their own copy of the rule).
// ---------------------------------------------------------------------------
const H_PATTERNS = [
  // A ternary (or object-literal-shaped text) holding both wire-id literals
  // separated by a colon: 'structural_transfer' : 'semantic_implementation'.
  /['"](structural_transfer|semantic_implementation)['"]\s*:\s*['"](structural_transfer|semantic_implementation)['"]/,
  // A numeric comparison and a wire-id literal on the same line.
  /[<>]=?[^=].*['"](structural_transfer|semantic_implementation)['"]/,
  // A direct return of a wire-id literal.
  /return\s+['"](structural_transfer|semantic_implementation)['"]/,
];

function scanFileForRulePattern(abs) {
  const lines = hygiene.nonCommentLines(abs);
  for (const line of lines) {
    for (const re of H_PATTERNS) {
      if (re.test(line)) return true;
    }
  }
  return false;
}

function listScanFiles() {
  const libFiles = hygiene.listFilesRecursive(path.join(REPO, 'lib')).filter((f) => f.endsWith('.cjs'));
  let scriptsFiles = [];
  try {
    scriptsFiles = fs
      .readdirSync(path.join(REPO, 'scripts'), { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.cjs'))
      .map((e) => path.join(REPO, 'scripts', e.name));
  } catch (e) {
    // scripts/ is expected to exist in this repo; an absent dir is not fatal
    // to the sweep, it just yields zero scripts/*.cjs hits.
  }
  return libFiles.concat(scriptsFiles);
}

// ALLOWED_HITS: repo-relative paths permitted to carry the comparison-to-
// label rule besides lib/core/direction-convention.cjs itself. Empty now;
// any future entry needs a one-line reason next to it.
const ALLOWED_HITS = [];

function runLegH() {
  const directionModuleAbs = path.join(REPO, 'lib', 'core', 'direction-convention.cjs');
  const scratchAbs = path.join(REPO, 'lib', 'core', '__scratch_direction_rule_355.cjs');

  const files = listScanFiles();
  check('H scanned file count > 0 (' + files.length + ' files)', files.length > 0);

  const hits = files.filter((abs) => scanFileForRulePattern(abs));
  const unresolved = hits.filter(
    (abs) => abs !== directionModuleAbs && ALLOWED_HITS.indexOf(path.relative(REPO, abs)) === -1
  );

  check(
    'H one rule: comparison-to-label code found only in lib/core/direction-convention.cjs (turns green in 355-09 and 355-10)',
    unresolved.length === 0,
    unresolved.length ? 'unresolved hits: ' + unresolved.map((f) => path.relative(REPO, f)).join(', ') : undefined
  );

  // Negative control: plant a scratch rule file under lib/core/, confirm the
  // sweep catches it, then remove it in a finally block regardless of
  // outcome (T-355-08).
  let scratchWritten = false;
  try {
    fs.writeFileSync(scratchAbs, "const x = d > 0 ? 'structural_transfer' : 'semantic_implementation';\n");
    scratchWritten = true;
    const caught = scanFileForRulePattern(scratchAbs);
    check('H negative control: planted scratch rule file caught', caught === true);
  } finally {
    if (scratchWritten) {
      try {
        fs.unlinkSync(scratchAbs);
      } catch (e) {
        // best-effort cleanup; a leftover scratch file would itself be
        // caught by a later run of this same sweep.
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Run the async leg, then the remaining sync legs, then summarize.
// ---------------------------------------------------------------------------
(async () => {
  try {
    await runLegE();
    runLegF();
    runLegG();
    runLegH();
  } finally {
    check('installNetGuard: zero fetch attempts', netGuard.attempts() === 0);
    netGuard.restore();
    console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + hadKey);
    process.exit(checker.summary());
  }
})();
