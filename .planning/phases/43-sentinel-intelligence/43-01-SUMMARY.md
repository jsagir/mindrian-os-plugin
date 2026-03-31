---
phase: 43
plan: 01
subsystem: sentinel-intelligence
tags: [sentinel, monitoring, health-check, deadlines, competitors, hsi, snapshots]
dependency_graph:
  requires: [scripts/compute-hsi.py, scripts/detect-reverse-salients.py, scripts/hsi-to-kuzu.cjs, scripts/analyze-room, scripts/resolve-room]
  provides: [scripts/sentinel-snapshot, scripts/sentinel-health-check, scripts/sentinel-deadline-monitor, commands/scout.md]
  affects: [commands/new-project.md]
tech_stack:
  added: []
  patterns: [sentinel-monitoring, drift-detection, deadline-scanning, snapshot-comparison]
key_files:
  created:
    - scripts/sentinel-snapshot
    - scripts/sentinel-health-check
    - scripts/sentinel-deadline-monitor
    - commands/scout.md
  modified:
    - commands/new-project.md
decisions:
  - "/mos:scout is the primary interface; cron deferred until CronCreate tool is available"
  - "Snapshots pruned after 12 weeks to prevent unbounded growth"
  - "Competitor watch uses web search with contradiction flagging against room claims"
  - "Health check auto-creates initial snapshot if none exist"
metrics:
  duration: ~10 minutes
  completed: 2026-03-31
  tasks: 5/5
  files_created: 4
  files_modified: 1
---

# Phase 43 Plan 01: Sentinel Intelligence Summary

Sentinel intelligence suite with 3 scripts and 1 command for weekly room health monitoring, daily grant deadline scanning, competitor contradiction detection, HSI recomputation, and STATE.md snapshotting.

## What Was Built

### 1. scripts/sentinel-snapshot (SENT-07)
Copies `room/STATE.md` to `room/.snapshots/STATE-YYYY-MM-DD.md`. Auto-prunes snapshots older than 12 weeks. Creates `.snapshots/` directory on first run.

### 2. scripts/sentinel-health-check (SENT-01)
Compares current `STATE.md` against latest snapshot in `.snapshots/`. Detects drift in venture stage, entry counts, edge counts, and staleness (>14 days without update). Outputs structured report to `room/.intelligence/health-YYYY-MM-DD.md`. Auto-creates initial snapshot if none exist.

### 3. scripts/sentinel-deadline-monitor (SENT-02)
Scans `room/funding/` for `STATUS.md` files and `room/opportunity-bank/` for `.md` files with `deadline:` frontmatter. Categorizes as OVERDUE, URGENT (within N days, default 7), or UPCOMING (N-2N days). Outputs report to `room/.intelligence/deadlines-YYYY-MM-DD.md`.

### 4. commands/scout.md (SENT-05, coordinates SENT-01 through SENT-04)
`/mos:scout` command runs all 5 sentinel tasks manually:
- Snapshot (runs first to ensure baseline)
- Health check (drift detection)
- Deadline monitor (funding + opportunity deadlines)
- Competitor watch (web search with contradiction flagging)
- HSI recomputation (compute-hsi + detect-reverse-salients + hsi-to-kuzu)

Supports individual task flags: `/mos:scout health`, `/mos:scout deadlines`, etc.

### 5. commands/new-project.md update (SENT-06, SENT-07)
Room init now creates `room/.intelligence/` and `room/.snapshots/` directories alongside the 8 base sections.

## Commits

| Hash | Description |
|------|-------------|
| e45da8d | sentinel-snapshot script |
| b0f9452 | sentinel-health-check script |
| d7a2f31 | sentinel-deadline-monitor script |
| 7a746c2 | /mos:scout command |
| 9816c67 | new-project.md update for .intelligence/ and .snapshots/ |

## Requirements Coverage

| Requirement | Status | Delivered By |
|-------------|--------|--------------|
| SENT-01 | Done | scripts/sentinel-health-check |
| SENT-02 | Done | scripts/sentinel-deadline-monitor |
| SENT-03 | Done | commands/scout.md (competitor watch section) |
| SENT-04 | Done | commands/scout.md (HSI recomputation section) |
| SENT-05 | Done | commands/scout.md |
| SENT-06 | Done | commands/new-project.md + scripts output to .intelligence/ |
| SENT-07 | Done | scripts/sentinel-snapshot + commands/new-project.md |

## MWP Moat Deepening

Sentinel intelligence deepens the moat by:
- **Layer 5 (HSI Discovery):** Weekly HSI recomputation keeps innovation scores current as room content evolves
- **Layer 6 (Proactive Intelligence):** Competitor watch flags contradictions against room claims, feeding the proactive discovery loop
- **Layer 3 (Cascade Pipeline):** Health check detects when the cascade pipeline output (STATE.md) has drifted from reality

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. All scripts are fully functional. Competitor watch in scout.md relies on web search tools (Tavily MCP or WebSearch) which are optional - the command gracefully handles their absence.

## Self-Check: PASSED

All 4 created files verified present. All 5 commit hashes verified in git log. commands/new-project.md modification verified.
