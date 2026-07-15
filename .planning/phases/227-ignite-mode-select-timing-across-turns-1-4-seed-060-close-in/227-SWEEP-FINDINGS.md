# Phase 227 Plan 02: Methodology Skill Sweep Findings (Req 2, CIRS R4 loose-description bypass)

**Purpose:** close item 2 of `ignite-frontdoor-bypassed-methodology-overfire.md`'s
`fix_remaining` list verbatim: "SYSTEMIC sweep: other methodology skills for the same
loose-description bypass (CIRS R4 no-second-selection-brain)." Every `skills/*/SKILL.md`
in the repo is scanned by `scripts/sweep-skill-descriptions.cjs` and classified below;
zero skills are silently skipped.

**Heuristic (D-06):** a skill is a candidate for review if its frontmatter declares a
non-empty `sensor_triggers` array (auto-fire capable by construction; none exist live in
this repo today, confirmed by this sweep) OR its `description` reads as a broad/casual
invitation rather than an explicit-intent gate. Description-tightness is classified
`tight` when the text contains an explicit-intent gating marker (case-insensitive
match on "only when", "explicitly", "on request", "do not use for", "never use for");
otherwise `loose`. A `loose` classification is a candidate for a human look, not an
automatic verdict -- many skills are short command-purpose descriptions that were never
meant to gate a conversational auto-reach, and are correctly `clean` on inspection.

**Calibration reference:** `skills/trending-to-absurd/SKILL.md` (post its 2026-06-24 FIX
1 + FIX 2, commit `7868dfbb`). Its live description contains "Use ONLY when the
navigator EXPLICITLY asks" and "Do NOT use for general exploration", so it is the
confirmed-tight positive the heuristic must classify correctly; `scripts/sweep-skill-descriptions.cjs`
self-tests against this exact file before scanning the other 123, and fails closed
(exits 1, refuses to scan) if the self-test does not pass.

