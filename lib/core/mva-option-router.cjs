/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-05 Plan 05 -- mva-option-router.
 *
 * Routes the user's selection from the 3-option footer that renders after the
 * 30-second MVA brief (per binding decision B4 + Canon Part 3 verbs 7/8/5).
 *
 * Option 1 -> stay_in_just_talk (Canon verb 7 Synthesize): operator transitions
 *             to JUST_TALK; the brief stays in scrollback; user can ask any
 *             follow-up.
 * Option 2 -> ignite_from_brief (Canon verb 8 Bank Opportunity): reads the
 *             sha8 brief side-file written by the Phase 118 orchestrator from
 *             ~/.mindrian/mva/briefs/<sha8>.json and returns an ignite_from_brief
 *             action. The caller invokes /mos:ignite --from-brief <sha8>.
 *             Phase 155-04 claims the Phase 119 contract per
 *             BIRTH-FLOW-BRIEF.md Section 7 Gap 4 (GAP-4).
 * Option 3 -> invoke_challenge_assumptions (Canon verb 5 Devil's Advocate):
 *             operator transitions to METHODOLOGY; the wrapper invokes
 *             /mos:challenge-assumptions --from-brief <sha8>.
 *
 * CRITICAL-3 part 2 wire:
 *   resolveCurrentSha8() reads ~/.mindrian/mva/state.json (the manifest written
 *   atomically by Plan 118-03 orchestrator after mva_brief_rendered emission)
 *   and returns the latest sha8 -- or null if the manifest is absent (fresh
 *   install / Hebrew refusal short-circuit). The /mos:mva-option command
 *   wrapper uses this to auto-discover the most recent brief when the user
 *   types `1`, `2`, or `3` without an explicit sha argument.
 *
 * Canon Part 8 invariants:
 *   - This module reads only sentence_sha256 (one-way hash) + agent payload
 *     scalars from the side-file. It NEVER reads .sentence, .raw_sentence,
 *     .prompt, or any free-text source string.
 *   - Telemetry payload carries ONLY sentence_sha256 + option_id +
 *     time_to_click_ms. No content. No URLs.
 *   - mva_option_selected event uses the ALLOWED_FIELDS frozen schema from
 *     mva-telemetry.cjs; validation rejects unknown fields and over-long
 *     strings.
 *
 * Em-dash invariant:
 *   STUB_MESSAGE_119 + OPTION_BEHAVIOR narratives use `--`, NEVER `—`. Test 7
 *   asserts the rendered text; Test 16 asserts both the command markdown and
 *   the skill markdown.
 *
 * Hermetic test isolation:
 *   All paths are derived from process.env.HOME via _home() at call time, so
 *   tests can mkdtempSync a fresh HOME, swap process.env.HOME, and verify the
 *   side-file / state.json / telemetry surfaces independently.
 *
 * Pure CJS, node built-ins only. Zero new runtime dependencies.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { transitionViaMVAOption } = require('../conversation/operator.cjs');
const telemetry = require('./mva-telemetry.cjs');

// ---------- Frozen strings ----------

// STUB_MESSAGE_119: kept as a code comment label only per Phase 155-04.
// This string is NOT returned as a narrative for option 2 -- it is replaced by
// the ignite_from_brief handler. STUB_MESSAGE_119 text is preserved here so
// grep can confirm the stub was replaced rather than deleted silently.
// Original text (HISTORIC REFERENCE ONLY):
//   'Building a room around this is the next layer; shipping in beta.18 (Phase 119).'
//   'For now, press option 1 to keep this brief visible, or option 3 to go deeper.'
const STUB_MESSAGE_119 = null; // replaced by Phase 155-04 ignite_from_brief; see resolveOption2()

// SHA8 validation: must be exactly 8 hex characters, no path separators, dots, or spaces.
// T-155-04-01 mitigation: reject any value that could construct a path traversal.
const SHA8_RE = /^[0-9a-f]{8}$/;

/**
 * resolveOption2(sha8) -> {
 *   action: 'ignite_from_brief' | 'no_brief_available' | 'brief_parse_error',
 *   sha8?: string,
 *   brief_content?: object,
 *   canon_verb: 8,
 *   invoke_command?: string,
 *   message?: string,
 *   brief_reward_pending?: boolean
 * }
 *
 * Reads the sha8 brief side-file and returns a structured result.
 * When sha8 is null/undefined, auto-discovers via resolveCurrentSha8() (state.json).
 * When no brief is found, returns {action:'no_brief_available'}.
 * When brief JSON is malformed, returns {action:'brief_parse_error'}.
 *
 * Reward-before-investment (Decision 8 / BIRTH-FLOW-BRIEF.md constraint 10):
 *   If no mva_brief_shown memory_event exists (checked via telemetry file), the
 *   result includes brief_reward_pending:true. The /mos:ignite command (Plan 06)
 *   reads this flag and renders the brief before B2.
 *
 * // OPEN-Q8: directive-vs-reward -- instant_brief runs first per Decision 8
 * //           until navigator rules otherwise.
 */
function resolveOption2(sha8Input) {
  // Step 1: resolve sha8 -- provided or auto-discover.
  let sha8 = sha8Input;

  if (typeof sha8 !== 'string' || sha8.length === 0 || sha8 === 'null') {
    sha8 = resolveCurrentSha8();
  }

  // Step 2: validate sha8 (T-155-04-01 path-traversal mitigation).
  if (typeof sha8 !== 'string' || !SHA8_RE.test(sha8)) {
    return {
      action: 'no_brief_available',
      canon_verb: 8,
      message: 'No MVA brief found. Run /mos:mva-brief first to generate one.',
      error: sha8 && typeof sha8 === 'string' ? 'invalid_sha8' : undefined,
    };
  }

  // Step 3: read the brief side-file.
  const p = _sideFilePath(sha8);
  if (!fs.existsSync(p)) {
    return {
      action: 'no_brief_available',
      canon_verb: 8,
      message: 'No MVA brief found. Run /mos:mva-brief first to generate one.',
    };
  }

  let briefContent;
  try {
    briefContent = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_err) {
    // T-155-04-03: malformed JSON -> brief_parse_error with helpful message.
    return {
      action: 'brief_parse_error',
      canon_verb: 8,
      sha8: sha8,
      message: 'Brief file for ' + sha8 + ' is malformed. Re-run /mos:mva-brief to regenerate it.',
    };
  }

  // Step 4: reward-before-investment check.
  // Look for a recent mva_brief_shown event in telemetry. If absent, mark
  // brief_reward_pending:true so the ignite command renders the brief first.
  const briefRewardPending = !_hasBriefRewardBeenDelivered();

  // Step 5: return ignite_from_brief result.
  return {
    action: 'ignite_from_brief',
    sha8: sha8,
    brief_content: briefContent,
    canon_verb: 8,
    invoke_command: '/mos:ignite --from-brief ' + sha8,
    brief_reward_pending: briefRewardPending,
  };
}

/**
 * _hasBriefRewardBeenDelivered() -> boolean
 *
 * Returns true if a mva_brief_shown event exists in the telemetry JSONL.
 * Used by resolveOption2 to enforce reward-before-investment (Decision 8).
 */
function _hasBriefRewardBeenDelivered() {
  try {
    const p = _telemetryFilePath();
    if (!fs.existsSync(p)) return false;
    const text = fs.readFileSync(p, 'utf8').trim();
    if (!text) return false;
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i]) continue;
      let evt;
      try { evt = JSON.parse(lines[i]); } catch (_) { continue; }
      if (evt.event === 'mva_brief_shown' || evt.event === 'mva_brief_rendered') {
        return true;
      }
    }
    return false;
  } catch (_) {
    return false;
  }
}

