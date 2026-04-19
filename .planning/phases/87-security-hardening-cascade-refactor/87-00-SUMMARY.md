---
phase: 87
plan: 00
subsystem: test-fixtures
tags: [cascade, testing, acceptance-gate, fixture, 87-00, wave-0]
requirements:
  - CASCADE-01
  - CASCADE-02
dependency_graph:
  requires: []
  provides:
    - test/fixtures/cascade-e2e/cascade-e2e.test.cjs
    - test/fixtures/cascade-e2e/expected-edges.json
    - test/fixtures/cascade-e2e/generate-baseline
    - seed-room with 3 artifacts across 3 sections
  affects:
    - lib/memory/run-feynman-tests.cjs (discovery + exit-77 handling)
    - Plan 87-03 (now has a frozen acceptance gate)
tech_stack:
  added: []
  patterns:
    - hermetic tmp-dir fixture copy via fs.cpSync
    - POSIX exit 77 == SKIPPED (test-infra-broken)
    - snapshot / assert dual mode for baseline regeneration
key_files:
  created:
    - test/fixtures/cascade-e2e/README.md
    - test/fixtures/cascade-e2e/seed-room/.room-root
    - test/fixtures/cascade-e2e/seed-room/ROOM.md
    - test/fixtures/cascade-e2e/seed-room/MINTO.md
    - test/fixtures/cascade-e2e/seed-room/STATE.md
    - test/fixtures/cascade-e2e/seed-room/problem-definition/ROOM.md
    - test/fixtures/cascade-e2e/seed-room/problem-definition/MINTO.md
    - test/fixtures/cascade-e2e/seed-room/problem-definition/jtbd-underservice.md
    - test/fixtures/cascade-e2e/seed-room/market-analysis/ROOM.md
    - test/fixtures/cascade-e2e/seed-room/market-analysis/MINTO.md
    - test/fixtures/cascade-e2e/seed-room/market-analysis/s-curve-mature-market.md
    - test/fixtures/cascade-e2e/seed-room/solution-design/ROOM.md
    - test/fixtures/cascade-e2e/seed-room/solution-design/MINTO.md
    - test/fixtures/cascade-e2e/seed-room/solution-design/niche-within-mature.md
    - test/fixtures/cascade-e2e/cascade-e2e.test.cjs
    - test/fixtures/cascade-e2e/expected-edges.json
    - test/fixtures/cascade-e2e/generate-baseline
  modified:
    - lib/memory/run-feynman-tests.cjs
decisions:
  - STATE.md added to seed-room so intelligence-cascade.findRoomDir() resolves the room root
  - Test copies seed-room into tmpDir/rooms/cascade-fixture/ so runtime path contains /rooms/ (isRoomFile guard)
  - INVALIDATES baseline keyed under hard_if_hsi even though it is HSI-independent today (forward compat)
  - exit 77 is the POSIX "test infra broken" sentinel; feynman runner now distinguishes skip from fail
metrics:
  duration: ~45min
  tasks_completed: 2
  files_created: 17
  files_modified: 1
  commits: 2
  feynman_before: 17/17
  feynman_after: 18/18
completed: 2026-04-19
---

# Phase 87 Plan 87-00: Cascade E2E Integration Test Fixture Summary

Frozen acceptance gate for Plan 87-03 (cascade deduplication refactor). A hermetic fixture ships a seeded Data Room with three cross-linked artifacts, a baseline snapshot of the edges the intelligence cascade produces against that seed, and an integration test that asserts observed edge counts exactly match the baseline (no `>= 1` soft thresholds). If Plan 87-03 changes the observable cascade behavior, the test exits 1 and Plan 87-03 is rolled back.

## One-liner

Test/fixtures/cascade-e2e/ ships a seeded room + frozen baseline (INFORMS=3, CONTRADICTS=1, CONVERGES=0, INVALIDATES=1) + exact-match integration test + Feynman-runner integration with POSIX exit-77 skip semantics, gating Plan 87-03 with a rollback policy.

## Fixture Artifact Map

