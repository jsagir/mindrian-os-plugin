#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95.2-01 (D-09) -- one-line warning formatter for SessionStart preflight.
 *
 * Two modes:
 *   1. Library mode -- `require('./doctor-preflight-format.cjs').formatPreflightWarning(report, opts)`.
 *   2. CLI mode -- `node scripts/doctor-preflight-format.cjs` reads JSON on stdin, prints warning to stdout.
 *
 * Suppressed (returns empty / writes nothing) when the install is healthy.
 * Honors BOTH MOS_NO_COLOR=1 (CONTEXT.md D-09 parity) and standard NO_COLOR=1
 * (project convention per scripts/vault-export-orchestrator.cjs:33).
 *
 * D-09 final string:
 *   "MindrianOS install dir {missing|drifted}; run /mos:doctor --fix to recover. Backup: {path}."
 *
 * Canon Part 8: zero network surface. Pure local file I/O on a directory the
 * caller already passes in. No fetch, no http, no curl.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/**
 * Format the preflight warning for a doctor report.
 * @param {object} report -- parsed doctor.cjs --json output (or null/undefined).
 * @param {object} opts   -- { color?: boolean, backupDir?: string, pluginHome?: string }
 * @returns {string} -- the warning line (with trailing newline) or '' when healthy.
 */
function formatPreflightWarning(report, opts) {
  opts = opts || {};
  if (!report || typeof report !== 'object') return '';
  const drift = report.drift || {};
  const install = report.install || {};
  // Suppression rule: only fire on drift.detected (covers both legacy drift
  // and the 95.2 missing-install case after Plan 95.2-00 lands).
  if (!drift.detected) return '';
  const what = (install.status === 'missing') ? 'missing' : 'drifted';
  // Backup path resolution: caller may pass backupDir explicitly, OR we
  // discover by listing pluginHome for stale-* siblings (most-recent first).
  let backupPath = opts.backupDir || null;
  if (!backupPath && opts.pluginHome) {
    try {
      const entries = fs.readdirSync(opts.pluginHome, { withFileTypes: true });
      const stales = entries
        .filter((e) => e.isDirectory() && e.name.startsWith('mindrian-os.stale-'))
        .map((e) => ({ name: e.name, full: path.join(opts.pluginHome, e.name) }))
        .sort((a, b) => {
          try {
            return fs.statSync(b.full).mtimeMs - fs.statSync(a.full).mtimeMs;
          } catch (_) { return 0; }
        });
      if (stales.length > 0) backupPath = stales[0].full;
    } catch (_) { /* directory unreadable -- omit backup info */ }
  }
  const useColor = !!opts.color;
  const yellow = useColor ? '\x1b[33m' : '';
  const reset = useColor ? '\x1b[0m' : '';
  let line = '⚠ MindrianOS install dir ' + what + '; run /mos:doctor --fix to recover.';
  if (backupPath) line += ' Backup: ' + backupPath + '.';
  return yellow + line + reset + '\n';
}

function shouldUseColor() {
  // D-09: strip color if MOS_NO_COLOR=1. Project convention also honors NO_COLOR.
  if (process.env.MOS_NO_COLOR === '1') return false;
  if (process.env.NO_COLOR) return false;
  return process.stderr.isTTY === true;
}

function readStdinJson() {
  return new Promise((resolve) => {
    let data = '';
    const t = setTimeout(() => resolve(data), 500);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => { clearTimeout(t); resolve(data); });
    process.stdin.on('error', () => { clearTimeout(t); resolve(''); });
  });
}

async function cliMain() {
  const raw = await readStdinJson();
  if (!raw) { process.exit(0); }
  let report;
  try { report = JSON.parse(raw); } catch (_) { process.exit(0); /* graceful suppress on garbage */ }
  const pluginHome = process.env.MINDRIAN_PLUGIN_HOME || path.join(os.homedir(), '.claude/plugins');
  const out = formatPreflightWarning(report, { color: shouldUseColor(), pluginHome });
  if (out) process.stdout.write(out);
  process.exit(0);
}

module.exports = { formatPreflightWarning, shouldUseColor };

if (require.main === module) {
  cliMain().catch(() => process.exit(0));
}
