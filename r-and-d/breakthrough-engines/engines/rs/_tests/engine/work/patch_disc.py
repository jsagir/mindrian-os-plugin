import sys
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()
def rep(o, n, c=1):
    global s
    assert s.count(o) == c, (s.count(o), o[:80])
    s = s.replace(o, n)

# header note
rep(""" * Pure CJS, zero runtime deps, no Node built-ins beyond core require.
 *
 * License: BSL-1.1.
 */
""", """ * Pure CJS, zero runtime deps, no Node built-ins beyond core require.
 *
 * 2026 changes (all additive unless noted; see rs/CHANGES-engine.md):
 *   - The persisted discovery is now the HIGHEST-scoring breakthrough
 *     (opts.write_strategy 'best', default). It used to be breakthroughs[0],
 *     which is whichever document the preprocessor emitted first.
 *     opts.write_strategy = 'first' restores the old behaviour.
 *   - The per-document scoring loop is bounded (opts.max_items, env
 *     RS_DISCOVERY_MAX_ITEMS, default 500) and a failure on one document no
 *     longer discards the whole run: it is recorded in provenance.item_errors
 *     and stderr. If EVERY item fails, the first error is thrown. Canon
 *     Part 8 violations (ExternalEgressViolation) always bubble.
 *   - The bundle gains `verification` (per breakthrough: source trail,
 *     second-signal check, novelty status) and `provenance` (what ran,
 *     when, with which limits). Existing bundle keys are untouched.
 *   - The empty-discovery chain_metadata entry uses classification 'none'
 *     like the rest of the file (Phase 355 D-04), not 'structural_transfer'.
 *   - CLI: stdout is flushed before exit (process.exit after a large pipe
 *     write could truncate the JSON bundle).
 *
 * License: BSL-1.1.
 */
""")

# helpers before runDiscovery
rep("""// ---------- runDiscovery (the public entry point) ----------""", """// ---------- 2026 helpers: bounds, write selection, evidence ----------

const DEFAULT_MAX_ITEMS = 500;

function resolveMaxItems(opts) {
  const fromOpts = opts && Number(opts.max_items);
  if (Number.isFinite(fromOpts) && fromOpts > 0) return Math.floor(fromOpts);
  const fromEnv = Number(process.env.RS_DISCOVERY_MAX_ITEMS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv);
  return DEFAULT_MAX_ITEMS;
}

function breakthroughScore(b) {
  return (b && b.breakthrough && typeof b.breakthrough.score === 'number' &&
    Number.isFinite(b.breakthrough.score)) ? b.breakthrough.score : -Infinity;
}

// Index of the breakthrough to persist. 'best' = max score, ties and
// score-less input resolve to the lowest index (so mocks that omit scores,
// or all-equal scores, behave exactly like the old breakthroughs[0]).
function selectWriteIndex(breakthroughs, strategy) {
  if (!Array.isArray(breakthroughs) || breakthroughs.length === 0) return -1;
  if (strategy === 'first') return 0;
  let best = 0;
  let bestScore = breakthroughScore(breakthroughs[0]);
  for (let i = 1; i < breakthroughs.length; i += 1) {
    const sc = breakthroughScore(breakthroughs[i]);
    if (sc > bestScore) { best = i; bestScore = sc; }
  }
  return best;
}

function firstSentenceContaining(text, needle) {
  if (typeof text !== 'string' || text.length === 0) return null;
  const sentences = text.split(/(?<=[.!?])\\s+|\\n+/).map(function (x) { return x.trim(); })
    .filter(function (x) { return x.length >= 20 && x.length <= 500; });
  if (sentences.length === 0) return null;
  if (typeof needle === 'string' && needle.length > 0) {
    const n = needle.toLowerCase();
    for (let i = 0; i < sentences.length; i += 1) {
      if (sentences[i].toLowerCase().indexOf(n) !== -1) return sentences[i];
    }
  }
  return sentences[0];
}

// Verification block for one discovery: where the evidence came from, whether
// a second independent source type mentions the same concept, and an honest
// novelty status. Deterministic, no network, no LLM.
function buildEvidence(item, queryConcept, docConcept, allItems, runDate) {
  const it = (item && typeof item === 'object') ? item : {};
  const text = typeof it.abstract === 'string' ? it.abstract
    : (typeof it.text === 'string' ? it.text : '');
  const sentence = firstSentenceContaining(text, docConcept);
  const url = it.url || it.link || (it.doi ? 'https://doi.org/' + it.doi : '') || '';
  const needle = (typeof docConcept === 'string') ? docConcept.toLowerCase() : '';
  const others = [];
  if (needle.length > 0 && Array.isArray(allItems)) {
    for (let i = 0; i < allItems.length; i += 1) {
      const o = allItems[i];
      if (!o || o === item) continue;
      if (o.source && it.source && o.source === it.source) continue;
      const t = (typeof o.abstract === 'string' ? o.abstract : (typeof o.text === 'string' ? o.text : '')).toLowerCase();
      if (t.indexOf(needle) !== -1 && others.indexOf(o.source || 'unknown') === -1) others.push(o.source || 'unknown');
    }
  }
  return {
    source_trail: [{
      source_id: it.id !== undefined ? String(it.id) : null,
      title: it.title || null,
      url: url,
      doi: it.doi || null,
      year: it.year || null,
      source_type: it.source || null,
      retrieval_date: String(it.retrieved_at || runDate).slice(0, 10),
      retrieval_date_source: it.retrieved_at ? 'recorded' : 'run_time',
      extracted_sentence: sentence,
      query_concept: queryConcept,
      doc_concept: docConcept,
    }],
    second_signal: {
      status: others.length > 0 ? 'corroborated' : 'single_source_type',
      other_source_types: others,
      method: 'doc concept appears in an item from a different source type (academic / patent / industry)',
    },
    novelty: {
      status: 'unchecked_external',
      note: 'no novelty search is run in this orchestrator; treat as unverified until checked against the literature',
    },
    judge: 'none (deterministic code; thesis text, if LLM generated, is triage only)',
  };
}

// ---------- runDiscovery (the public entry point) ----------""")

