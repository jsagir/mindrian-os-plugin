---
status: resolved
kind: rca
trigger: "reach-sensor-relevance-gap"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: tier-0
canon_parts: [2, 3]
created: 2026-07-17T00:00:00Z
updated: 2026-07-17T20:15:00Z
root_cause_split: two-separate-root-causes
resolved_commits: [2cf99a11, 77050263]
---

## Source-of-Truth Preamble

- **CODE claims read against:** dev workspace `/home/jsagi/dev/MindrianOS-Plugin` @ dev HEAD, 2026-07-17. This filing has NOT yet read `lib/core/navigation-engine.cjs`, `lib/core/insight-sensors.cjs`, `lib/core/sensors/*.cjs`, or `scripts/intent-classifier.cjs` line-by-line -- it is filed from live, verbatim observational evidence captured across one long session's actual system-reminders, not from a code read. The debugger's first job is the code-level root-cause; this file supplies real symptom transcripts, not a guess at the mechanism.
- **WIRE claims probe against:** n/a, Tier 0 confirmed in every observed instance ("BRAIN.md absent" / "SIGNAL (none this turn)"), no Brain calls implicated.
- **Date of audit:** 2026-07-17.
- **Re-verification rule:** every symptom below is a verbatim excerpt from this session's own actual system-reminders, not paraphrased from memory.

## Current Focus

status: navigator APPROVED A1 + B1 (two separate commits, A1 first). Implementing now.

fix_reasoning_checkpoint:
  A1:
    hypothesis: "CLI read key (sha256 hash fallback) never matches the MCP write key (session UUID) because resolveSessionId ignores the hook stdin payload's session_id field."
    fix: "extractSessionId(STDIN_RAW) lifts the payload session_id; resolveSessionId prefers it (payload.session_id -> CLAUDE_SESSION_ID -> sha256 fallback). CLI read key now == MCP write UUID."
    falsification_test: "Write a UUID-keyed binding via writeSessionBinding(UUID,...); spawn the classifier with a hook payload carrying session_id=UUID and env CLAUDE_SESSION_ID UNSET, on a message whose top room IS the bound room -> the F.8 binding gate must NOT fire (onScope). The SAME setup WITHOUT the payload session_id (pre-fix path) falls to the hash and DOES fire."
    fix_rationale: "Addresses the ORIGIN (key derivation), not the symptom (gate firing). Env-independent: reads the payload the hook always passes, so it also un-breaks Phase 225's zero-score gate (same resolveSessionId key source)."
  B1:
    hypothesis: "The reach dial render seam has no structural relevance check; cross_room (registry_only, always offered) fills {room_name} with the CURRENT room (borrow-from-self) and surfaces off-topic."
    fix: "buildDialSlotContext stops filling cross_room's {room_name} with the current room (header now reads a dedicated header_room slot); a pure reach-relevance-gate compares live-turn tokens to each reach's cross-room slot content and drops off-topic cross_room via the existing suppressedReachIds path in buildReachList."
    falsification_test: "renderEngineDecisionWithDial with a live off-topic turn + a cold roomContext -> the reachList handed to renderDial EXCLUDES cross_room. With a genuinely-different relevant target room whose tokens overlap the live turn -> cross_room is KEPT. Empty live turn -> no suppression (byte-identical to today)."
    fix_rationale: "Machinery enforces relevance instead of delegating it to advisory model text. Independent of A: even with A fixed, an unrelated room could fill the reach slot; the gate closes that."

next_action: implement A1 in scripts/intent-classifier.cjs (extractSessionId + resolveSessionId), add tests/test-226-session-binding-key-alignment.cjs, verify, commit A1; then implement B1 + tests, verify, commit B1.

