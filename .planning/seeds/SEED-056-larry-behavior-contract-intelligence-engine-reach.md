---
seed: SEED-056
title: "Larry behavior contract: wire the 219/220/221 intelligence engines AND the eureka engine (211-216) into reach + define web-query and Shape-F/brain-consult behavior"
filed: 2026-07-13
status: proposed
filed_by: navigator, mid-conversation during the 219+220+221 release wave
scope_broadened: "2026-07-14, navigator-directed ('adjust the larry behavior contract to utilize the eureka engine and brain work properly with f-shapes'). Was scoped to 219/220/221 only; now explicitly includes the eureka engine (Phases 211-216, seeds SEED-049/050) and a Shape-F/brain_consult reconciliation pass. See the new sections below; the original 219/220/221 scope is unchanged, not replaced."
---

## The gap

Phases 219 (opportunity follow-through: harvest sensor, qualification card, explore
chain), 220 (web ingestion: URL mode, pasted-URL sensor, crawl loop), and 221 (LLM
engine recovery: typed envelopes, recovery dispatcher, bounded controller) all just
shipped real, tested, working capability. None of it is yet reflected in Larry's own
behavior contract (`skills/larry-personality/SKILL.md`, the agent frontmatter, the
Voice/Decision-Gate rules) - the engines are born-wired at the CODE/reach-machinery
level (SENS-14/15 register, dispatch, fire cards) but Larry's PERSONA-level
instructions do not yet say when he should reach for them in ordinary conversation,
nor how he should behave around the web-query legs specifically (when to ingest a
pasted URL vs. just discuss it, when to offer [Explore], how to talk about a
`llm_engine_recovery` / `manual_intervention_required` result in Larry's voice
rather than raw JSON).

This is the exact "dark capability" failure class the CIRS (Part 11) work has fought
all along: a surface can be technically wired and still never fire because nothing
in Larry's own reasoning points him at it.

## The eureka-engine gap (added 2026-07-14, same failure class, different phases)

Checked directly against `skills/larry-personality/SKILL.md` (448 lines): every occurrence
of the word "eureka" in that file is about the PEDAGOGICAL concept (Usher 1929's four-step
insight cycle, "the eureka belongs to you, the reach belongs to the tool" -- the theoretical
grounding for the Ask-Tell dial). There is ZERO mention of the shipped `/mos:eureka` command
or the Phase 211-216 engine anywhere in Larry's own behavior contract. Same dark-capability
shape SEED-056 already names for 219/220/221, confirmed present for a second, larger cluster
of shipped capability -- and worth flagging precisely because it risks a WORSE failure than
219/220/221's silence: the overloaded word itself. "Eureka" already means something specific
and load-bearing in Larry's pedagogy; adding engine-level guidance under the same word without
explicit disambiguation risks Larry's own reasoning conflating "the eureka" (the concept) with
"/mos:eureka" (the command), which would be a new confusion this seed must not introduce.

Two DISTINCT eureka-adjacent reach paths exist today, verified by reading the actual
connector declarations, not assumed to be one thing:

