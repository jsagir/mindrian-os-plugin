'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 386-46 (E-IDENT): an obfuscated email and an international phone-like
 * number always block, in every shape, with the same pair as the plain forms
 * (class content_set, token class none). Money forms stay body-only.
 * Debug session: part8-always-block-misses-obfuscated-email-and-international-phone.
 *
 * Arms ID1 to ID9. Part 8: a temporary HOME, synthetic strings built at run
 * time from invented fragments, no real room, no network (a counter).
 * Node built-ins plus tests/helpers/audit-probe-loader.cjs only.
 *
 * No em dash and no en dash anywhere.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos386-46-'));
process.env.HOME = TMP;
process.env.USERPROFILE = TMP;
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'registry');
delete process.env.CLAUDE_ACTIVE_ROOM;

const loader = require('./helpers/audit-probe-loader.cjs');
const NET = loader.blockNetwork();
const guard = require('../lib/core/part8-egress-guard.cjs');
const agg = require('../lib/core/cross-room-aggregator.cjs');
const rsPrompts = require('../lib/core/rs-egress-prompts.cjs');

let failed = 0;
function ok(label, cond, detail) {
  if (cond) {
    console.log('ok - ' + label);
  } else {
    failed += 1;
    console.log('FAIL - ' + label + (detail ? ' (' + detail + ')' : ''));
  }
}

const PROBES = loader.loadProbes();
function probeText(id) {
  const c = PROBES.adv.find(function (x) { return x.id === id; });
  return c ? c.text : '';
}

function pair(v) {
  return v.verdict + '/' + v.class + '/' + (v.token_class === null || v.token_class === undefined ? 'none' : v.token_class);
}
const PLAIN_PAIR = 'block/content_set/none';

function classifyAs(tool, text) {
  const payload = tool === 'brain_query'
    ? { cypher: "MATCH (n) WHERE n.name = '" + text + "' RETURN n" }
    : loader.payloadFor(tool, text);
  return guard.classify(payload, { toolName: tool, roomDir: null });
}
const TOOLS = ['brain_ask', 'brain_search', 'brain_query'];

// Invented fragments, joined at run time.
const LOCAL = ['alina', 'mor'].join('.');
const LOCAL2 = ['dov', 'tal'].join('');
const DOM = ['fake', 'example'].join('-');
const TLD = 'test';

const EMAIL_FORMS = {
  square: LOCAL + ' [at] ' + DOM + ' [dot] ' + TLD,
  round: LOCAL + ' (at) ' + DOM + ' (dot) ' + TLD,
  words: LOCAL2 + ' at fake dot ' + TLD,
  upper: (LOCAL + ' [at] ' + DOM + ' [dot] ' + TLD).toUpperCase(),
  upper_words: (LOCAL2 + ' at fake dot ' + TLD).toUpperCase(),
  two_labels: LOCAL2 + ' at fake dot example dot ' + TLD,
};

const DIGITS = ['555', '0198'];
const PHONE_FORMS = {
  il_spaces: '+972 54 ' + DIGITS[0] + ' ' + DIGITS[1],
  uk_space_area: '+44 20 7946 0958',
  de_bracket: '+49 (30) ' + DIGITS[0] + ' ' + DIGITS[1],
  hyphens: '+972-54-' + DIGITS[0] + '-' + DIGITS[1],
  dots: '+972.54.' + DIGITS[0] + '.' + DIGITS[1],
};

// ID1: each obfuscated email form is block with the plain pair on three tools.
(function () {
  const bad = [];
  Object.keys(EMAIL_FORMS).forEach(function (k) {
    TOOLS.forEach(function (tool) {
      const v = classifyAs(tool, 'contact ' + EMAIL_FORMS[k] + ' for the strategy');
      if (pair(v) !== PLAIN_PAIR) bad.push(k + ':' + tool + ':' + pair(v));
    });
  });
  ok('ID1 each obfuscated email form is block content_set/none on ask, search and cypher', bad.length === 0, bad.length + ' wrong: ' + bad.join(' '));
})();

