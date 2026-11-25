---
phase: 399-decision-model-advisor-keyed-on-the-job-to-be-done-one-job-v
plan: 02
subsystem: decision-advisor-job-labels
tags: [job-labels, registry, owner-ruling, taxonomy, additive]
requires: [399-01]
provides:
  - data/job-label-rulings.json (schema mos.job-label-rulings/1; accepted, held, doubtful_existing, taxonomy_disagreements)
  - scripts/apply-job-labels.cjs (append-only apply; --check; env seam MINDRIAN_COMMAND_REGISTRY)
  - 26 accepted job labels on 19 commands, 19 skill mirrors, regenerated registry
affects: [399-06]
tech-stack:
  added: []
  patterns: [ruling as labels-only data, append-only frontmatter edit, mutation control on a --check gate]
key-files:
  created:
    - data/job-label-rulings.json
    - scripts/apply-job-labels.cjs
    - tests/test-399-job-labels.cjs
  modified:
    - 19 commands/*.md (one serves_jtbd line each)
    - 19 skills/*/SKILL.md (regenerated mirrors)
    - data/command-registry.json
    - data/harness-manifest.json
    - ui/mindrian-workspace-mod/assets/command-registry.json
    - tests/run-all-399.sh
decisions:
  - "Append order inside a command follows the rulings file sort (command, then job); serves_jtbd[0] never moves, so jtbd_label and jtbd_summary did not change (0 diff lines)."
  - "5 taxonomy disagreements stay open for the owner (lean-canvas, think-hats x2, explore-domains, persona); only validate-proposition is resolved by an accepted label (I-02, no guess)."
  - "trending-to-absurd is on the skill-mirror skip-list, so the L6 mirror step check skips it."
metrics:
  tasks: 2
  completed: 2026-11-24
---

# Phase 399 Plan 02: Owner job labels applied Summary

26 owner-accepted job labels are now in 19 command files, their mirrors and the registry; the 2 held pairs and 5 doubtful labels are untouched and pinned by a test.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Record the ruling as data and apply the 26 labels (D-07, I-02) | e03cff108 |
| 2 | Pin the ruling with a test (D-07, I-02) | 25a10ed15 |

## Base run (before any edit)

- `node tests/test-395-job-orders.cjs`: exit 1 (C3 fails at base: pre-existing).
- `node tests/test-395-measure.cjs`: exit 0.
- `node evals/selection/score.cjs`: exit 0; B1 12/33 fail, B2 9/38 fail, B3 23/33 (69.7%) fail, B4 5/5 fail.

After the change: same exit codes (1, 0, 0). Eval B2 became 10/38 and B3 22/33 (66.7%); see Risk below.

## What was built

- `data/job-label-rulings.json`: labels only (26 accepted, 2 held, 5 doubtful, 6 taxonomy items: 1 resolved, 5 open). Derived from the private accepted-label file; probabilities are not copied.
- `scripts/apply-job-labels.cjs`: resolves each command file by its `name:` field, appends missing jobs to the one `serves_jtbd` line, exits 2 on 0 or 2+ lines. `--check` exits 1 and names every miss.
- `tests/test-399-job-labels.cjs`: legs L0-L8 and G1. L8 runs `--check` on a scratch registry missing one accepted pair and expects exit 1.
- Regenerated: command-registry, skill mirrors (19 overwritten), harness-manifest, UI registry asset. brain-orchestration-projection and orchestration-command-ledger were rebuilt with no byte change (they carry no job labels).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] sync-assets also copied framework-names.json**
- **Found during:** Task 1
- **Issue:** `sync-assets.cjs` copied the drifting `assets/framework-names.json` along with the registry asset. The plan says not to fix that drift.
- **Fix:** Restored that one file with `git checkout -- <file>`. Only the registry asset is committed. `sync-assets --check` still fails on framework-names only, as at base.

**2. [Rule 1 - Bug in test] L6 and G1 first run failed**
- L6: `trending-to-absurd` has no mirror (skip-list in build-skill-mirrors). Added a skip set.
- G1: the test source held literal dash characters in its own regex. Rewrote the regex with `String.fromCharCode`.

### Plan statement not matched by the tree

- Plan says `build-connector-registry.cjs --check` prints 20 GAP lines. In this worktree it exits 0 with 0 GAP lines (before and after the change, "connector-registry: OK"). No new gap.
- Plan says `lib/workflow/command-resolver.test.cjs` passes at base. It fails at base (assertion "Red Teaming must remain command-less"); the same failure remains. Verified in a scratch worktree at a35f97d61, then removed. Pre-existing, not fixed.

## Verification

- `node scripts/apply-job-labels.cjs --check`: 26 accepted present, 2 held absent, exit 0.
- Registry, skill-mirror, orchestration-projection and harness-manifest `--check`: exit 0. `check-registry-drift --check`: exit 0.
- `git diff data/command-registry.json` shows 0 changed `jtbd_label` or `jtbd_summary` lines; `lib/hmi/jtbd-taxonomy.json` has no diff.
- intel-pipeline serves `plan-execution,decide-pursue,prepare-pitch,understand-market,validate-idea`.
- `node tests/test-399-job-labels.cjs`: 10 checks passed. `bash tests/run-all-399.sh`: 3 PASSED lines.
- `lib/memory/per-command-jtbd-derivation.test.cjs`: exit 0.
- Pre-commit command-registration sweep: PASS (39 pre-existing description warnings).

## Risks and open items

- **Eval shift (not a plan gate):** selection eval case `sel-14` (job decide-pursue, funding section) moved from acceptable to wrong. The selector now picks `/mos:mullins` because it serves decide-pursue after the owner label. The eval answer key was not changed. Plan 06 calibration or an owner review of the key should settle this. B1-B4 already failed at base.
- 5 taxonomy hooks disagree with the registry and wait for the owner.
- 2 held and 5 doubtful pairs wait for the owner.

## Known Stubs

None.

## Threat Flags

None. No new network surface; the rulings file is checked by L7 for probability keys and long strings.

## Self-Check: PASSED

- data/job-label-rulings.json, scripts/apply-job-labels.cjs, tests/test-399-job-labels.cjs exist.
- Commits e03cff108 and 25a10ed15 exist on work/399-decision-advisor.
