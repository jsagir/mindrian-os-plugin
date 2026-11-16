#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 395 plan 13 review fix (395-13-REVIEW.md, commit 07282e4ec). Canon
 * Part 8: user room content never reaches the Brain. Each arm below is a probe
 * string of the review (scratchpad r13, p01 to p12, and the OLD-block /
 * NEW-allow rows of p03). Each arm must hold after the fix:
 *   block    the guard refuses the call and nothing goes on the wire
 *   cut      the guard cuts the paste, the rest goes, and no secret byte of
 *            the paste is on the wire
 *   noLeak   block or cut; no secret byte is on the wire
 *
 * Owner rulings in force: (35) a body of text is 3 sentences or more; (37) cut
 * the paste, send the rest; (2026-11-16, WR-04) a text of 1 or 2 sentences
 * that is longer than 4000 characters is a body.
 *
 * Arms:
 *   L01 CR-01 the cut never joins lines into fewer sentences (p01)
 *   L02 CR-05, CR-06 sentence-count evasion (p02)
 *   L03 the p03 rows (OLD block, NEW allow, and the quote and code forms)
 *   L04 CR-02 fence length and nesting (p04)
 *   L05 WR-03 linear time: 80000 quotes and closers under 200 ms (p05)
 *   L06 the hook on each route (p06)
 *   L07 CR-03 stray and nested quotes (p07)
 *   L08 WR-02 the long-edge private-marker rule after the cut (p08)
 *   L10 CR-04 non-Latin text and the typed-question fast path (p10)
 *   L11 the hook on the direct connector (p11)
 *   L12 CR-06 long undercount forms (p12)
 *   L13 WR-04 the 4000-character cap
 *   L14 WR-05 unclosed forms fail closed
 *   L15 WR-06 the hook does not trust a server name alone on the paste branch
 *   L16 IN-02 the hook records the final verdict, after the paste branch
 *   L17 the wire: brain.ask sends no secret byte for every arm above
 *   L18 no regression: generic questions keep their sentence count
 *
 * Every string is synthetic. No network: globalThis.fetch is a stub that
 * records each tools/call (the same stub as the review probes), and the hook
 * gets MINDRIAN_BRAIN_URL http://127.0.0.1:9 and no key.
 * No em dash or en dash.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SHAPE_PATH = path.join(REPO, 'lib', 'core', 'part8-sprout-shape.cjs');
const GUARD_PATH = path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs');
const BRAIN_CLIENT_PATH = path.join(REPO, 'lib', 'core', 'brain-client.cjs');
const HOOK = path.join(REPO, 'scripts', 'part8-egress-guard-hook.cjs');

const BASE = process.env.MINDRIAN_ROOMS_HOME || os.tmpdir();
fs.mkdirSync(BASE, { recursive: true });
const TMP = fs.mkdtempSync(path.join(BASE, 't395-13-leaks-'));

// The wire stub. It is set before brain-client.cjs loads.
const wire = [];
globalThis.fetch = async function (url, init) {
  let body = null;
  try { body = JSON.parse(init && init.body); } catch (_) { body = init && init.body; }
  if (body && body.method === 'tools/call') wire.push(body.params);
  const isInit = body && body.method === 'initialize';
  const payload = isInit
    ? { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2024-11-05', capabilities: {} } }
    : { jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: JSON.stringify({ answer: 'ok', directive: { guided: {} } }) }] } };
  return new Response('event: message\ndata: ' + JSON.stringify(payload) + '\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
};

const shapeMod = require(SHAPE_PATH);
const guard = require(GUARD_PATH);
const brain = require(BRAIN_CLIENT_PATH);

const TOOL = 'brain_ask';
const SHIM_TOOL = 'mcp__plugin_mos_mindrian-brain__brain_ask';
const DIRECT_TOOL = 'mcp__pws-brain-mcp__brain_ask';
const THEO_TOOL = 'mcp__theo__brain_ask';
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
function tag(r) { return r.verdict + ' ' + r.class + (r.token_class ? '/' + r.token_class : ''); }

// Each case: [name, text, expect, secrets]. expect is block, cut or noLeak.
const CASES = [];
function add(arm, name, text, expect, secrets) { CASES.push({ arm: arm, name: name, text: text, expect: expect, secrets: secrets }); }

