# package-2026 / hsi - CHANGES

Slice: the 23 files in `_baseline/assignments/a3-hsi.txt` (HSI scoring, spectral OM-HMM, whitespace detection and its graph/Brain writers, the `/mos:whitespace` command and skill, the tools reference). Originals are untouched under `_baseline/orig/hsi/`. Line references below are to those originals.

Totals: **18 improved, 3 minor fixes, 2 unchanged** (23 files).

Design change that runs through the area (kept additive; every pre-existing output key is preserved):
- **Hybrid lexical + dense**: lexical leg = mean(LSA, BM25); dense leg = sentence-transformers (chunked, mean-pooled), precomputed vectors, or Pinecone. The LSA-only path is still selectable (`--lexical lsa`, `{lexical:'lsa'}`).
- **Corpus-percentile ranking** replaces fixed cutoffs (0.30 HSI, 10th-percentile density, 0.6/0.5/0.4 external, 0.3/0.5 coverage, 1.0 UMAP spread). The old rule is selectable everywhere (`--ranking legacy`, `--gap-method legacy`, `--selection legacy`, `--signal-method fixed`, `--spread-fixed`).
- **Second-signal check, source trail, novelty-check status, provenance block, `schema_version` "2.0"** on every result file. The novelty check is in-room only; external literature is recorded as `not_run`.
- numpy/scikit-learn/scipy availability checked; sklearn is optional everywhere (numpy fallbacks), `HSI_NO_AUTO_INSTALL=1` disables auto pip-install.
- Atomic writes (tmp then rename) for every result file.

## How to run the tests (from the `research` directory)

```
node --test package-2026/hsi/_tests/test_hsi_js.cjs package-2026/hsi/_tests/test_whitespace_js.cjs
PYTHONDONTWRITEBYTECODE=1 HSI_NO_AUTO_INSTALL=1 python3 -I -m unittest discover -s package-2026/hsi/_tests -p 'test_*.py'
```

Results actually obtained: **Node 34/34 pass** (17 + 17), **Python 61/61 pass** (32 compute-hsi, 14 embeddings+gaps, 15 discovery/external/deps). Syntax: `node --check` clean on all 13 shipped .cjs, `ast.parse` clean on all 6 .py, `bash -n` clean on `check-hsi-deps`. No em-dashes in any shipped file. Plugin modules outside this slice (lazygraph-ops, node-insert, verification-stamp*, floor-disclosure, brain-client, navigation, planner shared/eureka-recall, jev-*) are replaced by stubs in `_tests/stubs` via `_tests/_stub_loader.cjs`, so the .cjs tests exercise this slice's own logic, not the real modules.

## Not verified here

scikit-learn code paths (not installed; the numpy fallbacks are what ran), scipy, sentence-transformers and any real embedding model (a deterministic fake encoder was used; `--dense-vectors` and injected `embedTexts` cover the plumbing), UMAP (PCA fallback ran and is recorded in `metadata.provenance.reducer`), Pinecone, Neo4j/Brain writes (fake client), the real SQLite graph (in-memory fake), Semantic Scholar, Windows paths/launchers, and the real plugin modules the stubs stand in for. Quality of the new rankings on real rooms has not been measured.

---

## scripts/compute-hsi.py - IMPROVED (risk: low-to-needs-check for callers that read pair counts)
- Wrong: cache (`check_cache` L304) compared only content hashes, so a changed `--threshold`/`--tier`/`--output` or a deleted result file returned stale or missing results; generated `WHITESPACE.md` was scored as an artifact (feedback loop, `SKIP_FILES` L117-139); SVD unseeded (`random_state` not fixed); creative-feature regex had `\\w+` inside a raw string (L112) so "innovation..." never matched; hard imports of `ensure_ml_deps`/`rs_corpus_exclude` crashed when absent; sklearn mandatory; fixed 0.30 cutoff.
- Changed: cache keyed on content hashes + parameter fingerprint + output existence; WHITESPACE.md skipped; `--seed 42`; regex fixed; guarded imports; numpy TF-IDF/SVD fallback; BM25; hybrid lexical; percentile ranking, `hsi_percentile`, `hsi_z`, `rank`; second signal; optional claim-level evidence; chunked embeddings; `--dense-vectors`; `--allow-lexical-only` (otherwise a missing dense leg is an error, not a silent identity matrix); `--max-artifacts`; provenance, source trail; atomic write. The Python `anolog` and descriptive-prefix regexes are intentionally NOT changed (JS measurement fixtures bind them).
- Risk: default CLI ranking is now percentile (top 20) instead of `>= 0.30`. `--ranking legacy` restores it.
- Verified: 32 unit/end-to-end tests on small synthetic rooms (determinism, cache invalidation, percentile ties, BM25, claim-level, legacy parity).

