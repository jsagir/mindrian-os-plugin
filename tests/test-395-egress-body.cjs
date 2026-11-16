#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 395 plan 13: owner ruling 35 (2026-11-16). A "body of text" is 3
 * sentences or more. Text of 1 or 2 sentences is not a body: it is an edge or
 * a sprout, and the edge rules decide it. The rules for every shape stay:
 * credentials, structured identifiers and room-lexicon terms block. The name
 * rule and the private-claim markers stay.
 *
 * Owner ruling 37 (2026-11-16, "cut the paste, send the rest"): a pasted quote,
 * block quote or code block in the question is cut and replaced by the note
 * "[pasted text kept local]"; the rest of the question may go. Credentials,
 * keys, structured identifiers and room-lexicon terms still block, also inside
 * the paste. The hook never rewrites the tool input: a shim-backed route
 * proceeds and the shim cuts; any other Brain route gets exit 2 with the cut
 * input to send once more.
 *
 * Checks:
 *   E1  a 1-sentence generic question is not a body; the guard allows it
 *   E2  a 2-sentence generic question of 46 words is an edge; the guard allows it
 *   E3  a 3-sentence generic question is a body; the guard answers sprouts_required/body_shape
 *   E4  a 1-sentence question with a quoted span is an edge, never a sprout;
 *       classify answers pasted_text and classifyAndCut sends the rest
 *   E5  the sentence-count rule (question marks, abbreviations, initials, list
 *       items, line breaks, a last sentence with no full stop)
 *   E6  3 lines with words are a body; 2 lines are not
 *   E7  2 sentences with a room-lexicon term block as room_content/room_term
 *   E8  2 sentences with a credential or an email block as content_set
 *   E9  2 sentences with an unknown proper name block as sprouts_required/edge_rule
 *   E10 2 sentences with a private-claim marker block (short edge: edge_rule;
 *       long edge: private_marker)
 *   E11 2 sentences with a structured identifier block as room_content/identifier
 *   E12 the PreToolUse hook script: exit 0 for the 2-sentence question, exit 2
 *       for 3 sentences and for a credential
 *   P1  cutPastedText: what is cut, the exact text that is left, linear time
 *   P2  classifyAndCut sends the rest of a question with a pasted quote, a
 *       block quote or a code block; the input object is not changed
 *   P3  a credential, an email, an identifier or a room-lexicon term inside the
 *       paste still blocks, and nothing is cut
 *   P4  the rest is decided by the rules: a name in the rest blocks, a name in
 *       the paste does not; a rest of 3 sentences is a body; a paste alone
 *       stays blocked
 *   P5  the hook: a shim-backed route proceeds with no output; a route with
 *       no shim gets exit 2 with the cut input and no pasted byte; the cut
 *       input then passes; the hook source never names updatedInput
 *   P6  the shim (lib/core/brain-client.cjs ask and smartSearch) sends the cut
 *       text to a loopback capture server and discloses the cut; a credential
 *       in the paste sends nothing
 *
 * Every string is synthetic. No network outside 127.0.0.1: the hook gets
 * MINDRIAN_BRAIN_URL http://127.0.0.1:9 and no key, and P6 uses the loopback
 * capture server of tests/helpers/brain-capture-server.cjs. Every room is
 * under MINDRIAN_ROOMS_HOME (or the system temp folder).
 * No em dash or en dash.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SHAPE_PATH = path.join(REPO, 'lib', 'core', 'part8-sprout-shape.cjs');
const GUARD_PATH = path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs');
const LEXICON_PATH = path.join(REPO, 'lib', 'core', 'part8-room-lexicon.cjs');
const BRAIN_CLIENT_PATH = path.join(REPO, 'lib', 'core', 'brain-client.cjs');
const HOOK = path.join(REPO, 'scripts', 'part8-egress-guard-hook.cjs');

const BASE = process.env.MINDRIAN_ROOMS_HOME || os.tmpdir();
fs.mkdirSync(BASE, { recursive: true });
const TMP = fs.mkdtempSync(path.join(BASE, 't395-13-'));

