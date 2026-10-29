---
phase: 364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0
verified: 2026-10-28
status: human_needed
score: 21/23 requirements PASS, 2 HUMAN_NEEDED, 0 FAIL
verifier: gsd-verifier (goal-backward, independent re-run)
branch: feat/eureka-adapter-rebased (HEAD 2aa9cec49); phase code also in origin/main (364-14 commit 5df121329 is an ancestor)
---

# Phase 364 Verification: /mos:scientific-roadmap

Goal (ROADMAP): ship `/mos:scientific-roadmap`, a constraint-first command rooted in the room problem-type classification, entered from the researcher starting point or a hypothesis, with a systems pass before path enumeration, walking Theo `framework_step` content only, turning ranked bottlenecks into falsifiable hypotheses and handing them to `/mos:research` on the Phase 363 engine (no second engine).

Claim labels: PROVEN = I ran it or read it in this session. UNVERIFIED = I did not run it. ASSUMED = inferred.

## Verdict

The goal is achieved on the plugin side. Code, command, registry, MCP reach, CLI door, filing, handoff doc and CHANGELOG bullet exist, are substantive and are wired. I re-ran the phase aggregator myself. 60 legs pass, 3 pre-existing reds match their recorded signatures, 1 live-smoke leg is skipped by design, and 1 leg fails. That failure (`270 tool schema budget`) is drift from later work by another session, not from Phase 364. It makes SRM364-21 ("run-all-364 green") literally false today, so that row is HUMAN_NEEDED. The live Theo state (steps still need a recorded authored live capture) is the second HUMAN_NEEDED item.

## Commands run (all with sandboxed HOME and MINDRIAN_ROOMS_HOME in the scratchpad)

| Command | Result | Status |
|---------|--------|--------|
| `bash tests/run-all-364.sh` | `PASSED=60 FAILED=1 SKIPPED=1 KNOWN=3`, exit 1. FAILED = `270 tool schema budget`. SKIPPED = `364 live smoke` (opt-in). KNOWN = framework command ledger, section command ledger, connector part8 boundary (signatures matched) | PROVEN |
| `node tests/test-364-refusal-e2e.cjs` | PASS 52 FAIL 0 | PROVEN |
| `node tests/test-364-part8.cjs` | PASS 17 FAIL 0 | PROVEN |
| `node tests/test-364-compose-355.cjs` | PASS 21 FAIL 0 | PROVEN |
| `node tests/test-364-sr-door.cjs` | PASS 70 FAIL 0 | PROVEN |
| `node scripts/scientific-roadmap.cjs start --room <empty dir>` | `next: define_what`, `what.status: missing`, offers `/mos:analyze-needs`, `proposed_step: null`; room dir stayed empty | PROVEN |
| `ALL_TOOL_COMMANDS` length and uniqueness | 66 / 66 unique, includes `scientific-roadmap` | PROVEN |
| `data/command-registry.json` | `framework_index["Scientific Roadmapping"]` = [`/mos:scientific-roadmap`]; HDPS = [`/mos:research`, `/mos:scientific-roadmap`] (research stays first); curated FEEDS_INTO to `/mos:research` (0.7) and `/mos:find-analogies` (0.5) | PROVEN |
| `MOS_364_LIVE=1 node tests/test-364-live-smoke.cjs` | NOT RUN (live egress, opt-in; one prior navigator-approved run recorded in 364-ACCEPTANCE.md) | UNVERIFIED |
| run-all-363, run-all-366, `doctor --acceptance` | NOT re-run by me; I rely on 364-ACCEPTANCE.md for these | UNVERIFIED |

### The one failing leg: `270 tool schema budget`

- Output: `measured=75 after=50`, total bytes +41.51 percent. The baseline was last re-baselined by quick 261019-k22 (48 to 50 tools). PROVEN.
- Phase 364 added no MCP tool. It added one enum value to the `methodology` tool (`lib/mcp/tool-router.cjs` line 358). PROVEN by code read.
- The extra tools match later Eureka capability bridge commits on this branch (`1ebed69e3`, `a5b80187c`, `adab809ac`, `4e6c4512a`, `4a32b0937`). ASSUMED as the cause. I did not bisect the 75 tools.
- 364-ACCEPTANCE.md (2026-10-03) recorded `PASSED=61 FAILED=0` at phase close, so the leg passed then. PROVEN by the document, not re-measured.

