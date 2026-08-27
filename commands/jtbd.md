---
name: jtbd
description: "Show, set, list, or inspect the active JTBD: the per-room signal that tells Larry what kind of work the navigator is doing right now"
help_jtbd: "Surface the job-to-be-done you are in right now."
argument-hint: "[set <jtbd> | clear | list | history] [--json]"
body_shape: E (Action Report)
hitl_shape: "F.1"
hitl_why: "Setting the active JTBD is a single next-move selection."
# Phase 267.3-06, ruled in 267.3-CLASSIFICATION.md (Row 21): first delivery at commands/jtbd.md:93, the classifier's own inferred JTBD label plus confidence and history, a state readout of the tool's internal signal.
interactive_first_reward: "--none (diagnostic surface)"
body_shape_detail: current state + last 5 history (default), 13 entries (list), full history (history), Shape F.1 picker (set with no arg), Shape E confirmation (clear, set <jtbd>)
serves_jtbd: ["audit-room"]
kind: methodology
frameworks: ["Jobs to Be Done (JTBD)"]
teaching: "When you need to see or set the active job-to-be-done for this room, /mos:jtbd shows the per-room signal that tells Larry what kind of work you are doing right now."
locks_operator: null
min_tier: 0
concurrency: sequential
streams_events: false
disable-model-invocation: false
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-05]
  reach_id: context_block
  sub_mode: jtbd-infer
  framework: "Jobs to Be Done (JTBD)"
  posture: hold
  hierarchy_rank: 16
  filing: memory_event_only
  plan_gated: false
  web_scope: null
---

# /mos:jtbd

Inspect or manually set the active Job-to-be-Done (JTBD) for the current room. The JTBD is the per-room signal that tells Larry what kind of work the navigator is doing right now -- `find-bottleneck`, `prepare-pitch`, `audit-room`, `explore` (fallback), and 9 more. Phase 100 makes JTBD a first-class, persisted, room-local state so every subsequent `/mos:` command can render against the same job signal.

The JTBD state file lives at `<roomDir>/.mindrian/jtbd-state.json` (per-room, never global -- Phase 100 D-06). The heuristic classifier (Phase 100-02) updates it silently per turn. Manual sets stick for 24 hours unless cleared, switched, or re-set (Phase 100 D-12). Most users never need this command directly. Use `/mos:jtbd` when:

- You want to inspect what Larry currently believes the job is.
- The classifier mis-routed and you want to manually override.
- You are debugging the classifier or auditing the transition history.
- You want a one-line index of all 12 first-class jobs + the `explore` fallback.

## Step 1: Parse the user's intent

Look at the invocation:

- `/mos:jtbd` (no args) -> show current JTBD + last 5 history (Shape E)
- `/mos:jtbd history` -> show last 20 transitions (Shape E)
- `/mos:jtbd list` -> show all 13 entries with their one-liners (Shape E)
- `/mos:jtbd set <jtbd>` -> manual override; sticky 24 hours (writes history with trigger=manual_set)
- `/mos:jtbd set` (no arg) -> render Shape F.1 picker with the 12 jobs + Free-Text
- `/mos:jtbd clear` -> return to null (no JTBD inferred); writes history with trigger=manual_clear
- `/mos:jtbd --json` -> machine-readable output for hooks / regression tests

Combine `--json` with any subcommand: `/mos:jtbd history --json`.

## Step 2: Execute

