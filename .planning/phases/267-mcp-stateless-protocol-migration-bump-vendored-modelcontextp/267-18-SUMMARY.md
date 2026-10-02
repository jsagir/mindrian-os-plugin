---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 18
subsystem: close-out
tags: [close-out, tri-polar, requirements, seeds, dev-research-compositing, mcp-v2]

requires:
  - phase: 267-17
    provides: v1 SDK fully removed
provides:
  - "267-VERIFICATION-GATES.md: every baseline command re-measured on the final tree, plus a post-ruling re-measure"
  - "267-TRIPOLAR-PROBES.md: CLI post-migration (live, Claude Code 2.1.287), an automated Desktop-surrogate, and dated deferrals for human Desktop and Cowork"
  - "MCPV2-01..19 registered in REQUIREMENTS.md (16 closed on measured proof, 3 open with reasons)"
  - "Phase 267 row in CANON-PHASE-MAP.md, CHANGELOG Unreleased entries, ROADMAP closed 18/18"
  - "SEED-108..111 follow-up seeds"
  - "dual-home research trail (plugin-side fallback, mirror PENDING)"
affects: [SEED-108, SEED-109, SEED-110, SEED-111, Phase 366 baseline refresh]

key-files:
  created:
    - .planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/267-VERIFICATION-GATES.md
    - .planning/seeds/SEED-108-mcp-daemon-icm-native-identity-handle.md
    - .planning/seeds/SEED-109-mcp-tool-annotations-from-irreversibility-ledger.md
    - .planning/seeds/SEED-110-theo-v2-migration-keep-legacy-stateless.md
    - .planning/seeds/SEED-111-mcp-server-brain-disposition-and-stale-ajv-comments.md
    - /home/jsagi/MindrianOS/research/2026-10-02-mcp-sdk-v2-migration-closeout-267.md
  modified:
    - .planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/267-TRIPOLAR-PROBES.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - docs/CANON-PHASE-MAP.md
    - CHANGELOG.md

key-decisions:
  - "Navigator ruling (a): the CLI at rung (b) on the 2026-era host is accepted (Claude Code 2.1.287 opens stdio with server/discover)"
  - "Navigator ruling (b): the test-257 v1 before-versus-after legs are retired (quick 261002-by3 also fixed test-198 contract-schema and the test-270 stubs)"
  - "Navigator ruling (c): human Desktop smoke and the Cowork probe are deferred; the phase claims CLI plus an automated Desktop surrogate only"
  - "MCPV2-03 and MCPV2-08 left [ ] because their proving tests are red from peer drift (Phase 363-17, 366-16), not Phase 267; they flip after one combined baseline refresh"

requirements-completed: [MCPV2-01, MCPV2-02, MCPV2-04, MCPV2-05, MCPV2-06, MCPV2-07, MCPV2-09, MCPV2-10, MCPV2-11, MCPV2-12, MCPV2-14, MCPV2-15, MCPV2-16, MCPV2-17, MCPV2-18, MCPV2-19]
requirements-open: [MCPV2-03, MCPV2-08, MCPV2-13]

completed: 2026-10-02
---

# Phase 267 Plan 18: Close-out Summary

**Phase 267 is closed 18/18 with measured gates, 16 of 19 requirements registered `[x]` on green proving tests, three left open for stated reasons, and Desktop and Cowork honestly recorded as deferred rather than claimed.**

PLAN_BASE=ba67f66b578fd4b08f64f58c6969f1f3599a1093

## Commits

| Commit | What |
|--------|------|
| 487c1c7b0 | Task 1: 267-VERIFICATION-GATES.md and the CLI (post-migration) probe section |
| 5b1770072 | Desktop-surrogate wire smoke (automated, not the human probe) |
| 91fb5deb7 | Desktop and Cowork post-migration recorded as deferred (navigator ruling) |
| 00665258e | REQUIREMENTS.md: MCPV2-01..19 |
| d68408024 | CANON-PHASE-MAP.md: Phase 267 row |
| 29e40d141 | CHANGELOG.md Unreleased (no version bump) |
| dcf3ac07b | Four seeds, SEED-108..111 (`git add -f`) |
| b5db689fa | Research trail, in the `/home/jsagi` repository (`rethinking-mindrianos:` message, mirror PENDING) |
| 72f16523e | ROADMAP.md: plan checkboxes, 18/18, close line |
| 2cac849d4 | Gates doc: post-ruling re-measure and research-trail link |

