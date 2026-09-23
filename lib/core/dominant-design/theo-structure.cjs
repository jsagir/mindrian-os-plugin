'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 361 Plan 05 Task 1 -- theo-structure: reads the Dominant Design
 * framework's phase structure from Theo when Theo genuinely has it, and
 * degrades to the local reference file otherwise, always naming the source
 * and the reason. layer: graph
 *
 * PART 8 LINE: the only value that ever crosses to Theo is the constant
 * HANDLE ('Dominant Design'), built fresh as a literal {framework: HANDLE}
 * inside this file, every call, every time. The navigator's domain text,
 * a venture name, or any other room content NEVER reaches this module's
 * args objects -- a caller may pass whatever it likes on `opts` and none of
 * it is echoed into a Theo call (T-361-20).
 *
 * D-09: Theo becomes the structure source only when framework_step returns
 * at least one runnable step. Every other outcome (unreachable, egress
 * blocked, not served, shape refused, refused, threw, or served with zero
 * steps) degrades to the six phases parsed from
 * references/methodology/dominant-designs.md, and the result names why
 * (T-361-21). Ship does not wait on Theo's own deploy.
 *
 * D-10: only the generic handle ever crosses the wire, never a caller's
 * domain, venture name, or room content.
 *
 * D-15: case_story's input shape is assumed to be exactly {framework} until
 * Theo 20.1 publishes its real contract; a wrong guess only makes the call
 * ambiguous (disclose-and-proceed), never unsafe.
 *
 * D-16: today (2026-09-23) framework_step is served and answers Dominant
 * Design with zero steps; framework_techniques and case_story are not
 * served. "Not served" is detected by the literal text "Tool X not found",
 * NEVER by the -32602 JSON-RPC code alone -- a shape refusal (wrong input
 * keys) also carries -32602 and must not be misread as "tool absent"
 * (T-361-22). This module intentionally does NOT reuse brain-client.cjs's
 * own unknown-tool-error sniffer (brain-client.cjs, near line 2470), which
 * treats every -32602 as unknown-tool; reusing it here would misclassify a
 * shape refusal as not-served.
 *
 * ONE WIRE DOOR: brainClient.callTool, required LAZILY inside
 * readDominantDesignStructure so requiring this module opens nothing and
 * makes no network call (mirrors lib/core/strategy/taxonomy-climb.cjs). A
 * caller may inject its own opts.brainClient (every test in this phase
 * does); this module never imports brain-client.cjs at the top of the file.
 *
 * Only whitelisted scalar fields survive from Theo's steps, techniques and
 * cases (T-361-23) -- an oversized or odd payload never rides through
 * unfiltered.
 *
 * Pure CJS. No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('fs');
const path = require('path');

// The only value ever sent to Theo. Never the navigator's domain, a venture
// name, or any other room content (D-10).
const HANDLE = 'Dominant Design';

// The three Theo tools this module reads, in call order (D-09).
const TOOLS = Object.freeze(['framework_step', 'framework_techniques', 'case_story']);

const DEFAULT_REFERENCE_PATH = path.join(__dirname, '..', '..', '..', 'references', 'methodology', 'dominant-designs.md');

const NOT_FOUND_RE = /\btool\s+\S+\s+not\s+found\b/i;
const SHAPE_REFUSED_RE = /-32602/;
const PHASE_HEADING_RE = /^### Phase (\d+):\s*([^(\n]+?)\s*(\(|$)/;

/**
 * _extractText(result) -> a best-effort text signal for the not_served /
 * shape_refused regex checks. Never throws.
 * @param {*} result
 * @returns {string}
 */
function _extractText(result) {
  if (result === null || result === undefined) return '';
  if (typeof result === 'string') return result;
  if (Array.isArray(result)) {
    if (result[0] && typeof result[0].text === 'string') return result[0].text;
    try {
      return JSON.stringify(result);
    } catch (_e) {
      return '';
    }
  }
  if (typeof result === 'object') {
    if (typeof result.text === 'string') return result.text;
    if (Array.isArray(result.content) && result.content[0] && typeof result.content[0].text === 'string') {
      return result.content[0].text;
    }
    try {
      return JSON.stringify(result);
    } catch (_e) {
      return '';
    }
  }
  return String(result);
}

/**
 * classifyCallResult(toolName, result) -> one of the reason strings, or
 * 'served'. Never throws. Classification order (D-16, T-361-22):
 *   null                                     -> brain_unavailable
 *   {error: 'egress_blocked'}                -> egress_blocked
 *   text matches "Tool X not found"          -> not_served
 *   text matches -32602 (anything else)      -> shape_refused
 *   a `refusals` key or another error string -> refused
 *   framework_step with no runnable steps    -> no_steps_in_canon
 *   else                                     -> served
 *
 * @param {string} toolName
 * @param {*} result
 * @returns {string}
 */
function classifyCallResult(toolName, result) {
  if (result === null || result === undefined) return 'brain_unavailable';
  if (typeof result === 'object' && !Array.isArray(result) && result.error === 'egress_blocked') {
    return 'egress_blocked';
  }

  const text = _extractText(result);
  if (NOT_FOUND_RE.test(text)) return 'not_served';
  if (SHAPE_REFUSED_RE.test(text)) return 'shape_refused';

  if (result && typeof result === 'object') {
    if (Object.prototype.hasOwnProperty.call(result, 'refusals')) return 'refused';
    if (typeof result.error === 'string') return 'refused';
  }

  if (toolName === 'framework_step') {
    const rows = result && result.rows;
    const firstSteps = Array.isArray(rows) && rows[0] && Array.isArray(rows[0].steps) ? rows[0].steps : null;
    if (!firstSteps || firstSteps.length === 0) return 'no_steps_in_canon';
  }

  return 'served';
}