const OPTION_BEHAVIOR = Object.freeze({
  1: Object.freeze({
    action: 'stay_in_just_talk',
    next_operator: 'JUST_TALK',
    canon_verb: 7, // Synthesize
    narrative: 'Keeping the brief in scrollback. Ask me anything about what you just saw.',
  }),
  // Option 2 behavior: unstubbed by Phase 155-04 (GAP-4).
  // The behavior object is present for API compatibility; the real routing logic
  // calls resolveOption2() which reads the sha8 brief side-file. STUB_MESSAGE_119
  // is intentionally null; see comment above.
  2: Object.freeze({
    action: 'ignite_from_brief',
    next_operator: null,
    canon_verb: 8, // Bank Opportunity -> ignite
    narrative: 'Reading your brief and preparing /mos:ignite. One moment.',
  }),
  3: Object.freeze({
    action: 'invoke_challenge_assumptions',
    next_operator: 'METHODOLOGY',
    canon_verb: 5, // Devil's Advocate
    narrative: "Going deeper. Pulling the brief into a Devil's Advocate pass.",
  }),
});

// ---------- Path resolvers (env-aware for hermetic testing) ----------

function _home() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function _statePath() {
  return path.join(_home(), '.mindrian', 'mva', 'state.json');
}

function _sideFilePath(sha8) {
  return path.join(_home(), '.mindrian', 'mva', 'briefs', sha8 + '.json');
}

