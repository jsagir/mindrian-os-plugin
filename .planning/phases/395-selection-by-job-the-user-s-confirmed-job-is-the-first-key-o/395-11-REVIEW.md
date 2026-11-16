---
phase: 395-selection-by-job
plan: 11
commit: 723bbe9f8
reviewed: 2026-11-16T03:00:30Z
depth: deep
files_reviewed: 13
files_reviewed_list:
  - lib/core/eureka/eureka-engine-enable.cjs
  - bin/cli.js
  - commands/eureka.md
  - commands/setup.md
  - skills/eureka/SKILL.md
  - skills/setup/SKILL.md
  - README.md
  - docs/integrations/mindrian-eureka-engine.md
  - docs/RELEASE-CEREMONY-RULING-SYSTEM.md
  - tests/test-395-eureka-setup.cjs
  - tests/test-387-eureka-engine-enable.cjs
  - tests/run-all-395.sh
  - .planning/phases/395-selection-by-job-the-user-s-confirmed-job-is-the-first-key-o/395-11-SUMMARY.md
findings:
  critical: 1
  warning: 10
  info: 9
  total: 20
status: issues_found
---

# Phase 395 plan 11: Code Review Report

**Reviewed:** 2026-11-16T03:00:30Z
**Depth:** deep (cross-file: the module, the installer, the pinned engine scripts at mindrian-eureka 9b91d25)
**Files Reviewed:** 13
**Status:** issues_found

This protocol applies: `/home/jsagi/.claude/protocols/agent-interaction-protocol.md`. Each claim is marked PROVEN, UNVERIFIED or ASSUMED.

## Summary

The commit adds `--setup` to `lib/core/eureka/eureka-engine-enable.cjs` and an offer to `bin/cli.js`. The core gate holds: without `--approved-via` the mode prints the card, exits 2 and spawns nothing (PROVEN: S1, S14, and a manual run in a fresh HOME left no `.mindrian` folder). The child environment has no `CLAUDE_`, room or Brain variable (PROVEN: S11). The installer asks only on a TTY, the default is No, and the two flags do not reach `claude` (PROVEN for the no-TTY and `--no-eureka` paths: S15).

The weak parts are: the consent card does not name all the files the approved script changes (one of them is a silent overwrite of a user backup file); a timeout or a host kill leaves the setup running in the background; the result line is read from a mixed stdout and stderr stream; the consent paths that matter most (`--eureka`, interactive `y`, interactive EOF) have no behavioural test; and the Windows path with the filtered environment was never run.

Tests run (each with the rule 8 environment line, a fresh temp HOME, `< /dev/null`):

| Command | Result |
|---|---|
| `node --check` on the module and `bin/cli.js` | syntax-ok |
| `node tests/test-395-eureka-setup.cjs` | 17 passed, 0 failed |
| `node tests/test-387-eureka-engine-enable.cjs` | 15 passed, 0 failed |
| `node tests/test-387-eureka-egress.cjs` | 22 passed, 0 failed |
| `node tests/test-341-eureka-no-brain-reach.cjs` | PASS=25 FAIL=0 |
| `node tests/test-387-eureka-command-wiring.cjs` | PASS=11 FAIL=0 |
| `node tests/test-374-screen-command.cjs` | PASS=10 FAIL=0 |
| `node tests/test-387-eureka-docs-wording.cjs` | 9 passed, 0 failed |
| `node tests/test-314-command.cjs` | PASS 17 FAIL 0 (K15 now passes after the commit) |
| `bash tests/run-all-395.sh` | exit 0 (also ran the untracked `tests/test-395-room-isolation.cjs`, which passed) |
| `bash tests/run-all-387.sh` | exit 0 |
| `bash tests/run-all-374.sh` | exit 0 |
| `eureka-engine-enable.cjs --setup` (no approval) | card printed, exit 2, no `$T/.mindrian` |
| `eureka-engine-enable.cjs --check` | `Engine: not set up`, Fix line names `--setup` then `--path <folder>` |

Not run: the real setup (network), Windows, macOS, a real TTY session of the installer.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The consent card does not name all the writes to user files, and one of them overwrites a user backup without notice

