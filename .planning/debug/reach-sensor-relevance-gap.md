---
status: investigating
kind: rca
trigger: "reach-sensor-relevance-gap"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: tier-0
canon_parts: [2, 3]
created: 2026-07-17T00:00:00Z
updated: 2026-07-17T00:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** dev workspace `/home/jsagi/dev/MindrianOS-Plugin` @ dev HEAD, 2026-07-17. This filing has NOT yet read `lib/core/navigation-engine.cjs`, `lib/core/insight-sensors.cjs`, `lib/core/sensors/*.cjs`, or `scripts/intent-classifier.cjs` line-by-line -- it is filed from live, verbatim observational evidence captured across one long session's actual system-reminders, not from a code read. The debugger's first job is the code-level root-cause; this file supplies real symptom transcripts, not a guess at the mechanism.
- **WIRE claims probe against:** n/a, Tier 0 confirmed in every observed instance ("BRAIN.md absent" / "SIGNAL (none this turn)"), no Brain calls implicated.
- **Date of audit:** 2026-07-17.
- **Re-verification rule:** every symptom below is a verbatim excerpt from this session's own actual system-reminders, not paraphrased from memory.

## Current Focus

hypothesis: two related but possibly-independent manifestations of the same root gap (a per-turn sensor/gate firing without checking relevance to the live conversation), living in different code:
  (A) the session-binding gate ("session unbound: choose which room(s) this session writes to") re-fired on effectively every turn across an entire long session, each time showing a DIFFERENT randomized subset/ordering of rooms, despite the session having been explicitly bound early on via `room_bind` (confirmed success: `{"ok":true,"bound":true,"primary":"rethinking-mindrianos","source":"explicit"}`). Phase 225 (per-session-room-binding-and-multi-session-reconciliation, `.planning/phases/225-...`) already closed a related zero-score gate bug (SEED-039 proving_case_2) -- this may be a DIFFERENT gap Phase 225 didn't cover (binding state not being checked/consulted at all, vs. the zero-score fallback Phase 225 fixed), or Phase 225's fix may not apply to this session's actual invocation path (MCP session vs. CLI session -- this session used mindrian-os MCP tools, `room_bind` specifically).
  (B) the REACH/navigation sensor (`fire_skill`/`routing_source: engine` blocks) surfaced cold-start reach suggestions tied to rooms/claims with zero topical connection to the live conversation (e.g. a room named "iris2026" and a claim id, while the live conversation was about an unrelated Windows-testing/skill-optimization thread) -- these carried their own `[FIRE-IF-FORK]` instruction telling the model to judge relevance before firing the card, meaning the SENSOR layer itself does not filter for relevance; a downstream judgment layer (the model reading the instruction) is the only filter, and it is advisory text, not a structural check.
