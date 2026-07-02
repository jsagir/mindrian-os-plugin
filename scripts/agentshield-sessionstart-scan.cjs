#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 199-06 (AS-07) -- the AgentShield SessionStart drift-scan hook.
 * ==========================================================================
 * SEED-016's "continuous scanning mode" bullet, delivered the CC-native way the
 * amendment specifies: NOT a bespoke --watch daemon, but a SessionStart hook that
 * re-runs the shipped 199-04 orchestrator (runAgentShieldScan) once per session
 * and surfaces genuinely NEW drift through the same Shape F.1 Decision Gate the
 * drift-gate module (lib/hmi/agentshield-drift-gate.cjs) composes.
 *
 * A SessionStart hook INFORMS, it never blocks. There is NO fail-closed posture
 * here, unlike the Part-8 PreToolUse gate (scripts/part8-egress-guard-hook.cjs):
 *   - The whole body is wrapped in a fail-open try/catch PLUS an
 *     uncaughtException backstop (clone of part8-egress-guard-hook.cjs's outer
 *     wrap), so ANY internal error exits 0 silently.
 *   - A clean scan, or a scan whose only findings were already surfaced in a
 *     prior session (the local dedup cache), emits {continue:true} and exits 0
 *     with no gate -- the silent path.
 *   - A NEW flagged finding renders ONE Shape F.1 drift gate for the highest-
 *     severity new finding as additionalContext, then exits 0 (informs, never
 *     blocks).
 *
 * Local dedup cache: ~/.mindrian/agentshield/last-scan.json (NOT room.db, NOT a
 * tracked repo file -- plugin-install-level state, analogous to the shipped
 * ~/.mindrian/telemetry/query-efficiency.jsonl LOCAL cache precedent). Keyed by
 * surface+ruleId+id so the SAME finding never re-renders every session.
 *
 * Telemetry: every scan best-effort journals ONE scalars-only memory_event via
 * navigation.cjs's logMemoryEvent chokepoint -- surface slug + ruleId + count
 * ONLY, NEVER the scanned target bytes (Canon Part 8 LOCAL discipline). A
 * telemetry throw NEVER changes the exit code.
 *
 * Test seams (test-only, honored by tests/agentshield-sessionstart-hook.test.cjs):
 *   AGENTSHIELD_CACHE_DIR  -> point the local dedup cache at a temp dir so the
 *                            test never touches the developer's real cache.
 *   AGENTSHIELD_FORCE_DRIFT -> '1' forces a synthetic NEW flagged finding; '0'
 *                            forces a clean result -- so both branches are
 *                            deterministically exercisable without a live scan.
 *
 * Canon Part 7 (reuse before build): the scan logic is NOT reimplemented -- it
 * flows through runAgentShieldScan() from 199-04 and the drift-gate composition
 * from Task 1. Canon Part 8 (LOCAL): no network wire opens here.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only. Pure CJS, zero deps.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const RUN_PATH = path.join(REPO_ROOT, 'lib', 'core', 'security', 'agentshield-run.cjs');
const GATE_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'agentshield-drift-gate.cjs');
const NAVIGATION_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs');

// Worst-of verdict severity ranking (mirrors agentshield-run.cjs _VERDICT_RANK).
const VERDICT_RANK = { clean: 0, ambiguous: 1, flagged: 2 };

// ---------------------------------------------------------------------------
// stdin read (clone part8-egress-guard-hook.cjs readStdinSync).
// ---------------------------------------------------------------------------
function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_e) {
    return '';
  }
}

// Canonical SessionStart silent path: emit {continue:true} and exit 0. The hook
// NEVER blocks; a clean / already-seen scan adds nothing to context.
function emitContinue() {
  try {
    process.stdout.write(JSON.stringify({ continue: true }) + '\n');
  } catch (_e) { /* swallow */ }
  process.exit(0);
}

