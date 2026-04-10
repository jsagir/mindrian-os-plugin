#!/usr/bin/env node
/**
 * migrate-lazygraph.cjs -- Room Graph Migration Tool
 * Rebuilds room.db graph from room artifacts (rebuild-from-artifacts approach).
 * Does NOT require kuzu to be installed -- reads .md files directly.
 *
 * Usage:
 *   node scripts/migrate-lazygraph.cjs /path/to/room [--dry-run] [--force]
 *
 * Options:
 *   --dry-run   Show what would happen without writing anything
 *   --force     Overwrite existing room.db if present
 *   --help      Show this usage message
 *
 * The tool:
 * 1. Discovers room sections and .md artifacts
 * 2. Creates .mindrian/room.db with SQLite schema
 * 3. Indexes all artifacts (nodes, edges, wikilinks, contradictions)
 * 4. Reports migration statistics
 * 5. Advises removal of old .lazygraph/ directory if present
 *
 * Note: This migration tool references the former "kuzu" graph database
 * only in advisory messages about cleaning up old .lazygraph/ directories.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Export for require() testing (module loads without error)
module.exports = { name: 'migrate-lazygraph' };

// Only run CLI when executed directly
if (require.main !== module) { /* loaded as library */ } else {

// --- Argument Parsing ---

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log(`
migrate-lazygraph.cjs -- Room Graph Migration Tool

Rebuilds room.db graph from room artifacts (rebuild-from-artifacts approach).

Usage:
  node scripts/migrate-lazygraph.cjs /path/to/room [--dry-run] [--force]

Options:
  --dry-run   Show what would happen without writing anything
  --force     Overwrite existing room.db if present
  --help      Show this usage message

Examples:
  node scripts/migrate-lazygraph.cjs ./room --dry-run
  node scripts/migrate-lazygraph.cjs ./room
  node scripts/migrate-lazygraph.cjs ./room --force
`);
  process.exit(0);
}

const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const roomDir = args.find(a => !a.startsWith('--'));

if (!roomDir) {
  console.error('Error: Room directory path is required.');
  console.error('Usage: node scripts/migrate-lazygraph.cjs /path/to/room [--dry-run] [--force]');
  process.exit(1);
}

const resolvedRoom = path.resolve(roomDir);

if (!fs.existsSync(resolvedRoom)) {
  console.error(`Error: Room directory not found: ${resolvedRoom}`);
  process.exit(1);
}

// --- Lazy-load core modules (only needed for actual migration) ---

function loadCore() {
  const corePath = path.join(__dirname, '..', 'lib', 'core', 'lazygraph-ops.cjs');
  if (!fs.existsSync(corePath)) {
    console.error(`Error: lazygraph-ops.cjs not found at ${corePath}`);
    process.exit(1);
  }
  return require(corePath);
}

function loadSectionRegistry() {
  const regPath = path.join(__dirname, '..', 'lib', 'core', 'section-registry.cjs');
  if (!fs.existsSync(regPath)) {
    console.error(`Error: section-registry.cjs not found at ${regPath}`);
    process.exit(1);
  }
  return require(regPath);
}

// --- Discovery (used by both dry-run and real migration) ---

function discoverArtifacts(roomPath) {
  const { discoverSections } = loadSectionRegistry();
  const discovery = discoverSections(roomPath);
  const sections = discovery.all || [];
  let totalArtifacts = 0;
  const sectionDetails = [];

  for (const sectionName of sections) {
    const sectionDir = path.join(roomPath, sectionName);
    let mdFiles = [];
    try {
      mdFiles = fs.readdirSync(sectionDir).filter(f =>
        f.endsWith('.md') && f !== 'STATE.md' && f !== 'ROOM.md'
      );
    } catch (e) {
      // Section directory may not exist or be unreadable
      continue;
    }

    if (mdFiles.length > 0) {
      sectionDetails.push({ name: sectionName, artifacts: mdFiles.length });
      totalArtifacts += mdFiles.length;
    }
  }

  return { sections: sectionDetails, totalSections: sections.length, totalArtifacts };
}

// --- Main ---

