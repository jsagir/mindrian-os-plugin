---
phase: 265-capability-radar-absorption-routing-re-scoped-supersedes-orp
plan: 14
subsystem: methodology-commands
tags: [subagent-dispatch, fan-out, feynman-minto, hitl-shape, dispatch-optimizer, mos-reason]

# Dependency graph
requires:
  - phase: 265-03
    provides: "The corrected 2.1.232+ dispatch idiom (no run_in_background, explicit subagent_type, 20-cap named) proven on act.md/persona.md/grade.md"
  - phase: 265-12
    provides: "The reviewed pending registry row for commands/mos-reason.md in data/subagent-dispatch-grants.json (token Task)"
provides:
  - "commands/mos-reason.md rewritten from a flat 10-step sequential walk into a three-phase hybrid protocol: PHASE 0 sequential migration backup + section enumeration, PHASE 1 one framework-runner subagent per populated section, PHASE 2 sequential per-section report + a new cross-section coherence check + the compute-hsi.py cascade"
  - "tests/test-265-mos-reason-fanout.cjs, a four-arm tripwire protecting the ordering guard, the no-third-prompt-copy rule, the consolidation step, and the corrected dispatch idiom"
  - "Task added to commands/mos-reason.md allowed-tools with an adjacent pre-approval comment, riding the reviewed pending registry row (not ratified here)"
