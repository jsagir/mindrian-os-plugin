#!/usr/bin/env node
/**
 * graph-heal-pipeline.cjs -- the ordered 4-stage graph heal pipeline (Phase 233-03)
 * =================================================================================
 *
 * WHY THIS EXISTS
 * ---------------
 * The RCA at .planning/debug/graph-derive-silent-clear-dead-api-derivation.md
 * (Section 9, "Required-change addendum") found that healing a damaged room is not
 * one action but FOUR, and that running them out of order silently produces
 * nothing. Each stage consumes what the previous stage produced:
 *
 *   1. structural-index  Every real artifact on disk becomes an Artifact node.
 *                        Defect #5: motj had 33 nodes for ~70 files on disk.
 *   2. hsi-score         Similarity scoring, SCOPED to the node set stage 1 just
 *                        wrote. Defect #4: unscoped, it ranked .snapshots and
 *                        sub-rooms state dumps as its top 20 "discoveries".
 *   3. hsi-to-graph      Writes HSI_CONNECTION / REVERSE_SALIENT edges. It
 *                        refuses any pair whose endpoint is not an Artifact node,
 *                        so without stage 1 it writes ZERO edges and says so in a
 *                        line nobody reads. That is the false-success shape this
 *                        phase exists to close.
 *   4. cascade-derive    The generative tier (CONTRADICTS / INVALIDATES /
 *                        ENABLES), which needs the nodes AND wants the semantic
 *                        edges already in place.
 *
 * The ordering is the product, not an implementation detail. Tiers 1-3 need NO
 * model at all; only tier 4 does, and it prefers a LOCAL producer (Canon Part 8).
 *
 * REUSE, NOT REIMPLEMENTATION (Canon Part 7)
 * ------------------------------------------
 * Every stage is an EXISTING, already-audited implementation. This file
 * contributes ORDER and nothing else. It writes no edges, opens no db of its own
 * beyond stage 1's rebuild, and adds zero dependencies.
 *
 * NOT ON THE WRITE PATH
 * ---------------------
 * This is navigator-triggered only. It is deliberately NOT wired into the
 * SessionStart / Stop hooks: stage 2 loads a sentence-transformer model, which is
 * heavy, and the repo already fixed this trade-off once for the same class of work
 * (see BACKFILL_PAIR_CHUNK in lib/core/graph-backfill.cjs). A heal is something a
 * navigator asks for, not something a keystroke pays for.
 *
 * SOFT-FAIL BY DESIGN
 * -------------------
 * runHealPipeline never throws. Each stage is independently wrapped, so a missing
 * python3 degrades exactly ONE stage (hsiSkipped) instead of losing the structural
 * index and the cascade tier that do not need python at all (T-233-10).
 *
 * Soft-fail is not the same as run-anyway. Stages 2 and 3 consume what stage 1
 * produces, so they are GATED on stage 1 having actually succeeded: run against a
 * failed index they do not error, they succeed over nothing, which reports ok and
 * heals zero. Stage 4 is deliberately NOT gated, because its own internal rebuild
 * is the last line of defense when stage 1 could not index the room.
 *
 * Usage:
 *   node scripts/graph-heal-pipeline.cjs /path/to/room
 *   const { runHealPipeline } = require('./scripts/graph-heal-pipeline.cjs');
 *
 * LOCAL only. No network. No em-dashes.
 */

'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

/**
 * The stage names, in the RCA-mandated execution order. Declared ONCE here and
 * exported, so a caller (and the regression test) asserts against this array
 * rather than against log prose.
 */
const STAGE_ORDER = Object.freeze([
  'structural-index',
  'hsi-score',
  'hsi-to-graph',
  'cascade-derive',
]);

