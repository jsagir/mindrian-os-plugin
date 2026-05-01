# Phase 99: Conversation Operator State Machine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 99-conversation-operator-state-machine
**Mode:** `--auto` (PRD Express Path; research file 03 fully specified)
**Areas auto-resolved:** Phase numbering, Operator taxonomy, State file design, Transition rules, Classifier architecture, Command body shapes, Renderer contract, Hook integration, Graph-data integration, Frame-budget compliance

---

## Phase numbering and naming

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 95.2 | Original numbering from research file 03 (sequenced after 95.1) | |
| Phase 99 | Renumber to align with Phase 100's `100-CONTEXT.md` D-01 dependency reference | ✓ |
| Phase 98 | Pick a different integer | |

**Auto-selected:** Phase 99 — recommended because Phase 100's CONTEXT explicitly names "Phase 99" as the dependency provider, and file 09's H1 risk brief calls out the cross-reference mismatch as a HIGH-severity concern. Renumbering eliminates the drift.

---

## Operator taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| 4 operators (collapse EXPLORE_CAPTURE into BUILD_ROOM) | Simpler model, more ambiguous filing-vs-talking boundary | |
| 5 operators per research file 03 | JUST_TALK / EXPLORE_CAPTURE / BUILD_ROOM / METHODOLOGY / DECISION_GATE | ✓ |
| 6+ operators (add VOICE / TUI variants) | Future-proof for v2.0 Workspace; over-scoped now | |

**Auto-selected:** 5 operators — recommended per research file 03 §The five operators. Lower count loses the EXPLORE_CAPTURE boundary the wrap rules need; higher count over-scopes pre-v2.0.

---

## Cold-start default

| Option | Description | Selected |
|--------|-------------|----------|
| JUST_TALK | Filing is opt-in; new rooms start in dialogue | ✓ |
| EXPLORE_CAPTURE | Default to ambient listening | |
| BUILD_ROOM | Aggressive — assume user wants to file from turn 1 | |
| Last operator from any sibling room | Cross-room continuity (out of scope; Phase 103 owns this) | |

**Auto-selected:** JUST_TALK — recommended because BUILD_ROOM has to be earned (user opt-in via Shape F.4 or `/mos:room <section>`). Matches the principle that filing is opt-in, not opt-out.

---

## State file location

| Option | Description | Selected |
|--------|-------------|----------|
| Per-room at `<roomDir>/.mindrian/conversation-operator.json` | Mirrors Phase 100 jtbd-state.json + Phase 95 last-cascade.json | ✓ |
| Global at `~/MindrianRooms/.memory/conversation-operator.json` | Cross-room operator state | |
| In-memory only | No persistence (lost on session boundary) | |

**Auto-selected:** Per-room — recommended because different rooms run different conversations, and the room IS the operator scope. Matches the established per-room state-file precedent (Phase 95, Phase 100 D-06).

---

## Atomic write pattern

| Option | Description | Selected |
|--------|-------------|----------|
| `mktemp` + `mv -f` | Phase 95 invariant; zero new runtime deps | ✓ |
| Lock file + write | Adds locking complexity for a small file with infrequent writes | |
| Write-Ahead Log | Over-engineered for state-file scale | |

**Auto-selected:** mktemp + mv -f — recommended per Phase 95 atomic write helper. Direct precedent. No new dependencies.

---

## Classifier architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Heuristic only | Tool/command markers + intent patterns + entity signals; deterministic; cheap | ✓ |
| LLM round-trip | Higher accuracy; breaks 16ms render frame; non-deterministic | |
| Hybrid (heuristic with LLM fallback at borderline) | Phase 100 D-03 deferred this to v1.15.x; Phase 99 follows the same gate | |

**Auto-selected:** Heuristic only — recommended per file 04 frame-budget discipline, Tier 0 fallback survival, and poller determinism (Phase 105). LLM upgrade is v1.15.x candidate.

---

## Confidence threshold

| Option | Description | Selected |
|--------|-------------|----------|
| 0.5 | Lower bar; more transitions; more false positives | |
| 0.6 | Matches Phase 100 D-05 + research file 03 §95.2-02 | ✓ |
| 0.7 | Higher bar; matches Canon Part 3 RECOMMENDED gate; suppresses many transitions | |

**Auto-selected:** 0.6 — recommended for cross-system consistency. Phase 100's JTBD classifier uses the same threshold; using a different one creates an asymmetry the poller cannot reconcile.

---

## `/mos:operator` body shape

