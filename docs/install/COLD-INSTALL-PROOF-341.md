# Cold-install proof record - Phase 341 (D-13 step 2)

**Status:** WAIVED by the navigator, not observed
**Waived:** 2026-10-28
**Plugin version under the waiver:** none. No version has a recorded three-platform cold install. The only Linux datum is for 2.0.0-beta.31 and is not a cold install (see "What the collector measured on Linux").

This file is a waiver record. It is NOT a proof. No Windows run, no macOS run, and no first install time on any platform were observed for this phase. Every reader must treat the cold install of the npm-source artifact as unobserved on Windows and macOS, and as only partly observed on Linux.

Privacy note (T-341-19): paths below may carry a home directory and a username. Redact before you copy this file outside the repo if you wish.

## Navigator ruling (waiver)

Typed by the navigator in the main session on 2026-10-28, quoted verbatim, spelling kept:

> "i pprove imagisn that we did theis and it a go !"

The ruling sat beside the line "341 install overhaul | Parked: needs the three-OS cold-install proof." The main session reads it as follows: the navigator waives the D-13 step 2 cold-install proof on Windows, macOS and Linux, and wants plans 341-07 to 341-10 to go ahead. The ruling does not claim that any run took place. The words "imagine that we did this" in the ruling say the opposite.

## Not observed

These items were NOT observed. No envelope, time, or result for them exists. None is invented in this file.

| Item | Status |
|------|--------|
| Cold install on Windows (win32) | NOT OBSERVED. No envelope. |
| Cold install on macOS (darwin) | NOT OBSERVED. No envelope. |
| Cold install on Linux from a clean state | NOT OBSERVED. The beta.31 Linux datum is an update over beta.27, not a cold install. |
| first_install_seconds on win32, darwin and linux | NOT OBSERVED. Every recorded value is null. |
| The `/mos:eureka enable` smoke (`model_installed` layer reaching ok:true) on any platform | NOT OBSERVED. |
| Windows longest path under 260 characters (MAX_PATH) | NOT OBSERVED. Only the computed budget from 341-RESEARCH F-5 exists (180 and 188 characters). |
| 341-RESEARCH assumption A1 (does the loader first `npm install` have a timeout) | UNKNOWN. No timing exists. |

## What the collector measured on Linux

The collector is `scripts/collect-cold-install-evidence.cjs`. It emits an envelope with schema `mos-cold-install-evidence/1`. Two Linux data sources exist. Both are real. Neither is a cold install.

### Source 1: beta.31 envelope, 2026-09-10 (read from the file, linux/arm64)

The source is `341-06-linux-envelope.json` and `341-06-LINUX-EVIDENCE.md` in the phase directory. That directory is gitignored. The values below were copied from the file by hand.

| Field | Value |
|-------|-------|
| collected_at | 2026-09-10T05:58:56.528Z |
| platform / arch / node | linux / arm64 / v22.23.1 |
| claude_code_version | 2.1.266 |
| plugin_version | 2.0.0-beta.31 |
| marketplace_source | source npm, package @mindrian_os/cli, version 2.0.0-beta.31 |
| npm_cache_present | true |
| node_modules_present | true |
| completion_record_present | true |
| installed_package_count | 122 |
| mcp_servers | mindrian-os: entry_exists true, loads true. mindrian-brain: entry_exists true, loads true. |
| doctor_acceptance | ok false. Failed points: version-of-record-published, verify-release-clean-tree, release-dry-run-output. |
| eureka_smoke | ok true. model_installed: ok false, advisory true (the honest slim-install state). |
| longest_relative_path | length 109 |
| first_install_seconds | null |

Notes from that file:

- The run was `claude plugin update mos@mindrian-marketplace` over beta.27. It was an update, not a cold install. The orchestrator log records 24 s elapsed for the update command. That 24 s is not a `first_install_seconds` value. It is not a cold-install time.
- The collector recorded a 5 s probe timeout (ETIMEDOUT) for the mindrian-os server in the `notes` array, yet reported `loads: true`. Treat this as a known inconsistency in that envelope. It is not resolved here.
- The failed `doctor_acceptance` points are dev-repo points (clean git tree, release dry run). A plugin cache is not a repository. The earlier log calls this a finding for plans 341-09 and 341-10.

### Source 2: collector run on the dev checkout (reported by an earlier executor, not re-run in this step)

An earlier executor of plan 341-06 Task 1 ran the collector on the Linux dev box from the dev checkout. Its report says: exit 0 after 2m27s, 21 fields in the envelope, both MCP servers `loads: true`. The dev checkout has no plugin cache directory for its own version. So the install fields (`node_modules_present`, `completion_record_present`, `installed_package_count`) are false or zero. This proves the collector runs and never throws. It does not prove an install. This step did not run the collector again (no network call allowed; the collector inherits one network touch from `doctor --brain-smoke`).

## Tri-Polar posture

DEFERRED: whether Claude Desktop and Cowork resolve the plugin through the same loader pipeline as the CLI (341-RESEARCH assumption A6) was not tested, and this phase proceeds anyway under the navigator waiver. Plan 341-07 may therefore assume the CLI loader path only, and must treat Desktop and Cowork resolution of the single install location as an open risk, not a fact. The Linux dev box has no hookless host, so no Desktop or Cowork leg exists at all.

## Known gaps

- Windows on ARM: the plan and 341-RESEARCH state that no `sqlite-vec-windows-arm64` package exists upstream, so a Windows on ARM machine degrades to the pure-JS fallback of the vector store (`lib/core/semantic-index/vector-store.cjs`). The plan named `lib/core/eureka/vector-store.cjs`, which does not exist in this checkout. The upstream claim was not re-checked here (no network call allowed). Treat it as carried from 341-RESEARCH.
- Windows MAX_PATH: only the computed 180 and 188 character budget exists. Nothing was measured on Windows.
- The loader constants (60,000 ms dependency install cap, lockfile order, entry and byte ceilings) were last verified against Claude Code 2.1.266 on 2026-09-09. They were not re-verified for this waiver.
- A cold first `npm install` by the loader runs without `--ignore-scripts`. It has not been observed live by anyone on this phase.

## What this waiver does not close

- 341-RESEARCH assumption A1 (loader first-install timeout): still unknown.
- 341-RESEARCH F-5 (Windows MAX_PATH): still a computed value only.
- The 341-FINDINGS open question on whether the loader `npm ci` runs: observed once on Linux (beta.31, `completion_record_present` true). Not observed on Windows or macOS.

## If this needs re-proving

Run these on each of Windows, macOS and Linux from a cold state (remove `~/.claude/plugins/cache/mindrian-marketplace/mos` and `~/.claude/plugins/npm-cache` first):

1. `/plugin marketplace update`
2. `claude plugin update mos@mindrian-marketplace` (record the wall-clock seconds)
3. Start a fresh session, run `/mos:doctor`.
4. From the plugin root: `node scripts/collect-cold-install-evidence.cjs --json`

A platform passes only if its envelope shows: `marketplace_source.source` is `npm` with the exact version and no `ref` or `url` key; `node_modules_present` and `completion_record_present` both true; `installed_package_count` at least 100; both `mcp_servers` entries with `entry_exists` and `loads` true; `doctor_acceptance.ok` true or only named network-tier failures; `eureka_smoke.ok` true; on Windows `longest_relative_path` under 260. When real envelopes exist, replace this waiver record with them and tighten `tests/test-341-cold-install-evidence.cjs` back to the three-envelope gate that plan 341-06 Task 3 describes.
