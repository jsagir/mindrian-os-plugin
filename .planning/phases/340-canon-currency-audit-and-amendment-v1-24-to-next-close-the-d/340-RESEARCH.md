# Phase 340: Canon Currency Audit and Amendment (v1.24 to next) - Research

**Researched:** 2026-09-05
**Domain:** Constitutional-document currency audit (docs/MINDRIAN-CANON.md, a hand-maintained
markdown constitution with a navigator-gated amendment mechanism, floor-test enforcement, and a
version-history ledger) against a fast-moving codebase (MindrianOS-Plugin).
**Confidence:** HIGH for every claim below marked `[VERIFIED: grep/Read]` or `[VERIFIED: node -e]`
- every one of them was produced by a live command against the checked-out repo this session, not
recalled from training data. MEDIUM for claims about what the eventual amendment PROSE should say
(that is a navigator-gated decision this research cannot make). LOW/absent for anything about the
langtalks corpus beyond what was directly relayed with citations (see Sources).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Local-graph chokepoint doctrine (Part 9) - LOCKED**
- **D-01:** Deeper doctrinal split, not a light citation. Part 9's "What this means
  architecturally" subsection (and/or a new subsection) must formally name TWO separate
  constitutional chokepoints where today it names one: `lib/core/navigation.cjs` (the read/
  navigate chokepoint, already cited) and `lib/core/node-insert.cjs` (the write chokepoint,
  shipped by Phase 276's TOOLHON work per this session's own audit of that phase - 16+18 write
  sites routed through it, fail-closed `epistemic_type` validation live). The two chokepoints
  are DIFFERENT constitutional properties (navigate vs. write) and should read as two named
  things, not one citation folded into existing prose about `navigation.cjs` alone.

**ICM schema currency (Appendix B) - LOCKED**
- **D-02:** Add real code citations. Appendix B's Layer table (today pure concept-to-Part
  mapping, zero file citations - unusual for this Canon, which cites concrete files everywhere
  else) gets pointers to Phase 275's actually-shipped L1-L3 mechanisms: the L1 `STATEMENT`
  field, the L2 per-section `CONTEXT.md` writer, the L3 `references/`/`_shared/` factory
  directory. `lib/core/room-skeleton-scaffold.cjs` is the implementing file per Phase 275's own
  CONTEXT.md.

**Scope boundary (Sourced Claims + Theo) - EXPANDED, not narrowly scoped**
- **D-03:** Navigator explicitly declined the narrow "one Part 12 clause" and "one factual-
  correction entry" framings this session proposed. The real instruction: revisit the FULL
  Canon against what MindrianOS currently is, what it needs to be, its current stack and
  architecture, its JTBD, and Larry's actual behavior contract. Sourced Claims Doctrine and the
  Theo cutover are IN this full-revisit scope, not separately narrow-scoped amendments landing
  on their own. Whether they end up as one Appendix D entry each or fold into a larger single
  wave is Claude's Discretion at planning time, informed by whatever the full part-by-part audit
  actually finds (a genuine research question, not decided here).

### Claude's Discretion
- Whether the eventual amendment lands as multiple Appendix D entries (mirroring the
  entries-32+33 paired-landing precedent) or fewer larger entries covering multiple Parts each -
  depends on what the research step actually finds part-by-part.
- Exact Appendix D entry prose, matching the established style (navigator-approval-before-any-
  byte, provenance paragraph, frozen-scalar unweakened assertions, floor test naming) - a
  planning/execution-time task, not decided in this discussion.
- Whether "current JTBD" and "current stack/architecture" currency requires reading beyond the
  four already-surfaced fronts (e.g., Part 11's declared-surface count, which the Canon itself
  already states is "NEVER a frozen scalar... enumerated from disk at run time" - worth
  re-verifying the live count against today's `scripts/build-connector-registry.cjs --check`
  output rather than assuming the last-cited number still holds). **This research step ran that
  re-verification - see "Part 11" below. The count has moved substantially since the last
  illustrative snapshot.**

### Deferred Ideas (OUT OF SCOPE)
- Harness-as-code detector (check-tool-honesty.cjs sibling for prose-fabrication) - named
  explicitly as phase-2, dependent on SEED-032/SEED-062, not buildable until that harness
  exists. Do not fold into this phase even under the widened scope - it is a different KIND of
  work (new detector code) from a Canon currency audit (constitutional text + persona-file
  currency), and the navigator's own SEED-086 finding already named this split.
- Registry-drift gate keyed to F-shape, F7 rescope Phases 212/213, Ingest skill-description
  insight into Brain, Deck generation slide count, Never git stash mid-merge-conflict - all
  reviewed-and-not-folded per CONTEXT.md; none relate to Canon text currency.
</user_constraints>

<phase_requirements>
## Phase Requirements

No requirement IDs have been minted for this phase (confirmed: `.planning/ROADMAP.md`'s Phase
340 entry states `**Requirements**: TBD`, unlike the TOOLHON-/ICML-/CHOKE-/PYPORT-/ANCHOR-
precedent phases that mint an ID family at plan time). **Recommendation for the planner: mint a
`CANON-NN` family at plan time**, one ID per Part or Part-cluster this phase amends, so the
eventual Appendix D entries and floor tests have a stable requirement handle the same way
`tests/test-canon-entry-36-shape-declaration-floor.cjs` traces to Phase 190's ratified R16. A
draft mapping (subject to the plan step's own judgment on wave boundaries):

| Draft ID | Description | Research Support |
|----------|-------------|-------------------|
| CANON-01 | Part 12 Sourced Claims Doctrine sub-clause (hedged-opinion vs hedged-fabrication) | See "Part 12" below; SEED-086 + Aronhime incident are the traced source; `agents/larry-extended.md` needs the mirror per CONTEXT.md's canonical_refs |
| CANON-02 | Appendix C Theo cutover (Glossary Brain definition + any Part 8 prose needing the Brain-names-a-role framing) | See "Appendix C" below; live default confirmed `theo-mcp.onrender.com`, glossary still says `pws-brain-mcp.onrender.com` |
| CANON-03 | Part 9 two-chokepoint doctrinal split (navigation.cjs + node-insert.cjs) | See "Part 9" below; exact citations and call-site counts verified live |
| CANON-04 | Appendix B code citations (L1 STATEMENT, L2 CONTEXT.md writer, L3 references/ factory) | See "Appendix B" below; exact file:line citations verified live |
| CANON-05 (new finding, not in the original 4-front floor) | Part 4 edge-vocabulary prose reconciliation - 15 shipped edge types absent from Part 4's closed-vocabulary prose | See "Part 4" below |
| CANON-06 (new finding) | Part 7 "25 methodology commands" figure - stale by ~4.5x against the live `commands/` directory | See "Part 7" below |
| CANON-07 (new finding) | Part 2 Engine 1 Pinecone-backend prose - stale against the shipped e5-local / Pinecone-retired stack | See "Part 2" below |
| CANON-08 (new finding, likely NO ACTION needed) | Part 11 declared-surface-count snapshot ("126") - stale, but the doctrine text already self-disclaims as non-frozen; may only need the illustrative number refreshed, not a doctrine change | See "Part 11" below |

</phase_requirements>

## Summary

This phase audits a 12-Part, 4-Appendix, 37-entry constitutional document
(`docs/MINDRIAN-CANON.md`, v1.24, last touched 2026-06-25) against a codebase that has shipped
roughly 70 days of continuous, canon-amending phase work since. The navigator explicitly
rejected a narrow four-front framing during discussion and asked for a genuine part-by-part
sweep. This research ran that sweep with live tool calls (grep, Read, `node -e` against the
actual shipped modules) rather than inference, per the phase's own discipline ("never assert a
claim without a real check behind it").

**Result: the four originally-named fronts are all independently confirmed live (Sourced Claims
absent from Part 12, zero Theo mentions + stale Brain URL in Appendix C, `node-insert.cjs`
confirmed shipped and doing exactly what CONTEXT.md claims, Appendix B confirmed to carry zero
file citations). Beyond the floor, this audit surfaced FOUR additional, independently verified
currency gaps the navigator has not yet seen**: Part 4's edge-vocabulary prose is missing 15
shipped edge types (the closed-vocabulary list undercounts the live `ALLOWED_EDGE_TYPES` set by
more than half); Part 7's "25 methodology commands" figure (repeated 3x in CLAUDE.md and once in
the Canon) is stale by roughly 4.5x against the live `commands/` directory (113 files); Part 2's
Engine 1 doctrine still names Pinecone as the live cross-domain-match backend though CLAUDE.md's
own stack table states plainly "Pinecone is RETIRED"; and Part 11's illustrative "126 declared
surfaces" snapshot is now understated by roughly 2x (the doctrine text is self-aware that this is
"never a frozen scalar," so this may need only a refreshed illustrative number, not new prose).

