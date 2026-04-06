# Requirements: MindrianRooms -- ICM Room Organization v1.8.6

**Defined:** 2026-04-06
**Core Value:** Centralize all Data Rooms under ~/MindrianRooms/ with ICM-compliant structure

## v1.8.6 Requirements

### Path Resolution

- [x] **PATH-01**: resolve-room script resolves active room from ~/MindrianRooms/.rooms/registry.json before legacy fallback
- [x] **PATH-02**: resolve-room falls back to ~/MindrianRooms/ directory scan when no registry exists
- [x] **PATH-03**: Legacy ~/room/ and ~/rooms/ paths still resolve (backward compat) but emit deprecation notice

### Room Creation

- [ ] **CREATE-01**: /mos:new-project creates rooms under ~/MindrianRooms/[slug]/
- [ ] **CREATE-02**: /mos:rooms create targets ~/MindrianRooms/[slug]/
- [ ] **CREATE-03**: First room creation auto-generates ICM Layer 0 (CLAUDE.md) and Layer 1 (INDEX.md) at ~/MindrianRooms/ if missing
- [ ] **CREATE-04**: room-registry script writes to ~/MindrianRooms/.rooms/registry.json

### ICM Compliance

- [ ] **ICM-01**: CLAUDE.md at ~/MindrianRooms/ declares identity (Layer 0: "What is this place?")
- [ ] **ICM-02**: INDEX.md at ~/MindrianRooms/ provides routing (Layer 1: "Which room do I need?")
- [ ] **ICM-03**: INDEX.md auto-updates when rooms are created, archived, or stage changes
- [ ] **ICM-04**: Each room retains its own STATE.md as Layer 2 contract

### Skill Activation

- [ ] **SKILL-01**: room-passive detects rooms in ~/MindrianRooms/[active-room]/
- [ ] **SKILL-02**: room-proactive detects rooms in ~/MindrianRooms/[active-room]/

### Migration

- [ ] **MIG-01**: Migration script detects legacy ~/room/ and ~/rooms/ layouts
- [ ] **MIG-02**: Migration offers guided move with file count and confirmation
- [ ] **MIG-03**: Migration creates symlinks at old locations pointing to new (optional)
- [ ] **MIG-04**: /mos:setup includes "organize rooms" option that triggers migration

### Display & UX

- [ ] **UX-01**: /mos:rooms list shows ~/MindrianRooms/ paths
- [ ] **UX-02**: /mos:room overview header shows simplified ~/MindrianRooms/[name]/ path
- [ ] **UX-03**: Session greeting references MindrianRooms location when room detected

### Room Organizer

- [ ] **ORG-01**: /mos:organize displays current room structure as ICM-compliant tree with status indicators
- [ ] **ORG-02**: /mos:organize propose suggests reorganization by client, domain, stage, or custom grouping
- [ ] **ORG-03**: Each proposed room move requires explicit human confirmation before file operations execute
- [ ] **ORG-04**: Nested hierarchies supported with ICM CLAUDE.md auto-generated at each grouping level
- [ ] **ORG-05**: Registry.json and INDEX.md auto-update after each confirmed move

## Future Requirements

None deferred -- scope is tight.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Remote room sync | Separate feature, not part of local reorganization |
| Room templates | Nice-to-have but not required for path centralization |
| Cross-room intelligence | Requires graph layer work beyond path changes |
| Automatic old path deletion | Too destructive -- migration offers guidance, user decides |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PATH-01 | Phase 56 | Complete |
| PATH-02 | Phase 56 | Complete |
| PATH-03 | Phase 56 | Complete |
| CREATE-01 | Phase 57 | Pending |
| CREATE-02 | Phase 57 | Pending |
| CREATE-03 | Phase 57 | Pending |
| CREATE-04 | Phase 57 | Pending |
| ICM-01 | Phase 57 | Pending |
| ICM-02 | Phase 57 | Pending |
| ICM-03 | Phase 57 | Pending |
| ICM-04 | Phase 57 | Pending |
| SKILL-01 | Phase 58 | Pending |
| SKILL-02 | Phase 58 | Pending |
| MIG-01 | Phase 59 | Pending |
| MIG-02 | Phase 59 | Pending |
| MIG-03 | Phase 59 | Pending |
| MIG-04 | Phase 59 | Pending |
| UX-01 | Phase 58 | Pending |
| UX-02 | Phase 58 | Pending |
| UX-03 | Phase 58 | Pending |
| ORG-01 | Phase 59.1 | Pending |
| ORG-02 | Phase 59.1 | Pending |
| ORG-03 | Phase 59.1 | Pending |
| ORG-04 | Phase 59.1 | Pending |
| ORG-05 | Phase 59.1 | Pending |

**Coverage:**
- v1.8.6 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after roadmap creation*
