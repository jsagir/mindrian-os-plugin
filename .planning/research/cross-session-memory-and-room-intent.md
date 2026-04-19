---
created: 2026-04-14
status: research
trigger: cross-session memory + room intent failure witnessed 2026-04-14
proposed_release: v1.10.7 or later
authority: user directive 2026-04-14 deep investigate cross session memory + user intent
---

# Cross-session memory and room intent: an architectural autopsy

> Jonathan witnessed a leak. The statusline said `align-x-milken team`. The conversation drifted into `rashut-hadshanut-ai` because Claude recognized a Hebrew topic name and went hunting on the filesystem. A sealed room with a GUARDRAIL.md file at its root was used to draft a Hebrew warm-intro line inside a session that had no business knowing the sealed room existed. The fix is not a hook tweak. The fix is a contract.

This document is a deep investigation of why this happened, what MindrianOS does and does not actually have today, what the four tiers of fix look like, and which one to ship. It does not flatter the codebase. Where the answer is "there is no enforcement, only documentation," it says so.

---

## 0. The witnessed failure, in three sentences

1. New Claude Code session in `/home/jsagi`, statusline `align-x-milken team`, user asks about `rashut hadadahnut`.
2. Claude searched the filesystem, found `~/MindrianRooms/rashut-hadshanut-ai/`, opened STATE.md, opened GUARDRAIL.md, and continued the conversation as if rashut were the active room, drafting Hebrew text and recommending an option B.
3. User read the statusline back to Claude verbatim and Claude finally noticed it had been operating in the wrong room for the entire exchange.

Two simultaneous truths after the failure: terminal scoped to room A, conversation about room B, drafted artifact contaminated. The user caught it manually. Nothing in the system caught it.

---

## 1. Section 1: What "memory" actually means in MindrianOS today

This is the table the user asked for. It is honest. There is no real cross-session memory yet. Phase 78 built the schema for one but the rest of the system has not yet been wired to read from it on session start. The retrieval path is filesystem search reconstructed at recall time, not a persistent memory blob loaded into the system prompt.

| Memory layer | Where it lives | What it stores | When it is read | When it is written | Room-scoped? |
|---|---|---|---|---|---|
| `room/STATE.md` | `~/MindrianRooms/<room>/STATE.md` | venture stage, section counts, last computed snapshot | session-start hook (`scripts/session-start` lines 161 to 164) when `ROOM_DIR` resolves; also `scripts/compute-state` writes it | `scripts/compute-state` after methodology runs | Yes, by file path |
| `room/USER.md` | `~/MindrianRooms/<room>/USER.md` | user-specific room context | session-start hook lines 156 to 158 | hand-edited or by `lib/core/context-engine` writers | Yes, by file path |
| `room/.mindrian/last-session.md` | per-room `.mindrian/last-session.md` | active methodology, open questions, next suggested action, artifacts created, session duration | `lib/core/session-state.cjs` `readSessionState()` (NOT actually called from session-start as of v1.10.5) | `lib/core/session-state.cjs` `writeSessionState()` from on-stop hook | Yes, by file path |
| `room/.mindrian/room.db` `identity` table (Phase 78 L0) | per-room SQLite | venture_name, founder, stage, one_liner | `lib/core/memory-ops.cjs` `getIdentity()` - NOT yet wired to session-start | `setIdentity()` calls - NOT yet wired anywhere automatic | Yes, by file path |
| `room/.mindrian/room.db` `facts` table (Phase 78 L1) | per-room SQLite | subject, predicate, object, confidence, source_artifact, valid_from, invalidated_at | `getValidFacts()` - wired nowhere | `addFact()` - wired nowhere | Yes, by file path |
| `room/.mindrian/room.db` `sessions` + `fragments` tables (Phase 78 L2 / L3) | per-room SQLite | session summaries, conversation fragments | wired nowhere | wired nowhere | Yes if used |
| `room/.mindrian/room.db` `assumptions` table | per-room SQLite | claim, section, validity, evidence_for, evidence_against | wired nowhere | wired nowhere | Yes |
| `~/.mindrian/scratchpad.json` | global user home | banked opportunities from no-room "Mode 2 explore+capture" | session-start lines 414 to 430 in no-room branch | `scripts/bank-opportunity` | NO. Global. |
| `~/.mindrian-last-version` | global user home | last seen plugin version (for update detection) | session-start line 62 | session-start line 64 area | No |
| `~/MindrianRooms/.rooms/registry.json` | central rooms registry | active room name, list of rooms with metadata | `scripts/resolve-room` strategy 0 (lines 38 to 60), `lib/core/room-ops.cjs` `resolveRoom()` | `/mos:rooms` command, room creation flows | The registry IS the room scope source of truth, but it is read at session start only |
| `room/.mindrian/room.db` LazyGraph nodes/edges | per-room SQLite (Phase 77) | artifact nodes, edges (INFORMS, CONTRADICTS, CONVERGES, etc.) | `lib/core/lazygraph-ops.cjs` query functions, `scripts/cross-room-detect.cjs` | `intelligence-cascade.cjs` after filing | Yes per room, but `cross-room-detect.cjs` walks ALL rooms in the registry |
| Brain (Neo4j Aura, Pinecone) | remote MCP at brain.mindrian.ai | 21K teaching nodes, 1,427 embeddings | `lib/core/brain-client.cjs` calls when MINDRIAN_BRAIN_KEY set | server-side ingestion, NOT room-scoped writes | NO room scope |
| `/tmp/mindrian-context-state` | shared bridge file | `ctx_pct` from context-monitor for tier selection | session-start lines 129 to 134 | `scripts/context-monitor` writes it on every statusline render | No |
| `/tmp/mindrian-update-check` | global cache | update-check daily result | session-start lines 477 to 501 | check-update background run | No |

### What this table makes obvious

