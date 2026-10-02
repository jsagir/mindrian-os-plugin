---
phase: 369
kind: second-opinion
recorded: 2026-10-02
source: "Codex (OpenAI), consulted by the navigator with 00-CODEX-BRIEF.txt from the Downloads bundle MindrianOS-UIUX-phase369-2026-10-02; pasted back verbatim; dashes normalized to hyphens, box diagrams kept"
disposition: "see 369-INPUT.md section 13 for what was adopted, what was corrected, and why"
---

# Second opinion on Phase 369 (Codex, 2026-10-02)

Verbatim text follows. Two claims are corrected in 369-INPUT.md section 13: the MCP SDK v2 migration is
Phase 267 (executing), not a later change; and the one-day chassis test needs two guards. Everything else
was adopted.

---

I think Phase 369 is now architecturally coherent enough to build, but I would change one framing choice:
agent-native should not be allowed to become the architecture of MindrianOS. It should be a UI/agent
framework sitting on top of the MindrianOS contract.

That distinction resolves several of the questions in your brief.

## My second opinion

| Question | Recommendation | Why |
|---|---|---|
| 1. Actions = MCP tools 1:1? | No at the product layer. Keep 1:1 primitive adapters, then expose task-shaped actions. | MCP tools describe system capabilities. UI actions should describe user intentions. |
| 2. Change feed | Append-only `room_change_log` + monotonic `change_seq`; SSE sends only invalidation/checkpoint; RxDB pulls deltas. | Handles same-ms writes, deletes, reconnects, ordering and replay cleanly. |
| 3. MCP SDK v1 vs v2 | Fix compatibility now; move the server to v2 as a separate controlled migration. | v2 is now stable, but coupling the migration to the UI makes Phase 369 unnecessarily dangerous. |
| 4. One-way RxDB | Keep it. It is the right architecture, provided it is treated as a projection rather than a SQLite mirror. | Your spikes validate the UX advantage; the remaining problems are solvable projection problems. |
| 5. Workroom vs agent-native | Use the existing Workroom as the product shell and selectively absorb agent-native's agent/action capabilities. | The Workroom already contains the thing you actually care about: room/document UX and BlockNote. |
| 6. Native TS vs build | Native erasable TS for server/core code is viable, but your current Node floor is wrong. UI gets a real Vite build. Hooks remain JS until measured. | Node 22.16 does not meet your "unflagged TypeScript" assumption. |

## 1. Don't make every MCP tool an Agent-Native action

This is the place where I disagree most strongly with the current phrasing.

Agent-Native itself has a very attractive rule: actions are capabilities shared by UI and agent. Its current
documentation explicitly describes actions as the common operation surface for agent and UI.

But that does not mean: 45 MCP tools = 45 buttons/actions visible to the product.

I would create two layers:

```text
MINDRIAN DOMAIN ACTION

approveDecision()
fileArtifact()
reviseClaim()
openRoom()
attachEvidence()
publishDeliverable()

            |
            v

MCP ADAPTER / PRIMITIVES

gate_render
gate_answer
artifact_file
claim_write
context_assemble
room_state
...
```

There can still be an automatically generated 1:1 MCP adapter underneath. That's useful because it preserves
schema reuse and avoids duplicated validation. But the public action surface should be task shaped.

For example, `approveDecision(gateId, optionId)` may happen to map almost directly onto one MCP call. But
`attachEvidence(claimId, sourceId)` might internally: validate room/session, inspect claim, inspect evidence,
construct proposed relation, mint gate if required, commit through navigation chokepoint.

The composition belongs server-side, not in React and not in Claude's prompt loop. Otherwise a network
interruption can leave half a user intention completed.

So I would change the constitutional sentence from "actions = MCP tools, one per tool" to:

Every Mindrian action terminates in the MCP/domain action layer. Primitive MCP tools may be wrapped
one-to-one, but user-facing actions represent complete user intentions and may compose multiple primitives
server-side.

## 2. Your change feed should become extremely boring

The ten measured facts correctly killed `{last_modified_at,id}`. Don't put `change_seq` independently onto
every table and then attempt to merge them. Use one canonical log:

```text
room_change_log
change_seq     INTEGER PRIMARY KEY
entity_type
entity_id
operation      upsert | delete
entity_revision
transaction_id
changed_at
```

