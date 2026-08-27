---
slug: planned-vs-executed-drift-audit-260605
kind: qa-sweep
title: Planned-vs-Executed Drift Audit (whole-venture, dog-food Part 6)
date: 2026-06-05
running_version: 1.13.1-beta.9
author: Larry (5-agent fan-out, user-requested)
canon_parts: [Part 6, Part 8, Part 9, Part 10]
status: open
---

# Planned-vs-Executed Drift Audit

This is the drift scan Canon Part 6 (dog-fooding) says the room's own
cross-relationship scan should produce, and that Phase 92
(drift-detection-engine) was scoped to automate and never built. Produced
by hand via a 5-agent fan-out on 2026-06-05 at user request.

Root finding: the code is AHEAD of the contract. Almost every gap is
"built, shipped, never reconciled into the canon / never ratified / never
closed," not "failed to build." The danger is a governance map you cannot
trust.

## Component health matrix

| Component | Health | Classification | Note |
|-----------|--------|----------------|------|
| CANON-PHASE-MAP.md accuracy | RED | NEW FAILURE | Stops mapping at 129.5; ~11 shipped phases unmapped; false "planned"/"deferred" rows |
| Canon Part 10 ratification | RED | NEW FAILURE | Code shipped (114-120), constitution never amended, empathy gate never run |
| Capability Dial (Phase 141) | YELLOW | KNOWN (by design) | getRoomContext + reach/posture ids real; sensors + nav engine (143/144) do not exist |
| Python elimination (Phase 134) | YELLOW | KNOWN (scaffold) | 24 .py files remain, still called; @huggingface/transformers never added |
| Live Brain :Person pseudonymize (132) | RED | NEW FAILURE | Real names persist in production Neo4j; --execute refuses, deferred v1.14.0 |
| Brain packet raw-prose (H5, _backlog) | GREEN | RESOLVED-IN-CODE (audit error corrected 2026-06-05) | schema maxLength:120 + projectText hashes by default + test-navigation-packet-part8-leak.cjs (9 tripwires) + check-sendpacket pre-commit guard. The _backlog memo was stale; reconciled. |
| v1.13.0 milestone close-out | RED | NEW FAILURE | No milestone audit; empty stable CHANGELOG body; bled into v1.13.1 |
| ROADMAP.md header | RED | NEW FAILURE | Header + Active Milestone block still point at v1.13.0; live work at line ~1846 |
| Doctor accumulative engine (139) | YELLOW | KNOWN | 1 of 16 organ modules registered (umbilical only) |
| Dual-graph live writes (132) | YELLOW | KNOWN | Machinery shipped fixtures-only; bulk reify + 278-node wire + pseudonymize deferred |

## Findings by canon part

### Part 6 / contract accuracy (CANON-PHASE-MAP.md)
1. Phase 100 (JTBD Inference Engine) row says "DEFERRED to v1.14.0." Reality:
   taxonomy + state + serves_jtbd declarations SHIPPED (100-VERIFICATION
   passed 2026-05-01; swept across 80+ commands). Only full command-HIDING
   is deferred. NEW FAILURE.
2. check-brain-boundary.cjs row (Part 8) says "not yet scaffolded." Reality:
   Phase 117-04 SEED-003 A3 sanitizer shipped and the CHANGELOG cites this
   exact map row as closed. NEW FAILURE (security row understating a gate).
3. Phase 110 self-contradiction: Part 9 row says "planned"; the file's own
   version-history admits it shipped in beta.13. NEW FAILURE.
4. Phases 114-120 all say "planned"; all shipped across v1.13.0-beta.2..8.
5. ~11 shipped phases UNMAPPED entirely: 125, 130, 130.5, 130.7, 131, 132,
   135, 139, 140, 141. The map is blind above 129.5.
6. Phase-number collision: canon (Part 6) hard-codes "Phase 92 =
   drift-detection-engine," but the on-disk dir is 92-trust-layer-refactor
   (skipped placeholder). The map keys obligations on a non-unique number.

### Part 10 (Conversation as Product)
7. Part 10 is NOT in MINDRIAN-CANON.md (canon ends at Part 9). The thesis
   that governs the whole product framing was never ratified.
8. Ratification gate (Hooked re-score >= 55 AND empathy audit 4/5 testers
   report "thinking partner") was never run. Harness exists
   (scripts/hooked-rescore-117.cjs, scripts/empathy-observation-emit.cjs);
   no recorded tester verdict anywhere. v1.13.0 finalized anyway.
9. Sub-claim 3 ("room as receipt") is structurally half-open: Phase 119
   nudge cannot fire (depends on Phase 115 venture-classification deferred
   to v1.14.0); Phase 118 live Vercel + 60s Brain path verified mocked only
   (2 human_needed items never closed).
10. Sub-claim 4 ("commands are internals") deferred by design; users still
    see /mos:* commands.

