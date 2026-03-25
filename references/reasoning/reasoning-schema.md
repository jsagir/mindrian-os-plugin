# Reasoning Frontmatter Schema

Reference for Larry when generating REASONING.md frontmatter and for developers extending reasoning operations.

## Purpose

Every section's REASONING.md uses YAML frontmatter to capture structured metadata: what this section depends on, what it provides, confidence ratings, and verification criteria. This schema is the single source of truth for that structure.

## Schema

### Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `section` | string | Room section name (e.g., `problem-definition`, `market-analysis`) |
| `generated` | string | Date when reasoning was generated (YYYY-MM-DD format) |
| `methodology_run` | string | Associated methodology run ID (e.g., `run-2026-03-25-001`). Empty if generated without a full run. |
| `brain_enriched` | boolean | Whether Brain (Neo4j/Pinecone) was available during generation |
| `room_hash` | string | MD5 hash (first 7 chars) of STATE.md at generation time. Used as staleness signal -- if current STATE.md hash differs, reasoning may be outdated. |

### Dependency Graph Fields

| Field | Type | Description |
|-------|------|-------------|
| `requires` | array of objects | Sections this reasoning depends on. Each object has `section` (string) and `provides` (string describing what it contributes). |
| `provides` | array of strings | What this section contributes to the venture (e.g., "Problem type classification", "TAM estimate"). |
| `affects` | array of strings | Section names impacted by changes in this section. |

### Confidence Object

| Field | Type | Description |
|-------|------|-------------|
| `confidence.high` | array of strings | Claims with strong evidence (8-10/10 certainty). Each string is a specific claim. |
| `confidence.medium` | array of strings | Claims needing more evidence (5-7/10 certainty). |
| `confidence.low` | array of strings | Speculative claims (1-4/10 certainty). |

### Verification Object

| Field | Type | Description |
|-------|------|-------------|
| `verification.must_be_true` | array of strings | Goal-backward criteria: what must be TRUE for this section to be considered complete. |
| `verification.status` | string | One of: `pending`, `verified`, `failed`. |

## Full Example

```yaml
---
section: problem-definition
generated: 2026-03-25
methodology_run: run-2026-03-25-001
requires:
  - section: market-analysis
    provides: "Customer validation data"
  - section: competitive-analysis
    provides: "Competitor pain point mapping"
provides:
  - "Problem type classification"
  - "Wicked problem characteristics"
  - "Primary user pain points"
affects: ["solution-design", "competitive-analysis"]
confidence:
  high: ["Problem is wicked (8/10)", "TAM estimate 2-5B"]
  medium: ["Regulatory headwinds in EU"]
  low: ["China market timing"]
verification:
  must_be_true:
    - "Problem definition cites at least 2 customer data points"
    - "Wicked characteristics identified and scored"
    - "Pain points validated by market-analysis artifacts"
  status: pending
brain_enriched: true
room_hash: abc123f
---
```

## Field Details

### `requires` (Dependency Declaration)

Each entry declares a dependency on another section's output:

```yaml
requires:
  - section: market-analysis
    provides: "Customer validation data"
```

Larry should populate this based on which other sections' artifacts were referenced when generating the reasoning. The `provides` field describes what specific data or insight flows from that section.

### `confidence` (MECE Claim Rating)

Every claim in the reasoning body should be reflected in the confidence frontmatter. Claims must be:
- **Specific** -- not "market looks good" but "TAM estimate 2-5B based on Gartner 2025"
- **Traceable** -- reference the artifact or data point supporting the claim
- **MECE** -- collectively exhaustive (all key claims rated), mutually exclusive (no claim in two levels)

### `verification.must_be_true` (Goal-Backward Criteria)

These are the acceptance criteria for the section, written from the outcome backward:
- What evidence must exist?
- What analysis must be complete?
- What dependencies must be satisfied?

Larry generates these during reasoning. They serve as a checklist for section completeness.

### `room_hash` (Staleness Signal)

The first 7 characters of the MD5 hash of STATE.md at generation time. When reasoning operations detect a different hash, the reasoning may be stale -- the room has changed since this reasoning was generated.

## LazyGraph Edge Types

The `requires` and `affects` fields feed LazyGraph edges:

| Frontmatter Field | LazyGraph Edge | Direction |
|-------------------|---------------|-----------|
| `requires[].section` | `REASONING_INFORMS` | dependency -> this section |
| `affects[]` | `REASONING_INFORMS` | this section -> affected section |

These edges enable Larry to traverse reasoning dependencies: "If problem-definition reasoning changes, what other sections' reasoning might be invalidated?"

## Programmatic Access

```javascript
const { getReasoningFrontmatter, setReasoningFrontmatter, mergeReasoningFrontmatter } = require('./lib/core/reasoning-ops.cjs');

// Read full frontmatter
const fm = getReasoningFrontmatter(roomDir, 'problem-definition');

// Read specific field
const conf = getReasoningFrontmatter(roomDir, 'problem-definition', 'confidence');

// Set a field
setReasoningFrontmatter(roomDir, 'problem-definition', 'brain_enriched', true);

// Merge multiple fields
mergeReasoningFrontmatter(roomDir, 'problem-definition', {
  brain_enriched: true,
  room_hash: 'abc123f',
});
```

---
*MindrianOS Reasoning Engine -- frontmatter schema reference v1.0*
