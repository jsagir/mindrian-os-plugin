---
phase: 125
slug: f-selector-ranker
status: planner_approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-13
updated: 2026-05-13 (planner pass)
---

# Phase 125 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Every task in every plan has an `<automated>` verify or Wave 0 stub dependency.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` runner (per Phase 109/110/122 precedent) |
| **Config file** | none -- aggregator script pattern |
| **Quick run command** | `node --test lib/memory/<specific-test>.test.cjs` |
| **Full suite command** | `bash tests/run-all-125.sh` (after Plan 08 ships) |
| **Estimated runtime** | ~30 seconds (pure functions + fixture I/O; no network; no Brain calls except mocks) |

---

## Sampling Rate

- **After every task commit:** Run `node --test` on the touched test file (~2s per file)
- **After every plan wave:** Run `tests/run-all-125.sh` (~30s)
- **Before `/gsd:verify-work`:** Full suite green + no regressions in tests/run-all-109.sh + run-all-110.sh + run-all-122.sh
- **Max feedback latency:** 30 seconds for full suite; <5s for per-task quick run

---

## Per-Task Verification Map

Each plan ships 1-3 tasks; each task carries an `<automated>` verify command.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Wave 0 Stub | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 125-00-01 | 00 | 0 | RANKER-125-00 | unit (pure) | `node --test lib/memory/navigation-write-edge.test.cjs` | Wave 0 stub req | pending |
| 125-00-02 | 00 | 0 | RANKER-125-00 | smoke (export check) | inline `node -e` import check | n/a | pending |
| 125-01-01 | 01 | 1 | RANKER-125-02 | smoke (EVENT_TYPES) | inline `node -e` membership check | n/a | pending |
| 125-01-02 | 01 | 1 | RANKER-125-01/02 | unit (pure) | `node --test lib/memory/navigation-projections.test.cjs` | Wave 0 stub req | pending |
| 125-02-01 | 02 | 1 | RANKER-125-03/04 | unit + mocked Brain | `node --test lib/memory/brain-cypher-chain-slice.test.cjs` | Wave 0 stub req | pending |
| 125-03-01 | 03 | 2 | RANKER-125-05 | integration (packet build) | `node --test lib/memory/packet-chain-hint.test.cjs` | Wave 0 stub req | pending |
| 125-04-01 | 04 | 1 | RANKER-125-06 | contract (schema/ajv) | `node --test lib/memory/packet-schema-validation.test.cjs` | Wave 0 stub req | pending |
| 125-05-01 | 05 | 3 | RANKER-125-07/08 | unit (pure) | `node --test lib/memory/f-selector-ranker.test.cjs` | Wave 0 stub req | pending |
| 125-06-01 | 06 | 3 | RANKER-125-09 | smoke (EVENT_TYPES) | inline `node -e` membership check | n/a | pending |
| 125-06-02 | 06 | 3 | RANKER-125-09/10 | integration (edges + decay via Plan 00) | `node --test lib/memory/selector-decisions.test.cjs` | Wave 0 stub req | pending |
| 125-07-01 | 07 | 3 | RANKER-125-11 | smoke (EVENT_TYPES) | inline `node -e` membership check | n/a | pending |
| 125-07-02 | 07 | 3 | RANKER-125-11 | integration (miss capture) | `node --test lib/memory/selector-miss.test.cjs` | Wave 0 stub req | pending |
| 125-07-03 | 07 | 3 | RANKER-125-11 | smoke (affordance label) | inline `node -e` string check | n/a | pending |
| 125-08-01 | 08 | 4 | RANKER-125-12 | doc presence + line count | `wc -l docs/F-SELECTOR-CONSUMER-GUIDE.md` >= 80 | n/a | pending |
| 125-08-02 | 08 | 4 | RANKER-125-12 | doc grep coverage | inline `grep` for 4 consumer surfaces + canon notes | n/a | pending |
| 125-08-03 | 08 | 4 | RANKER-125-12 | aggregator run | `bash tests/run-all-125.sh` | n/a | pending |

*Status: pending -> green -> red -> flaky*

---

## Wave 0 Requirements (test scaffold)