function _telemetryFilePath() {
  return path.join(_home(), '.mindrian', 'telemetry', 'v1.13', 'mva.jsonl');
}

// ---------- CRITICAL-3 part 2 wire: resolveCurrentSha8 ----------

/**
 * resolveCurrentSha8() -> string | null
 *
 * Reads ~/.mindrian/mva/state.json (the manifest written atomically by Plan
 * 118-03 orchestrator after mva_brief_rendered emission) and returns the
 * `current_sha8` field. Returns null when:
 *   - state.json does not exist (fresh install OR Hebrew refusal short-circuit)
 *   - state.json is unreadable or invalid JSON
 *   - current_sha8 is missing or not a string
 *
 * Staleness is NOT enforced here -- the caller (router or wrapper) can choose
 * to compare rendered_at_ms against an expiration threshold and surface a
 * "brief expired" message. This function's only job is to return the most
 * recent known sha8 from the manifest.
 */
function resolveCurrentSha8() {
  try {
    const p = _statePath();
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf8');
    const manifest = JSON.parse(raw);
    if (manifest && typeof manifest.current_sha8 === 'string' && manifest.current_sha8.length > 0) {
      return manifest.current_sha8;
    }
    return null;
  } catch (_) {
    return null;
  }
}

// ---------- Internal helpers ----------

function _readSideFile(sha8) {
  try {
    const p = _sideFilePath(sha8);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
}

/**
 * Find the most recent mva_brief_rendered event for the given sentence_sha256
 * in ~/.mindrian/telemetry/v1.13/mva.jsonl. Returns the parsed event object
 * or null if none found.
 */
function _readLastBriefRenderedEvent(sentenceSha256) {
  try {
    const p = _telemetryFilePath();
    if (!fs.existsSync(p)) return null;
    const text = fs.readFileSync(p, 'utf8').trim();
    if (!text) return null;
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i]) continue;
      let evt;
      try { evt = JSON.parse(lines[i]); } catch (_) { continue; }
      if (evt.event === 'mva_brief_rendered' && evt.sentence_sha256 === sentenceSha256) {
        return evt;
      }
    }
    return null;
  } catch (_) {
    return null;
  }
}

// ---------- Public: routeOption ----------

/**
 * routeOption(optionId, sha8, opts?) -> Promise<{
 *   ok: boolean,
 *   action?: 'stay_in_just_talk' | 'phase_119_stub' | 'invoke_challenge_assumptions',
 *   message?: string,
 *   next_state?: string | null,
 *   time_to_click_ms?: number,
 *   invoke_command?: string,    // option 3 only
 *   error?: string,             // on failure
 *   no_transition?: boolean,
 *   reason?: string
 * }>
 *
 * opts:
 *   roomDir: filesystem path used by transitionViaMVAOption for operator state
 *            (defaults to process.cwd())
 *
 * Validation order (matches Test 4 / Test 5 / Test 8 expectations):
 *   1. optionId in {1, 2, 3} else -> invalid_option (no I/O, no telemetry)
 *   2. side-file present for sha8 else -> brief_not_found (no telemetry)
 *   3. mva_brief_rendered event present for the brief's sha256 else ->
 *      brief_still_rendering (no telemetry; OQ16 lean)
 *   4. compute time_to_click_ms from (now - mva_brief_rendered.timestamp)
 *   5. transition operator via transitionViaMVAOption(roomDir, optionId)
 *   6. emit mva_option_selected telemetry (sentence_sha256 + option_id +
 *      time_to_click_ms; ALLOWED_FIELDS-validated by mva-telemetry)
 *   7. return action + message + next_state (+ invoke_command on option 3)
 */
