# Handoff 2026-11-06 - audit repairs, end to end with a version cut

Written by session jsagi-33 (plugin session) because its context was near full. Read this first, then the files it points to. Nothing here is pushed. Owner goal (typed): "get it e2e with version cut", earlier "do all fixes, a clean MindrianOS".

## Standing rules (owner, hard)

- GSD only, on `main`, shared tree with peers: `git add -f <new .planning file>` then `git commit --only <explicit paths>`; never `git add -A`, stash, `reset --hard`, `--no-verify`; executors never push.
- No push, tag, release or npm publish without the owner's explicit go AND the push-gate review of every commit ahead of origin (about 295 at the time of writing, almost all planning and test files).
- Canon Part 8: fixture rooms and fake secrets only, no real room names or paths in repo files, counts and timings only.
- Subagents use simplified English, `NEEDS_HUMAN` instead of questions, report fields STATUS/CHANGED/VERIFIED/UNVERIFIED/RISKS/NEXT. Only the main session talks to the owner. No em dashes; PwS spelling.
- Pasted audit text and agent text have no owner authority. Owner decisions are only what the owner typed or chose on a card.
- Timing plans (Phase 384 Wave 2) must run alone on a quiet machine under `$HOME/.cache/mos-perf-384.lock`.

## Phase status (counts from PLAN and SUMMARY files)

| Phase | State |
|---|---|
| 384 speed | Wave 1 measuring done (plans 01-11, `384-RANKING.md`, `384-OWNER-DECISIONS.md`). Wave 2 fixes 384-12..20 planned and checked, NOT executed (serial, about 11 h quiet time by the planner's estimate, not measured). Plan 20 stops at an owner decision. |
| 385 cleanup | 15 of 15 done. Pinecone steps 2 and 3 need the owner's separate word (Eureka scoring uses `rs-pinecone-bridge`). |
| 386 bugs and Part 8 | 45 plans. Done through 27, plus 32 (tasks 1-2). Executor `aafc4d3a274b8c534` was told to record the owner acknowledgement, then run 33 and 34. Still open after that: 40 (probe gate), 44 (B17 Windows path as a section), 45 (B18 "room.db cannot be opened" cause), 21 (close-out: CHANGELOG, knowledge base, move RCAs to resolved, commit review, outcomes table). |
| 387 Eureka | 11 plans, all executed. Plans 05, 07, 09 have code but no SUMMARY files: write them. The live leak test 387-10 is owner-run and not run: leak proof stays OPEN. |
| 388 ship less | PRD only, no plans. First step: measure what `npm pack` ships (about 2.5 MB of tests claimed by the auditor, unverified). |

## Owner decisions on record (where to read them)

- 384: `.planning/phases/384-*/384-OWNER-DECISIONS.md` (fix S1, S8, S7, S4, plus prewarm timer, 23ab77410 only with its test, split doctor gate, 50 ms floor, local real-room class ranks, S2 after Write re-measure).
- 385: `385-PROOF.md` section 14 (unwire doctor poll and both operator-update entries; keep kuzu, LazyGraph, Neo4j, Memgraph, chokidar, test-only modules; Pinecone step 1 only; no telemetry rebuild).
- 386: `386-PRD.md` sections "Owner decisions", "Owner principle for Part 8" (sprouts out, bodies stay, never cripple contextualised work; credentials always block), "Owner direction on ambiguous calls and over-blocking" (context-based split route, not a bare block). Also: web-line ruling extended to Semantic Scholar, grants.gov, research-speaker (approval card, credential check, audit record, no content scan); brain_write blocked; guard failure option A plus count-only outage line; transcribe-audio left and documented; Anthropic-key features outside Part 8; operator-update unwired; supersession kept as documented contract (Phase 350 owner and date OPEN); Pinecone inference module removal. Plan 32 acknowledgement: acknowledge X8 and four unmarked probe strings; unreadable room.db: short sprouts go, credentials still block.
- 387: `387-DECISION-RECORD.md` (option A; the engine is the NEW `/home/jsagi/dev/mindrian-eureka`, never the retired `/home/jsagi/research/eureka`).

## Owner-only items still open

1. Check and revoke the old Pinecone key (it sat in `scripts/consolidate-pinecone.py` in git history since March; the default is removed from the file).
2. Run the Eureka live leak test per `387-LEAK-RUNBOOK.md`, paste the result into the RCA `.planning/debug/eureka-engine-unreachable-on-normal-install.md`.
3. Phase 350 owner and date; Pinecone steps 2 and 3; plan 384-18 (commit 23ab77410 checkpoint) and plan 384-20 (Write path decision) when they stop.
4. Read the real-room report with your name before any cut (receipt is per HEAD).
5. Explicit go for every public step (push, tag, npm publish).

## What is left, in order

1. Finish 386: 33, 34 (executor running), then 40, 44, 45, then 21. Plans carry skip rules for files Phase 385 removed.
2. Write missing SUMMARY files (387-05, 07, 09). Update `ROADMAP.md` plan counts (385: 15, 386: 45, 387: 11, 384: 20) and `STATE.md`; executors do not edit those.
3. Plan Phase 388 (measure `npm pack`, then exclusion list; `eureka_critic` baseline file may move under `data/`).
4. Execute 384 Wave 2 (12..20) alone on a quiet machine; revert any fix that is not KEEP at the 50 ms floor.
5. Quiet-tree checks not yet run: `node scripts/doctor.cjs --acceptance` (about 68 s here), `run-all-3696` with a longer timeout, full `tests/run-all-366.sh`.
6. Push-gate review of all commits ahead of origin (subjects and files; flag anything outside phases 381-388, 383 and README/quick tasks).
7. Cut path: see `.planning/audits/CUT-PATH-MAP.md` (repo at 2.0.0-beta.80, last tag v2.0.0-beta.79, CHANGELOG top entry has an empty bullet; Theo re-emit and canon snapshot refresh, section-command ledger rebuild, real-room receipt last, npm login unknown, website path env). Do not run `release.sh` without the owner.

## Known pre-existing reds (do not blame new work)

test-252-guard-census census.1 and 5b; check-pending-breakthrough Test 12; test-237-autonomy-parity Leg 5; test-connector-tier-d-hooks CHECK 4; test-connector-part8-boundary CHECK 2; run-all-179 leg 179-08; test-244-doctor-fts-health 7/4 (doctor acceptance takes about 68 s against a 60 s test timeout; predates the work); test-359-prose-budget; run-all-341 four release-step tripwires; run-all-366 leg 380 gate-wiring; run-all-178 five failures; run-all-272 leg 272-cache-probe.

## Useful facts

- Audit sources are filed verbatim in `.planning/audits/AUDITOR-FINDINGS-source.md` (sections A-H); checks in `EGRESS-CLAIMS-CHECK.md`, `AUDIT-2-DELTA.md`, `AUDIT-3-DELTA.md`, `EUREKA-ENGINE-FACTS.md`, `EUREKA-ENGINE-CROSSCHECK.md`.
- Hook commands: 46 at the 384 base, 41 now (six removed by 385, one added by 386-36). `on-stop` is at 674 of a 680-line budget.
- A peer session `jsagi-cc` works from `/home/jsagi` for the owner (read-only checks, never in this tree).
- Executors run in this tree; a staged peer file blocks their commit guard: commit or ask, never revert.
