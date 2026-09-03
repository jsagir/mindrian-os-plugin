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

- [x] **FLOOR-01**: check-flagship-floor.cjs exits 0 on a window-fresh run (no probe
      failures, per TRUST-02). NOTE 2026-09-02 (D-01, Phase 262 Plan 05): this milestone
      closes FLOOR-01 as "measured, attributed and routed" against a window-fresh,
      zero-VOID run (20/28 PASS, 8/28 MISS measured against the incumbent Brain on
      2026-09-02) - the "exits 0" condition itself moves to whichever phase reopens the
      Brain-repo write seam, because six of the eight MISS rows need a graph write and
      `brain_write` / `ingest_framework` were measured ABSENT that same date. Full per-row
      root cause, owner and evidence: `docs/262-FLOOR-01-GAP-LEDGER.md`. The Brain-repo
      remediation request: `docs/262-WORKORDER-brain-repo-floor-remediation.md`. The
      28-name ratified denominator was NOT narrowed to reach this disposition; narrowing it
      was considered and is recorded as a rejected option in the gap ledger, so the record
      shows the gate was not gamed. The checkbox state itself is left to `/gsd-verify-work`
      to set - this annotation only records the disposition, deliberately, so a later
      reader knows the box was left unchecked on purpose rather than forgotten.

- [x] **FLOOR-02** (carried from v2.0.0 SWEEP-02): SHIPPED 2026-09-02 (Phase 262 Plan 03) as
      `tests/fixtures/127-03-acceptance/no-identity-refusal/` (git-mv-repurposed from
      `tier-0-no-key`, history followed) - the tier-0-no-key acceptance fixture is
      REPURPOSED to assert the keyless path refuses correctly - coverage kept, assertion
      inverted, never deleted. The README was inverted to assert refusal, gate 1 was
      hardened with the honesty assertions plus a negative no-methodology-served assertion,
      the byte-locked `DIRECTOR_NOT_AVAILABLE` wire string was left unchanged, and all of
      `tests/run-all-127.sh` is green. D-06 note: this shipped decoupled from FLOOR-01's
      exit code, because there is no technical coupling and the fixture never contacts the
      Brain.

- [x] **FLOOR-03**: SUPERSEDED 2026-09-02 (D-05, Phase 262 Plan 05) - the note below this
      line is retained for provenance (the history of the two wrong carried-forward numbers
      is not erased) but no longer reflects the live ruling. Original note: NOTE 2026-08-21,
      from 260-05's live post-deploy round-trip: `Scenario Planning` measures **2**, not the
      exactly-1 this requirement assumes (matrix section 7 + the deployed round-trip agree,
      see `docs/2026-08-20-RECORD-fix04-batched-push.md` in ProblemsWorthSolving-Brain).
      This requirement's assertion was left unresolved as of that note - either the
      anchor was wrong, or 2 genuinely correct results is the expected outcome and the
      assertion needs updating. The note called for re-verification at the live graph
      before 262's plan locks, and for the exactly-1 assumption not to be carried forward
      unchanged. RULING 2026-09-02: measured live (`node scripts/check-flagship-floor.cjs`,
      and the direct `normalize_framework_name({ raw: 'Scenario Planning' })` probe)
      against the incumbent Brain on 2026-09-02, the count is still **2**
      (`["Shell Scenario Planning Method", "Scenario planning methodology"]`). Traced
      mechanism: the alias branch of `NORMALIZE_NAME_CYPHER` stops at hop depth 1, so an
      intermediate alias node (23450) is emitted as canonical alongside the terminal node
      (34362), and `reduce` dedups by string rather than by node, so both survive. Ruling:
      exactly-1 remains the correct assertion; the measured 2 is a resolver defect, not a
      legitimate multi-canonical result - the graph is wrong, not the requirement. Theo's
      own `resolveFramework` (`normalize-framework-name.ts`) already refuses on this exact
      shape with a named `ALIAS_FORK` code rather than silently returning two canonical
      matches, so the fix has a working reference implementation, not a from-scratch design
      (D-05). Routing: a read-path Cypher fix in the Brain repo, needing no admin window
      (unlike the other FLOOR-01 rows), carried by
      `docs/262-WORKORDER-brain-repo-floor-remediation.md`. Full detail:
      `docs/262-FLOOR-01-GAP-LEDGER.md` Section 6.

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

### Phase 273 - SQLite Graph Chokepoint Hardening (writeEdge silent-failure + propagation-gap fixes) (minted at plan time 2026-08-31)

These six IDs were minted in `273-01-PLAN.md`'s frontmatter, finalized to this canonical
one-per-fix-dimension mapping in `273-02-PLAN.md`'s objective, and are scoped to Phase 273 only.
Five plans executed across three waves (273-01/02 Wave 0 RED harness, 273-03/04 Wave 1 GREEN
fixes, 273-05 phase close). Every row below is `[x]`.

- [x] **CHOKE-01**: The Wave 0 verification harness discovers every Phase 273 test file by glob
      and hard-fails rather than reporting green on zero discovery. `tests/run-all-273.sh`
      (273-01). Measured: `bash tests/run-all-273.sh` discovers 5 test files, `PASS=7 FAIL=0
      SKIP=0` (includes the Part 8 source sweep and no-em-dash fence as two additional checks),
      aggregator exits 0.

