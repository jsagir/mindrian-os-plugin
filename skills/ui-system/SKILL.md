---
name: ui-system
description: >
  CLI UI Ruling System. Governs ALL MindrianOS terminal output -- 4-zone anatomy,
  5 body shapes, 12 glyphs, 5 colors, session start contract, cross-surface
  adaptation. Auto-loaded on every session. No command invents its own format.
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Ambient always-on infra. The Shape F / De Stijl render contract every surface renders through; a presentation substrate, not a triggered reach."
---

# UI Ruling System

Every `/mos:` command and Larry response follows this ruling system. No exceptions. Works alongside `larry-personality` (voice), `room-passive` (STATE.md), and `room-proactive` (signals).

## 0. HTML Artifact Design System -- M:OS canonical (MANDATORY)

The zones/glyphs/colors below govern **terminal** output. Every **generated HTML artifact** -- decks, dashboards, exports, published wikis, snapshots and notes, standalone/hub/lobby pages, and any UI component rendered as HTML -- instead follows the **M:OS Canonical Design System v1.1**. If it renders as a page, it obeys M:OS. No generator invents its own palette or typography.

- **Inline** `skills/ui-system/design-system/mos-design-system.css` into every generated artifact (self-contained, no external hosts, Artifact-safe + Vercel-ready).
- Full contract: `skills/ui-system/rules/design-system.md`. Written spec: `design-system/SPEC.md`.
- Imagery: the only sanctioned recipe is `design-system/image-prompt-style.md` (one SUBJECT swap per image, one generation at a time).
- Defaults: **warm cream ground, never black** (`data-theme="light"`), theme-aware, blue retunes to `#6D9BFF` in dark, ink-on-green/yellow chips, **M:OS** wordmark (red colon).
- 75% Swiss broadside / 25% De Stijl; semantic color only; flat + rectilinear; hairline `gap:1px` module grids; isometric clickables + registration-tick frames (v1.1); inline-SVG graph + clock (never a CDN); `:focus-visible` + `prefers-reduced-motion` required.
- Applies to: `/mos:deck`, `MOSDeckEngine`, `/mos:dashboard`, `/mos:export`, `/mos:present`, `/mos:wiki` + publish, `/mos:snapshot`, and `generate-standalone/hub/lobby/snapshot/deck`, `vault-export-orchestrator`. Any future HTML surface inherits it.

## 1. Four-Zone Output Anatomy

Every output has exactly 4 zones in fixed order. No reordering. No invention.

**Zone 1: Header Panel** -- room context, venture stage, section name.
- Standard: `-- Room Name -- section -- Stage --` (box chars on CLI: `|-`)
- Compact (>30 lines or <60 cols): single-line dashes
- Room name always first (canary for multi-room context safety)
- No room: `-- MindrianOS -- no room --`
- Multi-room: use registry's active room `venture_name` or slug

**Zone 2: Content Body** -- payload per body shape (Section 2). No chrome.

**Zone 3: Intelligence Strip** -- signals from room-proactive. Only HIGH/MEDIUM. Max 3.
- Each signal: glyph + one-line description, indented 2 spaces
- `!` contradictions/warnings, `[ ]` gaps, `lightning` convergence
- Omit entirely if no signals. Never show during methodology sessions.

**Zone 4: Action Footer** -- NEVER omitted. 2-3 grounded `/mos:` commands.
- `>` primary (exactly one), `>` alternatives (1-2)
- Each: glyph + command (cyan) + brief description (gray)
- Must be real commands grounded in current state. Never suggest what user just ran.

**Density:** >30 lines: compact header, max 2 signals. <10 lines: no padding.

## 2. Body Shapes

> This section documents the current Shape F sub-shape catalog as shipped through Phase 88.2, Phase 121.5, and Phase 143.1. Today's eight sub-shapes (F.0 through F.7) are the shipped vocabulary: F.0-F.6 landed through Phase 121.5, and F.7 (the dial-TUI capability selector) shipped in Phase 143.1 as the additive variant the prior note reserved for. Treat the catalog as the current canon, not a closed terminal set.

> **Orthogonality note (Plan 121.5-10 LOCKED decision 4):** `body_shape:` frontmatter and Shape F sub-shape are ORTHOGONAL axes. `body_shape` describes the LAYOUT discipline of the command body (Shape A Mondrian Board, Shape B Semantic Tree, Shape C Room Card, Shape D Document View, Shape E Action Report). Shape F.x describes the SELECTOR CONTRACT that fires at the close of the body to capture the navigator's next-move decision. A command can carry `body_shape: B` (Semantic Tree layout) AND surface an F.1 selector at its close; these are not competing values -- they describe different surfaces of the same render. Example: `/mos:suggest-next` carries `body_shape: B` (renders the ranked list as a tree) plus an F.1 selector (the verb-pick gate beneath the tree). The `/mos:hmi-status` doctor check enforces body_shape coverage; the F-selector ranker enforces F-shape contracts. The two are not double-counted.

### Shape A: Mondrian Board
**Used by:** `/mos:status`, `/mos:diagnose`, `/mos:radar`, `/mos:admin`
Progress bars per section. 10-char: `filled` fill, `dot` empty. Section names left-aligned padded. Entry count + MINTO health (`checkmark`/`dot`/`--`). Summary line at bottom.

