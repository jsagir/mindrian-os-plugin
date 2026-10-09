import sys
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()
def rep(o, n, c=1):
    global s
    assert s.count(o) == c, (s.count(o), o[:80])
    s = s.replace(o, n)

rep(""" * Registered in lib/memory/run-feynman-tests.cjs.
 */""", """ * Registered in lib/memory/run-feynman-tests.cjs.
 *
 * 2026 maintenance (intent unchanged; see rs/CHANGES-engine.md):
 *   - T1/T2/T3 mock sets now include fetchCorpus + researchCache. Since
 *     Phase 130.5-03 the academic fetch goes through those two modules, not
 *     fetcherAcademic.fetchAcademic, so the old mock set silently reached the
 *     REAL fetchCorpus (network) whenever a flattened query existed.
 *   - T2 asserted classification === 'structural_transfer' for the empty
 *     fallback envelope. rs-discovery-engine.cjs has used 'none' there since
 *     Phase 355 D-04, so that assertion was stale and failed against the
 *     current producer. It now asserts 'none'.
 *   - T4..T7 (additive) pin the 2026 behaviours: best-score write target,
 *     per-item failure isolation, the verification block, and the bound.
 */""")

rep("""    fetcherAcademic: {
      fetchAcademic: async () => ({ papers: [{ id: 'p1', title: 't1', abstract: 'a1' }] }),
    },""", """    fetcherAcademic: {
      fetchAcademic: async () => ({ papers: [{ id: 'p1', title: 't1', abstract: 'a1' }] }),
    },
    // Phase 130.5-03: the live academic path. Without these two the engine
    // would call the real fetchCorpus (network) for query 'q1'.
    fetchCorpus: async () => ([{ id: 'p1', title: 't1', abstract: 'a1' }]),
    researchCache: {
      getCached: () => null,
      putCached: () => undefined,
    },""")

rep("""  assert.strictEqual(captured.value.classification, 'structural_transfer', 't2: classification literal');""",
    """  assert.strictEqual(captured.value.classification, 'none', 't2: classification literal (Phase 355 D-04: no classifier ran)');""")

rep("""// ---------- Runner ----------""", """// ---------- 2026 additive tests ----------

function multiItemMocks(captured, scores) {
  const mocks = buildSuccessPathMocks(captured);
  mocks.preprocessor = {
    preprocess: () => scores.map((sc, i) => ({
      id: 'p' + i, title: 't' + i, source: i % 2 ? 'patent' : 'academic',
      abstract: 'Item ' + i + ' describes a caching method for the pipeline. It is long enough to quote.',
      methods: ['caching'], _score: sc,
    })),
  };
  let n = 0;
  mocks.breakthroughScorer = {
    scoreBreakthrough: (c) => Object.assign({}, c, { breakthrough: { score: scores[n++], dominant_dimension: 'x' } }),
  };
  return mocks;
}

async function test_4_writesBestNotFirst(rsEngine) {
  const captured = { value: null };
  const mocks = multiItemMocks(captured, [0.2, 0.9, 0.5]);
  const bundle = await rsEngine.runDiscovery('t4', { tier: 'tier0', room_dir: mkTmp('rs-t4-'), _test_mocks: mocks });
  assert.strictEqual(captured.value.breakthrough.score, 0.9, 't4: persisted discovery is the highest scoring one');
  assert.strictEqual(bundle.provenance.written_index, 1, 't4: provenance records which index was written');
  const c2 = { value: null };
  await rsEngine.runDiscovery('t4b', { tier: 'tier0', write_strategy: 'first', room_dir: mkTmp('rs-t4b-'), _test_mocks: multiItemMocks(c2, [0.2, 0.9, 0.5]) });
  assert.strictEqual(c2.value.breakthrough.score, 0.2, 't4: write_strategy first restores the old behaviour');
}

async function test_5_itemFailureIsolated(rsEngine) {
  const captured = { value: null };
  const mocks = multiItemMocks(captured, [0.4, 0.6, 0.1]);
  let calls = 0;
  mocks.differentialScorer = { score: async () => { calls += 1; if (calls === 2) throw new Error('boom-2'); return { novelty_score: 0.5 }; } };
  const bundle = await rsEngine.runDiscovery('t5', { tier: 'tier0', room_dir: mkTmp('rs-t5-'), _test_mocks: mocks });
  assert.strictEqual(bundle.breakthroughs.length, 2, 't5: failing item skipped, others kept');
  assert.strictEqual(bundle.provenance.item_errors.length, 1, 't5: failure recorded, not swallowed');
  assert.ok(/boom-2/.test(bundle.provenance.item_errors[0].message));
  assert.strictEqual(bundle.verification.length, bundle.breakthroughs.length, 't5: verification stays aligned');
  // every item failing must still throw
  const allFail = multiItemMocks({ value: null }, [0.1, 0.2]);
  allFail.differentialScorer = { score: async () => { throw new Error('systemic'); } };
  await assert.rejects(rsEngine.runDiscovery('t5b', { tier: 'tier0', room_dir: mkTmp('rs-t5b-'), _test_mocks: allFail }), /systemic/);
}

async function test_6_verificationBlock(rsEngine) {
  const bundle = await rsEngine.runDiscovery('t6', { tier: 'tier0', room_dir: mkTmp('rs-t6-'), _test_mocks: multiItemMocks({ value: null }, [0.3, 0.8]) });
  const v = bundle.verification[1];
  assert.strictEqual(v.novelty.status, 'unchecked_external');
  assert.strictEqual(v.source_trail[0].source_id, 'p1');
  assert.ok(/caching/.test(v.source_trail[0].extracted_sentence), 't6: extracted sentence quotes the doc concept');
  assert.strictEqual(v.second_signal.status, 'corroborated', 't6: patent and academic items both mention the concept');
}

async function test_7_boundedLoop(rsEngine) {
  const mocks = multiItemMocks({ value: null }, [0.1, 0.2, 0.3, 0.4, 0.5]);
  const bundle = await rsEngine.runDiscovery('t7', { tier: 'tier0', max_items: 2, room_dir: mkTmp('rs-t7-'), _test_mocks: mocks });
  assert.strictEqual(bundle.scored.length, 2, 't7: scoring loop bounded by max_items');
  assert.strictEqual(bundle.provenance.truncated, true);
}

// ---------- Runner ----------""")
rep("""    await test_3_e2eTier0RowWritten(rsEngine);
  } finally {""", """    await test_3_e2eTier0RowWritten(rsEngine);
    await test_4_writesBestNotFirst(rsEngine);
    await test_5_itemFailureIsolated(rsEngine);
    await test_6_verificationBlock(rsEngine);
    await test_7_boundedLoop(rsEngine);
  } finally {""")
rep("rs-discovery-engine: 3/3 tests passed", "rs-discovery-engine: 7/7 tests passed")
rep("// ---------- Test cases ----------", "// ---------- Test cases (T1..T3 original, T4..T7 added 2026) ----------")
open(out, "w", encoding="utf-8").write(s)
print("ok")
