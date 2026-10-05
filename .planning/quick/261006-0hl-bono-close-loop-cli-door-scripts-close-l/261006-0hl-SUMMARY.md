---
phase: quick
plan: 261006-0hl
subsystem: close-the-loop spine, command surface door
tags: [bono, intel-pipeline, close-loop, cli, supersedes, synthetic-expert]
requires: [lib/core/close-loop-writer.cjs, lib/core/temporal/supersession.cjs, lib/core/expert-library.cjs, lib/core/navigation/synthetic-expert.cjs]
provides: [scripts/close-loop.cjs]
affects: [commands/bono.md, commands/intel-pipeline.md, skills/bono/SKILL.md, skills/intel-pipeline/SKILL.md, CHANGELOG.md]
key-files:
  created: [scripts/close-loop.cjs, tests/test-261006-0hl-close-loop-cli.cjs]
  modified: [commands/bono.md, commands/intel-pipeline.md, skills/bono/SKILL.md, skills/intel-pipeline/SKILL.md, CHANGELOG.md]
decisions:
  - "One script, four subcommands, composing shipped modules only; the writer, navigation chokepoints and expert-library are byte-unchanged"
  - "The one writeCloseLoop call runs inside navigation.withRoomTx and any failure rolls the close back"
  - "Supersede attributed through the writer's supersedeFn seam bound to navigation.resolveByUser(room); the door never confirms a node"
metrics:
  tasks: 3
  commits: 3
completed: 2026-10-06
---

# Quick 261006-0hl: the BONO close-loop CLI door Summary

`scripts/close-loop.cjs` is now the one shell door for the close-the-loop spine: `close`, `version-log`, `offer-experts`, `file-expert`, proved by a 13-arm test on a birthRoom fixture and named in both command docs.

## Commits

| Task | Sha | Files |
|------|-----|-------|
| 1 RED | 3068d9126 | tests/test-261006-0hl-close-loop-cli.cjs (489 lines) |
| 2 GREEN | b43eb26c5 | scripts/close-loop.cjs (378 lines) |
| 3 docs | 162aa0637 | commands/bono.md, commands/intel-pipeline.md, skills/bono/SKILL.md, skills/intel-pipeline/SKILL.md, CHANGELOG.md |

All three are ancestors of HEAD (`git merge-base --is-ancestor` checked for each).

## RED and GREEN

- RED (door absent): `test-261006-0hl-close-loop-cli: passed=0 failed=13`, exit 1.
- GREEN: `test-261006-0hl-close-loop-cli: passed=13 failed=0`, exit 0, no SKIP line (the symlink leg of arm R ran).
- `tests/test-223-close-loop.cjs`: passed=45 failed=0. `tests/test-223-supersedes-chain.cjs`: passed=21 failed=0.
- Every literal written at RED held at GREEN with no change: arm A deltas claim +4, conclusion +1, open_question +1, opportunity +1, nodes +7, edges +3, semantic +3, SUPERSEDES 0; arm B deltas conclusion +1, nodes +2 (the conclusion plus one status_superseded memory_event), edges +1, SUPERSEDES +1; arm B2 conclusion +1, nodes +1; arm E ranks 1.65, 1.40, 0.80, 0.35 (Black, White, Green, Red). No root-cause was needed.
- Arm B attribution measured: the status_superseded memory_event stores `confirmed_by` equal to `navigation.resolveByUser(room)`, which for the birthed fixture room is `founder` (USER.md canonical_role), not an agent identity.

## run-all-223 before and after

- BEFORE: `Phase 223: PASS=16 FAIL=3 SKIP=0`, exit 1. FAILED labels (6): `DESENSITIZE asymmetry`; `Req 5 doctor --acceptance (no-new-regression vs documented baseline)`; `Req 7 doctor --acceptance (no-new-regression vs documented baseline)`; `222-08 read-only rank + no-write MCP pulls (quick 260728-7kc)`; `no-regression: run-all-222.sh (reach-ranking phase gate)`; `no-regression: run-all-224.sh (graph-derivation phase gate)`.
- AFTER (after the door, the test, the doc edits and the regenerated mirrors): `Phase 223: PASS=16 FAIL=3 SKIP=0`, exit 1, the same 6 FAILED labels. A diff of every `>>> ` result line between the two logs is empty, so no leg differs.
- Caveat: the BEFORE run started on the untouched tree, but the RED test file and the new script landed on disk while it was still running (it took several minutes). The AFTER run is the clean one; the identical label sets say none of the legs read those files.
- DESENSITIZE is red in both runs, as contract finding 6 predicted; nothing here touches it.

## Gates

