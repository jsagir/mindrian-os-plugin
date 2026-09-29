'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Quick 260929-obr -- the shared Jev gold-card judge leg.
 *
 * WHAT
 *   Replaces the retired Plurai cross-topic-connection judge (hosted endpoint
 *   returns HTTP 404, retired 2026-09-29; navigator directive "evals using jev
 *   not plurai") with Jev's usefulness_judge seat over the SYNTHETIC gold-card
 *   text. Two pairings: a transferable one (the dark-matter card: hypothesis vs
 *   destination) and an unrelated one (davinci hypothesis vs lovelace destination).
 *
 * WHY THIS SHAPE (Part 7, reuse before build)
 *   No hand-rolled REST client. Every call goes through jev() from
 *   scripts/jev-devtime-client.cjs with the makeUsefulnessCeiling guard from
 *   scripts/jev-question-ceilings.cjs (exact state keys, length caps, excerpts
 *   byte-equal to the gold-card text, frozen question), and parseJevResponse from
 *   scripts/jev-response-schema.cjs. Same machinery as scripts/judge-355-usefulness.cjs.
 *
 * PART 8 EGRESS
 *   Only synthetic-by-construction gold-card text (evals/eureka/cases/) ever
 *   crosses to the vendor. The nichefoods card is excluded on purpose (its
 *   figure trips the Part 8 egress guard). Dev/CI time only, never a hook, never
 *   lib/. This module lives in tests/helpers/ (tests/test-353-tripwires.cjs bans
 *   the vendor in lib/ and hooks/).
 *
 * EXIT CONTRACT (per run, via main())
 *   0  every pair judged and matched its expectation
 *   1  a genuine failure (choice mismatch, malformed payload, unexpected HTTP,
 *      model or schema drift). A vanished endpoint (404) is a LOUD failure.
 *   77 SKIPPED (ENV GAP): no key, key rejected, or vendor unreachable/unavailable.
 *      A skip is NEVER reported as a pass.
 *
 * The module writes NO file of any kind. The key is never printed or returned.
 * No em-dashes. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');

const REPO = path.resolve(__dirname, '..', '..');
const CASES_DIR = path.join(REPO, 'evals', 'eureka', 'cases');

const { loadKey, jev } = require(path.join(REPO, 'scripts/jev-devtime-client.cjs'));
const Q = require(path.join(REPO, 'scripts/jev-question-ceilings.cjs'));
const { parseJevResponse } = require(path.join(REPO, 'scripts/jev-response-schema.cjs'));
const { DIRECTION_MEANING } = require(path.join(REPO, 'lib/core/direction-convention.cjs'));

const USEFULNESS_OPTIONS = ['useful', 'not_useful', 'already_known', 'none'];

const PAIR_IDS = Object.freeze(['transferable_darkmatter', 'unrelated_davinci_lovelace']);
// Maps the retired ladder: Hedged|Confident -> connection set; No Connection -> no-connection set.
const CONNECTION_CHOICES = Object.freeze(['useful', 'already_known']);
const NO_CONNECTION_CHOICES = Object.freeze(['not_useful', 'none']);

function card(stem) {
  return matter(fs.readFileSync(path.join(CASES_DIR, stem + '.md'), 'utf8')).data;
}

// pair_id -> { a_excerpt, b_excerpt, direction_phrase, expect }
function buildGoldPairs(pairIds) {
  const ids = pairIds || PAIR_IDS;
  const map = new Map();
  for (const id of ids) {
    if (id === 'transferable_darkmatter') {
      const dm = card('archimedes-darkmatter');
      map.set(id, {
        a_excerpt: dm.hypothesis_in,
        b_excerpt: dm.destination,
        direction_phrase: DIRECTION_MEANING.structural_transfer,
        expect: 'connection',
      });
    } else if (id === 'unrelated_davinci_lovelace') {
      const dv = card('davinci-salient');
      const ll = card('lovelace-lean');
      map.set(id, {
        a_excerpt: dv.hypothesis_in,
        b_excerpt: ll.destination,
        direction_phrase: DIRECTION_MEANING.structural_transfer,
        expect: 'no_connection',
      });
    } else {
      throw new Error('jev-gold-card-leg: unknown pair id ' + id);
    }
  }
  return map;
}

// verification is 'unverified': gold cards carry no verification stamp and the
// ceiling accepts only the three stamp tier words.
function buildBody(pair) {
  return {
    model: Q.PINNED_MODEL,
    state: {
      a_excerpt: pair.a_excerpt,
      b_excerpt: pair.b_excerpt,
      direction_phrase: pair.direction_phrase,
      verification: 'unverified',
    },
    questions: Q.USEFULNESS_QUESTIONS,
  };
}

function buildGuard(pairMap) {
  const known = new Map();
  for (const [id, p] of pairMap) {
    known.set(id, { a_excerpt: p.a_excerpt, b_excerpt: p.b_excerpt, direction_phrase: p.direction_phrase });
  }
  return Q.makeUsefulnessCeiling(known);
}

function fmtConf(c) {
  return typeof c === 'number' ? c.toFixed(2) : String(c);
}

async function judgeOne(id, pair, guard, key, fetchImpl, sleepImpl) {
  const res = await jev(buildBody(pair), { guard, key, fetchImpl, sleepImpl, timeoutMs: 15000, honorRetryAfter: true });
  const s = res.status;
  if (s === 0) return { id, outcome: 'SKIP', line: 'SKIP ' + id + ': vendor unreachable' };
  if (s === 401 || s === 403) return { id, outcome: 'SKIP', line: 'SKIP ' + id + ': key rejected (HTTP ' + s + ')' };
  if (s === 429 || s === 529 || s >= 500) return { id, outcome: 'SKIP', line: 'SKIP ' + id + ': vendor unavailable (HTTP ' + s + ')' };
  if (s === 400 || s === 422) return { id, outcome: 'FAIL', line: 'FAIL ' + id + ': malformed payload (our defect, HTTP ' + s + ')' };
  if (s !== 200) return { id, outcome: 'FAIL', line: 'FAIL ' + id + ': unexpected HTTP ' + s + ' (endpoint contract changed)' };
  const parsed = parseJevResponse(res, { usefulness: USEFULNESS_OPTIONS });
  if (!parsed.ok) return { id, outcome: 'FAIL', line: 'FAIL ' + id + ': ' + parsed.reason };
  const a = parsed.answers.usefulness;
  const set = pair.expect === 'connection' ? CONNECTION_CHOICES : NO_CONNECTION_CHOICES;
  if (!set.includes(a.choice)) {
    return {
      id, outcome: 'FAIL', choice: a.choice, confidence: a.confidence, probabilities: a.probabilities,
      line: 'FAIL ' + id + ': expected ' + pair.expect + ' (' + set.join('|') + ') got ' + a.choice + ' (confidence ' + fmtConf(a.confidence) + ')',
    };
  }
  return {
    id, outcome: 'PASS', choice: a.choice, confidence: a.confidence, probabilities: a.probabilities,
    line: 'ok   ' + id + ': ' + a.choice + ' (confidence ' + fmtConf(a.confidence) + ')',
  };
}

async function runGoldCardJevLeg(opts) {
  const o = opts || {};
  const key = Object.prototype.hasOwnProperty.call(o, 'key') ? o.key : loadKey({ env: o.env, secretsPath: o.secretsPath });
  if (!key) {
    return {
      code: 77,
      lines: ['SKIPPED (ENV GAP): no TYPESAFE_API_KEY (env or ~/.secrets/typesafe.env); the Jev gold-card judge did not run and is never reported as PASSED'],
      results: [],
    };
  }
  const pairMap = buildGoldPairs(o.pairIds || PAIR_IDS);
  const guard = buildGuard(pairMap);
  const results = [];
  for (const [id, pair] of pairMap) {
    results.push(await judgeOne(id, pair, guard, key, o.fetchImpl, o.sleepImpl));
  }
  const lines = results.map((r) => r.line);
  const anyFail = results.some((r) => r.outcome === 'FAIL');
  const anySkip = results.some((r) => r.outcome === 'SKIP');
  return { code: anyFail ? 1 : (anySkip ? 77 : 0), lines, results };
}

async function main(pairIds) {
  const ids = pairIds || PAIR_IDS;
  console.log('Jev gold-card leg: ' + ids.join(', ') + ' (live Jev usefulness_judge, synthetic gold-card text only, Part 8)');
  const r = await runGoldCardJevLeg({ pairIds: ids });
  for (const l of r.lines) console.log(l);
  const n = (k) => r.results.filter((x) => x.outcome === k).length;
  console.log('Jev gold-card leg: PASS=' + n('PASS') + ' FAIL=' + n('FAIL') + ' SKIP=' + n('SKIP') + ' (exit ' + r.code + ')');
  return r.code;
}

module.exports = {
  PAIR_IDS,
  CONNECTION_CHOICES,
  NO_CONNECTION_CHOICES,
  buildGoldPairs,
  buildBody,
  buildGuard,
  runGoldCardJevLeg,
  main,
};