# bounded + resilient scoring loop
rep("""  const preprocessedArr = Array.isArray(preprocessed) ? preprocessed : [];

  // ---------- Phase 3: Detection + Classification + Scoring (89.2) ----------

  const scored = [];
  const classified = [];
  const breakthroughs = [];

  for (let i = 0; i < preprocessedArr.length; i += 1) {
    const item = preprocessedArr[i];
    const queryConcept = pickQueryConcept(domain_analysis, item);
    const docConcept = pickDocConcept(item);

    const scoredEntry = await m.differentialScorer.score(
      queryConcept,
      docConcept,
      opts.scorerOpts || {}
    );
    // Tag the scored entry with the originating concepts so the
    // classifier and downstream layers can read them.
    const scoredPair = Object.assign({}, scoredEntry, {
      query_concept: queryConcept,
      doc_concept: docConcept,
    });
    scored.push(scoredPair);

    const classifiedPair = m.innovationClassifier.classify(scoredPair);
    classified.push(classifiedPair);

    // Breakthrough scorer expects a classified_pair with passes-through
    // concept fields; the classifier already builds that shape.
    const breakthroughPair = m.breakthroughScorer.scoreBreakthrough(classifiedPair, {
      industry_signal_count: (industry && Array.isArray(industry.signals)) ? industry.signals.length : 0,
      pair_density: 1.0,
    });
    breakthroughs.push(breakthroughPair);
  }
""", """  const preprocessedAll = Array.isArray(preprocessed) ? preprocessed : [];
  const maxItems = resolveMaxItems(opts);
  const truncated = preprocessedAll.length > maxItems;
  const preprocessedArr = truncated ? preprocessedAll.slice(0, maxItems) : preprocessedAll;
  if (truncated) {
    process.stderr.write('rs-discovery-engine: ' + preprocessedAll.length +
      ' preprocessed items exceed max_items=' + maxItems + '; scoring the first ' + maxItems + '\\n');
  }
  const runDate = new Date().toISOString().slice(0, 10);
  const itemErrors = [];

  // ---------- Phase 3: Detection + Classification + Scoring (89.2) ----------
  //
  // scored / classified / breakthroughs stay index-aligned with `kept`
  // (the preprocessed items that scored successfully).

  const scored = [];
  const classified = [];
  const breakthroughs = [];
  const kept = [];
  const keptConcepts = [];

  for (let i = 0; i < preprocessedArr.length; i += 1) {
    const item = preprocessedArr[i];
    const queryConcept = pickQueryConcept(domain_analysis, item);
    const docConcept = pickDocConcept(item);
    try {
      const scoredEntry = await m.differentialScorer.score(
        queryConcept,
        docConcept,
        opts.scorerOpts || {}
      );
      // Tag the scored entry with the originating concepts so the
      // classifier and downstream layers can read them.
      const scoredPair = Object.assign({}, scoredEntry, {
        query_concept: queryConcept,
        doc_concept: docConcept,
      });

      const classifiedPair = m.innovationClassifier.classify(scoredPair);

      // Breakthrough scorer expects a classified_pair with passes-through
      // concept fields; the classifier already builds that shape.
      const breakthroughPair = m.breakthroughScorer.scoreBreakthrough(classifiedPair, {
        industry_signal_count: (industry && Array.isArray(industry.signals)) ? industry.signals.length : 0,
        pair_density: 1.0,
      });
      scored.push(scoredPair);
      classified.push(classifiedPair);
      breakthroughs.push(breakthroughPair);
      kept.push(item);
      keptConcepts.push({ q: queryConcept, d: docConcept });
    } catch (err) {
      // Canon Part 8: egress violations always bubble, never get recorded away.
      if (err && (err.name === 'ExternalEgressViolation' ||
          (ExternalEgressViolation && err instanceof ExternalEgressViolation))) {
        throw err;
      }
      itemErrors.push({ index: i, id: (item && item.id !== undefined) ? String(item.id) : null,
        message: String((err && err.message) || err).slice(0, 200) });
      process.stderr.write('rs-discovery-engine: item ' + i + ' failed and was skipped: ' +
        itemErrors[itemErrors.length - 1].message + '\\n');
      if (itemErrors.length === preprocessedArr.length) {
        throw err; // nothing succeeded: do not return an empty bundle that hides a systemic failure
      }
    }
  }
""")

