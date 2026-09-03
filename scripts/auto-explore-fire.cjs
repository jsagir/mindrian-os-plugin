#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 117-02 Wave 1 -- detached background fire child.
 *
 * Spawned by scripts/auto-explore-fingerprint.cjs (Phase 117-01) with argv:
 *   [roomDir, relativeFilePath, material_id, session_id]
 *   (Phase 237-06, REACH-03: session_id is the 4th argv element, threaded
 *   from the fingerprint hook's own stdin; may be an empty string when the
 *   fingerprint hook received none, and may be entirely absent when this
 *   script is invoked directly with only 3 argv.)
 *
 * Flow per RESEARCH Section 12 sequence diagram:
 *   1. ensureBrainBaseline(roomDir) -- graceful degradation if {ensured:false}
 *   2. Promise.all([
 *        spawnAsync('node scripts/discovery-cycle.cjs <roomDir> --steps all'),
 *        spawnAsync('python3 scripts/rs-engine.py --mode hybrid --room <roomDir> --topk 5')
 *      ])
 *   3. Read 3 JSONs: whitespace-results.json + .rs-engine-results.json + discovery-cycle-results.json
 *   4. agent.composeAutoExploreFinding({material_id, whitespace, rs, analogy})
 *   5. Atomic write room/.mindrian/auto-explore-<material_id>.json, stamped
 *      with the session_id argv (explicit null when absent, Phase 237-06)
 *   6. store.markCompleted(roomSlug, material_id, {finding_count})
 *   7. Process exits 0
 *
 * Per Brain Section 8.7: LOCAL-only routing. The literal token
 * [Brain-only Cypher edge type, name elided to keep grep regression at zero]
 * never appears in this file (executable or comments).
 *
 * Per Canon Part 8: zero outbound network surface, zero Brain-MCP client
 * require (token elided per 117-02 plan AC bare-substring regression).
 *
 * Graph-native HARD RULES (memory feedback_reverse_salient_agent_graph_native.md):
 *   1. NEVER require room-db.cjs directly (Phase 109 D-06 chokepoint).
 *   2. Reads route through composeAutoExploreFinding (LOCAL-only compose).
 *   3. Writes route through explored-materials-store (markCompleted/markFailed)
 *      and atomic temp+rename for the finding JSON.
 *
 * Pure CJS, node built-ins + project libs. No new dependencies.
 *
 * DELTA vs Phase 116 preflight-tension-surface.cjs: 116 has no equivalent --
 * tensions surface synchronously from existing graph state without background
 * composition. Phase 117's auto-explore-fire.cjs runs HSI + RS + Cross-Domain
 * in parallel (~5-7s typical) and composes via canonical-order ranking.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const store = require('../lib/memory/explored-materials-store.cjs');
const agent = require('../lib/agents/auto-explore-agent.cjs');

// ---------- Constants ----------

const TOTAL_TIMEOUT_MS = 60000;       // hard cap for all subprocesses
const PIPELINE_TIMEOUT_MS = 30000;    // per-pipeline cap

// ---------- spawnAsync helper (timeout + capture) ----------

/**
 * Spawn a subprocess and resolve to {ok, code?, stdout, stderr, reason?}.
 *
 * Never throws. On any error path returns ok:false with a reason string.
 * On timeout, sends SIGKILL.
 */
function spawnAsync(cmd, args, opts) {
  return new Promise(function (resolve) {
    let child;
    try {
      child = spawn(cmd, args, Object.assign({ stdio: ['ignore', 'pipe', 'pipe'] }, opts || {}));
    } catch (err) {
      resolve({ ok: false, reason: String((err && err.message) || 'spawn_failed').slice(0, 80), stdout: '', stderr: '' });
      return;
    }
    let stdout = '';
    let stderr = '';
    let done = false;
    const timeoutMs = (opts && Number.isFinite(opts.timeout)) ? Number(opts.timeout) : PIPELINE_TIMEOUT_MS;
    const timer = setTimeout(function () {
      if (!done) {
        done = true;
        try { child.kill('SIGKILL'); } catch (_e) { /* ignore */ }
        resolve({ ok: false, reason: 'timeout', stdout: stdout, stderr: stderr });
      }
    }, timeoutMs);
    if (child.stdout) child.stdout.on('data', function (d) { stdout += String(d); });
    if (child.stderr) child.stderr.on('data', function (d) { stderr += String(d); });
    child.on('error', function (err) {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve({ ok: false, reason: String((err && err.message) || err).slice(0, 80), stdout: stdout, stderr: stderr });
      }
    });
    child.on('exit', function (code) {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve({ ok: code === 0, code: code, stdout: stdout, stderr: stderr });
      }
    });
  });
}

