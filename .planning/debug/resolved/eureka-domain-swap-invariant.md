---
status: resolved
kind: rca
trigger: "eureka-domain-swap-invariant"
created: 2026-07-17T00:10:00Z
updated: 2026-07-17T11:40:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** dev repo `~/dev/MindrianOS-Plugin` HEAD (v1.15.3-beta.27), same session as the
  219-live-checkpoint-two-structural-gaps upstream-metadata fix (commits `4f1cd3ba`, `c74953f1`, `3b92121c`),
  which this finding is downstream of and distinct from.
- **WIRE claims probe against:** n/a. Local only, zero Brain/network calls (Canon Part 8).
- **Date of audit:** 2026-07-17
- **Re-verification rule:** the live run below is reproducible directly: `node scripts/eureka-command.cjs
  ~/MindrianRooms/iia-deeptech-centers run`.

## Current Focus

status: FIX APPLIED + LIVE-VERIFIED ON BOTH ROOMS + REGRESSION-CLEAN. Resolved.

The additive EITHER-endpoint Section exclusion shipped at the step-4b insertion point
(scripts/eureka-portfolio-report.cjs). Live re-verification confirms the fix exactly as predicted;
the aion no-op is proven by real output comparison, not asserted from the node-count fact; the
regression delta is provably zero. See the Resolution block below.

next_action: none. Commit the fix, move this file to resolved/, append the knowledge-base entry.

hypothesis (CONFIRMED): The Eureka candidate-pair GENERATION layer in
scripts/eureka-portfolio-report.cjs admits `Section` container nodes (the room's own top-level
folder nodes) as legitimate pairing endpoints alongside real content nodes. The step-4b
both-scaffold exclusion (260715-0nj) only filters pairs whose BOTH endpoints are in
`SCAFFOLD_NODE_TYPES = {memory_artifact, Artifact}`; `Section` is NOT in that set, so every
Section-involving pair survives generation, gets scored, and consumes ranked-list slots. A real
content node filed inside a section (an Artifact with props.section=problem-definition) gets
paired against that SAME section's own container node (the Section node whose bare source_path
slug is also problem-definition), producing the self-referential "problem-definition x
problem-definition" statement the critic correctly rejects as `domain_swap_invariant`.

test (DONE, direct evidence -- see Evidence block below): Read the real code paths + probed the
live room.db LOCAL/read-only (Part 8 clean). Did NOT re-run the full 16005-pair scan; instead
replicated the exact node-load + cross-boundary enumeration deterministically, which reproduces
the candidate set to within 0.6% of the live 16005 figure and contains the exact rank-1
degenerate pair.

reasoning_checkpoint:
  hypothesis: "Section container nodes enter `indexed` (they carry nodeText = props.name) and are
    admitted as pairing endpoints because the ONLY generation-layer type filter (step 4b) excludes
    pairs only when BOTH endpoints are memory_artifact/Artifact -- `Section` is absent from
    SCAFFOLD_NODE_TYPES, so nothing upstream of the correct critic drops them."
  confirming_evidence:
    - "room.db has exactly 3 node types: WhitespaceZone:156, Artifact:15, Section:9. The five
      folder names in the symptom (problem-definition/solution-design/business-model/
      market-analysis/competitive-analysis) are all type=Section, props {name,label}."
    - "tri-modal-index.cjs::nodeText returns props.name for a Section node -> 'problem-definition'
      is non-empty -> the node IS embedded and DOES enter `indexed` (eureka-portfolio-report.cjs
      L900-916)."
    - "The cross-boundary enumeration (L964-972 full / L999-1007 room) skips a pair ONLY when
      a.root===b.root AND a.type===b.type. Artifact vs Section differ in type, so the
      self-referential pair is NOT skipped."
    - "Step-4b (L1028-1041) excludes only when BOTH na.type and nb.type are in SCAFFOLD_NODE_TYPES
      (L1398 = {memory_artifact, Artifact}). Section is not a member -> Section pairs survive."
    - "Deterministic replication of the enumeration over all 180 nodes = 16099 pairs (live=16005,
      0.6% delta); 1575 involve a Section (135 Artifact x Section, 36 Section x Section, ~1404
      WhitespaceZone x Section). The exact rank-1 pair
      (Artifact problem-definition/software-barrier-collapse) x (Section problem-definition),
      both root=problem-definition, IS present in the candidate set."
  falsification_test: "If Section nodes did NOT enter `indexed` (no nodeText) OR if step-4b already
    excluded them, the candidate set would contain 0 Section-involving pairs and the critic would
    have nothing tagged domain_swap_invariant. Both are false -> hypothesis holds."
  fix_rationale: "The critic is correct and stays untouched (Reuse-Before-Build). The 216-04 fix
    already stopped row.type leaking the literal 'Section x Section' into prose but never stopped
    Section nodes being PAIRED -- so the degenerate class persisted with the slug label. The root
    cause is the missing generation-layer exclusion, so the fix is an additive node-type exclusion
    at the SAME step-4b insertion point, keyed on Section (container) instead of scaffold -- exactly
    the shape 260715-0nj established, not a second mechanism."
  blind_spots: "Did not re-run the full live scan post-fix yet (that is the gate, held for after
    approval). Secondary: Section nodes also sit in the scaffoldCohort percentile population
    (L945-958) and mildly skew other nodes' percentile ranks; that is a separate, non-blocking
    scoring-population concern, out of scope for this pair-exclusion fix (flagged, not fixed)."

