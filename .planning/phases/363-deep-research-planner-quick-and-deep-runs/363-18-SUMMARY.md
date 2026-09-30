---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 18
subsystem: research-runner
tags: [command, research-runner, hitl-stages, form-b, agent, d-05, d-14, cirs, registry]

requires:
  - phase: 363-15
    provides: research-planner CLI door (usage lines, exit contract 0 ok / 2 refused / 1 internal)
  - phase: 363-16
    provides: pending_cards queue (planner.pendingCards, markSurfaced) and the ambient plan-only F.0 card
  - phase: 363-17
    provides: research_run MCP tool named in the Tri-Polar section
provides:
  - commands/research.md plan-run mode, the one governed runner of research plans (D-14), Form B hitl_stages
  - agents/research-lane-analyst.md, a Read-only deep-lane worker born excluded
  - D-05 exception paragraph in research.md; one pointer each in scout.md and scheduled-tasks.md
  - tests/test-363-runner-contract.cjs (K1-K9)
affects: [363-19, 363-20, 363-22]

tech-stack:
  added: []
  patterns:
    - "The runner is a thin command body over one JSON-only CLI: no query string is ever written by Larry, every edit goes through revise, every approval goes through a card"
    - "A worker that only reads records is given only the Read tool: the host, not a sentence, keeps it from egressing"

key-files:
  created:
    - agents/research-lane-analyst.md
    - tests/test-363-runner-contract.cjs
  modified:
    - commands/research.md
    - commands/scout.md
    - commands/scheduled-tasks.md
    - skills/research/SKILL.md
    - skills/scout/SKILL.md
    - skills/scheduled-tasks/SKILL.md
    - data/command-registry.json
    - data/connector-coverage-ledger.json
    - data/brain-orchestration-projection.json
    - data/harness-manifest.json

key-decisions:
  - "The plan-run section and a second Tri-Polar section are inserted BEFORE the existing '## Tri-Polar surfaces' section, which stays byte-identical. The plan said to extend the Tri-Polar section, but K2 requires every pre-phase section unchanged, so the new content is its own '## Tri-Polar surfaces of plan-run mode' section (a three-row table)."
  - "K2 strips the single R10 paragraph before comparing sections, because R10 must sit inside the pre-existing 'Invocation modes' section (directly after the auto-dispatch paragraph). Everything else in every pre-phase section compares byte for byte."
  - "The analyst is justified against every agent on disk (Part 7): agents/research.md has Write plus two Brain tools and composes its own queries; dominant-design-researcher, analogy-query-fetcher and competitor-watch-fetcher each reach the web; persona-analyst and opportunity-scanner are proactive room-facing agents. Phase 363 fetches in code, so the reader of fetched records needs no fetch tool: Read only, with the host enforcing it."
  - "The analyst dispatch prompt carries each leaf's id, question and falsifier (a lane can hold several leaves and rows need a leaf_id), the records file path and the lane id. Nothing else."
  - "The lane payload path is relative to the room dir; the command body says the records file is under .mindrian/research-runs/<run_id>/lanes/."
  - "R2 (deep never unattended) sits directly under the deep-run heading, before the F.6 card; R5 sits at the dispatch_lanes step, immediately before the status block and the Agent call with R6."

patterns-established:
  - "Registry regeneration: connector-registry.json and orchestration-command-ledger.json did not move for an agent that is excluded (only the coverage ledger and the orchestration projection gained an agent row)"

requirements-completed: [DRP363-14, DRP363-04]
requirements-progressed: [DRP363-19]

duration: ~75min
completed: 2026-09-30
---

# Phase 363 Plan 18: /mos:research becomes the one research runner Summary

**`/mos:research` now runs research plans end to end behind four declared gates (Form B: deep plan review F.6, deep extend budget F.3, quick policy grant F.0, filing F.8 parallel), with a Read-only lane analyst for deep runs, the scientific research-perspective door, and the D-05 amendments in the three documents that state today's no-auto-research and zero-egress rules.**

## PLAN_BASE

`778a377e2965da3a6a842fc715f7c33588fc0a1e` (HEAD before the first edit).

## Task commits

| Task | Commit | Files |
|------|--------|-------|
| 1 RED | a8f3f7a0a | tests/test-363-runner-contract.cjs (K2 passing, 8 other legs failing on the pre-plan tree) |
| 2 + 3 GREEN (one commit, as the plan asks) | c8616d831 | commands/research.md, commands/scout.md, commands/scheduled-tasks.md, agents/research-lane-analyst.md, skills/{research,scout,scheduled-tasks}/SKILL.md, data/command-registry.json, data/connector-coverage-ledger.json, data/brain-orchestration-projection.json, data/harness-manifest.json, tests/test-363-runner-contract.cjs (two test fixes made after the RED commit) |

