# Phase 8: Cross-Meeting Intelligence - Research

**Researched:** 2026-03-23
**Domain:** Cross-meeting pattern detection, action item lifecycle, Read AI MCP integration
**Confidence:** HIGH

## Summary

Phase 8 extends the Data Room from per-meeting intelligence to cross-meeting intelligence. The core work splits into two independent tracks: (1) cross-meeting pattern detection -- convergence, contradictions, action item tracking, and team contribution patterns computed across the full meeting history; and (2) Read AI MCP integration that eliminates the paste step via `/setup meetings` and `--latest` flag on file-meeting.

The cross-meeting intelligence track builds on the existing filesystem patterns (metadata.yaml grep, compute-state/compute-team layered computation) to produce a new MEETINGS-INTELLIGENCE.md file. The existing `file-meeting.md` command gains a Step 0 (pre-filing action item triage) and an enhanced Step 6 (cross-meeting pattern scanning beyond single-meeting cross-relationships). A new `scripts/compute-meetings-intelligence` bash script produces the aggregated intelligence file, and `room/action-items.md` becomes the aggregated action item tracker.

The Read AI integration is architecturally simple: a new subcommand in `setup.md` that writes the MCP config to `.mcp.json`, and a `--latest` flag implementation in `file-meeting.md` that fetches the most recent transcript from whichever meeting source is configured. Read AI uses Streamable HTTP transport with OAuth auth at `https://api.read.ai/mcp/`. Vexa (open-source alternative) uses a similar MCP pattern. The plugin should abstract the meeting source behind a common interface in the setup flow.

**Primary recommendation:** Build in three waves: Wave 1 implements Read AI MCP setup + `--latest` flag (independent external integration). Wave 2 builds cross-meeting intelligence detection within file-meeting (convergence, contradiction, action item triage). Wave 3 builds compute-meetings-intelligence script and MEETINGS-INTELLIGENCE.md output.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Larry's judgment for convergence/contradiction detection**: No algorithmic engine. Larry reads prior meeting summaries (via metadata.yaml frontmatter search) and uses LLM reasoning. No ML dependencies.
- **Triple surfacing for convergence**: Detected in meeting summary section AND as proactive alert during filing AND tracked in STATE.md convergence signals at room level.
- **Severity-based contradiction flagging**: High-impact (financials, strategy, key decisions) flagged immediately during filing. Low-impact (opinions, preferences) collected in meeting summary.
- **Contradictions in summary + STATE.md**: No separate contradiction files.
- **Aggregated room/action-items.md**: Single file listing ALL open action items across all meetings. Rebuilt by compute-state from individual meeting action-items.md files.
- **Pre-filing triage + cross-reference during filing**: Before filing a new meeting, Larry shows open action items for quick triage. During filing, Larry cross-references segments to remaining open items.
- **Simple lifecycle: open/done only**: No overdue or deferred states for action items.
- **Recurring concerns + influence shifts + concern clustering**: Track when a team member raises the same concern across multiple meetings. Track how decision influence shifts over time. Cluster related concerns into themes.
- **Role-gap analysis**: Map expected contributions by role. Flag where a role's expected input is missing across meetings. Frame as missing perspective, not performance.
- **TEAM-STATE.md = per-person. MEETINGS-INTELLIGENCE.md = cross-meeting patterns (NEW file)**: Clean separation.
- **Read AI MCP via /setup meetings + --latest flag**: Config stored in project-level .mcp.json. Also support attend-mcp/Recall.ai/Vexa.
- **Threshold**: Same topic across 3+ meetings triggers convergence signal.

### Claude's Discretion
- Exact convergence/contradiction detection prompts
- How many prior meetings to scan for patterns (recommend: last 10 or all, whichever is fewer)
- MEETINGS-INTELLIGENCE.md section organization
- Read AI MCP error handling and fallback behavior

