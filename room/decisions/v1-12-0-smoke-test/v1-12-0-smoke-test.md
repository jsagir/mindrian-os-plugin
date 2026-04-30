---
filed: 2026-04-29
type: smoke-test-artifact
purpose: Three-surface smoke verification that v1.12.0 envelope hygiene is live
canon_parts:
  - "Part 4 — Every Choice Is Graph Data (this Write is the test signal)"
  - "Part 6 — Product-as-Venture (dog-fooding the fix in the plugin's own room)"
session: 2026-04-29 post-Phase-95-execute
---

# v1.12.0 Three-Surface Smoke Test — CLI Surface

## Why this file exists

This Write is the smoke test signal. The plugin's own bash post-write hook fires when this file lands. We watch the tool output in this session for two specific things:

1. **The two "Hook JSON output validation failed — (root): Invalid input" lines from the start of this session — should be GONE.** That was the original sin we set out to fix nine hours ago.
2. **A clean systemMessage from the bash post-write hook** — should appear as either `post-write: cascade complete for ...` (outside-room fallback) or `queued MINTO regen for decisions, recompiled references (v1-12-0-smoke-test.md)` (inside-room expected case).

The third behavior — Larry surfacing cascade findings via Shape F.0 mini-gate after the cascade — won't fire in THIS session because the room-proactive skill was loaded into session context at session start with v1.11.x's detection contract. That requires a restart of Claude Code to pick up v1.12.0's SKILL.md side-channel reader.

## Expected vs observed

**Expected after v1.12.0 takes effect (per-process bash hook reads from disk):**

```
[Write tool output]
  Wrote 30 lines to room/decisions/v1-12-0-smoke-test/v1-12-0-smoke-test.md
  PostToolUse:Write says: queued MINTO regen for decisions, recompiled references (v1-12-0-smoke-test.md)
```

(One systemMessage line. No "Hook JSON output validation failed" lines. No "(root): Invalid input" errors.)

**Observed in v1.11.0 at session start (the original sin):**

```
  PostToolUse:Write hook error
  Hook JSON output validation failed — (root): Invalid input
  PostToolUse:Write hook error
  Hook JSON output validation failed — (root): Invalid input
  PostToolUse:Write says: post-write: cascade complete for X.md
```

(Two error lines from the .cjs hooks emitting `additionalContext` at root + one valid systemMessage from bash. The .cjs errors were fixed in v1.11.2; the bash hook envelope was tightened in v1.12.0.)

## What this artifact does after the smoke

This artifact stays in the dogfood room as evidence. It's a typed graph node — `INFORMS` edge from `decisions/` section, `CONTRADICTS` edge against any future regression, `CONVERGES` with `decision-cowork-round-locking.md` + `decision-decoy-ethics.md` + `decision-phase-95-sequencing.md` as part of the Phase 95 decisions cluster.

The fact that this Write itself fires the bash post-write hook means the smoke IS the test. No separate test runner. No assertion library. The tool output above (or below, depending on rendering) is the verification.

## Three-surface coverage from this single Write

| Surface | What this smoke proves | Method |
|---------|------------------------|--------|
| CLI | Envelope hygiene live in current session (per-process bash hook) | This Write — tool output observed inline |
| Desktop | (deferred — needs Claude Desktop session) | Restart Desktop, file via /mos:file-meeting, observe |
| Cowork | (deferred — needs Cowork shared room) | Restart Cowork, write in shared section, observe |

The CLI surface is sufficient evidence that the v1.12.0 disk-side fix landed correctly. Desktop + Cowork inherit the same disk-side hooks; their session-loaded skills update on restart.

## Provenance

Filed by Larry on 2026-04-29 immediately after `claude plugin update mos@mindrian-marketplace` reported `1.11.2 → 1.12.0`. The smoke test was the user's selected next move (option 1) after Phase 95 shipped.