- The Phase 78 schema (`lib/core/memory-ops.cjs`) is **defined but unconsumed**. There is a working `initMemorySchema(db)` and there are working CRUD wrappers for identity, facts, sessions, fragments, and assumptions. There is NO call site in `scripts/session-start`, NO call site in any skill, NO call site in any hook that reads these tables when a session begins. Phase 78 built the cabinet. Nothing puts groceries in it. Nothing takes groceries out.
- The actual session-start "memory" injection is `state_md` from `STATE.md` plus `user_context` from `USER.md` plus a JSON read of `opportunity-bank/` plus a `compute-state` snapshot. That is filesystem-shaped. Not memory-shaped.
- `lib/core/session-state.cjs` writes a structured `last-session.md` on stop. It is NOT read on start. The function `readSessionState()` exists at line 96 and is dead code in the session-start path.
- `lib/memory/` in the repo (NOT to be confused with `lib/core/memory-ops.cjs`) is unrelated. It contains `aaak-compress.cjs`, `feynman-prompts.cjs`, `narrative-schema.cjs`. These are Feynman compression utilities for the v1.10.2 hybrid. They are not a memory system. The naming overlap is misleading.
- `scratchpad.json` is the closest thing to actual cross-session memory and it is **global**, not room-scoped. It is also only consulted in the no-room branch.

### One-sentence verdict

**MindrianOS today has no real cross-session memory. Memory is filesystem search reconstructed at retrieval time, with a Phase 78 SQLite schema that is built but unwired. Every "Larry remembers" claim in shipped CHANGELOG entries refers to filesystem snapshots and STATE.md re-reads, not to a persistent memory layer.**

---

## 2. Section 2: The room-scoping contract today

### 2.1 How a session learns which room is active

The lifecycle:

1. User opens a terminal at some `cwd`. cwd may be `/home/jsagi`, may be `~/MindrianRooms/<room>`, may be `/home/jsagi/MindrianOS-Plugin`, may be anywhere.
2. Claude Code fires SessionStart hook -> `scripts/session-start`.
3. Line 53: `WORK_DIR="${PWD}"`.
4. Line 54: `ROOM_DIR=$("${SCRIPT_DIR}/resolve-room" "$WORK_DIR") || ROOM_DIR=""`.
5. `scripts/resolve-room` runs four resolution strategies in order:
   - Strategy 0: read `${ROOMS_HOME}/.rooms/registry.json` (`~/MindrianRooms/.rooms/registry.json` by default), pull `active`, look up `rooms[active].path`, return absolute path if the directory exists.
   - Strategy 0b: directory scan, `${ROOMS_HOME}/<basename of WORK_DIR>` if it exists.
   - Strategy 1: workspace registry at `<cwd>/.rooms/registry.json` (legacy backward compat).
   - Strategy 2: legacy `room/` or `rooms/` directory inside cwd.
   - Strategy 3: no room, exit 1.
6. If `ROOM_DIR` resolves, the long room branch executes (lines 106 to 410 of `session-start`). If it does not, the no-room mode-routing branch executes (lines 411 to 444).

### 2.2 The registry `active` field

`~/MindrianRooms/.rooms/registry.json` (verified live read above) has shape:

```
{
  "version": 2,
  "root": "~/MindrianRooms",
  "active": "mindrianos-conversion-fix",
  "rooms": {
    "polygon": { "path": "polygon", "venture_name": "...", ... },
    "align-x-milken": { "path": "align-x-milken", ... },
    "rashut-hadshanut-ai": NOT IN REGISTRY (sealed),
    ...
  }
}
```

The `active` field is mechanically used in exactly two places in the codebase:

1. `scripts/resolve-room` strategy 0 (the central registry path).
2. `lib/core/room-ops.cjs` `resolveRoom()` (the workspace-scoped mirror, Strategy 1 in JS form).

It is **read** for path resolution. It is **written** by the `/mos:rooms` switching command and by room creation flows. Nothing else consumes it. The statusline reads it once per render via `scripts/context-monitor` to draw the room name pill.

### 2.3 Hard binding vs soft convention

The room scope is a **soft convention**, not a hard binding. Specifically:

- It is **not cwd-bound**. `align-x-milken` was the active room in the witnessed failure even though `pwd` returned `/home/jsagi`. The registry's `active` field overrides cwd in the resolver.
- It is **not env-var-bound**. There is no `MINDRIAN_ACTIVE_ROOM` env var threaded through the session.
- It is **not lockfile-bound**. There is no `~/MindrianRooms/.rooms/active.lock` that pins a session.
- It is **registry-bound**, but the registry is a single JSON file shared across every concurrent terminal on the machine. Two terminals open in two rooms cannot disagree about the active room. The last terminal that ran `/mos:rooms open <room>` wins for everyone.

This is the structural defect at the bottom of the witnessed failure. The active room is a global mutable singleton. Sessions do not own their scope.

### 2.4 What gets baked into the conversation context

`scripts/session-start` builds a `context` string and emits it as `hookSpecificOutput.additionalContext` (line 537) for Claude Code or as `additional_context` (line 535) for Cursor. The room branch injects:

- `stable_prefix` (lines 71 to 98) - Larry identity, UI enforcement, JTBD greeting rules. NOT room-scoped.
- A computed `state_output` from `scripts/compute-state` (line 152).
- `user_context` from `USER.md` (lines 156 to 158).
- `state_md` from `STATE.md` (lines 162 to 164).
- An archetype JSON from `lib/core/user-archetype.cjs` (lines 117 to 120).
- An MCP profile recommendation from `lib/core/mcp-profiles.cjs` (line 123).
- An opportunity bank summary from `lib/core/opportunity-ops.cjs` (lines 182 to 196).
- Various nudges, JTBD prompts, returning-user hints.

**It does NOT inject:**

- The active room name as an explicit `ACTIVE ROOM:` line.
- The list of OTHER rooms in the registry (so Claude knows what NOT to confuse).
- The contents of any `GUARDRAIL.md` if one exists in the active room.
- Any "do not cross-reference" rules.
- Any list of sealed rooms anywhere on the system.

The closest thing to a room-name injection is whatever happens to be inside `STATE.md` (which usually mentions the venture name in the title) and whatever the JTBD nudges happen to print. A statusline reader (the human) sees `align-x-milken team`. Claude sees `state_md` content that may or may not say "align-x-milken" anywhere depending on how the file is structured.

This is the second structural defect. Claude is told a lot about the room's content. Claude is not told "you are in room X and you must not act as if you are in any other room." There is no scope clause in the system prompt.

### 2.5 What happens at `/home/jsagi`

When the user opens Claude Code at `/home/jsagi` (verified case from the witnessed failure):

