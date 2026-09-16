---
status: investigating
kind: qa-sweep
trigger: "doctor-auto-heal-qa-sweep-2026-09-16"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [6, 7, 8, 11, 12]
phase: 352
created: 2026-09-16T08:00:00Z
updated: 2026-09-16T09:30:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** dev repo `/home/jsagi/dev/MindrianOS-Plugin` `main` @ 3b819cd46 (repo version 2.0.0-beta.40 at read time; beta.41 was being cut by a peer session the same morning). Line numbers below are from that checkout.
- **WIRE / RUNTIME claims probe against:** the installed marketplace cache `~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.37/` (the version this Claude Code session loaded), and the deployed Brain `theo-mcp.onrender.com` (brain-smoke L0-L6, all PASS, store 27,951 nodes).
- **Date of audit:** 2026-09-16
- **Re-verification rule:** every source claim was read from `main` @ 3b819cd46; a finding whose runtime symptom was observed on beta.37 and whose code site was read on beta.40 is marked `needs-source-reverify` only where the two might differ (none identified: none of the cited files changed between beta.37 and beta.40 per `git log --oneline v2.0.0-beta.37..HEAD -- <path>`, to be re-run by the planner).

## Current Focus

hypothesis: The doctor's checks are right but its reporting and its post-fix verification are not trustworthy enough to run unattended; and the only trigger available after install/update is SessionStart.
test: Phase 352 plans implement D-352-1..10 and the hermetic harness test; the fresh-user acceptance run.
expecting: a `doctor --all` on a fresh install and after an update reports 0 auto-healable drift and 0 ui-compliance violations with no command typed; no `undefined` in any render.
next_action: `/gsd-plan-phase 352` once the repo is idle (peer release in flight at time of writing).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.37 (installed), 2.0.0-beta.40 (repo)
- Reported by: navigator, live `/mos:doctor` session (five invocations by hand)
- Date first observed: 2026-09-16
- Related debug sessions: none open; Phase 217 (module engine), Phase 127.2 (post-update preflight), Phase 224-02 (derive re-enqueue) are the ancestors

## Problem Statement

After an install or update the plugin does not repair itself; the navigator must run `/mos:doctor --fix` by hand, and when they do, the doctor's own output cannot be trusted unattended (it prints `undefined`, offers fixes that cannot fix, and re-checks stale state).

## Symptoms

expected: first session on a new version heals every idempotent local drift by itself and says so in one line; `doctor --all` renders every check truthfully; `--ui-compliance` counts only real violations.
actual: see the 14 findings below; five hand-run invocations were needed to reach a clean state, one banner told the navigator a false downgrade had happened, and 66 of 155 UI "violations" were scanner noise.
errors:
  - `Error: Cannot find module '/scripts/doctor.cjs'` (MODULE_NOT_FOUND) from the skill's Step 2 command with `CLAUDE_PLUGIN_ROOT` empty.
  - `Error: Cannot find module '/home/jsagi/.claude/plugins/mindrian-os/scripts/doctor.cjs'` from the documented fallback.
  - `■ brain-smoke ⊘ undefined` under `--all`.
  - `⊘ fix install-state: undefined` (x2), `⊘ fix deployment-surfaces: undefined` (x2) under `--fix --all`.
  - `(node:867346) ExperimentalWarning: SQLite is an experimental feature and might change at any time` on every run.
  - SessionStart banner: "An update landed under this session (2.0.0-beta.37 -> 2.0.0-beta.5). Commands may be stale - restart" (false).
