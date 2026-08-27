---
seed: room-walk-test-and-pattern-confirmation-threshold
canon_parts: [7, 9]
status: proposed
created: 2026-08-28
source: rethinking-mindrianos/research/2026-08-28-icm-architect-room-structure/
gated_on: none required to investigate (Task 1 below is pure reuse-check, autonomous_safe); building either mechanism is gated on Task 1's finding
---

# SEED-076 -- MindrianOS rooms already match a community-validated ICM form (Record library + Context map), checked against a real reference implementation; two adoptable mechanisms named, one may already exist

## Where this came from

Navigator pointed at `github.com/RinDig/icm-architect` (MIT, 1,279 stars) directly. Verified
live via `gh api` (README, SKILL.md, `references/forms.md` read in full, not summarized from
a description) -- a Claude Code skill implementing the same paper MindrianOS's own
`docs/MWP-SPECIFICATION.md` already cites (arXiv 2603.16021, Van Clief & McDermott). Full
evidence trail: `rethinking-mindrianos/research/2026-08-28-icm-architect-room-structure/`.

## What was checked, and what it confirmed

Applied the tool's own form-selection question and walk test to a real room
(`~/MindrianRooms/launchpad-02/`), not hypothetically:

- **MindrianOS rooms are the tool's "Record library" form** (unit = an accumulating
  venture/client record), with the entry-file pair matching the tool's "Context map" pattern:
  `ROOM.md` (10 lines, static identity) + `STATE.md` (68 lines, a GENERATED "Room Map" of
  section/artifact-count/completeness) = the tool's own "CLAUDE.md (one generated from the
  other) + FILE-MAP.md GENERATED index" move. Already real, just unnamed.
- **`.rooms/registry.json`** (831 lines, one entry per room: path/status/created/last_opened)
  = the tool's "index log... one line per record, id + status." Already real.
- **The tool's `reference-integrity.md` move-safety gate independently validates Phase
  271/274's own approach** (enumerate every referrer before a move, watch case-folded
  destination collisions, copy-verify-remove) -- a community-formalized version of the exact
  discipline Phase 271 reinvented under pressure this session for bare-path citations.
- **The tool's Record-library "records drifting from the template shape" anti-pattern
  independently confirms an already-recorded MindrianOS finding**: Phase 270's ROADMAP.md
  OQ-7 entry (`team-execution`'s thin `SECTION_METADATA` against real Mentor-Profiles usage
  carrying role/domain-expertise/availability/cross-linking fields).

## The real audit: `icm-architect` bound and run live against `launchpad-02` (2026-08-28)

Per the navigator's follow-up directive ("bind the architect to any room/ICM/memory/local
graph work from here on" -- codified as a standing consult in `CLAUDE.md`'s grounding-sources
section and `feedback_mindrianos_dev_consult_icm_architect.md` in personal memory), the skill
was actually invoked in Restructure/audit-only mode against a real, live room
(`~/MindrianRooms/launchpad-02/`), not just read about. Findings, all directly verified by
reading the actual files:

- **Classification: Catalog = `ROOM.md`+`STATE.md` (root). Contract = MISSING, repo-wide.**
  No section has a file answering "what belongs here / what should a human check" in the
  shape icm-architect's own `stage-CONTEXT.md` template wants. Each section's `ROOM.md`
  carries `purpose` + starter questions -- identity, not a contract.
- **Walk test failure #1, concrete not hypothetical: 5 of 12 sections store real content
  inline in `ROOM.md` instead of separate dated entry files.** `solution-design/`,
  `legal-ip/`, `market-analysis/` correctly separate identity (`ROOM.md`) from product (dated
  files). `business-model/`, `competitive-analysis/`, `financial-model/`, `problem-
  definition/`, `team-execution/` do not -- `business-model/ROOM.md` alone is 61 lines
  carrying the venture's actual funding split, milestone tables, and growth argument (in
  Hebrew) directly in what is supposed to be a small, stable routing file. Textbook instance
  of the walk test's own check: "Is any routing file carrying content payload? Move the
  payload to a shelf; leave a pointer."
- **This directly starves the Feynman-Minto reasoning layer -- proven, not inferred.**
  `business-model/MINTO.md` (auto-generated, `last_generated_at: 2026-08-26T09:48:36Z`)
  reads: `governing_thought: "Business Model synthesizes 0 artifacts..."`, "Missing Evidence:
  only 0 artifacts filed (minimum 3 recommended)". But `ROOM.md` in the same section has real,
  substantial content. The Feynman-Minto governing-thought generator isn't broken -- it counts
  dated entry files, and this section's real content isn't stored as one, so the reasoning
  layer sees nothing to reason over. This is Phase 273/SEED-075's "reliable chokepoint" theme
  showing up one layer up: a correctly-built downstream consumer (MINTO.md generation)
  producing a wrong answer because an upstream convention (where content is filed) was
  violated silently, with no error anywhere in the chain.
- **Two sections have no identity file at all.** `funding/` and `opportunity-bank/` carry only
  an auto-generated `STATE.md` reporting `total_entries: 0` -- no `ROOM.md`, no purpose, no
  starter questions. `team/` is fully empty (0 files) -- already correctly flagged red by
  MindrianOS's own `STATE.md` Room Map ("EMPTY -- GAP"), confirming that part of the tooling
  works.
- **5 stale `.mindrian/recompile-stamps.json.tmp.*` files** (`Dead` classification, never
  cleaned up across at least 5 sessions this week) -- small, but a real, concrete instance of
  the class.