function cutOf(text, tool) {
  const key = tool === 'brain_search' ? 'query' : 'question';
  return guard.classifyAndCut({ [key]: text }, { toolName: tool || TOOL, roomDir: null });
}

function judge(c, p) {
  const r = cutOf(c.text);
  const sent = r.verdict.verdict === 'allow' ? r.payload.question : null;
  const leaked = sent === null ? [] : c.secrets.filter(function (s) { return sent.indexOf(s) !== -1; });
  const label = c.name;
  if (leaked.length) { p.push(label + ': secret on the sent text ' + JSON.stringify(leaked[0]) + ' (' + tag(r.verdict) + ')'); return; }
  if (c.expect === 'block' && r.verdict.verdict !== 'block') p.push(label + ': ' + tag(r.verdict) + ' != block');
  if (c.expect === 'cut' && !(r.verdict.verdict === 'allow' && r.cut > 0)) p.push(label + ': ' + tag(r.verdict) + ' cut ' + r.cut + ' != allow with a cut');
}

// ---- L01 (p01) -----------------------------------------------------------
const F01 = [
  'the client board plans to fire the founder after the audit',
  'the lead investor wants out before the next round closes',
  'the clinic pilot failed and nobody told the regulator',
];
const S01 = ['fire the founder', 'lead investor', 'clinic pilot'];
add('L01', 'p01 control', F01.join('\n') + '\nwhich framework fits', 'block', S01);
add('L01', 'p01 blockquote', F01[0] + '\n> see note\n' + F01[1] + '\n> see note\n' + F01[2] + '\nwhich framework fits', 'block', S01);
add('L01', 'p01 fence', F01[0] + '\n```\nx\n```\n' + F01[1] + '\n```\ny\n```\n' + F01[2] + '\nwhich framework fits', 'block', S01);
add('L01', 'p01 quoteLine', F01[0] + '\n"one two three four"\n' + F01[1] + '\n"five six seven eight"\n' + F01[2] + '\nwhich framework fits', 'block', S01);

// ---- L02 (p02) -----------------------------------------------------------
const S02 = ['founder', 'investor', 'regulator'];
const P02 = {
  control: 'the board plans to fire the founder after the audit. the lead investor wants out before the round. the clinic pilot failed and nobody told the regulator. which framework fits?',
  noSpace: 'the board plans to fire the founder after the audit.the lead investor wants out before the round.the clinic pilot failed and nobody told the regulator.which framework fits?',
  digitStart: 'the board will fire the founder after the audit. 40 staff were let go last week. 3 vendors quit and nobody told the regulator. which framework fits?',
  abbrevEnd: 'the board said no. the lead investor wants out before the round etc. the clinic pilot failed in the U.S. the regulator was not told. which framework fits?',
  initialEnd: 'the board picked option B. the investor wants plan C. the clinic pilot failed on vitamin D. which framework fits?',
  semicolons: 'the board plans to fire the founder after the audit; the lead investor wants out before the round; the clinic pilot failed; nobody told the regulator; which framework fits?',
  fullwidth: 'the board plans to fire the founder． the lead investor wants out before the round． the pilot failed and nobody told the regulator． which framework fits？',
  ellipsisChar: 'the board plans to fire the founder… the lead investor wants out before the round… the pilot failed and nobody told the regulator… which framework fits',
  lineSep: 'the board plans to fire the founder after the audit the lead investor wants out before the round the pilot failed and nobody told the regulator which framework fits',
  nel: 'the board plans to fire the founder after the audit\u0085the lead investor wants out before the round\u0085the pilot failed and nobody told the regulator\u0085which framework fits',
  paraSep: 'the board plans to fire the founder after the audit the lead investor wants out before the round the pilot failed and nobody told the regulator which framework fits',
  tabsAsBreaks: 'the board plans to fire the founder after the audit\t\tthe lead investor wants out before the round\t\tthe pilot failed and nobody told the regulator\t\twhich framework fits',
  noSpaceCapital: 'The board plans to fire the founder after the audit.The lead investor wants out before the round.The pilot failed.Which framework fits?',
  ideographicLatin: 'the board plans to fire the founder。the lead investor wants out before the round。the pilot failed and nobody told the regulator。which framework fits',
};
Object.keys(P02).forEach(function (k) { add('L02', 'p02 ' + k, P02[k], 'block', S02); });
add('L02', 'p02 cjk', '董事会计划在审计后解雇创始人。主要投资者想在下一轮之前退出。诊所试点失败了，没有人告诉监管机构。哪个框架适合？', 'block', ['创始人']);
add('L02', 'p02 hebrew', 'הדירקטוריון מתכנן לפטר את המייסד אחרי הביקורת. המשקיע הראשי רוצה לצאת לפני הסבב. הפיילוט במרפאה נכשל. איזו מסגרת מתאימה?', 'block', ['המייסד']);

