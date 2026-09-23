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
const { ensureBrainBaseline } = require('./ensure-brain-baseline.cjs');
// Phase 355-16 (HIPS-04, HIPS-05, D-08, D-29, D-30): the stamp and the
// disclosure line, wired at the OUTPUT layer only -- the Python compute
// (compute-whitespace-gaps.py) and every density/novelty math line in this
// file stay byte-unchanged. See whitespaceEndpoints/renderScanLines/
// renderAnalyzeLines/renderNoveltyLines below.
const verificationStamp = require('../lib/core/verification-stamp.cjs');
const verificationStampFormat = require('../lib/core/verification-stamp-format.cjs');
const directionConvention = require('../lib/core/direction-convention.cjs');
const floorDisclosure = require('../lib/core/floor-disclosure.cjs');

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

// ---------------------------------------------------------------------------
// Verification seams (Phase 355-16, HIPS-04, HIPS-05).
// ---------------------------------------------------------------------------

/*
 * _readArtifactRaw(roomDir, artifactPath) -- best-effort local read of an
 * artifact referenced by a novelty row. artifactPath may or may not carry
 * the section directory or the .md extension; tried in order, never throws.
 */
function _readArtifactRaw(roomDir, sectionRel, artifactRel) {
  if (!roomDir || !artifactRel) return '';
  const base = String(artifactRel).replace(/\.md$/, '');
  const candidates = [
    sectionRel ? path.join(roomDir, sectionRel, base + '.md') : null,
    path.join(roomDir, base + '.md'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return fs.readFileSync(candidate, 'utf-8');
    } catch (_e) {
      // try next candidate
    }
  }
  return '';
}

/*
 * whitespaceEndpoints(finding, kind, ctx) -> { fromHandle, toHandle, fromVia,
 * toVia }, the shape lib/core/verification-stamp.cjs's stampFindings expects
 * per finding (D-48, D-49):
 *   kind 'zone'    -- finding.nearest_frameworks[0] and [1], each admitted
 *                      only if it is an exact data/framework-names.json entry
 *                      (never fuzzy, never Theo-resolved).
 *   kind 'novelty' -- the artifact's own carried name (extractCarried against
 *                      finding.artifact_text / finding.artifact_title,
 *                      resolved through resolveEndpoint -- framework, then
 *                      methodology, then title) and finding.nearest_concept.
 * A raw name absent from the local snapshot resolves to null, same as a
 * missing name: stampFindings then stamps that finding unverified/not_called
 * /handle_unresolved, never guessing and never calling Theo for it.
 */
function whitespaceEndpoints(finding, kind, ctx) {
  const f = finding || {};
  const names = (ctx && ctx.names) || verificationStamp.loadFrameworkNames();

  if (kind === 'zone') {
    const list = Array.isArray(f.nearest_frameworks) ? f.nearest_frameworks : [];
    const fromRaw = list[0] || null;
    const toRaw = list[1] || null;
    const fromHandle = fromRaw && names.has(fromRaw) ? fromRaw : null;
    const toHandle = toRaw && names.has(toRaw) ? toRaw : null;
    return {
      fromHandle: fromHandle,
      toHandle: toHandle,
      fromVia: fromHandle ? 'nearest_frameworks[0]' : null,
      toVia: toHandle ? 'nearest_frameworks[1]' : null,
    };
  }

  if (kind === 'novelty') {
    const carried = verificationStamp.extractCarried(f.artifact_text, f.artifact_title);
    const resolvedFrom = verificationStamp.resolveEndpoint(carried, ctx);
    const toRaw = f.nearest_concept || null;
    const toHandle = toRaw && names.has(toRaw) ? toRaw : null;
    return {
      fromHandle: resolvedFrom.name,
      toHandle: toHandle,
      fromVia: resolvedFrom.via,
      toVia: toHandle ? 'nearest_concept' : null,
    };
  }

  throw new Error('whitespaceEndpoints: unknown kind "' + kind + '"');
}