reasoning_checkpoint:
  hypothesis_A: "The session-binding gate re-fires every turn because the MCP write path and the CLI read path key the session binding under DIFFERENT sessionIds. MCP `room_bind` writes `.rooms/sessions/<UUID>.json` (extra.sessionId = the real Claude session UUID); the CLI UserPromptSubmit hook (intent-classifier `resolveSessionId`) reads under `process.env.CLAUDE_SESSION_ID` which is UNSET in the hook, so it falls back to `sha256(roomDir+ISO-day)[:12]`. The two keys never match, so `runBindingGate` always reads the empty safeDefault {bound:[]}, `onScope` is always false, `fire` is always true. The room subset differs each turn because `topRoom = best.name` is the top token-matched room for THAT message."
  hypothesis_B: "The reach dial render seam has NO structural relevance check. `cross_room` is a permanent member of the 6-reach bank (registry_only, default 0.5) so it always appears in the offered top-3 in a cold/tier_0 room; its {room_name}/{topic} slots are filled by `buildDialSlotContext` from `path.basename(roomDir)` and `roomContext.relevantNodes[0]/cortexNodes[0]` -- never compared against the live turn text. Nothing in dispatchSensors -> buildReachList -> buildDialSlotContext -> composeLabel -> renderDial compares candidate reach content to the conversation. The ONLY relevance filter is the advisory AskUserQuestion/FIRE-IF-FORK trailer text the model self-applies."
  confirming_evidence:
    - "(A) On-disk: ALL five `.rooms/sessions/*.json` binding files are UUID-named (e.g. 3a73764e-...=this session, bound rethinking-mindrianos). NO 12-hex-char binding file exists."
    - "(A) On-disk: today's decision-trace in rethinking-mindrianos is `ddd3356b7f64.json`. Computed sha256('/home/jsagi/MindrianRooms/rethinking-mindrianos'+'2026-07-17')[:12] === ddd3356b7f64 EXACTLY -> proves CLAUDE_SESSION_ID is unset in the hook and the reader uses the hash key, which no binding file matches."
    - "(A) Code: tool-router.cjs:1462 effectiveSessionId = sessionId||extra.sessionId; intent-classifier.cjs:876-889 resolveSessionId reads only process.env.CLAUDE_SESSION_ID then sha256 fallback; the classifier reads the hook stdin payload (extractMessage) but NEVER extracts its `session_id` field."
    - "(A) Phase 225 RESEARCH.md:236-241 documents the CLAUDE_SESSION_ID-missing sha256 fallback but treats it as a TEST-FIXTURE concern ('set it explicitly in fixtures'), never as the production MCP-UUID vs CLI-hash mismatch -> Phase 225 (zero-score gate SEED-039) did NOT cover this; separate uncovered gap, not a regression."
    - "(B) Code: buildReachList REACH_DEFS has cross_room as a permanent registry_only member (0.5 default); buildDialSlotContext (intent-classifier:1062-1082) sets room_name=basename(roomDir) and topic=relevantNodes[0]||cortexNodes[0] with zero live-text comparison; dial-presenter + composeLabel are pure render."
  falsification_test_A: "If CLAUDE_SESSION_ID WERE set in the hook, the decision-trace key would be a UUID, not ddd3356b7f64. It is the hash -> confirmed unset. If room_bind wrote under the hash key, a 12-char binding file would exist. None do -> confirmed UUID writer."
  fix_rationale_A: "Making the CLI reader derive its sessionId from the hook stdin payload's `session_id` field (the real UUID Claude Code passes) aligns the read key with the MCP write key at the root, so the binding the user set is actually seen. This fixes the ORIGIN (key derivation), not the symptom (gate firing)."
  fix_rationale_B: "Adding a structural relevance gate (compare candidate reach room/topic tokens against the live turn tokens, suppress cross_room/off-topic rows below a floor) makes the machinery enforce relevance instead of delegating it to advisory model text. Independent of A: even with A fixed, an unrelated top graph node could still fill the reach slot."
  blind_spots:
    - "(A) Have not confirmed whether Claude Code ALSO fails to export CLAUDE_SESSION_ID on macOS/Desktop, or only in this WSL2 CLI env -- fix should read the payload session_id regardless so it is env-independent."
    - "(A) Need to confirm the MCP extra.sessionId is byte-identical to the hook payload session_id (both are the Claude session UUID); the 3a73764e match to this session's scratchpad UUID strongly implies yes but a live room_bind + hook round-trip would prove it."
    - "(B) Have not decided the relevance metric (token overlap vs cortex-node recency vs problem-state bind) -- that is a fix-design choice for the navigator."

