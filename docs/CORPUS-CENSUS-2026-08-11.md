# Methodology Graph Census - 2026-08-11 (LOOP-02)

Measured live through the CONTRACT-05 bounded read tier (brain_query on a read-tier
key against pws-brain-mcp.onrender.com, deployed surface, 2026-08-11). Every number
below is from a run, not a claim. Fulfills requirement LOOP-02 (v2.0.0 milestone).

## Totals

| Metric | Value |
|---|---|
| Framework nodes | 181 |
| Total graph nodes | 28,325 |
| Total relationships | 23,014 |

## Structure coverage (the enrichment denominator)

| Relationship | Frameworks carrying it | Edges |
|---|---|---|
| HAS_PHASE | 20 | 90 |
| HAS_STAGE | 4 | 21 |
| HAS_PROCESS_STEP | 18 | 93 |
| HAS_STEP | 12 | 52 |

- Frameworks with NO structural edges of any of the four types: **129 of 181 (71%)**.
- Frameworks with at least one structural edge: 52.

## Sequence edges (the WHEN/SEQUENCE layer)

| Edge | Count |
|---|---|
| FEEDS_INTO | 233 |
| LEADS_TO | 1,698 |

## Top gaps by expected use

The ratified flagship floor (frontmatter-28 denominator, navigator ruling 2026-08-11)
stands at **4 of 28 flagships at >= 3/4 readiness; 24 gaps**. The per-framework
readiness detail, the 4-group alias-collapse plan, and the 41 self-loop cleanup are
in `.planning/phases/249-context-driven-enrichment/249-03-READ-TIER-PREFIX-2026-08-11.md`
(local planning artifact) and the brain repo's enrichment runbook (payloads/).

## Provenance

- Read path: brain_query, bounded read tier (CONTRACT-05), read-tier key.
- Same-day cross-checks: shipped stdio shim three-call test PASS (stats/search/ask);
  keyless silent-registration chain PASS end to end (HONEST-03 behavior leg).
