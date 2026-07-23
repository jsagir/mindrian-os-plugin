---
status: resolved
kind: rca
trigger: "Windows-only, fourth defect in the same lineage as windows-room-registry-path-normalization-gap / windows-os-rename-registry-wedge / windows-python-interp-and-shim: the Defect A/B fix's own bash-routed Python probe helper (three independently hand-duplicated copies across the Windows regression test files) passes the probe SOURCE as a positional spawnSync argv element, which survives on Linux/macOS but is corrupted by Windows CreateProcess/CommandLineToArgvW-style argv re-quoting when the source contains a backslash immediately followed by a quote character. Found via a cross-platform verification pass on the reporter's own Windows machine (a separate Claude Code session), which also confirmed 73/75 prior tests still pass post Defect A/B fix."
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: tier-0
canon_parts: []
created: 2026-07-23T00:00:00Z
updated: 2026-07-23T00:00:00Z
resolved: 2026-07-23T00:00:00Z
classification: NEW FAILURE
related:
  - .planning/debug/resolved/windows-room-registry-path-normalization-gap.md
  - .planning/debug/resolved/windows-os-rename-registry-wedge.md
  - .planning/debug/resolved/windows-python-interp-and-shim.md
---

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: CONFIRMED. Three test files in the room-registry Windows regression
family (test-room-registry-windows-atomic-replace.cjs, test-room-registry-windows-python-interp.cjs,
test-room-registry-windows-path.cjs) each independently implement the identical
helper pattern established by windows-python-interp-and-shim.md's Defect B fix:
spawn bash with a small wrapper script that resolves python3/python via bash's
own PATH lookup (so a hand-rolled shebang shim resolves), then pass the actual
Python probe SOURCE as a POSITIONAL bash argument (`$1`), never interpolated
into the `-c` string, specifically so the probe's own quotes and newlines
survive Defect A (SyntaxError-on-backslash-interpolation).

That approach is fully correct on Linux/macOS -- verified live on this Linux
dev box today, both before and after this fix (byte-identical PASS counts:
21/21, 29/29, 25/25).