## lib/core/hsi-lsa.cjs - IMPROVED (risk: none for existing exports)
- Wrong: `clip01InPlace` (L175) let NaN/Infinity through, poisoning every downstream pair.
- Changed: NaN/Infinity clip to 0; new exports `computeLsaSimilarityDetailed` (reports why it degraded to identity), `computeBm25Similarity`, `computeHybridLexicalSimilarity`, `empiricalPercentile`, `zscores`. Original exports unchanged.
- Verified: test_hsi_js.cjs (BM25, hybrid, percentile ties, NaN clip, degraded reasons).

## lib/core/hsi-engine.cjs - IMPROVED (risk: needs-check, `runTier1` defaults changed)
- Wrong: when no embedder was available the semantic leg silently became an identity matrix (L79, L376), so every pair looked maximally "surprising" with nothing recording it; fixed 0.30 cutoff; non-atomic write.
- Changed: `computeHsiMatrix(..., opts)` with lexical/BM25 matrices, ranking, topK, minPercentile; `extractClaims`/`claimLevelScores` exported; `runTier1` defaults to `{lexical:'hybrid', ranking:'percentile'}` (revert with `{lexical:'lsa', ranking:'legacy'}`); identity fallback is now `metadata.provenance.semantic_leg='unavailable-identity'` plus a warning, or refused with `requireEmbedder`; injectable `embedTexts`/`now`; atomic write that creates the parent directory.
- Risk: callers of `runTier1` that assumed >= 0.30 pair lists now get a top-k percentile list by default.
- Verified: test_hsi_js.cjs with stubbed numeric/embedding modules (determinism, legacy parity, identity-fallback provenance).

## lib/core/hsi-spectral.cjs - IMPROVED (risk: low)
- Wrong: `computeSpectralGap` (L327) used an unshifted QR iteration (`qrDecompose` L222). Compared against `numpy.linalg.eigvals` on 60 random 5-state transition matrices it was off by up to 0.28 on 3 of 60 (about 5%): complex or near-tied eigenvalue pairs do not converge under unshifted QR.
- Changed: eigenvalues now from the characteristic polynomial (Faddeev-LeVerrier) with Durand-Kerner root finding; QR helpers removed. Max error vs numpy 8.9e-16; stationary distribution error 3.9e-16 (it was already correct).
- Verified: test against `_tests/fixtures/numpy_spectral_cases.json` (generated by `make_numpy_spectral_cases.py`).

## lib/core/hsi-to-graph.test.cjs - UNCHANGED
Sound; it tests `node-insert`, which is outside this slice. Copied verbatim.

## lib/core/research-planner/perspectives/hsi-recall.cjs - MINOR FIXES (risk: none)
- All-pairs loop is O(n^2) with no bound; added `BUDGETS.max_things` (1500) with `counts.truncated_things`. Added `divergence_percentile` per candidate row. Ranking, lanes and labels unchanged.
- Verified: percentile ranks incl. ties; truncation counts, through a stubbed substrate.

## lib/core/research-planner/perspectives/whitespace-recall.cjs - UNCHANGED
Reviewed in full; sound. Copied verbatim.

## references/hsi/HSI-TOOLS-REFERENCE.md - IMPROVED (documentation)
- Wrong: described max_features 2000, max_df 0.5, `random_state=256`, BERT-large, a Gemini/Claude embedding API, min-max normalisation of similarities and a "Phase 6 plan 06-03" roadmap; none matches the code (500 features, seed 42, MiniLM, clipped cosine).
- Changed: rewritten to the shipped behaviour and the 2026 hybrid (tiers, flags, output schema, graph edges, whitespace scripts). Interpretive edge words (ENABLES, CONTRADICTS...) are explicitly labelled as Larry's conversational labels, not script output.

## scripts/check-hsi-deps - MINOR FIXES (risk: low, one behaviour change)
- Wrong: exit 2/`tier:0` without scikit-learn although compute-hsi now (and arguably only needed) numpy; no diagnostics.
- Changed: numpy is the Tier 1 minimum (`HSI_REQUIRE_SKLEARN=1` restores the strict check); `python3`/`python` probing; one `detail:` line on stderr; stdout contract `tier:N` and exit codes 0/1/2 unchanged.
- Verified: runs here -> `tier:1`, exit 0; contract tests.

