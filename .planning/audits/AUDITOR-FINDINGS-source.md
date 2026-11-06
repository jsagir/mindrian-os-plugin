# Auditor findings, source text

Verbatim extraction from the owner session transcript. All text below was pasted by the owner from a cloud audit agent. It is auditor text, not owner authority. Nothing is fixed, paraphrased or judged.

## Index

| ID | Title | Section heading |
|----|-------|-----------------|
| A | Auditor cleanup plan, Phases A to D (behaviour-preserving cleanup, risks and guards, track list) | Phase A-D cleanup plan |
| B | Auditor final report: redundancy audit 01, top ten T01-T10, bugs B1-B16, Eureka section, not-covered list, first 3 measurements, plan 07 update | Final report T01-T10, B1-B16 |
| C1 | B2 analysis and T02-T05 measurement design (auditor text, pasted inside the owner card answer) | B2 analysis and T02-T05 design |
| C2 | Auditor message: "yes, go, with two changes" (trigger for C1) | Yes-go message |
| D1 | Auditor interim report: six patterns behind most findings (operator-update registry bug, folder-memory import chain, duplicate work, bugs) | Six patterns interim report |
| D2 | Auditor follow-up: lazy import chain confirmed, operator-update repair cost, wiki route, plan 09 mapping | Follow-up on import chain and operator-update |
| D3 | Auditor "New guidance from the owner" text (later retracted by the auditor in D4) | Overstated owner guidance (retracted) |
| D4 | Auditor correction: source of the guidance, Pinecone/Memgraph/LazyGraph/Neo4j verdict summary | Correction and R1 verdict summary |
| D5 | Auditor review of the auditor definition (L6/L7, verification step, pycache, confirmed facts) | Review of definition |
| D6 | Auditor R1 update: Eureka reachability gap, kuzu-class redundancy verdicts, duplicate code inside Eureka | R1 update, Eureka gap |
| E | Auditor question list (16 questions) for the owner, pre-findings | Auditor question list |
| F | Auditor egress audit, final message (Part 8 guard, four stacked problems, Phase 386 ordering note) | Auditor egress audit, final message |
| G | Second auditor handoff, older commit 72b0eed8 (packet bypass, brain_write ambiguity, wiki/entity/chat egress, over-blocking, fail-closed room check, 46-claim comparison) | Second auditor handoff (older commit 72b0eed8) |
| H | Third external audit handoff, pinned baseline 72b0eed8 (lazy import, web credential hook, web-path ruling, Phase 387 fresh-install check, 75 tools / 24 Eureka names, audit limits) | Third external audit handoff (pinned baseline 72b0eed8) |

Versions: each text appears once in the transcript; no duplicate versions found, except D3 (superseded by its own correction in D4) and R1 report updates (D6 replaces the first R1 report, which was not pasted in full by the owner; only D4 quotes its verdicts).
Redaction (Canon Part 8): one room path pattern replaced with <room> in item B (T04). Wrapper tags `<pasted_content>` removed. Owner prefix "WHAT QUESTION DO I NEED TO ANSWER ?" removed from D5 (owner words, not auditor text). The first words of C1 start with `'d` because the transcript card answer cut them; kept as is.


## A. Phase A-D cleanup plan

Source: pasted by owner, auditor text, not owner authority

~~~~text
Yes, I think you can, if "cleanup" means behaviour-preserving changes: after each change the plugin produces the same outputs, just with less code or less work. Most of what the audit found fits that rule. The things that could cripple MindrianOS are a small, known set, and the repo already has the safety nets a GSD workflow needs.

I'd change one thing in the plan. Don't split it as "cleanup, then optimisation". Split it by how much behaviour each change touches. Some cleanup is already the biggest optimisation; removing a hook that does nothing is both.

Why I think it's doable

Strong safety nets:
about 2,700 test files and per-phase suites (bash tests/run-all-<phase>.sh);
doctor --acceptance, release gates, and the real-room run that the release rule already requires;
your harness, which already has before-numbers from plan 06.
Many findings are things that do nothing today. Examples: operator-update, the jtbd-update Stop leg, the per-turn doctor scan, the cascade process that always skips, the post-compact side file nobody reads. Removing or short-circuiting them can't change what users see, because today they produce nothing. That's the safest kind of cleanup there is.
The biggest wins are small edits: one lazy import, moving a few early exits ahead of the heavy loading, and one fast path in the database open.

What could cripple it, and the guard for each

Deleting something that is reached in a way the audit didn't see. The audit never opened data/ (the doctor and harness registries), dist/ or .planning/. Code is also reached through dynamic require paths and node ${CLAUDE_PLUGIN_ROOT}/… lines in markdown.
Guard: before any deletion, search data/ and dist/ and run the full suite.
"Fixing" a dormant feature turns it on. Repairing operator-update's registry read, the JTBD resolvers, or widening isRoomFile would start transitions, database writes and the full cascade on every write. That's the opposite of optimising.
Guard: the default is to remove or short-circuit. Repairing is a separate owner decision.
Part 8 surfaces: the egress guard, whitespace-to-brain, the hidden wiki chat proxy.
Guard: speed phases don't touch these. They go to the bug phase with a Part 8 review.
Three surfaces plus Windows. The harness runs on Linux, while run-hook.cmd, Cowork and Desktop paths behave differently.
Guard: the tri-polar check from your CLAUDE.md on every change that touches hooks.
Tests that pin source text (byte-identity, writer inventory, source-text tests). They'll fail on legitimate changes, which tempts people to edit tests until they go green.
Guard: for each plan, list in advance which tests it is expected to change, and why.
Host behaviour we haven't verified: whether PostToolUse fires for a subagent's tool calls, whether one event's hooks run in parallel, and what the Stop input really contains.
Guard: check these before the hook-merging stage, not after.

Suggested GSD phases, in order

Phase A: remove what does nothing (lowest risk).
Dead modules with no caller.
Remove flexsearch from dependencies.
Untrack the committed __pycache__ files.
Unwire or narrow the hooks that do nothing: the operator-update Stop entry and matcher, the jtbd-update Stop leg, query-efficiency on Read, SlashCommand telemetry, and the per-turn doctor poll (needs your ruling).
Pass bar: the same outputs, all tests green, harness process counts down.
Phase B: same work, done cheaper.
The lazy import at folder-memory.cjs:268.
Early exits before heavy loading (brain drain, auto-explore drain, gsd drain).
Check the cascade gate in bash before starting the process.
One jq call instead of three; one node call per JSON producer at session-start.
The read-only database door plus a per-process "already migrated" memo.
Pass bar: byte-identical outputs and harness before/after numbers on each plan.
Phase C: change checks. Skip Stop and SessionStart work when nothing in the room changed: recompile, brief rendering, the dial-memory rewrite, AgentShield. This is low to medium risk, because the "did it change" logic itself can be wrong. Test it on the real-room run.
Phase D: structural (last, highest reward).
One PostToolUse dispatcher.
One room resolver.
One Stop close-out shared by bash and MCP.
Scoped reconciles.
This is where behaviour can shift. Each item gets its own phase, and only after the host-behaviour questions are answered.
Separate tracks, not mixed into the above:
the bug phase, starting with the Part 8 items;
making Eureka reachable;
test-only modules. These may be planned-but-unwired contracts (Part 11, "born wired"), so they need your ruling, not deletion.

For each plan, a simple rule: one finding per plan, small commits that are easy to revert, and the same checks every time: before/after harness numbers, the relevant run-all suite, doctor --acceptance, and the real-room run before any release.

Honest caveat: every audit finding is still a hypothesis read from code. Only the counts from your harness are measured. So Phase B should start with the three measurements in the report. If the lazy import doesn't move the numbers the way the audit expects, that tells us early that the audit's cost model is off, before anything risky is touched.

So yes: start with Phase A and B and you'll probably capture most of the gain at low risk. Phase D is where crippling is possible, and by then you'll have numbers to tell you whether it's worth it.
~~~~

## B. Final report T01-T10, B1-B16

Source: pasted by owner, auditor text, not owner authority

~~~~text
MindrianOS plugin: redundancy audit 01
Repo: https://github.com/jsagir/mindrian-os-plugin (branch main)
SHA read: 72b0eed8bbc16001592bc9bd11f3b05695a8d5f1 (2026-11-05)
Coverage: 13 slices, R1 and lenses L1-L5. Every slice and every lens completed; none failed.
Mode: read-only. Nothing in the repo was edited, executed or timed.
Evidence labels
READ means a reviewer saw it in the code. That reviewer is a slice or lens agent; the lead then re-opened every top-10 file:line listed below.
MEASURED means the owner's harness produced the number (tools/perf/perf-harness.cjs, test room, owner's context pack). In those rows the count is measured, but the cause is still READ until a before/after run confirms it.

