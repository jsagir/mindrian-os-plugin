/**
 * MindrianOS Plugin -- Feynman Prompt Constants (Phase 81 Revision 2)
 *
 * Automation-tightened Feynman stage prompts for the Feynman-MINTO hybrid
 * generator. These are derived from the human-facing Feynman engine skill at
 * ~/.claude/skills/feynman-engine/SKILL.md but rewritten for non-interactive
 * JSON emission. The skill file is NOT modified. This module is the single
 * source of truth for prompt text consumed by commands/mos-reason.md (81-02)
 * and any future v3.0 MCP Sampling tool.
 *
 * Only stages 1, 2, 4, 5 are represented. Stages 3 (Expose Confusion) and 6
 * (Teach It Back) are interactive human-review gates per D-2 of the phase
 * context and are skipped in automation.
 *
 * Placeholder tokens substituted at slash-command runtime:
 *   {section_name} -- kebab section slug, e.g. problem-definition
 *   {artifacts}    -- a rendered list of artifact title + excerpt pairs
 *
 * Every prompt ends with an explicit JSON-only output contract so the slash
 * command receives a parseable fragment. No hyphens longer than one char,
 * zero em-dashes, zero en-dashes. Bounded length.
 */

'use strict';

// Stage 1 -- Reduce to Essence. Returns { essence: string }.
const STAGE_1_ESSENCE = [
  'You are running Feynman Stage 1 (Reduce to Essence) on a Data Room section.',
  '',
  'Section: {section_name}',
  '',
  'Artifacts in this section:',
  '{artifacts}',
  '',
  'Task: read the artifacts above and strip the section to its irreducible',
  'fundamental truth. Remove jargon, remove implementation detail, remove',
  'anything that a smart reader would already know. What remains is the one',
  'essential claim this section makes about the venture.',
  '',
  'Constraints:',
  '- One sentence only.',
  '- Maximum 200 characters.',
  '- Plain language, concrete nouns, active verbs.',
  '- No hyphens used as dashes. No em-dashes. No en-dashes.',
  '- No hedging phrases like "it seems" or "arguably".',
  '- If the section contains no usable signal, return a one-sentence honest',
  '  placeholder describing the gap rather than fabricating content.',
  '',
  'Output contract: return a single JSON object on one line, no prose, no',
  'markdown fences. Shape:',
  '{"essence": "<one sentence max 200 chars>"}',
].join('\n');

// Stage 2 -- Translate to Plain Language. Returns { plain_language: string }.
const STAGE_2_PLAIN_LANGUAGE = [
  'You are running Feynman Stage 2 (Translate to Plain Language) on a Data',
  'Room section.',
  '',
  'Section: {section_name}',
  '',
  'Artifacts in this section:',
  '{artifacts}',
  '',
  'Task: rewrite what this section is saying as if you were explaining it to',
  'a smart generalist investor who sees a thousand pitches a year. Short',
  'sentences. Everyday words. Concrete descriptions over abstract terms. No',
  'academic tone. The reader should feel the point is obvious on first read.',
  '',
  'Constraints:',
  '- Exactly two sentences.',
  '- Maximum 400 characters total including spaces.',
  '- Zero hyphens acting as dashes. Zero em-dashes. Zero en-dashes.',
  '- No filler phrases like "in essence" or "at a high level".',
  '- Replace any word you would not say out loud in a conversation.',
  '- If you need jargon, you do not yet understand it.',
  '',
  'Output contract: return a single JSON object on one line, no prose, no',
  'markdown fences. Shape:',
  '{"plain_language": "<two sentences max 400 chars total>"}',
].join('\n');

// Stage 4 -- Build Mental Model. Returns { mental_model: { analogy, mapping, limits } }.
const STAGE_4_MENTAL_MODEL = [
  'You are running Feynman Stage 4 (Build Mental Model) on a Data Room',
  'section.',
  '',
  'Section: {section_name}',
  '',
  'Artifacts in this section:',
  '{artifacts}',
  '',
  'Task: build one analogy that makes this section instantly graspable.',
  'Name a familiar source domain. Map two to four specific pieces of the',
  'source domain onto the target concept. Then state where the analogy',
  'breaks so the reader does not over-extend it.',
  '',
  'Constraints:',
  '- analogy: one sentence naming the analogy. Maximum 150 characters.',
  '- mapping: two to four sentences describing how the source maps to the',
  '  target. Maximum 500 characters total.',
  '- limits: one sentence stating where the analogy stops being accurate.',
  '  Maximum 150 characters.',
  '- Zero em-dashes. Zero en-dashes. Hyphens only when joining compound words.',
  '- The analogy must be something a non-technical reader already knows.',
  '- If no honest analogy fits, return a one-sentence analogy of the gap',
  '  itself rather than forcing a bad fit.',
  '',
  'Output contract: return a single JSON object on one line, no prose, no',
  'markdown fences. Shape:',
  '{"mental_model": {"analogy": "<max 150>", "mapping": "<max 500>", "limits": "<max 150>"}}',
].join('\n');

// Stage 5 -- Sweet Spot + Key Claims. Returns { governing_thought, sweet_spot, key_claims }.
const STAGE_5_SWEET_SPOT = [
  'You are running Feynman Stage 5 (Simplify Until It Breaks) on a Data Room',
  'section. You also produce the Minto-style governing thought and key claims',
  'for the MINTO.md header in the same pass.',
  '',
  'Section: {section_name}',
  '',
  'Artifacts in this section:',
  '{artifacts}',
  '',
  'Task: find the simplest version of this section that is still true.',
  'Keep stripping detail until the next strip would make it wrong. That is',
  'the sweet spot. Then state the governing thought (the single top-of-pyramid',
  'claim this section makes) and the three to five key claims that support it.',
  '',
  'Constraints:',
  '- governing_thought: one sentence, maximum 250 characters, Minto-style',
  '  top-of-pyramid claim for this section.',
  '- sweet_spot: two to four sentences, maximum 600 characters total, the',
  '  understanding you want the reader to carry away.',
  '- key_claims: array of 3 to 5 strings. Each claim maximum 200 characters.',
  '  Each claim in plain language, each claim supporting the governing',
  '  thought, each claim independently checkable against the artifacts.',
  '- Zero em-dashes. Zero en-dashes. Hyphens only for compound words.',
  '- No repetition across claims. No filler claims added to reach the minimum.',
  '  If only three honest claims exist, return three.',
  '',
  'Output contract: return a single JSON object on one line, no prose, no',
  'markdown fences. Shape:',
  '{"governing_thought": "<max 250>", "sweet_spot": "<max 600>", "key_claims": ["<max 200>", "<max 200>", "<max 200>"]}',
].join('\n');

module.exports = {
  STAGE_1_ESSENCE,
  STAGE_2_PLAIN_LANGUAGE,
  STAGE_4_MENTAL_MODEL,
  STAGE_5_SWEET_SPOT,
};