On Windows it is NOT correct. Node's `child_process.spawnSync('bash', [...])`
invokes Git-Bash's `bash.exe`. Windows process creation does not pass argv as
a pre-split array the way POSIX exec() does -- the OS/CRT boundary
(CreateProcess + the CommandLineToArgvW-style parsing every Windows child
process performs on its own single command-line string) re-quotes and
re-splits the arguments Node hands it. When one of those arguments -- here,
the probe SOURCE string -- contains a backslash immediately followed by a
quote character (a shape that is common in exactly these Python probes: a
Windows path or a regex ending a string literal, e.g. `p[2:].replace('/', '\\')`
in the normwin probe's own body), that backslash-quote sequence is silently
eaten or reinterpreted during the Windows argv reconstruction. The probe
source arrives at bash already corrupted, before bash's own `$1` expansion
ever runs. This is a distinct failure layer from Defect A (Python
compile-time interpolation) and Defect B (spawnSync interpreter-resolution) --
it corrupts the argv marshalling itself, one layer further down the same call
chain (Node spawnSync -> Windows CreateProcess -> bash.exe), and it does not
reproduce on Linux/macOS, where argv is passed as a real array with no
OS-level re-quoting step.

FOUR-CHAPTER LINEAGE (one disease, "authored and tested only on Linux/WSL
never survives contact with a real Windows CreateProcess boundary", four
distinct trigger conditions):
  1. windows-room-registry-path-normalization-gap (2026-05-23): Git Bash's
     POSIX-form $HOME leaks into Python's native-Windows open(); fixed by
     adding normwin().
  2. windows-os-rename-registry-wedge (2026-07-23 AM): os.rename's Windows
     overwrite-semantics gap; fixed os.rename -> os.replace.
  3. windows-python-interp-and-shim (2026-07-23): Defect A (backslash values
     interpolated into Python source SyntaxError before normwin can run) +
     Defect B (spawnSync('python3', ...) cannot resolve a bash-PATH-only
     shebang shim on Windows CreateProcess); fixed via sys.argv passing +
     bash-routed spawn with the probe source as a positional $1 argument.
  4. THIS RCA (Defect C): the Defect B fix's OWN mechanism -- passing the
     probe source as a spawnSync argv element -- is itself unsafe on Windows,
     because Windows argv marshalling (not bash, not Python) can corrupt a
     backslash-adjacent-to-quote sequence in that argv element before bash
     ever sees it. Confirmed on the reporter's Windows box; does not
     reproduce on Linux/macOS (this dev box), because POSIX exec() passes a
     real pre-split argv array with no re-quoting step.

fix: eliminate the defect class rather than special-case which characters are
unsafe: stop passing the probe SOURCE as a spawnSync argv element entirely.
Write the probe body to a real temp `.py` file (via `fs.writeFileSync` into
`os.tmpdir()`, matching each file's existing `makeTmpHome()`-style temp-file
convention) and have bash `exec python3 <file>` / `exec python <file>` -- the
FILE PATH (not the file's contents) is the one argv element that crosses the
Windows CreateProcess boundary. A short path with no embedded
quote/backslash-adjacent-quote sequences survives Windows argv marshalling
intact regardless of what the probe source itself contains. The wrapper's
own flag changes together with the invocation: `python3 -c "$1"` (execute $1
as inline source) becomes `python3 "$1"` (execute $1 as a script file path) --
removing only `-c` without changing the call would try to execute the path
STRING as Python source, not run the file, so both changed together or the
fix is incomplete.

Per-file conversion (all three call sites/files named in the trigger):
  - tests/test-room-registry-windows-atomic-replace.cjs: `runPythonProbe(probeSrc)`
    (single call site, the os.replace-semantics probe in Part 2) now writes
    `probeSrc` to a temp file, execs the file path, and removes the temp file
    in a `finally` block. Existing Defect B comment block preserved; Defect C
    addendum appended alongside it (not replacing it).
  - tests/test-room-registry-windows-python-interp.cjs: `runPython(src)`
    converted identically (its one call site, the old-pattern-breaks control
    in Part 2, is unaffected in intent -- it still compiles the SAME
    backslash-embedding Python source text and still throws the same
    unicodeescape SyntaxError, since the fix changes only HOW that source
    text reaches bash/python, not what the text contains). A second,
    independent manual spawnSync call in the same file's Part 2 (the
    "new sys.argv pattern" demonstration) was left untouched: it does not go
    through `runPython`, and neither its fixed literal Python body nor the
    adversarial WINPATH value it passes as a separate sys.argv element
    contains a backslash-immediately-before-quote sequence, so it is not
    exposed to Defect C and is out of this fix's stated scope (three named
    call sites, mechanical fix only, no rewrite of surrounding test logic).
  - tests/test-room-registry-windows-path.cjs: the inlined wrapper in
    `normwinShimUnit()` (not previously factored into a helper function)
    converted the same way in place. This file's own probe is the clearest
    concrete instance of the vulnerable shape: its `normwin()` reimplementation
    contains `p[2:].replace('/', '\\')`, i.e. a backslash immediately followed
    by a closing quote, in the Python source text it sends across the spawn
    boundary -- exactly the pattern Defect C targets.

Preserved in all three files, byte-for-byte: every existing SKIP-on-
`__NO_PYTHON__` branch, assert message, and surrounding comment/test-logic
style. This is a targeted mechanical fix to the spawn mechanism only.