const shapeMod = require(SHAPE_PATH);
const guard = require(GUARD_PATH);
const lexMod = require(LEXICON_PATH);
const helper = require(path.join(__dirname, 'helpers', 'synthetic-room-db.cjs'));
const capture = require(path.join(__dirname, 'helpers', 'brain-capture-server.cjs'));

const TOOL = 'mcp__plugin_mos_mindrian-brain__brain_ask';
const NO_SHIM_TOOL = 'mcp__theo__brain_ask';
const SR = 'sprouts_required';
const NOTE = '[pasted text kept local]';

let failures = 0;
let passes = 0;
function ok(label) { passes += 1; console.log('ok - ' + label); }
function fail(label, detail) { failures += 1; console.log('FAIL - ' + label + ': ' + detail); }
function check(label, fn) {
  try {
    const problems = [];
    fn(problems);
    if (problems.length) fail(label, problems.join('; '));
    else ok(label);
  } catch (e) {
    fail(label, 'threw ' + (e && e.message ? e.message : String(e)));
  }
}

function shape(s) { return shapeMod.classifyShape(s); }
function verdict(q, roomDir) {
  return guard.classify({ question: q }, { toolName: TOOL, roomDir: roomDir === undefined ? null : roomDir });
}
function cutVerdict(q, roomDir) {
  if (typeof guard.classifyAndCut !== 'function') throw new Error('classifyAndCut is not exported');
  return guard.classifyAndCut({ question: q }, { toolName: TOOL, roomDir: roomDir === undefined ? null : roomDir });
}
function tag(r) { return r.verdict + ' ' + r.class + (r.token_class ? '/' + r.token_class : ''); }
function isAllow(r) { return r.verdict === 'allow'; }
function isSR(r, token) { return r.verdict === 'block' && r.class === SR && r.token_class === token; }

// Synthetic strings (fake secrets built at run time).
const FAKE_KEY = 'sk-' + 'proj-' + 'abcdefghij0123456789ABCDEF';
const FAKE_EMAIL = 'orla.venn' + '@' + 'fennick-demo.example';
const FAKE_ID = 'MOS2026' + 'X7';

// The report case: a generic methodology question of 2 sentences, 46 words.
const Q2_LONG = 'How does the jobs to be done framework help a team separate the functional job from the emotional ' +
  'and social jobs that a customer hires a product for? Which step of the framework should come first when ' +
  'the problem is still ill-defined and no interviews exist?';
const Q1 = 'What is the difference between a reverse salient and a bottleneck in systems thinking?';
const Q2_SHORT = 'What is a reverse salient? How is it found?';
const Q3 = 'What is a reverse salient? How is it found? When should a team use it?';
const Q_QUOTED = 'What does "jobs to be done" mean in practice?';

// Ruling 37 strings. PASTED is a quoted span of 8 words.
const PASTED = 'the pilot ended early after the buyers left';
const Q_PASTE = 'How should a team read this memo? "' + PASTED + '" Which framework fits?';
const Q_PASTE_CUT = 'How should a team read this memo? ' + NOTE + ' Which framework fits?';
const Q_BLOCK = 'Explain this note:\n> ' + PASTED + '\n> and the price review moved to June\nWhich framework fits?';
// Plan 395-13 review CR-01: the cut keeps the line structure (the note stands
// on its own line), so the lines around it stay separate sentences.
const Q_BLOCK_CUT = 'Explain this note:\n' + NOTE + '\nWhich framework fits?';
const Q_CODE = 'What is wrong here?\n```js\nconst total = price * units;\nconsole.log(total)\n```\nWhich method finds the cause?';
const Q_CODE_CUT = 'What is wrong here?\n' + NOTE + '\nWhich method finds the cause?';

// ---- E1 -------------------------------------------------------------------
check('E1 1 sentence is not a body and is allowed', function (p) {
  const s = shape(Q1);
  if (s.sentences !== 1) p.push('sentences ' + s.sentences + ' != 1');
  if (s.kind === 'body') p.push('kind is body');
  const r = verdict(Q1);
  if (!isAllow(r)) p.push('guard ' + tag(r));
});

