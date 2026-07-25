---
name: doctor
description: "Diagnose and optionally repair MindrianOS install: install-cache drift, sentinel gaps, active-room guard, surface-verification, ROOM.md drift, UI compliance, statusline visibility, Brain smoke, and a paste-ready command-registration bug report for Anthropic"
help_jtbd: "Diagnose and optionally repair an off-feeling install."
argument-hint: "[--fix] [--all] [--cascade-rooms] [--verify-surface] [--room-md] [--ui-compliance] [--statusline-visibility] [--card-fire-health] [--install-state] [--stale-first-touch] [--deprecated-usage] [--brain-smoke] [--eureka-smoke] [--drift] [--report-registration-bug] [--acceptance] [--pre-tag] [--pre-flight] [--dogfood-acceptance] [--claims] [--check-rs-engine] [--post-update] [--bind-check] [--simulate-write] [--scan-commands] [--scan-scripts] [--light-npx] [--dry-run] [--json]"
body_shape: E (Action Report)
hitl_shape: "F.0"
hitl_why: "It surfaces one diagnosed repair for a single approve-or-defer decision."
body_shape_detail: per-class status rows with [before → after] pattern, summary totals, F.1 Next Move selector when drift detected without --fix
serves_jtbd: ["audit-room"]
teaching: "When something feels off with the install, /mos:doctor diagnoses install-cache drift, ROOM.md gaps, statusline visibility, and UI compliance. Optionally repairs with --fix."
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Utility command. A diagnostics / health-check surface the navigator or release pipeline runs deliberately; it inspects the install, never reacts to a navigator problem-state."
---

<!-- mos:firing-block v2 -->
At this command's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# /mos:doctor

Self-service diagnostic for MindrianOS installs. It started as an install-cache drift detector (a real failure mode that happened twice -- see `docs/autopsies/2026-04-13-wrong-workspace-incident.md` and `docs/autopsies/2026-04-28-install-cache-drift-incident.md`) and grew into a family of health checks. As of Phase 217 every check except three carve-outs is a data-driven module: one row in `data/doctor-modules.json` plus one runner file under `lib/core/doctor/`.

## How it works

`scripts/doctor.cjs` keeps only the orchestration: it parses the flags, walks the module registry (`data/doctor-modules.json`), calls each runner's `check(ctx)` (and its `fix(ctx)` under `--fix`), then renders one status row per result and tallies the summary. The per-check logic lives in the runner files, not in the script. Add a new check and the script does not change.

Each registry row carries a `cadence`:

- `cadence: always` -- a per-invocation diagnostic. Its `check()` runs on EVERY `doctor` call and is watermark-immune, so a migrated check never goes silent after the first run. This is the exact silent-diagnostic failure mode Phase 217 killed.
- `cadence: once` -- a watermark-gated heal (the umbilical module). It runs only while its `introduced_version` sits in the `(applied_through, running]` window and never re-runs once the watermark at `~/.mindrian/doctor-applied.json` advances past it.

Both cadences are also gated by `introduced_version <= running`, so an install is never faulted for an organ it predates, and a future-version module is deferred until the user upgrades.

`--fix` support is declared per module by the boolean `fix_supported` in `data/doctor-modules.json` (never omitted -- silence is not a legal no-fix declaration). Under `--fix`, a fix-supported module whose `check()` surfaced a `warn`/`error` is passed to `fix()`, then `check()` re-runs so the reported row reflects the post-fix state. The completeness of every module's declaration is enforced as a HARD-BLOCKING test by `tests/test-doctor-module-contract-parity.cjs` (the D-03 gate). The doc-vs-code parity of this file is guarded by `tests/test-doctor-doc-parity.cjs`.

### The class-A install-cache check (the original)

Class A still runs on a bare invocation and stays special-cased (one of the three Phase 217 carve-outs, below). It:

1. Reads the live install version at `~/.claude/plugins/mindrian-os/.claude-plugin/plugin.json`.
2. Enumerates `~/.claude/plugins/cache/mindrian-marketplace/mos/*` and picks the highest semver as "latest".
3. Reports drift when install < latest.

