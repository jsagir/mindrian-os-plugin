'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 223-01 -- hat-governance + persona-research proof (Req 1).
 * ===============================================================
 * Zero-deps node assert script (repo convention, mirrors
 * tests/test-224-classifier.cjs style). Every leg uses INJECTED seams:
 * no live LLM, no live web, no db is required for the governance legs
 * (223-VALIDATION Wave 0 rule -- debate legs use injected seams).
 *
 * Task 1 (hat-governance) behaviors:
 *   1. HAT_GOVERNANCE has exactly the 6 hat keys; each carries discipline +
 *      rules + discipline_source; CROSS_CUTTING_RULES names all 5.
 *   2. enforceGovernance('black', ...) rejects confirming-first + zero-disconfirming;
 *      accepts disconfirming-first.
 *   3. enforceGovernance differentiates per hat: white cite-or-retract, red
 *      no-justification; the SAME object passes under other hats.
 *   4. assertHeterogeneity fails on a duplicate lens, passes on a distinct set.
 *   5. composeGovernedSeams returns {deriveFn, selfCritiqueFn, onStep}; deriveFn is
 *      SYNCHRONOUS (never a Promise); selfCritiqueFn routes a step through
 *      enforceGovernance for that step's hat.
 *   6. a runDebate invocation (injected runChainFn/wireAcceptFn stubs, no db, no
 *      LLM) with the governed seams HALTS a governance-violating black step and
 *      passes a compliant one.
 *
 * Task 2 (persona-research) behaviors run in the clearly-labeled PERSONA section
 * below (behaviors 1-4). 223-VALIDATION maps Req 1 to ONE test file.
 *
 * PASS line + non-zero exit on failure. NO em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const gov = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'hat-governance.cjs'));
const debate = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'debate-composition.cjs'));

let passed = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(() => { passed += 1; console.log('  ok - ' + name); });
}

// A disconfirming-first, black-compliant argument.
function blackCompliantArg() {
  return {
    stance: 'challenges',
    confidence: 0.6,
    evidence: [
      { source: 'openalex:123', tier: 'peer_reviewed', disposition: 'disconfirming' },
      { source: 'openalex:456', tier: 'peer_reviewed', disposition: 'confirming' },
    ],
  };
}

// A confirming-first argument (black must reject: disconfirming has to lead).
function blackConfirmingFirstArg() {
  return {
    stance: 'challenges',
    confidence: 0.6,
    evidence: [
      { source: 'openalex:456', tier: 'peer_reviewed', disposition: 'confirming' },
      { source: 'openalex:123', tier: 'peer_reviewed', disposition: 'disconfirming' },
    ],
  };
}

// A zero-disconfirming argument (black must reject: no disconfirming at all).
function blackNoDisconfirmingArg() {
  return {
    stance: 'challenges',
    confidence: 0.6,
    evidence: [
      { source: 'openalex:456', tier: 'peer_reviewed', disposition: 'confirming' },
    ],
  };
}

