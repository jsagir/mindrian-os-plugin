---
phase: 87-security-hardening-cascade-refactor
plan: 01a
subsystem: security
tags: [git-hook, pre-commit, ROOM.md, MINTO.md, data-room, worktree, windows, symlink, session-start]

# Dependency graph
requires:
  - phase: 87-00
    provides: cascade-e2e fixture seed-room with .room-root sentinel (shared scoping primitive)
  - phase: 87-01
    provides: feynman test runner harness (reused for room-minto-hook tests)
provides:
  - Scoped pre-commit hook (.room-root sentinel) enforcing ROOM.md + MINTO.md invariant
  - Worktree-safe installer via git rev-parse --git-path hooks/pre-commit
  - Windows .cmd companion with graceful git-bash fallback
  - Symlink-safe walker (pwd -P + VISITED dedupe) that survives cycle attacks
  - session-start self-heal block that re-installs the hook on every session
  - 7-test regression suite (idempotency, Data-Room block, Data-Room pass, self-heal, plugin-source pass-through, symlink safety, worktree path)
affects: [87-10 (v1.10.11 release gate), 87-08 (dashboard exports into rooms), all future Data Room work]

# Tech tracking
tech-stack:
  added: []   # zero new runtime deps -- bash builtins + realpath + git + node test helpers only
  patterns:
    - ".room-root sentinel as Data Room scoping primitive (separates Data Room content from plugin source)"
    - "Worktree-safe git path resolution via --git-path hooks/pre-commit (never --show-toplevel/.git/hooks/)"
    - "Symlink-safe filesystem walk: pwd -P (realpath) + VISITED dedup"
    - "Session-start hook installer as drift defence (defeats --no-verify on subsequent sessions)"
    - "Atomic tmp + rename install pattern for concurrent-session race safety"
    - "Cross-platform hook shipping: .sh as primary + .cmd companion for Windows GUI clients"

key-files:
  created:
    - scripts/setup-hooks.sh
    - scripts/hooks/pre-commit-room-minto-guard.sh
    - scripts/hooks/pre-commit-room-minto-guard.cmd
    - lib/memory/room-minto-hook.test.cjs
    - .planning/phases/87-security-hardening-cascade-refactor/87-01a-SUMMARY.md
  modified:
    - scripts/session-start  # add Phase 87-01a re-install block (worktree-aware, non-fatal)
    - lib/memory/run-feynman-tests.cjs  # discover room-minto-hook.test.cjs

key-decisions:
  - "Scoping primitive is a .room-root sentinel file (not a hardcoded path list). Hook walks UP from each staged dir; if no .room-root ancestor, the dir is plugin source and the guard skips silently. This is the R-C4 regression fix."
  - "Worktree-safe path resolution via git rev-parse --git-path hooks/pre-commit (NOT --show-toplevel/.git/hooks/). In linked worktrees, .git is a FILE pointing to <main-git-dir>/worktrees/<name>/, and the real hooks dir is NOT <repo>/.git/hooks."
  - "Windows .cmd companion bridges to git-bash bash.exe when available (PATH or %ProgramFiles%\\Git\\bin\\bash.exe). When absent, emits a clear stderr skip message and exits 0 so the commit proceeds. Authoritative enforcement for Windows GUI-only installs comes from session-start re-install + CI."
  - "Symlink-safe walker uses pwd -P (realpath) at each step and records visited realpaths in a bash associative array. A symlink cycle (link-back -> .., self-ref -> .) terminates within one iteration instead of looping."
  - "Installer resolves GUARD_SRC from ${BASH_SOURCE[0]} dirname (SCRIPT_SRC_DIR), not from the target repo. This lets scripts/setup-hooks.sh be invoked against any other repo (test harness scenario, or a user running it against their own room repo) while still finding the guard source correctly."
  - "git commit wraps non-zero hook exit codes into status 1 (see git-hooks documentation). Test 2 therefore asserts commit is blocked (status != 0) AND independently invokes the hook to assert exit code 2 on the guard body."

