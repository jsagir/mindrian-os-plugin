# LOOP-01 live verification result - 2026-08-10 (executed headless, fresh sessions)

**Verdict: FAIL - and the checkpoint caught a real, previously unknown defect.**

## Method

Fresh `claude -p` sessions (new process, installed beta.13 cache, fresh MCP servers) ran the
three-call test; then the beta.13 cache shim was driven directly over stdio; then the cache
brain-client and the dev brain-client were called side by side with the same key.

## Results

| Leg | Result |
|---|---|
| Fresh session, plugin-scope brain_stats/search/ask | 0/3 - DIRECTOR_NOT_AVAILABLE "MINDRIAN_BRAIN_KEY not set" (twice: with and without env threading) |
| beta.13 cache resolve-brain-key.cjs standalone | WORKS - both env and mindrian-env-file legs resolve |
| beta.13 cache brain-client isAvailable() | true (key gate passes) |
| beta.13 cache brain-client stats() | **null** (transport-failure contract) |
| Render /health | {"status":"ok","graph":true} |
| **DEV repo brain-client stats(), same key** | **WORKS: backend memgraph, 28,325 nodes, 23,014 rels, full vectorIndexes** |

## Root cause chain

1. The pws-brain-mcp server was redeployed on commit 0e79704 at 2026-08-09 09:32 UTC.
2. v1.16.0-beta.13 was cut 2026-08-10 from a client that predates compatibility with that
   deploy. Its brain-client call path returns null against the live server. **beta.13's
   plugin Brain path never worked in production.**
3. beta.13's shim then maps transport-null to the no-key sentinel - the conflation defect
   250-RESEARCH named and 250-01 fixed in dev - so the failure masquerades as a key problem.
4. The dev-repo client (247-02 wrappers + error semantics, 250-01 shim honesty, 250-04
   registration leg) works against the live server today. **The fix is already built; it
   ships in v2.0.0-beta.1.**

## What the morning verification missed (process lesson)

The beta.13 release verification proved npm/tag/marketplace pointers and fed the sanitize
hook synthetic payloads - it never ran the SHIPPED client against the LIVE wire. The
brain-service audit's section-12 five-step prompt exists precisely because of this class;
LOOP-01's fresh-session requirement is vindicated in full.

## Consequences

- LOOP-01 is EXECUTED with an honest FAIL; it closes only when a released build passes the
  same test live (v2.0.0-beta.1 or a beta.13 hotfix - the release train ruling makes that
  v2.0.0-beta.1).
- Release urgency: every beta.13 install has a dead plugin Brain path mislabeled as a key
  problem. The npm @latest promotion this morning propagated an installer whose Brain leg
  is broken-at-birth. v2.0.0-beta.1 is the fix vehicle.
- AVAIL-01's out-of-band monitoring must probe through the SHIPPED CLIENT path, not only
  /health - /health was green throughout this failure.
