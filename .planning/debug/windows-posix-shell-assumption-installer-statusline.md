---
status: fixing
kind: rca
trigger: "windows-posix-shell-assumption-installer-statusline"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: tier-0
canon_parts: [6, 7]
created: 2026-06-01T21:33:32Z
updated: 2026-06-01T21:33:32Z
---

## Current Focus

hypothesis: The installer and statusline both assume a POSIX shell on Windows. The installer spawns `claude` without `shell:true`, so Node cannot resolve the `claude.cmd` npm shim (PATHEXT not consulted) and false-reports "Claude Code is not installed". The statusline command runs `bash`, which does not exist on a default Windows box.
test: Patch the installer to route `claude` spawns through the shell on win32; confirm parse + POSIX no-regression. Statusline tracked as a separate follow-up.
expecting: `npx @mindrian_os/install` clears its prereq gate on Windows when `claude --version` works; node/git doctor path not regressed.
next_action: Ship the installer fix as 1.13.0-beta.41 via release.sh --prerelease (gated on maintainer go). Scope the statusline Node-renderer fix as its own phase.

## Meta

- Repo: /home/jsagi/MindrianOS-Plugin
- Plugin version: 1.13.0-beta.40 (fix targets 1.13.0-beta.41)
- Reported by: Windows beta-tester "rea"
- Date first observed: 2026-06-01
- Related debug sessions: install-cache family (see docs/install-cache-family-premortem.md) -- sibling family, different organ

## Problem Statement

On Windows, `npx @mindrian_os/install` aborts with "Claude Code is not installed"
even when `claude --version` works in the same shell, and the MindrianOS
statusline never renders. Both stem from the installer/plugin assuming a POSIX
shell that Windows does not provide.

## Symptoms

expected: `npx @mindrian_os/install` proceeds to install MindrianOS when Claude Code is present on PATH; the statusline renders the room/context line at session start.
actual: Installer prints "Claude Code is not installed (no `claude` command on your PATH)." and exits before installing. After a manual install, no `/mos:` statusline appears.
errors: "Claude Code is not installed (no `claude` command on your PATH)." (installer, non-zero exit). Statusline: silent failure (no error surfaced to the user).
reproduction:
  1. On Windows 10.0.26200 with Claude Code 2.1.159 installed (`claude --version` -> 2.11.59).
  2. Run `npx @mindrian_os/install`.
  3. Observe the false "not installed" abort. (Statusline: after manual `claude plugin install`, open Claude Code -- no statusline line appears.)
started: present since the installer's `requireClaudeCli` + `run()` were written with bare `spawnSync('claude', ...)`. Windows has likely never installed via the documented npx path.

## Scope and Impact

- Affected surfaces: cli (installer is a CLI entry; statusline is a CLI surface).
- Affected commands: `npx @mindrian_os/install` (install + update subcommands); the statusLine command in ~/.claude/settings.json.
- Affected users: Windows only. Mac/Linux unaffected (POSIX shells resolve both).
- Version range: installer bug present through 1.13.0-beta.40; fix targets 1.13.0-beta.41.
- Severity: high (the documented install path is fully broken on an entire platform; a manual `claude plugin install ...` workaround exists, which unblocked the tester).
- Blast radius: every `claude` spawn in bin/cli.js (install + update). Statusline shares the SAME root family (POSIX-shell assumption) but a DIFFERENT mechanism (bash dependency), so it is a sibling, not the same defect.

## Eliminated

- hypothesis: Claude Code was genuinely not installed on the tester's machine.
  evidence: `claude --version` returned 2.11.59 in the same shell -- the binary is present and on PATH; the installer's detection disagreed with the shell.
  timestamp: 2026-06-01T21:33:32Z
- hypothesis: The manual `claude plugin install` itself failed.
  evidence: Tester confirmed the plugin loads and `/mos:` commands work after a full Claude Code restart; only the statusline is absent.
  timestamp: 2026-06-01T21:33:32Z

