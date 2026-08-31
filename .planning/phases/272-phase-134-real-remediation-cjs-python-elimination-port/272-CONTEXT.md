# Phase 272: Phase 134 Real Remediation -- CJS Python Elimination Port - Context

**Gathered:** 2026-08-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the Python analyzer scripts (`scripts/rs-engine.py`, `compute-hsi.py`,
`lib/core/rs_math.py`/`rs_corpus.py`/`rs_hybrid.py`/`rs_cache.py`, and 7 sibling
whitespace `.py` scripts) with in-process CJS modules, eliminating the Python/PyTorch
(~2GB) runtime requirement for `/mos:find-bottlenecks`, `/mos:act`, and `/mos:mos-reason`
on end-user machines. This is Change 2 (the real structural fix) from
`.planning/debug/phase-134-python-elimination-false-complete.md` -- the actual object of
Phase 134, which tracking falsely marked complete. Change 3 (doctor auto-stub visibility)
is nominally in this phase's scope per ROADMAP.md but was not part of tonight's discussion.

</domain>

<decisions>
## Implementation Decisions

### Architecture -- do not unify embedding spaces
- **D-01:** Preserve the existing separate-space architecture, do not attempt to unify
  onto one encoder. Local (room-side): replace the Python `all-MiniLM-L6-v2` encoder with
  the already-shipped `lib/core/eureka/embedding-spine.cjs` ONNX pattern
  (`MongoDB/mdbr-leaf-ir`, q8, 384-dim -- already working, already cached). External
  (Brain/Pinecone-side): port the Pinecone hosted-inference API call itself to a small
  CJS `fetch` module (~40 lines), not a local model.
- **D-02:** This phase does NOT load `Xenova/multilingual-e5-large` locally. Phase 134's
  original design doc assumed a local 1024-dim e5 path existed in the Python code to
  port -- verified false, it is a `NotImplementedError` stub that was never built. There
  is no cross-engine cosine comparison today and none needs creating. Avoiding a local
  e5-large load also sidesteps an unresolved, unrelated repo finding that e5-large's
  ONNX weights may not load in transformers.js v4 (another effort already abandoned that
  model for this reason) and avoids the fp32 2.24GB size regression (larger than the
  Python runtime this phase removes).
- **D-03:** Validation gate is rank-agreement + no `signed_diff` sign flips against a
  fixture-room Python baseline -- NOT a cosine-similarity byte-compat threshold. A
  near-zero differential can flip the `structural_transfer` vs `semantic_implementation`
  classification (`lib/core/rs_math.py:252`) under drift a 0.99-cosine gate would pass
  cleanly. Reuse the confidence-margin gate pattern already shipped in
  `lib/core/eureka/embedding-classifier.cjs:207`, and reuse Phase 127.1's existing
  20-query / >=80% top-5 overlap validation harness rather than inventing a new one
  (exact file not yet located -- researcher should find it).

### Rollout
- **D-04:** Side-by-side behind an env flag. CJS becomes the default path; Python is
  retained as a fallback, not deleted in this phase. Full Python deletion is explicitly
  deferred to a separate, later phase. Rationale: an env flag is the only real rollback
  mechanism for a marketplace-distributed plugin -- a fix is not live until released and
  picked up, and a running session never hot-reloads, so reverting a hard cutover means
  cutting an entirely new release.
- **D-05:** Change 1 (the Python auto-install remediation shipped earlier tonight) stays
  wired as the fallback path's safety net through the transition window. Its own RCA
  notes it was never verified against a real clean-machine network pip install, so treat
  it as an unproven-in-the-wild backup, not a substitute for keeping Python available.

### First-run model download
- **D-06:** Lazy download on first real use of an affected command, with a genuine
  byte-level progress line (not a spinner -- real `{progress, loaded, total}` events do
  fire in Node via `FileCache.put`). Extend the existing D14 cache-miss notice pattern
  and use `ModelRegistry.is_pipeline_cached` (local-only, no network) to probe cache
  state, replacing the current `fs.existsSync` heuristic in `embedding-spine.cjs:230`.
- **D-07:** Fix the model-cache location bug this research surfaced: the default cache
  dir currently lives inside the versioned plugin install directory
  (`~/.claude/plugins/cache/mindrian-marketplace/mos/<version>/`), which
  `lib/core/cache-prune.cjs` deletes on every version update -- meaning without a fix,
  this becomes a re-download-on-every-update bug, not a true one-time first-run cost.
  Default `MINDRIAN_MODEL_CACHE` to a stable path outside the versioned directory (e.g.
  `~/.mindrian/model-cache`); it is currently opt-in only (`docs/ENV-TUNING.md:64`).
