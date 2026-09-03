# Phase 267.2 - Deferred Items

Out-of-scope discoveries found during execution, logged here per the executor's SCOPE BOUNDARY
rule (only auto-fix issues directly caused by the current task's changes). Not fixed by any
267.2 plan unless explicitly noted otherwise.

## 1. `scripts/hooks/pre-commit` has drifted from `scripts/hooks/pre-commit-room-minto-guard.sh`

**Found during:** 267.2-03 Task 2/3 verification (`bash tests/run-all-267.3.sh`).

**Symptom:** `tests/run-all-267.3.sh`'s "245-02 staged gate (do-not-regress)" suite fails one
assertion: "both tracked hook copies remain byte-identical" - `scripts/hooks/pre-commit` must be
a byte copy of `scripts/hooks/pre-commit-room-minto-guard.sh`; both installers copy the canonical
file and a drift between them is exactly the Phase 125 bug this assertion guards against.

**Root cause:** commit `51f7bcb9` (`feat(254-03): wire WIRE-04 into pre-commit, release, and
doctor --acceptance`, 2026-09-02 18:34:37 +0300) added the WIRE-04 framework-vocabulary-drift
guardian block to `scripts/hooks/pre-commit` but never mirrored it into
`scripts/hooks/pre-commit-room-minto-guard.sh`. Confirmed via `diff` (23 lines present in
`pre-commit`, absent from the room-minto-guard copy) and `git log` (the divergence predates this
phase entirely - landed the day before 267.2 started).

**Scope:** neither file is touched by any 267.2-03 task (`scripts/session-start`,
`tests/test-267-1-first-install-hooked-audit.cjs`, `tests/test-267-2-w0-revert.cjs`). Confirmed
pre-existing and unrelated by timestamp and by `git blame`.

**Impact on this plan:** `bash tests/run-all-267.3.sh` and, by inclusion, `bash
tests/run-all-267.2.sh` both report one FAIL from this single pre-existing assertion. Every
267.2-03-owned assertion (`node tests/test-267-1-first-install-hooked-audit.cjs`, `node
tests/test-267-2-w0-revert.cjs`, `bash tests/run-all-267.1.sh`) is fully green. The plan's own
"Nothing else rides with it" scope discipline (CONTEXT.md D-06) forbids fixing this here.

**Recommended fix (for a future plan, likely 267.2-10 phase close or a standalone quick fix):**
sync `scripts/hooks/pre-commit-room-minto-guard.sh` from the canonical
`scripts/hooks/pre-commit` (or vice versa, whichever installer is authoritative per the Phase 125
autopsy), then re-run `bash tests/run-all-267.3.sh` to confirm green.

## 2. `node scripts/build-connector-registry.cjs --check` reports STALE, caused by a concurrent
session's uncommitted MCP-tool WIP, not by this plan

**Found during:** 267.2-07 Task 1-3 verification (the plan's own `<verification>` list names this
command).

**Symptom:** `data/connector-registry.json` and `data/mcp-tool-connectors.json` report STALE.

**Root cause:** `lib/mcp/tools/gate.cjs` and `lib/mcp/tools/views.cjs` carry uncommitted local
modifications from a concurrent session actively working on this same shared working tree (see
CLAUDE.md's Gate 0 / quick-260903 handoff threads; the `quick-260903-i2x-01` commit landed
mid-session between this plan's Task 2 and Task 3 commits). Those two files are genuine
`lib/mcp/tools/*` connector surfaces that this generator DOES scan (unlike
`scripts/first-install-router.cjs`, a `hooks/hooks.json` surface confirmed out of that
generator's scan scope by plan 267.2-06's own empirical `--check` run). Confirmed by grepping the
`--check` output for `first-install-router`/`mva-run`: zero matches, so this plan's own artifacts
are not implicated.

**Scope:** neither `lib/mcp/tools/gate.cjs` nor `lib/mcp/tools/views.cjs` is touched by any
267.2-07 task. During execution, a shared-index race (five prior executors this phase hit the
same class of hazard) twice swept these files' staged state into commits this plan was making;
both times the sweep was caught before pushing, the unrelated files were `git restore --staged`
back out, and this plan's own commits were re-made cleanly as single-file commits
(`7bf592a1`, `625028f2`, `803b38c1`, `a4726c08`). The files themselves were never edited or
reverted by this plan, only unstaged back to their pre-sweep working-tree state, leaving the
concurrent session's WIP exactly as it was for that session to commit under its own attribution.

**Recommended fix:** none owed by this plan. Regenerating the registry now would bake a
concurrent, still-in-progress session's uncommitted MCP-tool WIP into this plan's own scope,
which is out of bounds per the SCOPE BOUNDARY rule. Whichever session commits
`lib/mcp/tools/gate.cjs` / `views.cjs` next should run
`node scripts/build-connector-registry.cjs` as part of that commit.