## scripts/compute-whitespace-embeddings.py - IMPROVED (risk: low)
- Wrong: `check_embedding_cache` (L159) required the cached model to equal the requested one, so after the MiniLM fallback (L71) the cache never hit and the whole room was re-embedded every call; generated WHITESPACE.md embedded as an artifact; truncation of long artifacts to the model window; sklearn mandatory only for cosine.
- Changed: cache accepts a set of models and the settings; chunked mean-pooled embeddings (`--no-chunking` restores); optional `--claims` sentence vectors; validated encoder output (wrong row count or NaN aborts instead of writing a corrupt cache); atomic write; schema_version/settings/provenance; shared exclusion list.
- Verified: 14 tests incl. fake-encoder cache hit after fallback, settings invalidation, claims, bad encoder.

## scripts/compute-whitespace-gaps.py - IMPROVED (risk: needs-check, selection rule changed)
- Wrong: `rank_by_strategic_importance` (L286-308) read `rs_data["data"]["reverse_salients"]` but `.hsi-results.json` keeps them at the top level, so the RS boost never fired; gaps had no `zone_id`/`nearest_frameworks`, novelty rows no `artifact`/`nearest_concept` (consumers read those); Scott's rule used as an absolute bandwidth (L235, `n^(-1/(d+4))`) regardless of data scale; UMAP failure swallowed by `except Exception` (L172) with the reducer never recorded; the room's own density included each point itself; sklearn mandatory; dimension mismatch crashed; `umap_2d` lacked the `room_artifacts` list the anchor gate reads.
- Changed: hybrid gap selection (mean percentile of KDE, k-NN, dense cosine, lexical coverage; `--gap-percentile 0.75`), `--gap-method legacy` keeps the 10th-percentile rule; `scott-scaled` bandwidth (`--kde-bandwidth scott` keeps the old); RS boost reads both layouts; adds `zone_id`/`gap_id` (same `ws-<slug>-<md5[:8]>` the graph writer derives, checked against JS), `nearest_frameworks`, `source_trail`, `second_signal`, `novelty_check`, `gap_percentile`, novelty aliases + `novelty_percentile`/`novelty_band`, `umap_2d.room_artifacts`; reducer + reason recorded; dimension mismatch reported as an empty result with a note; numpy KDE (matches the closed form in a test); atomic write.
- Risk: default now reports the top quarter of Brain frameworks by sparsity, not "density under the 10th percentile". Use `--gap-method legacy` for the old set.
- Verified: 14 tests (far frameworks preferred, schema/aliases, legacy, determinism, RS boost both layouts, mismatch, KDE closed form, CLI). UMAP itself not run (PCA fallback).

## scripts/compute-external-whitespace.py - IMPROVED (risk: low)
- Wrong: `find_gap_filling_suggestions` (L311 `pass  # Skip complex matching`) ignored dict-form `nearest_room_artifacts`, which is exactly what the gaps script writes, so gap filling never produced anything; `paper["paperId"]` (L263, L342, L398) raised KeyError on a record without an id; fixed 0.6/0.5/0.4 cutoffs; output keys `cross_domain_zones`/`cross_domain_papers` while `whitespace-command.cjs` reads `zones`/`papers`; no source trail; non-atomic.
- Changed: id resolution for ints, dicts and strings; percentile selection (`--selection legacy` for the fixed cutoffs); fallback paper id; per-zone/paper/suggestion `source_trail` (paper id, url, year, retrieval date, closest abstract sentence); both key spellings written; dimension-mismatch guard; atomic write; provenance records that only the retrieved set was compared.
- Verified: 15-test discovery file incl. dict-form gap filling, id-less paper, aliases, percentile vs legacy.

## scripts/discover-hsi-whitespace.py - IMPROVED (risk: low)
- Wrong: room density measured with the seed pair left in (`room_nn` L199), so the centroid sat next to its own seeds and the "strong" signal (room density < 0.3) almost never fired; fixed signal cutoffs; fixed 0.4 threshold ignoring the ranking compute-hsi used; sklearn mandatory.
- Changed: seed pair excluded; signal judged against the room's own artifacts (`--signal-method fixed` restores); pair selection follows the results file's ranking unless `--threshold`; second signal, source trail; numpy kNN; atomic write.
- Verified: seed exclusion test, threshold/legacy-file handling, mismatch, CLI.

## scripts/discover-rs-whitespace.py - IMPROVED (risk: low)
- Wrong: fixed coverage cutoffs 0.3/0.5 (L226) that depend on the embedding model; sklearn mandatory; no dimension guard.
- Changed: coverage judged as a percentile among the room's sections (>= 4 sections; else fixed); second signal, source trail, bottleneck score carried; numpy kNN; atomic write.
- Verified: dedup of target sections, percentile vs fixed, CLI.

