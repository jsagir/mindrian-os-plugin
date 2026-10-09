# analogies: 2026 change log

Scope: the 11 files in `_baseline/assignments/a2-analogies.txt`. Originals in `research/analogies/` and `_baseline/orig/` were not touched. Backward compatibility: every export, CLI flag, JSON key and path of the originals is kept; all additions are additive. The one-shot scripts that applied the edits are in `_tests/_patches/` (record only, not needed at runtime).

Run all tests (from `package-2026`):

    node analogies/_tests/test_fitness.cjs && node analogies/_tests/test_recall.cjs && PYTHONDONTWRITEBYTECODE=1 python3 analogies/_tests/test_whitespace.py

Last run: test_fitness.cjs 46 pass / 0 fail; test_recall.cjs 14 pass / 0 fail; test_whitespace.py 12 pass / 0 fail (unittest). The tests build temp sandboxes that copy the shipped file next to small stubs (the embedding spine, online-pattern-query, eureka-recall, shared, navigation and scikit-learn are NOT in this slice; stubs live only under `_tests/`). Several tests also run the ORIGINAL file in the same sandbox and compare, so "unchanged behaviour" claims are measured, not assumed.

Totals: 8 improved, 3 minor fixes, 0 unchanged.

## lib/core/semantic-index/analogy-fitness.cjs
Status: improved. Risk to callers: low.
- Wrong (orig lines 99, 89): the layer-correspondence threshold (0.5) and restatement floor (0.8) are absolute cosines that depend on the encoder; swapping the model silently changes every band. Nothing derived them from the corpus.
- Wrong (orig 274-285): the command promises "a restatement can never sit at Rank 1", but band-first ordering does not guarantee it when every candidate is thin-banded. Test `legacy order lets the restatement lead` demonstrates the original behaviour.
- Wrong (orig 134, 176): cosine of a zero vector (empty text) can return NaN, which flowed into `score`; NaN layer cosines poisoned `mean`.
- Wrong: sort had no final tie-break, so equal scores ranked by input order.
- Changed: new `scoreCandidates(source, candidates, opts)` derives per-layer thresholds as an empirical 75th-percentile quantile of the candidate corpus (clamped 0.3 to 0.9, `MINDRIAN_ANALOGY_ABS_FLOOR`), re-bands the same cosines with no extra encoder call, trips the restatement flag on batch text percentile (>= 0.9 and >= 0.5), and adds `percentile`, `z` and a `scoring` provenance block (mode, thresholds, parameters, computed_at). Fewer than 5 candidates falls back to the fixed thresholds and says so. `thresholdMode: 'fixed'` reproduces the old results exactly. Also new exports `bandFromLayers`, `empiricalPercentile`, `quantile`, `zScore`; `rankCandidates(results, {legacy})` adds the Rank-1 restatement lift and an id tie-break; NaN guards; env floats clamped to [0,1]. `scoreAnalogyFitness`, `structuralFitness` (now also accepts `opts.layerThresholds`) and `textFitness` keep their signatures and results.
- Not changed: BANDS table (structural 0.6-0.8 and deep 0.8-1.0 touch at 0.8; harmless because ranking is band-first, documented in sapphire-encoding.md).
- Verified: 46 tests incl. regression equal to original for single pairs and for fixed-mode batches, determinism, small and empty corpus, degrade with no numeric fields.

