---
phase: quick
plan: 261004-av2
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/test-av2-answered-via.cjs
  - lib/mcp/answer-route.cjs
  - lib/mcp/tools/gate.cjs
  - lib/core/navigation/room-projection.cjs
  - lib/core/navigation/reasoning-write.cjs
  - lib/core/strategy/goal-gate.cjs
  - tests/test-369-gate-mirror.cjs
  - ui/shared/src/mcp-session-pool.ts
  - ui/shell/server/control.ts
  - ui/shell/server/actions.ts
  - lib/ui-shell/dist/
  - tests/test-369-gate-mirror-shell.cjs
  - tests/test-365-never-do-gate.cjs
  - tests/fixtures/tool-honesty/276-dispositions.json
  - .planning/quick/261004-av2-gate-answer-answered-via/261004-av2-gate-answer-answered-via-SUMMARY.md
autonomous: true
requirements: [QUICK-261004-av2, 369-CR-02]

must_haves:
  truths:
    - "A gate_answer that carries no valid route proof (a model relaying the CLI AskUserQuestion card, Desktop, Cowork, a chain halt, research, never-do and goal gates) records answered_via mcp_relayed on its answer record, on its decision node, in its reply, and in gate_list's answered state"
    - "A gate approved in the browser workspace through approveDecision, after nonces.reserve accepted the render nonce, records answered_via browser_nonce on the same four surfaces, and the daemon checks the proof itself: replacing the control token file turns the same click into mcp_relayed"
    - "Answering a mirror writes the source gate's answer anchor with the mirror's route (browser_nonce when the browser answered) and the mirror id under via_gate_id; the source owner's later answer replays answered_elsewhere with the recorded route"
    - "A replay (replayed or answered_elsewhere) reports the RECORDED marker, never the route of the repeating call; an anchor written before this change reads answered_via unrecorded and a 369-36 era anchor's mirror id reads as via_gate_id"
    - "Every confirmNode call a gate_answer makes (the decision node, the card subject claim or opportunity, the strategy goal anchor) names the route in its reason text; browser_nonce reads 'proven by the route', mcp_relayed reads 'relayed by the model, not proven by the route'; confirmed_by stays the resolveByUser navigator identity"
    - "The marker is never read from tool arguments: gate_answer and gate_render input schemas, titles and descriptions are byte-identical, no tool is added, and the proof travels only in the MCP request _meta minted once, inside approveDecision"
    - "GATE_BASE in tests/test-365-never-do-gate.cjs equals the final gate.cjs commit; every generator --check reads OK at the last commit; confirm-node.cjs and gate-ledger.cjs are untouched and gate-ledger.cjs keeps exactly one _ledger.delete( in non-comment lines"
  artifacts:
    - path: "lib/mcp/answer-route.cjs"
      provides: "the route vocabulary, the proof check (routeOf), the honest confirm reason (confirmReason), the control token reader with the launcher's guards"
      exports: ["ANSWERED_VIA", "ANSWERED_VIA_VALUES", "META_KEY", "ROUTE_KEY_LABEL", "controlTokenFile", "readControlToken", "routeOf", "confirmReason"]
      contains: "proven by the route, not asserted"
    - path: "tests/test-av2-answered-via.cjs"
      provides: "RED-first arms A1 to A6 (daemon) and B1 to B4 (shell) plus the dash guard"
      contains: "mcp_relayed"
    - path: "lib/mcp/tools/gate.cjs"
      provides: "the marker derived once per gate_answer, written on the answer record, decision node and mirror source anchor, returned on every reply"
      contains: "answerRoute.routeOf("
    - path: "lib/core/navigation/room-projection.cjs"
      provides: "readGateAnswerAnchor and readGateState expose answered_via (route) and via_gate_id (mirror id), legacy rows read unrecorded"
      contains: "via_gate_id"
    - path: "ui/shell/server/control.ts"
      provides: "answerRouteMeta, the browser proof minted from the in-memory control token"
      contains: "export function answerRouteMeta"
  key_links:
    - from: "ui/shell/server/actions.ts approveDecision"
      to: "ui/shell/server/control.ts answerRouteMeta"
      via: "called once, after nonces.reserve and before gateAnswer"
      pattern: "answerRouteMeta\\("
    - from: "ui/shared/src/mcp-session-pool.ts call"
      to: "the daemon's gate_answer handler"
      via: "callTool params _meta['mindrian/answer_route']"
      pattern: "_meta"
    - from: "lib/mcp/tools/gate.cjs gate_answer"
      to: "lib/mcp/answer-route.cjs routeOf"
      via: "one call, before the peek"
      pattern: "answerRoute\\.routeOf\\("
    - from: "lib/mcp/tools/gate.cjs gate_list"
      to: "lib/core/navigation/room-projection.cjs readGateState"
      via: "state.answered passed through (answered_via, via_gate_id)"
      pattern: "gate.answered = state.answered"
---

<objective>
CR-02 of the Phase 369 code review, navigator ruling 2026-10-04 ("answered_via marker now, human-only route later", SEED-114; 369-REVIEW-FIX.md CR-02 option 2). Every gate_answer ratification records answered_via with honest attribution, so a decision node, the room's answer anchor, the gate_answer reply and the gate_list read all say whether the answer was a browser click proven by the shell's render nonce, or an MCP call relayed by the model. The decision node's confirmation attribution stops claiming a click it cannot prove.

