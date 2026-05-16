#!/usr/bin/env node
/**
 * audit-active-phase-resolver.cjs
 *
 * Sub-plan G housekeeping (Phase 121.5-06): audit .planning/phases/ for empty
 * or abandoned phase directories that could mis-report the active phase via
 * scripts/context-monitor's detectActiveWorkflow() mtime scan.
 *
 * A phase directory is "healthy" if it contains ANY of:
 *   - <phase>-CONTEXT.md
 *   - <phase>-PLAN.md (or <phase>-NN-PLAN.md)
 *   - <phase>-SUMMARY.md (or <phase>-NN-SUMMARY.md)
 *   - <phase>-VERIFICATION.md
 *   - <phase>-VALIDATION.md
 *   - ROOM.md (ICM Layer 0)
 *
 * A phase directory is "empty/abandoned" if it has NONE of the above
 * AND contains zero .md files at the top level. These corrupt mtime scans
 * because the dir's mtime can shadow more recent phase activity.
 *
 * Exit codes:
 *   0  no empty/abandoned dirs found OR --json mode (always 0)
 *   1  empty/abandoned dirs found in default mode
 *
 * Usage:
 *   node scripts/audit-active-phase-resolver.cjs
 *   node scripts/audit-active-phase-resolver.cjs --json
 *   node scripts/audit-active-phase-resolver.cjs --fix    # delete empty dirs (interactive)
 */

const fs = require("node:fs");
const path = require("node:path");

const PHASES_DIR = path.join(process.cwd(), ".planning", "phases");
const HEALTHY_PATTERNS = [
  /^.*-CONTEXT\.md$/i,
  /^.*-PLAN\.md$/i,
  /^.*-SUMMARY\.md$/i,
  /^.*-VERIFICATION\.md$/i,
  /^.*-VALIDATION\.md$/i,
  /^ROOM\.md$/,
];

function isHealthy(dirPath) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath);
  } catch (e) {
    return { healthy: false, reason: "unreadable", error: e.message };
  }
  const mdFiles = entries.filter((e) => e.endsWith(".md"));
  const healthyFiles = mdFiles.filter((f) =>
    HEALTHY_PATTERNS.some((p) => p.test(f))
  );
  return {
    healthy: healthyFiles.length > 0,
    md_count: mdFiles.length,
    healthy_files: healthyFiles,
    all_files: entries,
  };
}

function auditPhases() {
  if (!fs.existsSync(PHASES_DIR)) {
    return { exists: false, results: [] };
  }
  const phaseDirs = fs.readdirSync(PHASES_DIR).filter((d) => {
    const p = path.join(PHASES_DIR, d);
    return fs.statSync(p).isDirectory();
  });
  const results = phaseDirs.map((d) => {
    const dirPath = path.join(PHASES_DIR, d);
    const health = isHealthy(dirPath);
    return {
      phase_dir: d,
      path: dirPath,
      ...health,
    };
  });
  return { exists: true, results };
}

function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const fixMode = args.includes("--fix");

  const audit = auditPhases();

  if (!audit.exists) {
    if (jsonMode) {
      console.log(JSON.stringify({ exists: false, results: [] }, null, 2));
    } else {
      console.log("(.planning/phases/ does not exist -- nothing to audit)");
    }
    process.exit(0);
  }

  const empty = audit.results.filter((r) => !r.healthy);
  const total = audit.results.length;

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          total_phase_dirs: total,
          healthy_count: total - empty.length,
          empty_or_abandoned: empty,
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  console.log(`Audited ${total} phase directories under .planning/phases/`);
  console.log(`  Healthy: ${total - empty.length}`);
  console.log(`  Empty/abandoned: ${empty.length}`);
  console.log("");

  if (empty.length === 0) {
    console.log("OK: no empty/abandoned phase directories.");
    process.exit(0);
  }

  console.log("Empty/abandoned directories (could corrupt active-phase mtime scan):");
  for (const dir of empty) {
    console.log(`  - ${dir.phase_dir} (md_count: ${dir.md_count}, files: ${dir.all_files.join(", ") || "(empty)"})`);
  }

  if (fixMode) {
    console.log("");
    console.log("Fix mode active. Deleting empty directories (those with zero files):");
    let deleted = 0;
    for (const dir of empty) {
      if (dir.all_files && dir.all_files.length === 0) {
        try {
          fs.rmdirSync(dir.path);
          console.log(`  DELETED: ${dir.phase_dir}`);
          deleted++;
        } catch (e) {
          console.log(`  FAILED to delete ${dir.phase_dir}: ${e.message}`);
        }
      } else {
        console.log(`  SKIPPED ${dir.phase_dir}: has non-canonical files; manual review required`);
      }
    }
    console.log(`Deleted ${deleted} truly-empty directories.`);
    process.exit(0);
  }

  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = { isHealthy, auditPhases, HEALTHY_PATTERNS };
