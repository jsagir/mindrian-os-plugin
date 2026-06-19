'use strict';
/*
 * Phase 165 Wave-0 RED stub -- test-unknowns-resume (D-165-09).
 *
 * GREEN assertion (Wave 3 turns this on; sourced from 165-VALIDATION.md +
 * 165-RESEARCH section 1.6, the resumable per-pull checkpoint):
 *   An interrupted-then-resumed scan is BYTE-IDENTICAL to an uninterrupted scan:
 *   same corpusHash, same pull order, same findings, same cumulativeUtility. The
 *   checkpoint (the CHECKPOINT_SHAPE / CHECKPOINT_ARM_SHAPE in the shared iface)
 *   is written per pull; on resume, if corpusHash matches, the scan continues from
 *   `pull`; if it differs (a dirty corpus), it starts a FRESH scan. No Date.now in
 *   the checkpoint key (deterministic; scanId keys the sidecar so a re-run is a
 *   cache hit), Pitfall 4 (non-deterministic resume) guarded.
 *
 * The module lib/core/unknowns/bandit.cjs (checkpoint save/resume) does not exist
 * yet. RED until Wave 3.
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */
const MODULE = '../lib/core/unknowns/bandit.cjs';
try {
  require(MODULE);
} catch (_e) {
  console.error('RED: lib/core/unknowns/bandit.cjs checkpoint resume not yet implemented (plan 03)');
  process.exit(1);
}
console.error('RED: resume loaded but the byte-identical-resume assertion is not wired yet (plan 03)');
process.exit(1);
