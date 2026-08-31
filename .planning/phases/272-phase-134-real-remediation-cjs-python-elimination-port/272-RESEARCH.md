# Phase 272: Phase 134 Real Remediation -- CJS Python Elimination Port - Research

**Researched:** 2026-08-31
**Domain:** Python-to-CJS numerical/ML port (TF-IDF + truncated SVD, Markov spectral analysis, ONNX sentence embeddings, Pinecone hosted inference)
**Confidence:** MEDIUM-HIGH (code claims HIGH, verified by direct read + live execution; two locked-decision premises corrected by measurement)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Architecture -- do not unify embedding spaces**

- **D-01:** Preserve the existing separate-space architecture, do not attempt to unify onto one encoder. Local (room-side): replace the Python `all-MiniLM-L6-v2` encoder with the already-shipped `lib/core/eureka/embedding-spine.cjs` ONNX pattern (`MongoDB/mdbr-leaf-ir`, q8, 384-dim -- already working, already cached). External (Brain/Pinecone-side): port the Pinecone hosted-inference API call itself to a small CJS `fetch` module (~40 lines), not a local model.
- **D-02:** This phase does NOT load `Xenova/multilingual-e5-large` locally. Phase 134's original design doc assumed a local 1024-dim e5 path existed in the Python code to port -- verified false, it is a `NotImplementedError` stub that was never built. There is no cross-engine cosine comparison today and none needs creating. Avoiding a local e5-large load also sidesteps an unresolved, unrelated repo finding that e5-large's ONNX weights may not load in transformers.js v4 (another effort already abandoned that model for this reason) and avoids the fp32 2.24GB size regression (larger than the Python runtime this phase removes).
- **D-03:** Validation gate is rank-agreement + no `signed_diff` sign flips against a fixture-room Python baseline -- NOT a cosine-similarity byte-compat threshold. A near-zero differential can flip the `structural_transfer` vs `semantic_implementation` classification (`lib/core/rs_math.py:252`) under drift a 0.99-cosine gate would pass cleanly. Reuse the confidence-margin gate pattern already shipped in `lib/core/eureka/embedding-classifier.cjs:207`, and reuse Phase 127.1's existing 20-query / >=80% top-5 overlap validation harness rather than inventing a new one (exact file not yet located -- researcher should find it).

**Rollout**

- **D-04:** Side-by-side behind an env flag. CJS becomes the default path; Python is retained as a fallback, not deleted in this phase. Full Python deletion is explicitly deferred to a separate, later phase. Rationale: an env flag is the only real rollback mechanism for a marketplace-distributed plugin -- a fix is not live until released and picked up, and a running session never hot-reloads, so reverting a hard cutover means cutting an entirely new release.
- **D-05:** Change 1 (the Python auto-install remediation shipped earlier tonight) stays wired as the fallback path's safety net through the transition window. Its own RCA notes it was never verified against a real clean-machine network pip install, so treat it as an unproven-in-the-wild backup, not a substitute for keeping Python available.

**First-run model download**

- **D-06:** Lazy download on first real use of an affected command, with a genuine byte-level progress line (not a spinner -- real `{progress, loaded, total}` events do fire in Node via `FileCache.put`). Extend the existing D14 cache-miss notice pattern and use `ModelRegistry.is_pipeline_cached` (local-only, no network) to probe cache state, replacing the current `fs.existsSync` heuristic in `embedding-spine.cjs:230`.
- **D-07:** Fix the model-cache location bug this research surfaced: the default cache dir currently lives inside the versioned plugin install directory (`~/.claude/plugins/cache/mindrian-marketplace/mos/<version>/`), which `lib/core/cache-prune.cjs` deletes on every version update -- meaning without a fix, this becomes a re-download-on-every-update bug, not a true one-time first-run cost. Default `MINDRIAN_MODEL_CACHE` to a stable path outside the versioned directory (e.g. `~/.mindrian/model-cache`); it is currently opt-in only (`docs/ENV-TUNING.md:64`).
- **D-08:** A prefetch option (`/mos:setup` or `doctor --fix` warming the cache ahead of time) may be added as an ADDITIVE opt-in on top of D-06, never as a replacement for it -- CLI-only prefetch hooks don't cover Desktop/Cowork installs, so the lazy-download path must always exist regardless.

**Rule amendment -- locked, in-scope for THIS phase**

- **D-09 (RESOLVED):** `lib/agents/reverse-salient-agent.cjs:19`'s rule 6 -- "NEVER reimplement rs-math in Node -- shell out to scripts/rs-engine.py" -- is amended, not overridden. New wording, to land as part of this phase's implementation:

  > "Shell out to whichever backend the active flag selects (`rs-engine.py` or `rs-engine.cjs`) -- never inline rs-math logic directly in this agent."

  This preserves the rule's actual spirit (the agent stays a thin orchestrator, it does not duplicate math logic inline) while accommodating D-04's env-flag default. It does NOT relax rules 1-5 in the same block (navigation.cjs-only reads, typed cascade-edge writes, LOCAL-only Brain reads via folder-memory, no direct DB imports, no Brain client imports) -- those are unaffected and still hold.

  **Locked to Phase 272 itself, not a follow-up phase.** `reverse-salient-agent.cjs` is one of the actual callers of the engine this phase replaces. If rule 6 isn't updated inside this same phase, the agent keeps hard-shelling to `rs-engine.py` regardless of the D-04 env flag -- Phase 272 would ship a working CJS backend this call site can never reach, reproducing Phase 134's own "built but not wired to a real caller" failure inside its own remediation. This is not separable work: whichever code implements D-04's env-flag dispatch (which backend to call) IS this rule's update -- same task, not an add-on. Update the rule-6 comment text in the same commit that implements the dispatch.

### Claude's Discretion

- Exact file/module layout for the new `lib/core/rs-engine.cjs`, `rs-math.cjs`, `hsi-*.cjs`, and the new Pinecone-inference proxy module -- not dictated beyond the architecture in D-01.
- Where exactly the env flag lives (config key name, default value) -- follow existing repo conventions for feature flags.

### Deferred Ideas (OUT OF SCOPE)

- **Full Python deletion** -- explicitly deferred past this phase per D-04.
- **Unifying onto one local e5-large encoder** -- deferred unless/until offline-capable external-corpus search becomes an explicit hard product requirement.
- **Change 3** (doctor `--drift --fix` I001 auto-stub visibility fix) and **SEED-013's second frontmatter correction pass** -- named as secondary scope in ROADMAP.md but not discussed. Planner should confirm with the navigator whether they're in-scope for 272's first plan wave or a follow-up.
- **`sqlite-vec` native-binary policy question** -- belongs to a different subsystem. Interim safe default: plain-JS cosine similarity over BLOB-stored float vectors.
- **LangTalks grounding filed** -- `.planning/research/2026-08-27-langtalks-grounding-for-phase-272-and-273.md`.
- **Recursive-CTE graph traversal pattern** -- verified real, outside this phase's scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

