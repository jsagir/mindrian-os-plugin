# Roadmap: MindrianRooms -- ICM Room Organization v1.8.6

## Overview

This milestone updates the MindrianOS plugin to centralize all Data Rooms under ~/MindrianRooms/ with ICM-compliant directory structure. The physical directory already exists for the developer; this work updates resolve-room, room-registry, creation commands, skill activation triggers, display commands, and adds a migration engine for legacy layouts. Four phases deliver path resolution first (the keystone), then creation and ICM structure, then skill/UX updates, and finally the migration engine for existing users.

## Milestones

<details>
<summary>v1.8.2 Brain Graph Optimization (Phases 52-55) - PLANNED</summary>

4 phases, 27 requirements. Normalization scripts written. Ready to execute separately.

</details>

- 🚧 **v1.8.6 MindrianRooms -- ICM Room Organization** - Phases 56-59.1 (in progress)

## Phases

- [ ] **Phase 56: Path Resolution** - Update resolve-room to default to ~/MindrianRooms/ with legacy fallback
- [ ] **Phase 57: Room Creation & ICM Structure** - Room creation targets MindrianRooms, auto-generates ICM Layer 0/1, INDEX.md auto-refresh
- [ ] **Phase 58: Skill Activation & Display** - Skills detect rooms in new location, commands show MindrianRooms paths
- [ ] **Phase 59: Migration Engine** - Detect legacy layouts, guided migration with symlinks, /mos:setup integration
- [ ] **Phase 59.1: Room Organizer Skill** - /mos:organize command for ongoing room restructuring with human-in-the-loop

## Phase Details

### Phase 56: Path Resolution
**Goal**: All room lookups resolve through ~/MindrianRooms/ as the primary location, with backward-compatible legacy fallback
**Depends on**: Nothing (first phase of milestone)
**Requirements**: PATH-01, PATH-02, PATH-03
**Success Criteria** (what must be TRUE):
  1. Running resolve-room in a project with rooms under ~/MindrianRooms/ returns the correct room path from registry.json
  2. Running resolve-room without a registry.json still finds rooms by scanning ~/MindrianRooms/ directory
  3. Running resolve-room with rooms only at ~/room/ or ~/rooms/ still resolves them but prints a deprecation notice to stderr
**Plans**: 1 plan
Plans:
- [ ] 56-01-PLAN.md -- Rewrite resolve-room and room-registry for MindrianRooms-first resolution

### Phase 57: Room Creation & ICM Structure
**Goal**: New rooms are created under ~/MindrianRooms/ with ICM-compliant Layer 0 (CLAUDE.md) and Layer 1 (INDEX.md) auto-generated, and INDEX.md stays current as rooms change
**Depends on**: Phase 56
**Requirements**: CREATE-01, CREATE-02, CREATE-03, CREATE-04, ICM-01, ICM-02, ICM-03, ICM-04
**Success Criteria** (what must be TRUE):
  1. Running /mos:new-project creates the room folder under ~/MindrianRooms/[slug]/ and writes registry.json to ~/MindrianRooms/.rooms/
  2. Running /mos:rooms create produces the same result as /mos:new-project for path and registry
  3. First room creation on a fresh system auto-generates ~/MindrianRooms/CLAUDE.md (Layer 0 identity) and ~/MindrianRooms/INDEX.md (Layer 1 routing) from templates
  4. INDEX.md content updates automatically when a room is created, archived, or changes stage
  5. Each room retains its own STATE.md as its Layer 2 contract (no regression)
**Plans**: TBD
**UI hint**: yes

### Phase 58: Skill Activation & Display
**Goal**: Passive and proactive skills detect rooms in the new location, and all display commands show ~/MindrianRooms/ paths
**Depends on**: Phase 56
**Requirements**: SKILL-01, SKILL-02, UX-01, UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. room-passive skill activates when working directory is inside ~/MindrianRooms/[room-name]/
  2. room-proactive skill activates when working directory is inside ~/MindrianRooms/[room-name]/
  3. /mos:rooms list output shows ~/MindrianRooms/ paths for all rooms
  4. /mos:room overview header displays the simplified ~/MindrianRooms/[name]/ path
  5. Session greeting mentions MindrianRooms location when a room is detected
**Plans**: TBD

### Phase 59: Migration Engine
**Goal**: Existing users with legacy ~/room/ or ~/rooms/ layouts get a guided migration path to ~/MindrianRooms/
**Depends on**: Phase 57
**Requirements**: MIG-01, MIG-02, MIG-03, MIG-04
**Success Criteria** (what must be TRUE):
  1. Running the migration script detects rooms at ~/room/ and ~/rooms/ and reports what it found with file counts
  2. Migration prompts for confirmation before moving any files, showing source and destination paths
  3. After migration, optional symlinks at old locations point to new ~/MindrianRooms/[slug]/ paths
  4. /mos:setup offers an "organize rooms" option that triggers the migration flow
**Plans**: TBD

### Phase 59.1: Room Organizer Skill
**Goal**: An /mos:organize command that lets users restructure their room hierarchy with human confirmation at each step
**Depends on**: Phase 59
**Requirements**: ORG-01, ORG-02, ORG-03, ORG-04, ORG-05
**Success Criteria** (what must be TRUE):
  1. /mos:organize shows current room structure as an ICM-compliant tree
  2. /mos:organize propose suggests reorganization by client, domain, stage, or custom grouping
  3. Each proposed move requires explicit human confirmation before execution
  4. Nested hierarchies supported (e.g., clients/adam/synteris/) with ICM CLAUDE.md at each grouping level
  5. Registry.json and INDEX.md auto-update after each confirmed move
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 56 -> 57 -> 58 -> 59 -> 59.1
(Phase 58 depends on 56 only, so it could run in parallel with 57 if needed)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 56. Path Resolution | v1.8.6 | 0/1 | Planned | - |
| 57. Room Creation & ICM Structure | v1.8.6 | 0/0 | Not started | - |
| 58. Skill Activation & Display | v1.8.6 | 0/0 | Not started | - |
| 59. Migration Engine | v1.8.6 | 0/0 | Not started | - |
