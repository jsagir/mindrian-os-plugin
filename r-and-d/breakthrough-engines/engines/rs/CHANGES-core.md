# CHANGES-core: rs/shared/lib/core (reviewer a6)

Scope: the 32 files in `_baseline/assignments/a6-rs-core.txt`. Originals are in `_baseline/orig/`.
Totals: 17 improved, 7 minor, 8 unchanged. Public exports, signatures, CLI flags and JSON keys are kept; additions only.
All paths below are relative to `rs/shared/lib/core/`.

## Tests (real runs, from package-2026)

| Command | Result |
|---|---|
| `node rs/_tests/core/crosscheck_math.cjs` (node vs python on seeded data, tolerance 1e-12; drives `crosscheck_math_py.py`) | 28 passed, 0 failed |
| `node rs/_tests/core/regress_math.cjs` (new vs original `rs-math` / `rs_math` on 25 seeded cases) | 5 passed, 0 failed |
| `node rs/_tests/core/modules_core.test.cjs` (sandbox copy of shipped files plus stubs) | 14 passed, 0 failed |
| `PYTHONDONTWRITEBYTECODE=1 python3 -I rs/_tests/core/modules_core_py.py` | 9 passed, 0 failed |

Stubs for modules outside this slice (cross-room-aggregator, direction-convention, lazygraph-ops, navigation, room-db, node-insert, folder-memory, brain-client) live only inside the test file, never in shipped code.
Every changed `.cjs` passes `node --check`; every `.py` passes `ast.parse`. No U+2014 or emoji in `lib/core`.
Test-only change in a shipped file: `rs-mind-map.cjs` exports `safeJsonForScript` under `_test`.

## Improved

### rs-math.cjs and rs_math.py
- Wrong/risky: `abs_diff_topk` did iterative argmax and diverged between JS and Python on NaN; float32 similarity in Python vs float64 in JS.
- Changed: sort-based top-k (ties by row-major i,j; NaN never selected); Python computes in float64; new `quantile`, `percentileThreshold`, `percentileRank` (mid-rank), `zScores` (ddof=0), `absDiffDistribution`, `rankPairsByPercentile`, `minPercentile` option; `lowercaseTokens` option (default off, so legacy output unchanged); lazy requires.
- Risk: none (original outputs reproduced exactly on seeded cases). Verified: crosscheck and regress tests.

### rs-differential-scorer.cjs
- Wrong: LSA leg is binary (n_components=1); the Pinecone bridge is not query-keyed so BERT is about 1.0 for any pair; fixed 0.3 threshold; Windows `python3` default.
- Changed: percentile mode in `scoreMeasured` (`diffMode:'percentile'`, `referenceDiffs`, `percentile` default 0.9, needs >= 20 references else falls back to fixed with a warning); `provenance.threshold_mode`; `bridge_not_query_keyed` guard; pure-JS `computeLexicalCosine` (`lexicalLeg:'tfidf'`); `opts.encodeFn`; `rankByPercentile`; encoder throw degrades to `encoder_unavailable`. Old behaviour is the default.
- Risk: low. Verified: module test (rankByPercentile, lexical cosine = 1 on identical text, MIN_REFERENCE_DIFFS). Percentile fallback path only checked via constant.

### rs-engine.cjs
- Wrong: fixed threshold; CRLF/BOM bodies not parsed; unsorted directory walk (non-deterministic edges); embedding cache never pruned and shared tmp name; degraded encoder still wrote edges.
- Changed: percentile threshold by default (`DEFAULT_PERCENTILE` 0.9, `MIN_PAIRS_FOR_PERCENTILE` 10); explicit finite `threshold` or `thresholdMode:'fixed'` keeps legacy; metadata gains `threshold_mode`, `threshold_percentile`, `lsa_params`, `threshold_warning`, `degraded`; try/catch around stamp, edge write, embed and LSA build; degraded encoder skips edges unless `writeEdgesWhenDegraded:true`.
- Risk: needs-check. Default mode is now percentile and degraded runs write no edges. Verified: syntax and load only (needs real lazygraph/node-insert to run end to end).

