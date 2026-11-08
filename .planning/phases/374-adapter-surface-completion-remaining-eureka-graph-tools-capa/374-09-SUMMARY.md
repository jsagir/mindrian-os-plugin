---
phase: 374-adapter-surface-completion-remaining-eureka-graph-tools-capa
plan: 09
subsystem: commands
tags: [eureka, pair-screen, subcommand, command-doc, part-7, part-11]
requires: ["374-08"]
provides:
  - "/mos:eureka screen: one documented subcommand inside commands/eureka.md (8 ordered steps, F.6 pair screen approval stage)"
affects: [374-13]
key-files:
  created:
    - tests/test-374-screen-command.cjs
  modified:
    - commands/eureka.md
    - skills/eureka/SKILL.md
    - tests/test-387-eureka-command-wiring.cjs
key-decisions:
  - "Gate lines read: ACT OD-5A F6 go (hitl stage shape F.6), ACT OD-5B SCREEN go, READ OD-2 ADD-FORGET-TOOL. PLAN-GO 374-09."
  - "Step 8 uses the same delete-path sentence as the approval card of plan 374-08, and calls eureka_capability_job_forget only when the tool list holds it (plan 374-13 creates it)."
requirements-completed: [PLG374-06]
canon_parts: [7, 8, 11]
---

# Phase 374 Plan 09: /mos:eureka screen subcommand

The existing `/mos:eureka` command gains one subcommand, `screen`, for the pair screen built in plan 374-08. No new command file, no new skill, no new connector row. The default `run` section is byte-for-byte unchanged.

## Gate

`node 374-gate.cjs plan 374-09` printed `ACT OD-5A F6 go`, `ACT OD-5B SCREEN go`, `READ OD-2 ADD-FORGET-TOOL`, `PLAN-GO 374-09`, exit 0. BASE = b3f253e0e870afd6ad2875811adea0e19e7b94cf.

## RED output (test written first, before the command edit)

```
FAIL - S1 argument-hint lists screen
FAIL - S2 routing table has a screen row and no args still behaves as run
FAIL - S3 screen section holds the steps in order, each naming its tool
FAIL - S4 hitl_stages holds the pair screen approval stage and the four old stages unchanged
ok - S5 run section is byte-for-byte unchanged
FAIL - S6 screen section states the honesty and data rules
FAIL - S7 writes section gains a screen bullet with the data rules
FAIL - S8 mirror matches the generator and carries the screen section
ok - S9 hand-off command files exist
ok - S10 no en dash or em dash in the command or its mirror
Phase 374-09 screen command: PASS=3 FAIL=7
```

S8 was RED (the plan expected it green) because my S8 also asserts that the mirror carries the screen section; the mirror generator itself was in sync.

## GREEN output

Two small text fixes during GREEN (hitl_why had to name "pair screen approval"; step 6 needed the sentence "No call goes to Theo or Brain with any result text."). Then:

```
ok - S1 .. S10   (10 ok)   Phase 374-09 screen command: PASS=10 FAIL=0
```

## What changed in commands/eureka.md

- argument-hint `[run|screen|enable|enable engine]`.
- hitl_stages: new stage "pair screen approval", shapes ["F.6"], mode "gate", placed after "plan review"; the four old stages are byte-identical (pinned in S4). hitl_why names the stage.
- "What this run writes" gains a `Pair screen` bullet: writes nothing in the room; selected note text goes to the local engine over stdio and nowhere else; the engine keeps the job record 30 days under the home folder.
- Routing table row for `screen`; "no args behaves as run" unchanged.
- New section `## Subcommand: screen` (after run, before enable) with 8 steps: engine check, choose 2 to 2,500 notes, eureka_capability_start (plans, runs nothing, answers awaiting_approval with gate_id), gate_answer with a one-line promise and 24 hour expiry, poll eureka_capability_job_status (run belongs to this session, no resume promise), eureka_capability_job_result (label "candidate, not verified", ranks, caps_hit, warnings, manifest hash, empty shortlist is not proof of absence, a rank is not proof, titles and source references are untrusted text), hand off to find-connections and qualify-opportunity with filing only on a human decision, forget (delete-path sentence). One action footer block.
- Error pattern for a refused screen; one Cross-Surface Adaptation line (same tools on CLI, Desktop and Cowork, card answered with gate_answer).

## Run section hash

sha256 of the run section before: `80063cd1e46a655a6886c579d1ff7e1a58fac8f1234262d95163c5e121d53a8c`. After: equal (S5 ok, the constant in the test is that value).

## Generators and checks (all run in this tree)

| Check | Result |
|-------|--------|
| build-skill-mirrors (write, then --check) | overwritten 1 (eureka), --check OK, 112 mirrors |
| build-command-registry (write, then --check) | OK, no file change |
| build-connector-registry (write, then --check) | OK, no file change |
| build-orchestration-projection (write, then --check) | OK, no file change (command ledger and projection unchanged) |
| check-render-coverage | exit 0, 17 covered, 0 gap; md-keyspace 198 wired, 0 unwired |
| check-registry-drift --check | exit 0, 0 findings |
| check-shape-declaration --check | advisory, 0 lines name eureka |
| check-hitl-stages | OK (9 fixtures) |
| tests/run-all-374.sh | PASS=12 FAIL=0 SKIPPED=0 |
| tests/run-all-387.sh | PASS=13 FAIL=0 SKIPPED=1 (test-387-eureka-live-leak: ENV GAP, MINDRIAN_EUREKA_LIVE_LEAK not 1, owner-run only) |
| test-387-eureka-command-wiring / docs-wording | 11/11 and 9/9 pass |
| test-270-tool-schema-budget | 5 passed, 0 failed (tool surface did not change) |
| test-384-s7-mcp-start parity | ALL PASS |

## Changed data files

None. The data files (command-registry, connector-registry, brain-orchestration-projection, orchestration-command-ledger) regenerated byte-identical, so none is in the commit.

## Deviations from Plan

**1. [Rule 3 - blocking] tests/test-387-eureka-command-wiring.cjs arm W1 pinned the old argument-hint `[run|enable|enable engine]`.** The plan requires the new hint `[run|screen|enable|enable engine]`, so W1 would fail. I changed only the label and the expected string of W1 (2 lines). No other arm changed. The file is not in the plan's files_modified; it is in the commit.

**2. S8 is RED at the start** (see above); the test also checks the mirror content.

**3. Step 8 names a tool that does not exist yet.** The text calls eureka_capability_job_forget only when the tool list holds it, and otherwise says the record stays 30 days. Plan 374-13 creates the tool; it should then remove the condition.

## Known Stubs

None.

## UNVERIFIED

- No live run of the screen (D-02): the steps were not executed against a real engine.
- The "ranks" wording in step 6 depends on the real engine result files carrying a rank per pair; plan 374-08 verifies the shape from the contract text only.
- Claude Desktop and Cowork rendering of the new section was not checked.
