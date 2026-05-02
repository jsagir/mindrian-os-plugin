---
phase: 104-per-command-jtbd-declarations
plan: "02"
subsystem: hmi-jtbd-declarations
tags: [jtbd, verification-harness, closed-vocab, reverse-coverage, canon-part-3, canon-part-7, canon-part-8]
canon_parts:
  - "Part 3 Tri-Context Decision Gate"
  - "Part 7 Reuse Before Build"
  - "Part 8 Graph Boundary"
requires:
  - "Phase 100-01 jtbd-taxonomy.json (13 canonical ids)"
  - "Phase 104-01 sweep (84 commands now declare serves_jtbd:)"
  - "Phase 104-00 Wave-0 stubs at tests/test-command-jtbd-{declarations,coverage}.cjs (replaced; paths preserved)"
provides:
  - "tests/test-command-jtbd-declarations.cjs (real assertion body; JTBDCONS-104-02)"
  - "tests/test-command-jtbd-coverage.cjs (real assertion body; JTBDCONS-104-03)"
affects:
  - "Feynman test runner now actively guards every-command-declares + every-JTBD-served invariants"
  - "Phase 104-03 (backward-compat fence) can land on a known-green declaration baseline"
tech_stack_added: []
tech_stack_patterns:
  - "In-house line-scan frontmatter parser (zero deps; mirrors lib/memory/validators/brain-md-invariants.cjs splitFrontmatterAndBody)"
  - "Per-test latency budget < 500ms warm; both tests run in 8-11ms"
  - "Exit-code triple {0 PASS, 1 FAIL, 77 SKIPPED} matches the runner contract in lib/memory/run-feynman-tests.cjs"
key_files_created: []
key_files_modified:
  - tests/test-command-jtbd-declarations.cjs
  - tests/test-command-jtbd-coverage.cjs
decisions:
  - "Use in-house regex + JSON.parse on the serves_jtbd: line instead of full YAML parsing. The Phase 104-01 sweep wrote every declaration as single-line JSON-array form (e.g. serves_jtbd: [\"explore\"]), which is also valid JSON; this lets us avoid adding js-yaml as a dependency (per Phase 87 zero-dep invariant) while still validating array-of-strings semantics."
  - "Coverage test SILENTLY SKIPS files whose serves_jtbd line fails to parse, deferring those errors to the sibling declarations test. This separates concerns: declarations.cjs is the authoritative parse-quality validator; coverage.cjs is the reverse-mapping orphan-finder."
  - "Both tests print per-line `ok` markers for operator visibility, mirroring the assertion-style used in tests/test-shape-f1.cjs (Phase 88.2-01) and tests/test-jtbd-command.cjs."
  - "Coverage test prints an informational per-id count table on success (not asserted) so operators can see distribution skew at a glance (audit-room 22, explore 22, surface-contradiction 2, etc.)."
  - "Did NOT touch the third stub tests/test-command-jtbd-backward-compat.cjs - that remains a stub for Plan 104-03 to fill, per the parallel-execution scope split."
  - "Did NOT touch CHANGELOG.md - Plan 104-03 owns the v1.12.4 entry (parallel-execution scope split)."
metrics:
  start: 2026-05-02T19:35:00Z
  end: 2026-05-02T19:39:25Z
  duration_minutes: 4
  task_count: 2
  file_count: 2
  warm_latency_ms_declarations: 11
  warm_latency_ms_coverage: 8
completed: 2026-05-02
---

# Phase 104 Plan 02: Verification Harness Summary

Replaced the two Wave-0 stubs `tests/test-command-jtbd-declarations.cjs` and `tests/test-command-jtbd-coverage.cjs` with real assertion bodies that guard the every-command-declares + every-JTBD-has-≥1-command invariants over the 84 commands swept by Plan 104-01.

## What shipped

### `tests/test-command-jtbd-declarations.cjs` (JTBDCONS-104-02)

