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

// ----- Single-axis blend from a canonical_role scalar (BCH-18 upstream) -----
//
// Phase 177-03 (BCH-18, RE-SCOPED). The role_blend WRITE producer already exists
// at lib/core/navigation/room-birth.cjs:426-430 (Phase 155) -- birthRoom already
// calls writeUserMdAtomic({ canonical_role, role_blend: roleBlend, journey_stage }).
// The real gap is UPSTREAM: shallow-doc-parser emits only a canonical_role SCALAR;
// nothing computes the weighted blend that producer threads through opts.roleBlend.
//
// blendFromCanonicalRole turns a canonical_role scalar string into a single-axis
// role_blend object { <key>: 1.0 }, mirroring persona-override.cjs:280-281 verbatim
// (decl.role_blend[blendKey] = 1.0). It normalizes the scalar against the 7 frozen
// ROLE_BLEND_KEYS that persona-override.cjs exports (the same closed set defined at
// persona-taxonomy.cjs:114-122) -- lowercased, whitespace-to-underscore -- mirroring
// persona-override.cjs:90-94 normalizeRoleKey (an internal helper there, so the
// normalize step is reproduced here against the exported key set rather than imported).
// When the scalar is absent / empty / unmappable, it returns null -- NEVER a fabricated
// blend -- so the caller degrades to cold-start neutral (room-birth.cjs:350 roleBlend = {}).
//
// Pure: no I/O, no Brain call. The blend object carries ONLY the generic role key +
// the 1.0 weight (enum/scalar; no user content), so it is Part-8-clean by construction.
const { ROLE_BLEND_KEYS } = require('./persona-override.cjs');

function _normalizeRoleKey(k) {
  if (typeof k !== 'string') return null;
  const key = k.trim().toLowerCase().replace(/\s+/g, '_');
  return ROLE_BLEND_KEYS.indexOf(key) >= 0 ? key : null;
}

