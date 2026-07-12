---
status: resolved
kind: rca
trigger: "intern-w1-rooms-skill-script-path"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: tier-0
canon_parts: []
created: 2026-07-11T00:00:00Z
updated: 2026-07-11T00:20:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

status: FIX APPLIED, self-verified, awaiting human confirmation.

reasoning_checkpoint:
  hypothesis: "11 SKILL.md files (rooms, publish, new-project, setup, room, file-meeting, wiki, vault, ingest-methodology, ignite, export) plus commands/new-project.md document `bash scripts/<name>` as skill-local relative paths; the scripts exist ONLY at the plugin root, so any invocation with cwd != plugin root fails exit 127. Prefixing every call site with `${CLAUDE_PLUGIN_ROOT}/scripts/<name>` (quoted) fixes it because CLAUDE_PLUGIN_ROOT is an environment variable Claude Code's plugin runtime injects, resolvable from any cwd and any subshell, unlike a locally-computed path."
  confirming_evidence:
    - "Debug session's own Evidence (2026-07-11T00:02:00Z): grep across all 121 SKILL.md files found exactly 11 files with the `bash scripts/<name>` pattern, with per-file occurrence counts that match this session's grep output exactly (rooms 25, publish 8, new-project 8, setup 6, room 6, file-meeting 5, wiki 2, vault 1, ingest-methodology 1, ignite 1, export 1 -- 72 lines total)."
    - "Directly read ~38 other SKILL.md files (skills/admin, skills/status, and others) plus hooks/hooks.json, settings.json, .mcp.json and confirmed they all use the identical `\"${CLAUDE_PLUGIN_ROOT}/...\"` quoted-prefix convention already, validated by tests/test-127-00-shim-handshake.sh."
    - "Empirically re-confirmed (this session) that `readlink -f \"$0\"` resolves to the shell binary under the Bash tool, not the SKILL.md's own path -- the broken pattern this fix replaces was never viable."
  falsification_test: "If `${CLAUDE_PLUGIN_ROOT}` were NOT set in the actual skill-invocation environment (e.g. it only exists in interactive top-level Bash tool calls, not when a skill's bash block is dispatched as a subroutine), the fix would not resolve the path either. This session did not directly instrument a live mid-conversation Skill-tool dispatch to confirm CLAUDE_PLUGIN_ROOT survives that exact call path -- it relies on the fact that ~38 sibling SKILL.md files already ship this convention successfully in production, which is strong but indirect evidence."
  fix_rationale: "The fix replaces a relative path that only worked by cwd accident with an absolute path built from a runtime-injected, invocation-context-independent env var -- addressing the root cause (relative-path assumption mismatched to actual repo layout) rather than papering over one call site."
  blind_spots: "Did not test every one of the 72 fixed call sites end-to-end in a live Claude Code session (only a subset spot-checked via grep + manual read); relies on the CLAUDE_PLUGIN_ROOT convention's existing track record across ~38 other files rather than a fresh independent verification of the env var's availability in every dispatch context."