next_action: STOP. Present root cause + scoped fix direction to navigator. Do NOT edit code until
the fix direction is approved (mode: checkpoint_before_fix). On approval: apply the additive
step-4b Section exclusion + honest counter + provenance line, then live re-verify on
iia-deeptech-centers (degenerate class gone from top-25) AND aion-eureka-synergy (0 Section nodes
-> byte-identical, no regression).

## Evidence (traced 2026-07-17, LOCAL read-only, Part 8 clean)

- **checked:** `SELECT type, COUNT(*) FROM nodes` on
  ~/MindrianRooms/iia-deeptech-centers/.mindrian/room.db.
  **found:** WhitespaceZone:156, Artifact:15, Section:9 (180 total). The symptom's five folder
  names are all `type=Section` with props `{"name":"<slug>","label":"<LABEL>"}` (e.g.
  `problem-definition`, props `{"name":"problem-definition","label":"PROBLEM DEFINITION"}`).
  **implication:** section-container nodes are a first-class node type (`Section`), distinct from
  content (`Artifact`) and hypotheses (`WhitespaceZone`).

- **checked:** `lib/core/eureka/tri-modal-index.cjs::nodeText` (L138-167).
  **found:** core text priority is `props.name || props.text || props.title || ...`; a Section node
  returns its `props.name` slug (`'problem-definition'`), which is non-empty.
  **implication:** Section nodes produce nodeText -> get embedded -> enter `indexed`
  (eureka-portfolio-report.cjs L900-916), exactly like content nodes. The stale persisted
  eureka_vec table has only 1 row (a prior partial run); a live `run` re-embeds all 180 nodes.

- **checked:** the pair enumeration + step-4b filter in `scripts/eureka-portfolio-report.cjs`
  (L960-1041) and `SCAFFOLD_NODE_TYPES` (L1398).
  **found:** enumeration skips a pair ONLY when `a.root===b.root && a.type===b.type`; step-4b
  excludes ONLY when BOTH endpoints are in `SCAFFOLD_NODE_TYPES = {memory_artifact, Artifact}`.
  `Section` is in neither guard.
  **implication:** an Artifact-vs-Section (or WhitespaceZone-vs-Section, or Section-vs-Section)
  pair passes both guards and reaches scoring. This is the confirmed root-cause line.

- **checked:** deterministic replication of node-load + cross-boundary enumeration over all 180
  nodes (scratchpad probe5.cjs).
  **found:** 16099 candidate pairs (live run = 16005, 0.6% delta from parent-derivation / room-mode
  CONVERGES-union nuance). 1575 involve a Section (135 Artifact x Section, 36 Section x Section,
  ~1404 WhitespaceZone x Section) = ~9.8% of the candidate set. The exact rank-1 pair
  `(Artifact) problem-definition/software-barrier-collapse` x `(Section) problem-definition`,
  both `root=problem-definition`, IS present (types differ, so the same-root-same-type skip does
  not fire).
  **implication:** ~9.8% of ranked-list capacity is consumed by degenerate Section pairs the
  critic then rejects as `domain_swap_invariant` -- displacing real content-vs-content candidates.