**File:** `lib/core/eureka/eureka-engine-enable.cjs:653-658` (card `writes`), with the executed script `mindrian-eureka@9b91d25:scripts/setup-mindrianos.sh` lines 16-17 and 40-43
**Issue:** The card is the only consent the person gives. It lists 4 writes. The approved script also makes these changes, which the card does not name:
1. `sed -i.bak ... "$RC"` on `~/.bashrc` and `~/.zshrc` writes `~/.bashrc.bak` and `~/.zshrc.bak`. If the person already has a file with that name (a common manual backup name), the script overwrites it with no notice. This is a data loss risk (PROVEN from the script text at the pinned commit; the overwrite itself is standard `sed -i.bak` behaviour).
2. The same `sed` deletes every line that contains `MINDRIAN_EUREKA_RS_MODEL_PATH`, also a line that the person wrote.
3. When uv is missing, `curl -LsSf https://astral.sh/uv/install.sh | sh` (POSIX) and `irm https://astral.sh/uv/install.ps1 | iex` (Windows) run the uv installer. That installer, by default, edits the shell profile files (POSIX) or the user PATH in the registry (Windows) (ASSUMED from the documented uv installer behaviour; not run here). The card says only "astral.sh: the uv tool".
4. uv writes a package cache (`~/.cache/uv` or `%LOCALAPPDATA%\uv\cache`) and, on a cold machine, a managed Python 3.12. Neither is in the "It writes" list, and the "about 1.3 GB" figure was measured on a warm machine (plan 0.3 says so).
The task criterion "nothing installs silently" is not met for these items.
**Fix:** Name every write on the card, and name the backup overwrite. For example, in `setupCardFacts`:
```js
writes: [
  engineFolder + ' (the engine and its Python packages)',
  (hub ? hub.path : 'the Hugging Face cache folder') + ' (the meaning model)',
  resolver.enginePointerPath(env) + ' (where MindrianOS finds the engine)',
  win ? 'one user setting, MINDRIAN_EUREKA_RS_MODEL_PATH, that tells the engine where the model is'
      : 'one line in ~/.bashrc and ~/.zshrc, when they exist; a copy of each goes to ~/.bashrc.bak and ~/.zshrc.bak and replaces any file with that name',
  'the uv package cache, and Python 3.12 when this computer has none',
  win ? 'when uv is missing: uv and its folder on your user PATH' : 'when uv is missing: uv in ~/.local/bin and a line in your shell start files',
],
```
Also request from session jsagi-96 a timestamped backup name in the engine script (for example `.bak.eureka-<date>`), then move the pin.

## Warnings

### WR-01: A timeout or a host kill leaves the setup running in the background; the direct command does not exit at the timeout

**File:** `lib/core/eureka/eureka-engine-enable.cjs:376-381, 406, 410-413`
**Issue:** The child is `bash -c 'curl ... | bash'` (or `powershell.exe ... | iex`). `child.kill()` sends SIGTERM to the outer shell only. The pipeline children (curl, the inner bash, git, uv, python) keep running. PROVEN with a scratch reproduction (`bash -c 'sleep 7 | cat'`, `kill()` after 1 s): the `sleep` process stayed alive, and `close` fired only after 9.6 s, when the grandchild ended. Results: (a) the person sees "did not finish (error timeout)" while the setup continues and can still write `~/.bashrc` and the engine folder; (b) when the module runs as `main`, Node keeps the pipes open and does not exit until the grandchildren end; (c) the Claude Code Bash tool limit of 600000 ms (commands/eureka.md step 6) kills `node` and leaves the same orphans. The timeout path has no test, and `SETUP_TIMEOUT_MS` cannot be injected.
**Fix:** On POSIX spawn with `detached: true` and kill the process group; on Windows use `taskkill /pid <pid> /T /F`. Make the timeout injectable through `deps.timeoutMs` and add an arm.
```js
child = spawn(cmd.command, cmd.args, { shell: false, env: setupEnvironment(env), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: platform !== 'win32' });
// on timeout:
if (platform === 'win32') childProcess.spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
else try { process.kill(-child.pid, 'SIGTERM'); } catch (_e) { /* gone */ }
```

