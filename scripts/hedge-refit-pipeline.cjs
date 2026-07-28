#!/usr/bin/env node
/**
 * hedge-refit-pipeline.cjs -- the explicit navigator-triggered Hedge weight refit
 * =================================================================================
 *
 * WHY THIS EXISTS
 * ---------------
 * The RCA at .planning/debug/resolved/hedge-fold-has-no-production-trigger.md
 * found that the Phase 222 Hedge outcome-learning fold has never fired on any
 * install, because no production caller ever threaded a live db handle into the
 * ranking call that used to invoke it: ctx.roomDb is set from exactly one place
 * repo-wide and that place is a test. Every production caller left db null, so
 * maybeUpdateHedgeWeights short-circuited on its first line, forever. The failure
 * was invisible by construction: an empty ranker_weights table is
 * indistinguishable from a correct cold start, and nothing outside the ranker
 * reads that table, so there was no consumer to raise an alarm. This file is the
 * trigger the fold never had.
 *
 * REUSE, NOT REIMPLEMENTATION (Canon Part 7)
 * ------------------------------------------
 * The fold itself is the shipped lib/workflow/reach-hedge-ranker.cjs::
 * maybeUpdateHedgeWeights, called verbatim. This file contributes a TRIGGER and
 * nothing else: it computes no losses, applies no MWU step, and writes no weights
 * of its own. Every read and every write still goes through the
 * lib/core/navigation.cjs chokepoint (Canon Part 9), and this file adds zero
 * dependencies.
 *
 * NOT ON THE WRITE PATH
 * ---------------------
 * Navigator-triggered only, the same Phase 233-03 discipline
 * scripts/graph-heal-pipeline.cjs already established. Never registered in
 * hooks/hooks.json, never called from decide(), never called from an MCP tool
 * handler. A refit is something a navigator asks for, not something a turn or a
 * poll pays for. That is also what keeps the fold's 500-row training query and
 * its write lock off every live turn, which is the load profile quick task
 * 260728-7kc just removed from the MCP pull path.
 *
 * SOFT-FAIL BY DESIGN
 * -------------------
 * runHedgeRefit never throws. A room with no room.db reports skipped, not an
 * error: a Tier 0 room with nothing to refit is an environment fact, exactly as
 * an absent python3 is in the heal pipeline. A room below the debounce threshold
 * reports updated:false, which is the debounce working. Both exit 0. Any
 * unexpected throw is caught, reported through ok:false, and the handle still
 * closes.
 *
 * CANON PART 11
 * -------------
 * A scripts/*.cjs file is not one of the four declaring classes (commands,
 * agents, pipeline CHAIN.md, qualifying SKILL.md) that scripts/check-shape-
 * declaration.cjs scans, so no hitl_shape declaration is required or possible
 * here. This matches scripts/graph-heal-pipeline.cjs, which carries none either.
 * Recorded here so a future reader does not think it was forgotten. Minting a
 * /mos:* wrapper WOULD create a declaring surface, and is a separate decision,
 * exactly as wiring --heal-room to the heal pipeline was left separate in 233-03.
 *
 * ONE STAGE, ON PURPOSE
 * ----------------------
 * Unlike the 4-stage heal pipeline this file borrows its trigger discipline from,
 * a Hedge refit is a single fold with no ordering dependency on other stages.
 * What carries over from Phase 233-03 is the "navigator-triggered, never on the
 * write path" discipline, not the multi-stage shape.
 *
 * Usage:
 *   node scripts/hedge-refit-pipeline.cjs /path/to/room
 *   const { runHedgeRefit } = require('./scripts/hedge-refit-pipeline.cjs');
 *
 * LOCAL only. No network. No em-dashes.
 */

'use strict';

const path = require('path');
const navigation = require('../lib/core/navigation.cjs');
const { maybeUpdateHedgeWeights } = require('../lib/workflow/reach-hedge-ranker.cjs');

/**
 * The ONLY caller options forwarded into the shipped fold. Declared once and
 * exported so a caller (and a future test) asserts against this array rather
 * than against log prose, and copied key by key (the graph-heal-pipeline.cjs
 * explicit key-forward shape) so a caller object can never smuggle an unrelated
 * field into the fold.
 */
const FOLD_OPT_KEYS = Object.freeze(['updateN', 'eta', 'reachScores']);

