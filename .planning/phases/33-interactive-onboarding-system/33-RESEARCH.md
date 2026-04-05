# Phase 33: Interactive Onboarding System - Research

**Researched:** 2026-03-31
**Domain:** CLI plugin onboarding, session hook integration, marker-file state management
**Confidence:** HIGH

## Summary

Phase 33 adds an interactive, Larry-voiced onboarding system that triggers on first install and after updates. The implementation domain is entirely within the existing plugin architecture: a new bash script (`scripts/check-onboard`), a new command (`commands/onboard.md`), and modifications to the existing `scripts/session-start` hook to inject onboarding context into `additionalContext`.

The codebase already contains every pattern needed. `scripts/check-update` provides version comparison logic (semver via `sort -V`), marker file reading, and CHANGELOG parsing via `sed`. The `session-start` hook already has the cold-start vs warm-start branch point at line 138-142 where onboarding must integrate. Commands like `help.md` and `update.md` demonstrate the exact frontmatter + markdown-prompt pattern. No new dependencies are required.

**Primary recommendation:** Build `check-onboard` as a bash script matching the `check-update` pattern (same version reading, same `sort -V` comparison), integrate it into the cold-start branch of `session-start` (between banner and context injection), and create `onboard.md` as a conversational command that Larry executes with the user.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- First install detected by absence of `~/.mindrian-onboarded` marker file
- Update detected by comparing marker version < current plugin version
- Marker file format: line 1 = version, line 2 = date
- Marker written after onboarding completes OR is skipped (skipping is never penalized)
- Manual re-run always available via `/mos:onboard`
- Version-specific changelog via `/mos:onboard whats-new`
- Interactive flow: 6 steps, all skippable
- Step 1: Welcome + intent discovery with 7 options
- Step 2: Tailored command path (3-5 commands as WORKFLOW SEQUENCE)
- Step 3: Best practices (2-3 tips, universal + path-specific)
- Step 4: Optional integrations (light touch)
- Step 5: What's new (update flow only)
- Step 6: Wrap + suggested first action
- 5 Workflow Paths (Idea/Venture, Research/Analysis, Meeting Intelligence, Stakeholder Presentations, Complex Project)
- Voice Rules: Larry voice, conversational, direct, no filler, signature openers, NO emoji, NO filler phrases
- Session-Start Integration: cold start -> check-onboard -> FIRST_INSTALL -> inject onboarding context; after update -> inject whats-new context
- Banner always shows on cold start (already implemented)

### Claude's Discretion
- How to structure intent discovery (single question vs multi-step) -- Research recommends: single question with 7 numbered options, Larry asks once
- Whether check-onboard is bash or node.js -- Research recommends: bash (matches all other scripts/)
- Exact Larry copy for each path (must follow voice rules)
- How to parse CHANGELOG.md for whats-new -- Research recommends: reuse check-update's sed pattern
- Whether update flow shows condensed walkthrough or just whats-new + reminder -- Research recommends: whats-new + core features reminder (not full walkthrough)

