'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 200-02 Task 4 -- the Brain generic-handle expert projection (D-200-2 (b), additive half).
 * ================================================================================================
 * projectExpertHandles(localExpertNode, opts) is the ONE additive Mode-A reader that navigator
 * decision D-200-2 (b) lands on top of the unchanged LOCAL-only Tier-0 expert base. It reads the
 * Brain expert-network as GENERIC framework/enum handles ONLY (framework names, methodology enums,
 * domain slugs) and returns a de-duplicated list of those handles. It is the substrate the Phase
 * 203 synthetic-expert reader consumes.
 *
 * Canon Part 8 (Graph Boundary) -- LOAD-BEARING, this is the whole point of (b):
 *   - OUTBOUND: the projection may send to Brain ONLY generic methodology handles drawn from a
 *     tight whitelist of methodology-enum keys (framework / domain / methodology / problem_type /
 *     enum / tier). It NEVER reads name / institution / affiliation / orcid / author / email off
 *     the local expert node, so a person byte cannot enter the outbound payload by construction.
 *     A belt-and-suspenders leak scan then rejects the whole projection (returns []) if any
 *     collected person byte still appears in the outbound string.
 *   - GUARD: EVERY Brain call routes through the Phase 196 boundary guard (part8-egress-guard
 *     classify()). A verdict that is not 'allow' (block / ambiguous / a guard throw) is treated as
 *     "degrade to Tier-0" -- return [], never an error.
 *   - INBOUND: the read keeps ONLY generic framework/enum handles. Any returned handle that echoes
 *     a specific person's identity is dropped; if that leaves nothing, the projection returns [].
 *   - DEGRADE: Brain absent (no key / no MCP) => return [] (pure Tier-0 degrade), no throw.
 *
 * Canon Part 7 (Reuse Before Build): the outbound call rides the shipped Phase 196 guard, and the
 * default Brain read reuses the shipped rs-brain-substrate.loadSubstrate surface. NO second Brain
 * client is built here.
 *
 * NO em-dashes / en-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 * Pure CJS, zero npm deps at projection time (the guard + substrate are required lazily).
 *
 * License: BSL 1.1.
 */

const guard = require('./part8-egress-guard.cjs');

// ---------------------------------------------------------------------------
// The TIGHT whitelist of keys we ever read off a local expert node to form an
// outbound handle. These are methodology enums that are, by construction,
// generic in the room. name / institution / affiliation / orcid / author /
// email are DELIBERATELY absent: a person byte cannot enter the outbound
// payload because we never read the key that carries it.
// ---------------------------------------------------------------------------
const GENERIC_KEYS = Object.freeze([
  'framework', 'domain', 'methodology', 'problem_type', 'enum', 'tier',
]);

// The person-byte keys we collect purely to run the outbound leak scan. If any
// of these values ever surfaces in the outbound string, the projection fails
// closed (returns []). This is defense-in-depth on top of the whitelist above.
const PERSON_KEYS = Object.freeze([
  'name', 'institution', 'affiliation', 'orcid', 'author', 'email',
  'authorName', 'expert', 'person',
]);

// A generic outbound handle: a lowercase methodology token, bounded length.
const GENERIC_HANDLE = /^[a-z0-9][a-z0-9 ._-]{0,60}$/;

// Fixed methodology-vocabulary tokens appended to the outbound query so the
// Phase 196 guard's positive MOVE-SET recognizer can prove the string carries
// generic methodology vocabulary. These are constants, never person bytes.
const METHODOLOGY_TOKENS = Object.freeze([
  'framework', 'methodology', 'reverse-salient', 'discovery',
]);

// Tiny stopword set: tokens too generic to treat as an identifying person byte.
// Dropping these prevents a name like "de la" from nuking every handle, while
// still catching the identifying tokens (surnames, institution words).
const PERSON_STOPWORDS = Object.freeze(new Set([
  'the', 'and', 'for', 'of', 'de', 'la', 'el', 'van', 'von', 'dr',
]));