## scripts/hsi-to-graph.cjs - IMPROVED (risk: low)
- Wrong: `if (pair.hsi_score <= 0.3) continue;` (L216) dropped pairs at exactly 0.30 (compute keeps `>= 0.30`) and, with percentile ranking, would drop most of the pairs compute had chosen; missing/malformed results exited silently; when pairs existed but 0 edges were written the old edges were already deleted and nothing said so.
- Changed: `pairQualifies` (percentile files as ranked; legacy `>= 0.30`; `--min-score`); extra edge properties (`hsi_percentile`, `hsi_z`, `lexical_sim`, `bm25_sim`, `rank`, `second_signal_confirmed`, `results_schema_version`); stderr diagnostics and a zero-edge warning. Exit codes and the MOAT-01 transaction unchanged.
- Verified: in-memory graph test (properties, skipped counts, one BEGIN/COMMIT).

## scripts/interpret-whitespace.cjs - IMPROVED (risk: needs-check, validation now reachable)
- Wrong: the anchor gate read `umap2d.room_artifacts` (L238) which the gaps script never wrote (it wrote `room` + `labels_room`), so every zone failed "Insufficient UMAP data", nothing validated and nothing reached the Brain; `.filter(Boolean)` (L257) dropped cluster id 0; fixed `SPREAD_THRESHOLD = 1.0` (L273); with Brain unavailable the consensus gate failed every zone as "not found in Brain" (it never evaluated); `effectiveness` is synthesised as 1.0 yet reported as confidence; non-atomic write; silent brain-client load error.
- Changed: reads both projection layouts (id, then title); cluster 0 kept; spread threshold = median pairwise room distance (`--spread-fixed` for 1.0); consensus gate reports `skipped` with reasons in `validation.gate_reasons`; `--offline-validate` opt-in anchor-only validation recorded as `basis: anchor_only`; `effectiveness_source: synthetic-1.0`; `--hypothesize` ranks by `gap_percentile`; bad `--top` reported; atomic write.
- Risk: zones can now actually validate, so downstream `whitespace-to-brain` will start writing them.
- Verified: gate tests incl. tiny-scale projections where fixed 1.0 cannot pass; end-to-end with Brain unavailable.

## scripts/measure-hsi-thinking-mode.cjs - MINOR FIXES (risk: none)
- Wrong: `parseArgv` (L574) ignored unknown flags and fell back to 3 repeats on a missing/non-numeric `--repeats`, so a typo ran a paid live measurement with unintended settings.
- Changed: unknown flag, missing value, non-positive `--repeats` are errors (exit 2, nothing run); `parseArgv` exported. Measurement logic, regex mirror and the D-45 bar untouched.
- Verified: parseArgv and `main` exit-code tests.

## scripts/whitespace-command.cjs - IMPROVED (risk: low-to-needs-check)
- Wrong: `execSync` with interpolated paths (L316 and callers) - a room path containing `"`, `$(...)` or a backtick ran as shell; gaps had no `zone_id` so `map` printed `?` and `analyze ZONE` could not find any zone; novelty rows read as `artifact`/`nearest_concept` but written as `artifact_id`/`nearest_brain_framework`; `data.zones`/`data.papers` (L800) vs the script's `cross_domain_*`; `map` embedded only when the file was missing (L356), so edited artifacts were scored against stale vectors; timeouts reported as empty messages.
- Changed: `execFileSync` with argument vectors, Python launcher resolution (`MINDRIAN_PYTHON`, `python3`/`python`); `normalizeGap`/`normalizeNovelty`/`zoneIdFor`/`sortGaps`/`noveltyBand`; embedding refresh every `map` (cache makes it cheap; a failed refresh with an existing file continues with a warning); zones sorted by `gap_percentile`, bands from `novelty_band` (`MINDRIAN_WHITESPACE_BANDS=legacy` for the old order and fixed 0.8/0.4); timeout messages; `analyze` shows not-evaluated gates. D-29 (no raw decimal) preserved and tested.
- Verified: normaliser tests; a shell-metacharacter argument is passed through literally and creates no file; render functions.