## Requirement status (SRM364-01..23)

| ID | Status | Evidence |
|----|--------|----------|
| 01 Canon snapshot carries the name | PASS | `refresh-framework-names --check` leg passes in aggregate ("framework names --check", "364 canon snapshot"); Part 8 guard legs pass. PROVEN |
| 02 Command file, full frontmatter, gate body | PASS | `commands/scientific-roadmap.md` (196 lines) has kind, frameworks (2), hitl_stages (8), hitl_why, body_shape, serves_jtbd; "364 command contract" leg PASS. PROVEN |
| 03 Generators green under --check | PASS | command-registry, connector-registry, harness-manifest, orchestration-projection, render-coverage, skill-mirrors, help-coverage legs all PASS in my run. PROVEN |
| 04 Registry reciprocity | PASS | framework_index rows above; "364 registry gates" PASS. PROVEN |
| 05 Curated chains, recipe count 5 | PASS | chains above; registry-gates leg PASS. PROVEN |
| 06 Theo step reader | PASS | `sr-steps.cjs`: `REFUSAL_TEXT = 'Theo has not authored this step yet'`, `NON_RUNNABLE = {DEFINITION, ASIDE}`, only `callTool('framework_step', {framework: HANDLE})`, no sort. "364 sr steps" PASS. PROVEN |
| 07 All-NULL refusal end to end, authored walk | PASS | "364 refusal e2e" PASS 52/0 (CLI children and MCP parity, net_attempts 0). PROVEN with fixtures. Real Theo not re-queried (see HUMAN_NEEDED 2) |
| 08 Entry check, WHAT never improvised | PASS | CLI probe on an empty room routes `define_what`, offers analyze-needs, no step. "364 sr entry" PASS. PROVEN |
| 09 Entry resolver, read-only | PASS | `sr-entry.cjs` (540 lines) reads via `openRoomDbReadOnlyForCaller`; E-legs PASS incl. no-write and no_db cases. PROVEN |
| 10 Bound inputs | PASS | `bound` block present in the CLI result; sr-entry legs PASS. PROVEN |
| 11 not_scored maps to not_ready | PASS | `THEO_REFUSAL_TO_KIND = { not_scored: 'not_ready' }` in `lib/core/refusal-messaging.cjs`; "364 refusal not_scored" and "250 refusal shapes" PASS. PROVEN |
| 12 Systems pass before sr:5 and sr:6 | PASS | `sr-door.cjs` line 286 returns `systems_pass_required` for sr:5 and sr:6; D-legs PASS (70/0). PROVEN |
| 13 One engine, template doors | PASS | `question-templates.cjs` line 232: `doors: ['/mos:research', '/mos:scientific-roadmap']`; D-legs include the static scan for no second engine. PROVEN |
| 14 Stage B falsifiable hypotheses, ratchet | PASS | sr-door D-legs PASS. PROVEN by test; not hand-traced |
| 15 Filing only on approved F.8 selection | PASS | `sr-filing.cjs` (471 lines), `PLAN_REL = 'research-plan/PLAN.md'`, `HISTORY_REL`; "364 filing" PASS. PROVEN |
| 16 Part 8: only generic handles | PASS | "364 part8" PASS 17/0 (planted marker, guard classification, static scans); calls observed are `framework_step` and the WellDefined `recommend_chain`. PROVEN |
| 17 Tri-Polar MCP reach (65 to 66) | PASS | 66/66 unique; handler text names gate_render, gate_answer, research_run op plan and says filing stays in Claude Code (`tool-router.cjs` lines 658-670, 1448). "364 mcp" PASS. PROVEN |
| 18 Entry points | PASS | "364 entry points" PASS; `commands/ignite.md` and skill mirror carry the offer and the trigger phrase. PROVEN by test |
| 19 Rubric, "uncovered" never a fit verdict | PASS | `readCoverage` is membership-only (covered, uncovered, unavailable); never returns the chain. PROVEN by code read. A live "uncovered" answer was recorded once in 364-ACCEPTANCE.md (UNVERIFIED by me) |
| 20 Theo awareness doc and handoff row | PASS | `docs/2026-10-03-PHASE-364-THEO-NOTIFY.md` (87 lines) exists, `docs/OPEN-HANDOFFS.md` has 364 rows; "364 theo handoff" PASS. Close-out trail present and byte-identical in `~/MindrianRooms/rethinking-mindrianos/research/` and `~/MindrianOS/research/` (`cmp` equal). PROVEN. No `/home/jsagi/Theo` write check not re-done (ASSUMED from the T8 fence leg passing) |
| 21 Phase gate green | HUMAN_NEEDED | Aggregator is not green today (FAILED=1, `270 tool schema budget`, cause outside Phase 364). All 364 own legs pass. Decision needed: re-baseline test-270, or register the leg with `run_known_if`. |
| 22 Stamped eureka finding enters at step 6, stamp verbatim | PASS | `sr-entry.cjs` uses `fromNodeProps` and `formatStampLines`; "364 compose 355" PASS 21/0 incl. no-write, no-upgrade, `stamp_unreadable`. PROVEN |
| 23 Eureka handoff names the slug through the registry door | PASS | H-legs PASS; H4 confirms no eureka-lineage file hardcodes the slug. PROVEN. Residual on the MCP brain-router route is follow-on A1 (documented). |