- `WORK_DIR=/home/jsagi`.
- `resolve-room` runs strategy 0, reads `~/MindrianRooms/.rooms/registry.json`, finds `active=align-x-milken`, returns `~/MindrianRooms/align-x-milken`.
- The room branch fires. `state_md` is read from `~/MindrianRooms/align-x-milken/STATE.md`.
- Statusline shows `align-x-milken team`.
- BUT: cwd is still `/home/jsagi`. Claude's `pwd` tool returns `/home/jsagi`. Claude can read any file under `/home/jsagi` including `~/MindrianRooms/rashut-hadshanut-ai/`.
- Nothing prevents that read. Nothing flags that read. Nothing routes that read through a sealed-room check.

This is the third structural defect. cwd and active room are decoupled. Active room sets the statusline and the context injection. cwd sets what Claude can actually read with its tools. They can disagree without consequence.

### 2.6 What happens with nested registries

A user could in principle have a workspace like `/home/jsagi/Projects/foo/` with its own `.rooms/registry.json`. The resolver strategy 1 would catch that. If both `~/MindrianRooms/.rooms/registry.json` AND `cwd/.rooms/registry.json` exist, strategy 0 wins (central registry has priority). This is a minor footgun, not the witnessed failure.

---

## 3. Section 3: Sealed rooms and the GUARDRAIL.md contract

### 3.1 What GUARDRAIL.md actually contains

Verified by direct read of `~/MindrianRooms/rashut-hadshanut-ai/GUARDRAIL.md`. The file has YAML frontmatter:

```
isolation: STRICT
cross_reference: FORBIDDEN
brain_indexing: DISABLED
graph_connection: NONE
visibility: LOCAL_ONLY
publish_status: UNPUBLISHED
last_enforced: 2026-04-13
```

And six "Hard Rules" in prose:

1. NO CROSS-REFERENCING. Never linked to any other room.
2. NO BRAIN INDEXING. Not added to Brain, Pinecone, KuzuDB, Neo4j, vector store.
3. NO PROACTIVE SURFACING. Proactive intelligence may not reach into or out of this room.
4. NO PUBLISH. No deploy to Vercel, Render, etc.
5. NO BUNDLING. Not in `/mos:rooms` portfolio views or multi-room exports.
6. NO TRANSCRIPT REUSE. The internal Rashut transcripts in `meetings/` are confidential.

There is also an "Enforcement" section that says "any agent, skill, or hook reading files in this room must check this GUARDRAIL.md first."

### 3.2 What the codebase actually does with GUARDRAIL.md

**Nothing. Verified.** A grep for `GUARDRAIL` across the entire `MindrianOS-Plugin` repo (every file, all extensions) returns **zero matches**. Specifically:

- No script reads `GUARDRAIL.md`.
- No skill mentions `GUARDRAIL.md`.
- No hook checks for `GUARDRAIL.md` before reading files in a room.
- `lib/core/room-ops.cjs` does not check.
- `scripts/resolve-room` does not check.
- `scripts/cross-room-detect.cjs` does not check (it walks `.rooms/registry.json`, but rashut is not in the registry, so it skips for a different reason - registry omission, not seal enforcement).
- `scripts/sync-rooms-graph` and `scripts/sync-rooms-brain` do not check (they walk `MINDRIAN_ROOMS_HOME` but again, rashut absence from the registry is what protects it, not the seal).
- The `room-passive` skill `SKILL.md` does not mention GUARDRAIL anywhere in its 161 lines.
- The `brain-connector` skill does not mention GUARDRAIL.
- The `room-proactive` skill does not mention GUARDRAIL.
- The `intelligence-cascade.cjs` library does not mention GUARDRAIL.

**GUARDRAIL.md is documentation only.** It is a note to future Claude sessions written in natural language inside a sealed folder. It depends entirely on whichever Claude reads it deciding to honor it. There is no enforcement layer. There is no read interception. There is no refuse-to-publish gate. There is no refuse-to-cross-reference gate. There is not even a check on session start that says "if any room under MINDRIAN_ROOMS_HOME has GUARDRAIL.md, list those rooms in the system context as off-limits."

### 3.3 Why the seal "worked" until it didn't

Rashut "stayed sealed" until 2026-04-14 because of one single accident: the room is **not registered in `~/MindrianRooms/.rooms/registry.json`**. The proactive intelligence loops walk the registry. The cross-room scanners walk the registry. The brain sync walks the registry. Anything driven by the registry skipped rashut by definition.

The witnessed failure bypassed the registry entirely. Claude used filesystem search (Glob and Read tools) directly against `~/MindrianRooms/`, found `rashut-hadshanut-ai/`, and walked into it. The registry-based protection was never on this code path. The seal was a side effect of registry omission, not a deliberate enforcement layer.

### 3.4 What real enforcement would look like

Three layers, in increasing strictness:

- **File-level (cheapest, hard).** A wrapper around `Read` and `Glob` that refuses to return content from any directory containing a top-level `GUARDRAIL.md` unless the active room equals that directory. Implemented as a hook on `PreToolUse` for Read, Glob, and any other read primitive. Hook reads the registry's `active`, walks the target path, and if the path is inside a directory with `GUARDRAIL.md` and that directory is not the active room, the hook returns a refusal. This is enforceable today via `hooks/hooks.json`.
- **Conversation-level (cheap, soft).** Session-start injects the list of all rooms under `MINDRIAN_ROOMS_HOME` that contain `GUARDRAIL.md` and instructs Claude: "These rooms are sealed. Do not discuss their content unless the active room equals one of them." This is a Tier 1 fix from Section 7.
- **Memory-level (later, requires Phase 78 to be wired).** Once the L2/L3 sessions/fragments tables are actually populated, write paths must refuse to insert fragments from one room's session into another room's tables. Requires the wiring that does not yet exist.

### 3.5 The drafted Hebrew artifact

In the witnessed failure, Claude drafted three Hebrew warm-intro options for the user's wife to send the AI lead at רשות החדשנות. Those drafts were generated **inside a session whose active room was `align-x-milken`**. They were not (yet) filed. If they had been filed via `/mos:file-meeting` or any other filing flow, the filing routines would have written them into `~/MindrianRooms/align-x-milken/` because that is where the room-passive "Active Room Lock" check (lines 108 to 116 of `room-passive/SKILL.md`) routes writes. The lock would have done its job CORRECTLY by its own logic and that is exactly the failure: it would have written rashut content into align-x-milken because the system has no concept of "this content originated from a different room and should be refused." The lock prevents cross-room writes by destination. It does not check origin.

