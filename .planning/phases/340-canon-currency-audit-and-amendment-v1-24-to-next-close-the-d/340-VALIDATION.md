---
phase: 340
slug: canon-currency-audit-and-amendment-v1-24-to-next-close-the-d
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-05
---

# Phase 340 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Rewritten against the FINAL 5 plans (340-01-PLAN.md through 340-05-PLAN.md) after the planner
> replaced RESEARCH.md's provisional 8-entry draft numbering with the real 3-entry structure
> (entries 38, 39, 40) plus a Wave 0 scaffold plan and a close-out plan.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None -- bare Node.js `assert` module, zero third-party test framework (every `tests/test-canon-*-floor.cjs` this phase writes imports only `node:assert`, `node:fs`, `node:path`) |
| **Config file** | none -- each `tests/test-canon-entry-NN-*-floor.cjs` is a standalone executable script; `tests/run-all-340.sh` is a bash aggregator, not a config file |
| **Quick run command** | `node tests/test-canon-entry-38-sourced-claims-floor.cjs`, `node tests/test-canon-entry-39-graph-substrate-floor.cjs`, or `node tests/test-canon-entry-40-corpus-figures-floor.cjs` per amendment |
| **Full suite command** | `bash tests/run-all-340.sh` (does not exist yet -- created by 340-01 Task 2, modeled byte-for-byte on `tests/run-all-190.sh`) |
| **Estimated runtime** | ~5-15 seconds (bare Node assert scripts, no framework startup cost, no network) |

---

## Sampling Rate

- **After every task commit:** run that task's own `<automated>` verify command (every one of the 13 tasks across the 5 plans carries one; see the Per-Task Verification Map).
- **After every plan wave:** `bash tests/run-all-340.sh` plus `node tests/test-canon-frozen-scalars-floor.cjs` plus every prior-entry floor test whose version anchor that wave bumps (`test-canon-entry-31-two-gauge-floor.cjs`, `test-canon-entry-36-shape-declaration-floor.cjs`, `test-195-canon-7-kind-floor.cjs`).
- **Before `/gsd-verify-work`:** full suite green -- `bash tests/run-all-340.sh` exits 0 with 7 PASS / 0 FAIL / 0 SKIP (all three entry floor tests landed).
- **Max feedback latency:** ~15 seconds (no framework, no network, pure local file reads and greps).

---

## Per-Task Verification Map

