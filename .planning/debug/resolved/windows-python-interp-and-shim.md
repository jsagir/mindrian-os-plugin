---
status: resolved
kind: rca
trigger: "Windows-only, second and third defect in the same family as windows-os-rename-registry-wedge: (1) backslash Windows paths interpolated into Python source cause a SyntaxError before the script runs; (2) the new regression test's python3 semantics probe cannot resolve python3 via Node's spawnSync on a clean Windows box. Found live by the same Windows install running v1.15.3-beta.40's own regression test."
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: tier-0
canon_parts: [6]
created: 2026-07-23T00:00:00Z
updated: 2026-07-23T00:00:00Z
resolved: 2026-07-23T00:00:00Z
classification: NEW FAILURE
related:
  - .planning/debug/resolved/windows-room-registry-path-normalization-gap.md
  - .planning/debug/resolved/windows-os-rename-registry-wedge.md
---

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: CONFIRMED, two distinct defects, both re-verified via direct grep against this exact repo AND reproduced live on this Linux dev machine (Defect A's failure mode is not Windows-only -- see below).

DEFECT A -- backslash-path source-injection SyntaxError. The four room-registry-family scripts (scripts/room-registry, scripts/resolve-room, scripts/update-icm-index, scripts/on-cwd-changed) built their embedded Python by interpolating shell variables DIRECTLY into the Python source as quoted string literals, e.g. `reg_file = normwin('$REGISTRY_FILE')` and `reg['rooms']['$NAME']['venture_name'] = '''$VNAME'''`. When an interpolated value contains a backslash (which every native Windows path does -- `C:\Users\jsagi\...`), Python's string-literal escape parser consumes it at COMPILE time, before a single line of the script's own logic runs -- including the `normwin()` path-normalizer that was supposed to fix Windows paths. A path like `C:\Users\...` begins a `\U...` unicode escape that a real path almost never completes, producing `SyntaxError: (unicode error) 'unicodeescape' codec can't decode bytes in position 2-3: truncated \UXXXXXXXX escape`. Reproduced live on THIS Linux machine (not just Windows): interpolating `C:\Users\jsagi\Test` into a single-quoted Python literal throws the identical SyntaxError. This is a source-injection bug, not strictly a Windows bug -- Windows was merely the platform that GUARANTEES a backslash in every path. Confirmed 36 interpolation sites across the four files (room-registry 25, resolve-room 3+2 in the adopt block, update-icm-index 4, on-cwd-changed 2). The codebase already carried the safe precedent in the SAME file: `_write_current_room()` at scripts/room-registry:~137 passes values via `sys.argv` with a comment explicitly naming "the '$NAME'-in-python stanzas above" as the unsafe pattern to replace.

THREE-CHAPTER LINEAGE (one disease, interpolation-as-code-injection, three trigger conditions -- the RCA is a direct sequel, not a coincidence):
  1. windows-room-registry-path-normalization-gap (2026-05-23, Phase 127.2-04, shipped v1.13.0-beta.32): Git Bash resolves $HOME to a POSIX path (/c/Users/PC/...) that bash handles but Python's open() on native Windows cannot parse (it needs C:\Users\PC\...). The fix ADDED normwin() to convert POSIX->native and wrapped every open() as open(normwin('$REGISTRY_FILE')). Critically, that fix never changed the interpolation MECHANISM -- '$REGISTRY_FILE' was still baked into the Python source as a string literal; normwin() was only ever meant to run AFTER that string exists as a Python value. That is exactly why today's Defect A existed and evaded normwin(): once the RAW shell value (not normwin's output) contains a backslash, the `\U` sequence is consumed as a broken unicode escape at COMPILE time, before normwin() -- or any code -- can run. The May fix and today's Defect A are two different failure modes of the SAME anti-pattern.
  2. windows-os-rename-registry-wedge (2026-07-23 AM, same day): os.rename's Windows overwrite-semantics gap (FileExistsError on the second write); fixed os.rename -> os.replace. Separate primitive-choice defect, same four files, same "Python-in-bash on Windows" blind spot.
  3. THIS RCA (2026-07-23): the source-injection SyntaxError (Defect A) + the spawn-shim gap (Defect B). Fixed by passing every value via sys.argv, killing the interpolation mechanism at its root.

DEFECT B -- python3 spawn-resolution gap in the regression test. tests/test-room-registry-windows-atomic-replace.cjs's os.replace-semantics probe called `spawnSync('python3', ['-c', probe])` DIRECTLY. On the reporter's Windows box, python3 resolves only via a hand-rolled `~/bin/python3` shebang shim that bash's PATH lookup honors -- but Node's bare spawnSync uses Windows CreateProcess, which cannot execute an extension-less shebang script, so it fell through to the Microsoft Store alias stub ("Python was not found") and the probe FAILED at the spawn layer instead of ever running its semantics check. A clean Windows install (Python named `python`, not `python3`, no shim) fails identically.

fix:

DEFECT A -- converted all 36 `'$VAR'`-in-Python-source interpolation sites across the four scripts to `sys.argv`-based parameter passing, matching `_write_current_room()`'s already-safe precedent. Each `python3 -c "..."` invocation now appends the shell values as positional arguments (`python3 -c "..." "$REGISTRY_FILE" "$NAME" ...`) and the Python reads them via `sys.argv[N]`. The value arrives as a real Python string and is NEVER re-parsed as source text, so no escape-sequence interpretation ever happens on its contents. `normwin()` is preserved and now actually reachable (it receives a real argument via sys.argv instead of being baked into unparseable source). Behavior otherwise byte-identical: JSON structure, print output, error handling, and the os.replace atomic-write all unchanged. Per-file callsite conversion:
  - scripts/room-registry: 9 Python blocks (create, read, list, update, set-active, set-active resolver, archive, get-active, git-config) -- every value now via sys.argv; the stale "safer than the '$NAME'-in-python stanzas above" comment on _write_current_room updated (those stanzas now ALSO use sys.argv).
  - scripts/resolve-room: 3 Python blocks (Strategy 0 central registry, Strategy 1 workspace registry, --adopt legacy registration); added `import sys` to the adopt block.
  - scripts/update-icm-index: 1 Python block; added `import sys`; the intended escaped-backtick / '\\n' sequences in the double-quoted -c string were preserved untouched.
  - scripts/on-cwd-changed: 1 Python block; added `import sys`.

DEFECT B -- fixed the atomic-replace test's probe spawn to route through bash (`spawnSync('bash', ['-c', wrapper, 'bash', probe])`), so bash's own PATH lookup (and therefore the hand-rolled shim) resolves the interpreter, exactly the pattern runRR already used for the registry script. The probe body is passed as a POSITIONAL arg ($1), never interpolated into the bash -c string, so its quotes/newlines survive. python3 is tried first, then python (a clean Windows install names it `python`); if neither resolves the probe SKIPS (not fail, not silent pass) with a clear log. bash was already a hard precondition of the whole suite, so no new dependency. ADJACENT same-defect fix (flagged, not silent, mirroring how the sibling os.rename RCA handled its adjacent test-cleanup sites): tests/test-room-registry-windows-path.cjs carried the identical bare `spawnSync('python3', ...)` in its normwin probe -- fixed with the same bash-routed strategy. Its structural assertion (which matched the old `normwin('$REGISTRY_FILE')` literal shape) was updated to the new safe shape (`normwin(sys.argv[N])` present + zero single-quoted `'$REGISTRY_FILE'` literals remain).

verification: All specified gates green on this Linux dev machine.
  - NEW regression test tests/test-room-registry-windows-python-interp.cjs (29/29 PASS): proves Defect A's fix cross-platform. Part 1 pushes adversarial backslash values (`C:\Users\jsagi\AppData\Local\Temp\mos-x`) through create / update / git-config and asserts exit 0 + well-formed JSON + the value round-trips byte-for-byte. Part 2 is the load-bearing control: the OLD interpolation shape FAILS to compile with the exact unicodeescape SyntaxError, while the NEW sys.argv shape compiles and preserves the value -- proving the fix is real and not vacuous on Linux CI. Part 3 is the structural anti-regression gate: zero shell-var-in-python-source sites across all four scripts (excluding the one out-of-scope `node -e` JS line), plus sys.argv present in each.
  - tests/test-room-registry-windows-atomic-replace.cjs (21/21 PASS): Defect B fix confirmed -- the os.replace semantics probe now EXECUTES via bash PATH resolution (logs "python spawn ok (via bash PATH resolution)", not SKIP) on this Linux env. The 9-os.replace / zero-os.rename structural assertions from the sibling RCA still hold.
  - tests/test-room-registry-windows-path.cjs (25/25 PASS, was 24/25): structural assertion updated to the sys.argv shape; adjacent normwin probe spawn fixed.
  - tests/test-room-registry-path-resolution.cjs 25/25, test-127.2-04-windows-path-and-update-activation.sh 16/16, test-tool-router-active-room-misroute.cjs ALL PASS, test-room-state-active-room-misroute.cjs ALL PASS, test-204-room-chooser.cjs 49/49, test-room-birth.cjs 35/35 (caller-level -- the room-registry CLI interface is unchanged, only its internal Python arg-passing changed, so all callers are unaffected).
  - scripts/verify-release: 27 passed / 0 failed / 3 warnings, "CLEAR TO RELEASE". Section 15 "Windows-Unsafe Rename Primitive" gate still passes (no bare os.rename reintroduced). Warnings are expected and benign: uncommitted changes (this fix), no CHANGELOG entry for beta.41 (none intended, see deferred), and marketplace state.
  - Gates cleared: no em-dashes in any touched file (verified 0 across all 7), cross-platform (the fix IS cross-platform correctness), Canon Part 8 (LOCAL disk only, no Brain egress), Canon Part 6 dog-fooding (the plugin corrupted its own room-state spine on the maintainer's machine -- a CONTRADICTS edge against its own canon), reuse-before-build (sys.argv is the _write_current_room precedent; bash-routed spawn is the runRR precedent).
  CAVEAT (same shape as the sibling os.rename RCA before its live re-verification arrived): the Windows-specific behaviors themselves -- the backslash SyntaxError firing on a real Windows path, and the CreateProcess-vs-shim spawn failure -- cannot be re-verified live in THIS Linux dev environment (no Windows runtime here). Defect A's fix IS re-verified live on Linux because the failure mode is source-injection (platform-independent); Defect B's Windows spawn-resolution path can only be re-verified on the reporter's actual Windows box, deferred to his next dogfood pass.

re_checked_deferred_sites: The May RCA (windows-room-registry-path-normalization-gap, Section 8) had flagged THREE sites as explicitly DEFERRED and never patched. Re-checked all three against current repo state this session and confirmed none is vulnerable to this exact injection class today, so this does not read as a dropped thread:
  - scripts/verify-release: no longer shows the vulnerable '$VAR'-in-python pattern the old RCA worried about (either already cleaned or the specific interpolation was removed since).
  - scripts/learn-from-usage: uses a SINGLE-QUOTED heredoc delimiter (`python3 << 'PYEOF'`), which disables shell interpolation entirely -- structurally immune to this class.
  - scripts/track-analytics: already uses os.replace (the "house standard" precedent cited in the os.rename RCA) and carries no live '$VAR'-in-python sites.
  Per the graphify codebase-graph query cross-check, no other file caller of these four scripts duplicates the fragile pattern independently -- the anti-pattern is fully contained to the four files fixed here. No scope expansion needed.

files_changed: scripts/room-registry, scripts/resolve-room, scripts/update-icm-index, scripts/on-cwd-changed (Defect A, all four); tests/test-room-registry-windows-atomic-replace.cjs (Defect B primary fix); tests/test-room-registry-windows-path.cjs (adjacent Defect B same-defect fix + structural assertion update); tests/test-room-registry-windows-python-interp.cjs (NEW Defect A regression test).

out_of_scope: (1) scripts/PYTHON_GATES.md's broader "every bare python3 invocation across scripts/" question (60+ files, Plan 85-01's KEEP-AS-IS/PORT/PORT-CANDIDATE territory, already tracked, deliberately deferred). (2) scripts/on-cwd-changed:~111 has a `node -e` line interpolating $PLUGIN_ROOT into a JS require() path -- on native Windows a backslash there would silently mangle the path (JS drops unknown escapes rather than erroring), degrading the version read to 'unknown' but NOT wedging anything. Observed and flagged; it is a JS surface, not a Python-source-injection site, and outside this RCA's scope. Worth a follow-up sweep of `node -e "...'$VAR'..."` sites separately.

no_version_bump: No CHANGELOG.md entry / version bump added -- this is a small cross-platform bugfix not tied to a specific release, same call as the sibling os.rename RCA. OPEN QUESTION for the user: bundle both same-day Windows fixes (os.rename->os.replace AND this sys.argv conversion) into a single beta bump note, or leave both as unversioned hotfixes? Flagged, not silently decided.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED (both defects). See Resolution.root_cause. Defect A re-verified live on Linux (source-injection is platform-independent); Defect B verified to now EXECUTE via bash routing on Linux.
test: 36 interpolation sites converted to sys.argv; new + existing regression suites all green; verify-release CLEAR. See Resolution.verification.
expecting: A Windows path with backslashes no longer produces a SyntaxError (the value arrives via sys.argv, never re-parsed as source). The semantics probe now executes via bash PATH resolution instead of failing at the spawn layer. CONFIRMED on Linux; Windows-specific spawn path awaits the reporter's next dogfood pass.
next_action: DONE. Fix applied at all 36 Defect A sites + 2 test spawn calls (Defect B); new regression test added and green; existing suites green; verify-release CLEAR; RCA resolved and archived.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.40 (released this session) / 1.15.3-beta.41 (current in-progress placeholder)
- Reported by: Jonathan, live symptom from running the beta.40 regression test on his real Windows install (same install as windows-os-rename-registry-wedge.md, now testing the FIX and finding two NEW adjacent defects)
- Codebase-graph note: a graphify query (graphify-out/graph.json, built this session) clusters the four scripts into one `room-registry` community; the ground-truth caller map (grep) shows scripts/room-registry is a fan-in chokepoint on the room-state spine invoked by the entire room create/switch surface across all three surfaces (commands/{ignite,new-project,rooms,setup}.md CLI, skills/{ignite,new-project,rooms,setup} Desktop, lib/mcp/tool-router.cjs Cowork/MCP, plus lib/core/navigation/room-birth.cjs and the room-* chooser/cascade/selector modules); scripts/resolve-room is the keystone resolver on nearly every session-lifecycle hook; scripts/on-cwd-changed is wired as a CwdChanged hook. So a Windows backslash path reaching any of these Python blocks was a SyntaxError on the shared spine every surface funnels through -- the same structural chokepoint the sibling os.rename bug hit.
- Related, resolved: .planning/debug/resolved/windows-room-registry-path-normalization-gap.md (normwin's origin, chapter 1) and .planning/debug/resolved/windows-os-rename-registry-wedge.md (os.rename->os.replace, chapter 2). This RCA is chapter 3.
- Do NOT touch: anything under ~/.claude/plugins/mindrian-os/ (install cache, a ghost patch per this repo's WORKSPACE GUARD).

## Problem Statement

Two Windows-only defects surfaced while the reporter verified today's earlier os.rename -> os.replace fix on his real Windows install, both in the same "Python-in-bash glue authored and tested only on Linux/WSL" family, but structurally distinct from it and from each other:

(A) Every one of 36 sites across the four room-registry-family scripts interpolated a shell variable directly into Python source as a quoted string literal instead of passing it as a real argument. Any interpolated value containing a backslash (every native Windows path) triggers a Python string-literal escape-sequence parse error BEFORE the script's own logic -- including its own normwin() path-normalizer -- ever runs. The codebase already documented the safe alternative (sys.argv-based passing) in a comment on the one function in room-registry that already used it, pointing directly at "the stanzas above" that were failing.

(B) The regression test added earlier today for the os.rename fix spawns python3 directly via Node's spawnSync, which cannot resolve a hand-rolled shebang-script shim the way bash's PATH lookup can on the same machine. The test's one Windows-specific assertion silently never exercised the real semantics check on Windows -- it failed at the spawn layer instead, for the wrong reason.

Surfaces are [cli, desktop, cowork]: all three shell out to the same scripts/* files. This is one host OS (Windows) failing across all three surfaces, invisible to the Tri-Polar matrix (CLI/Desktop/Cowork) by construction because that matrix has no host-OS axis -- the same structural gap the sibling os.rename RCA noted. canon_parts includes Part 6 (Dog-Fooding): the plugin corrupted its own room-state spine on the maintainer's machine.

## Evidence

- timestamp: 2026-07-23T00:00:00Z
  finding: |
    Live Windows traceback (reporter's own machine, real repro):
    ```
    reg_file = normwin('C:\Users\jsagi\AppData\Local\Temp\mos-test-...')
    SyntaxError: (unicode error) 'unicodeescape' codec can't decode bytes
                 in position 2-3: truncated \UXXXXXXXX escape
    ```
    Re-reproduced live on THIS Linux dev machine (proving it is source-injection,
    not Windows-only): `python3 -c "x = 'C:\Users\jsagi\Test'"` throws the exact
    same unicodeescape SyntaxError. Confirmed 36 interpolation sites across the
    four files via grep.
  source: live Windows install + live Linux reproduction, this session

- timestamp: 2026-07-23T00:00:00Z
  finding: |
    Confirmed the existing safe precedent in the same file: scripts/room-registry
    _write_current_room() reads sys.argv[1]/sys.argv[2] with a comment naming
    "the '$NAME'-in-python stanzas above" as the unsafe pattern. sys.argv[1]
    receives `C:\Users\jsagi\Test` intact (verified: argv is
    ['-c', 'C:\\Users\\jsagi\\Test', ...]) -- a real string, never re-parsed.
  source: live grep + live python probe, this session

- timestamp: 2026-07-23T00:00:00Z
  finding: |
    Live Windows spawn failure (reporter's own machine, real repro):
    ```
    FAIL os.replace probe: python3 spawn ok
      stderr=Python was not found; run without arguments to install from the
             Microsoft Store...
    ```
    Root cause: a hand-rolled ~/bin/python3 shebang shim resolves via bash's
    PATH lookup but not via Windows CreateProcess (Node spawnSync without
    shell:true), which falls through to the Store alias stub. Confirmed the test
    called spawnSync('python3', [...]) directly. Fixed by routing through bash;
    after the fix the probe EXECUTES on this Linux env (logs "python spawn ok
    (via bash PATH resolution)").
  source: live Windows install + post-fix Linux verification, this session

- timestamp: 2026-07-23T00:00:00Z
  finding: |
    Lineage confirmed: scripts/PYTHON_GATES.md (Plan 85-01) and the May RCA
    (windows-room-registry-path-normalization-gap, Phase 127.2-04) both show
    this interpolation class was known. The May fix added normwin() but never
    changed the interpolation MECHANISM, which is why Defect A survived it. Three
    previously-deferred sites (verify-release, learn-from-usage, track-analytics)
    re-checked this session and confirmed non-vulnerable today.
  source: live read + graphify graph query, this session

## Eliminated

(none -- both defects confirmed on first pass via direct grep + the reporter's live tracebacks + live Linux reproduction of Defect A; the graphify codebase-graph query confirmed the anti-pattern is contained to the four files fixed here, with no independent duplication in any caller)