```
test/fixtures/cascade-e2e/
├── README.md                      # Purpose, exit codes, rollback policy, regeneration workflow
├── expected-edges.json            # Frozen baseline (regenerate via ./generate-baseline only)
├── generate-baseline              # Bash wrapper: invokes test in --snapshot mode
├── cascade-e2e.test.cjs           # Hermetic integration test (246 lines)
└── seed-room/
    ├── .room-root                 # Sentinel for Plan 87-01a pre-commit hook
    ├── ROOM.md                    # Room identity (decision #15)
    ├── MINTO.md                   # Room-level governing thought
    ├── STATE.md                   # Room-root marker for findRoomDir()
    ├── problem-definition/
    │   ├── ROOM.md
    │   ├── MINTO.md
    │   └── jtbd-underservice.md   # Claim: JTBD 20/20 underservice
    ├── market-analysis/
    │   ├── ROOM.md
    │   ├── MINTO.md
    │   └── s-curve-mature-market.md  # Claim: late-growth mature market (CONTRADICTS)
    └── solution-design/
        ├── ROOM.md
        ├── MINTO.md
        └── niche-within-mature.md    # Claim: niche within mature (INVALIDATES)
```

## Edge-Type to Test-Assertion Mapping

| Edge type   | Creator                                       | HSI-dependent? | Baseline                      | Assertion                |
|-------------|-----------------------------------------------|----------------|-------------------------------|--------------------------|
| INFORMS     | lazygraph-ops.indexArtifact via wikilinks     | No             | `edges.INFORMS.hard = 3`      | exact `strictEqual`      |
| CONTRADICTS | indexArtifact via CONTRADICT_TERMS near links | No             | `edges.CONTRADICTS.hard = 1`  | exact `strictEqual`      |
| CONVERGES   | (not created by indexArtifact; HSI-path)      | Yes            | `hard_if_hsi = 0`, `soft_if_no_hsi = 0` | branch on `HSI_AVAILABLE` |
| INVALIDATES | indexArtifact via `invalidates:` frontmatter  | No (today)     | `hard_if_hsi = 1`, `soft_if_no_hsi = 0` | branch on `HSI_AVAILABLE` |

The three INFORMS edges trace: `market-analysis -> problem-definition` (one), `solution-design -> problem-definition` (two), `solution-design -> market-analysis` (three). Filing order matters: p-d is indexed first and has no resolvable wikilink targets; m-a follows and finds p-d; s-d is last and finds both.

## Frozen Baseline (content of expected-edges.json)

```json
{
  "_comment": "Frozen baseline for 87-03 acceptance gate. Regenerate via ./generate-baseline. Do NOT edit by hand.",
  "_seed_version": "2026-04-19",
  "_captured_at": "2026-04-19T10:08:55.321Z",
  "_hsi_available_at_capture": true,
  "edges": {
    "INFORMS":     { "hard": 3 },
    "CONTRADICTS": { "hard": 1 },
    "CONVERGES":   { "hard_if_hsi": 0, "soft_if_no_hsi": 0 },
    "INVALIDATES": { "hard_if_hsi": 1, "soft_if_no_hsi": 0 }
  }
}
```

## Exit Code Convention (POSIX / make-test)

| Code | Meaning                              | Plan 87-03 action     |
|------|--------------------------------------|-----------------------|
| 0    | All assertions passed                | Refactor is safe      |
| 1    | Assertion FAILED (real regression)   | **Rollback required** |
| 77   | Environment degraded (SKIPPED)       | Install deps; do NOT rollback |

The Feynman runner was updated to classify exit 77 as SKIPPED separately from FAILED. Report now shows `passed / skipped / failed` counts. Verified: with python3 hidden from PATH, cascade-e2e exits 77 and the runner logs `SKIP test/fixtures/cascade-e2e/cascade-e2e.test.cjs (exit 77, env degraded)` -- no false-failure signal.

## Baseline Regeneration Workflow