### rs-egress-prompts.cjs
- Wrong: g/y-flag patterns kept `lastIndex` so repeated scans could miss; Map/Set/BigInt crashed or hid content in `auditQueryObject`; trivial evasion (zero-width, percent-encoding, NFKC forms).
- Changed: `findForbidden` (stateless, variants), exported; replacer for Map/Set/BigInt; `meta.sample_sha256` always, `MINDRIAN_EGRESS_REDACT_SAMPLE=1` redacts the sample.
- Risk: low (stricter). Verified: module tests (4).

### rs-egress-telemetry.cjs
- Wrong: unlocked read-modify-write lost updates; ledger grew without bound; NaN accepted.
- Changed: lock file, 7-day retention (`RETENTION_MS`), `MINDRIAN_TELEMETRY_DIR`, finite checks, tmp cleanup, mode 0o600. Note: the query hash is a short unsalted prefix, so "non-reversible" is weak for short queries (comment only).
- Risk: low. Verified: env dir and `RETENTION_MS` export only; concurrency not exercised.

### rs-neo4j-writer.cjs
- Injection review: the write path was already parameterised; the only string-built Cypher was the rollback.
- Wrong: rollback emitted invalid `DETACH DELETE (d:...)`; UNWIND chain dropped later stages on empty lists; `d.room_id`/`d.domain` never SET; ORCID empty-string vs missing mismatch; unbounded context lists.
- Changed: `sanitizePapers`/`sanitizeExperts` whitelist and cap (`MAX_CONTEXT_ITEMS` 500); `CALL {}` subqueries; valid `MATCH ... DETACH DELETE` with id regex `^[a-z]+-[0-9a-f]{16}$`; error `meta.kind` (`query_error`/`connection`) and `meta.code`.
- Risk: needs-check. Cypher text changed (string-grep tests may break). Verified: rollback validation and sanitizer by test. Cypher syntax NOT verified (no Neo4j).

### rs-sqlite-mirror.cjs
- Wrong: non-atomic multi-statement writes; AUTHORED_BY edges to nodes not in the write; unvalidated ids in rollback SQL.
- Changed: `BEGIN IMMEDIATE`/`COMMIT` with retry-without-transaction if the connection reports a nested transaction; edges only for present nodes; id validation.
- Risk: low. Flagged, not changed: Institution and Paper ids share the `nodes.id` space. Verified: syntax/load only (no sqlite backend).

### rs-mind-map.cjs
- Wrong: stored XSS (inlined JSON in `<script>` unescaped); dangling edges; double-prepare `.apply`; random fallback ids.
- Changed: `safeJsonForScript` escapes `<`, `>`, `&`, U+2028/9; dangling edges filtered from payload; spread `.all(...)`; `min_lsa`/`min_bert` overrides; deterministic FNV ids.
- Risk: low. Verified: escape test (round-trips through JSON.parse). NOT verified: rendering in a browser; no SRI/CSP added (cannot compute a hash offline). Aura `total_edges` stays 0.

### rs-corpus-quality-gate.cjs
- Changed: new `assessPairSetQuality(pairs)` returning `{degenerate, ok, flags, stats}` (empty set, seed018 corner collapse, non-finite scores, constant signed_diff/semantic/lsa, too few pairs). `isDegeneratePairSet` untouched.
- Risk: none. Verified: module test (empty and constant sets).

### rs_hybrid.py
- Wrong: CRLF/BOM frontmatter missed; unsorted `os.walk`; no size guard; no provenance on external docs.
- Changed: frontmatter fix, sorted walk, `MAX_ARTIFACT_BYTES` 5,000,000 and `MAX_BODY_CHARS` 200,000, `utf-8-sig`, `retrieved_at`/`source_trail`, metadata `schema_version` 2 and `computed_by`; new `bm25_scores`, `hybrid_rank` (rrf or zscore, deterministic ties), `split_claims`, `claim_level_similarity`; `filter_cross_corpus_pairs(min_percentile, reference_diffs)`.
- Risk: low. Verified: bm25, hybrid_rank determinism for both fusions, split_claims.

