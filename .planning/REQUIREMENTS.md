# Milestone v2.1.0 "Green the Floor" Requirements

Source: `.planning/research/SUMMARY.md` (4-leg Fable research + synthesis, 2026-08-13,
HIGH confidence) on the v2.0.0 close-out state. Goal: every framework a methodology command
invokes is READY when Larry reaches for it - flagship floor green (28 ratified frameworks,
readiness >= 3, exactly-1 match, `check-flagship-floor.cjs` exit 0) on a pipeline that no
longer damages what it ingests; SWEEP-02 lands; the v2.0.0 ledger closes fully.

Kickoff floor: 8/28 (2026-08-13 live, PRE-reconcile - RECON-04 re-baselines). Graph: 146
canonical frameworks (5 at 4/4, 20 at 3/4, 22 at 2/4, 9 at 1/4, 90 at 0/4).

## Cross-Cutting Rules (bind every phase)

- Canon Part 8 untouchable: generic methodology handles only ever cross the wire.
- Deploy coupling: remote ingest runs DEPLOYED code - fixes ship in ONE batched push, live
  round-trip verified, BEFORE any admin ceremony window opens. "Merged is not deployed."

- Admin-window discipline (the 2-day-open lesson): disable is the LAST SCRIPTED WRITE ITEM
  of any ceremony, before probes and records. Ceremony order is a security control.

- Statement-level guards, never JS-side checks: id+name double guard on targeted writes,
  `WHERE id(a) <> id(canon)` before edge MERGEs, `coalesce()` additive-only SETs.

- Eval honesty: fixtures authored BEFORE payloads, from source docs, with mutator
  red-proofs. A fixture citing a probe instead of a source path is a costume.

- Grounding: dedup-to-quality and GraphRAG-evaluation are langtalks corpus whitespace -
  the doctrine here is first-party; cite this repo's own execution records.

- No em-dashes anywhere.

## v2.1.0 Requirements

### Phase family A - Reconcile the Wave (hard-gates ALL writing phases)

- [ ] **RECON-01**: The untracked 2026-08-11/12 enrichment wave is fully attributed: a
      read-tier census diff names every delta (frameworks touched, nodes/edges added), and
      a tracked GRAPH-WRITE-LOG convention exists so no future write is unattributable.

- [ ] **RECON-02**: The 2 measured order collisions on shared step nodes (Identify Reverse
      Salients 24219: Red Teaming vs Nested Hierarchies; Generate Innovation Opportunities:
      S-Curve vs Nested Hierarchies) are dis-shared via carded surgery, and the order-channel
      ruling is recorded: node-prop `order` is the single truth, edge `r.order` documented dead.

- [ ] **RECON-03** (operator): The second machine's workspace is checked for untracked
      payload files (recovered into git, or back-filled graph-to-payload from the census
      diff), and admin-key hygiene is verified (the minted key is dead; no residual admin
      keys in any env).

- [ ] **RECON-04**: A fresh post-reconcile floor baseline replaces the stale 8/28 kickoff
      number; all downstream worklists derive from it.

### Phase family B - Gate Trust (parallel-safe, early)

- [x] **TRUST-01**: brain-client.cjs handles 429 honestly: a rate_limited sentinel or
      bounded Retry-After-aware retry - never BRAIN_UNREACHABLE with zero retries; proven
      by a forced-429 test.

- [x] **TRUST-02**: check-flagship-floor.cjs voids on probe failure: a run containing
      probe-failure rows reports VOID (re-run), never a false MISS/RED.

### Phase family C - Pipeline Fixes (brain repo, ONE pass, ONE push)

- [x] **FIX-01**: ingestFramework applies additive framework-level props to live nodes
      (dedup.mjs resolveFramework noop branch); the ingest result reports applied/skipped
      per prop (no silent acceptance); proven by a live round-trip on the deployed surface.

- [x] **FIX-02**: The dedup path cannot mint ALIAS_OF self-loops: statement-level
      `id(a) <> id(canon)` guard; the 42214 minting path is reproduced in an RCA fixture
      and then killed (red-proof).

- [x] **FIX-03**: normalizeName's direct-match branch is alias-aware (documented exists()
      form, typed :Framework target) with cross-branch dedup; gated by a before/after
      matrix across all name-matching readers AND the dedup write-path consumer; its own
      plan and commit inside the batched push.

