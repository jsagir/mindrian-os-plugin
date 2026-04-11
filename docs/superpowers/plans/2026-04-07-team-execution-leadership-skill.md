# Team-Execution Leadership Skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port V2 leadership coaching intelligence into the team-execution room section as a proactive skill, so leadership insights surface automatically when users work with team data — not only when they manually run `/mos:leadership`.

**Architecture:** Three layers: (1) Codify 7 leadership knowledge domains as Neo4j graph nodes with FEEDS_INTO, ADDRESSES_PROBLEM_TYPE, and TEACHES edges connecting them to existing 87 frameworks. (2) Enrich plugin reference/command/skills with V2 leadership intelligence. (3) Add team-execution proactive signals. Version bump to 1.8.7.

**Tech Stack:** Markdown (skills, commands, references), Neo4j Cypher (Brain graph wiring), Bash (scripts), Node.js (verify-release)

---

## File Structure

| Action | File / System | Responsibility |
|--------|--------------|---------------|
| Write (Cypher) | Neo4j Brain graph | 7 KnowledgeDomain nodes + edges to frameworks, books, concepts |
| Write (Cypher) | Neo4j Brain graph | ProblemType nodes for leadership (Team Conflict, Delegation Gap, etc.) |
| Write (Cypher) | Neo4j Brain graph | TEACHES edges from frameworks to domains |
| Modify | `references/methodology/leadership.md` | Full V2 leadership knowledge (7 domains, ABET, patterns, reframes) |
| Modify | `commands/leadership.md` | Brain-enriched coaching with team-section awareness |
| Modify | `skills/room-proactive/SKILL.md` | Team-execution leadership signals (Tuckman, gaps, psychological safety) |
| Modify | `skills/brain-connector/SKILL.md` | Leadership framework chain queries |
| Modify | `.claude-plugin/plugin.json` | Version bump to 1.8.7 |
| Modify | `CHANGELOG.md` | v1.8.7 entry |
| Run | `scripts/verify-release` | Pre-release validation |

---

### Task 0: Wire Leadership Knowledge Domains into Brain Graph

**System:** Neo4j Brain (via mcp__my-neo4j__write_neo4j_cypher)

The 7 knowledge domains from V2's leadership.py must become first-class graph nodes. Each domain connects to existing frameworks (already wired in the graph), books (already in graph), and concepts. This creates queryable paths like: "User has a team conflict -> Brain recommends Thomas-Kilmann -> which lives in Domain 2 (Team Effectiveness) -> which chains to Tuckman -> which chains to High-Performing Teams."

- [ ] **Step 0.1: Create 7 KnowledgeDomain nodes with full metadata**

```cypher
// Create KnowledgeDomain label and 7 nodes
UNWIND [
  {name: 'Leadership Theories & Concepts',
   description: 'Transformational, Servant, Adaptive, Situational, Authentic, Systems, Distributed leadership models',
   domain_number: 1,
   key_models: 'Transformational, Servant, Adaptive, Situational, Authentic, Systems, Distributed',
   teaching_note: 'Never name-drop theories -- use them to reframe what the user describes'},
  {name: 'Team Effectiveness',
   description: 'Tuckman stages, Psychological Safety, High-performing dynamics, Conflict patterns (Thomas-Kilmann)',
   domain_number: 2,
   key_models: 'Tuckman, Edmondson Psychological Safety, Thomas-Kilmann',
   teaching_note: 'When user describes team friction, diagnose Tuckman stage FIRST -- most broken teams are just storming'},
  {name: 'Organizational Effectiveness',
   description: 'McKinsey 7S, Burke-Litwin change model, Strategic alignment',
   domain_number: 3,
   key_models: 'McKinsey 7S, Burke-Litwin',
   teaching_note: 'Surface when leadership challenge is actually an org design problem masquerading as a people problem'},
  {name: 'Self-Awareness & Personal Leadership',
   description: 'Leadership style preferences, Emotional Intelligence, Conflict resolution style awareness',
   domain_number: 4,
   key_models: 'EQ (Goleman), MBTI as conversation starter, Thomas-Kilmann',
   teaching_note: 'You cannot lead others until you can name your own patterns'},
  {name: 'Communication for Leadership',
   description: 'Verbal, written, visual, performative. Audience adaptation. Every leadership exercise IS communication.',
   domain_number: 5,
   key_models: 'Audience adaptation, Performative communication',
   teaching_note: 'Check: Have you actually said this to them, or just thought it?'},
  {name: 'Ethics in Leadership',
   description: 'Utilitarian, deontological, virtue, care ethics. Whistleblowing, moral courage.',
   domain_number: 6,
   key_models: 'Utilitarian, Deontological, Virtue, Care ethics',
   teaching_note: 'Surface ethical dimensions proactively -- leaders often miss them until too late'},
  {name: 'Strategic Leadership Frameworks',
   description: 'SWOT, PESTEL, Porters Five Forces, Cynefin, OODA, Scenario Planning applied to leadership decisions',
   domain_number: 7,
   key_models: 'SWOT, PESTEL, Porters, Cynefin, OODA, Scenario Planning',
   teaching_note: 'Bridge leadership decisions to venture strategy -- connect to /mos:scenario-plan'}
] AS d
MERGE (kd:KnowledgeDomain {name: d.name})
SET kd.description = d.description,
    kd.domain_number = d.domain_number,
    kd.key_models = d.key_models,
    kd.teaching_note = d.teaching_note,
    kd.source = 'V2 leadership.py (Aronhime methodology)',
    kd.created = '2026-04-07'
RETURN count(kd) AS domains_created
```

