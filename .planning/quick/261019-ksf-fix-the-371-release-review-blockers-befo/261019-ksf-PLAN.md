---
quick_id: 261019-ksf
phase: quick-261019-ksf
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
canon_parts: [9]
requirements: [371-REVIEW-CR-01, 371-REVIEW-CR-02, 371-REVIEW-WR-02, 371-REVIEW-WR-01, 371-REVIEW-IN-02]
files_modified:
  - lib/mcp/tools/gate.cjs
  - lib/core/session-binding.cjs
  - lib/core/navigation/room-workday.cjs
  - lib/core/navigation.cjs
  - lib/mcp/startup-operations.cjs
  - lib/mcp/tools/startup.cjs
  - tests/test-startup-flows.cjs
  - lib/mcp/tools/room.cjs
  - tests/fixtures/267/wire-snapshot-zod4.json
  - tests/fixtures/267/wire-snapshot-zod3.json
  - tests/fixtures/267/zod4-accepted-deltas.json
  - tests/fixtures/tool-honesty/276-dispositions.json
  - tests/test-366-semantic-index-integrity.cjs
must_haves:
  truths:
    - "A navigator bound to room A who prepares and approves room B leaves zero rows in A's room.db that carry B's gate id, B's name or B's purpose (CR-01, Canon Part 9)"
    - "A briefing for room A never lists the creation card of room B under Pending decisions (CR-01)"
    - "On one stdio connection, a second room_bind followed by room_startup opens a new visit: new visit_id, later opened_at, the work logged since the first visit in changes.items, and a live next-move card (CR-02)"
    - "A room_startup retry inside one binding keeps the same visit_id, opened_at and next-move gate id (retry stability kept)"
    - "A retried briefing does not list its own next-move card under Pending decisions; other open gates still show (WR-02)"
    - "The live room_list description carries the ruled sentences: This runs on your machine from Claude Code. Open Claude Code on this computer and run /mos:dashboard shell to see your room in the browser. (navigator ruling, arm 6)"
    - "The 267 wire pins and the 276 frozen sweep move only for proven 371 deltas (room_create, room_startup membership; room_list and room-dashboard descriptions)"
    - "The test-366 integrity gate gives leg I3 300000 ms"
  artifacts:
    - path: "lib/mcp/tools/gate.cjs"
      provides: "_onGateMinted skips creation gates"
      contains: "entry.roomCreation === true"
    - path: "lib/core/session-binding.cjs"
      provides: "readSessionBindingGeneration reader of the binding file updated stamp"
      exports: ["readSessionBindingGeneration"]
    - path: "lib/core/navigation/room-workday.cjs"
      provides: "visit id scoped to the binding generation; workdayGateId helper; own card removed from pending"
      exports: ["startRoomWorkday", "workdayGateId"]
    - path: "tests/test-startup-flows.cjs"
      provides: "three new legs: secondRoomStaysLocal, rebindOpensNewVisit, retryHidesOwnCard"
  key_links:
    - from: "lib/mcp/tools/startup.cjs"
      to: "lib/core/session-binding.cjs readSessionBindingGeneration"
      via: "bindingGen passed in the startRoomWorkday opts"
      pattern: "bindingGen"
    - from: "lib/mcp/startup-operations.cjs nextMoveForWorkday"
      to: "lib/core/navigation.cjs workdayGateId"
      via: "one gate id formula shared with room-workday.cjs"
      pattern: "workdayGateId"
---

# Quick 261019-ksf: fix the 371 release-review blockers before the v2.0.0-beta.71 cut

<objective>
Fix the blockers that the release review found in the Codex Phase 371 startup commits, so that the main session can cut v2.0.0-beta.71.

Purpose: CR-01 writes room B's name and purpose into room A (Canon Part 9 locality breach). CR-02 gives every later chat on one stdio server process the first chat's frozen briefing and no next-move choice. WR-02 shows the briefing's own card as a pending decision. The navigator ruled: fix, then cut, and restore the ruled Desktop sentences in the room_list description.