// ---------- Helpers ----------

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

/**
 * Wrap ensure-brain-baseline.cjs in a try-catch so a missing helper, broken
 * import, or thrown exception NEVER blocks the auto-explore fire pipeline.
 *
 * Returns the same shape as ensureBrainBaseline ({ensured, reason, fetched})
 * with graceful fallbacks per RESEARCH scenario 5.
 */
function ensureBrainBaselineSafe(roomDir) {
  try {
    const helper = require('./ensure-brain-baseline.cjs');
    if (typeof helper.ensureBrainBaseline !== 'function') {
      return { ensured: false, reason: 'helper_missing' };
    }
    return helper.ensureBrainBaseline(roomDir, { verbose: false });
  } catch (_e) {
    return { ensured: false, reason: 'helper_load_failed' };
  }
}

/**
 * Atomic write: write to <path>.tmp.<pid> then rename. Mirrors the pattern
 * from scripts/post-write::write_cascade_side_channel (lines 87-126).
 *
 * Returns true on success, false on any failure (caller is expected to fall
 * back to markFailed with suppress_reason='room_dir_not_writable').
 */
function atomicWriteJson(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmpPath = filePath + '.tmp.' + process.pid;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (_e) {
    return false;
  }
}

// ---------- main ----------

async function main() {
  const argv = process.argv.slice(2);
  const roomDir = String(argv[0] || '');
  const relativeFilePath = String(argv[1] || '');
  const material_id = String(argv[2] || '');
  // Phase 237-06 (REACH-03): 4th argv, missing/empty/non-string all treat as
  // absent (a direct 3-argv invocation must degrade cleanly, not crash).
  const sessionIdArg = argv[3];
  const session_id = (typeof sessionIdArg === 'string' && sessionIdArg.length > 0) ? sessionIdArg : null;

  if (!roomDir || !material_id) {
    process.exit(0);
  }

  const roomSlug = path.basename(roomDir);

  try {
    // Step 1: Ensure Brain baseline (graceful degradation per RESEARCH scenario 5).
    const baseline = ensureBrainBaselineSafe(roomDir);
    const brainBaselinePresent = !!(baseline && baseline.ensured === true);

    // Step 2: Run pipelines in parallel.
    const repoRoot = path.resolve(__dirname, '..');
    const discoveryScript = path.join(repoRoot, 'scripts', 'discovery-cycle.cjs');
    const rsScript = path.join(repoRoot, 'scripts', 'rs-engine.py');
    const env = Object.assign({}, process.env);

    const promises = [];
    if (fs.existsSync(discoveryScript)) {
      promises.push(spawnAsync('node', [discoveryScript, roomDir, '--steps', 'all'], {
        env: env,
        timeout: PIPELINE_TIMEOUT_MS,
      }));
    } else {
      promises.push(Promise.resolve({ ok: false, reason: 'discovery_cycle_missing' }));
    }
    // Plan 296-05 (SEED-030): this spawn bypasses lib/core/rs-backend-dispatch.cjs,
    // which that module's own header (lines 38-44) already flags as the unfinished
    // Phase 272-10 wiring -- tests/272-dispatch-chokepoint.sh and
    // tests/272-rule6-amended.sh stay RED by design until that wiring lands.
    //
    // Phase 296 deliberately did NOT complete that wiring here. Reason:
    // rs-backend-dispatch.cjs's resolveBackend() defaults to 'cjs', and
    // lib/core/rs-engine.cjs (the CJS port) implements Mode A internal ONLY.
    // Routing this --mode hybrid spawn through the chokepoint today would land
    // hybrid on a backend that cannot serve it. Completing 272-10 for this
    // caller needs Mode C in CJS first, which is a later phase's job.
    //
    // Phase 296 DID change what this spawn's Mode C path does underneath: the
    // external corpus scripts/rs-engine.py's hybrid mode reads is now a
    // per-room local sidecar cache (lib/core/rs_cache.py) instead of a
    // Pinecone namespace, and PINECONE_API_KEY is no longer required for it.
    //
    // This spawn's failure is swallowed into markFailed(..., 'all_pipelines_empty')
    // below, so a break here shows up as rising auto_explore_skipped telemetry
    // rather than a visible error -- which is why tests/296-blast-radius.test.cjs
    // fences the argv contract between this spawn and rs-engine.py's parser.
    if (fs.existsSync(rsScript)) {
      promises.push(spawnAsync('python3', [rsScript, '--mode', 'hybrid', '--room', roomDir, '--topk', '5'], {
        env: env,
        timeout: PIPELINE_TIMEOUT_MS,
      }));
    } else {
      promises.push(Promise.resolve({ ok: false, reason: 'rs_engine_missing' }));
    }

    const results = await Promise.all(promises);
    const discoveryOk = !!(results[0] && results[0].ok);
    const rsOk = !!(results[1] && results[1].ok);

    if (!discoveryOk && !rsOk) {
      // Both pipelines failed -- graceful degradation per RESEARCH scenarios 4 + 6.
      // Suppress with all_pipelines_empty (the canonical reason for "ran but no
      // candidates produced"); this is more informative for Phase 121 telemetry
      // than the lower-level 'discovery_cycle_missing' / 'rs_engine_missing'.
      try { store.markFailed(roomSlug, material_id, 'all_pipelines_empty'); } catch (_e) { /* ignore */ }
      // Phase 117-05 telemetry: suppression path emits auto_explore_skipped.
      try { agent.emitSkipped(roomDir, { material_id: material_id, suppress_reason: 'all_pipelines_empty', tier: 1 }); } catch (_e) { /* ignore */ }
      process.exit(0);
    }

    // Step 3: Read pipeline output JSONs.
    const wsResultsPath = path.join(roomDir, '.mindrian', 'whitespace-results.json');
    const rsResultsPath = path.join(roomDir, '.mindrian', '.rs-engine-results.json');
    const dcResultsPath = path.join(roomDir, '.mindrian', 'discovery-cycle-results.json');
    const whitespace = readJsonSafe(wsResultsPath) || {};
    const rs = readJsonSafe(rsResultsPath) || {};
    const dc = readJsonSafe(dcResultsPath) || {};
    // Analogy comes from discovery-cycle's analogy_whitespace block.
    const analogy = (dc && dc.analogy_whitespace) || {};

    // Step 4: Compose top finding (canonical chain order + cross-domain formula).
    const finding = agent.composeAutoExploreFinding({
      material_id: material_id,
      whitespace: whitespace,
      rs: rs,
      analogy: analogy,
    });

    if (!finding) {
      try { store.markFailed(roomSlug, material_id, 'all_pipelines_empty'); } catch (_e) { /* ignore */ }
      // Phase 117-05 telemetry: suppression path emits auto_explore_skipped.
      try { agent.emitSkipped(roomDir, { material_id: material_id, suppress_reason: 'all_pipelines_empty', tier: 1 }); } catch (_e) { /* ignore */ }
      process.exit(0);
    }

    // Phase 237-06 (REACH-03): stamp the session that reached this writer
    // via argv onto the finding as a CONTENT field, explicit null when
    // absent -- matches scripts/post-write's last-cascade.json shape so
    // both markers present one contract to the reader
    // (lib/core/insight-sensors.cjs::isMarkerOwnedByCaller).
    finding.session_id = session_id;

    // Phase 119-02 Task 3 (REVISION 2026-05-16): wire scaffoldRoomSkeleton into
    // the auto-explore-fire success path so the placeholder room created by
    // Plan 119-00's autoCreatePlaceholderRoom gets its STATE.md + MINTO.md +
    // USER.md + 8 ICM section folders + 5 identity-directory ROOM.md files
    // materialized BEFORE the auto-explore finding JSON is consumable. The
    // wiring is reentrancy-guarded so a re-fire against an already-scaffolded
    // room is a no-op.
    //
    // Canon Part 9: scaffold writes files only -- no graph writes from here;
    // the room_auto_created memory_event fires from Plan 119-00 (the caller).
    // Canon Part 10 sub-claim 3: rooms are receipts -- the receipt's substrate
    // materializes the instant the auto-explore finding lands.
    // Graceful-degradation: skeleton-scaffold failure logs to stderr but does
    // NOT regress the auto-explore pipeline (Phase 117 `exit 0 always` invariant).
    if (!fs.existsSync(path.join(roomDir, 'STATE.md'))) {
      try {
        const { scaffoldRoomSkeleton } = require('../lib/core/room-skeleton-scaffold.cjs');
        scaffoldRoomSkeleton(roomDir, {
          placeholder_slug: path.basename(roomDir),
          source_material_id: material_id,
          auto_explore_finding: finding,
        });
      } catch (scaffoldErr) {
        process.stderr.write('[auto-explore-fire] room-skeleton-scaffold failed (non-fatal): ' +
          String(scaffoldErr && scaffoldErr.message || scaffoldErr).slice(0, 120) + '\n');
      }
    }

    // Phase 117-05 telemetry: a finding emerged -- the natural trigger point
    // to surface the FourLenses (Brain) vs FiveLenses (Canon) drift signal
    // per Brain Section 8.6 + AUTOEXPLORE-117-18. Idempotent within session
    // via in-memory cache; safe to call from every fire invocation.
    try { agent.emitBrainCanonDrift(roomDir); } catch (_e) { /* ignore */ }

    // Step 5: Write finding JSON to room/.mindrian/auto-explore-<material_id>.json.
    const findingPath = path.join(roomDir, '.mindrian', 'auto-explore-' + material_id + '.json');
    const wrote = atomicWriteJson(findingPath, finding);
    if (!wrote) {
      try { store.markFailed(roomSlug, material_id, 'room_dir_not_writable'); } catch (_e) { /* ignore */ }
      // Phase 117-05 telemetry: suppression path emits auto_explore_skipped.
      try { agent.emitSkipped(roomDir, { material_id: material_id, suppress_reason: 'room_dir_not_writable', tier: 1 }); } catch (_e) { /* ignore */ }
      process.exit(0);
    }

    // Step 6: Mark completed in ledger.
    try {
      store.markCompleted(roomSlug, material_id, {
        finding_count: 1,
        brain_baseline_present: brainBaselinePresent,
      });
    } catch (_e) { /* ignore */ }

    // Phase 213 SENS-13 producer -- material filed -> bridge scan -> side-channel;
    // the sensor (not this script) decides firing; decide() (not the sensor)
    // decides surfacing; the navigator (not decide()) decides acting. ADDITIVE,
    // OPT-IN, fire-and-forget: the runner probes the LIVE 212 critic for guard
    // availability, and honestly degrades (writes nothing) when the guard or the
    // candidate substrate is absent -- so default behavior is byte-identical when
    // the eureka substrate is absent. A runner fault can NEVER change this
    // script's exit code or its own finding write (the Phase 117 exit-0
    // discipline holds on every path; threat T-213-07).
    try {
      // eslint-disable-next-line global-require
      const eurekaRunner = require('../lib/core/eureka/eureka-reach-runner.cjs');
      eurekaRunner.runEurekaScan({ roomDir: roomDir }).catch(function () { /* swallow */ });
    } catch (_e) { /* ignore: additive seam, never regress the exit-0 discipline */ }

    process.exit(0);
  } catch (_e) {
    // Outer catch -- never let an exception escape; mark failed and exit 0.
    try { store.markFailed(roomSlug, material_id, 'ledger_replay_failed'); } catch (_e2) { /* ignore */ }
    // Phase 117-05 telemetry: outer-catch emits auto_explore_skipped with ledger_replay_failed.
    try { agent.emitSkipped(roomDir, { material_id: material_id, suppress_reason: 'ledger_replay_failed', tier: 1 }); } catch (_e2) { /* ignore */ }
    process.exit(0);
  }
}

// uncaughtException backstop: never let a crash leave the parent ledger in
// an undefined state. We always exit 0 to keep PostToolUse hooks happy.
process.on('uncaughtException', function () {
  try { process.exit(0); } catch (_e) { /* ignore */ }
});
process.on('unhandledRejection', function () {
  try { process.exit(0); } catch (_e) { /* ignore */ }
});

main();
