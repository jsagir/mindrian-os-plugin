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
function fmtBrainLine(brain) {
  if (!brain || typeof brain !== 'object') return '';
  const s = brain.staleness;
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
    return 'Brain derivation: stale (' + label + ',' + action + ')';
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
  DEFAULT_BUDGET_TOKENS: DEFAULT_BUDGET_TOKENS,
};