async function routeOption(optionId, sha8, opts) {
  opts = opts || {};

  // (1) Strict option validation -- runs BEFORE any I/O so invalid options
  //     are cheap to reject and never emit telemetry.
  if (!Number.isInteger(optionId) || ![1, 2, 3].includes(optionId)) {
    return { ok: false, error: 'invalid_option', valid_options: [1, 2, 3] };
  }

  // (2) Side-file lookup.
  if (typeof sha8 !== 'string' || sha8.length === 0) {
    return {
      ok: false,
      error: 'brief_not_found',
      message: 'The brief data has expired or was not deployed. Type your sentence again to re-fire the pipeline.',
    };
  }
  const brief = _readSideFile(sha8);
  if (!brief || typeof brief.sha256 !== 'string') {
    return {
      ok: false,
      error: 'brief_not_found',
      message: 'The brief data has expired or was not deployed. Type your sentence again to re-fire the pipeline.',
    };
  }

  // (3) mva_brief_rendered lookup (the "is the brief done streaming?" signal).
  const lastRendered = _readLastBriefRenderedEvent(brief.sha256);
  if (!lastRendered || !lastRendered.timestamp) {
    return {
      ok: false,
      error: 'brief_still_rendering',
      message: 'Brief is still rendering -- options will activate when it completes.',
    };
  }

  // (4) Compute time-to-click.
  const renderedAtMs = new Date(lastRendered.timestamp).getTime();
  const nowMs = Date.now();
  const time_to_click_ms = Math.max(0, nowMs - renderedAtMs);

  // (5) Operator transition. transitionViaMVAOption handles the per-option
  //     rules (1 -> JUST_TALK, 2 -> no-op, 3 -> METHODOLOGY).
  const roomDir = typeof opts.roomDir === 'string' ? opts.roomDir : process.cwd();
  const transitionResult = transitionViaMVAOption(roomDir, optionId);

  // (6) Telemetry. Best-effort: telemetry.emit() validates against
  //     ALLOWED_FIELDS.mva_option_selected and writes JSONL to
  //     ~/.mindrian/telemetry/v1.13/mva.jsonl. Validation throws (so we
  //     cannot leak invalid payloads); disk failures are swallowed by emit().
  try {
    telemetry.emit('mva_option_selected', {
      sentence_sha256: brief.sha256,
      option_id: optionId,
      time_to_click_ms: time_to_click_ms,
    });
  } catch (_) {
    // Validation error here would be a programming bug (we control the
    // payload shape). Swallow to keep the user-facing flow intact; the
    // test harness will surface the issue.
  }

  // (7) Build response.
  const behavior = OPTION_BEHAVIOR[optionId];
  const out = {
    ok: true,
    action: behavior.action,
    message: behavior.narrative,
    next_state: transitionResult && transitionResult.ok ? (transitionResult.new_state || null) : null,
    time_to_click_ms: time_to_click_ms,
  };
  if (transitionResult && transitionResult.no_transition) {
    out.no_transition = true;
    out.reason = transitionResult.reason;
  }
  if (optionId === 3) {
    out.invoke_command = '/mos:challenge-assumptions --from-brief ' + sha8;
  }
  return out;
}

module.exports = {
  routeOption,
  resolveCurrentSha8,
  resolveOption2,
  OPTION_BEHAVIOR,
  STUB_MESSAGE_119,
};
