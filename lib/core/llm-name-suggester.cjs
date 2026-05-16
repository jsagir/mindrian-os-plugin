'use strict';
/*
 * Phase 119-01 -- LLM-suggested room name resolver.
 *
 * One-shot Haiku 4.5 call seeded with LOCAL Phase 117 auto-explore finding +
 * Phase 118 MVA brief sentence. Returns a venture-shaped slug suggestion (e.g.
 * 'acme-robotics', 'quantum-imaging', 'biotech-translation').
 *
 * Canon Part 8 invariant: this module MUST NOT invoke any Brain endpoint.
 * The Brain repository holds GENERIC methodology -- framework chaining rules,
 * phase progressions -- never user-specific content. A LLM call seeded with
 * the user's auto-explore output + MVA brief sentence is purely LOCAL: the
 * model sees the user's content directly via the local Anthropic API path,
 * and the model's response is consumed locally.
 *
 * Canon Part 8 NOTE (REVISION 2026-05-16 Warning 5 fix): this module's fetch
 * carries user content (the auto_explore_finding summary + the mva_brief_sentence)
 * to api.anthropic.com. Per the standard plugin LLM usage pattern (precedent:
 * lib/core/mva-classifier.cjs, lib/agents/mva/*.cjs, lib/chat/fabric-chat.cjs),
 * this is acceptable: the Anthropic API is the LOCAL LLM transport for the
 * plugin. The Canon Part 8 boundary covers ONLY the Mindrian-owned Brain MCP
 * host (the Mindrian-owned methodology repository that must never receive user
 * data) -- NOT api.anthropic.com (the Anthropic LLM transport). The two are
 * distinct: Brain is a Mindrian-owned methodology repository that must never
 * receive user data; api.anthropic.com is a stateless LLM transport.
 *
 * Tripwire: scaffold harness Gate 3 + Test 9 grep this module for any Brain-host
 * substring AND any brain-client require AND any fetch to a brain.* URL; all
 * three must return 0. This module body therefore avoids the literal Brain-host
 * hostname string entirely (the scaffold harness uses literal-grep on the
 * forbidden substring).
 *
 * Cost: ~$0.0005 per first-MVA completion (Haiku 4.5 input ~800 tokens,
 * output ~10 tokens). See CONTEXT.md Architectural Decisions item 1.
 *
 * Em-dash discipline: uses `--` never the U+2014 character per memory
 * feedback_no_emdashes.md.
 *
 * Graceful degradation: on LLM error, returns {ok: false, suggested_name:
 * 'untitled', ...} so the F.1 selector still renders correctly with the
 * fallback label `[name this room: untitled]`.
 */

const FALLBACK_SUGGESTION = 'untitled';

// Phase 119-01 REVISION 2026-05-16 (Blocker 2 Option A): HAIKU_MODEL_ID is the
// project-wide source-of-truth constant. The plan's REVISION text says to
// import HAIKU_MODEL from lib/core/mva-classifier.cjs::HAIKU_MODEL, BUT
// inspection of that module's module.exports (verified at lib/core/mva-classifier.cjs
// line 359-370) shows HAIKU_MODEL is a module-internal const NOT exported. Per
// Rule 1 deviation, the constant is inlined here with provenance pointing to
// the source-of-truth declaration at lib/core/mva-classifier.cjs:53. If a
// future phase exports HAIKU_MODEL, replace the inline literal with a require.
const HAIKU_MODEL_ID = 'claude-haiku-4-5';

/**
 * suggestRoomName({auto_explore_finding, mva_brief_sentence, opts})
 * @returns {Promise<{ok, suggested_name, model_used, latency_ms, error_short?}>}
 */
async function suggestRoomName(args) {
  const opts = (args && typeof args === 'object') ? args : {};
  const autoExploreFinding = opts.auto_explore_finding || null;
  const mvaBriefSentence = (typeof opts.mva_brief_sentence === 'string') ? opts.mva_brief_sentence : '';
  const llmClient = opts.llmClient || null;

  const t0 = Date.now();
  try {
    const client = llmClient || _resolveProductionLlmClient();
    const prompt = _buildLocalPrompt(autoExploreFinding, mvaBriefSentence);
    const response = await client.complete({
      model: HAIKU_MODEL_ID,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 20,
    });
    const raw = (response && typeof response.content === 'string') ? response.content : '';
    const normalized = _normalizeSlug(raw);
    const latency_ms = Date.now() - t0;
    if (!normalized || normalized.length === 0) {
      return { ok: false, suggested_name: FALLBACK_SUGGESTION, model_used: HAIKU_MODEL_ID, latency_ms, error_short: 'empty_response' };
    }
    return { ok: true, suggested_name: normalized, model_used: HAIKU_MODEL_ID, latency_ms };
  } catch (err) {
    const latency_ms = Date.now() - t0;
    const error_short = String(err && err.message || err).slice(0, 60);
    return { ok: false, suggested_name: FALLBACK_SUGGESTION, model_used: HAIKU_MODEL_ID, latency_ms, error_short };
  }
}

