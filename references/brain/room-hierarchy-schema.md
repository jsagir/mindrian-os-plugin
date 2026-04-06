# Room Hierarchy Graph Schema

Schema for Room/RoomGroup hierarchy in both KuzuDB (local) and Neo4j Brain (remote).
Added in Phase 59.2. Additive-only -- filesystem + registry.json remain operational truth.

## Node Types

### Room
Represents a registered Data Room (venture workspace).

| Property | Type | Source | Notes |
|----------|------|--------|-------|
| name | STRING (PK) | registry.json key | Room slug, e.g. "acme-robotics" |
| venture_name | STRING | registry.json | Human-readable name |
| venture_stage | STRING | registry.json | Pre-Opportunity, Discovery, Validation, Design, Investment |
| domain | STRING | registry.json or inferred | Domain keywords |
| status | STRING | registry.json | active, parked, archived |
| created | STRING | registry.json | ISO 8601 timestamp |
| path | STRING | registry.json | Relative path from ROOMS_HOME |

**Present in:** KuzuDB + Brain

### RoomGroup
Represents a grouping directory (clients/, internal/, etc.).

| Property | Type | Source | Notes |
|----------|------|--------|-------|
| name | STRING (PK) | Directory name | Group slug, e.g. "clients" |
| icm_layer | STRING | Always "group" | ICM classification |
| rationale | STRING | CLAUDE.md first line | Why this group exists |
| path | STRING | Relative from ROOMS_HOME | Directory path |

**Present in:** KuzuDB + Brain

### RoomRoot (Brain only)
Singleton node representing ~/MindrianRooms/ itself.

| Property | Type | Notes |
|----------|------|-------|
| name | STRING (PK) | Always "MindrianRooms" |
| created | DATETIME | First sync timestamp |
| path | STRING | Always "~/MindrianRooms/" |

### VentureStage
Five-stage taxonomy (already exists in Brain, seeded in KuzuDB).

| Property | Type | Notes |
|----------|------|-------|
| name | STRING (PK) | Pre-Opportunity, Discovery, Validation, Design, Investment |

**Present in:** KuzuDB + Brain (pre-existing in Brain)

## Relationship Types

### CONTAINS
Physical hierarchy edges.

| From | To | Scope | Notes |
|------|----|-------|-------|
| RoomRoot | RoomGroup | Brain | Root contains groups |
| RoomRoot | Room | Brain | Root contains ungrouped rooms |
| RoomGroup | Room | Both | Group contains rooms |
| RoomGroup | RoomGroup | KuzuDB | Nested groups (future) |

### AT_STAGE
Connects Room to its current VentureStage.

| From | To | Scope | Notes |
|------|----|-------|-------|
| Room | VentureStage | Both | One edge per room, deleted and recreated on stage change |

### USES_FRAMEWORK (Brain only)
Connects Room to Framework nodes based on methodology commands run in that room.

| From | To | Properties | Notes |
|------|----|------------|-------|
| Room | Framework | first_used (datetime), usage_count (int) | Created from room/.analytics.json |

Source: `track-analytics` records command usage per room. `sync-rooms-brain` maps commands to Framework node names.

### SHARES_THEME (Brain only)
Cross-room content similarity detected from problem-definition keywords.

| From | To | Properties | Notes |
|------|----|------------|-------|
| Room | Room | shared_terms (string), term_count (int), detected (datetime) | Bidirectional conceptually, stored as directed edge |

Detection: reads first 5 files from each room's `problem-definition/` directory, extracts domain keywords (5+ chars), requires 10+ shared keywords for edge creation.

### HAS_SECTION (Brain only)
Wires Room to DataRoomSection nodes (13 existing orphans in Brain).

| From | To | Notes |
|------|----|-------|
| Room | DataRoomSection | Created only when section directory exists in room filesystem |

Standard sections: Problem Definition, Market Analysis, Solution Design, Business Model, Competitive Analysis, Team & Execution, Legal & IP, Financial Model, Opportunity Bank, Funding, Product, Decisions, Beta Testing.

### GROUPED_BY_USER (Brain only, future)
Created by /mos:organize move when user confirms a grouping.

| From | To | Properties |
|------|----|------------|
| Room | RoomGroup | timestamp (datetime), rationale (string) |

### SEPARATED_BY_USER (Brain only, future)
Created by /mos:organize when user rejects a grouping.