// ---- L03 (p03 rows) --------------------------------------------------------
const F03 = ['the board plans to fire the founder after the audit', 'the lead investor wants out before the next round closes', 'the clinic pilot failed and nobody told the regulator'];
const S03 = ['fire the founder', 'lead investor', 'fireFounder', 'investor.exit', 'founder after the audit'];
add('L03', 'p03 blockquoteMerge', F03[0] + '\n> see note\n' + F03[1] + '\n> see note\n' + F03[2] + '\nwhich framework fits', 'block', S03);
add('L03', 'p03 noSpace', F03.join('.') + '.which framework fits?', 'block', S03);
add('L03', 'p03 fullwidth', F03.join('． ') + '． which framework fits？', 'block', S03);
add('L03', 'p03 lineSep', F03.join(' ') + ' which framework fits', 'block', S03);
add('L03', 'p03 quoteHasNote', 'explain "one two three four" and "' + NOTE + ' five six seven" ok', 'noLeak', ['one two three four', 'five six seven']);
add('L03', 'p03 singleQuote', "explain this text 'the board plans to fire the founder after the audit and the lead investor wants out' with a framework?", 'cut', S03);
add('L03', 'p03 guillemet', 'explain this text «the board plans to fire the founder after the audit and the lead investor wants out» with a framework?', 'cut', S03);
add('L03', 'p03 lowQuote', 'explain this text „the board plans to fire the founder after the audit and the lead investor wants out“ with a framework?', 'cut', S03);
add('L03', 'p03 singleSmart', 'explain this text ‘the board plans to fire the founder after the audit and the lead investor wants out’ with a framework?', 'cut', S03);
add('L03', 'p03 fullwidthQuote', 'explain this text ＂the board plans to fire the founder after the audit and the lead investor wants out＂ with a framework?', 'cut', S03);
add('L03', 'p03 guillemetSpaced', 'explain this text « the board plans to fire the founder after the audit » with a framework?', 'cut', S03);
add('L03', 'p03 inlineCode', 'explain this snippet `const board = fireFounder(afterAudit); investor.exit(beforeRound)` with a framework?', 'cut', S03);
add('L03', 'p03 inlineCode2', 'explain this snippet ``const board = fireFounder(afterAudit)`` with a framework?', 'cut', S03);
add('L03', 'p03 indentedCode', 'explain this code with a framework\n    board.fireFounder(afterAudit)\n    investor.exit(beforeRound)', 'cut', S03);
add('L03', 'p03 tabIndentedCode', 'explain this code with a framework\n\tboard.fireFounder(afterAudit)', 'cut', S03);
add('L03', 'p03 htmlPre', 'explain this with a framework <pre>board.fireFounder(afterAudit); investor.exit(beforeRound)</pre>', 'cut', S03);
add('L03', 'p03 htmlCode', 'explain this with a framework <code>board.fireFounder(afterAudit)</code> please', 'cut', S03);
add('L03', 'p03 sixTickFence', 'explain this with a framework ``````\nthe board plans to fire the founder after the audit\n`````` thanks', 'cut', S03);
add('L03', 'p03 nestedFence4', 'explain this with a framework\n````md\n```js\nthe board plans to fire the founder after the audit\n```\n````\nthanks', 'noLeak', S03);

