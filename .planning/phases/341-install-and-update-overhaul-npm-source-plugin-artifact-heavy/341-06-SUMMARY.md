---
phase: 341-install-and-update-overhaul-npm-source-plugin-artifact-heavy
plan: 06
status: complete-with-waiver
requirements: [D-01, D-04, D-13]
key-files:
  created:
    - scripts/collect-cold-install-evidence.cjs
    - docs/install/COLD-INSTALL-PROOF-341.md
    - tests/test-341-cold-install-evidence.cjs
completed: 2026-10-28
---

# Phase 341 Plan 06: Cold-install proof (WAIVED, not observed) Summary

The evidence collector is built and tracked. The D-13 step 2 cold-install proof was WAIVED by the navigator and was NOT observed. A waiver record and an honesty gate replace the three-envelope proof.

## Navigator ruling (waiver)

Typed by the navigator in the main session on 2026-10-28, verbatim:

> "i pprove imagisn that we did theis and it a go !"

It was written beside the line "341 install overhaul | Parked: needs the three-OS cold-install proof." The main session reads it as a waiver of the D-13 step 2 proof on Windows, macOS and Linux, and a go for plans 341-07 to 341-10. Status: `WAIVED by the navigator, not observed`.

## Tasks

| Task | Result | Commit |
|------|--------|--------|
| 1. Build `scripts/collect-cold-install-evidence.cjs` | Done before this step | 960a7a2ec, 98517bc52 |
| 2. Cold-install checkpoint (3 platforms) | WAIVED by the navigator, not observed | none |
| 3. Record in a tracked file and gate | Adapted: waiver record plus honesty gate | see git log (docs/install/COLD-INSTALL-PROOF-341.md, tests/test-341-cold-install-evidence.cjs) |

## Not observed

- The Windows (win32) cold install. No envelope exists.
- The macOS (darwin) cold install. No envelope exists.
- A clean-state Linux cold install. The beta.31 Linux datum is an update over beta.27.
- `first_install_seconds` on Windows, macOS and Linux. Every recorded value is null. The 24 s in the 2026-09-10 Linux log is an update time, not a cold-install time.
- The `/mos:eureka enable` smoke (`model_installed` reaching ok:true) on any platform.
- The Windows longest path against the computed 180 and 188 characters. Nothing measured.
- 341-RESEARCH assumption A1 (loader first-install timeout) stays unknown.
- Tri-Polar ruling for Claude Desktop and Cowork (assumption A6): DEFERRED. Plan 341-07 may assume the CLI loader path only.

## What is real

- Old Linux evidence, read from the phase directory: `341-06-LINUX-EVIDENCE.md` and `341-06-linux-envelope.json` (2.0.0-beta.31, linux/arm64, 2026-09-10). PROVEN by file read: npm source pinned, `node_modules` present, completion record present, 122 packages, both MCP servers `loads: true`, longest path 109, `first_install_seconds` null, `doctor_acceptance.ok` false (three dev-repo points).
- Collector run on the Linux dev checkout by an earlier executor (reported by that executor, not re-run in this step): exit 0 after 2m27s, 21 fields, both MCP servers `loads: true`. The dev checkout has no cache directory for its own version, so install fields are false or zero. This shows the collector works. It does not show an install.

## Gates touched

- `tests/test-341-cold-install-evidence.cjs`: new. It is the gate the plan describes, rewritten for the waiver. 17 arms. It requires the status `WAIVED by the navigator, not observed`, the verbatim ruling, no `PROVEN` anywhere, no win32 or darwin envelope, no fenced JSON, a "Not observed" section (Windows, macOS, first_install_seconds, eureka enable), a Tri-Polar section with DEFERRED, the Windows-on-ARM gap, no placeholder, no em-dash or en-dash. Demonstrated to fail on a doctored copy (status replaced by "PROVEN on all platforms": 2 arms failed, 15 passed). The scratch copy was deleted.
- `tests/run-all-341.sh`: NOT edited. Its `run_if` leg `341: cold-install-evidence` runs the test above because the file now exists. It becomes a live leg.
- Gates that read the proof file for `PROVEN`: none found. A grep of `tests/`, `scripts/`, `lib/`, `docs/`, `hooks/` and `bin/` for `COLD-INSTALL-PROOF` found only the run-all leg, the collector and a comment in `tests/test-369-installed-layout.cjs` (a timeout comment, not a gate). No script or test was loosened.
- Plan TEXT that assumes the proof is green and was NOT edited: 341-07 truth line 27, 341-09 action step b ("shows the loader performing the swap on all three platforms"), 341-10 close-out. The executors of those plans must read the waiver status in the proof file. This is a plan-text issue, not a script gate.

## Deviations from Plan

1. [Rule 3 - Blocking] Task 2 waived by the navigator. Task 3 adapted from "record three envelopes" to "record the waiver honestly". The Task 3 acceptance arms for envelopes (nine arms, `"platform": "win32"` count, PROVEN or DEFERRED under Tri-Polar for a proven result) cannot hold and were replaced by the waiver arms above.
2. [Rule 1 - Bug] The plan names `lib/core/eureka/vector-store.cjs` for the Windows-on-ARM fallback. That path does not exist. The record names `lib/core/semantic-index/vector-store.cjs`, which exists. The upstream claim that no `sqlite-vec-windows-arm64` package exists is carried from 341-RESEARCH and was not re-checked (no network call allowed). UNVERIFIED.
3. Success criteria of the plan ("cold install completed on Windows, macOS and Linux") are NOT met. They are waived, not satisfied.

## Verification

- `node tests/test-341-cold-install-evidence.cjs`: PASS=17 FAIL=0 (PROVEN, run in this step).
- Doctored-copy demonstration: FAIL on the status arm and the PROVEN arm (PROVEN, run in this step).
- Dash scan of the record and the test: 0 em-dashes, 0 en-dashes (PROVEN).
- `bash tests/run-all-341.sh` (run twice, once with a temp HOME): PASS=20 FAIL=3 SKIP=5 EXPECTED-RED=0. The `341: cold-install-evidence` leg PASSED (it was SKIPPED before). The 3 FAILs are NOT caused by this plan: `341: run-all-310.sh` (310 leg 3 and leg 9), `341: version-of-record-source-version`, and `341: step-block tripwire`. All three concern `scripts/release.sh` step-block hashes. `scripts/release.sh` last changed in commits 1307192bb and e5c2d0827 (379.1.1-02), which this plan did not touch. UNVERIFIED that those commits are the cause; not investigated (out of scope). Logged here as deferred.
- 5 SKIPs are the later-plan test files (341-07 to 341-10) that do not exist yet.

## RISKS

Plans 341-07 to 341-10 retire `install.sh`, collapse `/mos:update` and remove doctor classes A and H and the legacy-topology halves of I and J with the cold install proven on no platform of this version. If the loader behaves on Windows or macOS as 341-RESEARCH only computed (MAX_PATH, first-install timeout), a user could be left with no working install path and no plugin-side recovery. Desktop and Cowork resolution of the single install location is DEFERRED.

## Self-Check

Files exist and are committed by explicit path. The status in this file is `complete-with-waiver`, not `complete`.
