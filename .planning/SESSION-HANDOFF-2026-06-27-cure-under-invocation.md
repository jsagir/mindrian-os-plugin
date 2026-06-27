# Session Handoff - 2026-06-27 - "Cure Under-Invocation" milestone (v1.15.0 GA)

## TL;DR for the next session
Canon v1.19 is established and the first code phase landed. To continue: **`/gsd-plan-phase 183`** (METER, the keystone). Its CONTEXT is already primed on disk.

## What this session did (the arc)
A canon recalibration brief went v2 -> v3 -> v4. The master finding: **under-invocation** - everything is built (249-node operation tier, 12,485 vectors, ~11 thin-but-nonzero external navigators) and nothing fires enough. The dark operation tier, INV-2, and dormant Brain usage are three masks on one reverse salient. Invocation is the moat; the moat underperforms.

## Committed this session (branch: main)
- `b23f16a9` - feat(180-01): CANON-31 welded two-gauge metric. **Canon is now v1.19** (Appendix D entry 31): retire the Hooked ratification gate (keep the Manipulation Matrix); the WELDED two-gauge metric in Part 5 + Part 10 (invocation density must rise AND transfer-per-invocation must hold, reported together, never one number; both failure directions logged as regressions; density structurally un-reportable without the transfer denominator); and the SELF-BINDING CLAUSE (no entry 32 until entry 31 returns a real two-gauge reading from a live navigator on the gate).
- `7aa9c603` - feat(181-01): SEC. EvidenceClaim is now structurally never-promotable (NON_PROMOTABLE guard, agent OR human) + ingest instruction-stripping (stripInjectionSpans in writeEvidenceClaim). `TRUTH_CLAIM_TYPES` byte-unchanged (no frozen-set move - the self-bind blocked that path). run-all-181 7/7.

## Milestone phases (in ROADMAP.md, canon-first order)
- 180 CANON-31 - DONE (this is what made canon v1.19)
- 181 SEC - DONE (`7aa9c603`)
- 182 SIGNAL - registered. Part 12 Larry color Voice Signature (the F.7-always-renders half is ALREADY shipped via Phase 179 GA-4 interceptor - verify/lean, do not rebuild)
- **183 METER - NEXT. CONTEXT primed at .planning/phases/183-meter-gate-exposure-transfer/183-CONTEXT.md.** The keystone: builds the gate-exposure + transfer telemetry that (a) lets entry 31 return its reading, (b) clears the self-binding clause, (c) answers "does a navigator reach the gate at all"
- 184 READER - CONDITIONAL on 183. INV-2b: decide() (navigation-engine.cjs:768) reads the projection + grounds the gate offer; NEVER fires (read/grab ruling, Part 12 invisibility). Four acceptance criteria R1-R4 (A/B, projection-correctness gate, latency budget, structural no-invoke)
- 185 DRIFT - after 184. doctor --drift runtime reachability (closes the Part 11 R9 false-green)
- 186 CORPUS - P1. generated stats artifact + repoint stale literals (748/27,804/12,413 -> live 177/27,904/12,485)

## Live constraints to remember (do not re-derive)
- **The self-binding clause blocks the next amendment (entry 32) until METER returns a reading.** This already caught two canon-good moves this session: (a) SEC's "add EvidenceClaim to the frozen truth-claim set" (blocked -> used a non-frozen guard instead); (b) the ProblemType FREEZE (see below). Both are sequenced behind METER. This is the clause working as designed.
- **The read/grab ruling (settled):** decide() READS the projection to ground the gate offer, NEVER fires; Part 12 invisibility holds; the turn ends at a gate. READER is "read the shelf, never grab the tool."
- **Part 8 / plane purity:** LOCAL only; zero user data in Brain/Neo4j; adoption figures AGGREGATE-ONLY, no roster; phrase "thin but nonzero." Do NOT push the operation tier into Neo4j (Phase 137 deferred on purpose; READER reads the local projection cache).

## Parked artifact (ready for the entry-32 checkpoint when METER clears)
- `docs/PROBLEMTYPE-CLOSED-SET-DRAFT-PARKED-FOR-ENTRY-32.md` - the closed ProblemType allow-list. Verified live: the 26 ProblemTypes are a polluted bag (PWS spine + Cynefin canonical, plus a leadership taxonomy ~34 wires, an ops taxonomy 6 wires, and 4 zero-wired junk instances). The CLEAN (retire the 4 instances, dedup, tag tiers, wire operation triggers) is hygiene = the v4 R2 gate, unblocked, do as part of READER prep. The FREEZE (ProblemType as a closed governed set = the constitutional twin of Part 3 verbs / Part 4 edges) is entry 32, blocked behind METER. The one open decision to lock: leadership + ops = keep-as-governed-second-layer vs merge-into-core.

## Other docs created this session
- `docs/CANON-RECALIBRATION-VERIFICATION-REPORT-v2.md` - the live-verification swarm report (what held / corrected / refuted / unverifiable).
- Windows copies on C:\Users\jsagi\Desktop and \Downloads: MINDRIAN-CANON-v1.19.md, MINDRIAN-CANON-v1.19-EXPLAINER.md, PROBLEMTYPE-CLOSED-SET-DRAFT-PARKED-FOR-ENTRY-32.md.

## Not committed / not pushed
- Nothing pushed (no push was requested).
- The marketplace README (~/mindrian-marketplace/README.md, separate repo) carries the same "it knows when -> invocation is the moat" edit as the dev README; commit it in that repo if desired.
- room/ artifacts (thesis pipeline + discovery brief) are on the data-room-autocommit branch.
