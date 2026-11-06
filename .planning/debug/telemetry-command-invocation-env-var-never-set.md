---
status: resolved-handed-off
kind: rca
trigger: "telemetry-command-invocation-env-var-never-set"
issue_id: "B15"
severity: low
surfaces: [cli]
brain_mode: full-loop
canon_parts: [8]
created: 2026-11-06T00:00:00Z
updated: 2026-11-06T00:00:00Z
---

## Current Focus

verdict: NO SIGNAL

hypothesis: The command_invocation hook is dead. It is wired to a tool name (SlashCommand) that the host documentation does not list, and it reads 3 environment variables that no code and no host documentation sets.
test: Read the official hooks and tools reference, grep the repository for setters, run the script with stdin only and with the variable set.
expecting: A skip with stdin only and an emit only when a test sets the variable by hand.
next_action: Tasks 2 and 3 of plan 386-17 are skipped. Phase 385 plan 385-11 (item 4, SlashCommand telemetry) unwires the hook. No product change in plan 386-17.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release (worktree of the dev workspace)
- Plugin version: not relevant (script unchanged since phase 121-03)
- Reported by: auditor finding B15 (AUDITOR-FINDINGS-source.md section B)
- Date first observed: 2026-11-06
- Related debug sessions: none. Related plan: 385-11 (unwires the hook entry; planned, not yet executed when this RCA was written)

## Source-of-Truth Preamble

- CODE claims read against: branch main of the release worktree @ e155a9bfd
- WIRE claims probe against: official Claude Code docs at https://code.claude.com/docs/en/hooks.md and https://code.claude.com/docs/en/tools-reference.md, fetched 2026-11-06
- Date of audit: 2026-11-06
- Re-verification rule: the code claims below were read from the working tree at the sha above.

## Problem Statement

scripts/telemetry-command-invocation.cjs only emits when the environment variable CLAUDE_TOOL_COMMAND starts with `/mos:`. Nothing sets that variable, so the hook skips on every call.

## Symptoms

expected: A command_invocation row for each /mos: command call (the script header says the host sets the variables).
actual: Every real call is skipped. A row appears only when a test sets the variable by hand.
errors: none (the script exits 0 by design)
reproduction:
  1. Run the script with a PostToolUse-shaped stdin JSON for tool SlashCommand and no CLAUDE_TOOL_COMMAND, with HOME set to a temporary directory.
  2. Count files under the temporary HOME.
  3. Repeat with CLAUDE_TOOL_COMMAND=/mos:example.
started: phase 121-03 (the header states a host contract that was never verified)

## Scope and Impact

- Affected surfaces: cli only (hook)
- Affected commands: none; telemetry rows never written
- Affected users: all installs (a Node process starts per matching call and writes nothing)
- Version range: since phase 121-03
- Severity: low
- Blast radius: docs/TELEMETRY-SCHEMA.md line 218 repeats the claim; plan 385-11 owns that edit.

## Eliminated

- hypothesis: The host passes the command on stdin to a PostToolUse hook for the SlashCommand tool.
  evidence: The hooks reference lists no SlashCommand tool. The tools reference has no SlashCommand row (grep count 0 in both pages). The PostToolUse stdin fields are session_id, transcript_path, cwd, permission_mode, hook_event_name, tool_name, tool_input, tool_response, tool_use_id, duration_ms.
  timestamp: 2026-11-06T00:00:00Z
- hypothesis: Another file in the repository sets CLAUDE_TOOL_COMMAND, CLAUDE_TOOL_OUTCOME or CLAUDE_TOOL_DURATION_MS.
  evidence: grep of .cjs, .js, .json and .sh files outside node_modules and .planning found hits only in the script itself and in tests/test-121-03-command-invocation-hook.cjs, which sets them for the child process by hand. Setters in the product: 0.
  timestamp: 2026-11-06T00:00:00Z

## Evidence

- timestamp: 2026-11-06T00:00:00Z
  checked: hooks/hooks.json PostToolUse entry
  found: group with matcher `SlashCommand` runs `node "${CLAUDE_PLUGIN_ROOT}/scripts/telemetry-command-invocation.cjs"`, timeout 5.
  implication: PROVEN. The hook starts only for a tool named SlashCommand.
