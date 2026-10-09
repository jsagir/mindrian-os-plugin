#!/usr/bin/env node
/**
 * whitespace-to-graph.cjs -- SQLite Writer for Whitespace Gap Detection Results
 * ==============================================================================
 * Reads .mindrian/whitespace-results.json and creates WhitespaceZone nodes,
 * WHITESPACE_DETECTED edges, WHITESPACE_NEAR edges, and updates artifact
 * novelty_score values in SQLite via lazygraph-ops.cjs.
 *
 * Usage: node scripts/whitespace-to-graph.cjs /path/to/room
 *
 * Migrated from whitespace-to-kuzu.cjs (KuzuDB Cypher) to SQLite prepared statements.
 * Uses the open-use-close pattern from lazygraph-ops.cjs.
 *
 * 2026 revision:
 *  - nearest_room_artifacts entries are objects ({artifact_id, title, section}) in what
 *    compute-whitespace-gaps.py writes, but the original passed each whole entry to
 *    linkWhitespaceToArtifact as if it were an id, so every WHITESPACE_DETECTED and
 *    WHITESPACE_NEAR edge failed inside an empty catch and the summary line still printed
 *    "0 edges" as if nothing was wrong. Entries are now normalised to ids (string ids and
 *    {artifact_id} / {id} objects), and integer indexes (the legacy form, unresolvable here)
 *    are counted and reported.
 *  - The empty catch blocks are replaced by counters plus the first few distinct error
 *    messages, printed with the summary, so a failed edge write is visible.
 *  - A missing, unreadable or empty results file is reported on stderr (exit codes unchanged).
 *  - zoneIdFor/slugify/shortHash are exported; zoneIdFor is the same id compute-whitespace-gaps.py
 *    now writes as gap.zone_id.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  openGraph,
  closeGraph,
  addWhitespaceZone,
  linkWhitespaceToArtifact,
  linkWhitespaceToSection,
} = require('../lib/core/lazygraph-ops.cjs');
// Phase 355-16 (HIPS-05, D-08, D-12, D-16): --stamp is opt-in. Without it
// this script is byte-identical to its pre-355 behavior, so
// scripts/scout-cadence-runner.cjs's SCHED-02 background call (Theo-free by
// design) stays exactly as it was.
const verificationStamp = require('../lib/core/verification-stamp.cjs');
const directionConvention = require('../lib/core/direction-convention.cjs');
const { whitespaceEndpoints } = require('./whitespace-command.cjs');

/**
 * Generate a deterministic slug from a framework name.
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  return (name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a deterministic short hash from a string.
 * @param {string} input
 * @returns {string} 8-char hex hash
 */
function shortHash(input) {
  return crypto.createHash('md5').update(input).digest('hex').slice(0, 8);
}

/** Same id the Python producer writes as gap.zone_id: ws-<slug>-<md5(framework)[:8]>. */
function zoneIdFor(framework) {
  const name = framework || 'unknown';
  return `ws-${slugify(name)}-${shortHash(name)}`;
}

/** Artifact id from a nearest_room_artifacts entry (string id, {artifact_id}, {id}); null otherwise. */
function normalizeArtifactId(entry) {
  if (typeof entry === 'string' && entry) return entry;
  if (entry && typeof entry === 'object') {
    const id = entry.artifact_id || entry.id;
    if (typeof id === 'string' && id) return id;
  }
  return null;
}