# write selection
rep("""  const writerPayload = (breakthroughs.length > 0)
    ? breakthroughs[0]   // first discovery is the canonical write target
    : {""", """  const writeIndex = selectWriteIndex(breakthroughs, opts.write_strategy);
  const writerPayload = (writeIndex >= 0)
    ? breakthroughs[writeIndex]   // highest-scoring discovery (2026); 'first' restores breakthroughs[0]
    : {""")

# chain metadata empty path
rep("""    const entry = m.chainFeeder.emitChainMetadata('structural_transfer', 0, active_context);
    chain_metadata.push(entry);
  }""", """    // 2026: 'none' (no classifier ran), consistent with Phase 355 D-04 above;
    // the old literal 'structural_transfer' fabricated a direction.
    const entry = m.chainFeeder.emitChainMetadata('none', 0, active_context);
    chain_metadata.push(entry);
  }""")

# bundle additions
rep("""  // ---------- Assemble bundle ----------

  return {""", """  // ---------- Verification + provenance (2026, additive) ----------

  const verification = breakthroughs.map(function (b, i) {
    return buildEvidence(kept[i], keptConcepts[i].q, keptConcepts[i].d, preprocessedArr, runDate);
  });
  const provenance = {
    schema_version: '2026.1',
    computed_at: new Date().toISOString(),
    tier: tier,
    write_strategy: opts.write_strategy === 'first' ? 'first' : 'best',
    written_index: writeIndex,
    limits: { max_items: maxItems },
    counts: { preprocessed: preprocessedAll.length, scored: scored.length, skipped: itemErrors.length },
    truncated: truncated,
    item_errors: itemErrors,
    ranking: 'deterministic code from the injected scorer modules; no LLM is used for ranking here',
  };

  // ---------- Assemble bundle ----------

  return {""")
rep("""    chain_metadata: chain_metadata,
  };
}""", """    chain_metadata: chain_metadata,
    verification: verification,
    provenance: provenance,
  };
}""")

rep("""    pickDocConcept: pickDocConcept,
  },""", """    pickDocConcept: pickDocConcept,
    selectWriteIndex: selectWriteIndex,
    buildEvidence: buildEvidence,
    resolveMaxItems: resolveMaxItems,
  },""")

# CLI flush
rep("""    .then(function (bundle) {
      process.stdout.write(JSON.stringify(bundle, null, 2) + '\\n');
      process.exit(0);
    })
    .catch(function (err) {
      process.stderr.write('rs-discovery-engine error: ' + (err && err.message ? err.message : String(err)) + '\\n');
      process.exit(1);
    });""", """    .then(function (bundle) {
      // exitCode (not process.exit) so a large bundle piped to another
      // process is fully flushed before the event loop drains.
      process.stdout.write(JSON.stringify(bundle, null, 2) + '\\n');
      process.exitCode = 0;
    })
    .catch(function (err) {
      process.stderr.write('rs-discovery-engine error: ' + (err && err.message ? err.message : String(err)) + '\\n');
      process.exitCode = 1;
    });""")
open(out, "w", encoding="utf-8").write(s)
print("ok")