These test files MUST exist BEFORE Wave 1+ execution starts. Plan 00 creates the first; Plans 01-07 each create theirs in their first task. Plan 08 ships the aggregator + Feynman registration in Wave 4.

- [ ] `lib/memory/navigation-write-edge.test.cjs` (Plan 00)
- [ ] `lib/memory/navigation-projections.test.cjs` (Plan 01)
- [ ] `lib/memory/brain-cypher-chain-slice.test.cjs` (Plan 02)
- [ ] `lib/memory/packet-chain-hint.test.cjs` (Plan 03)
- [ ] `lib/memory/packet-schema-validation.test.cjs` (Plan 04)
- [ ] `lib/memory/f-selector-ranker.test.cjs` (Plan 05)
- [ ] `lib/memory/selector-decisions.test.cjs` (Plan 06)
- [ ] `lib/memory/selector-miss.test.cjs` (Plan 07)
- [ ] `tests/run-all-125.sh` aggregator + Feynman registration (Plan 08)
- [ ] `tests/fixtures/f-selector-ranker/` shared fixtures (optional; tests may stub registry/taxonomy inline)

---

## Cross-Plan Sampling Continuity

No 3 consecutive tasks without an automated verify. Verified across plans:

- Plan 00 (Wave 0): 2 tasks, both with automated verify.
- Plan 01 (Wave 1): 2 tasks, both with automated verify.
- Plan 02 (Wave 1): 1 task, automated.
- Plan 03 (Wave 2): 1 task, automated.
- Plan 04 (Wave 1): 1 task, automated.
- Plan 05 (Wave 3): 1 task, automated + 26 test behaviors.
- Plan 06 (Wave 3): 2 tasks, both automated.
- Plan 07 (Wave 3): 3 tasks, all automated.
- Plan 08 (Wave 4): 3 tasks, all automated (doc presence + grep + aggregator run).

---

## Manual-Only Verifications (deferred from automated path)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 'why' content reads as Larry-voice at low investment | RANKER-125-08 (D9) | Pedagogical tone is subjective | Pick 3 random commands; invoke ranker with investment_level=0.1; verify 'why' string reads as 1-2 sentence Larry-voice teaching prose (not robotic). |
| 'none fit' affordance label is unambiguous | RANKER-125-11 (D8 + Open Q #8) | UX subjective | Show the locked label "None fit -- tell me what you need" to one Wave-1 tester; ask "what does this offer to do?" Pass if answer matches intended ("let me describe what I need instead"). |
| Decay-weight intuition feels right | RANKER-125-10 (D7) | Behavioral perception | Reject a command; verify it doesn't reappear in top-K for next 1-2 invocations but reappears by invocation 10-15. Compare across 5 commands. |

---

## HARD PRECONDITION Gates

| Gate | Verified By | Failure Mode |
|------|-------------|--------------|
| Phase 104.1 shipped (teaching + jtbd_label + jtbd_summary in command-registry.json) | `node -e "const r = require('/home/jsagi/MindrianOS-Plugin/data/command-registry.json'); console.log(r.commands.every(c => c.jtbd_summary && c.teaching));"` outputs `true` | Plan 05 rankForSelector fails closed on every command -> returns empty list -> F-selector shows nothing -> consumer surfaces have no top-K to render |
| navigation.cjs Plan 00 writeEdge shipped before Plan 06 | `node -e "const n = require('/home/jsagi/MindrianOS-Plugin/lib/core/navigation.cjs'); console.log(typeof n.writeEdge === 'function');"` outputs `true` | Plan 06 recordSelectorDecision throws on writeEdge call -> can't write DEFERRED/REJECTED edges through chokepoint |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 stub dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (8 test files + 1 aggregator + Feynman registration)
- [x] No watch-mode flags (all `node --test` invocations are one-shot)
- [x] Feedback latency < 30s (aggregator runtime budget)
- [x] HARD GATE: Phase 104.1 shipped before Phase 125 execute-phase (verifier check on command-registry.json)
- [x] INTRA-PHASE GATE: navigation.cjs Plan 00 writeEdge shipped before Plan 06 selector-decisions.cjs (Wave 0 -> Wave 3 ordering)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Planner-approved 2026-05-13 (post plan-phase 125 pass).