### Shape B: Semantic Tree
**Used by:** `/mos:tree`, `/mos:room` (no args), `/mos:rooms`, `/mos:suggest-next`, `/mos:help`, `/mos:funding`, `/mos:opportunities`
Folder tree with state glyphs. `down-arrow` expanded, `>` collapsed+content, `>` collapsed+empty. `branch`/`last-branch` siblings. Artifact status: `checkmark` complete, `dot` draft. Entry counts inline.

### Shape C: Room Card
**Used by:** `/mos:room [section]`, `/mos:grade`, `/mos:deep-grade`, `/mos:research`, `/mos:validate`, `/mos:reason`, `/mos:persona`
Governing thought (quoted), entries list (status+name+date+depth), graph edges (type+target+count), MINTO health assessment. Floating signal badge if HIGH contradiction/convergence.

### Shape D: Document View
**Used by:** `/mos:open [artifact]`, `/mos:query`
Frontmatter as key-value pairs (no YAML markers). Full content (markdown preserved). Edges at bottom. Footer suggests following edges.

### Shape E: Action Report
**Used by:** `/mos:act`, `/mos:file-meeting`, `/mos:pipeline`, `/mos:export`, `/mos:setup`, `/mos:new-project`, `/mos:update`, `/mos:wiki`
Action + source at top. Changes: section + `[before -> after]` + description. New edges listed. Summary totals. Signals from changes in Zone 3.

**Methodology commands** use no shape for conversational output. Filing confirmation uses Shape E.

### Shape F: Selector Block (AskUserQuestion family)

Shape F is the interactive selector family. It is the ruling-system implementation of the tri-context Decision Gate (see `docs/MINDRIAN-CANON.md` Part 3). Every command with a genuine fork renders its choice through one of eight (F.0-F.7) F sub-shapes. No command invents a bespoke selector.

All F sub-shapes share a common envelope:
- Header = Zone 1 header + decision-gate marker (`filled-square`).
- Three-context strip below header: LOCAL / BRAIN / SIGNAL (`down-triangle` per context).
- Prompt line (`right-triangle-filled`) asks the actual question.
- Options list uses keyboard shortcuts identical across sub-shapes: up-arrow / down-arrow (or J / K) to navigate, Enter to select, `?` to open inspect panel, Esc to cancel.
- Free-Text slot is ALWAYS the last option. The navigator can always escape the vocabulary.
- RECOMMENDED marker appears on at most one option, only when Brain confidence >= 0.7 (Phase 88.2 invariant). In Mode B (Local Only), no option is marked.

The ten canonical verbs (from canon Part 3) are: Run Methodology / Reformulate / Spawn Sub-Agent / Navigate Graph / Devil's Advocate / Scenario Plan / Synthesize / Bank Opportunity / Defer / Free-Text. Each sub-shape below draws from this vocabulary.

**Fire the card, never draw the box (SEED-021 -- the whole gate).** When a turn reaches a genuine Decision Gate that is genuinely unanswered and relevant to the current conversation, you FIRE the AskUserQuestion tool in THAT SAME turn with the gate's options. On any card-capable surface (Claude Code CLI, Cowork), for that genuine-fork case, firing the card is mandatory. You may NOT render the gate as an ASCII box (the `■ ... [1] [2] [3]` block) and ask the navigator to "type 1, 2, or 3" -- drawing the picture without firing the card is the silent-degrade the render-coverage gate (Canon Part 11 R15) exists to kill: no card, no picture (SEED-021). If you draw the gate, you fire the card.

The `[AskUserQuestion contract: shape=F.X verbs=N]` trailer and its self-decoding `[FIRE-IF-FORK: call the AskUserQuestion tool ...]` line (minted by the SEED-020 single door, `lib/hmi/selector-dispatcher.cjs` appendAskUserQuestionTrailer) are the trigger, not decoration -- and the trigger is judgment-gated, not unconditional (Phase 210 softened the old always-dispatch instruction). When the trailer appears on a fork that is genuinely unanswered and relevant to the current conversation, dispatch the card with the shown shape and options. When the navigator already plainly answered the question in the immediately preceding turn, or the gate's subject has zero connection to the current conversation (a stale artifact), do NOT dispatch it: acknowledge the answer and proceed in prose instead. Either way, do NOT reproduce the block as text (the SEED-021 render-hygiene rule holds unconditionally). This QUALIFIES the larry-personality "End with a question or next step" rule: AT a genuine Decision Gate the question IS the AskUserQuestion card, never a prose question and never an ASCII box. The "type a/b/c" fallback is ONLY for a surface that genuinely cannot fire the tool (never the CLI).

#### Shape F.0 - Mini Decision Gate

Purpose: Tiny binary or trinary decision gate. Lighter than F.1 (which carries 3-5 options); F.0 is the minimum-viable gate when the navigator only needs a yes/no/defer call before the larger selector slate fires.

When to use: A surface needs a confirmation BEFORE producing the larger F.1 selector. Most common: accept / reject / defer a recommendation before the full Next Move slate runs. Common pair: F.0 (accept this recommendation?) -> F.1 (now choose next move).

Header format:
```
[filled-square] [CONTEXT] - MINI GATE             - decision gate
[right-triangle-filled] {short binary or trinary question}
```