/*
 * renderScanLines(gaps, stamps) -- the `map` subcommand's Zone 2 body, as a
 * pure line array. `gaps` must already be sorted ascending by density_score
 * (sparsest first, the existing sort order) so the row index doubles as the
 * D-29 sparsity rank (1 = sparsest); `stamps` is aligned 1:1 with `gaps`.
 * No density decimal anywhere (D-29); one formatStampLines('cli') block per
 * zone, disclosureLine('whitespace') last (D-27, D-30).
 */
function renderScanLines(gaps, stamps) {
  const lines = [];
  const zoneColW = 24;
  const rankColW = 8;
  const typeColW = 15;

  lines.push('');
  lines.push('  ' + padRight('Zone', zoneColW) + padRight('Rank', rankColW) + padRight('Type', typeColW) + 'Nearest Frameworks');

  gaps.forEach((gap, i) => {
    const zoneId = padRight(gap.zone_id || gap.gap_id || '?', zoneColW);
    const rank = padRight(String(i + 1), rankColW);
    const ptype = padRight(gap.problem_type || 'Un-Defined', typeColW);
    const frameworks = (gap.nearest_frameworks || gap.nearest_brain_frameworks || []).slice(0, 2).join(', ');
    lines.push('  ' + zoneId + rank + ptype + truncate(frameworks, 30));
  });

  const validated = gaps.filter((g) => g.validated).length;
  const sparsest = gaps[0];
  lines.push('');
  lines.push('  Zones: ' + gaps.length + ' total  |  ' + validated + ' validated  |  Sparsest: '
    + (sparsest ? (sparsest.zone_id || sparsest.gap_id) : 'none') + ' (rank 1 of ' + gaps.length + ')');

  lines.push('');
  gaps.forEach((_gap, i) => {
    lines.push.apply(lines, verificationStampFormat.formatStampLines(stamps[i], 'cli'));
  });
  lines.push(floorDisclosure.disclosureLine('whitespace'));

  // D-30 backstop: the whole captured render, not only the stamp block, is
  // swept for a bare decimal/percent token before it ever reaches stdout.
  return verificationStampFormat.assertNoScalar(lines).lines;
}

/*
 * renderAnalyzeLines(zone, stamp, rank, total) -- the `analyze` subcommand's
 * Zone 2 body. The Density line becomes 'Rank: sparsity rank n of N' (D-29).
 */
function renderAnalyzeLines(zone, stamp, rank, total) {
  const lines = [];
  lines.push('');
  lines.push('  Zone: ' + (zone.zone_id || zone.gap_id || '?'));
  lines.push('  Rank: sparsity rank ' + rank + ' of ' + total);
  lines.push('  Problem Type: ' + (zone.problem_type || 'Un-Defined'));
  const gatesPassed = zone.validation ? (zone.validation.gates_passed || []).length : 0;
  const gatesTotal = zone.validation
    ? gatesPassed + (zone.validation.gates_failed || []).length
    : 0;
  lines.push('  Validated: ' + (zone.validated ? 'Yes' : 'No') + (zone.validation ? ' (' + gatesPassed + '/' + gatesTotal + ' gates)' : ''));
  lines.push('');

  const chain = zone.framework_chain || [];
  if (chain.length > 0) {
    lines.push('  Framework Chain:');
    chain.forEach((fw, i) => {
      const prefix = i < chain.length - 1 ? SYM.BRANCH : SYM.LAST;
      lines.push('  ' + prefix + ' ' + fw);
    });
    lines.push('');
  }

  const artifacts = zone.nearest_room_artifacts || [];
  if (artifacts.length > 0) {
    lines.push('  Nearest Artifacts:');
    artifacts.forEach((a, i) => {
      const prefix = i < artifacts.length - 1 ? SYM.BRANCH : SYM.LAST;
      const name = typeof a === 'string' ? a : (a.title || a.artifact_id || a.id || '?');
      const section = typeof a === 'object' ? (a.section || '') : '';
      lines.push('  ' + prefix + ' ' + name + (section ? ' (' + section + '/)' : ''));
    });
    lines.push('');
  }

  const hypothesis = zone.hypothesis || zone.hypothesis_text || null;
  lines.push('  Hypothesis:');
  if (hypothesis) {
    lines.push('  ' + hypothesis);
  } else {
    lines.push('  Not yet generated -- run /mos:whitespace hypothesis ' + (zone.zone_id || zone.gap_id || ''));
  }
  lines.push('');

  lines.push.apply(lines, verificationStampFormat.formatStampLines(stamp, 'cli'));
  lines.push(floorDisclosure.disclosureLine('whitespace'));

  // D-30 backstop: see renderScanLines.
  return verificationStampFormat.assertNoScalar(lines).lines;
}