async function main() {
  const dbDir = path.join(resolvedRoom, '.mindrian');
  const dbPath = path.join(dbDir, 'room.db');
  const oldLazygraphDir = path.join(resolvedRoom, '.lazygraph');

  console.log(`\nMindrianOS LazyGraph Migration Tool`);
  console.log(`${'='.repeat(40)}`);
  console.log(`Room: ${resolvedRoom}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'MIGRATE'}\n`);

  // Check if already migrated
  if (fs.existsSync(dbPath) && !force && !dryRun) {
    console.log(`room.db already exists at ${dbPath}`);
    console.log(`Use --force to overwrite, or --dry-run to preview.`);
    process.exit(0);
  }

  // Discover artifacts
  const { sections, totalSections, totalArtifacts } = discoverArtifacts(resolvedRoom);

  console.log(`Sections found: ${totalSections}`);
  console.log(`Sections with artifacts: ${sections.length}`);
  console.log(`Total artifacts: ${totalArtifacts}`);

  if (sections.length > 0) {
    console.log(`\nSection breakdown:`);
    for (const s of sections) {
      console.log(`  ${s.name}: ${s.artifacts} artifact(s)`);
    }
  }

  if (totalArtifacts === 0) {
    console.log(`\nNo artifacts found to migrate. Room may be empty or sections have no .md files.`);
    process.exit(0);
  }

  // Dry run stops here
  if (dryRun) {
    console.log(`\n[DRY RUN] Would create: ${dbDir}/room.db`);
    console.log(`[DRY RUN] Would index: ${totalArtifacts} artifacts from ${sections.length} sections`);
    console.log(`[DRY RUN] Estimated nodes: ~${totalArtifacts + totalSections} (artifacts + sections)`);
    console.log(`[DRY RUN] Estimated edges: ~${totalArtifacts} (BELONGS_TO + wikilinks)`);

    if (fs.existsSync(oldLazygraphDir)) {
      console.log(`\n[DRY RUN] Old .lazygraph/ directory detected at ${oldLazygraphDir}`);
      console.log(`[DRY RUN] After migration, you can safely delete it: rm -rf ${oldLazygraphDir}`);
    }
    process.exit(0);
  }

  // --- Actual Migration ---
  const core = loadCore();

  // If forcing, remove old room.db
  if (force && fs.existsSync(dbPath)) {
    console.log(`\nRemoving existing room.db (--force)...`);
    fs.unlinkSync(dbPath);
    // Remove WAL/SHM files if present
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  }

  console.log(`\nMigrating...`);

  const { db, conn } = await core.openGraph(resolvedRoom);

  try {
    const result = await core.rebuildGraph(conn, resolvedRoom);

    if (!result.success) {
      console.error(`Migration failed: rebuildGraph returned success=false`);
      process.exit(1);
    }

    const stats = await core.graphStats(conn);

    console.log(`\nMigration complete!`);
    console.log(`  Artifacts indexed: ${result.artifacts}`);
    console.log(`  Sections indexed: ${result.sections}`);
    console.log(`  Total nodes: ${stats.total.nodes}`);
    console.log(`  Total edges: ${stats.total.edges}`);
    console.log(`  Database: ${dbPath}`);

    if (stats.total.nodes > 0) {
      console.log(`\nNode breakdown:`);
      for (const [type, count] of Object.entries(stats.nodes)) {
        if (count > 0) console.log(`  ${type}: ${count}`);
      }
    }

    if (stats.total.edges > 0) {
      console.log(`\nEdge breakdown:`);
      for (const [type, count] of Object.entries(stats.edges)) {
        if (count > 0) console.log(`  ${type}: ${count}`);
      }
    }
  } finally {
    await core.closeGraph(db);
  }

  // Advisory about old .lazygraph/ directory
  if (fs.existsSync(oldLazygraphDir)) {
    console.log(`\nAdvisory: Old .lazygraph/ directory found at ${oldLazygraphDir}`);
    console.log(`The graph has been migrated to SQLite at .mindrian/room.db.`);
    console.log(`You can safely delete the old directory: rm -rf ${oldLazygraphDir}`);
  }

  console.log(`\nDone.`);
  process.exit(0);
}

main().catch(err => {
  console.error(`Migration error: ${err.message}`);
  process.exit(1);
});

} // end if (require.main === module)
