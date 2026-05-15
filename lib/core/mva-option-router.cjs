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
 * Option 2 -> phase_119_stub (Canon verb 8 Bank Opportunity, deferred): surfaces
 *             the STUB_MESSAGE_119 verbatim per binding decision B6 OPTION A.
 *             Does NOT invoke /mos:new-project (that wiring lands in Phase 119
 *             v1.13.0-beta.18).
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

// Per binding decision B6 OPTION A (verbatim text). Em-dash-free.
const STUB_MESSAGE_119 = [
  'Building a room around this is the next layer; shipping in beta.18 (Phase 119).',
  'For now, press option 1 to keep this brief visible, or option 3 to go deeper.',
].join('\n');

const OPTION_BEHAVIOR = Object.freeze({
  1: Object.freeze({
    action: 'stay_in_just_talk',
    next_operator: 'JUST_TALK',
    canon_verb: 7, // Synthesize
    narrative: 'Keeping the brief in scrollback. Ask me anything about what you just saw.',
  }),
  2: Object.freeze({
    action: 'phase_119_stub',
    next_operator: null,
    canon_verb: 8, // Bank Opportunity (deferred)
    narrative: STUB_MESSAGE_119,
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
  OPTION_BEHAVIOR,
  STUB_MESSAGE_119,
};