- [x] **CHOKE-02**: C1 -- `writeEdge` is changes-aware: a write suppressed by the
      confirmed-review-status guard reports an additive `written: false` field (`ok` semantics
      left untouched, per D-01a's 43-file/77-call-site blast-radius constraint). Fixed in
      `lib/core/navigation/edges.cjs` (273-03). Measured: `node
      tests/test-273-writeedge-changes-aware.cjs` PASS.

- [x] **CHOKE-03**: C2 -- `writeEdge` degrades gracefully against a base `lazygraph-ops.openGraph`
      handle missing the `review_status` column via a `PRAGMA table_info(edges)` fallback
      (`edgesHasReviewStatus(db)`), instead of throwing; `review_status_persisted` reports the
      gap explicitly per D-06. Fixed in `lib/core/navigation/edges.cjs` (273-03). Measured: `node
      tests/test-273-writeedge-base-schema.cjs` PASS.

- [x] **CHOKE-04**: C3 -- the Brain edge-type allowlist bypass in
      `lib/core/navigation/ingestion.cjs`'s raw `INSERT OR IGNORE` write is closed by an inline
      `ALLOWED_EDGE_TYPES` guard (reject-and-skip, `rejectedEdgeTypes` observability field),
      applied inline per D-03a rather than routed through `writeEdge` (whose `ON CONFLICT DO
      UPDATE` semantics would have granted the Brain edge-property-overwrite power it does not
      have today -- a Canon Part 9 regression). Fixed in `lib/core/navigation/ingestion.cjs`
      (273-04). Measured: `node tests/test-273-ingestion-allowlist.cjs` PASS.

- [x] **CHOKE-05**: M2 -- the misleading "Cross-room aggregation forbidden" comment, which implied
      a checked runtime invariant that does not exist, is corrected at all 11 sites in
      `lib/core/navigation/edges.cjs` to describe the actual structural mechanism (the function
      signature `writeEdge(db, params)` is physically incapable of holding a second room's
      handle). Fixed in `lib/core/navigation/edges.cjs` (273-03). Measured: `node
      tests/test-273-cross-room-comment.cjs` PASS (11 corrected occurrences, 0 stale).

- [x] **CHOKE-06**: M4/D-05 -- the documented substrate baseline is reconciled to the honest live-
      measured number, with a dated note explaining the fixes in this phase were structurally
      incapable of moving it (`lib/core/navigation/` is path-allowlisted at
      `check-substrate.cjs:70`; `RE_RAW_WRITE` does not match `INSERT OR IGNORE INTO`).
      `docs/architecture/SUBSTRATE-BASELINE.md`'s `## 2026-08-31 re-measurement (Phase 273)`
      section (273-05). Measured: `node tests/test-273-substrate-baseline-honest.cjs` PASS
      (measured=208), live `node scripts/check-substrate.cjs --baseline` also reads 208, unchanged
      from the pre-fix count.

### Phase 274 - Bare `scripts/` Invocation Anchoring (the adjacent class Phase 271 measured and did not fix) (minted 2026-09-01)

These ten IDs were minted in `274-RESEARCH.md`'s Phase Requirements section (2026-09-01) and
scoped to Phase 274 only: fix every unanchored `bash|sh|node|npx|python|python3 scripts/<name>`
invocation site across commands, hand-authored skills, agents and pipelines (the fourth pass at
one disease class in this repo, and the sibling of Phase 271's `references/` citation sweep),
and promote the measuring instrument into a hard release gate the way 271-05 did for the citation
tier. Six plans executed across four waves (274-01 Wave 0 instrument widening + fixture/smoke
tests, 274-02/03/04 Wave 1 the command/skill/agent sweep plus allowlist and followup
registration, 274-05 Wave 2 mirror regeneration and full-tree verification, 274-06 Wave 3 gate
wiring and close-out). Every row below is `[x]`.

- [x] **ANCHOR-01**: `check-plugin-path-anchoring.cjs`'s script tier widened from a `bash|node`
      two-verb match to a mechanism-scoped six-verb predicate (`bash|sh|node|npx|python|python3`),
      with `anchored`/`allowlisted`/`target` classification (parity with the citation tier) and a
      gateable `--check-scripts` exit-code mode. Fixed in `scripts/check-plugin-path-anchoring.cjs`
      (274-01). Measured: widened predicate surfaced 37 script-tier sites live (up from the
      pre-widening 34, closing the `python3 scripts/render-pdf` blind spot RESEARCH.md's Pitfall 2
      named); `node tests/test-274-script-invocation-anchoring.cjs` 20/20 PASS.

- [x] **ANCHOR-02**: All 30 command-surface invocation sites anchored with the quoted short form
      `"${CLAUDE_PLUGIN_ROOT}/scripts/<name>"`. Fixed across `commands/*.md` (274-02 batch A: bono,
      causal, export, file-meeting, find-analogies, intel-pipeline, mos-reason; 274-03 batch B:
      mva-brief, new-surface, publish, room, skill, snapshot, vault). Measured: live full-tree scan
      reports 0 unanchored command-surface sites.

- [x] **ANCHOR-03**: The 3 hand-authored skill sites (`skills/conversation-mode/SKILL.md:17`,
      `skills/mva-pipeline/SKILL.md:52`, `skills/room-passive/SKILL.md:96`) anchored with the
      byte-identical fail-closed long form already shipping at `skills/export/SKILL.md:80`. Fixed
      in the 3 named files (274-04). Measured: `grep` confirms all 3 sites carry the
      `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?...}}` prefix character-for-character.

- [x] **ANCHOR-04**: The 1 agent site (`agents/analogy-query-fetcher.md:43`) anchored with the
      short form `${CLAUDE_PLUGIN_ROOT}/`. Fixed in `agents/analogy-query-fetcher.md` (274-04).
      Measured: live full-tree scan reports 0 unanchored agent-surface sites.

- [x] **ANCHOR-05**: Generated skill mirrors regenerated from the fixed commands, proven
      byte-consistent (`build-skill-mirrors.cjs --check` stays green). Verified in 274-05: write
      mode reported `created 0, unchanged 112, overwritten 0, skipped 1` (all 14 sweep-touched
      mirrors were already at expected content because 274-02/03/04's own pre-commit hooks had
      already regenerated them at commit time). Measured: `node scripts/build-skill-mirrors.cjs
      --check` exits 0 both before and after the confirming write-mode run.

- [x] **ANCHOR-06**: Every deliberately-not-anchored site carries a reasoned `SCRIPT_ALLOWLIST`
      entry, never a silent skip. Fixed in `scripts/check-plugin-path-anchoring.cjs` (274-04):
      `SCRIPT_ALLOWLIST` populated with 2 reasoned entries (the `./scripts/help-renderer.cjs` and
      `./scripts/resolve-room` deliberate cwd-relative fallback lines in `commands/help.md` and
      `commands/eureka.md`), plus `FOLLOWUP-274-R1` (the `commands/status.md` matcher/body drift)
      and `FOLLOWUP-274-R2` (the fail-closed `:?` form vs. the older prose-fallback convention,
      a deferred design question) registered in `REGISTERED_FOLLOWUPS`, both with named owners
      (repo navigator) and a stated residual risk. Measured: `validateAllowlist()` passes at
      module load (no dangling `followup` id); live scan shows both allowlisted lines tagged
      `[OK ALLOWLISTED]`, not `VIOLATION`.

- [x] **ANCHOR-07**: The fixture test suite extended with script-tier fixtures
      (`tests/test-274-script-invocation-anchoring.cjs`, an 8-arm suite modeled on
      `tests/test-271-plugin-path-anchoring.cjs`) plus `tests/run-all-274.sh` as the phase
      aggregator. Fixed in `tests/test-274-script-invocation-anchoring.cjs` and
      `tests/run-all-274.sh` (274-01). Measured: `bash tests/run-all-274.sh` PASS=4 FAIL=0 (fixture
      suite, CLI smoke test, script-tier gate, DO-NOT-REGRESS citation-tier gate).

- [x] **ANCHOR-08**: The CLI runtime smoke test with the resolution-failure oracle (D-02's runtime
      arm), generalized over a representative sample of real scripts (`wikilink-file.cjs`,
      `build-new-surface.cjs`) run from a scratch cwd. Fixed in `tests/smoke-274-cli-invocation.sh`
      (274-01). Measured: 8/8 PASS, asserting on the resolution signature (`Cannot find module` /
      exit 127 for the bare form, successful start for the anchored form, an explicit refusal
      message for the fail-closed long form), not business outcome.

- [x] **ANCHOR-09**: The script tier wired into `scripts/verify-release` as a new hard gate
      (**10f**), zero-tolerance, fail-closed, following the 10c wiring shape exactly, sequenced
      LAST (Wave 3) so the gate could not go live red against unfinished sweep work (the
      DEVIATION-271-05-A sequencing lesson this phase deliberately avoided). Fixed in
      `scripts/verify-release` (274-06). Measured: proven to fire against a throwaway
      `os.tmpdir()` fixture before trusting the live run (1 violation on a bare invocation, 0 on
      the identical line anchored); live `bash scripts/verify-release` emits a `10f. Plugin
      Script-Invocation Anchoring` PASS line; `git diff --numstat -- scripts/verify-release` shows
      0 removed lines (pure addition).

- [x] **ANCHOR-10**: The Tri-Polar Desktop/Cowork stated-gap declaration (D-02: static
      path-correctness checking only on those two surfaces, no automated runtime execution proof,
      a deliberate call per the Tri-Polar Design Rule, not a silent omission) plus the full
      close-out paper trail (CHANGELOG, `knowledge-base.md`, ROADMAP row with both followups named
      and owned, Dev-Research Compositing mirror + room entry, cross-linked both directions).
      Fixed in `CHANGELOG.md`, `.planning/ROADMAP.md`, `.planning/debug/knowledge-base.md`,
      `.planning/phases/274-bare-scripts-invocation-anchoring-the-adjacent-class-phase-2/274-06-SUMMARY.md`
      (274-06). Measured: see this phase's 274-06-SUMMARY.md for the compositing-trail outcome
      (landed or honestly recorded as blocked).

### Phase 272 - PYPORT-01..07 (CJS Python Elimination Port, Real Remediation of Phase 134)

These seven IDs were minted in `272-RESEARCH.md`'s Phase Requirements section (2026-08-31) and
scoped to Phase 272 only: replace the Python analyzer scripts (`scripts/rs-engine.py`,
`scripts/compute-hsi.py`, `lib/core/rs_math.py`) with in-process CJS modules for the local
(Mode A internal / Tier 1) computation path, eliminating the ~2GB Python/PyTorch runtime
requirement for that path, while retaining Python as an explicit, env-flag-selected fallback
(D-04) rather than deleting it. This phase is the real remediation of Phase 134, whose own
tracking read COMPLETE while the actual port code did not exist anywhere in the repo -- see
`.planning/debug/phase-134-python-elimination-false-complete.md` (kept open at
`status: resolved-partial`, not moved to `resolved/`, since this phase closes Change 2 of that
RCA's three named changes, not all three -- see DEFERRED-SCOPE.md for Change 3's status). Ten
plans executed across six waves (272-01/02/03 Wave 0-1 RED harness, 272-04/05 Wave 2 numeric
primitives + infra fixes, 272-06/07 Wave 3 rs-math/hsi-lsa/hsi-spectral ports, 272-08/09 Wave 4
orchestration ports, 272-10 Wave 5 dispatch wiring, 272-11 phase close). Every row below is `[x]`.

- [x] **PYPORT-01**: sklearn-parity numeric primitives (`TruncatedSVD` with the verified
      `svd_flip` V-row argmax-abs sign rule, `TfidfVectorizer` vocabulary/idf/L2-weight parity)
      ported with zero new npm dependencies. Fixed in `lib/core/numeric/svd.cjs` and
      `lib/core/numeric/tfidf.cjs` (272-05). Measured: `node tests/272-svd-sign.test.cjs` and
      `node tests/272-tfidf-parity.test.cjs` both PASS, pinned against live sklearn 1.8.0 source
      read (the exact `u_based_decision=False` V-row rule) and a byte-for-byte cross-check of the
      318-word `SKLEARN_ENGLISH_STOPWORDS_v1` list against a live `python3` sklearn install.

- [x] **PYPORT-02**: `rs-engine.py`'s Mode A internal orchestration (artifact discovery, LSA
      structural leg, semantic leg, pairing, `REVERSE_SALIENT` edge writes) ported end to end,
      producing a real (non-degraded, non-fudged) candidate output against the phase's fixture
      room. Fixed in `lib/core/rs-engine.cjs` (272-08, contract pinned by 272-02). Measured:
      `node tests/272-rs-engine-contract.test.cjs` PASS (all 11 pair fields, atomic write
      verified); live end-to-end run against a throwaway fixture-room copy wrote 100/100
      `REVERSE_SALIENT` edges into `room.db` with `properties.source='rs-engine'`.

- [x] **PYPORT-03**: `compute-hsi.py`'s Tier 1 orchestration (LSA leg via Convention B
      cosine-on-SVD, Tier 1 semantic leg, per-artifact Markov/OM-HMM spectral profile, pairing/
      scoring) ported field-for-field, with Tier 2 explicitly refused rather than silently served
      as Tier 1. Fixed in `lib/core/hsi-lsa.cjs` + `lib/core/hsi-spectral.cjs` (272-07) and
      `lib/core/hsi-engine.cjs` (272-09). Measured: `node tests/272-hsi-lsa-algorithm.test.cjs`
      and `node tests/272-spectral.test.cjs` both PASS; live run against the 96-artifact fixture
      room completed in ~1.3s with real, varied, correctly-sorted `lsa_sim`/`semantic_sim`/
      `hsi_score` values (verified by lowering `threshold` from the default 0.30 to 0); Tier 2
      request returns `{success:false, error:'not_implemented_this_phase'}` before any
      computation begins (`grep -c "not_implemented_this_phase" lib/core/hsi-engine.cjs` = 4).

