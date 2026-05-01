# Phase 99: Conversation Operator State Machine - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning
**Source:** PRD Express Path — research file at `~/MindrianRooms/mindrian/mindrianOS/research/2026-04-30-tui-and-ruling-system/03-phase-95-2-conversation-operator-state.md` (renumbered 95.2 → 99 to match Phase 100's `lib/conversation/operator.cjs` dependency expectation per `100-CONTEXT.md` D-01). Interactive `/gsd:discuss-phase 99` skipped per session directive (`--auto`); recommended defaults applied.
**Milestone:** v1.12.3 dependency layer (sequenced before Phase 100 execution)
**Canon Parts:** Part 3 (Tri-Context Decision Gate), Part 4 (Every Choice Is Graph Data), Part 7 (Reuse Before Build)
**Depends on:** Phase 95 (cascade side-channel pattern; SHIPPED v1.12.0), Phase 95.1 (UI Ruling System wrap rules; SHIPPED v1.12.1-beta.1)
**Consumed by:** Phase 100 (`lib/hmi/jtbd-classifier.cjs` reads operator as classifier input D-04 strata 2), Phase 102 (renderer signature `render(zones, mode, operator, tier)`), Phase 95.1 polling (drift class F UI compliance — operator-aware shape selection), Sprites Workspace v2.0 (UI-mode source of truth)

<domain>
## Phase Boundary

Make the conversation operator state machine explicit, persistent, and queryable. Today Larry infers the operator implicitly per turn from context — same `/mos:status` invocation produces different output depending on what Larry happened to be doing. Phase 99 makes the operator a first-class state primitive so the wrap rules (Phase 95.1), the renderer (Phase 102), the JTBD classifier (Phase 100), and the compliance poller (Phase 105) all read deterministically against the same source of truth.

Five operators ship in Phase 99:

```
JUST_TALK          No room work. Pure dialogue. No 4-zone, no Zone 4, no Intelligence Strip.
EXPLORE_CAPTURE    Conversation ranging; Larry listening for filable insights. Prose during talk;
                   Shape E only on crystallization with Shape F.4 confirmation gate.
BUILD_ROOM         Active room work. Filing live. Every Larry response ends with 4-zone anatomy
                   + Zone 4 footer; Intelligence Strip surfaces if signals are HIGH.
METHODOLOGY        A specific /mos: framework owns the screen. No shape mid-session;
                   Shape E or F at gate points only. Banned: spontaneous Zone 4 footers.
DECISION_GATE      Shape F.x active. User must pick a verb. Keyboard input only. No prose.
```

**Scope inclusions:**
- `lib/conversation/operator.cjs` — state read/write/transition primitive. Public API: `getCurrent()`, `transition(to, trigger)`, `validate(transition)`, defaults to `JUST_TALK` if file absent.
- `lib/conversation/classifier.cjs` — heuristic NL classifier (no LLM round-trip). Detects operator transitions from user messages + tool invocations.
- `<roomDir>/.mindrian/conversation-operator.json` — per-room persisted state (current, previous, entered_at, context, history bounded at 50 entries).
- `commands/operator.md` + `scripts/operator-command.cjs` — `/mos:operator` Shape E inspection, `/mos:operator set <op>` Shape F.1 picker, `/mos:operator reset` returns to JUST_TALK.
- Hook integration: SessionStart restores filing context if BUILD_ROOM; Stop persists operator; PostToolUse updates operator on transitions (e.g., methodology completion → BUILD_ROOM).
- Renderer signature contract: `render(zones, mode, operator, tier)` — Phase 99 ships the operator parameter; Phase 102 ships the renderer that consumes it.

**Scope exclusions (deferred):**
- LLM-backed classifier (deferred to v1.15.x; Phase 99 ships heuristic baseline; same gate pattern as Phase 100 D-03).
- Cross-session operator continuity beyond simple persist/restore (Phase 103 memory layer absorbs this).
- Multi-agent operator inheritance for GSD wave executors (Phase 104 per-command UI wrapping handles this via subagent inheritance contract).
- Voice I/O and TUI-specific renders (out of v1.12.3 milestone scope per kickoff §What v1.12.3 does NOT include).

</domain>

<decisions>
## Implementation Decisions

### Phase numbering and naming

**D-01 (numbering):** **Phase 99** (integer), not 95.2. Reason: Phase 100's `100-CONTEXT.md` D-01 explicitly names "Phase 99" as the dependency provider; aligning the numbering eliminates the cross-reference mismatch flagged in file 09 H1 (Phase 103 risk brief). Research file 03 was written before this dependency surfaced. Slug: `99-conversation-operator-state-machine`.

**D-02 (sequencing intent):** **Phase 99 sequences before Phase 100 execution begins**, not before Phase 100 scaffolding (which has already happened). Phase 100 plans assume `lib/conversation/operator.cjs` exists at execution time. If Phase 99 has not landed when Phase 100 execution begins, Phase 100 is graceful-degraded per its own D-01 fallback ("If absent, classifier degrades to user-message + STATE.md only"). Graceful degradation is the SAFETY contract; clean sequencing is the GOAL.

### Operator taxonomy

**D-03 (operator set):** **Five operators (JUST_TALK / EXPLORE_CAPTURE / BUILD_ROOM / METHODOLOGY / DECISION_GATE)** as specified in research file 03 §The five operators. No additions. The set IS the canon. Any 6th operator requires a Gate 1 review after Phase 99 ships.

**D-04 (cold-start default):** **`JUST_TALK`** when state file is absent. Reason: matches the principle that filing is opt-in, not opt-out. New rooms, fresh sessions, and never-touched conversations start in dialogue mode. BUILD_ROOM has to be earned (user must say yes to a Shape F.4 file gate or explicitly enter via `/mos:room <section>`).

### State file design

**D-05 (state location):** **Per-room at `<roomDir>/.mindrian/conversation-operator.json`**, NOT global. Reason: different rooms run different conversations (mindrianOS deep-dives in METHODOLOGY; mindrianos-venture pitch prep in BUILD_ROOM; ad-hoc rooms in JUST_TALK). Mirrors Phase 100's per-room jtbd-state pattern (D-06 in `100-CONTEXT.md`) and Phase 95's `.mindrian/last-cascade.json` precedent. The room IS the operator scope.

**D-06 (state schema):**
```json
{
  "schema_version": "1.0.0",
  "current": "JUST_TALK",
  "previous": null,
  "entered_at": "2026-05-01T...",
  "context": {
    "active_room": "<roomName>",
    "active_section": null,
    "methodology_in_flight": null,
    "decision_gate_pending": null
  },
  "history": [
    { "op": "JUST_TALK", "from": "...", "to": "...", "trigger": "session_start|user_message|/mos:command|operator_change|hook" }
  ]
}
```

History is bounded at 50 entries (matches Phase 100 D-07); older transitions are dropped, NOT promoted to across-session memory in this phase (Phase 103 owns that promotion).

**D-07 (atomic write):** **`mktemp` + `mv -f` pattern** mirroring Phase 95's `write_cascade_side_channel` and Phase 90's BRAIN.md atomic writes. No locks; the state file is small and writes happen per turn (not per token). Frame-budget consideration per file 04: the read path must be cheap (single JSON read, < 1ms target).

### Transition rules

**D-08 (transition table):** **The 7-rule transition table from research file 03 §Transition rules** is authoritative:

```
ANY              → JUST_TALK            user message has no room intent and no methodology trigger
JUST_TALK        → EXPLORE_CAPTURE      user surfaces something filable (entity / fact / person / deadline)
EXPLORE_CAPTURE  → BUILD_ROOM           user says yes to Shape F.4 confirmation OR /mos:room <section>
BUILD_ROOM       → METHODOLOGY          user invokes any /mos: methodology command
METHODOLOGY      → BUILD_ROOM           methodology completes (Shape E filed) OR user types /exit
ANY              → DECISION_GATE        command emits a Shape F selector
DECISION_GATE    → previous              user picks a verb (or Esc to cancel)
```

**D-09 (validation):** Every transition runs through `validate(from, to, trigger)` before write. Invalid transitions (e.g., JUST_TALK → DECISION_GATE without an emitted selector) return an error and the state file is NOT written. The poller (Phase 105) reports validation failures as drift class F violations.

### Classifier architecture

**D-10 (heuristic baseline):** **Heuristic classifier only in Phase 99. No LLM round-trip.** Same reasoning as Phase 100 D-03:
- Frame-budget discipline (file 04 Implication 4): an LLM round-trip per turn breaks the 16ms render frame.
- Tier 0 fallback survives: heuristic runs even when Brain unreachable.
- Determinism: poller (Phase 105) needs reproducible classifications.
- LLM fallback is a v1.15.x candidate; data from heuristic miss-rate informs whether the latency cost is worth the upgrade.

**D-11 (classifier inputs):** Heuristic uses three input strata, in order of weight:
1. **Tool / command markers** — `/mos:` invocation → METHODOLOGY or DECISION_GATE; AskUserQuestion emission → DECISION_GATE; Stop hook → persist current.
2. **User-message intent patterns** — phrase patterns from research file 03 §95.2-02 (e.g., "just talking" / "set this aside" → JUST_TALK; "let's file this" / "add to the room" → BUILD_ROOM).
3. **Entity-introduction signals** — new person/venture/deadline mentions trigger EXPLORE_CAPTURE candidate (overlaps with Phase 102.A entity extractor; coordinated via shared lexicon).

**D-12 (confidence threshold):** **`0.6` to transition** (matches Phase 100 D-05 and research file 03 §95.2-02). Below 0.6, classifier returns `null` → stay in current operator. Above 0.6, transition fires. The same threshold is used by Phase 100's JTBD classifier — single source of truth for "confident enough to act."

### `/mos:operator` command shape

**D-13 (default body shape):** **Shape E (Action Report)** for `/mos:operator` and `/mos:operator history`. Mirrors `/mos:doctor` (Shape E for diagnostic, Phase 95.1 D-18) and `/mos:jtbd` (Phase 100 D-09). Diagnostic + state-inspection commands consistently use Shape E across the plugin.

**D-14 (set body shape):** **Shape F.1 (Next Move)** for `/mos:operator set` to render the 5-operator picker. Manual override path; the operator names ARE the verb options. Reason: matches the "5 plus Free-Text" pattern of Shape F.1 — five canonical operators + "Other" for typing a custom transition (rare; recovery path only).

**D-15 (subcommands):**
- `/mos:operator` — show current state + last 5 history entries (Shape E)
- `/mos:operator history` — show full history (Shape E, longer)
- `/mos:operator set <op>` — manual transition with picker (Shape F.1)
- `/mos:operator reset` — return to JUST_TALK (single confirmation; Shape F.4 collapse)

### Renderer integration contract

**D-16 (renderer signature):** Phase 99 ships the **`operator` parameter contract** that Phase 102's `lib/render/render-v2.cjs` consumes. Phase 99 does NOT modify the renderer; it ships the signature contract + a no-op stub if the renderer hasn't landed yet. Phase 102's plans wire the actual rendering logic per research file 03 §95.2-03:

```
operator == JUST_TALK        → emit prose only
operator == EXPLORE_CAPTURE  → prose; Shape E only on crystallization
operator == BUILD_ROOM       → full 4-zone anatomy
operator == METHODOLOGY      → no shape mid-session; Shape E at gate
operator == DECISION_GATE    → Shape F.x; keyboard only
```

**D-17 (graceful degradation):** If `lib/render/render-v2.cjs` is absent (Phase 102 not yet executed), the operator state file still writes; the renderer integration is a no-op until Phase 102 lands. Phase 99 is independently shippable.

### Hook integration

**D-18 (SessionStart):** Reads operator file; if present and `current == BUILD_ROOM`, surface "you were filing in <section>; resume?" line in Larry's greeting. If absent, defaults to JUST_TALK (D-04).

**D-19 (Stop):** Persists current operator on session end. Mirrors Phase 100's Stop hook persistence (per `100-CONTEXT.md` D-08).

**D-20 (PostToolUse):** Updates operator on tool transitions:
- `/mos:` methodology command invoked → METHODOLOGY (with `methodology_in_flight` set)
- methodology Shape E filed → BUILD_ROOM (with `methodology_in_flight` cleared)
- AskUserQuestion emitted → DECISION_GATE (with `decision_gate_pending` set)
- AskUserQuestion answered → previous operator restored

### Canon Part 4 graph-data integration

**D-21 (typed edges):** Every operator transition writes a typed edge to the local graph (`<roomDir>/.room-graph/`). Edge type: `OPERATOR_TRANSITION`. Properties: `from`, `to`, `trigger`, `timestamp`, `entities_introduced[]` (if EXPLORE_CAPTURE→BUILD_ROOM), `methodology` (if BUILD_ROOM→METHODOLOGY). Reuses Phase 27.1 SQLite local graph adapter; no schema change needed.

**D-22 (Canon Part 8 boundary):** Operator transitions are LOCAL only. Never written to Brain. Cross-room operator-pattern queries (if ever built) would carry only generic operator names (the 5-element vocabulary is generic, not user-content) — but this is deferred to v1.13.x at earliest. Phase 99 does NOT touch Brain.

### Frame-budget compliance (file 04)

**D-23 (read budget):** `getCurrent()` reads the JSON file once per turn, target < 1ms. The file is small (< 4KB at 50-entry history bound). Cached read in process memory if same-turn re-read happens. No Brain query, no Pinecone lookup, no remote call.

**D-24 (write budget):** `transition()` writes are async-fire-and-forget where possible (Stop hook is sync; PostToolUse is sync; user-message classifier is sync but heuristic). Write budget < 5ms target.

### Claude's Discretion

**D-25 (classifier corpus):** The 50-message hand-labeled test corpus referenced in research file 03 §95.2-02 acceptance criterion is Claude's discretion to assemble. Recommended sources: the Justin Stitzlein onboarding session 2026-04-30, Lawrence's curriculum review sessions, Austin's research workflows. > 80% accuracy gate.

**D-26 (history ring-buffer rotation):** Bound at 50 entries (D-06). Rotation strategy (drop oldest vs compact every 10) is Claude's discretion. Default to drop-oldest for simplicity.

**D-27 (entity-introduction signal share):** Phase 102.A's entity extractor and Phase 99's classifier both watch for new entities in user turns. Coordination is Claude's discretion; recommended pattern is a shared `lib/conversation/entity-signals.cjs` helper that both consume. Defer the helper to Phase 102.A; Phase 99 ships an inline regex matcher.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Plugin canon and policy

- `docs/MINDRIAN-CANON.md` — Part 3 (Tri-Context Decision Gate, DECISION_GATE locks Shape F.x), Part 4 (every operator transition is graph data), Part 7 (reuse before build — operator state machine wraps existing primitives, does not duplicate them).
- `docs/CANON-PHASE-MAP.md` — Phase 99 will register canon parts 3, 4, 7 in the map after CONTEXT.md commits.
- `CLAUDE.md` — Decision #15 (ROOM.md per directory; the new `lib/conversation/` directory needs ROOM.md), Decision #8 (Tier 0 fully functional — operator state file is graceful when absent).

### Research source documents

- `~/MindrianRooms/mindrian/mindrianOS/research/2026-04-30-tui-and-ruling-system/03-phase-95-2-conversation-operator-state.md` — primary source. Five operators, state file, transition table, 5 plans pre-sketched (95.2-01 through 95.2-05 → mapped to 99-01 through 99-05).
- `~/MindrianRooms/mindrian/mindrianOS/research/2026-04-30-tui-and-ruling-system/02-phase-95-1-ruling-system-polling.md` — Phase 95.1 wrap rules that depend on operator state. Drift class F (UI Ruling System compliance) cannot fire deterministically without this phase.
- `~/MindrianRooms/mindrian/mindrianOS/research/2026-04-30-tui-and-ruling-system/04-claude-code-render-model-implications.md` — frame-budget constraints. `getCurrent()` must be cheap (< 1ms target).
- `~/MindrianRooms/mindrian/mindrianOS/research/2026-04-30-tui-and-ruling-system/05-v1-12-3-hmi-milestone-plan.md` — milestone context. Phase 99 is the dependency layer below v1.12.3.
- `~/MindrianRooms/mindrian/mindrianOS/research/2026-04-30-tui-and-ruling-system/09-phase-103-risk-and-readiness-brief.md` §H1 — names Phase 99's absence as a HIGH-severity risk for Phase 103.

### Predecessor and consumer phase artifacts

- **Phase 95** (shipped v1.12.0): `scripts/post-write` atomic write helper + `<roomDir>/.mindrian/last-cascade.json` side-channel pattern. Phase 99 reuses both: the atomic write helper for `conversation-operator.json` writes, the side-channel pattern as the per-room state-file precedent.
- **Phase 95.1** (shipped v1.12.1-beta.1): drift class F UI Ruling System compliance detector. Phase 99 makes this detector deterministic (currently it false-positives on legitimate METHODOLOGY-mode silence).
- **Phase 100** (scaffolded): `lib/hmi/jtbd-classifier.cjs` consumes operator as classifier input D-04 stratum 2 (per `100-CONTEXT.md` D-04). Phase 99 ships the producer; Phase 100 is the consumer.
- **Phase 102** (scaffolded): `lib/render/render-v2.cjs` consumes operator via `render(zones, mode, operator, tier)` signature. Phase 99 ships the contract; Phase 102 wires the rendering logic.
- **Phase 102.A** (NEEDS SCAFFOLD): NL trigger layer respects operator (suppresses Tier 3 inline suggestions in JUST_TALK; surfaces in EXPLORE_CAPTURE; suppresses again in METHODOLOGY).
- **Phase 105** (scaffolded): HMI compliance polling validates operator-aware shape selection.

### Reference implementations

- `lib/core/decision-capture.cjs` — typed-edge writer pattern. Phase 99 reuses for the OPERATOR_TRANSITION edge type.
- `lib/core/brain-derivation.cjs` (Phase 90 v1.10.18) — atomic JSON write + readQuadruple staleness check pattern. Phase 99 mirrors the atomic write half (no Brain involvement).
- `scripts/post-write` (Phase 95) `write_cascade_side_channel` — direct precedent for `.mindrian/conversation-operator.json` writes.
- `scripts/jtbd-update.cjs` (Phase 100, scaffolded) — UserPromptSubmit + Stop hook entry-point pattern. Phase 99's `scripts/operator-update.cjs` mirrors the structure; same hook lifecycle.

### UI Ruling System

- `skills/ui-system/SKILL.md` — Shape E (Action Report), Shape F.1 (Next Move) contracts. `/mos:operator` outputs MUST conform.
- 12-glyph vocabulary + 5-color palette + 4-zone anatomy. Phase 99's command output is subject to the same drift detection (Phase 95.1 class F) it enables.

### Test fixtures

- `test/fixtures/cascade-surface-e2e/` (Phase 95.1-01) — sibling pattern. Phase 99's fixture is `test/fixtures/conversation-operator/` with seed-room layout containing `.mindrian/` empty (to test cold-start default), `.mindrian/conversation-operator.json` partially filled (to test resume), and synthetic transition sequences.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets

- **`scripts/post-write` (Phase 95):** atomic write helper (`write_atomic_json`). Phase 99-01 wraps for `conversation-operator.json` writes.
- **`lib/core/decision-capture.cjs`:** typed-edge writer that writes to `<roomDir>/.room-graph/`. Phase 99-01 reuses for `OPERATOR_TRANSITION` edges.
- **`hooks/run-hook.cmd` + `hooks/hooks.json`:** existing SessionStart / PreCompact / PostCompact / Stop / PostToolUse hook entries. Phase 99-04 adds operator-aware behavior to the existing entries; no new top-level hook.
- **`lib/core/cross-room-aggregator.cjs` sanitization helpers:** the boundary-check patterns that prevent local content reaching Brain. Phase 99 uses these defensively even though it does not query Brain (D-22) — defense-in-depth per Canon Part 8.
- **Phase 100's planned `lib/hmi/jtbd-state.cjs`:** parallel pattern for `lib/conversation/operator.cjs`. Same per-room JSON, same atomic write, same hook lifecycle. Phase 99-01 deliberately mirrors so the codebase has a single coherent state-primitive convention.

### Established patterns

- CJS only, zero new runtime dependencies (Phase 87 invariant).
- Atomic writes via `mktemp` + `mv -f` (Phase 95 invariant).
- Per-room state files at `<roomDir>/.mindrian/<name>.json` (Phase 95 + Phase 100 precedent).
- Graceful degradation per Canon Part 3 — every layer fails safe; absent file → JUST_TALK default; absent renderer → no-op contract; absent local graph → state writes still happen but edges deferred.
- 3-line error per Canon Part 3 Rule 2 when `getCurrent()` fails (corrupt JSON, etc.).

### Integration points

- **`lib/conversation/`** — NEW directory. Needs `ROOM.md` per Decision #15. Holds `operator.cjs`, `classifier.cjs`, `entity-signals.cjs` (deferred to 102.A).
- **`commands/operator.md`** — NEW slash command spec. Frontmatter follows `commands/doctor.md` Phase 95.1-04 pattern (Shape E declaration, argument-hint, disable-model-invocation false).
- **`scripts/operator-command.cjs`** — NEW script. Command-line entry point invoked by `commands/operator.md`. Mirrors `scripts/jtbd-command.cjs` (Phase 100, scaffolded).
- **`scripts/operator-update.cjs`** — NEW script. Hook entry point for UserPromptSubmit + Stop + PostToolUse updates. Mirrors `scripts/jtbd-update.cjs`.
- **`hooks/hooks.json`** — extend existing UserPromptSubmit / Stop / PostToolUse entries to also call operator-update.cjs alongside existing handlers.
- **`<roomDir>/.mindrian/`** — existing per-room directory. New file: `conversation-operator.json`. Coexists with `last-cascade.json`, `jtbd-state.json` (Phase 100), future `session-memory.json` (Phase 103).

</code_context>

<specifics>
## Specific Ideas

- The operator IS the universal HMI substrate. Every other v1.12.3 phase reads against it. Without explicit operator state, the wrap rules (95.1), the renderer (102), the JTBD classifier (100), and the polling (105) all degrade to per-turn re-inference, which is the v1.13.x baseline being replaced.
- The product moment Phase 99 enables: `/mos:status` produces compliant 4-zone output during BUILD_ROOM and bare prose during JUST_TALK, deterministically, without Larry inferring from context. The poller can score the same command against the same operator and know whether the output is correct.
- Sprites Workspace v2.0 will read this state file directly to render the right UI mode (focused single-pane during METHODOLOGY; split Data Room + Larry chat during BUILD_ROOM). The state file IS the contract.

</specifics>

<deferred>
## Deferred Ideas

- **LLM-backed classifier.** v1.15.x candidate. Heuristic baseline ships first; mismatch rate informs whether LLM round-trip is worth the latency cost.
- **Cross-session operator continuity.** Phase 103 memory layer absorbs session-boundary operator state into the broader memory schema. Phase 99 ships per-session persistence only.
- **Multi-agent operator inheritance.** Sub-agents invoked during METHODOLOGY should inherit parent operator. Phase 104 per-command UI wrapping handles this; Phase 99 does not.
- **`/mos:operator policy` command.** A user-facing way to declare per-room defaults (e.g., "this room defaults to BUILD_ROOM not JUST_TALK"). v1.13.x candidate. Today the cold-start default is hardcoded JUST_TALK (D-04).
- **Operator-aware skill activation.** Skills like `room-proactive` and `room-passive` could bind themselves to specific operators. Phase 99 does not change skill activation; that's a v1.13.x architecture question.
- **Entity-introduction shared lexicon (`lib/conversation/entity-signals.cjs`).** Phase 99 ships an inline regex matcher; Phase 102.A consolidates into a shared helper. Tracked in Phase 102.A.

### Reviewed Todos (not folded)

None — no pending todos matched Phase 99 in the gsd-tools registry.

</deferred>

---

*Phase: 99-conversation-operator-state-machine*
*Context gathered: 2026-05-01 via PRD Express Path (research file 03 + auto-defaults)*
*Canon parts: 3, 4, 7*
