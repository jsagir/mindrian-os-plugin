# Phase 134 Multi-Source Coverage Audit (CORRECTED 2026-06-01)

> **Correction note.** The prior version of this file claimed "every item covered, no
> unplanned items" while the plan set touched only ~half the user-machine Python surface.
> That claim was FALSE. This rewrite enumerates EVERY `*.py` script + every CJS caller that
> spawns Python on the user machine, each marked **PORTED** (which plan) or **DEFERRED**
> (why + where). The phase goal -- "remove Python from the user machine ENTIRELY / kill the
> install-fragility class" -- is only TRUE if the full surface is covered. A class of failure
> is not killed by a partial port.

The goal is a CLASS elimination, not a feature. The install-fragility class is precisely
`scripts/lib/ensure_ml_deps.py` auto-running `pip3 install --user numpy scikit-learn
sentence-transformers` (and `requirements-hsi.txt`) on first use of the analyzer surface.
That auto-pip path is reachable from the whitespace + diagnostics + brain-baseline scripts,
NOT just from rs-engine. So the full whitespace/diagnostics surface is in scope.

## Acceptance invariant (the honest bar)

After the cutover (all `MINDRIAN_RS_ENGINE=cjs` default branches wired), this must return ZERO:

```
grep -rn "python3" lib/ scripts/ | grep -v node_modules \
  | grep -vE "MINDRIAN_RS_ENGINE=python|fallback|platform\.cjs probe|PYTHON_GATES|# " \
  | grep -E "execSync|execFileSync|spawnSync|spawnAsync|spawn\(" \
  | grep -vE "(verify-release|release\.sh|session-start|build-graph|analyze-room|room-registry|migrate-rooms|resolve-room|serve-|render-pdf|track-analytics|learn-from-usage|build-jtbd|compute-team|compute-meetings|backup-modifications|reapply-modifications|git-ops|update-icm-index|sentinel-deadline|on-agent-complete|on-cwd-changed|generate-standalone|generate-presentation|research-speaker|sealed-walker)"
```

i.e. every ANALYZER python spawn (rs-engine / hsi / whitespace / diagnostics / brain-baseline /
detect-reverse-salients / pinecone-bridge) is gone from the default cjs path. The remaining
`python3` references are (a) env-flag `=python` fallback branches, (b) the `platform.cjs`
Windows-alias probe, and (c) the explicitly-DEFERRED out-of-analyzer-scope scripts listed below.

## GOAL (ROADMAP Phase 134 goal: eliminate the Windows install-fragility class entirely)

| Goal fragment | Covered by |
|---|---|
| Replace `scripts/rs-engine.py` with in-process CJS | Plan 04b (rs-engine.cjs) + Plan 08 (cutover) |
| Replace `lib/core/rs_*.py` | Plan 02 (rs_math), Plan 04a (rs_rooms/rs_cache/rs_hybrid + DELETE rs_corpus) |
| Replace `scripts/hsi-*.py` (compute-hsi + detect-reverse-salients) | Plan 05 (hsi-compute + reverse-salient port) |
| Replace the discover-*-whitespace.py trio | Plan 05 (hsi-whitespace.cjs) |
| Replace the /mos:whitespace non-discover analyzers | Plan 06 (whitespace-math.cjs) |
| Replace the /mos:fingerprint (diagnostics) analyzers | Plan 07 (fingerprint-math.cjs) |
| Replace the brain-baseline local embedder | Plan 03 (rs-embed.cjs) + Plan 06 (fetch-brain-baseline port) |
| Replace the rs-pinecone-bridge embedded `-c` Python | Plan 04a (rs-cache.cjs absorbs it) |
| via `@huggingface/transformers` (ONNX Xenova/multilingual-e5-large) | Plan 01 (dep + audit), Plan 03 (rs-embed.cjs) |
| remove Python from the user-machine surface ENTIRELY | Plan 08 (env-flag cjs default + Windows-replay across the FULL surface + intelligence-cascade rewire; beta.3 deletion is a follow-on) |

