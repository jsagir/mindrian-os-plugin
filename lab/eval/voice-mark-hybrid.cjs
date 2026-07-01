'use strict';
/*
 * Voice-signature HYBRID scorer (Phase 205 eval-suite refinement).
 * =========================================================================
 * The 0.75 laggard lesson: do NOT LLM-judge what a detector can prove.
 * The voice-signature judge has four labels -- Pass / Missing / Wrong-Color /
 * Multiple. THREE of them are DETERMINISTIC facts (presence, placement, count,
 * spoof) that lib/hmi/voice-color-mark.cjs::detectVoiceMark already returns with
 * certainty. Only ONE decision is genuinely subjective: given a single valid mark,
 * does its COLOR match the pedagogical MOVE the turn is making? That one beat is
 * worth an LLM (the de-stijl-mark-classifier endpoint); everything else is a regex.
 *
 * This module is the hybrid gate: it resolves the deterministic labels locally and
 * flags ONLY the color-move-match case for the LLM leg. Pure + offline by default
 * (Part 8: zero network unless an llmJudge callback is supplied). Lives in lab/
 * (lab-side eval), NOT the user hot path. No em-dashes.
 *
 * Path note: kept under lab/eval/ to stay clear of Phase 205-09's lab/plurai-suite/.
 */

const path = require('node:path');
const { detectVoiceMark } = require(path.join(__dirname, '..', '..', 'lib', 'hmi', 'voice-color-mark.cjs'));

/**
 * scoreVoiceMark(turnText) -> deterministic verdict + needsLlm flag.
 * Labels: 'Missing' | 'Multiple' | 'Wrong-Color' | 'native-host' | 'Pass?'
 *   'Pass?' means presence/placement/count all passed deterministically and the
 *   ONLY open question is color-move match -> needsLlm = true.
 */
function scoreVoiceMark(turnText, opts = {}) {
  // The eval scores LARRY turns by default, so a no-mark turn is "Missing" (Larry
  // forgot the mark). Only when the caller says this is NOT asserted as a Larry
  // turn does no-mark read as native-host. The detector alone cannot tell them
  // apart -- that context is the eval's to supply.
  const assumeLarry = opts.assumeLarryTurn !== false;
  const d = detectVoiceMark(String(turnText == null ? '' : turnText));

  // No valid mark at all (covers the bracketed-none / native-host detector path too).
  if (!d.hasMark || d.count === 0) {
    return assumeLarry
      ? { label: 'Missing', deterministic: true, needsLlm: false, detect: d,
          reason: 'Larry turn with no valid De Stijl mark' }
      : { label: 'native-host', deterministic: true, needsLlm: false, detect: d,
          reason: 'no mark and not asserted as a Larry turn -> native host' };
  }
  // Multiple: more than one mark (hasMark true, count > 1, valid false).
  if (d.count > 1) {
    return { label: 'Multiple', deterministic: true, needsLlm: false, detect: d,
             reason: `${d.count} marks present; exactly one required` };
  }
  // A single mark that the detector rejects (spoof / non-De-Stijl / mis-placed) -> Wrong-Color, deterministic.
  if (d.count === 1 && !d.valid) {
    return { label: 'Wrong-Color', deterministic: true, needsLlm: false, detect: d,
             reason: 'single mark but not a valid anchored De Stijl color (spoof / non-palette / misplaced)' };
  }
  // count === 1 && valid: presence + placement + count + palette ALL pass deterministically.
  // The remaining question is SEMANTIC: does d.color match the pedagogical move? -> LLM leg only.
  return { label: 'Pass?', deterministic: false, needsLlm: true, color: d.color, detect: d,
           reason: 'presence/placement/count/palette OK deterministically; color-move match needs the LLM judge' };
}

/**
 * scoreVoiceMarkHybrid(turnText, { llmJudge }) -> final label.
 * llmJudge(optional): async (turnText, color) => 'Pass' | 'Wrong-Color'
 *   (asks ONLY the color-move-match question). If omitted, returns the deterministic
 *   pre-verdict unchanged (needsLlm stays true for the caller to resolve).
 * This is the fraction-of-calls economy: the LLM fires only on single-valid-mark turns.
 */
async function scoreVoiceMarkHybrid(turnText, opts = {}) {
  const pre = scoreVoiceMark(turnText, opts);
  if (!pre.needsLlm || typeof opts.llmJudge !== 'function') return pre;
  const llmLabel = await opts.llmJudge(String(turnText), pre.color);
  return { ...pre, label: (llmLabel === 'Pass' ? 'Pass' : 'Wrong-Color'),
           deterministic: false, needsLlm: false, llmResolved: true };
}

module.exports = { scoreVoiceMark, scoreVoiceMarkHybrid };
