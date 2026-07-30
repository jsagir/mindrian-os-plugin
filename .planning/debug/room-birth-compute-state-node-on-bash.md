---
status: investigating
kind: rca
trigger: "room-birth-compute-state-node-on-bash"
issue_id: ""
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: local-only
canon_parts: []
created: 2026-07-30T00:00:00Z
updated: 2026-07-30T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: confirmed. `lib/core/navigation/room-birth.cjs:986-990` (STEP 3
of room birth) spawns `scripts/compute-state`, a bash script, with `node`,
which raises an immediate SyntaxError parsing the bash shebang comment. The
call is wrapped in a bare `catch (_e)` with a "Tolerate" comment, so STEP 3
has never once succeeded, silently, since it was written.
test: live reproduction against this repo's HEAD, `node scripts/compute-state /tmp`.
expecting: a Node SyntaxError on the bash comment at line 2. Confirmed exactly this.
next_action: none for this session. Filed as its own RCA per Phase 240.1
Plan 07's Resolution: not fixed in Phase 240.1 because it is not CTXL-01,
CTXL-02, or CTXL-03, and folding an unrelated production fix into this phase
would blur that phase's own mutation proofs (`240.1-RESEARCH.md` Open
Question 4's explicit recommendation). Recommended fix is recorded below for
whichever future session or quick-task picks this up.

## Meta

- Repo: /home/jsagi/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.51 (current `package.json` at time of filing)
- Reported by: Phase 240.1 (Context-Layer Drift Detection) research pass, 2026-07-30
- Date first observed: 2026-07-30 (found incidentally while auditing STATE.md
  write sites for CTXL-01; `240.1-RESEARCH.md` Finding 1C first surfaced it)
- Related debug sessions:
  `.planning/debug/gsd-tools-state-resync-clobbers-stopped-at-frontmatter.md`
  (a DIFFERENT STATE.md corruption class, `.planning/STATE.md`, external tool
  -- not the same defect, cited here only because both were found during the
  same STATE.md write-site census)

## Problem Statement

Room birth's STEP 3 (`lib/core/navigation/room-birth.cjs:986-990`) never
successfully computes a new room's initial `STATE.md`, because it invokes a
bash script with the Node interpreter instead of bash, and the resulting
crash is silently swallowed.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: after `room-birth.cjs`'s STEP 3 runs during room creation, the
newly-born room's `STATE.md` reflects a freshly computed state (venture
stage, total entries, current-room marker), the same content
`scripts/compute-state` would render for any other room.

actual: STEP 3 always throws inside its own `try` block and is caught by a
bare `catch (_e)` with no logging, so the room's `STATE.md` is left exactly
as `scripts/room-registry` seeded it at birth (the `gsd_state_version: 1.0` /
`status: active` scaffold stamp), until the NEXT natural regeneration
(session-start, on-stop, on-task-complete, on-agent-complete, or an
intelligence-cascade run) recomputes it. No error is surfaced anywhere: not
to stdout, not to a log file, not to any of the three Tri-Polar surfaces.

errors: verbatim, reproduced live this session by invoking the exact command
`room-birth.cjs:987-989` constructs (substituting a scratch directory for the
real `roomDir`):

```
$ node scripts/compute-state /tmp
/home/jsagi/MindrianOS-Plugin/scripts/compute-state:2
# compute-state: Scan room/ directory and output STATE.md content
^

SyntaxError: Invalid or unexpected token
    at wrapSafe (node:internal/modules/cjs/loader:1713:18)
    at Module._compile (node:internal/modules/cjs/loader:1755:20)
    at Object..js (node:internal/modules/cjs/loader:1913:10)
    at Module.load (node:internal/modules/cjs/loader:1505:32)
    at Function._load (node:internal/modules/cjs/loader:1309:12)
```

