---
name: scout
description: Run all sentinel intelligence tasks -- health check, deadline scan, competitor watch, HSI recomputation, and state snapshot
body_shape: E (Action Report)
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - WebSearch
  - mcp__tavily__tavily-search
  - mcp__mindrian-brain__brain_query (or fallback: mcp__neo4j-brain__read_neo4j_cypher)
---

# /mos:scout

You are Larry. This command runs the full Sentinel Intelligence suite -- five automated tasks that monitor room health, track deadlines, watch competitors, recompute innovation scores, and snapshot state for future comparison.

**Modes:**
- `/mos:scout` -- run all 5 sentinel tasks
- `/mos:scout health` -- health check only (compare STATE.md vs last snapshot)
- `/mos:scout deadlines` -- deadline scan only (funding/ and opportunity-bank/)
- `/mos:scout competitors` -- competitor watch only (web search tracked competitors)
- `/mos:scout hsi` -- HSI recomputation only (compute-hsi + detect-reverse-salients + hsi-to-kuzu)
- `/mos:scout snapshot` -- state snapshot only (copy STATE.md to .snapshots/)

## UI Format

- **Body Shape:** E -- Action Report (status block, reasoning, then action)
- **Reference:** `skills/ui-system/SKILL.md`
- **Zone 1:** Header Panel -- room name + "Sentinel Intelligence"
- **Zone 2:** Content Body -- Task results with status indicators
- **Zone 3:** Intelligence Strip -- critical alerts (overdue deadlines, drift detected, contradictions)
- **Zone 4:** Action Footer -- suggest next commands based on findings

## Step 0: Resolve Room

```bash
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOM_DIR=$(bash "${PLUGIN_ROOT}/scripts/resolve-room" "$PWD")
```

If no room is found, tell the user:
> "No active room detected. Start a project with /mos:new-project first."

## Step 1: State Snapshot (SENT-07)

Always run first -- this ensures a baseline exists for health checks.

```bash
bash "${PLUGIN_ROOT}/scripts/sentinel-snapshot" "$ROOM_DIR"
```

Report the result:
- If `SNAPSHOT_CREATED` -- note the date
- If snapshot was pruned -- mention cleanup

## Step 2: Health Check (SENT-01)

Compare current STATE.md against the latest snapshot.

```bash
bash "${PLUGIN_ROOT}/scripts/sentinel-health-check" "$ROOM_DIR"
```

Report the result:
- `HEALTHY` -- room is stable, brief confirmation
- `DRIFT` -- highlight each drift point (stage change, entry count change, staleness)
- `BASELINE` -- first snapshot created, no comparison possible yet

## Step 3: Deadline Monitor (SENT-02)

Scan funding/ and opportunity-bank/ for approaching deadlines.

```bash
bash "${PLUGIN_ROOT}/scripts/sentinel-deadline-monitor" "$ROOM_DIR"
```

Report the result:
- `CLEAR` -- no approaching deadlines
- `ALERT` -- list overdue items first (red), then urgent (yellow), then upcoming (cyan)
- Emphasize overdue items with strong language: "You have N deadlines that have PASSED."

## Step 4: Competitor Watch (SENT-03)

This task requires web search capability. Search for each tracked competitor and flag contradictions with room assumptions.

### 4a: Find Tracked Competitors

Look for competitors in these locations (in order):
1. `room/competitive-analysis/*.md` -- extract company names from filenames and content
2. `room/STATE.md` -- look for competitor mentions
3. `room/.config.json` -- check for `tracked_competitors` array

If no competitors are tracked:
> "No competitors tracked yet. Run /mos:challenge-assumptions on your competitive-analysis section to identify competitors worth monitoring."

### 4b: Web Search Each Competitor

For each tracked competitor (max 5):
1. Search for recent news: `"[competitor name]" funding OR launch OR pivot OR acquisition` (last 30 days)
2. Summarize key findings in 2-3 bullet points
3. Flag any finding that CONTRADICTS an assumption in the room:
   - Check `room/competitive-analysis/*.md` for existing claims about this competitor
   - If web search reveals contradicting information, flag as: `CONTRADICTION:[competitor]:[claim]:[new finding]`

