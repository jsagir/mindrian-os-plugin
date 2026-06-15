#!/usr/bin/env node
/**
 * Phase 156 Plan 04 -- unit test for the FW-13 bounded SIGNAL research leg.
 *
 * Asserts (node built-in assert, no framework):
 *   - seedGrounding (fire point a) fetches >=1 public source (cache hit or live)
 *     for the seed concept BEFORE ring-1 generation
 *   - perRingResearch (fire point b) either adjusts >=1 consequence confidence
 *     with a cited public source OR proposes >=1 consequence tagged signal-derived
 *   - the fetchCorpus `query` argument is ALWAYS a GENERIC HANDLE: a long
 *     consequence body is bounded to a short keyword phrase, so a room artifact
 *     body can NEVER ride through fetchCorpus as a "handle" (Part 8)
 *   - a second call within the 30-day TTL window is a cache hit (isFresh true),
 *     bounding external calls -- this is NOT always-on
 *   - genericDomainHandle strips a body to <= 6 words (the boundary clamp)
 *   - the REAL research-corpus.fetchCorpus audit chokepoint rejects a forbidden
 *     user-content query (defense-in-depth proof the boundary is real)
 *
 * Uses an injected fake corpus so the test makes ZERO live network calls; one
 * leg exercises the real fetchCorpus audit with a planted user-content string.
 *
 * Single run only, no external test framework. No em-dashes (hyphens only).
 */

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SUITE = 'test-futures-signal';
const REPO = path.join(__dirname, '..');
const orch = require(path.join(REPO, 'lib', 'core', 'futures', 'orchestrator.cjs'));
const realCache = require(path.join(REPO, 'lib', 'core', 'research-cache.cjs'));
const realCorpus = require(path.join(REPO, 'lib', 'core', 'research-corpus.cjs'));
const { seedGrounding, perRingResearch, runSignalResearch, genericDomainHandle } = orch;

function pass(msg) { process.stdout.write('  ok - ' + msg + '\n'); }

// A recording fake corpus: captures every query so we can assert it is generic.
function makeFakeCorpus(seenQueries, results) {
  return {
    fetchCorpus: async (args) => {
      seenQueries.push(args.query);
      return results;
    },
  };
}

