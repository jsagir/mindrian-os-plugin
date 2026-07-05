# Phase 211 Eureka Room Report

> First MEASURED eureka candidates from a real MindrianOS room. High differential is
> NECESSARY not SUFFICIENT: the top of this list may be restatements. The Grounding
> Guard (Phase 212) is the filter, and the bands below are UNCALIBRATED (202-APO tunes them).

## Provenance

| Field | Value |
| ----- | ----- |
| Run mode | OFFLINE (deterministic stub encoder) |
| Room dir | `room` |
| Encoder model | stub (deterministic hashed bag-of-tokens) |
| Encoder dtype | stub |
| Embedding dim | 384 |
| Lexical method | jaccard-v1 |
| Vector backend | cjs-fallback |
| EUREKA_DIFF_FLOOR | 0.3 (default) |
| EUREKA_RRF_K | 25 (default) |
| Nodes in room | 261 |
| Nodes indexed (non-empty text) | 115 |
| Cross-boundary pairs scored | 6054 |
| Pairs skipped (Part 8 figure-guard) | 0 |
| Run date | 2026-07-05 |

## Fire-rate (the calibration evidence 202-APO needs)

Pairs whose `|signed_diff|` (semantic - lexical) clears each candidate floor. The s11 finding
measured real bridges at 0.16-0.25, so watch whether 0.3 fires at all (too cold = silent) or
fires on everything (too hot = noise fountain).

| Floor | Pairs passing | % of scored |
| ----- | ------------- | ----------- |
| 0.1 | 4829 | 79.8% |
| 0.3 | 3658 | 60.4% |
| 0.4 | 14 | 0.2% |
| 0.5 | 12 | 0.2% |

> OFFLINE CAVEAT: the stub encoder scores semantic overlap as a hashed bag-of-tokens, so the
> semantic column TRACKS lexical overlap by construction. This fire-rate is a STRUCTURAL smoke
> signal only -- it is NOT the MiniLM embedding-quality evidence. The embedding-quality and
> fire-rate de-risk answer requires the LIVE run (see the navigator checklist below).

## Top 50 candidates

Ranked by `|signed_diff|` descending. `direction` = `semantic_implementation` (semantic > lexical,
a same-idea restatement risk) or `structural_transfer` (lexical > semantic, a cross-domain bridge
candidate). `band` is UNCALIBRATED.

