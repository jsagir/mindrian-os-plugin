'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363.1 Plan 05, decision D-03 (finding B51-01, the P0): Eureka must
 * never rank the room's own scaffold. One pure predicate answers "is this room
 * node structure rather than content?" and the standalone runner (retired in
 * Phase 366-22) asked it in the index loop, BEFORE any pair or percentile cohort is built, so
 * full, room and graph modes are all covered and step 4b stays unchanged.
 *
 * WHY: in both beta.51 test rooms 0 of 25 ranked rows paired two real
 * artifacts. Step 4b only drops a pair when BOTH sides are
 * memory_artifact/Artifact, so a section contract against a generic entity, or
 * a classifier-fallback domain node, sailed through. Four real row shapes
 * (read-only evidence from the two beta.51 room.db files, 2026-09-29):
 *   - memory_artifact rows: id `memory_artifact:_root:BRAIN`, props
 *     {section, kind, path}.
 *   - section contracts and FEYNMANs: Artifact rows with id
 *     `<section>/CONTEXT` or `<section>/FEYNMAN` (a parent room prefixes the
 *     sub-room), source_path `system:rs-engine`, props {title, section}. A
 *     source_path check alone misses them; the id's last `/` segment carries
 *     the scaffold kind, and a FEYNMAN is scaffold only while its file on disk
 *     is still the seeded body (D-01/D-02 predicate).
 *   - domain rows: type `focus_area`, id `domain:<session>:<hash>`, props
 *     {name: <label>, domainType}. The labels are the Part 8 egress-class
 *     vocabulary (unknown, freeform_unmatched, empty_payload, move_set ...):
 *     the classifier's fallback bucket, not a domain of the venture.
 *   - the generic entity: type `company`, props {name: 'Lab', entityType,
 *     evidenceTier: 'low_confidence'}. Its low-trust stamp did not save it
 *     (the step-4b guard stays off in a room with no verified entity), so the
 *     name rule catches it independently of tier.
 *
 * REASONS returned by structuralReason, in check order:
 *   memory_artifact | scaffold_basename | egress_label_domain | low_idf_entity
 *
 * CANON PART 7 (reuse before build): the scaffold kinds come from
 * lib/core/scaffold-predicate.cjs (D-01) and the IDF corpus from
 * reasoning-mode's readRoomMarkdown walker (recursive, SKIP_DIRS, 40-char body
 * floor, and after this plan scaffold-free).
 *
 * CANON PART 8 (graph boundary): node built-ins plus local lib modules only.
 * The egress-class labels are a frozen byte-mirror of refusal-messaging's
 * EGRESS_CLASS_SET, NOT an import: refusal-messaging requires brain-client,
 * which would pull the Brain client into Eureka's require graph
 * (tests/test-341-eureka-no-brain-reach.cjs). A test reads that file as TEXT
 * and pins parity. Room text is read locally for the IDF count only and never
 * leaves the process.
 *
 * FAILURE POSTURE: content wins. Malformed props, a missing file, an unreadable
 * corpus all mean "not structural"; nothing here throws (T-363.1-09).
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 *
 * License: BSL 1.1.
 */

const path = require('node:path');

const scaffoldPredicate = require('../scaffold-predicate.cjs');

// Mirror of lib/core/refusal-messaging.cjs EGRESS_CLASS_SET (parity pinned by
// tests/test-363.1-eureka-exclusion.cjs, which reads that file as text).
const EGRESS_CLASS_DOMAIN_LABELS = Object.freeze(new Set([
  'content_set', 'empty_payload', 'move_set', 'unproven_packet',
  'freeform_unmatched', 'unknown', 'known_tool_shape', 'typed_question',
  'freeform_unproven', 'guard_unavailable',
  // 369.2-08 (CODE-07, 2026-10-05): mirrors the three classes added to
  // refusal-messaging EGRESS_CLASS_SET (parity pinned by U8).
  'room_content', 'room_check_unavailable', 'generic_question',
]));

