'use strict';
/*
 * lib/core/doctor/deprecated-usage-module.cjs -- Phase 217 Plan 03 (D-01/D-02).
 *
 * The class-L "deprecated-usage" doctor check, migrated out of the
 * doctor CLI inline main() block into a registry-driven cadence:always
 * runner. Check-only (fix_supported:false).
 *
 * WHAT IT DOES: scans recent (last-7-days) ~/.claude/projects/.../*.jsonl session
 * transcripts for `/mos:<deprecated>` command tokens and surfaces a per-command
 * "use /mos:<new>" migration hint. Conservative substring detection (it does not
 * parse transcripts); false positives are acceptable because the hint is
 * informational, never a hard gate.
 *
 * STATUS VOCABULARY NORMALIZED (Phase 217 D-03): the pre-migration inline block
 * returned the bespoke literals 'OK' / 'DEPRECATED_USAGE'. This runner returns
 * the standard vocabulary -- 'ok' (no deprecated uses), 'warn' (uses found),
 * 'skip' (transcripts dir absent) -- and preserves the old literal on a
 * `legacy_status` payload field for any consumer still keying off it.
 *
 * Contract: check(ctx) -> { status:'ok'|'warn'|'skip', detail:string, class:'L',
 *   action:string, deprecated_uses:[], legacy_status, scanned_files,
 *   transcripts_dir, action_lines? }. ctx.flags.transcriptsDir OR the
 *   MINDRIAN_DOCTOR_TRANSCRIPTS_DIR env var override the scan root (the hermetic-
 *   test seam -- the env-var name is preserved exactly).
 *
 * Canon Part 8: pure LOCAL scan -- zero network, zero Brain, zero telemetry.
 * Never back-requires the doctor CLI (circular).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

const DEPRECATED_RENAMES = {
  'heal':        'doctor --heal-room',
  'query':       'graph',
  'organize':    'rooms organize',
  'hmi-status':  'doctor --ui-compliance',
  'visualize':   'dashboard --mermaid',
  'diagnostics': 'fingerprint',
};

function check(ctx) {
  const c = ctx || {};
  const flags = (c.flags && typeof c.flags === 'object') ? c.flags : {};
  // Preserve the exact env-var override name (hermetic tests depend on it).
  const transcriptsDir = flags.transcriptsDir
    || process.env.MINDRIAN_DOCTOR_TRANSCRIPTS_DIR
    || path.join(homeDir(), '.claude', 'projects');

  // Skip when the transcripts dir is absent -- nothing to scan. Non-empty detail.
  if (!fs.existsSync(transcriptsDir)) {
    return {
      class: 'L',
      status: 'skip',
      legacy_status: 'OK',
      detail: 'deprecated-usage: transcripts dir absent (' + transcriptsDir + ') -- nothing to scan',
      action: 'no session transcripts directory present to scan',
      deprecated_uses: [],
      scanned_files: 0,
      transcripts_dir: transcriptsDir,
    };
  }

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - sevenDaysMs;
  const found = {};
  // Cap the recursive walk at depth 6 and total files 5000 for safety on
  // unusually deep transcript trees (defensive; Claude Code's standard layout is
  // two levels deep -- project-hash/session-*.jsonl).
  let scanned = 0;
  const MAX_FILES = 5000;
  const MAX_DEPTH = 6;
  function walk(dir, depth) {
    if (depth > MAX_DEPTH) return;
    if (scanned >= MAX_FILES) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (_) { return; }
    for (const e of entries) {
      if (scanned >= MAX_FILES) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (!e.isFile() || !/\.jsonl$/.test(e.name)) continue;
      scanned++;
      try {
        const st = fs.statSync(full);
        if (st.mtimeMs < cutoff) continue;
        const text = fs.readFileSync(full, 'utf8');
        for (const dep of Object.keys(DEPRECATED_RENAMES)) {
          // Word-boundary on the right: /mos:<dep>(space|newline|eof|non-word).
          const re = new RegExp('/mos:' + dep + '(?![A-Za-z0-9-])', 'g');
          const matches = text.match(re);
          if (matches) {
            if (!found[dep]) found[dep] = 0;
            found[dep] += matches.length;
          }
        }
      } catch (_) { /* unreadable file -- ignore */ }
    }
  }
  walk(transcriptsDir, 0);

  const deprecated_uses = Object.keys(found).sort().map(function (cmd) {
    return {
      deprecated: '/mos:' + cmd,
      replacement: '/mos:' + DEPRECATED_RENAMES[cmd],
      recent_uses: found[cmd],
    };
  });

  const hasUses = deprecated_uses.length > 0;
  // Normalized standard vocabulary; legacy literal preserved for old consumers.
  const status = hasUses ? 'warn' : 'ok';
  const legacy_status = hasUses ? 'DEPRECATED_USAGE' : 'OK';
  const action = hasUses
    ? 'you used ' + deprecated_uses.length + ' deprecated command(s) recently; consider migrating to the canonical names listed'
    : 'no deprecated commands used in the last 7 days';
  const detail = hasUses
    ? 'deprecated-usage: ' + deprecated_uses.length + ' deprecated command(s) used in the last 7 days'
    : 'deprecated-usage: no deprecated commands used in the last 7 days';

  const out = {
    class: 'L',
    status,
    legacy_status,
    detail,
    action,
    deprecated_uses,
    scanned_files: scanned,
    transcripts_dir: transcriptsDir,
  };
  if (hasUses) {
    // Fold the per-command hints into action_lines (the generic renderer prints
    // one dim sub-line each).
    out.action_lines = deprecated_uses.map(function (u) {
      return u.deprecated + ' used ' + u.recent_uses + 'x -> use ' + u.replacement;
    });
  }
  return out;
}

module.exports = {
  check,
  // exported for hermetic unit tests:
  DEPRECATED_RENAMES,
};
