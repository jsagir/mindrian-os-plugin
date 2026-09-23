# Handoff: Phase 355 is planned - continue from here (2026-09-23)

Status: PLANNED, not executed. 28 plans in 11 waves, plan checker VERIFICATION PASSED, decision coverage 46/46, gap analysis clean. Written by session jsagi-d9 for the next session the navigator opens in `/home/jsagi/dev/MindrianOS-Plugin`.
Read first, in this order: this file; `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-CONTEXT.md` (D-01..D-58, locked); `355-SPEC.md`; `355-AI-SPEC.md`; then the plans. The room-side reasoning trail is in `~/MindrianRooms/rethinking-mindrianos/research/2026-09-23-*` (five entries plus the 13-tab briefing mirror), mirrored under `~/MindrianOS/research/`.

## What Phase 355 is

Every cross-domain finding MindrianOS shows a user (eureka, find-connections, find-bottlenecks, HSI, whitespace) carries a direction name defined once from the April 2025 origin deck and a verification stamp computed in code from Theo `find_connections` (strong / indirect / unverified; `backend` named; `judge: none` this phase); no score is ever shown; accepted findings file as proposed opportunities on the existing writer and surface once via SENS-13; the HSI thinking-mode regexes are measured against a dev-time Jev Choice with a fixed adoption bar; the first human-judged hit rate is recorded on three new fixture rooms. Rule: code finds, Jev judges the type, Theo proxies typed calls and interprets nothing, Larry composes, a human ratifies. Navigator ruling (in the AI-SPEC): Jev is the preferred algorithmic choice for every intelligence layer, inside Canon Part 8 and the 2026-09-17 keyholder ruling.

## Commits that make up the planning (all on main)

| Commit | What |
|---|---|
| 8d1cd2a58 | Phase 355 added to ROADMAP.md, STATE evolution line, 355-BRIEF.md, 355-ORIGIN-CONCEPT.md |
| 6be442ff4 | 355-SPEC.md (7 requirements, 13 acceptance checkboxes) + 355-INTENT.md |
| 1b4c711ae, df9a7633d | 355-AI-SPEC.md (framework: none; 18 eval dimensions incl. D18 Jev usefulness judge vs navigator gold) |
| abb8b9dbd | 355-CONTEXT.md (46 decisions) + 355-DISCUSSION-LOG.md |
| f9c386c63 | 355-RESEARCH.md (live Theo probe, corrections C1-C10) |
| 2b1959f49 | 355-VALIDATION.md scaffold |
| 30ca8fc2b | CONTEXT rulings D-47..D-58 + 355-PATTERNS.md |
| 6fcac8db9 | 355-01..28-PLAN.md + filled 355-VALIDATION.md (planner) |
| 5676497b1 | ROADMAP.md Phase 355 plan list (28 plans, 11 waves, checkpoints marked) |
| 2853649d1 | docs/2026-09-23-HANDOFF-theo-phase-355-seams.md (the five Theo asks) |

## Exact next steps, in order