### WR-02: The result line is read from a mixed stdout and stderr tail; a later stderr line turns a success into a failure

**File:** `lib/core/eureka/eureka-engine-enable.cjs:400-402, 417-418, 628-631, 685`
**Issue:** `take` appends stdout and stderr chunks to one `tail`, and `parseSetupLine` accepts only the very last non-empty line. Any stderr text after `EUREKA_SETUP: OK ...` (a late warning, a PowerShell exit message, or a stderr chunk that arrives after the stdout chunk because the two pipes are not ordered) gives `form: 'none'`. PROVEN: `parseSetupLine("EUREKA_SETUP: OK /h/x\nWARN: some trailing stderr\n")` returns `form: 'none'`. Then the person gets "The Eureka setup did not finish" after a setup that finished, and the folder is not saved. A colour code around the line also gives `none` (PROVEN). A chunk boundary inside a multibyte character also breaks the folder text, because `String(chunk)` decodes each chunk alone.
**Fix:** Keep a separate stdout tail with `child.stdout.setEncoding('utf8')`, strip ANSI codes, and use the last line in stdout that starts with `EUREKA_SETUP:`. Add an arm with a stderr line after the OK line.

### WR-03: The consent-critical installer paths have no behavioural test

**File:** `tests/test-395-eureka-setup.cjs:356-385` (S15); `bin/cli.js:110-131`
**Issue:** S15 runs the installer only with `--no-eureka` and with no flag on a pipe. The `--eureka` path, the interactive `y` path, the interactive empty-answer (default No) path and the EOF path are not run. "The card is printed before the approved run" is checked only by the position of two strings in the source (`offer.indexOf`). A change that, for example, accepts an empty answer or skips the card print would pass S15. The fake `curl` on PATH makes the `--eureka` path safe to run in the test.
**Fix:** Add an arm that runs `bin/cli.js --eureka` with the fake `claude` and fake `curl`: assert that the card text comes before "You gave --eureka", that the fake curl log exists (the run started only after the card), and that the exit is 0. Add a pty-based arm (`script -qec` or a small `node-pty`-free helper that sets `isTTY`) for the answers `y`, empty and EOF.

### WR-04: The installer does not check that the card printed before it asks or runs

**File:** `bin/cli.js:110-122`
**Issue:** `const card = enable.run(['--setup'], {})` is not checked. If `run` hits its catch branch (exit 1, empty stdout), the installer still prints the question, and with `--eureka` it starts the setup with no card on screen. That breaks the rule "the card always prints before anything runs" (line 100). ASSUMED rare (it needs an exception in `setupCardFacts`), but the rule is the consent guarantee.
**Fix:**
```js
const card = enable.run(['--setup'], {});
if (!card || card.exitCode !== 2 || !card.stdout) return skip();
```

### WR-05: `--eureka` gives consent before the person can read the card

**File:** `bin/cli.js:118-121`; plan section 12 A1
**Issue:** With `--eureka` the card prints and the setup starts in the same moment, also on a pipe or in CI. The person cannot read what is reached and written before it runs. The plan marks this ASSUMED (A1); it is not an owner ruling. Combined with CR-01, the flag approves writes that the card does not name.
**Fix:** Get an owner ruling on A1. If the ruling keeps the flag, print the card and wait a short abort window (for example 10 seconds on a TTY), or require the flag to be paired with an explicit acknowledgment flag in non-TTY use.

### WR-06: The Windows path runs with a filtered environment that was never tested

**File:** `lib/core/eureka/eureka-engine-enable.cjs:86-90, 376-378`
**Issue:** The engine CI smoke (green on Windows, READ in the plan) runs the script with a full environment. The plugin runs it with an allowlist that drops `SystemDrive`, `USERNAME`, `PROCESSOR_ARCHITECTURE`, `NUMBER_OF_PROCESSORS`, `OS`, `ProgramFiles(x86)`, `ProgramW6432`, `CommonProgramFiles`, `ALLUSERSPROFILE` and `PUBLIC`. Git for Windows, the uv installer, uv and Python can read some of these. The new test exits 77 on win32, and only the command shape is checked (S2, S4). Also, Windows PowerShell 5.1 writes redirected output in the console code page, so a profile path with non-ASCII characters can reach `parseSetupLine` mangled; `modePath` then refuses the folder and the person gets a failure after a good setup (UNVERIFIED).
**Fix:** Add the Windows system variables above to `SETUP_ENV_KEYS`. In `setupOutcome`, when the parsed folder is not a directory, try the default folder before a refusal. Run the setup once on Windows with the plugin command, not only the engine CI, before the cut.

