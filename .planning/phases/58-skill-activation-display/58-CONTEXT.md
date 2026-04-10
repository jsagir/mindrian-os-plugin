# Phase 58: Skill Activation & Display - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase, discuss skipped)

<domain>
## Phase Boundary

Passive and proactive skills detect rooms in ~/MindrianRooms/, and all display commands show MindrianRooms paths. Updates skill activation triggers and command display logic.

</domain>

<decisions>
## Implementation Decisions

### Skill Activation
- **D-01:** room-passive SKILL.md activation trigger changes from `dir_exists:room` to detect rooms via resolve-room (which already handles MindrianRooms)
- **D-02:** room-proactive SKILL.md activation trigger follows same pattern as room-passive
- **D-03:** Skills should activate when working directory is INSIDE a room under MindrianRooms, OR when resolve-room finds any active room

### Display Updates
- **D-04:** /mos:rooms list shows ~/MindrianRooms/ paths (reads from central registry)
- **D-05:** /mos:room overview header shows simplified path (~/MindrianRooms/[name]/)
- **D-06:** Session greeting mentions MindrianRooms location: "Your rooms live at ~/MindrianRooms/"

### Claude's Discretion
- Exact wording of session greeting MindrianRooms reference
- Whether skill activation uses resolve-room directly or checks ROOMS_HOME directory

</decisions>

<canonical_refs>
## Canonical References

### Skills to Update
- `skills/room-passive/SKILL.md` -- Line 6: activation trigger
- `skills/room-proactive/SKILL.md` -- Line 6: activation trigger

### Commands to Update
- `commands/rooms.md` -- List display, path rendering
- `commands/room.md` -- Overview header path display

### Phase 56 Output
- `scripts/resolve-room` -- 4-strategy resolver, ROOMS_HOME pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- resolve-room returns absolute path -- skills can call it directly
- MINDRIAN_ROOMS_HOME env var available for path display

### Established Patterns
- Skill activation triggers: dir_exists, env_exists patterns in SKILL.md frontmatter
- Command display: 4-zone anatomy with header panel showing room path

### Integration Points
- Session-start hook already calls resolve-room for greeting
- room-passive activates on dir detection, reads STATE.md
- room-proactive activates on dir detection, runs cross-reference scan

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 58-skill-activation-display*
*Context gathered: 2026-04-06*
