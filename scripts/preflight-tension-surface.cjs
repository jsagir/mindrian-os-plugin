#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 116-01 Wave 1 -- SessionStart preflight tension surface hook.
 * Hook entry #7 in hooks/hooks.json SessionStart matcher 'startup|clear|compact'.
 *
 * Per CONTEXT.md D-01 + D-05: lazy detection at SessionStart via the Phase 109
 * navigation chokepoint (findSurfaceableTensions). Per D-07 + D-07a: JSONL is
 * the decay state machine ground truth. Per D-09 + D-10: silent on zero
 * candidates / Tier 0 / db_not_initialized.
 *
 * Envelope contract (RESEARCH Section 5.1; verified scripts/check-onboard-statusline.cjs):
 *   { continue: true,
 *     hookSpecificOutput: { hookEventName: 'SessionStart',
 *                           additionalContext: '<Larry-voice directive>' } }
 *
 * ALWAYS exits 0 (RESEARCH Section 7.3); never blocks the hook chain.
 *
 * Graph-native HARD RULE:
 *   - Reads route through lib/core/navigation.cjs (Phase 109 D-06 chokepoint).
 *   - Brain MCP is OUT of this hook's surface (Canon Part 8 boundary).
 *   - process.stdout.write goes through emitEnvelope() helper only -- the
 *     stdout write IS the SessionStart envelope mechanism, not a side-channel.
 *
 * Pure CJS, node built-ins only. Zero new runtime dependencies.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ---------- Envelope helpers (mirrors scripts/check-onboard-statusline.cjs) ----------

const ENVELOPE_ALLOWED = new Set([
  'decision', 'reason', 'continue', 'stopReason',
  'suppressOutput', 'systemMessage', 'hookSpecificOutput',
]);

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

// ---------- Larry-voice directive composition ----------

/**
 * Compose the additionalContext directive paragraph per RESEARCH Section 5.3.
 *
 * The verbatim source-spec quote rendering (lines 80-97 of the source spec)
 * requires fetching the artifact body text from the graph, which is the
 * job of Wave 2 (116-02 wires F.1 dispatch + the verbatim quote fetch).
 * This v1 directive carries the section names + tension_id and INSTRUCTS
 * Larry to fetch the verbatim node text via lib/core/navigation.cjs on
 * his first turn before rendering the quoted citation.
 */
function composeLarryVoiceDirective(args) {
  const tid = String(args.tension_id || '');
  const ss = String(args.source_section || 'unspecified-section');
  const ts = String(args.target_section || 'unspecified-section');
  const sNode = String(args.source_node_id || '');
  const tNode = String(args.target_node_id || '');
  const lines = [
    'PENDING TENSION (load-bearing for v1.13.0 closed loop):',
    '',
    'I was thinking about something you wrote.',
    'Earlier in ' + ss + ' you filed a claim. Later in ' + ts + ' you wrote'
      + ' something that pulls in the opposite direction.',
    'These two are in tension. Which one is true?',
    '',
    'INSTRUCTION FOR LARRY: At your first turn, fetch the verbatim node text'
      + ' for source_node_id=' + sNode + ' and target_node_id=' + tNode
      + ' via lib/core/navigation.cjs (read-only), render the quoted Larry-voice'
      + ' citation per docs/AGENTIC-SURFACING-PATTERN.md Section 5,',
    'then dispatch F.1 Next Move selector via AskUserQuestion with verbs ='
      + ' ["Resolve", "Later", "Skip"].',
    'Tension id = ' + tid + '.',
    'When the user picks an option, call lib/memory/pending-tension-store.cjs'
      + ' markSurfaced() / markResolved() / requeue() with this tension_id so'
      + ' the JSONL state machine stays consistent.',
  ];
  return lines.join('\n');
}

// ---------- Main flow ----------

