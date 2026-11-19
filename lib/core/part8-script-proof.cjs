'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261118-x1g: the Part 8 typed proof for every profiled script.
 * ==========================================================================
 * Owner rulings 2026-11-19 (relayed): OWNER-REDUCE (less egress blocking, no
 * rule stricter than the English rule in any script), OWNER-R35 (a body is 3
 * or more sentences or more than 4,000 characters, in every script),
 * OWNER-FP (first person at English parity), OWNER-HE (exact English parity
 * for Hebrew) and OWNER-P (keep every recent leak fix).
 *
 * The guard (lib/core/part8-egress-guard.cjs), the room lexicon
 * (lib/core/part8-room-lexicon.cjs) and the shape helper
 * (lib/core/part8-sprout-shape.cjs) load this module lazily, only for a string
 * that holds a non-ASCII letter, digit or mark (needsScriptProof). A pure
 * ASCII string never loads it, so its verdict is byte-identical to before and
 * the hook cold start does not grow.
 *
 * What it gives each profiled script (English-equivalent checks only):
 *   - the check view: marks (niqqud, harakat, tonos, vowel signs) and the
 *     Arabic tatweel removed, every decimal digit folded to ASCII;
 *   - the confusable fold of Cyrillic and Greek lookalikes to Latin;
 *   - a question test that is not Latin-only (isQuestionText);
 *   - the private markers with the English shape split (PW and POS in a
 *     sprout and a long edge; PC and PP in every shape), first person at
 *     English parity (P1 in a sprout and a long edge, P2 in a text that is
 *     not question-shaped, every shape);
 *   - the email, phone and identifier shapes on the check view;
 *   - the mixed-script token rule with its affix exemption;
 *   - the edge name rule (TitleCase for cased scripts, title cues for
 *     caseless scripts);
 *   - the token helpers of the room lexicon (prefix, particle and stem
 *     variants) and the Segmenter word count for Han and Kana.
 *
 * Profiled scripts: Latin, Hebrew, Cyrillic (Russian, Ukrainian and
 * Bulgarian letters), core Arabic, Han, Hiragana, Katakana, Greek, Hangul and
 * Devanagari. Thai, Lao, Khmer and Myanmar mark sentences with spaces, not
 * punctuation, so the ruling 35 sentence bar cannot be measured; they and
 * every other script without a marker row stay fail closed outside the
 * typed shape arm (hasUnprovableScript).
 *
 * Never throws: a check fails closed (true), a count returns the letter
 * count. Node built-ins only. It does not require the guard. No em dash and
 * no en dash anywhere.
 */

// ---------------------------------------------------------------------------
// Scripts and profiles
// ---------------------------------------------------------------------------
const NEED_RE = /(?![\x00-\x7F])[\p{L}\p{N}\p{M}]/u;

function needsScriptProof(str) {
  return typeof str === 'string' && NEED_RE.test(str);
}

const CYR_PROFILE = '\\u0410-\\u044F\\u0401\\u0451\\u0404\\u0454\\u0406\\u0456\\u0407\\u0457\\u0490\\u0491';
const AR_PROFILE = '\\u0621-\\u063A\\u0640-\\u064A';
const PROVABLE_CLASS = '[\\p{Script=Latin}\\p{Script=Hebrew}\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}' +
  '\\p{Script=Greek}\\p{Script=Hangul}\\p{Script=Devanagari}\\p{Script=Common}\\p{Script=Inherited}' +
  CYR_PROFILE + AR_PROFILE + ']';
const UNPROVABLE_LETTER = new RegExp('(?!' + PROVABLE_CLASS + ')\\p{L}', 'u');

const RE = Object.freeze({
  latin: /\p{Script=Latin}/u,
  hebrew: /\p{Script=Hebrew}/u,
  cyr: /\p{Script=Cyrillic}/u,
  greek: /\p{Script=Greek}/u,
  arabic: /\p{Script=Arabic}/u,
  han: /\p{Script=Han}/u,
  kana: /[\p{Script=Hiragana}\p{Script=Katakana}]/u,
  hanKana: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
  hangul: /\p{Script=Hangul}/u,
  deva: /\p{Script=Devanagari}/u,
});

// A letter of a script with no marker row: fail closed outside the typed arm.
function hasUnprovableScript(str) {
  try {
    return UNPROVABLE_LETTER.test(String(str));
  } catch (_e) {
    return true;
  }
}

// ---------------------------------------------------------------------------
// The check view
// ---------------------------------------------------------------------------
const ND_ONE = /\p{Nd}/u;
const _digitCache = new Map();
function _digitValue(cp) {
  if (cp >= 48 && cp <= 57) return cp - 48;
  if (_digitCache.has(cp)) return _digitCache.get(cp);
  let start = cp;
  while (start > 0 && cp - start < 200 && ND_ONE.test(String.fromCodePoint(start - 1))) start -= 1;
  const v = (cp - start) % 10;
  _digitCache.set(cp, v);
  return v;
}

// Every decimal digit (\p{Nd}) becomes its ASCII digit: the offset from the
// start of its run of 10, modulo 10.
function foldDigits(str) {
  const s = typeof str === 'string' ? str : String(str);
  if (!/[^\x00-\x7F]/.test(s)) return s;
  return s.replace(/\p{Nd}/gu, function (d) {
    const cp = d.codePointAt(0);
    return cp <= 57 ? d : String(_digitValue(cp));
  });
}

const MARK_OR_TATWEEL = /[\p{M}\u0640]/gu;

// NFD, remove every mark and U+0640, NFC, then fold the digits.
function checkView(str) {
  const s = typeof str === 'string' ? str : String(str);
  if (!NEED_RE.test(s)) return s;
  try {
    return foldDigits(s.normalize('NFD').replace(MARK_OR_TATWEEL, '').normalize('NFC'));
  } catch (_e) {
    return s;
  }
}

// The table view of Devanagari: NFC, digits folded, the nukta removed. The
// vowel signs stay: removing them merges common words (ka, ki, ke, ko and
// ki all become one letter; main and mein become one letter), so the
// first-person and conjunction rows would fire on generic Hindi.
function _lightView(str) {
  try {
    return foldDigits(String(str).normalize('NFC').replace(/\u093C/gu, ''));
  } catch (_e) {
    return String(str);
  }
}

// Cyrillic and Greek lookalikes to Latin (both cases). The lexicon only.
const CONF_FROM = 'аАвВеЕёЁкКмМнНоОрРсСтТуУхХіІјЈѕЅԁԀԛԚԝԜ' + 'ΑΒΕΖΗΙΚΜΝΟΡΤΥΧονρικχ';
const CONF_TO = 'aAbBeEeEkKmMhHoOpPcCtTyYxXiIjJsSdDqQwW' + 'ABEZHIKMNOPTYXovpikx';
const CONF_MAP = (function () {
  const m = new Map();
  const from = Array.from(CONF_FROM);
  const to = Array.from(CONF_TO);
  for (let i = 0; i < from.length && i < to.length; i += 1) m.set(from[i], to[i]);
  return m;
})();
function confusableFold(str) {
  const s = typeof str === 'string' ? str : String(str);
  let out = '';
  for (const ch of s) out += CONF_MAP.has(ch) ? CONF_MAP.get(ch) : ch;
  return out;
}

// ---------------------------------------------------------------------------
// Tokens and views
// ---------------------------------------------------------------------------
const SPLIT_KEEP_MARKS = /[^\p{L}\p{N}\p{M}]+/u;

function _viewToken(t) {
  return (RE.deva.test(t) ? _lightView(t) : checkView(t)).toLowerCase();
}

// Tokens for the marker, question and cue tables: split on every run that is
// not a letter, a digit or a mark (a mark stays inside its word), then the
// table view of each token, lowercase.
function tableTokens(str) {
  const out = [];
  const raw = String(str).split(SPLIT_KEEP_MARKS);
  for (let i = 0; i < raw.length; i += 1) {
    if (!raw[i]) continue;
    const v = _viewToken(raw[i]).replace(/[^\p{L}\p{N}]+/gu, '');
    if (v) out.push(v);
  }
  return out;
}

// Tokens for the room lexicon: the check view, lowercase, split on every run
// that is not a letter or a digit.
function lexTokens(str) {
  return checkView(String(str)).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(function (t) { return t.length > 0; });
}

// The check view, lowercase, with every character that is not a letter or a
// digit removed (zh and ja substring matching).
function compactView(str) {
  return checkView(String(str)).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function hasSpacelessLetter(str) {
  return RE.hanKana.test(String(str));
}

// ---------------------------------------------------------------------------
// Segmenter word count (Han and Kana)
// ---------------------------------------------------------------------------
let _segZh = null;
let _segJa = null;
function _segmenter(ja) {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return null;
  if (ja) {
    if (!_segJa) _segJa = new Intl.Segmenter('ja', { granularity: 'word' });
    return _segJa;
  }
  if (!_segZh) _segZh = new Intl.Segmenter('zh', { granularity: 'word' });
  return _segZh;
}
function _hanKanaCount(t) {
  const m = String(t).match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu);
  return m ? m.length : 0;
}
// The number of word-like segments of one token ('ja' for a token with Kana,
// else 'zh'). On failure: the number of Han and Kana letters.
function countSpacelessWords(token) {
  const t = String(token);
  try {
    const seg = _segmenter(RE.kana.test(t));
    if (!seg) return _hanKanaCount(t);
    let n = 0;
    for (const s of seg.segment(t)) if (s.isWordLike) n += 1;
    return n;
  } catch (_e) {
    return _hanKanaCount(t);
  }
}

