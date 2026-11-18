# Phase 392 acceptance: the shape packet, bare versus shaped (392-SC7)

Recorded by plan 392-13 on 2026-11-09 (UTC 22:32). Ids, labels and enum values only; the full capture (request bodies, row ids, Jev answer) lives outside the repository at the scratchpad path named in 396-13-SUMMARY.md. No room text, no snippet text, no Brain identifier here.

## The run

- Script: `node scripts/part8-shape-acceptance.cjs --question "<generic methodology question from the canonical vocabulary>" --room tests/fixtures/392-shape-rooms/room-a --out <scratchpad>/392-acceptance/live-20261109T223217Z.json`
- Brain: theo-mcp.onrender.com (the default origin of lib/core/brain-client.cjs), live sha 3e6946be per 392-12.
- Capability probe (one tools/list, no question sent): `brain_ask` shape true, `recommend_chain` shape true, reachable true, 2 requests.
- The room: the committed synthetic fixture room-a (every value invented). Shape on the wire: `schema_version 1, problem_type WellDefined, stage Phase3, role investor, domain_tag finance, constraint_categories [regulatory, capital]`.
- Lexicon check: room-a has no room.db, so `loadRoomLexicon` yields 0 entries; hits bare 0, shaped 0 (vacuous for this room; the L1 loop test proves the same assertion with a 7-entry synthetic lexicon).

## Captured outbound bodies (keys and enum values only)

| Run | brain_ask keys | recommend_chain keys | recommend_chain problem_type | max_steps | shape equals the room packet |
|-----|----------------|----------------------|------------------------------|-----------|------------------------------|
| bare (MINDRIAN_BRAIN_SHAPE=0) | `[question]` | `[max_steps, problem_type]` | IllDefined (the inferred rung) | 4 | n/a |
| shaped | `[question, shape]` | `[max_steps, problem_type, shape]` | WellDefined (the shape's type) | 4 | yes, on both tools |

Both runs also made the one `brain_query` commands call (`[cypher, params]`, the assembled template, as before).

## The four verdicts

| Criterion | Bare | Shaped | Result |
|-----------|------|--------|--------|
| problem_type_source | heuristic (rung_source inferred, shape_source none, lexicon_scope machine_global) | signal (rung_source signal, shape_source room) | WIN |
| grounding order | lexical | shape_boosted | WIN (Theo declares the order; the raw rows carry no `shape_match` field, so the per-row count is 0 of 8 on both runs, see note 1) |
| coverage | chain_coverage absent, coverage_label unknown (the bare recommend_chain reply carries no additive block) | `{steps_returned 4, steps_requested 4, rank1_leads_total 4, rank1_leads_returned 4, linked_frameworks_for_type 43, full true}`, coverage_label full | WIN ("the shaped run is full, the bare run is not") |
| ordering | option_order theo_rank, theo_rank `[1, 1, 2, 2]`, confidence `[0.87, 0.86, 0.8, 0.77]` | option_order theo_rank, theo_rank `[1, 1, 1, 1]`, confidence `[0.9, 0.89, 0.88, 0.86]` | PASS (non-decreasing along the options in both) |

Verdict: exit 0, no criterion lost, no lexicon leak.

Row ids (chapterId:section) as sent to Jev: bare `ch08:EXERCISE, ch07:CONCEPT, ch07:SYNTHESIS, ch04:CONCEPT, ch03:EXERCISE, ch07:EXERCISE, ch03:SYNTHESIS, ch02b:SYNTHESIS`; shaped `ch08:EXERCISE, ch07:CONCEPT, ch07:SYNTHESIS, ch07:EXERCISE, ch08:FRAMEWORK, ch07:FRAMEWORK, ch08:HOOK, ch06:SYNTHESIS`.

Evidence blocks kept on both envelopes: bare `linked_frameworks_for_type 46`, shaped `linked_frameworks_for_type 43` (plus `linked_frameworks_total 123, frameworks_with_watcher 5, frameworks_total 469` on both).

## The relevance leg

- Jev (TypeSafe, scripts/jev-devtime-client.cjs, model jev-1.13.0, 528 ms, 578 input tokens): state keys `[a_rows, b_rows, problem_type, stage]` (a = bare, b = shaped), one choice question, answer `same` with probabilities a 0.32, b 0.32, same 0.36, confidence 0.04. Read: over chapter ids and section labels alone Jev cannot separate the two lists; the answer is recorded, not counted.
- Human verdict: PENDING. The owner's step: read the two row-id lists above once and re-run with `--human-verdict a|b|same` (the script records the verdict beside the ids). Not claimed here.

## Notes

1. Theo's shaped reply declares `grounding_order: shape_boosted` and reorders rows (the shaped list differs from the bare one from the fourth row on), but its rows carry no `shape_match` boolean (field absent, recorded as null). The 392-CONTEXT D-04 text names `shape_match` on rows; a Theo-side addition if the per-row mark is wanted. Plugin side nothing changes: the declared order is shown.
2. The bare `recommend_chain` reply carried no `chain_coverage` block (coverage_label unknown), while the shaped reply did. Theo emits the additive block on the shaped path only in this reading.
3. Baseline from this machine on 2026-11-08 (beta.81, 396-CONTEXT.md): heuristic, inferred, coverage 1 of 4 partial, 0.6 above 0.9. Today: signal, signal, full 4 of 4, rank order with 0.9 at rank 1.

Hyphens only, no em dash.
