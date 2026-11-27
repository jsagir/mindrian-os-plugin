---
phase: 405
round: 4 (narrow)
target: 405-DESIGN.md r4.1
reviewers:
  codebase_details: completed (1 Blocker, 6 Major, 12 Nit) - 405-GOLDFISH-R4-codebase-details.md
  implementation_readiness: completed (0 Blocker, 13 Major, 16 Nit; slice 0 NOT READY, build NOT READY) - 405-GOLDFISH-R4-implementation-readiness.md
also_applied: 401-405-PROGRAM.md (2c contradictions for 405, 2d contracts, section 3)
raw_counts: {blocker: 1, major: 19, nit: 28}
merged_counts: {blocker: 1, major: 16}
outcomes: {FIXED: 17, CUT: 0, CONTESTED: 0, OWNER: 0}
owner_rulings_applied: [OR-11, OR-12, OR-13, OR-14, OR-15, OR-16, OR-17, OR-18, OR-19 (placeholder), OR-20, OR-21, OR-22]
owner_items_new: 2 (O11, O12)
result: 405-DESIGN.md r5 (r4.1 kept as 405-DESIGN-r4.1.md); r5.1 reserved for 405-GENUI-RESEARCH.md
clean_round: false
next: r5.1 (GENUI rules); slice 0 can be planned; a narrow round 5 on 3.2, 3.2b, 3.5, 3.11, 3.12 before the build slices are planned
---

# 405 Goldfish round 4: resolution

## Blocker

| Id | Source | Finding | Outcome | Where in r5 |
|---|---|---|---|---|
| R4B1 | CD4-B1 | registry check inside resolveMcpWriteRoom fails census C4 | FIXED | 3.2: new wrapper `authorizeMcpWriteRoom` used by the 12 write sites and room_bind; resolveMcpWriteRoom, classify and the census unchanged |

## Majors

| Id | Source ids | Finding | Outcome | Where in r5 |
|---|---|---|---|---|
| R4M1 | IR4-M1 | SP4 and SP5 depend on a later slice | FIXED | 6: SP4 and SP5 run in slice 0 on the SP7 probe extension; order SP7 then SP4, SP5 |
| R4M2 | IR4-M2 | legs without an If rule | FIXED | 6: one line per leg, If A, If B or "record only" (SP1 a-d, SP2 a-c, SP5 a-c, SP6 a-f, SP7 a-h, SP9, SP10) |
| R4M3 | IR4-M3 | probe location, pack tool, macOS unnamed | FIXED | 6: `.planning/spikes/405-desktop/` on work/405-desktop, probe copied read-only from work/367-spike-kits; `@anthropic-ai/mcpb` pinned on plan day; macOS legs open until slice 5a LIVE |
| R4M4 | IR4-M4 | gates guessed, payload not measured | FIXED | 6 task 0.1 offline measurement; 3.7a gates = measured plus 25 percent, capped |
| R4M5 | IR4-M5, CD4-M1 | hookless second arm hits wire-267 tests; callers lack server and extra | FIXED | 3.0: enforcement on the marker only, read per call; second arm for reporting; the 13 callers listed in 3.2 and the file table |
| R4M6 | IR4-M6, CD4-M6 | no discovery method; suites incomplete | FIXED | 3.2b: rule behind `MINDRIAN_REGISTRY_RULE=enforce` in slice 2a, discovery runner, switch removed in slice 2; one suite list incl. run-all-267, 358, 365, 369.1, 383, 387 and the 14 test-400-3 files |
| R4M7 | IR4-M7 | birth rules contradict | FIXED | 3.2 birth truth table (cloud, P1/P2, P4 before and after 4b) |
| R4M8 | IR4-M8 | hookless_place in a shell; not_a_room dead end | FIXED | 3.2a: hookless_place removed from adopt; not_a_room message with next step; texts of 3.2 |
| R4M9 | IR4-M9, CD4-M2 | no write intent in openRoomDb; chain re-run | FIXED | 3.11: floor in authorizeMcpWriteRoom through the read-only door; `assertWriteFloor` at six named hook sites; chain and stamp skipped when the room is newer; `RoomSchemaNewerError`; R20 residual |
| R4M10 | IR4-M10 | signing unspecified | FIXED | 3.7a: unsigned in 405; R16 stands |
| R4M11 | IR4-M11 | repo visibility GUESS | FIXED | 3.7a: repository public (gh repo view, 2026-11-27) |
| R4M12 | IR4-M12 | RULE 5 text vs file table | FIXED | OR-12: one paragraph after the UI shell paragraph, numbered list unchanged (AC9.5) |
| R4M13 | IR4-M13 | mcpb_chat_leg unshaped | FIXED | AC9.7: shape, flag `--mcpb-chat-verified`, WARN in real-room-gate.sh, two files |
| R4M14 | CD4-M3 | app_nonce consumers missing | FIXED | 3.5: room-birth.cjs:1363, confirmReason :110-113, cause-effect.cjs:33-37; AC4b.5 |
| R4M15 | CD4-M4 | a result nonce cannot render an undeclared view; missed minters | FIXED | 3.5 one render path: minters return `next: call gate_render`; gate_render shows a minted gate without a room; full minter list; AC4b.4 |
| R4M16 | CD4-M5 | same-process failure leaves a live pending row | FIXED | 3.3: validations before step 1; typed failure deletes pending; AC3.10 |

