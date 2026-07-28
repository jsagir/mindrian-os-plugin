# Phase 235 deferred items

Out-of-scope discoveries found while executing 235-01. Logged, not fixed
(execute-plan.md scope boundary: only auto-fix issues directly caused by this
plan's own changes).

## D-235-01-a: pre-existing shape-declaration violations block `--strict-shape`

**Found during:** Task 2 verification (2026-07-28).

**What:** `node scripts/check-shape-declaration.cjs --check --strict` exits 1
against the current tree. Several mirrored skills declare BOTH a real
`hitl_shape` (a genuine Decision-Gate fork) AND `connector.excluded: true` (the
no-fork exemption) at the same time, which Canon Part 11 forbids:

- `skills/stance/SKILL.md` (F.0)
- `skills/update/SKILL.md` (F.0)
- `skills/vault/SKILL.md` (F.0)
- `skills/visualize/SKILL.md` (F.1)

**Why it is NOT a 235-01 regression:** these violations pre-date this plan.
235-01 only made the `--strict-shape` switch actually control the exit code; it
made no change to `scripts/check-shape-declaration.cjs` (the plan explicitly
says that file needs none) and no change to any skill frontmatter. The default
release path stays advisory exactly as Phase 210 decided, so no release
behavior changes today.

**Consequence:** `bash scripts/release.sh <version> --strict-shape` would abort
until these four skills are reconciled. That is the flag working as designed.

**Recovery when someone takes it on:** for each skill decide whether it truly
reaches a fork. If yes, drop `connector.excluded`. If no, drop `hitl_shape` and
keep the exclusion + reason. These skills are generated mirrors of their
commands (`scripts/build-skill-mirrors.cjs`), so the fix likely belongs in the
source `commands/<name>.md` or in the mirror generator's frontmatter handling,
not in the mirrored file.
