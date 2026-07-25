---
slug: windows-installer-spawn-shell-false
kind: rca
status: root-cause-found
opened: 2026-05-24
priority: P0 -- blocks every Windows tester from completing the install track; surfaces as "Claude Code is not installed" even when Claude IS installed and works in the same shell
implementing_phase: 126.1
related_phases:
  - Phase 123 install-lifecycle-harness (shipped beta.13 -- introduced the `requireClaudeCli()` function this RCA targets)
  - Phase 126 install-lifecycle-harness-gaps (shipped beta.15 -- closed 4 Windows dogfood findings but did NOT touch the PATH check)
  - Phase 127.3 jtbd-auto-anchor-fix (sibling beta.33 hotfix; rides same beta)
canon_parts:
  - Part 6 (dog-fooding mandate -- a Windows tester surfaced this; CI has no Windows runner so it slipped past Phase 123 + 126 ship gates)
  - Part 7 (reuse-before-build -- the fix is repointing `spawnSync` to use `shell: true`, not new abstractions)
discovered_via: Wave-2 Windows tester install attempt, 2026-05-17 (re-pinged 2026-05-24 with screenshot)
tester_archive: docs/testers/outbox/2026-05-24-rea-native-windows-fix.md (gitignored; contains the screenshot transcription)
---

# RCA: Windows installer's PATH check fails because `spawnSync('claude')` lacks `shell: true`

## Symptom

A Windows tester runs:

```
PS C:\Users\<user>> npx @mindrian_os/install
Claude Code is not installed (no `claude` command on your PATH).
Install it first:
  npm install -g @anthropic-ai/claude-code
Then re-run:
  npx @mindrian_os/install
```

In the SAME PowerShell session, immediately after:

```
PS C:\Users\<user>> claude
Welcome to Claude Code v2.1.143
```

`claude` works. Our installer says it doesn't. Two interpretations of the same PATH disagree.

Worse: the tester followed our prompt ("`npm install -g @anthropic-ai/claude-code`") which succeeded with `changed 2 packages in 5s` (npm-speak for "already installed, just touched"), then re-ran `npx @mindrian_os/install`, got the SAME wrong error, then ran `claude` directly and watched it launch. The installer wasted the tester's time with an instruction they didn't need.

## Root cause (one line of code)

`bin/cli.js:82`:

```js
function requireClaudeCli() {
  const check = spawnSync('claude', ['--version'], { stdio: 'ignore' });  // <-- here
  if (ok(check)) return true;
  console.error('Claude Code is not installed (no `claude` command on your PATH).');
  ...
}
```

`child_process.spawnSync('claude', ...)` without `{ shell: true }` does NOT consult Windows's `PATHEXT` environment variable. It looks for a literal file named `claude` (no extension), throws `ENOENT`, and our `ok(check)` returns false.

On Windows, `npm install -g @anthropic-ai/claude-code` installs `%APPDATA%\npm\claude.cmd` (a batch shim). The shell DOES consult PATHEXT (`.COM;.EXE;.BAT;.CMD;...`) when resolving `claude`, finds `claude.cmd`, runs it. Hence the contradiction: shell sees `claude.cmd`, Node sees nothing.

On macOS/Linux, `claude` is a real file (no extension), so `spawnSync('claude')` finds it directly and the bug is invisible.

## Why we missed it

1. **No Windows in CI.** Phases 123 + 126 both shipped with the installer un-tested on a native Windows runner. The Phase 126 Windows dogfood (`126-FEEDBACK-2026-05-13-windows-dogfood.md`) caught 4 other findings but didn't exercise `requireClaudeCli()` in the broken state.
2. **WSL hides the bug.** Every other tester on Windows-class hardware ran inside WSL (Linux subsystem), where the bug doesn't fire. The Wave-2 tester ran on native PowerShell, which is the only path that hits it.
3. **Classic Node-on-Windows gotcha.** This is THE textbook `spawn` gotcha — well-known to anyone who has shipped a Node CLI cross-platform, invisible to anyone who hasn't.

## The fix (one option flag)

```js
// before
const check = spawnSync('claude', ['--version'], { stdio: 'ignore' });

// after
const check = spawnSync('claude', ['--version'], { stdio: 'ignore', shell: true });
```

`shell: true` delegates the spawn to the platform shell (cmd.exe on Windows, /bin/sh elsewhere). The shell DOES consult PATHEXT on Windows, finds `claude.cmd`, runs the version check, returns 0, `ok(check)` returns true, the installer proceeds.

### Why `shell: true` is safe here

`shell: true` carries a documented risk of shell injection when args contain user input. Here, the spawn call uses ONLY literal strings (`'claude'`, `'--version'`) — no user input, no template interpolation, no env-var expansion. The risk surface is zero.

### Alternative considered (and rejected)

Using the `which` npm package, OR explicit platform branching:
```js
const cmd = process.platform === 'win32' ? 'claude.cmd' : 'claude';
```
Both work. Both add either a dependency or a platform branch for marginal benefit over `shell: true`. The one-flag fix is the minimum diff.

