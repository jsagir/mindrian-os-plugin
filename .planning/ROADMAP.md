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
- [ ] **Phase 236: room.db Data-Loss Fixes** - Graph rebuild cannot erase memory/decision/truth-claim rows (one transaction), and a busy or broken open reports its real state instead of cold-starting
- [ ] **Phase 237: Reach Mechanism** - Approving a chain step actually runs it, one autonomy authority instead of two, and reach signals are session-scoped
- [ ] **Phase 238: Decision Gates** - Gates resolve through the ledger that minted them, session-scoped and concurrency-safe, and the card-fire backstop stops firing on prose
- [ ] **Phase 239: Brain-Access Surface** - The egress guard and PII sanitizer cover the doors user content actually walks through, and sendPacket's fate is decided explicitly
- [ ] **Phase 240: Memory** - Layer 2 promotion fires on real continuous work, the dead-letter queue drains into the memory cortex, and the test suite is hermetic
- [ ] **Phase 241: Feynman-MINTO** - Guardian output reaches the user instead of /dev/null, and the repair ladder triggers on the breaches navigators actually hit
- [ ] **Phase 242: The Moat** - The HSI-to-graph rewrite is transaction-wrapped, and the PR checklist's dead KuzuDB warning becomes a machine-checked assertion
- [ ] **Phase 243: Voice-Glyph** - The statusline's "who is speaking" signal reflects the glyph a turn actually opened with, not a fabricated default

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

- [x] 235-01-PLAN.md — CIRS-01/CIRS-03: consolidate the pre-commit hook to one canonical source (retiring the divergent setup-hooks.sh / install-pre-commit.sh authoring), fix release.sh's --strict-shape swallow, and mutation-proof both end to end (worktree + rival-installer-overwrite reproduction).
- [x] 235-02-PLAN.md — CIRS-02: build the repo-wide lib/core/seam-liveness.cjs helper (3 named dead-seam shapes + live controls), wire it into build-connector-registry.cjs's coverageReport() to close the MCP-tool-file blind spot, and mutation-proof the wiring.

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

- [ ] 236-01-PLAN.md - GRAPHDB-01: ownership allowlist (INDEXER_OWNED_NODE_TYPES / INDEXER_OWNED_EDGE_TYPES) + scoped rebuild DELETE, shared phase fixture, survival test observed RED before the fix.
- [ ] 236-02-PLAN.md - GRAPHDB-01: default runDeriveBackfill survival, crash-mid-transaction atomicity, and out-of-process WAL concurrent-reader visibility proven by observation.
- [ ] 236-03-PLAN.md - GRAPHDB-02: behavioral probe of the real thrown-error shapes, then RoomDbBusyError / RoomDbBrokenError at the openRoomDb chokepoint, plus the openRoomDb call-site census.
- [ ] 236-04-PLAN.md - GRAPHDB-03: engines.node floor corrected to >=22.13.0 with a nine-file lockstep sweep, plus tests/run-all-236.sh with a self-tested unscoped-DELETE regression gate.

### Phase 237: Reach Mechanism

**Goal**: The reach loop's approval actually reaches execution: an approved chain step runs its resolved command, one authority decides what is material vs autonomous_safe, and a session's reach reflects only that session's own signals.
**Depends on**: Phase 235 (CIRS is the posture-index source; the seam-liveness helper proves the approve-to-execute seam live)
**Requirements**: REACH-01, REACH-02, REACH-03
**Success Criteria** (what must be TRUE):

  1. On a seeded room, approving the Decision Gate for a material chain step causes that step's actual resolved command to run -- its output artifact exists afterward and the chain trace records real execution, not only a log line; a mutation restoring log-only execution turns the gate red. The decorative per-step `decide()` call is removed in the same change, proven by a call-site census.
  2. `framework_run` and `chain_run` produce identical material-vs-autonomous_safe classifications over the full command registry through ONE shared authority module -- a parity gate walks every registered command through both entry points and fails on any disagreement or on reintroduction of a second classification path.
  3. With two concurrent sessions live on one machine (two-process test), a candidate reach in session B reflects only B's own turn signals: a stale marker seeded by session A never surfaces in B's reach; removing the session scoping turns that leg red.

**Plans**: TBD

### Phase 238: Decision Gates