All commits used `--only` with explicit paths. No push. `git diff` of bin, lib, scripts and package.json across this plan's commits is empty (no code change).

## Final gate table (full detail in 267-VERIFICATION-GATES.md)

| Gate | Baseline | Final | Delta |
|------|----------|-------|-------|
| `bash tests/run-all-267.sh` | n/a | PASS=29 FAIL=3 SKIP=1 (CIRS (c) 31 vs 32, zod4 (a)(b)(d), 354 concurrency K4) | same + peer drift; K4 is an ENV GAP (25/25 with a Playwright path) |
| run-all-198 | 13 pass / 3 fail | 14 pass / 2 fail after quick 261002-by3 (SPEC-2 now green) | fixed (one leg better) |
| run-all-234 | 8 / 3 fail | 9 / 2 fail | fixed (dist-bundle) |
| run-all-199, run-all-127, run-all-266 | 3/2, 12/4, 11/0 | same | same |
| test-257 egress Arm 2, shim Arm 4 | red | red, same arms | same (known) |
| test-257 strict-input-shapes | Arms B, F red | after the retirement ruling: only Arm B (flaky boot race) | back to baseline |
| payload ceiling | 1916 entries, 31,168,458 B | 1982 entries, 32,873,598 B, 0 findings | same (within ceiling) |
| shrinkwrap no-dev, dep-heal, 248/265/354/276 regression legs | PASS | PASS | same |
| connector-registry `--check` | n/a | OK | green |
| `doctor --acceptance` (real HOME) | 21/22 | 21/22, sole fail verify-release-clean-tree (peer files) | same |
| wire snapshot, local server | 44/9/10/3 | 45/9/10/3 (+`research_run`, peer) | same + peer |
| wire snapshot, brain shim | 6 tools | 6 tools | same |

Zero NEW RED rows after the rulings. Before them, the final measurement caught two reds hiding behind older reds, both caused by the migration (F-A test-257 before-legs, F-B test-198 contract-schema stub). Both are closed (see rulings).

## Rulings recorded (navigator, 2026-10-02)

- **(a) CLI rung (b) accepted for the 2026-era host (F-C).** Claude Code 2.1.287 opens stdio with `server/discover` and `subscriptions/listen` and never sends `initialize` (2.1.281, measured pre-migration, opened with `initialize` at 2025-11-25 and declared elicitation). The migrated servers answer the new era and a real model turn worked through both. A 2026-era connection carries no initialize-time capabilities, so the gate renders at rung (b), pinned by the dual-era test.
- **(b) test-257 v1 arms retired** (quick 261002-by3: 122766d8a, e4733065e, fc7c6c552). That quick also fixed F-B (test-198 contract-schema) and both test-270 stubs.
- **(c) Desktop (human) and Cowork deferred.** Backed by the pre-migration human Desktop probe (c5add6eb6) and an automated Desktop-surrogate (5b1770072). MCPV2-13 stays `[ ]`, naming Desktop (human) and Cowork.

## Desktop-surrogate findings (automated, NOT a human probe)

A v2 client copying Desktop's handshake (claude-ai 0.1.0, 2025-11-25, ui extension only, no elicitation, no session id) against the dev server over the WSL node: `room_bind` with no sessionId still returns `no_session_id`; `prompts/get status`, `bind-room`, `act` all OK (were -32603); `gate_render` reports renderer `askuserquestion` (rung b); the dashboard resource serves `text/html;profile=mcp-app` and `room_path` containment holds (relative slug refused, absolute path inside the rooms home works); state reads report the registry-active room, never the bound one. The Desktop session-binding defect is unchanged, as expected; it is not this phase's.

## Requirements (REQUIREMENTS.md, section "Phase 267")

- `[x]` MCPV2-01, 02, 04, 05, 06, 07, 09, 10, 11, 12, 14, 15, 16, 17, 18, 19, each with its proving test and plan.
- `[ ]` MCPV2-03 (zod4 contract test red on peer drift), MCPV2-08 (CIRS Check (c): baseline 31, tree 32 from Phase 363-17), MCPV2-13 (Desktop human and Cowork deferred).
- MCPV2-15 is `[x]` with a stated caveat: six of seven RCAs resolved; RCA 7 filed, pinned, deliberately open.

## Seeds

