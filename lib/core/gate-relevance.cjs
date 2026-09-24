// lib/core/gate-relevance.cjs -- Phase 210-05 (item 210-E-1, the relevance gate)
//
// THE shared relevance predicate in front of Phase 209's force-fire machinery.
// scripts/check-card-fire.cjs (the Stop-hook backstop) consults these predicates
// BEFORE its final intercept so the engine can distinguish "a genuine unanswered
// fork" from "a follow-up already answered" (the 2026-07-02 live incident) and
// from "a stale artifact with zero connection to the current conversation".
//
// Four exports:
//   - extractOptionLabels(text)        : the option-label extraction + normalization
//                                        MOVED (not copied) from check-card-fire.cjs's
//                                        gateSignature so there is exactly ONE
//                                        implementation (retry keys must stay
//                                        byte-equivalent across the move).
//   - gateAlreadyAnswered(userText, gateLabels) : did the preceding user turn already
//                                        plainly answer the gate?
//   - gateTopicallyRelevant(userText, gateText) : does the gate's subject matter have
//                                        ANY connection to the current turn? false
//                                        ONLY on zero subject-token overlap (the
//                                        stale-artifact pattern).
//   - isYesNoShapedGate(gateLabels)    : is a 2-option gate a YES/NO-shaped closer
//                                        (intern-w1-card-discipline-decay, 2026-07-11)?
//                                        Extracted from gateAlreadyAnswered's own
//                                        answer-matching so check-card-fire.cjs's
//                                        `gate-is-simple-binary` exemption can reuse
//                                        the same semantic test instead of a bare
//                                        2-option cardinality check.
//   - gateSubjectTokens(text)          : stop-hook-fires-card-on-option-shaped-prose-
//                                        sentence (2026-09-17, RECLASSIFICATION) -- the
//                                        GATE side of gateTopicallyRelevant's overlap
//                                        check, with the gate shape's own boilerplate/
//                                        chrome (GATE_BOILERPLATE_TOKENS) stripped so a
//                                        meta-conversation about sessions/rooms/gates
//                                        cannot satisfy relevance for an unrelated real
//                                        gate purely on structural wording. Exported for
//                                        direct test coverage of the stripping itself.
//
// CONSERVATIVE VERDICT CONTRACT (Pitfall 3 -- bare removal is forbidden): on empty,
// absent, or unparseable user text the verdicts are answered=false / relevant=true,
// so uncertainty ALWAYS defaults to intercept. The Phase 209 guarantee (a genuine,
// relevant, unanswered fork still force-fires) is the reverse-regression floor.
//
// CR-03 INVARIANT (enforced by the caller, restated here): the preceding user text
// feeds ONLY these relevance verdicts. It must NEVER be folded into gateSignature
// or turnContextHash -- the retry key is anchored on gate-identifying content alone.
//
// Canon Part 8 (Graph Boundary): pure LOCAL string work. Zero network, zero Brain,
// zero fs. Deterministic (no clock, no random). Every function is input-guarded and
// never throws (the check-card-fire predicate-header contract).
//
// House rule: hyphens only, no em-dashes. CJS module, node built-ins only.

'use strict';

// ---------------------------------------------------------------------------
// OPTION_LABEL_RE -- MOVED from scripts/check-card-fire.cjs::gateSignature
// (Phase 210-05). An option-label line is `[n] text`, `n) text`, or `n. text`
// where n is a SINGLE low ordinal (1-9) AND a whitespace separator follows the
// marker. The whitespace requirement is load-bearing: it rejects a decimal
// number like `0.123456789` (no space after the dot) from being mistaken for
// an `n.` option marker, which would inject a volatile phantom label and flap
// the retry-key signature across retries (the exact bug that broke the
// growing-transcript convergence).
// ---------------------------------------------------------------------------
const OPTION_LABEL_RE = /^\s*(?:\[\s*[1-9]\s*\]|[1-9][).])\s+(.+?)\s*$/;

// The unambiguous plain-text affirmation / negation token sets for the 2-option
// yes/no gate shape (the live-incident "yes"). Deliberately NARROW: a token
// outside these sets is NOT treated as an answer (conservative -> intercept).
const AFFIRMATIONS = Object.freeze(new Set([
  'yes', 'y', 'yeah', 'yep', 'sure', 'ok', 'okay',
  'confirm', 'confirmed', 'approve', 'approved',
  'go', 'goahead', 'proceed', 'doit',
]));
const NEGATIONS = Object.freeze(new Set([
  'no', 'n', 'nope', 'nah', 'hold', 'stop', 'cancel',
  'dont', 'notnow', 'later', 'abort', 'skip',
]));

