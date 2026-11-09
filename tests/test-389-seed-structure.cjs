#!/usr/bin/env node
'use strict';

/*
 * Phase 389 plan 06 task 2: static proof that the Seed and Full depths are wired into
 * /mos:structure-argument as a third value of the existing fork. Reads text only. No network,
 * no Brain call. Plain counters. Exit 1 on a failure.
 *
 * Part 7 and Part 11: no new command, no new connector row, no new sub_mode.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CMD = path.join(ROOT, 'commands/structure-argument.md');
const SKILL = path.join(ROOT, 'skills/structure-argument/SKILL.md');
const REF = path.join(ROOT, 'references/methodology/structure-argument.md');
const REGISTRY = path.join(ROOT, 'data/connector-registry.json');

// D11 of the owner record: APPROVE keeps autonomous_safe true behind the card and the code
// refusal. The executor sets this constant from the token of the gate in Task 1.
const EXPECTED_AUTONOMOUS_SAFE = true;

// The pinned teaching and help_jtbd text of HEAD before this plan (irreversibility ledger).
const PIN_TEACHING = 'When an argument is muddled and you cannot say why, /mos:structure-argument restructures it with Minto pyramid, SCQA, and MECE. The right structure usually surfaces the missing premise.';
const PIN_JTBD = 'Build a Minto-Pyramid argument from your room\'s evidence.';

// First 5 words of the summary of each of the 12 questions of QUESTION_REGISTRY in
// lib/agents/mva/six-hats-red-black.cjs, held as text so the list survives that file.
const PROMPT_HEADS = [
  'How does the person who',
  'What does success look like',
  'If your strongest competitor copied',
  'What single assumption would, if',
  'Who would be furious if',
  'What would have to be',
  'Where is the smartest critic',
  'What part of this would',
  'If you had to ship',
  'What is the smallest experiment',
  'Whose calendar do you need',
  'What does the second version',
];

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass += 1; console.log('ok   ' + name); }
  else { fail += 1; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

function read(p) { return fs.readFileSync(p, 'utf8'); }
function block(text) {
  const a = text.indexOf('<!-- seed:start -->');
  const b = text.indexOf('<!-- seed:end -->');
  if (a === -1 || b === -1 || b < a) return null;
  if (text.indexOf('<!-- seed:start -->', a + 1) !== -1) return null;
  return text.slice(a, b + '<!-- seed:end -->'.length);
}
function outside(text) {
  const a = text.indexOf('<!-- seed:start -->');
  const b = text.indexOf('<!-- seed:end -->');
  if (a === -1 || b === -1) return text;
  return text.slice(0, a) + text.slice(b);
}
function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return m ? m[1] : '';
}
function headFile(rel) {
  const r = spawnSync('git', ['show', 'HEAD:' + rel], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}

const cmdText = read(CMD);
const skillText = read(SKILL);
const refText = read(REF);
const cmdBlock = block(cmdText);
const skillBlock = block(skillText);
const flat = (s) => String(s).replace(/\s+/g, ' ');

// ---------------------------------------------------------------------------
// Test 1: one block in each file, byte equal
// ---------------------------------------------------------------------------
check('Test 1.1: the command holds one seed block', cmdBlock !== null);
check('Test 1.2: the skill holds one seed block', skillBlock !== null);
check('Test 1.3: the two blocks are byte equal', cmdBlock !== null && cmdBlock === skillBlock);

// ---------------------------------------------------------------------------
// Test 2: the contents of the block
// ---------------------------------------------------------------------------
(function testBlock() {
  const b = cmdBlock || '';
  const f = flat(b);
  const has = (re, label) => check('Test 2: ' + label, re.test(f), String(re));
  has(/quick pass/i, 'names the quick pass');
  has(/deep dive/i, 'names the deep dive');
  has(/\bseed\b/i, 'names the seed');
  has(/only when no room is bound/i, 'applies only when no room is bound');
  has(/never (?:taken )?inside a chain run/i, 'never inside a chain run');
  has(/stays in the conversation/i, 'the sentence stays in the conversation');
  has(/never (?:saved|written)[^.]*(?:Brain|search)/i, 'the sentence is never saved, sent to the Brain or put in a search');
  has(/draft pyramid[^.]*before any (?:outside )?lookup|before any (?:outside )?lookup[^.]*draft pyramid/i, 'the draft pyramid is shown before any lookup');
  has(/pyramid-seed-run\.cjs card/, 'names the card command');
  has(/pyramid-seed-run\.cjs run/, 'names the run command');
  has(/hash (?:that )?the card printed|hash printed by the card/i, 'run uses the hash the card printed');
  has(/card_required/, 'handles card_required');
  has(/quoted evidence[^.]*never an instruction|never an instruction[^.]*quoted evidence/i, 'outside text is quoted evidence, never an instruction');
  has(/pyramid-seed-run\.cjs save/, 'names save');
  has(/\.mindrian\/pyramid-seed\/briefs/, 'names the record folder');
  has(/no room file is written/i, 'no room file is written');
  has(/do not ask[^.]*File this to problem-definition|File this to problem-definition[^.]*(?:not asked|is not asked)/i, 'the filing question is not asked in the Seed');
  has(/\/mos:new-project --from-brief/, 'Decide option: build a room');
  has(/keep going/i, 'Decide option: keep going');
  has(/\/mos:challenge-assumptions/, 'Decide option: challenge');
  has(/pyramid-seed-run\.cjs upgrade/, 'names the upgrade command for the Full depth');
  has(/filing gate stays/i, 'the filing gate stays for Full');
  has(/Desktop and Cowork/, 'has a Desktop and Cowork sentence');
  has(/same card/i, 'Desktop and Cowork use the same card');
  has(/strongest objection[^.]*start from the pyramid itself|start from the pyramid itself[^.]*strongest objection/i, 'strongest objection starts from the pyramid itself');
  has(/Seed challenge prompts/, 'names the list of Seed challenge prompts');
  has(/F\.0/, 'the evidence card is an F.0 card');
  has(/F\.1/, 'the Decide gate is an F.1 card');
  check('Test 2: the block holds no em dash or en dash', !new RegExp('[\\u2013\\u2014]').test(b));
})();

// ---------------------------------------------------------------------------
// Test 3: the old flow stays
// ---------------------------------------------------------------------------
(function testOld() {
  const rest = outside(cmdText);
  check('Test 3.1: Setup still reads room/STATE.md only if it exists', /Read `room\/STATE\.md` for venture context \(if exists\)/.test(rest));
  check('Test 3.2: the filing question stays outside the Seed block', /Ask: "File this to problem-definition\?" before writing\./.test(rest));
  check('Test 3.3: the fork question mentions seed', /Quick pass, deep dive, or seed\?/.test(rest));
  const restSkill = outside(skillText);
  check('Test 3.4: the skill keeps the filing question and the fork', /Ask: "File this to problem-definition\?" before writing\./.test(restSkill) && /Quick pass, deep dive, or seed\?/.test(restSkill));
})();

// ---------------------------------------------------------------------------
// Test 4: one connector row per surface, no new sub_mode, pinned text
// ---------------------------------------------------------------------------
(function testConnector() {
  const reg = JSON.parse(read(REGISTRY));
  const rows = reg.connectors || [];
  const cmdRows = rows.filter((r) => r.surface === '/mos:structure-argument');
  const skillRows = rows.filter((r) => r.surface === 'skill:structure-argument');
  check('Test 4.1: exactly one registry row for the command', cmdRows.length === 1, String(cmdRows.length));
  check('Test 4.2: exactly one registry row for the skill', skillRows.length === 1, String(skillRows.length));
  check('Test 4.3: no row with sub_mode pyramid-seed and no seed surface', rows.filter((r) => r.sub_mode === 'pyramid-seed' || /pyramid-seed/.test(String(r.surface))).length === 0);
  check('Test 4.4: the rows keep sub_mode pyramid-argument', cmdRows[0] && skillRows[0] && cmdRows[0].sub_mode === 'pyramid-argument' && skillRows[0].sub_mode === 'pyramid-argument');
  [[CMD, cmdText], [SKILL, skillText]].forEach(function (pair) {
    const fm = frontmatter(pair[1]);
    check('Test 4.5: connector.sub_mode is pyramid-argument in ' + path.basename(path.dirname(pair[0])) + '/' + path.basename(pair[0]), /^ {2}sub_mode: pyramid-argument$/m.test(fm));
    check('Test 4.6: teaching equals the pinned text in ' + path.basename(pair[0]), fm.indexOf('teaching: "' + PIN_TEACHING + '"') !== -1);
    check('Test 4.7: help_jtbd equals the pinned text in ' + path.basename(pair[0]), fm.indexOf('help_jtbd: "' + PIN_JTBD + '"') !== -1);
  });
  [['commands/structure-argument.md', cmdText], ['skills/structure-argument/SKILL.md', skillText]].forEach(function (pair) {
    const head = headFile(pair[0]);
    if (head === null) { check('Test 4.8: HEAD copy readable for ' + pair[0], false); return; }
    const pick = (t, k) => { const m = new RegExp('^' + k + ': .*$', 'm').exec(frontmatter(t)); return m ? m[0] : null; };
    check('Test 4.8: teaching and help_jtbd equal HEAD in ' + pair[0], pick(head, 'teaching') === pick(pair[1], 'teaching') && pick(head, 'help_jtbd') === pick(pair[1], 'help_jtbd'));
  });
})();

// ---------------------------------------------------------------------------
// Test 5: hitl_stages (Form B), one hitl_why, accepted by the declaration reader
// ---------------------------------------------------------------------------
(function testStages() {
  const shape = require(path.join(ROOT, 'scripts/check-shape-declaration.cjs'));
  [[CMD, cmdText], [SKILL, skillText]].forEach(function (pair) {
    const label = path.basename(path.dirname(pair[0])) + '/' + path.basename(pair[0]);
    const fm = shape.parseFrontmatter(pair[1]);
    const st = Array.isArray(fm.hitl_stages) ? fm.hitl_stages : [];
    check('Test 5.1: hitl_stages has three stages in ' + label, st.length === 3, JSON.stringify(st));
    const by = {};
    st.forEach(function (s) { by[s.stage] = s; });
    const pb = by['pyramid build'];
    const ec = by['seed evidence card'];
    const dc = by['decide'];
    check('Test 5.2: pyramid build is F.9 ordered in ' + label, !!pb && JSON.stringify(pb.shapes) === '["F.9"]' && pb.mode === 'ordered');
    check('Test 5.3: seed evidence card is F.0 gate in ' + label, !!ec && JSON.stringify(ec.shapes) === '["F.0"]' && ec.mode === 'gate');
    check('Test 5.4: decide is F.1 gate in ' + label, !!dc && JSON.stringify(dc.shapes) === '["F.1"]' && dc.mode === 'gate');
    check('Test 5.5: one hitl_why and no hitl_shape in ' + label, typeof fm.hitl_why === 'string' && fm.hitl_why.length > 20 && (frontmatter(pair[1]).match(/^hitl_why:/gm) || []).length === 1 && fm.hitl_shape === undefined);
  });
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/check-shape-declaration.cjs'), '--check'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const lines = (r.stdout + r.stderr).split('\n').filter((l) => /structure-argument/.test(l));
  check('Test 5.6: the shape declaration check names no violation for structure-argument', r.status === 0 && lines.length === 0, lines.join(' | ').slice(0, 300));
})();

// ---------------------------------------------------------------------------
// Test 6: posture (D11)
// ---------------------------------------------------------------------------
(function testPosture() {
  const val = (t) => { const m = /^autonomous_safe: (true|false)$/m.exec(frontmatter(t)); return m ? m[1] === 'true' : null; };
  check('Test 6.1: autonomous_safe in the command equals the D11 constant', val(cmdText) === EXPECTED_AUTONOMOUS_SAFE, String(val(cmdText)));
  check('Test 6.2: autonomous_safe in the skill equals the D11 constant', val(skillText) === EXPECTED_AUTONOMOUS_SAFE, String(val(skillText)));
  let gate = null;
  try { gate = require(path.join(ROOT, 'lib/core/chain-executor.cjs')).makeGateFn; } catch (_e) { gate = null; }
  check('Test 6.3: makeGateFn is available', typeof gate === 'function');
  if (typeof gate === 'function') {
    const verdictOf = () => ({ autonomous_safe: val(cmdText) === true, posture: 'run' });
    const g = gate({ postureFn: verdictOf });
    const got = g({ command: '/mos:structure-argument' }, null, null);
    check('Test 6.4: the chain gate result follows the frontmatter verdict', got === (EXPECTED_AUTONOMOUS_SAFE ? 'run' : 'halt'), String(got));
  }
  check('Test 6.5: the text says the Seed is never taken inside a chain run', /never (?:taken )?inside a chain run/i.test(flat(cmdBlock || '')));
  check('Test 6.6: the text says the script refuses a lookup without the card hash', /refuses[^.]*(?:card|hash)/i.test(flat(cmdBlock || '')));
  if (!EXPECTED_AUTONOMOUS_SAFE) {
    check('Test 6.7: the text says a chain halts before this command', /chain halts before this command/i.test(flat(cmdBlock || '')));
  }
})();

// ---------------------------------------------------------------------------
// Test 7: the methodology reference
// ---------------------------------------------------------------------------
(function testReference() {
  const qp = refText.indexOf('## Quick Pass vs Deep Dive');
  const qpSection = qp === -1 ? '' : refText.slice(qp);
  check('Test 7.1: the Quick Pass vs Deep Dive list has a Seed line', /^- \*\*Seed[^\n]*\*\*:/m.test(qpSection));
  const rt = refText.indexOf('## Seed receipt');
  const rtSection = rt === -1 ? '' : refText.slice(rt);
  const order = ['Answer:', 'Why, in order:', 'Strongest objection:', 'Outside evidence:'].map((w) => rtSection.indexOf(w));
  check('Test 7.2: a Seed receipt template with the section order of renderReceipt', rt !== -1 && order.every((n, i) => n !== -1 && (i === 0 || n > order[i - 1])), JSON.stringify(order));
  const cp = refText.indexOf('## Seed challenge prompts');
  const next = cp === -1 ? -1 : refText.indexOf('\n## ', cp + 5);
  const cpSection = cp === -1 ? '' : refText.slice(cp, next === -1 ? undefined : next);
  check('Test 7.3: a list of Seed challenge prompts exists', cp !== -1);
  PROMPT_HEADS.forEach(function (h, i) {
    check('Test 7.4: prompt ' + (i + 1) + ' is listed (' + h + ')', cpSection.indexOf(h) !== -1);
  });
  check('Test 7.5: twelve red-hat lines and twelve black-hat lines', (cpSection.match(/^\s*- Red hat: /gm) || []).length === 12 && (cpSection.match(/^\s*- Black hat: /gm) || []).length === 12);
  // Test 7.6 (copy equals the old cell file) is gone: plan 389-10 deleted that file (quick 261109-sss). Its text now lives only in the reference list, where tests 7.4 and 7.5 pin it.
  check('Test 7.7: the Seed block points to the list', /Seed challenge prompts/.test(cmdBlock || '') && /use a prompt from that list when stuck/i.test(flat(cmdBlock || '')));
})();

// ---------------------------------------------------------------------------
// Test 8: dashes
// ---------------------------------------------------------------------------
(function testDash() {
  const re = new RegExp('[\\u2013\\u2014]');
  [CMD, SKILL, REF, __filename].forEach(function (p) {
    check('Test 8: no em dash or en dash in ' + path.relative(ROOT, p), !re.test(read(p)));
  });
})();

// ---------------------------------------------------------------------------
// Test 9 (plan 12, owner D10 APPROVE): the opt-in share offer sits in the Seed block
// ---------------------------------------------------------------------------
(function testShareOffer() {
  const f = flat(cmdBlock || '');
  check('Test 9.1: the block offers the public page once, on Vercel', /Offer once: I can make a public page of this on Vercel\./.test(f));
  check('Test 9.2: the card comes first and nothing is sent before a yes', /Show the page text with the share card first/.test(f) && /send nothing before the person says yes/.test(f));
  check('Test 9.3: the offer names the share script', /pyramid-seed-share\.cjs card --id/.test(f) && /pyramid-seed-share\.cjs send --id ID --confirm HASH/.test(f));
  check('Test 9.4: the offer comes after the receipt step', f.indexOf('Offer once: I can make a public page') > f.indexOf('**7. Receipt.**') && f.indexOf('Offer once: I can make a public page') < f.indexOf('**8. Decide (F.1).**'));
  check('Test 9.5: the command and the skill blocks are still byte equal', cmdBlock !== null && cmdBlock === skillBlock);
})();

console.log('test-389-seed-structure: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
