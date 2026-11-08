/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 392-03 (Phase 392, Part 8): the one text normaliser the Part 8 guard
 * and rs-egress-prompts run before any pattern.
 *
 * Why: every Part 8 pattern (credential shapes, email and phone shapes, the
 * prose rules, the name rules, the closed-vocabulary proof) is written for the
 * plain form of the text. Two cheap disguises defeated them on beta.81
 * (audit bypass item 8 of F6): compatibility variants of the same letters
 * (fullwidth forms, ligatures, superscripts) and invisible format characters
 * (zero width space, zero width joiner, soft hyphen, word joiner) placed
 * between the characters of a key or an address.
 *
 * normalizeForGuard(text) -> string
 *   1. Unicode NFKC: a compatibility variant folds to its plain form
 *      (U+FF41 fullwidth a -> a, the fi ligature -> fi, a superscript 2 -> 2).
 *   2. Strip every \p{Cf} format character.
 *   A non-string returns an empty string; the function never throws.
 *
 * FORMAT_CHAR_RE is the \p{Cf} pattern with the g and u flags, for a replace
 * call. A caller that wants test() must build its own copy from .source (a g
 * regex keeps lastIndex between calls).
 *
 * The guard applies this at both of its entry points (classify and
 * theoVerdict) to every string leaf of the payload, so the lexicon check, the
 * credential shapes, the sprout shape and the typed proof all see the
 * normalised text. rs-egress-prompts applies it inside auditQueryString and
 * auditQueryObject. No other module needs a private copy.
 *
 * Pure CJS, zero dependencies. No em dash and no en dash anywhere.
 */
'use strict';

const FORMAT_CHAR_RE = /\p{Cf}/gu;

function normalizeForGuard(text) {
  if (typeof text !== 'string') return '';
  let out = text;
  try {
    out = text.normalize('NFKC');
  } catch (_e) {
    out = text;
  }
  return out.replace(FORMAT_CHAR_RE, '');
}

module.exports = {
  normalizeForGuard: normalizeForGuard,
  FORMAT_CHAR_RE: FORMAT_CHAR_RE,
};
