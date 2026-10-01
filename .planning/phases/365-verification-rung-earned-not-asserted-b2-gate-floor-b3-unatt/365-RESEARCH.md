# Phase 365: Verification rung earned not asserted - Research

**Researched:** 2026-10-01
**Domain:** truth-state gating at the human gate (B2), add-only halts for unattended steps (B3), pulled rung portrait and per-claim rung words (B5), baseline-first test harness
**Confidence:** HIGH for code seams and call sites (read directly this session); MEDIUM for the falsification-test encodings and the renderer enumeration; LOW only where flagged [ASSUMED]

## Summary

Every seam the locked decisions name exists and was read this session. The floor check belongs in `lib/mcp/tools/gate.cjs` `_promoteCardSubject` (lines 73-121), which today promotes a `proposed` claim or opportunity subject through `navigation.confirmNode` on every kind-`general` approve. The never-do check belongs in `lib/core/chain-executor.cjs` `makeGateFn` (line 805), right after the `isIrreversibleStep(step)` line that must stay first. In ambient research it belongs in `lib/core/research-planner/ambient.cjs` `maybeQuickInner`, before `grants.recordRun` (line 351), which is the last statement before any fetch. The portrait already has one render home (`verification.cjs` `renderPortraitLines`), and the room-proactive signal source is `lib/core/proactive-intelligence.cjs` `persistIntelligence` (run by `intelligence-cascade.cjs` Step 10 after every filing). No new npm package, no new MCP tool, no new command and no new node type is needed.

Five findings change how the plan should be shaped. (1) Claim-subject gate cards are minted in TWO places: the `gate_render` handler, and the `meeting` tool's `file-meeting` path (`lib/mcp/tool-router.cjs:1707-1728`), which calls `gateRender.renderGate` directly. A why-line composed only in the `gate_render` handler would never appear on meeting cards, which are the main live path for claim approval. The why-line composer must be one shared helper that both call. (2) `gate-render.cjs` `normalizeCard` drops every field it does not know (lines 150-190), so "carried in the card data" needs one additive normalized field (a `notice` string) that each of the three renderers prints. (3) With the floor ON by default, and with scratch fixture rooms having no ROOM.md, at least four existing suites that pin "approve -> confirmed" on a claim subject will turn red the moment B2 lands. The B2 plan has to update them. (4) The gate ledger is in memory, one per server process (`gate-ledger.cjs:28`). An ambient constraint halt runs in a detached child process, so its "Shape F card" cannot be minted there. It has to be written as a pending card (the same pattern as ambient's `recordPlanOnly`) and rendered through `gate_render` at the next research touchpoint. (5) `irreversibility-ledger.cjs` fails OPEN on a malformed file and caches per process. The never-do reader must do the opposite: fail SHUT on a malformed file (D-13) and read fresh on every run, because the file is room-local and hand-editable.

On D-08, I recommend an additive `needs_evidence->confirmed` transition, not "re-approve with evidence = validated". D-04 names "lower the floor" as a way out for a held claim, and under the Phase 108 truth-state contract `validated` means "evidence attached". A held claim released by lowering the floor has no legal target except a new transition. Using it for both routes also keeps every confirmed-only reader (for example `lib/core/unknowns/corpus-adapter.cjs:171`) seeing released claims.

**Primary recommendation:** Build a single pre-ratification "standing" reader in `lib/core/navigation/verification.cjs`: `source_edge` / `model_only` / `none`, derived from the claim's outbound edges and its records. Floor, why-line, portrait, the two signals and B5 all read it. The edge-derived rung later replaces this one function. Order the phase as a written-once `tests/run-all-365.sh` plus a baseline-red list first, then B2, then B3 (in parallel with B2, since the files do not overlap), then portrait/B5. Fence derivation, B1a, B4 and the record migration into a follow-on phase (365.1) behind a ladder-ratification file and a fence test.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Approval floor (B2)
- **D-01:** The floor is ON by default in every room (existing and new). Rationale: an off-by-default floor leaves the byte and one-week tests failing in every existing room.
- **D-02:** The floor is stored in the room-root ROOM.md frontmatter as a rung ID, never a number (e.g. `verification_floor: secondary_document`), because the provisional 1-5 constant (verification.cjs `TODO(358)`) will be renumbered to the 0-5 draft. Add `verification_floor` to the ROOM.md optional keys in lib/core/frontmatter-schemas.cjs; read it with a small head-read modelled on ambient-framing.cjs `readPwsStageHead`.
- **D-03:** Until the edge-derived rung ships, the default floor predicate is: the claim has at least one outbound edge to a node carrying both `url` and `retrieved_at`.
- **D-04:** A below-floor approve lands at `needs_evidence` (existing enum; `proposed -> needs_evidence` is already a legal transition in lib/core/navigation/transitions.cjs). NO "confirm anyway" option on the card. The only routes out: add evidence and approve again, or lower the floor in ROOM.md (a visible file-level act).
- **D-05:** The gate card states WHY before the click, in plain words, e.g. "Checked against: nothing outside the conversation yet. This room asks for at least a source document, so approving files it as needs evidence." The approve option is relabelled for below-floor subjects ("Approve, mark as needs evidence"). The line is composed in the gate_render tool handler (which can open the room db) and carried in the card data, so all three renderers (elicitation, AskUserQuestion, headless text) show it on CLI, Desktop and Cowork. gate-render.cjs stays a pure normalizer.
- **D-06:** The floor check lives in lib/mcp/tools/gate.cjs `_promoteCardSubject` (or a new sibling helper in confirm-node.cjs), NOT inside `confirmNode`, which selector-decisions.cjs, lens-engine.cjs, qualify-opportunity.cjs and room-birth.cjs also call and which must stay unchanged.
- **D-07:** Every approve records the floor and the rung in force at that moment (a memory_event through navigation.cjs), so a later hand edit that lowers the floor leaves a trace.
- **D-08 (planner decides, flag it):** A held claim can currently only move `needs_evidence -> validated`; there is no `needs_evidence -> confirmed`. Either accept "re-approve with evidence = validated" or make an additive TRANSITIONS extension. Additive only, closed enums still fail shut.

#### "Never do this" list (B3)
- **D-09:** A structured list at `.mindrian/never-do.json` (schema `mos.room-constraints/1`). Each entry: a closed-enum `kind` in {command, section, path, provider, term}; a literal `value`; a plain-sentence `why` that is SHOWN on the card and NEVER matched; `approved_via {surface, decision_node_id}`.
- **D-10:** Writer: Larry proposes, and an entry lands only when the navigator approves a gate card. Copy the grants.writeGrant rule (refuse to write without an approval trail).
- **D-11:** Matching is exact string or whole-segment path-prefix comparison against fields steps already declare (chain-step-dispatcher `produces` / `target_section`, `step.command`, ambient `plan.return_target.section`, `PROVIDER` / `leaf.corpus`, grant `approved_terms`). No model judges a match.
- **D-12:** On a match: HALT with a Shape F gate card through gate-ledger (Canon Part 3), and append a line to `.mindrian/constraint-trips.jsonl`. The check is add-only and can only force a halt, never clear one. In chain-executor.cjs `makeGateFn` it sits right after `isIrreversibleStep` (which must stay first). In ambient.cjs it runs before `grants.recordRun`, i.e. before any network request, with a new `halted_constraint` outcome added to AMBIENT_OUTCOMES.
- **D-13:** Fail shut: a malformed file halts every unattended step; a missing file is an empty list.
- **D-14:** Growth: every unattended halt, and every Reject on a material-step card, offers "Reject and never do this", pre-filling a proposed entry from the step's declared fields (still lands only on approval).
- **D-15:** Presented as a FLOOR, never as solved: every user-facing surface that mentions the list says it catches only what has been named.

#### Rung portrait and rendered surfaces (B5)
- **D-16:** The full portrait is PULLED, never pushed: shown on request only (`/mos:status --checks` and the existing claim_verify portrait mode), as counts in words, each row naming what would move it (e.g. "reached a located primary source: 41 / checked only by asking a model: 207 / not checked yet: 92"). No percentages, badges, colors or scores (Canon Part 12; the spec forbids scores).
- **D-17:** Exactly two unsolicited signals, as Zone 3 Intelligence Strip entries: (1) a claim a decision rests on sits at "asked a model", shown with the check that would close it; (2) the weekly distribution stayed flat for N weeks while checks kept being recorded ("checks in the last N weeks moved no claim past asking a model"). The stall signal is suppressed until at least 2 weekly snapshots exist.
- **D-18:** A local, append-only weekly snapshot record of the distribution feeds the stall signal (room-local, Canon Part 9; never leaves the machine, Part 8).
- **D-19:** B5: every per-claim render (wiki, dashboard, exports, gate card) names the rung in words from ONE shared label map in lib/core/navigation/verification.cjs (renderPortraitLines is already "the ONE place these render strings are written"). Keep its closing line "A count is not a verdict. Only a person confirms a claim." Final wording is frozen only after ladder ratification; build the map with provisional labels behind that block.

### Claude's Discretion
- The stall threshold N (default suggestion: 4 weeks), recorded as a disclosed floor in data/floor-ledger.json per the repo's floor-ledger rule.
- Exact card copy, within D-05 and the no-em-dash rule.

### Carried forward (not re-asked)
- Frame provenance (origin chosen/tasking/prompt/inherited; refines vs relocates) shipped in Phase 358; this phase does not touch it except to note the open check below.
- The single write chokepoint, proposed-by-default truth claims, the narrow bookkeeping carve-out and fail-shut closed enums are guardrails: do not "improve" them.

