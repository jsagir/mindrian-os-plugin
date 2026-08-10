---
phase: 249
slug: context-driven-enrichment
status: draft (pre-execution)
note: "Every referenced 249 test file is born RED-first INSIDE the tdd task that needs it (there is no separate Wave 0 plan); wave_0_complete flips true when the wave-1 plans (249-01, 249-02) land their suites. It is ACCEPTABLE to start /gsd-execute-phase 249 now - wave 1 begins with the test-creating tasks."
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-10
source: 249-RESEARCH.md "## Validation Architecture" section (2026-08-10)
---

# Phase 249 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Two repos: plugin (CJS, node --test) and ProblemsWorthSolving-Brain (ESM, node --test). The eval-honesty rule binds everything here: a test that cannot fail is not evidence - every gate ships a demonstrated red proof.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node --test (plugin `tests/test-249-*.cjs`; brain `tests/*.test.mjs`) + bash phase runner + live probe scripts (read-tier key from `~/.mindrian.env`) |
| **Config file** | none (convention-based); Node >= 22.16.0 (plugin floor) |
| **Quick run command** | `node --test tests/test-249-<name>.cjs` (plugin) / `cd /home/jsagi/dev/ProblemsWorthSolving-Brain && node --test tests/<name>.test.mjs` (brain) |
| **Full suite command** | `bash tests/run-all-249.sh` (created by 249-01 Task 3: glob discovery of tests/test-249-*, found-eq-0 guard, em-dash fence) + brain `node --test tests/` |
| **Live legs** | `node scripts/check-flagship-floor.cjs` (plugin, the SWEEP-02 gate instrument) + `node scripts/probe-framework-evals.mjs` (brain, per-fixture known-answer probe) - both status-honest, both exit non-zero on miss |
| **Estimated runtime** | hermetic suites ~10-30s per file; live probes ~30-90s (Render cold start possible) |

---

## Sampling Rate

- **After every task commit:** run the touched repo's targeted test file (the task's own `<automated>` command).
- **After every plan wave:** `bash tests/run-all-249.sh` green + brain `node --test tests/` green.
- **Before the phase gate:** both suites green + live evals green for every enriched framework + the floor gate's HONEST status filed (red with fewer misses is the expected in-phase state; green only when ENRICH-04 completes across the milestone tail - it gates SWEEP-02, not this phase's exit).
- **Max feedback latency:** < 60s for the hermetic layer; live legs are async-tolerant (Render).

---

## Per-Requirement Verification Map

| Req | Behavioral contract | Test type | Automated command | Test file | File exists | Plan/Task | Coverage |
|-----|---------------------|-----------|-------------------|-----------|-------------|-----------|----------|
| ENRICH-01 | Enqueue on score<=2 / grounded:false; idempotency on canonical name; hit_count increments; caps; self-healing; never throws into caller | unit (hermetic, temp dirs) | `node --test tests/test-249-enrichment-queue.cjs` | `tests/test-249-enrichment-queue.cjs` | NO - born RED-first in task | 249-01 T1 | HIGH |
| ENRICH-01 | Queue file free of user prose; entry shape matches the closed allowlist (Part 8) | unit (forbidden-substring audit, Test-12 pattern) | same file | same file | NO - same task | 249-01 T1 | HIGHEST (constitutional) |
| ENRICH-01 | Wrapper capture on real payloads only (sentinels/null excluded); chain-slice per-seed piggyback; hot-path grep fence (no probe in sensors/decide) | unit (loopback mock server + stub client) | `node --test tests/test-249-capture-seam.cjs` | `tests/test-249-capture-seam.cjs` | NO - born RED-first in task | 249-01 T2 | HIGH |
| ENRICH-01 | `dimensions` vector present in T6 response, sums to readiness_score, purely additive | unit (brain, hermetic) | `cd /home/jsagi/dev/ProblemsWorthSolving-Brain && node --test tests/arm1-orchestrator.test.mjs` | `tests/arm1-orchestrator.test.mjs` | EXISTS - extend | 249-02 T1 | MEDIUM (few lines, additive) |
| ENRICH-02 | Per-framework known-answer eval passes on conforming responses; a deliberately wrong fixture turns it RED (in-suite assertion); fixture-class rule enforced | unit (hermetic checker + red-proof.mjs sabotage seam) | `cd /home/jsagi/dev/ProblemsWorthSolving-Brain && node --test tests/eval-framework-structure.test.mjs` | `tests/eval-framework-structure.test.mjs` + `tests/fixtures/framework-evals/*.json` | NO - born RED-first in task | 249-02 T2 | HIGHEST (eval-honesty rule) |
| ENRICH-02 | Same fixtures probed LIVE against the deployed service; dimensions PENDING-DEPLOY printed loudly until the 249-03 push, never silently passed | integration (live, read tier) | `node /home/jsagi/dev/ProblemsWorthSolving-Brain/scripts/probe-framework-evals.mjs` | `scripts/probe-framework-evals.mjs` (brain) | NO - same task | 249-02 T2, re-run 249-03 T3 | HIGH (catches "ingested locally, stale on Render") |
| ENRICH-02 | Dry-run statement plan renders as the reviewable diff; reject-fails-whole; no write path without the admin tier | existing brain ingest suite + operator checkpoint | `cd /home/jsagi/dev/ProblemsWorthSolving-Brain && node --test tests/` | existing `tests/ingest-*.test.mjs` | EXISTS (shipped pipeline) | 249-03 T3 (checkpoint) | MEDIUM (pre-existing machinery) |
| ENRICH-03 | Every measured JTBD variant + both loose fragments normalize live to exactly ONE canonical | integration (live, read tier, post-collapse) | runbook proof-probe list + the jtbd fixture leg of `probe-framework-evals.mjs` | `tests/fixtures/framework-evals/jtbd.json` | NO - authored 249-03 T1 | 249-03 T1 (author) / T3 (prove) | HIGH |
| ENRICH-04 | Every invoked framework: exactly 1 canonical match AND readiness >= 3/4, live; exit non-zero on any miss; both denominators printed until ratified | integration (live; the SWEEP-02 gate) + hermetic logic test | `node scripts/check-flagship-floor.cjs` ; `node --test tests/test-249-floor-gate.cjs` | `scripts/check-flagship-floor.cjs`, `tests/test-249-floor-gate.cjs` | NO - born RED-first in task | 249-02 T3, re-run 249-03 T2/T3 | HIGHEST (the milestone finish line) |

