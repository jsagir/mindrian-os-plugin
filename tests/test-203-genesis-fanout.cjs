'use strict';
// Phase 203-01 -- the expert GENESIS composer test suite (Directive 1: the
// synthetic expert is FAN-OUT-COMPOSED, not hand-authored).
//
// This suite proves lib/core/expert-genesis.cjs glues the SHIPPED substrates:
//   - lib/core/bono/cell-fanout.cjs::runCellFanout      (the parallel fan-out)
//   - lib/core/dispatch-optimizer.cjs::planDispatch     (the cost governor)
//   - lib/core/futures/orchestrator.cjs::resolveFanoutCap (the [1,5] clamp)
//   - lib/core/rs-expert-brain-projection.cjs::projectExpertHandles (generic Brain read)
//   - lib/core/navigation/synthetic-expert.cjs::writeSyntheticExpertNode (the write door)
//
// Canon Part 8 (the load-bearing constraint): the dispatchCell is an OFFLINE
//   deterministic stub -- no network, no Brain. Every cell's web leg carries only
//   a generic domain handle; projectExpertHandles degrades to [] with Brain absent.
// Canon Part 7: zero new fan-out runtime, zero new node writer -- every seam is a
//   call into a shipped module.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const genesisPath = path.join(REPO_ROOT, 'lib', 'core', 'expert-genesis.cjs');
const genesis = require(genesisPath);
const { resolveFanoutCap, FUTURES_FANOUT_CAP } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'futures', 'orchestrator.cjs'));
const { SYNTHETIC_EXPERT_FIELDS, HAT_COLORS } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'synthetic-expert.cjs'));

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  return Promise.resolve()
    .then(fn)
    .then(() => { pass += 1; console.log('  ok -', label); })
    .catch((e) => { console.error('  FAIL -', label, '\n   ', e && e.message); throw e; });
}

// An OFFLINE deterministic stub dispatchCell (Part 8: no network, no Brain). It
// returns a {stance, evidence, confidence, source_signature} reading whose source
// signature is drawn from the cell's framework, so DISTINCT frameworks yield
// DISTINCT signatures. A cell carries a generic handle only (never venture body).
function distinctStub() {
  return function dispatchCell(cell) {
    // cell = { framework, subdomain, hat, handle }
    return {
      stance: 'supports',
      evidence: [{ title: 'generic evidence for ' + cell.handle }],
      confidence: 0.7,
      source_signature: 'source::' + cell.framework,
    };
  };
}

// A "one source wearing many hats" stub: every lens collapses to ONE signature.
function collapsedStub() {
  return function dispatchCell(cell) {
    return {
      stance: 'supports',
      evidence: [{ title: 'generic evidence for ' + cell.handle }],
      confidence: 0.7,
      source_signature: 'source::single-origin',
    };
  };
}

const SMALL_SPEC = {
  domain: 'Regulatory Strategy',
  subdomains: ['clinical trials', 'device approval'],
  hats: ['Black', 'Yellow'],
  frameworks: ['FDA 21 CFR'],
};

const BIG_SPEC = {
  domain: 'Regulatory Strategy',
  subdomains: ['clinical trials', 'device approval', 'post-market'],
  hats: ['Black', 'Yellow', 'White'],
  frameworks: ['FDA 21 CFR', 'ISO 13485', 'EU MDR'],
};

