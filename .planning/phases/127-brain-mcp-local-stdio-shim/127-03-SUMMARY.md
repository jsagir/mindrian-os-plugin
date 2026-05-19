---
phase: 127-brain-mcp-local-stdio-shim
plan: 127-03
title: Acceptance harness + Canon Part 8 audit + Capability map + BRAIN-SETUP + run-all-127.sh aggregator
status: complete
shipped: 2026-05-19
wave: 3
requirements_addressed: [BRAIN-MCP-127-10]
beta_target: v1.13.0-beta.20
note_metadata_recovery: |
  This SUMMARY.md was written manually after the parallel executor agent
  (gsd-executor, ~11 min runtime, 65 tool uses) experienced a socket
  connection drop AFTER all 4 task commits landed cleanly but BEFORE the
  final metadata commit (SUMMARY.md + STATE.md + ROADMAP.md updates).
  Recovery sequence: verify 4 commits landed via git log (confirmed),
  verify all 6 deliverable files on disk (confirmed), verify
  `bash tests/run-all-127.sh` -> 12/12 suites green (confirmed),
  reconstruct SUMMARY.md from commit history + file inspection.
---

# Plan 127-03 -- Summary

## What shipped

**The closing audit + documentation plan for Phase 127.** Wave 3 parallel partner to 127-02 (Doctor Class M + Tier-0). Ran with --no-verify per the parallel-execution convention. Connection dropped during the metadata phase; SUMMARY/STATE/ROADMAP finalized manually post-recovery.

### Task 1 (commit fbba8b4c): 4-fixture acceptance gates harness

Created `tests/test-127-03-acceptance-gates.sh` (210 LOC, executable). Exercises CONTEXT.md acceptance gates 1-5 against 4 hermetic fixtures (clean / with-key / Lawrence-state-simulated / Tier-0). Per-gate result grid: Gate 1 PASS, Gate 2 SKIP-or-PASS (network-conditional), Gate 3 PASS, Gate 4 PASS, Gate 5 PASS.

### Task 2 (commit 0255b513): Canon Part 8 adversarial audit + no-em-dashes harnesses

Created `tests/test-127-03-canon-part-8-adversarial.sh` (110 LOC, executable). Sweeps 6 production source files (`bin/mindrian-brain-mcp-client.cjs`, `lib/core/directive-envelope.cjs`, `lib/core/tier0-messaging.cjs`, `lib/core/doctor/class-m-brain-smoke.cjs`, `scripts/migrate-brain-mcp-from-http-to-stdio.cjs`, `lib/core/migration-snapshot.cjs`) for 6 forbidden patterns (`fetch\(`, `http\.`, `brain\.mindrian\.ai`, `mindrian-brain\.onrender\.com`, `sendPacket\(`, `buildBrainPacket`). Inverse check confirms `lib/core/brain-client.cjs` IS the sole allowed network surface. Zero violations across all 36 grep cells (6 sources x 6 patterns).

Created `tests/test-127-03-no-em-dashes.sh` (75 LOC, executable). Sweeps all 21+ Phase 127 files (sources + tests + fixtures + docs) for U+2014. Zero hits. Per-file failure points at the responsible plan via the file path prefix in the harness output.

### Task 3 (commit 4e423762): CAPABILITY-MAP + machine-readable registry + BRAIN-SETUP rewrite

Patched `docs/CAPABILITY-MAP.md`:
- Row #1 (DirectiveEnvelope) flipped from "planned" to "shipped (v1.13.0-beta.20)"
- Line 125 Class K reference patched to Class M with footnote explaining the rename rationale (Class K is taken by `--stale-first-touch`; M is the next free letter)

Created `data/capability-map-registry.json` (23 LOC). Machine-readable mirror of the human-readable doc. DirectiveEnvelope entry: `{capability: "DirectiveEnvelope", status: "shipped", version: "v1.13.0-beta.20", phase: 127, mode_default: "GUIDED", canon_parts: ["Part 7", "Part 8"], plan_owner: "127-00"}`.

Rewrote `docs/install/BRAIN-SETUP.md` (323 LOC -> ~120 LOC compacted; the legacy `claude mcp add -t http ...` ceremony moved from "do this" to "What changed" history section). The one-step path is now: install plugin + (optionally) drop key in `~/.mindrian.env`. Per Canon Part 6 dog-fooding mandate: the install path is now honest about itself.

### Task 4 (commit 2ed5a3b5): tests/run-all-127.sh aggregator