Purpose: Phase 369 made "only a person approves" load-bearing, but any MCP session can still mint and answer its own gate and the approve reads as the navigator's. This quick does not stop that act (SEED-114 will); it makes the room tell the truth about how each answer arrived.

Design (decided in this plan; the source artifacts left the mechanism to the planner):
- Value set, written: browser_nonce and mcp_relayed. Read-only: unrecorded (an anchor written before this change). No chain_resume value: chain_run's direct resume writes no gate_answer anchor (the 369-26 named residual), and a chain halt answered through gate_answer is model-relayed. No mirror_browser value: a mirror's source anchor carries the same route as the mirror's own answer, plus the mirror id under via_gate_id.
- The proof (server-side, never a caller claim): approveDecision, right after nonces.reserve accepted the render nonce, mints an HMAC proof bound to the gate id and the nonce, keyed from the shell's 0600 control token (the existing secret, domain separated), and sends it in the MCP request _meta (protocol level, not the tool's input schema). The daemon recomputes it from the control token file it reads with the launcher's guards. A valid proof gives browser_nonce; anything else, whatever it claims, gives mcp_relayed. A model cannot set _meta through a host's tool call and cannot compute the MAC without the token.
- Naming reconciliation: 369-36 already wrote answered_via = the mirror's gate id on a source anchor. That meaning moves to via_gate_id; answered_via becomes the route, per the ruling's name. The reader maps a legacy row (answered_via not in the route set) to via_gate_id.
- Attribution: confirmed_by stays resolveByUser's navigator identity on both routes. Reason: Part 9's guard (promoteNodeStatus agent_attribution_forbidden) needs a human principal for a truth claim; the review's "session's client name" alternative would record an unauthenticated, client-supplied string (gate-render.cjs:160, surface-detect T-234-08) as the confirmer of a truth claim. The honest form goes in the confirm reason text and in answered_via on the decision node.
- Tri-Polar: CLI and Desktop (stdio server processes) and Cowork (daemon through the shim) always record mcp_relayed; only the browser workspace records browser_nonce.
- Residual (SEED-114 owns, same class as 369-SESSION-CONTRACT.md section 3): a same-user process that reads the 0600 control token can mint the MAC.

Output: the marker on four surfaces, the honest confirm reason, RED-first tests, the shell proof on the nonce path, the dist rebuilt, GATE_BASE re-pinned once.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md
@.planning/seeds/SEED-114-human-only-gate-answer-route.md
@.planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-REVIEW.md
@.planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-REVIEW-FIX.md
@.planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-SESSION-CONTRACT.md
@.planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-26-SUMMARY.md
@.planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-33-SUMMARY.md
@.planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-36-SUMMARY.md
@.planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-38-SUMMARY.md
@.planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-41-SUMMARY.md
@.planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-42-SUMMARY.md