/**
 * runHedgeRefit(roomDir, opts) -> { roomDir, ok, updated, updateCount, weights, skipped, detail }
 *
 * Synchronous: unlike runHealPipeline there is no child spawn and nothing to
 * await, maybeUpdateHedgeWeights is itself sync. Never throws.
 *
 *   ok           false only on an unexpected throw. A skipped room and a
 *                debounced room are both ok:true.
 *   updated      whether THIS invocation folded and persisted a new state.
 *   updateCount,
 *   weights      read back from PERSISTED state through the chokepoint, so the
 *                report describes what is actually on disk rather than what one
 *                call claimed to do.
 *   skipped      'no_room_db' when the room has no database to refit, else null.
 *   detail       a short status string (this file uses detail throughout,
 *                matching the heal pipeline; there is no field named otherwise).
 *
 * opts (all optional, see FOLD_OPT_KEYS):
 *   updateN       debounce bound override (default HEDGE_UPDATE_N_DEFAULT)
 *   eta           Hedge learning rate override (default HEDGE_ETA_DEFAULT)
 *   reachScores   historical D4 prior map, when the caller has one
 */
function runHedgeRefit(roomDir, opts) {
  const resolvedRoom = path.resolve(String(roomDir || ''));
  const o = (opts && typeof opts === 'object') ? opts : {};

  const db = navigation.openRoomDbForCaller(resolvedRoom);
  if (!db) {
    // A Tier 0 room with no room.db yet has nothing to refit. This is an
    // environment fact, not a failure: openRoomDbForCaller REFUSES to create,
    // which is exactly the behavior this entry point wants (a refit must never
    // be the reason a fresh room's .mindrian/ directory gets born).
    return {
      roomDir: resolvedRoom,
      ok: true,
      updated: false,
      updateCount: null,
      weights: null,
      skipped: 'no_room_db',
      detail: 'no room.db at this path',
    };
  }

  try {
    // Copy ONLY the keys the fold reads. Never forward the whole caller object,
    // the same explicit key-forward discipline graph-heal-pipeline.cjs uses for
    // runDeriveBackfill's opts.
    const foldOpts = {};
    for (const k of FOLD_OPT_KEYS) {
      if (o[k] !== undefined) foldOpts[k] = o[k];
    }

    let ok = true;
    let updated = false;
    let detail = '';
    try {
      const foldResult = maybeUpdateHedgeWeights(db, foldOpts);
      // Whether THIS invocation folded is the fold's own return value, not a
      // fact derivable from persisted state alone (a room refit before, then
      // called again below debounce, already carries a non-zero updateCount,
      // which would falsely read as "updated" this time if inferred from state).
      updated = !!(foldResult && foldResult.updated === true);
      detail = updated ? 'refit applied' : 'below the debounce threshold, nothing refit';
    } catch (e) {
      // maybeUpdateHedgeWeights is itself contractually non-throwing, but this
      // entry point does not trust that from the outside: any surprise here is
      // caught, reported, and the handle below still closes.
      ok = false;
      detail = e && e.message ? e.message : String(e);
    }

    // updateCount and weights are reported from PERSISTED state, not from the
    // fold's own return value, so the summary describes what is actually on disk.
    let state = null;
    try {
      state = navigation.readHedgeWeightState(db);
    } catch (e) {
      ok = false;
      detail = e && e.message ? e.message : String(e);
      state = null;
    }

    return {
      roomDir: resolvedRoom,
      ok: ok,
      updated: updated,
      updateCount: state ? state.updateCount : null,
      weights: state ? state.weights : null,
      skipped: null,
      detail: detail,
    };
  } catch (e) {
    return {
      roomDir: resolvedRoom,
      ok: false,
      updated: false,
      updateCount: null,
      weights: null,
      skipped: null,
      detail: e && e.message ? e.message : String(e),
    };
  } finally {
    // The handle is opened and closed here and never handed to a caller, so a
    // thrown read can never leak it (T-8AV-03).
    navigation.closeRoomDbForCaller(db);
  }
}

module.exports = { runHedgeRefit, FOLD_OPT_KEYS };

// --- CLI --------------------------------------------------------------------
if (require.main === module) {
  const roomDir = process.argv[2];
  if (!roomDir) {
    process.stderr.write('Usage: node scripts/hedge-refit-pipeline.cjs /path/to/room\n');
    process.exit(1);
  }
  const summary = runHedgeRefit(roomDir);
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  // A skipped room and a debounced room are BOTH exit 0: neither is a failure.
  process.exit(summary.ok === false ? 1 : 0);
}
