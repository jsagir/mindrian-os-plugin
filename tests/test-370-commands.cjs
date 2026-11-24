'use strict';
// Phase 370 commands test (plan 370-09). It pins the text of commands/grade.md and
// commands/deep-grade.md to the review contract: the render step, the pre-file check,
// and the owner answers O1 and O4A (read from data/review-contract.json, so the test
// is true for any answer the owner gave). Arms C1 to C9. Node built-ins only.
// No network, no Brain call (Canon Part 8).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const H = require('./helpers/review-contract-370.cjs');

const rep = H.reporter('test-370-commands');

const GRADE_PATH = path.join(H.ROOT, 'commands', 'grade.md');
const DEEP_PATH = path.join(H.ROOT, 'commands', 'deep-grade.md');
const GRADE = fs.readFileSync(GRADE_PATH, 'utf8');
const DEEP = fs.readFileSync(DEEP_PATH, 'utf8');

let contract;
try {
  contract = H.realContract();
} catch (e) {
  rep.fatal('cannot read the contract data: ' + e.message);
}
const OA = contract.owner_answers || {};

// The frontmatter block: the lines between the first two lines that are exactly ---,
// joined with a line feed. Pinned from HEAD before plan 370-09 edited any command.
// If a command's frontmatter must change, a later plan updates the pin on purpose.
// Later-phase additive keys are dropped before the hash, so every 370 line stays pinned:
// phase 400 (plan 400-02) adds the job sentence keys on their own lines; plan 400-06 adds the Cynefin label keys.
const LATER_PHASE_KEYS = ['job_when', 'job_want', 'job_so', 'job_sentence_status', 'fits_domains', 'move_type', 'move_type_weak', 'cynefin_label_status'];
const LATER_PHASE_RE = new RegExp('^(' + LATER_PHASE_KEYS.join('|') + '):');
const FM_PIN = {
  'commands/grade.md': '8253efce8f7ccc99bb6caf7bb26454d07f220c50f9f3767841a3bd844d8dddb4',
  'commands/deep-grade.md': '17e942f12d5fddbe28c1c2012406f108d6fb6d86740d5e26e27e1ba99f5d9dfa',
};

function frontmatter(text) {
  const lines = text.split('\n');
  const idx = [];
  for (let i = 0; i < lines.length && idx.length < 2; i++) {
    if (lines[i] === '---') idx.push(i);
  }
  if (idx.length < 2) return null;
  return lines.slice(idx[0] + 1, idx[1]).filter((l) => !LATER_PHASE_RE.test(l)).join('\n');
}