The owner's note on the four systems is: "the two imporatatn patrs are the icm (i thinkg) the local grpah, the remote graph and the eurika engine (primery)". The owner later confirmed Eureka: "primary IS CRITICAL as the unqie edge of the prodceu...". So:

System    Tag
Eureka    owner-declared critical: confirmed
ICM    owner-declared important: unconfirmed
Local graph    owner-declared important: unconfirmed
Remote graph    owner-declared important: unconfirmed
Merged top 10 (ranked by how often it runs x likely cost)

Format: id | slice(s) | file:line | what repeats or wastes | how often | how to measure | risk of change | READ/MEASURED

T01 | H3, L1, L2 | hooks/hooks.json PostToolUse (8 commands match Write); scripts/post-write:144,147,153,216

What: one Write starts 8 hook processes that share nothing. The same stdin is parsed about 9 times. There are 4 separate .room-root walk-ups and up to 5 registry.json parses. resolve-room (bash + python3) runs unconditionally.
How often: every Write/Edit/MultiEdit.
How to measure: the owner already counted 8 hooks and 36 processes per write. Next, take per-hook ms from the harness, then prototype one PostToolUse dispatcher.
Risk: medium. A dispatcher must keep per-hook timeouts and soft-fail behaviour, the Windows run-hook.cmd path, and merged envelopes. Low-risk first steps: one jq call, move resolve-room inside its branch, and point frontmatter-schema-validator at lib/core/room-root.cjs.
Label: MEASURED (count) / READ (cause).

T02 | H3, L4, L5 | scripts/operator-update.cjs:106 (legacy registry shape), :134 (silentSuccess exit); hooks.json entries for Stop, PostToolUse and UserPromptSubmit

What: the script exits doing nothing on every firing. It expects active_room plus a rooms list, but scripts/room-registry writes active plus a keyed object. It loads operator.cjs and classifier.cjs before it reads stdin.
How often: PostToolUse on 10 tool names (nearly every tool call), every prompt and every Stop.
How to measure: time 100 runs against a registry created by room-registry, compared with the floor:node target. Multiply by calls per session.
Risk: low to unwire or narrow the matcher. Repairing the registry read turns on a feature that is dormant today and makes each call cost more, so the owner has to decide.
Label: READ. The owner and the lead both confirmed it in the code.

T03 | C1, C3, X3, L5 | lib/core/folder-memory.cjs:268 -> lib/core/feynman/timeline-runner.cjs:25 (and timeline-renderer.cjs:32) -> lib/core/navigation.cjs (52 top-level requires)

What: every process that only needs readTriple/getCurrentRoom loads the whole navigation and sensor graph. A static walk counts about 124 files / 46.8k lines for folder-memory, against about 3 files without line 268. Only readQuintuple (extractFeynmanBody) uses timeline-runner.
How often: every statusline render (scripts/context-monitor:20-22), every Stop (on-stop snapshot), 3 session-start processes, the brain drain on every prompt, and post-compact.
How to measure: see Measurement 1.
Risk: low. Make the require at folder-memory.cjs:268 lazy (also in folder-memory-async). Making only timeline-runner.cjs:25 lazy is NOT enough, because timeline-renderer.cjs:32 is a second route to navigation.
Label: READ. The chain was confirmed by the owner and the lead; the closure size is a static count, not measured.

T04 | H3, L3, L5 | scripts/post-write:240-256; scripts/mindrian-tools.cjs:13-24; lib/core/intelligence-cascade.cjs:182-184, 651-655

What: post-write starts the foreground cascade node (about 147 files in its eager closure by static count, 10 requires at the top) for any file with a STATE.md ancestor. runCascade then returns skipped because isRoomFile only accepts paths containing '/room/' or '/rooms/'. Default <room> paths and .planning/ never pass, so the whole process is wasted. post-write still writes last-cascade.json as "complete" (see B7).
How often: every write under a STATE.md ancestor.
How to measure: run the cascade on a default-layout room, confirm skipped:true, and time it.
Risk: low. Make the same substring check in bash before spawning. Do NOT widen isRoomFile: that would switch on HSI, compute-state, build-graph, a double analyze-room (report-only spawns) and a git commit inside a 5 s hook.
Label: READ.

T05 | X1, X2, L4, L5 | scripts/hmi-compliance-poll.cjs:100 (spawnSync doctor --ui-compliance), :251 (tier-0 branch can never run); lib/hmi/tier-check.cjs:41-47 (returns only 1 or 2)

What: on every turn, a second node process loads doctor.cjs (4,710 lines) and regex-scans every commands/.md (113 files) and scripts/.cjs (298 files, about 6.3 MB). It writes .mindrian/last-hmi-poll.json, whose only reader is scripts/hmi-status-command.cjs. That script has no production caller (commands/hmi-status.md forwards to doctor). The inputs are shipped files that do not change between turns.
How often: every Stop that has an active room.
How to measure: time the hook with and without the spawn, and time doctor --ui-compliance alone.
Risk: low to medium. Options are a cache keyed on plugin version, an in-process call, or unwiring. Three tests pin the current behaviour, and the Phase 105 passive-polling contract needs a ruling.
Label: READ.

T06 | H2, L1, L2, L3 | scripts/on-stop:386-391 (one recompile node per section), :406-523 (snapshot), :543 (guardian), :567-605; scripts/vault-section-minto-generator.cjs:859-876

What: the Stop close-out has no "did anything change" check:
N node cold starts for recompile, all of which then queue on one room-wide lock;
each MINTO.md is read 4-5 times per section;
BRIEF.md is fully rendered and then thrown away when the fingerprint matches;
on-stop has 20 node invocations, about 7 of them glue (pulling one JSON field, Date.now(), formatting);
memory-lifecycle runs twice, each time opening room.db.
How often: every Stop with a room that has .mindrian.
How to measure: the owner already counted 8 Stop hooks and 36-38 node starts. on-stop already logs elapsed_ms to .mindrian/session-close.log. Compare against an on-stop-state dirty check.
Risk: medium. tests pin the systemMessage format, and the same close-out logic exists a second time in lib/mcp/stop-gate-handler.cjs (fix both).
Label: MEASURED (count) / READ (cause).

T07 | H3, L2, R1 | scripts/on-agent-complete:75, 103, 116-124, 149-151; macOS-only part at :16-17

What: for each modified .md file (up to 20), it starts a full "bash post-write" chain plus 1-2 "node fire-sensor-event" processes, then compute-state and state-write. On macOS, find -exec stat ; also starts one stat process per .md file in the room. If PostToolUse already fired for the subagent's own writes, each file is cascaded twice (not verified).
How often: every SubagentStop.
How to measure: the owner measured 2,604, 12,703 and 17,232 processes for 1, 5 and 20 files; 20 is the cap from head -20 at line 75. Next, check whether PostToolUse fires for subagent tool calls.
Risk: medium. Dedupe against what post-write already handled; on macOS use {} + and bash parameter expansion.
Label: MEASURED.

T08 | H2, C1, L1, L5 | scripts/brain-derivation-drain.cjs:176-180 (warm-up); lib/core/brain-derivation-queue.cjs:337-349 (empty-queue check comes after the loads)

What: the drain loads folder-memory (and so navigation, see T03), brain-client (2,685 lines) and navigation before it learns that the queue is empty. commitDispatched then reads the queue a second time.
How often: every prompt with an active room.
How to measure: the owner measured about 74-78 ms on an empty queue, about 49 ms of it module load. Re-run after moving readQueue and the empty check above the warm-up.
Risk: low. Keep the warm-up for non-empty queues (the Phase 245 budget).
Label: MEASURED.

T09 | D1, M1, M2, L3 | lib/core/room-db.cjs:251-325; lib/core/navigation/room-change-log.cjs:113-120 (BEGIN IMMEDIATE on every open); stale comment at room-db.cjs:113-117

What: every openRoomDb runs the full idempotent schema and migration chain, about 60 SQL statements by reading. installChangeLog takes the write lock even when nothing is missing. Read-only callers use this write door: getCurrentJTBD, check-pending-ambiguous, read-voice-tail, gate observers, and 8 MCP read tools. A single process often opens the same db twice.
How often: every open. That is per prompt (2-3 opens), per Stop (at least 2), about 10 handles per SessionStart, and per MCP tool call.
How to measure: see Measurement 3.
Risk: medium. The chain is the migration safety net. Use a per-process "already migrated" memo, and on the fast path verify triggers with one sqlite_master check. Tests pin the busy/broken throw sites.
Label: READ.