Options: EXACTLY 3 verbs as shipped (lib/hmi/shape-f0-renderer.cjs): Approve / Reject / Defer. No Free-Text slot in F.0 -- the Reject path captures the reason as a REJECTED_BECAUSE typed edge property (Canon Part 4: rejection is data), so the vocabulary stays closed without losing free-form intent. F.0 ALWAYS produces a typed edge; there is no silent dismiss path.

Verb constraints: F.0 collapses to one of the 10 canonical verbs upon selection. Approve -> Run Methodology (or whatever the recommendation called for). Reject -> captured-reason edge (REJECTED_BECAUSE; eventType `selector_rejection_captured`). Defer -> Defer (queue for milestone audit).

Keyboard: up-arrow / down-arrow (or J / K) to navigate, Enter to select, `?` to inspect, Esc to cancel. No RECOMMENDED marker is rendered in F.0 (the shape itself is the recommendation surface; marking one option would double-cue).

State-update hook: append to STATE.md Decisions section with the chosen verb + a tiny one-line context snapshot (F.0 gates are lightweight; do NOT bloat Decisions with full context). A typed edge `(navigator) -[CHOSE_MINI {verb}]-> (recommendation-node)` lands in the local graph; Reject additionally writes REJECTED_BECAUSE with {reason, rejected_at, parent_decision_id}.

Shipped in: Phase 88.2 (uiux-selector-block, Plan 88.2-05).

#### Shape F.1 - Next Move

Purpose: Default selector after any discuss chunk. The most-used shape.

When to use: End of team discussion, end of methodology session, any insight checkpoint where the navigator must pick the next verb.

Header format:
```
[filled-square] [CONTEXT] - NEXT MOVE             - decision gate
[down-triangle] LOCAL   / BRAIN   / SIGNAL
[right-triangle-filled] Choose next move:
```

Options: 3-5 drawn from the canonical ten verbs. Free-Text is always the last option.

Verb constraints: Any of the ten canonical verbs is permitted. Typical slate = Run Methodology / Navigate Graph / Devil's Advocate / Bank Opportunity / Free-Text.

Keyboard: up-arrow / down-arrow (or J / K) to navigate, Enter to select, `?` to inspect, Esc to cancel.

State-update hook: append to STATE.md Decisions section with timestamp + chosen verb + context snapshot. A typed edge is added to the local graph: (navigator) -[CHOSE {verb}]-> (current-artifact).

##### Brain-suggestion variant (Plan 121.5-10 LOCKED)

When the F.1 selector consumes Brain-ranked next moves (the 5 surfaces: `/mos:suggest-next`, `/mos:act --chain` pre-gate, the Phase 116 tension-hook-agent, the Phase 117 auto-explore-agent, and the Phase 89-07 reverse-salient-agent), the renderer applies a LOCKED visual variant per the Phase 121.5 selector audit Section 5.2. The lock is non-negotiable; any future Brain-suggestion consumer MUST follow this shape (the `tests/test-no-bespoke-brain-prompts.sh` CI tripwire enforces it).

- **Header chip:** `[■ BRAIN]` (literal -- 9 chars including brackets). Distinct from `[GATE]` / `[CONTEXT]` / `[NEXT MOVE]` chips by the leading filled-square glyph.
- **Question line:** `Choose next move:` (default; per-surface variants land here per Section 5.3 adoption diffs -- tension surfaces use `Resolve pending tension:`; BQ surfaces use the verbatim Brain BQ name; reverse-salient surfaces carry the persona suffix in the body slot rather than question line because F.0 has no question slot).
- **Option rows:** TWO lines per row. Row 1 = `<glyph> <N>. <Run Verb>` left-padded + `<conf>%` right-aligned to the 80-col boundary. Row 2 = 5-space indent, `<framework category> · <graph relationship>`. Glyphs: `▶` (right-triangle-filled) for >= 0.7 confidence top pick; `▷` (right-triangle-empty) for sub-0.7 alternatives. The one-glyph hierarchy replaces the verbose `(RECOMMENDED)` tag without consuming horizontal space.
- **Footer:** Stat-strip line `▶ Brain · top-<K> of <N> ranked · <color> = informing`. Three signals in one line: provenance, scale, and color-legend reminding the navigator that the cyan rail means Brain is informing, not commanding.
- **Zone 1 left-rail color:** `cyan` default. Yellow-on-cascade for CONTRADICTS edges is DEFERRED to v1.13.2 hotfix per LOCKED decision 3 (audit Section 7 Open Question 3).
- **Verb-label aliases:** registered aliases ALLOWED per LOCKED decision 1 (audit Section 7 Open Question 1). The dispatcher carries `alias_map` (loaded from `lib/hmi/jtbd-taxonomy.json` `alias_map.verb_aliases`); aliases render to the user; canonical verbs persist to graph edges via `navigation.cjs`. Default 4 aliases: Resolve / Explore -> Run Methodology; Later -> Defer; Skip -> Free-Text.
- **Full template + slot-value table + anti-patterns rejected:** `docs/F-SELECTOR-CONSUMER-GUIDE.md` Section 4 (NEW; published as part of Plan 121.5-10).

#### Shape F.2 - Path Control

Purpose: When the navigator is choosing structure, not content. Plan / Replan variants. Ties to Claude Code Plan Mode.

