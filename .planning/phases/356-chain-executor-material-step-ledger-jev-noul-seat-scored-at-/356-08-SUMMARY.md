---
phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-
plan: 08
subsystem: jev-policy-and-answer-key
tags: [human-checkpoint, sitting-2, policy-lock, answer-key, d-20, d-21, d-22]

requires:
  - phase: 356-06
    provides: blind-labeled sheets (D-04 subset, D-20 remainder, D-21 two-labeler re-run) and the v1/v2 policy drafts
provides:
  - "data/jev-policies/command-irreversibility.json locked as version 3 (status: locked)"
  - "data/jev-labels/command-irreversibility.json: the navigator-reviewed answer key covering all 113 registry commands"
affects: [356-09, 356-10]

tech-stack:
  added: []
  patterns:
    - "Navigator ruling precedence over model agreement: every row checks the validation-desk rulings first (label_source navigator-arbitrated), falls back to two-model blind agreement only when no ruling exists"
    - "Strategy-then-tactics policy framing (D-22): one strategy sentence states the WHY (navigator attention is the scarce resource), every boundary case is tagged with the strategic reason it serves in brackets"

key-files:
  created:
    - data/jev-labels/command-irreversibility.json
  modified:
    - data/jev-policies/command-irreversibility.json
    - .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/deferred-items.md

key-decisions:
  - "D-22 (navigator): policy is strategy and tactics, each question is a problem on the PWS ladder. instructions now opens with one strategy sentence before the tactical (a)/(b)/(c) definition; every boundary_cases entry is prefixed with a bracketed strategic tag ([escapes the room], [changes the plugin], [carries the brand], [stays in the room]). No new top-level JSON fields (readPolicy and the material_step_ledger egress rule's must_equal_file check the existing schema)."
  - "/mos:admin is a named legacy exception, not a silent contradiction, to the general remote-key-rotation rule: the Brain admin panel is legacy now that Theo took over the Brain (navigator chat clarification)."
  - "/mos:vault is not flagged: local Obsidian export for the user's own offline reading, run only when the user has Obsidian or asks for it (navigator ruling d21-vault)."

requirements-completed: [R356-01, R356-02]