- **D-08:** A prefetch option (`/mos:setup` or `doctor --fix` warming the cache ahead of
  time) may be added as an ADDITIVE opt-in on top of D-06, never as a replacement for it
  -- CLI-only prefetch hooks don't cover Desktop/Cowork installs, so the lazy-download
  path must always exist regardless.

### Rule amendment -- locked, in-scope for THIS phase
- **D-09 (RESOLVED):** `lib/agents/reverse-salient-agent.cjs:19`'s rule 6 --
  "NEVER reimplement rs-math in Node -- shell out to scripts/rs-engine.py" -- is amended,
  not overridden. New wording, to land as part of this phase's implementation (see below
  for why it can't be deferred):

  > "Shell out to whichever backend the active flag selects (`rs-engine.py` or
  > `rs-engine.cjs`) -- never inline rs-math logic directly in this agent."

  This preserves the rule's actual spirit (the agent stays a thin orchestrator, it does
  not duplicate math logic inline) while accommodating D-04's env-flag default. It does
  NOT relax rules 1-5 in the same block (navigation.cjs-only reads, typed cascade-edge
  writes, LOCAL-only Brain reads via folder-memory, no direct DB imports, no Brain
  client imports) -- those are unaffected and still hold.

  **Locked to Phase 272 itself, not a follow-up phase.** `reverse-salient-agent.cjs` is
  one of the actual callers of the engine this phase replaces. If rule 6 isn't updated
  inside this same phase, the agent keeps hard-shelling to `rs-engine.py` regardless of
  the D-04 env flag -- Phase 272 would ship a working CJS backend this call site can
  never reach, reproducing Phase 134's own "built but not wired to a real caller"
  failure inside its own remediation. This is not separable work: whichever code
  implements D-04's env-flag dispatch (which backend to call) IS this rule's update --
  same task, not an add-on. Update the rule-6 comment text in the same commit that
  implements the dispatch.

### Scope fence -- Mode B/C external Pinecone corpus
- **D-10 (navigator ruling, 2026-08-31, post-research):** Mode B/C (the external Pinecone
  corpus path in `lib/core/rs_cache.py`) is DESCOPED to a follow-up phase, per
  272-RESEARCH.md's Open Question 1 and its own recommendation. Confirmed: D-01's
  "~40 lines" port estimate covers only the `/embed` inference call
  (`rs-engine.py:1098-1130`, Mode A internal); Mode B/C's real surface is Pinecone
  control-plane plus data-plane SDK (`create_index_for_model`, `has_index`,
  `describe_index`, `upsert_records`, paged `list()`, `query` -- `lib/core/rs_cache.py:130-461`),
  an order of magnitude larger and out of proportion to this phase's stated goal.
  Mode B/C also requires a `PINECONE_API_KEY` most end users do not have, so porting it
  does not unblock the users this phase exists for -- it stays on the Python fallback
  path D-04's env flag already provides, with zero new code. This phase's scope is Mode A
  internal (local, `embedding-spine.cjs` ONNX pattern) plus `compute-hsi.py` Tier 1 only.
  Full Mode B/C port is registered as follow-up scope, not lost -- the planner should not
  attempt it and should not shrink D-01's language to imply it already covers Mode B/C.