async function main() {
  console.log('test-203-genesis-fanout');

  // ---- TASK 1: the genesis grid + cost-governed fan-out ----

  // Test 1a: planGenesisGrid produces one cell per (subdomain x hat x framework),
  //          the count clamped by resolveFanoutCap.
  await check('Test 1a -- planGenesisGrid crosses subdomain x hat x framework, clamped by resolveFanoutCap', () => {
    const small = genesis.planGenesisGrid(SMALL_SPEC);
    assert.ok(Array.isArray(small), 'planGenesisGrid returns an array');
    // 1 framework x 2 hats x 2 subdomains = 4 cells (under the cap of 5).
    assert.equal(small.length, 4, 'small grid is the full 2x2x1 cross product');
    for (const cell of small) {
      assert.ok(typeof cell.subdomain === 'string' && cell.subdomain.length > 0, 'cell has a subdomain');
      assert.ok(typeof cell.hat === 'string' && cell.hat.length > 0, 'cell has a hat');
      assert.ok(typeof cell.framework === 'string' && cell.framework.length > 0, 'cell has a framework');
    }
    // every (subdomain, hat, framework) combo is present exactly once.
    const keys = new Set(small.map((c) => c.framework + '|' + c.subdomain + '|' + c.hat));
    assert.equal(keys.size, 4, 'each cell is a distinct combo');

    // 3 x 3 x 3 = 27 cells -> clamped to resolveFanoutCap (FUTURES_FANOUT_CAP = 5).
    const big = genesis.planGenesisGrid(BIG_SPEC);
    assert.equal(big.length, resolveFanoutCap({ fanout: 27 }), 'big grid is clamped to the cost cap');
    assert.ok(big.length <= FUTURES_FANOUT_CAP, 'the grid can never exceed FUTURES_FANOUT_CAP');
  });

  // Test 1b: the fan-out returns one reading per dispatched cell, each carrying a
  //          source_signature (the per-lens provenance the construction gate keys on).
  await check('Test 1b -- fan-out returns one reading per cell, each carrying a source_signature', async () => {
    const res = await genesis.composeSyntheticExpert(null, SMALL_SPEC, {
      dispatchCell: distinctStub(),
      write: false, // Task 1: fan-out only, no write yet.
    });
    assert.ok(Array.isArray(res.cells), 'compose returns a cells array');
    assert.equal(res.cells.length, 4, 'one reading per dispatched cell (2x2x1)');
    for (const cell of res.cells) {
      assert.ok(typeof cell.source_signature === 'string' && cell.source_signature.length > 0,
        'each reading carries a source_signature');
      assert.ok(typeof cell.stance === 'string', 'each reading carries a stance');
      assert.ok(Array.isArray(cell.evidence), 'each reading carries evidence');
    }
    // distinct frameworks -> the small spec has 1 framework so 1 distinct signature,
    // but with 2 frameworks the distinct count rises. Prove the counter is real:
    assert.equal(res.distinctSourceCount, 1, 'small spec (1 framework) has 1 distinct source signature');
  });

  // Test 1c: a spec whose lenses all resolve to ONE source signature is flagged
  //          distinct_source_count === 1 (the "one source many hats" tell).
  await check('Test 1c -- collapsed lenses flag distinct_source_count === 1 (one source many hats)', async () => {
    // BIG_SPEC has 3 frameworks, so DISTINCT stubs would give > 1 distinct signature.
    const distinct = await genesis.composeSyntheticExpert(null, BIG_SPEC, {
      dispatchCell: distinctStub(),
      write: false,
    });
    assert.ok(distinct.distinctSourceCount >= 2,
      'distinct-framework fan-out records more than one source signature');

    // The SAME spec run through the collapsed stub (one origin wearing many hats)
    // collapses to a single distinct signature -- the tell the gate detects.
    const collapsed = await genesis.composeSyntheticExpert(null, BIG_SPEC, {
      dispatchCell: collapsedStub(),
      write: false,
    });
    assert.equal(collapsed.distinctSourceCount, 1,
      'one source wearing many hats collapses to distinct_source_count === 1');
  });

  // Test 1d: Part 8 -- projectExpertHandles is wired and degrades to [] with Brain
  //          absent; the fan-out still proceeds (fail-closed, generic handles only).
  await check('Test 1d -- projectExpertHandles degrades to [] with Brain absent (Part 8 fail-closed)', async () => {
    const res = await genesis.composeSyntheticExpert(null, SMALL_SPEC, {
      dispatchCell: distinctStub(),
      write: false,
      brainAvailable: false, // no Brain -> projectExpertHandles returns [].
    });
    assert.ok(Array.isArray(res.genericHandles), 'genericHandles is an array');
    assert.equal(res.genericHandles.length, 0, 'Brain absent -> [] (pure Tier-0 degrade)');
    assert.equal(res.cells.length, 4, 'the fan-out still proceeds with Brain absent');
  });

  console.log(`\nPASS (${pass}/${total})`);
}

main().catch(() => { console.log(`\nFAIL (${pass}/${total})`); process.exit(1); });
