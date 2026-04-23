#!/usr/bin/env node
/**
 * diagnostics-command.cjs -- CLI Dispatcher for /mos:diagnostics
 * ================================================================
 * Exposes 4 Wave-1 Python algorithms that previously had zero
 * command surface:
 *
 *   compute-disruption-index.py   (Funk and Owen-Smith 2017 CD index)
 *   compute-blindspot-mass.py     (Good-Turing coverage estimation)
 *   compute-element-novelty.py    (centroid-distance novelty)
 *   compute-bayesian-surprise.py  (leave-one-out cosine shift)
 *
 * Renders a 4-row Shape E (Action Report) dashboard conforming to
 * the UI System 4-zone anatomy (header, body, intelligence strip,
 * action footer). Each metric row pairs a scalar value with a
 * plain-English interpretation string.
 *
 * Interpretation thresholds tuned for MindrianOS room empirics 2026-04-23 smoke test, not generalized.
 *
 * Usage:
 *   node scripts/diagnostics-command.cjs ROOM_DIR
 *   node scripts/diagnostics-command.cjs --help
 *
 * Exit codes:
 *   0 -- success
 *   1 -- invocation error (missing room dir, bad args)
 *   2 -- prerequisite missing (no whitespace embeddings)
 *
 * License: BSL-1.1
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCRIPTS_DIR = __dirname;

// Symbol vocabulary (12 glyphs only, per ui-system SKILL.md Section 3)
const SYM = {
  FILL: '\u25A0',       // filled square
  DOWN: '\u25BC',       // down triangle
  RIGHT_F: '\u25B6',    // right triangle filled
  RIGHT_E: '\u25B7',    // right triangle empty
  BRANCH: '\u251C\u2500',
  LAST: '\u2514\u2500',
  CHECK: '\u2713',
  DOT: '\u2022',
  WARN: '\u26A0',
  LIGHTNING: '\u26A1',
  EMPTY: '\u2B1C',
  ARROW: '\u2192',
};

// ANSI colors (5-color palette per ui-system)
const C = {
  GREEN: '\x1b[32m',
  CYAN: '\x1b[36m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  GRAY: '\x1b[90m',
  BOLD: '\x1b[1m',
  RESET: '\x1b[0m',
};

// ---------------------------------------------------------------------------
// Helpers (ported from whitespace-command.cjs)
// ---------------------------------------------------------------------------

function fileExists(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function dirExists(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function printError(what, why, fix) {
  console.log(`${C.RED}${SYM.WARN}${C.RESET} ${what}`);
  console.log(`  Why: ${why}`);
  console.log(`  Fix: ${C.CYAN}${fix}${C.RESET}`);
}

function getRoomName(roomDir) {
  const statePath = path.join(roomDir, 'STATE.md');
  if (fileExists(statePath)) {
    const content = fs.readFileSync(statePath, 'utf-8');
    const match = content.match(/venture_name:\s*(.+)/);
    if (match) return match[1].trim();
  }
  return path.basename(roomDir);
}

function runPy(scriptName, roomDir) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  if (!fileExists(scriptPath)) {
    return { ran: false, error: `${scriptName} not found in ${SCRIPTS_DIR}` };
  }
  try {
    execSync(`python3 "${scriptPath}" "${roomDir}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000,
    });
    return { ran: true };
  } catch (err) {
    const stderr = (err.stderr || '').toString().trim();
    return { ran: false, error: stderr || err.message || 'unknown' };
  }
}

// ---------------------------------------------------------------------------
// Interpretation functions (plan-locked thresholds)
// ---------------------------------------------------------------------------

function interpretCD(cdScore) {
  if (cdScore === null || cdScore === undefined) return 'no signal';
  const v = cdScore.toFixed(4);
  if (cdScore > 0.3) return `${v}, room is disrupting prior art`;
  if (cdScore > 0.05) return `${v}, mild disruption signal`;
  if (cdScore > -0.05) return `${v}, mixed / neutral`;
  if (cdScore > -0.3) return `${v}, mild consolidation signal`;
  return `${v}, room is consolidating, not disrupting`;
}

function interpretCoverage(coverage) {
  if (coverage === null || coverage === undefined) return 'no signal';
  const v = coverage.toFixed(3);
  if (coverage > 0.9) return `${v}, problem space largely mapped`;
  if (coverage > 0.6) {
    const uncoveredPct = Math.round((1 - coverage) * 100);
    return `${v}, partial coverage, ${uncoveredPct} pct uncovered`;
  }
  if (coverage > 0.3) return `${v}, under-explored, most of the space unmapped`;
  return `${v}, mostly uncovered, early exploration stage`;
}

function interpretNovelty(noveltyMean) {
  if (noveltyMean === null || noveltyMean === undefined) return 'no signal';
  const v = noveltyMean.toFixed(3);
  if (noveltyMean > 0.3) return `${v} mean, diverse artifacts`;
  if (noveltyMean > 0.15) return `${v} mean, moderate diversity`;
  return `${v} mean, low diversity, artifacts cluster tightly`;
}

function interpretSurprise(surpriseBundle) {
  if (!surpriseBundle || surpriseBundle.n === 0 || surpriseBundle.max === null || surpriseBundle.max === undefined) {
    return 'no signal';
  }
  const v = surpriseBundle.max.toFixed(3);
  if (surpriseBundle.max > 0.5) return `max ${v}, recent additions carry high information gain`;
  if (surpriseBundle.max > 0.2) return `max ${v}, moderate surprise in recent additions`;
  return `max ${v}, recent additions confirm existing patterns`;
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

function runDiagnostics(roomDir) {
  const mindrianDir = path.join(roomDir, '.mindrian');
  const embeddingsPath = path.join(mindrianDir, 'whitespace-embeddings.json');

  // Prerequisite: whitespace embeddings must exist
  if (!fileExists(embeddingsPath)) {
    printError(
      'No whitespace embeddings',
      'Diagnostics requires embedded artifacts at .mindrian/whitespace-embeddings.json',
      '/mos:whitespace map'
    );
    return { success: false };
  }

  // Zone 1 header
  const roomName = getRoomName(roomDir);
  console.log('');
  console.log(`-- ${roomName} -- Diagnostics -- Wave-1 Algorithmic Fingerprint --`);
  console.log('');
  console.log(`${C.GRAY}Running Wave-1 algorithms...${C.RESET}`);

  // Run four Python scripts, collecting per-metric failures
  const failures = {};
  const scripts = [
    { name: 'Disruption (CD)', script: 'compute-disruption-index.py' },
    { name: 'Coverage', script: 'compute-blindspot-mass.py' },
    { name: 'Element Novelty', script: 'compute-element-novelty.py' },
    { name: 'Bayesian Surprise', script: 'compute-bayesian-surprise.py' },
  ];
  for (const spec of scripts) {
    const result = runPy(spec.script, roomDir);
    if (!result.ran) {
      failures[spec.name] = result.error;
    }
  }

  // Read JSON outputs using CORRECT filenames and field paths
  // (ground truth verified 2026-04-23 against scripts/compute-*.py tail)
  const disruption = readJSON(path.join(mindrianDir, 'disruption-index.json'));
  const blindspot  = readJSON(path.join(mindrianDir, 'blindspot-coverage.json'));
  const novelty    = readJSON(path.join(mindrianDir, 'element-novelty.json'));
  const surprise   = readJSON(path.join(mindrianDir, 'surprise-scores.json'));

  const cdScore     = disruption?.metadata?.room_cd ?? null;
  const coverage    = blindspot?.metadata?.room_coverage ?? null;
  const noveltyMean = novelty?.metadata?.mean_novelty ?? null;

  // Bayesian Surprise: no pre-computed summary. Compute max from scores[].
  // NOTE: In scores[] the key is `surprise` (NOT `surprise_score`). Verified
  // 2026-04-23 against scripts/compute-bayesian-surprise.py end-of-main block.
  let surpriseBundle = null;
  if (surprise && Array.isArray(surprise.scores) && surprise.scores.length > 0) {
    const scoreValues = surprise.scores.map(s => s.surprise).filter(v => typeof v === 'number');
    const maxSurprise = scoreValues.length > 0 ? Math.max(...scoreValues) : null;
    const latestSurprise = surprise.latest_filing ? surprise.latest_filing.surprise : null;
    surpriseBundle = { max: maxSurprise, latest: latestSurprise, n: surprise.scores.length };
  }

  // Zone 2: Shape E body
  console.log('');
  console.log(`  ${'Metric'.padEnd(22)}${'Value'.padEnd(14)}Interpretation`);
  console.log(`  ${'-'.repeat(72)}`);

  const rows = [
    { metric: 'Disruption (CD)',     interp: interpretCD(cdScore) },
    { metric: 'Coverage',            interp: interpretCoverage(coverage) },
    { metric: 'Element Novelty',     interp: interpretNovelty(noveltyMean) },
    { metric: 'Bayesian Surprise',   interp: interpretSurprise(surpriseBundle) },
  ];
  for (const r of rows) {
    console.log(`  ${r.metric.padEnd(22)}${r.interp}`);
  }

  // Zone 3: Intelligence Strip (max 3 signals)
  const signals = [];
  if (cdScore !== null && cdScore < -0.3) {
    signals.push(`${SYM.WARN} Strong consolidation signal (CD ${cdScore.toFixed(4)}), room may be over-converging`);
  }
  if (coverage !== null && coverage < 0.4) {
    const uncoveredPct = Math.round((1 - coverage) * 100);
    signals.push(`${SYM.EMPTY} Low coverage (${coverage.toFixed(3)}), ${uncoveredPct} pct of problem space unmapped`);
  }
  if (noveltyMean !== null && noveltyMean < 0.1) {
    signals.push(`${SYM.WARN} Low diversity (mean ${noveltyMean.toFixed(3)}), artifacts cluster tightly`);
  }
  if (surpriseBundle && surpriseBundle.max !== null && surpriseBundle.max > 0.5) {
    signals.push(`${SYM.LIGHTNING} Recent additions carry high surprise (max ${surpriseBundle.max.toFixed(3)})`);
  }

  if (signals.length > 0) {
    console.log('');
    for (const s of signals.slice(0, 3)) {
      console.log(`  ${s}`);
    }
  }

  // Partial results warning
  const hasNullMetric = cdScore === null || coverage === null || noveltyMean === null || surpriseBundle === null;
  const hasFailures = Object.keys(failures).length > 0;
  if (hasFailures || hasNullMetric) {
    console.log('');
    console.log(`${C.YELLOW}Partial results:${C.RESET}`);
    for (const [metric, err] of Object.entries(failures)) {
      console.log(`  ${SYM.WARN} ${metric} failed: ${err}`);
    }
    if (!failures['Disruption (CD)'] && cdScore === null) {
      console.log(`  ${SYM.WARN} Disruption (CD) returned no signal: field missing at data.metadata.room_cd -- check script output shape`);
    }
    if (!failures['Coverage'] && coverage === null) {
      console.log(`  ${SYM.WARN} Coverage returned no signal: field missing at data.metadata.room_coverage -- check script output shape`);
    }
    if (!failures['Element Novelty'] && noveltyMean === null) {
      console.log(`  ${SYM.WARN} Element Novelty returned no signal: field missing at data.metadata.mean_novelty -- check script output shape`);
    }
    if (!failures['Bayesian Surprise'] && surpriseBundle === null) {
      console.log(`  ${SYM.WARN} Bayesian Surprise returned no signal: scores[] empty or missing -- check script output shape`);
    }
  }

  // Zone 4: Action Footer (never omit)
  console.log('');
  console.log(`  ${SYM.ARROW} /mos:whitespace map                Inspect zones behind these scalars`);
  console.log(`  ${SYM.ARROW} /mos:whitespace discover           Run full Discovery Cycle`);
  console.log(`  ${SYM.ARROW} /mos:find-bottlenecks              Drill into reverse salients`);

  return { success: true, cdScore, coverage, noveltyMean, surpriseBundle, failures };
}

// ---------------------------------------------------------------------------
// Help / CLI
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
Usage: node scripts/diagnostics-command.cjs ROOM_DIR

Wave-1 algorithmic fingerprint of a room:
  Disruption Index (Funk and Owen-Smith 2017 CD)
  Coverage (Good-Turing blindspot mass)
  Element Novelty (centroid-distance)
  Bayesian Surprise (leave-one-out cosine shift)

Exit codes:
  0  success
  1  invocation error
  2  prerequisite missing (.mindrian/whitespace-embeddings.json)

Example:
  node scripts/diagnostics-command.cjs ~/MindrianRooms/mindrianOS/
`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const roomDir = path.resolve(args[0]);
  if (!dirExists(roomDir)) {
    printError(
      'Room directory not found',
      `${roomDir} does not exist`,
      '/mos:new-project'
    );
    process.exit(1);
  }

  const result = runDiagnostics(roomDir);
  process.exit(result.success ? 0 : 2);
}

if (require.main === module) main();

module.exports = { runDiagnostics, interpretCD, interpretCoverage, interpretNovelty, interpretSurprise };
