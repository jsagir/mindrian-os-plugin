'use strict';

/*
 * Phase 115-02 -- Dual-path detector (DISCRETION-03 resolution)
 *
 * 5-feature additive score classifier for turn-1 intake.
 *
 *   F1 word_count: < 80 -> -2; > 300 -> +2; 80..300 -> 0
 *   F2 newline_density (newlines/words): > 0.10 -> +2; < 0.05 -> -1; 0.05..0.10 -> 0
 *   F3 SECTION_HEADER match -> +3
 *   F4 DOMAIN_MARKER match -> +2
 *   F5 STUCK_LANGUAGE match -> -3 (NEGATIVE WEIGHT, Pitfall 3 safety net)
 *
 * Decision rule:
 *   score >= +3 -> 'upload'
 *   score <= -3 -> 'type'
 *   else        -> 'ambiguous'
 *
 * Canon Part 8: pure string classification; output is enum + int + booleans
 * (NO matched substrings in features). Safe for Phase 121 trajectory telemetry
 * which carries the features payload as scalars only.
 *
 * Pitfall 3 mitigation: STUCK_LANGUAGE carries -3 NEGATIVE WEIGHT so a thoughtful
 * 250-word stuck-decision answer cannot be misclassified as upload even when a
 * single domain marker (e.g. "$5M") is present in the prose.
 */

const SECTION_HEADER = /^(Education|Experience|Summary|Methodology|Background|Problem Statement|Abstract|Hypothesis|Goal|Objective|Approach|Team|Founder|CEO|CTO|Advisor|Skills|Publications|Patents|Funding|Market|Solution|Pitch)\b/im;
const DOMAIN_MARKER = /(IRB#?\s*\d|NCT\d{8}|NIH\b|IND\b|FDA\b|HIPAA\b|\$[\d.]+[MBK]\b|ARR|MRR|Series\s*[A-Z]\b|runway|burn rate|LP\b|GP\b|fund size|check size|portfolio)/i;
const STUCK_LANGUAGE = /(I'?m stuck|I can'?t|I don'?t know|I'?m trying to|help me think|I keep|I keep coming back to)/i;

function classify(text) {
  if (!text || typeof text !== 'string') {
    return { path: 'ambiguous', score: 0, features: {} };
  }
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wc = words.length;
  const newlines = (text.match(/\n/g) || []).length;
  const density = wc > 0 ? newlines / wc : 0;

  let score = 0;
  const features = {
    word_count: wc,
    newline_density: density,
    section_header: false,
    domain_marker: false,
    stuck_language: false,
  };

  // F1 word count
  if (wc < 80) score -= 2;
  else if (wc > 300) score += 2;

  // F2 newline density
  if (density > 0.10) score += 2;
  else if (density < 0.05) score -= 1;

  // F3 section headers
  features.section_header = SECTION_HEADER.test(text);
  if (features.section_header) score += 3;

  // F4 domain markers
  features.domain_marker = DOMAIN_MARKER.test(text);
  if (features.domain_marker) score += 2;

  // F5 first-person stuck-language (negative weight: Pitfall 3 safety net)
  features.stuck_language = STUCK_LANGUAGE.test(text);
  if (features.stuck_language) score -= 3;

  let path;
  if (score >= 3) path = 'upload';
  else if (score <= -3) path = 'type';
  else path = 'ambiguous';

  return { path, score, features };
}

module.exports = {
  classify,
  SECTION_HEADER,
  DOMAIN_MARKER,
  STUCK_LANGUAGE,
};
