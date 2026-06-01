# Brain Schema Reference

Neo4j Aura graph -- 21K+ nodes, 65K+ relationships. Larry's teaching intelligence.

## How Brain Connects

**CLI:** `brain-client.cjs` calls the Brain HTTP API directly using `MINDRIAN_BRAIN_KEY` from `.env` or `~/.mindrian.env`. No MCP config needed. Functions: `brain.query(cypher)`, `brain.search(text)`, `brain.schema()`.

**Desktop/Cowork:** Add Brain as an MCP server in `claude_desktop_config.json` or Cowork settings. Server name: `mindrian-brain`. Tools become:
- `mcp__mindrian-brain__brain_query` -- execute Cypher queries
- `mcp__mindrian-brain__brain_write` -- write operations (admin only)
- `mcp__mindrian-brain__brain_schema` -- introspect schema
- `mcp__mindrian-brain__brain_search` -- semantic search via Pinecone

Note: Brain is NOT configured in the plugin's `.mcp.json` (that file is for the local mindrian-os stdio server only). Brain config lives in user settings because it requires a per-user API key.

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
| Example | 80+ | project_name, grade, grade_numeric, rubric_scores, feedback_patterns, percentile, example_type | Graded student work AND worked examples attached to frameworks/methods |
| Method | 94 | name, description | Alternative methods a framework offers (e.g. Three Approaches -> Brute Force / Targeted / Eureka) |
| Stage | 74 | name, order, consciousness_level | Ordered stages within a framework (e.g. Wallas creativity stages) |
| Insight | 13 | name, description | Teaching insights a framework/method reveals |
| Question | 8 | name, question_type | Beautiful-question / diagnostic prompts attached to a level or framework |
| PyramidLevel | 5 | name, level_order | Ackoff DIKW levels (Data/Information/Knowledge/Understanding/Wisdom) |

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
| HAS_EXAMPLE | Framework/Method -> Example | example_type | Worked examples attached directly to a framework or method (OODA, Usher, Ackoff, Wallas, the Three Approaches). Larry reaches for this to illustrate a concept on demand. |
| HAS_METHOD | Framework -> Method | -- | A framework offers these alternative methods (Three Approaches -> Brute Force / Targeted Development / Eureka; Ackoff -> Camera Test). Use to surface method choices within a framework. |
| REVEALS | Framework/Method -> Insight | -- | The teaching insight a framework or method exposes. Use when Larry explains *why* a framework matters, not just how. |
| CONTRASTS_WITH | Framework -> Theory/Framework | -- | A rejected or rival theory (Usher -> Transcendentalist / Mechanistic). Use to teach by contrast. |
| DIRECTS | PyramidLevel -> PyramidLevel | -- | Downward direction in the Ackoff pyramid (Wisdom directs what Data to collect). Use to teach top-down DIKW reasoning. |

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
