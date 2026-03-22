# PWS Profile Generation System

*Reference for Brain MCP integration (Phase 4) and persona-based methodologies.*

---

## Purpose

Generates comprehensive profiles for PWS cohort members as the **last step** in the Problem Seeker workflow. Profiles highlight traits aligned with PWS methodology success: systems thinking, adaptability across problem types, collaborative innovation.

## Profile Structure

```
[FULL NAME] | PWS Profile

UNIQUE PWS IDENTITY: "[Domain Expertise] & [Entrepreneurial Role] [Action] [Innovation Area]"

PERSONAL INFORMATION
ACADEMIC BACKGROUND (interdisciplinary, technical + strategic)
PROFESSIONAL EXPERIENCE (technical depth + entrepreneurial breadth)
SKILLS & EXPERTISE (vision, analysis, implementation, collaboration)
PROFESSIONAL ATTRIBUTES (leadership, work approach, collaboration, problem-solving)
MOTIVATIONS (growth mindset, openness, networking, structured methodology)
```

## Key Elements for Success Profiles

- **Unique PWS Identity**: intersection of technical expertise and innovation role
- **Skills mix**: strategic vision + analytical + implementation + collaborative
- **Attributes**: balance direction with collaboration, thoroughness with adaptability
- **Motivations**: growth + meaningful contribution + networking + collaborative innovation

## Data Room Integration

Maps directly to room sections:
- Person nodes → `team-execution` section
- Skill clusters → cross-reference across `problem-definition`, `solution-design`, etc.
- Problem type experience → `competitive-analysis` (undefined, ill-defined, wicked, well-defined)
- Collaboration potential → shared skills analysis across team

## Neo4j Queries for Profile Enhancement

```cypher
-- Skills identification
MATCH (p:Person {id: $id})-[:HAS_SKILL]->(s:Skill)
RETURN s.name, s.category, s.proficiency_level
ORDER BY s.proficiency_level DESC

-- Experience mapping
MATCH (p:Person {id: $id})-[:WORKED_ON]->(proj:Project)-[:INVOLVED]->(d:Domain)
RETURN d.name, count(proj) as project_count
ORDER BY project_count DESC

-- Collaboration potential
MATCH (p1:Person {id: $id}), (p2:Person)
WHERE p1 <> p2
MATCH (p1)-[:HAS_SKILL]->(s:Skill)<-[:HAS_SKILL]-(p2)
RETURN p2.name, count(s) as shared_skills
ORDER BY shared_skills DESC LIMIT 10

-- Skill clusters (successful participants)
MATCH (p:Person)-[:HAS_SKILL]->(s:Skill)
RETURN s.name, count(p) ORDER BY count(p) DESC LIMIT 10
```

## Methodology Connections

| Methodology | Profile Use |
|-------------|------------|
| **Bono Six Hats** | Hat perspectives as persona facets — how this person thinks from each angle |
| **Domain Explorer** | Sub-domains map to person's expertise intersections |
| **JTBD** | User segments become persona archetypes, jobs become career/venture motivations |
| **Diagnose** | Problem type classification maps to person's experience with each type |

## Notion Integration

Database properties: Full Name, Unique PWS Identity, ID, Location, Contact, LinkedIn, Cohort, Academic Background, Professional Experience, Skills (multi-select), Professional Attributes, Motivations, Profile Status (Draft/Review/Final)

Link to: Application Review DB, Problem Statement DB, Team Formation DB
