#!/usr/bin/env node
'use strict';

/**
 * Cascade E2E Integration Test (Plan 87-00)
 * ==========================================
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 *
 * Acceptance gate for Plan 87-03 (intelligence cascade deduplication refactor).
 *
 * Copies test/fixtures/cascade-e2e/seed-room/ into a hermetic tmp dir under
 * a path that contains `/rooms/` (required by intelligence-cascade.isRoomFile),
 * runs `runCascade` against each seeded artifact in order, reads the resulting
 * .mindrian/room.db edges table, and asserts the observed per-type edge counts
 * against a frozen baseline at ./expected-edges.json.
 *
 * Modes:
 *   - ASSERT mode (default): read baseline, compare counts, exit 0 on match,
 *     1 on mismatch (a real regression; triggers Plan 87-03 rollback).
 *   - SNAPSHOT mode (`--snapshot` flag): write current counts to
 *     expected-edges.json. Used by ./generate-baseline to regenerate the
 *     frozen baseline after intentional seed changes.
 *
 * Exit codes (POSIX / make-test convention):
 *   0  -- all assertions passed
 *   1  -- assertion FAILED (real regression, triggers 87-03 rollback)
 *   77 -- environment degraded (Python or classify-insight unavailable); test
 *         SKIPPED, not failed. Feynman runner treats 77 as skipped.
 *
 * Environment probes (R-87-00-DET):
 *   HAS_PYTHON      -- python3 resolves on PATH
 *   HAS_CLASSIFY    -- scripts/classify-insight exists in repo
 *   HSI_AVAILABLE   -- scripts/compute-hsi.py exists, SKIP_HSI not set
 *
 * Usage:
 *   node test/fixtures/cascade-e2e/cascade-e2e.test.cjs            # ASSERT
 *   node test/fixtures/cascade-e2e/cascade-e2e.test.cjs --snapshot # SNAPSHOT
 *
 * Business Source License 1.1 -- see repository LICENSE.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { runCascade } = require('../../../lib/core/intelligence-cascade.cjs');

const FIXTURE_DIR = path.join(__dirname, 'seed-room');
const BASELINE_PATH = path.join(__dirname, 'expected-edges.json');
const SNAPSHOT_MODE = process.argv.includes('--snapshot');

// ---------------------------------------------------------------------------
// Environment probes (R-87-00-DET): fail-safe degradation path
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const CLASSIFY_SCRIPT = path.join(REPO_ROOT, 'scripts', 'classify-insight');
const HSI_SCRIPT = path.join(REPO_ROOT, 'scripts', 'compute-hsi.py');

const HAS_PYTHON = spawnSync('python3', ['--version'], { stdio: 'ignore' }).status === 0;
const HAS_CLASSIFY = fs.existsSync(CLASSIFY_SCRIPT);
const ENV_OK = HAS_PYTHON && HAS_CLASSIFY;
const HSI_AVAILABLE = ENV_OK && fs.existsSync(HSI_SCRIPT) && !process.env.SKIP_HSI;

if (!ENV_OK) {
  // Exit code 77 = test infrastructure broken (POSIX convention). The 87-03
  // rollback policy must NOT fire on exit 77 -- this is a missing Python or
  // missing scripts/classify-insight in the test host, not a cascade
  // regression. The feynman runner treats 77 as SKIPPED, not FAILED.
  process.stdout.write('[cascade-e2e] SKIPPED (exit 77): environment degraded\n');
  process.stdout.write('  HAS_PYTHON=' + HAS_PYTHON + ', HAS_CLASSIFY=' + HAS_CLASSIFY + '\n');
  process.stdout.write('  Plan 87-03 rollback does NOT fire on exit 77 -- install python3 and retry.\n');
  process.exit(77);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Count edges per type from room.db. Returns a fixed-shape object so the
 * baseline JSON always has all four keys present (0 for absent types).
 * @param {import('node:sqlite').DatabaseSync} db
 */
function countEdges(db) {
  const rows = db.prepare("SELECT type, COUNT(*) AS n FROM edges GROUP BY type").all();
  const counts = { INFORMS: 0, CONTRADICTS: 0, CONVERGES: 0, INVALIDATES: 0 };
  for (const r of rows) {
    if (r.type in counts) counts[r.type] = Number(r.n);
  }
  return counts;
}

/**
 * Run the cascade against all three seeded artifacts in the order
 * problem-definition -> market-analysis -> solution-design. The order matters:
 * each later artifact's wikilinks resolve against artifacts indexed earlier,
 * so the deterministic edge set depends on filing order.
 * @param {string} roomDir
 */