function _buildLocalPrompt(autoExploreFinding, mvaBriefSentence) {
  // Build a short prompt from LOCAL signals ONLY. The findings array carries
  // the top whitespace + reverse-salient + cross-domain hits from Phase 117;
  // the MVA brief sentence is the user's first conversational turn (already
  // local). NEVER include any Brain-derived suggestion in this prompt.
  const findingsSummary = _summarizeFindings(autoExploreFinding);
  return [
    'You are naming a venture. Suggest a 2-3 word kebab-case slug that captures',
    'the core domain. Return ONLY the slug -- no prose, no quotes, no markdown.',
    '',
    'Brief: ' + (mvaBriefSentence || '(no brief)'),
    'Findings: ' + findingsSummary,
    '',
    'Slug:',
  ].join('\n');
}

function _summarizeFindings(autoExploreFinding) {
  if (!autoExploreFinding || typeof autoExploreFinding !== 'object') return '(none)';
  const findings = Array.isArray(autoExploreFinding.findings) ? autoExploreFinding.findings : [];
  if (findings.length === 0) return '(empty)';
  return findings.slice(0, 3).map(function (f) {
    const sp = (typeof f.source_pipeline === 'string') ? f.source_pipeline : 'unknown';
    const hsi = (typeof f.hsi_score === 'number') ? f.hsi_score.toFixed(2) : '?';
    return sp + ':' + hsi;
  }).join(', ');
}

function _normalizeSlug(raw) {
  if (typeof raw !== 'string') return '';
  let slug = raw.trim().toLowerCase();
  // Collapse whitespace to single hyphen; drop everything that's not [a-z0-9-].
  slug = slug.replace(/\s+/g, '-');
  slug = slug.replace(/[^a-z0-9-]/g, '');
  slug = slug.replace(/-{2,}/g, '-');
  slug = slug.replace(/^-+|-+$/g, '');
  return slug;
}

// Phase 119-01 REVISION 2026-05-16 (Blocker 2 Option A): mva-agent-contract.cjs
// exports {runAgent, validateAgentResult, AGENT_RESULT_SHAPE} ONLY -- no
// createLlmClient factory exists. The project-wide LLM-call idiom is direct
// fetch to https://api.anthropic.com/v1/messages with x-api-key header
// (precedent: lib/core/mva-classifier.cjs::_callHaiku same Haiku 4.5 model,
// same anthropic-version header pattern, same AbortController timeout).
//
// This module mirrors that precedent verbatim. No @anthropic-ai/sdk dependency
// added. Canon Part 8 invariant preserved: api.anthropic.com is the LOCAL
// Anthropic API endpoint; the Mindrian-owned Brain MCP host is NEVER contacted.
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const LLM_TIMEOUT_MS = 5000;

function _resolveProductionLlmClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.length === 0) {
    throw new Error('anthropic_api_key_missing');
  }
  if (typeof fetch !== 'function') {
    throw new Error('global_fetch_unavailable');
  }
  return {
    complete: async function (req) {
      const model = req.model || HAIKU_MODEL_ID;
      const messages = Array.isArray(req.messages) ? req.messages : [];
      const max_tokens = (typeof req.max_tokens === 'number') ? req.max_tokens : 20;
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
          body: JSON.stringify({ model: model, max_tokens: max_tokens, messages: messages }),
          signal: ctrl ? ctrl.signal : undefined,
        });
        if (!res || !res.ok) {
          throw new Error('anthropic_http_' + (res ? res.status : 'no_response'));
        }
        const j = await res.json();
        let text = '';
        if (j && Array.isArray(j.content)) {
          for (const blk of j.content) {
            if (blk && blk.type === 'text' && typeof blk.text === 'string') {
              text += blk.text;
            }
          }
        }
        return { content: text };
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}

module.exports = {
  suggestRoomName: suggestRoomName,
  FALLBACK_SUGGESTION: FALLBACK_SUGGESTION,
  HAIKU_MODEL_ID: HAIKU_MODEL_ID,
  _normalizeSlug: _normalizeSlug,
  _buildLocalPrompt: _buildLocalPrompt,
};