(async () => {
  let tmp;
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'futures-signal-'));

    // ---------------------------------------------------------------------
    // 1. genericDomainHandle: a long body is bounded to <= 6 words.
    // ---------------------------------------------------------------------
    const longBody = 'The autonomous fleet displaces forty thousand drivers and triggers a regional unemployment spike that cascades into housing markets and local tax bases over a decade';
    const handle = genericDomainHandle(longBody);
    assert.ok(handle.split(' ').length <= 6, 'genericDomainHandle bounds to <= 6 words (got ' + handle.split(' ').length + ')');
    // The Part 8 guarantee is the bound: the FULL body (the substantive
    // consequence content past the first few words) can never cross. A bounded
    // leading phrase is generic by construction; the body's payload is dropped.
    assert.ok(!/unemployment spike|housing markets|tax bases/.test(handle), 'the consequence body payload (past the leading phrase) does not survive into the handle');
    assert.ok(handle.length < longBody.length / 3, 'the handle is a small fraction of the body length');
    pass('genericDomainHandle clamps a body to a short generic phrase');

    // ---------------------------------------------------------------------
    // 2. seedGrounding (fire point a): grounds ring-1 with >=1 public source.
    // ---------------------------------------------------------------------
    const seenA = [];
    const corpusA = makeFakeCorpus(seenA, [{ id: 'openalex:W1', title: 'Foresight signal', abstract: 'public abstract' }]);
    const ground = await seedGrounding(tmp, 'quantum sensing diagnostics', { corpus: corpusA, cache: realCache });
    assert.strictEqual(ground.grounded, true, 'seedGrounding grounded with >=1 source');
    assert.ok(ground.count >= 1, 'seedGrounding fetched >=1 public source');
    assert.strictEqual(seenA.length, 1, 'seedGrounding fired exactly one external fetch');
    assert.strictEqual(seenA[0], 'quantum sensing diagnostics', 'seed grounding query is the generic seed handle');
    pass('seedGrounding (fire point a) fetches >=1 public source for the seed');

    // ---------------------------------------------------------------------
    // 3. cache-first: a SECOND seedGrounding within the TTL is a cache hit
    //    (zero additional fetch). NOT always-on.
    // ---------------------------------------------------------------------
    const ground2 = await seedGrounding(tmp, 'quantum sensing diagnostics', { corpus: corpusA, cache: realCache });
    assert.strictEqual(ground2.cacheHit, true, 'second call within TTL is a cache hit');
    assert.strictEqual(seenA.length, 1, 'cache hit fired NO additional external fetch (still 1)');
    pass('cache-first: a second call within the 30-day TTL is a cache hit');

    // A past-TTL call (seam the clock 31 days forward) re-fetches.
    const future = Date.now() + 31 * 24 * 60 * 60 * 1000;
    const ground3 = await seedGrounding(tmp, 'quantum sensing diagnostics', { corpus: corpusA, cache: realCache, cacheOpts: { now: future } });
    assert.strictEqual(ground3.cacheHit, false, 'past-TTL call is a miss');
    assert.strictEqual(seenA.length, 2, 'past-TTL re-fetched (now 2 fetches)');
    pass('past-TTL window re-fetches (the 30-day cache bounds, never freezes)');

    // ---------------------------------------------------------------------
    // 4. perRingResearch CORROBORATE: a ring already has the researched domain
    //    -> the finding raises a consequence confidence with a cited source.
    // ---------------------------------------------------------------------
    const ring = [
      { id: 'r-econ', ring: 2, parent_id: 'seed', domain: 'Economic', horizon: 'mid', confidence: 0.5, label: 'Reskilling market grows' },
    ];
    const seenB = [];
    const corpusB = makeFakeCorpus(seenB, [{ id: 'openalex:W2', title: 'Economic signal', abstract: 'public' }]);
    const corro = await perRingResearch(tmp, ring, 'Economic', { corpus: corpusB, cache: realCache });
    assert.ok(corro.confidenceAdjustments.length >= 1, 'perRingResearch corroborated >=1 consequence confidence');
    assert.strictEqual(corro.confidenceAdjustments[0].id, 'r-econ', 'corroboration targets the matching-domain consequence');
    assert.ok(corro.confidenceAdjustments[0].confidence_adjust > 0, 'corroboration raises confidence');
    assert.ok(corro.confidenceAdjustments[0].source, 'corroboration cites a public source');
    assert.strictEqual(seenB[0], 'economic', 'per-ring query is the GENERIC domain handle only (not a consequence body)');
    pass('perRingResearch (fire point b) corroborates a confidence with a cited source');

    // ---------------------------------------------------------------------
    // 5. perRingResearch PROPOSE: a domain absent from the ring -> the finding
    //    proposes a signal-derived consequence (tagged signal_derived).
    // ---------------------------------------------------------------------
    const seenC = [];
    const corpusC = makeFakeCorpus(seenC, [{ id: 'openalex:W3', title: 'Legal precedent shift', abstract: 'public' }]);
    const propose = await perRingResearch(tmp, ring, 'Legal', { corpus: corpusC, cache: realCache });
    assert.ok(propose.signalDerived.length >= 1, 'perRingResearch proposed >=1 signal-derived consequence');
    assert.strictEqual(propose.signalDerived[0].signal_derived, true, 'proposed consequence is tagged signal-derived');
    assert.ok(orch.PESTEL_DOMAIN_ENUM.includes(propose.signalDerived[0].domain), 'signal-derived consequence stays in the PESTEL enum');
    assert.strictEqual(seenC[0], 'legal', 'per-ring propose query is a generic domain handle');
    pass('perRingResearch (fire point b) proposes a signal-derived consequence when the domain is new');

    // ---------------------------------------------------------------------
    // 6. Part 8 floor: a consequence BODY passed as a "query" is bounded to a
    //    generic handle before fetchCorpus -- the full body never crosses.
    // ---------------------------------------------------------------------
    const seenD = [];
    const corpusD = makeFakeCorpus(seenD, []);
    await runSignalResearch(tmp, longBody, { corpus: corpusD, cache: realCache });
    assert.ok(seenD.length === 1, 'runSignalResearch fired one fetch');
    assert.ok(seenD[0].split(' ').length <= 6, 'the fetchCorpus query is a bounded generic handle, not the full body');
    assert.ok(!/unemployment spike|housing markets|tax bases/.test(seenD[0]), 'the consequence body payload did NOT cross to fetchCorpus');
    pass('Part 8: a consequence body cannot ride through fetchCorpus as a handle');

    // ---------------------------------------------------------------------
    // 7. Real-corpus audit chokepoint: the SHIPPED fetchCorpus rejects a planted
    //    user-content query (an email + secret body). Proves the boundary is
    //    enforced by the real egress audit, not just our clamp.
    // ---------------------------------------------------------------------
    let threw = false;
    try {
      await realCorpus.fetchCorpus({ source: 'openalex', query: 'contact jonathan@example.com about the SECRET financial model body', limit: 1 });
    } catch (_e) {
      threw = true;
    }
    assert.strictEqual(threw, true, 'real fetchCorpus audit rejects a planted user-content query (pre-egress)');
    pass('real research-corpus audit chokepoint rejects user-content queries');

    process.stdout.write(SUITE + ': PASS\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write(SUITE + ': FAIL: ' + err.message + '\n' + (err.stack || '') + '\n');
    process.exit(1);
  } finally {
    if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ } }
  }
})();