### Deferred Ideas (OUT OF SCOPE)
- Progressive disclosure (unlock deeper features over time)
- Analytics on which path users choose
- Warm-start onboarding (when room exists but user hasn't seen onboarding)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ONBOARD-01 | First install auto-triggers onboarding via marker file detection (~/.mindrian-onboarded) | check-onboard script reads marker, returns FIRST_INSTALL/UPDATE/CURRENT; session-start integrates at cold-start branch |
| ONBOARD-02 | 7 user intent paths with tailored command sequences | onboard.md command with conversational flow, 5 workflow paths + tour + skip |
| ONBOARD-03 | Larry voice throughout -- no emoji, signature openers, conversational not mechanical | Voice rules from larry-personality skill + ui-system SKILL.md, enforced in onboard.md |
| ONBOARD-04 | Skip available at every step -- never penalized, marker still written | onboard.md includes skip option at each step, always writes marker via check-onboard --write |
| ONBOARD-05 | After-update flow shows CHANGELOG as capabilities plus core features reminder | check-onboard returns UPDATE status + changelog diff; session-start injects as additionalContext |
| ONBOARD-06 | /mos:onboard command for full manual re-runs anytime | commands/onboard.md with standard frontmatter pattern |
| ONBOARD-07 | /mos:onboard whats-new for version-aware changelog display | onboard.md handles "whats-new" subcommand, calls check-update for changelog |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tri-Polar Design Rule:** Every feature must work on CLI, Desktop, and Cowork. Onboarding is CLI-primary (session-start hook) but must degrade gracefully on Desktop (conversational) and Cowork (shared context)
- **Zero config required:** Larry works immediately after install. Onboarding enhances but never blocks.
- **Release Process:** Version bump in plugin.json + CHANGELOG.md + commit with tag for every user-facing change
- **UI Ruling System:** All /mos: command output MUST follow 4-zone anatomy from skills/ui-system/SKILL.md
- **NO EMOJI anywhere in output**
- **Symbol vocabulary:** Only these glyphs: ■ ▼ ▶ ▷ ├─ └─ ✓ • ⚠ ⚡ ⬜ ->
- **Never use em-dashes** (from memory: feedback_no_emdashes.md)

## Standard Stack

### Core
| Component | Type | Purpose | Why Standard |
|-----------|------|---------|--------------|
| bash script | scripts/check-onboard | Marker detection + version comparison | Matches all 20+ existing scripts/ (bash with set -euo pipefail) |
| markdown command | commands/onboard.md | Interactive walkthrough command | Matches all 52 existing commands/ (YAML frontmatter + prompt) |
| session-start modification | scripts/session-start | Hook integration for auto-trigger | Existing hook, already has cold-start branch at line 138-142 |

### Supporting
| Component | Type | Purpose | When to Use |
|-----------|------|---------|-------------|
| check-update | scripts/check-update | CHANGELOG parsing pattern | Reuse for whats-new feature (sed pattern for version range extraction) |
| banner | scripts/banner | Already called on cold start | Onboarding fires AFTER banner completes |
| plugin.json | .claude-plugin/plugin.json | Version source (currently 1.5.1) | check-onboard reads this for current version |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bash check-onboard | node.js check-onboard | Node would add cold-start latency; bash is instant and matches all other scripts/ |
| additionalContext injection | stderr printing | additionalContext lets Larry render the onboarding conversationally; stderr would be static text |
| Single onboard.md command | Separate first-run.md + whats-new.md | Single command is simpler; subcommand handling via argument parsing in the prompt |

**No installation needed.** Zero new dependencies. Pure bash + markdown.

## Architecture Patterns

### Integration Point: session-start Cold-Start Branch

The exact integration point in `scripts/session-start` is lines 138-142 (the `else` branch when no room exists):

```bash
else
  # Cold start: show De Stijl Mondrian banner
  bash "${SCRIPT_DIR}/banner" "$PLUGIN_VERSION" >&2 2>/dev/null || true

  context="[MindrianOS] No room initialized yet..."
fi
```

**Modified flow:**
```
Cold start (no room) ->
  1. Banner fires to stderr (already exists, line 140)
  2. NEW: check-onboard runs, returns FIRST_INSTALL / UPDATE / CURRENT
  3. If FIRST_INSTALL: inject onboarding context into additionalContext
  4. If UPDATE: inject whats-new + core features reminder into additionalContext
  5. If CURRENT: use existing cold-start context (unchanged)
```

### Pattern: check-onboard Script

Follows the exact pattern of `check-update`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Read current version from plugin.json (same as check-update line 11)
CURRENT_VERSION=$(python3 -c "..." 2>/dev/null || echo "unknown")

# Read marker file
MARKER="$HOME/.mindrian-onboarded"
if [ ! -f "$MARKER" ]; then
  echo "FIRST_INSTALL"
  echo "CURRENT=${CURRENT_VERSION}"
  exit 0
fi

MARKER_VERSION=$(head -1 "$MARKER" 2>/dev/null || echo "0.0.0")

# Compare versions (same sort -V pattern as check-update line 34)
LOWER=$(printf '%s\n%s' "$MARKER_VERSION" "$CURRENT_VERSION" | sort -V | head -1)

if [ "$MARKER_VERSION" = "$CURRENT_VERSION" ]; then
  echo "CURRENT"
elif [ "$LOWER" = "$MARKER_VERSION" ]; then
  echo "UPDATE"
  echo "PREVIOUS=${MARKER_VERSION}"
  echo "CURRENT=${CURRENT_VERSION}"
else
  echo "CURRENT"
fi
```

**Write marker (`--write` flag):**
```bash
if [ "$1" = "--write" ]; then
  echo "$CURRENT_VERSION" > "$MARKER"
  echo "$(date -u +%Y-%m-%d)" >> "$MARKER"
  exit 0
fi
```

### Pattern: onboard.md Command

Standard command frontmatter matching existing commands:

```yaml
---
name: onboard
description: Interactive MindrianOS walkthrough -- Larry shows you around based on what you need
body_shape: B (Semantic Tree)
body_shape_detail: Steps rendered as tree, paths as nested nodes
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Read
  - Bash
---
```

Key design decisions:
- `allowed-tools` includes Read (for CHANGELOG, personality references) and Bash (for check-onboard, check-update)
- No Write/Glob needed -- onboarding doesn't modify files
- Larry's conversational ability handles the interactive flow naturally
- The 7-option intent discovery is a single conversational prompt (Larry asks, user responds, Larry adapts)

### Pattern: additionalContext Injection for Onboarding

When session-start detects FIRST_INSTALL, it injects onboarding context that instructs Larry to run the walkthrough:

```
[MindrianOS Onboarding] First install detected. MindrianOS v{VERSION}. You are Larry.

RUN THE ONBOARDING FLOW:
1. Welcome the user warmly. Use a signature opener.
2. Ask what brings them here (7 options).
3. Based on their answer, present the tailored command workflow.
4. Share 2-3 best practices.
5. Mention optional integrations (light touch).
6. Offer to start their first action or drop to prompt.

The user can skip at any step. If they skip, that's fine -- just show the cold-start command menu.

After onboarding completes or is skipped, run: bash "${CLAUDE_PLUGIN_ROOT}/scripts/check-onboard" --write
```

When session-start detects UPDATE, it injects a lighter context:

```
[MindrianOS Update] Updated from v{PREV} to v{CURR}. You are Larry.

Show what's new since their last version, framed as capabilities.
Then remind them of core features.
After greeting, run: bash "${CLAUDE_PLUGIN_ROOT}/scripts/check-onboard" --write
```

### Pattern: CHANGELOG Parsing for Whats-New

`check-update` already extracts changelog between versions (line 41):

```bash
CHANGELOG_DIFF=$(echo "$REMOTE_CHANGELOG" | \
  sed -n "/^## \[${LATEST_VERSION}\]/,/^## \[${CURRENT_VERSION}\]/p" | head -n -1)
```

For onboarding, the same pattern works on the LOCAL changelog:

```bash
LOCAL_CHANGELOG=$(cat "$PLUGIN_ROOT/CHANGELOG.md")
CHANGELOG_DIFF=$(echo "$LOCAL_CHANGELOG" | \
  sed -n "/^## \[${CURRENT_VERSION}\]/,/^## \[${PREVIOUS_VERSION}\]/p" | head -n -1)
```

Then extract just the `### Added` items for capability framing.

### Recommended File Structure
```
MindrianOS-Plugin/
├── commands/onboard.md          # NEW: /mos:onboard command
├── scripts/check-onboard        # NEW: marker detection script
├── scripts/session-start        # MODIFY: integrate check-onboard in cold-start branch
└── ~/.mindrian-onboarded        # RUNTIME: marker file (user's home dir)
```

### Anti-Patterns to Avoid
- **Don't print onboarding to stderr:** The banner uses stderr for display. Onboarding must go through additionalContext so Larry renders it conversationally.
- **Don't make onboarding blocking:** check-onboard must complete in < 200ms (it's just a file read + version compare). The conversational flow happens in Larry's response, not in the hook.
- **Don't hard-code command lists:** The onboard.md should reference current commands. If commands change, the onboarding prompt adapts.
- **Don't show onboarding when room exists:** Onboarding only triggers in the cold-start (no room) branch. If a room exists, the user is past onboarding.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version comparison | Custom semver parser | `sort -V` (already used in check-update) | Handles all semver correctly, POSIX standard |
| CHANGELOG parsing | Custom markdown parser | `sed` range extraction (already used in check-update) | Proven pattern, handles edge cases |
| Version reading | Direct JSON parsing | `python3 -c "import json; ..."` (already used everywhere) | Consistent with all scripts/ |
| Marker file | JSON/YAML format | Plain text (line 1=version, line 2=date) | Simplest possible format, no parsing deps |

