# CHANGES-engine (slice a7: reverse-salient detection engines)

Scope: 10 files. Originals are untouched in research/ and pristine in _baseline/orig/. All paths below are relative to package-2026/.

Summary: 6 improved, 4 minor fixes, 0 unchanged. Tests: 37 Python unittest cases + 20 node:test cases + 7 cases in the discovery test file, all passing (details at the end). Nothing was run against a real sentence-transformer, real scikit-learn, the network, or any module outside this slice (see "Not verified").

## Test commands (run from package-2026/, all offline)

    PYTHONDONTWRITEBYTECODE=1 python3 -I rs/_tests/engine/test_rs_engine.py        # 24 cases
    PYTHONDONTWRITEBYTECODE=1 python3 -I rs/_tests/engine/test_detect.py           # 9 cases
    PYTHONDONTWRITEBYTECODE=1 python3 -I rs/_tests/engine/test_static_files.py     # 4 cases
    node --test rs/_tests/engine/agent/agent.test.cjs                              # 10 cases
    node --test rs/_tests/engine/bridge/bridge.test.cjs                            # 5 cases
    node --test rs/_tests/engine/discovery/extra.test.cjs                          # 5 cases
    node rs/_tests/engine/discovery/run_original_style.cjs new                     # the 2026 rs-discovery-engine.test.cjs, 7/7, in a stub tree
    node rs/_tests/engine/discovery/run_original_style.cjs orig                    # the ORIGINAL test + engine in the same stub tree: fails (see below)
    PYTHONDONTWRITEBYTECODE=1 python3 -I rs/_tests/engine/compare_before_after.py  # rs-engine before/after, writes results/
    PYTHONDONTWRITEBYTECODE=1 python3 -I rs/_tests/engine/compare_detect.py        # detect-reverse-salients before/after
    PYTHONDONTWRITEBYTECODE=1 python3 -I rs/_tests/engine/multi_seed.py stub|aniso # legacy vs hybrid over 8 seeds

Test doubles (all under rs/_tests/engine/, never in shipped files): synth.py (synthetic room generator and a concept-collapsing STUB dense encoder), stub_rs_math.py (numpy TF-IDF+SVD in place of scikit-learn; the pure functions of the real rs_math.py run unchanged), make_tree.py (builds scripts/ + lib/core/ with a numpy cosine_similarity shim so the ORIGINAL engine can run too), drive_engine.py (patches the encoder, and with RS_TEST_OFFLINE_EXTERNAL=1 a fake corpus fetch for external/hybrid modes), agent/agent_stubs.cjs, discovery/build_tree.cjs.

---

## rs/shared/scripts/rs-engine.py  (2073 lines to 2751)

Status: improved. Risk to callers: low. One documented default change (scoring), reversible with --scoring legacy.

What was wrong in the original:
- Ranking (abs_diff_topk at 634, 815, 1401, 1634) and gating (`--threshold` 0.30, 1896/1964) use RAW |semantic - lsa|. The LSA matrix is rescaled to be centred at 0.5 (rs_math.normalize_and_l1_similarity) while embedding cosines are not, so the gap largely measures scale mismatch and the fixed 0.30 cut changes meaning with every encoder. Demonstrated below with an anisotropic encoder.
- No embedder available: the semantic matrix is silently set to identity (630, 809, 1387, 1397, 1628), so "reverse salients" become 1 - lsa. Output carried no flag.
- Default model: the module docstring said multilingual-e5-large; the code uses MiniLM. RS_EMBEDDING_MODEL=multilingual-e5-large raised NotImplementedError and killed the run (300, 362).
- An unknown RS_EMBEDDING_MODEL value made the cache key (324) differ from the model stored (MiniLM), so the cache never hit and every run re-embedded.
- semantic_similarity_matrix imported scikit-learn only for a cosine (398); `from ensure_ml_deps import ensure` (64) is a hard failure when the helper is absent.
- frontmatter regexes (163, 182) only match LF; CRLF notes (Windows) lost their frontmatter and leaked it into the body.
- Unreadable files were skipped without a message (217). `_write_results` and the external/hybrid writers did not create the parent of --output or write atomically (1758, hybrid/external branches). `main` raised KeyError on `meta['embedding_model']` for any room with fewer than 2 artifacts (2047), after writing the results file.
- SentenceTransformer was re-instantiated on every call (283).
- External mode labels cached vectors "multilingual-e5-large" although they come from the local rs_cache encoder bridge (1375). Label kept (key compatibility) and `embedding_model_actual` added.
- No bound on artifact count although the pairwise matrices are O(n^2).

