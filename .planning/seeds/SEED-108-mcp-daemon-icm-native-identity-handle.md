---
id: SEED-108
status: dormant
priority: HIGH
planted: 2026-10-02
planted_during: Phase 267 close-out (plan 267-18)
trigger_when: before anyone turns MINDRIAN_MCP_FIRST on for hook-driven use, or before the daemon is asked to serve a 2026-era client that carries no transport session id
scope: small for the fast-follow (transport only); medium for the full ICM-native handle (identity model, Part 9)
related: .planning/debug/mcp-shim-preseeded-session-id-rejected.md (RCA 7), .planning/debug/desktop-session-binding-fallback.md, 267-RESEARCH.md icm-architect consult, 267-14-SUMMARY.md (T-267-32), lib/core/session-binding.cjs
---

# SEED-108: Give the MCP daemon an explicit, ICM-native identity handle (and fix RCA 7 first)

## The impact, stated plainly

With `MINDRIAN_MCP_FIRST` on (default OFF), the documented hook-driven case (a hook sets
`MINDRIAN_SESSION_ID`) is the one that is BROKEN today, not an edge case: every request gets 400 and
the shim never connects. Only the unbound case works. Anyone turning the flag on for hook use hits
this immediately. The flag is off by default, so no install is hurt today; the defect is that the
one scenario the flag exists to serve does not work.

Source: `.planning/debug/mcp-shim-preseeded-session-id-rejected.md` (RCA 7, reproduced live
2026-09-24, kept open by Phase 267 because re-architecting room identity was not that phase's work).

## Two paths, and they are separable

**Fast-follow (small, transport-only, approvable on its own): design (a) from the RCA.** The daemon
adopts a validated caller-supplied session id as the id of a NEW session. In
`bin/mindrian-mcp-server.cjs` the flag-ON `/mcp` route today rejects any `mcp-session-id` it did not
mint. Instead `sessionIdGenerator` would return the header value when it passes
`lib/core/session-binding.cjs`'s `isSafeSlug` check, and mint a fresh UUID otherwise. No new identity
model, no Canon Part 9 change (the RCA's own note says no CANON-PHASE-MAP update is needed). It fixes
the shim and hook case. It does NOT help Claude Desktop (which has no hook and no session id) and it
does not help 2026-era clients.

**Fuller redesign (medium): the ICM-native identity handle.** Identity should be an explicit
per-request handle, resolved against the session file (`$MINDRIAN_ROOMS_HOME/...`), never inferred
from transport state. Two candidate carriers: a reverse-DNS `_meta` key such as
`io.mindrian/sessionId`, or the existing explicit `room` and `sessionId` tool arguments. This is the
icm-architect consult's direction (267-RESEARCH.md). Why it matters now:
- 2026-era requests (Phase 267 made the daemon serve them) carry no transport session id, so they
  resolve room identity through the stdio fallback ladder (accepted risk T-267-32, 267-14).
- Claude Desktop on stdio has no session id either. `room_bind` answers `no_session_id`, and state
  reads fall back to the registry `active` room
  (`.planning/debug/desktop-session-binding-fallback.md`, observed again post-migration in the
  Desktop-surrogate smoke). The handle would give that defect a real fix, not a patch.
- Claude Code 2.1.287 already opens with the 2026 handshake, so this stops being hypothetical.

## First step (do this before any design work)

Verify assumption A9: custom `_meta` keys survive v2's request envelope lift (the v2 server may
rewrite or drop unknown `_meta` keys). A short wire probe against the migrated dev server, one era
each. If A9 fails, the explicit tool arguments become the only carrier and the design narrows.

## Questions for the build

- Which tools take the handle, and is it required or optional (an unbound call must still refuse a
  write rather than land in a room nobody chose)?
- Where is the handle minted for a client that has none (Desktop): `room_bind` returns it and the
  model repeats it, or the server mints one per process and ties it to the connection?
- Part 9 and the session file's role as the local state machine need a CANON-PHASE-MAP row when the
  full redesign lands (design (a) alone does not).
- Tri-Polar: CLI hooks, Desktop (no session id), Cowork (shared room state across users) each need a
  stated outcome.

## Out of scope

Anything that sends room identity to the Brain (Canon Part 8). The handle is local only.
