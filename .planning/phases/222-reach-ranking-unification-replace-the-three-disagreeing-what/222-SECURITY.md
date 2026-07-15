---
phase: 222-reach-ranking-unification-replace-the-three-disagreeing-what
audited: 2026-07-15
asvs_level: 1
block_on: high
threats_total: 20
threats_closed: 20
threats_open: 0
status: SECURED
post_review_fixes_verified: [CR-01, WR-01, WR-02, WR-03, WR-04]
---

# Phase 222: Security Audit (reach-ranking unification)

Verified every declared mitigation in the consolidated STRIDE register across all four
plans against the live source, not against the plan/summary/fix prose. Each plan's row for
a recurring threat ID is treated as a distinct instance and verified against that plan's own
cited component. The five post-implementation code-review fixes (CR-01, WR-01..04) were
re-verified against the live tree and probed empirically; none reopened a registered threat.

Phase is room-local by construction (Canon Part 8, no egress): weight state never crosses a
room boundary, never enters a Brain packet, and no network surface was added. `bash
tests/run-all-222.sh` -> `PASS=10 FAIL=0 SKIP=0` (re-run during this audit).

## Threat Verification (20 instances, all mitigate except T-222-SC = accept)

### Plan 01 - persistence substrate

| Threat ID | Category | Disposition | Evidence (verified in live source) |
|-----------|----------|-------------|-------------------------------------|
| T-222-01 | Tampering (NaN/neg/out-of-range weight) | mitigate | Write validates finite + non-negative: `lib/core/navigation/ranker-weights.cjs:85-96`. Read returns AS-STORED (unlaundered) so corruption is visible to Plan 02: `:49-71`. CLOSED |
| T-222-02 | Information disclosure (Part 8) | mitigate | Scalar-only schema `expert_id TEXT / weight REAL / update_count INTEGER / updated_at INTEGER`: `phase-222-ranker-weights.cjs:44-49`. No prose columns. CLOSED |
| T-222-03 | Tampering (Part 9 breach) | mitigate | Only the migration + `ranker-weights.cjs` run SQL against the table (repo-wide grep confirms no `prepare/exec/SELECT/INSERT/UPDATE` against `ranker_weights` elsewhere). `navigation.cjs:577-578` re-exports typed accessors only; no `db.prepare` escape hatch (`navigation.cjs:575`). CLOSED |
| T-222-04 | Denial of service (migration bricks openRoomDb) | mitigate | Sentinel-idempotent, transaction-wrapped, ROLLBACK+rethrow: `phase-222-ranker-weights.cjs:37-60`. Chain-wired last, no FK: `room-db.cjs:35,141`. Idempotency probe re-run this audit: `applied:true` then `applied:false`, table present. CLOSED |
| T-222-SC | Tampering (supply chain) | accept (N/A) | Zero new packages; see Accepted Risks log below. CLOSED |

### Plan 02 - shared ranker + Hedge layer

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-222-01 | Tampering (corrupt scalars skew ranking) | mitigate | `readHedgeWeights` validates finite/non-negative/positive-sum -> equal weights + `corrupt_scalar` degrade event: `reach-hedge-ranker.cjs:255-267`. `test-222-degrade.cjs` arm (c) green (verified: "exactly one corrupt_scalar event"). CLOSED |
| T-222-02 | Information disclosure (degrade payload) | mitigate | Payload is enum tokens only `{ fault_kind, source }`, never `reason`, never prose: `reach-hedge-ranker.cjs:213-222`. `test-222-degrade.cjs` arm (e) green (no long value, no reason field). My own comment-stripped Part 8 sweep over both modules: clean. CLOSED |
| T-222-03 | Tampering (Part 9 chokepoint bypass) | mitigate | Sole db surface is `require('../core/navigation.cjs')`: `reach-hedge-ranker.cjs:31`. My comment-stripped sweep: zero `node:sqlite`/`better-sqlite3`/`DatabaseSync`/`fs.read|write` on executable lines. CLOSED |
| T-222-04 | Denial of service (hot-path stall / throwing ranker) | mitigate | 0/1 short-circuit does zero reads: `reach-hedge-ranker.cjs:399-401`; whole body soft-fails to the input array: `:442-444`. `test-222-rank-fired.cjs` soft-fail check green. CLOSED |
| T-222-05 | Information disclosure (cross-room aggregation) | mitigate | Module only touches the caller-passed db handle; grep for `readdir/resolveActiveRoom/listRooms/room-registry/glob/enumerat` in the ranker: none. No room-enumeration surface. CLOSED |
| T-222-SC | Tampering (supply chain) | accept (N/A) | See Accepted Risks log. CLOSED |