reproduction:
  1. `node scripts/compute-state /tmp` (or any directory) at repo root.
  2. Node attempts to parse `scripts/compute-state` as JavaScript.
  3. Observe: `SyntaxError: Invalid or unexpected token` pointing at line 2,
     the bash shebang's own comment line (`# compute-state: Scan room/
     directory and output STATE.md content`).
  4. Cross-reference: `room-birth.cjs:987-989` constructs and runs the
     functionally identical command (`execSync('node ' + computeStateScript
     + ' ' + roomDir, ...)`) during every real room birth, and its
     surrounding `try`/`catch` (`:985-994`) means this SyntaxError fires and
     is swallowed on every single invocation, with zero exceptions -- there
     is no code path in which `node scripts/compute-state` succeeds, because
     the script's first two lines guarantee a parse failure before any
     conditional logic runs.

started: cannot be dated precisely from git blame alone within this session's
scope; the `execSync('node ' + ...)` call and its `catch (_e)` "Tolerate"
comment both predate Phase 240.1's research pass. This RCA documents current
behavior, not an origin-date investigation.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (room birth runs identically on
  all three; the bug is in shared `lib/core/navigation/room-birth.cjs`, not
  in any surface-specific wrapper)
- Affected commands: `/mos:new-project` and any other entry point that calls
  `room-birth.cjs`'s room-creation flow
- Affected users: all installs -- this is not conditional on any user
  configuration, key, or platform; it fires identically on every room birth
  everywhere
- Version range: present at time of filing (2026-07-30); no evidence this
  ever worked, given the shebang mismatch is structural, not a regression
- Severity: medium -- not a crash, not data loss (the scaffold-seeded
  `STATE.md` survives untouched and the room remains fully usable), but a
  permanently no-op step that silently drops the "state computed fresh at
  birth" guarantee STEP 3's own comment promises ("STATE.md is NEVER
  authored")
- Blast radius: none beyond STEP 3 itself. The next natural regeneration
  (session-start, on-stop, on-task-complete, on-agent-complete, or an
  intelligence-cascade run -- all of which correctly use
  `execFileSync('bash', [...])` or a bash-native invocation, per Phase
  240.1's write-site census) recomputes `STATE.md` correctly, so the
  practical user-visible effect is a delayed-by-one-turn state computation,
  not a permanent inconsistency.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: the failure is intermittent or environment-specific (e.g.
  Windows-only, or dependent on a stale Node cache).
  evidence: the SyntaxError is deterministic and structural -- Node cannot
  parse a bash shebang comment as JavaScript on any platform, on any Node
  version. Reproduced live, single attempt, 100% failure rate.
  timestamp: 2026-07-30T00:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-30T00:00:00Z
  checked: `scripts/compute-state:1`
  found: shebang is `#!/usr/bin/env bash`
  implication: the script is bash, not JavaScript; invoking it with the
  `node` interpreter is a category error, not a runtime bug in the script
  itself.

- timestamp: 2026-07-30T00:00:00Z
  checked: `lib/core/navigation/room-birth.cjs:975-995`
  found: STEP 3's own header comment states "STATE.md is NEVER authored" and
  cites "RESEARCH Section 3", meaning the author knew the intended contract
  (compute-state renders, the caller persists) but implemented the spawn
  with the wrong interpreter.
  implication: this is a copy-paste or interpreter-confusion defect at the
  spawn call itself, not a design gap.

- timestamp: 2026-07-30T00:00:00Z
  checked: `lib/core/intelligence-cascade.cjs:492-503`, the correct analog
  found: `execFileSync('bash', [path.join(SCRIPTS_DIR, 'compute-state'),
  roomDir], {...})` -- an args-array spawn naming `bash` explicitly as the
  interpreter, with the stdout captured and persisted via `persistState()`
  found: this is the Security-Domain-approved spawn shape this repo already
  uses correctly at every OTHER compute-state call site (the three hook
  scripts `on-stop`/`on-task-complete`/`on-agent-complete` are themselves
  bash, so they invoke `compute-state` natively with no interpreter
  confusion possible).
  implication: `room-birth.cjs`'s STEP 3 is the ONLY one of the six
  (now seven, including intelligence-cascade Step 8) compute-state call
  sites census'd by `240.1-RESEARCH.md` Finding 1C that gets the
  interpreter wrong.

