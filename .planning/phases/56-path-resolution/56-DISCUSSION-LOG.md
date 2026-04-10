# Phase 56: Path Resolution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 56-path-resolution
**Areas discussed:** Resolution priority, Deprecation behavior, Registry location, Environment override

---

## Resolution Priority

| Option | Description | Selected |
|--------|-------------|----------|
| MindrianRooms first | Check ~/MindrianRooms/ before local workspace | ✓ |
| Local workspace first | Keep current behavior, MindrianRooms as fallback | |
| Merge both | Combine registries from both locations | |

**User's choice:** "you decide" -- Claude selected MindrianRooms first
**Notes:** Central registry is source of truth. Local workspace acts as project-specific override.

---

## Deprecation Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Every call | Warn on every resolve-room invocation | |
| Once per session | Stderr warning with temp file dedup | ✓ |
| First detection only | Only warn the very first time, then never again | |

**User's choice:** "you decide" -- Claude selected once per session
**Notes:** Temp file marker prevents noise without losing the nudge.

---

## Registry Location

| Option | Description | Selected |
|--------|-------------|----------|
| Centralized | ~/MindrianRooms/.rooms/registry.json only | ✓ |
| Distributed | Keep workspace-relative .rooms/registry.json | |
| Both with merge | Read from both, merge at runtime | |

**User's choice:** "you decide" -- Claude selected centralized
**Notes:** One registry, one truth. Legacy workspace registries consumed for backward compat but new writes go central.

---

## Environment Override

| Option | Description | Selected |
|--------|-------------|----------|
| MINDRIAN_ROOMS_HOME env var | Override ~/MindrianRooms location | ✓ |
| No override | Hard-coded ~/MindrianRooms | |

**User's choice:** "you decide" -- Claude selected env var override
**Notes:** Cheap to implement, respects power users.

## Claude's Discretion

- Python JSON resolution code internals
- Temp file naming and cleanup strategy
- --adopt flag behavior evolution

## Deferred Ideas

None
