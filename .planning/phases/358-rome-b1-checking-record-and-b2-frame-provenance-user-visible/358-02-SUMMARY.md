---
phase: 358-rome-b1-checking-record-and-b2-frame-provenance-user-visible
plan: 02
subsystem: local-graph
tags: [b1, refile, carry-forward, host-tier, desktop, rome, tdd]

# Dependency graph
requires:
  - phase: 358-01
    provides: recordClaimVerification, readClaimVerification, readVerificationPortrait, VERIFICATION_RUNGS (verification.cjs core library, additively re-exported by navigation.cjs)
  - phase: 234-05
    provides: detectHostTier / HOST_TIER_MAP / isWritePathEnabled (the two-axis capability floor this plan extends)
provides:
  - "writeClaimNode carries CARRY_FORWARD_CLAIM_KEYS (verification) forward from the prior row on every re-file"
  - "'verification' in PROTECTED_CLAIM_KEYS -- an extraProps bag can never write, replace or forge a checking record"
  - "Claude Desktop (clientInfo.name 'claude-ai') recognized as tier0 host 'claude-desktop', write-enabled by default"
  - "tests/run-all-358.sh -- the phase's B1 aggregator, naming every planned B1 leg up front"
  - "tests/test-358-b1-refile.cjs -- 9 re-file scenarios (11 assertions) proving the checking record survives every re-projection shape"