- timestamp: 2026-07-30T00:00:00Z
  checked: `lib/core/navigation/room-birth.cjs:991-994`
  found: `catch (_e) { // Tolerate: compute-state failure does not abort
  birth (STATE.md may be missing until the next session-start, which calls
  compute-state again). }`
  implication: the failure mode was anticipated in the abstract ("compute-
  state failure does not abort birth") but the specific, deterministic,
  100%-reproduction-rate cause (wrong interpreter) was never diagnosed, and
  the comment's own reassurance ("the next session-start ... calls
  compute-state again") is true and is exactly why this defect has never
  been reported as a user-visible bug: the room self-heals on its next
  natural regeneration.

## Technical Root Cause

`lib/core/navigation/room-birth.cjs:986-990` spawns `scripts/compute-state`
(a bash script) using `execSync('node ' + JSON.stringify(computeStateScript)
+ ' ' + JSON.stringify(roomDir), { stdio: 'pipe', cwd: REPO_ROOT })`. Node
attempts to parse the target file as a CommonJS module, fails immediately on
the bash shebang comment at line 2 with `SyntaxError: Invalid or unexpected
token`, and the surrounding `try`/`catch` at `:985-994` silently discards the
error via a bare `catch (_e)` with only a code comment, never a logged line,
never a return value change, never a signal on any surface.

- Site: `lib/core/navigation/room-birth.cjs:986-990`, inline within the
  larger room-birth function (STEP 3 block, `:978-994`)
- Cause: wrong interpreter named in the spawn command. The script requires
  `bash`; the call names `node`.
- Why it surfaces now: it is not a regression -- it is a structural defect
  present from whenever this call was written, invisible because the
  identical caught-and-tolerated failure occurs on literally every room
  birth, with no variance to distinguish "birth succeeded, STATE.md
  computed" from "birth succeeded, STATE.md silently not computed" from the
  outside.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1:
  - Location: `lib/core/navigation/room-birth.cjs:985-994`, the STEP 3 block
  - Current behavior: `execSync('node ' + JSON.stringify(computeStateScript)
    + ' ' + JSON.stringify(roomDir), { stdio: 'pipe', cwd: REPO_ROOT })`
    inside a `try`/`catch` that swallows the error with a bare comment.
  - Required behavior: change the spawn to
    `execFileSync('bash', [computeStateScript, roomDir], { stdio: ['ignore',
    'pipe', 'pipe'], cwd: REPO_ROOT })`, capture the stdout, and persist it
    through `lib/core/state-version.cjs::persistState(roomDir, stdout)` (the
    same preserve-or-notify authority Phase 240.1 wired into every other
    compute-state write site), matching the shape already correct at
    `lib/core/intelligence-cascade.cjs:492-503`.
  - Short-term patch: at minimum, fix only the interpreter (`bash` instead
    of `node`) and keep the existing blind discard of stdout -- this alone
    would make STEP 3 succeed for the first time, though it would still not
    persist the computed state anywhere (compute-state only prints to
    stdout by contract; the caller must capture and write it).
  - Long-term fix: convert to `execFileSync('bash', [...])` with an args
    array (never string concatenation, per this repo's Security Domain
    standard), capture stdout, and route it through `persistState()` so
    STEP 3 actually fulfils its own header comment's promise that "STATE.md
    is NEVER authored" (i.e., always freshly computed, including at birth).
    Replace the bare `catch (_e)` with one that writes a single advisory
    line (matching the never-throw-but-never-silent rule Phase 240.1
    adopted at every other write site: soft-fail must still write a line,
    never swallow silently).

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: a new or existing `tests/test-room-birth-*.cjs` (no existing
    file was found to extend; a new file is appropriate)
  - Given: a scratch room directory seeded via the same path `room-registry`
    uses at birth
  - When: `room-birth.cjs`'s STEP 3 logic runs (either by exercising the
    full birth flow or by isolating the STEP 3 spawn into a testable unit)
  - Then: the room's `STATE.md` reflects freshly computed content (not just
    the registry-seeded scaffold stamp) immediately after birth, with no
    exception escaping the birth call
  - Runner registration: register in whichever `tests/run-all-*.sh`
    aggregator owns room-birth coverage once written; not created by this
    RCA filing, since the fix itself is deferred out of Phase 240.1

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add a Fixed entry under the target version once a fix lands
  ("room birth now actually computes STATE.md at STEP 3, instead of always
  silently failing on a node/bash interpreter mismatch").
- Release lockstep: applies if the fix ships in a release; the 7-place
  lockstep per `.claude/includes/release-process.md`.
- Canon: no Canon concept is touched by this defect or its fix (no Brain
  wire, no graph-boundary concern); `canon_parts: []` is correct.
- knowledge-base.md: on resolve (when the fix above is actually implemented,
  not merely filed), add the summary block per `docs/RCA-TEMPLATE.md`
  section 1.
- Process note: this RCA is filed as `status: investigating` (root cause
  confirmed by live reproduction, fix NOT applied). The `Required Code
  Changes` section above is a recommendation for a future session, not code
  landed by this filing. This is intentional: Phase 240.1 Plan 07's own
  instruction was to file the defect, not fix it, per the deliberate scope
  boundary recorded in the Resolution section below. A future session
  picking this up should advance `status` to `fixing` when work begins, and
  to `resolved` (moving the file to `.planning/debug/resolved/`) only once
  the fix above is actually implemented and verified.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: `lib/core/navigation/room-birth.cjs:986-990` spawns the bash
script `scripts/compute-state` with the `node` interpreter instead of
`bash`, producing a deterministic, 100%-reproducible `SyntaxError` on the
script's own shebang comment line, silently swallowed by a bare `catch (_e)`
at `:991-994`.

fix: NOT APPLIED in this session, by deliberate scope decision. Phase 240.1
(Context-Layer Drift Detection)'s three requirements are CTXL-01 (per-room
STATE.md version-stamp preservation), CTXL-02 (semantic/context layer
doctrine), and CTXL-03 (room-context accuracy benchmark) -- none of which
names room birth's STEP 3 spawn defect. Folding an unrelated production fix
into this phase would blur its own mutation proofs
(`240.1-RESEARCH.md` Open Question 4's explicit recommendation, followed).
This RCA exists so the defect has a permanent, discoverable, git-tracked
record with a live reproduction and a recommended fix, rather than being
silently folded in or lost.

verification: reproduction command and output transcribed verbatim in
Symptoms and Evidence above, run live against this repo's HEAD during Phase
240.1 Plan 07's execution (2026-07-30). `git diff
lib/core/navigation/room-birth.cjs` against the phase's base commit is
empty, confirming the production file is genuinely untouched by this filing.

files_changed:
  - `.planning/debug/room-birth-compute-state-node-on-bash.md` (new RCA filed)

commits: filed in the same commit range as Phase 240.1 Plan 07's Task 2.
