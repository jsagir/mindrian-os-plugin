/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 100-02 Task 1 -- STATE.md Decisions section parser
 * =========================================================
 * Reusable shared parser for the `## Decisions` (or `### Decisions`)
 * section that appears in both project-level STATE.md and per-room
 * STATE.md files. Phase 100 ships this as a side-effect deliverable
 * (Decision #15 / CONTEXT code_context) -- the JTBD classifier
 * (lib/hmi/jtbd-classifier.cjs) reads recent decisions as Stratum 3
 * input per CONTEXT D-04, and Phase 101+ phases consume the same
 * parser without re-implementing.
 *
 * Public API:
 *   parseDecisions(stateMdText)
 *     -> Array<{
 *          date: string|null,           // ISO or human-readable
 *          verb: string|null,           // one of Canon Part 3 ten or 'Free-Text'
 *          summary: string,             // bullet body sans annotations
 *          methodology_hook?: string,   // e.g. '/mos:rs-fetch'
 *          jtbd?: string,               // e.g. 'find-bottleneck'
 *          raw: string                  // original line content
 *        }>
 *
 *   recentDecisions(stateMdText, n=3)
 *     -> Array<...same shape...>
 *
 * Behavior:
 *   - Pure function; no I/O. Caller reads the file.
 *   - Tolerant of bullet, numbered list, or table formats.
 *   - Tolerant of trailing/leading whitespace and blank lines.
 *   - Returns chronological-recent-first (top of section assumed newest;
 *     STATE.md convention is to prepend recent entries).
 *   - Detects optional `[methodology: /mos:X]` annotation.
 *   - Detects optional `[jtbd: <id>]` annotation.
 *   - Empty / missing section returns [].
 *
 * Canon Part 8 compliance:
 *   - LOCAL-only. No Brain query. No external I/O. Zero npm deps.
 *
 * License: BSL 1.1.
 */

'use strict';

// Canon Part 3 ten verbs (lowercase compare). Plus 'Free-Text' which
// is verb #10. We accept any leading verb token followed by ':' or '-'
// or ' '. Unknown verbs are treated as Free-Text.
const CANON_VERBS = [
  'run methodology',
  'reformulate',
  'spawn sub-agent',
  'navigate graph',
  "devil's advocate",
  'devils advocate',
  'scenario plan',
  'synthesize',
  'bank opportunity',
  'defer',
  'free-text',
];

// Match `[methodology: /mos:X]` or `[methodology:/mos:X]`.
const METHODOLOGY_RE = /\[methodology:\s*(\/mos:[a-z0-9_-]+|\/gsd:[a-z0-9_-]+)\s*\]/i;

// Match `[jtbd: <id>]` -- id is kebab-case.
const JTBD_RE = /\[jtbd:\s*([a-z0-9_-]+)\s*\]/i;

// Match leading date in ISO (YYYY-MM-DD) or simple human form (YYYY/MM/DD,
// "Apr 29 2026", etc.). We extract the most-leading match.
const ISO_DATE_RE = /^(\d{4}-\d{2}-\d{2})/;

// Bullet/numbered list line detector. Capture the body after the marker.
//   - foo
//   * foo
//   1. foo
//   2) foo
const BULLET_RE = /^\s*(?:[-*+]|\d+[.)])\s+(.+)$/;

// Table-row detector. Capture cells separated by `|`.
const TABLE_ROW_RE = /^\s*\|(.+)\|\s*$/;

function findSection(text, headingRegex) {
  // Returns the body lines BETWEEN headingRegex and the next heading of equal
  // or greater scope (## or ###).
  const lines = text.split(/\r?\n/);
  let inSection = false;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inSection) {
      if (headingRegex.test(line)) {
        inSection = true;
      }
      continue;
    }
    // Stop at next heading of any level (### Decisions usually sits inside ##
    // Accumulated Context, so we stop at ## OR ### OR #).
    if (/^#{1,6}\s+\S/.test(line)) {
      break;
    }
    out.push(line);
  }
  return out;
}