When to use: Entering a methodology chain, transitioning between pipeline stages, user signals they want to step back and re-plan instead of continuing tactical work.

Header format:
```
[filled-square] [CONTEXT] - PATH CONTROL          - decision gate
[down-triangle] LOCAL   / BRAIN   / SIGNAL
[right-triangle-filled] Choose path:
```

Options: 3-5. Free-Text is always the last option.

Verb constraints: Drawn from Run Methodology / Reformulate / Scenario Plan / Defer / Free-Text. Path Control does not typically surface Navigate Graph or Bank Opportunity (those are tactical, not structural).

Keyboard: up-arrow / down-arrow (or J / K) to navigate, Enter to select, `?` to inspect, Esc to cancel.

State-update hook: update STATE.md Current Position.Plan field with the chosen plan name. A typed edge is added: (navigator) -[CHOSE_PATH {plan}]-> (phase-node).

#### Shape F.3 - Rabbit-Hole Depth

Purpose: Before deep-diving. Sets how far the navigator wants to chase a branch.

When to use: User has chosen to explore a specific topic, artifact, or contradiction. Shape F.3 gates how much energy to spend before returning.

Header format:
```
[filled-square] [CONTEXT] - DEPTH                 - decision gate
[down-triangle] LOCAL   / BRAIN   / SIGNAL
[right-triangle-filled] How deep?
```

Options: exactly 5 (fixed vocabulary, NOT drawn from the ten verbs): Shallow / Medium / Deep / Extreme / Back. Free-Text is not offered in F.3 - depth is a closed axis. Back returns to the previous shape.

Verb constraints: F.3 is the one sub-shape whose option set is NOT the canonical verb vocabulary. It is a depth scalar. The verb that follows F.3 is chosen by the calling command.

Keyboard: up-arrow / down-arrow (or J / K) to navigate, Enter to select, `?` to inspect, Esc to cancel.

State-update hook: a TodoWrite row is created with a depth tag (`depth:shallow`, `depth:medium`, `depth:deep`, `depth:extreme`). The row owns the subsequent exploration work. No STATE.md Decisions entry until the exploration completes.

#### Shape F.4 - Insight Extraction

Purpose: When a branch has enough material. Close-out selector for a discuss chunk.

When to use: The navigator has been exploring a topic and the material is rich enough to harvest. F.4 decides what artifact (if any) to produce.

Header format:
```
[filled-square] [CONTEXT] - INSIGHTS              - decision gate
[down-triangle] LOCAL   / BRAIN   / SIGNAL
[right-triangle-filled] Extract what?
```

Options: exactly 5 (fixed vocabulary): Key insights / + contradictions / + actions / Create artifact draft / Back. Free-Text is not offered in F.4 - extraction scope is a closed ladder. Back returns to the previous shape.

Verb constraints: F.4 wraps the canonical verb Synthesize. Options are progressive scopes of what the Synthesize verb will produce. Create artifact draft is the handoff verb into Shape E (Action Report) downstream.

Keyboard: up-arrow / down-arrow (or J / K) to navigate, Enter to select, `?` to inspect, Esc to cancel.

State-update hook: append a synthesis note to STATE.md Accumulated Context. If "Create artifact draft" is selected, additionally create a TodoWrite row for drafting. A typed edge is added: (navigator) -[SYNTHESIZED {scope}]-> (discuss-chunk).

#### Shape F.5 - Branch Resolution

Purpose: When multiple paths exist. The navigator is returning from parallel exploration and must decide how branches converge.

When to use: User has explored two or more branches (via Scenario Plan, Compare Ventures, or manual fork). F.5 decides whether to continue one, merge them, compare them formally, park one for later, or drop one.

Header format:
```
[filled-square] [CONTEXT] - BRANCH                - decision gate
[down-triangle] LOCAL   / BRAIN   / SIGNAL
[right-triangle-filled] Resolve branch:
```

Options: 3-5 drawn from: Continue / Merge / Compare / Park / Drop. Free-Text is always the last option. Typical slate = Continue / Merge / Compare / Park / Free-Text.

Verb constraints: F.5 is specialized to branch-resolution semantics. Continue maps to Run Methodology on the chosen branch. Merge maps to Synthesize across branches. Compare maps to Scenario Plan in compare mode. Park maps to Defer. Drop is the terminal Reject-with-reason path.

Keyboard: up-arrow / down-arrow (or J / K) to navigate, Enter to select, `?` to inspect, Esc to cancel.

State-update hook: append to STATE.md Decisions section naming the resolved branch and the resolution verb. A typed edge is added: (branch-root) -[RESOLVED {verb}]-> (target). Parked branches additionally create a milestone-audit TodoWrite row.

#### Shape F.6 - Plan Review Round

Purpose: Plan Mode wrap. When the navigator has been in a planning surface (e.g. after a methodology session that produced a plan), F.6 closes the round with an explicit Review verb selection BEFORE returning to Plan vs Build mode. F.6 is also the JTBD-aware variant of Shape F that the dispatcher routes to when a JTBD signal is set; the umbrella `F` branch in selector-dispatcher.cjs picks F.6 when jtbd is non-null and F.1 otherwise (lib/hmi/selector-dispatcher.cjs).