## The full user-machine Python surface (EVERY caller + EVERY script)

### Family A -- reverse-salient + HSI (e5-large 1024-dim / TF-IDF + truncated-SVD LSA)

| Python script / embedded source | Lines | Driven by (CJS caller) | Disposition |
|---|---|---|---|
| `lib/core/rs_math.py` | 287 | (library, imported by rs siblings) | **PORTED** -> Plan 02 (rs-math.cjs) |
| `lib/core/rs_corpus.py` | 468 | rs-engine.py external/hybrid modes | **PORTED-BY-DELETE** -> Plan 04a (DELETE; reuse 130.5 research-corpus.cjs) |
| `lib/core/rs_rooms.py` | 193 | rs-engine.py | **PORTED** -> Plan 04a (rs-rooms.cjs) |
| `lib/core/rs_cache.py` | 479 | rs-engine.py + rs-pinecone-bridge.cjs `-c` | **PORTED** -> Plan 04a (rs-cache.cjs; absorbs the pinecone-bridge embedded script) |
| `lib/core/rs_hybrid.py` | 586 | rs-engine.py hybrid mode | **PORTED** -> Plan 04a (rs-hybrid.cjs) |
| `scripts/rs-engine.py` | 1755 | reverse-salient-agent.cjs, auto-explore-fire.cjs | **PORTED** -> Plan 04b (rs-engine.cjs) |
| `scripts/compute-hsi.py` | 818 | intelligence-cascade.cjs (auto-fire), check-hsi-deps gate | **PORTED** -> Plan 05 (hsi-compute.cjs; includes the OM-HMM spectral-gap math) |
| `scripts/detect-reverse-salients.py` | 242 | intelligence-cascade.cjs (auto-fire) | **PORTED** -> Plan 05 (reverse-salients.cjs; consumes .hsi-results.json + spectral metadata) |
| `scripts/discover-hsi-whitespace.py` | 352 | discovery-cycle.cjs | **PORTED** -> Plan 05 (hsi-whitespace.cjs) |
| `scripts/discover-rs-whitespace.py` | 327 | discovery-cycle.cjs | **PORTED** -> Plan 05 (hsi-whitespace.cjs) |
| `scripts/discover-analogy-whitespace.py` | 433 | discovery-cycle.cjs | **PORTED** -> Plan 05 (hsi-whitespace.cjs) |
| `lib/core/rs-pinecone-bridge.cjs` embedded `python3 -c` LSA/Pinecone bridge | ~50 | rs-differential-scorer.cjs | **PORTED** -> Plan 04a (rs-cache.cjs in-process fetch replaces the `-c` bridge) |

### Family B -- whitespace + topic-forest + diagnostics (768-dim BAAI/llm-embedder, UMAP/KDE/HDBSCAN/PCA, CD-index/Good-Turing/Bayesian-surprise math)

> These were the MISSING half. They share the embedding/cosine layer with Family A
> (reuse rs-embed.cjs) but carry distinct dimensionality-reduction + density + clustering math
> that the Wave-0 spike must now also de-risk (NOT just SVD).

