/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-01 -- folder-memory shared pure logic
 * ===============================================
 * Pure parsers + score/staleness logic for the per-folder memory triple
 * (ROOM.md + STATE.md + MINTO.md). Accepts pre-loaded buffers; performs
 * zero fs I/O. Consumed by both lib/core/folder-memory.cjs (sync entry
 * point) and lib/core/folder-memory-async.cjs (async entry point) so the
 * two surfaces emit identical shapes by construction.
 *
 * The read contract is documented in
 *   .planning/phases/88-feynman-minto-memory-layer/88-CONTEXT.md
 *     lines 99-132
 * and mirrored in the PLAN <interfaces> block. Changing the exported
 * shape here is a cross-plan-breaking change: 88-06 on-stop snapshot,
 * 88-07 session-start TRIPLE_CONTEXT injection, 88-08/88-09 compaction
 * re-injection, 88-10 decision-capture, 88-13 guardian, and the eventual
 * Phase 91 Navigation Engine all read through this module.
 *
 * Pure CJS, zero npm dependencies, node built-ins only. Mirrors Phase
 * 87-04 shared-module pattern (room-ops-shared.cjs).
 *
 * API:
 *   parseRoomMd(buf, mtimeMs) -> { exists:true, identity_text, references, last_updated_at }
 *   parseStateMd(buf)         -> { exists:true, artifact_count, gap_status,
 *                                   completeness_score, minto_health:'--',
 *                                   last_activity_at }
 *   parseMintoMd(buf, opts)   -> { exists:true, governing_thought,
 *                                   arguments_count, evidence_density,
 *                                   mece_status, decision_log,
 *                                   last_generated_at,
 *                                   last_artifact_write_seen_at,
 *                                   flagged_weaknesses,
 *                                   _parsed_ok:bool }
 *   computeStale(reasoning, artifactMtimes, mintoMtimeMs, invariantSeverity)
 *                              -> { is_stale, stale_reason }
 *   computeHealthScore(r)      -> number in [0,1]
 *   emptyRoom()/emptyState()/emptyReasoning()
 *                              -> default exists:false shells
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');

// ---------- Helpers ----------

const ROOM_BEGIN_MARKER = '<!-- BEGIN REFERENCES -->';
const ROOM_END_MARKER = '<!-- END REFERENCES -->';
// Wikilink: [[target]] or [[target|label]]
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

// ---------- Phase 90-04 BRAIN.md parser constants ----------
//
// OPTIONAL_SECTION_HEADINGS is duplicated byte-for-byte from
// lib/core/brain-md-schema.cjs (Phase 90-00) to preserve the flat
// lib/core dependency graph (88-01 key-decision: no cross-import from
// sibling contract modules). A parity test in
// lib/memory/folder-memory-quadruple.test.cjs asserts the two arrays
// remain byte-identical across edits. Any future heading addition MUST
// land in both files in the same commit; drift is caught at CI time.

const OPTIONAL_SECTION_HEADINGS = Object.freeze([
  '## Pattern Matches',
  '## Cross-Domain Analogies',
  '## Wicked Indicators',
  '## Unfilled Opportunity Matches',
  '## Framework Chain Predictions',
  '## Assessment Thinking Chain Position',
  '## ProblemType Classification',
  '## Flagged Contradictions (cross-room)',
  '## HSI Signals',
]);

// Heading text -> sections key mapping. The key is the canonical slug
// used inside the returned brain.sections object (lower_snake_case).
// Anything outside this set is ignored (forward-compat for user-extended
// BRAIN.md variants).
const BRAIN_SECTION_KEY_BY_HEADING = Object.freeze({
  '## Pattern Matches': 'pattern_matches',
  '## Cross-Domain Analogies': 'cross_domain_analogies',
  '## Wicked Indicators': 'wicked_indicators',
  '## Unfilled Opportunity Matches': 'unfilled_opportunity_matches',
  '## Framework Chain Predictions': 'framework_chain_predictions',
  '## Assessment Thinking Chain Position': 'assessment_thinking_chain_position',
  '## ProblemType Classification': 'problemtype_classification',
  '## Flagged Contradictions (cross-room)': 'flagged_contradictions_xroom',
  '## HSI Signals': 'hsi_signals',
});

