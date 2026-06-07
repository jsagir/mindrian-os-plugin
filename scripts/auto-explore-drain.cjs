#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 117-03 Wave 2 -- UserPromptSubmit drain (F.1 surface).
 *
 * Per RESEARCH Section 4.4: surface timing is UserPromptSubmit (next user turn),
 * NOT inline post-write (which is technically impossible -- PostToolUse
 * cannot dispatch AskUserQuestion mid-tool-call). This drain runs LAST
 * in the UserPromptSubmit chain per RESEARCH Section 4.4 ordering:
 *   intent-classifier -> brain-derivation-drain -> operator-update -> jtbd-update -> auto-explore-drain LAST
 *
 * Flow:
 *   1. Resolve roomDir + roomSlug
 *   2. Glob room/.mindrian/auto-explore-*.json (cap to 1 finding/turn -- MAX_FINDINGS_PER_TURN)
 *   3. Filter: keep only findings whose ledger entry has surfaced=false (not yet shown)
 *   4. If empty -> exit silent {continue:true}
 *   5. Read top finding (highest top_differential_score after populateHSIAnalysis)
 *   6. agent.surfaceFinding({finding, roomDir, operator, tier})
 *   7. If surfaced -> compose Larry-voice directive in additionalContext
 *      Else -> exit silent
 *   8. Mark surfaced=true in ledger so next turn does not re-emit
 *
 * Per Canon Part 8: zero outbound network surface, zero remote-MCP-client require.
 * Per Phase 109 D-06: zero direct room-db.cjs require (chokepoint preserved).
 *
 * ALWAYS exits 0; never blocks the user's prompt. uncaughtException catcher
 * guarantees the envelope still fires.
 *
 * Pure CJS, node built-ins only.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const store = require('../lib/memory/explored-materials-store.cjs');
const agent = require('../lib/agents/auto-explore-agent.cjs');

// ---------- Envelope helpers (mirrors scripts/preflight-tension-surface.cjs) ----------

const ENVELOPE_ALLOWED = new Set([
  'decision', 'reason', 'continue', 'stopReason',
  'suppressOutput', 'systemMessage', 'hookSpecificOutput',
]);
const HOOK_EVENT_NAME = 'UserPromptSubmit';
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
process.on('uncaughtException', () => {
  try { emitEmpty(); } catch (_e) { process.exit(0); }
});

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

// ---------- Finding file globber ----------

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
    if (name.indexOf('.tmp.') !== -1) continue; // skip atomic-write temp files
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
  // Filter out already-surfaced findings: any ledger entry with user_response
  // means user already responded; any ledger entry where surfaced=true and
  // user_response is null means we already showed this finding (waiting on user).
  const respondedIds = new Set();
  const surfacedNotResponded = new Set();
  for (const e of ledgerEntries) {
    if (!e || !e.material_id) continue;
    if (e.user_response) respondedIds.add(e.material_id);
    else if (e.surfaced === true) surfacedNotResponded.add(e.material_id);
  }
  // Drop both categories: already responded AND already surfaced.
  const eligible = findings.filter(function (f) {
    return !respondedIds.has(f.material_id) && !surfacedNotResponded.has(f.material_id);
  });
  if (eligible.length === 0) return null;
  // Populate HSIAnalysis to get top_differential_score for ranking.
  const populated = eligible.map(function (f) { return agent.populateHSIAnalysis(f); });
  // Sort DESC by top_differential_score; cap to MAX_FINDINGS_PER_TURN.
  populated.sort(function (a, b) {
    return Number(b.top_differential_score || 0) - Number(a.top_differential_score || 0);
  });
  const capped = populated.slice(0, MAX_FINDINGS_PER_TURN);
  return capped[0];
}

// ---------- Main flow ----------

function main() {
  let roomDir;
  let roomSlug;
  try {
    roomDir = resolveRoomDir();
    roomSlug = roomSlugFromDir(roomDir);
  } catch (_e) {
    return emitEmpty();
  }

  const findings = readFindingFiles(roomDir);
  if (findings.length === 0) return emitEmpty();

  let ledger = [];
  try {
    ledger = store.readMaterials(roomSlug);
  } catch (_e) {
    ledger = [];
  }

  const top = selectTopFinding(findings, ledger);
  if (!top) return emitEmpty();

  // Resolve operator + tier (defensive defaults; downstream dispatcher enforces).
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
    return emitEmpty();
  }

  if (!surface || !surface.surfaced) return emitEmpty();

  // Phase 117-05 telemetry: emit auto_explore_finding_surfaced before
  // additionalContext writes. Use the populated finding from surface so
  // top_differential_score is non-null per RESEARCH Section 11 schema.
  try {
    agent.emitFindingSurfaced(roomDir, {
      finding: surface.finding || top,
      surfacing_count: 1,
      tier: tier,
    });
  } catch (_e) { /* never throw */ }

  // Phase 144.1-06 RETRO-03 (audit item 61): fire SENS-01 (deep_research /
  // auto-explore-domains / push_forward) through the navigation chokepoint so
  // the engine can observe the drain surfacing a finding -- not just the
  // 117-05 telemetry mirror. LOCAL only (Canon Part 8): the fire carries the
  // reach/sensor/dispatch/posture handles + the finding's file_path_sha256
  // scalar, never the finding body. Routes through navigation.cjs::logSpineRead;
  // never an ad-hoc detached spawn. Best-effort: never throws.
  try {
    const navigation = require('../lib/core/navigation.cjs');
    if (navigation && typeof navigation.logSpineRead === 'function') {
      navigation.logSpineRead(roomDir, {
        surface: 'deep_research',
        sensor: 'SENS-01',
        dispatch: 'auto-explore-domains',
        posture: 'push_forward',
        file_path_sha256: String(top.file_path_sha256 || ''),
        source: 'auto-explore-drain',
      });
    }
  } catch (_e) { /* never throw */ }

  // Mark surfaced=true in ledger so next turn does not re-emit.
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
  } catch (_e) {
    // graceful: ledger append best-effort
  }

  const directive = composeDirective(top, surface.bq_line || '');

  return emitEnvelope({
    continue: true,
    hookSpecificOutput: {
      hookEventName: HOOK_EVENT_NAME,
      additionalContext: directive,
    },
  });
}

try {
  main();
} catch (_e) {
  emitEmpty();
}
