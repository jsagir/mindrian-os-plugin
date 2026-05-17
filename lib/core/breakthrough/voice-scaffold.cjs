'use strict';
// Phase 120-03 Wave 2 Task 1 -- D-17 4-rule voice scaffold + auditor.
//
// Per CONTEXT.md D-17 LOCKED VERBATIM (the 4 rules):
//   Rule 1: Evidence requirement.   Cite artifact ids OR graph edges. Pattern matches:
//                                   "(artifacts #N, #M)" OR "[[artifact-name]]" OR
//                                   "(see edges X, Y)".
//   Rule 2: Mechanism clause.       "by Y" where Y is a user action.
//   Rule 3: Time anchor.            One of: "in the last N hours/days", "across this
//                                   week", "since YYYY-MM-DD" or specific weekday, or
//                                   "today/this morning".
//   Rule 4: No unbacked superlatives. 'breakthrough', 'biggest', 'first', 'unprecedented',
//                                   'major', 'massive' MUST NOT appear UNLESS adjacent to
//                                   a numeric backing. Frequency words 'consistent',
//                                   'repeated', 'always' MUST be accompanied by a count.
//
// The auditor IS the structural enforcement (D-20 meta-principle: every voice claim
// must be testable from graph state). Plan 120-03 scanner.cjs integration calls
// auditVoiceLine BEFORE passing the line into the F.7 surface; failed-audit lines are
// replaced with the structural default which is always auditor-safe.
//
// Canon Part 5: evidence is graded by context; the D-17 evidence requirement (rule 1)
//   maps to the four evidence tiers Academic / Operational / Practitioner / None via
//   the cite pattern (the cite IS the evidence anchor at this layer).
// Canon Part 8: pure LOCAL; no Brain coupling; no cross-room aggregation. Pure
//   function over the breakthrough record + an optional roomState scalar.
// Canon Part 10 sub-claim 5: the math IS the surface; the voice IS the math's
//   translation; honesty requires backing.
//
// Em-dash HARD RULE (CLAUDE.md feedback_no_emdashes): zero U+2014 in source -- use
//   the ASCII double-hyphen "--" sequence everywhere.

const VOICE_RULE_NAMES = Object.freeze([
  'evidence_requirement',
  'mechanism_clause',
  'time_anchor',
  'no_unbacked_superlatives',
]);

const FORBIDDEN_SUPERLATIVES = Object.freeze([
  'breakthrough', 'biggest', 'first', 'unprecedented', 'major', 'massive',
]);

const FREQUENCY_WORDS = Object.freeze([
  'consistent', 'repeated', 'always',
]);

// Display names for the 4 detector kinds emitted by Plan 120-00 detectors.cjs.
// Kept aligned with shape-f7-breakthrough-renderer.cjs::KIND_DISPLAY_NAMES at the
// human-readable surface (this module uses lowercase phrases since the voice line
// embeds the kind mid-sentence; the renderer uses TitleCase for the title row).
const KIND_DISPLAY = Object.freeze({
  convergence: 'convergence',
  contradiction_resolved: 'contradiction resolved',
  cross_domain_analogy: 'cross-domain analogy',
  reverse_salient_closed: 'closure on a lagging area',
});

// formatTimeAnchor mirrors the shape-f7-breakthrough-renderer.cjs bucket logic for
// the title line, but with phrasing tuned for the voice line (mid-sentence). Plan
// 120-01 renderer uses "in the last hour" / "today" / "this week"; this module
// matches those for consistency at the audit-pattern level (D-17 rule 3 regex
// patterns accept the same strings).
//
// Buckets (D-06 ethical fence: ages > 14 days surface the date):
//   ageHours < 1                -> "in the last hour"
//   ageHours < 8                -> "in the last N hours"
//   ageHours < 24               -> "today"
//   ageDays  < 2                -> "in the last day"
//   ageDays  < 3                -> "in the last two days"
//   ageDays  < 7                -> "this week"
//   ageDays  < 14               -> "in the last two weeks"
//   else                        -> "since YYYY-MM-DD"
function formatTimeAnchor(detected_at, nowMs) {
  const now = (typeof nowMs === 'number' && Number.isFinite(nowMs)) ? nowMs : Date.now();
  const ts = (typeof detected_at === 'number' && Number.isFinite(detected_at)) ? detected_at : now;
  const ageMs = Math.max(0, now - ts);
  const ageHours = ageMs / 3600000;
  const ageDays = ageHours / 24;
  if (ageHours < 1) return 'in the last hour';
  if (ageHours < 8) return 'in the last ' + Math.floor(ageHours) + ' hours';
  if (ageHours < 24) return 'today';
  if (ageDays < 2) return 'in the last day';
  if (ageDays < 3) return 'in the last two days';
  if (ageDays < 7) return 'this week';
  if (ageDays < 14) return 'in the last two weeks';
  const d = new Date(ts);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return 'since ' + yyyy + '-' + mm + '-' + dd;
}