## Evidence

- timestamp: 2026-06-01T21:33:32Z
  checked: bin/cli.js requireClaudeCli (line 82 pre-fix) and run() helper (lines 52-54 pre-fix).
  found: `spawnSync('claude', ['--version'], { stdio: 'ignore' })` and `spawnSync(cmd, args, { stdio: 'inherit', ...opts })` -- no `shell` option at any claude spawn site.
  implication: On Windows, `claude` is `claude.cmd`; spawnSync without shell does not consult PATHEXT, returns ENOENT, so `ok(check)` is false -> false "not installed".
- timestamp: 2026-06-01T21:33:32Z
  checked: settings.json statusLine block + scripts/ statusline chain.
  found: statusLine command is `bash "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-mos"`; the dispatch shim (statusline-mos-dispatch) and renderer (statusline-mos) are both bash. statusline-fallback-echo.cjs is a SessionStart hook (emits hookSpecificOutput, returns empty on CLI surface) -- NOT a statusLine command, so it cannot stand in.
  implication: No Node statusline renderer exists; the status bar cannot render on Windows without bash on PATH. Cosmetic (plugin + commands function regardless).

## Technical Root Cause

- Site: bin/cli.js: requireClaudeCli (claude --version check) and the six `run('claude', ...)` call sites in the install/update subcommands.
- Cause: `claude` spawned without `shell:true`. On Windows the npm-global `claude` is a `.cmd` shim; Node's spawnSync does not consult PATHEXT without a shell, so the spawn fails with ENOENT and the prereq check false-negatives.
- Why it surfaces now: first Windows tester to run the documented `npx @mindrian_os/install` path. POSIX dev/test boxes never exposed it because their shells resolve `claude` directly.

Sibling (statusline): the statusLine command and its script chain are bash; a default Windows box has no `bash`, so the command silently fails. Same POSIX-shell-assumption family, different mechanism.

## Required Code Changes

