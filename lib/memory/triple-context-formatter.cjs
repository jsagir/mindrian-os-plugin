/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-07 Task 1 -- TRIPLE_CONTEXT formatter
 * ================================================
 * Pure formatter for the TRIPLE_CONTEXT block that scripts/session-start
 * injects into Claude's additionalContext. Consumed by scripts/session-start
 * to render per-section triple memory (ROOM identity + STATE summary +
 * MINTO reasoning) that survives session boundaries.
 *
 * Budget policy (grounded in measurement, not heuristic):
 *   - DEFAULT_BUDGET_TOKENS = 5000 (baseline session-start emission measured
 *     at ~3825 tokens on a 2-section fixture; 5000-token cap leaves room
 *     inside practical 40-50k aggregate session-start ceiling). See
 *     88-07-SUMMARY.md for the measurement trace.
 *   - Env override: SESSION_START_BUDGET_TOKENS=N overrides the default
 *     at runtime. Must parse to a positive integer; falls back to default
 *     on garbage (non-numeric, zero, negative).
 *   - Truncation: sort sections by reasoning_health_score ASCENDING (weakest
 *     first = most-informative-first). Null scores sort BEFORE any numeric
 *     score (treated as weakest). Emit until budget consumed; append
 *     "[+N strongest sections elided for budget]" footer.
 *
 * Decision log policy:
 *   - Render latest 3 entries per section. If more, append "[+N older]".
 *   - Empty decision_log -> "Decision log:" header omitted entirely.
 *
 * References policy:
 *   - <= 5 refs -> render all as space-separated wikilinks.
 *   - > 5 refs -> first 5 + "[+N more]".
 *
 * Staleness:
 *   - is_stale:true -> State line carries "(stale: <stale_reason>)" suffix.
 *
 * Pending-tier-1 footer:
 *   - pendingTier1 array with entries -> soft footer with count + /mos:reason
 *     hint.
 *
 * Stale-report footer:
 *   - staleReport array with entries -> soft footer listing sections + reasons.
 *
 * Zero sections -> returns empty string so session-start falls through to
 * existing behavior without emitting an empty block.
 *
 * Pure logic: zero fs imports, zero child_process, zero node:url. Surface-
 * agnostic by construction (CLI + Desktop MCP + Cowork).
 *
 * Exports:
 *   module.exports = {
 *     formatTripleContext({ sections, pendingTier1?, staleReport? }) -> string,
 *     estimateTokens(str) -> number,
 *     getBudgetTokens() -> number,
 *     DEFAULT_BUDGET_TOKENS: 5000
 *   };
 *
 * License: BSL 1.1.
 */

'use strict';

// ---------- Constants ----------

// Default budget (grounded in measurement; see 88-07-SUMMARY.md).
// Baseline session-start emission measured at ~3825 tokens on a
// 2-section fixture; 5000-token cap for TRIPLE_CONTEXT leaves room inside
// the practical 40-50k aggregate session-start ceiling.
const DEFAULT_BUDGET_TOKENS = 5000;

// Decision-log rendering cap per section.
const DECISION_LOG_RECENT = 3;

// Reference-rendering cap per section.
const REFS_RENDER_CAP = 5;

// Reserve ~200 tokens for header + elision footer + safety slack so the
// per-section accumulation cannot nudge the total over the cap when the
// footer is appended last.
const FOOTER_RESERVE_TOKENS = 200;

// ---------- classifyHealth helper (88.1-03: systemMessage retrofit) ----------
//
// Canon Part 2 glyph vocabulary: check / warn / low / --. Extracted so both
// the TRIPLE_CONTEXT formatter (existing inline consumer) and the 88.1-03
// hook systemMessage emission (new consumer) and the 88.1-04 statusline
// (future consumer) share a single classifier. Byte-identity with the prior
// inline implementation is preserved: same thresholds (>=0.7 -> check,
// >=0.4 -> warn, else low), same missing-data fallback (--).
//
// Signature: classifyHealth(score: number | null | undefined)
//   -> 'check' | 'warn' | 'low' | '--'
//
// - Finite number >= 0.7 -> 'check'
// - Finite number >= 0.4 -> 'warn'
// - Finite number < 0.4  -> 'low'
// - null | undefined | NaN | non-number -> '--'
function classifyHealth(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return '--';
  if (score >= 0.7) return 'check';
  if (score >= 0.4) return 'warn';
  return 'low';
}

// ---------- Token estimation ----------

function estimateTokens(str) {
  if (!str) return 0;
  const s = typeof str === 'string' ? str : String(str);
  return Math.ceil(s.length / 4);
}

// ---------- Budget resolution (env override) ----------