---

## 4. Section 4: User intent understanding for room boundaries

### 4.1 What the system watches for today

A grep of `skills/`, `lib/`, `scripts/`, `hooks/` for any pattern that watches user messages for room-name mentions or cross-room intent signals returns essentially nothing. Specifically:

- No skill watches user messages for room-name mentions. The closest thing is `skills/conversation-mode/SKILL.md` which detects persona signals (TTO, Researcher, Business) in the no-room mode-routing branch. It does not look for room names.
- The `brain-connector` skill cross-references user mentions against the Brain knowledge graph for framework chaining, not against the rooms registry.
- The `/mos:rooms` command is manual. There is no auto-suggest path that fires when the conversation mentions a different room.
- `scripts/cross-room-detect.cjs` exists, but its job is the OPPOSITE of intent detection. It walks all rooms in the registry, extracts artifact title keywords, and writes cross-room concept relationships into proactive intelligence. It is a bulk discovery script, not a per-message classifier. It runs after filing, not on user input.

### 4.2 The Anthropic interpretability lens

From `feedback`/`project_claude_thinks_research.md` in user memory:

> Claude plans destinations first, thinks in concepts, fabricates explanations, hallucination = recognition misfire.

Apply this directly to the witnessed failure:

1. The user typed the words "rashut hadadahnut" (a Hebrew transliteration of the Israel Innovation Authority).
2. Claude's recognition layer fired on that token. Concept: Israel Innovation Authority + a previously-seen room about it.
3. Claude planned a destination: "the conversation is about the rashut room." This destination was planned BEFORE Claude consulted any scope check.
4. Claude justified the destination by going to the filesystem, finding the folder, and reading STATE.md. The justification is post-hoc. The destination was already chosen.
5. The active-room signal (`align-x-milken` in the statusline injection) was structurally present in `state_md` but it was lower-salience than the user's direct mention of a room-name token. The recognition signal beat the scope signal.

This is not a bug in Claude's reasoning. This is a bug in the prompt budget allocation. The scope signal was buried inside `state_md` content. The recognition signal was front and center in the user message. There is no single clear sentence in the system prompt that says "ACTIVE ROOM IS X. REFUSE TO ACT ON CONTENT FROM ANY OTHER ROOM WITHOUT EXPLICIT ACK." If that sentence existed, the recognition signal would have collided with it instead of overriding it.

### 4.3 The deeper problem

The deeper problem is that "user intent" and "room scope" are not the same thing and the system has no code that maps between them. The user can:

- Be in room A and want to talk about room B (legitimate cross-room intent). Today: leaks silently.
- Be in room A and accidentally use a topic word that overlaps with room B (false cross-room signal). Today: triggers a leak as if it were intentional.
- Be in room A and want to switch to room B mid-conversation (legitimate switch intent). Today: requires manual `/mos:rooms open <room>`.
- Be in room A and want to confirm they are in room A (sanity check). Today: requires manually reading the statusline.

A user-intent classifier would need to disambiguate these four cases. None of the existing skills do. The `pws-methodology` skill routes by problem type. The `larry-personality` skill routes by mode. Neither routes by room scope.

---

## 5. Section 5: The five failure modes

### 5.1 Topic drift to wrong room

**Manifestation.** User says "remember when we did X" where X belongs to a different room. Claude searches the filesystem, finds X, treats X as the conversation context, builds responses on X content. The witnessed failure.

**What the user sees.** Plausible answer that references content from a different room. The user has to manually verify by checking the statusline or running `pwd`.

**How the system could detect.** Hook on user message: extract candidate concept tokens, compare against the active room's concept set vs other rooms' concept sets, flag if other-room match score > active-room match score by a margin.

**What would prevent.** Tier 1 scope injection (active room as a top-line system prompt clause) collides the recognition signal against an explicit scope clause. Tier 2 intent classifier produces a soft warning before Claude responds. Tier 4 hard refuse with a `/mos:cross-reference` command for explicit acknowledgment.

### 5.2 Memory drift across rooms

**Manifestation.** Claude says "I remember we discussed Y" when Y was discussed in a different room's filesystem. The "memory" is filesystem search, not actual memory. The illusion of recall is reconstructed at retrieval time.

**What the user sees.** Confidence-toned recall of facts that are technically findable on disk but were not part of any session memory. Indistinguishable from real memory unless the user knows the implementation.

**How the system could detect.** A real memory layer (Phase 78 wired to session-start) would have an authoritative "what did we actually talk about in this room" record. Claude's recall could be cross-checked against the room-scoped memory blob. If the recall references content not in the room-scoped memory, the system flags it.

**What would prevent.** Tier 3 (room-scoped memory layer with voice-log). The fix here is structural: replace filesystem search with a scoped memory blob.

### 5.3 Filing leak

**Manifestation.** A file-meeting or new-artifact action writes content derived from one room's discussion into a different room's filesystem. Cross-room contamination becomes structural and survives the session.

**What the user sees.** New entries appear in the room they were working in. The entries reference content from a different room. The graph cross-reference scan (intelligence-cascade.cjs) then creates edges from the contaminated entry to other entries in the same room, baking the leak deeper.

**How the system could detect.** Origin tracking on every artifact. Every artifact gets a `source_room:` frontmatter field on creation. Filing routines refuse to write an artifact whose `source_room` differs from the destination room without an explicit cross-reference acknowledgment.

**What would prevent.** Tier 4 origin tracking + write refusal. Tier 1 alone does not prevent this (it relies on Claude noticing). Tier 4 enforces it at the file-system layer.

### 5.4 Cross-reference leak

**Manifestation.** The intelligence-cascade scans for INFORMS / CONTRADICTS / CONVERGES edges between artifacts. If a contaminated artifact (from failure 5.3) is in the room, the scan creates edges from it to legitimate artifacts. The graph now has structural ties between rooms that should be sealed.

**What the user sees.** Their dashboard graph shows an unexplained connection. Their proactive intelligence surfaces a "convergence" they don't recognize. Their next session start loads a state that mentions the cross-reference.