Parts 1, 2a, 3, 6, and 10 were checked and found CURRENT - no drift detected against the live
codebase for those Parts in this pass (see per-Part notes below for what was actually checked, so
the planner can trust this is a real finding and not an unstated skip).

**Primary recommendation:** Plan this as a multi-wave amendment following the Canon's own
established "ONE atomic lockstep wave per amendment, CI never goes RED" pattern (see
"Architecture Patterns" below) - likely 2-3 waves given the number of independently-landing
findings, each wave bumping the canon version once, each carrying its own floor test in the
`tests/test-canon-entry-NN-*-floor.cjs` family, gated behind a navigator-APPROVE blocking
checkpoint before any canon byte lands, exactly as all 37 prior entries did.

## Architectural Responsibility Map

This phase is pure documentation/constitutional-text work; there is no browser/server/API tier
split to reason about. The relevant "tiers" are instead the Canon's own five-role separation
(Part 9) plus the doc-vs-code boundary this phase must respect:

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Canon prose amendment (the actual bytes in `docs/MINDRIAN-CANON.md`) | Constitutional text (files preserve meaning, Part 9 role 1) | - | This phase's entire deliverable; never a code change on its own |
| Larry persona mirror (Sourced Claims into `agents/larry-extended.md`) | Agent system-prompt (Files preserve meaning) | Constitutional text | CONTEXT.md's own canonical_refs name this as a required mirror, not optional; the doctrine must land in BOTH places per the SEED-086/Aronhime precedent already acted on this session |
| Floor test enforcement (`tests/test-canon-entry-NN-*.cjs`) | Local verification (Node `assert`, zero framework) | Constitutional text | Every prior amendment shipped a byte-presence/absence assertion against the Canon file itself; this is NOT application code, it is a doc-integrity gate |
| Version-history ledger (`docs/CANON-PHASE-MAP.md`) | Constitutional text (bookkeeping) | - | Moves in lockstep with the Canon header/footer version line, per every one of the 37 prior entries' own stated manifest |
| Live code the Canon CITES (`lib/core/node-insert.cjs`, `lib/core/navigation.cjs`, `lib/core/room-skeleton-scaffold.cjs`, `lib/core/brain-client.cjs`) | Backend/local-graph (already shipped, out of this phase's build scope) | - | This phase CITES these files, it does not modify them; verifying they still do what the citation claims is this research's job, not the plan's |

## Project Constraints (from CLAUDE.md)

- **WORKSPACE GUARD:** all work happens from `/home/jsagi/dev/MindrianOS-Plugin/`, never
  `~/.claude/plugins/mindrian-os/`. `[VERIFIED: pwd]` confirmed for this research session.
- **Canon Compliance Core** (CLAUDE.md lines 66-76) names Parts 3/6/7/8/9/11/12 as the "binding
  Parts every change must honor" - and this list itself is now a currency artifact this phase's
  audit touches: CLAUDE.md's Part 11 line cites "126 declared" (stale, see "Part 11" below) and
  its Part 7 reference implicitly relies on the "25 methodology commands" framing repeated
  elsewhere in the same file (also stale, see "Part 7" below). **If the plan amends Part 7 or
  Part 11 in the Canon, CLAUDE.md's own Canon Compliance Core section and its Project section
  (both cite "25 methodology" verbatim) should be checked for the same drift in the same wave -
  this is Part 6 (Dog-Fooding) applied to CLAUDE.md itself, not just the Canon.**
- **No em-dashes anywhere; hyphens only.** Every Appendix D entry in the existing Canon honors
  this; the amendment prose must too.
- **GSD Workflow Enforcement:** direct edits outside a GSD workflow are disallowed; this phase
  IS the GSD workflow, so this constraint is satisfied by construction once planning proceeds
  through `/gsd-plan-phase` → `/gsd-execute-phase`.
- **Dev-Research Compositing (Rethinking Room):** any phase touching MindrianOS's own
  architecture composites findings into `~/MindrianRooms/rethinking-mindrianos/research/`.
  Recent history (`git log`) shows this already happening for adjacent phases (276, Gate 0,
  langtalks harvests) - the planner should include a task filing this phase's own findings there
  too, mirrored to `mindrianOS/research/`, per the standing mandate.
- **docu-optimizer skill** (`.claude/skills/docu-optimizer/SKILL.md`) is listed as a project
  skill for "CLAUDE.md/docs currency work." This phase is squarely that class of work; the
  planner should check whether docu-optimizer's own method (not read in full this session - flag
  for the planner to open at plan time) offers a structured audit procedure worth reusing instead
  of an ad-hoc part-by-part pass, given this research already ran a manual pass successfully.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages - it is a documentation/prose