// ID2: each international phone-like form is block with the plain pair.
(function () {
  const bad = [];
  Object.keys(PHONE_FORMS).forEach(function (k) {
    TOOLS.forEach(function (tool) {
      const v = classifyAs(tool, 'call ' + PHONE_FORMS[k] + ' tomorrow');
      if (pair(v) !== PLAIN_PAIR) bad.push(k + ':' + tool + ':' + pair(v));
    });
  });
  ok('ID2 each international phone-like form is block content_set/none on ask, search and cypher', bad.length === 0, bad.length + ' wrong: ' + bad.join(' '));
})();

// ID3: ordinary pins (the at and dot words, a plus sign and a few digits,
// a time of day) stay allow. Passes before and after the fix.
const ORDINARY = [
  'what happens at the dot com stage of a startup',
  'look at the dot com bubble as a teaching case',
  'use the 3 + 2 rule for 30 days',
  'plan the review meeting at 3 pm and then look at the results',
  'compare the +2 rule and the +5 rule over 30 days',
  'how does the 1+1=2 rule work in a swot analysis',
  'which framework helps when growth is +30% over 12 months',
  'what do I do at scale dot com companies use',
  'the team looks at launch dot com metrics',
  'a plus sign next to 972 is not a number by itself',
];
(function () {
  const bad = [];
  ORDINARY.forEach(function (q) {
    const v = classifyAs('brain_ask', q);
    if (v.verdict !== 'allow') bad.push(pair(v) + ' <- ' + q);
  });
  ok('ID3 ordinary at, dot, plus-sign and time questions stay allow', bad.length === 0, bad.join(' | '));
})();

// ID4: suffix_money stays allow (money is body-only), unless the RCA says it carries a credential.
(function () {
  const rca = fs.readFileSync(path.join(REPO, '.planning', 'debug', 'part8-always-block-misses-obfuscated-email-and-international-phone.md'), 'utf8');
  const m = /^carries_credential_suffix_money: (.+)$/m.exec(rca);
  const carries = m && /^yes/.test(m[1]);
  const v = classifyAs('brain_ask', probeText('suffix_money'));
  if (carries) ok('ID4 suffix_money carries a credential per the RCA and blocks', v.verdict === 'block', pair(v));
  else ok('ID4 suffix_money stays allow as a sprout (money is body-only)', v.verdict === 'allow', pair(v));
})();

// ID5: shapes. The always-block rules come before the shape outcomes.
(function () {
  const bad = [];
  const items = {
    email: EMAIL_FORMS.square,
    email_words: EMAIL_FORMS.words,
    phone: PHONE_FORMS.il_spaces,
  };
  Object.keys(items).forEach(function (k) {
    const x = items[k];
    const sprout = x;
    const edge = 'which framework helps a small team reach ' + x + ' about the pilot study results next week';
    const body = 'We reviewed the pilot results this week. Please write to ' + x + ' about the next step. ' +
      'Then the team can decide how to plan a longer test with the same group.';
    [['sprout', sprout], ['edge', edge], ['body', body]].forEach(function (s) {
      const v = classifyAs('brain_ask', s[1]);
      if (pair(v) !== PLAIN_PAIR) bad.push(k + ':' + s[0] + ':' + pair(v));
    });
  });
  ok('ID5 a sprout, an edge and a body with these forms block content_set/none', bad.length === 0, bad.length + ' wrong: ' + bad.join(' '));
})();

