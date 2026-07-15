'use strict';
/*
 * lib/core/doctor/mode-select-checkpoint-module.cjs -- Phase 227 Plan-01
 * Task 2 (D-04/D-05).
 *
 * A cadence:always, fix_supported:false, flag:null doctor module.
 *
 * WHAT IT DOES: reports whether the session-start mode-selection Decision
 * Gate (skills/conversation-mode/SKILL.md, hitl_shape F.1) has recorded a
 * lane pick this session via lib/core/mode-select-sidechannel.cjs. Today
 * that gate is enforced by prose alone; nothing anywhere records whether it
 * fired or a default was explicitly stated, so a silent skip is
 * structurally invisible. This module gives that silent skip something
 * structural to catch: a session with a user turn but no recorded lane-pick
 * resolution surfaces as an advisory warn finding.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it never blocks anything (always returns
 * ok or warn, never error), and it never auto-remediates (fix_supported is
 * false; a turn that already passed cannot be retroactively re-gated). It
 * also does not itself wire the recorder call sites -- that is plan 227-04's
 * job; this module is a reader only.
 *
 * Canon Part 8 (Graph Boundary): every check is LOCAL -- a file read under
 * ~/.mindrian via mode-select-sidechannel.cjs. ZERO network. It never
 * throws (soft-fail -> a warn finding), so a corrupt or adversarial store
 * becomes a doctor row, never a crash.
 *
 * Contract: check(ctx) -> { status: 'ok'|'warn', detail: string }. No fix
 * export (fix_supported:false; the contract-parity gate enforces the
 * two-way declaration).
 */

let sidechannel = null;
try {
  sidechannel = require('../mode-select-sidechannel.cjs');
} catch (_e) {
  sidechannel = null;
}

/**
 * check(ctx) -- ctx is optional. ctx.session_id (string) and
 * ctx.has_user_turn (boolean) are test seams that win when explicitly
 * provided. ctx.filePath threads through to the sidechannel for hermetic
 * tests.
 *
 * Production default, when ctx does not override: session_id defaults to
 * process.env.CLAUDE_SESSION_ID (the established session-identity
 * convention already used by lib/core/mva-state.cjs and
 * lib/statusline/cockpit-telemetry.cjs). has_user_turn defaults to true when
 * process.env.CLAUDE_SESSION_ID is present and non-empty, false otherwise:
 * if this check runs mid-session with a real session id present, a user
 * turn has, by construction, already happened, since the user's message is
 * what caused Claude to eventually run this command.
 *
 * This default closes a real gap found during planning: scripts/doctor.cjs's
 * own ctx object (built at runAccumulativeEngine's cadence-always loop)
 * carries only home, running, dryRun, fix, flags, and checks -- no
 * session_id or has_user_turn field, and per this repo's "one registry row
 * plus one runner file, no script-body edits" convention that ctx shape is
 * not going to grow one. Without this fallback the check would be
 * permanently inert in every real invocation, always short-circuiting to
 * ok. Deriving the default from process.env.CLAUDE_SESSION_ID inside this
 * module, not from ctx, closes that gap without touching scripts/doctor.cjs.
 */
function check(ctx) {
  const c = ctx || {};

  const envSessionId =
    typeof process.env.CLAUDE_SESSION_ID === 'string' ? process.env.CLAUDE_SESSION_ID : '';

  const sessionId =
    typeof c.session_id === 'string' && c.session_id.length > 0 ? c.session_id : envSessionId;

  const hasUserTurn =
    typeof c.has_user_turn === 'boolean' ? c.has_user_turn : sessionId.length > 0;

  // D-05: a doctor run that is itself turn 1 (no user turn yet) never
  // false-positives to warn.
  if (!hasUserTurn) {
    return {
      status: 'ok',
      detail: 'mode-select-checkpoint: no user turn has occurred yet this session',
    };
  }

  let records = [];
  try {
    if (sidechannel && typeof sidechannel.readLanePick === 'function') {
      const readOpts = typeof c.filePath === 'string' && c.filePath.length > 0
        ? { filePath: c.filePath }
        : undefined;
      records = sidechannel.readLanePick(sessionId, readOpts);
    }
  } catch (_e) {
    records = [];
  }

  if (!Array.isArray(records) || records.length === 0) {
    return {
      status: 'warn',
      detail: 'mode-select lane pick not recorded this session, possible silent skip',
    };
  }

  return {
    status: 'ok',
    detail: 'mode-select-checkpoint: ' + records.length + ' lane pick record(s) found this session',
  };
}

module.exports = {
  check: check,
};