// ---- E2 -------------------------------------------------------------------
check('E2 2 sentences of 46 words are an edge and are allowed', function (p) {
  const s = shape(Q2_LONG);
  if (s.words !== 46) p.push('words ' + s.words + ' != 46');
  if (s.sentences !== 2) p.push('sentences ' + s.sentences + ' != 2');
  if (s.kind !== 'edge') p.push('kind ' + s.kind + ' != edge');
  const r = verdict(Q2_LONG);
  if (!(isAllow(r) && r.class === 'generic_question')) p.push('guard ' + tag(r) + ' != allow generic_question');
  const r2 = verdict(Q2_SHORT);
  if (!isAllow(r2)) p.push('short 2-sentence guard ' + tag(r2));
});

// ---- E3 -------------------------------------------------------------------
check('E3 3 sentences are a body', function (p) {
  const s = shape(Q3);
  if (s.sentences !== 3) p.push('sentences ' + s.sentences + ' != 3');
  if (s.kind !== 'body') p.push('kind ' + s.kind + ' != body');
  const r = verdict(Q3);
  if (!isSR(r, 'body_shape')) p.push('guard ' + tag(r) + ' != block sprouts_required/body_shape');
  if (shapeMod.BODY_MIN_SENTENCES !== 3) p.push('BODY_MIN_SENTENCES ' + shapeMod.BODY_MIN_SENTENCES + ' != 3');
});

// ---- E4 -------------------------------------------------------------------
check('E4 a quoted span in 1 sentence is an edge, never a sprout; the quote is cut', function (p) {
  const s = shape(Q_QUOTED);
  if (s.quoted !== true) p.push('quoted ' + s.quoted);
  if (s.kind !== 'edge') p.push('kind ' + s.kind + ' != edge');
  if (s.longEdge !== true) p.push('longEdge ' + s.longEdge + ' != true');
  const r = verdict(Q_QUOTED);
  if (!isSR(r, 'pasted_text')) p.push('classify ' + tag(r) + ' != block sprouts_required/pasted_text');
  const c = cutVerdict(Q_QUOTED);
  if (!(isAllow(c.verdict) && c.cut === 1)) p.push('classifyAndCut ' + tag(c.verdict) + ' cut ' + c.cut);
  if (c.payload.question !== 'What does ' + NOTE + ' mean in practice?') p.push('cut text ' + JSON.stringify(c.payload.question));
});

// ---- E5 -------------------------------------------------------------------
check('E5 the sentence-count rule', function (p) {
  const cases = [
    ['', 0],
    ['What is a reverse salient?', 1],
    ['What is a reverse salient? How is it found?', 2],
    ['Is it the first? Or the second? Or the third?', 3],
    ['Explain the framework. Then give an example', 2],
    ['How does a team use e.g. the five whys vs. a fishbone? Which comes first?', 2],
    ['What did the U.S. market teach about the S-curve? How do firms use it?', 2],
    ['How does the model of J. Doe work? What does it add?', 2],
    ['Version 2.0 is out. What changed?', 2],
    ['1. Define the job\n2. Map the steps', 2],
    ['- define the job\n- map the steps\n- find the gaps', 3],
    ['What is SWOT?\nHow is it used?', 2],
    ['line one\n\nline two', 2],
    ['The term is "lean." Why does it matter?', 2],
    ['What is a job? "Hire" is the key word.', 2],
  ];
  cases.forEach(function (c) {
    const n = shape(c[0]).sentences;
    if (n !== c[1]) p.push(JSON.stringify(c[0]) + ' sentences ' + n + ' != ' + c[1]);
  });
});

// ---- E6 -------------------------------------------------------------------
check('E6 3 lines with words are a body; 2 lines are not', function (p) {
  const s = shape('define the job\nmap the steps\nfind the gaps');
  if (s.kind !== 'body') p.push('3 lines: kind ' + s.kind + ' != body');
  const two = shape('define the job\nmap the steps');
  if (two.kind === 'body') p.push('2 lines: kind is body');
});

// ---- E7 -------------------------------------------------------------------
const LEX_ROOM = path.join(TMP, 'rooms', 'gate-lexgen');
check('E7 2 sentences with a room-lexicon term block', function (p) {
  helper.buildRoom(LEX_ROOM, 'gate-lexgen');
  lexMod._resetLexiconCache();
  const q = 'Which framework fits Quillfern Labs? How should the team start?';
  if (shape(q).kind === 'body') p.push('kind is body');
  const r = verdict(q, LEX_ROOM);
  if (!(r.verdict === 'block' && r.class === 'room_content' && r.token_class === 'room_term')) p.push('guard ' + tag(r) + ' != block room_content/room_term');
  lexMod._resetLexiconCache();
  const clean = verdict(Q2_SHORT, LEX_ROOM);
  if (!isAllow(clean)) p.push('clean question in the same room: ' + tag(clean));
});

