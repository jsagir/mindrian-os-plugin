# Hooked Model Audit: FIRST_INSTALL first-session onboarding (v2.0.0-beta.12 / main @ 86a9af2728077e715e5f6a0ebf7ac9d6dcc1d50c)

> Filed 2026-08-27. Scope: `scripts/session-start`'s FIRST_INSTALL prose injection, audited against Nir Eyal's Hooked Model (Trigger -> Action -> Variable Reward -> Investment) and this repo's own `docs/reward-before-investment-rule.md` hard rule. Grounded in the live code on branch main.
>
> Milestone: Phase 267.1 (Hooked Model Completeness Audit). Sibling docs: `.planning/research/2026-06-09-hooked-model-larryreach-loop-audit.md` (45/70, the LarryReach in-session loop), the `/mos:ignite` audit at `.planning/debug/beta13-curing-sequence-persona-and-commands-bisect.md:187-209` (38/70).
>
> Release caveat: this audit describes `main` at commit `86a9af2728077e715e5f6a0ebf7ac9d6dcc1d50c` (the pre-fix commit named by plan 267.1-01; all citations below were spot-checked against current HEAD in plan 267.1-03 and still resolve identically). The shipped plugin a user is currently running (`v2.0.0-beta.12` per `.claude-plugin/plugin.json`) may not yet contain this commit. A `main` commit is not live until a release ships and is picked up (standing hard rule).

## TL;DR

The FIRST_INSTALL surface is a single interpolated bash string injected as `additionalContext` (`scripts/session-start:666` at the audited commit, anchored on the literal `[MindrianOS Onboarding] First install detected.`). It is not a program. Three of the four TARI legs are asserted as prose, and only one of them has deterministic machinery behind it. In plain language: **does onboarding deliver a real Reward in that same first session?** No -- the "domain intelligence" line is the model improvising from its own training, with no MindrianOS machinery behind it, so it fails the rule's own "attributable to MindrianOS uniquely" test. **Does onboarding build real Investment?** No -- the prose tells the model to write `~/.mindrian-user.md`, but nothing in the entire repository ever writes that file; the only real USER.md writer only fires after a room already exists, which a first install by definition does not have.

## Scope and what this instrument is not

**1. The retired-gate distinction.** Canon Appendix D entry 31 (`docs/MINDRIAN-CANON.md:397-403`) retired the Hooked composite AS A RATIFICATION GATE for Canon Part 10 and replaced it with the welded two-gauge metric. It did NOT retire the Hooked DESIGN mandate. BIRTH-FLOW-BRIEF.md Decision 8 (a product design rule, navigator-locked 2026-06-12) and `docs/reward-before-investment-rule.md` (`type: non-negotiable-constraint`) are separate instruments and remain binding. The one Hooked piece entry 31 explicitly KEEPS is the Manipulation Matrix / Facilitator check. Consequence, stated plainly: the `/70` in this audit is diagnostic only (DIAGNOSTIC ONLY) and is never a pass/fail threshold.

**2. Tri-Polar boundary (RESEARCH.md OQ-4, decided).** `scripts/session-start` is a Claude Code SessionStart hook. It does not run on Desktop or Cowork, which get their first-session behavior from the MCP server instructions instead. This audit scores the CLI surface in depth. Desktop and Cowork first-session Hooked coverage is a DELIBERATE, STATED scope boundary, not an oversight, and is named here as a candidate for its own future audit. That sentence exists specifically to satisfy the Tri-Polar Design Rule's requirement that a skip be a deliberate stated call.

**3. The subject is FIRST_INSTALL, not `/mos:onboard`.** `/mos:onboard` is a user-invoked command a first-time user may never run; FIRST_INSTALL fires automatically on every cold Claude Code session with no `~/.mindrian-onboarded` marker. `/mos:onboard` appears in this document only as a comparison reference.

**4. Correction to the phase Goal's own premise.** The Goal (`.planning/ROADMAP.md:530`) recorded "JTBD-formula framing for returning users" as a confirmed FIRST_INSTALL property. It is not in the FIRST_INSTALL branch. The JTBD-formula mandate ("CRITICAL: Frame EVERY new capability using the JTBD formula") lives in the UPDATE branch at `scripts/session-start:680`. FIRST_INSTALL frames capabilities as a flat bulleted list of "You can ask Larry to..." lines with no situation/progress/outcome structure. The Goal's "returning users" therefore refers to the UPDATE branch, and FIRST_INSTALL does not inherit JTBD framing. Verified: `sed -n '665,667p' scripts/session-start | grep -c "JTBD"` returns `0`.

