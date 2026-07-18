---
kind: seed
status: open
severity: high
created: 2026-07-18
canon_parts: [8, 10, 11]
related: [SEED-068 (be infrastructure -- this seed answers its unresolved commercial questions), SEED-062 (the engine gap), SEED-067 (BYO-key/BYO-sub -- largely dissolved once the host runs the conversation)]
proving_case: "SEED-068 recorded four unresolved commercial questions and named the core problem: skills are copyable markdown. The host matrix of 2026-07-18 then established that room.db, the gate ladder, the navigation engine and the memory layers are ALL local .cjs on the user's machine. A copied skill package plus a copied local server is a working product. Only the hosted Brain fails that copy test."
source: "navigator decision 2026-07-18, after declining to settle packaging first: 'decide packaging later -- tackle the commercial question first', then selecting a licensed-server / open-core model over Brain-as-a-service, institutional licensing, and methodology-as-product."
---

# SEED-069: Open core, where the boundary is a NETWORK boundary

## What's actually open

The core/paid line, and the four questions SEED-068 left unresolved.

**Trigger:** immediate. This decides packaging (SEED-068), so it blocks that work.

## NAVIGATOR DECISION 2026-07-18 -- licensed server / open core

Chosen over: Brain-as-a-service, institutional licensing, and
methodology-as-curriculum. Those remain live alternatives if this fails; they are
recorded in the session transcript and are not re-litigated here.

## The objection, and why it is the wrong thing to optimise

The stated weakness of a licensed server: **the MCP server is local `.cjs` on the user's
machine.** A licence check is patchable. You would be defending code you already shipped.

That objection is real and it does not matter much. Redis, Elastic and GitLab all ship
code a determined user could patch. **Enforcement was never the moat.** People who patch
licences were never customers. Serious buyers pay for support, updates, indemnity,
someone to sue, and not having a compliance conversation.

**The real risk in open core is not piracy. It is drawing the line wrong** -- a free tier
so weak nobody adopts, or so complete nobody upgrades.

## THE LINE -- put in the paid layer what does not run locally

The architecture already suggests the boundary. Draw it at the **network boundary**, not
at a licence check.

```
FREE CORE  -- local, copyable, and that is FINE; it is the adoption engine
  124 SKILL.md (the methodology)
  the local MCP server
  room.db and the room graph (the user's own data)
  the gate ladder, navigation engine, memory layers

PAID  -- hosted; nothing to patch, because it was never on their disk
  the BRAIN            the curated teaching graph
  scouts / sentinels   grants, deadlines, competitors, opportunity scans
  cross-room and cross-org intelligence
  curation and updates the methodology evolves; a static copy rots
  support, indemnity, SLA
```

**This is open core where the boundary is a network boundary.** Nothing to defend on the
user's machine because the paid capability was never delivered there.

**Part 8 holds unchanged.** The Brain stays a **READ** service -- it is queried, it never
sees user content. The canon constraint that already exists is exactly what makes this
sellable to institutions who would refuse a data play.

## The failure mode to watch is the OPPOSITE of piracy

**Making the free core too thin.**

If Larry does not teach without a subscription, nobody adopts -- and adoption is the
entire point of the infrastructure play (SEED-068). The free tier must be a genuinely
good, working teaching partner. **The paid tier is what makes it current and connected,
not what makes it functional.**

Concretely: methodology sessions, the gate discipline, the room graph, and Larry's voice
all belong in the free core. If a paid check ever gates a `/mos:` methodology run, the
line has been drawn wrong.

## The four SEED-068 questions, answered and re-opened

1. **Which methodology content lives behind the server?** -- ANSWERED: none of it. The
   methodology is the adoption engine and ships free in `SKILL.md`. What lives behind the
   server is *knowledge* (the Brain) and *currency* (scouts, updates), not *method*.
2. **What is the entitlement mechanism, and does it work offline / self-hosted?** --
   OPEN. Under this model entitlement is simply an authenticated call to the hosted
   Brain; offline means the free core, which still works. Self-hosted Brain for
   enterprise is a separate, unresolved question.
3. **Is Tier 0 a free tier pulling toward paid Tier 1?** -- REFRAMED. The SEED-068 tiers
   are HOST-capability tiers, not commercial tiers. Do not conflate them. A Tier-0 host
   (e.g. Zed) can have a paying user; a Tier-1 host can have a free one.
4. **Per-seat, per-org, or per-room pricing?** -- OPEN. Note the host runs the
   conversation, so seat-counting cannot rely on our own telemetry (Part 8 forbids the
   obvious workaround). Likely resolves to per-org against Brain API credentials.

## Do NOT

- Gate a methodology run behind a paid check. That inverts the adoption engine.
- Build licence-key enforcement into the local server. It is patchable, it signals
  distrust to the exact developers whose adoption is the strategy, and the network
  boundary already does the work.
- Let the Brain start ingesting user content to justify pricing. It is a READ service;
  that is Canon Part 8 and it is also the thing that makes the paid tier sellable to
  institutions.
- Conflate host-capability tiers (SEED-068) with commercial tiers. Different axes.