### Deferred Ideas (OUT OF SCOPE)
- **HSI/Tier 1 semantic similarity for convergence detection**: Phase 8 uses Larry's judgment (Tier 0) only.
- **Automated contradiction resolution**: Phase 8 flags only, no auto-resolution.
- **Action item assignment from transcript**: Phase 8 tracks items extracted during filing only.
- **Data Room level status bar**: Deferred to CLI tools consolidation.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| XMTG-01 | Meeting summary artifacts include convergence detection across meetings | Convergence detection via metadata.yaml grep + Larry's LLM reasoning against prior meeting summaries. Triple surfacing pattern. |
| XMTG-02 | Contradiction detection works across meetings | Severity-based flagging using Larry's judgment against prior meetings. High-impact immediate, low-impact in summary. |
| XMTG-03 | Action items tracked across meetings -- Larry flags incomplete actions from prior meetings | Aggregated room/action-items.md rebuilt by compute-state. Pre-filing triage (Step 0) + cross-reference during filing. |
| XMTG-04 | Team contribution analysis: active, silent, recurring concerns | Recurring concerns, influence shifts, concern clustering, role-gap analysis. Extends compute-team + new MEETINGS-INTELLIGENCE.md. |
| RDAI-01 | `/mindrian-os:setup meetings` connects Read AI MCP | Read AI MCP at `https://api.read.ai/mcp/` via Streamable HTTP transport with OAuth. Also Vexa/Recall.ai support. |
| RDAI-02 | `/mindrian-os:file-meeting --latest` auto-fetches most recent transcript | `--latest` flag queries configured meeting source MCP tools to list sessions and retrieve transcript. |
| RDAI-03 | Read AI MCP config stored in project-level .mcp.json | Same merge pattern as Brain/Velma setup. HTTP type MCP entry. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bash scripts | N/A | compute-meetings-intelligence, action item aggregation | Existing pattern from compute-state/compute-team |
| Markdown commands | N/A | file-meeting.md enhancements, setup.md meetings subcommand | ICM folder-structure-as-code architecture |
| metadata.yaml grep | N/A | Cross-meeting lookups for topics, speakers, decisions | Established Tier 0 pattern from Phase 7 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Read AI MCP | Current | Meeting transcript auto-fetch | When user runs `/setup meetings` with Read AI |
| Vexa MCP | Current | Alternative meeting transcript source | When user prefers open-source / self-hosted |
| Recall.ai (via Composio) | Current | Another meeting source option | Enterprise users with Recall.ai subscriptions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Larry's LLM judgment | LSA + MiniLM embeddings | Deferred to future -- Tier 0 first, no deps |
| Single meeting source | Multi-source abstraction | Build abstraction now since CONTEXT.md requires supporting Read AI + Vexa + Recall.ai |

## Architecture Patterns

### New File Structure
```
room/
  action-items.md              # NEW: Aggregated open action items (rebuilt by compute-state)
  meetings/
    YYYY-MM-DD-name/
      action-items.md          # EXISTING: Per-meeting action items (source of truth)
      metadata.yaml            # EXISTING: Searchable metadata
      summary.md               # ENHANCED: Gains Convergence Signals + Contradictions sections

scripts/
  compute-meetings-intelligence  # NEW: Produces MEETINGS-INTELLIGENCE.md
  compute-state                  # ENHANCED: Calls compute-meetings-intelligence + builds room/action-items.md
  compute-team                   # ENHANCED: Adds recurring concerns + influence patterns

room/MEETINGS-INTELLIGENCE.md    # NEW: Cross-meeting patterns file

commands/
  file-meeting.md               # ENHANCED: Step 0 (action item triage) + enhanced Step 6 + --latest flag
  setup.md                      # ENHANCED: Gains /setup meetings subcommand
```

### Pattern 1: Pre-Filing Action Item Triage (Step 0)
**What:** Before starting the 6-step filing pipeline, Larry loads `room/action-items.md` and presents open items for quick triage.
**When to use:** Every time `file-meeting` runs and open action items exist.
**Example:**
```
Step 0: Action Item Check

"3 open items from your last meeting. Quick check -- any done?"

| # | Owner | Task | From Meeting |
|---|-------|------|--------------|
| 1 | Lawrence | Review TAM analysis | 2026-03-15-mentoring |
| 2 | Sarah | Send competitor deck | 2026-03-15-mentoring |
| 3 | Tyler | Schedule user interviews | 2026-03-10-research |

[mark done: 1,3 / skip / review all]
```

