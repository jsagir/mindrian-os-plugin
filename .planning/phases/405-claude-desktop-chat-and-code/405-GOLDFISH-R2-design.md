---
phase: 405
round: 2
reviewer: egm-design (design critic)
target: 405-DESIGN.md r2.1
counts: {blocker: 2, major: 14, nit: 10}
verdict: not clean
note: "The reviewer is read-only; the main session saved its report. It read the r2.1 copy in the release worktree before the move."
---

# 405 GOLDFISH R2: design critic

## Blockers

- DC2-B1 (3.5, G6, OR-4, Part 9): the design fails OR-4; GB1 is only partly fixed. The refused set is "room_create and any card whose subject is a proposed claim", but promotion paths are wider: lib/mcp/tools/gate.cjs:238 promotes `claim` or `opportunity`; gate.cjs:250 promotes claims in `needs_evidence`; lib/core/strategy/goal-gate.cjs:241 confirms strategy-card subjects through confirmNode; TRUTH_CLAIM_TYPES (lib/core/navigation/transitions.cjs:47) has claim, CausalClaim, assumption, decision, opportunity, SyntheticExpert. A text-rung approve of an opportunity or goal card on P4 still promotes a truth claim. Fix: define the refused set by effect: refuse room_create and every approve that would promote a TRUTH_CLAIM_TYPES node other than the gate's own decision node (incl. opportunity, needs_evidence, goal-gate ratification); AC4.1 one fixture per path (gate.cjs:124, :256, goal-gate.cjs:241).
- DC2-B2 (3.7a .mcpb build, AC5a.3): the drop list removes files the server reads at run time, silently. lib/mcp/tool-router.cjs:749-767 `loadReference` reads `commands/<cmd>.md` ("a miss is a silent no-op"); lib/core/review-contract.cjs:173-180 builds the artifact_file review denylist from `agents/` (missing folder returns `[]`, weaker guard, no error); lib/ui/design-system.cjs:10 reads `skills/ui-system/...css`. AC5a.3 checks only initialize and tools/list. Fix: keep every folder the server reads (grep for `path.join(<root>, 'commands'|'agents'|'skills'|'references')`, not require-graph reachability); AC: an artifact_file call and a reference-backed tool give the same result on the unpacked extension and the plugin copy.

## Majors

