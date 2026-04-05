# Phase 36: Command Wiring - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase -- wiring only)

<domain>
## Phase Boundary

Five new /mos: commands that connect users to existing infrastructure. No new scripts, no new lib modules -- just markdown command files in commands/ that tell Larry what to call and how to present results. Each command must follow the natural-language-first principle (D-NEW-2) and the 4-zone UI anatomy.

</domain>

<decisions>
## Implementation Decisions

### /mos:present (WIRE-01)
- **D-01:** Calls scripts/generate-presentation.cjs to generate all 6 views, then scripts/serve-presentation to open in browser
- **D-02:** Larry confirms generation success and tells user what they can see ("Your room is now a visual dashboard your investors can browse")
- **D-03:** If no room exists, shows 3-line error (What/Why/Fix pattern)

### /mos:dashboard (WIRE-02)
- **D-04:** Opens graph.html directly via serve-presentation (targets the graph view with chat panel)
- **D-05:** If graph.json doesn't exist, Larry explains and suggests filing content first

### /mos:speakers (WIRE-03)
- **D-06:** Reads room/team/ directory, finds speaker profiles (created by scripts/create-speaker-profile during meeting filing)
- **D-07:** Presents speaker profiles in Room Card format (Body Shape C) with role, expertise, meeting count
- **D-08:** If no speakers exist, Larry explains meetings need to be filed first

### /mos:reanalyze (WIRE-04)
- **D-09:** Runs scripts/compute-meetings-intelligence on all meetings in room/meetings/
- **D-10:** Shows before/after delta (Action Report, Body Shape E) of what new insights were found
- **D-11:** If no meetings exist, 3-line error

### /mos:graph (WIRE-05)
- **D-12:** Wraps lib/core/lazygraph-ops.cjs for natural language graph exploration
- **D-13:** Larry translates user questions into KuzuDB queries and presents results as Room Cards
- **D-14:** If KuzuDB is empty, explain and suggest filing content

### Claude's Discretion
All implementation details -- these are markdown command files, Larry handles the presentation

</decisions>

<canonical_refs>
## Canonical References

### Existing Infrastructure (commands call these)
- `scripts/generate-presentation.cjs` -- 6-view HTML generator
- `scripts/serve-presentation` -- Local server + browser open
- `scripts/create-speaker-profile` -- Speaker profile generator
- `scripts/compute-meetings-intelligence` -- Meeting re-analysis
- `lib/core/lazygraph-ops.cjs` -- KuzuDB graph operations

### Command Pattern (follow existing)
- `commands/splash.md` -- Simple command example (just created in Phase 34)
- `commands/onboard.md` -- Complex command example (just created in Phase 35)
- `skills/ui-system/SKILL.md` -- 4-zone anatomy, body shapes, glyphs

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- All 5 target scripts/modules already exist and work
- commands/ directory has 52 existing commands as patterns
- Body shapes already defined for each output type

### Integration Points
- Each command is a .md file in commands/ with YAML frontmatter (name, description, body_shape)
- Larry reads the command content and follows the instructions
- No hook changes needed -- commands are auto-discovered by Claude Code

</code_context>

<specifics>
## Specific Ideas

- Natural language first: "Your room has a visual dashboard" not "Generated 6 HTML files"
- JTBD framing in descriptions: what the user GETS, not what the command DOES

</specifics>

<deferred>
## Deferred Ideas

None -- pure wiring phase

</deferred>

---

*Phase: 36-command-wiring*
*Context gathered: 2026-03-31*