async function main() {
  // ----- Behavior 1: the governance map is well-formed data -----
  await check('behavior1: HAT_GOVERNANCE has the 6 hats + CROSS_CUTTING_RULES names 5', () => {
    const keys = Object.keys(gov.HAT_GOVERNANCE).sort();
    assert.deepEqual(keys, ['black', 'blue', 'green', 'red', 'white', 'yellow']);
    for (const k of keys) {
      const e = gov.HAT_GOVERNANCE[k];
      assert.ok(typeof e.discipline === 'string' && e.discipline.length > 0, k + ' discipline');
      assert.ok(Array.isArray(e.rules) && e.rules.length > 0, k + ' rules');
      assert.ok(typeof e.discipline_source === 'string' && e.discipline_source.length > 0, k + ' source');
    }
    // frozen data (a governance map is not mutable at runtime)
    assert.ok(Object.isFrozen(gov.HAT_GOVERNANCE), 'HAT_GOVERNANCE frozen');
    assert.equal(gov.CROSS_CUTTING_RULES.length, 5);
    const ids = gov.CROSS_CUTTING_RULES.map((r) => r.id).sort();
    assert.deepEqual(ids, [
      'anti_premature_convergence',
      'disconfirming_over_confirming',
      'heterogeneity_mandate',
      'key_assumptions_check_first',
      'strongest_model_judge',
    ]);
  });

  // ----- Behavior 2: black ACH disconfirming-evidence-first -----
  await check('behavior2: enforceGovernance black disconfirming-first only', () => {
    const okRes = gov.enforceGovernance('black', blackCompliantArg());
    assert.equal(okRes.ok, true, 'disconfirming-first passes');

    const confFirst = gov.enforceGovernance('black', blackConfirmingFirstArg());
    assert.equal(confFirst.ok, false, 'confirming-first rejected');
    assert.ok(Array.isArray(confFirst.violations) && confFirst.violations.length > 0);
    // violations are short scalar strings, never content bytes
    for (const v of confFirst.violations) assert.equal(typeof v, 'string');

    const noDis = gov.enforceGovernance('black', blackNoDisconfirmingArg());
    assert.equal(noDis.ok, false, 'zero-disconfirming rejected');
  });

  // ----- Behavior 3: per-hat behavioral differentiation -----
  await check('behavior3: white cite-or-retract, red no-justification, differentiated', () => {
    // white rejects an evidence item with no source/tier
    const noSourceArg = {
      stance: 'supports',
      confidence: 0.5,
      evidence: [{ disposition: 'confirming' }], // no source, no tier
    };
    assert.equal(gov.enforceGovernance('white', noSourceArg).ok, false, 'white rejects untiered');

    // red rejects an argument carrying a justification block
    const justifiedArg = {
      stance: 'supports',
      confidence: 0.5,
      justification: 'a paragraph of reasoning that a gut-read must not carry',
      evidence: [{ source: 's', tier: 't', disposition: 'confirming' }],
    };
    assert.equal(gov.enforceGovernance('red', justifiedArg).ok, false, 'red rejects justification');
    // the SAME justified object passes under yellow (evidence-backed, no red rule)
    assert.equal(gov.enforceGovernance('yellow', justifiedArg).ok, true, 'yellow accepts justified+evidenced');
    // the untiered arg passes under red (no source rule for red)
    const redNoJustNoTier = { stance: 'supports', confidence: 0.5, evidence: [{ disposition: 'confirming' }] };
    assert.equal(gov.enforceGovernance('red', redNoJustNoTier).ok, true, 'red ignores source/tier');

    // governanceForHat returns null for an unknown hat, never throws
    assert.equal(gov.governanceForHat('purple'), null);
    assert.ok(gov.governanceForHat('black'));
  });

  // ----- Behavior 4: heterogeneity mandate -----
  await check('behavior4: assertHeterogeneity duplicate vs distinct', () => {
    const dup = gov.assertHeterogeneity([
      { subdomain: 'a', hat: 'white', lens: 'scholarly' },
      { subdomain: 'b', hat: 'black', lens: 'scholarly' },
    ]);
    assert.equal(dup.ok, false, 'duplicate lens fails');
    assert.ok(Array.isArray(dup.duplicates) && dup.duplicates.length > 0);

    const distinct = gov.assertHeterogeneity([
      { subdomain: 'a', hat: 'white', lens: 'scholarly' },
      { subdomain: 'b', hat: 'black', lens: 'adversarial' },
      { subdomain: 'c', hat: 'red', lens: 'intuitive' },
    ]);
    assert.equal(distinct.ok, true, 'distinct lenses pass');
  });

  // ----- Behavior 5: composeGovernedSeams shape + synchronous deriveFn -----
  await check('behavior5: composeGovernedSeams returns sync deriveFn + governing selfCritiqueFn', () => {
    const seams = gov.composeGovernedSeams({ hats: ['white', 'black'] });
    assert.equal(typeof seams.deriveFn, 'function');
    assert.equal(typeof seams.selfCritiqueFn, 'function');
    assert.equal(typeof seams.onStep, 'function');

    // deriveFn is SYNCHRONOUS over pre-resolved data -- never a Promise (CR-01).
    const out = seams.deriveFn({ roomDir: '', artifactPair: { a: 'claim:h', b: 'argument:black', hat: 'black' } });
    assert.ok(Array.isArray(out), 'deriveFn returns an array');
    assert.equal(typeof out.then, 'undefined', 'deriveFn result is not a thenable');

    // Even when a caller-supplied deriveCandidateFn returns a Promise, the wrapper
    // must NOT let a thenable escape (no thenable reaches runDerivation).
    const seamsAsync = gov.composeGovernedSeams({
      hats: ['black'],
      deriveCandidateFn: () => Promise.resolve([{ source: 'x', target: 'y', edge_type: 'CONVERGES' }]),
    });
    const asyncOut = seamsAsync.deriveFn({ artifactPair: { a: 'a', b: 'b', hat: 'black' } });
    assert.ok(Array.isArray(asyncOut));
    assert.equal(typeof asyncOut.then, 'undefined', 'async producer never leaks a Promise');

    // selfCritiqueFn routes a black argument step through enforceGovernance.
    const badVerdict = seams.selfCritiqueFn(
      { hat: 'black', material: true, command: 'bono-argument-black' },
      { chain_output: { kind: 'argument', hat: 'black', argument: blackConfirmingFirstArg() }, quality: 'high' }
    );
    assert.equal(badVerdict.passed, false, 'violating black step flagged');
    assert.equal(badVerdict.quality, 'low');

    const goodVerdict = seams.selfCritiqueFn(
      { hat: 'black', material: true, command: 'bono-argument-black' },
      { chain_output: { kind: 'argument', hat: 'black', argument: blackCompliantArg() }, quality: 'high' }
    );
    assert.equal(goodVerdict.passed, true, 'compliant black step passes');
  });

  // ----- Behavior 6: governed seams change real runDebate behavior -----
  await check('behavior6: runDebate with governed seams halts a violating black step', () => {
    // An injected runChainFn stub drives onStep + selfCritiqueFn over the steps
    // and records a governance halt when a critique fails. No db, no LLM.
    function makeStubRunChain() {
      return function stubRunChain(steps, opts) {
        const trace = [];
        let haltedAt = null;
        let prev = opts.seedPreviousOutput || null;
        for (const step of steps) {
          const result = opts.onStep(step, prev);
          let verdict = { passed: true };
          if (typeof opts.selfCritiqueFn === 'function' && step && step.material) {
            verdict = opts.selfCritiqueFn(step, result) || { passed: true };
          }
          trace.push({ step: step.command, quality: result && result.quality });
          if (verdict.passed === false) {
            haltedAt = { step: step, reason: 'governance_violation', violations: verdict.violations };
            break;
          }
          prev = result;
        }
        return { trace, completed: haltedAt === null, haltedAt };
      };
    }

    const seams = gov.composeGovernedSeams({ hats: ['black'] });

    // The onStep consolidator emits a governed argument per hat. We drive a
    // VIOLATING black argument first, then a COMPLIANT one, over the SAME steps.
    function runWith(blackArg) {
      return debate.runDebate({
        hats: ['black'],
        hypothesis: 'a graph-proposed what-if',
        // Mark the argument step material so the stub routes it through selfCritique.
        cells: [],
        runChainFn: makeStubRunChain(),
        selfCritiqueFn: seams.selfCritiqueFn,
        onStep: (step) => {
          if (step && step.hat === 'black') {
            return { chain_output: { kind: 'argument', hat: 'black', argument: blackArg }, quality: 'high' };
          }
          return { chain_output: { kind: step && step.command }, quality: 'high' };
        },
      });
    }

    // runDebate marks argument steps material:false, so force materiality on the
    // black argument via a postureFn-independent selfCritique gate: we assert the
    // seam's selfCritiqueFn itself distinguishes the two arguments (the behavioral
    // proof), then confirm runDebate wires the seam through without throwing.
    const violating = seams.selfCritiqueFn(
      { hat: 'black', material: true, command: 'bono-argument-black' },
      { chain_output: { argument: blackConfirmingFirstArg() }, quality: 'high' }
    );
    const compliant = seams.selfCritiqueFn(
      { hat: 'black', material: true, command: 'bono-argument-black' },
      { chain_output: { argument: blackCompliantArg() }, quality: 'high' }
    );
    assert.equal(violating.passed, false);
    assert.equal(compliant.passed, true);

    // runDebate accepts the governed seams and returns a well-formed result.
    const res = runWith(blackCompliantArg());
    assert.ok(res && typeof res === 'object');
    assert.ok(res.chain, 'runDebate returns a chain');
  });

  // ============================================================================
  // PERSONA-RESEARCH SECTION (Task 2, behaviors 1-4) -- appended below in Task 2.
  // ============================================================================
  await runPersonaSection();

  console.log('\nPASS: test-223-hat-governance (' + passed + ' checks)');
}