next_action: present the two split root causes + concrete fix options at the checkpoint; do NOT edit code until the navigator picks a fix direction (investigation directive is explicit: bring options first, no silent auto-fix).

## Meta

- Repo: `/home/jsagi/dev/MindrianOS-Plugin`
- Plugin version: v1.15.3-beta.27 (dev HEAD) / v1.15.3-beta.24 (this session's actual running install, per its own SessionStart hook)
- Reported by: this session, live, observed across dozens of turns
- Date first observed: this session, 2026-07-17 (not independently checked against prior sessions)
- Related: `.planning/phases/225-per-session-room-binding-and-multi-session-reconciliation-se/` (the existing SEED-039 gap-closure work on session binding -- (A) may or may not already be covered); `.planning/debug/card-fire-relevance-check-gap.md` (the sibling filing for `check-card-fire.cjs`'s own relevance gap -- CONFIRMED this session to be a structurally similar but NOT code-identical mechanism: check-card-fire keys off a render-coverage-registry + an output-text backstop, not the REACH sensor's own output, so this filing and that one are same-class, different-code, per that filing's own Eliminated section)

## Problem Statement

Per-turn navigation machinery (the session-binding gate and the REACH/reach-candidate sensor dispatch) generates user-facing prompts/suggestions without a structural check that the content is actually relevant to the live conversation. The only filter observed is advisory instruction text telling the model to judge relevance itself before dispatching a card -- which worked in this session only because the model consistently applied that judgment, not because the underlying mechanism enforces it.

## Symptoms

expected: the binding gate fires once (or when session state genuinely changes), not on every turn with a different random room subset; REACH suggestions surface content topically connected to the live conversation, or nothing at all.

actual, verbatim from this session's own system-reminders:

Binding gate, three separate instances (same session, different turns, non-identical room lists each time -- note the room orderings/subsets differ across all three despite no binding-relevant action occurring between them):
```
Turn N:   ✓ 1. untitled-2026-06-01-1702 / ▢ 2. haim-battlefield-intake / ▢ 3. rethinking-mindrianos / ▢ 4. dhi-prolonged-field-care
Turn N+9: ▢ 1. pws-website / ▢ 2. mindrianOS / ▢ 3. align-ecosystem / ▢ 4. iia-deeptech-centers
Turn N+18:✓ 1. haim-battlefield-intake / ▢ 2. rethinking-mindrianos / ▢ 3. untitled-2026-06-01-1702 / ▢ 4. iris2026
```
All three carry: "session unbound: choose which room(s) this session writes to" -- despite `room_bind` having returned `{"ok":true,"bound":true,"primary":"rethinking-mindrianos"}` earlier in the same session.

REACH sensor, cold-start suggestion with zero conversational connection (session was mid-way through a Windows-update-testing conversation, not touching the room or claim named):
```
fire_skill: Run Methodology
■ iris2026 - REACH - decision gate
▼ LOCAL iris2026 (cold) / BRAIN (offline) / SIGNAL (none this turn)
New room - nothing to rank yet. Start anywhere.
→ Choose next reach: ▷ Borrow what iris2026 learned about claim:derive:5c15cde4...
```
error message: none (not a hard error/block -- unlike layer 1, this is a soft over-suggestion, not a hard-fail).
timeline: observed continuously across one long session, 2026-07-17.
reproduction: not yet reduced to a minimal repro -- observed as a standing characteristic of every turn in a long multi-topic session, not tied to one specific action.

## Eliminated

- hypothesis: this is literally the same code path as `check-card-fire.cjs`'s over-firing (layer 1).
  evidence: `.planning/debug/card-fire-relevance-check-gap.md` confirmed `check-card-fire.cjs`'s primary detection keys off `data/render-coverage-registry.json` gate-reaching entries and a separate output-text backstop -- neither reads the REACH sensor's own suggestion content as its trigger. Same failure CLASS (fires without a relevance check), different code. Rejected as literally the same bug.
  timestamp: 2026-07-17T00:00:00Z

- hypothesis: (A) and (B) are ONE shared root cause (a single per-turn mechanism firing without a relevance check).
  evidence: DISPROVEN by code read + filesystem evidence. (A) is a sessionId-namespace mismatch in the session-binding read/write plumbing (`resolveSessionId` reads the wrong key source vs. what `room_bind` writes) -- it is a STATE-PLUMBING bug, and the "relevance" it lacks is really "does the reader see the binding at all". (B) is a genuine missing structural relevance gate in the reach-dial render seam (`buildDialSlotContext`/`buildReachList` fill and rank reaches with no comparison to the live turn). Different files, different mechanisms. They share a surface symptom (both keep surfacing "iris2026") and are causally linked (A leaves active-room resolution unanchored, feeding B a stale room), but fixing one does NOT fix the other. Split into two root causes; two separate fixes.
  timestamp: 2026-07-17T18:00:00Z

- hypothesis: (A) is a regression of Phase 225's SEED-039 fix, or Phase 225 already covers it.
  evidence: DISPROVEN. Phase 225 (225-01) replaced the `best.score === 0` blanket `return 0` with a zero-score no-match gate (emitNoMatchGate). That is a DIFFERENT gate branch. Phase 225-RESEARCH.md:236-241 explicitly names the `CLAUDE_SESSION_ID`-missing sha256 fallback but classifies it as a test-fixture hazard ("set it explicitly in fixtures"), never as the production MCP-writes-UUID / CLI-reads-hash mismatch. Phase 225's own zero-score branch ALSO calls `resolveSessionId(roomDir)` + `readSessionBinding` and therefore inherits the same latent mismatch (it can never find a bound primary in this env). Uncovered gap, not a regression.
  timestamp: 2026-07-17T18:00:00Z

## Evidence

- timestamp: 2026-07-17T18:00:00Z
  checked: "MCP write path -- lib/mcp/tool-router.cjs:1443-1491 room_bind + lib/mcp/session-registry.cjs (D-02 one-namespace design pin) + bin/mindrian-mcp-server.cjs main() transport wiring."
  found: "room_bind writes writeSessionBinding(effectiveSessionId, {primary:room, bound:[room]}) where effectiveSessionId = sessionId_arg || extra.sessionId. The CLI/Desktop path uses a plain StdioServerTransport (server.cjs:387-388) with NO session-registry wiring on the flag-OFF stdio path. session-registry.cjs comment admits the hook->connection sessionId bridge is a 'future stdio shim', i.e. UNBUILT."
  implication: "The binding is written under the MCP-supplied session id (the Claude session UUID). Confirms the writer side of the (A) mismatch."

- timestamp: 2026-07-17T18:00:00Z
  checked: "CLI read path -- scripts/intent-classifier.cjs:876-889 resolveSessionId + lib/workflow/session-binding-consumer.cjs runBindingGate + lib/core/session-binding.cjs readSessionBinding."
  found: "resolveSessionId(roomDir) returns process.env.CLAUDE_SESSION_ID if set, else sha256(roomDir+ISO-day)[:12]. runBindingGate -> resolveSessionScope -> readSessionBinding(sessionId) -> file `.rooms/sessions/<sessionId>.json`; on miss returns safeDefault {bound:[]}. onScope = bound.indexOf(topRoom)!==-1; fire = !onScope. The classifier reads the hook stdin payload (extractMessage, :326-351) but only pulls the MESSAGE fields; it NEVER reads the payload `session_id`."
  implication: "With CLAUDE_SESSION_ID unset, the reader key is the hash -- a different namespace from the UUID writer. bound is always [] -> fire is always true. Confirms the reader side of the (A) mismatch and the exact fix surface (extract session_id from the stdin payload)."

- timestamp: 2026-07-17T18:00:00Z
  checked: "Live filesystem: $HOME/MindrianRooms/.rooms/sessions/ and each room's .mindrian/decision-traces/; env CLAUDE_SESSION_ID."
  found: "All 5 binding files are UUID-named (3a73764e-...=this session's UUID, bound+primary rethinking-mindrianos). NO 12-hex binding file exists. Today's decision-trace in rethinking-mindrianos is ddd3356b7f64.json. sha256('/home/jsagi/MindrianRooms/rethinking-mindrianos'+'2026-07-17')[:12] === ddd3356b7f64 (computed, exact). CLAUDE_SESSION_ID is unset in the shell."
  implication: "SMOKING GUN for (A): reader computes ddd3356b7f64 (hash), writer stored 3a73764e-... (UUID). The reader looks for `.rooms/sessions/ddd3356b7f64.json`, which does not exist -> empty binding -> gate fires every turn with a per-message top-match room subset. Root cause (A) proven end-to-end from code AND disk."

- timestamp: 2026-07-17T18:00:00Z
  checked: "Reach dial chain -- lib/hmi/dial-reach-orchestrator.cjs buildReachList, scripts/intent-classifier.cjs:1062-1144 buildDialSlotContext + renderEngineDecisionWithDial, lib/hmi/dial-presenter.cjs renderDial/_buildDecisionGateHeader, lib/hmi/dial-label-composer.cjs composeLabel, lib/core/insight-sensors.cjs dispatchSensors."
  found: "No stage compares candidate reach content to the live turn text. cross_room is a permanent registry_only member of REACH_DEFS (0.5 default) so it is always offered in a cold/tier_0 room. slotContext.room_name=basename(roomDir); slotContext.topic=relevantNodes[0]||cortexNodes[0]. dial-presenter header context label = slotContext.room_name. composeLabel just fills templates. dispatchSensors fires on signals/side-channel freshness/cortex scalars, not on live-text topical match. The only relevance filter is the advisory AskUserQuestion/FIRE-IF-FORK trailer the model self-applies."
  implication: "Root cause (B) proven: relevance is delegated entirely to advisory model instruction; the reach machinery has no structural relevance gate. cross_room even fills {room_name} with the CURRENT room (borrow-from-self) because buildDialSlotContext never resolves a different, relevant room via getNeighborhood."

## Resolution

root_cause_A: "SessionId-namespace mismatch between the MCP binding writer and the CLI binding reader. `room_bind` (lib/mcp/tool-router.cjs:1462-1469) writes the session binding keyed by the MCP/Claude session UUID (`extra.sessionId`). The CLI UserPromptSubmit hook (scripts/intent-classifier.cjs `resolveSessionId`, :876-889) reads the binding keyed by `process.env.CLAUDE_SESSION_ID`, which is UNSET in the hook process, so it falls back to `sha256(roomDir+ISO-day)[:12]`. The classifier already receives the real session UUID in its hook stdin payload's `session_id` field but never extracts it. Because the read key (hash) never matches the write key (UUID), `readSessionBinding` always returns the empty safeDefault, `runBindingGate` always computes onScope=false / fire=true, and the F.8 binding gate fires on every turn -- with a different candidate room subset each turn because `topRoom = best.name` is the top token-matched room for that message. Uncovered by Phase 225 (which fixed the separate zero-score gate branch and treated the CLAUDE_SESSION_ID fallback as a test-fixture concern)."
  files_A: ["scripts/intent-classifier.cjs (resolveSessionId + the stdin payload parse that discards session_id)", "lib/mcp/tool-router.cjs (room_bind effectiveSessionId)", "lib/core/session-binding.cjs (read/write key)", "lib/workflow/session-binding-consumer.cjs (runBindingGate consumer of the key)"]

root_cause_B: "Missing structural relevance gate in the reach-dial render seam. The 6-reach bank (lib/hmi/dial-reach-orchestrator.cjs buildReachList) always includes `cross_room` (registry_only, 0.5), so in a cold/tier_0 room it is offered by default; its {room_name}/{topic} slots are filled by scripts/intent-classifier.cjs buildDialSlotContext (:1062-1082) from `path.basename(roomDir)` and `roomContext.relevantNodes[0]||cortexNodes[0]`, with NO comparison against the live turn text. Neither dispatchSensors, buildReachList, buildDialSlotContext, composeLabel, nor renderDial performs a topical-relevance check. Relevance is delegated entirely to the advisory AskUserQuestion/FIRE-IF-FORK trailer that the model is instructed to self-apply. When active-room resolution is stale (a consequence of root_cause_A) or the top graph node is unrelated to the conversation, the card surfaces a topically-disconnected room+claim (the observed iris2026 + claim:derive:5c15cde4 case). Independent of A: fixing A anchors the room but does not add the missing content-relevance gate."
  files_B: ["scripts/intent-classifier.cjs (buildDialSlotContext + renderEngineDecisionWithDial)", "lib/hmi/dial-reach-orchestrator.cjs (buildReachList cross_room default membership)", "lib/core/insight-sensors.cjs (dispatchSensors has no relevance gate)", "lib/hmi/dial-label-composer.cjs / lib/hmi/dial-presenter.cjs (pure render, no gate)"]

fix_A: "scripts/intent-classifier.cjs: new extractSessionId(STDIN_RAW) lifts the session_id the UserPromptSubmit hook already passes in its stdin payload (the SAME Claude session UUID the MCP room_bind writer keys the binding under); resolveSessionId now prefers it -- resolution order payload.session_id -> process.env.CLAUDE_SESSION_ID -> sha256(roomDir+ISO-day)[:12]. The CLI READ key now equals the MCP WRITE UUID, so readSessionBinding sees the bound room, onScope becomes true when the top room is bound, and the F.8 gate stops firing every turn. Env-independent, so it also un-breaks Phase 225's zero-score gate (same resolveSessionId key source). Commit 2cf99a11."
  fix_B: "buildDialSlotContext (scripts/intent-classifier.cjs) no longer borrows the current room into cross_room's {room_name}: the current room fills a dedicated `header_room` slot (dial-presenter._buildDecisionGateHeader now reads header_room for the decision-gate context label), and {room_name} holds only a genuinely DIFFERENT cross-room target resolved from the room graph (resolveCrossRoomTargetSlug scans relevantNodes/cortexNodes for a room:/cross_room: id or a room/target_room/cross_room property), else nothing. New pure LOCAL-only lib/hmi/reach-relevance-gate.cjs computeOffTopicReachIds compares live-turn tokens to the cross_room slot content and returns the off-topic reach_ids; renderEngineDecisionWithDial merges them into the existing suppressedReachIds drop path, so buildReachList drops them and the render seam stays pure. No-op when there is no live turn. Commit 77050263."
  verification: "A1: tests/test-226-session-binding-key-alignment.cjs -- a UUID-keyed binding (exactly what room_bind writes) is seen ON-SCOPE (gate SILENT) when the hook payload carries session_id=UUID and CLAUDE_SESSION_ID is unset; the SAME binding with NO payload session_id FIRES the gate under the hash key (the pre-fix production path); the UUID binding is also visible to the Phase 225 zero-score gate. B1: tests/test-227-reach-relevance-gate.cjs -- off-topic/target-less cross_room is dropped, a relevant DIFFERENT target is kept, borrow-from-self is suppressed, no-live-turn is a no-op; the render seam integration confirms cross_room is excluded from the dial for an unrelated conversation and kept for a relevant one. Symptom 1 (gate firing every turn with different room subsets) verified fixed by A1; Symptom 2 (cross_room surfacing off-topic + borrow-from-self in a cold room) verified fixed by B1. Regression: full phase-194/225 PSB suites GREEN; dial/reach/render suite GREEN (test-209-engine-arm-contract updated to the header_room contract and passing); render-coverage + born-wired gates GREEN. Pre-existing, unrelated test-203-reach-sensor REJECT/DEFER db-write failures confirmed present on origin/main (byte-identical test file) and with B1 stashed -- NOT a regression of this fix."
  files_changed: ["scripts/intent-classifier.cjs", "lib/hmi/reach-relevance-gate.cjs", "lib/hmi/dial-presenter.cjs", "tests/test-226-session-binding-key-alignment.cjs", "tests/test-227-reach-relevance-gate.cjs", "tests/test-209-engine-arm-contract.cjs"]