- timestamp: 2026-11-06T00:00:00Z
  checked: Hooks reference, "Common input fields" and "PostToolUse input" (https://code.claude.com/docs/en/hooks.md)
  found: Hook input arrives as JSON on stdin. The documented hook environment variables are CLAUDE_PROJECT_DIR, CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA, CLAUDE_ENV_FILE (some events only), CLAUDE_EFFORT, CLAUDE_CODE_REMOTE. The page names no CLAUDE_TOOL_COMMAND, CLAUDE_TOOL_OUTCOME or CLAUDE_TOOL_DURATION_MS.
  implication: PROVEN from the docs. The host sets none of the 3 variables the script reads. (CLAUDE_SESSION_ID is also not documented; the stdin field is session_id.)
- timestamp: 2026-11-06T00:00:00Z
  checked: Hooks reference, UserPromptExpansion section; tools reference, Skill row
  found: A command the user types fires the event UserPromptExpansion (fields command_name, command_args, expansion_type, prompt), and a PreToolUse hook on the Skill tool "fires only when Claude calls the tool". The page says typing /skillname bypasses PreToolUse. The tools reference lists the tool `Skill` and no `SlashCommand`.
  implication: PROVEN from the docs. There is a real signal for slash commands, but on other events and tool names than the ones the hook uses. The hook as wired has no signal.
- timestamp: 2026-11-06T00:00:00Z
  checked: Run of the script, node v22.23.1, HOME set to a temporary directory under the session scratchpad
  found: Arm A (stdin JSON with tool_input.command=/mos:example, no environment variable): exit 0, 0 files written, processInvocation() returns skipped. Arm B (CLAUDE_TOOL_COMMAND=/mos:example): exit 0, 1 file written.
  implication: PROVEN. The script reads only the environment, so the stdin signal is ignored and the hook is dead in a real session.

## Technical Root Cause

- Site: scripts/telemetry-command-invocation.cjs function `processInvocation` (read of process.env.CLAUDE_TOOL_COMMAND) and hooks/hooks.json PostToolUse group with matcher `SlashCommand`.
- Cause: The script and its header assume a host contract (3 environment variables, a SlashCommand tool) that the official documentation does not state. The matcher names a tool that is not in the documented tool list.
- Why it surfaces now: the auditor asked for the host contract. Phase 121-03 never verified it.

Verdict reasoning: the verdict is NO SIGNAL because the wired hook has no signal. A repair would need a new event wiring (UserPromptExpansion for typed commands and a Skill matcher for model calls), a new hook entry, a changed hook budget and a new test of the live host. That is new product behaviour and a different decision, not a read-the-field fix. It would also reverse Phase 385 item 4. Recorded here as an option for the owner, not planned.

## Required Code Changes

- None in plan 386-17.
- Hand-off: Phase 385 plan 385-11 unwires the PostToolUse SlashCommand entry and updates docs/TELEMETRY-SCHEMA.md line 218. Plan 385-11 should also correct the script header comment, or leave the script as is, per its own scope (script and event schema stay).

## Tests to Add or Update

- None. Tasks 2 and 3 of plan 386-17 are skipped (verdict NO SIGNAL). tests/test-121-03-command-invocation-hook.cjs stays as is.

## Non-Code Follow-ups

- Phase 385 plan 385-11 executes the unwire.
- Option for the owner (UNVERIFIED on a live host): if command telemetry is wanted, wire a UserPromptExpansion hook (command_name) and a Skill-tool PostToolUse hook (tool_input) and cover it with a live-host probe first.
- CHANGELOG.md and knowledge-base.md are owned by plan 386-21.

## Resolution

root_cause: The hook reads 3 environment variables and matches a tool name (SlashCommand) that the official Claude Code documentation does not provide. The host gives hook data on stdin, and slash commands arrive on the UserPromptExpansion event or the Skill tool, not through this hook.
fix: None in plan 386-17. Handed to Phase 385 plan 385-11 (unwire).
verification: Script run with stdin only wrote 0 files and returned skipped. Script run with the variable set by hand wrote 1 file. Docs grep shows no SlashCommand tool and no CLAUDE_TOOL_* variable. No product file changed (git diff of scripts/telemetry-command-invocation.cjs and hooks/hooks.json is empty).
files_changed:
  - .planning/debug/telemetry-command-invocation-env-var-never-set.md (this RCA only)
commits: see plan 386-17 SUMMARY