- **checked:** `lib/core/eureka/room-native-substrate.cjs::sectionFor` + its HARD-RULE comment
  (L116-152).
  **found:** a prior fix (216-04, navigator verdict 2026-07-10) stopped `row.type` leaking the
  literal `'Section x Section'` into prose; `sectionFor` now derives the slug from `props.section`
  else the bare `source_path` first segment. A pre-162 Section node (`source_path='problem-definition'`,
  no ':') derives section = `'problem-definition'` -- the SAME slug as an Artifact filed there.
  **implication:** 216-04 cleaned the LABEL but never stopped the PAIRING; that is why the statement
  reads `problem-definition x problem-definition` (slug) rather than `Section x Section` (type). The
  root cause is upstream of both the label-derivation AND the (correct) critic -- it is the
  generation-layer admission of Section nodes.

- **checked:** regression room `~/MindrianRooms/aion-eureka-synergy/.mindrian/room.db` node types.
  **found:** memory_event:515, claim:83, company:46, memory_artifact:39, governing_thought:10,
  navigator_persona:1. **ZERO Section nodes** (newer typed schema).
  **implication:** a Section-keyed exclusion is a provable NO-OP on aion-eureka-synergy (byte-
  identical output) -- the "no Section nodes -> unchanged" regression guard, mirroring the Phase-218
  "no entity nodes -> unchanged" guard. Seam 3 only surfaces on older-schema rooms like
  iia-deeptech-centers where top-level folders were materialized as `Section` nodes.

## Root Cause (CONFIRMED)

**File:** `scripts/eureka-portfolio-report.cjs`
**Lines:** the step-4b candidate-pair exclusion (L1028-1041) + `SCAFFOLD_NODE_TYPES` (L1398),
against the pair enumeration (L960-1014).

The candidate-pair generation layer embeds and admits `Section` container nodes (the room's own
top-level folder nodes) as pairing endpoints. The only generation-layer node-type filter is the
260715-0nj both-scaffold exclusion, which fires only when BOTH endpoints are `memory_artifact` or
`Artifact`. `Section` is absent from that set, so every Section-involving pair -- including a
content node paired against its OWN containing section -- survives generation, is scored, and
occupies ranked-list slots. The critic (`domain_swap_invariant`) catches these correctly but only
after they have displaced real candidates. Nothing upstream of the critic uses the same signal to
exclude them at generation.

## Proposed Fix Direction (NOT applied -- awaiting navigator approval)

Extend the EXISTING 260715-0nj exclusion at the SAME step-4b insertion point, keyed on a new
node-type check (`Section` container), additive -- no second mechanism, no critic change:

1. Add a frozen set next to `SCAFFOLD_NODE_TYPES` (L1398):
   `const CONTAINER_NODE_TYPES = Object.freeze(new Set(['Section']));`
2. In the step-4b filter loop (L1028-1041), add an additive branch BEFORE the both-scaffold check:
   if EITHER endpoint's type is in `CONTAINER_NODE_TYPES`, `continue` and increment a separate,
   honest `containerPairsExcluded` counter.
3. Surface `container_pairs_excluded` in the provenance block (near L1237) and the report table
   (near L469), never a silent suppression -- exactly how `scaffold_pairs_excluded` is surfaced.

**Scope difference from the precedent, and why it is deliberate (not an inconsistency):** the
scaffold rule excludes only BOTH-scaffold pairs because a single `Artifact` endpoint IS a
legitimate content node (a filed insight with title+body). A `Section` node is categorically NOT
content -- it is the folder itself, whose only text is the folder slug -- so it is never a valid
opportunity endpoint on EITHER side. Hence EITHER-endpoint exclusion for containers vs BOTH-endpoint
for scaffold.

**Rejected alternative:** excluding only self-referential same-root pairs (content vs its own
section). Rejected because it leaves cross-section container pairs (Section problem-definition x
Section market-analysis, or Section x an Artifact in another section) in the set -- still degenerate
folder-label pairings the critic must reject. Node-type exclusion removes the whole class and
matches the precedent's node-type-membership approach.

**Predicted effect (from the deterministic replication):** iia-deeptech-centers drops all 1575
Section-involving pairs (~9.8% of the candidate set), freeing those ranked-list slots for real
content-vs-content candidates; aion-eureka-synergy unchanged (0 Section nodes).

**Gates cleared by this direction:** Part 8 (pure in-memory node-type predicate over already-loaded
rows, zero egress). Part 7 Reuse-Before-Build (extends 260715-0nj at its own insertion point, adds
no mechanism, does not touch the correct critic). No em-dashes.

**Secondary observation (out of scope, flagged not fixed):** Section nodes also fall into the
`scaffoldCohort` percentile population (L945-958) and mildly skew other nodes' percentile ranks.
That is a scoring-population concern separate from this pair-exclusion fix; note for a possible
follow-up, do not fold into this scoped change.