When to use: End of a plan-producing methodology session, OR any Shape F surface where a non-null JTBD is in play and the renderer should produce a JTBD-aware Next Move slate. The navigator must explicitly review the plan (or defer review, or replan from scratch) before the system promotes the plan into the Decisions log.

Header format:
```
[filled-square] [CONTEXT] - PLAN REVIEW           - decision gate
[down-triangle] LOCAL   / BRAIN   / SIGNAL
[right-triangle-filled] Review this plan:
```

Options: 3-5. Typical slate:
  Approve plan
  Revise plan
  Replan from scratch
  Defer review
  Free-Text

Verb constraints: Approve plan -> Synthesize (the plan becomes a confirmed artifact). Revise plan -> Reformulate (re-runs the planning verb with edits). Replan -> Reformulate from a fresh seed. Defer review -> Defer. Free-Text -> Free-Text. JTBD-aware variants source their verbs from `lib/hmi/jtbd-taxonomy.json` `next_move_verbs`; falls through to F.1 if the JTBD taxonomy entry is missing or the dispatcher receives a null JTBD.

Keyboard: standard F-family keyboard (inherits from F.1 per Phase 101-01 D-01).

State-update hook: on Approve, the plan is promoted from `review_status: proposed` to `review_status: confirmed` (Canon Part 9 truth-state machine). On Revise/Replan, the original plan stays `proposed` and a new revision edge is created. On Defer, a milestone-audit TodoWrite row queues the review. Plan-review variant additionally writes REVIEWED typed edges per question position with {round_id, position, latency_ms, was_decoy, response, confidence_self_report} (lib/hmi/shape-f6-plan-review-renderer.cjs).

Shipped in: Phase 88.2 (uiux-selector-block, Plan 88.2-06 plan-review variant) + Phase 101-01 (JTBD-aware Next Move variant).

#### Shape F.7 - Dial-TUI Capability Selector (Phase 143.1)

Purpose: Surface the navigator's ranked capability reaches as a single confidence-column dial. F.7 is a SPECIALIZATION of F.1 (Next Move), not a new selector primitive: it reuses `renderShapeF1` / `shape-f1-renderer.cjs` and adds a right-aligned confidence column plus the filled/empty triangle marker hierarchy. The dial answers one question -- "what is the best next reach right now, and how sure are we?" -- by letting the navigator scan the right column top-to-bottom. Per SEED-020 there is NO bespoke widget; the dial is the AskUserQuestion card-selector with a confidence column.

When to use: When the orchestrator has computed ranked reaches for the current focus (the 6 reach-ids below; Phase 148 D-09 raised 5 -> 6 with the hats reach) and the navigator is at a decision moment where a capability reach is the right next move. F.7 is the surface for the Phase 143.1 dial; the engine that auto-populates it routes once Phase 144 lands (the dial-TUI shipped in 143.1; the engine flip is Phase 144).

Header format:
```
[filled-square] [CONTEXT] - REACH                 - decision gate
[down-triangle] LOCAL   / BRAIN   / SIGNAL
[arrow] Choose next reach:
```

The header glyphs map to the approved-12 vocabulary: `[filled-square]` = `■`, `[down-triangle]` = `▼`, `[arrow]` = `→`. The prompt-line glyph was declared `[right-triangle-filled]` (`▶`) in an earlier draft, but `▶` is the FROZEN recommended-row marker on the chooser body (S1 = exactly one `▶`); reusing it in the header would collide with that frozen single-marker contract. FIX-09 (150.6-04, navigator-LOCKED: render the canon header) shipped the prompt line with `→` and amended this declaration to match what `lib/hmi/dial-presenter.cjs` renders (truth-telling, not blessing drift). The frozen contracts (MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the body marker glyphs `▶`/`▷`) are unchanged.

Options: the 6 frozen reach-ids, surfaced as WHAT-THEY-GET Feynman labels (the canonical verb persists to the graph edge, not the screen). These reach-ids are an F.7 specialization, NOT a replacement for the 10 canonical verbs -- each reach maps onto an existing canonical verb when it commits:
- `context_block` -- "Pull up what we decided about {topic}." (problem-space reflection)
- `contradiction` -- "Show where {topic_a} and {topic_b} pull against each other." (assumption stress-test)
- `cross_room` -- "Bring in what {room_name} already worked out about {topic}." (cross-context synthesis)
- `brain_consult` -- "Suggest the next move for {framework_or_situation}." (methodology guidance; Part 8: generic framework handle only)
- `deep_research` -- "Go find out what the world knows about {topic}, framed through {framework}." (external research; Part 8: generic framework handle only)
- `hats` -- "Spin up a research-personas hats pass on {topic}." (confirm-gated research-personas hat-spin; the 6th machine reach, Phase 148 D-09; render-only, no framework egress)

Free-Text is NOT a 4th explicit row -- the host-injected "Type something" / "Chat about this" rows handle overflow (the chooser stays MAX_K=3 even though the orchestrator previews DIAL_REACH_K=6; the two-K separation is locked: DIAL_REACH_K=6 preview, MAX_K=3 chooser -- Phase 148 D-09 raised the preview 5 -> 6 when 'hats' became the 6th machine reach).