### Deferred Ideas (OUT OF SCOPE)
- Edge-derived rung (B1 derivation), person node (B1a), B4 split of the unsupported scan: BLOCKED on the paper author ratifying the ladder. Also blocked: migrating existing Phase 358 records from the provisional 1-5 constant to the ratified ladder.
- Open check from Phase 358 (not in this phase's build): does the frame-provenance "what did the old question get wrong" ask fire BEFORE the new answer is shown? Verify and, if not, raise as its own quick task or phase.
- The paper author's discipline-control experiment (Mindrian vs a disciplined person with a chat window and notebook): needs the derived rung; a research activity, not a build item.
</user_constraints>

<phase_requirements>
## Phase Requirements (proposed; the planner mints them into .planning/REQUIREMENTS.md)

No 365 IDs exist yet. Below is a proposed `V365-xx` set, following the "minted at plan time" precedent (Phase 270 MEMOP, Phase 363 DRP363).

| ID | Description | Research Support |
|----|-------------|------------------|
| V365-01 | Failing baseline recorded BEFORE any code change: the base sha, and for each of the 3 acceptance tests and the automatable falsification tests the observed outcome and a stable failure signature, in `tests/fixtures/365-pre-phase.json` and `tests/fixtures/365-baseline-red.json`, plus a written-once `tests/run-all-365.sh`. | Harness pattern (Pattern 1); run_known and BASELINE_RED precedents |
| V365-02 | Byte test, structural half: two claims with identical text, one with an outbound edge to a node carrying `url` + `retrieved_at` and one checked only by asking a model, differ in a filterable field that the architecture computed (not a caller-declared rung). The derived-rung half (rung 4 vs rung 2) is fenced to the gated wave. | Standing reader (Pattern 2); verification.cjs `listClaimsForChecking` returns identical rows today |
| V365-03 | One-week test, B2 half: a model-checked claim approved at the default floor never reaches `confirmed`. A fresh process asking the room later gets back what it was checked against and its standing in words. | Floor gate (Pattern 3); claim_read |
| V365-04 | Floor test: a floor set in ROOM.md; a below-floor approve lands `needs_evidence`, and the why-line and relabelled approve option appear on all three renderer rungs BEFORE the answer. | Why-line (Pattern 4); normalizeCard gap |
| V365-05 | Floor configuration: `verification_floor` added to ROOM.md optional keys; a head-read of the room-root ROOM.md frontmatter only; absent key = default floor (no migration); an unknown value fails shut to the default floor and is reported. | frontmatter-schemas.cjs lines 138-201; ambient-framing.cjs readPwsStageHead |
| V365-06 | Floor enforcement in `_promoteCardSubject` for `claim` subjects: below floor -> `proposed->needs_evidence`; re-approve at or above floor releases the claim per the D-08 resolution; `confirmNode` byte-unchanged. | gate.cjs 73-121; transitions.cjs |
| V365-07 | One shared server-side why-line composer called by every claim-subject card builder (the gate_render handler and meeting file-meeting), carried as an additive normalized `notice` field and printed by the elicitation, AskUserQuestion and text rungs. | tool-router.cjs:1707-1728; gate-render.cjs 150-190, 274-432 |
| V365-08 | Every claim-subject approve writes one floor-audit memory_event (floor id, floor source, standing, landed status, declared max rung), enum and scalar only. | memory-events.cjs EVENT_TYPES closed set |
| V365-09 | `.mindrian/never-do.json` reader and pure matcher: schema `mos.room-constraints/1`, closed `kind` enum, literal `value`, exact or whole-segment path-prefix match; missing = empty list; malformed = halt every unattended step. | irreversibility-ledger.cjs contrast (Pitfall 5) |
| V365-10 | Never-do writer refuses without `approved_via {surface, decision_node_id}` (the writeGrant rule); the only production caller is gate_answer approve on a constraint-proposal card, after the decision node is minted. | grants.cjs 129-176; planner.cjs 561-592 |
| V365-11 | chain_run enforcement: the check in `makeGateFn` right after `isIrreversibleStep`; a named halt reason and the matched entry on `haltedAt`; the halt card shows the entry's `why` and the "catches only what has been named" line; one line appended to `.mindrian/constraint-trips.jsonl`. | chain-executor.cjs 805-863, 1111-1117, 1566-1571; chain.cjs 218-233, 497 |
| V365-12 | Ambient enforcement: the check after the plan is built and before `grants.recordRun`; a new `halted_constraint` outcome; a trip line; a pending card for the next research touchpoint; zero egress on a match or on a malformed file. | ambient.cjs 285-376 |
| V365-13 | Growth: every constraint or material-step Reject response carries a pre-filled never-do proposal built from the step's declared fields; nothing lands until a separate approve. | chain.cjs verdict identity mapping (Pitfall 7) |
| V365-14 | Pulled portrait: `/mos:status --checks` (CLI) and claim_read's portrait (Desktop/Cowork) print standing rows in words, each naming what would move it, plus the never-do floor sentence; no scores, percents or ratios. | mos-status.cjs parseArgs 89-100; test-358-b1-portrait no-score guard |
| V365-15 | Two Zone 3 signals as proactive-intelligence insights (decision rests on a model-only claim; checks stalled for N weeks), each carrying its fix; a weekly append-only snapshot; the stall signal suppressed below 2 snapshots; N recorded in data/floor-ledger.json. | proactive-intelligence.cjs 129-341; floor ledger rules |
| V365-16 | B5: one shared standing-words map in verification.cjs; every enumerated per-claim renderer names the standing from it; held (`needs_evidence`) claims visible where confirmed facts are rendered. | Renderer enumeration (B5 table) |
| V365-17 | Ladder fence: derivation, B1a, B4 and the record migration are not built; a fence test fails if they land while the ladder is unratified. | Pattern 6 |
| V365-18 | Guardrails: Part 8 source sweep on every new file, dash fence, `build-connector-registry --check`, `check-shape-declaration`, `check-floor-ledger --check`, tool-schema budget, and the regression suites 358/354/355/356/363 no redder than at base. | Validation Architecture |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- All dev work runs through GSD (`/gsd-execute-phase` for this phase); no direct edits outside a GSD workflow.
- Work only in `/home/jsagi/dev/MindrianOS-Plugin/`. Read the version with `node lib/core/repo-version.cjs`, never a tree search.
- CJS only, no TypeScript, no Commander/yargs (switch-case argv routers).
- No em-dashes anywhere (code, tests, docs, card copy); hyphens only. The house tests search for U+2014 and U+2013 only as escapes.
- Canon Part 3: material choices render through Shape F; the frozen scalars (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15) are untouched. MAX_K bounds only a ranked 1-of-N candidate set.
- Canon Part 8: no room content crosses to the Brain; every new file passes the Part 8 source sweep; memory_event payloads carry enums and scalars only.
- Canon Part 9: room.db is reached only through `lib/core/navigation.cjs`; only a human confirms a truth claim (`AGENT_IDENTITIES` guard); memory_event and typed edges are written only through the chokepoint.
- Canon Part 11: every invocable surface is born WIRED or EXCLUDED with a declared HITL shape; run `node scripts/build-connector-registry.cjs --check` and `scripts/check-shape-declaration.cjs` after any connector or frontmatter change.
- Canon Part 12: no grades, scores, badges or praise; the portrait is counts in words.
- Tri-Polar: every feature works on CLI, Desktop and Cowork, or the skip is a stated call.
- Reuse before build (Part 7): search commands/agents/pipelines/skills first; justify any new surface.
- Verification: `bash tests/run-all-<phase>.sh`; `node scripts/doctor.cjs --acceptance`; render gates `node scripts/check-render-coverage.cjs`.
- A `main` commit is not live until `scripts/release.sh` cuts a version (never bump versions by hand).
- Dev-research compositing: this phase touches MindrianOS's own architecture, so the research trail is filed in both the phase dir and `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>/`, mirrored to `mindrianOS/research/`. The planner should include a close-out task for this.
- No real names of the paper author or the reviewer in any tracked file (roles only).
- `.planning/` files are force-tracked: new phase-dir files need `git add -f` (user memory, verified pattern).
- Two-session collision rule (user memory): commit with `--only` or explicit paths; never revert diffs you do not own; no `state.*` writes while a peer executes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Standing reader (what a claim was checked against, derived from edges and records) | Database / Storage (room.db via `lib/core/navigation/verification.cjs`) | - | Reads nodes/edges; must sit inside the Part 9 chokepoint directory |
| Floor configuration read | Room filesystem (room-root ROOM.md) | - | Human-visible standing rule; the filesystem is the source of truth |
| Floor enforcement at approve | API / Backend (MCP `gate_answer` in `lib/mcp/tools/gate.cjs`) | Database (transitions via navigation.cjs) | The approve verdict arrives here; the truth-state write goes through the chokepoint |
| Why-line composition | API / Backend (card builders: `gate_render` handler, meeting file-meeting) | - | Needs the room db; must run before render |
| Why-line rendering on three rungs | MCP card normalizer and renderers (`lib/mcp/gate-render.cjs`) | Host client (elicitation / AskUserQuestion / text) | Pure normalization and render; no db |
| Never-do read and match | Core library (`lib/core/never-do.cjs`, new) | Room filesystem (`.mindrian/never-do.json`) | Pure function over declared step fields |
| Never-do enforcement | Core runners (`chain-executor.cjs` makeGateFn, `research-planner/ambient.cjs`) | MCP (`chain.cjs` halt card) | The halt must happen where the unattended step would run |
| Never-do write | MCP `gate_answer` approve branch | Core writer (approval-trail rule) | Only a human approval lands an entry |
| Portrait (pulled) | CLI script (`scripts/mos-status.cjs --checks`) + MCP `claim_read` | Core reader | One render home, two surfaces |
| Zone 3 signals | Core (`proactive-intelligence.cjs` persistIntelligence) | Hooks (intent-classifier top-3 injection) | Existing room-proactive signal source |
| Weekly snapshot | Database (room.db memory_event, recommended) | - | Part 9: SQL is the local mind; append-only by nature |

## Standard Stack

### Core (all already in the repo; nothing new to install)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:sqlite` DatabaseSync | Node v22.23.1 on this machine; floor >=22.16.0 [VERIFIED: `node --version`] | room.db reads and writes through navigation.cjs | Repo standard; `timeout` works at >=22.16 (CLAUDE.md) |
| `zod` | ^3.25.76 (repo pin) [VERIFIED: CLAUDE.md stack table] | gate_render input schema for the new optional fields | Already the MCP tool schema layer |
| `@modelcontextprotocol/sdk` | ^1.29.0 (repo pin) | Tool registration (unchanged) | Existing server |
| `node:fs` / `node:path` | built-in | never-do.json atomic write, trips jsonl append, ROOM.md head-read | House pattern (`atomicWriteJson` in ambient.cjs 84-89) |

### Supporting (in-repo modules to reuse)
| Module | Purpose | When to Use |
|---------|---------|-------------|
| `tests/helpers/fixture-room-354.cjs` (`makeScratchRoom`, `captureToolServer`) | Drive `gate_render` / `gate_answer` / `meeting` / `claim_read` handlers in-process | Acceptance tests 2 and 3, floor gate tests |
| `tests/helpers/fixture-room-363.cjs` + `openalex-replay-363.cjs` | Ambient research room + offline replay | Ambient never-do tests |
| `tests/helpers/hygiene-355.cjs` (`installNetGuard`, `scrubVendorKey`) | Zero-network guard | Every 365 test |
| `tests/eureka-offline-preload.cjs` | Offline preload via NODE_OPTIONS | The aggregator |
| `lib/core/research-planner/planner.cjs` `queuePendingCard` / `pendingCards` | Queue an ambient constraint-halt card | V365-12 |
| `lib/core/navigation.cjs` `logMemoryEvent`, `writeEdge`, `confirmNode`, `resolveByUser` | Floor audit event, transitions | B2 |
| `scripts/check-floor-ledger.cjs --check` | Validate the new stall-weeks row | V365-15 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| room.db memory_event for weekly snapshots | `.mindrian/rung-snapshots.jsonl` | jsonl matches `constraint-trips.jsonl`, but Part 9 names room.db as the local mind and memory_event is already the append-only log. Recommend memory_event (event type `verification_distribution_snapshot`), with the one-per-ISO-week check done by a query, since logEvent's dedupe window is only 60 s. |
| A new MCP tool for never-do proposals | An optional `proposed_constraint` field on existing `gate_render` | A new tool means a new born-wired surface, a HITL declaration and tool-schema budget growth. Reusing the gate keeps one governed path (Part 11). |
| Folding the why-line into `header` | An additive normalized `notice` field | Folding into header needs no gate-render.cjs change, but `gate_answer` derives the decision node's text from `live.card.header` (gate.cjs 386-387), so the why-line would leak into the decision record. Use `notice`. |

**Installation:** none. No package is added.

## Package Legitimacy Audit

No external packages are installed by this phase. Step 2.6 dependency probe: node v22.23.1 and python3 3.12.3 are present (python3 is needed only because `scripts/analyze-room`, which falsification test 5 drives, embeds Python).

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                 B2: approval floor
 Larry / meeting tool --(card with claim subject)--> card builder
        |                                               |
        |                        room-root ROOM.md --> readFloor() ----+
        |                        room.db edges/records --> standing() -+--> composeFloorNotice()
        |                                                               |    (why-line + approve relabel)
        v                                                               v
  gate_render handler / meeting file-meeting --> normalizeCard(+notice) --> rung a/b/c renderer --> navigator
                                                                                     |
                                                        gate_answer {approve} <------+
                                                               |
                          decision node write (unchanged) -----+
                                                               v
                                   _promoteCardSubject: type claim?
                                     |-- floor met    --> confirmNode (proposed|needs_evidence -> confirmed)
                                     |-- floor not met --> hold helper (proposed -> needs_evidence) or stay held
                                     +-- always       --> logMemoryEvent('approval_floor_checked', scalars)

                 B3: never-do list (add-only halt)
 .mindrian/never-do.json --> readNeverDo(roomDir): missing=[] | malformed=HALT_ALL | entries
        |
        +--> chain_run: runChain(opts.roomDir) --> makeGateFn: isIrreversibleStep FIRST
        |        --> constraint match or HALT_ALL? --> 'halt' (reason constraint_named)
        |        --> chain.cjs halt card (why + "catches only what has been named") --> gate-ledger mint
        |        --> append .mindrian/constraint-trips.jsonl
        |
        +--> ambient child: maybeQuickInner: plan built --> match(command, section, provider, term)?
                 --> outcome halted_constraint, trips line, pending card (NO recordRun, NO fetch)
                 --> next research touchpoint --> gate_render (live session) --> navigator
 Reject (any material or constraint card) --> response carries pre-filled never-do proposal
        --> Larry renders gate_render {proposed_constraint} --> gate_answer approve
        --> decision node minted --> writeNeverDo(entry, approved_via{surface, decision_node_id})

                 Portrait / signals / B5
 standing() per claim --> portrait counts (pulled: /mos:status --checks, claim_read)
                      --> persistIntelligence: 2 signals + weekly snapshot --> .proactive-intelligence.json --> Zone 3
                      --> STANDING_WORDS map --> claim views, gate card, graph-export rows, room-home facts
```

### Recommended Project Structure (new and touched files)
```
lib/core/navigation/verification.cjs   # + claimStanding(), STANDING_WORDS, floor ids, portrait-by-standing, signals reader
lib/core/navigation/verification-floor.cjs (optional split)  # readFloor(roomDir), composeFloorNotice(db, roomDir, subjectId)
lib/core/navigation/confirm-node.cjs   # + holdForEvidence(db, id, byUser, reason) sibling (confirmNode untouched)
lib/core/navigation/transitions.cjs    # + 'needs_evidence->confirmed' (if D-08 option B)
lib/core/navigation/memory-events.cjs  # + EVENT_TYPES: approval_floor_checked, verification_distribution_snapshot
lib/core/navigation.cjs                # re-export the new verification helpers
lib/core/frontmatter-schemas.cjs       # + 'verification_floor' in ROOM.md optional keys
lib/core/never-do.cjs                  # NEW: read/match/write/recordTrip/proposalFromStep
lib/core/chain-executor.cjs            # makeGateFn({roomDir|constraints}); haltedAt reason in both loop paths
lib/core/research-planner/ambient.cjs  # constraint check + 'halted_constraint'
lib/mcp/gate-render.cjs                # normalizeCard: + notice, + proposedConstraint; renderers print notice
lib/mcp/tools/gate.cjs                 # _promoteCardSubject floor; gate_render notice + proposed_constraint; never-do write
lib/mcp/tools/chain.cjs                # halt card carries constraint why; reject -> never_do_proposal
lib/mcp/tool-router.cjs                # meeting file-meeting card gets the same notice; contract text updated
lib/mcp/tools/claim-verify.cjs         # descriptions; portrait rows
lib/core/proactive-intelligence.cjs    # merge the two signals; snapshot
scripts/mos-status.cjs                 # --checks
commands/status.md                     # argument-hint + Arguments section (do NOT edit `teaching`)
data/floor-ledger.json                 # + stall-weeks row
tests/run-all-365.sh, tests/test-365-*.cjs, tests/fixtures/365-*.json, tests/helpers/fixture-room-365.cjs
```

### Pattern 1: Baseline-first harness (written once, reds listed in data)
**What:** `tests/run-all-365.sh` is written in the first plan and never edited again, in the style of run-all-363 ("NO LATER PLAN in this phase edits it"). It uses the house helpers `run`, `run_if <label> <guard-file> <cmd>`, and `run_known <label> <signature> <cmd>`, and discovers `tests/test-365-*.cjs`. The red set lives in `tests/fixtures/365-baseline-red.json` (`[{leg, signature, healed_by_plan}]`), not in the script. A listed leg that fails with its signature counts KNOWN. A listed leg that PASSES counts FAIL with "NOW GREEN: remove from 365-baseline-red.json", which is the run-all-363.1 BASELINE_RED rule. So the plan that heals a leg must remove it from the data file in the same commit, and a red can never go stale silently.
**Why data and not script:** run_known alone reports a healed red as PASSED and a re-broken red as KNOWN. That hides a regression after the implementing plan has landed. The 363.1 BASELINE_RED rule closes that hole, and moving the list into JSON keeps the aggregator written once.
**Signatures:** each acceptance test prints one stable line when it fails, for example `RED-365-BYTE: identical text claims are indistinguishable by any computed field`, `RED-365-ONEWEEK: model-checked claim reached confirmed`, `RED-365-FLOOR: below-floor approve landed confirmed` / `RED-365-FLOOR-NOTICE: why-line absent on rung <a|b|c>`. The first plan runs each against the base sha and records sha + signature + observed values in `tests/fixtures/365-pre-phase.json`.

**Which baseline tests are automatable offline:**

| Test | Automatable? | How | Expected at base |
|------|-------------|-----|------------------|
| Acceptance 1 byte | Yes | In-process room (`makeScratchRoom`); two identical-text claims; A gets an outbound SOURCED_FROM to an EvidenceClaim (`url`, `retrieved_at` non-empty) and a `method:'read'` record; B gets a `method:'ask'` record and no edge. Both get the SAME declared rung, so the declared field cannot be what separates them. Compare `listClaimsForChecking` rows minus `claim_id`. | RED: rows equal (`review_status`, `checking_status`, `records_total` match) |
| Acceptance 2 one-week | Yes | `captureToolServer` + `meeting file-meeting` (or gate_render with subject) -> `gate_answer approve`; then a SPAWNED second node process (fresh module state stands in for "a week later") calls `claim_read`. | RED: review_status `confirmed`; claim_read says nothing about standing |
| Acceptance 3 floor | Yes | ROOM.md `verification_floor: secondary_document`; claim with only an ask record; `gate_render` driven three times with capabilities `{elicitation:true}` (stub `elicitInput` capturing `message`), `{claudeCode:true}`, `{}`; then `gate_answer approve`. | RED: no notice in any rendered payload; lands `confirmed` |
| Falsify 1 two navigators | No | Needs two humans and live model sessions. Record the protocol in `365-BASELINE.md` as MANUAL / NOT RUN, out of scope for automation. | n/a |
| Falsify 2 remove destination | Partly | Characterize `suggest_next` (sensors.cjs -> `dispatchSensors` -> hedge ranker, read-only handle) on a fixture room with and without MINTO `governing_thought` + active JTBD; compare top reach and any score field. The planner must first confirm which field is the "confidence" (none is named in dispatchSensors' return; MEDIUM). If no confidence is emitted, record that as the finding. | Characterization, not red/green |
| Falsify 3 missing five | Yes | Seven-item continuous set, claims filed for 1-4 and 6-7; run `findUnsupportedClaims`, `research-preflight` evidence_gaps, and `scripts/analyze-room` gap lines; assert nothing names item 5. | Predicted FALSIFIED (spec: "gap scans map the record, not the world") |
| Falsify 4 how it knows | = Acceptance 2 | Same file | RED |
| Falsify 5 contradiction without shared wording | Yes | See writer table below | Predicted FALSIFIED |

**Falsification tests are characterization tests, not red legs:** the spec itself predicts tests 3 and 5 fail, and this phase does not build a fix for them (B4 is blocked). Encode each as a test that exits 0 when the observed behavior matches the recorded outcome in `tests/fixtures/365-falsification-record.json` (`{test, predicted, observed, recorded_at, base_sha}`) and prints `FALSIFIED (as predicted)`. If a later change flips the behavior, the test fails and demands a record update. They must never sit in the red list as though 365 will heal them.

**Test 5 writer choice (named, per the CONTEXT specific):** grep found these CONTRADICTS writers:

| Writer | Decides from content? | Drive in test 5? |
|--------|----------------------|------------------|
| `scripts/analyze-room` Section 3 (B2B/B2C keyword pairs) and 3b (`contradict.*<section>` proximity regex) | YES, lexical | YES: this is the room-proactive contradiction scan every filing runs |
| `lib/core/graph-backfill.cjs` CUE_MAP heuristic deriver (`/\bcontradict(s|ed|ion)?\b/`) through `graph-derivation.runDerivation` | YES, lexical | YES: the deterministic offline producer the backfill uses |
| `graph-derivation.cjs` LLM/score producer (default deriveFn) | Semantic, but needs a live model or encoder | NO offline; record as the writer that COULD pass, untested |
| `findings-wirer.cjs` (`decision.kills_claim`), `reified-claim.cjs`, `unknowns/verdict.cjs`, `workflow/reconcile-f9-adapter.cjs`, `workflow/memory-cascade-f9-adapter.cjs`, `temporal/supersession-gate.cjs`, `research-planner/filing.cjs` (row label `contradicts`), `typed-frame.cjs`, `close-loop-writer.cjs` | NO: they record a contradiction a human or an external classifier already named | NO: out of scope; say so in the record |

Fixture pair: two artifacts in two sections that contradict with no shared keyword and none of the B2B/B2C trigger words (note that `individual` and `consumer` are in the B2C regex, so avoid them). Example: "The first units ship in March 2027." vs "Nothing leaves the factory before 2029." Assert zero CONTRADICTS edges and zero `CONTRADICT:` lines.

### Pattern 2: One pre-ratification standing reader (the seam the derived rung later replaces)
**What:** `claimStanding(db, claimId) -> { standing: 'source_edge'|'model_only'|'none', source_node_ids: [...], declared_max_rung: n|null }`, in `verification.cjs`.
- `source_edge`: at least one row in `edges` with `source = claimId` whose target node's `properties` JSON has non-empty string `url` AND non-empty string `retrieved_at`. Use `json_extract`, the idiom `insights.cjs` already uses. Empty strings do not count: `writeEvidenceClaim` stores `retrieved_at: ''` when the caller omitted it (evidence-claim.cjs:136).
- `model_only`: no source edge, and at least one verification record with `method === 'ask'` or a declared rung equal to the provisional model rung. Label this "recorded as checked by asking a model". It is declared, and the words must say so.
- `none`: neither.
Everything else calls only this function: the floor, the why-line, the portrait, both signals and B5. When the ladder is ratified, the gated wave swaps the body for the edge-derived rung and nothing else moves.
**Direction note:** the claim's evidence is its OUTBOUND edge. `writeReasoningNode` writes `SOURCED_FROM` from the new node to each `evidenceNodeIds` target (reasoning-write.cjs 159-196), which is how research-filed limiter claims link to their EvidenceClaims (filing.cjs 652-661). The gate's own decision node points INTO the claim (decision -> claim), so it never satisfies the floor. That is correct.

### Pattern 3: Floor enforcement without touching confirmNode
```javascript
// lib/mcp/tools/gate.cjs, inside _promoteCardSubject, after the existing
// eligibility checks (subject present, not a strategy card, kind 'general', row found).
// Source: gate.cjs 73-121 (read 2026-10-01). Sketch only.
if (row.type === 'claim') {
  const floor = navigation.readVerificationFloor(roomDir);          // {id, source, requires_source}
  const st = navigation.claimStanding(db, subjectId);               // Pattern 2
  const met = !floor.requires_source || st.standing === 'source_edge';
  navigation.logMemoryEvent(db, 'approval_floor_checked', {         // D-07, scalars only
    target_node_id: subjectId, floor_id: floor.id, floor_source: floor.source,
    standing: st.standing, floor_met: met, declared_max_rung: st.declared_max_rung,
    from_status: row.review_status, created_by: 'system',
  });
  if (!met) {
    if (row.review_status === 'proposed') {
      const held = navigation.holdForEvidence(db, subjectId, navigation.resolveByUser(roomDir), 'below room verification floor');
      return { subject_node_id: subjectId, subject_confirmed: false, subject_held: held.ok === true, subject_skip_reason: 'below_floor' };
    }
    return { subject_node_id: subjectId, subject_confirmed: false, subject_held: true, subject_skip_reason: 'below_floor_still_held' };
  }
  // met: fall through to confirmNode; with D-08 option B, confirmNode's
  // promoteNodeStatus(from=current, to='confirmed') works for needs_evidence too.
}
// opportunity subjects: byte-identical to today (recommendation, see Open Question 3)
```
The existing `row.review_status !== 'proposed'` early return must widen to also admit `needs_evidence` for `claim` subjects only. `holdForEvidence` is a new sibling in confirm-node.cjs that calls `promoteNodeStatus(db, id, 'proposed', 'needs_evidence', byUser, reason)`. That transition is already legal and is not human-gated, so an agent could also hold a claim. That is acceptable because a hold is not a promotion.

**D-08 recommendation: Option B, add `'needs_evidence->confirmed'` (plus its `EVENT_FOR_TRANSITION` entry `'status_promoted'`).**
- D-04 says the routes out are "add evidence and approve again, or lower the floor in ROOM.md". Under option A, a held claim released by lowering the floor has no honest target. `validated` means "evidence attached" in the Phase 108 truth-state contract (`.planning/phases/108-graph-memory-schema-reconciliation/TRUTH-STATES.md`: "needs_evidence -> validated: Evidence node attached + SUPPORTS edge created, Academic OR Operational tier required"). Landing there would assert evidence that does not exist.
- One target (`confirmed`) for both routes keeps every confirmed-only claim reader correct. `lib/core/unknowns/corpus-adapter.cjs:171` reads `review_status = 'confirmed'` only, so under option A claims released via `validated` would silently drop out of the unknowns corpus.
- It is additive. `test-348-agent-supersede-refused.cjs` pins "named membership only (never an exact .size)". The human-attribution guard applies automatically, because `setsConfirmed` covers `'confirmed'` (transitions.cjs 215, 243-247). No UPDATE statement changes, and test-348 pins those three statements byte for byte.
- Costs to state in the plan. (a) `confirmNode`'s code stays byte-unchanged, but its reach widens: any other caller (selector-decisions, lens-engine, qualify-opportunity, room-birth) that targets a `needs_evidence` node now succeeds where it used to get `invalid_transition`. Only assumptions sit at `needs_evidence` today (room-home.cjs 78), so the plan needs a Wave-0 grep of those four callers for assumption targets. (b) The transitions.cjs header comment ("documented 8-transition closed taxonomy") and TRUTH-STATES.md need a one-line update. Canon Part 9 enumerates statuses, not transitions (MINDRIAN-CANON.md:350), so no Appendix D entry appears to be required [ASSUMED]. Put a navigator checkpoint before the transitions.cjs edit.
- If the navigator prefers option A: re-approve with evidence lands `validated`; lowering the floor affects only future approvals; card copy must say so; and corpus-adapter.cjs:171 needs `IN ('confirmed','validated')`.

### Pattern 4: The why-line as card data, shown on all three rungs
- **Composer (shared, server-side):** `composeFloorNotice(db, roomDir, subjectId) -> { notice, approve_label } | null`. It returns null when the subject is not a `claim` or the floor is met. Copy example (D-05, no em-dash): "Checked against: nothing outside the conversation yet. This room asks for at least a source document, so approving files it as needs evidence." When a source edge exists, name the source (for example "Checked against: <url host> (retrieved <date>)"), so the approver sees WHAT the structural predicate accepted. It proves an edge exists, not that the source supports the claim.
- **Call sites (both required):** (1) the `gate_render` handler in gate.cjs 260-297, which opens the room db via `resolveSessionRoomDir` + `navigation.openRoomDbForCaller` before `renderGate`; (2) meeting file-meeting in tool-router.cjs 1707-1716, before `gateRender.renderGate(card, ...)`. Chain material-step cards are kind `material_step` and never promote a subject, so they do not need it. `research.cjs:173`, `stop-gate-handler.cjs:701` and `sensors.cjs:419` set no promotable claim subject (sensors' framework_run gate mints no ledger entry, per gate.cjs DC-3).
- **gate-render.cjs, additive only:** `normalizeCard` adds `notice: string|null` (capped at about 400 chars, no newlines beyond two). Rung (a): append the notice to `message` (the elicitation schema has no per-option description, gate-render.cjs 9-17, so the message is the only text channel). Rung (b): put it in `zones.signals` and in `contract.notice`. Rung (c): `zones.signals` (always `''` today, line 408). Relabel the option whose `id === 'approve'` to the approve_label and keep the id, because the id is the verdict vocabulary. gate-render.cjs stays pure: the notice arrives as data and no db is opened.
- **TOCTOU:** evidence can be added between render and answer. `gate_answer` re-evaluates; if the landed status differs from what the notice said, the response says so (`floor_changed_since_render: true`).

### Pattern 5: never-do check as an add-only halt
```javascript
// lib/core/chain-executor.cjs makeGateFn (line 805). Sketch.
function makeGateFn(opts) {
  const o = opts || {};
  const constraints = (o.constraints !== undefined) ? o.constraints
    : (typeof o.roomDir === 'string' ? neverDo.readNeverDo(o.roomDir) : { ok: true, entries: [] });
  ...
  return function gateFn(step, posture, priorOutput) {
    if (isIrreversibleStep(step)) return 'halt';                     // (1) STAYS FIRST
    if (constraints.ok !== true) return 'halt';                      // D-13 malformed: halt every step
    if (neverDo.matchStep(neverDo.declaredFieldsOfChainStep(step, o), constraints.entries)) return 'halt';
    ... // (2) quality carry, (3) escape hatch, (4) posture, all unchanged
  };
}
```
- Read the list once per `makeGateFn` construction, which is once per chain start. Never cache per process: the MCP server is long-lived and the file is hand-editable. This is the opposite of `irreversibility-ledger.cjs` `_fresh`.
- `runChain` (sync path line 1003) and `_runChainResilient` (line 1429) build the default gate with `makeGateFn({ postureFn })`. Both must pass `roomDir: o.roomDir`. Both `haltedAt` sites (lines 1111-1117 and 1566-1571) compute the reason as `isIrreversibleStep(step) ? 'forced_material' : 'gate_halt'`. Add a middle branch, `'constraint_named'` (or `'constraints_malformed'`), carrying `haltedAt.constraint = {kind, value, why}` from an exported pure `neverDo.matchStep`, so the halt card can show `why`.
- **Declared fields per surface (D-11, verified):**

| Surface | command | section | path | provider | term |
|---------|---------|---------|------|----------|------|
| chain_run step | `step.command` | chain `targetSection` (chainRun opts; the chain_run handler does not pass one today, so usually null) | registry `executable.produces` via `chainStepDispatcher.resolveExecutable(step.command)` (pure lookup) | - | - |
| ambient quick run | `qs.command` (`'/mos:whitespace'`, ambient.cjs 184) | `plan.return_target.section` | - | `quick.cjs` `PROVIDER` (`'openalex'`, quick.cjs:62) and each researchable `leaf.corpus` (`'openalex'`/`'room'`) | `picked.zone.term` plus the grant's approved synonyms for that term |

- `path` matching is whole-segment prefix on normalized POSIX paths: reject `..` segments and absolute paths at write time; `a/b` matches `a/b` and `a/b/c`, never `a/bc`. The `why` field is never matched (D-09).
- **Other runChain callers:** `lib/core/eureka/explore-chain.cjs:654` injects `makeGateFn({})`, and `lib/core/bono/debate-composition.cjs:350` injects `makeGateFn({ postureFn })`. Neither passes roomDir, so neither would enforce the list. `scripts/act-command.cjs` injects its own plan-only gate and executes nothing. Recommendation: thread `roomDir` into explore-chain (it has `opts.roomDir`, line 460). State debate-composition and act-command as out of scope with the reason (debate halts at its two material gates anyway; act only plans).

### Pattern 6: Fencing the blocked items
- Do NOT write derivation, B1a, B4 or migration plans in 365. Plan them as follow-on Phase 365.1 ("edge-derived rung, post-ratification"), created only after the paper author ratifies. Plans written against an unratified ladder would have to be rewritten.
- Add `data/verification-ladder.json` `{ "ratified": false, "draft": [0..5 ids], "ratified_at": null }` plus `tests/test-365-ladder-fence.cjs`. The fence asserts that while `ratified === false`: the `TODO(358)` marker is still in verification.cjs (test-358-b1-core.cjs:122-124 already pins it); `VERIFICATION_RUNGS` is unchanged; no `deriveRung`/`derivedRung` export exists on verification.cjs or navigation.cjs; `claim_verify` still takes a `rung` input; no `person` node type appears in `TRUTH_CLAIM_TYPES`. Flipping `ratified` to true is the gated act that opens 365.1.
- The byte test's derived half (rung 4 with `locator` vs rung 2) lives in the baseline-red list as `healed_by_plan: "365.1"`, so it stays KNOWN through 365 close and is handed over explicitly.

### Anti-Patterns to Avoid
- **Floor check inside confirmNode:** breaks four other callers (D-06).
- **Why-line only in the gate_render handler:** meeting cards skip it (tool-router.cjs:1720).
- **Copying irreversibility-ledger's degrade-to-empty:** a malformed never-do file must halt, not pass (D-13).
- **Minting an ambient gate in the child process:** the ledger is per-process memory; queue a pending card.
- **A 4th option on the material-step card whose id is not a verdict:** chain.cjs `verdictFor` maps `chosenIds[0]` straight to the verdict (chain.cjs 498-500), and gate_answer's zod enum is `approve|reject|defer`. A `reject_never_do` option id becomes an invalid verdict on the elicitation and text rungs. Carry the proposal on the Reject RESPONSE instead (Pitfall 7).
- **Rewording the existing 358 portrait lines:** test-358-b1-portrait.cjs pins `'checked: 0'`, `'unchecked (no checking record yet): 0'` and a no-score regex `/score|percent|pct|ratio|grade|coverage|%/`. Add standing rows; do not replace lines; keep the closing line.
- **Using Jev (spike-findings skill) or any model to grade a standing:** the spec forbids a model grading the rung.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Truth-state change | A raw UPDATE on nodes | `promoteNodeStatus` via confirmNode / a sibling helper | Human-attribution guard, memory_event audit, EvidenceClaim non-promotable guard, CAS reconcile |
| Approval trail | Ad hoc "approved" flag | The `writeGrant` `isApprovedVia` rule + a decision node minted by gate_answer (planner.cjs 561-592 pattern) | Same `{surface:'cli'|'mcp', decision_node_id}` shape the grants already audit |
| Gate id minting and replay guard | A second ledger | `gate-ledger.cjs` mintGate/consumeGate | T-198-10 single-use, session-keyed |
| Card rendering per host | A bespoke widget | `gateRender.renderGate` three-rung ladder | SEED-020 single door; check-render-coverage |
| Atomic JSON write | `writeFileSync` in place | tmp + `renameSync` (ambient.cjs `atomicWriteJson`) | Crash-safe; Cowork concurrency |
| Pending cards for a background run | A new queue | `planner.queuePendingCard` / `pendingCards` | Already surfaced at the research touchpoint |
| Threshold literal | A bare `4` | a `data/floor-ledger.json` row checked by `scripts/check-floor-ledger.cjs --check` | Repo floor-ledger rule; the checker validates `line_anchor` against the file |
| Portrait counts | A new aggregator | Extend `readVerificationPortrait` additively (`claims_by_standing`) | One reader; 358 tests stay green |

**Key insight:** every hard part here (human-only promotion, replay-safe gates, fail-shut enums, approval trails) is already solved in this repo. The phase's risk is in wiring the same predicate into every door, not in any new algorithm.

## Common Pitfalls

### Pitfall 1: Two claim-card doors, one why-line
**What goes wrong:** the why-line appears on Larry-composed cards but not on `meeting` file-meeting cards.
**Why:** tool-router.cjs:1720 calls `gateRender.renderGate` directly and mints the gate itself.
**How to avoid:** one composer, called from both; an acceptance-3 sub-leg drives the meeting path.
**Warning signs:** a test that only exercises `gate_render`.

### Pitfall 2: Existing suites flip red when the floor defaults on
**What goes wrong:** fixture rooms from `makeScratchRoom` have no ROOM.md and claims with no source edge, so approve now lands `needs_evidence`.
**Affected (read this session):** `tests/test-354-gate-subject-promotion.cjs` (4 `subject_confirmed` pins), `tests/test-276-meeting-gate-wiring.cjs`, `tests/test-354-concurrency-surfaces.cjs`, `tests/test-i2x-t2-node-write-back.cjs`, each with a `'confirmed'` assertion; they run in run-all-354/355/358. `tests/test-355-gate-opportunity-promotion.cjs` is unaffected only if the floor stays claim-only.
**How to avoid:** the B2 plan updates each test on purpose. Tests about promotion itself add a source edge fixture. Tests about the new behavior assert `needs_evidence`. Do not blanket `verification_floor: unchecked` into fixtures, because that would hide the new default. Also update the meeting tool's public contract text (tool-router.cjs 1642, 1733: "promotes it to confirmed") and the claim_verify/claim_read descriptions.

### Pitfall 3: ROOM.md head-read matches the body
**What goes wrong:** `readPwsStageHead`'s regex runs over the first 2 KB with `/m`, so a body line `verification_floor: ...` would match. It also throws when ROOM.md is missing (`statSync`).
**How to avoid:** parse only between the opening `---` and the closing `---` inside the head; wrap in try/catch and treat missing as default. Measured real room-root frontmatter is 146 to 958 bytes across 8 rooms, so 4 KB is ample.

### Pitfall 4: Floor id vocabulary is itself unratified
**What goes wrong:** D-02's example `secondary_document` is a DRAFT ladder id; the provisional constant has `database_or_document`. Writing either into user ROOM.md files freezes an unratified vocabulary.
**How to avoid:** a small closed `FLOOR_IDS` map in verification.cjs keyed by the draft ids (`unchecked`, `recall`, `model_internal`, `secondary_document`, `primary_source_located`, `person`), with provisional aliases (`database_or_document` -> `secondary_document`, `primary_source` -> `primary_source_located`, `own_intuition` -> `recall`, `model_counter_argument` -> `model_internal`, `dissenting_person` -> `person`). An unknown value fails shut to the default and the event records `floor_source:'invalid_fell_back'`. The default is applied by the reader, never written into existing ROOM.md files (no migration, D-01).

### Pitfall 5: Fail-open copied from the irreversibility ledger
**What goes wrong:** `_build()` returns an empty Set on malformed JSON (irreversibility-ledger.cjs 66-110). Copying it makes a corrupt never-do file silently allow everything.
**How to avoid:** `readNeverDo` returns `{ok:false, reason:'malformed'}` on a parse error, wrong schema, unknown kind, or missing `approved_via`; callers halt. ENOENT alone is `{ok:true, entries:[]}`.

### Pitfall 6: Ambient halt with no live gate
**What goes wrong:** the ambient child calls `gateLedger.mintGate`, and the id dies with the child.
**How to avoid:** write `card.json` under `.mindrian/research-runs/<run_id>/` (keep the dir; do not `dropRunDir`), queue `planner.queuePendingCard(kind:'halted_constraint')`, and render it later through `gate_render`. Check that whatever consumes `pendingCards` tolerates the new kind.

### Pitfall 7: Verdict identity mapping on material-step cards
**What goes wrong:** a "Reject and never do this" option id becomes the verdict on rungs (a)/(c) and fails gate_answer's enum.
**How to avoid:** keep the 3-option card. On a `reject` verdict, the chain_run / gate_answer response carries `never_do_proposal: {kind, value, why_prompt}`, pre-filled from the step's declared fields. Larry offers ONE follow-up card (kind `general`, `proposed_constraint` set). Its approve mints the decision node, and then gate_answer calls `writeNeverDo` with that node id. This also avoids any MAX_K question (see Open Question 5).

### Pitfall 8: Held claims disappear from the wiki
**What goes wrong:** `getConfirmedFacts` (room-home.cjs 45-65) shows only `confirmed`/`validated`; `getRiskyAssumptions` shows only `assumption` at `needs_evidence`. A held CLAIM shows nowhere on room home.
**How to avoid:** B5 adds held claims to a room-home list (for example `heldClaims`) with their standing words and the move that would release them.

### Pitfall 9: Nested transactions
**What goes wrong:** `promoteNodeStatus` runs `db.exec('BEGIN')` (transitions.cjs 249). Calling the hold helper inside a caller's open transaction throws on node:sqlite (no nested transactions; see verification.cjs 180-186 CR-01).
**How to avoid:** call the floor logic only outside a transaction (gate_answer opens none today). If a transaction is ever needed, use the `db.isTransaction` ownership idiom.

### Pitfall 10: The structural predicate is gameable
**What goes wrong:** any caller able to write a claim -> node edge to an EvidenceClaim with a url passes the floor. The predicate proves an edge exists, not that the source was read.
**How to avoid:** accept this as the pre-ratification floor (D-03 is locked), but always NAME the accepted source on the card and in the audit event (node id only in the event, Part 8), and never call the standing "verified". The gated derivation (locator for rung 4) narrows it later.

### Pitfall 11: Tool-description and schema drift
**What goes wrong:** new `gate_render` fields and reworded descriptions trip `test-270-tool-schema-budget.cjs`, `test-234-tool-description-floor.cjs`, `test-265-mcp-description-hygiene.cjs`, and the known-red `test-198-contract-schema`.
**How to avoid:** keep additions short; run those tests in the aggregator.

## Code Examples

### Floor reader (frontmatter-only head-read)
```javascript
// Pattern: lib/core/ambient-framing.cjs readPwsStageHead (lines 118-136), hardened.
function readVerificationFloor(roomDir) {
  let head = '';
  try {
    const fd = fs.openSync(path.join(roomDir, 'ROOM.md'), 'r');
    try { const buf = Buffer.alloc(4096); head = buf.slice(0, fs.readSync(fd, buf, 0, 4096, 0)).toString('utf8'); }
    finally { try { fs.closeSync(fd); } catch (_e) { /* best effort */ } }
  } catch (_e) { return floorOf(DEFAULT_FLOOR_ID, 'default'); }
  const m = head.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return floorOf(DEFAULT_FLOOR_ID, 'default');
  const kv = m[1].match(/^verification_floor\s*:\s*["']?([a-z_]+)["']?\s*$/m);
  if (!kv) return floorOf(DEFAULT_FLOOR_ID, 'default');
  const id = FLOOR_ALIASES[kv[1]] || kv[1];
  return FLOOR_IDS.has(id) ? floorOf(id, 'room_md') : floorOf(DEFAULT_FLOOR_ID, 'invalid_fell_back');
}
```

### never-do write with an approval trail
```javascript
// Pattern: lib/core/research-planner/grants.cjs writeGrant (141-176) + isApprovedVia (129-132).
function writeNeverDoEntry(roomDir, entry, opts) {
  const via = opts && opts.approved_via;
  if (!isApprovedVia(via)) return { ok: false, reason: 'approval_required' };
  if (!KINDS.has(entry && entry.kind)) return { ok: false, reason: 'invalid_kind' };
  if (!nonEmpty(entry.value) || entry.value.length > 200) return { ok: false, reason: 'invalid_value' };
  if (entry.kind === 'path' && !isSafeRelPath(entry.value)) return { ok: false, reason: 'invalid_path' };
  if (!nonEmpty(entry.why) || entry.why.length > 300) return { ok: false, reason: 'invalid_why' };
  const cur = readNeverDo(roomDir);
  if (cur.ok !== true) return { ok: false, reason: 'existing_file_malformed' }; // never overwrite a file we cannot read
  const next = { schema: 'mos.room-constraints/1', entries: cur.entries.concat([{ kind: entry.kind, value: entry.value, why: noDash(entry.why),
    approved_via: { surface: via.surface, decision_node_id: via.decision_node_id }, approved_at: new Date().toISOString() }]) };
  atomicWriteJson(path.join(roomDir, '.mindrian', 'never-do.json'), next);
  return { ok: true };
}
```

### Trip line (append-only jsonl)
```javascript
fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
fs.appendFileSync(path.join(roomDir, '.mindrian', 'constraint-trips.jsonl'),
  JSON.stringify({ schema: 'mos.constraint-trip/1', at: iso, surface: 'chain_run'|'ambient',
    kind, value, reason: 'constraint_named'|'constraints_malformed', step_command, run_id }) + '\n');
```

## Portrait, signals and B5 (component notes)

- **`/mos:status --checks`:** `parseArgs` (mos-status.cjs 89-100) silently ignores unknown flags today, so `--checks` currently prints the normal status. That is a baseline fact worth pinning. Add a `checks` flag that renders the standing portrait via navigation (the script already lazy-loads navigation.cjs) plus one never-do line: "Never-do list: N named. It catches only what has been named." Update `commands/status.md` `argument-hint` and its Arguments section. Do NOT touch its `teaching` field: `teaching` + `jtbd_summary` feed the irreversibility-ledger text hash and the registry. Run `node scripts/build-command-registry.cjs` / `build-connector-registry.cjs --check` after the frontmatter change.
- **Desktop/Cowork:** `claim_read` already returns `portrait` + `rendered.portrait` on every call. Extend that. No new tool.
- **Portrait rows (provisional words, D-16):** "reached a source document outside the conversation (a link and a retrieval date): N - moves up when a located part of a primary source is recorded" / "recorded as checked only by asking a model: N - moves when checked against a source document" / "held for evidence (approved below this room's floor): N - moves when a source is attached and approved again" / "not checked yet: N - moves with any check". Avoid the words score, percent, ratio, grade, coverage (358 no-score guard). Keep "A count is not a verdict. Only a person confirms a claim." last. Frame low counts as normal: the spec says most confirmed claims at 1-2 is the fix working.
- **Signals (D-17):** compute in a pure `readVerificationSignals(db, snapshots)` in verification.cjs and merge into `persistIntelligence` (proactive-intelligence.cjs 264) the way `readGraphFindings` is merged. Extend `insightKey` for the new type (for example `verification:decision_on_model_check:<claim>` and `verification:stall`). Confidence `medium`, because Zone 3 shows HIGH/MEDIUM only (skills/ui-system/SKILL.md:42). Signal 1 "a decision rests on": any `decision` node with an outbound SOURCED_FROM, DEPENDS_ON or ASSUMES edge to the claim, where the claim's standing is `model_only`. The message carries the fix (INV-SL-4: no warning without its fix), for example "check it against a source document with /mos:research". Note: `readGraphFindings` opens DatabaseSync directly (line 140), a pre-existing Part 9 bypass. New reads should go through navigation.cjs.
- **Weekly snapshot:** one per ISO week, written from `persistIntelligence` and from `--checks` when no snapshot exists for the current week. Payload: counts by standing plus `records_total`. The stall rule: the last N snapshots have identical standing counts AND `records_total` strictly grew across them; suppressed while fewer than 2 snapshots exist. Add the row `verification.STALL_WEEKS` (value 4, kind `floor`, status `disclosed`, `provenance` "365 D-17 discretion default, unmeasured", `dependent_outputs` ["room_proactive"]) with a real `line_anchor` constant in the file the checker scans.
- **B5 renderer enumeration (MEDIUM: grep-based; a Wave-0 task should re-run the grep):**

| Renderer | File | Prints a claim? | B5 action |
|----------|------|-----------------|-----------|
| claim view / list / portrait (claim_read, claim_verify, `scripts/claim-checks.cjs`) | verification.cjs 382-438 | yes | add standing words per claim |
| gate card (gate_render, meeting) | gate.cjs, tool-router.cjs | subject claim | notice (Pattern 4) |
| room home facts (room_context, wiki room home) | navigation/room-home.cjs 45-100, via room-context.cjs:61 | yes | standing words on facts; add held claims (Pitfall 8) |
| graph export rows (presentation graph view, dashboard) | navigation/graph-export.cjs 199 (`review_status` per node) consumed by `scripts/generate-presentation.cjs:718` | claim nodes | add `verification_standing` + words for claim nodes |
| unsupported-claim scan explanations / research preflight evidence_gaps | insights.cjs 190-203; research-preflight.cjs:122 | yes | name the standing in the explanation |
| `scripts/generate-export.cjs` `queryLazyGraph` (line 231) | reads room.db | verify in Wave 0 | add if it lists claims |
| wiki page renderer, render-v2, quickview, hub, deck | lib/wiki/page-renderer.cjs, lib/render, lib/quickview, scripts/generate-hub/deck | no room.db claim reads found | none (artifacts, not claim nodes) |

## State of the Art (in this repo)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Approve confirmed only the decision node | Approve also promotes the card's subject claim | Phase 354-02 (SYS-08) | The floor must hook this promotion |
| Two gate ledgers | One session-keyed ledger (`gate-ledger.cjs`) | Phase 238 | Constraint halt cards mint into the same ledger |
| Irreversible = keyword hints | + dev-time ledger, add-only | Phase 356 | Template for add-only, but NOT for fail-open |
| Self-declared rung only | (this phase) structural standing; derivation after ratification | 365 / 365.1 | The declared rung stays recorded, labelled "declared" |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Adding `needs_evidence->confirmed` needs no Canon Appendix D entry, because Canon Part 9 enumerates statuses, not transitions | Pattern 3 / D-08 | A canon amendment and floor-test lockstep would be needed; add a navigator checkpoint before the edit |
| A2 | The floor should apply to `claim` subjects only, not `opportunity` | Pattern 3 | If the navigator wants opportunities floored, test-355-gate-opportunity-promotion and the HIPS-06 telemetry flow change |
| A3 | Falsification test 2 can find a usable "confidence" in the suggest_next / dispatchSensors path | Pattern 1 | The test becomes "no confidence emitted", still a valid recorded finding |
| A4 | The consumer(s) of `planner.pendingCards` tolerate a new `halted_constraint` kind | Pitfall 6 | Needs a small consumer change; Wave-0 grep |
| A5 | Weekly snapshots as memory_event are acceptable under D-18 ("record" is unspecified) | Signals | If jsonl is wanted, swap the writer; the stall logic is unchanged |
| A6 | Floors above `secondary_document` can be honored before derivation by `locator` on the target node (rung 4) and by "always hold" (rung 5, no person node exists) | Open Question 2 | If the navigator prefers rejecting such floors, the reader treats them as invalid and falls back |

## Open Questions (RESOLVED)

1. **D-08: which exit for a held claim?**
   - Known: option A has no honest target for the "lower the floor" route; option B is additive and guarded.
   - Recommendation: option B (Pattern 3), with a navigator checkpoint on the transitions.cjs edit.
   - RESOLVED: D-20 (one additive needs_evidence -> confirmed transition, behind the 365-05 navigator checkpoint).
2. **Floors above what the pre-ratification predicate can check.**
   - Recommendation: `secondary_document` = source edge; `primary_source_located` = source edge whose target also carries a non-empty `locator` (structural, no model); `person` = always hold, with the card saying no person check can be recorded yet. The copy must never imply a check the code did not run.
   - RESOLVED: D-22 (honored structurally; locator for a primary-source floor; person always holds).
3. **Floor on opportunity subjects?** Recommendation: no, claim only (A2).
   - RESOLVED: D-21 (claims only; opportunity subjects keep today's behavior).
4. **Snapshot store format** (A5). Recommendation: memory_event in room.db.
   - RESOLVED: D-23 (one memory_event per ISO week through navigation.cjs; N = 4 in data/floor-ledger.json).
5. **MAX_K and a 4th card option.** MAX_K=3 bounds ranked 1-of-N candidate sets (MINDRIAN-CANON.md:181), arguably not a verdict card. Recommendation: sidestep by using the follow-up proposal card (Pitfall 7).
   - RESOLVED: plan 365-13's follow-up "Reject and never do this" card (three options; no fourth option on the verdict card).
6. **Other runChain callers** (explore-chain, debate-composition). Recommendation: thread roomDir into explore-chain; debate and act out of scope with reasons.
   - RESOLVED: plan 365-09 (explore-chain passes roomDir; debate-composition and act-command recorded out of scope with reasons).
7. **Phase 358 frame-provenance timing check** (deferred): not in the build; keep as a separate quick task.
   - RESOLVED: deferred to 365.1 and the follow-ons (365-FOLLOW-ONS.md, written by plan 365-16); not built in 365.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | v22.23.1 (>= 22.16.0 floor) | - |
| node:sqlite | room.db | yes (built in) | Node 22 | - |
| python3 | `scripts/analyze-room` (falsification test 5, test 3) | yes | 3.12.3 | skip those legs with exit 77 (ENV GAP) |
| git | baseline pinning via `git show <base_sha>` | yes | - | exit 77 |
| Network | none | not needed | - | net guard enforces zero egress |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | plain Node scripts (`node:assert/strict`, house `check()` idiom), exit 0 / 1 / 77; bash aggregators |
| Config file | none; `tests/run-all-365.sh` (written once in the first plan) |
| Quick run command | `node tests/test-365-<name>.cjs` |
| Full suite command | `bash tests/run-all-365.sh` (plus `RUN_365_REGRESSIONS=1` for the regression block) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| V365-01 | Base sha + red signatures + falsification outcomes pinned | baseline | `node tests/test-365-baseline.cjs` | no, Wave 0 |
| V365-02 | Byte test, structural half | acceptance | `node tests/test-365-acceptance-byte.cjs` | no, Wave 0 (red at base) |
| V365-03 | One-week test, two processes | acceptance | `node tests/test-365-acceptance-one-week.cjs` | no, Wave 0 (red at base) |
| V365-04 | Floor test on 3 rungs + meeting path | acceptance | `node tests/test-365-acceptance-floor.cjs` | no, Wave 0 (red at base) |
| V365-05 | Floor reader (frontmatter only, aliases, invalid fallback, missing file) | unit | `node tests/test-365-floor-reader.cjs` | no |
| V365-06 | Hold / release transitions; confirmNode unchanged (source hash pin); opportunity unchanged | unit + integration | `node tests/test-365-floor-gate.cjs` | no |
| V365-07 | Notice survives normalizeCard; printed by rungs a/b/c; decision-node text unchanged | unit | `node tests/test-365-floor-notice.cjs` | no |
| V365-08 | One `approval_floor_checked` event per approve, scalars only | unit | in test-365-floor-gate.cjs | no |
| V365-09 | Reader: missing/malformed/unknown kind; matcher: exact, segment prefix, `why` never matched | unit | `node tests/test-365-never-do-core.cjs` | no |
| V365-10 | Writer refuses without approved_via; gate_answer approve path writes | unit + integration | `node tests/test-365-never-do-writer.cjs` | no |
| V365-11 | makeGateFn order (irreversible first), halt reason both loop paths, card why, trips line | integration | `node tests/test-365-never-do-chain.cjs` | no |
| V365-12 | Ambient: halted_constraint before recordRun, zero fetch (net guard), pending card | integration | `node tests/test-365-never-do-ambient.cjs` | no |
| V365-13 | Reject response carries a pre-filled proposal; nothing lands without approve | integration | in never-do-chain / never-do-ambient | no |
| V365-14 | `--checks` output rows, no-score regex, never-do floor sentence; claim_read portrait | unit | `node tests/test-365-portrait.cjs` | no |
| V365-15 | Signal 1 fires only for decision-linked model-only claims; stall suppressed <2 snapshots; one snapshot per week | unit | `node tests/test-365-signals.cjs` | no |
| V365-16 | Every enumerated renderer uses STANDING_WORDS (source grep: labels appear only in verification.cjs) | unit + static | `node tests/test-365-b5-renders.cjs` | no |
| V365-17 | Ladder fence | static | `node tests/test-365-ladder-fence.cjs` | no |
| V365-18 | Part 8 sweep, dash fence, connector/shape/floor-ledger/render checks, regression suites | gate | legs inside `run-all-365.sh` | aggregator no |
| Falsify 3, 5 (2 partial) | Recorded outcome still holds | characterization | `node tests/test-365-falsify-*.cjs` | no |
| Falsify 1 | Two navigators | manual-only | protocol in `365-BASELINE.md` | - |

**Signal sampled per requirement:** V365-02..04 = review_status read back through a FRESH `openRoomDb` handle (never the tool's `response.ok`, the test-354 discipline) plus rendered payload text. V365-06/08 = `nodes.review_status` + memory_event rows. V365-11/12 = `haltedAt.reason`, trips file lines, the net-guard fetch count (must be 0), and the ledger `runs` array unchanged. V365-14/15 = rendered lines plus `.proactive-intelligence.json` insights. V365-16 = a static grep plus rendered output. V365-17 = source inspection.

### Sampling Rate
- **Per task commit:** the task's own `node tests/test-365-*.cjs`, plus `node tests/test-358-b1-portrait.cjs` when verification.cjs is touched.
- **Per wave merge:** `bash tests/run-all-365.sh`.
- **Phase gate:** `RUN_365_REGRESSIONS=1 bash tests/run-all-365.sh` (running run-all-354, -355, -356, -358 and -363 sequentially, with their pre-existing reds as run_known using the signatures recorded in run-all-363.sh 122-181), `node scripts/build-connector-registry.cjs --check`, `node scripts/check-shape-declaration.cjs`, `node scripts/check-floor-ledger.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/doctor.cjs --acceptance`.

### Wave 0 Gaps
- [ ] `tests/helpers/fixture-room-365.cjs`: claim seeding with and without source edges, ROOM.md floor writer, ask/read records (wraps fixture-room-354).
- [ ] `tests/fixtures/365-pre-phase.json`, `365-baseline-red.json`, `365-falsification-record.json`.
- [ ] `tests/run-all-365.sh` (written once).
- [ ] The three acceptance tests and the falsification tests, run at the base sha, with their signatures recorded BEFORE any lib/ edit.
- [ ] Wave-0 greps: `pendingCards` consumers; confirmNode callers that can target `needs_evidence`; `generate-export.cjs` `queryLazyGraph` claim output.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | - |
| V3 Session Management | yes (gate ids) | `gate-ledger.cjs` session-keyed single-use mint/consume (unchanged) |
| V4 Access Control | yes | Human-only promotion (`AGENT_IDENTITIES` guard in promoteNodeStatus); never-do writes only with `approved_via` + a minted decision node |
| V5 Input Validation | yes | zod on the new gate_render fields; closed `kind` enum; value/why length caps; POSIX path normalization rejecting `..` and absolute paths; floor id closed map; `validateChosenAgainstCard` unchanged |
| V6 Cryptography | no | - |
| V7 Error Handling and Logging | yes | `approval_floor_checked` memory_event on every approve; `constraint-trips.jsonl`; malformed never-do fails shut |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Model asserts evidence by passing evidence ids on the card | Spoofing | Floor reads only the claim's own outbound edges, never `card.evidenceNodeIds` |
| Model writes a claim -> EvidenceClaim edge to pass the floor | Tampering | Accepted pre-ratification (D-03); the card names the accepted source; the audit event records the node id; derivation narrows it later |
| Hand edit lowers the floor silently | Repudiation | Every approve records floor id + source (D-07) |
| Corrupt or hostile never-do.json | Tampering / DoS | Fail shut halts unattended steps only (attended flows still work); `/mos:status --checks` reports "never-do file unreadable" with the fix |
| Gate replay to re-promote | Spoofing | Existing single-use ledger + `state_mismatch` in promoteNodeStatus |
| Room content in events or trips | Information disclosure (Part 8) | Payloads are ids, enums, `kind`/`value` literals the navigator approved; the `why` sentence lives only in never-do.json (room-local), never in memory_event |
| Egress before the constraint check | Information disclosure | The check sits before `grants.recordRun` and `runQuick`; the net-guard test asserts 0 fetches |

## Sources

### Primary (HIGH confidence, code read this session)
- `lib/mcp/tools/gate.cjs` (whole file), `lib/mcp/gate-render.cjs` (whole file), `lib/mcp/gate-ledger.cjs` 1-60
- `lib/core/navigation/verification.cjs` (whole), `confirm-node.cjs` (whole), `transitions.cjs` (whole), `room-home.cjs` 40-145, `insights.cjs` 185-230, `evidence-claim.cjs` 110-160, `reasoning-write.cjs` 100-200 (grep)
- `lib/core/chain-executor.cjs` 440-600, 780-960, 1080-1130, 1545-1580; `lib/mcp/tools/chain.cjs` 180-610
- `lib/core/research-planner/ambient.cjs` (whole), `grants.cjs` 120-200, `planner.cjs` 545-667, `quick.cjs` (PROVIDER grep), `filing.cjs` 570-680
- `lib/core/irreversibility-ledger.cjs` (whole), `lib/core/frontmatter-schemas.cjs` 136-360, `lib/core/ambient-framing.cjs` 110-142
- `lib/core/proactive-intelligence.cjs` 1-345, `lib/core/intelligence-cascade.cjs` 560-600, `scripts/intent-classifier.cjs` 860-960
- `lib/mcp/tool-router.cjs` 1642-1735 (meeting), `lib/mcp/tools/claim-verify.cjs` (whole), `lib/mcp/tools/status.cjs` 100-200, `scripts/mos-status.cjs` 1-110, 575-622
- `lib/core/navigation/memory-events.cjs` EVENT_TYPES (grep), `scripts/check-floor-ledger.cjs` 1-60, 231-305, `data/floor-ledger.json`
- `tests/run-all-363.sh`, `tests/run-all-363.1.sh`, `tests/test-363-baseline.cjs`, `tests/test-354-gate-subject-promotion.cjs`, `tests/test-358-b1-portrait.cjs`, `tests/test-348-agent-supersede-refused.cjs` 190-220, `tests/helpers/fixture-room-354.cjs`
- `scripts/analyze-room` 180-270, `lib/core/graph-backfill.cjs` 60-110, `lib/core/graph-derivation.cjs` 185-260, `lib/core/findings-wirer.cjs`
- `.planning/phases/108-graph-memory-schema-reconciliation/TRUTH-STATES.md`; `docs/MINDRIAN-CANON.md` lines 178-181, 350-352; `docs/STATUSLINE-CONTRACT.md` INV-SL-2..5; `skills/ui-system/SKILL.md` 42-52; `skills/room-proactive/SKILL.md`; `commands/status.md`

### Secondary (MEDIUM)
- Renderer enumeration for B5 (grep-based; Wave 0 should re-run it)
- Falsification test 2's confidence field location

### Tertiary (LOW)
- None used as a basis for a recommendation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, since nothing new is installed and the versions were probed.
- Architecture and seams: HIGH, since every call site was read with line numbers.
- D-08 recommendation: MEDIUM-HIGH, since the canon-amendment question is [ASSUMED] (A1).
- Pitfalls: HIGH for 1, 2, 5, 6, 7, 9 (verified in code); MEDIUM for 8 and 10.
- Falsification encodings: MEDIUM.

**Research date:** 2026-10-01
**Valid until:** 2026-10-15 (fast-moving repo; re-check gate.cjs, chain-executor.cjs and ambient.cjs if any sibling phase commits to them first. Phase 364 is planned next and reuses the 363 research engine.)
