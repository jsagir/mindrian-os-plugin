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

// Use lazygraph-ops for SQLite graph operations.
// Phase 236 (GRAPHDB-01): the two ownership constants are IMPORTED, never
// redeclared here. Two copies of an ownership contract is exactly the drift
// failure the constants exist to prevent.
const {
  openGraph, closeGraph, initSchema,
  INDEXER_OWNED_NODE_TYPES, INDEXER_OWNED_EDGE_TYPES, clearIndexerOwnedRows,
} = require(path.join(__dirname, '..', 'lib', 'core', 'lazygraph-ops.cjs'));

// Phase 236 (GRAPHDB-01): the shared NOT-NULL-safe node upsert. See the note on
// the Artifact upsert in buildEcosystemGraph for why the bare 3-column upsert
// this script used to issue could not survive a Phase-109-migrated room.db.
const { insertNode } = require(path.join(__dirname, '..', 'lib', 'core', 'node-insert.cjs'));

// --- Config ---
const SKIP_FILES = ['STATE.md', 'ROOM.md', 'CLAUDE.md', 'COWORK-INSTRUCTIONS.md', 'TODOS.md', 'WHATS-NEXT.md', 'INDEX.md', 'MILESTONES.md'];

// Phase 236 (GRAPHDB-01): the edge types THIS SCRIPT can regenerate, as the
// union of the shared indexer-owned set with the three derived types the script
// writes on top of it. Built FROM the import rather than by re-typing
// 'BELONGS_TO', so the shared constant stays the single source of truth.
//
// This union lives in THIS FILE and nowhere else, deliberately. Adding INFORMS /
// CONTRADICTS / CONVERGES to the SHARED INDEXER_OWNED_EDGE_TYPES would silently
// widen rebuildGraph's DELETE and reintroduce the data loss Phase 236 just
// closed, because rebuildGraph cannot regenerate cascade edges at all.
const ECOSYSTEM_OWNED_EDGE_TYPES = Object.freeze(
  INDEXER_OWNED_EDGE_TYPES.concat(['INFORMS', 'CONTRADICTS', 'CONVERGES'])
);

// The derived subset: the union MINUS the shared indexer-owned types. Derived
// from the two constants rather than hand-typed a third time, so the three lists
// can never drift out of agreement.
const ECOSYSTEM_DERIVED_EDGE_TYPES = Object.freeze(
  ECOSYSTEM_OWNED_EDGE_TYPES.filter((t) => INDEXER_OWNED_EDGE_TYPES.indexOf(t) === -1)
);
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