### Pattern 2: Cross-Meeting Convergence Detection During Filing
**What:** During Step 6 batch scan, Larry now also scans ACROSS prior meetings (not just within the current room content) for topics that have appeared in 3+ meetings.
**When to use:** After all segments are filed, during the cross-relationship batch scan.
**Implementation:**
1. Extract key topics/themes from current meeting's filed segments
2. Grep metadata.yaml `topics:` fields across all meetings
3. For each topic appearing in 3+ meetings, generate convergence signal
4. Surface as: "Market validation has been raised in 4 of your last 6 meetings. This is becoming a central theme."

### Pattern 3: Computed Aggregation (compute-meetings-intelligence)
**What:** A new bash script that scans all meeting archives to produce MEETINGS-INTELLIGENCE.md.
**When to use:** Called by compute-state after compute-team.
**Structure:** Same layered computation pattern:
```
compute-state
  -> compute-team (writes TEAM-STATE.md)
  -> compute-meetings-intelligence (writes MEETINGS-INTELLIGENCE.md)
  -> aggregate action items (writes room/action-items.md)
```

### Pattern 4: Meeting Source Abstraction
**What:** `/setup meetings` configures whichever meeting source the user has. `--latest` queries that source.
**When to use:** Read AI, Vexa, or Recall.ai setup.
**Implementation:**
```
.mcp.json gains a meeting source entry:

For Read AI (Streamable HTTP):
{
  "mcpServers": {
    "read-ai": {
      "type": "http",
      "url": "https://api.read.ai/mcp/"
    }
  }
}

For Vexa:
{
  "mcpServers": {
    "vexa": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://api.cloud.vexa.ai/mcp"],
      "env": {
        "VEXA_API_KEY": "{key}"
      }
    }
  }
}
```

The `--latest` flag in file-meeting detects which meeting MCP server is configured and calls the appropriate tool to list sessions and retrieve the most recent transcript.

### Anti-Patterns to Avoid
- **Over-alerting on convergence:** Not every shared keyword is convergence. Use the 3+ meeting threshold strictly. Larry's judgment filters noise.
- **Treating action items as a project management tool:** This is a context tool for Larry, not Jira. Simple open/done lifecycle. No due dates unless transcript stated them.
- **Blocking filing pipeline on MCP failures:** If Read AI MCP is unavailable, gracefully fall back to paste/file input. Never let MCP errors block the core workflow.
- **Per-meeting contradiction files:** CONTEXT.md explicitly says contradictions live in summary.md + STATE.md. No separate files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Meeting transcript fetch | Custom API client for Read AI | Read AI MCP server (`https://api.read.ai/mcp/`) | OAuth handled by MCP layer, tools exposed natively |
| Semantic similarity | Custom embedding/LSA pipeline | Larry's LLM reasoning (Tier 0) | Locked decision -- Tier 1 deferred |
| Action item deduplication | Custom fuzzy matching | Larry's judgment during triage | People describe same action differently; LLM catches this |
| Meeting source detection | Hardcoded if/else | Check `.mcp.json` for known server keys | Extensible, same pattern as Brain/Velma detection |

**Key insight:** Phase 8 is an LLM-reasoning-first phase. Larry's judgment replaces algorithmic engines for convergence/contradiction/action-item detection. The scripts (compute-meetings-intelligence) handle aggregation of filesystem data, but the intelligence layer is conversational.

## Common Pitfalls

### Pitfall 1: Context Window Overload on Cross-Meeting Scanning
**What goes wrong:** Loading all prior meeting summaries for comparison exhausts Claude's context window.
**Why it happens:** A room with 20+ meetings has substantial content.
**How to avoid:** Limit cross-meeting scanning to last 10 meetings (or fewer). Use metadata.yaml grep to pre-filter relevant meetings by topic/speaker before loading full summaries. Only load summaries that share topics with the current meeting.
**Warning signs:** Larry's responses become truncated or miss obvious connections.

### Pitfall 2: Action Item Duplication in Aggregated File
**What goes wrong:** Same action item appears in multiple meeting action-items.md files (carried forward but not completed).
**Why it happens:** If Larry mentions an open item in a subsequent meeting summary, it could appear as a "new" action item.
**How to avoid:** The aggregated room/action-items.md is computed from per-meeting files only. Each action item has a source meeting_id. Deduplication uses owner + task text similarity. Mark items as done in their SOURCE meeting file.
**Warning signs:** room/action-items.md has duplicate entries with different meeting sources.