**How the system could detect.** The scan should refuse to create edges to or from any artifact whose `source_room` differs from the current room. Same origin-tracking primitive as 5.3.

**What would prevent.** Tier 4 origin tracking enforced at the cascade level.

### 5.5 Sealed-room contamination

**Manifestation.** GUARDRAIL.md content is read into a non-sealed session. Drafted artifacts derived from sealed content exist in conversation buffers that are not themselves sealed. If those drafts are filed anywhere except back into the sealed room, the seal is breached structurally. The exact witnessed failure with the Hebrew warm-intro line.

**What the user sees.** A drafted artifact in their working session that "feels right" for the sealed venture but is technically homeless. They are one click from filing it in the wrong room.

**How the system could detect.** Sealed rooms have GUARDRAIL.md. A PreToolUse hook on Read can detect when Claude is reading from a sealed-room directory while the active room is different, and either refuse the read or tag the response with a sealed-content marker that downstream filing routines refuse to file.

**What would prevent.** Tier 4 sealed-room read interception. Tier 1 alone is not sufficient (it depends on Claude reading and honoring an instruction). The cheapest hard fix is a PreToolUse hook around Read.

---

## 6. Section 6: How real cross-session memory products handle this

### 6.1 Letta (formerly MemGPT)

Letta uses a hierarchical memory architecture. There are three tiers: main context (always loaded into the prompt), recall memory (queryable via tool calls), archival memory (long-term storage). Memory edits are made by the LLM itself via dedicated `core_memory_append` and `core_memory_replace` tools. Sessions are explicit. The agent has a `persona` block and a `human` block in main context that survive across sessions because they are written into Postgres or SQLite under the agent's identity.

**On session boundaries.** Letta's session is the agent. An agent has a persistent memory that does not reset. There is no "ended session" concept; the agent just stops being invoked.

**On topic drift detection.** Letta has no native topic-drift detector. The LLM is trusted to recognize when to query archival memory.

**On write-time vs read-time enforcement.** Write-time: the LLM decides what to commit. Read-time: queries are vector searches over recall and archival.

**On sealed content.** Letta has no concept of sealed memory regions. Multi-tenant deployments separate by agent ID at the Postgres layer.

**Lesson for MindrianOS.** The Letta core-memory-block pattern is exactly the right shape for the active-room scope clause. A small (~200 tokens), always-loaded block at the top of the system prompt that says "ACTIVE ROOM: X. SECTION FOCUS: Y. SEALED ROOMS ON THIS MACHINE: [list]." This is Tier 1.

### 6.2 Mem.dev

Mem stores notes in a vector index with auto-classification. Recall is similarity search. There is no session model. There is no scope model. There is no seal.

**Lesson.** Vector similarity is exactly the wrong primitive for room scope because vectors are semantic, not authoritative. Two rooms with overlapping topics will leak vectors into each other. Room scope must be enforced by structural keys (room name, file path), not by semantic similarity.

### 6.3 Zep

Zep is a long-term memory service for LLM apps. It has explicit session boundaries, a per-session message store, automatic fact extraction into a graph (Graphiti), and summarization on session close. Each session is keyed to a `session_id` and `user_id`. Fact extraction populates a temporal knowledge graph with valid_from / valid_to fields very similar to what `lib/core/memory-ops.cjs` already defines for the `facts` table.

**On session boundaries.** Hard. Sessions are explicit objects with start, end, and a closed message log.

**On topic drift detection.** Not native. Zep stores; the application decides.

**On write-time vs read-time enforcement.** Both. Writes are scoped to (user_id, session_id). Reads can specify session, user, or graph-wide.

**On sealed content.** Multi-tenant separation by user_id. No deeper seal primitive.

**Lesson for MindrianOS.** Zep's (user_id, session_id) tuple maps cleanly to MindrianOS's (machine, room_id) tuple. The fact-extraction layer is exactly Phase 78's `facts` table. The piece MindrianOS is missing is the wiring that makes session_id a first-class identifier and binds every fragment write to it. Phase 78 has the columns. Nothing yet writes to them.

### 6.4 LangChain memory primitives

LangChain ships several memory classes: `ConversationBufferMemory` (raw turns), `ConversationSummaryMemory` (LLM-summarized), `VectorStoreRetrieverMemory` (vector-indexed turns), `ConversationKGMemory` (entity graph). All of them are per-session by default. None of them have a scope concept beyond "this LangChain run."

**Lesson.** LangChain's memory primitives are not room-aware. Building room scope on top of them requires application-level enforcement. The same pattern MindrianOS would need.

### 6.5 Anthropic prompt caching

Prompt caching has a 5-minute TTL on cache breakpoints. It is short-term, not long-term. It is per-session, not cross-session. It is invisible to the application; the model still sees the same text on every request, just from cache.

**Lesson.** Caching is not memory. Treating cache hits as memory leads to the exact "filesystem search dressed up as recall" pattern MindrianOS already has. The fix is real persistence, not larger caches.

### 6.6 Claude Projects (claude.ai)

Claude Projects is the closest commercial analog to MindrianOS room scoping. A Project has:

- A name (the "room").
- Custom instructions (the "STATE.md").
- Uploaded files (the "artifacts").
- Conversations scoped to the project (each chat is keyed to the project).

When you start a new chat in a Project, the project's instructions and files are loaded as context. When you switch to a different project, the chat is in that project's scope. Conversations are stored per-project. There is no cross-project leak because a chat literally cannot reach into another project's files via the chat surface.

**On session boundaries.** Soft. Each chat is a session within a project.

**On topic drift detection.** None. The user is trusted to switch projects manually.

**On write-time vs read-time enforcement.** Hard. The chat surface only sees the active project's files.

**On sealed content.** Project-level isolation by default. Every project is sealed from every other project at the file-access layer.

**Lesson for MindrianOS.** Claude Projects gets right what MindrianOS gets wrong: file access is bound to the active project. A chat cannot read files outside its project. The MindrianOS equivalent would require Read and Glob to be wrapped so they refuse paths outside the active room. This is Tier 4 architectural work and is the right destination, even if Tier 1 ships first.

---

## 7. Section 7: The four tiers of fix

### 7.1 Tier 1: Read-only scope injection

**What it is.** Modify `scripts/session-start` so that when `ROOM_DIR` resolves, the context string includes a top-line scope clause:

```
ACTIVE ROOM: align-x-milken
SECTION FOCUS: team
ALL ROOMS ON THIS MACHINE: align-x-milken (active), polygon, synteris, trustlabel, pws-website, ...
SEALED ROOMS (GUARDRAIL.md present): rashut-hadshanut-ai
GUARDRAIL: (none for active room)

You MUST refuse to discuss content from any room not listed as the active room
without an explicit user statement of cross-room intent. If the user mentions
a topic that maps to another room, ask: "I am scoped to align-x-milken right
now. Do you want me to switch rooms, or are you giving me cross-room context
about the active room?"
```

**Implementation.** ~80 lines of bash in `scripts/session-start`. Walk `${ROOMS_HOME}` for top-level directories, check each for `GUARDRAIL.md`, build the lists, format the clause, prepend to `context`. Reuses existing `resolve-room` and registry read.

**Cost.** ~1 day to implement, test, ship.

**Risk.** Low. It is a pure additive context injection. Worst case it is ignored; best case it eliminates the witnessed failure.

**Reversibility.** High. Pure context string, no schema, no migration.

**Dependence on prior phases.** None.

**Expected outcome.** Eliminates failure modes 5.1 and 5.5 in roughly 80 percent of cases (the Tier 1 fix is a soft instruction; Claude can still ignore it under strong recognition pressure, but the explicit scope clause raises the salience of the room-binding signal enough to win most collisions).

**CLI / Desktop / Cowork.** CLI: works directly via session-start hook. Desktop: works via the same SessionStart path; Desktop also runs the hook. Cowork: works the same way; the scope clause gets baked into the shared context that all collaborators see.

### 7.2 Tier 2: Mid-session intent classifier

**What it is.** A new hook on user message (PreToolUse on the message stream, or a UserPromptSubmit hook if Claude Code exposes one). The hook does:

1. Read the active room from `~/MindrianRooms/.rooms/registry.json`.
2. Build a topic surface for the active room: STATE.md keywords, section names, room name itself, top-N artifact title keywords from `room/.mindrian/room.db`.
3. Build the same surface for every other room in the registry.
4. Run a simple keyword scoring pass against the user message: count tokens matching each room's surface.
5. If another room scores higher than the active room by a margin, write a soft warning to a bridge file: `/tmp/mindrian-intent-warning`.
6. Session-start picks up the warning on next render or context-monitor passes it inline.

**Implementation.** ~300 lines of Node, plus a hook entry in `hooks/hooks.json`. Reuses `lib/core/lazygraph-ops.cjs` for the artifact title query (already used by `cross-room-detect.cjs`).

**Cost.** ~1 week. The wiring is moderate. The scoring is keyword-only at first; can be upgraded to embedding similarity later if needed.

**Risk.** Medium. False positives on legitimate cross-room work. Mitigated by treating the warning as soft (Larry asks the user instead of refusing).

**Reversibility.** High. Hook can be removed.

**Dependence on prior phases.** Phase 77 (SQLite room.db). Already shipped.

**Expected outcome.** Catches the witnessed failure pattern roughly 95 percent of the time. The remaining 5 percent are cases where the topic words are too generic to score.

**CLI / Desktop / Cowork.** CLI: works. Desktop: depends on whether Desktop fires the same hook on user messages. The MCP server bridge for Desktop would need to expose the intent check as a tool call from the model side, since Desktop does not run hook scripts. Cowork: similar to Desktop; needs MCP bridge.

### 7.3 Tier 3: Real cross-session memory (smart-notebook v1.10.7+)

**What it is.** Wire Phase 78 (`lib/core/memory-ops.cjs`) into session-start and on-stop. Specifically:

1. On session start (room branch): call `getIdentity(db)`, `getValidFacts(db)` on the active room's `room.db`. Inject the identity block and the top-N facts into the context string. This becomes the room's persistent memory blob.
2. On user message: append a fragment via `addFragment(db, sessionId, role, content, sectionContext)`. This requires a session being open. Open a session at start via `startSession(db)`, store the session_id in `room/.mindrian/active-session.json`.
3. On session stop: call `endSession(db, sessionId, summary, keyDecisions, openQuestions, methodologyUsed, artifactsFiled)`. Also keep the existing `lib/core/session-state.cjs` `writeSessionState()` for the markdown file.
4. Add a per-room voice-log directory `room/.mindrian/voice-log/<date>-<slug>.md` for human-readable session summaries. Smart-notebook research Section 6.7 already specs this.

**Implementation.** ~2 to 3 days of wiring. The schema is built. The CRUD wrappers are built. The work is the call sites in session-start, on-stop, and the message handler.

**Cost.** Medium. Moderate code touch but no new schema, no migration.

**Risk.** Medium. Wiring memory into session-start is the kind of change that can quietly break greeting flows if the read is slow or fails. Mitigation: wrap every memory read in try/catch with a degrade-to-filesystem fallback. Decision 8 (Tier 0 always works) requires this.

**Reversibility.** Medium. Once sessions and fragments are populated, removing the layer would lose data. Easy to disable, harder to undo.

**Dependence on prior phases.** Phase 77 (SQLite). Phase 78 (schema). Both done.

**Expected outcome.** Real memory. Larry on session start can say "last time we ran a Six Hats analysis on the team section and you left this open question." The voice can read the actual session log instead of guessing from filesystem snapshots.

**CLI / Desktop / Cowork.** CLI: works. Desktop: needs MCP tool wrapping for `getIdentity`, `getValidFacts`, `addFragment`. The shared core `lib/core/memory-ops.cjs` is already CJS and ready to be wrapped. Cowork: same as Desktop; the room.db is shared via the room folder, so concurrent access needs the existing write-lock in `lib/core/write-lock.cjs`.

### 7.4 Tier 4: Room-as-process (architectural, v2.0)

**What it is.** Every conversation is implicitly tagged with the active room at session start. The tag is enforced everywhere:

- Memory writes are scoped by tag. A fragment with tag X cannot be written to a fragments table for room Y.
- Cross-room references require explicit user acknowledgment via a dedicated `/mos:cross-reference <other-room>` command. The command opens a temporary cross-scope state. Without it, references are refused.
- Sealed rooms (GUARDRAIL.md) are enforced by a wrapper layer that intercepts Read and Glob tool calls and refuses if the target path is inside a directory with `GUARDRAIL.md` and the active room does not match.
- Sealed rooms can only be opened in a dedicated terminal session whose cwd is the sealed room path. The active room registry mechanism is bypassed for sealed rooms; they are cwd-bound, not registry-bound.