/**
 * Stage 2 default budget. The HSI stage loads a local embedding model and then
 * runs an O(n^2) similarity pass, which on a real room is minutes, not seconds,
 * so a tight timeout would turn a healthy heal into a phantom failure. Fifteen
 * minutes is generous enough for the largest rooms observed in the RCA evidence
 * and still bounded, so a wedged interpreter degrades one stage instead of
 * hanging the pipeline forever (T-233-10). Override per call via
 * opts.hsiTimeoutMs, or per environment via MINDRIAN_HSI_TIMEOUT_MS.
 */
const DEFAULT_HSI_TIMEOUT_MS = 15 * 60 * 1000;

function _resolveTimeoutMs(opts) {
  if (opts && Number.isFinite(opts.hsiTimeoutMs) && opts.hsiTimeoutMs > 0) {
    return opts.hsiTimeoutMs;
  }
  const env = Number(process.env.MINDRIAN_HSI_TIMEOUT_MS);
  if (Number.isFinite(env) && env > 0) return env;
  return DEFAULT_HSI_TIMEOUT_MS;
}

/**
 * Run a child stage. argv is always an ARRAY, never an interpolated string, so a
 * room path carrying shell metacharacters cannot inject a command (T-233-12).
 * Returns { ok, detail } and never throws.
 */
