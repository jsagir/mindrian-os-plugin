# Handoff 2026-10-05 (evening): continue the critical-path goal after compaction

Written by the orchestrator session at HEAD e1e52c469 (branch main, tree clean, 69 commits ahead of origin since the beta.59 push; they push with the beta.61 cut). Read this, then the files it points at, in order. Everything here was measured today; treat anything older as history.

## The goal line to re-paste (the order changed tonight: 369.3a before 369.2 waves 2-4)

```
/goal Continue the critical path in .planning/CRITICAL-PATH-2026-10-05-any-user-mac-win.md through GSD in this order: close Phase 369.2 wave 1 (plan 12's checkpoint: the navigator's --read-by on the final sha, then scripts/release.sh --prerelease with the four audited flags, cutting v2.0.0-beta.61; add the ICM walk CHANGELOG line and the quick rows to STATE.md at the close; hand over the Lawrence mail); then plan and execute Phase 369.3a (FeyMinto and Room Identity) from its brief, design v2, ICM audit and amendments, cutting beta.63 behind the real-room rule; then execute 369.2 waves 2-4 (plans 13-34, already written) with a cut; then 369.3b, 369.4, 369.5, 369.6 in order, one cut each; stop at every Decision Gate and report with measured numbers only.
```

## Where everything is

| What | Where | State |
|---|---|---|
| Phase 0 status table | `.planning/phases/369.2-research-searches-online-for-real/369.2-PHASE0-STATUS.md` + `fixtures/phase0/` | done (68 ids: 54 reproduced, 14 need evidence) |
| beta.59 | tag v2.0.0-beta.59 (d7a32b978), npm latest, marketplace b96e974 | CUT and live; receipt c7e561142; note to Lawrence at `~/Downloads/lawrence-beta59-fixes.{html,txt}` (not sent) |
| 369.2 plans | `369.2-01..34-PLAN.md`; SUMMARYs for 01-11; CONTEXT, RESEARCH, VALIDATION, the four briefs | wave 1 = plans 01-12; 01-11 complete; plan 12 (the close) was executing at handoff time (its automated tasks; it returns a CHECKPOINT, never cuts) |
| 369.2 wave 1 bar | `tests/test-3692-w1-closure.cjs`, `bash tests/run-all-3692.sh` | 50/1 at plan 10 time: the one red is the W1 bar that goes green with the beta.61 real-room run; plan 11 saw C1/C4 red for a named person missing from composed strings; plan 12 settles it by measurement |
| The ICM walk tool | `lib/core/doctor/icm-walk-module.cjs`, `node scripts/doctor.cjs --icm-walk [--room <dir>] [--json]`, `tests/test-vi3-icm-walk.cjs` (21/21) | landed (quick 261005-vi3: d30eb4592, 0dd6e5037, 367f583d4, 8c651261b, 68ada9bf7, e1e52c469); CHANGELOG line and STATE row still to add at the beta.61 close |
| The brief and its trail | `.planning/briefs/2026-10-05-prove-one-authority/`: BRIEF.md (verbatim), README.md (rulings: room identity in room.db), FEYMINTO-CROSS.md, FEYMINTO-DESIGN-v2.md (the navigator's refinement, binding), FEYMINTO-ICM-AUDIT.md, AMENDMENTS-RECONCILIATION-2026-10-05.md (Lawrence's six amendments re-measured; AN-01; theo-mcp stays default) | filed; sources S1-S4 of the brief are still owed by the navigator (paths or pastes) |
| Seeds tonight | SEED-122 (FeyMinto), SEED-123 (persona stays, turn gating dies; proposed) | filed |
| ROADMAP | Phase 369.3a inserted before 369.3 with the amendments; 369.2 card lists 34 plans with [x] for 01-11 | hand-edited by the orchestrator only |
| STATE.md | `last_activity` line + Quick Tasks Completed rows for kvv, l8g, l9o, l8h, mux, muy | rows for vi3 still to add |
| Release receipts | `~/.mindrian/release-real-room/<sha>.json` | the gate is sha-bound: a new commit needs a new `--read-by` run |

## Rulings in force (navigator, 2026-10-05, verbatim sources in the files above)