function getBudgetTokens() {
  const raw = process.env.SESSION_START_BUDGET_TOKENS;
  if (raw !== undefined && raw !== null && raw !== '') {
    const n = parseInt(raw, 10);
    // Must parse cleanly AND be positive. parseInt("abc")=NaN, parseInt("0")=0.
    // We reject NaN, zero, negatives, and strings that don't represent the
    // full value (e.g. "3abc" parses as 3 but the caller likely typo'd).
    if (Number.isFinite(n) && n > 0 && String(n) === String(raw).trim()) {
      return n;
    }
  }
  return DEFAULT_BUDGET_TOKENS;
}

// ---------- Helpers ----------

/**
 * Sort keys weakest-first. Null reasoning_health_score sorts FIRST
 * (treated as highest-priority-to-surface). Ties broken by section name
 * for deterministic output.
 */
function sortKeysWeakestFirst(sections) {
  const keys = Object.keys(sections || {});
  return keys.sort((a, b) => {
    const sa = sections[a] && sections[a].reasoning
      ? sections[a].reasoning.reasoning_health_score
      : undefined;
    const sb = sections[b] && sections[b].reasoning
      ? sections[b].reasoning.reasoning_health_score
      : undefined;
    // null / undefined -> -1 (weakest-most, sorted first)
    const ka = (sa === null || sa === undefined) ? -1 : Number(sa);
    const kb = (sb === null || sb === undefined) ? -1 : Number(sb);
    if (ka !== kb) return ka - kb;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

function fmtRefs(refs) {
  if (!Array.isArray(refs) || refs.length === 0) return '(none)';
  const rendered = [];
  const cap = REFS_RENDER_CAP;
  const sliced = refs.slice(0, cap);
  for (const r of sliced) {
    if (!r || !r.target) continue;
    const label = r.label && r.label !== r.target ? '|' + r.label : '';
    rendered.push('[[' + r.target + label + ']]');
  }
  let s = rendered.join(' ');
  const overflow = refs.length - cap;
  if (overflow > 0) s += ' [+' + overflow + ' more]';
  return s || '(none)';
}

function fmtDecision(d) {
  if (!d || typeof d !== 'object') return '';
  const ts = d.timestamp ? String(d.timestamp).slice(0, 10) : 'unknown';
  const action = d.action || 'unknown';
  const resp = d.user_response || 'unknown';
  const reason = d.reason ? ' (reason: ' + String(d.reason) + ')' : '';
  return '- ' + ts + ': ' + action + ' -> user ' + resp + reason;
}

function fmtStateLine(state, reasoning) {
  const parts = [];
  if (state && state.exists) {
    const ac = Number(state.artifact_count) || 0;
    parts.push(ac + ' artifact' + (ac === 1 ? '' : 's'));
    if (typeof state.completeness_score === 'number') {
      const pct = Math.round(state.completeness_score * 100);
      parts.push(pct + '% complete');
    }
    if (state.last_activity_at) {
      parts.push('last updated ' + String(state.last_activity_at).slice(0, 10));
    }
  } else {
    parts.push('no STATE.md');
  }

  // Derive MINTO health glyph from reasoning_health_score via the shared
  // classifyHealth helper (exported for Plan 88.1-04 statusline + Plan 88.1-03
  // hook systemMessage retrofit; 88.1-03: systemMessage retrofit).
  const health = classifyHealth(
    reasoning && typeof reasoning.reasoning_health_score === 'number'
      ? reasoning.reasoning_health_score
      : null
  );
  let line = parts.join(', ') + ', MINTO health ' + health;

  // Stale annotation
  if (reasoning && reasoning.is_stale) {
    const reason = reasoning.stale_reason || 'unknown';
    line += ' (stale: ' + reason + ')';
  }
  return line;
}

function fmtReasoningBlock(reasoning) {
  const lines = [];
  if (!reasoning || !reasoning.exists) {
    lines.push('  governing thought: (not yet generated)');
    return lines.join('\n');
  }
  const gt = reasoning.governing_thought;
  if (gt === null || gt === undefined || gt === '') {
    lines.push('  governing thought: (not yet generated)');
  } else {
    lines.push('  governing thought: "' + String(gt) + '"');
  }
  const argc = Number(reasoning.arguments_count) || 0;
  const mece = reasoning.mece_status || 'fail';
  const score = typeof reasoning.reasoning_health_score === 'number'
    ? reasoning.reasoning_health_score.toFixed(2)
    : 'n/a';
  lines.push('  arguments ' + argc + ', MECE ' + mece + ', reasoning health ' + score);
  return lines.join('\n');
}

function fmtDecisionLog(decisionLog) {
  if (!Array.isArray(decisionLog) || decisionLog.length === 0) return '';
  const total = decisionLog.length;
  // Latest N are the END of the array (write order, oldest-first per 88-01).
  const recent = decisionLog.slice(Math.max(0, total - DECISION_LOG_RECENT));
  const overflow = total - recent.length;
  const lines = ['Decision log:'];
  for (const d of recent) {
    const line = fmtDecision(d);
    if (line) lines.push('  ' + line);
  }
  if (overflow > 0) lines.push('  [+' + overflow + ' older]');
  return lines.join('\n');
}

// ---------- Phase 90-03: Brain derivation annotation ----------
//
// Per-section staleness result emitted by lib/core/brain-md-staleness.cjs.
// Rendered as a single optional line after the Reasoning block. Shape:
//   { exists, staleness, stale_reason, brain_generated_at, brain_graph_version,
//     age_days, recommended_action }
//
// Render policy (per plan interfaces):
//   fresh present -> "Brain derivation: fresh (2d ago, v1)"
//   stale present + hash mismatch -> "Brain derivation: stale (governing_thought changed, regenerating)"
//   stale present + age_exceeded -> "Brain derivation: stale (9d ago, pending regen)"
//   stale present + version mismatch -> "Brain derivation: stale (graph version updated, regenerating)"
//   stale present + parse_failed -> "Brain derivation: stale (parse failed, regenerating)"
//   stale + recommended_action=enqueue_when_brain_online -> " ... pending Brain connection"
//   absent + brain online -> "Brain derivation: absent"
//   absent + brain offline -> "Brain derivation: absent (Brain offline)"
//
// Backward-compat: if the entire room has zero BRAIN.md files AND
// brain_offline_everywhere=true, Plan 90-03 caller should suppress the
// per-section line (scripts/session-start decides this at the payload
// level; formatter renders whatever brain field is attached).
function staleLabelAndAction(brain) {
  const reason = brain.stale_reason || 'unknown';
  let label;
  if (reason === 'governing_thought_changed') label = 'governing_thought changed';
  else if (reason === 'age_exceeded') {
    const d = typeof brain.age_days === 'number' ? Math.round(brain.age_days) + 'd ago' : 'age exceeded';
    label = d;
  } else if (reason === 'brain_graph_version_mismatch') label = 'graph version updated';
  else if (reason === 'parse_failed') label = 'parse failed';
  else if (reason === 'brain_offline') label = 'Brain offline';
  else label = String(reason);
  const action = brain.recommended_action === 'enqueue_when_brain_online'
    ? ' pending Brain connection'
    : ' regenerating';
  return { label: label, action: action };
}

// 369.25 plan 20 (FBRIEF-06, T-369.25-20-03): a BRAIN.md that is the FeyMinto Theo face says what happened to the
// question (asked, or not asked and why) instead of "Brain derivation: fresh", which for a face that asked nothing
// would be a false statement. The not-asked wording is the ONE table in lib/core/feyminto/theo-ask.cjs
// (NOT_ASKED_LINES, required lazily so this module stays free of load-time dependencies); the "not asked: " prefix
// is dropped because the line already says it.
const FACE_NAME = 'feyminto-theo';

function notAskedText(brain) {
  if (typeof brain.not_asked_line === 'string' && brain.not_asked_line.length > 0) {
    return brain.not_asked_line.replace(/^not asked:\s*/i, '');
  }
  const reason = typeof brain.not_asked_reason === 'string' && brain.not_asked_reason.length > 0 ? brain.not_asked_reason : 'no reason recorded';
  try {
    const table = require('../core/feyminto/theo-ask.cjs').NOT_ASKED_LINES;
    if (table && typeof table[reason] === 'string') return table[reason].replace(/^not asked:\s*/i, '');
  } catch (_e) { /* fall back to the reason words */ }
  return reason.replace(/_/g, ' ');
}

function fmtFaceLine(brain) {
  let line;
  if (brain.asked === true) {
    let age = '';
    if (typeof brain.age_days === 'number') {
      const d = Math.max(0, Math.round(brain.age_days));
      age = ' ' + (d === 0 ? 'today' : d + 'd ago');
    }
    const q = typeof brain.queries_sent === 'number'
      ? ' (' + brain.queries_sent + ' ' + (brain.queries_sent === 1 ? 'query' : 'queries') + ')'
      : '';
    line = 'FeyMinto Theo face: asked' + age + q;
  } else {
    line = 'FeyMinto Theo face: not asked (' + notAskedText(brain) + ')';
  }
  if (brain.staleness === 'stale') {
    const sl = staleLabelAndAction(brain);
    line += ' - stale (' + sl.label + ',' + sl.action + ')';
  }
  return line;
}

// readFaceFields(brainMdText) -> { face, asked, not_asked_reason, queries_sent } | null
//   The four frontmatter keys the face line needs, read from a BRAIN.md text. null when the file is not a FeyMinto
//   Theo face (a legacy BRAIN.md), so the caller attaches nothing and the old line stays.
function readFaceFields(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  m[1].split(/\r?\n/).forEach(function (ln) {
    const k = ln.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (k) fm[k[1]] = k[2].replace(/^"(.*)"$/, '$1').trim();
  });
  if (fm.face !== FACE_NAME) return null;
  const q = Number(fm.queries_sent);
  return {
    face: FACE_NAME,
    asked: fm.asked === 'true',
    not_asked_reason: fm.not_asked_reason && fm.not_asked_reason !== 'null' ? fm.not_asked_reason : null,
    queries_sent: fm.queries_sent !== undefined && fm.queries_sent !== 'null' && Number.isFinite(q) ? q : null,
  };
}

function fmtBrainLine(brain) {
  if (!brain || typeof brain !== 'object') return '';
  const s = brain.staleness;
  if (brain.face === FACE_NAME && s !== 'absent') return fmtFaceLine(brain);
  if (s === 'absent') {
    const offline = brain.stale_reason === 'brain_offline';
    return 'Brain derivation: absent' + (offline ? ' (Brain offline)' : '');
  }
  if (s === 'fresh') {
    const parts = [];
    if (typeof brain.age_days === 'number') {
      const d = Math.max(0, Math.round(brain.age_days));
      parts.push(d === 0 ? 'today' : d + 'd ago');
    }
    if (typeof brain.brain_graph_version === 'number') {
      parts.push('v' + brain.brain_graph_version);
    }
    const detail = parts.length > 0 ? ' (' + parts.join(', ') + ')' : '';
    return 'Brain derivation: fresh' + detail;
  }
  if (s === 'stale') {
    const sl = staleLabelAndAction(brain);
    return 'Brain derivation: stale (' + sl.label + ',' + sl.action + ')';
  }
  return '';
}

/**
 * Build per-section block. Returns string (possibly multi-line). Never
 * throws on malformed inputs; degrades gracefully.
 *
 * Phase 90-03: accepts optional `triple.brain` field (result of
 * lib/core/brain-md-staleness.cjs computeBrainStaleness). Rendered as a
 * single 'Brain derivation: ...' line after the Reasoning block when
 * present. Absent field -> line suppressed (backward-compat for rooms
 * with zero BRAIN.md files / Brain offline forever).
 */
function buildSectionBlock(name, triple) {
  const t = triple || {};
  const room = t.room || {};
  const state = t.state || {};
  const reasoning = t.reasoning || {};
  const brain = t.brain || null;

  const lines = [];
  lines.push('### ' + name + '/');

  // Identity line
  const identity = room.exists && room.identity_text
    ? String(room.identity_text).split('\n')[0].replace(/^#+\s*/, '').slice(0, 160)
    : '(no ROOM.md)';
  lines.push('Identity: ' + identity);

  // References line
  lines.push('References: ' + fmtRefs(room.references));

  // State line
  lines.push('State: ' + fmtStateLine(state, reasoning));

  // Reasoning block (2 lines)
  lines.push('Reasoning:');
  lines.push(fmtReasoningBlock(reasoning));

  // Phase 90-03: Brain derivation annotation (optional, per-section).
  const brainLine = fmtBrainLine(brain);
  if (brainLine) lines.push(brainLine);

  // Decision log (conditional)
  const dl = fmtDecisionLog(reasoning.decision_log);
  if (dl) lines.push(dl);

  return lines.join('\n');
}

// ---------- Footers ----------

function fmtPendingTier1Footer(pendingTier1) {
  if (!Array.isArray(pendingTier1) || pendingTier1.length === 0) return '';
  const n = pendingTier1.length;
  return '> NOTE: ' + n + ' section' + (n === 1 ? '' : 's') +
    ' have tier-0 MINTO pending tier-1 regen. Run /mos:reason --regenerate to upgrade reasoning narratives.';
}

function fmtStaleFooter(staleReport) {
  if (!Array.isArray(staleReport) || staleReport.length === 0) return '';
  const parts = staleReport.map(s => {
    const sec = (s && s.section) ? s.section : 'unknown';
    const reason = (s && s.reason) ? s.reason : 'unknown';
    return sec + ' (' + reason + ')';
  });
  return '> NOTE: ' + parts.length + ' section' + (parts.length === 1 ? '' : 's') +
    ' flagged stale: ' + parts.join(', ') + '.';
}

// ---------- 369.25 plan 20: the active nest's brief head (FBRIEF-02, ICM audit change 3) ----------
//
// Session start (the CLI hook) and context_assemble (Desktop and Cowork have no SessionStart hook) both inject the
// ACTIVE nest's first three BRIEF.md blocks and link the rest. Both call the functions below, so the two assemblers
// cannot disagree (RESEARCH Pitfall 18, docs/LAYER-CONTRACT.md names the two).
//
// BRIEF_HEAD_BUDGET: 600 tokens (bytes / 4) for the whole head, split THIS NEST SERVES 100, WE CURRENTLY THINK 300,
// THE QUESTION THAT MATTERS NOW 200. Derivation: the ICM audit walk test needs entry + contract + these three blocks
// inside 8000 tokens, and 600 is 12 percent of this formatter's own DEFAULT_BUDGET_TOKENS (5000). The thought gets
// the largest share because it is what the nest currently believes; the job statement is one or two sentences; the
// open question is one block. The 600 covers the head as printed (its heading line, stale line, block headings and
// More line included): when the printed head would pass 600, the thought and then the question are cut further.
// The "Other nests:" links line is separate: it is one short link per nest and grows with the room, not the brief.

const BRIEF_HEAD_BUDGET = Object.freeze({ total: 600, serves: 100, think: 300, question: 200 });

const BRIEF_HEAD_BLOCKS = Object.freeze([
  Object.freeze({ heading: '## THIS NEST SERVES', cap: 'serves' }),
  Object.freeze({ heading: '## WE CURRENTLY THINK', cap: 'think' }),
  Object.freeze({ heading: '## THE QUESTION THAT MATTERS NOW', cap: 'question' }),
]);

const BRIEF_MORE_MARK = '(more in BRIEF.md)';
const BRIEF_STALE_LINE = 'stale: inputs changed since this brief was written';
const NEST_LINKS_MAX_BYTES = 1200;

function byteLen(text) { return Buffer.byteLength(String(text), 'utf8'); }

// Cut text to at most maxBytes (UTF-8) counting the marker, on a word boundary when one is close, and say where the
// rest is. Text already inside the cap is returned unchanged.
function cutToBytes(text, maxBytes) {
  const t = String(text);
  if (byteLen(t) <= maxBytes) return t;
  const marker = ' ' + BRIEF_MORE_MARK;
  const room = Math.max(0, maxBytes - byteLen(marker));
  // the longest prefix that fits inside the room, found by bisection on the character count
  let lo = 0;
  let hi = t.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (byteLen(t.slice(0, mid)) <= room) lo = mid; else hi = mid - 1;
  }
  let cut = t.slice(0, lo).replace(/[\uD800-\uDBFF]$/, '');
  const ws = cut.search(/\s\S*$/);
  if (ws > cut.length * 0.6) cut = cut.slice(0, ws);
  return cut.replace(/\s+$/, '') + marker;
}

function briefBodyOf(text) {
  const m = String(text).match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  return m ? m[1] : String(text);
}

// The text of one H2 block of a brief (heading excluded, trimmed), or null when the heading is absent.
function extractBriefBlock(briefText, heading) {
  const lines = briefBodyOf(briefText).split(/\r?\n/);
  let i = lines.findIndex((l) => l.replace(/\s+$/, '') === heading);
  if (i === -1) return null;
  const out = [];
  for (i += 1; i < lines.length && !/^## /.test(lines[i]); i++) out.push(lines[i]);
  return out.join('\n').trim();
}

/**
 * formatBriefHead({ section, briefText, briefRelPath?, stale?, staleDetail? }) -> string ('' when no block is found)
 *   section       the nest slug
 *   briefText     the BRIEF.md text (renderBrief output)
 *   briefRelPath  the link in the More line (default <section>/BRIEF.md)
 *   stale         true when the brief's inputs changed since it was written: adds the stale line
 *   staleDetail   optional words after the stale line, for example "MINTO.md changed"
 * The head is the heading line, an optional stale line, the three opening blocks each cut to its cap with
 * "(more in BRIEF.md)", and one More line naming what the rest of the brief holds. At most BRIEF_HEAD_BUDGET.total
 * tokens by bytes / 4 for the whole head.
 */
function formatBriefHead(opts) {
  const o = opts || {};
  const section = String(o.section || 'this nest');
  const rel = typeof o.briefRelPath === 'string' && o.briefRelPath.length > 0 ? o.briefRelPath : section + '/BRIEF.md';
  const found = BRIEF_HEAD_BLOCKS.map((b) => extractBriefBlock(o.briefText, b.heading));
  if (found.every((f) => f === null)) return '';

  const caps = {};
  BRIEF_HEAD_BLOCKS.forEach((b) => { caps[b.cap] = BRIEF_HEAD_BUDGET[b.cap] * 4; });
  const floors = { think: 160, question: 120, serves: 80 };
  const totalBytes = BRIEF_HEAD_BUDGET.total * 4;

  function build() {
    const lines = ['FeyMinto: ' + section + ' (from BRIEF.md)'];
    if (o.stale === true) {
      const d = typeof o.staleDetail === 'string' && o.staleDetail.length > 0 ? ' (' + o.staleDetail + ')' : '';
      lines.push(BRIEF_STALE_LINE + d);
    }
    BRIEF_HEAD_BLOCKS.forEach((b, i) => {
      lines.push('', b.heading, '');
      lines.push(found[i] === null ? '(this block is missing from BRIEF.md)' : cutToBytes(found[i], caps[b.cap]));
    });
    lines.push('', 'More: ' + rel + " (proposed next move, evidence, Theo's contribution, your decision)");
    return lines.join('\n');
  }

  let out = build();
  const order = ['think', 'question', 'serves'];
  for (let guard = 0; guard < 12 && byteLen(out) > totalBytes; guard++) {
    const over = byteLen(out) - totalBytes;
    const k = order.find((n) => caps[n] > floors[n]);
    if (!k) break;
    caps[k] = Math.max(floors[k], caps[k] - over - 8);
    out = build();
  }
  return out;
}

function formatNestLinks(nestLinks) {
  if (!Array.isArray(nestLinks) || nestLinks.length === 0) return '';
  const parts = nestLinks.map((l) => {
    const sec = l && l.section ? String(l.section) : 'unknown';
    return l && l.path ? String(l.path) : sec + ' (no brief yet)';
  });
  let line = 'Other nests: ';
  for (let i = 0; i < parts.length; i++) {
    const piece = (i === 0 ? '' : ', ') + parts[i];
    if (byteLen(line + piece) > NEST_LINKS_MAX_BYTES) return line + ' (+' + (parts.length - i) + ' more nests)';
    line += piece;
  }
  return line;
}

function listNests(roomDir, fs, path) {
  let entries = [];
  try { entries = fs.readdirSync(roomDir, { withFileTypes: true }); } catch (_e) { return []; }
  return entries
    .filter((d) => d.isDirectory() && d.name[0] !== '.' && fs.existsSync(path.join(roomDir, d.name, 'ROOM.md')))
    .map((d) => d.name).sort();
}

function mtimeMs(fs, p) { try { return fs.statSync(p).mtimeMs; } catch (_e) { return -1; } }

// The input files whose hash in the brief's RECORD BASIS block differs from the nest now (names only).
function changedInputs(briefText, current) {
  const recorded = {};
  String(briefText).split(/\r?\n/).forEach((l) => {
    const m = l.match(/^- ([A-Za-z]+\.md) (sha256:[0-9a-f]{64}) modified /);
    if (m) recorded[m[1]] = m[2];
    const a = l.match(/^- ([A-Za-z]+\.md) absent$/);
    if (a) recorded[a[1]] = null;
  });
  const now = {};
  (current.inputs || []).forEach((i) => { now[i.file] = i.sha256; });
  (current.absent || []).forEach((f) => { now[f] = null; });
  const names = [];
  Object.keys(now).forEach((f) => { if (Object.prototype.hasOwnProperty.call(recorded, f) && recorded[f] !== now[f]) names.push(f); });
  Object.keys(now).forEach((f) => { if (!Object.prototype.hasOwnProperty.call(recorded, f) && now[f] !== null) names.push(f); });
  return names;
}

/**
 * assembleBriefHead({ roomDir, sessionId?, db?, section? }) -> {
 *     head: string|null, text: string|null, links: [{section, path}], section, source, state, reason, tokens }
 *
 * The one assembler both surfaces call. The active nest is, in order: an explicit `section`; the session's focus
 * section (resolveFocusSection on the read handle `db`, read through the navigation door) when sessionId and db are
 * given; else the nest whose BRIEF.md or MINTO.md changed last. state:
 *   'no_briefs'   no nest has a BRIEF.md: head and text are null and the caller keeps today's per-section rendering
 *   'fresh'       the brief's record_basis_fingerprint equals recordBasis(sectionPath).fingerprint now
 *   'stale'       it does not (or the brief carries none, or the check could not run): the head says so
 *   'no_brief'    the active nest has no BRIEF.md: the head says "no brief yet" and why, nothing is invented
 *   'unreadable'  its BRIEF.md has none of the three opening blocks: the head says so
 * text is head plus the "Other nests:" line, the string both surfaces print. Never throws, never writes.
 */
function assembleBriefHead(opts) {
  const o = opts || {};
  const fs = require('node:fs');
  const path = require('node:path');
  const none = { head: null, text: null, links: [], section: null, source: null, state: 'no_briefs', reason: 'no nest has a BRIEF.md', tokens: 0 };
  try {
    const roomDir = typeof o.roomDir === 'string' ? o.roomDir : '';
    if (!roomDir) return none;
    const nests = listNests(roomDir, fs, path);
    const hasBrief = (n) => fs.existsSync(path.join(roomDir, n, 'BRIEF.md'));
    if (!nests.some(hasBrief)) return none;

    let active = null;
    let source = null;
    if (typeof o.section === 'string' && nests.indexOf(o.section) !== -1) { active = o.section; source = 'explicit'; }
    if (active === null && o.sessionId && o.db) {
      try {
        const r = require('../core/navigation.cjs').resolveFocusSection(o.db, o.sessionId);
        if (r && r.ok === true && nests.indexOf(r.section) !== -1) { active = r.section; source = 'focus'; }
      } catch (_e) { /* no focus: fall through to the newest nest */ }
    }
    if (active === null) {
      let best = -1;
      nests.forEach((n) => {
        const t = Math.max(mtimeMs(fs, path.join(roomDir, n, 'BRIEF.md')), mtimeMs(fs, path.join(roomDir, n, 'MINTO.md')));
        if (t > best || (t === best && active !== null && n > active)) { best = t; active = n; }
      });
      source = 'newest';
    }
    if (active === null) return none;

    const links = nests.filter((n) => n !== active).map((n) => ({ section: n, path: hasBrief(n) ? n + '/BRIEF.md' : null }));
    const finish = (head, state, reason) => {
      const line = formatNestLinks(links);
      return { head: head, text: head + (line ? '\n\n' + line : ''), links: links, section: active, source: source, state: state, reason: reason, tokens: Math.ceil(byteLen(head) / 4) };
    };

    const sectionPath = path.join(roomDir, active);
    const briefPath = path.join(sectionPath, 'BRIEF.md');
    if (!fs.existsSync(briefPath)) {
      return finish('FeyMinto: ' + active + ' has no brief yet (BRIEF.md has not been written for this nest). Nothing is shown for it here rather than a guess.', 'no_brief', 'BRIEF.md has not been written for this nest');
    }
    let briefText = '';
    try { briefText = fs.readFileSync(briefPath, 'utf8'); } catch (_e) { briefText = ''; }

    let stale = false;
    let detail = '';
    const rec = briefText.match(/^record_basis_fingerprint:\s*"?(sha256:[0-9a-f]{64})"?\s*$/m);
    try {
      const basis = require('../core/feyminto/brief.cjs').recordBasis(sectionPath);
      if (!rec) { stale = true; detail = 'the brief carries no record basis, so its freshness cannot be checked'; }
      else if (rec[1] !== basis.fingerprint) {
        stale = true;
        const names = changedInputs(briefText, basis);
        detail = names.length > 0 ? names.join(', ') + ' changed' : '';
      }
    } catch (_e) { stale = true; detail = 'the record basis could not be read, so freshness could not be checked'; }

    const head = formatBriefHead({ section: active, briefText: briefText, briefRelPath: active + '/BRIEF.md', stale: stale, staleDetail: detail });
    if (head === '') {
      return finish('FeyMinto: ' + active + ' brief could not be read (none of its opening blocks were found in BRIEF.md). Nothing is shown for it here rather than a guess.', 'unreadable', 'BRIEF.md has none of the three opening blocks');
    }
    return finish(head, stale ? 'stale' : 'fresh', stale ? (detail || 'inputs changed') : null);
  } catch (e) {
    return Object.assign({}, none, { reason: 'assemble_failed: ' + String((e && e.message) || e).slice(0, 120) });
  }
}

// The one readiness line both assemblers print (369.25 plan 13 wording). withCard: the recovery card body travels
// with the answer (context_assemble), so the line tells the model to present it instead of waiting for a filing.
function readinessLine(requirement, opts) {
  const withCard = !!(opts && opts.withCard);
  return 'FeyMinto: this room is not ready (' + String(requirement) + '). The recovery rebuilds the record from ROOM.md and the registry and indexes the files already here; it runs only on your word: '
    + (withCard ? 'show the person the recovery card and let them answer it, or run /mos:graph --derive.' : 'answer the recovery card when a filing asks, or run /mos:graph --derive.');
}

// ---------- Main formatter ----------

/**
 * formatTripleContext({ sections, pendingTier1?, staleReport? }) -> string
 *
 * Sections map: { <sectionName>: <tripleObject> } (shape from folder-memory.readTriple).
 * pendingTier1: optional array of { section }-shaped entries from
 *   .mindrian/pending-tier1-regen.json.
 * staleReport: optional array of { section, reason }-shaped entries from
 *   .mindrian/minto-stale.json.
 *
 * Returns complete block string OR empty string if no sections to render.
 * Guaranteed: estimateTokens(output) <= getBudgetTokens().
 */
function formatTripleContext(opts) {
  const o = opts || {};
  const sections = (o.sections && typeof o.sections === 'object') ? o.sections : {};

  // 369.25 plan 20: with the active nest's brief head the per-section blocks are NOT injected; the head, the links to
  // the other nests and the two footers are. Absent briefHead, the output below is byte-identical to before.
  if (typeof o.briefHead === 'string' && o.briefHead.length > 0) {
    const pieces = ['## ACTIVE ROOM MEMORY (active nest brief)', '', o.briefHead, ''];
    const links = formatNestLinks(o.nestLinks);
    if (links) { pieces.push(links); }
    const pF = fmtPendingTier1Footer(o.pendingTier1);
    if (pF) pieces.push(pF);
    const sF = fmtStaleFooter(o.staleReport);
    if (sF) pieces.push(sF);
    return pieces.join('\n');
  }

  const keys = sortKeysWeakestFirst(sections);

  if (keys.length === 0) return '';

  const budget = getBudgetTokens();
  const header = '## ACTIVE ROOM MEMORY (per-section triple)';

  // Build all section blocks up front so we can pack into budget.
  const built = [];
  for (const k of keys) {
    const block = buildSectionBlock(k, sections[k]);
    built.push({ name: k, block: block, tokens: estimateTokens(block) });
  }

  // Pack weakest-first into budget. Reserve room for header + potential
  // elision footer so we can append them without overshooting the cap.
  const headerTokens = estimateTokens(header);
  const available = Math.max(0, budget - headerTokens - FOOTER_RESERVE_TOKENS);

  const emitted = [];
  let used = 0;
  for (const entry of built) {
    // +1 token for the blank-line separator between blocks
    const withSep = entry.tokens + 1;
    if (used + withSep > available) break;
    emitted.push(entry);
    used += withSep;
  }

  const elidedCount = built.length - emitted.length;

  // If nothing fits, still emit at least the header + weakest section
  // truncated to a single line so the output is non-empty and useful.
  if (emitted.length === 0 && built.length > 0) {
    // Degenerate: cap too tight. Emit header + "N sections elided" footer only.
    const pieces = [header, '', '> NOTE: ' + built.length +
      ' strongest sections elided for budget (budget too tight to render any section)'];
    return pieces.join('\n');
  }

  // Compose final output
  const pieces = [header, ''];
  for (const e of emitted) {
    pieces.push(e.block);
    pieces.push('');
  }

  if (elidedCount > 0) {
    pieces.push(
      '> NOTE: ' + elidedCount +
      ' strongest sections elided for budget (sorted weakest-first; weakest preserved)'
    );
  }

  // Footers (pending-tier1, stale)
  const pFooter = fmtPendingTier1Footer(o.pendingTier1);
  if (pFooter) pieces.push(pFooter);
  const sFooter = fmtStaleFooter(o.staleReport);
  if (sFooter) pieces.push(sFooter);

  let out = pieces.join('\n');

  // Final budget safety: if we somehow exceed the cap (e.g. pending/stale
  // footers blew the reserve), trim elided footer first, then emitted
  // sections from the end (strongest-first, preserving weakest-first order).
  // We CAP to budget * 4 chars as a hard backstop.
  const capChars = budget * 4;
  if (out.length > capChars) {
    // Hard truncate with clear marker. This path is defensive only;
    // should never fire with sensible budgets.
    out = out.slice(0, capChars - 80) +
      '\n> NOTE: output truncated to respect SESSION_START_BUDGET_TOKENS';
  }

  return out;
}

module.exports = {
  formatTripleContext: formatTripleContext,
  estimateTokens: estimateTokens,
  getBudgetTokens: getBudgetTokens,
  classifyHealth: classifyHealth,
  fmtBrainLine: fmtBrainLine,
  readFaceFields: readFaceFields,
  formatBriefHead: formatBriefHead,
  assembleBriefHead: assembleBriefHead,
  readinessLine: readinessLine,
  BRIEF_HEAD_BUDGET: BRIEF_HEAD_BUDGET,
  DEFAULT_BUDGET_TOKENS: DEFAULT_BUDGET_TOKENS,
};