function sha(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

const COMMANDS = [
  ['commands/grade.md', GRADE],
  ['commands/deep-grade.md', DEEP],
];

rep.arm('C1 frontmatter is byte-stable (sha256 pin, plan 370-09)', () => {
  for (const [rel, text] of COMMANDS) {
    const fm = frontmatter(text);
    rep.ok(fm !== null, rel + ' has no frontmatter block');
    rep.eq(sha(fm), FM_PIN[rel], rel + ' frontmatter hash');
  }
});

rep.arm('C2 pre-file check text: wrapper call, retry bound, door reason, fences, mktemp', () => {
  for (const [rel, text] of COMMANDS) {
    rep.ok(text.includes('check-review-contract.cjs" check'), rel + ': no wrapper call in plugin-root form');
    rep.ok(text.includes('${CLAUDE_PLUGIN_ROOT}/scripts/check-review-contract.cjs'), rel + ': wrapper path is not anchored');
    rep.ok(/at most 3/i.test(text), rel + ': no retry bound ("at most 3")');
    rep.ok(text.includes('review_contract_violation'), rel + ': no door refusal reason');
    rep.ok(/code fences?/i.test(text) && /reads?[^.]{0,80}whole body/i.test(text), rel + ': no sentence that the check reads the whole body including code fences');
    rep.ok(text.includes('mktemp'), rel + ': no mktemp scratch file');
    rep.ok(/no `?\.md`? suffix/i.test(text), rel + ': no note that the scratch name has no .md suffix');
    rep.ok(/artifact_file/.test(text), rel + ': no Desktop and Cowork filing door (artifact_file)');
  }
});

rep.arm('C3 both commands name the Review contract section of the grading reference', () => {
  for (const [rel, text] of COMMANDS) {
    rep.ok(text.includes('Review contract'), rel + ': no "Review contract"');
    rep.ok(text.includes('references/methodology/grade.md'), rel + ': no reference path');
    rep.ok(/internal record/i.test(text), rel + ': no "internal record"');
  }
});

rep.arm('C4 next-step pointers are chat only', () => {
  for (const [rel, text] of COMMANDS) {
    rep.ok(/chat only/i.test(text), rel + ': no "chat only"');
    rep.ok(/filed review holds (no|none)/i.test(text), rel + ': no statement that the filed review holds no pointer or command');
  }
});

rep.arm('C5 grade.md follows O1 (' + OA.O1 + ')', () => {
  const has = GRADE.includes('MUST ALWAYS show the scoring table');
  if (OA.O1 === 'WITHHOLD' || OA.O1 === 'GRADE-ONLY') {
    rep.ok(!has, 'the P0 "MUST ALWAYS show the scoring table" text is still in grade.md');
    if (OA.O1 === 'WITHHOLD') {
      rep.ok(GRADE.includes('Scores go in the file header and in chat when the student asks.'), 'grade.md lacks the O1 WITHHOLD sentence');
    }
  } else if (OA.O1 === 'KEEP') {
    rep.ok(has, 'O1 KEEP: the P0 sentence must stay');
  } else {
    throw new Error('unknown O1 answer: ' + OA.O1);
  }
});

rep.arm('C6 grade.md --full: no notes-file name outside the working record, persona per O4A, roll-up is chat only', () => {
  const lines = GRADE.split('\n');
  lines.forEach((l, i) => {
    if (l.includes('REASONING.md')) {
      rep.ok(/working record/i.test(l), 'grade.md line ' + (i + 1) + ' names REASONING.md outside a working-record sentence');
    }
  });
  rep.ok(!/REASONING\.md Health/.test(GRADE), 'the REASONING.md Health block is still in grade.md');
  rep.ok(!/\|\s*REASONING\.md\s*\|/.test(GRADE), 'the REASONING.md column is still in grade.md');
  if (OA.O4A === 'DROP' || OA.O4A === 'NO-NAME') {
    rep.ok(!/Professor[^\n]{0,40}Perspective/.test(GRADE), 'a Professor ... Perspective line is still in grade.md');
    rep.ok(!/Aronhime/.test(GRADE), 'a personal name is still in grade.md');
  }
  rep.ok(lines.some((l) => /roll-up/i.test(l) && /chat only/i.test(l)), 'no roll-up heading line that says chat only');
  rep.ok(/never filed/i.test(GRADE), 'grade.md does not say the roll-up is never filed');
  if (OA.O1 === 'WITHHOLD') {
    rep.ok(!/\|\s*Section\s*\|\s*Score\s*\|/.test(GRADE), 'the section score table is still in grade.md');
  }
});

rep.arm('C7 deep-grade.md: no Sci-Fi, no Visual Synthesis, persona per O4A, pinned sentences kept', () => {
  rep.ok(!/Sci-Fi/.test(DEEP), 'Sci-Fi is still in deep-grade.md');
  rep.ok(!/Visual Synthesis/.test(DEEP), 'Visual Synthesis is still in deep-grade.md');
  if (OA.O4A === 'DROP' || OA.O4A === 'NO-NAME') {
    rep.ok(!/Professor[^\n]{0,40}Perspective/.test(DEEP), 'a Professor ... Perspective line is still in deep-grade.md');
    rep.ok(!/Aronhime/.test(DEEP), 'a personal name is still in deep-grade.md');
  }
  // A small guard beside test-265 (the full test-265 family runs in the plan verify).
  rep.ok(DEEP.includes('consolidatePanel'), 'consolidatePanel was removed');
  rep.ok(/5-component\s+weighted/i.test(DEEP), '5-component weighted was removed');
  rep.ok(/render[\s\S]{0,40}ABOVE the percentage/i.test(DEEP), 'the disputes-above-the-percentage sentence was removed');
  const iCal = DEEP.indexOf('brain_grade_calibrate');
  const iDisp = DEEP.indexOf('Dispatching');
  rep.ok(iCal !== -1 && iDisp !== -1 && iCal < iDisp, 'brain_grade_calibrate must come before the Dispatching block');
});

rep.arm('C8 no em dash or en dash in either command', () => {
  for (const [rel, text] of COMMANDS) {
    rep.ok(text.indexOf(H.EM) === -1, rel + ' holds U+2014');
    rep.ok(text.indexOf(H.EN) === -1, rel + ' holds U+2013');
  }
});

rep.arm('C9 skill mirrors are in step (build-skill-mirrors --check)', () => {
  const r = cp.spawnSync(process.execPath, [path.join(H.ROOT, 'scripts', 'build-skill-mirrors.cjs'), '--check'], {
    cwd: H.ROOT,
    encoding: 'utf8',
  });
  rep.ok(r.status === 0, 'build-skill-mirrors --check exit ' + r.status + ': ' + String(r.stdout || '').split('\n').slice(0, 3).join(' | ') + String(r.stderr || '').split('\n').slice(0, 2).join(' | '));
});

rep.done();