Run via Bash:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/jtbd-command.cjs" $ARGUMENTS
```

If `CLAUDE_PLUGIN_ROOT` is unset (older Claude Code versions), fall back to:

```bash
node ~/.claude/plugins/mindrian-os/scripts/jtbd-command.cjs $ARGUMENTS
```

The script does the work:

1. Resolves the active room from `~/MindrianRooms/.rooms/registry.json`.
2. Loads `<roomDir>/.mindrian/jtbd-state.json` via `lib/hmi/jtbd-state.cjs.getCurrent`.
3. Loads `lib/hmi/jtbd-taxonomy.json` for taxonomy lookups.
4. Branches on subcommand: render Shape E, render Shape F.1, or perform a write transition.
5. For `set` subcommand: validates the requested JTBD against the taxonomy; rejects unknown JTBDs with a 3-line stderr per Canon Part 3 Rule 2 and exits non-zero.

## Step 3: Render the output

The script outputs a 4-zone Shape E (Action Report) per `skills/ui-system/SKILL.md`. Display the script's stdout directly. Do not re-format. Do not strip ANSI color codes.

## Subcommands

### `/mos:jtbd` (default -- show current state)

Renders Shape E with the current JTBD, confidence, evidence chain, and last 5 history entries. Zone 4 footer surfaces 3 grounded follow-up commands tuned to the active job.

### `/mos:jtbd history`

Renders Shape E with the last 20 transitions (chronological-recent-first). Each row shows from -> to + trigger + timestamp.

### `/mos:jtbd list`

Renders Shape E with all 13 taxonomy entries (12 first-class jobs + `explore` fallback). Each row: id + one-line description.

### `/mos:jtbd set <jtbd>`

Validates `<jtbd>` against the 13-entry taxonomy. On success, writes the state with `trigger=manual_set` and a 24h `expires_at` window (the manual override). On failure (unknown JTBD), prints a 3-line error to stderr and exits 1.

### `/mos:jtbd set` (no arg)

Renders a Shape F.1 Next Move selector listing the 12 first-class jobs + `Free-Text`. Per Phase 95.1-04 D-19 deferral pattern, the F.1 picker renders as a STRUCTURAL marker block in stdout. Larry handles conversational selection: when the user types "set to find-bottleneck" in natural language, Larry interprets and re-invokes the command with the explicit id (e.g., `/mos:jtbd set find-bottleneck`). Phase 88.2 (`uiux-selector-block`) will replace the marker block with the canonical AskUserQuestion primitive. See `.planning/phases/100-jtbd-inference-engine/f1-selector-deferred.md`.

### `/mos:jtbd clear`

Clears the current JTBD to null (no JTBD inferred). Writes a history row with `trigger=manual_clear`. Subsequent classifier runs may re-populate the state.

## Examples

### Default show (active JTBD)

```
-- mindrianos -- jtbd -- find-bottleneck --

  ■ Current               find-bottleneck
     entered  2026-05-01T10:42:00Z (3m ago)
     confidence  0.82
     evidence  tokens:rs-fetch, operator:METHODOLOGY, recency:rs-thesis
     expires  manual override active until 2026-05-02T10:42:00Z

  ■ Last 5 history
     ├─ explore           2026-05-01T10:30:00Z  trigger=session_start
     ├─ explore           2026-05-01T10:35:00Z  trigger=user_message
     └─ find-bottleneck   2026-05-01T10:42:00Z  trigger=manual_set

  Summary: total transitions=3, history_used=3/50

  ▶ /mos:act                  # run methodology for active job
  ▷ /mos:jtbd set             # manual override (F.1 picker)
  ▷ /mos:jtbd history         # full transition history
```

### Default show (no JTBD inferred)

```
-- mindrianos -- jtbd -- null --

  ⬜ no JTBD set
     classifier confidence below 0.6 threshold; explore fallback active
     evidence  below_threshold

  ▶ /mos:jtbd list            # browse 13 jobs
  ▷ /mos:jtbd set <id>        # manual selection
  ▷ /mos:status               # room state
```

### list subcommand

```
-- mindrianos -- jtbd -- list --

  ■ JTBD taxonomy (13 entries)
     • decide-pursue          Decide if a venture / opportunity / approach is worth pursuing
     • find-problem           Find the problem worth solving (not the symptom, the root)
     • understand-market      Understand the market for this idea -- size, structure, dynamics
     • find-bottleneck        Find the lagging component (Hughes 1983 reverse salient) blocking progress
     • prepare-pitch          Prepare for an investor / partner / customer meeting
     • validate-idea          Test if an idea / hypothesis / claim holds up under scrutiny
     • compare-options        Compare alternatives across criteria -- choose between A/B/C
     • connect-domains        Find cross-domain analogues -- what does this look like in another field?
     • surface-contradiction  Notice and resolve internal contradictions in the room
     • plan-execution         Plan the next 90 days -- milestones, owners, dates
     • file-meeting           Capture and route meeting intelligence into the room
     • audit-room             Audit Data Room health -- gaps, drift, evidence tier, decision quality
     • explore                No specific job -- general thinking, talking, ranging (fallback)

  ▶ /mos:jtbd                 # current state
  ▷ /mos:jtbd set <id>        # manual selection
  ▷ /mos:jtbd history         # transition history
