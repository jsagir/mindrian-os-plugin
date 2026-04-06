# {{GROUP_NAME}} -- ICM Layer 0 (Group Identity)

**Question answered:** "What groups these rooms together?"

**Answer:** {{GROUP_RATIONALE}}

## ICM Compliance

This is a **grouping directory** within the MindrianRooms hierarchy. It does not contain artifacts directly -- it organizes rooms that share a common characteristic.

- **Layer 0 (this file):** Group identity -- why these rooms are together
- **Layer 1 (parent INDEX.md):** Routing -- the parent MindrianRooms index tracks all groups
- **Layer 2 (per-room STATE.md):** Each room retains its own contract and stage

## Contained Rooms

{{ROOM_LIST}}

## Grouping Rationale

**Created:** {{CREATED_DATE}}
**Source:** {{GROUPING_SOURCE}}
**Decision type:** GROUP (confirmed by user)

This grouping was {{GROUPING_EXPLANATION}}.

## Rules

1. Rooms inside this group retain full autonomy -- their STATE.md, CLAUDE.md, and sections are self-contained
2. This CLAUDE.md describes the GROUP, not the individual rooms
3. Moving a room out of this group does not break the room -- only this file needs updating
4. If all rooms are removed, this directory can be safely deleted
5. Maximum nesting depth: root / group / room (no groups inside groups)