1. **Wait for Phase 354 to close.** Session jsagi-25 is executing it in this same working tree (13/18 at last report, wave 6 of 8) and will ping when 354-16 lands. `355-01` Task 1 refuses to run while any 354-NN plan is unchecked in ROADMAP.md or while `gate.cjs`, `tool-router.cjs`, `brain-client.cjs`, `part8-egress-guard.cjs`, `doctor.cjs` or `scripts/jev-devtime-client.cjs` carry an uncommitted diff you did not make. Do not bypass that gate.
2. **Then record the planned state** (deliberately deferred to avoid clobbering the peer's STATE.md writes): `node ~/.claude/gsd-core/bin/gsd-tools.cjs query state.planned-phase --phase 355 --name "hidden-in-plain-sight-jev-through-theo-cross-connection-engi" --plans 28`, then `git commit --only .planning/STATE.md`.
3. **Then** `/clear` and `/gsd-execute-phase 355`.
4. **Six human checkpoints** need the navigator during execution: 02 (the PWS author confirms the two direction phrases), 03 (blind sentence gold via `scripts/label-355-gold.cjs`), 14 (citation gold), 15 (HSI adoption sign-off against the fixed bar: +10 points on the full set with `none` counted, no mode drops more than 5, holds on 3 runs), 24 and 25 (the two blind judging sittings; the hit rate is recorded, never promised).

## Collision rules for this tree (learned the hard way; do not skip)

- Run `ListAgents` and message peers before writing shared files; never revert or stage a diff you did not make; commit with `--only` your paths; new files under `.planning/phases/**` need `git add -f`.
- No `gsd-tools` `state.*` write while a peer is executing a phase in this tree.
- Peers at handoff time: jsagi-25 (Phase 354, executing), jsagi-a7 (Phase 356, chain-executor Jev-seat policy), jsagi-e0 (Phase 357, gate-triad ledger), jsagi-c2 (Phase 358 + export hotfix), jsagi-ec (Theo T-side session; also plugin Phase 361 context). Phases 359 and 360 were also planned by others today. Re-run `ListAgents` rather than trusting this list.
- `roadmap.annotate-dependencies 355` is idempotent and already applied; re-read ROADMAP.md from disk before any edit to it.

## Theo threads (cross-repo; nothing here is applied from this repo)

- T-1 shipped in Theo code (1023bd1): `find_connections` carries `backend: 'theo-canon'` on both arms once Theo Phase 20 deploys (human-held plan 20-09). Until then the plugin sets `backend` itself (CONTEXT D-11); after the deploy, 355's stamp adapter should prefer the response field and drop the backfill (record as a 355 follow-up task at execution time if 20-09 has landed).
- T-2 (per-user Jev through Theo) is BLOCKED on the navigator approving the rule-1 amendment text ("proxied typed judgment under a stated policy is a third class; Theo as keyholder, never as judge") directly in the Theo session (Theo SEED-015). A relayed card choice is not an authorization there. Phase 355 ships `judge: none` regardless.
- T-3 -> Theo SEED-009 / Phase 20.1 (the cross-domain node types are ABSENT from canon, not 0-edge); T-4 -> OQ-4 seed; T-5 in Phase 20; T-6 closed (already byte-identical).
- The post-Theo-20 M-side work list (seven Part 8 known-shape entries, routing swap, new response fields, `operate_framework` composer, rung casing) is at `docs/2026-09-23-HANDOFF-theo-phase-20-and-phase-361-m-side-work.md`; it is a separate M-side phase to mint after 354 closes and 20-09 deploys, not part of 355.
- Pre-deploy decisions D-14 (outer per-address rate ceiling) and D-15 (`plugin_only_tools` frozen list) were confirmed M-side by jsagi-d9 with one recorded consequence: 355's fixture sittings can brush the 120-per-60 s per-install bucket, so the adapter treats 429 as `rate_limited` and the measurement script throttles.

## Peer contract from Phase 356 (jsagi-a7, received after planning closed, 2026-09-23)

Source of record: `.planning/phases/356-*/356-13-SUMMARY.md` "## Peer messages". Checked against all 28 plans by jsagi-d9 before execution; the executor honors this section without re-planning.

- Already honored by the plans: 355-07 adds its own three profiles (`hsi_thinking_mode`, `citation_check`, `usefulness_judge`) to `EGRESS_PROFILES` in `scripts/jev-devtime-client.cjs` and never merges into an existing one (356 D-08, 355 D-55); 355-15 and 355-26 call `jev()` only through `makeEgressGuard` composed with a closure. Client facts to rely on: exports are `DEFAULT_ENDPOINT, loadKey, makeEgressGuard, jev, pool, EGRESS_PROFILES`; every guard violation throws `err.code === 'EGRESS_REFUSED'` with `err.profile` and `err.key`; `jev()` refuses without a `guard` and resolves `fetchImpl` at call time.
- GAP, close at execution time (no plan carries it): `HOOKS_BANNED_LEDGER_SCRIPTS` in `tests/test-353-tripwires.cjs` (leg 2) is an append-only list, one entry per dev-time Jev script, so hooks/ can never reference one. Each of 355-07, 355-15 and 355-26 appends its own script names in the same commit that creates the script: `jev-question-ceilings`, `jev-response-schema` (07), `measure-hsi-thinking-mode` (15), `calibrate-citation-check`, `judge-355-usefulness` (26), plus any other 355 script that requires the client. Never fold the list back into a hand-edited regex. `tests/test-353-tripwires.cjs` is clean; the unowned diffs sit on `test-353-grader-agreement.cjs` and `test-353-ledger-shape.cjs`, never stage those.
- Form difference, not a violation: 356 keeps policies as `data/jev-policies/<ledger>.json` (`{ policy_id, version, instructions, criteria: {true, false}, boundary_cases[] }`); 355 keeps its questions frozen in code (`scripts/jev-question-ceilings.cjs`, D-44, locked). Do not re-litigate.

## Deferred and open (do not re-litigate; see CONTEXT `<deferred>`)

Per-user Jev (SEED-015); canon coverage (SEED-009 / 20.1); OQ-4; discovery-pattern taxonomy, Bit-Flip-Spark, supervisor reconciliation, update velocity, Terminology Translation, Weak Signal, Temporal Convergence (later phases, one Jev question each on top of the stamp); the stage-driven trigger; the Part 9 writer cleanup (`lazygraph-ops` / `node-insert` in whitespace-to-graph, hsi-to-graph, rs-engine); the whitespace CJS port and the Burt structural-hole producer; the `whitespace_scan` migrate-on-open door; a compute-claim rule for `check-tool-honesty.cjs`; the F.1 brain-chip percent; `gate_answer` description drift between Theo and the plugin; the pre-existing ROADMAP interleave of Phase 267's tail.

## One-line goal for `/goal` (under the 4000-character cap)

Drive Phase 355 to CLOSED: wait for 354 to close, run the deferred `state.planned-phase --phase 355 --plans 28`, then `/gsd-execute-phase 355`, honoring the six human checkpoints and the collision rules above; done when 355-27's close-out lands (HIPS rows registered, `tests/run-all-355.sh` green, doctor acceptance unregressed, the rethinking-mindrianos entry filed, the Theo note sent).
