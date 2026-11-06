---
status: fixing
kind: rca
trigger: "part8-no-split-route-for-bodies-and-private-claims"
issue_id: "E-SPROUT-DESIGN"
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8, 9]
created: 2026-11-06T12:00:00Z
updated: 2026-11-06T12:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ 892ab2de4 (working tree of /home/jsagi/dev/MindrianOS-Plugin-release, plugin 2.0.0-beta.80), after plans 386-25, 386-30 and 386-37.
- **WIRE claims probe against:** none. No Brain call, no network. The wire is a stub: `globalThis.fetch` is replaced by a counter.
- **Date of audit:** 2026-11-06
- **Re-verification rule:** each claim carries PROVEN (run in this session), UNVERIFIED or ASSUMED. Source: owner direction of 2026-11-06 (PRD sections Owner principle for Part 8 and Owner direction on ambiguous calls and over-blocking).

## Current Focus

hypothesis: every refusal of the egress guard is a plain block with a reason and no guide. A body of text, an edge that fails a prose rule and a short private claim are refused or sent unchecked, and nothing tells the host model how to carry on. So contextualised work is crippled (refusal) or unprotected (unchecked allow).
test: run 5 synthetic strings through classify, the callTool and ask verbs and the hook child process; read the typed packet schema for a job that carries a free sprout; read the claim writer and the meeting filing.
expecting: no refusal carries a guide; no packet job carries a sprout without a room-derived string; the claim writer and the ordinary typed read calls are enough to build the split route.
next_action: build lib/core/part8-split-route.cjs (Task 3 of plan 386-42).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release
- Plugin version: 2.0.0-beta.80
- Reported by: owner direction of 2026-11-06 (card)
- Date first observed: 2026-11-06
- Related debug sessions: part8-no-shape-test-for-sprouts-and-bodies (plan 386-37), part8-ambiguous-verdict-is-sent-on-own-shim (plan 386-26), part8-over-blocks-ordinary-theo-and-context-questions (plan 386-32)

## Problem Statement

A long text, an edge or a short private claim that needs the Brain is either refused with no guide (a plain block) or sent with no body check (an unchecked allow). The owner rejected a bare block: the work must be context based, the way the meeting filing breaks text into typed claims.

## Symptoms

<!-- IMMUTABLE once the investigation starts -->

expected: a body or a private claim is split into typed claims. The room claims stay local as proposed claims. Only generic sprouts go to the Brain. The answer is assembled locally.
actual: a body or private claim with a room word gets the refusal "Canon Part 8: outbound Theo payload carries room content (...). Blocked." and nothing else. A body with no room word is sent as is.
errors: hook exit 2 with an 88 byte or 99 byte stderr line; ask() returns egress_blocked with a one line reason.
reproduction:
  1. Scratch script (not committed): /tmp/claude-1000/-home-jsagi/7d57c6ef-4a06-4170-af16-564c4ba5e1a6/scratchpad/repro42.cjs.
  2. It runs 5 synthetic strings through classify (tool brain_ask, no room), callTool and ask with a fetch counter, and the hook child process (PART8_FORCE_BRAIN_AVAILABLE=1, tool name mcp__plugin_mos_mindrian-brain__brain_ask).
  3. Read the verdict, the class, the fetch count, the hook exit code and the refusal text.
started: Phase 245 (the content block); the sprout shape helper of plan 386-37 is the first piece of the fix.

## Scope and Impact

- Affected surfaces: cli (hook), desktop and cowork (callTool through the shim).
- Affected users: every install, on any call that carries more than a keyword query.
- Severity: high.
- Blast radius: plans 386-26, 386-27, 386-33 (ambiguous calls and guard classes) use the typed outcome built here.

## Eliminated

- hypothesis: a packet job of data/brain-packet-schema.json can carry the sprouts.
  evidence: all 12 jobs require active_context and local_graph_summary, and both hold room-derived strings (focus node id and summary, claim ids and summaries, contradiction explanations, banked opportunity hashes). No job takes a free generic string without them. PROVEN by reading the schema.
  timestamp: 2026-11-06T12:00:00Z
- hypothesis: sendPacket is a live route that only needs a new job.
  evidence: sendPacket has zero production callers (PARKED note above sendPacket in lib/core/brain-client.cjs, Phase 239 BRAIN-03). Wiring it is net-new work outside this plan. PROVEN by reading the file.
  timestamp: 2026-11-06T12:00:00Z

## Evidence