Expected: 7 domains created.

- [ ] **Step 0.2: Connect KnowledgeDomains to existing Leadership Frameworks via TEACHES**

```cypher
// Domain 1: Leadership Theories -> individual leadership frameworks
UNWIND [
  {domain: 'Leadership Theories & Concepts', fw: 'Transformational Leadership'},
  {domain: 'Leadership Theories & Concepts', fw: 'Servant Leadership'},
  {domain: 'Leadership Theories & Concepts', fw: 'Adaptive Leadership'},
  {domain: 'Leadership Theories & Concepts', fw: 'Situational Leadership'},
  {domain: 'Leadership Theories & Concepts', fw: 'Authentic Leadership'},
  {domain: 'Leadership Theories & Concepts', fw: 'Systems Leadership'},
  {domain: 'Leadership Theories & Concepts', fw: 'Distributed Leadership'},
  // Domain 2: Team Effectiveness
  {domain: 'Team Effectiveness', fw: 'Tuckman Team Stages'},
  {domain: 'Team Effectiveness', fw: 'Psychological Safety'},
  {domain: 'Team Effectiveness', fw: 'High-Performing Teams'},
  {domain: 'Team Effectiveness', fw: 'Conflict Resolution Framework'},
  {domain: 'Team Effectiveness', fw: 'Safe Fail Culture'},
  // Domain 3: Organizational Effectiveness
  {domain: 'Organizational Effectiveness', fw: 'Systems Thinking'},
  {domain: 'Organizational Effectiveness', fw: 'Systems Leadership'},
  // Domain 4: Self-Awareness
  {domain: 'Self-Awareness & Personal Leadership', fw: 'Emotional Intelligence in Leadership'},
  {domain: 'Self-Awareness & Personal Leadership', fw: 'Six Thinking Hats'},
  // Domain 5: Communication
  {domain: 'Communication for Leadership', fw: 'Communication for Leaders'},
  {domain: 'Communication for Leadership', fw: 'Conflict Resolution Framework'},
  // Domain 6: Ethics
  {domain: 'Ethics in Leadership', fw: 'Engineering Ethics in Leadership'},
  {domain: 'Ethics in Leadership', fw: 'Strategic Decision Making for Leaders'},
  // Domain 7: Strategic
  {domain: 'Strategic Leadership Frameworks', fw: 'Scenario Planning'},
  {domain: 'Strategic Leadership Frameworks', fw: 'Scenario Analysis Framework'},
  {domain: 'Strategic Leadership Frameworks', fw: 'Cynefin Framework'},
  {domain: 'Strategic Leadership Frameworks', fw: 'Systems Thinking'},
  {domain: 'Strategic Leadership Frameworks', fw: 'Red Teaming'}
] AS mapping
MATCH (kd:KnowledgeDomain {name: mapping.domain}), (fw:Framework {name: mapping.fw})
MERGE (kd)-[:TEACHES {confidence: 0.85}]->(fw)
RETURN count(*) AS teaches_edges
```

Expected: ~25 TEACHES edges.

- [ ] **Step 0.3: Create leadership-specific ProblemType nodes**

