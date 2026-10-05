#!/usr/bin/env node
'use strict';

// Phase 369.2 Plan 02 - web fetch layers carry no fence (ruling 2026-10-05, R01).
//
// W0  prints the A4 value read (MOS_369_2_A4, default keep)
// W1  the REAL fetchCorpusEnvelope sends a fenced-city query unchanged: 1 replay call
// W2  person-with-degree, venture name, money figure, email: 1 call each, q unchanged
// W3  buildAcademicQuery carries the encoded string
// W4  buildIndustryQuery and buildPatentsQuery accept a venture name plus a city
// W5  brain-cypher (Canon Part 8, the Brain line) still refuses with zero calls
// W6  A4: credential strings refused before dispatch (keep) or sent (drop)
// W7  the analogies online composer keeps a money-figure keyword
//
// Never stubs the corpus: the seam is realFetchEnvelope / withReplay from
// tests/helpers/real-corpus-3692.cjs, which runs the real fetchCorpusEnvelope
// through the OpenAlex replay at globalThis.fetch.
//
// Hygiene: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at mkdtemp dirs BEFORE
// any repo module loads; vendor keys are deleted; a net guard counts any fetch
// that escapes the replay.
//
// exit 0 -> PASSED, exit 1 -> FAILED
// House rule: hyphens only, no em or en dashes.

const A4 = process.env.MOS_369_2_A4 === 'drop' ? 'drop' : 'keep';

const real = require('./helpers/real-corpus-3692.cjs');
const hermetic = real.hermeticEnv();
['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_BRAIN_URL'].forEach(function (k) {
  process.env[k] = hermetic[k];
});
real.VENDOR_KEYS.forEach(function (k) { delete process.env[k]; });

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3692-web-lines');

const corpus = require('../lib/core/research-corpus.cjs');
const academic = require('../lib/core/rs-fetcher-academic.cjs');
const industry = require('../lib/core/rs-fetcher-industry.cjs');
const patents = require('../lib/core/rs-fetcher-patents.cjs');
const { composePatternQueries } = require('../lib/core/semantic-index/online-pattern-query.cjs');
const { ExternalEgressViolation } = require('../lib/core/rs-egress-violations.cjs');

const TEST_KEY = 'test-key-3692-abcdefgh';

function runEnvelope(args) {
  return real.withReplay(function () { return 'gap_primary_zero'; }, function () {
    return corpus.fetchCorpusEnvelope(args);
  });
}

function describeOutcome(out) {
  return (out.error ? (out.error.name || 'Error') + ': ' + out.error.message : 'resolved')
    + ' calls=' + out.calls.length;
}

function oneCallUnchanged(out, query) {
  return !out.error && out.calls.length === 1 && out.calls[0].q === query;
}

