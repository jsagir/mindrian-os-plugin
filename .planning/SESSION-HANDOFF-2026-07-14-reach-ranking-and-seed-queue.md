SESSION HANDOFF - 2026-07-14
Workspace: /home/jsagi/dev/MindrianOS-Plugin (NEVER the plugin cache)
Prior session ended at commit d760b899 (a concurrent session was still committing past
that point - fetch and check log before starting, do not assume d760b899 is HEAD)

===============================================================================
GOAL STATEMENT
===============================================================================

Finish Phase 222 completely first (plan through execute through verify). Only after
222 is shipped, work through the seed queue this session filed and prioritized. Once
the queue is in a good state, cut a version release. Do not skip ahead to seed work
or a release while 222 is still open - it is the dependency root for several of the
filed seeds and the whole session treated it as the priority thread.

===============================================================================
STEP 1 - FINISH PHASE 222 (reach-ranking-unification-replace-the-three-disagreeing-what)
===============================================================================

Where it stands: SPEC.md locked (7 requirements, ambiguity 0.13, gate cleared),
CONTEXT.md synced to match, RESEARCH.md complete at HIGH confidence
(.planning/phases/222-reach-ranking-unification-replace-the-three-disagreeing-what/).
/gsd-plan-phase 222 was running - research finished, the one blocking open question
(OQ-1, weight-state persistence shape) was resolved at an AskUserQuestion gate: the
navigator explicitly chose a REAL room.db table (via a new
lib/core/migrations/phase-222-*.cjs migration, sentinel-idempotent CREATE TABLE
pattern mirroring lib/core/migrations/phase-109-session-focus.cjs, registered in
lib/core/room-db.cjs) over the researcher's memory_event-rows recommendation. This is
already written into CONTEXT.md's D-02, SPEC.md Requirement 3, and RESEARCH.md's OQ-1
resolution note. Do not re-litigate this choice; it was deliberate and is grounded.

Next actions in order:
1. Run /gsd-plan-phase 222 to completion - the gsd-planner spawn was the next step
   when this session ended (research done, planner not yet spawned). This will loop
   through gsd-plan-checker until PLAN.md files pass.
2. Two remaining open questions from RESEARCH.md have recommended defaults but were
   NOT explicitly confirmed by the navigator (lower stakes than OQ-1, use judgment or
   ask if genuinely unsure): OQ-2 (compose Phase 158's reject penalty into the D4
   expert, recommended, vs. superseding it) and OQ-3 (the ranker calls
   buildReachScoresFromCortex itself rather than depending on caller-supplied
   roomState, recommended, keeps it caller-order-independent).
3. /gsd-execute-phase 222 once plans exist and pass the checker.
4. Verify: bash tests/run-all-222.sh must exit PASS 0 FAIL 0 SKIP. Confirm the 7
   requirements' acceptance criteria in SPEC.md all hold, especially Requirement 6
   (reachability via REAL decide() and REAL MCP tool registration, not bypassed
   internal calls - this codebase has a known dead-sensor failure class, Phase 150.5,
   don't let 222 repeat it) and Requirement 7 (a corrupted/missing weight table must
   degrade to D4-alone and emit reach_weight_state_unavailable, never crash, never
   silently rank wrong).
5. Composite the research trail to ~/MindrianRooms/rethinking-mindrianos/research/ per
   this repo's own CLAUDE.md Dev-Research Compositing mandate - the game-theory-
   toolbox thread already has one entry there
   (research/2026-07-14-reach-ranking-game-theory-toolbox/); Phase 222's actual
   execution outcome should get its own follow-up entry or an update to that one.

===============================================================================
STEP 2 - WORK THE SEED QUEUE (only after 222 ships)
===============================================================================

This session ran a full seed-corpus curation pass and filed/amended several seeds.
Priority order, highest first, per that pass's own scoring (current-thread relevancy
+ trigger proximity + blast-radius):

1. SEED-058 (eureka-reasoning-mode-fallback) - HIGH severity. Gates SEED-057.
   A parallel session was already making live fixes toward this during this session
   (commits like "fix(eureka): freshness gate was blind to..." - check current state,
   may already be partially or fully addressed).
2. SEED-034 (graph-derivation-harness) - CRITICAL severity, independently re-broken
   this session via a second, unrelated path (scripts/post-write never calls
   navigation.cjs on normal conversational filing). Same caveat - a parallel session
   was actively working this thread too, check current state before assuming open.
3. SEED-057 (synthesis-as-votable-expert-graph-native-game-theory) - self-gated on
   222 shipping AND at least SEED-058 shipping. Do not start building this until both
   gates clear. Contains a real, citable decision rule (Weitzman's Pandora's Box,
   nonobligatory-inspection variant) if/when it's picked up - read the seed file in
   full, do not re-derive the algorithm.
4. SEED-056 (Larry behavior contract) - broadened this session to cover the eureka
   engine (211-216) and a Shape-F/brain_consult reconciliation pass, in addition to
   its original 219/220/221 scope. Explicit gap confirmed: skills/larry-personality/
   SKILL.md (448 lines) names none of these engines anywhere.
5. SEED-060 (ignite/mode-select timing, turns 1-4) - connects two pre-existing RCAs
   (.planning/debug/resolved/intern-w1-mode-gate-skip.md, resolved for detection but
   still needs a code-level firing checkpoint; .planning/debug/
   ignite-frontdoor-bypassed-methodology-overfire.md, partially-fixed, 4 items still
   open in that file) to this week's interns-tracker evidence, through the
   hooked-model skill's Trigger/Action/Variable-Reward/Investment lens. Read the seed
   file for the full synthesis before starting.
