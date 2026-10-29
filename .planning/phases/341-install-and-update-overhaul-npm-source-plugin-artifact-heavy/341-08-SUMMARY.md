---
phase: 341-install-and-update-overhaul-npm-source-plugin-artifact-heavy
plan: 08
subsystem: install-update-lifecycle
status: complete-with-waiver-dependency
tags: [update-collapse, session-start-verification, statusline, theo-probe, eureka-optin, harness-policy, hook-conversion]
requirements: [D-07, D-07a, D-07b, D-13]
canon_parts: [7, 8, 11, 12]
requires:
  - phase: 341-07
    provides: one install location, install.sh retired
provides:
  - "/mos:update as four steps: Check, Confirm, Loader, Verify"
  - "lib/core/session-verify-state.cjs: the one authority for the last-seen marker, the verification result, the statusline segment and the Eureka opt-in record"
  - "doctor --acceptance --session-start tier (four offline points) and two logged harness policies"
  - "converted SessionStart hook: version-change verification, detached Theo probe, one insight, one Eureka opt-in card"
key-files:
  created:
    - lib/core/session-verify-state.cjs
    - scripts/session-verify-probe.cjs
    - scripts/check-session-start-verification.cjs
    - scripts/check-eureka-optin-once.cjs
    - data/harness-policies/session-start-verification.json
    - data/harness-policies/eureka-optin-once.json
    - tests/test-341-update-collapsed.cjs
    - tests/test-341-session-verify-state.cjs
    - tests/test-341-session-start-tier.cjs
    - tests/test-341-session-start-verify-hook.cjs
    - tests/test-341-verify-insight-delivery.cjs
    - tests/test-341-eureka-optin-once.cjs
    - tests/test-341-eureka-optin-card.cjs
  modified:
    - commands/update.md
    - skills/update/SKILL.md
    - commands/doctor.md
    - skills/doctor/SKILL.md
    - scripts/check-version-and-sha.cjs
    - scripts/doctor.cjs
    - scripts/sessionstart-post-update-preflight.cjs
    - scripts/first-install-router.cjs
    - scripts/context-monitor
    - hooks/hooks.json
    - lib/statusline/cockpit-signals.cjs
    - lib/core/eureka/eureka-enable.cjs
    - lib/mcp/tools/gate.cjs
    - lib/mcp/tools/room.cjs
    - data/harness-policies/_schema.json
    - data/harness-manifest.json
    - data/mcp-tool-connectors.json
    - data/connector-registry.json
    - scripts/power-demo-prompt.md
    - docs/RELEASE-GATES.md
    - tests/run-all-341.sh
    - tests/test-update-restart-cue.cjs
    - tests/test-127.2-04-windows-path-and-update-activation.sh
    - tests/test-doctor-class-a-vestigial-legacy.cjs
    - tests/test-doctor-class-a-topology-drift.cjs
    - tests/test-3551-tri-polar.cjs
    - tests/test-341-eureka-no-brain-reach.cjs
  deleted:
    - scripts/post-update-activation.cjs
    - tests/test-mos-update-activation-gap.cjs
completed: 2026-10-29
---

# Phase 341 Plan 08: Collapse /mos:update, verify on the next session Summary

`/mos:update` is now Check, Confirm, Loader, Verify. The second implementation of the loader (the migrator, the activator, the touch-file, the SHA leg) is deleted. The first session after any install or update checks itself, shows one statusline segment, probes Theo detached, and delivers one insight plus one Eureka opt-in card on a single emit.

## Waiver note (read first)

The cold install is proven on NO platform of this version. Plan 341-06 is `complete-with-waiver`. The navigator's waiver is PROVEN as typed by the human on 2026-10-28: "i pprove imagisn that we did theis and it a go !". This plan lands on that waiver. Nothing below says the cold install is proven. The waiver relaxed no safety check in this plan: every change was exercised on temp HOME trees only, no real `~/.claude` and no real plugin cache was read or written by a test, and every hook change fails open.

## Commits

