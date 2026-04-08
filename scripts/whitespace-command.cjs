#!/usr/bin/env node
/**
 * whitespace-command.cjs -- CLI Dispatcher for /mos:whitespace
 * =============================================================
 * Routes subcommands to existing pipeline scripts and formats
 * output per the UI Ruling System body shapes.
 *
 * Usage:
 *   node scripts/whitespace-command.cjs ROOM_DIR SUBCOMMAND [ARGS...]
 *   node scripts/whitespace-command.cjs --help
 *
 * Subcommands:
 *   map                  Whitespace zone density map (Mondrian Board)
 *   analyze ZONE_ID      Deep-dive classification + hypothesis (Action Report)
 *   hypothesis ZONE_ID   Lazy on-demand hypothesis for a zone (Action Report)
 *   tree                 TopicForest coverage indicators (Semantic Tree)
 *   score                Per-artifact novelty scores ranked (Action Report)
 *   external             Cross-domain literature whitespace (Action Report)
 *   discover             Full Discovery Cycle: HSI + RS + Analogy (Action Report)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCRIPTS_DIR = __dirname;
const MAX_WIDTH = 80;
const TRUNCATE_LEN = 76;

// Symbol vocabulary (12 glyphs only)
const SYM = {
  FILL: '\u25A0',       // filled square - progress fill
  DOWN: '\u25BC',       // down triangle - expanded
  RIGHT_F: '\u25B6',    // right triangle filled - collapsed+content / primary action
  RIGHT_E: '\u25B7',    // right triangle empty - collapsed+empty / alternative action
  BRANCH: '\u251C\u2500',  // |-
  LAST: '\u2514\u2500',    // \-
  CHECK: '\u2713',      // checkmark - complete
  DOT: '\u2022',        // bullet - draft/partial
  WARN: '\u26A0',       // warning
  LIGHTNING: '\u26A1',  // convergence
  EMPTY: '\u2B1C',      // gap
  ARROW: '\u2192',      // inline suggestion
};

// ANSI colors
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
// Helpers
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

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len - 3) + '...' : str;
}

function padRight(str, len) {
  return (str || '').padEnd(len);
}

function runScript(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: opts.timeout || 120000,
      ...opts,
    });
  } catch (err) {
    const stderr = (err.stderr || '').trim();
    const msg = stderr || err.message || 'Unknown error';
    return { error: true, message: msg };
  }
}

function printError(what, why, fix) {
  console.log(`${C.RED}${SYM.WARN}${C.RESET} ${what}`);
  console.log(`  Why: ${why}`);
  console.log(`  Fix: ${C.CYAN}${fix}${C.RESET}`);
}

function getRoomName(roomDir) {
  // Try STATE.md frontmatter
  const statePath = path.join(roomDir, 'STATE.md');
  if (fileExists(statePath)) {
    const content = fs.readFileSync(statePath, 'utf-8');
    const match = content.match(/venture_name:\s*(.+)/);
    if (match) return match[1].trim();
  }
  return path.basename(roomDir);
}

// ---------------------------------------------------------------------------
// Subcommand: map
// ---------------------------------------------------------------------------

function cmdMap(roomDir) {
  const mindrianDir = path.join(roomDir, '.mindrian');
  const embeddingsPath = path.join(mindrianDir, 'whitespace-embeddings.json');
  const resultsPath = path.join(mindrianDir, 'whitespace-results.json');

  // Ensure embeddings exist
  if (!fileExists(embeddingsPath)) {
    const embedScript = path.join(SCRIPTS_DIR, 'compute-whitespace-embeddings.py');
    if (!fileExists(embedScript)) {
      printError('Embedding script not found',
        'compute-whitespace-embeddings.py missing from scripts/',
        '/mos:setup');
      return;
    }
    console.log(`${C.GRAY}Computing whitespace embeddings...${C.RESET}`);
    const result = runScript(`python3 "${embedScript}" "${roomDir}"`);
    if (result && result.error) {
      printError('Embedding computation failed', result.message, '/mos:whitespace map');
      return;
    }
  }

  // Run whitespace gaps computation
  const gapsScript = path.join(SCRIPTS_DIR, 'compute-whitespace-gaps.py');
  if (!fileExists(gapsScript)) {
    printError('Gaps script not found',
      'compute-whitespace-gaps.py missing from scripts/',
      '/mos:setup');
    return;
  }

  console.log(`${C.GRAY}Computing whitespace gaps...${C.RESET}`);
  const result = runScript(`python3 "${gapsScript}" "${roomDir}"`);
  if (result && result.error) {
    printError('Whitespace computation failed', result.message, '/mos:whitespace map');
    return;
  }

  // Read results
  const data = readJSON(resultsPath);
  if (!data) {
    printError('No whitespace results', 'whitespace-results.json not found or invalid', '/mos:whitespace map');
    return;
  }

  const gaps = (data.gaps || []).sort((a, b) => (a.density_score || 0) - (b.density_score || 0));
  const validated = gaps.filter(g => g.validated).length;
  const sparsest = gaps[0];

  // Output: Mondrian Board
  const zoneColW = 24;
  const densityColW = 10;
  const typeColW = 15;

  console.log('');
  console.log(`  ${padRight('Zone', zoneColW)}${padRight('Density', densityColW)}${padRight('Type', typeColW)}Nearest Frameworks`);

  for (const gap of gaps) {
    const zoneId = padRight(gap.zone_id || gap.gap_id || '?', zoneColW);
    const density = padRight((gap.density_score || 0).toFixed(2), densityColW);
    const ptype = padRight(gap.problem_type || 'Un-Defined', typeColW);
    const frameworks = (gap.nearest_frameworks || gap.nearest_brain_frameworks || [])
      .slice(0, 2).join(', ');
    console.log(`  ${zoneId}${density}${ptype}${truncate(frameworks, 30)}`);
  }

  console.log('');
  console.log(`  Zones: ${gaps.length} total  |  ${validated} validated  |  Sparsest: ${sparsest ? (sparsest.zone_id || sparsest.gap_id) : 'none'} (density ${sparsest ? (sparsest.density_score || 0).toFixed(2) : 'n/a'})`);
}

// ---------------------------------------------------------------------------
// Subcommand: analyze
// ---------------------------------------------------------------------------

function cmdAnalyze(roomDir, zoneId) {
  if (!zoneId) {
    printError('Zone ID required', 'analyze needs a zone ID argument', '/mos:whitespace map (to see available zones)');
    return;
  }

  const resultsPath = path.join(roomDir, '.mindrian', 'whitespace-results.json');
  const interpPath = path.join(roomDir, '.mindrian', 'interpretation-results.json');

  // Read whitespace results
  const data = readJSON(resultsPath);
  if (!data) {
    printError('No whitespace data', 'Run the whitespace pipeline first', '/mos:whitespace map');
    return;
  }

  // Find zone
  const gaps = data.gaps || [];
  const zone = gaps.find(g => (g.zone_id || g.gap_id) === zoneId);
  if (!zone) {
    const available = gaps.map(g => g.zone_id || g.gap_id).join(', ');
    printError(`Zone not found: ${zoneId}`,
      `Available zones: ${truncate(available, 60)}`,
      '/mos:whitespace map');
    return;
  }

  // Run interpretation if not already done
  if (!fileExists(interpPath)) {
    const interpScript = path.join(SCRIPTS_DIR, 'interpret-whitespace.cjs');
    if (fileExists(interpScript)) {
      console.log(`${C.GRAY}Running interpretation...${C.RESET}`);
      runScript(`node "${interpScript}" "${roomDir}"`);
    }
  }

  // Read interpretation results for enriched zone data
  const interpData = readJSON(interpPath);
  let enrichedZone = zone;
  if (interpData && interpData.gaps) {
    const found = interpData.gaps.find(g => (g.zone_id || g.gap_id) === zoneId);
    if (found) enrichedZone = found;
  }

  // Output: Action Report
  console.log('');
  console.log(`  Zone: ${zoneId}`);
  console.log(`  Density: ${(enrichedZone.density_score || 0).toFixed(2)}`);
  console.log(`  Problem Type: ${enrichedZone.problem_type || 'Un-Defined'}`);
  console.log(`  Validated: ${enrichedZone.validated ? 'Yes' : 'No'}${enrichedZone.validation ? ` (${(enrichedZone.validation.gates_passed || []).length}/${(enrichedZone.validation.gates_passed || []).length + (enrichedZone.validation.gates_failed || []).length} gates)` : ''}`);
  console.log('');

  // Framework chain
  const chain = enrichedZone.framework_chain || [];
  if (chain.length > 0) {
    console.log('  Framework Chain:');
    chain.forEach((fw, i) => {
      const prefix = i < chain.length - 1 ? SYM.BRANCH : SYM.LAST;
      console.log(`  ${prefix} ${fw}`);
    });
    console.log('');
  }

  // Nearest artifacts
  const artifacts = enrichedZone.nearest_room_artifacts || [];
  if (artifacts.length > 0) {
    console.log('  Nearest Artifacts:');
    artifacts.forEach((a, i) => {
      const prefix = i < artifacts.length - 1 ? SYM.BRANCH : SYM.LAST;
      const name = typeof a === 'string' ? a : (a.title || a.artifact_id || a.id || '?');
      const section = typeof a === 'object' ? (a.section || '') : '';
      console.log(`  ${prefix} ${name}${section ? ` (${section}/)` : ''}`);
    });
    console.log('');
  }

  // Hypothesis
  const hypothesis = enrichedZone.hypothesis || enrichedZone.hypothesis_text || null;
  console.log('  Hypothesis:');
  if (hypothesis) {
    console.log(`  ${hypothesis}`);
  } else {
    console.log(`  Not yet generated -- run ${C.CYAN}/mos:whitespace hypothesis ${zoneId}${C.RESET}`);
  }
}

// ---------------------------------------------------------------------------
// Subcommand: hypothesis
// ---------------------------------------------------------------------------

function cmdHypothesis(roomDir, zoneId) {
  if (!zoneId) {
    printError('Zone ID required', 'hypothesis needs a zone ID argument', '/mos:whitespace map (to see available zones)');
    return;
  }

  const interpPath = path.join(roomDir, '.mindrian', 'interpretation-results.json');
  const resultsPath = path.join(roomDir, '.mindrian', 'whitespace-results.json');

  // Try interpretation results first (lazy -- don't re-run if hypothesis exists)
  let interpData = readJSON(interpPath);
  let zone = null;

  if (interpData && interpData.gaps) {
    zone = interpData.gaps.find(g => (g.zone_id || g.gap_id) === zoneId);
  }

  // If no interpretation data, run interpret-whitespace.cjs
  if (!zone || !(zone.hypothesis || zone.hypothesis_text || zone.hypothesis_prompt)) {
    const interpScript = path.join(SCRIPTS_DIR, 'interpret-whitespace.cjs');
    if (fileExists(interpScript)) {
      console.log(`${C.GRAY}Running interpretation for hypothesis generation...${C.RESET}`);
      runScript(`node "${interpScript}" "${roomDir}" --hypothesize`);
      interpData = readJSON(interpPath);
      if (interpData && interpData.gaps) {
        zone = interpData.gaps.find(g => (g.zone_id || g.gap_id) === zoneId);
      }
    }
  }

  // Fallback to whitespace-results.json
  if (!zone) {
    const data = readJSON(resultsPath);
    if (data && data.gaps) {
      zone = data.gaps.find(g => (g.zone_id || g.gap_id) === zoneId);
    }
  }

  if (!zone) {
    printError(`Zone not found: ${zoneId}`,
      'No zone with that ID in whitespace or interpretation results',
      '/mos:whitespace map');
    return;
  }

  // Output
  const chain = (zone.framework_chain || []).join(` ${SYM.ARROW} `);

  console.log('');
  console.log(`  Zone: ${zoneId}  |  Type: ${zone.problem_type || 'Un-Defined'}  |  Chain: ${chain || 'none'}`);
  console.log('');

  const hypothesis = zone.hypothesis || zone.hypothesis_text || null;
  const prompt = zone.hypothesis_prompt || null;

  if (hypothesis) {
    console.log('  Hypothesis:');
    console.log(`  ${hypothesis}`);
  } else if (prompt) {
    console.log('  Hypothesis prompt generated. Larry will use this to generate the hypothesis at runtime.');
    console.log(`  ${C.GRAY}Prompt preview: ${truncate(prompt, TRUNCATE_LEN)}${C.RESET}`);
  } else {
    console.log(`  No hypothesis available. The interpretation pipeline could not generate one.`);
    console.log(`  ${C.GRAY}Try: /mos:whitespace analyze ${zoneId}${C.RESET}`);
  }
}

// ---------------------------------------------------------------------------
// Subcommand: tree
// ---------------------------------------------------------------------------

function cmdTree(roomDir) {
  const mindrianDir = path.join(roomDir, '.mindrian');
  const forestPath = path.join(mindrianDir, 'topic-forest.json');
  const labeledPath = path.join(mindrianDir, 'topic-forest-labeled.json');

  // Ensure topic forest exists
  if (!fileExists(forestPath)) {
    const forestScript = path.join(SCRIPTS_DIR, 'compute_topic_forest.py');
    if (!fileExists(forestScript)) {
      printError('TopicForest script not found',
        'compute_topic_forest.py missing from scripts/',
        '/mos:setup');
      return;
    }
    console.log(`${C.GRAY}Computing topic forest...${C.RESET}`);
    const result = runScript(`python3 "${forestScript}" "${roomDir}"`);
    if (result && result.error) {
      printError('TopicForest computation failed', result.message, '/mos:whitespace tree');
      return;
    }
  }

  // Run labeling
  const labelScript = path.join(SCRIPTS_DIR, 'label-topic-forest.cjs');
  if (!fileExists(labelScript)) {
    printError('Label script not found',
      'label-topic-forest.cjs missing from scripts/',
      '/mos:setup');
    return;
  }

  console.log(`${C.GRAY}Labeling topic forest...${C.RESET}`);
  runScript(`node "${labelScript}" "${roomDir}"`);

  // Read labeled results
  const data = readJSON(labeledPath);
  if (!data) {
    printError('No labeled forest data', 'topic-forest-labeled.json not found', '/mos:whitespace tree');
    return;
  }

  const topics = data.topics || data.branches || data.tree || [];
  let coveredCount = 0;
  let sparseCount = 0;
  let whitespaceCount = 0;

  console.log('');

  // Render tree
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const label = topic.label || topic.name || `Topic ${i + 1}`;
    const artCount = topic.artifact_count || topic.artifacts || 0;
    const children = topic.children || topic.subtopics || [];

    let coverageGlyph;
    let coverageLabel;
    if (artCount >= 2) {
      coverageGlyph = `${C.GREEN}${SYM.CHECK}${C.RESET}`;
      coverageLabel = 'covered';
      coveredCount++;
    } else if (artCount === 1) {
      coverageGlyph = SYM.DOT;
      coverageLabel = 'sparse';
      sparseCount++;
    } else {
      coverageGlyph = SYM.EMPTY;
      coverageLabel = 'whitespace';
      whitespaceCount++;
    }

    // Parent node
    if (children.length > 0 || artCount > 0) {
      console.log(`  ${SYM.DOWN} ${padRight(label, 42)} ${coverageGlyph} ${coverageLabel}`);
    } else {
      console.log(`  ${SYM.RIGHT_E} ${padRight(label, 42)} ${coverageGlyph} ${coverageLabel}`);
    }

    // Children
    for (let j = 0; j < children.length; j++) {
      const child = children[j];
      const childLabel = child.label || child.name || `Subtopic ${j + 1}`;
      const childArts = child.artifact_count || child.artifacts || 0;
      const isLast = j === children.length - 1;
      const prefix = isLast ? SYM.LAST : SYM.BRANCH;

      let childGlyph;
      let childCoverage;
      if (childArts >= 2) {
        childGlyph = `${SYM.RIGHT_F}`;
        childCoverage = `${C.GREEN}${SYM.CHECK}${C.RESET} ${childArts} artifacts`;
        coveredCount++;
      } else if (childArts === 1) {
        childGlyph = `${SYM.RIGHT_F}`;
        childCoverage = `${SYM.DOT} 1 artifact`;
        sparseCount++;
      } else {
        childGlyph = `${SYM.RIGHT_E}`;
        childCoverage = `${SYM.EMPTY} whitespace`;
        whitespaceCount++;
      }

      console.log(`  ${prefix} ${childGlyph} ${padRight(childLabel, 37)} ${childCoverage}`);
    }
  }

  console.log('');
  console.log(`  Topics: ${topics.length} branches  |  ${SYM.CHECK} ${coveredCount} covered  |  ${SYM.DOT} ${sparseCount} sparse  |  ${SYM.EMPTY} ${whitespaceCount} whitespace`);
}

// ---------------------------------------------------------------------------
// Subcommand: score
// ---------------------------------------------------------------------------

function cmdScore(roomDir) {
  const resultsPath = path.join(roomDir, '.mindrian', 'whitespace-results.json');
  const data = readJSON(resultsPath);

  if (!data) {
    printError('No whitespace data', 'whitespace-results.json not found', '/mos:whitespace map');
    return;
  }

  const scores = (data.novelty_scores || data.artifact_novelty_scores || [])
    .sort((a, b) => (b.novelty_score || b.score || 0) - (a.novelty_score || a.score || 0));

  if (scores.length === 0) {
    printError('No novelty scores', 'Whitespace pipeline did not produce artifact scores', '/mos:whitespace map');
    return;
  }

  const artColW = 32;
  const secColW = 22;
  const novColW = 10;

  console.log('');
  console.log(`  ${padRight('Artifact', artColW)}${padRight('Section', secColW)}${padRight('Novelty', novColW)}Nearest Concept`);

  let novel = 0, moderate = 0, covered = 0;

  for (const item of scores) {
    const name = truncate(item.artifact || item.name || item.id || '?', artColW - 2);
    const section = truncate(item.section || '', secColW - 2);
    const score = (item.novelty_score || item.score || 0);
    const concept = truncate(item.nearest_concept || item.nearest_brain || '', 24);

    if (score >= 0.8) novel++;
    else if (score >= 0.4) moderate++;
    else covered++;

    console.log(`  ${padRight(name, artColW)}${padRight(section, secColW)}${padRight(score.toFixed(2), novColW)}${concept}`);
  }

  console.log('');
  console.log(`  Artifacts: ${scores.length}  |  Novel (>0.8): ${novel}  |  Moderate: ${moderate}  |  Covered (<0.4): ${covered}`);
}

// ---------------------------------------------------------------------------
// Subcommand: external
// ---------------------------------------------------------------------------

function cmdExternal(roomDir) {
  const scholarScript = path.join(SCRIPTS_DIR, 'query-semantic-scholar.cjs');
  const externalScript = path.join(SCRIPTS_DIR, 'compute-external-whitespace.py');

  // Check if Plan 02 scripts exist
  if (!fileExists(scholarScript) || !fileExists(externalScript)) {
    printError('External corpus not configured',
      'Phase 66 Plan 02 scripts not installed yet',
      '/mos:whitespace external (available after Plan 02 deployment)');
    return;
  }

  // Run Semantic Scholar query
  console.log(`${C.GRAY}Querying Semantic Scholar...${C.RESET}`);
  let result = runScript(`node "${scholarScript}" "${roomDir}"`);
  if (result && result.error) {
    printError('Semantic Scholar query failed', result.message, '/mos:whitespace external');
    return;
  }

  // Run external whitespace computation
  console.log(`${C.GRAY}Computing external whitespace...${C.RESET}`);
  result = runScript(`python3 "${externalScript}" "${roomDir}"`);
  if (result && result.error) {
    printError('External whitespace computation failed', result.message, '/mos:whitespace external');
    return;
  }

  // Read results
  const externalPath = path.join(roomDir, '.mindrian', 'external-whitespace-results.json');
  const data = readJSON(externalPath);

  if (!data) {
    printError('No external results', 'external-whitespace-results.json not found', '/mos:whitespace external');
    return;
  }

  const zones = data.zones || [];
  const papers = data.papers || [];

  console.log('');
  console.log(`  Action: External whitespace scan`);
  console.log(`  Source: Semantic Scholar API`);
  console.log('');
  console.log(`  Cross-Domain Zones Found: ${zones.length}`);

  zones.slice(0, 5).forEach((z, i) => {
    const prefix = i < Math.min(zones.length, 5) - 1 ? SYM.BRANCH : SYM.LAST;
    const desc = truncate(z.description || z.hypothesis || '', 50);
    const paper = truncate(z.source_paper || '', 20);
    console.log(`  ${prefix} ${z.zone_id || '?'}: ${desc}${paper ? ` (from: ${paper})` : ''}`);
  });

  if (papers.length > 0) {
    console.log('');
    console.log(`  Papers Analyzed: ${papers.length}`);
    console.log('  Top Matches:');
    papers.slice(0, 3).forEach((p, i) => {
      const prefix = i < Math.min(papers.length, 3) - 1 ? SYM.BRANCH : SYM.LAST;
      const title = truncate(p.title || '', 45);
      const year = p.year || '?';
      const rel = (p.relevance || 0).toFixed(2);
      console.log(`  ${prefix} ${title} (${year}) -- relevance: ${rel}`);
    });
  }
}

// ---------------------------------------------------------------------------
// Subcommand: discover
// ---------------------------------------------------------------------------

function cmdDiscover(roomDir) {
  const cycleScript = path.join(SCRIPTS_DIR, 'discovery-cycle.cjs');

  if (!fileExists(cycleScript)) {
    printError('Discovery Cycle script not found',
      'discovery-cycle.cjs missing from scripts/',
      '/mos:setup');
    return;
  }

  console.log(`${C.GRAY}Running Discovery Cycle (HSI + RS + Analogy)...${C.RESET}`);
  const result = runScript(`node "${cycleScript}" "${roomDir}" --steps all`, { timeout: 300000 });
  if (result && result.error) {
    printError('Discovery Cycle failed', result.message, '/mos:whitespace discover');
    return;
  }

  // Read aggregated results
  const resultsPath = path.join(roomDir, '.mindrian', 'discovery-cycle-results.json');
  const data = readJSON(resultsPath);

  if (!data) {
    printError('No discovery results', 'discovery-cycle-results.json not found', '/mos:whitespace discover');
    return;
  }

  const meta = data.metadata || {};
  const hsiZones = data.hsi_whitespace ? (data.hsi_whitespace.zones || []).length : 0;
  const rsZones = data.rs_whitespace ? (data.rs_whitespace.zones || []).length : 0;
  const analogyZones = data.analogy_whitespace ? (data.analogy_whitespace.zones || []).length : 0;
  const allZones = data.all_zones || [];
  const validated = allZones.filter(z => z.validated).length;

  console.log('');
  console.log('  Action: Discovery Cycle');
  console.log('  Steps: HSI -> RS -> Analogy');
  console.log('');
  console.log('  Results:');
  console.log(`  ${SYM.BRANCH} HSI Whitespace:     ${hsiZones} zones (between connected artifacts)`);
  console.log(`  ${SYM.BRANCH} RS Whitespace:      ${rsZones} zones (downstream of bottlenecks)`);
  console.log(`  ${SYM.LAST} Analogy Whitespace: ${analogyZones} zones (unmapped transfer zones)`);
  console.log('');
  console.log(`  Total Zones: ${allZones.length}`);
  console.log(`  Validated: ${validated} / ${allZones.length}`);
  console.log('');

  // Top discoveries
  const top = allZones.slice(0, 3);
  if (top.length > 0) {
    console.log('  Top Discoveries:');
    top.forEach((z, i) => {
      const prefix = i < top.length - 1 ? SYM.BRANCH : SYM.LAST;
      const id = z.zone_id || z.gap_id || '?';
      const signal = z.gap_signal || 'unknown';
      const hyp = truncate(z.hypothesis || z.hypothesis_text || 'No hypothesis', TRUNCATE_LEN - 30);
      console.log(`  ${prefix} ${id} [${signal}] -- ${hyp}`);
    });
  }
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
Usage: node scripts/whitespace-command.cjs <room-dir> <subcommand> [args...]

Whitespace detection -- find what's MISSING in your understanding.

Subcommands:
  map                   Density map of whitespace zones (sparsest first)
  analyze ZONE_ID       Deep-dive: classification + framework chain + hypothesis
  hypothesis ZONE_ID    Show or generate hypothesis for a zone
  tree                  TopicForest with coverage indicators per branch
  score                 Per-artifact novelty scores (highest first)
  external              Cross-domain literature scan via Semantic Scholar
  discover              Full Discovery Cycle: HSI + RS + Analogy whitespace

Examples:
  node scripts/whitespace-command.cjs ./room map
  node scripts/whitespace-command.cjs ./room analyze ws-gap-001
  node scripts/whitespace-command.cjs ./room tree
  node scripts/whitespace-command.cjs ./room discover
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);

  // Help
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printHelp();
    process.exit(0);
  }

  // Parse: room_dir subcommand [args...]
  const roomDir = args[0];
  const subcommand = (args[1] || '').toLowerCase();
  const subArgs = args.slice(2);

  // Validate room
  if (roomDir === '--help' || roomDir === '-h') {
    printHelp();
    process.exit(0);
  }

  const resolvedRoom = path.resolve(roomDir);
  if (!dirExists(resolvedRoom)) {
    printError('Room directory not found',
      `${resolvedRoom} does not exist`,
      '/mos:new-project');
    process.exit(1);
  }

  // Check .mindrian/ for subcommands that need it (all except map, which creates it)
  const mindrianDir = path.join(resolvedRoom, '.mindrian');
  if (subcommand !== 'map' && subcommand !== '' && !dirExists(mindrianDir)) {
    printError('No whitespace data found',
      'Whitespace pipeline has not been run on this room yet',
      '/mos:whitespace map');
    process.exit(1);
  }

  // Dispatch
  switch (subcommand) {
    case 'map':
      cmdMap(resolvedRoom);
      break;
    case 'analyze':
      cmdAnalyze(resolvedRoom, subArgs[0]);
      break;
    case 'hypothesis':
      cmdHypothesis(resolvedRoom, subArgs[0]);
      break;
    case 'tree':
      cmdTree(resolvedRoom);
      break;
    case 'score':
      cmdScore(resolvedRoom);
      break;
    case 'external':
      cmdExternal(resolvedRoom);
      break;
    case 'discover':
      cmdDiscover(resolvedRoom);
      break;
    default:
      printHelp();
      break;
  }
}

main();
