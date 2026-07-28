---
name: scout
description: Run sentinel scans across the room
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Scout the competitive landscape for a specific axis."
body_shape: E (Action Report)
hitl_shape: "F.8"
hitl_why: "Sentinel scans run as an independent set of watches with no ordering constraint."
serves_jtbd: ["explore", "understand-market"]
teaching: "When you want background scans running across the room without driving them yourself, /mos:scout fires the sentinel checks. The proactive layer, not the reactive one."
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Read Write Glob Bash WebSearch mcp__tavily__tavily-search mcp__mindrian-brain__brain_query mcp__mindrian-brain__read_neo4j_cypher AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: scout
  framework: null
  posture: hold
  hierarchy_rank: 35
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

# /mos:scout

You are Larry. This command runs the full Sentinel Intelligence suite -- five automated tasks that monitor room health, track deadlines, watch competitors, recompute innovation scores, and snapshot state for future comparison.

**Modes:**
- `/mos:scout` -- run all 5 sentinel tasks + query efficiency telemetry summary
- `/mos:scout health` -- health check only (compare STATE.md vs last snapshot)
- `/mos:scout deadlines` -- deadline scan only (funding/ and opportunity-bank/)
- `/mos:scout competitors` -- competitor watch only (web search tracked competitors)
- `/mos:scout hsi` -- HSI recomputation only (compute-hsi + detect-reverse-salients + hsi-to-graph)
- `/mos:scout snapshot` -- state snapshot only (copy STATE.md to .snapshots/)
- `/mos:scout efficiency` -- query efficiency telemetry summary only (aggregate JSONL, render median + top 5 + threshold status)

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

# Step 3: Write HSI edges to room graph (if available)
# D-03: do NOT swallow the HSI-to-graph stderr/exit. A silent scout is how
# HARD-02 hid for weeks. stderr surfaces; a non-zero exit prints a visible
# degraded-step advisory but stays non-fatal to the overall scout run.
if ! node "${PLUGIN_ROOT}/scripts/hsi-to-graph.cjs" "$ROOM_DIR"; then
  echo "ADVISORY: HSI-to-graph step failed (room graph not updated this run); scout continues in degraded mode" >&2
fi
```

Report:
- Number of HSI pairs scored
- Top 3 highest-scoring connections
- Any new reverse salients detected
- Whether room graph was updated

## Step 5b: Query Efficiency Telemetry (SENT-08)

Aggregate the query-efficiency JSONL produced by the 88.1-16 PostToolUse hook at `~/.mindrian/telemetry/query-efficiency.jsonl`. This summary surfaces whether the 57x token-efficiency claim (Canon Part 6) is holding up in real usage. Release gate (Plan 88.1-11) consumes the threshold status before tagging.

```bash
node "${PLUGIN_ROOT}/scripts/scout-telemetry-aggregator.cjs"
```

Options the user can pass through as `/mos:scout efficiency --days=30` or similar:
- `--days=N` -- window size in days (default 7)
- `--all` -- no window filter (all-time aggregation)
- `--json` -- machine-readable JSON output (release gate uses this)

Report the result verbatim. The aggregator emits:
- event count in the window
- median ratio + mean ratio
- top 5 commands by ratio (per-command max)
- threshold status: `PASS` (median >= 40x) | `RETUNE` (median < 40x) | `NO_DATA` (empty window)

If the JSONL file does not exist yet, the aggregator prints "no events in window yet. Run a /mos:* query first." -- this is normal for fresh installs and is not an error.

Expose the threshold status prominently in the final Sentinel summary (Step 6).

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
  ■ Efficiency: [median R.RRx over N events, PASS | RETUNE | NO_DATA]

  [If any critical findings, show Intelligence Strip here]

  ──────────────────────────────────────────────
  Next steps:
  ▷ /mos:scout health        Re-run health check only
  ▷ /mos:scout efficiency    Query efficiency telemetry summary only
  ▷ /mos:challenge-assumptions  Address contradictions found
  ▷ /mos:funding             Review approaching deadlines
  ▷ /mos:score-innovation    Deep-dive into HSI connections
```

## Tri-Polar Notes

**CLI:** Full automation. All scripts run, reports written to `.intelligence/`. Power users can run individual tasks via flags.

**Desktop:** Larry narrates findings conversationally. "Here's the thing -- your room hasn't changed in 2 weeks, and you have a grant deadline in 3 days. Let's prioritize."

**Cowork:** Reports in `.intelligence/` are visible to all team members via `00_Context/`. Competitor watch findings can be discussed collaboratively.

## Scheduled Cadence (LIVE)

The scout suite fires on a cadence across all three Tri-Polar surfaces via the single composer `scripts/scout-cadence-runner.cjs` (Phase 145). The runner composes all six scout sub-sensors PLUS the four SCHED-02 sensors (whitespace recompute, reverse-salient, opportunity-bank scan, competitor watch) behind the Phase-140 safe-auto-fire guard. It is Canon Part 8 zero-egress: no Brain query, no web fetch; competitor watch is emitted as a public-SIGNAL query plan for the surface layer, never fetched inside the runner.

`/mos:scout` remains the manual, on-demand trigger. The cadence below runs the same composition automatically.

### 1. CLI default: session-start-throttle

The `scripts/session-start` hook fires `scripts/scout-cadence-runner.cjs` in the background on every CLI session, self-throttled to at most once per interval (default 24h) by the runner's Plan-01 guard. No manual `/mos:scout` is needed. The slot is best-effort and soft-fails so it never blocks startup; most sessions are a sub-millisecond throttle short-circuit.

Opt out (emergency disable) with the environment variable:
```bash
export SCOUT_CADENCE_SKIP=1
```

This is the canonical zero-infrastructure default: session start IS the trigger.

### 2. CLI power-user option: cron

Power users who want a fixed wall-clock schedule (independent of when they open a session) can call the runner from cron. The runner is cron-callable as a non-interactive command. Use `--force` because cron owns the cadence, so it bypasses the per-session throttle:

```cron
# Every Monday at 06:00, run the full scout cadence on a room.
0 6 * * 1 node /path/to/mindrian-os/scripts/scout-cadence-runner.cjs /path/to/room --force >> /tmp/scout-cadence.log 2>&1
```

`--force` is safe here because the cron interval IS the throttle. Do not combine cron with a short session-start interval that double-fires; pick cron OR the session-start default, not both at high frequency.

### 3. Cowork: scout-sentinel scheduled task

On Cowork, the `scout-sentinel` scheduled task points at the same runner so the identical composition fires under Cowork's scheduler. See `commands/scheduled-tasks.md` Task 6 (Scout Sentinel). The Cowork scheduler owns the cadence, so that task also uses `--force`.

All three surfaces converge on one composer and one safe-auto-fire guard, so the cadence behaves identically wherever it fires.
