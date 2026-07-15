'use strict';
/*
 * Phase 169-04 (GDH-05 / D-169-06) -- lib/core/graph-candidate-producer.cjs
 * ========================================================================
 * produceCandidates({roomDir, artifactPair, llm}) -> [{source, target, edge_type, reason}]
 *
 * THE candidate-edge PRODUCER -- the LLM DERIVATION step, the missing FUEL the
 * four shipped derivers never generate. The plan-check REVISE verdict found the
 * engine had no fuel: the shipped derivers only WRITE pre-structured findings;
 * none GENERATE candidate edges from raw artifact text. This module READS the
 * artifact-pair text (routing .docx/.html through the LOCAL extractDocText) and
 * PROPOSES candidate {source, target, edge_type, reason} tuples drawn ONLY from
 * the frozen cascade subset of ALLOWED_EDGE_TYPES. It MUST be able to emit BOTH
 * a CONTRADICTS AND a CONVERGES candidate (D-169-06: not CONTRADICTS-only;
 * within-room CONVERGES is the LLM producer's job, LOW-6). Cross-room-detect is
 * EXCLUDED (cross-room typed edges stay deferred to Phase 83).
 *
 * Canon Part 8 (the load-bearing boundary): the producer reads LOCAL artifact
 * text and returns LOCAL tuples. It NEVER calls the Mindrian-owned Brain MCP.
 * The default (non-injected) `llm` transport is the SHIPPED Part-8-legal LOCAL
 * LLM pattern that lib/core/llm-name-suggester.cjs establishes: a direct fetch
 * to api.anthropic.com/v1/messages (the standard plugin LLM transport) with the
 * x-api-key header + anthropic-version + AbortController timeout. The posture is
 * LOCAL artifact text in, anthropic-transport out, NEVER the Brain. The two are
 * distinct: api.anthropic.com is a stateless LLM transport; the Brain is the
 * Mindrian-owned methodology repository that must never receive user data. The
 * Plan 06 boundary scan asserts zero artifact-body tokens reach a Brain query in
 * this file.
 *
 * `llm` is INJECTABLE: tests pass a deterministic stub so no live model is
 * touched. The stub (and the default transport) take the built prompt string and
 * return the model's reply text (a JSON array of candidate tuples).
 *
 * Part 4: every emitted edge_type is filtered against the frozen cascade subset;
 * anything else is dropped. Edge properties downstream stay enum/scalar only.
 *
 * Em-dash discipline: hyphens only (CLAUDE.md HARD RULE). CJS only. No new deps.
 */

const path = require('node:path');

// The frozen cascade SUBSET of ALLOWED_EDGE_TYPES the producer may draw from.
// This is the cascade family ONLY (the decision-and-cascade edges that a
// cross-relationship scan produces), NOT the full frozen vocabulary: a producer
// must never emit a structural / lineage edge (BELONGS_TO / NESTED_WITHIN /
// PART_OF) from artifact text. Mirrors the test's CASCADE_SUBSET.
const CASCADE_SUBSET = Object.freeze(new Set([
  'CONTRADICTS', 'CONVERGES', 'INFORMS', 'INVALIDATES', 'ENABLES', 'REFINES', 'ROOT_CAUSES',
]));

// Default LLM transport. Mirrors lib/core/llm-name-suggester.cjs
// _resolveProductionLlmClient verbatim: a direct fetch to api.anthropic.com (the
// LOCAL Anthropic transport, Part-8-legal), NOT the Brain. Returns the model's
// reply TEXT given a prompt string so the call site stays llm(prompt) -> string.
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DERIVE_MODEL_ID = 'claude-haiku-4-5';
const LLM_TIMEOUT_MS = 8000;
const MAX_DERIVE_TOKENS = 1024;

function _resolveDefaultLlm() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.length === 0) {
    throw new Error('anthropic_api_key_missing');
  }
  if (typeof fetch !== 'function') {
    throw new Error('global_fetch_unavailable');
  }
  // The injectable seam is a function (prompt) -> reply-text. The default wraps
  // the anthropic fetch and returns the concatenated text blocks. It is async;
  // produceCandidates awaits the llm return when it is a Promise.
  return async function defaultLlm(prompt) {
    const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    const timer = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (_e) {} }, LLM_TIMEOUT_MS) : null;
    try {
      const res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: DERIVE_MODEL_ID,
          max_tokens: MAX_DERIVE_TOKENS,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (!res || !res.ok) {
        throw new Error('anthropic_http_' + (res ? res.status : 'no_response'));
      }
      const j = await res.json();
      let text = '';
      if (j && Array.isArray(j.content)) {
        for (const blk of j.content) {
          if (blk && blk.type === 'text' && typeof blk.text === 'string') text += blk.text;
        }
      }
      return text;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}