function extractDate(body) {
  const m = body.match(ISO_DATE_RE);
  if (m) return m[1];
  // Fallback: try "[Phase 71]" style as date-substitute. Treat as null date.
  return null;
}

function extractVerb(body) {
  const lower = body.toLowerCase().trim();
  for (const verb of CANON_VERBS) {
    // Verb appears at start, possibly after a date prefix that we already saw.
    // We accept verb followed by space, colon, or end-of-segment.
    if (lower.startsWith(verb + ' ') || lower.startsWith(verb + ':') || lower === verb) {
      return verb === "devils advocate" ? "Devil's Advocate" : capitalizeVerb(verb);
    }
  }
  return null;
}

function capitalizeVerb(v) {
  return v.split(' ')
    .map(w => w === "advocate" || w === "methodology" || w === "graph" || w === "plan" || w === "opportunity" || w === "agent" || w === "sub-agent"
      ? w.charAt(0).toUpperCase() + w.slice(1)
      : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function parseLine(rawBody) {
  // rawBody is the line body AFTER bullet/number marker stripping.
  const raw = rawBody.trim();
  if (!raw) return null;

  // Date
  const date = extractDate(raw);

  // Annotations
  const mhMatch = raw.match(METHODOLOGY_RE);
  const jtbdMatch = raw.match(JTBD_RE);
  const methodology_hook = mhMatch ? mhMatch[1] : undefined;
  const jtbd = jtbdMatch ? jtbdMatch[1] : undefined;

  // Strip annotations from summary
  let summary = raw
    .replace(METHODOLOGY_RE, '')
    .replace(JTBD_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Strip leading date from summary
  if (date) summary = summary.replace(ISO_DATE_RE, '').trim();

  // Strip leading "[Phase XX]:" prefix common in plugin STATE.md
  summary = summary.replace(/^\[[^\]]+\]:\s*/, '').trim();

  // Verb extraction (after stripping date + phase prefix)
  const verb = extractVerb(summary) || 'Free-Text';

  const out = { date, verb, summary, raw };
  if (methodology_hook) out.methodology_hook = methodology_hook;
  if (jtbd) out.jtbd = jtbd;
  return out;
}

function parseDecisions(stateMdText) {
  if (!stateMdText || typeof stateMdText !== 'string') return [];

  // Tolerant headers: "## Decisions" or "### Decisions" (case-sensitive on
  // word but allowing trailing whitespace).
  const headingRe = /^#{2,3}\s+Decisions\s*$/;
  const body = findSection(stateMdText, headingRe);

  const out = [];
  for (const line of body) {
    // Bullet / numbered
    const bulletMatch = line.match(BULLET_RE);
    if (bulletMatch) {
      const parsed = parseLine(bulletMatch[1]);
      if (parsed) out.push(parsed);
      continue;
    }
    // Table row -- skip header rows (contain only --- and |)
    const tableMatch = line.match(TABLE_ROW_RE);
    if (tableMatch) {
      const inner = tableMatch[1];
      // Skip header divider row like | --- | --- |
      if (/^\s*[-:|\s]+\s*$/.test(inner)) continue;
      // Take the LAST non-empty cell as summary, FIRST cell as potential date
      const cells = inner.split('|').map(c => c.trim()).filter(c => c !== '');
      if (cells.length === 0) continue;
      const joined = cells.join(' ');
      const parsed = parseLine(joined);
      if (parsed) out.push(parsed);
      continue;
    }
    // Plain prose lines: skip (not a decision row).
  }
  return out;
}

function recentDecisions(stateMdText, n) {
  const all = parseDecisions(stateMdText);
  const limit = (typeof n === 'number' && n > 0) ? n : 3;
  return all.slice(0, limit);
}

module.exports = {
  parseDecisions,
  recentDecisions,
};
