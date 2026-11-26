---
phase: 367
round: 2
target: 367-DESIGN.md r3 -> r4
reviewers:
  zoom_out: completed (0 Blocker, 7 Major, 7 Nit)
  codebase_details: completed (1 Blocker, 8 Major, 8 Nit)
  design_critic: completed (3 Blocker, 11 Major, 6 Nit)
  implementation_readiness: completed (2 Blocker, 14 Major, 9 Nit)
clean_round: false
---

# Goldfish review, round 2: findings and resolution

## Blockers

| Id | Finding | Outcome |
|---|---|---|
| CD-B1, IR-B1, DC-B1, ZO-M1 | `writeReasoningNode` mints proposed/system only; OR-1 path as written cannot exist; AC4 fails by construction | FIXED r4 section 6: `writeReasoningNode` (proposed) then `confirmNode(db, id, resolveByUser(roomDir), reason)` in one `withRoomTx`; fixed id `REASONING_NODE_ID('decision:card', tool_use_id:q_index)`; AC4 asserts `confirmed_by` |
| DC-B2 | OR-1 trust anchor is a model-writable transcript; MCP `transcript_path` is model-supplied; a cancelled card has a tool_result | FIXED r4 section 6: host-attested PostToolUse AskUserQuestion hook, HMAC-signed ledger outside the room, runner never reads transcripts for decisions; cancel/deny/error skipped; AC4 negative legs; threat model stated |
| DC-B3 | Cache rule re-hashes forever; budget never finishes a large room | FIXED r4 5.2: cache (mtime, size, hash) for matched files too, atomic; budget over files examined with a persisted cursor; AC10 |
| IR-B2 | `check-substrate.cjs` bans lazygraph imports and `openGraph(` outside the allowlist | FIXED r4 section 8: runner and doctor module added to the allowlist with a reason; every slice gates on `--diff` |

## Majors (merged)

| Id | Finding | Outcome |
|---|---|---|
| ZO-M2, CD-M4, CD-M5, IR-M4, IR-M5, DC-M5 | Fragment uuid migration, two fragment writers, host vs local session ids | CUT: the runner does not ingest fragments; the existing Stop ingest stays the only writer; R8 goes to a `/gsd-quick` with a reproduction |
| ZO-M3, DC-M9, IR-M8 | `turn_closed` is the telemetry flood again; `session_closed` has no writer; MCP turn key undefined | CUT: both event types; summary lives in the status file; only `card_answered` is added |
| ZO-M4, DC-M8, IR-M3 | Bash matcher, SubagentStop and PreCompact rework not needed; Bash hook census test | CUT: Stop diffs the whole tree; only the AskUserQuestion hook is added (census +1, test listed) |
| ZO-M5 | 400.3-08 as a job type of the runner | FIXED: 400.3-08 stays in 400.3; shared spawn helper and the per-room write.lock |
| ZO-M6 | Card parsing in transcript-ingest | SUPERSEDED by the hook-based ledger (no transcript parsing) |
| ZO-M7, IR depends | (b)/(c) do not need to wait for 400.3 | FIXED: three stand-ins, marked for swap |
| ZO-N2 vs DC-M1 | Two MCP sites enough vs Desktop calls bind/context only at first activation | DC-M1 wins with evidence (`runtime-instructions.cjs`): one `registerTool` wrapper at `mindrian-mcp-server.cjs:232` (R1 ZO-3 cut re-opened on new evidence) |
| CD-M1, IR-M12, DC-M6 | Enumerators disagree with rebuildGraph; a.md/a.html loop | FIXED: one exported `listIndexableArtifacts` with the rebuildGraph scope; `.md` wins; collision counted |
| CD-M2, IR-M12 | Re-read inside the transaction | FIXED: accepted and bounded: batches of at most 10 files, lock per batch, yield between batches |
| CD-M3, DC-M3, IR-M9 | job-lock is per path; 6 h ceiling after a killed runner | FIXED: per-room runner pid file (60 s stale rule) plus a dirty file; job-lock not used (alternatives table) |
| DC-M2, IR-M9 | Busy or debounced triggers dropped | FIXED: dirty file re-run (max 3 passes) and a trailing debounce |
| DC-M4 | One session spanning two rooms | FIXED: the hook resolves the room from its own stdin `cwd`; AC7 |
| DC-M7, IR-M10 | Detached spawn details | FIXED: options stated; AC8 |
| DC-M10 | Cowork concurrency | FIXED: non-goal stated with a reason |
| DC-M11 | Kill switch; killed-run state | FIXED: `MOS_NO_GRAPH_CATCHUP`; `running` state with pid; doctor `stale_run` |
| CD-M6, IR-M10 | MCP-first transcript site | SUPERSEDED: no transcript is needed; on-stop spawns inside the MCP-first branch |
| CD-M7 | computeCatchUp not usable | FIXED: dropped |
| CD-M8, IR-M2, IR-M5 | Migration naming and registration | CUT with the migration |
| IR-M1 | busyMs 2000 has no source; lock ownership | FIXED: stand-in uses the default 5000 in a detached child; the runner takes write.lock per batch |
| IR-M2 | Section 9 incomplete | FIXED: full table incl. census test, substrate, dist regenerate command, CONTEXT, canon log |
| IR-M6 | Card extraction unspecified | FIXED: ledger line schema; answer shape from real transcripts (`toolUseResult = {questions, answers: {question: label}, annotations}`); spike S0 pins the hook stdin |
| IR-M7 | key_decisions has no source | CUT to the R8 follow-up |
| IR-M11 | Enums | FIXED: reasons, status keys, cache path |
| IR-M13 | ACs | FIXED: paths, birth chokepoint, baselines, seam, measurement |
| IR-M14, DC-M1 | Prose list and regex miss files | FIXED: regex `(every|each) substantive turn`, scope incl. destijl, runtime-instructions, harness policy; run-harness check |

## Nits

Fixed: heading revision, canon_parts, slice order and checkpoints, bash detach form, R7 citation lines,
status strings outside totals, SessionStart `resume`, legacy schema rule, same-question-twice rule,
Goals and Non-goals section.
