# Phase 148: LarryReach Selector Re-wire (Intelligence + Toggleable Components) - Research

**Researched:** 2026-06-08
**Domain:** In-conversation selector re-wire (HMI dial + workflow ranker + command resolver), AskUserQuestion-only interactivity, Canon Part 3/4/8/9
**Confidence:** HIGH (this is a ~90% repoint of SHIPPED, read-verified code; all extension points and drift fences were read directly, not assumed)

## Summary

Phase 148 is a re-point, not a rebuild. Every reach and suggestion already has a shipped rendering host (`shape-f1-renderer.cjs`), a shipped reach orchestrator (`dial-reach-orchestrator.cjs`), a shipped JTBD ranker (`f-selector-ranker.cjs`), a shipped 4-outcome commit door (`dial-close-reach.cjs`), a shipped framework->command resolver (`command-resolver.cjs`), and a shipped write chokepoint (`navigation.cjs`). The five PWS engines plus Hats already exist as commands AND already carry `connector:` frontmatter that maps each one to a framework name and a reach_id. The plumbing the navigator complained about is real: the dial previews 5 mechanism reaches whose row labels are WHAT-THEY-GET prose, but selecting one does not run an engine -- it writes a `SELECTED_REACH` edge to a plumbing label. [VERIFIED: read of `lib/hmi/dial-reach-orchestrator.cjs`, `lib/workflow/dial-close-reach.cjs`]

