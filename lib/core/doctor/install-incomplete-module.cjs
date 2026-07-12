'use strict';
/*
 * lib/core/doctor/install-incomplete-module.cjs -- Phase 217 Plan 05 (D-01).
 *
 * The class-H "install-incomplete" doctor check + fix, migrated out of the
 * doctor CLI inline main() block into a registry-driven cadence:always runner.
 * Class H shares class G's activation flag (statuslineVisibility): today's exact
 * behavior is that --statusline-visibility surfaces BOTH checks, so the registry
 * gives both runners flag 'statuslineVisibility'.
 *
 * WHAT check() DOES (moved checkInstallIncomplete verbatim, paths re-based): the
 * "silent install-incomplete" failure mode (Phase 95.6 D-09) -- commands + Larry
 * present but ~/.claude/settings.json has no .statusLine block so the bottom-of-
 * terminal statusline never renders. Orthogonal to class G:
 *   (a) ~/.claude/plugins/mindrian-os/.install-receipt.json shows every canonical
 *       step ran with completed_at stamped; a halted receipt names the missing
 *       tail steps. recoverable iff the ONLY missing step is register_statusline.
 *   (b) no usable receipt -> does ~/.claude/settings.json have a .statusLine
 *       block at all? Missing -> warn, recoverable (--fix writes it).
 * DESKTOP/COWORK -> status skip (CLI-only). On the warn+recoverable path check()
 * emits action_lines carrying the migrated hint sub-line the old hand-coded H
 * render branch printed.
 *
 * WHAT fix() DOES (moved performClassHFix) with a RUNNER-INTERNAL STRICTER GATE:
 * the engine's generic fix gate is recoverable !== false, but class H's
 * historical dispatch gated on recoverable === true (STRICTER). To preserve
 * semantics exactly, fix() returns { status:'skip', detail } WITHOUT touching
 * anything when ctx.check_result.recoverable !== true. On the recoverable path
 * it writes the canonical statusLine block into ~/.claude/settings.json
 * idempotently (it does NOT re-run install.sh -- the missing-tail-steps case is
 * report-only). The returned record preserves the raw tool field
 * ('doctor-class-h') plus status/detail.
 *
 * Canon Part 8: pure LOCAL read + local idempotent settings.json write -- zero
 * network, zero Brain. Never back-requires the doctor CLI (circular). Requires
 * only node built-ins + ./shared.cjs (PLUGIN_ROOT, INSTALL_DIR).
 *
 * Threat register (Phase 217 Plan 05): T-217-01 (self-DoS) -- the engine wraps
 * check + fix in try/catch; fix soft-fails on any write error.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { PLUGIN_ROOT, INSTALL_DIR, resolveActivePluginRoot } = require('./shared.cjs');

const INSTALL_RECEIPT_JSON = path.join(INSTALL_DIR, '.install-receipt.json');

const CLASS_H_CANONICAL_STEPS = [
  'preflight',
  'clone',
  'register_statusline',
  'register_commands',
  'register_skills',
  'register_agents',
  'configure_hooks',
];

function classHActionString() {
  return 'writes the canonical MindrianOS statusLine block (bash "<install-dir>/scripts/statusline-mos") into ~/.claude/settings.json';
}

function userSettingsHasStatusLine() {
  const userSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let userSettings = null;
  try {
    if (fs.existsSync(userSettingsPath)) {
      userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
    }
  } catch (_e) { /* treat as no settings */ }
  const sl = userSettings && userSettings.statusLine;
  return !!(sl && typeof sl === 'object' && typeof sl.command === 'string' && sl.command.length > 0);
}

function check(ctx) {
  const result = _check();
  const c = ctx || {};

  // Shared-flag coupling with class G (statusline-visibility). G and H both act on
  // ~/.claude/settings.json .statusLine with OPPOSITE fixes: G REMOVES a stale
  // user-level override so plugin-level config applies; H WRITES the block when it
  // is missing. Pre-migration, main() computed ALL class checks BEFORE dispatching
  // ANY fix, so H's check saw the override still present (returned ok) and H's fix
  // never fought G's removal. The accumulative engine instead runs G fully
  // (check + fix + recheck) BEFORE H's check (registry order), so by the time H
  // runs the override G just removed is already gone -- and H's Step-2 heuristic
  // ("no receipt + no statusLine -> incomplete") would misfire and re-stamp it,
  // undoing G and, on a real marketplace-cache install, re-introducing a broken
  // legacy-path override. Preserve the pre-migration semantics: if G's fix ran
  // THIS invocation, H must NOT read the now-missing override as an incomplete
  // install. The engine records G's fix as ctx.checks['statusline-visibility']
  // .fix_result. This guard is scoped to the Step-2 settings-based warn only (the
  // receipt-halted warn carries missingSteps[] and is orthogonal to G).
  const gResult = c.checks && c.checks['statusline-visibility'];
  const gFixedThisRun = !!(gResult && gResult.fix_result);
  if (gFixedThisRun && result && result.status === 'warn'
      && result.recoverable === true && !Array.isArray(result.missingSteps)) {
    return {
      status: 'ok',
      detail: 'statusLine override removed by statusline-visibility --fix this run; plugin-level config applies',
      evidence: (result.evidence || []).concat(['deferred to statusline-visibility fix (shared --statusline-visibility flag)']),
      recoverable: false,
      action: result.action,
    };
  }

  // Migrated hint sub-line: the deleted class-H render branch printed
  // '-> /mos:doctor --statusline-visibility --fix re-stamps the statusLine block'
  // ONLY when (status === 'warn' && recoverable === true). Mirror that condition
  // exactly via the generic renderer's action_lines[] sub-line support.
  if (result && result.status === 'warn' && result.recoverable === true) {
    result.action_lines = ['/mos:doctor --statusline-visibility --fix re-stamps the statusLine block'];
  }
  return result;
}