// ---- E8 -------------------------------------------------------------------
check('E8 2 sentences with a credential or an email block', function (p) {
  const a = verdict('Which framework checks the key ' + FAKE_KEY + '? How is it rotated?');
  if (!(a.verdict === 'block' && a.class === 'content_set')) p.push('key: ' + tag(a));
  const b = verdict('Which framework fits a note to ' + FAKE_EMAIL + '? How should it start?');
  if (!(b.verdict === 'block' && b.class === 'content_set')) p.push('email: ' + tag(b));
});

// ---- E9 -------------------------------------------------------------------
check('E9 2 sentences with an unknown proper name block', function (p) {
  const r = verdict('How should Marrowby Pell plan the pilot? Which framework comes first?');
  if (!isSR(r, 'edge_rule')) p.push('guard ' + tag(r) + ' != block sprouts_required/edge_rule');
});

// ---- E10 ------------------------------------------------------------------
check('E10 2 sentences with a private-claim marker block', function (p) {
  const shortEdge = verdict('Which framework fits our pricing? How should the test start?');
  if (!isSR(shortEdge, 'edge_rule')) p.push('short edge: ' + tag(shortEdge) + ' != sprouts_required/edge_rule');
  const longWord = 'Which framework should a team use to test a proprietary assumption about the functional job before ' +
    'the first interview with a customer? How should the team order the steps of that framework when the ' +
    'problem is still ill-defined, nothing is known yet and the first test has to start soon?';
  const s = shape(longWord);
  if (!(s.kind === 'edge' && s.longEdge === true)) p.push('long edge shape ' + s.kind + ' longEdge ' + s.longEdge);
  const a = verdict(longWord);
  if (!isSR(a, 'private_marker')) p.push('long edge, private word: ' + tag(a) + ' != sprouts_required/private_marker');
  const b = verdict(longWord.replace('a proprietary assumption', 'our onboarding assumption'));
  if (!isSR(b, 'private_marker')) p.push('long edge, our: ' + tag(b) + ' != sprouts_required/private_marker');
  const clean = verdict(longWord.replace('a proprietary assumption', 'an assumption'));
  if (!isAllow(clean)) p.push('long edge without a marker: ' + tag(clean));
});

// ---- E11 ------------------------------------------------------------------
check('E11 2 sentences with a structured identifier block', function (p) {
  const r = verdict('Which framework fits case ' + FAKE_ID + '? How should it start?');
  if (!(r.verdict === 'block' && r.class === 'room_content' && r.token_class === 'identifier')) p.push('guard ' + tag(r) + ' != block room_content/identifier');
});

// ---- E12 ------------------------------------------------------------------
function runHook(question, toolName) {
  const env = Object.assign({}, process.env, {
    HOME: TMP,
    MINDRIAN_ROOMS_HOME: path.join(TMP, 'rooms-hook'),
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
    PART8_FORCE_BRAIN_AVAILABLE: '1',
  });
  delete env.MINDRIAN_BRAIN_KEY;
  const stdin = JSON.stringify({ tool_name: toolName || TOOL, tool_input: { question: question }, session_id: 's395-13' });
  const res = spawnSync(process.execPath, [HOOK], { input: stdin, env: env, encoding: 'utf8', timeout: 30000 });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}
check('E12 the hook script allows 2 sentences and stops 3 sentences and a credential', function (p) {
  const a = runHook(Q2_LONG);
  if (a.status !== 0) p.push('2 sentences: exit ' + a.status + ' != 0');
  const b = runHook(Q3);
  if (b.status !== 2) p.push('3 sentences: exit ' + b.status + ' != 2');
  if (b.stderr.indexOf('sprouts_required') === -1) p.push('3 sentences: stderr has no sprouts_required');
  if (b.stderr.indexOf('reverse salient') !== -1) p.push('3 sentences: stderr echoes the payload');
  const c = runHook('Which framework checks the key ' + FAKE_KEY + '? How is it rotated?');
  if (c.status !== 2) p.push('credential: exit ' + c.status + ' != 2');
});

