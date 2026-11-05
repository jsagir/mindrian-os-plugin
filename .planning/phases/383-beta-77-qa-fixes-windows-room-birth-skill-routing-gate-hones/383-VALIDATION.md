---
phase: 383
slug: beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-05
---

# Phase 383 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from 383-RESEARCH.md "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | plain Node assertion scripts (`node tests/test-*.cjs`, exit code), bash aggregators |
| **Config file** | none - Wave 0 creates `tests/run-all-383.sh` (copy the shape of `tests/run-all-381.sh`: glob discovery of `tests/test-383-*.cjs`, found-eq-0 guard, dash fence, Part 8 sweep) |
| **Quick run command** | `node tests/test-383-<leg>.cjs` |
| **Full suite command** | `bash tests/run-all-383.sh` |
| **Estimated runtime** | under 120 seconds (each leg is a stub-PATH or fixture test; no network) |

---

## Sampling Rate

- **After every task commit:** Run the task's `node tests/test-383-<leg>.cjs` plus the must-stay-green file for the file touched (table below)
- **After every plan wave:** Run `bash tests/run-all-383.sh`
- **Before `/gsd-verify-work`:** Full suite green, plus `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/doctor.cjs --acceptance`
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the plans; the requirement, test type and command are fixed here. The planner fills the Task ID and Plan columns.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 383-03-T1 | 03 | 1 | QA383-01 | T-383-01 PATH hijack | probe by running, reject System32/WindowsApps bash, absolute resolved path, forward-slash output, `tried[]` listed | unit, injected platform + fake spawn | `node tests/test-383-runtime-resolver.cjs` | ❌ W0 | ⬜ pending |
| 383-03-T2 | 03 | 1 | QA383-01 | T-383-01 | registry resolves the interpreter by running; stub `python3` exiting 9009 falls through to `python`; none found exits 127 naming every candidate; no room dir left | integration, PATH shim (l9o precedent) | `node tests/test-383-registry-interpreter.cjs` | ❌ W0 | ⬜ pending |
| 383-03-T2 | 03 | 1 | QA383-01, QA383-10 | T-383-03 writes outside the room | `create` with an absolute RPATH writes no tree under ROOMS_HOME (the doubled-path defect) | integration, temp home | `node tests/test-383-registry-abs-rpath.cjs` | ❌ W0 | ⬜ pending |
| 383-04-T1,T2 | 04 | 1 | QA383-01 | T-383-02 shell:true | the 4 P0 sites spawn through the one helper; no bare `'bash'` left at room-birth.cjs 1439/1447, room-identity.cjs 562, room-open.cjs 160 | static grep | `node tests/test-383-spawn-chokepoint.cjs` | ❌ W0 | ⬜ pending |
| 383-04-T1,T2 | 04 | 1 | QA383-04 | N/A | `prepareRoomCreation` with a failing injected resolver returns `environment_not_ready`, mints no gate (ledger count unchanged), writes nothing under the temp rooms home; `birthRoom` guard returns before mkdir | unit | `node tests/test-383-preview-env-check.cjs` | ❌ W0 | ⬜ pending |
| 383-05-T2 | 05 | 2 | QA383-02 | N/A | session-start no-room context does not suppress an explicit method-need line (string contract); listing-size report (entries, chars) | string lint + report | `node tests/test-383-no-room-routing.cjs` | ❌ W0 | ⬜ pending |
| 383-05-T3 (conditional) | 05 | 2 | QA383-03 | N/A | first-turn honest notice when the MCP server cannot load (fixture: plugin root without `node_modules/@modelcontextprotocol/sdk`) | hook fixture | `node tests/test-383-mcp-unavailable-notice.cjs` | ❌ W0 (only if Wave 2 picks this fix) | ⬜ pending |
| 383-06-T2 | 06 | 3 | QA383-05 | N/A | transcript with "Your call: A \| B \| What if C" and no AskUserQuestion -> `declared-fork-no-card`; a turn after the user answered with no declaration -> `no-gate-signal` | hook fixture transcript | `node tests/test-383-card-fork.cjs` | ❌ W0 | ⬜ pending |
| 383-06-T1,T2 | 06 | 3 | QA383-06 | N/A | failure payload carries `plain` (3 lines, no path, no stack); verbatim line kept in stderr/log; doctrine text says plain-first | unit + string lint | `node tests/test-383-plain-failure.cjs` | ❌ W0 | ⬜ pending |
| 383-06-T2 (C4), 383-07-T1 | 06, 07 | 3 | QA383-07 | N/A | no third-person reference to the navigator in static card option labels/descriptions (startup-operations.cjs, commands/*.md "Options:" lines, gate templates) | string lint | `node tests/test-383-card-second-person.cjs` | ❌ W0 | ⬜ pending |
| 383-08-T1,T2; U3 383-11-T3 | 08, 11 | 3 | QA383-08 | N/A | the static Larry-authored strings pass `findUnsourcedNumber`; the session string, once named, is added as a leg | string lint | `node tests/test-383-sourced-number.cjs` | ❌ W0 | ⬜ pending |
| 383-07-T1,T2 | 07 | 3 | QA383-09 | N/A | corpus of default turns: `countSentences` <= 8; "just tell me" turn exempt; shadow hook logs a `voice-length` row | unit + hook fixture | `node tests/test-383-voice-length.cjs` | ❌ W0 | ⬜ pending |
| 383-04-T2 (W3 also by 383-03-T2) | 04 | 3 | QA383-10 | T-383-03 | no write under the temp rooms home before approve on the MCP path (snapshot before preview and after reject/defer) | integration | `node tests/test-383-no-write-before-gate.cjs` | ❌ W0 | ⬜ pending |
| 383-09-T1 | 09 | 3 | QA383-01, QA383-03 (D-07) | T-383-01 | doctor row names bash, python, versions, tried, and the Windows hook shell; warns when hooks would not run in Git Bash | unit, injected platform | `node tests/test-383-room-runtime-doctor.cjs` | created by 383-09 | pending |
| 383-10-T1 | 10 | 3 | QA383-10 (D-02) | T-383-04 | doubled-path folders listed read-only with a digest; delete only through --clean-doubled-rooms=<digest>; edited folders kept | integration, temp home | `node tests/test-383-doubled-room-trees.cjs` | created by 383-10 | pending |

Plan mapping note (planner, 2026-11-05): the "Wave" column is the PRD wave. GSD execution waves run 0 to 9 (frontmatter `wave`), with the PRD wave in frontmatter `prd_wave`, because CHANGELOG.md and shared source files would overlap inside a PRD wave and `workflow.use_worktrees` is false. Two corrections to the research: (1) `data/command-registry.json` holds `/mos:scientific-roadmap` (its `commands` key is an array); (2) the MCP server package is `@modelcontextprotocol/server`, not `@modelcontextprotocol/sdk` (Phase 267), so the conditional notice fixture uses that name.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Must-stay-green (run at HEAD 18f517f5d by the researcher)

| Test | HEAD result |
|------|-------------|
| `tests/test-platform.cjs` | PASS |
| `tests/test-room-birth.cjs` | 35/35 |
| `tests/test-l9o-rooms-python-floor.cjs` | 18 passed, 0 failed |
| `tests/test-room-registry-windows-path.cjs`, `-windows-python-interp.cjs`, `-windows-atomic-replace.cjs` | exit 0 |
| `tests/test-startup-flows.cjs`, `tests/test-371-startup-ui.cjs` | exit 0 |
| `tests/test-359-declared-arm.cjs` | 20/20 |
| `tests/test-3696-reply-checks.cjs` | 143/143 |
| `tests/test-card-fire-relevance-gate.cjs` | exit 1, 5 expected RED legs - must not get worse |

Also name in plans (not run by the researcher): `tests/test-room-registry-path-resolution.cjs`, `tests/test-self-update-platform.cjs`, `tests/test-session-start-banner.cjs`, `tests/test-353-subroom-birth.cjs`, `tests/test-209-card-fire-gate.cjs`, `tests/run-all-359.sh`, `tests/run-all-3696.sh`, `tests/test-127.2-04-windows-path-and-update-activation.sh`, `tests/test-369-hook-require-graph.cjs`.

---

## Wave 0 Requirements

- [ ] `tests/run-all-383.sh` - aggregator (shape of `tests/run-all-381.sh`)
- [ ] `tests/test-383-runtime-resolver.cjs` - QA383-01
- [ ] `tests/test-383-registry-interpreter.cjs` - QA383-01
- [ ] `tests/test-383-registry-abs-rpath.cjs` - QA383-01, QA383-10
- [ ] `tests/test-383-spawn-chokepoint.cjs` - QA383-01
- [ ] `tests/test-383-preview-env-check.cjs` - QA383-04
- [ ] `tests/test-383-no-room-routing.cjs` - QA383-02
- [ ] `tests/test-383-mcp-unavailable-notice.cjs` - QA383-03 (conditional on the Wave 2 diagnosis)
- [ ] `tests/test-383-card-fork.cjs` - QA383-05
- [ ] `tests/test-383-plain-failure.cjs` - QA383-06
- [ ] `tests/test-383-card-second-person.cjs` - QA383-07
- [ ] `tests/test-383-sourced-number.cjs` - QA383-08
- [ ] `tests/test-383-voice-length.cjs` - QA383-09
- [ ] `tests/test-383-no-write-before-gate.cjs` - QA383-10
- [ ] `383-QA-REPORT-verbatim.md` - the owner's account (present as of 2026-11-05; the full report text is still owed)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Windows room create with no WSL distro and no real Python: created, or one plain message and no folder | QA383-01 | This host is WSL; the QA laptop's PATH and WSL state cannot be reproduced here | Wave 4: on the owner's Windows machine, run `/mos:new-project` in Claude Code CLI; record the outcome, the resolver's `tried[]` line, and `ls` of the rooms home in `383-WINDOWS-RECEIPT.md`; `node scripts/real-room-run.cjs --desktop-verified win` if Desktop is also checked |
| Scripted session reaches `/mos:scientific-roadmap` with and without a room | QA383-02 | needs a live model | `claude plugin eval` with a `tool_used: Skill` grader (nightly); record the run id in the Wave 2 SUMMARY |
| Desktop and Cowork rows for the resolver, preview check, routing and card firing | QA383-01, -04, -02, -05 | no Desktop or Cowork host in this session | owner runs the same create on Claude Desktop (Windows); rows stay UNVERIFIED otherwise |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