### Pitfall 3: Read AI OAuth Token Expiry
**What goes wrong:** `--latest` fails because the OAuth token has expired.
**Why it happens:** Read AI uses OAuth; tokens have expiration windows.
**How to avoid:** On `--latest` failure, detect auth error specifically and prompt user to re-authenticate. Never silently fail -- always fall back to paste/file with a clear message.
**Warning signs:** "Authentication failed" or 401 errors from MCP calls.

### Pitfall 4: Convergence False Positives from Common Terms
**What goes wrong:** Larry flags "market" as a convergent theme because every meeting discusses markets.
**Why it happens:** Common business terms appear in every meeting.
**How to avoid:** Convergence detection should focus on SPECIFIC topics (proper nouns, specific metrics, named concerns), not general business vocabulary. The 3+ meeting threshold helps, but Larry must also apply judgment about specificity.
**Warning signs:** Every meeting summary flags the same generic convergences.

### Pitfall 5: compute-meetings-intelligence Performance with Many Meetings
**What goes wrong:** Script becomes slow scanning all meetings.
**Why it happens:** Bash grep across many YAML files.
**How to avoid:** Keep the script focused on aggregation, not analysis. Extract topics from metadata.yaml (fast), count occurrences (fast), format output (fast). The LLM-reasoning happens in file-meeting, not in the compute script.
**Warning signs:** compute-state takes noticeably longer after Phase 8.

### Pitfall 6: Pipefail Killing Grep in Bash Scripts
**What goes wrong:** `set -eo pipefail` causes script to exit when grep finds no matches.
**Why it happens:** grep returns exit code 1 on no matches.
**How to avoid:** Use `set -e` without `pipefail` for grep-heavy scripts (established Phase 7 decision). Use `|| true` after grep commands that may legitimately find nothing.
**Warning signs:** Script exits silently with no output.

## Code Examples

### compute-meetings-intelligence Script Structure
```bash
#!/usr/bin/env bash
# compute-meetings-intelligence: Scan meetings/ to produce MEETINGS-INTELLIGENCE.md
# Called by compute-state as a sub-step
# Usage: scripts/compute-meetings-intelligence <room_dir>
# Output: Writes room/MEETINGS-INTELLIGENCE.md directly

set -e

ROOM_DIR="${1:-.}"
MEETINGS_DIR="$ROOM_DIR/meetings"

# Exit silently if no meetings
[[ -d "$MEETINGS_DIR" ]] || exit 0

# Count meetings
meeting_count=0
for meeting_dir in "$MEETINGS_DIR"/*/; do
  [ -d "$meeting_dir" ] || continue
  meeting_count=$((meeting_count + 1))
done

[ "$meeting_count" -eq 0 ] && exit 0

# ---- Topic Frequency (convergence signals) ----
# Extract topics from all metadata.yaml, count occurrences
declare -A topic_counts
declare -A topic_meetings
# ... grep metadata.yaml topics fields, aggregate

# ---- Action Item Aggregation ----
# Scan all meeting action-items.md files
# Collect open items with source meeting_id
# ... parse tables from each action-items.md

# ---- Write MEETINGS-INTELLIGENCE.md ----
# Sections: Active Convergence Signals, Active Contradictions,
#           Open Action Items, Team Patterns, Recent Meetings
```

### Aggregated action-items.md Structure
```markdown
---
computed: 2026-03-23T15:00:00Z
total_open: 5
total_done: 12
---
# Open Action Items

| Owner | Task | Source Meeting | Date | Status |
|-------|------|---------------|------|--------|
| Lawrence | Review TAM analysis | 2026-03-15-mentoring | 2026-03-15 | open |
| Sarah | Send competitor deck | 2026-03-15-mentoring | 2026-03-15 | open |

# Recently Completed

| Owner | Task | Source Meeting | Completed |
|-------|------|---------------|-----------|
| Tyler | Schedule user interviews | 2026-03-10-research | 2026-03-20 |
```

