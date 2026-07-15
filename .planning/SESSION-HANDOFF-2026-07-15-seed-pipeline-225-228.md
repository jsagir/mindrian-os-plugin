SESSION HANDOFF - 2026-07-15
Workspace: /home/jsagi/dev/MindrianOS-Plugin (NEVER the plugin cache)
Session ended at commit 6f62351b - fetch and check log before starting, a concurrent
session has been active on and off across the prior two days, do not assume this is HEAD.
Supersedes .planning/SESSION-HANDOFF-2026-07-14-reach-ranking-and-seed-queue.md (that
document's Step 1, finish Phase 222, is now DONE - see below. Its Step 2 seed-queue
priority list is superseded by this document's Phase 225-228 pipeline. Its Step 3,
cut a version release, is still accurate and still pending.)

===============================================================================
GOAL STATEMENT
===============================================================================

Work the registered phase pipeline (224 -> 225 -> 226 -> 227 -> 228) through spec ->
discuss -> plan -> execute -> verify, in whatever order makes sense (no forced order
was set among 225-228; 224 is the natural first of the five since it was registered
first and is the highest-severity/most-foundational). Once the pipeline is in a good
state, cut a version release. Do not skip to the release step with phases still open.

===============================================================================
STATE OF THE WORLD AS OF THIS HANDOFF
===============================================================================

**Phase 222 (reach-ranking-unification) - COMPLETE.** 4/4 plans executed, code-reviewed
with a fix pass (WR-01 through WR-04, CR-01), security-verified, `bash tests/run-all-222.sh`
passes 10/10, 0 FAIL. Confirmed directly, not assumed. Nothing left to do here.

**Phase 223 (jtbd-pipeline + governed-bono) - SPEC'd, NOT planned or executed.** Ambiguity
gate did not clear (0.24, Constraint Clarity flagged - the brief's cited source directory
~/mindrian-designs/ does not exist on this machine; Requirement 6 in that SPEC locks a
fallback to draft the missing prose from the SPEC itself). Lower priority, not part of
this handoff's stated pipeline, exists if picked up separately.

**Phase 224 (SEED-034, graph-derivation-harness) - REGISTERED ONLY, nothing planned yet.**
CRITICAL severity, independently reconfirmed twice (b2-journey 2026-06-18,
david-innovation-studio intern session 2026-07-14). The core gap: `scripts/post-write`'s
freshness triple never calls `navigation.cjs`, so room.db's typed-node/edge graph never
populates from normal conversational filing - confirmed still true as of this session
(grepped directly, zero `navigation.cjs` references in `scripts/post-write`). Depends on
Phases 210-217, 218, 222, 223 as a RESEARCH requirement (not a strict block - full
per-phase rationale is written into this phase's own ROADMAP.md entry, read it before
starting spec-phase).

**Phases 225-228 - REGISTERED ONLY, nothing planned yet.** Each depends on Phases 210-224
as a research requirement, tailored rationale in each phase's own ROADMAP.md entry:
- **225 = SEED-039** (per-session room binding + multi-session reconciliation). Shares
  the resolver-fragmentation failure site with Phase 224 - research 224's actual
  implementation once it exists, not just its SPEC, since the two fixes may compose or
  may collide if designed independently.
- **226 = SEED-058** (eureka reasoning-mode fallback - give `/mos:eureka` a labeled
  `mode:reasoning` path when the embedding index or graph substrate is unavailable,
  instead of a hard `pairs_scored:0` stop). Research against Phases 211-216's actual
  output shape and Phase 212's Grounding Guard critic specifically, so a lower-confidence
  fallback result isn't trusted the same as an embedded-mode one. Explicitly an
  ALTERNATIVE to Phase 224 for clearing SEED-057's own trigger gate (either one clears
  it) - do not treat 226 as blocked on 224 finishing.
- **227 = SEED-060** (ignite / mode-select timing across turns 1-4). Connects two
  pre-existing RCAs: `.planning/debug/resolved/intern-w1-mode-gate-skip.md` (resolved
  for detection, but its own candidate fix #3, a code-level firing checkpoint for the
  Turn-1 lane pick, is still open) and `.planning/debug/ignite-frontdoor-bypassed-
  methodology-overfire.md` (partially-fixed, 4 items still open in that file). Research
  against Phase 210 (a caution against repeating its over-enforcement mistake) and
  Phase 223 (ignite is the front door that would route into 223's surfaces once they
  exist). Also read SEED-059's "Worked example: Site 4 closed" entry (2026-07-15, quick
  260715-cu8) as a live precedent for what a disclosed-fallback fix looks like here.