amendment to an existing markdown file plus (per CONTEXT.md's canonical_refs) a mirrored prose
addition to an existing agent file, and possibly new floor-test `.cjs` files that use only
Node.js built-ins (`node:assert`, `node:fs`, `node:path` - the exact pattern every existing
`tests/test-canon-*-floor.cjs` already uses, confirmed via Read of
`tests/test-canon-frozen-scalars-floor.cjs`). No `npm install` step is anticipated.

## Architecture Patterns

### The Canon Amendment Lifecycle (the pattern this phase's plan MUST follow)

This is not a novel pattern to design - it is a mature, 37-times-executed pattern this phase's
work items must slot into exactly, per Part 6 (Dog-Fooding) and per CONTEXT.md's explicit
directive that every new entry "should read as a 38th, 39th, etc. in that same voice."

```
Navigator raises/confirms a doctrinal gap
        |
        v
[BLOCKING CHECKPOINT] navigator APPROVEs exact prose + version target
   (every one of the 37 prior entries required this BEFORE any canon byte landed -
    verified via grep across Appendix D: "navigator-APPROVED... BEFORE any canon
    byte was written" / "navigator-LOCKED... ratified at a blocking checkpoint
    BEFORE the canon bytes landed" appears in entries 18, 19, 21-37)
        |
        v
ONE atomic lockstep wave (so CI never goes RED mid-phase):
   - Canon body text edit (the Part itself, additive where possible)
   - Appendix D entry N+1 (provenance paragraph: what changed, why, who
     approved, what stayed frozen)
   - Header/footer Version line bump (e.g. 1.24 -> 1.25)
   - docs/CANON-PHASE-MAP.md version-history table row (same version, same date)
   - NEW floor test tests/test-canon-entry-N-<slug>-floor.cjs (byte-presence/
     absence assertions against the Canon file itself, via node:assert + node:fs
     -- NOT a framework test, see Code Examples below)
   - Existing frozen-scalar floor tests kept GREEN (tests/test-canon-frozen-
     scalars-floor.cjs -- MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 unweakened)
   - tests/run-all-<phase>.sh registers the new floor test
        |
        v
Commit (all files in the wave move together)
```

### Anti-Patterns to Avoid

- **Editing a frozen scalar's VALUE.** `tests/test-canon-frozen-scalars-floor.cjs` exists
  specifically to catch this. MAX_K=3, DIAL_REACH_K=6, 0.70, 0.15, and the 6-reach bank
  (`context_block, contradiction, cross_room, brain_consult, deep_research, hats` - re-verified
  live via `node -e` against `lib/core/insight-sensors.cjs`, still exactly 6, still exactly
  those 6 names) must never change value in this phase. Restating them byte-identical in new
  prose is fine and expected; changing the number is not.
- **Landing a canon byte before the navigator blocking-checkpoint APPROVE.** Every entry from 14
  onward explicitly records this discipline; SFS-11 (entry 32/33) and the Task-1 checkpoint
  (entry 36/37) are the most recent, most explicit examples.
- **Silently deleting or rewording a prior Appendix D entry.** The pattern is strictly additive -
  entries are numbered 1-37 and the floor tests assert prior entries are "preserved," never
  removed or reworded. A currency fix to old prose (e.g., the stale Pinecone reference in Part 2)
  should read as a NEW entry that supersedes/corrects the old prose in place, in the voice of
  "corpus figures corrected" precedents (entries 13, 16), not as a silent overwrite with no
  Appendix D record.
- **Keying a new obligation on a phase NUMBER instead of SLUG.** CANON-PHASE-MAP.md's own text
  names this as a known fragility ("Phase-number collision... future obligations should key on
  phase SLUG"). This phase's own CIRS/canon_parts declaration (if any) should key on the phase
  slug `340-canon-currency-audit-and-amendment-v1-24-to-next-close-the-d`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verifying a canon claim is stale | A new manual audit methodology | The 37-precedent Appendix D provenance-paragraph pattern + the existing floor-test assertion style (byte-presence of exact phrases via `node:assert` + `node:fs`, never `.size` alone) | Already proven across 37 amendments; reinventing the pattern risks a floor test that doesn't actually pin what it claims to pin |
| Checking ICM structural currency | A bespoke checklist | The icm-architect skill's ten invariants + six-forms taxonomy + walk test (`~/.claude/skills/icm-architect/SKILL.md`, loaded this session) | Already the standing consult per CLAUDE.md; its invariant 4 ("every folder-level contract is explicit... a CONTEXT.md per working folder") and invariant 5 ("factory vs. product... reference material lives structurally apart from working artifacts") map DIRECTLY onto D-02's ask (Appendix B needs citations to the L2 CONTEXT.md writer and L3 references/ factory dir) - the skill's own vocabulary is the vocabulary D-02 already uses, confirming Appendix B's conceptual mapping is sound and only the citations are missing |
| Auditing surface counts for Part 11 | Hand-counting files | `ls commands/*.md \| wc -l`, `ls agents/*.md \| wc -l`, `ls pipelines/*/CHAIN.md \| wc -l`, `ls skills/*/SKILL.md \| wc -l` - the EXACT four-glob formula the schema itself states (`data/hitl-shape-declaration-schema.json:30`, `surface_count_principle`) | The schema self-documents its own enumeration formula; recomputing it by hand risks a different (wrong) count than what the actual gate computes |

**Key insight:** every "don't hand-roll" here is really "don't hand-roll a pattern the Canon
already has 37 working examples of." The novelty in this phase is not the amendment MECHANISM
(fully mature) but the SCOPE of the sweep (part-by-part, not four-front).

## Part-by-Part Currency Findings (the actual audit)

Every claim below is tagged with its verification method. "STALE" means a live check found a
mismatch between the Canon's prose and the live codebase/stack. "CURRENT" means a live check
found the Canon's prose still matches.

### Part 1 - The Wicked Navigator
`[VERIFIED: Read, full text]` CURRENT. Ambient doctrine (no phase implements it alone, no
file/tool citations to go stale). The "Larry is the pedagogical guide... methodology comes from
the Brain, and Larry says so" framing is CONSISTENT with the Phase 339 D-09 ruling ("the key
names the plugin's Brain slot, not the server" - `.planning/phases/339-.../339-CONTEXT.md:39`,
`[VERIFIED: grep]`) that "Brain" stays the constitutional role name while Theo is the current
implementation. No amendment needed for Part 1 itself.

### Part 2 - The Team Around the Navigator / Engine 1
`[VERIFIED: Read + grep + CLAUDE.md cross-check]` **STALE - new finding, not in the original
4-front floor.** Part 2's Engine 1 "CROSS-DOMAIN MATCH" subsection (canon line 40) and its code
references (line 48) both state the reverse-salient/cross-domain-match layer runs "against
Pinecone embeddings (12,401 methodology nodes in Brain's semantic index)." CLAUDE.md's own
Technology Stack table (`CLAUDE.md:132`, `[VERIFIED: grep]`) states plainly: "e5
(multilingual-e5-large) | Brain semantic-search vectors, 1024-dim, embedded LOCALLY... Pinecone
is RETIRED." The command-level wrappers Part 2 cites (`/mos:whitespace`, `/mos:find-bottlenecks`,
`/mos:find-connections`, `/mos:find-analogies`, `/mos:score-innovation`) all still exist
(`[VERIFIED: ls commands/*.md]`, all 5 present) - only the BACKEND description is stale, not the
command surface. This is a real, current-stack currency gap the navigator has not seen: the
underlying vector infrastructure Part 2 names is retired.

### Part 2a - The Hero's Arc (Journey Stage)
`[VERIFIED: Read, full text]` CURRENT. No file citations to go stale; the doctrine (role-blend x
journey-stage, Campbell's 12-stage monomyth) is unchanged conceptual framing with no numeric or
implementation claims that could drift.

### Part 3 - The Tri-Context Decision Gate
`[VERIFIED: node -e against lib/core/insight-sensors.cjs + grep against canon]` CURRENT. The
frozen scalars this Part states (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 gate, 6-reach bank) were
re-verified live: `REACH_IDS` in `lib/core/insight-sensors.cjs` is still exactly
`['context_block', 'contradiction', 'cross_room', 'brain_consult', 'deep_research', 'hats']` (6
entries, matching `DIAL_REACH_K=6`). The F.0-F.9 closed ten-shape family (ratified through Phase
188/210, canon v1.20-v1.24) is the CURRENT state of Part 3 - no eleventh shape exists in code or
elsewhere in the repo (`[VERIFIED: grep -i "shape f\.\(10\|11\)" -r .` returned nothing).

### Part 4 - Every Choice Is Graph Data
`[VERIFIED: node -e against lib/core/navigation/edges.cjs + grep against canon, per-type]`
**STALE - new finding, not in the original 4-front floor, and the largest single drift found in
this audit.** The live `ALLOWED_EDGE_TYPES` frozen set (`lib/core/navigation/edges.cjs`) now
contains 44 edge types. Part 4's prose (canon lines 217) names only 29 of them across its five
listed categories. The 15 shipped-but-uncited types, individually grepped against the full canon
text and confirmed absent (`[VERIFIED: grep -c <TYPE> docs/MINDRIAN-CANON.md` = 0 for all 15):
`ATTRIBUTED_TO`, `AUTHORED_BY`, `COMPETES_WITH`, `CONCERNS`, `DISCOVERED`, `ELEVATES_TO`,
`MAPS_TO_SECTION`, `NOT_REMEMBERED_BECAUSE`, `REMEMBERED_AS`, `SHARES_JOB`, `SOURCED_FROM`,
`SUPPLIES_TO`, `UMBILICAL_TO`, `USES_COMPONENT`, `USES_FRAMEWORK`. Several of these have inline
code comments naming the phase that added them additively (Phase 195-04 for `UMBILICAL_TO`,
Phase 200-02 for two RS-discovery types), meaning this drift accumulated across MULTIPLE phases
that each shipped an additive edge type without a matching canon-amendment wave - a real,
repeated instance of the exact Part-6 self-CONTRADICTS pattern the Canon's own entries 18/21/22
were written to resolve for earlier such gaps. `SOURCED_FROM` in particular is directly relevant
to this phase's Sourced Claims Doctrine front (Part 12) - it may be the graph-native edge type
that doctrine should reference if claims are meant to carry a traceable source edge.

### Part 5 - Evidence Is Graded By Context
`[VERIFIED: Read, full text]` CURRENT. The welded two-gauge metric (entry 31) and its self-
binding clause are the most recent state; no numeric or file claim here was found stale.

### Part 6 - Product-as-Venture (Dog-Fooding Mandate)
`[VERIFIED: Read, full text]` CURRENT (ambient doctrine, no file citations to go stale). Note for
the planner: CANON-PHASE-MAP.md (not the Canon body itself) documents a known "Phase 92 =
drift-detection-engine" naming collision with an unrelated on-disk `92-trust-layer-refactor`
directory - this is a MAP artifact issue, not a Canon TEXT issue, so it does not require a Canon
amendment, only (optionally) a map correction, which is out of this phase's stated scope
(the Canon text itself, not the map).

### Part 7 - Reuse Before Build
`[VERIFIED: grep + ls]` **STALE - new finding, not in the original 4-front floor, and the second-
largest drift found.** Canon Part 7 (line 256): "Before building a new command, skill, agent, or
hook, the builder must search the 25 methodology commands first." The literal figure "25
methodology commands"/"25 methodology bots" is repeated FOUR times total across the repo's
canonical-instruction surface: `docs/MINDRIAN-CANON.md:256`, `CLAUDE.md:73`, `CLAUDE.md:109`, and
`CLAUDE.md:159` (`[VERIFIED: grep -n "25 methodology"]`). The live `commands/` directory now
contains 113 `.md` files (`[VERIFIED: ls commands/*.md | wc -l]`) - a ~4.5x undercount. This
figure has clearly been stale for a long time (well predating this session's four-front floor)
and touches BOTH the Canon and CLAUDE.md in four places, so a fix here is a real multi-file
lockstep the plan should scope deliberately (see "Project Constraints" above).

### Part 8 - The Graph Boundary (Security Constitution)
`[VERIFIED: Read, full text + grep for methodology_tier/projection]` CURRENT for the boundary
doctrine itself (LOCAL->BRAIN:NO, the PR gate, the projection's `methodology_tier` boundary-
keeper). The ONE stale reference inside Part 8's orbit is Appendix C's Glossary definition of
"Brain," covered under Appendix C below (not Part 8's own body text, which never names a specific
origin URL).

### Part 9 - Memory Locality and Interpretation
`[VERIFIED: ls + grep + Read against lib/core/node-insert.cjs, live file]` **CONFIRMS the
floor-front claim, with exact citations for the plan to use.** `lib/core/node-insert.cjs` exists
(14,520 bytes, last modified 2026-09-03) and its own header comment states verbatim: "Extended
R17-01 (260903-gdm): insertNode is now the SINGLE node-write chokepoint for production code
(Canon Part 7 reuse-before-build, D-02)." It validates a REQUIRED `epistemic_type` argument
against a closed `ALLOWED_EPISTEMIC_TYPES` enum (10 members: `observation`, `extracted_fact`,
`derived_fact`, `model_derived_assertion`, `interpretation`, `hypothesis`, `assumption`,
`conclusion`, `recommendation`, `decision`) BEFORE any other work, fail-closed (throws on missing
or invalid). Two named exclusions are documented in the file's own header:
`lib/core/navigation/memory-events.cjs` (append-only bookkeeping) and `lib/core/rs-sqlite-mirror.cjs`
(bulk-write hot path). Live call-site count today (`[VERIFIED: grep -rl insertNode( lib/core/`):
26 files call it, 80 total call sites - grown from the "16+18" figure cited in the 2026-09-03
handoff two days prior, itself evidence this chokepoint is still actively accreting callers and
worth naming formally in the Canon now rather than later. `lib/core/navigation.cjs` (the read/
navigate chokepoint Part 9 already cites) is unchanged and still the 13-function chokepoint Phase
109 shipped (`[VERIFIED: grep against canon line 371]`). **D-01's ask is fully groundable with
these exact citations.**

### Part 10 - Conversation as Product
`[VERIFIED: Read, full text]` CURRENT. The ratification-provenance history (Hooked gate retired,
welded two-gauge instrument, entry 31's self-binding clause) is the most recent state and matches
the CANON-PHASE-MAP.md version-history entries for v1.19-v1.24. No stale file/number claim found.

### Part 11 - The Invocation Constitution (CIRS)
`[VERIFIED: node -e + ls against the 4 surface-count globs the schema itself defines]` **STALE -
the exact re-verification CONTEXT.md's own Claude's-Discretion section asked for, now run.**
Canon Appendix D entry 36 (and CLAUDE.md's Part 11 paragraph) cite an illustrative snapshot of
"126 declared surfaces" (105 commands + 9 agents + 3 pipelines + 9 qualifying skills, plus 5
skill exemptions) as of Phase 190 (2026-07-02). Re-running the SAME four-glob formula the schema
itself defines (`data/hitl-shape-declaration-schema.json:30`, `surface_count_principle`) today:
`commands/*.md` = 113, `agents/*.md` = 14, `pipelines/*/CHAIN.md` = 4, `skills/*/SKILL.md` = 126.
Raw sum = 257, more than double the Phase-190 snapshot (the skills count alone grew from 14 total
skills - 9 declaring + 5 exempt - to 126 skill directories, an 9x growth that likely includes
many newly-exempt/render-only skills, not all newly-declaring; the plan should re-run
`node scripts/check-shape-declaration.cjs --check` to get the actual qualifying-vs-exempt split
before drafting new prose, since this research's `--check` run surfaced ~20+ WARN-level
declaration conflicts on skill files that would affect the true "declaring" count). **Important
nuance for the planner: Part 11's own doctrine text ALREADY states the count is "NEVER a frozen
scalar... an illustrative snapshot, not a canon-frozen constant a future gate may hardcode."**
This means the doctrine itself needs NO prose change - only the illustrative number cited in
Appendix D entry 36 and in CLAUDE.md's Part 11 paragraph is stale and could be refreshed as a
lightweight "corpus figures corrected" style entry (mirroring entries 13/16), not a doctrine
amendment. Lower priority than the other findings; flag as optional/CLAUDE.md-only if the plan
wants to keep this wave smaller.

### Part 12 - The Pedagogy Constitution (Invisibility)
`[VERIFIED: Read, full text + grep for "sourced"/"hedge"/"fabricat"]` **CONFIRMS the floor-front
claim.** Zero mentions of "sourced," "hedge," or "fabricat*" anywhere in Part 12's current text.
The "Elevation tone (HARD requirement)" subsection (canon line 652) is the closest existing
doctrine - it requires every elevation to be "hedged, cautious, evidence-backed, NEVER confident"
- but it governs CONFIDENCE framing, not SOURCE existence. It says nothing about the case
CONTEXT.md names: a number/claim that is entirely invented (has no source at all) wrapped in a
hedge word ("illustrative," "e.g.") that a subsequent reviewer then treats as pre-cleared rather
than unsourced. This is the exact gap SEED-086 names. The new `SOURCED_FROM` edge type found live
in Part 4 (see above) may be the graph-native mechanism a Sourced Claims clause should point to,
if claims are meant to carry a traceable-or-absent provenance edge - worth the planner checking
whether `SOURCED_FROM` already has a runtime writer, or is itself an uncited addition waiting for
its own consumer.

### Appendix A - Relationship to MWP
`[VERIFIED: Read, full text]` CURRENT. Short, cross-reference-only text, no file/number claims.

### Appendix B - Relationship to ICM Layers 0-4
`[VERIFIED: Read, full text + Read against lib/core/room-skeleton-scaffold.cjs +
lib/core/section-registry.cjs]` **CONFIRMS the floor-front claim, with exact citations for the
plan to use.** Appendix B is a 5-row table mapping ICM Layers 0-4 to Canon Parts with ZERO file
citations - confirmed by direct Read of the full table (canon lines 711-717): every other row in
the Canon that describes a shipped mechanism cites a file; this table cites none. Exact citations
now available for D-02:
- **L1 (Identity/STATEMENT field):** `lib/core/room-skeleton-scaffold.cjs:578-579` -
  `STATEMENT: meta.statement || meta.purpose` inside the template-token substitution, with a
  documented CR-01 fix note that STATEMENT/SECTION_PURPOSE stay raw for the body blockquote while
  `_YAML` escaped twins exist for frontmatter.
- **L2 (per-section CONTEXT.md writer):** `lib/core/room-skeleton-scaffold.cjs:316-356`, the
  function that writes `<roomDir>/<slug>/CONTEXT.md` idempotently (skips silently if it already
  exists), explicitly commented "Phase 275-02 (Task 2): the L2 per-section CONTEXT.md contract
  templates."
- **L3 (references/ factory directory):** `lib/core/room-skeleton-scaffold.cjs:385-399+`, writing
  `<roomDir>/references/<name>` from a template directory verbatim, commented "Phase 275-02
  (Task 3): the L3 references/ factory-layer template directory."
- Supporting file: `lib/core/section-registry.cjs` (11 DD-aligned `CORE_SECTIONS`, `references`
  named explicitly as "the new ICM L3 factory directory: stable factory recipe material" in its
  own header comment, Phase 275 D-01).
All three citations trace to Phase 275 exactly as CONTEXT.md's canonical_refs claimed. Note: the
SECTION_NAMES count itself grew 8->11 in the same Phase 275 (`[VERIFIED: grep "SECTION_NAMES 8 ->
11" lib/core/room-skeleton-scaffold.cjs:55]`), but the Canon's Appendix B table never cited a
section COUNT to begin with, so this growth does not add a second currency gap - only the missing
file citations need to land.

### Appendix C - Glossary
`[VERIFIED: grep against canon + grep against lib/core/brain-client.cjs]` **CONFIRMS the
floor-front claim.** Line 728: "Brain - the remote methodology repository
(pws-brain-mcp.onrender.com)." The live `BRAIN_URL` default in `lib/core/brain-client.cjs:40` is
`process.env.MINDRIAN_BRAIN_URL || 'https://theo-mcp.onrender.com'`, and `getBrainUrl()`
(`lib/core/brain-client.cjs:1204`) is the single resolver every runtime site reads (per Phase 339
D-12, `[VERIFIED: grep against 339-CONTEXT.md]`). `THEO_ORIGINS` is a frozen allow-list containing
only `https://theo-mcp.onrender.com` (`lib/core/brain-client.cjs:1819`). Zero mentions of "Theo"
anywhere in the Canon (`[VERIFIED: grep -c -i theo docs/MINDRIAN-CANON.md` = 0). Per Phase 339
D-09, the fix is NOT to rename "Brain" to "Theo" throughout - the constitutional role name stays
"Brain" (Part 8's boundary term); the Glossary entry needs the origin URL corrected and,
optionally, a short parenthetical naming Theo as the current implementation, mirroring the
"Brain names a role, Theo is the current implementation" framing D-09 already established
elsewhere in the repo's docs.

### Appendix D - Canonization Provenance
`[VERIFIED: Read entries 1-37 + version-history table cross-check]` CURRENT as a historical
record (it is by definition append-only and cannot go stale in the way other Parts can - each
entry is a dated snapshot of a past decision). This phase's own work will produce entries 38+.

## Common Pitfalls

### Pitfall 1: Treating "closed vocabulary" prose as aspirational rather than a hard gate
**What goes wrong:** Part 4's edge-vocabulary list (and Part 11's CIRS closed ruling set, and
Part 3's Shape F family) are all CLOSED, frozen constitutional sets - the Canon's own language
("A change to the closed set is a canon amendment... not a per-phase edit") makes them load-
bearing, not descriptive. **Why it happens:** it is easy for an implementing phase to add one
additive edge/skill/reach and reasonably judge "this is small, additive, doesn't need a full
canon wave" - and indeed several phases (195, 200, and others per the inline code comments found
this session) made exactly that call for edge types, which is how Part 4 drifted 15 types behind.
**How to avoid:** this phase's own plan should NOT repeat the pattern - every new edge/surface it
touches (if any) needs its own Appendix D entry, not a silent code-only addition. **Warning
signs:** a `grep -c <NEW_TYPE> docs/MINDRIAN-CANON.md` returning 0 immediately after a phase ships
code that adds that type to a frozen Set.

### Pitfall 2: Confusing a stale ILLUSTRATIVE snapshot with a doctrine gap
**What goes wrong:** Part 11's "126" figure and Part 7's "25 commands" figure look like the SAME
kind of problem (a stale number) but they are not: Part 11's doctrine text already self-disclaims
the number as non-frozen and enumerated-from-disk, so fixing it is a light "corpus figures
corrected" entry (like entries 13/16). Part 7's "25 commands" is baked into an ACTIVE INSTRUCTION
("search the 25 methodology commands first") that is materially misleading at 113 actual commands
- a builder following the letter of Part 7 today would search a number roughly a quarter the size
of the real surface. **Why it happens:** both look like "just a number" at a glance. **How to
avoid:** for each stale number found, check whether the surrounding prose is DESCRIPTIVE
(illustrative snapshot, fine to lag) or PRESCRIPTIVE (an instruction whose correctness depends on
the number, needs fixing promptly). **Warning signs:** the word "search," "before," or "gate"
near a number is a signal it is prescriptive.

### Pitfall 3: Amending the Canon without the parallel CLAUDE.md fix in the same wave
**What goes wrong:** CLAUDE.md repeats several of the same stale figures independently ("25
methodology commands" x3, "126 declared" x1) - fixing only `docs/MINDRIAN-CANON.md` and leaving
CLAUDE.md stale re-introduces the exact drift this phase exists to close, one file over.
**Why it happens:** CLAUDE.md is not technically "the Canon," so a narrowly-scoped amendment task
could reasonably skip it. **How to avoid:** for Part 7 and Part 11's findings specifically, scope
the CLAUDE.md line edits into the SAME wave/commit as the Canon prose edit, per CLAUDE.md's own
Dog-Fooding-adjacent instruction to fact-check hand-typed figures after any change that touches
them. **Warning signs:** `grep -rn "<the stale figure>" CLAUDE.md docs/MINDRIAN-CANON.md`
returning hits in both files after the Canon-only edit lands.

### Pitfall 4: Treating this phase's own research as license to skip the navigator blocking checkpoint
**What goes wrong:** because this research surfaced concrete, high-confidence findings (unlike
some prior discovery-phase research that left genuine open questions), a planner or executor
could be tempted to treat the FINDINGS as sufficient authorization to write canon bytes directly.
**Why it happens:** the findings are unusually well-grounded (live tool calls, exact line
numbers) compared to typical research-phase output, which can read as "already decided."
**How to avoid:** every one of the 37 prior Appendix D entries required a navigator APPROVE at a
blocking checkpoint on the EXACT PROSE before any byte landed - this is a hard, load-bearing
precedent CONTEXT.md itself restates ("This phase inherits that requirement without exception -
confirmed explicitly earlier this session"). Research quality does not substitute for the
navigator's sign-off on wording. **Warning signs:** a plan that schedules a canon-file `Edit` call
before a `checkpoint:human-verify` task in the same wave.

## Code Examples

### The floor-test pattern (verified live pattern to reuse, not invent)
```javascript
// Source: tests/test-canon-frozen-scalars-floor.cjs (read in full this session)
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CANON = path.join(REPO_ROOT, 'docs', 'MINDRIAN-CANON.md');
const text = fs.readFileSync(CANON, 'utf8');

// Assert presence of the exact new phrase (byte-for-byte, never .size alone)
assert.ok(text.includes('SOURCED CLAIMS DOCTRINE'), 'entry N phrase must be present');
// Assert absence of a drift-form / the OLD stale phrase, once superseded
assert.ok(!text.includes('pws-brain-mcp.onrender.com'), 'stale Brain origin must be gone from Appendix C');
// Assert every PRIOR entry marker is still present (never .size on the entry count)
for (const marker of ['1. **Drift-detection need surfaced.**', /* ...36 more... */]) {
  assert.ok(text.includes(marker), `prior entry marker missing: ${marker}`);
}
```

### The live-verification pattern this research used (worth the plan reusing at execution time
to re-confirm citations right before the amendment lands, since the codebase moves fast)
```bash
# Source: this session's own bash calls, all live against the checked-out repo
node -e "const e=require('./lib/core/navigation/edges.cjs'); console.log([...e.ALLOWED_EDGE_TYPES].sort().join('\n'))"
grep -n "getBrainUrl\|onrender.com" lib/core/brain-client.cjs
node scripts/check-shape-declaration.cjs --check   # surfaces live WARN-level drift, not just counts
node scripts/build-connector-registry.cjs --check  # confirms connector registry itself is green
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Memgraph-backed Brain at `pws-brain-mcp.onrender.com` | Theo (graph-native) at `theo-mcp.onrender.com` | Phase 339, shipped 2026-09-03 | Live default origin flipped in code; Canon Appendix C Glossary was not updated in the same wave (a genuine miss this phase closes) |
| Pinecone remote vector index (12,401-12,485 vectors, multiple historical counts across entries 13/16/RETRO) | e5 (multilingual-e5-large) local embedding, zero network egress | Undated in this session's sources but confirmed shipped via CLAUDE.md's stack table | Part 2's Engine 1 doctrine was never updated to reflect this; the command SURFACE (`/mos:whitespace` etc.) is unaffected, only the backend description |
| Single node-write path (ad hoc `INSERT INTO nodes` scattered per caller) | `lib/core/node-insert.cjs` as the single write chokepoint with fail-closed `epistemic_type` validation | Phase 140-01 origin, extended R17-01/R17-02 (quick 260903-gdm, 2026-09-03) | Part 9 currently names only the READ chokepoint (`navigation.cjs`); this phase's D-01 closes that gap |
| ~14 total skills (9 declaring + 5 exempt, Phase 190 snapshot) | 126 skill directories | Between Phase 190 (2026-07-02) and this research (2026-09-05) | Part 11's illustrative surface-count snapshot is now off by a wide margin; doctrine text unaffected (self-disclaiming), only the cited number is stale |

**Deprecated/outdated (confirmed this session, not carried from training data):**
- `pws-brain-mcp.onrender.com` as the Brain's live origin - retired, Theo is live default.
- Pinecone as the live semantic-search vector store for Part 2's cross-domain match - retired,
  e5-local is live.
- The "25 methodology commands" figure anywhere it appears (Canon Part 7, CLAUDE.md x3) - stale
  by ~4.5x.

## Grounding: langtalks-graph-expert corpus (relayed, not independently queried this session)

**Provenance note (honest, not padded):** this research agent's tool allowlist did not include
`mcp__langtalks-graph-expert__*` in this session (a known upstream limitation, documented in this
agent's own operating instructions: MCP tools can be stripped from agents with a `tools:`
restriction - anthropics/claude-code#13898). The orchestrator ran a parallel fork agent against
the live langtalks corpus and relayed the following CONFIRMED-REAL results mid-task (a `get_entity`
lookup, not a semantic-similarity guess - the orchestrator explicitly flagged two OTHER lookups
this same pass as dead ends and did not relay them as findings, which is evidence the relayed
ones were checked, not padded):

- **Two arxiv papers cited directly against the "Memory" entity in the langtalks corpus, both
  relevant to Part 9's failure mode and possibly Part 12's Sourced Claims front** `[CITED:
  langtalks-graph-expert corpus, relayed]`:
  - "Toward Robust GraphRAG: Mitigating Retrieval Drift and Hallucination from Imperfect
    Knowledge Graphs" - https://arxiv.org/abs/2603.14828
  - "The Reasoning Bottleneck in Graph-RAG: Structured Prompting and Context Compression for
    Multi-Hop QA" - https://arxiv.org/abs/2603.14045
  - Relevance as flagged by the orchestrator: "hallucination from an imperfect graph" (the
    GraphRAG paper's subject) and "fabrication dressed as illustrative" (this phase's Sourced
    Claims front) are "the same disease shape one layer apart" - worth the PLANNER's attention
    when drafting D-01 (Part 9 chokepoint doctrine) and CANON-01 (Sourced Claims), though this
    research did not have session time to read either paper in full and cannot summarize their
    actual findings beyond the title/relevance the corpus lookup surfaced.
  - **Confidence: MEDIUM.** The papers' EXISTENCE and their corpus linkage to "Memory" is
    confirmed real (a direct `get_entity` result, not a semantic-proximity hit - the orchestrator
    explicitly distinguished this from two dead-end lookups in the same message). Their CONTENT
    and whether they actually support the "same disease shape" framing is NOT verified by this
    research - that framing is the orchestrator's own reasonable hypothesis, not a corpus fact.
- **Corpus entities "context engineering" and "Memory" are both richly populated** (episode 55
  "Context Engineering," episode 57 "Memory | Itamar Friedman (Qodo)," episode 60 "Brain Memory |
  Dr. Meytar Zemer") `[CITED: langtalks-graph-expert corpus, relayed]` - worth a DIRECT query at
  plan or execution time if Part 9's role definitions are touched, since this research did not
  query these episodes' actual content.
- **Two explicit dead ends, not to be re-chased:** "Fragmented #307" (title-only semantic-
  proximity hit, zero real citations) and "Constitutional AI paper" (one thin, unconfirmed
  citation only) - relayed here so the planner does not waste a cycle re-querying them.

**What this research did NOT do:** independently run `relationship_path` or `query_relationship`
queries against the corpus, per the standing instruction to prefer typed relationship queries
over open-ended breadth. This is a genuine gap in this research's own completeness, caused by the
tool-availability limitation stated above, not a judgment call to skip it. **Flag for the
planner:** if the plan-checker or planner has MCP access in its own session, a direct
`relationship_path` query from "constitutional documents" or "governance" to "multi-agent
systems" (the specific gap named in this phase's dispatch instructions - Part 11's Invocation
Constitution and Part 3's Decision Gate as governance-document precedent) would close this
research's one acknowledged gap.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The two arxiv papers relayed from the langtalks corpus actually contain content relevant to the "hallucination from imperfect graph" / "fabrication dressed as illustrative" framing (their titles and corpus linkage are confirmed real; their CONTENT relevance is the orchestrator's untested hypothesis, relayed here in good faith) | "Grounding: langtalks-graph-expert corpus" | Low - these are optional grounding citations for prose framing, not load-bearing decisions; if the papers turn out irrelevant on a closer read, the Sourced Claims / Part 9 amendments can proceed without them |
| A2 | The draft `CANON-NN` requirement-ID family and wave groupings proposed in `<phase_requirements>` are a reasonable planning starting point, not a locked decision | "Phase Requirements" | Low - explicitly marked as a recommendation for the planner to accept, modify, or discard; CONTEXT.md leaves wave-boundary and entry-count choices as Claude's Discretion at planning time |
| A3 | `SOURCED_FROM` (found live in `ALLOWED_EDGE_TYPES` but absent from Part 4 prose) is the graph-native mechanism a Sourced Claims doctrine clause should reference, IF claims are meant to carry a traceable-or-absent provenance edge | "Part 12" | Medium - this is a suggested design hook, not verified to have a runtime writer or consumer yet; the planner should check `grep -rn "SOURCED_FROM" lib/` for actual usage before citing it in new Part 12 prose, since an uncited edge type that is ALSO unused would be citing dead code |

**If this table is empty:** N/A - see rows above. Every other claim in this research is tagged
`[VERIFIED: ...]` with the exact command run, not `[ASSUMED]`.

## Open Questions

1. **Should the "corpus figures corrected" light-entry style (Part 11's 126->real-count fix) land
   in the SAME wave as the heavier doctrine amendments (Sourced Claims, Theo, Part 9 split,
   Appendix B citations), or as its own separate lightweight entry?**
   - What we know: entries 13/16 (prior "corpus figures corrected" precedents) landed as their
     own standalone entries, not folded into a heavier doctrine wave.
   - What's unclear: whether the navigator wants ONE big wave for this whole phase (matching the
     "landed as ONE atomic lockstep wave" precedent some single-topic amendments used) or several
     smaller waves (matching how Phase 188 landed F.8+F.9 together but separately from Phase 190's
     R16).
   - Recommendation: raise this explicitly at the plan's own blocking checkpoint alongside the
     prose - it is exactly the kind of question CONTEXT.md's Claude's Discretion section defers
     to "whatever the full part-by-part audit actually finds," which this research now provides.

2. **Does `SOURCED_FROM` (Part 4 edge type, confirmed shipped, confirmed absent from Part 4 prose
   AND absent from Part 12) already have a runtime writer, or is it itself dead/aspirational
   code?**
   - What we know: it exists in the frozen `ALLOWED_EDGE_TYPES` Set.
   - What's unclear: this research did not grep for its actual write call sites (out of session
     scope/time); it may already be the mechanism entries like R16 (`SOURCED_FROM added to
     ALLOWED_EDGE_TYPES`) reference from the HANDOFF docs, in which case citing it in a new Part
     12 clause is low-risk; if it is unused, citing it would be premature.
   - Recommendation: the planner or an execution-time task should run
     `grep -rn "SOURCED_FROM" lib/ scripts/` before drafting Part 12's new clause.

3. **Does `docu-optimizer` (the project's own named skill for "CLAUDE.md/docs currency work") have
   a structured audit method that should supersede or supplement this research's manual
   part-by-part approach for the CLAUDE.md-side fixes (the "25 methodology commands" x3 and "126
   declared" fixes specifically)?**
   - What we know: the skill exists at `.claude/skills/docu-optimizer/SKILL.md` and is listed in
     CLAUDE.md's Project Skills table.
   - What's unclear: this research did not open the skill file (time-bounded to the Canon/code
     audit itself); its actual method is unknown.
   - Recommendation: the planner should open `.claude/skills/docu-optimizer/SKILL.md` before
     drafting the CLAUDE.md-side tasks, since it may already prescribe exactly this kind of sweep.

## Environment Availability

Not applicable - this phase has no external tool/service/runtime dependencies. All work is
local file edits (Canon markdown, `agents/larry-extended.md`, `docs/CANON-PHASE-MAP.md`,
`CLAUDE.md`, and new `.cjs` floor-test files using only Node.js built-ins already confirmed
present, per this session's own `node -e` calls succeeding throughout).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (bare Node.js `assert` module, zero third-party test framework - confirmed via Read of `tests/test-canon-frozen-scalars-floor.cjs`, which requires only `node:assert`, `node:fs`, `node:path`) |
| Config file | none - each `tests/test-canon-*-floor.cjs` is a standalone executable script; `tests/run-all-<phase>.sh` is a bash aggregator, not a config file |
| Quick run command | `node tests/test-canon-frozen-scalars-floor.cjs` (existing) and the NEW `node tests/test-canon-entry-NN-<slug>-floor.cjs` this phase must write per amendment |
| Full suite command | `bash tests/run-all-340.sh` (does not yet exist - Wave 0 gap, see below), modeled on `tests/run-all-190.sh`'s pattern (a bash aggregator sourcing/invoking each phase-specific `.cjs` floor test plus the carried frozen-scalar and prior-entry floor tests) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CANON-01 (Sourced Claims) | Part 12 gains the new sub-clause; `agents/larry-extended.md` mirrors it | floor test | `node tests/test-canon-entry-38-sourced-claims-floor.cjs -x` (or whatever entry number the plan assigns) | ❌ Wave 0 |
| CANON-02 (Theo/Appendix C) | Glossary origin URL corrected; stale `pws-brain-mcp.onrender.com` string absent | floor test | `node tests/test-canon-entry-39-theo-glossary-floor.cjs -x` | ❌ Wave 0 |
| CANON-03 (Part 9 split) | Two named chokepoints present in Part 9 prose | floor test | `node tests/test-canon-entry-40-two-chokepoint-floor.cjs -x` | ❌ Wave 0 |
| CANON-04 (Appendix B citations) | Three file:line citations present in Appendix B table/prose | floor test | `node tests/test-canon-entry-41-icm-citations-floor.cjs -x` | ❌ Wave 0 |
| CANON-05 (Part 4 edge reconciliation) | 15 shipped types added to Part 4 prose, mirroring entries 18/21/22's reconciliation style | floor test | `node tests/test-canon-entry-42-edge-reconciliation-floor.cjs -x` | ❌ Wave 0 |
| CANON-06/07/08 (Part 7 count, Part 2 Pinecone, Part 11 count) | Figures corrected, "corpus figures corrected" style | floor test(s) | per-entry, mirroring entries 13/16's lighter assertion style | ❌ Wave 0 |
| ALL | Frozen scalars unweakened across every wave | regression | `node tests/test-canon-frozen-scalars-floor.cjs` | ✅ exists |
| ALL | Prior 37 entries preserved, never removed/reworded | regression | existing entry-specific floor tests (`test-canon-entry-31-two-gauge-floor.cjs`, `test-canon-entry-36-shape-declaration-floor.cjs`) with version anchors bumped, per the established pattern | ✅ existing tests, version-anchor bumps are new work each wave |

### Sampling Rate
- **Per task commit:** the specific new floor test for that entry, e.g.
  `node tests/test-canon-entry-38-sourced-claims-floor.cjs`
- **Per wave merge:** `bash tests/run-all-340.sh` (once created) plus
  `node tests/test-canon-frozen-scalars-floor.cjs` plus every prior-entry floor test whose
  version anchor this wave bumps
- **Phase gate:** full suite green before `/gsd-verify-work`, matching every prior canon-amending
  phase's own stated gate (e.g. `bash tests/run-all-190.sh exit 0`)

### Wave 0 Gaps
- [ ] `tests/run-all-340.sh` - does not exist yet; model on `tests/run-all-190.sh`'s aggregator
  pattern (glob-discover the phase's own floor tests, run frozen-scalar + prior-entry floor tests
  alongside them, exit non-zero on any failure)
- [ ] Individual `tests/test-canon-entry-NN-<slug>-floor.cjs` files, one per Appendix D entry this
  phase's plan decides to create - entry numbers TBD at plan time (currently 37 entries exist;
  this phase's entries start at 38)
- [ ] Framework install: none needed (bare Node.js built-ins, already present)

## Security Domain

`security_enforcement` is absent from `.planning/config.json` (absent = enabled per the standing
instruction), so this section is included, though most categories are inapplicable to a pure
documentation-amendment phase.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase touches no auth surface |
| V3 Session Management | No | No session surface touched |
| V4 Access Control | No | No access-control code touched |
| V5 Input Validation | No | No user-input-handling code touched (the phase edits static markdown/prose files) |
| V6 Cryptography | No | No crypto surface touched |

### Known Threat Patterns for this stack
Not applicable in the conventional sense (no code execution surface added). The one
security-ADJACENT property worth naming: Part 8's Brain-boundary doctrine (LOCAL data -> BRAIN:
NO) is the repo's actual security constitution, and this phase's Appendix C fix (correcting the
Brain's cited origin URL) is a DOCUMENTATION-ACCURACY fix to that boundary's description, not a
change to the boundary's enforcement (the PR gate, the schema caps, the pre-commit
`check-brain-boundary.cjs` hook are all untouched by this phase and were independently re-
confirmed present via this session's file listings). No new attack surface is introduced by
correcting a URL string in a glossary entry.

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| N/A - no executable code surface added by this phase | - | - |

## Sources

### Primary (HIGH confidence - all live tool calls against the checked-out repo this session)
- `docs/MINDRIAN-CANON.md` (full text, all 868 lines, read across 4 Read calls) - the audited
  document itself
- `docs/CANON-PHASE-MAP.md` (full text, all 481 lines, read across 3 Read calls) - version-history
  precedent for every prior amendment's style
- `agents/larry-extended.md` (full text, 181 lines) - the shipped Larry persona, confirmed clean
  of Sourced Claims doctrine as CONTEXT.md's canonical_refs stated
- `lib/core/brain-client.cjs` (grepped for `getBrainUrl`, `BRAIN_URL`, `THEO_ORIGINS`) - confirms
  live default origin
- `lib/core/node-insert.cjs` (Read, header comment + `insertNode` function, lines 1-212) - confirms
  the write-chokepoint claim exactly as CONTEXT.md described it
- `lib/core/room-skeleton-scaffold.cjs` (grepped + Read for STATEMENT, CONTEXT.md writer,
  references/ factory, SECTION_NAMES) - confirms Appendix B's missing citations
- `lib/core/section-registry.cjs` (Read, first 40 lines) - confirms the L3 factory-directory
  framing
- `lib/core/navigation/edges.cjs` (`node -e` live enumeration of `ALLOWED_EDGE_TYPES`, 44 members)
  - the Part 4 drift finding
- `data/hitl-shape-declaration-schema.json` (grepped for `surface_count_principle`) - the exact
  four-glob surface-count formula
- `scripts/check-shape-declaration.cjs --check` (live run) - confirmed ~20+ live WARN-level
  declaration conflicts on skill files, beyond just a stale count
- `scripts/build-connector-registry.cjs --check` (live run) - confirmed green, connector registry
  itself is current
- `CLAUDE.md` (full text, read via project-context injection + targeted greps) - confirms
  "25 methodology commands" repeated 3x, "126 declared" once, Pinecone-retired stack line
- `.planning/phases/339-.../339-CONTEXT.md` (grepped for D-09, D-12) - Brain/Theo naming
  precedent this phase's Appendix C fix should follow
- `.planning/seeds/SEED-086-....md` (Read, first 60 lines) - the Sourced Claims doctrine's traced
  source, confirming CONTEXT.md's framing accurately represents the seed
- `.planning/ROADMAP.md` Phase 340 entry (grepped) - confirms the phase's own registered goal text
  matches CONTEXT.md's four-front framing
- `~/.claude/skills/icm-architect/SKILL.md` (full Read, 115 lines) - the ten invariants and
  six-forms taxonomy used as the "Don't Hand-Roll" checklist against Appendix B

### Secondary (MEDIUM confidence)
- Two arxiv papers relayed from a langtalks-graph-expert corpus query the orchestrator ran in
  parallel (this research's own session lacked MCP tool access to run it directly) - see
  "Grounding" section above for full provenance and the honesty caveat on their unread content

### Tertiary (LOW confidence)
- None. Every claim in this document is either `[VERIFIED: <live command>]`, `[CITED: <relayed
  corpus source with explicit provenance>]`, or listed in the Assumptions Log above.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A (no new packages/libraries) - this phase adds no dependencies
- Architecture (the amendment lifecycle pattern): HIGH - directly observed across 37 real prior
  executions of the exact same pattern, not inferred
- Part-by-part currency findings: HIGH for every finding marked `[VERIFIED: ...]` above (each was
  produced by a live grep/Read/`node -e` this session, not training-data recall); MEDIUM for the
  langtalks-relayed grounding (real corpus linkage confirmed, content relevance unread)
- Pitfalls: HIGH - each pitfall is grounded in an actual pattern observed in the Canon's own
  version-history text (e.g., Pitfall 1 is literally what happened to Part 4 across multiple
  phases, verified via the inline code comments naming those phases)

**Research date:** 2026-09-05
**Valid until:** This document's own findings will go stale FAST by the standards it just
documented - recommend the plan step re-run the exact live verification commands listed in "Code
Examples" immediately before drafting final Appendix D prose (not relying on this document's
numbers alone), since this repo ships canon-adjacent code multiple times per week. Treat this
research as valid for planning purposes for approximately 3-5 days; re-verify surface counts,
call-site counts, and file existence at execution time regardless.
