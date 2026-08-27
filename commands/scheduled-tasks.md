---
name: scheduled-tasks
description: Define Cowork scheduled tasks for the room
help_jtbd: "View and manage scheduled background sweeps."
body_shape: E (Action Report)
hitl_shape: "F.1"
hitl_why: "Scheduled tasks offers one next move to confirm a schedule change."
# Phase 267.3-07, ruled in 267.3-CLASSIFICATION.md (Row 15): first delivery inferred from hitl_why plus the Configuration section at commands/scheduled-tasks.md:290, a view-then-confirm shape over the plugin's own scheduler configuration.
interactive_first_reward: "--none (diagnostic surface)"
serves_jtbd: ["plan-execution"]
teaching: "When you want Cowork to run something on a schedule against this room, /mos:scheduled-tasks defines the recurring job. Best for nightly grant sweeps or weekly meeting digests."
ui_reference: skills/ui-system/SKILL.md
surface: cowork
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - WebSearch
  - mcp__tavily__tavily-search
  - mcp__mindrian-brain__brain_query
  - AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Lifecycle command. Manages scheduled / background sweeps; a scheduler-config surface run by the navigator or cron, not a contextual reach."
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

# Cowork Scheduled Tasks

These are task definitions for Cowork's built-in scheduler. Each task runs autonomously at its configured interval, producing room artifacts in `room/intelligence/`.

Users configure these in Cowork's task management UI. Larry references these definitions to register and execute scheduled work.

---

## Task 1: Daily Briefing