T10 | H1, L2, C3 | scripts/session-start:402-405, 489-494 (one node per JSON field; 63 node lines in total); hooks.json SessionStart matcher startup|clear|compact; scripts/post-compact:102,109 (exec session-start); lib/core/feynman/dial-memory-runner.cjs:113-118

What: one node process per JSON field. Four reconcile node processes each re-resolve the room and open room.db. readTriple runs 4 times per section across 3 processes. Every section's FEYNMAN.md is rewritten and a memory_event is logged each time. AgentShield runs a full scan. All of it repeats on every compaction, and sometimes twice per compaction, through the post-compact exec fallback.
How often: every SessionStart, including clear and compaction.
How to measure: the owner counted 44-45 node processes (99-103 processes in all). Next, take per-block ms from the harness, then compare against field-batched producers.
Risk: low to medium. Each spawn has its own || default fallback, which must be kept. formatTripleContext byte identity is pinned by tests.
Label: MEASURED (count) / READ (cause).
Corrections made during the top-10 check
Cascade frequency (M2-01/02/03/06/07, C1-02, C2-02): these slice rows said "every room write". The cascade steps (HSI, compute-state, build-graph, a double analyze-room, the working-branch git commit) run only for paths containing /room/ or /rooms/. I verified this at intelligence-cascade.cjs:182-184 and 651-655. Three lenses raised it independently.
Eureka tool count: 16 modules register 23 tools, read statically. M1's "17 modules / ~20 tools" and the brief's "24" are both off. Only a runtime tools/list settles it.
Smaller line fixes:
H2-06: card-fire parses the transcript once per process.
C1-09: the misleading comment is at graph-ops.cjs:223-229.
M2-13: invalidateAnalysisCache is called (line 618), but it does nothing.
H3: the note that hmi-compliance-poll shares the registry bug is wrong; it uses the chokepoint resolver.
Context pack: "audit claim ~50" is a misquote. H1-01 said about 40 node processes in scripts/session-start alone, not counting the other 8 SessionStart commands.
Next tier (11-22, READ unless noted)
Statusline, per render:
2 node cold starts (statusline-mos:33 resolves the plugin root, :116 execs context-monitor);
the old two-row line is built and then discarded (context-monitor:700-734, 798-802, 905);
the 5 s TTL cache likely misses at the real render rate;
registry, plugin.json and voice-mark are each read twice (X3-02..05, L1-02, L2-04, L5-04).
Explored-materials ledger (lib/memory/explored-materials-store.cjs): append-only, never compacted. findLatest does a full scan on every in-room write, and markFailed appends roughly one line per write after the daily cap is reached. The owner MEASURED parse cost at 0.4 / 1.7 / 17.6 ms for 100 / 1k / 10k rows. pending-tension-store is a verbatim clone (X1-04, H3-05, L3-09).
Full graph reconciles on single writes:
memory-artifact-graph-hook reconciles the active room for any file named ROOM/STATE/MINTO/BRAIN/FEYNMAN/USER.md anywhere on disk;
gsd-artifact-graph-hook re-reads about 2,219 .planning files per .planning write.
Both duplicate the session-start reconcile blocks (H3-11, C3-06, X1-07, L3-05, L5-05).
Transcript: read and parsed 3 times per Stop in 3 processes, by 2 readers with different caps (L1-04, L3-04). The owner measured 2 tail reads; memory-lifecycle adds one full read.
Part 8 egress guard (part8-egress-guard-hook -> part8-egress-guard -> rs-egress-prompts:34 -> cross-room-aggregator): about 129 files loaded on every Brain call, only to reach one frozen regex list. The fix must keep one byte-identical source (C2-03, L5-13).
Room resolvers: at least 39 resolver definitions read 4 incompatible registry shapes. The canonical one appears to be lib/core/resolve-active-room.cjs (about 28-29 callers). The copies resolve different rooms, and some never resolve at all (L3-02, L1-07, L1-13, R1-07).
jtbd-update: the Stop leg is dead (it reads fields that are never present). On every prompt it reads jtbd-state.json 4 times and rewrites it (X1-02, X1-05, L4-04, L5-12).
AgentShield: a full scan of about 130 files / 1.5 MB on every SessionStart. The inputs change only when the plugin version changes (H1-03).
query-efficiency-telemetry: a no-op on every Read, as the script's own DD-9 note admits (H3-07, L4-02).
Two auto-commit pipelines for one write (async plumbing commit plus cascade Step 7b). Both happen only on /room/ or /rooms/ paths (L3-07).
Release: the same gates run about 9 times per release (X2-03, X2-04). This is build cost only.
Text:
113 command -> skill mirrors. Descriptions may be listed twice per session; whether the host dedupes them is unverified (T1-01).
The research-planner section is copied into 5 commands (T1-04).
voice-dna.md is re-read by 37 commands (T1-03).
Dead code (READ, caller search done, data/ not opened)
No caller at all:
lib/core/asset-ops.cjs
lib/core/deep-links.cjs
lib/core/platform-gates.cjs
scripts/extract-room-intelligence.cjs plus lib/core/room-type-detector.cjs (about 1,100 lines together)
lib/hmi/f9-ordered-capture-cli.cjs
scripts/release-beta-preflight.sh
scripts/build-ecosystem-graph.cjs (test-only; keeps a raw INSERT edges path alive)
Tests only:
23 lib/core modules, about 4,330 lines. These include temporal/supersession-gate.cjs, whose wire is unconnected (see B12).
The F3/F4/F9 selector write-half, about 1,800 lines.
15 scripts/check-*.
Dead branches inside live modules:
the graph-ops.indexOpportunity primary branches;
navigation.notImplementedYet;
context-monitor's flashingUpdate (CHANGELOG says it was kept on purpose) and detectActiveWorkflow;
the statusline-mos focus segment;
the intelligence-cascade analyze cache and queueCascade;
two shadowed wiki routes.
Dependencies: flexsearch has no require anywhere (R1-01). next, react and react-dom install on every machine for the opt-in /mos:dashboard shell (lib/ui-shell/dist is 11 MB); keeping them was a deliberate decision.
Packaging: lib/memory ships about 2.47 MB of tests in every npm tarball (X1-12). Two scripts/pycache files are tracked in git.
Eureka (owner-declared critical: confirmed)

How a normal install reaches it.

All Eureka MCP tools except eureka_graph_project need MINDRIAN_EUREKA_ROOT to point at an external mindrian-eureka checkout that has uv. The checks are at eureka-graph-analyze.cjs:24-26 and :105-107, eureka-capability-run.cjs:194-196, and eureka-capability-jobs.cjs:23.
Each call runs "uv run --project --extra mcp-server eureka-mcp" as a fresh Python process (M1-06).
The engine's Python and pyproject live in that external checkout. The repo-root pyproject.toml holds pytest settings only (R1).
The in-plugin layer (lib/core/eureka/, 23 files) runs on Node. Its encoder stack (about 380 MB) installs on demand through /mos:eureka enable (eureka-enable.cjs:21, 285).

What a user without it gets (lead and R1 agree on 23 tools; 23 + 19 + 3 + 1 below adds up):

1 works locally: eureka_graph_project, which still needs a bound room.
3 answer job_session_not_found: job_status, job_result and job_cancel (eureka-capability-jobs.cjs:110).
19 answer engine_not_configured: capability_run, capability_start and 17 graph tools.
The brief's "24" is probably the 24th quoted eureka_* literal, 'eureka_job_store_only'. That is a persistence value, not a tool. A runtime tools/list is still the final word.

Does anything set or document the variable?

Nothing sets it. There is no assignment in code, and it is not in .mcp.json, settings.json or hooks.json.
It is documented only in commands/eureka.md, skills/eureka/SKILL.md and docs/integrations/mindrian-eureka-engine.md.

Start-up cost when it is not configured.

