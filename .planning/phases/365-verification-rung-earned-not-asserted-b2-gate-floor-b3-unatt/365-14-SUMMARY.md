---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
plan: 14
subsystem: cli-never-do-door
tags: [b3, never-do, cli-door, research-md, hitl-shape, tri-polar]
requires: [365-07, 365-10, 365-13]
provides:
  - "scripts/research-planner.cjs never-do add (approval-gated) and never-do list"
  - "commands/research.md: halted_constraint fired as a gate, never-do offer; two F.1 hitl_stages"
affects: [365-15, 365-16]
tech-stack:
  added: []
  patterns: [approval door that mints its own decision node, argv validator with an optional-flag refusal answered by the handler, Form B stage declaration for a new Decision-Gate fork]
key-files:
  created:
    - tests/test-365-never-do-cli.cjs
  modified:
    - scripts/research-planner.cjs
    - commands/research.md
    - skills/research/SKILL.md
    - tests/test-363-runner-contract.cjs
key-decisions:
  - "never-do add keeps --approved-via out of the parser's required flags so a missing one is answered by the handler as approval_required (the writer's own reason); another value is stopped earlier by the typed validator as free_text_argv_refused. Both exit 2 and write nothing"
  - "The decision node is kept when the writer then refuses (it records the navigator's yes); the JSON says decision_recorded_but_not_written: true"
  - "Only caller-supplied kind, value and why reach the writer; an approved_via or alternatives field inside the input file is ignored (L1h, L1i)"
requirements-completed: [V365-10, V365-12, V365-13]
duration: ~45 min
completed: 2026-10-01
---

# Phase 365 Plan 14: CLI door for never-do entries Summary

Claude Code now grows the room's never-do list the same governed way the MCP surfaces do: `research-planner.cjs never-do add <entry.json> --room <dir> --approved-via cli` records a decision node and then writes the entry with `approved_via {surface:'cli', decision_node_id}`, and /mos:research tells Larry to fire halted_constraint cards as gates and offer "Reject and never do this" on every surface.

PLAN_BASE: 1e113faf54bbab5a0266935b73348d82a73544de

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 8d1b6b009 | `never-do add` and `never-do list` in scripts/research-planner.cjs, tests/test-365-never-do-cli.cjs (L1..L6, 35 checks) |
| 2 | 7951841e2 | commands/research.md paragraphs, two F.1 hitl_stages, hitl_why clause, regenerated skills/research/SKILL.md |
| fix | b3188d5c1 | re-pin of tests/test-363-runner-contract.cjs K1 (see Deviations) |

All three verified as ancestors of HEAD.

## The door

- `never-do add <entry.json> --room <dir> --approved-via cli`: refuses `approval_required` without the flag; reads the entry, opens room.db, mints `decision:never-do-<10 hex>` (text "Approved never-do entry <kind> <value> via cli.", origin research-planner), then calls `writeNeverDoEntry(room, {kind, value, why}, {approved_via:{surface:'cli', decision_node_id}})`. Output `{ok:true, decision_node_id, entry}`, or `{ok:true, duplicate:true, decision_node_id}` on a repeat. A writer refusal exits 2 with its reason, `decision_node_id` and `decision_recorded_but_not_written: true`.
- `never-do list --room <dir>`: `{ok:true, count, entries:[{kind,value,why}], note: FLOOR_SENTENCE}`; an unreadable or wrong-schema file exits 2 `{ok:false, reason:'malformed', fix:'.mindrian/never-do.json could not be read; fix or remove it. Until then every unattended step in this room stops.'}`.
- `pending` already marks cards surfaced through `planner.markSurfaced`; unchanged.

## The exact research.md text (in "### Start with pending cards", after the plan_card_no_grant sentence)

Paragraph 1: a `kind` of `halted_constraint` means the room's never-do list named what a room-started run was about to do; the run stopped before any request, so nothing ran and nothing left this machine. Fire it as a gate card at this touchpoint: in Claude Code call `gate_render` with the card's `header`, `kind` and three `options` exactly as given, answer with `gate_answer`; on Desktop and Cowork the `research_run` pending op already returns it rendered as the entry's `gate`, show it and answer with `gate_answer`. "Run it now, attended" runs the quick research run (the yes is the sanction, the list governs unattended steps only). "Leave it stopped" offers "Reject and never do this" (on Desktop and Cowork the reject answer already returns `never_do_gate`). A header saying the list could not be read means every room-started run stops until `.mindrian/never-do.json` is fixed: say that and name the file.

Paragraph 2: when the navigator declines a plan-only card or a halted_constraint card with `card.payload.never_do_proposal` set, make the never-do offer once. In Claude Code, AskUserQuestion with options exactly "Reject and never do this", "Just reject this time", "Decide later", showing the proposal's kind, value and reason and that the list catches only what has been named (a floor, not a guarantee). On the first option, Write `{kind, value, why}` to a scratch JSON outside the room and run `research-planner.cjs never-do add <entry.json> --room <room dir> --approved-via cli`. `never-do list` shows the list. On Desktop and Cowork the same offer is `never_do_gate` from `research_run`. Nothing is added without that yes.

