---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 14
subsystem: research-planner
tags: [filing, f8-basket, run-home, evidence-claims, contradicts, opportunities, ratchet, reasoning-rollup, d-04, d-12, d-13]

requires:
  - phase: 363-05
    provides: Plan and RunResult schemas
  - phase: 363-06
    provides: opportunityCandidates, rollUp
  - phase: 363-07
    provides: nextVersion (the ratchet), loadSettled
  - phase: 363-09
    provides: audit ledger (sliceForRun)
  - phase: 363-11
    provides: hash-anchored rows, renderRowCitation
  - phase: 363-12
    provides: quick run state layout
  - phase: 363-13
    provides: deep run state layout, classifications, next_version
provides:
  - lib/core/research-planner/filing.cjs - buildBasket, basketCard, fileRun
  - tests/test-363-filing.cjs - 51 checks (FI1-FI13, module load, net guard)
affects: [363-15, 363-16, 363-17, 363-18, 363-19, 363-20]

tech-stack:
  added: []
  patterns:
    - "Nothing is written before an approved F.8 selection; a selection that carries any grant key is refused before the room is opened"
    - "Every write goes through an existing door; the module holds no SQL and no sqlite driver"
    - "The report object records what landed and what did not, with a reason, and is shown to the navigator as-is"

key-files:
  created:
    - lib/core/research-planner/filing.cjs
    - tests/test-363-filing.cjs
  modified: []

key-decisions:
  - "fileRun(roomDir, run, plan, selection, {db, now, approvedVia}) -> {ok:true, run_home:{rel, abs, report, node_id, slug}, report} | {ok:false, reason}. Refusal reasons: invalid_params, run_id_mismatch, no_approved_selection, grant_not_authority, no_items_selected, unknown_item, room_db_unavailable, run_home_failed. Refusals happen before room.db is opened (FI1 proves a byte-identical tree)."
  - "A selection object carrying any of grant, grant_id, grant_ref, lifetime, standing is refused even with approved:true (D-04: a grant authorizes fetching, never filing)."
  - "The run home is always filed with anything else (every node links to it: artifact_path, DERIVED_FROM, REJECTED_BECAUSE, the section INFORMS edge). If the selection omits it, it is added and the report says so."
  - "Basket partition: a supported or contradicted leaf gets a claim item; a contested leaf (leaf.status contested or listed in run.contradictions) gets a contradiction item that files both its SUPPORTS and CONTRADICTS edges; a limiter is offered only when a classification has at least one basis row that exists in run.rows (a limiter with no evidence stays an open question, the same rule nextVersion applies)."
  - "Edges run evidence claim -> leaf node, so findOpenQuestions (which hides a question that has an incoming SUPPORTS edge) lists only leaves without support; supported leaves are answered by design."
  - "Section link uses INFORMS from the run artifact node to section:<section> (MAPS_TO_SECTION is the grant-rubric criterion edge); the section node id follows the existing section: + name convention and the endpoint need not exist."
  - "Discarded paths become proposed decision nodes with a REJECTED_BECAUSE edge to the run artifact node (scalar reason and kind properties); the reason text also lives in plan.json ratchet.discarded, which is always written."
  - "Roll-up reads the section REASONING.md frontmatter, appends deduplicated confidence (high supported, medium contested, low contradicted) and verification.must_be_true entries, merges through mergeReasoningFrontmatter, validates with feynman-minto before and after, and restores the exact prior bytes if a new violation appears. A section with no REASONING.md is reported as not rolled up, never created. MINTO.md is never touched; the report says it regenerates on the next generator run."
  - "Quick RunResults cannot carry filed:true (validateRunResult run_quick_filed_true), so filing always writes .mindrian/research-runs/<run_id>/filing.json as the marker and flips run.json filed:true for deep runs only."

patterns-established:
  - "Funding signal goes through fileOpportunity only with funder and program; research candidates get writeOpportunityNode + linkOpportunityEvidence (DERIVED_FROM run artifact, SUPPORTS evidence) + an opportunity-bank card, and the run home ledger.json links forward"

requirements-completed: [DRP363-10, DRP363-11, DRP363-19]

duration: ~70min
completed: 2026-09-30
---

# Phase 363 Plan 14: Filing a research run, only on the F.8 yes Summary

**A finished research run now reaches the room only through a navigator-approved F.8 basket: a top-level run home, open-question leaves, proposed evidence with SUPPORTS and CONTRADICTS edges, held contradictions, proposed limiter claims, REJECTED_BECAUSE discards, opt-in opportunities and a guarded REASONING roll-up, all through the existing doors and none without a yes.**

## PLAN_BASE

`69a426674718800e3ddfe8e08c462fd90151b8cc` (HEAD when the plan started).

## Task commits