function _check() {
  // Step 0 -- Desktop carve-out (mirror class G).
  let surface = 'CLI';
  try {
    const mod = require(path.join(PLUGIN_ROOT, 'lib', 'statusline', 'surface-detect.cjs'));
    surface = mod.detectStatuslineSurface();
  } catch (_e) {
    if (process.env.CLAUDE_DESKTOP === '1') surface = 'DESKTOP';
  }
  if (surface !== 'CLI') {
    return {
      status: 'skip',
      detail: 'class H (install-incomplete) is CLI-only -- ' + surface + ' has no statusline primitive',
      evidence: ['surface=' + surface],
      recoverable: false,
      action: classHActionString(),
    };
  }

  // Step 0.5 -- topology awareness (RCA intern-w1-statusline-room-mismatch,
  // mirrors the Class A guard in install-state-module.cjs / active-plugin-
  // root.cjs). Steps 1-2 below exist ONLY to detect a halted legacy install.sh
  // dev-clone flow -- that is the ONLY flow that ever writes
  // .install-receipt.json under INSTALL_DIR, or that ever NEEDS a user-level
  // statusLine override (the plugin's own settings.json uses
  // ${CLAUDE_PLUGIN_ROOT} and resolves on its own). Under marketplace-cache
  // topology, Claude Code's own plugin install is atomic: a resolvable active
  // root with a valid plugin.json IS "install complete" for that topology, and
  // the absence of either legacy artifact is NORMAL, not incomplete. Without
  // this guard, class H false-positived 'warn' on every healthy one-command
  // marketplace install, and fix() then wrote a statusLine override pointing
  // at the hardcoded legacy INSTALL_DIR, which does not exist on a
  // marketplace-cache-only machine -- silently breaking the statusline
  // (user-level settings override plugin-level).
  try {
    const active = resolveActivePluginRoot();
    if (active && active.topology === 'marketplace-cache' && active.root) {
      const activePluginJson = path.join(active.root, '.claude-plugin', 'plugin.json');
      if (fs.existsSync(activePluginJson)) {
        return {
          status: 'ok',
          detail: 'marketplace-cache install complete (active root resolved; this topology needs '
            + 'neither a legacy .install-receipt.json nor a user-level statusLine override)',
          evidence: ['active root: ' + active.root, 'topology=marketplace-cache'],
          recoverable: false,
          action: classHActionString(),
        };
      }
    }
  } catch (_e) { /* fall through to the legacy receipt/override logic below */ }

  // Step 1 -- read the install receipt, if present.
  let receipt = null;
  let receiptParseError = false;
  if (fs.existsSync(INSTALL_RECEIPT_JSON)) {
    try {
      receipt = JSON.parse(fs.readFileSync(INSTALL_RECEIPT_JSON, 'utf8'));
    } catch (_e) { receiptParseError = true; }
  }

  if (receipt && typeof receipt === 'object' && !receiptParseError) {
    const ranNames = Array.isArray(receipt.steps)
      ? receipt.steps.map((s) => (s && s.name)).filter(Boolean)
      : [];
    const missing = CLASS_H_CANONICAL_STEPS.filter((n) => ranNames.indexOf(n) === -1);
    const completed = receipt.completed_at !== null && receipt.completed_at !== undefined;
    if (completed && missing.length === 0) {
      return {
        status: 'ok',
        detail: 'install complete (.install-receipt.json shows all ' + CLASS_H_CANONICAL_STEPS.length + ' steps ran)',
        evidence: ['receipt: ' + INSTALL_RECEIPT_JSON, 'completed_at=' + receipt.completed_at],
        recoverable: false,
        action: classHActionString(),
      };
    }
    // Halted install. recoverable only when register_statusline is literally
    // the one missing step -- then --fix can restamp it. Otherwise re-running
    // install.sh is the user's call (report-only).
    const onlyStatuslineMissing = missing.length === 1 && missing[0] === 'register_statusline';
    return {
      status: 'warn',
      detail: 'install halted -- missing steps: ' + (missing.length ? missing.join(', ') : '(none, but completed_at is null)'),
      evidence: [
        'receipt: ' + INSTALL_RECEIPT_JSON,
        'completed_at=' + JSON.stringify(receipt.completed_at),
        'ran: ' + (ranNames.length ? ranNames.join(', ') : '(none)'),
      ],
      missingSteps: missing,
      recoverable: onlyStatuslineMissing,
      action: classHActionString(),
    };
  }

  // Step 2 -- no usable receipt. Check whether ~/.claude/settings.json has a
  // statusLine block at all (class H's "EXISTS" check, distinct from class G's
  // "RESOLVES" check). Missing -> install incomplete, recoverable via --fix.
  if (userSettingsHasStatusLine()) {
    return {
      status: 'ok',
      detail: 'statusLine block present in ~/.claude/settings.json',
      evidence: receiptParseError
        ? ['.install-receipt.json present but not valid JSON; statusLine block check passed']
        : ['no .install-receipt.json on disk; statusLine block check passed'],
      recoverable: false,
      action: classHActionString(),
    };
  }
  return {
    status: 'warn',
    detail: 'statusLine block missing from ~/.claude/settings.json (install.sh halted before register_statusline, or a manual recovery skipped it)',
    evidence: [
      receiptParseError
        ? '.install-receipt.json present but not valid JSON'
        : 'no .install-receipt.json on disk',
      'no .statusLine block in ' + path.join(os.homedir(), '.claude', 'settings.json'),
    ],
    recoverable: true,
    action: classHActionString(),
  };
}