13 tasks total across 5 plans / 5 waves. Every task -- including the three blocking navigator
checkpoints -- carries its own `<automated>` verify command in the plan; the checkpoint tasks are
ALSO gated on a human APPROVE reply, which the automated command cannot substitute for (see
Manual-Only Verifications below).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command (abbreviated) | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|----------------------------------|-------------|--------|
| 340-01-T1 | 340-01 | 1 | CANON-10 | T-340-01, T-340-02 | Every figure/citation waves A/B/C will use is re-verified live and dated in `340-LIVE-VERIFICATION.md` BEFORE any wave drafts prose; zero canon bytes touched | auto | `test -f 340-LIVE-VERIFICATION.md && grep -q "ALLOWED_EDGE_TYPES" ... && grep -q "SOURCED_FROM" ... && grep -q "docu-optimizer" ... && grep -q "test-canon-part-9-ratification" ...` | ❌ not on disk (340-01 not executed) | ⬜ pending |
| 340-01-T2 | 340-01 | 1 | CANON-10 | T-340-01 | `tests/run-all-340.sh` exists, is executable, exits 0 with 4 PASS / 3 SKIP / 0 FAIL before any amendment lands | auto | `chmod +x tests/run-all-340.sh && bash tests/run-all-340.sh; test $? -eq 0 && test "$(... grep -c 'SKIPPED (file not present')" -eq 3 && test "$(... grep -c ': PASSED')" -eq 4` | ❌ not on disk | ⬜ pending |
| 340-02-T1 | 340-02 | 2 | CANON-01 | T-340-04 | Zero canon/persona bytes land before the navigator's literal APPROVE on the exact drafted prose (Part 12 subsection + persona mirror + entry 38) | checkpoint:human-verify (gate=blocking-human) + automated pre-check | `test -f 340-02-DRAFT-PROSE.md && grep -q "sourced or absent" ... && grep -q "A hedge word is not a source." ... && test "$(git diff --name-only docs/MINDRIAN-CANON.md agents/larry-extended.md \| wc -l)" -eq 0` | ❌ not on disk | ⬜ pending |
| 340-02-T2 | 340-02 | 2 | CANON-01 | T-340-05, T-340-06 | Part 12 Sourced Claims Doctrine + `agents/larry-extended.md` mirror + Appendix D entry 38 land atomically as canon v1.25 in ONE commit; frozen scalars and entries 1-37 unweakened | auto | `node tests/test-canon-frozen-scalars-floor.cjs && node tests/test-canon-entry-31-two-gauge-floor.cjs && node tests/test-canon-entry-36-shape-declaration-floor.cjs && node tests/test-195-canon-7-kind-floor.cjs && grep -c "^Version: 1.25$" ... && grep -c "A hedge word is not a source." docs/MINDRIAN-CANON.md ... && grep -c ... agents/larry-extended.md` | ❌ not on disk | ⬜ pending |
| 340-02-T3 | 340-02 | 2 | CANON-01 | T-340-07 | Entry-38 floor test provably red when the doctrine/mirror is removed and green when restored; aggregator leg flips SKIPPED to PASSED | auto | `node tests/test-canon-entry-38-sourced-claims-floor.cjs && bash tests/run-all-340.sh && test "...SKIPPED..." -eq 2 && test "...: PASSED" -eq 5` | ❌ not on disk | ⬜ pending |
| 340-03-T1 | 340-03 | 3 | CANON-02, CANON-03, CANON-04 | T-340-09 | Zero canon bytes land before the navigator's literal APPROVE on the three-Part draft (Part 9 chokepoint split, Part 4 edge reconciliation, Appendix B citations, entry 39) | checkpoint:human-verify (gate=blocking-human) + automated pre-check | `test -f 340-03-DRAFT-PROSE.md && grep -q "two constitutional chokepoints" ... && grep -q "lib/core/node-insert.cjs" ... && grep -q "lib/core/room-skeleton-scaffold.cjs" ... && test "$(git diff --name-only docs/MINDRIAN-CANON.md \| wc -l)" -eq 0` | ❌ not on disk | ⬜ pending |
| 340-03-T2 | 340-03 | 3 | CANON-02, CANON-03, CANON-04 | T-340-10, T-340-11, T-340-13 | Part 9 two-chokepoint split + Part 4 edge-vocabulary reconciliation + Appendix B ICM citations + Appendix D entry 39 land atomically as canon v1.26 in ONE commit; `lib/` untouched (citation only) | auto | `node tests/test-canon-frozen-scalars-floor.cjs && node tests/test-canon-entry-31-two-gauge-floor.cjs && node tests/test-canon-entry-36-shape-declaration-floor.cjs && node tests/test-195-canon-7-kind-floor.cjs && node tests/test-canon-entry-38-sourced-claims-floor.cjs && grep -c "^Version: 1.26$" ... && grep -q "lib/core/node-insert.cjs" ... && grep -q "lib/core/room-skeleton-scaffold.cjs" ...` | ❌ not on disk | ⬜ pending |
| 340-03-T3 | 340-03 | 3 | CANON-02, CANON-03, CANON-04 | T-340-14 | Entry-39 multi-Part placement-proof floor test provably red per amended Part (Part 9 / Part 4 / Appendix B each independently); aggregator leg flips | auto | `node tests/test-canon-entry-39-graph-substrate-floor.cjs && bash tests/run-all-340.sh && test "...SKIPPED..." -eq 1 && test "...: PASSED" -eq 6` | ❌ not on disk | ⬜ pending |
| 340-04-T1 | 340-04 | 4 | CANON-05, CANON-06, CANON-07, CANON-08, CANON-09 | T-340-15 | Zero canon/CLAUDE.md bytes land before the navigator's literal APPROVE plus all three named rulings (BOTS/COMMANDS/REPHRASE; REMOVE ROW/RESTORE SKILL/LEAVE AND FLAG; corpus-figure choice) | checkpoint:human-verify (gate=blocking-human) + automated pre-check | `test -f 340-04-DRAFT-PROSE.md && grep -q "theo-mcp.onrender.com" ... && grep -q "multilingual-e5-large" ... && grep -q "docu-optimizer" ... && test "$(git diff --name-only docs/MINDRIAN-CANON.md CLAUDE.md \| wc -l)" -eq 0` | ❌ not on disk | ⬜ pending |
| 340-04-T2 | 340-04 | 4 | CANON-05, CANON-06, CANON-07, CANON-08, CANON-09 | T-340-16, T-340-17, T-340-19 | Appendix C / Part 2 / Part 7 / Part 11 corrections + Appendix D entry 40 + CLAUDE.md siblings land atomically as canon v1.27 in ONE commit; historical entries 11/13/16/36 and Part 11's self-disclaiming doctrine sentences untouched | auto | `node tests/test-canon-frozen-scalars-floor.cjs && node tests/test-canon-entry-31-two-gauge-floor.cjs && node tests/test-canon-entry-36-shape-declaration-floor.cjs && node tests/test-canon-entry-38-sourced-claims-floor.cjs && node tests/test-canon-entry-39-graph-substrate-floor.cjs && node tests/test-195-canon-7-kind-floor.cjs && grep -c "^Version: 1.27$" ... && test "$(grep -c '25 methodology commands' docs/MINDRIAN-CANON.md CLAUDE.md \| grep -c ':0$')" -eq 2` | ❌ not on disk | ⬜ pending |
| 340-04-T3 | 340-04 | 4 | CANON-05, CANON-06, CANON-07, CANON-08, CANON-09 | T-340-18 | Entry-40 slice-scoped presence/absence floor test proves retired names gone from live Parts AND still present in Appendix D history; CLAUDE.md same-commit lockstep asserted; last aggregator leg flips (7 PASS / 0 SKIP / 0 FAIL) | auto | `node tests/test-canon-entry-40-corpus-figures-floor.cjs && bash tests/run-all-340.sh && test "...SKIPPED..." -eq 0 && test "...: PASSED" -eq 7 && test "...: FAILED" -eq 0` | ❌ not on disk | ⬜ pending |
| 340-05-T1 | 340-05 | 5 | CANON-10 | T-340-21, T-340-22 | Post-amendment sweep re-verifies every figure and citation LIVE, after all three waves landed, against the codebase; residual gaps (if any) named openly, never absorbed | auto | `bash tests/run-all-340.sh && test -f 340-CLOSE-OUT-SWEEP.md && grep -q "run-all-340" ... && grep -q "Residual gaps" ... && test "...: FAILED" -eq 0 && test "...SKIPPED..." -eq 0` | ❌ not on disk | ⬜ pending |
| 340-05-T2 | 340-05 | 5 | CANON-10 | T-340-23, T-340-24 | CANON-01 through CANON-10 registered in `.planning/REQUIREMENTS.md` with per-ID evidence; Dev-Research Compositing trail filed in both `rethinking-mindrianos` and `MindrianOS` research homes, cross-linked to the phase slug | auto | `grep -c "CANON-01" .planning/REQUIREMENTS.md \| grep -qv "^0$" && grep -c "CANON-10" ... && ls -d ~/MindrianRooms/rethinking-mindrianos/research/*canon-currency-audit-340* && ls -d ~/MindrianOS/research/*canon-currency-audit-340* && grep -rq "340-canon-currency-audit..." ... && test "$(git status --porcelain docs/ CLAUDE.md agents/ tests/ lib/ \| wc -l)" -eq 0` | ❌ not on disk | ⬜ pending |
| ALL | ALL | ALL | N/A | T-340-06, T-340-11, T-340-17 | `tests/test-canon-frozen-scalars-floor.cjs` stays green across every wave (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 never move) | regression | `node tests/test-canon-frozen-scalars-floor.cjs` | ✅ exists today | ⬜ pending (re-run per wave) |
| ALL | ALL | ALL | T-340-05, T-340-10 | N/A | Appendix D entries 1-37 (then 1-38, then 1-39) preserved byte-identical through every subsequent wave | regression | `tests/test-canon-entry-31-two-gauge-floor.cjs`, `tests/test-canon-entry-36-shape-declaration-floor.cjs`, `tests/test-195-canon-7-kind-floor.cjs` (version anchors bumped each wave) | ✅ existing, version-anchor bump is new work per wave | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs above (`340-0N-T#`) are this VALIDATION.md's own labels for the plans' "Task 1/2/3"
headings, matching each plan's real wave number, `depends_on`, and `requirements:` frontmatter
exactly. There are only 3 new floor-test files this phase creates (entries 38, 39, 40), not the
8-entry provisional numbering RESEARCH.md's draft carried before planning.*