// ---- P1 -------------------------------------------------------------------
check('P1 cutPastedText cuts each pasted span and leaves the rest', function (p) {
  if (typeof shapeMod.cutPastedText !== 'function') { p.push('cutPastedText is not exported'); return; }
  if (shapeMod.PASTE_NOTE !== NOTE) p.push('PASTE_NOTE ' + JSON.stringify(shapeMod.PASTE_NOTE));
  const cases = [
    [Q_PASTE, Q_PASTE_CUT, 1],
    [Q_BLOCK, Q_BLOCK_CUT, 1],
    [Q_CODE, Q_CODE_CUT, 1],
    ['Fix this ```const a = "one two three four"``` please', 'Fix this ' + NOTE + ' please', 1],
    ['Why does this fail?\n~~~\nan unclosed block\nof code', 'Why does this fail?\n' + NOTE, 1],
    ['Explain:\n"' + PASTED + '"\nWhy?', 'Explain:\n' + NOTE + '\nWhy?', 1],
    ['first\r> a quoted line after a carriage return\r\nWhat is it?', 'first\n' + NOTE + '\nWhat is it?', 1],
    ['Compare "' + PASTED + '" with "the price review moved to June"?', 'Compare ' + NOTE + ' with ' + NOTE + '?', 2],
    ['What is a job? "Hire" is the key word.', 'What is a job? "Hire" is the key word.', 0],
    [Q2_SHORT, Q2_SHORT, 0],
  ];
  cases.forEach(function (c) {
    const r = shapeMod.cutPastedText(c[0]);
    if (r.text !== c[1]) p.push(JSON.stringify(c[0]).slice(0, 40) + ' text ' + JSON.stringify(r.text));
    if (r.count !== c[2]) p.push(JSON.stringify(c[0]).slice(0, 40) + ' count ' + r.count + ' != ' + c[2]);
    if (shape(r.text).quoted !== false) p.push(JSON.stringify(c[0]).slice(0, 40) + ' still quoted');
  });
  const odd = shapeMod.cutPastedText(42);
  if (!(odd.text === '' && odd.count === 0)) p.push('non-string ' + JSON.stringify(odd));
  const big = 'lorem ipsum "dolor sit amet consectetur" > x ``` y '.repeat(20000);
  const t0 = process.hrtime.bigint();
  const r = shapeMod.cutPastedText(big);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (!(r.count > 0)) p.push('1 MB string: nothing cut');
  if (ms >= 1000) p.push('1 MB string took ' + ms.toFixed(0) + ' ms');
});

// ---- P2 -------------------------------------------------------------------
check('P2 classifyAndCut sends the rest of a question with pasted text', function (p) {
  [[Q_PASTE, Q_PASTE_CUT], [Q_BLOCK, Q_BLOCK_CUT], [Q_CODE, Q_CODE_CUT]].forEach(function (pair) {
    const first = verdict(pair[0]);
    if (!isSR(first, 'pasted_text')) p.push('classify ' + JSON.stringify(pair[0]).slice(0, 30) + ': ' + tag(first));
    const input = { question: pair[0] };
    const r = guard.classifyAndCut(input, { toolName: TOOL, roomDir: null });
    if (!(isAllow(r.verdict) && r.verdict.class === 'generic_question')) p.push('rest ' + JSON.stringify(pair[0]).slice(0, 30) + ': ' + tag(r.verdict));
    if (r.cut !== 1) p.push('cut ' + r.cut + ' != 1');
    if (r.payload.question !== pair[1]) p.push('payload ' + JSON.stringify(r.payload.question));
    if (r.payload === input || input.question !== pair[0]) p.push('the input object changed');
  });
  const plain = { question: Q2_SHORT };
  const same = guard.classifyAndCut(plain, { toolName: TOOL, roomDir: null });
  if (!(isAllow(same.verdict) && same.cut === 0 && same.payload === plain)) p.push('no paste: ' + tag(same.verdict) + ' cut ' + same.cut);
});