- [x] **PYPORT-04**: a single dispatch chokepoint (`MINDRIAN_RS_BACKEND` env flag, default
      `cjs`) gates backend selection at all three real Python-spawning callers identified by
      RESEARCH.md Finding F-8 (`lib/agents/reverse-salient-agent.cjs`,
      `lib/core/intelligence-cascade.cjs`, `lib/core/futures/orchestrator.cjs`) -- no module
      outside the chokepoint decides directly -- with D-09's rule-6 amendment landed in both live
      copies (`reverse-salient-agent.cjs:19`, `commands/find-bottlenecks.md`) in the same commit
      as the dispatch wiring. Fixed in `lib/core/rs-backend-dispatch.cjs` (272-04, unwired) and
      wired at all three callers (272-10). Measured: `bash tests/272-dispatch-chokepoint.sh` and
      `bash tests/272-rule6-amended.sh` both PASS; live verification with
      `MINDRIAN_RS_BACKEND=cjs` and `MINDRIAN_RS_BACKEND=python` both succeed against the fixture
      room through the same caller code paths.

- [x] **PYPORT-05**: a rank-agreement validation gate proving the CJS port's LSA leg (the actual
      novel numerical work of this phase) is numerically sound against the Python baseline, with
      zero confident `signed_diff` sign flips. D-11 (navigator ruling, 2026-08-31) replaced the
      original top-K pair-ID set-overlap metric with a delta/correlation-based metric after
      272-08's root-cause finding that the original metric measured Python's own cross-process
      ARPACK non-determinism (0.42-0.50 overlap Python-vs-itself across independent processes),
      not port correctness. Fixed in `tests/272-rank-agreement.test.cjs` +
      `tests/fixtures/272/NOISE-FLOOR.md`/`noise-floor.json` (272-02 original gate, redesigned by
      272-08 same day per D-11). Measured: LSA-leg Spearman rank-correlation rho = 0.9965, avg
      delta = 0.0050, max delta = 0.0210 (matched pairs, `baseline-python.fixture.json` vs
      `candidate-cjs.fixture.json`, 692 of 2000 pairs shared), against gate thresholds
      `LSA_SPEARMAN_MIN=0.85`/`LSA_AVG_DELTA_MAX=0.02`/`LSA_MAX_DELTA_MAX=0.05` (2.4x-12x margin
      above measured); 0 of 692 shared pairs show a `direction` (sign) mismatch at any confidence
      level. **See DEFERRED-SCOPE.md's encoder-divergence callout: the SECONDARY/informational
      `abs_diff`/`semantic_score` matched-pair agreement is weak (rho ~0.15/~0.75), a real,
      quantified, and expected consequence of D-01's encoder swap, not a defect -- flagged there
      for anyone considering full Python deletion.**