// ID6: two new patterns, appended; the old lists keep their order.
(function () {
  const PRE_FORBIDDEN = 27;
  const PRE_ALWAYS = 18;
  const FORBIDDEN_DIGEST = '8ac30ad68994314fc0922fe3dc687b085c426fb44ccb45bec980be3ff53b2539';
  const ALWAYS_DIGEST = 'd32e9e6d39f4f8ae237c3c72ae49e8eb5530e38d3e03f07122893956505fcd65';
  const dig = function (l) { return crypto.createHash('sha256').update(l.map(function (r) { return r.toString(); }).join('\n')).digest('hex'); };
  const F = agg.FORBIDDEN_PATTERNS;
  const A = agg.ALWAYS_PATTERNS;
  const bad = [];
  if (F.length !== PRE_FORBIDDEN + 2) bad.push('FORBIDDEN_PATTERNS length ' + F.length);
  if (A.length !== PRE_ALWAYS + 2) bad.push('ALWAYS_PATTERNS length ' + A.length);
  if (dig(F.slice(0, PRE_FORBIDDEN)) !== FORBIDDEN_DIGEST) bad.push('FORBIDDEN prefix changed');
  if (dig(A.slice(0, PRE_ALWAYS)) !== ALWAYS_DIGEST) bad.push('ALWAYS prefix changed');
  const newF = F.slice(PRE_FORBIDDEN);
  const newA = A.slice(PRE_ALWAYS);
  if (newF.length !== 2 || newA.length !== 2 || newF[0] !== newA[0] || newF[1] !== newA[1]) bad.push('the two new patterns are not the same objects in both lists');
  const em = EMAIL_FORMS.square;
  const ph = PHONE_FORMS.il_spaces;
  const hitE = newA.some(function (re) { re.lastIndex = 0; return re.test(em); }) && newA.some(function (re) { re.lastIndex = 0; return re.test(EMAIL_FORMS.words); });
  const hitP = newA.some(function (re) { re.lastIndex = 0; return re.test(ph); });
  if (!hitE) bad.push('the new patterns do not match the obfuscated email');
  if (!hitP) bad.push('the new patterns do not match the international phone');
  const R = rsPrompts;
  if (R.FORBIDDEN_PATTERNS !== F && R.FORBIDDEN_PATTERNS.length !== F.length) bad.push('rs-egress-prompts FORBIDDEN_PATTERNS differs');
  if (R.ALWAYS_PATTERNS !== A) bad.push('rs-egress-prompts ALWAYS_PATTERNS is not the same object');
  ok('ID6 two patterns appended to ALWAYS_PATTERNS and FORBIDDEN_PATTERNS, order of the rest kept', bad.length === 0, bad.join('; '));
})();

// ID7: no false positive. The new patterns match no ordinary case of the
// positives, compliant, 354-generic and extended groups, and the 26 positives still allow.
(function () {
  const A = agg.ALWAYS_PATTERNS;
  const newA = A.slice(Math.max(0, A.length - 2));
  const groups = { positives_26: 1, compliant: 1, '354-generic': 1, extended: 1 };
  const hits = [];
  let seen = 0;
  PROBES.corpora.forEach(function (c) {
    if (!groups[c.group]) return;
    seen += 1;
    // before the change the last two entries are credential shapes: skip the check on those.
    if (A.length === 18) return;
    if (newA.some(function (re) { re.lastIndex = 0; return re.test(c.q); })) hits.push(c.key);
  });
  const corpus = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '3692', 'guard-survey-corpus.json'), 'utf8'));
  const notAllow = [];
  corpus.positives_26.forEach(function (p, i) {
    const q = typeof p === 'string' ? p : (p.q || p.question);
    if (A.length !== 18 && newA.some(function (re) { re.lastIndex = 0; return re.test(q); })) hits.push('positives_26:' + i);
    const v = classifyAs('brain_ask', q);
    if (v.verdict !== 'allow') notAllow.push('positives_26:' + i + ':' + pair(v));
  });
  ok('ID7 no ordinary case of positives, compliant, 354-generic and extended is hit by a new pattern; the 26 positives allow',
    seen > 0 && hits.length === 0 && notAllow.length === 0, 'seen ' + seen + '; hits ' + hits.join(',') + '; not allow ' + notAllow.join(','));
})();

// ID8: the three probe cases are block with the plain pair.
(function () {
  const bad = [];
  ['email_obfuscated_at', 'email_obfuscated_words', 'phone_intl'].forEach(function (id) {
    const t = probeText(id);
    if (!t) { bad.push(id + ' missing'); return; }
    const v = classifyAs('brain_ask', t);
    if (pair(v) !== PLAIN_PAIR) bad.push(id + ':' + pair(v));
  });
  ok('ID8 probe cases email_obfuscated_at, email_obfuscated_words and phone_intl block content_set/none', bad.length === 0, bad.join(' '));
})();

// ID9: the plain forms still block with the same pair.
(function () {
  const bad = [];
  ['email_plain', 'phone_us'].forEach(function (id) {
    const v = classifyAs('brain_ask', probeText(id));
    if (pair(v) !== PLAIN_PAIR) bad.push(id + ':' + pair(v));
  });
  ok('ID9 plain email and plain US phone still block content_set/none', bad.length === 0, bad.join(' '));
})();

ok('network calls are 0', NET.count() === 0, 'calls ' + NET.count());
NET.restore();
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
if (failed > 0) {
  console.log(failed + ' arm(s) failed');
  process.exit(1);
}
console.log('all arms passed');