```cypher
// Leadership problem types that the graph can route to specific frameworks
UNWIND [
  {name: 'Team Conflict', description: 'Interpersonal friction, role confusion, or communication breakdown within team'},
  {name: 'Delegation Gap', description: 'Founder doing everything, unable to let go of tasks, bottleneck'},
  {name: 'Culture Drift', description: 'Team values diverging from founder vision as team grows'},
  {name: 'Leadership Identity', description: 'Founder unsure what kind of leader to be, imposter syndrome'},
  {name: 'Scaling Leadership', description: 'Leadership style that worked at 3 people breaks at 10'},
  {name: 'Advisory Dysfunction', description: 'Advisors/mentors not being used effectively or creating confusion'}
] AS pt
MERGE (p:ProblemType {name: pt.name})
SET p.description = pt.description,
    p.category = 'leadership',
    p.created = '2026-04-07'
RETURN count(p) AS problem_types_created
```

Expected: 6 leadership ProblemType nodes.

- [ ] **Step 0.4: Wire leadership ProblemTypes to Frameworks via ADDRESSES_PROBLEM_TYPE**

```cypher
UNWIND [
  // Team Conflict -> conflict resolution frameworks
  {pt: 'Team Conflict', fw: 'Conflict Resolution Framework', eff: 0.9},
  {pt: 'Team Conflict', fw: 'Psychological Safety', eff: 0.85},
  {pt: 'Team Conflict', fw: 'Tuckman Team Stages', eff: 0.8},
  {pt: 'Team Conflict', fw: 'Six Thinking Hats', eff: 0.7},
  {pt: 'Team Conflict', fw: 'Communication for Leaders', eff: 0.75},
  // Delegation Gap -> leadership style frameworks
  {pt: 'Delegation Gap', fw: 'Servant Leadership', eff: 0.85},
  {pt: 'Delegation Gap', fw: 'Distributed Leadership', eff: 0.9},
  {pt: 'Delegation Gap', fw: 'Situational Leadership', eff: 0.85},
  {pt: 'Delegation Gap', fw: 'Adaptive Leadership', eff: 0.75},
  // Culture Drift -> values/vision frameworks
  {pt: 'Culture Drift', fw: 'Authentic Leadership', eff: 0.85},
  {pt: 'Culture Drift', fw: 'Transformational Leadership', eff: 0.9},
  {pt: 'Culture Drift', fw: 'Psychological Safety', eff: 0.8},
  {pt: 'Culture Drift', fw: 'Safe Fail Culture', eff: 0.75},
  // Leadership Identity -> self-awareness frameworks
  {pt: 'Leadership Identity', fw: 'Emotional Intelligence in Leadership', eff: 0.9},
  {pt: 'Leadership Identity', fw: 'Authentic Leadership', eff: 0.85},
  {pt: 'Leadership Identity', fw: 'Six Thinking Hats', eff: 0.8},
  // Scaling Leadership -> systems/distributed frameworks
  {pt: 'Scaling Leadership', fw: 'Systems Leadership', eff: 0.9},
  {pt: 'Scaling Leadership', fw: 'Distributed Leadership', eff: 0.85},
  {pt: 'Scaling Leadership', fw: 'High-Performing Teams', eff: 0.85},
  {pt: 'Scaling Leadership', fw: 'Tuckman Team Stages', eff: 0.8},
  // Advisory Dysfunction -> communication/strategic frameworks
  {pt: 'Advisory Dysfunction', fw: 'Communication for Leaders', eff: 0.85},
  {pt: 'Advisory Dysfunction', fw: 'Strategic Decision Making for Leaders', eff: 0.8},
  {pt: 'Advisory Dysfunction', fw: 'Conflict Resolution Framework', eff: 0.7}
] AS mapping
MATCH (pt:ProblemType {name: mapping.pt}), (fw:Framework {name: mapping.fw})
MERGE (fw)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: mapping.eff}]->(pt)
RETURN count(*) AS edges_created
```

Expected: ~23 ADDRESSES_PROBLEM_TYPE edges.

- [ ] **Step 0.5: Connect KnowledgeDomains to existing Books in the graph**

```cypher
UNWIND [
  {domain: 'Leadership Theories & Concepts', book: 'Start with Why'},
  {domain: 'Leadership Theories & Concepts', book: 'The Effective Executive'},
  {domain: 'Team Effectiveness', book: 'The Fifth Discipline'},
  {domain: 'Team Effectiveness', book: 'Creativity, Inc.'},
  {domain: 'Self-Awareness & Personal Leadership', book: 'Thinking in Bets'},
  {domain: 'Self-Awareness & Personal Leadership', book: 'How to Think Like Leonardo da Vinci'},
  {domain: 'Strategic Leadership Frameworks', book: 'Only the Paranoid Survive'},
  {domain: 'Strategic Leadership Frameworks', book: 'Good to Great'},
  {domain: 'Strategic Leadership Frameworks', book: 'Scenarios: Uncharted Waters Ahead'}
] AS mapping
MATCH (kd:KnowledgeDomain {name: mapping.domain}), (b:Book {name: mapping.book})
MERGE (b)-[:GROUNDS_DOMAIN {relevance: 0.8}]->(kd)
RETURN count(*) AS book_edges
```

