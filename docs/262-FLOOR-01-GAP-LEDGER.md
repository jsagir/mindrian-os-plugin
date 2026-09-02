# Phase 262 Plan 05: FLOOR-01 Gap Ledger

## 1. Header and Disposition

Phase: 262-floor-green-sweep-02-inversion. Date: 2026-09-02.

D-01 ruling, recorded here as the signed disposition: FLOOR-01 closes this milestone as
"measured, attributed and routed", NOT as "28/28 green". The green run itself moves to
whichever phase actually reopens the Brain-repo write seam. The 28-name denominator was NOT
narrowed to manufacture a green number; narrowing is recorded below (Section 8) as a
considered and rejected option.

Headline verdict, restated from `docs/262-LIVE-MEASUREMENT-EVIDENCE.md` (Plan 262-04),
measured against the incumbent Brain on 2026-09-02: command `node
scripts/check-flagship-floor.cjs`, exit code 1 (a real MISS, not VOID), PASS = 20, MISS = 8,
VOID = 0, of 28 enumerated frameworks. This is a window-fresh, trustworthy verdict under
TRUST-02: zero VOID rows means every PASS/MISS figure below is measured, not carried forward.

## 2. The Row Table

One row per MISS row from the live run, `docs/262-LIVE-MEASUREMENT-EVIDENCE.md` Measurement 1
and Measurement 5 (the refreshed per-dimension table), both measured against the incumbent
Brain on 2026-09-02.

| # | Framework | matches | score | Failing leg | Root cause | Owner | Needs a graph write? | Evidence |
|---|---|---:|---:|---|---|---|---|---|
| 1 | HSI Semantic Surprise Analysis Assistant | 2 | 2/4 | both | SEP name regression: phantom node 28757 carries a `<SEP>`-corrupted, multi-sentence `name`, breaking the resolver; `pattern_type` also reads 0 (the write-path shortfall) | Brain repo | yes | `docs/262-LIVE-MEASUREMENT-EVIDENCE.md` Measurement 1 (per-row line 4) and Measurement 4 (node 28757 verbatim) |
| 2 | PWS Triple Validation Compass | 2 | 3/4 | resolver only | SEP name regression: phantom node 28775 carries the same `<SEP>`-corrupted shape; readiness already reads 3/4 (structure, techniques, flow all present) so this row is blocked purely by the resolver, not by `pattern_type` | Brain repo | yes | `docs/262-LIVE-MEASUREMENT-EVIDENCE.md` Measurement 1 (per-row line 5) and Measurement 4 (node 28775 verbatim) |
| 3 | Scenario Planning | 2 | 4/4 | resolver only | Hop-depth-1 `ALIAS_OF` fork defect in `NORMALIZE_NAME_CYPHER`'s alias branch (FLOOR-03); readiness is already a clean 4/4, matches=2 is the sole failing leg | Brain repo | no - this is the one row that needs NO admin window: it is a read-path Cypher guard, not a graph-content write | `docs/262-LIVE-MEASUREMENT-EVIDENCE.md` Measurement 2 (canonical_matches, readiness) and Measurement 3 (alias topology) |
| 4 | The Pyramid Principle | 1 | 0/4 | readiness only | Pyramid Principle name-target mismatch: the ratified floor name resolves to node 30242 (0/4 live), while `minto-pyramid.mjs` actually enriches a different node, "Minto Pyramid" (38968) | Brain repo | yes | `docs/262-LIVE-MEASUREMENT-EVIDENCE.md` Measurement 1 (per-row line 12) and Measurement 5 (row 4 dimension breakdown, all zero) |
| 5 | Adaptive Leadership | 1 | 2/4 | readiness only | `pattern_type` write-path shortfall: dimension reads 0; per the arithmetic in Section 4 this row clears to PASS on the fix alone | unowned | yes | `docs/262-LIVE-MEASUREMENT-EVIDENCE.md` Measurement 5 (row 5 dimension breakdown) |
| 6 | Four Lenses of Innovation | 1 | 1/4 | readiness only | `pattern_type` write-path shortfall (dimension reads 0) plus an honest sub-floor ceiling its own 261-07 payload already disclosed (structure/techniques/flow genuinely below floor, needing real content enrichment, not a data repair); the +1 arithmetic in Section 4 does not clear this row | unowned | yes | `docs/262-LIVE-MEASUREMENT-EVIDENCE.md` Measurement 5 (row 6 dimension breakdown) |
| 7 | MECE (Mutually Exclusive, Collectively Exhaustive) | 1 | 1/4 | readiness only | `pattern_type` write-path shortfall (dimension reads 0) plus an honest sub-floor ceiling its own 261-05 payload already disclosed; the +1 arithmetic in Section 4 does not clear this row | unowned | yes | `docs/262-LIVE-MEASUREMENT-EVIDENCE.md` Measurement 5 (row 7 dimension breakdown) |
| 8 | Mullins Model | 1 | 2/4 | readiness only | `pattern_type` write-path shortfall: dimension reads 0; per the arithmetic in Section 4 this row clears to PASS on the fix alone | unowned | yes | `docs/262-LIVE-MEASUREMENT-EVIDENCE.md` Measurement 5 (row 8 dimension breakdown) |