### WR-07: The allowlist drops the network settings that a managed (client) network needs

**File:** `lib/core/eureka/eureka-engine-enable.cjs:65-69, 86-90`
**Issue:** The owner installs at a client. Managed networks often need `UV_INDEX_URL` / `UV_DEFAULT_INDEX` / `PIP_INDEX_URL`, `UV_NATIVE_TLS`, `HF_ENDPOINT`, `ALL_PROXY`, `CURL_CA_BUNDLE`, `GIT_SSL_CAINFO`, `NODE_EXTRA_CA_CERTS`. All of them are removed. The setup then fails at the `engine`, `packages` or `model` step with "Check the network or the proxy", although the person's settings are correct.
**Fix:** Add these names to `SETUP_ENV_KEYS` (they carry no room data and no Brain key). Keep the `CLAUDE_` and `MINDRIAN_BRAIN_` exclusion, and extend S11 to assert that the new names pass.

### WR-08: Failure texts point to the wrong cause in two common cases

**File:** `lib/core/eureka/eureka-engine-enable.cjs:99, 380, 697-699`
**Issue:** (a) The engine script fails the `tools` step both for "git is missing" and for "uv install failed". The Fix text is always "Install git, then run ... again", which is wrong for the uv case. (b) The outer command is `bash -c 'curl -fsSL "$0" | bash'` with no `pipefail`. When `curl` is missing or the download fails, the inner bash reads nothing and exits 0, so the person gets "It stopped without its result line (exit 0)" and "Check that the network works", also when the cause is a missing `curl`. A truncated download also runs a partial script.
**Fix:** Use `set -o pipefail; command -v curl >/dev/null || { echo "EUREKA_SETUP: FAIL tools curl is missing"; exit 1; }; curl -fsSL "$0" -o "$f" && bash "$f"` (download to a temp file, then run it). Change the `tools` Fix to "Install the tool named above (git or uv), then run ... again".

### WR-09: The text that the person reads after a successful setup contradicts what the setup did

**File:** `lib/core/eureka/eureka-engine-enable.cjs:250, 304`; `commands/eureka.md:224, 226`; `docs/integrations/mindrian-eureka-engine.md:73, 89`
**Issue:** After an OK result, `setupOutcome` prints the `--path` report, which says "This command prepares only part 1" and "2 Model folder (you place it; the engine never downloads one)", right after the setup downloaded the model. `commands/eureka.md:226` still tells Larry "The plugin never downloads a model. The plugin never installs uv, Python or Node.js", and line 224 keeps "The plugin does not download or include the engine." next to "`--setup` gets the whole engine for you". The engine guide line 73 says "You need a `mindrian-eureka` folder that you already have." Larry reads these lines as instructions and can deny the setup that he just ran.
**Fix:** Change the part 2 label to "Model folder (the one-step setup downloads it, or you place it)" and the line 304 text to name `--setup`. Reword `commands/eureka.md:226` to "Outside `--setup`, the plugin never downloads a model ...". Keep the W8 sentence, but add "on its own" in the next sentence, as the README does.

### WR-10: The engine code that the approved setup runs is not pinned

**File:** `lib/core/eureka/eureka-engine-enable.cjs:79-83`; `README.md:101`; `mindrian-eureka@9b91d25:scripts/setup-mindrianos.sh:29-31`
**Issue:** Owner ruling 34 pins the setup scripts, but the script clones or fast-forwards the engine at `main`, then runs `uv sync` (build backends) and `uv run eureka doctor` from that code, with the person's HOME and file access. A bad push to `main` runs on every client that approves the setup. The card says "the newest engine code", but the README says "with the setup steps tested for this MindrianOS version", which a reader can take as a pin of the code. This is a known limit (plan 11, summary), not a new defect, but it is the largest supply-chain exposure of this slice.
**Fix:** Keep the request to jsagi-96 (`MINDRIAN_EUREKA_REF`) as a release blocker for the cut that advertises the step at a client, or state on the README line that the engine code is the newest public version.