// Drift path: attach the rendered gate as additionalContext, then exit 0. Still
// {continue:true} -- a SessionStart hook informs, it never blocks the session.
function emitContinueWithGate(gateText) {
  try {
    process.stdout.write(JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: gateText,
      },
    }) + '\n');
  } catch (_e) { /* swallow */ }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Local dedup cache at ~/.mindrian/agentshield/last-scan.json (AGENTSHIELD_CACHE_DIR
// override for tests). Read/parse tolerantly; a missing / malformed cache means
// nothing has been surfaced yet.
// ---------------------------------------------------------------------------
function cacheDir() {
  if (process.env.AGENTSHIELD_CACHE_DIR) return process.env.AGENTSHIELD_CACHE_DIR;
  return path.join(os.homedir(), '.mindrian', 'agentshield');
}

function cacheFile() {
  return path.join(cacheDir(), 'last-scan.json');
}

function readCache() {
  try {
    const txt = fs.readFileSync(cacheFile(), 'utf8');
    const obj = JSON.parse(txt);
    if (obj && typeof obj === 'object' && Array.isArray(obj.keys)) return obj;
  } catch (_e) { /* fall through to empty */ }
  return { keys: [] };
}

function writeCache(scannedAt, keys) {
  try {
    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.writeFileSync(cacheFile(), JSON.stringify({ scannedAt: scannedAt, keys: keys }), 'utf8');
  } catch (_e) { /* best-effort: a cache write failure never blocks the session */ }
}

// ---------------------------------------------------------------------------
// Best-effort telemetry via navigation.cjs's logMemoryEvent chokepoint. Resolve
// the active room db, log ONE scalars-only memory_event, and close it. EVERY step
// is wrapped -- a telemetry failure NEVER changes the exit code and NEVER blocks
// the session (mirrors part8-egress-guard-hook.cjs bestEffortRecord).
// ---------------------------------------------------------------------------
function bestEffortLog(eventType, payload, sessionId) {
  let nav = null;
  let db = null;
  try {
    nav = require(NAVIGATION_PATH);
    const active = nav.detectActiveRoom && nav.detectActiveRoom();
    if (!active || !active.roomDir || !active.hasRoomDb) return;
    db = nav.openRoomDbForCaller(active.roomDir);
    if (!db) return;
    nav.logMemoryEvent(db, eventType, Object.assign({}, payload, {
      created_by: 'system',
      source_path: 'agentshield:sessionstart',
      sessionId: sessionId,
    }));
  } catch (_e) {
    // best-effort: swallow.
  } finally {
    try {
      if (db && nav && nav.closeRoomDbForCaller) nav.closeRoomDbForCaller(db);
    } catch (_e) { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Produce the scan report. Honors the AGENTSHIELD_FORCE_DRIFT test seam so both
// branches are deterministically exercisable without a live scan:
//   '1' -> a synthetic NEW flagged finding.
//   '0' -> a clean report (zero flagged).
// Absent the override, run the real 199-04 orchestrator.
// ---------------------------------------------------------------------------
function produceReport() {
  const forced = process.env.AGENTSHIELD_FORCE_DRIFT;
  if (forced === '1') {
    return {
      scannedAt: new Date().toISOString(),
      surfaces: { hook_scope: { verdict: 'flagged', findingCount: 1 } },
      totalFlagged: 1,
      totalAmbiguous: 0,
      findings: [
        { surface: 'hook_scope', id: 'forced.0', ruleId: 'AS-FORCED-DRIFT', reason: 'forced' },
      ],
    };
  }
  if (forced === '0') {
    return {
      scannedAt: new Date().toISOString(),
      surfaces: {},
      totalFlagged: 0,
      totalAmbiguous: 0,
      findings: [],
    };
  }
  const runAgentShieldScan = require(RUN_PATH).runAgentShieldScan;
  return runAgentShieldScan({});
}

// Rank a finding by the worst-of verdict of its surface (highest-severity first).
function _severity(report, finding) {
  const bucket = report.surfaces && report.surfaces[finding.surface];
  const verdict = (bucket && bucket.verdict) || 'ambiguous';
  return typeof VERDICT_RANK[verdict] === 'number' ? VERDICT_RANK[verdict] : 0;
}

// ---------------------------------------------------------------------------
// Main. Reads the SessionStart envelope (tolerant of garbage stdin), runs the
// scan, journals the outcome best-effort, and surfaces ONE gate for the highest-
// severity NEW finding -- or the silent path when clean / already-seen.
// ---------------------------------------------------------------------------
function main() {
  const raw = readStdinSync();
  let sessionId;
  try {
    const payload = JSON.parse(raw);
    if (payload && typeof payload === 'object' && typeof payload.session_id === 'string') {
      sessionId = payload.session_id;
    }
  } catch (_e) {
    // Garbage stdin is fine -- a SessionStart hook still informs. Continue with
    // an undefined sessionId.
  }

  const report = produceReport();
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const totalFlagged = typeof report.totalFlagged === 'number' ? report.totalFlagged : 0;

  const gate = require(GATE_PATH);
  const cache = readCache();

  // NEW findings = those the local dedup cache has not already surfaced.
  const newFindings = findings.filter(function (f) { return gate.shouldRender(cache, f); });

  // Best-effort telemetry: one scalars-only event describing the scan outcome.
  if (totalFlagged === 0) {
    bestEffortLog('agentshield_scan_clean', { count: 0 }, sessionId);
  } else {
    for (let i = 0; i < newFindings.length; i++) {
      bestEffortLog('agentshield_scan_flagged', {
        surface: newFindings[i].surface,
        ruleId: newFindings[i].ruleId,
        count: 1,
      }, sessionId);
    }
  }

  // Update the cache with EVERY current finding key so an already-surfaced finding
  // never re-renders next session (dedup across consecutive runs).
  const allKeys = cache.keys.slice();
  for (let i = 0; i < findings.length; i++) {
    const k = gate.findingKey(findings[i]);
    if (allKeys.indexOf(k) === -1) allKeys.push(k);
  }
  writeCache(report.scannedAt || new Date().toISOString(), allKeys);

  // Clean OR only-already-seen -> silent continue, no gate.
  if (newFindings.length === 0) {
    return emitContinue();
  }

  // Pick the highest-severity NEW finding (worst-of surface verdict; first wins
  // on a tie), then render ONE Shape F.1 drift gate for it.
  let top = newFindings[0];
  let topRank = _severity(report, top);
  for (let i = 1; i < newFindings.length; i++) {
    const r = _severity(report, newFindings[i]);
    if (r > topRank) { top = newFindings[i]; topRank = r; }
  }

  const rendered = gate.renderGate({
    surface: top.surface,
    findingCount: newFindings.length,
    ruleId: top.ruleId,
  });
  const gateText = rendered.zones.header + '\n' + rendered.zones.body;
  return emitContinueWithGate(gateText);
}

// Fail-OPEN outer wrap + uncaughtException backstop (clone part8-egress-guard-hook
// :208-216). A SessionStart hook must NEVER block a session: any error exits 0.
process.on('uncaughtException', function () {
  process.exit(0);
});

try {
  main();
} catch (_e) {
  process.exit(0);
}