Output: 6 commits on main (3 in Task 1, 1 each in Tasks 2, 3 and 4), 3 new test legs in tests/test-startup-flows.cjs, re-baselined 267 and 276 pins (conditional), and a green run of tests/run-all-371.sh and tests/run-all-366.sh.

Source of truth for every finding (file:line, proof, proposed fix): .planning/phases/371-navigator-startup-ui-first-room-and-returning-workday/371-CLAUDE-RELEASE-REVIEW.md. The reviewer probes that prove CR-01, CR-02 and WR-02 are /tmp/claude-1000/-home-jsagi/5a6547a8-8e41-4939-b894-652f80b09af0/scratchpad/probe/second-room.cjs, same-process-workday.cjs and retry-pending.cjs. Use them as the seed of the new legs. If the probe files are gone, this plan states each leg in full.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/phases/371-navigator-startup-ui-first-room-and-returning-workday/371-CLAUDE-RELEASE-REVIEW.md
@lib/mcp/tools/gate.cjs (lines 440-500: _roomForMintedGate, _onGateMinted, _onGateTaken)
@lib/mcp/startup-operations.cjs (prepareRoomCreation sets roomCreation: true; nextMoveForWorkday computes the workday gate id)
@lib/core/navigation/room-workday.cjs (startRoomWorkday: visitId hash, pending list)
@lib/mcp/tools/startup.cjs (room_startup handler and description)
@lib/core/session-binding.cjs (writeSessionBinding stamps updated on every write; readSessionBinding drops it)
@tests/test-startup-flows.cjs (realFlows style: hermeticEnv, StdioClientTransport, unpack, call)

Facts the planner PROVED at HEAD e07bd4a4f (2026-10-19):
- writeSessionBinding writes `updated: new Date().toISOString()` on every write. Every writer is a binding event: room_bind (tool-router.cjs addSessionRoom, which always writes, also for a re-bind of the primary room), birthRoom, room-open, the F.8 session-binding consumer, scripts/reassign-primary.cjs. No writer runs per prompt or per startup.
- navigation.cjs line 127 exposes startRoomWorkday as a lazy wrapper. No test pins the navigation.cjs or session-binding.cjs export list. Only tests/test-startup-flows.cjs reads visit_id. tests/test-371-startup-ui.cjs imports only realFlows and fixtures from it.
- Current reds (Node 24): test-267-mcpv2-registration-api 72/1 (live 50 tools, snapshot 48); test-267-mcpv2-zod4-contract 2/2 (description diffs room_list and room-dashboard; extras room_create and room_startup membership plus the two descriptions); test-267-mcpv2-dual-era 3/2 (the same 4 deltas). test-267-mcpv2-app-views is GREEN 22/0 (it pins no tool count). test-276-tool-honesty-findings-closed 147/4 (room_list HIGH_RISK row, room_search HIGH_RISK row (pre-existing), frozen_sweep tools 45 vs 47, branches 140 vs 142). test-276-tool-honesty-switch-branches GREEN.
- The room_list and room-dashboard description changes since f6bf6cb92 come only from reviewed 371 commits (git log f6bf6cb92..HEAD on lib/mcp/tools/room.cjs and lib/mcp/app-views.cjs: ecde228dc, ec3d56380, cec325d5b).
- The 276 room_list HIGH_RISK row comes from the sentence "Read-only: listing does not bind or create a room and reads no room contents." Restoring the Desktop sentences does not remove that sentence, so the row is expected to stay.
- tests/test-270-tool-schema-budget.cjs uses a 10 percent drift tolerance against the k22 AFTER (59020 bytes). The description edits in this plan add about 400 bytes (under 1 percent).
- tests/test-234-tool-description-floor.cjs caps one description at 2048 bytes.
</context>

## Rules for every task (read before Task 1)

