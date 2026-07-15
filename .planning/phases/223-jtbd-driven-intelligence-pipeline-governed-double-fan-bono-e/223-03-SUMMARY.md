---
phase: 223-jtbd-driven-intelligence-pipeline-governed-double-fan-bono
plan: 03
subsystem: bono-surface
tags: [bono, six-thinking-hats, governed-debate, hitl-stages, connector-registry, skill-mirror, desensitize, version-log, cjs]

# Dependency graph
requires:
  - phase: 164
    provides: shipped bono substrate (runCellFanout / runDebate / assembleTeam / graph-derivation), the connector-block discipline, the F.1 surface
  - plan: 223-01
    provides: hat-governance.cjs (HAT_GOVERNANCE, assertHeterogeneity, composeGovernedSeams) + persona-research.cjs (personaDispatchCell, validateCitations)
  - plan: 223-02
    provides: close-loop-writer.cjs (writeCloseLoop, findPriorConclusion) + temporal/supersession.cjs walkSupersedesChain
provides:
  - commands/bono.md 8-phase governed body + hitl_stages + web_scope green (the evolved surface)
  - skills/bono/SKILL.md regenerated mirror (DESENSITIZE asymmetry preserved)
  - bono --version-log documented (reads walkSupersedesChain)
  - data/connector-registry.json bono tuple with web_scope green (both surfaces), zero new reach