Walks `commands/*.md`, parses YAML frontmatter via an in-house line-scan parser (zero dependencies; mirrors the `splitFrontmatterAndBody` pattern from `lib/memory/validators/brain-md-invariants.cjs`), and asserts:

  - **(a)** every command file has a `serves_jtbd:` field.
  - **(b)** the field is a non-empty JSON array of strings.
  - **(c)** every string resolves to one of the 13 canonical ids in `lib/hmi/jtbd-taxonomy.json` `entries[i].id` (closed-vocabulary enforcement; Canon Part 3 ten-verb principle applied to JTBDs).

Failure mode: lists every offending file with line number and a precise reason (missing field, malformed JSON, empty array, non-array, non-string element, non-canonical id).

### `tests/test-command-jtbd-coverage.cjs` (JTBDCONS-104-03)

Reverse-coverage scan: walks all 13 JTBD ids in the taxonomy and asserts each id appears in at least one `commands/*.md` `serves_jtbd:` declaration. The `explore` fallback id is explicitly checked because the F.6 selector-dispatcher fallthrough has no anchor without it.

On success the test ALSO prints an informational per-id count table (not asserted) so operators see the coverage distribution at a glance.

Failure mode: lists every orphan JTBD id (taxonomy entry that NO command serves) with operator hints for the `explore` fallback.

## How it lands in the runtime

The Phase 104-00 Wave-0 substrate already registered both test paths in `lib/memory/run-feynman-tests.cjs` lines 1070-1071. This plan replaced the stub bodies WITHOUT changing the registered paths, so the Feynman runner picked them up automatically on the next invocation. Plan 104-03 can now land its backward-compat fence on a known-green declaration baseline.

## Verification (against the swept tree)

```
$ node tests/test-command-jtbd-declarations.cjs
test-command-jtbd-declarations.cjs (Phase 104-02 JTBDCONS-104-02)
  ok  84 command files; all carry valid serves_jtbd declarations
  ok  closed-vocabulary check (13 canonical ids enforced)
  ok  latency 11ms (budget < 500ms)
EXIT=0

$ node tests/test-command-jtbd-coverage.cjs
test-command-jtbd-coverage.cjs (Phase 104-02 JTBDCONS-104-03)
  ok  all 13 canonical JTBD ids served by >= 1 command
  ok  explore fallback id served by 22 command(s)
       decide-pursue          served by 3 command(s)
       find-problem           served by 7 command(s)
       understand-market      served by 9 command(s)
       find-bottleneck        served by 8 command(s)
       prepare-pitch          served by 14 command(s)
       validate-idea          served by 7 command(s)
       compare-options        served by 7 command(s)
       connect-domains        served by 4 command(s)
       surface-contradiction  served by 2 command(s)
       plan-execution         served by 5 command(s)
       file-meeting           served by 3 command(s)
       audit-room             served by 22 command(s)
       explore                served by 22 command(s)
  ok  latency 8ms (budget < 500ms)
EXIT=0
```

Both tests pass. Both well under the 500ms warm-latency budget.

Note: the declarations test reports `find-bottleneck` served by 8 commands (not 9 as the 104-01-SUMMARY predicted). The deviation is harmless - the 104-01 count was a pre-merge estimate; the post-merge tree counted by the live coverage test is authoritative. All 13 canonical ids retain coverage >= 1.

## Acceptance criteria (all green)

- [x] `tests/test-command-jtbd-declarations.cjs` replaces the Wave-0 stub with real assertion logic.
- [x] `tests/test-command-jtbd-coverage.cjs` replaces the Wave-0 stub with real assertion logic.
- [x] Both tests pass (exit 0) against the 84-command swept tree.
- [x] Both tests run < 500ms warm (11ms + 8ms).
- [x] Closed-vocabulary check fires on non-canonical ids (logical structure verified: `canonicalIds.has(id) === false → fail`).
- [x] Reverse-coverage check fires on orphan ids (logical structure verified: `servedBy.get(id) === undefined → orphan`).
- [x] `explore` fallback id explicitly asserted (served by 22 commands today).
- [x] Zero new dependencies (Node built-ins only).
- [x] Both files committed atomically with descriptive messages and `--no-verify` per execution spec.
- [x] Registered test paths in `lib/memory/run-feynman-tests.cjs` lines 1070-1071 unchanged.
- [x] No commands modified (sweep already done by Plan 104-01).
- [x] No taxonomy changes (closed at 13 canonical ids).
- [x] Did NOT touch `tests/test-command-jtbd-backward-compat.cjs` (Plan 104-03 scope).
- [x] Did NOT touch `CHANGELOG.md` (Plan 104-03 scope).