- [x] **PYPORT-06**: the D-06 first-run model-cache probe is fixed to delegate to
      `ModelRegistry.is_pipeline_cached` instead of a synchronous `fs.existsSync` heuristic that
      false-positived on a partially-downloaded model directory. Fixed in
      `lib/core/eureka/embedding-spine.cjs` (272-04). Measured: `node
      tests/272-cache-probe.test.cjs` PASS, including the partial-download-directory case
      (present but missing `config.json`) correctly resolving to NOT cached.

- [x] **PYPORT-07**: (a) the D-07 model-cache location bug is fixed so the default cache dir
      resolves to `$HOME/.mindrian/model-cache` instead of transformers.js's package-relative
      default, which `lib/core/cache-prune.cjs` deletes on every plugin version update (the
      re-download-on-every-update bug); (b) the D-01 Pinecone `/embed` hosted-inference call is
      ported to a small CJS `fetch` module with the Part 8 dual-layer egress audit reused
      verbatim (audit-before-fetch, audit-before-return). Fixed in
      `lib/core/eureka/embedding-spine.cjs`'s `resolveCacheDir` and `lib/core/pinecone-inference.cjs`
      (both 272-04). Measured: `node tests/272-cache-location.test.cjs` PASS (default resolves
      under `$HOME/.mindrian`, explicit `MINDRIAN_MODEL_CACHE` override still honored); `node
      tests/272-pinecone-inference.test.cjs` PASS (all 7 asserts: missing-key short-circuit,
      audit-before-fetch/audit-before-return call order, a real `ExternalEgressViolation` throw
      on a forbidden-pattern hit, `/embed` response-shape validation, HTTP-error envelope
      handling, secret-hygiene guard on the `detail` field).

