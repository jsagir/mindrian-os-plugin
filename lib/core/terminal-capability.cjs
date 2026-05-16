'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-07 Task 1 -- Terminal capability probe.
 *
 * Decision D-05 (LOCKED):
 *   probeCapability(opts) returns one of:
 *     'truecolor'  -- process.stdout.isTTY === true AND ($COLORTERM matches
 *                     truecolor/24bit OR equals literal "truecolor")
 *     '256color'   -- isTTY === true AND ($COLORTERM contains "256color" OR
 *                     $TERM contains "256color")
 *     'ascii'      -- otherwise (non-TTY, no COLORTERM, Desktop chat surface)
 *
 *   Desktop hard-override: env.CLAUDE_DESKTOP=1 or env.MINDRIAN_DESKTOP=1 forces
 *   'ascii' regardless of TTY state. This is the Desktop chat surface, which
 *   strips ANSI escapes.
 *
 * Canon references:
 *   Part 3  UI Ruling System -- bulletproof terminal coherence depends on a
 *           single capability probe shared across surfaces.
 *   Part 7  Reuse Before Build -- this is the REUSABLE substrate for
 *           /mos:status, /mos:doctor, /mos:splash, /mos:help renderer.
 *   Part 8  Graph Boundary -- reads env-vars + isTTY only; zero network,
 *           zero Brain, zero telemetry egress.
 */

/**
 * Probe the current terminal capability.
 *
 * @param {object} [opts]
 * @param {object} [opts.env]   -- env override (defaults to process.env)
 * @param {boolean} [opts.isTTY] -- TTY override (defaults to process.stdout.isTTY)
 * @returns {'truecolor'|'256color'|'ascii'}
 */
function probeCapability(opts) {
  const o = opts || {};
  const env = o.env || process.env;
  const isTTY =
    o.isTTY !== undefined
      ? o.isTTY
      : Boolean(process.stdout && process.stdout.isTTY);

  // Desktop simulator hard-override.
  if (env.CLAUDE_DESKTOP === '1' || env.MINDRIAN_DESKTOP === '1') {
    return 'ascii';
  }

  // Test/CI hard-override for harnesses that pipe stdout (isTTY false).
  // Used by the Phase 121.5-09 coherence smoke test harness to verify the
  // truecolor branch fires on the CLI surface. Production code paths never
  // set this; isTTY-based detection remains the default contract.
  if (env.MINDRIAN_FORCE_TRUECOLOR === '1') return 'truecolor';
  if (env.MINDRIAN_FORCE_256COLOR === '1') return '256color';

  if (!isTTY) return 'ascii';

  const colorterm = String(env.COLORTERM || '').toLowerCase();
  const term = String(env.TERM || '').toLowerCase();

  if (colorterm === 'truecolor' || /truecolor/.test(colorterm) || /24bit/.test(colorterm)) {
    return 'truecolor';
  }
  if (colorterm.includes('256color') || term.includes('256color')) {
    return '256color';
  }

  return 'ascii';
}

/**
 * @param {'truecolor'|'256color'|'ascii'} capability
 * @returns {boolean}
 */
function supportsColor(capability) {
  return capability === 'truecolor' || capability === '256color';
}

/**
 * @param {'truecolor'|'256color'|'ascii'} capability
 * @returns {boolean}
 */
function supportsTruecolor(capability) {
  return capability === 'truecolor';
}

module.exports = { probeCapability, supportsColor, supportsTruecolor };