## The hard rule this is judged against

`docs/reward-before-investment-rule.md` line 21, verbatim:

> **No flow in MindrianOS may require user input beyond one sentence before delivering its first variable reward.**

The four-part reward test (lines 52-56 in-repo, byte-identical to the canonical room copy per the settled A5 verdict below): a reward qualifies ONLY if it is (1) **Unpredictable** -- user could not have produced it themselves in under 30 seconds; (2) **Intelligible** -- user understands what they are seeing without explanation; (3) **Valuable** -- the user would pay attention to it if they saw it on someone else's screen; (4) **Attributable to MindrianOS uniquely** -- not something ChatGPT could do in the same time budget.

Explicit negative examples (lines 58-62): "A grade is not a reward (predictable output of an asked question). A `/mos:status` output is not a reward (predictable report). A status report is not a reward. The Instant Brief IS a reward. The Breakthrough Scan IS a reward. A Tavily-sourced funding opportunity surfaced unsolicited IS a reward."

**A5 provenance verdict (settled in plan 267.1-02): DIVERGENT, non-blocking.** The in-repo copy and the canonical room copy differ only in an additive REWARD_TYPES vocabulary section present in-repo and absent from the canonical file -- the rule text, the violating-ask list, the four-part reward test, and the positive/negative examples this audit actually judges against are byte-identical in both. The judging instrument was confirmed current; nothing in this audit's verdicts changes because of the divergence.

BIRTH-FLOW-BRIEF Decision 8, the clause that puts FIRST_INSTALL unambiguously in scope: "the FIRST STEP of any Mindrian surface -- including Ignite -- must be designed as a complete Hook cycle: external trigger (install / U0 nudge) -> minimal action (just talk / paste) -> VARIABLE reward (MVA brief / domain insight sweep) -> investment (B2 approve -> room exists, role_blend stored -> loads the next trigger)."

## Loop map (live as of v2.0.0-beta.12)

```
TRIGGER   De Stijl banner, external, deterministic   scripts/session-start:626-630
   v      fires unconditionally on cold start; no LLM in the path
ACTION    3-option prose menu, SEED-021 mandate now present   scripts/session-start:666
   v      Q&A / paste / Skip; card-fire mandate closed in this phase (GAP A-1)
REWARD    "domain intelligence" promise line             scripts/session-start:666
   v      NO WIRED CALL -- sweepDomainInsights unreachable pre-room
INVEST    "build a USER.md ... (~/.mindrian-user.md)"     scripts/session-start:666
   '----> NO WRITER EXISTS -- loop does not close, nothing read back as a return cue
```

RESEARCH.md's larger first-install code-path diagram is transcribed in Appendix A.

## Leg-by-leg gap register

| Leg | Status | Citation | Verdict |
|---|---|---|---|
| Trigger (external) | IMPLEMENTED | `scripts/session-start:624-630` fires `${BANNER_SCRIPT}` unconditionally on every cold start; version-transition variant when `LAST_VERSION != PLUGIN_VERSION` | REAL. The De Stijl Mondrian banner is a genuine external trigger, rendered by bash, not by the model. Decision 8 names "install" as the canonical external trigger and install does fire it. A1 (settled 267.1-02, HIGH confidence, documented provenance): the FIRST_INSTALL `additionalContext` payload (~3000 chars) reaches the model whole -- all 9 SessionStart hooks' `additionalContext` values are concatenated, not replaced or truncated below the 10,000-character per-value threshold, and a non-zero exit on any sibling hook does not suppress it. No downgrade to this leg. |
| Trigger (internal) | NOT DESIGNED | No emotion is named anywhere in the FIRST_INSTALL prose | GAP. The prose targets "build deep context about this user" -- a maker goal, not a user emotion. The skill's Step 2 requires mapping "what emotion does the user feel right before opening the product?" Nothing in FIRST_INSTALL answers that. |
| Action (B=MAP) | IMPLEMENTED as prose, defect found and closed in this phase | `scripts/session-start:666`, "Offer three approaches - fire the AskUserQuestion card with these three as options; default to option 3 (Skip)... (SEED-021)" | See GAP A-1 below. A2 (settled 267.1-02, HIGH confidence, repo-code-read provenance): the `check-card-fire.cjs` Stop-hook backstop does NOT rescue a prose-rendered menu -- FIRST_INSTALL is not a registered card-emission gate (`primaryHit` false, zero matching entries in `data/render-coverage-registry.json`) and the bare-numbered-list detection arm was retired in Phase 209-07 (`backstopHit` false). With both false, `classifyCardFire` returns `{intercept:false, reason:'no-gate-signal'}`. This sharpens the SEED-021 finding's severity: it stays a defect, not a softened "undeclared reliance on a backstop," because there never was a backstop to rely on. |
| Reward (variable) | ASSERTED, NOT IMPLEMENTED | `scripts/session-start:666`, "Based on your work in [domain], here is what I already know about your space" | GAP R-1. See below. |
| Investment | ASSERTED, NOT IMPLEMENTED | `scripts/session-start:666`, "build a USER.md file in their home directory (~/.mindrian-user.md)" | GAP I-1. See below. Strongest finding in this audit. |
| Loop closure | NOT IMPLEMENTED | Nothing written during FIRST_INSTALL is read back as a return cue | GAP. `~/.mindrian-onboarded` (version + date) and `~/.mindrian/auto-update` (empty flag file) are the only durable writes. Neither loads a next Trigger. |
| Ethics | PASS | Canon Part 6 dog-fooding; option 3 is an unconditional, explicitly-worded opt-out ("You can skip this entirely and jump straight to working") | Facilitator quadrant, clean. Preserved from the 9/10 rating in the 2026-06-09 audit. The explicit skip option is a textbook meaningful opt-out. |

