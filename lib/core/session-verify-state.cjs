'use strict';
/*
 * lib/core/session-verify-state.cjs
 *
 * Phase 341 plan 08 (D-07a sub-points (a) and (c), D-07b sub-points (b), (d)
 * and (e)). Canon Parts 7, 8 and 12.
 *
 * This module is the ONE authority for four things. Nothing else in the tree
 * computes any of them, and no second marker file exists for any of them:
 *
 *   1. the last-seen version marker (D-07a a): the post-update signal is a
 *      VERSION CHANGE, `installed_plugins.json` versus this marker. The Claude
 *      Code loader writes `installed_plugins.json`, so it cannot forget to set
 *      the signal. A fresh install has no marker and counts as changed, so the
 *      first session after an install verifies too.
 *   2. the verification result (D-07a b), written by the SessionStart hook and
 *      by the detached probe.
 *   3. the statusline segment string (D-07a c): ONE segment, version plus glyph.
 *   4. the Eureka opt-in record and its pure decision function (D-07b b, d, e).
 *
 * ROOT RULE. Every path derives from ONE root: MOS_SESSION_VERIFY_HOME when
 * set (the test seam), else HOME, else USERPROFILE, else os.homedir(). The
 * marker lives at <root>/.mindrian/session-verify/state.json. There is no
 * second home resolution anywhere in this module.
 *
 * STATE SHAPE (frozen here, every consumer reads this):
 *   schema              the literal 'mos-session-verify/1'
 *   last_seen_version   the version the loader had registered when the check ran
 *   verified_at_ms      epoch milliseconds of the local check
 *   local               { ok, ran, failed_count, failed_points, mode, elapsed_ms,
 *                         inconclusive_reason }
 *                       ok is true (passed), false (failed) or null (inconclusive)
 *   wire                'pending' | 'ok' | 'failed' | 'skipped'
 *   theo                'pending' | 'reachable' | 'unreachable' | 'refused'
 *   theo_reason         string, the honest reason for any non-reachable verdict
 *   insight             { pending, capture_path, handle, delivered_for_version,
 *                         drain_retries }
 *   eureka_optin        { choice, version, at, install_failed,
 *                         install_failure_reason } (absent until the navigator
 *                         answers the card)
 *
 * WHY mergeVerifyState EXISTS. The verification result, the probe result and the
 * opt-in record are written by THREE different processes at three different
 * moments into ONE file. A raw overwrite by any of them silently erases the
 * other two. The concrete loss it prevents: a verification write on the next
 * update erasing a `never` the navigator chose, which would resurrect a card
 * D-07b (d) says is permanently answered. Every runtime writer uses
 * mergeVerifyState and NOT writeVerifyState. writeVerifyState is the RAW
 * overwrite, for tests and for the very first write only. Residual race
 * (ASSUMED low risk): two writers that read before either renames can lose the
 * later key. The writers touch disjoint top-level keys and act seconds to
 * minutes apart, so this is not guarded with a lock.
 *
 * HONEST FAILURE ENCODING (D-07b). When "Install now" is answered and the install
 * FAILS, the caller records recordEurekaOptin('declined', version,
 * { install_failed: true, install_failure_reason: <bounded string> }). `choice`
 * stays inside the locked three-value enum, so the D-07b (e) contract is
 * unchanged. The two extra fields keep it honest: the doctor line reports
 * "declined (install failed: <reason>)" rather than claiming an install that
 * did not happen, and the card does not re-fire in a loop against the same
 * broken network inside the same version.
 *
 * resolveOptinVersion is deliberately NOT the same question as the preflight's
 * readRegisteredVersion(). That asks what version the LOADER registered. This
 * one asks what version the MARKER is keyed to, with a repo-version fallback.
 *
 * Canon Part 8: LOCAL only. This module has no network, no spawn, and carries no
 * room content. It never throws across its boundary: every reader returns null
 * or false on any failure.
 *
 * House rule: no em-dashes; hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const SCHEMA = 'mos-session-verify/1';

// Plain check mark U+2713 and plain warning sign U+26A0. NEITHER is one of the
// three statusline carve-out glyphs (tests/test-statusline-glyph-isolation.cjs
// EXCLUSIVE_GLYPHS); U+26A0 is the already-shared glyph.
const GLYPH_OK = '✓';
const GLYPH_WARN = '⚠';

// ---------------------------------------------------------------------------
// D-07b locked card constants. The copy is the navigator's verbatim wording
// (2026-09-10). Do not reflow, re-word or append to it.
// ---------------------------------------------------------------------------
const EUREKA_OPTIN_COPY = 'Eureka spots connections between your claims by meaning, not keywords. It needs a one-time 380 MB local model download. Install it now?';

const EUREKA_OPTIN_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'install_now',
    label: 'Install now',
    description: 'Download the model once. Eureka works as soon as it finishes.',
  }),
  Object.freeze({
    id: 'not_now',
    label: 'Not now',
    description: 'Skip it. I ask once more after the next update, and not before.',
  }),
  Object.freeze({
    id: 'never_ask_again',
    label: 'Never ask again',
    description: 'No more asking. Run /mos:eureka enable any time to turn it on yourself.',
  }),
]);

const EUREKA_OPTIN_CHOICES = Object.freeze(['installed', 'declined', 'never']);

const EUREKA_OPTIN_CHOICE_BY_OPTION_ID = Object.freeze({
  install_now: 'installed',
  not_now: 'declined',
  never_ask_again: 'never',
});

const EUREKA_OPTIN_GATE_PREFIX = 'eureka-optin-';

const FAILURE_REASON_CAP = 200;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
function homeRoot() {
  return process.env.MOS_SESSION_VERIFY_HOME
    || process.env.HOME
    || process.env.USERPROFILE
    || os.homedir();
}

function verifyDir() {
  return path.join(homeRoot(), '.mindrian', 'session-verify');
}

function statePath() {
  return path.join(verifyDir(), 'state.json');
}

// ---------------------------------------------------------------------------
// Read and write. Never throw.
// ---------------------------------------------------------------------------
function readVerifyState() {
  try {
    const raw = fs.readFileSync(statePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch (_e) {
    return null;
  }
}

// RAW overwrite. Atomic: write a .tmp sibling, then rename. For tests and for
// the very first write only; runtime writers use mergeVerifyState.
function writeVerifyState(obj) {
  const target = statePath();
  const tmp = target + '.' + process.pid + '.tmp';
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, target);
    return true;
  } catch (_e) {
    try { fs.unlinkSync(tmp); } catch (_e2) { /* nothing to clean */ }
    return false;
  }
}

