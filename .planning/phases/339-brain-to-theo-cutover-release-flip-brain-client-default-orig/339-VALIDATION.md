---
phase: 339
slug: brain-to-theo-cutover-release-flip-brain-client-default-orig
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-03
---

# Phase 339 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Sourced from `339-RESEARCH.md` "Validation Architecture" (2026-09-03); the planner refines the Per-Task map, the executor flips statuses.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain Node CJS test files under `tests/`, invoked bare (`node tests/test-NNN-x.cjs`); `node:test` + `node:assert/strict` where new (the `test-250`, `test-234` idiom) |
| **Config file** | none - discovery is glob inside a per-phase bash aggregator (`tests/run-all-339.sh`, copied from `tests/run-all-276.sh`: `PREFIX` variable, `found -eq 0` guard, `run_may_skip`, Part 8 source sweep scoped to this phase, no-em-dash fence, Wave-0-red-by-design header) |
| **Quick run command** | `node tests/test-339-<name>.cjs` (single arm, under 5 s) |
| **Full suite command** | `bash tests/run-all-339.sh` |
| **Related suites that must stay green** | `bash tests/run-all-250.sh`, `bash tests/run-all-252.sh`, `node tests/test-254-normalize-roundtrip-probe.cjs`, `node tests/test-245-skill-frontmatter-inert-keys.cjs`, `node tests/test-247-contract-client.cjs`, `node tests/test-brain-response-sanitize.cjs`, `node lib/core/doctor/class-m-brain-smoke.test.cjs` |
| **Release gate (both cuts)** | `bash tests/run-all-339.sh` green, then `bash scripts/verify-release` zero FAIL, then `node scripts/doctor.cjs --acceptance`, then `bash scripts/release.sh --prerelease` (human-held) |
| **Estimated runtime** | ~30 seconds for the phase suite; verify-release ~2-3 minutes |

---

## Sampling Rate

- **After every task commit:** Run the task's own `node tests/test-339-<name>.cjs`; for any commit touching `brain-client.cjs` or `refusal-messaging.cjs` also run `node tests/test-254-normalize-roundtrip-probe.cjs` and `node tests/test-250-refusal-shapes.cjs`
- **After every plan wave:** Run `bash tests/run-all-339.sh`, plus `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/check-shape-declaration.cjs`
- **Before each cut:** phase suite green, `verify-release` zero FAIL, `doctor --acceptance`
- **Before `/gsd-verify-work`:** Full suite must be green; FLIP-12 manual verification recorded
- **Max feedback latency:** 30 seconds (per-task), 180 seconds (per-wave)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 339-W0 | 01 | 0 | FLIP-01 | T-339-01 | no runtime origin literal outside the allowlist | unit (source scan) | `node tests/test-339-origin-single-source.cjs` | ❌ W0 | ⬜ pending |
| 339-W0 | 01 | 0 | FLIP-02 | - | two alias tables, origin-selected, disjoint from local router map | unit | `node tests/test-254-normalize-roundtrip-probe.cjs` (Arms 4-5 modified, RED by design until the selector lands) | ✅ | ⬜ pending |
| 339-W0 | 01 | 0 | FLIP-03a/b/c | - | Theo scored, Theo refusal (total>0 captures, total==0 does not), incumbent unchanged | unit | `node tests/test-339-enrichment-theo-shapes.cjs` | ❌ W0 | ⬜ pending |
| 339-W0 | 01 | 0 | FLIP-04 / 04b | - | update path from ONE constant, refusal shape pins intact | unit | `node tests/test-339-update-path-single-source.cjs`; `node tests/test-250-refusal-shapes.cjs` (pin added, RED by design) | ❌ W0 / ✅ | ⬜ pending |
| 339-W0 | 01 | 0 | FLIP-05 | - | schema memo keyed by resolved origin | unit (source scan) | `node tests/test-339-schema-memo-origin-keyed.cjs` | ❌ W0 | ⬜ pending |
| 339-W0 | 01 | 0 | FLIP-06 | - | generated mirrors regenerated, never hand-edited | integration | `node scripts/build-skill-mirrors.cjs --check && node scripts/build-dist-bundles.cjs --check-stale` (wired into run-all-339.sh) | ✅ scripts | ⬜ pending |
| 339-W0 | 01 | 0 | FLIP-07 | - | cross-repo note exists at the exact path Theo cites | unit | `bash tests/test-339-cross-repo-note.sh` | ❌ W0 | ⬜ pending |
| 339-W0 | 01 | 0 | FLIP-08 | - | 269-05 checklist reads the three real legs | unit | `bash tests/test-339-269-05-checklist.sh` | ❌ W0 | ⬜ pending |
| 339-W0 | 01 | 0 | FLIP-09 | T-339-09 | gate verify is a pure read; porcelain byte-identical in both repos | integration | `bash tests/test-339-gate-zero-write.sh` (Wave 0 GREEN: the ruling already exists) | ❌ W0 | ⬜ pending |
| 339-FLIP | last | last | FLIP-10 | - | line 24 is the bare Theo origin; docblock clean | unit | `node tests/test-245-skill-frontmatter-inert-keys.cjs` (CLAIM b retargeted) + `grep -F` on line 24 | ✅ | ⬜ pending |
| 339-FLIP | last | last | FLIP-11 | - | doctor layer 6 honest against Theo-shaped `brain_stats`, per-origin floor | unit | `node lib/core/doctor/class-m-brain-smoke.test.cjs` | ✅ | ⬜ pending |
| 339-FLIP | last | last | FLIP-12 | - | installed session returns structured Theo answers | manual | see Manual-Only | - | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. The planner replaces the `339-W0` / `339-FLIP` placeholders with real task IDs.*

