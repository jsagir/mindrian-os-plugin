---
phase: 405
kind: EGM elephant research (facts only)
date: 2026-11-27
base: main 1331fdeca (worktree /home/jsagi/dev/MindrianOS-Plugin-release), repo version 2.0.0-beta.94 (node lib/core/repo-version.cjs)
also_read: branch work/367-graph-writes-itself at 8cb094add (worktree /home/jsagi/dev/MindrianOS-Plugin-367, not on main, 32 commits ahead); marketplace repo ~/dev/mindrian-marketplace at 1ea4383 (beta.93)
corrections: r1 rows corrected after Goldfish round 1 are marked CORRECTED with the reviewer id
rules: every fact has a file:line or a source URL. GUESS marks a guess. UNVERIFIED marks a claim not run here.
---

# 405 RESEARCH: MindrianOS on the Desktop merged chat and the Desktop Code tab

## 0. Correction carried into 405 (not edited in 367)

`.planning/phases/367-newborn-room-graph-connected-no-repair/367-CONTEXT.md:35` says "Three surfaces: CLI (hooks), Desktop and Cowork (MCP only, no hooks)". This is wrong for the Desktop Code tab in a local session: that session is full Claude Code and runs plugin hooks (https://code.claude.com/docs/en/desktop; https://support.claude.com/en/articles/13837440, radar Q3). The correct split for 405 is by place, not by app: local Claude Code (CLI, local Code tab, Remote Control) has hooks; the merged chat, web and mobile have no plugin hooks; cloud Code sessions have no local disk. 367-DESIGN.md section 13 (branch) already treats the merged chat as the Desktop bridge row. This correction is recorded here only, per the coordinator.

## 1. How the plugin reaches Desktop today

| Fact | Evidence |
|---|---|
| Two marketplace entries: `mos` (npm source, CLI) and `mos-desktop` (relative path `./plugins/mos-desktop`), plus `get-mindrian` (installer skill only). | ~/dev/mindrian-marketplace/.claude-plugin/marketplace.json (read with python, entries 0-2) |
| Release Step 6.8 builds the Desktop copy from `npm pack` minus `bin/` and `lib/ui-shell/dist`. | scripts/release.sh:1022-1029, :1085; scripts/release-lib/build-desktop-artifact.cjs:91-94 (DESKTOP_DROPS) |
| The builder refuses a top-level `bin/`, a runtime `bin/` reference, more than 4,500 files, more than 180 MB, a deflate ratio over 50:1, and a version mismatch. | build-desktop-artifact.cjs:156-221 (checkPayload), :66-79 (six bin patterns) |
| The Desktop copy keeps `hooks/`, `agents/`, `.mcp.json` and the mod (`hooks/mos-face.json`). Only `bin/` and the UI dist are dropped. | build-desktop-artifact.cjs:94; ls ~/dev/mindrian-marketplace/plugins/mos-desktop (agents, hooks, scripts, skills present) |
| The repo still has a top-level `bin/` with forwarding shims (8 lines each) and `bin/cli.js` (291 lines). The real executables live in `scripts/`. | bin/mindrian-mcp-server.cjs:4-8; `wc -l bin/*` |
| `.mcp.json` declares `mindrian-os` (scripts/mindrian-mcp-server.cjs) and `mindrian-brain` (scripts/mindrian-brain-mcp-client.cjs), both `alwaysLoad: true`. The Desktop copy has the same file. | .mcp.json:3-12 (alwaysLoad at :6 and :11); ~/dev/mindrian-marketplace/plugins/mos-desktop/.mcp.json |
| plugin.json names two hook files, `hooks/hooks.json` and `hooks/mos-face.json` (a mod with `modules`). | .claude-plugin/plugin.json:13-16 |
| 369.1 observed on a real Desktop: `mos-desktop` installs; rooms listed in Cowork; servers connected in the Code tab; Chat shows skills without room tools. No Desktop log line proves the install. | ~/MindrianRooms/rethinking-mindrianos/research/2026-10-04-phase-369.1-desktop-plugin-install-close-out.md ("What was and was not proven") |
| 369.1 D-09 scope truth: tools in Cowork and the Code tab, skills and commands in Chat; a `.mcpb` extension for Chat was named as a follow-up seed. No such seed exists in `.planning/seeds/`, and no `.mcpb` code exists in `scripts/` or `lib/`. | same close-out, follow-on (9); `grep -rli mcpb .planning/seeds scripts lib` (no hit) |
| First connection on a fresh machine self-installs dependencies (11 to 26 s on the 369.1 host); until then the server answers one status tool. | 369.1 close-out ("What was measured"); scripts/mindrian-mcp-server.cjs:103-113 (install responder) |
| `/mos:setup` already has a Desktop route: it prints a `claude_desktop_config.json` snippet for `mindrian-os` only, with `env.MINDRIAN_ROOM` set to `{cwd}/room`, and offers to merge it into the Linux or macOS config path. No Windows path. No `mindrian-brain` entry. | commands/setup.md:68-83, :121 |
| The get-mindrian installer routes every Desktop user to Customize > Plugins > `mos-desktop` and to the Code tab or Cowork with a local folder ("Use an existing folder"). On a merged account new Cowork tasks run in the cloud (radar 2026-10-06 row), so the Cowork leg of that copy is out of date. | ~/dev/mindrian-marketplace/plugins/get-mindrian/skills/get-mindrian/SKILL.md:189-198 (B0-B9) |

## 2. How the MCP server learns its surface and its room

### 2.1 Surface

- `detectSurface()` runs once at module load (scripts/mindrian-mcp-server.cjs:180). Order: `MINDRIAN_TRANSPORT`, `CLAUDE_SURFACE`, `COWORK_SESSION_ID` or a `/sessions` directory, `CLAUDE_CODE_ENTRYPOINT === 'cli'`, non-TTY stdin with `argv.length <= 2` (desktop), TTY (cli), default desktop. lib/mcp/surface-detect.cjs:39-84.
- Capability map: `cli {hooks: true, apps: false}`, `desktop {hooks: false, apps: true}`, `cowork {hooks: false, apps: true, tasks: true}`. lib/mcp/surface-detect.cjs:26-30.
- The enum has three values only: `cli | desktop | cowork`. It cannot name the merged chat bridge, the local Code tab, or a cloud Code session. Same three values in lib/core/memory-ops.cjs:572 (scaffold_log surface) and lib/core/research-planner/sr-entry.cjs:60 (`SURFACES`). A second, two-value axis `cli | mcp` exists in lib/core/feyminto/next-move.cjs:201, :231, :462, :542 and lib/core/navigation-engine.cjs:1212, :1242.
- A second detection axis, `detectHostTier(clientInfo)` (lib/mcp/surface-detect.cjs:186-207, map HOST_TIER_MAP :135-164), runs per call after initialize; it maps `claude-ai` to `claude-desktop` tier0 and any `claude.?code` name to tier1. The no-second-detector rule is at :102-106. On 2026-era connections `getClientVersion` is null; the identity reader is `readClientIdentity` (:250-270).
- Write path flag: every governed write first calls `isWritePathEnabled` (lib/mcp/mcp-first-flag.cjs:131-145). It returns false for an unknown client name unless `MINDRIAN_MCP_FIRST` names the surface. `HINT_SURFACES` knows only cli, desktop, cowork (:148). The client name a bridged server receives is UNVERIFIED; if it is not `claude-ai` or a Claude Code name, every bridged write returns `write_path_disabled` (Goldfish IR-M6, CD-M2).
- GUESS: a local Code-tab session does not set `CLAUDE_CODE_ENTRYPOINT=cli` (the statusline detector carries the same assumption, lib/statusline/surface-detect.cjs:63-70; it also reads `CLAUDE_DESKTOP=1`, :57-59). If so, the server in the local Code tab resolves to rule 5 `desktop` with `hooks: false`. CORRECTED (Goldfish CD-M1): lib/core/arbitration.cjs:152-160 is not reached in production: navigation-engine.cjs:1598 passes `ctx.arbitration_inputs`, and no caller sets it. The real consumer of the capability map is lib/mcp/capability-registry.cjs:20-24, :50-56: `apps: true` registers the MCP App views (room-dashboard and others) through scripts/mindrian-mcp-server.cjs:288. A Code-tab misdetect therefore keeps the app views on; it does not switch off hooks (hooks are the host's). UNVERIFIED (spike SP5).
- Server stderr prints the detected surface at start: scripts/mindrian-mcp-server.cjs:658 (normal stdio start; :409 is the express-missing fallback). This is the cheapest probe for SP5.
- `fallbackRoomDir` is `path.resolve(MINDRIAN_ROOM || './room')` (scripts/mindrian-mcp-server.cjs:190), so `boot-fallback` exists even with no pin: it is `<cwd>/room`.

### 2.2 Room

- One resolver: `resolveMcpSessionRoom` (lib/mcp/session-room.cjs:158-203). Sources: `session.primary`, `room-root` (write only, cwd walk-up), `reg.active`, `boot-fallback` (`MINDRIAN_ROOM`), `cwd`, `none`.
- Write authority: `resolveMcpWriteRoom` (lib/mcp/session-room.cjs:285-377) refuses `reg.active` when the session has an id (typed `no_bound_room`, :143-145), accepts `boot-fallback` when the directory exists, refuses `none`.
- Session id: `resolveEffectiveSessionId` = explicit, then `extra.sessionId`, then `CLAUDE_CODE_SESSION_ID`, then the stdio process key. lib/core/session-binding.cjs:176-182.
- Desktop exports no session id. The stdio server mints one process key `stdio-<pid>-<hex>` at serve time. lib/core/session-binding.cjs:194-203; registered on the stdio serve paths only, scripts/mindrian-mcp-server.cjs:147-155, :406, :655.
- The test of that rule assumes one server process per Desktop window ("two Desktop windows (two server processes, one rooms home)"). tests/test-desktop-stdio-session-binding.cjs:35, :514-528. GUESS: in the merged chat the Desktop app may spawn one config server process and share it across conversations; then every conversation on that computer shares one binding. UNVERIFIED (spike SP4).
- The `/mos:setup` snippet pins `MINDRIAN_ROOM` (commands/setup.md:77). A pin makes `boot-fallback` a write target for every conversation that has not bound (session-room.cjs:248-262 comment, :296-300). SEED-039 records the global-active-room race (.planning/seeds/SEED-039-per-session-room-binding-and-multi-session-reconciliation.md).
- `room_bind` is registered at lib/mcp/tool-router.cjs:2272. `room_list` at lib/mcp/tools/room.cjs:104-109 (its description scripts the first-activation loop).

### 2.3 Server instructions

- The server sends one instructions text at initialize: lib/mcp/runtime-instructions.cjs:35-39, wired at scripts/mindrian-mcp-server.cjs:230-240. It says "assume no hooks, shell or subagents" on every surface, the CLI included, and scripts the loop: room_list, room_bind, context_assemble, room_startup, room-dashboard, suggest_next after work, gate_render for forks, stop_gate_check after filing.
- UNVERIFIED: whether the merged chat forwards a bridged server's `instructions` to the cloud model (spike SP6).

## 3. Hooks: what the CLI gets and what the merged chat lacks

All rows read from hooks/hooks.json (parsed with python on 2026-11-27). Purpose from the script header lines. "MCP equivalent" names a tool the model must call; none of them runs without a model call.

| Event, matcher | Script | What it does | MCP-side equivalent today | Gap in the merged chat |
|---|---|---|---|---|
| SessionStart | scripts/session-start (via hooks/run-hook.cmd) | Loads room context into additionalContext; spawns the 367 runner (scripts/session-start:135, on main) | context_assemble (lib/mcp/tools/context.cjs:99), room_startup (lib/mcp/tools/startup.cjs:21) | Pull only, and only when the model follows the instructions at first activation |
| SessionStart | sessionstart-coordinator.cjs | One owner of SessionStart output, 2000-char budget (header lines 4-10) | none | No budgeted push |
| SessionStart | sessionstart-npm-reconcile, post-update-preflight, reference-now-seed, check-pending-breakthrough, check-pending-ambiguous, gsd-graph-derive-drain, agentshield-sessionstart-scan | Update, seed, pending-card and derive-drain chores | install responder covers first install only (mindrian-mcp-server.cjs:103-113) | No pending-card surfacing at start |
| UserPromptSubmit | intent-classifier.cjs | Per-turn NAVIGATION DECISION block (:1050, budget 1100 B at :1413); memory_event rows `reach_presented` and `gate_reached` (:2791, :2852) | suggest_next (lib/mcp/tools/sensors.cjs:466), reach_candidates (:548), memory_event (lib/mcp/tools/graph.cjs:260) | No per-turn push; no per-turn memory row |
| UserPromptSubmit | admin-command-gate, first-install-router, brain-derivation-drain, jtbd-update, auto-explore-drain | Admin gate, first-contact moment, Brain derive drain, JTBD inference, auto-explore offers | none | Missing |
| PreToolUse Write/Edit | write-scope-check | Write-scope guard into rooms | resolveMcpWriteRoom refusal on MCP writes (session-room.cjs:285) | Covers MCP writes only; host file writes in the cloud sandbox are not guarded |
| PreToolUse brain matchers (incl. `claude_ai_Theo*`, `pws-brain-mcp`) | part8-egress-guard-hook.cjs | Part 8 egress classifier before a Brain call | In-process guard in lib/core/brain-client.cjs:484-500 (callTool), :821, :1361, :1397, used by scripts/mindrian-brain-mcp-client.cjs | See section 4 |
| PreToolUse gate_answer | card-before-answer-hook.cjs | Stops the model answering a gate for the navigator | CORRECTED (Goldfish CD-M6): not hook-only. gate_answer refuses a relayed answer to an elicitation card that the navigator dismissed, reason `card_pending` (lib/mcp/tools/gate.cjs:1652-1675), unless the answer came by browser nonce or equals the accepted dialog choice; it records `answered_via` (`browser_nonce` or `mcp_relayed`, lib/mcp/answer-route.cjs:39; gate.cjs:1719) | Open gap: a card drawn on the text rung (no elicitation, no browser) has no server-side check that a human chose |
| PreToolUse WebSearch/WebFetch/Tavily | web-credential-guard-hook.cjs | Credential guard on web egress | none | Missing |
| PreToolUse Write | review-contract-hook.cjs | Review contract on writes | artifact_file pre-write review contract (lib/mcp/tools/views.cjs:248-251, Phase 370 comment) | Covered for artifact_file |
| PostToolUse Write/Edit | post-write, frontmatter-schema-validator, async-artifact-auto-commit, memory-completion-detector, auto-explore-fingerprint, gsd-artifact-graph-hook, memory-artifact-graph-hook | Classify, validate, commit, index host-tool writes | artifact_file indexes its own filing (views.cjs:592-597) | Host-tool writes in chat are not indexed (and land in the cloud VM, GUESS) |
| PostToolUse brain matchers | brain-response-sanitize-hook.cjs | Redacts user-data echo in Brain responses | none found in the shim path (not searched in full) | Missing in chat |
| PostToolUse AskUserQuestion (branch only) | scripts/card-answer-ledger.cjs | 367 OR-1: an answered CLI card lands as a confirmed decision | gate_answer approve writes a decision node (gate.cjs:1612) | Branch only; CLI only by design |
| Stop | on-stop | STATE.md, close-out, spawns 367 runner (scripts/on-stop:56, on main) | stop_gate_check (lib/mcp/tools/stop-gate.cjs:43; "owns the server-side business close-out" in its description) | Pull only |
| Stop | check-card-fire, check-voice-style, ambient-stop, gsd-graph-derive-sweep | Card-fire enforcement, voice log, ambient trigger, derive enqueue | none (arbitration says not_applicable, arbitration.cjs:152-160) | Missing |
| SessionEnd, PreCompact, PostCompact, FileChanged, CwdChanged, SubagentStop, TaskCompleted | session-end-presence and run-hook.cmd handlers | Presence, compaction memory, file and cwd events | session-catchup registerShutdownHandler (mindrian-mcp-server.cjs:146) | Missing |
| Mod | hooks/mos-face.json `modules` | Side panel / face mod | none | Missing |

367 on branch (to land before 405): lib/mcp/graph-catchup-spawn.cjs wraps `s.registerTool` and spawns scripts/graph-catchup.cjs detached after every GOVERNED call (graph-catchup-spawn.cjs:40 GOVERNED, :113 PURE_READ, :138-146 spawnRunner, :175-182 room via classifyMcpWriteRoom, skip on `source === 'cwd'`, :208-235 install). Installed in the server by plan 12 (commit f8670d246). S1 verdict "detached" for Desktop legs A1 and A2 (commit bb7baab1f; 367-DESIGN.md section 13 on the branch). This is the only MCP-side duty that runs without the model asking for it.

## 4. Part 8 egress guard

- Hook: scripts/part8-egress-guard-hook.cjs, PreToolUse with matchers for mindrian-brain, pws-brain-mcp, theo, theo-context, claude_ai_Theo*, claude_ai_PWS_Brain, and any `__brain_*` tool (hooks/hooks.json, PreToolUse row 2).
- In-process: lib/core/brain-client.cjs requires lib/core/part8-egress-guard.cjs on the callTool path (:491), the query path (:821), the Theo verdict path (:1361, :1397), hats (:2336) and validation (:2449). The `ambiguous` disposition differs by a stated decision: the hook renders a card, the in-process guard discloses and proceeds or returns `sprouts_required` (:475-487).
- The guarded shim is scripts/mindrian-brain-mcp-client.cjs. Without `CLAUDE_CODE_SESSION_ID` it builds no shape packet and checks the lexicon against the machine-global active room, `lexicon_scope: machine_global` (doc comment :110-125, function `sessionRoomShape` :127-149; lexicon resolver lib/core/part8-room-lexicon.cjs:276). brain-client also requires the guard at :3217. The stdio process key is module state and is deliberately not inherited by children (lib/core/session-binding.cjs:184-187), so a sibling server cannot read it.
- Server instructions budget: lib/mcp/runtime-instructions.cjs:10-27 sets 2000 bytes; the served length measured on 2026-11-27 is exactly 2000 bytes (`node -e "...Buffer.byteLength(RUNTIME_INSTRUCTIONS)"`). lib/mcp/no-instructions.test.cjs freezes BOUNDARIES; tests/test-359-prose-budget.cjs guards the budget; scripts/build-harness-manifest.cjs:172, :186-189 digests the file. Any added byte needs a trim.
- In the merged chat: the shim is a plugin local MCP server, so the chat ignores it (radar Q1, https://claude.com/docs/plugins/platform-support). It reaches the chat only as a `claude_desktop_config.json` server or an extension, and `/mos:setup` does not offer that entry (commands/setup.md:68-83). Account connectors such as a claude.ai Theo connector run with no MindrianOS code on the path, so neither guard applies there. Conclusion: in the merged chat today, Part 8 holds only by instruction text (runtime-instructions.cjs:39), not by code.

## 5. Skills and commands that assume a shell, hooks or the plugin root

Counts on main (125 skills/*/SKILL.md, 113 commands/*.md), `grep -l`:

| Pattern | Skills | Commands |
|---|---|---|
| `Bash` anywhere | 111 | 109 |
| `allowed-tools` line naming Bash | 110 | 9 |
| `${CLAUDE_PLUGIN_ROOT}` path | 104 | 98 |
| a fenced bash block | 70 | not counted |
| `node -e` | 15 | 14 |
| `./lib/core` | 2 | 2 |
| `AskUserQuestion` | 112 | not counted |
| any of Bash, node -e, ./lib/core, CLAUDE_PLUGIN_ROOT | 120 | 111 |
| names a mindrian-os MCP tool (room_bind, artifact_file, the tool prefix, "MCP tool") | 22 | 19 |

Examples:
- skills/lean-canvas/SKILL.md:28 `allowed-tools: Read Write Bash Glob AskUserQuestion`; :63-64 read `references/` through `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?... or run from Claude Code.}}`.
- skills/ignite/SKILL.md:70-73 reads the registry with `node -e "require('${CLAUDE_PLUGIN_ROOT}/lib/core/room-chooser.cjs')..."`; :84 runs `bash .../scripts/room-registry set-active`.
- skills/rooms/SKILL.md:83, :175, :241, :251, :258 run `scripts/room-registry`, `resolve-room`, `update-icm-index`, `compute-state` in bash.

What this means, by place:
- Merged chat: the cloud sandbox has a shell (Cowork work runs there, https://support.claude.com/en/articles/13364135), but it is not the user's computer. GUESS: `CLAUDE_PLUGIN_ROOT` is unset there, so the `:?` guard stops the command with "run from Claude Code" (an honest failure). If it is set (a synced plugin in a cloud session, Claude Code 2.1.304 changelog), `scripts/room-registry create` would build a room inside the cloud VM that the user never sees. UNVERIFIED (spike SP1).
- Only 22 of 125 skills name an MCP room tool. So at least 98 skills have no written MCP path for room work in a hookless place (125 minus 22, by grep; the exact number of skills that need a room is not counted).

## 6. Write path to room.db and read-back

- One SQL door: lib/core/navigation.cjs (`logMemoryEvent` :143, `openRoomDbForCaller` :655, `confirmNode` :718, `fileEvidenceWithReadback` :805).
- `artifact_file` (lib/mcp/tools/views.cjs:537-600): calls `writePathRefusal` first (:559), resolves the write room (:564), opens room.db with `probeWrite` (:576), writes the file through `writeFileContained` (:284), then rewrites its frontmatter with `injectArtifactId` (:287-292), logs `mcp_client_event_logged` (:319), writes a reasoning claim node (:335-415), then indexes the artifact (:592-597) and sets `partial: true` when the index or the claim failed. It does not read the file or the rows back. No content hash is returned. The bytes on disk differ from the bytes sent whenever frontmatter is present (Goldfish CD-B1).
- A read-back primitive exists: lib/core/navigation/file-evidence-readback.cjs (header :1-44, function :72-166) writes an EvidenceClaim plus an INFORMS edge in one transaction and reads the row back, returning `{ok: false, reason}` when it did not land. Its assertions are inline and EvidenceClaim-specific (:118-148), not exported (:246). Callers: lib/workflow/dial-close-reach.cjs:169, lib/core/research-planner/filing.cjs:655, lib/core/recovery/controller.cjs:417, scripts/dominant-design-research.cjs:305. Not used by artifact_file, claim_write, memory_event, graph_write or gate_answer.
- Other writer locations (Goldfish CD-M12): `room_create` is lib/mcp/tools/startup.cjs:11 (birth through lib/mcp/startup-operations.cjs:44-86, which already returns a creation receipt with `answered_via`); `graph_write` is lib/mcp/tools/graph.cjs:217; `memory_event` graph.cjs:260; `claim_write` lib/mcp/tools/claim.cjs:97 (write room :132). `resolveMcpWriteRoom` has 13 call sites. `room_create` and `room_bind` do not call it (Goldfish CD-B2).
- `room_changes` (lib/mcp/tools/feed.cjs:152) needs `collection` (:157), carries an `epoch` guard (:133, :159) and answers only a bound or operator-pinned room (:60-70). The change-log head is readable with `navigation.readChangeLogMeta` (lib/core/navigation.cjs:681).
- `logMemoryEvent` accepts only the frozen EVENT_TYPES set (lib/core/navigation/memory-events.cjs:10).
- `set-active` in room switching has a registry read-back (lib/mcp/tool-router.cjs:2120-2140).
- A change feed exists for a later check: `room_changes` (MCP tool; collections nodes, relations, artifacts, decisions, activity, cursor `change_seq`). A model can use it to confirm a write after a lost response.
- Radar fact: Claude Code 2.1.300 fixed cloud-session Write/Edit that reported success for a local path where the file never arrived (https://code.claude.com/docs/en/changelog). That defect was in the host file tools. An MCP server on the user's computer writes with its own `fs` calls; GUESS: the bridge risk for it is a lost or late tool response, not a false success. UNVERIFIED (spike SP2).

## 7. Capability matrix

Legend: WORKS, DEGRADED (partial or pull-only), MISSING. "Bridge" = a `claude_desktop_config.json` server (or extension) reached through the open Desktop app, field-observed as `mcp__remote-devices__<server>__<tool>` (radar "Field evidence"). Web and mobile assume a linked computer with Desktop open where noted.

| Capability | CLI | Desktop Code, local | Desktop Code, cloud | Merged chat with bridge | Web / mobile |
|---|---|---|---|---|---|
| Larry voice and first reply | WORKS: SessionStart context + runtime-instructions.cjs:35-36; voice log Stop hook | WORKS (same hooks; GUESS that hooks.json loads, radar Q3) | DEGRADED: only synced skills, if any (support 13837440) | DEGRADED: instructions only if the bridge forwards them (UNVERIFIED, SP6); skills load | DEGRADED: as merged chat when linked; skills only when not |
| Room bind | WORKS: CLAUDE_CODE_SESSION_ID (session-binding.cjs:176-182) | WORKS (GUESS: CLAUDE_CODE_SESSION_ID exported, SP5) | MISSING: no local disk (cloud-environments page) | DEGRADED: one stdio process key (session-binding.cjs:194-203); may be shared across chats (SP4) | DEGRADED if linked, else MISSING |
| Context at turn start | WORKS: session-start, coordinator | WORKS | MISSING | DEGRADED: pull via context_assemble, room_startup at first activation only (runtime-instructions.cjs:37) | as merged chat |
| Per-turn memory_event | WORKS: intent-classifier.cjs:2791, :2852 | WORKS | MISSING | MISSING: only when the model calls memory_event or artifact_file (views.cjs:319) | MISSING |
| Navigation block | WORKS: intent-classifier.cjs:1050 | WORKS | MISSING | DEGRADED: suggest_next on request (sensors.cjs:466) | as merged chat |
| Gate cards | WORKS: gate_render + AskUserQuestion + card-before-answer hook + check-card-fire | WORKS (GUESS) | MISSING (no room to record) | DEGRADED: gate_render ladder (gate.cjs:1412); an elicitation card is protected (card_pending, gate.cjs:1652-1675); a text-rung card has no human check | as merged chat |
| Filing with read-back | DEGRADED: filing + index, no read-back (views.cjs:592-597) | DEGRADED (same) | MISSING | DEGRADED: same, plus a lost-response risk (SP2) | as merged chat |
| Graph catch-up (367) | WORKS: on-stop:56, session-start:135 (main) | WORKS (same hooks) | MISSING | DEGRADED until 367 plans 11-12 merge; then WORKS on governed calls while Desktop is open (graph-catchup-spawn.cjs:175-235) | as merged chat |
| Part 8 guard | WORKS: hook + in-process | WORKS | MISSING on account connectors | DEGRADED: in-process only if mindrian-brain is a config server (not offered, setup.md:68-83); MISSING on account Theo connectors | MISSING on connectors |
| Theo calls | WORKS (guarded shim) | WORKS | DEGRADED: account connector, unguarded | DEGRADED: as Part 8 row | DEGRADED |
| Statusline / side panel | WORKS: statusline + mos-face mod (plugin.json:13-16) | DEGRADED (GUESS: no terminal statusline; mods UNVERIFIED) | MISSING | MISSING: status_read on request only | MISSING |
| Dashboards | DEGRADED: CLI apps false (surface-detect.cjs:27); browser shell | DEGRADED: the misdetect (2.1) keeps app views registered (capability-registry.cjs:50-56); rendering in the Code tab UNVERIFIED | MISSING | DEGRADED: room-dashboard MCP App (app-views.cjs:324-326) through the bridge UNVERIFIED (SP6) | DEGRADED: mobile renders MCP Apps from remote connectors (radar 2026-03-25); bridged UNVERIFIED |
| Research runs | WORKS: quick in server, deep in Claude Code (research_run description) | WORKS | MISSING (nowhere to file) | DEGRADED: quick only; deep needs Claude Code | as merged chat |
| Eureka | WORKS (uv, /mos:eureka enable) | WORKS | MISSING | DEGRADED: engine tools run on the Desktop host only if enabled earlier from a shell | as merged chat |

## 8. UNVERIFIED list

Carried from the radar (.planning/quick/261127-hdl-surface-model-cowork-merged-into-chat/claude-surface-radar.md, "UNVERIFIED"):
1. Which component column (Chat or Cowork) the merged consumer conversation follows after it starts a Cowork task.
2. Whether a plugin-bundled stdio server runs on the user's computer (bridge) or in the cloud VM in a merged-chat cloud task.
3. The tool prefix `mcp__remote-devices__<server>__<tool>` and the names "remote devices" and "device bridge" (one Windows machine only).
4. The behaviour of a merged-chat task when Desktop quits mid-tool-call (two primary pages differ).
5. to 10. Dates and undated pages (radar items 5-10); not load-bearing for 405.
11. The MindrianOS install shape on claude.ai (no upload test run).

New in 405:
12. Whether one config stdio server process serves all merged-chat conversations on a computer, or one per conversation (decides SEED-039 exposure on the bridge). SP4.
13. Whether the local Code tab sets `CLAUDE_CODE_ENTRYPOINT=cli` and exports `CLAUDE_CODE_SESSION_ID` to plugin MCP children, and whether hooks.json fires there. SP5.
14. Whether the merged chat forwards a bridged server's `instructions` and renders its MCP Apps (`ui://`). SP6.
15. Whether a bridged tool call that loses its response leaves the write on disk (expected yes, since the server writes locally) and whether the model sees an error or a hang. SP2.
16. Whether `CLAUDE_PLUGIN_ROOT` is set inside the merged-chat sandbox, and so whether skill bash blocks would run against cloud-VM files. SP1.
17. Where Desktop's Customize install puts the `mos-desktop` files on disk, and whether lib/core/active-plugin-root.cjs (precedence at its header :14-25, which looks for `mos@mindrian-marketplace`) finds it. SP5.
18. Whether a `.mcpb` desktop extension appears through the bridge with the same prefix and survives a Desktop quit. SP7.
19. 367 plan 11 census and wrapper behaviour on the bridge: proven by unit tests on the branch (commits cb0dacf40, f2a867be4); not observed end to end in a merged chat. jsagi-42 owns it.
20. The count of brain-response-sanitize equivalents in the shim path (searched only for `sanitize` in scripts/mindrian-brain-mcp-client.cjs; no hit found).
