# Cascade E2E Fixture (Plan 87-00)

This directory holds the frozen fixture that gates Plan **87-03** (intelligence
cascade deduplication refactor). It ships a seeded Data Room, a baseline
snapshot of the edges the cascade produces against that seed, and an
integration test that asserts the produced edges match the baseline
exactly.

If Plan 87-03 breaks this test, Plan 87-03 is rolled back. No exceptions.

## Purpose

Plan 87-03 touches roughly 250 lines across `runCascade` and `queueCascade`
in `lib/core/intelligence-cascade.cjs`. Without an end-to-end acceptance test
that asserts the full edge set against a frozen baseline (not a `>= 1` soft
threshold), a subtle regression would ship silently. This fixture is the
safety net.

## What is here

- `seed-room/` -- a seeded Data Room with three artifacts across three
  sections (`problem-definition`, `market-analysis`, `solution-design`), plus
  ROOM.md + MINTO.md + STATE.md. Contains a `.room-root` sentinel so the
  Plan 87-01a pre-commit hook fires on this subtree.
- `expected-edges.json` -- the frozen baseline. Authoritative. Exact counts
  per edge type. Regenerate via `./generate-baseline` whenever seed data
  changes; never hand-edit.
- `generate-baseline` -- regeneration script. Wraps the test harness in
  snapshot mode and writes `expected-edges.json` from current cascade output.
- `cascade-e2e.test.cjs` -- the integration test. Copies `seed-room/` to a
  temp dir, runs the cascade against each artifact, reads `.mindrian/room.db`,
  and asserts the observed edge counts against the frozen baseline.

## How to run

From the repository root:

```bash
# Run the test (ASSERT mode; exits 0 on pass, 1 on regression, 77 on env skip)
node test/fixtures/cascade-e2e/cascade-e2e.test.cjs

# Regenerate the baseline from current seed data (writes expected-edges.json)
bash test/fixtures/cascade-e2e/generate-baseline
```

The test is also discovered and executed by the feynman runner:

```bash
MINTO_FROZEN_DATE=2026-04-14 node lib/memory/run-feynman-tests.cjs
```

## Exit code convention (POSIX + make-test)

| Code | Meaning | Action |
|------|---------|--------|
| 0    | All assertions passed | Continue; Plan 87-03 is safe to ship. |
| 1    | Assertion FAILED -- real regression | **Triggers Plan 87-03 rollback**. |
| 77   | Environment degraded (Python or `scripts/classify-insight` missing) | Test SKIPPED. Not a failure. Install missing deps and retry. |

Feynman runner treats exit 77 as SKIPPED, not FAILED. CI must preserve this
distinction -- a 77 on the cascade-e2e test is a missing Python, not a
cascade regression.

## Rollback policy (Plan 87-03 acceptance gate)

If `node test/fixtures/cascade-e2e/cascade-e2e.test.cjs` returns exit code 1
after Plan 87-03 ships, the refactor is rolled back. The rollback command:

```bash
# Find the 87-03 commit
git log --oneline --grep='87-03' | head -3

# Revert it (creates a new revert commit; does not rewrite history)
git revert <87-03-commit-sha>
```

No exceptions. No "let me just tweak the refactor." The fixture exists so
that the cascade's observable behavior stays bit-identical through the
refactor. Any divergence means the refactor failed and must be re-attempted
from a clean base.

## Baseline regeneration workflow

The baseline is **frozen before Plan 87-03 begins**. After that freeze, the
only legitimate reasons to regenerate are:

1. The seed-room content is intentionally changed (rare; requires a separate
   commit that changes both seed files and baseline).
2. The cascade's intended semantics changed outside 87-03 (e.g. a future
   phase adds a new edge type and the baseline needs to capture it).

Regeneration steps:

```bash
# 1. Regenerate the snapshot from current cascade + seed data
bash test/fixtures/cascade-e2e/generate-baseline

# 2. Inspect the diff -- counts must change only in ways you expect
git diff test/fixtures/cascade-e2e/expected-edges.json

# 3. Commit both seed changes and new baseline in the same commit
git add test/fixtures/cascade-e2e/seed-room/ test/fixtures/cascade-e2e/expected-edges.json
git commit -m "test(cascade-e2e): regenerate baseline after <reason>"
```

## `.room-root` sentinel integration

The seed room contains an empty `.room-root` file. This marks the subtree as
a Data Room for Plan 87-01a's pre-commit hook. The hook then enforces that
every directory in this subtree has ROOM.md + MINTO.md, which validates the
CLAUDE.md decision #15 invariant on our own test data. If a future edit
removes ROOM.md or MINTO.md from any seed subdirectory, the hook refuses the
commit and the fixture self-heals.

## License

BSL 1.1. See `LICENSE` at the repository root.
