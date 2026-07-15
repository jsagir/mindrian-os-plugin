# SECURITY.md - Phase 224 (Graph-Derivation Harness, SEED-034)

**Audited:** 2026-07-15
**ASVS Level:** 1
**Block-on:** high
**Result:** SECURED - 18/18 threats CLOSED (16 mitigate verified in code, 2 accept documented)
**Register authored at:** plan time (PLAN.md `<threat_model>` blocks, plans 01-04)
**Live evidence:** `bash tests/run-all-224.sh` = PASS=17 FAIL=0 SKIP=0 (re-run during audit)

Each mitigation was verified by locating the actual code, not by trusting SUMMARY prose. Where a
mitigation is a permanent grep tripwire, the tripwire was executed live.

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence (file:line or leg) |
|-----------|----------|-------------|--------|-----------------------------|
| T-224-01 | Tampering | mitigate | CLOSED | `phase-224-edge-review-status.cjs:66-85` sentinelPresent -> {applied:false}; BEGIN/COMMIT/ROLLBACK; PRAGMA probe `reviewStatusColumnPresent` line 57-64 guards ALTER at line 73. Chained `room-db.cjs:147`. Live: 224-01 migration leg PASSED |
| T-224-02 | Elevation of privilege | mitigate | CLOSED | `edges.cjs:717` frozen enum {proposed,confirmed}; validation `edges.cjs:736` -> invalid_review_status; upsert `edges.cjs:765` DO UPDATE SET properties only (`grep excluded.review_status` = 0 hits). Derivation writes 'proposed' `graph-derivation.cjs:301` |
| T-224-03 | Repudiation | accept | CLOSED | NULL "not-a-proposal" documented `phase-224-edge-review-status.cjs:18-31` (2 occurrences). Accepted-risk entry logged below |
| T-224-04 | Information disclosure | mitigate | CLOSED | `graph-derive-classifier.cjs` requires only node:fs, node:path, rs-differential-scorer (lines 59-63); zero network/db tokens on executable lines. Live: Part 8 sweep PASSED |
| T-224-05 | Denial of service | mitigate | CLOSED | Cascade Step 2b `intelligence-cascade.cjs:358-375` = enqueueDerive + detached unref'd spawn; no executable scoreMeasured (only comment line 347); spawn never awaited. Live: per-write-derive leg PASSED |
| T-224-06 | Denial of service | mitigate | CLOSED | `room-db.cjs:117-118` DatabaseSync `{timeout:5000}`; `synchronous=NORMAL` line 123; drain uses openRoomDb; single-flight lock `gsd-graph-derive-drain.cjs:216-219` (WR-03). Live: test-218-write-safety busy_timeout=5000 PASSED |
| T-224-07 | Tampering | mitigate | CLOSED | Cascade spawn is argv-array `intelligence-cascade.cjs:367-373` (no shell); import `execFileSync`/`spawn` line 32; zero executable execSync (line 27 is a comment). CR-02 review-fix confirmed. Drain type/length-validates roomDir `gsd-graph-derive-drain.cjs:327` |
| T-224-08 | Information disclosure | mitigate | CLOSED | `gsd-graph-derive-drain.cjs:194-203` derivation_skipped payload = reason enum, basename trigger (path.basename), numeric pairs_skipped, dedupe_key; no artifact body. Live: encoder-skip leg PASSED |
| T-224-09 | Denial of service | mitigate | CLOSED | Drain wrapped in try/catch throughout; CLI `process.exit(0)` lines 398, 413; disclose swallows errors `gsd-graph-derive-drain.cjs:204-208`; cascade Step 2b own try/catch line 376 |
| T-224-10 | Elevation of privilege | mitigate | CLOSED | `gsd-artifact-graph-hook.cjs:118-124` fallback rides `resolveWriteRoom`; abs_path existsSync-checked before return (line 123); registry.json/reg.rooms read removed. Live: resolver-fallback leg PASSED |
| T-224-11 | Spoofing | accept | CLOSED | Test-scoped tmp roots; production precedence pinned by sentinel-present test leg. Accepted-risk entry logged below |
| T-224-12 | Elevation of privilege | mitigate | CLOSED | Derived edge + node land review_status 'proposed' (`graph-derivation.cjs:281,301`); first-insert 'confirmed' requires byUser `edges.cjs:748-749` -> confirmed_requires_by_user (WR-10). Live: proposed-only leg PASSED (no-confirm sweep over 6 modules) |
| T-224-13 | Denial of service | mitigate | CLOSED | `graph-backfill.cjs:215` BACKFILL_PAIR_CHUNK=50; chunked loop lines 421-422; stderr progress lines 429-430; navigator-triggered (backfill command path, not write path). Live: backfill-idempotent leg PASSED |
| T-224-14 | Information disclosure | mitigate | CLOSED | Backfill scores LOCAL via scoreMeasured only; no egress token. Live: Part 8 sweep (includes graph-backfill.cjs) PASSED |
| T-224-15 | Repudiation | mitigate | CLOSED | `run-all-224.sh:68-70` strip_comments before every grep; MISSING target fails leg (lines 115-116, 135-136, 141-142, 147-148), never skips. Tripwire-plant proof in 224-04 acceptance |
| T-224-16 | Information disclosure | mitigate | CLOSED | `run-all-224.sh:111-121` Part 8 egress sweep over all five surfaces (fetch/http(s)/node:http(s)/curl/wget). Live: Part 8 sweep PASSED |
| T-224-17 | Elevation of privilege | mitigate | CLOSED | `run-all-224.sh:133-152` Part 9 sweep: classifier no direct-db, drain/backfill no raw INSERT INTO edges, graph-derivation requires navigation.cjs. Live: Part 9 sweep PASSED |
| T-224-SC | Tampering (supply chain) | mitigate | CLOSED | `run-all-224.sh:160-164` git-diff leg on package.json/package-lock.json; live `git diff --stat` = no drift; no install task in phase. Live: dependency-diff leg PASSED |

