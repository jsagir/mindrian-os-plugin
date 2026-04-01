# Brain Command Trigger Schema

## Purpose

Commands are first-class nodes in the Neo4j Brain. They have typed relationships to Frameworks, ProblemTypes, VentureStages, and Signals that define WHEN they should fire. The Brain doesn't just recommend frameworks -- it recommends ACTIONS mapped to specific /mos: commands with trigger conditions.

## Node: Command

```cypher
CREATE (c:Command {
  name: '/mos:find-analogies',
  slug: 'find-analogies',
  category: 'intelligence',          // infrastructure | methodology | intelligence | export | meeting | funding
  description: 'Cross-domain analogy discovery via structural isomorphism',
  jtbd_when: 'stuck on a problem that feels unique to your domain',
  jtbd_want: 'discover that other industries already solved the same structural conflict',
  jtbd_so: 'adapt their approach instead of inventing from scratch',
  time_estimate: '5 minutes',
  flags: ['--brain', '--external'],   // available flags
  min_sections: 2,                    // minimum populated sections to be relevant
  requires_brain: false,              // works without Brain (but better with)
  powerhouse: true                    // v1.6.0+ feature
})
```

## Relationships

### TRIGGERED_BY_SIGNAL

Links a Command to the Room Signal types that should trigger it.

```cypher
// When a CONTRADICTS edge exists between sections -> suggest find-analogies
CREATE (cmd:Command {name: '/mos:find-analogies'})-[:TRIGGERED_BY_SIGNAL {
  signal_type: 'TENSION',            // TENSION | BLIND_SPOT | BOTTLENECK | PATTERN | SURPRISE
  priority: 1,                        // 1=highest, 5=lowest
  condition: 'contradicts_count >= 1',
  jtbd_framing: 'When your Sections have unresolved Tensions, you want to see how other domains resolved the same structural conflict'
}]->(sig:SignalType {name: 'TENSION'})

// When 3+ sections have gaps -> suggest act --swarm
CREATE (cmd:Command {name: '/mos:act --swarm'})-[:TRIGGERED_BY_SIGNAL {
  signal_type: 'BLIND_SPOT',
  priority: 1,
  condition: 'gap_count >= 3',
  jtbd_framing: 'When 3+ Sections have Blind Spots, you want to fill them all at once instead of one at a time'
}]->(sig:SignalType {name: 'BLIND_SPOT'})

// When reverse salients detected -> suggest specific methodology for lagging section
CREATE (cmd:Command {name: '/mos:act'})-[:TRIGGERED_BY_SIGNAL {
  signal_type: 'BOTTLENECK',
  priority: 2,
  condition: 'reverse_salient_count >= 1',
  jtbd_framing: 'When a Section lags behind the others, you want to close the gap before it compounds'
}]->(sig:SignalType {name: 'BOTTLENECK'})
```

### FOLLOWS_FRAMEWORK

Links a Command to the Framework it should follow (chaining).

```cypher
// After JTBD analysis -> suggest Blue Ocean
CREATE (cmd:Command {name: '/mos:dominant-designs'})-[:FOLLOWS_FRAMEWORK {
  confidence: 0.85,
  reason: 'JTBD reveals customer needs; dominant designs reveals competitive whitespace',
  hop_distance: 1
}]->(f:Framework {name: 'Jobs-to-Be-Done'})

// After find-analogies -> suggest validate (stress-test the analogy)
CREATE (cmd:Command {name: '/mos:validate'})-[:FOLLOWS_FRAMEWORK {
  confidence: 0.90,
  reason: 'Analogies must be stress-tested before acting on them',
  hop_distance: 1
}]->(f:Framework {name: 'Design-by-Analogy'})

// After grade --full -> suggest act --swarm on weak sections
CREATE (cmd:Command {name: '/mos:act --swarm'})-[:FOLLOWS_FRAMEWORK {
  confidence: 0.80,
  reason: 'Grading reveals gaps; swarm attacks them in parallel',
  hop_distance: 1
}]->(f:Framework {name: 'Assessment'})
```

### RELEVANT_AT_STAGE

Links a Command to VentureStages where it's most impactful.

```cypher
// find-analogies is most powerful at Discovery and Design stages
CREATE (cmd:Command {name: '/mos:find-analogies'})-[:RELEVANT_AT_STAGE {
  impact: 'high',
  reason: 'Discovery needs fresh perspectives; Design needs proven patterns'
}]->(stage:VentureStage {name: 'Discovery'})

// grade --full becomes critical at Investment stage
CREATE (cmd:Command {name: '/mos:grade --full'})-[:RELEVANT_AT_STAGE {
  impact: 'critical',
  reason: 'Investment stage demands rigor across every Section'
}]->(stage:VentureStage {name: 'Investment'})

// scout is always relevant but especially at Validation
CREATE (cmd:Command {name: '/mos:scout'})-[:RELEVANT_AT_STAGE {
  impact: 'high',
  reason: 'Validation stage has deadlines and competitor dynamics'
}]->(stage:VentureStage {name: 'Validation'})
```