## scripts/whitespace-to-brain.cjs - IMPROVED (risk: low, one property type change)
- Wrong: `parseInt(zone.strategic_rank || 0, 10)` (L138) truncated fractional ranks, so almost every zone was written with rank 0; NaN could be emitted into Cypher; `esc` (L96) left CR/TAB; the swallow-all catch hid every error reason; bracketed artifact titles in hypotheses could leave the room (contradicting the file's anonymisation claim).
- Changed: finite-float rank/density; `esc` handles CR/TAB; brackets scrubbed (`--omit-hypothesis` drops the text); `skipped_reason` and `error_samples` in the summary. Risk: `strategic_rank` is stored as float for newly written zones.
- Not changed (flagged): `zoneHash` includes density to 4 decimals, so a re-run with a different density creates a new zone node; a `MATCH` on a missing Framework still counts as an edge.
- Verified: Cypher builders and `main` with a fake Brain (unavailable / throwing / ok).

## scripts/whitespace-to-graph.cjs - IMPROVED (risk: low)
- Wrong: loop at L190 passed each `nearest_room_artifacts` entry (a `{artifact_id,...}` object) to `linkWhitespaceToArtifact` as if it were an id; every call failed inside an empty `catch` (L194, L212) and the summary still printed a normal-looking "0 edges"; silent exits on missing/malformed results.
- Changed: `normalizeArtifactId`, counters and the first distinct error messages printed with the summary, a warning when zones are written with no links, stderr notes for missing/unreadable input; `zoneIdFor` exported and tested against Python.
- Verified: in-memory graph test (links, section edges, unusable entries counted).

## scripts/write-whitespace-sections.cjs - IMPROVED (risk: low)
- Wrong: `main()` ran at load (L483) and called `process.exit`, so the module could not be tested or reused; `|` or newline in a title broke the Markdown table (L377); only the first `_` was replaced in gate labels (L337); gaps whose nearest artifacts sit in no section folder were silently dropped; non-atomic writes.
- Changed: `main(argv)` returns the exit code, guarded by `require.main`, builders exported; `cell()` escaping; all underscores replaced; unclassified count on stderr; frontmatter `schema_version`/`gap_method`; per-gap percentile, second-signal and source-count lines and a Percentile column only when the results have them; atomic writes.
- Verified: end-to-end on a temp room.

## commands/whitespace.md and skills/whitespace/SKILL.md - IMPROVED (risk: none, documentation)
- Wrong: the score step said the data key is `artifact_novelty_scores` (it is `novelty_scores`); the external Zone 2 template showed `relevance: [score]` while the dispatcher prints a rank; the Desktop line "Numbers and zone IDs still shown" contradicts D-29 (no raw decimals); the timeout error ended in "contact support"; the step text implied a fixed density sort and "embeddings if needed".
- Changed: those lines corrected, a sparsity/percentile and in-room-only note, and a new "Inputs, Outputs, Failure and Stop" section. Locked conventions (12 glyphs, 4-zone output, voice rules, firing block, D-29/D-50 wording) untouched. The two files received identical edits; their intentional differences (license line, `allowed-tools` form, `sensor_triggers`, `MINDRIAN_OS_ROOT` prefixes) are preserved.

---

## Bugs in the originals the user should know about
1. `hsi-spectral.cjs`: spectral gap wrong on about 5% of transition matrices (up to 0.28 off numpy).
2. `compute-hsi.py`: result cache ignored threshold, tier, output path and a deleted result file (stale or missing results).
3. `compute-hsi.py` and `compute-whitespace-embeddings.py`: generated `WHITESPACE.md` files were scored/embedded as artifacts (feedback loop).
4. Producer/consumer mismatches that made features silently dead: gaps lacked `zone_id` (so `map`/`analyze` never worked), `interpret-whitespace` anchor gate always failed (nothing ever validated or reached the Brain), `whitespace-to-graph` never wrote an edge, `compute-external-whitespace` gap filling never worked, the RS boost in the gaps script never fired, `external` read the wrong output keys.
5. `compute-whitespace-embeddings.py`: cache never hit after the MiniLM fallback.
6. `compute-hsi.py`: the creative-feature regex had a doubled backslash; SVD was unseeded.
7. `whitespace-command.cjs`: shell injection through room paths (`execSync` with interpolated strings).
8. `hsi-engine.cjs`: a missing embedder silently produced an identity semantic matrix.
9. `hsi-to-graph.cjs` used `<= 0.3` against compute's `>= 0.30`.
10. `hsi-lsa.cjs`: NaN passed through `clip01InPlace`.
11. `whitespace-to-brain.cjs`: fractional strategic ranks truncated to 0.
12. Left as is, flagged: `whitespace-to-brain` zone hash includes density (re-runs duplicate zones); a missing Framework still counts as an edge; the Python `anolog` typo regexes are kept for JS/Python parity with the 355 measurement fixtures.