| Python script | Lines | Driven by (CJS caller) | Math beyond LSA | Disposition |
|---|---|---|---|---|
| `scripts/compute-whitespace-embeddings.py` | 464 | whitespace-command.cjs | BAAI/llm-embedder 768-dim (vs e5 1024-dim) -- model-unification question | **PORTED** -> Plan 06 (whitespace-math.cjs; embeds via rs-embed.cjs per Wave-0 model decision) |
| `scripts/compute-whitespace-gaps.py` | 562 | whitespace-command.cjs | UMAP reduce + KernelDensity (gaussian KDE) + NearestNeighbors + PCA | **PORTED** -> Plan 06 (whitespace-math.cjs; Wave-0 spike picks UMAP/KDE strategy) |
| `scripts/compute-external-whitespace.py` | 563 | whitespace-command.cjs | sentence-transformers + sklearn | **PORTED** -> Plan 06 (whitespace-math.cjs; external corpus via 130.5 fetchCorpus) |
| `scripts/compute_topic_forest.py` | 684 | whitespace-command.cjs | HDBSCAN flat clustering + PCA + cosine | **PORTED** -> Plan 07 (topic-forest.cjs; Wave-0 spike picks HDBSCAN strategy) |
| `scripts/compute-disruption-index.py` | 211 | diagnostics-command.cjs (/mos:fingerprint) | Funk & Owen-Smith 2017 CD index (graph arithmetic) | **PORTED** -> Plan 07 (fingerprint-math.cjs) |
| `scripts/compute-blindspot-mass.py` | 209 | diagnostics-command.cjs | Good-Turing coverage estimation | **PORTED** -> Plan 07 (fingerprint-math.cjs) |
| `scripts/compute-element-novelty.py` | 254 | diagnostics-command.cjs | centroid-distance novelty (sentence-transformers) | **PORTED** -> Plan 07 (fingerprint-math.cjs; embeds via rs-embed.cjs) |
| `scripts/compute-bayesian-surprise.py` | 175 | diagnostics-command.cjs | leave-one-out cosine shift (sentence-transformers) | **PORTED** -> Plan 07 (fingerprint-math.cjs; embeds via rs-embed.cjs) |
| `scripts/fetch-brain-baseline.py` | 360 | ensure-brain-baseline.cjs (-> discovery-cycle, whitespace-command, auto-explore-fire) | sentence-transformers local embed of Brain framework descriptions | **PORTED** -> Plan 06 (fetch-brain-baseline.cjs; embeds via rs-embed.cjs; Part 8: Brain DESCRIPTIONS are generic methodology, not user data) |
| `scripts/lib/ensure_ml_deps.py` (the auto-pip trigger -- the literal fragility class) | ~80 | imported by all Family-B `*.py` at entry | n/a -- it IS the failure class | **PORTED-BY-DELETE** -> Plan 08 (deleted on beta.3 follow-on; no CJS equivalent -- npm `@huggingface/transformers` replaces it) |
| `scripts/check-hsi-deps` (bash python-dep probe) | ~30 | intelligence-cascade.cjs gate | n/a | **PORTED-BY-RETIRE** -> Plan 08 (gate becomes no-op on cjs path; retained behind `=python` fallback) |

### Caller-rewire surface (the cutover targets -- every site that spawns analyzer Python)

| CJS caller | Spawn site | Rewired in |
|---|---|---|
| `lib/core/intelligence-cascade.cjs` (post-write auto-fire -- THE RCA surface) | `execSync python3 compute-hsi.py` + `execSync python3 detect-reverse-salients.py` | **Plan 08** (BLOCKER-1 fix) |
| `lib/agents/reverse-salient-agent.cjs` | `execFileSync python3 rs-engine.py` | Plan 08 |
| `lib/core/rs-differential-scorer.cjs` | `spawnSync python3 -c` (via rs-pinecone-bridge.cjs) | Plan 08 |
| `scripts/discovery-cycle.cjs` | `execSync python3 discover-*-whitespace.py` (x3) | Plan 08 |
| `scripts/auto-explore-fire.cjs` | `spawnAsync python3 rs-engine.py --mode hybrid` | Plan 08 |
| `scripts/whitespace-command.cjs` | `runScript python3 compute-whitespace-*.py` (x4) | Plan 08 |
| `scripts/diagnostics-command.cjs` | `execSync python3 compute-{disruption,blindspot,element,bayesian}.py` (x4) | Plan 08 |
| `scripts/ensure-brain-baseline.cjs` | `runCmd python3 fetch-brain-baseline.py` | Plan 08 |
| `scripts/doctor.cjs` | `--check-rs-engine` python dep probe | Plan 08 (retire on cjs path; keep behind `=python`) |
| `commands/find-bottlenecks.md`, `commands/whitespace.md`, `commands/diagnostics.md` | pip-install error hints | Plan 08 (remove pip hint on cjs path) |

## REQ (phase requirement IDs)

