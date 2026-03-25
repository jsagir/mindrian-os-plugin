# Grant API Query Patterns

> How room context maps to API query parameters for context-driven grant discovery.
> Larry uses these patterns to translate room intelligence into search queries.

## Context-Driven Query Generation

The discovery engine does NOT use hardcoded searches. It reads the user's room data and generates queries:

```
Room STATE.md     -->  domain_keywords, geography, venture_stage, team_type
problem-definition/  -->  domain context, target population, desired outcomes
market-analysis/     -->  sector terms, market signals
```

### buildGrantQuery Flow

1. Read `room/STATE.md` frontmatter: `domain_keywords`, `geography`, `venture_stage`, `team_type`
2. Read `room/problem-definition/*.md` body text: extract significant terms from first sentences
3. Combine into structured query: `{ keyword, fundingCategories, eligibilities, geography, ventureStage }`
4. If insufficient context (no domain_keywords AND sparse problem-definition): return `{ insufficient: true }` with explanation

## Domain-to-Funding-Category Mapping

Maps room `domain_keywords` to Grants.gov `fundingCategories` codes:

| Domain Keyword | Category Code | Category Name |
|----------------|---------------|---------------|
| artificial-intelligence | ST | Science & Technology |
| machine-learning | ST | Science & Technology |
| natural-language-processing | ST | Science & Technology |
| software | ST | Science & Technology |
| robotics | ST | Science & Technology |
| biotech | HL | Health |
| health | HL | Health |
| healthcare | HL | Health |
| medical | HL | Health |
| clean-energy | EN | Energy |
| energy | EN | Energy |
| climate | EN | Energy |
| environment | ENV | Environment |
| education | ED | Education |
| agriculture | AG | Agriculture |
| food | AG | Agriculture |
| transportation | T | Transportation |
| infrastructure | ISS | Income Security & Social Services |
| housing | HU | Housing |
| community-development | CD | Community Development |

## Geography-to-Eligibility Mapping

| Room Geography | Eligibility Tags |
|----------------|-----------------|
| United States | us-entity |
| US | us-entity |
| Israel | international |
| EU | international |
| UK | international |

## API Endpoints

### Grants.gov (v1)

- **URL:** `POST https://api.grants.gov/v1/api/search2`
- **No auth required** (public API)
- **Body:** `{ keyword, oppStatuses: "posted", rows: 25, fundingCategories: "ST|HL", sortBy: "openDate|desc" }`
- **Response:** `{ oppHits: [{ title, agencyName, oppNumber, awardCeiling, closeDate, id }] }`
- **Timeout:** 10 seconds

### Simpler Grants (v1)

- **URL:** `POST https://api.simpler.grants.gov/v1/opportunities/search`
- **No auth required** (public API)
- **Body:** `{ query: "keyword", filters: { opportunity_status: { one_of: ["posted"] } }, pagination: { page_size: 25, sort_by: [{ order_by: "relevancy" }] } }`
- **Response:** `{ data: [{ opportunity_title, agency_name, opportunity_number, award_ceiling, close_date, opportunity_id }] }`
- **Timeout:** 10 seconds

## Relevance Scoring

Multi-factor scoring (0.0 to 1.0):

| Factor | Weight | Description |
|--------|--------|-------------|
| Domain keyword match (2+) | 0.35 | Title/program contains room domain keywords |
| Domain keyword match (1) | 0.20 | Partial domain match |
| Geography eligibility | 0.15 | Room geography matches eligibility |
| Defined deadline | 0.10 | Opportunity is actionable (has deadline) |
| Funding amount specified | 0.10 | Quantifiable award |
| Stage-appropriate | 0.20 | Grant type matches venture stage (SBIR for pre-revenue, etc.) |
| Baseline (search hit) | 0.10 | Returned by keyword search |

**Maximum score:** 1.0 (capped)

## Error Handling

- Both APIs are called via `Promise.allSettled` (one failure doesn't block the other)
- 10-second timeout per API (AbortController)
- Errors return empty results + error message (never throw)
- API errors are collected in `api_errors` array for transparency
