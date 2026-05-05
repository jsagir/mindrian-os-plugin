'use strict';

/*
 * Phase 115-02 -- shallow-doc-parser (DISCRETION-01 strategy b)
 *
 * Extracts 1 user + 1 venture + 1-3 claim nodes from CV / memo / pitch paste.
 * Routes ALL graph writes through lib/core/navigation.cjs (Phase 109 chokepoint).
 * Graceful degradation: returns { user: null, venture: null, claims: [] } on
 * parse failure; NEVER throws.
 *
 * Canon Part 7 (reuse before build): consumes the existing Phase 109 navigation
 * surface. setFocus + recordMemoryEvent. No direct require of room-db.cjs.
 *
 * Canon Part 8 (graph boundary): no Brain queries, no user-content egress.
 * The function operates entirely on the input string and writes only to
 * LOCAL room.db via navigation.cjs.
 *
 * Pitfall 7 alignment: parseRoleHints maps to the 7-key role_blend axes
 * (Founder / Researcher / Investor / Operator). Researcher.IND and
 * Founder.grant are NOT inferable from a CV paste alone today; they alias
 * to default until a future phase extends role_blend.
 *
 * Cold-start contract: shallow file is best-effort. If the document does
 * not contain detectable role / venture / claims, the parser returns the
 * empty result and emits zero memory events. This is the explicit
 * graceful-degradation path (DISCRETION-01 strategy (b) "falls back to
 * 0 nodes on failure").
 */

const navigation = require('./navigation.cjs');
const crypto = require('node:crypto');

// ----- Role detection (7-key role_blend space, Pitfall 7) -----

const ROLE_PATTERNS = [
  { canonical: 'Founder', regex: /\b(founder|co-?founder|ceo|cto)\b/i },
  { canonical: 'Investor', regex: /\b(gp|lp|managing director|managing partner|venture partner|principal at)\b/i },
  { canonical: 'Researcher', regex: /\b(phd|researcher|professor|scientist|investigator|principal investigator|\bpi\b)\b/i },
  { canonical: 'Operator', regex: /\b(coo|head of operations|director of operations|vp operations|chief operating)\b/i },
];

function parseRoleHints(text) {
  if (!text || typeof text !== 'string') return null;
  for (const { canonical, regex } of ROLE_PATTERNS) {
    if (regex.test(text)) {
      return { canonical_role: canonical, confidence: 0.85 };
    }
  }
  return null;
}

// ----- Venture detection -----

function parseVentureHint(text) {
  if (!text || typeof text !== 'string') return { name: null, stage: 'unknown' };

  // Clinical trial NCT ID anywhere in the text -> dedicated stage
  const nct = text.match(/\b(NCT\d{8})\b/);
  if (nct) {
    return { name: nct[1], stage: 'clinical-trial' };
  }

  // "Founder of X", "CEO of X", "founded X", "PI on X"
  // Capture 1-3 capitalized words as a name. Use [ \t]+ for separators
  // so the match does NOT span across newlines (which can pull in the next
  // CV section like "Founder of Acme Robotics\nPhD" -> "Acme Robotics PhD").
  const namePattern = /(?:founder of|co-?founder of|ceo of|cto of|founded|pi on|principal investigator on)[ \t]+([A-Z][\w-]*(?:[ \t]+[A-Z][\w-]*){0,2})/i;
  const m = text.match(namePattern);
  if (m && m[1]) {
    return { name: m[1].trim(), stage: 'unknown' };
  }
  return { name: null, stage: 'unknown' };
}

// ----- Claim detection (top-level bullet statements) -----

function parseClaims(text, max) {
  const limit = Number.isInteger(max) && max > 0 ? max : 3;
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/\r?\n/);
  const claims = [];
  for (const line of lines) {
    // Match leading bullet markers (-, *, bullet char, or "1.", "2.", etc.) followed by 10-200 chars
    const m = line.match(/^[\s]*(?:[-*•]|\d+\.)\s+(.{10,200}?)\s*$/);
    if (m && m[1]) {
      claims.push({ text: m[1].trim() });
      if (claims.length >= limit) break;
    }
  }
  return claims;
}

// ----- Node ID helper (deterministic) -----

function nodeIdFor(prefix, content) {
  const hash = crypto.createHash('sha256').update(String(content)).digest('hex').slice(0, 8);
  return prefix + '-' + hash;
}

// ----- Internal: safe call to navigation.recordMemoryEvent if present -----
// The Phase 109 public surface today exposes setFocus + 12 other functions.
// recordMemoryEvent is the proposed 14th re-export (per RESEARCH cross-phase
// wiring). When absent at runtime, we no-op the memory_event call so the
// shallow-file flow still completes (graceful degradation per DISCRETION-01).

function safeRecord(sessionId, eventType, payload) {
  if (typeof navigation.recordMemoryEvent === 'function') {
    try {
      navigation.recordMemoryEvent(sessionId, eventType, payload);
    } catch (_) {
      // graceful degradation
    }
  }
}

// ----- extractShallow (DISCRETION-01 strategy (b) entry point) -----

function extractShallow(text, sessionId) {
  const result = { user: null, venture: null, claims: [] };
  if (!text || typeof text !== 'string') return result;
  if (!sessionId || typeof sessionId !== 'string') return result;

  try {
    const role = parseRoleHints(text);
    const venture = parseVentureHint(text);
    const claims = parseClaims(text);

    // 1 user node (if a role inferred)
    if (role) {
      const userNodeId = nodeIdFor('user', role.canonical_role + ':' + sessionId);
      result.user = {
        node_id: userNodeId,
        canonical_role: role.canonical_role,
        confidence: role.confidence,
      };
      safeRecord(sessionId, 'node_created', { node_id: userNodeId, kind: 'user', canonical_role: role.canonical_role });
    }

    // 1 venture node (if named entity found) -- also sets focus
    if (venture && venture.name) {
      const ventureNodeId = nodeIdFor('venture', venture.name);
      result.venture = {
        node_id: ventureNodeId,
        name: venture.name,
        stage: venture.stage,
      };
      // setFocus signature aligned with Phase 109 closed surface (sessionId, nodeId, setBy)
      try {
        navigation.setFocus(sessionId, ventureNodeId, 'auto-from-upload');
      } catch (_) {
        // graceful degradation; focus is best-effort
      }
      safeRecord(sessionId, 'node_created', { node_id: ventureNodeId, kind: 'venture', name: venture.name });
    }

    // 1-3 claim nodes
    for (const c of claims) {
      const claimNodeId = nodeIdFor('claim', c.text);
      result.claims.push({ node_id: claimNodeId, text: c.text });
      safeRecord(sessionId, 'node_created', { node_id: claimNodeId, kind: 'claim' });
    }
  } catch (_) {
    // Catch-all graceful degradation: never throw upstream.
  }

  return result;
}

module.exports = {
  extractShallow,
  parseRoleHints,
  parseVentureHint,
  parseClaims,
};