1. The approval card is named by its job ("See every search before it leaves, then approve this run once."); the word "grant" never reaches a user; code identifiers stay (369.2-CONTEXT.md, ruling_2026_10_05_grant_name).
2. The room identity lives in `room.db` (Room node + identity rows) for every room; `ROOM.md` and the registry are projections (brief README).
3. FeyMinto is the name of the per-folder reasoning layer; it is keyed to that identity (FEYNMINTO-07), asks Theo per nest with Part 8 handles only, and renders the ten-block brief as a generated projection (SEED-122, design v2, ICM audit).
4. Phase 369.3a (FeyMinto and Room Identity) comes right after beta.61, before 369.2 waves 2-4; 369.2 proceeds in parallel on disjoint files and is not gated on it.
5. A room carries all 11 core sections (`CORE_SECTIONS`); the walk tool reports them (row I0); the live egain room has 5 of 11 and the navigator has not yet said "heal it".
6. theo-mcp stays the plugin's default origin; theo-context is an experiment, not yet a replacement; zero plugin callers is by design.
7. Lawrence's doctrine ruling (persona stays, turn gating dies; lines 19/32/34/38 inbound; line 9 off the Theo contract; canon-echo parity test) is PROPOSED (SEED-123) until the navigator confirms it at a gate; the turn-staging prose deletion timing (beta.61 or 369.6) is a question for the plan 12 checkpoint card.
8. Beta.61 scope: wave 1 + the ICM walk tool, nothing from waves 2-4.

## First moves for the new session

1. `git -C /home/jsagi/dev/MindrianOS-Plugin status --short` must be clean; `git log --oneline -15` shows the 369.2-12 commits if plan 12 progressed. If a `369.2-12-SUMMARY.md` exists, plan 12 completed; otherwise read `369.2-12-PLAN.md` and the 369.2-12 commits and resume from its checkpoint task (never run release.sh or `--read-by` on the navigator's behalf; the checkpoint is his).
2. Add to `CHANGELOG.md` `## [Unreleased]` Added: "`/mos:doctor --icm-walk`: measures every nest of a room against the ten ICM invariants and the walk test (identity in room.db, edit-surface markers, one-home duplications, token budgets, the 11 core sections); writes nothing (quick 261005-vi3)". Add the STATE.md row for 261005-vi3 and for plan 12's close.
3. Fire the checkpoint gate (AskUserQuestion): the suite totals from plan 12, the W1 bar, the receipt run (`node scripts/real-room-run.cjs --read-by "Jonathan Sagir"` on the final sha, with `TAVILY_API_KEY` exported from `~/.claude.json`'s tavily entry), the cut command `bash scripts/release.sh --prerelease --no-theo-check --no-canon-snapshot-check --no-cut-listener --allow-ahead` (run detached with `setsid nohup`, log to the scratchpad, watch with a line-buffered Monitor; the dry run is `--dry-run --prerelease`), and the prose-deletion timing question (SEED-123).
4. After the cut: refresh `evals/icm/last-run.json` if the post-publish acceptance point icm-ruling-eval-fresh fails (run `node scripts/eval-icm-writers.cjs`, commit), run Steps 10-11 by hand if the ceremony aborted after publish (it did at beta.59), push, hand the Lawrence mail over (update the version to beta.61 in `~/Downloads/lawrence-beta59-fixes.html`).
5. Then `/gsd-plan-phase 369.3a` with CONTEXT written by the orchestrator from the brief README, FEYMINTO-DESIGN-v2 (binding), FEYMINTO-ICM-AUDIT (the four changes), AMENDMENTS-RECONCILIATION (the nine rows incl. AN-01, the ninth failure test, readback by a different reader, the Subject Audit test) and the walk baseline numbers; executors Sonnet, planner Opus per config.

## Rules for the new session (unchanged)

GSD owns dev work; orchestrator-authored quick plans are allowed. Commits: `git add <paths>` (`-f` under `.planning/`) then `git commit -m ... --only -- <paths>` (flags before `--`); never `git add .`/`-A`, `commit -a`, `stash`, `reset`, `checkout`, `switch`, `restore`, `--no-verify`. Parallel executors on the main tree are fine when files are disjoint; tell them a peer is live and never to revert unowned diffs. Never kill a `mindrian-mcp-server` you did not start; no `npm install` at the root. Hyphens only. Every number sourced or absent. Canon Part 8: no room content to Theo. Part 9: only a human confirms. A yes is a card, never prose. Executors never write under `~/MindrianRooms` or `~/.mindrian` outside `release-real-room`. Lawrence's reading standard for anything he reads. The auto-mode permission classifier may deny an executor's test edit as "Security Test Removal": the executor stops, the orchestrator takes it to the navigator's gate, and makes the edit itself under that approval.

## Open human items

Desktop Add-marketplace on Mac and Windows, then `node scripts/real-room-run.cjs --desktop-verified mac|win`; send the Lawrence note; the four source reports of the brief (S1-S4); the 2026-10-04 run ledgers (REV-01, 02, 04); "heal it" for the egain room's six missing core sections; the theo-context repo task (remove its line 9); the theo-context install location question (project, shipped config, Desktop) is still open.