- Change 1 (DONE in this RCA's commit):
  - Location: bin/cli.js -- new `isWindows` const + new `runClaude(args, opts)` helper; requireClaudeCli spawnSync; six `run('claude', ...)` sites repointed to `runClaude(...)`.
  - Current behavior: bare `spawnSync('claude', ...)` / `run('claude', ...)` with no shell.
  - Required behavior: route `claude` spawns through `{ shell: isWindows }` so cmd.exe resolves `claude.cmd` on win32; POSIX unchanged (shell stays false).
  - Short-term patch: this IS the fix.
  - Long-term fix: same; no stopgap.
  - SCOPING NOTE (deviation from initial brief): shell is applied to `claude` spawns ONLY, NOT to the generic `run()` helper. `run()` is also called as `run(process.execPath, ...)` in the doctor subcommand; on Windows `process.execPath` is `C:\Program Files\nodejs\node.exe` (contains a space). With `shell:true`, Node passes the command unquoted to cmd.exe, which would parse `C:\Program` as the command and break the doctor path. `git` (real `.exe`) and `process.execPath` resolve correctly WITHOUT shell. Applying shell broadly would have traded the install bug for a doctor bug.
- Change 2 (FOLLOW-UP, NOT in this commit):
  - Location: scripts/statusline-mos chain + settings.json statusLine command.
  - Current behavior: statusLine runs `bash`; no Node renderer exists.
  - Required behavior: provide a Node statusline renderer (or a win32-aware statusLine command) so the status bar does not depend on bash. Tracked as its own phase.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: tests/test-cli-claude-spawn-windows.cjs (new)
  - Given: a stubbed spawnSync capturing its opts.
  - When: requireClaudeCli and each runClaude path run under a forced `process.platform === 'win32'`.
  - Then: every `claude` spawn carries `shell: true`; under a forced posix platform, `shell` is false; the doctor `run(process.execPath, ...)` path NEVER carries shell on either platform.
  - Runner registration: register in the Feynman runner / tests/run-all-*.sh.
- Test 2:
  - Type: unit
  - Location: tests/test-cli-claude-spawn-windows.cjs
  - Given: forced win32.
  - When: grep the module surface.
  - Then: zero bare `run('claude'` / `spawnSync('claude'` call sites bypass the runClaude/shell route (single-chokepoint invariant).

## Non-Code Follow-ups

- CHANGELOG.md: Fixed entry added under [1.13.0-beta.41] (done in this task).
- Release lockstep: ships via `scripts/release.sh --prerelease` (beta.40 -> beta.41), which owns the 7-place lockstep (plugin.json, package.json, package-lock.json, CHANGELOG, git tag, marketplace.json, install minisite). Do NOT hand-bump versions. GATED on maintainer go (pushes to GitHub + marketplace + npm).
- Canon: touches Part 6 (install-lifecycle dog-fooding) and Part 7 (reuse -- extends existing helpers, no new surface). No Part 8 wire. CANON-PHASE-MAP update not required (no canon-text change).
- knowledge-base.md: on resolve, add the "Windows POSIX-shell assumption" pattern block so gsd-debugger surfaces it next time a Windows spawn/shell symptom appears.
- Statusline follow-up: open a phase for the Node statusline renderer. Until then, Windows testers either install Git for Windows (provides bash) or accept no status bar (cosmetic).

## Resolution

root_cause: bin/cli.js spawned `claude` without `shell:true`; on Windows the `claude.cmd` shim is not resolved by Node's spawnSync (no PATHEXT lookup), so the prereq check false-negatived. Sibling: the bash-based statusline chain cannot run without bash on Windows.
fix: Added `isWindows` + `runClaude()` to bin/cli.js; routed all six `run('claude', ...)` sites and the requireClaudeCli `--version` check through the shell on win32; left run()/process.execPath/git/bash untouched to avoid a doctor-path regression from unquoted spaced paths.
verification: `node -c bin/cli.js` -> PARSE OK; `grep -c "run('claude'" bin/cli.js` -> 1 (the single runClaude chokepoint); `grep -c "runClaude(" bin/cli.js` -> 7 (1 def + 6 calls); `node bin/cli.js bogus` -> usage + exit 1 (POSIX no-regression). Windows runtime verification PENDING on the tester's machine post-release.
files_changed:
  - bin/cli.js (isWindows const + runClaude helper; 7 claude spawn sites shell-scoped on win32)
  - CHANGELOG.md (1.13.0-beta.41 Fixed entry)
  - .planning/debug/windows-posix-shell-assumption-installer-statusline.md (this RCA)
commits: PENDING (filled at commit time)

### MindrianOS gates (Section 5)

1. Canon Part 8: clean by construction. The fix touches no Brain wire (no brain_* call, no brain-client.cjs, no mcp-server-brain/ path). Zero user data involved.
2. Tri-Polar: the installer and statusline are CLI surfaces. Desktop/Cowork do not run the npx installer and have no CLI statusline (they use the SessionStart prose echo), so they are unaffected by construction.
3. Cross-platform: Linux-verified (parse + POSIX smoke, shell stays false -> identical behavior). Windows-correct by construction (shell:true resolves the .cmd shim) but runtime-PENDING on the tester's box. Mac is POSIX, same as Linux. The doctor/git/node paths are deliberately left shell-free to stay correct on Windows (spaced process.execPath).
4. Release lockstep: named above -- release.sh --prerelease owns the 7-place lockstep; gated on maintainer go.
5. No em-dashes: this RCA, the code comments, the CHANGELOG entry, and the commit message use hyphens only.
6. Reuse before build (Part 7): no new command/skill/agent/hook. The fix extends existing helpers (run -> runClaude wrapper). Repointing was sufficient; no net-new surface.