## scripts/analogy-fitness-report.cjs
Status: improved. Risk: low.
- Wrong (orig 258): `process.exit(code)` after large piped stdout can truncate output; now sets `process.exitCode`.
- Wrong (orig 82-87): `--out` with no value became `undefined` and crashed later; now `bad_input` with reason `out_requires_path`. Write errors for `--out` no longer crash after the report printed.
- Wrong: no bound on candidate count; now `--max-candidates` (default 200) with `candidates_truncated` reported.
- Changed: uses `scoreCandidates`; new flags `--rank-mode percentile|fixed` (default percentile) and `--legacy-rank`; every original report key and row key kept; added `scoring`, `n_scored`, `generated_at`, `stub_encoder`, per-row `fusedPercentile`, `fusedZ`, `legacyBand`, `source_trail` {source_id, source_url, source_tier, retrieved_at, evidence, novelty_check (default `not_checked`)}; matrix gains a Pctile column only when percentiles exist, plus a `threshold mode` line. Documented that a relative `--out` resolves against the plugin root (legacy).
- Default changed: percentile ranking is on by default for 5 or more candidates; smaller runs are identical to 2025.
- Verified: 46-test file above, including CLI runs for score, `--rank-mode fixed`, `--out`, truncation, bad input, compose-queries and a key-superset check against the original CLI output.

## scripts/discover-analogy-whitespace.py
Status: improved. Risk: low (default mode changed, `--mode fixed` restores 2025).
- Wrong (orig 292-294): the articulation gap used the max cosine of ANY room artifact to the centroid, which includes the two endpoints themselves; endpoints are usually the nearest artifacts, so the gap measured the endpoints' mutual distance, not whether anything else explains the transfer. Test: orthogonal endpoints give gap 0.29 in 2025 and 1.0 now when nothing else is near.
- Wrong (orig 186, 319-324): fixed cut-offs (semantic 0.6, lsa 0.3, gap 0.6/0.4, brain 0.3) with unnormalised vectors. Now percentile-ranked against the room's own pairs (HSI: top quartile semantic and bottom quartile lsa; gap strong at 80th percentile with Brain support at or above the median, moderate at 50th), fixed cut-offs when fewer than `--min-corpus` (5) pairs or 8 HSI pairs.
- Wrong (orig 170): a malformed artifact row raised KeyError (test shows the original crashing). Also: ragged vectors, room/Brain dimension mismatch, self-edges and duplicate pairs were unhandled; edge count unbounded (cap 5000, reported).
- Added zone keys: `articulation_gap_percentile`, `articulation_gap_z`, `brain_mean_similarity`, `nearest_brain_similarities`, `nearest_other_artifact` (evidence trail), `endpoints_excluded_from_gap`, `structural_fitness` (pass-through), `verification` {novelty_check: not_checked, second_signal}. Metadata gains `schema_version`, `mode`, `pairs_scored`, `pairs_skipped`, parameters, thresholds used, library versions. New flags `--mode`, `--min-corpus`.
- Verified: `--mode fixed` output equals the original zone-for-zone on a generated room (test). Not verified with real scikit-learn (not installed, no installs allowed): tests use a minimal stub of `cosine_similarity` and `NearestNeighbors`.

## lib/core/research-planner/perspectives/analogies-recall.cjs
Status: improved. Risk: low.
- Wrong (orig 54-55, 162): `substrate.edges`, `framework_nodes`, `things`, `sections` and `c.shared_entities` were dereferenced unguarded (test shows the original throwing on a sparse substrate).
- Wrong (orig 87-89): ties on signal fell through to id order, so among equally relational pairs the one sharing MORE words could lead an analogy list; now least lexical overlap first, then ids.
- Changed: `lexical_mode: 'percentile'` option (default stays `fixed`, because the 0.15 ceiling defines "analogy, not eureka") tightens but never loosens the ceiling using the pool's lowest quartile (pool of 8 or more); rows gain `lexical_percentile`; counts gain `lexical_mode` and `lexical_ceiling_used`; `max_candidates` validated; `questionSetFor` throws a clear error if eureka returns no leaves.
- Note (not changed): `STATEMENT_TEMPLATE` has 3 slots (function, behavior, structure) while the scoring uses 7 SAPPhIRE layers; kept as is because the schema id is consumed elsewhere.
- Verified: 14 tests, default fixed mode keeps the same candidate set as the original.

