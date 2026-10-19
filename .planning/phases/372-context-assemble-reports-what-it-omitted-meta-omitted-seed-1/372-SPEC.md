# Phase 372: context_assemble reports what it omitted - Specification

**Created:** 2026-10-19
**Ambiguity score:** 0.18 (gate: <= 0.20)
**Requirements:** 7 locked
**Source:** SEED-134 Plan 01 (scope cut ruled 2026-10-19, quick 261019-ui8). Mode: `--auto`, decisions drawn from the SEED-134 consults, the 2026-10-19 red team and the navigator's approval; no live interview.

## Goal

`context_assemble` changes from returning bodies with no account of what it left out, to also returning `_meta.omitted[]`, an additive list that names each omission, its reason and its count (or `null`), and that reports a thrown leg as `leg_failed` instead of an empty result.

## Background

Verified in code on 2026-10-19 (`lib/core/navigation/room-context.cjs`, `lib/mcp/tools/context.cjs`):

- Leg C (`legC`) catches any exception and returns `[]`, so a failed neighborhood read is indistinguishable from an empty neighborhood.
- `filterRankedExclusions` silently drops `chain_state` rows from the ranked set (`RANKED_EXCLUDED_NODE_TYPES`), unless the focus node itself is that type.
- `top_k`, `max_depth`, `fragment_window` and `fragment_char_cap` truncate without reporting that they did.
- `estimate_only` nulls bodies and is visible only through `_meta`, not as an omission.
- The SessionStart envelope already lists what it shortened ("Shortened or left out here"), so the ingredient exists on another surface.
- The file already promises that `_meta` additions are additive and that existing fields stay byte-stable, and it cites a 1200 ms NAV budget.

Why only this slice: a read-only count on 2026-10-19 found section membership on only 3 to 14 percent of content nodes in the four largest rooms measured, so holon-scoped bounding (SEED-134 Plan 02) has no reliable membership signal yet. It is deferred. See the SEED-134 ruling log.

## Requirements

1. **Additive omitted list**: every `context_assemble` result carries `_meta.omitted`, an array (empty when nothing was omitted).
   - Current: `_meta` has `seedNodeId`, `fragmentWindow`, `topK`, `maxDepth`, timings, and leg costs; no omission data.
   - Target: `_meta.omitted` exists on every non-error result, each entry `{ leg, reason, count, detail }`; `reason` is from the closed set `leg_failed`, `type_excluded`, `top_k_cap`, `depth_cap`, `char_cap`, `window_cap`, `estimate_only`.
   - Acceptance: a normal call returns `_meta.omitted` as an array; every `reason` value is in the closed set (schema or test enforced).

2. **Existing fields byte-stable**: no existing field changes.
   - Current: `summary`, `recentMessages`, `relevantNodes`, `cortexNodes`, and existing `_meta` keys are consumed by the dial and `decide()`.
   - Target: those fields are byte-identical to before for the same input.
   - Acceptance: a snapshot comparison of all pre-existing fields, before and after, on the same fixture room, shows no difference.

3. **Thrown leg is reported**: a leg that throws yields `leg_failed`, and still returns that leg's empty result.
   - Current: `legC` returns `[]` on any exception, with no signal.
   - Target: the exception sets an entry `{ leg: "legC", reason: "leg_failed", count: null, detail: <short error class label, no message text from room content> }`; the result is otherwise unchanged.
   - Acceptance: a test that forces `getNeighborhood` to throw sees `leg_failed` for legC and an empty `relevantNodes`; the same test with no throw sees no `leg_failed`.

4. **Type exclusion is reported**: dropped `chain_state` rows are named.
   - Current: `filterRankedExclusions` drops them silently.
   - Target: when one or more rows are dropped, an entry `{ leg: "legC", reason: "type_excluded", count: <n>, detail: "chain_state" }` is present; no entry when none dropped.
   - Acceptance: a fixture room with a known number of `chain_state` neighbors reports exactly that count; a room with none reports no `type_excluded` entry.

5. **Cap reasons are reported honestly**: cap hits are named, with `count` a number only when it is free.
   - Current: `top_k`, `max_depth`, `fragment_window`, `fragment_char_cap` truncate silently.
   - Target: a cap that actually truncated emits its reason; `count` is a number when the dropped amount is already known from the existing computation, otherwise `null`. Unknown is never written as `0`.
   - Acceptance: tests with caps set below the available amount emit the matching reason; a case where the dropped amount is not computed asserts `count === null`, never `0`; a case with no truncation emits no cap entry.

6. **Estimate mode is reported**: `estimate_only` appears as an omission.
   - Current: bodies are nulled; only the exact cost numbers show it.
   - Target: with `estimate_only: true`, `_meta.omitted` includes `{ leg, reason: "estimate_only", count: null, detail: "body" }` per nulled body.
   - Acceptance: a call with `estimate_only: true` includes the entries; a call without it includes none.

