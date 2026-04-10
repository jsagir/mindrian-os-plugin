# Phase 56: Path Resolution - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Update resolve-room script to resolve rooms from ~/MindrianRooms/ as the primary location, with backward-compatible legacy fallback for ~/room/ and ~/rooms/. This is the keystone change -- all other v1.8.6 phases depend on resolve-room returning the correct path.

</domain>

<decisions>
## Implementation Decisions

### Resolution Priority (D-01)
- **D-01:** Resolution order is: (1) ~/MindrianRooms/.rooms/registry.json, (2) local workspace .rooms/registry.json, (3) legacy ~/room/ or ~/rooms/ fallback. Central registry is the source of truth. Local workspace rooms act as override for developers working inside a specific project.

### Deprecation Behavior (D-02)
- **D-02:** Legacy path detection emits a stderr warning ONCE per session, not on every resolve-room call. Message: `[MindrianOS] Room found at ~/room/ -- run /mos:setup to migrate to ~/MindrianRooms/`. Use a temp file marker (~/.mindrian-legacy-warned) to deduplicate within a session.

### Registry Location (D-03)
- **D-03:** Canonical registry lives at ~/MindrianRooms/.rooms/registry.json. No merge strategy, no distributed registries. One registry, one truth. The workspace-relative .rooms/registry.json pattern is what we're replacing. Legacy workspace registries at .rooms/registry.json are consumed (for backward compat) but new writes go to the central location.

### Environment Override (D-04)
- **D-04:** `MINDRIAN_ROOMS_HOME` environment variable overrides ~/MindrianRooms as the root. Defaults to `$HOME/MindrianRooms`. Cheap to implement, respects power users who want rooms elsewhere.

### Claude's Discretion
- Implementation details of the Python JSON resolution code
- Exact temp file naming and cleanup for deprecation dedup
- Whether to keep the --adopt flag behavior or simplify it for the new model

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Path Resolution
- `scripts/resolve-room` -- Current keystone script (108 lines). Strategy 1 (registry) and Strategy 2 (legacy) both need updating.
- `scripts/room-registry` -- CRUD operations for registry.json. The `create` subcommand writes to workspace-relative path -- needs to target ~/MindrianRooms/.rooms/.

### Architecture
- `docs/MWP-SPECIFICATION.md` -- MWP Layer 0-4 mapping, ICM compliance rules
- `.claude/includes/architecture.md` -- ICM x Simon x Wicked Problem summary

### Requirements
- `.planning/REQUIREMENTS.md` -- PATH-01, PATH-02, PATH-03 are the three requirements for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolve-room` script: well-structured bash + inline Python pattern. Same pattern can be extended with a new Strategy 0 (MindrianRooms).
- `room-registry` script: atomic writes via tmp + mv. CRUD operations are solid -- just need path redirection.

### Established Patterns
- Bash scripts with inline Python for JSON parsing (no Node.js dependency for core scripts)
- Atomic file writes: write to .tmp then os.rename
- Exit code conventions: 0 = found, 1 = not found
- $WORK_DIR pattern for workspace-relative resolution

### Integration Points
- Every hook in hooks/hooks.json calls resolve-room
- session-start hook uses resolve-room output for greeting
- room-passive and room-proactive skills check for room/ directory existence
- All /mos: commands that read room state depend on resolve-room

</code_context>

<specifics>
## Specific Ideas

- The new resolution order: MINDRIAN_ROOMS_HOME env var -> ~/MindrianRooms/.rooms/registry.json -> local .rooms/registry.json -> legacy ~/room/ -> exit 1
- Deprecation warning uses stderr so it doesn't pollute stdout (resolve-room stdout is consumed by callers)
- Session-scoped dedup via ~/.mindrian-legacy-warned temp file (deleted on session end or TTL-based)

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 56-path-resolution*
*Context gathered: 2026-04-06*
