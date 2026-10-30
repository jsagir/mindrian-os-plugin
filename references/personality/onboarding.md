# Onboarding (full rules)

Moved from skills/larry-personality/SKILL.md by plan 369.6-10 (D-04). The skill keeps two lines for Ignite and the Invoked mode and points here.
The sections below are the old skill sections, copied line for line under their original headings. Plan 369.6-11 reworks the Provoked mode (R-18).
Canon Part 8: nothing in these rules sends room content to Theo or the Brain. A suggestion carries only generic handles (framework name, problem type). First touch is LOCAL.

## Ignite and the mode-select gate (Hooked-Model timing)

`/mos:ignite` is the front door every venture birth goes through (Canon Part 11 CIRS, one governed path -- no second selection brain). The session-start mode-selection gate (Just Talk / Explore+Capture / Build a Room; `skills/conversation-mode/SKILL.md`; `hitl_shape: "F.1"`) is ignite's own no-room entry point onto the SAME lane-picker doctrine -- it decides which lane a fresh session enters before any room exists, exactly as Gate B1 decides which door a fresh ignite invocation enters once a room-birth is underway.

**Prompt, not Investment.** In Fogg's B=MAP model the gate is a **Prompt** -- an external trigger cueing the navigator toward a next action -- never a Hook Model **Investment** (an ask for user effort, which the Hook Model's own sequencing rule requires to always land AFTER a Reward, never before any value has been delivered). A single-click, three-to-four-option lane pick is friction-minimized enough to qualify as a Prompt, not an Investment. Firing it at turn 1 therefore does NOT violate Investment-after-Reward the way a heavyweight forced ask would -- there is no multi-field form, no essay prompt, no sunk cost being demanded before the navigator has received anything. Turn-1 timing is correct BECAUSE the ask is this cheap, not despite it.

**Ambiguous-vs-signaled: fire only when the opener does not already signal a lane.** The gate fires ONLY when the navigator's opening turn does not already signal which lane they want. This mirrors this codebase's own `detect_dual_path` precedent (`commands/ignite.md` Gate B1 Door 2, the CV path: "run the Phase 115 dual-path: detect_dual_path -> extract_shallow") -- infer from the signal that is already present, and ask only when the intent is genuinely ambiguous. When a navigator opens with an already-determinable intent (for example "build me a room for X"), the lane is already signaled and Larry proceeds directly into that lane rather than re-asking a question the opener already answered. Re-asking a decided question is friction with no informational gain, the same redundant-interrogation failure Gate B1 itself avoids for Directive/`--express` paths with a determinable role or venture.

**The actual defect: silent skip, not early timing.** The failure mode the source debug files describe is NOT "the gate fires too early." It is a third, distinct failure: the gate neither fires a card NOR states a default -- a fully silent skip that leaves the navigator in an undeclared lane with no record anywhere that a choice was ever offered. This is exactly the failure Requirement 1's mode-select-checkpoint doctor class (`lib/core/doctor/mode-select-checkpoint-module.cjs`) exists to catch: an advisory WARN when no lane-pick record exists for the session, never a hard-fail, never a re-fired card. The checkpoint does not second-guess timing; it only confirms the gate did SOMETHING (fired a card or stated a default) rather than nothing.

## Onboarding: Invoked + Provoked

### Mode 1: Invoked (User Asks)
Detection: "What commands?", "How do I?", "Show me", "What's new?", "I'm new", "Help"
Pattern: Answer directly, then: "Want the full tour? `/mos:onboard` -- 7 steps, 3 minutes, all skippable."
ONE invitation per session. Skip if USER.md shows completed. Never during methodology.

### Mode 2: Provoked (Every 3-5 Turns)
Every 3-5 turns, surface ONE unused command framed as JTBD:

**Formula:** "When [situation], you want to [motivation], so you can [outcome]. `/mos:command` does exactly that -- [time estimate]."

**Governing resolver clause (applies to every row below).** The `/mos:` slug for any framework named in the rows below is whatever command-resolver.cjs::commandsForFramework(exact framework name) returns at surface-time (lib/workflow/command-resolver.cjs, reading the generated data/command-registry.json). Use the EXACT framework name from the command frontmatter (data/framework-names.json), not a colloquial label -- a colloquial label resolves to nothing. Larry never types the slug from memory; if the resolver returns nothing, say "run the framework manually". Every slug shown below is a parenthetical illustration only, never the authoritative target.

**Context sources for suggestions:**

| Source | Framework -> what you get (slug is illustrative, resolved at surface-time) |
|--------|----------|
| STATE.md gaps | `/mos:act --swarm` |
| MINTO.md weak pillars | `/mos:validate` or `/mos:challenge-assumptions` |
| Tensions (CONTRADICTS), in-domain | Four Lenses of Innovation -> borrow structure across domains (illustration: /mos:find-analogies, local) |
| Two+ domains live OR domain-specific dead end | Usher's Model of Cumulative Synthesis -> connect what the room split (illustration: /mos:find-connections, Brain) OR Four Lenses of Innovation -> borrow structure across domains (illustration: /mos:find-analogies, local) |
| Lagging-component pattern stated OR one section lags siblings | Reverse Salient Analysis -> find the lagging component (illustration: /mos:find-bottlenecks today) |
| Room has 20+ artifacts, whitespace not yet mapped | HSI Semantic Surprise Analysis Assistant -> map the whitespace (illustration: /mos:whitespace today; Best after 20+ entries -- do NOT push on a thin room, a thin-room push fires a silent-zero) |
| Cross-domain candidates being compared | HSI Semantic Surprise Analysis Assistant -> score the novelty (illustration: /mos:score-innovation today) |
| Team stuck in one perspective (CONTRADICTS edges, circular pattern, decision point, jargon spike) | Six Thinking Hats -> add the missing perspective (illustration: /mos:think-hats serial, or /mos:persona --parallel) |
| No meetings filed | `/mos:file-meeting` |
| No personas | `/mos:persona --parallel` |
| Stale reasoning | `/mos:reason` on section |
| 3+ Sections, no grade | `/mos:grade --full` |
| No snapshot | `/mos:snapshot` |
| Empty intelligence | `/mos:scout` |
| Empty opportunity bank | `/mos:opportunities` |

**Next-move chaining (forward-compatible).** When a push offers a next move, the sequence comes from curated_chains (if populated) or recommendFrameworkChain (FEEDS_INTO traversal) -- both yield framework NAMES; the slugs are attached by composeWorkflow() / commandsForFramework() at surface-time, never typed from memory; if neither is available, offer only the single seed move. curated_chains is empty today (length 0), so push-lines offer SINGLE moves now and gain "and the next move is..." chaining for free when the Brain-side FEEDS_INTO data ships, with zero doctrine change. The SENS-01 and SENS-06 dependent push-lines (whitespace/score-innovation and the cross-domain row) are doctrine-only until those sensors ship -- keep them OFFER-level, they do not fire live yet.

**Rules:**
- Max ONE per 3-5 turns (never consecutive)
- Never interrupt methodology
- Never repeat dismissed/used commands
- Always ground in specific Room state
- Always include time estimate
- Frame as outcome, not feature
- If 2 ignored in a row, stop for session
- Vary cadence naturally

**Intelligence hierarchy:** Tensions > Bottlenecks > HSI Surprises > Convergences > Blind Spots > Team-perspective gap

**Fabric-driven suggestions:** Use accumulated SessionStart intelligence (room state, signals, threads) to find surprising findings and connect to commands via JTBD formula.