What changed:
- New default `--scoring hybrid`: structural signal = LSA topic-membership (unchanged function) plus a BM25 cosine (k1=1.5, b=0.75, deterministic vocabulary order) blended by `--lex-weight` (default 0.5); dense signal = embedding cosine. Each signal is z-scored over the corpus pair distribution, gap = z(dense) - z(structural), and pairs are kept when |gap| is at or above the corpus percentile `--min-percentile` (default 0.90; 0-1 or 0-100). Ranking is pure numpy, deterministic (stable lexsort on gap, i, j), no LLM. For cross-room and hybrid modes the percentile reference is the cross-room / cross-corpus pairs only (eligibility mask), so the cut is not diluted by intra-corpus pairs.
- `--scoring legacy` reproduces the original ranking, threshold default (0.30) and identity fallback. Verified byte-for-byte on every original pair key (test_legacy_identical_to_original).
- `--threshold` now defaults to None: 0.30 for legacy, 0.0 for hybrid (the percentile gates). An explicit value is honoured in both.
- JSON: every original key stays. In hybrid mode `signed_diff` / `abs_diff` hold the z-gap (larger scale, roughly 0 to 6); the raw values are kept in the new `raw_signed_diff` / `raw_abs_diff`. New additive pair keys: scoring, lexical_score, structural_percentile, dense_percentile, structural_z, dense_z, hybrid_signed_gap, gap_percentile, gap_z, verification. New metadata keys: schema ("2026.1"), scoring, min_percentile, lex_weight, dense_degraded, scoring_warnings, provenance (computed_at, seed, signals with model names, normalisation, numpy/python versions), embedding_fallback, embedding_model_actual. Early-out metadata now carries embedding_model: null and edges_written: 0.
- `verification` block per pair (capped at 200 pairs per run, then {"status":"skipped"}):
  - source_trail: two entries with source_id, url, doi, retrieval_date (+ retrieval_date_source recorded|run_time; room files use file mtime), extracted_sentence.
  - claim_evidence: sentence-level problem vs method match. Sentences are split, tagged by problem and method cue words, embedded with the same encoder, and the best problem-sentence / method-sentence cosine across the two documents is reported (roles_labelled false when no cue sentences exist).
  - second_signal: dense percentile compared against two independent lexical percentiles (LSA, BM25); status confirmed | weak | contradicted | degraded_no_dense_model (margin 0.10).
  - novelty: near_duplicate_text (3-word shingle Jaccard >= 0.8), previously_reported (pair present in the prior results file at the output path), else unchecked_external. The external literature check is NOT run (no network); the status says so.
- Hybrid scoring refuses to percentile-gate corpora with fewer than 10 eligible pairs (scoring_warnings explains; use --scoring legacy for tiny corpora).
- Without an embedder, hybrid scoring falls back to a deterministic hashing surrogate (RS_EMBEDDING_MODEL=hashing selects it explicitly) and sets dense_degraded: true. The surrogate is lexical, not semantic, and says so.
- Fixes: CRLF frontmatter, utf-8-sig reads, unreadable-file warning, POSIX relative paths, optional ensure_ml_deps, numpy cosine (no scikit-learn for this step; zero-norm guard), MiniLM loaded once, unknown model names normalised, e5 stub falls back with a warning (recorded), vstack misalignment and mixed-dimension guards, atomic JSON writes with parent mkdir, RS_MAX_ARTIFACTS (default 2000) with a warning, `.get` for summary fields.
- New CLI flags: --scoring, --min-percentile, --lex-weight, --no-verify. All existing flags unchanged.

