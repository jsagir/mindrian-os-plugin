# Phase 358 (planning pass 2): B2 frame provenance - Research

**Researched:** 2026-09-23
**Domain:** local room graph (node:sqlite via the navigation chokepoint), room artifacts under `.mindrian/`, MCP tools (Desktop `claude-ai`, Cowork), `/mos:room` CLI subcommands
**Confidence:** HIGH on current state and collision map (all read from source this session); MEDIUM on the pause design (a design recommendation that needs one navigator ruling on slide wording)

<user_constraints>
## User Constraints (from 358-CONTEXT.md)

### Locked Decisions (B2 slice, verbatim)

B2 slice (planning pass 2, LOCKED 2026-09-23; B1 is complete: plans 358-01..05, runner 27/27)
B2 makes slide A1 true: "which direction" and "can I turn around". Acceptance tests (go/no-go, each move judged separately):
- B2-AT1 (which direction): the room shows where its CURRENT governing question came from: chosen / tasking / prompt / inherited. Visible on CLI and via MCP (Desktop `claude-ai` is write-enabled per B1).
- B2-AT2 (which direction): changing the question keeps the old one visible as a history an officer can open (ordered versions, each with origin and time).
- B2-AT3 (can I turn around): before an answer to a CHANGED question is produced through the normal flow, the officer is asked what the old question got wrong. Scope for 6 Oct: the pause sits on the governing-question change path (the frame/governing-thought write), so a question change cannot land silently; answer producers that read the governing thought see an unresolved change and surface the ask first. The planner must name every answer path covered and every path NOT covered, honestly.
- B2-AT4 (can I turn around): with a written account the change is filed as `refines` (account stored as an artifact handle, never free text in graph metadata); without one it is filed as `relocates`; BOTH frames stay visible; neither is presented as better.
- If B2-AT1/AT2 pass but AT3/AT4 do not, "which direction" goes up and "can I turn around" stays off (pre-written fallback wording in nato.html).
- Substrate: lib/core/navigation/typed-frame.cjs (origin, governingThoughtHash, predecessorHash, classifyFrameChange exist; no consumer); governing-thought hash + staleness machinery (brain-derivation.cjs, brain-derivation-queue.cjs, brain-md-staleness.cjs, navigation-engine-offer.cjs); docs/FRAME-PROVENANCE-PRODUCT-WORKUP.md is a PEER-UNTRACKED file: read-only, never stage it.
- Same canon and collision rules as B1. Reuse B1 surfaces where natural (claim_read / claim-checks CLI patterns, run-all-358.sh legs added deliberately).