---

## Wave 0 Requirements

- [ ] `tests/run-all-339.sh` - aggregator copied from `tests/run-all-276.sh` (glob `PREFIX`, `found -eq 0` guard, `run_may_skip`, Part 8 sweep scoped to this phase's targets with the `brain-client` allowlist stated, no-em-dash fence, Wave-0-red-by-design header); wires `build-dist-bundles.cjs --check-stale`
- [ ] `tests/test-339-origin-single-source.cjs` - FLIP-01 (allowlist exactly `brain-client.cjs:24` and `class-m-brain-smoke.cjs`'s canon constant, each with a written reason)
- [ ] `tests/test-339-enrichment-theo-shapes.cjs` - FLIP-03a/b/c (four fixtures through the exported `captureReadinessMiss`, `enrichment-queue.cjs:519`)
- [ ] `tests/test-339-update-path-single-source.cjs` - FLIP-04 (cross-checks `release-process.md:23-26`, `lib/core/update-path.cjs`, rendered refusal copy)
- [ ] `tests/test-339-schema-memo-origin-keyed.cjs` - FLIP-05 (structural, over `schema()`)
- [ ] `tests/test-339-cross-repo-note.sh` - FLIP-07
- [ ] `tests/test-339-269-05-checklist.sh` - FLIP-08
- [ ] `tests/test-339-gate-zero-write.sh` - FLIP-09 (GREEN in Wave 0 by design)
- [ ] Modify `tests/test-254-normalize-roundtrip-probe.cjs` Arms 4-5 - FLIP-02 (RED by design until the selector lands)
- [ ] Modify `tests/test-250-refusal-shapes.cjs` - FLIP-04b update-path pin (RED by design until the copy lands)

No framework install is needed: `node:test` and `node:assert/strict` are the repo idiom.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Installed session running the FLIP release returns structured Theo answers | FLIP-12 | Requires a released artifact, a plugin-cache update, and a live Larry turn; automating it would mean publishing a release from a test | After `release.sh` on the flip cut: `/plugin marketplace update` then `claude plugin update mos@mindrian-marketplace`; in a fresh session ask Larry for `brain_stats` and one `brain_ask`; confirm Neo4j-shaped `{nodes, relationships, labels}` (NOT memgraph 29,200); run `node scripts/probe-brain-contract.cjs` and record leg inversions as EXPECTED; record cold-start latency of the first call; message Session T "<version> flip verified" plus the six flip-day fields |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s per task
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
