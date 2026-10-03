---
phase: 364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0
plan: 07
subsystem: command-surface
tags: [born-wired, new-surface, connector, hitl-stages, registry, curated-chains, cirs]
requires:
  - phase: 364-02
    provides: "Scientific Roadmapping in the canon snapshot (framework resolution)"
  - phase: 364-05
    provides: "the door module and the question-templates door entry the body refers to"
provides:
  - "commands/scientific-roadmap.md: the born-wired methodology command (eight hitl_stages, two frameworks, AskUserQuestion at every gate)"
  - "skills/scientific-roadmap/SKILL.md: generated skill mirror carrying 'what must be delivered but not how'"
  - "regenerated command-registry, connector-registry, coverage ledger, harness-manifest, orchestration projection and command ledger"
  - "curated FEEDS_INTO to /mos:research (0.7) and optional /mos:find-analogies (0.5); help-group entry"
  - "tests/test-364-command-contract.cjs (C1-C13) and tests/test-364-registry-gates.cjs (G1-G10)"
affects: [364-08, 364-09, 364-10, 364-11, 364-12, 364-13]
key-files:
  created:
    - commands/scientific-roadmap.md
    - skills/scientific-roadmap/SKILL.md
    - tests/test-364-command-contract.cjs
    - tests/test-364-registry-gates.cjs
  modified:
    - data/command-registry.json
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/harness-manifest.json
    - data/brain-orchestration-projection.json
    - data/orchestration-command-ledger.json
    - data/help-groups.json
key-decisions:
  - "No NAMED_RECIPE and recipe-maps.cjs untouched: NAMED_RECIPES plus SENS10_CAUSE_RECIPES stay 5 so Theo's sync does not throw (G8)."
  - "The generated order matters: after the skill mirror exists, connector-registry, harness-manifest and the projection must be rebuilt again (the mirror adds a skill: connector row and the manifest digests the projection)."
  - "Description is double-quoted in the hand-completed frontmatter because it contains a colon-space; the registry parser strips the quotes."
requirements-completed: [SRM364-02, SRM364-03, SRM364-04, SRM364-05, SRM364-18]
completed: 2026-10-03
---

# Phase 364 Plan 07: Born-wired command surface Summary

`/mos:scientific-roadmap` now exists as a properly shaped, born-wired methodology command that every registry Theo reads carries, feeds `/mos:research`, and refuses honestly with "Theo has not authored this step yet" while Theo's steps are NULL; no recipe, sensor or reach was added.

PLAN_BASE: `00aa846384bc396035c00a18bb057bcc2137c440` (resumed at `9e4cbc23c` after the checkpoint below)

## Commits

| Task | Commit | Files |
| ---- | ------ | ----- |
| 1 RED tests | 890a43a05 | tests/test-364-command-contract.cjs, tests/test-364-registry-gates.cjs |
| 2+3 surface | 1d2526a99 | commands/scientific-roadmap.md, skills/scientific-roadmap/SKILL.md, data/help-groups.json |
| 3 registries | 50b9c4176 | command-registry, connector-registry, connector-coverage-ledger, harness-manifest, brain-orchestration-projection, orchestration-command-ledger |

All three are ancestors of HEAD and were made with `git commit --only`. No commit touches `lib/core/recipe-maps.cjs`.

## What was built

- The command was emitted with `emitSurface` from `scripts/build-new-surface.cjs` (write-only into the scratchpad first, so no registry regeneration ran against a stale baseline), then hand-completed in the explore-futures key order: eight `hitl_stages` (entry F.1, qualify-quantify-place-forum F.9/F.0 ordered, systems pass F.1, path enumeration F.4 ordered, constraint interrogation F.8 parallel, ranking F.0, hypothesis handoff F.6, filing F.8 parallel), `autonomous_safe: false`, both frameworks with Scientific Roadmapping as the connector primary, `canon_parts` including 11.
- The Larry-led body covers the 13 planned sections: purpose, CLI at a glance, Start (define_what / refused / entry_gate), entry gate, walking Theo's steps, systems pass before Path Enumeration, bound inputs, constraint basket, ranking, Stage B hand-off to `/mos:research`, filing basket, optional `/mos:find-analogies`, Tri-Polar surfaces (gate_render, gate_answer, research_run) and the Part 8 boundary ("only the framework name crosses to Theo").
- Registries were rebuilt by their builders; the only hand edits are the two `curated_chains` and one help-group line.

