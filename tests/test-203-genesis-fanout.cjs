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
const { SYNTHETIC_EXPERT_FIELDS, HAT_COLORS, writeSyntheticExpertNode } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'synthetic-expert.cjs'));

// In-memory db with the Phase-109-migrated nodes schema (mirrors the shipped
// tests/test-synthetic-expert-writer.cjs freshDb). No SKIP path.
function freshDb() {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE nodes (' +
    '  id TEXT PRIMARY KEY, ' +
    '  type TEXT NOT NULL, ' +
    "  properties TEXT DEFAULT '{}', " +
    '  source_path TEXT NOT NULL, ' +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    '  confidence REAL, ' +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    '  created_at INTEGER NOT NULL, ' +
    '  last_seen_at INTEGER NOT NULL, ' +
    '  last_modified_at INTEGER, ' +
    '  source_section TEXT, ' +
    '  confirmed_by TEXT, ' +
    '  confirmed_at INTEGER, ' +
    '  invalidated_at INTEGER, ' +
    '  valid_to INTEGER' +
    ')'
  );
  db.exec(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  return db;
}

const TEMPLATE_STUB_QUESTION = 'What are the key considerations?';

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

  // ---- TASK 2: synthesize the cells and write ONE proposed node ----

  // Test 2a: synthesizeExpert produces a valid hat, a coherent domain/subdomain, a
  //          GENUINE beautiful-question (not the template stub), and a
  //          research-approach derived from the multi-lens cells.
  await check('Test 2a -- synthesizeExpert produces a valid hat + genuine question + multi-lens approach', async () => {
    const fan = await genesis.composeSyntheticExpert(null, BIG_SPEC, {
      dispatchCell: distinctStub(),
      write: false,
    });
    const synth = genesis.synthesizeExpert(fan.cells, BIG_SPEC, { distinctSourceCount: fan.distinctSourceCount });

    assert.ok(HAT_COLORS.has(synth.hat), 'hat is a valid de Bono hat color: ' + synth.hat);
    assert.ok(typeof synth.name === 'string' && synth.name.length > 0, 'name (main domain) is non-empty');
    assert.ok(typeof synth.surname === 'string' && synth.surname.length > 0, 'surname (subdomain) is non-empty');

    assert.ok(typeof synth.beautifulQuestion === 'string' && synth.beautifulQuestion.length > 0,
      'beautiful_question is non-empty');
    assert.notEqual(synth.beautifulQuestion, TEMPLATE_STUB_QUESTION,
      'beautiful_question is NOT the template stub');
    // The question is derived from the lenses: it references the domain.
    assert.ok(synth.beautifulQuestion.toLowerCase().indexOf('regulatory') !== -1,
      'beautiful_question is derived from the domain lens');

    // The research approach names the distinct frameworks (multi-lens, not generic).
    const approach = synth.researchApproach.toLowerCase();
    assert.ok(approach.indexOf('fda') !== -1 || approach.indexOf('iso') !== -1 || approach.indexOf('mdr') !== -1,
      'research_approach names the distinct frameworks (derived, not generic)');

    // Every output key is inside the Part-8 allow-list (no venture byte can ride).
    for (const key of Object.keys(synth)) {
      assert.ok(SYNTHETIC_EXPERT_FIELDS.has(key),
        'synthesizeExpert output key "' + key + '" is allow-listed (Part 8)');
    }
    // Provenance is coerced to scalars only.
    assert.ok(synth.provenance && typeof synth.provenance === 'object', 'provenance is an object');
    assert.ok(typeof synth.provenance.runId === 'string', 'provenance.runId is a scalar string');
    assert.ok(Array.isArray(synth.provenance.domainNodeIds), 'provenance.domainNodeIds is an id array');
  });

  // Test 2b: composeSyntheticExpert calls writeSyntheticExpertNode EXACTLY ONCE and
  //          the node lands review_status 'proposed' (never confirmed).
  await check('Test 2b -- composeSyntheticExpert writes EXACTLY ONE proposed SyntheticExpert node', async () => {
    const db = freshDb();
    let writeCalls = 0;
    const spyWrite = (dbh, params) => { writeCalls += 1; return writeSyntheticExpertNode(dbh, params); };

    const res = await genesis.composeSyntheticExpert(db, SMALL_SPEC, {
      dispatchCell: distinctStub(),
      sessionId: 's203',
      writeExpertFn: spyWrite,
    });
    assert.equal(writeCalls, 1, 'writeSyntheticExpertNode is called EXACTLY once');
    assert.equal(res.ok, true, 'the write succeeded: ' + JSON.stringify(res.written));
    assert.ok(typeof res.node_id === 'string' && res.node_id.length > 0, 'a node id is returned');

    const rows = db.prepare("SELECT id, review_status FROM nodes WHERE type = 'SyntheticExpert'").all();
    assert.equal(rows.length, 1, 'EXACTLY ONE SyntheticExpert node was written (never a raw insertNode loop)');
    assert.equal(rows[0].review_status, 'proposed', "the node lands 'proposed' (only a human confirms)");
    db.close();
  });

  // Test 2c: Part 8 -- a props bag carrying a forbidden key (a venture number) is
  //          rejected forbidden_field by the writer, never inserted.
  await check('Test 2c -- a forbidden venture field is rejected forbidden_field, never inserted (Part 8)', () => {
    const db = freshDb();
    const r = writeSyntheticExpertNode(db, {
      hat: 'Black',
      name: 'Regulatory',
      surname: 'clinical trials',
      beautifulQuestion: 'Where does clinical trials break under FDA 21 CFR?',
      researchApproach: 'fan-out across FDA 21 CFR lenses',
      evidenceTier: 'Operational',
      sessionId: 's203',
      provenance: { runId: 'run-203', domainNodeIds: ['domain:clinical trials'] },
      ventureValuation: 4200000, // the forbidden venture byte.
    });
    assert.equal(r.ok, false, 'the writer rejects a non-allow-listed venture key');
    assert.equal(r.reason, 'forbidden_field', 'the rejection names the Part-8 allow-list gate');
    const cnt = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'SyntheticExpert'").get();
    assert.equal(cnt.n, 0, 'nothing was inserted (the gate fires before any write)');
    db.close();
  });

  console.log(`\nPASS (${pass}/${total})`);
}

main().catch(() => { console.log(`\nFAIL (${pass}/${total})`); process.exit(1); });
