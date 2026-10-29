---
created: 2026-10-28T19:26:21.000Z
title: Run the Phase 341 cold-install proof on Windows, macOS and Linux
area: tooling
files:
  - scripts/collect-cold-install-evidence.cjs
  - .planning/phases/341-install-and-update-overhaul-npm-source-plugin-artifact-heavy/341-06-PLAN.md
  - .planning/phases/341-install-and-update-overhaul-npm-source-plugin-artifact-heavy/341-06-LINUX-EVIDENCE.md
---

## Problem

Phase 341 is at 5 of 10 plans. Plan 341-06 Task 2 is a blocking human checkpoint (D-13 step 2): a cold install of the npm-source artifact must be proven on Windows, macOS and Linux before plans 341-07 to 341-10 may start. The collector (scripts/collect-cold-install-evidence.cjs, commit 960a7a2ec) is built and runs on Linux. The only Linux evidence in the repo is old (beta.31, arm64). No Windows or macOS box exists in the dev environment. Plans 07-10 retire install.sh, collapse /mos:update and remove two doctor classes, so they must not run on a guess.

## Solution

0. Check the pinned release: cat ~/mindrian-marketplace/.claude-plugin/marketplace.json (plugins[0].source must be npm, @mindrian_os/cli, exact version, no ref or url). If the pin lacks the 341-01 to 341-05 work, cut a release with scripts/release.sh, never by hand.
1. On each OS make it cold: delete ~/.claude/plugins/cache/mindrian-marketplace/mos and ~/.claude/plugins/npm-cache (PowerShell: Remove-Item -Recurse -Force under $env:USERPROFILE).
2. Time /plugin marketplace update, then claude plugin update mos@mindrian-marketplace.
3. New session, run /mos:doctor, confirm no MODULE_NOT_FOUND on either MCP server.
4. From the installed plugin folder run node scripts/collect-cold-install-evidence.cjs --json (about 2.5 min). Keep the whole JSON line.
5. On ONE OS only run /mos:eureka enable (380 MB) then /mos:doctor --eureka-smoke.
Pass per OS: marketplace_source is npm with exact version; node_modules_present and completion_record_present both true; installed_package_count at least 100; both mcp_servers entries loads:true; doctor_acceptance.ok true or only named full-tier network failures; win32 longest_relative_path under 260. Answer the Desktop and Cowork question (A6) with PROVEN or DEFERRED. When all three pass, run 341-06 Task 3 (test-341-cold-install-evidence.cjs and docs/install/COLD-INSTALL-PROOF-341.md; decide how to record the human first_install_seconds, since the collector has no flag for it), then 341-07 to 341-10.