function _spawnStage(bin, argv, timeoutMs) {
  let res;
  try {
    res = spawnSync(bin, argv, {
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (e) {
    return { ok: false, detail: 'spawn threw: ' + e.message };
  }
  if (res.error) {
    return { ok: false, detail: 'spawn error: ' + res.error.message };
  }
  if (res.signal) {
    return { ok: false, detail: 'terminated by signal ' + res.signal + ' (timeout ' + timeoutMs + 'ms)' };
  }
  if (res.status !== 0) {
    const tail = String(res.stderr || '').trim().split('\n').slice(-2).join(' | ');
    return { ok: false, detail: 'exit ' + res.status + (tail ? ': ' + tail : '') };
  }
  const tail = String(res.stderr || '').trim().split('\n').slice(-1).join('');
  return { ok: true, detail: tail || 'ok' };
}

/**
 * runHealPipeline(roomDir, opts) -> Promise<{ roomDir, stages, hsiSkipped }>
 *
 * stages is an array of { name, ok, detail } in STAGE_ORDER. Never throws.
 *
 * opts (all optional):
 *   pythonBin        interpreter for stage 2 (default: MINDRIAN_PYTHON or python3)
 *   nodeBin          interpreter for stage 3 (default: this process's own node)
 *   hsiTimeoutMs     stage 2 budget (see DEFAULT_HSI_TIMEOUT_MS)
 *   skipHsi          true skips stages 2 and 3 (a caller that knows the embedding
 *                    stack is absent should not pay two spawns to find out)
 *   deriveFn,
 *   selfCritiqueFn,
 *   probeOpts,
 *   approvedBy,
 *   approveFolders   forwarded VERBATIM to runDeriveBackfill. This is how a test
 *                    pins stage 4 to a deterministic producer while still running
 *                    the REAL stage-4 implementation, rather than stubbing the
 *                    stage out and proving nothing about the integration.
 */
async function runHealPipeline(roomDir, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const resolvedRoom = path.resolve(String(roomDir || ''));
  const stages = [];
  let hsiSkipped = false;
  let structuralOk = false;

  // --- Stage 1: structural index -------------------------------------------
  // Identical open -> rebuild -> close shape to _rebuildRoom in
  // lib/core/graph-backfill.cjs. Deliberately NOT diverged from it: two
  // structural-index paths that drift is the exact failure mode Phase 200-01
  // fixed on the python side and this phase just fixed again on compute-hsi.py.
  //
  // Stage 4 also rebuilds internally, which looks redundant and is not: stage 2
  // reads the node set through --scope-to-nodes, so the nodes must exist BEFORE
  // the HSI pass, not merely before the cascade tier.
  {
    let detail = '';
    let ok = false;
    try {
      const { openGraph, rebuildGraph, closeGraph } = require('../lib/core/lazygraph-ops.cjs');
      const { db, conn } = await openGraph(resolvedRoom);
      try {
        const r = await rebuildGraph(conn, resolvedRoom);
        detail = (r && typeof r.artifacts === 'number')
          ? (r.artifacts + ' artifacts, ' + r.sections + ' sections, ' + (r.subRooms || 0) + ' sub-rooms')
          : 'rebuilt';
        ok = true;
      } finally {
        await closeGraph(db);
      }
    } catch (e) {
      ok = false;
      detail = e && e.message ? e.message : String(e);
    }
    structuralOk = ok;
    stages.push({ name: 'structural-index', ok: ok, detail: detail });
  }

  // --- Stage 2: scoped HSI --------------------------------------------------
  // A child process, not a require: compute-hsi.py is python. A non-zero exit is
  // the EXPECTED outcome when numpy / scikit-learn / the local embedding model
  // are absent, which is an environment fact and not a heal failure, so it is
  // recorded as skipped and the pipeline continues.
  //
  // WR-02: stage 2 is GATED on stage 1 having actually succeeded, the same way
  // stage 4's skipRebuild already is. Ungated, a failed stage 1 left stage 2
  // scoping --scope-to-nodes against whatever node set happened to be in room.db.
  // When that set is EMPTY (a fresh db, or a db left in a pre-rebuild state),
  // load_graph_artifact_ids returns an empty SET rather than None, which is a
  // SUCCESSFUL query and so never reaches compute-hsi.py's permissive
  // score-everything degrade path. main() then filters the artifact list down to
  // nothing, the "< 2 artifacts" guard writes an EMPTY .hsi-results.json, and the
  // script exits 0. _spawnStage reads exit 0 as ok:true, so the run reported
  // { name: 'hsi-score', ok: true } over a pass that scored nothing. That is the
  // same false-success shape the stage-4 wipe defect took, one stage earlier.
  if (o.skipHsi) {
    hsiSkipped = true;
    stages.push({ name: 'hsi-score', ok: true, skipped: true, detail: 'skipped by caller (opts.skipHsi)' });
  } else if (!structuralOk) {
    hsiSkipped = true;
    stages.push({
      name: 'hsi-score',
      ok: false,
      skipped: true,
      detail: 'skipped: stage 1 (structural-index) failed, so --scope-to-nodes has no node set to scope to',
    });
  } else {
    const pythonBin = o.pythonBin || process.env.MINDRIAN_PYTHON || 'python3';
    const hsiScript = path.join(__dirname, 'compute-hsi.py');
    const r = _spawnStage(pythonBin, [hsiScript, resolvedRoom, '--scope-to-nodes'], _resolveTimeoutMs(o));
    if (!r.ok) {
      hsiSkipped = true;
      stages.push({ name: 'hsi-score', ok: false, skipped: true, detail: r.detail });
    } else {
      stages.push({ name: 'hsi-score', ok: true, detail: r.detail });
    }
  }

  // --- Stage 3: write the HSI edges ----------------------------------------
  // Also a child process, and for a structural reason rather than taste:
  // scripts/hsi-to-graph.cjs calls main() at module load and exports nothing, so
  // requiring it would run it as an import side effect with no way to pass the
  // room. It already exits silently when .hsi-results.json is absent, which is
  // exactly the right behavior when stage 2 skipped.
  //
  // WR-02: gated on stage 1 for a second, distinct reason. hsi-to-graph reads
  // .hsi-results.json off disk, and that file can be a STALE artifact of an
  // earlier run. With stage 1 failed and stage 2 skipped, running it would write
  // edges derived from a node set that no longer describes the room.
  if (o.skipHsi) {
    stages.push({ name: 'hsi-to-graph', ok: true, skipped: true, detail: 'skipped by caller (opts.skipHsi)' });
  } else if (!structuralOk) {
    stages.push({
      name: 'hsi-to-graph',
      ok: false,
      skipped: true,
      detail: 'skipped: stage 1 (structural-index) failed; a stale .hsi-results.json must not be written as edges',
    });
  } else {
    const nodeBin = o.nodeBin || process.execPath;
    const edgeScript = path.join(__dirname, 'hsi-to-graph.cjs');
    const r = _spawnStage(nodeBin, [edgeScript, resolvedRoom], _resolveTimeoutMs(o));
    stages.push({ name: 'hsi-to-graph', ok: r.ok, detail: r.detail });
  }

  // --- Stage 4: the cascade / generative tier ------------------------------
  // The existing runDeriveBackfill on its already-LOCAL score-based producer
  // default (pinned by Plan 233-02). Its return is polymorphic (object on an
  // injected SYNC producer, Promise on the default async path), so it is awaited
  // unconditionally.
  //
  // skipRebuild is the ONE thing this pipeline tells stage 4 to do differently,
  // and it is a correctness requirement discovered by a live run on the RCA's own
  // evidence room, not a tuning knob. Stage 4's internal structural rebuild is a
  // DELETE FROM edges; DELETE FROM nodes; then reindex. Left on, it deletes the
  // HSI_CONNECTION edges stage 3 wrote seconds earlier: the pipeline printed
  // "wrote 20 connection edges" and the room finished with zero. That is the
  // silent-clear failure shape this whole phase exists to close, reproduced
  // inside the fix itself.
  //
  // It is suppressed ONLY when stage 1 actually succeeded (otherwise nothing
  // indexed the room and stage 4's rebuild is the last line of defense) and only
  // when the caller did not ask for folder healing (approvedBy can mint a NEW
  // child room after stage 1 ran, and that child still needs its first index).
  {
    let detail = '';
    let ok = false;
    try {
      const { runDeriveBackfill } = require('../lib/core/graph-backfill.cjs');
      const args = { roomDir: resolvedRoom };
      for (const k of ['deriveFn', 'selfCritiqueFn', 'probeOpts', 'approvedBy', 'approveFolders']) {
        if (o[k] !== undefined) args[k] = o[k];
      }
      if (structuralOk && o.approvedBy === undefined) args.skipRebuild = true;
      const r = await runDeriveBackfill(args);
      const before = r && typeof r.typedEdgesBefore === 'number' ? r.typedEdgesBefore : 0;
      const after = r && typeof r.typedEdgesAfter === 'number' ? r.typedEdgesAfter : 0;
      detail = 'typed edges ' + before + ' -> ' + after
        + (r && r.skipped ? ' (skipped: ' + r.skipped + ')' : '');
      ok = true;
    } catch (e) {
      ok = false;
      detail = e && e.message ? e.message : String(e);
    }
    stages.push({ name: 'cascade-derive', ok: ok, detail: detail });
  }

  return { roomDir: resolvedRoom, stages: stages, hsiSkipped: hsiSkipped };
}

module.exports = { runHealPipeline, STAGE_ORDER, DEFAULT_HSI_TIMEOUT_MS };

// --- CLI ------------------------------------------------------------------
if (require.main === module) {
  const roomDir = process.argv[2];
  if (!roomDir) {
    process.stderr.write('Usage: node scripts/graph-heal-pipeline.cjs /path/to/room\n');
    process.exit(1);
  }
  runHealPipeline(roomDir).then((summary) => {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    // A skipped stage is not a failure: the whole point of the soft-fail design
    // is that an absent embedding stack still leaves a healed structural index.
    const hardFail = summary.stages.some((s) => s.ok === false && s.skipped !== true);
    process.exit(hardFail ? 1 : 0);
  }).catch((e) => {
    // Defensive only: runHealPipeline is contractually non-throwing.
    process.stderr.write('graph-heal-pipeline: ' + (e && e.message ? e.message : String(e)) + '\n');
    process.exit(1);
  });
}
