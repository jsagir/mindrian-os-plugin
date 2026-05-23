---
kind: qa-sweep
slug: post-beta30-regression-2026-05-23
date: 2026-05-23
status: resolved
resolved: 2026-05-23
resolved_by: phase-127.2 Plan 127.2-04 (Instance #4 + #7 hotfix bundle, ships v1.13.0-beta.32)
related:
  - .planning/debug/brain-post-fix-qa.md
  - .planning/debug/resolved/windows-room-registry-path-normalization-gap.md
  - .planning/debug/resolved/mos-update-silent-activation-gap.md
---

# Post-beta.30 LIVE WIRE re-verification (session 2)

## Context

Prior session (2026-05-23, earlier) ran the 25-gate post-beta.30 regression sweep. Key finding: beta.30 LIVE was NOT actually active until `/mos:doctor --fix` ran. All Brain MCP probes hit beta.24 stdio shim (L4 brain-smoke confirmed `server=mindrian-brain v1.13.0-beta.24`). After `/mos:doctor --fix`:
- live moved 1.13.0-beta.24 → 1.13.0-beta.30
- backup at `C:\Users\PC\.claude\plugins\mindrian-os.stale-1.13.0-beta.24-2026-05-23-1833`
- exit code 2 (drift detected and recovered)
- session was cleared so MCP servers reconnect against beta.30 bytes

Maintainer changelog beta.26 disposition (from prior session research):
- NF-2026-05-23-01 (string interpolation) + curated-op-surface-missing claim = FALSE POSITIVES (stale-cache reads against beta.24 install while believing it was beta.26)
- D-09 (BRAIN_MAX_TOPK cap) = REAL fix
- Beta.30 Phase 127.2 Plan 03 ships rs-engine pre-flight (Finding F1)

This session re-runs a focused 12-gate WIRE re-verification sweep against the NOW-ACTIVE beta.30 LIVE to confirm what was true-by-refactor vs true-by-stale-cache.

## Post-activation WIRE re-verification (session 2)

### 12-gate matrix

| Gate  | Result                                                                                                                                                | Beta.30-LIVE-Status     |
|-------|-------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------|
| W1.1  | `/mos:doctor` → `install-cache ✓ healthy (1.13.0-beta.30)`; 1 healthy / 0 drift / 0 warnings                                                            | CONFIRMED-FIXED         |
| W1.2  | `/mos:doctor --brain-smoke` → **L4 MCP stdio handshake: handshake succeeded, server=mindrian-brain v1.13.0-beta.30** (251ms); L1-L5 all PASS (5709ms total) | CONFIRMED-FIXED (load-bearing) |
| W1.3  | `~/.claude/plugins/mindrian-os/package.json` → `"version": "1.13.0-beta.30"`                                                                          | CONFIRMED-FIXED         |
| W2.1  | grep `\.replace\(/\\\$keyword` in `mcp-server-brain/lib/brain-ask.cjs` → **No matches found** (beta.24 had 2 matches at lines 164-165)                | CONFIRMED-FIXED         |
| W2.2  | grep `BRAIN_MAX_TOPK` in same file → matches at lines 545 (comment), 551 (`const MAX_TOPK = parseInt(process.env.BRAIN_MAX_TOPK \|\| '100', 10)`)     | CONFIRMED-FIXED         |
| W2.3  | grep `runCuratedOp\|list_frameworks` → `runCuratedOp` at line 189; `list_frameworks` in `CURATED_OP_NAMES` (line 92), z.enum (line 510), op dispatch (line 121), tool description (line 538) | CONFIRMED-FIXED         |
| W2.4  | `brain_ask("What chains from Six Thinking Hats?")` → `directive.guided.framework = "Six Thinking Hats"`; 5 questions returned; `next_gate.options` 5 entries with confidence 0.85-0.9 | CONFIRMED-PRESERVED (NF-1 closed) |
| W2.5  | `brain_stats` → `totalRecordCount: 12401`, `dimension: 1024`, 6 namespaces (reference/tools/materials/core/graphrag/books) — matches canon Appendix D entry 13 | CONFIRMED-PRESERVED     |
| W2.6  | `brain_query("MATCH (n) RETURN count(n)")` → `"Raw Cypher query access requires admin key. Use brain_search or brain_ask for methodology lookups. Contact Jonathan for elevated access."` | CONFIRMED-PRESERVED (D-MOAT-1) |
| W3.1  | `bash scripts/room-registry list` → **`FileNotFoundError: [Errno 2] No such file or directory: '/c/Users/PC/MindrianRooms/.rooms/registry.json'`** (registry exists; POSIX path leaks into Python `open()`) | STILL-BUGGED            |
| W3.2  | `python -c "import requests"` → `ModuleNotFoundError: No module named 'requests'`. User has NOT installed deps between sessions.                       | HALF-FIXED (silent → loud) |
| W3.3  | `node scripts/doctor.cjs --check-rs-engine` → `"Engine 1 Act 1 (/mos:find-bottlenecks et al.) needs Python deps. Missing: requests. Run: pip install -r requirements-hsi.txt --user (use python -m pip if pip is not in PATH)"` — **pre-flight surface FIRES as designed** | CONFIRMED-FIXED (loud-fail surface shipped) |
| W4.1  | `~/.claude/plugins/mindrian-os.stale-1.13.0-beta.24-2026-05-23-1833/package.json` → `"version": "1.13.0-beta.24"` (backup preserved; recovery reversible) | CONFIRMED-PRESERVED     |
| W4.2  | `~/MindrianRooms/`: `mindrian-os-self/` + `nv-diamond-meg/` intact; registry shows `active: "mindrian-os-self"`; `problem-definition/silent-degradation.md`, `solution-design/d-moat-2-brain-ask-gap.md`, `team-execution/solo-builder-safety-net.md` all readable | CONFIRMED-PRESERVED     |

Note: total = 14 result rows across the 12-gate sweep (W3.1 is one gate with multiple sub-evidence; W3.2+W3.3 are paired; W4.1+W4.2 are paired).

### Verdicts

- **Activation reached the WIRE: YES.** L4 server-version probe returned `mindrian-brain v1.13.0-beta.30`. This is the load-bearing assertion — every subsequent finding's CODE-claim source-of-truth matches its WIRE-claim source-of-truth.
- **BUG-01 disposition: confirmed false-positive-by-refactor.** Live code has zero matches for the string-interpolation pattern. The prior session's NF-2026-05-23-01 was reading the beta.24 install while believing it was beta.26 — a stale-cache read.
- **BUG-01b (D-09 BRAIN_MAX_TOPK): confirmed fixed on live.** Cap is on the wire at line 551.
- **SPEC-02 (curated-op surface): confirmed shipped on live.** `runCuratedOp` + `CURATED_OP_NAMES` + z.enum tool registration all present.
- **Instance #4 (Windows path leak): still open.** `scripts/room-registry` Python heredocs embed POSIX `/c/Users/...` paths that Windows Python `open()` cannot resolve. Filed as NEW BUG → `.planning/debug/windows-room-registry-path-normalization-gap.md`.
- **Instance #5 (Python deps): half-fixed (silent → loud).** User has not yet installed `requests`. Pre-flight surface (`--check-rs-engine`) FIRES correctly with actionable fix line. Not fully closed until user runs `pip install -r requirements-hsi.txt --user`.
- **Instance #6 (active-room hook): re-confirmed not firing on in-room writes.** Inconclusive from this session (no destructive write attempted); prior session's manual repro did not surface it. Leave as inconclusive; revisit when a real false-positive is observed.
- **Instance #7 (/mos:update silent activation gap): file as bug ticket.** This is a real surface — `/mos:update` lands beta.N bytes in cache but does NOT swap active install. Every Brain MCP call succeeds against the OLD server until explicit `/mos:doctor --fix`. Filed → `.planning/debug/mos-update-silent-activation-gap.md`.
- **Dog-food room: intact.** Activation did not touch `~/MindrianRooms/`. All three seeded entries readable; registry active pointer preserved.

### One-line recommendation

**Hold beta.30 promotion until Instance #4 (Windows path normalization gap) lands.** The bug is silent for non-Windows users but breaks `/mos:rooms list` on every Windows install. Instance #7 (silent activation gap) is a P1 followup but does not block this beta — the recovery path (`/mos:doctor --fix`) works.

### Source-of-truth preamble (per D-10 shipped beta.26)

For every finding above:
- **CODE-claim source-of-truth:** `C:\Users\PC\.claude\plugins\mindrian-os\` (live install at beta.30)
- **WIRE-claim source-of-truth:** `mindrian-brain v1.13.0-beta.30` per L4 MCP stdio handshake probe (W1.2)

Both source-of-truth handles match the version-of-record (`1.13.0-beta.30`). The prior session's stale-cache delta is closed.

---

## Resolution (2026-05-23, v1.13.0-beta.32)

Closed by phase-127.2 Plan 127.2-04 (Windows tester regression bundle).

The 12-gate sweep produced two NEW BUG tickets: Instance #4 (Windows POSIX path leak in `scripts/room-registry`, P2) and Instance #7 (`/mos:update` silent activation gap, P1). Both ship in v1.13.0-beta.32 together as a coherent "Windows tester regression bundle" beta.

Other gate dispositions:
- **BUG-01 / NF-2026-05-23-01 (string interpolation):** false-positive-by-refactor. The prior session's CODE-claim was a stale-cache read against beta.24 while the user believed they were on beta.26. The live code (beta.30 WIRE-confirmed) has zero matches. No fix required.
- **BUG-01b (D-09 BRAIN_MAX_TOPK cap):** real, shipped beta.24+, WIRE-confirmed on beta.30. No further action.
- **SPEC-02 (curated-op surface):** WIRE-confirmed shipped. No further action.
- **Instance #5 (Python deps):** half-fixed by Phase 127.2 Plan 03 pre-flight surface. User-side install of `requests` is the remaining step; Plan 03 surfaces the fix line via `/mos:doctor --check-rs-engine`. No further code change required.
- **Instance #6 (active-room hook):** inconclusive both sessions; revisit when a real false-positive is observed.

The new Class N acceptance gate `activation-reached-the-wire` (added in Plan 127.2-04 to `scripts/doctor.cjs`) closes the structural reason every prior beta this session may have been unverified on tester wires. Every beta after v1.13.0-beta.32 ships with the activation gate active. If the published bytes do not actually activate on testers' machines, the gate fails the acceptance roster and prevents the next release from shipping a phantom version.

See:
- `.planning/debug/resolved/windows-room-registry-path-normalization-gap.md` (Instance #4 RCA + Resolution)
- `.planning/debug/resolved/mos-update-silent-activation-gap.md` (Instance #7 RCA + Resolution)
- `.planning/phases/127.2-brain-warmup-ping-hide-mcp-cold-start-latency-inside-larry-s/127.2-04-PLAN.md`
- CHANGELOG.md entry for v1.13.0-beta.32