How verified: 24 unit/integration cases (percentile ties and degenerate sizes, BM25 identical/empty/stopword-only documents, zero-norm cosine, CRLF, cache key for unknown model, e5 fallback, deterministic runs, legacy identity vs original, key superset, parent-dir creation, previously_reported and near_duplicate statuses, degraded flag, tiny and empty rooms, bad CLI values, 0-100 percentile, cross-room, hybrid mode and external mode via an offline fake corpus). Before/after on one synthetic room (5 sections x 8 notes + 2 planted pairs: one different-words-same-meaning, one same-words-different-meaning), same data, stub dense encoder:

| run | planted recovered in top 10 | direction correct | planted score vs best non-planted |
|---|---|---|---|
| original | 2/2 (ranks 1, 2) | 2/2 | 0.862, 0.491 vs 0.438 |
| 2026 --scoring legacy | 2/2 | 2/2 | identical to original |
| 2026 hybrid (default) | 2/2 (ranks 1, 2) | 2/2 | z-gap 2.996, 2.071 vs 1.375 |

Across 8 seeds of background noise, top 5: legacy 16/16 planted with correct direction, hybrid 16/16 (identical precision 0.40, because there are only two planted pairs in five slots). So on a well-scaled encoder the hybrid does not recover more; it separates planted from noise by a larger margin. With an anisotropic encoder (shared component added, so every cosine is high, the way e5-style models behave; results/multi_seed_aniso.txt) legacy recovers 8/16 and drops to precision 0.20, hybrid still recovers 16/16 at 0.40. This is a synthetic test with my own stub encoder; it supports the scale-robustness claim, not a claim about real-corpus quality.

Performance: PairScorer on random 1500-document matrices: init 1.6 s, top-k 0.05 s, peak RSS 476 MB (500 docs: 0.3 s, 91 MB).

Observation (rs_math.py, owned by another reviewer): `normalize_and_l1_similarity` saturates many pairs at exactly 0.0 (maximum L1 distance), producing large tie groups, and its `diff = |n[:,None,:] - n[None,:,:]|` broadcast allocates n * n * n_topics float32 (about 2.9 GB at n=3000, 80 topics).

---

## rs/shared/scripts/detect-reverse-salients.py  (244 lines to 575)

Status: improved. Risk to callers: low (library default unchanged; CLI default changed and documented).

What was wrong in the original:
- `min_similarity` (137) requires BOTH lsa_sim and semantic_sim >= 0.20. A same-words-different-meaning pair has low semantic similarity by definition, so the filter removes the second class of reverse salient this tool is for. Feasibility is already priced into breakthrough_potential via min(lsa, semantic).
- The input holds only the top 20 pairs compute-hsi.py kept above its own 0.30 (compute-hsi.py line 779), so there is no corpus to take a percentile of; the second 0.30 threshold is redundant. Percentiles added here are explicitly over that survivor pool (`pool_is_corpus: false`).
- hsi_score = 0.6*|lsa - semantic| + 0.4*integrative_factor, so a pair can pass 0.30 with almost no lsa/semantic disagreement (writing style alone). Not visible in the output.
- Direction convention conflict: this script and compute-hsi.py call lsa > semantic "structural_transfer"; rs-engine.py calls semantic - lsa > 0 "structural_transfer". Same situation, opposite labels.
- Robustness: KeyError on any pair missing a key, `best_score = 0.0` seed excludes zero-score pairs, negative `--top-n` slices from the end (`candidates[:-1]`), `.hsi-results.json` rewritten non-atomically, spectral bonus unbounded.