/**
 * _collectPersonBytes(node) -> string[]  (the person NEEDLE set)
 *
 * Gather the lowercased person-byte values off the local expert node (shallow,
 * plus a one-level nested { name } on an institution/affiliation object) AND
 * expand each into its individual tokens (length >= 3, minus stopwords). The
 * token expansion is what makes the leak scan fail-closed: a read-back or a
 * smuggled handle that echoes only PART of a name (a bare surname) is still
 * caught. These needles are used ONLY for scanning; they never leave the process.
 */
function _collectPersonBytes(node) {
  const needles = new Set();
  if (!node || typeof node !== 'object') return [];
  const add = (raw) => {
    const val = raw.trim().toLowerCase();
    if (val.length === 0) return;
    needles.add(val); // the full value...
    const toks = val.split(/[^a-z0-9]+/).filter(Boolean);
    for (let j = 0; j < toks.length; j++) {
      const t = toks[j];
      if (t.length >= 3 && !PERSON_STOPWORDS.has(t)) needles.add(t); // ...and its identifying tokens.
    }
  };
  for (let i = 0; i < PERSON_KEYS.length; i++) {
    const v = node[PERSON_KEYS[i]];
    if (typeof v === 'string' && v.trim().length > 0) {
      add(v);
    } else if (v && typeof v === 'object' && typeof v.name === 'string' && v.name.trim().length > 0) {
      add(v.name);
    }
  }
  return Array.from(needles);
}

/**
 * _containsPersonByte(str, personBytes) -> boolean
 *
 * True if the (already-lowercased) string contains any collected person byte as
 * a substring. Empty/degenerate person bytes are ignored.
 */
function _containsPersonByte(strLower, personBytes) {
  for (let i = 0; i < personBytes.length; i++) {
    const pb = personBytes[i];
    if (pb && pb.length > 1 && strLower.indexOf(pb) !== -1) return true;
  }
  return false;
}

/**
 * _buildGenericOutbound(node, personBytes) -> string[]
 *
 * Read ONLY the whitelisted methodology-enum keys, lowercase + validate each
 * against the generic-handle shape, and drop any that (defensively) echoes a
 * person byte. Returns the de-duplicated generic handle list.
 */
function _buildGenericOutbound(node, personBytes) {
  const handles = [];
  const seen = new Set();
  for (let i = 0; i < GENERIC_KEYS.length; i++) {
    const v = node[GENERIC_KEYS[i]];
    if (typeof v !== 'string') continue;
    const h = v.trim().toLowerCase();
    if (h.length === 0 || !GENERIC_HANDLE.test(h)) continue;
    if (_containsPersonByte(h, personBytes)) continue; // defensive: never egress a person echo.
    if (seen.has(h)) continue;
    seen.add(h);
    handles.push(h);
  }
  return handles;
}

/**
 * _brainAvailable(opts) -> boolean
 *
 * Fail-closed availability probe. opts.brainAvailable (boolean) overrides for
 * tests. Otherwise consult the shipped brain-client.isAvailable(); any failure
 * to load or evaluate degrades to false (pure Tier-0).
 */
function _brainAvailable(opts) {
  if (typeof opts.brainAvailable === 'boolean') return opts.brainAvailable;
  try {
    const bc = require('./brain-client.cjs');
    return (bc && typeof bc.isAvailable === 'function') ? !!bc.isAvailable() : false;
  } catch (_e) {
    return false;
  }
}

/**
 * _defaultBrainReader(payload, opts) -> Promise<Array>
 *
 * The default READ surface reuses the shipped rs-brain-substrate.loadSubstrate
 * (Canon Part 7; no second Brain client). Returns the raw substrate array, or
 * [] on any failure. Tests inject opts.brainReader to stay offline.
 */
async function _defaultBrainReader(payload, opts) {
  try {
    const rsSub = require('./rs-brain-substrate.cjs');
    const res = await rsSub.loadSubstrate({ roomDir: opts.roomDir, limit: opts.limit || 50 });
    return (res && Array.isArray(res.substrate)) ? res.substrate : [];
  } catch (_e) {
    return [];
  }
}

/**
 * _extractGenericHandles(rawResults, personBytes) -> string[]
 *
 * Keep ONLY generic framework/enum handles from the Brain read. Any candidate
 * that echoes a specific person's identity is dropped (the "if the answer can
 * only be formed by echoing a person, return nothing" clause). De-duplicated.
 */
