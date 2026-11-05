'use strict';
/*
 * lib/core/doctor/room-runtime-module.cjs -- doctor module for the room runtime and the hook shell.
 * Phase 383 plan 09 (SEED-142 direction 4, D-07). Names the bash and the Python that room creation
 * would use, their versions, every candidate tried, and the shell hooks/run-hook.cmd would pick on
 * Windows. Contract: check(ctx) -> { status:'ok'|'warn'|'error', detail, action_lines? }.
 * fix_supported:false. NO fix export. Never writes. LOCAL facts only: no Brain call (Canon Part 8).
 */
const platform = require('../platform.cjs');

const SEED_REF = 'SEED-144';

function check(_ctx) {
  try {
    const rt = platform.resolveRoomRuntime({ refresh: true });
    const hook = platform.resolveHookShell();
    const bashPart = rt.bash ? rt.bash.path + ' (' + (rt.bash.ostype || 'unknown') + ')' : 'none';
    const pyPart = rt.python ? rt.python.path + ' (' + (rt.python.version_line || rt.python.version) + ')' : 'none';
    const hookPart = (hook.path || 'none') + ' (' + hook.kind + ')';
    const detail = 'bash: ' + bashPart + '; python: ' + pyPart + '; hooks: ' + hookPart +
      '; tried: ' + platform.formatTried(rt.tried);

    const hookBad = process.platform === 'win32' && hook.kind !== 'git-bash';
    if (rt.ok && !hookBad) return { status: 'ok', detail: detail };

    const lines = [];
    if (!rt.ok) {
      String(rt.plain || '').split('\n').forEach(function (l) { if (l.trim()) lines.push(l.trim()); });
    }
    if (hookBad) {
      lines.push('Hooks: install Git for Windows so the hooks run in Git Bash (see ' + SEED_REF + ')');
      if (hook.note) lines.push('Hooks: ' + hook.note);
    }
    return { status: 'warn', detail: detail, action_lines: lines };
  } catch (err) {
    return { status: 'error', detail: 'room-runtime check failed: ' + String((err && err.message) || err).slice(0, 160) };
  }
}

module.exports = { check };