SEED-108 (ICM-native identity handle; leads with the plain impact statement and offers the transport-only fast-follow separately; cites the RCA 7 file; first step verifies assumption A9), SEED-109 (tool annotations from the irreversibility ledger, and why 267 deferred them), SEED-110 (Theo must keep `legacy: 'stateless'`; no action here), SEED-111 (`mcp-server-brain/` disposition, stale "via sdk" comments, the shutdown null-path guard).

## Dev-Research Compositing

The room write to `~/MindrianRooms/rethinking-mindrianos/research/` was refused by the write-scope-check hook (active room `egain-des-liquid-conductor`) and was not routed around. Filed instead at `/home/jsagi/MindrianOS/research/2026-10-02-mcp-sdk-v2-migration-closeout-267.md` with `mirror_status: PENDING` and committed (b5db689fa, precedent 55e077bef). Cross-linked from 267-VERIFICATION-GATES.md and noted in the research file's `mirror_followup`. The phase-side half is the gates doc, the probes doc and the seeds.

## Deviations from Plan

**1. [Plan acceptance not met as written] `run-all-267.sh` does not end FAIL=0.** The plan's own acceptance line expected FAIL=0. The three reds are the peer-drift baselines (CIRS (c), zod4) and the Playwright ENV GAP. Refreshing the baselines belongs after Phase 366 lands (owner: the 366 session); no Phase 267 commit changed a tool description or added a zod importer. Recorded in the gates doc and in REQUIREMENTS (03 and 08 stay `[ ]`).

**2. [Rule 3, hygiene] Real HOME used for two commands.** `doctor --acceptance` (install-state lives under the real HOME) and the live CLI probe (`claude -p` needs auth). Both used a throwaway `MINDRIAN_ROOMS_HOME`; the hermetic doctor result (16/22) is recorded as an ENV artifact. The concurrency K4 re-run used a hermetic HOME with `PLAYWRIGHT_BROWSERS_PATH` only.

**3. [Rule 4 trip, resolved by ruling] Task 1 STOP clause.** The final measurement found two masked phase-caused reds; per the plan they were reported rather than closed over. The navigator's rulings and quick 261002-by3 resolved them.

**4. [Scope] Added an automated Desktop-surrogate section** at the coordinator's request, clearly labelled as not satisfying MCPV2-13's human check.

**5. [Scope] STATE.md not written.** The rulings were already recorded by the coordinator (e6be122fd) and Task 3 requires no STATE edit.

## Carried forward (owners)

| Item | Owner |
|------|-------|
| CIRS (c) and zod4 baseline refresh (flips MCPV2-03 and MCPV2-08) | the Phase 366 session, after it lands (one commit, all three pins) |
| RCA 7 (`mcp-shim-preseeded-session-id-rejected`), fix pending a decision | navigator, via SEED-108 (fast-follow design (a) approvable alone) |
| `desktop-session-binding-fallback` (separate RCA; unchanged by 267) | its own RCA / SEED-108 |
| Human Desktop smoke and Cowork probe (MCPV2-13) | navigator, when a Cowork build of the dev tree exists |
| Stale "via sdk" comments (`brain-client.cjs:2358`), cve-db notes, mcp-dep-heal rationale prose, `tests/fixtures/363-pre-phase.json` | SEED-111; fixture to the Phase 363 owner |
| `[session-catchup] Failed to save on shutdown ... path ... null` with no room bound | SEED-111 section 3 |
| Mirror the research trail into `~/MindrianRooms/rethinking-mindrianos/research/` | next session in that room (`/mos:rooms switch rethinking-mindrianos`) |
| Other classified reds (run-all-198 Part 8 local-only and SPEC-5, run-all-199, run-all-127, run-all-234 two, test-257 Arms 2 and 4 and B, test-238/237/347/353, 354 framework-command-ledger T2 and four Playwright legs) | their own phases; none is a Phase 267 regression |

## Known Stubs

None.

## Threat Flags

None new. T-267-36 held (every `[x]` has a measured row; deferred surfaces stay `[ ]` with the reason), T-267-37 held (the hook refusal was filed at the documented fallback, never routed around), T-267-12 held (the trail and probe records carry protocol metadata and test outcomes only; no room content, no keys).

## Self-Check: PASSED

- Commits 487c1c7b0, 5b1770072, 91fb5deb7, 00665258e, d68408024, 29e40d141, dcf3ac07b, 72f16523e, 2cac849d4 present in the dev repo; b5db689fa present in the `/home/jsagi` repository.
- Four seed files exist with consecutive numbers 108 to 111; the research fallback file exists with `mirror_status: PENDING`.
- No em-dashes in any file this plan added.