affects: ["265-23 (ratification plan that flips this command's registry row to granted)", "265-24 (owns the next full skill-mirror + dist-bundle regeneration pass)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hybrid dispatch protocol: sequential head (ordering-dependent setup) -> parallel fan-out (disjoint per-unit work) -> sequential consolidation (cross-unit synthesis), mirroring grade.md/persona.md's house pattern"
    - "Prompt bodies read from their library source of truth at dispatch time and passed as data to subagents, rather than inlined a third time, to avoid growing the byte-equality drift test a third arm"

key-files:
  created:
    - tests/test-265-mos-reason-fanout.cjs
  modified:
    - commands/mos-reason.md
    - skills/mos-reason/SKILL.md

key-decisions:
  - "hitl_shape stays F.9: the intra-section four-stage walk is still order-dependent (F.9 is accurate for that), and nothing in docs/HITL-SHAPE-DECLARATION-CONTRACT.md forces a reshape merely because the cross-section dispatch topology changed from sequential to independent. Only hitl_why was rewritten, to state the F.9-applies-intra-section-only distinction explicitly. Considered switching to Form B (hitl_stages: sequential migration, F.8 parallel section fan-out, sequential consolidation) as a more literally accurate model of the new topology, but rejected it as out of this plan's stated scope (the plan text authorizes changing hitl_shape only if the contract requires it, and this command has no genuine navigator-facing option-pick fork to re-classify around in the first place -- the whole command is fully automated)."
  - "Rule 3 auto-fix: commands/mos-reason.md had no interactive_first_reward declaration at all, a pre-existing gap (it predates Phase 118-06's rollout) that blocked this plan's own commit via the staged reward-before-investment linter. Declared interactive_first_reward: schema_preview, matching the closest sibling swarm commands (act.md, persona.md): the command delivers its structured Feynman-MINTO output directly on invocation with no additional form/menu/upload demanded first."
  - "Hand-mirrored skills/mos-reason/SKILL.md via scripts/build-skill-mirrors.cjs's own exported computeExpectedMirror() function, scoped to this one command only -- not the full generator CLI run, which stays plan 265-24's job and would touch unrelated mirrors."

requirements-completed: [RADAR-21]

# Metrics
duration: ~55min
completed: 2026-08-27
---

# Phase 265 Plan 14: mos-reason Sequential-Head Parallel Fan-Out Summary

**Rewrote /mos:reason from an 11-section sequential Feynman-MINTO loop into a three-phase hybrid protocol (sequential migration backup, parallel per-section subagent dispatch sized via planDispatch, sequential consolidation with a new cross-section coherence check), without inlining a third copy of the Feynman prompts or ratifying the dispatch grant.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-27T (session start, see task_commit timestamps)
- **Completed:** 2026-08-27T12:39:01Z
- **Tasks:** 2/2 completed
- **Files modified:** 3 (commands/mos-reason.md, skills/mos-reason/SKILL.md, tests/test-265-mos-reason-fanout.cjs created)

## Accomplishments

- `/mos:reason`'s execution protocol is now PHASE 0 (sequential: `--regenerate-all` backup via `scripts/vault-regenerate-all.cjs`, then section enumeration + pre-existing token count capture) -> PHASE 1 (parallel: one `framework-runner` subagent per populated section, sized via `planDispatch`, model resolved once via `resolveModel(roomDir, 'framework-runner')`) -> PHASE 2 (sequential: per-section report, a new cross-section `governing_thought` contradiction check that reports-and-flags rather than auto-edits, and the `compute-hsi.py` cascade).
- The migration-backup ordering guard is provable by byte offset: `vault-regenerate-all.cjs` at offset 5438 precedes the `Dispatching` status block at offset 11072 in the shipped file.
- The four Feynman prompts stay byte-identical in exactly two places (`lib/memory/feynman-prompts.cjs` and the sentinel blocks in `commands/mos-reason.md`); the new subagent contract reads them from the library at dispatch time rather than adding a third copy.
- Added `Task` to `allowed-tools` with an adjacent `pre-approval` comment, riding the reviewed `pending` row plan 265-12 already wrote to `data/subagent-dispatch-grants.json`. That registry file was not touched by this plan (`git diff --stat data/subagent-dispatch-grants.json` produces no output).
- New tripwire `tests/test-265-mos-reason-fanout.cjs` (4 arms: ordering guard, no-third-copy, consolidation, stale-idiom), discovered automatically by `tests/run-all-265.sh`'s glob. Full phase suite: `bash tests/run-all-265.sh` -> `PASS=20 FAIL=0 SKIP=0`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite the execution protocol as sequential head, parallel section fan-out, sequential consolidation** - `467070b7` (feat)
2. **Task 2: Tripwire the ordering guard, the prompt-copy count and the consolidation step** - `10ba991d` (test)

**Plan metadata:** committed separately per the orchestrator's central STATE.md/ROADMAP.md ownership (see Deviations note below); this SUMMARY's own file-add commit follows this document.

## Files Created/Modified

- `commands/mos-reason.md` - Execution Protocol rewritten into PHASE 0/1/2; `allowed-tools` gained `Task` with a pre-approval comment; `hitl_why` updated to distinguish the intra-section ordered walk from the cross-section independent dispatch; `interactive_first_reward: schema_preview` added (pre-existing gap, Rule 3 fix).
- `skills/mos-reason/SKILL.md` - Hand-mirrored via `computeExpectedMirror()` to match the rewritten command (sensor_triggers desensitized to `[]`, allowed-tools normalized to the skill-spec string form, `${CLAUDE_PLUGIN_ROOT}` made portable, per the generator's existing exception classes -- no new exception introduced).
- `tests/test-265-mos-reason-fanout.cjs` - New 4-arm tripwire (ordering guard, no-third-copy, consolidation, stale-idiom).

## Decisions Made

See `key-decisions` in frontmatter for full rationale on: (1) keeping `hitl_shape: F.9` and only rewriting `hitl_why`, (2) declaring `interactive_first_reward: schema_preview` as a Rule 3 backfill, (3) hand-mirroring one skill file via the generator's exported function rather than running the full generator.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Skill-mirror drift blocked the Task 1 commit**
- **Found during:** Task 1 commit attempt (pre-commit hook)
- **Issue:** `scripts/build-skill-mirrors.cjs --check` failed with `mos-reason (DIVERGES)` because `skills/mos-reason/SKILL.md` was still the pre-rewrite mirror.
- **Fix:** Called the generator's own exported `computeExpectedMirror(srcBuf, 'mos-reason', currentBuf)` function directly (via a one-off Node invocation) and wrote only `skills/mos-reason/SKILL.md` with the result. This is the exact known-gate remediation named in the task prompt ("hand-mirror skills/mos-reason/SKILL.md -- do NOT run the full generator scripts"). Did not invoke `writeMirrors()` or the CLI's default write mode, which would touch every command's mirror.
- **Files modified:** `skills/mos-reason/SKILL.md`
- **Verification:** `node scripts/build-skill-mirrors.cjs --check` -> `OK (112 mirrors match expected content...)`; `git diff --stat skills/` shows only `mos-reason/SKILL.md` changed by this plan (the pre-existing unrelated `skills/file-meeting/SKILL.md` diff from a concurrent session was left untouched).
- **Committed in:** `467070b7` (part of Task 1 commit)

**2. [Rule 3 - Blocking issue] Missing interactive_first_reward blocked the Task 1 commit**
- **Found during:** Task 1 commit attempt (pre-commit hook, `scripts/check-reward-before-investment.cjs --staged`)
- **Issue:** `commands/mos-reason.md` had never declared `interactive_first_reward` (a pre-existing gap predating Phase 118-06's rollout, not introduced by this plan, but the staged-file linter blocks any commit touching a non-compliant command file).
- **Fix:** Declared `interactive_first_reward: schema_preview` with an inline comment explaining the choice, matching sibling swarm commands `act.md` and `persona.md` (same reward shape: structured output delivered directly on invocation, no form/menu/upload first).
- **Files modified:** `commands/mos-reason.md` (frontmatter only)
- **Verification:** `node scripts/check-reward-before-investment.cjs --staged` -> `compliant: 1, missing: 0, invalid: 0`.
- **Committed in:** `467070b7` (part of Task 1 commit)

**3. [Process note, not a code deviation] Extra `governing_thought`/`contradiction` offset check refined mid-Task-2**
- **Found during:** Task 2, first run of the new test
- **Issue:** The plan's initial arm 3 design (offset of the FIRST `governing_thought` occurrence in the whole file, relative to `Dispatching`) produced a false positive: the file's own objective/intro prose mentions "contradictions" (in explaining WHY the check exists) before PHASE 0, at an offset earlier than `Dispatching`. A naive `indexOf('contradiction')` picked up that legitimate earlier mention instead of the consolidation step's own occurrence.
- **Fix:** Arm 3 now searches for the first `contradiction` occurrence STARTING FROM the `Dispatching` offset (`text.indexOf('contradiction', dispatchIdx)`), then checks for a nearby `governing_thought` mention and the report-not-auto-edit language in a window around that occurrence. This is a test-authoring correction, not a change to `commands/mos-reason.md`.
- **Files modified:** `tests/test-265-mos-reason-fanout.cjs` (authored fresh in this plan, so this is not a revision of committed code)
- **Verification:** All 4 arms pass; both required negative proofs (below) confirmed.
- **Committed in:** `10ba991d` (part of Task 2 commit, since the test was not yet committed)

## Negative Proofs (recorded per plan acceptance criteria)

**Arm 1 (ordering guard):** Temporarily removed all occurrences of `vault-regenerate-all.cjs` from the file and reinserted a single occurrence immediately AFTER the `Dispatching` status block text. `node tests/test-265-mos-reason-fanout.cjs` exited 1, naming ARM 1 and the exact offsets (`vault-regenerate-all.cjs` offset 11099 vs `Dispatching` offset 11048). Reverted from a pre-edit backup; `diff` against the backup confirmed a byte-identical restore, and the test then exited 0.

**Arm 2 (no third copy):** Temporarily inserted a bare duplicate `<!-- STAGE_1_ESSENCE start -->` marker line immediately before the real sentinel block (no matching `end` marker paired with the fake one, so the drift test's `indexOf`-based extraction would span from the fake start through the real end). Result: `tests/test-265-mos-reason-fanout.cjs` exited 1 naming ARM 2 ("sentinel appears 2 time(s), expected exactly 1"), AND `node lib/memory/feynman-prompts-drift.test.cjs` also failed (`STAGE_1_ESSENCE drift at char 0`), confirming both tripwires catch the regression as the plan required. Reverted from the same backup; both tests passed again (drift: `4/4 prompts match`; fanout: `4 passed, 0 failed`).

Note: a first attempt at this proof (duplicating the FULL byte-identical block, sentinel-to-sentinel, appended right after the original) made ARM 2 fail correctly but did NOT make the drift test fail -- `feynman-prompts-drift.test.cjs`'s `indexOf`-based extraction is blind to a byte-identical duplicate pair appended after a complete, correctly-paired original block. The bare-duplicate-marker variant above was needed to also trip the drift test, matching the plan's specified proof.

## Registry / Grant Status

- `data/subagent-dispatch-grants.json` was NOT modified by this plan (`git diff --stat data/subagent-dispatch-grants.json` produces no output). The pre-existing row for `commands/mos-reason.md` (token `Task`, status `pending`, written by plan 265-12) is unchanged.
- `node tests/test-265-swarm-task-grant.cjs` reports `commands/mos-reason.md` as `unratified` (its allowed-tools now declares `Task`, matching the pending row's token, but the row's status stays `pending` until plan 265-23's single ratification write). This is the expected mid-phase state per the registry's own documented contract (`docs/SUBAGENT-DISPATCH-GRANTS.md` section 3). `TEST_265_GRANTS_STRICT` was NOT set for this run.

## Self-Check

- `test -f commands/mos-reason.md` -> FOUND
- `test -f skills/mos-reason/SKILL.md` -> FOUND
- `test -f tests/test-265-mos-reason-fanout.cjs` -> FOUND
- `git log --oneline --all | grep -q 467070b7` -> FOUND
- `git log --oneline --all | grep -q 10ba991d` -> FOUND
- `git diff --stat data/subagent-dispatch-grants.json` -> empty (confirmed untouched)
- `.planning/STATE.md`, `.planning/ROADMAP.md` -> not staged or modified by this plan

## Threat Flags

None. The rewritten command introduces no new network endpoint, no new auth path, and no new file-access pattern beyond what the threat_model in 265-14-PLAN.md already registers (T-265-60 through T-265-65, all pre-declared and mitigated by this plan's own changes: the ordering guard, the dispatch-time prompt read, the report-only coherence check, the registry-gated grant, and `planDispatch`'s budget governor).

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced.

## Self-Check: PASSED
