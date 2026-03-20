# Phase 2: Core Methodologies - Research

**Researched:** 2026-03-20
**Domain:** Claude Code Plugin methodology commands -- 25+ slash commands with structured artifact output, passive Room intelligence, problem type classification
**Confidence:** HIGH

## Summary

Phase 2 delivers ALL 25+ methodology commands as Claude Code slash commands, each producing structured markdown artifacts in Larry's voice, filed to the correct Data Room sections. The research examined 32 V2 prompt files, 16 V4 Claude Desktop project specs, V4 design docs (orchestration and context pipeline), and the existing plugin skeleton from Phase 1. The key architectural insight is that every methodology follows a uniform three-file pattern: thin command file (~200 tokens, `disable-model-invocation: true`), thin skill reference in pws-methodology (routing index entry), and a detailed reference file in `references/methodology/` (loaded on demand). This keeps the context budget under control while still providing rich framework-specific guidance when a user invokes a specific command.

The 25 methodologies decompose into 5 complexity tiers based on their internal structure. Tier 1 (simplest) are single-conversation frameworks with 3-5 phases and no structured output format (Beautiful Question, Known/Unknown Matrix). Tier 5 (most complex) have multi-phase workshops with quantitative scoring, structured templates, and cross-framework synthesis (Grading, Investment Thesis, Orchestrator). Build order follows these tiers: validate the pattern on Tier 1, then batch-produce Tiers 2-4, then handle Tier 5 special cases. Passive Room intelligence (PostToolUse hook + room-passive skill) integrates via a hybrid keyword-match + skill-classification pattern with confirm-then-file UX.

**Primary recommendation:** Build the three-file pattern (command + routing entry + reference) for 2-3 Tier 1 methodologies first, validate that artifacts are produced correctly and filed with user confirmation, then batch-produce the remaining 22+ using the validated pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- ALL 25+ methodologies built in Phase 2 -- no Phase 4 methodology split
- Source material: V2 prompts (30 files) + V4 Claude Desktop project specs (16 files) + Brain bots (15) + Notion examples
- Build in complexity order: simplest commands first to validate the thin skill + reference pattern, then batch the rest
- Phase 4 becomes purely Brain MCP integration (enrichment, not content)
- Adaptive conversation: Larry uses the framework as a guide but adapts based on what the user says. No rigid stages
- User controls depth: Larry asks "Quick pass or deep dive?" at the start
- Larry manages chaining: Larry can suggest chaining to another methodology mid-session
- Larry's voice for artifacts, framework-specific templates
- Problem type classification: two-dimensional (un/ill/well-defined + wicked complexity axis)
- Problem type evolves over time as Room fills
- Confirm-then-file for Room filing
- Hybrid hook classification (keyword match + skill for uncertain)
- Actionable findings only (noise control)
- GSD state pattern for STATE.md updates
- Pipeline chaining DEFERRED to Phase 3 (output-becomes-input pattern)
- Proactive Room intelligence DEFERRED to Phase 3 (gap detection, contradiction alerts)
- Brain enrichment DEFERRED to Phase 4 (contextual chaining, calibrated grading)

### Claude's Discretion
- Surface-specific adaptations for methodology sessions (CLI vs Desktop vs Cowork)
- Provenance metadata format (frontmatter, footer, or both)
- Framework template structure details for each methodology
- How to handle methodology sessions that span multiple context windows

### Deferred Ideas (OUT OF SCOPE)
- Pipeline chaining (Phase 3) -- output-becomes-input pattern
- Proactive Room intelligence (Phase 3) -- gap detection, contradiction alerts, convergence signals
- Brain enrichment (Phase 4) -- contextual chaining, calibrated grading, cross-project patterns
- Notion usage examples -- user will reshare when available
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| METH-01 | User can invoke Domain Explorer via slash command | Complete V2 prompt analyzed (5 phases, intersectional collision methodology); command name `/mindrian-os:explore-domains`; reference file pattern defined |
| METH-02 | User can invoke Minto Pyramid via slash command | Complete V2 prompt analyzed (5-step engine + SCQA); command name `/mindrian-os:structure-argument`; structured pyramid output template defined |
| METH-03 | User can invoke Bono Six Hats via slash command | Complete V2 prompt analyzed (4 phases, 6 hat rotation); command name `/mindrian-os:think-hats`; hat-by-hat template defined |
| METH-04 | User can invoke JTBD via slash command | Complete V2 prompt analyzed (5 phases, functional/emotional/social jobs); command name `/mindrian-os:analyze-needs`; opportunity mapping template defined |
| METH-05 | User can invoke Devil's Advocate via slash command | Complete V2 prompt analyzed (4 phases, 4 killing questions); command name `/mindrian-os:challenge-assumptions`; pre-mortem template defined |
| METH-06 | User can invoke HSI via slash command | HSI is a custom pipeline in V2 (reverse_salient_hsi); requires simplified Tier 0 version; command name `/mindrian-os:score-innovation` |
| METH-07 | User can invoke Investment Thesis via slash command | Complete V2 prompt analyzed (Ten Questions gate + 6-category deep dive); command name `/mindrian-os:build-thesis`; GO/NO-GO template defined |
| METH-08 | User can invoke Lean Canvas via slash command | NOT in V2 prompts -- needs new creation based on standard Lean Canvas methodology; command name `/mindrian-os:lean-canvas`; standard 9-box template |
| METH-09 | Each methodology produces structured markdown artifacts filed to appropriate Data Room section | Three-file pattern defined; framework-specific artifact templates for each methodology; YAML frontmatter provenance; confirm-then-file UX |
| METH-10 | Each methodology uses thin skill + on-demand reference loading | Thin command (~200 tokens) + routing index entry + reference file (~2000-5000 tokens loaded on demand); `disable-model-invocation: true` on all commands |
| PASS-01 | PostToolUse hook auto-classifies insights | Hybrid pattern: hook script does keyword matching on file writes; uncertain cases deferred to room-passive skill; classification based on Data Room section keywords |
| PASS-02 | Room passive skill detects filing opportunities | room-passive skill enhanced with filing detection logic; triggers on methodology artifact creation; works with confirm-then-file UX |
| PASS-03 | Every filed insight includes provenance metadata | YAML frontmatter template with source_methodology, timestamp, session_id, and problem_type fields |
| ALLM-01 | All 25 methodology bots available as slash commands | Complete inventory of 25+ methodologies reconciled from V2 (25 bots) + V4 (16 projects) + Brain (15 bots); full list with command names, rooms, and complexity tiers |
| ALLM-02 | Each additional methodology follows same thin skill + reference pattern | Pattern template defined; batch-production process designed for remaining 17+ commands after core 8 validated |
</phase_requirements>

