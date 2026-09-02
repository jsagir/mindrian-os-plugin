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
 * baseline); 2 = data/flagship-floor-set.json exists but is malformed;
 * 3 = VOID, at least one probe did not cleanly succeed so this run is not a
 * floor verdict (TRUST-02, D-07). A VOID run requires a human re-run;
 * nothing auto-retries (D-08). Exit 3's four triggers: hard_error, timeout,
 * malformed (all Phase 259, TRUST-02), and unrecognized_shape (Phase 262,
 * D-04, below).
 *
 * Phase 262 (D-04, "The Theo Flip"): a successful call whose payload this
 * gate cannot read is a MEASUREMENT FAILURE, not a measurement. Theo (the
 * designated Brain successor) returns normalize_framework_name as
 * {canonical, matched_via, coverage} (no canonical_matches key) and
 * orchestration_readiness as {framework, score, ...} (no readiness
 * wrapper) -- shapes this gate's readers do not recognize. Left unguarded,
 * both probes would report ok:true with normalizeMatches/readinessScore
 * resolving to null, and the gate would print a silent false
 * "0/28 FLOOR DOES NOT HOLD" indistinguishable from a genuinely red floor.
 * probeFramework below pushes a failures[] entry with kind
 * 'unrecognized_shape' whenever a successful call yields a non-numeric
 * matches or score, routing the case through the existing VOID machinery
 * unchanged. This gate's READERS are deliberately NOT adapted to Theo's
 * actual shape here -- that is flip-day work, gated on theo-mcp.onrender.com
 * serving traffic, and belongs with Theo's other seven named
 * adaptation-list files. A future reader should not mistake this tripwire
 * for that adaptation.
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
//   probeResultsByName: { [name]: { normalizeMatches, readinessScore,
//     failures?: [{ probe, kind, httpStatus, detail, retryAfterS }] } }
//     A framework with NO entry is treated as a MISS (never silently
//     dropped from the row set -- every enumerated framework produces a row).
//     OQ-2 (Phase 259): "never probed" is not one of D-05's three trigger
//     types, and the live main() writes an entry for every enumerated
//     framework, so this branch is unreachable in production -- kept MISS
//     because tests/test-249-floor-gate.cjs pins it.
//
// Phase 259 (TRUST-02, D-05): a THIRD verdict, VOID, precedence:
//   1. failures.length > 0            -> VOID (outranks PASS and MISS -- a
//      probe that did not cleanly succeed carries no trustworthy
//      matches/score, so judging it at all is the prediction FLOOR-03
//      forbids)
//   2. matches === 1 && score >= 3    -> PASS
//   3. otherwise                      -> MISS
// Returns { rows, passCount, missCount, voidCount, exitCode }.
// exitCode: voidCount > 0 ? 3 : (missCount > 0 ? 1 : 0) -- D-07: VOID is a
// hard non-zero exit distinct from both clean (0) and real-MISS (1).
// ---------------------------------------------------------------------------
function evaluateFloor(frameworks, probeResultsByName) {
  const rows = frameworks.map((fw) => {
    const p = (probeResultsByName && probeResultsByName[fw.name]) || null;
    const failures = (p && Array.isArray(p.failures)) ? p.failures : [];
    if (failures.length > 0) {
      return { name: fw.name, uses: fw.uses, matches: p.normalizeMatches != null ? p.normalizeMatches : null, score: p.readinessScore != null ? p.readinessScore : null, verdict: 'VOID', failures };
    }
    const matches = p ? p.normalizeMatches : null;
    const score = p ? p.readinessScore : null;
    const matchesOk = matches === 1;
    const scoreOk = typeof score === 'number' && score >= 3;
    const verdict = matchesOk && scoreOk ? 'PASS' : 'MISS';
    return { name: fw.name, uses: fw.uses, matches, score, verdict, failures: [] };
  });
  const misses = rows.filter((r) => r.verdict === 'MISS');
  const voids = rows.filter((r) => r.verdict === 'VOID');
  return {
    rows,
    passCount: rows.filter((r) => r.verdict === 'PASS').length,
    missCount: misses.length,
    voidCount: voids.length,
    exitCode: voids.length > 0 ? 3 : (misses.length > 0 ? 1 : 0),
  };
}