affects: [223-04 intel-pipeline (serialized after this mirror/registry regen), 223-05 phase harness + release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "surface evolution: the command BODY is replaced while every engine call stays on the shipped substrate (D-01 evolve, do not rebuild)"
    - "DESENSITIZE asymmetry is ASSERTED not converged: command sensor_triggers [SENS-05], mirror [] (CONN-03 duplicate-tuple avoidance; RESEARCH staleness correction 1)"
    - "three-gate governed flow via hitl_stages list (act.md shape): topic-confirm F.1, hypothesis-confirm F.1, ruling F.5"

key-files:
  created: []
  modified:
    - commands/bono.md
    - skills/bono/SKILL.md
    - data/connector-registry.json
    - data/command-registry.json

key-decisions:
  - "the 8 numbered phases are h2 (## 1. .. ## 8.); wrapper / hard-rules / footer are h4 so grep -c ^##|^### is exactly 8 (the acceptance spot-check)"
  - "hitl_shape/hitl_why REPLACED by an hitl_stages list plus an updated hitl_why naming the three decision surfaces (act.md list format)"
  - "web_scope null -> green flows into BOTH connector-registry entries (command surface + skill mirror surface); direction stays SIGNAL -> LOCAL, proven by Plan 01's Part 8 egress guard"
  - "command-registry.json regenerated because the teaching field changed; the pre-commit command-registry drift check is a HARD block, so bono.md and command-registry.json commit together"

patterns-established:
  - "the version-cut supersession contract is stated in-body: NEVER auto-confirm a prior conclusion to force a chain; a proposed prior yields a DISCLOSED no-chain outcome (SEED-059), never a silent no-op"

requirements-completed: ["Req 1 (consumption surface)", "Req 2 (surface)", "Req 6"]

# Metrics
duration: 22min
completed: 2026-07-15
---

# Phase 223 Plan 03: Evolved /mos:bono governed 8-phase surface Summary

**The shipped `/mos:bono` surface IS now the 8-phase governed research debate: three declared `hitl_stages` (topic-confirm F.1, hypothesis-confirm F.1, ruling F.5), `web_scope` promoted null -> green for the first-class per-persona web legs, Plan 01's governance + persona research and Plan 02's close-the-loop spine + version cut all wired BY NAME onto the untouched Phase-164 engine substrate, and the mirror regenerated with the DESENSITIZE asymmetry intact (command [SENS-05], mirror []) rather than converged.**

## Performance
- **Duration:** ~22 min
- **Completed:** 2026-07-15
- **Tasks:** 2
- **Files modified:** 4 (zero created; the surface evolves, it is not rebuilt)

## The 8-phase section map (commands/bono.md body)

| # | Phase (h2 section) | Engine calls / new seams named |
|---|--------------------|--------------------------------|
| 1 | Topic-confirm + JTBD orientation | `jtbd-state.getCurrent`; Shape F selector; F.1 topic-confirm gate |
| 2 | Domain decomposition | Engine 1 decomposition (subdomain grid, unchanged) |
| 3 | Governed team assembly | `assembleTeam` + `HAT_GOVERNANCE[hat]` + `assertHeterogeneity` (re-draw duplicate lens before research fires) |
| 4 | Per-persona research fan | `runCellFanout` with `dispatchCell = personaDispatchCell`; extractContext -> runSourceLens -> wireAccept; `part8-egress-guard.classify`; `planDispatch` cap |
| 5 | Hypothesis-confirm + governed debate | F.1 hypothesis-confirm gate; `runDebate` + `composeGovernedSeams`; `validateCitations` on self-critique; F.5 ruling gate (supported/rejected/refined/undecided); `runDerivation` |
| 6 | MECE-Minto synthesis + unknowns matrix | `/mos:structure-argument` Pyramid+MECE -> `validateNarrative` JSON (governing_thought <=250, key_claims 3-5); `/mos:map-unknowns` matrix; feynman-prompts.cjs NOT touched |
| 7 | Close the loop | `findPriorConclusion(db, topic_hash)`; ONE `writeCloseLoop` call; `bash scripts/compute-opportunity-state <roomDir>` |
| 8 | Version cut + --version-log | supersede path (D-04 NULL review_status); `walkSupersedesChain(db, newestConclusionId)` chain-order render; first run = single-entry log, zero SUPERSEDES edges |

Non-phase h4 sections carried: the 8-phase flow lead, Hard rules (in-body), Decisions carried (D-164-S2/S3/S4/S5 updated to name the new modules), Cost controls, Offer high-value SyntheticExperts, Footer routing (now includes the intel-pipeline sibling).

## Frontmatter diff (the ONLY connector changes)

- **hitl_shape "F.5" + hitl_why** REPLACED by an `hitl_stages` list (topic-confirm F.1 gate, hypothesis-confirm F.1 gate, ruling F.5 gate) plus an updated `hitl_why` naming the three decision surfaces.
- **connector.web_scope: null -> green** (per-persona web legs are first-class; direction stays SIGNAL -> LOCAL).
- **Unchanged:** `reach_id: hats`, `sub_mode: bono`, `framework: "Six Thinking Hats"`, `sensor_triggers: [SENS-05]`, `connects_to_spine: true`, `posture: hold`, `hierarchy_rank: 4`, `filing: fileEvidenceWithReadback`, `plan_gated: false`, `surface: F.1`. NEVER a 7th reach.

## Mirror regeneration (DESENSITIZE preserved, never converged)

`node scripts/build-skill-mirrors.cjs` overwrote `skills/bono/SKILL.md` from the new command body. The command keeps `sensor_triggers: [SENS-05]`; the mirror keeps `sensor_triggers: []` (the ENFORCED CONN-03 asymmetry; converging them would trip the registry's duplicate-tuple check). A frontmatter diff of the two files shows EXACTLY one differing line (line 51: sensor_triggers). This is the RESEARCH staleness correction 1 convention -- the SPEC/BRIEF "reconcile the drift" wording is superseded by "re-run, never converge."

## Task Commits
1. **Task 1: 8-phase governed body** - `ce79c1a9` (feat) -- commands/bono.md + data/command-registry.json (teaching field flowed through; the command-registry pre-commit drift check is a hard block, so both commit together)
2. **Task 2: mirror + connector registry regen** - `c0f2cb00` (chore) -- skills/bono/SKILL.md + data/connector-registry.json

## Verification
- **Task 1 verify:** prints `BONO-BODY-OK` (all eight structural greps green: hitl_stages, web_scope green, reach_id hats, version-log, writeCloseLoop, personaDispatchCell, no mindrian-designs, feynman-prompts byte-identical).
- `grep -c "^### \|^## " commands/bono.md` = 8 (exactly eight numbered phase sections; wrapper/hard-rules/footer demoted to h4).
- `grep -cP "\x{2014}" commands/bono.md` = 0 (no em-dash). `composeGovernedSeams`, `walkSupersedesChain`, `SENS-05` all present. File is 152 lines (>= 150 artifact contract).
- `node scripts/build-connector-registry.cjs --check` -> `connector-registry: OK` (exit 0); the before/after diff is exactly the two bono `web_scope: null -> green` lines, zero new entries, zero changed reach_ids.
- `node scripts/build-skill-mirrors.cjs --check` -> OK (109 mirrors match). Frontmatter diff command vs mirror = one line.
- `node scripts/check-shape-declaration.cjs --check` exits 0; bono is NOT flagged (the enumerated WARNs are pre-existing skill/* mirror advisories, unrelated to bono).
- `node scripts/check-render-coverage.cjs` -> 0 gap, 0 unwired.
- Wave 1 modules still green: `test-223-hat-governance.cjs`, `test-223-close-loop.cjs`, `test-223-supersedes-chain.cjs` all exit 0.
- `grep -rc mindrian-designs commands/ skills/ lib/core/bono/` sums to 0 (Req 6 holds after regeneration).

## Deviations from Plan

None to the plan's actions. Two items worth recording:

**1. [process] command-registry.json regeneration folded into Task 1.** The plan's Task 1 files list is `commands/bono.md` only, but changing the `teaching` field made `data/command-registry.json` stale, and the installed pre-commit hook's command-registry drift check is a HARD block (not a warning). The first Task 1 commit attempt was silently blocked by the hook; on inspection HEAD had not moved. Regenerating `data/command-registry.json` (`node scripts/build-command-registry.cjs`) and committing it WITH bono.md cleared the gate. This is a generated artifact tracking a legitimate consequence of the Task 1 edit, not a scope addition.

**2. [pre-existing baseline, NOT a 223-03 regression] `tests/run-all-164.sh` is 17/3.** The Task 2 verify chain includes `bash tests/run-all-164.sh`, whose full `&&` chain therefore does not print `BONO-WIRING-OK` because run-all-164 exits non-zero. The three failures are EXACTLY the documented baseline (`test-issue-tree-edge-remap.cjs`, `test-bono-verdict.cjs`, `canon-version assertion`) recorded in Plans 01 and 02 and named in this plan's own additional_notes ("Known pre-existing baselines (not yours): run-all-164.sh 17/3 stale canon-version assertion"). They are Phase-224 `review_status` schema drift and import zero of this plan's files. My change is command PROSE + generated mirror/registry only -- it touches no engine source, so it cannot regress an engine/schema test. Every OTHER component of the Task 2 verify chain passes individually (connector --check OK, mirror sensor [], command SENS-05, no mindrian-designs). Logged to `deferred-items.md` posture; not fixed here (out of scope: Phase-224 migration wiring in shipped test helpers).

## Known Stubs
None. The command is a directive-prose surface that names the shipped engine calls and the Plan 01/02 seams; no hardcoded empty data flows to a UI, no placeholder text.

## User Setup Required
None.

## Next Phase Readiness
- The mirror + registry regeneration is deliberately serialized BEFORE Plan 04 (both plans touch the generated mirror/registry artifacts; running them in one wave would race the generators). Plan 04 can now add its two `intel-pipeline` connector entries onto a clean, freshly-regenerated registry.
- The evolved bono surface names `writeCloseLoop` and `walkSupersedesChain` in-body; Plan 05's phase harness (`run-all-223.sh`) can exercise a live bono run against a scratch room and assert the close-the-loop nodes + a 2-run SUPERSEDES chain.

## Self-Check: PASSED

commands/bono.md, skills/bono/SKILL.md, data/connector-registry.json, data/command-registry.json all present and modified on disk; both task commits (ce79c1a9, c0f2cb00) are in the git log.

---
*Phase: 223-jtbd-driven-intelligence-pipeline-governed-double-fan-bono*
*Completed: 2026-07-15*