| Task | Commit | Result |
|------|--------|--------|
| 1. Collapse commands/update.md | 7b1d70fd4 | Four `### Step` headings. Mirror skills/update/SKILL.md regenerated. |
| 2. Retire the SHA leg | f04240c8a | No GitHub call. Three STATUS values plus ERROR. |
| 3. State contract, retire touch-file, tripwire | 92d9ecd57 | 18-arm state suite, 8-arm tripwire. |
| 4. Doctor tier, two policies | 5f5ea4cf2 | Tier of four points, 240 ms. |
| 5. Hook conversion, probe, insight | a13ab61f1 | 9-arm hook suite, 14-arm delivery suite. |
| 6. Opt-in card, recorder, enable coupling | 64ecd18df | 18-arm card suite. |

Trailer: `Co-Authored-By:` only. No `Claude-Session:` value was available to this executor (same as 341-07).

## Deviations from the plan (read before the evidence)

1. [Rule 1 - measured fact] The session-start tier has FOUR points, not five. The plan said `mcp-surface-tool-count` belongs inline. Measured 2026-10-29: that point takes 15.4 s (PROVEN, three runs). `mindrian-os` answers `tools/list` in 357 ms. The `mindrian-brain` shim answers but does not exit on stdin EOF, so the organ waits out its 15 s spawn timeout. 15.4 s alone exceeds the 12 s hook budget, so the plan acceptance "tier under 12000 ms" and "do not shrink the point set" contradict each other on this box. I kept the safety rule (hook budget, fail open) and RELOCATED the point: it runs on the detached probe leg beside the wire point (`doctor --acceptance --only=activation-reached-the-wire,mcp-surface-tool-count`). It is moved, not dropped. The tier set is asserted in both directions in `tests/test-341-session-start-tier.cjs` and `scripts/check-session-start-verification.cjs`. To bring it back inline: make the brain shim exit on stdin EOF, then add `'session-start'` to that point's `applies_to` and to the expected set in the runner.
2. [Rule 2 - safety] New doctor flag `--only=<id,id>` (narrows any selected tier). The plan had the probe run full-mode `--acceptance --json` and read one point, which would run ALL full-tier points on a user machine, including network and `npx-roundtrip` points. `--only` keeps the detached leg to two points. ASSUMED safe: it only filters; unknown ids select nothing.
3. [Rule 2 - safety] `doctor --acceptance --session-start` does not overwrite `last_acceptance_run` in install-state. That field means a full acceptance run; a four-point tier must not overwrite it.
4. [Rule 3 - blocking] Task 3's tripwire demands the retired touch-file literal be absent from the live tree, but the preflight hook that still contained it is only converted in Task 5. Task 3 therefore removed the touch-file gate, wire probe, drift banner and the `continue:false` path from the hook (the hook became "F8 cue only"), and Task 5 added the version-change leg on top. The hook never blocks in either state.
5. [Rule 3] `SESSION_VERIFY_BUDGET_MS` has a documented floor. Arithmetic: measured 240 ms, times 1.25 = 300 ms, rounded up to 500 ms. A 500 ms budget would turn every cold-disk verification into "inconclusive", so the constant is `min(10000, max(5000, 500))` = 5000 ms. The hung-doctor arm measured the hook at 5041 ms, inside the 12000 ms hook budget (PROVEN).
6. [Rule 1] The plan named `scripts/eureka-command.cjs enable`. That file does not exist. The real enable entry is `lib/core/eureka/eureka-enable.cjs` (`commands/eureka.md` line 187). The CLI instruction uses it.
7. [Rule 2 - nag guard] A new top-level key `eureka_optin_shown_for_version` in the same marker. Without it an unanswered or dismissed card would be re-instructed on EVERY prompt. `gate_render` writes it when the card is actually minted; the router writes it at emit time. `room_list` stays a pure read (it writes nothing). This is in the one marker file; no second file exists.
8. [Rule 2] The defer counter for the card is keyed by the hook payload `session_id`, and the defer bound is 8 turns, not 3. The reward machine declares six phases and needs about six turns, so a bound of 3 would cut a healthy onboarding off. A missing insight capture still gives up at 3. A new session restarts the count ("re-evaluates from scratch").
9. [Rule 2] When the router has no state of its own, the branch calls the existing `_checkOnboardStatus()`: FIRST_INSTALL means mid-flight (defer). Without this, an onboarded user would never reach "done" and a fresh install would be pre-empted on its very first prompt. It is lazy and runs only when something is due.
10. [Rule 2] `gate_answer` requires the minted card to carry `EUREKA_OPTIN_COPY` as its header. A model cannot mint a look-alike card under the reserved prefix and trigger an install (test arm "a look-alike card ...").
11. [Rule 1] `DOCTOR_SKIP_ACTIVATION_GATE` is respected by the probe, not cleared. The plan said clear it. A user's explicit offline opt-out is recorded as `wire: skipped`, `theo: refused` with the local-only text.
12. Test seam added: `MOS_SESSION_VERIFY_NO_PROBE=1` (keeps hook tests deterministic; the probe would overwrite `wire`).
13. Other files I had to touch (consumers found by grep): `skills/update/SKILL.md` and `skills/doctor/SKILL.md` (generated mirrors, `scripts/build-skill-mirrors.cjs`), `commands/doctor.md` (the `--post-update` flag text), `scripts/power-demo-prompt.md`, `docs/RELEASE-GATES.md`, `tests/test-3551-tri-polar.cjs` (normalizes the one intended statusMessage change), `tests/test-341-eureka-no-brain-reach.cjs` (the single npm spawn moved into `_enableEurekaInner`), `data/mcp-tool-connectors.json` and `data/connector-registry.json` (the `room_list` `hitl_why` clause), and the harness manifest digest (it changed because of that regeneration; it fails closed otherwise).
14. A one-time mistake, fixed before any commit: my first edit of the `--tier session-start` argv landed on the `worktree-hygiene` point (the same spawn line appears twice). It was moved to the `harness-policies` point in the same working session; the committed tree is correct (PROVEN: `grep -n harnessArgv scripts/doctor.cjs`, tier run shows `counts.total` 2).