## Per-task commit ledger

| Task | File                                       | Commit  |
|------|--------------------------------------------|---------|
| 1    | tests/test-command-jtbd-declarations.cjs   | 51cb63b |
| 2    | tests/test-command-jtbd-coverage.cjs       | 26e5472 |

## Deviations from Plan

### Workspace fast-forward (Rule 3 - Blocking)

- **Found during:** prologue (before Task 1).
- **Issue:** The user's prompt said `git fetch origin main && git merge --ff-only origin/main`, but on this worktree branch (`worktree-agent-a6c8be9ba0216bdaa`) `origin/main` was already at `a2f5f0f` matching HEAD; the 104-01 commits lived on local `main` at `911b9af`. Without merging local `main`, the `commands/*.md` files would still lack `serves_jtbd:` declarations and both tests would fail to validate against the swept tree.
- **Fix:** `git merge --ff-only main` to fast-forward the worktree branch to the local `main` HEAD (which carries the 104-01 sweep + Phase 104 directory). 84 files updated; `.planning/phases/104-per-command-jtbd-declarations/` materialized.
- **Files modified:** none by me; the merge introduced 84 commands + 104-01 artifacts.
- **Commit:** none (fast-forward; no merge commit).

### Plan files absent (Rule 2 - clarity note)

- **Found during:** prologue (before Task 1).
- **Issue:** The user's prompt referenced `.planning/phases/104-per-command-jtbd-declarations/104-02-PLAN.md` and `104-CONTEXT.md`, but neither exists in the tree even after the fast-forward. Only `104-01-SUMMARY.md` and `104-01-mapping-matrix.md` exist.
- **Resolution:** I worked from the `requirements:` text in `.planning/REQUIREMENTS.md` for `JTBDCONS-104-02` and `JTBDCONS-104-03` (which carries the full per-test contract verbatim) plus the `104-01-SUMMARY.md` for context. The user's prompt body itself also restated the success criteria. Implementation proceeded without ambiguity.
- **Files modified:** none.

### Count drift between predicted and actual (informational)

- **Found during:** Task 2 verification.
- **Issue:** `104-01-SUMMARY.md` predicted `find-bottleneck` served by 9 commands; the live coverage test counted 8.
- **Resolution:** Treated as informational. The live test count is authoritative and the canonical invariant (every JTBD id served by ≥ 1 command) is satisfied.
- **Files modified:** none.

## Tracking and follow-on

- Plan 104-03 will replace `tests/test-command-jtbd-backward-compat.cjs` (Wave-0 stub) and append the v1.12.4 CHANGELOG entry.
- No selector-dispatcher edits in this plan.
- No new commands shipped (Canon Part 7 honored).
- Tests are LOCAL filesystem scans; never queried against Brain (Canon Part 8 honored).
- Test files themselves contain ZERO Brain queries (`mcp__mindrian-brain__*` symbols not referenced).

## Self-Check: PASSED

- `tests/test-command-jtbd-declarations.cjs` exists: FOUND.
- `tests/test-command-jtbd-coverage.cjs` exists: FOUND.
- `.planning/phases/104-per-command-jtbd-declarations/104-02-SUMMARY.md` exists: FOUND.
- Commit `51cb63b` (declarations test) exists in `git log --oneline`: FOUND.
- Commit `26e5472` (coverage test) exists in `git log --oneline`: FOUND.
- Both tests exit 0 on direct invocation against the swept tree: VERIFIED (11ms + 8ms warm).
- Zero forbidden em-dashes in new content: VERIFIED.