// Structural default mechanism (D-17 rule 2 satisfaction without LLM/Brain).
// Honest fallback: cites the user action without inferring intent. Per Canon
// Part 8: no inferring; only counting.
function buildDefaultMechanism(artifactCount, _kind) {
  return 'by adding ' + artifactCount + ' artifacts to this section';
}

// composeBreakthroughVoiceLine -- THE composer. Pure function over the breakthrough
// record + an optional roomState (which may carry a roomState.mechanism_phrase
// that Larry has co-authored with the user, e.g. via a /mos:* command). Returns
// a single-line string in the canonical D-17 format:
//   "You're seeing a {kind} on {theme} (artifacts {ids}) -- {mechanism} -- {time_anchor}."
//
// Inputs:
//   breakthrough.kind         -> one of the 4 DETECTOR_TYPES (Plan 120-00)
//   breakthrough.theme        -> string (sliced to 120 chars at surface layer)
//   breakthrough.artifact_ids -> string[] (non-empty; D-20 HARD FLOOR upstream)
//   breakthrough.detected_at  -> number (epoch ms)
//   roomState                 -> {mechanism_phrase?: string} | null
//   nowMs                     -> number (epoch ms; for test determinism)
function composeBreakthroughVoiceLine(breakthrough, roomState, nowMs) {
  const bk = breakthrough || {};
  const ids = Array.isArray(bk.artifact_ids)
    ? bk.artifact_ids.filter((s) => typeof s === 'string' && s.length > 0)
    : [];
  const kindKey = (typeof bk.kind === 'string') ? bk.kind : '';
  const kindDisplay = KIND_DISPLAY[kindKey] || kindKey || 'pattern';
  const themeRaw = (typeof bk.theme === 'string') ? bk.theme : '';
  const theme = themeRaw.slice(0, 120);
  const evidenceCite = '(artifacts ' + ids.join(', ') + ')';
  const mechanism = (roomState && typeof roomState.mechanism_phrase === 'string' && roomState.mechanism_phrase.length > 0)
    ? roomState.mechanism_phrase
    : buildDefaultMechanism(ids.length, kindKey);
  const timeAnchor = formatTimeAnchor(bk.detected_at || Date.now(), nowMs);
  const themePart = theme ? ' on ' + theme : '';
  return "You're seeing a " + kindDisplay + themePart + ' ' + evidenceCite + ' -- ' + mechanism + ' -- ' + timeAnchor + '.';
}

// --- The 4 rule predicates ---
// Each is a pure function (string) -> boolean. Together they constitute the
// auditor's structural enforcement of D-17.

function citeEvidence(line) {
  // Rule 1: line MUST contain one of:
  //   (artifacts ...)       -- artifact-id cite
  //   [[...]]               -- wiki-link cite
  //   (see edges X, Y)      -- graph-edge cite
  if (typeof line !== 'string') return false;
  if (/\(artifacts\s+[^)]+\)/i.test(line)) return true;
  if (/\[\[[^\]]+\]\]/.test(line)) return true;
  if (/\(see\s+edges?\s+[^)]+\)/i.test(line)) return true;
  return false;
}

function includeMechanism(line) {
  // Rule 2: line MUST contain "by " followed by a verb phrase. Heuristic: "by "
  // immediately followed by a word character; rules out "by." standalone.
  if (typeof line !== 'string') return false;
  return /\bby\s+\w+/i.test(line);
}