**Goal**: Decision Gates keep their word end to end: a gate resolves through the same ledger that minted it, ratification validates the answer against the card, concurrent sessions cannot cross-consume, and the card-fire backstop stops punishing ordinary prose.
**Depends on**: Phase 235 (shared seam-liveness helper proves the mint-to-ratifier seam live)
**Requirements**: GATE-01, GATE-03, GATE-04
**Success Criteria** (what must be TRUE):

  1. Answering a chain's halt gate end-to-end resolves through the SAME ledger entry that minted it (mint id equals ratified id, asserted on a real chain run), and a `gate_answer` whose `chosen` is not among the card's actual options is rejected before ratification; bypassing the options validation turns the gate red.
  2. Two concurrent sessions minting and answering gates never consume each other's cards (two-process fence), and the retry-counter file survives N parallel writers with no torn write (atomic-write fence on the proven Phase 87-02 concurrency-fence pattern).
  3. `check-card-fire.cjs` run over a committed fixture corpus built from this session's eight logged over-enforcement instances (citation/footnote markers in prose) produces ZERO false fires, while a genuine unrendered-card fixture still fires red -- the corpus pins the tuning so it cannot silently regress in either direction.

**Plans**: TBD

### Phase 239: Brain-Access Surface

**Goal**: The Part-8 boundary's enforcement matches its doctrine: the egress guard and PII sanitizer cover the live Brain tool names and the `query()` door user content actually walks through, and the unused `sendPacket` door gets an explicit fate instead of silent limbo.
**Depends on**: Phase 235 (soft: reuses the seam-liveness helper for the hook-matcher liveness proof; no other blocker)
**Requirements**: BRAIN-01, BRAIN-02, BRAIN-03
**Success Criteria** (what must be TRUE):

  1. The seam-liveness helper, run over the Part-8 egress guard and PII sanitizer hook matchers against the LIVE enumerated Brain tool names, comes back green -- and a mutation renaming one live tool (or staling one matcher) turns it red, proving the liveness check is load-bearing and the B-1 dead-matcher shape cannot silently recur.
  2. A canary token typed into an opportunity field and into a Blue Hat note, driven through the real `query()` path against a captured mock transport, is inspected and caught by the egress guard BEFORE the wire -- the capture shows the sanitized payload; removing the `query()` coverage turns the gate red. The guard no longer covers only the unused `sendPacket` door.
  3. `sendPacket`'s fate is decided explicitly and recorded: either it is wired to at least one real job with an end-to-end proof on a seeded room, or it is parked with a dated note at the call surface and in docs -- either way a written decision exists (BRAIN-03 is a decision, not a bug fix).

**Plans**: TBD

### Phase 240: Memory

**Goal**: Cross-session memory actually accumulates: Layer 2 JTBD promotion fires on real continuous work, the graph-edge dead-letter queue drains into the memory cortex, and the test suite can never write into a user's live store.
**Depends on**: Phase 236 (HARD -- explicit REQUIREMENTS.md dependency: promotions route into memory-cortex tables that `rebuildGraph` currently truncates; landing this before 236 would convert a quiet loss into a permanent one. Do NOT schedule as parallel-independent.)
**Requirements**: MEM-01, MEM-02, MEM-03
**Success Criteria** (what must be TRUE):

  1. A real multi-turn session of continuous same-topic work against a seeded room produces a Layer 2 JTBD promotion row (not only on topic changes), and the manual-override path persists exactly the fields its own gate later checks (write-then-read round-trip); a mutation restoring the topic-change-only trigger turns the gate red.
  2. Seeded `graph-edge-pending.log` entries are consumed into `memory_event` rows through the Phase 150 memory cortex, the pending log shrinks accordingly, and the promoted rows SURVIVE a subsequent `rebuildGraph` -- riding Phase 236's transaction wrap, which is the reason for the hard dependency (folds in the `graph-edge-pending-undrained-dead-letter-queue` debug session).
  3. Running the full JTBD test suite leaves the user's live memory store byte-identical (hashed before and after), and a deliberately seeded non-hermetic fixture turns the fence red -- hermeticity is enforced by a gate, not by habit.

**Plans**: TBD

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
- [ ] 241-03-PLAN.md - F-2 (MINTO-02): missing MINTO.md and missing governing_thought raised to critical so they reach the enqueue gate; pre-existing suites reconciled per Pitfall 5; both legs assert a real minto-queue.json entry.
- [ ] 241-04-PLAN.md - F-3 (MINTO-02): runPreCommit demoted to an advisory WARN with a --strict / MINTO_PRECOMMIT_STRICT opt-in (Phase 210 idiom); proven by a REAL git commit in both directions, with the pre-commit hook script untouched so Phase 235 cannot collide.
- [ ] 241-05-PLAN.md - Tri-Polar parity + close-out (MINTO-01, MINTO-02): the shared mindrian-core Stop path runs the guardian too (Desktop, Cowork, and CLI under MINDRIAN_MCP_FIRST were all blind); parity test; tests/run-all-241.sh harness with permanent regression tripwires; Dev-Research Compositing filing.

