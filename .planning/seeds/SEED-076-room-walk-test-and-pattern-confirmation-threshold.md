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
   confirmed pattern node -- NOT verified either way against live code. Several files have
   occurrence/threshold-shaped names (`lib/core/icm-forest.cjs`, `lib/core/graph-
   backfill.cjs`, `lib/core/scheduled-scanner.cjs`, `lib/core/rs-fetcher-experts.cjs`,
   `lib/core/voice-transition-detector.cjs`) but none were read in full to confirm or rule
   out an existing N-occurrence gate. **This SEED's first concrete action, if picked up:
   read those five files and settle whether this already exists before writing a single new
   line** (Canon Part 7).

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