function main() {
  let navigation;
  let pendingStore;
  let agent;
  try {
    navigation = require('../lib/core/navigation.cjs');
    pendingStore = require('../lib/memory/pending-tension-store.cjs');
  } catch (_e) {
    // Substrate missing -- pre-Phase-109 install or partial repo. Silent.
    return emitEmpty();
  }
  // Lazy-loaded; agent is optional for telemetry only -- load failure must
  // never block the hook (Wave-4 telemetry is best-effort per CONTEXT.md D-04).
  try {
    agent = require('../lib/agents/tension-hook-agent.cjs');
  } catch (_e) {
    agent = null;
  }

  const roomDir = resolveRoomDir();
  const roomSlug = roomSlugFromDir(roomDir);
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');

  // Tier 0: room.db missing (pre-Phase-109 user / brand-new room). Silent per D-10.
  // Wave 4: still emit tension_detected per Pitfall 5 (CONTEXT.md D-04c). The
  // emit best-effort returns {ok:false, reason:'db_not_initialized'} because
  // the mirror needs the same db that doesn't exist; the silent envelope still fires.
  if (!fs.existsSync(dbPath)) {
    if (agent) {
      try {
        agent.emitDetected(roomDir, { id: '', tension_type: '' }, {
          tier: 0,
          surfaced: false,
          suppress_reason: 'tier_0',
          surfacing_count: 0,
          source_edge_count: 0,
          brain_offline_flag: true,
          selection_priority: 0,
        });
      } catch (_e) { /* never throw on telemetry */ }
    }
    return emitEmpty();
  }

  // Lazy require of node:sqlite so any environment lacking the experimental
  // module degrades gracefully (Tier 0).
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (_e) {
    return emitEmpty();
  }

  let db;
  try {
    // Phase 276 C4: busy-timeout option, one line, see lib/core/room-db.cjs:242-251
    // for the full reasoning. Pure read (findSurfaceableTensions) opened via
    // the read-write door; option added for correctness on the door.
    db = new DatabaseSync(dbPath, { timeout: 5000 });
  } catch (_e) {
    return emitEmpty();
  }

  try {
    // Phase 116-03 Wave 3: evaluate decay BEFORE selecting candidates so
    // 3-strikes transitions land in JSONL ground truth (per CONTEXT.md D-03a).
    // findSurfaceableTensions filters dropped per D-03b (already implemented in
    // 116-01). Wave 4 (116-04) consumes decayResult.droppedTensionIds to emit
    // tension_decayed memory_event for Phase 121 trajectory-telemetry.
    const decayResult = pendingStore.evaluateAndDecay(roomSlug);

    // Wave 4: emit one tension_decayed event per dropped tension_id (D-04b).
    // evaluation_pass_id ties the batch to a single decay sweep so Phase 121
    // can join the population without depending on wall-clock equality.
    if (agent
        && decayResult
        && Array.isArray(decayResult.droppedTensionIds)
        && decayResult.droppedTensionIds.length > 0) {
      const passId = require('node:crypto')
        .createHash('sha256')
        .update(roomSlug + ':' + Date.now())
        .digest('hex')
        .slice(0, 32);
      for (const tid of decayResult.droppedTensionIds) {
        try {
          agent.emitDecayed(roomDir, tid, {
            surfacing_count: 3,
            evaluation_pass_id: passId,
          });
        } catch (_e) { /* never throw on telemetry */ }
      }
    }

    let candidates = [];
    try {
      candidates = navigation.findSurfaceableTensions(db, roomSlug, {
        roomSlug: roomSlug,
        limit: 1,
        includeConvergence: true,
      });
    } catch (_e) {
      candidates = [];
    }

    // D-09: silent when navigation returns zero candidates.
    // Wave 4: still emit tension_detected per Pitfall 5 (D-04c) with
    // suppress_reason='no_candidates' so Phase 121 trajectory-telemetry
    // sees the suppression cohort.
    if (!Array.isArray(candidates) || candidates.length === 0) {
      if (agent) {
        try {
          agent.emitDetected(roomDir, { id: '', tension_type: '' }, {
            tier: 1,
            surfaced: false,
            suppress_reason: 'no_candidates',
            surfacing_count: 0,
            source_edge_count: 0,
            brain_offline_flag: true,
            selection_priority: 0,
          });
        } catch (_e) { /* never throw on telemetry */ }
      }
      return emitEmpty();
    }

    const top = candidates[0];

    // Append a queued entry to the JSONL state machine. Idempotent: re-running
    // the hook on the same tension_id is a no-op for the readback because the
    // LWW replay collapses to the most-recent entry (RESEARCH Section 6.4).
    try {
      pendingStore.appendTension(roomSlug, {
        tension_id: top.tension_id,
        type: top.tension_type,
        source_edge_ids: [String(top.edge_id)],
        source_node_ids: [top.source_node_id, top.target_node_id],
        created_at: Date.now(),
        state: 'queued',
        surfacing_count: 0,
        last_surfaced_at: null,
        last_response: null,
        context_signature: {
          source_section: top.source_section || '',
          target_section: top.target_section || '',
          tension_kind_label: top.tension_type,
        },
      });
    } catch (_e) {
      // JSONL write failed -- defensively continue and still emit the directive
      // so the user is not silently stuck. The next session start will re-attempt
      // the JSONL append (idempotent by tension_id LWW).
    }

    // Wave 4: emit tension_detected (surfaced:true) + tension_surfaced after
    // appendTension lands the queued state. The Canon-Part-8-clean finding
    // built here carries IDs + section names ONLY (no body_text / titles).
    const finding = {
      id: top.tension_id,
      tension_type: top.tension_type,
      source_node_id: top.source_node_id,
      target_node_id: top.target_node_id,
      source_section: top.source_section,
      target_section: top.target_section,
    };
    if (agent) {
      try {
        agent.emitDetected(roomDir, finding, {
          tier: 1,
          surfaced: true,
          suppress_reason: null,
          surfacing_count: 0,
          source_edge_count: 1,
          brain_offline_flag: true,
          selection_priority: top.tension_type === 'contradiction' ? 1 : 2,
        });
      } catch (_e) { /* never throw on telemetry */ }
      try {
        agent.emitSurfaced(roomDir, finding, {
          tier: 1,
          surfacing_count: 1,
          f1_verb_count: 4,
        });
      } catch (_e) { /* never throw on telemetry */ }
    }

    const additionalContext = composeLarryVoiceDirective({
      tension_id: top.tension_id,
      source_section: top.source_section,
      target_section: top.target_section,
      source_node_id: top.source_node_id,
      target_node_id: top.target_node_id,
    });

    return emitEnvelope({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: additionalContext,
      },
    });
  } finally {
    try { db.close(); } catch (_e) { /* graceful close */ }
  }
}

