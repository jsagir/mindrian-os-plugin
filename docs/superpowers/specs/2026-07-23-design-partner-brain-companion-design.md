# Design-Partner Brain Companion — Design Spec

**Date:** 2026-07-23
**Status:** Approved (design phase) — pending implementation planning
**Scope:** 1 dedicated Brain deployment (redeploy of existing code) + 1 new API-key tier + 1 companion persona/quickstart doc + reference client

---

## Overview

Oliver Kuntz (Johns Hopkins Technology Ventures) wants to embed a chat-based
advisor inside his own Hopkins invention-disclosure platform, covering two of
his platform's four core jobs: idea hardening and creative collisions. He
described this live (2026-07-23 call, filed at room `jhtv-oliver-kuntz`) using
exactly Larry's pedagogical function — "it challenges you, says have you
thought about it this way." Jonathan proposed, on the same call, building an
MCP — not full Mindryon, but "the advisor graph Mindryon is hooked to, which
holds all the frameworks" — explicitly scoping this to a read-only Brain
surface, never the local-write Mindryon experience.

This spec turns that live promise into a concrete, scoped deliverable: a
**dedicated Brain deployment for external design partners** (Oliver first,
Bina Institute/Weizmann warm as a second candidate), plus the missing piece
that makes it feel like a companion rather than a knowledge API — a portable
Larry persona/voicing layer Oliver plugs into his own LLM.

## Why not the current production Brain default

`pws-brain-mcp.onrender.com` (Memgraph-backed) became the default Brain
endpoint for `lib/core/brain-client.cjs` on **2026-07-23** — the same day as
this spec (quick-task `260723-aj4`, step 4 of the phased Memgraph migration).
Two findings from that migration's own record make it the wrong foundation
for a new third-party commitment today:

- Its `text2cypher` tool errors server-side ("No LLM configured") — a known,
  unresolved config gap on that deployment.
- The Canon Part 8 egress/leak-detection test suites (`test-169-brain-boundary.cjs`
  and six siblings) are still keyed to the *old* hostname only. The new host
  currently has **zero automated boundary-leak coverage**.

The legacy Neo4j Aura + Pinecone server (`mcp-server-brain/` in this repo) is
mature, fully documented, and still live — confirmed reachable
(`https://mindrian-brain.onrender.com/` → HTTP 200) at spec time. Its moat
guards are already designed, shipped, and reasoned through:

- **D-MOAT-1** — `brain_query`/`brain_write` admin-gated (SHIPPED v1.13.0-beta.21)
- **D-MOAT-2** — row/byte/timeout execution safeguards on any permitted read
- **D-MOAT-3** — curated-op surface (`list_frameworks`, `framework_edges`,
  `framework_chain_slice`) as the frozen-Cypher, no-caller-Cypher safe tier

This is the codebase this spec builds on. The Memgraph migration continues on
its own internal timeline, untouched by this work.

## Architecture

```
Oliver's Hopkins platform (his own LLM, e.g. Claude)
         │
         │  1. calls Brain MCP tool (brain_ask / brain_search / brain_schema / brain_stats)
         ▼
  mindrian-brain-partner  (NEW Render service — redeploy of mcp-server-brain/,
                            zero code changes, same 6-tool surface)
         │
         ▼
  Neo4j Aura (existing, free tier) + Pinecone (existing pws-brain index)
         │
         │  2. DirectiveEnvelope response (grounded chunks, GUIDED-mode question,
         │     next_gate framework candidates)
         ▼
Oliver's LLM, primed with the Larry companion system prompt
         │
         │  3. voices the envelope conversationally ("have you thought about it this way?")
         ▼
Oliver's faculty user
```

## Components

### 1. `mindrian-brain-partner` Render deployment

Redeploy of `mcp-server-brain/` as-is — no code changes. Same `render.yaml`
shape, pointed at the existing Neo4j Aura instance and `pws-brain` Pinecone
index (read path only). Deliberately decoupled from `pws-brain-mcp.onrender.com`
so nothing about the Memgraph migration's stabilization risk touches an
external commitment.