**Planner note (2026-07-28), F-0's premise corrected against the working tree**: the filed RCA concluded the debounce consumer "was never wired" on the strength of a grep against `scripts/intent-classifier.cjs`. The UserPromptSubmit hook registered in `hooks/hooks.json` is `scripts/intent-classifier`, an extensionless BASH wrapper, which has carried a live Phase 88-05 drain-and-act block since Phase 88 (drains at olderThanMs 30000, appends to pending-tier1-regen.json, spawns vault-section-minto-generator.cjs --write) and is covered by 7 registered tests. The consumer exists and acts. What survives from the RCA is its paired minimal piece, which plan 241-02 implements: stop the unconditional vacuum at both stop-path drains. No second consumer is wired into the .cjs (Canon Part 7, and two drains would race).

### Phase 242: The Moat

**Goal**: The scoring layer that IS the moat cannot be zeroed by a crash, and the PR checklist asserts reality by machine instead of warning about a database that no longer exists.
**Depends on**: Nothing hard (soft: reuses Phase 236's crash-injection + transaction-wrap proof pattern -- MW-1/MW-2/MW-3 are the same root cause as GRAPHDB-01)
**Requirements**: MOAT-01, MOAT-02
**Success Criteria** (what must be TRUE):

  1. A crash injected mid HSI-to-graph edge rewrite on a seeded, already-scored room leaves the prior scoring layer fully intact on reopen (never zeroed), and a concurrent reader during a live rewrite never observes an empty scoring layer; removing the transaction wrap turns the gate red.
  2. The PR checklist's KuzuDB warning prose is gone, replaced by a machine-checked assertion that fails when a kuzu reference re-enters the tree and passes on the current tree -- proven by seeding one kuzu reference and watching it fail (MOAT-02 is a light doc fix per the audit's rethink verdict, no RCA cycle).

**Plans**: 2 plans (both Wave 1, no interdependency, zero shared files)

