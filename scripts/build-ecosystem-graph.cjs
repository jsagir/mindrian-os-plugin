#!/usr/bin/env node
/**
 * build-ecosystem-graph.cjs -- Build LazyGraph for nested ecosystem rooms
 *
 * Extends lazygraph-ops.cjs to handle sub-rooms/, meetings/, team/ directories.
 * Recursively walks the entire room tree, indexes all .md artifacts,
 * and parses full-path [[wikilinks]] into INFORMS/CONTRADICTS edges.
 *
 * Usage: node scripts/build-ecosystem-graph.cjs <roomDir>
 * Example: node scripts/build-ecosystem-graph.cjs ~/MindrianRooms/align-ecosystem
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Use lazygraph-ops for SQLite graph operations
const { openGraph, closeGraph, initSchema } = require(path.join(__dirname, '..', 'lib', 'core', 'lazygraph-ops.cjs'));

// --- Config ---
const SKIP_FILES = ['STATE.md', 'ROOM.md', 'CLAUDE.md', 'COWORK-INSTRUCTIONS.md', 'TODOS.md', 'WHATS-NEXT.md', 'INDEX.md', 'MILESTONES.md'];
const SKIP_DIRS = ['.mindrian', '.git', 'node_modules', 'filed-to', 'export', 'exports', 'diagrams'];
const CONTRADICT_TERMS = ['however', 'contradicts', 'unlike', 'disagrees', 'conflicts', 'contrary', 'opposes', 'tension', 'but'];

// --- Helpers ---

function extractTitle(content, filePath) {
  const match = content.match(/^# (.+)$/m);
  return match ? match[1].trim() : path.basename(filePath, '.md');
}

function extractFrontmatter(content, field) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return '';
  const line = fmMatch[1].split('\n').find(l => l.startsWith(field + ':'));
  if (!line) return '';
  return line.slice(field.length + 1).trim().replace(/^["']|["']$/g, '');
}

function computeHash(content) {
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

/**
 * Determine section from artifact path.
 * For nested rooms: sub-rooms/lab-2-0/business-model/foo.md -> lab-2-0/business-model
 * For parent: business-model/foo.md -> business-model
 * For meetings: meetings/2026-04-09-xyz/summary.md -> meetings
 * For team: team/partners/dror-barak/PROFILE.md -> team
 */
function getSection(relPath) {
  const parts = relPath.split('/');
  if (parts[0] === 'sub-rooms' && parts.length >= 3) {
    // sub-rooms/{vertical}/{section}/file.md
    return parts[1] + '/' + parts[2];
  }
  if (parts[0] === 'meetings') return 'meetings';
  if (parts[0] === 'team') return 'team';
  return parts[0]; // parent section
}

/**
 * Get vertical from path (or 'parent' for top-level)
 */
function getVertical(relPath) {
  const parts = relPath.split('/');
  if (parts[0] === 'sub-rooms' && parts.length >= 2) return parts[1];
  return 'parent';
}

/**
 * Recursively find all .md files in a directory tree.
 * Follows symlinks (for polygon/ and align-x-milken/).
 */
function walkDir(dir, baseDir, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() || entry.isSymbolicLink()) {
      // Check if symlink points to directory
      if (entry.isSymbolicLink()) {
        try {
          const stat = fs.statSync(fullPath);
          if (!stat.isDirectory()) continue;
        } catch (e) { continue; }
      }

      if (SKIP_DIRS.includes(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;

      walkDir(fullPath, baseDir, results);
    } else if (entry.name.endsWith('.md') && !SKIP_FILES.includes(entry.name)) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push({ fullPath, relPath });
    } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
      // Skip YAML for now, but could index metadata
    }
  }

  return results;
}

/**
 * Extract all [[wikilinks]] from content, returning target paths.
 */
function extractWikilinks(content) {
  const matches = content.match(/\[\[([^\]]+)\]\]/g) || [];
  return matches.map(m => {
    let target = m.replace(/\[\[|\]\]/g, '');
    // Remove .md extension if present
    target = target.replace(/\.md$/, '');
    return target;
  });
}