| REQ ID | Meaning | Plan |
|---|---|---|
| CJS-134-VENDOR | pure-JS vendoring re-audit passes for the new dep | 01 |
| CJS-134-SVD | SVD/LSA port strategy chosen + correctness bar | 01, 02 |
| CJS-134-WSMATH | UMAP/KDE/HDBSCAN/PCA whitespace-math strategy chosen + correctness bar | 01, 06, 07 |
| CJS-134-MODEL-UNIFY | 768-dim BAAI vs 1024-dim e5 disposition (unify on e5 or keep two embedders) | 01, 03, 06 |
| CJS-134-BYTECOMPAT | model-weight byte-compat measured + disposition | 01, 03 |
| CJS-134-MODELUX | first-run model-download UX + hook-timeout budget | 01, 03 |
| CJS-134-MATH | rs_math.py ported (cosine + LSA) | 02 |
| CJS-134-EMBED | in-process e5-large embedder | 03 |
| CJS-134-RS-PORT | rs_rooms/rs_cache/rs_hybrid ported; rs_corpus deleted; pinecone-bridge absorbed | 04a |
| CJS-134-ENGINE | rs-engine.cjs 3-mode orchestrator | 04b |
| CJS-134-REUSE-130.5 | reuse 130.5 fetcher (no re-port) | 04a, 04b |
| CJS-134-DELETE-CORPUS | rs_corpus.py deleted | 04a |
| CJS-134-HSI | CJS HSI layer (131-deferred) incl. OM-HMM spectral-gap | 05 |
| CJS-134-RS-DETECT | detect-reverse-salients.py ported | 05 |
| CJS-134-DISCOVER-WS | the discover-*-whitespace.py trio ported | 05 |
| CJS-134-HSI-PARITY | CJS HSI == Python HSI on fixture | 05 |
| CJS-134-WS-PORT | compute-whitespace-* + fetch-brain-baseline ported | 06 |
| CJS-134-WS-PARITY | CJS whitespace == Python whitespace on fixture | 06 |
| CJS-134-FOREST | compute_topic_forest.py ported (HDBSCAN) | 07 |
| CJS-134-FINGERPRINT | the 4 diagnostics/fingerprint analyzers ported | 07 |
| CJS-134-FP-PARITY | CJS fingerprint == Python fingerprint on fixture | 07 |
| CJS-134-MIGRATE | ALL callers rewired in-process (no spawn) incl. intelligence-cascade | 08 |
| CJS-134-CASCADE | intelligence-cascade.cjs auto-fire rewired (BLOCKER-1) | 08 |
| CJS-134-ENVFLAG | MINDRIAN_RS_ENGINE both-paths-one-beta | 08 |
| CJS-134-WINREPLAY | Windows-tester-replay zero-Python across the FULL surface | 08 |
| CJS-134-RETIRE-PREFLIGHT | --check-rs-engine + check-hsi-deps retired on cjs path | 08 |

## RESEARCH / CONTEXT directives

| Item | Covered by |
|---|---|
| Package is `@huggingface/transformers` (NOT @xenova); model id Xenova/multilingual-e5-large retained | 01, 03 |
| CJS+ESM support (await import fallback if ESM-only) | 01, 03 |
| ONNX runtime ships WASM, ~200MB optional dep; pure-JS vendoring re-audit | 01 (HARD GATE + checkpoint) |
| ModelRegistry API (uncertain in public docs) | 01 (spike confirms), 03 (uses or fallback) |
| LSA via TruncatedSVD = the hard rs port | 01 spike + 02 |
| **UMAP + KDE + HDBSCAN + PCA = the hard whitespace ports (NEW)** | 01 spike + 06 + 07 |
| **768-dim BAAI vs 1024-dim e5 model split (NEW)** | 01 spike (unify decision) + 03 + 06 |
| Re-vectorization OUT OF SCOPE (-> Phase 127.1) | 03 (byte-compat disposition) |
| REUSE 130.5, do NOT re-port fetcher; DELETE rs_corpus.py | 04a, 04b |
| 134 owns the CJS HSI 131 deferred | 05 |
| Vendoring re-audit HARD GATE + checkpoint before commit | 01 |
| Migration env-flag (both paths one beta) | 01 (name) + 08 (wiring) |
| 5+ Engine-1 commands CofS-backed; reverse-salient-agent in-process (no spawn) | 08 |