fix applied: bulk regex substitution (`bash scripts/<name>` -> `bash "${CLAUDE_PLUGIN_ROOT}/scripts/<name>"`) across the 11 named SKILL.md files plus commands/new-project.md (72 call sites total, count matches the debug session's own per-file tally exactly). Separately replaced the broken `PLUGIN_ROOT="$(dirname "$(dirname "$(readlink -f "$0")")")"` block in skills/rooms/SKILL.md Step 2.5, skills/new-project/SKILL.md, and commands/new-project.md with direct `${CLAUDE_PLUGIN_ROOT}` usage (plus the same prose fallback convention `skills/admin/SKILL.md` / `skills/status/SKILL.md` already use), including the two downstream `$PLUGIN_ROOT`-referencing `node -e` calls in Step 6.1 of new-project (lines 390/397), which were ALSO broken independent of the `$0` bug since bash variable state does not persist across separate bash code-block invocations -- `${CLAUDE_PLUGIN_ROOT}` as an inherited env var sidesteps that problem too. Fixed `skills/ignite/SKILL.md` line 64's reference to the broken pattern (it named "the new-project.md way" by reference; now points at `${CLAUDE_PLUGIN_ROOT}` directly).

test: verified via grep that zero `bash scripts/` occurrences remain in the 12 fixed files, and zero bare `$PLUGIN_ROOT` references remain; confirmed the per-file replacement counts match the debug session's own evidence exactly (72 total); ran the existing `tests/test-phase-23.sh` suite (16/16 pass, unaffected by these doc-only changes since it drives scripts/ directly, not through SKILL.md prose) as a smoke check that no shipped script behavior regressed.
expecting: matched.
next_action: awaiting human confirmation that a live `/mos:rooms` (and sibling skill) invocation from a non-plugin-root cwd, or as a mid-conversation Skill-tool subroutine dispatch, now succeeds instead of exit 127.

known_out_of_scope_findings (not fixed this pass, flagged per debug file's own "do not silently leave siblings unfixed" instruction):
  - `commands/rooms.md`, `commands/room.md`, `commands/publish.md`, `commands/vault.md`, `commands/wiki.md`, `commands/export.md`, `commands/file-meeting.md`, `commands/ignite.md`, `commands/ingest-methodology.md`, `commands/setup.md` carry the SAME `bash scripts/<name>` pattern (commands/rooms.md alone has 25 occurrences, byte-identical to skills/rooms/SKILL.md). Only commands/new-project.md was in this pass's explicit scope. File a follow-up session for the rest.
  - `skills/scheduled-tasks/SKILL.md`, `skills/scout/SKILL.md`, `commands/scheduled-tasks.md`, `commands/scout.md` also use a `readlink -f "$0"`-based path-resolution pattern (a different shape than the rooms/new-project/ignite one, not verified broken/working this session) -- out of this pass's named scope, flag for a follow-up audit.
  - `commands/ignite.md` line 64 carries the identical broken-pattern reference `skills/ignite/SKILL.md` line 64 had; only the SKILL.md copy was named in scope for this pass.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version observed: v1.15.3-beta.12 (install cache; re-verify against beta.13 dev HEAD per Source-of-Truth Preamble below)
- Target version: v1.15.3-beta.13
- Reported by: filing agent (Larry), first-hand repro during this session - NOT from an intern report
- Date first observed: 2026-07-11
- Related debug sessions: `.planning/debug/intern-qa-week1-bug-sweep.md` (Row H)

## Source-of-Truth Preamble

- CODE claims read against: install cache `~/.claude/plugins/cache/mindrian-marketplace/mos/1.15.3-beta.12/` (where the repro was run) - NOT yet re-verified against `origin/main` HEAD or the dev workspace `/home/jsagi/dev/MindrianOS-Plugin/skills/rooms/SKILL.md`. Since the dev workspace is "the only dev workspace" per this repo's CLAUDE.md, the fix must land there; the repro location (install cache) is read-only evidence, never the edit target.
- WIRE claims probe against: not applicable, no remote server involved.
- Date of audit: 2026-07-11
- Re-verification rule: before filing a fix, confirm `skills/rooms/SKILL.md` in THIS dev workspace (`/home/jsagi/dev/MindrianOS-Plugin/skills/rooms/SKILL.md`) has the same `bash scripts/...` pattern as the install-cache copy that was repro'd - plugin cache and dev workspace can drift (see `docs/autopsies/2026-04-13-wrong-workspace-incident.md`).

## Problem Statement

`skills/rooms/SKILL.md` documents `bash scripts/room-registry <cmd>` (and 4 sibling script invocations) as if `scripts/` is local to the skill directory; it is not - the scripts live only at the plugin root - so any invocation from a cwd other than the plugin root fails with exit 127.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: every `bash scripts/...` command documented in `skills/rooms/SKILL.md` runs successfully regardless of the cwd the skill happens to be invoked from.
actual: `cd ~/.claude/plugins/cache/mindrian-marketplace/mos/1.15.3-beta.12/skills/rooms && bash scripts/room-registry list` fails.
errors: `bash: scripts/room-registry: No such file or directory`, exit code 127.
reproduction:
  1. `cd <plugin-root>/skills/rooms`
  2. `bash scripts/room-registry list`
  3. Observe exit 127 / "No such file or directory".
  4. Contrast: `bash <plugin-root>/scripts/room-registry list` (absolute/root-relative path) succeeds - confirmed same session via `find <plugin-root> -iname "room-registry*"` returning exactly one match, at `<plugin-root>/scripts/room-registry`.
started: unknown - not bisected; likely present since the rooms skill was authored, not a regression from a recent change (no CHANGELOG entry found referencing this path).

## Scope and Impact

- Affected surfaces: cli (confirmed) - Desktop/Cowork use different invocation mechanics, may or may not share this cwd assumption, not yet checked
- Affected commands: every `/mos:rooms` subcommand that shells out (`list`, `new`, `open`, `close`, `archive`, `where`, `git-setup`, `git-status`) - all 5 named scripts (`room-registry`, `resolve-room`, `compute-state`, `update-icm-index`, `git-ops`)
- Affected users: any invocation where the skill's bash blocks run with cwd != plugin root - confirmed to happen at least when the Skill tool is invoked as a subroutine mid-conversation (this session's exact trigger)
- Version range: reproduced on beta.12 install cache; unconfirmed whether beta.13 dev HEAD has already fixed it (check before starting a fix)
- Severity: medium - has a trivial workaround (absolute path) once known, but silently fails otherwise with no guidance in the error message pointing at the real script location
- Blast radius (CONFIRMED, no longer "potentially"): 11 of 121 SKILL.md files use the `bash scripts/...` pattern with no cwd normalization: `rooms` (25 occurrences), `publish` (8), `new-project` (8, duplicated in `commands/new-project.md`), `setup` (6), `room` (6), `file-meeting` (5), `wiki` (2), `vault` (1), `ingest-methodology` (1), `ignite` (1), `export` (1). 8 of these have zero mitigation; 3 (`rooms`, `new-project`, `ignite`) have an attempted mitigation that is itself broken (see Technical Root Cause).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: The dev workspace `skills/rooms/SKILL.md` may have already diverged/been fixed relative to the install-cache copy the repro ran against (Source-of-Truth Preamble's open question).
  evidence: Read the dev workspace file directly (see Evidence 2026-07-11T00:01:00Z) - identical `bash scripts/<name>` pattern present in all 8 subcommands, 25 occurrences, no cd-to-root anywhere. No drift.
  timestamp: 2026-07-11T00:01:00Z

- hypothesis: This defect is unique to `skills/rooms/SKILL.md` and other skills document an explicit cd-to-plugin-root step that rooms is missing.
  evidence: Grepped all 121 SKILL.md files; 11 use the `bash scripts/...` pattern; of those, 8 have zero plugin-root resolution of any kind (same exposure as rooms), and the 3 that attempt one (rooms, new-project, ignite) all use the same broken pattern (see next elimination). None document a working cd-to-root step.
  timestamp: 2026-07-11T00:02:00Z

- hypothesis: The `$PLUGIN_ROOT="$(dirname "$(dirname "$(readlink -f "$0")")")"` pattern already present in `skills/rooms/SKILL.md` Step 2.5 ("new" subcommand) is a working, reusable fix that should be generalized to all `bash scripts/...` call sites.
  evidence: Directly tested via the Bash tool (the actual mechanism skill bash blocks execute through): `$0` resolves to `/bin/bash`, not the SKILL.md path or plugin root; `readlink -f "$0"` yields `/usr/bin/bash`; the computed `PLUGIN_ROOT` is `/usr`, which is wrong on every invocation, not just an edge case. This pattern must not be reused as-is; `${CLAUDE_PLUGIN_ROOT}` (Claude Code's own runtime-provided env var, already used successfully in ~38 other SKILL.md files, hooks.json, and .mcp.json in this repo) is the correct pattern to standardize on instead.
  timestamp: 2026-07-11T00:04:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-11T00:00:00Z
  checked: `cd ~/.claude/plugins/cache/mindrian-marketplace/mos/1.15.3-beta.12/skills/rooms && bash scripts/room-registry list`
  found: "bash: scripts/room-registry: No such file or directory", exit 127
  implication: confirms the documented invocation pattern fails from the skill's own directory.

- timestamp: 2026-07-11T00:00:00Z
  checked: `find ~/.claude/plugins/cache/mindrian-marketplace/mos/1.15.3-beta.12 -iname "room-registry*"`
  found: exactly one match, `<plugin-root>/scripts/room-registry`
  implication: confirms the script exists only at plugin root, never under `skills/rooms/scripts/`; the SKILL.md instructions are not merely stale, the referenced relative path never existed.

- timestamp: 2026-07-11T00:00:00Z
  checked: `bash ~/.claude/plugins/cache/mindrian-marketplace/mos/1.15.3-beta.12/scripts/room-registry set-active jonathan-sagir`
  found: succeeded, printed "jonathan-sagir", confirmed the active-room switch actually took effect (subsequent Edit tool write succeeded where it had been blocked pre-switch)
  implication: the script itself works correctly; the ONLY defect is the path documented in SKILL.md, not the script's logic.

- timestamp: 2026-07-11T00:01:00Z
  checked: Read full `/home/jsagi/dev/MindrianOS-Plugin/skills/rooms/SKILL.md` (dev workspace, not install cache) end to end, 639 lines.
  found: 25 occurrences of `bash scripts/<name>` across all 8 subcommands (list, new, open, close, archive, where, git-setup, git-status) - lines 71, 162, 225, 233, 240, 267, 291, 321, 336, 357, 379, 401, 409, 433, 442, 477, 481, 487, 496, 504, 505, 547, 553, 576, 593. Pattern is byte-identical in kind to the install-cache repro. No `cd` to plugin root anywhere in the routing section or per-subcommand steps.
  implication: RESOLVES the Source-of-Truth Preamble's open question - the dev workspace is NOT drifted from the install cache on this defect. The fix target (dev workspace) has the same bug as the repro location (install cache). Safe to file the fix against this file.

- timestamp: 2026-07-11T00:02:00Z
  checked: `grep -rn "bash scripts/" skills/*/SKILL.md | awk -F: '{print $1}' | sort | uniq -c` across all 121 SKILL.md files in the repo.
  found: 11 of 121 SKILL.md files use the `bash scripts/<name>` pattern: rooms (25 occurrences), publish (8), new-project (8), setup (6), room (6), file-meeting (5), wiki (2), vault (1), ingest-methodology (1), ignite (1), export (1).
  implication: CONFIRMS this is a systemic repo-wide doc-authoring defect, not isolated to skills/rooms/SKILL.md. 10 sibling skills carry the same class of bug and are unfixed. Matches Current Focus's "expecting" from the draft.

- timestamp: 2026-07-11T00:03:00Z
  checked: grepped the 11 affected files for `PLUGIN_ROOT|cd .*scripts|CLAUDE_PLUGIN_ROOT|cd \$` to see which ones attempt any cwd/root normalization.
  found: only `skills/rooms/SKILL.md` (Step 2.5, line 172), `skills/new-project/SKILL.md` (line 232, identical duplicate in `commands/new-project.md` line 232), and `skills/ignite/SKILL.md` (line 64, references the same pattern by name: "Resolve PLUGIN_ROOT the new-project.md way") attempt ANY plugin-root resolution, and all three use the identical line: `PLUGIN_ROOT="$(dirname "$(dirname "$(readlink -f "$0")")")"`. The other 8 files (publish, setup, room, file-meeting, wiki, vault, ingest-methodology, export) have ZERO plugin-root resolution attempt anywhere - fully exposed to the same `bash scripts/...` cwd-dependent failure with no partial mitigation at all.
  implication: the "partial fix" the draft found in Step 2.5 has already been copy-pasted into 2 other files (new-project, ignite) - meaning if that pattern is broken, the defect has already propagated, not just been left unaddressed.

- timestamp: 2026-07-11T00:04:00Z
  checked: empirically tested `PLUGIN_ROOT="$(dirname "$(dirname "$(readlink -f "$0")")")"` by running `echo "0=$0"; readlink -f "$0"` directly via the Bash tool (the same invocation mechanism a skill's bash code block executes through - Claude Code's Bash tool runs the block as a shell command string, it does not execute SKILL.md as a positional script file).
  found: `$0` = `/bin/bash`; `readlink -f "$0"` = `/usr/bin/bash`. Therefore `PLUGIN_ROOT` computes to `dirname(dirname(/usr/bin/bash))` = `/usr` - not the plugin root, not even close.
  implication: CRITICAL CORRECTION to the draft. The Step 2.5 `$PLUGIN_ROOT` pattern the draft flagged as a candidate to "reuse or generalize... for all subcommands" is ITSELF BROKEN, unconditionally, under the real execution mechanism - not merely "unreliable" or edge-case-fragile as the draft speculated, but wrong on every invocation. It must NOT be reused as-is. This also means Step 2.5 (ICM Layer 0/1 auto-generation, `cp "$PLUGIN_ROOT/templates/icm/CLAUDE.md" ...`) is independently broken today (silently tries to copy from `/usr/templates/icm/CLAUDE.md`, which does not exist, so the cp silently no-ops or errors) - a second, related but distinct defect in the same file, out of scope for this session's Problem Statement but worth flagging.

- timestamp: 2026-07-11T00:05:00Z
  checked: `grep -rln "CLAUDE_PLUGIN_ROOT" skills/*/SKILL.md`, `hooks/hooks.json`, `settings.json`, and `tests/test-127-00-shim-handshake.sh`.
  found: `${CLAUDE_PLUGIN_ROOT}` is the established, working, repo-wide convention for plugin-root resolution - used in ALL of `hooks/hooks.json`'s hook commands, `settings.json`'s statusline command, `.mcp.json`'s server args (validated by `tests/test-127-00-shim-handshake.sh` Test 4 and Test 6), and ~38 other SKILL.md files including `skills/admin/SKILL.md`, `skills/graph/SKILL.md`, `skills/status/SKILL.md`, `skills/present/SKILL.md`, and more. Two of these (`skills/admin/SKILL.md` line 114, `skills/status/SKILL.md` line 68) even document an explicit fallback: "If `CLAUDE_PLUGIN_ROOT` is not set, resolve the script relative to the plugin's installed location." A web search confirms `${CLAUDE_PLUGIN_ROOT}` is Claude Code's own documented, runtime-provided env var for exactly this purpose.
  implication: ANSWERS task item 3 - the existing Step 2.5 `readlink -f "$0"` pattern is NOT the right pattern to reuse/generalize; `${CLAUDE_PLUGIN_ROOT}` is. It is already proven working across dozens of sibling skills in this exact repo, which de-risks the eventual fix considerably (no new mechanism needed, just apply the existing convention to the 11 non-compliant files).

## Technical Root Cause

CONFIRMED (dev workspace verified directly, systemic scope measured, proposed fix pattern empirically corrected):

`skills/rooms/SKILL.md` documents `bash scripts/<name>` for all 5 script invocations across all 8 subcommands, written as skill-relative paths, but every one of those scripts lives only at `<plugin-root>/scripts/<name>`, never under `skills/rooms/scripts/`. The instructions have no explicit `cd` to plugin root and no absolute-path fallback, so they only work by accident when cwd already happens to be the plugin root at invocation time.

- Site: `skills/rooms/SKILL.md` (all `bash scripts/...` lines across subcommands: list, new, open, close, archive, where, git-setup, git-status) - CONFIRMED identical in dev workspace (`/home/jsagi/dev/MindrianOS-Plugin/skills/rooms/SKILL.md`, 25 occurrences), not just the install-cache repro location.
- Cause: relative path assumption (`scripts/` = skill-local) does not match the actual repo layout (`scripts/` = plugin-root-only); no cwd normalization documented.
- Why it surfaces now: triggered when the skill's bash blocks execute with cwd != plugin root, e.g. when the Skill tool is invoked as a subroutine mid-session rather than as a fresh top-level command from the plugin root.
- **Systemic, not isolated (CONFIRMED):** 11 of 121 SKILL.md files use the same `bash scripts/<name>` pattern: `rooms`, `publish`, `new-project`, `setup`, `room`, `file-meeting`, `wiki`, `vault`, `ingest-methodology`, `ignite`, `export`. 8 of these 11 have ZERO plugin-root resolution of any kind. The other 3 (`rooms`, `new-project`, `ignite`) attempt a resolution, but it is broken (next point).
- **Correction to the draft's proposed reuse target (CONFIRMED via direct test):** the `PLUGIN_ROOT="$(dirname "$(dirname "$(readlink -f "$0")")")"` pattern in `skills/rooms/SKILL.md` Step 2.5 (also duplicated in `skills/new-project/SKILL.md` / `commands/new-project.md`, and referenced by name in `skills/ignite/SKILL.md`) does NOT work under the actual invocation mechanism. Claude Code's Bash tool executes a skill's bash block as a shell command string (not as an executed script file at the SKILL.md's own path), so `$0` is always `/bin/bash` (the shell binary), never the SKILL.md path. `readlink -f "$0"` therefore resolves to `/usr/bin/bash`, and the computed `PLUGIN_ROOT` is `/usr` - wrong on every single invocation, not an edge case. This is a second, independently-broken defect co-located in the same file (affects Step 2.5's `cp "$PLUGIN_ROOT/templates/icm/..."` calls), and it has already been copy-pasted into 2 other skills.
- **The correct, already-proven-working convention (CONFIRMED):** `${CLAUDE_PLUGIN_ROOT}` is Claude Code's own runtime-provided environment variable for exactly this purpose. It is already used successfully in `hooks/hooks.json` (every hook command), `settings.json` (statusline), `.mcp.json` server args (verified by `tests/test-127-00-shim-handshake.sh`), and ~38 other SKILL.md files in this repo (`skills/admin`, `skills/graph`, `skills/status`, `skills/present`, and more). Two of those (`admin`, `status`) even document a fallback for when it's unset. This is the pattern the fix should standardize on - not the broken `readlink -f "$0"` pattern.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1 (CORRECTED from draft - do not reuse the Step 2.5 pattern, it is independently broken):
  - Location: `skills/rooms/SKILL.md`, all 25 `bash scripts/<name> ...` lines across the 8 subcommands (lines 71, 162, 225, 233, 240, 267, 291, 321, 336, 357, 379, 401, 409, 433, 442, 477, 481, 487, 496, 504, 505, 547, 553, 576, 593).
  - Current behavior: documents `bash scripts/<name> <args>`, implicitly relative to an assumed cwd.
  - Required behavior: prefix every invocation with `${CLAUDE_PLUGIN_ROOT}`, the already-proven-working, Claude Code-provided plugin-root env var (see Technical Root Cause) - e.g. `bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" list`. This is the SAME convention ~38 other SKILL.md files, hooks.json, and .mcp.json already use successfully in this repo; do not invent a new mechanism and do NOT reuse the `readlink -f "$0"` pattern from Step 2.5 (confirmed broken, resolves to `/usr`).
  - Also required: fix (or remove) the broken `PLUGIN_ROOT="$(dirname "$(dirname "$(readlink -f "$0")")")"` block at Step 2.5 itself (line 172) - replace with `${CLAUDE_PLUGIN_ROOT}` (with the fallback pattern `skills/admin/SKILL.md`/`skills/status/SKILL.md` already document, in case it's ever unset). This block currently silently no-ops/fails its `cp` calls since `$PLUGIN_ROOT` resolves to `/usr`.
  - Consider: match the fallback-documentation style already used in `skills/status/SKILL.md` line 68 ("If `CLAUDE_PLUGIN_ROOT` is not set, resolve the script relative to the plugin's installed location") so `skills/rooms/SKILL.md` behaves consistently with the rest of the repo's skills.
  - Long-term fix: apply the same `${CLAUDE_PLUGIN_ROOT}` correction to the other 10 affected files - `skills/publish/SKILL.md` (8 occurrences), `skills/new-project/SKILL.md` + `commands/new-project.md` (8 occurrences each, duplicated, ALSO has the same broken Step 2.5-style PLUGIN_ROOT block), `skills/setup/SKILL.md` (6), `skills/room/SKILL.md` (6), `skills/file-meeting/SKILL.md` (5), `skills/wiki/SKILL.md` (2), `skills/vault/SKILL.md` (1), `skills/ingest-methodology/SKILL.md` (1), `skills/ignite/SKILL.md` (1, also references the broken pattern by name and should be corrected in the same pass), `skills/export/SKILL.md` (1). Candidate for a documented pattern in a skills-authoring guide so this class of bug does not recur in future skills.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: a new or existing test under `tests/` covering `skills/rooms/SKILL.md` script invocations (check for an existing `tests/run-all-*.sh` covering the rooms skill first, per Reuse Before Build)
  - Given: cwd is NOT the plugin root (e.g. a subdirectory, or the skill invoked as a subroutine)
  - When: any `/mos:rooms` subcommand's underlying script is invoked per SKILL.md's documented pattern
  - Then: the invocation succeeds (exit 0), not exit 127
  - Runner registration: register in the Feynman runner / relevant `tests/run-all-*.sh` if one exists for this phase area

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add a Fixed entry under v1.15.3-beta.13.
- Release lockstep: standard fix, no version-number-specific concern beyond the normal 5-place lockstep if this ships in beta.13.
- Canon: none directly touched (not a Brain-boundary, Tri-Polar-surface, or Part-11 CIRS concern) - a doc/script-path fix only.
- No em-dashes: confirm the CHANGELOG entry and any SKILL.md edit stay hyphen-only per repo convention.
- Reuse before build: the fix should REUSE the `$PLUGIN_ROOT` resolution pattern already present in SKILL.md's own `new` subcommand (Step 2.5) rather than inventing a new mechanism - flag if that pattern itself turns out to be broken/unreliable, since this repro shows at least one invocation path bypasses it entirely.
- knowledge-base.md: add summary block on resolve; explicitly note if the repo-wide audit (Current Focus next_action) finds this pattern in other skills too - file follow-up sessions for each, do not silently leave siblings unfixed.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: CONFIRMED. `skills/rooms/SKILL.md` (dev workspace, verified no drift from install-cache repro) documents all 5 rooms scripts as `bash scripts/<name> ...` across all 8 subcommands (25 call sites), written as skill-relative paths, but the scripts live only at `<plugin-root>/scripts/<name>`; there is no cwd normalization, so any invocation with cwd != plugin root fails exit 127. This is systemic: 11 of 121 SKILL.md files share the identical `bash scripts/...` pattern (rooms, publish, new-project, setup, room, file-meeting, wiki, vault, ingest-methodology, ignite, export), 8 with zero mitigation. The 3 that attempt a fix (rooms Step 2.5, new-project, ignite) all use `PLUGIN_ROOT="$(dirname "$(dirname "$(readlink -f "$0")")")"`, which is itself broken - empirically confirmed `$0` resolves to `/bin/bash` under the Bash tool (the real invocation mechanism), computing `PLUGIN_ROOT=/usr`, wrong on every call. The correct, already-proven convention in this repo is `${CLAUDE_PLUGIN_ROOT}` (Claude Code's own runtime-provided env var), already used successfully by hooks.json, .mcp.json, and ~38 other SKILL.md files.
fix: APPLIED. Prefixed all 72 `bash scripts/<name>` call sites across the 11 named SKILL.md files plus commands/new-project.md with `"${CLAUDE_PLUGIN_ROOT}/scripts/<name>"` (quoted) via a scoped regex substitution (`bash scripts/([A-Za-z0-9_.-]+)` -> `bash "${CLAUDE_PLUGIN_ROOT}/scripts/\1"`), verified the per-file counts matched this debug session's own evidence exactly (rooms 25, publish 8, new-project 8, setup 6, room 6, file-meeting 5, wiki 2, vault 1, ingest-methodology 1, ignite 1, export 1, commands/new-project.md 8). Replaced the broken `PLUGIN_ROOT="$(dirname "$(dirname "$(readlink -f "$0")")")"` block in `skills/rooms/SKILL.md` Step 2.5, `skills/new-project/SKILL.md`, and `commands/new-project.md` with direct `${CLAUDE_PLUGIN_ROOT}` usage plus the admin/status-style prose fallback note; also fixed the two downstream `$PLUGIN_ROOT`-referencing `node -e` calls in new-project's Step 6.1 (lines 390/397 in the skill, 389/396 in the command) to reference `${CLAUDE_PLUGIN_ROOT}` directly, since a locally-assigned bash variable does not persist across separate bash code-block invocations even setting the `$0` bug aside. Fixed `skills/ignite/SKILL.md` line 64's by-name reference to the broken pattern.
verification: grep-confirmed zero remaining `bash scripts/` and zero remaining bare `$PLUGIN_ROOT` references in all 12 touched files; `bash -n` syntax-checked scripts/resolve-room (touched for the sibling debug session, unaffected by this doc-only fix); ran `tests/test-phase-23.sh all` (16/16 pass) as a regression smoke check. No live end-to-end Claude Code session re-run yet -- awaiting human confirmation (see Current Focus next_action).
files_changed:
  - skills/rooms/SKILL.md
  - skills/publish/SKILL.md
  - skills/new-project/SKILL.md
  - skills/setup/SKILL.md
  - skills/room/SKILL.md
  - skills/file-meeting/SKILL.md
  - skills/wiki/SKILL.md
  - skills/vault/SKILL.md
  - skills/ingest-methodology/SKILL.md
  - skills/ignite/SKILL.md
  - skills/export/SKILL.md
  - commands/new-project.md
  - CHANGELOG.md
commits: [] (not committed per session instructions -- STOP at human-verify checkpoint)