### Today outcome of 5 synthetic strings (tool brain_ask, no bound room; every string invented)

| Id | Kind | Words | classify | callTool fetches | ask() result | Hook exit | Guide in the refusal |
|----|------|-------|----------|------------------|--------------|-----------|----------------------|
| a | 47 word private paragraph with an invented person name and a company word | 47 | block / room_content | 0 | egress_blocked / room_content | 2 | no |
| b | 3 sentence body, no name, no deny-list word | 15 | allow / generic_question | 1 (2 with the handshake) | sent | 0 | no (nothing refused) |
| c | edge with an invented person name (13 to 20 words, fails the name rule) | 16 | block / room_content | 0 | egress_blocked / room_content | 2 | no |
| c2 | edge with no name (16 words) | 16 | allow / generic_question | 1 | sent | 0 | no (nothing refused) |
| d | short private claim, my customers and my pricing | 5 | block / room_content (private_context) | 0 | egress_blocked / room_content | 2 | no |
| e | clear sprout, swot analysis | 2 | allow / typed_question | 1 | sent | 0 | no (nothing refused) |

today_body_class: allow
today_edge_class: room_content
today_private_sprout_class: room_content

Note: a body with a person name (row a) is class room_content. A body with no name (row b) is allowed and sent as is, so a body leaves unchecked by shape. The guard has no body test yet; plan 386-33 adds the class that answers sprouts_required.

No refusal today carries a guide: the hook stderr is one line ("Canon Part 8: outbound Theo payload carries room content (room_content, name). Blocked.") and the ask() reason is one sentence that ends with "Ask it in ... words". Neither names a route nor says how to split the text. PROVEN (stderr and reason text read in the repro).

### Census of the existing parts (Part 7, reuse before build)

- Claim types: KNOWLEDGE_TYPES of lib/core/navigation/typed-claim.cjs has 6 members: fact, causal, heuristic, anomaly_cue, mental_model, assumption.
- Claim writer: writeClaimNode(db, params) of the same file. It upserts a node of type claim at review_status proposed (never confirmed), created_by system. PROVEN: a fixture room.db read back shows type claim, review_status proposed, props knowledge_type and text.
- MCP tool: claim_write of lib/mcp/tools/claim.cjs files one claim through writeClaimNode at review_status proposed.
- Meeting filing: commands/file-meeting.md Step 3 (Claimify, four passes) splits a transcript into atomic claims and types each one against the 6 member taxonomy of references/meeting/knowledge-typing.md. The main thread writes each consolidated claim once through writeClaimNode. The filing has no hypothesis type.
- Packet route: data/brain-packet-schema.json holds 12 jobs (select_methodology, suggest_next_move, detect_contradiction, summarize_neighborhood, classify_room_budding, rank_assumptions, generate_feynman_explanation, strengthen_minto, prepare_investor_brief, opportunity_react, opportunity_reflect, opportunity_rank). Each `in` object requires packet_version, job, room_stage, origin, privacy_mode, active_context, local_graph_summary and constraints. buildBrainPacket of lib/core/navigation/packet.cjs builds the packet; sendPacket of lib/core/brain-client.cjs sends it. Status: PARKED, zero production callers.
- Per job: for each of the 12 jobs the `in` object can carry a free string only inside active_context and local_graph_summary, and those hold room-derived strings. So no job carries a free sprout without a room-derived string.

packet_job_carries_sprouts: no
claim_types: fact,causal,heuristic,anomaly_cue,mental_model,assumption
hypothesis_maps_to: assumption

### Route decision

The ordinary typed read calls carry the sprouts. brain_ask takes a question built from a framework name and a problem type. brain_search takes a few keywords. The guard already passes a sprout (row e: allow). One call per sprout set. A local typed object (kind, text) is built first, and it never leaves the room.

sprout_route: sprout_call
design_can_work: yes
carrier_note: The sprouts travel as ordinary typed read calls (brain_ask and brain_search), not as a job of data/brain-packet-schema.json, which deviates from the PRD wording typed packet because no packet job carries a free sprout without a room-derived string.

### Who does what

- The host model (Larry) breaks the text into typed claims and picks the sprouts. The plugin has no model.
- The guard refuses a raw body with the typed outcome sprouts_required and the 5 step guide. It never echoes the text and never sends.
- The code of lib/core/part8-split-route.cjs validates the sprouts, files the claims through writeClaimNode, sends each sprout through lib/core/brain-client.cjs and assembles the answer.
- Code paths without a model (the whitespace baseline, the framework chains, the framework name refresh) already send framework name sprouts only. They need no split.