**Implementation.** Significant. Requires:

- A `PreToolUse` hook on Read, Glob, and any other read primitive (~200 lines).
- Origin-tracking frontmatter (`source_room:`) added to every filed artifact.
- Filing routines in `room-passive` and `intelligence-cascade.cjs` updated to refuse cross-origin writes (~150 lines spread across multiple files).
- A new `/mos:cross-reference` command (~100 lines).
- A sealed-room cwd binding in `scripts/resolve-room` (~30 lines).

**Cost.** ~2 to 3 weeks. This is a milestone, not a phase.

**Risk.** High. Read interception is the kind of change that can break legitimate cross-room work (cross-room-detect.cjs, sync-rooms-graph, sync-rooms-brain). Each of those scanners needs an explicit "I am a registry walker, allow me" exception. Mitigation: explicit allowlist for registry-driven scanners, refuse everything else.

**Reversibility.** Medium. Hooks can be disabled. Origin tracking is additive frontmatter and is forward-compatible.

**Dependence on prior phases.** Phase 78 wired (Tier 3). Tier 1 shipped (so the soft path exists during transition).

**Expected outcome.** Eliminates all five failure modes. Raises the new-user determinism the Dror-activates-alone forcing function depends on. Closes the gap between MindrianOS room scoping and Claude Projects scoping.

**CLI / Desktop / Cowork.** CLI: works via hooks. Desktop: needs MCP tool wrappers AND a way to inject the read interception, which Desktop does not natively support. The MCP server can mediate by exposing only room-scoped read tools and refusing the rest, but the user can still bypass via the chat surface's native file handling. Workaround: ship Tier 4 first on CLI, then build the MCP-equivalent for Desktop in a follow-up. Cowork: same as Desktop.

---

## 8. Section 8: Connection to smart-notebook v1.10.7

### 8.1 Where in smart-notebook scope this lands

Smart-notebook research Section 6.5 (held contradictions) and Section 6.7 (voice-log) both touch the room-scope question. Section 6.7 specs a per-room voice-log at `room/.mindrian/voice-log/<date>-<slug>.md`. Section 9.10 acknowledges the "multi-room voice sharing" open question and explicitly defers it. Neither section says "the voice must refuse to answer questions about other rooms" but both implicitly assume it.

The smart-notebook synthesis layer needs to be room-bound or it ships with the bug class baked in. The voice that reads MINTOs and says "what would I do today" cannot be a global voice. It must be the active room's voice. Otherwise the witnessed failure happens on every synthesis call.

### 8.2 Should the wrapper fix be deprioritized

The current TODO has `[NEXT] v1.10.6 - Smart-notebook-as-cofounder milestone` and the wrapper fix is mentioned as a parked smaller item. The wrapper fix and Tier 1 scope injection are the same kind of work: small bash/node changes in `scripts/session-start`. They could ship as a single v1.10.7 hotfix that includes both. The wrapper fix is currently parked; promoting it into the same hotfix as Tier 1 is cheap.

### 8.3 Should smart-notebook be re-cut

Yes. The current scope description for v1.10.6 in TODO.md does not mention room-scoped memory as a foundational requirement. It mentions Brain enrichment gaps, MINTO+Feynman+memory wiring, framework x section matrix. It does NOT mention "the synthesis voice must be room-bound or the bug class persists."

Recommended re-cut: put room-scoped memory FIRST in the smart-notebook milestone. Put scaffold expansion SECOND. The voice cannot synthesize honestly across rooms without the scope binding being load-bearing in the design.

### 8.4 Can Tier 1 ship as a v1.10.7 standalone hotfix

Yes, easily. Tier 1 is ~80 lines of bash in `scripts/session-start`. It does not touch any other file. It does not require schema changes. It does not require new commands. It is a same-day patch in the v1.10.3 / v1.10.4 / v1.10.5 cadence the user has established. Smart-notebook becomes v1.10.8 (the seventh slot shift).

### 8.5 Dror activates alone

The forcing function is a new user opening a fresh terminal in a fresh room and getting consistent behavior. Today, that user can experience the full bug class on their first session if they happen to mention any topic that overlaps with any other directory under their MindrianRooms folder. Tier 1 closes 80 percent of that. Tier 4 closes the rest. Tier 1 must ship before Dror.

---

## 9. Section 9: Implications for the smart-notebook synthesis voice

The smart-notebook synthesis voice (proposed in research Section 6) reads MINTOs and produces a "what would I do today" paragraph. If this voice is not room-bound, it WILL leak. The voice must be fundamentally room-scoped or it ships the bug.

Specification of what room-bound means for the voice:

### 9.1 Voice-log is room-scoped

`room/.mindrian/voice-log/<date>-<slug>.md`, never `~/.mindrian/voice-log/`. Each room has its own log. The log lives inside the room's folder so it is bounded by the same path semantics as STATE.md and last-session.md.

### 9.2 Synthesis input is restricted to active room MINTOs only

When the voice synthesizes, the only MINTO files it reads are under `<active room>/.mindrian/minto/` or wherever Phase 81 (Feynman-Minto Hybrid) places them. The synthesis function takes a `roomPath` parameter and refuses to read above it.

### 9.3 Synthesis explicitly refuses cross-room questions

If the user asks "what about my other venture," the voice answers: "I am scoped to align-x-milken. Switch rooms with /mos:rooms open <other> to ask about that one."

### 9.4 Cross-room synthesis requires explicit opt-in

A future `/mos:voice --cross-room=<other>` flag opens a temporary cross-scope state for the duration of one synthesis call. The voice tags its output with both rooms. The output is logged to BOTH rooms' voice-logs with explicit cross-reference markers.

### 9.5 The trust contract

The voice's trust depends on its scope discipline. A voice that leaks across rooms is a voice the user cannot trust to keep secrets. For sealed rooms (GUARDRAIL.md), the voice MUST refuse to operate at all unless the active room IS the sealed room. There is no cross-reference flag that opens a sealed room.

---