## Info

### IN-01: EOF or Ctrl-C at the y/N question ends the installer with no message

**File:** `bin/cli.js:123-131`
**Issue:** On EOF the `rl.question` callback never fires. Node exits 0 with no "Skipped" line and without the "Verify:" and "Start:" lines (PROVEN with a scratch readline at EOF).
**Fix:** Listen to `rl.on('close', ...)` and resolve as No when no answer came.

### IN-02: `--eureka` together with `--no-eureka` means yes

**File:** `bin/cli.js:215`
**Fix:** Treat the pair as a conflict and choose No (the safe choice), or refuse the pair.

### IN-03: `--json` is ignored for the approved setup, and the streamed output goes to the same stdout

**File:** `lib/core/eureka/eureka-engine-enable.cjs:703-716`
**Fix:** Refuse `--json` with `--approved-via`, or stream to stderr and print one JSON result.

### IN-04: `EUREKA_SETUP: OK engine-only` without a folder is parsed as the folder `engine-only`

**File:** `lib/core/eureka/eureka-engine-enable.cjs:633-634` (PROVEN: `parseSetupLine("EUREKA_SETUP: OK engine-only\n")` gives `folder: 'engine-only'`)
**Fix:** Match `^EUREKA_SETUP: OK engine-only(?: (.+))?$` first and fall back to the default folder.

### IN-05: The setup child inherits the current folder

**File:** `lib/core/eureka/eureka-engine-enable.cjs:406`
**Issue:** No `cwd` is set, so inside Claude Code the child starts in the room or project folder. The script uses absolute paths, so no room data is read (READ), but a fixed `cwd: homeOf(env)` removes the dependency.

### IN-06: The check is printed twice after an OK result

**File:** `lib/core/eureka/eureka-engine-enable.cjs:691`
**Issue:** The engine script step 6 prints `--check | tail -12`, then `setupOutcome` prints the `--path` report again. The screen shows two check blocks.

### IN-07: `--approved-via gate` is accepted, but no gate path runs `--setup`

**File:** `lib/core/eureka/eureka-engine-enable.cjs:704`
**Issue:** The approval is a self-asserted flag (the same pattern as `--sync`). Nothing records that the F.0 card was answered. Acceptable for this slice; record it as a known limit.

### IN-08: The installer "later" line points to a flag that the installed plugin can lack

**File:** `bin/cli.js:103`
**Issue:** With `--version <older>`, or while the marketplace is behind npm, the installed plugin has no `--setup`, and the suggested command answers "Unknown flag". The card from the npm package also describes the npm version, not the installed one.

### IN-09: On Windows the card can name a different engine folder than the script uses

**File:** `lib/core/eureka/eureka-engine-enable.cjs:131, 646`
**Issue:** `homeOf` prefers `HOME` (set by Git Bash on many Windows machines); PowerShell `$HOME` follows `USERPROFILE`. The save uses the folder from the result line, so the pointer is correct, but the card text can be wrong.

---

STATUS: DONE
CHANGED: .planning/phases/395-selection-by-job-the-user-s-confirmed-job-is-the-first-key-o/395-11-REVIEW.md (new, not committed). No source file changed.
VERIFIED: the 12 test commands of plan section 7 passed (table above); the no-approval card wrote nothing in a fresh HOME; the kill reproduction and the parseSetupLine probes (WR-01, WR-02, IN-04) ran in the scratchpad.
UNVERIFIED: the real setup with network; Windows and macOS; a TTY run of the installer; the uv installer profile edits (CR-01 item 3) and the PowerShell code page effect (WR-06).
RISKS: CR-01 and WR-01 change files of the person outside the card; WR-02 can report a failure after a good setup; WR-06 and WR-07 can fail at a client site.
NEXT: Fix CR-01 (card text) and WR-01 to WR-04 in a 395-11 follow-up plan before the cut; get an owner ruling on A1 (WR-05).

_Reviewed: 2026-11-16T03:00:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