Render states: five states ship (`lib/hmi/dial-presenter.cjs`):
- S1 (Mode A clear leader): 1 filled triangle on reach #1; rows 2-3 get the empty triangle; footer stat-strip.
- S2 (Mode A near-tie): 2 filled triangles on reach #1 + #2 when the margin < 0.15; row 3 gets the empty triangle.
- S3 (Mode B, Local Only): all rows get the empty triangle; framing "No recommendation - offline. You pick."; honest low percentages.
- S4 (Tier 0 cold-room): all rows get the empty triangle; framing "New room - nothing to rank yet. Start anywhere."; confidence column renders "--".
- S5 (partial-slot degradation): markers per gate; an unresolvable {topic} slot drops to the generic JTBD one-line label; marker logic unchanged.

Confidence column: right-aligned monospace NN% (or "--" in Tier 0). Scanning the right column top-to-bottom IS reading the dial. The filled triangle prefix = RECOMMENDED, the empty triangle = standard. In Mode B / Tier 0 ALL rows get the empty triangle (zero filled markers), and this absence is INTENTIONAL, not broken.

Verb constraints: the frozen 0.70/0.15 recommended gate is a DIAL-ONLY variant and does NOT lower the F.0-F.6 0.7 gate. reach #1 is recommended when tier_mode == mode_a AND score >= 0.70; reach #2 is recommended when tier_mode == mode_a AND score >= 0.70 AND (reach#1.score - reach#2.score) < 0.15; all others false. In Mode B / Tier 0 recommended is always false.

Keyboard: standard F-family keyboard (inherits from F.1): up-arrow / down-arrow (or J / K) to navigate, Enter to select, `?` to inspect, Esc to cancel.

State-update hook: closeReach() runs a 4-outcome transaction routed ONLY through `navigation.cjs`:
- Resting-detent commit (implicit sync): navigator commits without rotating -> writeEdge SELECTED_REACH from the active focus to `cmd:<command>` with props {jtbd, framework, recommended, decision_id} + logMemoryEvent `f_selector_sync_confirmed` (the resting detent IS the in-sync signal, DIALTUI-07).
- Rotate-to-pivot commit (explicit disagreement): navigator commits OFF the recommended reach -> writeEdge PIVOTED from chosen to declined-recommended with ENUM-only props {declined_recommended, margin, decision_id} + logMemoryEvent `f_selector_pivot` + investment-scaled pivot_penalty decay into the ranker, AND writeEdge SELECTED_REACH to the chosen (not-recommended) reach.
- Defer / Reject: delegates to selector-decisions.recordSelectorDecision (DEFERRED +30d or REJECTED cascade edge). NO SELECTED_REACH, NO next-action.
- Free-Text / none-fit overflow: delegates to selector-decisions.recordSelectorMiss({top_k_offered, user_intent}). NO cascade edge, NO SELECTED_REACH.