affects: [358-03, 358-04, 358-05, 358-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CARRY_FORWARD_CLAIM_KEYS: an explicit named list (not 'preserve every old key') copied from the prior row's properties AFTER the protected-key extraProps merge, so the stored record always wins over a forged extraProps bag"
    - "BEGIN IMMEDIATE transaction ownership idiom (db.isTransaction !== true) now also wraps writeClaimNode's prior-row read + insertNode, matching the pattern already used in ranker-weights.cjs and verification.cjs; a failed BEGIN falls back to running without a transaction rather than refusing the write"
    - "Anchored host-tier regex (^claude-ai$) added as the first tier0 HOST_TIER_MAP entry, same shape as the existing tier0/tier1 entries, so a look-alike client name never rides in on a substring match"

key-files:
  created:
    - tests/run-all-358.sh
    - tests/test-358-b1-refile.cjs
  modified:
    - lib/core/navigation/typed-claim.cjs
    - lib/mcp/surface-detect.cjs
    - tests/test-234-host-tier.cjs

key-decisions:
  - "CARRY_FORWARD_CLAIM_KEYS is a separate frozen constant from PROTECTED_CLAIM_KEYS ('verification' appears in both, for two different reasons: protected so extraProps can never write it, carry-forward so a re-file's own props rebuild does not silently drop it)"
  - "The prior-row read for carry-forward runs inside the same BEGIN IMMEDIATE writeClaimNode now owns (when it owns one), so the carry-forward read and the final insertNode are part of one atomic snapshot, matching the ownership idiom verification.cjs already established in 358-01"
  - "A carry-forward read or JSON.parse failure (malformed prior properties) is swallowed and never blocks the claim write (T-358-10); refile 8 proves this against a row whose properties were overwritten with the raw string 'not json'"
  - "Claude Desktop is added to HOST_TIER_MAP.tier0, not tier1 -- it has no hook channel of its own, unlike Claude Code. Cowork is deliberately NOT added in this plan (no live probe yet); the demo-machine env fallback stays documented, not coded"

patterns-established:
  - "tests/run-all-358.sh is written ONCE (this plan) naming every B1 leg (including 5 not yet landed) up front; a landed test file is picked up automatically by its own run_if guard, so no later B1 plan needs to re-open this aggregator"

requirements-completed: [B1-02, B1-03, B1-07]

# Metrics
duration: ~50min
completed: 2026-09-23
---

# Phase 358 Plan 02: Carry-Forward Fix, Claude Desktop Host Tier, Phase Runner Summary

**Fixed the writeClaimNode verification-wipe bug (carry-forward + PROTECTED_CLAIM_KEYS) and recognized Claude Desktop (claude-ai) as a write-enabled tier0 host, built TDD (RED then GREEN) with the phase's aggregator (tests/run-all-358.sh) written once, naming every planned B1 leg up front.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-09-23 (session start, after reading PLAN/CONTEXT/RESEARCH/358-01-SUMMARY)
- **Completed:** 2026-09-23
- **Tasks:** 3/3 completed
- **Files modified:** 5 (2 created new, 3 pre-existing extended)

## Accomplishments

- Fixed the exact defect the research proved would fail Rome AT2 ("visible months later"): `writeClaimNode` rebuilt claim properties from scratch on every re-file and `insertNode`'s upsert overwrote them, silently erasing a claim's checking record on any re-projection (graph-derivation, domain-insight-sweep, claim_write, close-loop, unknowns edge-writer all re-file through this one writer).
- Added `'verification'` to `PROTECTED_CLAIM_KEYS` so an extraProps bag can never write, replace or forge a checking record, and a new named `CARRY_FORWARD_CLAIM_KEYS` (verification only, deliberately not "preserve every old key") copies the prior row's real record forward after the protected-key merge, so the stored record always wins.
- Wrapped the prior-row read and the final `insertNode` call inside the same `BEGIN IMMEDIATE` transaction-ownership idiom already established in `verification.cjs` and `ranker-weights.cjs`: owns its own transaction only when the caller has not already begun one, never commits or rolls back a caller-owned transaction, and never blocks the write when BEGIN itself fails or the prior properties blob is malformed.
- Recognized Claude Desktop (`clientInfo.name` `'claude-ai'`) as a write-enabled tier0 host (`host: 'claude-desktop'`) in `lib/mcp/surface-detect.cjs`, the same treatment quick 260819-bql gave Claude Code (commit `5f0a55993`). An anchored regex (`^claude-ai$`) keeps look-alike names (`claude-ai-beta`, `my-claude-ai`, `claude-aix`) on the conservative `unknown` floor. Cowork was deliberately NOT added (no live probe of its client name yet).
- Wrote `tests/run-all-358.sh`, the phase's B1 aggregator, once, naming all 7 planned B1 test-file legs (5 not yet landed at this plan), 10 existing regression tests, 8 CIRS/born-wired gates, a CIRS-declaration leg, and an em-dash guard.
- Wrote `tests/test-358-b1-refile.cjs`: 9 re-file scenarios (11 checks) covering an identical writeClaimNode re-file, a graph-derivation-style minimal re-save, an extraProps re-projection (pipeline/run_id), extraProps forgery (both with and without a prior record), a no-prior-record re-file, a `claim_write` MCP re-file, review_status preservation across `confirmNode`, a malformed prior properties blob, and transaction-ownership hygiene.

## Task Commits

Each task was committed atomically:

1. **Task 1: Phase runner + RED re-file regression test** - `ff56f4868` (test)
2. **Task 2: GREEN - carry the checking record forward in writeClaimNode and protect it from extraProps** - `cc8aee1e8` (fix)
3. **Task 3a: RED - failing claude-ai host tier assertions** - `113271ddc` (test)
3. **Task 3b: GREEN - Claude Desktop (claude-ai) is a write-enabled tier0 host** - `cf49dd497` (feat)

_TDD plan: RED then GREEN for both Task 1/2 (the re-file fix) and Task 3 (the host tier fix); no separate REFACTOR commit needed for either (no cleanup pass required after GREEN)._

## Files Created/Modified

- `tests/run-all-358.sh` - Phase 358 B1 aggregator: run/run_if/counter shape copied from tests/run-all-354.sh, 7 guarded B1 legs, 10 existing-regression legs, 8 CIRS/born-wired gate legs, a CIRS-declaration leg (only existing 358-0N-PLAN.md files), and an em-dash guard. Exit 1 on any FAIL, 77 on SKIP-only, 0 only when everything passed.
- `tests/test-358-b1-refile.cjs` - 9 re-file scenarios / 11 checks proving the checking record survives every re-projection shape and that forgery via extraProps is refused. RED-first: 3/11 passed before Task 2 (refile 5, 8, 9 -- the ones that only prove pre-existing non-regression behavior), 11/11 after.
- `lib/core/navigation/typed-claim.cjs` - `'verification'` added to `PROTECTED_CLAIM_KEYS`; new `CARRY_FORWARD_CLAIM_KEYS` constant and export; `writeClaimNode` moved its id/path computation above props serialization, added the prior-row carry-forward read inside a `BEGIN IMMEDIATE` transaction-ownership block, and updated its header comment.
- `lib/mcp/surface-detect.cjs` - `{host: 'claude-desktop', re: /^claude-ai$/i}` added as the first `HOST_TIER_MAP.tier0` entry with a navigator-ruling comment; one doc-comment line updated to mention Claude Desktop (the only removed line in the whole file per the plan's own diff-shape acceptance criterion).
- `tests/test-234-host-tier.cjs` - a header-comment paragraph naming the 2026-09-23 navigator ruling; 6 new `detectHostTier` recognition assertions (claude-ai / Claude-AI recognized, claude-ai-beta / my-claude-ai / claude-aix stay unknown); 3 new `isWritePathEnabled` write-gate assertions (desktop and cowork ON for claude-ai, claude-ai-beta OFF). Every pre-existing assertion unchanged.

## Decisions Made

- Used `let owns` (not `const`) for the transaction-ownership flag in `writeClaimNode`, since the plan's own described behavior ("if that BEGIN throws, continue WITHOUT a transaction... and remember that nothing is owned") requires reassignment when `db.exec('BEGIN IMMEDIATE')` itself throws.
- Placed the tier0 doc-comment edit as a single-line replacement (appending ", including Claude Desktop." to the first line only, leaving the two continuation lines byte-identical) so the plan's `git diff | grep -c '^-[^-]'` <= 1 acceptance criterion holds exactly (measured: 1).
- Chose distinct claim texts/segments for refile 2 (graph-derivation style) versus refile 1 (identical re-file) so the test proves the carry-forward survives a re-save whose OWN parameter shape is narrower than the original write, not just an identical replay.

## Deviations from Plan

None. All three tasks match the plan's `<action>` steps as written: Task 1 produced the aggregator and a RED-first regression test (8 of 11 checks failing pre-fix, matching the plan's expectation that refile 5/8/9 already hold); Task 2's GREEN implementation follows the plan's ordering exactly (extraProps merge, then id/path computation, then the transaction-ownership block wrapping the prior-row carry-forward read and the final insertNode); Task 3's RED-then-GREEN sequence for the Claude Desktop host tier recognition matches the plan's action steps, including the coordination check (no 354/355/357 plan lists `surface-detect.cjs` or `mcp-first-flag.cjs` in its `files_modified`, confirmed by grep before editing) and the single-line diff constraint.

## Issues Encountered

None blocking. No auth gates. No collisions: `lib/mcp/surface-detect.cjs` and `lib/mcp/mcp-first-flag.cjs` were clean and untouched by any peer commit at the time of Task 3 (`git log -5` and `git status --short` both confirmed before editing).

## Verification Evidence

All commands from the plan's `<verify>` blocks and the phase's `<verification>` section were run and are green as of the final commit:

```
node tests/test-358-b1-refile.cjs        -> 11 passed, 0 failed (exit 0)
node tests/test-234-host-tier.cjs        -> 110 passed, 0 failed (exit 0)
```

Twelve claim-writer regression tests (Task 2's verify loop), all exit 0:
```
test-348-validity-window, test-276-claim-write-primitive, test-223-close-loop,
test-223-supersedes-chain, test-224-proposed-only, test-233-derivation-default-gate,
test-348-supersession-e2e, test-abstraction-gate, test-347-meeting-fanout-records,
test-276-meeting-gate-wiring, test-353-filing-gate, test-b1-verification
```

Acceptance-criteria checks (all satisfied):
- `bash -n tests/run-all-358.sh` exits 0; file is executable.
- `grep -c "run_if" tests/run-all-358.sh` = 11 (>= 8 required).
- `grep -c "tests/test-358-b1-persistence.cjs"` = 1; `grep -c "check-cirs-declaration"` = 1.
- `grep -c "exit 77\|77"` = 4 (>= 1 required).
- `node -e "...typed-claim.cjs PROTECTED_CLAIM_KEYS/CARRY_FORWARD_CLAIM_KEYS..."` exits 0.
- `grep -v '^\s*//' lib/core/navigation/typed-claim.cjs | grep -c "BEGIN IMMEDIATE"` = 1.
- `node -e "...surface-detect.cjs detectHostTier(claude-ai)/(claude-ai-beta)..."` exits 0.
- `env -u MINDRIAN_MCP_FIRST node -e "...isWritePathEnabled(desktop, claude-ai)..."` exits 0.
- `git diff <plan-base> -- lib/mcp/surface-detect.cjs | grep -c '^-[^-]'` = 1.
- `grep -c "host: 'cowork'" lib/mcp/surface-detect.cjs` = 0.
- No em-dashes in any of the 5 files touched by this plan.

`bash tests/run-all-358.sh; echo "exit=$?"` -> `PASSED=21 FAILED=3 SKIPPED=3`, exit 1. Per the plan's own `<verification>` section, this is the expected end state: the 3 FAILED legs are the pre-existing substrate-commit-broken tests (`test-234-tool-description-floor.cjs`, `test-270-tool-schema-budget.cjs`, `test-276-tool-honesty-findings-closed.cjs`, Pitfall 4 in 358-RESEARCH.md) owned by later plans (358-04/358-05), unaffected by this plan's two fixes; the 3 SKIPPED legs are B1 test files 358-03/358-04 have not yet created (`test-358-b1-cli.cjs`, `test-358-b1-surfaces.cjs`, `test-358-b1-persistence.cjs`). Confirmed these three FAILED legs are pre-existing and unrelated to this plan's changes (verified `test-234-tool-description-floor.cjs`'s single failure is the `claim_verify` 111-char description, a 358-01 substrate fact, not touched by this plan).

## Threat Model Coverage

- **T-358-07** (Spoofing, surface-detect claude-ai entry, accept): the anchored regex plus the `hostTier: 'tier0'` classification (never `tier1`) means writes still pass `navigation.cjs` validation and land as proposed; proven by `test-234-host-tier.cjs`'s look-alike-name checks.
- **T-358-08** (Tampering, extraProps forging a checking record, mitigate): `'verification'` in `PROTECTED_CLAIM_KEYS`; carry-forward runs after the extraProps merge so the stored record always wins. Proven by refile 4a/4b/4c.
- **T-358-09** (Tampering/integrity, re-file wipes the record, mitigate): `CARRY_FORWARD_CLAIM_KEYS` copy inside `writeClaimNode`. Proven by refile 1, 2, 3, 6.
- **T-358-10** (Denial of service, carry-forward read failure blocks claim writes, mitigate): the prior read and `JSON.parse` are in their own try/catch; a failed BEGIN falls back to no transaction. Proven by refile 8 (malformed prior properties).
- **T-358-11** (Elevation of privilege, widened write gate on Desktop, accept): navigator ruling 2026-09-23, same governed door as Claude Code since `5f0a55993`; Cowork stays refused until probed. Proven by `test-234-host-tier.cjs`'s write-gate assertions.

## Known Stubs

None. Every code path touched by this plan has a real, tested implementation; nothing renders a placeholder or hardcoded empty value.

## Next Steps

- 358-03 (CLI) and 358-04 (MCP `claim_read` tool, `claim_verify` description-floor fix) build against the fixed `writeClaimNode` and the now-reachable Claude Desktop write path.
- 358-04/358-05 are expected to turn the three remaining `run-all-358.sh` FAILED legs green (tool-description floor, schema budget re-baseline, tool-honesty ledger re-freeze) and land the three still-missing B1 test files this plan's aggregator already names.

## Self-Check: PASSED

- FOUND: `tests/run-all-358.sh`
- FOUND: `tests/test-358-b1-refile.cjs`
- FOUND: `lib/core/navigation/typed-claim.cjs` (modified)
- FOUND: `lib/mcp/surface-detect.cjs` (modified)
- FOUND: `tests/test-234-host-tier.cjs` (modified)
- FOUND: `.planning/phases/358-rome-b1-checking-record-and-b2-frame-provenance-user-visible/358-02-SUMMARY.md`
- FOUND commit `ff56f4868` (test: RED, Task 1)
- FOUND commit `cc8aee1e8` (fix: GREEN, Task 2)
- FOUND commit `113271ddc` (test: RED, Task 3a)
- FOUND commit `cf49dd497` (feat: GREEN, Task 3b)
