# Phase 210 - Revert Persona-Enforcement Over-Reach

> Slug: revert-persona-enforcement-over-reach | Class: CODE | Priority: P0 | Registered 2026-07-02 (navigator-directed)
> House rule: no em-dashes, hyphens only. Feynman-simplified, JTBD-oriented.

## Depends on

Phase 190 (Shape F declaration mandate - build-fails-if-shape-not-rendered), Phase 192 (Shape-F selector completion - locked voice-glyph mapping + stance-toggle footer), Phase 202 (Agent-Lightning APO lab - voice-contract disqualifier), Phase 205 (Larry Loop Elevation - elevation-taxonomy canon-governed decision tree), Phase 209 (Shape-F Native Fire - "declared implies rendered" force-fire). All five are COMPLETE and shipped (v1.15.0-beta.x through v1.15.2). This phase does NOT undo their capability entirely -- it targets the specific HARD-FAIL/BINDING/no-override mechanisms each one added, while preserving the underlying feature (glyphs still exist as style, elevation still exists as a lens, render-coverage still exists as a lint signal).

Related, already-fixed-but-uncommitted-at-phase-start: `reach-gate-stale-turn-input` (RCA at `.planning/debug/reach-gate-stale-turn-input.md`, status awaiting_human_verify). Separate root cause (the routing seed never included the current turn, so decide() ran on stale persisted history) -- NOT part of this phase's scope, but explains a chunk of the same symptom cluster (the byte-identical stale-artifact F.1 gate that fired all session). Fix already implemented + tested (`tests/test-reach-gate-stale-turn-input.cjs` PASS) at phase-210 kickoff; committed as its own atomic fix ahead of this phase's work.

## Goal

Restore Larry's conversational judgment -- when to fire a Decision Gate card, when to elevate, when a voice/glyph choice is "correct enough" -- by finding every place the v1.15 window turned a judgment call into a mechanical HARD-FAIL/BINDING check, and softening JUST that check to advisory/gated-by-relevance, without deleting the capability it sits on top of.

## Grounding (why this phase exists)

Navigator-reported regression, 2026-07-02: "i have a big big feeling that version 1.15.beta X AND THE VERSION 1.15.0 BEHIVES LESS LIKE LARRY". Root-caused across the same session via:

1. Commit-date correlation: every phase that turned a Larry-voice behavior into a HARD-FAIL/BINDING compliance check landed inside the v1.15 window (2026-06-24 through 2026-07-02), none before it.
2. Forked-agent commit-by-commit classification of the full `v1.15.0-beta.13..v1.15.2` range (366 commits): ~32% (116 commits) is persona/voice enforcement machinery concentrated in Phases 190/192/202/205/209; ~13% (46 commits) is a DIFFERENT enforcement flavor (Phases 194/196/200, data-boundary/write-scope integrity) that must NOT be touched; ~30% (111 commits) is persona-neutral new capability (Phases 188/189/191/195/199/201/203/204) that must NOT be touched; 19 commits are narrow bug fixes that must NOT be lost.
3. Live proof-of-mechanism during the SAME session: the Stop hook (`scripts/check-card-fire.cjs`, the `ascii-box-backstop-no-card` check) force-blocked multiple turns demanding an AskUserQuestion card fire, including once on a turn where the navigator had ALREADY answered "yes" in plain text to the immediately preceding question. The engine cannot currently distinguish "a genuine unanswered fork" from "a follow-up already answered."
4. Full evidence trail, all instances, is logged in local session memory `feedback_1_15_enforcement_regression_watch.md` (outside the repo, `~/.claude/projects/-home-jsagi/memory/`) -- read it for the complete instance-by-instance record before starting research, it is the authoritative source of what was actually observed, not a summary of it.

## Scope: the five enforcement mechanisms to soften

### (A) Phase 190 -- born-declared-shape HARD gate
`scripts/check-shape-declaration.cjs` (or equivalent per Canon Part 11 R16) fails pre-commit/release.sh/doctor --acceptance if a declared `hitl_shape`/`body_shape` isn't actually rendered. RELAX to advisory (warn, don't block) UNLESS the research agent finds evidence this is load-bearing for something Phase 194/196/200 depend on -- flag, don't silently downgrade if so.

### (B) Phase 192 -- locked voice-glyph mapping + mandatory stance-toggle footer
Find where the glyph-to-move mapping became LOCKED (no override) and where a footer became MANDATORY on every turn regardless of fit. Soften to: glyph stays the default/recommended choice, but is not enforced as a hard contract violation if a turn's shape genuinely doesn't fit one of the five; footer becomes conditional on genuine relevance, not universal.

### (C) Phase 202 -- voice-contract disqualifier in the APO loop
Find the disqualifier logic that can veto/fail a response purely for not "performing Larry" correctly (independent of whether the content was right). Remove the veto power; keep it as a signal/score, not a gate.

### (D) Phase 205 -- elevation-taxonomy canon-governed decision tree
Find where the three elevation types (vertical/horizontal/lateral) went from "Larry's judgment, guided by the taxonomy" to "a decision tree Larry must mechanically follow." Restore it to a lens/reference, not a required procedure.