verification: All gates green on this Linux dev machine (no Windows runtime
available in this environment; see caveat below).
  - tests/test-room-registry-windows-atomic-replace.cjs: 21/21 PASS (unchanged
    count vs. pre-fix, matching windows-python-interp-and-shim.md's own
    verification of this same file).
  - tests/test-room-registry-windows-python-interp.cjs: 29/29 PASS (unchanged
    count), including both the old-pattern-still-breaks control and the
    new-pattern-still-works control.
  - tests/test-room-registry-windows-path.cjs: 25/25 PASS (unchanged count).
  - Caller-level regression, unaffected (room-registry CLI interface itself
    was not touched -- only the TEST HARNESS's own probe-spawn mechanism
    changed): test-room-registry-path-resolution.cjs 25/25, test-tool-router-active-room-misroute.cjs
    ALL PASS, test-room-state-active-room-misroute.cjs ALL PASS,
    test-204-room-chooser.cjs 49/49, test-room-birth.cjs 35/35,
    test-127.2-04-windows-path-and-update-activation.sh 16/16.
  - scripts/verify-release: 27 passed / 0 failed / 3 warnings, "CLEAR TO
    RELEASE v1.15.3-beta.41". Section 15 Windows-Unsafe Rename Primitive gate
    still passes (no bare os.rename reintroduced; unrelated to this fix but
    confirmed unbroken). Warnings are expected/benign (uncommitted changes --
    this fix; no CHANGELOG entry for beta.41 -- none intended, see Non-Code
    Follow-ups below).
  - No em-dashes in any of the three touched files (grepped directly, zero
    hits).
  CAVEAT (same shape as all three prior RCAs in this lineage before their live
  Windows re-verification arrived): the Windows-specific failure mode itself --
  Windows CreateProcess/argv-marshalling corrupting a backslash-adjacent-quote
  sequence in a spawnSync argv element -- cannot be re-verified live in THIS
  Linux dev environment (no Windows runtime here). The ROOT CAUSE diagnosis
  and this fix's DIRECTION were reported as already confirmed live on the
  reporter's own Windows machine, in a separate Claude Code session running a
  cross-platform verification pass that also confirmed 73/75 of the prior
  suite's tests pass post Defect A/B. The SPECIFIC CODE in this commit,
  however, is new since that verification pass and has NOT itself been
  executed on Windows yet -- that re-verification is PENDING the user's next
  Windows-side dogfood pass, exactly like the precedent in
  windows-python-interp-and-shim.md's own CAVEAT. The fix is behaviorally
  transparent on Linux/macOS: it changes nothing about what already passed
  here, only how the argv boundary is crossed.

files_changed: tests/test-room-registry-windows-atomic-replace.cjs (Defect C
fix to `runPythonProbe`), tests/test-room-registry-windows-python-interp.cjs
(Defect C fix to `runPython`), tests/test-room-registry-windows-path.cjs
(Defect C fix to the inlined `normwinShimUnit` probe wrapper).

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED. See Resolution.root_cause.
test: three affected test files re-run individually plus the caller-level
regression set plus scripts/verify-release; all green, all PASS counts
byte-identical to pre-fix.
expecting: on Windows, the probe source is no longer an argv element at all
(only a short temp-file PATH is), so Windows CreateProcess/argv-marshalling
has nothing backslash-adjacent-to-quote to corrupt regardless of what any
current or future probe body contains. CONFIRMED behaviorally-transparent on
Linux; Windows-specific re-verification of this exact commit awaits the
reporter's next dogfood pass.
next_action: DONE. Fix applied at all three call sites; all touched-file
suites green; full caller-level regression green; verify-release CLEAR; RCA
resolved and archived. Windows re-verification of this specific commit is the
only open item, tracked in the CAVEAT above (not a blocking gate for this
session per the established precedent).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.41
- Reported by: Jonathan, via a separate Claude Code session on his own Windows
  machine running a cross-platform verification pass over the just-shipped
  Defect A/B fix (windows-python-interp-and-shim.md); that pass confirmed
  73/75 of the prior suite's tests pass and identified this argv-marshalling
  defect in the fix's own probe-spawn helper.