## Task 1 evidence: commands/update.md

- Headings: `grep -c '^### Step '` = 4 (Check, Confirm, Loader, Verify). `post-update` count 0. `SHA_DIFFERS_INVERSION_HOTFIX` count 0. Frontmatter keys all present; only `argument-hint` changed. `node scripts/check-shape-declaration.cjs --check` exits 0 (51 pre-existing advisory WARN lines, including `commands/update.md` F.0 plus `excluded:true`, unchanged because the frontmatter is unchanged; ASSUMED pre-existing, not re-run on the base commit).
- Reapply decision: REMOVED, and `argument-hint` is now `[check|force]`. Reason: the mode listed `~/.mindrian/backups/*/patches/`, which nothing writes (the only producer of backup folders is `scripts/backup-modifications`, which writes `./mindrian-patches/` in the working directory, a different place). The local wiring it served was done by the retired `install.sh`. The removal is recorded in "What this command does NOT do anymore" without spelling the word reapply. `force` stays and its one job is stated in the file.
- Step 4, the three sentences verbatim:
  1. "The next session detects that the version changed, runs a bounded offline self-check, and shows the result as one statusline segment beside the version."
  2. "Larry opens that session with the detail plus one insight."
  3. "That is why this command no longer writes a file to remind itself to check later."
- NOT-do list names all five newly deleted behaviours (swap, dependencies, settings, touch-file, SHA).

## Task 2 evidence: check-version-and-sha.cjs