Added from plan-checker Warning 1 (2026-05-19). Mirrors `tests/run-all-126.sh` shape verbatim:
- 6 SHELL_SUITES: test-127-00-shim-handshake / test-127-01-migration-safety / test-127-02-doctor-class-m / test-127-03-acceptance-gates / test-127-03-canon-part-8-adversarial / test-127-03-no-em-dashes
- 6 CJS_SUITES: bin/mindrian-brain-mcp-client.test.cjs / lib/core/directive-envelope.test.cjs / scripts/migrate-brain-mcp-from-http-to-stdio.test.cjs / lib/core/migration-snapshot.test.cjs / lib/core/doctor/class-m-brain-smoke.test.cjs / lib/core/tier0-messaging.test.cjs
- Final aggregator exit 0 iff all 12 suites pass; PASS/FAIL grid + Total/Passed/Failed/Time summary

`bash tests/run-all-127.sh` final invocation (2026-05-19 22:30 UTC, post-recovery): **12/12 suites GREEN** in 11 seconds.

## Goal-backward must_haves (all verified)

1. **BRAIN-MCP-127-10 covered:** capability map flipped, registry mirror landed, acceptance + Part 8 + no-em-dashes harnesses all green, BRAIN-SETUP rewrite landed.
2. **Canon Part 8 delegation property structurally proven:** zero violations across 6 production sources x 6 forbidden patterns.
3. **HARD RULE no em-dashes:** zero U+2014 across 21+ files.
4. **Phase 127 close-out:** 10 of 10 BRAIN-MCP-127-XX requirements addressed across plans 127-00 / 127-01 / 127-02 / 127-03.
5. **Class K -> Class M rename surfaced everywhere:** doctor.cjs, class-m-brain-smoke.cjs, commands/doctor.md, CAPABILITY-MAP.md line 125 footnote, REQUIREMENTS.md.
6. **One-step onboarding:** BRAIN-SETUP.md no longer mandates manual MCP wiring; the stdio shim + auto-migration handle it.

## Deviations from action specification

None known. The 4 task commits landed exactly per plan spec. Connection drop occurred ON the final metadata write (SUMMARY.md + STATE + ROADMAP), not during task execution. All test gates green at the time of disconnection.

## Deferred to v1.13.0-beta.21 (rides alongside Phase 127.1)

Per plan-checker Warning 3 (2026-05-19):

- `bin/local-chain-recommender.cjs` Tier-LOCAL fallback (CONTEXT.md lines 211-216 additive primitive, ~80 LOC). This CONTEXT-approved primitive is NOT in scope for Phase 127's v1.13.0-beta.20 cut. It ships in v1.13.0-beta.21 either as an extension of Phase 127.1 OR as a standalone Phase 127.2 if the surfaces want separate rollback paths.

## Files created / modified

**Created (6):**
- `/home/jsagi/MindrianOS-Plugin/tests/test-127-03-acceptance-gates.sh` (210 LOC, executable)
- `/home/jsagi/MindrianOS-Plugin/tests/test-127-03-canon-part-8-adversarial.sh` (110 LOC, executable)
- `/home/jsagi/MindrianOS-Plugin/tests/test-127-03-no-em-dashes.sh` (75 LOC, executable)
- `/home/jsagi/MindrianOS-Plugin/tests/run-all-127.sh` (131 LOC, executable)
- `/home/jsagi/MindrianOS-Plugin/data/capability-map-registry.json` (23 LOC)
- `/home/jsagi/MindrianOS-Plugin/.planning/phases/127-brain-mcp-local-stdio-shim/127-03-SUMMARY.md` (this file)

**Modified (2):**
- `/home/jsagi/MindrianOS-Plugin/docs/CAPABILITY-MAP.md` (DirectiveEnvelope row flipped + Class M footnote)
- `/home/jsagi/MindrianOS-Plugin/docs/install/BRAIN-SETUP.md` (323 -> 120 LOC; legacy ceremony moved to "What changed")

## Phase 127 close-out signal

Phase 127 ready for verifier (gsd-verifier). Once verifier returns `status: passed`, Phase 127 marks complete in ROADMAP + STATE, the v1.13.0-beta.20 release cut is unblocked.

Next phase per `.planning/v1.13.1-EXECUTION-PLAN.md` AMENDMENT (2026-05-19): Phase 127.1 (Brain GraphRAG Collapse Pinecone -> Neo4j HNSW) ships as v1.13.0-beta.21.

---

*SUMMARY recovered + finalized 2026-05-19 after socket-drop recovery.*