Owner split for the SUMMARY: Brain repo 4/8 (rows 1, 2, 3, 4), unowned 4/8 (rows 5, 6, 7, 8),
this repo 0/8 (nothing in this ledger is a plugin-side fix; every MISS row is graph-side or a
Brain-repo Cypher change).

No live row fell outside the four traced classes this run, so no row needed the "unowned, root
cause not traced" fallback language.

## 3. Attribution to Phase 261

Phase 261 was not floor-neutral. Measured against the incumbent Brain, before the ceremony the
ratified-28 PASS count was 11/28; after the ceremony and live today it is 20/28. Phase 261 went
green in nine places and regressed in two, in the same window. Naming both harmful changes so
the record does not read as "the floor simply did not go green":

1. The SEP relabel side effect. The archived-block relabel that restored 71 Framework labels
   also cost PWS Triple Validation Compass a row the ceremony had just earned: its readiness
   rose from 2 to 3 during the ceremony (its own CER-03 payload worked), which should have
   converted the row to a PASS. The same relabel simultaneously broke its resolver count from 1
   to 2, and the floor never saw the readiness gain because the resolver leg failed instead.
   HSI Semantic Surprise Analysis Assistant suffered the identical resolver break (1 to 2
   matches) without a readiness gain to offset it.
2. The systematic `pattern_type` write-path shortfall. Every approved payload targeting an
   existing framework landed one point below prediction because `pattern_type` did not write
   through. Only PEST Analysis, a genuinely new node rather than an existing one, landed
   `pattern_type` and hit its predicted score.

## 4. The `pattern_type` Arithmetic

