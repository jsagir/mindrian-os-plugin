'use strict';
// Phase 370 reference drift test (plan 370-07). It pins the prose of references/methodology/grade.md
// and agents/grading.md to data/review-contract.json, so the prose and the data cannot drift apart.
// Arms D1 to D11. Every owner-answer arm branches on owner_answers in the data file, so the test is
// true for any answer the owner gave. Node built-ins only. No network, no Brain call (Canon Part 8).

const fs = require('fs');
const path = require('path');
const H = require('./helpers/review-contract-370.cjs');

const rep = H.reporter('test-370-reference-drift');
const M = H.requireModule(rep);

const REF_PATH = path.join(H.ROOT, 'references', 'methodology', 'grade.md');
const AGENT_PATH = path.join(H.ROOT, 'agents', 'grading.md');
const REF = fs.readFileSync(REF_PATH, 'utf8');
const AGENT = fs.readFileSync(AGENT_PATH, 'utf8');

let contract;
try {
  contract = H.realContract();
} catch (e) {
  rep.fatal('cannot read the contract data: ' + e.message);
}
const OA = contract.owner_answers || {};
const LIMITS = contract.limits || {};

// Line-based fence reader. Returns [{ lang, text, startLine }] for every fenced block.
function fencedBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const m = /^ {0,3}(`{3,}|~{3,})[ \t]*([A-Za-z0-9_-]*)/.exec(lines[i]);
    if (open) {
      if (m && m[1].charAt(0) === open.ch && m[1].length >= open.len && /^[ \t]*$/.test(lines[i].slice(m[0].length - m[2].length))) {
        blocks.push({ lang: open.lang, text: open.buf.join('\n'), startLine: open.line });
        open = null;
      } else {
        open.buf.push(lines[i]);
      }
    } else if (m) {
      open = { ch: m[1].charAt(0), len: m[1].length, lang: m[2], buf: [], line: i + 1 };
    }
  }
  return blocks;
}

// The text under a heading, up to the next heading of the same or higher level.
function sectionText(text, headingLine) {
  const lines = text.split(/\r?\n/);
  const level = /^(#+)/.exec(headingLine)[1].length;
  const start = lines.findIndex((l) => l.trim() === headingLine);
  if (start === -1) return null;
  const out = [];
  let inFence = false;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {0,3}(`{3,}|~{3,})/.test(lines[i])) inFence = !inFence;
    const hm = !inFence && /^(#+)\s/.exec(lines[i]);
    if (hm && hm[1].length <= level) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

const REVIEW_SECTION = sectionText(REF, '## Review contract');

rep.arm('D1 the reference lists the headings in order, then the optional last note', () => {
  rep.ok(REVIEW_SECTION !== null, 'references/methodology/grade.md has no "## Review contract" heading');
  const idx = REVIEW_SECTION.indexOf('Headings, in order');
  rep.ok(idx !== -1, 'the Review contract section has no "Headings, in order" list');
  const items = [];
  for (const l of REVIEW_SECTION.slice(idx).split(/\r?\n/).slice(1)) {
    const m = /^\s*(?:\d+[.)]|[-*])\s+(.*)$/.exec(l);
    if (m) items.push(m[1].trim());
    else if (items.length > 0 && l.trim() === '') break;
  }
  const want = contract.sections.map((s) => s.heading);
  rep.eq(items.slice(0, want.length).join(' | '), want.join(' | '), 'headings differ from the contract sections');
  const tail = contract.optional_tail[0];
  rep.ok(items.length > want.length, 'the optional last note is not listed');
  rep.ok(items[want.length].indexOf(tail.heading) === 0 && /optional/i.test(items[want.length]),
    'the optional last note must name "' + tail.heading + '" and say optional');
});

rep.arm('D2 the counts in the prose equal the counts in the data', () => {
  rep.ok(REVIEW_SECTION !== null, 'no Review contract section');
  const rp = contract.counts.revision_points;
  const cd = contract.counts.cross_domain_ideas;
  const a = 'Revision points: ' + rp.min + ' to ' + rp.max;
  const b = 'Cross-domain ideas in the body: at most ' + cd.max;
  rep.ok(REVIEW_SECTION.indexOf(a) !== -1, 'missing line: ' + a);
  rep.ok(REVIEW_SECTION.indexOf(b) !== -1, 'missing line: ' + b);
});

rep.arm('D3 the length line follows the limits in the data', () => {
  rep.ok(REVIEW_SECTION !== null, 'no Review contract section');
  const keys = Object.keys(LIMITS);
  if (keys.length === 0) {
    rep.ok(REVIEW_SECTION.indexOf('Length: no number is set') !== -1, 'limits is empty, so the prose must say "Length: no number is set"');
    return;
  }
  if (typeof LIMITS.body_words_max === 'number') {
    rep.ok(REVIEW_SECTION.indexOf('at most ' + LIMITS.body_words_max + ' words') !== -1, 'body_words_max not stated');
  }
  if (typeof LIMITS.reflection_questions_max === 'number') {
    rep.ok(REVIEW_SECTION.indexOf('at most ' + LIMITS.reflection_questions_max + ' reflection questions') !== -1, 'reflection_questions_max not stated');
  }
  if (typeof LIMITS.cross_domain_under === 'string' && LIMITS.cross_domain_under) {
    const sec = contract.sections.find((s) => s.id === LIMITS.cross_domain_under);
    rep.ok(sec && REVIEW_SECTION.indexOf(sec.heading) !== -1, 'cross_domain_under section not named');
  }
});