- DC2-M1 (3.7a, SP7, R13): Desktop runtime checked by version only; the built-in Node can be Electron-embedded (node:sqlite may be absent; `process.execPath` may be the app binary); the 367 wrapper spawns with `cp.spawn(process.execPath, ...)` (367 graph-catchup-spawn.cjs:140); A1/A2 used a config server, not an extension. Fix: SP7 legs for `require('node:sqlite')` with `timeout` honored, the spike 012 detached-runner leg from inside the extension, and `process.execPath`; any failure applies If B.
- DC2-M2 (3.6, 3.7a, slice 5b, OR-7): on the primary route chat has no guarded Brain route (the extension carries the room server only unless one manifest holds two servers; if SP7 = A, 3.7b is cut); AC5b.3, AC5b.4 serve a path that does not exist there; the new THEO line drops "only when available". Fix: decide the chat Brain route now: (a) brain tools served from the room server; (b) a second extension; (c) theo-context is the only chat route and shim ACs go behind the config fallback. Keep "when available".
- DC2-M3 (3.6, R4, SP6): Part 8 in chat "holds by instruction text", but instructions forwarding through the bridge is UNVERIFIED (RESEARCH 2.3, item 14) and SP6 does not test it. Fix: SP6 canary leg (token in the instructions, ask the model to quote the THEO line); if not forwarded, put "no room content to any Theo server" in the room_bind result or room_list description.
- DC2-M4 (3.6, G4, OR-7): theo-context is assumed in the user's chat but never installed, entitled or checked (moat.md install-time entitlement); generative UI rendering untested. Fix: a distribution line (connector URL and auth, or "owner supplies"), an SP leg rendering one theo-context card in the merged chat, a `theo_context_absent` doctor or status_read state.
- DC2-M5 (3.5, 3.8 Network, R5): "ordinary" P4 cards include material actions and egress approvals: `material_step` resumes chain work (gate.cjs:1098, :1710-1730); the research_run search-string approval is the 3.8 network mitigation; every approve confirms the decision node via `resolveByUser` (gate.cjs:839-843). Fix: within OR-4 define "ordinary": put material_step resumes, research egress approvals and spawn-class approvals in the human-required set on P4, or state in 3.8 and R5 that they are model-relayable; pin the `mcp_relayed` reason with a test.
- DC2-M6 (3.3 client_write_id, Part 7): (a) keys already exist: memory_event `dedupe_key` 60 s (graph.cjs:269-270), claim_write upsert on source segment (claim.cjs:107); (b) same id with a different payload is silently dropped; (c) a slow call and a retry can both read "absent" (artifact_file writes outside the transaction, views.cjs:284); (d) no column named, no JSON-expression index, schema-stamp chain (room-db.cjs:270-294). Fix: reconcile with existing keys; store a payload hash, `client_write_id_conflict` on mismatch; check and claim in one BEGIN IMMEDIATE with a unique constraint; name the column and the migration with its own AC.
- DC2-M7 (3.7a, R12): three artifacts write one room.db; the schema stamp is a source hash (room-db.cjs:270-281), not an ordered version, so alternating versions re-run migrations; no downgrade guard; a hand-installed .mcpb does not update with the marketplace; `extension_version_drift` is doctor-only, and the doctor does not run in chat. Fix: status_read and room_list report drift; an ordered schema floor that refuses writes with `room_schema_newer`; AC with two versions on one fixture room.
- DC2-M8 (6 SP7 If B, 5): If B can drop or change the OR-6 artifact with no owner step; a system-Node variant is not one click (OR-6 says the Node that ships with Desktop). Fix: SP7 = B returns NEEDS_HUMAN with the evidence.
- DC2-M9 (3.5 app card B3.2, SP6 leg c, R10): `ui://` resources are registered templates, one body per URI, so a per-gate nonce cannot live in the resource body; it must ride in the gate_render result, which the host may show the model; in-memory nonces die on a quit; on a shared process one chat's app can answer another's card; answer-route.cjs:88-105 is token-HMAC, the new path is a bearer nonce. Fix: name the carrier (a tool-result `_meta` field for the app only) and test the model cannot read it; single-use nonce bound to gate_id and binding with a TTL; typed `card_expired` after restart; keep `routeOf` unchanged, add a separate check.
- DC2-M10 (3.8 process-spawning): the Eureka engine spawn on an injected call is "UNVERIFIED, listed for slice 2 review" but slice 2 has no AC, file or test. Fix: add an AC, or refuse Eureka spawns on P4 (`MINDRIAN_MCP_FIRST=desktop`) until reviewed.
- DC2-M11 (3.2, 3.5, G1, OR-2, OR-5): first-room birth and adopt are impossible in chat (room_create refused on the text rung; no elicitation; `/mos:rooms adopt` is a bash skill running scripts/room-registry). Fix: state it as a user-visible state; on P4 the refusal routes birth and adopt to the local Code tab; AC on the P4 wording.
- DC2-M12 (3.7a, 3.7b, GM7): the heartbeat proves Desktop spawned the server, not that the merged chat reaches it (a Code-tab spawn has the same parent). Fix: a separate `chat_reached` on the first tools/call with clientInfo `claude-ai` and no `CLAUDE_CODE_ENTRYPOINT`; the doctor reports both.
- DC2-M13 (3.3, R2, GM4): a receipt still cannot tell which disk: with no SP3 marker, a VM birth creates a VM registry (R2) and later writes return `read_back: true`. Fix: add the salted host hash and `cloud_session` to the receipt; mark GM4 conditional on SP3.
- DC2-M14 (3.7a bundled dependencies): `sqlite-vec` (package.json:84) loads a native extension (lib/core/semantic-index/vector-store.cjs:122-127) from a per-OS optional package; `npm ci` on Linux/WSL bundles only that binary (369.1 avoided this with per-machine installs). Fix: one .mcpb per OS and arch, or bundle every optional platform package; AC on Windows and macOS that the vector leg loads or degrades with a typed reason.

## Nits

- DC2-N1: the birth fence is "under the user's home directory" in 3.2 and "under the rooms home" in 3.8; use the rooms home.
- DC2-N2: 3.3 says the instructions stay byte-identical, 3.6 changes the THEO line; refer 3.3 to AC7.0.
- DC2-N3: GB6 CUT says the fence moved into "the room scripts"; no slice changes scripts/room-registry. Correct it so the CUT rests on the SP1 reopen.
- DC2-N4: the .mcpb is not listed as an asset; an unsigned extension can be impersonated and admins can block unsigned ones. Add `mcpb sign` or a residual.
- DC2-N5: parent-executable basename on Windows needs a child process (no /proc); state the method and a time budget for status_read.
- DC2-N6: a user_config rooms home that differs from MINDRIAN_ROOMS_HOME refuses every write (fails closed); add `rooms_home_mismatch`.
- DC2-N7: the readChangeLogMeta range can include 367-runner writes; call it the observed range.
- DC2-N8: "theo-context cards" is ambiguous and the frozen BOUNDARIES names only mindrian-brain; within budget say "no room content to any Theo server".
- DC2-N9: "one install path" is two installs (Customize plugin for skills, .mcpb for the server); say so or reword G1.
- DC2-N10: MCP prompts as slash commands in the merged chat has a secondary source only; mark UNVERIFIED or add to SP6.

## Round 1 outcomes checked

Partly fixed: GB1 (DC2-B1), GM4 (DC2-M13), GM7 (DC2-M12). GB6 CUT justification wrong (DC2-N3), reopen trigger valid. GM5 CONTESTED holds (artifact_file overwrites the same path on retry, views.cjs:283-284; SP2 covers the kill seam). ZO-N2 CONTESTED holds through PA-2. Other FIXED items hold.

No finding says a locked ruling is wrong. DC2-B1: the design fails OR-4. DC2-M8: If B can fail OR-6 and must go to the owner.