- [ ] **FIX-04**: All fixes ship in one batched push, live round-trip verified on the
      deployed surface, and a push freeze is declared before the ceremony window opens.

### Phase family D - Enrichment Ceremony (single admin window)

- [ ] **CER-01**: Tier A - the 20 frameworks at 3/4 reach 4/4 via classified pattern_type
      rulings: digest cards by decision-homogeneity, one guarded UNWIND brain_write,
      read-tier verification (brain_write echoes no rows).

- [ ] **CER-02**: Cohort 1 - 10 mechanical flagship payloads land (fixture-first from
      source docs, digest waves of ~5 with per-row rejection), each verified read-tier.

- [ ] **CER-03**: Cohort 2 - 7 judgment flagship payloads land via individual cards,
      including the Triple Validation Compass source-attribution ruling.

- [ ] **CER-04**: PEST Analysis is ingested per ruling (source: macro-trends.md Phase 3;
      new node, 4 HAS_STEP, no fabricated LEADS_TO; honest 3/4 clears the floor).

- [ ] **CER-05**: The 42214 self-loop is DELETEd over HTTPS; the post-batch self-loop
      probe returns 0; admin disable executes as the last scripted write item of the window.

- [ ] **CER-06**: UN-DEFERRED 2026-08-21. The "ruling (recorded at requirements time)" this
      line originally pointed to was investigated before 261's plan locked and found to
      never actually exist anywhere (see git history on this line for the full account).
      Moments later the navigator supplied the actual named source directly: Rowan
      Gibson, *The Four Lenses of Innovation*. Recorded in full at
      `ProblemsWorthSolving-Brain/docs/2026-08-21-SOURCE-four-lenses-of-innovation.md`
      (book summary, all four lenses with definitions/applications/quotes, a process note,
      the navigator's own term dictionary, and a PWS-relevancy mapping). Back IN scope for
      Phase 261. The requirement itself is unchanged: NO payload is invented without a
      named read source - that source now exists and is findable.

### Phase family E - Floor Green + SWEEP-02 (the exit gate)

- [ ] **FLOOR-01**: check-flagship-floor.cjs exits 0 on a window-fresh run (no probe
      failures, per TRUST-02).

- [ ] **FLOOR-02** (carried from v2.0.0 SWEEP-02): the tier-0-no-key acceptance fixture is
      REPURPOSED to assert the keyless path refuses correctly - coverage kept, assertion
      inverted, never deleted.

- [ ] **FLOOR-03**: NOTE 2026-08-21, from 260-05's live post-deploy round-trip: `Scenario
      Planning` measures **2**, not the exactly-1 this requirement assumes (matrix section
      7 + the deployed round-trip agree, see `docs/2026-08-20-RECORD-fix04-batched-push.md`
      in ProblemsWorthSolving-Brain). This requirement needs a fresh ruling before 262 runs
      the floor check - either the anchor was wrong, or 2 genuinely correct results is the
      expected outcome and the assertion needs updating. Re-verify at the live graph before
      262's plan locks; do not carry the exactly-1 assumption forward unchanged.

### Phase family F - Long Tail + Carry-folds (post-green)

- [ ] **TAIL-01**: A demand-ranked long-tail worklist READER ships over the existing
      ENRICH-01 queue (hit_count DESC, SOURCE / NO SOURCE join per row); no bulk authoring -
      honest refusal + auto-queue remains the designed behavior for the unranked tail.

- [ ] **SEED-A**: The framework UN-WIRED gate is re-sourced from the live :Framework
      population (SEED-framework-coverage-live-population), post-hygiene.

- [ ] **SEED-B**: Grading/contradiction paths check a framework's grounding (readiness)
      before contradicting content against it (SEED-075) - an ungrounded framework yields
      an honest cannot-grade, not an unreliable contradiction.

- [ ] **CARRY-01** (v2.0.0 CACHE-03): the live hit-rate measurement lands - a real 10+
      turn interactive session on the shipped surface, hit_rate >= 0.91.

- [ ] **CARRY-02** (v2.0.0 AVAIL-03, operator): mindrian-brain suspension + dead env var
      deletion; restore path rehearsed once; single-point risks enumerated.

- [ ] **CARRY-03** (operator, Bolt-gated): the 7 ratified vector-index DROPs execute at a
      Bolt-capable checkpoint (Render SSH key registered), snapshot-first, one at a time.

### Phase 265 - Capability Radar Absorption + Routing (minted at plan time 2026-08-27)

Roadmap line 450 read "TBD"; research assumption A6 recorded that these IDs did not yet exist
and would be minted when the phase was planned. They are scoped to Phase 265 only.

- [ ] **RADAR-01**: A machine-readable capability ledger ships at `data/capability-ledger.json`,
      backfilled 2.1.128 to the installed Claude Code version with screened-relevant entries
      only, every row carrying capability / version / date / domain / leverage / destination /
      status / evidence, plus an unambiguous `ledger_covers {from, to}` anchor.

- [ ] **RADAR-02**: A freshness tripwire fails when the ledger's newest version trails installed
      `claude --version` beyond a threshold, wired into `scripts/doctor.cjs --acceptance` as a
      cadence-always check-only organ. An unreadable version warns, never passes.

- [ ] **RADAR-03**: `/mos:radar --fetch` writes the LEDGER, not only a prose cache, extracting
      structured typed fields only - never raw fetched markdown into a file Claude later reads
      as instructions.

- [ ] **RADAR-04**: Both radar reference docs teach current platform reality: the
      `CLAUDE_CODE_FORK_SUBAGENT` polarity is corrected (now the opt-OUT), the non-existent
      `executor_model` key is deleted, the stale top-tier-model claim is corrected, and both
      files are em-dash free and point at the ledger as source of record.

- [ ] **RADAR-05**: No `run_in_background` appears in any Agent-tool dispatch instruction across
      `commands/`, `skills/`, and `dist/`; swarm sizing clamps to the platform cap of 20; and
      every dispatch names an explicit `subagent_type` that resolves to a real `agents/*.md`.

- [ ] **RADAR-06**: `gate_render` rung 1 emits the SDK-current titled enum shapes (single-select
      `oneOf:[{const,title}]`, multi-select `items.anyOf:[{const,title}]`), so Desktop and Cowork
      users see option labels instead of raw slugs, with the canonical `gate_answer` payload
      unchanged.

- [ ] **RADAR-07**: Every `resolveModel` call site in `commands/` passes `(roomDir, agentType)`,
      so venture-stage hints and per-agent overrides actually apply instead of always resolving
      to `sonnet`.

- [ ] **RADAR-08**: SEED-003 and Phase 138 are marked `superseded_by: Phase 265` with their
      bodies intact (never deleted), drift finding W007-138 is closed with a forward pointer, and
      `docs/CANON-PHASE-MAP.md` records the retirement.

- [ ] **RADAR-09**: `Task` is present in `allowed-tools` on exactly the three reviewed swarm
      commands (act, persona, grade), each with a written reason, enforced by a set-equality
      tripwire so a fourth command cannot acquire the grant silently. (Its anti-silent-widening
      property is preserved and extended by RADAR-12, which replaces this frozen three-name
      literal with a reviewed registry covering both grant tokens; the three commands named here
      remain granted.)

- [ ] **RADAR-10**: Every command whose body dispatches subagents states its dispatch shape
      explicitly with a written reason: trending-to-absurd Expert path parallel,
      explore-opportunity legs sequential with the `quality_early_stop` coupling and cost
      consequence named. The navigator's explore-opportunity decision is recorded as ledger data.

- [ ] **RADAR-11**: The dev-research compositing trail is filed in both homes
      (`~/MindrianRooms/rethinking-mindrianos/research/2026-08-27-capability-radar-265/` and the
      `mindrianOS/research/` mirror), cross-linked in both directions with
      `docs/RADAR-ABSORPTION-265.md`.

### Phase 265 second planning pass (minted 2026-08-27, after the navigator settled nine more workstreams)

RADAR-01..11 came from the first planning pass. RADAR-12..31 were minted when the navigator settled
the MCP-layer audit, the file-meeting redesign, the six generative-redesign candidates, the
online-research gap, the persona-builder duplication, and the explore-opportunity build-out.

**Three of these IDs were retired before use.** Phase 266 (MCP Layer Correctness Fixes) was created
the same day to own four MCP defects on a faster, independent shipping schedule. RADAR-13, RADAR-15
and RADAR-16 duplicated MCPFIX-01, MCPFIX-03 and MCPFIX-04 respectively and were retired rather than
renumbered, so the gap is a deliberate record of the collision and not an omission.

- [ ] **RADAR-12**: Subagent-dispatch grants are governed by a reviewed registry at
      `data/subagent-dispatch-grants.json` rather than a frozen name list. Every `commands/*.md`
      whose `allowed-tools` carries `Task` or `Agent` has a row naming the dispatch shape, the fan
      bound, the reason, a non-agent reviewer and a date; a reviewed-but-unbuilt row is `pending` and
      does not fail the build; `TEST_265_GRANTS_STRICT=1` fails any built-but-unratified grant at the
      phase gate; and the tripwire enforces set equality across BOTH tokens, closing the pre-existing
      `Agent` grants on `commands/deep-grade.md`, `commands/opportunities.md` and
      `commands/research.md` the Task-only check could not see (three, not the one identified
      during planning; the other two surfaced when the rewritten tripwire's own arm-1 check ran
      against the live repo). SUPERSEDES the frozen
      three-name literal in RADAR-09 while preserving its anti-silent-widening intent.

- [x] ~~**RADAR-13**~~: RETIRED before use, 2026-08-27. Duplicated **MCPFIX-01** (Phase 266): the MCP
      `instructions` 2,173-byte overflow against the 2,048-byte host cap and the host-boundary test
      fix. Phase 266 owns `lib/mcp/runtime-instructions.cjs` and `lib/mcp/no-instructions.test.cjs`.

- [ ] **RADAR-14**: No shipped Brain tool description names a backend the plugin retired (three
      descriptions in `bin/mindrian-brain-mcp-client.cjs` still say Pinecone/Neo4j against a live
      Memgraph plus local-e5 stack), and a wire-level HYGIENE tripwire covers every tool on both
      servers for markdown leakage, retired backend names and mid-word truncation. Deliberately
      complementary to MCPFIX-04's prose-SHAPE checks, with the split stated in both tests.

- [x] ~~**RADAR-15**~~: RETIRED before use, 2026-08-27. Duplicated **MCPFIX-03** (Phase 266): the
      120-second blocking `spawnSync npm install` on a ~30-second connect path. Phase 266 owns
      `lib/core/mcp-dep-heal.cjs`.

- [x] ~~**RADAR-16**~~: RETIRED before use, 2026-08-27. Duplicated **MCPFIX-04** (Phase 266):
      expanding `tests/test-234-tool-description-floor.cjs` from 8 of 36 tools to every registered
      tool with honest coverage reporting. Phase 266 owns that file.

- [ ] **RADAR-17**: No shipped comment or doc states an MCP tool count or eager-load token budget the
      wire contradicts (`bin/mindrian-mcp-server.cjs` "9 tools" and "under 7000 token budget", two
      research docs, one versioned briefing), and the corrections point at the test that MEASURES the
      numbers rather than re-typing a new frozen literal, per the Canon Part 11 run-time-enumeration
      precedent. The one copy living in a Phase 266 file is handed across the boundary, not edited.

- [ ] **RADAR-18**: Zero unfilled `[methodology]` placeholders remain in `commands/`, `skills/` or
      `dist/`; every replacement names a `/mos:` command that resolves to a real file; and the
      inward-facing frameworks (JTBD, 5-Whys, Minto, beautiful-question) are deliberately NOT pointed
      at `/mos:research`.

- [ ] **RADAR-19**: `web_scope` declarations match runtime reality. `/mos:futures` declares `green`
      because `seedGrounding` and `perRingResearch` reach `fetchCorpus`; the same defect class is
      swept rather than assumed unique; and the limits of what the declaration enforces are recorded.

- [ ] **RADAR-20**: The `requires_evidence:` contract, specified since Phase 131 with a live
      reciprocal producer and zero consumers, has at least four live consumers starting with
      `/mos:build-thesis`, wired through `/mos:research`'s existing ask-first gate, with no bespoke
      dispatch logic, no new `web_scope: green` and no second confirmation gate.

- [ ] **RADAR-21**: `/mos:mos-reason` dispatches one subagent per populated room section behind the
      `--regenerate-all` backup ordering guard, sized through `planDispatch`, with a consolidation
      step that flags contradictions between section governing thoughts, and the four Feynman prompts
      still existing in exactly two byte-equal copies.

- [ ] **RADAR-22**: `/mos:scout` step 4b fans out per tracked competitor while steps 1 and 2 stay
      sequential for the stated snapshot-before-health dependency; same-event dedup and typed
      per-competitor failure live in the shared `scheduled-scanner.cjs` so `/mos:scheduled-tasks`
      inherits the dedup without inheriting the unattended spend Canon Part 3 forbids.

- [ ] **RADAR-23**: `/mos:deep-grade`'s rubric component count is reconciled to one authoritative
      number, verified against `brain_grade_calibrate`'s output contract, BEFORE any per-component
      fan-out is designed around it; the panel pulls calibration anchors once, merges fail-closed per
      `consolidatePanel`, and renders disputes ABOVE the score.

- [ ] **RADAR-24**: `/mos:file-meeting` asks for the meeting date and time before extraction begins,
      probes transcript size against a stated threshold, renders its declared F.8 gate through
      `renderShapeF8` and `consumeF8Fanout`, and extracts through five parallel whole-transcript
      perspective subagents whose consolidation owns dedup, knowledge-type reconciliation, cross-claim
      edges and the single main-thread write, feeding and never bypassing the proposed-only nugget
      routing gate.

- [ ] **RADAR-25**: The `generate-personas` MCP action no longer serves deterministic template output
      as if it were six-agent analysis: the default routes to `/mos:persona --parallel` and writes
      nothing, the template path is explicit opt-in and stamps every file in both frontmatter and
      body, and the two previously disconnected surfaces cite each other.

- [ ] **RADAR-26**: `/mos:explore-opportunity`'s analysis legs run concurrently behind a probe-first
      cost guard that reproduces `quality_early_stop`'s cost outcome exactly (a cold `deep_research`
      leg costs one leg, not four), with a documented override, a fallback to the sequential
      `runChain` path that reports which path ran and why, and zero diff on
      `lib/core/chain-executor.cjs`.

- [ ] **RADAR-27**: `/mos:research`'s `weighted-by-context` rotation takes the existing `Promise.all`
      branch in `lib/core/lens-engine.cjs`, with output ordering and rejection semantics proven
      unchanged and `tests/test-219-research-contract.cjs` still passing.

- [ ] **RADAR-28**: `/mos:diffusion` gets attributed per-actor capacity research through an optional
      roster parameter on `runIntelPipeline`'s existing decompose and plan-fan stages, behind the
      existing F.1 fan-approve gate and the existing `fetchCorpus` chokepoint; no new surface, no new
      stage, and `web_scope` stays `null` for a recorded reason.

- [ ] **RADAR-29**: `/mos:vault` import review fans out only above a stated row threshold, batched by
      guessed section with crossing-reassignment reconciliation and a single canonical persistence
      call; `/mos:find-analogies --external` fans only after the existing approval card, one literal
      composer-produced query string per agent that is never re-composed, merged on mechanism identity
      before a single comparative scoring run.

- [ ] **RADAR-30**: Every second-pass MCP finding requiring a genuine architecture decision is carried
      in `data/capability-ledger.json` with both sides of its trade and a status rather than guessed,
      the audit's verdict roll-up is fully reconciled, and `/mos:doctor` reports live per-server MCP
      tool counts and fails on the zero-tool and wedged-server cases.

- [ ] **RADAR-31**: The second-pass dev-research compositing trail is filed in both homes
      (`~/MindrianRooms/rethinking-mindrianos/research/2026-08-27-capability-radar-265-second-pass/`
      and the `mindrianOS/research/` mirror), cross-linked in both directions with
      `docs/RADAR-ABSORPTION-265.md` and to its first-pass sibling, recording honestly where the
      navigator overrode the research.

### Phase 266 - MCP Layer Correctness Fixes (minted at plan time 2026-08-27)

Roadmap line 469 read "TBD". These four IDs are scoped to Phase 266 only. Every one is a
defect proven live during the Phase 265 MCP-layer audit
(`265-RESEARCH-mcp-layer-audit.md`); the phase is deliberately independent of Phase 265 so it
can ship in the next version cut on its own schedule.

- [x] **MCPFIX-01**: The MCP `instructions` served at initialize measure at or under 1950 bytes
      (down from a measured 2173 against Claude Code's 2048-byte host cap since 2.1.84), the
      Canon Part 8 BOUNDARIES paragraph survives byte-identically including its final
      Claude-Code routing sentence, and `lib/mcp/no-instructions.test.cjs` asserts the cap at the
      HOST boundary rather than the server boundary where it could not see the truncation.

- [x] **MCPFIX-02**: The `room_state` tool description contains no markdown heading, no embedded
      newline, no `voice-dna.md` fingerprint and no mid-word cut; it clears the D-03 120-character
      instruction floor on authored prose that names all five of its commands; and the one-reader
      one-writer `compact` splice is deleted from both `lib/mcp/tool-router.cjs` and
      `lib/mcp/larry-context.cjs`.

- [x] **MCPFIX-03**: No dependency-heal path can block the MCP `initialize` handshake beyond an
      explicit connect-path budget strictly under the host's ~30-second connect timeout, both the
      install arm and the peer-wait arm are bounded by it, a heal that misses the budget emits one
      clear breadcrumb instead of hanging, and the SessionStart reconcile hook keeps its full
      120-second budget with the bug_001 invariant chain intact. 266-03 shipped the per-call budget;
      266-VERIFICATION.md's Truth #5 found it compounding to a measured 60296ms across the 4
      sequential module-scope heal calls each entry point makes (vs a ~30000ms host timeout); 266-05
      (2026-08-27) closed that gap with ONE process-wide shrinking deadline, satisfying the
      requirement at the process level it was always meant to hold at.

- [x] **MCPFIX-04**: `tests/test-234-tool-description-floor.cjs` applies every prose-shape check to
      every registered tool (derived from `tools/list`, never a hand-maintained list), uses the
      platform's real 2048-byte description cap instead of the stale 600-character ceiling, and
      states its own coverage in its summary line so a green run can never again be read as a
      claim it did not earn.

### Phase 270 - Memory and Context Operator MCP (minted at plan time 2026-08-27)

Roadmap line 522 read `TBD`. These fifteen IDs are scoped to Phase 270 only and were minted at plan
time in `270-DECISIONS.md`, matching the Phase 266 and Phase 269 precedent; plan 270-12 registers
them here at phase close. All twelve plans executed. Every row below is `[x]` except MEMOP-14, which
shipped one half and gated the other on a navigator verdict that came back `keep`.

- [x] **MEMOP-01**: A single command, `bash tests/run-all-270.sh`, discovers and runs every Phase 270
      test by glob, and fails loudly rather than printing green when it discovers zero files.
      Final run: `PASS=11 FAIL=0 SKIP=0`.

- [x] **MEMOP-02**: MCP Resources resolve the room per session, the same way MCP Tools already do,
      instead of binding `roomDir` once at boot. Fixed in plan 270-05; pinned by
      `tests/test-270-resource-session-room.cjs`. Three boot-bound call sites were deliberately left
      alone (`registerPrompts`, `registerCapabilities`, and the `roomDir` at
      `bin/mindrian-mcp-server.cjs:119`) and are carried forward on the ROADMAP.

- [x] **MEMOP-03**: The exposed ICM tree reflects a folder created after the server booted, not a
      snapshot frozen at startup. `mos://tree` plus `lib/mcp/tree-watcher.cjs`'s debounced
      `sendResourceListChanged` over already-vendored chokidar (plan 270-08).

- [x] **MEMOP-04**: The forest walk delegates to the two already-shipped walkers and mints no second,
      hand-rolled directory walker. Enforced as a SOURCE tripwire by
      `tests/test-270-no-second-walker.cjs`, not just asserted.

- [x] **MEMOP-05**: The section baseline is schema-driven off `SECTION_METADATA`, never a hardcoded
      count of 8. The tripwire derives its own forbidden-literal list from `SECTION_NAMES` at
      runtime, so it cannot go stale against a future section-set change.

- [x] **MEMOP-06**: The forest classifies directories into four classes, and a blueprint-subset room
      (missing some canonical sections) is a NORMAL room, never an error.

- [x] **MEMOP-07**: A cross-room read never writes a cross-room edge; the Part 8 aggregation fence at
      `lib/core/navigation/edges.cjs:45` holds for the new graph-native reads (read-only
      parameterized ATTACH, both edges tables byte-identical, apostrophe-bearing room names still
      contribute).

- [x] **MEMOP-08**: The identity write to `~/.mindrian-user.md` is reachable with no room bound, as a
      cross-room user-level concern rather than a room-scoped one. Shipped as `identity_write` (plan
      270-11), the first writer that file has ever had, built on `writeUserMdAtomic` UNMODIFIED.
      MECHANISM half only; Phase 267.2 W2 still owns the TRIGGER and must not build a second writer.

- [x] **MEMOP-09**: Every wire tool carries a connector descriptor with a `hitl_shape`, closing the
      `detect_dual_path` / `extract_shallow` born-wired gap (the 13-tool grouped-router family is
      exempt per the OQ-5 disposition). Registries regenerated, 21 -> 23 MCP-tool entries.

- [x] **MEMOP-10**: The tool-schema token budget added by this phase's new tools is MEASURED with a
      real harness, never assumed. `tests/test-270-tool-schema-budget.cjs` exports `BASELINE`
      (270-06), `AFTER` (270-12) and a derived `DELTA`, all from one `measure()` function. Honest
      result: the budget went UP, 36 -> 39 tools and ~7,167 -> ~8,377 approx tokens (+1,210,
      +16.88 percent). The fifth check asserts the delta is populated and deliberately does NOT
      assert a direction.

- [x] **MEMOP-11**: `context_assemble` exposes `getRoomContext`'s four legs, with its four existing
      budget knobs (`fragmentWindow`, `fragmentCharCap`, `topK`, `maxDepth`) surfaced as bounded
      caller parameters.

- [x] **MEMOP-12**: `context_assemble` carries an `estimate_only` mode: the cheap structural legs run
      and return projected per-leg cost without returning bodies, the "see the cost before you pay
      it" affordance.

- [x] **MEMOP-13**: The graph-native additions ship: `findTransitiveSupport` (recursive-CTE
      transitive support and contradiction closure, reusing `findBlockingAssumptions`'s in-file
      pattern) and `findNearestSubRoomDecisions` (structural distance across a `room.db` boundary,
      read-only, no new ATTACH).

- [x] **MEMOP-14**: `room_state_bound` retirement is GATED behind the OQ-6 navigator verdict (a
      manual foreign-host Resource parity check), and the phase's real AFTER/DELTA tool-schema token
      number is measured and recorded, replacing the earlier CLAIM. **Both halves satisfied, with
      one half deliberately not exercised:** the gate ran, the verdict was `keep`, so no retirement
      happened. Two of three checks passed (zero prose hits for `room_state`; in-process
      Resource/Tool parity green); the third, a real foreign non-Claude-Code MCP host, had no
      available host and no automated harness, so **Assumption A2 stays UNVERIFIED and carried
      forward**. The requirement was to gate the decision, not to produce a retirement.

- [x] **MEMOP-15**: The navigator answered OQ-1 and OQ-2 with named options, and OQ-3/OQ-4/OQ-5/OQ-7
      each carry a one-line disposition of record in `270-DECISIONS.md`, before any later plan
      depended on them.

### Phase 267.3 - Reward-Before-Investment Guard Jurisdiction (minted at plan time 2026-08-27)

Roadmap line 735 read `TBD` before plan 267.3-01. These ten IDs were minted at plan time in
`267.3-DECISIONS.md` Section 6, matching the Phase 266/269/270 precedent; this plan (267.3-08)
registers them here at phase close. All eight plans executed across seven waves. Every row below
is `[x]`.

- [x] **GUARD-01**: A machine-readable declaration contract exists for surfaces with no
      frontmatter. `data/first-reward-surfaces.json` (Phase 267.3, ruling D-A), modeled on
      `data/first-touch-surfaces.json`'s existing shape, read by `scanDeclaredSurfaces()` in
      `lib/core/mva-rule-linter.cjs`. Measured: `node scripts/check-reward-before-investment.cjs
      --surfaces .` exits 0.

- [x] **GUARD-02**: The reward vocabulary honestly covers every shipped command class, and every
      addition is recorded as a canon amendment with a written reason. `REWARD_TYPES` grew from 6
      to 9 members across two amendments: `methodology_reframe` and `--none (diagnostic surface)`
      ruled at plan time (`267.3-DECISIONS.md` Section 3), `live_deliverable` minted
      mid-classification for `/mos:publish` (`267.3-CLASSIFICATION.md` Row 13). Each entry recorded
      in `docs/reward-before-investment-rule.md`'s `## Vocabulary amendments` section with its
      surface class, ruling, date and evidence.

- [x] **GUARD-03**: The linter can read a first-reward declaration for `scripts/session-start`'s
      FIRST_INSTALL branch. The `session-start:FIRST_INSTALL` record in
      `data/first-reward-surfaces.json`, declared `--none (diagnostic surface)` per GAP R-1
      (Reward leg scored 2/10, `.planning/research/2026-08-27-hooked-first-install-audit.md`).

- [x] **GUARD-04**: Every injected-prose first-touch surface carries a declaration. Measured: 4
      records (`session-start:FIRST_INSTALL`, `session-start:UPDATE`,
      `session-start:MODE_ROUTING`, `session-start:COLD_START_MENU`), all validated by gate 10d.

- [x] **GUARD-05**: The 17 commands blocking Phase 271 carry honest per-command-reasoned
      declarations, each citing the command's actual first-reward moment. `267.3-CLASSIFICATION.md`
      Part 2, 17 rows each citing a `path:line` first delivery; landed by plans 267.3-04 and
      267.3-05.

- [x] **GUARD-06**: Phase 271's held work is committed through the full pre-commit hook with no
      bypass, and anchoring gate 10c reads zero violations. Commit `fa2f1414` (267.3-05), 34 files,
      `COMMIT_NO_VERIFY` unset. Measured: `check-plugin-path-anchoring.cjs --check` reads
      VIOLATIONS 0 across all four surfaces.

- [x] **GUARD-07**: Every `commands/*.md` carries a declaration, and the full audit reads zero
      missing and zero invalid. Landed across plans 267.3-04 (17), 267.3-06 (25), 267.3-07 (25), 67
      total. Measured: `node scripts/check-reward-before-investment.cjs` reads 113 compliant / 0
      missing / 0 invalid, exit 0.

- [x] **GUARD-08**: The debt is visible without waiting for an unrelated commit, via a whole-tree
      audit wired fail-closed into `scripts/verify-release`. Gate 10e (this plan, 267.3-08), proven
      against a stripped-fixture A/B test before being wired: a `commands/` copy with one
      declaration stripped exits 1, the real tree exits 0.

- [x] **GUARD-09**: The ruling is recorded with its reasoning and its rejected alternatives.
      `267.3-DECISIONS.md`, all three legs (D-A, D-B, D-C) with navigator reasoning in Section 1.1
      and all three rejected options (parsed-comment convention, connector-registry extension,
      narrow-to-17 scoping) preserved with their reasons in Section 5.

- [x] **GUARD-10**: No gate was relaxed, allowlisted, edited, or bypassed to make the board green.
      Confirmed per-wave (267.3-05's `git diff HEAD~1 -- check-plugin-path-anchoring.cjs
      scripts/hooks/ scripts/verify-release` empty; this plan's own Task 1 verify,
      `NO_EXISTING_GATE_REMOVED`, confirms zero anchoring/surfaces/mirror lines removed from
      `verify-release`'s diff) and independently re-confirmed by this plan's own Task 3 phase-wide
      no-relaxation audit walking the full git log for every gate/hook file touched this phase.

## Out of scope (recorded, not forgotten)

- Bulk enrichment of the 90-framework tail (navigator doctrine: demand drives the queue).
- Any change to WHAT crosses the Part 8 boundary.
- A permanent HTTP DDL tool (the 2-day-open-window lesson stands).
- Gate 0 foreign-host verify (carried operator leg, tracked in the handoff table).

## Traceability

80 active requirements: RECON-01..04, TRUST-01..02, FIX-01..04, CER-01..06, FLOOR-01..03,
TAIL-01, SEED-A..B, CARRY-01..03 (23, milestone-wide), plus RADAR-01..31 minus the three retired
IDs (28 active, Phase 265), MCPFIX-01..04 (Phase 266), MEMOP-01..15 (Phase 270), and GUARD-01..10
(Phase 267.3). All minted 2026-08-27: RADAR-01..11 and MCPFIX-01..04 at first-pass plan time,
RADAR-12..31 in the Phase 265 second planning pass after the navigator settled nine additional
workstreams, MEMOP-01..15 in Phase 270's own planning pass, and GUARD-01..10 in Phase 267.3
plan 01's `267.3-DECISIONS.md` Section 6. RADAR-13, RADAR-15 and RADAR-16 were retired before
use because they duplicated MCPFIX-01, MCPFIX-03 and MCPFIX-04; the gap is deliberate and recorded.
RADAR-12 supersedes the frozen three-name literal in RADAR-09 while preserving its intent.
Roadmap phases must map all 80 active requirements with no orphans.

**Caveat, carried on the MCPFIX, MEMOP and GUARD families alike (the Phase 266 and 269
precedent):** these IDs were minted at plan time inside their own phase's decision record rather
than being drawn from a pre-existing milestone requirements pass. They are phase-local working IDs
promoted to this document at phase close, which means the behaviour each one names is real and
shipped, but the ID itself did not exist before its phase was planned and should not be read as
part of an earlier milestone's scope.