**The single most important finding (a hard architectural conflict the planner MUST resolve before any task is written):** the SPEC says "engines become ranked reach-ids" and "Hats becomes the 6th reach, DIAL_REACH_K 5->6." But the SHIPPED doctrine -- in `skills/larry-personality/SKILL.md`, `skills/intelligence-orchestrator/SKILL.md`, `lib/core/sensors/sensor-types.cjs` (`REACH_IDS` frozen list), the generated `data/connector-registry.json`, and FOUR adversarial drift tests (`test-reach-ids-drift.cjs`, `test-dial-reach-orchestrator.cjs`, `test-dial-end-to-end-states.cjs`, the connector `--check` tripwire) -- fences `reach_id` to EXACTLY the frozen five `{context_block, contradiction, cross_room, brain_consult, deep_research}`, and asserts `DIAL_REACH_K === 5`. In the shipped model, the engines are NOT reach_ids; they compose UNDER the frozen reaches as `sub_mode` RENDER LABELS, and there is "NO 6th reach_id" stated verbatim in two SKILL files. Minting a 6th `reach_id` for Hats or 5 new engine reach_ids would break every one of those tests and contradict the constitution. The reconciliation (and the most likely intended reading of the spec's "ranked reach SET") is: **`DIAL_REACH_K` is a SECOND, dial-local preview-cap constant, distinct from the frozen `REACH_IDS` machine-token set.** Raising `DIAL_REACH_K` 5->6 raises how many dial rows preview; it does NOT mint a 6th machine `reach_id`. The engine/Hats rows ride as `sub_mode` labels over the existing frozen reach_ids (find-bottlenecks -> `context_block`, think-hats -> `brain_consult`, etc., already declared in their connector frontmatter). The planner must lock this reading with the navigator (it is in the Assumptions Log as A1) because the two phrasings are genuinely in tension and the wrong reading detonates the drift suite.

**Primary recommendation:** Build a new `lib/hmi/reach-component-map.json` (data, not code) + a thin resolver that the existing `selector-dispatcher.cjs` consults to route each reach/suggestion to its archetype component (Select / multiSelect / ordered-checkbox / group-multiselect / confirm / raw / text). Add engine + Hats rows as `sub_mode`-labelled previews UNDER the frozen reach_ids (raise the dial-preview cap `DIAL_REACH_K` to 6, leave the `REACH_IDS` frozen-5 machine set and `MAX_K=3` and the 0.70/0.15 gate byte-unchanged). Wire `dial-close-reach.cjs` so a committed engine reach resolves its framework through `command-resolver.commandsForFramework()` and FIRES the real command (the resolver door the `intelligence-orchestrator` already uses). Unify `resolveOfferNextStep` + suggest-next + F.1 onto the dispatcher's one F.1 path (the `research-filing-selector.cjs` precedent already proves a feature can route its selector through `pickShape({requestedShape:'F.1'})` rather than building a bespoke one).

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Intelligence engines default to multi-select / queue (check several engines, run as a batch). NOT Select-one. In-conversation this = `AskUserQuestion` `multiSelect: true`.
- **D-02:** Compose-a-sequence is a separate on-demand option using the ordered-checkbox (check-order = pipeline order). Not the default render; reached when the navigator wants a chain. NOTE the TTY wall: a live ordered-checkbox widget cannot run in-conversation; ordered/compose intent must be represented through AskUserQuestion (e.g. a follow-up ordering prompt). The live widget is Phase 154.
- **D-03:** Each reach class maps to its archetype component via a NEW component-map (`lib/hmi/reach-component-map.json`): engines = multi-select, compose = ordered-checkbox, File = multi-select, Brain review = auto (no pick), Hats = confirm-gated. Every component resolves from the F-family via the dispatcher (SEED-020, no bespoke widget).
- **D-04:** On select, Brain review auto-reviews the latest findings -- surfaces contradictions and suggests the next framework chain, NO scope prompt. Typed methodology packet only; zero user-content egress (Part 8); Brain is external cortex (Part 9).
- **D-05:** File = pick-which-findings (multi-select when several findings are on the table), then write the typed edge via `navigation.cjs` and report where it landed. The multi-select submit IS the confirm step (no separate y/n).
- **D-06:** Hats (the 6th ranked reach) confirms before running ("Build research personas + run the hats? research spin, ~1 min"), and its row carries a "go deep" marker. Research personas are cached per room, rebuilt on demand.
- **D-07:** At cold-room / no-signal (tier_0, session start, empty room), the selector leads with "what can I help you with". Once there is JTBD signal, the six intelligence reaches lead instead.
- **D-08:** Matching = the navigator types intent, and Larry matches relevant /mos: commands via command-resolver (Phase 122) + JTBD ranking, presented as reaches with their components.

### Claude's Discretion
- Cold-room tier_0 base set keeps the canon fallback (Run Methodology / Reformulate / Free-Text) beneath the "what can I help you with" lead, plus the standing trio.
- The standing trio (File these findings + Brain review + Free-Text-last) renders at every selector render regardless of mode/tier.
- The "go deep" marker uses the existing 12-glyph UI-ruling vocabulary (candidate: the lightning glyph already used for heavy/convergence), not a new glyph; final pick is the planner's within the vocabulary.
- Multi-select batch submit + confirm uses the AskUserQuestion multiSelect primitive; no bespoke widget.
- recommended-marker (frozen 0.70/0.15 gate) coexists with multi-select: the recommended reach is pre-highlighted but the navigator can still check others. The gate and MAX_K=3 chooser cap are unchanged.

### Deferred Ideas (OUT OF SCOPE)
- Full /mos:help page redesign + grouped lane menu - Phase 152.
- Path A standalone keyboard cockpit (Ink + @clack/prompts + inquirer-ordered-checkbox, arrow keys / live toggles) - Phase 154.
- De Stijl color-block painting (red=selected, yellow=recommended, blue=deep cells) - Phase 151/152.
- Hebrew / RTL bundle (`lib/render/bidi.cjs`, retire HEBREW_REFUSAL) - Phase 153.
- Ask-Tell keyboard slider (live left/right posture control) - Phase 154.
- interaction_archetype rollout across the ~80 /mos: commands - Phase 152.

## Phase Requirements

| ID | Description (from SPEC.md) | Research Support |
|----|---------------------------|------------------|
| IRW-01 | The 5 PWS engines become members of the ranked reach set; each resolves to a real command via `command-resolver.cjs` and is rankable by `f-selector-ranker.cjs` | All 5 engine commands exist (`find-bottlenecks`, `rs-fetch`, `whitespace`, `find-analogies`, `find-connections`, `dominant-designs`) AND are present in `data/command-registry.json` with `serves_jtbd` + `frameworks` + `connector:` frontmatter; each maps to a framework name resolvable by `commandsForFramework()`. Engines ride as `sub_mode` labels under frozen reach_ids, NOT as new reach_ids (see A1). [VERIFIED: registry grep + connector frontmatter read] |
| IRW-02 | Hats as the 6th ranked reach; `DIAL_REACH_K===6`; research personas cached per room, rebuilt on demand | `think-hats` exists, connector maps it to `brain_consult` / `sub_mode: six-hats` / framework "Six Thinking Hats". `DIAL_REACH_K` is a dial-local preview cap (currently 5) DISTINCT from the frozen `REACH_IDS` set and from `MAX_K=3`; raising it to 6 is a one-line constant change PLUS updating the two drift tests that hardcode `=== 5`. Per-room cache precedent: Phase 124 timeline / 143.1 dial-memory (CONTEXT.md). [VERIFIED: read of `dial-reach-orchestrator.cjs` + the two `=== 5` test assertions] |
| IRW-03 | File + Brain review always-open standing options OUTSIDE the MAX_K=3 cap; Free-Text always last | `shape-f1-renderer.cjs` hardcodes Free-Text-always-last (`normalizeVerbs` appends it, callers cannot omit). Standing options attach as render-time rows the renderer appends AFTER the ranked/capped set, not as ranker candidates. `dial-reach-orchestrator.cjs` already separates `total_count` (all previewed) from `offered_count = min(total, OFFERED_CAP=MAX_K)` -- the standing trio rides outside `offered_count`. [VERIFIED: read of both renderers] |
| IRW-04 | Per-option toggleable component routing across the whole surface; >=3 distinct components; a non-intelligence reach also carries a non-default component | NEW `reach-component-map.json` keyed by reach_id/sub_mode -> archetype; resolved through `selector-dispatcher.cjs` (SEED-020). The dispatcher already routes F.0-F.7 sub-shapes; the map adds an archetype dimension. AskUserQuestion `multiSelect:true` is already used in repo (`research-filing-selector.cjs`, `commands/research.md`). [VERIFIED: dispatcher read + multiSelect grep] |
| IRW-05 | Unify offer-resolver + suggest-next + F.1 Next Move onto one component-routed host | `resolveOfferNextStep` lives in `navigation-engine.cjs` and delegates to `navigation-engine-offer.cjs::resolveOffer` (returns ONE offer). `research-filing-selector.cjs` is the proof-of-pattern: it routes its gate through `dispatcher.pickShape({requestedShape:'F.1'})` rather than a bespoke selector. Unify all three on that single `pickShape` F.1 path. [VERIFIED: read of offer-resolver + filing-selector] |
| IRW-06 | Real invocation: selecting a reach runs the engine + writes SELECTED_REACH edge + lands artifact | `dial-close-reach.cjs::closeReach` already writes the `SELECTED_REACH` edge via `navigation.writeEdge` on the `sync`/`pivot` outcomes. The GAP: it writes `target_id: 'cmd:' + reach.command` but never RESOLVES or FIRES the command. The fix: resolve `reach.framework` -> command via `commandsForFramework()` (the resolver door the orchestrator already uses in STEP 5), fire it, then the existing filing path (`fileEvidenceWithReadback` / `wireAccept`) lands the artifact. [VERIFIED: read of `closeReach` + `intelligence-orchestrator` STEP 5] |
| IRW-07 | Frozen contracts + ranker preserved: MAX_K=3, RECOMMEND_FLOOR=0.70, MARGIN_THRESHOLD=0.15, SEED-020 no bespoke widget | All four constants are exported and test-fenced today: `f-selector-ranker.MAX_K===3`, `dial-reach-orchestrator.RECOMMEND_FLOOR===0.70` / `MARGIN_THRESHOLD===0.15`. The component-map must resolve every component through the dispatcher (no bespoke AskUserQuestion construction -- the `research-filing-selector.cjs` header states this rule verbatim). [VERIFIED: exports read] |
| IRW-08 | Brain review boundary-safe (zero egress): typed methodology packet only; local writes via navigation.cjs; check-brain-boundary passes; adversarial test asserts no user-content reaches Brain | The Part-8 enforcement surfaces exist: `lib/core/brain-response-sanitize.cjs` (A3 sanitizer, Phase 117-04), the egress audit `rs-egress-prompts.cjs::auditQueryString` (already used by `dial-label-composer.cjs` for the `{framework}` slot), the Phase 110 typed-packet contract, and the grep-sweep pattern in `run-all-1433.sh` (forbidden token + free-text-body-field scan). The Brain review path reuses these; it never builds a freeform Brain query. [VERIFIED: scan locations found] |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Reach ranking (which 6 reaches, in what order) | Workflow (`f-selector-ranker.cjs` + `dial-reach-orchestrator.cjs`) | - | The ranker owns score; the orchestrator owns the dial preview + frozen gate. Pure, sync, LOCAL. |
| Component routing (which widget per reach) | HMI (`selector-dispatcher.cjs` + new `reach-component-map.json`) | - | SEED-020: the dispatcher is the only door; the map is data the dispatcher reads. |
| Reach rendering (the F.1 host) | HMI (`shape-f1-renderer.cjs`) | - | Free-Text-always-last + RECOMMENDED marker live here; the suggest surfaces unify onto it. |
| Command invocation (run the real engine) | Workflow (`command-resolver.cjs` -> the `/mos:<engine>` command) | Skills (`intelligence-orchestrator`) | The resolver is the ONLY framework->command door; the orchestrator is the existing consumer that proves the firing path. |
| Edge + artifact write | Core (`navigation.cjs` chokepoint) + filing (`file-evidence-readback.cjs` / `findings-wirer.cjs`) | - | Part 9: all writes route through the chokepoint; `SELECTED_REACH` is system-bookkeeping. |
| Brain review (outside review) | Core (Phase 110 typed packet + `brain-response-sanitize.cjs`) | Brain MCP (remote) | Part 8/9: Brain is external cortex; only generic handles cross; zero user content. |
| Cold-room intent matching ("what can I help you with") | Workflow (`command-resolver.cjs` + `f-selector-ranker.cjs`) | HMI (free-text capture row) | D-08: typed intent -> resolver + JTBD rank -> reaches with components. |
| Tier-mode selection (lead with help vs intelligence) | Core (`getRoomContext` / `resolveTierMode`) | - | mode_a / mode_b / tier_0 already drives option generation (Canon Part 3). |

## Standard Stack

This phase adds ZERO new npm packages. It is pure-CJS, node-built-ins-only, reusing the shipped stack. The interactive primitive is `AskUserQuestion` (the harness menu), already the repo's only interactivity surface.

### Core (all SHIPPED, reused verbatim or extended)
| Module | Purpose | Why Standard |
|--------|---------|--------------|
| `lib/hmi/dial-reach-orchestrator.cjs` | Builds the ranked ReachList; holds `DIAL_REACH_K`, the frozen 0.70/0.15 gate, `OFFERED_CAP=MAX_K` | The surface-agnostic reach core; pure/sync/LOCAL; extend reach previews here |
| `lib/hmi/shape-f1-renderer.cjs` | F.1 Next Move render host; Free-Text-always-last; RECOMMENDED `▶`/row `▷` markers | The single render host the suggest surfaces unify onto |
| `lib/hmi/selector-dispatcher.cjs` | `pickShape()` -- the SEED-020 single door for all F/G/H rendering; tier gating; JUST_TALK refuse; AskUserQuestion trailer | Every component must resolve through this; no bespoke widget |
| `lib/hmi/dial-label-composer.cjs` | The 5 frozen WHAT-THEY-GET template families + the Part-8 `{framework}` egress audit | Add label families for the engine + Hats rows here (Plan-N revision discipline) |
| `lib/workflow/f-selector-ranker.cjs` | `rankForSelector()` -- D4 score, investment-aware `why`, `MAX_K=3` | JTBD-ranks the engine reaches; reads `data/command-registry.json` |
| `lib/workflow/dial-close-reach.cjs` | `closeReach()` -- the 4-outcome commit (sync/pivot/defer-reject/miss) through `navigation.cjs` | Real invocation hangs off the sync path (the IRW-06 gap) |
| `lib/workflow/command-resolver.cjs` | `commandsForFramework()` / `frameworksForCommand()` / `composeWorkflow()` -- the ONLY framework->command door | Powers BOTH engine invocation (IRW-06) and help-entry matching (D-08) |
| `lib/core/navigation.cjs` | The 13-function write chokepoint: `writeEdge`, `logMemoryEvent`, `getActiveFocus`, `getNeighborhood`, `confirmNode`, `findRecentChanges`, `firstCapturedLastTouchedBySection` | All edges/artifacts route here (Part 9) |
| `lib/core/navigation-engine-offer.cjs` | `resolveOffer()` -- the offer-resolver body (Phase 135); returns ONE calibrated offer or null | Unify onto the F.1 host (IRW-05) |
| `skills/intelligence-orchestrator/SKILL.md` | The reach dispatcher; consumes `dispatchSensors`; the 5-step loop ending in resolve+fire | The firing-path precedent; Brain-boundary doctrine stated verbatim |
| `data/command-registry.json` | Generated registry the ranker + resolver read | All 7 engine commands present with jtbd/frameworks/teaching fields |
| `data/connector-registry.json` | Generated reach routing table; sensor_index | Engines already mapped to frozen reach_ids via `sub_mode` |
| `data/dispatch-framework-map.json` | slug/sub_mode -> EXACT framework name (WFL-01) | `find-bottlenecks` -> "Reverse Salient Analysis", `think-hats` -> "Six Thinking Hats", etc. |

### Supporting (SHIPPED, reused for specific paths)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `lib/core/navigation/file-evidence-readback.cjs::fileEvidenceWithReadback` | Files an engine artifact with read-back honesty | IRW-06 artifact landing (the orchestrator's `filing` field) |
| `lib/core/findings-wirer.cjs::wireAccept` | Filing fallback on readback error | IRW-06 fallback path |
| `lib/core/brain-response-sanitize.cjs` | A3 PII-redaction sanitizer (Phase 117-04) | IRW-08 Brain review egress gate |
| `lib/core/rs-egress-prompts.cjs::auditQueryString` | Throws on forbidden-pattern hit; default-deny | IRW-08 typed-packet framework-handle audit (already used by the label composer) |
| `lib/core/research-filing-selector.cjs` | F.1 filing gate routed through the dispatcher (NOT bespoke) | The proof-pattern for D-05 File multi-select and for unifying onto pickShape |
| `lib/hmi/dial-presenter.cjs` | CLI presenter (resolve/format split) | The format layer over the orchestrator's structured ReachList |
| `lib/core/feynman/dial-memory-renderer.cjs` | Per-room dial memory render | Precedent for the Hats per-room persona cache pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sub_mode` labels under frozen reach_ids | Mint 5 engine + 1 Hats new reach_ids | Breaks `test-reach-ids-drift.cjs`, `sensor-types.REACH_IDS`, both SKILL files' "no 6th reach_id" doctrine, and the connector `--check`. Do NOT. (A1) |
| `reach-component-map.json` (data) | Hardcode archetype switch in the dispatcher | Data file matches the connector-registry / command-registry "registry-is-the-table" pattern; resolvable + drift-testable; no code edit to add a reach |
| Reuse `pickShape` for multiSelect | Build a bespoke AskUserQuestion multiSelect call | Violates SEED-020 (no bespoke widget); `research-filing-selector.cjs` header forbids it verbatim |
| Ink / @clack / inquirer-ordered-checkbox | (none -- in scope) | The TTY wall forbids any of these in-conversation (research Section 0); they are Phase 154 / Path A only |

**Installation:** None. Zero new dependencies. (Confirmed against CLAUDE.md "Existing Stack -- DO NOT CHANGE" and the research Section 10 surface audit: "zero inquirer/clack/ink/blessed/readline/setRawMode in the repo today" -- and Phase 148 keeps it that way.)

## Package Legitimacy Audit

> Not applicable. Phase 148 installs ZERO external packages. It reuses the shipped pure-CJS stack and adds one data file (`reach-component-map.json`) plus thin glue. No npm/PyPI/crates install occurs. slopcheck not run because there is nothing to check. If any plan introduces a package (it should not -- the TTY wall forbids the keyboard-TUI libs in-conversation), that plan must run the Package Legitimacy Gate and gate the install behind a `checkpoint:human-verify`.

## Architecture Patterns

### System Architecture Diagram

```
                    ROOM STATE (getRoomContext / resolveTierMode)
                              |
                  tier_mode: mode_a | mode_b | tier_0
                              |
              +---------------+----------------+
              |                                |
       (signal present)                 (cold room / tier_0)
              |                                |
              v                                v
   f-selector-ranker.rankForSelector    "what can I help you with"
   (D4 score, investment why,            free-text intent capture (D-07/D-08)
    MAX_K=3 chooser clamp)                       |
              |                          command-resolver.commandsForFramework
              v                          + JTBD rank -> reaches w/ components
   dial-reach-orchestrator.buildReachList         |
   (preview DIAL_REACH_K=6 rows:                  |
    5 engines as sub_mode + Hats;                 |
    frozen 0.70/0.15 gate; offered_count=MAX_K)   |
              |                                    |
              +----------------+-------------------+
                               |
                               v
            reach-component-map.json (NEW data)  --reach_id/sub_mode--> archetype
                               |
                               v
         selector-dispatcher.pickShape({requestedShape:'F.1', ...})  [SEED-020 single door]
         shape-f1-renderer  (+ standing trio appended OUTSIDE MAX_K cap:
                             File [multiSelect] / Brain review [auto] / Free-Text [last])
                               |
                  AskUserQuestion (multiSelect:true | confirm | text)
                               |
              navigator picks (check several = batch; ordered-checkbox = compose)
                               |
                               v
        dial-close-reach.closeReach({outcome})  ---- 4 outcomes ----+
                               |                                     |
                 sync/pivot (committed reach)             defer/reject/miss
                               |                          (recordSelectorDecision /
                               v                           recordSelectorMiss)
        command-resolver.commandsForFramework(reach.framework)  [IRW-06 NEW]
                               |
                     fire the real /mos:<engine> command
                               |
              +----------------+------------------+
              |                                   |
        navigation.writeEdge                 fileEvidenceWithReadback
        SELECTED_REACH (system bookkeeping)  (lands engine artifact)
              |                                   |
              +----------------+------------------+
                               v
                        room.db (LOCAL)  -- Part 8: zero Brain egress
                                          -- Brain review path = typed packet only
```

### Recommended Project Structure (deltas only; this is a repoint)
```
lib/hmi/
├── reach-component-map.json     # NEW (data): reach_id/sub_mode -> archetype component
├── dial-reach-orchestrator.cjs  # EDIT: DIAL_REACH_K 5->6; add engine+Hats sub_mode previews
├── dial-label-composer.cjs      # EDIT: add label families for engine + Hats rows
├── selector-dispatcher.cjs      # EDIT: consult reach-component-map; route archetype
└── shape-f1-renderer.cjs        # EDIT (minimal): standing-trio rows outside the cap (or do this in the host that composes the F.1 call)
lib/workflow/
├── dial-close-reach.cjs         # EDIT: sync/pivot path resolves framework->command and FIRES it (IRW-06)
└── f-selector-ranker.cjs        # UNCHANGED (MAX_K=3 frozen); engines already in the registry it reads
lib/core/
├── navigation-engine-offer.cjs  # EDIT: unify offer-resolver output onto the F.1 host (IRW-05)
└── (new thin Brain-review helper if needed)  # typed-packet-only, reuses brain-response-sanitize + auditQueryString
tests/
├── test-reach-ids-drift.cjs         # EDIT: still exactly-5 reach_ids (engines are sub_mode, not reach_ids)
├── test-dial-reach-orchestrator.cjs # EDIT: DIAL_REACH_K assertion 5->6; reach-set assertion accommodates sub_mode previews
├── test-dial-end-to-end-states.cjs  # EDIT: two-K separation now MAX_K=3 vs DIAL_REACH_K=6
└── test-148-*.cjs + run-all-148.sh  # NEW: the IRW-01..08 falsifiable suite
```

### Pattern 1: Registry-is-the-table (the component map)
**What:** Route by reading a generated/maintained data file, never a hardcoded switch.
**When to use:** The reach->component mapping (D-03).
**Example:**
```
// Source: skills/intelligence-orchestrator/SKILL.md ORCH-01 (verified read)
// "The orchestrator reads data/connector-registry.json and NEVER a hardcoded
//  routing table." Mirror this for reach-component-map.json:
//   reach_id/sub_mode -> { archetype: 'multiSelect'|'ordered'|'confirm'|'select'|'group'|'text'|'auto' }
// The dispatcher reads the map; a new reach joins by adding a row, never by editing code.
```

### Pattern 2: Resolve-through-the-one-door (firing the engine)
**What:** Never name a `/mos:` slug from memory; resolve every command through `commandsForFramework`.
**When to use:** IRW-06 real invocation; D-08 help matching.
**Example:**
```
// Source: skills/intelligence-orchestrator/SKILL.md STEP 5 (verified read)
// On commit: framework = reach.framework (e.g. "Reverse Salient Analysis")
//   const cmds = commandResolver.commandsForFramework(framework);
//   if (cmds.length === 0) -> "run <framework> manually" (DEGRADE, never fabricate)
//   else fire cmds[0]; then fileEvidenceWithReadback(...) lands the artifact.
```

### Pattern 3: Unify onto pickShape, never bespoke (the suggest-surface merge)
**What:** Produce the selector by routing through `dispatcher.pickShape({requestedShape:'F.1'})`.
**When to use:** IRW-05 (offer-resolver + suggest-next + F.1 collapse to one path).
**Example:**
```
// Source: lib/core/research-filing-selector.cjs header (verified read)
// "It is NOT a bespoke research selector. The gate is produced by routing
//  through the dispatcher's pickShape({ requestedShape: 'F.1', ... })."
// Apply the identical pattern to the offer-resolver and suggest-next surfaces.
```

### Anti-Patterns to Avoid
- **Minting a 6th reach_id (or 5 engine reach_ids):** breaks 4 drift fences + 2 SKILL constitutions. Engines/Hats are `sub_mode` labels under the frozen 5. (A1)
- **Raising MAX_K above 3:** explicitly fenced (`test-dial-reach-orchestrator` asserts `MAX_K===3` "untouched"). The "need more than 3" complaint is answered by multiSelect (check several) + standing options OUTSIDE the cap, NOT by raising the cap.
- **Lowering the 0.70 floor to force a second RECOMMENDED marker:** named anti-pattern AP3 in `dial-reach-orchestrator.cjs`.
- **Building a bespoke AskUserQuestion multiSelect:** violates SEED-020; resolve through the dispatcher.
- **A live ordered-checkbox / arrow-key widget in-conversation:** the TTY wall (research Section 0). Represent compose-order via a follow-up AskUserQuestion ordering prompt; the live widget is Phase 154.
- **Sending finding bodies to Brain review:** Part 8 breach. Only generic framework handles + phase ids + enum scalars cross.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Framework -> command lookup | A reach->slug switch | `command-resolver.commandsForFramework()` | The ONLY sanctioned door; degrade-don't-fabricate built in; CI-drift-guarded |
| The selector widget | A bespoke AskUserQuestion call | `selector-dispatcher.pickShape({requestedShape:'F.1'})` | SEED-020 single door; trailer + telemetry + Free-Text-last + tier gating all free |
| The 4-outcome commit + edge write | Direct `room.db` open / a new edge writer | `dial-close-reach.closeReach()` + `navigation.writeEdge` | Part 9 chokepoint; SELECTED_REACH/PIVOTED/defer/miss already implemented |
| Artifact filing | A new file writer | `fileEvidenceWithReadback` (fallback `wireAccept`) | Read-back honesty (FILEVAL); the orchestrator's filing field |
| Brain egress safety | A hand-rolled redaction regex | `brain-response-sanitize.cjs` + `auditQueryString` (default-deny) | The A3 sanitizer + the egress audit are the constitutional surfaces |
| JTBD ranking | A new scorer | `f-selector-ranker.rankForSelector()` | D4 formula + investment math + decay already shipped + frozen |
| Per-room persona cache (Hats) | A new cache layer | Phase 124 timeline / 143.1 dial-memory per-room pattern | Established cache-per-room idiom; rebuilt-on-demand |
| Ordered-checkbox / multiSelect live widget | `inquirer-ordered-checkbox`, `@clack/prompts`, Ink | AskUserQuestion `multiSelect:true` + follow-up ordering prompt | The TTY wall forbids live widgets in-conversation (research Section 0) |

**Key insight:** Phase 148 is a wiring phase. The one genuinely net-new artifact is `reach-component-map.json` (data) + its dispatcher read. Everything else is connecting shipped modules that already do the work: the engines exist, the resolver exists, the ranker exists, the renderer exists, the chokepoint exists, the filing path exists. The complaint ("plumbing behind the menu") is fixed by closing ONE gap -- `closeReach` resolving + firing the real command -- plus re-pointing the dial previews from mechanism reaches to engine `sub_mode` rows.

## Runtime State Inventory

> Phase 148 is a re-wire of in-process selector logic, not a rename/migration. But it does introduce one new persisted cache and edits how an existing edge type is produced. Explicit inventory:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `SELECTED_REACH` edges in `room.db` today point at `cmd:<plumbing-label>`. After 148 they point at `cmd:<real-engine-command>`. EXISTING edges are not migrated. | Code edit only (new edges land correctly). No data migration required -- old plumbing-label edges are historical bookkeeping, harmless. State explicitly in the plan that no backfill is done. |
| Stored data (NEW) | Hats research personas cached per room (D-06). New cache file under the room (precedent: per-room dial-memory). | New write path through `navigation.cjs` / the established per-room cache; rebuilt on demand. Not a migration. |
| Live service config | None. No external service stores a reach_id. The Brain holds only generic methodology; reach_ids are LOCAL. | None -- verified: reach_ids never egress (Part 8). |
| OS-registered state | None. No Task Scheduler / pm2 / systemd registration references a reach. | None -- verified by absence. |
| Secrets / env vars | None. No secret key references a reach_id or component name. | None. |
| Build artifacts / generated registries | `data/connector-registry.json` is GENERATED by `scripts/build-connector-registry.cjs`. If a connector's `sub_mode`/reach mapping changes, the registry must be regenerated and the `--check` tripwire re-run. `data/command-registry.json` similarly generated. `reach-component-map.json` is NEW and (decision for planner) hand-maintained or generated. | Regenerate connector-registry + command-registry if any command frontmatter changes; run both `--check` tripwires. The drift tests will catch a stale registry. |

**The canonical question (after every code edit, what still holds the old shape?):** the generated registries (`connector-registry.json`, `command-registry.json`) and the drift tests that hardcode `DIAL_REACH_K === 5` and the exactly-5 reach-id set. These are the runtime/CI surfaces that must move in lockstep with the orchestrator constant change.

## Common Pitfalls

### Pitfall 1: Detonating the frozen-reach drift suite
**What goes wrong:** Adding "engine reaches" as new `reach_id` values to satisfy "engines join the ranked reach set" -> 4 tests RED + 2 SKILL constitutions contradicted.
**Why it happens:** The SPEC says "ranked reach set" and "6th reach"; the natural-but-wrong reading is "6 reach_ids."
**How to avoid:** Engines/Hats are `sub_mode` RENDER LABELS under the frozen 5 reach_ids (already declared in their connector frontmatter). Raise the dial-local PREVIEW cap `DIAL_REACH_K` 5->6; keep `REACH_IDS` (the machine-token set) frozen at 5. Update only the two tests that hardcode `DIAL_REACH_K === 5`; the reach-id exact-set test STAYS exactly-5.
**Warning signs:** A plan task that says "add reach_id 'reverse_salient'" or "extend REACH_IDS" or "mint a Hats reach_id."

### Pitfall 2: Confusing the three caps (DIAL_REACH_K vs MAX_K vs OFFERED_CAP)
**What goes wrong:** Raising MAX_K to fit more options, or conflating the dial preview count with the chooser clamp.
**Why it happens:** Three numeric caps coexist: `DIAL_REACH_K` (dial preview, 5->6), `MAX_K=3` (AskUserQuestion chooser clamp, FROZEN), `OFFERED_CAP=MAX_K` (footer math). The doctrine is "Rank 5, preview 5, choose 3" -> becomes "rank N, preview 6, choose 3."
**How to avoid:** Only `DIAL_REACH_K` moves (5->6). `MAX_K` stays 3. Standing options (File/Brain/Free-Text) render OUTSIDE the cap as appended rows, not as chooser candidates.
**Warning signs:** `MAX_K` appears in a diff; `offered_count` math changed.

### Pitfall 3: Standing options leaking into the ranker
**What goes wrong:** File / Brain review modelled as ranker candidates -> they can rank OUT and disappear (the exact bug IRW-03 forbids: "brain_consult is a ranked reach that can rank out").
**Why it happens:** Treating standing options like reaches.
**How to avoid:** Standing options are appended by the RENDER host after ranking + capping, independent of score, at every render across mode_a/mode_b/tier_0/cold-room. The IRW-03 test asserts presence is independent of ranking.
**Warning signs:** A standing option appears in `rankForSelector`'s candidate list or in `reachScores`.

### Pitfall 4: Brain review forming a freeform query
**What goes wrong:** "Auto-review the latest findings" reads finding bodies and builds a Brain prompt from them -> Part 8 breach.
**Why it happens:** The natural implementation passes the findings to the Brain.
**How to avoid:** The Brain review packet carries ONLY generic framework handles + phase ids + enum scalars (the Phase 110 typed-packet contract). Findings are summarized LOCALLY (contradictions surfaced from `room.db` via the chokepoint); only the methodology question ("what chains from X?") crosses, gated by `auditQueryString` (default-deny). The adversarial IRW-08 test asserts no user-content string reaches the packet.
**Warning signs:** A finding body, artifact text, or `summary`/`content`/`body` field flows toward `mcp__brain_*` or a packet builder.

### Pitfall 5: A bespoke selector that bypasses the dispatcher
**What goes wrong:** Building the multiSelect / confirm / ordered render directly with AskUserQuestion -> SEED-020 violation + the no-bespoke-widget audit (IRW-07) RED.
**How to avoid:** Every component resolves through `pickShape`. The component-map adds an archetype hint the dispatcher honors; the dispatcher remains the only construction site.
**Warning signs:** An AskUserQuestion payload built outside `selector-dispatcher.cjs`.

## Code Examples

### Resolving + firing the real engine on commit (IRW-06)
```
// Source: skills/intelligence-orchestrator/SKILL.md STEP 5 + lib/workflow/command-resolver.cjs (verified reads)
const resolver = require('lib/workflow/command-resolver.cjs');
// reach.framework is the EXACT framework name carried on the reach
// (e.g. dispatch-framework-map.json: find-bottlenecks -> "Reverse Salient Analysis")
const cmds = resolver.commandsForFramework(reach.framework);
if (cmds.length === 0) {
  // DEGRADE, never fabricate: tell the navigator to run <framework> manually.
} else {
  // fire cmds[0] (the real /mos: command), then file the artifact:
  //   fileEvidenceWithReadback(db, params)  (fallback wireAccept on readback error)
  //   surfaceFileEvidenceResult(result)     (FILEVAL honesty remind)
}
```

### The standing trio appended outside the cap (IRW-03)
```
// Source: lib/hmi/shape-f1-renderer.cjs normalizeVerbs (verified read)
// Free-Text-always-last is already hardcoded. File + Brain review attach the
// same way: after the ranked+capped reaches, before Free-Text, every render:
//   [ ...rankedReaches(<=offered_count) , "File these findings"[multiSelect],
//     "Brain review"[auto] , "Free-Text"[last] ]
// independent of mode_a/mode_b/tier_0 and independent of score.
```

### Reach -> component resolution (IRW-04, D-03)
```
// Source: pattern mirrors skills/intelligence-orchestrator/SKILL.md ORCH-01 (verified)
// lib/hmi/reach-component-map.json (NEW data, hand-maintained or generated):
// {
//   "context_block":  { "archetype": "multiSelect" },   // engines batch (D-01)
//   "brain_consult":  { "archetype": "multiSelect" },
//   "deep_research":  { "archetype": "confirm" },        // plan-gated
//   "_compose":       { "archetype": "ordered" },        // on-demand chain (D-02)
//   "_file":          { "archetype": "multiSelect" },    // File findings (D-05)
//   "_brain_review":  { "archetype": "auto" },           // auto, no pick (D-04)
//   "six-hats":       { "archetype": "confirm" }          // Hats go-deep (D-06)
// }
// The dispatcher reads this and routes pickShape accordingly. >=3 distinct
// archetypes emitted across a representative render set (IRW-04 acceptance).
```

## State of the Art

| Old Approach (pre-148) | Current Approach (148) | Impact |
|------------------------|------------------------|--------|
| Dial previews 5 mechanism reaches (Context Block, contradiction, ...) | Dial previews 6 rows: 5 engines + Hats as `sub_mode` labels under the frozen reach_ids | Real intelligence behind every row |
| Selecting a reach writes a plumbing-label edge, runs nothing | Selecting resolves framework->command and FIRES the real engine + lands artifact | Closes the IRW-06 gap |
| All rows share one uniform F.1 shape | Each reach routes to its archetype component via `reach-component-map.json` | The toggleable-component surface (IRW-04) |
| 3 separate suggest surfaces (F.1, offer-resolver, suggest-next) | One component-routed F.1 host via `pickShape` | Single code path (IRW-05) |
| `brain_consult` is a rankable reach that can rank out | File + Brain review are standing options outside the cap | Always available (IRW-03) |

**Deprecated/outdated within this phase scope:**
- The "plumbing label = the reach" model (the navigator's complaint). Replaced by engine `sub_mode` rows that fire real commands.
- The single-uniform-shape selector. Replaced by archetype routing.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Engines/Hats join the ranked reach SET" means they ride as `sub_mode` render labels UNDER the frozen 5 reach_ids, and `DIAL_REACH_K` 5->6 raises the dial PREVIEW cap WITHOUT minting a 6th machine `reach_id`. The frozen `REACH_IDS` set and `test-reach-ids-drift.cjs` stay exactly-5. | Summary, IRW-01/02, Pitfall 1 | HIGH. If the navigator actually wants 6 machine reach_ids, the entire frozen-reach constitution (2 SKILL files, `sensor-types.REACH_IDS`, connector `--check`, 4 drift tests) must be amended -- a much larger, canon-amending phase. The planner MUST confirm this reading with the navigator (or via /gsd-discuss-phase) before any task is written. [ASSUMED -- the spec phrasing is genuinely ambiguous; the shipped doctrine strongly favors sub_mode] |
| A2 | The "go deep" glyph is the existing lightning glyph from the 12-glyph UI-ruling vocabulary (CONTEXT.md names it a candidate). | D-06 | LOW. CONTEXT.md leaves the final pick to the planner within the vocabulary; any vocabulary glyph satisfies the constraint. [ASSUMED] |
| A3 | `reach-component-map.json` is hand-maintained (like `dispatch-framework-map.json`) rather than generated from frontmatter. | IRW-04, Code Examples | LOW. Either works; hand-maintained is simpler for 6 reaches + 3 standing options. The planner decides; if generated, add a `--check` tripwire. [ASSUMED] |
| A4 | No backfill/migration of existing `SELECTED_REACH` edges that point at old plumbing labels. | Runtime State Inventory | LOW. Old edges are historical system-bookkeeping; harmless. But state it explicitly in the plan so it is a decision, not an omission. [ASSUMED] |
| A5 | Hats persona cache reuses the per-room dial-memory/timeline cache pattern (a room-local file via the chokepoint), not a new store. | Don't Hand-Roll, Runtime State | LOW. The precedent exists (Phase 124 / 143.1); confirmed as the established idiom in CONTEXT.md. [ASSUMED] |

**If this table feels large:** A1 is the load-bearing one. The other four are low-risk defaults the planner can adopt or override. A1 must be locked before planning proceeds.

## Open Questions

1. **Does the navigator want 6 machine reach_ids, or 6 dial previews over the frozen 5 reach_ids?** (= A1)
   - What we know: the shipped doctrine fences exactly 5 reach_ids in 4 tests + 2 SKILL files; engines already carry connector frontmatter mapping them to the frozen 5 via `sub_mode`; `DIAL_REACH_K` is already a separate constant from `REACH_IDS`.
   - What's unclear: whether the spec's "6th ranked reach" / "engines join the reach set" intends new machine tokens or new dial rows.
   - Recommendation: adopt the sub_mode reading (no new reach_ids; `DIAL_REACH_K`->6). Confirm with the navigator before planning. If they want true new reach_ids, re-scope: this becomes a canon-amending phase touching sensor-types + both SKILLs + the connector contract.

2. **How is compose-order (D-02 ordered-checkbox) expressed in-conversation given the TTY wall?**
   - What we know: a live ordered-checkbox cannot run in-conversation (research Section 0); CONTEXT.md explicitly flags this.
   - What's unclear: the exact AskUserQuestion shape for capturing order.
   - Recommendation: a two-step prompt -- multiSelect to pick the engines, then a follow-up AskUserQuestion (or a numbered free-text "type the order, e.g. 2,1,3") to capture sequence; `composeWorkflow(frameworkChain)` already exists to turn an ordered framework list into a step list. The live ordered widget is Phase 154.

3. **Which surface composes the standing trio -- the renderer or the orchestrator caller?**
   - What we know: `shape-f1-renderer.cjs` hardcodes Free-Text-last; the orchestrator separates `offered_count` from `total_count`.
   - Recommendation: append File + Brain review in the host that composes the F.1 `verbs` (so the renderer stays a pure function), or extend `normalizeVerbs` with a standing-options slot. Planner's call; either passes the IRW-03 presence test.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (CJS) | All lib/ modules | Yes | >=18 (CLAUDE.md) | - |
| AskUserQuestion primitive | All interactive selectors | Yes (harness) | - | - (the only in-conversation primitive; no fallback exists or is needed) |
| `data/command-registry.json` | ranker + resolver | Yes | generated | If stale, regenerate via `scripts/build-command-registry.cjs`; `--check` tripwire guards |
| `data/connector-registry.json` | reach routing | Yes | generated | Regenerate via `scripts/build-connector-registry.cjs --check` |
| `data/dispatch-framework-map.json` | slug->framework (WFL-01) | Yes | hand-maintained | Drift-tested vs `framework-names.json` |
| Brain MCP (remote) | IRW-08 Brain review ONLY | Optional | mindrian-brain.onrender.com | Mode B / tier_0: omit the Brain line; answer from local references (Canon Part 3) -- Brain review degrades gracefully, never blocks |
| The 7 engine commands | IRW-01/02/06 | Yes | shipped | All present in `commands/` and the registry |

**Missing dependencies with no fallback:** None. Every dependency is shipped or is the harness primitive.
**Missing dependencies with fallback:** Brain MCP (the only external) -- the Brain review standing option degrades to a local-only answer when Brain is unreachable, exactly as the rest of the option-generation surface degrades mode_a->mode_b.

## Validation Architecture

> nyquist_validation is `true` in `.planning/config.json`. This section is mandatory.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in (plain CJS `assert`/`node:assert/strict` + `node:test`), driven by per-phase `tests/run-all-<phase>.sh` bash aggregators |
| Config file | none -- the convention is `tests/run-all-<phase>.sh` (see `run-all-1431.sh`, `run-all-1432.sh`, `run-all-1433.sh`, `run-all-144.sh`) |
| Quick run command | `node tests/test-148-<area>.cjs` (single suite) |
| Full suite command | `bash tests/run-all-148.sh` (NEW -- mirrors `run-all-1433.sh` structure: CJS suites + a standalone Part-8 grep sweep + carried drift fences) |
| Phase gate | `bash tests/run-all-148.sh` green AND the carried drift fences (`test-reach-ids-drift.cjs`, `test-posture-ids-drift.cjs`, connector `--check`) green |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command / Assertion | File Exists? |
|--------|----------|-----------|-------------------------------|-------------|
| IRW-01 | All 5 engine reaches resolve to a real command + are rankable | unit | `node tests/test-148-engine-reaches.cjs` -- assert for each of {reverse-salient(find-bottlenecks/rs-fetch), whitespace, find-analogies, find-connections, dominant-designs}: `commandResolver.commandsForFramework(framework).length > 0` AND the command appears in `f-selector-ranker.rankForSelector(...)` candidate set | NEW (Wave 0) |
| IRW-02 | Hats is the 6th preview reach; `DIAL_REACH_K===6`; persona cache read-then-rebuild | unit | `node tests/test-148-hats-reach.cjs` -- assert `orchestrator.DIAL_REACH_K === 6`; assert `ranker.MAX_K === 3` (still); assert a Hats `sub_mode:'six-hats'` row previews; assert persona-cache: first call rebuilds, second call reads cache | NEW (Wave 0). EDIT `test-dial-reach-orchestrator.cjs` + `test-dial-end-to-end-states.cjs` (the two `=== 5` assertions -> 6) |
| IRW-03 | File + Brain review present every render OUTSIDE MAX_K cap; Free-Text last | unit | `node tests/test-148-standing-options.cjs` -- for each tier in {mode_a, mode_b, tier_0, cold-room}: assert the rendered verb list contains "File"/"Brain review"/"Free-Text"; assert Free-Text is the LAST entry; assert presence is independent of `reachScores` (zero all scores -> trio still present) | NEW (Wave 0) |
| IRW-04 | >=3 distinct components across a render set; a non-intelligence reach carries a non-default component | unit | `node tests/test-148-component-routing.cjs` -- run a representative render set through the dispatcher; assert `new Set(emittedArchetypes).size >= 3`; assert File (non-intelligence) emits `multiSelect` (non-default) | NEW (Wave 0) |
| IRW-05 | offer-resolver + suggest-next route through the SAME reach-host renderer | unit | `node tests/test-148-unified-host.cjs` -- assert `resolveOfferNextStep` output and the suggest-next output both pass through `selector-dispatcher.pickShape` (spy/seam on a single code path); assert no second bespoke renderer is invoked | NEW (Wave 0) |
| IRW-06 | Select reverse-salient -> resolver maps to find-bottlenecks/rs-fetch -> command executes (not stubbed) -> SELECTED_REACH edge in room.db -> artifact present | integration | `node tests/test-148-real-invocation.cjs` -- in-memory/temp room.db: `closeReach({outcome:'sync', reach:{framework:'Reverse Salient Analysis', command:'/mos:find-bottlenecks'}, ...})`; assert resolver returned a non-empty command; assert a `SELECTED_REACH` edge exists via `navigation.getNeighborhood`/edge read; assert the engine artifact row/file landed via `fileEvidenceWithReadback` readback | NEW (Wave 0) |
| IRW-07 | MAX_K===3, RECOMMEND_FLOOR===0.70, MARGIN_THRESHOLD===0.15 unchanged; no bespoke widget outside the dispatcher | unit + audit | `node tests/test-148-frozen-contracts.cjs` -- assert `ranker.MAX_K===3`, `orchestrator.RECOMMEND_FLOOR===0.70`, `orchestrator.MARGIN_THRESHOLD===0.15`; grep-audit: no `AskUserQuestion` construction outside `selector-dispatcher.cjs` in the new/edited files | NEW (Wave 0) |
| IRW-08 | check-brain-boundary passes for the Brain-review path; adversarial: no user-content string reaches the Brain packet | unit + adversarial | `node tests/test-148-brain-boundary.cjs` -- feed the Brain-review path findings containing forbidden user strings (artifact body, numbers, names); assert the built packet contains ONLY generic framework handles + phase ids + enum scalars (mirror `test-navigation-packet-part8-leak.cjs` 9-tripwire pattern); PLUS the `run-all-148.sh` standalone grep sweep over new artifacts (forbidden projection/hash tokens + free-text body fields, mirroring `run-all-1433.sh` step d) | NEW (Wave 0) |

### Sampling Rate
- **Per task commit:** the single relevant `node tests/test-148-<area>.cjs` (< 5s each, pure CJS, no network)
- **Per wave merge:** `bash tests/run-all-148.sh` (full IRW-01..08 suite + carried drift fences)
- **Phase gate:** `bash tests/run-all-148.sh` green AND `node tests/test-reach-ids-drift.cjs` + `node tests/test-posture-ids-drift.cjs` + `node scripts/build-connector-registry.cjs --check` green (proving the frozen constitution survived)

### Wave 0 Gaps
- [ ] `tests/test-148-engine-reaches.cjs` -- IRW-01
- [ ] `tests/test-148-hats-reach.cjs` -- IRW-02 (+ EDIT `test-dial-reach-orchestrator.cjs` and `test-dial-end-to-end-states.cjs` `=== 5` -> `=== 6`)
- [ ] `tests/test-148-standing-options.cjs` -- IRW-03
- [ ] `tests/test-148-component-routing.cjs` -- IRW-04
- [ ] `tests/test-148-unified-host.cjs` -- IRW-05
- [ ] `tests/test-148-real-invocation.cjs` -- IRW-06 (needs a temp room.db fixture; precedent: `test-dial-close-reach.cjs` already opens a db for closeReach)
- [ ] `tests/test-148-frozen-contracts.cjs` -- IRW-07
- [ ] `tests/test-148-brain-boundary.cjs` -- IRW-08 (mirror `test-navigation-packet-part8-leak.cjs`)
- [ ] `tests/run-all-148.sh` -- the aggregator (mirror `run-all-1433.sh`: CJS suites + carried drift fences + standalone Part-8 grep sweep)
- [ ] CONFIRM A1 (reach_id vs sub_mode reading) is locked before any of the above is written -- the IRW-02 test's `DIAL_REACH_K === 6` assertion and the unchanged `test-reach-ids-drift.cjs` exactly-5 assertion both depend on the sub_mode reading being correct.

## Security Domain

> `security_enforcement` is not explicitly set to false in config -> treated as enabled. This phase touches the Brain boundary (IRW-08), so the domain is load-bearing.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Canon Part 8 graph boundary (LOCAL->BRAIN: NO) is the controlling architecture; Brain review packet is the threat surface |
| V2 Authentication | no | No auth in this phase (LOCAL room + optional Brain MCP already authed at the MCP layer) |
| V3 Session Management | no | No session tokens introduced |
| V4 Access Control | no | No new access boundaries |
| V5 Input Validation | yes | Free-text intent capture (D-08) and finding selection (D-05) are user input; route through the resolver + the egress audit, never directly into a Brain query |
| V6 Cryptography | partial | Room-slug sha256 hashing for telemetry (existing pattern in `selector-dispatcher.cjs`); the Brain packet hashes prose to sha256 by default (Phase 110); never hand-roll -- reuse the shipped projection |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User finding body egressed to Brain via the review path | Information Disclosure | Typed methodology packet only (Phase 110); `auditQueryString` default-deny; `brain-response-sanitize.cjs` A3 redaction; adversarial IRW-08 test |
| Free-text intent (D-08) smuggled into a Brain/web query | Information Disclosure / Tampering | Only the resolved generic framework name reaches `commandsForFramework`; turn text never crosses (intelligence-orchestrator Part-8 doctrine, stated verbatim) |
| Forbidden token / free-text body field in a generated registry | Information Disclosure | The `run-all-1433.sh`-style grep sweep (forbidden projection/hash tokens + `summary|content|body|text|note|description` field scan) carried into `run-all-148.sh` |
| Confirmed truth-claim written without human byUser | Tampering (integrity of legitimacy) | `SELECTED_REACH` stays system-bookkeeping (Part 9 carve-out); never folds a `confirmNode` truth-claim promotion -- `closeReach` already enforces this |

## Sources

### Primary (HIGH confidence -- direct code reads this session)
- `lib/hmi/dial-reach-orchestrator.cjs` -- `DIAL_REACH_K=5`, frozen 0.70/0.15 gate, `OFFERED_CAP=MAX_K`, the 5 `REACH_DEFS`, AP3 anti-pattern
- `lib/hmi/shape-f1-renderer.cjs` -- Free-Text-always-last (`normalizeVerbs`), `▶`/`▷` markers, Mode A/B
- `lib/hmi/dial-label-composer.cjs` -- the 5 frozen template families + the `{framework}` egress audit (`auditQueryString`)
- `lib/hmi/selector-dispatcher.cjs` -- `pickShape` single door, F.0-F.7 dispatch, tier gating, JUST_TALK refuse, AskUserQuestion trailer, telemetry
- `lib/workflow/f-selector-ranker.cjs` -- `rankForSelector`, D4 formula, `MAX_K=3`, registry read
- `lib/workflow/dial-close-reach.cjs` -- `closeReach` 4 outcomes; SELECTED_REACH/PIVOTED writes; the IRW-06 firing gap
- `lib/workflow/command-resolver.cjs` -- `commandsForFramework` / `frameworksForCommand` / `composeWorkflow` (the only door)
- `lib/core/navigation-engine-offer.cjs` -- `resolveOffer` (Phase 135 offer-resolver body)
- `lib/core/research-filing-selector.cjs` -- the "route through pickShape, not bespoke" precedent + the F.1 filing multiSelect pattern
- `skills/intelligence-orchestrator/SKILL.md` -- the reach dispatcher; the 5-step resolve+fire loop; Part-8 doctrine; "NO 6th reach_id" stated verbatim
- `lib/core/sensors/sensor-types.cjs` -- the frozen `REACH_IDS` / `POSTURE_IDS` sets
- `tests/test-reach-ids-drift.cjs`, `tests/test-dial-reach-orchestrator.cjs`, `tests/test-dial-end-to-end-states.cjs`, `tests/run-all-1433.sh` -- the drift fences + the aggregator pattern to mirror
- `data/command-registry.json`, `data/connector-registry.json`, `data/dispatch-framework-map.json` -- engine commands present + their reach/framework mappings
- `commands/{find-bottlenecks,whitespace,find-analogies,find-connections,dominant-designs,think-hats,rs-fetch}.md` -- connector frontmatter (reach_id + sub_mode + framework)
- `docs/MINDRIAN-CANON.md` Parts 3/4/8/9 -- tier-awareness, every-choice-is-graph-data, the graph boundary, memory locality
- `.planning/research/2026-06-08-keyboard-tui-capability-cockpit-research.md` Sections 0 (TTY wall), 5 (the 3-cap), 10 (component archetype matrix), 15 (phase mapping)

### Secondary (MEDIUM confidence)
- `.planning/config.json` -- `nyquist_validation: true` (confirmed)
- CLAUDE.md -- existing stack "DO NOT CHANGE"; zero new deps; tri-polar rule; no em-dashes; reuse-before-build

### Tertiary (LOW confidence)
- None. Every claim in this research traces to a direct read of shipped code or a locked CONTEXT/SPEC decision.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- every module read directly; zero new packages by design
- Architecture: HIGH for the extension points; the ONE open item (A1, reach_id vs sub_mode) is flagged as a confirm-before-plan gate, not a hidden assumption
- Pitfalls: HIGH -- each pitfall is grounded in a specific shipped test or constant that would break
- Validation: HIGH -- the IRW-01..08 -> test map reuses the exact `run-all-<phase>.sh` + CJS-assert pattern already shipped in 5 phases

**Research date:** 2026-06-08
**Valid until:** 2026-07-08 (stable internal codebase; re-verify only if the frozen-reach drift suite or the registries are regenerated before planning)

## RESEARCH COMPLETE
