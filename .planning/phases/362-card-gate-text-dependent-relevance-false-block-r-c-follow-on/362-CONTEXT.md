---
phase: 362
name: "Card gate: text-dependent relevance false block (R-C follow-on from Phase 357)"
gathered: 2026-09-29
status: ready_for_planning
canon_parts: [3, 8, 11, 12]
---

# Phase 362: Card gate text-dependent relevance false block - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning (execution gated on Phase 359, see D-01)

<domain>
## Phase Boundary

Close the one `known_false_block` Phase 357 left open: replay entry `dogfood-0f86dd63-092046`. On a
short human continuity turn about a prior thread, a single content token overlapped the pending
reach, so the Stop-hook card gate judged the turn relevant and false-blocked the card. Phase 357
ruling R-C recorded it as not separable by any deterministic rule then in the code and opened this
phase. 362 either proves the case resolved by Phase 359's declared-fork contract, or fixes it with
structured signals only, or records it as a residual `known_false_block` with evidence. The 357
bar (false_blocks = 0 for every code-fixable case) must hold after the change.

Not in scope: any text understanding in the hook, any Jev call in a hook, any change to 359's
declaration contract.

</domain>

<decisions>
## Implementation Decisions

### Order
- **D-01:** 362 **waits for Phase 359** (navigator ruling 2026-09-29). Phase 359 (owned by another
  session; 6 of 12 plans executed at 2026-09-24) still has plans 07-10 to run, and they rewire
  `scripts/check-card-fire.cjs` and `lib/core/gate-relevance.cjs`, the same files a 362 fix would
  touch. 362 may be planned now; execution starts only after 359's plans 07-10 are on main.
- **D-02:** The **first task** of execution is a replay: run entry `dogfood-0f86dd63-092046` through
  the 357 replay harness (`tests/test-357-replay.cjs`, fixtures under
  `tests/fixtures/card-fire-replay/`) on post-359 code. If it no longer false-blocks, 362 closes as
  **resolved-by-359** with the replay output as evidence, and no gate code changes.

### Method (only if still needed after D-02)
- **D-03:** **Structured signals only** (navigator ruling 2026-09-29). No text understanding in
  the hook; no Jev; no egress. This honors 357 (zero user text to Jev, no Jev in hooks) and 359's
  N-rulings (the hook never guesses a fork from free text). Candidate structured signals, for
  research to evaluate against the replay corpus:
  - turn metadata: a continuity turn (human, short, referring to a prior thread), elapsed time and
    turn distance since the reach was minted, whether the reach was already consumed;
  - token provenance: whether the single overlapping token is the reach's own option label or
    only generic or chrome vocabulary (extends 357's D-08a F.1 chrome stripping);
  - 359's declared options: relevance measured against Larry's declared `Your call:` options
    rather than loose token overlap.
- **D-04:** Anything no structured signal can clear stays a **`known_false_block`**, with a
  text-dependence reason and the replay evidence, excluded from the 0 bar exactly as 357 R-C did.

### Acceptance
- **D-05:** The replay's `false_blocks` stays 0 for every code-fixable entry, the 357 mutation leg
  still passes, and no previously correct fire becomes a miss (the anti-vacuity fixtures still
  fire). The 0f86dd63 outcome is recorded as one of: resolved-by-359, fixed (which signal), or
  residual known_false_block.

### Claude's Discretion
- Which structured signal(s), if any, after measuring on the replay corpus.
- Test layout, following `tests/run-all-357.sh` and `tests/run-all-359.sh` conventions.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-CONTEXT.md` - R-C ruling (line ~335), D-07/R-A, D-08a/R-F fixes, R-D evidence snapshot
- `.planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-VERIFICATION.md` - known_false_block recorded, 0 bar
- `.planning/phases/359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros/359-CONTEXT.md` and `359-SPEC.md` - N-1..N-8 rulings, the declared-fork contract (N-3)
- `.planning/phases/359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros/359-07-PLAN.md` .. `359-10-PLAN.md` - the pending edits to the same files
- `tests/test-357-replay.cjs`, `tests/fixtures/card-fire-replay/dogfood.json` (entry dogfood-0f86dd63-092046), `tests/fixtures/card-fire-replay/pre-359.json`
- `scripts/check-card-fire.cjs`, `lib/core/gate-relevance.cjs`, `lib/core/turn-text.cjs`
- Evidence snapshot: `~/.cache/mindrian-dev/357-raw/` (session 0f86dd63, local only, mode 700)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-09-23-larry-extended-x-jev-gate-triad-replay.md` - replay record

</canonical_refs>

<code_context>
## Existing Code Insights

- The replay harness, labeled dogfood corpus and mutation leg already exist (357); 362 adds one entry's disposition, not a new harness.
- 357's D-08a strips frozen F.1 chrome tokens from topical relevance; a token-provenance signal would extend that same function rather than add a second relevance path.

</code_context>

<specifics>
## Specific Ideas

None beyond the decisions: the navigator chose the conservative path on both forks.

</specifics>

<deferred>
## Deferred Ideas

- A local text-based continuity check in the hook: rejected for now (navigator chose structured signals only); revisit only with new evidence and an explicit ruling.

</deferred>

---

*Phase: 362-card-gate-text-dependent-relevance-false-block-r-c-follow-on*
*Context gathered: 2026-09-29*