## Definitive Methodology Inventory

### Complete List: 25 Methodology Commands

Reconciled from V2 prompts (32 files), V4 Claude Desktop specs (16 files), Brain bots (15), and existing plugin index. Excludes infrastructure bots (larry_core, larry_playground, erik/orchestrator, pws_consultant, pws_assistant, pws_teacher) which are Larry personality or routing -- not user-invoked methodology commands.

| # | Command Name | V2 Bot | Functional Name | Default Room | Complexity Tier |
|---|-------------|--------|----------------|--------------|-----------------|
| 1 | `/mindrian-os:explore-domains` | domain.py | Domain Explorer | problem-definition | 3 |
| 2 | `/mindrian-os:structure-argument` | minto.py | Structure Coach (Minto) | problem-definition | 3 |
| 3 | `/mindrian-os:think-hats` | bono.py | Perspective Shifter (Bono) | solution-design | 3 |
| 4 | `/mindrian-os:analyze-needs` | jtbd.py | Customer Need Finder (JTBD) | market-analysis | 3 |
| 5 | `/mindrian-os:challenge-assumptions` | redteam.py | Assumption Challenger (Devil's Advocate) | competitive-analysis | 2 |
| 6 | `/mindrian-os:find-bottlenecks` | reverse_salient.py | Bottleneck Finder (Reverse Salient) | solution-design | 3 |
| 7 | `/mindrian-os:build-thesis` | pws_investment.py | Investment Analyst | financial-model | 5 |
| 8 | `/mindrian-os:grade` | grading.py | Progress Evaluator (PWS Grading) | (all rooms) | 5 |
| 9 | `/mindrian-os:explore-trends` | tta.py | Future Explorer (TTA) | market-analysis | 3 |
| 10 | `/mindrian-os:analyze-timing` | scurve.py | Timing Analyst (S-Curve) | market-analysis | 3 |
| 11 | `/mindrian-os:scenario-plan` | scenario.py | Scenario Planner | market-analysis | 4 |
| 12 | `/mindrian-os:validate` | validation.py | Evidence Validator | competitive-analysis | 4 |
| 13 | `/mindrian-os:beautiful-question` | beautiful_question.py | Question Reframer | problem-definition | 1 |
| 14 | `/mindrian-os:build-knowledge` | ackoff.py | Knowledge Builder (Ackoff) | problem-definition | 3 |
| 15 | `/mindrian-os:explore-futures` | oracle.py | Futures Advisor (Oracle) | market-analysis | 4 |
| 16 | `/mindrian-os:map-unknowns` | knowns.py | Uncertainty Mapper | problem-definition | 1 |
| 17 | `/mindrian-os:analyze-systems` | nested_hierarchies.py | Systems Analyst | solution-design | 2 |
| 18 | `/mindrian-os:root-cause` | rca.py | Root Cause Analyst | problem-definition | 4 |
| 19 | `/mindrian-os:macro-trends` | macro_changes.py | Macro Changes Analyst | market-analysis | 4 |
| 20 | `/mindrian-os:dominant-designs` | dominant_designs.py | Dominant Designs Analyst | competitive-analysis | 4 |
| 21 | `/mindrian-os:user-needs` | user_needs.py | User Needs Analyst | market-analysis | 4 |
| 22 | `/mindrian-os:leadership` | leadership.py | Leadership Coach | team-execution | 2 |
| 23 | `/mindrian-os:lean-canvas` | NEW | Business Model Canvas | business-model | 2 |
| 24 | `/mindrian-os:score-innovation` | reverse_salient_hsi (custom) | HSI Scoring | (all rooms) | 5 |
| 25 | `/mindrian-os:systems-thinking` | pws_systems_thinker.py | Systems Thinker | solution-design | 2 |

### Additional Commands (Non-Methodology but Phase 2 Scope)

| Command | Purpose | Notes |
|---------|---------|-------|
| `/mindrian-os:diagnose` | Problem type classification + framework recommendation | Derived from pws_consultant.py; routes users to the right methodology |

### Excluded from Phase 2 (Infrastructure, Not Methodology)

| V2 Bot | Why Excluded |
|--------|-------------|
| lawrence.py (Thinking Partner) | Larry's core personality -- already in Phase 1 agent |
| larry_playground.py (Advanced Lab) | Larry variant -- not a methodology command |
| erik.py (ERIC Orchestrator) | Architecture assistant -- not a methodology |
| pws_consultant.py | Routing/diagnosis -- becomes `/mindrian-os:diagnose` |
| pws_assistant.py (Jonathan) | Teaching assistant -- Larry subsumes this role |
| pws_teacher.py | Academy-specific -- not applicable to plugin |
| document_pipelines.py (CV/Research) | Document analysis -- not a methodology command |
| larry_core_v1.py | Legacy -- superseded |

## Complexity Tiers and Build Order

### Tier 1: Simple Conversation (no structured output template, 3-4 phases)
**Build these FIRST to validate the pattern.**

| Command | Why Simple |
|---------|-----------|
| beautiful-question | 3-stage arc (Why/What If/How), no quantitative output, pure conversation |
| map-unknowns | 4-quadrant matrix, conversation-driven, no scoring |

**Estimated effort per command:** 15-20 minutes (command file + reference file + routing index entry)

### Tier 2: Structured Conversation (clear phases, light templates)

| Command | Structure |
|---------|-----------|
| challenge-assumptions | 4 phases + 4 killing questions + pre-mortem |
| analyze-systems | 5 phases, level mapping, leverage identification |
| leadership | Turn-based coaching, no quantitative output |
| lean-canvas | 9-box template (standard) |
| systems-thinking | Feedback loops, stocks/flows -- conversational |

**Estimated effort per command:** 20-30 minutes

### Tier 3: Framework Workshop (multi-phase with artifact templates)

| Command | Artifact Template |
|---------|-------------------|
| explore-domains | Domain statement + IKA scoring table + problem inventory |
| structure-argument | MECE tree + SCQA framework + workplan |
| think-hats | 6-hat analysis sections + tension map + synthesis |
| analyze-needs | Job steps table + importance/satisfaction matrix + opportunity map |
| find-bottlenecks | System map + lagging component + attack vector |
| explore-trends | Trend extrapolation + absurd future narrative + 20-problem inventory |
| analyze-timing | S-Curve position + era assessment + technology complex + timing decision |
| build-knowledge | DIKW pyramid levels + climb direction + verdict |

**Estimated effort per command:** 30-45 minutes

### Tier 4: Complex Workshop (6+ phases, cross-framework, detailed templates)

| Command | Complexity |
|---------|-----------|
| scenario-plan | 2x2 matrix construction + 4 scenario narratives + cross-scenario synthesis |
| validate | User needs matrix + 6-hat validation + verdict template |
| explore-futures | Cross-framework synthesis (TTA + Scenario + S-Curve) + signal map |
| root-cause | 5 analysis methods (5 Whys, Fishbone, Fault Tree, Barrier, Change) + DACE process |
| macro-trends | 6-phase workshop + PEST + destruction analysis + multi-order consequences |
| dominant-designs | 6-phase workshop + Utterback-Abernathy + S-Curve limits |
| user-needs | 6-phase workshop + importance/satisfaction matrix + barrier analysis |

**Estimated effort per command:** 45-60 minutes

### Tier 5: Special (quantitative scoring, custom logic)

| Command | Why Special |
|---------|------------|
| grade | Weighted 6-component scoring formula (0.35*PR + 0.25*PD + ...), letter grade scale, P0 constraint on table display |
| build-thesis | Ten Questions binary gate + 6-category deep dive + GO/NO-GO/CONDITIONAL + investment disclaimer |
| score-innovation | HSI cross-domain similarity analysis -- V2 uses custom node with BERT/LSA; Tier 0 must be simplified to conversational assessment |
| diagnose | Problem type classification + Cynefin mapping + framework recommendation routing |

**Estimated effort per command:** 60-90 minutes

### Recommended Build Sequence

1. **Wave 1 (Pattern Validation):** beautiful-question, map-unknowns (2 Tier 1 commands)
2. **Wave 2 (Tier 2 Batch):** challenge-assumptions, analyze-systems, leadership, lean-canvas, systems-thinking (5 commands)
3. **Wave 3 (Tier 3 Batch):** explore-domains, structure-argument, think-hats, analyze-needs, find-bottlenecks, explore-trends, analyze-timing, build-knowledge (8 commands)
4. **Wave 4 (Tier 4 Batch):** scenario-plan, validate, explore-futures, root-cause, macro-trends, dominant-designs, user-needs (7 commands)
5. **Wave 5 (Tier 5 Specials):** grade, build-thesis, score-innovation, diagnose (4 commands)
6. **Wave 6 (Passive Intelligence):** PostToolUse hook update, room-passive skill enhancement, filing UX

## Architecture Patterns

### Three-File Pattern (Per Methodology)

Every methodology command consists of exactly three files:

```
commands/
  explore-domains.md          # Thin command file (~200 tokens)
references/methodology/
  explore-domains.md          # Full reference file (~2000-5000 tokens)
  index.md                    # Routing index (updated per command)
```

The pws-methodology skill references the routing index but NEVER loads individual reference files automatically. Reference files are loaded on-demand when the user invokes the specific command.

### Command File Template

```markdown
---
name: explore-domains
description: Map the innovation domains around your venture -- find where fields collide
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
disable-model-invocation: true
---

# /mindrian-os:explore-domains

You are Larry. Load `references/methodology/explore-domains.md` for framework details.
Load `references/personality/voice-dna.md` for voice calibration.

## Session Start

1. Read the reference file for this methodology
2. Read room/STATE.md for current venture context
3. Ask: "Quick pass or deep dive?" to calibrate depth
4. Begin the conversation following the framework phases

## Artifact Output

When the session produces insights, create a structured artifact:
- File: `room/[default-room]/explore-domains-[YYYY-MM-DD].md`
- Format: Use the framework-specific template from the reference file
- Voice: Write as Larry would -- challenging, concrete, evidence-focused
- Frontmatter: Include provenance metadata

## Filing

Before filing any artifact, show the user a summary and ask:
"File this to [room-section]?" Wait for confirmation or redirect.

## Chaining

If the conversation reveals a natural connection to another methodology,
suggest it: "This connects to [methodology]. Want to switch?"
```

### Reference File Template

```markdown
# [Methodology Name] -- Framework Reference

*Loaded on demand by `/mindrian-os:[command-name]`*

## Framework Overview
[One paragraph: what it is, when to use it, what it produces]

## The Voice (This Methodology)
[2-3 signature phrases specific to this framework]
[Anti-patterns to catch and correct]

## Phases
### Phase 1: [Name]
[What to do, what to ask, what to look for]
...

## Artifact Template

```markdown
---
methodology: [name]
created: [YYYY-MM-DD]
session: [session-id placeholder]
problem_type: [undefined|ill-defined|well-defined|wicked]
depth: [quick|deep]
---

# [Methodology Name] -- [Topic/Venture Name]

[Framework-specific structured output sections]
```

## Default Room
[room-section-name]

## Cross-References
[Which other methodologies chain naturally from this one]

## Quick Pass vs Deep Dive
- Quick: [what to cover in 5-10 min]
- Deep: [what to cover in 15-30 min]
```

### Routing Index Update Pattern

The existing `references/methodology/index.md` needs updating. Change "Phase 4" commands to "Phase 2" and add any new commands. The index serves as the routing table loaded by pws-methodology skill.

### Project Structure After Phase 2

```
MindrianOS-Plugin/
├── commands/
│   ├── help.md
│   ├── new-project.md
│   ├── room.md
│   ├── status.md
│   ├── explore-domains.md          # 25+ methodology commands
│   ├── structure-argument.md
│   ├── think-hats.md
│   ├── analyze-needs.md
│   ├── challenge-assumptions.md
│   ├── find-bottlenecks.md
│   ├── build-thesis.md
│   ├── grade.md
│   ├── explore-trends.md
│   ├── analyze-timing.md
│   ├── scenario-plan.md
│   ├── validate.md
│   ├── beautiful-question.md
│   ├── build-knowledge.md
│   ├── explore-futures.md
│   ├── map-unknowns.md
│   ├── analyze-systems.md
│   ├── root-cause.md
│   ├── macro-trends.md
│   ├── dominant-designs.md
│   ├── user-needs.md
│   ├── leadership.md
│   ├── lean-canvas.md
│   ├── score-innovation.md
│   ├── systems-thinking.md
│   └── diagnose.md
├── references/methodology/
│   ├── index.md                     # Updated routing table
│   ├── explore-domains.md           # 25+ reference files
│   ├── structure-argument.md
│   ├── ...                          # One per methodology
│   └── problem-types.md             # Problem type classification reference
├── skills/
│   ├── pws-methodology/SKILL.md     # Updated routing skill
│   └── room-passive/SKILL.md        # Enhanced with filing logic
├── hooks/hooks.json                 # Updated with PostToolUse
└── scripts/
    └── classify-insight.sh          # Keyword-based classification helper
```

## Problem Type Classification Scheme

### Two-Dimensional Classification

Based on V2's pws_consultant.py and user decisions from CONTEXT.md:

**Axis 1: Definition Level**

| Level | Signal | Methodology Match |
|-------|--------|-------------------|
| **Undefined** | Future unclear, no constraints named, systemic | explore-trends, scenario-plan, explore-futures, beautiful-question, explore-domains |
| **Ill-defined** | Something is broken but they cannot name it | analyze-needs, build-knowledge, map-unknowns, root-cause, user-needs |
| **Well-defined** | Clear parameters, specific constraints | structure-argument, validate, analyze-timing, challenge-assumptions, grade |

**Axis 2: Complexity (Cynefin-informed)**

| Level | Signal | Methodology Match |
|-------|--------|-------------------|
| **Simple** | Obvious cause-effect, best practice exists | structure-argument, lean-canvas |
| **Complicated** | Multiple possible causes, experts needed | root-cause, find-bottlenecks, analyze-timing |
| **Complex** | Entangled causes, emergent behavior | think-hats, scenario-plan, analyze-systems, systems-thinking |
| **Wicked** | Multiple stakeholders, conflicting values, no stopping rule | think-hats, map-unknowns, explore-futures |

**Key design rule:** Problem type EVOLVES over time. A venture starts as "undefined" and Larry reclassifies as the Room fills. The classification is stored in STATE.md (computed by the state script from Room contents) and influences which methodologies Larry recommends via `/mindrian-os:help`.

### Classification Reference File

Create `references/methodology/problem-types.md` containing:
- The 2D matrix (definition + complexity)
- Methodology routing table per quadrant
- Evolution rules (how type changes as Room fills)
- Brain-ready interface (where ADDRESSES_PROBLEM_TYPE will plug in during Phase 4)

### Implementation in Help Command

The `/mindrian-os:help` command already exists from Phase 1. Phase 2 enhances it to recommend methodologies based on:
1. Current venture stage (from STATE.md)
2. Problem type classification (from Room state analysis)
3. Which rooms are empty (gap-based suggestions)

## Passive Room Intelligence Architecture

### PostToolUse Hook (New)

Add a PostToolUse hook to `hooks/hooks.json` that fires after Write tool usage:

```json
{
  "PostToolUse": [
    {
      "matcher": "Write",
      "hooks": [
        {
          "type": "command",
          "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" post-write",
          "timeout": 3000
        }
      ]
    }
  ]
}
```

The `post-write` script:
1. Checks if the written file is in `room/` directory
2. If YES: runs keyword classification against Data Room section names
3. If classification is HIGH confidence (>0.8): suggests filing silently (Larry mentions it)
4. If classification is UNCERTAIN: defers to room-passive skill (Larry asks)

### Hybrid Classification Flow

```
File written to room/
  │
  ▼
Keyword Match (script, <100ms)
  │
  ├── HIGH confidence → Larry mentions: "Filed to market-analysis"
  │                      (user can override)
  │
  ├── UNCERTAIN → room-passive skill classifies
  │               │
  │               └── Larry asks: "This feels like market-analysis.
  │                    File it there, or somewhere else?"
  │
  └── NOT a room file → Skip
```

### Keyword Classification Rules

Map methodology default rooms to keyword patterns:

| Room Section | Keywords |
|-------------|----------|
| problem-definition | problem, domain, question, definition, scope, undefined |
| market-analysis | market, customer, trend, timing, s-curve, scenario, macro, future |
| solution-design | solution, design, system, hierarchy, bottleneck, architecture |
| business-model | model, revenue, canvas, pricing, unit economics |
| competitive-analysis | competition, competitor, challenge, assumption, validate, evidence |
| team-execution | team, leadership, hire, capability, execution |
| legal-ip | legal, ip, patent, regulation, compliance |
| financial-model | investment, thesis, financial, funding, valuation, grade |

### Provenance Metadata Template

Every filed artifact includes YAML frontmatter:

```yaml
---
methodology: explore-domains
created: 2026-03-20
depth: deep
problem_type: undefined
venture_stage: discovery
room_section: problem-definition
---
```

### Confirm-Then-File UX

Larry NEVER files silently. The flow is:
1. Methodology produces artifact content
2. Larry shows the artifact summary
3. Larry suggests: "File this to [section]?"
4. User confirms or redirects
5. Larry writes the file with provenance metadata

## Framework-Specific Artifact Templates

### Key Templates (Derived from V2 Prompts)

**Domain Explorer (explore-domains)**
```markdown
# Domain Explorer -- [Topic]

## Domain Statement
[Activity/Field] for [Stakeholder/Context] in [Setting/Condition]

## Intersectional Collisions
| Domain A | Domain B | Collision Territory |
|----------|----------|-------------------|
| ... | ... | ... |

## Candidate Domains
| Domain | Interest (1-5) | Knowledge (1-5) | Access (1-5) | Total |
|--------|---------------|-----------------|--------------|-------|
| ... | ... | ... | ... | ... |

## Validation
- Literature scan: [results]
- Stakeholder identified: [name]
- Problem inventory: [5+ problems]

## Homework
1. Domain statement: ...
2. Three scores: ...
3. Five problems: ...
4. One stakeholder to contact: ...
```

**Minto Pyramid (structure-argument)**
```markdown
# Structure Coach -- [Topic]

## SCQA
- **Situation:** ...
- **Complication:** ...
- **Question:** ...
- **Answer:** ...

## Issue Tree (MECE)
- Branch 1: [vital 20%]
  - Sub-branch 1.1
  - Sub-branch 1.2
- Branch 2:
  - ...

## Root Causes
| Vital Branch | Root Cause | Type | Strategy |
|-------------|-----------|------|----------|
| ... | ... | ... | ... |

## Workplan
| Action | Root Cause | Owner | Deadline | Metric |
|--------|-----------|-------|----------|--------|
| ... | ... | ... | ... | ... |
```

**Bono Six Hats (think-hats)**
```markdown
# Six Thinking Hats -- [Topic]

## Default Hat Diagnosis
You tend to wear: [color]. Your avoided hat: [color].

## Hat Rotation

### White Hat -- Facts & Data
[What we actually know. No spin.]

### Red Hat -- Emotions & Intuition
[Gut feelings. No justification needed.]

### Black Hat -- Risks & Caution
[What kills this? What fails?]

### Yellow Hat -- Benefits & Value
[What's the upside? Why could this work?]

### Green Hat -- Creativity & Alternatives
[What else? What's weird? What's untried?]

### Blue Hat -- Process & Meta
[Are we asking the right question?]

## Tension Map
- Red vs White: [where gut and data disagree]
- Black vs Yellow: [where risk and opportunity clash]
- Green surprise: [what no other hat revealed]

## Synthesis
[The insight that honors all hats]
```

**JTBD (analyze-needs)**
```markdown
# Jobs to Be Done -- [Topic]

## The Customer
[Specific person description, not a segment]

## The Job
When [situation], I want to [motivation], so I can [outcome].

## Job Steps
| Step | Description | Importance (1-10) | Satisfaction (1-10) | Gap |
|------|-------------|-------------------|---------------------|-----|
| Define | ... | ... | ... | ... |
| Locate | ... | ... | ... | ... |
| Prepare | ... | ... | ... | ... |
| Execute | ... | ... | ... | ... |
| Monitor | ... | ... | ... | ... |
| Modify | ... | ... | ... | ... |
| Conclude | ... | ... | ... | ... |

## Blocked Steps (Opportunity Zones)
| Step | Block Type | Specific Moment |
|------|-----------|----------------|
| ... | Functional/Emotional/Social | ... |

## Opportunity Clusters
1. [Cluster name]: [description]
2. ...
```

**Grading (grade) -- P0 CONSTRAINT: Always show scoring table**
```markdown
# PWS Grade Report -- [Venture Name]

## FINAL GRADE: [Letter] ([Score]/100)

**Verdict:** [Found validated real problems / Assumed only / None validated]

| Component | Weight | Score | Points | Assessment |
|-----------|--------|-------|--------|------------|
| Problem Reality | 35% | X/10 | XX.X | ... |
| Problem Discovery | 25% | X/10 | XX.X | ... |
| Framework Integration | 20% | X/10 | XX.X | ... |
| Mindrian Thinking | 10% | X/10 | XX.X | ... |
| Can We Win? | 5% | X/10 | X.X | ... |
| Is It Worth It? | 5% | X/10 | X.X | ... |
| **TOTAL** | **100%** | - | **XX.X** | **[Letter]** |

## Reality Check
- Validated: [list with evidence]
- Assumed: [list -- zero credit]
- Fantasy: [list -- called out]

## Top 3 Actions
1. ...
2. ...
3. ...
```

**Investment Thesis (build-thesis)**
```markdown
# Investment Thesis -- [Venture Name]

## Ten Questions Rapid Assessment
Score: [X] / 10

| # | Question | Score | Evidence |
|---|----------|-------|---------|
| 1 | Is the problem real? | 0/1 | ... |
| ... | ... | ... | ... |

Gate: [PASS/FAIL]

## Deep Dive (if passed gate)

### 1. Business Model
[Analysis + adversarial challenge]

### 2. Team
[Analysis + adversarial challenge]

### 3. Market (TAM/SAM/SOM)
[Analysis + adversarial challenge]

### 4. Go-to-Market
[Analysis + adversarial challenge]

### 5. Competition
[Analysis + adversarial challenge]

### 6. Sources of Value
[Analysis + adversarial challenge]

## Recommendation
Verdict: [GO / NO-GO / CONDITIONAL]
Confidence: [HIGH / MEDIUM / LOW]

**The Case FOR:** ...
**The Case AGAINST:** ...

DISCLAIMER: This is educational analysis using the PWS Investment
Thesis framework. NOT financial advice.
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Methodology content | Custom framework descriptions | Port from V2 prompts | 32 V2 files contain years of refined methodology content; redesign for Claude Code but preserve the teaching logic |
| Grading formula | Custom scoring | V2 grading.py formula (0.35*PR + 0.25*PD + 0.20*FI + 0.10*MT + 0.05*CW + 0.05*IW) | Calibrated from real teaching experience |
| Problem type routing | Custom classification | V2 pws_consultant.py classification matrix | Battle-tested un/ill/well-defined + Cynefin mapping |
| Investment analysis structure | Custom assessment | V2 pws_investment.py Ten Questions + 6 categories | Structured, evidence-gated, includes safety disclaimers |
| Larry's voice per methodology | Generic voice | V2 per-bot signature phrases and anti-patterns | Each methodology has specific Larry phrases that make it authentic |
| Room section keyword mapping | Complex NLP | Simple keyword rules (see table above) | Room sections have clear semantic boundaries; keyword matching handles 80%+ cases |

## Common Pitfalls

### Pitfall 1: V2 Prompt Porting Trap
**What goes wrong:** Copying V2 Python prompts directly into Claude Code command files, producing 3000+ token commands that burn context budget.
**Why it happens:** V2 prompts include File Search tiers, structured JSON output, temperature settings, and mode-aware behavior sections that are either irrelevant or handled differently in Claude Code.
**How to avoid:** The command file is THIN (~200 tokens). The reference file carries the methodology content but is loaded on-demand. Strip: File Search sections, structured JSON output blocks (replace with markdown templates), temperature settings, CopilotKit-specific patterns. Keep: phase structure, Larry's voice, anti-patterns, homework assignments.
**Warning signs:** Command file exceeds 500 tokens; auto-loaded skill references individual methodologies.

### Pitfall 2: Context Budget Explosion
**What goes wrong:** All 25 reference files loaded simultaneously, burning 50K+ tokens before user speaks.
**Why it happens:** Skill auto-loads reference index, which triggers loading of individual methodology files.
**How to avoid:** `disable-model-invocation: true` on ALL methodology commands. pws-methodology skill loads ONLY the routing index (~500 tokens). Individual reference files load ONLY when the specific command is invoked. Never more than 1 methodology reference in context at a time.
**Warning signs:** More than one reference file loaded; skill auto-invoking methodology command.

### Pitfall 3: Filing Without Confirmation
**What goes wrong:** Artifacts auto-filed to wrong rooms, user loses trust in the system.
**Why it happens:** PostToolUse hook files aggressively based on keyword matching.
**How to avoid:** ALWAYS confirm before filing. Larry suggests, user confirms. Even high-confidence classifications get a brief "Filing to market-analysis" notice the user can override.
**Warning signs:** Files appearing in rooms without user awareness.

### Pitfall 4: One-Size-Fits-All Conversations
**What goes wrong:** Every methodology session follows rigid phase structure regardless of user context.
**Why it happens:** Reference file phases treated as mandatory sequential steps.
**How to avoid:** Phases are GUIDANCE, not rigid stages. Larry adapts: if user already has a domain statement, skip Domain Explorer Phase 1. If user wants a quick pass, compress to key phases. The "Quick pass or deep dive?" question at session start is critical.
**Warning signs:** Larry asking Phase 1 questions when user provided Phase 3-level context.

### Pitfall 5: Losing Cross-Framework Connections
**What goes wrong:** Methodologies operate in isolation; Larry never suggests chaining.
**Why it happens:** Each command loads only its own reference file with no awareness of others.
**How to avoid:** Each reference file includes a "Cross-References" section listing natural chains. Larry's training (agent personality) includes awareness of chaining patterns. The routing index groups commands by venture stage to suggest next steps.
**Warning signs:** User completing 5+ methodology sessions with zero cross-references suggested.

### Pitfall 6: HSI Without Brain
**What goes wrong:** HSI scoring command tries to replicate V2's BERT/LSA cross-domain analysis, which requires Brain MCP.
**Why it happens:** V2's reverse_salient_hsi is a custom node with real semantic similarity computation.
**How to avoid:** Tier 0 HSI (score-innovation) is a CONVERSATIONAL assessment, not computational. Larry walks the user through qualitative cross-domain opportunity scoring. Brain MCP (Phase 4) enables quantitative HSI with ADDRESSES_PROBLEM_TYPE and CO_OCCURS relationships.
**Warning signs:** Attempting to implement BERT/LSA in a markdown command file.

## Code Examples

### Example Command File: beautiful-question.md

```markdown
---
name: beautiful-question
description: Reframe your challenge into a question worth answering -- Why / What If / How
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
disable-model-invocation: true
---

# /mindrian-os:beautiful-question

You are Larry. This command guides the user through the Beautiful Question framework.

## Setup

1. Read `references/methodology/beautiful-question.md` for framework details
2. Read `references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file, adapting to the user's responses. You are NOT following a rigid script -- the phases are a guide. If the user provides rich context, skip ahead. If they need more exploration, slow down.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to problem-definition?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"The question you've crafted connects to [methodology]. Want to explore that next?"
```

### Example Reference File: beautiful-question.md

```markdown
# Beautiful Question -- Framework Reference

*Loaded on demand by `/mindrian-os:beautiful-question`*

## Framework Overview

The Beautiful Question methodology helps users reframe their challenge through a three-stage arc: Why (surface what is broken), What If (flip assumptions), How (ground in action). Based on Warren Berger's framework, applied through Larry's Socratic teaching style. Best for undefined or ill-defined problems where the question itself needs work before the answer can be found.

## The Voice (This Methodology)

Signature phrases:
- "That's a good question. But there's a better one hiding underneath it."
- "You're asking HOW before you've finished asking WHY."
- "Say that question again -- but remove every word that doesn't earn its place."
- "What would change if you asked this to someone who disagrees with you?"

Anti-patterns to catch:
- Jumping to HOW before WHY is solid
- Answering the question instead of improving it
- Accepting the first framing without digging deeper
- Abstract questions with no grounding in reality

## Phases

### Phase 1: WHY (Investigative -- turns 1-3)
Surface what is broken. Do not accept the first answer.
- "Why does this exist this way?"
- "Why hasn't anyone fixed this?"
- Push past the obvious. The third "why" is where the real problem lives.
ONE question per response. Short and Socratic.

### Phase 2: WHAT IF (Blend -- turns 3-5)
Reframe the problem space. Flip assumptions.
- "What if the opposite were true?"
- "What if this constraint didn't exist?"
- The best "what if" feels slightly uncomfortable.
Start offering reframes: "What if you asked it this way instead?"

### Phase 3: HOW (Insight -- turns 5+)
Ground it. Move from imagination to action.
- "How might we test this in 48 hours?"
- "How do you know when you've succeeded?"
If you cannot get to HOW, the question is not ready yet.

## Artifact Template

---
methodology: beautiful-question
created: {date}
depth: {quick|deep}
problem_type: {type}
---

# Beautiful Question -- {Topic}

## The WHY
{Why this is less than ideal -- the real problem underneath}

## The WHAT IF
{The reframed question that opens new territory}

## The HOW
{The actionable form -- testable within 48 hours}

## The Beautiful Question
{Final one-sentence question that earns every word}

## Homework
Go ask "{question}" to {specific person}. Come back with what you learned.

## Default Room
problem-definition

## Cross-References
- explore-domains: If the question reveals a new domain worth mapping
- challenge-assumptions: If the question challenges existing assumptions
- explore-trends: If the question points toward future trends

## Quick Pass vs Deep Dive
- Quick (5-10 min): Jump to Phase 2 (What If) quickly, one reframe, produce the question
- Deep (15-30 min): Full three-stage arc, multiple iterations of the question, test from multiple angles
```

### Example PostToolUse Hook Script (classify-insight.sh)

```bash
#!/usr/bin/env bash
# classify-insight.sh -- Keyword-based room section classification
# Called by PostToolUse hook after Write operations

FILE_PATH="$1"

# Only process files in room/ directory
if [[ ! "$FILE_PATH" == */room/* ]]; then
  exit 0
fi

# Extract filename content for keyword matching
FILENAME=$(basename "$FILE_PATH")
DIRNAME=$(dirname "$FILE_PATH" | xargs basename)

# Already filed to a known section
SECTIONS="problem-definition market-analysis solution-design business-model competitive-analysis team-execution legal-ip financial-model"
for section in $SECTIONS; do
  if [[ "$DIRNAME" == "$section" ]]; then
    echo "CLASSIFIED:$section:HIGH"
    exit 0
  fi
done

# Keyword classification for unfiled content
CONTENT=$(head -50 "$FILE_PATH" 2>/dev/null | tr '[:upper:]' '[:lower:]')

if echo "$CONTENT" | grep -qiE "problem|domain|question|definition|scope|undefined|beautiful.question|ackoff|pyramid"; then
  echo "SUGGEST:problem-definition:MEDIUM"
elif echo "$CONTENT" | grep -qiE "market|customer|trend|timing|s.curve|scenario|macro|future|tta|need"; then
  echo "SUGGEST:market-analysis:MEDIUM"
elif echo "$CONTENT" | grep -qiE "solution|design|system|hierarchy|bottleneck|architecture|hat"; then
  echo "SUGGEST:solution-design:MEDIUM"
elif echo "$CONTENT" | grep -qiE "model|revenue|canvas|pricing|unit.economics|lean"; then
  echo "SUGGEST:business-model:MEDIUM"
elif echo "$CONTENT" | grep -qiE "competition|competitor|challenge|assumption|validate|evidence|devil|red.team"; then
  echo "SUGGEST:competitive-analysis:MEDIUM"
elif echo "$CONTENT" | grep -qiE "team|leadership|hire|capability|execution"; then
  echo "SUGGEST:team-execution:MEDIUM"
elif echo "$CONTENT" | grep -qiE "legal|ip|patent|regulation|compliance"; then
  echo "SUGGEST:legal-ip:MEDIUM"
elif echo "$CONTENT" | grep -qiE "investment|thesis|financial|funding|valuation|grade|scoring"; then
  echo "SUGGEST:financial-model:MEDIUM"
else
  echo "UNCERTAIN"
fi
```

## Tri-Polar Surface Adaptations

Per CLAUDE.md Tri-Polar Design Rule, each methodology command must work across all three surfaces:

| Surface | Adaptation | Notes |
|---------|-----------|-------|
| **CLI** | Full power. Hooks fire, scripts classify, artifacts write to filesystem. Command-line invocation via `/mindrian-os:explore-domains`. | Primary development and testing surface |
| **Desktop** | Conversational. Users may say "let's explore domains" without slash commands. Larry's personality handles natural language routing via pws-methodology skill. Artifacts still file to workspace. | Larry recognizes methodology intent from natural language |
| **Cowork** | Multi-user. Methodology artifacts go to shared `00_Context/` directory. Multiple users could run different methodologies simultaneously. Room state is shared. | Confirm-then-file is critical to prevent conflicting writes |

**Design decision (Claude's discretion):** On Desktop, the pws-methodology skill should recognize natural language methodology requests ("I want to think about this from different perspectives" maps to think-hats). On CLI, slash commands are primary. On Cowork, slash commands with user attribution in provenance metadata.

## State of the Art

| Old Approach (V2) | Current Approach (Plugin) | Impact |
|-------------------|--------------------------|--------|
| Python prompt files with Gemini-specific patterns | Markdown command + reference files for Claude Code | No runtime dependencies; Claude-native optimization |
| CopilotKit JSON structured output | Markdown artifact templates | Simpler, more readable, no frontend dependency |
| 3-layer intelligent routing (keyword→graph→LLM) | Static routing index + pws-methodology skill | Tier 0 works offline; Brain enriches in Phase 4 |
| Custom BERT/LSA for HSI scoring | Conversational HSI assessment | Brain MCP enables quantitative HSI later |
| LangGraph StateGraph orchestration | Folder-structure-as-orchestration (ICM) | No server required; plugin structure IS the architecture |
| Per-bot temperature settings | Claude handles this natively | Remove temperature references from reference files |
| Gemini File Search tiers (T1-T4) | On-demand reference file loading | Simpler, deterministic context loading |

**Deprecated/outdated from V2 (DO NOT port):**
- Structured JSON output blocks (replace with markdown)
- Temperature settings (Claude manages this)
- File Search tier references (T1_Core, T2_Tools, etc.)
- CopilotKit AG-UI state sync patterns
- Mode-aware progression numeric ranges (0.0-0.3, etc.)
- Gemini-specific model instructions

**Preserve from V2 (critical to port):**
- Phase structure for each methodology
- Larry's per-methodology voice and signature phrases
- Anti-patterns and catch-and-correct tables
- Homework assignments (the exit deliverable)
- Cross-framework connection suggestions
- P0 constraints (grading table display, investment disclaimer)

## Open Questions

1. **Lean Canvas source material**
   - What we know: Standard Lean Canvas (9-box: Problem, Customer Segments, Unique Value Prop, Solution, Channels, Revenue Streams, Cost Structure, Key Metrics, Unfair Advantage) is well-documented publicly
   - What is unclear: Whether Jonathan has a specific PWS-adapted version of Lean Canvas with Larry's voice
   - Recommendation: Build standard Lean Canvas with Larry's voice applied; update if Jonathan provides PWS-specific version

2. **HSI Tier 0 scope**
   - What we know: V2's HSI uses custom BERT/LSA computation that requires Brain MCP
   - What is unclear: How much qualitative HSI value can be delivered conversationally
   - Recommendation: Build as conversational cross-domain opportunity scoring (Larry guides user through domain pairing and scoring manually); defer quantitative HSI to Phase 4 Brain

3. **Context window spanning**
   - What we know: Deep methodology sessions (Tier 4-5) can consume significant context
   - What is unclear: How to handle a methodology session that spans context window boundaries
   - Recommendation: (Claude's discretion) For deep sessions that approach limits, Larry should proactively summarize progress and suggest continuing in a new session, with the artifact-so-far saved to the room for continuity

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual testing (markdown plugin -- no automated test runner) |
| Config file | None -- validation is behavioral |
| Quick run command | Invoke methodology command, verify artifact produced |
| Full suite command | Run all 26 commands, verify artifacts in correct rooms |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| METH-01 | Domain Explorer produces artifact | manual | `/mindrian-os:explore-domains` then check room/problem-definition/ | Wave 0 |
| METH-02 | Minto produces artifact | manual | `/mindrian-os:structure-argument` then check room/problem-definition/ | Wave 0 |
| METH-03 | Bono produces artifact | manual | `/mindrian-os:think-hats` then check room/solution-design/ | Wave 0 |
| METH-04 | JTBD produces artifact | manual | `/mindrian-os:analyze-needs` then check room/market-analysis/ | Wave 0 |
| METH-05 | Devil's Advocate produces artifact | manual | `/mindrian-os:challenge-assumptions` then check room/competitive-analysis/ | Wave 0 |
| METH-06 | HSI produces artifact | manual | `/mindrian-os:score-innovation` then check output | Wave 0 |
| METH-07 | Investment Thesis produces artifact | manual | `/mindrian-os:build-thesis` then check room/financial-model/ | Wave 0 |
| METH-08 | Lean Canvas produces artifact | manual | `/mindrian-os:lean-canvas` then check room/business-model/ | Wave 0 |
| METH-09 | Artifacts have correct structure | manual | Check frontmatter and template compliance | Wave 0 |
| METH-10 | Thin skill pattern verified | manual | Verify command <500 tokens, reference loaded on-demand | Wave 0 |
| PASS-01 | PostToolUse classifies correctly | manual | Write to room/, check classification output | Wave 0 |
| PASS-02 | Filing with confirmation | manual | Run methodology, verify Larry asks before filing | Wave 0 |
| PASS-03 | Provenance metadata present | manual | Check YAML frontmatter on filed artifacts | Wave 0 |
| ALLM-01 | All 25+ commands exist | smoke | `ls commands/*.md | wc -l` >= 30 | Wave 0 |
| ALLM-02 | All follow thin pattern | smoke | Verify all commands have `disable-model-invocation: true` | Wave 0 |

### Sampling Rate
- **Per command build:** Invoke the command manually, verify artifact
- **Per wave merge:** Run 2-3 commands from the wave, spot-check artifacts
- **Phase gate:** Run at least one command from each tier, verify full workflow

### Wave 0 Gaps
- [ ] `references/methodology/problem-types.md` -- problem type classification reference
- [ ] `scripts/classify-insight.sh` -- keyword classification helper
- [ ] PostToolUse hook entry in hooks.json
- [ ] Updated `references/methodology/index.md` with all 26 commands

## Sources

### Primary (HIGH confidence)
- V2 prompts: 32 files at `/home/jsagi/MindrianV2/prompts/` -- complete methodology logic, phase structures, voice patterns, anti-patterns, artifact templates
- V4 Claude Desktop project specs: 16 files at `/home/jsagi/MindrianOS/.planning/research/pws-academy-input/claude-project-*.md` -- real usage examples, orchestration patterns
- Existing plugin code: Phase 1 command files, skills, hooks, references at `/home/jsagi/MindrianOS-Plugin/`
- CONTEXT.md decisions: locked scope, classification scheme, filing UX, noise control

### Secondary (MEDIUM confidence)
- V4 Design docs: `/home/jsagi/MindrianOS/docs/design/02-ORCHESTRATION.md`, `04-CONTEXT-PIPELINE.md` -- orchestration patterns adapted for plugin
- V4 Week 7 combining tools: pipeline chaining patterns (deferred to Phase 3 but informs cross-references)
- Mini-Agent Factory pattern from claude-project-16 -- informs Phase 4 Brain orchestration

### Tertiary (LOW confidence)
- Lean Canvas methodology -- standard public framework, no PWS-specific version found in V2/V3/V4
- HSI Tier 0 conversational approach -- not validated against real users yet

## Metadata

**Confidence breakdown:**
- Standard stack (three-file pattern): HIGH -- derived directly from Phase 1 established patterns and V2 source material
- Architecture (passive intelligence, classification): HIGH -- keyword classification is simple and proven; hybrid pattern follows Phase 1 hook architecture
- Methodology inventory: HIGH -- reconciled from 3 independent sources (V2, V4, Brain) with full prompt examination
- Pitfalls: HIGH -- grounded in V2 production experience and plugin context budget constraints
- Artifact templates: HIGH -- derived directly from V2 structured output patterns, adapted for markdown

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- methodology content does not change frequently)