### Carried forward from the phase (apply to B2 unchanged)
- Canon Part 8: local enums only; free-form notes are artifacts referenced by handle; nothing crosses to Theo / the Brain.
- Canon Part 9: writes through the existing chokepoints (lib/core/node-insert.cjs via a navigation submodule); reads through lib/core/navigation.cjs.
- Canon Part 11: any new command / MCP tool is born wired (connector registry, shape declaration) per CIRS.
- Tri-Polar: CLI + Desktop + Cowork. Desktop `claude-ai` is tier0 write-enabled (358-02). Cowork only after a live client-name probe; until then the demo-machine env fallback `MINDRIAN_MCP_FIRST=desktop,cowork` is documented, not relied on.
- Collision rules: commit only owned files with `git commit --only`; `git add -f` for .planning paths. Never touch docs/reviews/*, evals/plurai/*, scripts/eval-icm-writers.cjs, scripts/jev-devtime-client.cjs, tests/test-353-*, .planning/phases/356-*, data/jev-policies/, .planning/STATE.md. lib/mcp/tools/gate.cjs is peer territory (354 shipped, 355-22 open): do not touch. No em-dashes.
- The 6 October go/no-go includes a release cut and a live install check on the real demo machines.

### Claude's Discretion (B2 reading of the phase discretion)
- Exact CLI surface chosen by reuse-before-build (Part 7).
- Exact MCP surface: prefer extending existing tools, justify any new one.
- Rendering format, as long as the ATs are literally visible.

### Deferred Ideas (OUT OF SCOPE)
- Any UI in the Visible Room wiki beyond what the acceptance tests need.
- Final rung list from the paper author (B1 concern, unchanged).
</user_constraints>

<phase_requirements>
## Phase Requirements (proposed IDs B2-01..B2-10; ROADMAP carries none yet)

| ID | Description | Research Support |
|----|-------------|------------------|
| B2-01 | One room-level governing question record: versions are frame nodes (role `governing_question`), immutable once written, each carrying origin (required, one exported origin constant), sha256 hash of the normalized question, question artifact handle, version number, predecessor, time | Current State; Pattern 1; Pitfalls 1-4 |
| B2-02 | One write door `setGoverningQuestion` that refuses a changed question unless the caller supplies an account (-> `refines`, account filed as an artifact, handle on the node) or an explicit relocate (-> `relocates`); same text is `unchanged` and writes nothing | Pattern 2; Q3 |
| B2-03 | A refused change leaves a pending-change marker (artifact file, no graph prose) that every B2 read surface renders FIRST as the ask "What did the old question get wrong?" until resolved | Pattern 3; Q3 |
| B2-04 | Reader: current question (text, origin, time, version) and ordered history (every version with origin, time, change kind, account when refines); both frames always rendered with equal weight; out-of-band edits of a question artifact reported as unresolved | Pattern 4 |
| B2-05 | CLI: `/mos:room question`, `/mos:room question history`, `/mos:room question set <text>` backed by `scripts/room-question.cjs` (thin caller); the set flow asks origin and, on a change, asks what the old question got wrong before calling the script | Q4 |
| B2-06 | MCP: `question_read` (read, hitl none) and `question_set` (write, F.1, write-gated like claim_verify, Desktop `claude-ai` enabled) in a new `lib/mcp/tools/question.cjs`; refusal payload carries the ask text and the previous question | Q4 |
| B2-07 | Edges: `REFINES` new->prior for refines; `FOLLOWS_FROM` new->prior with `{change_kind:'relocates'}` for relocates; no new edge vocabulary; never `SUPERSEDES`, never review_status `superseded` | Q5 |
| B2-08 | Close-everything persistence: set in one process/session, change in a second, reopen in a third; history, origins, times, account and pending marker all intact | Validation |
| B2-09 | Part 8 floor: no question or account prose in any node property or edge property; no Brain client reachable from B2 files | Security |
| B2-10 | Born wired and green: registries regenerated last, test-276 sweep re-frozen, test-270 budget within tolerance or re-baselined, run-all-358.sh extended with B2 legs and exits 0; B2 go/no-go runbook section with an honest covered / not-covered answer-path table | CIRS; Collision Map |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Work only in /home/jsagi/dev/MindrianOS-Plugin; all dev work through GSD.
- CJS only; CLI entry points use a `process.argv` switch-case router; no Commander/yargs.
- No em-dashes anywhere; Feynman-simple, JTBD-oriented prose.
- Part 7 reuse-before-build: search commands/*.md first and justify any net-new surface.
- Part 8: user data never egresses to the Brain.
- Part 9: SQL (room.db) is the local mind; only a human confirms a truth-claim node; only a human closes a node as superseded (Appendix D entry 41).
- Part 11: every invocable surface born WIRED or EXCLUDED, with a declared HITL shape.
- Part 12: no grades or praise pulling attention onto Larry; every Larry turn wears a De Stijl mark.
- Tri-Polar: CLI, Desktop, Cowork.
- Verification: `bash tests/run-all-358.sh`, `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/doctor.cjs --acceptance`.
- Not live until released and picked up (release cut + live install check on demo machines).

## Summary

The frame substrate is real but thin, and it is aimed at the wrong thing. `typed-frame.cjs` can store `origin`, `governing_thought_hash`, `predecessor_hash`, `change_kind` and `refinement_handle` (typed-frame.cjs:119-199), but no production code calls `writeFrameNode`, the reader has no timestamps, no ordering and mixes in FUSION composition frames (typed-frame.cjs:213-237), an invalid origin is silently dropped while the write reports ok, and re-writing a version silently overwrites history (probed this session). None of that blocks B2; all of it must be hardened before an officer relies on it.

The bigger finding: **the codebase has no user-owned "governing question" today.** The thing the hash/staleness machinery tracks is the MINTO `governing_thought` of each section, and that is a machine-written ANSWER summary, not a question: tier-0 writes "<Section> synthesizes N artifacts into a coherent argument..." (vault-section-minto-generator.cjs:447) or the text of the top conclusion/decision node (:394-434); tier-1 writes an LLM "one sentence, Minto-style" statement (lib/memory/feynman-prompts.cjs:130). It is regenerated in the background after artifact writes (post-write enqueue, drained by the UserPromptSubmit intent-classifier every turn, scripts/on-stop:365-368). Its hash changes whenever an officer files work. Wiring the B2 pause to that hash would fire on routine filing and would call a summary refresh a "question change": dishonest on the slide and noisy in the demo. The other near-misses (Phase 345 `goal.parent_question` in jtbd-state, which has a slot but zero production writers; the per-turn JTBD classifier; issue-tree `keyQuestion`) are not it either.

So B2 must add ONE explicit, room-level governing question with ONE write door. The pause is structural at that door: a changed question cannot be recorded until the caller brings either the officer's account (refines) or an explicit "it is a new question" (relocates). A refused attempt leaves a pending marker that every B2 read surface shows first. This makes AT1, AT2 and AT4 fully testable offline by 6 October, and makes AT3 true in this exact sense: **the room never records a new question without first asking what the old one got wrong.** It cannot stop the host model from chatting about a new question without recording it (no hooks on Desktop/Cowork; the MCP instructions string is at 1984 of 2000 bytes and owned by open 359 plans). The published slide line says "asks ... before it shows a new answer": that wording needs a navigator ruling against this honest scope (Open Question 1).

**Primary recommendation:** build `lib/core/frame-provenance.cjs` (one door: set/read/history/pending, artifacts under `<room>/.mindrian/frames/`) over a hardened `typed-frame.cjs`, then two thin callers: `scripts/room-question.cjs` behind `/mos:room question ...` and `lib/mcp/tools/question.cjs` (`question_read`, `question_set`). Do not touch MINTO, brain-derivation*, navigation-engine*, sensors, gate, status or runtime-instructions.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Frame version storage (origin, hash, version, predecessor, change kind, handles) | Database (room.db `nodes`, via typed-frame.cjs + node-insert) | - | Part 9: SQL is the local mind; one navigation submodule owns the node shape |
| Question text and refines account (prose) | Room filesystem artifact (`<room>/.mindrian/frames/*.md`) | - | Part 8 + locked AT4: prose lives in artifacts, the graph carries handles and hashes only |
| Change rule (unchanged / refuse / refines / relocates), pending marker, ordering, concurrency | Local core module (`lib/core/frame-provenance.cjs`) | Database (BEGIN IMMEDIATE) | One door both callers share; mirrors verification.cjs's role for B1 |
| CLI surface (show, history, set with the ask) | Claude Code command body (`commands/room.md`) + script | Core module | Larry asks via AskUserQuestion; the script enforces the same rule |
| MCP surface (read, set with refusal-as-ask) | MCP tool module (`lib/mcp/tools/question.cjs`) | Core module | Desktop/Cowork have no hooks; the tool response carries the ask |
| Brain | none | - | Nothing in B2 crosses to Theo |

## Current State (question 1, with file:line evidence)

### typed-frame.cjs as shipped (substrate commit 42191a6ae)
- `FRAME_ORIGINS = Set(['chosen','tasking','prompt','inherited'])` at :60. No labels, no order, no TODO marker for the paper author's definitions.
- `writeFrameNode(db, {frameKey, sessionId, members, topic, taxonomy, origin, governingThoughtHash, predecessorHash, versionKey, changeKind, refinementHandle})` :119-199.
  - origin kept only if it is in the Set (:140); an invalid or missing origin is DROPPED and the write still returns `ok:true` [VERIFIED: probe].
  - `change_kind` accepts 'refines' with no `refinement_handle` (:147-152); nothing ties the two together.
  - node id = `FRAME_NODE_ID(sid, versionKey || frameKey)` (:159-161); `insertNode` uses the default `on_conflict: 'update'` (:166-172), so writing the same versionKey twice OVERWRITES props [VERIFIED: probe, v1 origin tasking -> chosen and hash h1 -> hX with ok:true]. `insertNode` already supports `on_conflict:'nothing'` (node-insert.cjs:222-225, :244-248) and preserves `created_at` on update (:246-248).
  - review_status lands 'proposed'; `taxonomy:true` promotes via a raw UPDATE (:181-197) that test-348 lists as a pre-existing out-of-door writer. B2 must not use taxonomy:true.
- `classifyFrameChange(prev, cur)` :205-211: 'unchanged' when hashes equal or missing, else 'refines' iff `refinement_handle` present, else 'relocates'. Fine as a pure helper.
- `readFrameProvenance(db, {sessionId})` :213-237: `SELECT ... WHERE type='frame'` with NO `ORDER BY`, returns no `created_at`, no version, no question handle, and returns FUSION composition frames mixed in [VERIFIED: probe returned `fusion-a` next to the governing-question versions].
- `readOpenFrames` :259-305 returns ALL frame nodes when no sessionId; `fusion-router.cjs:119` calls it with `sessionId: ''` when none is set, so governing-question versions would appear as FUSION "open frames" unless filtered.
- Re-exports: navigation.cjs:478-483 (`writeFrameNode, FRAME_NODE_TYPES, FRAME_NODE_ID, FRAME_ORIGINS, classifyFrameChange, readFrameProvenance`).
- Tests: tests/test-b2-frame-provenance.cjs (35 lines, passes; relies on implicit rowid order), tests/test-205-frame-node.cjs, tests/test-205-fusion-router.cjs.
- Consumers: `writeFrameNode` has ZERO production callers (grep of lib/ scripts/ bin/: only comments in fusion-router.cjs:47,64 and navigation.cjs). `readFrameProvenance` and `classifyFrameChange`: zero callers outside the unit test. Confirmed: no consumer outside navigation.cjs.

## Where the governing question lives and changes (question 2)

Every write path for anything that could be called "the governing question/thought", enumerated from source:

| # | Store | Writer(s) | What it actually is | Changes when | Usable as B2's question? |
|---|-------|-----------|---------------------|--------------|--------------------------|
| 1 | Section `MINTO.md` frontmatter `governing_thought` (+ body abstract) | scripts/vault-section-minto-generator.cjs tier-0 :600-626 (from `deriveGoverningThought` :444-470) and tier-1 :987-1004 (Feynman narrative); invoked by scripts/intent-classifier (UserPromptSubmit drain), scripts/on-stop :365-368, scripts/vault-regenerate-all.cjs, scripts/heal-command.cjs, lib/memory/*worker | A machine-written ANSWER summary per section: "X synthesizes N artifacts..." (:447), the top conclusion/decision node text (:411-431), or an LLM Minto statement (feynman-prompts.cjs:130). /mos:status calls it "what each section KNOWS" (commands/status.md:55) | Every artifact filing (post-write :193-203 enqueues, next turn drains) | NO. Not a question, not user-owned, churns with filing |
| 2 | brain-derivation queue `.mindrian/brain-derivation-queue.json` | `tryEnqueueBrainDerivation` vault-section-minto-generator.cjs:762-779 -> brain-derivation-queue.cjs:245-253 | Hash pair of #1 to refresh BRAIN.md | Same as #1 | NO (derivative of #1; Brain-adjacent path) |
| 3 | BRAIN.md `governing_thought_hash` staleness | brain-md-staleness.cjs:292-302 (read), brain-derivation.cjs:117-120,153 (hash) | Staleness of #1 | Same as #1 | NO |
| 4 | Memory cortex `governing_thought` node | reconcile-memory-runner.cjs:226-234, :559-573 | Projection of #1 (hash + freshness enum) | Same as #1 | NO |
| 5 | jtbd-state `goal` {jtbd, parent_question, rung, goal_version} + `goal_history` in `.mindrian/jtbd-state.json` | `setGoal` jtbd-state.cjs:307-372; ONLY caller goal-gate.cjs:190-192 (strategy card approve through gate_answer) | Navigator-ratified JTBD label + Theo rung. `parent_question` slot exists but goal-gate never passes it (setGoalOpts = {jtbd, set_by, rung?}); only tests write it. `goal_history` rows drop parent_question (:349-357). Read by strategy-card.cjs:303 for the taxonomy climb | Strategy card approve | NO for 6 Oct: 345 territory, single-caller invariant, requires a jtbd, history loses the question. Record as a later reconciliation (Open Question 4) |
| 6 | jtbd-state `current` | scripts/jtbd-update.cjs on every UserPromptSubmit/Stop | Per-turn classifier guess | Every turn | NO |
| 7 | issue-tree `keyQuestion` | lib/core/issue-tree.cjs:153,220 | Diagnostic pipeline input for one tree | Per pipeline run | NO (pipeline-local) |
| 8 | Frame node provenance fields | typed-frame.cjs `writeFrameNode` | Built for exactly this | Never (no caller) | YES, once hardened |
| 9 | Any MCP tool / command that edits a governing thought | none: no lib/mcp/tools/*.cjs references governing_thought (grep); `artifact_file` could write a MINTO.md into a section but that is #1's file, regenerated over | - | - | - |

Readers of #1 (the "answer producers that read the governing thought" in the CONTEXT wording): navigation-engine-offer.cjs:70-72, :239-245, :411-414 (next-move margin and reason text), sensors/sensor-memory-cortex.cjs:25, :88 (stale-governing-thought trigger), lib/chat/chat-context.js, statusline-cache.cjs, commands/status.md and commands/room.md:206-223 (render). None of them reads a question; all of them read the section summary.

**Conclusion:** B2 introduces the question as a new record (row 8). It reuses only the hashing CONVENTION of #1 (`'sha256:' + sha256(text.normalize('NFC'))`, brain-derivation.cjs:117-120, vault-section-minto-generator.cjs `sha256GoverningThought`) so hashes look and compare the same way. It does NOT hook into #1-#4. [VERIFIED: source read this session]

## The pause (question 3)

### Candidate designs, judged
- **(a) Gate on the write door (RECOMMENDED, required).** `setGoverningQuestion` refuses a changed question unless `account` or `relocate:true` is supplied. Nothing lands silently because there is no other writer. The refusal payload IS the ask. Cost: small, fully offline-testable.
- **(b) Unresolved-change marker surfaced by answer producers (RECOMMENDED, scoped).** With (a) in place, "unresolved" only arises two ways: a refused `question_set` (Larry proposed a change, the officer has not answered yet, possibly across sessions) and an out-of-band edit of a question artifact on disk (hash on node != hash of file). Both are rendered FIRST by every B2-owned read surface. Surfacing it in non-B2 producers is blocked by collisions or budget (table below).
- Wiring the pause to the MINTO hash (#1) is REJECTED: it fires on routine filing and is not a question change.

### Answer producers: covered vs NOT covered on 6 October

| Producer | Surface | Reads B2 question? | 6 Oct coverage | Why |
|----------|---------|--------------------|----------------|-----|
| `question_set` (new) | Desktop, Cowork, CLI via MCP | writes it | COVERED: refuses a change without account/relocate; returns the ask and the previous question; records pending | The door itself |
| `/mos:room question set` (new) | CLI | writes it | COVERED: command body asks origin and, on a change, "What did the old question get wrong?" (AskUserQuestion: write it / it is a new question / cancel) before the script runs; the script refuses the same way if the ask was skipped | Same door |
| `question_read` / `/mos:room question` (new) | all | yes | COVERED: pending ask rendered first, then current question, then history | B2-owned |
| `claim_read` (B1, owned) | all | optional | OPTIONAL: add a one-line `frame_notice` when a change is pending | B1-owned file; costs schema-budget bytes; planner's call |
| Host model's own chat (Larry answering in prose) | all | no | NOT COVERED | No hooks on Desktop/Cowork; nothing in MindrianOS sees a question the officer never records. This is the honest limit |
| MCP `instructions` standing order | Desktop, Cowork | - | NOT COVERED | lib/mcp/runtime-instructions.cjs serves 1984 bytes vs a 2000-byte budget (test-298:153-154, no-instructions.test.cjs:87 host cap 2048). A one-line rule (~100 bytes) cannot fit without trimming frozen text; open plans 359-09 and 359-11 own the file and data/harness-manifest.json |
| `suggest_next`, `reach_candidates`, `framework_run`, `whitespace_scan` | MCP | no | NOT COVERED | lib/mcp/tools/sensors.cjs is open plan 355-05 territory. Also suggest_next runs AFTER the answer (runtime loop step 2) |
| `chain_resolve` / `chain_run` | MCP | no | NOT COVERED (stretch candidate) | chain.cjs has no open peer plan (356 complete), so a pending-change pre-check is technically possible, but it is scope beyond the ATs; only add if the plan set is ahead of schedule |
| `gate_render` / `gate_answer` | MCP | no | NOT COVERED | gate.cjs: 354 shipped, 355-22 open; locked "do not touch" |
| `status_read` | MCP | no | NOT COVERED | status.cjs 354-14 territory |
| `context_assemble`, `graph_reason`, `room_state_bound` | MCP | no | NOT COVERED | Not in the answer loop; adding a leg is scope creep |
| Next-move engine (navigation-engine*.cjs, navigation-engine-offer.cjs) | CLI hooks, MCP | reads MINTO only | NOT COVERED | 355-22 edits navigation-engine.cjs; reads the section summary, not the question |
| UserPromptSubmit hooks (intent-classifier, jtbd-update, brain-derivation-drain), session-start banner | CLI | no | NOT COVERED | intent-classifier is open plan 360-07; a new hook is a hooks.json change with its own test surface |
| MINTO regeneration + brain-derivation queue | background | no | N/A | Not an answer producer to the officer and not a question change |
| Strategy goal card (345) | CLI/MCP via gate | its own goal | N/A | Has its own Decision Gate on a JTBD label; separate record |

**What the slide can honestly say after (a)+(b):** "When you change the room's question, the room asks what the old question got wrong before it records the new one, and keeps both questions on the record." The published wording ("before it shows a new answer") holds only if the demo flow routes every question change through the door AND Larry is not counted as "the room" when he chats. Navigator ruling required (Open Question 1).

## Standard Stack

### Core (in-repo; no new dependency)
| Module | Role in B2 | Why |
|--------|-----------|-----|
| lib/core/navigation/typed-frame.cjs | frame version node writer/reader (hardened) | The shipped substrate named in CONTEXT |
| lib/core/node-insert.cjs `insertNode` | the write chokepoint; `on_conflict:'nothing'` for immutable versions | Part 9 |
| lib/core/navigation/edges.cjs `writeEdge` | REFINES / FOLLOWS_FROM edges | Closed allowlist, no new vocabulary |
| lib/core/navigation.cjs | re-export door; `openRoomDbForCaller`, `resolveByUser`, `detectActiveRoom` | Part 9 read chokepoint; B1 precedent |
| lib/core/room-path-containment.cjs `writeFileContained`, `assertRealpathContained` (:138, :164) | atomic, contained artifact writes under `.mindrian/frames/` | Same primitive artifact_file uses; symlink-safe |
| node:crypto | sha256 of the normalized question | Same convention as brain-derivation.cjs:117-120 |
| zod ^3.25.76 (already a dependency) | MCP tool schemas | Existing stack |

### Supporting (copy patterns, do not edit)
| Module | Pattern to copy |
|--------|-----------------|
| lib/core/navigation/verification.cjs:186-187 | BEGIN IMMEDIATE ownership idiom (`db.isTransaction !== true`) |
| lib/mcp/tools/claim-verify.cjs:32-43 | `hostBlock(server, ctx)` live client-name probe; write refusal with MINDRIAN_MCP_FIRST hint |
| scripts/claim-checks.cjs | argv switch-case CLI, room resolution, options printed from the exported constant |
| tests/helpers/b1-358-child.cjs, tests/test-358-b1-persistence.cjs | cross-process "close everything" test |
| tests/test-358-b1-surfaces.cjs | stub-server + real stdio wire leg as `claude-ai` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `lib/mcp/tools/question.cjs` | Add `question_*` tools to claim-verify.cjs | Avoids one generated coverage-ledger row, but mixes claims and frames in one file; the ledger row is generated, so the clean file wins |
| Question text in an artifact | Question text on the frame node (claims do carry `text`) | Violates typed-frame's own "no prose on a Frame node" header and invites the account to follow; artifact keeps Part 8 simple and uniform |
| `.mindrian/frames/` | A visible room folder (e.g. `frames/`) | A top-level folder is scanned as a section by lib/vault/room-scanner.cjs (SKIP_DIRS :41-51 lacks it), gets a generated MINTO.md, and trips "every directory has a ROOM.md" doctor checks. `.mindrian/` already hosts decision-traces, meetings, hats |
| New RELOCATES edge | FOLLOWS_FROM + change_kind prop | Minting an edge moves a frozen constitutional set (navigator-gated, D-150.8 precedent, edges.cjs:306-313); not worth it before 6 Oct |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by B2. slopcheck not run (nothing to check).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | - | - | - | - | - | - |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Officer (CLI /mos:room question set "...")      Officer via Larry (Desktop/Cowork/CLI MCP)
        |  AskUserQuestion: origin;                      |  question_set {text, origin, account?, relocate?}
        |  on change: "what did the old                  |
        |  question get wrong?"                          v
        v                                         lib/mcp/tools/question.cjs
scripts/room-question.cjs set ...                 (write gate: isWritePathEnabled; hostBlock)
        \                                               /
         \____________________   _______________________/
                              v v
             lib/core/frame-provenance.cjs  setGoverningQuestion(db, roomDir, p)
                              |
            normalize + sha256 -> compare with latest version
               |            |                         |
          same hash    no prior version        changed hash
               |            |                   |           |          |
          'unchanged'   write v1          account given  relocate   neither
          (no write)    (change_kind      -> refines     -> relocates  -> REFUSE
                         null)                                         {reason:'change_needs_account',
                                                                        ask, previous, proposed}
                                                                        + write pending marker file
               BEGIN IMMEDIATE
                 1. write .mindrian/frames/q-v<N>-<h8>.md  (+ a-v<N>-<h8>.md when refines)
                 2. navigation.writeFrameNode(role governing_question, version N, origin,
                    hash, question_handle, predecessor, change_kind, refinement_handle,
                    on_conflict 'nothing')
                 3. navigation.writeEdge(REFINES | FOLLOWS_FROM{change_kind:'relocates'}) new -> prior
                 4. clear pending marker
               COMMIT
                              |
                              v
        room.db nodes (type 'frame', role governing_question)  +  .mindrian/frames/*.md
                              |
                              v
   readGoverningQuestion / readQuestionHistory (frame-provenance.cjs)
     -> pending ask FIRST, then current {text, origin, time, version},
        then ordered history (each: origin, time, change_kind, account text if refines)
        + unresolved flag if an artifact's hash != node hash
                              |
           +------------------+-------------------+
           v                                      v
   question_read (MCP, no write gate)     /mos:room question [history] (CLI, script output verbatim)
```

### Recommended file ownership (all verified free of open peer plans, see Collision Map)
```
lib/core/navigation/typed-frame.cjs   # harden: role, required origin for the role, immutable versions,
                                      #   version + created_at + question_handle in the reader, ORDER BY,
                                      #   readOpenFrames excludes role governing_question
lib/core/frame-provenance.cjs         # NEW: the one door (set / read / history / pending / origins)
lib/core/navigation.cjs               # additive re-exports only
scripts/room-question.cjs             # NEW: argv switch-case CLI (show | history | set | options | help)
commands/room.md + skills/room/SKILL.md  # `question` subcommands; argument-hint; regenerate mirror
lib/mcp/tools/question.cjs            # NEW: question_read, question_set + connectors
tests/test-358-b2-*.cjs, tests/helpers/b2-358-child.cjs, tests/run-all-358.sh (re-opened once)
data/mcp-tool-connectors.json, data/connector-registry.json, data/connector-coverage-ledger.json,
data/harness-manifest.json            # regenerated last, own commit
tests/fixtures/tool-honesty/276-dispositions.json, tests/test-270-tool-schema-budget.cjs  # re-freeze / re-measure last
```

### Pattern 1: Governing-question frame version (data contract)
Node: `type='frame'`, id `FRAME_NODE_ID('room', 'governing-question:v<N>')`, source_path `frame:room:governing-question`, created_by 'system', epistemic_type 'observation', review_status 'proposed' (never promoted, never superseded). Props (additive JSON):
```json
{
  "frameKey": "governing-question", "members": [], "topic": "",
  "frame_role": "governing_question",
  "version": 2,
  "origin": "tasking",
  "governing_thought_hash": "sha256:<hex of normalized question>",
  "question_handle": ".mindrian/frames/q-v2-3f9a1c2b.md",
  "predecessor_hash": "sha256:<v1 hash>",
  "predecessor_node_id": "frame:room:<hash>",
  "change_kind": "refines",
  "refinement_handle": ".mindrian/frames/a-v2-3f9a1c2b.md",
  "set_by": "user", "set_by_id": "<resolveByUser id, optional, local only>"
}
```
Time comes from the `created_at` column (preserved on conflict). Normalization before hashing: trim, collapse internal whitespace, NFC (case kept). Origin is REQUIRED for this role; one exported `FRAME_ORIGINS_ORDERED` constant with plain labels and a `TODO(358): replace labels with the paper author's definitions` marker, same idiom as B1's VERIFICATION_RUNGS.

### Pattern 2: Refusal as the pause
```js
// lib/core/frame-provenance.cjs (sketch)
function setGoverningQuestion(db, roomDir, p) {
  // validate: text 1..1000 chars, origin in FRAME_ORIGINS, account 0..4000 chars, relocate boolean
  const hash = questionHash(p.text);
  const latest = readLatestVersion(db);                  // via typed-frame reader, role-filtered
  if (latest && latest.governing_thought_hash === hash) return { ok: true, result: 'unchanged' };
  if (latest && !hasText(p.account) && p.relocate !== true) {
    writePending(roomDir, { text: p.text, origin: p.origin, based_on_version: latest.version });
    return { ok: false, reason: 'change_needs_account',
             ask: 'What did the old question get wrong?',
             previous: readQuestionText(roomDir, latest), proposed: p.text,
             options: ['refines: write what the old question got wrong', 'relocates: it is a new question'] };
  }
  if (p.based_on_version != null && latest && latest.version !== p.based_on_version) {
    return { ok: false, reason: 'question_changed_meanwhile', current: latest };  // Cowork race
  }
  // BEGIN IMMEDIATE (own only if db.isTransaction !== true), write artifacts, node, edge, clear pending
}
```
`account` present and non-empty wins over `relocate` only if the caller did not also pass `relocate:true`; passing both is refused as `ambiguous_change` so the officer's choice is never guessed.

### Pattern 3: Pending marker
`<room>/.mindrian/frames/pending.json` holding `{proposed_handle, origin, based_on_version, at}` plus the proposed question in `pending-question.md`. Readers render it first: "A question change is waiting. Proposed: <text>. What did the old question get wrong?" Cleared (file removed) when a set lands or when the officer cancels (`room-question.cjs set --cancel` / `question_set {cancel:true}`). No graph node for pending (a node would need a DELETE later, which test-348 forbids for nodes).

### Pattern 4: Readers and rendering (AT1, AT2, AT4)
- `readGoverningQuestion(db, roomDir)` -> `{pending, current:{version, text, origin, origin_label, set_at}, unresolved_edit:boolean}`; no question yet -> honest "No governing question recorded yet".
- `readQuestionHistory(db, roomDir)` -> versions `ORDER BY version ASC`, each `{version, text, origin, set_at, change_kind, account_text?}`.
- Render both frames with identical layout and weight. Labels: "Refines v1 (account on file)" / "Relocates from v1 (no account)". Forbidden words in render and descriptions: better, improved, upgraded, abandoned, corrected, wrong question.

### Anti-Patterns to Avoid
- **Hooking the pause to the MINTO governing-thought hash:** fires on filing, lies about what changed.
- **Filing the question or account through `artifact_file`:** fileArtifact always mints a `type='claim'` reasoning node (lib/mcp/tools/views.cjs:288-290), and B1's portrait counts every `type='claim'` row (verification.cjs:297, :348). The officer's question would show up as an "unchecked claim" in the A2 counts.
- **Defaulting a missing choice to relocates:** makes the silent path the easy path; AT3 fails in spirit.
- **Marking the old frame superseded, or using SUPERSEDES:** only a human closes a node as superseded (CLAUDE.md Part 9, test-348-one-supersession-door.cjs:5-11), and "neither is presented as better".
- **`taxonomy:true` confirm on question frames:** a raw UPDATE outside the door; also implies a truth status a question does not have.
- **Session-scoping the question:** readFrameProvenance scopes by session prefix; the question is room-level. Use a fixed `'room'` scope plus the role filter.

## Surfaces (question 4) and Part 11 / CIRS

Reuse-before-build search (Part 7) [VERIFIED: commands/*.md grep for frame/question/reframe]: `/mos:jtbd` sets the per-turn JTBD label (wrong semantics); `/mos:beautiful-question` is a question-crafting methodology, not a store; `/mos:status` shows MINTO section summaries; `/mos:room` already hosts B1's `checks | claim | check` and is the room's own view. Extend `/mos:room`.

| Surface | Change | Declaration | Regenerate | Gates |
|---------|--------|-------------|------------|-------|
| `/mos:room` (modified) | body adds `question`, `question history`, `question set <text>`; matched before the section fallback; argument-hint gains `question [history|set <text>]` | frontmatter otherwise unchanged (F.1, connector block untouched), same discipline as 358-03 | `node scripts/build-skill-mirrors.cjs` | build-skill-mirrors --check, check-shape-declaration --check, check-render-coverage --check, check-help-coverage |
| `scripts/room-question.cjs` (new) | not an invocable surface | - | - | check-substrate (never require node:sqlite) |
| `question_read` (new MCP) | read, no write gate, returns pending+current+history+hostBlock+plain-text render | connectors `{hitl_shape:'none', layer:'harness'}`, description >= 120 chars, no persistence claim, no em-dash | `node scripts/build-connector-registry.cjs` then `node scripts/build-harness-manifest.cjs` | registry --check, orchestration-projection --check, test-234 floor, test-270-connector-coverage, tool-honesty --check |
| `question_set` (new MCP) | write-gated exactly like claim_verify (refusal with host block + MINDRIAN_MCP_FIRST hint) | connectors `{hitl_shape:'F.1', layer:'harness'}` | same | same, plus test-276 sweep re-freeze (39 -> 41 tools) |

Every PLAN.md touching commands/room.md or lib/mcp/tools/question.cjs carries a `cirs_relationship:` block (surfaces_added [mcp:question_read, mcp:question_set], surfaces_modified [command:room]) and `11` in canon_parts; suggested canon_parts [7, 8, 9, 11, 12]. Verify with `node scripts/check-cirs-declaration.cjs --check <plan>`.

Descriptions (draft, measure against the floor): question_read "Show this room's governing question: where it came from (chosen, tasking, prompt or inherited), when it was set, and every earlier version with its origin, time and whether the change refines or relocates. If a change is waiting, the waiting ask comes first. This tool writes nothing." question_set "Record or change this room's governing question with its origin. A changed question is recorded only with the officer's own account of what the old question got wrong (filed as refines) or an explicit relocate (it is a new question); otherwise nothing is recorded and the ask is returned. Both questions stay on the record."

## Canon: edges (question 5)

Allowed set read live [VERIFIED: `node -e` over edges.cjs ALLOWED_EDGE_TYPES]: includes REFINES, FOLLOWS_FROM, PIVOTED, SUPERSEDES, ELEVATES_TO, DERIVED_FROM, INFORMS; no RELOCATES.
- `REFINES` (edges.cjs:316-339): "a new claim TIGHTENS or CONDITIONS a prior claim without invalidating it", source = refining node, target = prior. Semantics fit "the new question refines the old", written claim-to-claim today; frame-to-frame use adds no vocabulary. Enum props only: `{change_kind:'refines', origin:'<enum>'}`.
- `FOLLOWS_FROM` (edges.cjs:81-98): enum-only succession edge. Use new -> prior with `{change_kind:'relocates'}`.
- Rejected: `SUPERSEDES` (the one supersession door), `PIVOTED` (reach-dial specific, edges.cjs:195-205), `ELEVATES_TO` (FUSION frame -> containing system, :526-540).
- The node props (`change_kind`, `predecessor_node_id`) are the source of truth; edges make the path navigable. An edge failure never fails the version write (Part 9 floor: bookkeeping never blocks), but it is reported in the result.
- Account = artifact handle (Part 8/9, locked AT4): `refinement_handle` is a room-relative path; the text never enters props or edge props.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic, symlink-safe artifact write | fs.writeFileSync into `.mindrian/frames` | room-path-containment.cjs `writeFileContained` | TOCTOU and symlink-leaf handling already solved (354-05) |
| Node writes | raw INSERT | typed-frame.cjs -> insertNode with `on_conflict:'nothing'` | Part 9 chokepoint, epistemic_type validation |
| Edge writes | raw INSERT into edges | navigation.writeEdge | Closed allowlist enforcement |
| Host detection / write permission | a new client-name check | claim-verify.cjs `hostBlock` + mcp-first-flag `isWritePathEnabled` | One detection path; Cowork probe already documented in the B1 runbook |
| Read-then-write serialization | ad hoc locks | BEGIN IMMEDIATE ownership idiom (verification.cjs:186-187) | Cowork concurrency; nests safely |
| Room resolution in the CLI | new resolver | the same resolution claim-checks.cjs uses | Consistency with B1 |
| Hashing | a new normalizer per caller | one `questionHash()` in frame-provenance.cjs, exported and reused by tests | Same-hash-no-change must hold everywhere |

**Key insight:** every hard part (containment, chokepoint, host gate, transactions) is already built; B2's real work is the change rule and honest rendering.

## Common Pitfalls

### Pitfall 1: History silently overwritten
**What goes wrong:** writing `governing-question:v2` twice overwrites origin and hash (proved this session). **Avoid:** `on_conflict:'nothing'` for role governing_question, version number computed inside BEGIN IMMEDIATE as max+1, and a test that a second write of an existing version leaves the row byte-identical.

### Pitfall 2: Missing origin passes as ok
**What goes wrong:** typed-frame.cjs:140 drops an invalid origin and returns ok. **Avoid:** for the governing_question role, refuse `invalid_origin`; keep the lenient behavior for FUSION frames so test-205 stays green.

### Pitfall 3: FUSION sees question versions as open frames
**What goes wrong:** readOpenFrames returns every frame (fusion-router.cjs:119). **Avoid:** exclude `frame_role === 'governing_question'` in readOpenFrames; run test-205-fusion-router.cjs as a regression leg.

### Pitfall 4: Order by accident
**What goes wrong:** readFrameProvenance has no ORDER BY; the substrate test relies on rowid order. **Avoid:** order by the stored `version` (then created_at) and return created_at as ISO.

### Pitfall 5: The question pollutes the A2 counts
**What goes wrong:** filing question/account via artifact_file mints claims (views.cjs:288-290) that the B1 portrait counts. **Avoid:** B2 writes its own artifacts through writeFileContained; add a test that a question change leaves `readVerificationPortrait` counts unchanged.

### Pitfall 6: Confusing "governing thought" with "governing question"
**What goes wrong:** /mos:room overview already prints "Governing Thought" from MINTO (commands/room.md:206-223). An officer sees two things with near-identical names. **Avoid:** label B2 strictly "Question" / "Governing question"; never render the MINTO line inside the question block.

### Pitfall 7: Larry fabricates the account
**What goes wrong:** on MCP the model can pass an account the officer never gave. **Avoid:** the tool description says the account must be the officer's own words; question_set response echoes the stored account so the officer sees it; record `set_by:'user'` only when the caller says a person gave it. Honest limit: not provable on MCP (Assumption A3).

### Pitfall 8: Silent relocate
**What goes wrong:** a missing choice defaulting to relocates lets a change land with no ask. **Avoid:** refuse; require explicit `relocate:true`.

### Pitfall 9: Cowork race
**What goes wrong:** two officers change the question; the second account answers a question that is no longer current. **Avoid:** optional `based_on_version` CAS returning `question_changed_meanwhile`.

### Pitfall 10: Not live until released
Same as B1: the runbook must include the release cut, Desktop MCP config re-pointed at the new plugin version, and live runs of AT1-AT4 on the demo machines.

### Pitfall 11: Runner blind to B2 plans
**What goes wrong:** run-all-358.sh's CIRS leg globs `358-0[1-6]-PLAN.md` (line 92) and the em-dash leg globs `test-358-b1-*.cjs` (line 135); B2 plans (358-07+) and tests would be skipped. **Avoid:** widen to `358-[0-9][0-9]-PLAN.md` and `test-358-b[12]-*.cjs`, add new non-test files to PHASE_358_SURFACES (line 115).

## Collision Map (question 6)

Sources: `git log -30 --name-only`, files_modified of every OPEN plan in 354/355/357/359/360/361 (a plan is OPEN when it has no SUMMARY.md), `git status --short`. 356 is complete (92aa8f624) and was not opened. Current dirty tree (peers): .planning/REQUIREMENTS.md, docs/reviews/*, evals/plurai/*, scripts/eval-icm-writers.cjs, tests/test-353-*, .planning/quick/260920-bhx-*: none overlap B2.

| File | Owner / overlap | B2 action |
|------|-----------------|-----------|
| lib/mcp/tools/sensors.cjs, lib/mcp/tool-router.cjs | 355-05 OPEN (also regenerates data/mcp-tool-connectors.json + data/connector-registry.json); 355-12 OPEN (tool-router) | DO NOT TOUCH; regenerate registries last and coordinate with the 355 session (jsagi-d9) if their regenerate is pending |
| lib/mcp/tools/gate.cjs, lib/core/navigation-engine.cjs | 355-22 OPEN; 354 shipped | DO NOT TOUCH |
| lib/mcp/runtime-instructions.cjs, data/harness-manifest.json, skills/larry-personality/SKILL.md, agents/larry-extended.md, scripts/session-start | 359-09, 359-11 OPEN; 357-10 OPEN | DO NOT TOUCH runtime-instructions or Larry prose. data/harness-manifest.json MUST be regenerated when connector-registry.json changes (358-05 lesson): coordinate order with 359 |
| scripts/intent-classifier.cjs, lib/core/session-binding.cjs | 360-07 OPEN | DO NOT TOUCH (so no CLI hook-based notice) |
| lib/core/brain-derivation*.cjs, lib/core/brain-md-staleness.cjs, lib/core/navigation-engine-offer.cjs, lib/core/memory/reconcile-memory-runner.cjs, lib/core/sensors/* | no open plan found | B2 does not need them; leave untouched |
| lib/core/navigation/reasoning-write.cjs | no open plan | not needed |
| lib/hmi/jtbd-state.cjs, lib/core/strategy/goal-gate.cjs | 345 shipped, single-caller invariant | DO NOT TOUCH for 6 Oct |
| lib/core/navigation/typed-frame.cjs | none (B2 substrate) | B2-owned |
| lib/core/navigation.cjs | no open plan edits it | additive re-exports only, commit --only |
| lib/mcp/tools/claim-verify.cjs, scripts/claim-checks.cjs, commands/room.md, skills/room/SKILL.md, tests/run-all-358.sh | Phase 358 (B1) | B2-owned now; 358-06 (open, runbook only) edits docs/2026-10-06-ROME-B1-GO-NO-GO.md, not these |
| lib/core/frame-provenance.cjs, scripts/room-question.cjs, lib/mcp/tools/question.cjs, tests/test-358-b2-* | do not exist (checked) | B2-owned, new |
| data/connector-coverage-ledger.json | 361 shipped regenerations | regenerated with the new tool file, last |
| tests/fixtures/tool-honesty/276-dispositions.json, tests/test-270-tool-schema-budget.cjs | shared measurement; 355-05 changes tool descriptions | re-measure / re-freeze in the final B2 regenerate plan, after 355-05 lands or with explicit coordination |

## Code Examples

### Hardened typed-frame write for the role (sketch)
```js
// lib/core/navigation/typed-frame.cjs, inside writeFrameNode
const isQuestion = params.frameRole === 'governing_question';
if (isQuestion && !(typeof origin === 'string' && FRAME_ORIGINS.has(origin))) {
  return { ok: false, reason: 'invalid_origin' };
}
if (isQuestion) {
  props.frame_role = 'governing_question';
  props.version = params.version;                 // integer >= 1, validated
  props.question_handle = params.questionHandle;  // room-relative path, validated shape
  if (changeKind === 'refines' && !(typeof refinementHandle === 'string' && refinementHandle)) {
    return { ok: false, reason: 'refines_needs_account_handle' };
  }
}
insertNode(db, nodeId, 'frame', propsJson, {
  source_path: sourcePath, created_by: 'system', epistemic_type: 'observation',
  on_conflict: isQuestion ? 'nothing' : undefined,
});
```

### Reader (sketch)
```js
"SELECT id, properties, review_status, created_at FROM nodes WHERE type = 'frame' "
+ "AND json_extract(properties,'$.frame_role') = 'governing_question' "
+ "ORDER BY json_extract(properties,'$.version') ASC, created_at ASC"
```

### MCP refusal (shape the test asserts)
```json
{ "ok": false, "reason": "change_needs_account",
  "ask": "What did the old question get wrong?",
  "previous": { "version": 1, "text": "Which camera solves the delay?", "origin": "tasking" },
  "proposed": { "text": "Which camera works with sunglasses?", "origin": "chosen" },
  "next": "Call question_set again with account (the officer's own words, files as refines) or relocate:true (a new question, files as relocates), or cancel:true.",
  "pending": true, "host": { "client_name": "claude-ai", "host": "claude-desktop", "write_path_enabled": true } }
```

## State of the Art (inside this repo)

| Old | Current | When | Impact |
|-----|---------|------|--------|
| Frame = FUSION composition only | Frame has provenance fields | 42191a6ae (2026-09-23) | Substrate exists, no caller, needs hardening |
| "Governing thought" = MINTO section summary | unchanged | Phase 88/90 | Must not be relabeled as the question |
| Goal record with parent_question slot | slot unused by the only writer | Phase 345 | Candidate for a later single-source reconciliation |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The paper author's four origins mean: chosen = the officer picked it; tasking = handed down by a superior; prompt = suggested by the tool/model from conversation; inherited = carried from earlier work or a parent room | Pattern 1 | Wrong labels on the slide demo; mitigated by one constant with a TODO(358) marker [ASSUMED] |
| A2 | `.mindrian/frames/` counts as "an artifact an officer can open" for AT2/AT4 when surfaced through the read tools | Architecture | Navigator may want a visible folder; then scanner/doctor impact must be planned [ASSUMED] |
| A3 | On MCP, an account passed by Larry reflects the officer's words | Pitfall 7 | A fabricated account would be filed as refines; not provable on MCP [ASSUMED] |
| A4 | test-270 stays within its 10% drift tolerance after two new tools (~2-3 KB on a 45,606-byte baseline) | Collision Map | If over, a deliberate re-baseline with navigator note, as 358-05 did [ASSUMED, measure] |
| A5 | Using REFINES frame-to-frame (documented claim-to-claim) needs no amendment because the edge type is already in the frozen set | Canon edges | If the navigator reads the D-150.8 scope as claim-only, use FOLLOWS_FROM for both with change_kind prop [ASSUMED] |
| A6 | The demo flow can route every question change through `/mos:room question set` or `question_set` | Q3 | If officers just type a new question to Larry, nothing is recorded and AT3 is not exercised [ASSUMED] |

## Open Questions (navigator rulings needed)

1. **Slide wording vs honest AT3 scope.** The door guarantees "the room asks what the old question got wrong before it records the new one". It cannot stop Larry answering a new question in chat without recording it. Recommendation: rule that AT3 passes when (a) the change door refuses without account/relocate on CLI and Desktop, (b) the pending ask is shown first by every B2 read surface, and (c) the demo script routes changes through the door; and adjust the fallback sentence to "...before it records the new question...". Otherwise "can I turn around" stays off.
2. **Confirm the governing question is a NEW explicit room-level record**, not the MINTO governing thought (which is an auto-generated per-section answer summary). Recommendation: yes.
3. **Origin definitions and whether origin is required on every change.** Recommendation: required on every version; labels provisional behind one constant with TODO(358) until the paper author confirms.
4. **Phase 345 `goal.parent_question`:** leave untouched for 6 Oct, and log a later reconciliation so the strategy card's taxonomy climb (strategy-card.cjs:303) reads the B2 question instead of an always-null slot. Recommendation: defer, record in the handoff.
5. **Where the question/account artifacts live:** `.mindrian/frames/` (recommended) vs a visible folder.
6. **chain_run pre-check (stretch):** add a pending-change halt to chain_run only if B2-01..B2-10 are green with time to spare.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 22.16 (node:sqlite `timeout`) | all B2 code/tests | yes | v22.23.1 | - |
| node:sqlite | room.db | yes (experimental warning only) | built-in | - |
| zod, @modelcontextprotocol/sdk | MCP tools | yes (existing deps) | per package.json | - |
| Claude Desktop demo machine | live AT runs | not verifiable here | - | runbook step on 6 Oct |
| Cowork client name | Cowork writes | unknown (B1 probe pending) | - | `MINDRIAN_MCP_FIRST=desktop,cowork` documented fallback |

**Missing with no fallback:** none for offline work. Live demo-machine checks are runbook items.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | plain node scripts with node:assert/strict and a pass/fail counter, aggregated by bash |
| Config file | none |
| Quick run command | `node tests/test-358-b2-core.cjs` |
| Full suite command | `bash tests/run-all-358.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| B2-01 | versions immutable, origin required for role, version/created_at/order in reader, FUSION excludes role, same-hash unchanged, normalization | unit (in-memory sqlite + tmp room) | `node tests/test-358-b2-core.cjs` | no, Wave 0 |
| B2-02 | refuse without account/relocate; refines files account artifact + handle; relocates; both-flags ambiguous; based_on_version race | unit | `node tests/test-358-b2-core.cjs` | no, Wave 0 |
| B2-03 | pending marker written on refusal, rendered first, cleared on set/cancel | unit | `node tests/test-358-b2-core.cjs` | no, Wave 0 |
| B2-04 | history render: equal weight, forbidden-words scan, account text shown for refines, out-of-band edit -> unresolved | unit | `node tests/test-358-b2-render.cjs` | no, Wave 0 |
| B2-05 | script subcommands, exit codes, options from constant; room.md subcommands + argument-hint; mirror in sync | CLI + static | `node tests/test-358-b2-cli.cjs` | no, Wave 0 |
| B2-06 | question_read/question_set schemas, descriptions >= 120 chars, Desktop `claude-ai` write, unknown host refused, refusal payload shape, connectors, real stdio wire leg | stub server + stdio | `node tests/test-358-b2-surfaces.cjs` | no, Wave 0 |
| B2-07 | REFINES / FOLLOWS_FROM edges with enum-only props; no SUPERSEDES, no 'superseded' | unit | `node tests/test-358-b2-core.cjs` | no, Wave 0 |
| B2-08 | three processes / three sessions: set, change (refines), change (relocates), reopen | cross-process | `node tests/test-358-b2-persistence.cjs` (helper tests/helpers/b2-358-child.cjs) | no, Wave 0 |
| B2-09 | scan node + edge properties for question/account text (none); static grep: no brain-client require in B2 files; A2 portrait counts unchanged by a question change | unit + static | `node tests/test-358-b2-part8.cjs` | no, Wave 0 |
| B2-10 | registries, sweeps, budget, CIRS, em-dash | gates | `bash tests/run-all-358.sh` | runner exists; B2 legs to add |

### run-all-358.sh changes (re-open once, deliberately, in the first B2 plan)
- Add `run_if` legs naming every B2 test file up front: b2-core, b2-render, b2-cli, b2-surfaces, b2-persistence, b2-part8.
- Add `run` legs: `node tests/test-b2-frame-provenance.cjs` (update it to the hardened contract in the core plan, since it relies on implicit order), `node tests/test-205-frame-node.cjs`, `node tests/test-205-fusion-router.cjs`, `node tests/test-348-one-supersession-door.cjs`, `node tests/test-276-tool-honesty-findings-closed.cjs` (already present).
- Widen the CIRS glob (line 92) to `358-[0-9][0-9]-PLAN.md` and the em-dash test glob (line 135) to `test-358-b[12]-*.cjs`; add new non-test files to PHASE_358_SURFACES (line 115).

### Sampling Rate
- Per task commit: that task's `tests/test-358-b2-*.cjs` plus `node tests/test-b2-frame-provenance.cjs`.
- Per wave merge: `bash tests/run-all-358.sh`.
- Phase gate: full runner green (B1 legs included) before verify-work; then the live runbook.

### Wave 0 Gaps
- [ ] tests/test-358-b2-core.cjs, tests/test-358-b2-render.cjs, tests/test-358-b2-part8.cjs
- [ ] tests/test-358-b2-cli.cjs
- [ ] tests/test-358-b2-surfaces.cjs, tests/test-358-b2-persistence.cjs, tests/helpers/b2-358-child.cjs
- [ ] run-all-358.sh B2 legs and widened globs

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | local single-user tool |
| V3 Session Management | no | - |
| V4 Access Control | yes | `isWritePathEnabled` host gate on question_set (same as claim_verify); reads unconditional |
| V5 Input Validation | yes | zod schemas (text 1..1000, account 0..4000, origin enum, relocate/cancel boolean, based_on_version int); core re-validates |
| V6 Cryptography | no (sha256 used as a content fingerprint, not a secret) | node:crypto |
| V12 Files | yes | fixed filenames generated from version + hash prefix, never from user input; writeFileContained + assertRealpathContained |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Question/account prose leaking toward the Brain | Information disclosure | prose only in artifacts; props/edges enum+handle; no brain-client import (static test); Part 8 scan test |
| Path traversal / symlink via artifact write | Tampering | generated filenames; containment helpers |
| History rewrite | Tampering / Repudiation | on_conflict 'nothing'; artifacts written once; test for byte-identical re-write |
| Fabricated account by the model | Repudiation | account echoed back; `set_by` recorded; documented limit |
| Lost update between Cowork officers | Tampering | BEGIN IMMEDIATE + based_on_version |
| Unknown host writing | Elevation | anchored host-tier map from B1; refusal with hint |

## Suggested plan decomposition (planner input, fits 6 Oct)

| Plan | Wave | Scope | Requirements |
|------|------|-------|--------------|
| 358-07 | 1 | typed-frame hardening + lib/core/frame-provenance.cjs + navigation re-exports + update test-b2-frame-provenance + b2-core/render/part8 tests + re-open run-all-358.sh | B2-01, B2-02, B2-03, B2-04, B2-07, B2-09 |
| 358-08 | 2 (parallel) | scripts/room-question.cjs + /mos:room question subcommands + skill mirror + b2-cli test | B2-05 |
| 358-09 | 2 (parallel) | lib/mcp/tools/question.cjs + b2-surfaces + b2-persistence + child helper | B2-06, B2-08 |
| 358-10 | 3 | regenerate registries + harness manifest, re-freeze 276, measure/re-baseline 270, runner green (coordinate with 355-05 and 359 regenerates) | B2-10 |
| 358-11 | 4 | B2 section of the 6 Oct runbook: live AT1-AT4 on CLI/Desktop/Cowork, covered/not-covered answer-path table verbatim, slide wording per the Open Question 1 ruling; human checkpoint | B2-10 |

Also, per CLAUDE.md dev-research compositing: file this research trail in rethinking-mindrianos at close-out (optional for B2, since it is user-facing feature work, but the frame-substrate finding is architectural).

## Sources

### Primary (HIGH confidence, read or executed this session)
- lib/core/navigation/typed-frame.cjs (full), lib/core/navigation.cjs:440-500, lib/core/node-insert.cjs:200-265, lib/core/navigation/edges.cjs (allowlist + comments), lib/core/fusion-router.cjs:100-135
- scripts/vault-section-minto-generator.cjs:394-470, :580-800; lib/core/folder-memory-shared.cjs:410-460; lib/core/brain-derivation.cjs:88-160; brain-derivation-queue.cjs; brain-md-staleness.cjs:292-302; navigation-engine-offer.cjs; lib/memory/feynman-prompts.cjs:113-143; scripts/on-stop:365-368; scripts/post-write:193-203
- lib/hmi/jtbd-state.cjs, lib/core/strategy/goal-gate.cjs, lib/core/strategy/strategy-card.cjs:280-310
- lib/mcp/tools/*.cjs (tool map), lib/mcp/tools/views.cjs:175-330, lib/mcp/tools/claim-verify.cjs, lib/mcp/tools/context.cjs, lib/mcp/runtime-instructions.cjs (measured 1984 bytes), tests/test-298-contract-parity.cjs, lib/mcp/no-instructions.test.cjs, hooks/hooks.json
- tests/run-all-358.sh, tests/test-b2-frame-provenance.cjs (run: PASS), tests/test-205-frame-node.cjs (run), tests/test-270-tool-schema-budget.cjs, tests/fixtures/tool-honesty/276-dispositions.json, tests/test-348-one-supersession-door.cjs
- Probe script (scratchpad) proving overwrite-on-rewrite, silent origin drop, FUSION mixing
- 358-CONTEXT.md, 358-RESEARCH.md, 358-01..05-SUMMARY.md, 358-06-PLAN.md; every OPEN 354/355/357/359/360/361 PLAN.md frontmatter
- docs/2026-09-23-B1-B2-IMPLEMENTATION-RESEARCH.md; docs/FRAME-PROVENANCE-PRODUCT-WORKUP.md (peer-untracked, read only)

### Secondary (MEDIUM)
- https://mindrian-explainer-gate.vercel.app/nato.html (fetched): A1 claims, four origins named without definitions, B2 fallback sentence "When the governing question changes, the room asks what the old question got wrong before it shows a new answer, and keeps both questions on the record.", go/no-go rule "No partial credit".

### Tertiary (LOW)
- none

## Metadata

**Confidence breakdown:**
- Current state / write-path enumeration: HIGH, all from source with line numbers and a live probe
- Pause design and coverage table: MEDIUM, sound and testable, but the slide claim needs a navigator ruling
- Collision map: HIGH as of 2026-09-23 HEAD dc0172322; peers move fast, re-check `git status` and open plans at execution time
- Validation: HIGH, mirrors the B1 harness that is green today

**Research date:** 2026-09-23
**Valid until:** 2026-10-06 (go/no-go), re-check the collision map daily
