---
id: SEED-145
title: "Theo store-identity floor (27,000) vs live node_count (22,436): stale floor or thinner graph?"
status: dormant
priority: medium
planted: 2026-11-08
planted_during: "beta.81 install self-test, quick 261108-status-active-room"
origin: "node scripts/doctor.cjs --brain-smoke on the installed 2.0.0-beta.81, 2026-11-08"
trigger_when: "the next Theo release sync, the next brain-smoke L6 FAIL, or any change to the store-identity floor in the brain-smoke runner"
scope: small
surfaces: [MindrianOS-Plugin, Theo]
related: []
promotes_to: "a quick that resolves the floor against Theo's own count, in whichever direction the evidence points"
---

# SEED-145: Theo store-identity floor vs live node count

## Evidence (measured, 2026-11-08, installed 2.0.0-beta.81)

`node scripts/doctor.cjs --brain-smoke`:

| Layer | Result |
|-------|--------|
| L0 origin and shadow connector | PASS, origin theo-mcp.onrender.com, theo_health mode=ok, sha eaaa6dd0 |
| L1 to L5 | PASS (plugin root, origin configured, HTTPS schema, MCP stdio handshake as mindrian-brain v2.0.0-beta.81, e2e brain_schema) |
| L6 store identity | FAIL: node_count=22436 below floor=27000; GraphRagMeta refreshed_at=2026-10-16T09:07:21Z |

## Why This Matters

L6 is the stale-replica detector. A FAIL means one of two very different things: Theo is serving a graph about 4,500 nodes thinner than when the floor was set (a real regression on the teaching backend), or the floor is a stale literal and the check cries wolf on every install. The two need opposite fixes. Lowering the floor to make the probe pass would hide the first case, so this seed records the question instead of guessing.

## When to Surface

**Trigger:** the next Theo release sync (release.sh Step 0.55), the next brain-smoke L6 FAIL, or any edit to the store-identity floor.

## Scope Estimate

**Small.** Find where the floor literal lives, find how Theo reports its own node count (theo_health or the release bridge), compare, and either re-stamp the floor from Theo's reported count at release time or open a Theo-side issue for the drop.

## Breadcrumbs

- Floor literal candidates: lib/core/doctor/class-m-brain-smoke.test.cjs lib/core/doctor/class-m-brain-smoke.cjs 
- Probe: `scripts/doctor.cjs --brain-smoke` (class M, 7-layer)
- Theo health: `theo_health mode=ok sha=eaaa6dd05f2ec94a3dba2e62482b1359c124c8c1`

## Notes

Planted from a navigator-run install test of beta.81; the other findings of that test (status ignores the active room, dogfood and acceptance tiers FAIL instead of self-skipping from an install) are fixed in quick 261108-status-active-room, not seeded.
