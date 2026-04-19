# Phase 87: Security Hardening + Cascade Refactor + Localhost Dashboard -- Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 87-CONTEXT.md -- this log preserves alternatives considered.

**Date:** 2026-04-19
**Phase:** 87-security-hardening-cascade-refactor
**Areas discussed:** R1 Phase numbering, Release split, R2 BYO chat auth, R4 async I/O pattern, R3 e2e fixture, R6 stakeholders verify, R7 pre-commit hook, R5 (tracked for Phase 88)
**Audit source:** Larry audit 2026-04-18, post-migration of ui-ux-pathways research to plugin .planning/

---

## R1 Phase 88 numbering collision

| Option | Description | Selected |
|---|---|---|
| Rename reverse-salient to Phase 89 | git mv phases/88-reverse-salient-engine to phases/89-reverse-salient-engine. Skill Offer Engine takes Phase 88 (matches handoff). 7 plan files renamed (unexecuted). | ✓ |
| Keep reverse at 88, Skill Offer becomes 89 | Less file churn. Handoff doc needs updating. | |

**User's choice:** Rename reverse-salient to Phase 89
**Notes:** Mechanical rename executed during session. `.planning/` is gitignored so plain `mv` used instead of `git mv`. All internal phase-88 references in plan files updated via sed.

---

## Release split decision

| Option | Description | Selected |
|---|---|---|
| Split into v1.10.11 + v1.10.12 | v1.10.11 = Stream A security + 87-08 dashboard. v1.10.12 = Stream B refactor + 87-09 chat. Smaller, safer, faster to investor value. | ✓ |
| Keep as one v1.10.11 (10 plans) | Single bundle. Higher risk if any plan slips. | |

**User's choice:** Split into v1.10.11 + v1.10.12
**Notes:** Rationale: bundling cascade refactor with investor-safe security fixes creates unnecessary schedule risk. v1.10.11 ships cleanly even if Stream B slips. Timeline revised: 9-12 days total (v1.10.11 = 4-5 days, v1.10.12 = 5-7 days).

---

## R2 BYO chat security approach

| Option | Description | Selected |
|---|---|---|
| Bearer token exchange | Server issues session token on first browser load. Chat calls use Bearer. Key transits once. Prevents Network-panel leak + CSRF. | ✓ |
| Origin + CORS only | Simpler. Key still appears in devtools per request. | |

**User's choice:** Bearer token exchange
**Notes:** 87-09a sub-plan added for token plumbing. Token TTL 30 min, cleared on server stop. Api_key stored server-side only, in memory, keyed by token. Browser keeps api_key in sessionStorage (tab-lifetime) not localStorage. Silent 401-retry flow handles expiry.

---

## R4 Async I/O pattern

| Option | Description | Selected |
|---|---|---|
| Two entry points (room-ops-sync.cjs + room-ops-async.cjs) | CLI imports sync, MCP imports async. Shared pure logic in room-ops-shared.cjs. No env branching. | ✓ |
| Env-guarded branch (original plan) | Minimal change. Silent failure mode if env forgotten. | |
| Promise wrapper (always async, CLI awaits) | Single path. Slight overhead on CLI hooks. | |

**User's choice:** Two entry points
**Notes:** Requires grep-audit of all callsites during 87-04 verification. CLI callsites must import room-ops-sync; MCP callsites must import room-ops-async. Mistakes caught at import time, not runtime.

---

## R3 Cascade e2e fixture (baked, not asked)

**Decision:** Write e2e integration test fixture BEFORE 87-03 cascade refactor. Non-negotiable acceptance gate.

**Implementation:** New plan 87-00 (Wave 0) creates `test/fixtures/cascade-e2e/` with seeded room, files an artifact, verifies full INFORMS/CONTRADICTS/CONVERGES/INVALIDATES edge chain in room.db. 87-03 cannot execute until 87-00 ships green.

**Rationale:** Cascade is the nervous system. Feynman-suite-only mitigation is insufficient. Integration test is the refactor's safety net.

---

## R6 Stakeholders table verification (baked, not asked)

**Decision:** Verify stakeholders table populated before shipping 87-09 chat Pattern 3. Feature-flag gracefully if empty.

**Implementation:** New micro-plan 87-09b runs `SELECT COUNT(*) FROM stakeholders` on representative rooms. If 0, Pattern 3 returns "no stakeholder data yet" instead of empty/hallucinated attribution. CHANGELOG note documents Phase 84 stakeholder extraction pipeline dependency.

**Rationale:** Avoid shipping a chat feature that hallucinates who said what because the table was reserved but never populated by cascade.

---

## R7 ROOM.md + MINTO.md pre-commit hook (baked, not asked)

**Decision:** Install tracked git pre-commit hook via scripts/setup-hooks.sh. Session-start verifies and reinstalls.

**Implementation:** New plan 87-01a (Wave 1, v1.10.11) ships scripts/setup-hooks.sh which drops a pre-commit hook into .git/hooks/pre-commit. Hook runs the find-loop check from CONTEXT.md. Session-start guard verifies hook is installed and reinstalls if absent (defeats accidental --no-verify drift on a single commit).

**Rationale:** CONTEXT.md documented the check but didn't wire it to a hook. Without wiring, the invariant is aspirational.

---

## R5 Triangulation math (tracked for Phase 88, not asked here)

**Decision:** Defer to Phase 88 (Skill Offer Engine) CONTEXT.md when that phase is discussed.

**Concern captured:** Weights 0.4/0.3/0.3 for intent/graph/MINTO are stated without derivation. No disagreement penalty when three signals conflict. Users will feel offers random.

**Expected resolution in Phase 88:** Either raise combined threshold (0.6 -> 0.75) or add explicit disagreement gate: if max(intent, graph, MINTO) - min(...) > 0.5, suppress offer.

---

## Claude's Discretion

None for this phase. Every audit concern either resolved via user pick (R1, R2, R4, split) or baked in as non-negotiable (R3, R6, R7). R5 is scoped to Phase 88.

## Deferred Ideas

- Chrome extension layer (Phase 90+)
- Operational buttons v2 (command queue) / v3 (RemoteTrigger) -- Phase 92+ once Claude Code API stabilizes
- Discord/Zulip multi-user surface -- Phase 90 candidate
- Goose extension -- Phase 91 candidate
- Quarto export format -- separate phase, deferred from alternatives analysis
- Mobile PWA
- Multi-room portfolio view for program managers