| Option | Description | Selected |
|--------|-------------|----------|
| Shape E (Action Report) for inspection; Shape F.1 (Next Move) for set | Mirrors `/mos:doctor` + `/mos:jtbd` patterns | ✓ |
| Shape D (Document View) for inspection | Operator state IS the document — one alternative reading | |
| Shape C (Comparison) for inspection | Show all 5 operators side by side; over-scopes | |

**Auto-selected:** Shape E inspection + Shape F.1 set — recommended because diagnostic + state-inspection commands consistently use Shape E across the plugin (see Phase 95.1 D-18 for `/mos:doctor`, Phase 100 D-09 for `/mos:jtbd`).

---

## Subcommand surface

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: `/mos:operator` only | Just the inspection command | |
| Standard: show / history / set / reset | Inspection + manual override + recovery | ✓ |
| Maximal: + policy / + override-default / + force-transition | Over-scopes for v1 | |

**Auto-selected:** Standard 4-subcommand set — recommended per research file 03 §95.2-05 deliverable spec.

---

## Hook integration scope

| Option | Description | Selected |
|--------|-------------|----------|
| SessionStart only | Restore-only behavior; no per-turn updates | |
| SessionStart + Stop | Restore on start, persist on end; misses mid-session transitions | |
| SessionStart + Stop + PostToolUse | Per-turn transition tracking; full lifecycle | ✓ |
| All hooks (+ PreCompact / PostCompact) | Over-scopes; compact handlers don't change operator state | |

**Auto-selected:** SessionStart + Stop + PostToolUse — recommended per research file 03 §95.2-04. Captures the full transition lifecycle without coupling to compact (which is a memory-layer concern, Phase 103).

---

## Renderer integration timing

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 99 ships renderer logic | Couples Phase 99 to Phase 102 execution; inflates scope | |
| Phase 99 ships contract only; Phase 102 wires logic | Phase 99 independently shippable; contract is `render(zones, mode, operator, tier)` | ✓ |
| Defer renderer integration to Phase 102 entirely | Loses the contract guarantee Phase 102 needs | |

**Auto-selected:** Contract-only — recommended for clean phase boundaries. Phase 99 ships the operator parameter; Phase 102 owns the rendering logic. Each phase is independently shippable.

---

## Graph-data integration (Canon Part 4)

| Option | Description | Selected |
|--------|-------------|----------|
| Skip graph integration; just write state file | Violates Canon Part 4 | |
| Write OPERATOR_TRANSITION typed edge to local graph | Honors Canon Part 4; reuses Phase 27.1 SQLite adapter | ✓ |
| Write to Brain | Violates Canon Part 8 | |

**Auto-selected:** Local typed edge — only Canon-compliant option. Phase 99 reuses `lib/core/decision-capture.cjs` for the edge writer.

---

## Plan structure (matches research file 03 §95.2-01..05)

The 5 plans Phase 99 will scaffold via `/gsd:plan-phase 99 --auto`:

```
99-01-PLAN.md   Operator State Schema + Storage         (lib/conversation/operator.cjs)
99-02-PLAN.md   NL Classifier (heuristic, no LLM)       (lib/conversation/classifier.cjs)
99-03-PLAN.md   Renderer Integration Contract           (signature stub for Phase 102)
99-04-PLAN.md   Operator-Aware Hooks                    (SessionStart + Stop + PostToolUse)
99-05-PLAN.md   /mos:operator command                   (commands/operator.md + scripts/operator-command.cjs)
```

## Claude's Discretion

- D-25: 50-message hand-labeled test corpus assembly (sources: Justin onboarding 2026-04-30, Lawrence curriculum reviews, Austin research workflows).
- D-26: History ring-buffer rotation strategy (drop-oldest vs compact-every-N).
- D-27: Entity-introduction signal share with Phase 102.A — inline regex in 99, shared helper in 102.A.

## Deferred Ideas

- LLM-backed classifier → v1.15.x
- Cross-session operator continuity → Phase 103 memory layer
- Multi-agent operator inheritance → Phase 104 per-command UI wrapping
- `/mos:operator policy` command → v1.13.x
- Operator-aware skill activation → v1.13.x architecture
- Shared `entity-signals.cjs` helper → Phase 102.A

## Notes on `--auto` resolution

This phase was scaffolded via PRD Express Path. Research file 03 was fully specified (5 operators, transition table, schema, 5 plans pre-sketched). The auto-defaults supplied in session context covered every gray area without ambiguity. Interactive `/gsd:discuss-phase 99` was skipped per session directive; recommended defaults applied at every fork.

If subsequent Gate 1 review (after Phase 99 ships) surfaces unanticipated ambiguity, replan via `/gsd:plan-phase 99 --gaps` or `/gsd:replan-phase 99`.