// ---- P3 -------------------------------------------------------------------
check('P3 a credential, email, identifier or room term inside the paste still blocks', function (p) {
  const key = cutVerdict('What is wrong here?\n```\nconst key = "' + FAKE_KEY + '";\n```\nWhich method finds the cause?');
  if (!(key.verdict.verdict === 'block' && key.verdict.class === 'content_set' && key.cut === 0)) p.push('key in code: ' + tag(key.verdict) + ' cut ' + key.cut);
  const mail = cutVerdict('How should a team read this memo? "send the signed draft to ' + FAKE_EMAIL + ' today" Which framework fits?');
  if (!(mail.verdict.verdict === 'block' && mail.verdict.class === 'content_set' && mail.cut === 0)) p.push('email in quote: ' + tag(mail.verdict) + ' cut ' + mail.cut);
  const id = cutVerdict('Explain this note:\n> case ' + FAKE_ID + ' is still open\nWhich framework fits?');
  if (!(id.verdict.verdict === 'block' && id.verdict.class === 'room_content' && id.verdict.token_class === 'identifier' && id.cut === 0)) p.push('identifier in block quote: ' + tag(id.verdict) + ' cut ' + id.cut);
  lexMod._resetLexiconCache();
  const lex = cutVerdict('How should a team read this memo? "the pilot at Quillfern Labs ended early" Which framework fits?', LEX_ROOM);
  if (!(lex.verdict.verdict === 'block' && lex.verdict.class === 'room_content' && lex.verdict.token_class === 'room_term' && lex.cut === 0)) p.push('room term in quote: ' + tag(lex.verdict) + ' cut ' + lex.cut);
  lexMod._resetLexiconCache();
  const clean = cutVerdict(Q_PASTE, LEX_ROOM);
  if (!(isAllow(clean.verdict) && clean.cut === 1)) p.push('clean paste in the same room: ' + tag(clean.verdict) + ' cut ' + clean.cut);
});

// ---- P4 -------------------------------------------------------------------
check('P4 the rules decide the rest', function (p) {
  const nameOut = cutVerdict('How should Marrowby Pell read this memo? "' + PASTED + '" Which framework fits?');
  if (!(isSR(nameOut.verdict, 'edge_rule') && nameOut.cut === 1)) p.push('name in the rest: ' + tag(nameOut.verdict) + ' cut ' + nameOut.cut);
  const nameIn = cutVerdict('How should a team read this memo? "Marrowby Pell said the pilot ended early" Which framework fits?');
  if (!(isAllow(nameIn.verdict) && nameIn.cut === 1)) p.push('name in the paste: ' + tag(nameIn.verdict) + ' cut ' + nameIn.cut);
  const body = cutVerdict('Explain this note:\n> ' + PASTED + '\nWhat is it? How is it found? When is it used?');
  if (!(isSR(body.verdict, 'body_shape') && body.cut === 1)) p.push('rest of 3 sentences: ' + tag(body.verdict) + ' cut ' + body.cut);
  const only = cutVerdict('> ' + PASTED);
  if (!(isSR(only.verdict, 'pasted_text') && only.cut === 0)) p.push('paste alone: ' + tag(only.verdict) + ' cut ' + only.cut);
  const codeOnly = cutVerdict('```\nconst total = price * units;\n```');
  if (!(isSR(codeOnly.verdict, 'pasted_text') && codeOnly.cut === 0)) p.push('code alone: ' + tag(codeOnly.verdict) + ' cut ' + codeOnly.cut);
});