- [ ] 242-01-PLAN.md — MOAT-01: wrap the hsi-to-graph DELETE-then-rewrite in one BEGIN/COMMIT/ROLLBACK, add the production-inert MINDRIAN_HSI_CRASH_TEST_DELAY_MS crash seam, and prove it with a three-leg test (spawn+SIGKILL crash injection, fork()'d concurrent reader, mutation proof) plus the tests/run-all-242.sh aggregator.
- [ ] 242-02-PLAN.md — MOAT-02: build scripts/check-kuzu-reintroduction.cjs (dependency-manifest + live require/import scan, exit 0/1/2), wire it into scripts/verify-release as section 17, replace the dead docs/MOAT-MANDATE.md line 96 prose with a same-polarity machine-checked warning sign, and fence it with a hermetic seeded-fixture test.

**Planner resolutions (recorded 2026-07-28 so the two phases can be diffed before execution):** the shared `withTransaction` helper extraction is DECLINED for this phase, so Phase 242 touches NO file under `lib/` and its file set is provably disjoint from Phase 236's `lib/core/lazygraph-ops.cjs` work. The kuzu gate lands in `scripts/verify-release` only, not `scripts/doctor.cjs`. The crash seam is `MINDRIAN_HSI_CRASH_TEST_DELAY_MS`.

### Phase 243: Voice-Glyph

**Goal**: The De Stijl voice-glyph header tells the truth: the statusline's "who is speaking" signal reflects the glyph a turn actually opened with, and the remaining voice-signature findings ride the existing open RCA instead of spawning a new one.
**Depends on**: Nothing hard (scheduled last; smallest blast radius)
**Requirements**: GLYPH-01
**Success Criteria** (what must be TRUE):

  1. Across a fixture set covering the glyph vocabulary, a turn opened with glyph X renders glyph X in the statusline, and a turn that opened with NO glyph renders the honest empty/unknown state -- the fabricated default painted over by the stance color cannot be reproduced; a mutation restoring the fabricated default turns the gate red.
  2. V-2 and V-3 are routed into the existing open `voice-signature-dark-runtime.md` RCA as cross-referenced entries (no new RCA file created), verifiable by reading that RCA.

**Plans**: 2 plans

- [ ] 243-01-PLAN.md - SC1: delete the stance-default glyph fabrication at lib/statusline/cockpit-renderer.cjs (superseding the second half of Phase 210 item B), INVERT the three superseded assertions in tests/test-voice-glyph-advisory.cjs and tests/test-192-statusline-stance-chip.cjs, add the 18-row honest-glyph fixture suite plus tests/run-all-243.sh, and PROVE the mutation gate bites by executing it.
- [ ] 243-02-PLAN.md - SC2: author .planning/debug/voice-signature-dark-runtime.md (the RCA six documents cite and that has never existed on disk or in git history) carrying V-1 as resolved-history, V-2/V-3/the who-default conflict/the permanent-dark residual as open cross-referenced findings, gated by a structure-only doc-presence test.

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
| 236. room.db Data-Loss Fixes | 0/4 | Planned | - |
| 237. Reach Mechanism | 0/? | Not started | - |
| 238. Decision Gates | 0/? | Not started | - |
| 239. Brain-Access Surface | 0/? | Not started | - |
| 240. Memory | 0/? | Not started | - |
| 241. Feynman-MINTO | 2/5 | In Progress|  |
| 242. The Moat | 0/2 | Planned | - |
| 243. Voice-Glyph | 0/2 | Planned | - |

**Coverage:** 23/23 v1.16.0 requirements mapped (CIRS-01..03, GRAPHDB-01..03, REACH-01..03, GATE-01/03/04, BRAIN-01..03, MEM-01..03, MINTO-01..02, MOAT-01..02, GLYPH-01). No orphans, no duplicates. Full mapping in `.planning/REQUIREMENTS.md` Traceability.

## Next Milestone (slot REGISTERED 2026-07-28, navigator decision): v1.17.0 "MCP-First" (ships on the beta train, v1.17.0-beta.x)

Navigator locked this slot mid-roadmap-session ("lets plan it for 1.17.beta"): the MCP-first system is the milestone immediately after v1.16.0. NOT scoped into this file's phases (v1.16.0 stays remediation-only); registered here so the slot cannot be claimed by another feature.

- **Scope anchor:** `.planning/phases/198-mcp-first-then-sdk/` (Phase 198, un-parked 2026-07-09; stack locked oclif + Ink + MCP SDK; 3 servers split by trust boundary) plus PROJECT.md Platform Vision Workstream B (23-tool MCP server) as candidate scope.
- **Why after v1.16.0, not inside it:** the live MCP tool surface (`lib/mcp/tools/`: chain.cjs, gate.cjs, sensors.cjs, graph.cjs, room.cjs, status.cjs, stop-gate.cjs, views.cjs) is exactly where the audit found wired-at-one-end seams. v1.17.0 builds on the repaired surface (Phases 237/238/239) and inherits Phase 235's seam-liveness helper, so all three new servers are born-wired with a red-able liveness gate from day one instead of repeating the audit's failure shape at 3x scale.
- **Candidate fold-ins (decide at milestone definition, not here):** MCP Sampling migration for Feynman-MINTO tier-1 (retires the ANTHROPIC_API_KEY requirement; PROJECT.md first-class backlog item), MCP Apps De Stijl surfaces (Workstream C).
- **CARRIED-IN DEFECT (navigator routing, 2026-07-28): the room-resolution ladder is v1.17.0 structural work, not v1.16.0 remediation.** `.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md` (diagnosed, live before/after verified, re-verified byte-identical on `origin/main`). `room_bind`'s session-scoped binding is invisible to EVERY MCP read tool unless `MINDRIAN_MCP_FIRST` covers the calling surface, which is unset by default on every install today; reads fall through to a global registry pointer and then to a boot-time-frozen fallback, and `room_bind` still returns an unqualified `{ok:true, bound:true}` about an effect that will not apply. This is the MCP-first flag's own semantics failing, so it belongs to the MCP-First milestone by subject matter, not to Phase 237's reach-seam repair. Scope when defining v1.17.0: (a) collapse the EIGHT independent copies of the gate-then-fallthrough resolver (the 7 modules in `lib/mcp/tools/` plus `lib/mcp/tool-router.cjs:116-132` `resolveWriteTargetDir`) into one shared resolver, mirroring the `lib/core/resolve-active-room.cjs` precedent that already retired a prior "four guessers" bug class; (b) make an explicit `room_bind` authoritative for the rest of its session regardless of flag state; (c) follow the precedence ladder Phase 234-05 already shipped for the WRITE half in `lib/mcp/mcp-first-flag.cjs` `isWritePathEnabled` (explicit flag wins, then confident host-tier detection, floor to false) rather than inventing a second one - the read path is the unfixed half of a gap whose write half is already closed. **v1.16.0 Phase 237 keeps only the session-scoping acceptance test (REACH-03); it must NOT attempt the resolver collapse.** Operational mitigation available today with no code change: `bash scripts/room-registry set-active <room>`.
- **Trigger:** after v1.16.0 completes, run `/gsd-new-milestone v1.17.0` -- requirements definition happens there, not in this file.