## Common Pitfalls

### Pitfall 1: Hook Timeout
**What goes wrong:** session-start has a 2-second budget. Adding check-onboard could push it over.
**Why it happens:** check-onboard reads a file and calls python3 for version parsing.
**How to avoid:** check-onboard does only file I/O and a sort -V. No network calls. Target < 100ms. The conversational flow happens in Larry's response, not in the hook.
**Warning signs:** session-start taking > 2s in testing.

### Pitfall 2: Marker File Race Condition
**What goes wrong:** If the user kills the session before marker is written, they get onboarding again.
**Why it happens:** Marker is written at end of onboarding (or skip), not at start.
**How to avoid:** This is actually the correct behavior per the spec. "Skipping is never penalized" means re-showing is fine. The marker should only write after completion or explicit skip.
**Warning signs:** Users complaining about repeated onboarding (would indicate a write failure, not a race).

### Pitfall 3: additionalContext Size Budget
**What goes wrong:** Onboarding context eats into the session's context window.
**Why it happens:** Injecting a full walkthrough script + all 5 workflow paths + all commands.
**How to avoid:** Keep injected context concise (< 2000 chars). The full walkthrough logic lives in `commands/onboard.md`, not in the session-start injection. Session-start just says "run the onboarding flow" and gives Larry the key parameters.
**Warning signs:** additionalContext growing beyond 3000 chars for the onboarding case.