// ---------------------------------------------------------------------------
// Live wiring -- CLI only, not exercised by the hermetic suite.
// ---------------------------------------------------------------------------
// Phase 259 (TRUST-02): collapse whitespace runs (including raw newlines) in
// Brain-supplied text before it is ever printed -- a log-injection and
// disclosure control, not cosmetics. Cap at 300 chars, the sentinel
// convention shared with lib/core/brain-client.cjs.
function _capDetail(text) {
  const s = typeof text === 'string' ? text : String(text == null ? '' : text);
  return s.replace(/\s+/g, ' ').trim().slice(0, 300);
}

// ---------------------------------------------------------------------------
// _resultKeys(res) -- Phase 262 (D-04). Module-private, NOT exported. Returns
// a short, printable description of what a probe's payload actually carried,
// for the unrecognized_shape failure detail. Every value it can return is
// Brain-controlled text, so its output is only ever consumed through
// _capDetail above (ASVS V7, log injection).
// ---------------------------------------------------------------------------
function _resultKeys(res) {
  if (!res || !res.result) return 'no result object';
  if (Array.isArray(res.result)) return 'array[' + res.result.length + ']';
  return Object.keys(res.result).join(', ');
}

async function probeFramework(name, key) {
  const normRes = await brainCall('normalize_framework_name', { raw: name }, key);
  const readyRes = await brainCall('orchestration_readiness', { framework_name: name }, key);
  const normalizeMatches = normRes.ok && normRes.result && Array.isArray(normRes.result.canonical_matches) ? normRes.result.canonical_matches.length : null;
  const readinessScore = readyRes.ok && readyRes.result && readyRes.result.readiness ? readyRes.result.readiness.readiness_score : null;

  // Phase 259 (TRUST-02, D-05/D-06): an additive failures[] array, one
  // entry per failed probe. errorKind comes from build-brain-census.cjs's
  // brainCall (Task 1); classification is never re-derived from bodyText
  // here (that would reintroduce the string-sniffing fragility errorKind
  // removes).
  const failures = [];
  if (!normRes.ok) {
    failures.push({
      probe: 'normalize',
      kind: normRes.errorKind || 'hard_error',
      httpStatus: normRes.httpStatus,
      detail: _capDetail(normRes.bodyText),
      retryAfterS: typeof normRes.retryAfterS === 'number' ? normRes.retryAfterS : null,
    });
  }
  if (!readyRes.ok) {
    failures.push({
      probe: 'readiness',
      kind: readyRes.errorKind || 'hard_error',
      httpStatus: readyRes.httpStatus,
      detail: _capDetail(readyRes.bodyText),
      retryAfterS: typeof readyRes.retryAfterS === 'number' ? readyRes.retryAfterS : null,
    });
  }

  // Phase 262 (D-04, "The Theo Flip"): a successful call whose payload
  // yields a non-numeric matches/score is a measurement failure, not a
  // measurement. Guarded on ok === true so a hard_error/timeout row never
  // gets a duplicate second failure entry (renderVoidDetailLines prints one
  // line per entry). typeof !== 'number', not a null check: covers null,
  // undefined, and a string-typed score, the same silent-degradation class.
  if (normRes.ok === true && typeof normalizeMatches !== 'number') {
    failures.push({
      probe: 'normalize',
      kind: 'unrecognized_shape',
      httpStatus: typeof normRes.httpStatus === 'number' ? normRes.httpStatus : null,
      detail: _capDetail('normalize_framework_name payload carried no numeric canonical_matches length; result keys: ' + _resultKeys(normRes)),
      retryAfterS: null,
    });
  }
  if (readyRes.ok === true && typeof readinessScore !== 'number') {
    failures.push({
      probe: 'readiness',
      kind: 'unrecognized_shape',
      httpStatus: typeof readyRes.httpStatus === 'number' ? readyRes.httpStatus : null,
      detail: _capDetail('orchestration_readiness payload carried no numeric readiness.readiness_score; result keys: ' + _resultKeys(readyRes)),
      retryAfterS: null,
    });
  }

  return {
    normalizeMatches,
    readinessScore,
    normalizeOk: normRes.ok,
    readinessOk: readyRes.ok,
    normalizeBody: normRes.ok ? null : normRes.bodyText,
    readinessBody: readyRes.ok ? null : readyRes.bodyText,
    failures,
  };
}