- Related, resolved (full lineage, oldest first):
  .planning/debug/resolved/windows-room-registry-path-normalization-gap.md
  (chapter 1, normwin's origin),
  .planning/debug/resolved/windows-os-rename-registry-wedge.md
  (chapter 2, os.rename -> os.replace),
  .planning/debug/resolved/windows-python-interp-and-shim.md
  (chapter 3, Defect A sys.argv conversion + Defect B bash-routed spawn --
  this RCA's Defect C is the fix-of-the-fix for that chapter's Defect B
  mechanism).
- Do NOT touch: anything under ~/.claude/plugins/mindrian-os/ (install cache,
  a ghost patch per this repo's WORKSPACE GUARD). Also explicitly out of
  scope for this fix: scripts/room-registry, scripts/resolve-room,
  scripts/update-icm-index, scripts/on-cwd-changed (production code -- this
  defect is confined to the TEST HARNESS's own probe-spawn mechanism;
  production code never spawns Python probes via bash the way these tests
  do), and the already-fixed Defect A (sys.argv interpolation) / Defect B
  (shim/PATH resolution via bash) mechanisms themselves, which stay exactly
  as they are.

## Problem Statement

The three Windows regression test files that Defect B's fix (windows-python-interp-and-shim.md)
routed through bash for PATH/shim resolution each pass the Python probe
SOURCE as a positional spawnSync argv element to survive Defect A/B. On
Windows, Node's spawnSync('bash', [...]) crosses a CreateProcess/argv-marshalling
boundary that POSIX exec() does not have; a probe source containing a
backslash immediately followed by a quote character (common in these Python
probes -- a Windows path or a regex ending a string literal) is silently
corrupted by that boundary before bash's own `$1` expansion runs. This is
test-harness-only (no production script is affected) but it means the
regression suite meant to PROVE the Defect A/B fix works on Windows was
itself unreliable on Windows -- a false-negative-generating gap in the very
tests that exist to catch Windows-only regressions in this file family.

Surfaces are [cli, desktop, cowork] in the sense that all three shell out to
the same scripts/* family this test suite exists to protect; the actual
defect here lives entirely in the TEST HARNESS, invisible to the Tri-Polar
matrix by construction (no host-OS axis), the same structural gap the three
prior RCAs in this lineage each noted.

## Evidence

- timestamp: 2026-07-23T00:00:00Z
  finding: |
    Direct read of all three call sites confirmed the trigger's claimed shape
    byte-for-byte before any fix was applied:
      - test-room-registry-windows-atomic-replace.cjs:120-129 `runPythonProbe`
      - test-room-registry-windows-python-interp.cjs:99-105 `runPython`
      - test-room-registry-windows-path.cjs:~184-188 (inlined, not factored
        into a helper)
    All three: `spawnSync('bash', ['-c', wrapper, 'bash', probeSrc], ...)`
    with `probeSrc` as a positional bash argv element and the wrapper using
    `python3 -c "$1"` / `python -c "$1"`.
  source: live grep + Read of this repo, this session

- timestamp: 2026-07-23T00:00:00Z
  finding: |
    test-room-registry-windows-path.cjs's own normwin() probe body contains
    the exact vulnerable shape: `p[2:].replace('/', '\\')` -- a backslash
    character immediately followed by a closing single-quote in the Python
    source text sent across the spawn boundary. This is the concrete,
    already-in-repo instance of the class the reporter's Windows repro hit,
    confirming the diagnosis is grounded in this file's actual content, not
    a hypothetical.
  source: live Read of tests/test-room-registry-windows-path.cjs, this session

- timestamp: 2026-07-23T00:00:00Z
  finding: |
    Reported: a separate Claude Code session on the reporter's own Windows
    machine ran a cross-platform verification pass over the Defect A/B fix,
    confirmed 73/75 prior tests pass, and found this argv-marshalling defect
    live -- attributed to Windows CreateProcess/CommandLineToArgvW-style argv
    re-quoting corrupting a backslash-adjacent-to-quote sequence in the probe
    source before bash's own $1 expansion runs. This session (Linux) could not
    independently execute this repro; it is recorded here as reporter-sourced
    evidence, the same evidentiary status the prior three RCAs in this
    lineage each gave to reporter-supplied Windows tracebacks.
  source: reported by Jonathan (relayed from the separate Windows-side Claude
    Code session), this session

- timestamp: 2026-07-23T00:00:00Z
  finding: |
    Post-fix, all three touched files re-run individually on this Linux dev
    box: 21/21, 29/29, 25/25 PASS -- byte-identical counts to the pre-fix
    baseline recorded in windows-python-interp-and-shim.md's own verification.
    Caller-level suites (path-resolution, tool-router/room-state misroute,
    204 chooser, room-birth, 127.2-04) and scripts/verify-release (27/0/3,
    CLEAR TO RELEASE) also unaffected. Confirms the fix is behaviorally
    transparent on Linux/macOS, as required.
  source: live test runs, this session

## Eliminated

(none -- the defect was confirmed on first pass via direct Read/grep of all
three call sites against the reporter's already-diagnosed root cause, the
in-repo normwin() probe supplied a concrete already-existing instance of the
vulnerable shape, and the fix's design -- eliminate the defect class via a
temp-file path instead of special-casing unsafe characters -- required no
alternative hypotheses to rule out)
</content>
