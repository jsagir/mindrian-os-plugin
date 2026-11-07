# Phase 390: Recalibrate or cut stale surfaces - Context

**Gathered:** 2026-11-07 by the planner from 390-PRD.md and 390-RESEARCH.md. No discuss-phase ran (config workflow.skip_discuss is true). Every decision below is an owner ruling already written in the PRD, in 385-PROOF section 14, or in the phase request. Nothing here is new policy.

**Phase dependency:** Phase 390 depends on Phase 389 (ROADMAP). Phase 389 is planned (14 plans, 389-01 to 389-14) and not executed; copy the state from 390-SCAN.md section 6, do not hard-code it. Wave 0 below is read-only analysis, new test scaffolding and owner cards. It changes no file that Phase 389 owns. Every later wave must re-check the state of Phase 389 before it touches a surface the MVA family uses.

<decisions>
## Implementation Decisions (locked)

- **D-01:** KEEP grade, deep-grade and grade-grant (owner ruling in the PRD). No card offers a cut of them.
- **D-02:** Eureka is never removed. The engine is /home/jsagi/dev/mindrian-eureka. The rs-* set (rs-experts, rs-explain, rs-fetch, rs-thesis) is FOLD-ONLY: a card may offer a fold into /mos:eureka as a design, never a cut.
- **D-03:** Pinecone. lib/core/pinecone-inference.cjs is gone (385-15). rs-pinecone-bridge.cjs only names the shared cosine function: rename later, never delete. Steps 2 and 3 of 385-PROOF section 14 need their own proof and the owner's separate word.
- **D-04:** 385-PROOF R9 and R10: "Keep everything and delete nothing" for test-only modules and other unwired items. A cut of any orphan module needs a new per-module ruling. Planned-but-unwired contracts (Canon Part 11) need an owner ruling, not deletion.
- **D-05:** transcribe-audio is left and documented (Phase 386 plan 41). It is not a card item.
- **D-06:** Step 1 is a keep / recalibrate / cut table. No surface is removed in step 1.
- **D-07:** Usage evidence (one machine, Claude Code only) chooses WHAT TO CHECK. It is never a reason to cut. Write "NOT OBSERVED in this corpus", never "never used".
- **D-08:** A cut needs a caller proof across CLI, Desktop, Cowork, hooks and tests. The 385 scan alone is not a caller proof: it counts comments and misses prose and registry callers.
- **D-09:** Do not remove the room-dashboard, room-wiki or room-graph MCP views without a Desktop check.
- **D-10:** One owner card per group of candidates. Failing test first. Part 11 regeneration after any removal. No push, tag or release. Commit with `git commit --only <explicit paths>` and `git add -f` for new .planning files. A peer session may hold uncommitted files in this tree (Phase 388 files on 2026-11-07): never sweep the index.
- **D-11:** /mos:radar is untouched in this phase. Phase 391 owns the radar fetch fix. lib/core/doctor/capability-ledger-module.cjs reads it.
- **D-12:** No MVA-family cut in this phase. Phase 389 owns mva-option, the mva-pipeline skill, the option router and the mva-detect hook.
- **D-13:** Theo shim exposure changes (PRD "Step 0") are out of scope. Run Step 0 only if the owner adds an exposure to this phase.

### Claude's Discretion

- The shape of the table, the plan breakdown, the wave order, which proof commands to run, and the grammar of the answer gate.

### Deferred Ideas (OUT OF SCOPE)

- Any removal, merge, rewire or rename of a product file (waits for an answered card).
- Pinecone steps 2 and 3 as deletions (the card only asks for permission to prove first).
- New Theo tool exposure; the Pinecone key revoke; who runs the radar fetch; the Phase 389 cards.
</decisions>

## Waves

**Wave 0 (planned 2026-11-07, plans 390-01 to 390-05):** verified table with the five corrections, the re-run 385 scan and a caller matrix, the removal-test template and tests/run-all-390.sh, the answer-gate tool, and 390-DECISION.md (owner cards, one OWNER-ANSWER gate per group G1 to G6). Plan 390-05 ends at a human checkpoint.

**Later waves (NOT planned yet; planned after the cards are answered):** one plan set per answered group, each in the shape of the Flow of one approved cut in 390-RESEARCH.md: caller proof re-run, failing tests/test-390-<group>-removed.cjs (copy of the template), the removal or edit, the generators (build-command-registry, build-skill-mirrors, build-dist-bundles, build-ui-shell, build-render-coverage, ledgers), the three Part 11 --check gates, the heavy trio (test-384-s7 golden, test-270 budget, test-387) for any router enum edit, then one `git commit --only`. The groups are:

- G1 orphan modules (OD-1, OD-2, OD-3, OD-14)
- G2 behaviour gaps (OD-4A, OD-4B)
- G3 skills (OD-5, OD-6)
- G4 agents (OD-7, OD-8A to OD-8F)
- G5 command groups (OD-9, OD-10, OD-11, OD-12, OD-15)
- G6 Pinecone files (OD-13)

A group answered KEEP-ALL gets no later plan. Registering tests/run-all-390.sh in tests/run-all-366.sh (the release gate suite) is deferred to the first later wave, because a peer session holds uncommitted edits in tests/run-all-366.sh on 2026-11-07.

## Canonical References

- .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-PRD.md
- .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-RESEARCH.md (row verdicts, flags, OD-1 to OD-14)
- .planning/audits/PHASE-390-KEEP-RECALIBRATE-CUT-TABLE.md (relayed hypotheses)
- .planning/phases/385-behaviour-preserving-cleanup-remove-what-does-nothing-audito/385-PROOF.md (sections 10, 11, 14)
- .planning/phases/385-behaviour-preserving-cleanup-remove-what-does-nothing-audito/385-no-caller-scan.cjs
- tests/test-385-deep-links-removed.cjs (removal test model), tests/run-all-387.sh (aggregator model)
- .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-DECISION.md and 388-03-PLAN.md (decision card and answer gate model)
- CLAUDE.md (Canon Parts 7, 8, 11; Tri-Polar rule)
</content>
