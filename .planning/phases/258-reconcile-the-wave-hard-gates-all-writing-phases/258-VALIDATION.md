---
phase: 258
slug: reconcile-the-wave-hard-gates-all-writing-phases
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-20
---

# Phase 258 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Brain repo)** | Node built-in `node:test` (no external test dep) |
| **Framework (Plugin repo)** | Bash suites (`tests/run-all-<phase>.sh`) + CJS scripts; floor gate has a pure `evaluateFloor` for fixture injection |
| **Config file** | none -- Brain repo `package.json` `"test": "node --test tests/*.test.mjs"` |
| **Quick run command (Brain repo)** | `cd /home/jsagi/dev/ProblemsWorthSolving-Brain && node --test tests/schema-contract.test.mjs` |
| **Quick run command (Plugin repo)** | `node scripts/check-flagship-floor.cjs` (network) / `node tests/test-249-floor-gate.cjs` (fixtures, zero network) |
| **Full suite command (Brain repo)** | `cd /home/jsagi/dev/ProblemsWorthSolving-Brain && npm test` |
| **Estimated runtime** | ~30s quick / ~2min full suite (Brain repo, 50+ .test.mjs files) |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/schema-contract.test.mjs` (Brain repo edits, sub-second, zero network)
- **After every plan wave:** Run `npm test` in the Brain repo; `node tests/test-249-floor-gate.cjs` in the plugin
- **Before `/gsd-verify-work`:** Full Brain suite green + a fresh census with zero new `UNKNOWN` verdicts + `91-verify.cypher` assertions green
- **Max feedback latency:** ~120 seconds (full Brain suite)

---

## Per-Task Verification Map

| Task ID | Requirement | Secure Behavior / Expected Result | Test Type | Automated Command | File Exists | Status |
|---------|-------------|-----------------------------------|-----------|--------------------|-------------|--------|
| 258-01-xx | RECON-01 | A fresh census runs clean and writes `docs/census-<date>.md` | integration (network, read-only) | `node scripts/run-schema-census.mjs` | Yes | ⬜ pending |
| 258-01-xx | RECON-01 | Attribution probes (Code Examples A-E in RESEARCH.md) return non-empty, named results | integration (network, read-only) | new `scripts/probe-wave-attribution.mjs` or inline probes | No — Wave 0 | ⬜ pending |
| 258-01-xx | RECON-01 | GRAPH-WRITE-LOG file exists, append-only shaped, newest row's `commit_sha` resolves | unit (fs + git, no network) | `node --test tests/graph-write-log-shape.test.mjs` | No — Wave 0 | ⬜ pending |
| 258-02-xx | RECON-02 | Both collision nodes (24219 + Generate Innovation Opportunities) have exactly 1 Framework parent | integration (network, read-only) | `91-verify.cypher` via `brain_query`, assertion `count(DISTINCT parent Framework) = 1` | No — Wave 0 (payload dir) | ⬜ pending |
| 258-02-xx | RECON-02 | `probe-framework-evals` stays green after surgery | integration (network) | `node scripts/probe-framework-evals.mjs` | Yes | ⬜ pending |
| 258-02-xx | RECON-02 | Undo file fully reverts by `batch_id` | integration (network, admin, executed only on failure) | `99-undo.cypher` — authored and reviewed | No — Wave 0 | ⬜ pending |
| 258-03-xx | D-03 (RECON-01) | `GraphWriteEvent` is in `TIER3_LABELS` and NOT in `ALL_DECLARED_LABELS` methodology sets | unit, zero network | `node --test tests/schema-contract.test.mjs` (extended) | Yes (extend) | ⬜ pending |
| 258-03-xx | D-03 (RECON-01) | A post-phase census judges `GraphWriteEvent` as `ok`, never `UNKNOWN` | integration (network, read-only) | `node scripts/run-schema-census.mjs` then grep for absence of `UNKNOWN(GraphWriteEvent)` | Yes | ⬜ pending |
| 258-04-xx | RECON-04 | Floor gate produces an honest number with a recorded probe-failure count | integration (network) | `node scripts/check-flagship-floor.cjs` | Yes (honesty depends on Phase 259 TRUST-02, so run after RECON-03 per D-05) | ⬜ pending |
| 258-05-xx | RECON-03 | Operator checklist items (F-7's 7-item table) each carry an explicit verified/open state | manual-only | — (D-07: navigator + Claude together, resumed conversation) | n/a — justified | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `payloads/order-collision-dishare-2026-08-2X/` (Brain repo) — manifest.json, README.md, 90-dry-run.cypher, 01-dishare-24219.cypher, 02-dishare-gen-innov-opp.cypher, 03-graphwriteevent.cypher, 04-graphragmeta-stamp.cypher, 91-verify.cypher, 99-undo.cypher — covers RECON-02, D-08..D-11
- [ ] A read-tier attribution probe script or documented probe set (Brain repo, e.g. `scripts/probe-wave-attribution.mjs`) — covers RECON-01
- [ ] `docs/GRAPH-WRITE-LOG.md` (Brain repo) — covers RECON-01's convention leg, D-01/D-02
- [ ] `tests/graph-write-log-shape.test.mjs` (Brain repo) — guards the convention against drift
- [ ] Extension of `tests/schema-contract.test.mjs` (Brain repo) asserting `GraphWriteEvent` tier placement — covers D-03
- [ ] Framework install: none needed (`node:test` is built in; Brain repo `node_modules/` already vendored)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Second-machine untracked payload recovery (`C:/Users/PC/mindrian-brain-ingestion`) + admin-key hygiene (7-item checklist in RESEARCH.md F-7) | RECON-03 | No code path can verify a Supabase `brain_api_keys` row was revoked or that a file on a Windows machine was deleted; second machine unreachable from this filesystem | Per D-04/D-07: navigator completes on their own timing, resumes this conversation, Claude verifies what to check and confirms the admin-key rotation (`gen_random_uuid()` inside the DB, revoke `9e3da1a7...`, revoke `1148f416...`, delete `.tmp-admin-key`, verify Gemini key killed) was done correctly |
| Admin-window open/close ceremony itself (RECON-02's mini-ceremony) | RECON-02, D-11 | Requires a human operator to flip `BRAIN_HTTP_ADMIN=allow`/`deny` in the Render dashboard; no code path can do this | Operator opens window, runs Session 0 no-op write, approves each dry-run card, commits, closes window as LAST scripted write item, per Pattern 2 in RESEARCH.md |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