No requirement IDs were pre-registered for Phase 272. **Suggested prefix: `PYPORT`** (mnemonic for "Python port"; sits alongside Phase 273's `CHOKE-01..06` convention, and avoids collision with the existing `RECON`, `ENRICH`, `CONTRACT`, `SWEEP` families in `.planning/REQUIREMENTS.md`).

Proposed minting, derived from what this research found is actually required:

| Suggested ID | Description | Research Support |
|----|-------------|------------------|
| PYPORT-01 | Port `lib/core/rs_math.py` to `lib/core/rs-math.cjs` (TF-IDF, deterministic truncated SVD, topic-keyword membership, L1 similarity, abs-diff top-k, direction classification) | Finding F-1, F-2, F-3; Pitfall 1, 2, 3 |
| PYPORT-02 | Port `scripts/rs-engine.py` Mode A (internal) to `lib/core/rs-engine.cjs`, consuming `embedding-spine.cjs` for the local encoder | D-01; Finding F-4, F-5 |
| PYPORT-03 | Port `scripts/compute-hsi.py` (LSA-via-cosine-on-SVD, OMHMM mode classification, Markov spectral profile, HSI matrix) to `lib/core/hsi-*.cjs` | Finding F-6, F-7; Pitfall 4 |
| PYPORT-04 | Implement the D-04 env-flag backend dispatch across ALL real spawn sites, and amend rule 6 in the same commit | D-04, D-09; Finding F-8 (the caller surface is wider than CONTEXT.md states) |
| PYPORT-05 | Build the rank-agreement + sign-flip validation harness and the fixture-room Python baseline | D-03; Finding F-9; Validation Architecture |
| PYPORT-06 | Fix the model-cache location (D-07) and the first-run download notice (D-06, mechanism corrected) | D-06, D-07; Finding F-10, F-11 |
| PYPORT-07 | Port the Pinecone hosted-inference `/embed` call to a CJS fetch module | D-01; Finding F-12 (scope correction) |

</phase_requirements>

---

## Summary

This phase is a port of roughly 4,900 lines of Python across seven modules, but the engineering risk is not in the line count. It is concentrated in three places, and two of them are premises inside the locked decisions that measurement in this session showed to be wrong or incomplete.

**First, the numerical core is not a straightforward translation.** `lib/core/rs_math.py` runs TF-IDF then `TruncatedSVD(algorithm="randomized", n_iter=10, random_state=256)`, extracts the top-7 terms per component, and counts topic-keyword membership. That top-7 extraction is a **discrete** step: it sorts component weights descending and slices. I measured, live in this session, that sklearn's randomized SVD at `n_iter=10` has **not converged** for this problem shape -- changing only the random seed changes the extracted topic keywords substantially (mean top-7 overlap 0.55 on a flat-spectrum corpus, 0.84 on a real structured corpus of 250 repo documents), and only 16 of 80 components match the true (ARPACK) answer. Downstream, that propagated to a **top-50 pair overlap of 0.32**. A CJS port that computes a mathematically correct SVD will therefore *fail* a naive 80% rank-agreement gate against the current Python baseline -- not because the port is wrong, but because the baseline is partly seed noise. The prescription is to use a deterministic, converged SVD in CJS and to regenerate the Python baseline with `algorithm="arpack"` (fully deterministic, verified) purely for baseline capture, leaving shipped Python behavior untouched behind the D-04 fallback flag.

**Second, the repo does not agree with itself about what a `signed_diff` sign means.** D-03's gate is literally "no `signed_diff` sign flips." But there are two mutually inverted conventions live in the code today: `rs_math.py:252` and `ALGORITHM-SOURCE.md` (the authoritative Kwan 2023 source) say `semantic - lsa > 0` is `structural_transfer`, while `compute-hsi.py:749`, `detect-reverse-salients.py:38`, `rs-innovation-classifier.cjs:146`, and `rs-differential-scorer.cjs:561` all say the opposite. The port must preserve each script's own convention bug-for-bug or the gate measures the wrong thing, and the inconsistency should be filed as a separate finding rather than silently "fixed" inside this port.

**Third, two locked-decision premises need correction, not re-litigation.** D-03's "reuse Phase 127.1's existing harness" -- the harness file exists (`tests/127.1-graphrag-overlap.test.cjs`) and is a good structural template, but its **fixtures were never generated**, so it is RED-by-design scaffolding, not a working harness; its corpus is Brain-methodology queries at 1024-dim e5, not room artifacts. D-06's "real byte-level progress events do fire in Node" -- verified only half true: on Node with `return_path` (exactly how ONNX weights load), transformers.js v4.2.0 **skips the buffered read entirely** and emits a single terminal `progress: 100` event. A byte-level progress bar for the large `.onnx` file is not reachable through `progress_callback` as written. Per-file progress ("file 3 of 7") is reachable and is the recommended substitute. Everything else in D-06/D-07 verified true: `ModelRegistry.is_pipeline_cached` exists, is exposed in the CJS build, and returns in 17ms with no network.

**Primary recommendation:** Scope this phase to the LOCAL path only (rs-engine Mode A internal plus compute-hsi Tier 1), implement the SVD with a deterministic converged algorithm, regenerate the Python baseline with ARPACK before capturing fixtures, and wire the D-04 flag at all four real spawn sites plus both copies of rule 6. Leave Mode B/C external (Pinecone corpus) on the Python fallback -- it requires an API key most end users do not have, so it does not serve the user-machine Python-elimination goal, and its real port surface is far larger than D-01's "~40 lines" estimate.

---

## Corrections to CONTEXT.md Premises

These are stated first because the planner must not plan against the uncorrected versions. None of these overturn a locked decision; they correct a factual premise underneath one.

| # | CONTEXT.md says | Verified reality | Impact |
|---|-----------------|------------------|--------|
| C-1 | D-02: "`rs-engine.py:283-299` -- the `NotImplementedError` stub for local 1024-dim e5" | Lines 283-299 are `_embed_via_pinecone_inference`, a stub for the **Pinecone hosted-inference corpus path**, not a local e5 model. The conclusion (no local e5 exists to port) is CORRECT; the citation describes a different function. `[VERIFIED: scripts/rs-engine.py:283-299]` | Cosmetic. D-02 stands. Fix the citation so a future reader does not go looking for a local-model stub. |
| C-2 | D-03: "reuse Phase 127.1's existing 20-query />=80% top-5 overlap validation harness" | `tests/127.1-graphrag-overlap.test.cjs` (236 lines) and `tests/127.1-graphrag-overlap-corpus.json` (20 queries, confirmed) exist. The two fixtures it consumes (`tests/fixtures/127.1/overlap-baseline.fixture.json`, `overlap-neo4j.fixture.json`) **do not exist on disk**; the file is explicitly "RED-by-design until Plan 127.1-03 produces" them, and 127.1-03 never did. It also hard-asserts `EXPECTED_MODEL='multilingual-e5-large'` and `EXPECTED_DIMS=1024`. `[VERIFIED: ls tests/fixtures/127.1/]` | Reuse the harness **shape** (corpus JSON + two fixtures + `setOverlap` + aggregate gate + per-query warn), not the harness itself. Mint a new room-artifact corpus. Do not import its model/dim locks. |
| C-3 | D-06: "real `{progress, loaded, total}` events do fire in Node via `FileCache.put`" | Partly false for the file that matters. `utils/hub.js:352-356`: `if (apis.IS_NODE_ENV && return_path) { /* skip the buffer read */ }`, then `:434-443` emits ONE terminal `{progress:100, loaded:size, total:size}`. ONNX weights load via `return_path`. Small JSON files (config, tokenizer) do stream. `[VERIFIED: node_modules/@huggingface/transformers/src/utils/hub.js]` | A byte-level progress bar for the big `.onnx` file is NOT deliverable via `progress_callback`. Deliver per-file progress plus a stated total size instead, or wrap `env.customFetch`. |
| C-4 | D-01: port the Pinecone call to "a small CJS `fetch` module (~40 lines)" | True for `_embed_topic_via_pinecone` (`rs-engine.py:1098-1130`, the `/embed` inference call). But the external corpus path in `lib/core/rs_cache.py` uses Pinecone **integrated embedding**: `create_index_for_model`, `has_index`, `describe_index`, `upsert_records`, paged `list()`, `query`. That is control-plane plus data-plane SDK surface, not one endpoint. `[VERIFIED: lib/core/rs_cache.py:130-461]` | The ~40-line estimate holds only for `/embed`. Recommend descoping Mode B/C external from this phase (see Open Question 1). |
| C-5 | D-09: rule 6 lives at `lib/agents/reverse-salient-agent.cjs:19` | It also lives at `commands/find-bottlenecks.md:86` ("Never reimplement rs-math in Node; the agent shells out to scripts/rs-engine.py"). `[VERIFIED: grep]` | D-09's amendment must land in BOTH places in the same commit, or the command doc contradicts the code. |
| C-6 | Phase boundary: "and 7 sibling whitespace `.py` scripts" | The user-reachable Python surface is 16 scripts plus 6 `lib/core/rs_*.py` modules. `intelligence-cascade.cjs:446` also spawns `detect-reverse-salients.py`, which is not named in the phase boundary and carries the inverted direction convention. `[VERIFIED: grep + spawn-site audit]` | Scope statement understates the surface. See Finding F-8. |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TF-IDF + truncated SVD + topic keywords | Node CJS compute (`lib/core/rs-math.cjs`) | -- | Pure numeric transform over local room text; no I/O, no network. Belongs in-process so it is testable offline and carries no runtime dependency. |
| Local sentence embedding (384-dim) | Node CJS compute via ONNX (`embedding-spine.cjs`) | Model weight CDN (one-time, model-ID-only fetch) | Already the shipped local encoder. Canon Part 8 clean: model ID crosses the wire, user text never does. |
| Markov spectral profile / OMHMM scoring | Node CJS compute (`lib/core/hsi-spectral.cjs`) | -- | Small dense eigen-decomposition (mode-count square matrix, typically <10x10). No library tier needed. |
| Room artifact discovery + caching | Node CJS filesystem (`lib/core/rs-engine.cjs`) | Room `.rs-engine-cache.json` | Filesystem is the source of truth for room state per repo convention. |
| Backend selection (CJS vs Python) | Node CJS dispatch layer | Env flag / config | D-04. Must be ONE dispatch chokepoint consumed by every caller, mirroring the connector-spine "no second selection brain" rule. |
| External corpus embedding (1024-dim) | Pinecone hosted inference (remote) | Python fallback (`rs_cache.py`) | D-01. Deliberately NOT a local model; the external space stays 1024-dim e5 server-side. |
| Typed cascade edge writes | `lib/core/navigation.cjs` chokepoint | -- | Unchanged by this phase; rules 1-5 of the RSA block still hold (D-09). |

---

## Project Constraints (from CLAUDE.md)

Binding directives extracted from `./CLAUDE.md` that constrain this phase:

| Constraint | Applies how here |
|---|---|
| **No em-dashes anywhere; hyphens only** | All new source headers, comments, docs, and the CHANGELOG entry. There is an existing acceptance grep (`tests/test-127-03-no-em-dashes.sh`). |
| **CJS only, no TypeScript** | `lib/core/*.cjs` ships as source. New modules must be `.cjs`, `require()`-based. Verified `@huggingface/transformers` resolves a real CJS build (`dist/transformers.node.cjs`) so this is satisfiable. |
| **No Commander/yargs; `process.argv` switch-case router** | If `rs-engine.cjs` gets a CLI entry point, follow the `gsd-tools.cjs` pattern. |
| **Canon Part 7 (Reuse Before Build)** | Load-bearing here. Reuse `embedding-spine.cjs` (encoder), `rs-pinecone-bridge.cjs::cosineSimilarity`, `lexical-overlap.cjs` (tokenize/stopwords precedent), the 127.1 harness shape. Any net-new surface needs a written justification, as `rs-differential-scorer.cjs` did for its documented carve-out. |
| **Canon Part 8 (Graph Boundary)** | The local port is fully local; only the model ID egresses. The Pinecone leg must keep the existing dual-layer `auditQueryString` / `auditQueryObject` defense that `rs-pinecone-bridge.cjs` already implements. Do not drop it in a rewrite. |
| **Canon Part 6 (Dog-Fooding)** | This phase exists because the plugin's own tracking lied about its own state. Do not close a plan with a stub SUMMARY. |
| **Canon Part 11 (Invocation Constitution)** | Any new invocable surface is born WIRED or EXCLUDED, with a declared HITL shape. A new `rs-engine.cjs` consumed only by existing agents is a library, not an invocable surface; a new `/mos:setup` prefetch command (D-08) WOULD be invocable and needs the declaration. |
| **Tri-Polar rule** | The lazy-download path must work on Desktop and Cowork, not just CLI. This is exactly why D-08 forbids prefetch-as-replacement. |
| **Verification** | `bash tests/run-all-<phase>.sh`, `node scripts/doctor.cjs --acceptance`, `node scripts/build-connector-registry.cjs --check` before declaring done. |
| **Release lockstep** | Five-gate `scripts/release.sh`; never hand-bump. A fix is not live until released AND picked up. |
| **GSD workflow enforcement** | No direct edits outside a GSD workflow. |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@huggingface/transformers` | `^4.2.0` (installed: `4.2.0`) | ONNX sentence embeddings in-process | Already a pinned project dependency; already the encoder behind `embedding-spine.cjs`. Zero new dependency. `[VERIFIED: package.json + node_modules/@huggingface/transformers/package.json]` |
| `node:sqlite` | built-in (Node >= 22.16.0) | Room graph reads/writes | Existing chokepoint; unchanged by this phase. `[VERIFIED: CLAUDE.md stack table]` |
| Node built-ins (`fs`, `path`, `crypto`, `child_process`) | Node >= 22.16.0 | Everything else | Repo convention: pure CJS, node built-ins only, zero new runtime deps. `[VERIFIED: CLAUDE.md conventions]` |
| `globalThis.fetch` | built-in | Pinecone `/embed` call | Node 22 has stable global fetch. No HTTP client dependency needed. `[VERIFIED: Node 22 baseline]` |

### Supporting (already in-repo, reuse -- do not re-add)

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `lib/core/eureka/embedding-spine.cjs` | `getEncoder` / `embedTexts` / `encoderProvenance` / `resolveDim`; batched at 32 to bound ONNX OOM | The ONLY local encoder. `rs-engine.cjs` and `hsi-*.cjs` consume this, never instantiate their own pipeline. |
| `lib/core/rs-pinecone-bridge.cjs` | `cosineSimilarity(a,b)`, plus the Part 8 audit chain | Reuse the same function object (spine already re-exports it). |
| `lib/core/eureka/lexical-overlap.cjs` | Frozen stopword list + versioned tokenize rules (`jaccard-v1`) | Precedent for how to version a text-normalization metric. The TF-IDF port needs the same discipline. |
| `lib/core/eureka/embedding-classifier.cjs` | Confidence-margin gate (`margin >= threshold` -> `confident`) | D-03's gate pattern. See Code Examples. |
| `scripts/lib/ensure_ml_deps.py` | Python auto-install safety net | D-05: stays wired on the fallback path. Do not remove. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written deterministic SVD | `ml-matrix` / `svd-js` npm package | Adds a dependency to a repo whose convention is zero-new-deps and vendored `node_modules`; also drags a new supply-chain surface into a plugin that ships its dependency tree. A Lanczos/one-sided-Jacobi truncated SVD for an `n_docs x <=2000` sparse matrix is a bounded, self-contained ~150 lines. Recommend hand-written, but this is a real judgment call the planner should make explicitly. |
| ONNX `MongoDB/mdbr-leaf-ir` (384-dim) | `Xenova/all-MiniLM-L6-v2` (384-dim) | MiniLM matches the Python baseline's model exactly, which would make semantic-leg agreement near-perfect. But D-01 locks mdbr-leaf-ir, and `KNOWN_MODEL_DIMS` retains MiniLM as an env rollback. Note the consequence honestly: **the semantic matrix will differ from the Python baseline by model, not just by runtime.** See Pitfall 5. |
| Porting Mode B/C external now | Deferring external to a later phase | Deferring keeps this phase's blast radius on the path that actually blocks users. See Open Question 1. |

**Installation:** No new packages. `@huggingface/transformers@4.2.0` is already installed and vendored.

**Version verification performed:**
```
node -e "require('./node_modules/@huggingface/transformers/package.json').version"  -> 4.2.0
python3: sklearn 1.8.0, numpy 2.2.6 (dev machine only; not shipped)
```

---

## Package Legitimacy Audit

**This phase installs no new external packages.** The audit is therefore a no-op for new additions, and is recorded here for completeness against the one dependency the phase leans on.

Slopcheck was attempted and is **not available** in this environment; no `pip install` of `slopcheck` was performed against the user's Python environment, and MCP registry tools were unavailable to this agent (see Environment Availability). Per the graceful-degradation rule, packages that had been newly recommended would be tagged `[ASSUMED]`. None are.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@huggingface/transformers` | npm | pre-existing project dep, pinned `^4.2.0`, present in `node_modules` and vendored | n/a (not re-resolved) | github.com/huggingface/transformers.js | not run (unavailable) | Approved -- **pre-existing, not introduced by this phase** |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

**Planner note:** if the planner elects the `ml-matrix` / `svd-js` alternative from the Standard Stack table instead of a hand-written SVD, that introduces a NEW package and this audit must be re-run before the install task, gated behind a `checkpoint:human-verify`.

---

## Findings

### F-1: `rs_math.py`'s randomized SVD has not converged (MEASURED)

The single most consequential finding. `build_tfidf_svd` uses `TruncatedSVD(n_components=80, algorithm="randomized", n_iter=10, random_state=256)`. `extract_topic_keywords` then sorts each component's term weights descending and slices the top 7 -- a discrete operation on an under-converged continuous quantity.

Measured live in this session (`sklearn 1.8.0`, `numpy 2.2.6`):

| Corpus | randomized seed 256 vs seed 999, mean top-7 keyword overlap | randomized(256) vs ARPACK (true answer) | ARPACK seed-to-seed |
|---|---|---|---|
| Synthetic flat-spectrum, 300 docs, 1200-token vocab | **0.550** (27/80 components share ZERO keywords) | **0.623** (16/80 components identical) | identical (1.0) |
| Real structured, 250 repo markdown docs | **0.841** | **0.829** | identical (1.0) |

Convergence with more power iterations on the synthetic corpus: `n_iter=10 -> 0.550`, `n_iter=30 -> 0.905`, `n_iter=100 -> 0.998`.

Downstream propagation on the synthetic corpus (seed 256 vs seed 999): LSA similarity matrix max absolute difference **0.267**; **top-50 pair overlap 0.32**. Classification sign flips among the pairs that survived in both runs: 0.

`[VERIFIED: live execution this session against lib/core/rs_math.py]`

**Honest caveat:** the synthetic corpus is a worst case (uniform random tokens, explained variance of component 0 = 0.0001, a pathologically flat spectrum). Real room artifacts behave like the 250-document real corpus, closer to 0.84. The planner should measure this on the actual fixture room in Wave 0 rather than adopt either of my numbers, but the direction is unambiguous and the fix is the same either way.

**Implication:** a mathematically correct CJS SVD will disagree with the current Python baseline by roughly the same margin that two Python runs with different seeds disagree with each other. Gate the port against an ARPACK-regenerated baseline, not against the shipped `n_iter=10` randomized one.

### F-2: SVD component sign ambiguity is load-bearing

Singular vectors are defined only up to sign. sklearn resolves this deterministically with `svd_flip`. Because `extract_topic_keywords` sorts **descending** and takes the top 7, flipping a component's sign yields an entirely different keyword set (the 7 most negative terms instead of the 7 most positive). A CJS SVD that does not replicate sklearn's sign convention will produce garbage topic keywords for roughly half the components even if the subspace is numerically perfect. `[VERIFIED: reasoning from lib/core/rs_math.py:85-90 + sklearn TruncatedSVD behavior]` `[ASSUMED: that sklearn 1.8.0's svd_flip uses the max-absolute-value-in-column rule -- planner should pin this by reading the installed sklearn source during Wave 0 rather than trusting this line]`

### F-3: Two mutually inverted direction conventions live in the repo

D-03's gate is defined in terms of `signed_diff` sign flips, so the meaning of the sign must be pinned before the gate means anything.

| Site | Rule | Convention |
|---|---|---|
| `.planning/phases/89-reverse-salient-engine/ALGORITHM-SOURCE.md` (Kwan 2023, AUTHORITATIVE) | `bert - lsa > 0` -> structural transfer | **A** |
| `lib/core/rs_math.py:252` | `semantic - lsa > 0` -> `structural_transfer` | **A** |
| `lib/core/leverage-scan.cjs:134` | `signed_diff < 0` -> `semantic_implementation` | **A** |
| `scripts/compute-hsi.py:749` | `lsa > sem` -> `structural_transfer` | **B (inverted)** |
| `scripts/detect-reverse-salients.py:38` | `lsa > sem` -> `structural_transfer` | **B (inverted)** |
| `lib/core/rs-innovation-classifier.cjs:146` | `lsa > 0.3 AND bert <= 0.3` -> `structural_transfer` | **B (inverted)** |
| `lib/core/rs-differential-scorer.cjs:561` | `semantic - lexical > 0` -> `semantic_implementation` | **B (inverted)** |
| `scripts/eureka-room-report.cjs:241` | semantic > lexical -> `semantic_implementation` | **B (inverted)** |

`[VERIFIED: grep across lib/ and scripts/, direct read of each site]`

Convention B is numerically the majority in the repo; convention A is the one the authoritative algorithm source specifies. **This phase must not resolve the disagreement.** Port each script preserving its own convention, so the D-03 gate compares like with like, and file the inconsistency as a separate finding for its own phase. Downstream consumers already depend on the labels: `reverse-salient-agent.cjs:60-72` maps `structural_transfer` to INFORMS/ENABLES and `semantic_implementation` to CONVERGES/INVALIDATES, so a silent flip here would silently rewrite typed cascade edges.

### F-4: The local encoder to replace is `all-MiniLM-L6-v2`, in two places

`scripts/rs-engine.py:268-281` (`_embed_local_minilm`, via `sentence_transformers.SentenceTransformer`) and `scripts/compute-hsi.py:350-361` (`compute_semantic_similarity_tier1`, identical pattern). Both produce 384-dim vectors, then `sklearn.metrics.pairwise.cosine_similarity` clipped to `[0,1]`. This is the real, working local path, and it is what `embedding-spine.cjs` replaces. `[VERIFIED: direct read]`

### F-5: The corpus-level Pinecone path is a stub; the topic-level one is real

`rs-engine.py:283-299` `_embed_via_pinecone_inference` raises `NotImplementedError` and is reachable only when `RS_EMBEDDING_MODEL` is explicitly set to `multilingual-e5-large` or `e5-large` (`:353`). The default and `minilm` both route to local MiniLM (`:347-350`). Separately, `rs-engine.py:1098-1130` `_embed_topic_via_pinecone` IS implemented and calls `pc.inference.embed(model="multilingual-e5-large", parameters={"input_type":"query","truncate":"END"})`. D-01's port target is the latter. `[VERIFIED: direct read]`

Also confirmed still-open and untouched: the pre-existing `KeyError: 'embedding_model'` crash in `rs-engine.py` `main()` flagged by the RCA. `meta['embedding_model']` is read at `:2019` but only written on some paths. The CJS port should not reproduce this bug; the planner should decide explicitly whether fixing it in the Python fallback is in scope.

### F-6: `compute-hsi.py` uses a DIFFERENT LSA algorithm from `rs_math.py`

`compute-hsi.py:324-348` `compute_lsa_similarity` does `TfidfVectorizer(max_features=500)` -> `TruncatedSVD(n_components)` -> **`cosine_similarity(reduced)`**. That is cosine-on-SVD, which `rs_math.py`'s own docstring (lines 104-108) explicitly warns is a *different signal* and must not be substituted for topic-keyword membership. `[VERIFIED: direct read of both]`

So the port needs **two** distinct LSA implementations, not one shared helper:

| | `rs_math.py` (used by `rs-engine.py`) | `compute-hsi.py` |
|---|---|---|
| `max_features` | 2000 | 500 |
| `max_df` | 0.5 | default (1.0) |
| `smooth_idf` | explicit True | default True |
| `n_components` | `max(1, min(80, n-1, n_terms-1))` | `min(80, n-1, n_features)` |
| SVD `random_state` | **256 (pinned)** | **None (unpinned)** |
| `n_iter` | 10 | default 5 |
| Similarity | topic-keyword membership -> row-normalize -> pairwise L1 -> invert -> rescale to [0,1] centered 0.5 | cosine on the reduced matrix, clipped [0,1] |
| Direction convention | A | B |

Note `compute-hsi.py`'s SVD is **unseeded**. I measured its run-to-run instability directly: max absolute difference across 5 runs was `1.9e-15` and top-10 pair overlap was 1.0, but the **full pair ordering differed on every run**. `[VERIFIED: live execution]` So exact full-order equality is unachievable even Python-against-Python, which independently confirms D-03's choice of a rank-agreement gate over byte-compat, and sets a concrete rule: **gate on top-K, never on full ordering.**

### F-7: `compute-hsi.py` carries a substantial non-LSA numerical surface

Beyond LSA it implements sentence-mode classification, a Markov transition matrix, and a spectral profile: `compute_spectral_gap` (`:458`, uses `np.linalg.eigvals`), `compute_stationary_distribution` (`:487`, uses `np.linalg.eig` on the transpose and picks the eigenvector nearest eigenvalue 1), `detect_absorbing_tendency` (`:517`, diagonal excess over uniform baseline), plus `compute_omhmm_score` and a legacy variant. `[VERIFIED: direct read]`

Good news for the port: the transition matrix is over a small fixed set of thinking modes, so these are tiny dense matrices (well under 10x10). A general eigen-solver is not required. The stationary distribution can be computed by power iteration on `P^T` (it is the dominant eigenvector by Perron-Frobenius) and `|lambda_2|` by deflated power iteration or by the QR algorithm on a small matrix. Both are short and deterministic. `detect_absorbing_tendency` is trivial arithmetic. `[ASSUMED: that the mode set is small and fixed -- planner should confirm the mode count by reading classify_sentence_mode before sizing this task]`

### F-8: The real caller surface is wider than the phase boundary states

Spawn-site audit across the 10 CJS modules that reference these scripts:

| Module | Actually spawns Python? | Target |
|---|---|---|
| `lib/agents/reverse-salient-agent.cjs` | **YES** (`execFileSync`, `:187`) | `rs-engine.py --mode internal` |
| `lib/core/intelligence-cascade.cjs` | **YES** (`:430`, `:446`) | `compute-hsi.py` AND `detect-reverse-salients.py` |
| `lib/core/futures/orchestrator.cjs` | **YES** (`:475`, `:512`) | `compute-hsi.py --tier 1` |
| `lib/core/rs-differential-scorer.cjs` | **YES** (2 spawns) | its own embedded `lsaBridgeScript`, plus `rs-pinecone-bridge.cjs` |
| `lib/core/rs-pinecone-bridge.cjs` | **YES** (`spawnSync python3 -c`) | embedded script wrapping `rs_cache.py` |
| `auto-explore-agent`, `graph-derivation`, `leverage-scan`, `bridge-writer`, `sensor-lagging-component`, `breakthrough/detectors` | no (comment/doc references only) | -- |

`[VERIFIED: per-file grep for execFileSync/spawnSync + direct read of each spawn site]`

**This is the exact failure mode Phase 134 died of.** D-04's flag dispatch must reach every YES row, or the phase ships a CJS backend some callers can never select. Note in particular that `rs-differential-scorer.cjs` and `rs-pinecone-bridge.cjs` are "CJS" modules that are themselves Python-dependent via embedded scripts -- they are not currently named in the phase boundary but they keep Python on the user machine regardless of what `rs-engine` does.

Mitigating precedent: `rs-differential-scorer.cjs`'s `scoreMeasured` (`:483-590`) is **already** a completed no-Python path (ONNX spine + `lexical-overlap.cjs`), landed by Phase 211 under SEED-049 decision D2. So the pattern this phase needs has already been executed once in this repo, on the pair-wise path. That is the template, and it is also the strongest Canon Part 7 evidence available. `[VERIFIED: direct read]`

### F-9: The 127.1 harness is a template, not a working gate

Covered in Correction C-2. What is genuinely reusable, verbatim in shape: the corpus-JSON schema (`schema_version`, `phase`, `purpose`, `source`, `embedding_model_baseline`, `embedding_dims_baseline`, `queries[]`), the `setOverlap(a,b,k)` helper, `indexByQueryId`, the aggregate-mean assertion at `>= 0.80`, the non-blocking per-query WARN at `< 0.60`, and the "gate 1 corpus exists / gate 2 fixtures exist, else print and `process.exitCode = 1`" preamble. `[VERIFIED: full read of tests/127.1-graphrag-overlap.test.cjs]`

### F-10: D-07's cache-location bug is CONFIRMED

`node_modules/@huggingface/transformers/src/env.js:162`: `const DEFAULT_CACHE_DIR = RUNNING_LOCALLY ? path.join(dirname__, '/.cache/') : null;` where `dirname__` resolves to the package root. Empirically, `env.cacheDir` on this machine is `/home/jsagi/dev/MindrianOS-Plugin/node_modules/@huggingface/transformers/.cache/`. In a marketplace install that path sits inside `~/.claude/plugins/cache/mindrian-marketplace/mos/<version>/`, which `lib/core/cache-prune.cjs` removes for non-active versions on update. `[VERIFIED: source read + live evaluation]` `docs/ENV-TUNING.md:64-72` confirms `MINDRIAN_MODEL_CACHE` is documented as opt-in with the transformers.js default. D-07's fix is correct and necessary.

### F-11: D-06's `ModelRegistry.is_pipeline_cached` claim is CONFIRMED

Exists at `src/utils/model_registry/is_cached.js:127`, exported from `src/transformers.js:59`, and **present in the CJS build**: `typeof require('@huggingface/transformers').ModelRegistry.is_pipeline_cached === 'function'`. It fast-exits on a missing `config.json` before touching the network. Measured with `env.allowRemoteModels = false` and a cold cache: returned `false` in **17ms**, no throw, no network. `[VERIFIED: live execution]`

This is a strict improvement over `embedding-spine.cjs`'s current `isModelCached` (`:229-239`), which only checks that `<cacheDir>/<owner>/<model>` **exists as a directory** and returns `true` on any error -- so a partially-downloaded or dtype-mismatched cache reads as a hit and the user gets silence instead of a notice.

### F-12: Pinecone `/embed` REST contract

`POST https://api.pinecone.io/embed`, headers `Api-Key`, `Content-Type: application/json`, `X-Pinecone-Api-Version: 2025-01`. Body `{model, parameters:{input_type, truncate}, inputs:[{text}]}`. Response `{model, vector_type, data:[{values, vector_type}], usage:{total_tokens}}`. `[CITED: docs.pinecone.io/reference/api/2025-01/inference/generate-embeddings]`

This maps cleanly onto `rs-engine.py:1118-1124`'s SDK call and IS a ~40-line fetch module. The larger integrated-embedding surface in `rs_cache.py` is not (Correction C-4).

---

## Architecture Patterns

### System Architecture Diagram

```
/mos:find-bottlenecks            /mos:act , /mos:mos-reason
        |                                    |
        v                                    v
reverse-salient-agent.cjs        intelligence-cascade.cjs
  (rules 1-5 unchanged,            futures/orchestrator.cjs
   rule 6 amended per D-09)                  |
        |                                    |
        +--------------+---------------------+
                       |
                       v
        +==========================================+
        |   rs-backend-dispatch.cjs  (NEW, D-04)   |
        |   ONE chokepoint. Reads the env flag.    |
        |   No second selection brain.             |
        +==========================================+
             |                          |
     flag=cjs (default)          flag=python (fallback)
             |                          |
             v                          v
   +--------------------+     +------------------------+
   | rs-engine.cjs      |     | rs-engine.py           |
   | hsi-*.cjs   (NEW)  |     | compute-hsi.py         |
   +--------------------+     | (+ ensure_ml_deps, D-05)|
             |                 +------------------------+
             |                          |
   +---------+---------+                |
   |                   |                |
   v                   v                v
rs-math.cjs      embedding-spine.cjs   numpy / sklearn /
(NEW: TF-IDF,    (EXISTING: ONNX,      sentence-transformers
 determ. SVD,     mdbr-leaf-ir, q8,    (~2GB PyTorch)
 topic keywords,  384-dim, batch 32)
 L1 sim,                |
 abs-diff topk)         | one-time, model-ID-only
   |                    v
   |            HF weight CDN  (Part 8: no user bytes)
   |
   v
identical output contract: .rs-engine-results.json / .hsi-results.json
   |
   +--> D-03 validation harness: rank agreement + sign-flip check
   |         (compares BOTH branches on a fixture room)
   |
   v
navigation.cjs chokepoint -> typed cascade edges (INFORMS / ENABLES /
                              CONVERGES / INVALIDATES)

SEPARATE SPACE (D-01), unchanged dimensionally:
  external corpus --> pinecone-inference.cjs (NEW, ~40 lines, fetch)
                      POST api.pinecone.io/embed, e5-large, 1024-dim
                      (never mixed with the 384-dim local space)
```

### Recommended Project Structure

```
lib/core/
├── rs-backend-dispatch.cjs   # D-04 flag chokepoint; the ONLY place that decides
├── rs-math.cjs               # port of rs_math.py (convention A, seeded/determ. SVD)
├── rs-engine.cjs             # port of rs-engine.py Mode A internal
├── hsi-lsa.cjs               # compute-hsi's DIFFERENT cosine-on-SVD LSA (convention B)
├── hsi-spectral.cjs          # OMHMM + transition matrix + spectral gap + stationary
├── hsi-engine.cjs            # compute-hsi orchestration -> .hsi-results.json
├── pinecone-inference.cjs    # D-01 /embed fetch module (~40 lines)
└── numeric/
    ├── tfidf.cjs             # TfidfVectorizer-compatible (versioned, like jaccard-v1)
    └── svd.cjs               # deterministic truncated SVD + svd_flip sign convention

tests/
├── 272-rank-agreement.test.cjs        # D-03 gate (127.1 harness SHAPE)
├── 272-corpus.json                    # 20 room-artifact probes (NEW, not 127.1's)
└── fixtures/272/
    ├── baseline-python.fixture.json   # ARPACK-regenerated Python baseline
    └── candidate-cjs.fixture.json
```

### Pattern 1: Lazy-require the heavy dep inside the function (Canon Decision #8)

**What:** Never `require('@huggingface/transformers')` at module top level.
**When to use:** every new module that can reach the encoder.
**Why:** the module must still load on a machine where the dep install failed, degrading to a structured envelope instead of throwing.

```javascript
// Source: lib/core/eureka/embedding-spine.cjs:262-275 (verbatim pattern)
async function getEncoder(opts) {
  const options = opts || {};
  if (options._forceUnavailable) {
    return { success: false, error: 'encoder_unavailable', detail: 'forced_unavailable_test_hook' };
  }
  let transformers;
  try {
    // eslint-disable-next-line global-require
    transformers = require('@huggingface/transformers');
  } catch (err) {
    return { success: false, error: 'encoder_unavailable', detail: 'require_failed: ' + String(err && err.message) };
  }
  // ...
}
```

### Pattern 2: Confidence-margin gate (D-03's named reuse target)

```javascript
// Source: lib/core/eureka/embedding-classifier.cjs:203-208
const simWhat = maxSim(cv, ref.whatVectors);
const simWhy  = maxSim(cv, ref.whyVectors);
const label   = simWhat >= simWhy ? 'what' : 'why'; // fail-open on exact tie
const margin  = Math.abs(simWhat - simWhy);
results[names[i]] = { label: label, margin: margin, confident: margin >= threshold };
```

Applied to D-03: for each pair, `signed_diff = semantic - lsa`, `direction = classify(signed_diff)`, `margin = Math.abs(signed_diff)`, `confident = margin >= threshold`. A direction disagreement between the CJS and Python branches is a **hard gate failure only when BOTH sides were confident**; a disagreement where either side sat inside the margin is a WARN. This is what makes the gate meaningful instead of noise-dominated, and it is exactly why D-03 chose rank-agreement over a cosine threshold.

### Pattern 3: Injectable compute seam for offline tests

`embedTexts(texts, {encodeFn})` and `scoreMeasured(a, b, {vectors, encodeFn, lexicalFn})` both accept injected functions that bypass the model entirely. Every new module should carry the same seam so the D-03 harness can run with zero network and zero model load.

### Pattern 4: Never throw across a boundary

Every new module returns `{success:false, error:'<enum>', detail}` rather than throwing. The single documented exception is a Canon Part 8 `ExternalEgressViolation`, which MUST still throw. `[VERIFIED: rs-pinecone-bridge.cjs and embedding-spine.cjs headers]`

### Anti-Patterns to Avoid

- **Sharing one LSA implementation between `rs-engine` and `compute-hsi`.** They are different algorithms with different parameters and different direction conventions (F-6). A shared helper silently changes one of them.
- **"Fixing" the direction-convention disagreement inside the port.** It rewrites typed cascade edges downstream and destroys the D-03 gate's meaning (F-3).
- **Gating on full pair ordering.** Unachievable even Python-vs-Python (F-6).
- **A second selection brain.** The D-04 flag must be read in exactly one dispatch module; the connector-spine rule ("`dispatchSensors` -> `decide()` -> resolver; no second selection brain") applies by analogy.
- **Instantiating a second ONNX pipeline.** `embedding-spine.cjs` holds a per-process singleton keyed by model+dtype; a new module creating its own pipeline doubles memory and can OOM on large rooms.
- **Handing the full text list to the encoder in one forward pass.** Already a paid-for lesson: 2117 claim nodes padded to `[2128, 512]` and ONNX attempted a ~26.7GB allocation. Batch at `DEFAULT_BATCH = 32`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Local sentence embedding | A new transformers.js pipeline | `embedding-spine.cjs::embedTexts` | Singleton pipeline, batch-32 OOM guard, dtype/dim resolution, degradation envelope, first-run notice, Part 8 attestation -- all already paid for. |
| Cosine similarity | A new implementation | `rs-pinecone-bridge.cjs::cosineSimilarity` (re-exported by the spine) | Part 7: same function object, not a fork. Already handles degenerate zero-vectors. |
| Model cache probing | `fs.existsSync` on a guessed path | `ModelRegistry.is_pipeline_cached(task, modelId, {dtype})` | Checks the actual required file set for the task and dtype; 17ms, no network (F-11). The existsSync heuristic false-positives on partial downloads. |
| Offline enforcement in tests | `HF_HUB_OFFLINE` / `TRANSFORMERS_OFFLINE` | `env.allowRemoteModels = false` | transformers.js v4 **ignores** both env vars. Documented in-repo at `tests/eureka-offline-preload.cjs:10-30` and confirmed by `env.js:258`. |
| Top-5 overlap harness | A new gate design | The 127.1 harness shape | Structure is proven and reviewed; only the fixtures and the model/dim locks need replacing (F-9). |
| Python dep remediation on the fallback path | New install logic | `scripts/lib/ensure_ml_deps.py` | D-05; shipped since v1.10.9, wired into 8 scripts. |
| Stopword list / tokenization versioning | An ad-hoc list | The `lexical-overlap.cjs` `jaccard-v1` discipline | A frozen list plus frozen rules, versioned as a tag, so any stored number can be recomputed against the metric that produced it. TF-IDF needs identical discipline. |
| Pinecone auth/egress | A bare fetch | The existing `auditQueryString` / `auditQueryObject` dual-layer wrap | Part 8 defense-in-depth is already implemented on this exact path; a rewrite that drops it is a constitutional regression. |

**Key insight:** almost every hard part of this phase has already been solved once in this repo, on an adjacent path, by Phase 211. `scoreMeasured` is a completed Python-to-ONNX migration with a documented decision record (SEED-049 D2). The genuinely new build is narrow: a deterministic truncated SVD with sklearn-compatible sign handling, a TF-IDF vectorizer matching sklearn's parameters, and a small dense eigen-solver. Everything else is assembly.

---

## Runtime State Inventory

This is a port/migration phase, so runtime state that survives a code change matters.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `<room>/.rs-engine-cache.json` -- per-room embedding cache. Entries are keyed by artifact id and validated on `{hash, model, vector}` where `model` must equal the resolved cold model (`rs-engine.py:325-333`). Switching the local encoder from `all-MiniLM-L6-v2` to `MongoDB/mdbr-leaf-ir` makes **every existing cache entry a miss**. Also `<room>/.rs-engine-results.json` and `<room>/.hsi-results.json` (output artifacts, regenerated). Also `<room>/room.db` REVERSE_SALIENT edges carrying `signed_diff` / `abs_diff` properties written by prior runs (read by `leverage-scan.cjs:126-140`). | Code edit plus a **data consideration**: the cache miss is self-healing (it just re-embeds) but it means the first CJS run on any existing room pays a full re-embed. Say so in the release note. Existing REVERSE_SALIENT edges were computed under the old encoder and old SVD; decide explicitly whether to invalidate or leave them. |
| **Live service config** | Pinecone `rs-external` index, created via `create_index_for_model` with integrated `multilingual-e5-large` embedding (`rs_cache.py:130-160`). It lives in Pinecone's control plane, not in git. Per-topic namespaces `external:{topic-slug}`. | None this phase if Mode B/C stays on the Python fallback (recommended). If the planner ports it, the index and its integrated-embedding config must not be recreated with different settings. |
| **OS-registered state** | None -- verified. No Task Scheduler / launchd / systemd / pm2 registration references these analyzers; they are spawned on demand by `execFileSync` from CJS callers. `[VERIFIED: spawn-site audit]` | None. |
| **Secrets / env vars** | `PINECONE_API_KEY` (read by `rs_cache.py:120`, `rs-engine.py:1113`, `compute-hsi.py:365`). `RS_EMBEDDING_MODEL` (routing, `rs-engine.py:316`, `:981`). `MINDRIAN_PYTHON` (interpreter override, `reverse-salient-agent.cjs:181`). `MINDRIAN_MODEL_CACHE`, `MINDRIAN_EMBED_MODEL`, `MINDRIAN_EMBED_DIM`, `MINDRIAN_EMBED_DTYPE`, `MINDRIAN_EMBED_BATCH` (spine). `PINECONE_INDEX` (`compute-hsi.py:366`). `RS_SEMANTIC_FLOOR`, `EUREKA_DIFF_FLOOR`. | No key renames. **New** var for D-04's flag -- name it, document it in `docs/ENV-TUNING.md` alongside the existing `MINDRIAN_*` family, and note that `MINDRIAN_PYTHON` still governs the fallback branch. D-07 changes the **default** of `MINDRIAN_MODEL_CACHE`, which is a behavior change for anyone who has not set it. |
| **Build artifacts / installed packages** | `requirements-hsi.txt` (`scikit-learn`, `numpy`, `sentence-transformers`, `pinecone`, `requests`) stays required by the fallback path per D-04/D-05, so it is NOT deleted this phase. The transformers.js model cache under `node_modules/@huggingface/transformers/.cache/` is **absent on this dev machine** (verified), so the first CJS run here will download. No stale egg-info or compiled artifacts found. | Do not delete `requirements-hsi.txt` this phase. Move the model cache per D-07. |

---

## Common Pitfalls

### Pitfall 1: Gating the port against an under-converged Python baseline

**What goes wrong:** the CJS port computes a correct SVD, disagrees with `n_iter=10` randomized Python on 17-45% of topic keywords, the rank-agreement gate fails, and the team spends days hunting a bug that is not in the port.
**Why it happens:** `random_state=256` makes the Python side *reproducible*, which is easily mistaken for *correct*. Reproducible noise is still noise.
**How to avoid:** regenerate the baseline fixture with `TruncatedSVD(algorithm="arpack")` (verified deterministic across seeds, overlap 1.0) for baseline capture only. Ship the Python fallback unchanged.
**Warning signs:** topic keyword sets that look plausible but share few terms with Python's; large `|LSA_cjs - LSA_py|` with correct-looking similarity structure; gate failures that move when you change nothing but a seed.

### Pitfall 2: SVD sign flips silently inverting topic keywords

**What goes wrong:** roughly half the components extract their 7 most-negative terms instead of their 7 most-positive, topic-membership counts go haywire, and the LSA matrix is wrong in a way that still looks like a plausible matrix.
**Why it happens:** singular vectors are sign-arbitrary; `extract_topic_keywords` sorts descending and slices, which is not sign-invariant.
**How to avoid:** replicate sklearn's `svd_flip` in `numeric/svd.cjs` and unit-test it against sklearn output on a small fixed matrix before anything else is built.
**Warning signs:** exactly-inverted keyword sets; roughly half the components matching perfectly and half matching not at all (this is the signature -- if you see a bimodal per-component agreement distribution, it is signs, not convergence).

### Pitfall 3: Assuming one LSA implementation serves both scripts

**What goes wrong:** `compute-hsi` results shift because it silently inherits `rs_math`'s topic-keyword algorithm, `max_features=2000`, or convention A.
**Why it happens:** both are called "LSA" and both use TF-IDF plus TruncatedSVD.
**How to avoid:** two modules, `rs-math.cjs` and `hsi-lsa.cjs`, with the parameter table from F-6 written into each header as a comment.
**Warning signs:** HSI scores changing when only `rs-engine` was touched.

### Pitfall 4: `compute-hsi.py`'s unseeded SVD makes "identical output" unachievable

**What goes wrong:** a task acceptance criterion of "byte-identical `.hsi-results.json`" can never pass, so the plan stalls.
**Why it happens:** `TruncatedSVD(n_components=n_components)` at `compute-hsi.py:344` has no `random_state`.
**How to avoid:** write acceptance criteria as top-K rank agreement plus no confident sign flips, never as output equality. Measure the Python-vs-Python noise floor in Wave 0 and set the gate above it.
**Warning signs:** two consecutive Python runs producing different pair orderings (I observed exactly this).

### Pitfall 5: Model swap is a semantic change, not just a runtime change

**What goes wrong:** the semantic similarity matrix legitimately differs because `MongoDB/mdbr-leaf-ir` is not `all-MiniLM-L6-v2`, and this gets attributed to a port defect.
**Why it happens:** D-01 locks the encoder swap as part of the same phase as the runtime swap, so two independent variables move together.
**How to avoid:** separate the variables during validation. Run the CJS port once with `MINDRIAN_EMBED_MODEL=Xenova/all-MiniLM-L6-v2` (already in `KNOWN_MODEL_DIMS` as the documented rollback) to isolate math-port error from model-swap error, then switch to the locked default and record the delta as an expected, documented difference. This costs one extra fixture and removes the single biggest source of ambiguity in the whole gate.
**Warning signs:** semantic leg disagreement that is uniform across all pairs rather than concentrated.

### Pitfall 6: Shipping a CJS backend no caller can select

**What goes wrong:** exactly Phase 134's failure, reproduced inside its own remediation.
**Why it happens:** the dispatch is wired at one obvious call site (`reverse-salient-agent.cjs`) and missed at `intelligence-cascade.cjs`, `futures/orchestrator.cjs`, and the two embedded-Python bridges.
**How to avoid:** F-8's table is the checklist. Add an acceptance grep asserting that no module outside `rs-backend-dispatch.cjs` spawns these scripts directly.
**Warning signs:** a passing unit suite with Python still on the critical path of a real command run.

### Pitfall 7: Re-download on every plugin update

**What goes wrong:** the "one-time" model download recurs on every version bump, on every user's machine.
**Why it happens:** F-10 -- default cache dir is inside the versioned install dir that `cache-prune.cjs` deletes.
**How to avoid:** D-07. Default `MINDRIAN_MODEL_CACHE` to a stable path outside the versioned directory and set `env.cacheDir` before the first pipeline creation.
**Warning signs:** a multi-MB fetch after `claude plugin update`.

### Pitfall 8: Promising a byte-level progress bar that Node cannot deliver

**What goes wrong:** D-06 is implemented against `progress_callback` and the user still sees a long silence, because the `.onnx` weights emit only a terminal 100% event on Node.
**Why it happens:** C-3 -- `IS_NODE_ENV && return_path` skips the buffered read.
**How to avoid:** implement per-FILE progress ("fetching file 3 of 7") plus a stated approximate total size, which the callback genuinely supports. Only reach for `env.customFetch` if true byte-level progress is judged worth the maintenance cost.
**Warning signs:** a progress line that jumps 0 to 100 with a long gap.

---

## Code Examples

### Verifying the model cache without touching the network (D-06)

```javascript
// Source: verified live this session against @huggingface/transformers@4.2.0
// Returns false in ~17ms on a cold cache; no network, no throw.
const t = require('@huggingface/transformers');
t.env.allowRemoteModels = false;               // belt and braces; v4 ignores HF_HUB_OFFLINE
const cached = await t.ModelRegistry.is_pipeline_cached(
  'feature-extraction',
  'MongoDB/mdbr-leaf-ir',
  { dtype: 'q8' }
);
```

### Pinecone hosted inference, the whole D-01 module

```javascript
// Source: docs.pinecone.io/reference/api/2025-01/inference/generate-embeddings
// Mirrors scripts/rs-engine.py:1118-1124 (pc.inference.embed) with zero SDK.
async function embedViaPineconeInference(texts, opts) {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) return { success: false, error: 'pinecone_api_key_missing' };
  const inputType = (opts && opts.inputType) || 'query';   // e5 is asymmetric
  try {
    const res = await fetch('https://api.pinecone.io/embed', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
        'X-Pinecone-Api-Version': '2025-01',
      },
      body: JSON.stringify({
        model: 'multilingual-e5-large',
        parameters: { input_type: inputType, truncate: 'END' },
        inputs: texts.map(function (t) { return { text: t }; }),
      }),
    });
    if (!res.ok) return { success: false, error: 'pinecone_http_' + res.status };
    const json = await res.json();
    const vectors = (json.data || []).map(function (d) { return d.values; });
    if (vectors.length !== texts.length) return { success: false, error: 'shape_mismatch' };
    return { success: true, vectors: vectors, provenance: { model: json.model, dim: vectors[0].length } };
  } catch (err) {
    return { success: false, error: 'network_error', detail: String(err && err.message) };
  }
}
```

Note: `auditQueryString` must run on every element of `texts` BEFORE the fetch, and `auditQueryObject` on the result before return, matching `rs-pinecone-bridge.cjs`'s existing Part 8 contract.

### The dispatch chokepoint shape (D-04 plus D-09)

```javascript
// lib/core/rs-backend-dispatch.cjs -- the ONLY module that decides which backend runs.
// D-09: this IS the rule-6 update. Callers stay thin orchestrators; neither branch
// inlines rs-math logic.
function resolveBackend() {
  const raw = String(process.env.MINDRIAN_RS_BACKEND || '').trim().toLowerCase();
  if (raw === 'python') return 'python';
  if (raw === 'cjs') return 'cjs';
  return 'cjs'; // D-04: CJS is the default; python is the retained fallback
}
```

### The D-03 gate, reusing the 127.1 shape

```javascript
// Source: shape from tests/127.1-graphrag-overlap.test.cjs:123-137 (setOverlap),
// margin logic from lib/core/eureka/embedding-classifier.cjs:203-208.
function gateOnePair(pyRow, cjsRow, marginThreshold) {
  const bothConfident =
    Math.abs(pyRow.signed_diff) >= marginThreshold &&
    Math.abs(cjsRow.signed_diff) >= marginThreshold;
  const flipped = pyRow.direction !== cjsRow.direction;
  if (flipped && bothConfident) return { verdict: 'FAIL', reason: 'confident_sign_flip' };
  if (flipped) return { verdict: 'WARN', reason: 'sign_flip_inside_margin' };
  return { verdict: 'PASS' };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sentence-transformers` + PyTorch on the user machine (~2GB) | transformers.js ONNX in-process, q8, tens of MB | Phase 211 for the pair-wise path; this phase for the corpus path | The whole point of the phase. |
| `Xenova/all-MiniLM-L6-v2` as the default local encoder | `MongoDB/mdbr-leaf-ir` (23M params, Apache 2.0, 384-dim measured) | quick(260706-13z) D3 spike, live-verified | MiniLM stays in `KNOWN_MODEL_DIMS` as an env rollback; useful for isolating port error (Pitfall 5). |
| Python sklearn LSA spawn on the measured differential | `lexical-overlap.cjs` Jaccard, pure CJS | Phase 211, SEED-049 D2 | Precedent that this migration class has been executed successfully here before. |
| `HF_HUB_OFFLINE` / `TRANSFORMERS_OFFLINE` to force offline | `env.allowRemoteModels = false` | transformers.js v4 | The env vars are ignored; only the programmatic switch works. |
| Hard-coded `EMBED_DIM = 384` | `resolveDim()` chain plus true dim stamped from `vectors[0].length` | Phase 211 D3 | A model swap is config plus re-embed, never schema surgery. |
| Pinecone as the Brain vector store | Retired; Memgraph plus locally-embedded e5 | 2026-07-22 cutover | Pinecone survives ONLY for the `rs-external` corpus cache, which is why descoping Mode B/C is low-risk. |

**Deprecated / outdated in this area:**
- Phase 134's original design (local `Xenova/multilingual-e5-large`): superseded by D-02, and its premise was false to begin with (F-5).
- `.planning/research/2026-05-24-cjs-port-feasibility-spike.md`'s byte-compat framing: superseded by D-03. This research strengthens that supersession -- byte-compat is not merely undesirable, it is unachievable, because the Python baseline is not byte-stable against itself (F-6).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | sklearn 1.8.0's `svd_flip` uses the max-absolute-value-in-column sign rule | F-2 | The CJS sign convention would not match, inverting roughly half the topic-keyword sets. **Mitigation: pin this by reading the installed sklearn source in Wave 0.** High impact, cheap to verify. |
| A2 | The OMHMM thinking-mode set is small and fixed, so a small dense eigen-solver suffices | F-7 | If the mode set is large or data-dependent, `hsi-spectral.cjs` needs a general eigen-solver, materially enlarging the task. Verify by reading `classify_sentence_mode` (`compute-hsi.py:406`). |
| A3 | A hand-written truncated SVD is preferable to adding `ml-matrix` / `svd-js` | Standard Stack | If hand-rolling proves harder than estimated, the phase stalls on a numerical-methods task. This is a genuine judgment call, not a verified fact; the planner should decide explicitly and consider a Wave 0 spike task. |
| A4 | Descoping Mode B/C external is acceptable to the navigator | Open Question 1 | If external mode is required in this phase, scope grows substantially beyond D-01's "~40 lines" (C-4). **Needs navigator confirmation.** |
| A5 | Existing REVERSE_SALIENT edges computed under the old encoder can be left in place | Runtime State Inventory | Mixed-provenance edges would be read by `leverage-scan.cjs` as if comparable. Needs an explicit decision. |
| A6 | The measured seed-sensitivity numbers generalize to real fixture rooms | F-1 | My real-corpus proxy was repo markdown, not room artifacts. The direction is robust but the magnitude is not pinned. **Mitigation: measure on the actual fixture room in Wave 0.** |
| A7 | `MINDRIAN_RS_BACKEND` is an appropriate flag name | Code Examples | Cosmetic; CONTEXT.md leaves naming to Claude's discretion, but it should match whatever repo feature-flag convention the planner finds. |

---

## Open Questions

1. **Is Mode B/C (external Pinecone corpus) in scope for this phase?**
   - What we know: `/mos:find-bottlenecks` invokes `mode: 'internal'` only (`find-bottlenecks.md:66`), and external mode requires `PINECONE_API_KEY`, which typical end users do not have. So external mode is not what blocks the user-machine Python-elimination goal.
   - What's unclear: ROADMAP names `rs_corpus.py` / `rs_hybrid.py` / `rs_cache.py` in the phase boundary, which implies external IS in scope; but D-01's "~40 lines" estimate implies only the `/embed` call.
   - Recommendation: **descope Mode B/C to a follow-up phase**, port only the `/embed` module (which serves the topic-gate path at `rs-engine.py:1151`). Confirm with the navigator before planning. This is the single largest scope lever available.

2. **Are `rs-differential-scorer.cjs`'s embedded Python bridge and `rs-pinecone-bridge.cjs` in scope?**
   - What we know: both spawn `python3` today, so Python remains a user-machine requirement regardless of what happens to `rs-engine`. `scoreMeasured` already has a no-Python path, but `score()` and `computeLsaCosine` do not.
   - What's unclear: the phase boundary does not name them.
   - Recommendation: name them explicitly as either in-scope or deferred. If deferred, say so in the SUMMARY, because "Python eliminated" would otherwise be another overstated completion claim -- the precise failure class this phase exists to remediate.

3. **Should the pre-existing `KeyError: 'embedding_model'` in `rs-engine.py` `main()` be fixed?**
   - What we know: confirmed pre-existing and unrelated by the RCA's git-stash A/B; still open. The Python branch is the D-04 fallback, so a crashing fallback is not much of a fallback.
   - Recommendation: fix it in this phase as a small, separately-committed task, or explicitly record why not.

4. **Are Change 3 (I001 auto-stub visibility) and SEED-013's frontmatter correction in this phase's first wave?**
   - CONTEXT.md defers the decision to the planner plus navigator. Change 3 is the process fix that would have prevented this entire phase from being necessary, which is a strong argument for including it.

5. **What invalidates existing `.rs-engine-cache.json` and REVERSE_SALIENT edges?**
   - See A5. Needs an explicit call before the first CJS run on a real room.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | >= 22.16.0 required by `package.json` engines | none needed |
| `@huggingface/transformers` | CJS encoder | yes | 4.2.0, CJS build resolves, `ModelRegistry` present | `encoder_unavailable` envelope (Canon Decision #8) |
| transformers.js model cache | first-run cost | **no** (`node_modules/@huggingface/transformers/.cache/` absent) | -- | lazy download on first use (D-06) |
| `python3` + numpy/sklearn/sentence-transformers | D-04 fallback branch, baseline capture | yes on this dev machine (sklearn 1.8.0, numpy 2.2.6) | -- | `ensure_ml_deps.py` (D-05, unproven in the wild) |
| `PINECONE_API_KEY` | Mode B/C, `/embed` module | not verified this session | -- | graceful `pinecone_api_key_missing` envelope |
| Context7 MCP | library API verification | **no** (`mcp__context7__*` not exposed to this agent; `ctx7` CLI absent) | -- | **used: direct read of vendored `node_modules` source, which is more authoritative for the pinned version** |
| `langtalks-graph-expert` MCP | domain grounding (mandated by CLAUDE.md) | **no** (`mcp__langtalks-graph-expert__*` not exposed to this agent) | -- | none; see honest gap below |
| Pinecone MCP | API contract | **no** | -- | WebFetch of official docs (used) |
| `slopcheck` | package legitimacy | no | -- | no new packages introduced, so no exposure |

**Missing dependencies with no fallback:**
- `langtalks-graph-expert` was unreachable from this agent context (the documented upstream MCP-stripping bug for agents with tool restrictions). CLAUDE.md makes consulting it standing practice for agent/embedding/RAG work, and the task brief specifically asked it to adjudicate D-02's transformers.js-v4 e5-large ONNX claim. **That specific question therefore remains unadjudicated by this research.** I did not paper over the gap with a guess. Mitigating factor: D-02 does not depend on the answer -- it declines to load e5-large locally on independent grounds (no local e5 path exists in the Python to port, and fp32 2.24GB would exceed the runtime being removed), both of which I verified directly. Recommend the planner or a follow-up session with MCP access runs the langtalks query, and treats it as informational rather than blocking.

**Missing dependencies with fallback:**
- Context7 / Pinecone MCP: replaced by reading the vendored `@huggingface/transformers@4.2.0` source directly (strictly more authoritative for the pinned version than docs) and by WebFetch against official Pinecone documentation.
- Model cache absent: expected; it is the condition D-06 exists to handle, and made the F-11 cold-cache measurement possible.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`, so this section applies.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` plus `node:assert/strict` (built-in), with bash harnesses for acceptance greps |
| Config file | none -- tests are directly executable `.cjs` files under `tests/`, aggregated by `tests/run-all-<phase>.sh` |
| Quick run command | `node tests/272-<name>.test.cjs` |
| Full suite command | `bash tests/run-all-272.sh` (to be created in Wave 0), then `node scripts/doctor.cjs --acceptance` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PYPORT-01 | `svd_flip` sign convention matches sklearn on a fixed small matrix | unit | `node tests/272-svd-sign.test.cjs` | Wave 0 |
| PYPORT-01 | TF-IDF vectorizer matches sklearn vocabulary + weights on a fixed corpus | unit | `node tests/272-tfidf-parity.test.cjs` | Wave 0 |
| PYPORT-01 | `abs_diff_topk` upper-triangle, symmetric-cleanup, and `k` clamping semantics | unit | `node tests/272-absdiff-topk.test.cjs` | Wave 0 |
| PYPORT-01 | `classify_direction` preserves convention A exactly (including the `<= 0` bucket) | unit | `node tests/272-direction-convention.test.cjs` | Wave 0 |
| PYPORT-02 | `rs-engine.cjs` Mode A emits a `.rs-engine-results.json` matching the Python schema | integration | `node tests/272-rs-engine-contract.test.cjs` | Wave 0 |
| PYPORT-03 | `compute-hsi` port preserves convention B and cosine-on-SVD (NOT topic-keyword) | unit | `node tests/272-hsi-lsa-algorithm.test.cjs` | Wave 0 |
| PYPORT-03 | spectral gap / stationary distribution match numpy within tolerance on fixed matrices | unit | `node tests/272-spectral.test.cjs` | Wave 0 |
| PYPORT-04 | no module outside the dispatch chokepoint spawns `rs-engine.py` / `compute-hsi.py` | acceptance grep | `bash tests/272-dispatch-chokepoint.sh` | Wave 0 |
| PYPORT-04 | both copies of rule 6 carry the amended wording | acceptance grep | `bash tests/272-rule6-amended.sh` | Wave 0 |
| PYPORT-05 | aggregate top-K rank agreement >= gate, zero confident sign flips | integration | `node tests/272-rank-agreement.test.cjs` | Wave 0 |
| PYPORT-06 | `is_pipeline_cached` probe replaces `fs.existsSync`; notice fires only on a real miss | unit | `node tests/272-cache-probe.test.cjs` | Wave 0 |
| PYPORT-06 | default model cache resolves OUTSIDE the versioned plugin dir | unit | `node tests/272-cache-location.test.cjs` | Wave 0 |
| PYPORT-07 | `/embed` module shape, error envelopes, and Part 8 audit call ordering (audit before fetch) | unit, mocked fetch | `node tests/272-pinecone-inference.test.cjs` | Wave 0 |
| all | no em-dashes in new files | acceptance grep | `bash tests/test-127-03-no-em-dashes.sh` | exists |

### Sampling Rate

- **Per task commit:** the single unit file for that task, plus `bash tests/test-127-03-no-em-dashes.sh`.
- **Per wave merge:** `bash tests/run-all-272.sh`, plus the two existing regression suites that guard this surface: `bash tests/test-127.2-03-rs-engine-silent-failure-fixes.sh` (8/8) and `node tests/test-reverse-salient-agent.cjs` (25/25).
- **Phase gate:** full suite green plus `node scripts/doctor.cjs --acceptance` plus `node scripts/build-connector-registry.cjs --check` before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/run-all-272.sh` -- aggregator; none exists
- [ ] `tests/272-corpus.json` -- 20 room-artifact probe pairs (NEW; 127.1's corpus is Brain-methodology queries at 1024-dim and is not reusable as data)
- [ ] `tests/fixtures/272/baseline-python.fixture.json` -- **ARPACK-regenerated** Python baseline, covers PYPORT-05
- [ ] `tests/fixtures/272/candidate-cjs.fixture.json`
- [ ] A fixture room with enough artifacts that `n_components` binds at 80 rather than `n-1` (the seed-sensitivity regime from F-1 only appears when `n_components << n_features`)
- [ ] **A Wave 0 measurement task, not a build task:** run the Python baseline twice against itself on the fixture room to establish the noise floor, and set the gate above it. Without this number the >= 0.80 threshold is inherited from an unrelated phase rather than justified for this one.
- [ ] A Wave 0 spike deciding hand-written SVD vs `ml-matrix`/`svd-js` (A3)
- [ ] Pin sklearn's `svd_flip` rule by reading installed source (A1)
- [ ] All 13 test files above; the framework itself needs no install

---

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No user auth surface in this phase. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | Local filesystem only; no multi-tenant boundary. |
| V5 Input Validation | **yes** | Room artifact text is untrusted input flowing into a tokenizer, an ONNX model, and (on the external leg) an outbound HTTP body. Existing control: `auditQueryString` / `auditQueryObject` from `rs-egress-prompts.cjs`. Bound array lengths and text sizes before the encoder (the batch-32 guard is also a memory-safety control). |
| V6 Cryptography | **partial** | `crypto.createHash` for content hashing in the embedding cache. Use the built-in; never hand-roll. Note the cache hash is an integrity/staleness key, not a security control. |
| V12 Files and Resources | **yes** | Writes `.rs-engine-cache.json`, `.rs-engine-results.json`, `.hsi-results.json` into the room, and the model cache to a new default path (D-07). Path traversal via room dir must stay guarded; write atomically (temp file then rename), as `_save_embedding_cache` already does at `rs-engine.py:260-262`. |
| V14 Configuration | **yes** | New env flag (D-04) and a changed default (D-07). Both must be documented in `docs/ENV-TUNING.md` and must fail safe when unset or malformed. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection via room path into `execFileSync` | Tampering / Elevation | Already mitigated by repo convention: argv-array `execFileSync`, never a shell string (`intelligence-cascade.cjs:28`). Preserve this in any dispatch rewrite. |
| Canon Part 8 breach -- room bytes egressing to Pinecone | Information Disclosure | Dual-layer `auditQueryString` pre-egress plus `auditQueryObject` post-receive. **Must be preserved in the new `/embed` module**; a clean-slate fetch module is exactly where this gets dropped. |
| Model-weight supply chain (fetching ONNX from a remote CDN) | Tampering | Model ID is pinned in `DEFAULT_MODEL`; `env.allowRemoteModels = false` in tests forces cache-only. Consider whether a revision pin is warranted (currently `main`), which would harden against upstream repo mutation. |
| Resource exhaustion via a very large room | Denial of Service | `DEFAULT_BATCH = 32` bounds ONNX activation size (the paid-for 26.7GB lesson). The SVD port needs an analogous bound: `n_components` is already clamped, but the dense `n x n` pairwise L1 broadcast in `normalize_and_l1_similarity` is O(n^2 * topics) and will need a guard for large rooms. |
| Secret leakage in error paths | Information Disclosure | `PINECONE_API_KEY` must never appear in an error envelope, a `detail` field, or a stderr tail. Note `reverse-salient-agent.cjs:192-200` deliberately forwards the last 200 chars of child stderr into `detail.diagnostic` -- confirm no code path can put a key there. |

---

## Sources

### Primary (HIGH confidence)

- Direct source read, `node_modules/@huggingface/transformers@4.2.0`: `src/env.js:150-270` (cacheDir, allowRemoteModels defaults), `src/utils/dtypes.js:52-56` (fp32 default on Node, q8 only on wasm), `src/utils/hub.js:340-450` (progress dispatch, the Node `return_path` branch), `src/utils/model_registry/is_cached.js:100-175`, `src/transformers.js:59`, `package.json` exports map.
- Live execution on this machine: `is_pipeline_cached` cold-cache timing (17ms, no network); `env.cacheDir` resolution; sklearn seed-sensitivity and ARPACK determinism experiments against `lib/core/rs_math.py` (sklearn 1.8.0, numpy 2.2.6).
- Repo source, direct read: `lib/core/rs_math.py` (full), `scripts/rs-engine.py` (embedding + Pinecone + hybrid sections), `scripts/compute-hsi.py` (LSA, spectral, HSI matrix), `lib/core/rs_corpus.py` / `rs_cache.py` / `rs_hybrid.py` (signatures), `lib/core/eureka/embedding-spine.cjs`, `lib/core/eureka/embedding-classifier.cjs`, `lib/core/eureka/lexical-overlap.cjs`, `lib/core/rs-differential-scorer.cjs`, `lib/core/rs-pinecone-bridge.cjs`, `lib/agents/reverse-salient-agent.cjs`, `lib/core/leverage-scan.cjs`, `tests/127.1-graphrag-overlap.test.cjs`, `tests/eureka-offline-preload.cjs`, `docs/ENV-TUNING.md`.
- `.planning/phases/89-reverse-salient-engine/ALGORITHM-SOURCE.md` (Kwan 2023 authoritative direction semantics).
- `.planning/debug/phase-134-python-elimination-false-complete.md` (full).
- `./CLAUDE.md` and its four `@include` files.

### Secondary (MEDIUM confidence)

- `https://docs.pinecone.io/reference/api/2025-01/inference/generate-embeddings` -- `/embed` endpoint, headers, request/response shape. Official vendor documentation, fetched this session. Not cross-verified against a live call (no key exercised).

### Tertiary (LOW confidence / flagged)

- The generalization of my measured seed-sensitivity numbers to real room artifacts (A6). Two corpora measured, neither of them actual room artifacts.
- sklearn `svd_flip`'s exact rule (A1), asserted from training knowledge, not read from the installed source this session.

### Unavailable (honest gap)

- `langtalks-graph-expert` MCP -- not exposed to this agent context. D-02's transformers.js-v4 e5-large ONNX question is consequently unadjudicated (see Environment Availability).
- Context7 MCP and `ctx7` CLI -- unavailable; substituted with vendored-source reads, which are more authoritative for the pinned version.
- Pinecone MCP -- unavailable; substituted with official docs via WebFetch.

---

## Metadata

**Confidence breakdown:**

- **Standard stack: HIGH** -- no new packages; the one dependency was version-verified in `node_modules` and its CJS build exercised live.
- **Architecture: HIGH** -- every module, line reference, and spawn site was read directly, not inferred. The caller-surface audit was executed mechanically rather than sampled.
- **Numerical findings (F-1, F-6): HIGH for direction, MEDIUM for magnitude** -- determinism claims were measured by execution, not assumed; but the corpora were proxies, not the real fixture room, so the effect size is bounded rather than pinned. Wave 0 must re-measure.
- **Pitfalls: MEDIUM-HIGH** -- Pitfalls 1, 2, 4, 6, 7, 8 trace to verified evidence. Pitfalls 3 and 5 are reasoned consequences of verified facts.
- **D-06/D-07 infrastructure: HIGH** -- verified against installed source and live execution, including the correction that D-06's stated mechanism does not hold on Node.
- **Pinecone contract: MEDIUM** -- official docs, not exercised live.
- **Domain grounding: LOW** -- the mandated `langtalks-graph-expert` consult was not reachable. Flagged, not concealed.

**Research date:** 2026-08-31
**Valid until:** 2026-09-30 for the repo-internal findings (stable, pinned dependency). 2026-09-07 for the Pinecone API contract (vendor-versioned surface, currently `2025-01`).
