---
status: resolved
kind: rca
trigger: "intern-w1-mode-gate-skip"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: tier-0
canon_parts: [3, 11]
created: 2026-07-11T00:00:00Z
updated: 2026-07-11T01:15:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

status: RESOLVED. Human-verify checkpoint confirmed 2026-07-11: "confirmed fixed, accept the gap-3 revert-and-document approach, don't extend scope now" (Jonathan, via coordinator). Fix applied to gaps 1 (build-render-coverage.cjs skill keyspace) and 2 (check-shape-declaration.cjs contradiction predicate) in full; gap 3's specific instance (conversation-mode's connector.excluded:true) could NOT be safely removed as literally instructed -- discovered it hard-fails the SEPARATE build-connector-registry.cjs R1 ledger; reverted to original with documentation, relying on gap-2's advisory WARN as the closest safe signal -- ACCEPTED as-is by the user, no scope extension. check-card-fire.cjs untouched throughout (explicit constraint, honored). next_action: none -- archiving to resolved/, committing to this worktree branch (worktree-agent-a1c26e37f50b7d9c5), NOT merging to main (a concurrent session is refactoring main; hold for sequencing per coordinator instruction).

reasoning_checkpoint:
  hypothesis: "The session-start mode-selection Decision Gate is invisible to enforcement because of three converging structural gaps: (1) build-render-coverage.cjs::buildMdKeyspace() only scans commands/*.md, so a skill-declared hitl_shape surface (skills/conversation-mode/SKILL.md, hitl_shape F.1) can never register in data/render-coverage-registry.json; (2) check-shape-declaration.cjs's excludedOk guard treats connector.excluded:true+reason as an unconditional exemption even when hasShape is also true, so a self-contradictory skill (both a real fork AND a no-fork exemption) passes CI silently, inverting this repo's own Part 11 doctrine; (3) conversation-mode/SKILL.md itself carries this exact contradiction (hitl_shape:'F.1'+hitl_why AND connector.excluded:true+reason at once), so it both fails to register (gap 1) and evades the CI tripwire that would otherwise have caught it (gap 2)."
  confirming_evidence:
    - "data/render-coverage-registry.json (113 entries, read directly) has zero entries referencing 'conversation-mode' or any skills/* path; buildMdKeyspace() source (scripts/build-render-coverage.cjs:309-320) reads only fs.readdirSync(path.join(rootDir,'commands')), never walks skills/."
    - "skills/conversation-mode/SKILL.md frontmatter (lines 8-13) declares connector: {excluded:true, reason:'...'} AND hitl_shape:'F.1' + hitl_why simultaneously (direct read); check-shape-declaration.cjs's excludedOk (lines 259-263) computes true whenever connector_excluded===true + non-empty connector_reason, and predicates 7-9 (lines 265-302) are gated on `if (hasShape && !excludedOk)`, so hasShape===true never trips a violation when excludedOk is also true -- no predicate anywhere in the file flags the hasShape+excluded CO-OCCURRENCE itself as the violation (confirmed by reading the full predicate list, no such check exists)."
  falsification_test: "If, after extending the registry walk to skills/*/SKILL.md, conversation-mode's SKILL.md entry does NOT appear in the rebuilt registry with declared_shape:'F.1', the hypothesis is wrong. If, after adding the hasShape+excluded contradiction predicate to check-shape-declaration.cjs, running --check against the CURRENT (pre-task-c) live tree does NOT report a violation for skills/conversation-mode/SKILL.md, the hypothesis is wrong."
  fix_rationale: "The fix targets the root-cause layers directly, not the single missed-card symptom: (a) extending the registry walk to skills/*/SKILL.md makes PRIMARY detection structurally possible for every future skill-declared gate, not just this one instance; (b) the contradiction predicate is a doctrine-level CI tripwire (Canon Part 11 / this repo's own CLAUDE.md: 'a render-only or pure-capability skill is exempt via its existing connector.excluded:true + reason, never via a fork it does not have') that will catch this exact self-contradiction pattern on ANY future skill, not a one-off patch; (c) resolving conversation-mode's own declaration (drop the false connector.excluded:true, keep hitl_shape since the fork is genuine per the intern's report and the skill body's own AskUserQuestion instruction) removes the specific instance the new predicate would now flag. None of these touch check-card-fire.cjs (explicitly out of scope; a sibling worktree, card-discipline-decay, is editing that file concurrently) -- the runtime BACKSTOP catch for a still-possible future silent skip is intentionally left as a candidate for a later phase, per the debug file's own Required Code Changes list (item 3, a session-start code-level firing checkpoint)."
  blind_spots: "Have not manually audited every OTHER skills/*/SKILL.md for the same hasShape+excluded co-occurrence pattern before running the checker -- relying on the new --check (advisory, WARN-only per Phase 210 unless --strict) to surface any other victims automatically rather than a manual grep-first pass. Have not traced how check-card-fire.cjs's `ran_entries` gets populated at runtime, so I cannot fully confirm that a live silent skip would now be CAUGHT end-to-end by the PRIMARY signal even after the registry carries the skill entry (gateReachingEntries() filters on e.render_coverage==='card-emission' && typeof e.entry==='string', a SHAPE the .md/.skill keyspace entries do NOT carry -- they use surface/declared_shape/wired instead). This fix closes the STRUCTURAL registration gap (1) and the CI doctrine gap (2)/(3); it does NOT by itself add a new deterministic runtime catch for gap 3's 'zero gate-shaped text' backstop miss, which is explicitly out of scope (check-card-fire.cjs untouched) and remains future work."