---

## Wave 0 Requirements

Wave 0 is plan **340-01** (wave: 1, `depends_on: []`, fully autonomous). It is currently PLANNED
only -- neither of its two tasks has executed. Both artifacts below are absent from disk as of this
writing:

- [ ] `tests/run-all-340.sh` -- does not exist yet; created by 340-01 Task 2, modeled byte-for-byte on `tests/run-all-190.sh`'s aggregator pattern (`run`/`run_if` helpers, PASS/FAIL/SKIP tally, `[ "$FAIL" -eq 0 ]` exit). Registers 3 `run_if` legs (entries 38/39/40, SKIP until each lands) and 4 `run` legs (frozen-scalars, entry-31, entry-36, 195 seven-kind, all confirmed passing today) -- deliberately excludes `test-canon-crossref-completeness.cjs` and `test-canon-part-9-ratification.cjs`, which are PRE-EXISTING RED on `main` and out of this phase's scope.
- [ ] `.planning/phases/340-.../340-LIVE-VERIFICATION.md` -- does not exist yet; created by 340-01 Task 1. Re-verifies live, on execution day, every number and citation waves A/B/C will write into the Canon (the 44-member `ALLOWED_EDGE_TYPES` set, the `SOURCED_FROM` runtime-writer question, `insertNode` call-site counts, the Brain origin, the four-glob surface counts, the `docu-optimizer` existence question, and the pre-existing-red baseline for the two out-of-scope canon tests).
- [ ] Framework install: none needed (bare Node.js built-ins, already present and confirmed working via prior-phase floor tests already on disk).