### Rank-agreement gate redesign (D-03 amendment)
- **D-11 (navigator ruling, 2026-08-31, post-272-08 root-cause finding):** 272-08 found,
  via a rigorous controlled experiment (full trail in `272-08-SUMMARY.md`'s "Known Issue"
  section), that D-03's original operationalization of "rank-agreement" -- exact top-50
  pair-ID SET overlap -- measures the wrong axis of variance. Even Python's own
  `TruncatedSVD(algorithm="arpack")` compared against itself ACROSS independent process
  invocations (not within one, which is what 272-02's `NOISE-FLOOR.md` actually measured)
  only reaches 0.42-0.50 top-K overlap on this fixture room's densely-tied score
  distribution -- nowhere near the inherited 0.95 gate. The underlying NUMBERS agree
  almost exactly either way (avg delta ~0.0016-0.0018 across both the CJS-vs-Python and
  Python-vs-Python-cross-process comparisons); it is specifically the "identical top-50
  ID set" check that is too brittle for how closely many pairs compete near the top of
  this fixture's ranking.
  **Ruling: replace the top-K set-overlap metric with a delta/correlation-based metric**
  (Spearman rank-correlation over the full ranking, and/or a direct avg/max delta bound
  on the `abs_diff` scores between matched pairs) as the PRIMARY `PYPORT-05` gate. This is
  consistent with D-03's own original language ("rank-agreement... NOT a cosine-similarity
  byte-compat threshold") -- D-03 never mandated exact set membership, 272-02 chose that
  operationalization and it turned out to be the wrong one for this data's tie density.
  Top-K set overlap MAY be retained as a secondary/informational signal (not a hard gate)
  if useful for debugging, but it does not gate phase completion.
  **Scope:** fix `tests/272-rank-agreement.test.cjs` and `tests/fixtures/272/NOISE-FLOOR.md`
  / `noise-floor.json` to reflect the new metric and a threshold justified against it,
  reusing the ALREADY-CAPTURED `baseline-python.fixture.json` and `candidate-cjs.fixture.json`
  data (272-02's and 272-08's real runs) -- no need to regenerate either fixture, only the
  comparison method changes. Do not weaken the metric to force a specific number; derive
  the threshold from what the actual measured deltas support (272-08 already measured
  avg ~0.0016-0.0018, max ~0.02 -- use these as the empirical grounding). This directly
  affects `PYPORT-05`'s pass/fail state and therefore 272-09/272-10/272-11's phase-gate
  regression checks -- land this before Wave 5 wires real callers to rs-engine.cjs.

### Claude's Discretion
- Exact file/module layout for the new `lib/core/rs-engine.cjs`, `rs-math.cjs`,
  `hsi-*.cjs`, and the new Pinecone-inference proxy module -- not dictated beyond the
  architecture in D-01.
- Where exactly the env flag lives (config key name, default value) -- follow existing
  repo conventions for feature flags.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Root cause and prior (incorrect) design
- `.planning/debug/phase-134-python-elimination-false-complete.md` -- the RCA proving
  Phase 134 was tracked complete but never built; full evidence trail.
- `.planning/phases/134-cjs-port-of-python-analyzers-via-xenova-transformers-elimina/134-CONTEXT.md`
  -- original design vision. Treat its model-choice assumption (local e5-large exists to
  port) as VERIFIED FALSE by tonight's research -- do not re-adopt it without re-checking.
- `.planning/research/2026-05-24-cjs-port-feasibility-spike.md` -- original AMBER-verdict
  spike; the byte-compat risk it raised is superseded by D-01/D-02/D-03 above, not
  resolved on its own terms.
- `SEED-013` (`.planning/seeds/SEED-013-eliminate-python-from-user-machine-cjs-port.md`)
  -- source seed; its own frontmatter still needs a second correction pass (carried
  forward from the RCA, not part of this phase's discussed scope).

### Code to reuse (do not reinvent)
- `lib/core/eureka/embedding-spine.cjs` -- the shipped, working in-process ONNX embedder
  (`MongoDB/mdbr-leaf-ir`, q8, 384-dim). `getEncoder` is the function to extend/reuse for
  the new local encoder.
- `lib/core/eureka/embedding-classifier.cjs:207` -- confidence-margin escalation pattern;
  reuse for the D-03 validation gate.
- Phase 127.1's 20-query / >=80% top-5 overlap validation harness -- reuse for accuracy
  validation; researcher must locate the exact file (not pinned down in this discussion).

### Code that must change
- `scripts/rs-engine.py:1101-1120` -- where Pinecone hosted inference is actually called
  today; this is what gets ported to the new CJS fetch module, not a local model.
- `scripts/rs-engine.py:267-280`, `scripts/compute-hsi.py:353-358` -- the real local
  Python encoder (`all-MiniLM-L6-v2`, 384-dim) being replaced.
- `scripts/rs-engine.py:283-299` -- the `NotImplementedError` stub for local 1024-dim e5;
  confirms Phase 134's original design target never existed in Python.
- `lib/core/rs_math.py:252` -- `signed_diff` sign-flip classification logic; determines
  why the validation gate must be rank-based, not cosine-based.

### Standing constraint that must be reconciled
- `lib/agents/reverse-salient-agent.cjs:19` -- "NEVER reimplement rs-math in Node."
  See D-09. Read this before writing a single line of the port.
- `scripts/rs-engine.py:1455-1465` -- in-code comment documenting the
  "never mix 1024-dim external with 384-dim local" invariant this phase preserves (D-01).

### Infrastructure constraints (download/cache)
- `lib/core/cache-prune.cjs` -- deletes non-active plugin version directories; root
  cause of the D-07 cache-location bug.
- `docs/ENV-TUNING.md:64` -- current (opt-in only) `MINDRIAN_MODEL_CACHE` documentation.
- `tests/eureka-offline-preload.cjs:17-22` -- documents that `HF_HUB_OFFLINE` /
  `TRANSFORMERS_OFFLINE` are ignored by transformers.js v4; use `env.allowRemoteModels =
  false` instead.
- `node_modules/@huggingface/transformers/src/utils/dtypes.js:51-56` + `devices.js` --
  default dtype is fp32 on Node (q8 only applies on wasm); quantization must be
  explicitly requested, not assumed.
- `node_modules/@huggingface/transformers/src/env.js:162` -- `DEFAULT_CACHE_DIR`, the
  actual site of the D-07 bug.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/core/eureka/embedding-spine.cjs`: the exact in-process ONNX embedder pattern this
  phase needs for its local encoder -- clone/extend `getEncoder`, do not build a new one.
- `lib/core/eureka/embedding-classifier.cjs`: confidence-margin gate logic, reusable for
  the D-03 validation approach.
- The already-shipped Change 1 (`ensure_ml_deps.py` auto-installer wiring): reusable as
  the fallback path's safety net per D-05, not something to remove.

### Established Patterns
- Separate-embedding-space invariant: already enforced in the existing Python code
  (`rs-engine.py:1455-1465`) and must be preserved, not "fixed," by the port.
- `@huggingface/transformers` is already a pinned project dependency (`^4.2.0` in
  `package.json`) -- no new dependency to add for the encoder work.

### Integration Points
- New `lib/core/rs-engine.cjs` / `rs-math.cjs` / `hsi-*.cjs` consume
  `embedding-spine.cjs`'s encoder rather than instantiating their own.
- New Pinecone-inference proxy module (CJS `fetch`, ~40 lines per research) sits
  alongside these, handling the external/Brain-side calls that used to go through
  Python's Pinecone SDK usage.

</code_context>

<specifics>
## Specific Ideas

No specific UI/UX "make it look like X" requests -- this was a backend architecture and
risk-tolerance discussion. All specifics are captured as decisions above.

</specifics>

<deferred>
## Deferred Ideas

- **Full Python deletion** -- explicitly deferred past this phase per D-04; scope for a
  separate, later phase once the CJS path has run in production behind the env flag.
- **Unifying onto one local e5-large encoder** -- deferred unless/until offline-capable
  external-corpus search becomes an explicit hard product requirement (the
  not-recommended option from the accuracy-risk discussion).
- **Change 3** (doctor `--drift --fix` I001 auto-stub visibility fix) and **SEED-013's
  second frontmatter correction pass** -- both named as this phase's secondary scope in
  ROADMAP.md, carried forward from the RCA, but not discussed in this session. Planner
  should confirm with the navigator whether they're in-scope for 272's first plan wave or
  a follow-up.
- **`sqlite-vec` native-binary policy question** -- surfaced by tangent while researching
  this phase, but belongs to a different subsystem (vector search / `room.db`), not this
  phase's Python-analyzer scope. Confirmed directly: `node_modules/sqlite-vec-linux-arm64/vec0.so`
  is a real precompiled native binary, shipped via a per-platform npm package -- already
  present in this repo's dependency tree, already in tension with the same "pure JS, no
  native binaries" invariant this phase (and the whole Python-elimination effort) exists
  to uphold. This is a policy call for whoever owns that invariant, not a Phase 272
  decision. Interim safe default until answered: plain-JS cosine similarity over
  BLOB-stored float vectors, not `sqlite-vec`'s extension.
- **LangTalks grounding filed** -- `.planning/research/2026-08-27-langtalks-grounding-for-phase-272-and-273.md`.
  Per navigator directive, `langtalks-graph-expert` consultation on graph/memory/context-
  management topics is now standing practice for dev work, not a one-off. Most relevant
  finding for Phase 273 (not 272 directly): the navigator's own 2026-07-25 research note
  already diagnosed the same "chokepoint reports success while data silently doesn't move"
  failure class Phase 273's C1 finding rediscovered, at the opposite end of the pipeline
  (read-time collapse vs. write-time collapse), backed by the SAG paper (arXiv 2606.15971v1).
- **Recursive-CTE graph traversal pattern** -- verified real (not a Phase 272 need, but
  worth filing so it isn't lost): `sqlite-graph`'s `src/storage/sqlite.rs:431-452` has a
  clean, portable bidirectional/depth-limited/`valid_until IS NULL`-filtered
  `WITH RECURSIVE` query, plain SQL, works in `node:sqlite` today, zero library or binary
  needed. Directly relevant to how `navigation.cjs` could do multi-hop traversal, which
  is outside this phase's scope (embedding port, not graph traversal). Worth its own seed
  or a direct note to whoever owns `navigation.cjs`.

</deferred>

---

*Phase: 272-phase-134-real-remediation-cjs-python-elimination-port*
*Context gathered: 2026-08-27*