- `fetchTagSha`, `readLocalSha` and the hotfix STATUS emission are deleted. `grep -c 'api.github.com'` = 0, `fetchTagSha` = 0. `readLocalSha` is deleted, not kept: after the SHA leg left, no consumer remains (`commands/update.md` no longer prints a SHA, and the only other mentions were `scripts/power-demo-prompt.md`, now edited).
- STATUS set emitted by the code: `UP_TO_DATE`, `VERSION_DIFFERS`, `NETWORK_ERROR`, `ERROR`. Set documented in the header: the same four. PROVEN by `grep -o 'STATUS=[A-Z_]*' | sort -u`.
- Offline proof (no network was made): the script was run with an `https.get` stub (`-r` preload) for three catalog pins. Output: equal pin gives `UP_TO_DATE`, newer pin gives `VERSION_DIFFERS`, older pin gives `UP_TO_DATE`. The stub logged exactly ONE requested URL, the marketplace catalog. The plan command `node scripts/check-version-and-sha.cjs` was NOT run bare (it would call the network). UNVERIFIED against the live catalog.
- Existing suites pass: `test-check-version-semver-prerelease`, `test-marketplace-cache-prerelease-pick`, `test-check-version-latest-resolution`, `test-check-version-network-retry`.
- Consumer list and disposition: `commands/update.md` (rewritten, Task 1); `skills/update/SKILL.md` (regenerated mirror); `scripts/power-demo-prompt.md` (4 SHA mentions removed); `docs/RELEASE-GATES.md` Gate 2 (rewritten); the four tests above (unchanged, pass); `CHANGELOG.md` (history, untouched); `dist/*/skills/update/SKILL.md` (generated bundle, already stale since beta.52 per `build-dist-bundles.cjs --check-stale`, regenerated at release, left alone).

## Task 3 evidence: contract, deletion, tripwire

- `scripts/post-update-activation.cjs` and `tests/test-mos-update-activation-gap.cjs` removed with `git rm`; the doctor flag, help text and dispatch removed in the SAME commit. `grep -c "'--post-update'" scripts/doctor.cjs` = 0, `postUpdate` = 0. `activation-reached-the-wire` kept untouched (a comment above its `id:` records why).
- Where each of the four deleted test arms now lives:
  - arm 1 (cold swap, touch-file): deleted with the activator; the loader owns the swap. `tests/test-341-update-collapsed.cjs` pins that the activator is gone.
  - arm 2 (idempotent re-run): same.
  - arm 3a (preflight, no touch-file, empty envelope): `tests/test-341-session-start-verify-hook.cjs` arm 1 (no version change gives an empty envelope, exit 0, doctor never spawned).
  - arm 3b (touch-file, inconclusive probe, never blocks): hook suite arms "inconclusive (doctor absent)", "inconclusive (doctor hangs)" and `tests/test-update-restart-cue.cjs` arm (e) (never blocks).
  - the exports arm: the tripwire (file absent).
- Other retired arms (they drove the deleted activator): `tests/test-doctor-class-a-vestigial-legacy.cjs` v.3 and `tests/test-doctor-class-a-topology-drift.cjs` a.4 step 2, replaced by comments; `tests/test-127.2-04-windows-path-and-update-activation.sh` Instance-7 asserts reduced to the surviving three (9 of 9 pass).
- `existsSync` count in `lib/statusline/cockpit-signals.cjs`: pre-edit 1, post-edit 0 (PROVEN). `readPostUpdate` became `readPostUpdateVerification`; the `post_update` KEY and `lib/statusline/cockpit-renderer.cjs` are unchanged (PROVEN: no diff).
- Glyph isolation: the carve-out set is `EXCLUSIVE_GLYPHS = [chart, target, gear]` plus the shared warning sign. The check mark U+2713 and the warning sign U+26A0 are NOT carve-out glyphs. `tests/test-statusline-glyph-isolation.cjs` is RED on the base commit too (PROVEN on a `git archive 49491b303` copy) because ignored build artifacts under `ui/` and `lib/ui-shell/dist` contain those emoji; none of my files appear in its offender list.
- Statusline end to end (temp marker): ok state renders `mos beta.74 ✓`; failed state renders `mos beta.74 ⚠ 2` and the cockpit escalates to "-> run /mos:doctor --fix"; pending state renders `mos beta.74` with no glyph; no state renders the old `· v2.0.0-beta.74` (PROVEN).
- Tripwire arms: 8, including `SessionStart` count 9.
- State suite: 18 arms (the plan counted 15; I split a few).

## Task 4 evidence: tier and policies

