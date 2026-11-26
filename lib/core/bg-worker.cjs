'use strict';

/*
 * lib/core/bg-worker.cjs -- worker caps for detached background workers.
 *
 * Origin: Phase 379.1 (CPU379-03, D-379.1-13), first written in
 * scripts/gsd-graph-derive-drain.cjs. Phase 367 (design 5.2 step 3) moved
 * both functions here so the derive drain and the graph catch-up runner
 * (scripts/graph-catchup.cjs) share one copy. The drain re-exports them in
 * its _test surface.
 *
 * No network, no Brain (Canon Part 8). No em-dashes.
 */

// Lower the worker's scheduling priority so a drain yields to the user's hooks and
// editor. Never raises it back; a failure (EACCES, an unsupported platform) is
// ignored, because the thread cap and the budget are the real controls.
function lowerWorkerPriority() {
  try {
    const os = require('node:os');
    const prio = process.platform === 'win32'
      ? os.constants.priority.PRIORITY_BELOW_NORMAL
      : os.constants.priority.PRIORITY_LOW;
    os.setPriority(0, prio);
    return true;
  } catch (_e) {
    return false;
  }
}

// The backstop ends an idle or async stall (an await that never resolves, a hung
// encoder promise). It CANNOT interrupt a synchronous loop on the same thread.
// Every synchronous loop the worker runs is therefore deadline-checked from the
// inside: the cosine pass in buildCandidatePairs checks the deadline per row, the
// scoring loop checks it between pairs and yields on every await, the embed loop
// checks it between batches, and runDerivation is bounded by the slice (at most
// resolveMaxPairsPerDrain() pairs). A parent-side kill timeout on the per-write
// spawn is not added: that spawn is detached, stdio ignored and unref'd
// (intelligence-cascade.cjs), so the parent exits without waiting and holds no timer;
// the release leg (Plan 06) has a parent-side spawnSync timeout as the hard limit.
function armBackstop(ms) {
  const t = setTimeout(() => { process.exit(0); }, ms);
  if (t && typeof t.unref === 'function') t.unref();
  return t;
}

module.exports = {
  lowerWorkerPriority,
  armBackstop,
};