Expected: ~9 GROUNDS_DOMAIN edges.

- [ ] **Step 0.6: Connect domains to the Causal Reasoning concept**

```cypher
// Team Effectiveness and Organizational Effectiveness involve causal reasoning
MATCH (c:Concept {name: 'Causal Reasoning'})
MATCH (kd:KnowledgeDomain) WHERE kd.name IN ['Team Effectiveness', 'Organizational Effectiveness', 'Strategic Leadership Frameworks']
MERGE (kd)-[:RELATED_TO]->(c)
RETURN count(*) AS causal_edges
```

Expected: 3 RELATED_TO edges.

- [ ] **Step 0.7: Create ABET Integration node and connect to domains**

```cypher
MERGE (abet:Framework {name: 'ABET Accreditation Outcomes'})
WITH abet
UNWIND [
  {domain: 'Communication for Leadership', outcome: 'Communication', description: 'Every leadership exercise IS communication'},
  {domain: 'Ethics in Leadership', outcome: 'Ethics', description: 'Surface ethical dimensions in every case'},
  {domain: 'Team Effectiveness', outcome: 'Teamwork', description: 'Team is the primary learning laboratory'},
  {domain: 'Self-Awareness & Personal Leadership', outcome: 'Lifelong Learning', description: 'Metacognition -- how leaders learn to learn'}
] AS mapping
MATCH (kd:KnowledgeDomain {name: mapping.domain})
MERGE (abet)-[:MAPS_TO {outcome: mapping.outcome, description: mapping.description}]->(kd)
RETURN count(*) AS abet_edges
```

Expected: 4 MAPS_TO edges.

- [ ] **Step 0.8: Verify the full leadership subgraph**

```cypher
// Count all new nodes and edges
MATCH (kd:KnowledgeDomain) RETURN 'KnowledgeDomain nodes' AS metric, count(kd) AS value
UNION ALL
MATCH (kd:KnowledgeDomain)-[r:TEACHES]->(fw:Framework) RETURN 'TEACHES edges' AS metric, count(r) AS value
UNION ALL
MATCH (fw:Framework)-[r:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType {category: 'leadership'}) RETURN 'Leadership ProblemType edges' AS metric, count(r) AS value
UNION ALL
MATCH (b:Book)-[r:GROUNDS_DOMAIN]->(kd:KnowledgeDomain) RETURN 'GROUNDS_DOMAIN edges' AS metric, count(r) AS value
UNION ALL
MATCH (abet:Framework {name: 'ABET Accreditation Outcomes'})-[r:MAPS_TO]->(kd:KnowledgeDomain) RETURN 'ABET MAPS_TO edges' AS metric, count(r) AS value
```

Expected: 7 domains, ~25 TEACHES, ~23 leadership ProblemType edges, ~9 book edges, 4 ABET edges.

- [ ] **Step 0.9: Test a leadership routing query end-to-end**

```cypher
// Simulate: "I have a team conflict" -> what does the Brain recommend?
MATCH (pt:ProblemType {name: 'Team Conflict'})<-[r:ADDRESSES_PROBLEM_TYPE]-(fw:Framework)
OPTIONAL MATCH (fw)-[:FEEDS_INTO]->(next:Framework)
OPTIONAL MATCH (kd:KnowledgeDomain)-[:TEACHES]->(fw)
RETURN fw.name AS framework, r.effectiveness AS effectiveness,
       collect(DISTINCT next.name) AS next_steps,
       collect(DISTINCT kd.name) AS knowledge_domains
ORDER BY r.effectiveness DESC
```

Expected: Conflict Resolution (0.9), Psychological Safety (0.85), Tuckman (0.8) with their chains and domains.

---

### Task 1: Enrich Leadership Reference with V2 Knowledge Domains

**Files:**
- Modify: `references/methodology/leadership.md`

This is the core knowledge port. The current file is 122 lines with phases and an artifact template. V2 has 207 lines with 7 deep knowledge domains, ABET integration, conversation patterns, and reframes that make Larry's coaching rich. We merge them.

- [ ] **Step 1: Read current leadership reference**

```bash
cat references/methodology/leadership.md
```

Confirm current structure: Framework Overview, Voice, Phases (1-4), Conversation Patterns, Artifact Template, Default Room, Cross-References, Quick Pass vs Deep Dive.

