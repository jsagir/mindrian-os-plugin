---
phase: 108-graph-memory-schema-reconciliation
plan: "05"
subsystem: infra
tags: [pre-commit-hook, schema-drift-guard, sqlite-ddl, yaml-parser, alias-resolution, canon-part-9]

# Dependency graph
requires:
  - phase: 108-00
    provides: "Wave-0 test stub at tests/test-precommit-hook-aliases.cjs (replaced)"
  - phase: 108-04
    provides: ".planning/phases/108-graph-memory-schema-reconciliation/aliases.yml (loaded at hook invocation time)"
provides:
  - "scripts/check-schema-aliases.cjs - the pre-commit hook substrate (CJS, testable in isolation)"
  - "scripts/install-pre-commit.sh - opt-in one-line installer (tracked artifact; .git/hooks/pre-commit itself is NOT tracked)"
  - "5 SQL fixtures at tests/fixtures/phase-108/ covering in-alias / out-of-alias / additive / index-on-existing / index-on-missing-table"
  - "tests/test-precommit-hook-aliases.cjs - 7-test fixture-based suite (replaces Wave-0 stub)"
  - "Working enforcement of D-05 'do not invent parallel schema' at developer commit time"
affects: [109-sql-context-memory-navigation-spine, 110-brain-context-packet-contract, 112-room-budding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-house YAML parser pattern (third reuse: opportunity-ops.cjs original; tests/test-aliases-yaml-schema.cjs Plan 108-04; scripts/check-schema-aliases.cjs Plan 108-05) - candidate for extraction to lib/core/yaml-mini.cjs in a future refactor"
    - "Hook substrate as testable CJS module (exports pure function checkSqlAgainstAliases; CLI is a thin wrapper)"
    - "Fixture-based DDL test pattern (5 SQL strings + assertion suite + performance budget)"
    - "Tracked-script + opt-in-installer pattern for git hooks (avoids the .git/hooks tracking impossibility while still shipping the substrate)"

key-files:
  created:
    - scripts/check-schema-aliases.cjs
    - scripts/install-pre-commit.sh
    - tests/fixtures/phase-108/in-alias.sql
    - tests/fixtures/phase-108/out-of-alias.sql
    - tests/fixtures/phase-108/additive-column.sql
    - tests/fixtures/phase-108/index-on-existing.sql
    - tests/fixtures/phase-108/index-on-missing-table.sql
  modified:
    - tests/test-precommit-hook-aliases.cjs (replaced Wave-0 stub with 7-test suite)

key-decisions:
  - "Hook substrate is CJS-importable (checkSqlAgainstAliases / parseAliasesYaml / buildAllowedTableSet / formatViolation / ALLOWED_EXISTING_TABLES exports), not just a CLI - lets the test suite assert behavior directly without spawning child processes"
  - "ALLOWED_EXISTING_TABLES is a hardcoded constant (12 names from lazygraph-ops.cjs + memory-ops.cjs) because aliases.yml maps Codex node terms to graph node types, not SQL table names per se - per RESEARCH section 6 algorithm step 1"
  - "buildAllowedTableSet adds {canonical_name, lowercase, lowercase_audit} for every node_aliases entry with resolution in {EXISTS, EXTEND, NEW, RESERVED} - RESERVED is included so future Phase 112 commits creating budded_from-table are not blocked by hook bootstrapping order"
  - "ALTER TABLE ADD COLUMN is unconditionally allowed (additive per D-05) - regex match recorded informationally but no violations emitted"
  - "Performance budget assertion uses 500ms ceiling (RESEARCH section 6 budget is under 200ms warm; 500ms accommodates cold-start CI tolerance) - actual measured warm scan well under 50ms"

patterns-established:
  - "Tracked script + opt-in installer: when a feature requires a runtime artifact in an untracked location (.git/hooks/), ship the substrate as a tracked script + a shell installer that wires it; document the opt-in convention rather than try to enforce installation"
  - "Structured DDL violation messages: use a 3-section format (header + offense + resolution options) with Phase + Decision-ID anchored references so future contributors know where to look"
  - "In-house YAML re-use ledger: every site that parses aliases.yml (currently 3) is a candidate to fold into a single lib/core/yaml-mini.cjs - track the count to prevent silent divergence"

requirements-completed:
  - RECONCILE-108-05

# Metrics
duration: ~10min
started: "2026-05-03T11:46:00Z"
completed: "2026-05-03T11:56:29Z"
---

# Phase 108 Plan 05: Pre-Commit Schema Alias Drift Guard Summary

**Shipped scripts/check-schema-aliases.cjs (315 LOC CJS hook substrate that loads aliases.yml via in-house YAML parser, scans staged SQL DDL, fails commits that introduce out-of-alias CREATE TABLE or CREATE INDEX on missing tables) + scripts/install-pre-commit.sh opt-in installer + 5 SQL fixtures + 7-test fixture suite. D-05 'do not invent parallel schema' is now enforced at developer commit time, with the bypass policy (--no-verify + canon-amendment PR within 24h) documented in the installer.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-03T11:46:00Z
- **Completed:** 2026-05-03T11:56:29Z
- **Tasks:** 3
- **Files modified:** 8 (3 in scripts/ + 5 fixtures + 1 test rewrite)

## Accomplishments

- Pre-commit hook substrate (`scripts/check-schema-aliases.cjs`) parses `aliases.yml`, applies 3 DDL regexes (CREATE TABLE / CREATE INDEX / ALTER TABLE ADD COLUMN), and emits the canonical structured "SCHEMA DRIFT GUARD - PHASE 108" error message on out-of-alias drift. Zero new runtime dependencies; in-house YAML parser reused from Plan 108-04 (third occurrence in the codebase).
- Opt-in installer (`scripts/install-pre-commit.sh`) creates `.git/hooks/pre-commit` (or appends to an existing hook), idempotent across re-runs, with bypass-policy documentation embedded.
- 5 SQL fixtures at `tests/fixtures/phase-108/` covering the in-alias / out-of-alias / additive / index-on-existing / index-on-missing-table cases verbatim from RESEARCH section 8.
- 7-test fixture-based suite at `tests/test-precommit-hook-aliases.cjs` (replaces Plan 108-00 Wave-0 stub) - all 7 PASS, including a performance budget assertion (under 500ms ceiling for 5 fixture scans).
- Hook smoke test against all 5 fixtures: in-alias / additive / index-on-existing exit 0; out-of-alias / index-on-missing-table exit non-zero with the prescribed structured error message.
- Zero em-dashes / en-dashes in any new artifact (project hard rule honored).

## Task Commits

Each task was committed atomically with `--no-verify` (per parallel-execution flag from orchestrator):

1. **Task 1: Author scripts/check-schema-aliases.cjs (the hook substrate)** - `94ae256` (feat)
2. **Task 2: Create scripts/install-pre-commit.sh + 5 SQL fixtures** - `55f14e6` (feat)
3. **Task 3: Fill tests/test-precommit-hook-aliases.cjs (Wave-0 stub -> 5 fixture tests)** - `378dc62` (test)

_Plan metadata commit follows separately at orchestrator gate._

## Files Created/Modified

- `scripts/check-schema-aliases.cjs` (NEW, 315 LOC) - hook substrate. Exports `checkSqlAgainstAliases`, `parseAliasesYaml`, `buildAllowedTableSet`, `formatViolation`, `ALLOWED_EXISTING_TABLES`. CLI entry point supports `--sql <literal>`, `--file <path>`, or no-args (reads `git diff --cached`).
- `scripts/install-pre-commit.sh` (NEW, 56 LOC, executable) - opt-in installer. Idempotent (detects existing invocation, no-ops on re-run; warns + appends if a non-Phase-108 pre-commit already exists).
- `tests/fixtures/phase-108/in-alias.sql` (NEW) - CREATE TABLE banked_by_audit; expected exit 0.
- `tests/fixtures/phase-108/out-of-alias.sql` (NEW) - CREATE TABLE parallel_opportunities; expected exit non-zero with SCHEMA DRIFT GUARD message.
- `tests/fixtures/phase-108/additive-column.sql` (NEW) - 2x ALTER TABLE nodes ADD COLUMN; expected exit 0.
- `tests/fixtures/phase-108/index-on-existing.sql` (NEW) - CREATE INDEX on nodes + assumptions; expected exit 0.
- `tests/fixtures/phase-108/index-on-missing-table.sql` (NEW) - CREATE INDEX on nonexistent_table; expected exit non-zero.
- `tests/test-precommit-hook-aliases.cjs` (MODIFIED) - replaced 5-line Wave-0 stub with 113-line 7-test fixture-based suite using `node:assert/strict`.

## The 5 Fixture Scenarios + Expected Outcomes

| Fixture | DDL operation | Expected hook outcome | Why |
|---|---|---|---|
| `in-alias.sql` | `CREATE TABLE banked_by_audit` | exit 0 | `banked_by` is the lowercased canonical_name of the BANKED_BY entry in `aliases.yml` (resolution NEW); `buildAllowedTableSet` adds `{banked_by, banked_by_audit}` to the allow-set |
| `out-of-alias.sql` | `CREATE TABLE parallel_opportunities` | exit 1 + structured error | name is not in any node_aliases.canonical_name nor in ALLOWED_EXISTING_TABLES |
| `additive-column.sql` | 2x `ALTER TABLE nodes ADD COLUMN` | exit 0 | additive operations are unconditionally allowed per D-05 |
| `index-on-existing.sql` | 2x `CREATE INDEX` (target nodes + assumptions) | exit 0 | both target tables are in ALLOWED_EXISTING_TABLES (sourced from lazygraph-ops.cjs + memory-ops.cjs) |
| `index-on-missing-table.sql` | `CREATE INDEX idx_x ON nonexistent_table` | exit 1 + structured error | target table is not in any alias resolution nor in the hardcoded existing-tables list |

## Hook Bypass Policy

Per RESEARCH section 6 "Hook bypass policy":

- `git commit --no-verify` always bypasses the hook (this is git-native; the hook cannot prevent it).
- Phase 108 social convention: any `--no-verify` for schema work requires opening a canon-amendment PR within 24 hours.
- The installer documents this convention in its trailer output.
- The hook itself does NOT enforce the social convention - documentation only.

## Performance Budget Result

- RESEARCH section 6 budget: under 200ms warm for a typical staged-files scan.
- Test assertion ceiling: 500ms for 5 fixture scans (cold-start tolerance for CI).
- Measured (warm, local): all 5 fixture scans complete in single-digit milliseconds. Well within budget.
- Hook reads ~410-line `aliases.yml`, parses it via in-house YAML parser, runs 3 regexes against the input. No network, no spawn (except optional `git diff --cached` when no args given), no file I/O beyond aliases.yml.

## Decisions Made

- Hook substrate is a CJS-importable module, not just a CLI - the test suite asserts behavior directly via `require()`, no child-process spawning. The CLI entry point is a thin `if (require.main === module)` wrapper.
- `ALLOWED_EXISTING_TABLES` is hardcoded in the script (12 names) rather than re-derived from `aliases.yml` because aliases.yml maps Codex node terms to graph node types, not SQL table names. RESEARCH section 6 algorithm step 1 specifies this hardcoded list.
- `buildAllowedTableSet` includes RESERVED entries in the allow-set so future Phase 112 commits creating `budded_from`-table or `shares_assumption_with`-table are not blocked by hook bootstrapping order. Reserved entries are name-locked AND pre-allowed.
- Performance ceiling test uses 500ms (well above the 200ms warm budget) to accommodate CI cold-start variance. Measured warm scans are single-digit ms in practice.
- Test runner is `node:assert/strict` directly (no test framework) - matches `tests/test-cascade-side-channel.cjs` canonical pattern referenced in the plan.

## Deviations from Plan

None - plan executed exactly as written. All 3 tasks shipped with the contents prescribed in the `<action>` blocks. All 7 verify commands PASS.

The only minor variance was using "section 6 / section 8" prose phrasing in source comments instead of the literal "§6 / §8" glyphs that appeared in the plan body, to keep ASCII-only inside the script files. The plan body itself uses the section symbol; the implementation follows the project's "no special characters in scripts" hygiene.

## Issues Encountered

None. The hook smoke test produced the expected pass/fail outcomes on the first run for all 5 fixtures. The 7-test suite passed on the first run after the test file was written.

## User Setup Required

None - this is a developer-facing pre-commit hook. After cloning the repo, contributors run `bash scripts/install-pre-commit.sh` once to wire the hook locally. The installer is documented in the script header and prints clear next-step output (bypass command + canon-amendment PR convention).

## Hand-off to Plan 108-06

Plan 108-06 (parallel-safe with this plan; file-disjoint) ships:
- `PART-9-PROPOSAL.md` cross-reference checklist
- `docs/CANON-PHASE-MAP.md` row for Part 9 (proposed)
- `tests/test-canon-crossref-completeness.cjs` for canon cross-reference invariants

These artifacts complete the Phase 108 deliverable set. The pre-commit hook substrate from this plan (108-05) is independent of 108-06's documentation deliverables - they share no code or files.

## Note on the In-House YAML Parser

The same `parseAliasesYaml` function now appears in 3 places:

1. `tests/test-aliases-yaml-schema.cjs` (Plan 108-04 Task 2 - test-time validator)
2. `scripts/check-schema-aliases.cjs` (this plan - hook-time loader)
3. The future PROVENANCE invariant test (Phase 109 plan)

This is a deliberate trade-off: zero new dependencies (Phase 87 invariant) costs us a small amount of duplication. A future refactor candidate is to extract this function into `lib/core/yaml-mini.cjs` so all three sites import from a single source. Phase 108 does NOT do this extraction (out of scope - this plan adds NO `lib/core/*.cjs` edits per the workspace guard), but the receipt is filed here so a future Phase 109+ can pick it up.

## Self-Check: PASSED

Verified after writing this SUMMARY:

- `scripts/check-schema-aliases.cjs` - FOUND
- `scripts/install-pre-commit.sh` - FOUND
- `tests/fixtures/phase-108/in-alias.sql` - FOUND
- `tests/fixtures/phase-108/out-of-alias.sql` - FOUND
- `tests/fixtures/phase-108/additive-column.sql` - FOUND
- `tests/fixtures/phase-108/index-on-existing.sql` - FOUND
- `tests/fixtures/phase-108/index-on-missing-table.sql` - FOUND
- `tests/test-precommit-hook-aliases.cjs` (no longer a stub) - FOUND
- Commit `94ae256` (Task 1) - FOUND in git log
- Commit `55f14e6` (Task 2) - FOUND in git log
- Commit `378dc62` (Task 3) - FOUND in git log

## Next Phase Readiness

- Phase 108 plans 01-04 + 05 + 06 (in flight) all converge on the v1.13.0 release gate.
- Phase 109 (sql-context-memory-navigation-spine) can begin plan-phase as soon as Phase 108 closes - the schema is reconciled, the alias substrate is enforced at commit time, and the hook will catch any Phase 109 plan that drifts from the alias table.
- No blockers carried forward from this plan.

---
*Phase: 108-graph-memory-schema-reconciliation*
*Completed: 2026-05-03*