function classifyRefType(target) {
  if (!target || typeof target !== 'string') return 'artifact';
  if (target.indexOf('/team/') !== -1 || target.indexOf('team/') === 0) return 'team';
  if (target.indexOf('/meetings/') !== -1 || target.indexOf('meetings/') === 0) return 'meeting';
  // Pure section reference: bare section name or section/ROOM.md
  if (/^[a-z][a-z0-9-]+\/ROOM\.md$/i.test(target)) return 'section';
  if (/^[a-z][a-z0-9-]+$/i.test(target)) return 'section';
  return 'artifact';
}

// ---------- Empty / default shells ----------

function emptyRoom() {
  return {
    exists: false,
    identity_text: '',
    references: [],
    last_updated_at: null,
  };
}

function emptyState() {
  return {
    exists: false,
    artifact_count: 0,
    gap_status: 'unknown',
    completeness_score: 0,
    minto_health: '--',
    last_activity_at: null,
  };
}

function emptyReasoning() {
  return {
    exists: false,
    governing_thought: null,
    arguments_count: 0,
    evidence_density: 0,
    mece_status: 'fail',
    reasoning_health_score: 0,
    flagged_weaknesses: [],
    decision_log: [],
    last_generated_at: null,
    last_artifact_write_seen_at: null,
    is_stale: true,
    stale_reason: 'never_generated',
  };
}

// ---------- ROOM.md parser ----------

/**
 * Parse a ROOM.md buffer. Returns identity_text (everything outside the
 * REFERENCES marker block) and references array (one entry per wikilink
 * found INSIDE the marker block).
 *
 * @param {string} buf utf8 content of ROOM.md
 * @param {number|null} mtimeMs mtime epoch ms (for last_updated_at)
 * @returns {object}
 */
function parseRoomMd(buf, mtimeMs) {
  if (typeof buf !== 'string') {
    return emptyRoom();
  }

  // Split on markers. Everything outside the markers is identity_text.
  let identityText = buf;
  let refsBlock = '';

  const beginIdx = buf.indexOf(ROOM_BEGIN_MARKER);
  const endIdx = buf.indexOf(ROOM_END_MARKER);
  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    refsBlock = buf.slice(beginIdx + ROOM_BEGIN_MARKER.length, endIdx);
    identityText = (buf.slice(0, beginIdx) + buf.slice(endIdx + ROOM_END_MARKER.length)).trim();
  } else {
    identityText = buf.trim();
  }

  const references = [];
  let m;
  // Reset regex state (global regex keeps lastIndex between calls).
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(refsBlock)) !== null) {
    const target = m[1].trim();
    const label = (m[2] || target).trim();
    references.push({
      target: target,
      type: classifyRefType(target),
      label: label,
    });
  }

  return {
    exists: true,
    identity_text: identityText,
    references: references,
    last_updated_at: mtimeMs ? new Date(mtimeMs).toISOString().replace(/\.\d+Z$/, 'Z') : null,
  };
}

// ---------- STATE.md parser ----------
//
// NOTE (PLAN C-4 correction): STATE.md does not carry a `MINTO health:`
// glyph. `minto_health` is a DERIVED signal, computed from the reasoning
// branch; we return '--' here (placeholder) and the caller synthesizes
// a check/dot/-- glyph from `reasoning.reasoning_health_score`.

/**
 * Parse a STATE.md buffer. Tolerant of both bash-rendered compute-state
 * output (Markdown tables) and hand-authored key:value shapes.
 *
 * @param {string} buf utf8 content of STATE.md
 * @returns {object}
 */