**A real bug fixed along the way, not itself a PYPORT-NN item but load-bearing evidence the port
was genuinely exercised, not just written:** `embedding-spine.cjs`'s `isModelCached` set
`transformers.env.allowRemoteModels = false` for its own offline-only cache probe and never
restored it, so the very next real `pipeline()` load in the SAME process silently inherited the
false value and could never reach the network on a genuine cache miss -- a real first-run
download hard-failing instead of downloading, on any cold-cache machine. Found and fixed in
272-08 while generating the real candidate fixture (not injected, not staged -- the first live
run against a genuinely cold cache surfaced it directly).

### Phase 254 - Orchestration projection consumption wiring (suggest-next, act, server-side composition) (minted 2026-09-02)

These six IDs were minted in `254-CONTEXT.md` D-05 (2026-09-02), ratifying the family
`254-RESEARCH.md` proposed, and scoped to Phase 254 only: wire the shipped-but-unwired
multi-hop projection recommender into `/mos:suggest-next` and `/mos:act --chain` (Wave 1, local
only, zero Brain calls), and ratify + govern the server-side Brain-composition surfaces that
were already shipped and running in production before this phase (Wave 2, D-01). Six plans
executed across two waves (254-01 the chain-source blend seam, 254-02 the suggest-next/act
consumer wiring, 254-03 the vocabulary-drift gate, all Wave 1; 254-04 the COMP-01 composition
census, 254-05 the COMP-02 ambiguous-disclosure fix plus the D-06 normalize probe, both Wave 2;
254-06 the R7 structural fence, the Theo note, and this registration). Every row below is `[x]`.

