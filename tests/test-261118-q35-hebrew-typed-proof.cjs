#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261118-q35 (owner ruling 2026-11-18): the plan 392-03 non-Latin rule
 * is narrowed. Hebrew gets the same per-token proof as Latin: a generic Hebrew
 * methodology question passes; a Hebrew question that carries a room-lexicon
 * term, an identifier or a private marker still blocks. A script with no
 * private-marker set (CJK, Cyrillic, Arabic) and a Hebrew string with a
 * combining mark (niqqud) stay fail closed. The retired pws-brain-mcp key
 * stays inspected (retired means blocked, not ignored).
 *
 * Cases:
 *   H1  generic Hebrew questions allow (classify and classifyAndCut).
 *   H2  a Hebrew question that names the bound room blocks with a lexicon
 *       class (room named in Hebrew, no room.db: the room_name entry).
 *   H3  Hebrew private markers block: secret, ours, mine, first person at
 *       a clause start, internal use.
 *   H4  a Hebrew question with a structured identifier blocks.
 *   H5  quick 261118-x1g (OWNER-REDUCE): a generic niqqud, Russian and
 *       Arabic sprout allows (R1 to R3); a CJK private marker and every
 *       unprofiled script (Thai, Persian, Serbian Cyrillic, Armenian,
 *       Georgian, Bengali) still block.
 *   H7  quick 261118-x1g (OWNER-R35, OWNER-H7A): the Hebrew prose bound is
 *       withdrawn; (a) both investor-left-after-audit rows follow their
 *       English twins (allow, R4 and R5), (b) a plain Hebrew methodology
 *       question passes, (c) main L18 passes unchanged.
 *   H6  every mcp__pws-brain-mcp__* name is Brain-shaped (inspected) and
 *       never trusted.
 *
 * Part 8: every sentence is invented. No real room, name or identifier.
 * Plain Node. Exit 1 on any failure. No em dash and no en dash anywhere.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const guard = require(path.join(REPO_ROOT, 'lib', 'core', 'part8-egress-guard.cjs'));
const sanitizer = require(path.join(REPO_ROOT, 'lib', 'core', 'brain-response-sanitize.cjs'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-q35-hebrew-'));
// An invented room named in Hebrew: "operation chrysanthemum".
const ROOM = path.join(TMP, 'מבצע-חרצית');
fs.mkdirSync(ROOM);
fs.writeFileSync(path.join(ROOM, 'ROOM.md'), '# Invented room for test-261118-q35. Not a real room.\n');

const OPTS = { toolName: 'brain_ask', roomDir: null };
const ROOM_OPTS = { toolName: 'brain_ask', roomDir: ROOM };

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok - ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL - ' + name);
    console.log('    ' + (err && err.message ? err.message : err));
  }
}
function tag(v) { return v.verdict + ' ' + v.class + '/' + v.token_class; }

console.log('Quick 261118-q35: Hebrew typed proof and the retired key\n');

const GENERIC = [
  'מה זה צה"ל ומה זה ארה"ב?',
  'איך בוחרים מסגרת לבעיה מרושעת?',
  'איך אני בוחר מסגרת לניתוח שוק?',
  'מה ההבדל בין SWOT לבין חמשת הכוחות?',
];

check('H1 generic Hebrew questions allow', function () {
  GENERIC.forEach(function (q) {
    const v = guard.classify({ question: q }, OPTS);
    assert.strictEqual(v.verdict, 'allow', JSON.stringify(q) + ' ' + tag(v));
    const c = guard.classifyAndCut({ question: q }, OPTS);
    assert.strictEqual(c.verdict.verdict, 'allow', JSON.stringify(q) + ' cut ' + tag(c.verdict));
  });
});

check('H2 a Hebrew question with a room-lexicon term blocks', function () {
  const q = 'מה זה מבצע חרצית ואיך מנתחים אותו?';
  const v = guard.classify({ question: q }, ROOM_OPTS);
  assert.strictEqual(v.verdict, 'block', tag(v));
  assert.strictEqual(v.token_class, 'room_name', tag(v));
  const c = guard.classifyAndCut({ question: q }, ROOM_OPTS);
  assert.strictEqual(c.verdict.verdict, 'block', 'cut ' + tag(c.verdict));
  // The same generic question without the room term passes in the same room.
  const g = guard.classify({ question: 'איך מנתחים מבצע בעזרת מסגרת?' }, ROOM_OPTS);
  assert.strictEqual(g.verdict, 'allow', 'generic in the bound room ' + tag(g));
});