- [ ] **Step 2: Add 7 Knowledge Domains section after Framework Overview**

Insert after the existing `## Framework Overview` section. This is the V2 IP that makes coaching deep rather than generic:

```markdown
## Core Knowledge Domains

Larry draws from these 7 domains, weaving them naturally into coaching — never lecturing. Introduce a domain ONLY when the conversation earns it (Ask-Tell Dial >= 0.55).

### 1. Leadership Theories & Concepts
Transformational (inspire vision), Servant (serve first), Adaptive (navigate uncertainty), Situational (flex style to readiness), Authentic (values-aligned), Systems (see the whole), Distributed (shared leadership across team). Never name-drop theories — use them to reframe what the user describes.

### 2. Team Effectiveness
Tuckman stages (Forming/Storming/Norming/Performing/Adjourning), Psychological Safety (Edmondson), High-performing team dynamics, Conflict patterns (Thomas-Kilmann: competing/collaborating/compromising/avoiding/accommodating). When user describes team friction, diagnose the Tuckman stage FIRST — most "broken teams" are just storming.

### 3. Organizational Effectiveness
McKinsey 7S (Strategy/Structure/Systems/Shared Values/Style/Staff/Skills), Burke-Litwin change model, Strategic alignment. Surface when user's leadership challenge is actually an organizational design problem masquerading as a people problem.

### 4. Self-Awareness & Personal Leadership
Leadership style preferences (MBTI as conversation starter, not gospel), Emotional Intelligence (self-awareness/self-regulation/motivation/empathy/social skill), Conflict resolution style awareness. The reframe: "You can't lead others until you can name your own patterns."

### 5. Communication
Verbal, written, visual, performative. Audience adaptation. Every leadership exercise IS a communication exercise. When coaching on team dynamics, check: "Have you actually said this to them, or just thought it?"

### 6. Ethics in Leadership
Utilitarian (greatest good), deontological (duty-based), virtue (character), care (relationships). Whistleblowing, moral courage, ethical decision frameworks. Surface ethical dimensions proactively — leaders often miss them until it is too late.

### 7. Strategic Frameworks
SWOT, PESTEL, Porter's Five Forces, Cynefin (complexity), OODA (decision speed), Scenario Planning. These connect leadership decisions to venture strategy. When a leadership challenge has strategic implications, bridge to `/mos:scenario-plan` or `/mos:challenge-assumptions`.
```

- [ ] **Step 3: Add ABET Engineering Integration section**

Insert after Knowledge Domains:

```markdown
## ABET Engineering Integration

For engineering teams and academic contexts, leadership maps to ABET accreditation outcomes:

| ABET Outcome | Leadership Connection |
|-------------|----------------------|
| Engineering Design | Leadership decisions ARE design problems with stakeholder constraints |
| Communication | Every leadership exercise is fundamentally a communication exercise |
| Ethics | Surface ethical dimensions in every case — leaders miss them |
| Teamwork | The team IS the primary learning laboratory for leadership |
| Experimentation | Leadership hypotheses are tested like engineering experiments |
| Lifelong Learning | Metacognition — how leaders learn to learn from experience |

When coaching engineers or students, connect leadership concepts to these outcomes naturally. Never announce "this maps to ABET" — let the connection emerge.
```

- [ ] **Step 4: Add Signature Reframes section**

Insert after ABET Integration:

```markdown
## Signature Reframes

These are Larry's power moves for leadership coaching. Use when the user is stuck in a management mindset:

| Trigger | Reframe |
|---------|---------|
| User describes task management | "That's a management answer. What's the leadership answer?" |
| User wants to "fix" their team | "Teams aren't broken. They're stuck in a pattern. Name the pattern." |
| User describes team actions | "You've described what your team does. What does your team believe?" |
| User focuses on individual performance | "You're optimizing parts. What's the system doing?" |
| User avoids conflict | "Harmony isn't health. What conversation are you avoiding?" |
| User over-plans | "Plans are hypotheses. What's your first experiment?" |
```

- [ ] **Step 5: Add Brain-Enriched Framework Chains section**

Insert before Cross-References:

```markdown
## Brain Framework Chains (when connected)

When Brain MCP is available, Larry can traverse the leadership framework graph:

**Chain: Team Assessment Pipeline**
Six Thinking Hats -> Emotional Intelligence -> Adaptive Leadership -> Situational Leadership

**Chain: Team Building Pipeline**
Psychological Safety -> Safe Fail Culture -> Tuckman Team Stages -> High-Performing Teams

**Chain: Strategic Leadership Pipeline**
Systems Thinking -> Systems Leadership -> Transformational Leadership -> Distributed Leadership

**Chain: Conflict Resolution Pipeline**
Conflict Resolution -> Communication for Leaders -> Servant Leadership -> Distributed Leadership

Query pattern for Brain:
```cypher
MATCH (f:Framework)-[:FEEDS_INTO*1..4]->(target)
WHERE f.name IN ['Emotional Intelligence in Leadership', 'Tuckman Team Stages', 'Psychological Safety']
RETURN [n IN nodes(path) | n.name] AS chain
```

Use chains to suggest next steps: "You've assessed team stage. The graph says Psychological Safety is the prerequisite for what comes next."
```

- [ ] **Step 6: Verify the reference file is well-formed**

```bash
wc -l references/methodology/leadership.md
```

Expected: ~250-280 lines (up from 122).

- [ ] **Step 7: Commit**

```bash
git add references/methodology/leadership.md
git commit -m "feat(leadership): port V2 7-domain knowledge, ABET, reframes to reference"
```

---

### Task 2: Enrich Leadership Command with Brain + Team Awareness

**Files:**
- Modify: `commands/leadership.md`

The current command is 32 lines — thin wrapper that reads the reference. Enrich it to: detect team profiles in the room, query Brain for relevant frameworks, and adapt coaching to the team's current state.

- [ ] **Step 1: Read current leadership command**

```bash
cat commands/leadership.md
```

- [ ] **Step 2: Add team-section awareness to the Setup section**

After the existing setup steps (Read reference, Read voice-dna, Read STATE.md), add:

```markdown
4. Check for team context:
   - Read `room/team-execution/` entries (ls the directory)
   - Read `room/team/members/` if it exists (team member profiles)
   - Count team members, identify gaps (no mentors? no advisors?)
   - Read any existing leadership assessment artifacts

5. If Brain is connected (mcp__mindrian-brain tools available):
   - Query Brain for leadership frameworks matching current venture stage
   - Get the FEEDS_INTO chain from the user's current team state
   - Use Brain calibration: what leadership patterns correlate with the user's venture stage?
```

- [ ] **Step 3: Add team-context-aware opening**

Add after the Setup section, before the existing flow:

```markdown
## Team Context Adaptation

If team profiles exist in the room, adapt the opening:

**Solo founder (0-1 team members):**
Opening: "Building alone or building a team? Both are leadership -- just different kinds."
Focus: Self-leadership, founder identity, when to bring people in.

**Small team (2-4 members):**
Opening: Reference specific team members by name from profiles.
Focus: Tuckman stage diagnosis, role clarity, communication patterns.

**Growing team (5+ members):**
Opening: "At this size, the team is becoming a system. Systems need different leadership than groups."
Focus: Distributed leadership, culture-setting, delegation patterns.

**Has mentors/advisors:**
Acknowledge their advisory network. Ask: "How are you actually using your advisors? Most founders collect advisors like trophies and never call them."

If no team data exists in the room:
Use the standard Socratic opening from the reference. After the session, suggest: "Want to map your team? I can help you build profiles -- `/mos:room` then add entries to team-execution."
```

- [ ] **Step 4: Add Brain-enriched framework suggestion**

Add to the end of the methodology flow:

```markdown
## Brain-Enriched Suggestions (when connected)

After the coaching session, if Brain MCP is available:

1. Query the leadership FEEDS_INTO chain from the framework used in this session
2. Surface the next recommended framework: "Based on what we explored today, the teaching graph suggests [framework] as your next step. It builds on [what we discussed]."
3. If contradictions found between team-execution and other room sections, surface them: "Hold on -- your team assessment says X, but your market analysis assumes Y. Worth reconciling."
```

- [ ] **Step 5: Verify command file is valid**

```bash
head -10 commands/leadership.md | grep "name: leadership"
claude plugin validate . 2>&1 | tail -1
```

Expected: `name: leadership` in frontmatter, validation passed.

- [ ] **Step 6: Commit**

```bash
git add commands/leadership.md
git commit -m "feat(leadership): add team-context awareness + Brain enrichment to command"
```

---

### Task 3: Add Team-Execution Signals to Room-Proactive Skill

**Files:**
- Modify: `skills/room-proactive/SKILL.md`

Room-proactive already detects gaps, contradictions, and convergence. Add team-execution-specific signals that surface leadership intelligence automatically.

- [ ] **Step 1: Read current room-proactive skill**

```bash
cat skills/room-proactive/SKILL.md
```