**Schedule:** Every 24 hours (recommended: 6:00 AM user's timezone)
**Trigger:** `daily-briefing`
**Requirements:** SCHED-02

### What It Does

Generates a daily intelligence briefing from room state:
- Approaching prediction deadlines (overdue, urgent, approaching)
- New contradictions detected in intelligence files
- Stale sections (7+ days without updates)
- Room health summary (section coverage, artifact counts)

### Execution

```javascript
const { writeBriefing } = require('lib/core/daily-briefing.cjs');
const result = writeBriefing(roomDir);
// result.outputPath = room/intelligence/briefing-YYYY-MM-DD.md
```

### Output

Filed to: `room/intelligence/briefing-YYYY-MM-DD.md`

Frontmatter includes: type, date, predictions_tracked, contradictions_found, stale_sections, generated timestamp.

### Recovery

If missed (Cowork was offline), the session catch-up module detects the gap and generates the briefing on next session start.

---

## Task 2: Prediction Deadline Tracker

**Schedule:** Every 12 hours
**Trigger:** `prediction-tracker`
**Requirements:** SCHED-02

### What It Does

Scans `.predictions/REGISTRY.json` for:
- OVERDUE predictions (deadline passed)
- URGENT predictions (due within 3 days)
- APPROACHING predictions (due within 14 days)

Alerts are included in the daily briefing. This task runs more frequently to catch deadline transitions between briefings.

### Execution

```javascript
const { getPredictionDeadlines } = require('lib/core/daily-briefing.cjs');
const deadlines = getPredictionDeadlines(roomDir);
const overdue = deadlines.filter(p => p.status === 'OVERDUE');
const urgent = deadlines.filter(p => p.status === 'URGENT');
```

If overdue or urgent predictions exist, surface them via resource notification:
> "You have N overdue predictions and M predictions due within 3 days."

### Output

No separate file -- results feed into the daily briefing. Notifications are surfaced to the user in the Cowork conversation.

---

## Task 3: Competitor Watch

**Schedule:** Weekly (recommended: Monday 8:00 AM)
**Trigger:** `competitor-watch`
**Requirements:** SCHED-03, SCHED-07

### What It Does

1. Extracts tracked competitors from `room/competitive-analysis/` and `.config.json`
2. Builds search queries for each competitor (max 5)
3. Executes web searches for recent competitor activity
4. Checks findings against room assumptions for contradictions
5. Files results to `room/intelligence/competitors-YYYY-MM-DD.md`

### Execution

```javascript
const { buildCompetitorQueries, fileCompetitorResults } = require('lib/core/scheduled-scanner.cjs');
const queryPlan = buildCompetitorQueries(roomDir);

if (queryPlan.insufficient) {
  // No competitors tracked -- skip
  return;
}

// For each query, use WebSearch or Tavily
for (const q of queryPlan.queries) {
  // Execute: WebSearch(q.searchQuery)
  // Collect findings and check for contradictions against room/competitive-analysis/
}

// File results
fileCompetitorResults(roomDir, results);
```

### Search Strategy

For each competitor:
- Query: `"[name]" funding OR launch OR pivot OR acquisition OR partnership`
- Time range: last 30 days
- Extract: key developments, funding rounds, product launches, pivots
- Flag: any finding that contradicts claims in room/competitive-analysis/

### Output

Filed to: `room/intelligence/competitors-YYYY-MM-DD.md`

Frontmatter includes: type, date, competitors_scanned, contradictions_found, generated timestamp, source.

---

## Task 4: Grant & Funding Discovery

**Schedule:** Weekly (recommended: Wednesday 8:00 AM)
**Trigger:** `grant-discovery`
**Requirements:** SCHED-04, SCHED-07

### What It Does

1. Reads room context (domain keywords, geography, venture stage from STATE.md)
2. Queries Grants.gov API and Simpler Grants API
3. Scores results for relevance against room context
4. Files top results to `room/intelligence/grants-YYYY-MM-DD.md`

### Execution

```javascript
const { scanAndFileGrants } = require('lib/core/scheduled-scanner.cjs');
const result = await scanAndFileGrants(roomDir);
// result.outputPath, result.resultCount, result.apiErrors
```

### Prerequisites

Room STATE.md should contain `domain_keywords` for accurate matching. Without keywords, the scanner falls back to problem-definition/ content.

### Output

Filed to: `room/intelligence/grants-YYYY-MM-DD.md`

Frontmatter includes: type, date, results count, api_errors count, generated timestamp, source.

---

## Task 5: Domain News Scan

**Schedule:** Weekly (recommended: Friday 8:00 AM)
**Trigger:** `news-scan`
**Requirements:** SCHED-05, SCHED-07

### What It Does

1. Reads domain keywords from room STATE.md
2. Builds news queries: domain developments, regulatory updates, market/investment
3. Executes web searches
4. Files results to `room/intelligence/news-YYYY-MM-DD.md`

### Execution

```javascript
const { buildNewsQueries, fileNewsResults } = require('lib/core/scheduled-scanner.cjs');
const queryPlan = buildNewsQueries(roomDir);

if (queryPlan.insufficient) {
  // No domain keywords -- skip
  return;
}

// For each query, use WebSearch or Tavily
// Collect results per topic

fileNewsResults(roomDir, results);
```

### Output

Filed to: `room/intelligence/news-YYYY-MM-DD.md`

Frontmatter includes: type, date, topics_scanned, items_found, generated timestamp, source.

---

## Task 6: Scout Sentinel

**Schedule:** Weekly (recommended: Sunday midnight)
**Trigger:** `scout-sentinel`
**Requirements:** SCHED-06, SCHED-01

### What It Does

Runs the full scout cadence via the single Phase-145 composer. One runner composes all six scout sub-sensors PLUS the four SCHED-02 sensors behind the Phase-140 safe-auto-fire guard:
1. State snapshot
2. Health check (compare STATE.md vs last snapshot; exit captured for the HARD-01 invariant)
3. Deadline monitor (funding/ and opportunity-bank/ deadlines)
4. Whitespace recompute (SCHED-02)
5. Reverse-salient (SCHED-02)
6. Opportunity-bank scan (SCHED-02)
7. Competitor watch (SCHED-02; emitted as a public-SIGNAL query plan, never fetched inside the runner)
8. HSI recomputation (if dependencies available)

### Execution

This task invokes the single cadence runner. The Cowork scheduler owns the cadence, so `--force` bypasses the per-session throttle (the scheduler interval IS the throttle):

```bash
PLUGIN_ROOT="$(dirname "$(readlink -f "$0")")/.."
node "${PLUGIN_ROOT}/scripts/scout-cadence-runner.cjs" "$ROOM_DIR" --force
```

The runner composes the Phase-140-hardened sentinel scripts, the HSI / whitespace / reverse-salient Python pipeline, the opportunity-bank ops, and the competitor query plan -- all behind the Phase-140 safe-auto-fire guard. It is Canon Part 8 zero-egress (inherited from Plan 01): no Brain query, no web fetch. See `commands/scout.md` (Scheduled Cadence) for the full Tri-Polar cadence model.

### Output

A single structured summary plus the composed sensor outputs:
- The runner's structured summary (fired/throttled, per-step results, findings-to-graph, the competitor public-SIGNAL query plan)
- The `safeAutoFireCheck` violations surface (HARD-01 health exit / HARD-02 NULL source_path / HARD-03 backup pollution), surfaced prominently but non-fatally
- `room/.snapshots/STATE-YYYY-MM-DD.md`
- `room/.intelligence/health-YYYY-MM-DD.md` (if drift detected)
- HSI results updated in `room/.hsi-results.json`

---

## Tri-Polar Notes

**CLI:** These tasks don't run on CLI. Users invoke `/mos:scout` manually. Session-start hook handles catch-up scanning.

**Desktop:** These tasks don't run on Desktop (no scheduler). Desktop users get the session catch-up summary when reconnecting after a gap.

**Cowork:** Primary surface. Tasks register in Cowork's built-in scheduler. Users configure frequency in task management UI. Missed tasks are recovered by session catch-up on next connection.

---

## Configuration

Users can customize task schedules by setting preferences in `room/.config.json`:

```json
{
  "scheduled_tasks": {
    "daily_briefing": { "enabled": true, "interval_hours": 24 },
    "prediction_tracker": { "enabled": true, "interval_hours": 12 },
    "competitor_watch": { "enabled": true, "interval_days": 7 },
    "grant_discovery": { "enabled": true, "interval_days": 7 },
    "news_scan": { "enabled": true, "interval_days": 7 },
    "scout_sentinel": { "enabled": true, "interval_days": 7 }
  },
  "tracked_competitors": ["Competitor A", "Competitor B"]
}
```

All tasks are enabled by default. Users can disable individual tasks or adjust frequency.
