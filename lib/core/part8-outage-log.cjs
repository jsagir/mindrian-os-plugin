'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 386-30 (E-FAIL, owner decision of 2026-11-06): the count-only outage line.
 *
 * When the Part 8 guard cannot run (the sanitizer or the guard fails to load,
 * classify throws, the verdict is invalid, the hook fails after it read the
 * tool input) the hook and the belts in brain-client.cjs block the call. This
 * module records that the outage happened, so the failure rate becomes visible.
 * No rate is measured today.
 *
 * ONE LINE, THREE FIELDS, NOTHING ELSE:
 *   <ISO timestamp with milliseconds and Z> <class> <mode>
 *   class = brain | web | other   (derived from the tool name string only)
 *   mode  = one of OUTAGE_MODES, or unknown
 * Never a payload byte, a tool argument or a question text. The function takes
 * the tool name and the mode and nothing else, so it cannot see the payload.
 *
 * LOCATION: ~/.mindrian/telemetry/part8-guard-outage.log, computed at call
 * time so a test can set HOME.
 *
 * LOAD SAFETY: Node built-ins only and no other require, so it loads even when
 * the guard chain is broken. Callers require it lazily inside the failure
 * branch, so a healthy run loads no new module.
 *
 * A failing log write NEVER changes a verdict: every error is swallowed and the
 * function returns false.
 *
 * No em-dashes. License: BSL 1.1.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const OUTAGE_MODES = Object.freeze([
  'guard_load_failed',
  'sanitizer_load_failed',
  'classify_threw',
  'verdict_invalid',
  'hook_uncaught',
]);

function _logPath() {
  return path.join(os.homedir(), '.mindrian', 'telemetry', 'part8-guard-outage.log');
}

// The class comes from the tool name string only.
function _toolClass(toolName) {
  const n = typeof toolName === 'string' ? toolName.toLowerCase() : '';
  if (n.indexOf('brain') !== -1 || n.indexOf('theo') !== -1 || n.indexOf('pws-brain') !== -1) return 'brain';
  if (n.indexOf('websearch') !== -1 || n.indexOf('webfetch') !== -1 || n.indexOf('tavily') !== -1) return 'web';
  return 'other';
}

/**
 * Append one count-only outage line. Returns true when the line was written,
 * false on any failure. Never throws.
 *
 * @param {string} toolName  the tool name string (never the arguments)
 * @param {string} mode      one of OUTAGE_MODES (anything else is written as unknown)
 * @returns {boolean}
 */
function recordGuardOutage(toolName, mode) {
  try {
    const safeMode = OUTAGE_MODES.indexOf(mode) !== -1 ? mode : 'unknown';
    const line = new Date().toISOString() + ' ' + _toolClass(toolName) + ' ' + safeMode + '\n';
    const file = _logPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, line);
    return true;
  } catch (_e) {
    return false;
  }
}

module.exports = { recordGuardOutage, OUTAGE_MODES };
