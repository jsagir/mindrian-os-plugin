# Requirements: MindrianRooms -- ICM Room Organization v1.8.6

**Defined:** 2026-04-06
**Core Value:** Centralize all Data Rooms under ~/MindrianRooms/ with ICM-compliant structure

## v1.8.6 Requirements

### Path Resolution

- [x] **PATH-01**: resolve-room script resolves active room from ~/MindrianRooms/.rooms/registry.json before legacy fallback
- [x] **PATH-02**: resolve-room falls back to ~/MindrianRooms/ directory scan when no registry exists
- [x] **PATH-03**: Legacy ~/room/ and ~/rooms/ paths still resolve (backward compat) but emit deprecation notice

### Room Creation

- [x] **CREATE-01**: /mos:new-project creates rooms under ~/MindrianRooms/[slug]/
- [x] **CREATE-02**: /mos:rooms create targets ~/MindrianRooms/[slug]/
- [x] **CREATE-03**: First room creation auto-generates ICM Layer 0 (CLAUDE.md) and Layer 1 (INDEX.md) at ~/MindrianRooms/ if missing
- [x] **CREATE-04**: room-registry script writes to ~/MindrianRooms/.rooms/registry.json

### ICM Compliance

- [x] **ICM-01**: CLAUDE.md at ~/MindrianRooms/ declares identity (Layer 0: "What is this place?")
- [x] **ICM-02**: INDEX.md at ~/MindrianRooms/ provides routing (Layer 1: "Which room do I need?")
- [x] **ICM-03**: INDEX.md auto-updates when rooms are created, archived, or stage changes
- [x] **ICM-04**: Each room retains its own STATE.md as Layer 2 contract

### Skill Activation

- [x] **SKILL-01**: room-passive detects rooms in ~/MindrianRooms/[active-room]/
- [x] **SKILL-02**: room-proactive detects rooms in ~/MindrianRooms/[active-room]/

### Migration

- [ ] **MIG-01**: Migration script detects legacy ~/room/ and ~/rooms/ layouts
- [ ] **MIG-02**: Migration offers guided move with file count and confirmation
- [ ] **MIG-03**: Migration creates symlinks at old locations pointing to new (optional)
- [ ] **MIG-04**: /mos:setup includes "organize rooms" option that triggers migration

### Display & UX

- [x] **UX-01**: /mos:rooms list shows ~/MindrianRooms/ paths
- [x] **UX-02**: /mos:room overview header shows simplified ~/MindrianRooms/[name]/ path
- [x] **UX-03**: Session greeting references MindrianRooms location when room detected

### Room Organizer (Wicked Hierarchy Navigator)

- [ ] **ORG-01**: /mos:organize displays current room structure as ICM-compliant tree with status indicators
- [ ] **ORG-02**: /mos:organize propose suggests reorganization using graph-informed groupings (shared themes, domains, frameworks, stages) -- not just metadata sorting
- [ ] **ORG-03**: Each proposed room move requires explicit human confirmation before file operations execute
- [ ] **ORG-04**: Nested hierarchies supported with ICM CLAUDE.md auto-generated at each grouping level from graph context
- [ ] **ORG-05**: Registry.json and INDEX.md auto-update after each confirmed move
- [ ] **ORG-06**: Multiple organizational views available without moving files -- "show by client", "show by stage", "show by domain" are graph projections
- [ ] **ORG-07**: User decisions (GROUP / SEPARATE / DEFER) become graph edges that inform future reorganization proposals

### Room Hierarchy Graph Layer (Brain Enrichment)

- [ ] **GRAPH-01**: Room nodes created in Neo4j Brain for each registered room with name, stage, domain, creation date
- [ ] **GRAPH-02**: RoomGroup nodes represent grouping levels (clients/, internal/, etc.) with ICM layer metadata
- [ ] **GRAPH-03**: CONTAINS edges model physical hierarchy (RoomRoot -> RoomGroup -> Room)
- [ ] **GRAPH-04**: AT_STAGE edges connect Room nodes to existing VentureStage taxonomy (5 stages already in Brain)
- [ ] **GRAPH-05**: USES_FRAMEWORK edges connect Room nodes to Framework nodes based on methodology commands run in that room
- [ ] **GRAPH-06**: SHARES_THEME edges between Room nodes detected from cross-room content analysis (CO_OCCURS pattern)
- [ ] **GRAPH-07**: DataRoomSection nodes (13 existing orphans) wired to parent Room nodes via HAS_SECTION
- [ ] **GRAPH-08**: Graph layer is additive only -- filesystem + registry.json remain operational truth, graph adds intelligence

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
| CREATE-01 | Phase 57 | Complete |
| CREATE-02 | Phase 57 | Complete |
| CREATE-03 | Phase 57 | Complete |
| CREATE-04 | Phase 57 | Complete |
| ICM-01 | Phase 57 | Complete |
| ICM-02 | Phase 57 | Complete |
| ICM-03 | Phase 57 | Complete |
| ICM-04 | Phase 57 | Complete |
| SKILL-01 | Phase 58 | Complete |
| SKILL-02 | Phase 58 | Complete |
| MIG-01 | Phase 59 | Pending |
| MIG-02 | Phase 59 | Pending |
| MIG-03 | Phase 59 | Pending |
| MIG-04 | Phase 59 | Pending |
| UX-01 | Phase 58 | Complete |
| UX-02 | Phase 58 | Complete |
| UX-03 | Phase 58 | Complete |
| ORG-01 | Phase 59.1 | Pending |
| ORG-02 | Phase 59.1 | Pending |
| ORG-03 | Phase 59.1 | Pending |
| ORG-04 | Phase 59.1 | Pending |
| ORG-05 | Phase 59.1 | Pending |
| ORG-06 | Phase 59.1 | Pending |
| ORG-07 | Phase 59.1 | Pending |
| GRAPH-01 | Phase 59.2 | Pending |
| GRAPH-02 | Phase 59.2 | Pending |
| GRAPH-03 | Phase 59.2 | Pending |
| GRAPH-04 | Phase 59.2 | Pending |
| GRAPH-05 | Phase 59.2 | Pending |
| GRAPH-06 | Phase 59.2 | Pending |
| GRAPH-07 | Phase 59.2 | Pending |
| GRAPH-08 | Phase 59.2 | Pending |

**Coverage:**
- v1.8.6 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after roadmap creation*
