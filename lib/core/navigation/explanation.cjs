'use strict';
// Phase 109-05 templated explanation renderer. ZERO LLM in the loop per RESEARCH section 2.5.
// Closed kind enum; each kind has a deterministic template using typed edge labels.
//
// Canon Part 4: every choice is graph data; explanation strings render the typed
// edge labels (CONTRADICTS, SUPPORTS, DEPENDS_ON, ENABLES, EVIDENCES) directly so
// users can read "the graph paths AS the explanation".
// Canon Part 9: ZERO LLM in the loop; the "graph paths as explanation" pattern is
// the structural substitute for prompt-generated narrative.

function shortId(id) {
  if (typeof id !== 'string') return String(id);
  const parts = id.split(':');
  if (parts.length < 2) return id;
  return parts[0] + ':' + parts.slice(1).join(':');
}

function daysSince(epochMs) {
  const dms = Date.now() - epochMs;
  return Math.max(0, Math.floor(dms / (24 * 60 * 60 * 1000)));
}

function renderExplanation(kind, payload) {
  const p = payload || {};
  switch (kind) {
    case 'contradiction':
      return shortId(p.claimA) + ' CONTRADICTS ' + shortId(p.claimB) + ' (depth ' + (p.depth != null ? p.depth : 1) + ')';
    case 'unsupported':
      return shortId(p.claim) + ' is ' + (p.reviewStatus || 'confirmed') + ' but has no SUPPORTS edge (last touched ' + daysSince(p.lastSeenAt || Date.now()) + ' days ago)';
    case 'blocking':
      return shortId(p.assumption) + ' blocks ' + shortId(p.goal) + ' via path ' + (Array.isArray(p.cascadePath) ? p.cascadePath.map(shortId).join(' -> ') : '');
    case 'stale':
      return shortId(p.decision) + ' is confirmed but has not been touched in ' + daysSince(p.lastSeenAt) + ' days';
    case 'open':
      return shortId(p.question) + ' has been open for ' + daysSince(p.createdAt) + ' days with no SUPPORTS or EVIDENCES edge';
    case 'opportunity':
      return shortId(p.opportunityId) + ' (' + (p.hsiBand || 'unknown') + ' HSI band; ' + (p.jtbdMatch > 0 ? 'matches active JTBD' : 'no JTBD overlap') + '; ' + (p.depth != null ? p.depth : '?') + ' hop(s) from focus)';
    case 'transitive_support':
      // Phase 270-10: findTransitiveSupport's per-supporter explanation. Added
      // as its own case following this switch's existing pattern rather than
      // letting an unrecognized kind fall through to the generic default.
      return shortId(p.supporter) + ' transitively supports ' + shortId(p.claim) + ' via ' + (p.viaEdgeType || 'unknown') + ' (depth ' + (p.depth != null ? p.depth : '?') + ')';
    default:
      return '[explanation unavailable for kind=' + kind + ']';
  }
}

module.exports = { renderExplanation, shortId, daysSince };