// Subject-token filter for the topical-relevance check: tokens shorter than
// MIN_SUBJECT_TOKEN_LEN or in the stopword set carry no subject signal, so a
// shared "the"/"with"/"that" can never make a stale gate look relevant.
const MIN_SUBJECT_TOKEN_LEN = 4;

// The irrelevance pass needs REAL signal on the user side before it may fire: a
// turn with fewer than this many subject tokens (e.g. "option 2 please", "go on")
// carries too little evidence to declare ZERO connection, so the verdict stays
// conservative (relevant -> intercept). Proven necessary by the WR-06 floor in
// tests/test-ga4-card-fire-e2e-179.cjs (a terse "option 2 please" turn followed
// by a NEW un-fired gate must still block).
const MIN_USER_SUBJECT_TOKENS = 2;
const STOPWORDS = Object.freeze(new Set([
  'that', 'this', 'with', 'have', 'from', 'what', 'when', 'where', 'which',
  'will', 'would', 'could', 'should', 'your', 'yours', 'about', 'them',
  'they', 'their', 'then', 'than', 'does', 'been', 'were', 'into', 'over',
  'just', 'like', 'also', 'more', 'some', 'such', 'only', 'very', 'please',
  'thanks', 'thank', 'want', 'need', 'know', 'think', 'still', 'here',
  'there', 'while', 'because', 'after', 'before', 'between', 'again',
  'other', 'another', 'each', 'something', 'anything', 'everything',
]));

// GATE_BOILERPLATE_TOKENS -- stop-hook-fires-card-on-option-shaped-prose-
// sentence (2026-09-17, "RECLASSIFICATION" section) / card-fire-stale-f1-
// reach-suggestion-forces-block-regardless-of-relevance.md (the sibling
// PRIMARY-arm RCA these two words share): the gate side of the topical-
// overlap check previously used the SAME subjectTokens() as the user side,
// which cannot distinguish a gate's own STRUCTURAL/BOILERPLATE wording
// (present in EVERY render of that gate shape, regardless of which specific
// options are actually on offer) from its genuinely DISTINGUISHING content
// (the specific candidate names/labels that vary render to render). Live
// minimal repro, confirmed: a genuinely-reached, correctly-never-fired F.8
// room-bind gate (subject text "-- mindrianOS -- bind session -- select
// rooms -- ALIGN Just talk (no room) Start a new room") force-fired on an
// ordinary status turn that happened to use "session"/"room" vocabulary
// (exactly the vocabulary a conversation ABOUT this bug, or about rooms/
// sessions in general, naturally uses) -- the overlap was satisfied purely
// on the F.8 shape's OWN fixed chrome + reserved standing-option wording
// (scripts/intent-classifier.cjs's NO_ROOM_LABEL "dev repo / no room" and
// the always-offered "start a new room" escape), never on the actual
// candidate room name ("ALIGN") the turn would have to reference to be
// genuinely relevant.
//
// This list is deliberately SCOPED to the exact boilerplate vocabulary the
// live repro confirmed (the F.8 mint site's fixed header + reserved-option
// wording), not a broad cross-shape sweep -- gateSubjectTokens() below
// strips these from the GATE side of the comparison ONLY, never the user
// side, so a user who genuinely asks about "the ALIGN room" still matches
// on "align" (see tests/test-card-fire-relevance-gate.cjs leg 3, PRESERVE
// FLOOR, and Behavior 12/13 in tests/test-209-primary-sidechannel.cjs,
// which already fixture this exact F.8 subject shape with a real candidate
// room name preserved alongside it). Extending this list to cover other
// shapes' own fixed chrome (F.1's canonical-verb menu, F.0/F.2-F.9 default
// headers, etc.) is a reasonable follow-up but is deliberately NOT bundled
// here -- it would widen the blast radius well past what this pass's live
// repro actually confirmed, and several of those shapes' "boilerplate"
// (e.g. F.1's canonical verbs) is not chrome, it is the genuine option
// content, so a naive cross-shape sweep risks stripping real content
// instead of only chrome.
const GATE_BOILERPLATE_TOKENS = Object.freeze(new Set([
  'bind', 'session', 'room', 'rooms', 'select', 'start', 'talk', 'new',
]));