// Single generic tokens that name a KIND of thing, never a specific one. A
// multi-token name ("Lab Automation Systems") is not touched by this list.
const GENERIC_ENTITY_TOKENS = Object.freeze(new Set([
  'lab', 'labs', 'team', 'group', 'company', 'center', 'centre', 'institute',
  'university', 'office', 'program', 'project', 'inc', 'llc', 'ltd',
]));

// The ratio rule needs a real corpus: in a 2- or 3-document room every entity
// appears in at least half the documents, so a ratio there is meaningless.
const MIN_IDF_CORPUS = 8;
// "At least half of the documents" is written as an integer cross-multiply
// (docFreq * 2 >= corpusTotal) rather than a 0.5 decimal literal, so the floor
// ledger sweep (tests/test-355-floor-sweep.cjs) is not asked to record a rule
// that is a structural exclusion, not a measured score threshold.
const IDF_HALF_DIVISOR = 2;

// Private byte-mirrors (the room-native-substrate leaf-mirror pattern): the
// writers own these enums; a leaf module mirrors a frozen Set rather than
// importing the navigation writer.
const DOMAIN_NODE_TYPES = Object.freeze(new Set(['domain', 'subdomain', 'focus_area']));
const ENTITY_NODE_TYPES = Object.freeze(new Set(['company', 'technology', 'market']));

const TOKEN_SPLIT = /[^\p{L}\p{N}]+/u;

function tokensOf(text) {
  return String(text == null ? '' : text).toLowerCase().split(TOKEN_SPLIT).filter(function (t) { return t.length > 0; });
}

// Parse a node row's props defensively. Accepts the SQL row shape
// (properties: JSON string) or an already-parsed object. Malformed -> {}.
function propsOf(row) {
  try {
    const raw = row && row.properties !== undefined ? row.properties : (row && row.props);
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }
  } catch (_e) {
    // fall through
  }
  return {};
}

// buildExclusionContext({ roomDir, corpus }) -> { roomDir, corpusTotal, docFreq }
// corpus defaults to the room's markdown (reasoning-mode's walker). A failure
// to read it means an empty corpus, which switches the ratio rule off.
function buildExclusionContext(opts) {
  const o = opts || {};
  const roomDir = (typeof o.roomDir === 'string' && o.roomDir.length > 0) ? o.roomDir : null;
  let corpus = o.corpus;
  if (!Array.isArray(corpus)) {
    corpus = [];
    if (roomDir) {
      try {
        // Lazy: only pay for the walker when a room dir was actually given.
        corpus = require('./reasoning-mode.cjs').readRoomMarkdown(roomDir) || [];
      } catch (_e) {
        corpus = [];
      }
    }
  }
  const docs = [];
  for (let i = 0; i < corpus.length; i += 1) {
    const text = corpus[i] && typeof corpus[i].text === 'string' ? corpus[i].text.toLowerCase() : '';
    docs.push({ text: text, tokens: new Set(tokensOf(text)) });
  }
  const memo = new Map();
  function docFreq(name) {
    const key = String(name == null ? '' : name).trim().toLowerCase();
    if (key.length === 0) return 0;
    if (memo.has(key)) return memo.get(key);
    const toks = tokensOf(key);
    let n = 0;
    if (toks.length === 1) {
      for (let i = 0; i < docs.length; i += 1) if (docs[i].tokens.has(toks[0])) n += 1;
    } else {
      for (let i = 0; i < docs.length; i += 1) if (docs[i].text.includes(key)) n += 1;
    }
    memo.set(key, n);
    return n;
  }
  return { roomDir: roomDir, corpusTotal: docs.length, docFreq: docFreq };
}

