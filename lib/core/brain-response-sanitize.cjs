/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 117-04 -- Brain response sanitizer (SEED-003 A3 implementation).
 *
 * Per SEED-003 A3 spec: PostToolUse hook on Brain MCP tool calls uses
 * hookSpecificOutput.updatedToolOutput to scan + redact accidental
 * user-data echo before the response reaches the model. This is the
 * structural enforcement of Canon Part 8 the canon has been describing
 * as "PR review" (check-brain-boundary.cjs PR gate, listed as "pending"
 * in CANON-PHASE-MAP.md Part 8 row).
 *
 * Phase 90 shipped 5 Canon Part 8 tripwires (schema-leak heuristic scan,
 * deriveSection chokepoint, brain-md-invariants body-text scan,
 * sanitizeDetailScalar in cross-room aggregator, cross-scenario sweep).
 * This module adds the 6th tripwire: response-side scan.
 *
 * v1 ships PII pattern redaction ONLY. Conservative non-allowlist
 * redaction (8+ consecutive non-allowlist tokens) stays DISABLED until
 * Phase 121 telemetry calibrates false-positive rate. Risk T4 mitigated
 * by starting permissive; tighten after empirical observation.
 *
 * Pure CJS, node built-ins only.
 */
'use strict';

const crypto = require('node:crypto');

/**
 * PII_PATTERNS -- regex catalogue per RESEARCH Section 4.6.
 * Each pattern carries a name for telemetry attribution (Phase 121).
 *
 * Patterns (6 total):
 *   ssn       -- US SSN format XXX-XX-XXXX
 *   email     -- RFC 5322 simplified
 *   phone     -- US phone XXX-XXX-XXXX or XXX.XXX.XXXX
 *   money     -- $X, $X.XX, $XM/K/B suffix
 *   iso_date  -- YYYY-MM-DD
 *   abs_path  -- POSIX absolute paths under /home/X or /Users/X
 */