Also one sentence appended to the Desktop cell of the "Tri-Polar surfaces of plan-run mode" table (that table does enumerate pending-card behavior): a constraint halt comes back as an already rendered `gate` and its Reject can return `never_do_gate`.

Frontmatter: `hitl_stages` now has six entries (the two new ones `constraint halt` and `never-do offer`, each `shapes: ["F.1"]`, `mode: "gate"`); `hitl_why` gained the one clause. `teaching` and `description` are untouched (git diff shows no change to either).

## Regeneration delta

Before the edit all five generators' `--check` passed and no generated file had a foreign diff. After the edit only the skill mirror drifted (research DIVERGES). `node scripts/build-skill-mirrors.cjs` overwrote exactly one mirror, skills/research/SKILL.md, and its diff is only the mirrored text (portable plugin-root form of the new command). data/command-registry.json, data/connector-registry.json, data/brain-orchestration-projection.json and data/render-coverage-registry.json did not move (their `--check` still passes; they do not carry hitl_stages or body text), so none of them was regenerated or committed. data/harness-manifest.json digests none of the touched files; `build-harness-manifest.cjs --check` OK, not regenerated.

## Test results

- `node tests/test-365-never-do-cli.cjs`: PASS 35 FAIL 0.
- test-363-cli (peer-edited file, never edited): at PLAN_BASE `PASS: 22 FAIL: 0`; after Task 1 `PASS: 22 FAIL: 0`.
- test-363-command-contract: PASS 8 FAIL 0. check-cirs-declaration on the plan: OK. check-shape-declaration `--check`: no research finding (the advisory WARN list is pre-existing and unrelated).
- All `--check` generators OK after the commit: build-skill-mirrors (112 mirrors), build-command-registry, build-connector-registry, build-orchestration-projection, check-render-coverage, build-harness-manifest.
- FULL `RUN_365_REGRESSIONS=1 bash tests/run-all-365.sh` at HEAD b3188d5c16df63b8ab9bf97e93741c48446fe17b: `PASSED=64 FAILED=0 SKIPPED=0 KNOWN=7` (baseline 63/0/0/7; the +1 is the new leg). Regression block: 354 now 1 / base 1, 355 now 4 / base 4, 356 now 0 / base 0, 358 now 6 / base 6, 363 now 4 / base 4; all PASSED. `build-harness-manifest.cjs --check` OK at the same HEAD.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tests/test-363-runner-contract.cjs K1 pinned exactly four hitl_stages**
- **Found during:** the first full regression run (run-all-363 REDDER THAN BASE: "363: runner contract (363-18)").
- **Issue:** K1 deep-equals the Form B stages of commands/research.md against the four 363 entries; this plan's required two F.1 stages (plan acceptance: "hitl_stages has six entries") break the exact pin. The plain run does not execute the 363 regression block, which is why the plan's verify list did not catch it.
- **Fix:** appended the two new stages to K1's expected list (a planned change, re-pin precedent from 365-REPAIR-01). The peer-edited 363 files named in the plan (test-363-cli, test-363-run-quick) were not touched; test-363-runner-contract had no foreign diff.
- **Files modified:** tests/test-363-runner-contract.cjs. **Commit:** b3188d5c1.

**2. [Scope note] L2 with another `--approved-via` value**
- The plan's L2 says another value also answers `approval_required`. The script's typed validator (`via` accepts only `cli`, per the plan's own CLI conventions) refuses it earlier as `free_text_argv_refused`, never echoing the token. Both exit 2 and write nothing; the test pins both outcomes (L2a, L2b).

No other deviations.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint; T-365-05 (L1, L2, L1h), T-365-10 (L3), T-365-25 (F.1 hitl_stages entries plus shape and CIRS checks), T-365-11 (commit --only, ancestors verified; the peer's 353-FLEET-REPORT.json left alone) implemented as planned.

## Hand-offs

- **365-15 (status):** nothing changed in `listSummary`; `never-do list` is the CLI view of the same list. The four generated registries did not move in this plan, so 365-15 owns any regeneration it needs.
- **365-16 (Theo sync):** no MCP schema changed here; research_run's description still does not name `never_do_gate` / `gate` on pending cards (carried over from 365-13).
- **Later plans that edit commands/research.md frontmatter:** keep test-363-runner-contract K1 in step (six stages now). Any edit to the body must re-run `node scripts/build-skill-mirrors.cjs`.

## Self-Check: PASSED

tests/test-365-never-do-cli.cjs exists; commits 8d1b6b009, 7951841e2 and b3188d5c1 are ancestors of HEAD; STATE.md and ROADMAP.md untouched; no em-dash or en-dash in any touched file.