Recomputed against the live 262-04 numbers (`docs/262-LIVE-MEASUREMENT-EVIDENCE.md`
Measurement 5, measured against the incumbent Brain on 2026-09-02, not copied from
262-RESEARCH.md's carried-forward arithmetic, though the two agree with zero deltas per that
evidence file's own Deltas section).

Applying +1 for `pattern_type` to every row whose dimension reads 0 today (rows 1, 2, 4, 5, 6,
7, 8 in the table above; row 3, Scenario Planning, already carries `pattern_type = 1` and is
unaffected):

- Row 1 (HSI): 2/4 -> 3/4, but matches stays at 2 (the SEP resolver defect is untouched by a
  `pattern_type` fix), so the row stays MISS.
- Row 2 (TVC): already 3/4 before the fix (its readiness dimensions besides `pattern_type` were
  already sufficient); unaffected either way, blocked purely by the resolver.
- Row 4 (Pyramid): 0/4 -> 1/4, stays MISS.
- Row 5 (Adaptive Leadership): 2/4 -> 3/4, clears to PASS.
- Row 6 (Four Lenses): 1/4 -> 2/4, stays MISS.
- Row 7 (MECE): 1/4 -> 2/4, stays MISS.
- Row 8 (Mullins Model): 2/4 -> 3/4, clears to PASS.

Net effect: 20 current PASS + 2 newly-clearing rows (Adaptive Leadership, Mullins Model) =
**22/28**, not 28/28. Applying `pattern_type` alone stops well short of green. The four rows
that still miss after that fix and why: HSI (resolver defect untouched), Four Lenses and MECE
(their own 261-05 and 261-07 payloads already honestly disclosed a sub-floor ceiling on
structure/techniques/flow that a scoring-pipeline fix cannot repair - only real content
enrichment can), and Pyramid (the name-target mismatch, Section 6/7 below). TVC and Scenario
Planning are excluded from this arithmetic pass because their blocking leg is the resolver, not
readiness.

## 5. The D-07 Finding

Question: do Phases 254 and 255 actually need 28/28 clean, or does 20/28 plus a known-gap list
already unblock them?

Measurement, from `.planning/phases/262-floor-green-sweep-02-inversion/262-01-SUMMARY.md`
(`tests/test-262-sep-projection-probe.cjs`, measured against the committed
`data/brain-orchestration-projection.json` on 2026-09-02): the projection carries **0**
`<SEP>` occurrences and exactly **28** framework nodes, every one of the 28 ratified floor
names present byte-exact with `methodology_tier === 'pws'`.

Mechanism: the projection is a Brain-DERIVED LOCAL cache (BOG-09), with no live Brain read
anywhere in its generator. A corrupted `name` on a Brain `:Framework` node (the 71 `<SEP>`-
corrupted nodes, including the two phantoms 28757 and 28775 that break floor rows 1 and 2) has
no path into the committed projection file, because nothing in the generator re-reads the live
Brain at build time.

Honest scope limit: this answers the PROJECTION half of D-07 only. Phase 255's section-affinity
ranking may read the live Brain directly rather than the committed projection, and that half is
NOT covered by this measurement.

Recommendation to the 254 and 255 planners: Phase 254's projection consumption is measurably
unaffected by the 71 corrupted names (0 occurrences in the artifact it actually reads), so
254 does not need to wait on FLOOR-01's remaining 8 rows. Phase 255's live-Brain half needs its
own probe before the same conclusion can be drawn there; that probe is not performed in this
plan and is named here as the remaining open half, not silently assumed clean.

## 6. The FLOOR-03 Re-Ruling

Fresh measured count, command, and date (`docs/262-LIVE-MEASUREMENT-EVIDENCE.md` Measurement
2, measured against the incumbent Brain on 2026-09-02):

```
normalize_framework_name({ raw: 'Scenario Planning' })
  -> canonical_matches: ["Shell Scenario Planning Method", "Scenario planning methodology"]
orchestration_readiness({ framework_name: 'Scenario Planning' })
  -> readiness_score: 4, dimensions {pattern_type:1, structure:1, techniques:1, flow:1}
```

The live count is 2, confirmed by a fourth independent measurement across two graph states
(260-05's post-deploy round-trip, the Phase 261 post-close probe, 262-RESEARCH.md's session,
and this Plan 262-04 measurement all agree).

Traced mechanism: the alias branch of `NORMALIZE_NAME_CYPHER`
(`ProblemsWorthSolving-Brain/src/arm1-orchestrator.mjs:87`) stops at one hop. Node 18880
("Scenario Planning Methodology") is an alias of node 23450 ("Scenario planning methodology"),
which is itself an alias of the terminal node 34362 ("Shell Scenario Planning Method"). The
alias branch emits the intermediate node 23450's own name as canonical instead of walking to
the terminal node, and `reduce` dedups by string rather than by node, so both survive into the
result array (`docs/262-LIVE-MEASUREMENT-EVIDENCE.md` Measurement 3, alias topology).

Live contract violation: the tool's own shipped description promises "every entry in
canonical_matches is canonical" (verbatim), while the live behavior returns an alias node's own
name alongside its canonical target - a direct violation of that promise on the deployed
surface.

The ruling, stated in the requirement's own terms: exactly-1 remains the correct assertion. The
measured 2 is a resolver defect, not a legitimate multi-canonical result. Neither "update the
assertion to 2" (this would bless a resolver bug and make the exactly-1 rule unenforceable for
every other framework) nor "weaken exactly-1 to >= 1" (this would make the readiness column
ambiguous for every framework, not just this one) is acceptable.

D-05 line: Theo's own `resolveFramework`
(`/home/jsagi/Theo/src/mcp/content/normalize-framework-name.ts`) already treats this exact
shape - a fork one hop into an alias chain - as a named `ALIAS_FORK` refusal code rather than
silently returning two canonical matches. The fix carried into the Brain-repo work order
(Section 9) therefore has a working reference implementation to point at, not a from-scratch
design: it is a gap-closure between the current Brain's silent-fork behavior and the
refusal-on-fork behavior Theo's resolver already ships.

## 7. The Pyramid Principle Card