- [x] **WIRE-01**: `/mos:suggest-next` produces a multi-step chain sourced from the projection
      when the projection has edges for the seed. Fixed in `lib/workflow/chain-source.cjs`
      (254-01), wired into `scripts/suggest-next-command.cjs` (254-02). Measured:
      `node tests/test-254-projection-chain-source.cjs` PASS (6 arms + module-loads guard); live
      `--from-framework "S-Curve Analysis"` prints a genuine 2-step numbered sequence
      (`S-Curve Analysis -> Adoption-Capacity Theory`, confidence 0.82) where before this phase it
      collapsed to one step.

- [x] **WIRE-02**: When the projection has no edge for the seed, the surface degrades to the
      current registry-composed answer with a disclosed source, never to empty. Fixed in
      `lib/workflow/chain-source.cjs` (254-01). Measured: `node tests/test-254-degrade-floor.cjs`
      PASS (6 arms + module-loads guard); live-verified the two most common real invocations
      (`Beautiful Question Framework` for the ill-defined case AND the no-problem-type default)
      both resolve to a non-empty `registry-floor` answer, the exact case a straight replace was
      proven to break.

- [x] **WIRE-03**: `/mos:act --chain` composes from the same source as `suggest-next`; the two
      cannot disagree. Fixed in `scripts/suggest-next-command.cjs` and `scripts/act-command.cjs`,
      both wired to `lib/workflow/chain-source.cjs::resolveChainSource` (254-02). Measured:
      `node tests/test-254-one-chain-source.cjs` PASS (49/49 assertions across 7 arms: a
      structural single-caller proof over a named allowed set, behavioural agreement on both the
      projection and registry-floor cases, the second-numbered-step proof, never-empty coverage,
      exit-0 contract, R4-one-door-intact).

- [x] **WIRE-04**: The three framework vocabularies (`KNOWN_FRAMEWORKS`, `command-registry.json`,
      the projection) can no longer silently diverge - a drift gate fails the build. Fixed in
      `scripts/check-framework-vocabulary-drift.cjs` (254-03), wired into
      `scripts/hooks/pre-commit`, `scripts/release.sh` Step 2.4, and `scripts/doctor.cjs`'s
      coverage-gate roll-up. Measured: `node scripts/check-framework-vocabulary-drift.cjs --check`
      exits 0 (`framework-vocabulary: OK`) against the live tree; `node
      tests/test-254-vocabulary-drift.cjs` PASS (9 arms); an injected-drift proof (an unclassified
      composer name) fires `undeclared_composer_name` while the live tree stays green afterward.

- [x] **COMP-01**: Every `mindrian-os`-named tool handler that reaches the Brain is enumerated in
      one place and routes through the `callTool` belt. Fixed in
      `lib/mcp/brain-composition-census.cjs` (254-04): a frozen `COMPOSITION_SITES` array (4
      entries, 2 reaching, 2 provenance-only) reconciled bidirectionally against source. Measured:
      `node tests/test-254-composition-census.cjs` PASS (8 arms); proves structurally that no file
      under `lib/mcp/` opens a wire outside `brain-client.cjs::callTool`.

- [x] **COMP-02**: The `callTool` belt's verdict handling matches the hook's, or the divergence is
      a stated, tested decision. Fixed in `lib/core/brain-client.cjs` (254-05, D-02 Option A): an
      additive `egress_disclosure` field is attached to the three success returns when the belt
      captures an `ambiguous` verdict, and the call still proceeds (Option B, fail-closed, was
      explicitly rejected for this phase). Measured: `node tests/test-254-ambiguous-disclosure.cjs`
      PASS (7 arms, live-wire proof over the loopback capture server: proceed-and-disclose,
      block/allow/null/sentinel regression pins, a no-laundering canary, belt-ordering).

**The two stated decisions this phase made, recorded here so a future reader does not have to
rediscover them:**

1. **`BRAIN_PROBLEM_TYPE_ALIASES` is PINNED, not re-pointed.** `lib/core/brain-client.cjs:1607-1616`
   projects the incumbent's three canonical problem-type names; none of the three is a live Theo
   `DomainConcept` id, and no single value satisfies both populations. The standing rule is to
   ship against the CURRENT Brain (Theo is not deployable yet - no remote hosting story, its own
   Phase 8.4 not started). The map is pinned by `tests/test-254-normalize-roundtrip-probe.cjs`
   (Arms 4-5), so the flip-day change is a single-line-per-key diff against a test that already
   names the target, not a rediscovery. The exact incumbent-to-Theo mapping and the full reasoning
   are recorded in `docs/254-NOTE-theo-adaptation-list-additions.md` Section 4.

2. **The MCP `suggest_next` / `orchestration act*` surfaces are NOT wired to the new chain
   source.** `lib/mcp/brain-router.cjs::recommend()` returns a chain of COMMAND SLUGS validated
   against its own `KNOWN_METHODOLOGIES` list, not a chain of framework NAMES like
   `chain-source.cjs` produces - wiring it needs its own vocabulary reconciliation and its own
   regression suite, out of this phase's budget. The divergence between the CLI-surface (wired)
   and MCP-surface (unwired) vocabularies is instrumented by
   `scripts/check-framework-vocabulary-drift.cjs`'s report-only advisory tier (the fourth
   vocabulary, `KNOWN_METHODOLOGIES`) so it is measured on every run rather than silently
   unmeasured, and is named here as a follow-up for a future phase to close.

