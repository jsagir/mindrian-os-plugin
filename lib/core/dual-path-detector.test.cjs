'use strict';

/*
 * Phase 115-02 -- dual-path-detector unit tests (16 fixtures)
 *
 * Test map:
 *   F-00 null-guard
 *   F-01..F-05 PURE TYPE PATH (5 fixtures)
 *   F-06..F-10 PURE UPLOAD PATH (5 fixtures)
 *   F-11..F-15 AMBIGUOUS / FALSE-POSITIVE GUARDS (5 fixtures; F-11/F-12/F-13 are Pitfall 3 mitigation)
 *
 * Each fixture asserts path classification + score + the three boolean features.
 * Suite passes when 16/16 PASS.
 *
 * Threshold contract (RESEARCH DISCRETION-03 verbatim):
 *   score >= +3 -> 'upload'
 *   score <= -3 -> 'type'
 *   else        -> 'ambiguous'
 *
 * Score features:
 *   F1 word_count: < 80 -> -2; > 300 -> +2; 80..300 -> 0
 *   F2 newline_density: > 0.10 -> +2; < 0.05 -> -1; 0.05..0.10 -> 0
 *   F3 SECTION_HEADER match -> +3
 *   F4 DOMAIN_MARKER match -> +2
 *   F5 STUCK_LANGUAGE match -> -3 (NEGATIVE WEIGHT, Pitfall 3 safety net)
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const MODULE_PATH = path.resolve(__dirname, 'dual-path-detector.cjs');

let passed = 0;
let failed = 0;
function run(name, fn) {
  try {
    fn();
    process.stdout.write('ok  ' + name + '\n');
    passed += 1;
  } catch (err) {
    process.stderr.write('FAIL ' + name + '\n' + (err && err.stack ? err.stack : String(err)) + '\n');
    failed += 1;
  }
}

const { classify } = require(MODULE_PATH);

// ---------- F-00 null-guard ----------

run('F-00 null input -> ambiguous score 0', () => {
  const r = classify(null);
  assert.equal(r.path, 'ambiguous');
  assert.equal(r.score, 0);
  assert.deepEqual(r.features, {});
});

run('F-00b empty string -> ambiguous score 0', () => {
  const r = classify('');
  assert.equal(r.path, 'ambiguous');
  assert.equal(r.score, 0);
});

run('F-00c non-string number -> ambiguous score 0', () => {
  const r = classify(42);
  assert.equal(r.path, 'ambiguous');
  assert.equal(r.score, 0);
});

// ---------- F-01..F-05 PURE TYPE PATH ----------

run('F-01 short prose with stuck-language -> type', () => {
  const text = "I'm stuck on whether to raise now or later, and honestly I don't know what's blocking me.";
  const r = classify(text);
  // word_count ~17 -> -2, density 0 -> -1, stuck_language -> -3 = -6
  assert.equal(r.features.stuck_language, true);
  assert.equal(r.features.section_header, false);
  assert.equal(r.features.domain_marker, false);
  assert.ok(r.score <= -3, 'score should be <= -3, got ' + r.score);
  assert.equal(r.path, 'type');
});

run('F-02 medium prose 200 words with stuck-language anchors -> type', () => {
  // ~200 words conversational, with stuck-language and low newline density
  const text = (
    "I keep coming back to this same fork in the road and I don't know which side is the right one to walk down. " +
    "I'm trying to figure out if the conviction I had three months ago was real conviction or just enthusiasm dressed up as belief. " +
    "Some days I wake up and the whole thing feels obvious, like of course we should keep going, the signal is there, the people are there, the timing is right. " +
    "Other days I wake up and I can't shake the feeling that I am building something nobody actually wants, and the small handful of paying customers we have are exceptions and not signal. " +
    "I keep coming back to one specific conversation from January where a potential customer said something that should have been a yes and was instead a soft no. " +
    "I have been turning that conversation over for weeks now. I don't know what to do with it. " +
    "Help me think this through, because the inside of my own head is not where the answer is going to come from."
  );
  const r = classify(text);
  // Expect stuck_language true, low newline density, no section_header, no domain markers
  assert.equal(r.features.stuck_language, true);
  assert.equal(r.path, 'type', 'expected type, got ' + r.path + ' score=' + r.score);
});

run('F-03 short prose <80 pure conversational no stuck-language -> type', () => {
  const text = "Honestly the question is bigger than I expected when I sat down to write this morning. " +
    "Maybe the answer is hiding inside the question itself. Maybe it is somewhere else entirely. " +
    "Either way the next move is mine to make and I am still working out what it should be.";
  const r = classify(text);
  // word_count ~57 -> -2, density 0 -> -1, no other features = -3 -> 'type'
  assert.equal(r.features.stuck_language, false);
  assert.equal(r.features.section_header, false);
  assert.equal(r.features.domain_marker, false);
  assert.ok(r.score <= -3, 'expected score <= -3, got ' + r.score);
  assert.equal(r.path, 'type');
});

run('F-04 medium prose 250 with $5M domain marker but stuck-language -> type or ambiguous safety', () => {
  const text = (
    "I keep coming back to whether the next round needs to be a $5M raise or something smaller and tighter. " +
    "I'm trying to think clearly about it but the inside of my head is not the right place for that calculation, " +
    "because every time I try to run the numbers I find myself negotiating with my own ambition instead of being honest about what we need. " +
    "I don't know what the truth is yet. The truth might be that we don't need outside money for another six months. " +
    "The truth might be that we need it now and waiting will cost us a competitor advantage. " +
    "The truth might be somewhere uglier than either of those, like we are not actually as ready as the deck pretends we are. " +
    "I keep coming back to a board conversation from last quarter where someone said something I have been turning over since then. " +
    "Help me think through this without me trying to convince myself of an answer I already want to be true. " +
    "Just walk through it slowly with me. The shape of the right answer is here somewhere if I can stop reaching for it."
  );
  const r = classify(text);
  // Approx: word_count ~165 -> 0, density low -> -1, domain_marker ($5M) -> +2, stuck -> -3 = -2 -> 'ambiguous'
  // Per <behavior> F-05: this is the safety case where ambiguous fires
  assert.equal(r.features.stuck_language, true);
  assert.equal(r.features.domain_marker, true);
  assert.ok(r.path === 'ambiguous' || r.path === 'type',
    'must NOT be upload (Pitfall 3 guard); got ' + r.path + ' score=' + r.score);
});

run('F-05 short prose no markers -> type via word_count + density', () => {
  const text = "Just thinking out loud here. Some weeks the venture feels like it is moving and other weeks it feels like sand. Today is a sand day.";
  const r = classify(text);
  assert.equal(r.features.section_header, false);
  assert.equal(r.features.domain_marker, false);
  assert.equal(r.features.stuck_language, false);
  // word_count ~25 -> -2, density 0 -> -1 = -3 -> 'type'
  assert.ok(r.score <= -3, 'expected score <= -3, got ' + r.score);
  assert.equal(r.path, 'type');
});

// ---------- F-06..F-10 PURE UPLOAD PATH ----------

run('F-06 short formatted CV -> upload', () => {
  const text = [
    'Education',
    'MIT 2018 PhD Robotics',
    'Stanford 2014 BS EECS',
    '',
    'Experience',
    'Founder Acme Robotics 2022-present',
    'Senior Engineer Google 2018-2022',
    '',
    'Skills',
    'Python, robotics, ML, NIH SBIR $2M',
  ].join('\n');
  const r = classify(text);
  // Expected: word_count <80 -> -2, high density -> +2, section_header -> +3, domain_marker (NIH, $2M) -> +2 = +5 -> upload
  assert.equal(r.features.section_header, true);
  assert.equal(r.features.domain_marker, true);
  assert.equal(r.features.stuck_language, false);
  assert.ok(r.score >= 3, 'expected score >= 3, got ' + r.score);
  assert.equal(r.path, 'upload');
});

run('F-07 long CV 500 words -> upload', () => {
  // Long CV-shaped paste with lots of newlines + section headers + domain markers
  const lines = ['Education'];
  for (let i = 0; i < 6; i++) lines.push('University of Wherever ' + (2010 + i) + ' Degree details and notes here.');
  lines.push('');
  lines.push('Experience');
  for (let i = 0; i < 12; i++) lines.push('Role ' + i + ' at Company ' + i + ' from ' + (2010 + i) + ' to ' + (2011 + i) + ' building things measured outcomes shipped.');
  lines.push('');
  lines.push('Skills');
  for (let i = 0; i < 10; i++) lines.push('Skill ' + i + ' detail line with depth notes here for filling out the document.');
  lines.push('');
  lines.push('Funding');
  lines.push('NIH SBIR $2M 2023, Series A $10M 2024, IRB# 12345 ongoing.');
  const text = lines.join('\n');
  const r = classify(text);
  assert.equal(r.features.section_header, true);
  assert.equal(r.features.domain_marker, true);
  assert.ok(r.score >= 3, 'expected score >= 3, got ' + r.score);
  assert.equal(r.path, 'upload');
});

run('F-08 medium VC memo 350 words with Series A / ARR / GP -> upload', () => {
  const lines = ['Approach', 'Series A investment thesis. Target ARR $5M next 12 months. GP holds 20% carry.'];
  for (let i = 0; i < 10; i++) {
    lines.push('Bullet ' + i + ' the company has revenue MRR climbing and a runway of 18 months at current burn rate.');
  }
  lines.push('Team');
  lines.push('Founder ex-Google. CTO ex-Stanford. Operations veteran from a Series B portfolio company.');
  lines.push('Market');
  for (let i = 0; i < 8; i++) lines.push('Market signal ' + i + ' addressable customers paying month over month with a check size that justifies our concentration.');
  lines.push('Risk Factors');
  for (let i = 0; i < 6; i++) lines.push('Risk ' + i + ' detail and mitigation paragraph for thoughtful investor diligence.');
  const text = lines.join('\n');
  const r = classify(text);
  assert.equal(r.features.section_header, true);
  assert.equal(r.features.domain_marker, true);
  assert.equal(r.features.stuck_language, false);
  assert.ok(r.score >= 3, 'expected score >= 3, got ' + r.score);
  assert.equal(r.path, 'upload');
});

run('F-09 medium IRB protocol with Hypothesis / NCT / FDA / HIPAA -> upload', () => {
  const lines = ['Background'];
  for (let i = 0; i < 8; i++) lines.push('Background paragraph ' + i + ' establishes the prior literature and the unmet clinical need in the population.');
  lines.push('Hypothesis');
  lines.push('Primary hypothesis is that intervention reduces relative risk by a measurable margin in the target cohort.');
  lines.push('Methodology');
  for (let i = 0; i < 8; i++) lines.push('Method line ' + i + ' clinical trial NCT12345678 with inclusion exclusion enrollment plan and statistical power.');
  lines.push('Approach');
  lines.push('FDA IND filing pathway. HIPAA-compliant data handling. IRB# 87654 approved.');
  lines.push('Funding');
  lines.push('NIH R01 $3M five year award supports primary endpoint and secondary endpoint analysis.');
  const text = lines.join('\n');
  const r = classify(text);
  assert.equal(r.features.section_header, true);
  assert.equal(r.features.domain_marker, true);
  assert.ok(r.score >= 3, 'expected score >= 3, got ' + r.score);
  assert.equal(r.path, 'upload');
});

run('F-10 long deck pitch 400 words with Pitch / Solution / Market / Team -> upload', () => {
  const lines = ['Pitch'];
  for (let i = 0; i < 8; i++) lines.push('Pitch slide ' + i + ' outlines the wedge and the why-now and the team and the round structure.');
  lines.push('Solution');
  for (let i = 0; i < 8; i++) lines.push('Solution slide ' + i + ' explains the architecture and the moat and the early traction.');
  lines.push('Market');
  for (let i = 0; i < 8; i++) lines.push('Market slide ' + i + ' explains addressable demand and current incumbents and the timing wedge.');
  lines.push('Team');
  for (let i = 0; i < 8; i++) lines.push('Team slide ' + i + ' explains the founder background and the early hires and the advisor circle.');
  const text = lines.join('\n');
  const r = classify(text);
  assert.equal(r.features.section_header, true);
  assert.ok(r.score >= 3, 'expected score >= 3, got ' + r.score);
  assert.equal(r.path, 'upload');
});

// ---------- F-11..F-15 AMBIGUOUS / FALSE-POSITIVE GUARDS ----------

run('F-11 long conversational stuck-language 350 words no headers no markers -> ambiguous (Pitfall 3)', () => {
  // Long-form prose, single paragraph (low density), stuck-language present, no section headers, no domain markers
  const sentences = [];
  for (let i = 0; i < 15; i++) {
    sentences.push("I keep coming back to whether what we are building is actually the thing the market is asking for or just the thing we want to build because we are good at building it.");
  }
  for (let i = 0; i < 10; i++) {
    sentences.push("I'm trying to be honest with myself about it but the kind of honesty I need is the kind that does not happen in your own head.");
  }
  const text = sentences.join(' ');
  const r = classify(text);
  // word_count > 300 -> +2, density very low -> -1, stuck_language -> -3 = -2 -> 'ambiguous' (NOT upload)
  assert.equal(r.features.stuck_language, true);
  assert.equal(r.features.section_header, false);
  assert.equal(r.features.domain_marker, false);
  assert.notEqual(r.path, 'upload', 'Pitfall 3 false-positive: long prose must NOT classify as upload');
  assert.equal(r.path, 'ambiguous');
});

run('F-12 medium prose 200 words with CEO mention and stuck-language -> ambiguous (Pitfall 3)', () => {
  const lines = [];
  // Single CEO line at top to fire the SECTION_HEADER regex
  lines.push("CEO retrospective notes from the last quarter, written in a conversational voice for myself.");
  for (let i = 0; i < 12; i++) {
    lines.push("I keep coming back to the same set of questions about whether the team is the right team and whether I am the right person to be leading them through what comes next.");
  }
  const text = lines.join(' ');
  const r = classify(text);
  // word_count ~200 -> 0, density low (joined by spaces) -> -1, section_header (CEO) -> +3, stuck_language -> -3 = -1 -> ambiguous
  assert.equal(r.features.section_header, true);
  assert.equal(r.features.stuck_language, true);
  assert.notEqual(r.path, 'upload', 'CEO + stuck-language must NOT classify as upload');
  assert.equal(r.path, 'ambiguous');
});

run('F-13 medium prose 250 words with $1M figure and stuck-language -> ambiguous (Pitfall 3)', () => {
  const sentences = [];
  for (let i = 0; i < 14; i++) {
    sentences.push("I keep coming back to whether a $1M bridge round is the right shape for this moment or whether we should hold off and run leaner for another six months.");
  }
  const text = sentences.join(' ');
  const r = classify(text);
  // word_count ~280 -> 0, density 0 -> -1, domain_marker ($1M) -> +2, stuck_language -> -3 = -2 -> ambiguous
  assert.equal(r.features.domain_marker, true);
  assert.equal(r.features.stuck_language, true);
  assert.notEqual(r.path, 'upload', 'domain_marker + stuck-language must NOT classify as upload');
  assert.equal(r.path, 'ambiguous');
});

run('F-14 borderline ambiguous 200 words pure prose -> ambiguous', () => {
  const sentences = [];
  for (let i = 0; i < 14; i++) {
    sentences.push("Some weeks the venture feels like it is moving and other weeks it feels like sand and the honest answer is that probably both are true at the same time depending on which slice of activity I look at.");
  }
  const text = sentences.join(' ');
  const r = classify(text);
  // word_count > 300 likely -> +2, density 0 -> -1, no other markers = +1 -> ambiguous (or rough)
  // More importantly: not type, not upload
  assert.equal(r.features.stuck_language, false);
  assert.equal(r.features.section_header, false);
  assert.equal(r.features.domain_marker, false);
  assert.equal(r.path, 'ambiguous');
});

run('F-15 borderline ambiguous 100 words formatted but no headers or markers -> ambiguous', () => {
  const lines = [];
  for (let i = 0; i < 15; i++) {
    lines.push('line ' + i + ' some short content here for testing density features without section anchors');
  }
  const text = lines.join('\n');
  const r = classify(text);
  // word_count ~150 -> 0, density high -> +2, no section_header, no domain_marker = +2 -> ambiguous
  assert.equal(r.features.section_header, false);
  assert.equal(r.features.domain_marker, false);
  assert.equal(r.features.stuck_language, false);
  assert.equal(r.path, 'ambiguous');
});

// ---------- Summary ----------

process.stdout.write('\ndual-path-detector: ' + passed + '/' + (passed + failed) + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