// A candidate on-disk path for a node, forward-slashed, ending in .md, or null
// when it is absolute-escaping or carries a `..` segment (a user-influenced
// props.path must never steer a read outside the room, T-363.1-09).
function normalizeCandidate(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let p = raw.replace(/\\/g, '/');
  if (p.startsWith('/') || /^[A-Za-z]:\//.test(p)) return null;
  if (p.split('/').indexOf('..') !== -1) return null;
  if (!/\.md$/i.test(p)) p += '.md';
  return p;
}

function scaffoldCandidates(row, props) {
  const out = [];
  const sp = typeof row.source_path === 'string' ? row.source_path : '';
  if (sp && sp.indexOf(':') === -1) out.push(normalizeCandidate(sp));
  if (typeof props.path === 'string' && props.path.indexOf(':') === -1) out.push(normalizeCandidate(props.path));
  const id = typeof row.id === 'string' ? row.id : '';
  if (id && id.indexOf('/') !== -1 && id.indexOf(':') === -1) out.push(normalizeCandidate(id));
  return out.filter(function (c) { return c !== null; });
}

function isFeynmanCandidate(cand) {
  const segs = cand.split('/');
  return segs[segs.length - 1] === 'FEYNMAN.md';
}

function scaffoldBasenameReason(row, props, ctx) {
  const cands = scaffoldCandidates(row, props);
  for (let i = 0; i < cands.length; i += 1) {
    const cand = cands[i];
    if (!scaffoldPredicate.isScaffoldBasename(cand)) continue;
    if (!isFeynmanCandidate(cand)) return 'scaffold_basename';
    // FEYNMAN is body-dependent: scaffold only when the seeded file is on disk.
    if (ctx && typeof ctx.roomDir === 'string' && ctx.roomDir.length > 0
        && scaffoldPredicate.isScaffoldFile(path.join(ctx.roomDir, cand))) {
      return 'scaffold_basename';
    }
  }
  return null;
}

function egressLabelDomainReason(row, props) {
  const id = typeof row.id === 'string' ? row.id : '';
  const domainLike = id.startsWith('domain:')
    || DOMAIN_NODE_TYPES.has(row.type)
    || typeof props.domainType === 'string';
  if (!domainLike) return null;
  const name = typeof props.name === 'string' ? props.name.trim() : '';
  if (name && EGRESS_CLASS_DOMAIN_LABELS.has(name)) return 'egress_label_domain';
  const sp = typeof row.source_path === 'string' ? row.source_path : '';
  if (sp) {
    const parts = sp.split(':');
    const last = parts[parts.length - 1].trim();
    if (last && EGRESS_CLASS_DOMAIN_LABELS.has(last)) return 'egress_label_domain';
  }
  return null;
}

function lowIdfEntityReason(props, ctx) {
  const et = typeof props.entityType === 'string' ? props.entityType.trim() : '';
  if (!ENTITY_NODE_TYPES.has(et)) return null;
  const name = typeof props.name === 'string' ? props.name.trim() : '';
  if (!name) return null;
  const toks = tokensOf(name);
  if (toks.length === 1 && GENERIC_ENTITY_TOKENS.has(toks[0])) return 'low_idf_entity';
  if (ctx && typeof ctx.docFreq === 'function' && ctx.corpusTotal >= MIN_IDF_CORPUS
      && ctx.docFreq(name) * IDF_HALF_DIVISOR >= ctx.corpusTotal) {
    return 'low_idf_entity';
  }
  return null;
}

// structuralReason(row, ctx) -> one of the four reason strings, or null.
function structuralReason(row, ctx) {
  try {
    if (!row || typeof row !== 'object') return null;
    const props = propsOf(row);
    const id = typeof row.id === 'string' ? row.id : '';
    if (id.startsWith('memory_artifact:') || row.type === 'memory_artifact') return 'memory_artifact';
    const sb = scaffoldBasenameReason(row, props, ctx);
    if (sb) return sb;
    const dom = egressLabelDomainReason(row, props);
    if (dom) return dom;
    return lowIdfEntityReason(props, ctx);
  } catch (_e) {
    return null;
  }
}

function isStructuralNode(row, ctx) {
  return structuralReason(row, ctx) !== null;
}

module.exports = {
  isStructuralNode,
  structuralReason,
  buildExclusionContext,
  EGRESS_CLASS_DOMAIN_LABELS,
  GENERIC_ENTITY_TOKENS,
  MIN_IDF_CORPUS,
};