Every canonical mutation performs, in the SAME transaction: modify room.db canonical tables, INSERT INTO
room_change_log, COMMIT. That last point is the invariant.

The browser contract: `GET /room/:id/changes?after=18420&limit=500` returning
`{ "from": 18420, "through": 18463, "changes": [...], "hasMore": false }`. Deletes simply appear as
`operation: delete`. No special detective work by RxDB.

Make SSE deliberately stupid: `event: room.changed` with `{ roomId, latestSeq }`. Do not replicate the actual
entities over SSE. SSE means only: something newer exists. Then RxDB pulls from its checkpoint to latestSeq,
applies the projection, advances the checkpoint. Warm reload becomes "my checkpoint is 18463" / "so is mine",
zero documents.

One additional mechanism: a reconciliation boundary. If the browser requests seq 300 but the server has
compacted history below 800, reply `checkpoint_expired` with a `snapshot_revision`; the browser destroys and
rebuilds its projection. That prevents the replication protocol from becoming a permanent archaeological
archive.

## 3. MCP v2: don't ignore it, but don't make it the critical path

MCP TypeScript SDK v2 is now stable (the repo says v2 is the stable line implementing the July 28, 2026 spec;
latest release 2.2.0; v1 keeps fixes during the migration period). The official v2 migration documentation
describes exactly the behavior your spike ran into: a v2 client in automatic negotiation mode probes
`server/discover` and falls back to the legacy handshake when talking to a 2025-era server. So "HTTP 400
breaks Agent-Native; JSON-RPC method-not-found over HTTP 200 allows fallback" is the intended negotiation
boundary, not a hack.

Sequencing: Phase 369 v1 fixes the server's discovery semantics so a v2 client identifies it as legacy; then a
golden compatibility suite for CLI / Desktop / Cowork / browser; then migrate the MCP implementation to SDK v2
as its own change (the SDK ships a v1 to v2 codemod; protocol-era adoption still involves architectural work).
Do not rewrite the MCP server simultaneously with introducing the browser surface. But do not start new
long-lived MCP infrastructure against v1 either.

## 4. RxDB: the architectural decision is good

The crucial language is "read copy". Don't reproduce room.db in RxDB. Create a UI projection schema. The room
may have 30 internal SQLite tables; the browser might need only: room, nodes, relations, artifacts, decisions,
activity. Possibly fewer. That removes the 13-collection free-tier concern. RxDB represents what the UI needs to
know about the room, not how MindrianOS stores it.

Constitution sentence: The browser projection is disposable. At any moment it must be possible to delete it
entirely and reconstruct it from room.db without loss of MindrianOS state.

Hazards to test explicitly: stale checkpoints after compaction, schema migration between UI releases, browser
crash halfway through applying a batch, multiple tabs pulling simultaneously, persistent browser data after a
room is removed, hard deletes. The `change_seq + change_log` design addresses most of these cleanly.

## 5. I would revive Workroom

Do not choose between Workroom and Agent-Native as whole applications. Use the Workroom as the product and
visual shell (BlockNote, views, Design v3) with Mindrian actions and an agent/chat integration (Claude /
adapter). Use Agent-Native where it buys something: action abstraction, shared agent/UI context, streaming
agent UX, chat shell patterns, agent-visible application state. Its design philosophy is aligned (UI and agent
operate over shared capabilities rather than an agent clicking the UI). But Agent-Native also has opinions you
don't want to inherit: its architecture assumes PostgreSQL-backed application state by default, including
hosted/collaborative state. MindrianOS has already decided room.db = mind. Don't fight that battle.

The one-day test: build the SAME vertical slice twice, not two generic demos. Open one real room; display a
BlockNote document; chat with Claude: "Does this claim have enough evidence?"; Claude uses a Mindrian action; a
Shape F gate appears as real UI; click Confirm; server writes room.db; change_seq increments; SSE fires; RxDB
pulls; the BlockNote / evidence view updates. Run it once with Workroom + thin agent/action integration, once
with the Agent-Native scaffold + transplanted BlockNote. Judge only four things: how much MindrianOS
architecture had to be distorted; how much existing Workroom code survived; how cleanly selected UI state
reaches Claude; how many new persistent-state assumptions appeared. Expectation: Workroom wins as the chassis
and Agent-Native becomes a donor, rather than vice versa.

