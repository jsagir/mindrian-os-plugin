'use strict';
/*
 * lib/core/doctor/card-fire-health-module.cjs -- Phase 217 Plan-02 (D-05).
 *
 * A cadence:always, fix_supported:false, flag:cardFireHealth doctor module.
 *
 * WHAT IT DOES: reports the HEALTH of the card-fire self-diagnostic INSTRUMENT
 * (scripts/check-card-fire.cjs). It applies the 2026-07-11 printer-must-match-
 * counter lesson to the sibling self-diagnostic surface: a diagnostic is only
 * trustworthy if its own log, its classifier/counter seams, its render-coverage
 * substrate, and its session store are all intact.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it does NOT attempt to resolve the OPEN
 * stale-plugin-cache mystery tracked in
 * .planning/debug/live-session-running-stale-plugin-cache-fixes-inert.md.
 * That mystery NEEDS this instrument healthy; this module only verifies the
 * instrument exists and is intact, it never chases the mystery.
 *
 * Canon Part 8 (Graph Boundary): every check is LOCAL -- file reads under
 * ~/.mindrian plus a require of the sibling script. ZERO network. It never
 * throws (soft-fail -> a warn finding), so a bad instrument becomes a doctor
 * row, never a crash.
 *
 * Contract: check(ctx) -> { status: 'ok'|'warn', detail: string, action_lines? }.
 * No fix export (fix_supported:false; the contract-parity gate enforces the
 * two-way declaration).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// STALENESS_WINDOW_MS: 14 days. A GENEROUS default -- genuine intercepts are
// rare, so a fresh install with no recent intercepts is NOT stale-broken.
// ctx.staleness_ms overrides (test seam).
const STALENESS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// interceptLogPath(): mirror scripts/check-card-fire.cjs EXACTLY (MINDRIAN_HOME
// override honored) so this module inspects the same file the writer emits.
// Exported for hermetic tests.
function mindrianHome() {
  return process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian');
}
function interceptLogPath() {
  return path.join(mindrianHome(), 'card-fire-intercepts.log');
}

function check(ctx) {
  const c = ctx || {};
  // Test seam: ctx.log_path wins; otherwise the MINDRIAN_HOME-resolved default.
  const logPath = typeof c.log_path === 'string' ? c.log_path : interceptLogPath();
  // The retry/session store lives beside the log (same home dir); deriving it
  // from the log path keeps the tests hermetic (a scratch dir has neither).
  const home = path.dirname(logPath);
  const stalenessMs = Number.isFinite(c.staleness_ms) ? c.staleness_ms : STALENESS_WINDOW_MS;
  const now = Date.now();
  const findings = [];

  // (a) Log existence. An absent file is a healthy fresh install (no intercepts
  //     recorded yet), NOT breakage.
  let logExists = false;
  try { logExists = fs.existsSync(logPath) && fs.statSync(logPath).isFile(); } catch (_) { logExists = false; }

  let parsed = 0;
  let malformed = 0;
  let newestTs = null;
  if (logExists) {
    let raw = '';
    try { raw = fs.readFileSync(logPath, 'utf8'); } catch (_) { raw = ''; }
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      let obj;
      // (b) JSONL integrity: per-line try/catch (the repo idiom).
      try { obj = JSON.parse(t); } catch (_e) { malformed += 1; continue; }
      parsed += 1;
      // (c) Freshness: the writer emits `ts` (epoch ms) per CR-07.
      if (obj && Number.isFinite(obj.ts)) {
        if (newestTs === null || obj.ts > newestTs) newestTs = obj.ts;
      }
    }
    if (malformed > 0) {
      findings.push('JSONL integrity: ' + malformed + ' malformed line(s) in ' + logPath);
    }
    // (c) Freshness. An empty / TTL-pruned log (parsed === 0) is 'ok' (nothing
    //     to be stale about). When lines exist but none carried ts, fall back
    //     to the file mtime.
    let freshnessTs = newestTs;
    if (freshnessTs === null && parsed > 0) {
      try { freshnessTs = fs.statSync(logPath).mtimeMs; } catch (_) { freshnessTs = null; }
    }
    if (freshnessTs !== null && (now - freshnessTs) > stalenessMs) {
      findings.push('freshness: newest intercept is stale (older than ' + stalenessMs + 'ms window)');
    }
  }

  // (d) Library-seam parity (the sibling lesson): the classifier + counter seams
  //     the printer-matches-counter fix and this module's future assertions
  //     depend on must stay exported. require is safe (require.main guard in
  //     check-card-fire.cjs). A missing seam -> warn naming it.
  let cf = null;
  try {
    cf = require(path.join(__dirname, '..', '..', '..', 'scripts', 'check-card-fire.cjs'));
    for (const seam of ['classifyCardFire', 'gateReachingEntries', 'computeBackstopHit', 'loadRegistry']) {
      if (typeof cf[seam] !== 'function') {
        findings.push('library seam missing: check-card-fire.' + seam + '()');
      }
    }
  } catch (e) {
    findings.push('library seam: require(check-card-fire.cjs) threw: ' + (e && e.message));
  }

  // (e) Render-coverage instrument: the substrate loadRegistry() reads must parse.
  if (cf && typeof cf.loadRegistry === 'function') {
    try {
      const reg = cf.loadRegistry();
      if (!reg || typeof reg !== 'object') {
        findings.push('render-coverage registry did not parse to an object');
      }
    } catch (_e) {
      findings.push('render-coverage registry read threw');
    }
  }

  // (f) Session/statusline state: the retry/session store (card-fire-retries.json)
  //     is where the statusline reflects card-fire/session state. When present it
  //     must JSON-parse; a corrupt store is instrument breakage.
  const storePath = path.join(home, 'card-fire-retries.json');
  try {
    if (fs.existsSync(storePath)) {
      JSON.parse(fs.readFileSync(storePath, 'utf8'));
    }
  } catch (_e) {
    findings.push('session store unparseable: ' + storePath);
  }

  // (g) Aggregate. Any finding -> overall warn with a detail that names the
  //     findings (so the generic renderer's row body is self-explanatory);
  //     all clean -> ok. Every return path carries a non-empty detail (D-03).
  if (findings.length > 0) {
    return {
      status: 'warn',
      detail: 'card-fire-health: ' + findings.length + ' instrument finding(s) -- ' + findings.join('; '),
      action_lines: findings,
    };
  }
  if (!logExists) {
    return { status: 'ok', detail: 'card-fire-health: no intercept log yet (no intercepts recorded)' };
  }
  return { status: 'ok', detail: 'card-fire-health: instrument healthy (' + parsed + ' intercept(s), seams + store intact)' };
}

module.exports = {
  check,
  STALENESS_WINDOW_MS,
  // exported for hermetic tests:
  interceptLogPath,
};
