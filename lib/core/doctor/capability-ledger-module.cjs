'use strict';
/*
 * lib/core/doctor/capability-ledger-module.cjs -- Phase 265 Plan 01 Task 3.
 *
 * A cadence:always, fix_supported:false, flag:null doctor module (mirrors
 * lib/core/doctor/mode-select-checkpoint-module.cjs's check(ctx) contract).
 *
 * WHAT IT DOES: reads data/capability-ledger.json and compares its
 * ledger_covers.to against the installed Claude Code version. Phase 138's
 * capability ledger died as a markdown table nobody re-checked; this module
 * is the structural control that stops the same rot: a stale ledger
 * surfaces a 'warn' finding on doctor --acceptance, never a silent 'ok'.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it never blocks anything (only 'ok',
 * 'warn', or 'error' -- never a hard failure that aborts doctor itself), and
 * it never auto-remediates (fix_supported is false; refreshing the ledger is
 * /mos:radar --fetch's job in a later Phase 265 plan, not this organ's).
 *
 * Canon Part 8 (Graph Boundary): zero network calls beyond the local
 * `claude --version` subprocess. No Brain, no fetch.
 *
 * Contract: check(ctx) -> { status: 'ok'|'warn'|'error', detail: string }.
 * No fix export (fix_supported:false; the contract-parity gate enforces the
 * two-way declaration).
 *
 * ctx.installed_version (string) is a test seam that wins when explicitly
 * provided, matching the ctx-seam convention in
 * mode-select-checkpoint-module.cjs. Production default: shell out to
 * `claude --version` and take the leading dotted triple from output shaped
 * like "2.1.247 (Claude Code)".
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const LEDGER_PATH = path.join(__dirname, '..', '..', '..', 'data', 'capability-ledger.json');

const DEFAULT_MAX_VERSION_LAG = 40;

const DOTTED_VERSION_PATTERN = /(\d+)\.(\d+)\.(\d+)/;

function parseDotted(versionStr) {
  if (typeof versionStr !== 'string') return null;
  const m = versionStr.match(DOTTED_VERSION_PATTERN);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/**
 * Reads the installed Claude Code version by shelling out to `claude
 * --version`. Returns the leading dotted-triple string, or null if the
 * binary is unavailable or output is unparseable.
 */
function readInstalledVersionFromBinary() {
  try {
    const out = execFileSync('claude', ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    const m = out.match(DOTTED_VERSION_PATTERN);
    return m ? m[0] : null;
  } catch (_e) {
    return null;
  }
}

function check(ctx) {
  const c = ctx || {};

  let raw;
  try {
    raw = fs.readFileSync(LEDGER_PATH, 'utf8');
  } catch (_e) {
    return {
      status: 'error',
      detail: 'capability-ledger: could not read ' + LEDGER_PATH,
    };
  }

  let ledger;
  try {
    ledger = JSON.parse(raw);
  } catch (_e) {
    return {
      status: 'error',
      detail: 'capability-ledger: ' + LEDGER_PATH + ' is not valid JSON',
    };
  }

  const ledgerTo = ledger && ledger.ledger_covers && ledger.ledger_covers.to;
  const ledgerVersion = parseDotted(ledgerTo);
  if (!ledgerVersion) {
    return {
      status: 'error',
      detail: 'capability-ledger: ledger_covers.to missing or unparseable in ' + LEDGER_PATH,
    };
  }

  // Test seam wins when explicitly provided (including explicit null, which
  // simulates an unreadable binary without actually shelling out).
  let installedStr;
  if (typeof c.installed_version === 'string') {
    installedStr = c.installed_version;
  } else if (c.installed_version === null) {
    installedStr = null;
  } else {
    installedStr = readInstalledVersionFromBinary();
  }

  const installedVersion = parseDotted(installedStr);
  if (!installedVersion) {
    // Never return 'ok' on an unknown version -- a silent pass is the
    // failure mode this whole phase exists to end.
    return {
      status: 'warn',
      detail:
        'capability-ledger: installed Claude Code version could not be read (claude --version unavailable or unparseable)',
    };
  }

  if (
    installedVersion.major !== ledgerVersion.major ||
    installedVersion.minor !== ledgerVersion.minor
  ) {
    return {
      status: 'warn',
      detail:
        'capability-ledger: major/minor mismatch between installed (' +
        installedStr +
        ') and ledger_covers.to (' +
        ledgerTo +
        '); run /mos:radar --fetch to refresh data/capability-ledger.json',
    };
  }

  const threshold = (() => {
    const envVal = process.env.MINDRIAN_LEDGER_MAX_VERSION_LAG;
    const parsed = Number(envVal);
    return envVal !== undefined && Number.isFinite(parsed) ? parsed : DEFAULT_MAX_VERSION_LAG;
  })();

  const lag = installedVersion.patch - ledgerVersion.patch;

  if (lag > threshold) {
    return {
      status: 'warn',
      detail:
        'capability-ledger: installed ' +
        installedStr +
        ' is ' +
        lag +
        ' patch version(s) ahead of ledger_covers.to (' +
        ledgerTo +
        '), threshold ' +
        threshold +
        '; run /mos:radar --fetch to refresh data/capability-ledger.json',
    };
  }

  return {
    status: 'ok',
    detail:
      'capability-ledger: installed ' + installedStr + ' is within ' + lag + ' patch version(s) of ledger_covers.to (' + ledgerTo + ')',
  };
}

module.exports = {
  check: check,
};