---

## Accepted Risks Log

| Threat ID | Risk | Why accepted | Documentation |
|-----------|------|--------------|---------------|
| T-224-03 | Legacy/non-derivation edges carry review_status NULL and are never retroactively relabeled | Low risk by design. NULL is the honest third state ("not part of the proposal lifecycle"): a NULL row is never demoted to 'proposed' (a human-trusted edge must not appear in the ratify surface) and never silently promoted to 'confirmed' (only the byUser path mints that trust). No code path relabels NULL rows. | `phase-224-edge-review-status.cjs` header lines 18-36 |
| T-224-11 | Test registry/env fixtures could spoof room resolution | Confined to test scope. Tests build tmp rooms under a tmp MINDRIAN_ROOMS_ROOT; production resolveWriteRoom precedence (room-root, session.primary, reg.active) is unchanged and pinned by the sentinel-present regression test. No production surface trusts a test-injected registry. | `tests/test-224-resolver-fallback.cjs` (sentinel-present leg); 224-03-PLAN threat register |

---

## Unregistered Flags

None. No SUMMARY.md carries a `## Threat Flags` section; the plan-time register (T-224-01..17 + SC)
covers all declared attack surface, and no new attack surface was introduced during implementation
that lacks a threat mapping.

## Post-Review Hardening (informational, not in the plan-time register)

The 224-REVIEW-FIX pass (14 findings, all fixed) added defense that strengthens the register but was
not a plan-time threat. Confirmed present in code during this audit:

- **CR-02** command-injection removal: all cascade child-process sites converted shell-string
  `execSync` -> argv-array `execFileSync`; zero executable `execSync` remains (`intelligence-cascade.cjs`).
  Reinforces T-224-07.
- **WR-11** raw-db write-safety: `gsd-artifact-graph-hook.cjs:165` opens with `{timeout:5000}`,
  joining the Phase-218 busy-timeout fold. Reinforces T-224-06.
- **WR-12** SQL-injection removal: `graph-derivation.cjs:395-396,446` parameterized ATTACH via
  `prepare('ATTACH DATABASE ? ...')` + `_fileUriPath` percent-encoding; no interpolated ATTACH string
  remains. New injection surface (child-room directory names in rollup) found and closed during review.
- **WR-10** byUser attribution gate on edge-level 'confirmed'. Reinforces T-224-12.

These are recorded for traceability; none is an open item.

---

## Sign-off

All 18 declared threats resolve to CLOSED (16 mitigations located in code, 2 accepted risks
documented). The Part 8 egress, Part 9 chokepoint, and zero-dependency guarantees are permanent
re-runnable tripwires in `tests/run-all-224.sh`, verified live during this audit. No BLOCKER, no
WARNING. Phase 224 clears security audit.