function anchorTime(line) {
  // Rule 3: line MUST contain a time-anchor pattern.
  if (typeof line !== 'string') return false;
  const patterns = [
    /in the last\s+\d+\s+(hour|hours|day|days|week|weeks)/i,
    /in the last\s+(hour|day|two days|week|two weeks)/i,
    /this (week|morning|month)/i,
    /\btoday\b|\byesterday\b|\btonight\b/i,
    /across this week/i,
    /since\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})/i,
  ];
  return patterns.some((p) => p.test(line));
}

// hasNumericBacking -- a digit alone is too lax (artifact ids like "a1, a2"
// satisfy a naive /\d/ check while not actually backing the claim). The spec
// example "the highest differential score (0.78)" shows the intent: a real
// numeric measurement, typically a decimal/integer in parens, OR a multi-digit
// number, OR a number followed by a unit/score-word. We accept any of:
//   (N) or (N.N)            -- parenthesized number (the canonical D-17 form)
//   N.NN                    -- decimal number (e.g., 0.78)
//   \d{2,}                  -- multi-digit integer (count/score)
//   \d+\s*(score|count|sessions|times|days|hours|sigma|sd|%) -- numeric + unit
function hasNumericBacking(window) {
  if (/\(\d+(?:\.\d+)?\)/.test(window)) return true;
  if (/\d+\.\d+/.test(window)) return true;
  if (/\b\d{2,}\b/.test(window)) return true;
  if (/\b\d+\s*(score|count|sessions|times|days|hours|sigma|sd|%|x)\b/i.test(window)) return true;
  return false;
}

function noUnbackedSuperlatives(line) {
  // Rule 4: forbidden superlatives MUST NOT appear unless adjacent to numeric
  // backing (within 60-char window). Frequency words need a count within 30 chars.
  // "Numeric backing" is stricter than "contains a digit" -- see hasNumericBacking.
  if (typeof line !== 'string') return true;
  const lower = line.toLowerCase();
  for (const word of FORBIDDEN_SUPERLATIVES) {
    let searchFrom = 0;
    while (true) {
      const idx = lower.indexOf(word, searchFrom);
      if (idx < 0) break;
      const windowStart = Math.max(0, idx - 60);
      const windowEnd = Math.min(lower.length, idx + word.length + 60);
      const window = lower.slice(windowStart, windowEnd);
      if (!hasNumericBacking(window)) {
        return false;
      }
      searchFrom = idx + word.length;
    }
  }
  for (const word of FREQUENCY_WORDS) {
    let searchFrom = 0;
    while (true) {
      const idx = lower.indexOf(word, searchFrom);
      if (idx < 0) break;
      const windowStart = Math.max(0, idx - 30);
      const windowEnd = Math.min(lower.length, idx + word.length + 30);
      const window = lower.slice(windowStart, windowEnd);
      if (!hasNumericBacking(window)) {
        return false;
      }
      searchFrom = idx + word.length;
    }
  }
  return true;
}

// auditVoiceLine -- the auditor. Pure function (string) -> {ok, violations}.
// Returns {ok: true, violations: []} when ALL 4 rules pass.
// Returns {ok: false, violations: [...rule names...]} when one or more fail.
function auditVoiceLine(line) {
  const violations = [];
  if (!citeEvidence(line)) violations.push('evidence_requirement');
  if (!includeMechanism(line)) violations.push('mechanism_clause');
  if (!anchorTime(line)) violations.push('time_anchor');
  if (!noUnbackedSuperlatives(line)) violations.push('no_unbacked_superlatives');
  return { ok: violations.length === 0, violations: violations };
}

module.exports = {
  composeBreakthroughVoiceLine,
  auditVoiceLine,
  citeEvidence,
  includeMechanism,
  anchorTime,
  noUnbackedSuperlatives,
  formatTimeAnchor,
  VOICE_RULE_NAMES,
  FORBIDDEN_SUPERLATIVES,
  FREQUENCY_WORDS,
  KIND_DISPLAY,
};