// ---- L04 (p04) -----------------------------------------------------------
const SECRET4 = 'boardPlan fireFounderAfterAudit investorExit';
const S04 = ['fireFounderAfterAudit', 'boardPlan', 'investorExit'];
add('L04', 'p04 sixTick', 'explain this with a framework ``````\n' + SECRET4 + '\n`````` thanks', 'cut', S04);
add('L04', 'p04 sixTickOneLine', 'explain with a framework `````` ' + SECRET4 + ' `````` thanks', 'cut', S04);
add('L04', 'p04 fiveTick', 'explain with a framework ````` ' + SECRET4 + ' ``` still code ````` thanks', 'cut', S04);
add('L04', 'p04 nested4', 'explain with a framework ````md ```js ' + SECRET4 + ' ``` ```` thanks', 'cut', S04);
add('L04', 'p04 nested4ml', 'explain with a framework\n````md\n```js\n' + SECRET4 + '\n```\n````', 'noLeak', S04);
add('L04', 'p04 tildeInBacktick', 'explain with a framework ``` a ~~~ b ``` and ~~~ ' + SECRET4 + ' ~~~', 'noLeak', S04);
add('L04', 'p04 tildeNested', 'explain with a framework ~~~~ ~~~ ' + SECRET4 + ' ~~~ ~~~~ thanks', 'cut', S04);
add('L04', 'p04 unclosed6', 'explain with a framework ``````\n' + SECRET4 + '\n``` not a close', 'noLeak', S04);

// ---- L07 (p07) -----------------------------------------------------------
const P07 = 'the board plans to fire the founder after the audit and the investor exits';
const S07 = ['fire the founder', 'investor exits', 'no deal', 'fire founder', 'now'];
add('L07', 'p07 strayInch', 'for a 5" screen product, explain this note "' + P07 + '" with which framework?', 'block', S07);
add('L07', 'p07 nestedInner', 'explain this note "the board said "no deal" then it plans to fire the founder after the audit" with which framework?', 'noLeak', S07);
add('L07', 'p07 nestedFrag', 'explain "fire founder "now" after audit investor exits before round closes" with a framework?', 'noLeak', S07);
add('L07', 'p07 mixedSmartStraight', 'explain “the board plans to fire the founder" with which framework?', 'noLeak', S07);
add('L07', 'p07 oddQuote', 'explain this note "' + P07 + ' with which framework?', 'block', S07);

// ---- L08 (p08) -----------------------------------------------------------
add('L08', 'p08 ourQuote', 'our onboarding flow loses half the trial accounts before day three, so explain "one two three four" with which framework?', 'block', ['onboarding flow', 'trial accounts']);
add('L08', 'p08 ourNoQuoteLong', 'our onboarding flow loses half the trial accounts before day three and the sales cycle keeps growing and the support queue is long and the founders disagree about the roadmap and the next release keeps slipping, so explain with which framework we should start this work today?', 'block', ['onboarding flow']);
add('L08', 'p08 proprietaryQuote', 'the proprietary pricing model we keep secret fails in the clinic channel, explain "one two three four" with which framework?', 'block', ['pricing model', 'clinic channel']);

// ---- L10 (p10) -----------------------------------------------------------
add('L10', 'p10 hebrewPaste', 'הסבר את הטקסט "הדירקטוריון מתכנן לפטר את המייסד אחרי הביקורת והמשקיע רוצה לצאת" עם איזו מסגרת?', 'noLeak', ['המייסד', 'הדירקטוריון']);
add('L10', 'p10 cyrillicPaste', 'объясни текст "совет директоров уволит основателя после аудита" какой метод?', 'noLeak', ['основателя', 'аудита']);
add('L10', 'p10 cjk3', '董事会计划在审计后解雇创始人。主要投资者想在下一轮之前退出。诊所试点失败了，没有人告诉监管机构。哪个框架适合？', 'block', ['创始人']);