patterns-established:
  - ".room-root scoping: any security/invariant-enforcement tool that operates on the Data Room subtree (not plugin source) should adopt this sentinel instead of pattern matching on path fragments"
  - "Hook installer via scripts/setup-hooks.sh called from session-start: the drift-proof pattern for any git-hook distributed with a plugin"
  - "Cross-platform hook shipping: ship .sh + .cmd siblings side by side; .cmd bridges to bash when available, emits skip message otherwise"

requirements-completed:
  - SEC-04

# Metrics
duration: 19min
completed: 2026-04-19
---

# Phase 87 Plan 01a: ROOM.md + MINTO.md Pre-Commit Hook Summary

**Installable pre-commit hook that enforces CLAUDE.md decision #15 at git commit time, scoped to Data Room subtrees via a `.room-root` sentinel file so plugin-source commits are never blocked; worktree-safe, symlink-safe, cross-platform, and self-healing via a session-start re-install block.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-04-19T11:33:31Z
- **Completed:** 2026-04-19T11:52:14Z
- **Tasks:** 3 (1a-1, 1a-2, 1a-3)
- **Files created:** 4
- **Files modified:** 2
- **Feynman suite:** 21/21 passed (was 20/20 after 87-01)

## Accomplishments

- Pre-commit hook installed at the effective hooks path (worktree-safe) that refuses commits introducing Data Room directories without ROOM.md + MINTO.md, scoped via the `.room-root` sentinel so plugin source commits are NEVER blocked.
- Windows `.cmd` companion that either invokes git-bash or emits a clear skip message instead of silently failing.
- session-start re-installs the hook every session, defeating accidental `--no-verify` drift on subsequent sessions.
- 7 regression tests in `lib/memory/room-minto-hook.test.cjs` cover idempotency, Data-Room block, Data-Room pass, self-heal, plugin-source pass-through (R-C4 regression gate), symlink-cycle safety, and worktree-path usage.

## Task Commits

Each task was committed atomically with a valid pre-commit hook (no `--no-verify` used anywhere):

1. **Task 1a-1: setup-hooks installer + guard script + Windows companion** — `87470e1` (feat)
2. **Task 1a-1 follow-up: installer finds GUARD_SRC via ${BASH_SOURCE[0]}** — `e3514ee` (fix)
3. **Task 1a-2 + 1a-3: session-start re-install + 7-test regression suite + feynman discovery** — `4f763ac` (test)
4. **In-execution verification: empty-commit regression under hook** — `c57fd58` (test)

The plan metadata commit follows this summary.

## Files Created/Modified

### Created
- `scripts/setup-hooks.sh` — Worktree-aware installer (`git rev-parse --git-path hooks/pre-commit`). Resolves GUARD_SRC from installer's own dir via `${BASH_SOURCE[0]}`. Atomic tmp+rename write. Idempotent `cmp -s` no-op on re-run. Also installs the `.cmd` companion at `<hooks-dir>/pre-commit.cmd`.
- `scripts/hooks/pre-commit-room-minto-guard.sh` — The guard body. `find_room_root()` walks ancestors via `cd + pwd -P` + VISITED dedupe to handle symlink cycles. Enforces ROOM.md + MINTO.md only inside `.room-root` subtrees. Exit 2 on violation with a clear stderr message referencing decision #15.
- `scripts/hooks/pre-commit-room-minto-guard.cmd` — Windows cmd batch wrapper. Tries `bash` on PATH first, then `%ProgramFiles%\Git\bin\bash.exe`; falls back to a non-silent stderr skip message. Never blocks commits on platforms without git-bash (authoritative enforcement comes from session-start re-install + CI).
- `lib/memory/room-minto-hook.test.cjs` — 7-test regression suite run inside isolated `fs.mkdtempSync` tmp repos. Uses a module-local `effectiveHookPath(repo)` helper to always resolve via `--git-path`. Uses `record()` harness (pass/FAIL counter + summary line) mirroring the other feynman tests.

### Modified
- `scripts/session-start` — Added Phase 87-01a re-install block after the statusline auto-configure block (around line 749). Uses `git rev-parse --git-path hooks/pre-commit` for worktree-safety. Non-fatal: any failure swallowed via `|| true` so session-start never blocks Claude Code startup.
- `lib/memory/run-feynman-tests.cjs` — Append `room-minto-hook.test.cjs` to `TEST_FILES` with phase-tagged comment.