Both are ancestors of HEAD (`git merge-base --is-ancestor`). The commit deleted no files. No sibling (Phase 363.1-07) path was touched.

## Tests and gates

- `node tests/test-363-runner-contract.cjs`: PASS 9, FAIL 0 (K1-K9). RED state was PASS 1 FAIL 8 with K2 passing, as the acceptance asks.
- Five generator `--check`s (skill mirrors 112, command registry, connector registry, orchestration projection, harness manifest): all OK, re-run immediately before the commit.
- `check-render-coverage`: 17 covered, 0 gap; md-keyspace 202 wired, 0 unwired. `check-layer-declaration`: 292 surfaces, 255 declared, 37 exempt. `check-cirs-declaration --check` on this plan: OK.
- `check-shape-declaration --check`: exit 0, advisory WARN count **53**, equal to the 53 baseline. research.md's Form B is conformant; no WARN names research.md, the analyst, or any of this plan's files (the scheduled-tasks entry is the pre-existing hitl_shape-plus-excluded conflict, unchanged).
- `test-265-swarm-task-grant` (15 passed), `test-265-declaration-truth` (three arms clean), `test-265-threshold-fanouts` (6/6), `test-148-engine-reaches` (12), `test-341-registry-drift` (PASS=7), `test-344-surface-layer-parity` (PASS=9).
- Neighbours: test-363-cli 17/17, test-363-mcp-tool 15/15, test-363-baseline 7/7, test-219-research-contract 8/8, test-220-url-sensor 20/20, test-221-matrix 29/29, test-265-scout-competitor-fanout, test-intelligence-research-pipeline, test-tool-router-grouped-reference all exit 0.
- Not run: `doctor.cjs --acceptance` (the plan does not ask for it).

## PRE_HASH and POST_HASH

data/command-registry.json sha256:

- PRE_HASH  `a3fbe501233cf3235679d3c72b186010169275c46580dc4ab2c34d13a39c154b`
- POST_HASH `44c477db95622ee460d6b54154c86735d88fa9e3f67aa88231f71dfe5593d7eb` (differs, as required; only the /mos:research row's `teaching` moved)

The registry change rides the next real release's Step 5.6 theo-resync dispatch; this phase sends no notify.

## Regenerated files (and what moved)

- `skills/research/SKILL.md`, `skills/scout/SKILL.md`, `skills/scheduled-tasks/SKILL.md`: mirrors (only these three).
- `data/command-registry.json`: one line, the research teaching.
- `data/connector-coverage-ledger.json`: excluded 73 to 74, plus the `agent:research-lane-analyst` surface row (state excluded, class utility-excluded). `data/connector-registry.json` and `data/orchestration-command-ledger.json` did not change (an excluded agent has no connector entry; the command ledger has no research delta), so they are not staged.
- `data/brain-orchestration-projection.json`: one node, `agent:research-lane-analyst` (387 nodes).
- `data/harness-manifest.json`: computed with `buildManifest` and `serializeManifest` into a scratch file, diffed (three lines: the command-registry digest and the orchestration-projection digest and source_count 386 to 387), then applied.

Every hunk concerned research.md, scout.md, scheduled-tasks.md, the analyst or their mirrors, or was a derived digest or count. No peer drift.

## What the command now does

`## Plan-run mode (the one research runner)` (anchors R1-R9), in this order: pending cards first (`pending`), quick research run (plan or status, F.0 card fired with AskUserQuestion, `grant approve <proposal.json> --approved-via cli`, `run-quick`, evidence card, one escalation offer, "A grant lets the room fetch. It never files anything."), deep research run (R2, the F.6 Plan Review card with Run / Edit / Stop, `revise` for edits, `review approve --approved-via cli`, a `deep-next` loop over fetch_round, dispatch_lanes (R5 then the status block then the Agent tool with `subagent_type: research-lane-analyst` per lane, at most the `resolveFanoutCap`-clamped lane count), validate, reflect (typed follow-up slots only), extend_card (F.3), counterevidence (mandatory), synthesize, then the report as the updated perspective and pyramid with row ids and named unresolved branches), filing (F.8 basket AskUserQuestion, then `file-run --approved-via cli`), one next move (`next-framework`), and `### Scientific research perspective (Scientific Roadmapping)` (seven operations, the forum in three serial passes, diffusion lens on stated reason).

Carry-forward items honored in the text: a run id whose `plan.json` already exists (saved by the MCP `deep_plan` op) is accepted; a deep grant lapses 20 minutes after approval and a `no_grant` answer means re-run `review approve --approved-via cli`; MCP basket approvals live in memory for about 30 minutes and are asked again after a restart; a `plan_card_no_grant` pending card is approved through its sibling `proposal.json`.

## Known limitation (documented, not fixed)

Production `whitespace-results.json` carries no `zone_term`, so room-started ambient quick runs answer `context_insufficient` (reason `no_zone_term`) until 363-19 populates it. The runner section states this plainly for a navigator who asks why the room never started a run. Runs started in `/mos:research` are unaffected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Interpretation] Tri-Polar content is a new section, not an extension of the existing one**
- **Found during:** Task 1 (K2 versus K5)
- **Issue:** the plan says extend the existing Tri-Polar section and also requires every pre-phase section byte-identical; both cannot hold.
- **Fix:** added `## Tri-Polar surfaces of plan-run mode` (three-row table) before the untouched `## Tri-Polar surfaces (CLI / Desktop / Cowork)`. K5 accepts any `## Tri-Polar` section that names Claude Desktop, Cowork and research_run and says deep research runs execute in Claude Code.