// ---- L12 (p12) -----------------------------------------------------------
const F12 = ['the board plans to fire the founder after the audit next month', 'the lead investor wants out before the next round closes in spring', 'the clinic pilot failed badly and nobody told the regulator about it', 'the head of sales is leaving for a direct competitor soon'];
const S12 = ['fire the founder', 'lead investor', 'clinic pilot'];
add('L12', 'p12 noSpace40', F12.join('.') + '.which framework fits?', 'block', S12);
add('L12', 'p12 digitStart40', F12[0] + '. 40 staff were let go last week and morale is very low now. 3 vendors quit and ' + F12[2] + '. which framework fits?', 'block', S12);
add('L12', 'p12 lineSep40', F12.join(' ') + ' which framework fits', 'block', S12);
add('L12', 'p12 fullwidth40', F12.join('． ') + '． which framework fits？', 'block', S12);

// ---- L13 (WR-04) -----------------------------------------------------------
const LONG1 = 'Which framework fits a team that ' + 'reviews the plan and the budget and the hiring and the launch '.repeat(70) + 'before the audit?';
add('L13', 'WR-04 1 sentence over 4000 characters', LONG1, 'block', ['reviews the plan']);
add('L13', 'WR-04 2 sentences over 4000 characters', 'the board plans to fire the founder and ' + 'the investor wants out and the pilot failed and '.repeat(90) + 'nobody told the regulator. Which framework fits?', 'block', ['fire the founder']);
add('L13', 'WR-04 p03 longTwoSentence x 15', ('the board plans to fire the founder after the audit and the lead investor wants out before the next round closes and the clinic pilot failed and nobody told the regulator and the head of sales is leaving for a competitor and the payroll is late again and the landlord sent a final notice and ').repeat(15) + 'so which framework fits? it is urgent.', 'block', ['fire the founder']);

// ---- L14 (WR-05 unclosed) -------------------------------------------------
add('L14', 'WR-05 unclosed backtick', 'explain this snippet `const board = fireFounder(afterAudit) with which framework?', 'block', ['fireFounder']);
add('L14', 'WR-05 unclosed pre', 'explain this with a framework <pre>board.fireFounder(afterAudit) investor.exit()', 'noLeak', ['fireFounder']);
add('L14', 'WR-05 unclosed guillemet', 'explain this text «the board plans to fire the founder after the audit with a framework?', 'block', ['fire the founder']);
add('L14', 'WR-05 unclosed smart quote', 'explain this text “the board plans to fire the founder after the audit with a framework?', 'block', ['fire the founder']);

// ---- run the guard arms --------------------------------------------------
['L01', 'L02', 'L03', 'L04', 'L07', 'L08', 'L10', 'L12', 'L13', 'L14'].forEach(function (arm) {
  const rows = CASES.filter(function (c) { return c.arm === arm; });
  rows.forEach(function (c) {
    check(arm + ' ' + c.name + ' (' + c.expect + ')', function (p) { judge(c, p); });
  });
});

// A body of the L02 forms must count 3 or more sentences (not a side rule).
check('L02 sentence count of the evasion forms is 3 or more', function (p) {
  Object.keys(P02).forEach(function (k) {
    const s = shapeMod.classifyShape(P02[k]);
    if (!(s.sentences >= 3 && s.kind === 'body')) p.push(k + ' sentences ' + s.sentences + ' kind ' + s.kind);
  });
});

// ---- L05 (WR-03) timing ---------------------------------------------------
check('L05 80000 quotes and closers under 200 ms each (shape and cut)', function (p) {
  const n = 80000;
  const inputs = {
    closersRun: 'a.' + '"'.repeat(n) + ' 1',
    manyQuotes: '"'.repeat(n),
    parenRun: 'a.' + ')'.repeat(n) + ' 1',
    closersThenSpace: 'a.' + ')'.repeat(n) + ' ' + ')'.repeat(n),
    openersRun: 'a. ' + '('.repeat(n) + '1',
    spacesNoLetter: 'a.' + ' '.repeat(n) + '1',
    dots: '. '.repeat(n),
    fences: '```'.repeat(n),
    blockquoteLines: '> a\n'.repeat(n),
    tabs: 'a' + ' \t'.repeat(n) + 'b',
    dottedToken: 'a.'.repeat(n),
    smartQuotes: '“'.repeat(n),
    singleQuotes: "'".repeat(n),
    backticks: '`'.repeat(n),
  };
  Object.keys(inputs).forEach(function (k) {
    const s = inputs[k];
    let t0 = process.hrtime.bigint();
    shapeMod.classifyShape(s);
    const shapeMs = Number(process.hrtime.bigint() - t0) / 1e6;
    t0 = process.hrtime.bigint();
    shapeMod.cutPastedText(s);
    const cutMs = Number(process.hrtime.bigint() - t0) / 1e6;
    if (shapeMs >= 200) p.push(k + ' classifyShape ' + shapeMs.toFixed(0) + ' ms');
    if (cutMs >= 200) p.push(k + ' cutPastedText ' + cutMs.toFixed(0) + ' ms');
  });
  ['closersRun', 'manyQuotes'].forEach(function (k) {
    const t0 = process.hrtime.bigint();
    const r = guard.classifyAndCut({ question: inputs[k] }, { toolName: TOOL, roomDir: null });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (ms >= 200) p.push(k + ' classifyAndCut ' + ms.toFixed(0) + ' ms');
    if (r.verdict.verdict !== 'block') p.push(k + ' classifyAndCut ' + tag(r.verdict));
  });
});