// F1_DIAL_CHROME_TOKENS -- Phase 357-07 (D-08a, R-F): extends the
// GATE_BOILERPLATE_TOKENS precedent (893cee043) to the F.1 engine-arm dial's OWN
// static template wording. The F.1 subject is the whole rendered dial
// (scripts/intent-classifier.cjs's engineArmSubject = rendered.text), so it always
// carries lib/hmi/dial-presenter.cjs's fixed chrome: the tri-context Decision Gate
// header ('- REACH - decision gate', 'LOCAL'/'BRAIN'/'SIGNAL', 'ranked'/'offline'/
// 'cold', 'prior'/'(offline)', '(none this turn)'), the 'Choose next reach:' prompt,
// the two cold-room framing lines, and the plain gauge band
// ('Investigate | Blend | Insight'). Live evidence, live-2026-09-23-02 (09:40:16Z,
// session 56924067): a human turn's ONLY overlap with a fresh F.1 subject was the
// single chrome token 'gate' (from the header's own '- REACH - decision gate'
// wording), with ZERO overlap on any distinguishing content -- and yet relevance
// held, force-blocking on chrome alone.
//
// Every token here is DERIVED FROM dial-presenter.cjs's STATIC TEMPLATE STRINGS
// ONLY, never from frequency (the RESEARCH Finding 5 30-day frequency list also
// contains genuine reach-content words like 'research', 'claim', 'brain' in other
// contexts -- a frequency-derived list would strip real content; this list does
// not, because every entry traces to a literal in the renderer). The drift test
// (tests/test-357-f1-chrome.cjs, Behavior F) re-derives these tokens from an
// independently-copied literal list and asserts an exact match, so a renderer edit
// that changes the chrome wording is caught rather than silently drifting.
//
// Same asymmetry as GATE_BOILERPLATE_TOKENS: stripped from the GATE side of the
// overlap check ONLY (gateSubjectTokens below), never the user side.
const F1_DIAL_CHROME_TOKENS = Object.freeze(new Set([
  'choose', 'next', 'reach', 'recommendation', 'offline', 'pick', 'nothing',
  'rank', 'anywhere', 'decision', 'gate', 'local', 'brain', 'signal', 'ranked',
  'cold', 'prior', 'none', 'turn', 'investigate', 'blend', 'insight',
]));

