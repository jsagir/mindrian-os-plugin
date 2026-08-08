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
 * BRAIN_TOOL_MATCHER -- the single exported tool-name authority for the Brain
 * MCP door. Phase 239 (BRAIN-01): the two prior copies of this pattern (the
 * hooks/hooks.json matchers and this module's own isBrainTool prefix test)
 * drifted independently and both went dead the moment the Brain server
 * shipped inside a plugin instead of as a bare project-scoped server.
 *
 * Per the official Claude Code plugins reference, a plugin-bundled MCP
 * server's tool names take the shape
 *   mcp__plugin_<plugin-name>_<server-name>__<tool>
 * and "a matcher written against the bare server key never fires." This
 * repo's plugin name is "mos" (.claude-plugin/plugin.json) and its Brain
 * server key is "mindrian-brain" (.mcp.json), so the live plugin-scoped name
 * is mcp__plugin_mos_mindrian-brain__brain_*. The dead literal this replaces
 * was mcp__brain_* -- keep that string ONLY as the superseded example above,
 * never as a live pattern anywhere in this repo.
 *
 * Two scopes, not one (239-RESEARCH.md Pitfall 6): this repo's root
 * .mcp.json also doubles as a project-scoped .mcp.json when the repo itself
 * is opened in Claude Code, which yields mcp__mindrian-brain__* instead (no
 * plugin_<name>_ prefix). Desktop and Cowork resolve plugin scope; CLI in
 * this dev checkout may resolve project scope. This is a Tri-Polar concern,
 * not cosmetic, so the pattern below covers both with one optional
 * non-capturing group.
 *
 * hooks/hooks.json's two matchers (PreToolUse, PostToolUse) MUST equal this
 * exact string byte for byte; tests/test-brain-response-sanitize.cjs asserts
 * that parity so drift becomes a red test instead of a silent no-op.
 * See also scripts/check-brain-tool-liveness.cjs (Phase 239 plan 03), the
 * gate that proves this pattern actually matches the live registered names
 * via a real MCP tools/list handshake, not by inspection alone.
 */
const BRAIN_TOOL_MATCHER = 'mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*';

/**
 * _BRAIN_TOOL_RE -- anchored RegExp compiled once at module scope, derived
 * from BRAIN_TOOL_MATCHER. hooks/hooks.json intentionally carries the
 * UNANCHORED pattern, because that is exactly how Claude Code evaluates a
 * hook matcher (official hooks docs: matchers are "JavaScript regular
 * expression, unanchored", tested with RegExp.prototype.test, which
 * succeeds on a match anywhere in the value). isBrainTool anchors with
 * ^...$ because the tighter posture closes threat T3: an unanchored
 * in-code re-check would let a foreign MCP server whose name merely
 * CONTAINS "mindrian-brain" (e.g. a plugin-prefix trick) slip through the
 * defense-in-depth backstop even if the host matcher were somehow bypassed.
 * The plugin-prefix character class is deliberately bounded to
 * [a-z0-9_-]+, NOT .*, for the same T3 reason: an over-broad pattern such
 * as mcp__.*brain.* would let a third-party server named e.g. "evil-brain"
 * be treated as the trusted Brain.
 */
const _BRAIN_TOOL_RE = new RegExp('^' + BRAIN_TOOL_MATCHER + '$');

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
 * Phase 239 (BRAIN-01): anchored re-check derived from BRAIN_TOOL_MATCHER,
 * covering both the plugin-scoped live name
 * (mcp__plugin_mos_mindrian-brain__brain_*) and the project-scoped dev
 * checkout name (mcp__mindrian-brain__brain_*). The old mcp__brain_* prefix
 * test is the superseded dead literal this replaces; it never matched a
 * live registered name once the Brain server shipped inside the "mos"
 * plugin. See the BRAIN_TOOL_MATCHER docblock above for the full reasoning
 * (scope coverage, anchoring asymmetry, threat T3).
 *
 * @param {string} toolName    tool name string from PostToolUse stdin
 * @returns {boolean}          true iff the tool is a Brain MCP tool
 */
function isBrainTool(toolName) {
  return typeof toolName === 'string' && _BRAIN_TOOL_RE.test(toolName);
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
 * extractResponseText(toolResponse) -- the SINGLE shared text-reading seam for
 * a PostToolUse tool_response. Quick task 260807-h5s (defect A1).
 *
 * WHY THIS EXISTS. The original code in BOTH buildEnvelope and
 * scripts/brain-response-sanitize-hook.cjs read `tool_response.text` and
 * nothing else. A real MCP tool result does NOT carry a bare `.text`: it
 * carries an array of content blocks under `.content`. So every live Brain
 * call produced `undefined` there, the sanitizer ran over an empty string, and
 * the ENTIRE Brain response was silently blanked before it reached the model.
 * Both call sites route through THIS function so the identical defect cannot
 * re-diverge across the two files (Canon Part 7, reuse before build).
 *
 * Resolution order, first match wins:
 *   1. a string                  -> return it.
 *   2. .text is a string         -> return it (the legacy fixture shape, still
 *                                   honoured so every pre-existing fixture and
 *                                   any transport that really does send a bare
 *                                   .text keeps working).
 *   3. .content is an array      -> join the text values of every element whose
 *                                   type is the literal 'text', with newlines.
 *   4. the value IS an array     -> apply rule 3 to it directly.
 *   5. anything else             -> ''.
 *
 * Every branch is guarded so a malformed or hostile shape returns '' rather
 * than throwing: the hook's always-exit-0 contract is load-bearing (threat
 * T-h5s-05, a throw here would stall the agent loop).
 *
 * @param {*} toolResponse   the raw tool_response value off PostToolUse stdin
 * @returns {string}         recovered text, or '' when nothing is recoverable
 */
function extractResponseText(toolResponse) {
  try {
    if (typeof toolResponse === 'string') return toolResponse;
    if (toolResponse === null || typeof toolResponse !== 'object') return '';

    if (!Array.isArray(toolResponse) && typeof toolResponse.text === 'string') {
      return toolResponse.text;
    }

    const blocks = Array.isArray(toolResponse)
      ? toolResponse
      : (Array.isArray(toolResponse.content) ? toolResponse.content : null);
    if (!blocks) return '';

    const parts = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b === null || typeof b !== 'object') continue;
      if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text);
    }
    return parts.join('\n');
  } catch (_e) {
    return '';
  }
}