### MEETINGS-INTELLIGENCE.md Structure
```markdown
---
computed: 2026-03-23T15:00:00Z
meetings_analyzed: 6
---
# Cross-Meeting Intelligence

## Active Convergence Signals

| Theme | Meetings | First Seen | Latest |
|-------|----------|------------|--------|
| Market validation | 4/6 | 2026-03-01 | 2026-03-20 |
| Regulatory risk | 3/6 | 2026-03-05 | 2026-03-20 |

## Active Contradictions

| Topic | Claim A | Claim B | Speakers | Status |
|-------|---------|---------|----------|--------|
| TAM estimate | $190M (Mar 1) | $120M (Mar 15) | Lawrence vs Tyler | unresolved |

## Team Patterns

### Recurring Concerns
| Person | Concern | Frequency | First Raised |
|--------|---------|-----------|--------------|
| Sarah | Regulatory risk | 4/5 meetings | 2026-03-01 |

### Influence Distribution
| Domain | Primary Voice | Meetings Led |
|--------|--------------|-------------|
| Financial strategy | Lawrence | 4 |
| Technical direction | Tyler | 3 |

### Role-Gap Analysis
| Expected Role Input | Section | Meetings Without Input |
|--------------------|---------|----------------------|
| Investor on financials | financial-model | 3 consecutive |

## Meeting Timeline
| Date | Name | Speakers | Decisions | Action Items |
|------|------|----------|-----------|-------------|
| 2026-03-20 | ... | ... | ... | ... |
```

### Read AI MCP Setup Flow
```markdown
# /mindrian-os:setup meetings

### 1. Detect Existing Configuration
Check .mcp.json for existing meeting source (read-ai, vexa, recall-ai).

### 2. Ask Which Source
"Which meeting tool do you use?"
- Read AI (most common -- automatic meeting notes)
- Vexa (open-source, self-hosted option)
- Recall.ai (enterprise API)

### 3. Configure Based on Choice

**Read AI:**
- Add HTTP type MCP entry: {"type": "http", "url": "https://api.read.ai/mcp/"}
- OAuth handled by the MCP transport layer
- Test: call list-sessions tool, verify response

**Vexa:**
- Collect API key
- Add npx entry with mcp-remote + Vexa endpoint
- Test: call list-meetings tool

### 4. Confirm
"Meeting source connected. Now use /mindrian-os:file-meeting --latest to grab your most recent meeting."
```

### --latest Flag Implementation in file-meeting
```markdown
### `--latest` -- Auto-Fetch Mode

Check .mcp.json for configured meeting source:
1. Look for `read-ai`, `vexa`, or `recall-ai` keys in mcpServers
2. If none found:
   > "No meeting source configured. Run /mindrian-os:setup meetings first,
   >  or paste your transcript here."

If meeting source found:
1. Call the source's list-sessions/list-meetings tool
2. Get the most recent session
3. Call get-transcript tool with session ID
4. Use returned transcript text as input
5. Continue to Step 1 format detection as normal

If MCP call fails:
> "Could not reach {source}. Check your connection. Meanwhile, paste
>  the transcript or use --file."
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Paste-only transcript input | Read AI MCP auto-fetch | Phase 8 | Removes manual step, enables automated workflows |
| Per-meeting cross-refs only | Cross-meeting pattern detection | Phase 8 | Intelligence compounds across entire meeting history |
| No action item tracking | Aggregated lifecycle tracking | Phase 8 | Open items visible before every new meeting |
| Per-person analysis only | Team-level pattern analysis | Phase 8 | Recurring concerns, influence shifts, role gaps visible |

## Open Questions

1. **Read AI OAuth Flow in Claude Code**
   - What we know: Read AI uses OAuth at `https://api.read.ai/mcp/`. MCP HTTP transport supports auth headers.
   - What's unclear: Exact OAuth flow mechanics within Claude Code's MCP client. Does Claude Code handle OAuth redirects natively for HTTP MCP servers? The Read AI blog says "authenticate once" but details on token refresh are sparse.
   - Recommendation: Implement with HTTP type MCP. If OAuth flow is not natively supported by Claude Code, fall back to API key auth via Read AI's REST API endpoints. Document the limitation and test during implementation.

2. **Vexa/Recall.ai Tool Names**
   - What we know: Vexa has an MCP server. Recall.ai has Composio integration.
   - What's unclear: Exact MCP tool names for listing sessions and fetching transcripts from each provider.
   - Recommendation: During implementation, probe the MCP server for available tools. The `--latest` flag implementation should be source-agnostic -- detect server, list tools, find the "list meetings" and "get transcript" equivalents.

