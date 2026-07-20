'use strict';
/**
 * MindrianOS Plugin -- Larry's Briefing generator (D-06, SPEC Req 4).
 *
 * On-demand "Larry's read of the room": critical misses, a reframe, and next
 * steps, generated over the SAME in-repo raw-fetch Anthropic transport the
 * mva-classifier uses (resolveAnthropicKey + a bare fetch POST to
 * /v1/messages). The Vercel AI SDK / gateway-key transport was EXPLICITLY
 * rejected in CONTEXT D-06 and appears nowhere here.
 *
 * Export:
 *   - generateBriefing(roomDir, opts) -> Promise<
 *       { ok:true, briefing:{ critical_misses:string[], reframe:string, next_steps:string[] } }
 *       | { ok:false, error:'no_api_key'|'api_error' }
 *     >
 *
 * Degrade contract (never throws):
 *   - no key           -> { ok:false, error:'no_api_key' }, NO network reach
 *   - HTTP / parse fail -> { ok:false, error:'api_error' }
 *
 * Trust boundary (Canon Part 8): this is a LOCAL -> Anthropic call with the
 * user's OWN key. It never reaches the Brain. Room STATE text is untrusted model
 * input (T-232-02-02): the reply is treated as DATA (JSON.parse only, never
 * eval), and room-home.cjs renders every field as escaped textContent.
 *
 * CJS, zero new dependencies. No em-dashes.
 */

const { resolveAnthropicKey } = require('../core/mva-classifier.cjs');
const { getRoomHomeData } = require('./room-home.cjs');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
// The same model id string wiki-server.cjs line 560 already pins -- do NOT invent
// a new pin (D-06 / plan acceptance criterion).
const BRIEFING_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 30000;

// Larry's read of a venture Data Room: terse, structural, evidence-first, never
// grades or compliments (Canon Part 12), no em-dashes. REQUIRES a single JSON
// object as the entire reply.
const SYSTEM_PROMPT = [
  'You are Larry reading a venture Data Room. Be terse, structural, and',
  'evidence-first. Never grade and never compliment. Do not use em-dashes; use',
  'hyphens. Reply with a SINGLE JSON object and nothing else, of exactly this',
  'shape:',
  '{ "critical_misses": string[] (max 3), "reframe": string, "next_steps": string[] (max 3) }',
  'critical_misses: the load-bearing gaps or unvalidated assumptions in the room.',
  'reframe: one structural reframing of the venture problem.',
  'next_steps: the smallest evidence-generating actions to take next.',
].join(' ');

function _getFetch(opts) {
  if (opts && typeof opts.fetchImpl === 'function') return opts.fetchImpl;
  if (typeof fetch === 'function') return fetch;
  return null;
}

// Build the user content from the room's assembled Room Home data (governing
// thought + STATE-derived sections/gaps/counts). Never throws.
function _buildUserContent(roomDir) {
  let d = {};
  try {
    d = getRoomHomeData(roomDir) || {};
  } catch (_e) {
    d = {};
  }
  const lines = [];
  lines.push('Governing thought: ' + (d.governingThought || '(none set)'));
  lines.push('Venture stage: ' + (d.ventureStage || 'unknown'));
  lines.push('Total entries: ' + (Number(d.totalEntries) || 0));
  lines.push('');
  lines.push('Sections:');
  const sections = Array.isArray(d.sections) ? d.sections : [];
  if (sections.length === 0) {
    lines.push('- (none)');
  } else {
    for (const s of sections) {
      lines.push('- ' + s.name + ': ' + (Number(s.entries) || 0) + ' entries (' + (s.status || 'unknown') + ')');
    }
  }
  lines.push('');
  lines.push('Gaps:');
  const gaps = Array.isArray(d.gaps) ? d.gaps : [];
  if (gaps.length === 0) {
    lines.push('- (none)');
  } else {
    for (const g of gaps) {
      lines.push('- ' + (g.section ? g.section + ': ' : '') + g.message);
    }
  }
  return lines.join('\n');
}

// Concatenate all text blocks from an Anthropic /v1/messages response, then
// strip a surrounding markdown code fence if the model wrapped the JSON.
function _extractText(j) {
  let text = '';
  if (j && Array.isArray(j.content)) {
    for (const blk of j.content) {
      if (blk && blk.type === 'text' && typeof blk.text === 'string') {
        text += blk.text;
      }
    }
  }
  let t = String(text || '').trim();
  // Strip ```json ... ``` or ``` ... ``` fences.
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) t = fence[1].trim();
  return t;
}

/**
 * Generate Larry's Briefing for a room. See module header for the result shape
 * and the degrade contract.
 *
 * @param {string} roomDir
 * @param {object} [opts] { resolveKey?:fn, fetchImpl?:fn } test seams
 * @returns {Promise<object>}
 */
async function generateBriefing(roomDir, opts) {
  const o = opts || {};
  const resolveKey = typeof o.resolveKey === 'function' ? o.resolveKey : resolveAnthropicKey;

  let apiKey = null;
  try {
    apiKey = resolveKey();
  } catch (_e) {
    apiKey = null;
  }
  if (!apiKey) {
    // No key -> documented graceful degrade, NO network reach.
    return { ok: false, error: 'no_api_key' };
  }

  const f = _getFetch(o);
  if (!f) return { ok: false, error: 'api_error' };

  const userContent = _buildUserContent(roomDir);

  const body = {
    model: BRIEFING_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  };

  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch (_e) {} }, TIMEOUT_MS) : null;

  try {
    const res = await f(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined,
    });
    if (!res || !res.ok) return { ok: false, error: 'api_error' };

    const j = await res.json();
    const text = _extractText(j);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_e) {
      return { ok: false, error: 'api_error' };
    }
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'api_error' };
    }

    const briefing = {
      critical_misses: Array.isArray(parsed.critical_misses) ? parsed.critical_misses.slice(0, 3) : [],
      reframe: typeof parsed.reframe === 'string' ? parsed.reframe : '',
      next_steps: Array.isArray(parsed.next_steps) ? parsed.next_steps.slice(0, 3) : [],
    };
    return { ok: true, briefing };
  } catch (_e) {
    // Any network / abort / unexpected failure degrades to api_error; the key is
    // never logged or echoed anywhere (T-232-02-01).
    return { ok: false, error: 'api_error' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

module.exports = { generateBriefing };
