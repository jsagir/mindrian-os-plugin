'use strict';
/*
 * Phase 205 -- voice-mark HYBRID scorer test (lab-side, offline).
 * Proves the economy: 3 of 4 labels resolve DETERMINISTICALLY (no LLM); only a
 * single-valid-mark turn defers to the LLM color-move-match. Zero network (Part 8).
 * No em-dashes.
 */
const assert = require('node:assert');
const path = require('node:path');
const { scoreVoiceMark, scoreVoiceMarkHybrid } = require(path.join(__dirname, '..', 'lab', 'eval', 'voice-mark-hybrid.cjs'));

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

// 1. Missing -- a Larry turn with no mark -> deterministic, no LLM.
let r = scoreVoiceMark('Here is a plain answer with no De Stijl mark at all.');
ok(r.label === 'Missing' && r.deterministic && !r.needsLlm, 'no-mark turn must be deterministic Missing');

// 2. Single VALID mark -> presence/placement/count pass; ONLY color-move match needs the LLM.
r = scoreVoiceMark('\u{1F7E6} building with you on the next node.');
ok(r.needsLlm === true && r.deterministic === false, 'single valid mark must defer to the LLM (color-move match)');
ok(r.color, 'single valid mark must carry the detected color for the LLM leg');

// 3. Multiple marks -> deterministic Multiple, no LLM.
r = scoreVoiceMark('\u{1F7E6} \u{1F7E5} two marks leading the turn.');
ok(r.label === 'Multiple' && r.deterministic && !r.needsLlm, 'two-mark turn must be deterministic Multiple');

// 4. The hybrid resolves needsLlm via the injected judge (no network -- a stub).
(async () => {
  const passStub = async () => 'Pass';
  const wrongStub = async () => 'Wrong-Color';
  const a = await scoreVoiceMarkHybrid('\u{1F7E6} building.', { llmJudge: passStub });
  ok(a.label === 'Pass' && a.llmResolved === true, 'hybrid resolves single-valid-mark to Pass via judge');
  const b = await scoreVoiceMarkHybrid('\u{1F7E6} building.', { llmJudge: wrongStub });
  ok(b.label === 'Wrong-Color' && b.llmResolved === true, 'hybrid resolves color-move miss to Wrong-Color via judge');

  // 5. Deterministic cases NEVER call the judge (economy proof).
  let judgeCalls = 0;
  const counting = async () => { judgeCalls++; return 'Pass'; };
  await scoreVoiceMarkHybrid('plain no-mark turn', { llmJudge: counting });
  await scoreVoiceMarkHybrid('\u{1F7E6} \u{1F7E5} two marks', { llmJudge: counting });
  ok(judgeCalls === 0, 'deterministic labels (Missing/Multiple) must NOT invoke the LLM judge');

  console.log(`PASS test-205-voice-mark-hybrid.cjs (${checks} assertions: deterministic Missing/Multiple/Wrong-Color, LLM only for single-valid-mark color-move match, judge never called on deterministic cases)`);
})();
