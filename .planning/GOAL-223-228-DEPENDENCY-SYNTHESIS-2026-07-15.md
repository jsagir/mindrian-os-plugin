# GOAL SYNTHESIS: Phases 223-227, second research pass — 2026-07-15

**Update (same day):** 228 is EXCLUDED from the active goal per navigator instruction. Its
dependency research (below and in ROADMAP.md's Phase 228 entry) stays on record — the corrections
found there are real and worth keeping — but 228 is parked, not part of this pipeline's scope.
Read the file as "223-227" wherever it says "223-228" below; the 228 sections are retained for
reference only, not as active pipeline members.

Supersedes the sequencing model in `.planning/SESSION-HANDOFF-2026-07-15-seed-pipeline-225-228.md`
(that document's per-phase dependency prose is now mirrored into ROADMAP.md's own 223-228 entries
as dated correction addenda — read the entries directly, this file is the cross-phase synthesis
layered on top). Produced by fanning six parallel research agents, one per phase, each
independently verifying its ROADMAP dependency claims against the current 210-222 code and
flagging composition risk against its five siblings — not just re-reading the prior session's
prose.

===============================================================================
GOAL STATEMENT (corrected, 228 excluded)
===============================================================================

Work phases 223, 224, 225, 226, 227 as ONE pipeline through spec -> discuss -> plan -> execute ->
verify. The prior handoff explicitly excluded 223 from "the pipeline" as lower priority; this pass
folds it back in, because it is the most-built-out of the six (SPEC + BUILD-BRIEF already on disk)
and has a real, bidirectional dependency on 224 that the original framing didn't surface. 228 is
parked out of this goal (navigator instruction, 2026-07-15) — its research stays on record below
and in ROADMAP.md for whenever it's picked back up. Once 223-227 are in a good state, cut a
version release — do not skip to the release step with phases still open.

**Real sequencing constraint found this pass (the one genuine ordering dependency among the
active five):** 224 before 223. Everything else in 223-227 is independently spec-able in any
order; the prior handoff's "224 first because it's most foundational" intuition was directionally
right but for a narrower reason than stated — 223 is the one phase that actually degrades
(silently, not fatally) if built on 224's unfixed graph-population gap.

===============================================================================
WHAT CHANGED FROM THE FIRST PASS (the corrections that matter)
===============================================================================

1. **225 is NOT blocked on 224.** The first pass's "shared resolver-fragmentation failure site"
   claim is stale — Phase 194 (COMPLETE 2026-07-01) already shipped session-binding and converged
   the write-guard and write-index paths onto one function, `room-root.cjs::resolveRoomRoot()`.
   225's real remaining scope is narrower: a classifier zero-score edge case
   (`scripts/intent-classifier.cjs:509`) plus a WAL-concurrency risk. Proceed with 225's spec now.

2. **224's scope is itself ambiguous, and that ambiguity matters.** Scoped narrowly (just
   `scripts/post-write` calling `navigation.cjs`), 224 shares no resolver with 225 and is fully
   independent. Scoped to SEED-034's full 7-item capability list, it extends into
   `gsd-artifact-graph-hook.cjs`'s fallback branch, where a real (if narrow) divergence from
   225's resolver reappears. Resolve narrow-vs-full explicitly at 224's own spec-phase — it
   changes whether 225 needs lockstep research.

3. **226 has a real design problem, independent of sequencing.** Phase 212's Grounding Guard
   critic needs two of three scoring inputs that themselves depend on the same encoder 226's
   reasoning-mode fallback is built to route around (`rs-differential-scorer.cjs::scoreMeasured()`
   short-circuits before the critic is even invoked when the encoder is down). "Reuse Phase 212's
   critic, but lighter" is not viable as stated — it needs a genuinely new scoring path. 226 still
   doesn't wait on 224; this is an internal design risk, not a cross-phase one.

4. **227 gained real scope.** SEED-056 (the persona-coverage audit) explicitly hands its
   ignite-naming-gap finding to 227: `larry-personality.md` never names ignite, and
   `conversation-mode.md`'s Mode 3 still bypasses it for `/mos:new-project` directly — both
   confirmed still live in current code. Fold this into 227's spec, not a separate future pickup.
   227 remains fully independent and ready now.