## Hook Design Details

### Scoping via `.room-root` Sentinel

```
git commit
  -> hook runs
  -> for each STAGED DIR:
       find_room_root(dir):
         walk UP via cd+pwd -P, with VISITED dedupe
         if ancestor contains .room-root -> return that realpath
         else return empty (plugin source)
       if ROOM_ROOT is empty: SKIP (plugin source -- decision #15 does not apply)
       else: enforce ROOM.md + MINTO.md exist in the staged dir
  -> violations >= 1 -> exit 2 with clear stderr message
  -> violations == 0 -> exit 0
```

`test/fixtures/cascade-e2e/seed-room/.room-root` already existed (from Phase 87-00). Plugin source directories (`lib/`, `scripts/`, `commands/`, etc.) have NO `.room-root` ancestor and are NEVER blocked.

### Worktree-Safe Install Path (R-87-01a-WIN)

- **Wrong:** `$(git rev-parse --show-toplevel)/.git/hooks/pre-commit`
- **Right:** `$(git rev-parse --git-path hooks/pre-commit)`

In a linked worktree, `.git` is a FILE containing `gitdir: <main-git-dir>/worktrees/<name>/`. The hooks dir is under the main git dir, not under `<worktree>/.git/`. `--git-path` resolves this correctly on every checkout; `--show-toplevel/.git/hooks/` silently installs the hook in a directory git never reads.

Both `setup-hooks.sh` AND the `scripts/session-start` self-heal block use `--git-path`. Test 7 is a grep that asserts this across both files so any accidental regression is caught by the feynman suite.

### Windows `.cmd` Companion Strategy (R-87-01a-WIN)

When git commit runs hooks on Windows, cmd.exe is used if the hook file is a `.cmd`/`.bat`. Our installer ships `pre-commit.cmd` next to `pre-commit`. The `.cmd` tries `bash` on PATH, then `%ProgramFiles%\Git\bin\bash.exe`. If neither is available, it emits:

```
[mindrian-os] skipping ROOM/MINTO guard on Windows without git-bash
[mindrian-os] install Git for Windows (https://git-scm.com) for local enforcement
```

This is an explicit skip, not silent failure. Users see exactly why the guard didn't run and where to get git-bash. The authoritative enforcement path for Windows GUI-only installs is the session-start re-install (which DOES run via Claude Code's bash-capable runner) + CI.

### Symlink-Safe Walker (R-87-01a-WIN)

The naive `dirname` loop can escape the logical parent incorrectly when symlinks cross subtree boundaries, or loop indefinitely when a symlink points back into an already-walked dir. We fix this with:

1. `real=$(cd "$abs" 2>/dev/null && pwd -P) || return 1` — realpath-normalize each step.
2. `declare -A VISITED; if [ -n "${VISITED[$real]:-}" ]; then break; fi; VISITED[$real]=1` — cycle detection.
3. Termination at `$REPO_ROOT_REAL` or `/`.

Test 6 proves this: it creates `myroom/link-back -> ..` and `myroom/self-ref -> .`, stages files under the subtree, and asserts the commit returns within a 5s timeout (not killed by SIGKILL).

### Session-Start Self-Heal

Inserted after the existing statusline auto-configure block (line 749, post-patch). The block:
1. Resolves `SETUP_HOOKS_REPO_ROOT` via `git rev-parse --show-toplevel`.
2. If `scripts/setup-hooks.sh` is executable, resolves `HOOK_DST` via `--git-path`.
3. If hook is missing OR differs from source (`cmp -s`), runs `bash scripts/setup-hooks.sh >/dev/null 2>&1 || true`.

Non-fatal by design: session-start must NEVER fail. Any git/setup error is swallowed and Claude Code starts normally with reduced functionality.

## Authentication Gates

