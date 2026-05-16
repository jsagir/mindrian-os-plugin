#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 117-01 Wave 1 -- SessionStart preflight + stale-sweep recovery.
 * Phase 117-03 Wave 2 -- SessionStart drain extension (orphan recovery + Desktop fallback).
 *
 * In Wave 1 this hook ONLY:
 *   1. Resolves roomDir + roomSlug
 *   2. Calls store.sweepStaleInFlight(roomSlug, {staleMs: 300000}) per
 *      RESEARCH scenario 7 (5min stale recovery: in_flight entries older
 *      than 5min get transitioned to 'failed' so the next material_id
 *      detection can fire fresh)
 *   3. Exits envelope continue:true (no additionalContext yet)
 *
 * In Wave 2 (this plan) this hook ALSO:
 *   4. Globs room/.mindrian/auto-explore-*.json for completed-but-unsurfaced findings
 *   5. Mirrors auto-explore-drain.cjs flow (selectTopFinding + surfaceFinding)
 *   6. Composes Larry-voice directive in additionalContext (hookEventName='SessionStart')
 *   7. Marks surfaced=true in ledger after directive emits
 *
 * This is the SessionStart-recovery path: orphan findings from a previous
 * session OR Desktop-mode users (no PostToolUse hook on Desktop) recover
 * via SessionStart instead of UserPromptSubmit. The two drains share logic
 * but differ in hookEventName.
 *
 * Per Canon Part 8: zero outbound network surface, zero remote-MCP-client require.
 * Per Phase 109 D-06: zero direct room-db.cjs require (chokepoint preserved).
 *
 * ALWAYS exits 0; never blocks the hook chain. uncaughtException catcher
 * guarantees the envelope still fires.
 *
 * Pure CJS, node built-ins only.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const store = require('../lib/memory/explored-materials-store.cjs');

// Lazy-loaded; agent is optional for the drain extension only -- load failure
// must never block the SessionStart hook chain (Wave-1 sweep still runs).
let agent = null;
try {
  agent = require('../lib/agents/auto-explore-agent.cjs');
} catch (_e) {
  agent = null;
}

// ---------- Envelope helpers (mirrors scripts/preflight-tension-surface.cjs) ----------

const ENVELOPE_ALLOWED = new Set([
  'decision', 'reason', 'continue', 'stopReason',
  'suppressOutput', 'systemMessage', 'hookSpecificOutput',
]);
const HOOK_EVENT_NAME = 'SessionStart';
const MAX_FINDINGS_PER_TURN = 1;

function emitEnvelope(envelope) {
  const filtered = {};
  for (const k of Object.keys(envelope || {})) {
    if (ENVELOPE_ALLOWED.has(k)) filtered[k] = envelope[k];
  }
  if (filtered.continue === undefined) filtered.continue = true;
  process.stdout.write(JSON.stringify(filtered));
  process.exit(0);
}

function emitEmpty() {
  emitEnvelope({ continue: true });
}

// Backstop: any uncaught exception lands here and the envelope still emits.
// This is the "ALWAYS exits 0" contract from RESEARCH Section 7.3 -- the
// SessionStart hook chain is never blocked by a sweep failure. The hook
// must NEVER trip the user's session start.
process.on('uncaughtException', () => emitEmpty());

// ---------- Room resolution ----------

function resolveRoomDir() {
  if (typeof process.env.MINDRIAN_ROOM_DIR === 'string' && process.env.MINDRIAN_ROOM_DIR.length > 0) {
    return process.env.MINDRIAN_ROOM_DIR;
  }
  return process.cwd();
}

function roomSlugFromDir(roomDir) {
  return path.basename(roomDir);
}

// ---------- Finding file globber (mirrors auto-explore-drain.cjs) ----------

function readFindingFiles(roomDir) {
  const dir = path.join(roomDir, '.mindrian');
  if (!fs.existsSync(dir)) return [];
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (_e) {
    return [];
  }
  const out = [];
  for (const name of entries) {
    if (!name.startsWith('auto-explore-')) continue;
    if (!name.endsWith('.json')) continue;
    if (name.indexOf('.tmp.') !== -1) continue;
    const full = path.join(dir, name);
    try {
      const raw = fs.readFileSync(full, 'utf8');
      const finding = JSON.parse(raw);
      if (finding && finding.id && finding.material_id) out.push(finding);
    } catch (_e) {
      // skip corrupt
    }
  }
  return out;
}

// ---------- Larry-voice directive (BQ-anchored per Brain Section 8.5) ----------

function composeDirective(finding, bqLine) {
  const tid = String(finding.id || '');
  const sec = String(finding.source_section || 'this material');
  const tdScore = Number(finding.top_differential_score || 0);
  const lines = [
    'PENDING AUTO-EXPLORE FINDING (load-bearing for v1.13.0 closed loop):',
    '',
    'I scanned your ' + sec + '. ' + bqLine,
    '',
    'Top differential: ' + String(finding.top_differential || '<unspecified>') +
      '  (score ' + tdScore.toFixed(3) + ')',
  ];
  if (tdScore >= 0.7) {
    lines.push('');
    lines.push('RECOMMENDED: Explore (top_differential_score >= 0.7 per Phase 88.2 invariant).');
  }
  lines.push('');
  lines.push('INSTRUCTION FOR LARRY: At this turn, render the BQ-anchored line above');
  lines.push('verbatim, then dispatch F.1 Next Move selector via AskUserQuestion with');
  lines.push('verbs = ["Explore", "Skip", "Later"]. Finding id = ' + tid + '.');
  lines.push('When user picks an option, call lib/agents/auto-explore-agent.cjs::handleUserResponse');
  lines.push('with this finding_id and the user-pick verb.');
  return lines.join('\n');
}

