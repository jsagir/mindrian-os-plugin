---
name: opportunities
description: Discover and manage grants in the Opportunity Bank
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Browse banked opportunities by HSI score."
argument-hint: "[list|add|scan]"
body_shape: E (Action Report)
hitl_shape: "F.8"
hitl_why: "Opportunities are surfaced across multiple ADD signals as an independent any-order set."
# Phase 267.3-07, ruled in 267.3-CLASSIFICATION.md (Row 4, navigator-ruled): first delivery at commands/opportunities.md:75, the scan subcommand's live Grants.gov/Simpler Grants search matched against the room's own domain, geography and stage.
interactive_first_reward: methodology_reframe
serves_jtbd: ["explore"]
teaching: "When you need to manage grants as a live pipeline rather than a list, /mos:opportunities surfaces the Opportunity Bank with HSI scores and decision states. Funding deserves the same rigor as product."
allowed-tools: Read Write Bash Glob Agent WebSearch AskUserQuestion
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: opportunities
  framework: null
  posture: push_forward
  hierarchy_rank: 13
  filing: none
  plan_gated: false
  web_scope: null
---

<!-- mos:firing-block v2 -->
At this command's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# /mos:opportunities -- Grant Discovery + Opportunity Management

> Context-driven grant discovery. Larry reads your room, generates search queries, and presents opportunities for you to confirm or reject.

## How Opportunities Get Banked

Opportunities enter the bank through two paths:

1. **Grant discovery** (`/mos:opportunities scan`) - external funding opportunities from Grants.gov and Simpler Grants, filed after user confirmation
2. **Intelligence cascade** (automatic) - every methodology command that triggers analyze-room extracts gaps, convergences, and contradictions as bankable opportunities. These are filed automatically with no user action needed.

Every opportunity carries a Knight position (risk vs uncertainty vs mixed) and a confidence score. Risk = known problem with quantifiable odds. Uncertainty = unknown problem requiring exploration. Mixed = contradiction that could go either way.

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

Show filed opportunities with optional filters (--domain, --knight, --min-confidence).

**Display format:**

> | # | Source | Program/Problem | Knight Position | Confidence | Deadline | Status |
> |---|--------|-----------------|-----------------|------------|----------|--------|
> | 1 | NIH | SBIR Phase I | risk | 0.85 | 2026-06-01 | filed |
> | 2 | diagnose | Missing structural coverage in market-analysis | uncertainty | 0.8 | - | banked |

This unified table works for both grant-scanned and cascade-extracted opportunities:
- Grant opportunities: Source = funder name, Knight Position = 'risk' (grants are known risk), Confidence = relevance_score
- Cascade opportunities: Source = source_framework, Knight Position = from schema, Confidence = from schema

### Filter Flags

The list subcommand supports filter flags to narrow results:

- `--domain <name>` -- Filter by domain (partial match, case-insensitive). Example: `--domain market-analysis`
- `--knight <position>` -- Filter by Knight position: `risk`, `uncertainty`, or `mixed`
- `--min-confidence <N>` -- Filter by minimum confidence score (0.0-1.0). Example: `--min-confidence 0.7`

Flags can be combined: `--domain healthcare --knight uncertainty --min-confidence 0.5`

**CLI:** `mindrian-tools.cjs opportunity list [roomDir] --domain X --knight Y --min-confidence N`
**MCP:** `data_room` tool with command `list-opportunities`

### file

File a specific opportunity after scan confirmation. Used internally after user confirms from scan results.

**CLI:** `mindrian-tools.cjs opportunity file [roomDir] [dataJson]`
**MCP:** `data_room` tool with command `file-opportunity`

### bank

List all banked opportunities extracted from methodology commands (not grant scans).

These are opportunities discovered by the intelligence cascade - gaps, convergences, and contradictions that represent bankable problems.

**Display format:**

> Here are the opportunities your Data Room intelligence has banked:
>
> | # | Problem | Domain | Knight Position | Confidence | Source | Status |
> |---|---------|--------|-----------------|------------|--------|--------|
> | 1 | Missing structural coverage in market-analysis | market-analysis | uncertainty | 0.8 | diagnose | banked |
>
> **Actions:**
> - **View details** - I'll show the full evidence and mirror solution
> - **Pursue** - promote to funding pipeline
> - **Reject** - capture your reason (this teaches me)

**CLI:** `mindrian-tools.cjs opportunity bank [roomDir]`
**MCP:** `data_room` tool with command `bank-opportunities`

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