// ---------------------------------------------------------------------------
// T7 token variants
// ---------------------------------------------------------------------------
const HE_PREFIX_LETTERS = 'ובלמשכה';
const AR_PREFIXES = (function () {
  const out = [];
  ['', 'و', 'ف'].forEach(function (w) {
    ['', 'ب', 'ك', 'ل'].forEach(function (b) {
      ['', 'ال'].forEach(function (a) {
        const p = w + b + a;
        if (p) out.push(p);
      });
    });
    out.push(w + 'لل');
  });
  return Array.from(new Set(out)).sort(function (x, y) { return y.length - x.length; });
})();
const KO_PARTICLES = Object.freeze(['에서는', '에게서', '으로는', '에서', '에게', '한테', '으로', '부터', '까지', '처럼', '보다', '이나',
  '은', '는', '이', '가', '을', '를', '의', '에', '로', '와', '과', '도', '만', '랑']);
const CYR_ENDINGS = Object.freeze(Array.from(new Set(['ами', 'ями', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ой', 'ей', 'ый', 'ий', 'ая', 'яя',
  'ое', 'ее', 'ые', 'ие', 'ую', 'юю', 'ов', 'ев', 'ах', 'ях', 'ам', 'ям', 'ом', 'ем', 'а', 'я', 'о', 'е', 'ы', 'и', 'у', 'ю', 'ь', 'й',
  'і', 'ї', 'є'].map(function (e) { return checkView(e); }))).sort(function (a, b) { return b.length - a.length; }));
const GREEK_ENDINGS = Object.freeze(['ιων', 'ιου', 'ους', 'ων', 'ου', 'ος', 'ης', 'ες', 'ας', 'οι', 'ια', 'ιο', 'α', 'η', 'ο', 'ι', 'ε']
  .map(function (e) { return checkView(e); }).sort(function (a, b) { return b.length - a.length; }));
const CYR_ENDING_SET = new Set(CYR_ENDINGS);
const GREEK_ENDING_SET = new Set(GREEK_ENDINGS);

const ONLY_HE = /^\p{Script=Hebrew}+$/u;
const ONLY_AR = /^\p{Script=Arabic}+$/u;
const ONLY_CYR = /^\p{Script=Cyrillic}+$/u;
const ONLY_GR = /^\p{Script=Greek}+$/u;
const ONLY_LATIN = /^\p{Script=Latin}+$/u;

function _prefixVariants(t, out) {
  if (ONLY_HE.test(t)) {
    for (let i = 0; i < 3 && i < t.length && HE_PREFIX_LETTERS.indexOf(t[i]) !== -1; i += 1) {
      if (t.length - (i + 1) >= 2) out.push(t.slice(i + 1));
    }
  } else if (ONLY_AR.test(t)) {
    for (let i = 0; i < AR_PREFIXES.length; i += 1) {
      const p = AR_PREFIXES[i];
      if (t.startsWith(p) && t.length - p.length >= 2) out.push(t.slice(p.length));
    }
  }
}

function _koRestOk(rest) {
  if (!rest) return false;
  if (/[가-힣]/u.test(rest)) return true;
  const latin = rest.match(/\p{Script=Latin}/gu);
  return latin !== null && latin.length >= 2 && /^[\p{Script=Latin}\p{N}]+$/u.test(rest);
}
// Remove a final Korean particle (up to 2 times) when 1 syllable or 2 Latin
// letters remain.
function _koVariants(t, out) {
  if (!/[가-힣]$/u.test(t)) return;
  let cur = [t];
  for (let round = 0; round < 2; round += 1) {
    const next = [];
    for (let c = 0; c < cur.length; c += 1) {
      for (let p = 0; p < KO_PARTICLES.length; p += 1) {
        const part = KO_PARTICLES[p];
        if (cur[c].length > part.length && cur[c].endsWith(part)) {
          const rest = cur[c].slice(0, cur[c].length - part.length);
          if (_koRestOk(rest)) next.push(rest);
        }
      }
    }
    for (let n = 0; n < next.length; n += 1) out.push(next[n]);
    cur = next;
    if (cur.length === 0) break;
  }
}

// The Latin part of a token of the W2 affix form (a Hebrew or Arabic prefix
// glued to Latin letters, or Latin letters with a glued Cyrillic or Greek
// ending of 1 to 3 letters); null otherwise. The token is lowercase.
function _affixLatinPart(t) {
  let m = /^([ובלמשכה]{1,3})(\p{Script=Latin}+)$/u.exec(t);
  if (m) return m[2];
  m = /^(\p{Script=Arabic}{1,4})(\p{Script=Latin}+)$/u.exec(t);
  if (m && AR_PREFIXES.indexOf(m[1]) !== -1) return m[2];
  m = /^(\p{Script=Latin}+)(\p{Script=Cyrillic}{1,3})$/u.exec(t);
  if (m && CYR_ENDING_SET.has(m[2])) return m[1];
  m = /^(\p{Script=Latin}+)(\p{Script=Greek}{1,3})$/u.exec(t);
  if (m && GREEK_ENDING_SET.has(m[2])) return m[1];
  return null;
}

// tokenVariants(token, {prefix}) -> array: the token, its Hebrew and Arabic
// prefix variants (when prefix is not false), its Korean particle variants
// and the Latin part of a W2 affix form.
function tokenVariants(token, opts) {
  const t = String(token);
  const out = [t];
  if (!opts || opts.prefix !== false) _prefixVariants(t, out);
  _koVariants(t, out);
  const latin = _affixLatinPart(t);
  if (latin) {
    out.push(latin);
    _koVariants(latin, out);
  }
  return out;
}

function _cyrStem(e) {
  if (e.length < 4) return null;
  for (let i = 0; i < CYR_ENDINGS.length; i += 1) {
    const end = CYR_ENDINGS[i];
    if (e.endsWith(end) && e.length - end.length >= 3) return e.slice(0, e.length - end.length);
  }
  return e;
}
function _greekStem(e) {
  if (e.length < 4) return null;
  for (let i = 0; i < GREEK_ENDINGS.length; i += 1) {
    const end = GREEK_ENDINGS[i];
    if (e.endsWith(end) && e.length - end.length >= 3) return e.slice(0, e.length - end.length);
  }
  return e;
}
// The T7 stem rule: both tokens Cyrillic (or both Greek), the entry token has
// 4 letters or more; the question token starts with the stem and the rest is
// 0 to 4 letters of the same script.
function _stemMatch(q, e) {
  if (ONLY_CYR.test(q) && ONLY_CYR.test(e)) {
    const stem = _cyrStem(e);
    if (stem === null || !q.startsWith(stem)) return false;
    const rest = q.slice(stem.length);
    return rest.length <= 4 && (rest === '' || ONLY_CYR.test(rest));
  }
  if (ONLY_GR.test(q) && ONLY_GR.test(e)) {
    const stem = _greekStem(e);
    if (stem === null || !q.startsWith(stem)) return false;
    const rest = q.slice(stem.length);
    return rest.length <= 4 && (rest === '' || ONLY_GR.test(rest));
  }
  return false;
}