```

### set subcommand (Shape F.1 picker, no arg)

```
-- mindrianos -- jtbd -- set --

  ■ Manual JTBD selection
     current: explore

  [F.1 Next Move]
   ▶ decide-pursue           # decide if worth pursuing
   ▷ find-problem            # find the root problem
   ▷ understand-market       # understand the market
   ▷ find-bottleneck         # find the lagging component
   ▷ prepare-pitch           # prepare for stakeholder meeting
   ▷ validate-idea           # stress-test a claim
   ▷ compare-options         # compare alternatives
   ▷ connect-domains         # find cross-domain analogues
   ▷ surface-contradiction   # resolve room contradictions
   ▷ plan-execution          # plan next 90 days
   ▷ file-meeting            # file meeting intelligence
   ▷ audit-room              # audit room health
   ▷ Free-Text               # describe the job in your own words

  ▶ /mos:jtbd                 # cancel and re-show state
  ▷ /mos:jtbd list            # browse one-liners first
```

### history subcommand

```
-- mindrianos -- jtbd -- history --

  ■ History (3 of 50 entries)
     ├─ explore           2026-05-01T10:30:00Z  trigger=session_start    from=null
     ├─ explore           2026-05-01T10:35:00Z  trigger=user_message     from=explore
     └─ find-bottleneck   2026-05-01T10:42:00Z  trigger=manual_set       from=explore

  Summary: total transitions=3, history_used=3/50, oldest=2026-05-01T10:30:00Z

  ▶ /mos:jtbd                 # current state
  ▷ /mos:jtbd set <id>        # manual selection
  ▷ /mos:jtbd clear           # return to null
```

### clear subcommand

```
-- mindrianos -- jtbd -- clear --

  ✓ Cleared JTBD (was: find-bottleneck)
     trigger: manual_clear
     classifier may re-populate on next user turn

  ▶ /mos:jtbd list            # browse 13 jobs
  ▷ /mos:jtbd set <id>        # manual selection
  ▷ /mos:status               # room state
```

## Note on Shape F.1 deferral

Per Phase 95.1-04 D-19 deferral pattern, the F.1 picker renders as a STRUCTURAL marker block in stdout. Larry handles conversational selection: when the user types natural language ("set to find-bottleneck", "let's pitch"), Larry interprets and re-invokes the command with the explicit id. Phase 88.2 (`uiux-selector-block`) will replace the marker block with the canonical AskUserQuestion primitive. See `.planning/phases/100-jtbd-inference-engine/f1-selector-deferred.md` for the deferral note + re-trigger condition.

## Voice rules

When Larry surfaces the output conversationally:

- "You're on `find-bottleneck`. The classifier saw `rs-fetch` in your last turn plus you're in METHODOLOGY operator -- 0.82 confidence."
- "Want to override? `/mos:jtbd set <id>` lets you pick from the 12 first-class jobs."
- "If the JTBD looks wrong, `/mos:jtbd list` shows all 13 with one-liners; `/mos:jtbd clear` returns to null."

NEVER:
- Apologize for the JTBD inference being what it is. The state is the truth; the classifier is heuristic and the user can always override.
- Suggest the user "should" be doing a particular job. The user picks; Larry classifies.
- Re-show the example blocks above when speaking conversationally; just describe what they would see.

## Cross-references

- **Canon:** `docs/MINDRIAN-CANON.md` Part 3 (Tri-Context Decision Gate; F.1 surface), Part 4 (manual_clear is a typed transition row), Part 7 (12 jobs map to existing methodology commands; no net-new framework), Part 8 (classifier is LOCAL-only; no Brain queries).
- **Phase 100 KICKOFF:** `.planning/phases/100-jtbd-inference-engine/100-CONTEXT.md` D-09 / D-10 (subcommand list).
- **/mos:operator** (Phase 99): the JTBD classifier reads the active operator as input stratum 2.
- **/mos:doctor:** if the renderer drifts from the UI Ruling System, `/mos:doctor --ui-compliance` will surface the violation.
- **Phase 100-04 plan:** this command's source spec.
