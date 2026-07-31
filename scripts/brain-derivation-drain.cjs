#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 90-02 Task 2 -- Brain derivation drain (UserPromptSubmit hook)
 * ====================================================================
 * Drains the brain-derivation queue on every UserPromptSubmit. For each
 * eligible entry (current triple hash matches queue hash AND Brain is
 * available), spawns a detached child process that runs deriveSection
 * and writes the section's BRAIN.md. The parent returns immediately so
 * the user turn never waits.
 *
 * Wall-clock contract: parent exits within ~100ms regardless of queue
 * depth. Each spawned child runs independently and may take seconds (or
 * minutes) to complete its Brain calls; that is expected and acceptable
 * because BRAIN.md is read-only intelligence consumed by the next
 * SessionStart, not the current user turn.
 *
 * Failure discipline: silent fail. Hook scripts must never disrupt user
 * input. Errors written to stderr at most. Exit code always 0 on any
 * non-fatal path. Matches Phase 88 guardian advisory pattern.
 *
 * CLI invocation modes:
 *
 *   node scripts/brain-derivation-drain.cjs
 *     -- Resolve active room from .rooms/registry.json. Drain up to 5
 *        entries by spawning detached deriveSection children. Exit 0.
 *
 *   node scripts/brain-derivation-drain.cjs --room <roomDir>
 *     -- Drain a specific room. Used by Plan 90-03 staleness scan.
 *
 *   node scripts/brain-derivation-drain.cjs --single <section>
 *     -- Single-section synchronous derive (no detached spawn). Used by
 *        the spawned children themselves to actually do the work; not
 *        invoked directly by the hook.
 *
 *   node scripts/brain-derivation-drain.cjs --max <N>
 *     -- Override default maxEntries (default 5).
 *
 *   node scripts/brain-derivation-drain.cjs --dry-run
 *     -- Drain without spawning; print plan to stderr. Test surface.
 *
 * Pure CJS, node built-ins only, zero npm deps. Three-surface compatible
 * by construction (CLI + Desktop MCP + Cowork).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PARENT_BUDGET_MS = 100;

// Phase 245-02: test-only override of the parent budget so the
// budget-exhaustion path is PROVABLE by running the shipped script rather
// than by reading it (mirrors the TEST_245_PREFIX idiom that 245-01
// established in tests/run-all-245.sh). Production never sets this; an
// unset, empty, or unparseable value yields PARENT_BUDGET_MS verbatim.
function parentBudgetMs() {
  const raw = process.env.MOS_DRAIN_PARENT_BUDGET_MS;
  if (raw === undefined || raw === null || raw === '') return PARENT_BUDGET_MS;
  const n = parseInt(raw, 10);
  if (Number.isFinite(n) && String(n) === String(raw).trim()) return n;
  return PARENT_BUDGET_MS;
}

// ---------------------------------------------------------------------------
// Active room resolution (mirrors scripts/intent-classifier.cjs pattern).
// ---------------------------------------------------------------------------

function resolveMindrianRoomsRoot() {
  const envRoot = process.env.MINDRIAN_ROOMS_ROOT;
  if (envRoot && fs.existsSync(envRoot)) return envRoot;
  const home = process.env.HOME || os.homedir();
  if (!home) return null;
  const defaultRoot = path.join(home, 'MindrianRooms');
  if (fs.existsSync(defaultRoot)) return defaultRoot;
  return null;
}