## Must-have truths (plan frontmatter) sweep

Every `must_haves.truths` block in plans 01-14 maps to an SRM364 row above and to a passing leg, with these exceptions:
- Plan 13 truth 1 says CHANGELOG is touched only after jsagi-be is messaged first. SUMMARY 364-13 states the message was NOT sent because no agent named jsagi-be existed, Phase 369 had 47 of 47 summaries, and the navigator approved "proceed" on the gate card. The CHANGELOG bullet exists (CHANGELOG.md line 4, `dbd6565f7`). The truth is met by its own fallback rule ("Phase 369 landed"). PROVEN for the bullet, UNVERIFIED for the peer-message step.
- Plan 10 artifact path names `docs/2026-10-02-...`; the file is `docs/2026-10-03-...`. The plan states the date is the execution date. Not a gap.

## Anti-patterns

- Scan for `TBD`, `FIXME`, `XXX` in `sr-*.cjs`, `scripts/scientific-roadmap.cjs`, `commands/scientific-roadmap.md`, the notify doc and all `tests/*364*`: zero hits. PROVEN.
- The aggregator's "no em-dash or en-dash in phase 364 files" leg PASSES. PROVEN.
- No stub found. Each `sr-*.cjs` is 214-680 lines and exercised by tests that check behavior (refusal text, order, no-write, planted marker).

## Human verification required

1. **Decide how to treat `270 tool schema budget` in run-all-364.** Test: `node tests/test-270-tool-schema-budget.cjs`. Expected: either re-baselined to the real 75-tool surface by the Eureka bridge owner, or the leg moved to `run_known_if` in `tests/run-all-364.sh`. Why human: it changes a shared baseline owned by another phase.
2. **Authored live Theo walk.** Theo Phase 25 steps are reported authored (`sciroad::scientific-roadmapping::p01`..`p07`). The 364 fixtures were written from the Theo session's reported facts, not from a live capture (follow-on A6). Test: `MOS_364_LIVE=1 node tests/test-364-live-smoke.cjs`, then one authored walk on a fixture room, then record the payload as a fixture. Why human: live network call and a navigator approval for egress.

## Not live

The command is on `main` and in `origin/main` but not released. Release-time items (A3, A7, A15) stay with the release session. I did not run `scripts/release.sh`.

## Gaps

No FAILED requirement. No BLOCKER. One WARNING (SRM364-21 aggregator red from non-364 drift) and one WARNING (live authored state unverified).

## Resolution note (2026-10-28, navigator-approved quick)

The red leg `270 tool schema budget` was a drift from non-364 work, not a Phase 364 defect. The re-baseline of 2026-10-24 (quick 261024-uqs, commit 06b4de866, on origin/main) was cherry-picked onto this branch as 0415ae772. PROVEN: `node tests/test-270-tool-schema-budget.cjs` gives 5 passed, 0 failed. PROVEN: `bash tests/run-all-364.sh` gives PASSED=61 FAILED=0 SKIPPED=1 KNOWN=3 with the same numbers recorded. SRM364-21 (aggregator green apart from known reds) is now true. Still HUMAN_NEEDED: the live Theo walk (follow-on A6), which needs navigator approval and live egress.
