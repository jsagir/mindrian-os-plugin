# Roadmap: MindrianOS Plugin -- v1.16.0 "Infrastructure Remediation"

**Previous milestone:** v1.15.0 "The Cockpit" (code-complete through Phase 234, latest released tag v1.15.3-beta.50; official stable close-out pending -- see Release train Gate 0 below). Full v1.15.0 roadmap detail archived at `.planning/milestones/v1.15.0-ROADMAP.md`. This file covers ONLY v1.16.0. Phase numbering continues from 234.

**Release train (navigator directive 2026-07-28):** after Phase 234, close down OFFICIAL v1.15.0 first -- finalize the v1.15.3-beta.x train to the stable release (Gate 0 in Progress below) -- THEN v1.16.0 work ships as `v1.16.0-beta.N` prereleases. No v1.16.0 release cut before the stable v1.15.0 close-out.

## Overview

Close all 35 findings from the 2026-07-28 nine-piece infrastructure audit (24-agent scrutinize/red-team/rethink workflow; consolidated report referenced in PROJECT.md). The audit's cross-piece synthesis found ONE recurring failure shape across roughly twelve findings: a mechanism wired at one end and inert at the other -- a hook that matches nothing live, a queue nobody drains, a gate whose approval reaches no execution, a guard on an unused door. This milestone is remediation only (no new user-facing features), sequenced by dependency: the CIRS commit-gate fix plus a reusable seam-liveness assertion first (the leverage point -- a Level-6 information-flow problem, not a Level-5 rules problem), the two live room.db data-loss risks in parallel, memory's Layer 2 fix ONLY after room.db lands (otherwise routing promotions into a table that graph-rebuild truncates converts a quiet loss into a permanent one), then the remaining pieces.

Every success criterion below follows the rigor standard this session's own completed work set (Phase 233, and the `hedge-fold-has-no-production-trigger` RCA resolution): mutation-proven gates (disabling the fix turns a specific test red), real end-to-end runs against seeded rooms, and census assertions that exclude `tests/` so a test honoring a contract can never satisfy a production-wiring gate vacuously.

## Cross-Cutting Research Rules (bind every phase)

Carried verbatim from REQUIREMENTS.md; plan-phase must honor these during research:

- **langtalks-graph-expert (MANDATORY, per CLAUDE.md standing rule):** every phase touching agent/LLM engineering concepts (dispatch, memory, RAG, reasoning, guardrails, MCP protocol) consults `mcp__langtalks-graph-expert__*` during planning and research. Applies directly to Phases 235, 237, 238, 241.
- **Claude Code / Claude API expertise:** phases touching hooks (`hooks/hooks.json`, `PreToolUse`/`PostToolUse`/`Stop` matchers), MCP tool registration, or subagent/agent-registry behavior consult the `claude-api` skill and the `claude-code-guide` agent before changing matcher patterns or registry logic. Applies directly to Phases 235, 237, 238, 239.
- **SQL / SQLite expertise:** phases touching `room.db` (`lib/core/room-db.cjs`, `lib/core/navigation/*`, raw SQL) consult Context7 docs for `node:sqlite` (`DatabaseSync`, transaction semantics, WAL visibility, the `timeout` option's real version floor) before writing or reviewing any transaction-wrapping fix. Applies directly to Phases 236, 240, 242.

Already-scoped inputs (routed in, not re-planned): `hedge-fold-has-no-production-trigger.md` (resolved -- the model for criterion rigor), `minto-debounce-consumer-dead-end.md` (filed, Phase 241 input), `graph-rebuild-truncates-memory-journal.md` (filing in progress, Phase 236/240 input), `graph-edge-pending-undrained-dead-letter-queue.md` (debug in progress, Phase 240 input), `room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md` (diagnosed, live before/after verified -- room_bind's session-scoped binding is invisible to every MCP read tool unless MINDRIAN_MCP_FIRST covers the calling surface. SPLIT ROUTING, navigator 2026-07-28: Phase 237/REACH-03 takes ONLY the session-scoping acceptance test; the structural resolver collapse is carried to the v1.17.0 "MCP-First" milestone, see Next Milestone below).

## Phases

**Phase Numbering:** integer phases are planned milestone work; decimal phases (e.g. 236.1) are urgent insertions. Numbering continues from v1.15.0's last phase directory (234).

- [x] **Phase 235: CIRS Commit Gate + Seam-Liveness Helper** - The born-wired gate actually fires on every commit in every worktree, and one reusable seam-liveness assertion proves any seam live at BOTH ends (the leverage point) (completed 2026-07-28)
- [x] **Phase 236: room.db Data-Loss Fixes** - Graph rebuild cannot erase memory/decision/truth-claim rows (one transaction), and a busy or broken open reports its real state instead of cold-starting (completed 2026-07-29)
- [x] **Phase 237: Reach Mechanism** - Approving a chain step actually runs it, one autonomy authority instead of two, and reach signals are session-scoped (completed 2026-07-29)
- [x] **Phase 238: Decision Gates** - Gates resolve through the ledger that minted them, session-scoped and concurrency-safe, and the card-fire backstop stops firing on prose (completed 2026-07-29)
- [x] **Phase 239: Brain-Access Surface** - The egress guard and PII sanitizer cover the doors user content actually walks through, and sendPacket's fate is decided explicitly (completed 2026-07-30)
- [x] **Phase 240: Memory** - Layer 2 promotion fires on real continuous work, the dead-letter queue drains into the memory cortex, and the test suite is hermetic (completed 2026-07-30)
- [x] **Phase 240.1: Context-Layer Drift Detection** - Per-room STATE.md regeneration carries a schema version stamp instead of blind-overwriting it, room.db's graph and BRAIN.md name the SEMANTIC-vs-CONTEXT boundary `INDEXER_OWNED_NODE_TYPES` already enforces, and a benchmark gate measures whether room context actually improves Larry's answer accuracy (completed 2026-07-30)
- [x] **Phase 241: Feynman-MINTO** - Guardian output reaches the user instead of /dev/null, and the repair ladder triggers on the breaches navigators actually hit (completed 2026-07-28)
- [x] **Phase 242: The Moat** - The HSI-to-graph rewrite is transaction-wrapped, and the PR checklist's dead KuzuDB warning becomes a machine-checked assertion (completed 2026-07-28)
- [x] **Phase 243: Voice-Glyph** - The statusline's "who is speaking" signal reflects the glyph a turn actually opened with, not a fabricated default (completed 2026-07-28)
- [ ] **Phase 244: Semantic Trigger Tier** - The sensor layer gains a real content-relevance trigger (SQLite FTS5 bm25, not keyword-fallback-only), and the dial fuses across trigger families instead of a flat score sort

## Phase Details

### Phase 235: CIRS Commit Gate + Seam-Liveness Helper

**Goal**: The Part-11 invocation constitution enforces for real: the commit-time born-wired gate fires on every commit in every worktree on this machine, and the repo owns ONE reusable seam-liveness assertion helper that proves a mechanism is alive at both ends -- the primitive the whole milestone's recurring failure shape was missing.
**Depends on**: Nothing (first, in parallel with Phase 236)
**Requirements**: CIRS-01, CIRS-02, CIRS-03
**Success Criteria** (what must be TRUE):

  1. A scratch commit introducing a born-unwired surface is rejected by the commit-time gate in the primary checkout AND in a second worktree sharing this machine's hooks dir; after the C-1 rival-installer overwrite scenario is reproduced, the SAME mutation commit is still rejected -- proven by re-running the commit, not by inspecting hook files.
  2. The reusable seam-liveness helper turns red on each of its three seeded dead-seam fixtures (a hook matcher naming a tool that no longer exists, an enqueue with no registered consumer, a minted gate with no reachable ratifier) and green on live-seam controls; it ships as a repo-wide helper, not CIRS-only.
  3. CIRS's own `--check` consumes the helper for CIRS's surfaces, and disabling the helper call turns `--check` red -- the wiring is load-bearing, not decorative.
  4. With a seeded shape-declaration violation, `check-shape-declaration.cjs --strict` exits non-zero through `scripts/release.sh`'s actual invocation path (the `|| true` swallow is gone), while the non-strict path still warns-and-passes; both behaviors demonstrated by running the release script's check step against the seeded violation (CIRS-03 folds into CIRS-01's gate work).

**Plans**: 2 plans

- [x] 235-01-PLAN.md - CIRS-01/CIRS-03: consolidate the pre-commit hook to one canonical source (retiring the divergent setup-hooks.sh / install-pre-commit.sh authoring), fix release.sh's --strict-shape swallow, and mutation-proof both end to end (worktree + rival-installer-overwrite reproduction).
- [x] 235-02-PLAN.md - CIRS-02: build the repo-wide lib/core/seam-liveness.cjs helper (3 named dead-seam shapes + live controls), wire it into build-connector-registry.cjs's coverageReport() to close the MCP-tool-file blind spot, and mutation-proof the wiring.

### Phase 236: room.db Data-Loss Fixes

**Goal**: The two live data-loss risks in room.db are closed: a graph rebuild can never erase memory rows, and a failed open tells the truth about its state instead of collapsing into a cold start.
**Depends on**: Nothing (urgent, in parallel with Phase 235)
**Requirements**: GRAPHDB-01, GRAPHDB-02, GRAPHDB-03
**Success Criteria** (what must be TRUE):

  1. A crash injected mid-`rebuildGraph` (process killed between the delete and the reindex) on a seeded room leaves every `memory_event` row, confirmed truth-claim, decision, and opportunity `stage_history` entry intact on reopen -- the delete-then-reindex rides ONE transaction; removing the transaction wrap turns this gate red.
  2. A concurrent reader polling the db THROUGHOUT a live rebuild never observes a partial or empty graph state -- WAL snapshot-visibility behavior proven by observation on this Node/SQLite combination, not asserted from docs (the explicit transaction/WAL implications the user asked for).
  3. A room.db held busy by another connection, and a room.db caught mid-migration, each produce a typed busy/broken result at the open surface, distinguishable from "no room db"; the seeded-lock run shows the real state and the old cold-start collapse cannot be reproduced.
  4. The `timeout:5000` write-safety option's real Node version floor is documented and `package.json` engines reflects it (GRAPHDB-03 is log-only: verified against current `node:sqlite` docs via Context7, no phase-blocking behavioral gate).

**Plans**: 4 plans

- [x] 236-01-PLAN.md - GRAPHDB-01: ownership allowlist (INDEXER_OWNED_NODE_TYPES / INDEXER_OWNED_EDGE_TYPES) + scoped rebuild DELETE, shared phase fixture, survival test observed RED before the fix. Also closed a second unscoped-wipe site found mid-collision in `scripts/build-ecosystem-graph.cjs`. Completed 2026-07-29 (commits `b3932c23`, `2f304995`, `28ad709b`, `10ee83c2`).
- [x] 236-02-PLAN.md - GRAPHDB-01: default runDeriveBackfill survival, crash-mid-transaction atomicity, and out-of-process WAL concurrent-reader visibility proven by observation. Zero production source modified: all three tests PIN existing correct behavior so a future edit cannot silently remove it. Crash seam that worked: replacing a seeded `.md` with a DIRECTORY of the same name (rebuildGraph's section walk uses a plain readdirSync, so it passes the extension filter, and `_readArtifactContent`'s bare readFileSync throws EISDIR from inside the transaction). WAL observation on **v22.23.1**, journal_mode=wal, 600 artifacts, ~150ms rebuild, **4480 samples / 4148 strictly in-window / 0 failed reads / exactly 2 distinct snapshots**; the wrap-removal mutation took it to **594** distinct snapshots with a first offender showing every Artifact and Section row gone. All 3 mutations demonstrated in both directions, each turning exactly its predicted scenarios red. `bash tests/run-all-236.sh` GREEN at **PASS=11 FAIL=0**. Completed 2026-07-29 (commits `d64a7e30`, `ef01277f`, `674f07ac`).
- [x] 236-03-PLAN.md - GRAPHDB-02: behavioral probe of the real thrown-error shapes, then RoomDbBusyError / RoomDbBrokenError at the openRoomDb chokepoint, plus the openRoomDb call-site census. Probe settled that `errcode` is the ONLY discriminator (busy=5, mid-migration=1, notadb=26, corrupt=11) and that "genuinely absent" is NOT a failure mode (mkdirSync creates the file, so an absent room opens successfully). Census measured 40 non-test call sites, not the estimated 25+: 1 FIXED, 4 IMPROVED-FOR-FREE, 35 CANDIDATE. Completed 2026-07-29 (commits `1de288e1`, `53d96af6`, `700f9008`). **FOLLOW-UP FILED, not a 236-03 regression:** a second demonstrated swallow-to-null site at `lib/core/graph-refine-loop.cjs:112` (identical `catch (_e) { db = null; }` pattern to the fixed `graph-derivation.cjs:254-257` site) was in the CANDIDATE bucket, not fixed inline; queued for immediate follow-up in this same session per the navigator's e2e-completion directive.
- [x] 236-04-PLAN.md - GRAPHDB-03: engines.node floor corrected to >=22.16.0 (the real `timeout`-option floor, not the lower >=22.13.0 module-unflagging floor) with a lockstep sweep, plus tests/run-all-236.sh with a self-tested unscoped-DELETE regression gate. Ten-file floor census with a written disposition each (4 CHANGED including the tenth file found live, `.planning/research/STACK.md`, the sentinel source behind CLAUDE.md's row; 1 ADDED; 4 REVIEWED-NO-CHANGE; 1 NOT-TOUCHED), no unclassified survivor. All 7 floor-test mutations and all 4 runner proofs demonstrated live, including empty-discovery exiting 1. `bash tests/run-all-236.sh` GREEN at PASS=8 FAIL=0 (236-02's 3 tests not yet on disk). Completed 2026-07-29 (commits `bd00e9bb`, `5d0c1b0d`, `6289efdc`).

### Phase 237: Reach Mechanism

**Goal**: The reach loop's approval actually reaches execution: an approved chain step runs its resolved command, one authority decides what is material vs autonomous_safe, and a session's reach reflects only that session's own signals.
**Depends on**: Phase 235 (CIRS is the posture-index source; the seam-liveness helper proves the approve-to-execute seam live)
**Requirements**: REACH-01, REACH-02, REACH-03
**Success Criteria** (what must be TRUE):

  1. On a seeded room, approving the Decision Gate for a material chain step causes that step's actual resolved command to run -- its output artifact exists afterward and the chain trace records real execution, not only a log line; a mutation restoring log-only execution turns the gate red. The decorative per-step `decide()` call is removed in the same change, proven by a call-site census.
  2. `framework_run` and `chain_run` produce identical material-vs-autonomous_safe classifications over the full command registry through ONE shared authority module -- a parity gate walks every registered command through both entry points and fails on any disagreement or on reintroduction of a second classification path.
  3. With two concurrent sessions live on one machine (two-process test), a candidate reach in session B reflects only B's own turn signals: a stale marker seeded by session A never surfaces in B's reach; removing the session scoping turns that leg red.

**Plans**: 8 plans in 4 waves
Plans:
**Wave 1**

- [x] 237-01-PLAN.md - Wave 1. SKIP-safe `tests/run-all-237.sh` aggregator authored before any code lands, plus the Part 8 local-only and em-dash hard floors.
- [x] 237-02-PLAN.md - Wave 1. REACH-02: delete `chain.cjs`'s private connector-posture classifier, ride `recipe-maps.postureForCommand`, full-registry parity gate plus a structural one-authority source fence, and the `test-198-chain-run-halt` retarget in the same commit.
- [x] 237-03-PLAN.md - Wave 1. REACH-01 leg A: remove the decorative `decide()` default from `chain-executor.cjs` while keeping the `opts.decideFn` seam `act-command.cjs` uses correctly, proven by a call-site census.
- [x] 237-04-PLAN.md - Wave 1. REACH-03 reader: session-scope `deriveTurnSignals` and `sensorArtifactFiled` through one shared fail-open ownership helper, proven by a two-process `fork` fence plus four degrade legs.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 237-05-PLAN.md - Wave 2. REACH-01: emit an explicit `executable` join in the generated command registry (the closed build-time allowlist), populated on `/mos:snapshot`, with a seam-liveness gate over every claim.
- [x] 237-06-PLAN.md - Wave 2. REACH-03 writers: stamp `session_id` on both marker writers, threading it through the fingerprint hook to the detached auto-explore spawn.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 237-07-PLAN.md - Wave 3. REACH-01: build `lib/core/chain-step-dispatcher.cjs`, the two-tier executor that genuinely spawns script-backed steps and honestly refuses prompt-backed ones with quality null.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 237-08-PLAN.md - Wave 4. REACH-01: wire the dispatcher as `chain_run`'s `onStep` default, delete the log-only stub, prove approve-to-execute end to end with an artifact on disk, and file the phase findings.

### Phase 238: Decision Gates

**Goal**: Decision Gates keep their word end to end: a gate resolves through the same ledger that minted it, ratification validates the answer against the card, concurrent sessions cannot cross-consume, and the card-fire backstop stops punishing ordinary prose.
**Depends on**: Phase 235 (shared seam-liveness helper proves the mint-to-ratifier seam live)
**Requirements**: GATE-01, GATE-03, GATE-04
**Success Criteria** (what must be TRUE):

  1. Answering a chain's halt gate end-to-end resolves through the SAME ledger entry that minted it (mint id equals ratified id, asserted on a real chain run), and a `gate_answer` whose `chosen` is not among the card's actual options is rejected before ratification; bypassing the options validation turns the gate red.
  2. Two concurrent sessions minting and answering gates never consume each other's cards (two-process fence), and the retry-counter file survives N parallel writers with no torn write (atomic-write fence on the proven Phase 87-02 concurrency-fence pattern).
  3. `check-card-fire.cjs` run over a committed fixture corpus built from this session's eight logged over-enforcement instances (citation/footnote markers in prose) produces ZERO false fires, while a genuine unrendered-card fixture still fires red -- the corpus pins the tuning so it cannot silently regress in either direction.

**Plans**: 8 plans across 3 waves

Wave 1 (no dependencies, fully parallel):

- [x] 238-01-PLAN.md - Wave 1. Validation scaffolding: tests/run-all-238.sh with all nine legs pre-declared via run_if, the shared hermetic MINDRIAN_HOME + CARD_FIRE_SIDECHANNEL_PATH helper, and the forked-child worker for the GATE-03 concurrency proof.
- [x] 238-02-PLAN.md - Wave 1. GATE-01/GATE-03: build lib/mcp/gate-ledger.cjs (one session-keyed, single-use, TTL-bounded ledger with a process-scoped no-session sentinel) and lift validateChosenAgainstCard into an export on gate-render.cjs.
- [x] 238-07-PLAN.md - Wave 1. GATE-04: build the sanitized two-half fixture corpus and the table-driven corpus test, observed RED on the must-not-fire half before any classifier change.

Wave 2 (blocked on Wave 1):

- [x] 238-03-PLAN.md - Wave 2. GATE-01 G-1/G-2 gate side: re-point gate_render and gate_answer onto the shared ledger, reject an out-of-card chosen before any DB open, fix the lying tool description.
- [x] 238-04-PLAN.md - Wave 2. GATE-01 G-1/G-2 chain side: re-point the resume ledger, carry the rendered card in the mint payload, make the resume path read chosen and enforce the session before the halted step can run.
- [x] 238-05-PLAN.md - Wave 2. GATE-03 half B: bounded-wait write-lock fence plus atomic tmp-and-rename on the retry counters, proven by a 20-forked-process exact-count test.

Wave 3 (blocked on Wave 2):

- [x] 238-06-PLAN.md - Wave 3. GATE-01 SC1 end to end: prove mint id equals ratified id across the two tool modules, and give checkMintRatifierLiveness a production consumer wired into verify-release as section 18.
- [x] 238-08-PLAN.md - Wave 3. GATE-04 remedy: gate the backstop intercept on side-channel corroboration where the side channel is healthy, keep the last-resort arm where it is blind, turn the corpus green, and re-scope the open card-fire RCA honestly.

### Phase 239: Brain-Access Surface

**Goal**: The Part-8 boundary's enforcement matches its doctrine: the egress guard and PII sanitizer cover the live Brain tool names and the `query()` door user content actually walks through, and the unused `sendPacket` door gets an explicit fate instead of silent limbo.
**Depends on**: Phase 235 (soft: reuses the seam-liveness helper for the hook-matcher liveness proof; no other blocker)
**Requirements**: BRAIN-01, BRAIN-02, BRAIN-03
**Success Criteria** (what must be TRUE):

  1. The seam-liveness helper, run over the Part-8 egress guard and PII sanitizer hook matchers against the LIVE enumerated Brain tool names, comes back green -- and a mutation renaming one live tool (or staling one matcher) turns it red, proving the liveness check is load-bearing and the B-1 dead-matcher shape cannot silently recur.
  2. A canary token typed into an opportunity field and into a Blue Hat note, driven through the real `query()` path against a captured mock transport, is inspected and caught by the egress guard BEFORE the wire -- the capture shows the sanitized payload; removing the `query()` coverage turns the gate red. The guard no longer covers only the unused `sendPacket` door.
  3. `sendPacket`'s fate is decided explicitly and recorded: either it is wired to at least one real job with an end-to-end proof on a seeded room, or it is parked with a dated note at the call surface and in docs -- either way a written decision exists (BRAIN-03 is a decision, not a bug fix).

**Plans**: 7 plans, 4 waves

Wave 1:

- [x] 239-01-PLAN.md - Wave 1. Validation scaffolding: the SKIP-safe run-all-239.sh aggregator with two anti-vacuity legs authored RED, plus the SSE-shaped Brain capture server extracted out of test-brain-client-params.cjs into a shared helper.

Wave 2 (blocked on Wave 1):

- [x] 239-02-PLAN.md - Wave 2. BRAIN-01 core: one exported BRAIN_TOOL_MATCHER consumed by both hooks.json matchers and the anchored isBrainTool re-check, with the superseded dead-name assertions inverted rather than deleted.
- [x] 239-05-PLAN.md - Wave 2. BRAIN-02: raw-field classify-first guard in hatAwareRecommend and suggestValidationSteps, strictly upstream of sanitizeCypherInput and of template interpolation, plus a labelled query() backstop.

Wave 3 (blocked on Wave 2):

- [x] 239-03-PLAN.md - Wave 3. BRAIN-01 liveness gate: check-brain-tool-liveness.cjs enumerating live tool names by a real stdio tools/list handshake, with the zero-match-matcher anti-vacuity rule the shipped seam helper alone would have missed.
- [x] 239-06-PLAN.md - Wave 3. BRAIN-03: sendPacket parked with a dated note at the call surface and in docs, the two contradictory in-repo claims reconciled, and the zero-caller census machine-checked.

Wave 4 (blocked on Wave 3):

- [x] 239-04-PLAN.md - Wave 4. BRAIN-01 inbound half plus census: the PostToolUse PII sanitizer proven to fire on live names, and every remaining dead mcp__brain_ literal swept out of tracked source.
- [x] 239-07-PLAN.md - Wave 4. T1 mitigation: the liveness gate wired into scripts/verify-release as a new numbered section, proven to block by mutating the real tree and observing the real release gate go red.

### Phase 240: Memory

**Goal**: Cross-session memory actually accumulates: Layer 2 JTBD promotion fires on real continuous work, the graph-edge dead-letter queue drains into the memory cortex, and the test suite can never write into a user's live store.
**Depends on**: Phase 236 (HARD -- explicit REQUIREMENTS.md dependency: promotions route into memory-cortex tables that `rebuildGraph` currently truncates; landing this before 236 would convert a quiet loss into a permanent one. Do NOT schedule as parallel-independent.)
**Requirements**: MEM-01, MEM-02, MEM-03
**Success Criteria** (what must be TRUE):

  1. A real multi-turn session of continuous same-topic work against a seeded room produces a Layer 2 JTBD promotion row via a turn-count trigger decoupled from `setCurrent`'s topic-change gate (not only on topic changes), on the DEFAULT operator mode (the `JUST_TALK` 0.8-threshold deadlock closed as part of this phase, since SC1 is untestable on a fresh room otherwise), and the manual-override path persists exactly the fields its own gate later checks (write-then-read round-trip); a mutation restoring the topic-change-only trigger turns the gate red.
  2. Seeded `graph-edge-pending.log`-shaped promote/park/complete events are consumed into `memory_event` rows through the Phase 150 memory cortex (already landed pre-phase via `logGraphTransition`, confirmed live against HEAD), and the promoted rows SURVIVE a subsequent `rebuildGraph` -- riding Phase 236's transaction wrap, which is the reason for the hard dependency (folds in the `graph-edge-pending-undrained-dead-letter-queue` debug session). REVISED 2026-07-30 (240-RESEARCH.md finding + navigator ruling): the original "pending log shrinks accordingly" clause is DROPPED -- `graph-edge-pending.log`/`writeGraphEdge` are already deleted from the codebase (commit `3c9afa2e`, pre-dating this phase), so nothing reads or writes that file by design; the RCA's Option A (a real drainer for a file the design abandoned) was deliberately rejected and stays rejected. The already-accumulated ~2 months of historical log entries are left as documented dead history, not backfilled.
  3. Running the full JTBD test suite leaves the user's live memory store byte-identical (hashed before and after, over the WHOLE `.memory/` tree, not just `jtbd-history.json` -- the 240-RESEARCH.md census found `tests/test-jtbd-auto-anchor-empirical.sh`'s cleanup trap misses 3 of 9 paths it creates, which is exactly why a narrower hash would read clean while `audit.log` stays polluted), and a deliberately seeded non-hermetic fixture turns the fence red -- hermeticity is enforced by a gate, not by habit.

**Plans**: 6 plans, 4 waves

- [x] 240-01-PLAN.md - Wave 1 (MEM-01/02/03): the tests/run-all-240.sh glob-discovery aggregator in the run-all-236.sh shape with a load-bearing `found -eq 0` guard, plus the Tri-Polar daemon-parity gate (lib/mcp/ carries no divergent JTBD trigger copy) with a must_catch self-test and a non-vacuity floor, closing 240-RESEARCH.md A7/Q4 as a standing check rather than a re-investigation task.
- [x] 240-02-PLAN.md - Wave 1 (MEM-03): tests/test-jtbd-auto-anchor-empirical.sh made structurally hermetic on an owned `mktemp -d` root (the 47-line Python cleanup trap that missed 3 of 9 paths collapses to one guarded `rm -rf`), tests/test-jtbd-hook-integration.cjs sandboxed PRE-EMPTIVELY because MEM-01's fix would newly turn 7 of its 9 classes into leakers, and the tests/test-240-memory-store-hermetic-fence.sh recursive whole-tree hash fence with a sandboxed-HOME must_catch/must_not_catch pair.
- [x] 240-03-PLAN.md - Wave 2 (MEM-01): the WRITE half of the deadlock. lib/hmi/jtbd-state.cjs persists `turn_count` and `manual_set` onto `newCurrent` and gains a narrow exported `bumpTurnCount(roomDir, expectedJtbd)`; the promotion gate's double string mismatch is reconciled ('manual_set' as well as 'manual'); proven by a round-trip test that never hand-constructs a `current` object, plus three executed mutations.
- [x] 240-04-PLAN.md - Wave 3 (MEM-01): the REACHABILITY half. scripts/jtbd-update.cjs's unconditional early return becomes a named `transitioned` boolean with `setCurrent` and the SENS-05 reweight kept behind it (Pitfall 3), and a `bumpTurnCount` tick on the non-transition branch. SC1 proven end to end through the real hook with an operator-affinity seed (D-3: test-side, both threshold files stay untouched), a non-vacuity classification guard demonstrated in BOTH directions, a write-volume bound, and a confirmed pre-fix red.
- [x] 240-05-PLAN.md - Wave 3 (MEM-02): tests/test-240-jtbd-event-survives-rebuild.cjs, the test that JOINS the promote path to the rebuild-survival path (nothing joins them today). Reuses tests/helpers/fixture-room-236.cjs, closes the registry / dedupe / hand-fed-state traps, and proves the CORRECT mutation (add 'memory_event' to INDEXER_OWNED_NODE_TYPES) reddens while recording the WRONG one (removing the transaction wrap) staying green. No drainer, per locked decision D-1.
- [x] 240-06-PLAN.md - Wave 4 (MEM-01/02/03): close-out. The .planning/phases/240-memory/deferred-items.md residual register (10 items, each with a resolving citation), the mandated Dev-Research Compositing filing into ~/MindrianRooms/rethinking-mindrianos/research/2026-07-30-phase-240-memory/ cross-linked both ways, the executed phase gate with every result recorded against its expected value, an em-dash sweep, and a read-only live-store final audit proving the three real-store files the research measured are byte-unchanged by the whole phase.

**Planner note (2026-07-30), a leak that does not exist yet and will exist the moment MEM-01 lands. This is why MEM-03 is Wave 1 and MEM-01 is Wave 2, inverting 240-VALIDATION.md's provisional wave numbers.** 240-RESEARCH.md's hermeticity census measured 16 suites against CURRENT, BROKEN code and found exactly one leaker. But `tests/test-jtbd-hook-integration.cjs` reads hermetic today ONLY because `promoteIfEligible` always returns null at the turn gate (`across-session-memory.cjs:398`) before reaching `atomicUpdateMemory` (`:403`). Verified at planning time: its `runHook` helper builds the child env as `Object.assign({}, process.env, env)` with no `MINDRIAN_ROOMS_HOME`, and the variable appears in exactly ONE place in that file (class 5's deliberate fake path), so 7 of its 9 classes drive the real hook against the REAL `~/MindrianRooms`. Class 8 alone fires the same message 10 consecutive times. Once 240-03 makes `turn_count` grow and 240-04 makes the promotion block reachable, class 8's third turn crosses `NOISE_FLOOR_TURNS = 3` and writes a real `jtbd-history.json` plus an `audit.log` line on the developer's machine. Fixing MEM-01 CREATES a leak, covering it is inside MEM-03's requirement text ("The JTBD test suite cannot write into the user's live memory store"), and the sandbox must therefore land BEFORE the trigger fix. Plan 240-04 Task 3 executes the mutation proving that sandbox is load-bearing, which 240-02 Task 2 honestly records as deferred because it cannot be reddened until MEM-01 lands.

**Planner note (2026-07-30), MEM-02 writes zero production code and that is the deliverable.** Re-verified against HEAD at planning time, not against the RCA text: repo-wide grep for `writeGraphEdge` and `GRAPH_EDGE_LOG` returns zero hits outside `.planning/`; `INDEXER_OWNED_NODE_TYPES` at `lib/core/lazygraph-ops.cjs:81` is `Object.freeze(['Artifact', 'Section'])` with `memory_event` absent; `rebuildGraph`'s BEGIN/COMMIT/ROLLBACK sit at `:668`/`:743`/`:745`; `grep -rln 'jtbd' lib/mcp/` returns zero. So SC2's behavior is already true and what the phase owes is the regression gate that pins it, the same shape as Phase 236 Plan 02 which also changed no production source. The mutation wording is load-bearing: `tests/test-236-rebuild-preserves-journal.cjs:24-32` and STATE.md's Phase 236 Plan 02 record both prove that removing the transaction wrap leaves survival GREEN, because the scoped DELETE is what protects the rows. A plan that words its mutation from SC2's own "riding Phase 236's transaction wrap" prose ships green with the bug intact, so plan 240-05 runs the wrong mutation deliberately and records its inertness in the test file's own header.

### Phase 240.1: Context-Layer Drift Detection

**Goal**: Three related gaps found live this session while STATE.md was mid-write from two concurrent sessions, all informed by MotherDuck's Guides research (Bev Turnbaugh talk, SF meetup hosted by Uncork Capital; MotherDuck's 2026-07-29 blog post "Context belongs in the warehouse"). REVISED 2026-07-30 (240.1-RESEARCH.md, confidence HIGH on in-repo mechanics): CTXL-01's original wording was ambiguous across TWO different files both loosely called "STATE.md" -- the symptom's `.planning/STATE.md` half is written by `gsd-core`, an EXTERNAL tool this repo does not own, and two prior RCAs already root-caused that class concluding "no code change in this repo." The genuine, fixable, in-repo target is different and worse than the ROADMAP originally described: `scripts/compute-state` generates a PER-ROOM `STATE.md` and blind-overwrites it, DESTROYING the `gsd_state_version` stamp that `scripts/room-registry` seeds at room birth -- empirically reproduced this session. (1) `scripts/compute-state`'s per-room regeneration has no schema-drift versioning or notification, and actively erases the version stamp that already exists upstream of it; (2) room.db's graph and BRAIN.md conflate the SEMANTIC layer (schema/joins/structure) and the CONTEXT layer (business-term definitions, institutional knowledge, exceptions) the same way the industry has historically done -- but the distinction ALREADY EXISTS OPERATIONALLY: Phase 236's `INDEXER_OWNED_NODE_TYPES` allowlist is precisely the "derivable structure, safe to wipe" vs. "irreplaceable institutional knowledge" line; this requirement is to NAME what the code already does, not build new structure -- no room.db schema change needed; (3) MindrianOS has no equivalent gate measuring whether room context actually improves Larry's answer accuracy, but this is NOT a new pattern for the repo -- `scripts/huji-eval.cjs` (Phase 229) and `scripts/skillopt-eval.cjs` (Phase 230) already ship the same two-layer eval architecture (judge calibration, graded anchors, a correlation gate, a cost ledger, a before/after comparison); this is a third instance of an existing idiom, not an invention.

**Depends on**: Phase 240 (informational only -- 240 is where the schema-drift symptom was observed, not a structural blocker)
**Requirements**: CTXL-01, CTXL-02, CTXL-03
**Success Criteria** (what must be TRUE):

  1. `scripts/compute-state`'s per-room `STATE.md` regeneration carries a schema version stamp (reusing `lib/core/install-state.cjs::migrateIfNeeded`'s mismatch semantics and `scripts/frontmatter-schema-validator.cjs`'s notification surface -- both already ship in this repo); a regeneration that would overwrite a newer or mismatched version stamp surfaces a notification instead of silently destroying it. Explicitly OUT OF SCOPE: `.planning/STATE.md`'s own drift (that is `gsd-core`, external, already root-caused elsewhere with no in-repo fix available). A mutation reintroducing the blind-overwrite turns the version-preservation gate red.
  2. room.db's graph schema and BRAIN.md each carry an explicit, documented SEMANTIC-vs-CONTEXT layer distinction naming `INDEXER_OWNED_NODE_TYPES` as the concrete operational boundary already enforcing it (schema/structure vs. business-term/institutional-knowledge) -- a doctrine-presence gate (the `143.2-doctrine-presence` idiom) asserts both terms are named and distinguished in the relevant docs. No room.db schema or migration change.
  3. A benchmark gate exists measuring whether room context measurably improves Larry's answer accuracy on a fixed task set, built as the THIRD instance of the `huji-eval.cjs`/`skillopt-eval.cjs` two-layer idiom (judge calibration, graded anchors, correlation gate, cost ledger, before/after comparison) -- not a new eval architecture. VERIFIED 2026-07-30 (was source-material confidence LOW at research time; now confirmed against the primary source and filed per Dev-Research Compositing at `rethinking-mindrianos/research/2026-07-30-motherduck-context-layer/`): MotherDuck's `motherduck.com/blog/context-belongs-in-the-warehouse` (2026-07-29) confirms the exact +72pp accuracy / -55% cost-per-run DABStep figures, plus a second corroborating post (`oops-maybe-we-do-need-semantic-layers`) showing an A/B result where baking domain knowledge INTO the warehouse capped at 93% accuracy while moving it to a separate curated layer hit 100% -- a stronger, falsifiable version of the same semantic/context split CTXL-02 names. If no accuracy delta is measurable at MindrianOS's scale, that is itself the finding to record, not a reason to skip the gate.

**Plans**: 7 plans, 3 waves

- [x] 240.1-01-PLAN.md - Wave 1: the `tests/run-all-2401.sh` glob-discovery aggregator authored RED-first, with a glob-discipline self-test proving it cannot mistake Phase 240's four `test-240-*` files for 240.1 coverage, plus a scope-escape tripwire that turns the locked CTXL-01 target decision into a standing machine check.
- [x] 240.1-02-PLAN.md - Wave 1 (CTXL-01): `lib/core/state-version.cjs`, the preserve-or-notify module ported from `install-state.cjs::migrateIfNeeded`'s four-branch contract; write site 1 wired in `state-ops.cjs` (plus its literal em-dash and its measurably false "single Node chokepoint" comment); four keys this repo's own writers emit added to the `'STATE.md'` frontmatter schema (Canon Part 6).
- [x] 240.1-03-PLAN.md - Wave 2 (CTXL-01): `scripts/state-write.cjs` as the bash-to-Node bridge; the three hook write sites and the cascade Step 8 converted, including `on-agent-complete`'s truncating redirect; coverage proven END TO END at real hook sites, since a test that only calls `computeState()` is the documented Pitfall 2 warning sign.
- [x] 240.1-04-PLAN.md - Wave 1 (CTXL-02): the SEMANTIC-vs-CONTEXT layer distinction written into `docs/MWP-SPECIFICATION.md` section 2.8 and `docs/BRAIN-MD-SCHEMA.md` section 5.1, pinned to `INDEXER_OWNED_NODE_TYPES` as the operational boundary Phase 236 already had to discover the hard way; fenced by a heading-anchored doctrine-presence gate that cannot pass vacuously on the bare words "semantic" and "context".
- [x] 240.1-05-PLAN.md - Wave 1 (CTXL-03): `tests/helpers/fixture-room-2401.cjs` plus the fixed local task set at `tests/fixtures/240.1-ctxl-tasks.json`, every task grounded in a verbatim on-disk string and proven to discriminate (its grounding string absent from its own question).
- [x] 240.1-06-PLAN.md - Wave 2 (CTXL-03): `scripts/ctxl-eval.cjs`, the third instance of the `huji-eval.cjs`/`skillopt-eval.cjs` two-layer idiom; six deterministic checks at zero API spend plus an opt-in `CTXL_EVAL_LIVE` A/B leg that skips cleanly. A null or negative delta is a recorded PASS with a finding, never a FAIL and never a skip.
- [x] 240.1-07-PLAN.md - Wave 3: the phase residual register (8 items, led by the explicit record that the `.planning/STATE.md` half is NOT fixed, citing both existing RCAs), the `room-birth.cjs` node-on-a-bash-script RCA, Dev-Research Compositing, and the full phase gate.

**Planner corrections to the research census (measured on disk 2026-07-30, HEAD `3d8aa34a`):** the six-site write census in `240.1-RESEARCH.md` is incomplete in three ways that change the design. (1) `scripts/room-registry:190-280`'s `_write_current_room()` is a SEVENTH STATE.md writer and it already PRESERVES every sibling key; `lib/memory/statusline-active-room-write.test.cjs` (7/7 green at planning time, registered in `run-feynman-tests.cjs:926`) already asserts `gsd_state_version` and `status` survive it. It is prior art, not a defect, and that suite is the mandatory regression fence for CTXL-01. (2) `PRESERVED_KEYS` must NOT include `current_room`: `scripts/compute-state:29-45` deliberately re-derives it from the registry and emits it only for the registry-active room, so preserving it would resurrect a stale active-room marker on every parked room and break the no-backfill contract that same suite pins. (3) Two more absent-guarded seeders exist, `scripts/vault-import.cjs:143-158` and `lib/core/room-skeleton-scaffold.cjs:300-310` (the latter writing a template that carries no stamp at all); both are REVIEWED-NO-CHANGE.

### Phase 241: Feynman-MINTO

**Goal**: The reasoning layer's guardian is heard and its repair ladder is reachable: on-stop findings reach the user, slow writes land instead of being timeout-dropped, the severity ladder triggers on the breaches navigators actually hit, and the dead loop stops taxing commits.
**Depends on**: Nothing hard (scheduled after Wave 1 per the audit's leverage-first sequencing; folds in the filed `minto-debounce-consumer-dead-end` RCA, F-0 already open)
**Requirements**: MINTO-01, MINTO-02
**Success Criteria** (what must be TRUE):

  1. With a seeded triple-health violation, the guardian's on-stop output reaches the user-visible surface (not `/dev/null`), and an injected slow report-write (over the old 1-second budget) still lands on disk along with its ghost-pruning -- the timeout can no longer silently drop either; restoring the drop turns the gate red.
  2. A room seeded with the two breaches navigators actually hit -- a missing MINTO.md and a missing `governing_thought` -- observably triggers the critical-repair severity ladder (repair or escalation recorded), where before only two rare crash artifacts could reach it.
  3. Until the repair loop is live, the same seeded breach at pre-commit produces a WARN and the commit succeeds -- demonstrated by a real commit run -- so pre-commit friction from the dead loop is demoted rather than silently retained (F-3 folds in).

**Plans**: 5 plans, 4 waves

- [x] 241-01-PLAN.md - F-1 (MINTO-01): runOnStop gets a soft walk budget so its report write and ghost prune always land; scripts/on-stop captures the guardian's systemMessage and folds it into the final Stop-hook JSON; both SC1 legs get their own test and mutation proof.
- [x] 241-02-PLAN.md - F-0 (MINTO-01): both stop-path olderThanMs 0 vacuums retired for a read-only peek census; production call-site census (walks extensionless files) plus the full enqueue-to-prompt-drain-to-regen cycle; the minto-debounce-consumer-dead-end RCA corrected and resolved.
- [x] 241-03-PLAN.md - F-2 (MINTO-02): missing MINTO.md and missing governing_thought raised to critical so they reach the enqueue gate; pre-existing suites reconciled per Pitfall 5; both legs assert a real minto-queue.json entry.
- [x] 241-04-PLAN.md - F-3 (MINTO-02): runPreCommit demoted to an advisory WARN with a --strict / MINTO_PRECOMMIT_STRICT opt-in (Phase 210 idiom); proven by a REAL git commit in both directions, with the pre-commit hook script untouched so Phase 235 cannot collide.
- [x] 241-05-PLAN.md - Tri-Polar parity + close-out (MINTO-01, MINTO-02): the shared mindrian-core Stop path runs the guardian too (Desktop, Cowork, and CLI under MINDRIAN_MCP_FIRST were all blind); parity test; tests/run-all-241.sh harness with permanent regression tripwires; Dev-Research Compositing filing.

**Planner note (2026-07-28), F-0's premise corrected against the working tree**: the filed RCA concluded the debounce consumer "was never wired" on the strength of a grep against `scripts/intent-classifier.cjs`. The UserPromptSubmit hook registered in `hooks/hooks.json` is `scripts/intent-classifier`, an extensionless BASH wrapper, which has carried a live Phase 88-05 drain-and-act block since Phase 88 (drains at olderThanMs 30000, appends to pending-tier1-regen.json, spawns vault-section-minto-generator.cjs --write) and is covered by 7 registered tests. The consumer exists and acts. What survives from the RCA is its paired minimal piece, which plan 241-02 implements: stop the unconditional vacuum at both stop-path drains. No second consumer is wired into the .cjs (Canon Part 7, and two drains would race).

### Phase 242: The Moat

**Goal**: The scoring layer that IS the moat cannot be zeroed by a crash, and the PR checklist asserts reality by machine instead of warning about a database that no longer exists.
**Depends on**: Nothing hard (soft: reuses Phase 236's crash-injection + transaction-wrap proof pattern -- MW-1/MW-2/MW-3 are the same root cause as GRAPHDB-01)
**Requirements**: MOAT-01, MOAT-02
**Success Criteria** (what must be TRUE):

  1. A crash injected mid HSI-to-graph edge rewrite on a seeded, already-scored room leaves the prior scoring layer fully intact on reopen (never zeroed), and a concurrent reader during a live rewrite never observes an empty scoring layer; removing the transaction wrap turns the gate red.
  2. The PR checklist's KuzuDB warning prose is gone, replaced by a machine-checked assertion that fails when a kuzu reference re-enters the tree and passes on the current tree -- proven by seeding one kuzu reference and watching it fail (MOAT-02 is a light doc fix per the audit's rethink verdict, no RCA cycle).

**Plans**: 2 plans (both Wave 1, no interdependency, zero shared files)

- [x] 242-01-PLAN.md - MOAT-01: wrap the hsi-to-graph DELETE-then-rewrite in one BEGIN/COMMIT/ROLLBACK, add the production-inert MINDRIAN_HSI_CRASH_TEST_DELAY_MS crash seam, and prove it with a three-leg test (spawn+SIGKILL crash injection, fork()'d concurrent reader, mutation proof) plus the tests/run-all-242.sh aggregator. (completed 2026-07-28)
- [x] 242-02-PLAN.md - MOAT-02: build scripts/check-kuzu-reintroduction.cjs (dependency-manifest + live require/import scan, exit 0/1/2), wire it into scripts/verify-release as section 17, replace the dead docs/MOAT-MANDATE.md line 96 prose with a same-polarity machine-checked warning sign, and fence it with a hermetic seeded-fixture test. (completed 2026-07-28)

**Planner resolutions (recorded 2026-07-28 so the two phases can be diffed before execution):** the shared `withTransaction` helper extraction is DECLINED for this phase, so Phase 242 touches NO file under `lib/` and its file set is provably disjoint from Phase 236's `lib/core/lazygraph-ops.cjs` work. The kuzu gate lands in `scripts/verify-release` only, not `scripts/doctor.cjs`. The crash seam is `MINDRIAN_HSI_CRASH_TEST_DELAY_MS`.

### Phase 243: Voice-Glyph

**Goal**: The De Stijl voice-glyph header tells the truth: the statusline's "who is speaking" signal reflects the glyph a turn actually opened with, and the remaining voice-signature findings ride the existing open RCA instead of spawning a new one.
**Depends on**: Nothing hard (scheduled last; smallest blast radius)
**Requirements**: GLYPH-01
**Success Criteria** (what must be TRUE):

  1. Across a fixture set covering the glyph vocabulary, a turn opened with glyph X renders glyph X in the statusline, and a turn that opened with NO glyph renders the honest empty/unknown state -- the fabricated default painted over by the stance color cannot be reproduced; a mutation restoring the fabricated default turns the gate red.
  2. V-2 and V-3 are routed into the existing open `voice-signature-dark-runtime.md` RCA as cross-referenced entries (no new RCA file created), verifiable by reading that RCA.

**Plans**: 2 plans

- [x] 243-01-PLAN.md - SC1: delete the stance-default glyph fabrication at lib/statusline/cockpit-renderer.cjs (superseding the second half of Phase 210 item B), INVERT the three superseded assertions in tests/test-voice-glyph-advisory.cjs and tests/test-192-statusline-stance-chip.cjs, add the 18-row honest-glyph fixture suite plus tests/run-all-243.sh, and PROVE the mutation gate bites by executing it.
- [x] 243-02-PLAN.md - SC2: author .planning/debug/voice-signature-dark-runtime.md (the RCA six documents cite and that has never existed on disk or in git history) carrying V-1 as resolved-history, V-2/V-3/the who-default conflict/the permanent-dark residual as open cross-referenced findings, gated by a structure-only doc-presence test.

## Progress

**Release train (navigator directive 2026-07-28 -- gates RELEASE CUTS, not planning/code work):**

- **Gate 0 -- official v1.15.0 close-out FIRST:** finalize the v1.15.3-beta.x train to the stable v1.15.x release (`release.sh --finalize` flow: npm @latest, tag, marketplace pin, full lockstep per the release hard rules), closing Phase 234 as the last v1.15.0 phase. Per the standing rule (`feedback_dev_repo_fix_not_live_until_released`), v1.15.0 is not "shipped" until this release actually cuts and is picked up.
- **Then v1.16.0 betas:** all v1.16.0 phase work releases as `v1.16.0-beta.N` prereleases (`release.sh --start-prerelease` to open the train); v1.16.0 finalizes to stable only when all 9 phases close. No v1.16.0 release cut before Gate 0.

**Execution order (dependency waves):**

- **Wave 1 (parallel):** Phase 235 (leverage point) + Phase 236 (urgent data-loss)
- **Wave 2 (after 235):** Phases 237, 238, 239 -- **(after 236):** Phase 240 (HARD dependency, never parallel-independent of 236)
- **Wave 3:** Phases 241, 242, 243 (no hard dependencies; 242 reuses 236's proof pattern)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 235. CIRS Commit Gate + Seam-Liveness Helper | 2/2 | Complete   | 2026-07-28 |
| 236. room.db Data-Loss Fixes | 4/4 | Complete   | 2026-07-29 |
| 237. Reach Mechanism | 8/8 | Complete   | 2026-07-29 |
| 238. Decision Gates | 8/8 | Complete    | 2026-07-29 |
| 239. Brain-Access Surface | 7/7 | Complete   | 2026-07-30 |
| 240. Memory | 6/6 | Complete   | 2026-07-30 |
| 241. Feynman-MINTO | 5/5 | Complete   | 2026-07-28 |
| 242. The Moat | 2/2 | Complete   | 2026-07-28 |
| 243. Voice-Glyph | 2/2 | Complete    | 2026-07-28 |

**Coverage:** 23/23 v1.16.0 requirements mapped (CIRS-01..03, GRAPHDB-01..03, REACH-01..03, GATE-01/03/04, BRAIN-01..03, MEM-01..03, MINTO-01..02, MOAT-01..02, GLYPH-01). No orphans, no duplicates. Full mapping in `.planning/REQUIREMENTS.md` Traceability.

## Next Milestone (slot REGISTERED 2026-07-28, navigator decision): v1.17.0 "MCP-First" (ships on the beta train, v1.17.0-beta.x)

Navigator locked this slot mid-roadmap-session ("lets plan it for 1.17.beta"): the MCP-first system is the milestone immediately after v1.16.0. NOT scoped into this file's phases (v1.16.0 stays remediation-only); registered here so the slot cannot be claimed by another feature.

- **Scope anchor:** `.planning/phases/198-mcp-first-then-sdk/` (Phase 198, un-parked 2026-07-09; stack locked oclif + Ink + MCP SDK; 3 servers split by trust boundary) plus PROJECT.md Platform Vision Workstream B (23-tool MCP server) as candidate scope.
- **Why after v1.16.0, not inside it:** the live MCP tool surface (`lib/mcp/tools/`: chain.cjs, gate.cjs, sensors.cjs, graph.cjs, room.cjs, status.cjs, stop-gate.cjs, views.cjs) is exactly where the audit found wired-at-one-end seams. v1.17.0 builds on the repaired surface (Phases 237/238/239) and inherits Phase 235's seam-liveness helper, so all three new servers are born-wired with a red-able liveness gate from day one instead of repeating the audit's failure shape at 3x scale.
- **Candidate fold-ins (decide at milestone definition, not here):** MCP Sampling migration for Feynman-MINTO tier-1 (retires the ANTHROPIC_API_KEY requirement; PROJECT.md first-class backlog item), MCP Apps De Stijl surfaces (Workstream C).
- **CARRIED-IN DEFECT (navigator routing, 2026-07-28): the room-resolution ladder is v1.17.0 structural work, not v1.16.0 remediation.** `.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md` (diagnosed, live before/after verified, re-verified byte-identical on `origin/main`). `room_bind`'s session-scoped binding is invisible to EVERY MCP read tool unless `MINDRIAN_MCP_FIRST` covers the calling surface, which is unset by default on every install today; reads fall through to a global registry pointer and then to a boot-time-frozen fallback, and `room_bind` still returns an unqualified `{ok:true, bound:true}` about an effect that will not apply. This is the MCP-first flag's own semantics failing, so it belongs to the MCP-First milestone by subject matter, not to Phase 237's reach-seam repair. Scope when defining v1.17.0: (a) collapse the EIGHT independent copies of the gate-then-fallthrough resolver (the 7 modules in `lib/mcp/tools/` plus `lib/mcp/tool-router.cjs:116-132` `resolveWriteTargetDir`) into one shared resolver, mirroring the `lib/core/resolve-active-room.cjs` precedent that already retired a prior "four guessers" bug class; (b) make an explicit `room_bind` authoritative for the rest of its session regardless of flag state; (c) follow the precedence ladder Phase 234-05 already shipped for the WRITE half in `lib/mcp/mcp-first-flag.cjs` `isWritePathEnabled` (explicit flag wins, then confident host-tier detection, floor to false) rather than inventing a second one - the read path is the unfixed half of a gap whose write half is already closed. **v1.16.0 Phase 237 keeps only the session-scoping acceptance test (REACH-03); it must NOT attempt the resolver collapse.** Operational mitigation available today with no code change: `bash scripts/room-registry set-active <room>`.
- **Trigger:** after v1.16.0 completes, run `/gsd-new-milestone v1.17.0` -- requirements definition happens there, not in this file.

### Phase 244: Semantic Trigger Tier

**Goal**: Natural free-form language reliably fires the right reach candidate. Today's trigger-tier doctrine (Phase 172-07, `lib/core/sensors/sensor-types.cjs`, Canon Part 11 R3) ranks `signal` (explicit state event) and `context` (a LOCAL problem-state enum) above `keyword` (lexicon match, explicitly the FALLBACK tier), and `trigger_tier` itself is DECORATIVE today -- computed once, copied into 2 of 17 sensors' evidence bags, consumed by zero rankers (its own doctrine comment: "Mints NO reach and NO edge -- it is a classifier only", `sensor-types.cjs:72`). REVISED 2026-07-30 (244-RESEARCH.md): the phase is NOT a greenfield build. **The FTS5+bm25 lexical retrieval leg and the Reciprocal Rank Fusion implementation this phase needs already ship in production** -- `lib/core/eureka/tri-modal-index.cjs` owns an `eureka_fts` virtual table + porter-tokenized `bm25()` `lexicalSearch()` (Phase 211-02); `lib/core/eureka/hybrid-retrieve.cjs` owns `rrfFuse(rankedLists, k)`, rank-position based (Phase 219-02). Building either from scratch is a Canon Part 7 violation. **The real gap is wiring, not invention:** nothing calls `lexicalSearch` as a trigger sensor, and the fired-reach path (`dispatchSensors -> decide() -> buildReachList`) never reaches `f-selector-ranker.cjs`'s ranking function at all -- that function ranks `command-registry.json` rows, a disjoint path. This phase adds one new sensor that queries the existing index and mints a candidate reach, wires the index's production lifecycle (it does not exist in any live room today -- verified against `~/MindrianRooms/rethinking-mindrianos/room.db`, 8.4MB, zero `eureka_fts` table), and threads tier-family fusion into the ranker via an optional argument rather than reinventing fusion math.

**Stack constraint, corrected 2026-07-30 (244-RESEARCH.md Finding F-10 -- the original wording below was factually wrong and is preserved struck-through so the correction is traceable, not silently rewritten):** ~~any embedding model, vector index, or remote semantic-router service would introduce server infrastructure this repo does not run, and Canon Part 8 blocks sending raw user turn text to any remote service for embedding~~ -- **both premises are false as applied to a LOCAL vector index.** `sqlite-vec` (`^0.1.9`) and `@huggingface/transformers` (`^4.2.0`) are ALREADY pinned dependencies; `lib/core/eureka/vector-store.cjs` already runs a local embedding store; `hybrid-retrieve.cjs` already runs a local CPU-only cross-encoder rerank (`Xenova/ms-marco-TinyBERT-L-2-v2`, ~4MB, no server, no network). **The real, correct reason to exclude a vector/embedding leg from this specific trigger path is latency budget, not architecture:** loading a transformer model per turn blows the 1200ms NAV budget (`navigation-engine.cjs:820`), and live measurement shows lexical search alone already cleanly separates relevant from irrelevant turns (5 hits vs. 0, zero threshold tuning) -- the vector leg adds cost with no measured benefit here. Still explicitly EXCLUDED from this phase's trigger-path work, for this corrected reason:

  - **A vector/embedding leg on the trigger path** -- latency budget, not a missing capability (it exists elsewhere in this repo already).
  - **KuzuDB, Memgraph, Neo4j** (including Aura community detection) -- KuzuDB retired (Phase 242 MOAT-02 gate), Memgraph never part of this stack, Neo4j Aura is Brain's remote store off-limits to local trigger logic (Canon Part 8/9). This exclusion's original rationale was correct and stands unchanged.
  - **A brand-new npm dependency for lexical search** -- FTS5 ships inside `node:sqlite`; `tri-modal-index.cjs` already uses it. Nothing to add.
  - **Indexing the raw `fragments` table** (conversation transcript) -- verified live: an unfiltered corpus fires on every turn including "what is the weather in paris" (3 spurious hits). The shipped `indexNodes` already excludes it by only reading `nodes`; this is a stated non-goal, not an oversight to "helpfully" fix.

**Depends on**: Nothing new. Soft-depends on the already-shipped Phase 141/142/143/143.1 sensor-and-dial machinery this phase extends in place, and reuses Phase 211-02/219-02's eureka retrieval primitives in place.
**Requirements**: TRIG-01, TRIG-02, TRIG-03
**Success Criteria** (what must be TRUE):

  1. A new sensor mints a candidate reach by querying the ALREADY-SHIPPED `tri-modal-index.lexicalSearch` (FTS5 + `bm25()`, no new index, no embedding call, no network, no new npm dependency) against room.db's curated `nodes` table (never `fragments`, per the corpus-scoping finding above). The `eureka_fts` index's production lifecycle is wired (it does not exist in any live room today) via a lazy build-on-first-miss in the sensor's ctx-assembly producer plus a presence/freshness check added to `node scripts/doctor.cjs --acceptance`, so an unbuilt index is visible rather than silently producing zero fires -- the exact symptom that opened this phase. A turn whose text has no structural state-change signal and misses every existing sensor's keyword list, but has real lexical relevance to a room's stored content, still produces a fired candidate; a mutation removing the `lexicalSearch` call path turns this red.
  2. Cross-family rank fusion is threaded into `lib/workflow/f-selector-ranker.cjs` via an OPTIONAL `o.tierCandidates` argument (absent -> byte-identical no-op, following the exact `sens10`/`role_level` optional-signal idiom already established at that call site), tagging `scored` rows with a `tier_family` field and fusing via the ALREADY-SHIPPED `rrfFuse` (`hybrid-retrieve.cjs`, rank-position based -- confirmed immune to bm25's negative-score sign convention because RRF reads array position, never raw score, and both input lists are already sorted best-first) before the `MAX_K=3` cut. A mutation removing the fusion call turns a same-family-domination regression test red. NAVIGATOR-CONFIRMED 2026-07-30: this widens `rankForSelector`'s documented "pure, registry-only" contract; the alternative (fusing in `buildReachList` where trigger families already coexist) was considered and rejected because it would make SC2's own file/line reference wrong.
  3. The top-3 cut applies a diversity term (MMR-shaped, CORRECTED 2026-07-30 per 244-01/07-PLAN.md -- the original wording here had the Carbonell & Goldstein 1998 lambda inverted: canonical is `lambda*relevance - (1-lambda)*max_similarity_to_selected`, where lambda close to 1 favors relevance and close to 0 favors diversity, named `MMR_LAMBDA_RELEVANCE` in the shipped code) so three near-duplicate same-family candidates cannot crowd out a genuine cross-family hit, following the exact layered-adjustment-pass pattern `_applySens10Flip`/`_applyRoleLevelBias` already establish in this file. The similarity term reuses the ALREADY-SHIPPED `lexicalOverlap` Jaccard primitive (`lib/core/eureka/lexical-overlap.cjs:75`, pure, sync, zero-dep, versioned `jaccard-v1`) rather than a new embedding-based similarity -- not a new architectural concept, the third instance of one already in production, built entirely from existing primitives.

**Plans**: 8 plans in 4 waves (planned 2026-07-30). Wave 1: 244-01. Wave 2: 244-02, 244-03, 244-04 (parallel, zero file overlap). Wave 3: 244-05, 244-06, 244-07 (parallel, zero file overlap). Wave 4: 244-08.

- [x] 244-01-PLAN.md -- Foundation: `tests/run-all-244.sh` gate (RED-first), the `content` tier inserted between `context` and `keyword` plus an `isFallbackTier` allowlist, and `tableExists` promoted to a public export of `tri-modal-index.cjs` so an absent index becomes a distinguishable state. [TRIG-01]
- [x] 244-02-PLAN.md -- Index lifecycle (BLOCKER B-2): new `lib/core/eureka/fts-index-lifecycle.cjs` (`ftsIndexState`, `requestFtsBuild`, `spawnFtsBuildDrain`) plus `scripts/fts-index-drain.cjs`, built as the fourth instance of the shipped enqueue-then-detached-drain pattern (`intelligence-cascade.cjs:357-384` + `gsd-graph-derive-sweep/drain`). [TRIG-01]
- [x] 244-03-PLAN.md -- Ghost-trigger fence (Pitfall 4): one guarded `DELETE FROM eureka_fts WHERE node_id NOT IN (SELECT id FROM nodes)` inside `rebuildGraph`'s existing BEGIN, so a rebuild cannot leave a matchable row pointing at a deleted node. Neither frozen indexer vocabulary is widened. [TRIG-01]
- [x] 244-04-PLAN.md -- RRF fusion seam: optional `o.tierCandidates` on `rankForSelector` (absent = byte-identical no-op), `tier_family` tagging, `_applyTierFusion` calling the shipped `rrfFuse` pre-slice, plus a LIVE production supplier in `orchestration-candidate-lift.cjs` so the seam is not wired at one end. [TRIG-02]
- [x] 244-05-PLAN.md -- SENS-16 `sensor-content-relevance.cjs`, the 3-layer split (pure sensor / ctx-assembly producer / gate action), wired into `decide()`'s sensorCtx block and registered as the 18th sensor. Rides `context_block`, posture `hold`, closed scalars only on the reach. [TRIG-01]
- [ ] 244-06-PLAN.md -- Doctor visibility: `eureka-fts-health-module.cjs` (read-only door, check-only), its `data/doctor-modules.json` registration, and an `eureka-fts-index-visible` `--acceptance` point that reports absence and fails only on staleness. [TRIG-01]
- [x] 244-07-PLAN.md -- MMR diversity pass: `_applyMmrDiversity` between fusion and the cut, reusing the shipped `lexicalOverlap` Jaccard over a prose-free LOCAL projection, canonical Carbonell lambda orientation named `MMR_LAMBDA_RELEVANCE`. [TRIG-03]
- [ ] 244-08-PLAN.md -- Phase close: `docs/ENV-TUNING.md` section for all five new env vars, `244-RESIDUALS.md` (assumptions, non-goals, navigator asks, the open langtalks gap), canon ledger entry, full phase gate, and the Dev-Research Compositing mirror. Zero production code. [TRIG-01, TRIG-02, TRIG-03]

**Planner note (2026-07-30), RESOLVED same day at planning time (not left for 244-07 to discover):** the original SC3 draft stated the MMR formula as ~~`(1-lambda)*relevance - lambda*max_similarity`~~, which is algebraically equivalent to the canonical Carbonell form but INVERTS the knob's semantics (someone writing `lambda = 0.7` meaning "mostly relevance" would get "mostly diversity"). SC3 above (the numbered criterion, not this note) already carries the corrected canonical orientation and the `MMR_LAMBDA_RELEVANCE` name -- this note is preserved for traceability only. 244-07-PLAN.md implemented against the corrected SC3 and confirmed the code and document agree (21/21 tests, both a bidirectional lambda fence and the crowding-out regression pass); no further navigator amendment needed.
