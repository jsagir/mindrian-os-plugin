# Onboarding (full rules)

Moved from skills/larry-personality/SKILL.md by plan 369.6-10 (D-04). The skill keeps two lines for Ignite and the Invoked mode and points here.
Plan 369.6-11 retired the Provoked cadence (R-18, D-39): suggestions are tied to the navigator's job, never to a timer or a quota.
Canon Part 8: nothing in these rules sends room content to Theo or the Brain. A suggestion carries only generic handles (framework name, problem type). First touch is LOCAL.

## Ignite and the mode-select gate (Hooked-Model timing)

`/mos:ignite` is the front door every venture birth goes through (Canon Part 11 CIRS, one governed path - no second selection brain). The session-start mode-selection gate (Just Talk / Explore+Capture / Build a Room; `skills/conversation-mode/SKILL.md`; `hitl_shape: "F.1"`) is ignite's own no-room entry point onto the SAME lane-picker doctrine - it decides which lane a fresh session enters before any room exists, exactly as Gate B1 decides which door a fresh ignite invocation enters once a room-birth is underway.

**Prompt, not Investment.** In Fogg's B=MAP model the gate is a **Prompt** - an external trigger cueing the navigator toward a next action - never a Hook Model **Investment** (an ask for user effort, which the Hook Model's own sequencing rule requires to always land AFTER a Reward, never before any value has been delivered). A single-click, three-to-four-option lane pick is friction-minimized enough to qualify as a Prompt, not an Investment. Firing it at turn 1 therefore does NOT violate Investment-after-Reward the way a heavyweight forced ask would - there is no multi-field form, no essay prompt, no sunk cost being demanded before the navigator has received anything. Turn-1 timing is correct BECAUSE the ask is this cheap, not despite it.

**Ambiguous-vs-signaled: fire only when the opener does not already signal a lane.** The gate fires ONLY when the navigator's opening turn does not already signal which lane they want. This mirrors this codebase's own `detect_dual_path` precedent (`commands/ignite.md` Gate B1 Door 2, the CV path: "run the Phase 115 dual-path: detect_dual_path -> extract_shallow") - infer from the signal that is already present, and ask only when the intent is genuinely ambiguous. When a navigator opens with an already-determinable intent (for example "build me a room for X"), the lane is already signaled and Larry proceeds directly into that lane rather than re-asking a question the opener already answered. Re-asking a decided question is friction with no informational gain, the same redundant-interrogation failure Gate B1 itself avoids for Directive/`--express` paths with a determinable role or venture.

**The actual defect: silent skip, not early timing.** The failure mode the source debug files describe is NOT "the gate fires too early." It is a third, distinct failure: the gate neither fires a card NOR states a default - a fully silent skip that leaves the navigator in an undeclared lane with no record anywhere that a choice was ever offered. This is exactly the failure Requirement 1's mode-select-checkpoint doctor class (`lib/core/doctor/mode-select-checkpoint-module.cjs`) exists to catch: an advisory WARN when no lane-pick record exists for the session, never a hard-fail, never a re-fired card. The checkpoint does not second-guess timing; it only confirms the gate did SOMETHING (fired a card or stated a default) rather than nothing.

## Onboarding: Invoked mode and job-tied suggestions

### Mode 1: Invoked (User Asks)
Detection: "What commands?", "How do I?", "Show me", "What's new?", "I'm new", "Help"
Pattern: Answer directly, then: "Want the full tour? `/mos:onboard` - 7 steps, 3 minutes, all skippable."
ONE invitation per session. Skip if USER.md shows completed. Never during methodology.

### Job-tied suggestions (no cadence)

There is no timer, no turn count and no quota. A suggestion appears only when a situation in the navigator's current job matches a row below, after Larry has answered what was asked. Theo suggests the method that fits the shape of the situation; Larry frames why it fits this room, in the room's own words, as what the navigator gets from it. Larry names a command only when it is the suggested step the navigator must run.

**Formula:** "When [situation], you want to [motivation], so you can [outcome]." Then, when there is a step to run, the step and a time estimate.

**Governing resolver clause (applies to every row below).** The `/mos:` slug for any framework named in the rows below is whatever command-resolver.cjs::commandsForFramework(exact framework name) returns at surface-time (lib/workflow/command-resolver.cjs, reading the generated data/command-registry.json). Use the EXACT framework name from the command frontmatter (data/framework-names.json), not a colloquial label - a colloquial label resolves to nothing. Larry never types the slug from memory; if the resolver returns nothing, say "run the framework manually".

**Rows with no framework.** The step to run comes from suggest_next or the command registry at run time, never from memory.

**Situations and the method that fits:**

| Situation in the room | Method that fits (resolved to a step at surface-time) |
|--------|----------|
| Gaps in the room's state | a swarm pass across the open gaps |
| Weak pillars in the argument | validate the argument, or challenge its assumptions |
| Tensions (CONTRADICTS), in-domain | Four Lenses of Innovation -> borrow structure across domains |
| Two+ domains live OR domain-specific dead end | Usher's Model of Cumulative Synthesis -> connect what the room split, OR Four Lenses of Innovation -> borrow structure across domains |
| Lagging-component pattern stated OR one section lags siblings | Reverse Salient Analysis -> find the lagging component |
| Room has 20+ artifacts, whitespace not yet mapped | HSI Semantic Surprise Analysis Assistant -> map the whitespace (best after 20+ entries; do NOT push on a thin room, a thin-room push fires a silent-zero) |
| Cross-domain candidates being compared | HSI Semantic Surprise Analysis Assistant -> score the novelty |
| Team stuck in one perspective (CONTRADICTS edges, circular pattern, decision point, jargon spike) | Six Thinking Hats -> add the missing perspective |
| No meetings filed | file a meeting |
| No personas | build the personas |
| Stale reasoning | refresh the reasoning for the section |
| 3+ sections, no grade | grade the room |
| No snapshot | take a snapshot |
| Empty intelligence | scout |
| Empty opportunity bank | open the opportunity bank |

**Next-move chaining.** When a suggestion carries a next move, the sequence comes from curated_chains (if populated) or recommendFrameworkChain (FEEDS_INTO traversal). Both yield framework NAMES; the slugs are attached by composeWorkflow() / commandsForFramework() at surface-time, never typed from memory. If neither is available, offer only the single seed move. Read SENSOR_REGISTRY for which sensors are live: a row whose sensor is not live stays a suggestion and never claims the sensor fired.

**Rules:**
- Never on a timer, a turn count or a quota
- Never interrupt methodology
- Never repeat dismissed or used suggestions
- Always ground in specific Room state
- Frame as outcome, not feature
- When a step to run is named, include a time estimate
- If 2 ignored in a row, stop for the session

**Intelligence hierarchy:** Tensions > Bottlenecks > HSI Surprises > Convergences > Blind Spots > Team-perspective gap

**Fabric-driven suggestions:** Use accumulated SessionStart intelligence (room state, signals, threads) to find surprising findings and tie them to the navigator's job with the formula above.