What changed: `--scoring hybrid|legacy` (CLI default hybrid; function default `scoring='legacy'`), `--min-percentile`, `--direction-convention B|A` (default B, the original), `--no-verify`; fixed floors dropped in hybrid unless `--threshold` is explicit; validation of pairs (skipped count reported); `--top-n` must be >= 1; spectral clamped to 0..1; deterministic sort tie-breaks; atomic write; `reverse_salients_provenance` key. New per-opportunity keys: scoring, direction_convention, differential_percentile, differential_z, pool_size, pool_is_corpus, verification (source trail with recorded/run-time retrieval dates, claim-level evidence by lexical Jaccard because this script has no embedder, second_signal confirmed | weak_gap_driven_by_integrative_factor, novelty unchecked_external | previously_reported). Artifact text is read only from paths that resolve inside the room.

How verified: 9 cases incl. legacy output identical to the original on the same data, hybrid keeps the low-semantic planted pair that the original drops, weak-gap pair flagged, malformed input (original crashes, 2026 reports "skipped 2"), traversal path ignored, convention A flips labels, determinism. Before/after on the same synthetic .hsi-results.json (results/detect_before_after.txt): the original returns 2 opportunities out of 6 section pairs; hybrid returns 6, including the planted low-semantic pair (confirmed) and the planted no-real-gap pair (flagged weak_gap_driven_by_integrative_factor).

---

## rs/shared/lib/agents/reverse-salient-agent.cjs  (905 lines to 985)

Status: improved. Risk: needs-check only for tests that mock `execFileSync` (the call is still synchronous; see below).

What was wrong in the original:
- The python branch dropped `threshold` (267-275 builds args without it) and could not run external/hybrid modes (no --topic, and results land in research/<slug>/ while the agent reads the room root).
- Fixed 60 s timeout (277) for an engine that loads a model; no maxBuffer.
- A results file from an earlier run was read as current if the engine exited 0 without writing.
- Cascade mapping cuts at |signed_diff| > 0.7 on the raw [-1, 1] scale; with the 2026 engine's hybrid scoring the z-gap would push nearly every finding into ENABLES / INVALIDATES. (A compatibility hazard created by my engine change, handled here.)
- `path.join(roomDir, artifactId + '.md')` (192) with an id from engine output can leave the room.
- Several `catch (_e)` blocks swallowed errors with no trace.

What changed: normalizePair prefers `raw_signed_diff` / `raw_abs_diff` (older output unchanged) and passes scoring, gap_percentile, gap_z, verification through; composeFinding adds `verification` and `scoring` as data (not rendered, D-29 scalar-free render preserved and tested); python branch forwards threshold, topic, scoring, passes `--output` to the file it reads back, honours `timeoutMs` / `RS_ENGINE_TIMEOUT_MS`, 16 MB maxBuffer; stale-result guard (new reason `rs_engine_results_stale`, python backend only); runRsEngine also returns `metadata`; resolveInside containment for artifact ids; `RS_AGENT_DEBUG=1` logs formerly silent catches to stderr. All exports and return shapes kept; `_internal` gains resolveInside.

Deliberately not changed: the engine call stays `execFileSync` (blocking). Converting to async `execFile` would be the better design but could break callers or tests that stub `child_process.execFileSync`; I could not see them.

How verified: 10 node:test cases, using stubs for the 9 core/hmi modules and the real 2026 rs-engine.py (hashing encoder): cascade-map table unchanged, raw-scale preference, end-to-end python backend (all signed_diff within [-1,1], verification present), render stays scalar-free, flag forwarding via a fake interpreter, stale results, timeout, containment, error contracts, no em dash.

---

## rs/shared/scripts/rs-discovery-engine.cjs  (743 lines to 912)

Status: improved. Risk: low to needs-check (see write_strategy).