- **Navigator asked directly whether MINTO.md could double as the missing contract file --
  answered and recorded: no, and mixing them would recreate the session's own clobber bug.**
  MINTO.md is REGENERATED on content change; a contract per invariant #4 must be STABLE,
  hand-authored. Writing a contract into a file the generator overwrites is the exact failure
  shape as `gsd-tools`'s `state.record-metric` clobbering hand-written STATE.md prose, one
  layer down at the room level instead of the dev-repo level. MINTO.md's own "Evidence Gaps"
  section ("Missing: revenue model, unit economics, pricing strategy") is the closest existing
  thing to a contract's intent -- worth reusing as the SEED for writing a real, separate
  per-section `CONTEXT.md`, not as the contract itself.

**Net: this SEED's scope grows by one concrete, bounded item** -- standardizing the
entry-file-vs-inline-content convention across the 5 drifted sections, giving `funding`/
`opportunity-bank` real identity files, and cleaning the 5 dead temp files is small enough to
be a `/gsd-quick` fix whenever picked up, independent of the larger provenance-graph/pattern-
threshold questions above. Full trail: `~/MindrianRooms/rethinking-mindrianos/research/
2026-08-28-icm-architect-room-structure/` (same file, audit results appended).

## One real, checked gap: the walk test fails for a tool-less cold agent

The tool's walk test ("open the root, answer *where am I* and *where do I go for the current
task* within the entry file plus at most two more reads") passes for any host with MCP tool
access (Claude Code, Cowork) -- routing is computed live via `room_state`/`suggest_next`, a
genuinely stronger mechanism than a static file for those hosts. It fails for a foreign host
without those tools: `ROOM.md` has zero routing content, `STATE.md` is the generated status
map but does not say "go here for task X" the way the tool's own Context-map entry file does.
Same class of gap already found and fixed for skills this session (the
`${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?}}` fail-closed wrapper exists for exactly this:
a foreign host cannot assume Claude-Code-specific machinery).

## Two mechanisms proposed, one already built -- do not silently re-propose it

1. **A durable, append-only "approved event history" alongside a rebuildable derived
   index.** ALREADY BUILT: `memory_event` (typed nodes written exclusively through
   `lib/core/navigation.cjs`'s Part 9 chokepoint) is exactly this, and arguably stronger than
   the navigator's proposed separate `events.jsonl` (one queryable graph representation,
   nothing to keep in sync). Do not build a parallel event-log mechanism; Phase 273's job is
   making `memory_event`'s write path reliable (its 5 Critical bugs), not inventing the
   concept.
2. **"Patterns require three independent occurrences" as a confirmation gate** (from
   `forms.md`'s Context Map form) before a detected signal graduates from `PROPOSED` to a
   confirmed pattern node. **RESOLVED (2026-08-28), reuse-check closed, both legs checked
   directly:**
   - **Code:** all five candidate files read in full via `grep`. None implements this
     pattern. `voice-transition-detector.cjs:99` does the OPPOSITE deliberately ("SWITCH
     always passes on the first occurrence"). `rs-fetcher-experts.cjs` has an adjacent but
     different mechanism (`paper_count`/citation-count ranking, a continuous score, not a
     discrete PROPOSED->CONFIRMED state-machine gate). `icm-forest.cjs`, `graph-backfill.cjs`,
     `scheduled-scanner.cjs` only use "occurrence" in unrelated senses (co-occurrence
     dedup, disclosure timestamps). **Confirmed gap, not already built** -- Canon Part 7
     satisfied, safe to design fresh if picked up.
   - **Grounding (langtalks-graph-expert, per the standing consult rule, bound together with
     icm-architect this session):** `get_entity` on "Pattern Detection", "Evidence
     Threshold", "Signal Aggregation", and "Confidence Score" all returned `found: false` --
     honest "not in the corpus yet" across the board, per the tool's own contract. One
     adjacent hit on "Deduplication" (citing the user's own prior "LangExtract and
     Orphan-Prevention in Knowledge Graphs" note and the "Toward Robust GraphRAG" paper
     already cited elsewhere this session) -- relevant to node-identity dedup, not to
     occurrence-count pattern confirmation specifically. **No external literature grounding
     available for this exact mechanism.** If built, it would be designed from icm-architect's
     stated principle directly, not from a richer cited precedent -- worth knowing before
     scoping it, not a blocker.

## What this is NOT proposing

Not a recommendation to install `icm-architect` as a skill or restructure any room through
it. MindrianOS's room scaffolding (`lib/core/room-skeleton-scaffold.cjs`, `lib/core/section-
registry.cjs`) already implements the schema-driven-scaffold equivalent of the tool's
Build-mode/Record-library "copy the template" move, through generated code rather than a
conversational skill. The value here is validation, vocabulary, and one genuinely open
reuse-check -- not a build mandate.

## Cross-references

- `rethinking-mindrianos/research/2026-08-28-icm-architect-room-structure/` -- full trail.
- `~/MindrianOS/research/2026-08-28-icm-architect-room-structure/` -- source-of-record mirror.
- `github.com/RinDig/icm-architect` -- the reference implementation.
- SEED-075 (`icm-semantic-substrate-provenance-dependency-graph.md`) -- the SQLite-substrate
  half of the same paper's Section 6 agenda; this SEED is the room-structure half. Siblings,
  not duplicates.
- Phase 273 (`.planning/ROADMAP.md`) -- owns `memory_event`'s write-path reliability; this
  SEED does not re-propose the event-log concept Phase 273 is already hardening.
- Phase 270's ROADMAP.md OQ-7 entry -- the team-execution/Mentor-Profiles drift finding this
  note independently confirms as a named ICM anti-pattern.
- Phase 271/274 -- the reference-integrity discipline already reinvented there.
- `docs/MWP-SPECIFICATION.md:15,25,532` -- MindrianOS's own prior citation of the shared
  founding paper.