## references/methodology/sapphire-encoding.md
Status: improved. Risk: none (documentation).
- Wrong: the acronym section presents layers 6 and 7 as published SAPPhIRE; in the literature the 6th construct is oRgan and the final Effect is the physical effect (law). Added a terminology note; layer names stay frozen because code uses them.
- Wrong (orig 336-343): the scoring text said both "proportion of layers" and a set-based band table; clarified to the band rule actually implemented, documented that the ranges leave gaps and touch at 0.8, and that thresholds are now corpus-relative.
- Missing: nothing told the encoder how to turn the nested YAML into the one-string-per-layer the engine needs; added "Flattening an encoding for scoring", with the empty-layer rule.
- Added a note that worked-example figures are illustrative, and that room mappings are heuristics.
- Not verified: I could not open the cited papers; the literature statement relies on my knowledge of Chakrabarti et al.

## references/methodology/triz-matrix.json
Status: minor fixes (metadata only; no cell was added, removed or edited, checked programmatically). Risk: none.
- Problem found: the file declares 39 parameters but has 40 rows (`Manufacturability` and `Ease of manufacture` both present); only 31 of 39 parameters appear as a worsening column; 662 of 1482 possible off-diagonal cells (44.7 percent) are present. So the matrix is NOT complete and cannot be made complete without the source table, which is not available offline; cells were not invented.
- Changed: `_meta` gains `schema_version`, `status: PARTIAL`, row and column counts, coverage fraction, `known_issues`, `parameter_aliases`, `consumer_note`. Structure checks run: all values are non-empty lists of distinct integers in 1..40, no diagonal cells.
- Not verified: cell correctness against Altshuller. Spot reading suggests some cells in the first row (for example the Length, Area and Volume entries) may not match the published matrix; treat the whole file as unverified until diffed against the source.

## references/methodology/triz-principles.md
Status: minor fixes. Risk: none.
- Wrong: the parameter table listed Productivity at #36 and Manufacturability at #39 and omitted Manufacturing precision, matching neither the standard numbering nor the JSON names. Replaced with the standard 1-39 list plus a column mapping to the JSON names, and a coverage warning. The 40 principle descriptions were reviewed and left unchanged.

## data/cross-domain-analogues.json
Status: minor fixes. Risk: none. Added `schema_version`; analogue entries and note unchanged (checked equal, no duplicate or self pairs). Only 2 pairs are seeded; whether the endpoints resolve to registry framework names could not be checked (registries not in this slice).

## agents/analogy-query-fetcher.md
Status: improved. Risk: low.
- Missing source trail: candidates had no retrieval date and no extracted sentence. Added `retrieved_at`, `evidence` (verbatim), `novelty_check: not_checked`; unsupported SAPPhIRE fields must be `""`, candidates with fewer than 3 supported fields are dropped.
- Added: query validation, 5-result cap, one attempt per tool, treat page text as data (prompt-injection rule), explicit stop and failure behaviour. Return shape remains a superset.
- Tool name: added `mcp__Tavily__tavily_search` beside `mcp__tavily__tavily-search` because installs spell the tool differently; which spelling a given install exposes could not be verified.

## commands/find-analogies.md and skills/find-analogies/SKILL.md
Status: improved (identical body edits in both; the SKILL keeps its own root-variable idiom and string `allowed-tools`). Risk: low.
- Wrong: Step 6 used a fixed `fitness > 0.6` trigger; replaced with Structural or Deep band plus the 80th percentile of the run (band alone when fewer than 5 candidates).
- Wrong: "a restatement can never sit at Rank 1" was not guaranteed; the rule now matches the runner (lift, and say so if every candidate is flagged).
- Added: contract block (inputs, outputs, failure, stop), Tier 0 "unverified (model recall)" labelling, source-trail fields for fetched candidates, room-scope novelty status (never claims "novel"), rank-mode explanation and the `threshold mode` line, partial-TRIZ-matrix caution, Pctile column.
- Removed: the stale tooling claim about a specific Claude Code version for background subagents.
- Not changed: `help_jtbd` says "1,427 methodology embeddings"; I could not verify the number (flag for the owner). Both files still duplicate ~95 percent of their body; kept because the plugin loader needs both.