**Fix-vs-defer bar (SPEC boundary, D-06/D-07):** `fixed-trivial` covers a one-line
`description` tightening (an explicit-intent qualifier or a "do not use for" exclusion,
the same shape as `trending-to-absurd`'s own FIX 2) or a simple in-file orchestrator-level
restraint addition. Anything requiring new code, new gates, cross-file changes, or
genuine design work is `deferred-real-work`, named with a one-line reason, not fixed here
-- mirroring the precedent in `intern-w1-mode-gate-skip.md`, where a related sweep found
55 pre-existing contradictions and only the one named instance was resolved in-session.

**Defensive rule applied:** `skills/conversation-mode/SKILL.md` and
`skills/larry-personality/SKILL.md` both flagged `loose`, but per this plan's explicit
instruction neither is fixed inline here -- both are edited elsewhere in this same phase
(227-03 / 227-04), and a same-file edit here would risk a cross-plan conflict. In
practice neither is genuinely invocation-shaped in the CIRS R4 sense
(`conversation-mode` is `connector.excluded: true`, ambient always-on infra;
`larry-personality` is core personality doctrine, not an invocable methodology), so this
is a safety net, not evidence of a real defect.

## Findings

| Skill | sensor_triggers | description-tightness | Verdict | Fix commit | Notes |
|-------|------------------|------------------------|---------|------------|-------|
| MOSDeckEngine | [] | tight | fixed-trivial | f6dda07d | loose "Use when translating..." invitation with a casual "explain complex concept" trigger tightened to an explicit-intent gate + do-not-use-for exclusion (same shape as trending-to-absurd FIX 2) |
| act | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| admin | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| agentshield | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| analyze-needs | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| analyze-systems | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| analyze-timing | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| auto-explore | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| beautiful-question | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| bono | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| brain-connector | (absent) | loose | clean | - | activation is a structural state/config gate ("Active when Brain API key is set..."), not casual-language matching; not the CIRS R4 bypass pattern |
| brain-derive | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| build-knowledge | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| build-thesis | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| causal | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| challenge-assumptions | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| client-discovery-interview | [] | tight | fixed-trivial | ae822e84 | quoted casual-sounding trigger phrases tightened to fire only on an explicit new-client-engagement signal, with a do-not-use-for exclusion for general conversation about a live product |
| compare-ventures | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| context-engine | (absent) | loose | clean | - | ambient session-substrate skill (USER.md/context management), ships every turn by design, not a heavyweight methodology reach |
| conversation-mode | (absent) | loose | deferred-real-work | - | touched by a concurrent Phase 227 plan (227-03 or 227-04), avoid a cross-plan file conflict |
| correct-reference-now | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| dashboard | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| deck | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| deep-grade | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| diagnose | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| diagnostics | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| dial-memory-refresh | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| diffusion | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| discover | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| doctor | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| dogfood-flush | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| dominant-designs | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| eureka | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| explain-decision | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| explore-domains | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| explore-futures | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| explore-opportunity | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| explore-trends | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| export | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| feynman-timeline-refresh | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| file-meeting | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| find-analogies | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| find-bottlenecks | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| find-connections | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| funding | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| futures | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| grade | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| graph | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| hat-briefing | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| heal | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| help | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| hmi-status | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| ignite | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| ingest-methodology | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| intel-pipeline | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| intelligence-orchestrator | (absent) | loose | clean | - | the reach dispatcher itself: by its own description it "never auto-executes" and always "surfaces ONE reach as a Shape-F Decision Gate" -- the mitigation pattern is already structurally built in |
| jtbd | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| larry-personality | (absent) | loose | deferred-real-work | - | touched by a concurrent Phase 227 plan (227-03 or 227-04), avoid a cross-plan file conflict |
| leadership | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| lean-canvas | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| macro-trends | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| map-unknowns | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| memory | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| memory-cortex-reach | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| models | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| mos | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| mos-reason | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| mullins | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| mullins-scaffold | [] | tight | fixed-trivial | af0bac54 | "Relevant when creating a new venture room, running an opportunity assessment..." tightened to fire only on an explicit Mullins/Seven-Domains ask or an ignite-resolved directive, with a do-not-use-for exclusion |
| mva-brief | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| mva-option | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| mva-pipeline | [] | loose | clean | - | activation is hook-driven (UserPromptSubmit classifier), not Claude-judgment description matching -- structurally a different mechanism than the CIRS R4 bypass class |
| mva-report | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| new-project | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| new-surface | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| onboard | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| operator | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| opportunities | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| organize | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| persona | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| pipeline | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| present | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| publish | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| pws-methodology | (absent) | loose | clean | - | reference/routing substrate for Larry's own methodology awareness, not itself a heavyweight pipeline invocation |
| qualify-opportunity | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| query | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| radar | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| reanalyze | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| research | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| room | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| room-passive | (absent) | loose | clean | - | activation is a structural state gate ("Active when room/ exists"), not casual-language matching; not the CIRS R4 bypass pattern |
| room-proactive | (absent) | loose | clean | - | activation is a structural state gate ("Active when room/ exists with entries"), not casual-language matching; not the CIRS R4 bypass pattern |
| rooms | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| root-cause | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| rs-experts | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| rs-explain | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| rs-fetch | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| rs-thesis | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| scenario-plan | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| scheduled-tasks | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| score-innovation | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| scout | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| setup | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| show | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| skill | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| snapshot | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| speakers | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| splash | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| stance | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| status | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| structure-argument | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| suggest-next | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| systems-thinking | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| think-hats | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| trending-to-absurd | [] | tight | clean | - | calibration reference; already fixed 2026-06-24 (commit 7868dfbb), this phase made no change |
| ui-system | (absent) | loose | clean | - | ambient CLI rendering substrate ("Auto-loaded on every session"), not a methodology reach |
| update | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| user-needs | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| validate | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| value-proposition | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| vault | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| visualize | (absent) | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| whitespace | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |
| wiki | [] | loose | clean | - | terse command-purpose description, not a broad/casual conversational invitation; no CIRS R4 bypass risk pattern detected |

## Summary

- Total scanned: **124** (matches the live `skills/*/SKILL.md` count at execution time; the
  227-CONTEXT.md planning-time sanity expectation was 123, one skill was added between
  planning and execution, not an error).
- **clean: 119**
- **fixed-trivial: 3** (`MOSDeckEngine` commit `f6dda07d`, `client-discovery-interview`
  commit `ae822e84`, `mullins-scaffold` commit `af0bac54`)
- **deferred-real-work: 2** (`conversation-mode`, `larry-personality` -- both per the
  defensive rule above, not because a genuine fix was found and skipped)
- 119 + 3 + 2 = 124, matching the total scanned. Zero skills silently missing.
- `sensor_triggers` is `[]` or absent for all 124 skills scanned; the live risk surface
  today is entirely in `description` text, matching 227-CONTEXT.md's planning-time
  finding.

## Out of scope (named, not fixed)

Per the SPEC boundary, fixing every skill this sweep's heuristic flags `loose` is
explicitly out of scope -- only genuinely one-line-fixable instances were fixed inline
(3 found). The 119 `clean` verdicts above are not "deferred"; they are a human
judgment call that the described risk pattern (a broad/casual invitation matching
trending-to-absurd's own pre-fix shape) does not apply to that skill, with a one-line
reason recorded per row. No further sweep-driven work is queued for a follow-up phase
beyond the 2 explicitly deferred rows, which are deferred for a cross-plan-conflict
reason, not a design-complexity reason.