### Phase 257 - Part 8 enforcement locus (host-independent egress guard) (minted at plan time 2026-09-02)

These ten IDs were minted during Phase 257 planning (2026-09-02), ratifying `257-CONTEXT.md`'s
navigator rulings D-01 through D-11 and `257-RESEARCH.md`'s recommended phase shape. They are
phase-local working IDs, promoted to this document at phase close by `257-09-PLAN.md` per the Phase
254/272/274 precedent. Rows are `- [ ]` until `257-09` finalizes each one with its measured proof.

Context that reshaped the phase: the 2026-08-20 handoff's H3 ("a direct model-issued Brain tool call
bypasses `brain-client.cjs` entirely") is FALSE and has been since `ca32b612` (2026-08-19 09:26), two
and a half hours before the handoff's own base commit. The stdio shim delegates fully through
`callTool`, which carries the fail-closed belt; a live wire probe measured four `egress_blocked`
refusals and zero captured bytes. What is real is a honesty defect at the RETURN path (G1/G2/G3) plus
one genuinely uncovered surface (`pws-brain-mcp` direct-HTTPS, which is Desktop's and Cowork's path).

- [x] **LOCUS-01**: `brain_ask` renders an `egress_blocked` sentinel as an honest, typed refusal,
      never a well-formed empty `DirectiveEnvelope`. Fixed in `lib/core/refusal-messaging.cjs`
      (257-01, `egress_blocked` minted as the sixth refusal kind with its own `BRAIN_EGRESS_BLOCKED`
      status) and `bin/mindrian-brain-mcp-client.cjs` (257-06).

- [x] **LOCUS-02**: Phase 254's `egress_disclosure` survives to the `brain_ask` response, making
      COMP-02 non-vacuous on the highest-traffic Brain tool. Fixed in
      `lib/core/directive-envelope.cjs` (257-02). The same fixed-key builder was also discarding the
      `refusal` object the Phase 250-01 honest-refusal branch passes in, so that earlier fix was
      partly vacuous too; both fields are now carried additively.

- [ ] **LOCUS-03**: every Brain tool the live server advertises is proven ON THE WIRE to leak zero
      bytes on a canary, with an honest typed refusal in the response and an `ambiguous` payload
      proceeding and disclosing. `tests/test-257-brain-tool-egress-invariant.cjs` (257-07); the tool
      list is derived from the server's own `tools/list` and reconciled in both directions, never a
      frozen array.

- [x] **LOCUS-04**: the record is corrected. The false parenthetical at
      `lib/mcp/brain-composition-census.cjs:37-38` is replaced with an evidence-bearing statement, and
      `docs/2026-08-20-HANDOFF-part8-guard-in-mcp-handlers.md` carries an append-only dated correction
      (257-03).

- [ ] **LOCUS-05**: the far-side ruling (D-01) is documented with both halves, the pragmatic finding
      that this repo's `mcp-server-brain/` is the dead service and the principled finding that a
      far-side guard can prevent USE but never RECEIPT. `docs/257-NOTE-part8-enforcement-locus-rulings.md`
      (257-04).

- [ ] **LOCUS-06**: the direct-HTTP gap (D-02) is documented with the four-path coverage table and the
      open high-severity RCA cited by filename. Same file (257-04). Includes the D-05 flag that
      `query()`'s `null` contract stays frozen and G2's conflation is pinned by test rather than fixed.

- [ ] **LOCUS-07**: all six Brain tools reject undeclared keys before any handler runs, closing the
      smuggling class Theo's GUARD-01 measured. `bin/mindrian-brain-mcp-client.cjs` migrated from
      positional `server.tool()` to `server.registerTool()` with `z.strictObject` input schemas
      (257-08). Measured on this repo's own pins: a plain shape ACCEPTS `{roomSecret:'LEAK'}` and
      silently drops it; `z.strictObject` rejects with `unrecognized_keys`.

- [ ] **LOCUS-08**: baseline honesty. The two pre-existing red 239 arms froze the pre-2026-08-19 hook
      matcher literal; both now derive it from `hooks/hooks.json` at run time, and the pre-change and
      post-change counts are both recorded (257-05). No 257 report claims a green suite without citing
      the recorded baseline.

- [ ] **LOCUS-09**: the Theo forward-compatibility note (D-08) covering T-1 (the hook matcher goes
      dark on flip day), T-2 (catalog consolidation makes name-based enforcement structurally
      impossible, leaving `registerContentTool` as the only viable locus) and T-3 (Theo is local
      today, so the window is open now). `docs/257-NOTE-theo-forward-compat-enforcement-locus.md`
      (257-04).

- [ ] **LOCUS-10**: the Canon Part 8 PR gate is discharged in the shape D-11 specifies: the real
      automated leg (`doctor.cjs --acceptance` Class O `agentshield-all-surfaces-clean`, which
      delegates to `classify()`), the suites reported against their recorded baseline, and a blocking
      human Canon Custodian checkpoint naming the diff surface and which of the four Brain paths the
      change covers and which it deliberately does not. `257-COMPLIANCE.md` (257-09).