reproduction:
  1. On a machine with the marketplace-cache topology and two `installed_plugins.json` rows for `mos@mindrian-marketplace` (user scope beta.37, project scope beta.5 for another path), start a session in a cwd that resolves to the user scope.
  2. Run `/mos:doctor --fix` -> Step 2 command fails MODULE_NOT_FOUND (F1); run from the cache path instead.
  3. Run `/mos:doctor --all` -> `brain-smoke ⊘ undefined` (F2); `[F.1] Run /mos:doctor --fix` offered although the only drift is check-only (F6).
  4. Run `/mos:doctor --fix --all` -> four `undefined` fix lines (F3); install-state 3 -> 2 findings in-run (F4); graph-derive 35/55 before and after (F5).
  5. Run `/mos:doctor --install-state -v` -> 0 findings (proves F4's re-check was stale).
  6. Run `/mos:doctor --ui-compliance --json` and tally by kind and by comment context (F8).
started: F1 since the marketplace-cache topology became default (Phase 123/127.2 era); F2/F3 since Phase 217 (2026-06); F10 since the Part 7 F8 detector (2026-07-02); F8 since class F shipped (1.12.1-beta.1).

## Scope and Impact

- Affected surfaces: cli (all findings); desktop, cowork (no auto-heal exists at all; D-352-9)
- Affected commands: `/mos:doctor` (all modes), the SessionStart preflight, every `/mos:*` command body that resolves the plugin root through `CLAUDE_PLUGIN_ROOT` alone
- Affected users: every install on the marketplace-cache topology (the default since Phase 127.2); every user with more than one `installed_plugins.json` scope row (F10)
- Version range: 1.12.1-beta.1 (F8) through 2.0.0-beta.40 (all)
- Severity: high (a plugin that needs its owner after every update does not survive a stranger's machine)
- Blast radius: `scripts/doctor.cjs`, `lib/core/doctor/*`, `scripts/sessionstart-post-update-preflight.cjs`, `skills/doctor/SKILL.md`, `commands/doctor.md`, `hooks/hooks.json`, `data/doctor-modules.json`, `data/harness-policies/`, 44 renderer files under `scripts/`

## Eliminated

- hypothesis: `cascade-rooms-active` (warn in JSON) is dropped by the terminal renderer.
  evidence: `doctor --cascade-rooms` renders `■ cascade-rooms-active ⚠ writes to mindrianOS would be silenced (active=idem-room)`; in the earlier `--all` runs it was `skip` because the active room lacked its sentinel, which `--fix` then created. Row loop at `scripts/doctor.cjs:2234-2240` iterates every `report.checks` entry and omits only `skip`.
  timestamp: 2026-09-16T09:05:00Z
- hypothesis: the `--fix --all` install-state / deployment-surfaces recovery failed (the `undefined` lines).
  evidence: `doctor --install-state -v` immediately after reports `install-state healthy (topology marketplace-cache)` and `all 6 deployment surface(s) reconciled`; the fix landed, only the log line was empty.
  timestamp: 2026-09-16T08:40:00Z
- hypothesis: the SessionStart "beta.37 -> beta.5" banner reflected a real downgrade.
  evidence: `installed_plugins.json` rows: user scope `2.0.0-beta.37` (installedAt 2026-09-16T05:53:51Z), project scope `/mnt/c/Users/jsagi` `2.0.0-beta.5`; cwd `/home/jsagi` resolves to the user row; `doctor` reads `install-cache ✓ healthy (2.0.0-beta.37)`.
  timestamp: 2026-09-16T08:20:00Z

## Evidence

- timestamp: 2026-09-16T08:05:00Z
  checked: `env | grep CLAUDE_PLUGIN_ROOT` inside the slash-command bash step; `ls ~/.claude/plugins/`
  found: `CLAUDE_PLUGIN_ROOT=[]`; no `mindrian-os` directory under `~/.claude/plugins/` (only `cache/`, `data/`, `marketplaces/`, `installed_plugins.json`)
  implication: F1. Both documented resolution paths in `skills/doctor/SKILL.md` Step 2 are dead on this topology.
- timestamp: 2026-09-16T08:35:00Z
  checked: `doctor --all` human render vs `doctor --brain-smoke` standalone
  found: `--all` row `brain-smoke ⊘ undefined`; standalone `Overall: PASS (10263ms)` L0-L6
  implication: F2. `scripts/doctor.cjs:3439-3480` (class-M carve-out) only owns output in the standalone branch; under `--all` no `{status, detail}` is written to `report.checks['brain-smoke']`.
- timestamp: 2026-09-16T08:45:00Z
  checked: `lib/core/doctor/install-state-module.cjs:482-489`, `deployment-surfaces-module.cjs:386-394`, `scripts/doctor.cjs:2291`, `tests/test-doctor-module-contract-parity.cjs:102-129`
  found: `fix()` returns `{recoveries, detail}`; the fix-log renderer iterates per-record entries reading `entry.detail || entry.note || entry.status || entry.action`; D-03 rule 9 invokes `check()` only
  implication: F3. Add D-03 rule 10 for `fix()`'s return contract; every record carries `detail`.
- timestamp: 2026-09-16T08:50:00Z
  checked: `--fix --all` install-state row before/after; `--install-state -v` next run
  found: 3 findings -> 2 in-run -> 0 next run
  implication: F4. The same-invocation re-check reads a pre-fix version-of-record; re-resolve from disk after `fix()`.
- timestamp: 2026-09-16T08:50:00Z
  checked: `lib/core/doctor/graph-derive-health-module.cjs:496-498, :577-599`
  found: detail string is "need a derive re-enqueue" both before and after enqueue; 35/55 unchanged
  implication: F5. Post-fix wording must distinguish queued from needing; acceptance measured after the sweep.
- timestamp: 2026-09-16T09:00:00Z
  checked: `--ui-compliance --json` tally (155 rows)
  found: zone1 41, zone4 44 (44 files); box-char 69 (57 in `//` comments, 5 in `/* */`, 4 Shape-B tree glyphs, 3 genuine); glyph 1 (`✗`)
  implication: F8. Scanner at `lib/core/doctor/ui-compliance-module.cjs:92-95` is comment-blind and shape-blind; 89 real, 66 noise.
- timestamp: 2026-09-16T09:05:00Z
  checked: `--all --json` top-level keys
  found: `install, cache, dev, drift, fixRequested, classARecovered, recoveryError, recoverySkipped, checks, recovered`; no `summary`, no `exit_code`; `accumulative-engine.detail` empty; `brain-smoke.status` undefined
  implication: F9. A harness consuming JSON has nothing to key on.
- timestamp: 2026-09-16T09:10:00Z
  checked: `scripts/sessionstart-post-update-preflight.cjs:185-187`
  found: `const rec = arr[0]; if (rec && rec.installPath) return versionFromInstallPath(rec.installPath);`
  implication: F10. First row wins regardless of scope; select the row whose `installPath` equals the running root.
- timestamp: 2026-09-16T09:15:00Z
  checked: claude-code-guide agent against hooks.md and plugins-reference.md (current)
  found: no install/update hook event; SessionStart matchers `startup|resume|clear|compact|fork`; hook stdout not shown to user; `async: true` semantics undocumented; `CLAUDE_PLUGIN_ROOT` not guaranteed in slash-command bash; `installed_plugins.json` scope tie-break undocumented
  implication: D-352-1, D-352-3, D-352-5; F1 and F10 fixes must not rely on env or row order.
- timestamp: 2026-09-16T09:15:00Z
  checked: langtalks-graph-expert `relationship_path("Measurement decay","Verification loops")`, `get_entity("Self-healing")`
  found: path found, 4 hops via note-graph-engineering-vs-loop-engineering / Agent / Claude Code; Self-healing cited in ep 65 "AI SRE" (Komodor) and the SOTA-2026 transcript
  implication: the verify step of an auto-heal must re-measure from disk (F4, F5) or the loop decays inside one run.

## Technical Root Cause

- Site: `scripts/doctor.cjs:3439-3480` (class M carve-out) and `:2234-2291` (row and fix-log renderers); `lib/core/doctor/install-state-module.cjs:482-489`; `lib/core/doctor/deployment-surfaces-module.cjs:386-394`; `lib/core/doctor/ui-compliance-module.cjs:92-95`; `scripts/sessionstart-post-update-preflight.cjs:185`; `skills/doctor/SKILL.md` Step 2; `hooks/hooks.json` (no auto-heal step exists)
- Cause: (a) no trigger runs the heal after install/update; (b) the reporting layer tolerates missing `status`/`detail` and prints `undefined`; (c) post-fix verification reuses pre-fix readings; (d) the UI scanner reads raw lines without comment or shape context; (e) root and scope resolution rely on an env var and on row order that upstream does not guarantee.
- Why it surfaces now: the marketplace-cache topology is the default, so the legacy paths in the skill and the first-row assumption in the preflight both fire on ordinary installs; the navigator ran the doctor by hand five times and read every line.

## Required Code Changes

- Change 1 (F1): `skills/doctor/SKILL.md` Step 2 and `commands/doctor.md`: resolve the root via `node -e "require('<root>/lib/core/active-plugin-root.cjs').resolveActivePluginRoot()"` pattern or a shipped `bin/mos-root` shim; describe marketplace-cache as default, legacy live-install as the exception.
- Change 2 (F2): `scripts/doctor.cjs:3439-3480`: when `flags.all`, await `classMBrainSmoke` and write `report.checks['brain-smoke'] = { status: ok ? 'ok' : 'warn', detail: 'L0-L6 <n>/7 PASS ...' }` before the render.
- Change 3 (F3): every `fix()` record carries `detail`; `tests/test-doctor-module-contract-parity.cjs` gains rule 10 (invoke `fix()` under `dryRun: true`, assert status vocab and non-empty `detail` on the top-level result and on every `recoveries[]` record).
- Change 4 (F4): the post-fix re-check in `scripts/doctor.cjs` (module loop) clears any cached resolution (`shared.cjs` memo) before calling `check(ctx)` again.
- Change 5 (F5): `graph-derive-health-module.cjs:496-498`: when a room is in the queue, report it as `queued` and exclude it from `needing`.
- Change 6 (F6): the F.1 gate in `scripts/doctor.cjs` renders `Run /mos:doctor --fix` only when some warn/error module has `fix_supported: true`; otherwise the primary verb is the class-specific next step.
- Change 7 (F7): `-v` prints the `violations[]` rows for ui-compliance (path:line kind snippet).
- Change 8 (F8): `ui-compliance-module.cjs:92-95`: skip `//` lines and `/* */` spans; read the file's declared `body_shape` (or a `// body_shape: B` marker for scripts) and allow tree glyphs under B; exclude `scripts/test-*.cjs` by a declared list in `data/ui-compliance-exclusions.json`.
- Change 9 (F9): `--json` gains `summary {healthy, drift, warnings, fixable_ids, needs_gate_ids}` and `exit_code`; `accumulative-engine.detail` is never empty.
- Change 10 (F10): `sessionstart-post-update-preflight.cjs:185`: select the row whose `installPath` equals `resolveActivePluginRoot().root`; fall back to the row whose `scope` is `user` only when no match.
- Change 11 (F11): remove the "run /mos:doctor --statusline-visibility or --fix" first-session ask; the auto-heal records the touch.
- Change 12 (F12): at the top of `scripts/doctor.cjs`, suppress the SQLite ExperimentalWarning (form per Context7 at plan time).
- Change 13 (D-352-1..5): new `scripts/sessionstart-doctor-auto-heal.cjs`, registered in `hooks/hooks.json` after npm-reconcile and before Larry-load; watermark compare; `doctor --all --fix --json` with `auto_heal`-only fixes; detached brain/eureka smoke; write `~/.mindrian/doctor-auto-heal-last.json`; emit `additionalContext` with the reward line.
- Change 14 (D-352-4): `data/doctor-modules.json` gains `auto_heal` on every row; D-03 rule 11 enforces it.
- Change 15 (D-352-9): `lib/mcp` server boot runs the same LOCAL heal on first boot of a new version.
- Change 16 (R3): sweep the 44 `scripts/*.cjs` renderers to the 4-zone anatomy via the shared renderer; replace the 3 genuine box-char hits and the `✗` glyph.
- Change 17 (D-352 harness): `data/harness-policies/doctor-auto-heal.json` plus its hermetic test.

## Tests to Add or Update

- Test 1: unit, `tests/test-352-doctor-render-no-undefined.cjs`: Given a full `--all --json` run under a scratch HOME, When rendered, Then the output contains no literal `undefined` and every non-skip check has a row.
- Test 2: unit, `tests/test-doctor-module-contract-parity.cjs` rule 10/11: Given every `fix_supported: true` module, When `fix({dryRun:true})` is invoked, Then status vocab and non-empty `detail` on every record; and `auto_heal` is an explicit boolean.
- Test 3: integration, `tests/test-352-auto-heal-hook.cjs`: Given watermark < running, When the hook runs, Then heal fires once, watermark advances, reward line is in `additionalContext`, exit 0; Given watermark == running, Then nothing fires; Given the hook throws, Then exit 0 and session continues.
- Test 4: unit, `tests/test-352-ui-compliance-scanner.cjs`: Given a fixture with `// ──`, `/* ── */`, a Shape-B tree renderer, and a real `'─'.repeat()`, When scanned, Then exactly one violation.
- Test 5: unit, `tests/test-352-preflight-scope-select.cjs`: Given two `installed_plugins.json` rows, When the running root matches the second, Then that row's version is compared, never `arr[0]`.
- Test 6: e2e, `tests/run-all-352.sh` (Feynman runner registration): the fresh-install and update simulations under a scratch HOME with a fake marketplace cache.

## Non-Code Follow-ups

- CHANGELOG.md: Fixed entries for F1-F12, Added entry for the auto-heal policy, under the next beta.
- Release lockstep: full `scripts/release.sh` prerelease after Phase 352 closes (beta.41 was cut by a peer session on 2026-09-16 before this phase started; this phase ships in the following beta).
- Canon: declare `canon_parts: [6, 7, 8, 11, 12]` in the phase frontmatter; update `docs/CANON-PHASE-MAP.md`; the auto-heal policy and its F.1 gate are declared in the connector registry (Part 11 R16).
- Docs: `skills/doctor/SKILL.md`, `commands/doctor.md`, `docs/VERSION-BUMP-CHECKLIST.md` (the auto-heal is now part of what an update does), the getting-started reference (no manual doctor step after install).
- knowledge-base.md: on resolve, add the summary block.
- Dev-research compositing: mirror this sweep as `rethinking-mindrianos/research/2026-09-16-phase-352-self-healing-install/` and `mindrianOS/research/`, cross-linked to this file (room binding to be confirmed by the navigator).

## Resolution

root_cause: (pending Phase 352)
fix: (pending Phase 352)