// ----- Phase 121.5-00 contributor surface -----
// Compose the tension-hook signal as a ContributorFragment for the SessionStart
// Coordinator. Mirrors main()'s decision logic but returns the structured
// fragment instead of emitting an envelope. The legacy main() above stays
// byte-identical -- hooks.json no longer routes here; the coordinator calls
// contribute() directly.
//
// one_line_pointer is LOCKED per Plan 121.5-00 Task 2 action block:
//   "1 unresolved tension pending -- ask Larry"

function contribute() {
  let fi;
  try { fi = require('../lib/sessionstart/contributor-interface.cjs'); }
  catch (_) { return { has_payload: false }; }
  try {
    let navigation, pendingStore;
    try {
      navigation = require('../lib/core/navigation.cjs');
      pendingStore = require('../lib/memory/pending-tension-store.cjs');
    } catch (_) {
      return fi.emptyFragment();
    }
    const roomDir = resolveRoomDir();
    const roomSlug = roomSlugFromDir(roomDir);
    const dbPath = path.join(roomDir, '.mindrian', 'room.db');
    if (!fs.existsSync(dbPath)) return fi.emptyFragment(); // Tier 0 silent

    let DatabaseSync;
    try { ({ DatabaseSync } = require('node:sqlite')); }
    catch (_) { return fi.emptyFragment(); }

    let db;
    // Phase 276 C4: busy-timeout option, one line, see lib/core/room-db.cjs:242-251
    // for the full reasoning. Pure read (findSurfaceableTensions), same
    // reasoning as the sibling site above.
    try { db = new DatabaseSync(dbPath, { timeout: 5000 }); }
    catch (_) { return fi.emptyFragment(); }

    try {
      pendingStore.evaluateAndDecay(roomSlug);
      let candidates = [];
      try {
        candidates = navigation.findSurfaceableTensions(db, roomSlug, {
          roomSlug,
          limit: 1,
          includeConvergence: true,
        });
      } catch (_) { candidates = []; }
      if (!Array.isArray(candidates) || candidates.length === 0) {
        return fi.emptyFragment();
      }
      const top = candidates[0];
      try {
        pendingStore.appendTension(roomSlug, {
          tension_id: top.tension_id,
          type: top.tension_type,
          source_edge_ids: [String(top.edge_id)],
          source_node_ids: [top.source_node_id, top.target_node_id],
          created_at: Date.now(),
          state: 'queued',
          surfacing_count: 0,
          last_surfaced_at: null,
          last_response: null,
          context_signature: {
            source_section: top.source_section || '',
            target_section: top.target_section || '',
            tension_kind_label: top.tension_type,
          },
        });
      } catch (_) { /* continue defensively */ }

      const fullPayload = composeLarryVoiceDirective({
        tension_id: top.tension_id,
        source_section: top.source_section,
        target_section: top.target_section,
        source_node_id: top.source_node_id,
        target_node_id: top.target_node_id,
      });
      return fi.makeFragment({
        id: 'tension-hook',
        priority: 3,
        full_payload: fullPayload,
        one_line_pointer: '1 unresolved tension pending -- ask Larry',
      });
    } finally {
      try { db.close(); } catch (_) { /* graceful */ }
    }
  } catch (_) {
    return fi.emptyFragment();
  }
}

module.exports = { contribute };

if (require.main === module) {
  try { main(); }
  catch (_e) { emitEmpty(); }
}