## Verification

- `tests/test-364-command-contract.cjs`: PASS 14, FAIL 0 (C1-C13 plus the zero-network check). `tests/test-364-registry-gates.cjs`: PASS 11, FAIL 0 (G1-G10 plus zero-network).
- RED proof at 890a43a05: contract 3 pass / 11 fail, registry 4 pass / 7 fail.
- Every builder `--check` exits 0 (command-registry, connector-registry, harness-manifest, orchestration-projection, render-coverage, skill-mirrors); `check-render-coverage`, `check-help-coverage`, `check-hitl-stages`, `check-layer-declaration` exit 0; `check-reward-before-investment` prints `invalid:   0`; `check-cirs-declaration --check` on this plan exits 0; `stamp-firing-block.cjs --check` and `check-shape-declaration --check` name no line about scientific-roadmap.
- Registry diffs inspected: additions-only for the command, its skill mirror and generated counters/digests (command count 113 -> 114, connector wired 202 -> 204, ranked 85 -> 86).
- Adjacent registry tests run in a sandboxed HOME: test-connector-registry, test-orchestration-projection(+part8), test-254, test-347 x2, test-235 pass. Known unrelated reds, not caused here: test-command-registry (`/mos:deck` kind mechanical), test-connector-part8-boundary CHECK 2 (`mcp:artifact_file` field "layer", already red per 364-02), test-200-brain-projection (real guard leg).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Spec error] C11 as written cannot hold**
- **Found during:** Task 1
- **Issue:** `data/render-coverage-registry.json` keys only `hitl_shape`-declaring surfaces, so a `hitl_stages` command (like `/mos:research`) never gets a row to be "counted wired".
- **Fix:** C11 asserts `check-render-coverage` exits 0, any entry for the command is wired, and the body fires AskUserQuestion under an allowed-tools grant. `render-coverage-registry.json` correctly shows no diff and is not committed.

**2. [Rule 3 - Blocking] Peer registry drift at baseline (checkpoint)**
- **Found during:** Task 3 precheck
- **Issue:** `build-connector-registry --check` was already stale at HEAD from the peer's Phase 369-13 `room_changes` tool.
- **Resolution:** returned a CHECKPOINT; the coordinator had jsagi-be regenerate (74f12b83c), then I re-verified every `--check` was green at baseline before regenerating, so my diff is additions-only.

**3. [Rule 3 - Files] An extra generated file**
- `data/orchestration-command-ledger.json` is rewritten by `build-orchestration-projection.cjs` and was not in the plan's `files_modified`; it is committed with the registries (+1 ranked, total 114).

**4. [Rule 3 - Ordering] Builder order**
- A single pass of the plan's order leaves connector-registry, harness-manifest and projection stale once the skill mirror exists (the mirror adds a `skill:scientific-roadmap` row). A second pass of connector-registry, harness-manifest, projection after the mirror makes every `--check` green.

**5. [Mechanics]** New test files had to be `git add -f`-ed before `git commit --only` would accept them.

## Auth gates

None.

## Known Stubs

None. The body calls `scripts/scientific-roadmap.cjs`, which lands in 364-09; until then the command refers to a CLI that does not exist yet (contract fixed in the plan interfaces).

## Threat Flags

None. T-364-28..32 mitigated: builders produced every registry, recipe count pinned at 5 (G8), diffs inspected additions-only with `--only` commits, `autonomous_safe: false` plus posture hold and empty `sensor_triggers`, and the body routes Theo reads through the CLI with the boundary stated (C13).

## Self-Check: PASSED

- commands/scientific-roadmap.md, skills/scientific-roadmap/SKILL.md, both 364-07 tests: present.
- Commits 890a43a05, 1d2526a99, 50b9c4176: ancestors of HEAD.