function resolveActiveRoomDir() {
  const root = resolveMindrianRoomsRoot();
  if (!root) return null;
  let reg;
  try {
    const regPath = path.join(root, '.rooms', 'registry.json');
    reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  } catch (_) {
    return null;
  }
  if (reg && typeof reg.active === 'string' && reg.active.length > 0) {
    const cand = path.join(root, reg.active);
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}

// ---------------------------------------------------------------------------
// CLI parser
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {
    roomDir: null,
    single: null,
    maxEntries: 5,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--room' && argv[i + 1]) {
      out.roomDir = argv[i + 1];
      i += 1;
    } else if (a === '--single' && argv[i + 1]) {
      out.single = argv[i + 1];
      i += 1;
    } else if (a === '--max' && argv[i + 1]) {
      const n = parseInt(argv[i + 1], 10);
      if (Number.isFinite(n) && n > 0) out.maxEntries = n;
      i += 1;
    } else if (a === '--dry-run') {
      out.dryRun = true;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Single-section synchronous derive (invoked by spawned children)
// ---------------------------------------------------------------------------

async function runSingleDerive(roomDir, section) {
  let derive;
  try {
    derive = require('../lib/core/brain-derivation.cjs');
  } catch (_e) {
    return 1;
  }
  try {
    const result = await derive.deriveSection(roomDir, section, {});
    if (result && result.success) return 0;
    return 0; // soft-fail: failed derivations are advisory, not blocking
  } catch (_e) {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Main drain (UserPromptSubmit hook entry)
// ---------------------------------------------------------------------------

async function runDrain(roomDir, opts) {
  let Q;
  try {
    Q = require('../lib/core/brain-derivation-queue.cjs');
  } catch (_e) {
    return; // queue module unavailable -- soft-fail
  }
  // Phase 245-02 (D-08 first half): warm EVERY lazily-required dependency
  // BEFORE the budget clock starts. Q.drain lazily requires folder-memory.cjs
  // (which pulls node:sqlite) and brain-client.cjs at drain time, and the
  // SENS-03 fire below lazily requires navigation.cjs. On a cold hook process
  // that module load costs 96-191ms, so it alone blew the 100ms budget before
  // the first spawn ever ran. PARENT_BUDGET_MS was written to bound SPAWN
  // work; loading modules inside the measured window mis-measured against it.
  // Soft-fail: a warm-up failure must never break the hook. Q.drain hits the
  // same failure and returns errors:1 through its own guard.
  let navigation = null;
  try {
    require('../lib/core/folder-memory.cjs');
    require('../lib/core/brain-client.cjs');
  } catch (_e) { /* soft-fail: drain reports the same failure itself */ }
  try {
    navigation = require('../lib/core/navigation.cjs');
  } catch (_e) { navigation = null; }

  const budgetMs = parentBudgetMs();
  const start = Date.now();
  const result = await Q.drain(roomDir, {
    maxEntries: opts.maxEntries,
    dryRun: true, // Read-only preview. We handle dispatch via detached spawn below.
  });
  // Q.drain in dryRun mode collects entries that should fire (in result.dispatched)
  // WITHOUT spawning and WITHOUT touching the queue file. We do the spawn here,
  // then commit only what actually spawned.
  const spawnedSections = [];
  if (Array.isArray(result.dispatched)) {
    for (const item of result.dispatched) {
      if (opts.dryRun) {
        process.stderr.write(
          '[brain-derivation-drain] would spawn deriveSection for section=' +
          item.section + '\n'
        );
        continue;
      }
      let spawned = false;
      try {
        const child = spawn(process.execPath, [
          path.join(REPO_ROOT, 'scripts', 'brain-derivation-drain.cjs'),
          '--room', roomDir,
          '--single', item.section,
        ], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
        spawned = true;
      } catch (_e) {
        // Soft-fail: spawn failure is advisory. The entry stays queued because
        // its section never reaches spawnedSections, so the next turn retries.
      }
      if (spawned) spawnedSections.push(item.section);

      // Phase 144.1-06 RETRO-03 (audit item 68): fire SENS-03 (brain_consult /
      // brain-derivation / hold) through the navigation chokepoint so the engine
      // can observe that a brain-derivation was dispatched for this section --
      // memory_event_only. LOCAL only (Canon Part 8): the fire records THAT a
      // derivation fired, carrying only the section-name handle + reach handles;
      // it never carries the BRAIN.md body or any user content, and the Brain
      // call itself happens in the detached --single child via the existing
      // boundary-audited deriveSection path, not here. Routes through
      // navigation.cjs::logSpineRead; best-effort, never throws, never blocks.
      try {
        if (navigation && typeof navigation.logSpineRead === 'function') {
          navigation.logSpineRead(roomDir, {
            surface: 'brain_consult',
            sensor: 'SENS-03',
            dispatch: 'brain-derivation',
            posture: 'hold',
            section: String(item.section || ''),
            source: 'brain-derivation-drain',
          });
        }
      } catch (_e) { /* never throw -- fire is advisory */ }

      // Phase 245-02 (D-08 first half, second move): the budget check lives at
      // the BOTTOM of the loop body, after the spawn and after the SENS-03
      // fire, so the FIRST eligible entry always gets a child. At the top it
      // could (and did) trip before any spawn at all, which combined with the
      // old destructive dry run meant the queue was emptied and nothing
      // derived. PARENT_BUDGET_MS itself is unchanged at 100.
      if (Date.now() - start > budgetMs) break;
    }
  }

  // Phase 245-02 (D-08 second half): commit ONLY what actually spawned.
  // Entries the dry run previewed but that never got a child (budget
  // exhausted mid-loop, or spawn threw) stay queued and are retried next
  // turn. That converts a silent total loss into graceful degradation.
  // In operator --dry-run mode nothing spawned, so nothing is committed.
  if (!opts.dryRun) {
    try {
      Q.commitDispatched(roomDir, spawnedSections);
    } catch (_e) { /* never throw -- the hook stays fail-silent */ }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

(async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    // --single: child path -- run deriveSection synchronously and exit.
    if (args.single) {
      const roomDir = args.roomDir || resolveActiveRoomDir();
      if (!roomDir) process.exit(0);
      const code = await runSingleDerive(roomDir, args.single);
      process.exit(typeof code === 'number' ? code : 0);
      return;
    }

    // Hook path: drain the active room (or --room override).
    const roomDir = args.roomDir || resolveActiveRoomDir();
    if (!roomDir) {
      // No active room -- silent no-op.
      process.exit(0);
      return;
    }
    await runDrain(roomDir, args);
    process.exit(0);
  } catch (_e) {
    // Fail-silent on any unexpected error. Drain is advisory.
    process.exit(0);
  }
})();