function _extractGenericHandles(rawResults, personBytes) {
  const out = [];
  const seen = new Set();
  for (let i = 0; i < rawResults.length; i++) {
    const entry = rawResults[i];
    if (!entry || typeof entry !== 'object') continue;
    const md = (entry.metadata && typeof entry.metadata === 'object') ? entry.metadata : {};
    const cand = md.framework_name || md.framework || entry.framework ||
      md.methodology_tier || md.enum;
    if (typeof cand !== 'string') continue;
    const h = cand.trim();
    if (h.length === 0 || h.length > 80) continue;
    if (_containsPersonByte(h.toLowerCase(), personBytes)) continue; // drop person echoes.
    if (seen.has(h)) continue;
    seen.add(h);
    out.push(h);
  }
  return out;
}

/**
 * projectExpertHandles(localExpertNode, opts) -> Promise<string[]>
 *
 * The additive Mode-A reader (D-200-2 (b)). Returns a de-duplicated list of
 * GENERIC framework/enum handles from the Brain expert-network, or [] on any
 * fail-closed condition (Brain absent, guard reject, read failure, or a person
 * byte that would otherwise cross the wire). NEVER throws.
 *
 * opts:
 *   brainAvailable  (boolean)   test override for the availability probe.
 *   classify        (function)  test override for the Phase 196 guard classify().
 *   brainReader     (function)  test override for the Brain read surface.
 *   onOutbound      (function)  spy hook: receives the exact outbound payload.
 *   roomDir / limit             forwarded to the default Brain reader.
 */
async function projectExpertHandles(localExpertNode, opts) {
  opts = opts || {};
  if (!localExpertNode || typeof localExpertNode !== 'object') return [];

  // Fail-closed: Brain absent => pure Tier-0 degrade.
  if (!_brainAvailable(opts)) return [];

  const personBytes = _collectPersonBytes(localExpertNode);
  const handles = _buildGenericOutbound(localExpertNode, personBytes);
  if (handles.length === 0) return []; // nothing generic to project.

  // Compose the outbound query: generic handles + fixed methodology vocabulary.
  const query = handles.concat(METHODOLOGY_TOKENS).join(' ');

  // Belt-and-suspenders: the outbound string must carry NO person byte. If it
  // somehow does, fail closed rather than leak.
  if (_containsPersonByte(query.toLowerCase(), personBytes)) return [];

  const payload = { question: query };

  // Expose the exact outbound payload to a spy BEFORE the guard sees it.
  if (typeof opts.onOutbound === 'function') {
    try { opts.onOutbound(payload); } catch (_e) { /* a spy must never affect flow */ }
  }

  // EVERY Brain call routes through the Phase 196 boundary guard. A verdict that
  // is not 'allow' -- or a guard throw -- is a degrade-to-Tier-0, not an error.
  const classifyFn = (typeof opts.classify === 'function') ? opts.classify : guard.classify;
  let verdict;
  try {
    verdict = classifyFn(payload, { toolName: 'brain_ask' });
  } catch (_e) {
    return [];
  }
  if (!verdict || verdict.verdict !== 'allow') return [];

  // READ generic handles from Brain (reuse the shipped substrate reader).
  const reader = (typeof opts.brainReader === 'function') ? opts.brainReader : _defaultBrainReader;
  let raw;
  try {
    raw = await reader(payload, opts);
  } catch (_e) {
    return []; // read failure => Tier-0 degrade, no throw.
  }
  if (!Array.isArray(raw)) return [];

  return _extractGenericHandles(raw, personBytes);
}

module.exports = {
  projectExpertHandles: projectExpertHandles,
  // Test seams (the adversarial suite spies these).
  _collectPersonBytes: _collectPersonBytes,
  _buildGenericOutbound: _buildGenericOutbound,
  _extractGenericHandles: _extractGenericHandles,
  _containsPersonByte: _containsPersonByte,
  GENERIC_KEYS: GENERIC_KEYS,
  PERSON_KEYS: PERSON_KEYS,
};
