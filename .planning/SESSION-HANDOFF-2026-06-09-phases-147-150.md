# Session Handoff -- 2026-06-09 -- Finish 147-150 + cut the v1.14.0-beta.1 "Larry Thinks" beta

GOAL: execute the remaining 140-150 work (150 + 147; 140-146 + 148/149 are done) then publish a beta (v1.14.0-beta.1) that includes the whole band.

Paste the prompt below into a FRESH Claude Code session started in `/home/jsagi/dev/MindrianOS-Plugin`.

---

## SESSION PROMPT (copy from here)

You are resuming MindrianOS-Plugin work in `/home/jsagi/dev/MindrianOS-Plugin` on branch `main`.

HARD RULES (non-negotiable):
- ALL GSD work stays on `main`. Never create/switch branches without my explicit say-so.
- `.planning/` is gitignored -> `git add -f` for any `.planning` write.
- NO em-dashes/en-dashes anywhere (the repo greps for them).
- Canon Part 8: zero Brain egress of user content (generic handles only). All graph writes via `lib/core/navigation.cjs` (Part 9).
- Frozen Phase-148 selector contracts stay byte-unchanged: MAX_K=3, the 0.70/0.15 recommend gate, DIAL_REACH_K=6.
- Commit after each plan; push only when I ask.
- The repo has ~48 stale locked worktrees -- execute SEQUENTIALLY on the main tree, do NOT spawn parallel worktree merges.

VERIFIED STATUS of phases 147-150 (as of 2026-06-09):
- 147 (phase-map-drift-tripwire): SCOPED -- only `147-CONTEXT.md` exists. NEEDS PLANNING.
- 148 (larryreach-selector-re-wire): COMPLETE (VERIFICATION passed, run-all-148.sh 18/18).
- 149 (gsd-planning-artifacts-as-local-graph-members): COMPLETE (VERIFICATION passed, 7/7).
- 150 (memory-cortex-as-graph-members-local-and-brain-queryable-when-reaching): FULLY PLANNED -- 8 plans / 3 waves, plan-checker PASS (11/11 requirements, 0 blockers). NOT executed.
- (Adjacent: 138 capability-radar = PLANNED not executed; 144.1 = COMPLETE.)

147 vs 150 -- NOT the same substrate (do not assume 150 covers 147): 150 projects the USER memory MDs into room.db (runtime, graph, Part 8/9). 147 generates the phase-STATUS block of `docs/CANON-PHASE-MAP.md` from on-disk facts + a `--check` tripwire (commit-time, repo-doc, NO room.db, NO graph -- its CONTEXT line 138 fences it as "NOT M7"). They are siblings in PATTERN (generate + --check truth, both descend from Phase 122) but target different documents. 147 does NOT block 150, and 150 does NOT do 147's job. 147 is dev-infra/hardening (Phase 139 doctor family), NOT the v1.14.0 user track. It is timely because THIS session hand-edited CANON-PHASE-MAP + ROADMAP heavily and found stale rows (95.5/142) -- 147 is the guard against exactly that.

DO THIS, IN ORDER:

1. EXECUTE PHASE 150 (the main event -- the priority; does NOT depend on 147). FIRST read its full dossier in `.planning/phases/150-memory-cortex-as-graph-members-local-and-brain-queryable-when-reaching/`:
   - `150-RESEARCH.md` (THE canonical research -- 14-agent internal investigation + Tavily external validation + Hooked rationale; read this first)
   - `150-CONTEXT.md` (scope + LOCKED decisions D-01..D-11)
   - `150-UNDERSTANDING.md` (the reuse-seam map, file:line)
   - `150-LOOP-MAP.md` (what 150 closes vs companions)
   - `150-PLAN-CHECK.md` (PASS verdict)
   - `150-01-PLAN.md` ... `150-08-PLAN.md` (the 8 plans)
   Then run `/gsd:execute-phase 150`. Waves: W1 = 150-01 (memory_artifact writer + governing_thought/persona/decision nodes + lineage + run-all-150.sh) + 150-02 (typed memory-cortex Brain packet + adversarial egress test). W2 = 150-03 (reconcile spine + hybrid trigger) + 150-04 (getRoomContext legD + starved-sensor producers + brainAnchors + delete dead SECTION_WEIGHTS). W3 = 150-05 (connector spine + cortex sensor) + 150-06 (selector graph-driven + THE render unlock) + 150-07 (FEYNMAN read-back + seed-writer) + 150-08 (claim harness C1-C7 + doctor --claims + finalize run-all-150.sh). After all waves pass, spawn gsd-verifier to produce `150-VERIFICATION.md`.

2. FINISH + EXECUTE PHASE 147 (independent dev-infra guard; not a 150 blocker). Run `/gsd:plan-phase 147` (it has only a CONTEXT; the plan-checker verifies), then `/gsd:execute-phase 147`. It generates the sentinel-bounded `## Phase Status (auto)` block in `docs/CANON-PHASE-MAP.md` + a `--check` tripwire that fails a commit when hand-typed status drifts from disk facts (reuse `build-command-registry.cjs` generate+check + `timeline-runner.cjs` sentinel merge; see 147-CONTEXT reuse map). Run it once after to reconcile the map (it will catch the stale rows from this session).