async function main() {
  // ---- W0 ----
  console.log('MOS_369_2_A4=' + A4);
  check('W0 A4 value read (' + A4 + ')', A4 === 'keep' || A4 === 'drop');

  // ---- W1 ----
  {
    const q = '"wireless sensing in Tel Aviv"';
    const out = await runEnvelope({ source: 'openalex', query: q, limit: 3 });
    check('W1 fetchCorpusEnvelope sends a fenced-city query unchanged (1 call, q byte-identical)',
      oneCallUnchanged(out, q), describeOutcome(out)
        + ' q=' + JSON.stringify(out.calls[0] && out.calls[0].q));
  }

  // ---- W2 ----
  {
    const queries = [
      '"cold storage study by Orla Venn PhD"',
      '"Nimbus Robotics cold lockers"',
      '"a $5M market for cold lockers"',
      '"contact jane.roe@example.com about biofilm"',
    ];
    const bad = [];
    for (const q of queries) {
      const out = await runEnvelope({ source: 'openalex', query: q, limit: 3 });
      if (!oneCallUnchanged(out, q)) bad.push(q + ' -> ' + describeOutcome(out));
    }
    check('W2 person, venture, money figure and email leave unchanged (1 call each)',
      bad.length === 0, bad.join(' | '));
  }

  // ---- W3 ----
  {
    const q = '"wireless sensing in Haifa"';
    let built = null;
    let err = null;
    try { built = academic.buildAcademicQuery(q, 'openalex'); } catch (e) { err = e; }
    check('W3 buildAcademicQuery carries the encoded string',
      !err && built && built.skip === false && built.url.indexOf(encodeURIComponent(q)) !== -1,
      err ? err.name + ': ' + err.message : 'url=' + (built && built.url));
  }

  // ---- W4 ----
  {
    const q = '"Nimbus Robotics" cold lockers Haifa';
    process.env.TAVILY_API_KEY = 'tavily-test-3692-abcdef';
    let ind = null;
    let indErr = null;
    try { ind = industry.buildIndustryQuery(q); } catch (e) { indErr = e; } finally { delete process.env.TAVILY_API_KEY; }
    check('W4a buildIndustryQuery accepts a venture name plus a city (refined sub-queries carry it)',
      !indErr && ind && ind.skip === false && ind.refined_subqueries.every(function (s) { return s.indexOf(q) !== -1; }),
      indErr ? indErr.name + ': ' + indErr.message : 'skip=' + (ind && ind.skip));
    let pat = null;
    let patErr = null;
    try { pat = patents.buildPatentsQuery(q, 'google_patents'); } catch (e) { patErr = e; }
    check('W4b buildPatentsQuery accepts a venture name plus a city',
      !patErr && pat && pat.skip === false && pat.url.indexOf(encodeURIComponent(q)) !== -1,
      patErr ? patErr.name + ': ' + patErr.message : 'skip=' + (pat && pat.skip));
  }

  // ---- W5 ----
  {
    const q = 'MATCH (n) WHERE n.city = "Haifa" RETURN n';
    const out = await runEnvelope({ source: 'brain-cypher', query: q });
    check('W5 brain-cypher still refuses a CONTENT-SET string with zero calls (Canon Part 8)',
      out.error instanceof ExternalEgressViolation && out.calls.length === 0, describeOutcome(out));
  }

  // ---- W6 ----
  {
    const prior = process.env.OPENALEX_API_KEY;
    process.env.OPENALEX_API_KEY = TEST_KEY;
    const queries = [
      '"cold lockers" api_key=abc123',
      '"cold lockers" Bearer abcdefghijklmnopqrstu',
      '"cold lockers" ' + TEST_KEY,
    ];
    const bad = [];
    try {
      for (const q of queries) {
        const out = await runEnvelope({ source: 'openalex', query: q, limit: 3 });
        if (A4 === 'keep') {
          const credential = out.error instanceof ExternalEgressViolation
            && out.error.meta && out.error.meta.matched_pattern === 'credential'
            && out.error.meta.sample === '';
          if (!(credential && out.calls.length === 0)) bad.push('keep: ' + describeOutcome(out));
        } else if (!oneCallUnchanged(out, q)) {
          bad.push('drop: ' + describeOutcome(out));
        }
      }
    } finally {
      if (prior === undefined) delete process.env.OPENALEX_API_KEY; else process.env.OPENALEX_API_KEY = prior;
    }
    check('W6 A4=' + A4 + (A4 === 'keep'
      ? ' credential strings refused (matched credential, empty sample) with zero calls'
      : ' credential strings sent like any other string (1 call, q unchanged)'),
      bad.length === 0, bad.join(' | '));
  }

  // ---- W7 ----
  {
    const res = composePatternQueries({
      functionalKeywords: ['raises $3.5M', 'background subtraction'],
      trizPrinciples: ['Separation'],
      abstractFunction: 'recover a rare signal',
    });
    check('W7 composePatternQueries keeps a money-figure keyword (ok true, a query carries 3.5M)',
      res.ok === true && Array.isArray(res.queries) && res.queries.some(function (c) { return c.q.indexOf('3.5M') !== -1; }),
      JSON.stringify(res).slice(0, 160));
  }

  check('W-net no fetch escaped the replay (net guard attempts 0)', NET.attempts() === 0, 'attempts=' + NET.attempts());
  process.exit(summary());
}

main().catch(function (e) {
  console.log('FAIL: harness crashed (' + (e && e.stack ? e.stack : e) + ')');
  process.exit(1);
});