// --- Phase 236 (GRAPHDB-01): the ownership-scoped wipe ---
//
// RCA: .planning/debug/graph-rebuild-truncates-memory-journal.md
//
// THIS IS THE SECOND SITE OF THE SAME DEFECT. This script used to run the
// byte-identical unscoped delete-everything statement against the SAME
// <roomDir>/.mindrian/room.db that rebuildGraph wipes, erasing the memory_event
// audit journal, human-confirmed truth-claims, decisions, and the D-17
// append-only stage_history[] on opportunity nodes, none of which this script
// (or anything else) can regenerate.
//
// The wipe itself is NOT reimplemented here. It is lazygraph-ops.cjs
// clearIndexerOwnedRows, the single shared implementation both destructive
// reindex paths call, so the two can never drift apart. Two reasons it lives
// there and not here: ownership is a property of the write path that CREATES
// the rows, and Canon Part 9 (scripts/check-substrate.cjs) allow-lists
// lazygraph-ops.cjs to issue raw graph SQL while this script is not allow-listed,
// so a second raw-SQL wipe site here would require widening the chokepoint
// exemption, which this fix does not need to do.
//
// This script passes ECOSYSTEM_DERIVED_EDGE_TYPES as the extra derived set. Those
// are deleted ONLY between two indexer-owned endpoints, never by type alone: see
// the endpoint-ownership rationale on clearIndexerOwnedRows for why a type-only
// predicate would silently destroy derivation-authored cascade edges.

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

  // Phase 236 (GRAPHDB-01): the wipe-and-rewrite is now ATOMIC.
  //
  // Before this phase there was no BEGIN, COMMIT, ROLLBACK or SAVEPOINT anywhere
  // in this file: every write was a bare autocommit statement, so an interruption
  // between the wipe and the rewrite left a permanently emptied room and a
  // concurrent WAL reader could observe the torn state. The wrap below copies
  // rebuildGraph's proven shape (lib/core/lazygraph-ops.cjs BEGIN plus the
  // COMMIT / ROLLBACK-on-throw tail) verbatim: node:sqlite DatabaseSync exposes
  // no transaction(fn) helper (that is a better-sqlite3 API), so explicit
  // BEGIN / COMMIT / ROLLBACK is the only idiom available.
  //
  // The read-only stats block and closeGraph below stay OUTSIDE the wrap: they
  // must still run after a successful commit.
  conn.prepare('BEGIN').run();
  try {
    clearIndexerOwnedRows(conn, ECOSYSTEM_DERIVED_EDGE_TYPES);
    console.log('Cleared existing indexer-owned graph data');
    buildEcosystemGraph(conn, resolved);

    // Phase 244 (TRIG-01, T-244-09): the same eureka_fts staleness hazard as
    // rebuildGraph's sibling reconcile (lib/core/lazygraph-ops.cjs), because
    // this script opens the SAME <roomDir>/.mindrian/room.db shape (dbPath
    // above) and calls the SAME clearIndexerOwnedRows on it. Runs AFTER
    // buildEcosystemGraph, not immediately after clearIndexerOwnedRows, for
    // the same reason as the rebuildGraph sibling: buildEcosystemGraph
    // re-walks the WHOLE tree and reinserts every Artifact/Section node with
    // the same deterministic id on every run, so a reconcile placed between
    // the wipe and the rewalk would see a window where none of those nodes
    // exist yet and would wipe the lexical index on every build, not only
    // the rows for content that is genuinely gone. Riding THIS SAME BEGIN
    // makes it atomic for free: a crash after the prune but before the COMMIT
    // below rolls back both the node rewrite and this reconcile together.
    //
    // The prune SQL itself is NO LONGER duplicated here. Phase 244 (RCA
    // eureka-fts-orphan-rows-block-release-gate) extracted it to
    // tri.reconcileFtsOrphans, the one canonical copy, when the eureka_fts
    // BUILD path turned out to need the same reconcile; this file and
    // lazygraph-ops.cjs both delegate to it now, retiring the keep-both-copies-
    // in-sync hazard the old comments here warned about. The helper self-guards,
    // so this is still a no-op when FTS5 is unavailable on this build or when
    // eureka_fts was never built on this db (the default state of every live
    // room). The try/catch stays on this side by choice: the helper does not
    // swallow, because on the build path a swallowed fault would be a
    // "successful" build that silently did not reconcile.
    (function reconcileFtsIndexInline() {
      try {
        // eslint-disable-next-line global-require
        const tri = require(path.join(__dirname, '..', 'lib', 'core', 'eureka', 'tri-modal-index.cjs'));
        tri.reconcileFtsOrphans(conn);
      } catch (_e) {
        // Swallow and continue: a reconcile fault must never abort an
        // otherwise-succeeding ecosystem graph build.
      }
    })();

    conn.prepare('COMMIT').run();
  } catch (err) {
    try { conn.prepare('ROLLBACK').run(); } catch (_rbErr) { /* ignore */ }
    throw err;
  }

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

// --- Phase 236 (GRAPHDB-01): the wipe-and-rewrite body, now transactable ---
//
// Extracted verbatim from main() so the whole destructive region (the scoped
// wipe through the end of Phase 3) sits inside ONE BEGIN/COMMIT/ROLLBACK. The
// read-only stats block and closeGraph deliberately stay OUTSIDE it in main():
// they must still run after a successful commit.
function buildEcosystemGraph(conn, resolved) {
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

    // Upsert Artifact node.
    // Phase 236 (GRAPHDB-01): routed through the shared NOT-NULL-safe
    // node-insert chokepoint. The bare 3-column upsert this line used to issue
    // threw `NOT NULL constraint failed: nodes.source_path` (SQLite errcode
    // 1299) against ANY room.db carrying the Phase-109 provenance migration,
    // which is every room opened through room-db.cjs openRoomDb. The script
    // therefore wiped the room and then crashed before restoring a single node,
    // which is precisely how an unscoped, un-transacted wipe turns a routine
    // reindex into a permanent loss. insertNode detects both schema
    // generations, so legacy 3-column dbs keep working unchanged.
    const artifactProps = JSON.stringify({ title, section, methodology, created, content_hash: contentHash });
    insertNode(conn, id, 'Artifact', artifactProps, {
      source_path: relPath,
      created_by: 'system',
    });

    // Upsert Section node (includes vertical prefix for sub-rooms)
    const sectionLabel = section.replace(/\//g, ' > ').replace(/-/g, ' ').toUpperCase();
    const sectionProps = JSON.stringify({ name: section, label: sectionLabel });
    insertNode(conn, section, 'Section', sectionProps, {
      source_path: 'section:' + section,
      created_by: 'system',
    });

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
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