5. **228 is bigger and murkier than "the two easy leftovers."** Requirement 1 (spine-wiring) is
   genuinely done — re-confirmed. But Requirement 2 (repoint off Pinecone) runs into an unresolved
   question the first pass didn't surface: a legacy Python RS engine (`scripts/rs-engine.py` +
   `rs_corpus.py`/`rs_cache.py`/`rs_hybrid.py`) still exists alongside a 28-file JS `rs-*.cjs`
   family, and it's unclear which is actually live for rs-fetch's internal/cross-room/hybrid
   modes — that changes the repoint from "swap a bridge module" to "coordinate with the stalled
   SEED-013 Python-elimination effort." **Corrected same-day:** the flag on `vector-store.cjs`
   importing `rs-pinecone-bridge.cjs` was a false alarm — that import is a pure, network-free
   `cosineSimilarity` math function (embedding-spine.cjs comments "the same function object, not
   a fork"; 211-02-SUMMARY.md confirms Part-8-clean, no room-byte egress).
   `vector-store.cjs`/`embedding-spine.cjs` ARE the clean local precedent as originally claimed.
   The real, still-live Requirement-2 target is `rs-pinecone-bridge.cjs`'s OTHER path — it
   genuinely shells out to Python (`rs_cache.py::fetch_all_from_namespace`) for its actual
   Pinecone fetch, and `rs-differential-scorer.cjs` separately cites `scripts/rs-engine.py` for
   its corpus-mode use case — the legacy Python engine is live via that bridge, not vestigial.
   Requirement 3 (R-expert Aura/Brain-Cypher) is less an open research question than a navigator
   sign-off: the seed's own Option A (keep remote, Part-8-compliant) already reads as the
   recommended answer.

===============================================================================
PER-PHASE STATUS (one line each, detail lives in ROADMAP.md's own entries)
===============================================================================

- **223** — SPEC'd (ambiguity gate at 0.24, Constraint Clarity flagged, `~/mindrian-designs/`
  still absent — Requirement 6's documented fallback stands). Sequence AFTER 224.
- **224** — registered only. Scope decision (narrow post-write fix vs. full SEED-034 harness) is
  itself the first open question at spec-phase.
- **225** — registered only. Independent of 224. Real scope: classifier edge case + WAL race.
- **226** — registered only. Independent of 224. Real open problem: the Grounding Guard critic
  needs a new lower-confidence scoring path, not a lighter version of the existing one.
- **227** — registered only. Independent, ready now. Scope now includes SEED-056's ignite-naming
  fix (`larry-personality.md` + `conversation-mode.md` Mode 3 routing).
- **228** — EXCLUDED from the active goal (navigator instruction, 2026-07-15). Research stays on
  record in ROADMAP.md's Phase 228 entry: Requirement 1 done, Requirement 2's real target now
  precisely identified (`rs-pinecone-bridge.cjs`'s Python subprocess path +
  `rs-differential-scorer.cjs`'s `scripts/rs-engine.py` corpus-mode call), Requirement 3 a
  sign-off on an already-recommended option. Pick back up separately, outside this pipeline.

===============================================================================
RECOMMENDED ORDER (223-227, 228 excluded)
===============================================================================

224 -> 223, with 225, 226, 227 free to interleave anywhere (spec-phase can run any of them
in parallel with 224/223 — none of the three are gated on 224 shipping). 227 is the most
"ready now" of the three independents — scope fully sharpened this pass, no open questions left.

===============================================================================
STILL OPEN — for each phase's own spec/discuss-phase, not decided here
===============================================================================

- 224: narrow post-write fix vs. full SEED-034 7-item harness.
- 226: what the new (not "lighter Phase 212") critic scoring path actually looks like.
- 228 (parked, not active): Requirement 2's real size against the now-identified Python-bridge
  target; Requirement 3 Option A sign-off (recommended) vs. Option B descope. Revisit when
  228 is picked back up.
- 223: whether to sequence its discuss-phase strictly after 224 ships, or start discuss-phase now
  with the graph-population gap named as a known, accepted risk in the interim.