Pinning assertions for the machine-checkable rows above live in `tests/test-267-1-first-install-hooked-audit.cjs` (8 assertions; see Appendix C).

### GAP R-1: Reward is a promise, not a payoff

The prose promises: "Based on your work in [domain], here is what I already know about your space -- then suggest relevant frameworks and room sections." Nothing is behind it. No tool call, no script invocation, no library reference -- the model is asked to improvise domain knowledge from its own weights.

Scored against the rule's own four-part reward test:

| Criterion | Verdict | Reasoning |
|---|---|---|
| Unpredictable (user could not produce it in <30s) | FAIL | Generic domain commentary is exactly what any LLM produces on request |
| Intelligible | PASS | It is prose |
| Valuable | WEAK | Depends entirely on unmeasured model-improvisation quality |
| Attributable to MindrianOS uniquely | FAIL (decisive) | A generic domain-knowledge paragraph is precisely what ChatGPT does in the same time budget; zero MindrianOS machinery is engaged |

Two of four criteria fail, including the decisive one. Under the repo's own definition, FIRST_INSTALL delivers no qualifying variable reward.

The machinery to do this for real already exists and is unreachable at first install. `lib/core/domain-insight-sweep.cjs:5-7` header, verbatim: "THE single entry point for the Hooked variable-reward leg of the blank-slate persona." It drives a Tavily SIGNAL search per generic domain handle and derives cross-domain insights locally, but its function signature (`lib/core/domain-insight-sweep.cjs:106`, `async function sweepDomainInsights({ domains, roomDir, sessionId, db } = {})`) requires an open `db` handle -- a room that does not exist at first install. Its only invocation site is `skills/ignite/SKILL.md:209` / `commands/ignite.md:213`. Separately, `scripts/check-pending-breakthrough.cjs` is registered as a SessionStart hook and its own header cites "Canon Part 10 sub-claim 5: variable reward fires automatically; the math IS the surface; no user-facing trigger required" -- but it resolves `resolveRoomsHome()` to `null` when `~/MindrianRooms` does not exist, and its documented flow emits `{continue:true}` (D-16 empty-state silence) in that case. On a genuine first install there is no rooms directory at all, so the repo's flagship automatic variable reward is structurally silent on the exact session where a first reward matters most.

The routing gap compounds this. `skills/ignite/SKILL.md:50` states plainly: "`/mos:ignite` is the canonical front door for new room creation. `/mos:new-project` is the scaffold backend invoked by ignite... users are encouraged to use `/mos:ignite` for the full Hooked first-cycle experience." The FIRST_INSTALL cold-start menu (`COLD_START_MENU`, `scripts/session-start:657`) offers `/mos:new-project`, `/mos:help`, `/mos:diagnose`, `/mos:update` and never names `/mos:ignite`. The first-time user is routed to the scaffold backend, never to the Hooked front door. Pinned by `tests/test-267-1-first-install-hooked-audit.cjs` assertions 2 and 3.

### GAP I-1: Investment has no writer

