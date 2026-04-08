#!/usr/bin/env node
/**
 * write-whitespace-sections.cjs -- Per-Section WHITESPACE.md Writer
 * ==================================================================
 * Reads .mindrian/whitespace-results.json and writes a WHITESPACE.md
 * file into each room section folder, making detected gaps immediately
 * visible in Claude's context when opening any section.
 *
 * ICM-native: the folder structure delivers intelligence without
 * extra queries. Larry sees the gaps the moment a section folder
 * is opened.
 *
 * Usage: node scripts/write-whitespace-sections.cjs /path/to/room
 *        node scripts/write-whitespace-sections.cjs --room /path/to/room
 *
 * Output: room/[section]/WHITESPACE.md for each section directory
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract section name from an artifact ID or path.
 * Artifact IDs look like "problem-definition/some-artifact.md".
 * Returns the first path component, or "unclassified" if none.
 * @param {string} artifactId
 * @returns {string}
 */
function extractSection(artifactId) {
  if (!artifactId || typeof artifactId !== 'string') return 'unclassified';
  const parts = artifactId.replace(/^\/+/, '').split('/');
  return parts.length > 1 ? parts[0] : 'unclassified';
}

/**
 * Convert a kebab-case section name to a Title Case label.
 * @param {string} section
 * @returns {string}
 */