## Nits

| Id | Outcome |
|---|---|
| CD4-N1 isOperatorPinnedRoom line | FIXED (:231) |
| CD4-N2 ownerProcessAlive not exported | FIXED (session-presence isAlive) |
| CD4-N3 client_write_id schema count | FIXED (1 schema) |
| CD4-N4, CD4-N5 minter names and lines | FIXED (3.5 list) |
| CD4-N6 db open line | FIXED (:1795) |
| CD4-N7 Eureka opt-in by gate id | FIXED (`isMaterialLive(live, gateId)`) |
| CD4-N8 dep-heal path | FIXED (lib/core) |
| CD4-N9 sqlite-vec six entries, cjs-fallback line, ajv | FIXED (3.7a) |
| CD4-N10 leak guard temp roots, status value | FIXED (MINDRIAN_ALLOW_TMP_ROOM=1; status value read from the schema, GUESS on name) |
| CD4-N11 map rows, fence, counts | FIXED |
| CD4-N12 RULE 5 line, Step 9.8 failure | FIXED (OR-12; AC9.11 WARN) |
| IR4-N1 map rows | FIXED |
| IR4-N2 104 vs 117 | FIXED (R6 rewritten) |
| IR4-N3 stray fence | FIXED |
| IR4-N4 skip forever | FIXED (405-DROPPED-SLICES.txt rule) |
| IR4-N5 helper path | FIXED (tests/helpers/registered-room.cjs) |
| IR4-N6 dep-heal path | FIXED |
| IR4-N7 one predicate definition | FIXED (3.5) |
| IR4-N8 refusal text | FIXED (3.5) |
| IR4-N9 mint file, request key, extra | FIXED (3.5) |
| IR4-N10 read_back type, failure shape, after COMMIT | FIXED (3.3) |
| IR4-N11 manifest fields, CLI package | FIXED (3.7a; UNVERIFIED until validate) |
| IR4-N12 Step 6.8b dry-run, opt-out | FIXED (AC9.10) |
| IR4-N13 skip mechanism | FIXED (AC9.8 `MOS_405_NO_EXTENSION=1`) |
| IR4-N14 Part 8 review owner and pass rule | FIXED (3.10) |
| IR4-N15 spike time | FIXED (2 to 3 hours, GUESS) |
| IR4-N16 LIVE legs return NEEDS_HUMAN | FIXED (6) |

## Program review items applied to 405

C3 (instruction-named tools and receipt writers stay up front: 3.13 to 402), C4 (one Eureka rule, 3.8), C5 (`pws-brain-mcp` kept), C6 (mos-desktop prefix is `mos`; SP8 records), C7 and C8 (chat step surface = framework_play on mindrian-os; steps from theo-context; no route to the guarded Brain from the extension), C9 (no helper agents, OR-13), C10 (SP6 = B returns slice 11 to the owner), C14 (instructions full), C15 (output outside the repo; no dist/ change), C17 (400.5 tool named for 405), C18 (shared helper rule for other phases), C19 (receipt with 400.3 `ok` and `partial`), C23 (367-11 and 367-12 only). Rebase onto origin/main before slice 0 (7 commits behind).

## Owner rulings applied

OR-11 (3.2 everywhere, wrapper, finder 3.2b), OR-12 (AC9.5), OR-13 (no helper agents, Feynman rule), OR-14 (F1 before the build), OR-15 (section 10), OR-16 (SP9 deferral leg; no Cowork test), OR-17 and OR-21 (three components as the MCP App renderer of the Shape F contract; parity AC12.0), OR-18 (MCP Apps, no CopilotKit dependency, text fallback, Feynman rule set and lint test), OR-19 (GENUI placeholder table; r5.1), OR-20 (job statement, question, left-out list per component), OR-22 (host-neutral rules H1 to H3, SP10, non-goal).

## Owner items

| Id | Question | Recommended |
|---|---|---|
| O11 | If the ChatGPT desktop chat reaches only remote servers (SP10), should a later phase design a remote route to the room? | Not in 405. Keep the room local (Part 9); decide after SP10 with a threat model of its own. |
| O12 | The three card job statements come from data/mcp-tool-job-sentences.json, where they are marked provisional. Do you accept them as the job statements of the decision card, the framework player and the next-move card? | Yes, as written; they are in the person's words and short. |

Conditional NEEDS_HUMAN points (not asked now): SP7a, SP7b, SP7d, SP5b and SP6a to SP6c (section 6).