Identify where detection types are defined and where capability suggestions live.

- [ ] **Step 2: Add team-execution gap detection signals**

In the Gap Detection section, add these team-specific signals:

```markdown
### Team-Execution Leadership Signals

Detect these conditions in `room/team-execution/` and `room/team/`:

| Signal | Condition | Confidence | Message |
|--------|-----------|------------|---------|
| `GAP:TEAM:no_profiles` | team-execution/ has 0 member profiles AND team/members/ empty or missing | HIGH | "No team mapped yet. Leadership starts with knowing who you're leading. Try: /mos:leadership" |
| `GAP:TEAM:no_mentors` | team/mentors/ empty or missing AND 3+ team members exist | MEDIUM | "Team of [N] with no advisors mapped. Most ventures this size benefit from external perspective." |
| `GAP:TEAM:solo_founder` | Only 1 person in team/ AND venture_stage past Pre-Opportunity | MEDIUM | "Solo at [stage] stage. The question isn't if you need a team -- it's what kind." |
| `GAP:TEAM:no_assessment` | team-execution/ has member profiles but no leadership assessment artifact | MEDIUM | "Team profiles exist but no leadership assessment. Run /mos:leadership to diagnose team dynamics." |
| `GAP:TEAM:stale_assessment` | Leadership assessment artifact older than 30 days AND room has new entries | LOW | "Leadership assessment is [N] days old. Team dynamics shift -- worth revisiting." |
```

- [ ] **Step 3: Add team-execution contradiction detection**

In the Contradiction Detection section, add:

```markdown
### Team-Execution Contradictions

| Signal | Condition | Confidence | Message |
|--------|-----------|------------|---------|
| `CONTRADICT:TEAM:capacity_mismatch` | solution-design requires capabilities not present in any team profile | HIGH | "Solution design needs [capability] but no team member covers it. Hire, partner, or simplify?" |
| `CONTRADICT:TEAM:stage_mismatch` | Team structure suggests Ready to Build but venture_stage is Pre-Opportunity | MEDIUM | "Full team assembled but problem isn't validated yet. Building before validating is the #1 startup killer." |
```

- [ ] **Step 4: Add team-execution capability suggestion**

In the Capability Suggestions section, add:

```markdown
| LEADERSHIP_COACHING | 2+ team members + no leadership artifact | `/mos:leadership` | "Team mapped but no leadership assessment. Understanding how you lead matters as much as what you build." |
```

- [ ] **Step 5: Verify skill file is valid markdown**

```bash
wc -l skills/room-proactive/SKILL.md
head -5 skills/room-proactive/SKILL.md
```

- [ ] **Step 6: Commit**

```bash
git add skills/room-proactive/SKILL.md
git commit -m "feat(proactive): add team-execution leadership gap/contradiction signals"
```

---

### Task 4: Add Leadership Chain Queries to Brain-Connector Skill

**Files:**
- Modify: `skills/brain-connector/SKILL.md`

Brain-connector already does passive enrichment and proactive surfacing. Add leadership-specific query patterns that activate when team context is present.

- [ ] **Step 1: Read current brain-connector skill**

```bash
cat skills/brain-connector/SKILL.md
```

Identify the Passive Enrichment and Proactive Surfacing sections.

- [ ] **Step 2: Add leadership query patterns to Passive Enrichment**

In the Passive Enrichment section, add:

```markdown
### Team-Execution Enrichment

When the user is discussing team, leadership, or working in team-execution section:

1. Query Brain for leadership frameworks matching the discussion:
```cypher
MATCH (f:Framework)-[:RELATED_TO]->(:Concept {name: 'Causal Reasoning'})
WHERE f.name IN ['Tuckman Team Stages', 'Psychological Safety', 'Adaptive Leadership',
                  'Emotional Intelligence in Leadership', 'High-Performing Teams']
OPTIONAL MATCH (f)-[:TYPICAL_AT]->(s:VentureStage {name: $venture_stage})
RETURN f.name, s IS NOT NULL AS matches_stage
ORDER BY matches_stage DESC
```

2. Surface the leadership FEEDS_INTO chain relevant to the conversation:
```cypher
MATCH (f:Framework {name: $current_framework})-[:FEEDS_INTO*1..3]->(next:Framework)
WHERE next.name IN ['Adaptive Leadership', 'Situational Leadership', 'High-Performing Teams',
                     'Distributed Leadership', 'Systems Leadership', 'Transformational Leadership']
