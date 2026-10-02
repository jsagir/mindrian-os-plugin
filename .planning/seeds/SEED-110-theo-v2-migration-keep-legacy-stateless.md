---
id: SEED-110
status: dormant
priority: MEDIUM
planted: 2026-10-02
planted_during: Phase 267 close-out (plan 267-18)
trigger_when: Theo (the repo at /home/jsagi/Theo) ever plans a move to the v2 MCP SDK or to createMcpHandler
scope: none in this repo (a cross-repo note; the action belongs to Theo)
related: 267-CONTEXT.md (Cross-repo boundaries), 267-RESEARCH.md (OQ4, A4), lib/core/brain-client.cjs, Theo's own D-04 in its 08.4-CONTEXT.md, Theo HOST-01
---

# SEED-110: If Theo moves to SDK v2, it must keep `legacy: 'stateless'`, never `'reject'`

## No action in this repo

Phase 267 migrated only the local servers. Theo is a separate repo that made its own deliberate
decision to stay on the v1 SDK (its D-04, dependency minimalism). This seed exists only so the
constraint is written down where a future session will find it.

## The constraint

Every installed plugin carries `lib/core/brain-client.cjs`, a hand-rolled 2025-era JSON-RPC client:
it sends `initialize` at protocol `2024-11-05`, then bare `tools/call` with a fixed id, and no
`MCP-Protocol-Version` header or session id on the follow-up. Theo's own HOST-01 requirement exists
because of exactly this (it must accept a bare `tools/call` with no prior `initialize`).

If Theo adopts the v2 `createMcpHandler`, it must pass `legacy: 'stateless'`. With `legacy: 'reject'`
every installed plugin's Brain access goes dark at once, with no client-side fix possible until users
update. Precedent that `'stateless'` works: the retired PWS Brain served this plugin's released
`brain-client.cjs` through v2 `createMcpHandler({ legacy: 'stateless' })` in production
(`267-RESEARCH.md`, A4).

## Where to hand it over

When Theo plans the move, mention this in the release-cut listener's Theo note or in Theo's own phase
context. Do not edit Theo from this repo. Any Brain-adjacent question that carries room content goes
through the guarded `mindrian-brain` shim, never the raw `theo` server (CLAUDE.md, THEO-04).