check('H3 Hebrew private markers block', function () {
  [
    'איך לבחור מסגרת עבור הפרויקט של הצוות הסודי שלנו',
    'מה התוכנית הסודית?',
    'החברה שלנו מפסידה כסף, איזו מסגרת?',
    'הרעיון שלי טוב, איזו מסגרת?',
    'אני רוצה לפטר את המייסד אחרי הביקורת',
    'המסמך הזה לשימוש פנימי בלבד, איך מנתחים אותו?',
  ].forEach(function (q) {
    const v = guard.classify({ question: q }, OPTS);
    assert.strictEqual(v.verdict, 'block', JSON.stringify(q) + ' ' + tag(v));
  });
});

check('H4 a Hebrew question with an identifier blocks', function () {
  const v = guard.classify({ question: 'מה זה SWOT עבור ACME2026X?' }, OPTS);
  assert.strictEqual(v.verdict, 'block', tag(v));
});

// Quick 261118-x1g (owner rulings 2026-11-19, OWNER-REDUCE): R1 to R3. The
// Russian and Arabic profiles and the mark fold replace the blanket rules, so
// a generic sprout allows; the CJK private marker and the unprofiled scripts
// still block.
check('H5 quick 261118-x1g: generic niqqud, Russian and Arabic sprouts allow; a CJK marker and unprofiled scripts block', function () {
  ['שָׁלוֹם מה זה SWOT', 'что такое SWOT', 'ما هو SWOT'].forEach(function (q) {
    const v = guard.classify({ question: q }, OPTS);
    assert.strictEqual(v.verdict, 'allow', JSON.stringify(q) + ' ' + tag(v));
  });
  ['私たちの秘密の計画', 'SWOT คืออะไร', 'چگونه یک مصاحبه انجام دهم؟', 'Шта је SWOT и како га применити?', 'Ինչ է SWOT-ը?', 'რა არის SWOT?', 'SWOT কী?'].forEach(function (q) {
    const v = guard.classify({ question: q }, OPTS);
    assert.strictEqual(v.verdict, 'block', JSON.stringify(q) + ' ' + tag(v));
  });
});

// Quick 261118-x1g (owner rulings 2026-11-19, OWNER-R35 and OWNER-H7A): R4 and
// R5. The Hebrew prose bound is withdrawn; ruling 35 is the only length bar.
// Each H7a row follows its English twin, which is allowed (same verdict and
// class).
check('H7a the investor-left-after-audit Hebrew rows follow their English twins', function () {
  [
    // "the lead investor left after the audit and the founder wants to fire the team"
    ['המשקיע הראשי עזב אחרי הביקורת והמייסד רוצה לפטר את הצוות',
      'The lead investor left after the audit and the founder wants to fire the team'],
    // the same narrative, ending as a question
    ['המשקיע הראשי עזב אחרי הביקורת והמייסד רוצה לפטר את הצוות, איזו מסגרת מתאימה לנו עכשיו?',
      'The lead investor left after the audit and the founder wants to fire the team, which framework fits us now?'],
  ].forEach(function (pair) {
    const v = guard.classify({ question: pair[0] }, OPTS);
    const twin = guard.classify({ question: pair[1] }, OPTS);
    assert.strictEqual(v.verdict, 'allow', JSON.stringify(pair[0]) + ' ' + tag(v));
    assert.strictEqual(v.verdict + ' ' + v.class, twin.verdict + ' ' + twin.class, 'twin ' + tag(twin));
    const c = guard.classifyAndCut({ question: pair[0] }, OPTS);
    assert.strictEqual(c.verdict.verdict, 'allow', 'cut ' + tag(c.verdict));
  });
});

check('H7b a plain Hebrew methodology question still passes', function () {
  ['איך לבחור מסגרת עבודה עבור פרויקט חדש', 'הסבר את שיטת חמשת הלמה'].forEach(function (q) {
    const v = guard.classify({ question: q }, OPTS);
    assert.strictEqual(v.verdict, 'allow', JSON.stringify(q) + ' ' + tag(v));
  });
});

check('H7c the main L18 Hebrew question still passes unchanged', function () {
  const q = 'מה זה צה"ל ומה זה ארה"ב?';
  const c = guard.classifyAndCut({ question: q }, OPTS);
  assert.strictEqual(c.verdict.verdict, 'allow', tag(c.verdict));
});

check('H6 the retired pws-brain-mcp key is inspected, never trusted', function () {
  ['mcp__pws-brain-mcp__search', 'mcp__pws-brain-mcp__brain_ask', 'mcp__pws-brain-mcp__text2cypher'].forEach(function (n) {
    assert.strictEqual(sanitizer.isBrainShapedTool(n), true, n + ' not inspected');
    assert.strictEqual(sanitizer.isBrainTool(n), false, n + ' trusted');
  });
});

fs.rmSync(TMP, { recursive: true, force: true });
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