/**
 * parseReferencePhases(text) -> [{id, name}] parsed from `### Phase N: Name
 * (...)` headings, one per line, in file order. Never throws; text with no
 * matching heading (or empty/non-string text) returns [].
 *
 * @param {string} text
 * @returns {Array<{id: string, name: string}>}
 */
function parseReferencePhases(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = PHASE_HEADING_RE.exec(lines[i]);
    if (m) {
      out.push({ id: 'phase-' + m[1], name: m[2].trim() });
    }
  }
  return out;
}

/** Whitelist-map a Theo step row to {id, name}; name falls back to title (T-361-23). */
function _pickStep(row) {
  const r = row || {};
  const name = (typeof r.name === 'string' && r.name) || (typeof r.title === 'string' && r.title) || '';
  return { id: typeof r.id === 'string' ? r.id : '', name: name };
}

/** Whitelist-map a Theo technique row to {name, description} only (T-361-23). */
function _pickTechnique(row) {
  const r = row || {};
  const out = {};
  if (typeof r.name === 'string') out.name = r.name;
  if (typeof r.description === 'string') out.description = r.description;
  return out;
}

/** Whitelist-map a Theo case row/object to {title, summary, outcome} only (T-361-23). */
function _pickCase(row) {
  const r = row || {};
  const out = {};
  if (typeof r.title === 'string') out.title = r.title;
  if (typeof r.summary === 'string') out.summary = r.summary;
  if (typeof r.outcome === 'string') out.outcome = r.outcome;
  return out;
}

/** case_story's served shape is unknown (A1, D-15); accept either a `rows[0]` list shape or a flat object. */
function _caseSource(result) {
  if (result && Array.isArray(result.rows) && result.rows[0]) return result.rows[0];
  return result;
}

/**
 * readDominantDesignStructure(opts) -> the Dominant Design phase structure,
 * from Theo when genuinely served, otherwise the local reference. Never
 * throws, makes no network call beyond the injected/lazy brainClient's own
 * callTool.
 *
 * opts:
 *   - brainClient: injected client exposing an async callTool(name, args);
 *     when absent, lazily requires ../brain-client.cjs (so requiring THIS
 *     module alone opens nothing).
 *   - referencePath: override for the reference markdown file (default:
 *     references/methodology/dominant-designs.md resolved from __dirname).
 *   - anything else on opts is IGNORED and never forwarded to Theo (D-10).
 *
 * @param {object} [opts]
 * @returns {Promise<{source: 'theo'|'reference', reason: string|null, reasons: object, steps: Array, techniques: Array, cases: Array, calls: Array}>}
 */
async function readDominantDesignStructure(opts) {
  const o = opts || {};
  const brainClient = o.brainClient || require('../brain-client.cjs');
  const referencePath = typeof o.referencePath === 'string' ? o.referencePath : DEFAULT_REFERENCE_PATH;

  const reasons = {};
  const calls = [];
  let stepRows = null;
  let techniqueRows = null;
  let caseRow = null;

  for (const tool of TOOLS) {
    const args = { framework: HANDLE };
    let result;
    let outcome;
    try {
      result = await brainClient.callTool(tool, args);
      outcome = classifyCallResult(tool, result);
    } catch (_e) {
      result = undefined;
      outcome = 'call_threw';
    }

    reasons[tool] = outcome === 'served' ? null : outcome;
    calls.push({
      tool: tool,
      args: args,
      outcome: outcome,
      egress_disclosure: !!(result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'egress_disclosure')),
    });

    if (outcome === 'served') {
      if (tool === 'framework_step') {
        stepRows = result.rows[0].steps;
      } else if (tool === 'framework_techniques') {
        techniqueRows = Array.isArray(result.rows) ? result.rows : [];
      } else if (tool === 'case_story') {
        caseRow = _caseSource(result);
      }
    }
  }

  const techniques = techniqueRows ? techniqueRows.map(_pickTechnique) : [];
  const cases = caseRow ? [_pickCase(caseRow)] : [];

  if (stepRows) {
    // Theo is the source: framework_step returned at least one runnable step (D-09).
    return {
      source: 'theo',
      reason: null,
      reasons: reasons,
      steps: stepRows.map(_pickStep),
      techniques: techniques,
      cases: cases,
      calls: calls,
    };
  }

  // Degrade to the reference (D-09). Name the framework_step reason.
  let referenceReason = reasons.framework_step;
  let referencePhases = [];
  try {
    const text = fs.readFileSync(referencePath, 'utf8');
    referencePhases = parseReferencePhases(text);
  } catch (_e) {
    referenceReason = referenceReason + '+reference_unreadable';
  }

  return {
    source: 'reference',
    reason: referenceReason,
    reasons: reasons,
    steps: referencePhases,
    techniques: techniques,
    cases: cases,
    calls: calls,
  };
}

module.exports = {
  HANDLE: HANDLE,
  TOOLS: TOOLS,
  classifyCallResult: classifyCallResult,
  parseReferencePhases: parseReferencePhases,
  readDominantDesignStructure: readDominantDesignStructure,
};
