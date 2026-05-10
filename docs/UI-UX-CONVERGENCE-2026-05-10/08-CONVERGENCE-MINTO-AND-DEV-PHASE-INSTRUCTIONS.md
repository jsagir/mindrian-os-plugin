---
methodology: structure-argument (Minto Pyramid -- SCQA + MECE + 80/20 + root cause + workplan)
created: 2026-05-10
depth: deep
problem_type: ill-defined / complex
venture_stage: Design (Pre-Opportunity -> Opportunity-Identified boundary, per 00b)
room_section: problem-definition
brain_mode: mode-a confirmed (Aura live; the framework chain behind this convergence is graph-verified in 00b; re-weighted by 09)
---

# Convergence -- What MindrianOS Builds Next (+ Dev-Phase Instructions)

The Minto pyramid that collapses `01`-`07` + `09`, then the dev-phase instructions.

## SCQA

- **Situation:** MindrianOS v1.13.0 is 82% done (beta.9), shipping to a growing tester cohort, on a CLI-born UI system, with v1.14.0 (wiki) and v1.10.8 (smart-notebook) queued -- and *three* reverse salients now named: **distribution** (non-atomic install), **rendering** (no token core), and **activation** (the trigger that fires the Brain / the algorithmic workflows / web research isn't wired -- see `09`).
- **Complication (one sentence):** MindrianOS keeps adding surface area faster than it writes down the system underneath -- so the UI has 13 self-contradictions, the install fails four ways from one unaddressed root, the queued surface work would pile *more* UI onto an unwritten foundation, AND the moat (the Brain + the algorithmic workflows) is dormant because nothing triggers it.
- **Question:** What do we build next, in what order, so the foundation gets written down and the moat actually fires before more weight lands?
- **Answer (one sentence):** **Floor -> Trigger -> Foundation -> Surfaces** -- ship the broken install first (Phase 95.6, deadline-gated), wire the activation layer so the Brain/algorithms/web actually fire (Phase 91 + the proactive hooks), write the foundation down (the token core + a scoped UI Canon), then build the surfaces (v1.14.0 wiki, v1.10.8 sections, the F-picker) *on top of it*.

## MECE issue tree

```
ANSWER: Floor -> Trigger -> Foundation -> Surfaces (in that order)
|-- BRANCH 1 -- FIX THE FLOOR  [VITAL . deadline-gated]  "users can't install"
|     |-- 1a  Atomic install: preflight -> staged-apply -> rollback  (Phase 95.6 Tier 1)
|     |-- 1b  Post-install self-verify: /mos:doctor runs on first session -- all-green or names the gap
|     |-- 1c  Comms: third-party-warning explainer + one-line scope answer in pre-install copy
|     +-- 1d  Stop shipping .planning/ to the marketplace clone (or rename the >260-char Phase 92 dir) -- the root of the Windows long-path failure
|-- BRANCH 2 -- WIRE THE TRIGGER  [VITAL . the moat is dormant without it]  "nothing fires the Brain / the algorithms / web research"  (see 09)
|     |-- 2a  Navigation Engine (Phase 91) -- the "insight sensor" the Brain's own graph asked for: classify the conversation signal -> fire the matching capability (Brain query / algorithmic workflow / web research / methodology)
|     |-- 2b  Proactive hooks fire on signal -- room-proactive cross-relationship scan, auto-explore-domains on first material (Phase 117), auto-doctor post-install (= 1b)
|     +-- 2c  The v1.13.0 final gate TESTS the loop fires -- not "does the code exist" but "in a session that should trigger a Brain call, does one happen? routing_source: engine not legacy? does WebSearch fire when it should?"
|-- BRANCH 3 -- WRITE THE FOUNDATION  [VITAL]  "the system was never written down"
|     |-- 3a  Token core: extend Phase 121.5's palette.json -> surface-agnostic token graph (color+type+spacing+glyphs+component specs) + a resolution contract every renderer obeys
|     |-- 3b  UI Canon: rewrite ui-system/SKILL.md -- stop over-claiming ("ALL output"/"no exceptions"), scope to terminal body shapes, name the sanctioned exceptions (statusline emoji, ⬡ glyph, dashboard template, browser, Desktop echo), add a "Browser-Surface Rendering" section  (closes C1, C3, C4, C5)
|     |-- 3c  Resolve the 13 contradictions: Cynefin-sort -> fiat the Clear ones / analyze the Complicated / Six-Hats the ~3-4 Wicked -> ratify into the Canon
|     +-- 3d  Enforcement: CI linter (stray glyphs / non-palette colors / emoji in command files)  (closes the C5 / ✗-incident class)
|-- BRANCH 4 -- BUILD THE SURFACES  [after 1, 2, 3]  "more UI on the foundation"
|     |-- 4a  v1.14.0 "The Visible Room": wiki + dashboard + SnapshotHub -- consuming the token core, not redeclaring it; 104-01 ships first & standalone (closes Lawrence's empty-room P1)
|     |-- 4b  v1.10.8 smart-notebook: 3 new Tier-0 sections + synthesis voice -- re-scoped (memory half is stale post-v1.10.18); sections render through Shape A/B/C, no bespoke layout
|     +-- 4c  Shape F.1 picker (Phase 88.2): uses the token core component spec; designed for all 3 surfaces (keyboard / HTML / conversational)  (closes C6)
+-- BRANCH 5 -- FIX WHAT'S BROKEN AT SCALE  [parallel . lower priority]  "the room loses track of itself"
      |-- 5a  Room-identity surface across CLI/Desktop/Cowork (the "core power" bug; missing Desktop echo)
      |-- 5b  Brain-derivation-queue auto-drain hook
      +-- 5c  FEYNMINTO-01 budget scaling for mega-sections
```

## 80/20 -- the vital few

**Branches 1, 2, 3.** Do just `1a + 2a + 3a + 3b` and you unlock ~80% of everything downstream: install works, the moat fires, there's one place to point at for design, the renderers have something to build against. Branch 4 is real but it's a *consequence* -- it gets dramatically easier the moment 1-3 land. Branch 5 is parallel. **Kill the trivial many (for now):** aesthetics work, motion language, theme proliferation, the v1.14.0 nice-to-haves (FSRS/canvas/journal/frontmatter-SQL -- already out of scope, keep it there), per-agent model frontmatter.

## Root causes (vital 20%)

| Branch | Root cause | Type | Strategy |
|---|---|---|---|
| 1 Floor | `install.sh` = `set -euo pipefail`, no trap, no staged-apply, no post-check; `.planning/` ships to the marketplace clone with a >260-char dir name | System design | Redesign the install: preflight -> stage -> verify -> commit; stop shipping `.planning/` |
| 2 Trigger | The activation layer (the "insight sensor" / Navigation Engine, Phase 91) was scaffolded but never wired -- skill activation runs on legacy file-state behavior; the Brain, the algorithmic workflows, and web research are capabilities with no invoker | System design | Wire the sensor: classify signal -> fire capability -> surface via the Decision Gate; gate the milestone on "the loop fires" |
| 3 Foundation | The UI system congealed in executor output, never extracted into tokens; `ui-system/SKILL.md` is prose that over-claims totality it can't back | System design + information gap | Extract the implicit system into a token artifact + a scoped Canon (the same "make-the-implicit-explicit" move that produced the Mindrian Canon); add a linter so it stays explicit |
| 4 Surfaces | v1.14.0 + v1.10.8 were scoped *before* the token core / Canon existed -> each redeclares design values | Sequencing | Re-order: surfaces depend on the foundation; gate 4a/4b/4c on 3a/3b shipping |
| 5 Scale | Source-of-truth ambiguity (active room) + no drain processor + a hardcoded token budget | System design + resource constraint | Single source of truth for active room; add a drain hook; relax/scale the budget or add sub-section hierarchy |

---

# Dev-Phase Instructions

**Sequencing:** `95.6 (now, deadline) -> 91 + proactive hooks (the trigger) -> 121.5 PROMOTED (token core + Canon v2 + linter + contradiction pass) -> 104-01 standalone -> v1.14.0-rest + v1.10.8 + 88.2 (all consuming the token core)  ||  Branch 5 in parallel as capacity allows`

### Phase 95.6 -- atomic-install-and-skill-loop-resilience  [NEXT . CRITICAL]
- **Do:** `/gsd:plan-phase 95.6` (artifacts ready, committed `a7ec823`) -> execute Tier 1 (D-02 + D-03 + D-01 + D-05a + D-09): preflight (longpaths, expected-files, npm-package-exists) + staged atomic apply with rollback + post-install `/mos:doctor` auto-run + third-party-warning explainer + scope answer in pre-install copy.
- **ADD to scope:** stop shipping `.planning/` to the marketplace clone (or rename the >260-char Phase 92 dir) -- that's the *root* of the Windows clone failure.
- **ADD to scope (housekeeping, surfaced 2026-05-10):** update `mcp-server-brain/test-brain.cjs` Test 5 to expect 6 tools incl. the new `brain_ask` (currently a stale 2-failure); run a `brain-admin` dedup pass on the key registry (Jonathan ×2/3, Aryeh ×2, Gary ×3 duplicate-email rows).
- **Gate:** cold Windows tester (Gary) installs with zero AI hand-holding; `/mos:doctor` all-green on first session. **Deadline:** hard 2026-06-01 (NATO Rome) / soft 2026-05-11. **Ships as** v1.13.0-beta.9. **Canon:** Parts 6, 7.

### Phase 91 (+ proactive hooks) -- the trigger  [ELEVATED -- this is the thesis of "The Closed Loop", not a parallel item; see 09]
- **Do:** wire the Navigation Engine -- the "insight sensor" the Brain's own beautiful-question node asked for (*"How might we design 'insight sensors' that trigger the most appropriate methodology lens?"*, action `Create smart triggers`). Classify the conversation signal (insight type / stage / problem type / persona) -> fire the matching capability (Brain query, an algorithmic workflow -- explore-domains / whitespace / reverse-salient / HSI, web research, a methodology) -> surface the result through the Decision Gate. Heuristic sensors first, full engine later (the question says "triggers" plural, lightweight).
- **Also:** Phase 117 (auto-explore-domains-on-first-material) so the *empty room* gets a domain tree + whitespace map + candidate Opportunity Bank entries automatically; the room-proactive cross-relationship scan fires mid-session; auto-doctor post-install (= 95.6 1b).
- **Gate (v1.13.0 final, hard):** the loop **fires** -- in a session that should trigger a Brain call, one happens (`routing_source: engine`, not `legacy`); in one that should trigger WebSearch, it does; in one that hits first material, explore-domains runs. *Test the firing, not the code's existence.* (This is already in Phase 94-03's acceptance criteria -- `routing_source: engine` "in at least one trace per session when Brain reachable" -- and it has been emitting `legacy` all along. That's the symptom, live.)

### Phase 121.5 -- PROMOTE: terminal-coherence-capstone -> "the token core"  [last phase before v1.13.0 final gate]
- **Promote `palette.json`** -> a **surface-agnostic** token graph: color + type scale + spacing scale + the 12 glyphs (with SVG variants -- add `⬡` as glyph #13, the brand mark, closing C5) + component specs (incl. the Shape F picker) + a resolution contract: *every renderer -- CLI, browser, conversational -- resolves against this; nothing redeclares.*
- **SKILL.md v2 must:** scope `ui-system` to terminal body shapes; name the sanctioned exceptions (statusline emoji carve-out, `⬡` glyph, dashboard template, browser surfaces, Desktop prose echo); add a "Browser-Surface Rendering" section; resolve which statusline carve-outs survive. (Closes C1, C3, C4.)
- **Add: the CI linter** (stray glyphs / non-palette colors / emoji in command files). (Closes C8 / the `✗`-incident class.)
- **Add: the contradiction-resolution pass** -- Cynefin-sort the 13 (`05`), decide the Clear ones by fiat in the token file, queue the ~3-4 Wicked ones for `/mos:think-hats`.
- **Gate:** zero hardcoded hex/glyphs in any renderer; the skill no longer says "ALL output"/"no exceptions"; CI fails on a UI-vocabulary violation; each of the 13 contradictions has a written disposition. **Precondition for:** Part 10 ratification at the v1.13.0 final gate AND the entire v1.14.0 sprint.

### Phase 104 / v1.14.0 "The Visible Room"  [DEPENDS ON 121.5 . re-sequence internally]
- **104-01 ships first and standalone** (`resolve-room` + ANSI strip + Larry-voice empty-state messages) -- closes Lawrence's P1 blocker, precondition for the rest. Don't bundle it.
- **104-02..05 consume the token core** -- no redeclared hex, no fourth icon set; the wiki's interactive forks render **Shape F semantics** (tri-context, 10 verbs, ≥0.7 RECOMMENDED gate).
- **SnapshotHub:** same renderer, presentation-grade variant -- carries the token core offline.
- **Adopt the Mode-A spine** (`00b`): `Design Thinking -> [Map the Hierarchy -> Hierarchy Mapping -> Systems Thinking] -> {JTBD, User Journey Mapping} -> Process Mapping for Innovation -> Reverse Salient Analysis -> PWS Value Proposition`. The four `User Journey Mapping HAS_PROCESS_STEP` nodes (Cast a Wide Net / Track Multiple Dimensions / Find Hidden Problems / Follow Workarounds) map 1:1 onto 104-02..05. Update the methodology-spine line in `.planning/TODO.md` accordingly.
- **Gate:** the 6-point UI/UX acceptance bar already in the TODO entry.

### v1.10.8 smart-notebook  [DEPENDS ON 121.5 . RE-SCOPE before writing the memo]
- **Re-scope:** drop the "promote memory-ops.cjs to Tier 3 / cross-session memory" half (Phase 88-90 + the SQLite migration shipped most of it). Keep the section-scaffold half (Mullins 7-domain authority, 3 new Tier-0 sections, `KNOWN_SECTIONS` 11->14).
- **Rendering:** the 3 sections go through Shape A/B/C with no bespoke layout; synthesis voice = `larry-personality`, not a new format; any synthesis fork = Shape F.
- **Gate:** the 4-point UI/UX acceptance bar already in the TODO entry.

### Phase 88.2 -- Shape F.1 picker  [re-anchor on the token core]
- Re-anchor on **121.5's component spec**. Design for all three surfaces -- keyboard picker (CLI), HTML selector (wiki), conversational rendering (Desktop). Downgrade "implemented via AskUserQuestion (invariant)" to "the CLI/Cowork implementation"; make the Desktop conversational rendering a first-class variant. (Closes C6.)

### Branch 5 -- parallel, lower priority
- **Room-identity surface across 3 surfaces** -- fold into 121.5's two-row-statusline + render-v2 work; extend to the Desktop prose echo. (The "core power" bug + C12.)
- **Brain-derivation-queue auto-drain hook** -- on-stop or session-start. (Already in `deferred-items.md` with a re-trigger.)
- **FEYNMINTO-01 budget scaling** -- relax or add sub-section hierarchy. (Already deferred with a re-trigger.)

## The untested assumption to stress-test before committing this re-order

**Phase 121.5 absorbing the promoted token-core + Canon-v2 + linter + contradiction-pass scope without blowing its "last phase before the v1.13.0 final gate" timing.** If it can't, the whole sequence shifts (either 121.5 splits, or the token core becomes an early v1.14.0 phase that everything else waits on). Run `/mos:challenge-assumptions` on it. Second assumption to test (`09`'s): is the *full* Navigation Engine the right shape, or does the trigger need to be cheaper/dumber first (heuristic sensors -> engine later)? The Brain's question says `action: Create smart triggers` -- plural, lightweight -- which leans toward "sensors first."
