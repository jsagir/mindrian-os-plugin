---
phase: quick-260723-0de
plan: 01
subsystem: room-registry
tags: [room-registry, path-resolution, false-orphan, hardening, tdd]
requires: [scripts/room-registry bootstrap-missing 3-tier precedent]
provides: [read/list path_exists disk cross-check, 3-tier path resolution in reporting]
affects: [/mos:rooms, navigator room-status reporting]
tech-stack:
  added: []
  patterns: [output-only hardening, disk cross-check via os.path.isdir, port-proven-logic]
key-files:
  created: [tests/test-room-registry-path-resolution.cjs]
  modified: [scripts/room-registry]
decisions:
  - "Fill path only when the stored value is missing/empty; a non-empty stored path passes through byte-unchanged"
  - "Emit path_exists computed from the filesystem so callers read disk-truth instead of inferring existence from key presence"
metrics:
  duration: ~10m
  completed: 2026-07-23
commit: b0dfe462
---

# Quick 260723-0de: Harden room-registry read/list against a missing path field Summary

Ported the production-proven 3-tier path-resolution logic from the `bootstrap-missing` stanza into what `room-registry read` and `list` REPORT, plus a new `path_exists` filesystem cross-check, so a registry entry lacking a `path` key can never again be misread as an orphaned or never-built room.

## What Changed

### `scripts/room-registry` -- `read` stanza (python block, ~lines 202-233)
- Added a `resolve_room_path(entry, slug, home)` helper that ports the exact 3-tier precedence from the `bootstrap-missing` heredoc: (1) `entry.abs_path` if set; (2) the stored `path` (absolute passthrough, else `os.path.join(home, path)`); (3) `os.path.join(home, slug)` when neither is set.
- `home` is interpolated from `$ROOMS_HOME` and wrapped in the existing `normwin()` shim (no-op on Linux, correct on Git Bash Windows), matching how `$REGISTRY_FILE` is already handled.
- Builds an output copy `dict(room)`; sets `path` to the resolved absolute location ONLY when the stored `path` is missing/empty; always adds `path_exists = os.path.isdir(normwin(resolved))`.
- The unknown-name branch (`{}` + exit 1) is byte-unchanged.

### `scripts/room-registry` -- `list` stanza (python block, ~lines 245-275)
- Same `resolve_room_path` helper and `home` derivation.
- Replaced `'path': room.get('path', '')` with fill-only-when-missing (`stored_path if stored_path else resolved`) and appended a `'path_exists'` key to each row. All other emitted fields are unchanged.

Neither block gains any write to `registry.json` (no `open(..., 'w')`, no tmp+rename). This is read-only hardening of what the commands REPORT.

### `tests/test-room-registry-path-resolution.cjs` (new, 188 lines)
Hermetic coverage via `spawnSync('bash', [REGISTRY_SCRIPT, ...])` with `MINDRIAN_ROOMS_HOME` pointed at a fresh temp home, following the `test-room-registry-windows-path.cjs` harness pattern. Fixtures touch the `.bootstrap-127.3-done` sentinel so the retro-bootstrap auto-trigger stays inert.
- Case a (stored path valid): `read`/`list` emit `path` byte-unchanged (`my-foo`) with `path_exists: true`.
- Case b (path missing, dir exists): derived absolute `home/ghost-built` with `path_exists: true`.
- Case c (path missing, nothing on disk): derived absolute `home/ghost-empty` with `path_exists: false`.
- Case d (unknown name): prints `{}`, exits 1, unchanged.
- Case e (read-only guarantee): `registry.json` bytes byte-identical before/after read/list; path-less entries stay path-less on disk.

## RED-then-GREEN Evidence

- **RED** (unmodified script): 15/25 PASS, 10 FAIL. Cases a (path passthrough) and d passed; every `path_exists` assertion and the case b/c resolution assertions failed (`path_exists=undefined`, `path=undefined`/empty). Case e passed because the unmodified script already never writes. This is the proof the test detects the bug.
- **GREEN** (after read/list edits): 25/25 PASS.

## Gate Results

| Gate | Command | Result |
|------|---------|--------|
| Syntax | `bash -n scripts/room-registry` | OK |
| Windows-path regression | `node tests/test-room-registry-windows-path.cjs` | 25/25 PASS (all subcommands + normwin shim untouched) |
| New suite | `node tests/test-room-registry-path-resolution.cjs` | 25/25 PASS |
| Em-dash scan | `grep` hex `\xe2\x80\x94` over both files | zero matches |
| Change set | `git diff --stat` for the commit | exactly scripts/room-registry (read+list hunks @@ -202 and @@ -224) + new test file |

## Deviations from Plan

None - plan executed exactly as written.

## Scope Compliance

- Touched ONLY the `read` and `list` python blocks; `create`, `update`, `set-active`, `archive`, `get-active`, `git-config`, `bootstrap-missing` all byte-unchanged (windows-path lifecycle suite green proves it).
- No `commands/rooms.md`, no `lib/mcp/tool-router.cjs` (today's separate c123f3d7 fix untouched).
- No version bump, no CHANGELOG entry, no worktree.
- Pre-existing unrelated working-tree changes (SEED-072, `.planning/debug/*`, `graphify-out/`) were left untouched and NOT staged.

## Threat Model Compliance

- T-0DE-01 (Tampering, output-only): mitigated - case e asserts registry.json bytes identical before/after read/list.
- T-0DE-02 (Spoofing, derived guess): mitigated - `path_exists:false` explicitly marks a derived value as unverified.
- T-0DE-03 / T-0DE-SC: accepted as planned (local paths only, no packages installed).

## Commit

`b0dfe462` -- fix: harden room-registry read/list path reporting with 3-tier resolution + path_exists disk cross-check (2 files, +229/-2)

## Self-Check: PASSED
- FOUND: scripts/room-registry (modified, hunks confined to read/list)
- FOUND: tests/test-room-registry-path-resolution.cjs
- FOUND: commit b0dfe462