test: read `lib/core/navigation-engine.cjs`'s `decide()` function and `scripts/intent-classifier.cjs`'s binding-gate logic (the `UserPromptSubmit` tripwire referenced in `.planning/debug/intern-qa-silent-degrade-pattern-three-independent-sessions-2026-07-14.md`'s Eliminated section) to determine: (1) for (A), whether session-bound state is ever actually consulted before re-emitting the binding gate, and whether this session's MCP-tool `room_bind` call updates whatever state the CLI-side gate reads; (2) for (B), whether `dispatchSensors`/the reach-candidate resolver has ANY structural relevance check (comparing the candidate reach's room/topic against the live conversation) versus relying entirely on the `[FIRE-IF-FORK]` advisory text for the model to self-filter.
expecting: (A) and (B) may turn out to be genuinely separate bugs in separate files (session-binding state plumbing vs. reach-candidate relevance filtering) rather than one shared root cause -- the debugger should confirm or split this filing accordingly rather than forcing a single fix.
next_action: read the three named files, confirm the actual mechanism for both (A) and (B), determine whether Phase 225's existing fix (`.planning/phases/225-...`) already covers (A) and this is a regression or an uncovered case, then bring findings + fix options to the navigator.

## Meta

- Repo: `/home/jsagi/dev/MindrianOS-Plugin`
- Plugin version: v1.15.3-beta.27 (dev HEAD) / v1.15.3-beta.24 (this session's actual running install, per its own SessionStart hook)
- Reported by: this session, live, observed across dozens of turns
- Date first observed: this session, 2026-07-17 (not independently checked against prior sessions)
- Related: `.planning/phases/225-per-session-room-binding-and-multi-session-reconciliation-se/` (the existing SEED-039 gap-closure work on session binding -- (A) may or may not already be covered); `.planning/debug/card-fire-relevance-check-gap.md` (the sibling filing for `check-card-fire.cjs`'s own relevance gap -- CONFIRMED this session to be a structurally similar but NOT code-identical mechanism: check-card-fire keys off a render-coverage-registry + an output-text backstop, not the REACH sensor's own output, so this filing and that one are same-class, different-code, per that filing's own Eliminated section)

## Problem Statement

Per-turn navigation machinery (the session-binding gate and the REACH/reach-candidate sensor dispatch) generates user-facing prompts/suggestions without a structural check that the content is actually relevant to the live conversation. The only filter observed is advisory instruction text telling the model to judge relevance itself before dispatching a card -- which worked in this session only because the model consistently applied that judgment, not because the underlying mechanism enforces it.

## Symptoms

expected: the binding gate fires once (or when session state genuinely changes), not on every turn with a different random room subset; REACH suggestions surface content topically connected to the live conversation, or nothing at all.

actual, verbatim from this session's own system-reminders:

Binding gate, three separate instances (same session, different turns, non-identical room lists each time -- note the room orderings/subsets differ across all three despite no binding-relevant action occurring between them):
```
Turn N:   ✓ 1. untitled-2026-06-01-1702 / ▢ 2. haim-battlefield-intake / ▢ 3. rethinking-mindrianos / ▢ 4. dhi-prolonged-field-care
Turn N+9: ▢ 1. pws-website / ▢ 2. mindrianOS / ▢ 3. align-ecosystem / ▢ 4. iia-deeptech-centers
Turn N+18:✓ 1. haim-battlefield-intake / ▢ 2. rethinking-mindrianos / ▢ 3. untitled-2026-06-01-1702 / ▢ 4. iris2026
```
All three carry: "session unbound: choose which room(s) this session writes to" -- despite `room_bind` having returned `{"ok":true,"bound":true,"primary":"rethinking-mindrianos"}` earlier in the same session.

REACH sensor, cold-start suggestion with zero conversational connection (session was mid-way through a Windows-update-testing conversation, not touching the room or claim named):
```
fire_skill: Run Methodology
■ iris2026 - REACH - decision gate
▼ LOCAL iris2026 (cold) / BRAIN (offline) / SIGNAL (none this turn)
New room - nothing to rank yet. Start anywhere.
→ Choose next reach: ▷ Borrow what iris2026 learned about claim:derive:5c15cde4...
```
error message: none (not a hard error/block -- unlike layer 1, this is a soft over-suggestion, not a hard-fail).
timeline: observed continuously across one long session, 2026-07-17.
reproduction: not yet reduced to a minimal repro -- observed as a standing characteristic of every turn in a long multi-topic session, not tied to one specific action.

## Eliminated

- hypothesis: this is literally the same code path as `check-card-fire.cjs`'s over-firing (layer 1).
  evidence: `.planning/debug/card-fire-relevance-check-gap.md` confirmed `check-card-fire.cjs`'s primary detection keys off `data/render-coverage-registry.json` gate-reaching entries and a separate output-text backstop -- neither reads the REACH sensor's own suggestion content as its trigger. Same failure CLASS (fires without a relevance check), different code. Rejected as literally the same bug.
  timestamp: 2026-07-17T00:00:00Z