- `build-skill-mirrors --check`: OK, 113 mirrors, before and after regeneration. Regeneration overwrote exactly 2 mirrors (skills/bono, skills/intel-pipeline); no unowned mirror was touched or left unstaged. `skills/bono/SKILL.md` still carries `sensor_triggers: []`.
- `build-command-registry`, `build-connector-registry`, `build-orchestration-projection` `--check`: exit 0 before and exit 0 after.
- `node scripts/check-substrate.cjs --diff`: exit 0; the pre-commit hook passed on all three commits without `--no-verify`.
- Dash counts: 0 and 0 for commands/bono.md, commands/intel-pipeline.md and both mirrors; 107 and 1 for CHANGELOG.md (unchanged baseline).
- Source greps on scripts/close-loop.cjs: 1 `writeCloseLoop(` call on code lines, 0 matches for room-db.cjs, node:sqlite or better-sqlite3, 0 for confirmNode(, promoteNodeStatus(, fetch(, http, https, net, undici or brain-client on code lines.
- `node scripts/close-loop.cjs --help` exits 0; with no subcommand it exits 2.

## Exact invocations now documented

commands/bono.md (4 lines name the door): section 7, section 8 and the experts offer.

- `node "${CLAUDE_PLUGIN_ROOT}/scripts/close-loop.cjs" close --room <roomDir> --surface bono --payload <payload.json> [--run-id <id>] [--session-id <id>]`
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/close-loop.cjs" version-log --room <roomDir> --topic "<topic>"`
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/close-loop.cjs" offer-experts --hats <hats.json>`
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/close-loop.cjs" file-expert --room <roomDir> --spec <spec.json> --session-id <id>`

commands/intel-pipeline.md (1 line), "7. Close":

- `node "${CLAUDE_PLUGIN_ROOT}/scripts/close-loop.cjs" close --room <roomDir> --surface intel-pipeline --payload <payload.json>`

The mirrors carry the same text: 4 lines name the door in skills/bono/SKILL.md and 1 in skills/intel-pipeline/SKILL.md. The tri-polar sentence was re-measured at execution: `grep -rln "writeCloseLoop\|close-loop-writer" lib/mcp` returned nothing (exit 1), so both docs say Claude Desktop cannot run the close.

## Contract findings as shipped

1. The door runs `findPriorConclusion` and sets `priorConclusionId`; a payload carrying that key is refused `prior_conclusion_id_not_allowed`.
2. The supersede goes through the writer's `supersedeFn` seam bound to `navigation.resolveByUser(room)`; only a confirmed prior is chained; an unconfirmed prior is disclosed `prior_unconfirmed` with exit 0; no confirmNode or promoteNodeStatus call exists in the file.
3. The one writeCloseLoop call runs inside `navigation.withRoomTx`; `summary.ok` false or any failure throws a rollback sentinel (arms C and D: every row delta 0). The bank .md cannot roll back and is listed as `bank_md_written`.
4. The door opens through `navigation.openRoomDbForCaller` and `navigation.openRoomDbReadOnlyForCaller`; arm A shows the HOME tree is unchanged and the room tree differs only in room.db, its WAL and SHM, and opportunity-bank/.
5. offer-experts prints the shipped one-sum ranking unchanged (arm E).
6. run-all-223 signature unchanged.

## Deviations from Plan

None. The plan was executed as written. One addition in the door: the stderr refusal line appends the key or detail after the reason (`close-loop file-expert: refused (forbidden_field): ventureNotes`), which the plan's arm F requires (stderr names ventureNotes).

## Known Stubs

None.

## Threat Flags

None beyond the plan's register.

## Not done

- Filing the egain room's artifact into its graph: out of scope per the plan, left to the orchestrator after the navigator's card.
- The `.planning/` docs commit (this SUMMARY, STATE.md): left to the orchestrator per the constraints.

## Self-Check: PASSED

- scripts/close-loop.cjs and tests/test-261006-0hl-close-loop-cli.cjs exist; commits 3068d9126, b43eb26c5, 162aa0637 are ancestors of HEAD.

## Post-quick: the egain filing (orchestrator, 2026-10-06, on the navigator's "proceed")

`node scripts/close-loop.cjs close --room ~/MindrianRooms/egain-des-liquid-conductor --surface bono --payload <scratch>/close-payload.json --run-id bono-soft-state-first-2026-10-05 --session-id bono-close-2026-10-06`: ok true, topic_hash fa3f953, prior null (first run, chain not written, reason no_prior), conclusion claim:bono-close-2026-10-06:9678da71, 6 claim ids (5 claims typed assumption and anomaly_cue plus 1 known), 3 open_question ids, edges_written 1 (the known's SUPPORTS), failures []. `version-log` lists the one proposed conclusion. `file-expert` x6 (White, Black, Yellow, Green, Red, Blue; generic lens labels at evidenceTier None, provenance names the simulated debate): six proposed SyntheticExpert nodes, exit 0 each. The artifact's frontmatter `method:` line was corrected and a `graph:` line added. Nothing confirmed; the navigator ratifies through confirmNode or leaves the nodes proposed.