// ---- hook helper ---------------------------------------------------------
function runHook(toolName, input) {
  const env = {
    PATH: process.env.PATH,
    HOME: TMP,
    MINDRIAN_ROOMS_HOME: path.join(TMP, 'rooms-hook'),
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
    PART8_FORCE_BRAIN_AVAILABLE: '1',
  };
  const t0 = Date.now();
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: toolName, tool_input: input, session_id: 's395-13-leaks' }),
    env: env, encoding: 'utf8', timeout: 30000,
  });
  return { status: res.status, stderr: res.stderr || '', stdout: res.stdout || '', ms: Date.now() - t0 };
}

// ---- L06 (p06) -----------------------------------------------------------
check('L06 the hook stops the merge, the 6-mark fence leak and the slow input', function (p) {
  const merge = F03[0] + '\n> see note\n' + F03[1] + '\n> see note\n' + F03[2] + '\nwhich framework fits';
  const fence6 = 'explain with a framework\n``````\n' + SECRET4 + '\n``````';
  const rows = [
    ['shim merge', SHIM_TOOL, { question: merge }],
    ['direct merge', DIRECT_TOOL, { question: merge }],
    ['theo fence6', THEO_TOOL, { question: fence6 }],
    ['direct slow', DIRECT_TOOL, { question: 'a.' + '"'.repeat(60000) + ' 1' }],
    ['theo typed search', 'mcp__theo__search', { query: merge }],
    ['direct typed search', 'mcp__pws-brain-mcp__search', { query: merge }],
  ];
  rows.forEach(function (row) {
    const r = runHook(row[1], row[2]);
    if (r.status !== 2) p.push(row[0] + ': exit ' + r.status + ' != 2');
    ['fire the founder', 'lead investor', 'fireFounderAfterAudit', 'boardPlan'].forEach(function (s) {
      if (r.stderr.indexOf(s) !== -1) p.push(row[0] + ': stderr holds ' + JSON.stringify(s));
    });
    if (r.ms > 4000) p.push(row[0] + ': ' + r.ms + ' ms');
  });
});

// ---- L11 (p11) -----------------------------------------------------------
check('L11 the hook on the direct connector stops each leak probe', function (p) {
  const rows = {
    abbrevEnd: P02.abbrevEnd,
    initialEnd: P02.initialEnd,
    hebrewPaste: CASES.filter(function (c) { return c.name === 'p10 hebrewPaste'; })[0].text,
    strayInch: 'for a 5" screen product, explain this note "the board plans to fire the founder after the audit and the investor exits" with which framework?',
  };
  Object.keys(rows).forEach(function (k) {
    const r = runHook(DIRECT_TOOL, { question: rows[k] });
    if (r.status !== 2) p.push(k + ': exit ' + r.status + ' != 2');
    ['fire the founder', 'investor wants', 'vitamin', 'המייסד'].forEach(function (s) {
      if (r.stderr.indexOf(s) !== -1) p.push(k + ': stderr holds ' + JSON.stringify(s));
    });
  });
});

