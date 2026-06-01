---
quick_id: 260602-0pb
slug: fix-windows-shell-bug-in-installer-cli-j
status: complete
date: 2026-06-02
---

# Quick Task 260602-0pb Summary

## What was done

Fixed the Windows installer false-negative in `bin/cli.js`. The installer spawned
`claude` without a `shell` option; on Windows the `claude.cmd` npm shim is not
resolved by Node's `spawnSync` (no PATHEXT lookup), so the prereq check reported
"Claude Code is not installed" even when `claude --version` works. Routed all
`claude` spawns through a shell on win32.

## Changes

- **bin/cli.js**
  - Added `const isWindows = process.platform === 'win32';`
  - Added `runClaude(args, opts)` helper -> `run('claude', args, { shell: isWindows, ...opts })`.
  - Repointed all 6 `run('claude', ...)` call sites (install + update subcommands) to `runClaude(...)`.
  - Added `shell: isWindows` to the `requireClaudeCli()` `spawnSync('claude', ['--version'], ...)` check.
  - Left `run()`, the doctor `run(process.execPath, ...)` call, and the `git`/`bash` update-path calls UNCHANGED.
- **CHANGELOG.md** -- `## [1.13.0-beta.41] - 2026-06-02` Fixed entry + tracked statusline follow-up.
- **.planning/debug/windows-posix-shell-assumption-installer-statusline.md** -- RCA to MindrianOS standard (all Section 5 gates answered).

## Deviation from brief

The initial brief said "add shell to the `run()` helper." That would regress
Windows: `run(process.execPath, ...)` (doctor subcommand) passes
`C:\Program Files\nodejs\node.exe` -- a spaced path -- and `shell:true` would
make cmd.exe parse `C:\Program` as the command. The fix is therefore SCOPED to
`claude` spawns via `runClaude()`; the generic `run()` helper is untouched.

## Verification

- `node -c bin/cli.js` -> PARSE OK
- `grep -c "run('claude'" bin/cli.js` -> 1 (the single chokepoint inside runClaude)
- `grep -c "runClaude(" bin/cli.js` -> 7 (1 def + 6 calls)
- `node bin/cli.js bogus` -> usage + exit 1 (POSIX no-regression)
- Windows runtime verification: PENDING on tester machine post-release.

## Not done (intentionally, gated)

- `release.sh --prerelease` (beta.40 -> beta.41) -- owns the 7-place lockstep and
  pushes to GitHub + marketplace + npm. Gated on maintainer go.
- Statusline Node renderer -- tracked as its own phase in the RCA.

## Isolation note

Pre-existing uncommitted Phase 131 work (`navigation.cjs`, `SUBSTRATE-CONTRACT.md`,
`dashboard/graph.json`, untracked `lib/core/navigation/*.cjs`) was present in the
tree and was deliberately NOT staged. This task's commits touch only bin/cli.js,
CHANGELOG.md, and .planning/ artifacts.
