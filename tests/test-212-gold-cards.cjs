#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 212-04 -- D7 leg (a): the gold-card FIXTURE SUITE.
 *
 * WHAT THIS PROVES (and what it does NOT)
 *   This suite scores the CRITIC PIPELINE ROUTING against the 6 SEED-050 gold
 *   cards: given a deterministic judge answer derived from each card's human
 *   gold_label, does classifyCandidate's verdict-by-code route to the expected
 *   verdict? It verifies ROUTING (verdict-by-code, disagreement handling, and
 *   Stage A ordering), NOT real-judge accuracy -- plan 05's human-calibration
 *   checkpoint verifies a live judge against the >=0.85 bar. D3: the calibration
 *   base is the EXISTING gold set, not a new corpus.
 *
 *   archimedes-sterling is asserted FIRST, standalone, as the objective anchor:
 *   its critic_available is lean_checkable (Gate A objective ground truth), so we
 *   validate the judge routing HERE, on the case a proof assistant can settle,
 *   before trusting the same routing on the human-judged transfer cases.
 *
 * STAGE A vs STAGE B SCOPE (why the gates are relaxed here)
 *   Stage A's deterministic gate CALIBRATION (swap-invariance floor, entity floor,
 *   the fabricated-quantity kill) is proven separately in test-212-critic-stage-a.cjs
 *   with crafted stubs. Here the SUT is verdict-by-code, so we set the Stage A
 *   swap-invariance and entity floors to permissive stub thresholds (0) so every
 *   gold card reaches the two-pass rubric and the CODE computes the verdict from
 *   the judge's rubric answers. Stage A ORDERING (a fabricated-quantity candidate
 *   short-circuits BEFORE any judge call) is asserted directly at the end, using
 *   the real default gate.
 *
 * Zero network, zero model load: an injected content-sensitive stub encoder and
 * stub judgeFns exercise every path. gray-matter is the house frontmatter parser.
 */

// Relax the two content-shaped Stage A floors so the stub encoder + real card
// destinations reach Stage B. These thresholds are calibrated for the real
// mdbr-leaf-ir embedder; test-212-critic-stage-a.cjs owns their calibration.
process.env.EUREKA_SWAP_INVARIANCE_FLOOR = '0';
process.env.EUREKA_ENTITY_MIN = '0';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const matter = require('gray-matter');

const REPO = path.resolve(__dirname, '..');
const CASES_DIR = path.join(REPO, 'evals', 'eureka', 'cases');
const critic = require(path.join(REPO, 'lib/core/eureka-critic.cjs'));

// The four critic verdicts (the closed enum classifyCandidate can route to).
const VERDICT_ENUM = ['transferable', 'general_shallow', 'pseudoscience', 'restatement'];

// The 6 gold cards, sterling FIRST (the lean-checkable objective anchor).
const CARD_ORDER = [
  'archimedes-sterling',
  'archimedes-uq',
  'archimedes-darkmatter',
  'davinci-salient',
  'lovelace-lean',
  'nichefoods-null',
];

// ---------------------------------------------------------------------------
// Tiny async harness (house test-212-*.cjs shape).
// ---------------------------------------------------------------------------

let PASS = 0;
let FAIL = 0;
let SKIP = 0;