6. SEED-059 (fallback-disclosure-convention) - no corpus gate. Surfaces naturally at
   next milestone scoping, or immediately if a fourth independent QA incident of the
   same shape (gate silently skips, or a tool reports false success) shows up.
   Explicitly NOT the 1.15 over-enforcement watch (opposite direction).
7. SEED-035 (synthetic-expert-as-project-skill) and SEED-055 (eureka dual-surface) -
   both pulled forward to "ready" status this session (every stated dependency
   confirmed shipped, zero implementation started on either). Cheapest real wins in
   the corpus if there's a gap to fill between the higher-priority items above.

Housekeeping, lower priority but real: SEED-013's status field was corrected (it
falsely claimed "graduated," reverted to "open" - Phase 134 is 0/9 plans executed,
still genuinely open work if anyone picks it up). SEED-005 is a phantom reference
(no file exists, still pointed at by INDEX.md and SEED-004) - not fixed, just
flagged. SEED-020 and SEED-054 both have unresolved two-file numbering collisions -
not fixed, just flagged, same class as the SEED-003 collision this repo already
resolved once (see INDEX.md's own "Collision resolution" section for the precedent
to follow if picked up).

===============================================================================
STEP 3 - CUT A VERSION RELEASE (only after 222 ships and the seed queue is settled)
===============================================================================

Current version at session end: 1.15.3-beta.19 (package.json) - RE-CHECK this at
handoff time, a concurrent session was actively committing throughout this session
and may have moved it.

Use scripts/release.sh <version> for the five-gate lockstep (CHANGELOG.md,
.claude-plugin/plugin.json, package.json, git tag, and
~/mindrian-marketplace/.claude-plugin/marketplace.json ref-pin). Never bump versions
by hand. Confirm node scripts/doctor.cjs --acceptance is green (or has only known,
already-documented gaps) before cutting.

===============================================================================
GROUNDING NOTES FOR THE NEW SESSION
===============================================================================

- A concurrent/parallel Claude Code session was active throughout the prior session,
  making its own real commits (quick-260714-* task IDs visible in git log) toward
  SEED-034/058-adjacent eureka fixes and other unrelated work. Run git fetch origin
  main and git log before doing anything, to see the true current state rather than
  trusting this document's snapshot.
- GSD discipline used throughout: spec-phase -> discuss-phase -> plan-phase ->
  execute-phase, with deliberate stops before auto-advancing into execute-phase
  without an explicit checkpoint, even when a workflow's own --auto semantics would
  otherwise chain straight through. Keep that discipline - do not let a phase
  silently cascade into shipped code without a human seeing the plan first.
- .planning/ is gitignored repo-wide; every file in it that needs to be committed
  requires git add -f (confirmed working pattern used throughout this session,
  matches this repo's own CLAUDE.md QA-reporting note about the same gitignore
  behavior for .planning/debug/).
- Phase 223 (jtbd-driven-intelligence-pipeline-governed-double-fan-bono) was also
  registered and spec'd this session (SPEC.md ambiguity 0.24, gate NOT cleared,
  Constraint Clarity flagged below minimum because the brief's cited source
  directory ~/mindrian-designs/ does not exist on this machine - Requirement 6 in
  that SPEC locks a fallback: draft the missing prose from the SPEC itself). This is
  a SEPARATE, lower-priority thread from the goal statement above - not mentioned in
  Steps 1-3 because the navigator did not include it in this handoff's stated
  priority, but it exists and is real work if/when picked up.
  (.planning/phases/223-jtbd-driven-intelligence-pipeline-governed-double-fan-bono-e/)

===============================================================================
ADDENDUM - comprehensive Larry-persona-coverage audit (landed same session, folded
into SEED-056, supersedes the "in flight" note this document originally shipped with)
===============================================================================

Navigator asked, after the seed queue above was already prioritized: "make sure the
larry personality knows all major and minor workflows to understand when to invoke."
A full audit ran (all 110 commands/*.md, cross-checked against
data/connector-registry.json and the 5 skills that shape Larry's behavior) and its
findings are now written into SEED-056
(.planning/seeds/SEED-056-larry-behavior-contract-intelligence-engine-reach.md,
section "The comprehensive audit"). Read that section before starting SEED-056 -
this is now a much bigger, better-scoped piece of work than the original
eureka-only finding.

Headline result: 30 COVERED / 58 PARTIALLY COVERED / 22 DARK (DARK is all
correctly-excluded utility surfaces, none high-impact - do not spend time there).
The real structural finding: eureka and ignite are ONE instance of a repeating
"sibling-of-a-named-command" pattern - a command family shares one reach_id, one
member gets named in Larry's persona prose, its siblings riding the exact same
reach stay invisible. Four families confirmed: Reverse Salient (find-bottlenecks
named, rs-experts/rs-explain/rs-thesis/rs-fetch unnamed), Six Hats
(think-hats/persona named, bono/hat-briefing unnamed), Grade (grade named,
deep-grade unnamed), Opportunity-harvest (opportunities named,
qualify-opportunity/explore-opportunity unnamed - a genuinely DIFFERENT capability,
not just an unnamed synonym). Also found: ignite is named once, but only in
conversation-mode.md, never in larry-personality.md - and conversation-mode's own
Mode 3 still points to /mos:new-project directly even though ignite.md itself says
it is now the canonical front door. Fix that alongside SEED-060, same surface.

This changes Step 2's priority list above: when SEED-056 is picked up, use the
audit's full prioritized list (in the seed file) rather than just the original
eureka/219/220/221 scope - the sibling-family pattern is the higher-leverage fix
(naming a whole family at once) versus patching one command at a time.