// fix(ctx) -- moved performClassHFix. RUNNER-INTERNAL STRICTER GATE: class H's
// historical dispatch gated on recoverable === true (stricter than the engine's
// generic recoverable !== false). Enforce it here so semantics are preserved
// exactly: skip (touching nothing) unless ctx.check_result.recoverable === true.
function fix(ctx) {
  const c = ctx || {};
  const checkResult = c.check_result || {};
  if (checkResult.recoverable !== true) {
    return {
      status: 'skip',
      detail: 'install-incomplete: not recoverable, no fix attempted',
    };
  }

  // Defense-in-depth topology guard (RCA intern-w1-statusline-room-mismatch),
  // mirrors the Step 0.5 guard in check() above. check() now short-circuits to
  // status:'ok', recoverable:false under marketplace-cache topology, so the
  // engine's dispatch gate no longer calls this fix() in that state -- but
  // refuse the write here too, in case this function is ever invoked directly/
  // out-of-band. This is the exact write that broke the statusline on
  // marketplace-cache-only machines: it points at the hardcoded legacy
  // INSTALL_DIR, which does not exist there, and user-level settings override
  // plugin-level settings.
  let active = null;
  try { active = resolveActivePluginRoot(); } catch (_e) { /* ignore, fall through */ }
  if (active && active.topology === 'marketplace-cache') {
    return {
      tool: 'doctor-class-h',
      action: classHActionString(),
      exit_code: 0,
      changed: false,
      status: 'skip',
      detail: 'skipped: marketplace-cache topology does not need a user-level statusLine override '
        + '(plugin-level settings.json already resolves it via ${CLAUDE_PLUGIN_ROOT})',
    };
  }

  const userSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  const want = {
    type: 'command',
    command: 'bash "' + path.join(INSTALL_DIR, 'scripts', 'statusline-mos') + '"',
  };
  try {
    let s = {};
    if (fs.existsSync(userSettingsPath)) {
      try { s = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8')); } catch (_e) { s = {}; }
    }
    if (!s || typeof s !== 'object') s = {};
    const cur = s.statusLine;
    const alreadyGood = cur && typeof cur === 'object' && cur.command === want.command;
    if (!alreadyGood) {
      s.statusLine = want;
      fs.mkdirSync(path.dirname(userSettingsPath), { recursive: true });
      fs.writeFileSync(userSettingsPath, JSON.stringify(s, null, 2));
    }
    return {
      tool: 'doctor-class-h',
      action: classHActionString(),
      exit_code: 0,
      changed: !alreadyGood,
      target: userSettingsPath,
      status: 'ok',
      detail: alreadyGood
        ? 'statusLine block already canonical; no change'
        : 'wrote canonical statusLine block into ~/.claude/settings.json',
    };
  } catch (err) {
    return {
      tool: 'doctor-class-h',
      action: classHActionString(),
      exit_code: -1,
      changed: false,
      detail: err.message,
      status: 'error',
    };
  }
}

module.exports = {
  check,
  fix,
};