async function ok(label, fn) {
  try {
    const r = await fn();
    if (r === 'SKIP') { console.log('SKIP ' + label); SKIP += 1; return; }
    console.log('ok   ' + label);
    PASS += 1;
  } catch (e) {
    console.log('FAIL ' + label + ' -- ' + (e && e.message ? e.message : e));
    FAIL += 1;
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ---------------------------------------------------------------------------
// Deterministic content-sensitive stub encoder (offline). Hashed bag-of-tokens
// into a 64-dim unit vector: a real token change (the domain-swap perturbation)
// moves the vector, so the relaxed swap floor still exercises Gate 2's shape.
// ---------------------------------------------------------------------------

const STUB_DIM = 64;
function stubEncode(texts) {
  return texts.map(function (t) {
    const vec = new Array(STUB_DIM).fill(0);
    const toks = String(t || '').toLowerCase().match(/[a-z0-9]+/g) || [];
    for (let i = 0; i < toks.length; i += 1) {
      const h = crypto.createHash('sha1').update(toks[i]).digest();
      vec[h[0] % STUB_DIM] += (h[1] & 1) ? 1 : -1;
    }
    let n = 0;
    for (let i = 0; i < STUB_DIM; i += 1) n += vec[i] * vec[i];
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < STUB_DIM; i += 1) vec[i] /= n;
    return vec;
  });
}

// ---------------------------------------------------------------------------
// Gold-label-derived judge stubs. The judge NEVER picks the verdict; it answers
// the 6 binary rubric items and CODE (verdictFromRubric) computes the class. We
// derive the item answers from the card's human gold_label.salient:
//   transferable    -> a transferable answers every item consistently positive
//   general_shallow -> answers the matching failing item (d = no: adds nothing
//                      over the nearest graph edge -> general_shallow)
// ---------------------------------------------------------------------------

function judgeForGold(salient) {
  if (salient === 'transferable') {
    return function () { return { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 }; };
  }
  // general_shallow (and any non-transferable gold): fail item d.
  return function () { return { a: 1, b: 1, c: 1, d: 0, e: 1, f: 1 }; };
}

// An honest-generic judge for seeded distractors: it reads the analogy as generic
// filler (schema not statable without nouns, no one-to-one mapping), so the code
// routes it to a rejecting verdict, never transferable.
function honestGenericJudge() { return { a: 0, b: 0, c: 1, d: 1, e: 1, f: 1 }; }

// A judge that DISAGREES with itself between the neutral and adversarial passes
// (flips item d only on the adversarial prompt). runRubric must mark 'x' at the
// disagreed slot and route general_shallow / rubric_disagreement (D2 item 3).
function disagreeingJudge(prompt) {
  const adversarial = /Argue this proposed analogy is generic filler/.test(String(prompt || ''));
  return { a: 1, b: 1, c: 1, d: adversarial ? 0 : 1, e: 1, f: 1 };
}

function loadCard(stem) {
  const raw = fs.readFileSync(path.join(CASES_DIR, stem + '.md'), 'utf8');
  return matter(raw).data;
}

function candidateFrom(card) {
  // Build the candidate from hypothesis_in + destination (mechanismText =
  // destination). sourcedQuantities:true because the gold-card figures are part
  // of the scenario, not fabricated claims -- Gate 1 is exercised separately.
  return {
    text: String(card.hypothesis_in || ''),
    mechanismText: String(card.destination || ''),
    mappingStatement: String(card.hypothesis_in || ''),
  };
}

const OFFLINE_OPTS = { encodeFn: stubEncode, sourcedQuantities: true };

// ===========================================================================

async function run() {
  console.log('test-212-gold-cards (D7 leg a: fixture suite)');
  console.log('');

  const cards = {};
  for (const stem of CARD_ORDER) cards[stem] = loadCard(stem);

  // -------------------------------------------------------------------------
  // ASSERTION 1 -- archimedes-sterling FIRST, standalone: the objective anchor.
  // sterling's critic_available is lean_checkable, so its transfer-truth is
  // settleable by a proof assistant (Gate A). We validate verdict-by-code
  // routing HERE, on the objective case, before trusting it on the human-judged
  // transfer cards below (D3: validate the judge on the Lean-checkable case first).
  // -------------------------------------------------------------------------

  await ok('Assertion 1: archimedes-sterling (lean_checkable ANCHOR) routes to its gold verdict FIRST', async function () {
    const card = cards['archimedes-sterling'];
    assert(card.dials && card.dials.critic_available === 'lean_checkable',
      'sterling must be the lean_checkable objective anchor');
    const gold = card.gold_label.salient;
    const res = await critic.classifyCandidate(
      candidateFrom(card),
      Object.assign({}, OFFLINE_OPTS, { judgeFn: judgeForGold(gold) }),
    );
    console.log('     ANCHOR archimedes-sterling: routed=' + res.verdict + ' expected=' + gold);
    assert(res.verdict === gold,
      'sterling routed ' + res.verdict + ' but gold expects ' + gold);
  });

  // -------------------------------------------------------------------------
  // ASSERTION 2 -- each REMAINING card's routed verdict equals its expected
  // verdict (the gold_label.salient, which is one of the four critic verdicts).
  // -------------------------------------------------------------------------

  const remaining = CARD_ORDER.filter(function (s) { return s !== 'archimedes-sterling'; });
  for (const stem of remaining) {
    await ok('Assertion 2: ' + stem + ' routes to its gold verdict', async function () {
      const card = cards[stem];
      const gold = card.gold_label.salient;
      assert(VERDICT_ENUM.indexOf(gold) !== -1,
        stem + ': gold_label.salient ' + gold + ' is outside the four-verdict enum');
      const res = await critic.classifyCandidate(
        candidateFrom(card),
        Object.assign({}, OFFLINE_OPTS, { judgeFn: judgeForGold(gold) }),
      );
      console.log('     CARD ' + stem + ': routed=' + res.verdict + ' expected=' + gold);
      assert(res.verdict === gold,
        stem + ' routed ' + res.verdict + ' but gold expects ' + gold);
    });
  }

  // -------------------------------------------------------------------------
  // ASSERTION 3 -- seeded distractors. A distractor labeled general_shallow must
  // route to general_shallow or pseudoscience under the honest-generic judge (a
  // seeded wrong turn is never blessed transferable). Any in-enum distractor must
  // at minimum route to a NON-transferable verdict. Distractor labels OUTSIDE the
  // four-verdict enum (knowledge_gap_question / status_quo_stuck /
  // seductive_wrong_formalization / false_compression -- Phase 213 question-type
  // and other scopes) are explicitly SKIPPED with a printed note, never silently
  // dropped.
  // -------------------------------------------------------------------------

  for (const stem of CARD_ORDER) {
    const card = cards[stem];
    for (const d of (card.distractors || [])) {
      const label = d.label;
      if (VERDICT_ENUM.indexOf(label) === -1) {
        console.log('SKIP distractor ' + stem + ' / label=' + label + ' (outside the four-verdict enum; noted, not dropped)');
        SKIP += 1;
        continue;
      }
      // eslint-disable-next-line no-loop-func
      await ok('Assertion 3: ' + stem + ' distractor(' + label + ') is rejected, never blessed transferable', async function () {
        const res = await critic.classifyCandidate(
          { text: 'seeded distractor', mechanismText: String(d.text || ''), mappingStatement: String(d.text || '') },
          Object.assign({}, OFFLINE_OPTS, { judgeFn: honestGenericJudge }),
        );
        console.log('     DISTRACTOR ' + stem + '/' + label + ': routed=' + res.verdict);
        assert(res.verdict !== 'transferable',
          stem + ' distractor(' + label + ') was blessed transferable (must be rejected)');
        if (label === 'general_shallow') {
          assert(res.verdict === 'general_shallow' || res.verdict === 'pseudoscience',
            stem + ' general_shallow distractor routed ' + res.verdict + ' (expected general_shallow or pseudoscience)');
        }
      });
    }
  }

  // -------------------------------------------------------------------------
  // ASSERTION (routing): disagreement handling. When the two rubric passes
  // disagree on an item, the pattern carries 'x' and the pipeline routes
  // general_shallow / rubric_disagreement (D2 item 3), never a blessed verdict.
  // -------------------------------------------------------------------------

  await ok('Routing: neutral-vs-adversarial disagreement routes general_shallow / rubric_disagreement', async function () {
    const card = cards['archimedes-darkmatter'];
    const res = await critic.classifyCandidate(
      candidateFrom(card),
      Object.assign({}, OFFLINE_OPTS, { judgeFn: disagreeingJudge }),
    );
    console.log('     DISAGREE: routed=' + res.verdict + ' tag=' + res.reasoning_tag + ' pattern=' + res.rubric_pattern);
    assert(res.verdict === 'general_shallow', 'disagreement must route general_shallow (got ' + res.verdict + ')');
    assert(res.reasoning_tag === 'rubric_disagreement', 'disagreement tag must be rubric_disagreement');
    assert(res.rubric_pattern.indexOf('x') !== -1, 'disagreement pattern must carry an x slot');
  });

  // -------------------------------------------------------------------------
  // ASSERTION (Stage A ordering): a fabricated-quantity candidate short-circuits
  // in Stage A (route pseudoscience / unsourced_quantity) BEFORE any judge call.
  // Uses the REAL default gate (sourcedQuantities NOT set) and counts judge calls.
  // -------------------------------------------------------------------------

  await ok('Stage A ordering: fabricated-quantity kills BEFORE the judge is ever called', async function () {
    let judgeCalls = 0;
    const countingJudge = function () { judgeCalls += 1; return { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 }; };
    const res = await critic.classifyCandidate(
      { text: 'a $5B exit opportunity with a 10B TAM', mechanismText: 'the Foo Bar system', mappingStatement: 'x' },
      { encodeFn: stubEncode, judgeFn: countingJudge },
    );
    console.log('     STAGE-A-ORDER: routed=' + res.verdict + ' tag=' + res.reasoning_tag + ' judgeCalls=' + judgeCalls);
    assert(res.verdict === 'pseudoscience', 'fabricated-quantity must route pseudoscience (got ' + res.verdict + ')');
    assert(res.reasoning_tag === 'unsourced_quantity', 'tag must be unsourced_quantity');
    assert(judgeCalls === 0, 'the judge must NOT be called when Stage A short-circuits (got ' + judgeCalls + ' calls)');
  });

  // -------------------------------------------------------------------------
  // ASSERTION 4 -- calibration-pending honesty. Every gold card still ships
  // validated: candidate (labels await the 211-04 / 211-05 + plan-05 human
  // checkpoints), so the summary surfaces them as calibration-pending, never as
  // a validated accuracy claim (Q2 honesty).
  // -------------------------------------------------------------------------

  const pending = CARD_ORDER.filter(function (s) { return cards[s].validated !== true; });
  console.log('');
  console.log('CALIBRATION-PENDING (validated: candidate, labels await the human checkpoints): '
    + pending.join(', '));
  await ok('Assertion 4: all gold cards are surfaced as calibration-pending (no validated accuracy claimed here)', async function () {
    assert(pending.length === CARD_ORDER.length,
      'every gold card is expected to still be validated: candidate at this phase');
  });

  console.log('');
  console.log('Phase 212 gold-cards: PASS=' + PASS + ' FAIL=' + FAIL + ' SKIP=' + SKIP);
  process.exit(FAIL === 0 ? 0 : 1);
}

run();