3. **Action Item Status Update Mechanism**
   - What we know: Action items start as `open` in per-meeting files. Aggregated file rebuilt by compute-state.
   - What's unclear: When Larry marks an item as "done" during pre-filing triage, how is the source meeting's action-items.md updated?
   - Recommendation: Larry updates the source meeting's action-items.md directly (change `open` to `done`). Next compute-state run reflects the change in the aggregated file. This keeps per-meeting files as the source of truth.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bash + manual verification |
| Config file | None -- bash scripts tested via execution |
| Quick run command | `bash scripts/compute-meetings-intelligence room/ && cat room/MEETINGS-INTELLIGENCE.md` |
| Full suite command | File a test meeting, run compute-state, verify all output files |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| XMTG-01 | Convergence detected in meeting summary | manual | File 3+ meetings with shared topic, verify summary | No -- Wave 0 |
| XMTG-02 | Cross-meeting contradiction detection | manual | File meetings with conflicting claims, verify flagging | No -- Wave 0 |
| XMTG-03 | Action item tracking across meetings | smoke | `bash scripts/compute-meetings-intelligence room/ && grep "open" room/action-items.md` | No -- Wave 0 |
| XMTG-04 | Team contribution patterns | smoke | `bash scripts/compute-meetings-intelligence room/ && cat room/MEETINGS-INTELLIGENCE.md` | No -- Wave 0 |
| RDAI-01 | setup meetings configures MCP | manual | Run setup meetings, verify .mcp.json entry | No -- Wave 0 |
| RDAI-02 | --latest auto-fetches transcript | manual | Run file-meeting --latest with Read AI configured | No -- Wave 0 |
| RDAI-03 | Config in .mcp.json | smoke | `grep "read-ai\|vexa\|recall" .mcp.json` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** Verify modified files parse correctly
- **Per wave merge:** Run compute-state on test room, verify MEETINGS-INTELLIGENCE.md and action-items.md
- **Phase gate:** Full pipeline test: file 3 meetings, verify convergence/contradiction/action-item detection

### Wave 0 Gaps
- [ ] Test room with 3+ meetings (reuse from Phase 7 testing if available)
- [ ] `scripts/compute-meetings-intelligence` script (NEW -- core deliverable)
- [ ] Verify action-items.md aggregation works with varying meeting counts

## Sources

### Primary (HIGH confidence)
- Existing codebase: `commands/file-meeting.md`, `scripts/compute-state`, `scripts/compute-team`, `references/meeting/cross-relationship-patterns.md` -- direct code reading
- `08-CONTEXT.md` -- all locked decisions and architecture choices

### Secondary (MEDIUM confidence)
- [Read AI MCP Blog Post](https://www.read.ai/post/read-ai-mcp-your-meetings-just-became-your-most-powerful-dev-tool) -- MCP endpoint URL, OAuth auth, available tools (list sessions, get transcript)
- [Vexa GitHub](https://github.com/Vexa-ai/vexa) -- Open-source MCP server for meeting transcription
- [Claude Code MCP Docs](https://code.claude.com/docs/en/mcp) -- HTTP type MCP server configuration, `claude mcp add-json` command
- [Read AI API Reference](https://support.read.ai/hc/en-us/articles/49381161088659-API-Reference) -- REST API endpoints (403 on direct access, but confirmed to exist)

### Tertiary (LOW confidence)
- Read AI OAuth token management details -- blog mentions OAuth but specific token refresh mechanics unverified
- Exact MCP tool names for Vexa/Recall.ai session listing and transcript retrieval

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- uses established filesystem patterns from Phase 6/7
- Architecture: HIGH -- extends existing compute-state/compute-team layered pattern
- Cross-meeting intelligence: HIGH -- all decisions locked in CONTEXT.md, clear implementation path
- Read AI integration: MEDIUM -- MCP endpoint confirmed, OAuth flow details sparse
- Vexa/Recall.ai: LOW -- known to have MCP servers but exact tool interfaces need probing during implementation

**Research date:** 2026-03-23
**Valid until:** 2026-04-15 (Read AI MCP may evolve; Vexa is actively releasing)