// ---- P5 -------------------------------------------------------------------
check('P5 the hook: shim route proceeds; other route gets the cut input; no rewrite', function (p) {
  const shim = runHook(Q_PASTE, TOOL);
  if (shim.status !== 0) p.push('shim route: exit ' + shim.status + ' != 0');
  if (shim.stdout.trim() !== '') p.push('shim route: stdout is not empty');
  const other = runHook(Q_PASTE, NO_SHIM_TOOL);
  if (other.status !== 2) p.push('no-shim route: exit ' + other.status + ' != 2');
  if (other.stderr.indexOf('pasted_text') === -1) p.push('no-shim route: stderr has no pasted_text');
  if (other.stderr.indexOf(JSON.stringify({ question: Q_PASTE_CUT })) === -1) p.push('no-shim route: stderr has no cut input');
  if (other.stderr.indexOf(PASTED) !== -1) p.push('no-shim route: stderr echoes the paste');
  const resend = runHook(Q_PASTE_CUT, NO_SHIM_TOOL);
  if (resend.status !== 0) p.push('no-shim resend: exit ' + resend.status + ' != 0');
  const key = runHook('What is wrong here? "the key is ' + FAKE_KEY + ' today" Which method fits?', TOOL);
  if (key.status !== 2) p.push('key in paste, shim route: exit ' + key.status + ' != 2');
  const body = runHook('Explain this note:\n> ' + PASTED + '\nWhat is it? How is it found? When is it used?', NO_SHIM_TOOL);
  if (!(body.status === 2 && body.stderr.indexOf('sprouts_required') !== -1)) p.push('rest of 3 sentences: exit ' + body.status);
  const src = fs.readFileSync(HOOK, 'utf8');
  if (src.indexOf('updatedInput') !== -1) p.push('the hook source names updatedInput');
});

// ---- P6 (async) -----------------------------------------------------------
async function shimChecks() {
  const label = 'P6 the shim sends the cut text and discloses the cut';
  const problems = [];
  let started = null;
  try {
    started = await capture.startCaptureServer();
    process.env.MINDRIAN_BRAIN_URL = started.url;
    delete process.env.MINDRIAN_BRAIN_KEY;
    delete require.cache[BRAIN_CLIENT_PATH];
    const bc = require(BRAIN_CLIENT_PATH);

    capture.resetCaptured();
    const a = await bc.ask(Q_PASTE);
    const sentA = capture.captured.length ? capture.captured[capture.captured.length - 1].arguments.question : null;
    if (sentA !== Q_PASTE_CUT) problems.push('ask sent ' + JSON.stringify(sentA));
    const d = a && a.egress_disclosure;
    if (!(d && d.egress_class === 'pasted_text' && d.disposition === 'sent_without_paste' && d.cut_count === 1 && d.tool === 'brain_ask')) problems.push('ask disclosure ' + JSON.stringify(d));
    if (d && typeof d.reason === 'string' && d.reason.indexOf(PASTED) !== -1) problems.push('the disclosure echoes the paste');

    capture.resetCaptured();
    const b = await bc.ask(Q2_SHORT);
    const sentB = capture.captured.length ? capture.captured[capture.captured.length - 1].arguments.question : null;
    if (sentB !== Q2_SHORT) problems.push('plain ask sent ' + JSON.stringify(sentB));
    if (b && Object.prototype.hasOwnProperty.call(b, 'egress_disclosure')) problems.push('plain ask has a disclosure');

    capture.resetCaptured();
    const c = await bc.smartSearch('reverse salient "' + PASTED + '"', { topK: 3 });
    const sentC = capture.captured.length ? capture.captured[capture.captured.length - 1].arguments.query : null;
    if (sentC !== 'reverse salient ' + NOTE) problems.push('smartSearch sent ' + JSON.stringify(sentC));
    if (!(c && c.egress_disclosure && c.egress_disclosure.tool === 'brain_search')) problems.push('smartSearch disclosure ' + JSON.stringify(c && c.egress_disclosure));

    capture.resetCaptured();
    const e = await bc.ask('What is wrong here? "the key is ' + FAKE_KEY + ' today" Which method fits?');
    if (!(e && e.error === 'egress_blocked' && e.egress_class === 'content_set')) problems.push('key in paste: ' + JSON.stringify(e));
    if (capture.captured.length !== 0) problems.push('key in paste: ' + capture.captured.length + ' wire calls');
  } catch (err) {
    problems.push('threw ' + (err && err.message ? err.message : String(err)));
  } finally {
    if (started) { try { await capture.stopCaptureServer(started.server); } catch (_e) { /* keep going */ } }
  }
  if (problems.length) fail(label, problems.join('; '));
  else ok(label);
}

shimChecks().then(function () {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* keep going */ }
  console.log('\n' + passes + ' passed, ' + failures + ' failed');
  process.exit(failures > 0 ? 1 : 0);
});
