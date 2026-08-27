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
      tripwire so a fourth command cannot acquire the grant silently.

- [ ] **RADAR-10**: Every command whose body dispatches subagents states its dispatch shape
      explicitly with a written reason: trending-to-absurd Expert path parallel,
      explore-opportunity legs sequential with the `quality_early_stop` coupling and cost
      consequence named. The navigator's explore-opportunity decision is recorded as ledger data.

- [ ] **RADAR-11**: The dev-research compositing trail is filed in both homes
      (`~/MindrianRooms/rethinking-mindrianos/research/2026-08-27-capability-radar-265/` and the
      `mindrianOS/research/` mirror), cross-linked in both directions with
      `docs/RADAR-ABSORPTION-265.md`.

## Out of scope (recorded, not forgotten)

- Bulk enrichment of the 90-framework tail (navigator doctrine: demand drives the queue).
- Any change to WHAT crosses the Part 8 boundary.
- A permanent HTTP DDL tool (the 2-day-open-window lesson stands).
- Gate 0 foreign-host verify (carried operator leg, tracked in the handoff table).
## Traceability

34 requirements: RECON-01..04, TRUST-01..02, FIX-01..04, CER-01..06, FLOOR-01..03,
TAIL-01, SEED-A..B, CARRY-01..03 (23, milestone-wide), plus RADAR-01..11 (Phase 265,
minted at plan time 2026-08-27). Roadmap phases must map all 34 with no orphans.
