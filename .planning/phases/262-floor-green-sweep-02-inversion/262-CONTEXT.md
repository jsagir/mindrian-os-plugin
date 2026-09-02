# Phase 262: Floor Green + SWEEP-02 Inversion - Context

**Gathered:** 2026-09-02 (navigator ruling captured live during this session, no separate
discuss-phase run -- `workflow.skip_discuss` is `true` for this repo)
**Status:** Ready for planning
**Source:** Navigator AskUserQuestion ruling + 262-RESEARCH.md's adopted recommendations

<domain>
## Phase Boundary

The named exit gate for v2.1.0's Floor Green work. `check-flagship-floor.cjs` measures live
today at **20/28 PASS, 8/28 MISS, 0 VOID** (first clean, non-transport-VOID read since Phase
261's ceremony). Eight requirements-level findings this phase must dispose of, each root-caused
by research: two `<SEP>`-name self-inflicted regressions from 261's own relabel, one Cypher
hop-depth-1 `ALIAS_OF` fork defect (FLOOR-03), one unowned `pattern_type` write-path gap
(Brain repo's own filed-but-unscoped todo), and one known Pyramid Principle name-target
mismatch carried from 261-04/261-08. FLOOR-02 (keyless-refusal fixture inversion) is fully
deliverable now, hermetic, zero network. FLOOR-01's *measurement* runs entirely in this repo;
its *remediation* for 6 of 8 rows is Brain-repo graph-write work, currently blocked because
`brain_write`/`ingest_framework` are absent from the live tool surface
(`BRAIN_HTTP_ADMIN=deny` since 2026-09-01T20:54:40Z).

**The Theo flip is upstream of this phase's primary instrument, not adjacent to it** (raised
mid-research, confirmed load-bearing by 262-RESEARCH.md's dedicated "The Theo Flip" section).
`check-flagship-floor.cjs` reads `result.canonical_matches` and `result.readiness.readiness_score`
-- keys Theo's `normalize_framework_name` and `orchestration_readiness` do not carry (Theo returns
`{canonical, matched_via, coverage}` and `{framework, score, ...}` respectively). Today those
reads fail SILENTLY to `null`, `ok` stays `true`, so TRUST-02's VOID protection never fires --
the first post-flip run would read `0/28 PASS`, exit 1, indistinguishable from a genuinely red
floor. Theo's own docs name this exact class "the single highest-risk line." Theo Phase 08.4
(remote hosting, the flip's hard blocker) is 6/7 plans done, origin exists
(`theo-mcp.onrender.com`), `/health` returns 502, one navigator checkpoint open -- weeks, not
months, away. Phase 262 is the only phase that runs this gate, so it is the only phase positioned
to find and close this specific gap before it bites silently.

</domain>

<decisions>
## Implementation Decisions

### Milestone disposition of FLOOR-01 (the central scope call)
- **D-01 (navigator ruling, 2026-09-02, resolving 262-RESEARCH.md Open Question 2):** Ratify
  20/28 with a signed gap ledger this milestone. Do NOT wait for Brain-side remediation
  (no admin window scheduled against v2.1.0) and do NOT narrow the ratified 28-name denominator
  (research explicitly flags narrowing as gaming the gate -- rejected). The gap ledger records,
  per MISS row: measured state, root cause, owner (this repo / Brain repo / unowned), and whether
  it needs a graph write. FLOOR-01 closes this milestone as "measured, attributed, and routed,"
  not as "28/28 green" -- the green run itself moves to whichever phase actually reopens the
  Brain-repo write seam.
- **D-02 (navigator ruling, 2026-09-02):** Route the six write-dependent MISS rows (the two
  `<SEP>` names, the unowned `pattern_type` write-path gap, and the Pyramid Principle
  retarget-vs-enrich call) to the Brain repo as a written work order with node ids and measured
  evidence -- filed into that repo's own todo/phase intake (Pitfall 6's documented convention),
  never executed inline from this repo. FLOOR-03's Cypher fix is the one row that needs NO admin
  window (a read-path guard); it stays Brain-repo work but is not gated on the write-seam
  reopening.

### The Theo flip (target-current-Brain, but make the gate flip-safe)
- **D-03 (navigator ruling, 2026-09-02, first question):** Plan and remediate against the
  CURRENT Brain, not Theo. Theo is not deployable yet (Phase 08.4 incomplete, `/health` 502).
  Do not re-scope FLOOR-01 remediation as "blocked on Theo" and do not delay it waiting for
  cutover.
- **D-04 (navigator ruling, 2026-09-02, adopting 262-RESEARCH.md's "What Phase 262 should do
  about it" recommendation in full):** Add a fourth, small, additive track: make
  `probeFramework` treat an unrecognized response envelope (a successful call whose payload the
  evaluator cannot read -- `normalizeMatches` or `readinessScore` resolving to `null` while
  `ok === true`) as a NEW `failures[]` entry, `kind: 'unrecognized_shape'`, so the existing VOID
  machinery (banner, exit 3, per-row detail, mandatory human re-run) fires unchanged. Hermetic,
  zero network, testable against `evaluateFloor` directly, correct today regardless of flip
  timing. Do NOT adapt the gate's readers to Theo's actual shape in this phase -- the origin is
  502 and unexercisable; that adaptation is flip-day work and belongs with Theo's other 7 named
  adaptation-list files. Do add `scripts/check-flagship-floor.cjs` and
  `scripts/build-brain-census.cjs` to Theo's own adaptation list as a written note (message, not
  code) -- both are currently UNLISTED there, a genuine coverage gap this phase is the one phase
  positioned to surface. Every floor number this phase's plan or gap ledger cites must be dated
  ("measured against the incumbent Brain on <date>") so a post-flip reader never compares across
  populations.
- **D-05 (standing rule, added to CLAUDE.md this session, applies going forward):** every future
  phase whose research touches the Brain graph must state explicitly whether its finding/fix has
  a Theo-side analog. For 262 specifically this already surfaced one concrete case worth citing
  in the plan: Theo's own `resolveFramework` (`normalize-framework-name.ts`) already refuses on
  an alias fork (`ALIAS_FORK`) rather than silently returning multiple canonical matches -- the
  exact defect class FLOOR-03 root-caused in the incumbent Brain. Frame the Brain-repo work order
  for FLOOR-03 as "close the gap to the refusal-on-fork shape Theo's resolver already ships,"
  citing that file, not as a from-scratch design.

### FLOOR-02 sequencing
- **D-06 (navigator-adopted, 262-RESEARCH.md Open Question 4):** Decouple FLOOR-02 from
  FLOOR-01's exit code. The original SWEEP-02 framing gated the fixture inversion on the floor
  gate exiting 0; research found no technical coupling (the fixture is hermetic, never contacts
  the Brain). Ship FLOOR-02 in this phase regardless of FLOOR-01's disposition -- the milestone
  gets a real, shippable, fully-green win now rather than holding it hostage to a graph-state
  requirement it does not depend on.

### Cheap unblock probe for downstream phases
- **D-07 (navigator-adopted, 262-RESEARCH.md Open Question 3):** Include a cheap probe (does the
  orchestration projection surface any `<SEP>`-corrupted node?) to determine whether Phases 254
  and 255 actually need 28/28 clean, or whether 20/28-plus-a-known-gap-list already unblocks
  them. Measure, don't assume -- this may unblock 254/255 independently of FLOOR-01's full
  closure, and the answer belongs in the gap ledger either way.

### Claude's Discretion
- Exact gap-ledger file format/location (a new `262-GAP-LEDGER.md`, a table inside
  `262-VERIFICATION.md`, or a REQUIREMENTS.md annotation) -- no navigator ruling on the container,
  only on its required contents (row, root cause, owner, write-dependency, dated evidence).
- Whether the Pyramid Principle retarget-vs-enrich ruling is decided inline in this phase's plan
  (research called it "a one-row, well-understood ruling") or simply surfaced as a card with both
  competing 261-08 rulings intact and left for the Brain-repo work order to carry -- default to
  the latter (surface, don't decide) since this phase does not own Brain-repo content decisions
  per D-02's own routing rule.
- Whether the `unrecognized_shape` VOID tripwire test lives as a new `tests/test-262-*.cjs` file
  or is folded into the existing `tests/test-259-floor-void.cjs` VOID-precedence suite --
  262-RESEARCH.md's Validation Architecture section names a Wave 0 gap for this; follow its own
  recommended shape.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's own research
- `.planning/phases/262-floor-green-sweep-02-inversion/262-RESEARCH.md` -- 1200+ lines, HIGH
  confidence, every load-bearing number measured live this session. Read in full, not skimmed --
  the "Root Cause 1", "Root Cause 2", "FLOOR-02", "The Theo Flip", "Architecture Patterns",
  "Common Pitfalls", "Validation Architecture" and "Security Domain" sections are all directly
  load-bearing for planning, not background color.

### Cross-repo, read-only (do not edit from this repo -- Pitfall 6)
- `/home/jsagi/dev/ProblemsWorthSolving-Brain/.planning/todos/pending/2026-09-02-fix-pattern-type-readiness-shortfall-on-existing-frameworks.md`
  -- the pattern_type gap, already filed there, explicitly out of that repo's own Phase 5 scope.
- `/home/jsagi/Theo/src/mcp/content/normalize-framework-name.ts` -- the `ALIAS_FORK` reference
  shape D-05 cites.
- `/home/jsagi/Theo/.planning/phases/09-brain-contract-cutover/09-MOS-LEARNING.md` (or the
  phase's own summary set) -- the Theo-side cutover-tool fate table 262-RESEARCH.md's Theo Flip
  section is grounded in.

### Repo conventions
- `CLAUDE.md` -- WORKSPACE GUARD, Canon Compliance Core (Part 8 graph boundary is directly
  relevant: every Brain probe this phase's tests run must send generic framework-name handles
  only, never room content), the new Theo standing-consult bullet under "Consult ALL Relevant
  Grounding Sources."
- `.planning/REQUIREMENTS.md` FLOOR-01/02/03 rows.

</canonical_refs>

<specifics>
## Specific Ideas

- The eight MISS rows and their per-dimension root causes are already fully tabulated in
  262-RESEARCH.md ("The eight MISS rows, with per-dimension root cause") -- the plan should cite
  that table by reference rather than re-deriving it.
- `data/flagship-floor-set.json` is the ratified 28-name denominator; a Wave 0 test should assert
  it still matches the live frontmatter scan 1:1 AND that it was not narrowed (`frameworks.length
  === 28`, `ratified_at` pinned) -- named explicitly in 262-RESEARCH.md's Validation Architecture
  as a genuine gap (no such test exists yet).
- FLOOR-02's complete file set and the "do NOT change the wire string" trap are both already
  enumerated in 262-RESEARCH.md's "FLOOR-02" section -- reuse verbatim, do not re-discover.

</specifics>

<deferred>
## Deferred Ideas

- Adapting `check-flagship-floor.cjs`'s response readers to Theo's actual shape -- explicitly
  deferred to flip-day work by D-04, once `theo-mcp.onrender.com` serves traffic and the shape
  can be exercised for real.
- The unowned `pattern_type` write-path defect's own root-cause pass -- research recommends this
  needs its own Brain-repo phase, not absorption into 262 (D-02).
- A dedicated ROADMAP.md annotation pass naming the new Theo standing-consult rule across every
  other pending phase (254, 255, 257, 263, 267.2, 268, 275) -- navigator-selected as a separate
  action this same session, tracked outside this phase's own plan.

</deferred>

---

*Phase: 262-floor-green-sweep-02-inversion*
*Context gathered: 2026-09-02*
