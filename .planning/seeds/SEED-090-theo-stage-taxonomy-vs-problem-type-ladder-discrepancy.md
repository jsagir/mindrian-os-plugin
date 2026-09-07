---
id: SEED-090
status: dormant
planted: 2026-09-07
planted_during: rethinking-mindrianos Data Room session (standing MindrianOS-dev consultant room), surfaced while auditing the room's own "remote graph + MCP tooling" investigation trail
trigger_when: "when a phase proposes using either taxonomy (Theo's InnovationStage 5-zone ladder, or the Un-Defined/Ill-Defined/Wicked/Well-Defined/Combining-Tools problem-type ladder) as the canonical shape for a per-section/contract template (the gap SEED-076 named), or when any canon-facing doc needs to cite venture-stage vocabulary and must pick one"
scope: small
---

# SEED-090: Two incompatible 5-stage taxonomies live in the graph side by side, never reconciled or ruled distinct

## Why This Matters

Found live, not assumed: `research/2026-08-27-icm-semantic-substrate/2026-08-27-icm-semantic-substrate.md`
in the `rethinking-mindrianos` Data Room ran `MATCH (s:InnovationStage) RETURN s.name, s.order,
s.description` directly against the Brain graph (via `theo_neighborhood`) and got back a 5-stage
venture-progress ladder:

Problem Exploration ("Discovery Zone") -> Problem Framing and Refinement ("Focus Zone") ->
Problem Validation ("Proof Zone") -> Solution Hypothesis and Testing ("Creation Zone") -> Business
Case and Strategic Framing ("Launch Zone").

This does **not** match the Un-Defined / Ill-Defined / Wicked / Well-Defined / Combining-Tools
problem-type ladder that this repo's own "PWS 22-task workbook" material (personal-memory
reference, and other internal docs) uses for what is nominally the same progression -- classifying
a venture's problem so the right methodology gets recommended. Two different 5-stage vocabularies,
same conceptual territory, never cross-checked against each other.

The 2026-08-28 addendum to that research entry flagged it explicitly: "worth a citation-check
(superseded vs. current, or two distinct axes -- problem-type ladder vs. venture-progress zone)
before either becomes the canonical shape for a contract template" -- and then nothing happened.
No seed was ever registered. It sat as prose in a research addendum for ten days, exactly the
kind of finding this repo's own ratification-gap lesson (see `rethinking-mindrianos/research/
2026-07-05-reverse-salient-ratification-gap/`) says is the actual failure mode to watch for: a
real finding that reaches a verdict-shaped observation and then has no mechanism converting it
into tracked work.

**Two live candidate resolutions, deliberately not chosen here:**
1. **Superseded/distinct-vintage.** One taxonomy is an earlier draft the other replaced, and only
   citation hygiene is needed (point every reference at the current one).
2. **Two genuinely distinct axes.** The problem-type ladder classifies the QUESTION (what kind of
   problem is this, which drives which framework applies) while the InnovationStage ladder tracks
   VENTURE PROGRESS (where is this specific venture right now) -- related but orthogonal, and both
   should stay, clearly labeled as answering different questions.

Do not assume either resolution without checking `s.description` on each `InnovationStage` node,
the PWS workbook material's own definitions, and whether both are cited anywhere they'd collide
(a canon-facing doc, a contract template, a stage-taxonomy ruling like Phase 275's).

## When to Surface

**Trigger:** when a phase proposes using either taxonomy as the canonical shape for a per-section/
contract template (the SEED-076 gap), or when a canon-facing doc needs to cite venture-stage
vocabulary and the two ladders would otherwise silently collide. Also worth a look alongside any
future Theo-side stage-taxonomy or InnovationStage schema work, since that is the authoritative
source for one of the two ladders.

## Scope Estimate

**Small.** A citation-check / reconciliation-or-distinction ruling, not a rebuild -- read both
taxonomies' own definitions side by side, rule superseded-vs-distinct, and if distinct, document
the axis each one actually answers so a future citation picks the right one on purpose instead of
by accident.

## Breadcrumbs

- `rethinking-mindrianos/research/2026-08-27-icm-semantic-substrate/2026-08-27-icm-semantic-substrate.md`
  (main entry: the three-layer architecture read; ICM/local-graph/Brain boundary already-shipped
  findings) and its 2026-08-28 addendum (the actual discrepancy, item 2, plus the Feynman-Minto
  Theo-grounding finding it was filed alongside)
- Cross-link: `.planning/seeds/SEED-075-icm-semantic-substrate-provenance-dependency-graph.md`
  (SEED-075, the sibling seed the same research session produced, folded same day)
- Cross-link: `.planning/seeds/SEED-076-room-as-graphrag-conversational-component.md` and
  `SEED-076-room-walk-test-and-pattern-confirmation-threshold.md` (the missing per-section
  contract-template gap this discrepancy would feed into if either taxonomy is adopted as its shape)
- Cross-link: `research/2026-09-02-venture-stage-taxonomy-axes-ruling-275/` in the same Data Room
  (Phase 275's own stage-taxonomy-axes ruling -- check whether it already touches this discrepancy
  or is itself exposed to it)
- Per this repo's standing Dev-Research Compositing rule (`CLAUDE.md`), the room-side copy of this
  finding already exists at the research entry above; this seed is the dev-repo-side half of the
  same finding, so the pair is complete in both homes.

## Notes

Planted from a Larry session in the `rethinking-mindrianos` Data Room, at the navigator's explicit
insistence: "if anything we need to make it a next phase, I don't trust me[self] to remember to do
it later." Filed as a SEED rather than force-promoted straight to a phase, because unlike the
sibling thread checked in the same session (SEED-082, correctly `dormant` pending its own trigger),
this discrepancy had **no registration at all** -- the gap being closed here is "informal note ->
tracked backlog item," not "seed -> phase." Promotion to an actual phase should wait for the
trigger condition above, the same discipline SEED-082 already applies, so this doesn't repeat the
"too fast, unchecked" failure this repo's own ratification-gap research already caught once
(SEED-038 -> Phase 188 without its dependency checked).
