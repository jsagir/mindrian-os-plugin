/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-03 Plan 03 -- mva-progressive-renderer.
 *
 * Pure-function renderer that turns AgentResult shapes into Larry-voiced
 * GUIDED text blocks. Zero I/O. Zero process / console / fs references.
 *
 * Larry voice (per feedback_larry_pedagogical_guided_first.md):
 *   GUIDED, not AUTONOMOUS. The renderer never says "I've analyzed your
 *   venture and found:" -- it surfaces what shows up in the graph and
 *   invites the navigator to chew on it.
 *
 * Canon Part 8: this module receives ONLY structured AgentResult objects
 * (which themselves only carry agent-supplied summary_line / payload).
 * The renderer does not read the raw sentence; it does not know it exists.
 *
 * Em-dash discipline (per feedback_no_emdashes.md): every string emitted
 * by this module uses `--` and `-` ONLY. The hardcoded footer text is a
 * module-level constant (NOT loaded from any source markdown at runtime;
 * source spec contains em-dashes and is not a runtime input).
 *
 * The 6 per-agent labels (verbatim from plan task 1 step 3):
 *   brain_similar       -> [brain]
 *   brain_cross_domain  -> [analogy]
 *   brain_classic_traps -> [traps]
 *   tavily_funding      -> [funding]
 *   six_hats_red_black  -> [worth chewing on]
 *   dashboard_graph     -> [your room]
 *
 * Pure CJS, no requires (zero deps).
 */
'use strict';

// ---------- Frozen invariants ----------

const AGENT_LABELS = Object.freeze({
  brain_similar: 'brain',
  brain_cross_domain: 'analogy',
  brain_classic_traps: 'traps',
  tavily_funding: 'funding',
  six_hats_red_black: 'worth chewing on',
  dashboard_graph: 'your room',
});

// Verbatim from source spec line 111 + binding decision B7.
// Note the apostrophe in "didn't" stays as a literal apostrophe; the em-dash
// in the source spec is rewritten as `--` per feedback_no_emdashes.md.
const SHARP_QUESTION_FALLBACK = [
  "I didn't find precedents for this in 30 seconds.",
  "That's either a gap in my data or a signal that you're in a genuinely unexplored space.",
  "Which do you think it is?",
  ''
].join('\n');

// Hardcoded module-level constant for the 3-option footer (CRITICAL-6).
// MUST use `--`, NEVER `—`. Plan 118-03 Test 8b asserts both invariants.
const FOOTER_TEXT = [
  '',
  'What now?',
  '  [1] Just tell me what\'s new         (stay in "tell me" mode)',
  '  [2] Build a room around this        (invest)',
  '  [3] Challenge me -- Devil\'s Advocate (go deeper cognitively)',
  ''
].join('\n');

// Hebrew refusal block (per LD1). English first, Hebrew second. No em-dashes.
const HEBREW_REFUSAL = [
  'MindrianOS does not yet support Hebrew in v1.13.0. Please try in English.',
  'MindrianOS לא תומך בעברית ב-v1.13.0; אנא נסה באנגלית.',
  ''
].join('\n');

// ---------- Pure helpers ----------

function _label(agent_id) {
  return AGENT_LABELS[agent_id] || agent_id;
}

function _summaryLine(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (typeof payload.summary_line === 'string') return payload.summary_line;
  return '';
}

// ---------- Public exports ----------

/**
 * renderHeader(sha8) -> 2-line GUIDED opener.
 *
 * "Scanning for precedents... (sentence <sha8>)"
 * "[progress: 0s / 45s, 0 of 6 returned]"
 */
function renderHeader(sha8) {
  const safeSha8 = (typeof sha8 === 'string' && sha8.length > 0) ? sha8 : 'unknown';
  return [
    `Scanning for precedents... (sentence ${safeSha8})`,
    '[progress: 0s / 45s, 0 of 6 returned]',
    ''
  ].join('\n');
}

/**
 * renderProgressIndicator(elapsedMs, budgetMs, returnedCount) -> single line.
 *
 * "  [progress: 12s / 45s, 3 of 6 returned]"
 */
function renderProgressIndicator(elapsedMs, budgetMs, returnedCount) {
  const elapsed = Math.max(0, Math.round((elapsedMs || 0) / 1000));
  const budget = Math.max(0, Math.round((budgetMs || 0) / 1000));
  const returned = Math.max(0, returnedCount | 0);
  return `  [progress: ${elapsed}s / ${budget}s, ${returned} of 6 returned]\n`;
}

/**
 * renderAgentResult(result) -> 1-3 line Larry-voiced block based on status.
 *
 * Dispatches on result.status:
 *   ok       -> "  [<label>] <summary_line>"
 *   empty    -> contextualized placeholder (special-case tavily_unavailable)
 *   timeout  -> "  [<label>] (still in progress at 45s)"
 *   error    -> "  [<label>] (skipped)"  (raw error NEVER included verbatim)
 */
function renderAgentResult(result) {
  if (!result || typeof result !== 'object') return '';
  const id = result.agent_id || 'agent';
  const label = _label(id);
  const status = result.status;

  if (status === 'ok') {
    const line = _summaryLine(result.payload);
    if (line) {
      return `  [${label}] ${line}\n`;
    }
    return `  [${label}] (no summary returned)\n`;
  }

  if (status === 'empty') {
    const reason = result.payload && typeof result.payload === 'object' ? result.payload.reason : null;
    if (id === 'tavily_funding' && reason === 'tavily_unavailable') {
      return `  [${label}] Live funding scan: not configured (add TAVILY_API_KEY to ~/.mindrian.env)\n`;
    }
    return `  [${label}] (no findings this pass)\n`;
  }

  if (status === 'timeout') {
    return `  [${label}] (still in progress at 45s)\n`;
  }

  if (status === 'error') {
    // CRITICAL: do NOT include the raw error string verbatim. Canon Part 8.
    return `  [${label}] (skipped)\n`;
  }

  return `  [${label}] (unknown status)\n`;
}

/**
 * renderSharpQuestionFallback() -> verbatim sharp question from source spec
 * line 111. Em-dash-free (the source spec's em-dash is rewritten to `--`
 * by hardcoding the text here).
 */
function renderSharpQuestionFallback() {
  return SHARP_QUESTION_FALLBACK;
}

/**
 * renderHebrewRefusal() -> bilingual refusal block. English first, Hebrew
 * second. No em-dashes. Per LD1 (Locked Decision 1).
 */
function renderHebrewRefusal() {
  return HEBREW_REFUSAL;
}

/**
 * renderFooter() -> the 3-option footer block (binding decision B4).
 *
 * VERBATIM hardcoded text. MUST use `--`, NEVER `—`. Tested by Test 8b
 * in mva-progressive-renderer.test.cjs.
 */
function renderFooter() {
  return FOOTER_TEXT;
}

module.exports = {
  renderHeader,
  renderProgressIndicator,
  renderAgentResult,
  renderSharpQuestionFallback,
  renderHebrewRefusal,
  renderFooter,
  // Exported for adversarial/golden-fixture tests in Plan 118-06
  AGENT_LABELS,
};