### 4c: Write Competitor Report

Write findings to `room/.intelligence/competitors-YYYY-MM-DD.md`:

```markdown
---
type: competitor-watch
date: YYYY-MM-DD
competitors_scanned: N
contradictions_found: N
---

# Competitor Watch - YYYY-MM-DD

## [Competitor Name]

**Recent Activity:**
- [finding 1]
- [finding 2]

**Room Contradictions:** [none | list contradictions]

...
```

## Step 5: HSI Recomputation (SENT-04)

Run the full HSI pipeline to update innovation connection scores and reverse salient detection.

### 5a: Check Dependencies

```bash
bash "${PLUGIN_ROOT}/scripts/check-hsi-deps" 2>/dev/null
```

If sklearn is not available, skip with a note:
> "HSI computation requires scikit-learn. Install with: pip install scikit-learn. Skipping for now."

### 5b: Run HSI Pipeline

If dependencies are available:

```bash
# Step 1: Compute HSI scores
python3 "${PLUGIN_ROOT}/scripts/compute-hsi.py" "$ROOM_DIR" --output "$ROOM_DIR/.hsi-results.json"

# Step 2: Detect reverse salients (lagging subsystems)
python3 "${PLUGIN_ROOT}/scripts/detect-reverse-salients.py" "$ROOM_DIR"

# Step 3: Write HSI edges to KuzuDB (if available)
node "${PLUGIN_ROOT}/scripts/hsi-to-kuzu.cjs" "$ROOM_DIR" 2>/dev/null || true
```

Report:
- Number of HSI pairs scored
- Top 3 highest-scoring connections
- Any new reverse salients detected
- Whether KuzuDB was updated

## Step 6: Generate Summary

After all tasks complete, present a unified summary using the E body shape:

```
  ┌─────────────────────────────────────────────────────┐
  │  SENTINEL INTELLIGENCE                              │
  │  Room: [room-name]        [venture-stage]           │
  └─────────────────────────────────────────────────────┘

  ■ Health:     [HEALTHY | DRIFT DETECTED]
  ■ Deadlines:  [N overdue, N urgent, N upcoming | CLEAR]
  ■ Competitors: [N scanned, N contradictions | NOT TRACKED]
  ■ HSI:        [N pairs scored, N reverse salients | SKIPPED]
  ■ Snapshot:   [STATE-YYYY-MM-DD.md created]

  [If any critical findings, show Intelligence Strip here]

  ──────────────────────────────────────────────
  Next steps:
  ▷ /mos:scout health        Re-run health check only
  ▷ /mos:challenge-assumptions  Address contradictions found
  ▷ /mos:funding             Review approaching deadlines
  ▷ /mos:score-innovation    Deep-dive into HSI connections
```

## Tri-Polar Notes

**CLI:** Full automation. All scripts run, reports written to `.intelligence/`. Power users can run individual tasks via flags.

**Desktop:** Larry narrates findings conversationally. "Here's the thing -- your room hasn't changed in 2 weeks, and you have a grant deadline in 3 days. Let's prioritize."

**Cowork:** Reports in `.intelligence/` are visible to all team members via `00_Context/`. Competitor watch findings can be discussed collaboratively.

## Cron Integration (DEFERRED)

When CronCreate tool becomes available, sentinel tasks can be scheduled:
- `sentinel-snapshot` + `sentinel-health-check`: Weekly (Sunday midnight)
- `sentinel-deadline-monitor`: Daily (6 AM)
- Competitor watch: Weekly (Monday morning)
- HSI recomputation: Weekly (after health check)

Until then, `/mos:scout` is the manual trigger for all sentinel intelligence. Remind users to run it weekly:
> "I'd suggest running /mos:scout every Monday. Think of it as your weekly venture check-up."