const PII_PATTERNS = Object.freeze([
  { name: 'ssn',      regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { name: 'email',    regex: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { name: 'phone',    regex: /\b\d{3}[-.]\d{3}[-.]\d{4}\b/g },
  { name: 'money',    regex: /\$\d+(?:\.\d+)?[MmKkBb]?\b/g },
  { name: 'iso_date', regex: /\b\d{4}-\d{2}-\d{2}\b/g },
  { name: 'abs_path', regex: /\/(?:home|Users)\/[\w-]+\/[\w/.-]+/g },
]);

/**
 * ALLOWLIST -- framework names + section names + methodology verbs + enum scalars.
 * v1 list seeds from RESEARCH Section 4.6 + references/methodology/index.md.
 * Tightened over time as Phase 121 telemetry calibrates.
 *
 * v1 redaction is pattern-only (PII_PATTERNS). The ALLOWLIST is exported
 * for downstream consumers (e.g. Phase 121 telemetry attribution) and is
 * NOT consulted by sanitize() in v1. When Phase 121 calibrates a non-
 * allowlist redaction mode, ALLOWLIST membership becomes the carve-out.
 */
const ALLOWLIST = Object.freeze(new Set([
  // Framework names (from references/methodology/index.md):
  'JTBD', 'MECE', 'Six Thinking Hats', 'Beautiful Questions', 'BONO', 'PAEI',
  'SWOT', 'Porter Five Forces', 'Reverse Salients', 'Hooked Model',
  'Cynefin', 'OODA', 'BMC', 'STP',
  // Section names:
  'problem-definition', 'market-analysis', 'solution-design', 'business-model',
  'competitive-analysis', 'team-execution', 'legal-ip', 'financial-model',
  'team', 'meetings',
  // Methodology verbs:
  'decomposition', 'hypothesis', 'cascade', 'whitespace', 'analogy',
  'contradiction', 'convergence', 'reverse salient', 'cross-domain',
  // Enum scalars:
  'Tier 0', 'Tier 1', 'Tier 2', 'Mode A', 'Mode B', 'Mode C',
]));

/**
 * isBrainTool(toolName) -- matcher for PostToolUse hook scope.
 * Per SEED-003 A3: scope is mcp__brain_* tool calls.
 *
 * @param {string} toolName    tool name string from PostToolUse stdin
 * @returns {boolean}          true iff the tool is a Brain MCP tool
 */
function isBrainTool(toolName) {
  return typeof toolName === 'string' && toolName.indexOf('mcp__brain_') === 0;
}

/**
 * sanitize(text) -- apply PII pattern redaction with deterministic sha256
 * placeholder. ALLOWLIST entries pass through unchanged in v1 because the
 * v1 redaction engine is pattern-only (regex matches). The ALLOWLIST is
 * for the Phase 121 calibration path.
 *
 * v1 ships PII patterns only. Generic-token redaction (8+ consecutive
 * non-allowlist tokens) is DISABLED until Phase 121 telemetry calibrates.
 *
 * Determinism: same input always produces the same redacted output.
 * The placeholder format is `[REDACTED:<8-hex>]` where the hex is the
 * first 8 chars of sha256(matched-substring).
 *
 * @param {string} text        input text (any type; coerced to string)
 * @returns {string}           sanitized text
 */
function sanitize(text) {
  const input = String(text == null ? '' : text);
  if (input.length === 0) return input;
  let result = input;
  for (const pat of PII_PATTERNS) {
    result = result.replace(pat.regex, function(match) {
      const hash = crypto.createHash('sha256').update(match).digest('hex').slice(0, 8);
      return '[REDACTED:' + hash + ']';
    });
  }
  return result;
}

/**
 * sanitizeDetailed(text) -- Phase 117-05 extension. Returns BOTH sanitized
 * text AND a per-pattern redaction count map so the PostToolUse hook can
 * emit one auto_explore_sanitizer_hit telemetry event per matched pattern.
 *
 * Backward-compatible: sanitize() still returns the sanitized string only.
 * This variant is for telemetry callers (brain-response-sanitize-hook.cjs).
 *
 * @param {string} text   input text
 * @returns {{text: string, redactions: object}}  redactions keyed by pattern name
 */
function sanitizeDetailed(text) {
  const input = String(text == null ? '' : text);
  const redactions = { ssn: 0, email: 0, phone: 0, money: 0, iso_date: 0, abs_path: 0 };
  if (input.length === 0) return { text: input, redactions: redactions };
  let result = input;
  for (const pat of PII_PATTERNS) {
    result = result.replace(pat.regex, function(match) {
      redactions[pat.name] = (redactions[pat.name] || 0) + 1;
      const hash = crypto.createHash('sha256').update(match).digest('hex').slice(0, 8);
      return '[REDACTED:' + hash + ']';
    });
  }
  return { text: result, redactions: redactions };
}

/**
 * buildEnvelope(toolName, originalToolResponse) -- produce PostToolUse hook
 * envelope per SEED-003 A3 spec. Returns the JSON object to write to stdout.
 *
 * If isBrainTool returns false, returns a passthrough envelope (no
 * updatedToolOutput). Other tools' responses are not modified.
 *
 * Per SEED-003 A3 envelope shape:
 *   {
 *     continue: true,
 *     hookSpecificOutput: {
 *       hookEventName: 'PostToolUse',
 *       updatedToolOutput: { text: '<sanitized response>' }
 *     }
 *   }
 *
 * @param {string} toolName               tool name from PostToolUse stdin
 * @param {object} originalToolResponse   tool_response object (expects .text)
 * @returns {object}                      envelope ready for JSON.stringify -> stdout
 */
function buildEnvelope(toolName, originalToolResponse) {
  if (!isBrainTool(toolName)) {
    return { continue: true };
  }
  const text = (originalToolResponse && typeof originalToolResponse.text === 'string')
    ? originalToolResponse.text
    : '';
  const sanitized = sanitize(text);
  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      updatedToolOutput: {
        text: sanitized,
      },
    },
  };
}

module.exports = {
  sanitize,
  sanitizeDetailed,
  buildEnvelope,
  isBrainTool,
  PII_PATTERNS,
  ALLOWLIST,
};