// Resolve the text of one artifact in the pair. The pair carries inline `text`
// (the common case the tests + the loop use); when only a `path` is given, the
// text is read LOCALLY (.docx/.html via extractDocText, anything else via a
// plain read). Always LOCAL; never the Brain.
function _resolveArtifactText(artifact) {
  if (!artifact || typeof artifact !== 'object') return '';
  if (typeof artifact.text === 'string') return artifact.text;
  const p = (typeof artifact.path === 'string' && artifact.path.length > 0) ? artifact.path : '';
  if (!p) return '';
  const ext = path.extname(p).toLowerCase();
  if (ext === '.docx' || ext === '.html' || ext === '.htm') {
    try {
      const { extractDocText } = require('./doc-text-extractor.cjs');
      return extractDocText(p) || '';
    } catch (_e) {
      return '';
    }
  }
  try {
    return require('node:fs').readFileSync(p, 'utf-8');
  } catch (_e) {
    return '';
  }
}

// Build the LOCAL derivation prompt: ask the model to identify typed
// relationships between the two artifacts drawn ONLY from the frozen cascade
// subset, returning a JSON array. Pure LOCAL text in; nothing leaves this file.
function _buildDerivationPrompt(aId, aText, bId, bText) {
  const subset = Array.from(CASCADE_SUBSET).join(', ');
  return [
    'You are a graph-derivation step in a wicked-problem workspace. You are given',
    'the text of TWO local artifacts. Identify the typed relationships between',
    'them. Use ONLY these edge types: ' + subset + '.',
    'You MAY emit more than one relationship (for example a CONTRADICTS and a',
    'CONVERGES). Return ONLY a JSON array of objects, each with exactly the keys',
    '{ "source", "target", "edge_type", "reason" }. No prose, no markdown fence.',
    '',
    'Artifact A id: ' + aId,
    'Artifact A text: ' + aText,
    '',
    'Artifact B id: ' + bId,
    'Artifact B text: ' + bText,
    '',
    'JSON array:',
  ].join('\n');
}

// Parse the model reply into an array of candidate tuples. Tolerant: accepts a
// raw JSON array, or a JSON array embedded in surrounding text (strips the first
// [ ... ] block). Returns [] on any parse fault (the producer never throws).
function _parseCandidates(reply) {
  if (Array.isArray(reply)) return reply;
  if (typeof reply !== 'string' || reply.length === 0) return [];
  // Try a direct parse first; fall back to the first bracketed array.
  let parsed = null;
  try {
    parsed = JSON.parse(reply);
  } catch (_e) {
    const start = reply.indexOf('[');
    const end = reply.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
      try { parsed = JSON.parse(reply.slice(start, end + 1)); } catch (_e2) { parsed = null; }
    }
  }
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * produceCandidates({roomDir, artifactPair, llm}) -> [{source, target, edge_type, reason}]
 *
 * Gather the LOCAL text of each artifact in the pair, build a LOCAL derivation
 * prompt, drive the injectable `llm` (default: the anthropic-transport, NEVER
 * the Brain), parse the structured reply into candidate tuples, drop any whose
 * edge_type is not in the frozen cascade subset, and return the survivors. The
 * function can return BOTH a CONTRADICTS AND a CONVERGES tuple (D-169-06).
 *
 * Synchronous-friendly: when the injected llm returns a string synchronously
 * (the deterministic test stub), the result is returned synchronously. When the
 * llm returns a Promise (the default async anthropic transport), the result is a
 * Promise. NOTE: the runDerivation composer is SYNCHRONOUS and does NOT await a
 * Promise return -- it rejects one loudly. A Promise-returning produceCandidates
 * must be pre-resolved (per pair) before being fed to runDerivation via a
 * synchronous deriveFn wrapper (the drain/backfill pattern).
 */
function produceCandidates(args) {
  const opts = (args && typeof args === 'object') ? args : {};
  const artifactPair = (opts.artifactPair && typeof opts.artifactPair === 'object') ? opts.artifactPair : {};
  const llm = (typeof opts.llm === 'function') ? opts.llm : _resolveDefaultLlm();

  const a = artifactPair.a || {};
  const b = artifactPair.b || {};
  const aId = (typeof a.id === 'string') ? a.id : 'artifact:a';
  const bId = (typeof b.id === 'string') ? b.id : 'artifact:b';
  const aText = _resolveArtifactText(a);
  const bText = _resolveArtifactText(b);

  const prompt = _buildDerivationPrompt(aId, aText, bId, bText);
  const reply = llm(prompt);

  // The injected stub returns a string synchronously; the default transport
  // returns a Promise. Handle both without forking the caller contract.
  if (reply && typeof reply.then === 'function') {
    return reply.then(function (resolved) { return _finalize(resolved); });
  }
  return _finalize(reply);
}

// Parse + frozen-subset filter + shape-guard. Shared by the sync + async paths.
function _finalize(reply) {
  const raw = _parseCandidates(reply);
  const out = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue;
    const edge_type = (typeof c.edge_type === 'string') ? c.edge_type : '';
    if (!CASCADE_SUBSET.has(edge_type)) continue; // Part 4: frozen subset only.
    const source = (typeof c.source === 'string') ? c.source : '';
    const target = (typeof c.target === 'string') ? c.target : '';
    const reason = (typeof c.reason === 'string') ? c.reason : '';
    if (!source || !target) continue;
    out.push({ source, target, edge_type, reason });
  }
  return out;
}

module.exports = {
  produceCandidates,
  CASCADE_SUBSET,
};