Under `--fix` it renames the live install to `~/.claude/plugins/mindrian-os.stale-<old-version>-<timestamp>`, copies the latest marketplace cache in via `cp -aT`, and re-reads `plugin.json` to verify the version matches. The backup is preserved indefinitely; after 24 hours of normal use the user can delete it by hand.

## The check inventory

Every check has a stable class letter (or a registry id). The class flag that activates it is in parentheses; check-only means no `--fix` remediation.

- **class A -- install-cache** (bare run; `--fix` supported) -- live-install-vs-marketplace-cache drift, plus recovery.
- **class B -- cascade-rooms sentinel** (`--cascade-rooms`; `--fix` supported) -- every registered room carries its `.room-root` sentinel. `--fix` CREATES missing sentinels for rooms whose dir exists (dir-missing rooms are suggested, never auto-created). This fix was NEWLY wired in Phase 217 Plan 04 -- before that the class-B `--fix` claim was a false doc promise.
- **class C -- active-room guard silence** (`--cascade-rooms`; check-only) -- detects when a write to a non-active room would be silenced before the cascade side-channel runs. Shares the `--cascade-rooms` flag with class B.
- **class D -- verify-surface** (`--verify-surface`; check-only) -- live cascade end-to-end. Spawns the child runner `tests/test-cascade-surface-e2e.cjs` (30s timeout) and asserts its 8-key shape. Self-skips honestly when `bash` or the harness is absent (never faults an install for a missing dev harness).
- **class E -- room-md** (`--room-md`; `--fix` supported) -- ROOM.md + MINTO.md presence under the active room's `.room-root`. `--fix` invokes `generate-section-intelligence.cjs --recursive`, then re-checks.
- **class F -- ui-compliance** (`--ui-compliance`; check-only) -- UI Ruling System scan across `commands/*.md` and `scripts/*.cjs` (frontmatter body_shape, forbidden box chars / glyphs, renderer Zone 1 + Zone 4 patterns).
- **class G -- statusline-visibility** (`--statusline-visibility`; `--fix` supported) -- stale user-settings path / broken plugin install / statusline-mos isolated execution / disableAllHooks. `--fix` removes the stale user-settings statusLine override so the plugin-level config takes effect.
- **class H -- install-incomplete** (shares `--statusline-visibility`; `--fix` supported) -- missing statusLine block or a halted `.install-receipt.json` tail. `--fix` re-stamps the canonical statusLine block idempotently (the halted-tail case is report-only).
- **class I -- install-state** (`--install-state`; `--fix` supported) -- install-state record + topology classification + 6-way version-of-record consistency. `--fix` returns MULTIPLE recovery records (session-start record write, LV rewrite, legacy-config reconcile, legacy-clone backup-verify-remove with the dev-clone safety belt). Runs BEFORE class J so J reads its result via `ctx.checks`.
- **class J -- deployment-surfaces** (shares `--install-state`; `--fix` supported) -- reconciles every owned surface in `data/deployment-surfaces.json` against disk. Reads topology / active-root / active-version from class I's same-invocation result (self-derives via `shared.cjs` when absent). `--fix` re-stamps `ok:false` session-start-owned surfaces and prunes the marketplace cache.
- **class K -- stale-first-touch-copy** (`--stale-first-touch`; check-only) -- greeting surfaces declared by `data/first-touch-surfaces.json` (banner, splash, onboard, sessionstart, operator-update, larry-extended) scanned for stale version literals and U+2014 em-dash violations. SEED-007 absorption. Also activated by `--all`.
- **class L -- deprecated-usage** (`--deprecated-usage`; check-only) -- scans the last 7 days of `~/.claude/projects/.../*.jsonl` session transcripts for `/mos:<deprecated>` patterns and surfaces a per-command "use `/mos:<new>` instead" hint. Pure LOCAL scan; zero network, zero Brain. Also activated by `--all`.
- **class M -- brain-smoke** (`--brain-smoke`; check-only) -- 5-layer Brain end-to-end probe (plugin root resolver, key resolver, HTTPS schema, MCP stdio handshake, e2e brain_schema via the bundled shim). Diagnostic-only; reports the exact failing layer. This is an async runner and stays special-cased (carve-out, below). Activated by `--all`.
- **class N -- plugin-enabled-state** (no flag; bare run + `--all`; check-only) -- the silent-disable watchdog (DRIFT-12). Reads `~/.claude/settings.json` enabledPlugins + installed_plugins.json; installed && enabled===false is CRITICAL with a re-enable hint. It runs on a bare run and under `--all` precisely because a DISABLED plugin cannot fire its own SessionStart hooks to report itself. LOCAL read only; never writes settings.json.
- **class P / Q / R -- drift** (`--drift`; opt-in, NOT in `--all`) -- class P is prose-vs-code drift (skill-vs-code + first-touch, report-only even under `--fix`), class Q is gsd-record drift (shells out to `gsd-tools validate health`, parses W007 ROADMAP gaps + I001 missing SUMMARYs; `--fix` writes the DRIFT.md baseline and stubs missing SUMMARYs), class R is runtime-reachability drift (FAILS NON-ZERO when a capability is WIRED in the connector registry but UNREACHABLE by `decide()` at runtime). LOCAL-only, zero network.
- **class S -- eureka-smoke** (`--eureka-smoke`; check-only) -- 4-layer Eureka local-embedding-stack probe (deps present, vec backend, model cache, graceful degrade). Non-cascading; never downloads a model unless `MINDRIAN_EUREKA_SMOKE_ALLOW_DOWNLOAD=1`; rolls into `--acceptance`. Another async carve-out (below).
- **card-fire-health** (`--card-fire-health`; check-only; D-05) -- health of the `check-card-fire.cjs` self-diagnostic instrument: intercept log exists / valid JSONL / fresh (`~/.mindrian/card-fire-intercepts.log`), classifier and counter library seams intact, render-coverage registry parses, session store readable. `cadence: always`, LOCAL-only. Activated by `--all`.
- **room-graph-density** (no flag; bare run + `--all`; check-only) -- per-registered-room census of `room.db` `nodes` and `edges` row counts, plus a system-wide total. Reads every room through the read-only navigation door added in Phase 232.1, so the sweep can never migrate or otherwise mutate a room it only measures. A room with no `room.db` reports 0 / 0 and is not an error. `cadence: always`, LOCAL-only. Reports raw counts ONLY: it makes no density, health, or risk claim in either direction (SEED-074's hard guard on downstream claims).

## Step 1: Parse the user's intent

Look at the user's invocation:

- `/mos:doctor` (no flag) -> class A install-cache + class N plugin-enabled-state + the accumulative engine (the `cadence: once` heals like umbilical plus any `flag: null` always-modules). Fast; this is the bare-run surface.
- `/mos:doctor --all` -> activates B, C, D, E, F, G, H, I, J, K, L, M, and card-fire-health. `--drift` (P/Q/R) and `--eureka-smoke` (S) stay OPT-IN by design and are NOT part of `--all`.
- `/mos:doctor --cascade-rooms` -> class B (.room-root sentinel) + class C (active-room guard silence)
- `/mos:doctor --verify-surface` -> class D live cascade end-to-end via `tests/test-cascade-surface-e2e.cjs`
- `/mos:doctor --room-md` -> class E (ROOM.md/MINTO.md presence under `.room-root` subtrees)
- `/mos:doctor --ui-compliance` -> class F (UI Ruling System scan)
- `/mos:doctor --statusline-visibility` -> class G (user-settings drift, plugin install integrity, statusline-mos isolated execution) + class H (install-incomplete)
- `/mos:doctor --card-fire-health` -> card-fire-health module (D-05 instrument-health)
- `/mos:doctor --install-state` -> class I (install-state + topology + 6-way version-of-record) + class J (deployment-surface reconciliation)
- `/mos:doctor --stale-first-touch` -> class K
- `/mos:doctor --deprecated-usage` -> class L
- `/mos:doctor --brain-smoke` -> class M (5-layer Brain probe)
- `/mos:doctor --eureka-smoke` -> class S (4-layer Eureka probe; opt-in)
- `/mos:doctor --drift` -> class P + class Q + class R (opt-in; NOT in `--all`)
- `/mos:doctor --report-registration-bug` -> READ-ONLY escalation reporter (below). NOT a class flag, NOT part of `--all`, NOT a `--fix`.
- `/mos:doctor --fix` -> diagnostic + auto-recovery for every class that declares `fix_supported: true`: class A, B, E, G, H, I, J. Fix support is declared per module in `data/doctor-modules.json` and enforced by `tests/test-doctor-module-contract-parity.cjs`.
- `/mos:doctor --json` -> machine-readable output (for hooks / regression tests)
- `/mos:doctor --verbose` (or `-v`) -> extra per-check detail in the human render.
- `/mos:doctor --dry-run` -> `--fix` runners simulate their remediation without mutating disk.

Combine flags freely: `/mos:doctor --all --json --fix`.

### Release-gate and lifecycle flags (separate from the class roster)

These siblings own their own exit contracts and are not part of the class-flag drift roster:

- `--acceptance` -> the release-gate checklist (install-state + deployment-surfaces + version-of-record + verify-release + doctor-all + published + npx-roundtrip). Hard abort on any sub-check failure.
- `--pre-tag` -> with `--acceptance`, filter to the pre-tag-applicable points (implies `--acceptance`).
- `--pre-flight` -> the strict-subset tier `release.sh` uses before it mutates the tree (implies `--acceptance`).
- `--dogfood-acceptance` -> the Canon Part 6 dog-fooding acceptance pass.
- `--claims` -> the claims-verification leg.
- `--check-rs-engine` -> the reason-select engine probe (NOT part of `--all`).
- `--post-update` -> the post-`claude plugin update` confirmation pass.
- `--bind-check <roomDir>` -> a lightweight LOCAL room-health check run at BIND-TIME (never per-turn, never a Brain call). NEVER-BLOCK: an unhealthy room degrades to an advisory and STILL exits 0.
- `--light-npx` -> the lighter npx-roundtrip variant for `--acceptance`.
- `--simulate-write=<path>` -> class C test seam: simulate a write to a specific room path.
- `--scan-commands=<dir>` / `--scan-scripts=<dir>` -> class F test seams: point the UI scan at scratch directories.
- `--help` (or `-h`) -> print the usage text and exit 0.

## The `--report-registration-bug` mode (escalation reporter)

When a user reports that `/mos:*` commands do not register despite a valid install, run `/mos:doctor --report-registration-bug`. It is a read-only sibling mode (not a class flag, not part of `--all`, and NOT a `--fix`). It reuses the doctor's existing evidence collectors to prove every locally-checkable cause is CLEAN, then prints a paste-ready bug report for Anthropic. The root cause is a confirmed host-side Claude Code core bug (see `.planning/debug/every-mos-command-unknown.md`), so there is nothing to repair locally; the report is the deliverable the navigator pastes upstream. If a local cause is NOT clean (for example install-cache drift), that line is FLAGGED "fix locally first" and the mode still exits 0. Never a status claim; the report intentionally avoids declaring the install well or repaired.

## Step 2: Execute

Run via Bash:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.cjs" $ARGUMENTS
```

If `CLAUDE_PLUGIN_ROOT` is unset (older Claude Code versions), fall back to:

```bash
node ~/.claude/plugins/mindrian-os/scripts/doctor.cjs $ARGUMENTS
```

## Step 3: Render the output

The script outputs a 4-zone Shape E (Action Report) per skills/ui-system/SKILL.md. The renderer is structural: it prints one row per non-skip `report.checks[<id>]` entry, so a new module gets a row for free. Display the script's stdout directly. Do not re-format. Do not strip ANSI color codes.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Healthy, no drift |
| 1 | Drift detected (read-only mode, or `--fix` did not run) |
| 2 | Drift detected and recovered (`--fix` mode) |
| 3 | Internal error (cannot read directories, no marketplace cache, install in `error` state) |
| 4 | Recovery attempted but rolled back to the backup state (the D-03 rollback path) |

Two invariants layer on top of the table:

- **Class-flag runs force exit 0.** When any class flag is active (`classFlagsActive`), the run honors the graceful-degradation invariant (Canon Part 8) and exits 0 unless an explicit `--fix` attempt failed. A detected drift is still visible in the rows; it does not abort a scoped scan. Hermetic scratch-registry test runs rely on this.
- **Two narrow non-zero escalations.** A `--drift` run whose class-R runtime-reachability check returns `warn` exits 1 (a WIRED-but-UNREACHABLE capability is a hard CIRS R9 fail, not a warning). And on a bare / non-class-flag run, the class-N plugin-disabled state (`warn`) exits 1, because that is the one failure mode no SessionStart hook can ever self-report.

## The three Phase 217 carve-outs

Every other check is a registry module; these three are deliberately special-cased in `main()`, each opened with a written `Phase 217 carve-out:` justification comment (loud and auditable, never a silent omission):

1. **class A install-cache** -- its inline drift + atomic recovery + topology guards are positionally coupled to `_finalizeAndExit` (the exit-code chain), and its render is hand-coded; forcing it into the uniform module shape would risk the most-tested path.
2. **class M brain-smoke** -- an `async` runner; the engine loop is synchronous, so it stays in its own `await` block.
3. **class S eureka-smoke** -- the same async-vs-sync-engine reason as brain-smoke.

## Extension architecture

A new check is two files and no script edit:

1. One entry in `data/doctor-modules.json`: `{ id, introduced_version, cadence ("always" | "once"), flag (a parseArgs flags key or null), fix_supported (explicit boolean), runner, description }`.
2. One runner at `lib/core/doctor/<id>-module.cjs` exporting `check(ctx)` -> `{ status: 'ok'|'warn'|'error'|'skip', detail, ...payload }`, and `fix(ctx)` when `fix_supported: true`. Shared helpers and constants live in `lib/core/doctor/shared.cjs`; a runner never back-requires `scripts/doctor.cjs` (that would be a circular require).

The D-03 contract test fails the suite if a module omits `fix_supported`, returns a status outside the vocabulary, forgets its `detail` string, or declares `fix_supported: true` without exporting a `fix` function.

## When to suggest /mos:doctor

Surface this command proactively when:

- A user reports unexpected behavior that might be version-related ("my new feature isn't showing up")
- After a marketplace update (`/plugin marketplace update` followed by reports of broken commands)
- During session start if the workspace guard hook reports drift
- As a follow-up after `claude plugin update` to confirm the update actually landed

## Voice rules (if invoked through Larry)

- No "I" sentences
- Lead with the script's output, then a one-line interpretation
- If drift detected without `--fix`: suggest `/mos:doctor --fix` as the next step
- If drift detected and recovered: confirm the version, mention the backup location, recommend `/clear` and a fresh session

## Example output (healthy)

```
-- MindrianOS -- doctor -- no-drift --

  ■ install-cache              ✓ healthy (1.12.0)
  ■ dev-source                 ✓ consistent (1.12.0)

  Summary: 2 healthy / 0 drift / 0 warnings

  ▶ /mos:status                  # room state overview
  ▷ /mos:doctor --all          # re-run all classes
  ▷ /mos:doctor --json         # machine-readable output
```

## Example output (drift detected, no --fix)

```
-- MindrianOS -- doctor -- drift-detected --

  ■ install-cache              ⚠ drift detected
     live    1.10.10 → 1.11.0

  Summary: 0 healthy / 1 drift / 0 warnings

  [F.1 Next Move]
   ▶ Run /mos:doctor --fix
   ▷ Defer
   ▷ Free-Text

  ▶ /mos:doctor --fix --all     # auto-recover all drift classes
  ▷ /mos:rooms                 # inspect known rooms
  ▷ /mos:doctor --json         # machine-readable output
```

## Example output (recovery successful)

```
-- MindrianOS -- doctor -- recovered --

  ■ install-cache              ⚠ drift detected
     live    1.10.10 → 1.11.0
     ✓ recovered to 1.11.0
     backup /home/jsagi/.claude/plugins/mindrian-os.stale-1.10.10-20260428-095548

  Summary: 0 healthy / 0 drift / 0 warnings

  ▶ /mos:status                  # room state overview
  ▷ /mos:doctor --all          # re-run all classes
  ▷ /mos:doctor --json         # machine-readable output
```

After successful recovery, suggest:

```
Recovery applied. Run /clear to refresh the context window
so Larry picks up the new plugin code.
```

Note: per D-19, the renderer above is structural. Larry handles narrative interpretation of any drift finding when surfacing conversationally (e.g., "what does this mean?"). See references/personality/voice-dna.md for voice patterns.

## Zone 4 (Action Footer)

After presenting results, suggest next actions:

> Want to repair what we found? -> /mos:doctor --fix
> Want the full picture? -> /mos:status
