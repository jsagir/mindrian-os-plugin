# SEED-127: adopt research package-2026 and register its engines as method owners

- Filed: 2026-10-13, session jsagi-49, from the owner's words before a PC restart: "C:\Users\jsagi\Downloads\research\package-2026\README.md all these are frameworks with steps and tools and ..."
- Status: idea, dormant until picked up. Nothing copied, nothing adopted.
- Source package: /mnt/c/Users/jsagi/Downloads/research/package-2026 (Windows C:\Users\jsagi\Downloads\research\package-2026). README sha256 prefix fd2b91976580e3c7. 495 files. Downloaded data: untrusted until reviewed; read only; never run an interpreter from inside it.

## What the package is

The 2026 edition of the plugin's research engines: 140 improved files in the same layout as research/algorithms, analogies, eureka, hsi and rs, plus a new sme-agent, each area with a CHANGES log (what was wrong with original line references, what changed, risk to callers, how verified), _tests, and a _baseline with the manifest check and a pristine copy. Per its README: hybrid lexical plus dense similarity replaces LSA-only; percentile thresholds replace fixed cutoffs (legacy modes kept); findings carry a source trail, a second-signal check, novelty status and provenance; LLM judges triage only; injection, path-traversal, CRLF, BOM and non-Latin fixes; exports, CLI flags and JSON keys kept, new keys additive. Not verified by its authors: no run against the real plugin (room-db.cjs and cross-room-aggregator.cjs absent from the slice), no network APIs called, no measurement on real rooms.

## Two tracks

1. Plugin adoption (this repo, GSD): adopt area by area (algorithms, analogies, hsi, eureka, rs, sme-agent) with the README's "Read before adopting" list as the checklist (hybrid scoring default in rs-engine and detect-reverse-salients, write_strategy, grade-grant half credit, eureka Gate 1 mechanismText, genesis handoff restriction and validator role, fetcher retries and provenance keys, Neo4j rollback Cypher text). Run the plugin's own suites after each area. Decide the items the README leaves open (rs-explain sends question text to the Brain; explore-chain pre-pass without the gate; stale USPTO endpoint; PARTIAL triz-matrix; direction-label convention).
2. Theo owners (Theo repo, owner ruling 16 in 42-OWNER-RULINGS.md): each engine is a framework or method with steps and tools, classified by the ruling 14 test and authored by kind on the owner-added path (as owner 31, Reducing Complexity, was): Genesis, Jason, Opposable Mind HMM, find-analogies with SAPPhIRE and TRIZ, Eureka, HSI whitespace, the reverse-salient engines and the SME cross-domain agent. Existing graph nodes (HSI Semantic Surprise Analysis Assistant, Reverse Salient Analysis, TRIZ / Genrich Altshuller Innovation Algorithm) keep their identity; the kind is re-examined with the package as a tier 3 source.

## Why it waits

Phase 43 (Larry-authored routines by kind) and Phase 44 (relationship rebuild) are executing in Theo; the Phase 42 manifest is pinned at v2.0.0-beta.67. New engines enter the compile only after their commands are in a pinned registry, so the plugin adoption and the Theo authoring can run in parallel but compile at the next release-sync.
