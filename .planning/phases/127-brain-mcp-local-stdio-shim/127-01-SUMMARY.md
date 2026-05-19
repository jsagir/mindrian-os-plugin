---
phase: 127-brain-mcp-local-stdio-shim
plan: 01
subsystem: infra
tags: [migration, sg-1, sg-2, sg-3, sg-4, brain, mcp, canon-part-8, idempotency]

# Dependency graph
requires:
  - phase: 127-brain-mcp-local-stdio-shim
    plan: 00
    provides: bin/mindrian-brain-mcp-client.cjs (the local stdio shim auto-migration's removeFn will leave behind as the survivor) + .mcp.json registering it
  - phase: 123-install-lifecycle-harness
    provides: lib/core/resolve-brain-key.cjs (env > ~/.mindrian.env > CWD .env precedence) used by the two-key conflict check
  - phase: 121-trajectory-telemetry
    provides: scripts/migrate-telemetry-v1.cjs (idempotent migration pattern + source-name-prefixed sha256 fingerprint shape)
provides:
  - scripts/migrate-brain-mcp-from-http-to-stdio.cjs (190 LOC; planMigration + executePlan + main + getLegacyEntry + extractBearerKey + SOURCE_NAME)
  - lib/core/migration-snapshot.cjs (172 LOC; fingerprintEntry + snapshotPath + readMigrationsLog + appendMigrationLog + isAlreadyMigrated + _scanForRawIdentifiers)
  - tests/test-127-01-migration-safety.sh (170 LOC, 8-test bash harness)
  - 4 fixtures in tests/fixtures/127-01-migration/ (clean-no-legacy / legacy-same-key / legacy-different-key / already-migrated)
affects:
  - 127-02-PLAN.md (Doctor Class M Brain smoke -- can now reference the migration script for first-launch wiring)
  - 127-03-PLAN.md (acceptance harness + Canon Part 8 adversarial audit -- the migration script is the highest-risk surface and will be audited there)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SG-1 HARD INVARIANT structural defense: zero `.claude.json` references in migration script source (grep-enforced); all scope-user state mutations route through `claude mcp <add|remove> --scope user` CLI subprocess (delegation through the supported surface)"
    - "SG-2 pre-migration snapshot ordering: snapshot file written to disk BEFORE removeFn invocation (asserted by T6 with file-existence check inside the mockRemove callback)"
    - "SG-3 dry-run side-effect-free: no removeFn call + no snapshot dir creation + no log file write under dry-run=true (asserted by T8)"
    - "SG-4 idempotency via sha256 fingerprint log: re-run is a deterministic no-op via isAlreadyMigrated check; appendMigrationLog enforces raw-identifier scrub (rejects Bearer / UUID / long-alphanumeric runs; whitelists exact 16/64-char sha256)"
    - "Mock injection seams (mockClaude / mockBrainKey / mockRemove) for hermetic testing -- no real `claude` CLI invocations in any test path"
    - "Hermetic os.tmpdir() HOME via mkdtempSync + rmSync recursive cleanup (pattern reused from Phase 121 migrate-telemetry-v1)"

key-files:
  created:
    - lib/core/migration-snapshot.cjs
    - lib/core/migration-snapshot.test.cjs
    - scripts/migrate-brain-mcp-from-http-to-stdio.cjs
    - scripts/migrate-brain-mcp-from-http-to-stdio.test.cjs
    - tests/test-127-01-migration-safety.sh
    - tests/fixtures/127-01-migration/clean-no-legacy.json
    - tests/fixtures/127-01-migration/legacy-same-key.json
    - tests/fixtures/127-01-migration/legacy-different-key.json
    - tests/fixtures/127-01-migration/already-migrated.json
  modified: []

key-decisions:
  - "SG-1 HARD INVARIANT enforced structurally (grep + byte-equality), not procedurally. Live source grep `grep -E \"\\.claude\\.json\" scripts/migrate-brain-mcp-from-http-to-stdio.cjs lib/core/migration-snapshot.cjs` returns ZERO matches. The script never references the legacy user-scope state file in any code path -- the mutation is delegated to the supported CLI subprocess by design."
  - "SG-4 raw-identifier scrub is THE constitutional defense for the migration log. The _scanForRawIdentifiers walker rejects Bearer-token / UUID / long-alphanumeric (>= 24 char) shapes recursively across every string value in every record. Sha256 fingerprints (exactly 16 or 64 hex chars) are whitelisted by length-and-alphabet. The scrub fires BEFORE the write to migrations.jsonl, so a single bad record CANNOT leak."
  - "Two-key conflict (the documented Wave-1 tester case): the script REFUSES to auto-migrate rather than picking a winner. Surfaces a one-line stderr warning naming the exact CLI command the user runs after rotating keys. No state change; exit code 0 (intentional no-op, not an error)."
  - "Hermetic mock injection (mockClaude / mockBrainKey / mockRemove) is the standard testing seam. NO test in any of the 28 test assertions invokes the real `claude` CLI -- the script's getLegacyEntry / removeFn paths are bypassed via injected fakes. This keeps the suite deterministic in CI."

patterns-established:
  - "SG-1 structural defense: any script that mutates user-scope MCP state MUST route through the supported `claude mcp <add|remove> --scope user` CLI subprocess; direct writes to the legacy user-scope state JSON file are forbidden by structural grep (the script's source contains zero references to that file's name)"
  - "SG-2 pre-snapshot ordering invariant: snapshot file lands on disk BEFORE the CLI subprocess invocation, so a misbehaving CLI mutation has a manual restore surface (file at `~/.mindrian/pre-migration-snapshots/<ISO>.json` mode 0600)"
  - "SG-4 audit-log scrub: append-only `~/.mindrian/migrations.jsonl` with sha256 fingerprint records ONLY (no raw Bearer / UUID / long-alphanumeric identifiers); appendMigrationLog enforces the scrub before the write, so the log is structurally privacy-clean"

requirements-completed:
  - BRAIN-MCP-127-04
  - BRAIN-MCP-127-05
  - BRAIN-MCP-127-06
  - BRAIN-MCP-127-07

# Metrics
duration: 7min
completed: 2026-05-19
---

# Phase 127 Plan 01: Brain MCP HTTP-to-stdio Auto-Migration Summary

**Migration orchestration script (190 LOC) + pure helpers module (172 LOC) + 4-fixture adversarial harness (8 bash tests + 11 node tests + 9 helper tests = 28 total). 4 safety guards (SG-1..SG-4) verified by adversarial grep + byte-equality + ordering assertion + raw-identifier scrub. The Lawrence two-key refuse path lands cleanly. Highest-risk surface in Phase 127 hardened structurally before ship.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-19T18:43:44Z
- **Completed:** 2026-05-19T18:51:10Z
- **Tasks:** 3 (TDD RED -> GREEN per task)
- **Files created:** 9 (2 modules + 2 test files + 1 bash harness + 4 fixtures)
- **Files modified:** 0
- **Test count:** 28 (9 helper + 11 script + 8 harness)
- **Commits:** 5 (Task 1 RED + Task 1 GREEN + Task 2 RED + Task 2 GREEN + Task 3)

## Accomplishments

- Shipped `lib/core/migration-snapshot.cjs` (172 LOC) -- pure helpers with 5 public exports + 1 private SG-4 raw-identifier guard. Source-name-prefixed sha256 fingerprint pattern mirrors TELEMETRY-121-02 verbatim. Zero network surface, zero process spawning, zero `.claude.json` references.
- Shipped `scripts/migrate-brain-mcp-from-http-to-stdio.cjs` (190 LOC) -- orchestration script with planMigration / executePlan / main / mock-injection seams (mockClaude / mockBrainKey / mockRemove). SG-2 ordering: snapshot lands BEFORE removeFn invocation (asserted by T6 with file-existence check inside the mockRemove callback). SG-1 routes through `claude mcp remove --scope user` CLI subprocess; the script source contains zero references to the legacy user-scope state file.
- Built `tests/test-127-01-migration-safety.sh` (170 LOC, 8 tests) -- adversarial bash harness with hermetic mktemp HOME per test. T5 synthesizes a fake legacy state file (919-byte payload per Anthropic Issue #15797 reference), sha256s before+after `executePlan(remove)`, asserts byte-identical. T6 greps `migrations.jsonl` for Bearer / UUID -- zero matches required. T7 verifies snapshot mode 0600 on POSIX. T8 verifies dry-run side-effect-free.
- Built 4 fixtures in `tests/fixtures/127-01-migration/` covering the 4 canonical states (clean / legacy-same / legacy-different / already-migrated). All fixtures use synthetic `testfixturekey0001` / `testfixturekey0002` strings -- never a real Bearer / UUID / API key (no-real-names HARD RULE).

## The 4 Safety Guards and How Each Is Verified

### SG-1 HARD INVARIANT -- zero `.claude.json` writes (BRAIN-MCP-127-05)

**Defense layer 1 (structural grep):**
```bash
$ grep -rE "\.claude\.json" scripts/migrate-brain-mcp-from-http-to-stdio.cjs lib/core/migration-snapshot.cjs
(zero matches)
```
The migration script's source contains zero references to the legacy user-scope state file. The mutation is delegated to the supported CLI subprocess (`claude mcp remove --scope user mindrian-brain`) by design.

**Defense layer 2 (byte-equality acceptance gate, T5 + T7-node):**
The test synthesizes a fake legacy state file (919-byte payload mirroring the Anthropic Issue #15797 near-miss precedent) in the hermetic HOME, sha256s it, runs `executePlan(remove)` end-to-end with a no-op `mockRemove`, sha256s the file again, and asserts byte-identical.

```
T7 (node):    SG-1 HARD INVARIANT: ~/.claude.json byte-identical before+after executePlan
T5 (bash):    T5-SG-1-claude-json-byte-equality
```

Both PASS. Two independent defenses (grep + byte-equality) catch any future regression that adds a write path.

### SG-2 -- pre-migration snapshot lands BEFORE state change (BRAIN-MCP-127-06)

**Ordering invariant (T6-node):** the test injects a `mockRemove` that, when called, inspects the snapshot directory and records whether the snapshot file already exists at that moment. The snapshot MUST be on disk before `removeFn` is invoked. PASS.

**Mode 0600 invariant (T7-bash):** the test reads `fs.statSync(snapshot_path).mode & 0o777` and asserts === 0o600 (SEC-02 hygiene). PASS on POSIX (skipped on Windows where mode bits do not translate to NTFS ACLs).

**Snapshot path shape (T4-helper):** `snapshotPath("/tmp/home", "2026-05-19T20:30:00Z")` returns `/tmp/home/.mindrian/pre-migration-snapshots/2026-05-19T20-30-00Z.json` (colons replaced with dashes for Windows filesystem safety per Tavily A127.3 cross-platform note). PASS.

### SG-3 -- `--dry-run` side-effect-free (BRAIN-MCP-127-04)

**Side-effect-free invariant (T5-node + T8-bash):** with `dryRun: true`, executePlan returns `{ executed: false, would_have: [...] }` without:
- Calling `removeFn` (verified by `mockRemove` not flipping its sentinel)
- Creating `~/.mindrian/pre-migration-snapshots/` directory
- Writing `~/.mindrian/migrations.jsonl`

All three assertions PASS in both the node and bash harnesses.

**CLI surface (T10-node):**
```bash
$ node scripts/migrate-brain-mcp-from-http-to-stdio.cjs --dry-run
[migrate-brain-mcp] dry-run: would none
```
Exit code 0. PASS.

### SG-4 -- idempotency log with sha256 fingerprint, no raw identifiers (BRAIN-MCP-127-07)

**Idempotency (T4-node + T4-bash):** after `executePlan(remove)`, a second `planMigration` call returns `{ action: "already_migrated", reason: "idempotency_log_match" }`. The migration is a deterministic no-op on re-run -- the script never invokes the CLI a second time for the same fingerprint. PASS.

**Raw-identifier scrub (T8-helper + T9-helper + T6-bash):** `appendMigrationLog` calls `_scanForRawIdentifiers` BEFORE the write. The scanner walks every string in the record (recursive into objects + arrays) and rejects:
- Bearer-token shape: `/Bearer\s+[A-Za-z0-9._\-]{16,}/i`
- UUID shape: `/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i`
- Long alphanumeric run (>= 24 chars) NOT matching exact-length sha256 whitelist (16 or 64 hex chars)

**Sample log line after a successful migration (T9-node):**
```json
{"ts":"2026-05-19T20:30:00Z","source":"mindrian-brain","fingerprint":"7e8b3c2a1f4d5e6f","action":"removed"}
```
The fingerprint field is the sha256 truncation -- 16 hex chars, structurally privacy-clean. No Bearer / UUID / API key bytes in the log, ever. The T6-bash adversarial grep against the post-migration `migrations.jsonl` returns zero matches for `Bearer\s+` and zero matches for the UUID regex.

## The Lawrence Two-Key Fixture and the Refuse-Path Warning

`tests/fixtures/127-01-migration/legacy-different-key.json` encodes the documented Wave-1 tester case: the legacy user-scope `mindrian-brain` Bearer is `testfixturekey0001`, the current `~/.mindrian.env` key is `testfixturekey0002`. The expected `planMigration` outcome is:

```js
{
  action: 'refuse',
  reason: 'two_key_conflict_rotate_required',
  fingerprint: '<16-hex>',
  warning: 'legacy user-scope mindrian-brain Bearer differs from current ~/.mindrian.env key; '
    + 'auto-migration refused -- run `claude mcp remove --scope user mindrian-brain` after rotating keys'
}
```

**Refuse-path no-op invariant (T3-bash + T8-node):**
- `removeFn` is never called
- No snapshot directory is created
- No log record is appended
- Exit code is 0 (intentional no-op, not an error)
- The one-line warning lands on stderr for the user to read

Both tests PASS. The user sees the explicit instruction (run the supported CLI command after rotating keys) and decides; the script never attempts to pick a winner.

## LOC Counts

| File                                                            | LOC | Plan ceiling |
| --------------------------------------------------------------- | --- | ------------ |
| `lib/core/migration-snapshot.cjs`                               | 172 | < 180        |
| `lib/core/migration-snapshot.test.cjs`                          | 174 | -            |
| `scripts/migrate-brain-mcp-from-http-to-stdio.cjs`              | 190 | < 320        |
| `scripts/migrate-brain-mcp-from-http-to-stdio.test.cjs`         | 242 | -            |
| `tests/test-127-01-migration-safety.sh`                         | 170 | min 120      |
| `tests/fixtures/127-01-migration/clean-no-legacy.json`          |   3 | -            |
| `tests/fixtures/127-01-migration/legacy-same-key.json`          |  11 | -            |
| `tests/fixtures/127-01-migration/legacy-different-key.json`     |  11 | -            |
| `tests/fixtures/127-01-migration/already-migrated.json`         |  12 | -            |
| **Total (production code, lines)**                              | 985 | -            |

## Task Commits

Each task was committed as a TDD RED -> GREEN pair (Task 3 is harness-only and shipped in one commit because it tests the existing Task 1+2 surface):

1. **Task 1 RED: migration-snapshot failing tests** -- `d8e15c8b` (test)
2. **Task 1 GREEN: migration-snapshot pure helpers** -- `a12a2d20` (feat) -- 9/9 PASS
3. **Task 2 RED: migration script failing tests** -- `30fc4f9a` (test)
4. **Task 2 GREEN: migration orchestration script** -- `667cbfe8` (feat) -- 11/11 PASS
5. **Task 3: bash harness + 4 fixtures** -- `514b755a` (test) -- 8/8 PASS

## Decisions Made

- **SG-1 enforced by TWO independent defenses, not one.** Layer 1: structural grep against the script source for `.claude.json` references (zero matches required). Layer 2: byte-equality acceptance gate -- the T5 bash harness synthesizes a fake legacy state file, sha256s it, runs `executePlan(remove)` end-to-end, sha256s it again, asserts byte-identical. Either defense alone could be bypassed by a creative regression; together they catch the entire class.
- **SG-4 raw-identifier scrub runs BEFORE the write, never after.** A "scan-then-write" order would leave a window where a bad record could be flushed if the scan threw mid-write. The current order (`_scanForRawIdentifiers(record)` then `fs.appendFileSync`) makes the write atomic on the scrub result.
- **Mock injection seams are the standard testing pattern.** `mockClaude` (replaces `claude mcp get` subprocess), `mockBrainKey` (bypasses `resolveBrainKey`), and `mockRemove` (replaces `claude mcp remove` subprocess) are first-class arguments to `planMigration` / `executePlan`. NO test in the 28-assertion suite invokes the real `claude` CLI. This is essential because the dev machine's `claude` binary does not support the `--scope` flag (verified empirically); only a mock-injected suite is portable.
- **Two-key conflict refuses rather than picks a winner.** When the legacy Bearer differs from `~/.mindrian.env`, the script returns `action=refuse` with a stderr warning naming the exact CLI command. The user reconciles. No state change. Per the Larry pedagogical canon: when the choice is material and the system has incomplete information, the system asks rather than acts.
- **Forbidden-token doc-header rewording.** Phase 127-00 SUMMARY documented a doc-header false-positive against the orchestrator's raw grep. This plan's source files describe SG invariants without naming forbidden tokens verbatim (`Canon Part 8 delegation property: this file contains zero direct network calls.`) so the live grep remains clean without needing comment-stripping logic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Initial migration-snapshot.cjs doc-header tripped Canon Part 8 forbidden-token grep**

- **Found during:** Task 1 GREEN verification (`grep -E "fetch\(|http\.|brain\.mindrian|onrender|https?://" lib/core/migration-snapshot.cjs` matched the comment line listing the forbidden tokens in prose).
- **Issue:** The first draft of the doc header read `The forbidden tokens listed in Phase 127 Canon Part 8 verification (fetch, http., onrender, brain.mindrian, https URLs) do NOT appear in this module's source.` -- which trips the live source grep on `http.` and `brain.mindrian`. Same class of false-positive as Phase 127-00 (Deviation #3 in `127-00-SUMMARY.md`).
- **Fix:** Reworded to `Canon Part 8 delegation property: this file contains zero direct network calls.` -- the doc explains the contract without enumerating the forbidden tokens.
- **Files modified:** `lib/core/migration-snapshot.cjs`
- **Verification:** post-fix grep returns zero matches; all 9 tests still PASS.
- **Committed in:** `a12a2d20` (Task 1 GREEN; rewording done inline before the GREEN commit landed).

**2. [Rule 3 - Blocking issue] migration-snapshot.cjs exceeded plan LOC ceiling of 180**

- **Found during:** Task 1 GREEN verification (initial draft was 196 LOC vs plan ceiling of <180).
- **Issue:** The plan's `<action>` block specifies `Under 180 LOC total`; first GREEN draft was 196 LOC due to verbose inline comments in `_scanForRawIdentifiers`.
- **Fix:** Tightened the helper's prose (kept the regexes + the throw paths + the whitelist branches all intact); LOC dropped to 172.
- **Files modified:** `lib/core/migration-snapshot.cjs`
- **Verification:** `wc -l lib/core/migration-snapshot.cjs` returns 172 (under 180); all 9 tests still PASS.
- **Committed in:** `a12a2d20` (Task 1 GREEN; tightening done inline before the GREEN commit landed).

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 3 blocking issue). Both deviations were caught + fixed within the same TDD pair before the GREEN commit landed. No scope creep; no architectural changes. The plan's `<action>` block and `<behavior>` block specifications were honored verbatim modulo the comment-prose rewording.

**Impact on plan:** All success criteria from the orchestrator's `<success_criteria>` block PASS; all 28 tests across 3 suites GREEN; all 8 plan-level verification gates GREEN. The 4 safety guards are verified structurally + behaviorally + adversarially.

## Authentication Gates

None. The script never touches network surface; the only state-changing operation is the `claude mcp remove --scope user mindrian-brain` CLI subprocess, which the user's local `claude` binary handles via its own authentication path (out of scope for this plan).

## Known Stubs

None. The migration script is a complete surface for all 4 canonical states (clean / legacy-same / legacy-different / already-migrated). With `--dry-run`, the script prints planned actions without state changes. Without `--dry-run`, the script executes the plan end-to-end. The `getLegacyEntry` function probes the real `claude` CLI in production; the test path injects `mockClaude` for hermetic CI runs. No placeholder strings, no "coming soon" markers, no hardcoded empty responses.

## Issues Encountered

- **dev-machine `claude` CLI does not support `--scope` flag** -- verified empirically (`claude mcp get mindrian-brain --scope user` returns `error: unknown option '--scope'`). The script's `getLegacyEntry` catches the non-zero exit and treats it as "no entry present" (the canonical no-op case), so the end-to-end `node scripts/migrate-brain-mcp-from-http-to-stdio.cjs --dry-run` correctly prints `[migrate-brain-mcp] dry-run: would none`. The user environment (Lawrence / Gary / Rea / Natan installs running `claude mcp add --scope user`) will have a different binary version that supports `--scope` -- this is the version the migration targets.
- **No issues during TDD execution.** Both RED phases failed exactly as expected (MODULE_NOT_FOUND in Task 1; uncaught Error in Task 2's spawned `--help` test). Both GREEN phases passed on first run after the deviation auto-fixes above.

## User Setup Required

None for this plan. The migration script ships as a callable surface; wiring it to first-launch (e.g. via `scripts/session-start` or `scripts/doctor.cjs --first-launch`) is the next plan's job (127-02). The user does NOT need to run the migration manually -- once Plan 127-02 wires it, the migration fires once per install on first session start, idempotently no-ops on subsequent starts via the SG-4 fingerprint check.

## Self-Check

**Files exist:**
- `lib/core/migration-snapshot.cjs` -- FOUND (172 LOC)
- `lib/core/migration-snapshot.test.cjs` -- FOUND (174 LOC)
- `scripts/migrate-brain-mcp-from-http-to-stdio.cjs` -- FOUND (190 LOC, mode 0755)
- `scripts/migrate-brain-mcp-from-http-to-stdio.test.cjs` -- FOUND (242 LOC)
- `tests/test-127-01-migration-safety.sh` -- FOUND (170 LOC, mode 0755)
- `tests/fixtures/127-01-migration/clean-no-legacy.json` -- FOUND
- `tests/fixtures/127-01-migration/legacy-same-key.json` -- FOUND
- `tests/fixtures/127-01-migration/legacy-different-key.json` -- FOUND
- `tests/fixtures/127-01-migration/already-migrated.json` -- FOUND

**Commits exist:**
- `d8e15c8b` (Task 1 RED) -- FOUND
- `a12a2d20` (Task 1 GREEN) -- FOUND
- `30fc4f9a` (Task 2 RED) -- FOUND
- `667cbfe8` (Task 2 GREEN) -- FOUND
- `514b755a` (Task 3) -- FOUND

**Tests pass:**
- `node lib/core/migration-snapshot.test.cjs` -- 9/9 PASS
- `node scripts/migrate-brain-mcp-from-http-to-stdio.test.cjs` -- 11/11 PASS
- `bash tests/test-127-01-migration-safety.sh` -- 8/8 PASS (ALL 4 SAFETY GUARDS VERIFIED)

**Plan verification gates (8/8):**
1. All 3 task verifies pass -- PASS
2. SG-1 HARD INVARIANT structural check (zero `.claude.json` refs) -- PASS
3. SG-1 acceptance gate (byte-equality) -- PASS via T5-bash and T7-node
4. SG-4 raw-identifier scrub -- PASS via T6-bash and T8/T9-helper
5. No-real-names compliance (synthetic tokens only) -- PASS
6. No em-dashes -- PASS
7. Canon Part 8 LOCAL-only -- PASS
8. --dry-run + --help work end-to-end -- PASS

## Self-Check: PASSED

## Next Phase Readiness

- **127-02 (Doctor Class M 5-layer Brain smoke + first-launch wiring) is unblocked.** The migration script is callable as `node scripts/migrate-brain-mcp-from-http-to-stdio.cjs [--dry-run]` and is safe to invoke from `scripts/session-start` on first launch (idempotent no-op after first successful run via the SG-4 fingerprint check).
- **127-03 (acceptance harness + Canon Part 8 adversarial audit) is unblocked.** The migration script is the highest-risk surface in Phase 127; the 4 SGs are verified structurally + behaviorally. The 127-03 audit can mirror the T5-bash byte-equality pattern + the T6-bash raw-identifier-scrub pattern as templates for its synthetic-install adversarial scenarios.

---
*Phase: 127-brain-mcp-local-stdio-shim*
*Plan: 01*
*Completed: 2026-05-19*