// ---------------------------------------------------------------------------
// renderVoidDetailLines(rows) -- pure, D-06. One indented line per failure
// entry across every VOID row (a row with two failing probes yields two
// lines). Never a bare "VOID" with no detail. Zero I/O, zero network.
// ---------------------------------------------------------------------------
const _KIND_WORD = Object.freeze({ hard_error: 'hard-error', timeout: 'timeout', malformed: 'malformed', unrecognized_shape: 'unrecognized-shape' });

function renderVoidDetailLines(rows) {
  const lines = [];
  for (const row of rows) {
    if (row.verdict !== 'VOID' || !Array.isArray(row.failures)) continue;
    for (const f of row.failures) {
      const kindWord = _KIND_WORD[f.kind] || f.kind;
      const httpPart = typeof f.httpStatus === 'number' && f.httpStatus !== 0 ? 'HTTP ' + f.httpStatus : '--';
      const detail = typeof f.detail === 'string' ? f.detail.replace(/\s+/g, ' ').trim() : '';
      const retryPart = typeof f.retryAfterS === 'number' ? ' retry_after=' + f.retryAfterS + 's' : '';
      lines.push(`  - ${row.name}  ${f.probe}  ${kindWord}  ${httpPart}${retryPart}  ${detail}`);
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// renderFloorSummaryLines(result) -- pure, D-06/D-07. Returns the pass line,
// the miss line (qualified as a lower bound when voidCount > 0), the void
// line (only when voidCount > 0), then the terminating banner. When
// voidCount === 0 both the summary lines and the banner are byte-identical
// to the pre-259 output. The VOID banner is a THIRD distinct banner --
// never a reuse of the RED one (a VOID that reads like a RED is how the
// false MISS gets re-invented in the operator's head).
// ---------------------------------------------------------------------------
function renderFloorSummaryLines(result) {
  const lines = [];
  const total = result.rows.length;
  const voidCount = result.voidCount || 0;
  const missSuffix = voidCount > 0 ? `  (lower bound, ${voidCount} row(s) VOID and not measured)` : '';
  lines.push(`Frameworks passing (exactly-1 match AND readiness>=3): ${result.passCount}/${total}`);
  lines.push(`Frameworks MISSING the floor: ${result.missCount}/${total}${missSuffix}`);
  if (voidCount > 0) {
    lines.push(`Frameworks VOIDED (probe did not cleanly succeed): ${voidCount}/${total}`);
  }
  if (voidCount > 0) {
    lines.push('=== FLOOR RUN VOID (probe failures present, re-run required, this is NOT a floor verdict) ===');
  } else {
    lines.push(result.exitCode === 0 ? '=== FLOOR HOLDS (SWEEP-02 gate GREEN) ===' : '=== FLOOR DOES NOT HOLD (SWEEP-02 gate RED) ===');
  }
  return lines;
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
  // Phase 259 (TRUST-02, D-06): print every VOID row's per-failure detail
  // before the summary block, so a run containing VOIDs is never a bare
  // "VOID" with no actionable detail.
  if (result.voidCount > 0) {
    for (const line of renderVoidDetailLines(result.rows)) console.log(line);
  }
  console.log('');
  for (const line of renderFloorSummaryLines(result)) console.log(line);
  process.exit(result.exitCode);
}

module.exports = { evaluateFloor, parseOverrideFile, CANON_PROSE_COMMAND_COUNT, probeFramework, renderVoidDetailLines, renderFloorSummaryLines };

if (require.main === module) {
  main().catch((e) => {
    console.error('FAIL: ' + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
}