3. CUT THE BETA -- v1.14.0-beta.1 "Larry Thinks" (the milestone goal; do this AFTER 150 + 147 are executed + verified). The band 140-146 is the v1.13.1 LARRYREACH work (already executed); 148/149 (complete) + 150 + 147 are the v1.14.0 "Larry Thinks" memory/selector work being released for the FIRST time. Current version is v1.13.1-beta.11, so this bumps the MINOR to v1.14.0-beta.1.
   Use the release ceremony (do NOT bump by hand) -- `scripts/release.sh` enforces the version-consistency gates:
   - CHANGELOG.md: add a `## [1.14.0-beta.1]` entry summarizing 148 (selector re-wire), 149 (planning-artifacts graph bridge), 150 (memory cortex as graph members + render unlock + claim harness), 147 (phase-map drift tripwire).
   - Version lockstep (ALL must match): `.claude-plugin/plugin.json`, `package.json`, the `git tag v1.14.0-beta.1`, and `~/mindrian-marketplace/.claude-plugin/marketplace.json` with `source.ref` pinned to the tag.
   - npm lockstep (HARD RULE): publish `@mindrian/os` to npm in the same release (release.sh Step 9.5); vendored `node_modules` handled by release.sh (npm ci --omit=dev into the tagged commit, stripped from main HEAD).
   - Dual-website lockstep (HARD RULE, 8 places): after the bump, fact-check the mindrian-website HAND-TYPED version surfaces (hero eyebrow, roadmap, about timeline, FALLBACK_VERSION constant, counts) against VERSION-BUMP-CHECKLIST.md; Nav badge + Footer auto-resolve from npm. Both Vercel surfaces update.
   - Release infra ships as BETA first (this IS a beta) -- correct.
   - `git push origin main --tags` only when the navigator confirms.

(Optional, separate: 138 capability-radar is PLANNED-not-executed but is NOT in the 140-150 band -- leave it out of this beta unless I ask.)

PHASE-150 CRITICAL REMINDERS (from the dossier -- do not violate):
- `writeDecisionNode` (150-01) is a TRUTH-CLAIM node -> it MUST mint `review_status='proposed'`, NEVER `confirmed`. Only the human `confirmNode` path promotes. A `confirmed` mint is a Canon Part 9 role-5 breach. (The other cortex nodes are system-bookkeeping, created_by=system, exempt.)
- THE RENDER UNLOCK (D-08): 150-06 wires `buildReachList -> dial-presenter` into the LIVE response surface at `scripts/intent-classifier.cjs:1329`. Today the engine decides every turn but the navigator never SEES the dial. This is the 148+150 unlock -- the load-bearing deliverable.
- 150 is the FIRST real `sendPacket` consumer -- its adversarial egress test (`tests/test-150-brain-egress.cjs`, clone of test-149) must prove zero raw memory prose reaches any Brain packet (build from node IDs + correlation_id + enum scalars; never read node properties; no network requires).
- The claim harness (150-08) ships RED by design; each `claim-cN.cjs` goes GREEN as the bridge delivers. NO mocked Brain (real fixture room.db; `MINDRIAN_ROOMS_HOME` tmpdir). The semantic claims (C2-is-it-good, C4-relevance) are carved out to the human empathy gate -- do not fake them.
- CROSS-WAVE FILE TOUCH: `scripts/intent-classifier.cjs` is edited by 150-04 (sensor ctx, ~:1220, Wave 2) AND 150-06 (render tail, ~:1329, Wave 3). They are sequential (different waves). In 150-06, add ONLY the render tail; do not clobber 150-04's sensor-ctx lines.
- SECTION_WEIGHTS delete (150-04): grep-confirm zero live consumer before deleting the import (navigation-engine.cjs:64) + the def/export (navigation-engine-shared.cjs).
- Reuse-before-build (Part 7): memory-artifacts.cjs mirrors planning-artifacts.cjs; memory-cortex-packet.cjs mirrors artifact-brain-packet.cjs; reconcile-memory-runner.cjs mirrors reconcile-runner.cjs; run-all-150.sh mirrors run-all-149.sh; run-all-claims.sh mirrors run-all-146.sh.

150 closes the LOCAL memory loop (cortex as graph members + the 4 orphans + FEYNMAN read-back + the decision-node EXTEND debt + the render unlock with 148) and is the first remote consumer. Named companions that 150 does NOT close (do not scope-creep into them): Phase 132 live Brain writes, Part 10 ratification, the Phase-115 nudge emission, the rest of the 108 truth-claim writers, 112/113/144.1.

## END SESSION PROMPT

---

## Quick-reference for the human

| Phase | State | Next command |
|-------|-------|--------------|
| 147 phase-map-drift-tripwire | CONTEXT only | `/gsd:plan-phase 147` then `/gsd:execute-phase 147` |
| 148 larryreach-selector | COMPLETE | none |
| 149 gsd-planning-artifacts | COMPLETE | none |
| 150 memory-cortex-as-graph | PLANNED (PASS) | `/gsd:execute-phase 150` |
| 138 capability-radar | PLANNED | `/gsd:execute-phase 138` (optional) |
| 144.1 connector-retrofit | COMPLETE | none |

All Phase-150 design artifacts (CONTEXT / RESEARCH / UNDERSTANDING / LOOP-MAP / PLAN-CHECK / 8 PLANs) are committed on `main`.