Deployment decision (confirm at planning time): either (a) stand up a
genuinely separate Render service so partner traffic and any residual
internal traffic never share a process, or (b) reuse the still-live
`mindrian-brain.onrender.com` directly with a scoped key. (a) is the safer
default given this now carries an external commercial relationship.

### 2. `design_partner` API-key tier

A new key issued through the existing Supabase `brain_api_keys` table.
Non-admin — reaches only `brain_ask`, `brain_search`, `brain_schema`,
`brain_stats`. `brain_query`/`brain_write` stay blocked, identical to every
regular non-admin key today. No new gating logic required — this tier
already exists in `lib/neo4j-tools.cjs`'s D-MOAT-1 admin check; it just needs
a key minted and tagged for revocability/usage tracking per partner (since
one key now sits behind potentially many Hopkins users, not one Mindrian
user).

### 3. Companion quickstart (net-new)

A short doc + ~30-line reference client:

- **Persona/voicing system prompt** — the GUIDED-mode Socratic behavior and
  reframe pattern, extracted as a portable prompt (not the full Larry agent
  body, not the room/reach/gate machinery). Per the project's own moat
  doctrine, prompts are the explicitly copyable/shippable tier; the
  graph/calibration is the protected one — so this is the lower-risk half of
  the deliverable, not the higher-risk half.
- **Reference client** — shows the call → voice → respond loop: call a Brain
  tool, feed the DirectiveEnvelope + the persona prompt to Oliver's own LLM,
  return the natural-language answer to his faculty user.

### 4. Governance gate (human decision, not code)

Whether/on what terms Oliver (and later Bina) gets a key at all is a business
decision for Jonathan/Lawrence, not a build task. Tracked separately in the
`mindrian-opportunities` room filing for this call, not in this spec.

## Data flow & Canon Part 8

Oliver's platform never sends Hopkins-specific content (faculty names,
invention details, internal docs) to the Brain — only generic methodology
questions, exactly as every existing Brain caller does today. Nothing new
crosses the Part 8 boundary; this spec only changes *who* holds a key and
*what* sits on top of the response.

## Testing / verification

- Reuse the existing Part 8 boundary/egress suites (`test-169-brain-boundary.cjs`
  and siblings) — they already key off the *old* hostname, which is exactly
  the one this deployment reuses, so coverage is already in place (unlike the
  new Memgraph host).
- New smoke test: hit the partner deployment's `brain_ask`/`brain_search`/
  `brain_schema`/`brain_stats` with a `design_partner`-tier key; confirm
  `brain_query`/`brain_write` are still rejected for that key.
- Manual companion-quality check: run one real DirectiveEnvelope response
  through the persona prompt and confirm it reads as Socratic voicing, not
  raw JSON.

## Out of scope

- The full Mindryon experience — no local room, no write access, no
  cross-session memory, no reach/gate machinery. Matches what was promised
  live on the call.
- Any change to the Memgraph migration or `pws-brain-mcp.onrender.com`.
- Business/commercial terms of the design partnership itself.
- A hosted, Mindrian-run companion service (the "Option B" considered and
  set aside during brainstorming — bigger lift, not what was promised).

## Open items for planning

- Confirm deployment shape: brand-new Render service vs. scoped key on the
  existing live `mindrian-brain.onrender.com`.
- Confirm Supabase `brain_api_keys` schema supports a tier/tag field for
  `design_partner`, or whether a naming convention on the key suffices.
- Decide whether the companion quickstart ships as a Mindrian-authored
  Node/curl reference client, or as prompt text only (Oliver wires his own
  transport).

---

*Design brainstormed and approved 2026-07-23. Source context: JHTV/Oliver
Kuntz call filed at room `jhtv-oliver-kuntz`; opportunity signal filed at room
`mindrian-opportunities` (section `jhtv-bina-brain-mcp-design-partnership`).*