// --- Main ---
async function main() {
  const roomDir = process.argv[2];
  if (!roomDir) {
    console.error('Usage: node scripts/build-ecosystem-graph.cjs <roomDir>');
    process.exit(1);
  }

  const resolved = path.resolve(roomDir);
  if (!fs.existsSync(resolved)) {
    console.error(`ERROR: Room directory not found: ${resolved}`);
    process.exit(1);
  }

  const dbPath = path.join(resolved, '.mindrian', 'room.db');
  console.log(`Building ecosystem graph at ${dbPath}`);

  // Open database via lazygraph-ops
  const { db, conn } = await openGraph(resolved);

  // Clear existing data (edges first for FK compliance)
  conn.exec('DELETE FROM edges; DELETE FROM nodes;');
  console.log('Cleared existing graph data');

  // Walk entire room tree
  const allFiles = walkDir(resolved, resolved);
  console.log(`Found ${allFiles.length} .md files`);

  // Phase 1: Create all artifact and section nodes
  const artifactMap = {}; // relPath (without .md) -> { section, title, vertical }

  for (const { fullPath, relPath } of allFiles) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const id = relPath.replace(/\.md$/, '');
    const section = getSection(relPath);
    const vertical = getVertical(relPath);
    const title = extractTitle(content, fullPath);
    const methodology = extractFrontmatter(content, 'methodology');
    const created = extractFrontmatter(content, 'created');
    const contentHash = computeHash(content);

    artifactMap[id] = { section, title, vertical };

    // Upsert Artifact node
    const artifactProps = JSON.stringify({ title, section, methodology, created, content_hash: contentHash });
    conn.prepare(
      'INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET type = excluded.type, properties = excluded.properties'
    ).run(id, 'Artifact', artifactProps);

    // Upsert Section node (includes vertical prefix for sub-rooms)
    const sectionLabel = section.replace(/\//g, ' > ').replace(/-/g, ' ').toUpperCase();
    const sectionProps = JSON.stringify({ name: section, label: sectionLabel });
    conn.prepare(
      'INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET properties = excluded.properties'
    ).run(section, 'Section', sectionProps);

    // BELONGS_TO edge
    conn.prepare(
      'INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
    ).run(id, section, 'BELONGS_TO');
  }

  console.log(`Indexed ${Object.keys(artifactMap).length} artifacts across ${new Set(Object.values(artifactMap).map(a => a.section)).size} sections`);

  // Phase 2: Parse wikilinks into INFORMS/CONTRADICTS edges
  let informsCount = 0;
  let contradictsCount = 0;

  for (const { fullPath, relPath } of allFiles) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const sourceId = relPath.replace(/\.md$/, '');
    const wikilinks = extractWikilinks(content);

    for (const target of wikilinks) {
      // Try to match target to a known artifact
      let targetId = target;

      // Check if target exists in our artifact map
      if (!artifactMap[targetId]) {
        // Try without leading path components
        const basename = target.split('/').pop();
        const matches = Object.keys(artifactMap).filter(k => k.endsWith('/' + basename) || k === basename);
        if (matches.length === 1) {
          targetId = matches[0];
        } else if (matches.length > 1) {
          // Multiple matches -- pick the one in the same vertical
          const sourceVertical = getVertical(relPath);
          const sameVertical = matches.find(m => getVertical(m) === sourceVertical);
          targetId = sameVertical || matches[0];
        } else {
          // No match found -- target might be a section reference
          // Create INFORMS to all artifacts in that section
          const sectionMatches = Object.entries(artifactMap)
            .filter(([k, v]) => v.section === target || v.section.endsWith('/' + target))
            .map(([k]) => k);

          for (const matchId of sectionMatches) {
            if (matchId === sourceId) continue;
            conn.prepare(
              'INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
            ).run(sourceId, matchId, 'INFORMS');
            informsCount++;
          }
          continue;
        }
      }

      if (targetId === sourceId) continue;
      if (!artifactMap[targetId]) continue;

      // Check for contradiction context
      const linkText = `[[${target}]]`;
      const linkIdx = content.indexOf(linkText);
      if (linkIdx >= 0) {
        const contextStart = Math.max(0, linkIdx - 300);
        const contextEnd = Math.min(content.length, linkIdx + 300);
        const nearbyText = content.slice(contextStart, contextEnd).toLowerCase();

        if (CONTRADICT_TERMS.some(term => nearbyText.includes(term))) {
          const contradictProps = JSON.stringify({ confidence: 'medium' });
          conn.prepare(
            'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
          ).run(sourceId, targetId, 'CONTRADICTS', contradictProps);
          contradictsCount++;
        }
      }

      // Always create INFORMS edge
      conn.prepare(
        'INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
      ).run(sourceId, targetId, 'INFORMS');
      informsCount++;
    }

    // Check cascade_sections frontmatter
    const cascadeLine = extractFrontmatter(content, 'cascade_sections');
    if (cascadeLine) {
      // Parse [section1, section2] format
      const cascades = cascadeLine.replace(/[\[\]]/g, '').split(',').map(s => s.trim());
      for (const cascadeSection of cascades) {
        if (!cascadeSection) continue;
        // Find artifacts in the cascade section
        const cascadeMatches = Object.entries(artifactMap)
          .filter(([k, v]) => v.section === cascadeSection || v.section.endsWith('/' + cascadeSection))
          .map(([k]) => k);

        for (const matchId of cascadeMatches) {
          if (matchId === sourceId) continue;
          conn.prepare(
            'INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
          ).run(sourceId, matchId, 'INFORMS');
          informsCount++;
        }
      }
    }
  }

  console.log(`Created ${informsCount} INFORMS edges, ${contradictsCount} CONTRADICTS edges`);

  // Phase 3: Cross-vertical CONVERGES detection
  // Find themes (title words) that appear in 3+ sections
  const titleWords = {};
  for (const [id, meta] of Object.entries(artifactMap)) {
    const words = meta.title.toLowerCase().split(/[\s\-_:,]+/).filter(w => w.length > 4);
    for (const word of words) {
      if (!titleWords[word]) titleWords[word] = new Set();
      titleWords[word].add(meta.section);
    }
  }

  let convergesCount = 0;
  for (const [word, sections] of Object.entries(titleWords)) {
    if (sections.size >= 3) {
      // Find all artifacts with this word in their title
      const matchingArtifacts = Object.entries(artifactMap)
        .filter(([id, meta]) => meta.title.toLowerCase().includes(word))
        .map(([id]) => id);

      // Create CONVERGES edges between all pairs
      for (let i = 0; i < matchingArtifacts.length; i++) {
        for (let j = i + 1; j < matchingArtifacts.length; j++) {
          const convergesProps = JSON.stringify({ term: word });
          conn.prepare(
            'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
          ).run(matchingArtifacts[i], matchingArtifacts[j], 'CONVERGES', convergesProps);
          convergesCount++;
        }
      }
    }
  }
  console.log(`Created ${convergesCount} CONVERGES edges`);

  // Stats
  const stats = {};
  const artifactCount = conn.prepare("SELECT COUNT(*) AS cnt FROM nodes WHERE type = 'Artifact'").get();
  const sectionCount = conn.prepare("SELECT COUNT(*) AS cnt FROM nodes WHERE type = 'Section'").get();
  stats.artifacts = artifactCount ? artifactCount.cnt : 0;
  stats.sections = sectionCount ? sectionCount.cnt : 0;

  const edgeTypes = ['INFORMS', 'CONTRADICTS', 'CONVERGES', 'ENABLES', 'INVALIDATES', 'BELONGS_TO'];
  stats.edges = {};
  for (const et of edgeTypes) {
    try {
      const row = conn.prepare("SELECT COUNT(*) AS cnt FROM edges WHERE type = ?").get(et);
      stats.edges[et] = row ? row.cnt : 0;
    } catch (e) {
      stats.edges[et] = 0;
    }
  }

  const totalEdges = Object.values(stats.edges).reduce((a, b) => a + b, 0);

  console.log('\n=== ECOSYSTEM GRAPH STATS ===');
  console.log(`Artifacts: ${stats.artifacts}`);
  console.log(`Sections:  ${stats.sections}`);
  console.log(`Edges:     ${totalEdges}`);
  for (const [et, count] of Object.entries(stats.edges)) {
    if (count > 0) console.log(`  ${et}: ${count}`);
  }

  // Close
  await closeGraph(db);

  console.log('\nGraph built successfully.');
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
