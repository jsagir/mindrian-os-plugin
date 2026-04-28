---
name: doctor
description: Diagnose and optionally repair MindrianOS install — detects install-cache drift, version mismatches, and offers one-shot recovery
argument-hint: [--fix]
allowed-tools:
  - Bash
  - Read
---

# /mos:doctor

Self-service diagnostic for MindrianOS installs. Detects when the live plugin install at `~/.claude/plugins/mindrian-os/` has fallen behind the marketplace cache (a real failure mode that occurred twice — see `docs/autopsies/2026-04-13-wrong-workspace-incident.md` and `docs/autopsies/2026-04-28-install-cache-drift-incident.md`).

## How it works

The script `scripts/doctor.cjs` runs three checks:

1. **Install cache version** — reads `~/.claude/plugins/mindrian-os/.claude-plugin/plugin.json`
2. **Marketplace cache** — enumerates `~/.claude/plugins/cache/mindrian-marketplace/mos/*` directories and picks the highest semver as "latest"
3. **Drift** — compares the two; if install < latest, drift is reported

If the user passes `--fix`, the script:

1. Renames the live install to `~/.claude/plugins/mindrian-os.stale-<old-version>-<timestamp>`
2. Copies the latest marketplace cache to `~/.claude/plugins/mindrian-os` via `cp -aT`
3. Re-reads the new `plugin.json` and verifies the version matches expected

The backup is preserved indefinitely. After 24 hours of normal use, the user can delete it manually.

## Step 1: Parse the user's intent

Look at the user's invocation:

- `/mos:doctor` (no flag) → run read-only diagnostic
- `/mos:doctor --fix` → run diagnostic + auto-recover if drift is detected
- `/mos:doctor --json` → machine-readable output (for hooks / regression tests)

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

The script outputs a self-contained 4-zone Mondrian Board with header, content, and exit status. Display the script's stdout directly. Do not re-format.

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
╭─ MindrianOS Doctor ──────────────────────────────────╮

  ✓  Install cache up to date
     Live install: 1.11.0 (matches marketplace latest)

  ✓  Dev source consistent (plugin.json + package.json both at 1.11.0)

╰──────────────────────────────────────────────────────╯
```

## Example output (drift detected, no --fix)

```
╭─ MindrianOS Doctor ──────────────────────────────────╮

  ⚠  Install cache drift detected
     Live install:        1.10.10
     Marketplace latest:  1.11.0
     Available cached:    1.10.12, 1.10.17, 1.11.0

     Run: /mos:doctor --fix
     This will back up the stale install and replace with 1.11.0.

╰──────────────────────────────────────────────────────╯
```

## Example output (recovery successful)

```
╭─ MindrianOS Doctor ──────────────────────────────────╮

  ⚠  Install cache drift detected
     Live install:        1.10.10
     Marketplace latest:  1.11.0
     Available cached:    1.10.12, 1.10.17, 1.11.0

     ✓  Recovered to 1.11.0
     backup: /home/jsagi/.claude/plugins/mindrian-os.stale-1.10.10-20260428-095548

╰──────────────────────────────────────────────────────╯
```

After successful recovery, suggest:

```
Recovery applied. Run /clear to refresh the context window
so Larry picks up the new plugin code.
```