function blendFromCanonicalRole(scalar) {
  const key = _normalizeRoleKey(scalar);
  if (key === null) return null; // absent / empty / unmappable -- never fabricate
  const blend = {};
  blend[key] = 1.0;
  return blend;
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

function extractShallow(text, sessionId, opts) {
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
      // setFocus real signature: (db, sessionId, nodeId, setBy) -- Phase 109 closed surface
      // (focus.cjs:36). An optional db handle may be passed in opts; when absent (upload
      // path without a held db) we skip the focus call rather than silently fail.
      // The setBy 'user' is correct: the user pasted this document (explicit user action).
      // Phase 155-03 fix: the old 3-arg form called navigation.setFocus with (sessionId,
      // nodeId, 'auto-from-upload'): wrong arity against the 4-arg surface AND an invalid
      // setBy not in VALID_SET_BY, so the try/catch swallowed it silently. Now correct:
      // 4-arg form with a held db handle + 'user' as the valid setBy.
      if (opts && opts.db) {
        try {
          navigation.setFocus(opts.db, sessionId, ventureNodeId, 'user');
        } catch (e) {
          console.warn('[shallow-doc-parser] setFocus failed:', e.message);
        }
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

// ----- extractDomains (Phase 155-07 -- domain-insight-sweep Part 8 clean handle producer) -----
//
// Pure synchronous function. Scans CV / paste text for domain-indicator patterns
// and returns string[] of generic keyword handles (2-3 word lowercase phrases).
// Returned handles are deduplicated, capped at 8, and each individually verified
// against auditQueryString so no PII can flow into Tavily via the sweep path.
//
// PII strip rules applied before returning any handle:
//   - email-like tokens: stripped
//   - URL-like tokens: stripped
//   - capitalized sequences > 3 words (names, institution titles): stripped
//   - years (4-digit): stripped
//   - degree abbreviations (PhD, MD, etc.): stripped
//
// Tri-Polar note: extractDomains is sync + pure. Desktop/Cowork degradation:
// if no db handle is available (pre-room, MCP extract_shallow path), call
// extractDomains to get handles and surface them as text ('Your domains: X,
// Y, Z -- sweep will run at birth') without filing claims.

const { auditQueryString: _auditQueryString } = require('./rs-egress-prompts.cjs');

// Internal keyword table: ~40 common STEM + social-science domain terms.
// Used for exact-match domain detection (word-boundary anchored regex).
const DOMAIN_KEYWORD_TABLE = [
  'computational biology', 'synthetic biology', 'molecular biology', 'systems biology',
  'gene editing', 'gene therapy', 'genomics', 'proteomics', 'metabolomics', 'epigenomics',
  'oncology', 'immunology', 'neuroscience', 'cardiology', 'radiology',
  'bioinformatics', 'biostatistics', 'epidemiology', 'public health',
  'machine learning', 'deep learning', 'natural language processing', 'computer vision',
  'materials science', 'nanotechnology', 'quantum computing', 'photonics',
  'climate science', 'environmental science', 'ecology',
  'behavioral economics', 'organizational behavior', 'operations research',
  'global health', 'health informatics', 'biomedical engineering',
  'drug discovery', 'clinical trials', 'translational medicine',
  'biochemistry', 'organic chemistry', 'polymer science',
  'data science', 'robotics', 'autonomous systems',
];

// Patterns that introduce a domain field in CV prose.
// Group 1 captures the field after the indicator keyword.
// Stops at commas, semicolons, periods, newlines, or conjunctions 'and'/'or'.
// The capture is short (3,20 chars) to avoid pulling in multi-domain lists.
const DOMAIN_INTRO_PATTERNS = [
  /\b(?:PhD|MS|MA|BSc|BA|MSc|MPH|DPhil|MD)\s+in\s+([a-z][a-z\s]{3,20}?)(?=[,;.\n]|\band\b|\bor\b|$)/gi,
  /\bresearch\s+(?:in|on)\s+([a-z][a-z\s]{3,20}?)(?=[,;.\n]|\band\b|\bor\b|$)/gi,
  /\bspecializ(?:ing|ed|ation)\s+in\s+([a-z][a-z\s]{3,20}?)(?=[,;.\n]|\band\b|\bor\b|$)/gi,
  /\bfocus(?:ing|ed)?\s+on\s+([a-z][a-z\s]{3,20}?)(?=[,;.\n]|\band\b|\bor\b|$)/gi,
  /\bexpert(?:ise)?\s+in\s+([a-z][a-z\s]{3,20}?)(?=[,;.\n]|\band\b|\bor\b|$)/gi,
  /\bfield\s+of\s+([a-z][a-z\s]{3,20}?)(?=[,;.\n]|\band\b|\bor\b|$)/gi,
];

// Strips PII from a candidate handle string before it is returned.
// Returns the cleaned string, or null if the result is empty / too short.
function stripPii(s) {
  let r = s;
  // Remove email-like tokens
  r = r.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
  // Remove URL-like tokens
  r = r.replace(/https?:\/\/[^\s]+/g, '');
  r = r.replace(/www\.[^\s]+/g, '');
  // Remove years
  r = r.replace(/\b(19|20)\d{2}\b/g, '');
  // Remove degree abbreviations
  r = r.replace(/\b(?:PhD|MD|JD|MPH|MBA|MSc|BSc|MA|MS|BS|BA|DPhil|DrPH|DO|MBBS)\b/g, '');
  // Remove runs of capitalized words > 1 word (potential names / institutions)
  // e.g. "John Smith" "Harvard Medical School" -> stripped
  r = r.replace(/\b(?:[A-Z][a-z]+\s+){2,}[A-Z][a-z]+\b/g, '');
  r = r.replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, ''); // two-word TitleCase
  // Collapse whitespace
  r = r.replace(/\s+/g, ' ').trim();
  if (r.length < 3) return null;
  return r;
}

// Normalizes a candidate to a generic lowercase 2-3 word keyword phrase.
// Returns null if the result does not look like a domain handle.
function normalizeHandle(raw) {
  const s = stripPii(raw.toLowerCase().trim());
  if (!s) return null;
  // Must be at least 4 characters
  if (s.length < 4) return null;
  // Cap at 3 words so intro-pattern captures stay concise (prevents
  // "crispr gene editing and oncology" from passing as one handle).
  const words = s.split(/\s+/).filter(Boolean);
  const capped = words.slice(0, 3).join(' ').trim();
  if (!capped || capped.length < 4) return null;
  return capped;
}

function extractDomains(text) {
  if (!text || typeof text !== 'string') return [];

  // Lowercase working copy for domain-table scan.
  const lower = text.toLowerCase();
  const candidates = new Set();

  // Step 1: keyword table exact match (word-boundary anchored).
  for (const kw of DOMAIN_KEYWORD_TABLE) {
    const rx = new RegExp('\\b' + kw.replace(/\s+/g, '\\s+') + '\\b', 'i');
    if (rx.test(lower)) {
      candidates.add(kw);
    }
  }

  // Step 2: intro-pattern extraction (match on the original text, lowercase captures).
  for (const pat of DOMAIN_INTRO_PATTERNS) {
    pat.lastIndex = 0; // reset sticky for 'g' flag
    let m;
    while ((m = pat.exec(text)) !== null) {
      const raw = m[1];
      const h = normalizeHandle(raw);
      if (h) candidates.add(h);
      if (candidates.size >= 20) break; // avoid runaway on adversarial text
    }
  }

  // Step 3: audit each handle against auditQueryString (defense-in-depth).
  // Handles failing the audit are silently dropped.
  const safe = [];
  for (const h of candidates) {
    try {
      _auditQueryString(h, 'domain-insight-sweep');
      safe.push(h);
    } catch (_e) {
      // PII slipped through normalizeHandle -- drop silently.
    }
    if (safe.length >= 8) break; // cap at 8 handles
  }

  return safe;
}

module.exports = {
  extractShallow,
  parseRoleHints,
  parseVentureHint,
  parseClaims,
  extractDomains,
  blendFromCanonicalRole,
};