RETURN next.name AS suggested, [r IN relationships(path) | r.confidence] AS confidence
ORDER BY confidence DESC LIMIT 3
```

3. Weave naturally: "The teaching graph connects what you're describing to [framework] -- it addresses the [specific gap] you mentioned."
```

- [ ] **Step 3: Add leadership proactive surfacing**

In the Proactive Surfacing section, add:

```markdown
### Leadership Proactive Signals

On SessionStart, if room has team-execution entries:

1. Check if any leadership frameworks from the graph have been used vs. available:
```cypher
MATCH (f:Framework)-[:TYPICAL_AT]->(s:VentureStage {name: $stage})
WHERE f.name IN ['Tuckman Team Stages', 'Psychological Safety', 'Adaptive Leadership',
                  'Emotional Intelligence in Leadership', 'High-Performing Teams',
                  'Servant Leadership', 'Distributed Leadership', 'Transformational Leadership']
RETURN f.name AS available_framework
```

2. Compare against frameworks already applied in room (from STATE.md `frameworks_used`)
3. If 3+ unused leadership frameworks are available for the current stage, surface: "Your team section has data but you haven't used [N] leadership frameworks that match your stage. /mos:leadership to explore."
```

- [ ] **Step 4: Verify skill file**

```bash
head -5 skills/brain-connector/SKILL.md
```

- [ ] **Step 5: Commit**

```bash
git add skills/brain-connector/SKILL.md
git commit -m "feat(brain): add leadership framework chain queries to brain-connector"
```

---

### Task 5: Version Bump, Changelog, Validate, Release

**Files:**
- Modify: `.claude-plugin/plugin.json` (version to 1.8.7)
- Modify: `CHANGELOG.md` (new entry)
- Modify: `~/mindrian-marketplace/.claude-plugin/marketplace.json` (version to 1.8.7)
- Run: `scripts/verify-release`

- [ ] **Step 1: Bump plugin version to 1.8.7**

```bash
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('.claude-plugin/plugin.json', 'utf8'));
p.version = '1.8.7';
fs.writeFileSync('.claude-plugin/plugin.json', JSON.stringify(p, null, 2) + '\n');
console.log('Plugin bumped to', p.version);
"
```

- [ ] **Step 2: Bump marketplace version to 1.8.7**

```bash
node -e "
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('$HOME/mindrian-marketplace/.claude-plugin/marketplace.json', 'utf8'));
m.plugins[0].version = '1.8.7';
fs.writeFileSync('$HOME/mindrian-marketplace/.claude-plugin/marketplace.json', JSON.stringify(m, null, 2) + '\n');
console.log('Marketplace bumped to', m.plugins[0].version);
"
```

- [ ] **Step 3: Add CHANGELOG entry**

Prepend to CHANGELOG.md:

```markdown
## [1.8.7] - 2026-04-07

### Added
- Leadership coaching intelligence integrated into team-execution room section
- V2 leadership knowledge ported: 7 domains, ABET integration, signature reframes
- Team-execution proactive signals: team gaps, solo founder detection, assessment staleness
- Team-execution contradiction detection: capacity mismatch, stage mismatch
- Brain leadership framework chains: 4 coaching pipelines (assessment, building, strategic, conflict)
- Team-context-aware coaching: adapts opening based on team size and composition
- Brain-enriched framework suggestions after coaching sessions
```

- [ ] **Step 4: Run verify-release**

```bash
bash scripts/verify-release
```

Expected: 0 failures. All 14 sections pass.

- [ ] **Step 5: Commit plugin**

```bash
git add .claude-plugin/plugin.json CHANGELOG.md references/methodology/leadership.md commands/leadership.md skills/room-proactive/SKILL.md skills/brain-connector/SKILL.md
git commit -m "release: v1.8.7 -- team-execution leadership intelligence"
git tag v1.8.7
```

- [ ] **Step 6: Commit marketplace**

```bash
cd ~/mindrian-marketplace
git add .claude-plugin/marketplace.json
git commit -m "release: sync to v1.8.7"
```

- [ ] **Step 7: Push both repos**

```bash
cd ~/MindrianOS-Plugin && git push origin main --tags
cd ~/mindrian-marketplace && git push origin master
```

- [ ] **Step 8: Update local cache and verify**

```bash
claude plugin marketplace update mindrian-marketplace
claude plugin update mos@mindrian-marketplace
```

Expected: "Plugin mos updated from 1.8.6 to 1.8.7"

- [ ] **Step 9: Final validation**

```bash
claude plugin validate ~/.claude/plugins/cache/mindrian-marketplace/mos/1.8.7
```

Expected: Validation passed.
