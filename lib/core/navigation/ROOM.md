# lib/core/navigation/

Phase 109 navigation spine internal helpers. Each .cjs file in this directory is an internal helper that lib/core/navigation.cjs (Plan 109-04) re-exports as part of the closed 13-function API surface.

Files:
- focus.cjs - getActiveFocus + setFocus + computeAutoFocus (Plan 109-02 / NAV-109-01)
- neighborhood.cjs - getNeighborhood recursive CTE wrapper (Plan 109-04 / NAV-109-02; not yet shipped)
- insights.cjs - 7 insight query primitives (Plan 109-05 / NAV-109-04; not yet shipped)
- packet.cjs - buildBrainPacket + storeBrainSuggestions (Plans 109-07 + 109-08 / NAV-109-06 + NAV-109-07; not yet shipped)
- room-home.cjs - getRoomHomeView composition (Plan 109-09 / NAV-109-08; not yet shipped)
- transitions.cjs - promoteNodeStatus chokepoint (Plan 109-04 / NAV-109-05; not yet shipped)

All helpers accept the open db handle as the first parameter; never call openRoomDb internally (the chokepoint module owns the lifecycle).

Owner: Phase 109 SQL Context-Memory Navigation Spine.
