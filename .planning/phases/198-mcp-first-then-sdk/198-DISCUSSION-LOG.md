# Phase 198: MCP-First Invocation Substrate then SDK - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 198-mcp-first-then-sdk
**Areas discussed:** Server topology + lifecycle, Room binding UX, Hook migration order + card noise, Flag granularity + cutover

---

## Server topology + lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Durable daemon + stdio shim | One long-lived localhost server (opencode pattern: HTTP + SSE); stdio clients via thin proxy; sessions survive restarts; multi-client | ✓ |
| Per-session stdio spawn | Each session its own server; simplest isolation; cross-session reconcile impossible; Cowork breaks | |
| Stdio v1, daemon later | Ship per-session first; SEED-039 designed twice | |

**User's choice:** Durable daemon + stdio shim (recommended)
**Notes:** SEED-039 binding designed once against the daemon topology; the future terminal reconnects to the same brain.

---

## Room binding UX

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit bind, cwd default, card only on ambiguity | room_bind wins; in-room launch auto-binds silently; F.7 card once, only when ambiguous | ✓ |
| Always card at session start | F.8 multi-select card every session - the ceremony users bounce off | |
| Pure cwd inference | No card ever; multi-room and Desktop unanswered | |

**User's choice:** Explicit bind, cwd default, card only on ambiguity (recommended)
**Notes:** Retires the per-turn binding-card noise from the navigator's regression watch by design; legacy global `active` field gets a compat shim (reads fall back, writes deprecated + logged).

---

## Hook migration order + card noise

| Option | Description | Selected |
|--------|-------------|----------|
| Statusline + SessionStart first, Stop-gate LAST | Lowest-risk first; Stop-gate moves only after server-side gate dedup + relevance machinery exists | ✓ |
| Stop-gate first | Kills the noisiest hook now but moves enforcement before the dedup machinery exists | |
| All ten event types at once | One big cutover; hardest to bisect | |

**User's choice:** Statusline + SessionStart first, Stop-gate LAST (recommended)
**Notes:** The card-misfire regression class must be fixed by the move, never re-created by it. "Adapter-only" is a measured budget (import audit + line-count) in CI.

---

## Flag granularity + cutover

| Option | Description | Selected |
|--------|-------------|----------|
| Per-surface values | MINDRIAN_MCP_FIRST=cli then cli,desktop then all; each surface earns cutover via its own parity gate + smoke | ✓ |
| Single global flag | One switch; first cutover bets all three surfaces at once | |

**User's choice:** Per-surface values (recommended)
**Notes:** CLI dogfoods first on the navigator's own install; unset/empty = byte-identical legacy everywhere. Matches the reversibility contract.

## Claude's Discretion

Internal server module layout, transport wiring, zod schema organization, SSE event vocabulary, test harness structure - within the locked stack and the one-chokepoint rule.

## Deferred Ideas

- Warp-as-channel (Mindrian as agent inside Warp) - parked with fork F8 triggers
- MCP experimental tasks API for long-run resume - revisit at API stability
- Sprint motion / GTM - parallel track, never blocks this phase