/*
 * renderNoveltyLines(scores, stamps) -- the `score` subcommand's Zone 2 body.
 * Novelty scores render as the band word (novel/moderate/covered) from the
 * existing (ledgered) 0.8/0.4 comparison, never the raw decimal (D-29); the
 * comparison itself is unchanged.
 */
function renderNoveltyLines(scores, stamps) {
  const lines = [];
  const artColW = 32;
  const secColW = 22;
  const bandColW = 10;

  lines.push('');
  lines.push('  ' + padRight('Artifact', artColW) + padRight('Section', secColW) + padRight('Novelty', bandColW) + 'Nearest Concept');

  let novel = 0;
  let moderate = 0;
  let covered = 0;

  scores.forEach((item) => {
    const name = truncate(item.artifact || item.name || item.id || '?', artColW - 2);
    const section = truncate(item.section || '', secColW - 2);
    const score = item.novelty_score || item.score || 0;
    const concept = truncate(item.nearest_concept || item.nearest_brain || '', 24);

    let band;
    if (score >= 0.8) { band = 'novel'; novel++; } else if (score >= 0.4) { band = 'moderate'; moderate++; } else { band = 'covered'; covered++; }

    lines.push('  ' + padRight(name, artColW) + padRight(section, secColW) + padRight(band, bandColW) + concept);
  });

  lines.push('');
  lines.push('  Artifacts: ' + scores.length + '  |  Novel: ' + novel + '  |  Moderate: ' + moderate + '  |  Covered: ' + covered);

  lines.push('');
  scores.forEach((_item, i) => {
    lines.push.apply(lines, verificationStampFormat.formatStampLines(stamps[i], 'cli'));
  });
  lines.push(floorDisclosure.disclosureLine('whitespace'));

  // D-30 backstop: see renderScanLines.
  return verificationStampFormat.assertNoScalar(lines).lines;
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

async function cmdMap(roomDir) {
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

  // Ensure Brain baseline exists (enables EMBED-02/EMBED-04 gap-against-Brain detection)
  // Auto-fire per Phase 88.6-01. Graceful degradation: offline -> continue with
  // unexplained 0 scores rather than crash, but user sees explicit reason.
  const baselineResult = ensureBrainBaseline(roomDir, { verbose: false });
  if (!baselineResult.ensured) {
    console.log(`${C.YELLOW}Note: Brain baseline unavailable -- gap detection will run without Brain consensus.${C.RESET}`);
    console.log(`${C.YELLOW}Novelty scoring and gap-against-Brain detection (EMBED-02/04) will be skipped.${C.RESET}`);
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

  // Phase 355-16 (D-08, D-12, D-27): resolve endpoints locally, then await
  // Theo once per distinct pair before any line is printed.
  const findings = gaps.map((gap) => Object.assign(
    { direction: directionConvention.NONE },
    whitespaceEndpoints(gap, 'zone')
  ));
  const stamps = await verificationStamp.stampFindings(findings, {});

  for (const line of renderScanLines(gaps, stamps)) {
    console.log(line);
  }
}

// ---------------------------------------------------------------------------
// Subcommand: analyze
// ---------------------------------------------------------------------------

async function cmdAnalyze(roomDir, zoneId) {
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

  // Find zone. Rank (D-29) is computed against the SAME ascending-by-density
  // sort cmdMap uses, so `analyze`'s rank always agrees with `map`'s rank.
  const gaps = (data.gaps || []).sort((a, b) => (a.density_score || 0) - (b.density_score || 0));
  const rankIndex = gaps.findIndex((g) => (g.zone_id || g.gap_id) === zoneId);
  const zone = rankIndex === -1 ? null : gaps[rankIndex];
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

  const endpoints = whitespaceEndpoints(enrichedZone, 'zone');
  const stamp = await verificationStamp.stampFinding(
    Object.assign({ direction: directionConvention.NONE }, endpoints),
    {}
  );

  for (const line of renderAnalyzeLines(enrichedZone, stamp, rankIndex + 1, gaps.length)) {
    console.log(line);
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
  const labeledPath = path.join(mindrianDir, 'topic-forest.json'); // label-topic-forest.cjs enriches in-place

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
    printError('No labeled forest data', 'topic-forest.json not found -- run /mos:whitespace tree first', '/mos:whitespace tree');
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

async function cmdScore(roomDir) {
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

  // Phase 355-16 (D-48): each novelty row's endpoints are the artifact's own
  // carried name (frontmatter framework:/methodology:/title, read locally)
  // and the row's nearest_concept.
  const artifactRel = (item) => item.artifact || item.name || item.id || '';
  const findings = scores.map((item) => {
    const raw = _readArtifactRaw(roomDir, item.section, artifactRel(item));
    const enriched = Object.assign({}, item, {
      artifact_text: raw,
      artifact_title: artifactRel(item),
    });
    return Object.assign({ direction: directionConvention.NONE }, whitespaceEndpoints(enriched, 'novelty'));
  });
  const stamps = await verificationStamp.stampFindings(findings, {});

  for (const line of renderNoveltyLines(scores, stamps)) {
    console.log(line);
  }
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

  // Pre-step (Phase 88.6-03): ensure Brain baseline exists so downstream
  // interpretation of external whitespace has cross-domain context. External
  // whitespace can run without baseline (unlike cmdMap/cmdDiscover which
  // hard-depend on it); log a note and continue.
  const baselineResult = ensureBrainBaseline(roomDir, { verbose: false });
  if (!baselineResult.ensured) {
    console.log(`${C.YELLOW}Note: Brain baseline unavailable for cross-domain comparison.${C.RESET}`);
  }

  // Step 1 (Phase 88.6-03): run Semantic Scholar query. Do NOT early-return
  // on execSync throw -- inspect the post-run state of external-papers.json
  // and count queries by the status enum that query-semantic-scholar.cjs
  // now persists (ok / rate_limited / api_error / network_error / timeout /
  // not_attempted). This lets partial-result flows continue and surface
  // rate-limit warnings in Zone 3 rather than failing the whole pipeline.
  console.log(`${C.GRAY}Querying Semantic Scholar...${C.RESET}`);
  const scholarResult = runScript(`node "${scholarScript}" "${roomDir}"`);
  const papersPath = path.join(roomDir, '.mindrian', 'external-papers.json');
  const scholarFileExists = fileExists(papersPath);
  const scholarData = scholarFileExists ? readJSON(papersPath) : null;

  // Task 0 guarantees queries[] is present in external-papers.json. Fall
  // back defensively for cache files written by pre-88.6-03 versions.
  const queryOutcomes = Array.isArray(scholarData && scholarData.queries) ? scholarData.queries : [];
  const totalQueries = queryOutcomes.length;
  const rateLimitedQueries = queryOutcomes.filter(q => q.status === 'rate_limited').length;
  const errorQueries = queryOutcomes.filter(
    q => q.status === 'api_error' || q.status === 'network_error' || q.status === 'timeout'
  ).length;
  const successfulQueries = queryOutcomes.filter(q => q.status === 'ok').length;
  const papersFetched = Array.isArray(scholarData && scholarData.papers) ? scholarData.papers.length : 0;

  // Fail-explicit condition: scholar file absent, OR file reports top-level
  // `error`, OR zero successful queries AND zero papers. Rate-limited alone
  // is NOT fatal -- partial results still surface.
  const scholarFailedEntirely = !scholarFileExists
    || (scholarData && scholarData.error)
    || (successfulQueries === 0 && papersFetched === 0);

  if (scholarFailedEntirely) {
    const why = scholarData && scholarData.error
      ? scholarData.error
      : (rateLimitedQueries > 0
          ? `All ${totalQueries} queries rate-limited`
          : (totalQueries === 0
              ? 'No queries generated (room may lack content)'
              : 'All queries failed or returned no papers'));
    printError('Semantic Scholar unavailable',
      why,
      '/mos:whitespace external (retry in 60 seconds if rate-limited)');
    // scholarResult is intentionally inspected only as a side-channel signal.
    // The authoritative state is external-papers.json on disk.
    if (scholarResult && scholarResult.error && !scholarData) {
      console.log(`${C.GRAY}  (subprocess signal: ${scholarResult.message})${C.RESET}`);
    }
    return;
  }

  // Step 2 (Phase 88.6-03): run python3 compute-external-whitespace only
  // if scholar step did not fail entirely. Report the successful/total
  // ratio so the user sees real coverage.
  console.log(`${C.GRAY}Computing external whitespace (${papersFetched} papers, ${successfulQueries}/${totalQueries} queries OK)...${C.RESET}`);
  const computeResult = runScript(`python3 "${externalScript}" "${roomDir}"`);
  if (computeResult && computeResult.error) {
    printError('External whitespace computation failed',
      computeResult.message || 'unknown',
      '/mos:whitespace external');
    return;
  }

  // Step 3: render 4-zone output. Read results.
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
    // Phase 355-16 (D-29): a relevance decimal is not a stamped framework
    // pair (external literature match, no Theo endpoint on either side) --
    // it still never renders as a raw number. `papers` is assumed pre-sorted
    // by relevance; this is the paper's rank within the shown top 3.
    papers.slice(0, 3).forEach((p, i) => {
      const prefix = i < Math.min(papers.length, 3) - 1 ? SYM.BRANCH : SYM.LAST;
      const title = truncate(p.title || '', 45);
      const year = p.year || '?';
      console.log(`  ${prefix} ${title} (${year}) -- relevance rank ${i + 1} of ${Math.min(papers.length, 3)}`);
    });
  }

  // Zone 3 intelligence strip (Phase 88.6-03): surface rate-limit / error
  // counts when partial results were shown so the user knows coverage may
  // be reduced and the cause is external throttling, not empty-result.
  if (rateLimitedQueries > 0 || errorQueries > 0) {
    console.log('');
    if (rateLimitedQueries > 0) {
      console.log(`  ${SYM.WARN} ${rateLimitedQueries} of ${totalQueries} Semantic Scholar queries rate-limited (partial results shown)`);
    }
    if (errorQueries > 0) {
      console.log(`  ${SYM.WARN} ${errorQueries} of ${totalQueries} Semantic Scholar queries errored (partial results shown)`);
    }
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

  // Pre-step: ensure Brain baseline exists so discover-* Python scripts produce signal
  const baselineResult = ensureBrainBaseline(roomDir, { verbose: false });
  if (!baselineResult.ensured) {
    console.log(`${C.YELLOW}Note: Brain baseline unavailable -- discovery will run but may produce 0 zones across all pipelines.${C.RESET}`);
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

async function main() {
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
      await cmdMap(resolvedRoom);
      break;
    case 'analyze':
      await cmdAnalyze(resolvedRoom, subArgs[0]);
      break;
    case 'hypothesis':
      cmdHypothesis(resolvedRoom, subArgs[0]);
      break;
    case 'tree':
      cmdTree(resolvedRoom);
      break;
    case 'score':
      await cmdScore(resolvedRoom);
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

// Phase 355-16: guard the CLI trigger so this module can be `require()`d
// (scripts/whitespace-to-graph.cjs reuses `whitespaceEndpoints` below)
// without firing the dispatcher as a side effect of loading.
if (require.main === module) {
  main().catch((e) => {
    console.error('whitespace-command error: ' + (e && e.message ? e.message : e));
    process.exit(1);
  });
}

module.exports = {
  whitespaceEndpoints,
  renderScanLines,
  renderAnalyzeLines,
  renderNoveltyLines,
};