| From | To | Properties |
|------|----|------------|
| Room | Room | timestamp (datetime), reason (string) |

## KuzuDB DDL

Location: `$ROOMS_HOME/.rooms/.room-graph/`

```sql
-- Node tables
CREATE NODE TABLE IF NOT EXISTS Room(
  name STRING PRIMARY KEY,
  venture_name STRING,
  venture_stage STRING,
  domain STRING,
  status STRING,
  created STRING,
  path STRING
);

CREATE NODE TABLE IF NOT EXISTS RoomGroup(
  name STRING PRIMARY KEY,
  icm_layer STRING,
  rationale STRING,
  path STRING
);

CREATE NODE TABLE IF NOT EXISTS VentureStage(
  name STRING PRIMARY KEY
);

-- Relationship tables
CREATE REL TABLE IF NOT EXISTS CONTAINS(FROM RoomGroup TO Room);
CREATE REL TABLE IF NOT EXISTS GROUP_CONTAINS(FROM RoomGroup TO RoomGroup);
CREATE REL TABLE IF NOT EXISTS AT_STAGE(FROM Room TO VentureStage);
```

## Cypher Patterns for /mos:organize

### Get room hierarchy tree
```cypher
MATCH (root:RoomRoot {name: 'MindrianRooms'})
OPTIONAL MATCH (root)-[:CONTAINS]->(g:RoomGroup)-[:CONTAINS]->(r:Room)
OPTIONAL MATCH (root)-[:CONTAINS]->(ungrouped:Room)
WHERE NOT (ungrouped)<-[:CONTAINS]-(:RoomGroup)
RETURN g.name AS group_name,
       collect(DISTINCT r.name) AS grouped_rooms,
       collect(DISTINCT ungrouped.name) AS ungrouped_rooms
```

### Find rooms sharing frameworks
```cypher
MATCH (r1:Room)-[:USES_FRAMEWORK]->(f:Framework)<-[:USES_FRAMEWORK]-(r2:Room)
WHERE r1.name <> r2.name
RETURN r1.name, r2.name, collect(f.name) AS shared_frameworks
```

### Find rooms at the same venture stage
```cypher
MATCH (r:Room)-[:AT_STAGE]->(s:VentureStage)
RETURN s.name AS stage, collect(r.name) AS rooms
```

### Find rooms with shared themes
```cypher
MATCH (r1:Room)-[e:SHARES_THEME]->(r2:Room)
RETURN r1.name, r2.name, e.shared_terms, e.term_count
ORDER BY e.term_count DESC
```

### Find orphaned rooms (not in any group)
```cypher
MATCH (r:Room)
WHERE NOT (:RoomGroup)-[:CONTAINS]->(r)
RETURN r.name, r.venture_stage, r.status
```

### Get room's full context (all edges)
```cypher
MATCH (r:Room {name: $room_name})
OPTIONAL MATCH (r)-[:AT_STAGE]->(s:VentureStage)
OPTIONAL MATCH (r)-[:USES_FRAMEWORK]->(f:Framework)
OPTIONAL MATCH (r)-[:HAS_SECTION]->(sec:DataRoomSection)
OPTIONAL MATCH (r)-[:SHARES_THEME]-(other:Room)
RETURN r.name, s.name AS stage,
       collect(DISTINCT f.name) AS frameworks,
       collect(DISTINCT sec.name) AS sections,
       collect(DISTINCT other.name) AS theme_neighbors
```

## Sync Scripts

| Script | Target | Trigger | Frequency |
|--------|--------|---------|-----------|
| `scripts/sync-rooms-graph` | KuzuDB local | session-start, room-registry create/archive | Every session + on room changes |
| `scripts/sync-rooms-brain` | Neo4j Brain | session-start (when Brain available) | Best-effort, per session |

Both scripts are idempotent and fire-and-forget. Failure degrades gracefully:
- Brain unavailable -> KuzuDB only
- KuzuDB unavailable -> filesystem only (Tier 0)
- Both unavailable -> everything still works from registry.json

## Additive-Only Rule (D-15 through D-18)

1. Graph NEVER writes to filesystem or registry.json
2. Graph NEVER blocks any operation on failure
3. All graph operations are fire-and-forget (async, best-effort)
4. Graph data can be regenerated from filesystem at any time (no exclusive state)

The graph layer adds intelligence. It never owns truth.
