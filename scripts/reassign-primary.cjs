#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 194-07 (PSB-16 / D-06) -- one-key primary reassign.
 * =========================================================================
 * The navigator's session may be BOUND to several rooms (the F.8 set); one of
 * them is the `primary` (the default write target). This affordance switches the
 * primary among the bound SET with a single key and ZERO per-write prompt (D-06:
 * primary-as-default, one-key switch, never a per-write question).
 *
 * Reuse, not reinvention (OQ-2 / Part 7): the pick is interpreted through the
 * SHIPPED dial capture (lib/hmi/f1-pick-capture-cli.cjs::captureCliPick), a
 * deterministic membership match against the rendered option set. We do NOT build
 * a new selector shape; we supply a new SINK (writeSessionBinding) behind the
 * existing capture. When no pick is supplied, the affordance CYCLES to the next
 * member of the bound set (the one-key default).
 *
 * Contract:
 *   - a target not in the bound SET is REJECTED (safe no-op; the primary is
 *     left untouched).
 *   - never prompts per-write (zero-friction) and never throws.
 *   - LOCAL only (Part 8): reads and rewrites the session binding file. ZERO
 *     Brain egress, zero network token.
 *
 * No em-dashes. No emoji. No Brain call.
 * License: BSL 1.1.
 */

const path = require('node:path');
const sessionBinding = require(path.join(__dirname, '..', 'lib', 'core', 'session-binding.cjs'));
const { captureCliPick } = require(path.join(__dirname, '..', 'lib', 'hmi', 'f1-pick-capture-cli.cjs'));

// Interpret a caller-supplied pick against the bound SET through the shipped
// capture. `pick` may be:
//   - undefined/null -> caller wants the CYCLE default (handled upstream);
//   - a string slug  -> wrapped as a one-key answer and membership-matched;
//   - an answer object { selectedOption } -> passed straight to the capture.
// Returns the matched bound slug, or null when the pick is not a bound member.
function resolveTarget(pick, bound) {
  const verbs = Array.isArray(bound) ? bound : [];
  let answer = null;
  if (typeof pick === 'string' && pick.length > 0) {
    answer = { selectedOption: pick };
  } else if (pick && typeof pick === 'object') {
    answer = pick;
  }
  if (!answer) return null;
  const captured = captureCliPick(answer, { verbs: verbs });
  const verb = captured && captured.pick ? captured.pick.verb : null;
  return (typeof verb === 'string' && verbs.indexOf(verb) !== -1) ? verb : null;
}

// Cycle to the next member of the bound SET after `current` (wrap-around). When
// `current` is absent or not a member, the cycle starts at the first bound room.
function nextInCycle(current, bound) {
  if (!Array.isArray(bound) || bound.length === 0) return null;
  const idx = bound.indexOf(current);
  if (idx === -1) return bound[0];
  return bound[(idx + 1) % bound.length];
}

// reassignPrimary({ sessionId, pick, home }) -> { changed, primary, bound }.
// Switches session.primary among the bound SET and persists it via
// writeSessionBinding. With an explicit `pick` it sets that member (rejecting a
// non-member as a safe no-op); with no pick it CYCLES to the next member. Never
// prompts per-write (D-06) and NEVER throws (fail-open).
function reassignPrimary(opts) {
  const result = { changed: false, primary: null, bound: [] };
  try {
    const sessionId = opts && opts.sessionId;
    const home = (opts && typeof opts.home === 'string' && opts.home.length > 0) ? opts.home : undefined;

    const binding = sessionBinding.readSessionBinding(sessionId, { home: home });
    const bound = Array.isArray(binding.bound) ? binding.bound : [];
    const current = (typeof binding.primary === 'string') ? binding.primary : null;
    result.bound = bound.slice();
    result.primary = current;

    // Nothing to switch among an empty bound SET.
    if (bound.length === 0) return result;

    let target;
    if (opts && (typeof opts.pick === 'string' || (opts.pick && typeof opts.pick === 'object'))) {
      target = resolveTarget(opts.pick, bound);
      // A pick outside the bound SET is rejected (safe no-op): keep the primary.
      if (target === null) return result;
    } else {
      target = nextInCycle(current, bound);
      if (target === null) return result;
    }

    // Persist through the shipped writer (the new SINK behind the existing
    // capture). Zero per-write prompt.
    sessionBinding.writeSessionBinding(
      sessionId,
      { bound: bound, primary: target, sticky: binding.sticky === true },
      { home: home }
    );

    result.changed = target !== current;
    result.primary = target;
    return result;
  } catch (_) {
    // Fail-open: never throw out of a one-key affordance.
    return result;
  }
}

// Born WIRED (Part 11): invocable as a CLI affordance. `reassign-primary.cjs
// [targetRoom]` cycles (no arg) or sets (explicit slug) the primary. Reads the
// session id from the environment (the shipped CLAUDE_SESSION_ID convention).
if (require.main === module) {
  try {
    const sessionId = process.env.CLAUDE_SESSION_ID || '';
    const home = process.env.MINDRIAN_ROOMS_HOME || process.env.MINDRIAN_ROOMS_ROOT || undefined;
    const pick = process.argv[2] || undefined;
    const out = reassignPrimary({ sessionId: sessionId, pick: pick, home: home });
    console.log('primary -> ' + (out.primary || '(none)') + (out.changed ? ' (changed)' : ' (unchanged)'));
  } catch (_) {}
  process.exit(0);
}

module.exports = { reassignPrimary: reassignPrimary };
