# Brain Schema Reference

Neo4j Aura graph -- 21K+ nodes, 65K+ relationships. Larry's teaching intelligence.

## MCP Tool Naming

Setup writes `.mcp.json` with server names `neo4j-brain` and `pinecone-brain`. Tools become:
- `mcp__neo4j-brain__read_neo4j_cypher` -- execute Cypher queries
- `mcp__neo4j-brain__write_neo4j_cypher` -- write operations (admin only)
- `mcp__neo4j-brain__get_neo4j_schema` -- introspect schema
- `mcp__pinecone-brain__search-records` -- vector similarity search

## Node Types

| Label | ~Count | Key Properties | Purpose |
|-------|--------|----------------|---------|
| Framework | 275+ | name, description, category, difficulty | Innovation methodology frameworks |
| Phase | varies | name, order, description, framework_id | Ordered steps within a framework |
| Concept | varies | name, description | Abstract innovation concepts |
| ProblemType | 4 | name (Un-Defined, Ill-Defined, Well-Defined, Wicked) | Problem classification |
| Book | 59 | title, author, isbn | Analyzed source books |
| Tool | 59 | name, description, pws_mapping | Innovation tools with PWS mappings |
| Course | varies | name, code, semester | Curriculum courses |
| Example | 100+ | project_name, grade, grade_numeric, rubric_scores, feedback_patterns, percentile | Graded student work |

## Relationships

| Relationship | From -> To | Properties | Why It Matters |
|--------------|-----------|------------|----------------|
| FEEDS_INTO | Framework -> Framework | confidence, transform_description | Framework chaining rules |
| TRANSFORMS_OUTPUT_TO | Framework -> Framework | transform_type, description | How output becomes input |
| CO_OCCURS | Framework -> Framework | frequency, context | Natural framework pairings |
| ADDRESSES_PROBLEM_TYPE | Framework -> ProblemType | effectiveness | Framework-to-problem mapping |
| HAS_PHASE | Framework -> Phase | order | Phase progressions |
| PREREQUISITE | Framework -> Framework | strength | What must come first |
| APPLIED_IN | Framework -> Example | section, quality_score | Real usage with grades |
| REFERENCES | Book -> Framework | chapter, relevance | Source material links |

## Grading Calibration Data

Example nodes provide calibration for grading:
- `rubric_scores`: {vision, problem_definition, feasibility, market, completeness}
- `grade` / `grade_numeric`: letter (A-F) and numeric (0-100)
- `feedback_patterns`: common tags (Vision-to-Execution Gap, Framework Vomit, etc.)
- `percentile`: ranking within cohort

Grading Agent compares user's room state against this distribution for calibrated assessment.

## .mcp.json Template

```json
{
  "mcpServers": {
    "neo4j-brain": {
      "command": "npx",
      "args": ["-y", "@neo4j/mcp-neo4j"],
      "env": {
        "NEO4J_URI": "{uri}",
        "NEO4J_USER": "{user}",
        "NEO4J_PASSWORD": "{password}"
      }
    },
    "pinecone-brain": {
      "command": "npx",
      "args": ["-y", "@anthropic/pinecone-mcp"],
      "env": {
        "PINECONE_API_KEY": "{key}"
      }
    }
  }
}
```