// Shallow merge over the TOP-LEVEL keys of the current state, then write.
function mergeVerifyState(patch) {
  try {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return false;
    const current = readVerifyState() || {};
    const next = Object.assign({}, current, patch);
    if (typeof next.schema !== 'string') next.schema = SCHEMA;
    return writeVerifyState(next);
  } catch (_e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// D-07a (a): the post-update signal is a version change
// ---------------------------------------------------------------------------
function detectVersionChange(registeredVersion) {
  const state = readVerifyState();
  const lastSeen = (state && typeof state.last_seen_version === 'string' && state.last_seen_version.length > 0)
    ? state.last_seen_version
    : null;
  const current = (typeof registeredVersion === 'string' && registeredVersion.length > 0)
    ? registeredVersion
    : null;
  // Unknown is never a trigger. A missing marker with a known version is.
  const changed = current !== null && current !== lastSeen;
  return { changed: changed, lastSeen: lastSeen, current: current };
}

// ---------------------------------------------------------------------------
// D-07a (c): the one statusline segment
// ---------------------------------------------------------------------------
function shortVersionLabel(version) {
  if (typeof version !== 'string' || version.length === 0) return '';
  const dash = version.indexOf('-');
  return dash === -1 ? version : version.slice(dash + 1);
}

function _failedCount(local) {
  if (local && typeof local.failed_count === 'number' && Number.isFinite(local.failed_count) && local.failed_count >= 1) {
    return Math.floor(local.failed_count);
  }
  if (local && Array.isArray(local.failed_points) && local.failed_points.length >= 1) {
    return local.failed_points.length;
  }
  // ok === false means at least one point failed, whatever the count says.
  return 1;
}

// Pure function of its argument. T-341-31: the glyph comes ONLY from
// state.local.ok. Pending, absent or malformed state claims nothing.
function buildStatuslineSegment(state) {
  try {
    if (!state || typeof state !== 'object') return '';
    const label = shortVersionLabel(state.last_seen_version);
    if (label === '') return '';
    const local = (state.local && typeof state.local === 'object') ? state.local : null;
    if (local && local.ok === true) return 'mos ' + label + ' ' + GLYPH_OK;
    if (local && local.ok === false) return 'mos ' + label + ' ' + GLYPH_WARN + ' ' + String(_failedCount(local));
    return 'mos ' + label;
  } catch (_e) {
    return '';
  }
}

// ---------------------------------------------------------------------------
// D-07b: the opt-in card, its decision function and its recorder
// ---------------------------------------------------------------------------
function buildEurekaOptinCard(version) {
  return {
    gate_id: EUREKA_OPTIN_GATE_PREFIX + String(version),
    header: EUREKA_OPTIN_COPY,
    kind: 'general',
    selectMode: 'single',
    options: EUREKA_OPTIN_OPTIONS,
  };
}

/*
 * shouldAskEurekaOptin({ installedNow, state, currentVersion,
 *                        firstInstallRewardPending }) -> { ask, defer, reason }
 *
 * PURE: no I/O, no probe, no clock read. Every input is supplied by the caller.
 * It encodes D-07b (b) and (d), in this exact order, first match wins.
 * `state` may be null or malformed: eureka_optin is treated as {} before any
 * rule runs, so a fresh install reaches the ask rule and never throws.
 *
 * "Re-asks exactly once on the next version change" is not a counter. A
 * `declined` record is keyed by the version it was made against, so it stops
 * matching rule 5 the moment the version moves, and the next decline writes a
 * NEW record keyed to the NEW version. Exactly one ask per version falls out of
 * the key, with no state to drift.
 *
 * Rules 3 to 5 read the RECORD, not a version-change boolean. The D-07a trigger
 * is consumed by whichever surface saw the session start first, so a boolean
 * would make the card depend on which surface won that race. Keying on "is there
 * a standing answer for THIS version" is surface-independent and gives the same
 * verdict on the CLI and on Desktop.
 *
 * DEFER is a third answer, distinct from no-fire. The caller re-checks on the
 * next turn of the SAME session and never postpones to a later session.
 */
function shouldAskEurekaOptin(input) {
  const o = (input && typeof input === 'object') ? input : {};
  const currentVersion = o.currentVersion;
  const rec = (o.state && typeof o.state === 'object'
    && o.state.eureka_optin && typeof o.state.eureka_optin === 'object')
    ? o.state.eureka_optin
    : {};

  if (typeof currentVersion !== 'string' || currentVersion.length === 0) {
    return { ask: false, defer: false, reason: 'unknown_version' };
  }
  if (o.installedNow === true) {
    return { ask: false, defer: false, reason: 'already_installed' };
  }
  if (rec.choice === 'never') {
    return { ask: false, defer: false, reason: 'never' };
  }
  if (rec.choice === 'installed') {
    return { ask: false, defer: false, reason: 'already_installed' };
  }
  if (rec.choice === 'declined' && rec.version === currentVersion) {
    return { ask: false, defer: false, reason: 'declined_this_version' };
  }
  if (o.firstInstallRewardPending === true) {
    return { ask: false, defer: true, reason: 'first_install_reward_owns_turn' };
  }
  return { ask: true, defer: false, reason: 'no_standing_answer' };
}

function recordEurekaOptin(choice, version, extra) {
  try {
    if (EUREKA_OPTIN_CHOICES.indexOf(choice) === -1) {
      return { ok: false, reason: 'invalid_choice' };
    }
    if (typeof version !== 'string' || version.length === 0) {
      return { ok: false, reason: 'invalid_version' };
    }
    const record = { choice: choice, version: version, at: Date.now() };
    // Only the two honest-failure fields may ride along. Nothing else.
    if (extra && typeof extra === 'object') {
      if (extra.install_failed === true) record.install_failed = true;
      if (typeof extra.install_failure_reason === 'string' && extra.install_failure_reason.length > 0) {
        record.install_failure_reason = extra.install_failure_reason.replace(/\s+/g, ' ').slice(0, FAILURE_REASON_CAP);
      }
    }
    const wrote = mergeVerifyState({ eureka_optin: record });
    return wrote ? { ok: true, reason: 'recorded' } : { ok: false, reason: 'write_failed' };
  } catch (_e) {
    return { ok: false, reason: 'write_failed' };
  }
}

// ONE fallback chain so every opt-in caller keys an answer to the same version.
function resolveOptinVersion(state) {
  try {
    if (state && typeof state === 'object'
      && typeof state.last_seen_version === 'string' && state.last_seen_version.length > 0) {
      return state.last_seen_version;
    }
  } catch (_e) { /* fall through */ }
  try {
    const rv = require('./repo-version.cjs');
    const v = rv.readRepoVersion().version;
    if (typeof v === 'string' && v.length > 0) return v;
  } catch (_e) { /* fall through */ }
  return null;
}

module.exports = {
  readVerifyState,
  writeVerifyState,
  mergeVerifyState,
  verifyDir,
  statePath,
  detectVersionChange,
  buildStatuslineSegment,
  shortVersionLabel,
  shouldAskEurekaOptin,
  recordEurekaOptin,
  buildEurekaOptinCard,
  resolveOptinVersion,
  EUREKA_OPTIN_COPY,
  EUREKA_OPTIN_OPTIONS,
  EUREKA_OPTIN_CHOICES,
  EUREKA_OPTIN_CHOICE_BY_OPTION_ID,
  EUREKA_OPTIN_GATE_PREFIX,
};