What was wrong in the original:
- Persists `breakthroughs[0]` (587), the first document emitted by the preprocessor, not the best one.
- One failing document in the scoring loop rejected the whole run after all the fetching; the loop was unbounded.
- Empty-discovery chain_metadata used 'structural_transfer' (679) while the rest of the file moved to 'none' under Phase 355 D-04.
- CLI `process.exit(0)` right after a large stdout write (737) can truncate piped output on platforms where pipe writes are asynchronous (not reproduced on Linux here).
- No source trail, corroboration, novelty status or provenance in the bundle.

What changed: `opts.write_strategy` ('best' default; 'first' restores the old target; ties and score-less input resolve to index 0 so mocked tests behave as before); `opts.max_items` / RS_DISCOVERY_MAX_ITEMS (default 500) with a stderr note; per-item failure is recorded in `provenance.item_errors` and skipped, ExternalEgressViolation always bubbles, and if every item fails the first error is thrown; empty path uses 'none'; CLI uses exitCode. New bundle keys `verification` (aligned with breakthroughs: source trail incl. extracted sentence quoting the doc concept, second_signal corroborated | single_source_type across source types, novelty unchecked_external) and `provenance`. All previous keys untouched. `_test` gains selectWriteIndex, buildEvidence, resolveMaxItems.

How verified: the 2026 test file runs 7/7 in a stub tree; extra.test.cjs 5/5 (egress bubbling, input audit first, empty path, tie rules, no em dash).

---

## rs/shared/lib/memory/rs-discovery-engine.test.cjs  (323 lines to 407)

Status: improved. Intent kept (thesis-merge fence T1-T3). Risk: none (test file).

What was wrong: it cannot run in this slice (needs cross-room-aggregator.cjs, rs-thesis-generator.cjs, rs-sqlite-mirror.cjs, room-db and about 17 other modules), AND it was stale against the current producer in two ways, both confirmed by running the ORIGINAL test against the ORIGINAL engine in the stub tree:
1. Its mock set lacks `fetchCorpus` / `researchCache`, which the engine has used for the academic fetch since Phase 130.5-03, so T1 to T3 reach the real network fetch (the stub throws, exit 1).
2. With that fixed, T2 fails on `classification === 'structural_transfer'`: the empty-fallback envelope has been 'none' since Phase 355 D-04.

What changed: the two mocks added; the T2 assertion corrected to 'none'; T4 to T7 added (best-score write target and the 'first' escape hatch, per-item failure isolation and all-fail throw, verification block, bounded loop). The runnable variant is rs/_tests/engine/discovery/ (build_tree.cjs builds stubs for every required module, including a node:sqlite-backed sqliteMirror so T3 writes real rows; run_original_style.cjs runs the shipped test unmodified inside it).

---

## rs/shared/scripts/rs-vector-bridge.cjs  (410 lines to 444)

Status: minor fixes. Risk: none (protocol, tags, exit code, `_test` exports unchanged).

What was wrong: `require('../lib/core/room-db.cjs')` at module top (91) runs for every op, so an `embed` request (no database involved) crashed with a stack trace and non-zero exit when room-db could not load, contradicting the header's "ALWAYS exit 0, never throw" contract (reproduced: original exit non-zero with empty stdout). stdin and `texts` were unbounded and unvalidated; a knn query of the wrong length was handed to the store.

What changed: lazy room-db require inside openRoom (failure becomes room_open_failed); stdin cap 64 MB (oversize becomes bad_stdin); `texts` must be 1..10000 strings (bad_texts with detail); knn rejects a query whose length differs from the store dimension (bad_query). The rest of the file is sound and was left alone.

How verified: 5 node:test cases over the real CLI protocol with stub room-db / embedding-spine / vector-store, run against both original and 2026 files.

---

## rs/shared/agents/reverse-salient-agent.md  (44 lines to 87)

Status: improved. Risk: needs-check (body was a one-line "Wave-0 stub"; frontmatter is byte-identical, so parsers that read only frontmatter are unaffected).

What was wrong: the body was a placeholder pointing at a Wave 2 plan that the .cjs file already implements; nothing stated inputs, outputs, failure behaviour or stopping point. Frontmatter retained as is, including three persona_variants entries (default, researcher_ind, founder_grant) with identical text, which I left because the keys may be consumed.