- MEASURED wall clock of `doctor --acceptance --session-start`: 240 ms in the test (190 to 200 ms direct), 4 points (PROVEN). With the original five-point shape it was 20.2 s (PROVEN, three runs), of which `mcp-surface-tool-count` 15.4 s and the whole-set harness run 4.8 s (the tier now passes `--tier session-start`, so `harness-policies` takes 143 ms).
- Edited doctor lines (current numbers): flag declaration about 186 to 196, argv branch and implication about 306 to 350, help text about 497 to 520, `runAcceptance` mode reorder about 2436 to 2460, the new `eureka-optin-state` point about 948 to 985, tier membership on `install-state`, `session-start-active-version` and `harness-policies`, comment on the wire point about 1730, comment on `mcp-surface-tool-count`, the tier-aware harness argv about 1690 to 1696.
- `filterByTier` is at `scripts/run-harness.cjs:282` and is generic over the vocabulary, so `run-harness.cjs` needed no edit (PROVEN: no diff in the range).
- Pre-tag point count before and after: 21 and 21, the same ids in the same order. In a temp HOME the same 4 points fail before and after (`install-state`, `deployment-surfaces`, `verify-release`, `session-start-active-version`), caused by the empty temp HOME (as in 341-07). The plan's "exits 0" for pre-tag and pre-flight is UNVERIFIED here for that reason; pre-flight shows 1 point and fails only `verify-release-clean-tree` on a temp HOME.
- `eureka-optin-state` sentences (reporter, `ok:true` on every path):
  - "Eureka opt-in: not yet asked"
  - "Eureka opt-in: installed at <version>"
  - "Eureka opt-in: declined for <version>" extended to "declined for <version> (install failed: <reason>)"
  - "Eureka opt-in: never (cleared by running /mos:eureka enable)"
  - fallback: "Eureka opt-in: state unreadable"
- `run-harness --tier session-start --json` reports exactly two policies at rung `logged`. `build-harness-manifest.cjs --check` exits 0. The schema enum has 6 members.
- Em-dash guard: all ten paths added to `PHASE_341_SURFACES` were em-dash free before they were added (PROVEN by `grep -P`; the probe path did not exist yet and is em-dash free as written).

## Task 5 evidence: hook, probe, router

- Hook count still 9; the preflight entry still has `timeout: 12000`, `async: false`, same position; only its `statusMessage` changed. `grep -c 'continue: false'` and `formatBanner` in the hook = 0. The hook uses `mergeVerifyState` only (`writeVerifyState` = 0) and never reaches `enableEureka` (0).
- Fast path (marker equals registered version): 26 ms wall clock, doctor never spawned (PROVEN, test arm). Hook with a hanging doctor: 5041 ms and an inconclusive result.
- `SESSION_VERIFY_BUDGET_MS` = 5000 ms. Arithmetic is in deviation 5.
- Probe: `grep -c 'activation-reached-the-wire'` is at least 1, `server=mindrian-brain` 0, `verification is local-only` at least 1, no terminal writes. Egress allowlist is the frozen `PROBLEM_TYPES` enum minus `unknown`, enforced in code before the call. A planted sentinel in USER.md and STATE.md appears in neither the state file nor the capture (PROVEN).
- Router: `git diff --stat 49491b303..HEAD -- scripts/first-install-router.cjs` = 152 insertions, 0 deletions. Token counts, pre and post: `_fireReward` 3 and 3, `_drainReward` 2 and 2, `PHASES` 5 and 5, `emitContinueWithContext` 5 and 6 (the one new call). The branch is the named function `_deliverVerifyInsight`. Output of the old and the new router was byte-identical for four inputs (done, onboarded, fresh first install, routed), PROVEN by hashing both on a `git archive` copy.
- L4 layer-id discrepancy (pre-existing fragility, documented here and not inherited silently): `lib/core/doctor/class-m-brain-smoke.cjs:78` names the layer `{ id: 'stdio_handshake', name: 'L4 MCP stdio handshake' }`. The old preflight, and the surviving `activation-reached-the-wire` point, match `id === 'mcp_stdio_handshake' || name === 'L4 MCP stdio handshake'`. The id half never matches; only the name fallback works today. The deleted preflight probe is gone; the doctor point is unchanged and still works.

## Task 6 evidence: the D-07b card

`EUREKA_OPTIN_COPY` in full (single line in `lib/core/session-verify-state.cjs`):

> Eureka spots connections between your claims by meaning, not keywords. It needs a one-time 380 MB local model download. Install it now?