- **228 = SEED-030** (RS pipeline vector-repoint + expert-graph reconciliation) - NOTE:
  this phase's real scope is NARROWER than SEED-030's own file states. Verified this
  session: the seed's Requirement 1 (spine-wire the RS family onto the connector spine)
  is ALREADY DONE - all 4 `rs-*` commands carry `connects_to_spine`/`reach_id`/
  `sensor_triggers` and appear in `data/connector-registry.json`, contradicting the
  seed's own 2026-06-17 evidence. SEED-030's file has a `staleness_note` documenting
  this. Phase 228 covers only the seed's Requirements 2-3 (repoint RS's vector modes off
  Pinecone onto the local Embedding Layer, per Phase 211's own local room.db vector
  pattern as precedent; lock the R-expert Aura/Brain-Cypher decision for `rs-experts`).

**Also registered and broadened this week, not yet phased, feeds the above:**
- SEED-056 (Larry behavior contract) now carries a full 110-command persona-coverage
  audit (30 covered / 58 partial / 22 dark, all dark correctly excluded). Structural
  finding: eureka/ignite are one instance of a repeating "sibling-of-a-named-command"
  pattern across 4 command families (Reverse Salient, Six Hats, Grade, Opportunity-
  harvest). Also found: ignite is named once, only in `conversation-mode.md`, never in
  `larry-personality.md`, and `conversation-mode.md`'s own Mode 3 still points to
  `/mos:new-project` directly even though `ignite.md` says it's now the canonical front
  door. Fix this alongside Phase 227 (SEED-060), same underlying surface. SEED-056 is
  NOT yet in the 224-228 pipeline - pick it up separately when the persona-contract
  update becomes the priority.
- SEED-059 (fallback-disclosure-convention) - the consolidated RCA it's built on now
  spans SIX intern QA sessions (not three), with two new failure sites found (persona/
  voice discipline dropping under load; total non-engagement with declared machinery).
  One instance closed (`quick-260715-cu8`). Whether this graduates from documentation
  to a real implementation ask is still explicitly undecided - still a navigator call.
- SEED-057 (synthesis-as-votable-expert) - now half-unblocked: Phase 222 (its first gate
  condition) shipped. Still needs at least one of Phase 224 or Phase 226 to ship before
  its own trigger clears (either one satisfies the "eureka engine reliability" half of
  its gate). Do not start building SEED-057 until that clears - it is not in this
  handoff's pipeline for that reason.

===============================================================================
GROUNDING NOTES (carried forward, still accurate)
===============================================================================

- A concurrent/parallel session has been active across this and the prior session,
  making real commits (quick-260714-*, quick-260715-* task IDs visible in git log).
  git fetch origin main and git log before doing anything.
- GSD discipline: spec -> discuss -> plan -> execute, with deliberate stops before
  auto-advancing into execute-phase without an explicit human checkpoint, even when a
  workflow's own --auto semantics would otherwise chain straight through automatically.
  This discipline is what let Phase 222's OQ-1 (weight-state persistence shape) get a
  real navigator decision instead of silently taking the researcher's recommendation -
  keep doing this for 224-228's own open questions as they surface.
- .planning/ is gitignored repo-wide; every file in it that needs a commit needs
  git add -f.
- Current version at handoff time: 1.15.3-beta.19 (package.json) - RE-CHECK, this has
  likely moved given ongoing concurrent activity.
- Release: scripts/release.sh <version>, the five-gate lockstep (CHANGELOG.md,
  .claude-plugin/plugin.json, package.json, git tag, marketplace.json ref-pin). Never
  bump by hand. Confirm node scripts/doctor.cjs --acceptance is green (or only
  already-documented gaps) before cutting - do this only after 224-228 are in a good
  state, per the goal statement above.

===============================================================================
SUGGESTED FIRST COMMAND FOR THE NEW SESSION
===============================================================================

/gsd-spec-phase 224

(then work down the pipeline: 225, 226, 227, 228, in whatever order the navigator
confirms once 224 is underway and its actual shape is known - the other three's
research requirements point back at 224's real implementation in a few places, so
having 224 at least spec'd/planned first will sharpen the other three's research too.)