| Task | Commit | Files |
|------|--------|-------|
| 1 RED | c1acb4d54 | tests/test-363-filing.cjs (failing FI1-FI13, module load fails) |
| 2 GREEN | 5db4d244b | lib/core/research-planner/filing.cjs, tests/test-363-filing.cjs (FI4 and FI7 read edges from the evidence side, see Deviations) |

Both are ancestors of HEAD (`git merge-base --is-ancestor`).

## D-12 icm-architect consult (verbatim from the plan)

D-12 icm-architect consult (done during planning, 2026-09-29, applying the icm-architect skill's ten invariants to the run home): CONFIRMED top-level `research/<dated-slug>/` through `fileResearchArtifact`. Why: one folder, one job (one run per folder: plan, ledger slice, records index, rows, report); one home per fact (the opportunity card links to the run home and the run ledger links to the opportunity, never copies; settled constraints live once in the run's plan.json and are read by perspective.loadSettled); generated indexes are never hand-edited (MINTO.md left to its generator); every output is an edit surface (markdown and JSON); factory versus product (templates and the shape ledger are plugin factory, the run home is room product, and unfiled machine state stays in `.mindrian/research-runs/` until the navigator's yes); no speculative folders (the run home is created only on filing). Conditions: every folder carries ROOM.md identity (fileResearchArtifact's ensureDirIdentity does this); the run home is linked to the originating section with an INFORMS edge (or MAPS_TO_SECTION if that is the type navigation's edge allow-list offers for a section target) written through navigation.

Applied as confirmed: run home `research/<YYYY-MM-DD>-<question-stem>-<run hex8>/` with ROOM.md from `ensureDirIdentity` (FI2); settled constraints only in the run's plan.json ratchet, read back by `perspective.loadSettled` (FI2); MINTO.md bytes unchanged (FI9); unfiled state stays under `.mindrian/research-runs/` (FI1 proves no `research/` or `opportunity-bank/` folder appears before the yes); INFORMS from the run artifact node to `section:<section>` (FI10). MAPS_TO_SECTION exists in the allow-list but is the grant-rubric criterion-to-section edge, so INFORMS was used.

## What was built

### filing.cjs exports

- `buildBasket(run, plan)` returns items `{id, kind, label, default_on, ...}`: `run_home` (first, on), `claim:<leaf>` (on), `contradiction:<leaf>` (on), `limiter:<id>` kind `settled_limiter` (on), `opportunity:<index>` (OFF, carries `candidate_kind`; a funding signal without funder or program is not offered), `rollup` (on, only when the plan has a return section), `discard:<kind>:<id>` kind `discarded_path` (on).
- `basketCard(items)` returns shape `F.8` with three options ("File the selected items (Recommended)", "Choose items", "File nothing") and a body listing every item as on or off, plus `payload.item_ids` and `payload.defaults`.
- `fileRun(roomDir, run, plan, selection, {db, now, approvedVia})` never throws.

### Edge types used

| Edge | From -> To | Where |
|------|------------|-------|
| SUPPORTS | evidence claim -> leaf open question | claim and contradiction items |
| CONTRADICTS | evidence claim -> leaf open question | claim and contradiction items (held contradictions) |
| SOURCED_FROM | limiter claim -> evidence claim | written by writeReasoningNode for a limiter |
| REJECTED_BECAUSE | discarded-path decision node -> run artifact node | discarded_path items |
| DERIVED_FROM | opportunity node -> run artifact node | research opportunity |
| SUPPORTS | opportunity node -> evidence claim | linkOpportunityEvidence |
| INFORMS | run artifact node -> `section:<section>` | always, with the run home |

All edges carry scalar properties only and `review_status: 'proposed'`. No node or edge is confirmed anywhere.

### Opportunity-bank card path convention matched

`opportunity-ops.listOpportunities` reads flat `opportunity-bank/*.md` files (every `.md` except `STATE.md`) and parses frontmatter. Research cards follow it: `opportunity-bank/<YYYY-MM-DD>-research-<slug>-<index>.md` with frontmatter `methodology: research-opportunity`, `created`, `source: research-planner`, `opportunity_id` (the node id), `run_id`, `run_home`, `status: proposed`, and a body that names the run home path and links its report. A funding signal is filed by `fileOpportunity` as its own `<date>-<program-slug>.md` (status filed) with the run home named in `relevance_reasoning`. No ROOM.md is created in `opportunity-bank/` because `listOpportunities` would list it as an opportunity.

### Run home contents

`research/<slug>/`: `ROOM.md`, `<slug>.md` (governing question, updated pyramid, every leaf status with row citations, evidence rows with stripped quotes, held contradictions, limiters, unresolved branches, discarded paths), `plan.json` (the plan with the run's updated perspective and the merged ratchet: discarded plus settled for the selected limiters), `ledger.json` (this run's audit slice only, its q hashes, and `links` forward to the run node, leaf nodes, evidence claims, limiter nodes, discarded nodes, opportunities, section link and roll-up), `records.json` (ids, titles, content hashes; from the run state records when present, else from the rows), `rows.json`.

## Verification

- `node tests/test-363-filing.cjs`: PASS 51, FAIL 0 (FI1-FI13, module load, net guard zero attempts), exit 0.
- `grep -ciE "\b(INSERT INTO|UPDATE [a-z_]+ SET)\b" lib/core/research-planner/filing.cjs` prints 0; no em-dash or en-dash in either file (`grep -P` on U+2014 and U+2013 returns nothing).
- `node scripts/check-substrate.cjs` reports nothing for `lib/core/research-planner/`.
- `tests/run-all-363.sh` picks the test up through its existing `run_if` leg for `tests/test-363-filing.cjs`; see the note at the bottom for the aggregator result.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Literal dash characters materialized in source on write**
- **Found during:** Task 2 (FI13 static scan)
- **Issue:** the `noDash` regex escapes landed as literal en and em dash characters.
- **Fix:** restored to the unicode-escape form (backslash u2013, u2014, u2212) before commit.
- **Files modified:** lib/core/research-planner/filing.cjs
- **Commit:** 5db4d244b

**2. [Rule 1 - Bug] RED test read edges from the wrong end**
- **Found during:** Task 2 (FI4, FI7 failing with empty neighbor lists)
- **Issue:** `navigation.getNeighborhood` follows edges in their written direction, and the plan writes edges evidence -> leaf, so the leaf as focus has no neighbors. FI4 also called `findContradictions` with a leaf as focus, and FI7 asserted the run artifact node (an existing node kind) is unconfirmed rather than the new nodes.
- **Fix:** FI4 reads from the evidence claim side and calls `findContradictions` with the contradicting claim as focus; FI7 asserts the opportunity's evidence claim stays proposed. The assertions are the same contract (the edges exist with the right types and endpoints), not weaker.
- **Files modified:** tests/test-363-filing.cjs
- **Commit:** 5db4d244b

**3. [Rule 2 - Missing critical] Grant keys refused even alongside approved:true, run home always added**
- A selection carrying `grant`, `grant_id`, `grant_ref`, `lifetime` or `standing` is refused (T-363-11), and a selection that omits the run home gets it added with a note, because every other node links to it.

**4. [Scope note] DRP363-19 already checked**
- 363-13 marked DRP363-19 complete although its plan list also names 363-14, 363-18 and 363-19. Left as is; DRP363-10 and DRP363-11 are marked complete here (DRP363-10 names only this plan; DRP363-11 names 363-06, 363-12 and 363-14, all done).

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: listing-visibility | lib/core/research-planner/filing.cjs | Research opportunity cards sit flat in `opportunity-bank/`, so `listOpportunities` returns them with `funder`, `program` and `deadline` null and `status` proposed. Any consumer that scores every listed opportunity as a funding call will see them; the plan required this folder convention. |

T-363-11 (filing without consent), T-363-37 (second door), T-363-38 (smoothed contradictions), T-363-39 (auto-confirmed claims) and T-363-40 (copies instead of links) are mitigated as planned (FI1, FI13, FI4, FI3/FI5/FI7, FI7).

## Downstream contract notes

- 363-15 (facade and CLI): call `buildBasket(run, plan)` then `basketCard(items)`; render through AskUserQuestion. On "File the selected items" pass `{approved: true, items: <payload.defaults>}`; on "Choose items" let the navigator toggle ids from `payload.item_ids`; on "File nothing" do not call `fileRun`. Never pass a grant object as the selection. `fileRun` returns `report.landed`, `report.not_landed` (each `{what, reason}`), `report.partial`, `report.notes`, `report.rollup.note`, and `report.edges`; show them as-is. Pass `approvedVia` (for example `ask-user-question` or `gate-answer`); it is recorded in `ledger.json` and `filing.json`.
- `run` and `plan` are the in-memory RunResult and the approved plan (read `run.json` and `plan.json` from `<room>/.mindrian/research-runs/<run_id>/`). `run.classifications` and `run.opportunity_candidates` drive the limiter and opportunity items; a quick run without classifications simply has no limiter items.
- 363-17 (MCP `research_run` file operation): the same calls after a consumed gate; the room.db handle is opened and closed inside `fileRun` unless `opts.db` is supplied.
- `findOpenQuestions` hides a question with an incoming SUPPORTS edge, so after filing only unsupported leaves show as open questions. That is the reader's existing rule, not a filing defect.
- REASONING.md is never created by filing. If the originating section has none, `report.rollup` is `{ok:false, reason:'no_reasoning_file'}` and `not_landed` names the roll-up; `/mos:mos-reason` creates the file.
- Re-filing the same run is idempotent for nodes (same session id, same URL hash) and overwrites the same run home files; edges upsert.

## Self-Check: PASSED

- FOUND: lib/core/research-planner/filing.cjs, tests/test-363-filing.cjs.
- Commits c1acb4d54 and 5db4d244b are ancestors of HEAD.