Options, in order: `Install now`, `Not now`, `Never ask again`. Option ids are spelled only in the state module (`grep -c "install_now"` in the router and in `room.cjs` = 0; `gate.cjs` spells none and reads `EUREKA_OPTIN_CHOICE_BY_OPTION_ID`).

- `normalizeCard` is at `lib/mcp/gate-render.cjs:286` (the plan said 150; the file grew). `buildEurekaOptinCard` survives it with all three option ids and labels intact (test arm, PROVEN).
- Six fixtures, asserted by the runner and by the state suite (ask, defer, reason):

| Fixture | Input | ask | defer | reason |
|---------|-------|-----|-------|--------|
| fresh | no state, not installed | true | false | no_standing_answer |
| installed | installedNow true | false | false | already_installed |
| declined-same-version | declined for V, now V | false | false | declined_this_version |
| declined-older-version | declined for U, now V | true | false | no_standing_answer |
| never | never for U, now V | false | false | never |
| first-install-reward-pending | no state, reward pending | false | true | first_install_reward_owns_turn |

- `return {` count in `eureka-enable.cjs`: 6 before and 6 after (five inside the installer, one in the argv builder). `node tests/test-341-eureka-enable-argv.cjs` gives PASS=6 FAIL=0.
- Per-server MCP tool counts: before `mindrian-os=75`, `mindrian-brain=6` (combined 81, about 21853 tokens estimated) and after the same numbers. No tool was added. No tool description changed, so `tests/test-270-tool-schema-budget.cjs` stays 5 passed and no re-baseline was needed (measured drift 0 percent; `DRIFT_TOLERANCE_PCT` untouched).
- Boundary for "runner is a caller, not a second implementation": the runner source carries `// FIXTURES-BEGIN` and `// FIXTURES-END` marker lines. The test asserts every occurrence of the quoted `declined` literal sits between the markers (exactly two, both fixtures) and that the source references `shouldAskEurekaOptin`.
- The two installed signals (the wave-2 resolver and class S L5 `model_installed`) collapse into one authority: plan 341-03 routes L5's probe through the same `eurekaDepInstalled`. The router and `room_list` call it directly (one filesystem probe); class S is never spawned from a prompt hook.
- Enable coupling (`/mos:eureka enable` clears `never`): seeded `never`, a fixture-installed stack, `enableEureka({})` short-circuits idempotently and the state reads `installed`; `shouldAskEurekaOptin` then gives `already_installed`. `skipOptinRecord` leaves a `never` untouched (both PROVEN).
- Aborted call: a thrown install gives `optin_record_failed`, writes no `eureka_optin`, and the card still asks next time (PROVEN).
- The `@huggingface` check: the plan's literal `test ! -d ~/.mindrian/eureka-deps/node_modules/@huggingface` cannot be true on this box. That directory EXISTS on the real home with an mtime of 2026-09-17 (it holds `jinja`, `tokenizers`, `transformers`), long before this plan. Nothing in this run touched it: every test used a temp `MINDRIAN_EUREKA_DEPS_ROOT`, and the card suite's last arm asserts only the explicit package.json stubs exist under its temp roots (PROVEN). I did not read or modify the real directory beyond one `ls` and `stat`.

## Verification

All with temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME.