### Pitfall 4: Update Detection on First Install
**What goes wrong:** A user who installs v1.5.1 fresh should see FIRST_INSTALL, not UPDATE.
**Why it happens:** No marker file means FIRST_INSTALL (correct). But if somehow a stale marker exists from a previous install attempt...
**How to avoid:** The spec is clear: no marker = FIRST_INSTALL. Marker with older version = UPDATE. This covers both cases correctly.
**Warning signs:** Fresh installs showing "what's new" instead of full onboarding.

### Pitfall 5: Tri-Polar Blindness
**What goes wrong:** Onboarding only works on CLI, not Desktop or Cowork.
**Why it happens:** session-start hook is CLI/Cowork. Desktop uses MCP server.
**How to avoid:** The onboard.md command works on all surfaces (it's a markdown prompt). The auto-trigger via session-start only fires on CLI/Cowork. Desktop users can run /mos:onboard manually. This is acceptable per the spec.
**Warning signs:** Desktop users never seeing onboarding (acceptable for v1 -- manual /mos:onboard is the fallback).

## Code Examples

### check-onboard Output Contract

```bash
# First install (no marker file)
$ bash scripts/check-onboard
FIRST_INSTALL
CURRENT=1.5.1

# After update (marker version < current)
$ bash scripts/check-onboard
UPDATE
PREVIOUS=1.4.0
CURRENT=1.5.1

# Current (marker matches)
$ bash scripts/check-onboard
CURRENT

# Write marker
$ bash scripts/check-onboard --write
# Creates ~/.mindrian-onboarded with:
# 1.5.1
# 2026-03-31
```

### session-start Integration (Cold-Start Branch)

```bash
else
  # Cold start: show De Stijl Mondrian banner
  bash "${SCRIPT_DIR}/banner" "$PLUGIN_VERSION" >&2 2>/dev/null || true

  # Check onboarding status
  ONBOARD_STATUS=$("${SCRIPT_DIR}/check-onboard" 2>/dev/null || echo "CURRENT")
  ONBOARD_TYPE=$(echo "$ONBOARD_STATUS" | head -1)

  if [ "$ONBOARD_TYPE" = "FIRST_INSTALL" ]; then
    context="[MindrianOS Onboarding] First install detected. v${PLUGIN_VERSION}. You are Larry.

Run the full onboarding walkthrough. Ask the user what brings them here (7 options: venture, research, meetings, stakeholders, project mgmt, tour, skip). Based on their answer, present a tailored 3-command workflow, best practices, and optional integrations. The user can skip at any step.

After onboarding completes or is skipped, write the marker:
bash \"${PLUGIN_ROOT}/scripts/check-onboard\" --write

Voice: conversational, direct, signature openers. NO emoji. NO filler.

AFTER onboarding (or skip), show the cold-start command menu."

  elif [ "$ONBOARD_TYPE" = "UPDATE" ]; then
    PREV_VER=$(echo "$ONBOARD_STATUS" | grep "^PREVIOUS=" | cut -d= -f2)
    # Get changelog diff
    CHANGELOG_DIFF=$(sed -n "/^## \[${PLUGIN_VERSION}\]/,/^## \[${PREV_VER}\]/p" "$PLUGIN_ROOT/CHANGELOG.md" | head -n -1 | grep "^- " || echo "")

    context="[MindrianOS Update] v${PREV_VER} -> v${PLUGIN_VERSION}. You are Larry.

Welcome back. Show what's new since v${PREV_VER}, framed as capabilities (not technical changes).

Changes:
${CHANGELOG_DIFF}

Frame each as: 'Since you last checked in, here is what I learned to do:' then list capabilities.
Then show the cold-start command menu as a reminder.

After greeting, write the marker:
bash \"${PLUGIN_ROOT}/scripts/check-onboard\" --write"

  else
    context="[MindrianOS] No room initialized yet. MindrianOS v${PLUGIN_VERSION}. You are Larry. ..."
  fi
fi
```

### onboard.md Command Pattern

```yaml
---
name: onboard
description: Interactive MindrianOS walkthrough -- Larry shows you around based on what you need
body_shape: B (Semantic Tree)
body_shape_detail: Workflow paths as nested tree, tips as list
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Read
  - Bash
---
```

The command handles two modes:
1. `/mos:onboard` -- full interactive walkthrough
2. `/mos:onboard whats-new` -- version-aware changelog display

### Existing Commands Referenced in Workflow Paths

All 52 commands currently registered:

```
Getting Started: new-project, setup, diagnose, help, onboard (NEW)
Working: explore-domains, lean-canvas, think-hats, analyze-needs, explore-trends,
         structure-argument, challenge-assumptions, build-thesis, file-meeting,
         pipeline, reason, beautiful-question, user-needs, build-knowledge,
         explore-futures, macro-trends, analyze-systems, systems-thinking,
         find-bottlenecks, find-connections, analyze-timing, dominant-designs,
         score-innovation, root-cause, map-unknowns, scenario-plan,
         compare-ventures, leadership
Reviewing: status, room, grade, deep-grade, diagnose, suggest-next, visualize
Brain: query, research, find-connections, wiki
Export: export, publish, radar, update
Rooms: rooms
Funding: funding, opportunities, persona
Admin: admin (hidden)
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bash + manual verification (no automated test framework in project) |
| Config file | none |
| Quick run command | `bash scripts/check-onboard && echo "OK"` |
| Full suite command | Manual: install fresh, verify onboarding triggers |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ONBOARD-01 | Marker file detection triggers onboarding | smoke | `rm -f ~/.mindrian-onboarded && bash scripts/check-onboard` | Wave 0 |
| ONBOARD-02 | 7 intent paths produce tailored output | manual-only | Run /mos:onboard, select each option | N/A |
| ONBOARD-03 | Larry voice consistent | manual-only | Review onboard.md prompt text | N/A |
| ONBOARD-04 | Skip writes marker | smoke | `bash scripts/check-onboard --write && cat ~/.mindrian-onboarded` | Wave 0 |
| ONBOARD-05 | Update changelog framing | smoke | `echo "1.0.0\n2026-01-01" > ~/.mindrian-onboarded && bash scripts/check-onboard` | Wave 0 |
| ONBOARD-06 | /mos:onboard works manually | manual-only | Run /mos:onboard in Claude Code | N/A |
| ONBOARD-07 | whats-new subcommand | manual-only | Run /mos:onboard whats-new | N/A |

### Sampling Rate
- **Per task commit:** `bash scripts/check-onboard` (smoke test marker detection)
- **Per wave merge:** Manual walkthrough of all 7 paths
- **Phase gate:** Full manual test of first-install, update, and manual-run flows

### Wave 0 Gaps
- None -- no test framework in project. Validation is bash smoke tests + manual verification, which is the project's existing pattern.

## Open Questions

1. **How should Desktop handle onboarding?**
   - What we know: session-start hook fires on CLI/Cowork only. Desktop uses MCP server.
   - What's unclear: Whether MCP server should detect first-install too.
   - Recommendation: Desktop users run `/mos:onboard` manually. MCP onboarding is a deferred idea (not in scope).

2. **Should check-onboard also handle the warm-start case?**
   - What we know: CONTEXT.md defers warm-start onboarding (room exists but never onboarded).
   - What's unclear: N/A -- explicitly deferred.
   - Recommendation: check-onboard only runs in the cold-start branch. Warm-start is out of scope.

## Sources

### Primary (HIGH confidence)
- `scripts/session-start` -- Full session hook source, lines 1-237
- `scripts/check-update` -- Version comparison pattern, lines 1-52
- `scripts/banner` -- Banner script (fires before onboarding)
- `commands/help.md` -- Command frontmatter + flow grouping pattern
- `commands/update.md` -- CHANGELOG parsing and Larry voice pattern
- `.claude-plugin/plugin.json` -- Version source (1.5.1)
- `CHANGELOG.md` -- Format: `## [X.Y.Z] - YYYY-MM-DD` then `### Added/Fixed/Changed`
- `skills/ui-system/SKILL.md` -- 4-zone anatomy, 5 body shapes, symbol vocabulary, color contract
- `docs/superpowers/specs/2026-03-31-onboarding-system-design.md` -- Full PRD

### Secondary (MEDIUM confidence)
- Existing 52 commands in `commands/` -- verified full list via directory listing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all patterns exist in codebase, zero new dependencies
- Architecture: HIGH -- integration point precisely identified (session-start lines 138-142)
- Pitfalls: HIGH -- hook timeout is well-understood constraint, marker logic is simple
- Voice/UX: MEDIUM -- Larry copy quality depends on prompt engineering in onboard.md

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable -- no external dependencies)