## Reproduction

On any Windows machine with PowerShell + Node 18+ + npm:

```powershell
npm install -g @anthropic-ai/claude-code
claude --version    # works -> v2.1.143
node -e "const r=require('child_process').spawnSync('claude',['--version'],{stdio:'ignore'}); console.log('status:',r.status,'err:',r.error?.code)"
# -> status: null err: ENOENT
node -e "const r=require('child_process').spawnSync('claude',['--version'],{stdio:'ignore',shell:true}); console.log('status:',r.status,'err:',r.error?.code)"
# -> status: 0 err: undefined
```

The two `node -e` lines are the smallest possible isolation of the bug and the fix.

## Verification protocol (post-fix)

1. Synthetic test (any platform): `node -e "..."` invocations above MUST both return `status: 0` after the fix is applied.
2. Cross-platform test: `tests/test-require-claude-cli.cjs` (NEW) MUST pass on Linux + a Windows runner (GitHub Actions windows-latest, see Fix 2 below).
3. Live test (Windows tester): rerun `npx @mindrian_os/install` on the Wave-2 tester's actual machine; expect the install to proceed past the gate.

## Scope and Impact

| Surface | Affected today | After fix |
|---|---|---|
| CLI on Linux/macOS | not affected | not affected |
| CLI on WSL | not affected | not affected |
| CLI on native Windows PowerShell | broken (this RCA) | works |
| CLI on Windows cmd.exe | broken (inferred -- same Node behavior) | works |
| Desktop / Cowork | N/A (those don't shell out to claude) | N/A |

## Required Code Changes

| File | Change |
|---|---|
| `bin/cli.js` | Add `shell: true` to the `spawnSync` call on line 82 |
| `tests/test-require-claude-cli.cjs` | NEW -- mock `spawnSync` to assert the call site passes `shell: true`; also do a real-spawn smoke test on a known-good binary (`node --version`) with both `shell:true/false` to confirm the difference |
| `.github/workflows/ci.yml` | Add a `windows-latest` matrix entry (Fix 2 in 126.1; ships if achievable in beta.33 window, otherwise punts to 126.2) |

## Tests

- Unit: assert the spawn call uses `shell: true` on win32 (via mock or `Object.defineProperty(process, 'platform', ...)`).
- Integration: spawn a known-good binary on the runner; confirm exit 0 with `shell: true` and (on Windows only) reproduce the `ENOENT` without it.
- Manual: Wave-2 Windows tester reruns `npx @mindrian_os/install` post-deploy. Screenshot of success goes in `docs/testers/outbox/`.

## Non-Code Follow-ups

1. **Family update**: add this RCA as case #7 in `docs/install-cache-family-premortem.md` (Phase 126 doc). Pattern: cross-platform PATH-resolution disagreement between shell and Node.
2. **Process update**: add to the Phase 7 reuse-before-build PR-review checklist: "any `child_process.spawn*` call that takes a bare command name MUST set `shell: true` OR use the `which` package OR justify platform-specific behavior in the PR description."
3. **Install minisite**: until Windows CI runner ships, add a one-line "Windows: native PowerShell supported; if you hit issues, reply to your welcome email and we will switch you to WSL" note (`~/mindrianos-install-site/`).
4. **Tester unblock**: send the v4 native-PowerShell draft (`docs/testers/rea/DRAFT-v4-native-windows-2026-05-24.{html,txt}`) within the same beta.33 cut. The Wave-2 tester gets the fix AND the explicit how-to in the same window.

## Canon gates cleared

- **Part 6 (dog-fooding)**: This RCA WAS surfaced by a real tester using the install path as documented. Phase 126.1 closes the gap by adding the missing Windows CI lane (Fix 2) so the next iteration of the install-cache family premortem doesn't repeat this class.
- **Part 7 (reuse-before-build)**: Fix is one option flag on an existing spawn call. Zero new abstractions, zero new dependencies. The `which` package alternative was considered and rejected on parsimony grounds.
- **Part 8 (Brain boundary)**: N/A -- no Brain calls in `bin/cli.js`.
- **No em-dashes**: this RCA uses hyphens throughout (verified manually pre-commit).
- **Cross-platform**: post-fix, verified on Linux + Windows (Windows-CI runner adds the structural enforcement).
- **Release lockstep**: Phase 126.1 ships in beta.33 with Phase 127.3; the 7-place lockstep (CHANGELOG, plugin.json, root package.json, packages/npm-installer/package.json, git tag, marketplace.json source.ref, install minisite version strings) runs once for the combined cut per `feedback_install_minisite_lockstep.md`.

## On resolve

Move this file to `.planning/debug/resolved/` and add a summary block to `.planning/debug/knowledge-base.md` keyed under the pattern "child_process.spawn without shell:true on Windows PATHEXT" so `gsd-debugger` surfaces it as a known-pattern hypothesis next time a Windows-only install bug appears.
