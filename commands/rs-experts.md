---
name: rs-experts
description: Resolve the expert network for a topic via Aura Cypher MATCH
body_shape: D (Comparison Matrix)
serves_jtbd: ["find-bottleneck", "connect-domains"]
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Bash
  - Read
  - mcp__mindrian-brain__read_neo4j_cypher
---

# /mos:rs-experts

You are Larry. This command resolves the expert network for a topic from the local Aura instance (Tier 1). Authors and institutions accumulate in Aura via `rs-fetcher-experts` (Phase 89.2-05) and `rs-expert-mapper.mapAuthorsToAura` (Phase 89.3-04) during prior `/mos:rs-fetch` runs. The query is a parameterized Cypher MATCH on `AUTHORED_BY` and `AFFILIATED_WITH` edges. Tier 0 (Aura unreachable) returns a graceful "Aura not connected" guidance message.

**Synopsis:**

    /mos:rs-experts <topic>
    /mos:rs-experts <topic> --json
    /mos:rs-experts <topic> --limit 20

## What it does

1. Validates `<topic>` against Canon Part 8 (`auditQueryString` on the bound parameter; throws `ExternalEgressViolation` if forbidden bytes appear).
2. Detects Aura availability via `brainClient.isAvailable()` plus the Aura driver / `NEO4J_URI` env var checks.
3. Tier 1 path: runs the Cypher MATCH `(a:Author)-[:AUTHORED_BY]->(p:Paper) WHERE p.topic = $topic OPTIONAL MATCH (a)-[:AFFILIATED_WITH]->(i:Institution) RETURN a, collect(DISTINCT i) AS institutions LIMIT $limit` with parameterized `$topic` + `$limit`. Returns ranked author list with institution affiliations.
4. Tier 0 path: emits the 3-line guidance error pointing to `/mos:rs-fetch` to populate the local mirror first.
5. Emits Phase Gate-style transcript (CLI) or JSON (`--json`).

## UI Format

- **Body Shape:** D (Comparison Matrix) -- ranked authors with institutions
- **Reference:** `skills/ui-system/SKILL.md`
- **Zone 1:** Header Panel -- topic + author count
- **Zone 2:** Content Body -- ranked table: Rank / Author / Institution / Papers / Score
- **Zone 3:** Intelligence Strip -- top institution cluster signals
- **Zone 4:** Action Footer -- next-step verbs (`/mos:persona` may be warranted; `/mos:rs-fetch` for fresh papers)

## Three-surface notes

- **CLI:** Phase Gate-style transcript with the ranked table.
- **Desktop MCP:** structured JSON via `--json`; the MCP wrapper renders Larry's narration with top 3 authors as conversational mentions.
- **Cowork:** honors `MINDRIAN_ROOM`; multi-user rooms see the same shared expert list filed in `00_Context/`.

## Canon References

- **Canon Part 7 (Reuse Before Build):** consumes existing `brain-client.cjs` Aura session. Zero forks.
- **Canon Part 8 (Graph Boundary):** topic is parameterized as `$topic` (NO string concatenation). Audited via `auditQueryString` BEFORE binding. The Aura is a LOCAL Brain mirror per Canon Part 8; this command does NOT query the remote Brain methodology graph.

## Examples

    /mos:rs-experts "quantum brain imaging"
    /mos:rs-experts "fintech KYC" --json
    /mos:rs-experts "carbon capture" --limit 50

## Error patterns

3-line error format:

    x Aura not connected
      Why: brainClient.isAvailable() returned false; expert network requires Aura
      Fix: /mos:rs-fetch <topic> first to populate the local SQLite mirror, then retry

    x No experts found for topic
      Why: zero rows matched topic <topic> in Aura
      Fix: /mos:rs-fetch <topic>

    x Canon Part 8 audit failed
      Why: forbidden bytes in topic argument (ExternalEgressViolation)
      Fix: rephrase the topic without user-content placeholders

## Voice

Larry direct:

> "Mapped <N> experts across <M> institutions. Leading: <top institution>. /mos:persona may be warranted to build the engagement strategy."

> "Aura not connected. Run /mos:rs-fetch first to populate the mirror, then I can resolve the expert network."