duration: unknown (checkpoints pre-satisfied via validation-desk artifact; this session did Task 3's automated work plus the D-22 addendum)
completed: 2026-09-23
---

# Phase 356 Plan 08: Policy Lock v3 and Answer Key Summary

**Locks command-irreversibility.json as v3 (strategy-then-tactics framing, D-22) and builds the navigator-reviewed answer key for all 113 registry commands, 99 by two-model blind agreement and 14 by direct navigator arbitration.**

## Checkpoints: Pre-Satisfied via the Validation Desk

Per the orchestrator's instruction, both of this plan's human checkpoints were already resolved before this session started, through the navigator's own validation-desk artifact rather than through this plan's interactive sitting flow:

- **Checkpoint B (policy lock):** the navigator approved policy v2 directly at the desk (`policy-lock-v2` ruling, `356-NAVIGATOR-RULINGS.json` @ `3ccc1a1ff`): `"i approve i stii want you to consould with jev and with theo"`. That approval, plus his separate chat clarifications on `/mos:admin` and `/mos:vault`, is this plan's Checkpoint B resume signal. This session treated `3ccc1a1ff` as the checkpoint output and did not re-prompt.
- **Checkpoint C (pre-label review):** superseded by D-20/D-21's model-built-and-human-arbitrated flow (356-06); the navigator ruled on the 7 D-21 blind-sheet disagreements plus 7 additional boundary cases directly at the desk, rather than filling `356-PRELABEL-REVIEW-SHEET.md` row by row. That file was never created; `tests/test-356-label-sheet.cjs`'s review-sheet leg reports PENDING (not committed yet) and is designed to count that as passing.

Then, mid-session, the orchestrator relayed a further navigator directive (**D-22**) plus a Theo consult result, applied to policy v3 before this plan's work was called complete (see below).

## Policy v3: Changes from v2

1. **`version`: "2" -> "3"; `status`: "draft" -> "locked".**
2. **`/mos:admin` named legacy exception.** v2's text ("it routes the decision to the Brain rather than taking an effect of its own") silently avoided the general rule about remote key rotation being flagged. v3 states it explicitly as an exception: the general rule flags a write to a remote key service (such as rotating an API key), but the Brain admin panel itself is legacy now that Theo has taken over the Brain (navigator chat clarification, `356-NAVIGATOR-RULINGS.json.chat_clarifications["/mos:admin"]`), so `/mos:admin` stays unflagged. The two cases no longer contradict.
3. **New `/mos:vault` boundary case.** Not flagged: it writes a local Obsidian vault folder for the user's own offline reading (working material), and runs only when the user has Obsidian or asks for it (navigator ruling `d21-vault`). This closes the `deferred-items.md` 356-09 entry that flagged the missing `/mos:vault` mention.
4. **D-22 strategy-then-tactics reframing** (navigator directive relayed mid-session, grounded in a Theo consult on the PWS problem-type ladder): `instructions` now opens with one strategy sentence stating the WHY before the tactical (a)/(b)/(c) definition -- *"Strategy: the navigator's attention is the scarce resource, so an unattended chain spends it only where a mistake escapes the room, changes the plugin itself, or carries the Mindrian brand outward; everything else runs."* Every `boundary_cases` entry is now prefixed with the strategic reason it serves in brackets: `[escapes the room]`, `[changes the plugin]`, `[carries the brand]`, or `[stays in the room]`. No new top-level JSON fields were added; `readPolicy`'s shape validation and the `material_step_ledger` egress profile's `must_equal_file` check both still pass unchanged.

All other wording is byte-identical to v2. `tests/test-356-policy.cjs` is green at 36/36 checks, including the "boundary_cases mentions /mos:vault" leg that was previously failing.

## Theo Consult (D-22 grounding)

Two governed `brain_ask` calls were made through the sanctioned path (never a raw `mcp__theo__*` call, which the Part 8 egress hook blocks outright -- a THEO-04-class finding if attempted directly). Result: direct grounding on gate/irreversibility policy specifically was thin in the current corpus; the strongest available grounding was the general PWS problem-type ladder (taxonomy chapter 2: Un-Defined / Ill-Defined / Well-Defined questions), which the navigator used to reframe the policy as strategy (an Ill-Defined judgment: where should attention go) versus tactics (a Well-Defined, falsifiable per-command call). Theo's own recommendation, given the thin direct grounding, was to schedule a Red Teaming pass on the locked policy before it goes live against real Jev calls -- not yet scheduled, carried forward as an open item for 356-09/356-10 or a later phase.

## Answer Key: Coverage and Counts

`data/jev-labels/command-irreversibility.json` covers all 113 registry commands (`registry_hash` recorded in the file; verified equal set, not just equal count).

| label_source | rows | flagged (irreversible: true) |
|---|---|---|
| two-model-blind-agreement | 99 | 5 |
| navigator-arbitrated | 14 | 6 |
| **total** | **113** | **11** |

**Flagged (11):** `/mos:deck`, `/mos:doctor`, `/mos:export`, `/mos:heal`, `/mos:ingest-methodology`, `/mos:new-surface`, `/mos:present`, `/mos:publish`, `/mos:show`, `/mos:snapshot`, `/mos:update`.

**Not flagged:** the remaining 102 commands.

### The 14 navigator-arbitrated rows

Source: `356-NAVIGATOR-RULINGS.json` (`3ccc1a1ff`), every ruling with `decided: true` excluding the `policy-lock-v2` policy-approval entry. Reasons are verbatim from the ruling (typos preserved), except `/mos:admin`, which uses the navigator's chat clarification text per this plan's instructions.

- 7 from resolving the D-21 blind-sheet disagreements (sheet A vs. sheet B, both 113 rows, compared programmatically -- exactly 7 mismatches found): `/mos:heal` (true, "Reparis all !"), `/mos:mva-brief` (false, "This is a quicl. you can add a if to render ask for user. HITL"), `/mos:new-surface` (true, "need to flash cuz Theo needs to get a mirroring set of nodes also"), `/mos:scheduled-tasks` (false, "Theo needs to get enged to offer"), `/mos:setup` (false, "goof"), `/mos:show` (true, "shwo is a quick view"), `/mos:vault` (false, "Only if user has obsidian in their systme or asked for it").
- 7 from boundary cases the navigator reviewed directly at the desk (not blind-sheet disagreements; both labelers already agreed on these, but the navigator's own ruling takes precedence per the plan's stated precedence order): `/mos:admin` (false, "Legacy now that Theo took over the Brain, so no flag" -- chat clarification), `/mos:doctor` (true, "alwas run diagosits with --fix"), `/mos:export` (true, "m:os styling can be changed ! but mind mindrian logo alwasy remais wit h main by mindrisnos with www.mindrian-os.com"), `/mos:rs-fetch` (false, "Local only !"), `/mos:update` (true, "Always check from update !"), `/mos:wiki` (false, "opens a locak host of the data room wiki. showing it to user"), `/mos:rooms` (false, "bothj").

Verified: zero unresolved disagreements remain without a navigator ruling (all 7 D-21 sheet-A-vs-sheet-B mismatches match exactly the 7 `d21-*` ruling item_ids).

### The 99 two-model-blind-agreement rows

Every other registry command, where independent blind labelers A and B agreed under the D-21 rubric ("always stop for the navigator"). `reason` is taken verbatim from labeler B per this plan's precedence rule.

## Deferred Items Surfaced at the Validation Desk (logged, not built in 356)

Recorded in full in `deferred-items.md` under "356-08: items surfaced at the validation desk, out of scope for Phase 356":

- **Branding requirement** (from the `mos-export` ruling): styling may change, but the Mindrian logo and "mindrianos / www.mindrian-os.com" mark must always remain on exported artifacts. No 356 file enforces this at the export-command level; a future phase should verify `commands/export.md` actually pins the mark.
- **HITL idea** (from `d21-mva-brief`): the navigator's suggestion to add a conditional AskUserQuestion gate ("an if to render ask for user") before `/mos:mva-brief`'s deploy step. Not built in 356.
- **Theo-sync notes** (from `d21-new-surface` and `d21-scheduled-tasks`): `/mos:new-surface` needs Theo to get a mirroring set of nodes when a surface registers; `/mos:scheduled-tasks` should engage Theo to offer suggestions. Neither is wired in 356.

## Task Commits

1. **Policy v3 lock (admin exception + vault case)** - `3a8fcbecb` (feat)
2. **Policy v3 D-22 strategy/tactic reframing** - `b1d52ca8c` (feat)
3. **Answer key (all 113 commands, D-05/D-20/D-21 shape)** - `a6254fd80` (feat)
4. **356-06 SUMMARY (retroactive, this session)** - `f150d6359` (docs)

**Plan metadata:** committed alongside this SUMMARY (see below).

## Verification

- `node tests/test-356-policy.cjs` -> PASS (36/36 checks), including the shipped-policy `/mos:vault` leg
- `node tests/test-356-label-sheet.cjs` -> PASS (98/98 checks; review-sheet leg PENDING by design, counted as passing)
- `node tests/test-356-larry-contract.cjs` -> PASS (11/11 checks)
- `bash tests/run-all-356.sh` -> `PASSED=23 FAILED=0 SKIPPED=2` (the 2 skips are ENV GAP: `tests/test-356-check.cjs` and `tests/test-356-answer-key.cjs`, both future-plan files not owned by 356-08)
- Builder input validation: `builder.loadInputs({ registryPath, labelsPath, root })` succeeds (113 rows, 113-entry `labelsByCommand` map) -- the answer key passes the same shape gate `build-command-irreversibility-ledger.cjs` will use in 356-09/356-10
- Answer-key one-liner from the plan's Task 3 verify block: exits 0
- `test ! -e data/command-irreversibility-ledger.json` -> true (no Jev call happened)
- `grep -c "$(printf '\xe2\x80\x94')" data/jev-policies/command-irreversibility.json data/jev-labels/command-irreversibility.json` -> 0 for both (no em-dash)

## Deviations from Plan

**1. [Rule 4 pattern, orchestrator-directed] Checkpoints satisfied via validation-desk artifact, not this plan's interactive sitting**

- **Found during:** session start.
- **Issue:** Task 1 (Checkpoint B) and Task 2 (Checkpoint C) are `type="checkpoint:*"` tasks that normally require live navigator interaction in this session.
- **Resolution:** per explicit orchestrator instruction, `356-NAVIGATOR-RULINGS.json` (committed at `3ccc1a1ff`) was treated as the checkpoint output: it already carries the navigator's `policy-lock-v2` approval and 14 per-command rulings from a prior validation-desk sitting. No re-prompt was issued; Task 3's automated merge work proceeded directly from that artifact.
- **Files affected:** none (no code change; this is a process deviation, documented here for the record).

**2. [Orchestrator-directed mid-task addendum] D-22 strategy/tactics reframing added after the initial v3 lock**

- **Found during:** mid-session, after the first v3 commit (`3a8fcbecb`) landed.
- **Issue:** the orchestrator relayed a further navigator directive (D-22) plus a Theo consult result, requiring the policy's `instructions` and `boundary_cases` to be reframed as strategy-then-tactics.
- **Fix:** applied as a second, separate commit (`b1d52ca8c`) rather than amending the first, per this workflow's "always create NEW commits" rule. Re-validated the full guard/test suite after the change (still 36/36 in `test-356-policy.cjs`).
- **Files modified:** `data/jev-policies/command-irreversibility.json`.

## Self-Check: PASSED

- `data/jev-policies/command-irreversibility.json` exists, version 3, status locked: confirmed
- `data/jev-labels/command-irreversibility.json` exists, 113 rows, schema `jev-answer-key/v1`: confirmed
- Commits exist: `3a8fcbecb`, `b1d52ca8c`, `a6254fd80`, `f150d6359` all found in `git log --oneline --all`
