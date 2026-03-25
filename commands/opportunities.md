# /mos:opportunities -- Grant Discovery + Opportunity Management

> Context-driven grant discovery. Larry reads your room, generates search queries, and presents opportunities for you to confirm or reject.

## Subcommands

### scan

Run a context-driven grant discovery scan.

**How it works:**
1. Larry reads your room's STATE.md (domain, geography, venture stage) and problem-definition/ for context
2. Generates search queries from YOUR room data (not hardcoded searches)
3. Searches Grants.gov and Simpler Grants APIs concurrently
4. Deduplicates and scores results by relevance to your room
5. Presents results in a table with relevance reasoning

**After presenting results, ask the user:**

> I found {N} opportunities relevant to your venture. Here are the top matches:
>
> | # | Funder | Program | Amount | Deadline | Relevance |
> |---|--------|---------|--------|----------|-----------|
> | 1 | ... | ... | ... | ... | 0.85 |
>
> **What would you like to do?**
> - **File all** -- I'll file all opportunities to your opportunity-bank
> - **Review individually** -- I'll walk through each one for your decision
> - **Skip** -- No opportunities filed

This is the **confirm-first pattern**: Larry presents, user decides. Nothing is filed automatically.

**CLI:** `mindrian-tools.cjs opportunity scan [roomDir]`
**MCP:** `data_room` tool with command `scan-opportunities`

### list

Show filed opportunities from your opportunity-bank with status and relevance.

**CLI:** `mindrian-tools.cjs opportunity list [roomDir]`
**MCP:** `data_room` tool with command `list-opportunities`

### file

File a specific opportunity after scan confirmation. Used internally after user confirms from scan results.

**CLI:** `mindrian-tools.cjs opportunity file [roomDir] [dataJson]`
**MCP:** `data_room` tool with command `file-opportunity`

## Rejection Handling

When the user rejects an opportunity, **capture the reason**. Rejection is data (per CLAUDE.md architecture).

Ask: "Why are you passing on this one? (This helps me find better matches next time.)"

The reason is recorded in opportunity-bank/STATE.md and informs future scans.

## Insufficient Context

If the room lacks sufficient context for grant discovery (no domain_keywords, sparse problem-definition), Larry should explain:

> "I need more context about your venture to search for relevant grants. Your room needs:
> - `domain_keywords` in STATE.md (e.g., artificial-intelligence, healthcare)
> - Content in problem-definition/ describing your domain
> - `geography` in STATE.md for eligibility matching
>
> Run /mos:room update to add this context, then try scanning again."

## Discovery is Context-Driven

The key insight: Larry does NOT search for "AI grants" because someone hardcoded that. Larry searches for grants that match THIS room's specific problem domain, geography, team profile, and venture stage. Every room gets different search queries.

The room context generates the search queries:
- `domain_keywords` --> API keyword parameters and funding categories
- `geography` --> eligibility filters
- `venture_stage` --> grant type matching (SBIR for pre-revenue, etc.)
- `problem-definition/` content --> additional domain terms