1. **SENS-13's per-turn nudge** (`lib/core/sensors/sensor-eureka.cjs:66`, `REACH_ID =
   'deep_research'`): fires the `deep_research` reach candidate mid-conversation when a
   eureka bridge signal is detected. This is the LIGHTWEIGHT, proactive "there might be
   something here" nudge, riding the FROZEN `deep_research` reach, no 7th reach minted.
2. **`/mos:eureka` the command itself** (`commands/eureka.md`, Phase 216, `reach_id:
   context_block`, `sub_mode: eureka-portfolio`, `hitl_shape: "F.8"`, `sensor_triggers:
   [SENS-13]`): the HEAVY, on-demand tri-modal portfolio scan (`run|status|report`),
   ranked opportunity candidates surfaced as an independent any-order set (Shape F.8's
   semantics -- confirmed via its own `hitl_why` line).

Larry's persona contract needs to distinguish these two explicitly: when SENS-13 fires,
what does Larry SAY (the deep_research nudge, in voice, not raw sensor language) versus
when/whether Larry proactively suggests running the full `/mos:eureka` portfolio command
(a heavier, more deliberate ask than a nudge -- likely gated on room maturity, e.g. the
30-entry floor `/mos:eureka` itself already enforces before it produces real pairs). This
seed should NOT assume the two paths collapse into one behavior; they are two different
weights of "reach for eureka" and deserve two different voice treatments.

## The Shape-F / brain_consult reconciliation (added 2026-07-14)

Checked `skills/larry-personality/SKILL.md`'s existing `brain_consult` coverage (line 91,
98): a real, already-written behavior contract exists for the PROACTIVE Brain push
(SENS-03 -- "Brain has a chain that addresses this... Pull it in?", ending at a Decision
Gate, Part 8 generic-handles-only, the push is the OFFER not the fetch). This is NOT a gap
the same way eureka is -- `brain_consult` already has real persona-level prose. What IS
worth reconciling, per the navigator's explicit ask ("brain work properly with f-shapes"):
whether this existing brain_consult prose stays internally consistent once the eureka
additions land (both `deep_research`'s SENS-13 nudge and `brain_consult`'s SENS-03 push are
FROZEN-reach-riding proactive offers that end at a Decision Gate -- they should read as one
coherent family of "how Larry proactively offers a reach" prose, not as two differently-
voiced patterns that happen to sit near each other in the file), and whether any FUTURE
eureka-related Brain integration (e.g., if the eureka engine's cross-domain scoring ever
calls Brain for generic framework/methodology context, distinct from its current LOCAL-only
tri-modal room.db retrieval) would need its own Shape-F-declared gate rather than riding
silently inside `/mos:eureka`'s existing F.8 without a stated `hitl_why` covering that leg.
This is a reconciliation/consistency pass, not a new capability -- explicitly scoped to
"does the prose hang together," not "build new Brain wiring for eureka." Caveat, stated
honestly rather than overclaimed: this session did NOT directly re-verify `lib/core/eureka/*`'s
Part 8 posture line-by-line -- the LOCAL-only, zero-Brain-calls tri-modal retrieval claim
comes from Phase 211-216's own ROADMAP entries and the sibling opportunity-harvest-formula
design doc, not a fresh code read this turn. Whoever picks this seed up should confirm that
directly before writing persona prose that asserts it. This reconciliation is about Larry's
DESCRIPTION of the existing surfaces, not a claim about verifying their code here.

## The comprehensive audit (added 2026-07-14, navigator-directed: "make sure the larry
personality knows all major and minor workflows to understand when to invoke")

Full command-surface audit run this session, not a spot-check: all 110 `commands/*.md`
frontmatter entries parsed directly, cross-checked against `data/connector-registry.json`
(196 connectors), against the combined coverage of the 5 skills that shape Larry's
behavior (`larry-personality`, `room-passive`, `room-proactive`, `context-engine`,
`conversation-mode`). Result: **30 COVERED, 58 PARTIALLY COVERED, 22 DARK.**

**The structural finding, bigger than any single gap:** eureka and ignite are not isolated
incidents, they are one instance of a repeating pattern -- **sibling-of-a-named-command**.
A command FAMILY shares one `reach_id`, one family member gets named in Larry's persona
prose, and its siblings riding the exact same reach stay invisible:

- **Reverse Salient family** (`context_block`, `reverse-salient-*` sub_modes):
  `find-bottlenecks` is named. `rs-experts`, `rs-explain`, `rs-thesis`, `rs-fetch` are not
  -- all real, sensor-triggered (SENS-02), all carry real `hitl_shape`s. 4 of 5 invisible.
- **Six Hats family** (`hats` reach): `think-hats`/`persona` named. `bono` (SENS-05, F.5)
  and `hat-briefing` (SENS-07, F.8) are unnamed siblings.
- **Grade family** (`brain_consult`): `grade` named. `deep-grade` (SENS-06/07, F.8) unnamed.
- **Opportunity-harvest family** (Phase 219): `opportunities` named.
  `qualify-opportunity`/`explore-opportunity` (SENS-14) unnamed -- a DIFFERENT capability
  (harvest/qualify) than the named sibling (bank browsing), the "sounds similar, actually
  distinct" trap.

The 22 DARK commands are all correctly `connector.excluded:true` utility/admin surfaces
with zero sensor triggers -- per Part 11 R1 they are deliberately outside the reach system,
navigator-invoked directly, not something Larry should reason toward. None rank high-impact.
Two worth a light mention regardless (frequently-relevant even though structurally
excluded): `help` (the command index, not named anywhere Larry might point a lost
navigator to it) and `doctor` (install/health diagnostics, central per CLAUDE.md's own
Verification section, absent from persona prose).

**Prioritized PARTIALLY COVERED list (real sensor + real hitl_shape, highest impact
first):** `eureka` (known, SEED-056's original finding), `research` (known -- hosts
Phase 220's SENS-15 URL-ingest offer AND Phase 221's recovery-disclosure voice, both
riding this ONE command with zero dedicated persona prose), `qualify-opportunity` +
`explore-opportunity` (known, Phase 219), `hat-briefing`, `rs-explain`/`rs-experts`/
`rs-thesis`, `bono`, `discover`, `deep-grade`, `build-thesis` (a flagship Ten-Questions
investment gate, unnamed), `mva-brief`/`mva-option`. Roughly 40 remaining lower-priority
framework/analysis commands are partially mitigated by the Provoked table's
framework-name-based resolver (they surface via framework name even without a literal
slug mention) -- genuinely lower stakes than the sensor-wired sibling-family gaps above.

**New, sharper finding on ignite specifically, beyond what this seed's earlier eureka
section already named:** ignite IS mentioned once -- but only in `conversation-mode.md`
("`/mos:ignite`'s Gate B0"), never in `larry-personality.md` itself. Worse:
`conversation-mode.md`'s own Mode 3 ("Building something") still instructs Larry to invoke
`/mos:new-project` DIRECTLY, even though `ignite.md`'s own body states ignite is now the
canonical front door and `/mos:new-project` is just its scaffold backend. The persona layer
has not caught up to the command layer's own stated hierarchy -- this is worth fixing
alongside SEED-060 (which owns the broader ignite/mode-select timing question) rather than
as a separate finding, since it is the same underlying surface.

**26 commands carry `connector.excluded:true` alongside a real `hitl_shape`** (the audit's
own list: `admin`, `brain-derive`, `correct-reference-now`, `doctor`, `dogfood-flush`,
`export`, `feynman-timeline-refresh`, `heal`, `help`, `hmi-status`, `models`, `mos`,
`onboard`, `organize`, `publish`, `query`, `radar`, `rooms`, `scheduled-tasks`, `setup`,
`snapshot`, `splash`, `stance`, `update`, `vault`, `visualize`) -- this matches the
already-documented, already-known 55-instance repo-wide finding in
`.planning/debug/resolved/intern-w1-mode-gate-skip.md` (predicate 2b, the dual-purposed
`excluded` field, explicitly left for a future field-split phase). Flagged here for
completeness only; NOT re-analyzed, not this seed's problem to solve.

**Methodology sanity check (the audit's own):** all 5 previously-confirmed instances
(eureka, ignite, Phase 219/220/221) reproduced independently under this fresh pass with no
divergence from this seed's own earlier findings -- cross-validates rather than contradicts
the eureka-gap and Shape-F sections above.

## What this seed should cover when picked up

1. Update `skills/larry-personality/SKILL.md` (and/or the agent frontmatter's
   Operating-the-machinery section) to name the three 219/220/221 engines AND the
   eureka engine (211-216) explicitly as reach candidates, alongside the existing
   6 live reach-ids + 8 sensors (now more, per Phase 219/220's SENS-14/15 additions).
1a. **(added 2026-07-14)** Disambiguate "the eureka" (Usher-cycle pedagogical concept,
    already load-bearing in the file) from "/mos:eureka" (the Phase 211-216 command) in
    whatever prose gets added -- do not let the same word carry two meanings silently.
    Write distinct voice guidance for SENS-13's per-turn `deep_research` nudge versus
    a proactive suggestion to run the full `/mos:eureka` portfolio command -- see "The
    eureka-engine gap" section above for the verified reach_id/sub_mode split.
1b. **(added 2026-07-14)** Reconciliation pass over the existing `brain_consult`
    (SENS-03) prose alongside the new eureka additions so both read as one coherent
    "how Larry proactively offers a reach" family -- see "The Shape-F / brain_consult
    reconciliation" section above. Confirm the eureka engine's LOCAL-only Part 8
    posture directly against `lib/core/eureka/*` before asserting it in persona prose
    (not yet re-verified this session, see the caveat above).
2. Define Larry's WEB-QUERY BEHAVIOR CONTRACT specifically: when a pasted URL
   should trigger the [Ingest]/[Ingest+Explore]/[Skip] offer vs. when Larry should
   just discuss the link normally (D-05's dedup + quote/code-fence exclusion
   already exists at the sensor level; the PERSONA-level judgment - "is this URL
   germane to the venture" - is not yet specified).
3. Define how Larry discloses a recovery outcome (`llm_engine_recovery`,
   `manual_intervention_required`, `insufficient_evidence`, the D-11
   `spend_limit_exceeded` case) in his own voice - Part 12 pedagogy (never a raw
   dump, never a verdict-only line) applied to the new disclosure fields 221-04
   just shipped.
4. Define when Larry proactively surfaces an [Explore]-able qualified opportunity
   vs. waits for the navigator to ask - the harvest sensor already ranks
   candidates into the F.1 selector; this is the "should Larry ever say
   unprompted 'I found something'" behavior question.
5. Reconcile against SEED-054-BQ (the beautiful-question -> harvest pointing
   pipeline) and the still-open Track 1 engine rewire (find-connections/
   find-analogies/HSI onto room.db) - this seed is about Larry's BEHAVIOR wiring,
   Track 1 is about the ENGINES' data source; distinct, likely sequenced together.

## Why now, why not now

Real and worth doing - but NOT part of the 219+220+221 release wave already staged
tonight (scope discipline: this is new capability-usage behavior, not a defect in
what shipped). Natural next phase after the joint cut lands and the navigator has
lived with the shipped engines for a session or two - persona tuning benefits from
seeing how the engines actually surface in practice first.