**The three stated decisions this phase made at plan time, recorded so a future reader does not have
to rediscover them:**

1. **The D-01/D-02 rulings live in a standalone phase note, NOT in `docs/MINDRIAN-CANON.md`.**
   CONTEXT.md left the container to Claude's discretion. Amending the Canon in this repo is a
   machinery event (Appendix D entry, header Version bump, `docs/CANON-PHASE-MAP.md` ledger row, and
   navigator gating for frozen-property additions), and these are enforcement-locus rulings rather
   than doctrine changes: the `LOCAL data -> BRAIN: NO` invariant is untouched by both. Invoking that
   machinery would inflate the phase and imply a doctrine change that did not happen. The note is made
   discoverable through the corrected census comment and the handoff correction block, which both
   point at it by filename. The Canon Custodian checkpoint surfaces this decision explicitly for
   reversal if the navigator wants the ruling inside the Canon itself.

2. **The two frozen-literal 239 failures are FIXED IN-PHASE, not spun out** (D-10 required a stated
   decision either way). The fix is two constants replaced by a read of the file they were copied
   from. The failure is Pitfall 4, the exact anti-pattern this phase exists to prevent, sitting inside
   the suite meant to guard against it, while this phase ships a new test whose entire discipline is
   derive-never-freeze. Leaving it red would also force every downstream report to carry an asterisk.

3. **`query()`'s `null`-return contract stays FROZEN** (D-05). G2's block-versus-outage conflation on
   `brain_query` is real and is NOT fixed: roughly 82 degradation tests key on the `null` return
   (`lib/core/brain-client.cjs:640-643`). Instead the current conflated behavior is PINNED by an arm
   of `tests/test-257-brain-tool-egress-invariant.cjs` and commented at the call site, so it cannot
   change silently and a future contract change has to be a deliberate phase.

## Traceability

119 active requirements: RECON-01..04, TRUST-01..02, FIX-01..04, CER-01..06, FLOOR-01..03,
TAIL-01, SEED-A..B, CARRY-01..03 (23, milestone-wide), plus RADAR-01..31 minus the three retired
IDs (28 active, Phase 265), MCPFIX-01..04 (Phase 266), MEMOP-01..15 (Phase 270), GUARD-01..10
(Phase 267.3), CHOKE-01..06 (Phase 273), PYPORT-01..07 (Phase 272), ANCHOR-01..10 (Phase 274),
plus WIRE-01..04 / COMP-01..02 (Phase 254), plus LOCUS-01..10 (Phase 257). All minted 2026-08-27 except CHOKE-01..06 and
PYPORT-01..07 (both minted 2026-08-31), ANCHOR-01..10 (minted 2026-09-01), and WIRE-01..04 /
COMP-01..02 (minted 2026-09-02): RADAR-01..11 and MCPFIX-01..04 at
first-pass plan time,
RADAR-12..31 in the Phase 265 second planning pass after the navigator settled nine additional
workstreams, MEMOP-01..15 in Phase 270's own planning pass, GUARD-01..10 in Phase 267.3
plan 01's `267.3-DECISIONS.md` Section 6, CHOKE-01..06 in `273-01-PLAN.md`'s frontmatter,
finalized in `273-02-PLAN.md`'s objective, PYPORT-01..07 in `272-RESEARCH.md`'s Phase
Requirements section, registered to this document at phase close by `272-11-PLAN.md` per the
Phase 273/CHOKE precedent, ANCHOR-01..10 in `274-RESEARCH.md`'s Phase Requirements section,
registered to this document at phase close by `274-06-PLAN.md` per the same precedent, and
WIRE-01..04 / COMP-01..02 in `254-CONTEXT.md` D-05, ratifying `254-RESEARCH.md`'s proposed
family, registered to this document at phase close by `254-06-PLAN.md` per the same precedent.
RADAR-13,
RADAR-15 and RADAR-16 were retired before
use because they duplicated MCPFIX-01, MCPFIX-03 and MCPFIX-04; the gap is deliberate and recorded.
RADAR-12 supersedes the frozen three-name literal in RADAR-09 while preserving its intent.
LOCUS-01..10 were minted in Phase 257's plan set (2026-09-02), ratifying `257-CONTEXT.md`'s
D-01..D-11 and `257-RESEARCH.md`'s recommended phase shape, and are registered here at plan time
as `- [ ]` rows to be finalized with measured proof by `257-09-PLAN.md` at phase close.
Roadmap phases must map all 119 active requirements with no orphans.

**Caveat, carried on the MCPFIX, MEMOP, GUARD, PYPORT, ANCHOR, WIRE/COMP and LOCUS families alike (the
Phase 266 and 269
precedent):** these IDs were minted at plan time inside their own phase's decision record rather
than being drawn from a pre-existing milestone requirements pass. They are phase-local working IDs
promoted to this document at phase close, which means the behaviour each one names is real and
shipped, but the ID itself did not exist before its phase was planned and should not be read as
part of an earlier milestone's scope.
