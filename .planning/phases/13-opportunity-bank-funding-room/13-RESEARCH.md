# Phase 13: Opportunity Bank + Funding Room - Research

**Researched:** 2026-03-25
**Domain:** Room section architecture, grant discovery APIs, funding lifecycle tracking, dual-delivery (CLI + MCP)
**Confidence:** HIGH

## Summary

Phase 13 adds two new room sections -- `room/opportunity-bank/` and `room/funding/` -- following the established ICM sub-room pattern already proven across 8 core DD sections plus meetings and team. The architecture is well-understood: dynamic section discovery (Phase 10, CORE-02) automatically registers new folders, `analyze-room` and `compute-state` already iterate `ALL_SECTIONS` dynamically, and `section-registry.cjs` already has pre-assigned metadata for both `opportunity-bank` (#8B6914) and `funding` (#1A5276). The plumbing is ready -- Phase 13 fills the plumbing with content.

Grant discovery is context-driven per user decision: room data (problem domain, geography, team profile, venture stage) generates search queries. Two free APIs serve this: the Grants.gov `search2` endpoint (POST to `https://api.grants.gov/v1/api/search2`, no auth required, keyword + agency + category + eligibility filters) and the newer Simpler Grants API (`https://api.simpler.grants.gov`, also free, richer filters including award floor/ceiling). Both return structured JSON. Web research (Tavily/Brave via existing MCP tools) supplements for non-federal sources. No new npm dependencies are needed -- Node.js built-in `fetch` (Node 18+) handles HTTP calls.

The confirm-first surfacing pattern is a direct reuse of `file-meeting.md`'s Step 4 (confirm-then-file) and Step 6 (cross-relationship batch scan). The funding lifecycle (Discovered > Researched > Applying > Submitted) maps to per-opportunity folders with `STATUS.md` tracking, mirroring the meeting archive pattern. Cross-references between funding entries and opportunity-bank sources use the existing `[[wikilink]]` pattern that `build-graph` already parses into edges.

**Primary recommendation:** Build three logical units: (1) room section scaffolding + core module (`opportunity-ops.cjs`), (2) CLI commands + MCP tool registration + proactive discovery, (3) funding lifecycle + cross-references + integration with analyze-room/compute-state intelligence pipeline.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Grant discovery is CONTEXT-DRIVEN, not source-hardcoded -- room data drives search queries, NOT fixed API integrations
- Confirm-first surfacing -- Larry presents opportunities, user confirms before filing
- Funding lifecycle: Discovered > Researched > Applying > Submitted (4 stages, no Awarded/Rejected)
- This is a GRAPH problem -- opportunities connect to room sections via typed edges
- Dual delivery: CLI commands + MCP tools for every capability

### Claude's Discretion
- Exact folder structure within opportunity-bank/ and funding/
- Frontmatter schema for opportunity artifacts
- How to integrate with compute-state and analyze-room (Phase 10 dynamic discovery handles this)
- Proactive discovery trigger (session-start hook vs on-demand command vs both)
- Web research tool selection for grant discovery

### Deferred Ideas (OUT OF SCOPE)
- Automated grant application drafting (v4.0+)
- Grant deadline notifications/calendar integration
- Candid Grants API (paid, add when adoption justifies cost)
- Grant success rate analytics across MindrianOS users
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OPP-01 | New room/opportunity-bank/ section with ICM-standard filing, frontmatter, and cross-references | Section registry already has metadata. ICM artifact pattern (frontmatter + markdown body + wikilinks) proven across 8 core sections + meetings. |
| OPP-02 | Proactive grant scanning via context-driven search surfaces relevant opportunities based on room intelligence | Grants.gov search2 API (free, no auth) + Simpler Grants API available. Room STATE.md provides venture stage, domain keywords, geography. Context extraction from room sections drives query generation. |
| OPP-03 | Discovered opportunities filed as room artifacts with relevance scoring and source provenance | Artifact template pattern from `references/meeting/artifact-template.md` provides frontmatter schema model. Relevance scoring follows confidence pattern (0.0-1.0). |
| OPP-04 | Opportunity Bank integrated into compute-state and analyze-room intelligence pipeline | Dynamic section discovery (Phase 10) already handles this. `analyze-room` iterates `ALL_SECTIONS` including extended sections. `compute-state` scans all `room/*/`. Zero code changes needed for basic discovery; intelligence-specific logic (opportunity-aware gap detection, funding stage reporting) needs additions. |
| FUND-01 | New room/funding/ section with lifecycle tracking | Follows meeting archive pattern: per-opportunity folders with structured files. Section registry pre-assigned. |
| FUND-02 | Per-grant folders with lifecycle stages: Discovered > Researched > Applying > Submitted | User locked 4 stages (not 5 from REQUIREMENTS.md which listed Awarded/Rejected). Per-folder STATUS.md with stage frontmatter. Stage transition tracked via frontmatter updates. |
| FUND-03 | Grant progress tracked in section STATE.md with deadlines, status, and next actions | Computed from per-opportunity folder scanning, same pattern as compute-state scans room sections. Aggregated into `room/funding/STATE.md`. |
| FUND-04 | Cross-references between funding entries and opportunity-bank sources | `[[opportunity-bank/source-name]]` wikilinks in funding artifacts. `build-graph` already parses wikilinks into edges. Cross-relationship patterns (INFORMS, ENABLES) from `references/meeting/cross-relationship-patterns.md` apply directly. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `fetch` | Node 18+ | HTTP calls to Grants.gov API | Already available in project runtime; no npm dep needed |
| `lib/core/section-registry.cjs` | existing | Section metadata + discovery | Phase 10 established pattern; opportunity-bank and funding already pre-assigned |
| `lib/core/room-ops.cjs` | existing | Room analysis wrapper | Wraps `scripts/analyze-room` which already iterates ALL_SECTIONS dynamically |
| `lib/core/state-ops.cjs` | existing | State computation wrapper | Wraps `scripts/compute-state` which already scans all `room/*/` dynamically |
| `lib/mcp/tool-router.cjs` | existing | MCP hierarchical tool router | New commands register as additions to existing router groups |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Grants.gov search2 API | v1 | Federal grant search | Primary structured data source for grant discovery |
| Simpler Grants API | current | Enhanced grant search | Richer filters (award floor/ceiling, applicant type) when more targeted search needed |
| Tavily/Brave (via existing MCP) | existing | Non-federal grant sources | Web research for foundation grants, state programs, private funding not in federal databases |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Grants.gov free API | Candid API (paid) | Candid has richer foundation/private grant data but costs money -- deferred per user decision |
| Native fetch | cheerio (already in deps) | Only needed if scraping HTML grant portals; Grants.gov is structured JSON, no scraping needed for Phase 13 |
| Custom opportunity scoring | Brain MCP enrichment | Brain can provide framework-to-grant matching but must work without Brain (Tier 0 first) |

**Installation:**
```bash
# No new npm dependencies needed for Phase 13
# Grants.gov API is free, no auth, accessed via built-in fetch
```

## Architecture Patterns

### Recommended Project Structure
```
room/
  opportunity-bank/           # Discovered opportunities
    STATE.md                  # Aggregated opportunity intelligence
    YYYY-MM-DD-{slug}.md     # Individual opportunity artifacts
  funding/                    # Pursued opportunities (lifecycle tracking)
    STATE.md                  # Aggregated funding pipeline status
    {opportunity-slug}/       # Per-opportunity lifecycle folder
      STATUS.md              # Current stage + transition history
      research.md            # Due diligence notes
      narrative.md           # Grant narrative draft (if Applying+)
      metadata.yaml          # Structured opportunity data

lib/core/
  opportunity-ops.cjs         # NEW: opportunity + funding operations
  section-registry.cjs        # MODIFY: already has metadata, may need structural dir update

commands/
  opportunities.md            # NEW: /mos:opportunities command
  funding.md                  # NEW: /mos:funding command

agents/
  opportunity-scanner.md      # NEW: proactive discovery agent

references/
  opportunities/
    opportunity-template.md   # Frontmatter schema + filing instructions
    funding-lifecycle.md      # Stage definitions + transition criteria
    grant-api-patterns.md     # API query generation from room context

scripts/
  scan-opportunities          # NEW: Bash script for grant API queries (wrappable by opportunity-ops.cjs)
```

### Pattern 1: Context-Driven Query Generation
**What:** Extract searchable context from room state to generate grant API queries
**When to use:** Every proactive scan or on-demand search
**Example:**
```javascript
// Source: room STATE.md + section content analysis
function buildGrantQuery(roomDir) {
  const state = stateOps.getState(roomDir);
  const sections = discoverSections(roomDir);

  // Extract domain keywords from problem-definition
  const problemDef = safeReadFile(path.join(roomDir, 'problem-definition'));
  // Extract geography from team/market context
  // Extract stage from venture_stage in STATE.md
  // Extract eligibility from team profile (nonprofit, university, etc.)

  return {
    keyword: extractDomainKeywords(problemDef),
    fundingCategories: mapDomainToCategories(problemDef),
    eligibilities: inferEligibility(teamProfile),
    oppStatuses: 'posted',  // Active opportunities only
  };
}
```

### Pattern 2: Confirm-First Surfacing (Reuse from file-meeting)
**What:** Present discovered opportunities to user for confirmation before filing
**When to use:** Every time new opportunities are discovered
**Example:**
```markdown
> "Found 3 relevant grants matching your room context:"
>
> | # | Funder | Program | Amount | Deadline | Fit |
> |---|--------|---------|--------|----------|-----|
> | 1 | NSF | SBIR Phase I | $275K | 2026-06-15 | 0.85 |
> | 2 | DOE | Clean Energy | $500K | 2026-05-30 | 0.72 |
> | 3 | NIH | STTR | $400K | 2026-07-01 | 0.68 |
>
> [file all / review individually / skip]
```

### Pattern 3: Per-Opportunity Lifecycle Folder
**What:** Each pursued opportunity gets its own folder with stage-tracked files
**When to use:** When user promotes an opportunity from opportunity-bank to funding
**Example:**
```
room/funding/nsf-sbir-phase1-2026/
  STATUS.md          # Stage: Researched, transitioned 2026-03-20
  research.md        # Eligibility analysis, fit assessment
  narrative.md       # Draft narrative (created at Applying stage)
  metadata.yaml      # Structured: funder, amount, deadline, source_opportunity
```

### Pattern 4: Opportunity Artifact Frontmatter
**What:** Structured YAML frontmatter for opportunity-bank entries
**When to use:** Every filed opportunity
```yaml
---
methodology: opportunity-scan
created: 2026-03-25
source: grants-gov          # grants-gov | simpler-grants | web-research | manual | brain
source_url: https://grants.gov/...
opportunity_id: "SBIR-2026-001"
funder: National Science Foundation
program: SBIR Phase I
amount_floor: 0
amount_ceiling: 275000
deadline: 2026-06-15
eligibility: [small-business, us-entity]
funding_category: science-technology
relevance_score: 0.85
relevance_reasoning: "Matches problem domain (AI/ML), team eligibility (small business), and stage (pre-revenue)"
room_connections:
  - section: problem-definition
    relationship: INFORMS
    reasoning: "Grant focus area aligns with problem domain"
  - section: financial-model
    relationship: ENABLES
    reasoning: "Non-dilutive funding addresses runway gap"
status: discovered           # discovered | filed | promoted | rejected
rejection: null              # Populated if user rejects (rejection IS data)
---
```

### Pattern 5: Graph Integration (Typed Edges)
**What:** Opportunities connect to room sections via the existing cross-relationship edge types
**When to use:** On every opportunity filing and funding lifecycle transition
**Example edges:**
- Opportunity INFORMS financial-model (funding addresses runway gap)
- Opportunity ENABLES solution-design (grant funds R&D)
- Funding entry CONVERGES with problem-definition (grant scope aligns with problem framing)

### Anti-Patterns to Avoid
- **Hardcoded API sources:** Discovery MUST be context-driven. Never hardcode "search Grants.gov for X" -- always derive queries from room state.
- **Auto-filing without confirmation:** Violates the confirm-first pattern. Larry surfaces, user decides.
- **Building a CRM:** Funding Room tracks lifecycle STAGES, not financial accounting, disbursement tracking, or compliance reporting.
- **Blocking session-start on API calls:** Proactive scanning must be async or on-demand. Session-start hook has a 2-second budget -- API calls would blow it.
- **Awarded/Rejected as stages:** User explicitly locked 4 stages. Awarded/Rejected is a binary outcome attribute on STATUS.md, not a lifecycle stage.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Section discovery | Custom section scanning | `section-registry.cjs` `discoverSections()` | Already handles core + extended sections, metadata, qualification |
| Room analysis integration | Custom room analysis | Existing `scripts/analyze-room` dynamic iteration | Already iterates ALL_SECTIONS including extended; add opportunity-specific gap logic to extended section handler |
| State computation | Custom state aggregation | Existing `scripts/compute-state` dynamic scanning | Already scans all `room/*/` directories |
| Cross-reference parsing | Custom link parser | Existing `build-graph` wikilink parser | Already parses `[[section-name]]` into graph edges |
| MCP tool registration | New MCP tool group | Extend existing `data_room` router in `tool-router.cjs` | Add opportunity/funding commands to DATA_ROOM_COMMANDS enum |
| Opportunity frontmatter | New schema system | Extend `artifact-template.md` pattern | Same YAML frontmatter + markdown body + wikilinks pattern |
| Confirm-first UX | New confirmation flow | Reuse `file-meeting.md` Step 4 pattern | Batch presentation, [all / review / skip], structured rejection capture |
| Grant API HTTP calls | Custom HTTP client | Node.js built-in `fetch` | No dependencies; Grants.gov returns JSON |

**Key insight:** Phase 13 introduces zero new architectural patterns. Every component follows an existing, proven pattern from the codebase. The risk is in integration complexity (connecting all the pieces), not in any single component.

## Common Pitfalls

### Pitfall 1: Blocking Session-Start on API Calls
**What goes wrong:** Adding Grants.gov API calls to the session-start hook causes timeout (2-second budget)
**Why it happens:** Natural desire to show fresh opportunities on every session start
**How to avoid:** Proactive scanning runs as an ON-DEMAND command (`/mos:opportunities scan`) or as a post-session-start async task. Session-start only reports EXISTING opportunity-bank state (already filed opportunities), not live API results.
**Warning signs:** Session-start taking >2 seconds; "Loading room context..." status message stuck

### Pitfall 2: Context Extraction Produces Empty/Generic Queries
**What goes wrong:** Room has sparse content, so context-driven queries are too broad ("grants for startups")
**Why it happens:** Early-stage rooms may have only problem-definition populated
**How to avoid:** Require minimum room content before running proactive scan (at least problem-definition with content). Fall back to manual keyword entry if room context is insufficient. Larry explains: "Your room doesn't have enough context for smart grant matching yet. Tell me what you're looking for."
**Warning signs:** API returns 10,000+ results (max cap); all results have low relevance scores

### Pitfall 3: Scope Creep into Grant Management CRM
**What goes wrong:** Adding deadline reminders, application form filling, financial tracking, compliance features
**Why it happens:** Natural feature expansion once the lifecycle is visible
**How to avoid:** Scope is LOCKED: discovery + context matching + lifecycle tracking (4 stages) + cross-references. No deadline notifications, no application drafting, no financial management. The Funding Room is a room section, not a workflow engine.
**Warning signs:** Adding models for payments, disbursements, reporting periods

### Pitfall 4: Relevance Scoring That's Just Keyword Matching
**What goes wrong:** Relevance scores are meaningless because they're based on simple term overlap
**Why it happens:** Temptation to ship a quick keyword-match scorer
**How to avoid:** Relevance scoring must consider STRUCTURAL room context -- venture stage, team eligibility, problem domain, geography, financial needs. Use the room's multi-section intelligence, not just keyword grep. Larry provides natural-language reasoning for each score.
**Warning signs:** All opportunities getting similar scores (0.5-0.7); scores don't change when room content changes

### Pitfall 5: FUND-02 Lifecycle Mismatch with CONTEXT.md
**What goes wrong:** REQUIREMENTS.md says 5 stages (includes Awarded/Rejected), CONTEXT.md says 4 stages
**Why it happens:** Requirements were written before user discussion
**How to avoid:** CONTEXT.md decisions override REQUIREMENTS.md. User explicitly locked 4 stages: Discovered > Researched > Applying > Submitted. Awarded/Rejected is an outcome attribute, not a stage. STATUS.md tracks `outcome: awarded | rejected | withdrawn` separately from `stage:`.
**Warning signs:** Implementation includes Awarded/Rejected as lifecycle stages

### Pitfall 6: Brain Dependency Without Tier 0 Fallback
**What goes wrong:** Opportunity matching works great with Brain connected but breaks without it
**Why it happens:** Brain enrichment is natural for context-driven matching
**How to avoid:** Every feature MUST work Tier 0 first (no Brain). Brain enrichment adds richer matching (framework-to-grant patterns) but is never required. Test Brain-disconnected first, always.
**Warning signs:** Code paths that require Brain MCP responses; no fallback when Brain is unavailable

## Code Examples

### Grants.gov search2 API Call
```javascript
// Source: https://api.grants.gov/v1/api/search2 (verified 2026-03-25)
async function searchGrantsGov(keyword, categories, agencies) {
  const response = await fetch('https://api.grants.gov/v1/api/search2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyword: keyword,
      fundingCategories: categories || '',  // e.g., 'ST' for Science & Technology
      agencies: agencies || '',
      oppStatuses: 'posted',
      rows: 25,
    }),
  });

  if (!response.ok) throw new Error(`Grants.gov API error: ${response.status}`);
  const data = await response.json();
  return data.oppHits || [];
}
```

### Simpler Grants API Call
```javascript
// Source: https://api.simpler.grants.gov (verified 2026-03-25)
async function searchSimplerGrants(query, filters) {
  const response = await fetch('https://api.simpler.grants.gov/v1/opportunities/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: query.substring(0, 100),  // Max 100 chars
      opportunity_status: { one_of: ['posted'] },
      funding_category: filters.categories ? { one_of: filters.categories } : undefined,
      applicant_type: filters.applicantTypes ? { one_of: filters.applicantTypes } : undefined,
      award_floor: filters.minAmount || undefined,
      pagination: { page_offset: 1, page_size: 25, sort_order: [{ order_by: 'relevancy' }] },
    }),
  });

  if (!response.ok) throw new Error(`Simpler Grants API error: ${response.status}`);
  return await response.json();
}
```

### opportunity-ops.cjs Module Pattern
```javascript
// Follows room-ops.cjs pattern exactly
'use strict';
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { discoverSections } = require('./section-registry.cjs');

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts');

function listOpportunities(roomDir) {
  const oppDir = path.join(path.resolve(roomDir), 'opportunity-bank');
  if (!fs.existsSync(oppDir)) return { opportunities: [], count: 0 };

  const files = fs.readdirSync(oppDir).filter(f => f.endsWith('.md') && f !== 'STATE.md');
  // Parse frontmatter for each opportunity
  return { opportunities: files, count: files.length };
}

function listFunding(roomDir) {
  const fundDir = path.join(path.resolve(roomDir), 'funding');
  if (!fs.existsSync(fundDir)) return { entries: [], count: 0 };

  // Scan for per-opportunity folders
  const entries = fs.readdirSync(fundDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'));
  return { entries: entries.map(e => e.name), count: entries.length };
}

module.exports = { listOpportunities, listFunding };
```

### MCP Tool Router Extension
```javascript
// Add to DATA_ROOM_COMMANDS in tool-router.cjs
const DATA_ROOM_COMMANDS = [
  'status', 'list-sections', 'analyze', 'compute-state', 'get-state',
  'new-project', 'setup', 'update', 'help', 'suggest-next',
  // Phase 13 additions:
  'scan-opportunities', 'list-opportunities', 'file-opportunity',
  'list-funding', 'create-funding', 'update-funding-stage',
];

// In the data_room handler switch:
case 'scan-opportunities': {
  const oppOps = require('../core/opportunity-ops.cjs');
  const results = await oppOps.scanOpportunities(roomDir);
  return textResponse(JSON.stringify(results, null, 2));
}
```

### mindrian-tools.cjs Extension
```javascript
// Add to mindrian-tools.cjs switch routing
case 'opportunity': {
  const oppOps = require('../lib/core/opportunity-ops.cjs');
  switch (subcommand) {
    case 'scan': { /* invoke context-driven API search */ break; }
    case 'list': { /* list filed opportunities */ break; }
    case 'funding-list': { /* list funding pipeline */ break; }
    case 'funding-stage': { /* update funding stage */ break; }
    default: error(`Unknown opportunity subcommand: ${subcommand}`);
  }
  break;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Grants.gov SOAP/XML APIs | Grants.gov REST JSON APIs (search2, fetchOpportunity) | March 2025 | No auth needed, simpler integration, JSON responses |
| Single Grants.gov API | Dual: Grants.gov + Simpler Grants API | 2025-2026 | Simpler Grants has richer filters (award amounts, applicant types) |
| Keyword-only grant search | Context-driven search from structured room data | This phase | Structural matching vs keyword matching -- unique to MindrianOS |
| Hardcoded section arrays | Dynamic section discovery | Phase 10 | New sections auto-register; zero code changes for basic integration |
| Flat MCP tools | Hierarchical router (6 tools) | Phase 11 | New commands add to existing router groups, not new top-level tools |

**Deprecated/outdated:**
- Grants.gov SOAP APIs: Replaced by REST APIs in March 2025. Do not use SOAP.
- REQUIREMENTS.md 5-stage lifecycle: User overrode to 4 stages in CONTEXT.md. Discovered > Researched > Applying > Submitted only.

## Open Questions

1. **Proactive Discovery Trigger: Session-Start vs On-Demand vs Both**
   - What we know: Session-start has a 2-second budget. API calls take 1-3 seconds. Running both compute-state AND grant API queries exceeds budget.
   - What's unclear: Whether to add async background scanning after session-start completes, or keep it purely on-demand.
   - Recommendation: On-demand command (`/mos:opportunities scan`) as primary trigger. Session-start ONLY reports existing opportunity-bank state. A future optimization could add 7-day cached scan results to session-start context. This is in Claude's discretion per CONTEXT.md.

2. **Funding Section Structure: Sub-rooms or Flat?**
   - What we know: REQUIREMENTS.md mentions sub-rooms (non-dilutive/, dilutive/, grants/). CONTEXT.md says 4 lifecycle stages with per-opportunity folders.
   - What's unclear: Whether to organize by funding type (sub-rooms) or keep flat per-opportunity folders under funding/.
   - Recommendation: Flat per-opportunity folders. The funding TYPE is a frontmatter field, not a directory. Avoids premature categorization. Users with many opportunities can filter by type in STATE.md without needing subdirectories. This is in Claude's discretion per CONTEXT.md.

3. **How Opportunity Artifacts Differ from Meeting Artifacts**
   - What we know: Meeting artifacts have attribution (speaker, role), segment_type, confidence. Opportunities have funder, amount, deadline, eligibility.
   - What's unclear: How much to share vs diverge from the meeting artifact frontmatter schema.
   - Recommendation: Share the common fields (methodology, created, source, relevance/confidence, room_connections, assumptions, rejection) and add opportunity-specific fields (funder, program, amount_floor/ceiling, deadline, eligibility, funding_category, opportunity_id, source_url). This is in Claude's discretion per CONTEXT.md.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bash test scripts (existing pattern) |
| Config file | `tests/run-all.sh` |
| Quick run command | `bash tests/run-all.sh` |
| Full suite command | `bash tests/run-all.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPP-01 | opportunity-bank/ section discovered by section-registry | unit | `node -e "const r = require('./lib/core/section-registry.cjs'); const d = r.discoverSections('./tests/fixtures/sample-room-opp'); console.assert(d.extended.includes('opportunity-bank'))"` | Wave 0 |
| OPP-02 | Context-driven query generation from room state | unit | `bash tests/test-opportunity-query.sh` | Wave 0 |
| OPP-03 | Opportunity artifact has correct frontmatter schema | unit | `bash tests/test-opportunity-frontmatter.sh` | Wave 0 |
| OPP-04 | analyze-room reports opportunity-bank in intelligence | integration | `bash scripts/analyze-room tests/fixtures/sample-room-opp \| grep opportunity-bank` | Wave 0 |
| FUND-01 | funding/ section discovered by section-registry | unit | `node -e "const r = require('./lib/core/section-registry.cjs'); const d = r.discoverSections('./tests/fixtures/sample-room-opp'); console.assert(d.extended.includes('funding'))"` | Wave 0 |
| FUND-02 | Per-opportunity folder with STATUS.md tracking 4 stages | unit | `bash tests/test-funding-lifecycle.sh` | Wave 0 |
| FUND-03 | funding/STATE.md aggregates pipeline status | integration | `bash tests/test-funding-state.sh` | Wave 0 |
| FUND-04 | Wikilinks between funding entries and opportunity-bank | unit | `grep -q '\[\[opportunity-bank/' tests/fixtures/sample-room-opp/funding/*/STATUS.md` | Wave 0 |

### Sampling Rate
- **Per task commit:** `bash tests/run-all.sh`
- **Per wave merge:** `bash tests/run-all.sh` + manual MCP tool verification via `npx @modelcontextprotocol/inspector`
- **Phase gate:** Full suite green + manual CLI/MCP parity check before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/fixtures/sample-room-opp/` -- test room with opportunity-bank/ and funding/ sections populated
- [ ] `tests/fixtures/sample-room-opp/opportunity-bank/STATE.md` -- sample opportunity section state
- [ ] `tests/fixtures/sample-room-opp/opportunity-bank/2026-03-20-nsf-sbir.md` -- sample opportunity artifact
- [ ] `tests/fixtures/sample-room-opp/funding/nsf-sbir-phase1/STATUS.md` -- sample funding lifecycle entry
- [ ] `tests/test-opportunity-query.sh` -- context-driven query generation test
- [ ] `tests/test-opportunity-frontmatter.sh` -- opportunity artifact frontmatter validation
- [ ] `tests/test-funding-lifecycle.sh` -- funding stage transition test
- [ ] `tests/test-funding-state.sh` -- funding STATE.md aggregation test

## Sources

### Primary (HIGH confidence)
- Grants.gov search2 API: `https://api.grants.gov/v1/api/search2` -- POST, no auth, JSON response, keyword + category + agency + eligibility filters. Verified 2026-03-25.
- Simpler Grants API: `https://api.simpler.grants.gov` -- POST, no auth, richer filters including award floor/ceiling and applicant type. Verified 2026-03-25.
- Codebase analysis: `lib/core/section-registry.cjs` -- pre-assigned metadata for opportunity-bank and funding sections already exists
- Codebase analysis: `scripts/analyze-room` -- dynamic section discovery pattern (ALL_SECTIONS iteration) already handles extended sections
- Codebase analysis: `scripts/compute-state` -- scans all `room/*/` dynamically, no hardcoded sections
- Codebase analysis: `commands/file-meeting.md` Step 4 -- confirm-then-file UX pattern with batch presentation and structured rejection
- Codebase analysis: `references/meeting/cross-relationship-patterns.md` -- 5 edge types (INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES) for graph integration
- Codebase analysis: `lib/mcp/tool-router.cjs` -- DATA_ROOM_COMMANDS enum extensible for new commands

### Secondary (MEDIUM confidence)
- [Simpler Grants Wiki - Search Opportunities](https://wiki.simpler.grants.gov/product/api/search-opportunities) -- API parameter documentation
- [Grants.gov REST API announcement (March 2025)](https://grantsgovprod.wordpress.com/2025/03/13/2-restful-apis-are-now-available-for-system-to-system-users/) -- Confirms search2 and fetchOpportunity endpoints

### Tertiary (LOW confidence)
- Grants.gov rate limits not explicitly documented in available sources. Assumed 60 req/min based on prior research. Needs validation under load.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all patterns proven in codebase
- Architecture: HIGH -- every component follows existing pattern (section discovery, artifact template, MCP router, confirm-first UX)
- Pitfalls: HIGH -- identified from direct codebase analysis (session-start budget, lifecycle mismatch, scope creep)
- API integration: MEDIUM -- APIs verified working but rate limits and edge cases need runtime validation

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable -- no fast-moving dependencies)