- Use Node 24 for every test: run `export PATH=/home/jsagi/.nvm/versions/node/v24.21.0/bin:$PATH` first in each shell.
- The working tree is shared with other sessions. Do not stage, revert, stash, reformat or commit a file you do not own in this plan. Do not touch the untracked `.icm/` and `docs/design/*` files.
- Before each commit, run `git status --short -- <owned paths>` and confirm each diff is yours. Commit with `git commit --only <owned paths> -m ...`. Do not use `--no-verify`. Do not use `gsd-tools query commit --files` (it sweeps the whole index).
- After each commit, run `git merge-base --is-ancestor <sha> HEAD` and record the sha.
- End every commit message with this line, as the orchestrator specified: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- Use hyphens only. Do not write an em-dash or an en-dash in code, comments, descriptions, fixtures or commit messages.
- room.db writes go only through lib/core/navigation.cjs. This plan adds no new write. Tests log work only through navigation (logMemoryEvent), as realFlows does.
- Do not push. Do not release. Do not touch the real ChatGPT checkpoint (STARTUI371-08).
- Out of scope (report only, do not fix): WR-03, WR-04, WR-05, IN-01 (SRI on the jsdelivr SDK), IN-03, IN-04, IN-05.

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fix the blockers CR-01, CR-02 and WR-02, each with its own test leg (3 commits)</name>
  <files>tests/test-startup-flows.cjs, lib/mcp/tools/gate.cjs, lib/core/session-binding.cjs, lib/core/navigation/room-workday.cjs, lib/mcp/tools/startup.cjs, lib/core/navigation.cjs, lib/mcp/startup-operations.cjs</files>
  <behavior>
    - Leg secondRoomStaysLocal (CR-01): one connection. Create and approve room A (slug room-a), room_bind room-a. Call room_create for name "Secret Beta", purpose "BETA-CONFIDENTIAL purpose text", slug room-b. While B's gate is open, room_startup for A lists no pending decision with B's gate id or a header that contains "Secret Beta". Scan every table of A's room.db: zero rows carry B's gate id, "Secret Beta" or "BETA-CONFIDENTIAL". Approve B (created true). Scan A again: still zero rows.
    - Leg rebindOpensNewVisit (CR-02): one connection. Create, approve and bind room visit-room. first = room_startup. Answer first.next_move.gate_id with chosen continue, verdict approve. Wait 20 ms, log a framework_invoked event through navigation, wait 20 ms. room_bind visit-room again. second = room_startup: visit_id differs from first; Date.parse(opened_at) is later than first; changes.items has an item of kind framework_invoked; next_move.gate_id is a string, differs from the first card, and next_move.status is not answered. retry = room_startup: same visit_id, opened_at and next_move.gate_id as second.
    - Leg retryHidesOwnCard (WR-02): one connection. Create, approve and bind room retry-room. first = room_startup (no answer). gate_render a card with header "Keep the pilot budget?" and options approve and defer. second = room_startup: next_move.gate_id equals the first card; pending_decisions has no item with that gate id; pending_decisions has an item with header "Keep the pilot budget?" (positive control).
    - Each leg fails at HEAD for the reason the review gives, and passes after its fix. realFlows stays green (retry stability, answered status, returning-session pending decision).
  </behavior>
  <action>
Work in 3 sub-steps. Each sub-step is RED, then GREEN, then 1 commit. Do the sub-steps in this order.