## Resolution (APPLIED + VERIFIED 2026-07-17)

root_cause: The candidate-pair generation layer in scripts/eureka-portfolio-report.cjs admitted
  `Section` container nodes (the room's own top-level folder nodes) as pairing endpoints. The only
  generation-layer node-type filter was the 260715-0nj both-scaffold exclusion (fires only when BOTH
  endpoints are memory_artifact/Artifact); `Section` was absent from that set, so every
  Section-involving pair - including a content node paired against its OWN containing section -
  survived generation, was scored, and occupied ranked-list slots the critic then rejected as
  domain_swap_invariant.

fix: Extended the EXISTING 260715-0nj exclusion at the SAME step-4b insertion point (Reuse-Before-
  Build, Part 7), keyed on a new frozen `CONTAINER_NODE_TYPES = {Section}` set. Additive
  EITHER-endpoint branch (checked before the both-scaffold check): if either endpoint is a Section
  node, skip the pair and increment an honest `containerPairsExcluded` counter. EITHER-endpoint (vs
  the scaffold precedent's both-endpoint) is deliberate and comment-documented: a single Artifact
  carries real filed content so a one-Artifact pair is legitimate, but a Section is only a folder
  label, never a valid endpoint on either side. Surfaced `container_pairs_excluded` in the
  provenance object and the report table, mirroring `scaffold_pairs_excluded`. The critic was NOT
  touched (already correct). The percentile-population / scoreCohort concern (Section nodes also sit
  in the percentile cohort) was left explicitly out of scope, flagged for a separate look.

verification:
  - iia-deeptech-centers (has 9 Section nodes), live real encoder (MongoDB/mdbr-leaf-ir, sqlite-vec):
    container_pairs_excluded = 1575 (exactly the predicted ~1575). pairs_scored 16005 -> 14430
    (16005 - 1575 = 14430, exact). scaffold_pairs_excluded unchanged at 105 (no interaction, no
    double-count). Ranked top-25 Section-involving: 25/25 BEFORE -> 0/25 AFTER. The exact rank-1
    degenerate pair (Artifact problem-definition/software-barrier-collapse x Section
    problem-definition) is GONE.
  - WHAT NOW SURFACES at the top of iia (reported as-observed, not assumed): Artifact-vs-
    WhitespaceZone pairs. The container/domain_swap_invariant class is fully removed, but the new
    top is dominated by ONE real content artifact repeated against many `ns-*` WhitespaceZone
    hypothesis nodes at an IDENTICAL AHP score (ranks 1-13 all score 0.5235, identical dims
    strategic_fit 0.25 / validated_demand 0.9204 / feasibility 0.4), because the composite is driven
    by the artifact's own percentile rank and the WhitespaceZone partners are interchangeable.
    This is a DISTINCT, milder, SEPARATE pattern (WhitespaceZone is 156 of 180 nodes = 87 percent of
    the room and dominates the candidate pool; the AHP composite does not differentiate among
    equal-dimension whitespace partners). NOT the same bug, NOT in this fix's scope. Flagged below.
  - aion-eureka-synergy (0 Section nodes): TRUE no-op proven by real output comparison, not the
    node-count fact. Ran twice pre-fix -> byte-identical json+md (determinism control). Post-fix
    diff vs that baseline: the ONLY delta is the new `"container_pairs_excluded": 0` provenance field
    (json) and its one report-table row (md). All 2783 scored pairs, the ranked list,
    scaffold_pairs_excluded=741, tail, and statements are byte-identical.
  - Regression: ZERO new failures, proven by git-stash A/B. The step-4b precedent test
    (test-218-scaffold-pair-filter.cjs) passes 2/2 legs (scaffold behavior intact, one-side pairs
    still survive). run-all-215 (8/0) and run-all-226 (10/0) fully green. run-all-216 (3 fail),
    run-all-218 (3 fail), run-all-219 (2 fail) fail with a BYTE-IDENTICAL failure set pre-fix and
    post-fix - all pre-existing, unrelated (edges table has no `review_status` column = schema drift
    in the edge-writer; offline `encoder_unavailable` degrade in the test env; 216 shape/help/skill
    lint gates) and in code paths this change never touches.
  - Gates: Part 8 zero egress (pure in-memory node-type predicate over already-loaded rows, all
    reads local, no Brain/network). Part 7 Reuse-Before-Build (extended 260715-0nj, no second
    mechanism, critic untouched). No em-dashes (code, comments, this file, commit message).

files_changed:
  - scripts/eureka-portfolio-report.cjs: added CONTAINER_NODE_TYPES frozen set next to
    SCAFFOLD_NODE_TYPES; added the additive EITHER-endpoint container branch + containerPairsExcluded
    counter in the step-4b loop; surfaced container_pairs_excluded in the provenance object and the
    report table; updated the step-4b header comment to describe both exclusion classes.

follow_ups_flagged_not_fixed:
  - WhitespaceZone-dominated pairing with non-differentiating AHP scores (surfaced by this fix on
    iia; one strong artifact ranks identically against every whitespace partner). Separate concern.
  - Section nodes also sit in the scaffoldCohort percentile population (L945-958), mildly skewing
    other nodes' percentile ranks. Out of scope per the approved fix spec; separate future look.
  - A mirroring `container-pair-filter` regression test (the sibling of test-218-scaffold-pair-
    filter.cjs) would pin this exclusion in CI. Not added here to stay within the approved scope;
    recommended as an explicitly-approved fast follow.

## Meta

- **What the navigator was doing:** ran the just-fixed Eureka engine (Seam-2 statement-metadata
  fix, this same session) against a SECOND real room chosen deliberately for genuine cross-domain
  breadth (iia-deeptech-centers: IIA Deeptech University Centers Partnership, 67 room entries,
  16005 pairs scored -- a partnership spanning multiple named university tech centers, picked
  specifically because a single-domain room like aion-eureka-synergy wouldn't stress-test ranking
  quality the same way) to confirm the fix generalizes beyond the room it was built against.
- **Room:** `~/MindrianRooms/iia-deeptech-centers` (real navigator room, not a fixture).
- **Surfaces exercised:** `scripts/eureka-command.cjs run` (dev repo, real encoder, real critic).
- **Relationship to other open work:** downstream of and distinct from
  `.planning/debug/219-live-checkpoint-two-structural-gaps.md` (Seam 2, RESOLVED this session --
  killed the literal "unknown x unknown" text). This file is "Seam 3" in that same numbering
  convention: Seam 1 = extraction noise (aion-eureka-synergy, generic-noun/near-dup entities,
  tracked in feedback_eureka_engine_internal_reframe_priority.md, separate and still open). Seam 2
  = statement-metadata (RESOLVED). Seam 3 (this file) = candidate-generation admits
  section-container nodes.

## Purpose

Root-cause and (pending navigator approval at the fix-checkpoint, same protocol as Seam 2 tonight)
fix the candidate-pair generation layer admitting section-container nodes as pairing candidates,
so a real content node is never ranked against its own containing section.

## Gates before calling this done

- Live re-verify on iia-deeptech-centers AND aion-eureka-synergy (regression check -- must not
  reintroduce or interact badly with the Seam-2 fix or the 260715-0nj scaffold-pair exclusion).
- Part 8 boundary unchanged (LOCAL graph-read/generation logic only, zero egress).
- Reuse-before-build: extend the EXISTING 260715-0nj both-scaffold exclusion pattern at
  eureka-portfolio-report.cjs step 4b if the fix is generation-layer, per the hypothesis above --
  do not invent a second exclusion mechanism or touch the critic (it is already correct).

## Open items

- [x] Root cause traced (which layer, which file/line, confirmed not guessed) --
      scripts/eureka-portfolio-report.cjs step-4b L1028-1041 + SCAFFOLD_NODE_TYPES L1398; `Section`
      container nodes admitted as pairing endpoints; confirmed by direct room.db probe + enumeration
      replication (rank-1 degenerate pair present, 1575 Section pairs = ~9.8% of candidate set).
- [x] Fix direction proposed, checkpoint held for navigator approval before applying (same protocol
      as Seam 2) -- additive EITHER-endpoint `Section` exclusion at the same step-4b insertion point,
      honest `container_pairs_excluded` counter + provenance line.
- [x] Fix applied + tested + live-verified on both rooms (navigator-approved) -- container exclusion
      shipped at step-4b; iia container_pairs_excluded=1575, 16005->14430, ranked Section pairs
      25/25 -> 0/25; aion proven true no-op by output diff vs a determinism-controlled baseline;
      regression delta zero (git-stash A/B, byte-identical pre-existing failure set).
- [x] On full resolve: move this file to `.planning/debug/resolved/` + summary block in
      `.planning/debug/knowledge-base.md`