This is surfaced, not decided, per CONTEXT.md's "Claude's Discretion" default (this phase does
not own Brain-repo content decisions, per D-02's own routing rule).

Two nodes, both measured live against the incumbent Brain on 2026-09-02:

- The ratified floor name, "The Pyramid Principle" (node id 30242): live readiness score
  0/4 (`docs/262-LIVE-MEASUREMENT-EVIDENCE.md` Measurement 1, per-row line 12).
- The node `minto-pyramid.mjs` actually enriches, "Minto Pyramid" (node id 38968): live
  readiness score 3/4, per the same live-run session (261-04's finding, re-confirmed live this
  session as unchanged).

Both competing 261-08 rulings survive here, intact and unadjudicated, exactly as 261-08
recorded them: one option targets the payload at the ratified floor name directly (a fresh
content-authoring pass against node 30242); the other option formally retargets the floor's
ratified name to point at the node the existing payload already enriches (node 38968), which is
a floor-set-content change rather than a payload-authoring one. Which of the two paths is
correct is a Brain-repo content question, and the answer travels with the Brain-repo work order
(Section 9) rather than being settled in this document.

## 8. Options Considered and Rejected

Three entries, each with the reason it was refused:

1. **Narrowing `data/flagship-floor-set.json` to the passing set.** Rejected: the file is
   navigator-ratified, and the gate reads and prints `ratified_by` / `ratified_at` from it. A
   narrowed file containing only the 20 passing names would print "RATIFIED at 20 framework(s)"
   and exit 0 while measuring nothing about the 8 rows this ledger names. This is gaming the
   gate, not closing it, and `tests/test-262-floor-denominator.cjs` (Plan 262-01) now makes any
   such narrowing a red test rather than a silent pass.
2. **Weakening the exactly-1 rule to `>= 1`.** Rejected: the gate's own header comment explains
   that a multi-match name makes every readiness probe ambiguous downstream, since the readiness
   tool takes the exact-first match with `LIMIT 1`. Relaxing exactly-1 would make the readiness
   column meaningless for any row with more than one candidate, not just Scenario Planning's row.
3. **Adding a client-side `<SEP>` filter to the plugin-side gate.** Rejected: a filter here would
   green rows 1 and 2 today, but it would hide a real graph defect behind a band-aid on the wrong
   side of the wire, and it would silently mask any future `<SEP>`-shaped corruption rather than
   surfacing it. The repair belongs in the Brain repo's own Phase 5, where the corrupted names
   actually live.

## 9. Routing Summary

| Disposition class | Carried forward by |
|---|---|
| Rows 1, 2, 3, 4 (SEP repair, FLOOR-03 Cypher guard, Pyramid card) | `docs/262-WORKORDER-brain-repo-floor-remediation.md`, addressed to the ProblemsWorthSolving-Brain repo's own todo/phase intake |
| The Theo-adaptation forward-compatibility gap (`check-flagship-floor.cjs` and `build-brain-census.cjs` unlisted) | `docs/262-NOTE-theo-adaptation-list-additions.md`, addressed to the parallel Theo-working session |
| Rows 5, 6, 7, 8 (`pattern_type` write-path shortfall, unowned) | Named in this ledger with measured evidence; routed inside the same Brain-repo work order (Section 9 above) as a scoping request, per D-02 explicitly NOT absorbed into Phase 262 |
| FLOOR-02 (fixture inversion, fully shipped) | Already landed in this repo, Plans 262-02 and 262-03; no further routing needed |
| The `unrecognized_shape` VOID tripwire (D-04) | Already landed in this repo, Plan 262-02; no further routing needed |

## 10. Sign-Off

Navigator approval, quoted from `.planning/phases/262-floor-green-sweep-02-inversion/262-04-SUMMARY.md`,
dated 2026-09-02: "20/28 stands, FLOOR-03's exactly-1 ruling stands, Theo still 502 so D-03's
current-Brain targeting stands. Proceed to 262-05." The navigator was shown VOID count 0,
PASS/MISS 20/8 of 28, Scenario Planning's canonical-match count of 2, the absence of
`brain_write` / `ingest_framework`, and Theo `/health`'s 502 status, and approved without
requesting a correction or a re-run. This is the "signed" in "signed gap ledger": every number
in this document was measured against the incumbent Brain on 2026-09-02 and reviewed by the
navigator on that date before this ledger was written.
