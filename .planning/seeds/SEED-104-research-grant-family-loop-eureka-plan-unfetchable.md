---
id: SEED-104
status: dormant
priority: CRITICAL
planted: 2026-10-02
planted_during: Phase 366 (executing; stopped_at 366-04)
trigger_when: before Phase 366 closes - it blocks 366's own deliverable (the Eureka perspective in the research planner cannot fetch)
scope: small-medium (one family-derivation fix + term sanitization + one end-to-end test; egress-guard false block is a separate small fix)
related: SEED-103 (promoted to Phase 366), SEED-097 (promoted to Phase 363), SEED-019
---

# SEED-104: Research grant family loop - a Eureka plan can never fetch

## What happened (observed 2026-10-02, live on beta.53)

Room `egain-des-liquid-conductor`, run `rp-2026-10-01-1bd61cf3`, grant `g-c922a05a`.

1. `research_run op=eureka_recall` built a quick plan whose queries use family
   **`concept-evidence/v1`** (template ids `eureka`, `ce.counter`, `ce.pair`).
2. `research_run op=grant_request` minted a standing grant scoped to families
   **`["whitespace-gap/v1"]`** only.
3. `run_quick` returned `status: reask`, `reason: outside_family`, `new_terms: []`.
4. `gate_answer approve` re-issued the same whitespace-gap grant (version 1 -> 2).
   `run_quick` reasked again. **Infinite loop**: every approval mints a grant that
   can never cover the plan. The navigator approved three times before the loop was
   diagnosed.

## Root cause

`lib/core/research-planner/grants.cjs:49-52` - decision D-04 ("first scope: a standing
grant covers openalex and whitespace-gap/v1 only") was correct for Phase 363, when only
whitespace runs started from the room. Phase 366 moved the Eureka perspective into the
research planner, and its plans emit `concept-evidence/v1`, but the grant scope was never
widened or derived from the plan. `grant_request` does not read the families in the plan
it is approving.

## Second defect: raw room prose stored as search terms

The grant's `approved_terms` are truncated room claim text with markdown intact, e.g.
`"**Claim.** A stable, flowable emulsion of eutectic gallium-indium EGaIn"` and
`"1. **Tension in the field.** Liquid-metal com..."`. These are junk queries and a
Canon Part 8 egress-shape risk (room prose shaped as outbound strings). Nothing was sent
because the run halted at `outside_family` first; once the family loop is fixed, these
terms **would** go out. Fix both together, never the loop alone.

## Third defect: CLI surface

On the CLI the grant card surfaced as an MCP elicitation dialog that showed
`"Research grant: Approve this research grant?: not set"`, alongside the
AskUserQuestion card: two cards for one decision, one of them unusable.

## Same session, separate: egress guard false-blocks Theo

`scripts/part8-egress-guard-hook.cjs` blocked **every** `mcp__theo__brain_ask` call,
including plain generic methodology words ("hypothesis test validate assumption",
reason `freeform_unmatched`) and op-mode `framework_chain_slice` calls carrying only
framework names and `/mos:` slugs (reason `unknown`). Other Theo tools
(`feeds_into_chains`, `recommend_chain`) passed. Theo book search is unreachable from the
CLI. Likely belongs with SEED-019; split out if it does not ride this phase.

## Fix shape

1. `grant_request` derives `families` from the plan being run (the union of the plan's
   query families), bounded by an allow-list; never a hard-coded family.
2. Approved terms come from the composer only: abstracted, markdown-stripped, length-
   capped. Raw claim text is never a term. Add an egress-audit assertion on the terms.
3. On the CLI, render the grant card once (AskUserQuestion), not also as an elicitation.
4. **Regression test:** `eureka_recall -> grant_request -> gate_answer approve ->
   run_quick` reaches `status: done` (or an honest provider status), never a second
   `reask` for the same family.
5. Loop guard: if a re-approval produces an identical grant scope and the same reask
   reason, return a typed error (`grant_scope_cannot_cover_plan`) instead of the card.

## Navigator note

Mid-turn the navigator sent `whitespace-gap/v1` with no further text. Ambiguous between
"run this under whitespace-gap/v1 since the grant covers it" and pointing at the culprit
family; asked back, not acted on.

## Breadcrumbs

- `lib/core/research-planner/grants.cjs:9,49-52` (D-04 scope)
- `lib/core/research-planner/question-templates.cjs:37,42` (FAMILY_IDS, WS constant)
- `lib/mcp/tools/research.cjs` (research_run ops: eureka_recall, grant_request, run_quick)
- `lib/mcp/tool-router.cjs`
- `scripts/part8-egress-guard-hook.cjs`, `lib/core/part8-egress-guard.cjs`
- Room evidence: `~/MindrianRooms/egain-des-liquid-conductor/.mindrian/research-grants.json`,
  `.mindrian/research-runs/rp-2026-10-01-1bd61cf3/plan.json`

## Update 2026-10-02 (same session, after planting)

- **Workaround confirmed.** A whitespace question set built with `ambient.whitespaceQuestionSet`
  (family `whitespace-gap/v1`) planned, got its new-term grant (grant `g-c922a05a` v3) and ran to
  `status: done` (run `rp-2026-10-01-c14921e5`). So the loop is specific to non-whitespace families,
  which confirms the root cause.
- **The room-started path hits it too, on its own.** The room's ambient producer queued
  `rp-2026-10-01-b2743104` as a `plan_card_no_grant` card with `reask_reason: outside_family`. So
  this isn't only a manual-run bug: every ambient Eureka offer reaches the navigator as an
  approval that can never work.
- **New defect: room-only extraction check gives a false negative.** Leaf L3
  (`ws:extraction_failure`, `corpus: room`) reported "0 room artifacts already mention the zone",
  while `opportunity-bank/gap-oxide-stability-in-chcl-des.md` names that exact zone (Ga2O3 skin
  stability in choline chloride DES). It looks like exact-phrase matching on a seven-word term.
  The check is supposed to stop the room from paying for research it already holds.
- **Exact-phrase search on a long term gives a meaningless zero.** The 7-word term returned an
  OpenAlex exact-phrase count of 0 and verdict `thin`, but a plain web search the same hour found
  Ga electrodeposition from ChCl DES (Reline, ChCl-EG) and oxide solubility in ChCl DES. The
  whitespace composer should split long zone terms or add an unquoted keyword pass, or "0" will
  read as "gap confirmed".

## Update 2026-10-02: the elicitation card can't be approved (navigator screenshot)

The navigator: "this can't be approved, keeps looping... it's endless, not a good card."
What the CLI shows for every `grant_request`: an MCP elicitation, "Research grant: Approve
this research grant?: ▸ not set / This field is required", with Accept and Decline below it.
- **No default value.** The `requestedSchema` `choice` enum has no `default`, even though
  `approve_standing` is marked recommended, so Accept is dead until the user finds
  "→ to expand". Nothing on screen says the field has to be opened first.
- **It fires on every `grant_request` call** (the gate ladder picks the `elicitation` rung on the
  CLI), even when the same decision is also being taken through AskUserQuestion and `gate_answer`.
  Combined with the family loop, the navigator sees the same unapprovable dialog over and over.
- **Fix:** on the CLI, prefer the AskUserQuestion rung and never also elicit for the same gate;
  if elicitation is kept anywhere, set `default` to the recommended option and title the field
  as an instruction ("Choose: approve standing / this run / not now").