## Exclusions (NOT gaps -- explicitly out of the user-machine ANALYZER surface, with reason)

These `*.py` / `python3 -c` sites are NOT analyzer surface and are NOT ported by Phase 134.
Each is enumerated honestly so the audit is complete, not selectively scoped.

| Item | Why out of scope | Where it lives / defers to |
|---|---|---|
| Brain server side (`mindrian-brain.onrender.com`) | Remote service, never on the user machine | Canon Part 8 boundary; CONTEXT out-of-scope |
| Re-vectorization of `pws-brain` Pinecone index | Embedding-substrate change, not a port | Phase 127.1 disposition (CONTEXT out-of-scope) |
| `lib/core/platform.cjs` python3 PROBE (lines 55-67) | Detects the Windows Microsoft-Store alias stub; does not spawn an analyzer | KEEP (it is the detector that makes the cjs path Windows-safe) |
| `scripts/session-start` `sealed-walker.py` (gated) | GUARDRAIL sealed-room parser; already `command -v python3` gated; not an analyzer | KEEP-GATED (PYTHON_GATES.md; node-native walker is a separate phase) |
| `scripts/verify-release`, `scripts/release.sh` python3 JSON reads | DEV/RELEASE-machine only, never ships to the user install | KEEP (maintainer surface) |
| `scripts/build-graph`, `analyze-room`, `compute-team`, `compute-meetings-intelligence`, `room-registry`, `migrate-rooms`, `resolve-room`, `serve-*`, `render-pdf`, `generate-standalone`, `generate-presentation`, `track-analytics`, `learn-from-usage`, `build-jtbd-nudges`, `update-icm-index`, `git-ops`, `backup-modifications`, `reapply-modifications`, `sentinel-deadline-monitor`, `on-agent-complete`, `on-cwd-changed`, `research-speaker` | NON-analyzer bash/python utilities outside the Engine-1 Act-1 analyzer class; they are NOT the install-fragility surface (no `ensure_ml_deps` ML-dep auto-pip; most are `command -v python3` gated stdlib-only one-liners) | **DEFERRED** -- separate "Python-utility-script de-pythonization" phase if/when it is prioritized. Named here so the audit is honest; the Phase 134 goal is explicitly the ANALYZER (ML-dep / install-fragility) class, NOT every python3 reference in the repo. |
| `scripts/consolidate-pinecone.py` | One-shot maintainer migration tool, not invoked by any command/hook on the user machine | KEEP (maintainer tool) |

### Goal-scope clarification (honest narrowing)

The phrase "remove Python from the user machine ENTIRELY" is operationalized as **"remove the
ML-dependency / install-fragility ANALYZER class entirely."** The non-analyzer bash utilities
above (gated stdlib `python3 -c` one-liners that no-op gracefully on Windows per PYTHON_GATES.md)
are NOT part of the install-fragility class (they never trigger `pip install`). They are named,
DEFERRED, and assigned to a future "utility de-pythonization" phase. If the user wants those in
scope too, that is a phase-split decision (see the planner return). The Phase-134 acceptance grep
above proves ZERO analyzer python3 spawn on the cjs path -- which IS the class the goal targets.

## Dependency note

Phase 130.5 (`research-corpus.cjs` + `research-cache.cjs`) is a hard dependency of Plans 04a/04b/06
(external corpus fetch). 130.5 ships in v1.13.1 BEFORE 134 (v1.14.0). Plans that consume it carry
`depends_on: ["130.5"]` in frontmatter and a Task-1 pre-flight assertion that HARD-FAILS if
`lib/core/research-corpus.cjs` is absent (so the executor blocks rather than re-porting rs_corpus.py).
Phase 110 (Brain Context Packet Contract) is consumed transitively via 130.5's Part 8 pre-egress audit.
