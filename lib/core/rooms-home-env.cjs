'use strict';
// 260917-dia (Task C) -- the ONE shared MINDRIAN_ROOMS_HOME-then-
// MINDRIAN_ROOMS_ROOT env-precedence resolver.
//
// ROOT CAUSE (verified by grep, not re-derived): lib/core/session-binding.cjs
// and lib/core/resolve-active-room.cjs already honor MINDRIAN_ROOMS_HOME first,
// falling back to MINDRIAN_ROOMS_ROOT -- and docs name HOME 3x against ROOT's 1x,
// so HOME is the intended primary env var. Eleven OTHER resolver sites across
// lib/ and scripts/ disagreed: six read ROOT only (HOME silently ignored), five
// read ROOT before HOME (the precedence inverted). This module is the single
// read both groups now delegate to, so a future new resolver site has exactly
// one correct env-read pattern to copy (Canon Part 7, reuse before build).
//
// This is a PURE helper module, not an invocable surface -- Canon Part 11
// born-wired declaration does not apply (it declares commands/agents/pipelines/
// skills, not a plain env-read function with no fork).
//
// Deliberately reads process.env on EVERY call (never caches at module load,
// never memoizes): a hermetic test that flips MINDRIAN_ROOMS_HOME /
// MINDRIAN_ROOMS_ROOT between two calls in the SAME process must see the
// second call's env, not a load-time snapshot. Never throws.

function roomsHomeEnv() {
  try {
    const home = process.env.MINDRIAN_ROOMS_HOME;
    if (typeof home === 'string' && home.trim().length > 0) return home.trim();
    const root = process.env.MINDRIAN_ROOMS_ROOT;
    if (typeof root === 'string' && root.trim().length > 0) return root.trim();
    return null;
  } catch (_e) {
    return null;
  }
}

module.exports = { roomsHomeEnv };
