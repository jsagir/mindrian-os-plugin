---
kind: rca
slug: windows-room-registry-path-normalization-gap
date: 2026-05-23
status: resolved
resolved: 2026-05-23
resolved_by: phase-127.2 Plan 127.2-04 (Instance #4 + #7 hotfix bundle, ships v1.13.0-beta.32)
severity: P2
discovered_in: post-beta30-regression-2026-05-23 (Instance #4)
related:
  - .planning/debug/resolved/post-beta30-regression-2026-05-23.md
---

# Windows room-registry POSIX path leak into Python `open()`

## 1. Summary

`bash scripts/room-registry list` (and every other registry subcommand) fails on Windows with `FileNotFoundError: [Errno 2] No such file or directory: '/c/Users/PC/MindrianRooms/.rooms/registry.json'`. The registry file EXISTS at `C:\Users\PC\MindrianRooms\.rooms\registry.json`. The bug is that bash-resolved `$REGISTRY_FILE` (which carries a Git-Bash-style POSIX path like `/c/Users/PC/MindrianRooms/.rooms/registry.json`) is interpolated literally into an embedded Python heredoc that calls `open(...)` — Python on Windows cannot resolve the POSIX leading-slash form, only the native `C:\...` form.

## 2. Reproduction

```bash
# On Windows, Git Bash session, beta.30 LIVE active
bash ~/.claude/plugins/mindrian-os/scripts/room-registry list
# → Traceback (most recent call last):
#     File "<string>", line 3, in <module>
#       with open('/c/Users/PC/MindrianRooms/.rooms/registry.json') as f:
#            ~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
#   FileNotFoundError: [Errno 2] No such file or directory: '/c/Users/PC/MindrianRooms/.rooms/registry.json'
```

Affected: every Windows + Git-Bash user. Not reproducible on Linux or macOS.

## 3. Root cause (CODE-claim)

`scripts/room-registry` embeds Python heredocs that interpolate `$REGISTRY_FILE` (and similar) without normalizing the path. The bash script computes the path with `$HOME` + relative components → on Git Bash `$HOME = /c/Users/PC` → the resulting path is `/c/Users/PC/MindrianRooms/.rooms/registry.json`. This POSIX form is fine for bash, but the embedded `python3 << EOF` block calls `open('/c/Users/...')` directly. Python on Windows expects `C:\...` and does not parse the `/c/` Git-Bash prefix.

Affected line numbers per prior session sweep (still present in beta.30 LIVE — no fix shipped):
- 64, 85, 113, 130, 167, 174, 198, 212, 236, 245, 261, 288, 298

All embed `open('$REGISTRY_FILE')` or `open(reg_file)` with no normpath.

CODE-claim source-of-truth: `C:\Users\PC\.claude\plugins\mindrian-os\scripts\room-registry` at beta.30 LIVE.

## 4. Required code changes

Two acceptable fixes; recommend (a):

(a) **Add a normpath shim in every embedded Python block.** At the top of each heredoc, add:
```python
import os, sys
def normwin(p):
    # Convert Git Bash POSIX form /c/Users/... → C:\Users\...
    if sys.platform == 'win32' and len(p) >= 3 and p[0] == '/' and p[2] == '/':
        return p[1].upper() + ':' + p[2:].replace('/', os.sep)
    return p
REGISTRY_FILE = normwin(REGISTRY_FILE)
```
Then use `REGISTRY_FILE` everywhere instead of the raw bash-interpolated `'$REGISTRY_FILE'`.

(b) **Normalize at the bash layer.** Before the heredoc, run `REGISTRY_FILE=$(cygpath -w "$REGISTRY_FILE" 2>/dev/null || echo "$REGISTRY_FILE")`. Risk: `cygpath` is Git-Bash-specific; not portable to WSL.

Prefer (a). It is platform-detection-driven and works under Git Bash, WSL, native bash on Linux, and macOS without conditional branching at the bash layer.

## 5. Tests

Add `tests/test-room-registry-windows-path.cjs`:
1. Mock `$HOME` = `/c/Users/test`.
2. Create `/c/Users/test/MindrianRooms/.rooms/registry.json` (use `os.path.join` resolution).
3. Run `bash scripts/room-registry list`.
4. Assert exit 0 + valid JSON output.
5. Run again on Linux with `$HOME` = `/home/test` → assert no regression (the normpath shim is a no-op when path doesn't start with `/<letter>/`).

Smoke test: run W3.1 from the verification sweep as a CI gate.

## 6. Non-code follow-ups

- Add Windows + Git Bash to the CI matrix (currently Linux + macOS only per release.sh). This bug existed for an unknown number of releases and was only caught by Jonathan's dogfood machine.
- Update `docs/install-cache-family-premortem.md` with this as a NEW pattern: "Bash scripts that embed Python heredocs assuming Linux-style paths." Predicted next failure mode: any script in `scripts/` that does `python3 << EOF ... open('$BASH_VAR') ... EOF` is at risk.

## 7. MindrianOS gate clearance

- **Canon Part 8 (Brain boundary):** no Brain calls touched; pure local-FS bug. Clear.
- **Tri-Polar (CLI / Desktop / Cowork):** CLI surface only. Desktop/Cowork unaffected (they invoke registry via Node MCP shim, not the bash script). Clear with caveat — this means Windows CLI users have a broken `/mos:rooms list` while Desktop/Cowork users on the same machine do not.
- **Cross-platform:** **fails this gate.** Fix is mandatory before beta.30 promotes to stable.
- **Release lockstep:** no version bump needed for the fix — patch in beta.31.
- **No em-dashes:** N/A (code change).
- **Reuse-before-build:** check whether `lib/core/active-plugin-root.cjs` or any shipped resolver already has a normpath utility. If yes, reuse; if no, the shim above is small enough to inline per-script.

## 8. Open questions

- Are there OTHER bash scripts in `scripts/` with the same heredoc pattern? Quick grep candidates: `scripts/hsi-*`, `scripts/build-*`, `scripts/release.sh`. If yes, this RCA should expand to a sweep.
- Does Cowork's shared-room mode (when remote rooms get added later) inherit this bug if the room path is provided in POSIX form by a Mac/Linux user but parsed on a Windows agent host?

---

## Resolution (2026-05-23, v1.13.0-beta.32)

Closed by phase-127.2 Plan 127.2-04 Task 1.

**Fix applied (option (a) per RCA Section 4 -- platform-detection normpath shim):**

A `normwin()` Python helper is now injected at the top of every `python3 -c` invocation in `scripts/room-registry` (8 invocations covering `create`, `read`, `list`, `update`, `set-active`, `archive`, `get-active`, `git-config` subcommands). Every `open(...)` call inside the embedded Python is wrapped via `open(normwin(REGISTRY_FILE))`. On Linux/macOS the shim is a no-op (paths already native); on Windows + Git Bash it converts `/c/Users/PC/MindrianRooms/.rooms/registry.json` to `C:\Users\PC\MindrianRooms\.rooms\registry.json` so Python's `open()` resolves correctly.

The shim form (load-bearing inline, verbatim per Plan 127.2-04 spec):

```python
def normwin(p):
    if sys.platform == 'win32' and len(p) >= 3 and p[0] == '/' and p[2] == '/':
        return p[1].upper() + ':' + p[2:].replace('/', os.sep)
    return p
```

**Sibling sweep (per RCA Section 8 open question):**

| Script | Status | Notes |
|--------|--------|-------|
| `scripts/room-registry` | PATCHED | 8 `python3 -c` invocations, all sites covered |
| `scripts/reapply-modifications` | PATCHED | 4 `python3 -c` invocations reading `$META_FILE`; bash-var-string `NORMWIN_SHIM` injected once and reused across all four |
| `scripts/hsi-*` | CLEAN | Only `scripts/hsi-to-graph.cjs` exists (no Python heredocs) |
| `scripts/build-*` | CLEAN | All build scripts are `.cjs`; no Python heredocs |
| `scripts/release.sh` | CLEAN | No `python3 -c` with `$BASH_VAR` open() |
| `scripts/verify-release` | DEFERRED (out of plan scope) | 4 sites with `$PLUGIN_ROOT` / `$MARKETPLACE_DIR` in `python3 -c "import json; ... open(...)"`; needs patching in a follow-up plan |
| `scripts/learn-from-usage` | DEFERRED (out of plan scope) | `python3 << 'PYEOF'` heredoc reading env-var paths; vulnerable on Windows + Git Bash |
| `scripts/track-analytics` | DEFERRED (out of plan scope) | Same pattern as `learn-from-usage` |
| `scripts/discovery-cycle.cjs` | NOT-VULNERABLE | Uses JS template literal (`${step.script}`), not bash-var leak |

Deferred items (verify-release, learn-from-usage, track-analytics) logged to `.planning/phases/127.2-.../deferred-items.md` for a future patch beta.

**Tests:**

- `tests/test-room-registry-windows-path.cjs` (215 lines, 25 PASS / 0 FAIL): runs every subcommand on synthetic Linux $HOME, exercises the normwin Python helper directly via subprocess, and structural greps assert every read flows through normwin + zero raw `open($REGISTRY_FILE)` callsites remain.
- `tests/test-127.2-04-windows-path-and-update-activation.sh` (combined smoke, 16/16 PASS): structural greps + functional doctor probes.

**Cross-platform CI gate:** RCA Section 6 ("Add Windows + Git Bash to the CI matrix") is logged as a follow-up. Not in scope for v1.13.0-beta.32. Currently relies on Jonathan's dogfood Windows box for empirical verification.

**Premortem update:** `docs/install-cache-family-premortem.md` updated with the new pattern (bash scripts embedding Python heredocs that assume Linux-style paths) as the 7th case in the install-cache failure family.

See `.planning/phases/127.2-brain-warmup-ping-hide-mcp-cold-start-latency-inside-larry-s/127.2-04-PLAN.md` and `.planning/debug/knowledge-base.md` for downstream references.