Sub-step A (CR-01). In tests/test-startup-flows.cjs, add top-level helpers below unpack. Add openSession(fixture): it connects a Client named ChatGPT with the same capabilities as realFlows connect over a StdioClientTransport with fixture.env. It returns call(name, args) that asserts the result is not isError and returns unpack(result), plus close(). Add createRoom(session, fixture, name, purpose, slug): room_create, then gate_answer approve, assert room_creation.created is true, return the room dir under fixture.dirs.roomsHome. Add roomLeaks(dir, markers): open the room.db with require('../lib/core/room-db.cjs').openRoomDb(dir), read every table name from sqlite_master where type is table, SELECT * from each, and return the rows whose JSON.stringify contains any marker; close the db in finally. Add the async function secondRoomStaysLocal that implements the CR-01 leg in the behavior block, with its own hermeticEnv fixture and try/finally cleanup (close the session, then fixture.cleanup()). Log one PASS line that names CR-01 and Canon Part 9. Change the require.main runner to await realFlows, then the new legs, then browserFlows only with --browser. Add the new leg functions to module.exports next to realFlows and fixtures. Run `node tests/test-startup-flows.cjs` and confirm the new leg FAILS because rows in A carry B's gate id, name and purpose (the probe saw gate_raised and gate_closed). Then fix lib/mcp/tools/gate.cjs _onGateMinted: return early when entry.roomCreation === true, on the same line or beside the existing entry.recovery skip. Add a dated comment (quick 261019-ksf, 2026-10-19, 371 review CR-01): a room-creation card belongs to the room that does not exist yet, so it leaves no record in the session's bound room (Canon Part 9 locality); the take then closes nothing because raisedRoomDir is never set. Do not change _roomForMintedGate or the other mint paths. Rerun and confirm GREEN. Commit only tests/test-startup-flows.cjs and lib/mcp/tools/gate.cjs with the message `fix(quick-261019-ksf): a room-creation gate leaves no record in the bound room (371 review CR-01, Canon Part 9)`.

Sub-step B (CR-02). Add the async function rebindOpensNewVisit for the CR-02 leg in the behavior block. Log the work with require('../lib/core/navigation.cjs'): openRoomDbForCaller(dir), logMemoryEvent(db, 'framework_invoked', { framework: 'Lean Canvas', source_path: 'test:work-after-first-visit' }) asserted ok, closeRoomDbForCaller. If openRoomDbForCaller returns null, set process.env.MINDRIAN_ROOMS_HOME to fixture.env.MINDRIAN_ROOMS_HOME first, as the reviewer probe does. Add the leg to the runner and exports. Confirm RED: the second opened_at equals the first and next_move.status is answered. Then fix, per the review CR-02 fix. In lib/core/session-binding.cjs, add readSessionBindingGeneration(sessionId, opts): it reads the same file as readSessionBinding, returns the parsed updated string when it is a non-empty string, else null, and never throws. Add it to module.exports and do not change the readSessionBinding return shape. Add a short header note: every binding write (room_bind, birth, open, F.8 confirm) stamps updated, so the stamp is the binding generation. In lib/core/navigation/room-workday.cjs, hash JSON.stringify([roomId, sessionId, navigatorId, bindingGen]) with bindingGen = opts.bindingGen when it is a non-empty string, else null. Add a dated comment: a visit is scoped to one binding, not to the process; a stdio session id lives as long as the server process; a retry inside one binding keeps the visit; visits recorded with the old 3-part hash simply serve as the previous visit once. In lib/mcp/tools/startup.cjs, import readSessionBindingGeneration next to resolveEffectiveSessionId and pass bindingGen: readSessionBindingGeneration(sessionId) in the startRoomWorkday opts. In the same file, change the room_startup description sentence "Records one local visit checkpoint per session; retries keep the original baseline." to "Records one local visit checkpoint per room binding: each room_bind starts a new visit, and a retry in the same binding keeps the original baseline." so that the description stays true. Confirm GREEN for all legs and realFlows. Commit only tests/test-startup-flows.cjs, lib/core/session-binding.cjs, lib/core/navigation/room-workday.cjs and lib/mcp/tools/startup.cjs with the message `fix(quick-261019-ksf): scope a workday visit to one room binding, not to the stdio process (371 review CR-02)`.