function parseStateMd(buf) {
  if (typeof buf !== 'string') return emptyState();

  const out = {
    exists: true,
    artifact_count: 0,
    gap_status: 'unknown',
    completeness_score: 0,
    minto_health: '--',
    last_activity_at: null,
  };

  // artifact_count: N  OR  Artifacts: N  OR  entries: N
  const acMatch = buf.match(/^\s*(?:artifact_count|Artifacts|entries)\s*:\s*(\d+)/mi);
  if (acMatch) {
    out.artifact_count = parseInt(acMatch[1], 10);
  }

  // gap_status: empty|seeded|active|complete|unknown
  const gsMatch = buf.match(/^\s*(?:gap_status|Status)\s*:\s*([a-zA-Z-]+)/m);
  if (gsMatch) {
    const raw = gsMatch[1].toLowerCase();
    if (['empty', 'seeded', 'active', 'complete', 'unknown', 'well-developed'].indexOf(raw) !== -1) {
      out.gap_status = raw === 'well-developed' ? 'active' : raw;
    }
  }

  // completeness_score: 0..1
  const csMatch = buf.match(/^\s*completeness_score\s*:\s*([\d.]+)/mi);
  if (csMatch) {
    const v = parseFloat(csMatch[1]);
    if (Number.isFinite(v)) out.completeness_score = Math.max(0, Math.min(1, v));
  }

  // last_activity or Last activity: YYYY-MM-DD
  const laMatch = buf.match(/^\s*(?:last_activity(?:_at)?|Last activity)\s*:\s*(\d{4}-\d{2}-\d{2}[^\n]*)/mi);
  if (laMatch) {
    out.last_activity_at = laMatch[1].trim();
  }

  return out;
}

// ---------- Narrow-dialect YAML frontmatter parser for MINTO.md ----------
//
// Scoped copy of the parser in lib/core/feynman-minto-invariants.cjs.
// Duplicated intentionally (per 88-00 key-decision "Narrow-dialect
// frontmatter parser duplicated in both generator and migration"): this
// module pulls ONLY the fields it needs from the v88 schema, which is a
// narrower dialect than the invariants parser. Keeping the copy here
// untangles lib/core dependency graphs (no circular require on invariants
// for its parser half).

function unquote(raw) {
  const s = raw.trim();
  if (s.length === 0) return '';
  if (s === 'null') return null;
  if (s[0] === '"') {
    if (s.length < 2 || s[s.length - 1] !== '"') return undefined; // unterminated
    return s.slice(1, -1);
  }
  if (s[0] === "'") {
    if (s.length < 2 || s[s.length - 1] !== "'") return undefined;
    return s.slice(1, -1);
  }
  if (s === '[]') return [];
  if (s[0] === '[' && s[s.length - 1] === ']') {
    // Flow-style list; split by comma, trim, unquote elements.
    const inner = s.slice(1, -1).trim();
    if (inner.length === 0) return [];
    return inner.split(',').map((x) => unquote(x));
  }
  return s;
}