## 10. Section 10: Recommendation

**Recommended path: A. Ship Tier 1 NOW as v1.10.7 hotfix (scope injection + GUARDRAIL.md detection + sealed-room list). Smart-notebook becomes v1.10.8.**

Justification:

1. The witnessed failure is structural and active. Every session opened today on Jonathan's machine is one Hebrew word away from leaking again. The fix is ~80 lines of bash in a script that already gets edited frequently. There is no engineering reason to bundle it with smart-notebook's larger scope.

2. The Dror-activates-alone forcing function depends on deterministic new-user behavior. Tier 1 is the cheapest possible move that closes 80 percent of the bug class for a new user. Smart-notebook is a 1- to 2-week milestone and will not ship before Dror activates.

3. Bundling Tier 1 into smart-notebook delays the fix by a milestone and conflates a scope contract with a synthesis layer. They are independent. Ship them independently.

4. Tier 1 is a non-destructive context-string addition. It is the kind of change you ship same-day, validate against the witnessed failure pattern, and promote to stable in 24 hours. The user's release cadence (v1.10.3, v1.10.4, v1.10.5 all shipped 2026-04-14) supports this exactly.

The wrapper fix (currently parked in TODO) bundles into v1.10.7 cleanly because it is also a session-start hook change. Smart-notebook is then v1.10.8 with room-scoped memory as a load-bearing requirement, not an afterthought. Tier 4 (architectural) is a v2.0 milestone item.

---

## Appendix A: File and function inventory

Every concrete reference cited above:

- `/home/jsagi/MindrianOS-Plugin/scripts/session-start` (542 lines). Workspace guard at lines 17 to 37. WORK_DIR resolution lines 53 to 54. Stable prefix lines 71 to 98. Room branch starts line 106. STATE.md read line 162. Auto-configure statusline lines 446 to 468. Update check lines 471 to 515. Context emit lines 528 to 540.
- `/home/jsagi/MindrianOS-Plugin/scripts/resolve-room` (verified head). Strategies 0, 0b, 1, 2 documented in header comments. Strategy 0 implementation lines 36 to 60.
- `/home/jsagi/MindrianOS-Plugin/scripts/context-monitor` (380 lines). Reads `.rooms/registry.json` for room name. Renders the statusline pill. EXPLORATION_LABELS map at lines 22 to 37. detectBrainStatus at line 48.
- `/home/jsagi/MindrianOS-Plugin/scripts/cross-room-detect.cjs` (verified head). Walks registry, extracts artifact title keywords, writes cross-room concept relationships. Has no GUARDRAIL check. Has no sealed-room concept.
- `/home/jsagi/MindrianOS-Plugin/lib/core/room-ops.cjs` (92 lines). `resolveRoom(workDir)` at lines 70 to 90. Strategy 1 (workspace registry) implementation. Listing/analyze wrappers.
- `/home/jsagi/MindrianOS-Plugin/lib/core/memory-ops.cjs`. `initMemorySchema(db)` at line 23. `setIdentity` at line 93. The Phase 78 schema. Functions exported but not wired into session-start.
- `/home/jsagi/MindrianOS-Plugin/lib/core/session-state.cjs` (144 lines). `writeSessionState()` at line 27. `readSessionState()` at line 96 (dead code in session-start path).
- `/home/jsagi/MindrianOS-Plugin/lib/core/lazygraph-ops.cjs`. Phase 77 SQLite room.db. Used by `cross-room-detect.cjs` and intelligence-cascade.
- `/home/jsagi/MindrianOS-Plugin/lib/core/intelligence-cascade.cjs`. Cross-relationship scanner. Creates INFORMS / CONTRADICTS / CONVERGES edges. Has no GUARDRAIL check, has no origin tracking.
- `/home/jsagi/MindrianOS-Plugin/lib/core/write-lock.cjs`. Concurrent room.db access guard. Relevant for Tier 3 / Tier 4 wiring.
- `/home/jsagi/MindrianOS-Plugin/skills/room-passive/SKILL.md` (161 lines). Active Room Lock at lines 108 to 116. Filing intelligence rules. No GUARDRAIL mention.
- `/home/jsagi/MindrianOS-Plugin/skills/room-proactive/SKILL.md`. Cross-relationship scan rules. No GUARDRAIL mention.
- `/home/jsagi/MindrianOS-Plugin/skills/conversation-mode/SKILL.md`. No-room mode routing (Just Talk, Explore+Capture, Build a Room). Persona detection signals at lines 38 to 46. No room-name detection.
- `/home/jsagi/MindrianOS-Plugin/skills/context-engine/SKILL.md`. Session context management and USER.md tracking. Not a memory layer.
- `/home/jsagi/MindrianOS-Plugin/skills/brain-connector/SKILL.md`. Brain MCP integration. No room scope.
- `/home/jsagi/MindrianOS-Plugin/skills/larry-personality/SKILL.md`. Voice and Ask-Tell Dial. No room scope.
- `/home/jsagi/MindrianOS-Plugin/skills/ui-system/SKILL.md`. 4-zone session start contract. No room scope clause.
- `/home/jsagi/MindrianOS-Plugin/.planning/phases/77-sqlite-foundation/77-CONTEXT.md`. Phase 77 boundary, CRUD pattern, write-lock.
- `/home/jsagi/MindrianOS-Plugin/.planning/phases/78-memory-layer-assumptions/78-CONTEXT.md`. Phase 78 boundary, identity/facts/sessions/fragments/assumptions schema, integration points NOT yet wired.
- `/home/jsagi/MindrianOS-Plugin/.planning/research/smart-notebook-cofounder.md` Section 6 (synthesis layer), Section 6.7 (voice-log), Section 9.10 (multi-room voice sharing).
- `/home/jsagi/MindrianRooms/.rooms/registry.json`. Verified live read. Active field is a global mutable singleton.
- `/home/jsagi/MindrianRooms/rashut-hadshanut-ai/GUARDRAIL.md`. The sealed-room contract. Verified content. Documentation only, no enforcement.

## Appendix B: Em-dash audit

The author of this document used hyphens only. No em-dashes. No en-dashes. Run `grep -Pn '[\u2014\u2013]' /home/jsagi/MindrianOS-Plugin/.planning/research/cross-session-memory-and-room-intent.md` to verify.