## 6. There is a concrete error in Wave 0

The brief says "verify the unflagged Node line against the >=22.16.0 floor". At Node 22.16.0, native
TypeScript type stripping still required the experimental flag. It became enabled by default in Node 22.18.0.
So for `node foo.ts` with no flag, the floor must be at least Node >= 22.18.0, not 22.16. Correct this before
Wave 0 is ratified.

Native TS constraints: Node does not honor tsconfig runtime transformations; path aliases don't work as
TypeScript aliases; `.tsx` isn't supported by the native stripper; syntax that requires code generation fails.
Node documentation recommends an erasable-only configuration (`erasableSyntaxOnly`, `verbatimModuleSyntax`,
NodeNext-style modules).

Define the rule narrowly:

```text
SERVER / CORE: .ts allowed; erasable syntax only; no enum; no parameter properties; no TS path aliases;
explicit extensions; type imports use `import type`; no TSX; no transpilation expectation.
UI: Vite build; TS + TSX normal.
HOOKS: remain .cjs/.js until cold-start measurements prove otherwise.
```

That is: MindrianOS permits zero-build erasable TypeScript in runtime-safe areas, while the browser
application has an explicit build boundary.

## The architecture I would freeze

```text
+-------------------------------------------------------------+
|                    MINDRIAN WORKSPACE                       |
| Work | Evidence | Decisions | Deliverables | Rooms | Claude |
| BlockNote / Graph / Views / Shape-F cards                   |
+----------------------------+--------------------------------+
                             |
                       TASK ACTIONS
                             |
              +--------------+--------------+
              |                             |
          READ ACTIONS                 WRITE ACTIONS (always governed)
              |                             |
              +--------------+--------------+
                             |
                       MCP / DOMAIN CORE
                             |
                  +----------+----------+
                  |                     |
              room.db              gate ledger
            SOURCE OF TRUTH         human truth
                  |  same transaction
                  v
           room_change_log (change_seq)
                  |
           +------+------+
           |             |
          SSE          Pull API
       "wake up"       "give delta"
           +------+------+
                  v
                RxDB (disposable read copy)
                  v
              React views
```

Claude sits inside the workspace but outside the truth boundary: Claude may reason, inspect, propose, invoke
actions; a Mindrian action; a gate when required; a human; room.db. Claude can operate MindrianOS. Claude does
not become MindrianOS.

## Three things I would make P0 before shell work

The consume-before-session bug is a real integrity flaw, not UI polish. Fix that first. Then make the CLI/web
share the same recommended-option field and gate superset. Then establish `change_seq + change_log +
room.changed`. Once those three are true, the browser shell sits on stable contracts rather than compensating
for backend ambiguity.

Sources cited by the author: github.com/builderio/agent-native (README and AGENTS.md);
github.com/modelcontextprotocol/typescript-sdk (README, docs/migration/support-2026-07-28.md,
docs/migration/upgrade-to-v2.md); nodejs.org v22.16.0 docs/api/typescript.html; nodejs.org blog release
v22.18.0.

---

# Second review (Codex, separate run, same day; reviewed the exported bundle, did not rerun the spikes)

Verbatim, dashes normalized. Disposition in 369-INPUT.md section 13, rows R2-1 to R2-9.

My assessment: strong research, but Phase 369 is not yet an implementation-ready UI/UX plan. The spikes support the
basic gate and replication interactions. They do not yet prove a complete, recoverable browser workspace.

I reviewed the brief, planning input, phase card, design canon, prior review, and spike reports/logs. This is a review
of the exported snapshot; I did not rerun the spikes or audit the current implementation.

The main issues, in priority order:

1. [High] "Only a human confirms" needs an enforceable distinction between human and agent calls. The plan exposes
   actions to both the UI and the agent, including the gate-answer capability. Session ownership establishes which
   session owns a gate; it does not establish that a person clicked it. The plan should specify how the server
   distinguishes an authenticated human approval from an agent invoking the same action. Add an acceptance test in
   which the agent attempts to approve its own proposed claim and is refused. This is an unresolved contract, not a
   demonstrated vulnerability. (369-INPUT.md, architecture and constraints)

