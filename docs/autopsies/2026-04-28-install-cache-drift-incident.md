---
date: 2026-04-28
severity: high
status: resolved
detected_by: Jonathan Sagir (dog-fooding during 16-tester onboarding prep)
resolved_by: /mos:doctor command + Phase 93 hotfix v1.11.1
related_incidents:
  - 2026-04-13-wrong-workspace-incident.md
incidents:
  - install_cache_drift
  - brain_telemetry_column_mismatch
diagnostic_anti_patterns:
  - git_log_inherited_from_parent
---

# Incident Autopsy: Install-Cache Drift (#2) + Brain Telemetry Silent Failure

## Summary

Two production-impacting bugs surfaced during dog-fooding on the morning of 2026-04-28, both caught by tester onboarding prep work. Neither would have been visible without an admin actually trying to monitor MindrianOS adoption.

**Incident A — Install-cache drift (Incident #2 of the 2026-04-13 pattern):** The live install at `~/.claude/plugins/mindrian-os/` was running v1.10.10 while the marketplace cache at `~/.claude/plugins/cache/mindrian-marketplace/mos/` had v1.10.12, v1.10.17, AND v1.11.0 already downloaded. The Claude Code plugin manager reportedly returned "already at latest" while `plugin.json` said 1.10.10 — four versions behind. Affects ALL users silently: any user whose plugin manager hits this path runs a stale plugin without knowing.

**Incident B — Brain telemetry column-name mismatch:** `mcp-server-brain/brain-admin.cjs` (the admin CLI for `/mos:admin`) read columns `request_count` and `last_used_at` from `brain_api_keys`. `mcp-server-brain/lib/auth.cjs` (the hot path on every authenticated Brain request) writes to `total_requests` and `last_request_at`. Result: the admin CLI displayed 0 requests for every key for every user, while the actual table had 452 cumulative requests across 10 active users. Separately, `auth.cjs:logUsage()` inserted into `brain_usage_log` with column `key_id`, but the actual column is `api_key`. Supabase rejected every insert with `PGRST204`, the error was swallowed by an upstream fire-and-forget `.catch()`, and `brain_usage_log` received zero rows after all 452 requests. No tool-level granularity was ever captured.

Combined effect: from the admin's perspective, MindrianOS adoption looked dead — 17 issued keys, zero traffic. The actual state was the opposite: real adoption with one power user (Jonathan, 378 requests), two heavy users (Leah 37, Lawrence 26), three moderates, four light samplers, and seven dark keys never touched. Without dog-fooding for the tester rollout, this would have stayed invisible until quarterly review.

## Root Causes

### A. Install-cache drift

**The plugin manager does not enforce cache freshness invariants.** Claude Code v2.1.121 has a `claude plugin update` command that, in this case, returned "already at latest" while a literal version-comparison would have shown drift (`1.10.10 < 1.11.0`). The exact failure mode in the manager is unknown without Anthropic-side logs. From outside, the symptom is a manager that lies about state. See `docs/upstream-reports/2026-04-28-claude-plugin-update-misreports-state.md` for the upstream report draft.

**The marketplace cache is correct.** `~/.claude/plugins/cache/mindrian-marketplace/mos/1.11.0/` contained the full 5,617-file v1.11.0 plugin tree. The cache directory accumulates downloaded versions correctly. The bug is exclusively in the cache → live-install transition.

**No Mindrian-side guard caught this.** v1.10.x had no `/mos:doctor`, no session-start drift detector, no version comparison. v1.11.0 shipped Phase 91 (Navigation Engine) which added drift handling at the plugin file level but not at the install-cache level.

### B. Brain telemetry column-name mismatch

**Schema evolution without coordinated read-path migration.** The `brain_api_keys` table has both `total_requests`/`last_request_at` (the active columns auth.cjs increments) AND `request_count`/`last_used_at` (legacy columns from an earlier schema, frozen at zero). Both column pairs exist in the same row. brain-admin.cjs was written or last-touched against the legacy schema and never updated when auth.cjs migrated to the new column names.

**`brain_usage_log` schema mismatch.** The table column for the FK to `brain_api_keys` is `api_key` (matching the foreign key naming convention used elsewhere). The auth.cjs code passed `key_id` — a name that exists nowhere in the schema. PostgREST rejected every INSERT with `PGRST204: Could not find the 'key_id' column of 'brain_usage_log' in the schema cache`. The fire-and-forget `Promise.all([...]).catch()` upstream collapsed the error to a single `console.error('[brain-auth] Usage tracking error:', err.message)` line — a line that was never visible to any human because nothing tails the Brain server logs.

**No integration test exercises the read path with real data.** A `brain-admin list` smoke test against a populated database would have shown zero where the schema clearly had nonzero. No such test existed.

## How It Was Detected

A user requested an admin overview via `/mos:admin`. The output listed 17 active keys with `0 requests this month` for every single key. That number was suspicious — Lawrence and Jonathan both have admin keys and use Brain regularly. A quick query against `brain_api_keys` directly:

```bash
curl -s "${SUPABASE_URL}/rest/v1/brain_api_keys?select=email,total_requests,request_count&order=total_requests.desc&limit=5"
```

returned rows showing `total_requests: 378` for Jonathan's Desktop key while `request_count: 0` for the same row. Two columns on the same row, two different values — the schema explanation crystallized in seconds.

In the same diagnostic pass, an attempt to manually `INSERT` a probe row into `brain_usage_log` returned the `PGRST204` error, exposing the second bug.

The install-cache drift was detected separately during the same session. The user asked about MindrianOS adoption metrics, the assistant pulled `~/.claude/plugins/mindrian-os/.claude-plugin/plugin.json`, and the version field said `1.10.10` — visibly stale relative to the marketplace cache containing `1.11.0`. No prior diagnostic had compared these two paths.

## Diagnostic Anti-Patterns Observed (and the lessons they teach)

### Anti-pattern: trusting `git log` when cwd may inherit a parent `.git`

During the recoverability check before Phase 93 patches, an early diagnostic ran `git log --oneline -3` from `/home/jsagi` (the user's home) and incorrectly attributed those commits to the install cache. The home directory contains a separate git repository for an unrelated project (`mindrian-agno-backend`). Because `git log` walks upward looking for `.git`, a `cd ~/` followed by `git log` produced output that looked like it described the install cache. It did not.

The correct diagnostic is:

```bash
# Always anchor the path explicitly.
test -d "${PATH_TO_CHECK}/.git" && \
  git -C "${PATH_TO_CHECK}" log --oneline -3
```

This pattern was added to the v1.11.1 release notes as a permanent rule. It belongs in any diagnostic playbook that involves comparing multiple repositories on the same machine.

### Anti-pattern: silent error swallowing on telemetry

`logUsage` was wrapped in a fire-and-forget Promise chain with `.catch((err) => { console.error('[brain-auth] Usage tracking error:', err.message); })`. The intent was correct (telemetry failures must never block the user request) but the implementation buried 452 silent failures in stderr that no one was reading. Telemetry errors should be:

1. Counted (e.g., a `usage_log_insert_failures` counter)
2. Sampled (log first N failures with full context, then sample the rest)
3. Surfaced through the same admin diagnostic surface as the rest (a row that says "logUsage failed: 452 failures over the last 30 days" beats silent zero)

The v1.11.1 fix corrects the column name. The error-handling discipline upgrade is a v1.12 candidate.

## Recovery Procedure (cp -aT with backup variant)

For Incident A, the user-facing manual recovery is now codified in `/mos:doctor --fix`. The shell sequence is:

```bash
TS=$(date +%Y%m%d-%H%M%S)
mv ~/.claude/plugins/mindrian-os \
   ~/.claude/plugins/mindrian-os.stale-${OLD_VERSION}-${TS}
cp -aT ~/.claude/plugins/cache/mindrian-marketplace/mos/${LATEST_VERSION} \
       ~/.claude/plugins/mindrian-os
jq -r .version ~/.claude/plugins/mindrian-os/.claude-plugin/plugin.json
# expect: ${LATEST_VERSION}
```

The backup is preserved indefinitely. After 24 hours of normal use, the user can delete it (`rm -rf ~/.claude/plugins/mindrian-os.stale-*`).

For Incident B, the recovery is the v1.11.1 deploy itself (Phase 93 D1: 6 lines across two files). Backfilling lost telemetry is not possible — the per-request tool-name detail for those 452 calls is gone. Aggregate counts (`total_requests`) are intact because that path was always working.

## Prevention Measures Shipped in v1.11.1

| # | Measure | Phase 93 Deliverable |
|---|---------|----------------------|
| 1 | `/mos:doctor` command for read-only drift diagnosis | D2 |
| 2 | `/mos:doctor --fix` for one-shot backup-then-replace recovery | D2 |
| 3 | Regression test that builds a deliberately-broken cache and verifies recovery | D4 |
| 4 | brain-admin.cjs reads correct columns (`total_requests` / `last_request_at`) | D1 |
| 5 | auth.cjs writes to correct column (`api_key`) for `brain_usage_log` | D1 |
| 6 | Anthropic upstream bug report drafted (held until /mos:doctor exists) | D5 |

## Prevention Measures Deferred to v1.12 (P1 candidates)

- Session-start drift detector that runs `/mos:doctor` automatically on first-of-day session-start, refusing to start if drift is detected with a one-key recovery prompt
- Workspace guard extended to detect cache-on-wrong-commit at session-start (the existing guard fires only at commit-time)
- Telemetry error counter + admin diagnostic surface (replaces silent `console.error`)
- Schema-drift CI check that runs `brain-admin list` against a fixture database with nonzero usage and asserts the displayed numbers match expected

## What This Incident Tells Us

Incident #2 of the same pattern arrived 15 days after Incident #1 was resolved. The 2026-04-13 fix added a workspace guard to `scripts/session-start` that refuses to commit from the cache. That guard fires when the user TRIES TO COMMIT FROM THE CACHE. It does NOT fire when the cache silently DRIFTS AWAY FROM THE MARKETPLACE TAG. Two different failure modes. Same surface. Different cause.

The lesson: **a single guard does not generalize across failure modes that share a surface.** Each new failure mode on the cache directory needs its own guard. The cache surface is now defended by two guards (commit-time + drift-time at session-start, the latter shipping in v1.12). It will likely need a third before this surface is fully sealed.

The dog-fooding mandate (Canon Part 6) paid for itself this morning. The 16-tester onboarding cohort has not yet started — it spun up enough activity to surface both bugs before any external user encountered them. That alone justifies the 3-hour hotfix scope.

## Provenance

- Detected: 2026-04-28 by Jonathan Sagir during admin panel review
- Diagnosed: same session, ~30 minutes of probing across plugin install, marketplace cache, and Supabase schema
- Fixed: Phase 93 v1.11.1, same day
- Tagged: v1.11.1-beta.1 (release infrastructure beta-gating per CLAUDE.md release-process.md)
- Promoted: v1.11.1 stable after Lawrence beta validation (target: 2026-04-29)

Manual recovery applied this morning at 09:55:48Z preserves the stale install at `~/.claude/plugins/mindrian-os.stale-1.10.10-20260428-095548/` for upstream report evidence (the plugin.json that lied is in there).
