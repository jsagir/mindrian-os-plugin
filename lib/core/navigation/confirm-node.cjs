'use strict';
// Phase 129.5-02 confirmNode chokepoint + resolveByUser USER.md identity
// resolver. Internal to lib/core/navigation/; re-exported by
// lib/core/navigation.cjs (D-01) as the closed surface.
//
// Canon Part 9 v1.5 (D-01): confirmNode is the single APPROVE to promote door.
// Every gate (the Plan 03 selector dispatcher, the Phase 130 lens-engine accept,
// the Phase 116 tension resolution) calls this one helper; none call
// promoteNodeStatus directly. One door for confirmation, mirroring the
// navigation.cjs single-chokepoint pattern.
//
// Canon Part 9 v1.5 (D-02): resolveByUser reads the active room's USER.md
// navigator identity, uniform across CLI / Desktop / Cowork since every room
// carries a USER.md. It never returns an agent identity; a poisoned USER.md
// cannot smuggle larry / brain / system / assistant into a confirm.
//
// This module writes NO Cypher and NO raw INSERT / UPDATE / DELETE on
// nodes / edges. It delegates ALL writes to promoteNodeStatus. It performs one
// read-only SELECT to resolve the node's current review_status.
//
// NO em-dashes in this file (CLAUDE.md HARD RULE).

const path = require('node:path');
const { promoteNodeStatus, AGENT_IDENTITIES } = require('./transitions.cjs');
const { readUserMd } = require('../user-md-ops.cjs');

// The stable non-agent default byUser. A fresh empty USER.md (or an absent one,
// or one carrying an agent identity) resolves to this. It is deliberately NOT in
// AGENT_IDENTITIES so a confirm attributed to it is always canon-legal.
const NAVIGATOR_DEFAULT = 'navigator';

// confirmNode(db, id, byUser, reason?)
// Resolves the node's CURRENT review_status from the db and delegates to
// promoteNodeStatus with the correct fromStatus, so the caller need not know the
// from-state. Returns promoteNodeStatus's result verbatim, so the
// agent_attribution_forbidden / invalid_transition / state_mismatch reasons all
// surface unchanged. Returns { ok:false, reason:'unknown_node' } for a missing id.
function confirmNode(db, id, byUser, reason) {
  const row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(id);
  if (!row) {
    return { ok: false, reason: 'unknown_node' };
  }
  return promoteNodeStatus(db, id, row.review_status, 'confirmed', byUser, reason);
}

// resolveByUser(roomDir)
// Reads roomDir/USER.md and resolves the navigator identity. Precedence:
//   1. user_id (non-empty string)
//   2. canonical_role (non-empty string)
//   3. NAVIGATOR_DEFAULT
// Defense-in-depth: if the picked value lowercased is an agent identity, it is
// coerced to NAVIGATOR_DEFAULT so a misconfigured or poisoned USER.md can never
// attribute a confirm to larry / brain / system / assistant. NEVER throws.
function resolveByUser(roomDir) {
  let picked = null;
  try {
    const user = readUserMd(path.join(roomDir, 'USER.md'));
    if (user) {
      if (typeof user.user_id === 'string' && user.user_id.length > 0) {
        picked = user.user_id;
      } else if (typeof user.canonical_role === 'string' && user.canonical_role.length > 0) {
        picked = user.canonical_role;
      }
    }
  } catch (_e) {
    picked = null;
  }
  if (!picked) return NAVIGATOR_DEFAULT;
  if (AGENT_IDENTITIES.has(String(picked).toLowerCase())) return NAVIGATOR_DEFAULT;
  return picked;
}

module.exports = { confirmNode, resolveByUser, NAVIGATOR_DEFAULT };
