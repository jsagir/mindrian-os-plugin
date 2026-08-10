#!/usr/bin/env node
'use strict';

/*
 * scripts/check-flagship-floor.cjs
 * ==================================================================
 * Phase 249-02 (ENRICH-04) -- the machine form of the SWEEP-02 gate.
 *
 * Enumerates the invoked-framework set from commands/*.md frontmatter AT RUN
 * TIME via build-brain-census.cjs's exported scanMethodologyCommands (a
 * navigator ruling changes DATA, not code -- Part 11 ethos). Per framework
 * requires BOTH:
 *   - normalize_framework_name returns EXACTLY 1 canonical match
 *   - orchestration_readiness readiness_score >= 3
 * A multi-match name makes every readiness probe ambiguous (T6 takes
 * exact-first LIMIT 1), so exactly-1 is load-bearing (Pitfall 7). Prints one
 * evidence line per framework plus a summary, and exits non-zero on ANY
 * miss.
 *
 * Denominator honesty (research OQ1, unresolved navigator ratification): the
 * header ALWAYS prints both candidates -- the frontmatter scan (N commands /
 * M frameworks, derived from disk, never a frozen literal) and the canon
 * prose count (25) -- and marks the ratification OPEN. If
 * data/flagship-floor-set.json exists (written ONLY by that ratification
 * outcome, exclusively a 249-03 Task 2 checkpoint artifact), the enumeration
 * filters to it and the header cites the ratification instead of OPEN. A
 * malformed override file is refused with a DISTINCT exit code (2), never
 * silently ignored or silently accepted.
 *
 * Reuses build-brain-census.cjs's scanMethodologyCommands, brainCall, and
 * BRAIN_URL (all exported, verified this session) -- this script mints no
 * second HTTP client and no second frontmatter parser (Part 7).
 *
 * The gate LOGIC is a pure exported function (evaluateFloor: probe results
 * in, verdicts + exit code out) so tests/test-249-floor-gate.cjs injects
 * fixtures with ZERO network. The CLI main() below wires live brainCall over
 * it with the read-tier key from ~/.mindrian.env (lib/core/resolve-brain-key.cjs).
 *
 * Usage: node scripts/check-flagship-floor.cjs
 * Exit codes: 0 = every invoked framework clears the floor; 1 = at least one
 * miss (the expected, honest state today -- 24 misses per the research
 * baseline); 2 = data/flagship-floor-set.json exists but is malformed.
 *
 * No em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const OVERRIDE_PATH = path.join(REPO_ROOT, 'data', 'flagship-floor-set.json');

const { scanMethodologyCommands, brainCall, BRAIN_URL } = require('./build-brain-census.cjs');

// The 2026-08-10 canon-prose count, recorded (not resolved) -- mirrors the
// same constant already carried by build-brain-census.cjs's own header
// comment. See "Canon count discrepancy" in 249-RESEARCH.md.
const CANON_PROSE_COMMAND_COUNT = 25;

// ---------------------------------------------------------------------------
// parseOverrideFile(rawText) -- pure. Fails loud on malformed JSON or a
// malformed shape. Never silently accepts a partial/wrong-shaped override.
// ---------------------------------------------------------------------------
function parseOverrideFile(rawText) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    return { ok: false, error: 'malformed JSON: ' + (e && e.message ? e.message : String(e)) };
  }
  const frameworksOk =
    parsed && Array.isArray(parsed.frameworks) && parsed.frameworks.length > 0 && parsed.frameworks.every((n) => typeof n === 'string');
  if (!frameworksOk) {
    return { ok: false, error: 'malformed shape: expected { frameworks: [non-empty string array], ... }' };
  }
  return { ok: true, frameworks: parsed.frameworks, meta: parsed };
}

// ---------------------------------------------------------------------------
// evaluateFloor(frameworks, probeResultsByName) -- pure gate logic.
//   frameworks: [{ name, uses }] -- the enumerated (or override-filtered) set.
//   probeResultsByName: { [name]: { normalizeMatches, readinessScore } }
//     A framework with NO entry is treated as a MISS (never silently
//     dropped from the row set -- every enumerated framework produces a row).
// Returns { rows, passCount, missCount, exitCode }.
// ---------------------------------------------------------------------------
function evaluateFloor(frameworks, probeResultsByName) {
  const rows = frameworks.map((fw) => {
    const p = (probeResultsByName && probeResultsByName[fw.name]) || null;
    const matches = p ? p.normalizeMatches : null;
    const score = p ? p.readinessScore : null;
    const matchesOk = matches === 1;
    const scoreOk = typeof score === 'number' && score >= 3;
    const verdict = matchesOk && scoreOk ? 'PASS' : 'MISS';
    return { name: fw.name, uses: fw.uses, matches, score, verdict };
  });
  const misses = rows.filter((r) => r.verdict === 'MISS');
  return {
    rows,
    passCount: rows.length - misses.length,
    missCount: misses.length,
    exitCode: misses.length > 0 ? 1 : 0,
  };
}

// ---------------------------------------------------------------------------
// Live wiring -- CLI only, not exercised by the hermetic suite.
// ---------------------------------------------------------------------------
async function probeFramework(name, key) {
  const normRes = await brainCall('normalize_framework_name', { raw: name }, key);
  const readyRes = await brainCall('orchestration_readiness', { framework_name: name }, key);
  const normalizeMatches = normRes.ok && normRes.result && Array.isArray(normRes.result.canonical_matches) ? normRes.result.canonical_matches.length : null;
  const readinessScore = readyRes.ok && readyRes.result && readyRes.result.readiness ? readyRes.result.readiness.readiness_score : null;
  return {
    normalizeMatches,
    readinessScore,
    normalizeOk: normRes.ok,
    readinessOk: readyRes.ok,
    normalizeBody: normRes.ok ? null : normRes.bodyText,
    readinessBody: readyRes.ok ? null : readyRes.bodyText,
  };
}

async function main() {
  const { resolveBrainKey } = require('../lib/core/resolve-brain-key.cjs');
  const keyInfo = resolveBrainKey();
  if (!keyInfo.available) {
    console.error('Brain key unavailable: ' + keyInfo.reason);
    console.error('This gate needs a READ-tier key (MINDRIAN_BRAIN_KEY env or ~/.mindrian.env). No admin key is used.');
    process.exit(1);
  }
  const key = keyInfo.key;

  const scanned = scanMethodologyCommands();
  let frameworks = scanned.frameworks;
  let ratificationLine;

  if (fs.existsSync(OVERRIDE_PATH)) {
    let rawText;
    try {
      rawText = fs.readFileSync(OVERRIDE_PATH, 'utf8');
    } catch (e) {
      console.error('FAIL: could not read ' + OVERRIDE_PATH + ': ' + (e && e.message ? e.message : String(e)));
      process.exit(2);
    }
    const parsedOverride = parseOverrideFile(rawText);
    if (!parsedOverride.ok) {
      console.error('FAIL: data/flagship-floor-set.json exists but is malformed: ' + parsedOverride.error);
      console.error('Refusing to run against an ambiguous floor set. Fix or remove the file.');
      process.exit(2);
    }
    const overrideNames = new Set(parsedOverride.frameworks);
    frameworks = scanned.frameworks.filter((fw) => overrideNames.has(fw.name));
    ratificationLine =
      'Floor denominator: RATIFIED at ' + parsedOverride.frameworks.length + ' framework(s) (data/flagship-floor-set.json, ratified_by=' +
      (parsedOverride.meta.ratified_by || 'unknown') + ', ratified_at=' + (parsedOverride.meta.ratified_at || 'unknown') + ')';
  } else {
    ratificationLine =
      'Floor denominator: OPEN (navigator ratification pending, 249-03 Task 2). ' +
      'Candidate A (frontmatter scan, operating superset): ' + scanned.commandCount + ' kind:methodology command(s) / ' +
      scanned.frameworks.length + ' distinct framework(s). ' +
      'Candidate B (canon prose): ' + CANON_PROSE_COMMAND_COUNT + ' command(s).';
  }

  console.log('Brain URL: ' + BRAIN_URL);
  console.log(ratificationLine);
  console.log('Enumerated frameworks this run: ' + frameworks.length);
  console.log('');

  const probeResultsByName = {};
  for (const fw of frameworks) {
    probeResultsByName[fw.name] = await probeFramework(fw.name, key);
  }

  const result = evaluateFloor(frameworks, probeResultsByName);
  for (const row of result.rows) {
    const p = probeResultsByName[row.name] || {};
    const httpNote = !p.normalizeOk || !p.readinessOk ? ` (HTTP: normalize_ok=${p.normalizeOk} readiness_ok=${p.readinessOk})` : '';
    console.log(
      `[${row.verdict}] ${row.name} -- uses=${row.uses} matches=${row.matches == null ? 'n/a' : row.matches} score=${row.score == null ? 'n/a' : row.score}/4${httpNote}`
    );
  }
  console.log('');
  console.log(`Frameworks passing (exactly-1 match AND readiness>=3): ${result.passCount}/${result.rows.length}`);
  console.log(`Frameworks MISSING the floor: ${result.missCount}/${result.rows.length}`);
  console.log(result.exitCode === 0 ? '=== FLOOR HOLDS (SWEEP-02 gate GREEN) ===' : '=== FLOOR DOES NOT HOLD (SWEEP-02 gate RED) ===');
  process.exit(result.exitCode);
}

module.exports = { evaluateFloor, parseOverrideFile, CANON_PROSE_COMMAND_COUNT, probeFramework };

if (require.main === module) {
  main().catch((e) => {
    console.error('FAIL: ' + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
}