function parseMintoFrontmatter(fmText) {
  const lines = fmText.split(/\r?\n/);
  const root = {};
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    if (raw.length === 0 || /^\s*$/.test(raw) || /^\s*#/.test(raw)) {
      i += 1;
      continue;
    }
    const m = raw.match(/^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/);
    if (!m) {
      return { ok: false, error: 'bad top-level line ' + (i + 1) };
    }
    const key = m[1];
    const rest = m[2];

    if (rest.trim().length > 0) {
      const v = unquote(rest);
      if (v === undefined) {
        return { ok: false, error: 'unterminated scalar for key ' + key };
      }
      root[key] = v;
      i += 1;
      continue;
    }

    // Block follows -- either empty, string array, or object array.
    i += 1;
    const items = [];
    let isObjectArray = false;
    let isStringArray = false;

    while (i < lines.length) {
      const next = lines[i];
      if (next.length === 0 || /^\s*$/.test(next) || /^\s*#/.test(next)) {
        i += 1;
        continue;
      }
      // Object entry: `  - key: value`
      const objHead = next.match(/^\s+-\s+([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
      if (objHead) {
        isObjectArray = true;
        const obj = {};
        const vraw = objHead[2];
        const v = unquote(vraw);
        if (v === undefined) {
          return { ok: false, error: 'unterminated scalar in object array for ' + key };
        }
        obj[objHead[1]] = v;
        i += 1;
        while (i < lines.length) {
          const cont = lines[i];
          if (cont.length === 0 || /^\s*$/.test(cont)) { i += 1; continue; }
          const contMatch = cont.match(/^\s+([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
          if (/^\s+-\s/.test(cont) || !contMatch) break;
          const cvRaw = contMatch[2];
          const cv = unquote(cvRaw);
          if (cv === undefined) {
            return { ok: false, error: 'unterminated scalar in object array cont for ' + key };
          }
          obj[contMatch[1]] = cv;
          i += 1;
        }
        items.push(obj);
        continue;
      }
      const strItem = next.match(/^\s+-\s+(.*)$/);
      if (strItem) {
        isStringArray = true;
        const v = unquote(strItem[1]);
        if (v === undefined) {
          return { ok: false, error: 'unterminated scalar in string array for ' + key };
        }
        items.push(v);
        i += 1;
        continue;
      }
      if (/^[A-Za-z_]/.test(next)) break;
      i += 1;
    }

    if (isStringArray && isObjectArray) {
      return { ok: false, error: 'mixed string/object array for ' + key };
    }
    root[key] = items;
  }

  return { ok: true, data: root };
}

// ---------- Body metrics (MECE + evidence density) ----------

function extractBodyMetrics(body) {
  // arguments_count: count MECE argument headers or '## ' claim-level
  // sections in the body. We look for `### Claim N:` pattern (matches the
  // Phase 81 generator output) and '## Key Claims' / MECE sections.
  let argumentsCount = 0;
  const claimMatches = body.match(/^###\s+Claim\s+\d+/gim);
  if (claimMatches) argumentsCount = claimMatches.length;
  if (argumentsCount === 0) {
    // Fallback: count top-level claim bullets under "Key Claims".
    const keyClaimsMatch = body.match(/^##\s+Key Claims[\s\S]*?(?=^##\s|\Z)/m);
    if (keyClaimsMatch) {
      const bullets = keyClaimsMatch[0].match(/^-\s+/gm);
      if (bullets) argumentsCount = bullets.length;
    }
  }

  // evidence_density: citations / claims. Citation = "Source:" marker or
  // `[[...]]` wikilink inside an Evidence block.
  const citations = (body.match(/Source:\s*/g) || []).length;
  const evidenceDensity = argumentsCount === 0 ? 0 : Math.min(1, citations / Math.max(1, argumentsCount));

  // mece_status: presence of "MECE Issue Tree" section + non-empty
  const meceMatch = body.match(/^##\s+MECE (?:Issue Tree|Arguments?)[\s\S]*?(?=^##\s|\Z)/m);
  let meceStatus = 'fail';
  if (meceMatch) {
    const block = meceMatch[0];
    const bulletCount = (block.match(/^\s*-\s+/gm) || []).length;
    if (bulletCount >= 3) meceStatus = 'pass';
    else if (bulletCount >= 1) meceStatus = 'warn';
  }

  return { argumentsCount, evidenceDensity, meceStatus };
}

// ---------- MINTO.md parser ----------

/**
 * Parse a MINTO.md buffer.
 *
 * @param {string} buf utf8 content
 * @returns {object} reasoning-branch fields (without staleness)
 */
function parseMintoMd(buf) {
  const out = {
    exists: true,
    governing_thought: null,
    arguments_count: 0,
    evidence_density: 0,
    mece_status: 'fail',
    flagged_weaknesses: [],
    decision_log: [],
    last_generated_at: null,
    last_artifact_write_seen_at: null,
    _parsed_ok: false,
  };

  if (typeof buf !== 'string' || buf.length === 0) return out;

  const fmRe = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const m = buf.match(fmRe);
  if (!m) {
    // No frontmatter at all -- parse failed.
    out._parsed_ok = false;
    return out;
  }

  const parsed = parseMintoFrontmatter(m[1]);
  if (!parsed.ok) {
    out._parsed_ok = false;
    return out;
  }
  const fm = parsed.data;
  const body = m[2] || '';

  // governing_thought: prefer frontmatter field (v88 schema); fall back
  // to "> [!abstract] Governing Thought\n> text" from body.
  if (typeof fm.governing_thought === 'string' && fm.governing_thought.length > 0) {
    out.governing_thought = fm.governing_thought;
  } else {
    const gtMatch = body.match(/>\s*\[!abstract\]\s+Governing Thought\s*\n>\s*([^\n]+)/);
    if (gtMatch) out.governing_thought = gtMatch[1].trim();
  }

  if (typeof fm.last_generated_at === 'string') {
    out.last_generated_at = fm.last_generated_at;
  } else if (fm.last_generated_at === null) {
    out.last_generated_at = null;
  }
  if (typeof fm.last_artifact_write_seen_at === 'string') {
    out.last_artifact_write_seen_at = fm.last_artifact_write_seen_at;
  }

  if (Array.isArray(fm.flagged_weaknesses)) {
    out.flagged_weaknesses = fm.flagged_weaknesses.filter((x) => typeof x === 'string');
  }

  if (Array.isArray(fm.decision_log)) {
    // Preserve write order (oldest first). Guardian enforces caps; read
    // is permissive.
    out.decision_log = fm.decision_log
      .filter((e) => e && typeof e === 'object')
      .map((e) => ({
        session_id: typeof e.session_id === 'string' ? e.session_id : '',
        timestamp: typeof e.timestamp === 'string' ? e.timestamp : '',
        action: typeof e.action === 'string' ? e.action : '',
        user_response: typeof e.user_response === 'string' ? e.user_response : '',
        reason: typeof e.reason === 'string' ? e.reason : '',
        outcome: typeof e.outcome === 'string' ? e.outcome : undefined,
      }));
  }

  const bm = extractBodyMetrics(body);
  out.arguments_count = bm.argumentsCount;
  out.evidence_density = bm.evidenceDensity;
  out.mece_status = bm.meceStatus;
  out._parsed_ok = true;

  return out;
}

// ---------- Staleness computation ----------

/**
 * Compute staleness signal for a parsed reasoning branch.
 *
 * @param {object} reasoning fields from parseMintoMd
 * @param {Array<number>} artifactMtimes ms epochs of section artifact files
 * @param {number|null} mintoMtimeMs ms epoch of MINTO.md itself
 * @param {string|null} invariantSeverity 'critical' | ... | null from 88-00-B validate
 * @returns {{is_stale:boolean, stale_reason:string|null}}
 */
function computeStale(reasoning, artifactMtimes, mintoMtimeMs, invariantSeverity) {
  if (invariantSeverity === 'critical') {
    return { is_stale: true, stale_reason: 'invariant_violation' };
  }
  if (reasoning._parsed_ok === false) {
    return { is_stale: true, stale_reason: 'parse_failed' };
  }

  const lga = reasoning.last_generated_at;
  // Sentinel zero timestamp from 88-00 migration = never regenerated under v88
  if (lga === '1970-01-01T00:00:00Z') {
    return { is_stale: true, stale_reason: 'never_generated' };
  }
  // Field absent entirely -> missing_timestamps (distinguishes "never
  // migrated under v88" sentinel from "no timestamp at all" edge case).
  if (lga == null || lga === '') {
    return { is_stale: true, stale_reason: 'missing_timestamps' };
  }

  const lgaMs = Date.parse(lga);
  if (!Number.isFinite(lgaMs)) {
    return { is_stale: true, stale_reason: 'missing_timestamps' };
  }

  // Compare artifact mtimes to MINTO generation time.
  const referenceMs = mintoMtimeMs != null ? mintoMtimeMs : lgaMs;
  if (Array.isArray(artifactMtimes)) {
    for (const mt of artifactMtimes) {
      if (Number.isFinite(mt) && mt > referenceMs + 1000) {
        return { is_stale: true, stale_reason: 'artifacts_newer_than_minto' };
      }
    }
  }

  return { is_stale: false, stale_reason: null };
}

// ---------- Health score ----------

/**
 * computeHealthScore(reasoning) -> number in [0,1]
 *
 * Formula (from PLAN <interfaces> block):
 *   + 0.3 if governing_thought non-empty
 *   + 0.2 * min(arguments_count / 3, 1)
 *   + 0.2 * min(evidence_density, 1)
 *   + 0.1 if mece_status == 'pass' (0.05 if warn, 0 if fail)
 *   + 0.2 if is_stale == false
 * Clamped to [0, 1].
 */
function computeHealthScore(r) {
  if (!r || typeof r !== 'object') return 0;
  let s = 0;
  if (typeof r.governing_thought === 'string' && r.governing_thought.length > 0) s += 0.3;
  const ac = typeof r.arguments_count === 'number' ? r.arguments_count : 0;
  s += 0.2 * Math.min(ac / 3, 1);
  const ed = typeof r.evidence_density === 'number' ? r.evidence_density : 0;
  s += 0.2 * Math.min(Math.max(ed, 0), 1);
  if (r.mece_status === 'pass') s += 0.1;
  else if (r.mece_status === 'warn') s += 0.05;
  if (r.is_stale === false) s += 0.2;
  return Math.max(0, Math.min(1, s));
}

// ---------- Phase 90-04 BRAIN.md parser ----------
//
// Pure helper that consumes a BRAIN.md file path and returns either
// null (file absent) or a structured object:
//
//   {
//     exists: true,
//     section: string,
//     brain_generated_at: string | null,
//     brain_graph_version: number | null,
//     governing_thought_hash: string | null,
//     staleness: 'fresh' | 'stale' | 'unavailable',
//     stale_reason: string | null,
//     author: string,
//     confidence_baseline: number | null,
//     parse_failed: boolean,
//     sections: {
//       pattern_matches: null | {body, tokens_estimate},
//       cross_domain_analogies: null | {body, tokens_estimate},
//       wicked_indicators: null | {body, tokens_estimate},
//       unfilled_opportunity_matches: null | {body, tokens_estimate},
//       framework_chain_predictions: null | {body, tokens_estimate},
//       assessment_thinking_chain_position: null | {body, tokens_estimate},
//       problemtype_classification: null | {body, tokens_estimate},
//       flagged_contradictions_xroom: null | {body, tokens_estimate},
//       hsi_signals: null | {body, tokens_estimate},
//     },
//     flagged_weaknesses: string[]
//   }
//
// Precedence (mirrors Phase 88-01 emptyReasoning staleness pattern):
//   1. BRAIN.md absent                         -> null (literal)
//   2. Empty / non-regular file                -> emptyBrain, parse_failed:true, staleness:'stale'
//   3. Frontmatter delimiter missing           -> emptyBrain, parse_failed:true
//   4. Narrow-dialect YAML unparseable         -> emptyBrain, parse_failed:true
//   5. Valid                                   -> full struct, parse_failed:false
//
// Graceful degradation: NEVER throws. Every failure returns a struct
// with parse_failed:true rather than propagating an exception up to
// readQuadruple callers (session-start, Navigation Engine, dashboard).
//
// Pure I/O: this module owns the BRAIN.md read boundary inside shared.
// Keeping the I/O here keeps folder-memory.cjs (sync) and
// folder-memory-async.cjs (async) free of duplicate file-open code while
// respecting the 88-01 pattern of "shared owns parsers, entry points own
// orchestration."

function emptyBrainSections() {
  return {
    pattern_matches: null,
    cross_domain_analogies: null,
    wicked_indicators: null,
    unfilled_opportunity_matches: null,
    framework_chain_predictions: null,
    assessment_thinking_chain_position: null,
    problemtype_classification: null,
    flagged_contradictions_xroom: null,
    hsi_signals: null,
  };
}

function emptyBrain() {
  return {
    exists: false,
    section: '',
    brain_generated_at: null,
    brain_graph_version: null,
    governing_thought_hash: null,
    staleness: 'unavailable',
    stale_reason: null,
    author: '',
    confidence_baseline: null,
    parse_failed: false,
    sections: emptyBrainSections(),
    flagged_weaknesses: [],
  };
}

// Narrow-dialect YAML scalar parser scoped to BRAIN.md fields (flat
// scalars only: strings, ints, floats, booleans, null). Mirrors the
// dialect used in lib/core/brain-md-schema.cjs and
// lib/core/brain-md-staleness.cjs; duplicated here intentionally so
// shared keeps zero cross-import into those modules (flat dep graph).

function unquoteBrainScalar(raw) {
  const s = raw.trim();
  if (s.length === 0) return '';
  if (s[0] === '"') {
    if (s.length < 2 || s[s.length - 1] !== '"') return undefined;
    return s.slice(1, -1);
  }
  if (s[0] === "'") {
    if (s.length < 2 || s[s.length - 1] !== "'") return undefined;
    return s.slice(1, -1);
  }
  return s;
}

function castBrainScalar(s) {
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (Number.isSafeInteger(n)) return n;
  }
  if (/^-?\d+\.\d+$/.test(s)) {
    const f = parseFloat(s);
    if (Number.isFinite(f)) return f;
  }
  return s;
}

function parseBrainFrontmatter(src) {
  if (typeof src !== 'string' || src.length === 0) {
    return { ok: false };
  }
  const lines = src.split(/\r?\n/);
  const root = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0 || /^\s*$/.test(line) || /^\s*#/.test(line)) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/);
    if (!m) return { ok: false };
    const key = m[1];
    const rest = m[2];
    if (rest.trim().length === 0) {
      root[key] = '';
      continue;
    }
    const raw = unquoteBrainScalar(rest);
    if (raw === undefined) return { ok: false };
    root[key] = castBrainScalar(raw);
  }
  return { ok: true, data: root };
}

// Walk the body for any "## " line. For each line that matches one of
// BRAIN_SECTION_KEY_BY_HEADING, capture the body bytes until the next
// "## " or EOF. Unknown headings are silently skipped (future-compat).

function extractBrainSections(body) {
  const sections = emptyBrainSections();
  if (typeof body !== 'string' || body.length === 0) return sections;
  const lines = body.split(/\r?\n/);

  let currentKey = null;
  let currentBuf = [];

  function flush() {
    if (currentKey) {
      const bodyText = currentBuf.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
      if (bodyText.length > 0) {
        sections[currentKey] = {
          body: bodyText,
          tokens_estimate: Math.ceil(bodyText.length / 4),
        };
      }
    }
    currentKey = null;
    currentBuf = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+/.test(line)) {
      flush();
      // Heading text is the full "## Heading" line, normalized by
      // stripping any trailing whitespace (leading '## ' preserved).
      const headingTrim = line.replace(/\s+$/, '');
      const key = BRAIN_SECTION_KEY_BY_HEADING[headingTrim];
      if (key) {
        currentKey = key;
      } else {
        // Unknown heading: we still flush any accumulating body but
        // drop this block by leaving currentKey null. Bytes between
        // this unknown heading and the next known heading are ignored
        // (future-compat).
        currentKey = null;
      }
      continue;
    }
    if (currentKey) currentBuf.push(line);
  }
  flush();
  return sections;
}

/**
 * parseBrainMd(filePath) -> null | struct
 *
 * null  when the file is absent.
 * struct when the file is present; parse_failed reflects whether the
 * frontmatter parsed cleanly.
 *
 * Never throws.
 */
function parseBrainMd(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) return null;

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (_e) {
    return null; // absent
  }
  if (!stat.isFile()) return null;

  // Empty / non-regular -> emptyBrain parse_failed
  if (stat.size === 0) {
    const shell = emptyBrain();
    shell.exists = true;
    shell.parse_failed = true;
    shell.staleness = 'stale';
    return shell;
  }

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (_e) {
    const shell = emptyBrain();
    shell.exists = true;
    shell.parse_failed = true;
    shell.staleness = 'stale';
    return shell;
  }

  const fmRe = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  const m = raw.match(fmRe);
  if (!m) {
    const shell = emptyBrain();
    shell.exists = true;
    shell.parse_failed = true;
    shell.staleness = 'stale';
    return shell;
  }

  const parsed = parseBrainFrontmatter(m[1]);
  if (!parsed.ok) {
    const shell = emptyBrain();
    shell.exists = true;
    shell.parse_failed = true;
    shell.staleness = 'stale';
    return shell;
  }
  const fm = parsed.data;
  const body = m[2] || '';

  const brain = emptyBrain();
  brain.exists = true;
  brain.parse_failed = false;

  brain.section = typeof fm.section === 'string' ? fm.section : '';
  brain.brain_generated_at = typeof fm.brain_generated_at === 'string' && fm.brain_generated_at.length > 0
    ? fm.brain_generated_at
    : null;
  brain.brain_graph_version = typeof fm.brain_graph_version === 'number'
    ? fm.brain_graph_version
    : null;
  brain.governing_thought_hash = typeof fm.governing_thought_hash === 'string' && fm.governing_thought_hash.length > 0
    ? fm.governing_thought_hash
    : null;
  brain.staleness = (
    fm.staleness === 'fresh' ||
    fm.staleness === 'stale' ||
    fm.staleness === 'unavailable'
  ) ? fm.staleness : 'unavailable';
  brain.stale_reason = (fm.stale_reason === null || fm.stale_reason === undefined || fm.stale_reason === '')
    ? null
    : fm.stale_reason;
  brain.author = typeof fm.author === 'string' ? fm.author : '';
  brain.confidence_baseline = typeof fm.confidence_baseline === 'number'
    ? fm.confidence_baseline
    : null;

  brain.sections = extractBrainSections(body);
  brain.flagged_weaknesses = []; // BRAIN.md schema does not populate this
                                 // via narrow-dialect YAML arrays; the
                                 // field stays as [] for forward-compat
                                 // with Plan 90-05 invariants validator.

  return brain;
}

/**
 * attachBrainToTriple(triple, brainStruct) -> {room, state, reasoning, brain}
 *
 * Pure assembler. Does NOT copy triple fields; the returned object
 * references the same room/state/reasoning objects as the input
 * (consistent with Phase 88-01 readTriple output -- callers treat the
 * returned object as read-only). Adds a brain field without mutating
 * the input.
 */
function attachBrainToTriple(triple, brainStruct) {
  const t = triple || {};
  return {
    room: t.room,
    state: t.state,
    reasoning: t.reasoning,
    brain: brainStruct === undefined ? null : brainStruct,
  };
}

module.exports = {
  parseRoomMd: parseRoomMd,
  parseStateMd: parseStateMd,
  parseMintoMd: parseMintoMd,
  parseBrainMd: parseBrainMd,
  computeStale: computeStale,
  computeHealthScore: computeHealthScore,
  emptyRoom: emptyRoom,
  emptyState: emptyState,
  emptyReasoning: emptyReasoning,
  emptyBrain: emptyBrain,
  attachBrainToTriple: attachBrainToTriple,
  classifyRefType: classifyRefType,
  OPTIONAL_SECTION_HEADINGS: OPTIONAL_SECTION_HEADINGS,
};