### The 3 outcome classes of the design

1. block: a credential, an email, a phone-like string, an ID-like string, a room-lexicon term. Never leaves. No guide to send it.
2. sprouts_required: a body, an edge that fails a prose rule, a short private claim, an ambiguous call that carries an edge or body string. Nothing is sent. The reply holds the split guide.
3. allow: a sprout, and an edge that passes. Goes out as today.

### Typed outcome contract

- Class and route: egress_class sprouts_required, route sprout_call (the value of the sprout_route line).
- Sentinel keys: error egress_blocked (so every consumer of the existing refusal still works), tool, egress_class, outcome, route, message, split_guide.
- Refusal message, written verbatim by Task 3: Canon Part 8: this call carries text that must stay in the room (reason sprouts_required). Nothing was sent. Split it instead. 1. Break the text into claims and type each one as fact, causal, heuristic, anomaly_cue, mental_model or assumption, the way /mos:file-meeting does. 2. Keep the room claims in the room: file each as a proposed claim with claim_write. 3. Pick the generic sprouts the Brain needs: a framework name, a problem type, or a few keywords, at most 12 words each, with no names, numbers, places, quotes or room terms. 4. Call the Brain again with the sprouts only (route sprout_call). 5. Build the answer here, from the Brain reply and your local claims. Never paste the claims into a Brain call.
- The split guide is the 5 numbered steps as an array of 5 lines.
- The message holds no payload byte, no dash character and is at most 1200 bytes. The sentinel builder ignores every argument except the tool name.
- Leak check: a sprout that shares a run of 4 or more normalized words with any claim text, or equals a whole claim of fewer than 4 words, is rejected with class not_sprout. A rejected sprout stops the whole route: 0 claims filed, 0 Brain calls.

## Technical Root Cause

- Site: lib/core/part8-egress-guard.cjs function `classify`, lib/core/brain-client.cjs functions `_egressBlockedSentinel` and `_typedFreeformGate`, scripts/part8-egress-guard-hook.cjs (the exit 2 branch).
- Cause: every refusal is a plain block with a reason and no guide and no route. The refusal tells the model what is wrong but not what to do. There is no typed outcome for "split this text", and no helper that validates sprouts against the claims they came from. A body or a private claim therefore cripples contextualised work, and a body with no room word is not checked by shape at all.
- Why it surfaces now: the owner principle of 2026-11-06 says Part 8 must never cripple contextualised work, and the owner rejected a bare block for ambiguous calls.

## Required Code Changes

- Change 1:
  - Location: lib/core/part8-split-route.cjs (new)
  - Current behavior: none. No typed outcome, no guide, no sprout validator, no local filer.
  - Required behavior: export SPROUTS_REQUIRED, ROUTE, CLAIM_TYPES, SPLIT_GUIDE, refusalMessage, sproutsRequiredResult, validateSprouts, sharesClaimRun, fileClaimsLocal, assembleLocal, runSplitRoute. Reuse KNOWLEDGE_TYPES, writeClaimNode and the Brain client, all required lazily. No network call of its own.
  - Short-term patch: none.
  - Long-term fix: plans 386-27 and 386-33 make the guard and callTool answer with sproutsRequiredResult.
- Change 2:
  - Location: tests/test-386-sprout-split-route.cjs (new)
  - Required behavior: arms SR1 to SR8 and SR5b, with the end to end wire capture.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: tests/test-386-sprout-split-route.cjs
  - Given: a fixture room.db, a composer double, a stubbed fetch that captures every request
  - When: runSplitRoute runs on a synthetic 40 word private paragraph
  - Then: the claims are in the db as proposed; no captured request holds a claim text or a run of 4 words of the paragraph; a leaking sprout makes 0 claims and 0 calls
  - Runner registration: picked up by tests/run-all-386.sh by glob

## Non-Code Follow-ups

- CHANGELOG.md, STATE.md, ROADMAP.md and knowledge-base.md: plan 386-21 owns them.
- Plan 386-43 teaches the persona and the skills to act on sprouts_required.
- The owner sees the carrier_note deviation on the plan 386-32 checkpoint.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: every refusal is a plain block with no guide and no route (see Technical Root Cause).
fix: pending (Task 3 of plan 386-42).
verification: pending.
files_changed: pending.
commits: pending.
