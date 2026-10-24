---
id: SEED-142
title: "Windows room switch fails: python not on PATH (exit 9009) and backslash paths dropped by bash"
status: open
priority: high
filed: 2026-10-22
planted_during: "Phase 379.1.1 plan 04 (post-beta-73 close-out)"
origin: "the beta.73 release run, navigator report, work item 8 of 379.1.1-CONTEXT.md"
trigger_when: "the next phase that touches scripts/room-registry, lib/core/room-open.cjs or the Windows install path, or any tester report of a Windows room switch failure"
scope: medium
surfaces: [MindrianOS-Plugin]
related: [SEED-117, SEED-013, SEED-128]
promotes_to: "a quick for the path fix, then the python probe"
---

# SEED-142: Windows room switch fails on python and on backslash paths

## As reported

> python not on PATH (exit 9009); backslash paths dropped by bash in the room switch.

Full stderr and the Windows version: not on file at planning time. The main session pastes the verbatim text here before promotion.

## The rule that applies (SEED-117)

SEED-117 sets the rule for a room creation or switch failure. The agent reports the failure verbatim, files the bug and stops. The agent never writes the registry entry by hand. The agent never initialises room.db by hand. The agent never builds a room around the chokepoint. A failed registry call must leave no half-made room.

This seed follows that rule. Nobody patches around the failure on the user machine. The fix goes through GSD.

## Evidence in the code

Line numbers were read from the files on 2026-10-22.

| Claim | File and line | Mark |
|-------|---------------|------|
| The registry path is built with path.join. On Windows this gives backslashes. | lib/core/room-open.cjs line 64 | PROVEN (code read) |
| The switch runs the registry as spawnSync('bash', [REGISTRY_SCRIPT, ...args]). The path goes to bash as an argument. | lib/core/room-open.cjs line 160 | PROVEN (code read) |
| The registry guards a missing python3 only. It prints a message and exits 127. It does not probe python or the py launcher. | scripts/room-registry lines 45 to 48 | PROVEN (code read) |
| The registry calls python3 at many sites (lines 168, 304, 386, 468, 512, and more). A python3 that the Windows PATH does not hold breaks each one. | scripts/room-registry (grep -n python) | PROVEN (code read) |
| The failure helper pythonVersion() in room-open.cjs probes python3 only. | lib/core/room-open.cjs lines 104 to 116 | PROVEN (code read) |
| The report says python. Exit 9009 is the Windows code for a command that is not recognized. | the report and the Windows convention | UNVERIFIED until the stderr is pasted |
| A bash argument that carries a backslash path such as C:\x\y loses the backslashes, because bash reads a backslash as an escape. | the report | UNVERIFIED on this machine (no Windows host here) |

## Fix directions (not a plan)

1. Pass the registry path to bash as a forward-slash path. Or set the working directory to the script folder and pass the path in an environment variable. Never pass a backslash path as a bash argument.
2. Resolve the interpreter by probing python3, python and the py launcher, in that order. Name the one found in the failure message. Name all three as not found when none works.
3. Add a floor check that runs the registry under the oldest supported interpreter (the SEED-117 floor check, extended to Windows).
4. Add a doctor point that names the interpreter and its version.
5. Long term, SEED-013 (remove Python from the user machine) ends the python half. Until it lands, directions 2 to 4 hold.

## Tri-polar

| Surface | Status |
|---------|--------|
| Claude Code CLI on Windows | Affected. The switch runs room-open.cjs, which spawns bash with the backslash path. |
| Claude Desktop on Windows | UNVERIFIED. Depends on whether the MCP rooms tool calls the same room-open.cjs path. |
| Cowork | UNVERIFIED. Depends on the same question, and on the Cowork host shell. |

The fix must prove the CLI row on a Windows host. It must also show, for the Desktop and Cowork rows, either the same code path or a separate pass.

## Canon

Part 8 holds. The fix moves no room data.
