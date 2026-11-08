'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 389 plan 03: the outside-evidence cells of the Seed Test step.
 *
 * The plugin has no model. The host model reads the venture sentence and writes
 * at most four short generic phrases, one for each slot. This module checks the
 * phrases (Part 8) and builds four cells that use only those phrases. The cells
 * never see the venture sentence. The fan-out, the clock and the cell contract
 * come from pyramid-seed-dispatcher.cjs, pyramid-seed-budget.cjs and pyramid-seed-agent-contract.cjs,
 * which this module reuses unchanged. The caller runs the dispatcher. Renaming
 * those three files is plan 13.
 *
 * Cells (the old dashboard graph cell and the old classic traps cell are not
 * carried over):
 *   similar_cases   Situation          Theo, brain search with the situation phrase
 *   known_traps     Complication       Theo, brain search with the complication phrase
 *   analogies       key-line support   Theo, brain search with the analogy phrase
 *   funding         key-line support   web search (Tavily) through research-corpus
 *
 * Outside text is evidence, never an instruction. A cell returns it as a quoted
 * excerpt with a source label, capped at 600 characters. A Brain or web answer
 * that carries an error key is never ok.
 *
 * Pure CommonJS, node built-ins and the lib/core modules named above. Lazy
 * requires for brain-client and research-corpus. No state, no timer, no output.
 */

const SLOTS = Object.freeze(['situation', 'complication', 'analogy', 'funding']);

const CELL_TABLE = Object.freeze([
  Object.freeze({ id: 'similar_cases', slot: 'situation', pyramid: 'Situation', destination: 'brain', topK: 3 }),
  Object.freeze({ id: 'known_traps', slot: 'complication', pyramid: 'Complication', destination: 'brain', topK: 3 }),
  Object.freeze({ id: 'analogies', slot: 'analogy', pyramid: 'key-line support', destination: 'brain', topK: 2 }),
  Object.freeze({ id: 'funding', slot: 'funding', pyramid: 'key-line support', destination: 'web', limit: 3 }),
]);

const EXCERPT_MAX = 600;
const SUMMARY_MAX = 160;
const TITLE_MAX = 120;
const SHARED_RUN_WORDS = 4;
const BRAIN_SOURCE = 'Theo brain_search (generic methodology)';
const WEB_SOURCE = 'Tavily web search (snippets)';

function _isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _cap(s, n) {
  const t = typeof s === 'string' ? s : '';
  return t.length > n ? t.slice(0, n) : t;
}

function _reason(s) {
  const t = typeof s === 'string' ? s.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') : '';
  return t.length > 0 ? t.slice(0, 48) : 'unknown';
}

/**
 * Part 8 check of a phrase set. sprouts is a plain object with the slot names as
 * keys. A missing slot is reported in `missing` and is not an error. A set with
 * no present slot is rejected. Every phrase passes validateSprouts of
 * part8-split-route.cjs (12 words or fewer, one sentence, no line break, no
 * quoted span, no first-person statement). When opts.sentence is a string, a
 * phrase that shares a run of 4 words with it is rejected. The result never
 * holds a rejected text. opts.classify is passed through for tests.
 *
 * @returns {{ ok: boolean, present: string[], missing: string[], rejected: Array<{slot: string, class: string}>, reason?: string }}
 */
function checkSprouts(sprouts, opts) {
  const o = _isPlainObject(opts) ? opts : {};
  const out = { ok: false, present: [], missing: [], rejected: [] };
  try {
    if (!_isPlainObject(sprouts)) { out.reason = 'invalid_sprouts'; return out; }
    const keys = Object.keys(sprouts);
    for (let i = 0; i < keys.length; i += 1) {
      if (SLOTS.indexOf(keys[i]) === -1) out.rejected.push({ slot: _cap(keys[i], 24).replace(/[^a-zA-Z0-9_-]/g, '?'), class: 'unknown_slot' });
    }
    const present = SLOTS.filter((s) => Object.prototype.hasOwnProperty.call(sprouts, s) && sprouts[s] !== undefined && sprouts[s] !== null);
    out.present = present;
    out.missing = SLOTS.filter((s) => present.indexOf(s) === -1);
    if (present.length === 0) { out.reason = 'no_slot'; return out; }
    const split = require('./part8-split-route.cjs');
    const texts = present.map((s) => sprouts[s]);
    const v = split.validateSprouts(texts, { classify: o.classify, roomDir: o.roomDir });
    if (!v.ok && v.rejected.length === 0) {
      out.reason = v.reason || 'invalid_sprouts';
      return out;
    }
    const flagged = {};
    v.rejected.forEach((r) => {
      flagged[r.index] = true;
      out.rejected.push({ slot: present[r.index], class: r.class || 'blocked' });
    });
    if (typeof o.sentence === 'string' && o.sentence.length > 0) {
      for (let i = 0; i < present.length; i += 1) {
        if (flagged[i]) continue;
        if (split.sharesClaimRun(texts[i], [o.sentence], SHARED_RUN_WORDS)) {
          out.rejected.push({ slot: present[i], class: 'shares_sentence_run' });
        }
      }
    }
    out.ok = out.rejected.length === 0;
    if (!out.ok && !out.reason) out.reason = 'phrases_rejected';
    return out;
  } catch (_e) {
    out.ok = false;
    out.reason = 'check_failed';
    return out;
  }
}