// normalizeAnswer(text) -- the SAME normalization gateSignature applies to option
// labels (lowercase, non-alphanumeric collapsed away), applied to a candidate
// answer so answers and labels compare in one token space. Never throws.
function normalizeAnswer(text) {
  if (typeof text !== 'string') return '';
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// subjectTokens(text) -- the subject-token set for the relevance overlap check:
// lowercase, split on non-alphanumeric runs, drop short tokens, stopwords, and
// pure numbers. Returns a Set of tokens. Never throws.
function subjectTokens(text) {
  const out = new Set();
  if (typeof text !== 'string' || !text) return out;
  const parts = text.toLowerCase().split(/[^a-z0-9]+/);
  for (const p of parts) {
    if (p.length < MIN_SUBJECT_TOKEN_LEN) continue;
    if (STOPWORDS.has(p)) continue;
    if (/^\d+$/.test(p)) continue;
    out.add(p);
  }
  return out;
}

/**
 * gateSubjectTokens(text) -- the GATE side of the topical-overlap comparison
 * ONLY: subjectTokens(text), further stripped of GATE_BOILERPLATE_TOKENS (the
 * gate shape's own fixed chrome + reserved standing-option wording, present
 * in EVERY render of that shape regardless of which specific options are
 * offered). Deliberately asymmetric with the user side (subjectTokens alone,
 * unfiltered) -- a user turn that happens to say "session" or "room" is not
 * thereby made MORE relevant to a specific gate, but it must not be treated
 * as LESS relevant either; only the gate's own subject tokens are pared down
 * to their distinguishing content. Never throws.
 * @param {*} text
 * @returns {Set<string>}
 */
function gateSubjectTokens(text) {
  const tokens = subjectTokens(text);
  const out = new Set();
  for (const t of tokens) {
    if (GATE_BOILERPLATE_TOKENS.has(t)) continue;
    // Phase 357-07 (D-08a, R-F): also strip the F.1 dial's own static chrome, same
    // asymmetric GATE-side-only rule as GATE_BOILERPLATE_TOKENS above.
    if (F1_DIAL_CHROME_TOKENS.has(t)) continue;
    out.add(t);
  }
  return out;
}

/**
 * extractOptionLabels(text) -- extract the normalized option-label set from
 * gate-shaped text. MOVED from scripts/check-card-fire.cjs::gateSignature
 * (Phase 210-05) so the retry-key signature and the relevance predicate share
 * exactly one implementation. Returns the deduped normalized labels in
 * encounter order (the caller sorts when it needs sorted output, exactly as
 * gateSignature did before the move). Never throws.
 * @param {*} text
 * @returns {string[]}
 */
function extractOptionLabels(text) {
  try {
    if (typeof text !== 'string' || !text) return [];
    const labelSet = [];
    const seen = new Set();
    const lines = text.split('\n');
    for (const line of lines) {
      const mm = line.match(OPTION_LABEL_RE);
      if (!mm) continue;
      const norm = mm[1].toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      labelSet.push(norm);
    }
    return labelSet;
  } catch (_e) {
    return [];
  }
}

/**
 * isYesNoShapedGate(gateLabels) -- true when a gate's option labels are a
 * YES/NO-SHAPED 2-option closer: exactly 2 labels, one starts with "yes",
 * the other starts with "no" (e.g. "Publish this release? 1. Yes 2. No").
 *
 * Extracted (not duplicated) from gateAlreadyAnswered's own answer-matching
 * branch (c) below (intern-w1-card-discipline-decay, 2026-07-11) so
 * scripts/check-card-fire.cjs's `gate-is-simple-binary` exemption can reuse
 * the SAME semantic test instead of a bare cardinality check
 * (`gateLabels.length === 2`). The bare count cannot distinguish a trivial
 * yes/no confirmation closer ("Want those?") from a genuine two-way
 * forced-choice strategic fork ("run research vs build the plan") -- both
 * have exactly 2 labels. This predicate is the semantic distinction: a
 * genuine fork's labels do not start with "yes"/"no", so it returns false
 * and the caller can still force-fire it. Pure, deterministic, never throws.
 * @param {*} gateLabels normalized labels (extractOptionLabels output)
 * @returns {boolean}
 */
function isYesNoShapedGate(gateLabels) {
  try {
    const labels = Array.isArray(gateLabels)
      ? gateLabels.filter(function (l) { return typeof l === 'string' && l; })
      : [];
    if (labels.length !== 2) return false;
    const hasYes = labels.some(function (l) { return l.indexOf('yes') === 0; });
    const hasNo = labels.some(function (l) { return l.indexOf('no') === 0; });
    return hasYes && hasNo;
  } catch (_e) {
    return false;
  }
}

/**
 * gateAlreadyAnswered(precedingUserText, gateLabels) -- true when the preceding
 * user turn already plainly answered the gate. Three NARROW answer shapes only:
 *   (a) the normalized user text exactly matches one of the gate's normalized
 *       option labels;
 *   (b) the user text is a single ordinal (1-9) naming an existing option;
 *   (c) the user text is an unambiguous plain-text affirmation/negation of a
 *       2-option yes/no-shaped gate (isYesNoShapedGate -- the live-incident
 *       "yes" shape).
 * Anything else, including empty/absent text, returns false (the CONSERVATIVE
 * verdict: uncertainty defaults to intercept). Pure, deterministic, never throws.
 * @param {*} precedingUserText
 * @param {*} gateLabels normalized labels (extractOptionLabels output)
 * @returns {boolean}
 */
function gateAlreadyAnswered(precedingUserText, gateLabels) {
  try {
    const norm = normalizeAnswer(precedingUserText);
    if (!norm) return false;
    const labels = Array.isArray(gateLabels)
      ? gateLabels.filter(function (l) { return typeof l === 'string' && l; })
      : [];
    if (labels.length === 0) return false;

    // (a) exact normalized-label match.
    if (labels.indexOf(norm) !== -1) return true;

    // (b) a single ordinal naming an existing option ("1", "2", ...).
    if (/^[1-9]$/.test(norm) && Number(norm) <= labels.length) return true;

    // (c) plain-text affirmation/negation of a 2-option yes/no-shaped gate.
    if (isYesNoShapedGate(labels) && (AFFIRMATIONS.has(norm) || NEGATIONS.has(norm))) {
      return true;
    }
    return false;
  } catch (_e) {
    return false;
  }
}

/**
 * gateTopicallyRelevant(precedingUserText, gateText, opts?) -- false ONLY when
 * the user turn and the gate's subject tokens have ZERO overlap (the
 * stale-artifact pattern), OR when the turn is low-signal AND the caller has
 * marked the gate STALE (opts.gateStale === true). Empty/absent user text, empty
 * gate text, or an all-stopword turn against a FRESH gate all return true (the
 * CONSERVATIVE verdict: uncertainty defaults to intercept). Pure, deterministic,
 * never throws.
 *
 * The optional third argument is backward-compatible: every pre-existing caller
 * (and test) calls this with two arguments and gets byte-identical behavior --
 * the low-signal branch returns true, exactly as before.
 * @param {*} precedingUserText
 * @param {*} gateText
 * @param {{gateStale?: boolean}} [opts] caller-supplied gate staleness
 * @returns {boolean}
 */
function gateTopicallyRelevant(precedingUserText, gateText, opts) {
  try {
    const userTokens = subjectTokens(precedingUserText);
    if (userTokens.size < MIN_USER_SUBJECT_TOKENS) {
      // Low-signal turn: too few subject tokens to affirm a topical connection.
      // Historically this always defaulted to true (conservative: intercept),
      // which is correct when the gate is FRESH -- a terse "option 2 please"
      // right after a just-minted fork must still force (the WR-06 floor). But a
      // terse turn against a STALE gate (a prior turn's, or a prior session's,
      // reach still inside the side-file TTL and bled forward) is the dominant
      // over-enforcement class: the LEAST-connected turns were the exact ones
      // this floor blindly forced. card-fire-over-enforcement (2026-07-20): when
      // the caller marks the gate stale, a low-signal turn is NOT a connection,
      // so do not force. The distinction encoded here is the gate's STALENESS,
      // not the token count. Absent opts -> the original true, byte-for-byte.
      return opts && opts.gateStale === true ? false : true;
    }
    // gateSubjectTokens (not subjectTokens) -- strip the gate shape's own
    // boilerplate/chrome (GATE_BOILERPLATE_TOKENS) BEFORE the overlap check,
    // so a turn's incidental use of a gate's structural wording ("session",
    // "room", "bind", ...) can never, by itself, satisfy relevance for a
    // gate whose actual candidate content the turn never mentions. See
    // GATE_BOILERPLATE_TOKENS' own comment for the confirmed live repro.
    const gateTokens = gateSubjectTokens(gateText);
    if (gateTokens.size === 0) return true;
    // Prefix-stem overlap: two subject tokens overlap when they are equal OR one
    // is a prefix of the other ("start" vs "starting", "publish" vs "publishing").
    // Both sides are already >= MIN_SUBJECT_TOKEN_LEN, so a short function word can
    // never prefix-match. This deliberately errs toward RELEVANT (more intercepts,
    // never fewer genuine fires) -- proven necessary by the CR-02 growing-transcript
    // floor in tests/test-ga4-card-fire-e2e-179.cjs ("start a venture" must stay
    // relevant to "Choose your starting point").
    for (const u of userTokens) {
      for (const g of gateTokens) {
        if (u === g || u.indexOf(g) === 0 || g.indexOf(u) === 0) return true;
      }
    }
    return false;
  } catch (_e) {
    return true;
  }
}

module.exports = {
  extractOptionLabels,
  gateAlreadyAnswered,
  gateTopicallyRelevant,
  gateSubjectTokens,
  isYesNoShapedGate,
  subjectTokens,
  GATE_BOILERPLATE_TOKENS,
  F1_DIAL_CHROME_TOKENS,
  // normalizeOptionLabel -- Phase 359-01 (FORK359-03, RESEARCH Finding 2):
  // the SAME normalization extractOptionLabels applies inline to each
  // recovered label, exported additively so the 359 declared arm and replay
  // can normalize a declared label exactly as extractOptionLabels does
  // before isYesNoShapedGate. extractOptionLabels itself is deliberately NOT
  // refactored to call this -- gateSignature depends on its byte
  // equivalence (see the comment above extractOptionLabels).
  normalizeOptionLabel: normalizeAnswer,
};