### Plan 03 - engine + MCP wiring

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-222-01 | Tampering (poisoned rows steering auto-fire) | mitigate | Plan 02 validation + Req 7 disclosure apply unchanged on this path; the insertion sits before `resolveFireSkill`, whose degrade/precedence caps a skewed rank. `test-222-reach-wired.cjs` ARM 3/4 (ranked path live), ARM 5/6 (guards) green. CLOSED |
| T-222-02 | Elevation of privilege (rank bug past Wicked precedence) | mitigate | Insertion is BEFORE `resolveFireSkill` at `navigation-engine.cjs:931-950`; `resolveFireSkill`'s precedence (wicked > sensor reach > brain verb > fallback) is byte-untouched (only Phase-222 commit touching the file is `087522a8`, the :931 insertion). ARM 5 regression-pins it. CLOSED |
| T-222-03 | Denial of service (per-call db open, MCP path) | mitigate | 0/1 calls skip the open entirely: `sensors.cjs:110`; multi-candidate opens via `navigation.openRoomDbForCaller` and closes in `finally`: `:111-116`. CLOSED |
| T-222-04 | Tampering (call sites reaching room.db directly) | mitigate | Engine threads `ctx.roomDb` passthrough (`navigation-engine.cjs:946`); MCP uses `openRoomDbForCaller` (`sensors.cjs:111`). No new SQL in either edit. CLOSED |
| T-222-SC | Tampering (supply chain) | accept (N/A) | See Accepted Risks log. CLOSED |

### Plan 04 - harness / standing tripwires

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-222-02 | Information disclosure (future prose/egress creep) | mitigate | Comment-stripped Part 8 sweep leg over both new modules on every run: `run-all-222.sh:80-93`. Passed this audit. CLOSED |
| T-222-03 | Tampering (future direct-SQL bypass) | mitigate | Comment-stripped Part 9 sweep + mandatory `navigation.cjs` require assertion: `run-all-222.sh:100-113`. Passed. CLOSED |
| T-222-SC | Tampering (dependency sneaks into new tree) | mitigate | `test-222-zero-deps.cjs` require-allowlist (node:* + repo lib/ + data/) + `git diff --quiet package.json package-lock.json` leg: `run-all-222.sh:119-124`. Both green; no drift. CLOSED |
| T-222-04 | Repudiation (declared done without runnable evidence) | mitigate | Hard exit-code gate `[ "$FAIL" -eq 0 ]`: `run-all-222.sh:130`. `PASS=10 FAIL=0 SKIP=0` reproduced this audit; SPEC 8-item checklist closed with proving commands in 222-04-SUMMARY. CLOSED |

## Post-Review Fix Verification (live source, not the fix report)

| Fix | Threat territory | Verified present | Reopened anything? |
|-----|------------------|------------------|---------------------|
| CR-01 (`1f7c21a1`) | T-222-04 transaction-safety | `db.isTransaction`/`ownsTransaction` gating of BEGIN/COMMIT/ROLLBACK: `ranker-weights.cjs:113-128`. Empirical probe this audit: caller's outer-txn INSERT survives (count 1) AND weight write lands (count 2). `test-222-weight-state.cjs` check (8) green. | No. Migration (Plan-01 T-222-04) was not touched by CR-01 and still runs its own unconditional txn on a fresh, never-mid-transaction handle (room-db chain runs migrations sequentially, no outer wrapping txn) - migration DoS mitigation intact. |
| WR-01 (`60ba92c7`) | ranking correctness (not a registered threat) | `canonicalRegistryRank` unifies training + inference registry signal: `reach-hedge-ranker.cjs:105-108,197,422`. Checks 7/7b/7c green. | No new attack surface. |
| WR-02 (`d22b1dbb`) | T-222-01 write validation | `|| w < 0` at the write boundary: `ranker-weights.cjs:93`. Check (5b) green (negative rejected, no partial landing). | No. Strengthens T-222-01. |
| WR-03 (`ab24c736`) | T-222-04/WR-03 500-row bound | Documented accepted bound (comment-only), `since` only advances on successful fold: `reach-hedge-ranker.cjs:318-339`. | No behavior change. |
| WR-04 (`3d3719f4`) | Part 11 declaration honesty | `hitl_shape:'none'` retained (correct - no navigator fork); `hitl_why` reworded to disclose the debounced internal write: `sensors.cjs:338-346`. `build-connector-registry --check` -> OK; derived registries regenerated consistently. | No. Born-wired gate still green. |

## Accepted Risks Log

| ID | Risk | Disposition | Basis |
|----|------|-------------|-------|
| T-222-SC | A poisoned npm dependency entering the phase's module tree | accept (N/A), reinforced by mitigate tripwire | Req 4 locks zero new packages, so there is no install checkpoint to poison. Verified: `git diff` on `package.json`/`package-lock.json` empty; `test-222-zero-deps.cjs` require-allowlist (node:* + repo `lib/`+`data/` only) passes over all three new source files; both run as standing harness legs (`run-all-222.sh:72-73,119-124`). Residual risk accepted as N/A. |

## Unregistered Flags

None. No SUMMARY (222-01..04) contains a `## Threat Flags` section; no new attack surface
appeared during implementation without a threat mapping.

## Disposition

**SECURED - 20/20 threat instances CLOSED, 0 OPEN.** Every declared mitigation is present in
the implemented code at its cited location, all five post-review fixes are live and probed,
and no fix reopened a registered threat. The phase's constitutional constraints (Part 8
no-egress, Part 9 chokepoint-only, Req 4 zero-deps) are enforced as permanent harness legs.

_Audited 2026-07-15 by gsd-security-auditor. ASVS Level 1, block_on: high. Implementation
files not modified._