This is the strongest finding in the audit. The prose instructs: "If the user engages with approach 1 or 2, build a USER.md file in their home directory (`~/.mindrian-user.md`) capturing: name, role, domain, subdomain, technical level, current focus, goal, expertise areas."

Exhaustive grep across `lib/`, `scripts/`, `hooks/` for `mindrian-user\.md` returns exactly two hits: `lib/core/user-archetype.cjs:64` (a **READ** -- `safeReadFile(path.join(require('os').homedir(), '.mindrian-user.md'))`, third fallback in the archetype signal chain), and `scripts/session-start` itself (the prose instruction that names the path, not a writer). Widening the grep to `skills/` and `commands/` finds two more prose-only hits (`skills/onboard/SKILL.md:420`, `commands/onboard.md:424`, both instructional text, "If no `room/`: write to `~/.mindrian-user.md`"). **Zero writers exist anywhere in the repository.**

The only deterministic USER.md writer is `writeUserMdAtomic` (`lib/core/user-md-ops.cjs:440`). Its only production callers are `lib/core/navigation/room-birth.cjs:572` and `:801`, both writing to `path.join(roomDir, 'USER.md')`. A first install has no room, therefore no `roomDir`, therefore `writeUserMdAtomic` is unreachable.

Dogfood confirmation, this machine: `~/.mindrian-onboarded` is present (dated 2026-04-05, onboarding completed), `~/.mindrian-user.md` does not exist. The maintainer's own machine completed onboarding and has no user profile file.