Because 340-01 has not executed, no Wave 0 work item above is actually done yet.

---

## Manual-Only Verifications

Three tasks in this phase are `type="checkpoint:human-verify" gate="blocking-human"` -- each also
carries an `<automated>` pre/post-check (draft file exists, required anchor strings present, and
`git diff --name-only` on the constitutional files is empty at halt time), but the actual approval
decision is irreducibly human: no automated command can substitute for the navigator reading the
exact prose and replying APPROVE / REJECT / APPROVE WITH EDITS.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Exact Part 12 subsection + persona mirror + Appendix D entry 38 prose (340-02 Task 1) | CANON-01 | Every one of the 37 prior amendments required navigator APPROVE at a blocking checkpoint on the literal text BEFORE any canon byte landed (340-RESEARCH.md Pitfall 4: "a plan that schedules a canon-file Edit call before a checkpoint:human-verify task in the same wave" is this phase's signature failure mode). No automated test can substitute for this sign-off. | Read `340-02-DRAFT-PROSE.md`; reply `APPROVE`, `REJECT: <reason>`, or `APPROVE WITH EDITS: <edits>`; the literal reply and date must land in `340-02-SUMMARY.md` before Task 2 may run. |
| Exact Part 9 two-chokepoint prose + Part 4 edge reconciliation + Appendix B citations + Appendix D entry 39 (340-03 Task 1) | CANON-02, CANON-03, CANON-04 | Same navigator-sign-off requirement, spanning three Parts at once; the draft also requires the navigator to pick the Appendix B citation form (new column vs. citation block). | Read `340-03-DRAFT-PROSE.md`; reply with verdict and the citation-form pick; recorded verbatim in `340-03-SUMMARY.md` before Task 2 may run. |
| Exact Appendix C / Part 2 / Part 7 / Part 11 corrections + CLAUDE.md siblings + Appendix D entry 40, PLUS three named judgment rulings (340-04 Task 1) | CANON-05, CANON-06, CANON-07, CANON-08, CANON-09 | Same sign-off requirement, plus three judgment calls the plan deliberately left to the navigator: Ruling A (BOTS/COMMANDS/REPHRASE for the "25" ambiguity), Ruling B (docu-optimizer row: REMOVE ROW/RESTORE SKILL/LEAVE AND FLAG), Ruling C (whether to carry the stale Pinecone corpus-size figure forward with a caveat or omit it). | Read `340-04-DRAFT-PROSE.md`; reply with the verdict AND all three rulings (e.g. `APPROVE. BOTS. REMOVE ROW. Omit the corpus size.`); recorded verbatim with date in `340-04-SUMMARY.md` before Task 2 may run. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a legitimate manual checkpoint with a recorded human verdict requirement -- verified against all 13 tasks across 340-01 through 340-05 above; every task, including the three blocking checkpoints, carries its own `<automated>` command.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify -- all 13 tasks carry one.
- [ ] Wave 0 covers all MISSING references (`tests/run-all-340.sh` + `340-LIVE-VERIFICATION.md`) -- covered BY PLAN, but not yet executed (see Wave 0 Requirements above).
- [x] No watch-mode flags.
- [x] Feedback latency < 15s.
- [x] `nyquist_compliant: true` set in frontmatter -- every task in every one of the 5 final plans genuinely has an `<automated>` verify command; the 3 checkpoint tasks are additionally gated on a human APPROVE/REJECT/APPROVE-WITH-EDITS reply, which is a legitimate manual checkpoint per 340-RESEARCH.md's own precedent (all 37 prior Appendix D entries required the identical sign-off) and is not a substitute for, but a supplement to, their own automated pre-checks.

**`wave_0_complete: false`** -- 340-01 (the Wave 0/scaffold plan) is PLANNED but has not executed: `tests/run-all-340.sh` and `340-LIVE-VERIFICATION.md` are both absent from disk as of this writing, and `docs/MINDRIAN-CANON.md` still reads `Version: 1.24`. This flag will flip to `true` only once 340-01's two tasks have actually run and their artifacts verifiably exist on disk.

**Approval:** pending