- New and changed suites pass: `update-collapsed` 8, `session-verify-state` 18, `session-start-tier` 13, `eureka-optin-once` 6, `session-start-verify-hook` 9, `verify-insight-delivery` 14, `eureka-optin-card` 18, `test-update-restart-cue` 29, `test-341-eureka-no-brain-reach` 21 (PROVEN).
- `bash tests/run-all-341.sh`: PASS=30 FAIL=3 SKIP=2 EXPECTED-RED=0. Before this plan (341-07): PASS=22 FAIL=3 SKIP=3. The 3 FAILs are exactly the known reds: `341: run-all-310.sh`, `341: version-of-record-source-version`, `341: step-block tripwire`. NO new red. The 2 SKIPs are plans 341-09 and 341-10. The always-green blocking leg `eureka-optin-once runner (D-07b f, blocking on the dev side)` is PASSED, not skipped.
- Born-wired and projection gates: `build-command-registry --check`, `build-orchestration-projection --check`, `build-connector-registry --check`, `check-render-coverage`, `check-help-coverage`, `build-skill-mirrors --check`, `build-harness-manifest --check`, `run-harness --check` all exit 0. `check-shape-declaration --check` exits 0.
- `echo '{}' | node scripts/context-monitor` exits 0 with a non-empty line. `node scripts/sessionstart-coordinator.cjs` exits 0.
- Reds that exist on the BASE commit and are not mine (each PROVEN by running it on a `git archive 49491b303` copy): `test-237-approve-executes` (harness mutation needle), `test-mux-card-before-answer` S3, `test-346-catalogue-schema` 12 (names `ambient-stop.cjs` and `card-before-answer-hook.cjs`), `test-3551-tri-polar` (fails on `PreToolUse` from an unrelated entry), `test-l8g-theo-bare` A4, `test-statusline-glyph-isolation`, `test-skill-mirrors-tripwire` (3 failures about `install-pre-commit.sh`). The seven wire-snapshot suites for the 25 Eureka tools were not touched.

## Known Stubs

None. Every statusline, hook and card path reads a real source.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-egress-on-user-machine | scripts/session-verify-probe.cjs | A detached child now makes one Theo handshake (through the existing `activation-reached-the-wire` point) and one `recommend_chain` call on the first session after a version change. Only UDP, IDP or WDP can leave the process. It is in the plan's threat register (T-341-32, T-341-33). |
| threat_flag: user-writable-marker | ~/.mindrian/session-verify/state.json | Holds the opt-in answer and the shown markers. It can only suppress a card or force a re-verify; it cannot grant an install (T-341-31, T-341-34). |

## Risks and open items for the main session

1. FOLLOW-ON (your decision): the legacy-clone migrator keeps its belt (refuses a directory whose origin matches the plugin repo) and I did not loosen it. The gap: `install.sh` cloned `github.com/jsagir/mindrian-os-plugin` into the legacy directory, so the migrator refuses the very clone it targets. `install.sh` also made symlinks in `~/.claude/commands/mos`, `~/.claude/skills` and `~/.claude/agents` that will dangle after removal. Needs a navigator decision or a follow-on quick.
2. The brain shim does not exit on stdin EOF. This costs `mcp-surface-tool-count` a fixed 15 s in every doctor run (release gate included) and is the reason deviation 1 exists. A fix in the shim lets the point come back inline.
3. The detached probe's results `surface` and `surface_reason` are recorded in the marker but nothing displays them yet (the statusline glyph is `local.ok` only, by D-07a c). A failed MCP surface check on a user machine is therefore silent for now. UNVERIFIED on a live install.
4. A non-Claude host that answers the card through the elicitation rung gets its answer inline and never reaches `gate_answer`, so nothing is recorded; the shown marker still stops a repeat. Claude Code, Desktop and Cowork use the AskUserQuestion rung. ASSUMED fine.
5. On Desktop and Cowork, `room_list` is a plain advisory the model must follow. Whether Larry actually renders the card there is model compliance, UNVERIFIED on a live Desktop session (this run had no Desktop surface).
6. `dist/` bundles still carry the old `/mos:update` text (generated, stale since beta.52, rebuilt at release).
7. The real `~/.mindrian` shows writes from 01:10 today; I attribute them to the live main session's own hooks (card-fire files, statusline telemetry). No file under `~/.mindrian/session-verify/` exists on the real home. UNVERIFIED who wrote each file; none of my test or doctor runs used the real HOME.
8. Cold install on Windows and macOS remains waived and unobserved. The new hook, the `--session-start` tier and the router branch were exercised on Linux only.

## Self-Check: PASSED

Files exist: the 13 created files above, and the 2 deletions confirmed absent (`test ! -f`). Commits exist: 7b1d70fd4, f04240c8a, 92d9ecd57, 5f5ea4cf2, a13ab61f1, 64ecd18df. Dash scan of every file written or changed: no em-dash and no en-dash. No edit to STATE.md, ROADMAP.md, REQUIREMENTS.md, CHANGELOG.md or docs/CANON-PHASE-MAP.md by this plan.