Shipped in: Phase 143.1 (dial-TUI capability selector). The dial-TUI shipped in 143.1; the engine flip that auto-fires the dial is Phase 144. SEED-020: no bespoke widget -- F.7 reuses `renderShapeF1` / `shape-f1-renderer.cjs`. (The CANON-PHASE-MAP Part 3 / Part 10 row that records the engine flip flips in Phase 144's commit, not here.)

## 3. Symbol Vocabulary

12 glyphs. One meaning each. No overloading.

| Glyph | Meaning |
|-------|---------|
| `filled-square` | Progress fill (Shape A) |
| `down-triangle` | Expanded node (Shape B) |
| `right-triangle-filled` | Collapsed+content / primary action |
| `right-triangle-empty` | Collapsed+empty / alternative action |
| `branch` | Not-last sibling |
| `last-branch` | Last sibling |
| `checkmark` | Complete |
| `bullet` | Draft/partial |
| `warning` | Contradiction/warning |
| `lightning` | Convergence |
| `empty-square` | Gap |
| `arrow` | Inline suggestion |

**NO EMOJI. EVER.**

Carve-out (2026-04-14, user directive): the Claude Code statusline rendered by `scripts/context-monitor` is **excepted** from this rule. The statusline is a passive signal surface rendered by the host terminal, not a MindrianOS command output body, and the user has authorized emoji use there specifically. Every other surface (slash-command output, artifact generation, MINTO.md files, CHANGELOG entries, reports, dashboard HTML bodies, PDF exports, printed logs) must continue to honor the no-emoji rule without exception. If you are reading this and about to add emoji to any surface other than `scripts/context-monitor`, stop.

### ODD 4 resolution (2026-05-16): the 🎯 overload + the "JTBD" word collision

Two known vocabulary collisions exist in v1.13.0 that we explicitly DOCUMENT rather than renumber or rename (the renumbering cost is too high for a closing milestone; see Phase 121.5 CONTEXT.md ODD 4). Both are RESOLVED BY POSITION-ANCHORED CONTEXT, mirroring the no-emoji + statusline carve-out pattern above:

1. The 🎯 glyph means three things, each disambiguated by SURFACE:
   - In the statusline Row 2 (`scripts/context-monitor`), 🎯 prefixes the active JTBD label -- meaning "what job are you in right now."
   - In `/mos:jtbd` command output and JTBD broadcast banners, 🎯 prefixes a JTBD recommendation -- meaning "this is the job we're proposing."
   - In `lib/core/visual-ops.cjs` EXPLORATION_LABELS, 🎯 is the stage emoji for `problem-definition` -- meaning "where the wicked navigator starts."

   The three meanings never collide on the same surface at the same time. Reader disambiguation: where is the 🎯? (statusline row 2 / command output / EXPLORATION_LABELS render path).

2. The word "JTBD" names two unrelated systems:
   - Phase 37 nudge templates (`lib/hmi/build-jtbd-nudges` -- bash, prompt-engineering style).
   - Phase 100 typed engine (`lib/hmi/jtbd-taxonomy.json` -- 13 JTBDs with cues / methodology hooks / next_move_verbs / completion patterns -- the AUTHORITATIVE system).

   When SKILL.md, the canon, or any user-facing surface says "JTBD" without qualification, it means Phase 100 typed engine. The Phase 37 nudges are an internal prompt-engineering layer beneath the engine; user-facing surfaces never name them directly.

This is the SAME shape of carve-out as the no-emoji rule + statusline exception. The pattern is: a global rule with a precisely-named exception, position-anchored. Future v1.14.0 may renumber the glyphs or rename "JTBD"; for v1.13.0 final we mark the seam, not move it.

See `skills/ui-system/rules/glyph-disambiguation.md` for the full rule + the v1.14.0 cleanup proposal.

## 4. Color Contract

5 ANSI colors with fixed meaning. Color is NEVER decoration.

| Color | Meaning |
|-------|---------|
| Green `\033[32m` | Success, active, complete |
| Cyan `\033[36m` | Commands, paths, links |
| Yellow `\033[33m` | Warnings, caution |
| Red `\033[31m` | Errors only |
| Gray `\033[90m` | Meta info, timestamps, hints |

Bold for emphasis. Default/white for content. Never combine colors on one token. Red = errors only (warnings = yellow).

### Dual De Stijl palette (Phase 102 D-06b)

The 5-color CLI contract above is the BASE palette. Phase 102 (context-aware rendering) added a SECOND palette tier: the Mondrian primaries palette, which kicks in for FULL-COLOR surfaces (HTML exports, wiki/dashboard, presentation decks, Cytoscape graphs) where the 5-ANSI CLI palette is the wrong semantic match.

The dual-palette rule (Phase 102 D-06b) is: pick the palette by SURFACE, not by JTBD. The same JTBD can render red on CLI (semantic) and blue on HTML (Mondrian) and that is correct.

Two palettes:

- **CLI semantic palette** (THIS section's 5-color contract: red / yellow / cyan / green / gray). Used for every `/mos:*` terminal output. Color carries semantic meaning at the terminal (red = error, etc.). Applied as a single colored Zone 1 left-rail accent at the start of the header (`lib/render/render-v2.cjs` `JTBD_CLI_COLOR` map), TTY-gated via `process.stdout.isTTY` so non-TTY captures stay byte-clean.

- **Mondrian HTML palette** (red / yellow / blue / black / white). Used by HTML-emitting downstream phases ONLY (Phase 19 wiki-dashboard, Phase 25 data-room-export-v2, Phase 30 presentation-generator). Visual identity discipline: rectilinear grids, primary blocks, large white space. Mondrian shapes vocabulary extends the 12-glyph CLI set with `circle (●)` on HTML surfaces only.

Surface routing:

| Surface | Palette | Why |
|---------|---------|-----|
| CLI / TUI | 5-color semantic | Color carries semantic meaning at the terminal |
| HTML dashboard / wiki / presentation / Cytoscape | Mondrian primaries | Visual identity discipline; De Stijl rectilinear grid |

Compact mode (>80% token budget) drops the Zone 1 left-rail accent. Semantic body colors stay.

Source-of-truth definitions: `lib/render/JTBD-PALETTES.md` (the Phase 102 canonical mapping). See `skills/ui-system/rules/dual-palette.md` for the full rule, hex values, and per-JTBD mapping table.

The CANONICAL De Stijl hex values used across `scripts/banner`, `lib/core/visual-ops.cjs` (`DS_HEX`), `templates/destijl-base.css`, `templates/shared.css`, and `references/vault-kit/snippets/mindrian-destijl.css` will consolidate to `references/visual/palette.json` per Sub-plan D of Phase 121.5. This SKILL.md surface treats `palette.json` as the canonical reference once it lands.

### The voice-color mark (Part 12 Voice Signature, render-contract side)

The Part 12 Voice Signature gives every Larry CLI turn one De Stijl color mark naming the pedagogical move (🟦 blue=building, 🟥 red=challenging, 🟨 yellow=contradiction, ⬛ black=gate, ⬜ white=invisibility). On the render side the contract is exact and minimal:

- The voice-color mark is DELIVERED AS A COLORED EMOJI SQUARE, not a color-name word and not ANSI. Phase 182.1 (navigator-confirmed 2026-06-28) found this host strips ANSI (truecolor + 256 + basic-16) to literal text, so only a font-rendered emoji square carries real color. The glyph IS the color: 🟦 U+1F7E6 / 🟥 U+1F7E5 / 🟨 U+1F7E8 / ⬛ U+2B1B / ⬜ U+2B1C.
- The mark is ONE of the 5 EXISTING De Stijl Mondrian colors (red / yellow / blue / black / white), anchored at `references/visual/palette.json` (`base.mondrian_*`). NO new color is minted (D2 / D4). The detector module `lib/hmi/voice-color-mark.cjs` (`MARK_COLORS` + the frozen `MARK_GLYPHS` 5-set) is closed, so a sixth color is structurally impossible. ANSI is progressive-enhancement only, painted where the host supports it; the glyph alone always carries the color.
- The mark is ADDITIVE legibility and alters NO frozen render contract. The 12-glyph vocabulary, the 4-zone anatomy, MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, and R15 render coverage are ALL unchanged. The mark layers a single move-named color onto Larry's turn; it does not touch the Shape F selector, the dial, or any frozen glyph.
- A turn with no mark is the native host speaking (the absence is the signal). The five emoji squares are the De Stijl Mondrian primaries; the mark mints no new glyph and no sixth color.

## 5. Session Start Contract

Three variants based on room state:

**Cold Start (no room found):** Brief. Header shows MindrianOS/no room. Mention that rooms will be created at ~/MindrianRooms/. Primary: `/mos:new-project`. Alt: conversational start.

**Warm Start (room, no signals):** "Reading the Room" trace (blockquote). Show room path as ~/MindrianRooms/[name]/. Stats: active sections, entries, last activity. Strongest/weakest callouts. Grounded actions.

**Warm Start + Signals (room + HIGH/MEDIUM):** Same trace + max 2 signals. Room path shown in header as ~/MindrianRooms/[name]/. Prioritize 1 contradiction + 1 convergence. First action addresses top signal. Never repeat same signal consecutive sessions unless changed.

## 6. CLI Voice Rules

Larry in terminal: terse, structural, confident, action-oriented.

**Banned:** "Great question!", "I'd be happy to help", "It's important to note", "Let me explain", sentences starting with "I", "Here's what I found", "I think/believe", "Please note that", "As mentioned earlier"

**Allowed:** Direct statements, imperatives, evidence-first, observations. Lead with data. One insight per line. Confidence without hedging. Capitalize methodology names.

## 7. Error Handling

Three-line pattern:
- Line 1: `x` (red) + what failed
- Line 2: `Why:` (indented) + specific reason
- Line 3: `Fix:` (indented) + one resolving command (cyan)

Never show stack traces, raw errors, JSON, or >3 lines. Multiple failures: show first only.

## 8. Help System

`/mos:help`: Commands grouped by flow (Getting Started, Working, Reviewing, Brain+Intelligence, Export+Admin). Tree format.

`/mos:help [cmd]`: tldr-style. 1 description line + max 3 examples. Not a man page.

## 9. Cross-Surface Adaptation

CLI is master template. Desktop degrades: no box chars (use bold headers), no progress bars (use text), no tree symbols (use bullets), no ANSI color (use markdown). Cowork matches CLI. Signal glyphs and action footer work everywhere.

Width: 80 cols default, never expand beyond. <60 cols: compact headers, collapse trees, 1 signal max.

## 10. Dual Context: STATE.md + MINTO.md

Every section gets STATE.md (quantitative: counts, gaps, timestamps) and MINTO.md (qualitative: governing thought, arguments, evidence, MECE check).

MINTO health in commands: `checkmark` = governing thought + 2+ argued, `dot` = partial, `--` = missing.

Routing priority: Broken MINTO + many entries -> "needs reasoning" (`/mos:structure-argument`). Solid MINTO + few entries -> "needs evidence". Empty both -> gap exploration. Solid both -> cross-referencing/grading.

## Quick Reference

```
ZONES:     Header | Body | Signals | Footer
SHAPES:    A=Board  B=Tree  C=Card  D=Doc  E=Report  F=Selector(F.0-F.7)
GLYPHS:    filled down-tri right-tri-f right-tri-e branch last-branch check dot warn lightning empty-sq arrow
COLORS:    Green=success  Cyan=commands  Yellow=warn  Red=error  Gray=meta
GREETING:  Cold | Warm | Warm+Signals (max 2)
ERRORS:    x What / Why: reason / Fix: /mos:command
HELP:      1 line + 3 examples, grouped by flow
WIDTH:     80 cols default, never expand
NO EMOJI:  Ever.
```

## 11. Cross-Reference to Canon

This Ruling System implements two canon parts:

- **Canon Part 3 (Tri-Context Decision Gate)** -- every Shape F surface IS the Part 3 Decision Gate at terminal scale. The 10 canonical verbs in Canon Part 3 are the vocabulary Shape F selectors draw from. The five-shape rule -- one selector family per decision moment, no command invents its own selector -- enforces Part 3 at the UI layer. See `docs/MINDRIAN-CANON.md` Part 3.

- **Canon Part 10 (Conversation as Product)** -- this Ruling System enforces the property that "the terminal IS the product surface." Every glyph, every zone, every selector encodes "you are navigating a wicked problem with Larry." If the terminal is incoherent, Canon Part 10 isn't demonstrated. Phase 121.5 (terminal-coherence-capstone) is the consolidation pass that closed the gap between this ruling system and shipped code. See `docs/MINDRIAN-CANON.md` Part 10.

Updates to this ruling system MUST update `docs/CANON-PHASE-MAP.md` in the same commit -- see Canon Part 6 (Product-as-Venture / dog-fooding mandate). The ruling system is dog-food: the product we ship for navigators is built using the product we ship for navigators.
