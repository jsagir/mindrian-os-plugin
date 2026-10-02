---
id: SEED-111
status: dormant
priority: LOW
planted: 2026-10-02
planted_during: Phase 267 close-out (plan 267-18)
trigger_when: the next quick pass that is allowed to touch lib/core/brain-client.cjs, or any cleanup of dead services
scope: small (one directory decision, three prose fixes)
related: docs/257-NOTE-part8-enforcement-locus-rulings.md:22, lib/core/brain-client.cjs:2358, references/security/cve-db.json, lib/core/mcp-dep-heal.cjs, tests/fixtures/363-pre-phase.json
---

# SEED-111: Decide the fate of `mcp-server-brain/` and clean the stale "via the sdk" notes

## 1. `mcp-server-brain/`

`docs/257-NOTE-part8-enforcement-locus-rulings.md:22` calls it a dead service. Phase 267 left it
untouched on purpose (out of scope, and its `node_modules` still holds the last v1 SDK copy on disk).
Decide: delete it, or archive it outside the shipped tree. Check first that nothing tracked still
reads it (the retired test-257 before-legs did, via an untracked v1 copy; that dependence was cut by
quick 261002-by3).

## 2. Stale comments and notes the migration left behind

Phase 267 was not allowed to edit these, so they are recorded here:

- `lib/core/brain-client.cjs:2358` says ajv is "transitive via @modelcontextprotocol/sdk" and must not
  be added to `package.json`. Both halves are now false: the v1 SDK is gone and ajv is a declared
  direct dependency. (The Part 8 egress-guard and brain-client edit rule means this needs its own
  owner and review.)
- `references/security/cve-db.json`: the notes for hono ("already on disk via the VETTED sdk") and ajv
  ("transitive dep of the VETTED sdk") are historical now. Keep the VETTED sdk entry itself.
- `lib/core/mcp-dep-heal.cjs`: the header and the "rejected alternative" block still name the v1
  package in prose.
- `tests/fixtures/363-pre-phase.json` (read by the run-all-363 "no new dependency" leg) lists
  `@modelcontextprotocol/sdk@^1.30.1` and `ext-apps@^1.5.0`. It was already stale before Phase 267
  finished; the leg is red until the fixture is refreshed by the Phase 363 owner.
- `data/capability-ledger.json` evidence strings cite v1 dist paths (prose only).

## 3. One real, tiny defect found while smoke-testing

At shutdown with no room bound the server logs `[session-catchup] Failed to save on shutdown: The
"path" argument must be of type string. Received null`. Harmless in the observed run, but it means
the shutdown save assumes a room. Give it a null guard, or skip the save when no room is bound.