What changed: body now specifies activation, inputs, output, evidence rules (no scalars in the user-facing text, quote the extracted sentences, report novelty exactly as recorded, F.0 has no RECOMMENDED marker, ranking is the engine's), responses, failure behaviour with the real reason codes, and a stop condition (one finding, one response).

How verified: test_static_files.py checks frontmatter equality with the original, body sections, and that every reason code named exists in the .cjs.

---

## rs/shared/data/hitl-stages-fixtures/{rs-convergence,rs-family,rs-reverse-salient}.json

Status: minor fixes (3 files). Risk: none.

Change: `"schema_version": "2026.1"` added as the second key; nothing else touched (all original keys and values compared equal). Checked: valid JSON, surface equals file name, modes within {ordered, parallel, gate}, shapes match F.n. The rs-family note's "11 phases" could not be reconciled with the 5 listed stages or with the 8 named steps in rs-discovery-engine.cjs; left as written and not verified.

---

## Not verified

- The real scikit-learn LSA path (`lib/core/rs_math.build_lsa_matrix`), real sentence-transformers / MiniLM, the Pinecone and rs_cache bridge paths, Mode B/C against the real corpus fetchers, signal cache, and SQLite edge writing against a real room.db: none could run here. They are covered only through stubs. The edge writer (`write_reverse_salient_edges`) was not exercised; its code is unchanged.
- Whether hybrid scoring improves recall on real corpora: only synthetic data with a stub encoder was tested.
- Windows behaviour (CRLF handling is tested with CRLF files on Linux; path separators and the cowork symlink were not run on Windows).
- The real verification-stamp, navigation, folder-memory, hmi dispatcher and lazygraph modules behind the agent; the live Brain and Theo paths.
- Large-corpus memory: tested to 1500 documents on the scorer only, not the full pipeline.
- Hidden callers or tests that mock `execFileSync`, that expect `breakthroughs[0]` to be persisted, or that read `abs_diff` in the original raw scale from the default (hybrid) output.

## Bugs in the originals the owner should know

1. rs-discovery-engine.test.cjs is stale and cannot pass against the current engine (network fetch via missing mocks; T2 asserts a literal the engine no longer returns).
2. rs-engine.py: `RS_EMBEDDING_MODEL=multilingual-e5-large` crashes the run; with no embedder the semantic matrix is silently identity; CRLF notes lose frontmatter; `main` raises KeyError for rooms with fewer than 2 artifacts after writing results; unknown model names defeat the embedding cache.
3. detect-reverse-salients.py and compute-hsi.py label direction opposite to rs-engine.py.
4. detect-reverse-salients.py: the 0.20 both-sides similarity floor removes same-words-different-meaning pairs; hsi_score can pass on the integrative factor alone.
5. reverse-salient-agent.cjs: threshold is ignored on the python backend; stale results can be surfaced as current.
6. rs-discovery-engine.cjs persists the first, not the best, discovery; one bad document aborts the run.
7. rs-vector-bridge.cjs: `embed` crashes if room-db.cjs cannot load.
8. Upstream of this slice (rs_math.py, other reviewer): tie saturation at 0.0 in the LSA similarity and an O(n^2 * topics) float32 allocation.

## Fix: duplicate check hidden behind the verification cap (2026-10-09)
- File: shared/scripts/rs-engine.py
- Bug: the near-duplicate check ran only inside the verification step, which stops after 200 pairs. A planted duplicate past that point was skipped and never flagged.
- Fix: the duplicate and prior-report check moved into _novelty_check(), which runs for every pair. Skipped pairs keep their status and reason, and now also carry the novelty result.
- Result: test_rs_engine.py 24 passed, 0 failed (was 1 failed).
- Not changed: the 2,000-character truncation in _shingle_jaccard (finding 2), the HSI reducer test (finding 3), the UMAP abort (finding 4).