// ---- L15 (WR-06) -----------------------------------------------------------
check('L15 the paste branch does not trust a server name alone', function (p) {
  const q = 'How should a team read this memo? "the pilot ended early after the buyers left" Which framework fits?';
  const own = runHook(SHIM_TOOL, { question: q });
  if (own.status !== 0) p.push('own plugin shim: exit ' + own.status + ' != 0');
  ['mcp__mindrian-brain__brain_ask', 'mcp__plugin_other_mindrian-brain__brain_ask'].forEach(function (name) {
    const r = runHook(name, { question: q });
    if (r.status !== 2) p.push(name + ': exit ' + r.status + ' != 2');
    if (r.stderr.indexOf('pilot ended early') !== -1) p.push(name + ': stderr echoes the paste');
    if (r.stderr.indexOf(NOTE) === -1) p.push(name + ': stderr has no cut input');
  });
});

// ---- L16 (IN-02) -----------------------------------------------------------
check('L16 the hook records the verdict after the paste branch', function (p) {
  const src = fs.readFileSync(HOOK, 'utf8');
  const cutAt = src.indexOf('guard.classifyAndCut(toolInput');
  const recAt = src.indexOf('bestEffortRecord(verdictObj');
  if (cutAt === -1 || recAt === -1) { p.push('anchor not found'); return; }
  if (recAt < cutAt) p.push('bestEffortRecord runs before classifyAndCut');
  if (src.indexOf('updatedInput') !== -1) p.push('the hook source names updatedInput');
});

// ---- L18 no regression ----------------------------------------------------
check('L18 generic questions keep their sentence count', function (p) {
  const rows = [
    ['How does a team use e.g. the five whys vs. a fishbone? Which comes first?', 2],
    ['What did the U.S. market teach about the S-curve? How do firms use it?', 2],
    ['How does the model of J. Doe work? What does it add?', 2],
    ['Version 2.0 is out. What changed?', 2],
    ['Explain the jobs to be done framework.', 1],
    ['What is SWOT; how is it used?', 2],
    ['What is the five whys method, and when should a team use it?', 1],
    ['Compare "Five Forces" with "Blue Ocean"?', 1],
    ['מה זה צה"ל ומה זה ארה"ב?', 1],
  ];
  rows.forEach(function (r) {
    const n = shapeMod.classifyShape(r[0]).sentences;
    if (n !== r[1]) p.push(JSON.stringify(r[0]) + ' sentences ' + n + ' != ' + r[1]);
  });
  const allow = [
    'What does "jobs to be done" mean in practice?',
    'How does the jobs to be done framework help a team separate the functional job from the emotional and social jobs?',
    'מה זה צה"ל ומה זה ארה"ב?',
  ];
  allow.forEach(function (q) {
    const r = cutOf(q);
    if (r.verdict.verdict !== 'allow') p.push(JSON.stringify(q) + ' ' + tag(r.verdict));
  });
});

// ---- L17 (async): the wire -----------------------------------------------
async function wireChecks() {
  const label = 'L17 brain.ask sends no secret byte for every arm';
  const problems = [];
  for (let i = 0; i < CASES.length; i += 1) {
    const c = CASES[i];
    wire.length = 0;
    let r = null;
    try { r = await brain.ask(c.text); } catch (e) { problems.push(c.name + ': threw ' + (e && e.message)); continue; }
    const sent = wire.map(function (w) { return JSON.stringify(w.arguments || {}); }).join('\n');
    c.secrets.forEach(function (s) {
      if (sent.indexOf(JSON.stringify(s).slice(1, -1)) !== -1) problems.push(c.name + ': wire holds ' + JSON.stringify(s));
    });
    if (c.expect === 'block' && wire.length !== 0) problems.push(c.name + ': ' + wire.length + ' wire calls for a block');
    const d = r && r.egress_disclosure;
    if (d && d.disposition === 'sent_without_paste' && wire.length === 0) problems.push(c.name + ': a cut disclosure with no wire call');
  }
  if (problems.length) fail(label, problems.slice(0, 12).join('; ') + (problems.length > 12 ? ' (+' + (problems.length - 12) + ' more)' : ''));
  else ok(label);
}

wireChecks().then(function () {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* keep going */ }
  console.log('\n' + passes + ' passed, ' + failures + ' failed');
  process.exit(failures > 0 ? 1 : 0);
});