| # | Node A (type) | Node B (type) | semantic | lexical | signed_diff | direction | band | passes |
| - | ------------- | ------------- | -------- | ------- | ----------- | --------- | ---- | ------ |
| RS-001 | cmd:lean-canvas _(subdomain)_ | cmd:graph _(subdomain)_ | 0.866 | 0.250 | 0.616 | semantic_implementation | breakthrough | yes |
| RS-002 | cmd:score-innovation _(subdomain)_ | cmd:reanalyze _(subdomain)_ | 0.866 | 0.250 | 0.616 | semantic_implementation | breakthrough | yes |
| RS-003 | cmd:analyze-needs _(subdomain)_ | cmd:discover _(subdomain)_ | 0.866 | 0.250 | 0.616 | semantic_implementation | breakthrough | yes |
| RS-004 | cmd:user-needs _(subdomain)_ | cmd:discover _(subdomain)_ | 0.866 | 0.250 | 0.616 | semantic_implementation | breakthrough | yes |
| RS-005 | cmd:value-proposition _(subdomain)_ | cmd:pipeline _(subdomain)_ | 0.866 | 0.250 | 0.616 | semantic_implementation | breakthrough | yes |
| RS-006 | cmd:map-unknowns _(subdomain)_ | cmd:room _(subdomain)_ | 0.866 | 0.250 | 0.616 | semantic_implementation | breakthrough | yes |
| RS-007 | cmd:macro-trends _(subdomain)_ | cmd:admin _(subdomain)_ | 0.866 | 0.250 | 0.616 | semantic_implementation | breakthrough | yes |
| RS-008 | cmd:explore-trends _(subdomain)_ | cmd:admin _(subdomain)_ | 0.866 | 0.250 | 0.616 | semantic_implementation | breakthrough | yes |
| RS-009 | cmd:auto-explore _(subdomain)_ | cmd:organize _(subdomain)_ | 0.866 | 0.250 | 0.616 | semantic_implementation | breakthrough | yes |
| RS-010 | cmd:mva-brief _(subdomain)_ | cmd:diagnostics _(subdomain)_ | 0.866 | 0.250 | 0.616 | semantic_implementation | breakthrough | yes |
| RS-011 | cmd:beautiful-question _(subdomain)_ | cmd:dominant-designs _(subdomain)_ | 0.750 | 0.200 | 0.550 | semantic_implementation | breakthrough | yes |
| RS-012 | cmd:scheduled-tasks _(subdomain)_ | cmd:ingest-methodology _(subdomain)_ | 0.750 | 0.200 | 0.550 | semantic_implementation | breakthrough | yes |
| RS-013 | cmd:map-unknowns _(subdomain)_ | cmd:trending-to-absurd _(subdomain)_ | 0.671 | 0.200 | 0.471 | semantic_implementation | high | yes |
| RS-014 | cmd:trending-to-absurd _(subdomain)_ | cmd:dogfood-flush _(subdomain)_ | 0.671 | 0.200 | 0.471 | semantic_implementation | high | yes |
| RS-015 | cmdcluster:intelligence _(domain)_ | cmdcluster:methodology _(domain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-016 | cmdcluster:intelligence _(domain)_ | cmdcluster:analysis _(domain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-017 | cmdcluster:intelligence _(domain)_ | cmdcluster:orchestration _(domain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-018 | cmdcluster:intelligence _(domain)_ | cmd:ignite _(subdomain)_ | 0.333 | 0.000 | 0.333 | semantic_implementation | opportunity | yes |
| RS-019 | cmdcluster:intelligence _(domain)_ | cmdcluster:meetings _(domain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-020 | cmdcluster:intelligence _(domain)_ | cmdcluster:opportunities _(domain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-021 | cmdcluster:intelligence _(domain)_ | cmdcluster:lifecycle _(domain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-022 | cmd:grade _(subdomain)_ | cmd:mullins _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-023 | cmd:grade _(subdomain)_ | cmd:validate _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-024 | cmd:grade _(subdomain)_ | cmd:diffusion _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-025 | cmd:grade _(subdomain)_ | cmd:diagnose _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-026 | cmd:grade _(subdomain)_ | cmd:causal _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-027 | cmd:grade _(subdomain)_ | cmd:act _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-028 | cmd:grade _(subdomain)_ | cmd:pipeline _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-029 | cmd:grade _(subdomain)_ | cmd:ignite _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-030 | cmd:grade _(subdomain)_ | cmd:scout _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-031 | cmd:grade _(subdomain)_ | cmd:reanalyze _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-032 | cmd:grade _(subdomain)_ | cmd:discover _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-033 | cmd:grade _(subdomain)_ | cmd:futures _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-034 | cmd:grade _(subdomain)_ | cmd:radar _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-035 | cmd:grade _(subdomain)_ | cmd:persona _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-036 | cmd:grade _(subdomain)_ | cmd:bono _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-037 | cmd:grade _(subdomain)_ | cmd:memory _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-038 | cmd:grade _(subdomain)_ | cmd:graph _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-039 | cmd:grade _(subdomain)_ | cmd:query _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-040 | cmd:grade _(subdomain)_ | cmd:visualize _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-041 | cmd:grade _(subdomain)_ | cmd:vault _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-042 | cmd:grade _(subdomain)_ | cmd:speakers _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-043 | cmd:grade _(subdomain)_ | cmd:opportunities _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-044 | cmd:grade _(subdomain)_ | cmd:funding _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-045 | cmd:grade _(subdomain)_ | cmd:onboard _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-046 | cmd:grade _(subdomain)_ | cmd:rooms _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-047 | cmd:grade _(subdomain)_ | cmd:room _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-048 | cmd:grade _(subdomain)_ | cmd:organize _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-049 | cmd:grade _(subdomain)_ | cmd:jtbd _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |
| RS-050 | cmd:grade _(subdomain)_ | cmd:deck _(subdomain)_ | 0.667 | 0.333 | 0.333 | semantic_implementation | opportunity | yes |

## Caveat (necessary not sufficient)

- A high differential is NECESSARY, not SUFFICIENT. The top of this list may be restatements
  (`semantic_implementation` with near-1.0 semantic and near-0 lexical is the classic paraphrase
  trap). The Grounding Guard (Phase 212) is the filter that separates a real bridge from a
  restatement; this runner only surfaces candidates.
- The bands (breakthrough / high / opportunity / moderate / low) are UNCALIBRATED defaults.
  Phase 202 (APO) calibrates `EUREKA_DIFF_FLOOR` and the bands against this fire-rate evidence.
- Real-room content NEVER reaches a network judge. This report is verified by the human
  spot-check appended below, not by Plurai.

## Pending: navigator checkpoint (BLOCKING human-verify, NOT yet done)

This report was generated by the AUTONOMOUS executor in OFFLINE (stub-encoder) mode against the
real 261-node dogfood room database, because the live MiniLM encoder is not installed in the
build worktree (`@huggingface/transformers` is declared in package.json but node_modules is not
carried across worktrees). The candidate pairs and lexical scores above are REAL; the semantic
column is a deterministic stub that tracks lexical overlap, so the top of this list is dominated
by short `cmd:*` subdomain labels that hash alike. That is a stub artifact, NOT the
embedding-quality answer. The MVP de-risk verdict (SEED-049's two open questions:
small-local-embedding QUALITY and FIRE-RATE) requires the LIVE run plus a human read. No verdict
is fabricated here.

What the navigator must do to close R211-REALROOM-GATE:

1. Install the deps so the real encoder resolves: `npm install` (brings in
   `@huggingface/transformers` ^4.2.0 and `sqlite-vec`).
2. Run the LIVE pipeline (first run downloads the ~25MB q8 all-MiniLM model by id; zero room
   bytes egress): `node scripts/eureka-room-report.cjs --db room --top 50 --out evals/eureka/211-room-report.md`
   This OVERWRITES this file with the first MEASURED (real MiniLM) eureka candidates from a real
   room: real semantic cosine, real signed differentials, and the real fire-rate table.
3. Read the top 10 candidates. For each, label it: MEANINGFUL cross-domain connection (worth a
   hedged Larry offer) / RESTATEMENT (paraphrase trap) / NOISE. (SEED-049 bar: "confirm the
   eurekas are meaningful".)
4. Read the fire-rate table. At the 0.3 floor, judge the engine HOT (noise fountain), COLD
   (silent - plausible given s11 measured real bridges at 0.16-0.25), or OK. This is the
   fire-rate answer 202-APO will calibrate `EUREKA_DIFF_FLOOR` from.
5. Append a `## Spot-check verdict (navigator, dated)` section recording the per-candidate labels
   and the overall fire-rate verdict verbatim. If the verdict is "cold at 0.3", note honestly
   that `EUREKA_DIFF_FLOOR` needs 202-APO calibration (a finding, not a failure).
6. Re-run `bash tests/run-all-211.sh` and confirm it still exits FAIL=0.

Separately (deployed-judge leg): the `cross-topic-connection` Plurai route currently returns
HTTP 404 (`run.plurai.ai/ioa/v1/cross-topic-connection/1.0.0` is not deployed). The judge-gate
test caught this and wrote an honest `baseline_deferred` record to `evals/plurai/211-baseline.json`
(reason `plurai_endpoint_unreachable`). Deploy or correct that endpoint, then re-run
`node tests/test-211-judge-gate.cjs` to replace the deferral with a hosted Plurai baseline. This
leg is synthetic-gold-card only and never blocks the real-room gate.