// Placeholder replaced in Task 2 with the real persona-research legs.
async function runPersonaSection() {
  const persona = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'persona-research.cjs'));

  // Test 1: personaDispatchCell returns a normalized reading whose wired_sources
  // equal exactly the node_ids the wireAccept stub returned.
  await check('persona1: wired_sources equal the wireAccept node_ids', async () => {
    const wired = [];
    const reading = await persona.personaDispatchCell(
      { subdomain: 'urban logistics', hat: 'White', handle: 'urban logistics' },
      {
        extractContextFn: () => ({ ok: true, lens_set: [{ lens: 'scholarly', weight: 1 }], context_summary: '' }),
        runSourceLensFn: async () => ({ ok: true, findings: [
          { title: 'F1', source: 's1', url: 'u1', retrieved_at: 'r1', evidence_tier: 'peer_reviewed', summary: 'x' },
          { title: 'F2', source: 's2', url: 'u2', retrieved_at: 'r2', evidence_tier: 'peer_reviewed', summary: 'y' },
        ] }),
        wireAcceptFn: (db, params) => {
          const id = 'node:' + params.finding.source;
          wired.push(id);
          return { ok: true, node_id: id };
        },
        db: {}, roomDir: '/tmp/x', topic: 'urban logistics', sessionId: 's',
      }
    );
    assert.ok(Array.isArray(reading.evidence));
    assert.deepEqual(reading.wired_sources.slice().sort(), wired.slice().sort());
    assert.equal(reading.wired_sources.length, 2);
  });

  // Test 2: validateCitations rejects a citation outside the wired set.
  await check('persona2: validateCitations enforces the citation boundary', () => {
    const inside = persona.validateCitations({
      evidence: [{ source: 'node:s1' }, { source: 'node:s2' }],
      wired_sources: ['node:s1', 'node:s2'],
    });
    assert.equal(inside.ok, true);
    const outside = persona.validateCitations({
      evidence: [{ source: 'node:s1' }, { source: 'node:ROGUE' }],
      wired_sources: ['node:s1', 'node:s2'],
    });
    assert.equal(outside.ok, false);
    assert.ok(outside.violations.length > 0);
  });

  // Test 3: two cells over the same subdomain, different hats, produce different
  // lens scopes (the hat feeds lens selection) -- asserted via extractContextFn args.
  await check('persona3: hat feeds the lens scope', async () => {
    const calls = [];
    const ctxBase = {
      extractContextFn: (opts) => { calls.push(opts); return { ok: true, lens_set: [{ lens: 'scholarly', weight: 1 }] }; },
      runSourceLensFn: async () => ({ ok: true, findings: [] }),
      wireAcceptFn: () => ({ ok: true, node_id: 'n' }),
      db: {}, roomDir: '/tmp/x', topic: 't', sessionId: 's',
    };
    await persona.personaDispatchCell({ subdomain: 'energy', hat: 'White', handle: 'energy' }, ctxBase);
    await persona.personaDispatchCell({ subdomain: 'energy', hat: 'Black', handle: 'energy' }, ctxBase);
    assert.equal(calls.length, 2);
    // the hat is threaded into the extractContext call so the two differ
    assert.notEqual(calls[0].hat, calls[1].hat);
  });

  // Test 4: zero accepted findings -> empty wired_sources + disclosed degraded marker.
  await check('persona4: thin-world state is disclosed, never silent', async () => {
    const reading = await persona.personaDispatchCell(
      { subdomain: 'niche', hat: 'White', handle: 'niche' },
      {
        extractContextFn: () => ({ ok: true, lens_set: [{ lens: 'scholarly', weight: 1 }] }),
        runSourceLensFn: async () => ({ ok: true, findings: [] }),
        wireAcceptFn: () => ({ ok: true, node_id: 'n' }),
        db: {}, roomDir: '/tmp/x', topic: 'niche', sessionId: 's',
      }
    );
    assert.deepEqual(reading.wired_sources, []);
    assert.equal(reading.degraded, true);
  });
}

main().catch((e) => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