// tokenMatches(questionToken, entryToken, {first}) -> boolean. Hebrew and
// Arabic prefixes count only on the first entry token (first true); Korean
// particles, the W2 Latin part and the Cyrillic and Greek stem rule count at
// every position.
function tokenMatches(q, e, opts) {
  const qs = String(q);
  const es = String(e);
  if (qs === es) return true;
  const first = !!(opts && opts.first === true);
  const vs = tokenVariants(qs, { prefix: first });
  for (let i = 0; i < vs.length; i += 1) {
    if (vs[i] === es) return true;
    if (_stemMatch(vs[i], es)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Tables (frozen; every entry folded at load)
// ---------------------------------------------------------------------------
function _f(list) { return Object.freeze(list.map(function (s) { return tableTokens(s); }).filter(function (t) { return t.length > 0; })); }
function _fset(list) { return new Set(list.map(function (s) { return tableTokens(s).join(' '); }).filter(Boolean)); }
function _fc(list) { return Object.freeze(list.map(function (s) { return compactView(s); }).filter(Boolean)); }

// T1 Private words (PW: sprout and long edge) and confidential words (PC: every shape).
const T1 = {
  es: {
    pw: _f(['secreto', 'secreta', 'secretos', 'secretas', 'no divulgado', 'no divulgada']),
    pc: _f(['confidencial', 'confidenciales', 'uso interno', 'solo interno', 'sólo interno', 'acuerdo de confidencialidad', 'bajo nda']),
  },
  cyr: {
    pwStems: _fc(['секретн', 'таємн', 'засекречен', 'проприетарн']),
    pwSecret: compactView('секрет'),
    pwSecretNot: compactView('секретар'),
    pw: _f(['коммерческая тайна']),
    pcStems: _fc(['конфиденциальн', 'конфіденційн']),
    pc: _f(['для служебного пользования', 'для службового користування', 'только для внутреннего', 'тільки для внутрішнього',
      'внутреннего использования', 'внутрішнього використання', 'nda']),
  },
  ar: {
    pw: _f(['سري', 'سرية', 'سري للغاية']),
    pc: _f(['للاستخدام الداخلي', 'استخدام داخلي', 'داخلي فقط', 'عدم الإفصاح', 'عدم الإفشاء', 'اتفاقية سرية']),
  },
  zh: {
    pw: _fc(['秘密', '绝密', '絕密', '专有', '專有', '未公开', '未公開']),
    pc: _fc(['机密', '機密', '保密', '内部使用', '內部使用', '仅限内部', '僅限內部', '内部资料', '內部資料', '保密协议', '保密協議']),
  },
  ja: {
    pw: _fc(['秘密', '極秘', '非公開', '未公開']),
    pc: _fc(['機密', '社外秘', '部外秘', '内部限定', '社内限定', '社内のみ', '守秘義務', '秘密保持契約']),
  },
  el: {
    pw: _f(['μυστικό', 'μυστική', 'μυστικά', 'μυστικός', 'μη δημοσιοποιημένο']),
    pc: _f(['εμπιστευτικό', 'εμπιστευτική', 'εμπιστευτικά', 'απόρρητο', 'απόρρητη', 'απόρρητα', 'εσωτερικής χρήσης',
      'μόνο για εσωτερική χρήση', 'συμφωνία εμπιστευτικότητας']),
  },
  ko: {
    pw: _f(['비밀', '극비', '미공개']),
    pc: _f(['기밀', '대외비', '내부용', '사내 한정', '내부 한정', '비밀 유지 계약']),
  },
  hi: {
    pw: _f(['गुप्त', 'अप्रकाशित']),
    pc: _f(['गोपनीय', 'आंतरिक उपयोग', 'केवल आंतरिक', 'गोपनीयता समझौता']),
  },
  he: {
    pc: _f(['חסוי', 'חסויה', 'חסויים', 'חסויות', 'שימוש פנימי', 'פנימי בלבד', 'הסכם סודיות']),
  },
};

// T2 Possessives, venture nouns, first-person openers and conjunctions.
const T2 = {
  es: {
    poss: _fset(['mi', 'mis', 'nuestro', 'nuestra', 'nuestros', 'nuestras']),
    venture: _fset(['startup', 'empresa', 'compañía', 'emprendimiento', 'producto', 'clientes', 'usuarios', 'pivote', 'equipo',
      'inversores', 'inversionistas', 'ingresos', 'precios']),
    openers: _f(['yo', 'nosotros', 'nosotras', 'me', 'nos']),
    conj: _f(['y', 'e', 'pero', 'así que', 'porque', 'que', 'cuando', 'mientras']),
  },
  cyr: {
    poss: _fset(['мой', 'моя', 'моё', 'мое', 'мои', 'моего', 'моей', 'моему', 'моим', 'моих', 'моём', 'моем', 'мою', 'мій', 'моє', 'мої',
      'мого', 'моєї', 'моїх', 'наш', 'наша', 'наше', 'наши', 'наші', 'нашего', 'нашого', 'нашей', 'нашої', 'нашему', 'нашим', 'наших',
      'нашем', 'нашу']),
    ventureStems: _fc(['стартап', 'компани', 'компані', 'продукт', 'клиент', 'клієнт', 'пользовател', 'користувач', 'пивот', 'команд',
      'инвестор', 'інвестор', 'выручк', 'виручк', 'доход', 'дохід', 'цен', 'ціни', 'ценообразован']),
    openers: _f(['я', 'мы', 'ми', 'мне', 'мені', 'нам', 'аз', 'у меня', 'у мене', 'у нас']),
    conj: _f(['и', 'і', 'й', 'а', 'но', 'але', 'поэтому', 'тому', 'так что', 'потому что', 'бо', 'что', 'що', 'когда', 'коли', 'пока', 'поки']),
  },
  he: {
    venture: _fset(['סטארטאפ', 'חברה', 'מיזם', 'מוצר', 'מוצרים', 'לקוחות', 'משתמשים', 'פיבוט', 'צוות', 'משקיעים', 'הכנסות', 'תמחור', 'מחירים']),
    mine: _fset(['שלי', 'שלנו']),
    suffix: _fset(['חברתי', 'חברתנו', 'מוצרנו', 'לקוחותיי', 'לקוחותינו', 'משקיעיי', 'משקיעינו', 'צוותנו', 'הכנסותינו']),
    p2: _fset(['אני', 'אנחנו', 'אנו', 'ואני', 'ואנחנו', 'ואנו']),
    t2b: _f(['כשאני', 'כשאנחנו', 'שאני', 'שאנחנו', 'ושאני', 'ושאנחנו', 'כי אני', 'כי אנחנו', 'אבל אני', 'אבל אנחנו', 'אז אני', 'אז אנחנו',
      'לכן אני', 'לכן אנחנו', 'כאשר אני', 'כאשר אנחנו', 'בזמן שאני', 'בזמן שאנחנו']),
  },
  ar: {
    pp: _fset(['شركتي', 'شركتنا', 'مشروعي', 'مشروعنا', 'منتجي', 'منتجنا', 'عملائي', 'عملائنا', 'زبائني', 'زبائننا', 'مستخدمي', 'مستخدمينا',
      'فريقي', 'فريقنا', 'مستثمري', 'مستثمرينا', 'مستثمرونا', 'إيراداتي', 'إيراداتنا', 'تسعيري', 'تسعيرنا', 'أسعاري', 'أسعارنا']),
    pos: _fset(['خطتي', 'خطتنا', 'فكرتي', 'فكرتنا', 'خاصتي', 'خاصتنا']),
    openers: _fset(['أنا', 'نحن', 'إنني', 'إننا', 'إني', 'لدي', 'لدينا', 'عندي', 'عندنا']),
    conj: _f(['و', 'ف', 'لكن', 'لذلك', 'لأن', 'أن', 'عندما', 'حين', 'بينما']),
  },
  zh: {
    pos: _fc(['我的', '我们的', '我們的', '咱们的', '咱們的', '我方']),
    ppAlone: _fc(['我司', '本公司', '敝公司']),
    venture: _fc(['公司', '创业公司', '初创公司', '企业', '企業', '产品', '產品', '客户', '客戶', '用户', '用戶', '团队', '團隊', '投资人', '投資人',
      '投资者', '投資者', '收入', '营收', '營收', '定价', '定價', '价格', '價格']),
    openers: _fc(['我们', '我們', '咱们', '咱們', '本人', '我']),
    conj: _fc(['而且', '但是', '但', '所以', '因为', '因為', '当', '當', '而']),
  },
  ja: {
    pos: _fc(['私の', 'わたしの', '私たちの', 'わたしたちの', '我々の', 'われわれの', '僕の', 'ぼくの', '俺の', 'おれの', 'うちの']),
    ppAlone: _fc(['弊社', '当社', '我が社']),
    venture: _fc(['会社', 'スタートアップ', '事業', '製品', '顧客', 'ユーザー', 'チーム', '投資家', '売上', '収益', '価格', '価格設定']),
    conj: _fc(['でも', 'しかし', 'そして', 'だから', 'ので', 'から', 'とき']),
  },
  el: {
    articles: _fset(['ο', 'η', 'το', 'οι', 'τα', 'τον', 'την', 'του', 'της', 'των', 'στο', 'στη', 'στην', 'στον']),
    mine: _fset(['μου', 'μας']),
    own: _fset(['δικό', 'δική', 'δικά', 'δικός']),
    venture: _f(['εταιρεια', 'startup', 'νεοφυης', 'επιχειρηση', 'προιον', 'πελατες', 'χρηστες', 'ομαδα', 'επενδυτες', 'εσοδα', 'τιμολογηση', 'τιμες']),
    openers: _f(['εγω', 'εμεις']),
    conj: _f(['και', 'αλλα', 'οποτε', 'γιατι', 'επειδη', 'οτι', 'οταν', 'ενω']),
  },
  ko: {
    poss: _fset(['내', '나의', '제', '저의', '우리', '우리의', '저희', '저희의']),
    venture: _fset(['회사', '스타트업', '사업', '제품', '고객', '사용자', '팀', '투자자', '매출', '수익', '가격']),
    openers: _f(['나는', '내가', '저는', '제가', '우리는', '우리가', '저희는', '저희가']),
    conj: _f(['그리고', '하지만', '그런데', '그래서', '왜냐하면']),
  },
  hi: {
    poss: _fset(['मेरा', 'मेरी', 'मेरे', 'हमारा', 'हमारी', 'हमारे', 'माझा', 'माझी', 'माझे', 'आमचा', 'आमची', 'आमचे', 'मेरो', 'हाम्रो']),
    venture: _fset(['कंपनी', 'स्टार्टअप', 'व्यवसाय', 'उत्पाद', 'ग्राहक', 'उपयोगकर्ता', 'टीम', 'निवेशक', 'राजस्व', 'आय', 'कीमत', 'मूल्य']),
    openers: _f(['मैं', 'हम', 'मुझे', 'हमें', 'मी', 'आम्ही', 'म', 'हामी']),
    conj: _f(['और', 'लेकिन', 'पर', 'इसलिए', 'क्योंकि', 'कि', 'जब', 'जबकि']),
  },
};

// The ja first-person opener (folded): (I) then optional (plural) then a
// particle; or (we, our company) then an optional particle. So 私立 is not an
// opener.
const JA_OPENER_RE = (function () {
  const a = ['私', 'わたし', '僕', 'ぼく', '俺', 'おれ'].map(compactView).join('|');
  const b = ['たち', 'ども'].map(compactView).join('|');
  const c = ['は', 'が', 'も', 'に', 'を', 'と', 'の'].map(compactView).join('|');
  const d = ['我々', 'われわれ', '弊社', '当社'].map(compactView).join('|');
  const e = ['は', 'が', 'も', 'に', 'を', 'と', 'の', 'では'].map(compactView).join('|');
  return new RegExp('^(?:(?:' + a + ')(?:' + b + ')?(?:' + c + ')|(?:' + d + ')(?:' + e + ')?)', 'u');
})();

// T3 Question words (first word), particles and endings.
const T3_WORDS = _fset(['qué', 'cómo', 'cuál', 'cuáles', 'cuándo', 'dónde', 'quién', 'quiénes', 'cuánto', 'cuánta', 'cuántos', 'cuántas',
  'explica', 'explique', 'compara', 'compare', 'define', 'describe',
  'как', 'что', 'почему', 'зачем', 'когда', 'где', 'куда', 'откуда', 'какой', 'какая', 'какое', 'какие', 'каким', 'какую', 'каких', 'чем',
  'чём', 'сколько', 'кто', 'ли', 'объясни', 'объясните', 'сравни', 'сравните', 'опиши', 'опишите', 'расскажи', 'расскажите', 'подскажи',
  'подскажите',
  'як', 'що', 'чому', 'навіщо', 'коли', 'де', 'який', 'яка', 'яке', 'які', 'скільки', 'хто', 'чи', 'поясни', 'поясніть', 'порівняй',
  'опиши',
  'מה', 'מהו', 'מהי', 'מהם', 'מהן', 'מי', 'איך', 'כיצד', 'למה', 'מדוע', 'מתי', 'איפה', 'היכן', 'האם', 'איזה', 'איזו', 'אילו', 'כמה',
  'הסבר', 'הסבירו', 'תסביר', 'השווה', 'תאר', 'הגדר',
  'كيف', 'ما', 'ماذا', 'لماذا', 'متى', 'أين', 'هل', 'أي', 'أية', 'كم', 'اشرح', 'قارن', 'عرف', 'صف',
  'τι', 'πως', 'γιατι', 'ποτε', 'που', 'ποιος', 'ποια', 'ποιο', 'ποιοι', 'ποιες', 'ποσο', 'ποσα', 'εξηγησε', 'συγκρινε', 'περιγραψε',
  'क्या', 'कैसे', 'क्यों', 'कब', 'कहाँ', 'कहां', 'कौन', 'कौनसा', 'कितना', 'कितनी', 'समझाइए', 'बताइए', 'तुलना']);
const T3_PAIRS = _fset(['por qué', 'कौन सा']);
const T3_KO = _fset(['무엇', '뭐', '무슨', '어떻게', '왜', '언제', '어디', '누구', '어느', '어떤', '몇', '얼마나', '설명해', '비교해']);
const T3_KO_FINAL = Object.freeze(['까', '나요', '가요', '니']);
const T3_ZH_FIRST = _fc(['如何', '怎么', '怎麼', '怎样', '怎樣', '什么', '什麼', '为什么', '為什麼', '为何', '為何', '哪', '谁', '誰', '几', '幾', '多少',
  '是否', '能否', '可否', '是不是']);
const T3_ZH_FINAL = _fc(['吗', '嗎', '呢']);
const T3_JA_FIRST = _fc(['どう', 'どの', 'どれ', 'どこ', 'なぜ', '何', 'なに', 'なん', 'いつ', '誰', 'だれ', 'いくつ', 'どうやって', 'どうして', 'どのように']);
const T3_JA_FINAL = _fc(['か', 'かな', 'かしら']);

// T4 At-words and dot-words of the obfuscated email.
const T4 = [
  { at: ['собака', 'собачка', 'равлик'], dot: ['точка', 'крапка'], spaced: true },
  { at: ['arroba'], dot: ['punto'], spaced: true },
  { at: ['שטרודל'], dot: ['נקודה'], spaced: true },
  { at: ['艾特'], dot: ['点', '點'], spaced: false },
  { at: ['アットマーク'], dot: ['ドット'], spaced: false },
  { at: ['παπακι'], dot: ['τελεια'], spaced: true },
  { at: ['골뱅이'], dot: ['점'], spaced: true },
  { at: ['एट'], dot: ['डॉट'], spaced: true },
].map(function (row) {
  const esc = function (w) { return checkView(w).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  const at = row.at.map(esc).join('|');
  const dot = row.dot.map(esc).join('|');
  const ws = row.spaced ? '\\s{1,8}' : '\\s{0,8}';
  const local = row.spaced ? '[\\p{L}\\p{N}._%+-]{1,64}' : '[\\p{L}\\p{N}._%+-]{1,64}?';
  const part = row.spaced ? '[\\p{L}\\p{N}-]{1,63}' : '[\\p{L}\\p{N}-]{1,63}?';
  const spaced = new RegExp('(?<![\\p{L}\\p{N}._%+-])' + local + ws + '(?:' + at + ')' + ws + part +
    '(?:' + ws + '(?:' + dot + ')' + ws + part + ')*?' + ws + '(?:' + dot + ')' + ws + '\\p{L}{2,63}', 'u');
  const bracket = new RegExp('[\\p{L}\\p{N}._%+-]{1,64}\\s{0,8}[\\[(]\\s{0,8}(?:' + at + ')\\s{0,8}[\\])]\\s{0,8}[\\p{L}\\p{N}-]{1,63}' +
    '(?:\\s{0,8}(?:[\\[(]\\s{0,8}(?:' + dot + ')\\s{0,8}[\\])]|\\.)\\s{0,8}[\\p{L}\\p{N}-]{1,63})*?\\s{0,8}' +
    '(?:[\\[(]\\s{0,8}(?:' + dot + ')\\s{0,8}[\\])]|\\.)\\s{0,8}\\p{L}{2,63}', 'u');
  return Object.freeze({ words: row.at.map(function (w) { return checkView(w).toLowerCase(); }), spaced: spaced, bracket: bracket });
});

// T5 Title cues (caseless scripts) and the titles before a TitleCase word.
const T5 = {
  he: _f(['מר', 'גב׳', 'גברת', 'ד"ר', 'דר׳', 'פרופ׳', 'פרופסור', 'עו"ד', 'רו"ח']),
  ar: _fset(['السيد', 'السيدة', 'الآنسة', 'الدكتور', 'الدكتورة', 'د', 'الأستاذ', 'الأستاذة', 'المهندس', 'المهندسة', 'الشيخ']),
  zh: new RegExp('\\p{Script=Han}{1,3}(?:' + _fc(['先生', '女士', '小姐']).join('|') + ')', 'u'),
  ja: new RegExp('[\\p{Script=Han}\\p{Script=Katakana}\\u30FC]{1,3}(?:' + _fc(['さん', 'さま', '氏', '先生', 'くん', 'ちゃん', '博士', '教授']).join('|') +
    ')(?=[' + ['は', 'が', 'も', 'に', 'を', 'と', 'の', 'で', 'へ', 'や', 'よ'].map(compactView).join('') + ']|[^\\p{L}]|$)', 'u'),
  ko: new Set(['씨', '선생님', '교수님', '박사님', '대표님']),
  koSuffix: /^[가-힣]{2,4}(?:씨|선생님|교수님|박사님|대표님)$/u,
  hiBefore: _fset(['श्री', 'श्रीमती', 'सुश्री', 'डॉ', 'डॉक्टर', 'प्रोफेसर']),
  hiAfter: _fset(['जी']),
  titles: _fset(['господин', 'госпожа', 'г-н', 'г-жа', 'пан', 'пані', 'κυριος', 'κυρια', 'δρ', 'señor', 'señora', 'señorita', 'sr', 'sra', 'srta',
    'don', 'doña', 'dr', 'dra']),
};

// T6 Head nouns (stems) and run-bridge function words of the TitleCase rule.
const T6_HEAD = Object.freeze(Array.from(new Set(['фреймворк', 'метод', 'методик', 'модел', 'пирамид', 'матриц', 'анализ', 'канвас', 'теори', 'принцип',
  'подход', 'схем', 'диаграмм', 'интервью', 'цикл', 'воронк', 'шкал', 'критери', 'сил', 'карт',
  'фреймворк', 'метод', 'методик', 'модел', 'пірамід', 'матриц', 'аналіз', 'канвас', 'теорі', 'принцип', 'підхід', 'схем', 'діаграм', 'інтерв',
  'цикл', 'воронк', 'шкал', 'критері', 'сил', 'карт',
  'πλαισι', 'μεθοδ', 'μοντελ', 'πυραμιδ', 'μητρ', 'αναλυσ', 'καμβ', 'θεωρι', 'αρχ', 'προσεγγισ', 'εργαλει', 'συνεντευξ', 'κυκλ', 'χαρτ', 'δυναμ',
  'marco', 'método', 'metodo', 'modelo', 'pirámide', 'piramide', 'matriz', 'análisis', 'analisis', 'lienzo', 'canvas', 'teoría', 'teoria',
  'principio', 'enfoque', 'mapa', 'diagrama', 'fuerzas', 'entrevista', 'ciclo', 'embudo', 'escala', 'criterio'].map(function (s) { return compactView(s); }))));
const T6_FN = _fset(['и', 'или', 'в', 'на', 'по', 'для', 'с', 'со', 'из', 'от', 'до', 'между', 'о', 'об', 'к',
  'і', 'й', 'або', 'в', 'у', 'на', 'по', 'для', 'з', 'із', 'від', 'до', 'між', 'про',
  'και', 'η', 'ο', 'το', 'τη', 'την', 'του', 'της', 'των', 'οι', 'τα', 'σε', 'στο', 'στη', 'στην', 'με', 'για', 'απο', 'προς',
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'en', 'con', 'para', 'por', 'entre', 'a', 'al']);

// ---------------------------------------------------------------------------
// Token sequence helpers
// ---------------------------------------------------------------------------
function _variantSet(ctx, i, prefix) {
  const key = (prefix ? 'p' : 'n') + i;
  let v = ctx.vcache.get(key);
  if (!v) {
    v = new Set(tokenVariants(ctx.toks[i], { prefix: prefix }));
    ctx.vcache.set(key, v);
  }
  return v;
}
function _tokIs(ctx, i, entry, prefix) {
  if (i < 0 || i >= ctx.toks.length) return false;
  if (ctx.toks[i] === entry) return true;
  return _variantSet(ctx, i, prefix).has(entry);
}
// A token sequence at position i: the first token may carry a Hebrew or
// Arabic prefix; every token may carry a Korean particle.
function _seqAt(ctx, i, seq) {
  if (i + seq.length > ctx.toks.length) return false;
  for (let j = 0; j < seq.length; j += 1) {
    if (!_tokIs(ctx, i + j, seq[j], j === 0)) return false;
  }
  return true;
}
function _seqAny(ctx, seqs) {
  for (let i = 0; i < ctx.toks.length; i += 1) {
    for (let s = 0; s < seqs.length; s += 1) if (_seqAt(ctx, i, seqs[s])) return true;
  }
  return false;
}
function _inSet(ctx, i, set, prefix) {
  if (i < 0 || i >= ctx.toks.length) return false;
  const vs = _variantSet(ctx, i, prefix);
  for (const v of vs) if (set.has(v)) return true;
  return false;
}
function _hasWordAt(ctx, i) {
  return i >= 0 && i < ctx.toks.length && /^\p{L}/u.test(ctx.toks[i]);
}
function _stemAt(ctx, i, stems, maxRest) {
  if (i < 0 || i >= ctx.toks.length) return false;
  const t = ctx.toks[i];
  if (!ONLY_CYR.test(t)) return false;
  for (let s = 0; s < stems.length; s += 1) {
    const stem = stems[s];
    if (!t.startsWith(stem)) continue;
    const rest = t.slice(stem.length);
    if (rest.length > maxRest) continue;
    if (stem.length <= 4 && rest !== '' && !/^[аеиоуыэюяіїєй]/u.test(rest)) continue;
    return true;
  }
  return false;
}
function _greekVentureAt(ctx, i) {
  if (i < 0 || i >= ctx.toks.length) return false;
  const t = ctx.toks[i];
  for (let s = 0; s < T2.el.venture.length; s += 1) {
    const e = T2.el.venture[s][0];
    if (t === e || _stemMatch(t, e)) return true;
  }
  return false;
}

// Clause splitting: the punctuation marks of P1 and P2, and a line break.
const CLAUSE_SPLIT = /[,;:.!?、。，；：！？؟،؛।॥…\n\r\u2028\u2029¿¡]+/u;

function _ctx(str) {
  const s = String(str).normalize('NFC');
  const ctx = {
    raw: s,
    toks: tableTokens(s),
    vcache: new Map(),
    compact: compactView(s),
    clauses: [],
    es: /[¿¡ñÑáéíóúüÁÉÍÓÚÜ]/u.test(s),
    he: RE.hebrew.test(s),
    ar: RE.arabic.test(s),
    cyr: RE.cyr.test(s),
    gr: RE.greek.test(s),
    ko: RE.hangul.test(s),
    hi: RE.deva.test(s),
    cjk: RE.hanKana.test(s),
    question: isQuestionText(s),
  };
  const parts = s.split(CLAUSE_SPLIT);
  for (let i = 0; i < parts.length; i += 1) {
    const toks = tableTokens(parts[i]);
    if (toks.length === 0) continue;
    ctx.clauses.push({ toks: toks, compact: compactView(parts[i]) });
  }
  return ctx;
}

// A clause context: the same helpers on the tokens of one clause.
function _clauseCtx(cl) {
  return { toks: cl.toks, vcache: new Map(), compact: cl.compact };
}

// ---------------------------------------------------------------------------
// isQuestionText: the parity of the English isQuestion
// ---------------------------------------------------------------------------
function isQuestionText(str) {
  try {
    const t = String(str).normalize('NFC').trim().replace(/[\s"'”’)\]}»」』）]+$/u, '');
    if (t.length === 0) return false;
    if (/[?؟？]$/u.test(t)) return true;
    if (/[;;]$/u.test(t) && RE.greek.test(t)) return true;
    const toks = tableTokens(t);
    if (toks.length > 0) {
      const first = toks[0];
      const vs = tokenVariants(first, { prefix: true });
      for (let i = 0; i < vs.length; i += 1) {
        if (T3_WORDS.has(vs[i]) || T3_KO.has(vs[i])) return true;
      }
      if (toks.length > 1 && T3_PAIRS.has(first + ' ' + toks[1])) return true;
      if (RE.hangul.test(t)) {
        const last = toks[toks.length - 1];
        for (let i = 0; i < T3_KO_FINAL.length; i += 1) if (last.endsWith(T3_KO_FINAL[i])) return true;
      }
    }
    if (RE.hanKana.test(t)) {
      const c = compactView(t);
      for (let i = 0; i < T3_ZH_FIRST.length; i += 1) if (c.startsWith(T3_ZH_FIRST[i])) return true;
      for (let i = 0; i < T3_JA_FIRST.length; i += 1) if (c.startsWith(T3_JA_FIRST[i])) return true;
      for (let i = 0; i < T3_ZH_FINAL.length; i += 1) if (c.endsWith(T3_ZH_FINAL[i])) return true;
      for (let i = 0; i < T3_JA_FINAL.length; i += 1) if (c.endsWith(T3_JA_FINAL[i])) return true;
    }
    return false;
  } catch (_e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// The private markers (shape split)
// ---------------------------------------------------------------------------
function _cyrPw(ctx) {
  for (let i = 0; i < ctx.toks.length; i += 1) {
    const t = ctx.toks[i];
    if (!ONLY_CYR.test(t)) continue;
    for (let s = 0; s < T1.cyr.pwStems.length; s += 1) if (t.startsWith(T1.cyr.pwStems[s])) return true;
    if (t.startsWith(T1.cyr.pwSecret) && t.length - T1.cyr.pwSecret.length <= 3 && !t.startsWith(T1.cyr.pwSecretNot)) return true;
  }
  return _seqAny(ctx, T1.cyr.pw);
}
function _cyrPc(ctx) {
  for (let i = 0; i < ctx.toks.length; i += 1) {
    const t = ctx.toks[i];
    if (!ONLY_CYR.test(t)) continue;
    for (let s = 0; s < T1.cyr.pcStems.length; s += 1) if (t.startsWith(T1.cyr.pcStems[s])) return true;
  }
  return _seqAny(ctx, T1.cyr.pc);
}
function _hasAny(hay, list) {
  for (let i = 0; i < list.length; i += 1) if (hay.indexOf(list[i]) !== -1) return true;
  return false;
}

// PC: every shape.
function _pcHit(ctx) {
  if (ctx.es && _seqAny(ctx, T1.es.pc)) return true;
  if (ctx.cyr && _cyrPc(ctx)) return true;
  if (ctx.ar && _seqAny(ctx, T1.ar.pc)) return true;
  if (ctx.cjk && (_hasAny(ctx.compact, T1.zh.pc) || _hasAny(ctx.compact, T1.ja.pc))) return true;
  if (ctx.gr && _seqAny(ctx, T1.el.pc)) return true;
  if (ctx.ko && _seqAny(ctx, T1.ko.pc)) return true;
  if (ctx.hi && _seqAny(ctx, T1.hi.pc)) return true;
  if (ctx.he && _seqAny(ctx, T1.he.pc)) return true;
  return false;
}

// PW: a sprout and a long edge.
function _pwHit(ctx) {
  if (ctx.es && _seqAny(ctx, T1.es.pw)) return true;
  if (ctx.cyr && _cyrPw(ctx)) return true;
  if (ctx.ar && _seqAny(ctx, T1.ar.pw)) return true;
  if (ctx.cjk && (_hasAny(ctx.compact, T1.zh.pw) || _hasAny(ctx.compact, T1.ja.pw))) return true;
  if (ctx.gr && _seqAny(ctx, T1.el.pw)) return true;
  if (ctx.ko && _seqAny(ctx, T1.ko.pw)) return true;
  if (ctx.hi && _seqAny(ctx, T1.hi.pw)) return true;
  return false;
}

// The ja possessive うちの right after の (そのうちの, このうちの) means "of them", not "our".
const JA_UCHI = compactView('うちの');
const JA_NO = compactView('の');
function _cjkPossFollowed(c, list, ventures, maxBetween) {
  for (let i = 0; i < list.length; i += 1) {
    let at = c.indexOf(list[i]);
    while (at !== -1) {
      if (list[i] === JA_UCHI && at > 0 && c.slice(at - JA_NO.length, at) === JA_NO) { at = c.indexOf(list[i], at + 1); continue; }
      const after = c.slice(at + list[i].length);
      if (ventures === null) {
        if (/^\p{L}/u.test(after)) return true;
      } else {
        for (let k = 0; k <= maxBetween; k += 1) {
          const rest = after.slice(k);
          for (let v = 0; v < ventures.length; v += 1) if (rest.startsWith(ventures[v])) return true;
        }
      }
      at = c.indexOf(list[i], at + 1);
    }
  }
  return false;
}

// POS: a possessive followed by a word; a sprout and a long edge.
function _posHit(ctx) {
  const n = ctx.toks.length;
  for (let i = 0; i < n; i += 1) {
    if (ctx.es && T2.es.poss.has(ctx.toks[i]) && _hasWordAt(ctx, i + 1)) return true;
    if (ctx.cyr && T2.cyr.poss.has(ctx.toks[i]) && _hasWordAt(ctx, i + 1)) return true;
    if (ctx.ar && _inSet(ctx, i, T2.ar.pos, true)) return true;
    if (ctx.ko && T2.ko.poss.has(ctx.toks[i]) && _hasWordAt(ctx, i + 1)) return true;
    if (ctx.hi && T2.hi.poss.has(ctx.toks[i]) && _hasWordAt(ctx, i + 1)) return true;
    if (ctx.gr) {
      if (T2.el.articles.has(ctx.toks[i]) && _hasWordAt(ctx, i + 1) && i + 2 < n && T2.el.mine.has(ctx.toks[i + 2])) return true;
      if (T2.el.own.has(ctx.toks[i]) && i + 1 < n && T2.el.mine.has(ctx.toks[i + 1])) return true;
    }
  }
  if (ctx.cjk && (_cjkPossFollowed(ctx.compact, T2.zh.pos, null, 0) || _cjkPossFollowed(ctx.compact, T2.ja.pos, null, 0))) return true;
  return false;
}

// The Arabic plural forms مستخدمي and مستثمري are also the construct state ("users of"): before a definite noun
// (a token that starts with ال) they are not a possessive.
const AR_CONSTRUCT = _fset(['مستخدمي', 'مستثمري']);
function _arConstruct(ctx, i) {
  if (!_inSet(ctx, i, AR_CONSTRUCT, true)) return false;
  const next = i + 1 < ctx.toks.length ? ctx.toks[i + 1] : '';
  return next.startsWith('ال') && next.length > 3;
}
// PP: a possessive with a venture noun (at most 1 word between); every shape.
function _ppHit(ctx) {
  const n = ctx.toks.length;
  for (let i = 0; i < n; i += 1) {
    if (ctx.es && T2.es.poss.has(ctx.toks[i]) && (T2.es.venture.has(ctx.toks[i + 1]) || T2.es.venture.has(ctx.toks[i + 2]))) return true;
    if (ctx.cyr && T2.cyr.poss.has(ctx.toks[i]) && (_stemAt(ctx, i + 1, T2.cyr.ventureStems, 4) || _stemAt(ctx, i + 2, T2.cyr.ventureStems, 4))) return true;
    if (ctx.ar && _inSet(ctx, i, T2.ar.pp, true) && !_arConstruct(ctx, i)) return true;
    if (ctx.ko && T2.ko.poss.has(ctx.toks[i]) && (_inSet(ctx, i + 1, T2.ko.venture, false) || _inSet(ctx, i + 2, T2.ko.venture, false))) return true;
    if (ctx.hi && T2.hi.poss.has(ctx.toks[i]) && (T2.hi.venture.has(ctx.toks[i + 1]) || T2.hi.venture.has(ctx.toks[i + 2]))) return true;
    if (ctx.gr && _greekVentureAt(ctx, i) && i + 1 < n && T2.el.mine.has(ctx.toks[i + 1])) return true;
    if (ctx.he) {
      if (_inSet(ctx, i, T2.he.suffix, true)) return true;
      if (_inSet(ctx, i, T2.he.venture, true) && (T2.he.mine.has(ctx.toks[i + 1]) || T2.he.mine.has(ctx.toks[i + 2]))) return true;
    }
  }
  if (ctx.cjk) {
    if (_hasAny(ctx.compact, T2.zh.ppAlone) || _hasAny(ctx.compact, T2.ja.ppAlone)) return true;
    if (_cjkPossFollowed(ctx.compact, T2.zh.pos, T2.zh.venture, 2)) return true;
    if (_cjkPossFollowed(ctx.compact, T2.ja.pos, T2.ja.venture, 2)) return true;
  }
  return false;
}

// The positions in a clause where a clause starts: 0, and right after a
// conjunction (single or multi-token).
function _starts(cctx, conjSeqs) {
  const out = [0];
  for (let i = 0; i < cctx.toks.length; i += 1) {
    for (let s = 0; s < conjSeqs.length; s += 1) {
      if (_seqAt(cctx, i, conjSeqs[s])) out.push(i + conjSeqs[s].length);
    }
  }
  return out;
}
function _openerAt(cctx, i, openers) {
  for (let s = 0; s < openers.length; s += 1) if (_seqAt(cctx, i, openers[s])) return true;
  return false;
}
function _arOpenerAt(cctx, i) {
  if (i < 0 || i >= cctx.toks.length) return false;
  const t = cctx.toks[i];
  if (T2.ar.openers.has(t)) return true;
  if ((t[0] === 'و' || t[0] === 'ف') && T2.ar.openers.has(t.slice(1))) return true;
  return false;
}
function _arPossAt(cctx, i) {
  return _inSet(cctx, i, T2.ar.pos, true) || _inSet(cctx, i, T2.ar.pp, true);
}
// A clause of zh or ja (compact) starts with a form of the list, or holds a
// conjunction directly followed by one.
function _cjkStartForm(c, list, conj, re) {
  const test = function (x) {
    if (re && re.test(x)) return true;
    for (let i = 0; i < list.length; i += 1) if (x.startsWith(list[i])) return true;
    return false;
  };
  if (test(c)) return true;
  for (let k = 0; k < conj.length; k += 1) {
    let at = c.indexOf(conj[k]);
    while (at !== -1) {
      if (test(c.slice(at + conj[k].length))) return true;
      at = c.indexOf(conj[k], at + 1);
    }
  }
  return false;
}

// P1: a first-person opener as the first word of the text or of a clause;
// a sprout and a long edge, question or not.
function _p1Hit(ctx) {
  for (let c = 0; c < ctx.clauses.length; c += 1) {
    const cl = ctx.clauses[c];
    const cctx = _clauseCtx(cl);
    if (ctx.es) { const st = _starts(cctx, T2.es.conj); for (let k = 0; k < st.length; k += 1) if (_openerAt(cctx, st[k], T2.es.openers)) return true; }
    if (ctx.cyr) { const st = _starts(cctx, T2.cyr.conj); for (let k = 0; k < st.length; k += 1) if (_openerAt(cctx, st[k], T2.cyr.openers)) return true; }
    if (ctx.ar) { const st = _starts(cctx, T2.ar.conj); for (let k = 0; k < st.length; k += 1) if (_arOpenerAt(cctx, st[k])) return true; }
    if (ctx.gr) { const st = _starts(cctx, T2.el.conj); for (let k = 0; k < st.length; k += 1) if (_openerAt(cctx, st[k], T2.el.openers)) return true; }
    if (ctx.ko) { const st = _starts(cctx, T2.ko.conj); for (let k = 0; k < st.length; k += 1) if (_openerAt(cctx, st[k], T2.ko.openers)) return true; }
    if (ctx.hi) { const st = _starts(cctx, T2.hi.conj); for (let k = 0; k < st.length; k += 1) if (_openerAt(cctx, st[k], T2.hi.openers)) return true; }
    if (ctx.cjk && cl.compact) {
      if (_cjkStartForm(cl.compact, T2.zh.openers, T2.zh.conj, null)) return true;
      if (_cjkStartForm(cl.compact, [], T2.ja.conj, JA_OPENER_RE)) return true;
    }
  }
  return false;
}

// P2: a first-person opener or possessive at a clause start or directly after
// a conjunction, in a text that is not question-shaped; every shape.
function _p2Hit(ctx) {
  for (let c = 0; c < ctx.clauses.length; c += 1) {
    const cl = ctx.clauses[c];
    const cctx = _clauseCtx(cl);
    const possAt = function (set, i) { return i < cctx.toks.length && set.has(cctx.toks[i]) && _hasWordAt(cctx, i + 1); };
    if (ctx.es) { const st = _starts(cctx, T2.es.conj); for (let k = 0; k < st.length; k += 1) if (_openerAt(cctx, st[k], T2.es.openers) || possAt(T2.es.poss, st[k])) return true; }
    if (ctx.cyr) { const st = _starts(cctx, T2.cyr.conj); for (let k = 0; k < st.length; k += 1) if (_openerAt(cctx, st[k], T2.cyr.openers) || possAt(T2.cyr.poss, st[k])) return true; }
    if (ctx.ar) { const st = _starts(cctx, T2.ar.conj); for (let k = 0; k < st.length; k += 1) if (_arOpenerAt(cctx, st[k]) || _arPossAt(cctx, st[k])) return true; }
    if (ctx.gr) { const st = _starts(cctx, T2.el.conj); for (let k = 0; k < st.length; k += 1) if (_openerAt(cctx, st[k], T2.el.openers)) return true; }
    if (ctx.ko) { const st = _starts(cctx, T2.ko.conj); for (let k = 0; k < st.length; k += 1) if (_openerAt(cctx, st[k], T2.ko.openers) || possAt(T2.ko.poss, st[k])) return true; }
    if (ctx.hi) { const st = _starts(cctx, T2.hi.conj); for (let k = 0; k < st.length; k += 1) if (_openerAt(cctx, st[k], T2.hi.openers) || possAt(T2.hi.poss, st[k])) return true; }
    if (ctx.he && cctx.toks.length > 0 && T2.he.p2.has(cctx.toks[0])) return true;
    if (ctx.cjk && cl.compact) {
      if (_cjkStartForm(cl.compact, T2.zh.openers.concat(T2.zh.pos), T2.zh.conj, null)) return true;
      if (_cjkStartForm(cl.compact, T2.ja.pos, T2.ja.conj, JA_OPENER_RE)) return true;
    }
  }
  if (ctx.he && _seqAny(ctx, T2.he.t2b)) return true;
  return false;
}

// hasPrivateMarker(str, shape) -> boolean, with the English shape split. In a
// sprout or a long edge (or with no shape): PW, PC, POS, PP, P1 and P2. In a
// short edge: PC, PP and P2. P2 only in a text that is not question-shaped.
// The Hebrew PW, POS and P1 rows are the guard's own Hebrew marker call,
// gated to a sprout and a long edge; this function adds the Hebrew PC, PP and
// P2 rows.
function hasPrivateMarker(str, shape) {
  try {
    const s = String(str);
    if (!needsScriptProof(s)) return false;
    const kind = shape && shape.kind;
    const full = !shape || kind === 'sprout' || kind === 'body' || shape.longEdge === true;
    const ctx = _ctx(s);
    if (_pcHit(ctx) || _ppHit(ctx)) return true;
    if (!ctx.question && _p2Hit(ctx)) return true;
    if (full && (_pwHit(ctx) || _posHit(ctx) || _p1Hit(ctx))) return true;
    return false;
  } catch (_e) {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Email, phone and identifier shapes
// ---------------------------------------------------------------------------
const EMAIL_CH = /^[\p{L}\p{N}._-]$/u;
const LETTER_ONE = /^\p{L}$/u;
// The Unicode email @[\p{L}\p{N}._-]{1,253}\.\p{L}{2,63}, as a linear scan.
function _unicodeEmail(v) {
  let at = v.indexOf('@');
  while (at !== -1) {
    const cps = [];
    let j = at + 1;
    while (j < v.length && cps.length < 320) {
      const cp = v.codePointAt(j);
      const ch = String.fromCodePoint(cp);
      if (!EMAIL_CH.test(ch)) break;
      cps.push(ch);
      j += ch.length;
    }
    for (let p = 1; p < cps.length && p <= 253; p += 1) {
      if (cps[p] === '.' && p + 2 < cps.length + 1 && LETTER_ONE.test(cps[p + 1] || '') && LETTER_ONE.test(cps[p + 2] || '')) return true;
    }
    at = v.indexOf('@', at + 1);
  }
  return false;
}
function _atWordEmail(v) {
  const lower = v.toLowerCase();
  for (let r = 0; r < T4.length; r += 1) {
    const row = T4[r];
    let present = false;
    for (let w = 0; w < row.words.length; w += 1) if (lower.indexOf(row.words[w]) !== -1) present = true;
    if (!present) continue;
    if (row.spaced.test(lower) || row.bracket.test(lower)) return true;
  }
  return false;
}

// hasAlwaysShape(str, ALWAYS_PATTERNS) -> boolean: the guard's ALWAYS
// patterns on the check view (when it differs: native and fullwidth digits),
// a Unicode email, and the at-word email of T4.
function hasAlwaysShape(str, patterns) {
  try {
    const s = String(str);
    const v = checkView(s);
    if (v !== s && Array.isArray(patterns)) {
      for (let i = 0; i < patterns.length; i += 1) {
        const p = patterns[i];
        if (p.global || p.sticky) p.lastIndex = 0;
        if (p.test(v)) return true;
      }
    }
    if (v.indexOf('@') !== -1 && _unicodeEmail(v)) return true;
    if (_atWordEmail(v)) return true;
    return false;
  } catch (_e) {
    return true;
  }
}

// hasIdentifier(str, asciiRule) -> boolean: the ASCII identifier rule on the
// check view (when it differs), and a Unicode capital run of 5 or more that
// holds a digit, a capital letter and at least 1 non-ASCII letter.
function hasIdentifier(str, asciiRule) {
  try {
    const s = String(str);
    const v = checkView(s);
    if (v !== s && typeof asciiRule === 'function' && asciiRule(v)) return true;
    const re = /(?<![\p{L}\p{N}])[\p{Lu}\p{Nd}]{5,}(?![\p{L}\p{N}])/gu;
    let m;
    while ((m = re.exec(v)) !== null) {
      const t = m[0];
      if (/\p{Nd}/u.test(t) && /\p{Lu}/u.test(t) && /[^\x00-\x7F]/.test(t)) return true;
    }
    return false;
  } catch (_e) {
    return true;
  }
}

// ---------------------------------------------------------------------------
// The mixed-script token rule
// ---------------------------------------------------------------------------
const MIX_OTHER = /[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Arabic}\p{Script=Hebrew}]/u;
function _isMixedToken(t) {
  let seq = '';
  for (const ch of t) {
    if (RE.latin.test(ch)) seq += 'L';
    else if (MIX_OTHER.test(ch)) seq += 'N';
  }
  const runs = seq.replace(/(.)\1+/g, '$1');
  if (runs.length < 2) return false;
  if (runs.length > 2) return true;
  // Exactly one boundary: the W2 affix exemption. The Latin part then takes
  // every rule as its own token (the lexicon reads the W2 variant).
  return _affixLatinPart(t.toLowerCase()) === null;
}
// hasMixedScriptToken(str) -> boolean: a token that holds Latin letters
// together with Cyrillic, Greek, Arabic or Hebrew letters, minus the W2 affix
// forms. A hyphen, a geresh, a gershayim or an apostrophe splits a token.
function hasMixedScriptToken(str) {
  try {
    const v = checkView(String(str));
    const toks = v.split(/[^\p{L}\p{N}]+/u);
    for (let i = 0; i < toks.length; i += 1) {
      const t = toks[i];
      if (!t || !RE.latin.test(t) || !MIX_OTHER.test(t)) continue;
      if (_isMixedToken(t)) return true;
    }
    return false;
  } catch (_e) {
    return true;
  }
}

// ---------------------------------------------------------------------------
// The edge name rule
// ---------------------------------------------------------------------------
const ES_EVIDENCE_LETTER = /[ñÑáéíóúüÁÉÍÓÚÜ]/u;
const TC_TOKEN = /[\p{L}\p{M}\p{N}]+(?:-[\p{L}\p{M}\p{N}]+)*/gu;

function _words(text) {
  const words = [];
  TC_TOKEN.lastIndex = 0;
  let m;
  while ((m = TC_TOKEN.exec(text)) !== null) {
    const w = m[0];
    const view = checkView(w);
    words.push({
      w: w,
      idx: m.index,
      view: view,
      lc: view.toLowerCase(),
      cased: RE.cyr.test(w) || RE.greek.test(w) || ES_EVIDENCE_LETTER.test(w),
      title: /^\p{Lu}\p{Ll}/u.test(view),
    });
  }
  return words;
}
function _sentenceInitial(text, idx, greek) {
  let k = idx;
  while (k > 0) {
    const c = text[k - 1];
    if (c === '¿' || c === '¡') return true;
    if (/[\s"'“‘„«(\[{*_`#-]/u.test(c)) { k -= 1; continue; }
    break;
  }
  if (k === 0) return true;
  const p = text[k - 1];
  if ('.!?؟…。।\n\r\u2028\u2029'.indexOf(p) !== -1) return true;
  return greek && p === ';';
}
function _isFn(lc, sets) {
  if (T3_WORDS.has(lc) || T6_FN.has(lc) || T3_KO.has(lc)) return true;
  if (sets && sets.functionWords && sets.functionWords.has(lc)) return true;
  if (sets && sets.methodologyTokens && sets.methodologyTokens.has(lc)) return true;
  return false;
}
function _isHead(lc, sets) {
  for (let i = 0; i < T6_HEAD.length; i += 1) if (lc.startsWith(T6_HEAD[i])) return true;
  return !!(sets && sets.headNouns && sets.headNouns.has(lc));
}
function _adjacent(text, x, y) {
  return /^[ \t]+$/.test(text.slice(x.idx + x.w.length, y.idx));
}
// The exemptions of the TitleCase rule for word j (the parity of the ASCII
// rule): hyphenated, sentence-initial, a function or question word, within 2
// tokens of a head noun, or inside a run that holds a head noun.
function _wordExempt(words, j, text, sets) {
  const w = words[j];
  if (!w.title) return true;
  if (w.w.indexOf('-') !== -1) return true;
  if (_sentenceInitial(text, w.idx, RE.greek.test(text))) return true;
  if (_isFn(w.lc, sets)) return true;
  for (let k = Math.max(0, j - 2); k <= Math.min(words.length - 1, j + 2); k += 1) {
    if (_isHead(words[k].lc, sets)) return true;
  }
  const isTitle = function (x) { return x.title; };
  const isFnW = function (x) { return _isFn(x.lc, sets); };
  let lo = j;
  while (lo - 1 >= 0 && _adjacent(text, words[lo - 1], words[lo]) &&
    (isTitle(words[lo - 1]) || (isFnW(words[lo - 1]) && lo - 2 >= 0 && isTitle(words[lo - 2])))) lo -= 1;
  let hi = j;
  while (hi + 1 < words.length && _adjacent(text, words[hi], words[hi + 1]) &&
    (isTitle(words[hi + 1]) || (isFnW(words[hi + 1]) && hi + 2 < words.length && isTitle(words[hi + 2])))) hi += 1;
  for (let k = lo; k <= hi; k += 1) if (_isHead(words[k].lc, sets)) return true;
  if (lo - 1 >= 0 && _adjacent(text, words[lo - 1], words[lo]) && _isHead(words[lo - 1].lc, sets)) return true;
  if (hi + 1 < words.length && _adjacent(text, words[hi], words[hi + 1]) && _isHead(words[hi + 1].lc, sets)) return true;
  return false;
}
function _titleCaseHit(text, sets) {
  const words = _words(text);
  for (let j = 0; j < words.length; j += 1) {
    const w = words[j];
    if (!w.cased || !w.title) continue;
    if (_wordExempt(words, j, text, sets)) continue;
    return true;
  }
  for (let j = 0; j + 1 < words.length; j += 1) {
    if (T5.titles.has(words[j].lc.replace(/[^\p{L}\p{N}]+/gu, '')) || T5.titles.has(words[j].lc)) {
      if (words[j + 1].title && _adjacent(text, words[j], words[j + 1])) return true;
    }
  }
  return false;
}
function _cueHit(text) {
  const ctx = { toks: tableTokens(text), vcache: new Map() };
  const n = ctx.toks.length;
  if (RE.hebrew.test(text)) {
    for (let i = 0; i < n; i += 1) {
      for (let s = 0; s < T5.he.length; s += 1) {
        const seq = T5.he[s];
        let ok = i + seq.length < n;
        for (let k = 0; ok && k < seq.length; k += 1) ok = _variantSet(ctx, i + k, k === 0).has(seq[k]);
        if (ok && _hasWordAt(ctx, i + seq.length)) return true;
      }
    }
  }
  if (RE.arabic.test(text)) {
    for (let i = 0; i + 1 < n; i += 1) if (_inSet(ctx, i, T5.ar, true) && _hasWordAt(ctx, i + 1)) return true;
  }
  if (RE.han.test(text) && T5.zh.test(compactView(text))) return true;
  if (RE.hanKana.test(text) && T5.ja.test(checkView(text).toLowerCase())) return true;
  if (RE.hangul.test(text)) {
    for (let i = 0; i < n; i += 1) {
      const vs = _variantSet(ctx, i, false);
      for (const v of vs) {
        if (T5.ko.has(v) && i > 0 && RE.hangul.test(ctx.toks[i - 1])) return true;
        if (T5.koSuffix.test(v)) return true;
      }
    }
  }
  if (RE.deva.test(text)) {
    for (let i = 0; i < n; i += 1) {
      if (T5.hiBefore.has(ctx.toks[i]) && _hasWordAt(ctx, i + 1)) return true;
      if (T5.hiAfter.has(ctx.toks[i]) && i > 0) return true;
    }
  }
  return false;
}

// hasEdgeNameRule(str, sets) -> boolean (edge path only): a TitleCase word
// of a cased script (Cyrillic, Greek, or a Latin word with a Spanish evidence
// letter) that no exemption covers, a title before a TitleCase word, or a
// title cue of a caseless script. A bare caseless name with no cue may pass
// (OWNER-REDUCE). sets: the guard's functionWords, methodologyTokens and
// headNouns (English).
function hasEdgeNameRule(str, sets) {
  try {
    const text = String(str).normalize('NFC');
    if (!needsScriptProof(text)) return false;
    return _titleCaseHit(text, sets) || _cueHit(text);
  } catch (_e) {
    return true;
  }
}

// nameFragmentExempt(work, idx, len, sets) -> boolean, for the guard's ASCII
// name rule. The ASCII rule reads only [A-Za-z] runs, so a Spanish word with
// an accent (Cuál) reads as the fragment Cu, and an opening question mark
// (the inverted one) hides the sentence start. The fragment is exempt when
// (i) an inverted question or exclamation mark opens it, or (ii) it is a
// piece of a word with a Spanish evidence letter and that whole word is
// exempt under the TitleCase rule. Otherwise the ASCII rule goes on.
function nameFragmentExempt(work, idx, len, sets) {
  try {
    const text = String(work);
    let k = idx;
    while (k > 0 && /[\s"'“‘(\[]/u.test(text[k - 1])) k -= 1;
    if (k > 0 && (text[k - 1] === '¿' || text[k - 1] === '¡')) return true;
    const before = idx > 0 ? text[idx - 1] : '';
    const after = idx + len < text.length ? text[idx + len] : '';
    const ev = /[ñÑáéíóúüÁÉÍÓÚÜ\p{M}]/u;
    if (!ev.test(before) && !ev.test(after)) return false;
    let a = idx;
    while (a > 0 && /[\p{L}\p{M}]/u.test(text[a - 1])) a -= 1;
    const words = _words(text);
    for (let j = 0; j < words.length; j += 1) {
      if (words[j].idx === a) return _wordExempt(words, j, text, sets);
    }
    return false;
  } catch (_e) {
    return false;
  }
}

// proseOnView(str, PROSE_PATTERNS) -> boolean: the guard's prose patterns on
// the check view (native digits), when the view differs.
function proseOnView(str, patterns) {
  try {
    const s = String(str);
    const v = checkView(s);
    if (v === s || !Array.isArray(patterns)) return false;
    for (let i = 0; i < patterns.length; i += 1) {
      const p = patterns[i];
      if (p.global || p.sticky) p.lastIndex = 0;
      if (p.test(v)) return true;
    }
    return false;
  } catch (_e) {
    return true;
  }
}

// cjkClaimContent(text) -> the content words of a Han or Kana claim: the
// word-like segments of 2 or more letters (a digit counts).
function cjkClaimContent(text) {
  const out = [];
  try {
    const t = checkView(String(text)).toLowerCase();
    const seg = _segmenter(RE.kana.test(t));
    if (!seg) return out;
    for (const s of seg.segment(t)) {
      if (!s.isWordLike) continue;
      const w = s.segment.replace(/[^\p{L}\p{N}]+/gu, '');
      if (w.length >= 2 || /\p{N}/u.test(w)) out.push(w);
    }
  } catch (_e) {
    return [];
  }
  return Array.from(new Set(out));
}

module.exports = {
  needsScriptProof: needsScriptProof,
  hasUnprovableScript: hasUnprovableScript,
  checkView: checkView,
  foldDigits: foldDigits,
  confusableFold: confusableFold,
  isQuestionText: isQuestionText,
  hasPrivateMarker: hasPrivateMarker,
  hasAlwaysShape: hasAlwaysShape,
  hasIdentifier: hasIdentifier,
  hasMixedScriptToken: hasMixedScriptToken,
  hasEdgeNameRule: hasEdgeNameRule,
  proseOnView: proseOnView,
  countSpacelessWords: countSpacelessWords,
  hasSpacelessLetter: hasSpacelessLetter,
  lexTokens: lexTokens,
  tokenVariants: tokenVariants,
  tokenMatches: tokenMatches,
  nameFragmentExempt: nameFragmentExempt,
  compactView: compactView,
  cjkClaimContent: cjkClaimContent,
};