### Part 8 (security, LIVE exposures)
11. Phase 132 deferred live pseudonymization of 6 internal-team :Person
    nodes. Real names persist in the production shared Brain graph NOW.
    Trips Canon Part 8 + the no-real-names hard rule.
    curation-132-05-pseudonymize.cjs --execute refuses with "DEFERRED."
12. H5 (in _backlog): CORRECTED 2026-06-05 -- RESOLVED-IN-CODE, not open.
    The value-space fix shipped: schema caps summary/explanation at
    maxLength:120; packet.cjs::projectText hashes to sha256 by default
    (prose only under explicit allow_excerpts Part-3 opt-in);
    tests/test-navigation-packet-part8-leak.cjs (9 adversarial tripwires,
    in run-all-110.sh) + check-sendpacket pre-commit guard prevent
    regression before any consumer lands. The _backlog memo was
    stale-pessimistic drift (mirror image of the canon map's
    stale-optimistic drift) and was reconciled. The ONE open live Part 8
    item is finding 11 (Phase 132 :Person pseudonymize).

### Graveyard (planned, quietly never shipped)
13. Wiki sprint (Phases 19 + 03.1, re-memoed in _backlog/v1.14-mindrian-wiki-sprint):
    backlinks, see-also, graph-homepage, auto-create-on-new-project,
    click-red-link-to-research. Fully specced, never assembled. Carries
    Lawrence's P1 multi-room blocker.
14. GraphRAG retrieval + Room Budding (112): the only planned retrieval
    quality jump; perpetually stubbed, pushed to v1.15/v2.0.
15. 88.3 -> 88.4 -> 88.5 arc (brain-harness -> discussion-rooms ->
    pws-vp-scaffold): three scaffolded phases bypassed by the Path C
    re-route; 88.5 still falsely "planned" in CANON-PHASE-MAP Parts 2/3/5.
16. Phase 134 Python elimination: scaffold only; 24 .py files still shipped
    and called; Windows ModuleNotFoundError class still open.
17. Phases 133, 136, 137, 138: fully-designed CONTEXT/SPEC, no plumbing,
    honestly parked at v1.14.0 (NOT silent drift).

### Release health
18. v1.13.0 took 44 betas / 4 weeks to promote; stable cut 2026-06-02 with
    an empty CHANGELOG body and no v1.13.0-MILESTONE-AUDIT.md.
19. v1.13.1 is 9 betas deep at 54% (13/24 phases), no stable; doctor
    hotfixes that morally belong to v1.13.0 ride v1.13.1 betas.
20. ROADMAP.md header still declares v1.13.0 "The Closed Loop" active;
    STATE.md correctly says v1.13.1 "Larry Reaches." The two disagree.

## False positives (verified NOT drift)
- Phase 95.5 (post-compact memory consumer): memory said "half-wired,
  deferred" but it fully shipped as v1.13.0-beta.7 (9/9 tests, VERIFICATION
  passed). Deferral closed.

## Corrections (post-audit verification, 2026-06-05)
The audit was itself drift-checked. Two of its own findings were wrong and
are corrected here (Canon Part 9: verification confirms truth, the audit
only proposes):
1. Phase 142 dependency direction INVERTED. The audit's agent-3 read
   "Phase 142 depends on 143/144/145/146 (none exist)." A gsd-plan-checker
   pass returned verdict PASS: Phase 142's 4 plans are EXECUTABLE AS
   WRITTEN, depend ONLY on Phase 141 (shipped), and 143/144/145/146 are
   DOWNSTREAM consumers of 142, not prerequisites. The one genuine build is
   CASC-02 (wire getRoomContext into decide() through the navigation.cjs
   chokepoint; routing_source stays legacy per the Phase-144 fence). The
   only real codebase gap is decide() not yet calling getRoomContext --
   the gap Plan 142-02 closes. Canon map row corrected.
2. H5 RESOLVED-IN-CODE (see finding 12). Not an open live exposure.
The capability dial ACT layer is still genuinely doctrine-only (sensors
=Phase 143, nav engine=Phase 144 do not exist) -- that finding stands.

## Remediation (six workstreams, by risk)
- WS1 (safe, in-flight): reconcile CANON-PHASE-MAP.md (flip false rows, add
  v1.13.1 addendum, note 92 collision + doctrine-only dial). PARTIAL this
  session.
- WS2 (safe, in-flight): re-point ROADMAP.md header to v1.13.1.
- WS3 (safe): give H5 a phase home (v1.13.2 or v1.14.0) + a tripwire test
  asserting packet values carry no raw prose before any sendPacket consumer
  lands.
- WS4 (safe): write v1.13.0-MILESTONE-AUDIT.md; decide v1.13.1 stable gate.
- WS5 (RISK, go/no-go): run curation-132-05 pseudonymize against live Brain
  with snapshot + rollback. Human go/no-go required. Production mutation.
- WS6 (needs humans): run the Part 10 empathy audit (4/5 testers) +
  Hooked re-score; ratify or de-scope Part 10. Cannot be fabricated.

## Resume
`/gsd:debug planned-vs-executed-drift-audit-260605`
