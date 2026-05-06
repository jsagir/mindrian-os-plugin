/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 117-01 Wave 1 -- AutoExploreAgent skeleton.
 *
 * Mirrors lib/agents/tension-hook-agent.cjs structure verbatim per RESEARCH
 * Section 3 (sibling code-clone). This Wave 1 ships ONLY the detection helper
 * used by the fingerprint hook; later waves ship:
 *   - composeAutoExploreFinding (lands 117-02)
 *   - surfaceFinding + handleUserResponse (lands 117-03)
 *   - 5 emit helpers (lands 117-05)
 *
 * Per Brain Section 8.7: detection routing is LOCAL-only. NO [Brain-only Cypher edge type, name elided to keep grep regression at zero]
 * Brain calls. The detection rules below run entirely on file extension +
 * path heuristics + room.db artifact count. AUTOEXPLORE-117-17 is enforced via
 * the 117-04 grep regression that scans this file for [Brain-only Cypher edge type, name elided to keep grep regression at zero].
 *
 * Graph-native HARD RULES (memory feedback_reverse_salient_agent_graph_native.md):
 *   1. NEVER require room-db.cjs directly (Phase 109 D-06 chokepoint).
 *   2. NEVER require any brain-client module (Canon Part 8 boundary).
 *   3. NEVER write to stdout / stderr (telemetry side-channel rule).
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 */
'use strict';

const store = require('../memory/explored-materials-store.cjs');

// ---------- Constants ----------

const MATERIAL_ID_LEN = 32;

// ---------- detectFirstMaterial (LOCAL-only routing) ----------

/**
 * Decide whether the PostToolUse Write|Edit|MultiEdit event represents a
 * "first material" worth exploring. Per Brain Section 8.7 the routing is
 * entirely LOCAL: no Brain [Brain-only Cypher edge type, name elided to keep grep regression at zero] call, no remote query.
 *
 * Tier 0: artifactCount < 0 means caller could not determine (room.db missing
 *   or unreadable). Suppress with 'tier_0'.
 * Tier 1: artifactCount in [0, 4]. First-material candidate; eligible to fire.
 * Tier 2+: artifactCount >= 5. Auto-fire still eligible; daily-cap takes
 *   precedence and is enforced by the caller (the fingerprint hook).
 *
 * @param {object} args
 * @param {string} args.roomDir            absolute path to room (with .room-root)
 * @param {string} args.relativeFilePath   path relative to roomDir
 * @param {number} args.mtimeMs            file mtime in ms-epoch
 * @param {number} args.artifactCount      rows in nodes table for this room
 *                                         (use -1 to signal db missing -> Tier 0)
 * @returns {{is_first_material: boolean, tier: number, material_id: string|null,
 *            suppress_reason: string|null}}
 */
function detectFirstMaterial(args) {
  const roomDir = (args && typeof args.roomDir === 'string') ? args.roomDir : '';
  const relativeFilePath = (args && typeof args.relativeFilePath === 'string') ? args.relativeFilePath : '';
  const mtimeMs = (args && Number.isFinite(args.mtimeMs)) ? args.mtimeMs : NaN;
  const artifactCount = (args && Number.isFinite(args.artifactCount)) ? args.artifactCount : 0;

  if (!roomDir || !relativeFilePath || !Number.isFinite(mtimeMs)) {
    return {
      is_first_material: false,
      tier: 0,
      material_id: null,
      suppress_reason: 'invalid_args',
    };
  }

  const material_id = store.computeMaterialId(roomDir, relativeFilePath, mtimeMs);

  // Tier 0: artifactCount < 0 means caller could not read room.db.
  if (artifactCount < 0) {
    return {
      is_first_material: false,
      tier: 0,
      material_id: material_id,
      suppress_reason: 'tier_0',
    };
  }

  // Tier 1 (0..4 artifacts) is the first-material moment per CONTEXT.md.
  // Tier 2+ (5+ artifacts) is also auto-fire eligible -- the daily-cap enforces
  // the per-room rate limit (CONTEXT.md AC4 + RESEARCH Section 4.5).
  const tier = artifactCount < 5 ? 1 : 2;
  return {
    is_first_material: true,
    tier: tier,
    material_id: material_id,
    suppress_reason: null,
  };
}

// ---------- Module exports ----------

module.exports = {
  detectFirstMaterial,
  MATERIAL_ID_LEN,
};