**2. [Interpretation] R10 lives inside a pre-phase section**
- K2 removes exactly the R10 paragraph before comparing that section; R10 placement directly after the auto-dispatch paragraph moved into K3 so K2 passes on the pre-plan tree as the acceptance criteria state.

**3. [Rule 3 - Blocking] Two test bugs fixed after the RED commit**
- The nested-scalar reader kept a trailing YAML comment (`plan_gated: true   # ...`), so K1 read the wrong value; it now strips ` # ...`. The test file's `EM`/`EN` constants must be escapes, not literal characters (K9); fixed. Both are in the GREEN commit's copy of the test.

**4. [Rule 3 - Blocking] Two generated files are not in the plan's list but did not change**
- `connector-registry.json` and `orchestration-command-ledger.json` were listed and did not move for an excluded agent; the coverage ledger, which the plan did not list, did move and is committed (same as 363-17).

### Pre-existing failure, unchanged

`tests/test-209-declared-implies-wired.cjs` fails with its known signature: the only difference is the two entries `commands/brain-derive.md` and `skills/brain-derive/SKILL.md` that a peer already fixed and the test's hardcoded list still names (documented since 361-04). Nothing about research.md or the analyst appears in it. `tests/test-355-direction-agreement.cjs` still fails its H rule (lib/core/rs-chain-feeder.cjs, lib/memory/test-rs-discovery-engine.cjs), also pre-existing and unrelated.

No auth gates.

## Carried forward

- **Irreversibility ledger STALE:** `node scripts/build-command-irreversibility-ledger.cjs --check` prints `WARN: STALE /mos:dominant-designs`, `WARN: STALE /mos:research`, `WARN: STALE /mos:room` (WARN 4, exit 0). Recorded, not rebuilt (Phase 356's ledger, scored by Jev).
- **Registry hash:** POST_HASH above rides the next release's Step 5.6 theo-resync; no notify from this phase.
- **363-19 blockers:** none. 363-19 must populate `zone_term` in `.mindrian/whitespace-results.json` (a navigator-approved gap term) to turn the ambient branch on in production, and the five commands must hand the runner a saved plan (run id) with `plan ... --mode quick|deep`; this command already accepts a pre-existing `plan.json` run id.
- The 363 aggregator `tests/run-all-363.sh` has skipped legs for 363-18/19/20 test files; this plan does not edit it (no plan in 363 may). Phase close wires the new test into it.

## Known Stubs

None. Every step in the command names a live CLI subcommand from 363-15.

## Threat Flags

None new. The analyst has only the Read tool (T-363-06); R2 and R5 are pinned before R6 (T-363-07); R3, R4 and `revise` keep Larry from writing a query (T-363-04); the F.8 instruction precedes `file-run` (T-363-11); regeneration was checked hunk by hunk (T-363-12); the Agent grant row is unchanged (T-363-48).

## Self-Check: PASSED

Found: commands/research.md, agents/research-lane-analyst.md, tests/test-363-runner-contract.cjs, commands/scout.md, commands/scheduled-tasks.md. Commits a8f3f7a0a and c8616d831 are ancestors of HEAD. `grep -P '[\x{2013}\x{2014}]'` over every written file: no hits.