function sectionLabel(section) {
  return section
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Round a number to 3 decimal places.
 * @param {number} n
 * @returns {number}
 */
function r3(n) {
  return Math.round(n * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

function main() {
  // --- Parse CLI args ---
  let roomDir = null;
  const args = process.argv.slice(2);

  if (args.length === 0) {
    process.stderr.write(
      'Usage: node scripts/write-whitespace-sections.cjs /path/to/room\n' +
      '       node scripts/write-whitespace-sections.cjs --room /path/to/room\n'
    );
    process.exit(1);
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--room' && args[i + 1]) {
      roomDir = args[i + 1];
      i++;
    } else if (!args[i].startsWith('-')) {
      roomDir = args[i];
    }
  }

  if (!roomDir) {
    process.stderr.write('Error: No room path provided.\n');
    process.exit(1);
  }

  const resolvedRoom = path.resolve(roomDir);

  // --- Load whitespace-results.json ---
  const resultsPath = path.join(resolvedRoom, '.mindrian', 'whitespace-results.json');
  if (!fs.existsSync(resultsPath)) {
    // No whitespace results -- skip gracefully
    process.stdout.write('No whitespace-results.json found. Skipping.\n');
    process.exit(0);
  }

  let data;
  try {
    const raw = fs.readFileSync(resultsPath, 'utf-8');
    data = JSON.parse(raw);
  } catch (e) {
    process.stderr.write('Error: Could not parse whitespace-results.json\n');
    process.exit(1);
  }

  const metadata = data.metadata || {};
  const gaps = data.gaps || [];
  const noveltyScores = data.novelty_scores || [];
  const timestamp = metadata.timestamp || new Date().toISOString();

  // Check for interpretation-results.json (Phase 62 enrichment)
  const interpPath = path.join(resolvedRoom, '.mindrian', 'interpretation-results.json');
  let interpGapMap = {};
  if (fs.existsSync(interpPath)) {
    try {
      const interpData = JSON.parse(fs.readFileSync(interpPath, 'utf-8'));
      if (interpData && Array.isArray(interpData.gaps)) {
        for (const ig of interpData.gaps) {
          if (ig.brain_framework) {
            interpGapMap[ig.brain_framework] = ig;
          }
        }
      }
    } catch (e) {
      // Malformed interpretation -- continue without enrichment
    }
  }

  // --- Group gaps by section ---
  // Each gap has nearest_room_artifacts which can be objects or strings.
  // Extract section from artifact_id or the string itself.
  const gapsBySection = {};

  for (const gap of gaps) {
    const nearestArtifacts = gap.nearest_room_artifacts || [];
    const sections = new Set();

    for (const artifact of nearestArtifacts) {
      let artifactId;
      if (typeof artifact === 'string') {
        artifactId = artifact;
      } else if (artifact && artifact.artifact_id) {
        artifactId = artifact.artifact_id;
      }
      const sec = extractSection(artifactId);
      sections.add(sec);
    }

    // If no sections found, classify as unclassified
    if (sections.size === 0) {
      sections.add('unclassified');
    }

    for (const sec of sections) {
      if (!gapsBySection[sec]) gapsBySection[sec] = [];
      gapsBySection[sec].push(gap);
    }
  }

  // --- Group novelty scores by section ---
  const noveltyBySection = {};

  for (const ns of noveltyScores) {
    const sec = ns.section || extractSection(ns.artifact_id);
    if (!noveltyBySection[sec]) noveltyBySection[sec] = [];
    noveltyBySection[sec].push(ns);
  }

  // --- Discover all section directories in the room ---
  let entries;
  try {
    entries = fs.readdirSync(resolvedRoom, { withFileTypes: true });
  } catch (e) {
    process.stderr.write(`Error: Cannot read room directory: ${resolvedRoom}\n`);
    process.exit(1);
  }

  const sectionDirs = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
    .map(e => e.name);

  if (sectionDirs.length === 0) {
    process.stdout.write('No section directories found in room. Skipping.\n');
    process.exit(0);
  }

  // --- Write WHITESPACE.md to each section ---
  let sectionsWritten = 0;
  let totalGapsDistributed = 0;

  for (const section of sectionDirs) {
    const sectionGaps = gapsBySection[section] || [];
    const sectionNovelty = noveltyBySection[section] || [];
    const sectionPath = path.join(resolvedRoom, section, 'WHITESPACE.md');

    // Skip if section has no gaps and no novelty scores
    if (sectionGaps.length === 0 && sectionNovelty.length === 0) {
      const minimal = buildMinimalWhitespace(section, timestamp);
      fs.writeFileSync(sectionPath, minimal, 'utf-8');
      sectionsWritten++;
      continue;
    }

    const content = buildWhitespaceMd(section, sectionGaps, sectionNovelty, timestamp, interpGapMap);
    fs.writeFileSync(sectionPath, content, 'utf-8');
    sectionsWritten++;
    totalGapsDistributed += sectionGaps.length;
  }

  process.stdout.write(
    `Wrote WHITESPACE.md to ${sectionsWritten} sections, ${totalGapsDistributed} total gaps distributed.\n`
  );
}

// ---------------------------------------------------------------------------
// Markdown builders
// ---------------------------------------------------------------------------

/**
 * Build a minimal WHITESPACE.md for sections with no gaps or novelty.
 * @param {string} section
 * @param {string} timestamp
 * @returns {string}
 */
function buildMinimalWhitespace(section, timestamp) {
  return [
    '---',
    `section: ${section}`,
    'gaps: 0',
    'avg_novelty: 0',
    `last_updated: ${timestamp}`,
    '---',
    '',
    `# Whitespace Gaps: ${sectionLabel(section)}`,
    '',
    'No whitespace gaps detected in this section. All territory appears well-covered.',
    '',
    '---',
    '*Generated by MindrianOS whitespace pipeline*',
    `*Run \`python3 scripts/compute-whitespace-gaps.py {room}\` to refresh*`,
    '',
  ].join('\n');
}

/**
 * Build a full WHITESPACE.md with gaps and novelty scores.
 * @param {string} section
 * @param {Array} sectionGaps
 * @param {Array} sectionNovelty
 * @param {string} timestamp
 * @param {Object} interpGapMap - interpretation enrichment keyed by brain_framework
 * @returns {string}
 */
function buildWhitespaceMd(section, sectionGaps, sectionNovelty, timestamp, interpGapMap) {
  // Compute average novelty
  let avgNovelty = 0;
  if (sectionNovelty.length > 0) {
    const sum = sectionNovelty.reduce((acc, ns) => acc + (ns.novelty_score || 0), 0);
    avgNovelty = r3(sum / sectionNovelty.length);
  }

  const lines = [];

  // Frontmatter
  lines.push('---');
  lines.push(`section: ${section}`);
  lines.push(`gaps: ${sectionGaps.length}`);
  lines.push(`avg_novelty: ${avgNovelty}`);
  lines.push(`last_updated: ${timestamp}`);
  lines.push('---');
  lines.push('');

  // Header
  lines.push(`# Whitespace Gaps: ${sectionLabel(section)}`);
  lines.push('');
  lines.push(`${sectionGaps.length} gap(s) detected in this section's knowledge territory.`);
  lines.push('');

  // Detected Gaps
  if (sectionGaps.length > 0) {
    lines.push('## Detected Gaps');
    lines.push('');

    for (let i = 0; i < sectionGaps.length; i++) {
      const gap = sectionGaps[i];
      const density = r3(gap.density_score || 0);
      const rank = r3(gap.strategic_rank || 0);

      // Check interpretation enrichment
      const interp = (interpGapMap || {})[gap.brain_framework];
      const problemType = (interp && interp.problem_type) || gap.problem_type || '';
      const frameworkChain = (interp && interp.framework_chain) || [];
      const validated = interp && interp.validated;
      const validationGates = (interp && interp.validation) || {};

      // Gap heading with problem type badge
      const badge = problemType ? ` [${problemType}]` : '';
      lines.push(`### ${i + 1}. ${gap.brain_framework}${badge} (density: ${density})`);

      // Framework chain suggestion
      if (frameworkChain.length > 0) {
        lines.push(`- **Explore via:** ${frameworkChain.join(' -> ')}`);
      }

      // Validation status
      if (interp) {
        const passedGates = (validationGates.gates_passed || []).map(g =>
          g.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
        );
        if (validated) {
          lines.push(`- **Confidence:** Validated (${passedGates.join(' + ')})`);
        } else {
          lines.push(`- **Confidence:** Unvalidated`);
        }
      }

      // Strategic rank
      lines.push(`- **Strategic rank:** ${rank}`);

      // Nearest Brain frameworks (the gap IS a brain framework, list it)
      lines.push(`- **Nearest Brain frameworks:** ${gap.brain_framework}`);

      // Nearest room artifacts
      const nearestArtifacts = gap.nearest_room_artifacts || [];
      const artifactNames = nearestArtifacts.map(a => {
        if (typeof a === 'string') return a;
        return a.title || a.artifact_id || 'unknown';
      });
      lines.push(`- **Nearest room artifacts:** ${artifactNames.join(', ') || 'none'}`);

      // Status
      lines.push('- **Status:** detected');
      lines.push('');
    }
  }

  // Section Novelty Scores
  if (sectionNovelty.length > 0) {
    lines.push('## Section Novelty Scores');
    lines.push('');
    lines.push('| Artifact | Novelty | Nearest Framework |');
    lines.push('|----------|---------|-------------------|');

    for (const ns of sectionNovelty) {
      const title = ns.title || ns.artifact_id || 'unknown';
      const score = r3(ns.novelty_score || 0);
      const framework = ns.nearest_brain_framework || 'unknown';
      lines.push(`| ${title} | ${score} | ${framework} |`);
    }

    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('*Generated by MindrianOS whitespace pipeline*');
  lines.push(`*Run \`python3 scripts/compute-whitespace-gaps.py {room}\` to refresh*`);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main();
