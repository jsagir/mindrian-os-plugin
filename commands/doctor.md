---
name: doctor
description: "Diagnose and optionally repair MindrianOS install: detects install-cache drift, .room-root sentinel gaps, active-room guard silence, surface-verification gaps, ROOM.md/MINTO.md drift, UI Ruling System compliance, statusline visibility drift, and Brain end-to-end smoke"
help_jtbd: "Diagnose and optionally repair an off-feeling install."
argument-hint: "[--fix] [--cascade-rooms] [--verify-surface] [--room-md] [--ui-compliance] [--statusline-visibility] [--install-state] [--stale-first-touch] [--deprecated-usage] [--brain-smoke] [--all] [--acceptance] [--pre-tag] [--light-npx] [--json]"
body_shape: E (Action Report)
hitl_shape: "F.0"
hitl_why: "It surfaces one diagnosed repair for a single approve-or-defer decision."
body_shape_detail: per-class status rows with [before → after] pattern, summary totals, F.1 Next Move selector when drift detected without --fix
serves_jtbd: ["audit-room"]
teaching: "When something feels off with the install, /mos:doctor diagnoses install-cache drift, ROOM.md gaps, statusline visibility, and UI compliance. Optionally repairs with --fix."
allowed-tools:
  - Bash
  - Read
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Utility command. A diagnostics / health-check surface the navigator or release pipeline runs deliberately; it inspects the install, never reacts to a navigator problem-state."
---

# /mos:doctor

Self-service diagnostic for MindrianOS installs. Detects when the live plugin install at `~/.claude/plugins/mindrian-os/` has fallen behind the marketplace cache (a real failure mode that occurred twice -- see `docs/autopsies/2026-04-13-wrong-workspace-incident.md` and `docs/autopsies/2026-04-28-install-cache-drift-incident.md`).

## How it works

The script `scripts/doctor.cjs` runs three checks:

1. **Install cache version** -- reads `~/.claude/plugins/mindrian-os/.claude-plugin/plugin.json`
2. **Marketplace cache** -- enumerates `~/.claude/plugins/cache/mindrian-marketplace/mos/*` directories and picks the highest semver as "latest"
3. **Drift** -- compares the two; if install < latest, drift is reported

If the user passes `--fix`, the script:

1. Renames the live install to `~/.claude/plugins/mindrian-os.stale-<old-version>-<timestamp>`
2. Copies the latest marketplace cache to `~/.claude/plugins/mindrian-os` via `cp -aT`
3. Re-reads the new `plugin.json` and verifies the version matches expected

The backup is preserved indefinitely. After 24 hours of normal use, the user can delete it manually.

## Step 1: Parse the user's intent

Look at the user's invocation:

- `/mos:doctor` (no flag) → run install-cache class A diagnostic only (default; fast)
- `/mos:doctor --all` → run all classes A-G (per D-09 flag-selectors model)
- `/mos:doctor --cascade-rooms` → class B (.room-root sentinel) + class C (active-room guard silence) checks
- `/mos:doctor --verify-surface` → class D live cascade end-to-end via test/fixtures/cascade-surface-e2e/
- `/mos:doctor --room-md` → class E (ROOM.md/MINTO.md presence under .room-root subtrees)
- `/mos:doctor --ui-compliance` → class F (UI Ruling System scan across commands/*.md and scripts/*.cjs)
- `/mos:doctor --statusline-visibility` → class G -- checks user-settings drift, plugin install integrity, and statusline-mos isolated execution
- `/mos:doctor --stale-first-touch` → class K (Phase 121.5-05; SEED-007 absorption) -- scans `data/first-touch-surfaces.json`-declared greeting surfaces (banner, splash, onboard, sessionstart, operator-update, larry-extended) for stale version literals (older than the running plugin) and U+2014 em-dash violations on surfaces flagged `em_dash_check: true`
- `/mos:doctor --deprecated-usage` → class L (Phase 121.5-08 Sub-plan J) -- scans last-7-days `~/.claude/projects/.../*.jsonl` session transcripts for `/mos:<deprecated>` patterns (heal/query/organize/hmi-status/visualize/diagnostics) and surfaces a per-command "use `/mos:<new>` instead" hint. Pure LOCAL scan; zero network, zero Brain. Also activated by `--all`.
- `/mos:doctor --brain-smoke` → class M (Phase 127-02 BRAIN-MCP-127-08): 5-layer Brain end-to-end probe (plugin root resolver, key resolver, HTTPS schema, MCP stdio handshake, e2e brain_schema via the bundled shim). Diagnostic-only; reports the exact failing layer with fail-fast cascade. Detects 12 Phase 126 failure-mode rows in one composable test (the doctor's single Brain smoke).
- `/mos:doctor --fix` → diagnostic + auto-recovery for any class that supports --fix (class A, B, E, G)
- `/mos:doctor --json` → machine-readable output (for hooks / regression tests)

Combine flags freely: `/mos:doctor --all --json --fix`.

## Step 2: Execute

Run via Bash:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.cjs" $ARGUMENTS
```

If `CLAUDE_PLUGIN_ROOT` is unset (older Claude Code versions), fall back to:

```bash
node ~/.claude/plugins/mindrian-os/scripts/doctor.cjs $ARGUMENTS
```

## Step 3: Render the output

The script outputs a 4-zone Shape E (Action Report) per skills/ui-system/SKILL.md. Display the script's stdout directly. Do not re-format. Do not strip ANSI color codes.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Healthy, no drift |
| 1 | Drift detected (read-only mode) |
| 2 | Drift detected and recovered (`--fix` mode) |
| 3 | Internal error (cannot read directories, no marketplace cache, etc.) |

## When to suggest /mos:doctor

Surface this command proactively when:

- A user reports unexpected behavior that might be version-related ("my new feature isn't showing up")
- After a marketplace update (`/plugin marketplace update` followed by reports of broken commands)
- During session start if the workspace guard hook reports drift (future v1.12 work)
- As a follow-up after `claude plugin update` to confirm the update actually landed

## Voice rules (if invoked through Larry)

- No "I" sentences
- Lead with the script's output, then a one-line interpretation
- If drift detected without `--fix`: suggest `/mos:doctor --fix` as the next step
- If drift detected and recovered: confirm the version, mention the backup location, recommend `/clear` and a fresh session

## Example output (healthy)

```
-- MindrianOS -- doctor -- no-drift --

  ■ install-cache              ✓ healthy (1.12.0)
  ■ dev-source                 ✓ consistent (1.12.0)

  Summary: 2 healthy / 0 drift / 0 warnings

  ▶ /mos:status                  # room state overview
  ▷ /mos:doctor --all          # re-run all classes
  ▷ /mos:doctor --json         # machine-readable output
```

## Example output (drift detected, no --fix)

```
-- MindrianOS -- doctor -- drift-detected --

  ■ install-cache              ⚠ drift detected
     live    1.10.10 → 1.11.0

  Summary: 0 healthy / 1 drift / 0 warnings

  [F.1 Next Move]
   ▶ Run /mos:doctor --fix
   ▷ Defer
   ▷ Free-Text

  ▶ /mos:doctor --fix --all     # auto-recover all drift classes
  ▷ /mos:rooms                 # inspect known rooms
  ▷ /mos:doctor --json         # machine-readable output
```

## Example output (recovery successful)

```
-- MindrianOS -- doctor -- recovered --

  ■ install-cache              ⚠ drift detected
     live    1.10.10 → 1.11.0
     ✓ recovered to 1.11.0
     backup /home/jsagi/.claude/plugins/mindrian-os.stale-1.10.10-20260428-095548

  Summary: 0 healthy / 0 drift / 0 warnings

  ▶ /mos:status                  # room state overview
  ▷ /mos:doctor --all          # re-run all classes
  ▷ /mos:doctor --json         # machine-readable output
```

After successful recovery, suggest:

```
Recovery applied. Run /clear to refresh the context window
so Larry picks up the new plugin code.
```

Note: per D-19, the renderer above is structural. Larry handles narrative interpretation of any drift finding when surfacing conversationally (e.g., "what does this mean?"). See references/personality/voice-dna.md for voice patterns.

## Zone 4 (Action Footer)

After presenting results, suggest next actions:

> Want to repair what we found? -> /mos:doctor --fix
> Want the full picture? -> /mos:status
