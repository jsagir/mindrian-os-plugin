'use strict';

/**
 * Phase 127-02 BRAIN-MCP-127-09 -- Tier-0 graceful messaging chokepoint.
 *
 * Single source-of-truth for the DIRECTOR_NOT_AVAILABLE sentinel shape used
 * across the plugin:
 *   - bin/mindrian-brain-mcp-client.cjs (the stdio shim from Phase 127-00)
 *   - Larry's prose surface (one-line hint via larryTier0Hint)
 *   - Future statusline + /mos:status surfaces (CONTEXT acceptance gate #4)
 *
 * Before this chokepoint, the shim shipped its own inline copy of the
 * sentinel shape. Future surfaces (statusline, /mos:status, persona output)
 * would each duplicate the same shape, drifting on the upgrade_hint URL or
 * the fallback_advice phrasing. This module locks the wire shape and the
 * Larry-prose phrasing so every consumer reads the same canonical bytes.
 *
 * Wire shape locked here (BRAIN-MCP-127-09 invariant):
 *   {
 *     status:           "DIRECTOR_NOT_AVAILABLE",
 *     reason:           "MINDRIAN_BRAIN_KEY not set",
 *     command_context:  <toolName string | "unknown" for non-string input>,
 *     upgrade_hint:     "Request a Brain key at https://mindrian-os.com/brain-access",
 *     fallback_advice:  "Larry can still talk with you and reflect on your room context. Methodology orchestration requires Brain."
 *   }
 *
 * Canon Part 7 (reuse): isAvailable() is a one-line delegation to
 *   brain-client.cjs's existing isAvailable(); no parallel key-resolver code
 *   path lives here. The shim's local tier0Response becomes a one-line
 *   passthrough after the Phase 127-02 refactor; no duplicate shape exists.
 *
 * Canon Part 8 (graph boundary): zero network surface in this file.
 *   isAvailable() delegates to brain-client.cjs (the existing chokepoint that
 *   reads ONLY the LOCAL key via resolve-brain-key.cjs). No fetch, no http,
 *   no Brain endpoint domain strings.
 *
 * HARD RULE: no em-dashes anywhere in this file (hyphens only).
 */

const brainClient = require('./brain-client.cjs');

// Locked wire string. Renaming this constant breaks every downstream consumer
// (the shim, Larry's prose surface, the doctor's Class-M smoke L5 check).
// Treat as a phase-amendment boundary.
const DIRECTOR_NOT_AVAILABLE = 'DIRECTOR_NOT_AVAILABLE';

// Locked sentinel strings. Tests assert the keys; the values are
// human-facing and may evolve, but only via explicit phase amendment.
const REASON_NO_KEY = 'MINDRIAN_BRAIN_KEY not set';
const UPGRADE_HINT = 'Request a Brain key at https://mindrian-os.com/brain-access';
const FALLBACK_ADVICE = 'Larry can still talk with you and reflect on your room context. Methodology orchestration requires Brain.';

/**
 * Construct the Tier-0 sentinel response. Returned by every Brain-tool entry
 * point when no key is resolvable. The shape is byte-locked.
 *
 * Defensive: non-string / empty / non-truthy commandContext arguments coerce
 * to "unknown" so the wire shape is invariant under bad-caller inputs (the
 * shim's tool-handler closure passes the literal tool name; future callers
 * may pass null in error paths).
 *
 * @param {string} commandContext  the tool name (e.g. "brain_ask"); falls back
 *                                 to "unknown" for non-string / empty inputs.
 * @returns {{status: string, reason: string, command_context: string,
 *            upgrade_hint: string, fallback_advice: string}}
 */
function tier0Response(commandContext) {
  const ctx = (typeof commandContext === 'string' && commandContext.length > 0)
    ? commandContext
    : 'unknown';
  return {
    status: DIRECTOR_NOT_AVAILABLE,
    reason: REASON_NO_KEY,
    command_context: ctx,
    upgrade_hint: UPGRADE_HINT,
    fallback_advice: FALLBACK_ADVICE,
  };
}

/**
 * Is the Brain reachable from this process right now? Delegates to
 * brain-client.cjs's existing chokepoint (which reads only the LOCAL key via
 * resolve-brain-key.cjs). One-line passthrough -- never duplicate the key
 * resolution logic.
 *
 * @returns {boolean}
 */
function isAvailable() {
  return brainClient.isAvailable();
}

/**
 * One-line Larry-prose hint for the Tier-0 path. Used by Larry's surface
 * (and future statusline / /mos:status) when isAvailable() returns false to
 * tell the user how to unlock Brain. Locked under 120 chars so it fits in
 * statusline + chat-prefix surfaces without truncation.
 *
 * @returns {string}
 */
function larryTier0Hint() {
  return 'Methodology orchestration needs a Brain key. Drop one in ~/.mindrian.env or set MINDRIAN_BRAIN_KEY.';
}

module.exports = {
  DIRECTOR_NOT_AVAILABLE,
  tier0Response,
  isAvailable,
  larryTier0Hint,
};
