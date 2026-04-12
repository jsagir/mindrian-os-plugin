---
phase: 78-mos-vault-command-linkify
plan: 02
subsystem: slash-commands
tags: [vault, obsidian, linkify, cli-routing, wiki-08]
requires: [78-01]
provides: ["/mos:vault command", "/mos:room linkify subcommand", "CLI routing for vault pipeline"]
affects: [commands/vault.md, commands/room.md, bin/mindrian-tools.cjs]
tech-stack:
  added: []
  patterns: [execFileSync-forwarding, stdio-inherit, orchestrator-as-single-source-of-truth]
key-files:
  created:
    - commands/vault.md
    - .planning/phases/78-mos-vault-command-linkify/deferred-items.md
  modified:
    - commands/room.md
    - bin/mindrian-tools.cjs
decisions:
  - "Both /mos:vault and /mos:room linkify resolve to the same orchestrator (single source of truth)"
  - "Linkify auto-appends --in-place so users never have to remember the flag"
  - "Warning prompts before mutation on both in-place surfaces"
metrics:
  duration: "~10min"
  completed: 2026-04-12
---

# Phase 78 Plan 02: MOS Vault Command + Linkify Wiring Summary

Wired the Phase 78-01 orchestrator into user-facing surfaces via three surgical edits -- a new /mos:vault slash command, a new linkify subcommand on /mos:room, and two routing cases in bin/mindrian-tools.cjs.

## Final Slash Command Surface

**/mos:vault** (new)
- Default: export active/named room to ~/MindrianRooms-Vaults/ (or --path override)
- --in-place: alias to /mos:room linkify with warning prompt

**/mos:room linkify** (new subcommand)
- Warns before mutation
- Invokes `node bin/mindrian-tools.cjs room linkify [room]`
- Router auto-appends `--in-place` and forwards to vault-export-orchestrator.cjs

## CLI Routing (bin/mindrian-tools.cjs)

Two new switch cases added:

1. `case 'vault'` (top-level): forwards `argv.slice(1)` to vault-export-orchestrator.cjs via `execFileSync(process.execPath, [orchestrator, ...forwarded], { stdio: 'inherit' })`.

2. `case 'linkify'` (nested under `case 'room'`): auto-appends `--in-place` to `argv.slice(2)` so users running `room linkify` or `room linkify <name>` always land in linkify mode.

USAGE string updated with both new entries. `path` and `execFileSync` added to top-of-file requires.

## Smoke Tests

- `node -c bin/mindrian-tools.cjs`: passed (SYNTAX_OK)
- `grep` verification: vault.md contains `mindrian-tools.cjs vault`; room.md contains `## Subcommand: linkify` and `mindrian-tools.cjs room linkify`; zero em-dashes in either file.

Full end-to-end smoke against a test room was not executed in this plan because `lib/core/lazygraph-ops.cjs` (dependency of graph-ops.cjs loaded at top of mindrian-tools.cjs) throws MODULE_NOT_FOUND at runtime from a pre-existing broken require. This is out of scope for Plan 78-02 (routing-only) and is logged in `deferred-items.md`. The orchestrator itself (invoked directly as `node scripts/vault-export-orchestrator.cjs`) is unaffected and was validated in Plan 78-01.

## UX Decisions

1. **Linkify warning copy**: explicit "not reversible via this command" language, requires y/N confirmation. Conservative tone since mutation is irreversible.
2. **Vault --in-place alias**: mirrors /mos:room linkify exactly rather than duplicating the warning UX. Users can enter linkify from either slash command.
3. **Shape E Mini Report**: confirmation output on both surfaces uses the same 4-zone body shape (action summary + intelligence + footer actions).
4. **Larry voice observation**: both commands end with a structural comment ("wikilinks injected across X references"), not a completion echo.

## Deviations from Plan

### Out-of-scope defer

**Pre-existing lazygraph-ops missing module**
- Found when running `node bin/mindrian-tools.cjs` end-to-end
- Error: `MODULE_NOT_FOUND` from `lib/core/lazygraph-ops.cjs:19` -> propagates through `graph-ops.cjs` -> top-level require in mindrian-tools.cjs
- Not caused by Plan 78-02 changes. Logged to `deferred-items.md`.
- Scope boundary: Plan 78-02 is routing-only. Fixing an unrelated missing dependency in graph-ops dependency chain is out of scope per SCOPE BOUNDARY rule.

No other deviations. Rules 1-3 were not triggered by anything within plan scope.

## Commits

- `afe024e` feat(78-02): route vault + room linkify through mindrian-tools.cjs
- `ea1fd3c` feat(78-02): add /mos:vault command and /mos:room linkify subcommand

## Self-Check: PASSED

- [x] commands/vault.md exists (found)
- [x] commands/room.md contains `## Subcommand: linkify` (found)
- [x] commands/room.md contains `mindrian-tools.cjs room linkify` (found)
- [x] bin/mindrian-tools.cjs syntax-valid (node -c OK)
- [x] bin/mindrian-tools.cjs USAGE contains `vault [room]` line (found at line 67)
- [x] Commit afe024e exists in git log
- [x] Commit ea1fd3c exists in git log
- [x] Zero em-dashes in vault.md or room.md