function _firstLine(text) {
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].replace(/\s+/g, ' ').trim();
    if (t.length > 0) return t;
  }
  return '';
}

// The Brain success shape: callTool returns the parsed JSON of the first text
// block, or { text } when that block is not JSON. A sentinel object carries an
// error key. Returns the answer text or ''.
function _brainText(ans) {
  if (!_isPlainObject(ans)) return '';
  if (typeof ans.text === 'string' && ans.text.trim().length > 0) return ans.text;
  const pick = (item) => {
    if (typeof item === 'string') return item;
    if (!_isPlainObject(item)) return '';
    const head = [item.name, item.title].find((x) => typeof x === 'string' && x.length > 0) || '';
    const body = [item.description, item.text, item.content, item.summary].find((x) => typeof x === 'string' && x.length > 0) || '';
    return head && body ? head + ': ' + body : head || body;
  };
  if (Array.isArray(ans.results)) {
    return ans.results.map(pick).filter(Boolean).join('\n');
  }
  const keys = ['answer', 'summary', 'message'];
  for (let i = 0; i < keys.length; i += 1) {
    if (typeof ans[keys[i]] === 'string' && ans[keys[i]].trim().length > 0) return ans[keys[i]];
  }
  return '';
}

function _empty(reason) {
  return { status: 'empty', payload: { reason: _reason(reason) } };
}

function _brainCell(row, phrase, deps) {
  return async function brainCell(_context, signal) {
    if (signal && signal.aborted) return null;
    let brain = deps.brain;
    if (!brain) brain = require('./brain-client.cjs');
    if (typeof brain.isAvailable === 'function' && !brain.isAvailable()) return _empty('brain_unavailable');
    const ans = await brain.search(phrase, { topK: row.topK });
    if (signal && signal.aborted) return null;
    if (ans === null || ans === undefined) return _empty('brain_unavailable');
    if (!_isPlainObject(ans)) return _empty('no_answer');
    if (ans.error) return _empty(ans.error);
    const text = _brainText(ans);
    if (text.length === 0) return _empty('no_answer');
    return {
      status: 'ok',
      payload: {
        summary_line: _cap(_firstLine(text), SUMMARY_MAX),
        excerpt: _cap(text.trim(), EXCERPT_MAX),
        source: BRAIN_SOURCE,
        evidence_only: true,
      },
    };
  };
}

function _fundingCell(row, phrase, deps) {
  return async function fundingCell(_context, signal) {
    if (signal && signal.aborted) return null;
    let env = null;
    try {
      const corpus = deps.corpus || require('./research-corpus.cjs');
      env = await corpus.fetchCorpusEnvelope({ source: 'tavily', query: phrase, limit: row.limit });
    } catch (_e) {
      return _empty('search_failed');
    }
    if (signal && signal.aborted) return null;
    if (!_isPlainObject(env)) return _empty('no_answer');
    if (env.error && env.status !== 'ok') return _empty(env.failure_class || 'search_failed');
    const results = _isPlainObject(env.payload) && Array.isArray(env.payload.results) ? env.payload.results : [];
    if (env.status !== 'ok') return _empty(env.failure_class || (env.status === 'empty_valid' ? 'no_results' : 'search_failed'));
    if (results.length === 0) return _empty('no_results');
    const titles = results
      .map((r) => (_isPlainObject(r) && typeof r.title === 'string' ? _cap(r.title.replace(/\s+/g, ' ').trim(), TITLE_MAX) : ''))
      .filter(Boolean);
    const lines = results.map((r) => {
      if (!_isPlainObject(r)) return '';
      const t = typeof r.title === 'string' ? r.title.replace(/\s+/g, ' ').trim() : '';
      const a = typeof r.abstract === 'string' ? r.abstract.replace(/\s+/g, ' ').trim() : '';
      return t && a ? t + ': ' + a : t || a;
    }).filter(Boolean);
    if (lines.length === 0) return _empty('no_results');
    return {
      status: 'ok',
      payload: {
        summary_line: _cap(titles.length > 0 ? titles.join('; ') : lines[0], SUMMARY_MAX),
        excerpt: _cap(lines.join('\n'), EXCERPT_MAX),
        titles: titles,
        count: results.length,
        source: WEB_SOURCE,
        evidence_only: true,
      },
    };
  };
}

/**
 * Build one { id, fn } agent for each slot that holds a phrase. A cell function
 * has the signature (context, signal) and returns { status, payload } or null.
 * deps.brain and deps.corpus are injectable for tests. The phrases are read
 * once here. The venture sentence is never an argument of this function.
 */
function buildCells(sprouts, deps) {
  const d = _isPlainObject(deps) ? deps : {};
  const src = _isPlainObject(sprouts) ? sprouts : {};
  const out = [];
  CELL_TABLE.forEach((row) => {
    const phrase = src[row.slot];
    if (typeof phrase !== 'string' || phrase.trim().length === 0) return;
    const p = phrase.trim();
    out.push({ id: row.id, fn: row.destination === 'web' ? _fundingCell(row, p, d) : _brainCell(row, p, d) });
  });
  return out;
}

module.exports = { SLOTS, CELL_TABLE, checkSprouts, buildCells };