1. Run `bash test/fixtures/cascade-e2e/generate-baseline`. This executes the test in `--snapshot` mode, which runs the cascade against the current seed room and writes observed edge counts to `expected-edges.json`.
2. Inspect `git diff test/fixtures/cascade-e2e/expected-edges.json`. Counts must change only in ways you expect (e.g. added a seed artifact, or the cascade intentionally gained a new edge type).
3. Commit seed change and new baseline together.

Do NOT hand-edit `expected-edges.json` -- the script is the only supported regeneration path.

## Rollback Trigger Command (Plan 87-03)

If `node test/fixtures/cascade-e2e/cascade-e2e.test.cjs` returns exit 1 after Plan 87-03 lands:

```bash
git log --oneline --grep='87-03' | head -3                 # find the 87-03 commit
git revert <87-03-commit-sha>                              # revert (new commit, no history rewrite)
```

No exceptions. No "let me just tweak the refactor." The fixture exists so that the cascade's observable behavior stays bit-identical through the refactor. Any divergence means the refactor failed and must be re-attempted from a clean base.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added STATE.md to seed-room**
- **Found during:** Task 0-1 authoring
- **Issue:** intelligence-cascade.findRoomDir walks up looking for STATE.md to identify the room root. Without it, `roomDir` cannot be resolved and the cascade skips every artifact with `skipReason: 'roomDir not found or does not exist'`.
- **Fix:** Added a minimal `seed-room/STATE.md` stating the file is a room-root marker for the fixture.
- **Files modified:** test/fixtures/cascade-e2e/seed-room/STATE.md (new)
- **Commit:** 403f3f3

**2. [Rule 3 - Blocking] Tmp dir path must contain `/rooms/`**
- **Found during:** Task 0-2 harness design
- **Issue:** `intelligence-cascade.isRoomFile()` checks for `/room/` or `/rooms/` in the file path. The plan's code sketch uses `fs.cpSync(FIXTURE_DIR, tmpDir, { recursive: true })` where `tmpDir` is `mkdtempSync(..., 'cascade-e2e-')` -- the path contains `cascade-e2e-XXXX` but NOT `/rooms/`. Every cascade call would skip with `filePath not inside a room directory`.
- **Fix:** Test creates `tmpParent = mkdtempSync(...)`, then copies seed-room into `tmpParent/rooms/cascade-fixture/`. Runtime path now contains `/rooms/` and cleanup still uses a single `rmSync(tmpParent, { recursive: true })`.
- **Files modified:** test/fixtures/cascade-e2e/cascade-e2e.test.cjs
- **Commit:** 4e0ae88

**3. [Rule 2 - Missing functionality] BSL 1.1 license headers**
- **Found during:** Drafting; CLAUDE.md / 87-CONTEXT.md invariant requires BSL on new source files.
- **Issue:** Plan's task spec did not explicitly add BSL header text to test/fixture files.
- **Fix:** Added `license: BSL-1.1` frontmatter to all seed-room .md files and explicit "Business Source License 1.1" / "BSL-1.1" references in the test harness header, generate-baseline header, ROOM.md, and README.md.
- **Commit:** Both (seed files in 403f3f3, harness in 4e0ae88).

### Unchanged

- Plan's task structure (0-1 seed, 0-2 harness) preserved.
- Plan's baseline shape with `hard_if_hsi / soft_if_no_hsi` split preserved.
- Plan's acceptance criteria (grep counts, exit codes, hermetic lifecycle) preserved.
- Plan's rollback policy text in README preserved.

## Authentication Gates

None.

## Self-Check

- test/fixtures/cascade-e2e/seed-room/.room-root: FOUND
- test/fixtures/cascade-e2e/expected-edges.json: FOUND
- test/fixtures/cascade-e2e/generate-baseline: FOUND (executable)
- test/fixtures/cascade-e2e/cascade-e2e.test.cjs: FOUND
- Commit 403f3f3: FOUND
- Commit 4e0ae88: FOUND
- Feynman runner exit 0: VERIFIED
- cascade-e2e.test.cjs exit 0: VERIFIED
- cascade-e2e.test.cjs exit 77 path: VERIFIED (env -i PATH=node-only run)

## Self-Check: PASSED