rep.arm('D4 the reader-facing template passes the review check', () => {
  const i = REF.indexOf('## Artifact Template');
  rep.ok(i !== -1, 'no "## Artifact Template" heading');
  const blocks = fencedBlocks(REF.slice(i));
  const first = blocks.find((b) => b.lang === 'markdown');
  rep.ok(first, 'no fenced markdown block after the Artifact Template heading');
  const res = M.checkReview(first.text, { repoRoot: H.ROOT });
  rep.ok(res.ok === true, 'template fails the check: ' + JSON.stringify(res.violations));
  rep.ok(!/Homework/.test(first.text), 'the template still holds a Homework section');
});

rep.arm('D5 static template lint: no fenced block teaches an internal name or a dash', () => {
  const found = [];
  for (const [label, text] of [['references/methodology/grade.md', REF], ['agents/grading.md', AGENT]]) {
    for (const b of fencedBlocks(text)) {
      const res = M.checkReview(b.text, { repoRoot: H.ROOT });
      for (const v of res.violations) {
        if (v.rule === 'internal_name' || v.rule === 'em_dash') {
          found.push(label + ' block@' + b.startLine + ' line ' + v.line + ' ' + v.rule + '/' + v.class);
        }
      }
    }
  }
  rep.ok(found.length === 0, 'denylist hits in fenced blocks: ' + found.join('; '));
});

rep.arm('D6 the agent file no longer teaches the leaked strings', () => {
  const banned = ['Assessor: Grading Agent', 'Assessment Thinking Chain', 'Visual Synthesis', 'Sci-Fi', 'required enrichments'];
  const hit = banned.filter((s) => AGENT.indexOf(s) !== -1);
  rep.ok(hit.length === 0, 'agents/grading.md still holds: ' + hit.join(', '));
});

rep.arm('D7 persona rule follows O4A', () => {
  const re = /Professor [A-Z][a-z]+'s Perspective/;
  if (OA.O4A === 'DROP' || OA.O4A === 'NO-NAME') {
    rep.ok(!re.test(REF), 'the reference holds a named persona line');
    rep.ok(!re.test(AGENT), 'the agent holds a named persona line');
    if (OA.O4A === 'DROP') {
      const i = REF.indexOf('## Artifact Template');
      const first = fencedBlocks(REF.slice(i)).find((b) => b.lang === 'markdown');
      rep.ok(first && !/^>/m.test(first.text), 'the template holds a quote block, but O4A is DROP');
    }
  } else {
    rep.ok(re.test(AGENT) || /Perspective/.test(AGENT), 'O4A is KEEP: the persona line must keep its shape');
  }
});

rep.arm('D8 the score rule follows O1', () => {
  if (OA.O1 === 'WITHHOLD' || OA.O1 === 'GRADE-ONLY') {
    rep.ok(REF.indexOf('MUST appear in EVERY') === -1, 'the reference still says the scoring table MUST appear in EVERY output');
    rep.ok(!/Grading without showing the scoring table/.test(REF), 'the anti-pattern still demands the scoring table');
  } else {
    rep.ok(REF.indexOf('MUST appear in EVERY') !== -1, 'O1 is KEEP: the P0 sentence must stay');
  }
});

rep.arm('D9 pinned strings of test-265 stay in the agent file', () => {
  rep.ok(AGENT.indexOf('Score 5 Rubric Components') !== -1, 'missing "Score 5 Rubric Components"');
  rep.ok(/^###\s*Rubric Scores/m.test(AGENT), 'missing the "### Rubric Scores" table');
  for (const n of ['Vision', 'Problem Definition', 'Feasibility', 'Market', 'Completeness']) {
    rep.ok(new RegExp('\\|\\s*' + n + '\\s*\\|').test(AGENT), 'missing the component row ' + n);
  }
});

rep.arm('D10 the agent points to the Review contract and the project comparison follows O4B', () => {
  rep.ok(AGENT.indexOf('${CLAUDE_PLUGIN_ROOT}/references/methodology/grade.md') !== -1, 'the agent has no plugin-root path to the reference');
  rep.ok(/internal record/i.test(AGENT), 'the agent does not name the internal record');
  rep.ok(AGENT.indexOf('Review contract') !== -1, 'the agent does not name the Review contract section');
  if (OA.O4B === 'ANONYMIZE') {
    rep.ok(AGENT.indexOf('Dental Healthcare submission did') === -1, 'a named project is still used as the comparison frame');
    rep.ok(AGENT.indexOf('higher-scoring submission') !== -1, 'the anonymised comparison frame is missing');
  }
});

rep.arm('D11 the reference states the two layers and the owner rules as plain statements', () => {
  rep.ok(REVIEW_SECTION !== null, 'no Review contract section');
  rep.ok(/internal record/i.test(REVIEW_SECTION), 'the section does not name the internal record');
  rep.ok(/file header/i.test(REVIEW_SECTION), 'the section does not name the file header');
  rep.ok(/plain words/i.test(REVIEW_SECTION), 'the section has no plain-words rule');
  rep.ok(/tool analysis/i.test(REVIEW_SECTION), 'the forbidden tool analysis section is not named');
});

rep.done();