None. No credentials, auth, or external services required for this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] setup-hooks.sh GUARD_SRC resolution for test harness**
- **Found during:** Task 1a-2 (first test run)
- **Issue:** The original plan-sketched installer computed `GUARD_SRC="$REPO_ROOT/scripts/hooks/pre-commit-room-minto-guard.sh"`. This only works when the installer and the target repo are the same. The test harness creates tmp git repos and invokes `scripts/setup-hooks.sh` against them, so `$REPO_ROOT` resolves to the tmp repo (which has no `scripts/hooks/` tree) and the installer aborts with `Guard source missing`.
- **Fix:** Compute `SCRIPT_SRC_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)` and read `GUARD_SRC="$SCRIPT_SRC_DIR/hooks/pre-commit-room-minto-guard.sh"`. The target repo's hooks path is still resolved via `--git-path` on the caller's cwd, so worktree safety is preserved.
- **Why this is correct-by-design, not just a test fix:** A real-world user running `setup-hooks.sh` against their own room repo (outside the plugin tree) would hit exactly the same problem without this fix. The installer must know where its own siblings are.
- **Files modified:** scripts/setup-hooks.sh
- **Commit:** e3514ee

**2. [Rule 1 - Bug] Test 2 assertion on `git commit` exit code**
- **Found during:** Task 1a-2 (first test run)
- **Issue:** The plan sketch asserted `git commit` exit code == 2. This is wrong: git-hooks documentation specifies that `git commit` wraps any non-zero hook exit code into its own status 1. The guard body DOES exit 2 when run directly, but you can't observe that through `git commit`.
- **Fix:** Test 2 now asserts (a) `git commit` status != 0 (commit is blocked), (b) stderr contains `MISSING ROOM.md` and `MISSING MINTO.md`, (c) a separate `spawnSync('bash', [hookPath])` against the staged index asserts the guard's own exit code is exactly 2. Two assertions for two different semantics (git blocks the commit + hook exits 2).
- **Files modified:** lib/memory/room-minto-hook.test.cjs
- **Commit:** folded into 4f763ac (test suite)

No other deviations. No architectural changes required.

## CHANGELOG Entry for v1.10.11

```markdown
### Added
- ROOM.md + MINTO.md pre-commit hook (SEC-04, CLAUDE.md decision #15). scripts/setup-hooks.sh installs the guard at the effective hooks path (worktree-safe via git rev-parse --git-path hooks/pre-commit). Scoped via .room-root sentinel: only Data Room subtrees are enforced; plugin source commits pass unconditionally. Windows .cmd companion bridges to git-bash. session-start re-installs the hook every session, defeating accidental --no-verify drift.

### Known limitation
- A single `--no-verify` bypass on ONE commit still slips through. The session-start re-install restores enforcement for all SUBSEQUENT commits. Server-side enforcement (a GitHub Action at push time) is deliberately out of scope for v1.10.11; that will land as a separate small ship.
```

## Self-Check: PASSED

- Files created: all 4 present
  - scripts/setup-hooks.sh — FOUND (executable)
  - scripts/hooks/pre-commit-room-minto-guard.sh — FOUND (executable)
  - scripts/hooks/pre-commit-room-minto-guard.cmd — FOUND
  - lib/memory/room-minto-hook.test.cjs — FOUND
- Files modified: all 2 present and patched
  - scripts/session-start — grep "setup-hooks.sh" returns 2, grep "git rev-parse --git-path hooks/pre-commit" returns 2
  - lib/memory/run-feynman-tests.cjs — room-minto-hook.test.cjs discovered
- Commits exist: all in `git log`
  - 87470e1 feat(87-01a): ROOM.md + MINTO.md pre-commit guard + worktree-safe installer
  - e3514ee fix(87-01a): resolve GUARD_SRC from installer dir, not target repo
  - 4f763ac test(87-01a): session-start hook self-heal + 7-test room-minto-hook suite
  - c57fd58 test: empty commit under hook (plan 87-01a verification)
- Tests: `node lib/memory/room-minto-hook.test.cjs` exits 0 with 7/7 pass; `node lib/memory/run-feynman-tests.cjs` exits 0 with 21/21 pass.
- Hook installed at effective path: `/home/jsagi/MindrianOS-Plugin/.git/hooks/pre-commit`, executable, byte-identical to source.