async function main(argv, deps) {
  const args = Array.isArray(argv) ? argv : process.argv.slice(2);
  deps = deps || {};
  const roomDir = args[0];
  const stampMode = args.indexOf('--stamp') !== -1;
  if (!roomDir) {
    process.stderr.write('Usage: node scripts/whitespace-to-graph.cjs /path/to/room [--stamp]\n');
    process.exit(1);
  }

  const resolvedRoom = path.resolve(roomDir);
  const resultsPath = path.join(resolvedRoom, '.mindrian', 'whitespace-results.json');

  // No results file: nothing to write (not an error), but say so
  if (!fs.existsSync(resultsPath)) {
    process.stderr.write('Whitespace-to-graph: no .mindrian/whitespace-results.json; nothing written\n');
    process.exit(0);
  }

  // Read and parse results
  let data;
  try {
    const raw = fs.readFileSync(resultsPath, 'utf-8');
    data = JSON.parse(raw);
  } catch (e) {
    process.stderr.write('Whitespace-to-graph: whitespace-results.json is unreadable (' + e.message + '); graph left unchanged\n');
    process.exit(0);
  }

  if (!data || (!data.gaps && !data.novelty_scores)) {
    process.stderr.write('Whitespace-to-graph: whitespace-results.json has no gaps or novelty_scores; graph left unchanged\n');
    process.exit(0);
  }

  const gaps = data.gaps || [];
  const noveltyScores = data.novelty_scores || [];

  // Check for interpretation-results.json (from Phase 62 interpret-whitespace.cjs)
  // If present, use enriched gaps with problem_type and framework_chain
  const interpPath = path.join(resolvedRoom, '.mindrian', 'interpretation-results.json');
  let interpData = null;
  if (fs.existsSync(interpPath)) {
    try {
      interpData = JSON.parse(fs.readFileSync(interpPath, 'utf-8'));
    } catch (e) {
      // Malformed interpretation -- continue with raw gaps (but say so)
      process.stderr.write('Whitespace-to-graph: interpretation-results.json unreadable (' + e.message + '); using raw gaps\n');
    }
  }

  // Build lookup from interpretation data keyed by brain_framework
  const interpGapMap = {};
  if (interpData && Array.isArray(interpData.gaps)) {
    for (const ig of interpData.gaps) {
      if (ig.brain_framework) {
        interpGapMap[ig.brain_framework] = ig;
      }
    }
  }

  // Phase 355-16 (D-08, D-12, Pitfall 7): Theo is awaited BEFORE any BEGIN,
  // and only when --stamp is set. A zone's endpoints are its own
  // interpretation-enriched framework_chain (falling back to its single
  // brain_framework when the chain is empty), resolved and stamped once per
  // distinct pair (stampFindings' own per-run memo, D-12: no cross-run
  // cache). Without --stamp, stampByFramework stays empty and every branch
  // below that reads it is a no-op -- background callers (SCHED-02) are
  // byte-identical.
  const stampByFramework = new Map();
  if (stampMode) {
    const frameworks = [];
    const zoneFindings = [];
    for (const gap of gaps) {
      const framework = gap.brain_framework || 'unknown';
      const interp = interpGapMap[framework] || {};
      const chain = Array.isArray(interp.framework_chain) ? interp.framework_chain : [];
      const nearest = chain.length > 0 ? chain : [framework];
      const endpoints = whitespaceEndpoints({ nearest_frameworks: nearest }, 'zone');
      frameworks.push(framework);
      zoneFindings.push(Object.assign({ direction: directionConvention.NONE }, endpoints));
    }
    const stamps = await verificationStamp.stampFindings(zoneFindings, deps);
    frameworks.forEach((framework, i) => stampByFramework.set(framework, stamps[i]));
  }

  let db;
  try {
    const graph = await openGraph(resolvedRoom);
    db = graph.db;
    const conn = graph.conn;

    // Prepare statement for finding sections via BELONGS_TO edges
    const findSections = conn.prepare(
      "SELECT e.target AS section_name FROM edges e JOIN nodes n ON e.target = n.id WHERE e.source = ? AND e.type = 'BELONGS_TO' AND n.type = 'Section'"
    );

    let zoneCount = 0;
    let edgeCount = 0;
    let nearCount = 0;
    let skippedLinks = 0;
    let unresolvableEntries = 0;
    const errorSamples = [];
    const noteError = (where, e) => {
      const msg = where + ': ' + (e && e.message ? e.message : String(e));
      if (errorSamples.length < 3 && errorSamples.indexOf(msg) === -1) errorSamples.push(msg);
    };

    // --- Write WhitespaceZone nodes and WHITESPACE_DETECTED edges ---
    for (const gap of gaps) {
      const framework = gap.brain_framework || 'unknown';
      const zoneId = zoneIdFor(framework);

      // Enrich from interpretation-results.json if available
      const interp = interpGapMap[framework] || {};
      const problemType = interp.problem_type || gap.problem_type || '';
      const frameworkChain = interp.framework_chain
        ? JSON.stringify(interp.framework_chain)
        : '[]';

      // Create WhitespaceZone node. Phase 355-16 (D-16): when --stamp is
      // set, toNodeProps(stamp) rides this SAME addWhitespaceZone call (see
      // lib/core/lazygraph-ops.cjs's optional stamp-field merge) -- no new
      // writer, no raw SQL.
      const zoneProps = {
        id: zoneId,
        brain_framework: framework,
        density_score: gap.density_score || 0.0,
        knn_density: gap.knn_density || 0.0,
        nearest_frameworks: frameworkChain,
        hypothesis: gap.hypothesis || '',
        strategic_rank: gap.strategic_rank || 0.0,
        problem_type: problemType,
        exploration_status: 'detected',
        created: new Date().toISOString(),
      };
      if (stampMode && stampByFramework.has(framework)) {
        Object.assign(zoneProps, verificationStamp.toNodeProps(stampByFramework.get(framework)));
      }
      await addWhitespaceZone(conn, zoneProps);
      zoneCount++;

      // Create WHITESPACE_DETECTED edges to nearest artifacts
      const nearestArtifacts = [];
      for (const entry of (gap.nearest_room_artifacts || [])) {
        const id = normalizeArtifactId(entry);
        if (id) nearestArtifacts.push(id);
        else unresolvableEntries++;
      }
      for (const artifactId of nearestArtifacts) {
        try {
          await linkWhitespaceToArtifact(conn, zoneId, artifactId, gap.density_score || 0.0);
          edgeCount++;
        } catch (e) {
          // Artifact may not exist in graph -- skip, but count it
          skippedLinks++;
          noteError('link ' + artifactId, e);
        }
      }

      // Find sections from nearest artifacts and create WHITESPACE_NEAR edges
      const seenSections = new Set();
      for (const artifactId of nearestArtifacts) {
        try {
          const rows = findSections.all(artifactId);
          for (const row of rows) {
            const sectionName = row.section_name;
            if (sectionName && !seenSections.has(sectionName)) {
              seenSections.add(sectionName);
              await linkWhitespaceToSection(conn, zoneId, sectionName, gap.strategic_rank || 0.0);
              nearCount++;
            }
          }
        } catch (e) {
          skippedLinks++;
          noteError('section lookup ' + artifactId, e);
        }
      }
    }

    // --- Update artifact novelty_score values ---
    let noveltyCount = 0;
    for (const entry of noveltyScores) {
      if (!entry.artifact_id || typeof entry.novelty_score !== 'number') continue;
      try {
        // Store novelty scores as lightweight WhitespaceZone nodes (score carriers)
        // since the Artifact properties JSON schema does not include novelty_score
        const scoreId = `ns-${slugify(entry.artifact_id)}`;
        await addWhitespaceZone(conn, {
          id: scoreId,
          brain_framework: `novelty:${entry.artifact_id}`,
          density_score: entry.novelty_score,
          knn_density: entry.novelty_score,
          hypothesis: `Novelty score carrier for artifact: ${entry.artifact_id}`,
          exploration_status: 'resolved',
          created: new Date().toISOString(),
        });
        // Link to the artifact
        await linkWhitespaceToArtifact(conn, scoreId, entry.artifact_id, entry.novelty_score);
        noveltyCount++;
      } catch (e) {
        skippedLinks++;
        noteError('novelty ' + entry.artifact_id, e);
      }
    }

    process.stderr.write(
      `Whitespace: wrote ${zoneCount} zone nodes, ${edgeCount} WHITESPACE_DETECTED edges, ` +
      `${nearCount} WHITESPACE_NEAR edges, ${noveltyCount} novelty scores\n`
    );
    if (skippedLinks > 0 || unresolvableEntries > 0) {
      process.stderr.write(
        `Whitespace-to-graph: ${skippedLinks} link writes failed (artifact not in graph or write error), ` +
        `${unresolvableEntries} nearest-artifact entries had no usable artifact id` +
        (errorSamples.length ? `; e.g. ${errorSamples.join(' | ')}` : '') + '\n'
      );
    }
    if (zoneCount > 0 && edgeCount === 0 && gaps.length > 0) {
      process.stderr.write('Whitespace-to-graph warning: zones were written but no zone is linked to any artifact\n');
    }

  } catch (e) {
    process.stderr.write(`whitespace-to-graph error: ${e.message}\n`);
    process.exit(1);
  } finally {
    if (db) {
      try {
        await closeGraph(db);
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, zoneIdFor, slugify, shortHash, normalizeArtifactId };
