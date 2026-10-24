'use strict';
/*
 * lib/core/icm-eval-freshness.cjs -- the ONE rule for "is the ICM ruling eval
 * record fresh enough for the running plugin version?"
 *
 * Used by the doctor point icm-ruling-eval-fresh (scripts/doctor.cjs).
 *
 * Why BETAS_PER_RELEASE is 2 (beta.73 incident, phase 379.1.1 plan 05):
 * the old inline rule allowed the record to lag the running version by at
 * most 1 beta. One release moves the repo version by TWO betas: the cut at
 * release.sh Step 3 (bump to the cut version) and the next-bump at Step 7.5
 * (commit B, bump to the next pre-release). The full doctor at Step 9.8 runs
 * AFTER both. A record stamped at the dev version P was therefore 2 behind
 * at Step 9.8 of the next cut, and the point failed after the publish.
 * "Not more than one release behind" therefore means at most 2 betas.
 *
 * Shape rules (ported from the old inline code):
 *   - Both versions are X.Y.Z-beta.N with the same X.Y.Z: lag is the
 *     difference of N. Fresh when lag is at most BETAS_PER_RELEASE. A
 *     negative lag (record newer than the running version) is fresh.
 *   - Any other shape (a stable version on either side, a different X.Y.Z,
 *     a null on either side) is fresh with lag null. This point measures
 *     eval staleness, not the release process itself.
 *
 * House rule: hyphens only, no em-dashes.
 */

const BETAS_PER_RELEASE = 2;

const BETA_RE = /^(.*)-beta\.(\d+)$/;

/**
 * @param {string|null} recordVersion  plugin_version stamped in last-run.json
 * @param {string|null} runningVersion version of the running tree
 * @returns {{fresh: boolean, lag: number|null, detail: string}}
 */
function evalFreshness(recordVersion, runningVersion) {
  let detail = 'plugin_version ' + recordVersion + ' vs running ' + runningVersion;
  if (recordVersion && runningVersion) {
    const rm = BETA_RE.exec(recordVersion);
    const cm = BETA_RE.exec(runningVersion);
    if (rm && cm && rm[1] === cm[1]) {
      const lag = Number(cm[2]) - Number(rm[2]);
      detail = 'beta lag ' + lag + ' (' + recordVersion + ' -> ' + runningVersion + ')';
      return { fresh: lag <= BETAS_PER_RELEASE, lag: lag, detail: detail };
    }
  }
  return { fresh: true, lag: null, detail: detail };
}

module.exports = { evalFreshness, BETAS_PER_RELEASE };