Corroborating prior evidence: `BIRTH-FLOW-BRIEF.md` documents that USER.md carries a 7-axis `role_blend` that "NO onboarding flow ever populates" (3 of 6 surveyed production rooms carry a stub pointing at a `/mos:profile-user` command that does not exist -- see the Roadmap's Quick win 3 below for why that command must not be the fix).

What FIRST_INSTALL actually deposits, in full: `~/.mindrian/auto-update` (`:662`, an empty flag file `touch`ed by the product, not user-deposited value) and `~/.mindrian-onboarded` (via `check-onboard --write`, a version string plus an ISO date -- a "session happened" flag with zero user data). Neither is Investment in the Hooked sense: neither loads a future trigger, neither creates a switching cost.

Fragility bonus finding: `check-onboard --write` is itself an LLM instruction ("After the onboarding conversation completes or the user skips, run: bash .../check-onboard --write"). If the model does not run it, the marker is never written and FIRST_INSTALL fires again next session -- the onboarding state machine's own advance step depends on model compliance, not a deterministic hook action.

### GAP G-1: the enforcement mechanism has no jurisdiction here

`docs/reward-before-investment-rule.md:97-108` describes the detection mechanism: every command declares `interactive_first_reward` in frontmatter; `lib/core/mva-rule-linter.cjs` validates it; `scripts/check-reward-before-investment.cjs` runs it; the pre-commit hook gates it.

The linter's jurisdiction is `commands/*.md` only, proven in three independent places: `lib/core/mva-rule-linter.cjs:7` header ("Scans commands/*.md frontmatter"); `scanCommands` at `lib/core/mva-rule-linter.cjs:224` reads `commandsDir` filtered to `.endsWith('.md')`; and `scripts/check-reward-before-investment.cjs:127`'s CLI default target is `path.join(__dirname, '..', 'commands')`.

`scripts/session-start` is a bash hook with no frontmatter -- structurally outside the guard. `/mos:onboard` at least carries `interactive_first_reward: reframe_question` with an honest inline "Remediation tracked as follow-up phase" comment (`commands/onboard.md:12`), while FIRST_INSTALL carries no declaration at all because there is no frontmatter to carry one.

This is a governance gap, not just a content gap, and it explains WHY the other gaps survived: nothing was ever built to catch them. The single most-first flow in the entire product -- the one surface every user hits before any command -- is the one flow the reward-before-investment guard can never see.

### GAP A-1: the Action leg was outside the SEED-021 rendering contract (FOUND AND CLOSED IN THIS PHASE)

At the audited pre-fix commit (`86a9af2728077e715e5f6a0ebf7ac9d6dcc1d50c`), the FIRST_INSTALL block instructed a prose list ("Offer three approaches: 1. Conversational Q&A / 2. Document paste / 3. Skip") while the two sibling cold-start branches already mandated the `AskUserQuestion` card and named SEED-021: `scripts/session-start:707` (mode routing, "Fire the AskUserQuestion card with the three modes below as options... never render this menu as text (SEED-021)") and `scripts/session-start:608` (room chooser, "fire the AskUserQuestion card... never render this as a prose list (SEED-021)"). FIRST_INSTALL was the only cold-start branch missing the mandate.

In B=MAP terms, that inconsistency raises Ability cost from one click to reading-and-typing, on the single highest-stakes turn in the entire product -- the first thing a brand-new user ever sees.

The fix shipped in plan 267.1-01: FIRST_INSTALL now reads "Offer three approaches - fire the AskUserQuestion card with these three as options; default to option 3 (Skip) if the user starts talking instead of picking; never render this menu as a prose list (SEED-021)." Default-to-Skip reasoning, not default-to-option-1: the sibling MODE_MENU branch defaults to "Just Talk" (its own lowest-friction path) when the navigator talks instead of picking. Here the lowest-friction path is Skip, not option 1 -- Skip requires zero further input, matching the rule's line 21 (no input demanded before a first reward). Defaulting to option 1 would silently start an interactive Q&A the user never asked for.

The A2 answer (above) raises rather than lowers this finding's severity: there was never a Stop-hook backstop capable of rescuing a prose-rendered menu into a card, on this or any turn. The fix was necessary, not merely tidy.

This is the ONE remediation shipped in an otherwise audit-only phase, for three stated reasons: it is independent of Phase 269 (a rendering-contract consistency fix, not a new engagement mechanic touched by the Brain-key-friction rework); the guard test already existed for the two sibling branches, so extending it cost one line; and it does not touch Reward or Investment, the two legs Phase 269 will materially change.

### GAP S-1: pre-session Investment demanded before any Reward (OWNED BY PHASE 269)

Primary-source tester evidence, `docs/testers/gaurav-thorat/FEEDBACK.md` (2026-08-25, trial install on two platforms ahead of a class rollout): the install path required two separate sign-ins across two domains (mindrian-os.com, then a redirect to a second site) before the Brain key was ever shown, root-caused by the repo's own analysis as a genuine cross-origin session-cookie break, not a perception issue. Timings: 15 minutes on macOS, 25-30 minutes on Windows.

In Hooked terms: before the Trigger fires, the product demands a multi-step credential Investment. Two sign-ins, two domains, a key to copy. Measured against the rule's own violation list (filling any form, running a second command before seeing output from the first), the install path is a reward-before-investment inversion at the outermost boundary -- before the FIRST_INSTALL loop this audit scores even begins.

This is claimed by Phase 269 at `.planning/ROADMAP.md:570` ("Moat Shift -- Install/Update Entitlement Gate"), whose own Goal names this audit directly as touched by its work. It is documented here, quantified here, and NOT fixed or re-decided here -- that is a deliberate scope fence, not an oversight (see Roadmap section below).

**Two hard constraints observed in writing this subsection:** (a) the tester file contains a live, unrotated Brain API key in plaintext -- this document cites the file and its findings and never reproduces the key or any fragment of it; (b) the standing no-real-names rule applies -- this document references the file path and the finding and does not amplify identity details beyond the path itself.

## Score card

| Phase | Score | Critical gap | Priority fix |
|---|---|---|---|
| Trigger (External) | 8/10 | Deterministic banner fires every cold start; genuinely external, install-anchored per Decision 8. No re-entry trigger across sessions once FIRST_INSTALL has fired once (that is Loop Closure's job, scored separately). | Nothing to fix on this leg alone |
| Trigger (Internal) | 2/10 | No emotion is named or targeted anywhere in the prose; the goal is framed as a maker need ("build deep context") not a user feeling. | Name the emotion (e.g. "not knowing where to start") and write the prose to that |
| Action (B=MAP) | 7/10 | Three options is legal (at the rule's own 3-option ceiling) and the SEED-021 card mandate is now present (GAP A-1, closed in this phase). Not a 9 or 10 because a card fire is still an LLM-followed instruction with no registered gate to catch a miss (A2), so structural reliability is lower than the sibling branches' identical wording suggests. | Register FIRST_INSTALL's card-emission contract in `data/render-coverage-registry.json` so a future miss is machine-caught, not just human-noticed |
| Variable Reward | 2/10 | GAP R-1: the promised "domain intelligence" reward fails the rule's own decisive test (not attributable to MindrianOS uniquely); the two real reward engines that would pass it are both structurally unreachable pre-room, and the cold-start menu never routes to the one command (`/mos:ignite`) built to deliver the Hooked first-cycle reward. | Give `sweepDomainInsights` a pre-room, db-less degrade path per its own header, and name `/mos:ignite` in the cold-start menu |
| Investment | 1/10 | GAP I-1: the asserted investment (`~/.mindrian-user.md`) has zero writers anywhere in the repo, confirmed by exhaustive grep and by direct dogfood evidence on the maintainer's own machine. The only real writes (`auto-update` flag, onboarded marker) carry no user data and load no future trigger. | Wire a home-directory USER.md writer, or delete the instruction so the prose stops promising something the product does not do |
| Loop Closure | 1/10 | Nothing written during FIRST_INSTALL is read back as a return cue on any later session; the loop opens once and never closes. | Make some durable FIRST_INSTALL write function as a return-trigger payload |
| Ethics | 9/10 | Facilitator quadrant, clean. Option 3 is an unconditional, explicitly-worded opt-out; the maker dog-foods the exact flow being audited (Canon Part 6). | Protect the opt-out as any of the above fixes land |
| TOTAL | 30/70 | Band: Fragile loop (30-44) -- fundamental redesign needed on the weak legs (Reward, Investment, Loop Closure, Internal Trigger), not targeted patches. | Three of four TARI legs need real machinery, not prose, before this crosses into Emerging hook (45-59) |

**Diagnostic instrument, not a gate.** Canon Appendix D entry 31 retired the Hooked composite as a Part 10 ratification gate; the Manipulation Matrix is the one piece explicitly kept. This score compares against 45/70 (LarryReach, 2026-06-09) and 38/70 (`/mos:ignite`) and means nothing on its own.

## Roadmap

### Quick wins (high impact, low effort, machinery already exists)

1. Route the first-time user to the Hooked front door. `COLD_START_MENU` advertises `/mos:new-project`, the scaffold backend, and never names `/mos:ignite`, which `skills/ignite/SKILL.md:50` calls the canonical front door for the full Hooked first-cycle experience. One menu line.
   - COLLISION NOTE: names Phase 269 (removing key friction changes the onboarding Trigger/Reward/Investment legs, `.planning/ROADMAP.md:570`) and states this belongs to the follow-up phase registered by plan 267.1-05, not to this audit.

2. Give the reward engines a pre-room path. `sweepDomainInsights` degrades to `extractDomains`-only without a db handle, per its own header, so a text-only first-session variant is reachable in principle.
   - COLLISION NOTE: same Phase 269 note plus the follow-up phase registered by plan 267.1-05.

3. Give the Investment assertion a writer, or delete the assertion. Either wire a home-directory USER.md writer, or remove the instruction so the prose stops promising something the product does not do. Both options stated, neither pre-decided here.
   - COLLISION NOTE: follow-up phase (267.1-05); also note `/mos:profile-user` is referenced by USER.md stubs in production rooms and DOES NOT EXIST, so it must not be recommended as the mechanism.

4. Put the guard's jurisdiction over the surface that needs it most. GAP G-1 is the only finding with NO Phase 269 collision, which makes it the most immediately actionable item in the audit.
   - STATUS: registered as its own follow-up phase by plan 267.1-05, independent of Phase 269.

5. The SEED-021 rendering-contract fix.
   - STATUS: shipped in this phase (plan 267.1-01), pre-fix commit `86a9af2728077e715e5f6a0ebf7ac9d6dcc1d50c`.

### Medium-term

Loop-closure design: nothing written during FIRST_INSTALL is read back as a return cue, so the Investment-reloads-Trigger arc never closes across sessions. For it to close, something written during FIRST_INSTALL (a real USER.md, a stated goal, a domain handle) would have to become durable AND be read back on a later session start as the seed of that session's opening line. Both halves are currently missing -- the write side (GAP I-1) and the read-back side (Loop Closure).

Fragility item: the onboarding state machine's own advance step (`check-onboard --write`) is an LLM instruction rather than a deterministic hook action. If the model skips it, FIRST_INSTALL fires again next session. Any loop-closure design should make the advance step itself deterministic, not layer a new feature on top of an unreliable one.

## Ethics: Facilitator (9/10)

Applying the Manipulation Matrix: the maker dog-foods this exact flow on this exact machine (Canon Part 6 -- the dogfood evidence cited in GAP I-1 is itself proof of this), and option 3 is an unconditional, explicitly-worded opt-out ("You can skip this entirely and jump straight to working. I'll learn about you as we go."), which is a textbook meaningful opt-out. No vulnerable-emotion targeting, no regret-creation, no dark pattern in the current prose.

Watch-item: of the fixes proposed above, quick wins 1 and 2 (routing to `/mos:ignite`, wiring a live reward engine) both add pull, which is exactly the mechanic that, pushed too hard, slides Facilitator toward Dealer. Carrying forward the 2026-06-09 audit's watch-item verbatim as the standing constraint on every recommendation in this document: the re-entry trigger must carry utility every time (frequency without utility trains the user to ignore it), and the honesty floor never bends to manufacture delight. Canon Part 12 note: the Facilitator posture and Larry's invisibility are not tradeable for engagement -- a fix that makes FIRST_INSTALL feel more "hooked" at the cost of Larry becoming more visible or more insistent would itself be a Part 12 violation, independent of whether it raises the score.

## Loop-health metrics

Against the skill's metric list, measured on THIS surface today:

- **Session Frequency (DAU/MAU)** -- not measurable. FIRST_INSTALL fires exactly once per install by construction (gated on `~/.mindrian-onboarded`); there is no repeat-session signal to compute a ratio from.
- **D7/D30/D90 Retention** -- not measurable on this surface alone. Retention is a whole-product signal; FIRST_INSTALL contributes at most one data point (did the user come back at all), with no instrumentation currently wired to attribute a return session to anything FIRST_INSTALL did.
- **Internal Trigger Proxy** -- not measurable, and structurally cannot be until the Internal Trigger leg is designed (currently 2/10, no named emotion to proxy for).
- **Investment Depth** -- currently zero by construction (GAP I-1). The metric has nothing to read: no USER.md is ever written at first install, so there is no stored data/content/connections to average.
- **Reward Satisfaction + Wanting** -- not measurable. No reward is actually delivered (GAP R-1), so there is nothing to survey satisfaction against.

Four of five loop-health metrics are currently uninstantiable, not merely unmeasured -- the underlying behavior they would measure does not exist yet. This is itself a finding: instrumentation is not this phase's gap, machinery is.

## Appendix A: the first-install code path

```
        Claude Code launches, no ~/.mindrian-onboarded marker
                            |
                            v
   hooks/hooks.json  SessionStart matcher "startup|clear|compact"
   9 registered hooks fire in order (all async:false)
                            |
      +---------------------+---------------------+
      |                     |                     |
      v                     v                     v
 sessionstart-      run-hook.cmd          check-pending-
 npm-reconcile      session-start          breakthrough
 (deps)             [THE SUBJECT]          (REWARD ENGINE)
                            |                     |
                            v                     v
              resolve-room -> ROOM_DIR=""   resolveRoomsHome() -> null
                            |               no ~/MindrianRooms
                            v                     |
                  COLD START branch (:622)        v
                            |            emit {continue:true}
                            v            *** SILENT - no reward ***
              banner (:629) De Stijl Mondrian
                  = EXTERNAL TRIGGER
                            |
                            v
              check-onboard (:647) -> "FIRST_INSTALL"
                            |
                            v
              touch ~/.mindrian/auto-update (:662)
                            |
                            v
     +----------------------------------------------+
     |  context = stable_prefix + FIRST_INSTALL      |
     |  prose block  (:666, ONE bash string)         |
     +----------------------------------------------+
                            |
                            v
              injected as additionalContext
                            |
                            v
     +----------------------------------------------+
     |   LLM TURN - every leg below is a REQUEST,    |
     |   not a guarantee. No verifier downstream.    |
     +----------------------------------------------+
        |            |            |            |
        v            v            v            v
   warm opener   3 choices    "domain      "build a
   (TRIGGER)     as ASKUSER-  intelligence" USER.md at
                 QUESTION     (REWARD?)    ~/.mindrian-
                 CARD (fixed     |          user.md"
                 267.1-01)       |         (INVESTMENT?)
                    |            |            |
                    |            v            v
                    |     no wired call   NO WRITER
                    |     sweepDomain-    EXISTS
                    |     Insights not    (see Gap I-1)
                    |     reachable
                    v
              COLD_START_MENU (:657)
              /mos:new-project, /mos:help,
              /mos:diagnose, /mos:update
              *** /mos:ignite ABSENT ***
                    |
                    v
        model MAY run check-onboard --write
        (writes version + date to ~/.mindrian-onboarded)
        If it does not: FIRST_INSTALL fires again next session
```

Note on this appendix versus RESEARCH.md's original diagram: the ACTION box above has been updated to reflect the SEED-021 fix that shipped in plan 267.1-01 (the pre-fix diagram read "3 choices as PROSE"). Everything else in this diagram is unchanged.

## Appendix B: the FIRST_INSTALL prose, verbatim

The literal text a first-time user's model receives, unescaped from the bash string at `scripts/session-start:666`. Updated in-phase (plan 267.1-01) to include the SEED-021 clause; the pre-fix commit is `86a9af2728077e715e5f6a0ebf7ac9d6dcc1d50c`.

```
[MindrianOS Onboarding] First install detected.

This is the user's very first session with MindrianOS. Welcome them warmly using one of
your signature openers ("Very simply...", "Here's the thing...", "One thing I've learned...").
Be conversational and direct. No emoji. No filler phrases like "I'd be happy to help" or
"Great question!".

Your goal: build deep context about this user so every future interaction is smarter.

Start by asking who they are and what they do. Frame it as valuable, not bureaucratic:
"Five minutes here saves hours later -- I'll know your domain, your goals, and how to
actually help."

Offer three approaches - fire the AskUserQuestion card with these three as options; default
to option 3 (Skip) if the user starts talking instead of picking; never render this menu as
a prose list (SEED-021):
1. Conversational Q&A -- you ask 3-5 questions about their role, domain, current focus, and goals
2. Document paste -- "Paste your LinkedIn bio or a short blurb about yourself and I'll build
   your profile from that"
3. Skip -- "You can skip this entirely and jump straight to working. I'll learn about you as we go."

If the user engages with approach 1 or 2, build a USER.md file in their home directory
(~/.mindrian-user.md) capturing: name, role, domain, subdomain, technical level, current
focus, goal, expertise areas.

If they provide context, follow up with domain intelligence: "Based on your work in [domain],
here is what I already know about your space" -- then suggest relevant frameworks and room sections.

After building context OR if the user skips, present capabilities as natural actions
(not slash commands):
- You can tell Larry about a meeting you had and he will file and analyze it
- You can ask Larry to diagnose what type of problem you are working on
- You can ask Larry to grade your venture honestly
- You can ask Larry to find relevant grants and opportunities
- You can ask Larry to get 6 different perspectives on your work
- You can ask Larry to query your knowledge graph
- You can start a new project and Larry will set up your Data Room

After the onboarding conversation completes or the user skips, run:
bash "${PLUGIN_ROOT}/scripts/check-onboard" --write

Then show the command menu below.

---
Get started:
  /mos:new-project .... Start a new venture project
  /mos:help ........... See what Larry can help with
  /mos:diagnose ....... Classify your problem type

Or just talk -- Larry is a thinking partner first.
Type /mos: to see ${LIVE_COMMAND_COUNT} commands.
  /mos:update ......... Check for latest features
---
```

## Appendix C: how to reproduce these findings

Isolation recipe for the reachability claim (a genuine first install has no `~/.mindrian-onboarded` marker):

```bash
TMPHOME=$(mktemp -d)
HOME="$TMPHOME" USERPROFILE="$TMPHOME" bash scripts/check-onboard   # expect: FIRST_INSTALL
```

Do NOT delete the real `~/.mindrian-onboarded` to test this -- use an isolated `HOME`/`USERPROFILE` override, never the live marker. `MINDRIAN_ROOMS_ROOT` / `MINDRIAN_ROOMS_HOME` are the supported seam for overriding the rooms root the same way.

Every machine-checkable claim in this document is pinned as a regression test in `tests/test-267-1-first-install-hooked-audit.cjs` (8 assertions: GAP I-1's no-writer claim, GAP R-1's `sweepDomainInsights` absence and `/mos:ignite` menu omission, the Action leg's SEED-021 presence, the reward/USER.md prose literals remaining unchanged by design, GAP G-1's linter scope, the virgin-HOME reachability check, and a `bash -n` syntax proof). Run the whole phase suite with `bash tests/run-all-267.1.sh`.

## Canon compliance note

This audit is a Canon Part 6 dog-fooding act: it audits the plugin's own onboarding flow against its own hard rule, using evidence (the dogfood filesystem state) drawn from the maintainer's own machine. Part 8 (Graph Boundary) is trivially satisfied -- this document is produced entirely from local file reads; it opens no Brain wire and egresses nothing. Part 12 (Pedagogy / Invisibility) constrains every recommendation above: any fix that raises the `/70` score at the cost of Larry becoming more visible, more insistent, or more praise-seeking would itself be a Part 12 violation, independent of the score.