### ADDRESSES_PROBLEM_TYPE

Links a Command to ProblemTypes it solves (via multi-hop through Frameworks).

```cypher
// find-analogies addresses wicked problems (via Design-by-Analogy framework)
CREATE (cmd:Command {name: '/mos:find-analogies'})-[:ADDRESSES_PROBLEM_TYPE {
  via_framework: 'Design-by-Analogy',
  effectiveness: 0.85
}]->(pt:ProblemType {name: 'wicked'})

// act --swarm addresses complex problems with multiple dimensions
CREATE (cmd:Command {name: '/mos:act --swarm'})-[:ADDRESSES_PROBLEM_TYPE {
  via_framework: 'Multiple simultaneous frameworks',
  effectiveness: 0.90
}]->(pt:ProblemType {name: 'ill-defined-complex'})
```

### RESOLVES_TENSION_BETWEEN

Links a Command to Framework pairs that commonly produce contradictions.

```cypher
// find-analogies resolves tensions between pricing frameworks and competitive positioning
CREATE (cmd:Command {name: '/mos:find-analogies'})-[:RESOLVES_TENSION_BETWEEN {
  framework_a: 'Lean Canvas',
  framework_b: 'Competitive Analysis',
  resolution_pattern: 'Cross-domain structural isomorphism finds how other industries resolved pricing vs positioning'
}]->(tension:TensionType {name: 'pricing_vs_positioning'})
```

## Multi-Hop Proactive Query

The power of this schema is MULTI-HOP reasoning. The Brain can traverse:

```
User's Room State
  -> Current Frameworks (from Room artifacts)
    -> FEEDS_INTO relationships (what comes next)
      -> Command nodes (which /mos: command delivers it)
        -> TRIGGERED_BY_SIGNAL (is the trigger condition met?)
          -> Return ranked command suggestion with full JTBD framing
```

### Query: brain_proactive_command (Pattern 10d)

```cypher
// Multi-hop: Room frameworks -> next framework -> command -> trigger check
MATCH (current:Framework)<-[:FOLLOWS_FRAMEWORK]-(cmd:Command)
WHERE current.name IN $room_frameworks

// Check if command is relevant at this venture stage
OPTIONAL MATCH (cmd)-[stage_rel:RELEVANT_AT_STAGE]->(stage:VentureStage {name: $venture_stage})

// Check if command is triggered by current signals
OPTIONAL MATCH (cmd)-[trigger:TRIGGERED_BY_SIGNAL]->(sig:SignalType)

// Get success data
OPTIONAL MATCH (current)-[:APPLIED_IN]->(example:Example)
WHERE example.grade_numeric >= 80

RETURN cmd.name AS command,
       cmd.jtbd_when AS when_situation,
       cmd.jtbd_want AS want_motivation,
       cmd.jtbd_so AS so_outcome,
       cmd.time_estimate AS time,
       cmd.flags AS available_flags,
       stage_rel.impact AS stage_impact,
       trigger.signal_type AS triggered_by,
       trigger.condition AS trigger_condition,
       trigger.jtbd_framing AS trigger_framing,
       count(example) AS success_count
ORDER BY stage_rel.impact DESC, trigger.priority ASC, success_count DESC
LIMIT 5
```

**Parameters:**
- `$room_frameworks` -- frameworks used in Room (from artifact frontmatter)
- `$venture_stage` -- from STATE.md

**Output:** Ranked command suggestions with full JTBD framing, trigger conditions, and success data from real projects.

## Seeding Script

The Command nodes and trigger relationships need to be seeded into Neo4j. Create a script that:

1. Reads all commands/*.md files
2. Extracts: name, description, allowed-tools, category
3. Generates JTBD statements from the command's purpose
4. Creates Command nodes with relationships to:
   - Frameworks they follow (from methodology chaining rules)
   - VentureStages they're relevant at (from problem-types.md)
   - SignalTypes that trigger them (from proactive-intelligence patterns)
5. Runs the Cypher via `mcp__neo4j-brain__write_neo4j_cypher`

Script location: `scripts/seed-brain-commands.cjs`

## The Intelligence Hierarchy (Updated)

```
LEVEL 3 (Brain + Room + Signals):
  brain_proactive_command (Pattern 10d)
  Multi-hop: frameworks -> commands -> triggers -> JTBD
  Calibrated from 100+ real projects
  Knows which sequences ACTUALLY produced results

LEVEL 2 (Room + Local Fabric):
  Larry's JTBD provoked suggestions (every 3-7 turns)
  KuzuDB Tensions, Bottlenecks, Surprises, Convergences
  Good but not cross-venture calibrated

LEVEL 1 (No Room):
  Generic stage-based defaults
  methodology/index.md routing table
  Better than nothing
```

Brain-connected users get LEVEL 3: the Brain literally tells Larry which command to suggest, when, and why -- backed by data from 100+ real ventures. The JTBD framing is baked into the Command node itself. Larry just reads it and presents it naturally.