hypothesis: CONFIRMED. The session-start mode-selection gate (`skills/conversation-mode/SKILL.md`, hitl_shape "F.1") is enforced purely by prose instruction, with three converging structural gaps that make a fully-silent skip undetectable by any backstop: (1) `scripts/build-render-coverage.cjs::buildMdKeyspace()` walks ONLY `commands/*.md`, never `skills/*/SKILL.md`, so this gate can never appear as a `card-emission` entry in `data/render-coverage-registry.json` -- PRIMARY detection in `check-card-fire.cjs` is structurally blind to it. (2) `skills/conversation-mode/SKILL.md` self-declares BOTH `hitl_shape: "F.1"` + `hitl_why` (a genuine Decision-Gate fork) AND `connector.excluded: true` (the CIRS "no-fork ambient infra" exemption) -- `scripts/check-shape-declaration.cjs`'s `excludedOk` guard (line 278-284) skips the wired-body/tool-grant/declared-matches-body verification (predicates 7-9) whenever `connector.excluded:true`+reason is present, REGARDLESS of `hasShape` also being true, so CI never verifies this self-declared fork's body actually renders a card. This directly contradicts the project's own Part 11 doctrine ("a render-only or pure-capability skill is exempt via connector.excluded:true + reason, never via a fork it does not have") -- conversation-mode explicitly HAS a fork yet is exempted as if it does not. (3) `check-card-fire.cjs`'s Stop-hook BACKSTOP (the only remaining catch mechanism) fires only on assistant-turn output TEXT that structurally resembles a rendered gate (ASCII-box glyphs / framed numbered-prose). A fully silent skip -- Larry proceeding straight into ordinary conversation text with zero attempted gate rendering -- produces neither, so `computeBackstopHit()` is false, `primaryHit` is false (per #1), and `classifyCardFire()` hits its first branch (`!primaryHit && !backstopHit` -> `{intercept:false, reason:'no-gate-signal'}`) -- an ordinary, unremarkable turn as far as the hook is concerned.
test: (a) confirmed the Stop hook fires after EVERY assistant turn (no turn-1 exemption) via check-card-fire.cjs header comments + knowledge-base cross-reference -- ELIMINATES the "turn-threshold" half of the original hypothesis. (b) read `data/render-coverage-registry.json` directly -- zero entries reference conversation-mode or any skill; confirmed via `scripts/build-render-coverage.cjs::buildMdKeyspace()` source that it only scans `commands/*.md`. (c) read `scripts/check-shape-declaration.cjs` predicates 5 and 7-9 -- confirmed `excludedOk` (hasShape AND connector.excluded:true+reason) short-circuits the wired-body check with no contradiction predicate anywhere in the file catching "hasShape but also excluded". (d) traced `classifyCardFire()` in `check-card-fire.cjs` -- confirmed the `!primaryHit && !backstopHit` early-return path and that BACKSTOP requires literal gate-shaped text in `output_text`.
expecting: CONFIRMED -- root cause is (b) not (a): the mode-selection instruction is delivered as pure prose (skill markdown) with no structural gate; a silent no-op is invisible to both PRIMARY (never registered, skills aren't scanned) and BACKSTOP (no text to pattern-match) detection.
next_action: none -- diagnose-only session complete. Handing root cause to caller; no fix applied (goal: find_root_cause_only).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version observed: v1.15.3-beta.10 (intern's session)
- Target version: v1.15.3-beta.13 (current in-progress cut per CHANGELOG.md `[Unreleased]` header at time of filing)
- Reported by: Intern-1 (pseudonym), JHU intern QA program, via Larry's own Part B self-QA
- Date first observed: 2026-07-11 (report date; underlying session earlier same week)
- Related debug sessions: `.planning/debug/intern-qa-week1-bug-sweep.md` (Row A, the sweep this was split from), `.planning/debug/intern-w1-card-discipline-decay.md` (sibling - same failure class, mid-session instead of session-start)

## Problem Statement

The session-start mode-selection Decision Gate (Just Talk / Explore+Capture / Build a Room) was skipped entirely in a live session - no card fired, no default stated out loud - and unlike two other missed-card forks in the same session, the stop-hook backstop did not catch or re-fire it.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: at session start, Larry either fires an AskUserQuestion card for the Just Talk / Explore+Capture / Build a Room gate, or explicitly states the default mode chosen and why.
actual: Larry proceeded directly into the conversation with no card and no stated default. Larry's own self-QA: "I skipped it entirely. The user's first message implied Mode 1, so I defaulted silently."
errors: none (silent skip, no error surfaced)
reproduction:
  1. Start a fresh Larry session on v1.15.3-beta.10/12/13 with an opening message that plausibly implies a mode (e.g. a direct question rather than a blank "hi").
  2. Observe whether an AskUserQuestion mode-selection card fires, or whether a default is silently assumed with no card and no stated rationale.
  3. Compare against the stop-hook's behavior on a separate mid-conversation missed card in the same session (see intern-w1-card-discipline-decay.md) to confirm the backstop fires there but not here.
started: observed 2026-07-11 report; unclear if pre-existing since beta.10 or newly introduced - not yet bisected.

## Scope and Impact

- Affected surfaces: cli (confirmed); desktop/cowork not yet verified
- Affected commands: session-start mode-selection gate (mos:conversation-mode skill area); `scripts/check-card-fire.cjs` backstop
- Affected users: all installs, every fresh session start
- Version range: at least beta.10 through beta.13 (unconfirmed upper bound, no fix has landed for this specific gate per CHANGELOG review)
- Severity: medium (silent degradation, no error surfaced, but violates the "GUIDED default: one suggest line, end at the gate" contract for a first-turn gate)
- Blast radius: any first-turn interaction; potentially the same root cause as the mid-session card misses in intern-w1-card-discipline-decay.md if the backstop's turn-1 handling is the shared cause

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: the stop-hook backstop only evaluates output after some turn threshold (missing turn 1 / session-start specifically).
  evidence: `scripts/check-card-fire.cjs` is a Stop-hook-class turn-scan (header comment, line 7: "A Stop-hook-class turn-scan that moves card-fire enforcement BELOW the agent") that runs on every Stop event with no turn-index gating anywhere in `classifyCardFire()` or `main()`; knowledge-base.md's `memory-lifecycle` entry independently confirms "Claude Code's Stop hook fires after EVERY assistant turn". Turn 1 is evaluated identically to any other turn.
  timestamp: 2026-07-11T00:05:00Z

- hypothesis: this session-start skip shares the exact same root cause as the sibling mid-session miss (`intern-w1-card-discipline-decay.md`), so one fix would resolve both.
  evidence: the sibling's working hypothesis is a `GATE_FRAMING_RE` regex under-match -- the BACKSTOP DOES have gate-shaped text to evaluate in that case (flat-prose "X vs Y" forks were rendered) but the cue-word list fails to recognize implicit forced-choice framing. THIS case has no gate-shaped text at all (a fully silent skip) AND the surface is structurally absent from the render-coverage-registry (skills are never scanned by `buildMdKeyspace()`), so PRIMARY detection is impossible regardless of side-channel wiring. Two independent gaps in the same enforcement family, not one shared defect -- confirmed via direct code read of `scripts/check-card-fire.cjs` (BACKSTOP regex scope) and `scripts/build-render-coverage.cjs` (registry scan scope).
  timestamp: 2026-07-11T00:08:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-11T00:00:00Z
  checked: Intern-1's Part B self-QA (verbatim)
  found: "Mode selection gate ... the system-reminder explicitly told me to fire this at session start. I skipped it entirely ... One [gate] I missed entirely and the hook didn't catch it either." Contrast in the same report: "Two gates I caught myself. Two the stop hook had to catch for me."
  implication: confirms both the skip and the asymmetric backstop behavior (catches some mid-session misses, not this session-start one) from Larry's own account.

- timestamp: 2026-07-11T00:03:00Z
  checked: `skills/conversation-mode/SKILL.md` frontmatter
  found: declares BOTH `hitl_shape: "F.1"` + `hitl_why: "The lane picker (Just Talk / Explore+Capture / Build a Room) is an explicit F.1 Decision Gate, never an inferred persona classification."` AND `connector: { excluded: true, reason: "Ambient always-on infra. The Shape F.1 lane-picker / mode-selection skill runs every turn to set the conversational mode; substrate, not a triggered reach." }`. The gate itself (body prose) instructs Larry to fire an AskUserQuestion card ("Larry surfaces a Shape F.1 selector -- the SEED-020 host-native AskUserQuestion card-selector ... reuse renderShapeF1 / the host primitive") but this is a prose instruction to an LLM, not a deterministic code call site the model is forced to invoke.
  implication: self-contradictory declaration under the project's own Part 11 doctrine (CLAUDE.md: "a render-only or pure-capability skill is exempt via its existing connector.excluded:true + reason, never via a fork it does not have"). conversation-mode explicitly claims to HAVE a fork (hitl_shape + hitl_why) yet is simultaneously exempted as ambient/no-fork infra.

- timestamp: 2026-07-11T00:04:00Z
  checked: `data/render-coverage-registry.json` (all 113 entries) + `scripts/build-render-coverage.cjs::buildMdKeyspace()` source
  found: zero entries reference `conversation-mode` or any `skills/*` path. `buildMdKeyspace()` (lines 309-320) reads only `fs.readdirSync(path.join(rootDir, 'commands'))` -- it never walks `skills/`. The registry's two keyspaces (per its own `generated_note`) are (1) `.cjs` render entry points and (2) `commands/*.md` hitl_shape-declaring surfaces; skills are in neither.
  implication: `check-card-fire.cjs::gateReachingEntries(registry)` can structurally never include the mode-selection gate. PRIMARY detection is impossible for this surface by construction, independent of whether the side-channel writer (`recordReachedGate`, gated on `payload.emitTelemetry === true` in `lib/hmi/selector-dispatcher.cjs`) ever fires.

- timestamp: 2026-07-11T00:06:00Z
  checked: `scripts/check-shape-declaration.cjs` lines 218-320 (predicates 5, 7-9) and the `excludedOk` computation (lines 278-282)
  found: `excludedOk = fixture.connector_excluded === true && non-empty connector_reason`. Predicates 7 (wired-body / STAMP_MARKER or AskUserQuestion mention), 8 (tool-grant), and 9 (declared-matches-body) all guard on `if (hasShape && !excludedOk)` -- so when a surface declares BOTH `hasShape=true` (a real hitl_shape) AND `excludedOk=true` (connector.excluded+reason), ALL THREE verification predicates are skipped entirely. No predicate anywhere in the file flags "hasShape true AND excludedOk true" as a contradiction.
  implication: the CI/born-wired tripwire that would otherwise force conversation-mode's SKILL.md body to prove it actually renders an AskUserQuestion card is silently disabled by the surface's own `connector.excluded:true` flag -- the exact same flag that (per #1 above) also removes it from render-coverage-registry PRIMARY detection. The skill is doubly exempt from any structural enforcement, backed only by prose.

- timestamp: 2026-07-11T00:07:00Z
  checked: `scripts/check-card-fire.cjs::classifyCardFire()` (lines 511-621) and `computeBackstopHit()` (lines 455-471)
  found: when `primaryHit` is false (per #1) and `backstopHit` is false, the function returns at its very first branch: `{ intercept: false, reason: 'no-gate-signal', degrade: false }` -- treated identically to an ordinary turn with no gate at all. `computeBackstopHit()` requires the ASCII-box glyph regex or a framed numbered-prose match to be PRESENT in `output_text`; there is no fallback path that flags "a gate was supposed to render here and nothing did."
  implication: a silent skip that produces zero gate-shaped output text (as Intern-1's session did -- Larry "proceeded directly into the conversation") leaves BOTH detection signals false. The Stop hook runs (confirmed every turn, including turn 1) but has nothing to catch. This is the final link: the hook's execution timing was never the gap: the absence of any detectable signal for this specific surface is.

## Technical Root Cause

The session-start mode-selection Decision Gate (`skills/conversation-mode/SKILL.md`, self-declared `hitl_shape: "F.1"`) is enforced ENTIRELY by prose instruction with no deterministic backstop capable of catching a fully-silent skip. Three converging structural gaps:

1. **PRIMARY detection is structurally impossible for this surface.** `scripts/build-render-coverage.cjs::buildMdKeyspace()` enumerates only `commands/*.md` files when building the second keyspace of `data/render-coverage-registry.json`; it never walks `skills/*/SKILL.md`. conversation-mode therefore has zero entries in the registry, so `check-card-fire.cjs::gateReachingEntries(registry)` can never include it and `primaryHit` is always false for this gate, regardless of runtime behavior.

2. **The CI tripwire that should have caught this at declaration time is self-disabled.** `skills/conversation-mode/SKILL.md` declares BOTH `hitl_shape: "F.1"` + `hitl_why` (self-asserting a genuine Decision-Gate fork) AND `connector.excluded: true` + reason (the CIRS "no-fork ambient infra" exemption). `scripts/check-shape-declaration.cjs`'s `excludedOk` guard causes predicates 7-9 (wired-body / tool-grant / declared-matches-body -- the checks that verify a hitl_shape-declaring surface's body actually proves it renders the card) to be skipped whenever `connector.excluded:true`+reason is present, with no regard to `hasShape` also being true. This directly inverts the project's own Part 11 doctrine ("exempt via connector.excluded:true + reason, never via a fork it does not have") -- the skill explicitly HAS a fork yet is exempted as if it does not, and no predicate in the file flags this contradiction.

3. **The remaining catch-all (the Stop-hook BACKSTOP) requires gate-shaped TEXT to exist.** `check-card-fire.cjs::computeBackstopHit()` only fires on ASCII-box glyphs or a framed numbered-prose list actually present in the assistant's turn output. A fully silent skip -- Larry proceeding straight into ordinary conversational text with zero attempted gate rendering, exactly as Intern-1 self-reported ("I skipped it entirely ... defaulted silently") -- produces no such text, so `backstopHit` is also false. `classifyCardFire()` then hits its first branch (`!primaryHit && !backstopHit`) and returns `{intercept:false, reason:'no-gate-signal'}`: an ordinary turn, nothing to force.

The Stop hook itself is NOT turn-gated (it fires on every assistant turn including turn 1) -- the original "turn-threshold" hypothesis is eliminated. The gap is the total absence of any detectable signal for this specific surface, not a timing exemption. This is a DIFFERENT root cause than the sibling session-start-vs-mid-session pairing suggested: the mid-session sibling (`intern-w1-card-discipline-decay.md`) has gate-shaped text the BACKSTOP evaluates but its `GATE_FRAMING_RE` cue-word list under-matches; this session-start case has no evaluable signal at all, by construction, at two independent layers (registry scan scope + CI exemption interaction).

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

NOT APPLICABLE -- diagnose-only session (goal: find_root_cause_only). No code changes made. Candidate fix directions for the follow-up fix session:
- Extend `scripts/build-render-coverage.cjs::buildMdKeyspace()` (or add a parallel skill-keyspace walk) to enumerate `skills/*/SKILL.md` hitl_shape declarations, OR
- Add a contradiction predicate to `scripts/check-shape-declaration.cjs` that fails when `hasShape === true` AND `connector.excluded === true` simultaneously (a surface cannot both self-declare a fork and claim no-fork exemption), OR
- Give the mode-selection gate an actual code-level firing checkpoint (e.g. a session-start hook that checks whether the lane pick was recorded, mirroring the `card-fire-sidechannel.cjs` pattern used elsewhere) so a silent skip has SOMETHING structural to catch, not just prose.

## Tests to Add or Update

DONE this session: `tests/test-209-declared-implies-wired.cjs` gained Behaviors 10-13 (buildSkillKeyspace fixture proof, live-tree conversation-mode registration proof, the hasShape+excluded contradiction predicate proof including the `hitl_shape:'none'` non-contradiction edge case, and a live-tree honesty check naming the 5 known unwired skills); Behaviors 4, 5, and 9 updated to reflect the new predicate/keyspace reality without weakening their original intent. `tests/test-209-incident-replay.cjs`, `tests/test-b1-reconcile-canonical.cjs`, `tests/test-check-render-coverage.cjs`, and `tests/test-render-coverage-gate-hardfail.cjs` updated for the same ripple (all isolate this fix's known findings from their own original scope so a genuine regression still fails them).

Deferred, NOT done (out of scope): a scripted turn-1 fixture asserting the mode-selection AskUserQuestion card fires at runtime (that would require a code-level firing checkpoint per the debug file's own "Required Code Changes" candidate 3, which needs check-card-fire.cjs or a new session-start hook -- explicitly out of scope this session).

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: Fixed entry under v1.15.3-beta.13 once resolved.
- knowledge-base.md: summary block on resolve.
- Cross-check `intern-w1-card-discipline-decay.md` before closing - if root cause is shared (a general backstop turn-1 exemption), fix once, reference from both files, do not duplicate the fix.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: The session-start mode-selection Decision Gate (skills/conversation-mode/SKILL.md, hitl_shape "F.1") is enforced by prose instruction alone. Three converging structural gaps make a silent skip undetectable: (1) scripts/build-render-coverage.cjs::buildMdKeyspace() scans only commands/*.md, never skills/*/SKILL.md, so this gate can never register as a card-emission entry -> PRIMARY detection in check-card-fire.cjs is structurally blind to it. (2) The skill self-declares both hitl_shape/hitl_why (a genuine fork) AND connector.excluded:true+reason (the no-fork exemption); check-shape-declaration.cjs's excludedOk guard skips the wired-body/tool-grant/declared-matches-body verification whenever connector.excluded:true is present, regardless of hasShape also being true, so CI never verifies the body actually renders a card -- inverting the project's own Part 11 doctrine. (3) check-card-fire.cjs's Stop-hook BACKSTOP only fires on gate-shaped TEXT (ASCII-box glyphs / framed numbered-prose) present in the turn output; a fully silent skip produces none, so backstopHit is also false. classifyCardFire() hits its first branch (!primaryHit && !backstopHit) and returns no-gate-signal -- an ordinary turn, nothing forced. The Stop hook itself is not turn-gated (fires every turn including turn 1); the gap is total signal absence for this surface, not a timing exemption.
fix: Applied to gaps 1 and 2 (of the 3 named in root_cause); gap 3 (check-card-fire.cjs backstop) explicitly OUT OF SCOPE this session (a sibling worktree, card-discipline-decay, is editing that file concurrently).

(a) GAP 1 CLOSED: scripts/build-render-coverage.cjs gained buildSkillKeyspace() (mirrors buildMdKeyspace() exactly: same wired predicate -- body carries STAMP_MARKER or mentions AskUserQuestion, AND the allowed-tools grant predicate) walking skills/*/SKILL.md as a THIRD, additive registry keyspace, appended to entries[] after the commands/*.md keyspace. buildRegistry() now calls it and adds skill_declared_wired/skill_declared_unwired to render_counts. skills/conversation-mode/SKILL.md now registers: { surface: "skills/conversation-mode/SKILL.md", declared_shape: "F.1", wired: true } (verified: the body already mentions AskUserQuestion, no restrictive allowed-tools). PRIMARY detection can now structurally see this surface for the first time.

SIDE EFFECT (expected, disclosed, NOT masked): extending the walk to skills/ surfaced 5 PRE-EXISTING (previously invisible) unwired skill declarations unrelated to conversation-mode: skills/MOSDeckEngine/SKILL.md, skills/client-discovery-interview/SKILL.md, skills/intelligence-orchestrator/SKILL.md, skills/mullins-scaffold/SKILL.md, skills/mva-pipeline/SKILL.md. `node scripts/check-render-coverage.cjs --check` now correctly exits 1 on these (a HARD-FAIL gate, wired into pre-commit + release.sh + doctor --acceptance). This is the DESIRED, CORRECT consequence of closing PRIMARY detection's blind spot -- these 5 gaps existed before this fix; they were simply invisible. Fixing them (stamping each skill's body or investigating whether each is legitimately render-only) is a SEPARATE, NEW FAILURE requiring its own follow-up debug/fix session -- NOT attempted here (out of the named 3-item scope). All 5 are named/tracked in tests/test-209-declared-implies-wired.cjs Behavior 13 and tests/test-209-incident-replay.cjs part (c) so a 6th, truly-new gap would still fail those tests.

(b) GAP 2 CLOSED: scripts/check-shape-declaration.cjs's check() gained predicate (2b): fires when a fixture has hasShape (hitl_shape !== 'none') AND connector_excluded === true, REGARDLESS of whether connector_reason is present. Deliberately EXCLUDES hitl_shape:'none' (confirmed via data/hitl-shape-declaration-schema.json's own shape_vocabulary_note: 'none' means "reaches no genuine Decision-Gate fork" -- semantically compatible with connector.excluded:true, not a contradiction). Violation message quotes CLAUDE.md Part 11 verbatim: "a render-only or pure-capability skill is exempt via its existing connector.excluded:true + reason, never via a fork it does not have." This predicate is UNCONDITIONAL (not gated behind --strict); `check-shape-declaration.cjs --check` remains ADVISORY by default (WARN, exit 0) per the existing Phase 210 policy, so this addition does not newly block CI.

SIDE EFFECT (expected, disclosed): applying the general predicate against the live tree surfaced 55 PRE-EXISTING hasShape+excluded contradictions (conversation-mode is 1 of the 55; the other 54 span commands/, agents/, and skills/ -- e.g. commands/admin.md + skills/admin/SKILL.md, commands/help.md + skills/help/SKILL.md, and about a dozen other command/skill pairs sharing the identical "Ambient always-on infra... not a triggered reach" exclusion reason alongside a real hitl_shape). Fixing all 55 is far beyond the named scope (only skills/conversation-mode/SKILL.md was named for resolution). All 55 are named/tracked in tests/test-209-declared-implies-wired.cjs Behavior 5 so a genuine NEW contradiction still fails that test. Since --check is advisory, this is a real, visible, non-blocking signal where previously there was ZERO signal -- a direct, load-bearing improvement over the pre-fix state even without resolving every instance.

(c) skills/conversation-mode/SKILL.md: task instruction was "drop the false connector.excluded:true, keep hitl_shape" (the fork is real). IMPLEMENTED THEN REVERTED after discovering a hard blocker: removing connector.excluded:true makes this surface classify 'gap' in the SEPARATE CIRS connector-coverage-ledger (data/connector-coverage-ledger.json, built by scripts/build-connector-registry.cjs -- a DIFFERENT file/system than check-shape-declaration.cjs, NOT authorized for edits this session), and `build-connector-registry.cjs --check` HARD-FAILS (exit 1, not advisory) on any gap surface (the R2/R9 "full flip", gap===0 invariant) -- confirmed empirically. The ONLY alternative path to a non-gap classification (connector.connects_to_spine:true) requires a valid reach_id (one of a frozen 6) + posture (one of a frozen 3) that would have to be FABRICATED (conversation-mode is a mode/lane picker, not a sensor-triggered reach through dispatchSensors -> decide() -> resolver -- setting connects_to_spine:true would itself be a false declaration, and inventing a reach_id/posture is a decision beyond this session's scope). ROOT TENSION DISCOVERED: connector.excluded:true is dual-purposed by two DIFFERENT gates for two DIFFERENT meanings -- R1 (build-connector-registry.cjs): "not reached via the governed connector spine" (TRUE for conversation-mode, and for ~10 other confirmed "ambient always-on infra" skills, e.g. larry-personality, room-proactive, ui-system, context-engine, pws-methodology, several of which ALSO carry hitl_shape/hitl_stages alongside excluded:true, an established, intentional pattern); R16 (check-shape-declaration.cjs, per CLAUDE.md's own Part 11 text): "no fork, render-only/pure-capability" (FALSE for conversation-mode -- it has a genuine fork). RESOLUTION: kept the ORIGINAL connector.excluded:true + reason block unchanged (restores R1 correctness, verified via build-connector-registry.cjs --check exit 0), added an extensive in-file comment documenting the discovered field-reuse collision and why the literal fix was unsafe. conversation-mode therefore STILL shows a WARN under the new predicate (2b) -- gap 2's general predicate provides the (advisory, non-blocking) signal that gap 3's silent-skip class of bug existed here, which is the closest safe closure achievable without extending scope to a 4th file (build-connector-registry.cjs) or fabricating false reach/posture data. RECOMMENDATION for a follow-up phase: separate the two concerns into distinct frontmatter fields (e.g. keep connector.excluded:true for R1's spine-reach meaning; add a NEW, distinct field such as hitl_no_fork:true for R16's fork-exemption meaning) so the same boolean is never asked to mean two different things.

verification:
- node scripts/build-render-coverage.cjs -- writes cleanly, 216 entries (16 card-emission + 97 md-declared-wired + 0 md-declared-unwired + 98 skill-declared-wired + 5 skill-declared-unwired). Exit 0.
- node scripts/build-render-coverage.cjs --check -- byte-stable. Exit 0.
- node scripts/check-render-coverage.cjs --check -- Exit 1 (5 known skill gaps, documented above; NOT a regression -- these are newly-VISIBLE pre-existing gaps).
- node scripts/check-shape-declaration.cjs --check -- Exit 0 (advisory; 55 known WARN entries printed, documented above).
- node scripts/check-shape-declaration.test.cjs -- 27 passed, 0 failed (pre-existing fixture suite, unaffected).
- node scripts/build-connector-registry.cjs --check -- Exit 0 (confirms the task-c revert preserved R1 ledger correctness).
- node tests/test-209-declared-implies-wired.cjs -- 14 assertions passed (extended: Behaviors 10-13 new; Behaviors 4, 5, 9 updated to reflect the new predicate/keyspace reality).
- node tests/test-209-incident-replay.cjs -- 4 assertions passed (part (c) updated: commands/*.md stays 0-unwired; skills/*/SKILL.md known-5 confirmed).
- node tests/test-b1-reconcile-canonical.cjs -- 36 passed, 0 failed (updated: check-render-coverage assertion now checks for the known-5-only failure signature).
- node tests/test-check-render-coverage.cjs -- reaches a PRE-EXISTING, UNRELATED baseline failure at its own "15 entries" assertion (confirmed via git stash: fails identically with zero of this session's changes applied -- a stale .cjs-entry-count literal, 16 actual vs 15 expected, unrelated to skills/hasShape work); the --check assertion further down in the same file was ALSO updated for completeness (in case the pre-existing bug is fixed later) but is masked by the earlier failure in this run.
- bash tests/run-all-190.sh -- 4/4 passed (confirms check-shape-declaration.cjs --check stays advisory/non-blocking).
- bash tests/run-all-210.sh -- 14/14 passed after fixing tests/test-209-incident-replay.cjs's ripple.
- bash tests/run-all-178.sh -- 6/10 passed; the 4 failures are test-render-registry-build.cjs, test-render-registry-exhaustive.cjs, test-check-render-coverage.cjs (all three: confirmed PRE-EXISTING via git stash, a stale "15 vs 16 .cjs entries" literal unrelated to this fix), and test-cirs-render-coverage-floor.cjs (confirmed PRE-EXISTING via git stash, an unrelated stale canon "R1-R15" vs "R1-R16" doc-text assertion). None of the 4 are new regressions from this fix.
- node scripts/doctor.cjs --acceptance -- 13/15 (2 FAIL: "coverage-gate" is the same known/documented 5-skill-gap consequence; "verify-release-clean-tree" reports 10 tracked-file drift, which is this fix's own uncommitted diff (9 files) plus a PRE-EXISTING, unrelated package-lock.json version drift confirmed present before this session started, both fully expected given the explicit "do NOT commit" instruction for this checkpoint).

files_changed:
- scripts/build-render-coverage.cjs (buildSkillKeyspace + SKILL_RENDER_ONLY_EXCLUDED + buildRegistry wiring + GENERATED_NOTE + exports + main() log line)
- scripts/check-shape-declaration.cjs (predicate 2b, the hasShape-and-excluded contradiction)
- skills/conversation-mode/SKILL.md (documentation comment only; connector.excluded:true retained unchanged -- see fix (c) above)
- data/render-coverage-registry.json (regenerated; now 216 entries across 3 keyspaces)
- tests/test-209-declared-implies-wired.cjs (Behaviors 4, 5, 9 updated; Behaviors 10-13 added)
- tests/test-209-incident-replay.cjs (part c updated)
- tests/test-b1-reconcile-canonical.cjs (check-render-coverage assertion updated)
- tests/test-check-render-coverage.cjs (Assertion 6 updated for completeness)
- tests/test-render-coverage-gate-hardfail.cjs (Test 3 updated)

commits: ["4905b242e1d23ac9febcf8a87fcb8e58fec1038f"] -- committed on branch worktree-agent-a1c26e37f50b7d9c5 (this worktree). NOT merged into main -- a concurrent session is refactoring main; holding for sequencing per coordinator instruction (2026-07-11). User-confirmed fixed; the gap-3 revert-and-document approach was explicitly accepted as-is, no scope extension requested.