register-core-tools.cjs readdirSync-requires every tools/*.cjs at MCP boot, so all 16 Eureka modules load.
Three of them (capability-jobs, capability-run, graph-analyze) eagerly require @modelcontextprotocol/client and its stdio transport.
All 23 tool definitions go into tools/list. Their description text is about 7.0 K characters (R1 count, source text only). They share a 17-field outputSchema. The 16 modules plus the contract file are 124,729 bytes (wc -c).
On the HTTP transport, registration repeats per request (M1-01).
Timings: not measured.

The gap. Eureka is critical to the product but is off by default. No install, doctor or setup step provides the engine root. A user without the checkout sees 23 tools, and 22 of them refuse (19 as engine_not_configured, 3 as job_session_not_found).

Cuts inside Eureka (keep the capability, remove waste).

(a) Duplicated bridge code (M1-07). decodeResponse (eureka-capability-run.cjs:36-53) and decodeEurekaResponse (eureka-graph-analyze.cjs:62-81) are the same function. The root check appears 4 times, the terminal-state set 3 times, and the poll loop twice (capability-run.cjs:97-160 vs graph-analyze.cjs:135-197).
(b) The per-call uv/Python spawn does not reuse a client, although capability-jobs already keeps retained clients with a TTL (M1-06).
(c) lib/core/eureka/compression-meter.cjs and lateral-engine-adapter.cjs are reached by tests only (C3-10, L4-12).
(d) All 17 graph tools build the room projection before the engine-root check, so without an engine they open room.db and then refuse. For example, eureka-graph-analyze.cjs:205 projects before the engine call at :212 (the lead checked this). Fix: check configuredRoot() first.
(e) Engine processes per call: genesis_plan and opportunity_scout start 2 each (genesis-plan.cjs:19,32; prepare-artifacts.cjs:23 then graph-analyze.cjs:115).
(f) The same logic is written more than once. Keep one copy of each:
decoder: keep decodeResponse (capability-run.cjs:36-51; capability-jobs.cjs:13 already imports it);
root check: keep configuredRoot() (capability-jobs.cjs:22-28);
poll loop: keep waitForJob (capability-run.cjs:97-152), and preserve the scout's own timeout and its model_unavailable message.
(g) auto-explore-fire.cjs:244 always spawns "python3 rs-engine.py --mode hybrid", bypassing the backend dispatcher. Its own comment says why.

R1's revised section, written under the owner's confirmation, is in 
audit01-R1.md
 (section 5b).

Undecided: the RS/HSI/whitespace algorithms exist in three layers (in-repo Python, in-repo CJS ports, and the external engine). The code does not say which is canonical. That is a question for the owner.

Bugs found along the way (not speed; for the bug phase)
B1 Latent Part 8 risk. In lib/wiki/wiki-server.cjs, the BYOAPI chat proxy (:657-713) is shadowed by the always-answering handler at :169. Reordering the routes would send page content to third-party APIs. The /pdf route (:603) is likewise unreachable behind :548.
B2 Possible Part 8 risk. A room write leads to auto-explore-fire, then discovery-cycle.cjs:446, then whitespace-to-brain.cjs, which sends brain_write with up to 500 characters of room-derived hypothesis text (:139). The path passes the guard in brain-client callTool (:446). Open questions: what the guard decides for this payload, and whether Theo accepts brain_write.
B3 Registry readers that never resolve. operator-update, hmi-status-command, across-session-memory (twice) and memory-completion-detector read the legacy array-style registry, so the operator/JTBD contributors and the JTBD promote graph events are silently off.
B4 scripts/session-start:1518 sets the environment variable after node -e, so the dev-clone install-pre-commit branch can never run.
B5 Compaction creates 2 session rows (session-start:1435 plus post-compact:339). The post-compact exec fallback emits a SessionStart envelope into PostCompact.
B6 check-pending-ambiguous's "3 strikes" counts compactions and clears. The check-pending-breakthrough scanner creates a room.db where none exists.
B7 post-write reports cascade "complete" when the cascade was skipped. memory-completion-detector can record duplicate completions.
B8 The dial-memory rewrite at every start probably marks every section stale (artifacts_newer_than_minto). Inferred, not run.
B9 restore-post-compact-context contribute() always returns empty, because readSideChannel() is called without a roomDir and path.join(undefined) throws.
B10 With NEO4J_URI set, /mos:rs-fetch throws a TypeError instead of falling back to SQLite (R1-03). Inferred.
B11 framework_run's halt path renders a gate that is never minted, so gate_answer returns unknown_gate (M1-09; already named as a trap in CLAUDE.md).
B12 supersession-gate.supersedeOnGateAnswer has no runtime caller (C3-10).
B13 .context/last-session.md is rewritten on every turn, so "since last session" really counts since the last turn (H2-08).
B14 memory-artifact-graph-hook reconciles the active room even when the written file is in another room or repo (H3-11).
B15 telemetry-command-invocation filters on an environment variable that nothing sets (H3-13).
B16 graph-doctor-module reads ctx.roomDir, which the doctor engine never sets. This matters only if the module is registered (X2-09).
Not covered
Timing. Nothing was executed or timed (rule 5). Every cost not in the owner's context pack is "not measured".
data/ was not opened. So the doctor-modules.json registry and data/harness-policies were not checked. The dead-code verdicts for doctor modules and test-only check-* scripts are qualified accordingly.
Directories not searched: dist/, ui/, r-and-d/, lab/ and test-fixtures/ (skip list), plus .planning/. An external consumer of the no-caller modules cannot be fully ruled out.
Hook scripts not audited in depth:
UserPromptSubmit: admin-command-gate, mva-detect and first-install-router (touched only by the lenses); intent-classifier.cjs internals, partly covered.
Stop: ambient-stop and gsd-graph-derive-sweep (grepped only).
SessionEnd: session-end-presence.
FileChanged: on-file-changed.
PreToolUse: write-scope-check, part8 hook body and card-before-answer.
The CwdChanged and TaskCompleted handlers (TaskCompleted only via L2-14).
brain-prewarm.cjs 15 s tail. The owner measured it, but no slice audited it.
Large command/MCP-only modules: lib/core/research-planner/ (about 18k lines), lib/core/eureka/ internals (about 9.6k lines), lib/mcp/tools/chain.cjs:1-926, research.cjs:140-903, navigation-engine.cjs, triple-context-formatter.cjs.
Host behaviour, unverified:
whether PostToolUse fires for subagent tool calls (T07);
whether one event's hooks run in parallel or in sequence;
the live Stop stdin fields and SlashCommand env;
whether the skill/command listing is deduped.
Report-only areas (lib/core/mcp-dep-heal.cjs, and the room-scan and room-render-analyze spawns): findings were reported, no change is proposed.
External repo: the mindrian-eureka repo was not available.
First 3 measurements to run (harness)
Lazy import (T03).
In a scratch --tree-b, make folder-memory.cjs:268 (and the async twin) a lazy require inside extractFeynmanBody.
Count modules for scripts/context-monitor and an on-stop snapshot with tools/perf/count-modules-preload.cjs.
Run perf-harness compare (--tree vs --tree-b, --cpus 4) on the Stop and SessionStart targets and a statusline render.
Confirmed if the module count drops from about 124 to a few, and Stop/SessionStart ms fall by about (load ms x processes that require folder-memory).
operator-update per call (T02).
With a registry made by scripts/room-registry, time "node scripts/operator-update.cjs" with a PostToolUse payload against floor:node ("node -e 0").
Confirm the exit at line 134 (NODE_DEBUG=module).
Waste per session = difference x (tool calls + prompts + Stops).
room.db open (T09).
On a copy of a migrated real room.db, time 100x openRoomDb+close, openRoomDbReadOnlyForCaller and a bare new DatabaseSync, all in one process.
Count SQL statements with a db.exec/db.prepare wrapper.
Then hold a write transaction in a second process and time a read-only caller's openRoomDb (busy wait).

The owner's existing numbers already back T01, T06, T07, T08 and T10. For plan 09, pair each one with a before/after run of the low-risk first step named in its row.

Where the raw rows are
Workflow run: wrun_01NWjXenffLXJ7QuC5vF5TiE.
Slice step ids: H1 seq 2, H2 3, H3 4, D1 5, M1 6, M2 7, C1 8, C2 9, C3 10, X1 11, X2 12, X3 13, T1 14.
Lens step ids: L1 17, L2 18, L3 19, L4 20, L5 21.
R1 report: 
audit01-R1.md
 (a copy of /tmp/audit01/R1/r1.md).
Update after Phase 384 plan 07 (owner's harness, fixture room)
T09 / S3 checked against the harness.
Setup chain: CONFIRMED. One open of an existing database runs 20 exec calls, 14 of them CREATE.
Handle reuse: none. CONFIRMED. Five opens in one process run the chain five times.
Cost per open: about 6 ms cold vs 0.24 ms for a bare open, and about 1.1 ms warm vs 0.035 ms (MEASURED).
Per SessionStart: 12 opens, 4 of them full-chain, about 26-72 ms (DERIVED). That is under 1% of a 2.7-4.4 s SessionStart.
Call sites: 141 lines in 76 files (text search; exact count not measured).
Consequence: T09 is wasteful but cheap per open. For speed it drops out of the top tier, and plan 09 decides. The audit's "about 60 statements" counted queries and prepares as well as exec calls; use the measured 20 exec calls.
Not yet measured: lock contention. installChangeLog takes BEGIN IMMEDIATE on every open (room-change-log.cjs:120), read-only callers included, with a 5 s busy timeout. Measurement 3 in this report (a reader timed while a second process holds the write lock) tests that tail-latency risk. It is not covered by the plan-07 averages.
~~~~

## C1. B2 analysis and T02-T05 design

Source: pasted by owner, auditor text, not owner authority

~~~~text
'd pick option 1: B2 check first, then measure T02–T05. I've already done the read-only half of the B2 check. It makes B2 look more likely to be real.B2: what the code shows (read only; I couldn't run it, details at the end)No guard in the write itself. brain-client.cjs:1902 write() passes the Cypher straight to callTool('brain_write', { cypher }).The guard in callTool lets it through. classify() (part8-egress-guard.cjs:1184) runs these checks in order on a brain_write:The forbidden-pattern scan (cross-room-aggregator.cjs:92) only catches PII-like text: emails, money amounts, phone numbers, "meeting with", a name followed by a degree. A normal hypothesis sentence passes.It isn't a packet: there are no packet_version or job keys.The room-content check is skipped. _isFreeFormTool (line 335) covers only brain_ask, brain_query and brain_search. So brain_write never gets the room-provenance check, even though its payload key is cypher.No known-shape rule exists for brain_write.The result is "ambiguous". callTool then sends the request anyway (disposition: 'proceeded'), as decided in Phase 254, COMP-02, Option A. The PreToolUse hook only stops "ambiguous" calls that the model makes itself. This one comes from a node script that discovery-cycle.cjs:446 spawns, so nothing stops it.New: the guard fails open. If the guard module fails to load, callTool catches the error and carries on unguarded (brain-client.cjs:474-477: "degrade to existing behavior"). The guard's import chain runs through folder-memory → navigation → room-skeleton-scaffold.cjs:36 require('gray-matter'). That's the exact failure I hit in this sandbox. On a normal install the dependencies are present, so this only matters on a broken install. Still, the Part 8 safeguard depends on about 120 modules and npm packages loading. The lazy-import fix (N1), or moving the patterns into a small standalone module (C2-03), would shorten that chain.Not verified:the actual classify() result. I couldn't run it because the sandbox has no node_modules, and I don't install packages;whether Theo offers brain_write. That's in data/brain-surface-contract.json, which I didn't open;how often the trigger conditions occur: validated zones, the daily cap, the Brain being available.How you can settle it in minutes, using your dev environment, no room content and no lock:run classify({ cypher: <a made-up MERGE with a neutral hypothesis> }, { toolName: 'brain_write' }). My reading predicts ambiguous;check whether brain_write is in the Brain surface contract or Theo's tool list.If both say yes, B2 is a real Part 8 hole, not a hypothesis. It goes first in the bug phase, ahead of any speed fix that touches the egress guard.For the T02–T05 measurement plan (after plan 08 frees the lock)T02 (operator-update): pipe a PostToolUse payload with a registry made by scripts/room-registry. Use at least 7 runs, interleaved with floor:node, and record which line it exits on. Cost per session = (median − floor) × events from frequency.json.T03 (lazy import): compare --tree with --tree-b, where folder-memory.cjs:268 and the async twin are made lazy. Targets: the context-monitor statusline, the on-stop snapshot block, and brain-derivation-drain with an empty queue. Add module counts with count-modules-preload.cjs.T04 (cascade skip): watch one trap. The fixture room must use the default layout, with no /room/ or /rooms/ anywhere in its path. If the fixture sits under a rooms/ directory, the cascade runs in full and you'll measure the wrong thing. Confirm skipped:true in the output first.T05 (doctor scan): time hmi-compliance-poll --hook with a Stop payload and an active room, then time doctor --ui-compliance alone.Same rules as plans 07 and 08: no product file changes, and T03's lazy require lives only in a scratch tree.
~~~~

## C2. Yes-go message

Source: pasted by owner, auditor text, not owner authority

~~~~text
My answer is yes, go, with two changes.

Check B2 before the speed work, not alongside it. I can do part of that check right now, read-only.
Define what "measure T02–T05" means up front, so plan 09 gets numbers it can actually rank.

First the B2 check: does the Part 8 guard block a brain_write that carries room-derived hypothesis text?
~~~~

## D1. Six patterns interim report

Source: pasted by owner, auditor text, not owner authority

~~~~text
Your feeling is right, but the cleanup is concentrated. Nine of the 13 slices are back with 108 findings, and most of them trace back to about six patterns, so fixing those patterns clears most of the list. None of this is final: these are read-only findings, I've checked two of the most striking against the code myself, and the formal top-10 check comes when the run finishes.

The six patterns behind most findings

Every hook redoes the same setup. One file save starts 8 separate processes and each one starts from zero: it reads its input again, finds the active room again, and re-reads the same files. There are at least 6 separate "which room is active" lookups, and some of them disagree with each other. resolve-room even starts Python to read one JSON file. This pattern accounts for your 36 programs per save and 44–45 per SessionStart.
One import line loads about 50 modules. lib/core/folder-memory.cjs:268 loads a timeline module. That module loads navigation.cjs, which loads 52 more (I checked all three). The statusline only needs two small functions from folder-memory, but it loads all of this on every redraw. So does every Stop, and three separate SessionStart processes. The repo's own comment puts this load at 96–191 ms per process. Making that one import lazy would likely be the cheapest big win in the audit.
Every database open runs the full setup. Each open of the room database runs about 60 setup statements and takes the write lock, even when the caller only wants to read. This happens on every prompt, every Stop and many MCP tools.
Nothing checks whether anything changed. Work runs every turn whether or not the room changed: the Stop wrap-up, a references rebuild per section, rendering briefs and then discarding them, rewriting every section's FEYNMAN.md, and a full security scan at every start. Several queue drains load heavy modules before they check whether the queue is empty. Compaction replays the whole startup, and sometimes runs it twice.
Some hooks run but do nothing.
operator-update.cjs fires on nearly every tool call, every prompt and every Stop. I confirmed it expects an old registry format (active_room with a list of rooms), while scripts/room-registry writes active with a keyed object. It never finds a room, so the feature is silently off and you pay for the process each time.
The query telemetry hook does nothing for Read.
The slash-command telemetry hook waits for an environment variable that nothing sets.
The post-compact context file is written but never successfully read.
The same work is done twice. Each write is committed by two different git mechanisms to two different branches. The write cascade runs analyze-room twice (report-only area) and rebuilds dashboard/graph.json, which nobody reads before it's regenerated. The Stop wrap-up exists once in bash and again in the MCP server.

Then there's ordinary dead code: modules with no callers, 7 check-* scripts that only tests call, and two wiki routes that can never be reached. That's real cleanup but lower value.

Bugs, not just waste. Some findings are correctness problems, which makes the cleanup more than a speed issue:

Compaction creates two session rows.
A broken environment-variable assignment means a session-start branch can never run.
The "3 strikes" dismissal for ambiguous items counts compactions instead of sessions.
The cascade reports "complete" when it skipped.
Completion records can be duplicated.
A hidden wiki chat route would send room content to outside APIs if anyone reordered the routes.

Suggested order: patterns 2 and 5 first, because they're small edits with wide reach. Then pattern 3 (one fix in room-db.cjs helps every caller), then pattern 4 (adding "did anything change" checks). Pattern 1 (merging hooks) pays the most but is the biggest change, so it should come after measurement.

Still running: slices C3, X1, X2 and T1, then the five cross-slice lenses, plus R1 (systems you may not need). When they're done I'll merge everything, re-check the top 10 against the code and give you the final report with the first three measurements to run.
~~~~

## D2. Follow-up on import chain and operator-update

Source: pasted by owner, auditor text, not owner authority

~~~~text
I agree with measuring first. I'll write the final report so each top-10 finding can go straight into plan 09 next to your numbers.

I can extend your partial check. I read the rest of the chain myself:

lib/core/feynman/timeline-runner.cjs:25 loads ../navigation.cjs when the module loads.
navigation.cjs lines 20–80 contain 52 require( calls.

So folder-memory → timeline-runner → navigation → 52 modules is confirmed. The transitive total (the slice agents' static scan put it at about 120 files and 46k lines) is still unchecked. Your harness number of about 49 ms of module load in a 74–78 ms hook fits this pattern, but only a with-and-without timing would prove the cause.

Two points for your decisions:

operator-update: repairing it isn't free. The H3 agent pointed out that fixing the registry read would turn on behaviour that has been dormant. That means operator transitions on every prompt, plus database writes through navigation.cjs. So the per-call cost would go up, not down. Removing the hook, or narrowing it to the tools that need it, saves the cost. The real question is whether you want the feature on at all.
The wiki route is a latent leak, not a live one. The BYOAPI proxy at lib/wiki/wiki-server.cjs:657-713 can't be reached today, because the handler at line 169 always answers first. It becomes a Part 8 leak only if someone reorders the routes. Deleting it closes the risk. Putting it first in the bug phase is still right, because a cleanup could revive it by accident.

For plan 09, I'll give each top-10 finding:

the file:line after my re-check, marked confirmed, corrected or dropped;
which harness target it maps to (a hook ID, scan:*, or floor:node as the baseline);
a with-and-without comparison that would confirm or refute it.

The first three measurements will match your order:

The lazy import.
operator-update's cost per call.
One database open, timed with the setup chain against a fast path.

Still running: C3, X1, X2 and T1, then the five lenses, plus R1. I haven't changed anything in the repo.
~~~~

## D3. Overstated owner guidance (retracted)

Source: pasted by owner, auditor text, not owner authority

~~~~text
New guidance from the owner, which changes how to frame verdicts. Please apply it to the report you are writing. The owner names these as the plugin's core systems: (1) ICM, the folder-structure memory: ROOM.md/STATE.md/MINTO.md per directory, read through lib/core/folder-memory*.cjs; (2) the LOCAL graph: room.db through lib/core/navigation.cjs, navigation/, lazygraph-ops.cjs, room-db.cjs; (3) the REMOTE graph: the Brain/Theo via lib/core/brain-client.cjs and the mindrian-brain MCP shim; (4) the Eureka engine, which the owner calls primary: lib/mcp/tools/eureka-*.cjs, gated in code by MINDRIAN_EUREKA_ROOT. Consequences: none of these four gets a 'dead' or 'not needed' verdict as a system. Inside them, still report duplicate implementations, such as several graph builders writing the same local graph, two memory folders, or several room resolvers, and say which copy looks canonical. For LazyGraph specifically, separate 'the local graph is core' from 'the LazyGraph name or module layer may be legacy': report what LazyGraph is today relative to navigation.cjs and room.db. Neo4j stays the user's optional external graph, distinct from (2) and (3). Add one short section on Eureka: how a normal install reaches it (MINDRIAN_EUREKA_ROOT, uv, Python, pyproject.toml), what a user without it gets, and whether anything in the plugin sets or documents that variable. If Eureka is primary but off by default, that gap is a finding. Everything else in the task stays the same.
~~~~

## D4. Correction and R1 verdict summary

Source: pasted by owner, auditor text, not owner authority

~~~~text
The "new guidance from the owner" came from me. I wrote it, and I overstated it.

The source. It's one user message in this session, the one after your plan-09 message. Here it is exactly:

"the two imporatatn patrs are the icm (i thinkg) the local grpah, the remote graph and the eurika engine (primery)"

I have no clock, so I can't give a time. It was the message I answered with "I'll take this to mean these four are the core systems…".

What I added when I passed it to R1:

"Core systems, protect them rather than remove them": my interpretation. The message says "important parts". It doesn't say "never mark dead".
"None of these four gets a 'dead' or 'not needed' verdict as a system": my rule. The owner never said that.
"Eureka, which the owner calls primary": based on "(primery)". It's unclear whether that word refers to Eureka alone or to the list.
The file mappings (ICM → folder-memory*.cjs, local graph → navigation.cjs/room-db.cjs, remote → brain-client.cjs, Eureka → eureka-*.cjs): mine.
Neo4j as optional and separate: from your earlier R1 table ("The user's optional graph"), not from this message.

I also told R1 the message was owner guidance. In fact I didn't know whether it came from the owner or was relayed. I'm sending R1 your correction now, word for word in substance. R1 is still running, so the correction arrives before it writes the Eureka addendum.

@r1-unneeded-systems

Correction to my previous message ("New guidance from the owner"). That message overstated its source. It was my own interpretation of one short user line that named ICM, the local graph, the remote graph and the Eureka engine as important. The "never dead" rule and the claim that Eureka is primary were my additions and have not been confirmed by the owner. Until the owner confirms in their own words, replace that guidance with the following. 1. Do NOT assume Eureka is primary. Report what you find in the code: how a normal install reaches it, what a user without it gets, and whether anything sets or documents MINDRIAN_EUREKA_ROOT. 2. Judge every system by evidence only: callers, replacements and cost. Mark each verdict on ICM, the local graph, the remote graph and Eureka with "owner-declared core: unconfirmed". If the evidence says a part is dead, say so. 3. Still report duplicate implementations inside those systems (graph builders, memory folders, room resolvers), and say which copy looks canonical. 4. For LazyGraph, keep two questions apart: is the local graph core, and is the LazyGraph module layer legacy? 5. Neo4j is the user's optional external graph, separate from the local and remote graphs. Do not change any other part of your task. If you already wrote anything to /tmp/audit01/R1/r1.md under the earlier framing, revise it to match (overwrite the file), and in your reply list which verdicts changed.

↑ 228.3K
↓ 1.5K

I've sent R1 the correction with your five rules. It will rewrite r1.md if it already used the old framing, and its reply will list which verdicts changed.

How much the slip affected:

The main workflow: not at all. It started before that message and never saw the "core systems" framing.
R1's first report: almost certainly not. It came back without any Eureka section, which suggests it hadn't acted on my message yet. Its verdicts there rest on evidence: "LazyGraph: required" because room-db.cjs:31 loads it, Neo4j treated as separate, Pinecone and Memgraph marked dead.
My summary to you a few turns ago: I described Eureka being "primary but off by default" as a likely product gap. Treat that as unconfirmed too.

Answer for your Downloads files: "not mine". The owner wrote the one short message I quoted above. The "core, never dead" ruling, "Eureka primary" as a rule, and the file mappings were my inferences. Keep them out of the files until the owner confirms in their own words.

Still running: the main workflow and R1's revised answer. When both are back, I'll merge them and give you the final report.
~~~~

## D5. Review of definition

Source: pasted by owner, auditor text, not owner authority

~~~~text
The system resent your earlier "Fixed" message. I answered it last turn and nothing has changed: the Eureka question is still the owner's to answer.

On the definition you pasted: it's mostly right. Fix the first four items before you use it.

Fix before use

L6 and L7 are named but never defined. The R1 heading says "extra slice R1 and lenses L6, L7", but only L1–L5 exist. Either define them (for example L6 = dependency reach, L7 = superseded system), or drop the mention. Otherwise each agent will make up its own.
The verification step was dropped. The old plan's Phase 3 said to re-open the file:line of every top-10 candidate and drop or correct any that don't match. That step is what catches wrong rows. In this run it caught M1's Eureka count: M1 said 17 modules, there are 16. The new version also lost two other rules: one failing agent must not fail the run, and search before reading. Please restore all three.
"Audit claim was about 50" doesn't match the audit. H1-01 said about 40 foreground node processes in scripts/session-start alone, not counting the other 8 SessionStart commands. Your 44–45 covers all 9 commands, so the two numbers aren't in conflict. The context pack is labelled "ground truth", so it shouldn't contain a misquoted audit claim. Remove the sentence or correct it.
The SubagentStop line could mislead. "About 8-9 node starts per modified file" and "2,604 processes for 1 file" together mean about 2,600 processes per file, of which only 8–9 are node. The rest are bash, jq, dirname, git and so on. Say that explicitly. Also, scripts/on-agent-complete:75 stops at 20 files (head -20), so 17,232 is the most one SubagentStop can produce, not a sample from a growing curve.

Worth adding
5. Facts that are already confirmed, so the next run doesn't spend effort re-proving them:

scripts/operator-update.cjs:106 expects active_room plus a list of rooms. The real registry has active plus a keyed object, so it returns nothing. You confirmed this, and so did I.
scripts/hmi-status-command.cjs:101 has the same bug, but only a test runner calls it. I confirmed this.
folder-memory.cjs:268 loads timeline-runner.cjs, whose line 25 loads navigation.cjs, which has 52 require( calls. You confirmed the first link; I confirmed the rest.
lib/graph/ exists, but it's UI code, not a graph store: canvas-graph.js, constellation-config.cjs and graph-detail-panel.js. Say so, or agents will go looking for a sixth graph system.
__pycache__ is in the skip list, but R1 asks about it. Two __pycache__ files in scripts/__pycache__ are committed to git. That's a small finding in itself. Suggested wording: "Don't read __pycache__ contents, but report any that git tracks."

Optional
8. Read-only is enforced only by the prompt. agent_toolset with permission_policy: auto includes bash, write and edit. If your platform lets you configure individual tools, turn off write and edit. It still can't push, because it has no credentials.
9. This run's results won't carry over. They're in /tmp/audit01/ inside this session's container, which a new session won't see. If you want a new run to build on them, paste R1's 15 rows (or whatever you choose to keep) into the context pack. Otherwise drop R1 from the next run, since it's already done.

The main workflow is still running (C3, X1, X2, then T1 and the five lenses). I'll send the final report when it ends.
~~~~

## D6. R1 update, Eureka gap

Source: pasted by owner, auditor text, not owner authority

~~~~text
I've updated /tmp/audit01/R1/r1.md (about 69 KB, overwritten) and sent the coordinator the list of changed verdicts. Everything was read only and nothing was timed. The plugin repo is unchanged.

Verdicts that changed

Eureka, both layers: now "required as a capability (owner-declared critical: confirmed)".
The in-plugin layer still installs its ~380 MB encoder only when the user asks (/mos:eureka enable or doctor --fix eureka).
The external engine is still off by default on every normal install.
ICM, the local graph and the remote graph: the tag changed from "core: unconfirmed" to "owner-declared important: unconfirmed". The verdicts themselves did not change; all three are required on the evidence.
LazyGraph stays split: the local graph is required; the module is live but its name is legacy.
Neo4j stays the user's optional external graph.
R1-15 (the gap) is no longer conditional. On a normal install:
Nothing sets MINDRIAN_EUREKA_ROOT: no .mcp.json entry, no setup or doctor step, no installer.
It is documented only in "advanced" sections of commands/eureka.md, skills/eureka/SKILL.md and one integration doc.
All 23 tools still register, and 19 of them refuse.
R1-12 is now "duplicate code inside Eureka". Its old content moved into R1-10, which now covers every duplicate or uncalled local-graph builder. No other finding was renumbered.

Tool count: I confirm 23 distinct tool names in the code, the same as your count. There are 24 distinct quoted eureka_* strings, but the extra one, eureka_job_store_only, is a stored-state label, not a tool. That may be where the owner's "24" came from. Only a runtime tools/list settles it.

Duplicate code inside Eureka (I re-checked the M1 ranges; they hold):

Two identical response decoders: eureka-capability-run.cjs:36-51 and eureka-graph-analyze.cjs:62-77. Keep the capability-run copy, which capability-jobs already imports.
The root check, written 4 times. Keep configuredRoot() in eureka-capability-jobs.cjs.
The job-polling loop, written twice: capability-run.cjs:97-152 and graph-analyze.cjs:135-197. Keep waitForJob, but carry over the scout's own timeout variable and its "model unavailable" message.
Smaller repeats: the list of finished-job states appears 3 times, the timeout clamp 4 times, and the catalog/contract fetch twice.
New engine process per call: each workflow call starts a fresh engine process. genesis_plan and opportunity_scout start two per call. Only capability_start keeps a session open.
Projection before the root check: all 17 graph tools open room.db and build the room projection before checking the engine root. On an unconfigured install they do that work and then refuse.
Three implementations of the same algorithms: RS/HSI/whitespace code exists in in-repo Python, in-repo JavaScript ports, and the external engine. The code doesn't show which is meant to be canonical, so I left it undecided.

Without the engine, tool by tool:

Result    Tools
Works (still needs a bound room)    eureka_graph_project
job_session_not_found    job_status, job_result, job_cancel
engine_not_configured    capability_run, capability_start, and the 17 graph tools

Start-up cost:

No engine process starts when the MCP server boots.
All 16 modules (124,729 bytes) still load at boot.
They are the only modules in the MCP server that load @modelcontextprotocol/client.
About 7,031 characters of tool description text ship in tools/list whether or not the engine is configured.
Timings and the byte size of tools/list: not measured.

The coordinator's copy also lists the exact line ranges and the files in /tmp/audit01/R1/.
~~~~

## E. Auditor question list

Source: pasted by owner, auditor text, not owner authority

~~~~text
Yes. Here are questions you can ask now. They come from what I've already seen in the code: the hook wiring in hooks/hooks.json, the latest commit, and the existing OPTIMIZATION-REVIEW.md. None of them depend on audit findings, because I don't have any yet. Once the run finishes I'll add a second set tied to specific file:line findings.

How often things really run (this sets the ranking)

SessionStart is set to fire on startup|clear|compact, so all 9 startup commands run again after every compaction, and then PostCompact fires as well. Is re-running everything after a compaction intended, or should only some of them run?
operator-update.cjs runs after nearly every tool call and also on every prompt and every Stop. What does it need to stay current at that rate, and would updating once per prompt or once per Stop be enough?
A single Write or Edit starts 8 separate node processes (7 write hooks plus operator-update). Were these kept separate on purpose, for example to isolate failures or because hooks run in parallel, or did they just build up over time?
Each user prompt runs 8 commands and each turn end runs 8 more. Do you have a target for how much delay a hook may add per prompt or per turn?
Is the statusline wired to anything in this plugin, and how often does Claude Code call it in practice?

Measurement
6. Where is the timing harness, how do you run it, and does it record per-hook wall time and process count? I can't run it, so all my findings will stay "READ" until someone does.
7. Are there real-world numbers for a typical session: how many SessionStarts, Stops and tool calls, and how many compactions? Even rough counts would make the ranking sharper.
8. The latest commit mentions a "census" with a CPU cap and a "longer gate for SubagentStop rounds". What problem prompted that? Was it slow hooks or CPU spikes?

Intent behind duplication
9. Several parts of the plugin seem to deal with graphs or derivations: lazygraph, navigation, gsd-graph-derive (it has both a drain and a sweep), and memory-artifact-graph. Are these meant to be separate systems, or is one meant to replace the others?
10. There's both lib/memory/ (172 files) and lib/core/memory/. Which one is the current one?
11. Which of the roughly 55 scripts/check-* files are still used, and which ones are run by CI, doctor or release? Only 4 are wired to hooks.

Dead code and boundaries
12. Is any code loaded only through registries, built-up require paths, or node ${CLAUDE_PLUGIN_ROOT}/... lines in markdown? I want to avoid calling something dead when it's actually reached that way.
13. mcp-dep-heal.cjs and the room-scan and room-render-analyze spawns are report-only in this audit. Why are they off-limits, and who owns them?
14. OPTIMIZATION-REVIEW.md is from April 2026. Which of its items were done, rejected, or are still open?

Risk of change
15. Which hook outputs do users or other tools rely on, such as files written, telemetry or auto-commits? Those can't change even if the hook gets combined with another or deferred.
16. Is there test coverage that would catch a regression if two hooks were combined or a SessionStart step were deferred?

If you only have time for three, ask 6, 2 and 3. Their answers will decide which of the audit's findings are worth measuring first.
~~~~

## F. Auditor egress audit, final message

Source: pasted by owner, auditor text, not owner authority

~~~~text
All five egress auditors finished, and none failed. Reading their results. I'll re-check the most important claims myself: re-run the key probe cases on the real classifier and re-open the main lines. [tool activity omitted]

I've finished the Part 8 egress audit, and the report is in egress-audit-report.md. All five auditors finished. I re-ran the key cases on the repo's real classifier myself: in a sandbox, with no network, no room content and only fake secrets. The repo is still unchanged.

Your team's diagnosis is right on both counts, but it isn't one blunt classifier. It's four problems stacked:

One set of rules does two jobs. The checks that look for room words (the lexicon, the capital-letter name rule, "my/our" phrasing) are also the only thing catching secrets. They catch a key only by accident: when its body is upper case, or when it looks like a name. So each fix for over-blocking quietly reopens a leak, and the other way round.
"Ambiguous" means different things at each layer. A tool with no "this is safe" rule falls to ambiguous. On the plugin's own Brain server, the hook and callTool both send it. On other Brain connectors the hook blocks it. That's why lookups die on one route while room text leaves on another.
The guard fails open. If it throws or fails to load, the hook exits 0 and callTool sends anyway. It loads 127 modules plus an npm package, so there's plenty to fail.
Tests count "not allow" as safe, even though ambiguous calls get sent. The release gate even requires the two known leaks to stay allowed.

What kills Theo and context lookups (confirmed on the real classifier):

Typed Theo tools have no "safe" rule: normalize_framework_name, discover_structure, search, askOp and others. On a direct connector they're blocked whatever you write; rewording can't help. This is the root cause of the PENDING pws-brain-mcp debug file.
The name rule is a capital-letter test. It blocks authors (Christensen), companies, months, places, and the plugin's own nouns (Larry, Data Room). The lower-case version of the same question passes.
Ordinary business words are on the deny list: runway, ARR, standup, "meeting with", "80 percent", and a list of city names. "My team..." questions and an unreadable room.db block almost everything, and the unreadable-database result is cached until the files change.
Online research: I found no content over-blocking on the web research lines, because since 2026-10-05 they only check credentials. If online research is failing, look at the research grant step, not the guard.

What can leave:

New: adding a job key to a brain_ask or brain_query payload flips a block to allow. Every content rule is skipped. The plugin's own Brain server should reject the extra key; other connectors and in-process callers aren't covered.
brain_write (B2) passes both layers on the plugin's own server. An automatic chain sends room-derived whitespace data to Theo after a room write, at most once a day. Theo has no write path and refuses it, but only after the data has already left.
No rule for keys or spelled money. A lower-case sk- key, "two million dollars", "750k" and "40%" all pass. On brain_write and packets, 21 of 22 key shapes pass. The web-line check catches only 2 of 22. Splitting words with a newline also beats the deny list for non-question tools.
Paths with no check at all: Semantic Scholar: room titles and the room name. grants.gov: problem-statement words. research-speaker: meeting participants' names go to Google before the user is asked. WebSearch, WebFetch and Tavily: no hook inspects them.

Your items 3-6:
Item 3, a check that never runs: onFailure:block in hooks.json never engages, because the script swallows errors and exits 0.
Item 4, a test that can't fail: 8 test files assert only "not allow", and one test asserts that a canary reaches the wire.
Item 5, the refusal repeating the flagged word: that holds; refusals name the kind and the count, never the word.
Item 6, a fix on main isn't live: add a check against the released version, because every install keeps the current guard, including the daily write, until users pick up a release.

Root causes for the two PENDING debug files are in section 6, ready to paste.

Two things for Phase 386:
Order matters for step 4. Add the "this is safe" rules for the typed Theo tools first, then make "ambiguous" a block. The other way round kills the whitespace baseline, framework chains and the framework-name refresh: the next over-block.
Step 3 needs a ruling first. Since the 2026-10-05 navigator ruling, the web research lines send room words on purpose (only credentials are checked). That contradicts your Part 8 statement. Until the owner decides, moving Semantic Scholar "behind the chokepoint" adds a grant and a credential check, not content protection.

Not covered: The hook itself, the test suites and the fetchers weren't run. How a user-registered "mindrian-brain" connector is named is inferred, not verified. Whether other connectors reject the extra job key is unknown. Bound-room probes used synthetic rooms only.
~~~~

## G. Second auditor handoff (older commit 72b0eed8)

Source: pasted by owner, auditor text, not owner authority

~~~~text
MindrianOS audit handoff. Audited a fresh clone at SHA 72b0eed8bbc16001592bc9bd11f3b05695a8d5f1 using Node v22.23.1. npm ci --ignore-scripts succeeded. No hooks, product scripts, fetchers, test suites, or live APIs were run. The probe corpus used invented fixtures only.
Findings to prioritize:
- Packet bypass: brain_ask and brain_query payloads that include job: "select_methodology" can carry arbitrary question or Cypher text and still classify as allow / move_set. Packet proof checks the job, summaries and handle fields, but not arbitrary sibling fields.
- Ambiguous writes can pass: brain_write is not routed through theoVerdict. Its ambiguous result can proceed through the shim's PreToolUse handling and the callTool belt.
- Additional room-data egress: the on-demand wiki briefing sends room-derived content to Anthropic when configured with a key, without a Part 8 room-content check. Entity classification and chat also send names, excerpts or conversation content to Anthropic without that shared check.
- Over-blocking: 37 of 535 extended generic questions were blocked (36 as room_content/name, 1 as content_set) across brain_ask, brain_search and brain_query. This was the same with no room and a clean synthetic room.
- Fail-closed room check: a malformed synthetic room DB blocked 534 of 535 extended queries as room_check_unavailable.
Claim comparison: the claim-by-claim file covers all 46 IDs. Notable divergences: R-f is refuted because scripts/pycache is absent and untracked at this SHA; R-b and R-c are partly confirmed due remaining references; R-g's runtime counts were not executed; E-h measured 172 loaded repo modules and 56.63 ms for one cold guard load; E-k is partly contradicted, including the count of files matching the exact verdict assertion.
The PENDING debug hypotheses are explained in the report: generic framework tools are ambiguous on the non-shim pws-brain-mcp scope, and case-sensitive identifier detection plus missing spelled-money patterns allow some inputs through. Packet sibling-field bypass is a broader issue.
~~~~

## H. Third external audit handoff (pinned baseline 72b0eed8)

Source: pasted by owner, auditor text, not owner authority

~~~~text
# Main developer handoff

The pinned-baseline audit is documented. Implement the accepted Phase 386 hardening, then complete the controlled Phase 387 fresh-install check.

## Current state

- Baseline: 72b0eed8bbc16001592bc9bd11f3b05695a8d5f1.
- The audit bundle contains the blind report, 31 claim verdicts, and 15 synthetic classifier probes.
- No pinned plugin source was changed. The Phase 386/387 planning updates are staged, not committed: the 386 PRD, plans 386-35 and 386-36, and the 387 PRD.
- Fresh-install tools/list returned 75 total tools and 24 distinct eureka_* names. eureka_critic is registered outside the 16-file auto-discovery set and succeeds with synthetic input and no engine or room. The graph projector still needs a synthetic bound-room check.

## Work to implement

1. Phase 386-35: lazy import. Move the top-level timeline-runner.cjs require in lib/core/folder-memory.cjs into extractFeynmanBody() after a successful file read. Preserve parsing and fallback behavior. Count modules in fresh processes for scripts/context-monitor and lib/core/part8-egress-guard.cjs before and after. The in-memory audit simulation measured 181 to 17 modules for the statusline and 172 to 10 for the guard, with navigation absent after. Reproduce those counts during implementation. This belongs in Part 8 hardening even below the 50 ms speed floor because it reduces the shared fail-open dependency chain.
2. Phase 386-31, then 386-36: credential checks. Plan 386-31 owns the shared credential-shape list and auditWebCredential. Plan 386-36 adds PreToolUse coverage for WebSearch, WebFetch, and mcp__tavily__.*. Use only the shared credential checker; block credential-shaped strings without echoing them; allow ordinary names, places, company terms, and room words.
3. Keep the web-path ruling. Plans 386-22, 386-23, and 386-24 cover Semantic Scholar, grants.gov, and research-speaker. Each needs an approval card, credential check, and audit record, with no room-content scan. Research-speaker asks before sending. Keep this separate from the native-tool hook.
4. Phase 387: fresh-install reachability. Set MINDRIAN_EUREKA_ROOT unset and ensure no Eureka checkout is discoverable. Count distinct names from runtime tools/list, use a scratch HOME, and record unbound results separately. Test room-dependent calls against a synthetic bound-room fixture so a missing room is not mistaken for a missing engine.

## Verification

- Plan 386-35: run node tests/test-386-folder-memory-lazy-navigation-load.cjs. Confirm navigation and timeline-runner are absent at startup for both entrypoints, while FEYNMAN parsing and the unreadable-file fallback remain unchanged.
- Plan 386-36: run node tests/test-386-web-credential-guard-hook.cjs and parse hooks/hooks.json. Confirm all three tool families match, fake keys block, ordinary content passes, refusal output contains no key, and the network counter stays zero.
- Follow the verification sections in plans 386-31, 386-22, 386-23, and 386-24, plus the egress suites required by 386-PRD.md. Use synthetic fixtures and fake secrets. Put no room content in tests, logs, or commits.
- Phase 387 records the exact root, checkout, room-binding, HOME, and network conditions. Its current no-room runtime baseline is 75 tools total and 24 Eureka-prefixed names.

> Non-negotiable: Web lines get credential checks only. Room words continue through the normal approval flow; credentials do not.

## Keep, replace, defer

- Keep: the lazy import as Phase 386 hardening; credential-only checks on native web tools; approval and audit records for the three older web paths; the Phase 387 fresh-install fixture conditions.
- Replace: the old count of 23 Eureka tools with the measured runtime count of 24 at this baseline. The extra tool is eureka_critic.
- Defer: S3 database lock contention and read-only database routing. S3 is not measured. BEGIN IMMEDIATE alone does not prove contention or impact; average open times do not close it.

## Audit limits

The original R1 report was absent from local files and Git objects. R-a through R-h are reconstructed from the available Eureka summary. The egress source has a-h claims, not the requested E-a through E-m labels, so that mapping is also an inferred crosswalk. The 15 probes match reported inputs and verdicts in the local egress check, but its original standalone fixture was unavailable. Keep these limits attached to later summaries.
~~~~
