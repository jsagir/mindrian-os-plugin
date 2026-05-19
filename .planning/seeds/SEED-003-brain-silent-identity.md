---
id: SEED-003
status: dormant
planted: 2026-05-19
planted_during: v1.13.0 endgame (Phase 121.5 re-verify cycle)
trigger_when: |
  Surface during /gsd:new-milestone for v1.13.1 OR v1.14.0 if ANY of:
  - Phase 127 (Brain MCP Local Stdio Shim) scope review -- this seed extends 127 from "auto-wire MCP" to "auto-wire MCP + silent identity"
  - Tester onboarding friction surfaces in beta feedback (existing testers report API key setup as a stumbling block)
  - Freemium tier monetization decision lands (silent identity enables a freemium gradient)
  - Commercial plugin embedding question arises (third party embeds MindrianOS in their stack -- needs clean identity story)
scope: Medium-to-Large
canon_parts: [Part 7, Part 8]
related_phases:
  - Phase 127 (Brain MCP Local Stdio Shim) -- architectural sibling, NOT the same scope
related_seeds:
  - SEED-002 (agent-lightning lab loop) -- depends on telemetry corpus that this seed's identity surface would attach to
related_memories:
  - project_brain_mcp_three_track_transition.md (the 3-track Brain MCP transition; this seed adds a 4th track for identity)
---

# SEED-003: Brain Silent Identity (eliminate the API-key ceremony)

## The Question (2026-05-19)

> *"i want the brain to be a part of the plug in to be baked in mindrianos plugin without need to use api access is it possible? ... stil remote brain, based on neo4j only without mcp with api in the middle. still remote still closed ! but no need for api, its part of mindrian"*

Jonathan asked this 2026-05-19 mid-Phase-121.5 re-verify cycle. User clarified: Brain stays REMOTE, stays CLOSED, stays Neo4j. What changes is the AUTH FRICTION between plugin and Brain. Eliminate the `claude mcp add` ceremony AND eliminate the `~/.mindrian.env` API key step. Plugin install -> Brain works -> zero setup.

Deferred to post-v1.13.0 by user's call ("lets wait after version 1.13.0!"). Filed here so the question doesn't drift.

## Why This Matters

Per Canon Part 8: Brain holds methodology (generic strategic thinking tools), not user data. The auth surface protects RATE-LIMIT and TELEMETRY identity, not user-data confidentiality. So the question is fundamentally about onboarding friction + identity model, not about IP protection.

Current state (v1.13.0):
- Existing testers: manual `claude mcp add -t http -s user -H "Authorization: Bearer $KEY" -- mindrian-brain https://brain.mindrian.ai/mcp`
- v1.13.1 (Phase 127): `bin/mindrian-brain-mcp-client.cjs` ships as local stdio MCP shim auto-loaded by plugin .mcp.json -- AUTO-MIGRATES existing testers; new users do TWO steps total (install plugin + drop API key in ~/.mindrian.env)
- **User's question (SEED-003):** eliminate the SECOND step. Plugin install -> Brain works.

## Three Architectural Options (per 2026-05-19 conversation)

### A. Per-install silent registration

- Plugin first-launch generates UUID
- POSTs once to `brain.mindrian.ai/register` with plugin version + UUID
- Server returns per-install token, plugin caches in `~/.mindrian/install-token`
- All future Brain calls authenticated via the cached token
- User does nothing

**Pros:**
- Each install has unique identity -> good for telemetry + per-install rate-limit + revocation
- Server-side rotation possible (issue short-lived tokens, refresh on expiry)
- Clean revocation story

**Cons:**
- Scrapeable: anyone can hit `/register` and farm tokens
- Mitigated by: rate-limit per-IP + plugin signature check + Cloudflare WAF + plugin-version freshness check
- Most server-side work (new endpoint, token store, rotation logic)

### B. Plugin attestation via embedded HMAC key

- Plugin binary ships with a signing key
- Every Brain request signed via HMAC of (plugin-version + timestamp + body)
- Brain verifies signature stateless
- No per-install state on server

**Pros:**
- Stateless server-side -- lowest infra burden
- Common pattern in commercial plugins (npm packages with embedded auth)
- Easiest to ship

**Cons:**
- Key extractable via reverse-engineering (any `cat node_modules/@mindrian/.../*.cjs | grep KEY`)
- Rotation requires plugin release cycle
- No per-install identity -> harder telemetry attribution
- Mitigated by: rotate per release + IP rate-limit + plugin-version pinning

### C. Anonymous tier + degraded payload

- No identity at all
- Brain accepts unauthenticated requests with strict rate-limit + reduced graph depth (2-hop max, no embeddings)
- Authenticated path (existing API key) stays optional for power users / commercial tiers

**Pros:**
- Cleanest UX -- zero friction
- Becomes a freemium gradient (free = degraded, paid = full)
- Trivial to scrape but degraded payload IS the moat protector
- Most strategically interesting -- builds the freemium muscle Mindrian will need

**Cons:**
- Slight performance hit for free experience
- Requires Brain server-side to implement payload tiering
- Edge case: how does anonymous traffic feed SEED-002 telemetry? (Probably doesn't -- only authenticated calls contribute to corpus)

## Three Questions to Settle Before Picking

1. **User job:** Offline-because-no-internet (rare), offline-because-privacy (Researcher.IND, regulatory), or offline-because-friction (most common -- "just want it to work")? Each maps to different scope.
2. **Threat model:** Who's actually scraping the API? Casual curiosity (rate-limit handles it), competitive sabotage (need stronger signature), or commercial fork (need licensing not technical protection)?
3. **Freemium posture:** Is this onboarding-only ("eliminate friction, all installs get full access") or freemium-foundational ("anonymous gets degraded; paid tier unlocks full")?

## Strategic Note

This seed's outcome ALSO affects:
- Phase 127.1 (Brain GraphRAG Collapse: Pinecone -> Neo4j HNSW server-side substrate swap) -- if anonymous tier exists, HNSW substrate must support degraded payload
- SEED-002 telemetry corpus -- per-install identity (option A) attributes events; anonymous (option C) doesn't
- Future "trained Lawrence" paid product (per CLAUDE.md decision 5) -- freemium gradient (option C) provides the natural upgrade path

The choice isn't just technical. It frames the commercial posture of v1.14.0+.

## When to Surface

- /gsd:new-milestone for v1.13.1 if Phase 127 scope is expandable
- /gsd:new-milestone for v1.14.0 if v1.13.1 freezes Phase 127 to MCP-shim-only

## Recommended Path When Surfaced

1. 15-30 min Larry-style discuss-phase walking through the 3 strategic questions
2. Output captured as `docs/BRAIN-IDENTITY-DESIGN.md` with the option picked + threat model + telemetry implications
3. Scope as Phase 128 (or 127.X) with discuss-phase -> plan-phase -> execute chain

---

*Seed planted: 2026-05-19 at user request, deferred from active v1.13.0 endgame.*
