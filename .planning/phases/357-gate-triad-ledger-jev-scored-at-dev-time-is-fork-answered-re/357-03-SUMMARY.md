---
phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
plan: 03
subsystem: testing
tags: [jev, egress-guard, part8, shared-client, policy]

# Dependency graph
requires:
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
    plan: 01
    provides: "scripts/card-fire-replay-corpus.cjs, tests/fixtures/card-fire-replay/pre-phase.json"
  - phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-
    plan: 02
    provides: "scripts/jev-devtime-client.cjs (exact_state_v1 kind, makeEgressGuard, jev, pool, EGRESS_PROFILES)"
  - phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-
    plan: 07
    provides: "the three exact_state_v1 optional fields card_fire_replay needs: string_keys, question_max_len, question_strings_from_file_key"
provides:
  - "data/jev-policies/card-fire-replay.json: three independent Noul policies (is_fork, already_answered, relevant) in the Noul-native shape"
  - "scripts/jev-devtime-client.cjs EGRESS_PROFILES.card_fire_replay: exact_state_v1 profile, additive, no schema change"
  - "data/ROOM.md row for the new policy file"
affects: [357-04, 357-05, 357-06, 357-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PRESENT branch consumption of a shared cross-phase file: re-read scripts/jev-devtime-client.cjs from disk immediately before editing, confirm no peer diff, confirm every optional exact_state_v1 field the new profile needs already exists (356-02 kind/max_len_by_key/must_equal_file plus 356-07 string_keys/question_max_len/question_strings_from_file_key), then add ONE frozen profile entry and commit within the same task -- no schema pieces needed adding"
    - "Policy-file boundary-case tagging ([false]/[true] prefix per string) mirrors data/jev-policies/command-irreversibility.json's [carries the brand]/[stays in the room] tag precedent, kept as plain strings (never objects) so question_strings_from_file_key's exact-string membership check matches them"

key-files:
  created:
    - data/jev-policies/card-fire-replay.json
  modified:
    - scripts/jev-devtime-client.cjs
    - data/ROOM.md

key-decisions:
  - "PLAN_BASE = 31fa9ac44f0cd82f4a29779f602af518d9809d03 (HEAD at plan start)"
  - "Branch taken: PRESENT. scripts/jev-devtime-client.cjs already existed (last touched by 354-17's 78852f333, before that 356-02's 7336e5215), clean (no peer diff), and already carried every exact_state_v1 optional field card_fire_replay needs (max_len_by_key, must_equal_file, string_keys, question_max_len, question_strings_from_file_key, all proven live on the existing material_step_ledger profile). No schema pieces were missing, so no peer message to jsagi-a7 was needed -- Task 2 step 2 (add-missing-schema-pieces) did not fire."
  - "data/ROOM.md already had a jev-policies/ row (356's command-irreversibility.json entry); per the plan, added the 357 file as its own separate row without touching 356's row."
  - "Policy instructions state the three read keys explicitly (output_text/gate_subject_text for is_fork; preceding_user_text for already_answered; gate_subject_text + preceding_user_text for relevant) plus the gate_shape enum (F.1, F.8, backstop) and turns_since_gate (0 or 1+), per the plan's action-step wording, so the policy is self-contained and never inferred (policy-execution-parity skill requirement)."

patterns-established:
  - "One profile per builder, never a union (D-08 upheld): card_fire_replay is the fourth EGRESS_PROFILES entry, added purely additively (git diff shows 0 removed lines against PLAN_BASE)."

requirements-completed: [GATE357-03]

# Metrics
duration: 25min
completed: 2026-09-23
---

# Phase 357 Plan 03: card_fire_replay Egress Profile and Noul Policies Summary

**One additive EGRESS_PROFILES entry (card_fire_replay, exact_state_v1) on the already-present shared scripts/jev-devtime-client.cjs, plus the three independent Noul policies (is_fork, already_answered, relevant) in data/jev-policies/card-fire-replay.json that the Phase 357 dev-time labeler will state verbatim in every request.**

## Performance

- **Duration:** ~25 min (excluding read/context-gathering time)
- **Started:** 2026-09-23T17:52:44Z (PLAN_BASE recorded)
- **Completed:** 2026-09-23T20:55:02+03:00 (Task 2 commit)
- **Tasks:** 2/2 completed
- **Files modified:** 1 created, 2 modified

## Accomplishments

- Confirmed PRESENT branch: `scripts/jev-devtime-client.cjs` exists, clean, and already carries the `exact_state_v1` kind plus all five optional fields (`max_len_by_key`, `must_equal_file`, `string_keys`, `question_max_len`, `question_strings_from_file_key`) card_fire_replay needs -- no schema addition and no peer message required.
- `data/jev-policies/card-fire-replay.json` written: three standalone, never-compared Noul policies (`is_fork` 7 boundary cases, `already_answered` 5, `relevant` 5), each `instructions` naming its read keys, the `gate_shape` enum and the `turns_since_gate` meaning; `criteria` an object with `true`/`false` string glosses; every `boundary_cases` entry a plain string. File is 7365 bytes (floor 12000), zero em-dashes.
- `data/ROOM.md` row added for the new file, alongside (not replacing) 356's existing `jev-policies/` row.
- `EGRESS_PROFILES.card_fire_replay` added to `scripts/jev-devtime-client.cjs`: `exact_state_v1`, six state keys (`output_text`, `preceding_user_text`, `gate_subject_text`, `gate_shape`, `turns_since_gate`, `policy`), caps on the three free-text keys, `must_equal_file` pinned to the new policy file, three question ids matching the three policies, `question_strings_from_file_key: 'policy'`. Purely additive: `git diff PLAN_BASE -- scripts/jev-devtime-client.cjs` shows 0 removed lines.
- Five guard smoke outcomes proven live (see below), plus the full plan verify commands, the phase-level em-dash/protected-file/api.typesafe.ai checks, `tests/test-353-tripwires.cjs` (PASS=5 FAIL=0) and `tests/test-356-jev-client.cjs` (103 checks, keyless, zero network egress).

## Task Commits

Each task was committed atomically:

1. **Task 1: The three Noul policies (data/jev-policies/card-fire-replay.json) and the data/ROOM.md row** - `cc8d3f2be` (feat)
2. **Task 2: Shared client card_fire_replay profile (PRESENT branch, purely additive)** - `db937d405` (feat)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `data/jev-policies/card-fire-replay.json` - three Noul policies (is_fork, already_answered, relevant), noul_mapping thresholds (0.80/0.20)
- `data/ROOM.md` - one new row for the policy file, 356's row untouched
- `scripts/jev-devtime-client.cjs` - one new frozen `EGRESS_PROFILES.card_fire_replay` entry, exact_state_v1, purely additive

## Decisions Made

See `key-decisions` in the frontmatter: PRESENT branch with no schema gaps, no peer message needed, 356's ROOM.md row left untouched with a sibling row added, and policy instructions stating the read keys and gate_shape/turns_since_gate enums explicitly per the plan's action text.

## Deviations from Plan

None - plan executed exactly as written. The client was PRESENT with every optional `exact_state_v1` field already in place, so Task 2's ABSENT-branch extraction and the missing-schema-piece addition (step 2) never needed to fire.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. No network call is made by this plan (the guard smoke checks run entirely local, `jev()` itself is never invoked).

## Peer messages (to relay)

None needed. The shared client already carried every schema piece this plan required; no schema-widening message to jsagi-a7 (356) or jsagi-25 (354-17) was generated.

## Verification Results

- Task 1 verify (`node -e` structural check): `ok`, 7365 bytes.
- Task 1 acceptance: `is_fork:7, already_answered:5, relevant:5` (all >= floor); em-dash grep 0; `data/ROOM.md` grep count 1, 0 removed lines against PLAN_BASE.
- Task 2 verify (`node -e` guard smoke): `ok`.
- Five guard smoke outcomes (Task 2 step 5): (1) valid body returns `true`; (2) one-byte policy change throws `EGRESS_REFUSED` naming `policy`; (3) extra state key `room` throws naming `room`; (4) `output_text` at 4001 chars throws naming `output_text`; (5) a `rule` string not present in the policy file throws naming `is_fork.instructions.rule`.
- Profile key list before: `section_command_ledger, material_step_ledger, framework_command_ledger`. After: `+ card_fire_replay`. Only one profile added.
- `git diff PLAN_BASE -- scripts/jev-devtime-client.cjs | grep '^-' | grep -v '^---' | wc -l` -> `0` (purely additive).
- `grep -v '^\s*//' scripts/jev-devtime-client.cjs | grep -c "require(.*lib/"` -> `0`.
- `node tests/test-353-tripwires.cjs` -> PASS=5 FAIL=0, exit 0.
- `env -u TYPESAFE_API_KEY node tests/test-356-jev-client.cjs` -> PASS (103 checks), exit 0, including a dedicated `card_fire_replay` frozen-profile leg in section (a).
- `git status --short -- scripts/eval-icm-writers.cjs tests/test-353-grader-agreement.cjs tests/test-353-ledger-shape.cjs` unchanged from plan-start (still the pre-existing unowned diffs from 356's deferred 353-builder refactor; not touched by this plan).
- `grep -c em-dash scripts/jev-devtime-client.cjs` -> `0`.
- Phase-level verification: `grep -rn "api.typesafe.ai" lib/ hooks/` -> empty. Protected-file check (`lib/mcp/brain-router`, `lib/core/write-lock`, `lib/core/part8-egress-guard`, `scripts/doctor`, `lib/core/graph-ops`, `scripts/eval-icm-writers`, `tests/test-353-grader-agreement`, `tests/test-353-ledger-shape`, `lib/core/navigation`, `docs/OPEN-HANDOFFS.md`) against `PLAN_BASE..HEAD` -> empty (this plan's own diff touches only `data/jev-policies/card-fire-replay.json`, `data/ROOM.md`, `scripts/jev-devtime-client.cjs`; `.planning/ROADMAP.md` and an unrelated `361-07-SUMMARY.md` also appear in the wider diff, both from concurrent peer/orchestrator activity on `main`, not this plan).

## Next Phase Readiness

- `scripts/label-card-fire-replay.cjs` (plan 04) can now `require('./jev-devtime-client.cjs')`, build its guard as `makeEgressGuard(EGRESS_PROFILES.card_fire_replay, {root})`, and read the policy path from `EGRESS_PROFILES.card_fire_replay.must_equal_file.policy` rather than hardcoding it a second time.
- Plan 04's refusal test can turn this plan's five recorded smoke outcomes directly into test legs.
- No runtime file (`lib/`, `hooks/`, `scripts/check-card-fire.cjs`) was touched in this plan.
- The 356 353-builder refactor deferral (`scripts/eval-icm-writers.cjs`, `tests/test-353-grader-agreement.cjs`, `tests/test-353-ledger-shape.cjs` still dirty) remains open and out of this plan's scope; unowned, left untouched.

---
*Phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re*
*Plan: 03*
*Completed: 2026-09-23*