Sub-step C (WR-02). Add the async function retryHidesOwnCard for the WR-02 leg in the behavior block, add it to the runner and exports, and confirm RED (pending_decisions carries the visit's own card). Then fix, per the review WR-02 fix. In lib/core/navigation/room-workday.cjs, export workdayGateId(visitId) that returns 'workday-' + visitId.slice(0, 32). In startRoomWorkday, drop the entry whose gate_id equals workdayGateId(visitId) from the pending list before it maps pending_decisions. In lib/core/navigation.cjs, beside the startRoomWorkday lazy wrapper at line 127, add a workdayGateId lazy wrapper of the same form. In lib/mcp/startup-operations.cjs nextMoveForWorkday, compute the gate id with navigation.workdayGateId(briefing.visit_id), so the formula lives in one place. Confirm GREEN. Commit only tests/test-startup-flows.cjs, lib/core/navigation/room-workday.cjs, lib/core/navigation.cjs and lib/mcp/startup-operations.cjs with the message `fix(quick-261019-ksf): a retried briefing does not list its own next-move card as pending (371 review WR-02)`.

After sub-step C, run the full `bash tests/run-all-371.sh`. If a --check script in it (connector registry, orchestration projection, harness manifest, render coverage) fails because of the room_startup description edit, regenerate with that script's own write mode, inspect the diff, and commit the regenerated data file with a separate `--only` commit that names the cause. If `git diff --check` in that runner fails only on a file that you do not own, record it and continue; do not fix it.
  </action>
  <verify>
    <automated>export PATH=/home/jsagi/.nvm/versions/node/v24.21.0/bin:$PATH; cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-startup-flows.cjs && bash tests/run-all-371.sh && grep -c "entry.roomCreation === true" lib/mcp/tools/gate.cjs && grep -c "bindingGen" lib/mcp/tools/startup.cjs lib/core/navigation/room-workday.cjs && grep -c "navigation.workdayGateId" lib/mcp/startup-operations.cjs</automated>
  </verify>
  <done>Three commits exist on main, each an ancestor of HEAD, each with only its owned paths. tests/test-startup-flows.cjs prints a PASS line for secondRoomStaysLocal, rebindOpensNewVisit and retryHidesOwnCard, and the realFlows PASS lines stay. Each new leg was seen RED before its fix (record the failure line in the SUMMARY). bash tests/run-all-371.sh ends with "Phase 371 local acceptance: PASS".</done>
</task>

<task type="auto">
  <name>Task 2: Restore the ruled Desktop sentences in the room_list description (navigator ruling)</name>
  <files>lib/mcp/tools/room.cjs</files>
  <action>
Per the navigator ruling for this quick (fix then cut; restore the ruled Desktop sentence), edit only the room_list description string in lib/mcp/tools/room.cjs. Keep every sentence of the current room-first text unchanged. Append one sentence at the end: "If the person asks to open the MindrianOS workspace in a browser, say exactly: This runs on your machine from Claude Code. Open Claude Code on this computer and run /mos:dashboard shell to see your room in the browser." This is the f6bf6cb92 wording. Take the command from the "Launch command:" line of .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-LAUNCH-RULING.md (it reads `/mos:dashboard shell` at HEAD). The arm 6 pin compares the exact two sentences, so do not paraphrase them. Do not edit the ruling file or tests/test-369-launch-surface.cjs. Do not reword "Read-only: listing does not bind or create a room and reads no room contents." to avoid the 276 scanner: if the room_list HIGH_RISK row in test-276 stays, record it in the SUMMARY as a report item (the claim is true; the review proposes a ledger disposition; the navigator decides). Add no disposition for it. Run node tests/test-369-launch-surface.cjs. Confirm arm 6 passes. Arm 4 and arm 6b were red before 371 or depend on Task 3 and the 276 room_list row; record their state. Run node tests/test-270-tool-schema-budget.cjs and node tests/test-234-tool-description-floor.cjs; both must stay green. Commit only lib/mcp/tools/room.cjs with the message `fix(quick-261019-ksf): restore the ruled Desktop browser sentences in the room_list description (navigator ruling 2026-10-19, 371 review WR-01)`.
  </action>
  <verify>
    <automated>export PATH=/home/jsagi/.nvm/versions/node/v24.21.0/bin:$PATH; cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-369-launch-surface.cjs 2>&1 | grep -E "arm 6: the Desktop delivery|passed, " ; node tests/test-270-tool-schema-budget.cjs && node tests/test-234-tool-description-floor.cjs</automated>
  </verify>
  <done>The line for arm 6 ("the Desktop delivery matches the ruling") reports a pass. test-270 and test-234 exit 0. One commit that changes only lib/mcp/tools/room.cjs is an ancestor of HEAD. The SUMMARY states the arm 4 and arm 6b results and whether the 276 room_list row stays.</done>
</task>

<task type="auto">
  <name>Task 3: Re-baseline the 267 wire pins and the 276 frozen sweep for the proven 371 deltas only (1 commit)</name>
  <files>tests/fixtures/267/wire-snapshot-zod4.json, tests/fixtures/267/wire-snapshot-zod3.json, tests/fixtures/267/zod4-accepted-deltas.json, tests/fixtures/tool-honesty/276-dispositions.json</files>
  <action>
Do this task after Tasks 1 and 2, because it captures the final live room_list and room_startup text. The orchestrator named tests/test-267-mcpv2-app-views.cjs, but that suite is green and pins no tool count. The red 267 legs are test-267-mcpv2-registration-api, test-267-mcpv2-zod4-contract and test-267-mcpv2-dual-era. All 3 read tests/fixtures/267/.

Step 1, prove the delta (gate). In the scratchpad (not in the repo), write a script that calls wireSnapshot(LOCAL_SERVER, { env, capabilities: { elicitation: {} } }) with env from hermeticEnv(), both from tests/helpers/mcp-wire-267.cjs, as test-267-mcpv2-registration-api does. Compare the live tools by name with wire-snapshot-zod4.json local.tools. Print the added names, the removed names, the names whose description changed, and the names whose inputSchema changed. Also compare instructions, prompts, resources and templates. The gate passes only if all of these are true: added is exactly room_create and room_startup; removed is empty; changed descriptions are a subset of room_list and room-dashboard; no inputSchema changed; instructions, prompts, resources and templates are unchanged. For each changed description, run git log --format=%h f6bf6cb92..HEAD on its source file (lib/mcp/tools/room.cjs, lib/mcp/app-views.cjs). Every commit listed must be a reviewed 371 commit (ecde228dc, ec3d56380, cec325d5b) or the Task 2 commit. Run node scripts/check-tool-honesty.cjs --report. The 276 gate passes only if the live toolCount is 47 and branchCount is 142 (45 + 2 and 140 + 2) and the new rows are exactly room_create.(default) and room_startup.(default). If either gate fails, do not edit any fixture. Record the full delta in the SUMMARY, mark this task PARTIAL, and continue to Task 4. The orchestrator asked for a delta of exactly room_create + room_startup. The two description deltas are an extension of that rule, and the SUMMARY must state it.

Step 2, 267 pins, following the 369-41 precedent (commit ef7814d8b). In wire-snapshot-zod4.json, insert the live room_create and room_startup tool entries in name order, and replace the room_list and room-dashboard descriptions with the live strings. Append to the refreshed_by string: "; quick 261019-ksf 2026-10-19: added room_create and room_startup (commit ec3d56380, 48 -> 50), refreshed the room_list description (<commits found>, plus the ruled Desktop sentences restored by this quick) and the room-dashboard description (<commits found>) from the live wire; no other tool changed". In wire-snapshot-zod3.json, replace only the room_list and room-dashboard description strings with the live strings. In zod4-accepted-deltas.json, add two entries to the zod4_other array after the gate_list entry, in its shape (kind tool, name, field membership, path ["."]). Give each a note that names commit ec3d56380, quick 261019-ksf and 2026-10-19, and says that it is a membership delta, not a zod delta (the gate_list precedent). Rewrite each JSON file with JSON.stringify(value, null, 2) and keep the original trailing-newline state. Then run git diff --stat and git diff on the three files. Confirm that only these hunks changed.

Step 3, the 276 frozen sweep, following the 369-41 precedent (commit cb8cebaa7). In 276-dispositions.json, set frozen_sweep tools and branches and the verdict tallies (high_risk, medium, low, unknown, ok) to the live --report values. Replace refrozen_at with { commit: <short HEAD sha after Task 2>, reason: <dated reason> }. The reason names quick 261019-ksf, 2026-10-19 and commit ec3d56380. It gives before 45/140 and after 47/142 with the tallies. It states that room_create and room_startup scan as written in --report. It states that room_list.(default) and room_search.(default) stay HIGH_RISK with no disposition: room_search is pre-existing (371 review IN-06) and room_list is reported for a navigator decision. It names the earlier freeze (plan 369-41, cd27faa94, 45/140). Do not add or change any row in dispositions.

Run the four suites in the verify step. Expected result: the three 267 suites exit 0. test-276-tool-honesty-findings-closed has only the room_list and room_search disposition rows left red; GROUP F passes. Commit only the four fixture files with the message `test(quick-261019-ksf): move the 267 wire pins and the 276 frozen sweep for room_create and room_startup (ec3d56380, 48 -> 50 tools, 45/140 -> 47/142)`.
  </action>
  <verify>
    <automated>export PATH=/home/jsagi/.nvm/versions/node/v24.21.0/bin:$PATH; cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-267-mcpv2-registration-api.cjs | tail -3; node tests/test-267-mcpv2-zod4-contract.cjs | tail -3; node tests/test-267-mcpv2-dual-era.cjs | tail -3; node tests/test-276-tool-honesty-findings-closed.cjs | grep -E "FAIL|passed, "</automated>
  </verify>
  <done>Either (gate passed) the 3 red 267 suites exit 0, test-276-tool-honesty-findings-closed fails only on the room_list and room_search disposition rows, and one commit that changes only the 4 fixture files is an ancestor of HEAD; or (gate failed) no fixture changed and the SUMMARY lists the exact delta and the task as PARTIAL.</done>
</task>

<task type="auto">
  <name>Task 4: Raise the test-366 integrity gate timeout, then run the final verification</name>
  <files>tests/test-366-semantic-index-integrity.cjs</files>
  <action>
In tests/test-366-semantic-index-integrity.cjs runGate (line 54), change the spawnSync timeout from 120000 to 300000. Add a dated comment above the function: quick 261019-ksf, 2026-10-19, 371 review IN-02; leg I3 runs check-require-integrity over the full tree and takes 90 to 117 s on this machine, so 120000 ms timed out under load. Change nothing else. Run node tests/test-366-semantic-index-integrity.cjs alone and confirm 12 passed, 0 failed. Commit only that file with the message `test(quick-261019-ksf): give the semantic-index integrity gate 300 s (371 review IN-02)`.

Then run the final verification in this order. Run each command alone, and do not start another suite while run-all-366 runs. Step 1: bash tests/run-all-371.sh (Node 24) must exit 0. Step 2: LC_ALL=C bash tests/run-all-366.sh with no other suite running; it must report every leg passed except the known "pin 355 direction agreement" leg. Run it in the background or with a 600000 ms tool timeout, because it takes several minutes. Step 3: run each of these and record the pass and fail counts by file name: node tests/test-369-launch-surface.cjs, node tests/test-267-mcpv2-app-views.cjs, node tests/test-267-mcpv2-registration-api.cjs, node tests/test-267-mcpv2-zod4-contract.cjs, node tests/test-267-mcpv2-dual-era.cjs, node tests/test-270-tool-schema-budget.cjs, and every tests/test-276*.cjs file (11 files). Write the results in the SUMMARY as a table: file, result, red rows, and red cause classified as fixed here, pre-existing (IN-06: arm 4, room_search), or reported for the navigator (room_list HIGH_RISK row and arm 6b while it stays). Do not fix a red that this plan does not own.
  </action>
  <verify>
    <automated>export PATH=/home/jsagi/.nvm/versions/node/v24.21.0/bin:$PATH; cd /home/jsagi/dev/MindrianOS-Plugin && grep -n "timeout: 300000" tests/test-366-semantic-index-integrity.cjs && node tests/test-366-semantic-index-integrity.cjs | tail -2 && bash tests/run-all-371.sh | tail -2 && LC_ALL=C bash tests/run-all-366.sh 2>&1 | tail -15</automated>
  </verify>
  <done>One commit that changes only tests/test-366-semantic-index-integrity.cjs is an ancestor of HEAD. run-all-371 prints "Phase 371 local acceptance: PASS". run-all-366, run alone, has no failed leg except the known pin 355. The SUMMARY carries the result table for 369-launch-surface, the 267 suites, 270 and every 276 suite.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| MCP host to server (stdio or HTTP) | The model calls room_create, gate_answer, room_bind and room_startup with untrusted arguments (room name, purpose, slug) |
| Room to room (Cowork-shared room A vs private room B) | Data of one room must not reach another room's room.db (Canon Part 9 locality) |
| Session binding file | `$MINDRIAN_ROOMS_HOME/.rooms/sessions/<sessionId>.json`, a local file that this plan now reads for its updated stamp |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ksf-01 | Information disclosure | gate.cjs _onGateMinted (creation gate recorded in bound room A) | mitigate | Skip entry.roomCreation === true (Task 1 sub-step A); the secondRoomStaysLocal leg scans every table of A for B's gate id, name and purpose |
| T-ksf-02 | Tampering (integrity of the record) | room-workday.cjs visit id (frozen stdio briefing shows false "no changes") | mitigate | Hash includes the binding generation (Task 1 sub-step B); the rebindOpensNewVisit leg asserts a new opened_at, the logged change and a live card |
| T-ksf-03 | Spoofing / Tampering | session binding updated stamp | accept | The file is local, user-owned and atomically written; a forged stamp can only open a new visit for the same user and room. The read never throws and falls back to null |
| T-ksf-04 | Repudiation | WR-04 relay attribution (approvedBy navigator for a model relay) | accept | Out of scope by orchestrator ruling; SEED-114 owns the human-only route; reported in the SUMMARY |
| T-ksf-05 | Denial of service | test-366 gate timeout | accept | Test-only timeout change; no runtime effect |
</threat_model>

<verification>
- bash tests/run-all-371.sh (Node 24) exits 0 and prints the PASS line.
- LC_ALL=C bash tests/run-all-366.sh, run alone: no failed leg except the known pin 355 direction agreement.
- node tests/test-startup-flows.cjs prints PASS for secondRoomStaysLocal (CR-01), rebindOpensNewVisit (CR-02) and retryHidesOwnCard (WR-02).
- node tests/test-369-launch-surface.cjs: arm 6 passes.
- 267, 270 and 276 results reported by file name in the SUMMARY.
- grep for an em-dash (U+2014) and an en-dash (U+2013) in the diff of every commit from this plan returns nothing.
- Every commit sha from this plan is an ancestor of HEAD, and each commit touches only its owned paths.
</verification>

<success_criteria>
- CR-01 closed: a creation gate writes no gate_raised or gate_closed row into the bound room (leg proves 0 rows).
- CR-02 closed: a re-bind on one stdio connection opens a new visit with truthful changes and a live next-move card; a retry in one binding stays stable.
- WR-02 closed: a retried briefing does not list its own card; other open gates still show.
- room_list carries the ruled Desktop sentences; arm 6 passes.
- 267 and 276 pins move only for the proven 371 deltas, or the task reports PARTIAL with the exact delta.
- test-366 I3 has a 300 s cap; run-all-371 and run-all-366 are green.
</success_criteria>

<output>
Create `.planning/quick/261019-ksf-fix-the-371-release-review-blockers-befo/261019-ksf-SUMMARY.md` when done. Write it in the STE report style of /home/jsagi/.claude/protocols/agent-interaction-protocol.md, and end it with STATUS, CHANGED (files and commit shas), VERIFIED, UNVERIFIED, RISKS and NEXT. List as report-only: WR-03, WR-04, WR-05, IN-01 (SRI), the STARTUI371-08 real-ChatGPT checkpoint, the 276 room_list HIGH_RISK row (if it stays), and arm 4 and arm 6b of 369-launch-surface (if they stay red).
</output>