Facts the executor builds on (measured at plan time, 2026-10-04):
- Last gate.cjs commit: cd27faa94 (369-38); tests/test-365-never-do-gate.cjs line 536 pins GATE_BASE to cd27faa94eabbb6d69a5c0d2541abba4fe131784. N12 pins the gate_render and gate_answer descriptions and titles and gate_render's input schema to GATE_BASE, gate_answer's input schema to PLAN_BASE, and gate.cjs byte-identity to GATE_BASE.
- gate_answer description is 2028 of 2048 bytes. This plan does NOT change it, gate_render's or gate_list's (so the 267 wire snapshots, zod4 accepted deltas, registration, test-270 byte history and gen-mcp-adapter do not move).
- The daemon uses @modelcontextprotocol/server 2.1.0: a tool handler's second argument carries sessionId and mcpReq._meta (BaseContext in node_modules/@modelcontextprotocol/server/dist/createMcpHandler-*.d.cts); the v1 shape was extra._meta.
- confirmNode (lib/core/navigation/confirm-node.cjs) is byte-pinned by tests/test-365-baseline.cjs: never edit it; change only the reason and byUser arguments gate.cjs passes. promoteNodeStatus writes reason and confirmed_by into the status_promoted memory_event.
- writeReasoningNode (lib/core/navigation/reasoning-write.cjs line 106) keeps only text, section, origin in props today.
- readGateAnswerAnchor (lib/core/navigation/room-projection.cjs line 244) already reads props.answered_via as the 369-36 mirror id and maps decision_node_id to decision:gate:<that id>; readGateState (line 405) copies it into answered; gate_list passes state.answered through unchanged.
- tests/test-369-gate-mirror.cjs line 291 and tests/test-369-gate-mirror-shell.cjs line 311 assert the old answered_via = mirror id meaning.
- The shell's MCP pool (ui/shared/src/mcp-session-pool.ts) calls client.callTool({ name, arguments }); approveDecision (ui/shell/server/actions.ts line 690 on) reserves the nonce, then makes the one gateAnswer call through via(key, ...). tests/test-369-human-only.cjs line 415 pins reserve before gateAnswer and burn after.
- The control token: ui/shell/server/control.ts writeControlToken / startControl / getControl (in memory, Symbol.for('mos.shell.control')); path MOS_SHELL_CONTROL_TOKEN_FILE else ~/.mindrian/ui-shell/control.token (config.ts line 65, launch.cjs controlTokenFile(), exported). launch.cjs readControlToken (lines 311-346) holds the guards to mirror: lstat, no symbolic link, plain file, O_NOFOLLOW open, owner uid equals process uid, mode & 0o077 === 0 (not on win32).
- Test harness: tests/helpers/mcp-daemon-369.cjs startDaemon({ rooms, extraEnv }), legacyClient(port, name); tests/helpers/cli-gate-369.cjs cliClient (a live stdio CLI raiser); tests/test-369-gate-mirror-shell.cjs shows the in-process shell modules loader (registerHooks mapping mos-ui-shared/* to ui/shared/src) and createShellActions over a live daemon.

Session and scope rules (369-22-PLAN.md; every task copies them, every step obeys them):
- Workspace is /home/jsagi/dev/MindrianOS-Plugin only: run `pwd` first.
- Every command runs with the nvm Node first: `export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH`.
- Peers share this working tree (a 369.1 verifier, a 369.1 code reviewer, quick task A6 in tests/fixtures/364-theo). Before editing any file run `git status --short -- <file>`; a diff you did not make belongs to a peer: STOP and report it, never revert it.
- Commit only named paths: `git add <path>` (`git add -f` under .planning/), then `git commit --only -m "<msg>" -- <paths>`. Never `git add .`, `git add -A`, `git commit -a`, `git stash`, `git reset`, or `--no-verify`. After each commit confirm the sha is an ancestor of HEAD (`git merge-base --is-ancestor <sha> HEAD`).
- No STATE.md or ROADMAP.md writes, no gsd-tools state.* or roadmap writers.
- Hyphens only: no em-dash or en-dash in any file, comment, test or commit message.
- Never kill a mindrian-mcp-server or a shell server this task did not start (the helpers kill only their own children).
- No `npm install` or `npm ci` at the repo root. The shell build runs only through `node scripts/build-ui-shell.cjs`.
- One browser e2e at a time.
- Do not edit lib/core/navigation/confirm-node.cjs, lib/mcp/gate-ledger.cjs, lib/mcp/daemon-lifecycle.cjs, bin/, scripts/mindrian-*.cjs (369.1), lib/mcp/runtime-instructions.cjs, any tests/run-all-*.sh, or any gate tool description or input schema.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED arms for the marker, then the daemon half (route check, the four surfaces, the honest confirm reason)</name>
  <files>tests/test-av2-answered-via.cjs, lib/mcp/answer-route.cjs, lib/mcp/tools/gate.cjs, lib/core/navigation/room-projection.cjs, lib/core/navigation/reasoning-write.cjs, lib/core/strategy/goal-gate.cjs, tests/test-369-gate-mirror.cjs</files>
  <read_first>
    - lib/mcp/tools/gate.cjs lines 60-260 (_floorPromoteClaim, _promoteCardSubject), 600-1040 (_answerWithoutLiveGate, _applyRatification, _answerInTx, _stoppedAnswer), 1347-1585 (the gate_answer handler)
    - lib/core/navigation/room-projection.cjs lines 230-290 (readGateAnswerAnchor) and 395-420 (readGateState)
    - lib/core/navigation/reasoning-write.cjs lines 95-150; lib/core/strategy/goal-gate.cjs lines 180-230 (ratifyGoalProposal and its 'strategy gate approve' confirm)
    - lib/ui-shell/launch.cjs lines 81-92 and 311-346 (controlTokenFile, readControlToken guards); ui/shell/server/control.ts lines 24-70
    - tests/test-369-gate-mirror.cjs (arms 1-2, the CLI raiser and mirror pattern) and tests/helpers/mcp-daemon-369.cjs header
  </read_first>
  <behavior>
    - A1: a legacy MCP client (no _meta) on a bound session does gate_render on a proposed claim then gate_answer approve: reply answered_via mcp_relayed; the gate_answer:<id> memory_event props answered_via mcp_relayed; node decision:gate:<id> props answered_via mcp_relayed; the status_promoted event for decision:gate:<id> has reason containing "answered_via mcp_relayed, relayed by the model, not proven by the route"; that node's confirmed_by equals navigation.resolveByUser(roomDir)
    - A2: no model-side claim reaches browser_nonce: (a) an extra argument answered_via 'browser_nonce' (refused or stripped) never records browser_nonce; (b) a well-shaped _meta proof whose MAC uses a wrong key, (c) a valid MAC computed for another gate id, (d) a valid MAC while the token file is chmod 0644, each record mcp_relayed (restore 0600 after d)
    - A3: a legacy client sending a valid proof in _meta (computed in the test with the derivation below and the token on disk) records browser_nonce on reply, record, decision node and confirm reason ("answered_via browser_nonce, proven by the route"); A3b: a CLI-raised gate S mirrored by that client and answered with a valid proof for the mirror id M writes the source anchor gate_answer:S with answered_via browser_nonce and via_gate_id M, and gate_list { gate_id: S } reads answered.answered_via browser_nonce, decision_node_id decision:gate:M
    - A4: replay keeps the original marker: the A3 gate repeated without a proof replays answered_via browser_nonce; the A1 gate repeated with a valid proof replays mcp_relayed; S's CLI owner answering S reads answered_elsewhere with answered_via browser_nonce
    - A5: readGateAnswerAnchor on a row in the 369-36 shape (answered_via = a gate id) returns answered_via unrecorded and via_gate_id = that id; a row with no answered_via returns unrecorded
    - A6 static: gate_answer inputSchema keys are exactly chosen, gate_id, verdict; non-comment gate.cjs has exactly one "answerRoute.routeOf("; gate.cjs and answer-route.cjs both contain "proven by the route, not asserted"; room-projection's route set equals answer-route ANSWERED_VIA_VALUES; answer-route controlTokenFile() equals launch.cjs controlTokenFile() with MOS_SHELL_CONTROL_TOKEN_FILE unset; routeOf returns mcp_relayed and never throws for null, {}, { mcpReq: { _meta: 5 } }, a proof with v 2, non-hex tag; gate-ledger.cjs non-comment lines hold exactly one _ledger.delete(
    - B1 to B4 (written now, green only after Task 2): see Task 2 behavior
  </behavior>
  <action>
Step 0 (baseline, before any edit). Run the session rules (pwd, nvm PATH, `git status --short`). Record in the SUMMARY the exit codes and PASS/FAIL counts of: tests/test-365-never-do-gate.cjs, tests/test-369-gate-recovery.cjs, tests/test-369-gate-mirror.cjs, tests/test-369-gate-raised.cjs, tests/test-369-gate-hardening.cjs, tests/test-369-human-only.cjs, tests/test-369-shell-actions.cjs, tests/test-369-gate-mirror-shell.cjs, tests/test-369-sessionful-acceptance.cjs, tests/test-369-289-precondition.cjs, tests/test-i2x-t2-node-write-back.cjs, tests/test-365-baseline.cjs, tests/test-345-gate-ratify.cjs, tests/test-363-mcp-tool.cjs, `bash tests/run-all-289.sh`, `bash tests/run-all-238.sh`. Known pre-existing reds (369-38, 369-41): test-363 M3 to M7, test-345 (real registry visible), test-237-approve-executes, test-237-autonomy-parity, test-366-gated-term-release R6b.

Step 1 (RED). Create tests/test-av2-answered-via.cjs (CJS, header comment naming quick 261004-av2, CR-02 option 2, SEED-114, the arms list; exit 0 all PASS, 1 any FAIL, 77 only when @modelcontextprotocol/client cannot load or the daemon cannot start; every child killed in a finally; hyphens only). Arms A1 to A6 as in behavior, B1 to B4 as in Task 2's behavior, and a dash guard (LC_ALL=C byte scan for E2 80 94 and E2 80 93) over every file this plan touches. Reuse the harness of tests/test-369-gate-mirror.cjs and tests/test-369-gate-mirror-shell.cjs (registerHooks resolver, startDaemon, legacyClient, cliClient, raw room.db reads through node:sqlite, tests/ is on the Canon Part 9 allow-list). One hermetic daemon for the file: startDaemon with extraEnv MOS_SHELL_CONTROL_TOKEN_FILE = a temp path; at the top, load ui/shell/server/control.ts in process and call startControl(thatPath) so the token exists on disk (0600) and in memory; A arms compute MACs from getControl().token. The derivation, written identically in the test, answer-route.cjs and control.ts: routeKey = HMAC-SHA256(key = the control token string, trimmed, data = ROUTE_KEY_LABEL 'mindrian answer route v1'); tag = SHA-256 hex of the render nonce (64 lowercase hex); mac = HMAC-SHA256(key = routeKey, data = gateId + newline + tag) hex; the request carries _meta { 'mindrian/answer_route': { v: 1, tag, mac } } on callTool params (send it with client.callTool({ name, arguments, _meta })). Run it: exit 1. Commit `test(261004-av2): RED arms for the gate_answer answered_via marker (CR-02 option 2)` with only the test file. Record the first FAIL line.

Step 2 (GREEN, daemon). Create lib/mcp/answer-route.cjs (CJS, Node built-ins only: node:fs, node:os, node:path, node:crypto; no lib/core require, no network token). Exports: ANSWERED_VIA frozen { BROWSER_NONCE: 'browser_nonce', MCP_RELAYED: 'mcp_relayed' }; ANSWERED_VIA_VALUES frozen ['browser_nonce', 'mcp_relayed']; META_KEY 'mindrian/answer_route'; ROUTE_KEY_LABEL 'mindrian answer route v1'; controlTokenFile() (MOS_SHELL_CONTROL_TOKEN_FILE, else os.homedir()/.mindrian/ui-shell/control.token); readControlToken() mirroring the launcher's guards but returning null on every refusal (never throws, never logs the token); routeOf(extra, gateId): reads the proof from extra.mcpReq._meta, else extra._meta, under META_KEY; requires a plain object, v === 1, tag and mac matching /^[0-9a-f]{64}$/, a non-empty gateId; reads the token; recomputes; compares with crypto.timingSafeEqual on equal-length buffers; returns 'browser_nonce' only on a match, 'mcp_relayed' for everything else; wrapped in try/catch so it never throws; it never returns, stores or logs the proof. confirmReason(base, via): 'browser_nonce' gives base + ' (answered_via browser_nonce, proven by the route)', anything else gives base + ' (answered_via mcp_relayed, relayed by the model, not proven by the route)'. Header comment restates Canon Part 9 exactly as: only a human confirms a truth claim; answered_via says how that answer reached the room, proven by the route, not asserted; plus the SEED-114 residual (a same-user process that reads the 0600 control token can mint the proof).

Edit lib/mcp/tools/gate.cjs (per the CR-02 ruling; descriptions, titles and input schemas byte-identical): require ../answer-route.cjs as answerRoute. In the gate_answer handler, right after sessionId and before the peek, `const answeredVia = answerRoute.routeOf(extra, gate_id);` with a comment carrying the Part 9 restatement ("proven by the route, not asserted"); this is the only routeOf call. Carry it on the answer object (Object.assign onto, or a spread copy of, normalizeGateAnswer's result; key answered_via). In _applyRatification: the gate_answer memory_event gains answered_via; writeReasoningNode gets answeredVia; the decision-node confirmNode reason becomes answerRoute.confirmReason('gate_answer approve', answer.answered_via); _promoteCardSubject and _floorPromoteClaim take answeredVia as a new last parameter and both card-subject confirmNode calls use confirmReason('gate_answer approve (card subject)', answeredVia) (holdForEvidence's reason unchanged; byUser stays navigation.resolveByUser(roomDir) everywhere, with a comment giving the Part 9 reason from the objective); ratifyGoalProposal gets confirmReason: answerRoute.confirmReason('strategy gate approve', answer.answered_via). In _answerInTx the source anchor writes answered_via: answer.answered_via and via_gate_id: answer.gate_id (replacing answered_via: answer.gate_id). Replies: the fresh answer response and the binding no-room response carry answered_via; _answerWithoutLiveGate's replay carries anchor.answered_via and anchor.via_gate_id when present; _stoppedAnswer's answered_elsewhere carries rec.answered_via (default 'unrecorded') and rec.via_gate_id when a non-empty string. Update the 2-3 comments that say "the human APPROVE" at these sites to say the route is recorded.

Edit lib/core/navigation/room-projection.cjs: a module-level frozen ANSWER_ROUTES ['browser_nonce', 'mcp_relayed'] and UNRECORDED 'unrecorded' (by value; lib/core never requires lib/mcp), exported for the A6 parity check. readGateAnswerAnchor: route = props.answered_via when in ANSWER_ROUTES, else 'unrecorded'; viaGateId = props.via_gate_id when a non-empty string, else props.answered_via when it is a non-empty string NOT in ANSWER_ROUTES (the 369-36 legacy row), else null; the decision_node_id mapping to decision:gate:<id> uses viaGateId; a found anchor always returns answered_via and returns via_gate_id when non-null; update the JSDoc. readGateState's answered copies answered_via and via_gate_id. Pure reads, no write.

Edit lib/core/navigation/reasoning-write.cjs: optional answeredVia param; props.answered_via set only when a non-empty string of at most 32 characters; update the params doc and the "No other keys" sentence; every existing caller byte-compatible.

Edit lib/core/strategy/goal-gate.cjs: ratifyGoalProposal accepts an optional confirmReason (non-empty string, at most 200 characters) used in place of 'strategy gate approve' when present; default unchanged so test-345 legs are unaffected.

Edit tests/test-369-gate-mirror.cjs line 291 only: assert props.via_gate_id equals M and props.answered_via equals 'mcp_relayed' (that arm's client sends no proof), with a one-line comment naming 261004-av2.

Run the new test: A1 to A6 PASS; B1 to B4 still FAIL (the shell sends no proof yet). If A3 fails because the proof never reaches the handler (neither extra.mcpReq._meta nor extra._meta carries it), STOP and report: do not add a tool input, a header or a flag without a ruling. Re-run every Step 0 command: a new red caused by the added reply field or the via_gate_id rename gets a minimal assertion update in that test file, added to this commit and named in the SUMMARY; anything else red that was green at baseline is a defect to fix before committing. tests/test-365-never-do-gate.cjs N12 "gate.cjs is byte-identical to GATE_BASE" is the one expected red until Task 3 (its description and schema checks stay green). Commit `feat(261004-av2): gate_answer records answered_via (browser_nonce or mcp_relayed) on the answer record, decision node, mirror source anchor and reply` with the six non-test-only paths plus tests/test-369-gate-mirror.cjs and any assertion updates.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH && node tests/test-av2-answered-via.cjs 2>&1 | grep -E "^  (PASS|FAIL) (A[1-6]|dash)" ; node tests/test-369-gate-mirror.cjs | tail -2 && node tests/test-369-gate-recovery.cjs | tail -2 && node tests/test-369-gate-hardening.cjs | tail -2 && node tests/test-365-baseline.cjs | tail -2</automated>
  </verify>
  <acceptance_criteria>
    - The RED commit exists and touches only tests/test-av2-answered-via.cjs; at it the test exited 1 (first FAIL line recorded in the SUMMARY)
    - After the GREEN commit every A arm and the dash guard print PASS; B1 to B4 print FAIL
    - `grep -v '^\s*//' lib/mcp/tools/gate.cjs | grep -c 'answerRoute.routeOf('` prints 1
    - `grep -c "proven by the route, not asserted" lib/mcp/tools/gate.cjs lib/mcp/answer-route.cjs` prints at least 1 for each file
    - `grep -v '^\s*//' lib/mcp/gate-ledger.cjs | grep -c '_ledger.delete('` prints 1; `git diff --quiet cd27faa94 -- lib/mcp/gate-ledger.cjs lib/core/navigation/confirm-node.cjs` exits 0
    - The gate_answer and gate_render description strings and input schemas in gate.cjs are byte-identical to cd27faa94 (test-365 N12 description and schema checks PASS; only the gate.cjs byte-identity check is red)
    - tests/test-369-gate-mirror.cjs, test-369-gate-recovery.cjs, test-369-gate-raised.cjs, test-369-gate-hardening.cjs, test-369-sessionful-acceptance.cjs, test-369-289-precondition.cjs, test-i2x-t2-node-write-back.cjs, test-365-baseline.cjs exit 0; run-all-289 and run-all-238 counts equal the Step 0 baseline
    - `LC_ALL=C grep -nP "\xE2\x80\x94|\xE2\x80\x93"` over the seven files prints nothing
  </acceptance_criteria>
  <done>A model-composed gate_answer records mcp_relayed and a correctly proven one records browser_nonce, on the answer record, decision node, mirror source anchor, reply and gate_list; replays keep the recorded marker; every confirm reason names the route; no input or description moved.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: The shell proves a browser click on the nonce path (answerRouteMeta, _meta through the pool, dist rebuilt)</name>
  <files>ui/shared/src/mcp-session-pool.ts, ui/shell/server/control.ts, ui/shell/server/actions.ts, lib/ui-shell/dist/, tests/test-369-gate-mirror-shell.cjs</files>
  <read_first>
    - ui/shell/server/actions.ts lines 1-60, 285-300 (via), 685-755 (approveDecision)
    - ui/shared/src/mcp-session-pool.ts (whole file, 226 lines)
    - ui/shell/server/control.ts lines 1-70
    - lib/mcp/answer-route.cjs (Task 1; the derivation and META_KEY to match byte for byte)
    - scripts/build-ui-shell.cjs header lines 1-70 (build and --check forms; it refreshes the mos-ui-shared copy itself)
    - tests/test-369-human-only.cjs lines 400-420 (the reserve, gateAnswer, burn order pins)
  </read_first>
  <behavior>
    - B1: in process, after startControl(tokenFile) and with the daemon reading the same file: proposeDecision (agent) on a proposed claim, readGate (human, nonce), approveDecision (human) approve: reply answered_via browser_nonce; the room's gate_answer record and decision node props answered_via browser_nonce; the decision node's status_promoted reason contains "answered_via browser_nonce, proven by the route"
    - B2: the daemon checks, it does not take the shell's word: overwrite the token file (0600) with a different token without touching getControl(), approve a fresh gate the same way: answered_via mcp_relayed; then startControl(tokenFile) again restores the pair
    - B3: a gate S raised by the live CLI process is read by the shell (mirror M) and approved: the source anchor gate_answer:S has answered_via browser_nonce and via_gate_id M (raw room read); the CLI owner's later gate_answer for S reads answered_elsewhere with answered_via browser_nonce
    - B4 static: actions.ts has exactly one "answerRouteMeta(" and inside approveDecision's body it sits after "nonces.reserve(" and before "gateAnswer("; the pool's adapterCall never passes a meta argument; control.ts's 'mindrian/answer_route' and 'mindrian answer route v1' literals equal answer-route.cjs META_KEY and ROUTE_KEY_LABEL
  </behavior>
  <action>
Session rules first (pwd, nvm PATH, `git status --short` on each of the five paths; STOP on a foreign diff, especially under lib/ui-shell/dist/).

ui/shared/src/mcp-session-pool.ts: add an optional meta parameter (Record<string, unknown>) to call(sessionKey, tool, args?, meta?), thread it through callOn and rawCall, and in rawCall pass `_meta: meta` in the callTool params only when meta is given (otherwise the params object is unchanged). The dead-session retry resends the same meta. adapterCall, adapterSession, bind and bindEntry take no meta and never send one (the Claude adapter's own session can never carry the proof). Erasable TypeScript only; update the header list line for call.

ui/shell/server/control.ts: add exported constants ANSWER_ROUTE_META_KEY 'mindrian/answer_route' and ANSWER_ROUTE_KEY_LABEL 'mindrian answer route v1', and export function answerRouteMeta(gateId: string, nonce: string): Record<string, unknown> | null. It returns null when getControl() is null or either argument is empty; otherwise it computes the Task 1 derivation from the in-memory token with node:crypto createHmac and createHash and returns { [ANSWER_ROUTE_META_KEY]: { v: 1, tag, mac } }. The raw nonce never leaves this function (only its SHA-256 tag does). Comment: the control token's second use, domain separated by the label; the daemon (lib/mcp/answer-route.cjs) recomputes it from the 0600 file; Canon Part 9 "proven by the route, not asserted"; the SEED-114 residual. Confirm control.ts imports nothing that imports actions.ts (no cycle).

ui/shell/server/actions.ts: import answerRouteMeta from './control.ts'. Give via an optional third parameter meta and pass it as pool.call(key, tool, args, meta). In approveDecision, after `const ledgerId = ...` and before the gateAnswer call, `const routeMeta = answerRouteMeta(ledgerId, nonce);` and call via(key, (call) => gateAnswer(call, {...}), routeMeta ?? undefined). Keep exactly one gateAnswer( and one nonces.issue( call site, reserve before, burn after. Comment (per the CR-02 ruling): the proof that this answer is a browser click, minted only here after nonces.reserve accepted the render nonce the browser was shown; the daemon verifies it and records answered_via browser_nonce; without it every answer records mcp_relayed. Update the header comment's Canon Part 9 paragraph with one sentence saying the same. Do not change any action's input schema, exposure or answer shape.

tests/test-369-gate-mirror-shell.cjs line 311 only: assert via_gate_id equals mirrorLedgerId and answered_via is one of browser_nonce or mcp_relayed (that file does not own the route proof), with a one-line comment naming 261004-av2.

Rebuild the shell: `node scripts/build-ui-shell.cjs`, then `node scripts/build-ui-shell.cjs --check` must exit 0. Run tests/test-av2-answered-via.cjs (all arms PASS, B1 to B4 included), tests/test-369-human-only.cjs, tests/test-369-shell-actions.cjs, tests/test-369-gate-mirror-shell.cjs, tests/test-369-shared-core.cjs, tests/test-369-ui-dist-fresh.cjs, tests/test-369-claude-adapter.cjs; compare with the Step 0 baseline (a new red caused by this edit is fixed before commit). Commit `feat(261004-av2): the shell proves a browser click to the daemon on the render-nonce path (answered_via browser_nonce)` with the four source paths and lib/ui-shell/dist in ONE commit.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH && node tests/test-av2-answered-via.cjs | tail -3 && node scripts/build-ui-shell.cjs --check && node tests/test-369-human-only.cjs | tail -2 && node tests/test-369-gate-mirror-shell.cjs | tail -2 && node tests/test-369-shell-actions.cjs | tail -2</automated>
  </verify>
  <acceptance_criteria>
    - node tests/test-av2-answered-via.cjs exits 0 with FAIL 0 (A1 to A6, B1 to B4, dash guard all PASS)
    - `grep -c 'answerRouteMeta(' ui/shell/server/actions.ts` prints 1; `grep -c 'gateAnswer(' ui/shell/server/actions.ts` and `grep -c 'nonces.issue(' ui/shell/server/actions.ts` print the same counts as before this task (1 each, the import line excluded as in 369-42)
    - `grep -n '_meta' ui/shared/src/mcp-session-pool.ts` shows _meta only in rawCall's callTool params; adapterCall's body passes no meta
    - `node scripts/build-ui-shell.cjs --check` exits 0 at the commit; lib/ui-shell/dist and the source edits are in the same commit
    - tests/test-369-human-only.cjs, test-369-shell-actions.cjs, test-369-gate-mirror-shell.cjs, test-369-shared-core.cjs, test-369-ui-dist-fresh.cjs, test-369-claude-adapter.cjs exit 0
    - No action input schema, exposure or registered action name changed (tests/test-369-shell-actions.cjs unchanged and green)
    - Dash guard over the five paths (dist excluded) prints nothing
  </acceptance_criteria>
  <done>A browser approve through approveDecision records browser_nonce because the daemon verified a proof only that action mints after the nonce is reserved; every other path, the adapter session included, records mcp_relayed.</done>
</task>

<task type="auto">
  <name>Task 3: The one-time pin moves and the closing sweep</name>
  <files>tests/test-365-never-do-gate.cjs, tests/fixtures/tool-honesty/276-dispositions.json, .planning/quick/261004-av2-gate-answer-answered-via/261004-av2-gate-answer-answered-via-SUMMARY.md</files>
  <read_first>
    - tests/test-365-never-do-gate.cjs lines 512-615 (PLAN_BASE, GATE_BASE and their dated comments)
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-41-SUMMARY.md (the measured before and after table this task repeats)
    - tests/fixtures/tool-honesty/276-dispositions.json top-level frozen_sweep and refrozen_at (the 358-05 re-freeze method: only those two keys move)
  </read_first>
  <action>
Session rules first. Confirm no later commit touched gate.cjs: FINAL=$(git log -1 --format=%H -- lib/mcp/tools/gate.cjs) must be Task 1's GREEN commit; if anything else changed gate.cjs since, STOP and report.

GATE_BASE: in tests/test-365-never-do-gate.cjs set GATE_BASE to the full FINAL sha and add one dated comment line above it and one at the byte-identity check, in the existing style: "Re-pinned 2026-10-04 (quick 261004-av2, once, after its last gate.cjs commit): gate.cjs gained the answered_via marker (CR-02 option 2, SEED-114); the gate_render and gate_answer descriptions, titles and input schemas are byte-identical to cd27faa94, so only the byte-identity pin moves." Commit it alone: `test(261004-av2): re-pin GATE_BASE to <short sha> after the answered_via marker (2026-10-04)`. Run it: 75 pass, 0 fail.

Pins that must NOT move (descriptions and schemas are unchanged): run tests/test-267-mcpv2-zod4-contract.cjs, tests/test-267-mcpv2-registration-api.cjs, tests/test-267-mcpv2-dual-era.cjs, `bash tests/run-all-267.sh`, tests/test-270-tool-schema-budget.cjs, tests/test-234-tool-description-floor.cjs. If any is red because of this quick, a description or schema moved: STOP and report (this plan does not re-pin them).

Tool honesty: run `node scripts/check-tool-honesty.cjs --check` and tests/test-276-tool-honesty-findings-closed.cjs. Expected unchanged (45 tools, 140 branches, 0 high-risk). Only if group F reads a different live tool or branch count because of gate.cjs, re-freeze the 358-05 way: update only frozen_sweep (live scanAll counts) and refrozen_at (commit = the GATE_BASE re-pin sha, reason naming quick 261004-av2) in tests/fixtures/tool-honesty/276-dispositions.json, every disposition byte-identical, in its own commit. Otherwise leave the file untouched.

Generators at the last commit, each must read OK: `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node ui/shared/scripts/gen-mcp-adapter.mjs --check`, `node scripts/build-ui-shell.cjs --check`, `node scripts/check-render-coverage.cjs`.

Closing sweep: every Step 0 command again, plus tests/test-av2-answered-via.cjs, tests/test-369-gate-raised.cjs, tests/test-369-ui-dist-fresh.cjs; optionally one browser e2e (tests/e2e-369/gate-button.cjs) alone, compared with its last recorded state (369-42 recorded arm 10 red, owned by 369-44). Every result equals the baseline or is green; name any pre-existing red with its owner.

Write the SUMMARY (quick format, hyphens only): the design (value set, proof derivation, via_gate_id rename, why confirmed_by stays the navigator), the commits with full shas and their ancestry check, the RED first FAIL line, the before and after table (test counts, GATE_BASE, tool-honesty counts, each generator), deviations, the residual (same-user token read, SEED-114), and two open items for the navigator: the shell's "Confirmed by you" copy reads confirmed_by only and does not yet show the route; chain_run's direct resume still writes no answer anchor. Do not commit STATE.md or ROADMAP.md; the quick workflow commits the SUMMARY with the plan.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH && test "$(grep -oP "const GATE_BASE = '\K[0-9a-f]{40}" tests/test-365-never-do-gate.cjs)" = "$(git log -1 --format=%H -- lib/mcp/tools/gate.cjs)" && echo PIN_OK && node tests/test-365-never-do-gate.cjs | tail -1 && node scripts/build-connector-registry.cjs --check && node scripts/build-orchestration-projection.cjs --check && node ui/shared/scripts/gen-mcp-adapter.mjs --check && node scripts/build-ui-shell.cjs --check && node scripts/check-tool-honesty.cjs --check && node tests/test-av2-answered-via.cjs | tail -1</automated>
  </verify>
  <acceptance_criteria>
    - The verify line prints PIN_OK: GATE_BASE equals `git log -1 --format=%H -- lib/mcp/tools/gate.cjs`, moved once, in its own dated commit
    - tests/test-365-never-do-gate.cjs reads 75 pass, 0 fail
    - test-267 zod4 contract, registration api and dual era, run-all-267, test-270 and test-234 read as at baseline (no description or schema moved)
    - check-tool-honesty --check reads OK; test-276 passes; 276-dispositions.json changed only if group F demanded it, and then only frozen_sweep and refrozen_at
    - build-connector-registry, build-orchestration-projection, gen-mcp-adapter, build-ui-shell --check and check-render-coverage all OK at the last commit
    - Every closing-sweep result equals the Step 0 baseline or is green
    - SUMMARY written with full commit shas, each confirmed an ancestor of HEAD; no STATE.md or ROADMAP.md change; dash guard over the SUMMARY prints nothing
  </acceptance_criteria>
  <done>The pins this change forces moved once (GATE_BASE), every pin it must not move is unchanged, every generator gate reads OK, and the SUMMARY records the design, the measurements and the open items.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| model -> MCP gate_answer | tool arguments are composed by a model; nothing in them may raise the route |
| shell server -> daemon (loopback HTTP) | the browser proof crosses here in the request _meta |
| control token file -> daemon | the daemon reads a same-user 0600 file to check the proof |
| room.db -> readers | the marker is read back by replay, gate_list and the shell |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-av2-01 | Spoofing | gate_answer arguments | mitigate | answered_via is never read from arguments; the input schema is unchanged; one routeOf call derives it (A2a, A6) |
| T-av2-02 | Spoofing | forged _meta proof | mitigate | HMAC-SHA256 bound to the gate id and nonce tag, key derived from the control token, timingSafeEqual; wrong key or gate id gives mcp_relayed (A2b, A2c) |
| T-av2-03 | Spoofing | same-user process reading the 0600 token | accept | named residual, the CR-02 class of 369-SESSION-CONTRACT.md section 3; SEED-114 owns the human-only route |
| T-av2-04 | Tampering | token file planted, linked or readable by others | mitigate | the launcher's guards (no link, plain file, own uid, no group or other bits); any refusal gives mcp_relayed (A2d) |
| T-av2-05 | Repudiation | a replay re-labels an answer | mitigate | replay and answered_elsewhere report the recorded marker only (A4, B3) |
| T-av2-06 | Elevation of Privilege | the Claude adapter session or agent actions obtaining a proof | mitigate | answerRouteMeta has one call site inside human-only approveDecision after nonces.reserve; adapterCall never sends meta (B4) |
| T-av2-07 | Information Disclosure | the proof or token leaking into the room, replies or logs | mitigate | only the enum is stored or returned; the nonce leaves the shell only as a SHA-256 tag; routeOf never logs |
| T-av2-08 | Denial of Service | malformed _meta crashing gate_answer | mitigate | routeOf never throws and degrades to mcp_relayed (A6) |
| T-av2-09 | Information Disclosure | Canon Part 8 Brain egress | mitigate | no Brain call is added; answer-route.cjs requires only Node built-ins |
</threat_model>

<verification>
- node tests/test-av2-answered-via.cjs exits 0 (A1 to A6, B1 to B4, dash guard)
- The gate suites of the baseline equal or improve on Step 0; tests/test-365-never-do-gate.cjs 75/0 after the single re-pin
- GATE_BASE equals the final gate.cjs sha; all generator --check gates OK at the last commit
- confirm-node.cjs, gate-ledger.cjs, every gate tool description and input schema unchanged since cd27faa94; one _ledger.delete( in gate-ledger.cjs non-comment lines
</verification>

<success_criteria>
- A model-composed gate_answer records mcp_relayed; the browser path records browser_nonce; the mirror source anchor records the browser attribution with via_gate_id; replay keeps the original marker (all four RED-first arms green)
- The decision node, the answer anchor, the gate_answer reply and the gate_list read all expose answered_via
- confirmNode's reason names the route on every gate_answer confirm and stops implying an unproven click
- No new tool, no input-shape change, no description change; the only pin moved is GATE_BASE (plus the 276 freeze only if its sweep demanded it)
</success_criteria>

<output>
Create `.planning/quick/261004-av2-gate-answer-answered-via/261004-av2-gate-answer-answered-via-SUMMARY.md` when done
</output>