async function runAllCascades(roomDir) {
  await runCascade(roomDir, {
    trigger: 'test',
    filePath: path.join(roomDir, 'problem-definition', 'jtbd-underservice.md'),
    section: 'problem-definition',
  });
  await runCascade(roomDir, {
    trigger: 'test',
    filePath: path.join(roomDir, 'market-analysis', 's-curve-mature-market.md'),
    section: 'market-analysis',
  });
  await runCascade(roomDir, {
    trigger: 'test',
    filePath: path.join(roomDir, 'solution-design', 'niche-within-mature.md'),
    section: 'solution-design',
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Hermetic tmp dir. The path MUST contain `/rooms/` so that
  // intelligence-cascade.isRoomFile() returns true for artifacts inside.
  const tmpParent = fs.mkdtempSync(path.join(os.tmpdir(), 'cascade-e2e-'));
  const roomsDir = path.join(tmpParent, 'rooms');
  const roomDir = path.join(roomsDir, 'cascade-fixture');
  fs.mkdirSync(roomsDir, { recursive: true });

  try {
    fs.cpSync(FIXTURE_DIR, roomDir, { recursive: true });

    await runAllCascades(roomDir);

    const dbPath = path.join(roomDir, '.mindrian', 'room.db');
    if (!fs.existsSync(dbPath)) {
      process.stderr.write('[cascade-e2e] FAIL: room.db was not created at ' + dbPath + '\n');
      process.stderr.write('  The cascade did not reach the graph-index step. Check isRoomFile().\n');
      process.exit(1);
    }

    const db = new DatabaseSync(dbPath, { readOnly: true });
    const counts = countEdges(db);
    db.close();

    if (SNAPSHOT_MODE) {
      // --------------------------------------------------------------
      // SNAPSHOT: write a fresh baseline from observed cascade output
      // --------------------------------------------------------------
      const baseline = {
        _comment: 'Frozen baseline for 87-03 acceptance gate. Regenerate via ./generate-baseline. Do NOT edit by hand.',
        _seed_version: '2026-04-19',
        _captured_at: new Date().toISOString(),
        _hsi_available_at_capture: HSI_AVAILABLE,
        edges: {
          INFORMS:     { hard: counts.INFORMS },
          CONTRADICTS: { hard: counts.CONTRADICTS },
          CONVERGES:   {
            hard_if_hsi:    HSI_AVAILABLE ? counts.CONVERGES : null,
            soft_if_no_hsi: 0,
          },
          INVALIDATES: {
            // INVALIDATES is created by lazygraph-ops.indexArtifact from
            // explicit `invalidates:` frontmatter, so it is HSI-independent
            // in the current cascade. Capturing under hard_if_hsi preserves
            // future flexibility if HSI starts contributing INVALIDATES.
            hard_if_hsi:    HSI_AVAILABLE ? counts.INVALIDATES : null,
            soft_if_no_hsi: HSI_AVAILABLE ? 0 : counts.INVALIDATES,
          },
        },
      };
      fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
      process.stdout.write('[cascade-e2e] SNAPSHOT written to ' + BASELINE_PATH + '\n');
      process.stdout.write('  captured counts: ' + JSON.stringify(counts) + '\n');
      process.stdout.write('  HSI_AVAILABLE at capture: ' + HSI_AVAILABLE + '\n');
      process.exit(0);
    }

    // ------------------------------------------------------------------
    // ASSERT mode: compare observed counts to frozen baseline
    // ------------------------------------------------------------------
    if (!fs.existsSync(BASELINE_PATH)) {
      process.stderr.write('[cascade-e2e] MISSING BASELINE: ' + BASELINE_PATH + '\n');
      process.stderr.write('  Run: bash test/fixtures/cascade-e2e/generate-baseline\n');
      process.exit(1);
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

    // INFORMS and CONTRADICTS are language-based (no HSI dependency). Exact
    // match required.
    assert.strictEqual(
      counts.INFORMS,
      baseline.edges.INFORMS.hard,
      'INFORMS count ' + counts.INFORMS + ' != baseline ' + baseline.edges.INFORMS.hard,
    );
    assert.strictEqual(
      counts.CONTRADICTS,
      baseline.edges.CONTRADICTS.hard,
      'CONTRADICTS count ' + counts.CONTRADICTS + ' != baseline ' + baseline.edges.CONTRADICTS.hard,
    );

    if (HSI_AVAILABLE) {
      const expC = baseline.edges.CONVERGES.hard_if_hsi;
      const expI = baseline.edges.INVALIDATES.hard_if_hsi;
      assert.strictEqual(
        counts.CONVERGES,
        expC,
        'CONVERGES count ' + counts.CONVERGES + ' != HSI-hard baseline ' + expC,
      );
      assert.strictEqual(
        counts.INVALIDATES,
        expI,
        'INVALIDATES count ' + counts.INVALIDATES + ' != HSI-hard baseline ' + expI,
      );
    } else {
      const softC = baseline.edges.CONVERGES.soft_if_no_hsi;
      const softI = baseline.edges.INVALIDATES.soft_if_no_hsi;
      process.stdout.write('[cascade-e2e] HSI unavailable -- asserting soft baseline\n');
      assert.strictEqual(
        counts.CONVERGES,
        softC,
        'HSI-soft CONVERGES count ' + counts.CONVERGES + ' != soft baseline ' + softC,
      );
      assert.strictEqual(
        counts.INVALIDATES,
        softI,
        'HSI-soft INVALIDATES count ' + counts.INVALIDATES + ' != soft baseline ' + softI,
      );
    }

    process.stdout.write(
      '[cascade-e2e] all assertions passed (exact-match vs baseline): ' + JSON.stringify(counts) + '\n',
    );
    process.exit(0);
  } catch (e) {
    process.stderr.write('[cascade-e2e] FAIL: ' + (e.message || e) + '\n');
    if (e.stack) process.stderr.write(e.stack + '\n');
    process.exit(1);
  } finally {
    try { fs.rmSync(tmpParent, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

main();