// ---------- Top finding selection (cap to MAX_FINDINGS_PER_TURN) ----------

function selectTopFinding(findings, ledgerEntries) {
  const respondedIds = new Set();
  const surfacedNotResponded = new Set();
  for (const e of ledgerEntries) {
    if (!e || !e.material_id) continue;
    if (e.user_response) respondedIds.add(e.material_id);
    else if (e.surfaced === true) surfacedNotResponded.add(e.material_id);
  }
  const eligible = findings.filter(function (f) {
    return !respondedIds.has(f.material_id) && !surfacedNotResponded.has(f.material_id);
  });
  if (eligible.length === 0) return null;
  if (!agent || typeof agent.populateHSIAnalysis !== 'function') {
    // Agent unavailable: fall back to score-only ranking.
    eligible.sort(function (a, b) { return Number(b.score || 0) - Number(a.score || 0); });
    return eligible[0];
  }
  const populated = eligible.map(function (f) { return agent.populateHSIAnalysis(f); });
  populated.sort(function (a, b) {
    return Number(b.top_differential_score || 0) - Number(a.top_differential_score || 0);
  });
  return populated.slice(0, MAX_FINDINGS_PER_TURN)[0];
}

// ---------- Drain extension (Wave 2) ----------

function tryDrain(roomDir, roomSlug) {
  if (!agent || typeof agent.surfaceFinding !== 'function') return null;
  const findings = readFindingFiles(roomDir);
  if (findings.length === 0) return null;

  let ledger = [];
  try {
    ledger = store.readMaterials(roomSlug);
  } catch (_e) {
    ledger = [];
  }

  const top = selectTopFinding(findings, ledger);
  if (!top) return null;

  const operator = String(process.env.MINDRIAN_OPERATOR || 'AUTONOMOUS');
  const tier = Number.isFinite(Number(process.env.MINDRIAN_TIER)) ? Number(process.env.MINDRIAN_TIER) : 1;

  let surface;
  try {
    surface = agent.surfaceFinding({
      finding: top,
      roomDir: roomDir,
      operator: operator,
      tier: tier,
    });
  } catch (_e) {
    return null;
  }

  if (!surface || !surface.surfaced) return null;

  // Mark surfaced=true in ledger.
  try {
    store.appendMaterial(roomSlug, {
      material_id: String(top.material_id),
      file_path_sha256: String(top.file_path_sha256 || ''),
      relative_file_path: '',
      mtime_seconds: 0,
      fired_at: Date.now(),
      state: 'completed',
      finding_count: 1,
      surfaced: true,
      user_response: null,
      responded_at: null,
      suppress_reason: null,
      in_flight_since: null,
    });
  } catch (_e) { /* graceful */ }

  return composeDirective(top, surface.bq_line || '');
}

// ---------- Main ----------

function main() {
  let roomDir;
  let roomSlug;
  try {
    roomDir = resolveRoomDir();
    roomSlug = roomSlugFromDir(roomDir);
  } catch (_e) {
    return emitEmpty();
  }

  // Wave 1: 5-min stale-sweep recovery.
  try {
    store.sweepStaleInFlight(roomSlug, { staleMs: 300000 });
  } catch (_e) {
    // Sweep failure is benign -- the next session start will retry.
  }

  // Wave 2: drain orphan findings from previous session OR Desktop fallback.
  let directive = null;
  try {
    directive = tryDrain(roomDir, roomSlug);
  } catch (_e) {
    directive = null;
  }

  if (directive) {
    return emitEnvelope({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: directive,
      },
    });
  }

  return emitEmpty();
}

// ----- Phase 121.5-00 contributor surface -----
// Compose the auto-explore directive (Phase 117 surface) as a ContributorFragment
// for the SessionStart Coordinator. The legacy main() above stays byte-identical
// for backward compat (in case anything still invokes the bare hook); hooks.json
// no longer routes here.

function contribute() {
  let fi;
  try { fi = require('../lib/sessionstart/contributor-interface.cjs'); }
  catch (_) { return { has_payload: false }; }
  try {
    let roomDir, roomSlug;
    try {
      roomDir = resolveRoomDir();
      roomSlug = roomSlugFromDir(roomDir);
    } catch (_) { return fi.emptyFragment(); }
    try {
      if (store && typeof store.sweepStaleInFlight === 'function') {
        store.sweepStaleInFlight(roomSlug, { staleMs: 300000 });
      }
    } catch (_) { /* benign */ }
    let directive = null;
    try {
      directive = tryDrain(roomDir, roomSlug);
    } catch (_) { directive = null; }
    if (!directive || typeof directive !== 'string' || directive.length === 0) {
      return fi.emptyFragment();
    }
    const pointer = 'Auto-explore finding pending -- run /mos:auto-explore drain.';
    return fi.makeFragment({
      id: 'auto-explore',
      priority: 5,
      full_payload: directive,
      one_line_pointer: pointer,
    });
  } catch (_) {
    return fi.emptyFragment();
  }
}

module.exports = { contribute };

if (require.main === module) {
  try { main(); }
  catch (_e) { emitEmpty(); }
}