/**
 * buildEnvelope(toolName, originalToolResponse) -- produce the PostToolUse hook
 * envelope. Returns the JSON object to write to stdout.
 *
 * If isBrainTool returns false, returns a passthrough envelope (no
 * updatedToolOutput). Other tools' responses are not modified.
 *
 * ENVELOPE SHAPE (corrected by quick task 260807-h5s, defect A2/A3). The shape
 * documented here before was WRONG on both the input side and the output side,
 * and both halves shipped:
 *   {
 *     continue: true,
 *     hookSpecificOutput: {
 *       hookEventName: 'PostToolUse',
 *       updatedToolOutput: [ { type: 'text', text: '<sanitized response>' } ]
 *     }
 *   }
 * updatedToolOutput MUST be an ARRAY of content blocks, never a bare object.
 * The client-side length reducer walks this value with a reduce over content
 * blocks, so a bare object has no reduce method and the user sees the raw
 * "e.reduce is not a function" error instead of their Brain answer. The key
 * name stays `updatedToolOutput`: the Claude Code binary describes
 * `updatedMCPToolOutput` as MCP-only while telling callers to prefer
 * `updatedToolOutput`.
 *
 * The input side is read through extractResponseText, which understands MCP
 * content blocks; see that function's docblock for why the old `.text`-only
 * read blanked every live Brain response.
 *
 * @param {string} toolName               tool name from PostToolUse stdin
 * @param {*}      originalToolResponse   tool_response value (content blocks,
 *                                        a bare .text, a string, or an array)
 * @returns {object}                      envelope ready for JSON.stringify -> stdout
 */
function buildEnvelope(toolName, originalToolResponse) {
  if (!isBrainTool(toolName)) {
    return { continue: true };
  }
  const text = extractResponseText(originalToolResponse);
  const sanitized = sanitize(text);
  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      updatedToolOutput: [
        { type: 'text', text: sanitized },
      ],
    },
  };
}

module.exports = {
  sanitize,
  sanitizeDetailed,
  extractResponseText,
  buildEnvelope,
  isBrainTool,
  BRAIN_TOOL_MATCHER,
  PII_PATTERNS,
  ALLOWLIST,
};
