---
phase: 119
slug: room-as-receipt-invariant
status: scoped (ready for /gsd:plan-phase 119)
created: 2026-05-05
updated: 2026-05-16
milestone: v1.13.0
beta_target: final (runs in the Wave 2 remainder set before Phase 121.5 capstone)
canon_parts: [Part 2, Part 6, Part 10]
depends_on: [Phase 114 larry-default-activation (shipped beta.2), Phase 115 owned-emotion-dual-path-first-touch (shipped beta.2), Phase 117 auto-explore-domains-on-first-material (shipped beta.8), Phase 118 30-second-mva-reward-before-investment (shipped beta.17)]
dependents: [Phase 121.5 terminal-coherence-capstone (the v1.13.0 capstone)]
estimated_days: 1-2
discuss_phase_completed: 2026-05-16 (six decisions D-01..D-06 locked via /gsd:discuss-phase)
---

# Phase 119 -- Room-as-Receipt Invariant

**STATUS:** SCOPED 2026-05-16. Six decisions locked via discuss-phase pass on top of the 2026-05-05 stub. Ready for `/gsd:plan-phase 119`.

## Phase Boundary

Auto-`/mos:new-project` wrapper that flips the sequence from "create a room first" to **"receive a room as the receipt of conversation."** When a user's first material upload lands in a no-active-room state, Phase 117's existing detector fires AND Phase 119 rides alongside to create a placeholder room as a side effect. Architecture stays visible and useful (per Jonathan's 2026-05-05 correction: "rooms not need to be invisible! But part of process not the process"); FRAMING changes from "create a room first" to "receive a room as the receipt of conversation."

Canon Part 10 sub-claim 3 ("rooms are receipts, not entry points") -- this phase is its implementing surface.

### IN SCOPE
- Hook into Phase 117's first-material detector as a sibling side-effect action (D-01)
- Detect "first material upload AND no active room" -- same detector Phase 117 already wired
- Auto-invoke `/mos:new-project` machinery with a placeholder name `untitled-{YYYY-MM-DD-HHMM}` (D-04)
- Populate `room.db` from Phase 117's auto-explore output + Phase 118's 30-second MVA pipeline output
- Generate `STATE.md` + `MINTO.md` skeleton scaffolding even when material is thin (D-05)
- Surface F.1 selector after first MVA pipeline completes: name with LLM-suggested / type your own / keep as untitled / discard room (D-06)
- Gentle nudge surface after N venture-shaped turns without upload (D-02): F.1 selector suggesting upload, `/mos:new-project`, or keep talking

### OUT OF SCOPE
- Sub-room auto-budding (SEED-001, deferred to v1.14.0)
- Multi-room user wizard (defer until power users need it)
- Project rename UX from outside the first-F.1 surface (existing `/mos:rooms rename` covers post-creation rename)
- Auto-create rooms from prompts-without-material directly (D-01 explicitly rejects this; the D-02 nudge is the only path for prompt-only sessions)
- Cross-room learning / suggestion -- Canon Part 8 fence forbids cross-room aggregation

## Implementation Decisions

### Trigger condition (Area 1)

- **D-01:** Phase 119 reuses Phase 117's first-material detector only. Venture-shaped prompts without material do NOT auto-create rooms. The room-create hook is a sibling side-effect of Phase 117's existing trigger, not a parallel detector.
- **D-02:** After N venture-shaped turns without upload (N defaults to 3; configurable), Larry surfaces a gentle F.1 selector: `[upload material]` / `[/mos:new-project]` / `[keep talking]`. "Venture-shaped" is detected via reuse of Phase 115's dual-path signal. This is the ONLY auto-create-adjacent path for prompt-only sessions; D-01 prohibits auto-creating from prompts alone, so D-02's nudge respects the user's agency.

### Inferred name strategy (Area 2)

- **D-03:** Auto-create uses a placeholder name at creation time. The real name is asked retroactively via F.1 selector AFTER the first 30-second MVA pipeline completes. Defers the naming decision until the user has seen value -- aligns with "rooms are receipts not entry points" (Canon Part 10 sub-claim 3).
- **D-04:** Placeholder name pattern is `untitled-{YYYY-MM-DD-HHMM}` (e.g., `untitled-2026-05-16-1845`). Timestamped, unambiguous, never collides, signals "this needs a real name." Directory becomes `rooms/untitled-2026-05-16-1845/`.

### Failure / ambiguity handling (Area 3)

- **D-05:** Create the placeholder room with skeleton scaffolding even when Phase 117's auto-explore returns thin output. Phase 119's job is to make the user's first action durable, not to gate the room behind material-quality thresholds. Larry's voice acknowledges thinness honestly: "I made a room around this -- it's mostly empty until we have more to work with." Skeleton = minimal `STATE.md` + `MINTO.md` + empty section folders with `ROOM.md` identity files per Canon decision 15.

### Post-creation correction path (Area 4)

- **D-06:** The first F.1 selector after the MVA pipeline completes is the user's first chance to correct the auto-create. Full selector set:
  - `[name this room: <LLM-suggested name from material>]` -- accept the LLM's best guess at a descriptive name
  - `[type your own name]` -- user types a custom name (free-text)
  - `[keep as untitled]` -- preserve the `untitled-{timestamp}` placeholder
  - `[discard room]` -- delete the placeholder + rollback the auto-create (cascade: room.db, STATE.md, MINTO.md, section folders all removed)

  Post-first-F.1, the existing `/mos:rooms rename` and `/mos:rooms archive` commands handle later edits.

### Claude's Discretion

- Exact value of N in D-02 (the venture-shaped-turn nudge threshold) -- planner picks a sensible default in the 2-5 range based on Phase 115/117 conversation-flow telemetry if available, otherwise defaults to 3.
- Phase 117 sibling-hook implementation pattern -- planner picks between (a) Phase 117 emitting a `first_material_detected` memory_event that Phase 119 subscribes to, (b) direct function call from Phase 117's detector into a Phase 119 helper, or (c) shared dispatcher that both phases register with. Researcher should investigate which existing pattern in `lib/core/navigation/` matches.
- F.1 selector layout (CLI rendering vs Desktop conversational vs Cowork shared-state) -- inherits the standard tri-surface adaptation pattern from Phase 88.2.
- LLM-suggested-name source model -- planner picks Haiku 4.5 or similar fast model; cost expected ~$0.0005 per first-MVA completion.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 119 substrate (deps; shipped)
- `.planning/phases/117-auto-explore-domains-on-first-material/117-CONTEXT.md` -- THE existing first-material detector that Phase 119 piggybacks on; D-01 commits to reusing it directly
- `.planning/phases/118-30-second-mva-reward-before-investment/118-CONTEXT.md` -- the 30-second MVA pipeline output that feeds room.db; D-03 references this as the completion signal for the post-creation F.1 selector
- `.planning/phases/115-owned-emotion-dual-path-first-touch/115-CONTEXT.md` -- dual-path "type vs upload" detector; D-02 reuses its "venture-shaped" signal for the nudge surface
- `.planning/phases/114-larry-default-activation/114-CONTEXT.md` -- Larry-by-default surface (the voice that delivers D-05's thinness acknowledgment)

### Phase 119 framing authority
- `docs/MINDRIAN-CANON.md` Part 10 sub-claim 3 (rooms are receipts, not entry points) -- the canonical framing this phase implements
- `docs/CANON-PHASE-MAP.md` Part 10 row for Phase 119 -- the contract this phase delivers against
- `docs/CANON-PART-10-PROPOSAL-conversation-as-product.md` -- the original sub-claim 3 articulation

### Existing room-creation machinery (Phase 119 wraps this)
- `commands/new-project.md` -- the manual `/mos:new-project` command; Phase 119's auto-invocation rides on top
- `commands/rooms.md` -- the post-creation rename/archive surface; Phase 119's discard option (D-06) likely delegates to `/mos:rooms archive` machinery

### Substrate / chokepoint (per Canon Part 9)
- `lib/core/navigation.cjs` -- the SQL chokepoint; ALL writes route through this per Phase 109 invariant
- `lib/core/navigation/memory-events.cjs` -- if Phase 119 needs new event types (e.g., `room_auto_created`, `room_naming_decided`, `room_discarded`), they extend this enum additively per the precedent (Phase 110-03, 124, 125-00, 129)

## Existing Code Insights

### Reusable Assets

- **Phase 117 first-material detector** -- the existing trigger; Phase 119 hooks as a sibling action. Pattern likely lives in `scripts/auto-explore-on-first-material.cjs` or similar (planner verifies).
- **30-second MVA pipeline** (Phase 118) -- the `bin/mva-deck-builder.cjs` + sub-plans 118-02..118-06 surface. Phase 119's "after MVA completes" hook needs to wire into the pipeline's completion event.
- **F.1 selector primitive** (Phase 88.2) -- the four-option layout D-06 uses already has rendering machinery; Phase 119 just declares the option set.
- **`/mos:new-project` machinery** -- the scaffolding logic in `commands/new-project.md` + its backing scripts. Phase 119 invokes this with `--skip-wizard --placeholder-name=untitled-{TS}` or similar flags (planner decides exact contract).
- **`/mos:rooms archive`** -- the discard pathway D-06 delegates to.

### Established Patterns

- **Additive event-type extension** -- precedent set by Phase 110-03, Phase 124, Phase 125-00, Phase 129 (FOLLOWS_FROM from 2026-05-16 dual-graph review). Phase 119's new event types ride this pattern.
- **Tri-surface adaptation** (CLI / Desktop / Cowork) -- inherited; Phase 119 does not invent surface adaptation.
- **Skeleton room scaffolding** -- the existing `/mos:new-project` already produces a minimal room; Phase 119 reuses that minimum and skips the wizard-driven enrichment until the first F.1 selector resolves the name.

### Integration Points

- Phase 117's detector callsite (the place where Phase 119 hooks as a sibling)
- Phase 118 MVA pipeline completion callback (where the post-MVA F.1 selector fires)
- `commands/new-project.md` programmatic invocation contract (the flags Phase 119 passes)
- The room registry / rooms list (where the placeholder `untitled-{TS}` shows up alongside named rooms)

## Specific Ideas

The user's verbatim framing (2026-05-05 + 2026-05-16):
- 2026-05-05: "Rooms not need to be invisible! But part of process not the process."
- 2026-05-16 discuss-phase: "Rooms are receipts not entry points" -- the architectural shorthand from Canon Part 10 sub-claim 3.

The user picked "Phase 117 detector only" (D-01) over the hybrid option, signalling a preference for sharp scope boundaries. The user picked "retroactive naming" (D-03) over LLM-at-creation-time, signalling that the room should appear as cheaply as possible and the naming is a high-context decision deferred until value is delivered.

## Deferred Ideas

- **Sub-room auto-budding** -- SEED-001 captures this; defers to v1.14.0 when the dual-path pattern matures.
- **Auto-create from prompts-without-material** -- D-01 explicitly rejects this; if user demand grows, revisit in v1.14.0 with the matured Phase 115 dual-path signal as the trigger evidence.
- **LLM-suggested name at creation time** -- if the retroactive-naming UX (D-03) feels too slow in practice, revisit; the placeholder + retroactive pattern is the safer ship.
- **Cross-room "you said something similar in Room X"** -- Canon Part 8 forbids cross-room aggregation entirely; never builds.

---

*Phase: 119-room-as-receipt-invariant*
*Context scoped: 2026-05-16 via /gsd:discuss-phase (six decisions D-01..D-06 locked)*
*Pre-scoping stub: 2026-05-05*