### (E) Phase 209 -- Shape-F Native Fire force-fire ("declared implies rendered")
The big one. `scripts/check-card-fire.cjs` (the Stop hook) and the "mos:firing-block" stamps injected into 95 commands (commit `b21eafa0`) currently say: if a card trailer appears in context, firing it is BINDING, no relevance/confidence check, no exception for "the user already answered this in plain text." Add a relevance/confidence gate in front of the force-fire: the backstop should NOT block when (a) the preceding user turn already plainly answered the question the gate would ask, or (b) the gate's subject-matter has zero connection to the current conversation (the stale-artifact pattern). This was the ORIGINAL first-choice recommendation offered to the navigator before the fuller diff existed -- it is still the right shape for this piece specifically, even though the navigator ultimately chose to also scope in 190/192/202/205.

Known artifacts already identified this session (starting points, not the full list -- confirm via research, do not assume completeness):
- `commands/mos.md`, `commands/help.md` -- carry the "mos:firing-block v1" stamp with the "never reproduce the selector as text" language (commit `b21eafa0`, 95 commands total got this stamp -- enumerate all 95, do not hand-pick a subset).
- `scripts/check-card-fire.cjs` -- the Stop hook backstop (`ascii-box-backstop-no-card`), carries MAX_FORCE_RETRIES=3 and MAX_SESSION_INTERCEPTS=12 constants per the 209-07 SUMMARY -- these caps already exist; the gap is WHEN it fires, not how many times.

## Explicit preserve list (do NOT touch)

- Phase 194 (per-session-room-binding write-scope gate), Phase 196 (Part-8 Brain-egress PreToolUse guardrail), Phase 200 (Reverse-Salient semantic-floor gate) -- data-boundary/security, not persona.
- Phase 188 (Shape-F elevation labels + F.9 cascade gate), 189 (governance-candidate workflow), 191 (F.7 dial), 195 (DRIFT memory kind), 199 (AgentShield CVE scanner), 201 (harness-as-code), 203 (SyntheticExpert materialization), 204 (Ignite room-chooser onboarding) -- real capability, persona-neutral.
- All 19 standalone bug fixes in the `v1.15.0-beta.13..v1.15.2` range (PII leaks, version-compare ordering, YAML syntax breaks, SQLite rebuild fix, etc.) -- already living on HEAD, just don't regress them.
- The underlying CAPABILITIES of 190/192/202/205/209 (declared-shape tracking, the glyph vocabulary itself, the elevation taxonomy as a concept, the AskUserQuestion primitive itself) -- only the MANDATORY/HARD-FAIL/no-override property of each is in scope to soften.

## Constraints

- No em-dashes. CJS only. Canon Part 8 (no user data to Brain) untouched by this phase -- it's not persona machinery.
- Every softened gate needs a regression test proving BOTH directions: (1) a genuine, relevant, unanswered fork still fires the card (the backstop still catches REAL misses -- this phase must not turn the gate off entirely, that would be Phase 209's own regression in reverse); (2) an irrelevant/already-answered gate no longer force-blocks.
- Run the phase's own `tests/run-all-210.sh` (create it, mirroring `run-all-209.sh`/`run-all-205.sh` pattern) plus `node scripts/doctor.cjs --acceptance` before calling this phase done.
- Release at the end: version bump (new version number, NOT a reuse of 1.15.0-beta.13 or any existing published version), `scripts/release.sh <version>` for the full 5-gate lockstep including the real `npm publish` to `@mindrian_os/cli`.

## Open questions resolved (post-research, 2026-07-03)

RESEARCH.md flagged three scope ambiguities; navigator confirmed all three recommended paths:

1. **Item A scope:** `scripts/check-shape-declaration.cjs` carries the original Phase 190 "declaration exists" check PLUS three stricter predicates (`wired-body`, `tool-grant`, `declared-matches-body`) added later by Phase 209-03 in the same file. CONTEXT.md's "declared implies rendered" language describes the 209-03 addition, not just the 190 original. DECISION: soften all four checks to advisory (190 base + all three 209-03 predicates) -- they are the same mechanism the navigator is complaining about.
2. **Item C effort:** the Phase 202 voice-contract disqualifier (`lab/apo/apo-loop.cjs` + `voice-contract-gate.cjs`) runs only inside an offline, human-triggered prompt-optimization tool -- zero live-conversation code path, cannot be causing the reported regression. DECISION: still include as one small task (strip veto power, keep as score/signal) but do NOT give it a full plan wave -- low priority, not user-facing.
3. **Item D target:** no clean match for "decision tree Larry must mechanically follow" in the elevation-taxonomy code itself (`persona-taxonomy.cjs` is already documented in its own comments as a soft bias, not a quota). Best candidate: `lib/core/fusion-router.cjs::sessionEndQuorum`, which mechanically force-picks exactly one hypothesis whenever 2+ Frame nodes are open. DECISION: target `sessionEndQuorum` as item D -- relax the force-pick to a suggestion/default, not a hard requirement.

## Provenance

Navigator-directed 2026-07-02, full session context in local memory `feedback_1_15_enforcement_regression_watch.md`. Navigator instruction for execution: "use fable to research plan and execute and publish" -- research + planning agents run on the `fable` model per navigator's explicit request.