7. **No content, no new egress, bounded cost**: the list carries no room text, adds no Brain call, and stays inside the existing budget.
   - Current: Part 8 invariant test and a latency test exist for `getRoomContext`.
   - Target: `detail` is a fixed label or type name only; no node text; no network call added; no new query unless it stays inside the 1200 ms NAV budget.
   - Acceptance: `tests/test-room-context-part8-invariant.cjs` and `tests/test-room-context-latency.cjs` pass unchanged; a test asserts `detail` never contains fixture node text.

## Boundaries

**In scope:**
- `_meta.omitted[]` on the `getRoomContext` result and through the `context_assemble` MCP tool output.
- The `leg_failed` fix for Leg C, and the same reporting for any other leg that swallows an exception.
- Disclosure of the existing `chain_state` type exclusion and the four caps.
- Tests for requirements 1 to 7.

**Out of scope:**
- Bounded focus by holon (`bounded` input, section membership, portal edges) - deferred; membership is recorded on only 3 to 14 percent of content nodes in the largest rooms.
- Outer ring, `crosses_boundary`, cross-boundary discovery - deferred with Plan 02.
- Any new holon node type, new storage, or graph write.
- Any change to the Eureka adapter, `eureka_graph_project`, or Eureka repo.
- New input parameters on `context_assemble` (keeps the tool schema budget pins stable).
- Backfilling `source_section` or running the graph derive - a separate gated step.

## Constraints

- Additive only: existing fields byte-stable (requirement 2).
- Latency: stays inside the 1200 ms NAV budget cited in `room-context.cjs`; exact omission counts that need extra queries are `null` instead.
- Part 8: local only, no Brain call, no room content in `omitted[]`.
- Tri-polar: the field must reach CLI, Desktop and Cowork through the same tool output, with no surface-specific code.
- No new tool input, so the tool schema budget and the 267/276 pins are expected to be unaffected (verify, do not assume).
- Standard repo rules: no em-dashes, `.cjs` for hooks and the MCP server, release lockstep untouched.

## Acceptance Criteria

- [ ] A normal `context_assemble` call returns `_meta.omitted` as an array and every `reason` is in the closed set.
- [ ] All pre-existing result fields are byte-identical to the pre-change snapshot on the fixture room.
- [ ] Forcing a leg to throw produces `leg_failed` and an empty body for that leg; no throw produces none.
- [ ] A room with `chain_state` neighbors reports `type_excluded` with the exact count and detail `chain_state`.
- [ ] Each cap that truncates emits its reason; unknown counts are `null`, never `0`.
- [ ] `estimate_only: true` emits per-body `estimate_only` entries; normal calls emit none.
- [ ] `detail` never contains fixture node text (asserted).
- [ ] `test-room-context-part8-invariant.cjs` and `test-room-context-latency.cjs` pass.
- [ ] `node scripts/build-connector-registry.cjs --check` and the existing tool-schema-budget tests pass.

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                                 |
|--------------------|-------|------|--------|-----------------------------------------------------------------------|
| Goal Clarity       | 0.85  | 0.75 | met    | One precise change, grounded in verified code                          |
| Boundary Clarity   | 0.90  | 0.70 | met    | Explicit out-of-scope list, reasons recorded                           |
| Constraint Clarity | 0.70  | 0.65 | met    | Whether counts are free is unverified; planner treats as assumption    |
| Acceptance Criteria| 0.80  | 0.70 | met    | Pass/fail checks; MCP serialization path of `_meta` not yet traced     |
| **Ambiguity**      | 0.18  | <=0.20 | met  | 1 - (0.35x0.85 + 0.25x0.90 + 0.20x0.70 + 0.20x0.80) = 0.1775           |

## Open items for discuss-phase (HOW, not WHAT)

- Where `count` is free versus needs an extra query, per cap.
- Whether `_meta.omitted` is emitted compactly (only when non-empty) to avoid adding tokens to every call; the red team flagged the token cost. Requirement 1 currently says the array is present and may be empty; discuss-phase may tighten this to "present only when non-empty" if it updates this SPEC first.
- How `_meta` is serialized through `context.cjs` (not traced in this spec).
- Whether the SessionStart envelope should reuse the same reason vocabulary.

## Interview Log

| Round | Perspective     | Question summary                    | Decision locked (auto-selected, source)                                           |
|-------|-----------------|-------------------------------------|------------------------------------------------------------------------------------|
| 1     | Researcher      | What exists today?                  | Silent drops and a swallowed Leg C exception (code read, 2026-10-19)               |
| 2     | Simplifier      | Irreducible core?                   | `_meta.omitted[]` only; `leg_failed` is the real defect fix                         |
| 3     | Boundary Keeper | What is NOT this phase?             | Bounded focus, outer ring, Eureka changes, new holon type (red team, coverage data) |
| 4     | Failure Analyst | What breaks it?                     | Token cost of an always-present field; false comfort from nulls; latency budget     |

---

*Phase: 372-context-assemble-reports-what-it-omitted-meta-omitted-seed-1*
*Spec created: 2026-10-19*
*Next step: /gsd-discuss-phase 372 - implementation decisions (how to build what is specified above). Hold until the beta.73 cut per the release hold.*