2. [High] The validated replication path does not establish the promised MCP-only architecture. Spike 006 uses a
   separate pull server reading through navigation.cjs, with filesystem watching and an in-memory journal. The phase
   promises that the shell accesses rooms exclusively through MCP. Before implementation, define the MCP
   snapshot/change-feed interface and how the browser's pull handler reaches it. Also cover writes from terminal
   processes: an in-process MCP event bus alone cannot observe them. (Spike 006)

3. [High] Gate recovery needs more than fixing session-check-before-consume. Consider: the user confirms, persistence
   succeeds, and the response disappears. What does retry return? What happens after a server restart, room switch, or
   change to the claim being approved? Require durable decision outcomes, idempotent retries, revision checks, and
   explicit expired/stale states. The September review already proposed expected revisions, idempotency keys, and
   recovery tests; these should become explicit Phase 369 acceptance criteria. (2026-09-20 review)

4. [High] The phase can satisfy its deliverables without delivering the intended work loop. A live room view plus
   working approval button could pass much of the phase card while browser task execution, cancellation, document
   editing, and return-to-work remain unresolved. Choose whether v1 delivers a room review surface or an executable
   workspace, then require one complete journey for that scope. Local authentication, room isolation, safe content
   rendering, and offline assets also need explicit acceptance criteria carried forward from September. (Phase card)

5. [Medium] Website styling is being asked to decide product behavior. Canon v3 explicitly describes a website funnel
   and a front-page illustrative tile room. Its typography, contrast, controls, and motion rules transfer well. The tile
   room has not been demonstrated as the best working interface for evidence and decisions. Its state vocabulary also
   needs clarification: rust means both "challenged" and "fixed"; white means "empty" and "delivered." Preserve the
   canon, but pair these with distinct written statuses. Interpret "one decision per view" as one focused approval with
   its evidence accessible, not a requirement to hide useful context. (Design canon)

My answers to the brief's six technical questions:

- One action per MCP tool? Keep thin, schema-derived wrappers internally. Give the UI task-shaped operations where
  useful, with server-owned authorization and orchestration. Do not automatically expose every wrapper to both humans
  and agents.
- change_seq column or change log? Prefer a transactional append-only change log covering node and edge inserts,
  updates, and deletes. A row column alone cannot retain hard-delete information. Define room identity, database
  epoch, ordered cursor, retention floor, and snapshot reset behavior.
- SDK v1 or v2 now? Use a narrowly scoped, tested discovery compatibility fix for the pinned client/server pair. Do not
  generalize it to all session-less requests. Make SDK migration a separate compatibility decision; the shim proves
  interoperability for the tested case.
- One-way RxDB risks? Prioritize checkpoint correctness, deletion retention, room-specific cache identity, multi-tab
  lifecycle, and cache rebuilding. Use SSE as an invalidation hint and pull from the durable cursor; RxDB explicitly
  supports RESYNC for this pattern. (rxdb.info/replication.html)
- Workroom or agent-native? In one day, run the same production-built slice in each: bind room, show evidence, render
  gate, approve/defer, reconnect. Compare retained useful code, direct-file-write replacement, dependency removal,
  startup errors, and packaging. Spike 007's database-error toast means its scaffold is not yet a clean production
  baseline.
- Native TS or compilation? Keep hooks/server JS initially and build the UI at release time. Native stripping becomes
  default in Node 22.18.0, above the declared 22.16.0 floor; Node also refuses stripping beneath node_modules, ignores
  tsconfig transformations, and does not type-check. Test the actual installed layout, not just a checkout.
  (nodejs.org/docs/latest-v22.x/api/typescript.html)

For UX, I would adopt Work / Evidence / Decisions / Deliverables, with Rooms as the context selector and graph as a
secondary view. The opening screen should identify the current question, meaningful changes since the last visit, and
the next decision. The canon's four orientation questions fit that composition; they need not compete with it.

The next milestone should prove one recoverable journey: open the correct room, inspect evidence, make a human
decision, observe its persisted result, restart and recover it correctly. That would provide much stronger evidence for
choosing the shell than another isolated visual or latency demo.
