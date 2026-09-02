# Note: Additions to Theo's Adaptation List (Phase 254)

## 1. The Ask, Up Front

Add `lib/mcp/brain-router.cjs` to Theo's named plugin adaptation list. This is currently
UNLISTED there - a genuine coverage gap this phase is the one phase positioned to find,
because Phase 254 is the one that enumerated every `mindrian-os` handler reaching the Brain
(`lib/mcp/brain-composition-census.cjs`, COMP-01).

The current 7-file list, so the recipient can see this is an addition to a known list rather
than a new one: `scripts/probe-brain-contract.cjs`, `lib/brain/chain-recommender.cjs`,
`lib/core/enrichment-queue.cjs`, `bin/mindrian-brain-mcp-client.cjs`,
`lib/core/resolve-brain-key.cjs`, `data/brain-surface-contract.json`, and
`BRAIN_TOOL_MATCHER` / `hooks/hooks.json`. Phase 262 already asked for two more
(`scripts/check-flagship-floor.cjs`, `scripts/build-brain-census.cjs`), so the list the
recipient holds may already be 9.

## 2. The Break, Precisely

`brain-router.cjs`'s Tier 3 (`brainRoute()`, called from `recommend()` inside a 2-second
`Promise.race`) calls `brainClient.ask(question)` and reads `brainResult.next_gate.options[]`
plus `brainResult.directive.guided.framework` to build its ranked chain
(`brain-router.cjs:297-314`). Theo's `brain_ask` returns *"structured rows, never composed
prose"* in two modes with exactly three curated ops (confirmed by reading
`/home/jsagi/Theo/src/mcp/content/brain-ask.ts` directly, 2026-09-02) - `next_gate` is an
INCUMBENT-ONLY shape; no Theo tool emits it (confirmed: `grep -rn "next_gate"
/home/jsagi/Theo/src/mcp/content/*.ts` returns nothing).

Post-flip, `brainResult.next_gate` is `undefined`, so `options` reads as `[]` and
`anchorFramework` reads as `null`. `rawChain` stays empty, `brainRoute()` returns `null`, and
Tier 3 falls through to `localRec` (the Tier-2 heuristic) silently. The Phase 252-01 SWEEP-01
refusal disclosure at `brain-router.cjs:411-429` will NOT fire, because it is conditioned on
`!brainClient.isAvailable()` and availability is still true post-flip - the failure is a shape
mismatch, not an outage. This is the exact class Phase 262 named "the single highest-risk
line": a consumer has to NOTICE that answers which used to be graph-grounded quietly became
heuristic, with no crash and no type error.

## 3. What This Phase Did, and What It Deliberately Did Not

Phase 254 ratified server-side composition (D-01: both `orchestration act*`'s Tier-3 live
Brain call and `suggest_next`'s chain offer stay as shipped, governed rather than
re-litigated), enumerated every `mindrian-os` handler that reaches the Brain in
`lib/mcp/brain-composition-census.cjs` (COMP-01, 4 declared sites, 2 reaching), and closed the
`ambiguous`-verdict gap in the `callTool` belt with disclose-and-proceed
(COMP-02 / D-02 Option A: an additive `egress_disclosure` field, never a block).