### rs_corpus.py
- Wrong: arXiv over http; multi-word arXiv query was a single phrase; no retry; `authorships` None crash; `invert_abstract` accepted negative positions.
- Changed: https, `all:a+AND+all:b` form, bounded retry (`MAX_RETRIES` 2, `MAX_PAGES` 200), `retrieved_at`, `semantic_gate_percentile`, optional `OPENALEX_API_KEY` env var.
- Risk: low. Verified: `_arxiv_query`, `invert_abstract`. NOT verified: network behaviour, API key effect.

### rs_cache.py
- Wrong: namespace slug joined into a path unchecked (traversal via `external:../../x`); `int(year)` aborted the upsert on "2020-01"; shared `.tmp` name; NaN vectors written as invalid JSON; duplicate ids.
- Changed: slug regex guard (reads return None/[] , upsert raises ValueError on an unusable topic); `_safe_year`; pid-unique tmp with cleanup; non-finite embed rejected; dedupe by `external_id`; manifest `vectors_bytes` checked in `get_namespace_freshness` (older manifests without it still work).
- Risk: low. Verified: traversal refusal on both read paths, `_safe_year`.

### rs-preprocessor.cjs
- Wrong: stateful regex; multi-word concepts never matched; divide-by-zero in `computeRelevance`.
- Changed: `_hit` helper, padded token-run matching, guard. Risk: low. Verified: load only.

### rs-brain-substrate.cjs
- Wrong: stateful regex in `preSendAudit`; future-dated cache read as fresh; cache content not integrity-checked.
- Changed: lastIndex reset; future `pulled_at` more than 1 day ahead is stale; `content_hash` verified when it has the `sha256:` form; reason `brain_boundary_violation`.
- Risk: needs-check (stricter cache reads). Verified: syntax only.

### rs-breakthrough-scorer.cjs
- Wrong: `tier in OBJ` hit inherited keys (`constructor`, `toString`), score became NaN.
- Changed: own-property check; opt-in `opts.diff_percentile` mapping (>=0.99 gives 2.0, >=0.95 gives 1.5, >=0.90 gives 1.0), extra keys only in that mode. Risk: none by default. Verified: four tier values incl. `constructor` and `__proto__` give finite scores.

### rs-pinecone-bridge.cjs
- Changed: Windows python bin, `cosineSimilarity` rejects non-finite and clamps to [-1,1], success envelope adds `query_keyed:false`. Risk: low (new key). Verified: syntax.

## Minor

- `research-planner/perspectives/rs-recall.cjs`: CRLF-safe `## Inputs` regex; total three-way comparator in pair sort (was non-total). Verified: syntax.
- `rs-commercial-assessor.cjs`: own-property classification lookup (same prototype-key bug). Verified: load.
- `rs-innovation-classifier.cjs`: finite checks on lsa/bert; `opts.lsa_high`/`opts.bert_high` overrides. Verified: syntax.
- `rs-domain-analyzer.cjs`: shared `ExternalEgressViolation` (local fallback), stateless regex helper, finite-score guard. Verified: syntax.
- `rs-query-matrix.cjs`: shared violation class, stateless regex helper. Verified: syntax.
- `rs-nl-to-query.cjs`: `NL_MAX_LENGTH` 2000 truncation; `experts_on_topic` template rewritten to match the written schema (it could never match before). Needs-check: `reverse_salients_in_room` and `discovery_history` still use `room_slug`/`rs_discoveries`, which no writer produces; left unchanged.
- `rs_rooms.py`: CRLF/BOM-safe `_extract_body`, sorted dirs, `utf-8-sig`. Verified: test.

## Unchanged (reviewed, no defect worth the risk)

`rs-egress-violations.cjs`, `rs-canon-violations.cjs`, `rs-backend-dispatch.cjs`, `rs-brain-substrate-prompts.cjs`, `reverse-salient-persona-suffix.cjs`, `rs-chain-feeder.cjs`, `rs-query-to-text.cjs`, `rs_corpus_exclude.py`.

## Could not verify

Neo4j Cypher syntax (no server); mind-map HTML in a browser; sklearn LSA degeneracy (derived from the code, sklearn absent); OpenAlex key behaviour and all fetcher network paths; `navigation.writeEdge` inside an outer transaction (module absent); the original repo's own test suites; rs-engine end to end; telemetry concurrency; sqlite mirror against a real database.