*Coverage ranking (Nyquist sampling weight): the Part-8 audit, the eval red proofs, and the floor gate get the densest coverage - they are the failure modes that look complete but are not (silent prose leak, a gate that cannot fail, a floor measured against an ambiguous set). The baseline RED run of the floor gate (24 misses expected) is itself the gate's live red proof.*

---

## Wave 0 Requirements

(Research "Wave 0 Gaps", mapped to the tasks that create each file RED-first - no separate Wave 0 plan exists.)

- [ ] `lib/core/enrichment-queue.cjs` + `tests/test-249-enrichment-queue.cjs` - 249-01 T1
- [ ] `scripts/enrichment-queue-append.cjs` (CLI: skill leg + Phase-250 refusal leg + census seed) - 249-01 T1/T3
- [ ] `tests/test-249-capture-seam.cjs` - 249-01 T2
- [ ] `tests/run-all-249.sh` (glob discovery, found-eq-0 guard, em-dash fence) - 249-01 T3
- [ ] brain `dimensions` field + `tests/arm1-orchestrator.test.mjs` extension - 249-02 T1 (cross-repo; deploy rides 249-03 T3)
- [ ] brain `tests/eval-framework-structure.test.mjs` + first fixture + red proof + `scripts/probe-framework-evals.mjs` - 249-02 T2
- [ ] `scripts/check-flagship-floor.cjs` + `tests/test-249-floor-gate.cjs` + the filed baseline RED run - 249-02 T3

---

## Manual-Only Verifications

| Behavior | Req | Why Manual | Test Instructions |
|----------|-----|------------|-------------------|
| Admin graph writes (collapse surgery, ingest commit, snapshot, push + Render redeploy) | ENRICH-02/03 | The admin key is NOT on this machine by design; every write is an operator act (246-02/247-03 precedent) | 249-03 T3 checkpoint: probe-brain-contract precondition, then the ordered ceremony with verbatim runbook statements; evidence = snapshot ids, dry-run verdicts, live readiness scores |
| Dry-run diff review: APPROVE / REJECT with reason / DEFER, including "is this chain real?" | ENRICH-02 | Human judgment on shape honesty (the Klein lesson) - a genuine Decision-Gate fork (Part 11) | 249-03 T3 step 5; the reviewer authors/confirms the fixture from the SOURCE document, never from the payload |
| Floor denominator ratification (25 canon vs 50 disk) | ENRICH-04 | Navigator decision; the discrepancy is recorded, never silently resolved | 249-03 T2 checkpoint:decision; blocks any ENRICH-04 closure claim; option-canon25 is the only legal producer of `data/flagship-floor-set.json` |
| Source-document supply for Tier-B payloads | ENRICH-02 | First-party sources only; a curriculum doc may exist only operator-side | 249-03 T1/T3: no named, read source = no payload, stop and surface |

---

## Validation Sign-Off

- [ ] Every task in all 3 plans has an `<automated>` verify command (checked: 9/9 tasks carry one, including both checkpoints)
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Every referenced-but-missing test file is created RED-first inside the task that needs it (TDD gate)
- [ ] Red proofs demonstrated, not asserted: eval checker sabotage, floor-gate sabotage fixture, and the live baseline RED run (24 misses) all filed in SUMMARYs
- [ ] No watch-mode flags in any test command
- [ ] Feedback latency < 60s for the hermetic layer
- [ ] Live legs run against pws-brain-mcp.onrender.com only (the cross-repo definition of done: ingested AND live AND re-probed)
- [ ] `wave_0_complete: true` set after 249-01 + 249-02 land their suites

**Approval:** pending