It did NOT adapt `brain-router.cjs`'s reader to Theo's actual response shape - that is
flip-day work, and Theo is not deployable yet (no remote hosting story, its own Phase 8.4 not
started per Theo's own `.planning/MISSION-FINALIZE-THEO.md`), so it belongs on the list with
the other files rather than in this phase.

## 4. The Second Named Item: `BRAIN_PROBLEM_TYPE_ALIASES`

`lib/core/brain-client.cjs:1607-1616`. The exact mapping, quoted verbatim:

| Incumbent-side key(s) | Projects to |
|---|---|
| `undefined`, `udp` | `Undefined Problem` |
| `ill-defined`, `ill_defined`, `idp` | `Ill-Defined Problem` |
| `well-defined`, `well_defined`, `wdp` | `Well-Defined Problem` |

None of those three target strings (`Undefined Problem` / `Ill-Defined Problem` /
`Well-Defined Problem`) is a live Theo `DomainConcept` id. Theo's are `UnDefined`,
`IllDefined`, `WellDefined`, `Wicked`, `Trinity`, `Compass` (confirmed by reading
`/home/jsagi/Theo/src/mcp/content/recommend-chain.ts` lines 27-47, 2026-09-02, and by
`/home/jsagi/Theo/CLAUDE.md`'s own "Known, already-live violation" note that all six
`DomainConcept` nodes are currently fully orphaned in Theo's own graph - a separate,
Theo-side defect, not this repo's problem to fix, but worth knowing when scoping the flip).

**Phase 254's stated decision, verbatim from `254-05-SUMMARY.md`:** `BRAIN_PROBLEM_TYPE_ALIASES`
is NOT re-pointed in this phase. No single value satisfies both the incumbent's three
canonical names and Theo's six ids. The standing rule is to ship against the CURRENT Brain
because Theo is not deployable yet; re-pointing today would trade a live regression (breaking
the incumbent's own recognized aliases) for a future convenience that is not live yet. Removing
the map entirely would be strictly worse - an unmapped token passes through unchanged and goes
honest-empty either way, but the map's 8 known aliases would stop projecting correctly against
the incumbent right now. The map is PINNED, not re-pointed: `tests/test-254-normalize-roundtrip-probe.cjs`
Arms 4 and 5 pin the 8 keys projecting onto exactly the 3 incumbent canonical names and prove
`_normalizeBrainProblemType` passes an unknown well-shaped token through unchanged. So the
flip-day change is a single-line-per-key diff against a test that already names the target -
not a rediscovery.

**The sibling map that must NOT be conflated:** `lib/brain/chain-recommender.cjs`'s own
`PROBLEM_TYPE_ALIASES` targets the LOCAL router codes `UDP`/`IDP`/`WDP` and is a different
concern entirely - it never touches the Brain wire. `tests/test-254-normalize-roundtrip-probe.cjs`
Arm 5 adds a structural arm proving the two maps' value sets are disjoint, so "these are
deliberately not the same map" is a tested property, not merely a comment.

## 5. Three Consequences Theo's Side Should Price In

1. **The orchestration-projection consumption half of this phase is a ZERO-diff surface at
   cutover.** Theo's own `orchestration-readiness.ts` (read directly, 2026-09-02) names this
   repo's `data/brain-orchestration-projection.json` by path and records the decision not to
   sync it in `09-04-PLAN.md`: *"THAT PROJECTION IS NOT SYNCED INTO THEO IN PHASE 9... the
   score's inputs come from LIVE THEO QUERIES ONLY."* `lib/workflow/chain-source.cjs` (this
   phase's new blend seam, WIRE-01..04) reads only the local projection file and the local
   registry - it never touches the Brain wire and stays outside Theo's cutover surface entirely.
   Worth the recipient knowing so this half is never budgeted for.
2. **Theo's own `chain-run.ts` design already ratifies the exact composition shape this phase
   ratified.** Its header (`/home/jsagi/Theo/src/mcp/operational/chain-run.ts`, read directly):
   *"THEO OWNS THE SCHEMA AND THE WIRE SHAPE. THE PLUGIN OWNS THE BEHAVIOUR... Theo mints no
   second executor"* and *"THEO CLASSIFIES NO COMMAND'S AUTONOMY. Not here, not anywhere."* D-01
   (server-side composition, ratified this phase) and Theo's own design agree rather than
   diverge - no architectural surprise waiting on either side.
3. **A stale node count.** Theo's `orchestration-readiness.ts` header says 380 nodes for
   `data/brain-orchestration-projection.json`; the artifact measures 384 today (confirmed live,
   2026-09-02). A 4-node drift since Theo's 2026-08-31 re-measurement. Immaterial to any
   decision, worth not repeating.

## 6. Delivery

This note is addressed to the parallel Theo-working session, per the Phase 262 precedent. Check
for a reply there before assuming the open question about brain-router.cjs adaptation is still
unanswered.

This is a message, not a code change. `git -C /home/jsagi/Theo status --short` returned EMPTY
output when checked during this phase's execution (2026-09-02) - nothing under `/home/jsagi/Theo/`
was created, edited, or deleted to produce this note. Every Theo-side file this note cites was
read only, on 2026-09-02:

- `/home/jsagi/Theo/src/mcp/content/brain-ask.ts`
- `/home/jsagi/Theo/src/mcp/content/orchestration-readiness.ts`
- `/home/jsagi/Theo/src/mcp/content/recommend-chain.ts`
- `/home/jsagi/Theo/src/mcp/operational/chain-run.ts`
- `/home/jsagi/Theo/CLAUDE.md`
